use anyhow::{Context, Result};
use clickhouse::Row;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::coworking_session::{
    CoworkingHistoryRow, CoworkingParticipantRow, CoworkingSessionRow,
};
use crate::services::org::now_secs;

#[derive(Debug, Deserialize, Row)]
struct SessionIdRow {
    #[serde(with = "clickhouse::serde::uuid")]
    session_id: Uuid,
}

#[derive(Debug, Deserialize, Row)]
pub struct PersonalWindow {
    pub joined_at: u32,
    pub left_at: Option<u32>,
}

pub struct CoworkingSessionRepository {
    client: Arc<ClickHouseClient>,
}

impl CoworkingSessionRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn migrate(&self) -> Result<()> {
        let ch_client = self.client.get_client();

        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS coworking_sessions (
                    session_id UUID,
                    room_id UUID,
                    team_id Nullable(UUID),
                    zone_id Nullable(UUID),
                    source LowCardinality(String) DEFAULT 'legacy_proximity',
                    ended_reason LowCardinality(String) DEFAULT '',
                    started_at UInt32,
                    ended_at Nullable(UInt32),
                    updated_at UInt32,
                    last_observed_at UInt32 DEFAULT updated_at
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (room_id, session_id)
                "#,
            )
            .execute()
            .await
            .context("Failed to create coworking_sessions table")?;

        for column in [
            "zone_id Nullable(UUID)",
            "source LowCardinality(String) DEFAULT 'legacy_proximity'",
            "ended_reason LowCardinality(String) DEFAULT ''",
            "last_observed_at UInt32 DEFAULT updated_at",
        ] {
            let sql = format!("ALTER TABLE coworking_sessions ADD COLUMN IF NOT EXISTS {column}");
            ch_client
                .query(&sql)
                .execute()
                .await
                .with_context(|| format!("Failed to add coworking_sessions column: {column}"))?;
        }

        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS coworking_session_participants (
                    session_id UUID,
                    user_id UUID,
                    joined_at UInt32,
                    left_at Nullable(UInt32),
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (session_id, user_id)
                "#,
            )
            .execute()
            .await
            .context("Failed to create coworking_session_participants table")?;

        Ok(())
    }

    pub async fn insert_session(&self, row: &CoworkingSessionRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("coworking_sessions")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert error: {e}"))?;
        insert
            .write(row)
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse write row error: {e}"))?;
        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert error: {e}"))?;
        Ok(())
    }

    pub async fn upsert_participant(&self, row: &CoworkingParticipantRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("coworking_session_participants")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert error: {e}"))?;
        insert
            .write(row)
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse write row error: {e}"))?;
        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert error: {e}"))?;
        Ok(())
    }

    pub async fn get_session(&self, session_id: Uuid) -> Result<Option<CoworkingSessionRow>> {
        let row = self
            .client
            .get_client()
            .query(
                "SELECT session_id, room_id, team_id, zone_id, source, ended_reason,
                        started_at, ended_at, updated_at, last_observed_at
                 FROM coworking_sessions FINAL
                 WHERE session_id = ?
                 LIMIT 1",
            )
            .bind(session_id)
            .fetch_optional::<CoworkingSessionRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(row)
    }

    /// Finds the session this user is *currently* (actively) part of in this room, if
    /// any — the join key for "should this drag-together event extend an existing group
    /// session, or start a new one" (see `services/coworking_session.rs`).
    pub async fn active_session_for_user_in_room(
        &self,
        room_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<Uuid>> {
        let row = self
            .client
            .get_client()
            .query(
                "SELECT s.session_id AS session_id
                 FROM coworking_sessions AS s FINAL
                 INNER JOIN coworking_session_participants AS p FINAL
                     ON p.session_id = s.session_id
                 WHERE s.room_id = ?
                   AND s.ended_at IS NULL
                   AND p.user_id = ?
                   AND p.left_at IS NULL
                 LIMIT 1",
            )
            .bind(room_id)
            .bind(user_id)
            .fetch_optional::<SessionIdRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(row.map(|r| r.session_id))
    }

    /// Needed before marking a participant as having left: `ReplacingMergeTree` requires
    /// the whole row on every write, so `left_at` can't be set without first knowing the
    /// real `joined_at` — overwriting it with the current time would corrupt how long
    /// that person was actually in the session.
    pub async fn get_participant(
        &self,
        session_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<CoworkingParticipantRow>> {
        let row = self
            .client
            .get_client()
            .query(
                "SELECT session_id, user_id, joined_at, left_at, updated_at
                 FROM coworking_session_participants FINAL
                 WHERE session_id = ? AND user_id = ?
                 LIMIT 1",
            )
            .bind(session_id)
            .bind(user_id)
            .fetch_optional::<CoworkingParticipantRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(row)
    }

    pub async fn active_participant_count(&self, session_id: Uuid) -> Result<u64> {
        let count = self
            .client
            .get_client()
            .query(
                "SELECT count() FROM coworking_session_participants FINAL
                 WHERE session_id = ? AND left_at IS NULL",
            )
            .bind(session_id)
            .fetch_one::<u64>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(count)
    }

    /// Returns all currently open sessions for a room. Presence v2 uses this during
    /// reconciliation so a Redis lease expiry cannot leave a ClickHouse session open.
    pub async fn active_sessions_for_room(
        &self,
        room_id: Uuid,
    ) -> Result<Vec<CoworkingSessionRow>> {
        self.client
            .get_client()
            .query(
                "SELECT session_id, room_id, team_id, zone_id, source, ended_reason,
                        started_at, ended_at, updated_at, last_observed_at
                 FROM coworking_sessions FINAL
                 WHERE room_id = ? AND ended_at IS NULL",
            )
            .bind(room_id)
            .fetch_all::<CoworkingSessionRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))
    }

    /// Returns collaboration-zone sessions that have not received a live checkpoint
    /// within the recovery window. This is intentionally independent of Redis so an
    /// outage or API restart cannot leave an analytics row open forever.
    pub async fn stale_live_session_ids(&self, before: u32) -> Result<Vec<Uuid>> {
        self.client
            .get_client()
            .query(
                "SELECT session_id
                 FROM coworking_sessions FINAL
                 WHERE source = 'collaboration_zone'
                   AND ended_at IS NULL
                   AND last_observed_at < ?",
            )
            .bind(before)
            .fetch_all::<SessionIdRow>()
            .await
            .map(|rows| rows.into_iter().map(|row| row.session_id).collect())
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))
    }

    /// Idempotently checkpoints one Redis collaboration-zone session. ReplacingMergeTree
    /// makes this safe to call from several API instances for the same snapshot.
    pub async fn checkpoint_live_session(
        &self,
        room_id: Uuid,
        team_id: Option<Uuid>,
        session_id: Uuid,
        zone_id: Uuid,
        started_at: u32,
        participant_ids: &[Uuid],
    ) -> Result<()> {
        let now = now_secs();
        let existing = self.get_session(session_id).await?;
        let mut session = existing.unwrap_or(CoworkingSessionRow {
            session_id,
            room_id,
            team_id,
            zone_id: Some(zone_id),
            source: "collaboration_zone".to_string(),
            ended_reason: String::new(),
            started_at,
            ended_at: None,
            updated_at: now,
            last_observed_at: now,
        });
        if session.ended_at.is_some() {
            return Ok(());
        }
        session.room_id = room_id;
        session.team_id = team_id;
        session.zone_id = Some(zone_id);
        session.source = "collaboration_zone".to_string();
        session.started_at = session.started_at.min(started_at);
        session.updated_at = now;
        session.last_observed_at = now;
        self.insert_session(&session).await?;

        let current_participants: std::collections::HashSet<Uuid> =
            participant_ids.iter().copied().collect();
        let previous_active = self
            .client
            .get_client()
            .query(
                "SELECT session_id, user_id, joined_at, left_at, updated_at
                 FROM coworking_session_participants FINAL
                 WHERE session_id = ? AND left_at IS NULL",
            )
            .bind(session_id)
            .fetch_all::<CoworkingParticipantRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;
        for row in previous_active {
            if !current_participants.contains(&row.user_id) {
                self.upsert_participant(&CoworkingParticipantRow {
                    left_at: Some(now),
                    updated_at: now,
                    ..row
                })
                .await?;
            }
        }
        for user_id in participant_ids {
            let existing = self.get_participant(session_id, *user_id).await?;
            self.upsert_participant(&CoworkingParticipantRow {
                session_id,
                user_id: *user_id,
                joined_at: existing.map(|row| row.joined_at).unwrap_or(started_at),
                left_at: None,
                updated_at: now,
            })
            .await?;
        }
        Ok(())
    }

    /// Closes a live session and all still-active participant windows. The operation is
    /// idempotent and is used both for a normal zone departure and recovery reconciliation.
    pub async fn close_live_session(&self, session_id: Uuid, ended_reason: &str) -> Result<()> {
        let Some(mut session) = self.get_session(session_id).await? else {
            return Ok(());
        };
        if session.ended_at.is_some() {
            return Ok(());
        }
        let now = now_secs();
        session.ended_at = Some(now);
        session.ended_reason = ended_reason.to_string();
        session.updated_at = now;
        session.last_observed_at = now;
        self.insert_session(&session).await?;

        let rows = self
            .client
            .get_client()
            .query(
                "SELECT session_id, user_id, joined_at, left_at, updated_at
                 FROM coworking_session_participants FINAL
                 WHERE session_id = ? AND left_at IS NULL",
            )
            .bind(session_id)
            .fetch_all::<CoworkingParticipantRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;
        for row in rows {
            self.upsert_participant(&CoworkingParticipantRow {
                left_at: Some(now),
                updated_at: now,
                ..row
            })
            .await?;
        }
        Ok(())
    }

    pub async fn personal_windows(
        &self,
        user_id: Uuid,
        from: u32,
        to: u32,
    ) -> Result<Vec<PersonalWindow>> {
        Ok(self.client.get_client().query(
            "SELECT me.joined_at, me.left_at FROM coworking_session_participants AS me FINAL INNER JOIN coworking_sessions AS s FINAL ON s.session_id=me.session_id WHERE me.user_id=? AND me.joined_at<? AND (me.left_at IS NULL OR me.left_at>=?) AND s.started_at<? AND (s.ended_at IS NULL OR s.ended_at>=?)"
        ).bind(user_id).bind(to).bind(from).bind(to).bind(from).fetch_all::<PersonalWindow>().await?)
    }

    pub async fn history_for_user(
        &self,
        user_id: Uuid,
        from: u32,
        to: u32,
        limit: u64,
        before: Option<u32>,
    ) -> Result<Vec<CoworkingHistoryRow>> {
        // Join the authenticated user's participant row separately from the group roster.
        // This preserves the viewer's own joined/left window instead of incorrectly
        // attributing the entire group session duration to somebody who joined later.
        let query = if let Some(before) = before {
            self.client
                .get_client()
                .query(
                    "SELECT s.session_id, s.room_id, s.team_id, s.zone_id, s.source,
                        s.ended_reason, s.started_at, s.ended_at,
                        me.joined_at AS my_joined_at, me.left_at AS my_left_at,
                        groupArray(toString(p.user_id)) AS participant_ids
                 FROM coworking_sessions AS s FINAL
                 INNER JOIN coworking_session_participants AS me FINAL
                     ON me.session_id = s.session_id AND me.user_id = ?
                 INNER JOIN coworking_session_participants AS p FINAL
                     ON p.session_id = s.session_id
                 WHERE me.joined_at < ?
                   AND (me.left_at IS NULL OR me.left_at >= ?)
                   AND s.started_at < ?
                   AND (s.ended_at IS NULL OR s.ended_at >= ?)
                   AND s.started_at < ?
                 GROUP BY s.session_id, s.room_id, s.team_id, s.zone_id, s.source,
                          s.ended_reason, s.started_at, s.ended_at,
                          me.joined_at, me.left_at
                 ORDER BY s.started_at DESC
                 LIMIT ?",
                )
                .bind(user_id)
                .bind(to)
                .bind(from)
                .bind(to)
                .bind(from)
                .bind(before)
                .bind(limit)
        } else {
            self.client
                .get_client()
                .query(
                    "SELECT s.session_id, s.room_id, s.team_id, s.zone_id, s.source,
                        s.ended_reason, s.started_at, s.ended_at,
                        me.joined_at AS my_joined_at, me.left_at AS my_left_at,
                        groupArray(toString(p.user_id)) AS participant_ids
                 FROM coworking_sessions AS s FINAL
                 INNER JOIN coworking_session_participants AS me FINAL
                     ON me.session_id = s.session_id AND me.user_id = ?
                 INNER JOIN coworking_session_participants AS p FINAL
                     ON p.session_id = s.session_id
                 WHERE me.joined_at < ?
                   AND (me.left_at IS NULL OR me.left_at >= ?)
                   AND s.started_at < ?
                   AND (s.ended_at IS NULL OR s.ended_at >= ?)
                 GROUP BY s.session_id, s.room_id, s.team_id, s.zone_id, s.source,
                          s.ended_reason, s.started_at, s.ended_at,
                          me.joined_at, me.left_at
                 ORDER BY s.started_at DESC
                 LIMIT ?",
                )
                .bind(user_id)
                .bind(to)
                .bind(from)
                .bind(to)
                .bind(from)
                .bind(limit)
        };
        query
            .fetch_all::<CoworkingHistoryRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))
    }

    pub async fn summary_for_teams(
        &self,
        team_ids: &[Uuid],
        from: u32,
        to: u32,
    ) -> Result<PresenceAggregateRow> {
        if team_ids.is_empty() {
            return Ok(PresenceAggregateRow::default());
        }

        // Aggregate once per session before computing totals. Joining participants at the
        // outer level multiplied both count() and duration by the group size.
        let session_totals = self
            .client
            .get_client()
            .query(
                "SELECT count() AS session_count,
                        -- `ended_at` is Nullable, so the raw sum is Nullable(Int64); the
                        -- row reads a plain u64.
                        toUInt64(greatest(ifNull(sum(duration_seconds), 0), 0)) AS total_seconds,
                        -- avgOrNull, not avg: the row decodes into Option<f64>, which
                        -- needs a Nullable column (avg is a plain Float64, NaN when empty).
                        avgOrNull(group_size) AS average_group_size,
                        uniqExact(active_date) AS active_days
                 FROM (
                     SELECT s.session_id AS session_id,
                            toUInt64(if(s.ended_at IS NULL, toUInt32(now()), s.ended_at))
                                - s.started_at AS duration_seconds,
                            countDistinct(p.user_id) AS group_size,
                            toDate(toDateTime(s.started_at)) AS active_date
                     FROM coworking_sessions AS s FINAL
                     INNER JOIN coworking_session_participants AS p FINAL
                         ON p.session_id = s.session_id
                     WHERE s.team_id IN ? AND s.started_at < ?
                       AND (s.ended_at IS NULL OR s.ended_at >= ?)
                     GROUP BY s.session_id, s.started_at, s.ended_at
                 )",
            )
            .bind(team_ids.to_vec())
            .bind(to)
            .bind(from)
            .fetch_one::<PresenceSessionAggregateRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        let distinct_participants = self
            .client
            .get_client()
            .query(
                "SELECT uniqExact(p.user_id)
                 FROM coworking_sessions AS s FINAL
                 INNER JOIN coworking_session_participants AS p FINAL
                     ON p.session_id = s.session_id
                 WHERE s.team_id IN ? AND s.started_at < ?
                   AND (s.ended_at IS NULL OR s.ended_at >= ?)",
            )
            .bind(team_ids.to_vec())
            .bind(to)
            .bind(from)
            .fetch_one::<u64>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(PresenceAggregateRow {
            session_count: session_totals.session_count,
            total_seconds: session_totals.total_seconds,
            average_group_size: session_totals.average_group_size,
            active_days: session_totals.active_days,
            distinct_participants,
        })
    }
}

/// Upper bound on sessions read for one heatmap. A 92-day window for an organization
/// stays far below this; the cap only protects the API from a pathological range.
pub const HEATMAP_SESSION_LIMIT: u64 = 20_000;

#[derive(Debug, Clone, Copy, Deserialize, Row, PartialEq, Eq)]
pub struct SessionWindowRow {
    pub started_at: u32,
    pub ended_at: Option<u32>,
}

impl CoworkingSessionRepository {
    /// Distinct people across the *shared* sessions (two or more people) in the teams
    /// that overlap `[from, to)` — the population the heatmap actually describes, so
    /// its privacy floor is not satisfied by someone who only ever sat alone.
    pub async fn shared_session_participants(
        &self,
        team_ids: &[Uuid],
        from: u32,
        to: u32,
    ) -> Result<u64> {
        if team_ids.is_empty() {
            return Ok(0);
        }
        self.client
            .get_client()
            .query(
                "SELECT uniqExact(user_id)
                 FROM coworking_session_participants FINAL
                 WHERE session_id IN (
                     SELECT s.session_id
                     FROM coworking_sessions AS s FINAL
                     INNER JOIN coworking_session_participants AS p FINAL
                         ON p.session_id = s.session_id
                     WHERE s.team_id IN ? AND s.started_at < ?
                       AND (s.ended_at IS NULL OR s.ended_at >= ?)
                     GROUP BY s.session_id
                     HAVING uniqExact(p.user_id) >= 2
                 )",
            )
            .bind(team_ids.to_vec())
            .bind(to)
            .bind(from)
            .fetch_one::<u64>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))
    }

    /// Start/end of every *shared* session (two or more distinct people) in the teams
    /// that overlaps `[from, to)`. Only timestamps leave the database — no identities.
    pub async fn shared_session_windows(
        &self,
        team_ids: &[Uuid],
        from: u32,
        to: u32,
    ) -> Result<Vec<SessionWindowRow>> {
        if team_ids.is_empty() {
            return Ok(Vec::new());
        }
        self.client
            .get_client()
            .query(
                "SELECT s.started_at AS started_at, s.ended_at AS ended_at
                 FROM coworking_sessions AS s FINAL
                 INNER JOIN coworking_session_participants AS p FINAL
                     ON p.session_id = s.session_id
                 WHERE s.team_id IN ? AND s.started_at < ?
                   AND (s.ended_at IS NULL OR s.ended_at >= ?)
                 GROUP BY s.session_id, s.started_at, s.ended_at
                 HAVING uniqExact(p.user_id) >= 2
                 ORDER BY s.started_at
                 LIMIT ?",
            )
            .bind(team_ids.to_vec())
            .bind(to)
            .bind(from)
            .bind(HEATMAP_SESSION_LIMIT)
            .fetch_all::<SessionWindowRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))
    }
}

#[derive(Debug, Default, Deserialize, Row)]
struct PresenceSessionAggregateRow {
    session_count: u64,
    total_seconds: u64,
    average_group_size: Option<f64>,
    active_days: u64,
}

#[derive(Debug, Default, Deserialize, Row)]
pub struct PresenceAggregateRow {
    pub session_count: u64,
    pub total_seconds: u64,
    pub average_group_size: Option<f64>,
    pub active_days: u64,
    pub distinct_participants: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "requires an isolated ClickHouse 24.10 instance via CLICKHOUSE_TEST_URL"]
    async fn configured_database_supports_presence_history_and_summary_queries() {
        let client = crate::test_support::clickhouse_client().await;
        let repo = CoworkingSessionRepository::new(client);
        repo.migrate().await.expect("migrate coworking tables");

        let session_id = Uuid::now_v7();
        let room_id = Uuid::now_v7();
        let team_id = Uuid::now_v7();
        let viewer_id = Uuid::now_v7();
        let peer_a = Uuid::now_v7();
        let peer_b = Uuid::now_v7();
        let started_at = 1_767_200_400_u32;
        let ended_at = started_at + 120;

        repo.insert_session(&CoworkingSessionRow {
            session_id,
            room_id,
            team_id: Some(team_id),
            zone_id: Some(Uuid::now_v7()),
            source: "presence_v2".to_string(),
            ended_reason: "left".to_string(),
            started_at,
            ended_at: Some(ended_at),
            updated_at: ended_at,
            last_observed_at: ended_at,
        })
        .await
        .expect("insert session");

        for (index, user_id) in [viewer_id, peer_a, peer_b].into_iter().enumerate() {
            repo.upsert_participant(&CoworkingParticipantRow {
                session_id,
                user_id,
                joined_at: started_at + index as u32,
                left_at: Some(ended_at - index as u32),
                updated_at: ended_at,
            })
            .await
            .expect("insert participant");
        }

        let history = repo
            .history_for_user(viewer_id, started_at - 10, ended_at + 10, 10, None)
            .await
            .expect("history query should parse and use configured database");
        assert!(history.iter().any(|row| row.session_id == session_id));
        let windows = repo
            .personal_windows(viewer_id, started_at - 10, ended_at + 10)
            .await
            .expect("personal summary query");
        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].joined_at, started_at);
        assert_eq!(windows[0].left_at, Some(ended_at));

        let summary = repo
            .summary_for_teams(&[team_id], started_at - 10, ended_at + 10)
            .await
            .expect("summary query should parse and use configured database");
        assert_eq!(summary.session_count, 1);
        assert_eq!(summary.distinct_participants, 3);
    }
}

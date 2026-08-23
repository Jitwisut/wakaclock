use anyhow::{Context, Result};
use clickhouse::Row;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::coworking_session::{CoworkingParticipantRow, CoworkingSessionRow};

#[derive(Debug, Deserialize, Row)]
struct SessionIdRow {
    #[serde(with = "clickhouse::serde::uuid")]
    session_id: Uuid,
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
                CREATE TABLE IF NOT EXISTS wakaclock.coworking_sessions (
                    session_id UUID,
                    room_id UUID,
                    team_id Nullable(UUID),
                    started_at UInt32,
                    ended_at Nullable(UInt32),
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (room_id, session_id)
                "#,
            )
            .execute()
            .await
            .context("Failed to create coworking_sessions table")?;

        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.coworking_session_participants (
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
            .insert("wakaclock.coworking_sessions")
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
            .insert("wakaclock.coworking_session_participants")
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
                "SELECT session_id, room_id, team_id, started_at, ended_at, updated_at
                 FROM wakaclock.coworking_sessions FINAL
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
                 FROM wakaclock.coworking_sessions FINAL AS s
                 INNER JOIN wakaclock.coworking_session_participants FINAL AS p
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
                 FROM wakaclock.coworking_session_participants FINAL
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
                "SELECT count() FROM wakaclock.coworking_session_participants FINAL
                 WHERE session_id = ? AND left_at IS NULL",
            )
            .bind(session_id)
            .fetch_one::<u64>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(count)
    }
}

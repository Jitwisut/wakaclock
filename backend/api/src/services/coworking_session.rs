use anyhow::{anyhow, Result};
use chrono::{DateTime, Datelike, Timelike};
use chrono_tz::Tz;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::redis_presence::LiveSession;
use crate::model::coworking_session::{CoworkingParticipantRow, CoworkingSessionRow};
use crate::repository::coworking_session::{CoworkingSessionRepository, SessionWindowRow};
use crate::services::org::now_secs;

/// One value per local weekday (Monday = 0) and hour of day.
pub type WeekHourGrid = [[u64; 24]; 7];

/// Co-working seconds per weekday/hour, plus how many distinct sessions touched each
/// slot — the second grid drives the per-slot privacy floor.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoworkingHeatmap {
    pub seconds: WeekHourGrid,
    pub sessions: WeekHourGrid,
}

/// Spreads shared sessions over the local week: each session is clipped to
/// `[from, to)` (an open session runs until `now`) and its seconds are added to every
/// local weekday/hour it overlaps. Hour boundaries are taken from the local clock, so
/// half-hour offset zones and DST days still bucket on the hour people actually see.
pub fn coworking_heatmap(
    sessions: &[SessionWindowRow],
    from: u32,
    to: u32,
    now: u32,
    timezone: Tz,
) -> CoworkingHeatmap {
    let mut grid = [[0u64; 24]; 7];
    let mut counts = [[0u64; 24]; 7];
    for session in sessions {
        let start = session.started_at.max(from);
        let end = session.ended_at.unwrap_or(now).min(to);
        // A session is counted once per slot even when it spans that hour on
        // several days (a multi-day open session is still one session).
        let mut touched = [[false; 24]; 7];
        let mut cursor = start;
        while cursor < end {
            let Some(utc) = DateTime::from_timestamp(i64::from(cursor), 0) else {
                break;
            };
            let local = utc.with_timezone(&timezone);
            let into_hour = local.minute() * 60 + local.second();
            let next = cursor.saturating_add(3600 - into_hour).min(end);
            let weekday = local.weekday().num_days_from_monday() as usize;
            let hour = local.hour() as usize;
            grid[weekday][hour] += u64::from(next - cursor);
            touched[weekday][hour] = true;
            cursor = next;
        }
        for (row, touched_row) in counts.iter_mut().zip(touched) {
            for (count, hit) in row.iter_mut().zip(touched_row) {
                *count += u64::from(hit);
            }
        }
    }
    CoworkingHeatmap {
        seconds: grid,
        sessions: counts,
    }
}

pub struct CoworkingSessionService {
    repo: Arc<CoworkingSessionRepository>,
}

impl CoworkingSessionService {
    pub fn new(repo: Arc<CoworkingSessionRepository>) -> Self {
        Self { repo }
    }

    /// Called when the client detects two people close together on the room canvas.
    /// This is where "group, not pairwise" is actually decided:
    ///
    /// - If `joining_user` already has an active session in this room, `user` is added
    ///   to *that* session — this is the clustering step: if A is already co-working
    ///   with C and B drags next to A, B joins the same A/C session rather than starting
    ///   a separate one.
    /// - Otherwise, if `user` already has an active session in this room, `joining_user`
    ///   is added to that one (same logic, other direction).
    /// - Otherwise, a brand new session starts with both of them.
    ///
    /// Idempotent by construction: re-calling this for two people already in the same
    /// active session just re-upserts their participant rows (harmless), which matters
    /// because multiple browsers viewing the same room may all detect the same
    /// proximity event and call this independently.
    pub async fn start_or_join(
        &self,
        room_id: Uuid,
        team_id: Option<Uuid>,
        user: Uuid,
        joining_user: Uuid,
    ) -> Result<Uuid> {
        if user == joining_user {
            return Err(anyhow!("a session needs two different people"));
        }

        let existing = match self
            .repo
            .active_session_for_user_in_room(room_id, user)
            .await?
        {
            Some(session_id) => Some(session_id),
            None => {
                self.repo
                    .active_session_for_user_in_room(room_id, joining_user)
                    .await?
            }
        };

        let session_id = match existing {
            Some(session_id) => session_id,
            None => {
                let now = now_secs();
                let session_id = Uuid::new_v4();
                self.repo
                    .insert_session(&CoworkingSessionRow {
                        session_id,
                        room_id,
                        team_id,
                        zone_id: None,
                        source: "legacy_proximity".to_string(),
                        ended_reason: String::new(),
                        started_at: now,
                        ended_at: None,
                        updated_at: now,
                        last_observed_at: now,
                    })
                    .await?;
                session_id
            }
        };

        self.add_participant(session_id, user).await?;
        self.add_participant(session_id, joining_user).await?;

        Ok(session_id)
    }

    async fn add_participant(&self, session_id: Uuid, user_id: Uuid) -> Result<()> {
        let now = now_secs();
        self.repo
            .upsert_participant(&CoworkingParticipantRow {
                session_id,
                user_id,
                joined_at: now,
                left_at: None,
                updated_at: now,
            })
            .await
    }

    /// Marks a participant as gone (the frontend calls this only after its 3-minute
    /// grace period elapses without them coming back — see `room-canvas.tsx` — so by
    /// the time this fires, it is a real departure, not a brief drag hiccup). Ends the
    /// whole session once at most one active participant remains, matching plan.md
    /// 7.4's stated rule.
    pub async fn leave(&self, room_id: Uuid, user_id: Uuid) -> Result<()> {
        let Some(session_id) = self
            .repo
            .active_session_for_user_in_room(room_id, user_id)
            .await?
        else {
            return Ok(()); // not in an active session here — nothing to do
        };

        let Some(participant) = self.repo.get_participant(session_id, user_id).await? else {
            return Ok(()); // no participant row to close — nothing to do
        };

        let now = now_secs();
        self.repo
            .upsert_participant(&CoworkingParticipantRow {
                session_id,
                user_id,
                joined_at: participant.joined_at, // preserved — see get_participant's doc comment
                left_at: Some(now),
                updated_at: now,
            })
            .await?;

        let remaining = self.repo.active_participant_count(session_id).await?;
        if remaining <= 1 {
            self.end_session(session_id).await?;
        }

        Ok(())
    }

    /// Checkpoints the Redis collaboration-zone projection into ClickHouse and closes
    /// sessions that disappeared from the projection. ClickHouse is deliberately best
    /// effort here: a telemetry outage must not make a live room unavailable, and the next
    /// checkpoint/reconciler can safely retry the same snapshot.
    pub async fn reconcile_live_snapshot(
        &self,
        room_id: Uuid,
        team_id: Option<Uuid>,
        sessions: &[LiveSession],
    ) -> Result<()> {
        let active_ids: std::collections::HashSet<Uuid> =
            sessions.iter().map(|session| session.session_id).collect();
        for session in sessions {
            self.repo
                .checkpoint_live_session(
                    room_id,
                    team_id,
                    session.session_id,
                    session.zone_id,
                    session.started_at.max(0) as u32,
                    &session.participant_ids,
                )
                .await?;
        }
        for session in self.repo.active_sessions_for_room(room_id).await? {
            if session.source == "collaboration_zone" && !active_ids.contains(&session.session_id) {
                self.repo
                    .close_live_session(session.session_id, "participant_left")
                    .await?;
            }
        }
        Ok(())
    }

    /// Recovery boundary for a Redis outage or an API restart. A live session must
    /// receive a checkpoint at least once every ten minutes; otherwise it is closed with
    /// an explicit reason so personal history and team aggregates never imply that work
    /// continued after the last observable state.
    pub async fn recover_stale_sessions(&self, before: u32) -> Result<u64> {
        let session_ids = self.repo.stale_live_session_ids(before).await?;
        let mut closed = 0;
        for session_id in session_ids {
            self.repo
                .close_live_session(session_id, "recovery_timeout")
                .await?;
            closed += 1;
        }
        Ok(closed)
    }

    async fn end_session(&self, session_id: Uuid) -> Result<()> {
        let Some(mut session) = self.repo.get_session(session_id).await? else {
            return Ok(());
        };
        if session.ended_at.is_some() {
            return Ok(()); // already ended — avoid bumping updated_at pointlessly
        }

        let now = now_secs();
        session.ended_at = Some(now);
        session.ended_reason = "participant_left".to_string();
        session.updated_at = now;
        session.last_observed_at = now;
        self.repo.insert_session(&session).await
    }
}

#[cfg(test)]
mod heatmap_tests {
    use super::*;

    fn window(started_at: u32, ended_at: Option<u32>) -> SessionWindowRow {
        SessionWindowRow {
            started_at,
            ended_at,
        }
    }

    // 2026-09-28 is a Monday; 00:00 UTC.
    const MONDAY: u32 = 1_790_553_600;

    #[test]
    fn splits_a_session_across_local_hours() {
        // Monday 09:30–11:15 UTC.
        let heatmap = coworking_heatmap(
            &[window(
                MONDAY + 9 * 3600 + 1800,
                Some(MONDAY + 11 * 3600 + 900),
            )],
            0,
            u32::MAX,
            u32::MAX,
            chrono_tz::UTC,
        );
        assert_eq!(heatmap.seconds[0][9], 1800);
        assert_eq!(heatmap.seconds[0][10], 3600);
        assert_eq!(heatmap.seconds[0][11], 900);
        assert_eq!(heatmap.seconds.iter().flatten().sum::<u64>(), 6300);
        assert_eq!(heatmap.sessions[0][9], 1);
        assert_eq!(heatmap.sessions[0][12], 0);
    }

    #[test]
    fn counts_each_session_once_per_slot() {
        // Two sessions in Monday 10:00, one of them split across 10:00 and 11:00.
        let heatmap = coworking_heatmap(
            &[
                window(MONDAY + 10 * 3600, Some(MONDAY + 10 * 3600 + 600)),
                window(MONDAY + 10 * 3600 + 1800, Some(MONDAY + 11 * 3600 + 600)),
            ],
            0,
            u32::MAX,
            u32::MAX,
            chrono_tz::UTC,
        );
        assert_eq!(heatmap.sessions[0][10], 2);
        assert_eq!(heatmap.sessions[0][11], 1);
        assert_eq!(heatmap.seconds[0][10], 600 + 1800);
    }

    #[test]
    fn uses_the_local_weekday_and_hour() {
        // Monday 23:00–23:30 UTC is Tuesday 06:00–06:30 in Bangkok (UTC+7).
        let heatmap = coworking_heatmap(
            &[window(MONDAY + 23 * 3600, Some(MONDAY + 23 * 3600 + 1800))],
            0,
            u32::MAX,
            u32::MAX,
            chrono_tz::Asia::Bangkok,
        );
        assert_eq!(heatmap.seconds[1][6], 1800);
        assert_eq!(heatmap.seconds[0][23], 0);
    }

    #[test]
    fn buckets_on_local_hours_in_half_hour_zones() {
        // 09:00 UTC is 14:30 in Kolkata (UTC+5:30): 30 minutes land in 14:00, 30 in 15:00.
        let heatmap = coworking_heatmap(
            &[window(MONDAY + 9 * 3600, Some(MONDAY + 10 * 3600))],
            0,
            u32::MAX,
            u32::MAX,
            chrono_tz::Asia::Kolkata,
        );
        assert_eq!(heatmap.seconds[0][14], 1800);
        assert_eq!(heatmap.seconds[0][15], 1800);
    }

    #[test]
    fn clips_to_the_range_and_runs_open_sessions_until_now() {
        let from = MONDAY + 10 * 3600;
        let to = MONDAY + 12 * 3600;
        let heatmap = coworking_heatmap(
            &[
                window(MONDAY + 9 * 3600, Some(MONDAY + 13 * 3600)),
                window(MONDAY + 11 * 3600, None),
                window(MONDAY, Some(MONDAY + 60)),
            ],
            from,
            to,
            MONDAY + 11 * 3600 + 600,
            chrono_tz::UTC,
        );
        assert_eq!(heatmap.seconds[0][10], 3600);
        assert_eq!(heatmap.seconds[0][11], 3600 + 600);
        assert_eq!(heatmap.seconds[0][9], 0);
        assert_eq!(heatmap.seconds[0][0], 0);
    }
}

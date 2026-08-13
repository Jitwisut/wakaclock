use anyhow::{anyhow, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::model::coworking_session::{CoworkingParticipantRow, CoworkingSessionRow};
use crate::repository::coworking_session::CoworkingSessionRepository;
use crate::services::org::now_secs;

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
                        started_at: now,
                        ended_at: None,
                        updated_at: now,
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

    async fn end_session(&self, session_id: Uuid) -> Result<()> {
        let Some(mut session) = self.repo.get_session(session_id).await? else {
            return Ok(());
        };
        if session.ended_at.is_some() {
            return Ok(()); // already ended — avoid bumping updated_at pointlessly
        }

        let now = now_secs();
        session.ended_at = Some(now);
        session.updated_at = now;
        self.repo.insert_session(&session).await
    }
}

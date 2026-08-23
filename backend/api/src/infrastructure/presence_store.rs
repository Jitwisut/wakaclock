use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;
use tokio::sync::RwLock;
use uuid::Uuid;

/// A heartbeat within this window means the user is actively coding right now.
const CODING_WINDOW: Duration = Duration::from_secs(120);

/// A heartbeat older than `CODING_WINDOW` but within this window means the user was
/// recently active but has paused — mirrors the VS Code extension's default
/// `wakaclock.idleMinutes` (5 minutes), so presence and the editor's own idle detection
/// agree on what "idle" means.
const IDLE_WINDOW: Duration = Duration::from_secs(5 * 60);

/// Live coding presence, prototype implementation (plan.md Phase 7).
///
/// This is deliberately **in-memory**, not the Redis-backed design in plan.md 7.1 — Redis
/// is not wired into this service yet (see the Phase 7 Status Note), and standing it up
/// was judged not worth doing before the underlying idea has been tried by anyone. It
/// does **not** survive a restart and does **not** work across more than one server
/// process — both are real limitations that block using this in production, and both go
/// away by swapping this module's internals for Redis without changing the public API,
/// if the prototype validates the idea.
///
/// A room may optionally carry a `team_id`/`team_name` (plan.md 7.2/6.1) — set once at
/// creation from a real, permission-checked team (see `handlers/v1/presence.rs`), never
/// free text typed by whoever happens to create the room.
///
/// The design rule from plan.md 7.0 — presence must be mutual and symmetric, and must
/// never carry `entity`/`project`/`branch` — is enforced structurally here: a room's
/// roster is exactly its member set (there is no observer role to add), and the only
/// things ever stored per user are a last-heartbeat timestamp and a canvas position,
/// neither of which carries file/project/branch information.
#[derive(Debug, Default)]
pub struct PresenceStore {
    /// Last heartbeat time per user, independent of room membership — a user's coding
    /// state is a property of the user, not of any one room they happen to be in.
    last_heartbeat: RwLock<HashMap<Uuid, Instant>>,
    rooms: RwLock<HashMap<Uuid, Room>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone)]
struct Member {
    /// Resolved once at join time so an SSE tick never has to hit ClickHouse to render a
    /// roster — see the module doc for why that matters.
    username: String,
    /// `None` until the client reports where it dropped this character on the canvas —
    /// see `update_position`. Synced server-side (not left as browser-local state) so
    /// every viewer of a room sees the same arrangement, which is also what makes
    /// co-working session detection (plan.md 7.4) trustworthy: it is based on where
    /// everyone actually sees everyone else, not one person's local drag.
    position: Option<Point>,
}

#[derive(Debug)]
struct Room {
    members: HashMap<Uuid, Member>,
    team_id: Option<Uuid>,
    team_name: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PresenceState {
    Coding,
    Idle,
    Offline,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct RosterEntry {
    pub user_id: Uuid,
    pub username: String,
    pub state: PresenceState,
    pub position: Option<Point>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct RoomSnapshot {
    pub roster: Vec<RosterEntry>,
    pub team_id: Option<Uuid>,
    pub team_name: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum JoinError {
    RoomNotFound,
}

fn derive_state(last_heartbeat: Option<Instant>) -> PresenceState {
    let Some(seen_at) = last_heartbeat else {
        return PresenceState::Offline;
    };

    let elapsed = seen_at.elapsed();

    if elapsed <= CODING_WINDOW {
        PresenceState::Coding
    } else if elapsed <= IDLE_WINDOW {
        PresenceState::Idle
    } else {
        PresenceState::Offline
    }
}

impl PresenceStore {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Called from the heartbeat ingest path. Must never be allowed to fail a heartbeat
    /// write — there is no error return here because there is nothing for a caller to
    /// handle; a `HashMap` insert behind a lock cannot meaningfully fail.
    pub async fn record_heartbeat(&self, user_id: Uuid) {
        self.last_heartbeat
            .write()
            .await
            .insert(user_id, Instant::now());
    }

    /// Creates a room and adds the creator as its first member. Returns the room id,
    /// which doubles as the invite link — see the module doc. `team_id`/`team_name` are
    /// `None` for an ad-hoc room with no team behind it; when present, the caller must
    /// already have verified the creator is actually a member of that team (this
    /// function trusts what it's given, same as every other layer in this codebase).
    pub async fn create_room(
        &self,
        owner_id: Uuid,
        owner_username: String,
        team_id: Option<Uuid>,
        team_name: Option<String>,
    ) -> Uuid {
        let room_id = Uuid::new_v4();
        let mut members = HashMap::with_capacity(1);
        members.insert(
            owner_id,
            Member {
                username: owner_username,
                position: None,
            },
        );

        self.rooms.write().await.insert(
            room_id,
            Room {
                members,
                team_id,
                team_name,
            },
        );

        room_id
    }

    /// Idempotent while still a member: calling this again for someone already in the
    /// room (a retried/duplicate request) does not reset a position they had already
    /// dropped there. This does **not** apply after an actual `leave_room` — that
    /// removes the member row entirely, position included, so someone who leaves and
    /// later rejoins lands back at the default flow position, the same as a first-time
    /// joiner. Making a leave-then-rejoin remember the old spot would need position data
    /// kept independently of room membership; not worth the complexity for what this
    /// prototype needs.
    pub async fn join_room(
        &self,
        room_id: Uuid,
        user_id: Uuid,
        username: String,
    ) -> Result<(), JoinError> {
        let mut rooms = self.rooms.write().await;
        let room = rooms.get_mut(&room_id).ok_or(JoinError::RoomNotFound)?;

        let position = room.members.get(&user_id).and_then(|m| m.position);
        room.members.insert(user_id, Member { username, position });
        Ok(())
    }

    /// Idempotent, and cleans the room up once its last member leaves — an empty room
    /// with no way back in (nobody left holding the invite link) is just a leak.
    pub async fn leave_room(&self, room_id: Uuid, user_id: Uuid) {
        let mut rooms = self.rooms.write().await;

        let Some(room) = rooms.get_mut(&room_id) else {
            return;
        };

        room.members.remove(&user_id);

        if room.members.is_empty() {
            rooms.remove(&room_id);
        }
    }

    pub async fn is_member(&self, room_id: Uuid, user_id: Uuid) -> bool {
        self.rooms
            .read()
            .await
            .get(&room_id)
            .is_some_and(|room| room.members.contains_key(&user_id))
    }

    /// Records where a member dropped their character on the room canvas. Sync happens
    /// only on drag *end*, not on every pointer-move frame — see `handlers/v1/presence.rs`
    /// — so this is called at most a few times a minute per person, not continuously.
    /// Returns `false` if the room or the member doesn't exist, so the handler can
    /// distinguish that from "position accepted".
    pub async fn update_position(&self, room_id: Uuid, user_id: Uuid, position: Point) -> bool {
        let mut rooms = self.rooms.write().await;
        let Some(room) = rooms.get_mut(&room_id) else {
            return false;
        };
        let Some(member) = room.members.get_mut(&user_id) else {
            return false;
        };

        member.position = Some(position);
        true
    }

    /// `None` means the room does not exist (or was just cleaned up). An SSE stream
    /// reading this on every tick ends the moment it sees `None`, which is what makes
    /// room cleanup on last-leave visible to still-connected clients.
    ///
    /// The returned roster always includes the caller if they are a member — there is no
    /// code path that produces a roster a member is excluded from, satisfying the
    /// mutual/symmetric rule (plan.md 7.0) by construction rather than by a check someone
    /// could accidentally skip.
    pub async fn snapshot(&self, room_id: Uuid) -> Option<RoomSnapshot> {
        let rooms = self.rooms.read().await;
        let room = rooms.get(&room_id)?;
        let last_heartbeat = self.last_heartbeat.read().await;

        let mut roster: Vec<RosterEntry> = room
            .members
            .iter()
            .map(|(user_id, member)| RosterEntry {
                user_id: *user_id,
                username: member.username.clone(),
                state: derive_state(last_heartbeat.get(user_id).copied()),
                position: member.position,
            })
            .collect();

        // Stable ordering so the roster does not visibly reshuffle between ticks —
        // HashMap iteration order is not stable across calls.
        roster.sort_by(|a, b| a.username.cmp(&b.username));

        Some(RoomSnapshot {
            roster,
            team_id: room.team_id,
            team_name: room.team_name.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn uid() -> Uuid {
        Uuid::new_v4()
    }

    #[test]
    fn derive_state_offline_with_no_heartbeat() {
        assert_eq!(derive_state(None), PresenceState::Offline);
    }

    #[test]
    fn derive_state_coding_when_recent() {
        assert_eq!(derive_state(Some(Instant::now())), PresenceState::Coding);
    }

    #[tokio::test]
    async fn create_room_includes_owner_in_snapshot() {
        let store = PresenceStore::default();
        let owner = uid();
        let room_id = store
            .create_room(owner, "alice".to_string(), None, None)
            .await;

        let snapshot = store.snapshot(room_id).await.expect("room should exist");
        assert_eq!(snapshot.roster.len(), 1);
        assert_eq!(snapshot.roster[0].user_id, owner);
        assert_eq!(snapshot.roster[0].state, PresenceState::Offline);
        assert_eq!(snapshot.roster[0].position, None);
        assert_eq!(snapshot.team_name, None);
    }

    #[tokio::test]
    async fn create_room_carries_team_label() {
        let store = PresenceStore::default();
        let owner = uid();
        let team_id = uid();
        let room_id = store
            .create_room(
                owner,
                "alice".to_string(),
                Some(team_id),
                Some("Backend Squad".to_string()),
            )
            .await;

        let snapshot = store.snapshot(room_id).await.unwrap();
        assert_eq!(snapshot.team_id, Some(team_id));
        assert_eq!(snapshot.team_name.as_deref(), Some("Backend Squad"));
    }

    #[tokio::test]
    async fn record_heartbeat_makes_a_member_show_as_coding() {
        let store = PresenceStore::default();
        let owner = uid();
        let room_id = store
            .create_room(owner, "alice".to_string(), None, None)
            .await;

        store.record_heartbeat(owner).await;

        let snapshot = store.snapshot(room_id).await.unwrap();
        assert_eq!(snapshot.roster[0].state, PresenceState::Coding);
    }

    #[tokio::test]
    async fn join_unknown_room_fails() {
        let store = PresenceStore::default();
        let result = store
            .join_room(Uuid::new_v4(), uid(), "bob".to_string())
            .await;
        assert_eq!(result, Err(JoinError::RoomNotFound));
    }

    #[tokio::test]
    async fn join_is_idempotent_and_room_stays_visible_to_both_members() {
        let store = PresenceStore::default();
        let owner = uid();
        let joiner = uid();
        let room_id = store
            .create_room(owner, "alice".to_string(), None, None)
            .await;

        store
            .join_room(room_id, joiner, "bob".to_string())
            .await
            .unwrap();
        store
            .join_room(room_id, joiner, "bob".to_string())
            .await
            .unwrap(); // idempotent

        let snapshot = store.snapshot(room_id).await.unwrap();
        assert_eq!(snapshot.roster.len(), 2);
    }

    #[tokio::test]
    async fn leaving_the_last_member_deletes_the_room() {
        let store = PresenceStore::default();
        let owner = uid();
        let room_id = store
            .create_room(owner, "alice".to_string(), None, None)
            .await;

        store.leave_room(room_id, owner).await;

        assert_eq!(store.snapshot(room_id).await, None);
        assert!(!store.is_member(room_id, owner).await);
    }

    #[tokio::test]
    async fn leaving_one_of_several_members_keeps_the_room_alive() {
        let store = PresenceStore::default();
        let owner = uid();
        let joiner = uid();
        let room_id = store
            .create_room(owner, "alice".to_string(), None, None)
            .await;
        store
            .join_room(room_id, joiner, "bob".to_string())
            .await
            .unwrap();

        store.leave_room(room_id, joiner).await;

        let snapshot = store.snapshot(room_id).await.unwrap();
        assert_eq!(snapshot.roster.len(), 1);
        assert_eq!(snapshot.roster[0].user_id, owner);
    }

    #[tokio::test]
    async fn roster_is_ordered_deterministically() {
        let store = PresenceStore::default();
        let owner = uid();
        let room_id = store
            .create_room(owner, "zeta".to_string(), None, None)
            .await;
        store
            .join_room(room_id, uid(), "alpha".to_string())
            .await
            .unwrap();

        let snapshot = store.snapshot(room_id).await.unwrap();
        assert_eq!(snapshot.roster[0].username, "alpha");
        assert_eq!(snapshot.roster[1].username, "zeta");
    }

    #[tokio::test]
    async fn update_position_is_reflected_in_snapshot() {
        let store = PresenceStore::default();
        let owner = uid();
        let room_id = store
            .create_room(owner, "alice".to_string(), None, None)
            .await;

        let accepted = store
            .update_position(room_id, owner, Point { x: 12.0, y: 34.0 })
            .await;
        assert!(accepted);

        let snapshot = store.snapshot(room_id).await.unwrap();
        assert_eq!(
            snapshot.roster[0].position,
            Some(Point { x: 12.0, y: 34.0 })
        );
    }

    #[tokio::test]
    async fn update_position_for_non_member_is_rejected() {
        let store = PresenceStore::default();
        let owner = uid();
        let room_id = store
            .create_room(owner, "alice".to_string(), None, None)
            .await;

        let accepted = store
            .update_position(room_id, uid(), Point { x: 1.0, y: 1.0 })
            .await;
        assert!(!accepted);
    }

    #[tokio::test]
    async fn redundant_join_call_preserves_existing_position() {
        let store = PresenceStore::default();
        let owner = uid();
        let room_id = store
            .create_room(owner, "alice".to_string(), None, None)
            .await;
        store
            .update_position(room_id, owner, Point { x: 5.0, y: 6.0 })
            .await;

        // A duplicate/retried join request for someone who never actually left — the
        // realistic case this guards against (e.g. a flaky network causing the client
        // to resend its join call) — must not reset their dropped position.
        store
            .join_room(room_id, owner, "alice".to_string())
            .await
            .unwrap();

        let snapshot = store.snapshot(room_id).await.unwrap();
        assert_eq!(snapshot.roster[0].position, Some(Point { x: 5.0, y: 6.0 }));
    }

    #[tokio::test]
    async fn leaving_and_rejoining_resets_position() {
        let store = PresenceStore::default();
        let owner = uid();
        let other = uid(); // keeps the room alive while `owner` is briefly not a member
        let room_id = store
            .create_room(owner, "alice".to_string(), None, None)
            .await;
        store
            .join_room(room_id, other, "bob".to_string())
            .await
            .unwrap();
        store
            .update_position(room_id, owner, Point { x: 5.0, y: 6.0 })
            .await;

        // An actual `leave_room` removes the member row entirely — position included —
        // so a genuine leave-then-rejoin is indistinguishable from a first-time join.
        // See `join_room`'s doc comment for why that's an accepted limitation here.
        store.leave_room(room_id, owner).await;
        store
            .join_room(room_id, owner, "alice".to_string())
            .await
            .unwrap();

        let snapshot = store.snapshot(room_id).await.unwrap();
        let alice = snapshot
            .roster
            .iter()
            .find(|entry| entry.user_id == owner)
            .expect("alice should still be in the roster");
        assert_eq!(alice.position, None);
    }
}

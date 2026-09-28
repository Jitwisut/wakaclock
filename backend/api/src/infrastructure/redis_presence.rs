//! Small Redis RESP client used by Presence.
//!
//! The server already depends on Tokio and the Redis deployment is intentionally tiny for
//! this feature. Keeping the protocol adapter here avoids adding a second async runtime or
//! pulling a large client dependency into every workspace crate. Commands are serialized on
//! one shared connection and the store itself is cloned through `Arc`.

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufStream};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_rustls::rustls::{pki_types::ServerName, ClientConfig, RootCertStore};
use tokio_rustls::{client::TlsStream, TlsConnector};
use uuid::Uuid;

use crate::config::RedisConfig;

pub const CODING_WINDOW_SECONDS: i64 = 120;
pub const IDLE_WINDOW_SECONDS: i64 = 300;
pub const VIEWER_LEASE_SECONDS: i64 = 45;
pub const MAX_ROOM_VIEWERS: i64 = 30;
/// How long "Leave room" suppresses the presence-heartbeat auto-rejoin for a team room.
/// A user who explicitly left while still coding should stay gone for the rest of a
/// normal working session, not reappear on the next throttled heartbeat tick a few
/// seconds later.
pub const AUTO_JOIN_SNOOZE_SECONDS: i64 = 3600;
/// Bounds for a user-set status message ("Fixing the auth bug"). The status is shown only
/// in the roster of rooms the user is in and always expires, so a stale "In a meeting"
/// cannot follow someone around for weeks.
pub const STATUS_TEXT_MAX_CHARS: usize = 80;
pub const STATUS_EMOJI_MAX_CHARS: usize = 8;
pub const STATUS_MIN_TTL_SECONDS: i64 = 5 * 60;
pub const STATUS_MAX_TTL_SECONDS: i64 = 7 * 24 * 3600;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LivePresenceState {
    Coding,
    Idle,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LivePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LiveMember {
    username: String,
    position: Option<LivePosition>,
    zone_id: Option<Uuid>,
    #[serde(default)]
    previous_zone_id: Option<Uuid>,
    #[serde(default)]
    leaving_until: Option<i64>,
    lease_until: i64,
    #[serde(default)]
    client_id: Option<Uuid>,
    client_seq: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveRosterEntry {
    pub user_id: Uuid,
    pub username: String,
    pub state: LivePresenceState,
    pub position: Option<LivePosition>,
    pub zone_id: Option<Uuid>,
    /// What the user chose to share, if anything. Never derived from their activity.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<PresenceStatus>,
}

/// A status message the user typed themselves. Unlike `state`, nothing here is inferred
/// from editor activity; it is opt-in text with a hard expiry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PresenceStatus {
    pub text: String,
    pub emoji: Option<String>,
    /// Unix seconds. Also enforced by the Redis key TTL; checked on read as well so a
    /// clock-skewed or not-yet-evicted key is never shown past its expiry.
    pub expires_at: i64,
}

/// Why a status message was rejected. Messages are safe to show to the user.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatusError {
    Empty,
    TooLong,
    InvalidEmoji,
    InvalidExpiry,
}

impl StatusError {
    pub fn message(self) -> &'static str {
        match self {
            Self::Empty => "status text cannot be empty",
            Self::TooLong => "status text must be 80 characters or fewer",
            Self::InvalidEmoji => "status emoji must be a short symbol, not text",
            Self::InvalidExpiry => "status must expire between 5 minutes and 7 days from now",
        }
    }
}

/// Normalises user input into a storable status: trims and collapses whitespace, drops
/// control characters, bounds the length, and requires the optional emoji to be a short
/// non-alphanumeric symbol so it cannot be used as a second text field.
pub fn normalize_status(
    text: &str,
    emoji: Option<&str>,
    expires_in_seconds: i64,
    now: i64,
) -> Result<PresenceStatus, StatusError> {
    // Control characters become spaces (so "a\tb" stays two words), then runs of
    // whitespace collapse to one. Bidirectional overrides are format characters rather
    // than control characters, so they are named explicitly: other people read this
    // text, and a right-to-left override would let it render as something else.
    let text = text
        .chars()
        .map(|character| {
            if character.is_control() || is_bidi_control(character) {
                ' '
            } else {
                character
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if text.is_empty() {
        return Err(StatusError::Empty);
    }
    if text.chars().count() > STATUS_TEXT_MAX_CHARS {
        return Err(StatusError::TooLong);
    }
    let emoji = match emoji.map(str::trim).filter(|value| !value.is_empty()) {
        None => None,
        Some(value) => {
            let valid = value.chars().count() <= STATUS_EMOJI_MAX_CHARS
                && !value
                    .chars()
                    .any(|character| character.is_alphanumeric() || character.is_control());
            if !valid {
                return Err(StatusError::InvalidEmoji);
            }
            Some(value.to_string())
        }
    };
    if !(STATUS_MIN_TTL_SECONDS..=STATUS_MAX_TTL_SECONDS).contains(&expires_in_seconds) {
        return Err(StatusError::InvalidExpiry);
    }
    Ok(PresenceStatus {
        text,
        emoji,
        expires_at: now + expires_in_seconds,
    })
}

fn is_bidi_control(character: char) -> bool {
    matches!(character, '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}')
}

/// Splits the snapshot's combined MGET reply: `members` heartbeat timestamps followed by
/// the same members' status keys. A short reply leaves the missing statuses as `None`.
fn split_heartbeats_and_statuses(
    mut values: Vec<RedisValue>,
    members: usize,
) -> (Vec<RedisValue>, Vec<Option<RedisValue>>) {
    let statuses = values.split_off(members.min(values.len()));
    let mut statuses = statuses.into_iter().map(Some).collect::<Vec<_>>();
    statuses.resize_with(members, || None);
    (values, statuses)
}

/// A stored status value, or `None` when it is missing, unreadable or already expired.
fn live_status(raw: Option<String>, now: i64) -> Option<PresenceStatus> {
    serde_json::from_str::<PresenceStatus>(&raw?)
        .ok()
        .filter(|status| status.expires_at > now)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSession {
    pub session_id: Uuid,
    pub zone_id: Uuid,
    pub started_at: i64,
    pub participant_ids: Vec<Uuid>,
    #[serde(default)]
    pub leaving_deadlines: HashMap<Uuid, i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSnapshot {
    pub version: u64,
    pub server_time: i64,
    pub roster: Vec<LiveRosterEntry>,
    pub sessions: Vec<LiveSession>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateMemberResult {
    Accepted,
    ClientSuperseded,
    InvalidPosition,
    NotMember,
}

#[derive(Debug, Clone)]
enum RedisValue {
    Simple(String),
    Integer(i64),
    Bulk(Option<Vec<u8>>),
    Array(Vec<RedisValue>),
}

enum RedisStream {
    Plain(TcpStream),
    Tls(Box<TlsStream<TcpStream>>),
}

impl tokio::io::AsyncRead for RedisStream {
    fn poll_read(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match self.get_mut() {
            Self::Plain(stream) => std::pin::Pin::new(stream).poll_read(cx, buf),
            Self::Tls(stream) => std::pin::Pin::new(stream).poll_read(cx, buf),
        }
    }
}

impl tokio::io::AsyncWrite for RedisStream {
    fn poll_write(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        match self.get_mut() {
            Self::Plain(stream) => std::pin::Pin::new(stream).poll_write(cx, buf),
            Self::Tls(stream) => std::pin::Pin::new(stream).poll_write(cx, buf),
        }
    }

    fn poll_flush(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match self.get_mut() {
            Self::Plain(stream) => std::pin::Pin::new(stream).poll_flush(cx),
            Self::Tls(stream) => std::pin::Pin::new(stream).poll_flush(cx),
        }
    }

    fn poll_shutdown(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match self.get_mut() {
            Self::Plain(stream) => std::pin::Pin::new(stream).poll_shutdown(cx),
            Self::Tls(stream) => std::pin::Pin::new(stream).poll_shutdown(cx),
        }
    }
}

#[derive(Debug, Clone)]
struct RedisConnectionConfig {
    tls: bool,
    host: String,
    port: u16,
    password: Option<String>,
}

#[derive(Clone)]
pub struct RedisPresenceStore {
    connection: Arc<Mutex<Option<BufStream<RedisStream>>>>,
    connection_config: Arc<RedisConnectionConfig>,
}

impl RedisPresenceStore {
    pub async fn connect(config: &RedisConfig) -> Result<Option<Arc<Self>>> {
        let Some(url) = config.url.as_deref() else {
            tracing::warn!("REDIS_URL is not configured; Presence v2 is unavailable");
            return Ok(None);
        };
        let (tls, host, port, password) = parse_redis_url(url)?;
        let connection_config = Arc::new(RedisConnectionConfig {
            tls,
            host,
            port,
            password,
        });
        let connection = open_redis_connection(&connection_config).await?;
        Ok(Some(Arc::new(Self {
            connection: Arc::new(Mutex::new(Some(connection))),
            connection_config,
        })))
    }

    pub async fn health_check(&self) -> Result<()> {
        self.command("PING", &[]).await.map(|_| ())
    }

    /// Marks `user_id` as actively coding for `derive_state_at`'s coding/idle split.
    /// Deliberately keyed by user, not by room: a user's coding activity is the same
    /// fact regardless of which of their team rooms is asking, and one client process
    /// (desktop, CLI, editor) can refresh it on behalf of every room they belong to.
    /// Room *membership* (the lease in `member_key`) is separate — see `join`/`renew`.
    pub async fn heartbeat(&self, user_id: Uuid) -> Result<()> {
        self.command(
            "SET",
            &[
                user_key(user_id),
                now_seconds().to_string(),
                "EX".to_string(),
                "360".to_string(),
            ],
        )
        .await?;
        Ok(())
    }

    /// Stores the user's status until its expiry and nudges every room they are in, so the
    /// next snapshot each viewer applies carries it.
    pub async fn set_status(&self, user_id: Uuid, status: &PresenceStatus) -> Result<()> {
        let ttl = (status.expires_at - now_seconds()).max(1);
        self.command(
            "SET",
            &[
                status_key(user_id),
                serde_json::to_string(status)?,
                "EX".to_string(),
                ttl.to_string(),
            ],
        )
        .await?;
        self.bump_user_rooms(user_id).await
    }

    pub async fn clear_status(&self, user_id: Uuid) -> Result<()> {
        self.command("DEL", &[status_key(user_id)]).await?;
        self.bump_user_rooms(user_id).await
    }

    pub async fn status(&self, user_id: Uuid) -> Result<Option<PresenceStatus>> {
        let raw = bulk_string(self.command("GET", &[status_key(user_id)]).await?);
        Ok(live_status(raw, now_seconds()))
    }

    async fn bump_user_rooms(&self, user_id: Uuid) -> Result<()> {
        let rooms = array_values(self.command("SMEMBERS", &[user_rooms_key(user_id)]).await?)?;
        for room in rooms.into_iter().filter_map(bulk_string) {
            if let Ok(room_id) = Uuid::parse_str(&room) {
                self.bump_version(room_id).await?;
            }
        }
        Ok(())
    }

    pub async fn allow_movement(&self, user_id: Uuid) -> Result<bool> {
        let count = integer_or_zero(self.command("INCR", &[movement_rate_key(user_id)]).await?);
        if count == 1 {
            self.command("EXPIRE", &[movement_rate_key(user_id), "1".to_string()])
                .await?;
        }
        Ok(count <= 10)
    }

    pub async fn join(
        &self,
        room_id: Uuid,
        user_id: Uuid,
        username: String,
        client_id: Option<Uuid>,
    ) -> Result<LiveSnapshot> {
        // Prune stale viewer leases before enforcing the 30-viewer room cap.
        let _ = self.snapshot(room_id).await?;
        let existing = self
            .command("HGET", &[member_key(room_id), user_id.to_string()])
            .await?;
        if matches!(existing, RedisValue::Bulk(None)) {
            let viewers = integer_or_zero(self.command("HLEN", &[member_key(room_id)]).await?);
            if viewers >= MAX_ROOM_VIEWERS as u64 {
                return Err(anyhow!("room is full"));
            }
        }
        let member = match bulk_string(existing) {
            Some(raw) => serde_json::from_str::<LiveMember>(&raw).unwrap_or(LiveMember {
                username: username.clone(),
                position: None,
                zone_id: None,
                previous_zone_id: None,
                leaving_until: None,
                lease_until: 0,
                client_id: None,
                client_seq: 0,
            }),
            None => LiveMember {
                username: username.clone(),
                position: None,
                zone_id: None,
                previous_zone_id: None,
                leaving_until: None,
                lease_until: 0,
                client_id: None,
                client_seq: 0,
            },
        };
        let member = LiveMember {
            username,
            lease_until: now_seconds() + VIEWER_LEASE_SECONDS,
            // Rejoining (including EventSource reconnects) must not steal movement control
            // from another tab. The first actual movement with sequence 1 can explicitly
            // claim control in UPDATE_SCRIPT; until then preserve the existing controller.
            client_id: member.client_id.or(client_id),
            client_seq: member.client_seq,
            ..member
        };
        let result = self
            .eval(
                JOIN_SCRIPT,
                &[
                    member_key(room_id),
                    user_rooms_key(user_id),
                    version_key(room_id),
                    events_key(room_id),
                    deadlines_key(room_id),
                    active_rooms_key(),
                    closed_key(room_id),
                ],
                &[
                    user_id.to_string(),
                    serde_json::to_string(&member)?,
                    room_id.to_string(),
                ],
            )
            .await?;
        if result == -2 {
            return Err(anyhow!("room is closed"));
        }
        if result < 0 {
            return Err(anyhow!("room is full"));
        }
        self.snapshot(room_id).await
    }

    pub async fn renew(&self, room_id: Uuid, user_id: Uuid) -> Result<bool> {
        let result = self
            .eval(
                RENEW_SCRIPT,
                &[member_key(room_id)],
                &[
                    user_id.to_string(),
                    (now_seconds() + VIEWER_LEASE_SECONDS).to_string(),
                ],
            )
            .await?;
        Ok(result > 0)
    }

    /// Suppresses presence-heartbeat's auto-rejoin for this room/user for
    /// `AUTO_JOIN_SNOOZE_SECONDS`. Called when a user explicitly leaves a team room so
    /// the next throttled heartbeat tick (as soon as ~30s later, since they are
    /// presumably still coding) does not silently pull them back in.
    pub async fn snooze_auto_join(&self, room_id: Uuid, user_id: Uuid) -> Result<()> {
        self.command(
            "SET",
            &[
                auto_join_snooze_key(room_id, user_id),
                "1".to_string(),
                "EX".to_string(),
                AUTO_JOIN_SNOOZE_SECONDS.to_string(),
            ],
        )
        .await?;
        Ok(())
    }

    pub async fn is_auto_join_snoozed(&self, room_id: Uuid, user_id: Uuid) -> Result<bool> {
        let exists = integer_or_zero(
            self.command("EXISTS", &[auto_join_snooze_key(room_id, user_id)])
                .await?,
        );
        Ok(exists > 0)
    }

    pub async fn leave(&self, room_id: Uuid, user_id: Uuid) -> Result<()> {
        self.eval(
            LEAVE_SCRIPT,
            &[
                member_key(room_id),
                user_rooms_key(user_id),
                version_key(room_id),
                events_key(room_id),
                deadlines_key(room_id),
                active_rooms_key(),
            ],
            &[user_id.to_string(), room_id.to_string()],
        )
        .await?;
        self.rebuild_zone_sessions(room_id).await?;
        Ok(())
    }

    /// Remove every lease and session for an expired/ended room. The PostgreSQL row is
    /// authoritative for room lifecycle; clearing Redis here prevents an already-open SSE
    /// connection from keeping stale avatars visible after an owner ends an ad-hoc room.
    pub async fn clear_room(&self, room_id: Uuid) -> Result<()> {
        // Set the tombstone before deleting projections. A join that raced the PostgreSQL
        // end/expiry check will either see this key in the Lua script or be removed by the
        // cleanup below; it can never recreate a closed room after this point.
        self.command(
            "SET",
            &[
                closed_key(room_id),
                "1".to_string(),
                "EX".to_string(),
                "604800".to_string(),
            ],
        )
        .await?;
        let pairs = array_values(self.command("HGETALL", &[member_key(room_id)]).await?)?;
        for pair in pairs.chunks_exact(2) {
            if let Some(user) = bulk_string(pair[0].clone()) {
                if let Ok(user_id) = Uuid::parse_str(&user) {
                    self.command("SREM", &[user_rooms_key(user_id), room_id.to_string()])
                        .await?;
                }
            }
        }
        let zones = array_values(
            self.command("SMEMBERS", &[session_zones_key(room_id)])
                .await?,
        )?;
        for zone in zones {
            if let Some(zone) = bulk_string(zone) {
                self.command("DEL", &[session_key(room_id, &zone)]).await?;
            }
        }
        self.command(
            "DEL",
            &[
                member_key(room_id),
                session_zones_key(room_id),
                version_key(room_id),
                events_key(room_id),
                deadlines_key(room_id),
            ],
        )
        .await?;
        self.command("SREM", &[active_rooms_key(), room_id.to_string()])
            .await?;
        Ok(())
    }

    pub async fn active_rooms(&self) -> Result<Vec<Uuid>> {
        let values = array_values(self.command("SMEMBERS", &[active_rooms_key()]).await?)?;
        Ok(values
            .into_iter()
            .filter_map(bulk_string)
            .filter_map(|value| Uuid::parse_str(&value).ok())
            .collect())
    }

    pub async fn update_member(
        &self,
        room_id: Uuid,
        user_id: Uuid,
        position: LivePosition,
        zone_id: Option<Uuid>,
        client_id: Option<Uuid>,
        client_seq: u64,
    ) -> Result<UpdateMemberResult> {
        if !position.x.is_finite()
            || !position.y.is_finite()
            || !(0.0..=100.0).contains(&position.x)
            || !(0.0..=100.0).contains(&position.y)
        {
            return Ok(UpdateMemberResult::InvalidPosition);
        }
        let existing = self
            .command("HGET", &[member_key(room_id), user_id.to_string()])
            .await?;
        let Some(raw) = bulk_string(existing) else {
            return Ok(UpdateMemberResult::NotMember);
        };
        let Ok(mut member) = serde_json::from_str::<LiveMember>(&raw) else {
            return Ok(UpdateMemberResult::NotMember);
        };
        if member.client_id.is_some() && member.client_id != client_id && client_seq != 1 {
            return Ok(UpdateMemberResult::ClientSuperseded);
        }
        if member.client_id == client_id && client_seq < member.client_seq {
            return Ok(UpdateMemberResult::Accepted);
        }
        let previous_zone = member.zone_id;
        member.position = Some(position);
        if previous_zone != zone_id && zone_id.is_none() && previous_zone.is_some() {
            member.previous_zone_id = previous_zone;
            member.leaving_until = Some(now_seconds() + 180);
        } else if zone_id.is_some() {
            member.previous_zone_id = None;
            member.leaving_until = None;
        }
        member.zone_id = zone_id;
        member.client_id = client_id;
        member.client_seq = client_seq;
        member.lease_until = now_seconds() + VIEWER_LEASE_SECONDS;
        let result = self
            .eval(
                UPDATE_SCRIPT,
                &[
                    member_key(room_id),
                    version_key(room_id),
                    events_key(room_id),
                    deadlines_key(room_id),
                ],
                &[
                    user_id.to_string(),
                    serde_json::to_string(&member)?,
                    client_seq.to_string(),
                    client_id.map(|id| id.to_string()).unwrap_or_default(),
                ],
            )
            .await?;
        if result == -2 {
            return Ok(UpdateMemberResult::ClientSuperseded);
        }
        if result < 0 {
            return Ok(UpdateMemberResult::NotMember);
        }
        if result == 0 {
            return Ok(UpdateMemberResult::Accepted);
        }
        self.rebuild_zone_sessions(room_id).await?;
        Ok(UpdateMemberResult::Accepted)
    }

    pub async fn snapshot(&self, room_id: Uuid) -> Result<LiveSnapshot> {
        let pairs = array_values(self.command("HGETALL", &[member_key(room_id)]).await?)?;
        let now = now_seconds();
        let mut members = Vec::new();
        let mut expired_members = Vec::new();
        let mut expired_grace = false;
        for pair in pairs.chunks_exact(2) {
            let Some(user) = bulk_string(pair[0].clone()) else {
                continue;
            };
            let Some(raw_member) = bulk_string(pair[1].clone()) else {
                continue;
            };
            let Ok(user_id) = Uuid::parse_str(&user) else {
                continue;
            };
            let Ok(mut member) = serde_json::from_str::<LiveMember>(&raw_member) else {
                continue;
            };
            if member.lease_until <= now {
                let removed = self
                    .eval(
                        PRUNE_MEMBER_SCRIPT,
                        &[member_key(room_id), user_rooms_key(user_id)],
                        &[user.clone(), room_id.to_string(), now.to_string()],
                    )
                    .await?;
                if removed > 0 {
                    expired_members.push(user);
                    continue;
                }
                let Some(refreshed) = bulk_string(
                    self.command("HGET", &[member_key(room_id), user.clone()])
                        .await?,
                ) else {
                    continue;
                };
                let Ok(refreshed) = serde_json::from_str::<LiveMember>(&refreshed) else {
                    continue;
                };
                member = refreshed;
                if member.lease_until <= now {
                    continue;
                }
            }
            if member.zone_id.is_none()
                && member.leaving_until.is_some_and(|deadline| deadline <= now)
            {
                expired_grace = true;
            }
            members.push((user_id, member));
        }

        // Fetch heartbeat timestamps for the whole roster in one Redis round trip rather
        // than one GET per viewer. This keeps a 30-person room bounded even when every
        // browser holds an SSE stream.
        // Status messages ride in the same MGET: the first half of the reply is heartbeat
        // timestamps, the second half the matching status keys.
        let (states, statuses) = if members.is_empty() {
            (Vec::new(), Vec::new())
        } else {
            let keys = members
                .iter()
                .map(|(user_id, _)| user_key(*user_id))
                .chain(members.iter().map(|(user_id, _)| status_key(*user_id)))
                .collect::<Vec<_>>();
            let values = array_values(self.command("MGET", &keys).await?)?;
            split_heartbeats_and_statuses(values, members.len())
        };
        let mut roster = members
            .into_iter()
            .zip(states)
            .zip(statuses)
            .map(|(((user_id, member), heartbeat), status)| LiveRosterEntry {
                user_id,
                username: member.username,
                state: derive_state_at(integer_optional(heartbeat), now),
                position: member.position,
                zone_id: member.zone_id,
                status: live_status(status.and_then(bulk_string), now),
            })
            .collect::<Vec<_>>();
        roster.sort_by(|a, b| a.username.cmp(&b.username));

        if !expired_members.is_empty() || expired_grace {
            self.rebuild_zone_sessions(room_id).await?;
            self.command(
                "ZREMRANGEBYSCORE",
                &[deadlines_key(room_id), "-inf".to_string(), now.to_string()],
            )
            .await?;
            self.bump_version(room_id).await?;
        }
        if roster.is_empty() {
            self.command("SREM", &[active_rooms_key(), room_id.to_string()])
                .await?;
        }
        let sessions = self.sessions(room_id).await?;
        let version = integer_or_zero(self.command("GET", &[version_key(room_id)]).await?);
        Ok(LiveSnapshot {
            version,
            server_time: now,
            roster,
            sessions,
        })
    }

    pub async fn issue_ticket(&self, room_id: Uuid, user_id: Uuid) -> Result<String> {
        let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
        self.command(
            "SET",
            &[
                ticket_key(&token),
                format!("{room_id}:{user_id}"),
                "EX".to_string(),
                "300".to_string(),
            ],
        )
        .await?;
        self.command("SADD", &[user_tickets_key(user_id), token.clone()])
            .await?;
        self.command("EXPIRE", &[user_tickets_key(user_id), "300".to_string()])
            .await?;
        Ok(token)
    }

    pub async fn resolve_ticket(&self, room_id: Uuid, token: &str) -> Result<Option<Uuid>> {
        let Some(value) = bulk_string(self.command("GET", &[ticket_key(token)]).await?) else {
            return Ok(None);
        };
        let mut parts = value.split(':');
        let Some(ticket_room) = parts.next().and_then(|value| Uuid::parse_str(value).ok()) else {
            return Ok(None);
        };
        let Some(user_id) = parts.next().and_then(|value| Uuid::parse_str(value).ok()) else {
            return Ok(None);
        };
        Ok((ticket_room == room_id).then_some(user_id))
    }

    /// Remove all presence state owned by a user. The room membership set is the
    /// authoritative index for per-room keys, while the ticket set covers the
    /// short-lived EventSource handoff tokens issued to that user.
    pub async fn purge_user(&self, user_id: Uuid) -> Result<()> {
        let room_values =
            array_values(self.command("SMEMBERS", &[user_rooms_key(user_id)]).await?)?;
        for room in room_values {
            let Some(room) = bulk_string(room) else {
                continue;
            };
            let Ok(room_id) = Uuid::parse_str(&room) else {
                continue;
            };
            self.leave(room_id, user_id).await?;
            self.command("DEL", &[auto_join_snooze_key(room_id, user_id)])
                .await?;
        }

        let ticket_values = array_values(
            self.command("SMEMBERS", &[user_tickets_key(user_id)])
                .await?,
        )?;
        for ticket in ticket_values {
            if let Some(ticket) = bulk_string(ticket) {
                self.command("DEL", &[ticket_key(&ticket)]).await?;
            }
        }
        self.command(
            "DEL",
            &[
                user_key(user_id),
                status_key(user_id),
                movement_rate_key(user_id),
                user_rooms_key(user_id),
                user_tickets_key(user_id),
            ],
        )
        .await?;
        Ok(())
    }

    async fn sessions(&self, room_id: Uuid) -> Result<Vec<LiveSession>> {
        let zones = array_values(
            self.command("SMEMBERS", &[session_zones_key(room_id)])
                .await?,
        )?;
        let mut sessions = Vec::new();
        for zone in zones {
            let Some(zone) = bulk_string(zone) else {
                continue;
            };
            if let Some(raw) =
                bulk_string(self.command("GET", &[session_key(room_id, &zone)]).await?)
            {
                if let Ok(session) = serde_json::from_str::<LiveSession>(&raw) {
                    sessions.push(session);
                }
            }
        }
        sessions.sort_by_key(|session| session.started_at);
        Ok(sessions)
    }

    async fn rebuild_zone_sessions(&self, room_id: Uuid) -> Result<()> {
        let pairs = array_values(self.command("HGETALL", &[member_key(room_id)]).await?)?;
        let now = now_seconds();
        let mut grouped: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
        for pair in pairs.chunks_exact(2) {
            let Some(user) = bulk_string(pair[0].clone()) else {
                continue;
            };
            let Some(raw_member) = bulk_string(pair[1].clone()) else {
                continue;
            };
            let Ok(user_id) = Uuid::parse_str(&user) else {
                continue;
            };
            let Ok(member) = serde_json::from_str::<LiveMember>(&raw_member) else {
                continue;
            };
            if member.lease_until > now {
                let zone_id = member.zone_id.or_else(|| {
                    member
                        .leaving_until
                        .filter(|deadline| *deadline > now)
                        .and(member.previous_zone_id)
                });
                if let Some(zone_id) = zone_id {
                    grouped.entry(zone_id).or_default().push(user_id);
                }
            }
        }
        let known = array_values(
            self.command("SMEMBERS", &[session_zones_key(room_id)])
                .await?,
        )?;
        for zone in known {
            let Some(zone) = bulk_string(zone) else {
                continue;
            };
            let Ok(zone_id) = Uuid::parse_str(&zone) else {
                continue;
            };
            let participants = grouped.remove(&zone_id).unwrap_or_default();
            let mut participants = participants;
            participants.sort_unstable();
            let existing = bulk_string(self.command("GET", &[session_key(room_id, &zone)]).await?);
            if participants.len() < 2 {
                if let Some(raw) = existing.as_deref() {
                    if let Ok(session) = serde_json::from_str::<LiveSession>(raw) {
                        self.command(
                            "XADD",
                            &[
                                events_key(room_id),
                                "MAXLEN".to_string(),
                                "~".to_string(),
                                "10000".to_string(),
                                "*".to_string(),
                                "type".to_string(),
                                "session_ended".to_string(),
                                "session_id".to_string(),
                                session.session_id.to_string(),
                                "zone_id".to_string(),
                                zone.to_string(),
                                "ended_reason".to_string(),
                                "participant_left".to_string(),
                            ],
                        )
                        .await?;
                    }
                }
                self.command("DEL", &[session_key(room_id, &zone)]).await?;
                self.command("SREM", &[session_zones_key(room_id), zone])
                    .await?;
                continue;
            }
            let existing_session = existing
                .as_deref()
                .and_then(|value| serde_json::from_str::<LiveSession>(value).ok());
            let previous_participants = existing_session
                .as_ref()
                .map(|session| session.participant_ids.clone());
            let session = existing_session.clone().unwrap_or(LiveSession {
                session_id: Uuid::now_v7(),
                zone_id,
                started_at: now,
                participant_ids: Vec::new(),
                leaving_deadlines: HashMap::new(),
            });
            let mut leaving_deadlines = HashMap::new();
            for user_id in &participants {
                if let Some(raw_member) = self
                    .command("HGET", &[member_key(room_id), user_id.to_string()])
                    .await
                    .ok()
                    .and_then(bulk_string)
                {
                    if let Ok(member) = serde_json::from_str::<LiveMember>(&raw_member) {
                        if member.zone_id.is_none() {
                            if let Some(deadline) =
                                member.leaving_until.filter(|deadline| *deadline > now)
                            {
                                leaving_deadlines.insert(*user_id, deadline);
                            }
                        }
                    }
                }
            }
            let updated = LiveSession {
                participant_ids: participants,
                leaving_deadlines,
                ..session
            };
            let event_type = match previous_participants {
                None => Some("session_started"),
                Some(previous) if previous != updated.participant_ids => Some("session_updated"),
                Some(_) => None,
            };
            self.command(
                "SET",
                &[
                    session_key(room_id, &zone),
                    serde_json::to_string(&updated)?,
                ],
            )
            .await?;
            if let Some(event_type) = event_type {
                self.command(
                    "XADD",
                    &[
                        events_key(room_id),
                        "MAXLEN".to_string(),
                        "~".to_string(),
                        "10000".to_string(),
                        "*".to_string(),
                        "type".to_string(),
                        event_type.to_string(),
                        "session_id".to_string(),
                        updated.session_id.to_string(),
                        "zone_id".to_string(),
                        zone.to_string(),
                        "participants".to_string(),
                        serde_json::to_string(&updated.participant_ids)?,
                    ],
                )
                .await?;
            }
        }
        for (zone_id, participants) in grouped {
            if participants.len() < 2 {
                continue;
            }
            let mut participants = participants;
            participants.sort_unstable();
            let zone = zone_id.to_string();
            let session = LiveSession {
                session_id: Uuid::now_v7(),
                zone_id,
                started_at: now,
                participant_ids: participants,
                leaving_deadlines: HashMap::new(),
            };
            let created = self
                .command(
                    "SET",
                    &[
                        session_key(room_id, &zone),
                        serde_json::to_string(&session)?,
                        "NX".to_string(),
                    ],
                )
                .await?;
            if matches!(created, RedisValue::Bulk(None)) {
                // Another API instance won the atomic SET NX race. Repair the zone index
                // and keep its session id; never emit a second lifecycle for this group.
                self.command("SADD", &[session_zones_key(room_id), zone])
                    .await?;
                continue;
            }
            self.command("SADD", &[session_zones_key(room_id), zone.clone()])
                .await?;
            self.command(
                "XADD",
                &[
                    events_key(room_id),
                    "MAXLEN".to_string(),
                    "~".to_string(),
                    "10000".to_string(),
                    "*".to_string(),
                    "type".to_string(),
                    "session_started".to_string(),
                    "session_id".to_string(),
                    session.session_id.to_string(),
                    "zone_id".to_string(),
                    zone.to_string(),
                    "participants".to_string(),
                    serde_json::to_string(&session.participant_ids)?,
                ],
            )
            .await?;
        }
        Ok(())
    }

    async fn bump_version(&self, room_id: Uuid) -> Result<()> {
        self.command("INCR", &[version_key(room_id)])
            .await
            .map(|_| ())
    }

    async fn command(&self, name: &str, args: &[String]) -> Result<RedisValue> {
        let mut connection = self.connection.lock().await;
        if connection.is_none() {
            *connection = Some(open_redis_connection(&self.connection_config).await?);
        }
        let result = send_redis_command(
            connection
                .as_mut()
                .expect("Redis connection initialized before command"),
            name,
            args,
        )
        .await;
        if result.is_err() {
            // The command may already have reached Redis before the socket failed, so do
            // not replay it here. Drop the broken transport and reconnect on the next
            // operation; callers keep their existing idempotency/concurrency semantics.
            *connection = None;
        }
        result
    }

    async fn eval(&self, script: &str, keys: &[String], args: &[String]) -> Result<i64> {
        let mut command = vec![script.to_string(), keys.len().to_string()];
        command.extend(keys.iter().cloned());
        command.extend(args.iter().cloned());
        integer_optional(self.command("EVAL", &command).await?)
            .ok_or_else(|| anyhow!("Redis EVAL returned a non-integer result"))
    }
}

const JOIN_SCRIPT: &str = r#"
if redis.call('EXISTS', KEYS[7]) == 1 then return -2 end
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current and redis.call('HLEN', KEYS[1]) >= 30 then return -1 end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('SADD', KEYS[2], ARGV[3])
redis.call('ZREM', KEYS[5], ARGV[1])
redis.call('SADD', KEYS[6], ARGV[3])
redis.call('INCR', KEYS[3])
redis.call('XADD', KEYS[4], 'MAXLEN', '~', '10000', '*', 'type', 'joined', 'user_id', ARGV[1])
return 1
"#;

const LEAVE_SCRIPT: &str = r#"
redis.call('HDEL', KEYS[1], ARGV[1])
redis.call('SREM', KEYS[2], ARGV[2])
redis.call('ZREM', KEYS[5], ARGV[1])
if redis.call('HLEN', KEYS[1]) == 0 then
  redis.call('SREM', KEYS[6], ARGV[2])
end
redis.call('INCR', KEYS[3])
redis.call('XADD', KEYS[4], 'MAXLEN', '~', '10000', '*', 'type', 'left', 'user_id', ARGV[1])
return 1
"#;

const RENEW_SCRIPT: &str = r#"
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current then return 0 end
local decoded = cjson.decode(current)
decoded.lease_until = tonumber(ARGV[2])
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(decoded))
return 1
"#;

const PRUNE_MEMBER_SCRIPT: &str = r#"
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current then return 0 end
local decoded = cjson.decode(current)
if tonumber(decoded.lease_until or 0) > tonumber(ARGV[3]) then return 0 end
redis.call('HDEL', KEYS[1], ARGV[1])
redis.call('SREM', KEYS[2], ARGV[2])
return 1
"#;

const UPDATE_SCRIPT: &str = r#"
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current then return -1 end
local decoded = cjson.decode(current)
local current_client = decoded.client_id
if not current_client or current_client == cjson.null then current_client = '' end
local incoming_seq = tonumber(ARGV[3])
if current_client ~= '' and current_client ~= ARGV[4] and incoming_seq ~= 1 then return -2 end
local previous = tonumber(decoded.client_seq or 0)
if current_client == ARGV[4] and incoming_seq < previous then return 0 end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('INCR', KEYS[2])
local updated = cjson.decode(ARGV[2])
if updated.leaving_until and updated.leaving_until ~= cjson.null then
  redis.call('ZADD', KEYS[4], updated.leaving_until, ARGV[1])
else
  redis.call('ZREM', KEYS[4], ARGV[1])
end
redis.call('XADD', KEYS[3], 'MAXLEN', '~', '10000', '*', 'type', 'member_updated', 'user_id', ARGV[1])
return 1
"#;

async fn open_redis_connection(config: &RedisConnectionConfig) -> Result<BufStream<RedisStream>> {
    let stream = TcpStream::connect((config.host.as_str(), config.port))
        .await
        .with_context(|| {
            format!(
                "failed to connect to Redis at {}:{}",
                config.host, config.port
            )
        })?;
    let redis_stream = if config.tls {
        let mut roots = RootCertStore::empty();
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        let tls_config = ClientConfig::builder()
            .with_root_certificates(roots)
            .with_no_client_auth();
        let connector = TlsConnector::from(Arc::new(tls_config));
        let server_name = ServerName::try_from(config.host.clone())
            .map_err(|_| anyhow!("REDIS_URL host is not a valid TLS server name"))?;
        RedisStream::Tls(Box::new(
            connector
                .connect(server_name, stream)
                .await
                .context("failed to establish TLS connection to Redis")?,
        ))
    } else {
        RedisStream::Plain(stream)
    };
    let mut stream = BufStream::new(redis_stream);
    if let Some(password) = &config.password {
        send_redis_command(&mut stream, "AUTH", std::slice::from_ref(password)).await?;
    }
    send_redis_command(&mut stream, "PING", &[]).await?;
    Ok(stream)
}

async fn send_redis_command(
    stream: &mut BufStream<RedisStream>,
    name: &str,
    args: &[String],
) -> Result<RedisValue> {
    let mut request = format!("*{}\r\n${}\r\n{}\r\n", args.len() + 1, name.len(), name);
    for arg in args {
        request.push_str(&format!("${}\r\n{}\r\n", arg.len(), arg));
    }
    stream.write_all(request.as_bytes()).await?;
    stream.flush().await?;
    read_value(stream).await
}

fn parse_redis_url(url: &str) -> Result<(bool, String, u16, Option<String>)> {
    let (tls, value) = if let Some(value) = url.strip_prefix("redis://") {
        (false, value)
    } else if let Some(value) = url.strip_prefix("rediss://") {
        (true, value)
    } else {
        return Err(anyhow!("REDIS_URL must use redis:// or rediss://"));
    };
    let (authority, _) = value.split_once('/').unwrap_or((value, ""));
    let (credentials, host_port) = authority
        .rsplit_once('@')
        .map_or((None, authority), |(credentials, host)| {
            (Some(credentials), host)
        });
    let (host, port) = host_port
        .rsplit_once(':')
        .map_or((host_port, "6379"), |(host, port)| (host, port));
    let password = credentials.and_then(|credentials| {
        credentials
            .split_once(':')
            .map(|(_, password)| password.to_string())
    });
    if host.is_empty() {
        return Err(anyhow!("REDIS_URL host cannot be empty"));
    }
    Ok((
        tls,
        host.to_string(),
        port.parse().context("REDIS_URL port must be a number")?,
        password,
    ))
}

fn read_value<'a>(
    stream: &'a mut BufStream<RedisStream>,
) -> Pin<Box<dyn Future<Output = Result<RedisValue>> + Send + 'a>> {
    Box::pin(async move {
        let mut prefix = [0_u8; 1];
        stream.read_exact(&mut prefix).await?;
        match prefix[0] {
            b'+' => Ok(RedisValue::Simple(read_line(stream).await?)),
            b':' => Ok(RedisValue::Integer(read_line(stream).await?.parse()?)),
            b'-' => Err(anyhow!(
                "Redis command failed: {}",
                read_line(stream).await?
            )),
            b'$' => {
                let len: i64 = read_line(stream).await?.parse()?;
                if len < 0 {
                    return Ok(RedisValue::Bulk(None));
                }
                let mut data = vec![0_u8; len as usize];
                stream.read_exact(&mut data).await?;
                let mut crlf = [0_u8; 2];
                stream.read_exact(&mut crlf).await?;
                Ok(RedisValue::Bulk(Some(data)))
            }
            b'*' => {
                let len: usize = read_line(stream).await?.parse()?;
                let mut values = Vec::with_capacity(len);
                for _ in 0..len {
                    values.push(read_value(stream).await?);
                }
                Ok(RedisValue::Array(values))
            }
            byte => Err(anyhow!("unknown Redis response prefix: {byte}")),
        }
    })
}

async fn read_line(stream: &mut BufStream<RedisStream>) -> Result<String> {
    let mut line = Vec::new();
    stream.read_until(b'\n', &mut line).await?;
    if line.len() < 2 || line[line.len() - 2..] != *b"\r\n" {
        return Err(anyhow!("invalid Redis response line"));
    }
    line.truncate(line.len() - 2);
    Ok(String::from_utf8(line)?)
}

fn bulk_string(value: RedisValue) -> Option<String> {
    match value {
        RedisValue::Bulk(Some(bytes)) => String::from_utf8(bytes).ok(),
        RedisValue::Simple(value) => Some(value),
        _ => None,
    }
}

fn integer_optional(value: RedisValue) -> Option<i64> {
    match value {
        RedisValue::Integer(value) => Some(value),
        RedisValue::Bulk(Some(bytes)) => String::from_utf8(bytes).ok()?.parse().ok(),
        _ => None,
    }
}

fn integer_or_zero(value: RedisValue) -> u64 {
    integer_optional(value).unwrap_or(0).max(0) as u64
}

fn array_values(value: RedisValue) -> Result<Vec<RedisValue>> {
    match value {
        RedisValue::Array(values) => Ok(values),
        other => Err(anyhow!("expected Redis array, got {other:?}")),
    }
}

fn derive_state_at(last_heartbeat_at: Option<i64>, now: i64) -> LivePresenceState {
    let Some(last) = last_heartbeat_at else {
        return LivePresenceState::Offline;
    };
    let elapsed = now.saturating_sub(last);
    if elapsed <= CODING_WINDOW_SECONDS {
        LivePresenceState::Coding
    } else if elapsed <= IDLE_WINDOW_SECONDS {
        LivePresenceState::Idle
    } else {
        LivePresenceState::Offline
    }
}

pub fn hash_token(token: &str) -> String {
    Sha256::digest(token.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn now_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_else(|_| Utc::now().timestamp())
}
fn member_key(room_id: Uuid) -> String {
    format!("presence:room:{room_id}:members")
}
fn version_key(room_id: Uuid) -> String {
    format!("presence:room:{room_id}:version")
}
fn user_key(user_id: Uuid) -> String {
    format!("presence:user:{user_id}")
}
fn status_key(user_id: Uuid) -> String {
    format!("presence:user:{user_id}:status")
}
fn movement_rate_key(user_id: Uuid) -> String {
    format!("presence:rate:movement:{user_id}")
}
fn user_rooms_key(user_id: Uuid) -> String {
    format!("presence:user:{user_id}:rooms")
}
fn user_tickets_key(user_id: Uuid) -> String {
    format!("presence:user:{user_id}:tickets")
}
fn auto_join_snooze_key(room_id: Uuid, user_id: Uuid) -> String {
    format!("presence:room:{room_id}:auto-join-snooze:{user_id}")
}
fn session_zones_key(room_id: Uuid) -> String {
    format!("presence:room:{room_id}:sessions")
}
fn events_key(room_id: Uuid) -> String {
    format!("presence:room:{room_id}:events")
}
fn active_rooms_key() -> String {
    "presence:rooms:active".to_string()
}
fn deadlines_key(room_id: Uuid) -> String {
    format!("presence:session:deadlines:{room_id}")
}
fn closed_key(room_id: Uuid) -> String {
    format!("presence:room:{room_id}:closed")
}
fn session_key(room_id: Uuid, zone: &str) -> String {
    format!("presence:room:{room_id}:session:{zone}")
}
fn ticket_key(token: &str) -> String {
    format!("presence:ticket:{}", hash_token(token))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invite_hash_is_deterministic_and_never_plaintext() {
        let token = "invite-secret";
        let hash = hash_token(token);
        assert_eq!(hash, hash_token(token));
        assert_eq!(hash.len(), 64);
        assert!(!hash.contains(token));
    }

    #[test]
    fn status_is_trimmed_collapsed_and_expires() {
        let status = normalize_status("  Fixing \n the\tauth   bug ", Some(" 🐛 "), 3600, 1_000)
            .expect("valid status");
        assert_eq!(status.text, "Fixing the auth bug");
        assert_eq!(status.emoji.as_deref(), Some("🐛"));
        assert_eq!(status.expires_at, 4_600);
        assert_eq!(
            normalize_status("Reviewing", Some("  "), 300, 0)
                .unwrap()
                .emoji,
            None
        );
        assert_eq!(
            normalize_status("Reviewing", None, 300, 0).unwrap().emoji,
            None
        );
    }

    #[test]
    fn status_rejects_empty_long_texty_emoji_and_bad_expiry() {
        assert_eq!(
            normalize_status(" \t ", None, 600, 0),
            Err(StatusError::Empty)
        );
        assert_eq!(
            normalize_status(&"a".repeat(STATUS_TEXT_MAX_CHARS + 1), None, 600, 0),
            Err(StatusError::TooLong)
        );
        assert!(normalize_status(&"é".repeat(STATUS_TEXT_MAX_CHARS), None, 600, 0).is_ok());
        assert_eq!(
            normalize_status("ok", Some("hi"), 600, 0),
            Err(StatusError::InvalidEmoji)
        );
        assert_eq!(
            normalize_status("ok", Some("🎯🎯🎯🎯🎯🎯🎯🎯🎯"), 600, 0),
            Err(StatusError::InvalidEmoji)
        );
        assert_eq!(
            normalize_status("ok", None, STATUS_MIN_TTL_SECONDS - 1, 0),
            Err(StatusError::InvalidExpiry)
        );
        assert_eq!(
            normalize_status("ok", None, STATUS_MAX_TTL_SECONDS + 1, 0),
            Err(StatusError::InvalidExpiry)
        );
        assert!(!StatusError::InvalidExpiry.message().is_empty());
    }

    #[test]
    fn status_neutralises_bidirectional_overrides() {
        let status = normalize_status("Reviewing \u{202E}gub", None, 600, 0).unwrap();
        assert_eq!(status.text, "Reviewing gub");
        assert_eq!(
            normalize_status("\u{2066}ok\u{2069}", None, 600, 0)
                .unwrap()
                .text,
            "ok"
        );
    }

    #[test]
    fn combined_mget_reply_splits_heartbeats_from_statuses() {
        let reply = vec![
            RedisValue::Integer(10),
            RedisValue::Integer(20),
            RedisValue::Bulk(Some(b"status-a".to_vec())),
            RedisValue::Bulk(None),
        ];
        let (heartbeats, statuses) = split_heartbeats_and_statuses(reply, 2);
        assert_eq!(heartbeats.len(), 2);
        assert_eq!(integer_optional(heartbeats[1].clone()), Some(20));
        assert_eq!(statuses.len(), 2);
        assert_eq!(
            statuses[0].clone().and_then(bulk_string).as_deref(),
            Some("status-a")
        );
        assert_eq!(statuses[1].clone().and_then(bulk_string), None);

        let (heartbeats, statuses) = split_heartbeats_and_statuses(vec![RedisValue::Integer(1)], 2);
        assert_eq!(heartbeats.len(), 1);
        assert!(statuses.iter().all(Option::is_none));
    }

    #[test]
    fn stored_status_is_hidden_once_expired_or_unreadable() {
        let status = normalize_status("Pairing", None, 600, 1_000).unwrap();
        let raw = serde_json::to_string(&status).unwrap();
        assert_eq!(live_status(Some(raw.clone()), 1_599), Some(status));
        assert_eq!(live_status(Some(raw), 1_600), None);
        assert_eq!(live_status(Some("not json".to_string()), 0), None);
        assert_eq!(live_status(None, 0), None);
    }

    #[test]
    fn session_ids_are_unique_for_repeated_zone_lifecycles() {
        assert_ne!(Uuid::now_v7(), Uuid::now_v7());
    }
}

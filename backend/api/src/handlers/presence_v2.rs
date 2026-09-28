pub mod office;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use chrono::{DateTime, Duration, NaiveDate, NaiveTime, TimeZone, Utc};
use chrono_tz::Tz;
use futures::stream::{self, Stream};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap, convert::Infallible, fmt::Display, sync::Arc, sync::OnceLock,
    time::Duration as StdDuration,
};
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::infrastructure::redis_presence::{
    normalize_status, LivePosition, LivePresenceState, LiveSession, LiveSnapshot, PresenceStatus,
    RedisPresenceStore, UpdateMemberResult,
};
use crate::middleware::auth;
use crate::model::presence::{PresenceInvite, PresenceRoom, PresenceRoomKind, PresenceZone};

#[derive(Debug)]
pub struct PresenceApiError {
    status: StatusCode,
    message: String,
}

impl PresenceApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
    fn unauthorized() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "authentication required")
    }
    fn unavailable(message: impl Display) -> Self {
        Self::new(StatusCode::SERVICE_UNAVAILABLE, message.to_string())
    }
    fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }
    fn forbidden(message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, message)
    }
    fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }
    fn conflict(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, message)
    }
    fn gone(message: impl Into<String>) -> Self {
        Self::new(StatusCode::GONE, message)
    }
    fn rate_limited() -> Self {
        Self::new(
            StatusCode::TOO_MANY_REQUESTS,
            "presence movement rate limit exceeded",
        )
    }
    fn internal(error: impl std::fmt::Display) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string())
    }
}

impl axum::response::IntoResponse for PresenceApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            Json(json!({ "error": { "code": self.status.as_u16(), "message": self.message } })),
        )
            .into_response()
    }
}

#[derive(Debug, Serialize)]
pub struct RoomEnvelope<T> {
    pub data: T,
    pub meta: RoomMeta,
}

#[derive(Debug, Serialize)]
pub struct RoomMeta {
    pub request_id: Uuid,
    pub generated_at: String,
    pub timezone: &'static str,
    pub data_freshness: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coverage: Option<Value>,
}

fn envelope<T>(data: T) -> RoomEnvelope<T> {
    RoomEnvelope {
        data,
        meta: RoomMeta {
            request_id: Uuid::now_v7(),
            generated_at: Utc::now().to_rfc3339(),
            timezone: "UTC",
            data_freshness: "realtime",
            coverage: None,
        },
    }
}

#[derive(Debug, Serialize)]
pub struct RoomData {
    pub id: Uuid,
    pub kind: &'static str,
    pub team_id: Option<Uuid>,
    pub owner_user_id: Option<Uuid>,
    pub name: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub zones: Vec<PresenceZone>,
}

#[derive(Debug, Serialize)]
pub struct RoomListItem {
    pub id: Uuid,
    pub kind: &'static str,
    pub team_id: Option<Uuid>,
    pub name: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SnapshotData {
    pub version: u64,
    pub server_time: i64,
    pub room: RoomListItem,
    pub zones: Vec<PresenceZone>,
    pub roster: Vec<RosterItem>,
    pub sessions: Vec<SessionItem>,
}

#[derive(Debug, Serialize)]
pub struct RosterItem {
    pub user_id: Uuid,
    pub username: String,
    pub state: LivePresenceState,
    pub position: Option<LivePosition>,
    pub zone_id: Option<Uuid>,
    /// The member's own status message, if they set one. Omitted otherwise.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<PresenceStatus>,
}

/// Default lifetime of a status when the client does not pick one: half a working day.
const DEFAULT_STATUS_TTL_SECONDS: i64 = 4 * 3600;

#[derive(Debug, Deserialize)]
pub struct SetStatusInput {
    pub text: String,
    pub emoji: Option<String>,
    pub expires_in_seconds: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SessionItem {
    pub session_id: Uuid,
    pub zone_id: Uuid,
    pub started_at: i64,
    pub participants: Vec<SessionParticipant>,
    pub leaving_deadlines: HashMap<Uuid, i64>,
}

#[derive(Debug, Serialize)]
pub struct SessionParticipant {
    pub user_id: Uuid,
    pub username: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoomInput {
    pub name: String,
    pub expires_in_seconds: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct JoinRoomInput {
    pub invite_token: Option<String>,
    pub client_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ResolveInviteInput {
    pub token: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateInviteInput {
    pub expires_in_seconds: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMemberInput {
    pub position: LivePosition,
    pub zone_id: Option<Uuid>,
    pub client_id: Option<Uuid>,
    pub client_seq: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    pub ticket: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TicketData {
    pub ticket: String,
    pub expires_in_seconds: u64,
}

#[derive(Debug, Serialize)]
pub struct InviteData {
    pub id: Uuid,
    pub room_id: Uuid,
    pub invite_url_token: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub used_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub from: Option<String>,
    pub to: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<u64>,
    pub timezone: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HistoryParticipant {
    pub user_id: Uuid,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct HistoryItem {
    pub session_id: Uuid,
    pub room_id: Uuid,
    pub room_name: String,
    pub team_id: Option<Uuid>,
    pub zone_id: Option<Uuid>,
    pub source: String,
    pub ended_reason: String,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub your_joined_at: i64,
    pub your_left_at: Option<i64>,
    pub duration_seconds: u64,
    pub participants: Vec<HistoryParticipant>,
    pub your_projects: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct HistoryData {
    pub items: Vec<HistoryItem>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SummaryQuery {
    pub from: Option<String>,
    pub to: Option<String>,
    pub team_id: Option<Uuid>,
    pub timezone: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PresenceSummaryData {
    pub suppressed: bool,
    pub session_count: Option<u64>,
    pub total_collaboration_seconds: Option<u64>,
    pub average_group_size: Option<f64>,
    pub active_days: Option<u64>,
}

pub async fn list_rooms(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<RoomEnvelope<Vec<RoomListItem>>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let repo = repo(&state)?;
    let rooms = repo
        .list_for_user(user_id)
        .await
        .map_err(PresenceApiError::internal)?;
    let items = rooms.into_iter().map(room_item).collect();
    Ok(Json(envelope(items)))
}

pub async fn create_room(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateRoomInput>,
) -> Result<(StatusCode, Json<RoomEnvelope<RoomData>>), PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let repo = repo(&state)?;
    state
        .user_service
        .ensure_postgres_identity(user_id)
        .await
        .map_err(PresenceApiError::internal)?;
    let room = repo
        .create_adhoc(
            user_id,
            &input.name,
            input.expires_in_seconds.unwrap_or(86_400),
        )
        .await
        .map_err(map_repo_error)?;
    let data = room_data(repo, room).await?;
    Ok((StatusCode::CREATED, Json(envelope(data))))
}

pub async fn get_room(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
) -> Result<Json<RoomEnvelope<RoomData>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let repo = repo(&state)?;
    let room = repo
        .get(room_id)
        .await
        .map_err(PresenceApiError::internal)?
        .ok_or_else(|| PresenceApiError::not_found("presence room not found"))?;
    if !repo
        .can_join(&room, user_id)
        .await
        .map_err(PresenceApiError::internal)?
    {
        // Do not confirm that a private team/ad-hoc room exists to an unauthorized user.
        return Err(PresenceApiError::not_found("presence room not found"));
    }
    let data = room_data(repo, room).await?;
    Ok(Json(envelope(data)))
}

pub async fn resolve_invite(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<ResolveInviteInput>,
) -> Result<Json<RoomEnvelope<RoomData>>, PresenceApiError> {
    let _ = user(&state, &headers).await?;
    if input.token.trim().is_empty() {
        return Err(PresenceApiError::bad_request("invite token is required"));
    }
    let repo = repo(&state)?;
    let room = repo
        .room_for_invite(&crate::infrastructure::redis_presence::hash_token(
            &input.token,
        ))
        .await
        .map_err(PresenceApiError::internal)?
        .ok_or_else(|| PresenceApiError::gone("invite is invalid or revoked"))?;
    let data = room_data(repo, room).await?;
    Ok(Json(envelope(data)))
}

pub async fn join_room(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
    body: Option<Json<JoinRoomInput>>,
) -> Result<Json<RoomEnvelope<SnapshotData>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let repo = repo(&state)?;
    let redis = redis(&state)?;
    let room = repo
        .get(room_id)
        .await
        .map_err(PresenceApiError::internal)?
        .ok_or_else(|| PresenceApiError::not_found("presence room not found"))?;
    if room.ended_at.is_some() {
        return Err(PresenceApiError::conflict("presence room has ended"));
    }
    if room
        .expires_at
        .is_some_and(|expires_at| expires_at <= Utc::now())
    {
        return Err(PresenceApiError::gone("presence room has expired"));
    }
    let (invite_token, client_id) = body
        .map(|Json(body)| (body.invite_token, body.client_id))
        .unwrap_or((None, None));
    if room.kind == PresenceRoomKind::Adhoc {
        // The invite redemption writes a grant with a foreign key to users.id. Existing
        // ClickHouse-era accounts may not have been copied to PostgreSQL yet.
        state
            .user_service
            .ensure_postgres_identity(user_id)
            .await
            .map_err(PresenceApiError::internal)?;
        if let Some(token) = invite_token {
            let redeemed = repo
                .redeem_invite(
                    room_id,
                    &crate::infrastructure::redis_presence::hash_token(&token),
                    user_id,
                )
                .await
                .map_err(PresenceApiError::internal)?;
            if !redeemed
                && !repo
                    .can_join(&room, user_id)
                    .await
                    .map_err(PresenceApiError::internal)?
            {
                return Err(PresenceApiError::gone("invite is invalid or expired"));
            }
        }
    }
    if !repo
        .can_join(&room, user_id)
        .await
        .map_err(PresenceApiError::internal)?
    {
        return Err(PresenceApiError::forbidden(
            "you do not have access to this presence room",
        ));
    }
    let username = state
        .user_service
        .get_current(user_id)
        .await
        .map_err(PresenceApiError::internal)?
        .data
        .username;
    let live = redis
        .join(room_id, user_id, username, client_id)
        .await
        .map_err(|error| {
            if error.to_string().contains("room is closed") {
                PresenceApiError::conflict("presence room has ended or expired")
            } else if error.to_string().contains("room is full") {
                PresenceApiError::conflict("presence room is full")
            } else {
                PresenceApiError::unavailable(error)
            }
        })?;
    checkpoint_live_sessions(&state, room.team_id, room_id, &live).await;
    let data = snapshot_data(repo, room, live).await?;
    Ok(Json(envelope(data)))
}

pub async fn leave_room(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
) -> Result<StatusCode, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let redis = redis(&state)?;
    redis
        .leave(room_id, user_id)
        .await
        .map_err(PresenceApiError::unavailable)?;
    if let Ok(repo) = repo(&state) {
        if let Ok(Some(room)) = repo.get(room_id).await {
            if room.kind == PresenceRoomKind::Team {
                // An explicit leave from a team's always-available home room must stick
                // for a while, or the next presence-heartbeat tick (as soon as ~30s
                // later, since the user is presumably still coding) silently undoes it.
                // Ad-hoc rooms have no auto-join path, so nothing to suppress there.
                if let Err(error) = redis.snooze_auto_join(room_id, user_id).await {
                    tracing::warn!(room_id = %room_id, user_id = %user_id, error = %error, "could not snooze presence auto-join after leave");
                }
            }
            if let Ok(live) = redis.snapshot(room_id).await {
                checkpoint_live_sessions(&state, room.team_id, room_id, &live).await;
            }
        }
    }
    Ok(StatusCode::NO_CONTENT)
}

/// `GET /api/v2/me/presence/status` — the caller's own status, or `null`.
pub async fn get_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<RoomEnvelope<Option<PresenceStatus>>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let status = redis(&state)?
        .status(user_id)
        .await
        .map_err(PresenceApiError::unavailable)?;
    Ok(Json(envelope(status)))
}

/// `PUT /api/v2/me/presence/status` — sets the caller's status. It is shown only in the
/// roster of rooms the caller is currently in, and always expires.
pub async fn set_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<SetStatusInput>,
) -> Result<Json<RoomEnvelope<Option<PresenceStatus>>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let redis = redis(&state)?;
    let status = normalize_status(
        &input.text,
        input.emoji.as_deref(),
        input
            .expires_in_seconds
            .unwrap_or(DEFAULT_STATUS_TTL_SECONDS),
        Utc::now().timestamp(),
    )
    .map_err(|error| PresenceApiError::bad_request(error.message()))?;
    redis
        .set_status(user_id, &status)
        .await
        .map_err(PresenceApiError::unavailable)?;
    Ok(Json(envelope(Some(status))))
}

/// `DELETE /api/v2/me/presence/status` — clears the caller's status.
pub async fn clear_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<StatusCode, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    redis(&state)?
        .clear_status(user_id)
        .await
        .map_err(PresenceApiError::unavailable)?;
    Ok(StatusCode::NO_CONTENT)
}

/// Keeps a user present without requiring the dashboard tab to stay open. A viewer with
/// an active SSE stream already gets this for free (`stream_presence` calls `redis.renew`
/// on every tick); this route exists for the case that motivated it — a CLI/editor client
/// that is still emitting heartbeats with no browser tab watching the room at all, which
/// would otherwise fall off the roster after `VIEWER_LEASE_SECONDS`.
///
/// User-scoped rather than room-scoped: it marks the caller as actively coding for every
/// team room they belong to, creating membership (via `join`) the first time and just
/// refreshing the lease (via `renew`) afterward, without disturbing their last position.
/// One team room failing to renew (closed/full) does not fail the others.
///
/// Skips auto-join for a room the caller explicitly left recently — see
/// `snooze_auto_join` — so leaving does not just get silently undone by the next tick.
pub async fn heartbeat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<StatusCode, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let repo = repo(&state)?;
    let redis = redis(&state)?;
    redis
        .heartbeat(user_id)
        .await
        .map_err(PresenceApiError::unavailable)?;

    let rooms = repo
        .list_for_user(user_id)
        .await
        .map_err(PresenceApiError::internal)?;
    let team_rooms = rooms
        .into_iter()
        .filter(|room| room.kind == PresenceRoomKind::Team);
    for room in team_rooms {
        match redis.renew(room.id, user_id).await {
            Ok(true) => continue,
            Ok(false) => {}
            Err(error) => {
                tracing::warn!(room_id = %room.id, user_id = %user_id, error = %error, "presence heartbeat renew failed");
                continue;
            }
        }
        match redis.is_auto_join_snoozed(room.id, user_id).await {
            Ok(true) => continue,
            Ok(false) => {}
            Err(error) => {
                tracing::warn!(room_id = %room.id, user_id = %user_id, error = %error, "presence heartbeat could not check auto-join snooze");
                continue;
            }
        }
        let username = match state.user_service.get_current(user_id).await {
            Ok(current) => current.data.username,
            Err(error) => {
                tracing::warn!(user_id = %user_id, error = %error, "presence heartbeat could not resolve username for auto-join");
                continue;
            }
        };
        if let Err(error) = redis.join(room.id, user_id, username, None).await {
            tracing::warn!(room_id = %room.id, user_id = %user_id, error = %error, "presence heartbeat auto-join failed");
        }
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn end_room(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
) -> Result<StatusCode, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let changed = repo(&state)?
        .end_room(room_id, user_id)
        .await
        .map_err(PresenceApiError::internal)?;
    if !changed {
        return Err(PresenceApiError::forbidden(
            "only the ad-hoc room owner can end it",
        ));
    }
    redis(&state)?
        .clear_room(room_id)
        .await
        .map_err(PresenceApiError::unavailable)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
    Json(input): Json<UpdateMemberInput>,
) -> Result<Json<RoomEnvelope<SnapshotData>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    state
        .presence_rate_limiter
        .check(user_id)
        .map_err(|_| PresenceApiError::rate_limited())?;
    let repo = repo(&state)?;
    let redis = redis(&state)?;
    if !redis
        .allow_movement(user_id)
        .await
        .map_err(PresenceApiError::unavailable)?
    {
        return Err(PresenceApiError::rate_limited());
    }
    let room = repo
        .get(room_id)
        .await
        .map_err(PresenceApiError::internal)?
        .ok_or_else(|| PresenceApiError::not_found("presence room not found"))?;
    if !repo
        .can_join(&room, user_id)
        .await
        .map_err(PresenceApiError::internal)?
    {
        return Err(PresenceApiError::forbidden(
            "you no longer have access to this presence room",
        ));
    }
    if room.ended_at.is_some() {
        return Err(PresenceApiError::conflict("presence room has ended"));
    }
    if room
        .expires_at
        .is_some_and(|expires_at| expires_at <= Utc::now())
    {
        return Err(PresenceApiError::gone("presence room has expired"));
    }
    let zones = repo
        .zones(room_id)
        .await
        .map_err(PresenceApiError::internal)?;
    if let Some(zone_id) = input.zone_id {
        let zone = zones
            .iter()
            .find(|zone| zone.id == zone_id)
            .ok_or_else(|| PresenceApiError::bad_request("unknown presence zone"))?;
        if !zone.contains(input.position.x, input.position.y) {
            return Err(PresenceApiError::bad_request(
                "position is outside the selected zone",
            ));
        }
    }
    let update_result = redis
        .update_member(
            room_id,
            user_id,
            input.position,
            input.zone_id,
            input.client_id,
            input.client_seq.unwrap_or(0),
        )
        .await
        .map_err(PresenceApiError::unavailable)?;
    match update_result {
        UpdateMemberResult::Accepted => {}
        UpdateMemberResult::ClientSuperseded => {
            return Err(PresenceApiError::conflict(
                "movement control moved to another browser tab",
            ));
        }
        UpdateMemberResult::InvalidPosition => {
            return Err(PresenceApiError::bad_request(
                "position must be finite and between 0 and 100",
            ));
        }
        UpdateMemberResult::NotMember => {
            return Err(PresenceApiError::not_found("join the room before moving"));
        }
    }
    let live = redis
        .snapshot(room_id)
        .await
        .map_err(PresenceApiError::unavailable)?;
    checkpoint_live_sessions(&state, room.team_id, room_id, &live).await;
    Ok(Json(envelope(snapshot_data_with_zones(room, zones, live))))
}

pub async fn create_stream_ticket(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
) -> Result<Json<RoomEnvelope<TicketData>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let repo = repo(&state)?;
    let redis = redis(&state)?;
    let room = repo
        .get(room_id)
        .await
        .map_err(PresenceApiError::internal)?
        .ok_or_else(|| PresenceApiError::not_found("presence room not found"))?;
    if room
        .expires_at
        .is_some_and(|expires_at| expires_at <= Utc::now())
    {
        return Err(PresenceApiError::gone("presence room has expired"));
    }
    if room.ended_at.is_some() {
        return Err(PresenceApiError::conflict("presence room has ended"));
    }
    if !repo
        .can_join(&room, user_id)
        .await
        .map_err(PresenceApiError::internal)?
    {
        return Err(PresenceApiError::forbidden(
            "you no longer have access to this presence room",
        ));
    }
    let snapshot = redis
        .snapshot(room_id)
        .await
        .map_err(PresenceApiError::unavailable)?;
    if !snapshot.roster.iter().any(|entry| entry.user_id == user_id) {
        return Err(PresenceApiError::forbidden(
            "join the room before streaming",
        ));
    }
    let ticket = redis
        .issue_ticket(room_id, user_id)
        .await
        .map_err(PresenceApiError::unavailable)?;
    Ok(Json(envelope(TicketData {
        ticket,
        expires_in_seconds: 300,
    })))
}

pub async fn stream_presence(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    headers: HeaderMap,
    Query(query): Query<StreamQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, PresenceApiError> {
    let redis = redis(&state)?;
    let user_id = if let Some(user_id) = auth::require_account_user(&state, &headers).await {
        user_id
    } else {
        let ticket = query
            .ticket
            .as_deref()
            .ok_or_else(PresenceApiError::unauthorized)?;
        redis
            .resolve_ticket(room_id, ticket)
            .await
            .map_err(PresenceApiError::unavailable)?
            .ok_or_else(PresenceApiError::unauthorized)?
    };
    if !redis
        .snapshot(room_id)
        .await
        .map_err(PresenceApiError::unavailable)?
        .roster
        .iter()
        .any(|entry| entry.user_id == user_id)
    {
        return Err(PresenceApiError::forbidden(
            "join the room before streaming",
        ));
    }
    let repo = repo(&state)?;
    let room = repo
        .get(room_id)
        .await
        .map_err(PresenceApiError::internal)?
        .ok_or_else(|| PresenceApiError::not_found("presence room not found"))?;
    if room
        .expires_at
        .is_some_and(|expires_at| expires_at <= Utc::now())
    {
        let _ = redis.clear_room(room_id).await;
        return Err(PresenceApiError::gone("presence room has expired"));
    }
    if room.ended_at.is_some()
        || !repo
            .can_join(&room, user_id)
            .await
            .map_err(PresenceApiError::internal)?
    {
        return Err(PresenceApiError::forbidden(
            "you no longer have access to this presence room",
        ));
    }
    let zones = repo
        .zones(room_id)
        .await
        .map_err(PresenceApiError::internal)?;
    let access_checked_at = Utc::now().timestamp();
    let events = stream::unfold(
        (
            true,
            state,
            redis,
            repo,
            room,
            zones,
            room_id,
            user_id,
            access_checked_at,
        ),
        |(
            initial,
            state,
            redis,
            repo,
            mut room,
            zones,
            room_id,
            user_id,
            mut access_checked_at,
        )| async move {
            if !initial {
                tokio::time::sleep(StdDuration::from_secs(3)).await;
            }
            if !initial && !redis.renew(room_id, user_id).await.unwrap_or(false) {
                return None;
            }

            // A team/admin can revoke access while an EventSource connection remains open.
            // Revalidate against PostgreSQL on a bounded cadence instead of letting a Redis
            // lease renew forever. Database errors fail closed; the browser may reconnect
            // after the authorization source is healthy again.
            let now = Utc::now();
            if now.timestamp().saturating_sub(access_checked_at) >= 15 {
                let refreshed_room = match repo.get(room_id).await {
                    Ok(Some(room)) => room,
                    _ => {
                        let _ = redis.leave(room_id, user_id).await;
                        return None;
                    }
                };
                if refreshed_room.ended_at.is_some()
                    || refreshed_room
                        .expires_at
                        .is_some_and(|expires_at| expires_at <= now)
                {
                    let _ = redis.clear_room(room_id).await;
                    return None;
                }
                if !matches!(repo.can_join(&refreshed_room, user_id).await, Ok(true)) {
                    let _ = redis.leave(room_id, user_id).await;
                    if let Ok(live) = redis.snapshot(room_id).await {
                        checkpoint_live_sessions(&state, refreshed_room.team_id, room_id, &live)
                            .await;
                    }
                    return None;
                }
                room = refreshed_room;
                access_checked_at = now.timestamp();
            }

            if room.expires_at.is_some_and(|expires_at| expires_at <= now) {
                let _ = redis.clear_room(room_id).await;
                return None;
            }
            let live = match redis.snapshot(room_id).await {
                Ok(live) => live,
                Err(error) => {
                    let event = Event::default()
                        .event("error")
                        .data(json!({"message": error.to_string()}).to_string());
                    return Some((
                        Ok(event),
                        (
                            false,
                            state,
                            redis,
                            repo,
                            room,
                            zones,
                            room_id,
                            user_id,
                            access_checked_at,
                        ),
                    ));
                }
            };
            checkpoint_live_sessions(&state, room.team_id, room_id, &live).await;
            let snapshot = snapshot_data_with_zones(room.clone(), zones.clone(), live);
            let event = Event::default()
                .event("snapshot")
                .data(serde_json::to_string(&snapshot).unwrap_or_else(|_| "{}".to_string()));
            Some((
                Ok(event),
                (
                    false,
                    state,
                    redis,
                    repo,
                    room,
                    zones,
                    room_id,
                    user_id,
                    access_checked_at,
                ),
            ))
        },
    );
    Ok(Sse::new(events).keep_alive(KeepAlive::default()))
}

pub async fn create_invite(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
    body: Option<Json<CreateInviteInput>>,
) -> Result<(StatusCode, Json<RoomEnvelope<InviteData>>), PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let repo = repo(&state)?;
    let room = repo
        .get(room_id)
        .await
        .map_err(PresenceApiError::internal)?
        .ok_or_else(|| PresenceApiError::not_found("presence room not found"))?;
    if room.kind != PresenceRoomKind::Adhoc || room.owner_user_id != Some(user_id) {
        return Err(PresenceApiError::forbidden(
            "only the ad-hoc room owner can create invites",
        ));
    }
    if room.ended_at.is_some() {
        return Err(PresenceApiError::conflict("presence room has ended"));
    }
    if room
        .expires_at
        .is_some_and(|expires_at| expires_at <= Utc::now())
    {
        return Err(PresenceApiError::gone("presence room has expired"));
    }
    let seconds = body
        .and_then(|Json(input)| input.expires_in_seconds)
        .unwrap_or(86_400);
    if ![3600, 86_400, 604_800].contains(&seconds) {
        return Err(PresenceApiError::bad_request(
            "invite expiry must be 3600, 86400 or 604800",
        ));
    }
    let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let invite = repo
        .create_invite(
            room_id,
            user_id,
            &crate::infrastructure::redis_presence::hash_token(&token),
            Utc::now() + Duration::seconds(seconds),
        )
        .await
        .map_err(map_repo_error)?;
    Ok((
        StatusCode::CREATED,
        Json(envelope(invite_data(invite, Some(token)))),
    ))
}

pub async fn list_invites(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(room_id): Path<Uuid>,
) -> Result<Json<RoomEnvelope<Vec<InviteData>>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let repo = repo(&state)?;
    let room = repo
        .get(room_id)
        .await
        .map_err(PresenceApiError::internal)?
        .ok_or_else(|| PresenceApiError::not_found("presence room not found"))?;
    if room.kind != PresenceRoomKind::Adhoc || room.owner_user_id != Some(user_id) {
        return Err(PresenceApiError::forbidden(
            "only the ad-hoc room owner can list invites",
        ));
    }
    let invites = repo
        .list_invites(room_id, user_id)
        .await
        .map_err(PresenceApiError::internal)?;
    Ok(Json(envelope(
        invites
            .into_iter()
            .map(|invite| invite_data(invite, None))
            .collect(),
    )))
}

pub async fn revoke_invite(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((room_id, invite_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let changed = repo(&state)?
        .revoke_invite(room_id, invite_id, user_id)
        .await
        .map_err(PresenceApiError::internal)?;
    if !changed {
        return Err(PresenceApiError::not_found("invite not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<RoomEnvelope<HistoryData>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let (from, to) = history_bounds(
        query.from.as_deref(),
        query.to.as_deref(),
        query.timezone.as_deref(),
    )?;
    let limit = query.limit.unwrap_or(50);
    if limit == 0 || limit > 100 {
        return Err(PresenceApiError::bad_request(
            "limit must be between 1 and 100",
        ));
    }
    let before = query
        .cursor
        .as_deref()
        .map(|cursor| {
            cursor
                .parse::<u32>()
                .map_err(|_| PresenceApiError::bad_request("cursor must be a Unix timestamp"))
        })
        .transpose()?;
    let rows = state
        .coworking_session_repo
        .history_for_user(user_id, from, to, limit + 1, before)
        .await
        .map_err(PresenceApiError::internal)?;
    let has_more = rows.len() > limit as usize;
    let rows = rows.into_iter().take(limit as usize).collect::<Vec<_>>();
    let mut participant_ids = Vec::new();
    for row in &rows {
        for value in &row.participant_ids {
            if let Ok(id) = Uuid::parse_str(value) {
                participant_ids.push(id);
            }
        }
    }
    participant_ids.sort_unstable();
    participant_ids.dedup();
    let repo = repo(&state)?;
    let names = repo
        .usernames(&participant_ids)
        .await
        .map_err(PresenceApiError::internal)?;
    let now = Utc::now().timestamp().max(0) as u32;
    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let started_at = row.started_at as i64;
        let ended_at = row.ended_at.map(|value| value as i64);
        let your_joined_at = row.my_joined_at as i64;
        let your_left_at = row.my_left_at.map(|value| value as i64);
        let personal_window_start = row.my_joined_at.max(from);
        let personal_window_end = row.my_left_at.unwrap_or(now).min(to);
        let duration_seconds = personal_window_end.saturating_sub(personal_window_start) as u64;
        let room_name = match repo.get(row.room_id).await {
            Ok(Some(room)) => room.name,
            Ok(None) => "Legacy room".to_string(),
            Err(error) => {
                tracing::warn!(room_id = %row.room_id, error = %error, "failed to resolve history room name");
                "Legacy room".to_string()
            }
        };
        let projects = state
            .heartbeat_repo
            .projects_for_window(user_id, personal_window_start, personal_window_end)
            .await
            .unwrap_or_default();
        let participants = row
            .participant_ids
            .into_iter()
            .filter_map(|value| Uuid::parse_str(&value).ok())
            .map(|id| HistoryParticipant {
                user_id: id,
                username: names
                    .get(&id)
                    .cloned()
                    .unwrap_or_else(|| "Former member".to_string()),
            })
            .collect();
        items.push(HistoryItem {
            session_id: row.session_id,
            room_id: row.room_id,
            room_name,
            team_id: row.team_id,
            zone_id: row.zone_id,
            source: row.source,
            ended_reason: row.ended_reason,
            started_at,
            ended_at,
            your_joined_at,
            your_left_at,
            duration_seconds,
            participants,
            your_projects: projects,
        });
    }
    let next_cursor = has_more
        .then(|| items.last().map(|item| item.started_at.to_string()))
        .flatten();
    Ok(Json(envelope(HistoryData { items, next_cursor })))
}

pub async fn organization_summary(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Query(query): Query<SummaryQuery>,
) -> Result<Json<RoomEnvelope<PresenceSummaryData>>, PresenceApiError> {
    let user_id = user(&state, &headers).await?;
    let (from, to) = history_bounds(
        query.from.as_deref(),
        query.to.as_deref(),
        query.timezone.as_deref(),
    )?;
    let repo = repo(&state)?;
    let Some(team_ids) = repo
        .organization_team_ids(organization_id, user_id, query.team_id)
        .await
        .map_err(PresenceApiError::internal)?
    else {
        return Err(PresenceApiError::forbidden(
            "you must be an active developer member of a team",
        ));
    };
    let aggregate = state
        .coworking_session_repo
        .summary_for_teams(&team_ids, from, to)
        .await
        .map_err(PresenceApiError::internal)?;
    if aggregate.distinct_participants < 3 {
        return Ok(Json(envelope(PresenceSummaryData {
            suppressed: true,
            session_count: None,
            total_collaboration_seconds: None,
            average_group_size: None,
            active_days: None,
        })));
    }
    Ok(Json(envelope(PresenceSummaryData {
        suppressed: false,
        session_count: Some(aggregate.session_count),
        total_collaboration_seconds: Some(aggregate.total_seconds),
        average_group_size: aggregate.average_group_size,
        active_days: Some(aggregate.active_days),
    })))
}

fn history_bounds(
    from: Option<&str>,
    to: Option<&str>,
    timezone: Option<&str>,
) -> Result<(u32, u32), PresenceApiError> {
    let timezone_name = timezone.unwrap_or("UTC");
    let tz: Tz = timezone_name
        .parse()
        .map_err(|_| PresenceApiError::bad_request("timezone must be a valid IANA timezone"))?;
    let today = Utc::now().with_timezone(&tz).date_naive();
    let start = from
        .map(|value| value.parse::<NaiveDate>())
        .transpose()
        .map_err(|_| PresenceApiError::bad_request("from must be YYYY-MM-DD"))?
        .unwrap_or(today - Duration::days(6));
    let end_date = to
        .map(|value| value.parse::<NaiveDate>())
        .transpose()
        .map_err(|_| PresenceApiError::bad_request("to must be YYYY-MM-DD"))?
        .unwrap_or(today);
    if start > end_date {
        return Err(PresenceApiError::bad_request(
            "from must be on or before to",
        ));
    }
    let local_start = start.and_time(NaiveTime::MIN);
    let local_end = (end_date + Duration::days(1)).and_time(NaiveTime::MIN);
    let start_at = tz
        .from_local_datetime(&local_start)
        .earliest()
        .ok_or_else(|| PresenceApiError::bad_request("invalid local start time for timezone"))?
        .with_timezone(&Utc)
        .timestamp();
    let end_at = tz
        .from_local_datetime(&local_end)
        .latest()
        .ok_or_else(|| PresenceApiError::bad_request("invalid local end time for timezone"))?
        .with_timezone(&Utc)
        .timestamp();
    Ok((start_at.max(0) as u32, end_at.max(0) as u32))
}

async fn user(state: &AppState, headers: &HeaderMap) -> Result<Uuid, PresenceApiError> {
    auth::require_account_user(state, headers)
        .await
        .ok_or_else(PresenceApiError::unauthorized)
}

async fn checkpoint_live_sessions(
    state: &AppState,
    team_id: Option<Uuid>,
    room_id: Uuid,
    live: &LiveSnapshot,
) {
    // A room can have up to thirty SSE clients. They all observe the same snapshot, so
    // writing ClickHouse on every three-second stream tick would turn a read fan-out into
    // thirty writes. Keep a per-process fingerprint and checkpoint only on a topology
    // change or once per minute; the Redis stream/reconciler remains the recovery path for
    // another API instance.
    static CHECKPOINTS: OnceLock<tokio::sync::Mutex<HashMap<Uuid, CheckpointMarker>>> =
        OnceLock::new();
    let mut sessions = live.sessions.clone();
    sessions.sort_by_key(|session| session.session_id);
    let fingerprint = serde_json::to_string(&sessions).unwrap_or_default();
    let now = Utc::now().timestamp();
    let cache = CHECKPOINTS.get_or_init(|| tokio::sync::Mutex::new(HashMap::new()));
    let mut checkpoints = cache.lock().await;
    if checkpoints.get(&room_id).is_some_and(|marker| {
        marker.fingerprint == fingerprint && now.saturating_sub(marker.checkpointed_at) < 60
    }) {
        return;
    }
    if let Err(error) = state
        .coworking_session_service
        .reconcile_live_snapshot(room_id, team_id, &sessions)
        .await
    {
        tracing::warn!(
            room_id = %room_id,
            error = %error,
            "presence session history checkpoint deferred"
        );
        return;
    }
    checkpoints.insert(
        room_id,
        CheckpointMarker {
            fingerprint,
            checkpointed_at: now,
        },
    );
}

struct CheckpointMarker {
    fingerprint: String,
    checkpointed_at: i64,
}

fn repo(
    state: &AppState,
) -> Result<Arc<crate::repository::presence::PresenceRepository>, PresenceApiError> {
    state
        .presence_repo
        .clone()
        .ok_or_else(|| PresenceApiError::unavailable("PostgreSQL is required for Presence v2"))
}

fn redis(state: &AppState) -> Result<Arc<RedisPresenceStore>, PresenceApiError> {
    state
        .redis_presence
        .clone()
        .ok_or_else(|| PresenceApiError::unavailable("Redis is required for Presence v2"))
}

fn room_item(room: PresenceRoom) -> RoomListItem {
    RoomListItem {
        id: room.id,
        kind: room_kind(room.kind),
        team_id: room.team_id,
        name: room.name,
        expires_at: room.expires_at,
        ended_at: room.ended_at,
    }
}

fn room_kind(kind: PresenceRoomKind) -> &'static str {
    kind.as_str()
}

async fn room_data(
    repo: Arc<crate::repository::presence::PresenceRepository>,
    room: PresenceRoom,
) -> Result<RoomData, PresenceApiError> {
    let zones = repo
        .zones(room.id)
        .await
        .map_err(PresenceApiError::internal)?;
    Ok(RoomData {
        id: room.id,
        kind: room_kind(room.kind),
        team_id: room.team_id,
        owner_user_id: room.owner_user_id,
        name: room.name,
        expires_at: room.expires_at,
        ended_at: room.ended_at,
        zones,
    })
}

async fn snapshot_data(
    repo: Arc<crate::repository::presence::PresenceRepository>,
    room: PresenceRoom,
    live: LiveSnapshot,
) -> Result<SnapshotData, PresenceApiError> {
    let zones = repo
        .zones(room.id)
        .await
        .map_err(PresenceApiError::internal)?;
    Ok(snapshot_data_with_zones(room, zones, live))
}

fn snapshot_data_with_zones(
    room: PresenceRoom,
    zones: Vec<PresenceZone>,
    live: LiveSnapshot,
) -> SnapshotData {
    let names: HashMap<Uuid, String> = live
        .roster
        .iter()
        .map(|entry| (entry.user_id, entry.username.clone()))
        .collect();
    SnapshotData {
        version: live.version,
        server_time: live.server_time,
        room: room_item(room),
        zones,
        roster: live
            .roster
            .into_iter()
            .map(|entry| RosterItem {
                user_id: entry.user_id,
                username: entry.username,
                state: entry.state,
                position: entry.position,
                zone_id: entry.zone_id,
                status: entry.status,
            })
            .collect(),
        sessions: live
            .sessions
            .into_iter()
            .map(|session| session_item(session, &names))
            .collect(),
    }
}

fn session_item(session: LiveSession, names: &HashMap<Uuid, String>) -> SessionItem {
    SessionItem {
        session_id: session.session_id,
        zone_id: session.zone_id,
        started_at: session.started_at,
        participants: session
            .participant_ids
            .into_iter()
            .map(|user_id| SessionParticipant {
                user_id,
                username: names
                    .get(&user_id)
                    .cloned()
                    .unwrap_or_else(|| "Former member".to_string()),
            })
            .collect(),
        leaving_deadlines: session.leaving_deadlines,
    }
}

fn invite_data(invite: PresenceInvite, token: Option<String>) -> InviteData {
    InviteData {
        id: invite.id,
        room_id: invite.room_id,
        invite_url_token: token,
        expires_at: invite.expires_at,
        revoked_at: invite.revoked_at,
        used_count: invite.used_count,
        created_at: invite.created_at,
    }
}

fn map_repo_error(error: anyhow::Error) -> PresenceApiError {
    let message = error.to_string();
    if message.contains("name must") || message.contains("expires_in_seconds") {
        PresenceApiError::bad_request(message)
    } else if message.contains("duplicate") || message.contains("unique") {
        PresenceApiError::conflict(message)
    } else {
        PresenceApiError::internal(message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn history_bounds_are_full_day_and_exclusive_at_end() {
        let (from, to) = history_bounds(Some("2026-01-01"), Some("2026-01-01"), Some("UTC"))
            .expect("valid range");
        assert_eq!(to - from, 86_400);
    }

    #[test]
    fn history_bounds_respect_bangkok_local_midnight() {
        let (from, to) =
            history_bounds(Some("2026-01-01"), Some("2026-01-01"), Some("Asia/Bangkok"))
                .expect("valid Bangkok range");
        assert_eq!(from as i64, 1_767_200_400);
        assert_eq!(to - from, 86_400);
    }

    #[test]
    fn history_bounds_reject_reversed_dates() {
        assert!(history_bounds(Some("2026-01-02"), Some("2026-01-01"), Some("UTC")).is_err());
    }

    #[test]
    fn history_bounds_reject_invalid_timezone() {
        assert!(history_bounds(
            Some("2026-01-01"),
            Some("2026-01-01"),
            Some("Not/A-Timezone"),
        )
        .is_err());
    }
}

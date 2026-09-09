// src/handlers/v1/presence.rs
//
// Live coding presence (plan.md Phase 7) — prototype endpoints. See
// `infrastructure::presence_store` for what "prototype" means here: in-memory, single
// process. Rooms may optionally be labeled with a real team (plan.md 6.1/7.2) rather
// than free text — see `create_room` below.

use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures::stream::{self, Stream};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::infrastructure::presence_store::{JoinError, Point};
use crate::middleware::auth;

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

async fn username_for(
    state: &AppState,
    user_id: Uuid,
) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    state
        .user_service
        .get_current(user_id)
        .await
        .map(|resp| resp.data.username)
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /presence/rooms
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Default, Deserialize)]
pub struct CreateRoomPayload {
    /// If set, the room is labeled with this team's real name (looked up server-side,
    /// never trusted from the client as free text) — see plan.md's note on why a
    /// "shortcut" free-text label was rejected in favor of this.
    pub team_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct CreateRoomResponse {
    pub room_id: Uuid,
}

pub async fn create_room(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Option<Json<CreateRoomPayload>>,
) -> Result<Json<CreateRoomResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    let username = username_for(&state, user_id).await?;

    let team_id = body.and_then(|Json(payload)| payload.team_id);
    let team_name = match team_id {
        Some(team_id) => Some(resolve_team_name(&state, team_id, user_id).await?),
        None => None,
    };

    let room_id = state
        .presence
        .create_room(user_id, username, team_id, team_name)
        .await;

    Ok(Json(CreateRoomResponse { room_id }))
}

/// Shared by `create_room`: a team label is only ever taken from a team the caller is
/// actually a member of — this is what makes the label "real" instead of decorative
/// text anyone could type.
async fn resolve_team_name(
    state: &AppState,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    let is_member = state
        .team_service
        .is_member(team_id, user_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;
    if !is_member {
        return Err(app_error(
            StatusCode::FORBIDDEN,
            "you are not a member of that team",
        ));
    }

    let team = state
        .team_service
        .get(team_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?
        .ok_or_else(|| app_error(StatusCode::NOT_FOUND, "team not found"))?;

    Ok(team.name)
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /presence/rooms/:room_id/join
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct RoomActionResponse {
    pub status: &'static str,
}

pub async fn join_room(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Json<RoomActionResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    let username = username_for(&state, user_id).await?;

    state
        .presence
        .join_room(room_id, user_id, username)
        .await
        .map_err(|JoinError::RoomNotFound| app_error(StatusCode::NOT_FOUND, "room not found"))?;

    Ok(Json(RoomActionResponse { status: "joined" }))
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /presence/rooms/:room_id/leave
// ──────────────────────────────────────────────────────────────────────────────

pub async fn leave_room(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Json<RoomActionResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;

    state.presence.leave_room(room_id, user_id).await;

    // A co-working session this person was part of in this room ends (or shrinks) the
    // moment they leave the room entirely — not gated behind the 3-minute drag-apart
    // grace period, which only applies to still being *in* the room but visually apart.
    state
        .coworking_session_service
        .leave(room_id, user_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(RoomActionResponse { status: "left" }))
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /presence/rooms/:room_id/position
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdatePositionPayload {
    pub x: f64,
    pub y: f64,
}

/// Called on drag *end* only, not on every pointer-move frame — see `room-canvas.tsx`.
/// This is what makes character positions a genuinely shared canvas (every viewer's SSE
/// stream reflects it) instead of the earlier prototype's per-browser-only positioning.
pub async fn update_position(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<UpdatePositionPayload>,
) -> Result<Json<RoomActionResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;

    let accepted = state
        .presence
        .update_position(
            room_id,
            user_id,
            Point {
                x: payload.x,
                y: payload.y,
            },
        )
        .await;

    if !accepted {
        return Err(app_error(
            StatusCode::NOT_FOUND,
            "join this room before updating your position in it",
        ));
    }

    Ok(Json(RoomActionResponse { status: "ok" }))
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /presence/rooms/:room_id/sessions  (plan.md 7.4 — group co-working sessions)
// ──────────────────────────────────────────────────────────────────────────────
//
// No client ever sees or chooses a `session_id` for this feature — it is entirely
// inferred from "these two people are close together in this room right now", which is
// why this is shaped as "start or join with this person" rather than plan.md's original
// sketch of a generic `/sessions` resource the client creates and joins by id. The
// clustering logic that decides whether this extends an existing session or starts a
// new one lives in `CoworkingSessionService::start_or_join`.

#[derive(Debug, Deserialize)]
pub struct StartSessionPayload {
    pub with_user_id: Uuid,
}

pub async fn start_or_join_session(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<StartSessionPayload>,
) -> Result<Json<RoomActionResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;

    let both_in_room = state.presence.is_member(room_id, user_id).await
        && state
            .presence
            .is_member(room_id, payload.with_user_id)
            .await;
    if !both_in_room {
        return Err(app_error(
            StatusCode::FORBIDDEN,
            "both people must currently be members of this room",
        ));
    }

    let team_id = state
        .presence
        .snapshot(room_id)
        .await
        .and_then(|snapshot| snapshot.team_id);

    state
        .coworking_session_service
        .start_or_join(room_id, team_id, user_id, payload.with_user_id)
        .await
        .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e.to_string()))?;

    Ok(Json(RoomActionResponse { status: "ok" }))
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /presence/rooms/:room_id/sessions/leave
// ──────────────────────────────────────────────────────────────────────────────
//
// Separate from leaving the *room* (`leave_room` above already calls this too) — this is
// what the frontend calls after its 3-minute drag-apart grace period elapses with no
// reunion, per plan.md 7.4. The caller stays in the room; only their co-working session
// membership ends.

pub async fn leave_session(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Json<RoomActionResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;

    state
        .coworking_session_service
        .leave(room_id, user_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(RoomActionResponse { status: "left" }))
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /presence/rooms/:room_id/stream  (SSE)
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    /// Browser `EventSource` cannot set an `Authorization` header, so this one endpoint
    /// accepts a credential in the query string. It is a room-scoped ticket from
    /// `POST /presence/rooms/:room_id/stream-ticket` that expires in minutes — not the
    /// session token, which is account-wide and lives for a day and therefore has no
    /// business in a URL that proxies and browser history will retain. Callers that can
    /// set headers (any non-browser client) should send `Authorization: Bearer <token>`
    /// instead; that is checked first.
    ticket: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StreamTicketResponse {
    pub ticket: String,
    pub expires_in_seconds: u64,
}

// POST /presence/rooms/:room_id/stream-ticket
pub async fn create_stream_ticket(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Json<StreamTicketResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;

    // Membership is checked here as well as in `stream_presence`: a ticket should never
    // exist for a room the caller cannot already watch.
    if !state.presence.is_member(room_id, user_id).await {
        return Err(app_error(
            StatusCode::FORBIDDEN,
            "join this room before streaming its presence",
        ));
    }

    let ticket = state.presence.issue_stream_ticket(room_id, user_id).await;
    Ok(Json(StreamTicketResponse {
        ticket,
        expires_in_seconds: 300,
    }))
}

/// How often each open connection re-reads the room's state from the store and pushes
/// it to the client. This is a per-connection poll, not a server-wide broadcast: there
/// is no pubsub in the prototype, so every connected client independently re-samples the
/// same in-memory store on its own timer. That is fine at prototype scale (a handful of
/// people in a room) and is the first thing to change if this goes further than that.
const STREAM_TICK: Duration = Duration::from_secs(3);

pub async fn stream_presence(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    headers: HeaderMap,
    Query(query): Query<StreamQuery>,
) -> Result<
    Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>,
    (StatusCode, Json<serde_json::Value>),
> {
    let user_id = match auth::require_account_user(&state, &headers).await {
        Some(user_id) => user_id,
        None => {
            let ticket = query.ticket.as_deref().ok_or_else(auth::unauthorized)?;
            state
                .presence
                .resolve_stream_ticket(room_id, ticket)
                .await
                .ok_or_else(auth::unauthorized)?
        }
    };

    if !state.presence.is_member(room_id, user_id).await {
        return Err(app_error(
            StatusCode::FORBIDDEN,
            "join this room before streaming its presence",
        ));
    }

    let mut interval = tokio::time::interval(STREAM_TICK);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    // No `tokio-stream` dependency needed for this one call site: `Interval::tick` is
    // already an async method, so `unfold` can drive it directly.
    let events = stream::unfold(
        (state, room_id, interval),
        |(state, room_id, mut interval)| async move {
            interval.tick().await;

            let snapshot = state.presence.snapshot(room_id).await?;
            let body = serde_json::to_string(&snapshot).unwrap_or_else(|_| "null".to_string());

            Some((Ok(Event::default().data(body)), (state, room_id, interval)))
        },
    );

    Ok(Sse::new(events).keep_alive(KeepAlive::default()))
}

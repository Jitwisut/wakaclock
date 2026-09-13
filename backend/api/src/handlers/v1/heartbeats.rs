// src/handlers/v1/heartbeats.rs

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{str::FromStr, sync::Arc};
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::date_range::ResolvedRange;
use crate::model::heartbeat::HeartbeatRow;
use wakaclock_core::ai::{
    is_internal_marker, is_known_agent_id, is_placeholder, normalize_identity_provider,
};
use wakaclock_core::heartbeat::{
    resolve_attribution, ActivitySegment, ActorType, AttributionInput, Category, EntityType,
    Heartbeat, MAX_HEARTBEAT_REVISION,
};

// ──────────────────────────────────────────────────────────────────────────────
// Request / Response models
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct HeartbeatPayload {
    pub entity: String,
    pub entity_type: EntityType,
    pub time: f64,
    pub created_at: Option<String>,
    pub project: Option<String>,
    pub branch: Option<String>,
    #[serde(default)]
    pub head_revision: Option<String>,
    #[serde(default)]
    pub repository_id: Option<Uuid>,
    pub language: Option<String>,
    pub dependencies: Option<Vec<String>>,
    pub lines: Option<u32>,
    pub line_number: Option<u32>,
    pub cursor_position: Option<u32>,
    pub is_write: Option<bool>,
    pub category: Option<Category>,
    pub editor: Option<String>,
    pub operating_system: Option<String>,
    pub machine: Option<String>,
    pub user_agent: Option<String>,
    #[serde(default)]
    pub machine_name_hash: Option<String>,
    #[serde(default)]
    pub hostname_hash: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub feature_id: Option<String>,
    #[serde(default)]
    pub feature_name: Option<String>,
    #[serde(default)]
    pub heartbeat_id: Option<String>,
    /// Stable agent session scope used to prevent repair/canonical joins from
    /// crossing sessions that happen to reuse a tool event id.
    #[serde(default)]
    pub session_id: Option<String>,
    pub ast_language: Option<String>,
    pub ast_confidence: Option<f32>,
    pub keystrokes: Option<u32>,
    pub chars_added: Option<u32>,
    pub chars_deleted: Option<u32>,
    pub active_seconds: Option<f64>,
    #[serde(default)]
    pub activity_segments: Vec<ActivitySegment>,
    /// Compatibility label from actor-enum clients. It is never trusted to
    /// promote an identity; inferred/unknown values force the safe bucket below.
    #[serde(default)]
    pub actor_type: Option<String>,
    pub is_ai_generated: Option<bool>,
    pub ai_agent: Option<String>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
    #[serde(default)]
    pub identity_status: Option<String>,
    #[serde(default)]
    pub identity_reason: Option<String>,
    #[serde(default)]
    pub identity_source: Option<String>,
    #[serde(default)]
    pub identity_schema_version: Option<u8>,
    #[serde(default)]
    pub identity_turn_id: Option<String>,
    #[serde(default)]
    pub identity_message_id: Option<String>,
    pub ai_source: Option<String>,
    pub ai_confidence: Option<String>,
    pub ai_event_id: Option<String>,
    #[serde(default)]
    pub ai_change_id: Option<String>,
    /// Append-only correction revision. The server accepts a bounded value and
    /// canonical readers select the highest revision for the operation ID.
    #[serde(default)]
    pub revision: Option<u32>,
    #[serde(default)]
    pub prompt_character_count: Option<u64>,
    #[serde(default)]
    pub input_tokens: Option<u64>,
    #[serde(default)]
    pub output_tokens: Option<u64>,
    #[serde(default)]
    pub cache_read_tokens: Option<u64>,
    #[serde(default)]
    pub cache_write_tokens: Option<u64>,
    #[serde(default)]
    pub ai_subscription_plan: Option<String>,
    #[serde(default)]
    pub token_source: Option<String>,
    #[serde(default)]
    pub attribution_source: Option<String>,
    /// Canonical numeric actor confidence. Older clients used
    /// `attribution_confidence`; both are accepted at the transport boundary,
    /// but a conflicting pair is rejected.
    #[serde(default)]
    pub actor_confidence: Option<f32>,
    #[serde(default)]
    pub attribution_confidence: Option<f32>,
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
    pub human_lines_added: Option<u32>,
    pub human_lines_deleted: Option<u32>,
    pub unattributed_lines_added: Option<u32>,
    pub unattributed_lines_deleted: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct HeartbeatResponse {
    pub status: String,
    pub heartbeats_inserted: usize,
}

/// Query params for GET /heartbeats?date=YYYY-MM-DD&timezone=Asia/Bangkok
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub date: Option<String>,
    pub timezone: Option<String>,
}

/// Response สำหรับ GET /heartbeats
#[derive(Debug, Serialize)]
pub struct HeartbeatListResponse {
    pub date: String,
    pub total: usize,
    pub data: Vec<HeartbeatItem>,
}

/// 1 heartbeat ใน response list — เฉพาะ fields ที่ client ต้องการ
#[derive(Debug, Serialize)]
pub struct HeartbeatItem {
    pub entity: String,
    pub entity_type: String,
    pub time: f64,
    pub project: Option<String>,
    /// Null for history recorded before project identity existed (plan.md 9.3); PR 9.9
    /// backfills those.
    pub project_id: Option<Uuid>,
    pub branch: Option<String>,
    pub head_revision: Option<String>,
    pub repository_id: Option<Uuid>,
    pub language: Option<String>,
    pub is_write: bool,
    pub category: String,
    pub lines: Option<u32>,
    pub line_number: Option<u32>,
    pub cursor_position: Option<u32>,
    pub dependencies: Vec<String>,
    pub ast_language: Option<String>,
    pub ast_confidence: Option<f32>,
    pub active_seconds: Option<f64>,
    pub is_ai_generated: bool,
    pub ai_agent: Option<String>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
    pub identity_status: Option<String>,
    pub identity_reason: Option<String>,
    pub identity_source: Option<String>,
    pub identity_schema_version: Option<u8>,
    pub identity_turn_id: Option<String>,
    pub identity_message_id: Option<String>,
    pub ai_source: Option<String>,
    pub ai_confidence: Option<String>,
    pub ai_event_id: Option<String>,
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
    pub human_lines_added: Option<u32>,
    pub human_lines_deleted: Option<u32>,
    pub unattributed_lines_added: Option<u32>,
    pub unattributed_lines_deleted: Option<u32>,
    pub editor: String,
    pub operating_system: String,
    pub machine: String,
    pub heartbeat_id: Option<String>,
    pub session_id: Option<String>,
    pub activity_segments: Vec<ActivitySegment>,
    /// Compatibility actor label retained for old API consumers.
    pub actor_type: String,
    /// Confidence for the projected actor state. This is additive so older clients
    /// can continue to consume the response while newer clients stop inferring it
    /// from the legacy boolean and string fields.
    pub actor_confidence: f32,
}

// ──────────────────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────────────────

/// Best-effort presence liveness after a heartbeat write actually inserted something.
///
/// Feeds the in-memory prototype store *and*, when Presence v2 is enabled, the Redis
/// key `derive_state_at` reads — so a `/api/v2` coworking roster flips the caller to
/// "coding" just from logging time, without the client having to also send
/// `POST /api/v2/me/presence/heartbeat`. Neither call may fail or delay the response;
/// presence is a social feature, time tracking is not.
async fn record_presence_activity(state: &AppState, user_id: Uuid) {
    state.presence.record_heartbeat(user_id).await;
    if let Some(redis_presence) = &state.redis_presence {
        if let Err(error) = redis_presence.heartbeat(user_id).await {
            tracing::debug!(%user_id, %error, "presence v2 liveness ping failed");
        }
    }
}

/// POST /api/v1/heartbeats — single heartbeat
pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<HeartbeatPayload>,
) -> Result<Json<HeartbeatResponse>, (StatusCode, HeaderMap, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(|| with_headers(auth::unauthorized()))?;
    if !auth::require_scope(&state, &headers, "write_logged_time").await {
        return Err(with_headers(auth::forbidden_scope("write_logged_time")));
    }
    require_active_access(&state, user_id)
        .await
        .map_err(with_headers)?;
    let mut heartbeat = payload_to_heartbeat(payload, user_id)
        .map_err(|e| with_headers(app_error(StatusCode::BAD_REQUEST, &e)))?;
    state
        .heartbeat_ingest_service
        .assign_server_ids(user_id, std::slice::from_mut(&mut heartbeat));
    let heartbeat = resolve_heartbeat_project(&state, user_id, heartbeat)
        .await
        .map_err(|e| with_headers(app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())))?;

    heartbeat
        .validate()
        .map_err(|e| with_headers(app_error(StatusCode::BAD_REQUEST, &e)))?;

    let inserted = state
        .heartbeat_ingest_service
        .process(user_id, "".to_string(), vec![heartbeat])
        .await
        .map_err(|e| {
            if state.config.brokers.ingest.mode == crate::config::brokers::IngestMode::Kafka
                && state
                    .config
                    .brokers
                    .ingest
                    .kafka_cohort
                    .as_ref()
                    .is_some_and(|cohort| cohort.includes(user_id))
            {
                kafka_unavailable()
            } else {
                with_headers(app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))
            }
        })?;

    // Presence: best-effort, and deliberately after the ClickHouse write succeeds — a
    // presence update is not a reason to fail or delay a heartbeat.
    if inserted > 0 {
        record_presence_activity(&state, user_id).await;
    }

    Ok(Json(HeartbeatResponse {
        status: "ok".to_string(),
        heartbeats_inserted: inserted,
    }))
}

/// POST /api/v1/heartbeats.bulk — หลาย heartbeats
pub async fn create_bulk(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payloads): Json<Vec<HeartbeatPayload>>,
) -> Result<Json<HeartbeatResponse>, (StatusCode, HeaderMap, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(|| with_headers(auth::unauthorized()))?;
    if !auth::require_scope(&state, &headers, "write_logged_time").await {
        return Err(with_headers(auth::forbidden_scope("write_logged_time")));
    }
    require_active_access(&state, user_id)
        .await
        .map_err(with_headers)?;

    if payloads.len() > 1000 {
        return Err(with_headers(app_error(
            StatusCode::BAD_REQUEST,
            "at most 1000 heartbeats per request",
        )));
    }
    let mut heartbeats: Vec<Heartbeat> = payloads
        .into_iter()
        .map(|p| payload_to_heartbeat(p, user_id))
        .collect::<Result<_, _>>()
        .map_err(|e| with_headers(app_error(StatusCode::BAD_REQUEST, &e)))?;
    state
        .heartbeat_ingest_service
        .assign_server_ids(user_id, &mut heartbeats);

    let mut resolved = Vec::with_capacity(heartbeats.len());
    for heartbeat in heartbeats.drain(..) {
        let heartbeat = resolve_heartbeat_project(&state, user_id, heartbeat)
            .await
            .map_err(|e| with_headers(app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string())))?;
        resolved.push(heartbeat);
    }
    let heartbeats = resolved;

    for hb in &heartbeats {
        hb.validate()
            .map_err(|e| with_headers(app_error(StatusCode::BAD_REQUEST, &e)))?;
    }

    let count = state
        .heartbeat_ingest_service
        .process(user_id, "".to_string(), heartbeats)
        .await
        .map_err(|e| {
            if state.config.brokers.ingest.mode == crate::config::brokers::IngestMode::Kafka
                && state
                    .config
                    .brokers
                    .ingest
                    .kafka_cohort
                    .as_ref()
                    .is_some_and(|cohort| cohort.includes(user_id))
            {
                kafka_unavailable()
            } else {
                with_headers(app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))
            }
        })?;

    // See the same call in `create` above. Guarded on `count` so an empty batch — which
    // sent zero actual heartbeats — does not mark the user as having just been active.
    if count > 0 {
        record_presence_activity(&state, user_id).await;
    }

    Ok(Json(HeartbeatResponse {
        status: "ok".to_string(),
        heartbeats_inserted: count,
    }))
}

#[derive(Debug, Deserialize)]
pub struct DeleteBulkPayload {
    #[serde(default, alias = "ids")]
    pub heartbeat_ids: Vec<String>,
}

/// DELETE /api/v1/heartbeats.bulk. Deletion is asynchronous in ClickHouse;
/// the returned count is the number of ids accepted for deletion.
pub async fn delete_bulk(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<DeleteBulkPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_logged_time").await {
        return Err(auth::forbidden_scope("write_logged_time"));
    }
    if payload.heartbeat_ids.len() > 1000 {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            "at most 1000 heartbeat ids may be deleted",
        ));
    }
    let ids: Vec<String> = payload
        .heartbeat_ids
        .into_iter()
        .filter(|id| !id.trim().is_empty() && id.len() <= 256)
        .collect();
    let accepted = state
        .heartbeat_repo
        .delete_ids(user_id, &ids)
        .await
        .map_err(|error| app_error(StatusCode::SERVICE_UNAVAILABLE, &error.to_string()))?;
    Ok(Json(
        json!({ "status": "ok", "heartbeats_deleted": accepted }),
    ))
}

/// GET /api/v1/heartbeats?date=2026-04-10&user_id=...
pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<ListQuery>,
) -> Result<Json<HeartbeatListResponse>, (StatusCode, Json<serde_json::Value>)> {
    let date = match params.date {
        Some(date) => date,
        None => ResolvedRange::today_date_string(params.timezone.as_deref())
            .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?,
    };
    let range = ResolvedRange::parse(&date, &date, params.timezone.as_deref())
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;

    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "read_logged_time").await {
        return Err(auth::forbidden_scope("read_logged_time"));
    }

    let rows = state
        .heartbeat_service
        .get_by_date(user_id, &range)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    let items: Vec<HeartbeatItem> = rows
        .into_iter()
        .map(|mut r| {
            // The stored actor enum is canonical for reads. Legacy booleans and
            // metadata are used only to validate a verified identity or to safely
            // downgrade a malformed verified row; they never promote `unknown`.
            let stored_actor_type = r.actor_type.parse().unwrap_or_default();
            let verified_identity = row_has_verified_identity(&r);
            let projection = project_history_attribution(HistoryAttributionInput {
                stored_actor_type,
                stored_confidence: r.actor_confidence,
                has_ai_evidence: row_has_ai_evidence(&r),
                verified_identity,
                identity_status: r.identity_status.as_deref(),
                identity_source: r.identity_source.as_deref(),
                ai_agent: r.ai_agent.as_deref(),
                ai_source: r.ai_source.as_deref(),
                ai_confidence: r.ai_confidence.as_deref(),
            });

            // Only a verified actor may expose identity. Inferred rows retain a
            // useful compatibility marker without leaking an arbitrary label;
            // human/unknown rows do not carry stale AI labels into the response.
            match projection.actor_type {
                ActorType::AiVerified => {}
                ActorType::AiInferred => {
                    r.ai_agent = None;
                    r.ai_provider = None;
                    r.ai_model = None;
                    r.ai_confidence = Some("inferred".to_string());
                    r.ai_source = Some("observer".to_string());
                }
                ActorType::Human | ActorType::Unknown => {
                    r.ai_agent = None;
                    r.ai_provider = None;
                    r.ai_model = None;
                    r.identity_status = None;
                    r.identity_reason = None;
                    r.identity_source = None;
                    r.identity_schema_version = None;
                    r.identity_turn_id = None;
                    r.identity_message_id = None;
                    r.ai_confidence = None;
                    r.ai_source = None;
                }
            }
            HeartbeatItem {
                // History is still owner-scoped, but the response must not become a path
                // exfiltration endpoint. Keep project-relative names where possible and reduce
                // legacy absolute/traversal rows to a safe basename.
                entity: sanitize_entity(&r.entity),
                entity_type: r.entity_type,
                time: r.time,
                project: r.project,
                project_id: r.project_id,
                branch: r.branch,
                head_revision: r.head_revision,
                repository_id: r.repository_id,
                language: r.language,
                is_write: r.is_write,
                category: r.category,
                lines: r.lines,
                line_number: r.line_number,
                cursor_position: r.cursor_position,
                dependencies: r.dependencies,
                ast_language: r.ast_language,
                ast_confidence: r.ast_confidence,
                active_seconds: r.active_seconds,
                heartbeat_id: r.heartbeat_id,
                session_id: r.session_id,
                activity_segments: serde_json::from_str(&r.activity_segments).unwrap_or_default(),
                is_ai_generated: projection.is_ai_generated,
                ai_agent: r.ai_agent,
                ai_provider: r.ai_provider,
                ai_model: r.ai_model,
                identity_status: r.identity_status,
                identity_reason: r.identity_reason,
                identity_source: r.identity_source,
                identity_schema_version: r.identity_schema_version,
                identity_turn_id: r.identity_turn_id,
                identity_message_id: r.identity_message_id,
                ai_source: r.ai_source,
                ai_confidence: r.ai_confidence,
                ai_event_id: r.ai_event_id,
                ai_lines_added: r.ai_lines_added,
                ai_lines_deleted: r.ai_lines_deleted,
                human_lines_added: r.human_lines_added,
                human_lines_deleted: r.human_lines_deleted,
                unattributed_lines_added: r.unattributed_lines_added,
                unattributed_lines_deleted: r.unattributed_lines_deleted,
                editor: r.editor,
                operating_system: r.operating_system,
                machine: r.machine,
                actor_type: projection.actor_type.as_str().to_string(),
                actor_confidence: projection.actor_confidence,
            }
        })
        .collect();

    Ok(Json(HeartbeatListResponse {
        total: items.len(),
        date,
        data: items,
    }))
}

fn sanitize_entity(entity: &str) -> String {
    let normalized = entity.replace('\\', "/");
    let absolute = normalized.starts_with('/') || normalized.as_bytes().get(1) == Some(&b':');
    let traversal = normalized.split('/').any(|part| part == "..");
    let value = if absolute || traversal {
        normalized
            .rsplit('/')
            .find(|part| !part.is_empty() && *part != "." && *part != "..")
            .unwrap_or("Unknown")
    } else {
        &normalized
    };
    let sanitized: String = value
        .chars()
        .filter(|character| !character.is_control())
        .collect();
    if sanitized.is_empty() {
        "Unknown".to_string()
    } else {
        sanitized
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct HistoryAttributionProjection {
    actor_type: ActorType,
    actor_confidence: f32,
    is_ai_generated: bool,
}

#[derive(Debug, Clone, Copy)]
struct HistoryAttributionInput<'a> {
    stored_actor_type: ActorType,
    stored_confidence: f32,
    has_ai_evidence: bool,
    verified_identity: bool,
    identity_status: Option<&'a str>,
    identity_source: Option<&'a str>,
    ai_agent: Option<&'a str>,
    ai_source: Option<&'a str>,
    ai_confidence: Option<&'a str>,
}

/// Project a stored heartbeat into the public history contract.
///
/// `actor_type` is intentionally authoritative here. The legacy AI fields are
/// evidence for validating a verified identity and for downgrading a spoofed
/// `ai_verified` row, but they cannot turn an explicit `unknown` row into AI.
fn project_history_attribution(input: HistoryAttributionInput<'_>) -> HistoryAttributionProjection {
    let HistoryAttributionInput {
        stored_actor_type,
        stored_confidence,
        has_ai_evidence,
        verified_identity,
        identity_status,
        identity_source,
        ai_agent,
        ai_source,
        ai_confidence,
    } = input;
    let trusted_partial_identity = matches!(
        identity_status.map(|value| value.trim().to_ascii_lowercase()).as_deref(),
        Some("partial" | "conflict")
    ) && ai_agent.is_some_and(is_known_agent_id)
        && identity_source
            .or(ai_source)
            .is_some_and(is_verified_ai_source);
    let actor_type = match stored_actor_type {
        ActorType::AiVerified if verified_identity => ActorType::AiVerified,
        // Identity completeness is a separate dimension. A transcript can prove
        // that a known AI agent made the edit while the provider/model is missing;
        // keep that actor evidence as AI verified and expose the missing tuple via
        // `identity_status` instead of silently downgrading the activity.
        ActorType::AiVerified if has_ai_evidence && trusted_partial_identity => {
            ActorType::AiVerified
        }
        ActorType::AiVerified if has_ai_evidence => ActorType::AiInferred,
        ActorType::AiVerified => ActorType::Unknown,
        actor_type => actor_type,
    };

    // A confidence value belongs to the projected actor. Do not carry a verified
    // value across a downgrade, and treat zero/non-finite legacy defaults as
    // missing for actors that have positive confidence by definition.
    let stored_confidence_is_usable = stored_actor_type == actor_type
        && stored_confidence.is_finite()
        && (0.0..=1.0).contains(&stored_confidence)
        && (stored_confidence > 0.0 || actor_type == ActorType::Unknown);
    let actor_confidence = if actor_type == ActorType::Unknown {
        0.0
    } else if stored_confidence_is_usable {
        stored_confidence
    } else {
        actor_type.default_confidence(ai_source, ai_confidence)
    };

    HistoryAttributionProjection {
        actor_type,
        actor_confidence,
        is_ai_generated: actor_type.is_ai(),
    }
}

fn row_has_verified_identity(row: &HeartbeatRow) -> bool {
    row.is_ai_generated
        && row
            .identity_status
            .as_deref()
            .is_some_and(|status| status.trim().eq_ignore_ascii_case("confirmed"))
        && row
            .identity_reason
            .as_deref()
            .map(|reason| reason.trim().is_empty())
            .unwrap_or(true)
        && row
            .ai_agent
            .as_deref()
            .is_some_and(|agent| !agent.trim().is_empty() && is_known_agent_id(agent))
        && row
            .ai_provider
            .as_deref()
            .is_some_and(|provider| {
                normalize_identity_provider(Some(provider)).is_some()
                    && !provider.trim().is_empty()
                    && !is_internal_marker(provider)
                    && !is_placeholder(provider)
            })
        && row
            .ai_model
            .as_deref()
            .is_some_and(|model| {
                !model.trim().is_empty()
                    && !is_internal_marker(model)
                    && !is_placeholder(model)
            })
        && row
            .ai_confidence
            .as_deref()
            .is_some_and(|value| {
                value.trim().eq_ignore_ascii_case("verified")
                    || value.trim().eq_ignore_ascii_case("correlated")
            })
        && row
            .identity_source
            .as_deref()
            .or(row.ai_source.as_deref())
            .is_some_and(is_verified_ai_source)
}

fn row_has_ai_evidence(row: &HeartbeatRow) -> bool {
    row.is_ai_generated
        || row.ai_agent.as_deref().is_some_and(has_non_sentinel_value)
        || row
            .ai_event_id
            .as_deref()
            .is_some_and(has_non_sentinel_value)
        || row.ai_lines_added.is_some_and(|value| value > 0)
        || row.ai_lines_deleted.is_some_and(|value| value > 0)
        || row.ai_source.as_deref().is_some_and(is_verified_ai_source)
}

fn has_non_sentinel_value(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty()
        && !is_internal_marker(value)
        && !matches!(
            value.to_ascii_lowercase().as_str(),
            "unknown" | "<unknown>" | "null" | "undefined" | "not reported"
        )
}

fn is_verified_ai_source(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "agent_hook" | "mcp" | "structured_mcp" | "transcript"
    )
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/// Heartbeat ingestion is the one action gated on subscription status — it's the only
/// thing that actually costs anything to keep accepting. Everything else (reading
/// existing history, project rules, etc.) stays reachable even after a trial lapses,
/// so a lapsed customer can still see their data and decide whether to resubscribe.
async fn require_active_access(
    state: &AppState,
    user_id: Uuid,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let has_access = state
        .user_service
        .has_active_access(user_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    if has_access {
        Ok(())
    } else {
        Err(auth::payment_required())
    }
}

fn payload_to_heartbeat(p: HeartbeatPayload, user_id: Uuid) -> Result<Heartbeat, String> {
    if p.revision.unwrap_or(0) > MAX_HEARTBEAT_REVISION {
        return Err("revision exceeds the supported bound".to_string());
    }
    let explicit_actor_type = p
        .actor_type
        .as_deref()
        .map(ActorType::from_str)
        .transpose()?;
    let legacy_inferred = explicit_actor_type == Some(ActorType::AiInferred);
    let legacy_unknown = explicit_actor_type == Some(ActorType::Unknown);
    let legacy_is_ai_generated = p.is_ai_generated;
    let explicit_confidence = match (p.actor_confidence, p.attribution_confidence) {
        (Some(actor), Some(attribution)) if actor.to_bits() != attribution.to_bits() => {
            return Err("actor_confidence conflicts with attribution_confidence".to_string());
        }
        (Some(actor), _) => Some(actor),
        (_, attribution) => attribution,
    };
    let has_legacy_ai_claim = p.ai_agent.is_some()
        || p.ai_provider.is_some()
        || p.ai_model.is_some()
        || p.ai_event_id.is_some()
        || p.ai_source
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || p.ai_confidence
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || p.is_ai_generated == Some(true)
        || p.ai_lines_added.is_some_and(|value| value > 0)
        || p.ai_lines_deleted.is_some_and(|value| value > 0);
    let legacy_unattributed = legacy_inferred || (legacy_unknown && has_legacy_ai_claim);

    // `unknown` was used by older clients as a compatibility label for an AI
    // observation whose identity was not proven. Keep that safe interpretation,
    // but do not feed the explicit enum back into the resolver alongside the
    // positive AI evidence (the canonical contract correctly rejects that
    // contradiction). Explicit `ai_verified` is accepted only when the payload
    // itself carries the same proof that the resolver would require.
    let has_verified_resolver_evidence = p
        .ai_agent
        .as_deref()
        .is_some_and(|agent| !agent.trim().is_empty() && is_known_agent_id(agent))
        && p.ai_source.as_deref().is_some_and(|source| {
            let normalized = source.trim().to_ascii_lowercase();
            matches!(
                normalized.as_str(),
                "agent_hook" | "mcp" | "structured_mcp" | "transcript"
            ) && (p
                .ai_confidence
                .as_deref()
                .is_some_and(|confidence| confidence.trim().eq_ignore_ascii_case("verified"))
                || matches!(normalized.as_str(), "agent_hook" | "mcp"))
        });
    let resolver_actor_type = match explicit_actor_type {
        Some(ActorType::Unknown) if legacy_unattributed => None,
        Some(ActorType::AiVerified) if !has_verified_resolver_evidence => None,
        actor => actor,
    };
    let has_ai_metadata = has_legacy_ai_claim || explicit_actor_type.is_some_and(ActorType::is_ai);
    let positive_editor_evidence = !has_ai_metadata
        && (p.is_write == Some(true)
            || p.activity_segments.iter().any(|segment| {
                segment.source.as_deref().is_some_and(|source| {
                    source.eq_ignore_ascii_case("human") || source.eq_ignore_ascii_case("editor")
                })
            }));
    let date = Heartbeat::date_from_time(p.time);
    let created_at = p
        .created_at
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    let mut heartbeat = Heartbeat {
        user_id,
        entity: p.entity,
        entity_type: p.entity_type,
        time: p.time,
        date,
        project: p.project,
        // Resolved server-side in `resolve_heartbeat_project`, never taken from the client.
        project_id: None,
        branch: p.branch,
        head_revision: p.head_revision,
        repository_id: p.repository_id,
        language: p.language,
        dependencies: p.dependencies.unwrap_or_default(),
        lines: p.lines,
        line_number: p.line_number,
        cursor_position: p.cursor_position,
        is_write: p.is_write.unwrap_or(false),
        category: p.category.unwrap_or(Category::Coding),
        editor: p.editor.unwrap_or_default(),
        operating_system: p.operating_system.unwrap_or_default(),
        machine: p.machine.unwrap_or_default(),
        user_agent: p.user_agent.unwrap_or_else(|| "wakaclock/1.0".to_string()),
        machine_name_hash: p.machine_name_hash,
        hostname_hash: p.hostname_hash,
        timezone: p.timezone,
        feature_id: p.feature_id,
        feature_name: p.feature_name,
        heartbeat_id: p.heartbeat_id,
        session_id: p.session_id,
        ast_language: p.ast_language,
        ast_confidence: p.ast_confidence,
        keystrokes: p.keystrokes,
        chars_added: p.chars_added,
        chars_deleted: p.chars_deleted,
        // Clipboard tracking has no wire representation in `HeartbeatPayload` yet.
        clipboard_tracking_version: None,
        copy_actions: None,
        paste_actions: None,
        copied_chars: None,
        copied_lines: None,
        pasted_chars: None,
        pasted_lines: None,
        paste_same_file_actions: None,
        paste_same_workspace_actions: None,
        paste_external_or_unknown_actions: None,
        active_seconds: p.active_seconds,
        activity_segments: p.activity_segments,
        // Set below, after `enforce_attribution_policy` has normalized the legacy
        // string fields this enum must agree with.
        actor_type: ActorType::default(),
        actor_confidence: 0.0,
        // An agent name is authoritative. This prevents a malformed client from
        // sending `ai_agent` with `is_ai_generated: false` and having the same edit
        // counted as human by the materialized view.
        is_ai_generated: p.ai_agent.is_some() || p.is_ai_generated.unwrap_or(false),
        ai_agent: p.ai_agent,
        ai_provider: p.ai_provider,
        ai_model: p.ai_model,
        identity_status: p.identity_status,
        identity_reason: p.identity_reason,
        identity_source: p.identity_source,
        identity_schema_version: p.identity_schema_version,
        identity_turn_id: p.identity_turn_id,
        identity_message_id: p.identity_message_id,
        ai_source: p.ai_source,
        ai_confidence: p.ai_confidence,
        ai_event_id: p.ai_event_id,
        ai_change_id: p.ai_change_id,
        prompt_character_count: p.prompt_character_count,
        input_tokens: p.input_tokens,
        output_tokens: p.output_tokens,
        cache_read_tokens: p.cache_read_tokens,
        cache_write_tokens: p.cache_write_tokens,
        ai_subscription_plan: p.ai_subscription_plan,
        token_source: p.token_source,
        attribution_source: p.attribution_source,
        attribution_confidence: p.attribution_confidence,
        ai_lines_added: p.ai_lines_added,
        ai_lines_deleted: p.ai_lines_deleted,
        human_lines_added: p.human_lines_added,
        human_lines_deleted: p.human_lines_deleted,
        unattributed_lines_added: p.unattributed_lines_added,
        unattributed_lines_deleted: p.unattributed_lines_deleted,
        revision: p.revision.unwrap_or(0),
        created_at,
    };
    // Actor-enum clients may send an explicit inferred/unknown label. Honor that
    // compatibility signal before applying the generic source/confidence policy so
    // an old row cannot keep a stale name merely because it also carried
    // verified-looking strings from a pre-policy client.
    if legacy_unattributed {
        heartbeat.is_ai_generated = true;
        heartbeat.ai_agent = None;
        heartbeat.ai_provider = None;
        heartbeat.ai_model = None;
        heartbeat.ai_confidence = Some("inferred".to_string());
        heartbeat.ai_source = Some("observer".to_string());
        heartbeat.attribution_source = None;
        heartbeat.attribution_confidence = None;
    }

    let resolution = resolve_attribution(AttributionInput {
        explicit_actor_type: resolver_actor_type,
        explicit_confidence,
        legacy_is_ai_generated,
        ai_agent: heartbeat.ai_agent.as_deref(),
        ai_source: heartbeat.ai_source.as_deref(),
        ai_confidence: heartbeat.ai_confidence.as_deref(),
        ai_event_id: heartbeat.ai_event_id.as_deref(),
        ai_lines_added: heartbeat.ai_lines_added,
        ai_lines_deleted: heartbeat.ai_lines_deleted,
        human_lines_added: heartbeat.human_lines_added,
        human_lines_deleted: heartbeat.human_lines_deleted,
        unattributed_lines_added: heartbeat.unattributed_lines_added,
        unattributed_lines_deleted: heartbeat.unattributed_lines_deleted,
        keystrokes: heartbeat.keystrokes,
        chars_added: heartbeat.chars_added,
        chars_deleted: heartbeat.chars_deleted,
        positive_editor_evidence,
    })?;

    // The resolver treats an agent_hook/MCP source as verified evidence even when
    // an older client omitted the redundant confidence label. Populate that label
    // before the shared policy runs so the identity is retained consistently.
    if resolution.actor_type == ActorType::AiVerified && heartbeat.ai_confidence.is_none() {
        heartbeat.ai_confidence = Some("verified".to_string());
    }

    // Seed the heartbeat with the resolver's actor decision before applying the
    // shared policy.  The policy may then downgrade an untrusted identity to
    // inferred AI (or retain a trusted partial identity), and its result must be
    // the value that is persisted.  Do not overwrite it with the pre-policy
    // resolver result afterwards: that would re-promote a stripped legacy label.
    heartbeat.actor_type = resolution.actor_type;
    heartbeat.actor_confidence = resolution.confidence;
    // Unknown is deliberately separate from inferred AI. Keeping this legacy flag
    // derived from the canonical enum prevents `validate()` from accepting a row
    // whose dashboard bucket disagrees with its transport boolean.
    heartbeat.is_ai_generated = resolution.actor_type.is_ai();
    // Apply the same policy before validation and project resolution so old clients
    // cannot persist an unverified agent name through either single or bulk ingest.
    heartbeat.enforce_attribution_policy();
    // A legacy payload that only *names* an AI tool, without declaring an AI
    // activity flag or carrying a trusted adapter proof, remains unknown.  The
    // metadata is stripped above, but the server must not turn a weak observer
    // claim into an AI count merely because it passed through this endpoint.
    // Explicit `is_ai_generated: true` rows continue to use the inferred bucket.
    if resolution.actor_type == ActorType::Unknown
        && legacy_is_ai_generated != Some(true)
        && !has_verified_resolver_evidence
    {
        heartbeat.actor_type = ActorType::Unknown;
        heartbeat.actor_confidence = 0.0;
        heartbeat.is_ai_generated = false;
    }
    // Validate before project-rule/identity lookups.  Besides avoiding needless
    // ClickHouse work for malformed requests, this is important for broker mode:
    // an invalid heartbeat must never reach either the direct writer or Kafka.
    heartbeat.validate()?;
    Ok(heartbeat)
}

async fn resolve_heartbeat_project(
    state: &Arc<AppState>,
    user_id: Uuid,
    mut heartbeat: Heartbeat,
) -> anyhow::Result<Heartbeat> {
    heartbeat.project = state
        .project_rule_service
        .resolve_project(user_id, &heartbeat.entity, heartbeat.project.clone())
        .await?;

    // Identity is resolved after the name rules, not before: a rule can change which
    // project a heartbeat belongs to, and the id must follow the resolved name.  A
    // Kafka-cohort request deliberately leaves the ID for the fact-sink, so an API
    // replica can continue accepting data while ClickHouse is unavailable.  The
    // serialized event never trusts the client-provided ID.
    let kafka_cohort = state.config.brokers.ingest.mode
        == crate::config::brokers::IngestMode::Kafka
        && state
            .config
            .brokers
            .ingest
            .kafka_cohort
            .as_ref()
            .is_some_and(|cohort| cohort.includes(user_id));
    if !kafka_cohort {
        heartbeat.project_id = state
            .project_identity_service
            .resolve_project_id(user_id, heartbeat.project.as_deref(), None)
            .await?;
    }

    Ok(heartbeat)
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

fn with_headers(
    error: (StatusCode, Json<serde_json::Value>),
) -> (StatusCode, HeaderMap, Json<serde_json::Value>) {
    (error.0, HeaderMap::new(), error.1)
}

fn kafka_unavailable() -> (StatusCode, HeaderMap, Json<serde_json::Value>) {
    let mut headers = HeaderMap::new();
    headers.insert("retry-after", axum::http::HeaderValue::from_static("5"));
    (
        StatusCode::SERVICE_UNAVAILABLE,
        headers,
        Json(serde_json::json!({ "error": "heartbeat broker unavailable" })),
    )
}

#[cfg(test)]
mod tests {
    use super::{
        payload_to_heartbeat, project_history_attribution, sanitize_entity, HeartbeatItem,
        HeartbeatPayload, HistoryAttributionInput, MAX_HEARTBEAT_REVISION,
    };
    use serde_json::{json, Value};
    use uuid::Uuid;
    use wakaclock_core::heartbeat::ActorType;

    const DECISION_FIXTURE: &str =
        include_str!("../../../../../fixtures/ai-attribution/decision-v1.json");

    #[test]
    fn history_entity_redacts_absolute_and_traversal_paths() {
        assert_eq!(
            sanitize_entity("/Users/alice/project/src/main.rs"),
            "main.rs"
        );
        assert_eq!(
            sanitize_entity(r"C:\Users\alice\project\main.rs"),
            "main.rs"
        );
        assert_eq!(sanitize_entity("../../secrets.env"), "secrets.env");
        assert_eq!(sanitize_entity("src/main.rs"), "src/main.rs");
    }

    #[test]
    fn heartbeat_id_boundary_is_rejected_before_ingest() {
        let valid: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "heartbeat_id": "x".repeat(256)
        }))
        .unwrap();
        assert!(payload_to_heartbeat(valid, Uuid::nil()).is_ok());

        let invalid: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "heartbeat_id": "x".repeat(257)
        }))
        .unwrap();
        let error = payload_to_heartbeat(invalid, Uuid::nil()).unwrap_err();
        assert!(error.contains("heartbeat_id"));
    }

    #[test]
    fn legacy_unverified_ai_payload_is_stored_as_unattributed() {
        let payload: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "ai_agent": "codex",
            "ai_provider": "openai",
            "ai_model": "gpt-test",
            "ai_source": "ide_telemetry",
            "ai_confidence": "correlated",
            "ai_lines_added": 3
        }))
        .unwrap();

        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert!(!heartbeat.is_ai_generated);
        assert_eq!(heartbeat.actor_type, super::ActorType::Unknown);
        assert_eq!(heartbeat.actor_confidence, 0.0);
        assert!(heartbeat.ai_agent.is_none());
        assert!(heartbeat.ai_provider.is_none());
        assert!(heartbeat.ai_model.is_none());
        assert_eq!(heartbeat.ai_source.as_deref(), Some("observer"));
        assert_eq!(heartbeat.ai_confidence.as_deref(), Some("inferred"));
        heartbeat.validate().unwrap();
    }

    #[test]
    fn verified_hook_payload_keeps_identity() {
        let payload: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "ai_agent": "codex",
            "ai_provider": "openai",
            "ai_model": "gpt-test",
            "ai_source": "agent_hook",
            "ai_confidence": "verified",
            "ai_lines_added": 3,
            "session_id": "codex-session-1"
        }))
        .unwrap();

        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert!(heartbeat.is_ai_generated);
        assert_eq!(heartbeat.actor_type, super::ActorType::AiVerified);
        assert_eq!(heartbeat.actor_confidence, 1.0);
        assert_eq!(heartbeat.ai_agent.as_deref(), Some("codex"));
        assert_eq!(heartbeat.ai_provider.as_deref(), Some("openai"));
        assert_eq!(heartbeat.session_id.as_deref(), Some("codex-session-1"));
        heartbeat.validate().unwrap();
    }

    #[test]
    fn correction_revision_is_preserved_and_bounded() {
        let payload: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "heartbeat_id": "operation-1",
            "ai_change_id": "change-1",
            "revision": 2,
            "ai_agent": "codex",
            "ai_provider": "openai",
            "ai_source": "agent_hook",
            "ai_confidence": "verified",
            "ai_lines_added": 4
        }))
        .unwrap();
        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert_eq!(heartbeat.revision, 2);
        heartbeat.validate().unwrap();

        let oversized: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "revision": MAX_HEARTBEAT_REVISION + 1
        }))
        .unwrap();
        let error = payload_to_heartbeat(oversized, Uuid::nil()).unwrap_err();
        assert!(error.contains("revision exceeds"));
    }

    #[test]
    fn unknown_verified_label_is_stored_as_unattributed_ai() {
        let payload: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "ai_agent": "verify-declared",
            "ai_provider": "openai",
            "ai_model": "gpt-test",
            "ai_source": "agent_hook",
            "ai_confidence": "verified",
            "ai_lines_added": 3
        }))
        .unwrap();

        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert!(!heartbeat.is_ai_generated);
        assert_eq!(heartbeat.actor_type, super::ActorType::Unknown);
        assert_eq!(heartbeat.actor_confidence, 0.0);
        assert!(heartbeat.ai_agent.is_none());
        assert!(heartbeat.ai_provider.is_none());
        assert!(heartbeat.ai_model.is_none());
        assert_eq!(heartbeat.ai_source.as_deref(), Some("observer"));
        assert_eq!(heartbeat.ai_confidence.as_deref(), Some("inferred"));
        heartbeat.validate().unwrap();
    }

    #[test]
    fn legacy_actor_enum_cannot_override_the_identity_boundary() {
        let payload: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "actor_type": "ai_inferred",
            "ai_agent": "codex",
            "ai_provider": "openai",
            "ai_model": "gpt-test",
            "ai_source": "agent_hook",
            "ai_confidence": "verified",
            "ai_lines_added": 3
        }))
        .unwrap();

        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert!(heartbeat.is_ai_generated);
        assert_eq!(heartbeat.actor_type, super::ActorType::AiInferred);
        assert_eq!(heartbeat.actor_confidence, 0.6);
        assert!(heartbeat.ai_agent.is_none());
        assert!(heartbeat.ai_provider.is_none());
        assert!(heartbeat.ai_model.is_none());
        assert_eq!(heartbeat.ai_source.as_deref(), Some("observer"));
        heartbeat.validate().unwrap();
    }

    #[test]
    fn positive_editor_write_resolves_human_without_ai_metadata() {
        let payload: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "is_write": true
        }))
        .unwrap();

        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert_eq!(heartbeat.actor_type, super::ActorType::Human);
        assert_eq!(heartbeat.actor_confidence, 1.0);
        assert!(!heartbeat.is_ai_generated);
        heartbeat.validate().unwrap();
    }

    #[test]
    fn conflicting_confidence_fields_are_rejected() {
        let payload: HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "actor_confidence": 1.0,
            "attribution_confidence": 0.5
        }))
        .unwrap();

        let error = payload_to_heartbeat(payload, Uuid::nil()).unwrap_err();
        assert!(error.contains("conflicts"));
    }

    #[test]
    fn history_projection_keeps_canonical_actor_buckets() {
        struct Case {
            name: &'static str,
            stored_actor_type: ActorType,
            stored_confidence: f32,
            has_ai_evidence: bool,
            verified_identity: bool,
            expected_actor_type: ActorType,
            expected_confidence: f32,
            expected_is_ai_generated: bool,
        }

        let cases = [
            Case {
                name: "unknown does not get promoted by stale AI evidence",
                stored_actor_type: ActorType::Unknown,
                stored_confidence: 0.0,
                has_ai_evidence: true,
                verified_identity: true,
                expected_actor_type: ActorType::Unknown,
                expected_confidence: 0.0,
                expected_is_ai_generated: false,
            },
            Case {
                name: "verified identity survives",
                stored_actor_type: ActorType::AiVerified,
                stored_confidence: 0.95,
                has_ai_evidence: true,
                verified_identity: true,
                expected_actor_type: ActorType::AiVerified,
                expected_confidence: 0.95,
                expected_is_ai_generated: true,
            },
            Case {
                name: "spoofed verified identity downgrades to inferred",
                stored_actor_type: ActorType::AiVerified,
                stored_confidence: 1.0,
                has_ai_evidence: true,
                verified_identity: false,
                expected_actor_type: ActorType::AiInferred,
                expected_confidence: 0.6,
                expected_is_ai_generated: true,
            },
            Case {
                name: "verified row without evidence becomes unknown",
                stored_actor_type: ActorType::AiVerified,
                stored_confidence: 1.0,
                has_ai_evidence: false,
                verified_identity: false,
                expected_actor_type: ActorType::Unknown,
                expected_confidence: 0.0,
                expected_is_ai_generated: false,
            },
            Case {
                name: "stored inferred actor remains inferred",
                stored_actor_type: ActorType::AiInferred,
                stored_confidence: 0.0,
                has_ai_evidence: false,
                verified_identity: false,
                expected_actor_type: ActorType::AiInferred,
                expected_confidence: 0.6,
                expected_is_ai_generated: true,
            },
            Case {
                name: "stored human actor gets its legacy default confidence",
                stored_actor_type: ActorType::Human,
                stored_confidence: 0.0,
                has_ai_evidence: true,
                verified_identity: false,
                expected_actor_type: ActorType::Human,
                expected_confidence: 1.0,
                expected_is_ai_generated: false,
            },
        ];

        for case in cases {
            let projection = project_history_attribution(HistoryAttributionInput {
                stored_actor_type: case.stored_actor_type,
                stored_confidence: case.stored_confidence,
                has_ai_evidence: case.has_ai_evidence,
                verified_identity: case.verified_identity,
                identity_status: None,
                identity_source: None,
                ai_agent: None,
                ai_source: Some("mcp"),
                ai_confidence: Some("verified"),
            });
            assert_eq!(
                projection.actor_type, case.expected_actor_type,
                "actor for {}",
                case.name
            );
            assert_eq!(
                projection.actor_confidence, case.expected_confidence,
                "confidence for {}",
                case.name
            );
            assert_eq!(
                projection.is_ai_generated, case.expected_is_ai_generated,
                "legacy boolean for {}",
                case.name
            );
        }
    }

    #[test]
    fn history_item_serializes_projected_actor_confidence() {
        let item = HeartbeatItem {
            entity: "src/main.rs".to_string(),
            entity_type: "file".to_string(),
            time: 1_700_000_000.0,
            project: None,
            project_id: None,
            branch: None,
            head_revision: None,
            repository_id: None,
            language: Some("Rust".to_string()),
            is_write: true,
            category: "coding".to_string(),
            lines: None,
            line_number: None,
            cursor_position: None,
            dependencies: Vec::new(),
            ast_language: None,
            ast_confidence: None,
            active_seconds: None,
            is_ai_generated: false,
            ai_agent: None,
            ai_provider: None,
            ai_model: None,
            identity_status: None,
            identity_reason: None,
            identity_source: None,
            identity_schema_version: None,
            identity_turn_id: None,
            identity_message_id: None,
            ai_source: None,
            ai_confidence: None,
            ai_event_id: None,
            ai_lines_added: None,
            ai_lines_deleted: None,
            human_lines_added: None,
            human_lines_deleted: None,
            unattributed_lines_added: None,
            unattributed_lines_deleted: None,
            editor: "vscode".to_string(),
            operating_system: "macos".to_string(),
            machine: "dev".to_string(),
            heartbeat_id: None,
            session_id: None,
            activity_segments: Vec::new(),
            actor_type: "human".to_string(),
            actor_confidence: 1.0,
        };

        let serialized = serde_json::to_value(item).unwrap();
        assert_eq!(serialized["actor_type"], "human");
        assert_eq!(serialized["actor_confidence"], 1.0);
        assert_eq!(serialized["is_ai_generated"], false);
    }

    #[test]
    fn server_adapter_matches_shared_decision_fixture() {
        let fixture: Value = serde_json::from_str(DECISION_FIXTURE).unwrap();
        assert_eq!(fixture["schema_version"], 1);
        assert_eq!(fixture["contract"], "canonical_attribution_decision");

        for case in fixture["cases"].as_array().unwrap() {
            let mut payload = json!({
                "entity": "src/main.rs",
                "entity_type": "file",
                "time": 1_700_000_000.0
            });
            for (key, value) in case["input"].as_object().unwrap() {
                let Some(wire_key) = (match key.as_str() {
                    "explicit_actor_type" => Some("actor_type"),
                    "explicit_confidence" => Some("actor_confidence"),
                    "legacy_is_ai_generated" => Some("is_ai_generated"),
                    // This is adapter metadata used by the fixture's pure
                    // implementation; the server derives it from its registry.
                    "known_agent_id" | "positive_editor_evidence" => None,
                    other => Some(other),
                }) else {
                    continue;
                };
                payload[wire_key] = value.clone();
            }

            let id = case["id"].as_str().unwrap();
            let expected_kind = case["expected"]["kind"].as_str().unwrap();
            let result = serde_json::from_value::<HeartbeatPayload>(payload)
                .map_err(|error| format!("{id} payload: {error}"))
                .and_then(|payload| payload_to_heartbeat(payload, Uuid::nil()));

            match expected_kind {
                "rejected" => assert!(result.is_err(), "{id} should be rejected"),
                "resolved" => {
                    let heartbeat = result.unwrap_or_else(|error| {
                        panic!("{id} should resolve, got rejection: {error}")
                    });
                    assert_eq!(
                        heartbeat.actor_type.as_str(),
                        case["expected"]["actor_type"].as_str().unwrap(),
                        "actor for {id}"
                    );
                    let expected_confidence = case["expected"]["confidence"].as_f64().unwrap();
                    assert!(
                        (f64::from(heartbeat.actor_confidence) - expected_confidence).abs()
                            < 0.00001,
                        "confidence for {id}: got {}, expected {expected_confidence}",
                        heartbeat.actor_confidence
                    );
                    heartbeat.validate().unwrap_or_else(|error| {
                        panic!("{id} violates heartbeat invariant: {error}")
                    });
                }
                other => panic!("unsupported expected result kind {other} in {id}"),
            }
        }
    }
}

// src/handlers/v1/heartbeats.rs

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::date_range::ResolvedRange;
use wakaclock_core::heartbeat::{
    resolve_attribution, ActivitySegment, ActorType, AttributionInput, Category, EntityType,
    Heartbeat,
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
    pub ast_language: Option<String>,
    pub ast_confidence: Option<f32>,
    pub keystrokes: Option<u32>,
    pub chars_added: Option<u32>,
    pub chars_deleted: Option<u32>,
    #[serde(default)]
    pub clipboard_tracking_version: Option<u8>,
    #[serde(default)]
    pub copy_actions: Option<u32>,
    #[serde(default)]
    pub paste_actions: Option<u32>,
    #[serde(default)]
    pub copied_chars: Option<u32>,
    #[serde(default)]
    pub copied_lines: Option<u32>,
    #[serde(default)]
    pub pasted_chars: Option<u32>,
    #[serde(default)]
    pub pasted_lines: Option<u32>,
    #[serde(default)]
    pub paste_same_file_actions: Option<u32>,
    #[serde(default)]
    pub paste_same_workspace_actions: Option<u32>,
    #[serde(default)]
    pub paste_external_or_unknown_actions: Option<u32>,
    pub active_seconds: Option<f64>,
    #[serde(default)]
    pub activity_segments: Vec<ActivitySegment>,
    #[serde(default)]
    pub actor_type: Option<ActorType>,
    #[serde(default)]
    pub actor_confidence: Option<f32>,
    pub is_ai_generated: Option<bool>,
    pub ai_agent: Option<String>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
    pub ai_source: Option<String>,
    pub ai_confidence: Option<String>,
    pub ai_event_id: Option<String>,
    #[serde(default)]
    pub ai_change_id: Option<String>,
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
    /// Payloads in a bulk batch that could not be converted or validated. Additive:
    /// omitted from the body when zero, so the single-heartbeat and all-accepted
    /// responses keep the exact shape WakaTime clients already parse.
    #[serde(skip_serializing_if = "is_zero")]
    pub heartbeats_rejected: usize,
}

fn is_zero(value: &usize) -> bool {
    *value == 0
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
    pub actor_type: ActorType,
    pub actor_confidence: f32,
    pub is_ai_generated: bool,
    pub ai_agent: Option<String>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
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
    pub activity_segments: Vec<ActivitySegment>,
    pub clipboard_tracking_version: Option<u8>,
    pub copy_actions: Option<u32>,
    pub paste_actions: Option<u32>,
    pub copied_chars: Option<u32>,
    pub copied_lines: Option<u32>,
    pub pasted_chars: Option<u32>,
    pub pasted_lines: Option<u32>,
    pub paste_same_file_actions: Option<u32>,
    pub paste_same_workspace_actions: Option<u32>,
    pub paste_external_or_unknown_actions: Option<u32>,
}

// ──────────────────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────────────────

/// POST /api/v1/heartbeats — single heartbeat
pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<HeartbeatPayload>,
) -> Result<Json<HeartbeatResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_logged_time") {
        return Err(auth::forbidden_scope("write_logged_time"));
    }
    require_active_access(&state, user_id).await?;
    let heartbeat = payload_to_heartbeat(payload, user_id)
        .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e))?;
    let heartbeat = resolve_heartbeat_project(&state, user_id, heartbeat)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    heartbeat
        .validate()
        .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e))?;

    let inserted = state
        .heartbeat_service
        .process_heartbeats(user_id, "".to_string(), vec![heartbeat])
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    // Presence (plan.md Phase 7): best-effort, in-memory, and deliberately after the
    // ClickHouse write succeeds — a presence update is not a reason to fail or delay a
    // heartbeat, and `record_heartbeat` cannot itself fail (see presence_store).
    if inserted > 0 {
        state.presence.record_heartbeat(user_id).await;
        if let Some(redis_presence) = &state.redis_presence {
            if let Err(error) = redis_presence.heartbeat(user_id).await {
                tracing::warn!(%error, %user_id, "failed to mirror heartbeat to Redis presence");
            }
        }
    }

    Ok(Json(HeartbeatResponse {
        status: "ok".to_string(),
        heartbeats_inserted: inserted,
        heartbeats_rejected: 0,
    }))
}

/// POST /api/v1/heartbeats.bulk — หลาย heartbeats
pub async fn create_bulk(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payloads): Json<Vec<HeartbeatPayload>>,
) -> Result<Json<HeartbeatResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_logged_time") {
        return Err(auth::forbidden_scope("write_logged_time"));
    }
    require_active_access(&state, user_id).await?;

    // A batch is many independent observations, so one unconvertible payload must not
    // discard the rest. `collect::<Result<_, _>>()` used to fail the whole request,
    // which meant a single heartbeat tripping `resolve_attribution` — for example a
    // payload carrying both AI and Human evidence — silently threw away every other
    // heartbeat the client had buffered, and the client saw it as "AI tracking stopped".
    // Rejections are counted and logged rather than dropped quietly.
    let submitted = payloads.len();
    let (mut heartbeats, mut rejections) = partition_bulk_payloads(payloads, user_id);

    let mut resolved = Vec::with_capacity(heartbeats.len());
    for heartbeat in heartbeats.drain(..) {
        let heartbeat = resolve_heartbeat_project(&state, user_id, heartbeat)
            .await
            .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;
        // Validation is per-heartbeat for the same reason the conversion above is.
        match heartbeat.validate() {
            Ok(()) => resolved.push(heartbeat),
            Err(reason) => rejections.push(reason),
        }
    }
    let heartbeats = resolved;

    for reason in &rejections {
        // The reason is a validation message, never heartbeat content.
        tracing::warn!(%user_id, reason, "rejected one heartbeat from a bulk batch");
    }
    // A batch in which nothing survived is a client-side contract error, not a partial
    // success — report it the way the all-or-nothing path used to.
    if heartbeats.is_empty() && submitted > 0 {
        let reason = rejections
            .first()
            .cloned()
            .unwrap_or_else(|| "no heartbeat in the batch could be accepted".to_string());
        return Err(app_error(StatusCode::BAD_REQUEST, &reason));
    }

    let count = state
        .heartbeat_service
        .process_heartbeats(user_id, "".to_string(), heartbeats)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    // See the same call in `create` above. Guarded on `count` so an empty batch — which
    // sent zero actual heartbeats — does not mark the user as having just been active.
    if count > 0 {
        state.presence.record_heartbeat(user_id).await;
        if let Some(redis_presence) = &state.redis_presence {
            if let Err(error) = redis_presence.heartbeat(user_id).await {
                tracing::warn!(%error, %user_id, "failed to mirror bulk heartbeat to Redis presence");
            }
        }
    }

    Ok(Json(HeartbeatResponse {
        status: if rejections.is_empty() {
            "ok".to_string()
        } else {
            "partial".to_string()
        },
        heartbeats_inserted: count,
        heartbeats_rejected: rejections.len(),
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
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_logged_time") {
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

    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "read_logged_time") {
        return Err(auth::forbidden_scope("read_logged_time"));
    }

    let rows = state
        .heartbeat_service
        .get_by_date(user_id, &range)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    let items: Vec<HeartbeatItem> = rows
        .into_iter()
        .map(|r| {
            let actor_type = r.actor_type.parse().unwrap_or(ActorType::Unknown);
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
                actor_type,
                actor_confidence: r.actor_confidence,
                heartbeat_id: r.heartbeat_id,
                activity_segments: serde_json::from_str(&r.activity_segments).unwrap_or_default(),
                clipboard_tracking_version: r.clipboard_tracking_version,
                copy_actions: r.copy_actions,
                paste_actions: r.paste_actions,
                copied_chars: r.copied_chars,
                copied_lines: r.copied_lines,
                pasted_chars: r.pasted_chars,
                pasted_lines: r.pasted_lines,
                paste_same_file_actions: r.paste_same_file_actions,
                paste_same_workspace_actions: r.paste_same_workspace_actions,
                paste_external_or_unknown_actions: r.paste_external_or_unknown_actions,
                is_ai_generated: actor_type.is_ai(),
                ai_agent: r.ai_agent,
                ai_provider: r.ai_provider,
                ai_model: r.ai_model,
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

/// Split a bulk batch into the heartbeats that converted and the reasons the rest did
/// not. Kept separate from the handler so the partial-batch contract is testable
/// without an `AppState`.
fn partition_bulk_payloads(
    payloads: Vec<HeartbeatPayload>,
    user_id: Uuid,
) -> (Vec<Heartbeat>, Vec<String>) {
    let mut heartbeats = Vec::with_capacity(payloads.len());
    let mut rejections = Vec::new();
    for payload in payloads {
        match payload_to_heartbeat(payload, user_id) {
            Ok(heartbeat) => heartbeats.push(heartbeat),
            Err(reason) => rejections.push(reason),
        }
    }
    (heartbeats, rejections)
}

fn payload_to_heartbeat(p: HeartbeatPayload, user_id: Uuid) -> Result<Heartbeat, String> {
    let date = Heartbeat::date_from_time(p.time);
    let created_at = p
        .created_at
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    let has_ai_metadata = p.is_ai_generated == Some(true)
        || p.ai_agent
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || p.ai_source
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || p.ai_event_id
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || p.ai_lines_added.is_some_and(|value| value > 0)
        || p.ai_lines_deleted.is_some_and(|value| value > 0);
    let positive_editor_evidence = !has_ai_metadata
        && (p.is_write.unwrap_or(false)
            || p.activity_segments.iter().any(|segment| {
                segment.source.as_deref().is_some_and(|source| {
                    source.eq_ignore_ascii_case("human") || source.eq_ignore_ascii_case("editor")
                })
            }));
    let attribution = resolve_attribution(AttributionInput {
        explicit_actor_type: p.actor_type,
        explicit_confidence: p.actor_confidence,
        legacy_is_ai_generated: p.is_ai_generated,
        ai_agent: p.ai_agent.as_deref(),
        ai_source: p.ai_source.as_deref(),
        ai_confidence: p.ai_confidence.as_deref(),
        ai_event_id: p.ai_event_id.as_deref(),
        ai_lines_added: p.ai_lines_added,
        ai_lines_deleted: p.ai_lines_deleted,
        human_lines_added: p.human_lines_added,
        human_lines_deleted: p.human_lines_deleted,
        unattributed_lines_added: p.unattributed_lines_added,
        unattributed_lines_deleted: p.unattributed_lines_deleted,
        keystrokes: p.keystrokes,
        chars_added: p.chars_added,
        chars_deleted: p.chars_deleted,
        positive_editor_evidence,
    })?;

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
        ast_language: p.ast_language,
        ast_confidence: p.ast_confidence,
        keystrokes: p.keystrokes,
        chars_added: p.chars_added,
        chars_deleted: p.chars_deleted,
        clipboard_tracking_version: p.clipboard_tracking_version,
        copy_actions: p.copy_actions,
        paste_actions: p.paste_actions,
        copied_chars: p.copied_chars,
        copied_lines: p.copied_lines,
        pasted_chars: p.pasted_chars,
        pasted_lines: p.pasted_lines,
        paste_same_file_actions: p.paste_same_file_actions,
        paste_same_workspace_actions: p.paste_same_workspace_actions,
        paste_external_or_unknown_actions: p.paste_external_or_unknown_actions,
        active_seconds: p.active_seconds,
        activity_segments: p.activity_segments,
        actor_type: attribution.actor_type,
        actor_confidence: attribution.confidence,
        is_ai_generated: attribution.actor_type.is_ai(),
        ai_agent: p.ai_agent,
        ai_provider: p.ai_provider,
        ai_model: p.ai_model,
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
        created_at,
    };

    // Runs *after* `resolve_attribution` above, never before: the resolver consumes
    // `ai_agent` as AI evidence, so redacting first could reclassify the heartbeat.
    // Here classification is already decided and only the stored identity is dropped.
    heartbeat.redact_inferred_agent_identity();

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
    // project a heartbeat belongs to, and the id must follow the resolved name.
    heartbeat.project_id = state
        .project_identity_service
        .resolve_project_id(user_id, heartbeat.project.as_deref(), None)
        .await?;

    Ok(heartbeat)
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

#[cfg(test)]
mod tests {
    use super::{payload_to_heartbeat, sanitize_entity};
    use serde_json::json;
    use uuid::Uuid;
    use wakaclock_core::heartbeat::ActorType;

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
    fn one_bad_payload_no_longer_discards_the_rest_of_a_bulk_batch() {
        let good = |entity: &str| {
            serde_json::from_value::<super::HeartbeatPayload>(json!({
                "entity": entity,
                "entity_type": "file",
                "time": 1_700_000_000.0,
                "is_write": true
            }))
            .unwrap()
        };
        // Both AI and Human evidence with no explicit actor_type — the exact shape
        // `resolve_attribution` refuses.
        let contradictory = serde_json::from_value::<super::HeartbeatPayload>(json!({
            "entity": "src/mixed.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "ai_agent": "claude-code",
            "ai_lines_added": 4,
            "keystrokes": 12
        }))
        .unwrap();

        let (accepted, rejected) = super::partition_bulk_payloads(
            vec![good("src/a.rs"), contradictory, good("src/b.rs")],
            Uuid::nil(),
        );

        assert_eq!(accepted.len(), 2, "the two valid heartbeats must survive");
        assert_eq!(rejected.len(), 1);
        assert_eq!(
            accepted
                .iter()
                .map(|h| h.entity.as_str())
                .collect::<Vec<_>>(),
            vec!["src/a.rs", "src/b.rs"]
        );
        assert!(rejected[0].contains("conflicting"), "{}", rejected[0]);
    }

    #[test]
    fn a_batch_with_no_survivors_still_reports_a_reason() {
        let contradictory = || {
            serde_json::from_value::<super::HeartbeatPayload>(json!({
                "entity": "src/mixed.rs",
                "entity_type": "file",
                "time": 1_700_000_000.0,
                "ai_agent": "claude-code",
                "ai_lines_added": 4,
                "keystrokes": 12
            }))
            .unwrap()
        };
        let (accepted, rejected) =
            super::partition_bulk_payloads(vec![contradictory(), contradictory()], Uuid::nil());
        assert!(accepted.is_empty());
        assert_eq!(rejected.len(), 2);
    }

    #[test]
    fn legacy_ingest_derives_human_from_positive_editor_evidence() {
        let payload: super::HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "is_ai_generated": false,
            "is_write": true
        }))
        .unwrap();

        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert_eq!(heartbeat.actor_type, ActorType::Human);
        assert_eq!(heartbeat.actor_confidence, 1.0);
        assert!(!heartbeat.is_ai_generated);
    }

    #[test]
    fn enum_ingest_preserves_mcp_attribution_and_derived_boolean() {
        let payload: super::HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/tan.ts",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "actor_type": "ai_verified",
            "actor_confidence": 0.95,
            "is_ai_generated": true,
            "ai_agent": "tan",
            "ai_source": "mcp",
            "ai_lines_added": 3
        }))
        .unwrap();

        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert_eq!(heartbeat.actor_type, ActorType::AiVerified);
        assert_eq!(heartbeat.actor_confidence, 0.95);
        assert!(heartbeat.is_ai_generated);
    }

    #[test]
    fn inferred_payload_loses_its_agent_name_but_keeps_ai_classification() {
        // Pins the ordering inside `payload_to_heartbeat`: `resolve_attribution` must
        // run while `ai_agent` is still present (it is AI evidence), and the redaction
        // must happen after. Move the redaction above the resolver and this fails —
        // the heartbeat would come back Unknown instead of AiInferred.
        let payload: super::HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "ai_agent": "codex",
            "ai_provider": "openai",
            "ai_model": "gpt-5.6-sol",
            "ai_source": "ide_telemetry",
            "ai_event_id": "evt-1",
            "ai_lines_added": 3
        }))
        .unwrap();

        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert_eq!(heartbeat.actor_type, ActorType::AiInferred);
        assert!(heartbeat.is_ai_generated);
        assert!(heartbeat.ai_agent.is_none(), "agent name must not be stored");
        assert!(heartbeat.ai_provider.is_none());
        assert!(heartbeat.ai_model.is_none());
        // Evidence and lineage survive so the row is still explainable.
        assert_eq!(heartbeat.ai_event_id.as_deref(), Some("evt-1"));
        assert_eq!(heartbeat.ai_source.as_deref(), Some("ide_telemetry"));
        assert!(heartbeat.validate().is_ok());
    }

    #[test]
    fn verified_payload_keeps_its_agent_name() {
        let payload: super::HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "ai_agent": "claude-code",
            "ai_provider": "anthropic",
            "ai_source": "agent_hook",
            "ai_event_id": "evt-2",
            "ai_lines_added": 3
        }))
        .unwrap();

        let heartbeat = payload_to_heartbeat(payload, Uuid::nil()).unwrap();
        assert_eq!(heartbeat.actor_type, ActorType::AiVerified);
        assert_eq!(heartbeat.ai_agent.as_deref(), Some("claude-code"));
        assert_eq!(heartbeat.ai_provider.as_deref(), Some("anthropic"));
    }

    #[test]
    fn contradictory_enum_and_legacy_boolean_are_rejected() {
        let payload: super::HeartbeatPayload = serde_json::from_value(json!({
            "entity": "src/main.rs",
            "entity_type": "file",
            "time": 1_700_000_000.0,
            "actor_type": "human",
            "is_ai_generated": true
        }))
        .unwrap();

        assert!(payload_to_heartbeat(payload, Uuid::nil()).is_err());
    }
}

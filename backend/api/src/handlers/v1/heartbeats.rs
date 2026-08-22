// src/handlers/v1/heartbeats.rs

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use wakaclock_core::heartbeat::{Category, EntityType, Heartbeat};

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
    pub ast_language: Option<String>,
    pub ast_confidence: Option<f32>,
    pub keystrokes: Option<u32>,
    pub chars_added: Option<u32>,
    pub chars_deleted: Option<u32>,
    pub active_seconds: Option<f64>,
    pub is_ai_generated: Option<bool>,
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
}

#[derive(Debug, Serialize)]
pub struct HeartbeatResponse {
    pub status: String,
    pub heartbeats_inserted: usize,
}

/// Query params สำหรับ GET /heartbeats?date=YYYY-MM-DD
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub date: Option<String>,
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
    require_active_access(&state, user_id).await?;
    let heartbeat =
        resolve_heartbeat_project(&state, user_id, payload_to_heartbeat(payload, user_id))
            .await
            .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    heartbeat
        .validate()
        .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e))?;

    state
        .heartbeat_service
        .process_heartbeats(user_id, "".to_string(), vec![heartbeat])
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    // Presence (plan.md Phase 7): best-effort, in-memory, and deliberately after the
    // ClickHouse write succeeds — a presence update is not a reason to fail or delay a
    // heartbeat, and `record_heartbeat` cannot itself fail (see presence_store).
    state.presence.record_heartbeat(user_id).await;

    Ok(Json(HeartbeatResponse {
        status: "ok".to_string(),
        heartbeats_inserted: 1,
    }))
}

/// POST /api/v1/heartbeats.bulk — หลาย heartbeats
pub async fn create_bulk(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payloads): Json<Vec<HeartbeatPayload>>,
) -> Result<Json<HeartbeatResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    require_active_access(&state, user_id).await?;

    let mut heartbeats: Vec<Heartbeat> = payloads
        .into_iter()
        .map(|p| payload_to_heartbeat(p, user_id))
        .collect();

    let mut resolved = Vec::with_capacity(heartbeats.len());
    for heartbeat in heartbeats.drain(..) {
        let heartbeat = resolve_heartbeat_project(&state, user_id, heartbeat)
            .await
            .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;
        resolved.push(heartbeat);
    }
    let heartbeats = resolved;

    for hb in &heartbeats {
        hb.validate()
            .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e))?;
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
    }

    Ok(Json(HeartbeatResponse {
        status: "ok".to_string(),
        heartbeats_inserted: count,
    }))
}

/// GET /api/v1/heartbeats?date=2026-04-10&user_id=...
pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<ListQuery>,
) -> Result<Json<HeartbeatListResponse>, (StatusCode, Json<serde_json::Value>)> {
    // default date = today
    let date = params
        .date
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());

    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;

    let rows = state
        .heartbeat_service
        .get_by_date(user_id, &date)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    let items: Vec<HeartbeatItem> = rows
        .into_iter()
        .map(|r| HeartbeatItem {
            // History is still owner-scoped, but the response must not become a path
            // exfiltration endpoint. Keep project-relative names where possible and reduce
            // legacy absolute/traversal rows to a safe basename.
            entity: sanitize_entity(&r.entity),
            entity_type: r.entity_type,
            time: r.time,
            project: r.project,
            project_id: r.project_id,
            branch: r.branch,
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
            is_ai_generated: r.is_ai_generated,
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

fn payload_to_heartbeat(p: HeartbeatPayload, user_id: Uuid) -> Heartbeat {
    let date = Heartbeat::date_from_time(p.time);
    let created_at = p
        .created_at
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    Heartbeat {
        user_id,
        entity: p.entity,
        entity_type: p.entity_type,
        time: p.time,
        date,
        project: p.project,
        // Resolved server-side in `resolve_heartbeat_project`, never taken from the client.
        project_id: None,
        branch: p.branch,
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
        ast_language: p.ast_language,
        ast_confidence: p.ast_confidence,
        keystrokes: p.keystrokes,
        chars_added: p.chars_added,
        chars_deleted: p.chars_deleted,
        active_seconds: p.active_seconds,
        // An agent name is authoritative. This prevents a malformed client from
        // sending `ai_agent` with `is_ai_generated: false` and having the same edit
        // counted as human by the materialized view.
        is_ai_generated: p.ai_agent.is_some() || p.is_ai_generated.unwrap_or(false),
        ai_agent: p.ai_agent,
        ai_provider: p.ai_provider,
        ai_model: p.ai_model,
        ai_source: p.ai_source,
        ai_confidence: p.ai_confidence,
        ai_event_id: p.ai_event_id,
        ai_lines_added: p.ai_lines_added,
        ai_lines_deleted: p.ai_lines_deleted,
        human_lines_added: p.human_lines_added,
        human_lines_deleted: p.human_lines_deleted,
        unattributed_lines_added: p.unattributed_lines_added,
        unattributed_lines_deleted: p.unattributed_lines_deleted,
        created_at,
    }
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
    use super::sanitize_entity;

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
}

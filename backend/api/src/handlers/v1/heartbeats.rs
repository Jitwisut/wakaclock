// src/handlers/v1/heartbeats.rs

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use wakaclock_core::heartbeat::{Category, EntityType, Heartbeat};

// ──────────────────────────────────────────────────────────────────────────────
// Request / Response models
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct HeartbeatPayload {
    pub user_id: Option<Uuid>,
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
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct HeartbeatResponse {
    pub status: String,
    pub heartbeats_inserted: usize,
}

/// Query params สำหรับ GET /heartbeats?date=YYYY-MM-DD&user_id=...
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub date: Option<String>,
    pub user_id: Option<Uuid>,
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
    Json(payload): Json<HeartbeatPayload>,
) -> Result<Json<HeartbeatResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = payload.user_id.unwrap_or(Uuid::nil());
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

    Ok(Json(HeartbeatResponse {
        status: "ok".to_string(),
        heartbeats_inserted: 1,
    }))
}

/// POST /api/v1/heartbeats.bulk — หลาย heartbeats
pub async fn create_bulk(
    State(state): State<Arc<AppState>>,
    Json(payloads): Json<Vec<HeartbeatPayload>>,
) -> Result<Json<HeartbeatResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = payloads
        .first()
        .and_then(|p| p.user_id)
        .unwrap_or(Uuid::nil());

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

    let count = heartbeats.len();
    state
        .heartbeat_service
        .process_heartbeats(user_id, "".to_string(), heartbeats)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(HeartbeatResponse {
        status: "ok".to_string(),
        heartbeats_inserted: count,
    }))
}

/// GET /api/v1/heartbeats?date=2026-04-10&user_id=...
pub async fn list(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListQuery>,
) -> Result<Json<HeartbeatListResponse>, (StatusCode, Json<serde_json::Value>)> {
    // default date = today
    let date = params
        .date
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());

    // TODO: ดึง user_id จาก JWT — ตอนนี้ใช้จาก query param
    let user_id = params.user_id.unwrap_or(Uuid::nil());

    let rows = state
        .heartbeat_service
        .get_by_date(user_id, &date)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    let items: Vec<HeartbeatItem> = rows
        .into_iter()
        .map(|r| HeartbeatItem {
            entity: r.entity,
            entity_type: r.entity_type,
            time: r.time,
            project: r.project,
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

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

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
        is_ai_generated: p.is_ai_generated.unwrap_or(false),
        ai_agent: p.ai_agent,
        ai_lines_added: p.ai_lines_added,
        ai_lines_deleted: p.ai_lines_deleted,
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

    Ok(heartbeat)
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

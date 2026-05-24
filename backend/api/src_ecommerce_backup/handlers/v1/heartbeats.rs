// backend/api/src/handlers/v1/heartbeats.rs
//
// HTTP handlers สำหรับ Wakaclock heartbeat endpoints
// ย้ายมาจาก crates/wakaclock-server/src/routes/heartbeats.rs

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use wakaclock_core::heartbeat::{Category, EntityType, Heartbeat};

use crate::infrastructure::app::App;
use crate::services::heartbeat::insert_heartbeats;

pub type AppState = App;

// ──────────────────────────────────────────────────────────────────────────────
// Request / Response models
// ──────────────────────────────────────────────────────────────────────────────

/// Payload ที่รับจาก WakaTime client
/// ครอบคลุมทุก field ที่ client อาจส่งมา
#[derive(Debug, Deserialize)]
pub struct HeartbeatPayload {
    /// user_id เพิ่มเติมจาก client (ถ้ามี) — ใน production ให้ดึงจาก JWT
    pub user_id: Option<Uuid>,
    pub entity: String,
    pub entity_type: EntityType,
    pub time: f64,
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

// ──────────────────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────────────────

/// POST /api/v1/heartbeats — single heartbeat
pub async fn create(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<HeartbeatPayload>,
) -> Result<Json<HeartbeatResponse>, (StatusCode, Json<serde_json::Value>)> {
    // TODO: ดึง user_id จาก JWT token จริงๆ
    let user_id = payload.user_id.unwrap_or(Uuid::nil());
    let heartbeat = payload_to_heartbeat(payload, user_id);

    heartbeat
        .validate()
        .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e))?;

    insert_heartbeats(&state, vec![heartbeat], user_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e))?;

    Ok(Json(HeartbeatResponse {
        status: "ok".to_string(),
        heartbeats_inserted: 1,
    }))
}

/// POST /api/v1/heartbeats.bulk — หลาย heartbeats พร้อมกัน
pub async fn create_bulk(
    State(state): State<Arc<AppState>>,
    Json(payloads): Json<Vec<HeartbeatPayload>>,
) -> Result<Json<HeartbeatResponse>, (StatusCode, Json<serde_json::Value>)> {
    // TODO: ดึง user_id จาก JWT token จริงๆ
    let user_id = payloads
        .first()
        .and_then(|p| p.user_id)
        .unwrap_or(Uuid::nil());

    let heartbeats: Vec<Heartbeat> = payloads
        .into_iter()
        .map(|p| payload_to_heartbeat(p, user_id))
        .collect();

    for hb in &heartbeats {
        hb.validate()
            .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e))?;
    }

    let count = heartbeats.len();
    insert_heartbeats(&state, heartbeats, user_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e))?;

    Ok(Json(HeartbeatResponse {
        status: "ok".to_string(),
        heartbeats_inserted: count,
    }))
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

fn payload_to_heartbeat(p: HeartbeatPayload, user_id: Uuid) -> Heartbeat {
    let date = Heartbeat::date_from_time(p.time);
    let created_at = chrono::Utc::now().to_rfc3339();

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
        is_ai_generated: p.is_ai_generated.unwrap_or(false),
        ai_agent: p.ai_agent,
        ai_lines_added: p.ai_lines_added,
        ai_lines_deleted: p.ai_lines_deleted,
        created_at,
    }
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

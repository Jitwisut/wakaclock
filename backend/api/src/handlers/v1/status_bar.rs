// src/handlers/v1/status_bar.rs
use crate::infrastructure::app::AppState;
use axum::{extract::State, Json};
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct StatusBarResponse {
    pub total_seconds: f64,
    pub human_readable: String,
    pub heartbeat_count: u64,
}

#[derive(Row, Deserialize)]
struct TotalsRow {
    total_seconds: f64,
    heartbeat_count: u64,
}

pub async fn today(State(state): State<Arc<AppState>>) -> Json<StatusBarResponse> {
    let result = state
        .clickhouse          // ← เปลี่ยนจาก state.ch.get_client()
        .get_client()
        .query("
            SELECT
                coalesce(sum(ifNull(active_seconds, 0.0)), 0.0) AS total_seconds,
                count() AS heartbeat_count
            FROM wakaclock.heartbeats
            WHERE date = today()
        ")
        //.bind(user_id)
        .fetch_one::<TotalsRow>()
        .await;

    match result {
        Ok(row) => Json(StatusBarResponse {
            human_readable: format_duration(row.total_seconds),
            total_seconds: row.total_seconds,
            heartbeat_count: row.heartbeat_count,
        }),
        Err(_) => Json(StatusBarResponse {
            total_seconds: 0.0,
            human_readable: "0m".to_string(),
            heartbeat_count: 0,
        }),
    }
}

fn format_duration(secs: f64) -> String {
    let total = secs as u64;
    let hours = total / 3600;
    let minutes = (total % 3600) / 60;
    if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m", minutes)
    }
}

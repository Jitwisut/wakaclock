// pub mod audit;
// pub mod auth_config;
pub mod v1;

use axum::http::StatusCode;
use axum::response::IntoResponse;

/// 404 handler
pub async fn not_found() -> impl IntoResponse {
    (StatusCode::NOT_FOUND, "Not Found")
}

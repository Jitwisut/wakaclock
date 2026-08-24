use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::infrastructure::app::AppState;

/// Mounted at `/public` (see `main.rs`).
///
/// The badge routes put the extension in its own path segment rather than suffixing the
/// parameter. `/embed/:token.svg` looks natural but axum's `:param` captures a whole
/// segment, so `:token.json` and `:token.svg` are the same route and registering both
/// panics at startup. Keeping `badge.svg` as a literal trailing segment preserves the
/// extension a README image link expects while leaving the token its own segment.
pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/share/:token", axum::routing::get(share))
        .route("/embed/:token/badge.json", axum::routing::get(embed_json))
        .route("/embed/:token/badge.svg", axum::routing::get(embed_svg))
        .with_state(app_state)
}

async fn share(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<crate::model::profile::PublicShare>, PublicError> {
    let share = state
        .profile_service
        .resolve_public_share(&token)
        .await
        .map_err(PublicError::service_unavailable)?
        .ok_or_else(PublicError::not_found)?;
    Ok(Json(share))
}

async fn embed_json(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<serde_json::Value>, PublicError> {
    let share = state
        .profile_service
        .resolve_public_share(&token)
        .await
        .map_err(PublicError::service_unavailable)?
        .ok_or_else(PublicError::not_found)?;
    Ok(Json(json!({ "data": share })))
}

async fn embed_svg(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Response, PublicError> {
    let share = state
        .profile_service
        .resolve_public_share(&token)
        .await
        .map_err(PublicError::service_unavailable)?
        .ok_or_else(PublicError::not_found)?;
    let title = share
        .profile
        .as_ref()
        .map(|profile| profile.username.as_str())
        .unwrap_or("AtoAxis shared chart");
    let title = escape_xml(title);
    let body = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" width=\"640\" height=\"160\" viewBox=\"0 0 640 160\"><rect width=\"640\" height=\"160\" rx=\"16\" fill=\"#101820\"/><text x=\"32\" y=\"72\" fill=\"#f3f6f8\" font-family=\"system-ui,sans-serif\" font-size=\"24\">{title}</text><text x=\"32\" y=\"112\" fill=\"#91a7b4\" font-family=\"system-ui,sans-serif\" font-size=\"14\">Shared from AtoAxis</text></svg>"
    );
    Ok((
        [
            (
                header::CONTENT_TYPE,
                HeaderValue::from_static("image/svg+xml"),
            ),
            (header::CACHE_CONTROL, HeaderValue::from_static("no-store")),
        ],
        body,
    )
        .into_response())
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[derive(Debug)]
struct PublicError {
    status: StatusCode,
    message: &'static str,
}

impl PublicError {
    fn not_found() -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: "share link not found or expired",
        }
    }

    fn service_unavailable(_: anyhow::Error) -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            message: "public sharing is temporarily unavailable",
        }
    }
}

impl IntoResponse for PublicError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn svg_escaping_blocks_markup_injection() {
        assert_eq!(escape_xml("<x>&\""), "&lt;x&gt;&amp;&quot;");
    }
}

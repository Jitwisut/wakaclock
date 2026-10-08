use super::*;
use crate::repository::team_webhooks::TeamWebhookRepository;
use crate::services::team_webhooks::{github_metadata, payload_hash, verify_github};
use axum::body::Bytes;

pub async fn github(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, ApiError> {
    if !state.config.team_enabled {
        return Err(ApiError::not_found("Team receiver disabled"));
    }
    let pg = state
        .postgres
        .clone()
        .ok_or_else(|| ApiError::service_unavailable("Team requires PostgreSQL"))?;
    let secret = std::env::var("ATOAXIS_GITHUB_WEBHOOK_SECRET")
        .ok()
        .filter(|v| !v.is_empty())
        .ok_or_else(|| ApiError::service_unavailable("GitHub receiver not configured"))?;
    let header = |key: &str| headers.get(key).and_then(|v| v.to_str().ok());
    let signature = header("x-hub-signature-256")
        .ok_or_else(|| ApiError::forbidden("invalid webhook signature"))?;
    verify_github(secret.as_bytes(), &body, signature)
        .map_err(|_| ApiError::forbidden("invalid webhook signature"))?;
    let event =
        header("x-github-event").ok_or_else(|| ApiError::bad_request("missing event type"))?;
    let id = header("x-github-delivery")
        .ok_or_else(|| ApiError::bad_request("missing delivery identity"))?;
    let Some(metadata) = github_metadata(event, &body)
        .map_err(|_| ApiError::bad_request("invalid webhook metadata"))?
    else {
        return Ok(StatusCode::NO_CONTENT);
    };
    TeamWebhookRepository::new(pg)
        .accept_github(id, &payload_hash(&body), &metadata)
        .await
        .map_err(|_| {
            ApiError::service_unavailable("webhook not durably accepted; retry delivery")
        })?;
    Ok(StatusCode::ACCEPTED)
}

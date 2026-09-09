use crate::{infrastructure::app::AppState, middleware::auth};
use axum::{
    extract::{ConnectInfo, DefaultBodyLimit, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::{net::SocketAddr, sync::Arc};

type ApiError = (StatusCode, Json<serde_json::Value>);

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Signup {
    email: String,
    interest: String,
    locale: String,
    source_page: String,
    consent: bool,
    #[serde(default)]
    bot_field: String,
}

fn error(status: StatusCode, code: &str) -> ApiError {
    (status, Json(serde_json::json!({ "error": code })))
}

fn normalized_email(input: &str) -> Option<String> {
    let email = input.trim().to_ascii_lowercase();
    if email.len() > 254 || !email.is_ascii() || email.chars().any(char::is_whitespace) {
        return None;
    }
    let (local, domain) = email.split_once('@')?;
    if local.is_empty()
        || local.len() > 64
        || local.starts_with('.')
        || local.ends_with('.')
        || local.contains("..")
        || !local
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".!#$%&'*+-/=?^_`{|}~".contains(&b))
        || !domain.contains('.')
        || domain.split('.').any(|label| {
            label.is_empty()
                || label.len() > 63
                || label.starts_with('-')
                || label.ends_with('-')
                || !label
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
    {
        return None;
    }
    Some(email)
}

pub fn body_limit() -> DefaultBodyLimit {
    DefaultBodyLimit::max(4096)
}

/// Public, rate-limited signup. Success is returned only after durable insertion.
pub async fn create(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<Signup>,
) -> Result<Json<serde_json::Value>, ApiError> {
    auth::check_rate_limit(&state, addr.ip())?;
    if !payload.bot_field.is_empty() {
        return Err(error(StatusCode::BAD_REQUEST, "invalid_signup"));
    }
    let email = normalized_email(&payload.email)
        .ok_or_else(|| error(StatusCode::BAD_REQUEST, "invalid_email"))?;
    if !payload.consent
        || !matches!(payload.interest.as_str(), "solo" | "teams")
        || !matches!(payload.locale.as_str(), "en" | "th")
        || payload.source_page.len() > 128
    {
        return Err(error(StatusCode::BAD_REQUEST, "invalid_signup"));
    }
    let postgres = state
        .postgres
        .as_ref()
        .ok_or_else(|| error(StatusCode::SERVICE_UNAVAILABLE, "signup_unavailable"))?;
    postgres.client().execute(
        "INSERT INTO early_access_signups (email, interest, locale, source_page) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING",
        &[&email, &payload.interest, &payload.locale, &payload.source_page],
    ).await.map_err(|_| error(StatusCode::SERVICE_UNAVAILABLE, "signup_unavailable"))?;
    // Identical response for new and existing addresses prevents address enumeration.
    Ok(Json(serde_json::json!({ "accepted": true })))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_and_normalizes_addresses() {
        assert_eq!(
            normalized_email("  Demo+test@Example.COM ").as_deref(),
            Some("demo+test@example.com")
        );
        for invalid in [
            "",
            "a",
            "a@",
            "@example.com",
            "a@@example.com",
            "a@-example.com",
            "a@example..com",
            "a b@example.com",
            "a\n@example.com",
            "a..b@example.com",
        ] {
            assert!(normalized_email(invalid).is_none(), "{invalid}");
        }
        assert!(normalized_email(&format!("{}@example.com", "a".repeat(65))).is_none());
    }
}

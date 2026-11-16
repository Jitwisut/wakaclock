use crate::infrastructure::rate_limiter::{EarlyAccessRateLimiter, RateLimitExceeded};
use crate::{infrastructure::app::AppState, middleware::auth};
use axum::{
    extract::{ConnectInfo, DefaultBodyLimit, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use std::{
    net::{IpAddr, SocketAddr},
    sync::Arc,
};

type ApiError = Response;

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
    (status, Json(serde_json::json!({ "error": code }))).into_response()
}

fn check_signup_budget(
    limiter: &EarlyAccessRateLimiter,
    peer: IpAddr,
    headers: &HeaderMap,
    trusted_proxies: &[IpAddr],
) -> Result<(), RateLimitExceeded> {
    limiter.check(auth::client_ip(peer, headers, trusted_proxies))
}

fn signup_rate_limited(_: RateLimitExceeded) -> ApiError {
    let mut response = error(StatusCode::TOO_MANY_REQUESTS, "signup_rate_limited");
    response
        .headers_mut()
        .insert(header::RETRY_AFTER, HeaderValue::from_static("60"));
    response
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
    headers: HeaderMap,
    Json(payload): Json<Signup>,
) -> Result<Json<serde_json::Value>, ApiError> {
    check_signup_budget(
        &state.early_access_rate_limiter,
        addr.ip(),
        &headers,
        &state.config.trusted_proxy_ips,
    )
    .map_err(signup_rate_limited)?;
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
    fn proxy_clients_have_independent_budgets_and_untrusted_forwarding_is_ignored() {
        let proxy: IpAddr = "192.0.2.10".parse().unwrap();
        let first = HeaderMap::from_iter([
            (header::FORWARDED, HeaderValue::from_static("ignored")),
            (
                axum::http::HeaderName::from_static("x-forwarded-for"),
                HeaderValue::from_static("198.51.100.1"),
            ),
        ]);
        let mut second = first.clone();
        second.insert("x-forwarded-for", HeaderValue::from_static("198.51.100.2"));
        let limiter = EarlyAccessRateLimiter::new();
        for _ in 0..5 {
            check_signup_budget(&limiter, proxy, &first, &[proxy]).unwrap();
        }
        let rejected = signup_rate_limited(
            check_signup_budget(&limiter, proxy, &first, &[proxy]).unwrap_err(),
        );
        assert_eq!(rejected.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(rejected.headers()[header::RETRY_AFTER], "60");
        check_signup_budget(&limiter, proxy, &second, &[proxy]).unwrap();

        let limiter = EarlyAccessRateLimiter::new();
        for _ in 0..5 {
            check_signup_budget(&limiter, proxy, &first, &[]).unwrap();
        }
        assert!(check_signup_budget(&limiter, proxy, &second, &[]).is_err());
    }

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

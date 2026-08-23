use axum::http::{header, HeaderMap};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header as JwtHeader, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::infrastructure::app::AppState;

pub const API_KEY_PREFIX: &str = "wcl_";
const SESSION_TTL_SECONDS: i64 = 60 * 60 * 24; // 24h

/// Generate a new plaintext API key. 32 random bytes (two CSPRNG-backed UUIDv4s,
/// avoiding a direct `rand` dependency) hex-encoded, with a greppable prefix so leaked
/// keys are easy for secret scanners to recognize.
pub fn generate_key() -> String {
    let mut bytes = Vec::with_capacity(32);
    bytes.extend_from_slice(Uuid::new_v4().as_bytes());
    bytes.extend_from_slice(Uuid::new_v4().as_bytes());
    format!("{API_KEY_PREFIX}{}", hex_encode(&bytes))
}

/// SHA-256 is intentional here, not argon2/bcrypt: the key is a 256-bit random value,
/// not a human-chosen password, so a slow KDF buys nothing and would tax every
/// authenticated request. Only the hash is ever persisted or held in memory.
pub fn hash_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex_encode(&hasher.finalize())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Debug, Serialize, Deserialize)]
struct SessionClaims {
    sub: Uuid,
    exp: i64,
}

/// Issue a short-lived (24h) session JWT after a successful /auth/login or
/// /auth/register — this is what the frontend holds, separate from the long-lived API
/// key a CLI/extension uses. Losing the session token just means logging in again; it
/// carries no more power than "prove you're this user_id for the next 24h".
pub fn issue_session_token(
    user_id: Uuid,
    jwt_secret: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let claims = SessionClaims {
        sub: user_id,
        exp: chrono::Utc::now().timestamp() + SESSION_TTL_SECONDS,
    };
    encode(
        &JwtHeader::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
}

fn verify_session_token(token: &str, jwt_secret: &str) -> Option<Uuid> {
    decode::<SessionClaims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .ok()
    .map(|data| data.claims.sub)
}

/// Extract the raw token from `Authorization: Bearer <token>` or `Authorization: Basic
/// base64(<token>)` (WakaTime-compatible form, per plan.md's stated design). Used for
/// both session JWTs and opaque API keys — they share the same header.
fn extract_key(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get(header::AUTHORIZATION)?.to_str().ok()?;

    if let Some(token) = raw.strip_prefix("Bearer ") {
        return Some(token.trim().to_string());
    }

    if let Some(encoded) = raw.strip_prefix("Basic ") {
        let decoded = BASE64.decode(encoded.trim()).ok()?;
        let decoded = String::from_utf8(decoded).ok()?;
        // WakaTime sends base64(api_key) with no ":" suffix — accept that shape, but also
        // tolerate a trailing ":" (basic-auth-with-empty-password) some clients may send.
        return Some(decoded.trim_end_matches(':').to_string());
    }

    None
}

/// Resolve the caller's `user_id` from a session JWT (dashboard) or an API key
/// (CLI/extension) — the only two ways to prove identity. Returns `None` if neither is
/// present or valid, and callers must treat that as a hard failure (401), not fall back
/// to a client-supplied `user_id` in a query string or JSON body: that field is never
/// trustworthy on its own, since anyone can set it to any uuid. An earlier version of
/// this function accepted that fallback for a soft rollout; every caller now requires
/// real authentication, so it was removed rather than left reachable.
pub fn resolve_user_id(state: &AppState, headers: &HeaderMap) -> Option<Uuid> {
    let token = extract_key(headers)?;
    resolve_user_id_from_token(state, &token)
}

/// Same resolution as `resolve_user_id`, but takes the token directly instead of
/// reading it from an `Authorization` header.
///
/// Exists for the presence SSE stream: browsers' native `EventSource` cannot set custom
/// request headers, so that one endpoint accepts the session token as a `?token=` query
/// parameter instead. This is the standard workaround for authenticating SSE from a
/// browser — not a general-purpose alternative to header auth, and no other handler
/// should call this directly with a client-supplied query parameter.
pub fn resolve_user_id_from_token(state: &AppState, token: &str) -> Option<Uuid> {
    if let Some(user_id) = verify_session_token(token, &state.config.jwt_secret) {
        return Some(user_id);
    }

    let hash = hash_key(token);
    state.auth_cache.lookup(&hash)
}

/// Like `resolve_user_id`, but only accepts a session JWT — not an API key. Used by
/// endpoints that must not be reachable from a long-lived CLI/extension credential at
/// all, such as generating a *new* API key: a key should never be able to mint another
/// key for itself.
pub fn require_session_user(state: &AppState, headers: &HeaderMap) -> Option<Uuid> {
    let token = extract_key(headers)?;
    verify_session_token(&token, &state.config.jwt_secret)
}

/// Require an OAuth scope for an endpoint while preserving the compatibility
/// semantics of API keys and dashboard sessions. OAuth access tokens carry a
/// scope set in the in-memory auth index; API keys are account credentials and
/// therefore have no scope entry, and session JWTs are already restricted to
/// the first-party dashboard.
pub fn require_scope(state: &AppState, headers: &HeaderMap, scope: &str) -> bool {
    let Some(token) = extract_key(headers) else {
        return false;
    };
    if verify_session_token(&token, &state.config.jwt_secret).is_some() {
        return true;
    }
    state.auth_cache.has_scope(&hash_key(&token), scope)
}

/// Shared 403 body for an authenticated OAuth client that did not grant the
/// scope required by the resource.
pub fn forbidden_scope(scope: &str) -> (axum::http::StatusCode, axum::Json<serde_json::Value>) {
    (
        axum::http::StatusCode::FORBIDDEN,
        axum::Json(serde_json::json!({
            "error": "insufficient_scope",
            "scope": scope,
        })),
    )
}

/// Shared 401 body for every handler that requires authentication.
pub fn unauthorized() -> (axum::http::StatusCode, axum::Json<serde_json::Value>) {
    (
        axum::http::StatusCode::UNAUTHORIZED,
        axum::Json(serde_json::json!({ "error": "authentication required" })),
    )
}

/// Check the per-IP limit for an auth-sensitive endpoint (login, register, API key
/// generate/revoke). Returns a ready-to-return 429 on failure so call sites stay a
/// one-liner.
pub fn check_rate_limit(
    state: &AppState,
    ip: std::net::IpAddr,
) -> Result<(), (axum::http::StatusCode, axum::Json<serde_json::Value>)> {
    state.auth_rate_limiter.check(ip).map_err(|_| {
        (
            axum::http::StatusCode::TOO_MANY_REQUESTS,
            axum::Json(serde_json::json!({ "error": "too many attempts, try again later" })),
        )
    })
}

/// Check the per-account limit for expensive analytics and historical rebuild work.
///
/// Authentication must happen before this helper is called, so the key is the verified
/// account id rather than a caller-controlled query parameter or an unstable proxy IP.
pub fn check_analytics_rate_limit(
    state: &AppState,
    user_id: Uuid,
) -> Result<(), (axum::http::StatusCode, axum::Json<serde_json::Value>)> {
    state.analytics_rate_limiter.check(user_id).map_err(|_| {
        (
            axum::http::StatusCode::TOO_MANY_REQUESTS,
            axum::Json(serde_json::json!({
                "error": "analytics request rate limit exceeded, try again later"
            })),
        )
    })
}

/// Verify `Authorization: Bearer <secret>` against `INTERNAL_API_SECRET` — the only
/// credential POST /internal/subscription accepts. Constant-time on purpose: this
/// secret has no rate limit or hashing behind it, so a timing side-channel would be a
/// real shortcut for guessing it.
pub fn verify_internal_secret(state: &AppState, headers: &HeaderMap) -> bool {
    let Some(configured) = &state.config.internal_api_secret else {
        return false;
    };
    let Some(provided) = extract_key(headers) else {
        return false;
    };

    constant_time_eq(configured.as_bytes(), provided.as_bytes())
}

/// Manual constant-time comparison rather than pulling in a crate for it — always
/// scans every byte of both slices regardless of where they first differ, so timing
/// doesn't leak how much of the secret a guess got right.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Shared 402 body for endpoints gated behind an active trial/subscription.
pub fn payment_required() -> (axum::http::StatusCode, axum::Json<serde_json::Value>) {
    (
        axum::http::StatusCode::PAYMENT_REQUIRED,
        axum::Json(serde_json::json!({
            "error": "trial expired or subscription inactive — see /users/current for status"
        })),
    )
}

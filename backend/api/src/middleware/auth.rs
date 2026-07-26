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
pub fn issue_session_token(user_id: Uuid, jwt_secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
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

/// Resolve the effective `user_id` for a data request. A session JWT (from the
/// dashboard) or an API key (from a CLI/extension) always wins over whatever `user_id`
/// the client claims in the query string or JSON body — otherwise the header would be
/// decorative and any caller could still impersonate another user by just setting that
/// field. Falls back to the client-supplied value (or `Uuid::nil()`) when neither is
/// presented, so existing `?user_id=` callers keep working during rollout.
pub fn resolve_user_id(state: &AppState, headers: &HeaderMap, client_supplied: Option<Uuid>) -> Uuid {
    if let Some(token) = extract_key(headers) {
        if let Some(user_id) = verify_session_token(&token, &state.config.jwt_secret) {
            return user_id;
        }
        let hash = hash_key(&token);
        if let Some(user_id) = state.auth_cache.lookup(&hash) {
            return user_id;
        }
    }

    client_supplied.unwrap_or(Uuid::nil())
}

/// Like `resolve_user_id`, but for endpoints that must refuse to act at all without a
/// real logged-in session — API key generation being the main one, since letting that
/// endpoint fall back to a client-supplied `user_id` would let anyone mint a key for any
/// account.
pub fn require_session_user(state: &AppState, headers: &HeaderMap) -> Option<Uuid> {
    let token = extract_key(headers)?;
    verify_session_token(&token, &state.config.jwt_secret)
}

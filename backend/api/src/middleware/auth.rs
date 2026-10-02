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

/// Prefix WakaTime itself uses; wakatime-cli refuses any key not shaped
/// `^(waka_)?<uuid v4>$` before sending a request, so user API keys use it.
pub const WAKATIME_API_KEY_PREFIX: &str = "waka_";

/// A user API key that wakatime-cli and WakaTime plugins accept: `waka_` plus a
/// CSPRNG UUIDv4 (122 random bits). Keys minted with [`generate_key`] keep
/// working; lookup is by `hash_key` of the whole string, whatever its shape.
pub fn generate_wakatime_api_key() -> String {
    format!("{WAKATIME_API_KEY_PREFIX}{}", Uuid::new_v4())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Debug, Serialize, Deserialize)]
struct SessionClaims {
    sub: Uuid,
    exp: i64,
    jti: Uuid,
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
        jti: Uuid::now_v7(),
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

/// Credentials are resolved against the authoritative store on each request. A process
/// cache must never extend a revoked credential's lifetime or hide a newly issued key.
#[derive(Debug, PartialEq, Eq)]
pub enum CredentialKind {
    Session,
    ApiKey,
    OAuth(Vec<String>),
}

#[derive(Debug)]
pub struct AuthContext {
    pub user_id: Uuid,
    pub kind: CredentialKind,
}

impl AuthContext {
    pub fn allows(&self, scope: &str) -> bool {
        match &self.kind {
            CredentialKind::Session | CredentialKind::ApiKey => true,
            CredentialKind::OAuth(scopes) => scopes.iter().any(|s| s == scope || s == "*"),
        }
    }
}

pub async fn resolve_context(state: &AppState, headers: &HeaderMap) -> Option<AuthContext> {
    let token = extract_key(headers)?;
    let session_user = verify_session_token(&token, &state.config.jwt_secret);
    let hash = hash_key(&token);
    if let Some(postgres) = &state.postgres {
        if let Some(user_id) = session_user {
            let active = postgres
                .client()
                .query_opt(
                    "SELECT 1 FROM users u JOIN sessions s ON s.user_id = u.id
                 WHERE u.id = $1 AND u.is_active AND u.deleted_at IS NULL
                   AND s.token_hash = $2 AND s.revoked_at IS NULL AND s.expires_at > now()",
                    &[&user_id, &hash],
                )
                .await
                .ok()??;
            let _ = active;
            return Some(AuthContext {
                user_id,
                kind: CredentialKind::Session,
            });
        }
        let row = postgres
            .client()
            .query_opt(
                "SELECT k.user_id, NULL::text[] AS scopes FROM api_keys k
             JOIN users u ON u.id = k.user_id
             WHERE k.key_hash = $1 AND k.revoked_at IS NULL
               AND (k.expires_at IS NULL OR k.expires_at > now())
               AND u.is_active AND u.deleted_at IS NULL
             UNION ALL
             SELECT t.user_id, t.scopes FROM oauth_access_tokens t
             JOIN users u ON u.id = t.user_id JOIN oauth_apps a ON a.id = t.app_id
             WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND t.expires_at > now()
               AND a.revoked_at IS NULL AND u.is_active AND u.deleted_at IS NULL
             LIMIT 1",
                &[&hash],
            )
            .await
            .ok()??;
        let scopes: Option<Vec<String>> = row.get("scopes");
        return Some(AuthContext {
            user_id: row.get("user_id"),
            kind: scopes
                .map(CredentialKind::OAuth)
                .unwrap_or(CredentialKind::ApiKey),
        });
    }
    #[derive(Deserialize, clickhouse::Row)]
    struct Identity {
        #[serde(with = "clickhouse::serde::uuid")]
        user_id: Uuid,
    }
    let client = state.clickhouse.get_client();
    let query = if let Some(user_id) = session_user {
        client
            .query(
                "SELECT user_id FROM wakaclock.users FINAL WHERE user_id = ? AND is_active LIMIT 1",
            )
            .bind(user_id)
    } else {
        client.query("SELECT user_id FROM wakaclock.users FINAL WHERE api_key = ? AND api_key != '' AND is_active LIMIT 1").bind(hash)
    };
    let identity = query.fetch_optional::<Identity>().await.ok()??;
    Some(AuthContext {
        user_id: identity.user_id,
        kind: if session_user.is_some() {
            CredentialKind::Session
        } else {
            CredentialKind::ApiKey
        },
    })
}

pub async fn resolve_user_id(state: &AppState, headers: &HeaderMap) -> Option<Uuid> {
    Some(resolve_context(state, headers).await?.user_id)
}

pub async fn require_scoped_user(
    state: &AppState,
    headers: &HeaderMap,
    scope: &str,
) -> Result<Uuid, (axum::http::StatusCode, axum::Json<serde_json::Value>)> {
    let context = resolve_context(state, headers)
        .await
        .ok_or_else(unauthorized)?;
    if !context.allows(scope) {
        return Err(forbidden_scope(scope));
    }
    Ok(context.user_id)
}

/// First-party account operations are never authorized by a third-party OAuth grant.
pub async fn require_account_user(state: &AppState, headers: &HeaderMap) -> Option<Uuid> {
    let context = resolve_context(state, headers).await?;
    (!matches!(context.kind, CredentialKind::OAuth(_))).then_some(context.user_id)
}

pub async fn require_session_user(state: &AppState, headers: &HeaderMap) -> Option<Uuid> {
    let context = resolve_context(state, headers).await?;
    (context.kind == CredentialKind::Session).then_some(context.user_id)
}

pub async fn require_scope(state: &AppState, headers: &HeaderMap, scope: &str) -> bool {
    resolve_context(state, headers)
        .await
        .is_some_and(|context| context.allows(scope))
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

/// Trust forwarding information only from an explicitly configured proxy. Walk
/// from the nearest hop so a client cannot prepend a fabricated address.
pub fn client_ip(
    peer: std::net::IpAddr,
    headers: &HeaderMap,
    trusted: &[std::net::IpAddr],
) -> std::net::IpAddr {
    if !trusted.contains(&peer) {
        return peer;
    }
    let Some(raw) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) else {
        return peer;
    };
    let Ok(hops) = raw
        .split(',')
        .map(|value| value.trim().parse::<std::net::IpAddr>())
        .collect::<Result<Vec<_>, _>>()
    else {
        return peer;
    };
    if hops.len() > 32 {
        return peer;
    }
    hops.into_iter()
        .rev()
        .find(|ip| !trusted.contains(ip))
        .unwrap_or(peer)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wakatime_api_keys_match_the_format_wakatime_cli_enforces() {
        // pkg/params/params.go apiKeyRegex in wakatime-cli.
        let is_valid_for_cli = |key: &str| {
            let Some(uuid) = key.strip_prefix("waka_") else {
                return false;
            };
            let bytes = uuid.as_bytes();
            uuid.len() == 36
                && [8, 13, 18, 23].iter().all(|&i| bytes[i] == b'-')
                && bytes[14] == b'4'
                && matches!(bytes[19], b'8' | b'9' | b'a' | b'b')
                && uuid
                    .bytes()
                    .all(|b| b == b'-' || b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        };
        let first = generate_wakatime_api_key();
        let second = generate_wakatime_api_key();
        assert!(is_valid_for_cli(&first), "{first}");
        assert_ne!(first, second);
        assert_ne!(hash_key(&first), hash_key(&second));
        assert!(!is_valid_for_cli(&generate_key()));
    }

    #[test]
    fn forwarding_headers_require_a_trusted_peer_and_ignore_forged_prefixes() {
        let peer = "10.0.0.1".parse().unwrap();
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            "203.0.113.99, 198.51.100.7, 10.0.0.2".parse().unwrap(),
        );
        assert_eq!(client_ip(peer, &headers, &[]), peer);
        assert_eq!(
            client_ip(peer, &headers, &[peer, "10.0.0.2".parse().unwrap()]),
            "198.51.100.7".parse::<std::net::IpAddr>().unwrap()
        );
        headers.insert("x-forwarded-for", "invalid".parse().unwrap());
        assert_eq!(client_ip(peer, &headers, &[peer]), peer);
    }

    #[test]
    fn oauth_grants_cannot_inherit_account_privileges() {
        for scopes in [vec![], vec!["read_goals".to_string()]] {
            let context = AuthContext {
                user_id: Uuid::nil(),
                kind: CredentialKind::OAuth(scopes),
            };
            assert!(!context.allows("write_logged_time"));
            assert!(!context.allows("export_data"));
            assert!(!context.allows("manage_integrations"));
        }
        let context = AuthContext {
            user_id: Uuid::nil(),
            kind: CredentialKind::OAuth(vec!["read_goals".into()]),
        };
        assert!(context.allows("read_goals"));
    }

    #[test]
    fn sessions_issued_in_the_same_second_are_independently_revocable() {
        let secret = "test-only-long-secret-for-jwt-signing";
        let user = Uuid::now_v7();
        let first = issue_session_token(user, secret).unwrap();
        let second = issue_session_token(user, secret).unwrap();
        assert_ne!(first, second);
        assert_eq!(verify_session_token(&first, secret), Some(user));
        assert_eq!(verify_session_token(&first, "wrong-secret"), None);
    }
}

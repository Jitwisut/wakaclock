use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{Duration, Utc};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::middleware::auth;

pub const DEFAULT_SCOPES: &[&str] = &["read_logged_time"];
pub const SUPPORTED_SCOPES: &[&str] = &[
    "email",
    "read_logged_time",
    "write_logged_time",
    "read_stats",
    "read_summaries",
    "read_projects",
    "read_goals",
    "write_goals",
    "read_orgs",
    "read_org_members",
    "read_org_dashboards",
    "read_private_leaderboards",
    "read_external_durations",
    "write_external_durations",
    "read_ai_analytics",
    "manage_integrations",
    "export_data",
];

#[derive(Debug, Serialize)]
pub struct RegisteredApp {
    pub client_id: String,
    pub client_secret: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeveloperAppSummary {
    pub client_id: String,
    pub name: String,
    pub confidential: bool,
    pub created_at: chrono::DateTime<Utc>,
    pub revoked_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: &'static str,
    pub expires_in: i64,
    pub refresh_token: String,
    pub scope: String,
}

#[derive(Debug, Serialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: i64,
    pub interval: i32,
}

struct TokenMaterial {
    access_token: String,
    access_token_hash: String,
    access_id: Uuid,
    refresh_token: String,
    refresh_token_hash: String,
    refresh_id: Uuid,
    expires_at: chrono::DateTime<Utc>,
    refresh_expires_at: chrono::DateTime<Utc>,
    scopes: Vec<String>,
}

impl TokenMaterial {
    fn new(scopes: &[String]) -> Self {
        let access_token = auth::generate_key();
        let refresh_token = auth::generate_key();
        Self {
            access_token_hash: auth::hash_key(&access_token),
            refresh_token_hash: auth::hash_key(&refresh_token),
            access_token,
            access_id: Uuid::now_v7(),
            refresh_token,
            refresh_id: Uuid::now_v7(),
            expires_at: Utc::now() + Duration::hours(1),
            refresh_expires_at: Utc::now() + Duration::days(30),
            scopes: scopes.to_vec(),
        }
    }

    fn into_response(self) -> TokenResponse {
        TokenResponse {
            access_token: self.access_token,
            token_type: "Bearer",
            expires_in: 3_600,
            refresh_token: self.refresh_token,
            scope: self.scopes.join(" "),
        }
    }
}

pub struct OAuthService {
    postgres: Option<Arc<PostgresClient>>,
}

impl OAuthService {
    pub fn new(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self { postgres }
    }

    pub async fn register_app(
        &self,
        owner_user_id: Uuid,
        name: &str,
        redirect_uris: &[String],
        confidential: bool,
    ) -> Result<RegisteredApp> {
        if name.trim().is_empty() || redirect_uris.is_empty() {
            return Err(anyhow!("name and at least one redirect URI are required"));
        }
        for uri in redirect_uris {
            validate_redirect_uri(uri)?;
        }
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let client_id = format!("atoaxis_{}", random_token_suffix());
        let client_secret = confidential.then(auth::generate_key);
        let client_secret_hash = client_secret.as_deref().map(auth::hash_key);
        let redirect_values = redirect_uris.to_vec();
        postgres
            .client()
            .execute(
                "WITH app AS (
                     INSERT INTO oauth_apps
                         (id, owner_user_id, name, client_id, client_secret_hash, is_confidential)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id
                 )
                 INSERT INTO oauth_redirect_uris (app_id, redirect_uri)
                 SELECT app.id, redirect_uri
                 FROM app
                 CROSS JOIN unnest($7::text[]) AS redirect_uri
                 ON CONFLICT (app_id, redirect_uri) DO NOTHING",
                &[
                    &id,
                    &owner_user_id,
                    &name.trim(),
                    &client_id,
                    &client_secret_hash,
                    &confidential,
                    &redirect_values,
                ],
            )
            .await
            .context("failed to register OAuth application and redirect URIs atomically")?;
        Ok(RegisteredApp {
            client_id,
            client_secret,
        })
    }

    pub async fn list_apps(&self, owner_user_id: Uuid) -> Result<Vec<DeveloperAppSummary>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT client_id, name, is_confidential, created_at, revoked_at
                 FROM oauth_apps WHERE owner_user_id = $1 ORDER BY created_at DESC",
                &[&owner_user_id],
            )
            .await
            .context("failed to list OAuth applications")?;
        rows.into_iter()
            .map(|row| {
                Ok(DeveloperAppSummary {
                    client_id: row.get("client_id"),
                    name: row.get("name"),
                    confidential: row.get("is_confidential"),
                    created_at: row.get("created_at"),
                    revoked_at: row.get("revoked_at"),
                })
            })
            .collect()
    }

    pub async fn revoke_app(
        &self,
        owner_user_id: Uuid,
        client_id: &str,
    ) -> Result<Option<Vec<String>>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_one(
                "WITH app AS (
                     UPDATE oauth_apps
                     SET revoked_at = now()
                     WHERE owner_user_id = $1 AND client_id = $2 AND revoked_at IS NULL
                     RETURNING id
                 ), revoked_access AS (
                     UPDATE oauth_access_tokens t
                     SET revoked_at = COALESCE(t.revoked_at, now())
                     FROM app
                     WHERE t.app_id = app.id
                     RETURNING t.token_hash
                 ), revoked_refresh AS (
                     UPDATE oauth_refresh_tokens r
                     SET revoked_at = COALESCE(r.revoked_at, now())
                     FROM oauth_access_tokens t, app
                     WHERE r.access_token_id = t.id AND t.app_id = app.id
                     RETURNING r.id
                 )
                 SELECT EXISTS(SELECT 1 FROM app) AS app_revoked,
                        COALESCE(
                            (SELECT array_agg(token_hash) FROM revoked_access),
                            ARRAY[]::text[]
                        ) AS access_hashes,
                        (SELECT count(*) FROM revoked_refresh) AS revoked_refresh_count",
                &[&owner_user_id, &client_id],
            )
            .await
            .context("failed to revoke OAuth application and grants atomically")?;
        let revoked: bool = row.get("app_revoked");
        if !revoked {
            return Ok(None);
        }
        let access_hashes: Vec<String> = row.get("access_hashes");
        Ok(Some(access_hashes))
    }

    pub async fn authorize(
        &self,
        user_id: Uuid,
        client_id: &str,
        redirect_uri: &str,
        scopes: &[String],
        code_challenge: Option<&str>,
        code_challenge_method: Option<&str>,
    ) -> Result<String> {
        let postgres = self.required()?;
        validate_scopes(scopes)?;
        let app = postgres
            .client()
            .query_opt(
                "SELECT id FROM oauth_apps
                 WHERE client_id = $1 AND revoked_at IS NULL",
                &[&client_id],
            )
            .await
            .context("failed to resolve OAuth application")?
            .ok_or_else(|| anyhow!("unknown OAuth client_id"))?;
        let app_id: Uuid = app.get("id");
        let redirect_exists = postgres
            .client()
            .query_opt(
                "SELECT 1 FROM oauth_redirect_uris WHERE app_id = $1 AND redirect_uri = $2",
                &[&app_id, &redirect_uri],
            )
            .await
            .context("failed to validate OAuth redirect URI")?
            .is_some();
        if !redirect_exists {
            return Err(anyhow!("redirect_uri is not registered"));
        }
        if code_challenge.is_none() || code_challenge_method != Some("S256") {
            return Err(anyhow!("authorization code flow requires PKCE S256"));
        }

        let code = auth::generate_key();
        let expires_at = Utc::now() + Duration::minutes(5);
        let scope_array: Vec<String> = scopes.to_vec();
        postgres
            .client()
            .execute(
                "WITH authorization_code AS (
                     INSERT INTO oauth_authorization_codes
                         (code_hash, app_id, user_id, redirect_uri, code_challenge,
                          code_challenge_method, scopes, expires_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     RETURNING app_id, user_id
                 )
                 INSERT INTO oauth_consents (app_id, user_id, scopes, granted_at, revoked_at)
                 SELECT app_id, user_id, $7, now(), NULL FROM authorization_code
                 ON CONFLICT (app_id, user_id)
                 DO UPDATE SET scopes = EXCLUDED.scopes, granted_at = now(), revoked_at = NULL",
                &[
                    &auth::hash_key(&code),
                    &app_id,
                    &user_id,
                    &redirect_uri,
                    &code_challenge,
                    &code_challenge_method,
                    &scope_array,
                    &expires_at,
                ],
            )
            .await
            .context("failed to persist OAuth authorization and consent atomically")?;
        Ok(code)
    }

    pub async fn exchange_code(
        &self,
        code: &str,
        client_id: &str,
        redirect_uri: &str,
        code_verifier: Option<&str>,
        client_secret: Option<&str>,
    ) -> Result<(TokenResponse, Uuid)> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT c.code_hash, c.app_id, c.user_id, c.redirect_uri,
                        c.code_challenge, c.scopes, c.expires_at,
                        a.client_id, a.client_secret_hash, a.is_confidential
                 FROM oauth_authorization_codes c
                 JOIN oauth_apps a ON a.id = c.app_id
                 WHERE c.code_hash = $1 AND c.consumed_at IS NULL AND c.expires_at > now()
                   AND a.client_id = $2 AND a.revoked_at IS NULL",
                &[&auth::hash_key(code), &client_id],
            )
            .await
            .context("failed to load OAuth authorization code")?
            .ok_or_else(|| anyhow!("authorization code is invalid or expired"))?;
        let app_id: Uuid = row.get("app_id");
        let user_id: Uuid = row.get("user_id");
        let stored_redirect: String = row.get("redirect_uri");
        if stored_redirect != redirect_uri {
            return Err(anyhow!("redirect_uri does not match authorization request"));
        }
        let is_confidential: bool = row.get("is_confidential");
        if is_confidential {
            let expected: Option<String> = row.get("client_secret_hash");
            let provided = client_secret.ok_or_else(|| anyhow!("client_secret is required"))?;
            let provided_hash = auth::hash_key(provided);
            if expected.as_deref() != Some(provided_hash.as_str()) {
                return Err(anyhow!("client_secret is invalid"));
            }
        }
        let challenge: Option<String> = row.get("code_challenge");
        if let Some(challenge) = challenge {
            let verifier = code_verifier.ok_or_else(|| anyhow!("code_verifier is required"))?;
            if pkce_challenge(verifier) != challenge {
                return Err(anyhow!("code_verifier is invalid"));
            }
        }
        let scopes: Vec<String> = row.get("scopes");
        let tokens = TokenMaterial::new(&scopes);
        let code_hash = auth::hash_key(code);
        let issued = postgres
            .client()
            .query_opt(
                "WITH consumed AS (
                     UPDATE oauth_authorization_codes c
                     SET consumed_at = now()
                     WHERE c.code_hash = $1 AND c.consumed_at IS NULL AND c.expires_at > now()
                       AND EXISTS (
                           SELECT 1 FROM oauth_apps a
                           WHERE a.id = c.app_id AND a.revoked_at IS NULL
                       )
                     RETURNING 1
                 ), access AS (
                     INSERT INTO oauth_access_tokens
                         (id, app_id, user_id, token_hash, scopes, expires_at)
                     SELECT $2, $3, $4, $5, $6, $7 FROM consumed
                     RETURNING id
                 )
                 INSERT INTO oauth_refresh_tokens
                     (id, access_token_id, token_hash, expires_at)
                 SELECT $8, id, $9, $10 FROM access
                 RETURNING id",
                &[
                    &code_hash,
                    &tokens.access_id,
                    &app_id,
                    &user_id,
                    &tokens.access_token_hash,
                    &tokens.scopes,
                    &tokens.expires_at,
                    &tokens.refresh_id,
                    &tokens.refresh_token_hash,
                    &tokens.refresh_expires_at,
                ],
            )
            .await
            .context("failed to consume OAuth authorization code and issue tokens atomically")?;
        if issued.is_none() {
            return Err(anyhow!("authorization code has already been consumed"));
        }
        Ok((tokens.into_response(), user_id))
    }

    pub async fn refresh(
        &self,
        refresh_token: &str,
        client_id: &str,
        client_secret: Option<&str>,
    ) -> Result<(TokenResponse, Uuid)> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT r.id, r.access_token_id, a.id AS app_id, a.client_secret_hash,
                        a.is_confidential, t.user_id, t.scopes
                 FROM oauth_refresh_tokens r
                 JOIN oauth_access_tokens t ON t.id = r.access_token_id
                 JOIN oauth_apps a ON a.id = t.app_id
                 WHERE r.token_hash = $1 AND r.revoked_at IS NULL AND r.expires_at > now()
                   AND a.client_id = $2 AND a.revoked_at IS NULL",
                &[&auth::hash_key(refresh_token), &client_id],
            )
            .await
            .context("failed to load OAuth refresh token")?
            .ok_or_else(|| anyhow!("refresh token is invalid or expired"))?;
        let is_confidential: bool = row.get("is_confidential");
        if is_confidential {
            let expected: Option<String> = row.get("client_secret_hash");
            let provided = client_secret.ok_or_else(|| anyhow!("client_secret is required"))?;
            let provided_hash = auth::hash_key(provided);
            if expected.as_deref() != Some(provided_hash.as_str()) {
                return Err(anyhow!("client_secret is invalid"));
            }
        }
        let refresh_hash = auth::hash_key(refresh_token);
        let app_id: Uuid = row.get("app_id");
        let user_id: Uuid = row.get("user_id");
        let scopes: Vec<String> = row.get("scopes");
        let tokens = TokenMaterial::new(&scopes);
        let issued = postgres
            .client()
            .query_opt(
                "WITH rotated AS (
                     UPDATE oauth_refresh_tokens r
                     SET revoked_at = now()
                     FROM oauth_access_tokens t, oauth_apps a
                     WHERE r.token_hash = $1 AND r.revoked_at IS NULL AND r.expires_at > now()
                       AND t.id = r.access_token_id AND a.id = t.app_id
                       AND a.client_id = $2 AND a.revoked_at IS NULL
                     RETURNING 1
                 ), access AS (
                     INSERT INTO oauth_access_tokens
                         (id, app_id, user_id, token_hash, scopes, expires_at)
                     SELECT $3, $4, $5, $6, $7, $8 FROM rotated
                     RETURNING id
                 )
                 INSERT INTO oauth_refresh_tokens
                     (id, access_token_id, token_hash, expires_at)
                 SELECT $9, id, $10, $11 FROM access
                 RETURNING id",
                &[
                    &refresh_hash,
                    &client_id,
                    &tokens.access_id,
                    &app_id,
                    &user_id,
                    &tokens.access_token_hash,
                    &tokens.scopes,
                    &tokens.expires_at,
                    &tokens.refresh_id,
                    &tokens.refresh_token_hash,
                    &tokens.refresh_expires_at,
                ],
            )
            .await
            .context("failed to rotate OAuth refresh token and issue replacement atomically")?;
        if issued.is_none() {
            return Err(anyhow!("refresh token has already been rotated"));
        }
        Ok((tokens.into_response(), user_id))
    }

    pub async fn revoke(&self, token: &str) -> Result<Vec<String>> {
        let postgres = self.required()?;
        let hash = auth::hash_key(token);
        let rows = postgres
            .client()
            .query(
                "WITH target_refresh AS (
                     SELECT access_token_id
                     FROM oauth_refresh_tokens
                     WHERE token_hash = $1
                 ), revoked_access AS (
                     UPDATE oauth_access_tokens
                     SET revoked_at = COALESCE(revoked_at, now())
                     WHERE token_hash = $1
                        OR id IN (SELECT access_token_id FROM target_refresh)
                     RETURNING token_hash
                 ), revoked_refresh AS (
                     UPDATE oauth_refresh_tokens
                     SET revoked_at = COALESCE(revoked_at, now())
                     WHERE token_hash = $1
                     RETURNING token_hash
                 )
                 SELECT token_hash FROM revoked_access
                 UNION
                 SELECT token_hash FROM revoked_refresh",
                &[&hash],
            )
            .await
            .context("failed to revoke OAuth token family atomically")?;
        Ok(rows.into_iter().map(|row| row.get("token_hash")).collect())
    }

    pub async fn issue_device_code(
        &self,
        client_id: &str,
        scopes: &[String],
        verification_uri: &str,
    ) -> Result<DeviceCodeResponse> {
        validate_scopes(scopes)?;
        let postgres = self.required()?;
        let app = postgres
            .client()
            .query_opt(
                "SELECT id, is_confidential FROM oauth_apps
                 WHERE client_id = $1 AND revoked_at IS NULL",
                &[&client_id],
            )
            .await
            .context("failed to resolve OAuth device client")?
            .ok_or_else(|| anyhow!("unknown OAuth client_id"))?;
        let is_confidential: bool = app.get("is_confidential");
        if is_confidential {
            return Err(anyhow!("OAuth device flow requires a public client"));
        }
        let app_id: Uuid = app.get("id");
        let device_code = auth::generate_key();
        let user_code = device_user_code();
        let expires_at = Utc::now() + Duration::minutes(10);
        let scope_values = scopes.to_vec();
        postgres
            .client()
            .execute(
                "INSERT INTO oauth_device_codes
                    (device_code_hash, user_code, app_id, scopes, expires_at)
                 VALUES ($1, $2, $3, $4, $5)",
                &[
                    &auth::hash_key(&device_code),
                    &user_code,
                    &app_id,
                    &scope_values,
                    &expires_at,
                ],
            )
            .await
            .context("failed to persist OAuth device code")?;
        Ok(DeviceCodeResponse {
            device_code,
            user_code,
            verification_uri: verification_uri.to_string(),
            expires_in: 600,
            interval: 5,
        })
    }

    pub async fn approve_device_code(&self, user_id: Uuid, user_code: &str) -> Result<()> {
        let postgres = self.required()?;
        let normalized_code = normalize_device_user_code(user_code)
            .ok_or_else(|| anyhow!("device code is invalid or expired"))?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE oauth_device_codes SET user_id = $1
                 WHERE user_code = $2 AND user_id IS NULL AND consumed_at IS NULL
                   AND expires_at > now()",
                &[&user_id, &normalized_code],
            )
            .await
            .context("failed to approve OAuth device code")?;
        if changed == 1 {
            Ok(())
        } else {
            Err(anyhow!("device code is invalid or expired"))
        }
    }

    pub async fn exchange_device_code(
        &self,
        device_code: &str,
        client_id: &str,
    ) -> Result<(TokenResponse, Uuid)> {
        let postgres = self.required()?;
        let device_hash = auth::hash_key(device_code);
        // Claim this poll atomically. Two concurrent requests cannot both observe an old
        // last_polled_at value and bypass the device-flow polling interval.
        let row = postgres
            .client()
            .query_opt(
                "UPDATE oauth_device_codes d
                 SET last_polled_at = now()
                 FROM oauth_apps a
                 WHERE d.device_code_hash = $1 AND d.app_id = a.id AND a.client_id = $2
                   AND a.revoked_at IS NULL
                   AND d.consumed_at IS NULL AND d.expires_at > now()
                   AND (
                       d.last_polled_at IS NULL
                       OR d.last_polled_at <= now() - (d.interval_seconds * interval '1 second')
                   )
                 RETURNING d.app_id, d.user_id, d.scopes",
                &[&device_hash, &client_id],
            )
            .await
            .context("failed to claim OAuth device poll")?;
        let row = match row {
            Some(row) => row,
            None => {
                let still_valid = postgres
                    .client()
                    .query_opt(
                        "SELECT 1
                         FROM oauth_device_codes d
                         JOIN oauth_apps a ON a.id = d.app_id
                         WHERE d.device_code_hash = $1 AND a.client_id = $2
                           AND a.revoked_at IS NULL
                           AND d.consumed_at IS NULL AND d.expires_at > now()",
                        &[&device_hash, &client_id],
                    )
                    .await
                    .context("failed to classify OAuth device poll")?;
                if still_valid.is_some() {
                    return Err(anyhow!("slow_down"));
                }
                return Err(anyhow!("invalid_grant"));
            }
        };
        let user_id: Option<Uuid> = row.get("user_id");
        let Some(user_id) = user_id else {
            return Err(anyhow!("authorization_pending"));
        };
        let app_id: Uuid = row.get("app_id");
        let scopes: Vec<String> = row.get("scopes");
        let tokens = TokenMaterial::new(&scopes);
        let issued = postgres
            .client()
            .query_opt(
                "WITH consumed AS (
                     UPDATE oauth_device_codes d
                     SET consumed_at = now()
                     FROM oauth_apps a
                     WHERE d.device_code_hash = $1 AND d.app_id = a.id AND a.client_id = $2
                       AND a.revoked_at IS NULL
                       AND d.consumed_at IS NULL AND d.expires_at > now()
                     RETURNING 1
                 ), access AS (
                     INSERT INTO oauth_access_tokens
                         (id, app_id, user_id, token_hash, scopes, expires_at)
                     SELECT $3, $4, $5, $6, $7, $8 FROM consumed
                     RETURNING id
                 )
                 INSERT INTO oauth_refresh_tokens
                     (id, access_token_id, token_hash, expires_at)
                 SELECT $9, id, $10, $11 FROM access
                 RETURNING id",
                &[
                    &device_hash,
                    &client_id,
                    &tokens.access_id,
                    &app_id,
                    &user_id,
                    &tokens.access_token_hash,
                    &tokens.scopes,
                    &tokens.expires_at,
                    &tokens.refresh_id,
                    &tokens.refresh_token_hash,
                    &tokens.refresh_expires_at,
                ],
            )
            .await
            .context("failed to consume OAuth device code and issue tokens atomically")?;
        if issued.is_none() {
            return Err(anyhow!("invalid_grant"));
        }
        Ok((tokens.into_response(), user_id))
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn validate_scopes(scopes: &[String]) -> Result<()> {
    if scopes.is_empty() {
        return Err(anyhow!("at least one OAuth scope is required"));
    }
    if let Some(scope) = scopes
        .iter()
        .find(|scope| !SUPPORTED_SCOPES.contains(&scope.as_str()))
    {
        return Err(anyhow!("unsupported OAuth scope: {scope}"));
    }
    Ok(())
}

fn validate_redirect_uri(uri: &str) -> Result<()> {
    let parsed: axum::http::Uri = uri.parse().context("redirect URI is invalid")?;
    if parsed.scheme_str() != Some("https")
        && parsed.host() != Some("localhost")
        && parsed.host() != Some("127.0.0.1")
    {
        return Err(anyhow!("redirect URI must use HTTPS or localhost"));
    }
    Ok(())
}

fn pkce_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn random_token_suffix() -> String {
    auth::generate_key()
        .trim_start_matches(auth::API_KEY_PREFIX)
        .to_string()
}

fn device_user_code() -> String {
    let raw = Uuid::new_v4().simple().to_string().to_ascii_uppercase();
    format!("{}-{}", &raw[..4], &raw[4..8])
}

fn normalize_device_user_code(value: &str) -> Option<String> {
    let compact: String = value
        .chars()
        .filter(|ch| !ch.is_ascii_whitespace() && *ch != '-')
        .map(|ch| ch.to_ascii_uppercase())
        .collect();
    if compact.len() != 8 || !compact.chars().all(|ch| ch.is_ascii_alphanumeric()) {
        return None;
    }
    Some(format!("{}-{}", &compact[..4], &compact[4..]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_s256_matches_rfc7636_shape() {
        assert_eq!(
            pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn redirect_uri_validation_rejects_non_web_origins() {
        assert!(validate_redirect_uri("https://example.com/callback").is_ok());
        assert!(validate_redirect_uri("http://localhost:3000/callback").is_ok());
        assert!(validate_redirect_uri("file:///tmp/callback").is_err());
        assert!(validate_redirect_uri("http://evil.example/callback").is_err());
    }

    #[test]
    fn unsupported_scope_is_rejected() {
        assert!(validate_scopes(&["read_stats".to_string()]).is_ok());
        assert!(validate_scopes(&["admin".to_string()]).is_err());
    }

    #[test]
    fn device_user_code_normalization_preserves_the_server_contract() {
        assert_eq!(
            normalize_device_user_code("  abcd-efgh  "),
            Some("ABCD-EFGH".to_string())
        );
        assert_eq!(
            normalize_device_user_code("abcd efgh"),
            Some("ABCD-EFGH".to_string())
        );
        assert_eq!(normalize_device_user_code("abc"), None);
        assert_eq!(normalize_device_user_code("abcd-efg!"), None);
    }

    #[tokio::test]
    #[ignore = "requires an isolated PostgreSQL instance via POSTGRES_TEST_URL"]
    async fn postgres_oauth_grants_are_atomic_and_revocation_purges_token_families() {
        use crate::config::PostgresConfig;

        let url = std::env::var("POSTGRES_TEST_URL")
            .expect("POSTGRES_TEST_URL must point at an isolated PostgreSQL database");
        let postgres = Arc::new(
            PostgresClient::connect(&PostgresConfig {
                url: Some(url),
                max_connections: 1,
            })
            .await
            .expect("connect test PostgreSQL"),
        );
        postgres.migrate().await.expect("migrate test PostgreSQL");

        let user_id = Uuid::now_v7();
        let username = format!("oauth-test-{user_id}");
        postgres
            .client()
            .execute(
                "INSERT INTO users (id, username) VALUES ($1, $2)",
                &[&user_id, &username],
            )
            .await
            .expect("seed OAuth test user");

        let service = Arc::new(OAuthService::new(Some(postgres.clone())));
        let redirect = "https://example.com/oauth/callback".to_string();
        let public_app = service
            .register_app(
                user_id,
                "OAuth integration public app",
                &[redirect.clone(), redirect.clone()],
                false,
            )
            .await
            .expect("register public OAuth app with duplicate redirect input");
        let redirect_count: i64 = postgres
            .client()
            .query_one(
                "SELECT count(*)::bigint AS count
                 FROM oauth_redirect_uris r
                 JOIN oauth_apps a ON a.id = r.app_id
                 WHERE a.client_id = $1",
                &[&public_app.client_id],
            )
            .await
            .expect("count redirect URIs")
            .get("count");
        assert_eq!(
            redirect_count, 1,
            "duplicate redirect URIs must be idempotent"
        );

        let confidential_app = service
            .register_app(
                user_id,
                "OAuth integration confidential app",
                &["https://example.com/confidential".to_string()],
                true,
            )
            .await
            .expect("register confidential OAuth app");
        let device_scopes = vec!["write_logged_time".to_string()];
        let confidential_device = service
            .issue_device_code(
                &confidential_app.client_id,
                &device_scopes,
                "https://atoaxis.com/device",
            )
            .await;
        assert!(confidential_device
            .expect_err("confidential clients must not use device flow")
            .to_string()
            .contains("public client"));

        let device = service
            .issue_device_code(
                &public_app.client_id,
                &device_scopes,
                "https://atoaxis.com/device",
            )
            .await
            .expect("issue public device code");
        let (first_poll, second_poll) = tokio::join!(
            service.exchange_device_code(&device.device_code, &public_app.client_id),
            service.exchange_device_code(&device.device_code, &public_app.client_id)
        );
        let poll_errors = [first_poll, second_poll]
            .into_iter()
            .map(|result| {
                result
                    .expect_err("unapproved device poll must not issue tokens")
                    .to_string()
            })
            .collect::<Vec<_>>();
        assert!(poll_errors
            .iter()
            .any(|error| error == "authorization_pending"));
        assert!(poll_errors.iter().any(|error| error == "slow_down"));

        service
            .approve_device_code(user_id, &device.user_code)
            .await
            .expect("approve device code");
        postgres
            .client()
            .execute(
                "UPDATE oauth_device_codes SET last_polled_at = NULL WHERE device_code_hash = $1",
                &[&auth::hash_key(&device.device_code)],
            )
            .await
            .expect("reset poll timestamp for deterministic test");
        let (device_tokens, device_user_id) = service
            .exchange_device_code(&device.device_code, &public_app.client_id)
            .await
            .expect("redeem approved device code");
        assert_eq!(device_user_id, user_id);
        assert!(service
            .exchange_device_code(&device.device_code, &public_app.client_id)
            .await
            .expect_err("device code must be single-use")
            .to_string()
            .contains("invalid_grant"));

        let (refresh_a, refresh_b) = tokio::join!(
            service.refresh(&device_tokens.refresh_token, &public_app.client_id, None),
            service.refresh(&device_tokens.refresh_token, &public_app.client_id, None)
        );
        let refresh_successes = [refresh_a, refresh_b]
            .into_iter()
            .filter_map(Result::ok)
            .collect::<Vec<_>>();
        assert_eq!(
            refresh_successes.len(),
            1,
            "refresh rotation must have one winner"
        );
        let (replacement, _) = refresh_successes.into_iter().next().unwrap();

        let verifier = "atoaxis-oauth-integration-verifier";
        let code = service
            .authorize(
                user_id,
                &public_app.client_id,
                &redirect,
                &["read_stats".to_string()],
                Some(&pkce_challenge(verifier)),
                Some("S256"),
            )
            .await
            .expect("issue authorization code");
        let (code_a, code_b) = tokio::join!(
            service.exchange_code(
                &code,
                &public_app.client_id,
                &redirect,
                Some(verifier),
                None
            ),
            service.exchange_code(
                &code,
                &public_app.client_id,
                &redirect,
                Some(verifier),
                None
            )
        );
        assert_eq!(
            [code_a, code_b].into_iter().filter(Result::is_ok).count(),
            1,
            "authorization code must have one redemption winner"
        );

        let replacement_access_hash = auth::hash_key(&replacement.access_token);
        let revoked_hashes = service
            .revoke(&replacement.refresh_token)
            .await
            .expect("revoke refresh-token family");
        assert!(revoked_hashes.contains(&replacement_access_hash));
        let access_revoked: bool = postgres
            .client()
            .query_one(
                "SELECT revoked_at IS NOT NULL AS revoked
                 FROM oauth_access_tokens WHERE token_hash = $1",
                &[&replacement_access_hash],
            )
            .await
            .expect("load revoked access token")
            .get("revoked");
        assert!(access_revoked);

        let app_hashes = service
            .revoke_app(user_id, &public_app.client_id)
            .await
            .expect("revoke OAuth app")
            .expect("OAuth app should exist");
        assert!(
            !app_hashes.is_empty(),
            "app revocation should return access hashes to purge"
        );
        let active_tokens: i64 = postgres
            .client()
            .query_one(
                "SELECT count(*)::bigint AS count
                 FROM oauth_access_tokens t
                 JOIN oauth_apps a ON a.id = t.app_id
                 WHERE a.client_id = $1 AND t.revoked_at IS NULL",
                &[&public_app.client_id],
            )
            .await
            .expect("count active tokens after app revoke")
            .get("count");
        assert_eq!(active_tokens, 0);
    }
}

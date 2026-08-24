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
        postgres
            .client()
            .execute(
                "INSERT INTO oauth_apps
                    (id, owner_user_id, name, client_id, client_secret_hash, is_confidential)
                 VALUES ($1, $2, $3, $4, $5, $6)",
                &[
                    &id,
                    &owner_user_id,
                    &name.trim(),
                    &client_id,
                    &client_secret_hash,
                    &confidential,
                ],
            )
            .await
            .context("failed to register OAuth application")?;
        for redirect_uri in redirect_uris {
            postgres
                .client()
                .execute(
                    "INSERT INTO oauth_redirect_uris (app_id, redirect_uri) VALUES ($1, $2)",
                    &[&id, redirect_uri],
                )
                .await
                .context("failed to save OAuth redirect URI")?;
        }
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

    pub async fn revoke_app(&self, owner_user_id: Uuid, client_id: &str) -> Result<bool> {
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE oauth_apps SET revoked_at = now()
                 WHERE owner_user_id = $1 AND client_id = $2 AND revoked_at IS NULL",
                &[&owner_user_id, &client_id],
            )
            .await
            .context("failed to revoke OAuth application")?;
        Ok(changed == 1)
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
                "INSERT INTO oauth_authorization_codes
                    (code_hash, app_id, user_id, redirect_uri, code_challenge,
                     code_challenge_method, scopes, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
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
            .context("failed to persist OAuth authorization code")?;
        postgres
            .client()
            .execute(
                "INSERT INTO oauth_consents (app_id, user_id, scopes, granted_at, revoked_at)
                 VALUES ($1, $2, $3, now(), NULL)
                 ON CONFLICT (app_id, user_id)
                 DO UPDATE SET scopes = EXCLUDED.scopes, granted_at = now(), revoked_at = NULL",
                &[&app_id, &user_id, &scope_array],
            )
            .await
            .context("failed to persist OAuth consent")?;
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
        let consumed = postgres
            .client()
            .execute(
                "UPDATE oauth_authorization_codes SET consumed_at = now()
                 WHERE code_hash = $1 AND consumed_at IS NULL",
                &[&auth::hash_key(code)],
            )
            .await
            .context("failed to consume OAuth authorization code")?;
        if consumed != 1 {
            return Err(anyhow!("authorization code has already been consumed"));
        }
        let scopes: Vec<String> = row.get("scopes");
        let response = self
            .issue_tokens(postgres, app_id, user_id, &scopes)
            .await?;
        Ok((response, user_id))
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
        postgres
            .client()
            .execute(
                "UPDATE oauth_refresh_tokens SET revoked_at = now()
                 WHERE token_hash = $1 AND revoked_at IS NULL",
                &[&refresh_hash],
            )
            .await
            .context("failed to rotate OAuth refresh token")?;
        let app_id: Uuid = row.get("app_id");
        let user_id: Uuid = row.get("user_id");
        let scopes: Vec<String> = row.get("scopes");
        let response = self
            .issue_tokens(postgres, app_id, user_id, &scopes)
            .await?;
        Ok((response, user_id))
    }

    pub async fn revoke(&self, token: &str) -> Result<()> {
        let postgres = self.required()?;
        let hash = auth::hash_key(token);
        postgres
            .client()
            .execute(
                "UPDATE oauth_access_tokens
                 SET revoked_at = now()
                 WHERE token_hash = $1
                    OR id = (SELECT access_token_id FROM oauth_refresh_tokens WHERE token_hash = $1)",
                &[&hash],
            )
            .await
            .context("failed to revoke OAuth token")?;
        postgres
            .client()
            .execute(
                "UPDATE oauth_refresh_tokens SET revoked_at = now() WHERE token_hash = $1",
                &[&hash],
            )
            .await
            .context("failed to revoke OAuth refresh token")?;
        Ok(())
    }

    pub async fn issue_device_code(
        &self,
        client_id: &str,
        scopes: &[String],
    ) -> Result<DeviceCodeResponse> {
        validate_scopes(scopes)?;
        let postgres = self.required()?;
        let app = postgres
            .client()
            .query_opt(
                "SELECT id FROM oauth_apps WHERE client_id = $1 AND revoked_at IS NULL",
                &[&client_id],
            )
            .await
            .context("failed to resolve OAuth device client")?
            .ok_or_else(|| anyhow!("unknown OAuth client_id"))?;
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
            verification_uri: "/oauth/device/approve".to_string(),
            expires_in: 600,
            interval: 5,
        })
    }

    pub async fn approve_device_code(&self, user_id: Uuid, user_code: &str) -> Result<()> {
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE oauth_device_codes SET user_id = $1
                 WHERE user_code = $2 AND user_id IS NULL AND consumed_at IS NULL
                   AND expires_at > now()",
                &[&user_id, &user_code.trim().to_ascii_uppercase()],
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
        let row = postgres
            .client()
            .query_opt(
                "SELECT d.app_id, d.user_id, d.scopes, d.interval_seconds,
                        d.last_polled_at, a.client_id
                 FROM oauth_device_codes d
                 JOIN oauth_apps a ON a.id = d.app_id
                 WHERE d.device_code_hash = $1 AND a.client_id = $2
                   AND d.consumed_at IS NULL AND d.expires_at > now()",
                &[&auth::hash_key(device_code), &client_id],
            )
            .await
            .context("failed to load OAuth device code")?
            .ok_or_else(|| anyhow!("invalid_grant"))?;
        let last_polled_at: Option<chrono::DateTime<Utc>> = row.get("last_polled_at");
        if last_polled_at.is_some_and(|last| Utc::now() - last < Duration::seconds(5)) {
            return Err(anyhow!("slow_down"));
        }
        postgres
            .client()
            .execute(
                "UPDATE oauth_device_codes SET last_polled_at = now()
                 WHERE device_code_hash = $1 AND consumed_at IS NULL",
                &[&auth::hash_key(device_code)],
            )
            .await
            .context("failed to update OAuth device poll timestamp")?;
        let user_id: Option<Uuid> = row.get("user_id");
        let Some(user_id) = user_id else {
            return Err(anyhow!("authorization_pending"));
        };
        let app_id: Uuid = row.get("app_id");
        let scopes: Vec<String> = row.get("scopes");
        postgres
            .client()
            .execute(
                "UPDATE oauth_device_codes SET consumed_at = now()
                 WHERE device_code_hash = $1 AND consumed_at IS NULL",
                &[&auth::hash_key(device_code)],
            )
            .await
            .context("failed to consume OAuth device code")?;
        let response = self
            .issue_tokens(postgres, app_id, user_id, &scopes)
            .await?;
        Ok((response, user_id))
    }

    async fn issue_tokens(
        &self,
        postgres: &PostgresClient,
        app_id: Uuid,
        user_id: Uuid,
        scopes: &[String],
    ) -> Result<TokenResponse> {
        let access_token = auth::generate_key();
        let refresh_token = auth::generate_key();
        let access_id = Uuid::now_v7();
        let refresh_id = Uuid::now_v7();
        let expires_at = Utc::now() + Duration::hours(1);
        let refresh_expires_at = Utc::now() + Duration::days(30);
        let scope_values = scopes.to_vec();
        postgres
            .client()
            .execute(
                "INSERT INTO oauth_access_tokens
                    (id, app_id, user_id, token_hash, scopes, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6)",
                &[
                    &access_id,
                    &app_id,
                    &user_id,
                    &auth::hash_key(&access_token),
                    &scope_values,
                    &expires_at,
                ],
            )
            .await
            .context("failed to persist OAuth access token")?;
        postgres
            .client()
            .execute(
                "INSERT INTO oauth_refresh_tokens
                    (id, access_token_id, token_hash, expires_at)
                 VALUES ($1, $2, $3, $4)",
                &[
                    &refresh_id,
                    &access_id,
                    &auth::hash_key(&refresh_token),
                    &refresh_expires_at,
                ],
            )
            .await
            .context("failed to persist OAuth refresh token")?;
        Ok(TokenResponse {
            access_token,
            token_type: "Bearer",
            expires_in: 3_600,
            refresh_token,
            scope: scopes.join(" "),
        })
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
}

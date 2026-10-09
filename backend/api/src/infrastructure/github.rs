//! Fixed-origin GitHub transport. Raw responses live in memory only; callers persist allowlists.
use anyhow::{ensure, Context, Result};
use chrono::Utc;
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GithubAppSecrets {
    pub private_key: String,
    pub client_secret: String,
    pub webhook_secret: String,
}
impl GithubAppSecrets {
    pub fn from_vault(app_id: &str) -> Result<Option<Self>> {
        let Ok(path) = std::env::var("ATOAXIS_GITHUB_CREDENTIALS_PATH") else {
            return Ok(None);
        };
        let key = std::env::var("ATOAXIS_KMS_KEY_ID")
            .context("GitHub credential vault key unavailable")?;
        let vault = super::secret_box::SecretBox::from_env_value(&key)?;
        let encrypted = std::fs::read(path).context("GitHub credential envelope unavailable")?;
        let plaintext = vault
            .open(format!("github-app:{app_id}").as_bytes(), &encrypted)
            .context("GitHub credential envelope rejected")?;
        Ok(Some(
            serde_json::from_slice(&plaintext)
                .context("GitHub credential envelope schema rejected")?,
        ))
    }
    pub fn webhook_secret() -> Result<String> {
        if let Ok(id) = std::env::var("ATOAXIS_GITHUB_APP_ID") {
            if let Some(secrets) = Self::from_vault(&id)? {
                return Ok(secrets.webhook_secret);
            }
        }
        let secret = std::env::var("ATOAXIS_GITHUB_WEBHOOK_SECRET")
            .context("GitHub webhook credential unavailable")?;
        ensure!(!secret.is_empty(), "GitHub webhook credential unavailable");
        Ok(secret)
    }
}

pub const API_VERSION: &str = "2026-03-10";

#[derive(Clone)]
pub struct GithubConfig {
    pub app_id: String,
    pub client_id: String,
    pub client_secret: String,
    pub private_key: String,
    pub slug: String,
    pub public_url: String,
}
impl GithubConfig {
    pub fn from_env() -> Result<Option<Self>> {
        if std::env::var("ATOAXIS_GITHUB_APP_ID").ok().is_none() {
            return Ok(None);
        }
        let get = |key: &str| {
            std::env::var(key).with_context(|| format!("{key} required for GitHub App"))
        };
        let public_url = get("ATOAXIS_GITHUB_PUBLIC_URL")?;
        let url = Url::parse(&public_url)?;
        ensure!(
            url.scheme() == "https"
                && url.username().is_empty()
                && url.password().is_none()
                && url.query().is_none()
                && url.fragment().is_none(),
            "GitHub public URL must be a credential-free HTTPS origin"
        );
        ensure!(url.path() == "/", "GitHub public URL must be an origin");
        let app_id = get("ATOAXIS_GITHUB_APP_ID")?;
        ensure!(
            app_id.parse::<i64>().is_ok_and(|n| n > 0),
            "invalid GitHub App identity"
        );
        let slug = get("ATOAXIS_GITHUB_APP_SLUG")?;
        ensure!(
            !slug.is_empty()
                && slug.len() <= 100
                && slug.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-'),
            "invalid GitHub App slug"
        );
        let (private_key, client_secret) =
            if let Some(secrets) = GithubAppSecrets::from_vault(&app_id)? {
                (secrets.private_key, secrets.client_secret)
            } else {
                let key_path = get("ATOAXIS_GITHUB_PRIVATE_KEY_PATH")?;
                (
                    std::fs::read_to_string(key_path).context("GitHub private key unavailable")?,
                    get("ATOAXIS_GITHUB_CLIENT_SECRET")?,
                )
            };
        ensure!(
            !client_secret.is_empty(),
            "GitHub client secret unavailable"
        );
        jsonwebtoken::EncodingKey::from_rsa_pem(private_key.as_bytes())
            .context("invalid GitHub App private key")?;
        Ok(Some(Self {
            app_id,
            client_id: get("ATOAXIS_GITHUB_CLIENT_ID")?,
            client_secret,
            private_key,
            slug,
            public_url: public_url.trim_end_matches('/').into(),
        }))
    }
    pub fn callback(&self) -> String {
        format!(
            "{}/dashboard/wakaclock/teams/github/callback",
            self.public_url
        )
    }
    pub fn app_jwt(&self) -> Result<String> {
        #[derive(Serialize)]
        struct Claims<'a> {
            iat: i64,
            exp: i64,
            iss: &'a str,
        }
        let now = Utc::now().timestamp();
        Ok(jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS256),
            &Claims {
                iat: now - 60,
                exp: now + 540,
                iss: &self.app_id,
            },
            &jsonwebtoken::EncodingKey::from_rsa_pem(self.private_key.as_bytes())?,
        )?)
    }
}

#[derive(Debug, thiserror::Error)]
#[error("GitHub {code}; retry after {retry_seconds} seconds")]
pub struct GithubFailure {
    pub code: &'static str,
    pub retry_seconds: i64,
}

pub fn failure(
    status: u16,
    remaining: Option<&str>,
    retry: Option<&str>,
    reset: Option<&str>,
    now: i64,
) -> GithubFailure {
    let wait = retry
        .and_then(|r| {
            r.parse::<i64>().ok().or_else(|| {
                chrono::DateTime::parse_from_rfc2822(r)
                    .ok()
                    .map(|at| (at.timestamp() - now).max(0))
            })
        })
        .filter(|n| *n >= 0);
    let limited = status == 429 || (status == 403 && (remaining == Some("0") || wait.is_some()));
    let retry_seconds = wait.unwrap_or_else(|| {
        if remaining == Some("0") {
            reset
                .and_then(|r| r.parse::<i64>().ok())
                .map(|r| (r - now).max(60))
                .unwrap_or(60)
        } else {
            60
        }
    });
    GithubFailure {
        code: match status {
            401 => "auth_required",
            403 if limited => "rate_limited",
            403 => "permission_required",
            404 => "access_unconfirmed",
            429 => "rate_limited",
            500..=599 => "provider_unavailable",
            _ => "validation",
        },
        retry_seconds: retry_seconds.max(1),
    }
}

#[derive(Serialize, Deserialize)]
pub struct GithubTokens {
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_in: Option<i64>,
}

pub struct GithubPage {
    pub value: Value,
    pub next: Option<String>,
    pub etag: Option<String>,
    pub unchanged: bool,
}
#[derive(Clone)]
pub struct GithubClient {
    client: Client,
}
impl GithubClient {
    pub fn new() -> Result<Self> {
        Ok(Self {
            client: Client::builder()
                .timeout(Duration::from_secs(20))
                .redirect(reqwest::redirect::Policy::none())
                .user_agent("AtoAxis-Team-GitHub")
                .build()?,
        })
    }
    pub fn api_url(path: &str) -> Result<Url> {
        let url = if path.starts_with('/') {
            Url::parse(&format!("https://api.github.com{path}"))?
        } else {
            Url::parse(path)?
        };
        ensure!(
            url.scheme() == "https"
                && url.host_str() == Some("api.github.com")
                && url.username().is_empty()
                && url.password().is_none()
                && url.port_or_known_default() == Some(443),
            "invalid GitHub API origin"
        );
        Ok(url)
    }
    pub async fn request(
        &self,
        token: &str,
        method: Method,
        path: &str,
        body: Option<&Value>,
        etag: Option<&str>,
    ) -> Result<GithubPage> {
        let mut url = Self::api_url(path)?;
        for _ in 0..4 {
            let mut request = self
                .client
                .request(method.clone(), url.clone())
                .bearer_auth(token)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", API_VERSION);
            if let Some(value) = body {
                request = request.json(value);
            }
            if let Some(value) = etag {
                request = request.header("If-None-Match", value);
            }
            let response = request.send().await.map_err(|_| GithubFailure {
                code: "network",
                retry_seconds: 60,
            })?;
            let status = response.status();
            if status.is_redirection() && status.as_u16() != 304 {
                url = Self::api_url(
                    response
                        .headers()
                        .get("location")
                        .and_then(|h| h.to_str().ok())
                        .context("missing GitHub redirect")?,
                )?;
                continue;
            }
            if status.as_u16() == 304 {
                return Ok(GithubPage {
                    value: Value::Null,
                    next: None,
                    etag: None,
                    unchanged: true,
                });
            }
            if !status.is_success() {
                let h = |key| response.headers().get(key).and_then(|v| v.to_str().ok());
                return Err(failure(
                    status.as_u16(),
                    h("x-ratelimit-remaining"),
                    h("retry-after"),
                    h("x-ratelimit-reset"),
                    Utc::now().timestamp(),
                )
                .into());
            }
            let next = response
                .headers()
                .get("link")
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.split(',').find(|p| p.contains("rel=\"next\"")))
                .and_then(|p| p.split('<').nth(1))
                .and_then(|p| p.split('>').next())
                .map(String::from);
            if let Some(url) = &next {
                Self::api_url(url)?;
            }
            let etag = response
                .headers()
                .get("etag")
                .and_then(|h| h.to_str().ok())
                .map(String::from);
            ensure!(
                response.content_length().is_none_or(|n| n <= 8_000_000),
                "GitHub response too large"
            );
            // Stream with a hard cap, including chunked responses.
            let mut response = response;
            let mut bytes = Vec::new();
            while let Some(chunk) = response
                .chunk()
                .await
                .context("GitHub response unavailable")?
            {
                ensure!(
                    bytes.len() + chunk.len() <= 8_000_000,
                    "GitHub response too large"
                );
                bytes.extend_from_slice(&chunk);
            }
            let value = if bytes.is_empty() {
                Value::Null
            } else {
                serde_json::from_slice(&bytes).context("GitHub response schema")?
            };
            return Ok(GithubPage {
                value,
                next,
                etag,
                unchanged: false,
            });
        }
        anyhow::bail!("GitHub redirect limit")
    }
    pub async fn verify_application(&self, config: &GithubConfig) -> Result<()> {
        let jwt = config.app_jwt()?;
        let app = self
            .request(&jwt, Method::GET, "/app", None, None)
            .await?
            .value;
        ensure!(
            app["id"].as_i64().map(|n| n.to_string()).as_deref() == Some(&config.app_id)
                && app["slug"].as_str() == Some(&config.slug),
            "GitHub App identity mismatch"
        );
        let permissions = app["permissions"]
            .as_object()
            .context("GitHub App permissions unavailable")?;
        let expected = ["metadata", "pull_requests", "issues", "checks", "statuses"];
        ensure!(
            permissions.len() == expected.len()
                && expected
                    .iter()
                    .all(|name| permissions.get(*name).and_then(Value::as_str) == Some("read")),
            "GitHub App permission scope differs from approved read-only configuration"
        );
        let hook = self
            .request(&jwt, Method::GET, "/app/hook/config", None, None)
            .await?
            .value;
        ensure!(
            hook["url"].as_str()
                == Some(&format!(
                    "{}/api/v2/team/webhooks/github",
                    config.public_url
                ))
                && hook["insecure_ssl"].as_str() == Some("0")
                && hook["content_type"].as_str() == Some("json"),
            "GitHub webhook URL or HTTPS settings mismatch; update Quick Tunnel configuration"
        );
        Ok(())
    }
    pub async fn oauth(&self, config: &GithubConfig, params: Value) -> Result<GithubTokens> {
        let mut params = params
            .as_object()
            .context("invalid OAuth parameters")?
            .clone();
        params.insert("client_id".into(), config.client_id.clone().into());
        params.insert("client_secret".into(), config.client_secret.clone().into());
        let response = self
            .client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .form(&params)
            .send()
            .await
            .context("GitHub OAuth unavailable")?;
        ensure!(response.status().is_success(), "GitHub OAuth rejected");
        let tokens: GithubTokens = response.json().await.context("GitHub OAuth rejected")?;
        ensure!(
            !tokens.access_token.is_empty(),
            "GitHub OAuth token missing"
        );
        Ok(tokens)
    }
    pub async fn installation_token(
        &self,
        config: &GithubConfig,
        id: i64,
        repos: &[i64],
    ) -> Result<String> {
        ensure!(id > 0, "invalid installation");
        let page = self
            .request(
                &config.app_jwt()?,
                Method::POST,
                &format!("/app/installations/{id}/access_tokens"),
                Some(&serde_json::json!({"repository_ids":repos})),
                None,
            )
            .await?;
        Ok(page.value["token"]
            .as_str()
            .context("installation token missing")?
            .into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn origin_rejects_secret_and_external_redirects() {
        for bad in [
            "https://evil.test/repos",
            "https://token@api.github.com/repos",
            "http://api.github.com/repos",
            "https://api.github.com:8443/repos",
        ] {
            assert!(GithubClient::api_url(bad).is_err());
        }
        assert!(GithubClient::api_url("/repos/a/b").is_ok());
    }
    #[test]
    fn retry_after_and_private_404_are_preserved() {
        assert_eq!(
            failure(429, None, Some("7200"), None, 0).retry_seconds,
            7200
        );
        assert_eq!(failure(404, None, None, None, 0).code, "access_unconfirmed");
        assert_eq!(
            failure(403, Some("0"), None, Some("400"), 100).retry_seconds,
            300
        );
    }
}

use anyhow::{Context, Result};
use axum::http::{HeaderValue, Uri};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ClickHouseConfig {
    pub url: String,
    pub user: Option<String>,
    pub password: Option<String>,
    pub database: String,
}

/// PostgreSQL is the transactional source of truth for Phase 10 product state.
///
/// The URL is optional during the compatibility rollout so an existing ClickHouse-only
/// development installation continues to boot. Production deployments should set it; the
/// application logs a clear warning when it is absent.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PostgresConfig {
    pub url: Option<String>,
    pub max_connections: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub enum CorsOrigins {
    /// `CORS_ORIGINS=*` — explicit opt-in to accept any origin. Fine for a laptop-only
    /// self-host; never appropriate once a second tenant's data is in play.
    Any,
    List(Vec<String>),
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub server: ServerConfig,
    pub clickhouse: ClickHouseConfig,
    pub postgres: PostgresConfig,
    pub jwt_secret: String,
    pub cors_origins: CorsOrigins,
    /// Gates POST /internal/subscription — the seam an external payment system calls
    /// to mark an account active/canceled. `None` (the env var unset) disables the
    /// route entirely (404, same as an admin surface with no token configured) rather
    /// than leaving it reachable with no credential at all.
    pub internal_api_secret: Option<String>,
    /// How long a pause between two *proven* activity intervals may last before the
    /// clock stops. This is WakaTime's per-user timeout, and it exists because a
    /// segment can only ever be as long as the strict 120-second evidence window:
    /// without it, every think/read/test pause longer than two minutes silently
    /// vanished from the day's total. Set to `0` to keep the pre-bridging behaviour.
    pub idle_timeout_seconds: f64,
}

const DEV_JWT_SECRET: &str = "wakaclock-dev-secret-change-me";

impl Config {
    pub fn from_env() -> Result<Self> {
        let allow_insecure_dev_secret = std::env::var("ALLOW_INSECURE_JWT_SECRET")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        let jwt_secret = match std::env::var("JWT_SECRET") {
            Ok(value) if !value.trim().is_empty() => value,
            _ if allow_insecure_dev_secret => {
                tracing::warn!(
                    "JWT_SECRET not set — using an insecure default because \
                     ALLOW_INSECURE_JWT_SECRET=1 was passed. Every session this issues is \
                     forgeable by anyone who reads this source. Local development only."
                );
                DEV_JWT_SECRET.to_string()
            }
            _ => {
                anyhow::bail!(
                    "JWT_SECRET is not set. Refusing to start with a guessable secret — set \
                     JWT_SECRET to a long random value, or pass ALLOW_INSECURE_JWT_SECRET=1 \
                     to explicitly accept an insecure default for local development."
                );
            }
        };

        let cors_origins = parse_cors_origins(std::env::var("CORS_ORIGINS").ok())?;

        Ok(Self {
            server: ServerConfig {
                host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: std::env::var("SERVER_PORT")
                    .unwrap_or_else(|_| "8080".to_string())
                    .parse()
                    .unwrap_or(8080),
            },
            clickhouse: ClickHouseConfig {
                url: std::env::var("CLICKHOUSE_URL")
                    .unwrap_or_else(|_| "http://localhost:8123".to_string()),
                user: std::env::var("CLICKHOUSE_USER").ok(),
                password: std::env::var("CLICKHOUSE_PASSWORD").ok(),
                database: std::env::var("CLICKHOUSE_DB")
                    .or_else(|_| std::env::var("CLICKHOUSE_DATABASE"))
                    .unwrap_or_else(|_| "wakaclock".to_string()),
            },
            postgres: PostgresConfig {
                url: std::env::var("POSTGRES_URL")
                    .or_else(|_| std::env::var("DATABASE_URL"))
                    .ok()
                    .filter(|value| !value.trim().is_empty()),
                max_connections: std::env::var("POSTGRES_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "16".to_string())
                    .parse()
                    .context("POSTGRES_MAX_CONNECTIONS must be a positive integer")?,
            },
            jwt_secret,
            cors_origins,
            internal_api_secret: std::env::var("INTERNAL_API_SECRET")
                .ok()
                .filter(|s| !s.trim().is_empty()),
            idle_timeout_seconds: parse_idle_timeout(std::env::var("IDLE_TIMEOUT_MINUTES").ok())?,
        })
    }
}

/// WakaTime's default timeout is 15 minutes and users may raise or lower it. The same
/// knob is exposed here in minutes for familiarity, and validated rather than clamped so
/// a typo fails at boot instead of quietly changing everyone's reported time.
pub const DEFAULT_IDLE_TIMEOUT_MINUTES: f64 = 15.0;

fn parse_idle_timeout(value: Option<String>) -> Result<f64> {
    let Some(raw) = value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
    else {
        return Ok(DEFAULT_IDLE_TIMEOUT_MINUTES * 60.0);
    };
    let minutes: f64 = raw
        .parse()
        .context("IDLE_TIMEOUT_MINUTES must be a number of minutes")?;
    if !minutes.is_finite() || !(0.0..=24.0 * 60.0).contains(&minutes) {
        anyhow::bail!("IDLE_TIMEOUT_MINUTES must be between 0 and 1440");
    }
    Ok(minutes * 60.0)
}

fn parse_cors_origins(value: Option<String>) -> Result<CorsOrigins> {
    match value {
        Some(value) if value.trim() == "*" => {
            tracing::warn!(
                "CORS_ORIGINS=* — accepting requests from any origin. Fine for a \
                 single-user self-host, not for a multi-tenant deployment."
            );
            Ok(CorsOrigins::Any)
        }
        Some(value) => {
            let origins: Result<Vec<String>> = value
                .split(',')
                .enumerate()
                .map(|(index, raw_origin)| {
                    let origin = raw_origin.trim();
                    if origin.is_empty() {
                        anyhow::bail!(
                            "CORS_ORIGINS contains an empty origin at position {}",
                            index + 1
                        );
                    }
                    validate_cors_origin(origin).with_context(|| {
                        format!(
                            "invalid CORS_ORIGINS entry at position {}: {origin}",
                            index + 1
                        )
                    })?;
                    Ok(origin.to_string())
                })
                .collect();
            let origins = origins?;
            if origins.is_empty() {
                anyhow::bail!("CORS_ORIGINS must contain at least one origin or '*'");
            }
            Ok(CorsOrigins::List(origins))
        }
        None => {
            tracing::warn!(
                "CORS_ORIGINS not set — defaulting to http://localhost:3000 only. Set \
                 CORS_ORIGINS to a comma-separated list of allowed origins in production."
            );
            Ok(CorsOrigins::List(vec!["http://localhost:3000".to_string()]))
        }
    }
}

fn validate_cors_origin(origin: &str) -> Result<()> {
    origin
        .parse::<HeaderValue>()
        .context("origin contains characters that are not valid in an HTTP header")?;

    let uri: Uri = origin
        .parse()
        .context("origin must be an absolute URI such as https://www.atoaxis.com")?;
    let scheme = uri
        .scheme_str()
        .context("origin must include an http or https scheme")?;
    if !scheme.eq_ignore_ascii_case("http") && !scheme.eq_ignore_ascii_case("https") {
        anyhow::bail!("origin scheme must be http or https");
    }
    if uri.authority().is_none() {
        anyhow::bail!("origin must include a host");
    }
    let authority_text = origin
        .split_once("://")
        .map(|(_, authority)| authority)
        .expect("a parsed absolute URI has a scheme separator");
    if authority_text.contains('/') || authority_text.contains('?') || authority_text.contains('#')
    {
        anyhow::bail!("origin must not include a path, query, or trailing slash");
    }
    if uri
        .authority()
        .expect("authority was checked above")
        .as_str()
        .contains('@')
    {
        anyhow::bail!("origin must not include user information");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_explicit_origins_without_silently_dropping_entries() {
        let origins = parse_cors_origins(Some(
            "https://www.atoaxis.com, https://app.atoaxis.com".to_string(),
        ))
        .unwrap();

        assert_eq!(
            origins,
            CorsOrigins::List(vec![
                "https://www.atoaxis.com".to_string(),
                "https://app.atoaxis.com".to_string(),
            ])
        );
    }

    #[test]
    fn rejects_empty_and_malformed_origins() {
        for value in [
            "".to_string(),
            "https://www.atoaxis.com,".to_string(),
            "www.atoaxis.com".to_string(),
            "https://www.atoaxis.com/path".to_string(),
            "ftp://www.atoaxis.com".to_string(),
        ] {
            assert!(
                parse_cors_origins(Some(value.clone())).is_err(),
                "expected invalid CORS_ORIGINS value to fail: {value}"
            );
        }
    }

    #[test]
    fn unset_origins_keep_the_local_development_default() {
        assert_eq!(
            parse_cors_origins(None).unwrap(),
            CorsOrigins::List(vec!["http://localhost:3000".to_string()])
        );
    }
}

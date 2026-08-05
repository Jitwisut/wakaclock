use anyhow::{Context, Result};
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

#[derive(Debug, Clone, Deserialize, Serialize)]
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
    pub jwt_secret: String,
    pub cors_origins: CorsOrigins,
    /// Gates POST /internal/subscription — the seam an external payment system calls
    /// to mark an account active/canceled. `None` (the env var unset) disables the
    /// route entirely (404, same as an admin surface with no token configured) rather
    /// than leaving it reachable with no credential at all.
    pub internal_api_secret: Option<String>,
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

        let cors_origins = match std::env::var("CORS_ORIGINS") {
            Ok(value) if value.trim() == "*" => {
                tracing::warn!(
                    "CORS_ORIGINS=* — accepting requests from any origin. Fine for a \
                     single-user self-host, not for a multi-tenant deployment."
                );
                CorsOrigins::Any
            }
            Ok(value) => CorsOrigins::List(
                value
                    .split(',')
                    .map(|origin| origin.trim().to_string())
                    .filter(|origin| !origin.is_empty())
                    .collect(),
            ),
            Err(_) => {
                tracing::warn!(
                    "CORS_ORIGINS not set — defaulting to http://localhost:3000 only. Set \
                     CORS_ORIGINS to a comma-separated list of allowed origins in production."
                );
                CorsOrigins::List(vec!["http://localhost:3000".to_string()])
            }
        };

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
            jwt_secret,
            cors_origins,
            internal_api_secret: std::env::var("INTERNAL_API_SECRET")
                .ok()
                .filter(|s| !s.trim().is_empty()),
        })
    }
}

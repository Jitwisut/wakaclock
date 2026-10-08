pub mod brokers;

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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RedisConfig {
    pub url: Option<String>,
}

/// Export requests are disabled by default until the API and the dedicated
/// export worker are deployed with a durable object store. Keeping this switch
/// separate from the generic job queue prevents an operator from accidentally
/// accepting export work merely by enabling RabbitMQ for another job kind.
#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
pub enum ExportMode {
    #[default]
    Disabled,
    Job,
}

/// Account deletion is deliberately opt-in. The endpoint must not accept a
/// destructive request merely because the shared job queue is configured.
#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
pub enum AccountDeletionMode {
    #[default]
    Disabled,
    Job,
}

impl AccountDeletionMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::Job => "job",
        }
    }
}

impl ExportMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::Job => "job",
        }
    }
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
    pub redis: RedisConfig,
    /// Presence v2 is opt-in during the canary rollout. When enabled, PostgreSQL and
    /// Redis are mandatory because they own room authorization and live leases.
    pub presence_v2_enabled: bool,
    pub jwt_secret: String,
    pub cors_origins: CorsOrigins,
    pub trusted_proxy_ips: Vec<std::net::IpAddr>,
    /// Public browser origin used for human-facing OAuth/device approval links.
    pub public_app_url: String,
    /// Gates POST /internal/subscription — the seam an external payment system calls
    /// to mark an account active/canceled. `None` (the env var unset) disables the
    /// route entirely (404, same as an admin surface with no token configured) rather
    /// than leaving it reachable with no credential at all.
    pub internal_api_secret: Option<String>,
    /// Raw `ATOAXIS_KMS_KEY_ID` — the base64 master key that seals credentials the
    /// product must be able to show again (currently the dashboard API key). `None`
    /// leaves keys hash-only and `GET /users/current/api_key` returns no value.
    pub credential_master_key: Option<String>,
    /// Explicit gate for accepting export jobs. The worker may still be run while
    /// this is disabled to drain already accepted work during a rollback.
    pub export_mode: ExportMode,
    /// Explicit gate for accepting destructive account deletion jobs.
    pub account_deletion_mode: AccountDeletionMode,
    /// Opt-in rollout gate for storing versioned editor line measurements.
    /// The capability API and ingest route share this flag so writers can retain
    /// measurements locally until every server replica is ready.
    #[serde(default)]
    pub editor_line_metrics_enabled: bool,
    /// Opt-in rollout gate for historical measurement preview/apply/rollback.
    #[serde(default)]
    pub measurement_repair_enabled: bool,
    /// Personal experimental receipts; independent of capture and analytics ingestion.
    #[serde(default)]
    pub work_sessions_enabled: bool,
    /// Receiver rollout only; each organization must independently opt into Team.
    #[serde(default)]
    pub team_enabled: bool,
    /// How long a pause between two *proven* activity intervals may last before the
    /// clock stops. This is WakaTime's per-user timeout, and it exists because a
    /// segment can only ever be as long as the strict 120-second evidence window:
    /// without it, every think/read/test pause longer than two minutes silently
    /// vanished from the day's total. Set to `0` to keep the pre-bridging behaviour.
    pub idle_timeout_seconds: f64,
    #[serde(default)]
    pub duration_combined_v2: bool,
    /// Additive rollout switch for the UI/API primary duration. The legacy field
    /// values remain available in every response while this is canaried.
    #[serde(default)]
    pub duration_primary_mode: DurationPrimaryMode,
    /// The same pause allowance for agent-emitted activity, bridged on its own timeline.
    /// Defaults to `idle_timeout_seconds`, which keeps the reported total within 1% of
    /// WakaTime while still attributing human and agent seconds separately. Lower it to
    /// stop an unattended agent run from billing as continuous work, at the cost of
    /// reading below WakaTime. `None` — `AGENT_IDLE_TIMEOUT_MINUTES=off` — puts every
    /// source back on one timeline and gives up the attribution split with it.
    pub agent_idle_timeout_seconds: Option<f64>,
    /// Kafka/RabbitMQ settings. Skipped by serde because it carries broker
    /// credentials; `Default` is "no brokers", which is today's behaviour.
    #[serde(skip)]
    pub brokers: brokers::BrokerConfig,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Default)]
pub enum DurationPrimaryMode {
    #[default]
    WakatimeCompatible,
    ActiveV1,
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
        // Bound before the struct literal: the agent timeout defaults to this value, so
        // tuning IDLE_TIMEOUT_MINUTES moves both streams together unless the agent one is
        // set explicitly.
        let idle_timeout_seconds = parse_idle_timeout(std::env::var("IDLE_TIMEOUT_MINUTES").ok())?;
        let public_app_url = parse_public_app_url(std::env::var("ATOAXIS_APP_URL").ok())?;
        let postgres_url = std::env::var("POSTGRES_URL")
            .or_else(|_| std::env::var("DATABASE_URL"))
            .ok()
            .filter(|value| !value.trim().is_empty());
        let brokers = brokers::BrokerConfig::from_env(postgres_url.is_some())?;
        let export_mode = parse_export_mode(std::env::var("ATOAXIS_EXPORT_MODE").ok())?;
        ensure_export_mode_supported(
            export_mode,
            postgres_url.is_some(),
            brokers.job_queue.is_some(),
        )?;
        let account_deletion_mode =
            parse_account_deletion_mode(std::env::var("ATOAXIS_ACCOUNT_DELETION_MODE").ok())?;
        ensure_account_deletion_mode_supported(
            account_deletion_mode,
            postgres_url.is_some(),
            brokers.job_queue.is_some(),
        )?;
        let editor_line_metrics_enabled = parse_opt_in_feature_flag(
            std::env::var("ATOAXIS_EDITOR_LINE_METRICS_ENABLED").ok(),
            "ATOAXIS_EDITOR_LINE_METRICS_ENABLED",
        )?;
        let measurement_repair_enabled = parse_opt_in_feature_flag(
            std::env::var("ATOAXIS_MEASUREMENT_REPAIR_ENABLED").ok(),
            "ATOAXIS_MEASUREMENT_REPAIR_ENABLED",
        )?;

        Ok(Self {
            server: ServerConfig {
                host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: parse_positive_port(std::env::var("SERVER_PORT").ok(), "SERVER_PORT", 8080)?,
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
                url: postgres_url,
                max_connections: parse_positive_u32(
                    std::env::var("POSTGRES_MAX_CONNECTIONS").ok(),
                    "POSTGRES_MAX_CONNECTIONS",
                    16,
                )?,
            },
            redis: RedisConfig {
                url: std::env::var("REDIS_URL")
                    .ok()
                    .filter(|value| !value.trim().is_empty()),
            },
            presence_v2_enabled: std::env::var("PRESENCE_V2_ENABLED")
                .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
                .unwrap_or(false),
            work_sessions_enabled: parse_opt_in_feature_flag(
                std::env::var("ATOAXIS_WORK_SESSIONS_ENABLED").ok(),
                "ATOAXIS_WORK_SESSIONS_ENABLED",
            )?,
            team_enabled: parse_opt_in_feature_flag(
                std::env::var("ATOAXIS_TEAM_ENABLED").ok(),
                "ATOAXIS_TEAM_ENABLED",
            )?,
            jwt_secret,
            cors_origins,
            trusted_proxy_ips: std::env::var("TRUSTED_PROXY_IPS")
                .unwrap_or_default()
                .split(',')
                .map(str::trim)
                .filter(|ip| !ip.is_empty())
                .map(str::parse)
                .collect::<std::result::Result<Vec<_>, _>>()
                .context("TRUSTED_PROXY_IPS must contain comma-separated IP addresses")?,
            public_app_url,
            internal_api_secret: std::env::var("INTERNAL_API_SECRET")
                .ok()
                .filter(|s| !s.trim().is_empty()),
            credential_master_key: std::env::var("ATOAXIS_KMS_KEY_ID")
                .ok()
                .filter(|s| !s.trim().is_empty()),
            export_mode,
            account_deletion_mode,
            editor_line_metrics_enabled,
            measurement_repair_enabled,
            idle_timeout_seconds,
            duration_combined_v2: parse_duration_mode(
                std::env::var("DURATION_CALCULATION_MODE").ok(),
            )?,
            duration_primary_mode: parse_duration_primary_mode(
                std::env::var("DURATION_PRIMARY_MODE").ok(),
            )?,
            agent_idle_timeout_seconds: parse_agent_idle_timeout(
                std::env::var("AGENT_IDLE_TIMEOUT_MINUTES").ok(),
                idle_timeout_seconds,
            )?,
            brokers,
        })
    }
}

fn parse_opt_in_feature_flag(value: Option<String>, name: &str) -> Result<bool> {
    match value
        .map(|raw| raw.trim().to_ascii_lowercase())
        .filter(|raw| !raw.is_empty())
        .as_deref()
    {
        None | Some("0") | Some("false") | Some("off") | Some("disabled") => Ok(false),
        Some("1") | Some("true") | Some("on") | Some("enabled") => Ok(true),
        Some(_) => anyhow::bail!("{name} must be a boolean value"),
    }
}

fn parse_account_deletion_mode(value: Option<String>) -> Result<AccountDeletionMode> {
    match value
        .map(|raw| raw.trim().to_ascii_lowercase())
        .filter(|raw| !raw.is_empty())
        .as_deref()
    {
        None | Some("disabled") => Ok(AccountDeletionMode::Disabled),
        Some("job") => Ok(AccountDeletionMode::Job),
        Some(_) => anyhow::bail!("ATOAXIS_ACCOUNT_DELETION_MODE must be disabled or job"),
    }
}

fn ensure_account_deletion_mode_supported(
    mode: AccountDeletionMode,
    postgres_configured: bool,
    job_queue_configured: bool,
) -> Result<()> {
    if mode == AccountDeletionMode::Job {
        if !postgres_configured {
            anyhow::bail!("ATOAXIS_ACCOUNT_DELETION_MODE=job requires POSTGRES_URL");
        }
        if !job_queue_configured {
            anyhow::bail!("ATOAXIS_ACCOUNT_DELETION_MODE=job requires ATOAXIS_JOB_QUEUE_URL");
        }
    }
    Ok(())
}

fn parse_positive_u32(value: Option<String>, name: &str, default: u32) -> Result<u32> {
    let Some(value) = value else {
        return Ok(default);
    };
    let parsed = value
        .trim()
        .parse::<u32>()
        .with_context(|| format!("{name} must be a positive integer"))?;
    if parsed == 0 {
        anyhow::bail!("{name} must be a positive integer");
    }
    Ok(parsed)
}

/// Parse a TCP port at boot. An explicit malformed, zero, or out-of-range value
/// must fail startup instead of silently moving a service to another port.
pub fn parse_positive_port(value: Option<String>, name: &str, default: u16) -> Result<u16> {
    let Some(value) = value else {
        if default == 0 {
            anyhow::bail!("{name} default must be positive");
        }
        return Ok(default);
    };
    let parsed = value
        .trim()
        .parse::<u16>()
        .with_context(|| format!("{name} must be a positive port number"))?;
    if parsed == 0 {
        anyhow::bail!("{name} must be a positive port number");
    }
    Ok(parsed)
}

fn parse_export_mode(value: Option<String>) -> Result<ExportMode> {
    match value
        .map(|raw| raw.trim().to_ascii_lowercase())
        .filter(|raw| !raw.is_empty())
        .as_deref()
    {
        None | Some("disabled") => Ok(ExportMode::Disabled),
        Some("job") => Ok(ExportMode::Job),
        Some(_) => anyhow::bail!("ATOAXIS_EXPORT_MODE must be disabled or job"),
    }
}

fn ensure_export_mode_supported(
    mode: ExportMode,
    postgres_configured: bool,
    job_queue_configured: bool,
) -> Result<()> {
    if mode == ExportMode::Job {
        if !postgres_configured {
            anyhow::bail!("ATOAXIS_EXPORT_MODE=job requires POSTGRES_URL");
        }
        if !job_queue_configured {
            anyhow::bail!("ATOAXIS_EXPORT_MODE=job requires ATOAXIS_JOB_QUEUE_URL");
        }
    }
    Ok(())
}

/// Parse the rollout switch once at boot. Missing and explicit `legacy` both keep the
/// pre-existing response semantics; only the exact `combined_v2` value enables the
/// measured-editor union plus measured-AI union. Rejecting typos is safer than silently
/// changing the user's daily total.
fn parse_duration_mode(value: Option<String>) -> Result<bool> {
    match value
        .map(|raw| raw.trim().to_ascii_lowercase())
        .filter(|raw| !raw.is_empty())
        .as_deref()
    {
        None | Some("legacy") => Ok(false),
        Some("combined_v2") => Ok(true),
        Some(_) => anyhow::bail!("DURATION_CALCULATION_MODE must be legacy or combined_v2"),
    }
}

/// Select which additive duration is presented as the primary number. Keep the
/// compatibility value in the response so a canary can be reversed without data
/// migration or a second query.
fn parse_duration_primary_mode(value: Option<String>) -> Result<DurationPrimaryMode> {
    match value
        .map(|raw| raw.trim().to_ascii_lowercase())
        .filter(|raw| !raw.is_empty())
        .as_deref()
    {
        None | Some("wakatime_compatible") | Some("legacy") => {
            Ok(DurationPrimaryMode::WakatimeCompatible)
        }
        Some("active_v1") => Ok(DurationPrimaryMode::ActiveV1),
        Some(_) => anyhow::bail!("DURATION_PRIMARY_MODE must be wakatime_compatible or active_v1"),
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

/// Agent activity is bridged on its own timeline, at the human timeout by default.
///
/// The split is worth having even when both streams use the same number, and that is the
/// part which is easy to miss: `bridge_idle_gaps_with_anchors` extends whichever interval
/// precedes a gap regardless of who emitted it, so on one timeline an *editor* interval
/// gets stretched to reach an *agent* heartbeat and the inferred seconds are then
/// attributed to the human. Measured over 962 real heartbeats, one timeline reported
/// 9h38m attended where the editor stream can only support 7h21m — the difference was
/// agent-justified gaps wearing a human label. Partitioning first fixes the attribution
/// whatever the timeouts are.
///
/// Defaulting to the human timeout therefore buys correct attribution at no cost to the
/// reported total: on the same sample it lands within 1% of WakaTime, while a two-minute
/// agent timeout reads 27% lower. Lowering this is a deliberate policy choice — it stops
/// an unattended overnight agent run from billing as continuous work, and it will move
/// the total away from what WakaTime would report for the same stream. `0` lets agent
/// activity contribute only what it measured and nothing more.
///
/// See docs/duration-accuracy-audit.md, Findings 2 and 8.
pub const DEFAULT_AGENT_IDLE_TIMEOUT_MINUTES: Option<f64> = None;

fn parse_agent_idle_timeout(
    value: Option<String>,
    idle_timeout_seconds: f64,
) -> Result<Option<f64>> {
    let Some(raw) = value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
    else {
        // Follow the human timeout rather than a constant, so a deployment that tunes
        // IDLE_TIMEOUT_MINUTES does not silently leave the agent stream behind.
        return Ok(Some(
            DEFAULT_AGENT_IDLE_TIMEOUT_MINUTES
                .map(|minutes| minutes * 60.0)
                .unwrap_or(idle_timeout_seconds),
        ));
    };
    if raw.eq_ignore_ascii_case("off") || raw.eq_ignore_ascii_case("same") {
        return Ok(None);
    }
    let minutes: f64 = raw
        .parse()
        .context("AGENT_IDLE_TIMEOUT_MINUTES must be a number of minutes, or `off`")?;
    if !minutes.is_finite() || !(0.0..=24.0 * 60.0).contains(&minutes) {
        anyhow::bail!("AGENT_IDLE_TIMEOUT_MINUTES must be between 0 and 1440, or `off`");
    }
    Ok(Some(minutes * 60.0))
}

fn parse_public_app_url(value: Option<String>) -> Result<String> {
    let value = value.unwrap_or_else(|| "http://localhost:3000".to_string());
    let value = value.trim();
    if value.is_empty() {
        anyhow::bail!("ATOAXIS_APP_URL must not be empty");
    }
    validate_cors_origin(value).context(
        "ATOAXIS_APP_URL must be an http(s) origin without a path, query, or trailing slash",
    )?;
    Ok(value.to_string())
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

    /// Unset means "follow the human timeout". Measured over 962 real heartbeats this is
    /// what keeps the reported total within 1% of WakaTime; a two-minute agent timeout
    /// read 27% below it. The split is still active, so human and agent seconds stay
    /// separately attributed — that is what a single timeline cannot do.
    #[test]
    fn an_unset_agent_timeout_follows_the_human_timeout() {
        let human = 15.0 * 60.0;

        assert_eq!(parse_agent_idle_timeout(None, human).unwrap(), Some(human));
        assert_eq!(
            parse_agent_idle_timeout(Some("  ".to_string()), human).unwrap(),
            Some(human)
        );
    }

    #[test]
    fn duration_mode_defaults_to_legacy_and_accepts_only_known_values() {
        assert!(!parse_duration_mode(None).unwrap());
        assert!(!parse_duration_mode(Some(" legacy ".to_string())).unwrap());
        assert!(parse_duration_mode(Some("COMBINED_V2".to_string())).unwrap());
        assert!(parse_duration_mode(Some("canary".to_string())).is_err());
    }

    #[test]
    fn duration_primary_mode_is_explicit_and_fail_closed() {
        assert_eq!(
            parse_duration_primary_mode(None).unwrap(),
            DurationPrimaryMode::WakatimeCompatible
        );
        assert_eq!(
            parse_duration_primary_mode(Some("active_v1".to_string())).unwrap(),
            DurationPrimaryMode::ActiveV1
        );
        assert!(parse_duration_primary_mode(Some("canary".to_string())).is_err());
    }

    #[test]
    fn export_mode_defaults_closed_and_accepts_only_known_values() {
        assert_eq!(parse_export_mode(None).unwrap(), ExportMode::Disabled);
        assert_eq!(
            parse_export_mode(Some(" JOB ".to_string())).unwrap(),
            ExportMode::Job
        );
        assert!(parse_export_mode(Some("enabled".to_string())).is_err());
    }

    #[test]
    fn export_job_mode_requires_transactional_store_and_job_queue() {
        assert!(ensure_export_mode_supported(ExportMode::Disabled, false, false).is_ok());
        assert!(ensure_export_mode_supported(ExportMode::Job, false, true).is_err());
        assert!(ensure_export_mode_supported(ExportMode::Job, true, false).is_err());
        assert!(ensure_export_mode_supported(ExportMode::Job, true, true).is_ok());
    }

    #[test]
    fn account_deletion_mode_is_closed_by_default_and_requires_dependencies() {
        assert_eq!(
            parse_account_deletion_mode(None).unwrap(),
            AccountDeletionMode::Disabled
        );
        assert_eq!(
            parse_account_deletion_mode(Some(" JOB ".to_string())).unwrap(),
            AccountDeletionMode::Job
        );
        assert!(parse_account_deletion_mode(Some("enabled".to_string())).is_err());
        assert!(
            ensure_account_deletion_mode_supported(AccountDeletionMode::Job, false, true).is_err()
        );
        assert!(
            ensure_account_deletion_mode_supported(AccountDeletionMode::Job, true, false).is_err()
        );
        assert!(
            ensure_account_deletion_mode_supported(AccountDeletionMode::Job, true, true).is_ok()
        );
    }

    #[test]
    fn postgres_pool_size_must_be_positive() {
        assert_eq!(
            parse_positive_u32(None, "POSTGRES_MAX_CONNECTIONS", 16).unwrap(),
            16
        );
        assert_eq!(
            parse_positive_u32(Some(" 8 ".to_string()), "POSTGRES_MAX_CONNECTIONS", 16).unwrap(),
            8
        );
        assert!(parse_positive_u32(Some("0".to_string()), "POSTGRES_MAX_CONNECTIONS", 16).is_err());
        assert!(
            parse_positive_u32(Some("nope".to_string()), "POSTGRES_MAX_CONNECTIONS", 16).is_err()
        );
    }

    #[test]
    fn server_port_must_be_a_valid_positive_port() {
        assert_eq!(
            parse_positive_port(None, "SERVER_PORT", 8080).unwrap(),
            8080
        );
        assert_eq!(
            parse_positive_port(Some(" 9090 ".to_string()), "SERVER_PORT", 8080).unwrap(),
            9090
        );
        assert!(parse_positive_port(Some("0".to_string()), "SERVER_PORT", 8080).is_err());
        assert!(parse_positive_port(Some("65536".to_string()), "SERVER_PORT", 8080).is_err());
        assert!(parse_positive_port(Some("nope".to_string()), "SERVER_PORT", 8080).is_err());
    }

    /// Tuning only IDLE_TIMEOUT_MINUTES must not leave the agent stream on a stale
    /// constant — the two move together unless the agent one is set on purpose.
    #[test]
    fn the_default_tracks_a_retuned_human_timeout() {
        assert_eq!(
            parse_agent_idle_timeout(None, 5.0 * 60.0).unwrap(),
            Some(5.0 * 60.0)
        );
    }

    /// Lowering it is the deliberate policy choice: an unattended overnight agent run
    /// stops billing as continuous work, and the total moves below WakaTime's.
    #[test]
    fn an_explicit_agent_timeout_overrides_the_human_one() {
        assert_eq!(
            parse_agent_idle_timeout(Some("2".to_string()), 15.0 * 60.0).unwrap(),
            Some(120.0)
        );
        // Zero is meaningful: agent activity contributes its measured evidence and no
        // bridged pause at all.
        assert_eq!(
            parse_agent_idle_timeout(Some("0".to_string()), 15.0 * 60.0).unwrap(),
            Some(0.0)
        );
    }

    /// `off` gives up the split entirely, which also gives up the attribution it buys.
    #[test]
    fn off_puts_every_source_back_on_one_timeline() {
        assert_eq!(
            parse_agent_idle_timeout(Some("off".to_string()), 15.0 * 60.0).unwrap(),
            None
        );
    }

    #[test]
    fn a_nonsense_agent_timeout_fails_at_boot_rather_than_changing_reported_time() {
        assert!(parse_agent_idle_timeout(Some("soon".to_string()), 900.0).is_err());
        assert!(parse_agent_idle_timeout(Some("-1".to_string()), 900.0).is_err());
        assert!(parse_agent_idle_timeout(Some("1441".to_string()), 900.0).is_err());
    }

    #[test]
    fn public_app_url_defaults_to_localhost_and_rejects_paths() {
        assert_eq!(parse_public_app_url(None).unwrap(), "http://localhost:3000");
        assert_eq!(
            parse_public_app_url(Some(" https://atoaxis.com ".to_string())).unwrap(),
            "https://atoaxis.com"
        );
        assert!(parse_public_app_url(Some("https://atoaxis.com/device".to_string())).is_err());
    }

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

    #[test]
    fn measurement_feature_flags_are_opt_in_and_reject_unknown_values() {
        assert!(!parse_opt_in_feature_flag(None, "FLAG").unwrap());
        assert!(!parse_opt_in_feature_flag(Some("off".to_string()), "FLAG").unwrap());
        assert!(parse_opt_in_feature_flag(Some("true".to_string()), "FLAG").unwrap());
        assert!(parse_opt_in_feature_flag(Some("1".to_string()), "FLAG").unwrap());
        assert!(parse_opt_in_feature_flag(Some("maybe".to_string()), "FLAG").is_err());
    }
}

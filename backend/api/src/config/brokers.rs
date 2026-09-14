//! Kafka and RabbitMQ settings (plans/plan-kafka-rabbitmq-adoption.md, P0.2).
//!
//! Every variable is optional. With none set the server behaves exactly as before
//! brokers existed: heartbeats are written straight to ClickHouse and reprocess runs
//! inside the request. A mode that asks for broker-backed behaviour this build cannot
//! deliver fails at boot instead of quietly falling back — a deployment that set
//! `ATOAXIS_INGEST_MODE=kafka` must never believe it is running on Kafka when it is not.

use anyhow::{Context, Result};
use axum::http::Uri;
use std::collections::BTreeSet;
use std::fmt;
use uuid::Uuid;

const EVENT_BUS_URL: &str = "ATOAXIS_EVENT_BUS_URL";
const EVENT_BUS_TLS: &str = "ATOAXIS_EVENT_BUS_TLS";
const EVENT_BUS_SASL_MECHANISM: &str = "ATOAXIS_EVENT_BUS_SASL_MECHANISM";
const EVENT_BUS_SASL_USERNAME: &str = "ATOAXIS_EVENT_BUS_SASL_USERNAME";
const EVENT_BUS_SASL_PASSWORD: &str = "ATOAXIS_EVENT_BUS_SASL_PASSWORD";
const JOB_QUEUE_URL: &str = "ATOAXIS_JOB_QUEUE_URL";
const INGEST_MODE: &str = "ATOAXIS_INGEST_MODE";
const INGEST_KAFKA_COHORT: &str = "ATOAXIS_INGEST_KAFKA_COHORT";
const AI_USAGE_INGEST_MODE: &str = "ATOAXIS_AI_USAGE_INGEST_MODE";
const AI_USAGE_KAFKA_COHORT: &str = "ATOAXIS_AI_USAGE_KAFKA_COHORT";
const AI_USAGE_REQUIRE_CONTRACT_V2: &str = "ATOAXIS_AI_USAGE_REQUIRE_CONTRACT_V2";
const AI_USAGE_KAFKA_BATCH_SIZE: &str = "ATOAXIS_AI_USAGE_KAFKA_BATCH_SIZE";
const AI_USAGE_KAFKA_BATCH_WAIT_MS: &str = "ATOAXIS_AI_USAGE_KAFKA_BATCH_WAIT_MS";
const AI_USAGE_KAFKA_RETRY_MIN_MS: &str = "ATOAXIS_AI_USAGE_KAFKA_RETRY_MIN_MS";
const AI_USAGE_KAFKA_RETRY_MAX_MS: &str = "ATOAXIS_AI_USAGE_KAFKA_RETRY_MAX_MS";
const INGEST_STATE_SOURCE: &str = "ATOAXIS_INGEST_STATE_SOURCE";
const REPROCESS_MODE: &str = "ATOAXIS_REPROCESS_MODE";
const KAFKA_BATCH_SIZE: &str = "ATOAXIS_KAFKA_BATCH_SIZE";
const KAFKA_BATCH_WAIT_MS: &str = "ATOAXIS_KAFKA_BATCH_WAIT_MS";
const KAFKA_RETRY_MIN_MS: &str = "ATOAXIS_KAFKA_RETRY_MIN_MS";
const KAFKA_RETRY_MAX_MS: &str = "ATOAXIS_KAFKA_RETRY_MAX_MS";
const METRICS_HOST: &str = "ATOAXIS_METRICS_HOST";
const METRICS_PORT: &str = "ATOAXIS_METRICS_PORT";

#[derive(Debug, Clone, Default)]
pub struct BrokerConfig {
    pub event_bus: Option<EventBusConfig>,
    pub job_queue: Option<JobQueueConfig>,
    pub ingest: IngestConfig,
    /// AI usage has its own rollout and cohort. It must never inherit the heartbeat
    /// mode implicitly: operators need to cut over one stream while verifying the
    /// other and to roll either one back independently.
    pub ai_usage: AiUsageIngestConfig,
    /// Source of request-path access and project-rule state.  ClickHouse is
    /// retained as the compatibility default; Kafka mode is deliberately
    /// rejected unless PostgreSQL is authoritative.
    pub ingest_state_source: IngestStateSource,
    pub reprocess_mode: ReprocessMode,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum IngestStateSource {
    #[default]
    ClickHouse,
    Dual,
    Postgres,
}

impl IngestStateSource {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ClickHouse => "clickhouse",
            Self::Dual => "dual",
            Self::Postgres => "postgres",
        }
    }
}

/// Kafka connection. Managed providers (Redpanda Cloud, Confluent, Aiven, MSK) all
/// speak SASL over TLS, so that is the shape this models; nothing provider-specific.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventBusConfig {
    /// `host:port` entries, exactly as librdkafka's `bootstrap.servers` expects.
    pub bootstrap_servers: Vec<String>,
    pub tls: bool,
    pub sasl: Option<SaslCredentials>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SaslMechanism {
    Plain,
    ScramSha256,
    ScramSha512,
}

impl SaslMechanism {
    pub const fn as_str(self) -> &'static str {
        match self {
            SaslMechanism::Plain => "PLAIN",
            SaslMechanism::ScramSha256 => "SCRAM-SHA-256",
            SaslMechanism::ScramSha512 => "SCRAM-SHA-512",
        }
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct SaslCredentials {
    pub mechanism: SaslMechanism,
    pub username: String,
    pub password: String,
}

/// Hand-written so a `{:?}` of the config — or of `Config`, which derives `Debug` —
/// can never print the password.
impl fmt::Debug for SaslCredentials {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SaslCredentials")
            .field("mechanism", &self.mechanism)
            .field("username", &self.username)
            .field("password", &"<redacted>")
            .finish()
    }
}

/// RabbitMQ connection URL. The URL carries the password in its userinfo, so it is
/// only reachable through [`JobQueueConfig::url`] and never through `Debug`.
#[derive(Clone, PartialEq, Eq)]
pub struct JobQueueConfig {
    url: String,
    tls: bool,
    host: String,
}

impl JobQueueConfig {
    pub fn url(&self) -> &str {
        &self.url
    }

    pub fn tls(&self) -> bool {
        self.tls
    }

    /// The URL with any userinfo replaced, for logs and error messages.
    pub fn redacted_url(&self) -> String {
        match self.url.split_once("://") {
            Some((scheme, rest)) => match rest.rsplit_once('@') {
                Some((_, host_and_path)) => format!("{scheme}://<redacted>@{host_and_path}"),
                None => self.url.clone(),
            },
            None => "<unparseable>".to_string(),
        }
    }
}

impl fmt::Debug for JobQueueConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("JobQueueConfig")
            .field("url", &self.redacted_url())
            .field("tls", &self.tls)
            .finish()
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum IngestMode {
    /// The API writes heartbeats to ClickHouse itself. Today's behaviour.
    #[default]
    Direct,
    /// Direct writes stay authoritative; every accepted heartbeat is also published
    /// so a consumer can prove the transport loses nothing (plan K3).
    Verify,
    /// Heartbeats for the cohort are accepted only after a Kafka acknowledgement (plan K4).
    Kafka,
}

impl IngestMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            IngestMode::Direct => "direct",
            IngestMode::Verify => "verify",
            IngestMode::Kafka => "kafka",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IngestConfig {
    pub mode: IngestMode,
    /// Parsed whenever it is set, but acted on only in `Kafka` mode. Leaving it set
    /// while switching back to `Direct` or `Verify` is deliberately legal: a rollback
    /// deploy must not fail because it did not also clear the cohort.
    pub kafka_cohort: Option<IngestCohort>,
    pub batch_size: usize,
    pub batch_wait: std::time::Duration,
    pub retry_min: std::time::Duration,
    pub retry_max: std::time::Duration,
    pub metrics_host: String,
    pub metrics_port: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AiUsageIngestConfig {
    pub mode: IngestMode,
    /// Parsed whenever set, but required only for `mode=kafka`; a stale value is
    /// deliberately harmless during a rollback to direct.
    pub kafka_cohort: Option<IngestCohort>,
    pub require_contract_v2: bool,
    pub batch_size: usize,
    pub batch_wait: std::time::Duration,
    pub retry_min: std::time::Duration,
    pub retry_max: std::time::Duration,
}

impl Default for AiUsageIngestConfig {
    fn default() -> Self {
        Self {
            mode: IngestMode::Direct,
            kafka_cohort: None,
            require_contract_v2: false,
            batch_size: 1_000,
            batch_wait: std::time::Duration::from_millis(500),
            retry_min: std::time::Duration::from_millis(1_000),
            retry_max: std::time::Duration::from_millis(60_000),
        }
    }
}

impl Default for IngestConfig {
    fn default() -> Self {
        Self {
            mode: IngestMode::Direct,
            kafka_cohort: None,
            batch_size: 1_000,
            batch_wait: std::time::Duration::from_millis(500),
            retry_min: std::time::Duration::from_millis(1_000),
            retry_max: std::time::Duration::from_millis(60_000),
            metrics_host: "127.0.0.1".to_string(),
            metrics_port: 9_090,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IngestCohort {
    All,
    /// 0–100. Membership is a pure function of the account ID, so every replica and
    /// every restart agrees on who is in.
    Percent(u8),
    Users(BTreeSet<Uuid>),
}

impl IngestCohort {
    pub fn includes(&self, user_id: Uuid) -> bool {
        match self {
            IngestCohort::All => true,
            IngestCohort::Percent(percent) => stable_bucket(user_id) < u64::from(*percent),
            IngestCohort::Users(users) => users.contains(&user_id),
        }
    }
}

/// Bucket 0–99 from the low 64 bits of the account UUID. Those bits are random in
/// both v4 and v7 IDs (v7 keeps its timestamp in the high bits), so the buckets are
/// even; `DefaultHasher` is avoided because its output is not promised to be stable
/// across Rust releases.
fn stable_bucket(user_id: Uuid) -> u64 {
    let (_, low) = user_id.as_u64_pair();
    low % 100
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ReprocessMode {
    /// Reprocess runs inside the HTTP request. Today's behaviour.
    #[default]
    Sync,
    /// Reprocess is accepted as a durable job and run by a worker (plan R4).
    Job,
}

impl BrokerConfig {
    pub fn from_env(postgres_configured: bool) -> Result<Self> {
        let config = Self::from_lookup(|key| std::env::var(key).ok(), postgres_configured)?;
        config.ensure_supported()?;
        Ok(config)
    }

    /// Structural parsing and cross-field rules, independent of what this build can run.
    fn from_lookup(
        lookup: impl Fn(&str) -> Option<String>,
        postgres_configured: bool,
    ) -> Result<Self> {
        let get = |key: &str| {
            lookup(key)
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        };

        let event_bus = parse_event_bus(&get)?;
        let job_queue = get(JOB_QUEUE_URL)
            .map(|url| parse_job_queue_url(&url))
            .transpose()
            .with_context(|| format!("{JOB_QUEUE_URL} is invalid"))?;

        let mode = parse_ingest_mode(get(INGEST_MODE), INGEST_MODE)?;
        let kafka_cohort = get(INGEST_KAFKA_COHORT)
            .map(|value| parse_cohort(&value))
            .transpose()
            .with_context(|| format!("{INGEST_KAFKA_COHORT} is invalid"))?;
        let batch_size =
            parse_bounded_u64(get(KAFKA_BATCH_SIZE), KAFKA_BATCH_SIZE, 1, 10_000, 1_000)? as usize;
        let batch_wait = std::time::Duration::from_millis(parse_bounded_u64(
            get(KAFKA_BATCH_WAIT_MS),
            KAFKA_BATCH_WAIT_MS,
            1,
            60_000,
            500,
        )?);
        let retry_min = std::time::Duration::from_millis(parse_bounded_u64(
            get(KAFKA_RETRY_MIN_MS),
            KAFKA_RETRY_MIN_MS,
            1,
            300_000,
            1_000,
        )?);
        let retry_max = std::time::Duration::from_millis(parse_bounded_u64(
            get(KAFKA_RETRY_MAX_MS),
            KAFKA_RETRY_MAX_MS,
            1,
            3_600_000,
            60_000,
        )?);
        if retry_min > retry_max {
            anyhow::bail!("{KAFKA_RETRY_MIN_MS} must not exceed {KAFKA_RETRY_MAX_MS}");
        }

        let ai_usage_mode = parse_ingest_mode(get(AI_USAGE_INGEST_MODE), AI_USAGE_INGEST_MODE)?;
        let ai_usage_kafka_cohort = get(AI_USAGE_KAFKA_COHORT)
            .map(|value| parse_cohort(&value))
            .transpose()
            .with_context(|| format!("{AI_USAGE_KAFKA_COHORT} is invalid"))?;
        let ai_usage_require_contract_v2 = get(AI_USAGE_REQUIRE_CONTRACT_V2)
            .map(|value| parse_bool(&value))
            .transpose()
            .with_context(|| format!("{AI_USAGE_REQUIRE_CONTRACT_V2} is invalid"))?
            .unwrap_or(false);
        let ai_usage_batch_size = parse_bounded_u64(
            get(AI_USAGE_KAFKA_BATCH_SIZE),
            AI_USAGE_KAFKA_BATCH_SIZE,
            1,
            10_000,
            1_000,
        )? as usize;
        let ai_usage_batch_wait = std::time::Duration::from_millis(parse_bounded_u64(
            get(AI_USAGE_KAFKA_BATCH_WAIT_MS),
            AI_USAGE_KAFKA_BATCH_WAIT_MS,
            1,
            60_000,
            500,
        )?);
        let ai_usage_retry_min = std::time::Duration::from_millis(parse_bounded_u64(
            get(AI_USAGE_KAFKA_RETRY_MIN_MS),
            AI_USAGE_KAFKA_RETRY_MIN_MS,
            1,
            300_000,
            1_000,
        )?);
        let ai_usage_retry_max = std::time::Duration::from_millis(parse_bounded_u64(
            get(AI_USAGE_KAFKA_RETRY_MAX_MS),
            AI_USAGE_KAFKA_RETRY_MAX_MS,
            1,
            3_600_000,
            60_000,
        )?);
        if ai_usage_retry_min > ai_usage_retry_max {
            anyhow::bail!(
                "{AI_USAGE_KAFKA_RETRY_MIN_MS} must not exceed {AI_USAGE_KAFKA_RETRY_MAX_MS}"
            );
        }
        let metrics_host = get(METRICS_HOST).unwrap_or_else(|| "127.0.0.1".to_string());
        let metrics_port =
            parse_bounded_u64(get(METRICS_PORT), METRICS_PORT, 1, u16::MAX as u64, 9090)? as u16;
        let ingest_state_source = match get(INGEST_STATE_SOURCE).as_deref() {
            None | Some("clickhouse") => IngestStateSource::ClickHouse,
            Some("dual") => IngestStateSource::Dual,
            Some("postgres") => IngestStateSource::Postgres,
            Some(_) => anyhow::bail!("{INGEST_STATE_SOURCE} must be clickhouse, dual or postgres"),
        };
        if ingest_state_source != IngestStateSource::ClickHouse && !postgres_configured {
            anyhow::bail!(
                "{INGEST_STATE_SOURCE}={} requires POSTGRES_URL",
                ingest_state_source.as_str()
            );
        }
        if (mode != IngestMode::Direct || ai_usage_mode != IngestMode::Direct)
            && event_bus.is_none()
        {
            anyhow::bail!("broker-backed heartbeat or AI usage ingest requires {EVENT_BUS_URL}");
        }
        // No implicit "everyone": the first Kafka deploy must name who moves.
        if mode == IngestMode::Kafka && kafka_cohort.is_none() {
            anyhow::bail!("{INGEST_MODE}=kafka requires {INGEST_KAFKA_COHORT}");
        }
        if mode == IngestMode::Kafka && ingest_state_source != IngestStateSource::Postgres {
            anyhow::bail!("{INGEST_MODE}=kafka requires {INGEST_STATE_SOURCE}=postgres");
        }
        if ai_usage_mode == IngestMode::Kafka && ai_usage_kafka_cohort.is_none() {
            anyhow::bail!("{AI_USAGE_INGEST_MODE}=kafka requires {AI_USAGE_KAFKA_COHORT}");
        }
        if ai_usage_mode == IngestMode::Kafka && !postgres_configured {
            anyhow::bail!("{AI_USAGE_INGEST_MODE}=kafka requires POSTGRES_URL");
        }
        if ai_usage_mode == IngestMode::Kafka && job_queue.is_none() {
            anyhow::bail!("{AI_USAGE_INGEST_MODE}=kafka requires {JOB_QUEUE_URL}");
        }

        let reprocess_mode = match get(REPROCESS_MODE).as_deref() {
            None => ReprocessMode::Sync,
            Some(value) => match value.to_ascii_lowercase().as_str() {
                "sync" => ReprocessMode::Sync,
                "job" => ReprocessMode::Job,
                _ => anyhow::bail!("{REPROCESS_MODE} must be sync or job"),
            },
        };
        if reprocess_mode == ReprocessMode::Job {
            if job_queue.is_none() {
                anyhow::bail!("{REPROCESS_MODE}=job requires {JOB_QUEUE_URL}");
            }
            // Job state lives in PostgreSQL (plan D5).
            if !postgres_configured {
                anyhow::bail!("{REPROCESS_MODE}=job requires POSTGRES_URL");
            }
        }

        Ok(Self {
            event_bus,
            job_queue,
            ingest: IngestConfig {
                mode,
                kafka_cohort,
                batch_size,
                batch_wait,
                retry_min,
                retry_max,
                metrics_host,
                metrics_port,
            },
            ai_usage: AiUsageIngestConfig {
                mode: ai_usage_mode,
                kafka_cohort: ai_usage_kafka_cohort,
                require_contract_v2: ai_usage_require_contract_v2,
                batch_size: ai_usage_batch_size,
                batch_wait: ai_usage_batch_wait,
                retry_min: ai_usage_retry_min,
                retry_max: ai_usage_retry_max,
            },
            ingest_state_source,
            reprocess_mode,
        })
    }

    /// Refuses broker modes when the binary was built without the Kafka adapter.
    /// The default feature set therefore remains a safe direct-only deployment,
    /// while production images can opt into the fully wired K1–K4 path.
    fn ensure_supported(&self) -> Result<()> {
        #[cfg(not(feature = "kafka"))]
        if self.ingest.mode != IngestMode::Direct || self.ai_usage.mode != IngestMode::Direct {
            anyhow::bail!(
                "broker-backed ingest is not available in this build: the Kafka producer and \
                 consumer have not landed (plan K1-K4). Unset it or use `direct`.",
            );
        }
        #[cfg(feature = "kafka")]
        if (self.ingest.mode != IngestMode::Direct || self.ai_usage.mode != IngestMode::Direct)
            && self.event_bus.is_none()
        {
            anyhow::bail!("broker-backed ingest requires {EVENT_BUS_URL}");
        }
        Ok(())
    }

    /// One line per configured broker so an operator can see from the boot log what
    /// is — and is not — connected. Never prints credentials.
    pub fn log_startup_summary(&self) {
        tracing::info!(
            ingest_mode = self.ingest.mode.as_str(),
            ai_usage_ingest_mode = self.ai_usage.mode.as_str(),
            ai_usage_require_contract_v2 = self.ai_usage.require_contract_v2,
            reprocess_mode = ?self.reprocess_mode,
            "broker modes"
        );
        if let Some(event_bus) = &self.event_bus {
            #[cfg(feature = "kafka")]
            tracing::info!(
                bootstrap_servers = ?event_bus.bootstrap_servers,
                tls = event_bus.tls,
                sasl = event_bus.sasl.as_ref().map(|sasl| sasl.mechanism.as_str()),
                "{EVENT_BUS_URL} is configured for Kafka"
            );
            #[cfg(not(feature = "kafka"))]
            tracing::warn!(
                bootstrap_servers = ?event_bus.bootstrap_servers,
                tls = event_bus.tls,
                sasl = event_bus.sasl.as_ref().map(|sasl| sasl.mechanism.as_str()),
                "{EVENT_BUS_URL} is set but the Kafka adapter is not compiled; it is unused"
            );
        }
        if let Some(job_queue) = &self.job_queue {
            tracing::info!(
                url = %job_queue.redacted_url(),
                "{JOB_QUEUE_URL} is set; the dedicated job-worker connects to RabbitMQ when POSTGRES_URL is also configured (plan R3)"
            );
            if !job_queue.tls() && !is_loopback_host(&job_queue.host) {
                tracing::warn!(
                    "{JOB_QUEUE_URL} uses plaintext amqp:// to a non-local host; managed \
                     RabbitMQ should be reached over amqps://"
                );
            }
        }
    }
}

fn parse_ingest_mode(value: Option<String>, key: &str) -> Result<IngestMode> {
    match value.as_deref() {
        None => Ok(IngestMode::Direct),
        Some(value) => match value.to_ascii_lowercase().as_str() {
            "direct" => Ok(IngestMode::Direct),
            "verify" => Ok(IngestMode::Verify),
            "kafka" => Ok(IngestMode::Kafka),
            _ => anyhow::bail!("{key} must be direct, verify or kafka"),
        },
    }
}

fn parse_bounded_u64(
    value: Option<String>,
    key: &str,
    min: u64,
    max: u64,
    default: u64,
) -> Result<u64> {
    let parsed = value
        .map(|value| value.parse::<u64>())
        .transpose()
        .with_context(|| format!("{key} must be an integer"))?
        .unwrap_or(default);
    if !(min..=max).contains(&parsed) {
        anyhow::bail!("{key} must be between {min} and {max}");
    }
    Ok(parsed)
}

fn parse_event_bus(get: &impl Fn(&str) -> Option<String>) -> Result<Option<EventBusConfig>> {
    let mechanism = get(EVENT_BUS_SASL_MECHANISM);
    let username = get(EVENT_BUS_SASL_USERNAME);
    let password = get(EVENT_BUS_SASL_PASSWORD);
    let tls = get(EVENT_BUS_TLS);

    let Some(url) = get(EVENT_BUS_URL) else {
        // Credentials without a bus are almost always a typo in the URL variable's
        // name; failing here beats discovering it when the first producer connects.
        if mechanism.is_some() || username.is_some() || password.is_some() || tls.is_some() {
            anyhow::bail!("{EVENT_BUS_URL} is required when any ATOAXIS_EVENT_BUS_* is set");
        }
        return Ok(None);
    };

    let bootstrap_servers = url
        .split(',')
        .map(str::trim)
        .map(|server| {
            validate_bootstrap_server(server)
                .with_context(|| format!("invalid {EVENT_BUS_URL} entry: {server}"))?;
            Ok(server.to_string())
        })
        .collect::<Result<Vec<_>>>()?;

    let sasl = match (mechanism, username, password) {
        (None, None, None) => None,
        (Some(mechanism), Some(username), Some(password)) => Some(SaslCredentials {
            mechanism: match mechanism.to_ascii_uppercase().as_str() {
                "PLAIN" => SaslMechanism::Plain,
                "SCRAM-SHA-256" => SaslMechanism::ScramSha256,
                "SCRAM-SHA-512" => SaslMechanism::ScramSha512,
                _ => anyhow::bail!(
                    "{EVENT_BUS_SASL_MECHANISM} must be PLAIN, SCRAM-SHA-256 or SCRAM-SHA-512"
                ),
            },
            username,
            password,
        }),
        _ => anyhow::bail!(
            "{EVENT_BUS_SASL_MECHANISM}, {EVENT_BUS_SASL_USERNAME} and \
             {EVENT_BUS_SASL_PASSWORD} must be set together"
        ),
    };

    // TLS follows SASL by default because every managed provider pairs them, and SASL
    // over plaintext would send the credentials (for PLAIN, the password itself) in clear.
    let tls = match tls {
        None => sasl.is_some(),
        Some(value) => parse_bool(&value).with_context(|| format!("{EVENT_BUS_TLS} is invalid"))?,
    };
    if sasl.is_some() && !tls {
        anyhow::bail!("SASL credentials require {EVENT_BUS_TLS}=true");
    }

    Ok(Some(EventBusConfig {
        bootstrap_servers,
        tls,
        sasl,
    }))
}

/// librdkafka wants bare `host:port`; a pasted `kafka://` or `https://` URL would fail
/// later with a much less obvious error.
fn validate_bootstrap_server(server: &str) -> Result<()> {
    if server.contains("://") {
        anyhow::bail!("expected host:port without a scheme");
    }
    let (host, port) = server.rsplit_once(':').context("expected host:port")?;
    if host.is_empty() {
        anyhow::bail!("host is empty");
    }
    port.parse::<u16>()
        .ok()
        .filter(|port| *port != 0)
        .context("port must be 1-65535")?;
    Ok(())
}

fn parse_job_queue_url(url: &str) -> Result<JobQueueConfig> {
    let uri: Uri = url
        .parse()
        .context("expected amqp://user:password@host:port/vhost")?;
    let tls = match uri.scheme_str() {
        Some(scheme) if scheme.eq_ignore_ascii_case("amqps") => true,
        Some(scheme) if scheme.eq_ignore_ascii_case("amqp") => false,
        _ => anyhow::bail!("scheme must be amqp or amqps"),
    };
    let host = uri
        .host()
        .filter(|host| !host.is_empty())
        .context("URL must include a host")?
        .to_string();
    Ok(JobQueueConfig {
        url: url.to_string(),
        tls,
        host,
    })
}

fn parse_cohort(value: &str) -> Result<IngestCohort> {
    if value.eq_ignore_ascii_case("all") {
        return Ok(IngestCohort::All);
    }
    if let Some(percent) = value.strip_prefix("percent:") {
        let percent: u8 = percent
            .trim()
            .parse()
            .ok()
            .filter(|percent| *percent <= 100)
            .context("percent must be an integer from 0 to 100")?;
        return Ok(IngestCohort::Percent(percent));
    }
    if let Some(users) = value.strip_prefix("users:") {
        let users = users
            .split(',')
            .map(str::trim)
            .filter(|user| !user.is_empty())
            .map(|user| {
                Uuid::parse_str(user).with_context(|| format!("not an account UUID: {user}"))
            })
            .collect::<Result<BTreeSet<_>>>()?;
        if users.is_empty() {
            anyhow::bail!("users: needs at least one account UUID");
        }
        return Ok(IngestCohort::Users(users));
    }
    anyhow::bail!("expected all, percent:<0-100> or users:<uuid>[,<uuid>...]")
}

fn parse_bool(value: &str) -> Result<bool> {
    match value.to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" => Ok(true),
        "0" | "false" | "no" => Ok(false),
        _ => anyhow::bail!("expected true or false"),
    }
}

fn is_loopback_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || host
            .trim_matches(|c| c == '[' || c == ']')
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn parse(vars: &[(&str, &str)], postgres: bool) -> Result<BrokerConfig> {
        let vars: HashMap<String, String> = vars
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect();
        BrokerConfig::from_lookup(|key| vars.get(key).cloned(), postgres)
    }

    fn managed_kafka() -> Vec<(&'static str, &'static str)> {
        vec![
            (
                EVENT_BUS_URL,
                "seed-1.example.cloud:9092, seed-2.example.cloud:9092",
            ),
            (EVENT_BUS_SASL_MECHANISM, "scram-sha-256"),
            (EVENT_BUS_SASL_USERNAME, "atoaxis"),
            (EVENT_BUS_SASL_PASSWORD, "not-a-real-secret"),
        ]
    }

    #[test]
    fn nothing_set_means_todays_behaviour() {
        let config = parse(&[], false).unwrap();
        assert_eq!(config.event_bus, None);
        assert!(config.job_queue.is_none());
        assert_eq!(config.ingest, IngestConfig::default());
        assert_eq!(config.ingest.mode, IngestMode::Direct);
        assert_eq!(config.reprocess_mode, ReprocessMode::Sync);
        assert!(config.ensure_supported().is_ok());
    }

    #[test]
    fn blank_values_count_as_unset() {
        let config = parse(&[(EVENT_BUS_URL, "  "), (INGEST_MODE, "")], false).unwrap();
        assert_eq!(config.event_bus, None);
        assert_eq!(config.ingest.mode, IngestMode::Direct);
    }

    #[test]
    fn managed_kafka_parses_with_tls_implied_by_sasl() {
        let config = parse(&managed_kafka(), false).unwrap();
        let bus = config.event_bus.unwrap();
        assert_eq!(
            bus.bootstrap_servers,
            ["seed-1.example.cloud:9092", "seed-2.example.cloud:9092"]
        );
        assert!(bus.tls);
        assert_eq!(bus.sasl.unwrap().mechanism, SaslMechanism::ScramSha256);
    }

    #[test]
    fn sasl_over_plaintext_is_refused() {
        let mut vars = managed_kafka();
        vars.push((EVENT_BUS_TLS, "false"));
        assert!(parse(&vars, false).is_err());
    }

    #[test]
    fn partial_sasl_and_orphan_settings_are_refused() {
        let mut vars = managed_kafka();
        vars.retain(|(key, _)| *key != EVENT_BUS_SASL_PASSWORD);
        assert!(parse(&vars, false).is_err());

        assert!(parse(&[(EVENT_BUS_SASL_USERNAME, "atoaxis")], false).is_err());
        assert!(parse(&[(EVENT_BUS_TLS, "true")], false).is_err());
    }

    #[test]
    fn bootstrap_servers_must_be_bare_host_port() {
        for bad in ["kafka://seed:9092", "seed", "seed:0", ":9092", "seed:9092,"] {
            assert!(parse(&[(EVENT_BUS_URL, bad)], false).is_err(), "{bad}");
        }
        assert!(parse(&[(EVENT_BUS_URL, "localhost:9092")], false).is_ok());
    }

    #[test]
    fn credentials_never_reach_debug_output() {
        let config = parse(
            &[
                (
                    JOB_QUEUE_URL,
                    "amqps://atoaxis:hunter2@mq.example.cloud:5671/prod",
                ),
                (EVENT_BUS_URL, "seed:9092"),
                (EVENT_BUS_SASL_MECHANISM, "PLAIN"),
                (EVENT_BUS_SASL_USERNAME, "atoaxis"),
                (EVENT_BUS_SASL_PASSWORD, "hunter3"),
            ],
            false,
        )
        .unwrap();
        let debug = format!("{config:?}");
        assert!(
            !debug.contains("hunter2") && !debug.contains("hunter3"),
            "{debug}"
        );
        let job_queue = config.job_queue.unwrap();
        assert!(job_queue.tls());
        assert_eq!(
            job_queue.redacted_url(),
            "amqps://<redacted>@mq.example.cloud:5671/prod"
        );
        assert_eq!(
            job_queue.url(),
            "amqps://atoaxis:hunter2@mq.example.cloud:5671/prod"
        );
    }

    #[test]
    fn job_queue_url_needs_an_amqp_scheme_and_host() {
        for bad in [
            "https://mq.example.cloud",
            "mq.example.cloud:5672",
            "amqp:///vhost",
        ] {
            assert!(parse(&[(JOB_QUEUE_URL, bad)], false).is_err(), "{bad}");
        }
        let config = parse(
            &[(JOB_QUEUE_URL, "amqp://guest:guest@localhost:5672/%2f")],
            false,
        );
        assert!(!config.unwrap().job_queue.unwrap().tls());
    }

    #[test]
    fn broker_modes_require_their_broker() {
        assert!(parse(&[(INGEST_MODE, "verify")], false).is_err());
        assert!(parse(&[(INGEST_MODE, "sideways")], false).is_err());
        assert!(parse(&[(REPROCESS_MODE, "job")], true).is_err());

        let job_queue = (JOB_QUEUE_URL, "amqps://u:p@mq.example.cloud:5671/%2f");
        assert!(parse(&[job_queue, (REPROCESS_MODE, "job")], false).is_err());
        assert!(parse(&[job_queue, (REPROCESS_MODE, "job")], true).is_ok());
    }

    #[test]
    fn kafka_mode_requires_an_explicit_cohort() {
        let mut vars = managed_kafka();
        vars.push((INGEST_MODE, "kafka"));
        assert!(parse(&vars, false).is_err());
        vars.push((INGEST_KAFKA_COHORT, "percent:5"));
        assert!(
            parse(&vars, false).is_err(),
            "Kafka mode requires PostgreSQL state"
        );
        vars.push((INGEST_STATE_SOURCE, "postgres"));
        assert_eq!(
            parse(&vars, true).unwrap().ingest.kafka_cohort,
            Some(IngestCohort::Percent(5))
        );
    }

    #[test]
    fn kafka_mode_requires_postgres_state_source() {
        let mut vars = managed_kafka();
        vars.extend([(INGEST_MODE, "kafka"), (INGEST_KAFKA_COHORT, "all")]);
        assert!(parse(&vars, true).is_err());
        vars.push((INGEST_STATE_SOURCE, "postgres"));
        assert!(parse(&vars, true).is_ok());
    }

    #[test]
    fn ai_usage_rollout_is_independent_and_requires_all_kafka_dependencies() {
        let mut vars = managed_kafka();
        vars.extend([
            (AI_USAGE_INGEST_MODE, "kafka"),
            (AI_USAGE_KAFKA_COHORT, "percent:5"),
            (JOB_QUEUE_URL, "amqps://u:p@mq.example.cloud:5671/%2f"),
        ]);
        let config = parse(&vars, true).unwrap();
        assert_eq!(config.ingest.mode, IngestMode::Direct);
        assert_eq!(config.ai_usage.mode, IngestMode::Kafka);
        assert_eq!(config.ai_usage.kafka_cohort, Some(IngestCohort::Percent(5)));

        let mut missing_cohort = vars.clone();
        missing_cohort.retain(|(key, _)| *key != AI_USAGE_KAFKA_COHORT);
        assert!(parse(&missing_cohort, true).is_err());

        let mut missing_jobs = vars;
        missing_jobs.retain(|(key, _)| *key != JOB_QUEUE_URL);
        assert!(parse(&missing_jobs, true).is_err());
    }

    #[test]
    fn ai_usage_cohort_and_contract_requirement_do_not_block_direct_rollback() {
        let config = parse(
            &[
                (AI_USAGE_KAFKA_COHORT, "all"),
                (AI_USAGE_REQUIRE_CONTRACT_V2, "true"),
            ],
            false,
        )
        .unwrap();
        assert_eq!(config.ai_usage.mode, IngestMode::Direct);
        assert!(config.ai_usage.require_contract_v2);
        assert!(config.ensure_supported().is_ok());
    }

    #[test]
    fn a_leftover_cohort_does_not_block_a_rollback_deploy() {
        let config = parse(&[(INGEST_KAFKA_COHORT, "all")], false).unwrap();
        assert_eq!(config.ingest.mode, IngestMode::Direct);
        assert!(config.ensure_supported().is_ok());
    }

    #[test]
    fn modes_without_an_implementation_refuse_to_boot() {
        let mut vars = managed_kafka();
        vars.push((INGEST_MODE, "verify"));
        let verify = parse(&vars, false).unwrap();
        #[cfg(feature = "kafka")]
        assert!(verify.ensure_supported().is_ok());
        #[cfg(not(feature = "kafka"))]
        assert!(verify.ensure_supported().is_err());

        let job = parse(
            &[
                (JOB_QUEUE_URL, "amqps://u:p@mq.example.cloud:5671/%2f"),
                (REPROCESS_MODE, "job"),
            ],
            true,
        )
        .unwrap();
        assert!(job.ensure_supported().is_ok());
    }

    #[test]
    fn cohort_syntax() {
        assert_eq!(parse_cohort("ALL").unwrap(), IngestCohort::All);
        assert!(parse_cohort("percent:101").is_err());
        assert!(parse_cohort("percent:-1").is_err());
        assert!(parse_cohort("users:").is_err());
        assert!(parse_cohort("users:not-a-uuid").is_err());
        assert!(parse_cohort("half").is_err());

        let user = Uuid::now_v7();
        let cohort = parse_cohort(&format!("users: {user} ,")).unwrap();
        assert!(cohort.includes(user));
        assert!(!cohort.includes(Uuid::now_v7()));
    }

    #[test]
    fn percent_cohorts_are_stable_and_roughly_proportional() {
        assert!(!IngestCohort::Percent(0).includes(Uuid::now_v7()));
        assert!(IngestCohort::Percent(100).includes(Uuid::now_v7()));

        let users: Vec<Uuid> = (0..10_000).map(|_| Uuid::now_v7()).collect();
        let cohort = IngestCohort::Percent(10);
        let first: Vec<bool> = users.iter().map(|user| cohort.includes(*user)).collect();
        let again: Vec<bool> = users.iter().map(|user| cohort.includes(*user)).collect();
        assert_eq!(first, again);
        let included = first.iter().filter(|included| **included).count();
        assert!((700..=1300).contains(&included), "{included} of 10000");
    }

    #[test]
    fn loopback_detection() {
        assert!(is_loopback_host("localhost"));
        assert!(is_loopback_host("127.0.0.1"));
        assert!(is_loopback_host("[::1]"));
        assert!(!is_loopback_host("mq.example.cloud"));
    }
}

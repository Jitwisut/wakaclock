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
const REPROCESS_MODE: &str = "ATOAXIS_REPROCESS_MODE";

#[derive(Debug, Clone, Default)]
pub struct BrokerConfig {
    pub event_bus: Option<EventBusConfig>,
    pub job_queue: Option<JobQueueConfig>,
    pub ingest: IngestConfig,
    pub reprocess_mode: ReprocessMode,
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
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "read by the RabbitMQ adapter (plan R1)")
    )]
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

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct IngestConfig {
    pub mode: IngestMode,
    /// Parsed whenever it is set, but acted on only in `Kafka` mode. Leaving it set
    /// while switching back to `Direct` or `Verify` is deliberately legal: a rollback
    /// deploy must not fail because it did not also clear the cohort.
    pub kafka_cohort: Option<IngestCohort>,
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
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "read by the Kafka ingest switch (plan K4)")
    )]
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

        let mode = match get(INGEST_MODE).as_deref() {
            None => IngestMode::Direct,
            Some(value) => match value.to_ascii_lowercase().as_str() {
                "direct" => IngestMode::Direct,
                "verify" => IngestMode::Verify,
                "kafka" => IngestMode::Kafka,
                _ => anyhow::bail!("{INGEST_MODE} must be direct, verify or kafka"),
            },
        };
        let kafka_cohort = get(INGEST_KAFKA_COHORT)
            .map(|value| parse_cohort(&value))
            .transpose()
            .with_context(|| format!("{INGEST_KAFKA_COHORT} is invalid"))?;
        if mode != IngestMode::Direct && event_bus.is_none() {
            anyhow::bail!("{INGEST_MODE}={} requires {EVENT_BUS_URL}", mode.as_str());
        }
        // No implicit "everyone": the first Kafka deploy must name who moves.
        if mode == IngestMode::Kafka && kafka_cohort.is_none() {
            anyhow::bail!("{INGEST_MODE}=kafka requires {INGEST_KAFKA_COHORT}");
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
            ingest: IngestConfig { mode, kafka_cohort },
            reprocess_mode,
        })
    }

    /// Refuses modes whose implementation has not landed yet. Each later PR removes
    /// its own line here in the same change that makes the mode real.
    fn ensure_supported(&self) -> Result<()> {
        if self.ingest.mode != IngestMode::Direct {
            anyhow::bail!(
                "{INGEST_MODE}={} is not available in this build: the Kafka producer and \
                 consumer have not landed (plan K1-K4). Unset it or use `direct`.",
                self.ingest.mode.as_str()
            );
        }
        if self.reprocess_mode != ReprocessMode::Sync {
            anyhow::bail!(
                "{REPROCESS_MODE}=job is not available in this build: the job worker has not \
                 landed (plan R1-R4). Unset it or use `sync`."
            );
        }
        Ok(())
    }

    /// One line per configured broker so an operator can see from the boot log what
    /// is — and is not — connected. Never prints credentials.
    pub fn log_startup_summary(&self) {
        tracing::info!(
            ingest_mode = self.ingest.mode.as_str(),
            reprocess_mode = ?self.reprocess_mode,
            "broker modes"
        );
        if let Some(event_bus) = &self.event_bus {
            tracing::warn!(
                bootstrap_servers = ?event_bus.bootstrap_servers,
                tls = event_bus.tls,
                sasl = event_bus.sasl.as_ref().map(|sasl| sasl.mechanism.as_str()),
                "{EVENT_BUS_URL} is set but no Kafka adapter exists in this build; it is unused"
            );
        }
        if let Some(job_queue) = &self.job_queue {
            tracing::warn!(
                url = %job_queue.redacted_url(),
                "{JOB_QUEUE_URL} is set but no RabbitMQ adapter exists in this build; it is unused"
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
        assert_eq!(
            parse(&vars, false).unwrap().ingest.kafka_cohort,
            Some(IngestCohort::Percent(5))
        );
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
        assert!(verify.ensure_supported().is_err());

        let job = parse(
            &[
                (JOB_QUEUE_URL, "amqps://u:p@mq.example.cloud:5671/%2f"),
                (REPROCESS_MODE, "job"),
            ],
            true,
        )
        .unwrap();
        assert!(job.ensure_supported().is_err());
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

//! Shared RabbitMQ worker lifecycle.
//!
//! Every bounded background job uses the same claim/lease/acknowledgement rules. Keeping
//! the lifecycle here prevents a newly added processor from accidentally acknowledging a
//! delivery before PostgreSQL has recorded its result, or from implementing a different
//! retry budget than the existing workers.

use anyhow::{Context, Result};
use async_trait::async_trait;
use axum::{
    http::{header, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use serde_json::Value;
use std::{
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    sync::{oneshot, Notify},
    task::JoinSet,
};
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::infrastructure::contracts::{JobConsumer, JobDelivery, JobKind};
use crate::infrastructure::job_relay;
use crate::infrastructure::metrics::global_job_metrics;
use crate::infrastructure::rabbitmq::RabbitMqJobQueue;
use crate::services::jobs::{ClaimOutcome, ClaimedJob, JobService, TransitionOutcome};

const DEFAULT_LEASE: Duration = Duration::from_secs(300);
const DEFAULT_RENEW: Duration = Duration::from_secs(60);
const DEFAULT_SHUTDOWN_GRACE: Duration = Duration::from_secs(30);
const DEFAULT_HEALTH_HOST: &str = "0.0.0.0";
const REQUEUE_BACKOFF: Duration = Duration::from_millis(250);

#[derive(Debug, Clone, Copy)]
pub struct WorkerRuntimeConfig {
    pub worker_name: &'static str,
    pub kind: JobKind,
    /// Only the dedicated `job-worker` owns the shared PostgreSQL outbox relay.
    /// Other workers consume their own queue but must not each start another relay
    /// connection/sweep loop.
    pub start_outbox_relay: bool,
    pub prefetch_env: &'static str,
    pub default_prefetch: u16,
    pub health_host_env: &'static str,
    pub health_port_env: &'static str,
    pub default_health_port: u16,
    pub metrics_service: &'static str,
}

/// Cancellation/lease state shared by a processor and its renewal task.
///
/// A worker must not acknowledge a delivery after it has lost the database lease:
/// another worker may already be processing the same job. Processors can also call
/// [`LeaseGuard::ensure_active`] around long or externally visible operations.
#[derive(Clone, Default)]
pub struct LeaseGuard {
    lost: Arc<std::sync::atomic::AtomicBool>,
    notify: Arc<Notify>,
}

impl LeaseGuard {
    fn new() -> Self {
        Self::default()
    }

    fn mark_lost(&self) {
        if !self.lost.swap(true, std::sync::atomic::Ordering::AcqRel) {
            self.notify.notify_waiters();
        }
    }

    pub fn is_lost(&self) -> bool {
        self.lost.load(std::sync::atomic::Ordering::Acquire)
    }

    pub fn ensure_active(&self) -> Result<()> {
        if self.is_lost() {
            anyhow::bail!("job lease was lost")
        }
        Ok(())
    }

    async fn wait_lost(&self) {
        if self.is_lost() {
            return;
        }
        self.notify.notified().await;
    }
}

#[async_trait]
pub trait JobProcessor: Send + Sync {
    fn kind(&self) -> JobKind;

    async fn process(&self, job: &ClaimedJob, lease: LeaseGuard) -> Result<Value>;

    /// Return a stable, non-sensitive category. The category is persisted in PostgreSQL
    /// and exposed to operators, so implementations must never return formatted errors.
    fn error_code(&self, error: &anyhow::Error) -> &'static str {
        let _ = error;
        "processor_error"
    }
}

#[derive(Clone, Default)]
struct HealthState {
    ready: Arc<std::sync::atomic::AtomicBool>,
}

impl HealthState {
    fn set_ready(&self, value: bool) {
        self.ready
            .store(value, std::sync::atomic::Ordering::Release);
    }

    fn is_ready(&self) -> bool {
        self.ready.load(std::sync::atomic::Ordering::Acquire)
    }
}

/// Run one isolated JobKind until the broker or the process shuts down.
pub async fn run_worker(
    state: Arc<AppState>,
    config: WorkerRuntimeConfig,
    processor: Arc<dyn JobProcessor>,
) -> Result<()> {
    if processor.kind() != config.kind {
        anyhow::bail!(
            "{} registered processor for {}, expected {}",
            config.worker_name,
            processor.kind().routing_key(),
            config.kind.routing_key()
        );
    }

    let postgres = state
        .postgres
        .clone()
        .context("background worker requires POSTGRES_URL")?;
    let job_queue = state
        .config
        .brokers
        .job_queue
        .clone()
        .context("background worker requires ATOAXIS_JOB_QUEUE_URL")?;

    // Migrations are idempotent and guarded by PostgreSQL, so a worker may start before
    // the API without observing half-created job tables.
    postgres
        .migrate()
        .await
        .context("migrate PostgreSQL before starting background worker")?;
    let prefetch = parse_positive_u16_env(config.prefetch_env, config.default_prefetch)?;
    let health_port = parse_health_port_env(config.health_port_env, config.default_health_port)?;
    let lease = parse_positive_duration_env("ATOAXIS_JOB_LEASE_SECONDS", DEFAULT_LEASE)?;
    let renew_every = parse_positive_duration_env("ATOAXIS_JOB_RENEW_SECONDS", DEFAULT_RENEW)?;
    if renew_every >= lease {
        anyhow::bail!("ATOAXIS_JOB_RENEW_SECONDS must be shorter than ATOAXIS_JOB_LEASE_SECONDS");
    }
    let grace =
        parse_positive_duration_env("ATOAXIS_JOB_SHUTDOWN_SECONDS", DEFAULT_SHUTDOWN_GRACE)?;

    if config.start_outbox_relay {
        job_relay::spawn(state.job_service.clone(), job_queue.clone());
    }

    let health = HealthState::default();
    let (health_bound_tx, health_bound_rx) = oneshot::channel();
    let mut health_task = tokio::spawn(serve_health(
        config,
        health.clone(),
        health_bound_tx,
        postgres.clone(),
        state.clickhouse.clone(),
        health_port,
    ));
    health_bound_rx
        .await
        .context("background worker health server failed to bind")?
        .map_err(|error| {
            anyhow::anyhow!("background worker health server failed to bind: {error}")
        })?;
    let queue = match RabbitMqJobQueue::connect(&job_queue)
        .await
        .context("connect background worker to RabbitMQ")
    {
        Ok(queue) => queue,
        Err(error) => {
            health_task.abort();
            return Err(error);
        }
    };
    let consumer = match queue
        .consumer(
            config.kind,
            prefetch,
            &format!("wakaclock-{}-{}", config.worker_name, Uuid::now_v7()),
        )
        .await
        .context("declare background worker consumer")
    {
        Ok(consumer) => consumer,
        Err(error) => {
            let _ = queue.close().await;
            health_task.abort();
            return Err(error);
        }
    };

    health.set_ready(true);
    tracing::info!(
        worker = config.worker_name,
        kind = config.kind.routing_key(),
        "background worker ready"
    );

    let mut tasks = JoinSet::new();
    let shutdown = shutdown_signal();
    tokio::pin!(shutdown);
    let mut runtime_error = None;

    loop {
        tokio::select! {
            _ = &mut shutdown => break,
            joined = tasks.join_next(), if !tasks.is_empty() => {
                if let Some(Err(error)) = joined {
                    tracing::warn!(worker = config.worker_name, %error, "background processor task exited unexpectedly");
                }
            }
            health_result = &mut health_task => {
                health.set_ready(false);
                match health_result {
                    Ok(Ok(())) => {
                        // `serve_health` returns Ok(()) on the same shutdown signal
                        // handled by this runtime. A normal SIGTERM must drain the
                        // worker, not look like a crash to its supervisor.
                        tracing::debug!(worker = config.worker_name, "health server shut down");
                        break;
                    }
                    Ok(Err(error)) => tracing::error!(worker = config.worker_name, %error, "health server failed"),
                    Err(error) => tracing::error!(worker = config.worker_name, %error, "health server task panicked"),
                }
                runtime_error = Some(anyhow::anyhow!("background worker health server stopped"));
                break;
            }
            delivery = consumer.next_delivery() => {
                match delivery {
                    Ok(Some(delivery)) => {
                        let job_service = state.job_service.clone();
                        let processor = processor.clone();
                        tasks.spawn(async move {
                            process_delivery(delivery, job_service, processor, lease, renew_every).await;
                        });
                    }
                    Ok(None) => {
                        tracing::warn!(worker = config.worker_name, "RabbitMQ consumer ended; supervisor restart required");
                        runtime_error = Some(anyhow::anyhow!("background worker consumer ended"));
                        break;
                    }
                    Err(error) => {
                        tracing::error!(worker = config.worker_name, %error, "RabbitMQ consumer failed; supervisor restart required");
                        runtime_error = Some(anyhow::anyhow!("background worker consumer failed"));
                        break;
                    }
                }
            }
        }
    }

    health.set_ready(false);
    let drain = async { while tasks.join_next().await.is_some() {} };
    if tokio::time::timeout(grace, drain).await.is_err() {
        tracing::warn!(
            worker = config.worker_name,
            ?grace,
            "shutdown grace elapsed; unsettled deliveries will be redelivered"
        );
    }
    let _ = queue.close().await;
    health_task.abort();
    runtime_error.map_or(Ok(()), Err)
}

async fn process_delivery(
    delivery: Box<dyn JobDelivery>,
    job_service: Arc<JobService>,
    processor: Arc<dyn JobProcessor>,
    lease: Duration,
    renew_every: Duration,
) {
    let started_at = Instant::now();
    let metrics = global_job_metrics();
    metrics
        .deliveries_total
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let delivery_job = delivery.job().clone();
    let owner = Uuid::now_v7();
    let claimed = match job_service.claim(&delivery_job, owner, lease).await {
        Ok(ClaimOutcome::Claimed(job)) => {
            metrics
                .claimed_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            job
        }
        Ok(
            ClaimOutcome::AlreadyRunning
            | ClaimOutcome::Terminal(_)
            | ClaimOutcome::StaleAttempt
            | ClaimOutcome::Rejected,
        ) => {
            metrics
                .duplicate_deliveries_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let _ = delivery.ack().await;
            metrics.observe_processing(started_at.elapsed().as_millis() as u64);
            return;
        }
        Ok(ClaimOutcome::NotReady) => {
            metrics
                .not_ready_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            tracing::debug!(
                job_id = %delivery_job.job_id,
                "job is still queued; retaining delivery for a later claim"
            );
            requeue_delivery(delivery).await;
            metrics
                .requeued_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            metrics.observe_processing(started_at.elapsed().as_millis() as u64);
            return;
        }
        Err(error) => {
            metrics
                .claim_failures_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            tracing::warn!(%error, job_id = %delivery_job.job_id, "could not claim job; requeueing delivery");
            requeue_delivery(delivery).await;
            metrics
                .requeued_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            metrics.observe_processing(started_at.elapsed().as_millis() as u64);
            return;
        }
    };

    let lease_state = LeaseGuard::new();
    let renew_task = spawn_lease_renewer(
        job_service.clone(),
        claimed.id,
        claimed.attempt,
        owner,
        lease,
        renew_every,
        lease_state.clone(),
    );
    let result = tokio::select! {
        result = processor.process(&claimed, lease_state.clone()) => Some(result),
        _ = lease_state.wait_lost() => None,
    };
    renew_task.abort();

    let Some(result) = result else {
        metrics
            .lease_lost_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        tracing::warn!(job_id = %claimed.id, "job lease was lost while processor was running; requeueing delivery");
        requeue_delivery(delivery).await;
        metrics
            .requeued_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        metrics.observe_processing(started_at.elapsed().as_millis() as u64);
        return;
    };
    if lease_state.is_lost() {
        metrics
            .lease_lost_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        tracing::warn!(job_id = %claimed.id, "job lease was lost before transition; requeueing delivery");
        requeue_delivery(delivery).await;
        metrics
            .requeued_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        metrics.observe_processing(started_at.elapsed().as_millis() as u64);
        return;
    }

    match result {
        Ok(value) => match job_service
            .complete(claimed.id, claimed.attempt, owner, value)
            .await
        {
            Ok(TransitionOutcome::Applied | TransitionOutcome::AlreadyApplied) => {
                metrics
                    .completed_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                let _ = delivery.ack().await;
            }
            Err(error) => {
                metrics
                    .failure_transitions_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                tracing::warn!(%error, job_id = %claimed.id, "could not complete job; requeueing delivery");
                requeue_delivery(delivery).await;
                metrics
                    .requeued_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            }
            Ok(TransitionOutcome::LostLease) => {
                metrics
                    .lease_lost_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                tracing::warn!(job_id = %claimed.id, "job completion lost its lease; requeueing delivery");
                requeue_delivery(delivery).await;
                metrics
                    .requeued_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            }
        },
        Err(error) => {
            metrics
                .failure_transitions_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let code = processor.error_code(&error);
            let transition = if code == "invalid_params" {
                job_service
                    .dead_letter(claimed.id, claimed.attempt, owner, code)
                    .await
            } else {
                job_service
                    .schedule_retry(claimed.id, claimed.attempt, owner, code)
                    .await
            };
            match transition {
                Ok(TransitionOutcome::Applied | TransitionOutcome::AlreadyApplied) => {
                    if code == "invalid_params" {
                        metrics
                            .dead_lettered_total
                            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    } else {
                        metrics
                            .retries_total
                            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    }
                    let _ = delivery.ack().await;
                }
                Err(transition_error) => {
                    tracing::warn!(
                        error = %transition_error,
                        job_id = %claimed.id,
                        failure = %code,
                        "could not record job failure; requeueing delivery"
                    );
                    requeue_delivery(delivery).await;
                    metrics
                        .requeued_total
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                }
                Ok(TransitionOutcome::LostLease) => {
                    metrics
                        .lease_lost_total
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    tracing::warn!(job_id = %claimed.id, failure = %code, "job failure transition lost its lease; requeueing delivery");
                    requeue_delivery(delivery).await;
                    metrics
                        .requeued_total
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                }
            }
        }
    }
    metrics.observe_processing(started_at.elapsed().as_millis() as u64);
}

async fn requeue_delivery(delivery: Box<dyn JobDelivery>) {
    if let Err(error) = delivery.requeue().await {
        // A closed channel will cause RabbitMQ to redeliver the unsettled message;
        // keep the error bounded and do not acknowledge it as a fallback.
        tracing::warn!(%error, "could not requeue background job delivery");
    }
    tokio::time::sleep(REQUEUE_BACKOFF).await;
}

fn spawn_lease_renewer(
    job_service: Arc<JobService>,
    job_id: Uuid,
    attempt: i16,
    owner: Uuid,
    lease: Duration,
    every: Duration,
    lease_state: LeaseGuard,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(every.max(Duration::from_secs(1)));
        let mut expiration = Box::pin(tokio::time::sleep(lease));
        loop {
            tokio::select! {
                _ = &mut expiration => {
                    lease_state.mark_lost();
                    tracing::warn!(%job_id, "job lease expired while processor was running");
                    return;
                }
                _ = ticker.tick() => {
                    match job_service.renew_lease(job_id, attempt, owner, lease).await {
                        Ok(true) => expiration.as_mut().reset(tokio::time::Instant::now() + lease),
                        Ok(false) => {
                            lease_state.mark_lost();
                            tracing::warn!(%job_id, "job lease was lost while processor was running");
                            return;
                        }
                        Err(error) => tracing::warn!(%error, %job_id, "job lease renewal failed"),
                    }
                }
            }
        }
    })
}

async fn serve_health(
    config: WorkerRuntimeConfig,
    state: HealthState,
    bound: oneshot::Sender<std::result::Result<(), String>>,
    postgres: Arc<crate::infrastructure::postgres::PostgresClient>,
    clickhouse: Arc<crate::infrastructure::database::ClickHouseClient>,
    port: u16,
) -> Result<()> {
    let host =
        std::env::var(config.health_host_env).unwrap_or_else(|_| DEFAULT_HEALTH_HOST.to_string());
    let address: SocketAddr = format!("{host}:{port}")
        .parse()
        .context("invalid background worker health bind address")?;
    let readiness_state = state.clone();
    let readiness_postgres = postgres.clone();
    let readiness_clickhouse = clickhouse.clone();
    let metrics_service = config.metrics_service;
    let router = Router::new()
        .route("/live", get(|| async { StatusCode::OK }))
        .route(
            "/ready",
            get(move || {
                ready_response(
                    readiness_state.clone(),
                    readiness_postgres.clone(),
                    readiness_clickhouse.clone(),
                )
            }),
        )
        .route("/metrics", get(move || metrics_response(metrics_service)))
        .with_state(());
    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(error) => {
            let message = error.to_string();
            let _ = bound.send(Err(message.clone()));
            return Err(error.into());
        }
    };
    let _ = bound.send(Ok(()));
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("background worker health server failed")
}

async fn ready_response(
    state: HealthState,
    postgres: Arc<crate::infrastructure::postgres::PostgresClient>,
    clickhouse: Arc<crate::infrastructure::database::ClickHouseClient>,
) -> impl IntoResponse {
    if state.is_ready()
        && postgres.health_check().await.is_ok()
        && clickhouse.health_check().await.is_ok()
    {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    }
}

async fn metrics_response(service: &'static str) -> impl IntoResponse {
    let body = global_job_metrics().render_prometheus(service);
    (
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; version=0.0.4; charset=utf-8"),
        )],
        body,
    )
}

fn parse_positive_u16_env(name: &str, default: u16) -> Result<u16> {
    parse_positive_u16(name, std::env::var(name).ok(), default)
}

fn parse_positive_u16(name: &str, raw: Option<String>, default: u16) -> Result<u16> {
    let Some(raw) = raw else {
        if default == 0 {
            anyhow::bail!("{name} default must be positive");
        }
        return Ok(default);
    };
    let value = raw
        .trim()
        .parse::<u16>()
        .with_context(|| format!("{name} must be a positive integer"))?;
    if value == 0 {
        anyhow::bail!("{name} must be a positive integer");
    }
    Ok(value)
}

fn parse_health_port_env(name: &str, default: u16) -> Result<u16> {
    parse_positive_u16_env(name, default)
}

fn parse_positive_duration_env(name: &str, default: Duration) -> Result<Duration> {
    parse_positive_duration(name, std::env::var(name).ok(), default)
}

fn parse_positive_duration(name: &str, raw: Option<String>, default: Duration) -> Result<Duration> {
    let Some(raw) = raw else {
        if default.is_zero() {
            anyhow::bail!("{name} default must be positive");
        }
        return Ok(default);
    };
    let seconds = raw
        .trim()
        .parse::<u64>()
        .with_context(|| format!("{name} must be a positive integer number of seconds"))?;
    if seconds == 0 {
        anyhow::bail!("{name} must be a positive integer number of seconds");
    }
    Ok(Duration::from_secs(seconds))
}

/// Wait for the platform shutdown signal used by both RabbitMQ and Kafka workers.
/// Kubernetes and other supervisors send SIGTERM; listening only for Ctrl-C would
/// leave the consumer in its normal polling loop until it was force-killed.
pub async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("install SIGTERM handler");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {},
            _ = terminate.recv() => {},
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Processor(JobKind);

    #[async_trait]
    impl JobProcessor for Processor {
        fn kind(&self) -> JobKind {
            self.0
        }

        async fn process(&self, _job: &ClaimedJob, _lease: LeaseGuard) -> Result<Value> {
            Ok(Value::Null)
        }
    }

    #[test]
    fn runtime_config_cannot_pair_a_worker_with_the_wrong_processor() {
        let config = WorkerRuntimeConfig {
            worker_name: "test",
            kind: JobKind::ExportGenerate,
            start_outbox_relay: false,
            prefetch_env: "TEST_PREFETCH",
            default_prefetch: 1,
            health_host_env: "TEST_HOST",
            health_port_env: "TEST_PORT",
            default_health_port: 1,
            metrics_service: "test",
        };
        assert_ne!(Processor(JobKind::AnalyticsReprocess).kind(), config.kind);
    }

    #[test]
    fn worker_numeric_settings_reject_zero_and_malformed_values() {
        assert_eq!(parse_positive_u16("prefetch", None, 1).unwrap(), 1);
        assert_eq!(parse_positive_u16("health_port", None, 8080).unwrap(), 8080);
        assert_eq!(
            parse_positive_duration("lease", None, Duration::from_secs(1)).unwrap(),
            Duration::from_secs(1)
        );
        assert!(parse_positive_u16("prefetch", Some("0".into()), 1).is_err());
        assert!(parse_positive_u16("prefetch", Some("nope".into()), 1).is_err());
        assert!(
            parse_positive_duration("lease", Some("0".into()), Duration::from_secs(1)).is_err()
        );
        assert!(
            parse_positive_duration("lease", Some("nope".into()), Duration::from_secs(1)).is_err()
        );
    }
}

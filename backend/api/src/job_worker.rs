//! Dedicated RabbitMQ background worker (plans/plan-kafka-rabbitmq-adoption.md, R3/R4).
//!
//! The API owns the PostgreSQL job/outbox transaction. This process owns the outbox
//! relay, lease sweeper, and registered processors. Keeping those responsibilities out
//! of the HTTP process means an API restart cannot discard accepted work and a long
//! reprocess cannot consume the API's request capacity.

use anyhow::{Context, Result};
use axum::{http::StatusCode, response::IntoResponse, routing::get, Router};
use serde::Deserialize;
use serde_json::Value;
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::{sync::watch, task::JoinSet};
use uuid::Uuid;

use wakaclock_server::infrastructure::app::create_app_state;
use wakaclock_server::infrastructure::contracts::{JobConsumer, JobDelivery, JobKind};
use wakaclock_server::infrastructure::job_relay;
use wakaclock_server::infrastructure::rabbitmq::RabbitMqJobQueue;
use wakaclock_server::services::jobs::{ClaimOutcome, JobService, TransitionOutcome};
use wakaclock_server::services::reprocess::ReprocessService;

const DEFAULT_PREFETCH: u16 = 4;
const DEFAULT_LEASE: Duration = Duration::from_secs(300);
const DEFAULT_RENEW: Duration = Duration::from_secs(60);
const DEFAULT_SHUTDOWN_GRACE: Duration = Duration::from_secs(30);
const DEFAULT_HEALTH_HOST: &str = "0.0.0.0";
const DEFAULT_HEALTH_PORT: u16 = 8081;

#[derive(Debug, Deserialize)]
struct ReprocessParams {
    start: String,
    end: String,
    dry_run: bool,
}

#[derive(Clone, Default)]
struct HealthState {
    ready: Arc<std::sync::atomic::AtomicBool>,
}

impl HealthState {
    fn set_ready(&self, ready: bool) {
        self.ready
            .store(ready, std::sync::atomic::Ordering::Release);
    }

    fn is_ready(&self) -> bool {
        self.ready.load(std::sync::atomic::Ordering::Acquire)
    }
}

pub async fn run() -> Result<()> {
    dotenvy::dotenv().ok();

    let state = Arc::new(
        create_app_state()
            .await
            .context("initialize job-worker application state")?,
    );
    let postgres = state
        .postgres
        .clone()
        .context("job-worker requires POSTGRES_URL")?;
    let job_queue = state
        .config
        .brokers
        .job_queue
        .clone()
        .context("job-worker requires ATOAXIS_JOB_QUEUE_URL")?;

    // A worker may be deployed before the API. PostgreSQL migration is idempotent and
    // uses the same advisory lock as the API, so both startup orders are safe.
    postgres
        .migrate()
        .await
        .context("migrate PostgreSQL before starting job-worker")?;
    // `analytics.reprocess` writes its audit row from the processor. Keep the
    // worker start order-independent by ensuring that table exists even when the
    // API has not completed its ClickHouse migration pass yet.
    state
        .reprocess_service
        .migrate()
        .await
        .context("migrate ClickHouse before starting job-worker")?;

    let health = HealthState::default();
    let health_task = tokio::spawn(serve_health(health.clone()));

    // The relay opens its own publisher connection. The consumer below opens a separate
    // connection/channel, which prevents publisher flow-control from starving workers.
    job_relay::spawn(state.job_service.clone(), job_queue.clone());
    let queue = RabbitMqJobQueue::connect(&job_queue)
        .await
        .context("connect job-worker consumer to RabbitMQ")?;
    let consumer = queue
        .consumer(
            JobKind::AnalyticsReprocess,
            parse_u16_env("ATOAXIS_JOB_WORKER_PREFETCH", DEFAULT_PREFETCH),
            &format!("wakaclock-job-worker-{}", Uuid::now_v7()),
        )
        .await
        .context("declare analytics.reprocess consumer")?;
    health.set_ready(true);
    tracing::info!(
        kind = JobKind::AnalyticsReprocess.routing_key(),
        "job-worker ready"
    );

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let mut tasks = JoinSet::new();
    let lease = parse_duration_env("ATOAXIS_JOB_LEASE_SECONDS", DEFAULT_LEASE);
    let renew_every = parse_duration_env("ATOAXIS_JOB_RENEW_SECONDS", DEFAULT_RENEW);
    let shutdown = shutdown_signal();
    tokio::pin!(shutdown);

    loop {
        tokio::select! {
            _ = &mut shutdown => {
                let _ = shutdown_tx.send(true);
                break;
            }
            joined = tasks.join_next(), if !tasks.is_empty() => {
                if let Some(Err(error)) = joined {
                    tracing::warn!(%error, "job processor task exited unexpectedly");
                }
            }
            delivery = consumer.next_delivery() => {
                match delivery {
                    Ok(Some(delivery)) => {
                        let job_service = state.job_service.clone();
                        let reprocess = state.reprocess_service.clone();
                        let mut task_shutdown = shutdown_rx.clone();
                        tasks.spawn(async move {
                            process_delivery(
                                delivery,
                                job_service,
                                reprocess,
                                lease,
                                renew_every,
                                &mut task_shutdown,
                            ).await;
                        });
                    }
                    Ok(None) => {
                        tracing::warn!("RabbitMQ consumer ended; shutting down for supervisor restart");
                        break;
                    }
                    Err(error) => {
                        tracing::error!(%error, "RabbitMQ consumer failed; shutting down for supervisor restart");
                        break;
                    }
                }
            }
        }
    }

    health.set_ready(false);
    let grace = parse_duration_env("ATOAXIS_JOB_SHUTDOWN_SECONDS", DEFAULT_SHUTDOWN_GRACE);
    let drain = async { while tasks.join_next().await.is_some() {} };
    if tokio::time::timeout(grace, drain).await.is_err() {
        tracing::warn!(
            ?grace,
            "job-worker shutdown grace elapsed; unsettled deliveries will be redelivered"
        );
    }
    let _ = queue.close().await;
    health_task.abort();
    Ok(())
}

async fn process_delivery(
    delivery: Box<dyn JobDelivery>,
    job_service: Arc<JobService>,
    reprocess: Arc<ReprocessService>,
    lease: Duration,
    renew_every: Duration,
    shutdown: &mut watch::Receiver<bool>,
) {
    let job = delivery.job().clone();
    let owner = Uuid::now_v7();

    let claimed = match job_service.claim(&job, owner, lease).await {
        Ok(outcome) => outcome,
        Err(error) => {
            tracing::warn!(%error, job_id = %job.job_id, "could not claim job; leaving delivery unsettled");
            return;
        }
    };

    let claimed = match claimed {
        ClaimOutcome::Claimed(job) => job,
        ClaimOutcome::AlreadyRunning
        | ClaimOutcome::Terminal(_)
        | ClaimOutcome::StaleAttempt
        | ClaimOutcome::Rejected => {
            let _ = delivery.ack().await;
            return;
        }
    };

    let renew_task = spawn_lease_renewer(
        job_service.clone(),
        claimed.id,
        claimed.attempt,
        owner,
        lease,
        renew_every,
    );

    let result = if claimed.kind == JobKind::AnalyticsReprocess {
        match claimed.user_id {
            Some(user_id) => run_reprocess(&reprocess, user_id, claimed.params).await,
            None => Err(anyhow::anyhow!("invalid reprocess job scope")),
        }
    } else {
        Err(anyhow::anyhow!("unsupported job kind"))
    };
    renew_task.abort();

    match result {
        Ok(result) => {
            match job_service
                .complete(claimed.id, claimed.attempt, owner, result)
                .await
            {
                Ok(TransitionOutcome::Applied | TransitionOutcome::AlreadyApplied)
                | Ok(TransitionOutcome::LostLease) => {
                    let _ = delivery.ack().await;
                }
                Err(error) => {
                    tracing::warn!(%error, job_id = %claimed.id, "could not complete job; leaving delivery unsettled");
                }
            }
        }
        Err(error) => {
            let code = classify_error(&error);
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
                Ok(TransitionOutcome::Applied | TransitionOutcome::AlreadyApplied)
                | Ok(TransitionOutcome::LostLease) => {
                    let _ = delivery.ack().await;
                }
                Err(transition_error) => {
                    tracing::warn!(
                        error = %transition_error,
                        job_id = %claimed.id,
                        failure = %code,
                        "could not record job failure; leaving delivery unsettled"
                    );
                }
            }
        }
    }

    // A shutdown request is intentionally observed only after the current delivery has
    // reached a durable state. The outer loop stops receiving new messages first.
    let _ = shutdown.has_changed();
}

async fn run_reprocess(service: &ReprocessService, user_id: Uuid, params: Value) -> Result<Value> {
    let params: ReprocessParams = serde_json::from_value(params)
        .map_err(|_| anyhow::anyhow!("invalid reprocess job parameters"))?;
    let data = service
        .run(user_id, &params.start, &params.end, params.dry_run)
        .await?;
    Ok(serde_json::to_value(data)?)
}

fn classify_error(error: &anyhow::Error) -> &'static str {
    if error.to_string().contains("invalid reprocess job") {
        "invalid_params"
    } else {
        "processor_error"
    }
}

fn spawn_lease_renewer(
    job_service: Arc<JobService>,
    job_id: Uuid,
    attempt: i16,
    owner: Uuid,
    lease: Duration,
    every: Duration,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(every.max(Duration::from_secs(1)));
        ticker.tick().await;
        loop {
            ticker.tick().await;
            match job_service.renew_lease(job_id, attempt, owner, lease).await {
                Ok(true) => {}
                Ok(false) => {
                    tracing::warn!(%job_id, "job lease was lost while processor was running");
                    return;
                }
                Err(error) => {
                    tracing::warn!(%error, %job_id, "job lease renewal failed");
                }
            }
        }
    })
}

async fn serve_health(state: HealthState) -> Result<()> {
    let host = std::env::var("ATOAXIS_JOB_WORKER_HEALTH_HOST")
        .unwrap_or_else(|_| DEFAULT_HEALTH_HOST.to_string());
    let port = parse_u16_env("ATOAXIS_JOB_WORKER_HEALTH_PORT", DEFAULT_HEALTH_PORT);
    let address: SocketAddr = format!("{host}:{port}")
        .parse()
        .context("invalid job-worker health bind address")?;
    let router = Router::new()
        .route("/live", get(|| async { StatusCode::OK }))
        .route("/ready", get(move || ready_response(state.clone())))
        .with_state(());
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("job-worker health server failed")
}

async fn ready_response(state: HealthState) -> impl IntoResponse {
    if state.is_ready() {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    }
}

fn parse_u16_env(name: &str, default: u16) -> u16 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

fn parse_duration_env(name: &str, default: Duration) -> Duration {
    Duration::from_secs(
        std::env::var(name)
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(default.as_secs()),
    )
}

async fn shutdown_signal() {
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

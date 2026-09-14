//! Dedicated `ai.session.reconcile` RabbitMQ worker (K5.4).

use anyhow::{Context, Result};
use axum::{http::StatusCode, response::IntoResponse, routing::get, Router};
use serde::Deserialize;
use serde_json::Value;
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::{sync::watch, task::JoinSet};
use uuid::Uuid;

use wakaclock_core::ai::MAX_USAGE_IDENTIFIER_BYTES;
use wakaclock_server::infrastructure::app::create_app_state;
use wakaclock_server::infrastructure::contracts::{JobConsumer, JobDelivery, JobKind};
use wakaclock_server::infrastructure::job_relay;
use wakaclock_server::infrastructure::metrics::global_kafka_metrics;
use wakaclock_server::infrastructure::rabbitmq::RabbitMqJobQueue;
use wakaclock_server::services::ai_usage::AiUsageService;
use wakaclock_server::services::jobs::{ClaimOutcome, JobService, TransitionOutcome};

const DEFAULT_PREFETCH: u16 = 10;
const DEFAULT_LEASE: Duration = Duration::from_secs(300);
const DEFAULT_RENEW: Duration = Duration::from_secs(60);
const DEFAULT_SHUTDOWN_GRACE: Duration = Duration::from_secs(30);

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SessionParams {
    schema_version: u16,
    ai_session_id: String,
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

pub async fn run() -> Result<()> {
    dotenvy::dotenv().ok();
    let state = Arc::new(
        create_app_state()
            .await
            .context("initialize ai-session-worker application state")?,
    );
    let postgres = state
        .postgres
        .clone()
        .context("ai-session-worker requires POSTGRES_URL")?;
    let queue_config = state
        .config
        .brokers
        .job_queue
        .clone()
        .context("ai-session-worker requires ATOAXIS_JOB_QUEUE_URL")?;
    postgres.migrate().await?;
    state.ai_usage_repo.migrate().await?;
    job_relay::spawn(state.job_service.clone(), queue_config.clone());

    let health = HealthState::default();
    let health_task = tokio::spawn(serve_health(health.clone()));
    let queue = RabbitMqJobQueue::connect(&queue_config)
        .await
        .context("connect ai-session-worker to RabbitMQ")?;
    let prefetch = parse_u16_env("ATOAXIS_AI_SESSION_WORKER_PREFETCH", DEFAULT_PREFETCH);
    let consumer = queue
        .consumer(
            JobKind::AiSessionReconcile,
            prefetch,
            &format!("wakaclock-ai-session-worker-{}", Uuid::now_v7()),
        )
        .await
        .context("declare ai.session.reconcile consumer")?;
    health.set_ready(true);
    tracing::info!(
        kind = JobKind::AiSessionReconcile.routing_key(),
        prefetch,
        "ai-session-worker ready"
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
                    tracing::warn!(%error, "ai-session-worker task exited unexpectedly");
                }
            }
            delivery = consumer.next_delivery() => {
                match delivery {
                    Ok(Some(delivery)) => {
                        let job_service = state.job_service.clone();
                        let usage_service = state.ai_usage_service.clone();
                        let mut task_shutdown = shutdown_rx.clone();
                        tasks.spawn(async move {
                            process_delivery(
                                delivery,
                                job_service,
                                usage_service,
                                lease,
                                renew_every,
                                &mut task_shutdown,
                            ).await;
                        });
                    }
                    Ok(None) => break,
                    Err(error) => {
                        tracing::error!(%error, "ai-session-worker consumer failed");
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
        tracing::warn!(?grace, "ai-session-worker shutdown grace elapsed");
    }
    let _ = queue.close().await;
    health_task.abort();
    Ok(())
}

async fn process_delivery(
    delivery: Box<dyn JobDelivery>,
    job_service: Arc<JobService>,
    usage_service: Arc<AiUsageService>,
    lease: Duration,
    renew_every: Duration,
    shutdown: &mut watch::Receiver<bool>,
) {
    let job = delivery.job().clone();
    let owner = Uuid::now_v7();
    let claimed = match job_service.claim(&job, owner, lease).await {
        Ok(ClaimOutcome::Claimed(job)) => job,
        Ok(
            ClaimOutcome::AlreadyRunning
            | ClaimOutcome::Terminal(_)
            | ClaimOutcome::StaleAttempt
            | ClaimOutcome::Rejected,
        ) => {
            let _ = delivery.ack().await;
            return;
        }
        Err(error) => {
            tracing::warn!(%error, job_id = %job.job_id, "could not claim AI session job");
            if let Err(retry_error) = delivery.retry().await {
                tracing::warn!(
                    error = %retry_error,
                    job_id = %job.job_id,
                    "could not reschedule AI session job after claim failure"
                );
            }
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
    let started = std::time::Instant::now();
    let result = match claimed.user_id {
        Some(user_id) => run_session_reconcile(&usage_service, user_id, claimed.params).await,
        None => Err(anyhow::anyhow!("invalid AI session job scope")),
    };
    global_kafka_metrics().observe_session_reconcile(
        started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
        result.is_ok(),
    );
    renew_task.abort();

    match result {
        Ok(result) => match job_service
            .complete(claimed.id, claimed.attempt, owner, result)
            .await
        {
            Ok(
                TransitionOutcome::Applied
                | TransitionOutcome::AlreadyApplied
                | TransitionOutcome::LostLease,
            ) => {
                let _ = delivery.ack().await;
            }
            Err(error) => {
                tracing::warn!(%error, job_id = %claimed.id, "could not complete AI session job")
            }
        },
        Err(error) => {
            let code = if error.to_string().contains("invalid AI session job") {
                "invalid_params"
            } else {
                "processor_error"
            };
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
                Ok(
                    TransitionOutcome::Applied
                    | TransitionOutcome::AlreadyApplied
                    | TransitionOutcome::LostLease,
                ) => {
                    let _ = delivery.ack().await;
                }
                Err(transition_error) => tracing::warn!(
                    error = %transition_error,
                    job_id = %claimed.id,
                    "could not persist AI session job failure"
                ),
            }
        }
    }
    let _ = shutdown.has_changed();
}

async fn run_session_reconcile(
    service: &AiUsageService,
    user_id: Uuid,
    params: Value,
) -> Result<Value> {
    let params: SessionParams = serde_json::from_value(params)
        .map_err(|_| anyhow::anyhow!("invalid AI session job parameters"))?;
    if params.schema_version != 1
        || params.ai_session_id.trim().is_empty()
        || params.ai_session_id.len() > MAX_USAGE_IDENTIFIER_BYTES
    {
        return Err(anyhow::anyhow!("invalid AI session job parameters"));
    }
    let touched = service
        .reconcile_session(user_id, &params.ai_session_id)
        .await?;
    Ok(serde_json::json!({ "sessions_touched": touched }))
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
                Ok(false) => return,
                Err(error) => tracing::warn!(%error, %job_id, "AI session lease renewal failed"),
            }
        }
    })
}

async fn serve_health(state: HealthState) -> Result<()> {
    let host =
        std::env::var("AI_SESSION_WORKER_HEALTH_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = parse_u16_env("AI_SESSION_WORKER_HEALTH_PORT", 8085);
    let address: SocketAddr = format!("{host}:{port}").parse()?;
    let router = Router::new()
        .route("/live", get(|| async { StatusCode::OK }))
        .route(
            "/metrics",
            get(|| async {
                (
                    [(
                        axum::http::header::CONTENT_TYPE,
                        axum::http::HeaderValue::from_static(
                            "text/plain; version=0.0.4; charset=utf-8",
                        ),
                    )],
                    global_kafka_metrics().render_prometheus("ai-session-worker"),
                )
            }),
        )
        .route("/ready", get(move || ready_response(state.clone())))
        .with_state(());
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("AI session worker health server failed")
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

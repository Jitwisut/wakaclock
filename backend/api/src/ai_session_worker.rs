//! Dedicated `ai.session.reconcile` RabbitMQ worker (K5.4).
//!
//! Only the processor-specific validation and domain call live here. The shared worker
//! runtime owns claim fencing, leases, retry/DLQ, acknowledgements and readiness.

use anyhow::{Context, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

use wakaclock_core::ai::MAX_USAGE_IDENTIFIER_BYTES;
use wakaclock_server::infrastructure::app::create_app_state;
use wakaclock_server::infrastructure::contracts::JobKind;
use wakaclock_server::infrastructure::metrics::global_kafka_metrics;
use wakaclock_server::services::ai_usage::AiUsageService;
use wakaclock_server::services::background_worker::{
    run_worker, JobProcessor, LeaseGuard, WorkerRuntimeConfig,
};
use wakaclock_server::services::jobs::ClaimedJob;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SessionParams {
    schema_version: u16,
    ai_session_id: String,
}

struct AiSessionProcessor {
    service: Arc<AiUsageService>,
}

#[async_trait]
impl JobProcessor for AiSessionProcessor {
    fn kind(&self) -> JobKind {
        JobKind::AiSessionReconcile
    }

    async fn process(&self, job: &ClaimedJob, lease: LeaseGuard) -> Result<Value> {
        lease.ensure_active()?;
        let user_id = job.user_id.context("invalid AI session job scope")?;
        let started = std::time::Instant::now();
        let result = run_session_reconcile(&self.service, user_id, job.params.clone()).await;
        global_kafka_metrics().observe_session_reconcile(
            started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
            result.is_ok(),
        );
        if result.is_ok() {
            lease.ensure_active()?;
        }
        result
    }

    fn error_code(&self, error: &anyhow::Error) -> &'static str {
        if error.to_string().contains("invalid AI session job") {
            "invalid_params"
        } else {
            "processor_error"
        }
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
    postgres
        .migrate()
        .await
        .context("migrate PostgreSQL before starting ai-session-worker")?;
    state
        .ai_usage_repo
        .migrate()
        .await
        .context("migrate ClickHouse before starting ai-session-worker")?;

    let processor: Arc<dyn JobProcessor> = Arc::new(AiSessionProcessor {
        service: state.ai_usage_service.clone(),
    });
    run_worker(
        state,
        WorkerRuntimeConfig {
            worker_name: "ai-session-worker",
            kind: JobKind::AiSessionReconcile,
            start_outbox_relay: false,
            prefetch_env: "ATOAXIS_AI_SESSION_WORKER_PREFETCH",
            default_prefetch: 10,
            health_host_env: "AI_SESSION_WORKER_HEALTH_HOST",
            health_port_env: "AI_SESSION_WORKER_HEALTH_PORT",
            default_health_port: 8085,
            metrics_service: "ai-session-worker",
        },
        processor,
    )
    .await
}

async fn run_session_reconcile(
    service: &AiUsageService,
    user_id: uuid::Uuid,
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

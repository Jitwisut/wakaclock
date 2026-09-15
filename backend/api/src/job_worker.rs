//! Dedicated `analytics.reprocess` RabbitMQ worker.
//!
//! The claim, lease, retry and readiness lifecycle lives in
//! [`services::background_worker`]. This module only validates the job payload and
//! invokes the reprocess domain service.

use anyhow::{Context, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

use wakaclock_server::infrastructure::app::create_app_state;
use wakaclock_server::infrastructure::contracts::JobKind;
use wakaclock_server::services::background_worker::{
    run_worker, JobProcessor, LeaseGuard, WorkerRuntimeConfig,
};
use wakaclock_server::services::jobs::ClaimedJob;
use wakaclock_server::services::reprocess::ReprocessService;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ReprocessParams {
    start: String,
    end: String,
    dry_run: bool,
}

struct ReprocessProcessor {
    service: Arc<ReprocessService>,
}

#[async_trait]
impl JobProcessor for ReprocessProcessor {
    fn kind(&self) -> JobKind {
        JobKind::AnalyticsReprocess
    }

    async fn process(&self, job: &ClaimedJob, lease: LeaseGuard) -> Result<Value> {
        lease.ensure_active()?;
        let user_id = job.user_id.context("invalid reprocess job scope")?;
        let params: ReprocessParams = serde_json::from_value(job.params.clone())
            .map_err(|_| anyhow::anyhow!("invalid reprocess job parameters"))?;
        let data = self
            .service
            .run(user_id, &params.start, &params.end, params.dry_run)
            .await?;
        lease.ensure_active()?;
        Ok(serde_json::to_value(data)?)
    }

    fn error_code(&self, error: &anyhow::Error) -> &'static str {
        if error.to_string().contains("invalid reprocess job") {
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
            .context("initialize job-worker application state")?,
    );
    let postgres = state
        .postgres
        .clone()
        .context("job-worker requires POSTGRES_URL")?;
    postgres
        .migrate()
        .await
        .context("migrate PostgreSQL before starting job-worker")?;
    state
        .reprocess_service
        .migrate()
        .await
        .context("migrate ClickHouse before starting job-worker")?;

    let processor: Arc<dyn JobProcessor> = Arc::new(ReprocessProcessor {
        service: state.reprocess_service.clone(),
    });
    run_worker(
        state,
        WorkerRuntimeConfig {
            worker_name: "job-worker",
            kind: JobKind::AnalyticsReprocess,
            start_outbox_relay: true,
            prefetch_env: "ATOAXIS_JOB_WORKER_PREFETCH",
            default_prefetch: 4,
            health_host_env: "ATOAXIS_JOB_WORKER_HEALTH_HOST",
            health_port_env: "ATOAXIS_JOB_WORKER_HEALTH_PORT",
            default_health_port: 8081,
            metrics_service: "job-worker",
        },
        processor,
    )
    .await
}

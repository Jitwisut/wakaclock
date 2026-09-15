//! Dedicated `export.generate` RabbitMQ worker.
//!
//! The export service owns privacy-safe data selection, artifact checksums and
//! cancellation fencing. The shared runtime owns delivery acknowledgement,
//! leases, retries, dead-lettering and readiness.

use anyhow::{Context, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;

use wakaclock_server::infrastructure::app::create_app_state;
use wakaclock_server::infrastructure::contracts::JobKind;
use wakaclock_server::services::background_worker::{
    run_worker, JobProcessor, LeaseGuard, WorkerRuntimeConfig,
};
use wakaclock_server::services::exports::ExportService;
use wakaclock_server::services::jobs::ClaimedJob;

struct ExportProcessor {
    service: Arc<ExportService>,
}

#[async_trait]
impl JobProcessor for ExportProcessor {
    fn kind(&self) -> JobKind {
        JobKind::ExportGenerate
    }

    async fn process(&self, job: &ClaimedJob, lease: LeaseGuard) -> Result<Value> {
        self.service.process(job, lease).await
    }

    fn error_code(&self, error: &anyhow::Error) -> &'static str {
        if error.to_string().contains("invalid export job") {
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
            .context("initialize export-worker application state")?,
    );
    let postgres = state
        .postgres
        .clone()
        .context("export-worker requires POSTGRES_URL")?;
    if !state.export_service.processor_ready() {
        anyhow::bail!(
            "export-worker requires PostgreSQL and a configured S3 object store; refusing readiness"
        );
    }
    postgres
        .migrate()
        .await
        .context("migrate PostgreSQL before starting export-worker")?;
    state
        .heartbeat_repo
        .migrate()
        .await
        .context("migrate ClickHouse heartbeat tables before starting export-worker")?;
    state
        .analytics_repo
        .migrate()
        .await
        .context("migrate ClickHouse analytics tables before starting export-worker")?;
    state
        .ai_usage_repo
        .migrate()
        .await
        .context("migrate ClickHouse AI usage tables before starting export-worker")?;
    state
        .external_duration_repo
        .migrate()
        .await
        .context("migrate ClickHouse external-duration tables before starting export-worker")?;

    let processor: Arc<dyn JobProcessor> = Arc::new(ExportProcessor {
        service: state.export_service.clone(),
    });
    run_worker(
        state,
        WorkerRuntimeConfig {
            worker_name: "export-worker",
            kind: JobKind::ExportGenerate,
            start_outbox_relay: false,
            prefetch_env: "ATOAXIS_EXPORT_WORKER_PREFETCH",
            default_prefetch: 1,
            health_host_env: "EXPORT_WORKER_HEALTH_HOST",
            health_port_env: "EXPORT_WORKER_HEALTH_PORT",
            default_health_port: 8082,
            metrics_service: "export-worker",
        },
        processor,
    )
    .await
}

#[tokio::main]
async fn main() -> Result<()> {
    run().await
}

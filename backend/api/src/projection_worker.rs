//! Dedicated `projection.rebuild` RabbitMQ worker.
//!
//! The worker rebuilds one account/range snapshot through the same service used by
//! the synchronous compatibility endpoint. It never accepts an account id from job
//! parameters: the tenant is the authenticated owner stored in `async_jobs.user_id`.

use anyhow::{Context, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

use wakaclock_server::infrastructure::app::create_app_state;
use wakaclock_server::infrastructure::contracts::JobKind;
use wakaclock_server::services::account_analytics::AccountAnalyticsService;
use wakaclock_server::services::background_worker::{
    run_worker, JobProcessor, LeaseGuard, WorkerRuntimeConfig,
};
use wakaclock_server::services::jobs::ClaimedJob;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ProjectionParams {
    schema_version: u16,
    start: String,
    end: String,
}

struct ProjectionProcessor {
    service: Arc<AccountAnalyticsService>,
}

#[async_trait]
impl JobProcessor for ProjectionProcessor {
    fn kind(&self) -> JobKind {
        JobKind::ProjectionRebuild
    }

    async fn process(&self, job: &ClaimedJob, lease: LeaseGuard) -> Result<Value> {
        lease.ensure_active()?;
        let user_id = job
            .user_id
            .context("invalid projection rebuild job scope")?;
        let params: ProjectionParams = serde_json::from_value(job.params.clone())
            .map_err(|_| anyhow::anyhow!("invalid projection rebuild job parameters"))?;
        if params.schema_version != 1 {
            return Err(anyhow::anyhow!("invalid projection rebuild job parameters"));
        }
        AccountAnalyticsService::validate_request(&params.start, &params.end)
            .map_err(|_| anyhow::anyhow!("invalid projection rebuild job parameters"))?;
        let data = self
            .service
            .rebuild(user_id, &params.start, &params.end)
            .await?;
        lease.ensure_active()?;
        Ok(serde_json::to_value(data)?)
    }

    fn error_code(&self, error: &anyhow::Error) -> &'static str {
        if error.to_string().contains("invalid projection rebuild job") {
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
            .context("initialize projection-worker application state")?,
    );
    let postgres = state
        .postgres
        .clone()
        .context("projection-worker requires POSTGRES_URL")?;
    postgres
        .migrate()
        .await
        .context("migrate PostgreSQL before starting projection-worker")?;
    state
        .account_analytics_repo
        .migrate()
        .await
        .context("migrate ClickHouse before starting projection-worker")?;

    let processor: Arc<dyn JobProcessor> = Arc::new(ProjectionProcessor {
        service: state.account_analytics_service.clone(),
    });
    run_worker(
        state,
        WorkerRuntimeConfig {
            worker_name: "projection-worker",
            kind: JobKind::ProjectionRebuild,
            start_outbox_relay: false,
            prefetch_env: "ATOAXIS_PROJECTION_WORKER_PREFETCH",
            default_prefetch: 2,
            health_host_env: "PROJECTION_WORKER_HEALTH_HOST",
            health_port_env: "PROJECTION_WORKER_HEALTH_PORT",
            default_health_port: 8086,
            metrics_service: "projection-worker",
        },
        processor,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn projection_params_reject_unknown_fields() {
        let error = serde_json::from_value::<ProjectionParams>(serde_json::json!({
            "schema_version": 1,
            "start": "2026-01-01",
            "end": "2026-01-02",
            "user_id": "must-come-from-job-scope"
        }));
        assert!(error.is_err());
    }
}

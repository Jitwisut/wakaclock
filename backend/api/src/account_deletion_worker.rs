//! Dedicated `account.delete` RabbitMQ worker.
//!
//! The processor is intentionally separate from the generic job worker: account
//! deletion has cross-store side effects and must not be accidentally registered
//! under a different job kind or acknowledged before verification completes.

use anyhow::{Context, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;

use wakaclock_server::infrastructure::app::create_app_state;
use wakaclock_server::infrastructure::contracts::JobKind;
use wakaclock_server::services::account_deletion::AccountDeletionService;
use wakaclock_server::services::background_worker::{
    run_worker, JobProcessor, LeaseGuard, WorkerRuntimeConfig,
};
use wakaclock_server::services::jobs::ClaimedJob;

struct AccountDeletionProcessor {
    service: Arc<AccountDeletionService>,
}

#[async_trait]
impl JobProcessor for AccountDeletionProcessor {
    fn kind(&self) -> JobKind {
        JobKind::AccountDelete
    }

    async fn process(&self, job: &ClaimedJob, lease: LeaseGuard) -> Result<Value> {
        self.service.process(job, lease).await
    }

    fn error_code(&self, error: &anyhow::Error) -> &'static str {
        if error.to_string().contains("invalid account deletion job") {
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
            .context("initialize account-deletion worker application state")?,
    );
    let postgres = state
        .postgres
        .clone()
        .context("account-deletion worker requires POSTGRES_URL")?;
    if !state.account_deletion_service.processor_ready() {
        anyhow::bail!(
            "account-deletion worker requires PostgreSQL and a configured S3 object store; refusing readiness"
        );
    }
    postgres
        .migrate()
        .await
        .context("migrate PostgreSQL before starting account-deletion worker")?;

    // The deletion worker's allowlist is fail-closed when it encounters a new
    // ClickHouse user table, but the known tables still need to exist on a fresh
    // installation before the first destructive job runs.
    state.heartbeat_repo.migrate().await?;
    state.analytics_repo.migrate().await?;
    state.account_analytics_repo.migrate().await?;
    state.ai_usage_repo.migrate().await?;
    state.external_duration_repo.migrate().await?;
    state.follow_up_repo.migrate().await?;
    state.project_identity_repo.migrate().await?;
    state.project_merge_repo.migrate().await?;
    state.project_rule_repo.migrate().await?;
    state.org_repo.migrate().await?;
    state.team_repo.migrate().await?;
    state.coworking_session_repo.migrate().await?;
    state.reprocess_service.migrate().await?;

    let processor: Arc<dyn JobProcessor> = Arc::new(AccountDeletionProcessor {
        service: state.account_deletion_service.clone(),
    });
    run_worker(
        state,
        WorkerRuntimeConfig {
            worker_name: "account-deletion-worker",
            kind: JobKind::AccountDelete,
            start_outbox_relay: false,
            prefetch_env: "ATOAXIS_ACCOUNT_DELETION_WORKER_PREFETCH",
            default_prefetch: 1,
            health_host_env: "ACCOUNT_DELETION_WORKER_HEALTH_HOST",
            health_port_env: "ACCOUNT_DELETION_WORKER_HEALTH_PORT",
            default_health_port: 8087,
            metrics_service: "account-deletion-worker",
        },
        processor,
    )
    .await
}

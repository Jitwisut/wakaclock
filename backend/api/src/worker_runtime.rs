//! Small, provider-neutral worker process entrypoint.
//!
//! The binaries are intentionally thin: queue/database adapters are injected
//! by the deployment layer, while this runtime standardises lifecycle,
//! shutdown and trace metadata for every worker process.

use anyhow::Result;
use tracing::info;

pub async fn run(worker_name: &str) -> Result<()> {
    // Keep the URL out of logs: an AMQP URL commonly contains the broker
    // username and password. The deployment adapter owns the actual connection.
    let queue_configured = std::env::var("ATOAXIS_JOB_QUEUE_URL").is_ok();
    let oneshot = std::env::var("ATOAXIS_WORKER_ONESHOT").is_ok();
    info!(worker = worker_name, queue_configured, "worker starting");

    if oneshot {
        info!(worker = worker_name, "worker readiness check complete");
        return Ok(());
    }

    tokio::signal::ctrl_c().await?;
    info!(worker = worker_name, "worker shutdown requested");
    Ok(())
}

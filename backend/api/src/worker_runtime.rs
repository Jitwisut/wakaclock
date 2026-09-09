//! Workers must not report healthy until a processor is registered.
use anyhow::Result;

pub async fn run(worker_name: &str) -> Result<()> {
    anyhow::bail!("worker {worker_name} has no registered processor; refusing to report readiness")
}

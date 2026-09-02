#[path = "../worker_runtime.rs"]
mod worker_runtime;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    worker_runtime::run("integration-sync").await
}

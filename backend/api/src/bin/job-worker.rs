#[path = "../job_worker.rs"]
mod job_worker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    job_worker::run().await
}

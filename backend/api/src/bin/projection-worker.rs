#[path = "../projection_worker.rs"]
mod projection_worker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    projection_worker::run().await
}

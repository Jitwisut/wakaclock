#[path = "../account_deletion_worker.rs"]
mod account_deletion_worker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    account_deletion_worker::run().await
}

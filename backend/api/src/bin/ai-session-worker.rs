#[path = "../ai_session_worker.rs"]
mod ai_session_worker;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    ai_session_worker::run().await
}

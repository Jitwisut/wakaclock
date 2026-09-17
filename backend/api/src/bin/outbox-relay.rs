//! The outbox relay is owned by the dedicated `job-worker` process.  This legacy
//! entrypoint stays so an old deploy command fails loudly instead of silently
//! starting a process that does nothing.

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    anyhow::bail!(
        "the outbox relay runs inside the job-worker binary; start `job-worker` with \
         ATOAXIS_JOB_QUEUE_URL and POSTGRES_URL instead. See \
         plans/plan-kafka-rabbitmq-adoption.md (R3)."
    )
}

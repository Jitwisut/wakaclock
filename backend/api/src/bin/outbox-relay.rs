//! The outbox relay is not a separate process. It runs inside `wakaclock-server`
//! (plans/plan-kafka-rabbitmq-adoption.md, R2), because the crate has no library
//! target this binary could share the services with.
//!
//! This entrypoint stays only so a deploy script that still references it fails
//! loudly instead of silently starting a process that does nothing.

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    anyhow::bail!(
        "the outbox relay runs inside wakaclock-server when ATOAXIS_JOB_QUEUE_URL and \
         POSTGRES_URL are set; there is no separate relay process. See \
         plans/plan-kafka-rabbitmq-adoption.md (R2)."
    )
}

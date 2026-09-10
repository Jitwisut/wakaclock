//! In-process outbox relay (plans/plan-kafka-rabbitmq-adoption.md, R2).
//!
//! `wakaclock-server` has no library target, so `src/bin/outbox-relay.rs` cannot reach
//! the services. Until a lib target exists the relay runs as a task inside the API
//! process, started from `main.rs` only when both `ATOAXIS_JOB_QUEUE_URL` and
//! `POSTGRES_URL` are set. Every replica runs one; `FOR UPDATE SKIP LOCKED` in
//! [`JobService::relay_once`] keeps two of them from publishing the same row.
//!
//! This module owns the RabbitMQ connection lifecycle — the adapter itself
//! deliberately does not reconnect. A broker error ends the inner loop, the
//! connection is dropped, and the outer loop redials after a fixed backoff.

use std::sync::Arc;
use std::time::Duration;

use crate::config::brokers::JobQueueConfig;
use crate::infrastructure::rabbitmq::RabbitMqJobQueue;
use crate::services::jobs::JobService;

const POLL_INTERVAL: Duration = Duration::from_millis(500);
const RECONNECT_BACKOFF: Duration = Duration::from_secs(5);
const RELAY_BATCH: i64 = 64;
const SWEEP_BATCH: i64 = 64;

/// Spawns the relay task. Returns immediately; the task runs for the process lifetime.
pub fn spawn(job_service: Arc<JobService>, config: JobQueueConfig) {
    tokio::spawn(async move {
        loop {
            match RabbitMqJobQueue::connect(&config).await {
                Ok(queue) => {
                    tracing::info!("outbox relay connected to RabbitMQ");
                    run_until_broker_error(&job_service, &queue).await;
                    let _ = queue.close().await;
                    tracing::warn!("outbox relay lost its RabbitMQ connection; will redial");
                }
                Err(error) => {
                    tracing::warn!(%error, "outbox relay cannot reach RabbitMQ");
                }
            }
            tokio::time::sleep(RECONNECT_BACKOFF).await;
        }
    });
}

async fn run_until_broker_error(job_service: &JobService, queue: &RabbitMqJobQueue) {
    let mut ticker = tokio::time::interval(POLL_INTERVAL);
    loop {
        ticker.tick().await;

        match job_service.relay_once(queue, RELAY_BATCH).await {
            Ok(outcome) => {
                if outcome.published > 0 {
                    tracing::debug!(published = outcome.published, "relayed async jobs");
                }
                if outcome.poison > 0 {
                    tracing::warn!(
                        poison = outcome.poison,
                        "async_job outbox rows failed to decode"
                    );
                }
                if let Some(error) = outcome.broker_error {
                    tracing::warn!(%error, "relay publish failed; reconnecting");
                    return;
                }
            }
            Err(error) => {
                // A PostgreSQL-side failure — keep the broker connection and retry.
                tracing::warn!(%error, "relay could not read the outbox");
            }
        }

        match job_service.sweep_once(SWEEP_BATCH).await {
            Ok(outcome) if outcome.requeued > 0 || outcome.dead_lettered > 0 => {
                tracing::info!(
                    requeued = outcome.requeued,
                    dead_lettered = outcome.dead_lettered,
                    "swept expired job leases"
                );
            }
            Ok(_) => {}
            Err(error) => tracing::warn!(%error, "job lease sweep failed"),
        }
    }
}

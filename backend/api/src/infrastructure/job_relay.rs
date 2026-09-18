//! Dedicated-process outbox relay (plans/plan-kafka-rabbitmq-adoption.md, R2/R3).
//!
//! The `job-worker` binary starts this task alongside its processors. The API does not
//! publish jobs itself; PostgreSQL remains the source of truth and `FOR UPDATE SKIP
//! LOCKED` in [`JobService::relay_once`] keeps multiple worker replicas from publishing
//! the same row.
//!
//! This module owns the RabbitMQ connection lifecycle — the adapter itself
//! deliberately does not reconnect. A broker error ends the inner loop, the
//! connection is dropped, and the outer loop redials after a fixed backoff.

use std::sync::Arc;
use std::time::Duration;

use crate::config::brokers::JobQueueConfig;
use crate::infrastructure::metrics::global_job_metrics;
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
                let metrics = global_job_metrics();
                metrics.outbox_published_total.fetch_add(
                    outcome.published as u64,
                    std::sync::atomic::Ordering::Relaxed,
                );
                metrics
                    .outbox_poison_total
                    .fetch_add(outcome.poison as u64, std::sync::atomic::Ordering::Relaxed);
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
                    metrics
                        .outbox_publish_failures_total
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    tracing::warn!(%error, "relay publish failed; reconnecting");
                    if let Err(age_error) = update_outbox_age(job_service).await {
                        tracing::warn!(%age_error, "could not update async-job outbox age metric");
                    }
                    return;
                }
            }
            Err(error) => {
                // A PostgreSQL-side failure — keep the broker connection and retry.
                tracing::warn!(%error, "relay could not read the outbox");
            }
        }

        if let Err(error) = update_outbox_age(job_service).await {
            tracing::warn!(%error, "could not update async-job outbox age metric");
        }

        match job_service.sweep_once(SWEEP_BATCH).await {
            Ok(outcome) if outcome.requeued > 0 || outcome.dead_lettered > 0 => {
                let metrics = global_job_metrics();
                metrics.lease_sweep_requeued_total.fetch_add(
                    outcome.requeued as u64,
                    std::sync::atomic::Ordering::Relaxed,
                );
                metrics.lease_sweep_dead_lettered_total.fetch_add(
                    outcome.dead_lettered as u64,
                    std::sync::atomic::Ordering::Relaxed,
                );
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

async fn update_outbox_age(job_service: &JobService) -> anyhow::Result<()> {
    let age = job_service.oldest_outbox_age_seconds().await?;
    global_job_metrics()
        .oldest_outbox_age_seconds
        .store(age, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

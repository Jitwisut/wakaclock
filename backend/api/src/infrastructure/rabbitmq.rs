//! RabbitMQ adapter for the job contracts in [`super::contracts`] (plan R1).
//!
//! Topology, declared idempotently on every connect:
//!
//! ```text
//! wakaclock.jobs (topic) ──routing key = JobKind──► wakaclock.jobs.<routing key>   (quorum)
//!        ▲                                               │ delivery limit exceeded
//!        │ TTL expiry keeps the routing key              ▼
//! wakaclock.jobs.retry.<n>s (fanout) ──► queue with x-message-ttl        wakaclock.jobs.dlx (topic)
//!                                                                              │ '#'
//!                                                                              ▼
//!                                                                     wakaclock.jobs.dlq (quorum)
//! ```
//!
//! A retry is a fresh publish of the job with `attempt + 1` into the fanout exchange for
//! that attempt's delay. Fanout ignores the routing key on the way in, the TTL queue keeps
//! it, and expiry dead-letters the message back onto `wakaclock.jobs` under its original
//! routing key. Doing it this way needs no broker plugin, which managed providers do not
//! all offer.
//!
//! What this module deliberately does **not** do is reconnect. A dropped connection
//! surfaces as [`InfrastructureError::Unavailable`] from every call, and the owner — the
//! worker runtime (R3) or the outbox relay (R2) — reconnects, because only it knows what
//! must be re-read from PostgreSQL first. Job state is authoritative in PostgreSQL (plan
//! D5): a message lost in a broker failure is recovered by the R2 sweeper, not here.

use async_trait::async_trait;
use futures::StreamExt;
use lapin::options::{
    BasicAckOptions, BasicConsumeOptions, BasicPublishOptions, BasicQosOptions, BasicRejectOptions,
    ConfirmSelectOptions, ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
};
use lapin::types::{AMQPValue, FieldTable, LongString, ShortString};
use lapin::{
    BasicProperties, Channel, Confirmation, Connection, ConnectionProperties, ExchangeKind,
};
use std::time::Duration;
use tokio::sync::Mutex;

use super::contracts::{
    InfrastructureError, InfrastructureResult, JobConsumer, JobDelivery, JobEnvelope, JobKind,
    JobPublishTarget, JobPublisher, RetryOutcome, JOB_DEAD_LETTER_EXCHANGE, JOB_EXCHANGE,
    JOB_RETRY_DELAYS,
};
use crate::config::brokers::JobQueueConfig;

/// Header carrying the sanitized failure category on a dead-lettered job.
pub const FAILURE_CATEGORY_HEADER: &str = "x-atoaxis-failure";

/// Redeliveries of one message before the broker dead-letters it by itself. This only
/// counts deliveries that were never settled — a worker crashing mid-job, again and again.
/// Ordinary failures go through [`JobDelivery::retry`], which publishes a new message and
/// so does not spend this budget.
pub const JOB_DELIVERY_LIMIT: i64 = 5;

const PERSISTENT: u8 = 2;

/// Every exchange and queue name, optionally namespaced. Production uses no prefix; the
/// integration tests use a per-test prefix so runs sharing one broker cannot see each
/// other's messages, including leftovers from a failed earlier run.
#[derive(Debug, Clone)]
pub struct JobTopology {
    prefix: String,
}

impl JobTopology {
    pub fn production() -> Self {
        Self {
            prefix: String::new(),
        }
    }

    /// A namespaced topology for tests that share one broker. `prefix` should end with
    /// a separator, e.g. `"jobs-e2e-<uuid>."`.
    pub fn namespaced(prefix: impl Into<String>) -> Self {
        Self {
            prefix: prefix.into(),
        }
    }

    fn name(&self, base: &str) -> String {
        format!("{}{base}", self.prefix)
    }

    pub fn exchange(&self) -> String {
        self.name(JOB_EXCHANGE)
    }

    pub fn dead_letter_exchange(&self) -> String {
        self.name(JOB_DEAD_LETTER_EXCHANGE)
    }

    pub fn dead_letter_queue(&self) -> String {
        self.name("wakaclock.jobs.dlq")
    }

    pub fn job_queue(&self, kind: JobKind) -> String {
        self.name(&format!("wakaclock.jobs.{}", kind.routing_key()))
    }

    /// One fanout exchange and one queue of the same name per retry delay.
    pub fn retry_exchange(&self, delay: Duration) -> String {
        self.name(&format!("wakaclock.jobs.retry.{}s", delay.as_secs()))
    }

    fn job_queue_arguments(&self) -> FieldTable {
        let mut arguments = quorum();
        arguments.insert(
            "x-dead-letter-exchange".into(),
            long_string(&self.dead_letter_exchange()),
        );
        arguments.insert(
            "x-delivery-limit".into(),
            AMQPValue::LongLongInt(JOB_DELIVERY_LIMIT),
        );
        arguments
    }

    /// At-least-once dead-lettering (which quorum queues require `reject-publish` for)
    /// keeps a job from being dropped on its way back out of the delay queue.
    fn retry_queue_arguments(&self, delay: Duration) -> FieldTable {
        let mut arguments = quorum();
        arguments.insert(
            "x-message-ttl".into(),
            AMQPValue::LongLongInt(i64::try_from(delay.as_millis()).unwrap_or(i64::MAX)),
        );
        arguments.insert(
            "x-dead-letter-exchange".into(),
            long_string(&self.exchange()),
        );
        arguments.insert(
            "x-dead-letter-strategy".into(),
            long_string("at-least-once"),
        );
        arguments.insert("x-overflow".into(), long_string("reject-publish"));
        arguments
    }
}

fn quorum() -> FieldTable {
    let mut arguments = FieldTable::default();
    arguments.insert("x-queue-type".into(), long_string("quorum"));
    arguments
}

fn long_string(value: &str) -> AMQPValue {
    AMQPValue::LongString(LongString::from(value))
}

fn unavailable(context: &str, error: lapin::Error) -> InfrastructureError {
    InfrastructureError::Unavailable(format!("RabbitMQ {context}: {error}"))
}

/// Connection plus a confirm-mode channel for publishing.
pub struct RabbitMqJobQueue {
    connection: Connection,
    publish_channel: Channel,
    topology: JobTopology,
}

impl RabbitMqJobQueue {
    /// Connects with the production topology. The in-process relay (R2) calls this;
    /// tests use [`Self::connect_with`] and a namespaced topology.
    pub async fn connect(config: &JobQueueConfig) -> InfrastructureResult<Self> {
        Self::connect_with(config.url(), JobTopology::production()).await
    }

    pub async fn connect_with(url: &str, topology: JobTopology) -> InfrastructureResult<Self> {
        // lapin errors describe the failure, not the URI, so the password in the URL's
        // userinfo does not reach this message.
        let connection = Connection::connect(url, ConnectionProperties::default())
            .await
            .map_err(|error| unavailable("connect", error))?;
        let publish_channel = connection
            .create_channel()
            .await
            .map_err(|error| unavailable("create channel", error))?;
        declare_topology(&publish_channel, &topology).await?;
        publish_channel
            .confirm_select(ConfirmSelectOptions::default())
            .await
            .map_err(|error| unavailable("enable publisher confirms", error))?;
        Ok(Self {
            connection,
            publish_channel,
            topology,
        })
    }

    /// Consumes the queue for `kind` with at most `prefetch` unsettled jobs in flight.
    pub async fn consumer(
        &self,
        kind: JobKind,
        prefetch: u16,
        consumer_tag: &str,
    ) -> InfrastructureResult<RabbitMqJobConsumer> {
        let channel = self
            .connection
            .create_channel()
            .await
            .map_err(|error| unavailable("create channel", error))?;
        channel
            .basic_qos(prefetch.max(1), BasicQosOptions::default())
            .await
            .map_err(|error| unavailable("set prefetch", error))?;
        let consumer = channel
            .basic_consume(
                self.topology.job_queue(kind).into(),
                consumer_tag.into(),
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await
            .map_err(|error| unavailable("consume", error))?;
        Ok(RabbitMqJobConsumer {
            kind,
            topology: self.topology.clone(),
            _channel: channel,
            publish_channel: self.publish_channel.clone(),
            consumer: Mutex::new(consumer),
        })
    }

    pub async fn close(&self) -> InfrastructureResult<()> {
        self.connection
            .close(200, "shutdown".into())
            .await
            .map_err(|error| unavailable("close", error))
    }
}

#[async_trait]
impl JobPublisher for RabbitMqJobQueue {
    async fn publish(&self, job: &JobEnvelope) -> InfrastructureResult<()> {
        job.validate()?;
        publish_confirmed(
            &self.publish_channel,
            &self.topology.exchange(),
            job.kind.routing_key(),
            &serde_json::to_vec(job)?,
            job_properties(job),
        )
        .await
    }

    async fn publish_to(
        &self,
        job: &JobEnvelope,
        target: &JobPublishTarget,
    ) -> InfrastructureResult<()> {
        job.validate()?;
        let body = serde_json::to_vec(job)?;
        match target {
            JobPublishTarget::Primary => self.publish(job).await,
            JobPublishTarget::Retry(delay) => {
                if !JOB_RETRY_DELAYS.contains(delay) {
                    return Err(InfrastructureError::InvalidEnvelope(
                        "retry delay is not in JOB_RETRY_DELAYS".to_string(),
                    ));
                }
                publish_confirmed(
                    &self.publish_channel,
                    &self.topology.retry_exchange(*delay),
                    job.kind.routing_key(),
                    &body,
                    job_properties(job),
                )
                .await
            }
            JobPublishTarget::DeadLetter(category) => {
                if category.is_empty()
                    || category.len() > 64
                    || !category.bytes().all(|byte| {
                        byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_'
                    })
                {
                    return Err(InfrastructureError::InvalidEnvelope(
                        "dead-letter category must be a sanitized fixed identifier".to_string(),
                    ));
                }
                publish_dead_letter(
                    &self.publish_channel,
                    &self.topology,
                    job.kind.routing_key(),
                    &body,
                    job_properties(job),
                    category,
                )
                .await
            }
        }
    }
}

async fn declare_topology(channel: &Channel, topology: &JobTopology) -> InfrastructureResult<()> {
    let durable = ExchangeDeclareOptions {
        durable: true,
        ..ExchangeDeclareOptions::default()
    };
    let durable_queue = QueueDeclareOptions {
        durable: true,
        ..QueueDeclareOptions::default()
    };
    let declare_err = |error| unavailable("declare topology", error);

    channel
        .exchange_declare(
            topology.exchange().into(),
            ExchangeKind::Topic,
            durable,
            FieldTable::default(),
        )
        .await
        .map_err(declare_err)?;
    channel
        .exchange_declare(
            topology.dead_letter_exchange().into(),
            ExchangeKind::Topic,
            durable,
            FieldTable::default(),
        )
        .await
        .map_err(declare_err)?;
    channel
        .queue_declare(topology.dead_letter_queue().into(), durable_queue, quorum())
        .await
        .map_err(declare_err)?;
    channel
        .queue_bind(
            topology.dead_letter_queue().into(),
            topology.dead_letter_exchange().into(),
            "#".into(),
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await
        .map_err(declare_err)?;

    for kind in JobKind::ALL {
        channel
            .queue_declare(
                topology.job_queue(kind).into(),
                durable_queue,
                topology.job_queue_arguments(),
            )
            .await
            .map_err(declare_err)?;
        channel
            .queue_bind(
                topology.job_queue(kind).into(),
                topology.exchange().into(),
                kind.routing_key().into(),
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await
            .map_err(declare_err)?;
    }

    for delay in JOB_RETRY_DELAYS {
        let name = topology.retry_exchange(delay);
        channel
            .exchange_declare(
                name.as_str().into(),
                ExchangeKind::Fanout,
                durable,
                FieldTable::default(),
            )
            .await
            .map_err(declare_err)?;
        channel
            .queue_declare(
                name.as_str().into(),
                durable_queue,
                topology.retry_queue_arguments(delay),
            )
            .await
            .map_err(declare_err)?;
        channel
            .queue_bind(
                name.as_str().into(),
                name.as_str().into(),
                "".into(),
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await
            .map_err(declare_err)?;
    }
    Ok(())
}

fn job_properties(job: &JobEnvelope) -> BasicProperties {
    BasicProperties::default()
        .with_delivery_mode(PERSISTENT)
        .with_content_type("application/json".into())
        .with_message_id(job.job_id.to_string().into())
}

/// Publishes with `mandatory` set and waits for the broker's confirm. A message the
/// broker accepted but could route to no queue is an error, not a success: by default
/// it would be dropped silently, which for a job means work that never runs. That only
/// happens when topology is missing, which is exactly when to fail loudly.
async fn publish_confirmed(
    channel: &Channel,
    exchange: &str,
    routing_key: &str,
    body: &[u8],
    properties: BasicProperties,
) -> InfrastructureResult<()> {
    let confirmation = channel
        .basic_publish(
            ShortString::from(exchange),
            ShortString::from(routing_key),
            BasicPublishOptions {
                mandatory: true,
                ..BasicPublishOptions::default()
            },
            body,
            properties,
        )
        .await
        .map_err(|error| unavailable("publish", error))?
        .await
        .map_err(|error| unavailable("publisher confirm", error))?;
    match confirmation {
        Confirmation::Ack(None) => Ok(()),
        Confirmation::Ack(Some(_)) => Err(InfrastructureError::Unavailable(format!(
            "RabbitMQ could not route {routing_key} on {exchange}; is the topology declared?"
        ))),
        Confirmation::Nack(_) => Err(InfrastructureError::Unavailable(format!(
            "RabbitMQ refused to store {routing_key} on {exchange}"
        ))),
        Confirmation::NotRequested => Err(InfrastructureError::Unavailable(
            "publisher confirms are not enabled on this channel".to_string(),
        )),
    }
}

async fn publish_dead_letter(
    channel: &Channel,
    topology: &JobTopology,
    routing_key: &str,
    body: &[u8],
    properties: BasicProperties,
    category: &str,
) -> InfrastructureResult<()> {
    let mut headers = properties.headers().clone().unwrap_or_default();
    headers.insert(FAILURE_CATEGORY_HEADER.into(), long_string(category));
    publish_confirmed(
        channel,
        &topology.dead_letter_exchange(),
        routing_key,
        body,
        properties.with_headers(headers),
    )
    .await
}

pub struct RabbitMqJobConsumer {
    kind: JobKind,
    topology: JobTopology,
    /// Owns the consume channel; dropping it hands unsettled deliveries back to the queue.
    _channel: Channel,
    publish_channel: Channel,
    consumer: Mutex<lapin::Consumer>,
}

#[async_trait]
impl JobConsumer for RabbitMqJobConsumer {
    async fn next_delivery(&self) -> InfrastructureResult<Option<Box<dyn JobDelivery>>> {
        let mut consumer = self.consumer.lock().await;
        loop {
            let Some(next) = consumer.next().await else {
                return Ok(None);
            };
            let delivery = next.map_err(|error| unavailable("receive", error))?;
            match decode(&delivery.data, self.kind) {
                Ok(job) => {
                    return Ok(Some(Box::new(RabbitMqDelivery {
                        job,
                        delivery,
                        publish_channel: self.publish_channel.clone(),
                        topology: self.topology.clone(),
                    })));
                }
                Err(category) => {
                    // Retrying a message that cannot be decoded only repeats the failure,
                    // so it goes straight to the DLQ, with the category, and is settled.
                    tracing::warn!(
                        queue = %self.topology.job_queue(self.kind),
                        category,
                        "dead-lettering a job message that failed validation"
                    );
                    publish_dead_letter(
                        &self.publish_channel,
                        &self.topology,
                        delivery.routing_key.as_str(),
                        &delivery.data,
                        delivery.properties.clone(),
                        category,
                    )
                    .await?;
                    delivery
                        .ack(BasicAckOptions::default())
                        .await
                        .map_err(|error| unavailable("ack", error))?;
                }
            }
        }
    }
}

/// Only fixed categories leave this function; the serde error text, which can quote
/// the payload, is deliberately dropped.
fn decode(body: &[u8], expected: JobKind) -> Result<JobEnvelope, &'static str> {
    let job: JobEnvelope = serde_json::from_slice(body).map_err(|_| "undecodable_envelope")?;
    job.validate().map_err(|_| "invalid_envelope")?;
    if job.kind != expected {
        return Err("wrong_queue");
    }
    Ok(job)
}

struct RabbitMqDelivery {
    job: JobEnvelope,
    delivery: lapin::message::Delivery,
    publish_channel: Channel,
    topology: JobTopology,
}

#[async_trait]
impl JobDelivery for RabbitMqDelivery {
    fn job(&self) -> &JobEnvelope {
        &self.job
    }

    async fn ack(self: Box<Self>) -> InfrastructureResult<()> {
        self.delivery
            .ack(BasicAckOptions::default())
            .await
            .map_err(|error| unavailable("ack", error))?;
        Ok(())
    }

    async fn requeue(self: Box<Self>) -> InfrastructureResult<()> {
        self.delivery
            .reject(BasicRejectOptions { requeue: true })
            .await
            .map_err(|error| unavailable("requeue", error))?;
        Ok(())
    }

    /// Publish-then-ack: a crash between the two redelivers the original, so the job
    /// runs at least once more rather than possibly never. Workers are idempotent on
    /// `job_id` for exactly this reason.
    async fn retry(self: Box<Self>) -> InfrastructureResult<RetryOutcome> {
        let Some(delay) = self.job.next_retry_delay() else {
            JobDelivery::dead_letter(self, "retries_exhausted").await?;
            return Ok(RetryOutcome::DeadLettered);
        };
        let mut next = self.job.clone();
        next.attempt += 1;
        publish_confirmed(
            &self.publish_channel,
            &self.topology.retry_exchange(delay),
            next.kind.routing_key(),
            &serde_json::to_vec(&next)?,
            job_properties(&next),
        )
        .await?;
        self.delivery
            .ack(BasicAckOptions::default())
            .await
            .map_err(|error| unavailable("ack", error))?;
        Ok(RetryOutcome::Scheduled(delay))
    }

    async fn dead_letter(self: Box<Self>, category: &'static str) -> InfrastructureResult<()> {
        publish_dead_letter(
            &self.publish_channel,
            &self.topology,
            self.job.kind.routing_key(),
            &serde_json::to_vec(&self.job)?,
            job_properties(&self.job),
            category,
        )
        .await?;
        self.delivery
            .ack(BasicAckOptions::default())
            .await
            .map_err(|error| unavailable("ack", error))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::contracts::SYSTEM_TENANT_ID;
    use uuid::Uuid;

    fn argument<'a>(table: &'a FieldTable, key: &str) -> Option<&'a AMQPValue> {
        table.inner().get(&ShortString::from(key))
    }

    #[test]
    fn production_names_match_the_contract() {
        let topology = JobTopology::production();
        assert_eq!(topology.exchange(), JOB_EXCHANGE);
        assert_eq!(topology.dead_letter_exchange(), JOB_DEAD_LETTER_EXCHANGE);
        assert_eq!(
            topology.job_queue(JobKind::AnalyticsReprocess),
            "wakaclock.jobs.analytics.reprocess"
        );
        assert_eq!(
            topology.retry_exchange(Duration::from_secs(30)),
            "wakaclock.jobs.retry.30s"
        );
    }

    #[test]
    fn every_retry_delay_gets_its_own_queue() {
        let topology = JobTopology::production();
        let names: std::collections::HashSet<_> = JOB_RETRY_DELAYS
            .iter()
            .map(|delay| topology.retry_exchange(*delay))
            .collect();
        assert_eq!(names.len(), JOB_RETRY_DELAYS.len());
    }

    #[test]
    fn job_queues_dead_letter_and_bound_redelivery() {
        let arguments = JobTopology::production().job_queue_arguments();
        assert_eq!(
            argument(&arguments, "x-queue-type"),
            Some(&long_string("quorum"))
        );
        assert_eq!(
            argument(&arguments, "x-dead-letter-exchange"),
            Some(&long_string(JOB_DEAD_LETTER_EXCHANGE))
        );
        assert_eq!(
            argument(&arguments, "x-delivery-limit"),
            Some(&AMQPValue::LongLongInt(JOB_DELIVERY_LIMIT))
        );
    }

    #[test]
    fn retry_queues_expire_back_onto_the_job_exchange() {
        let arguments = JobTopology::production().retry_queue_arguments(Duration::from_secs(120));
        assert_eq!(
            argument(&arguments, "x-message-ttl"),
            Some(&AMQPValue::LongLongInt(120_000))
        );
        assert_eq!(
            argument(&arguments, "x-dead-letter-exchange"),
            Some(&long_string(JOB_EXCHANGE))
        );
        assert_eq!(
            argument(&arguments, "x-dead-letter-strategy"),
            Some(&long_string("at-least-once"))
        );
    }

    #[test]
    fn decode_rejects_with_fixed_categories_only() {
        let job = JobEnvelope::new(
            Uuid::now_v7(),
            JobKind::PricingReconcile,
            SYSTEM_TENANT_ID,
            serde_json::json!({}),
        )
        .unwrap();
        let body = serde_json::to_vec(&job).unwrap();
        assert_eq!(decode(&body, JobKind::PricingReconcile), Ok(job.clone()));
        assert_eq!(decode(&body, JobKind::ExportGenerate), Err("wrong_queue"));
        assert_eq!(
            decode(b"{\"secret\":", JobKind::PricingReconcile),
            Err("undecodable_envelope")
        );

        let mut forged = job;
        forged.event.event_type = "export.generate".to_string();
        assert_eq!(
            decode(
                &serde_json::to_vec(&forged).unwrap(),
                JobKind::PricingReconcile
            ),
            Err("invalid_envelope")
        );
    }

    /// Integration tests against a real broker. They need `RABBITMQ_TEST_URL` so they
    /// can never touch the application's own `ATOAXIS_JOB_QUEUE_URL`, and each test
    /// works inside its own name prefix and deletes it afterwards.
    mod broker {
        use super::*;
        use crate::infrastructure::contracts::SYSTEM_TENANT_ID;
        use lapin::options::{BasicGetOptions, ExchangeDeleteOptions, QueueDeleteOptions};

        const RECEIVE_TIMEOUT: Duration = Duration::from_secs(20);

        struct Harness {
            url: String,
            topology: JobTopology,
            queue: RabbitMqJobQueue,
        }

        impl Harness {
            async fn new() -> Self {
                let url = std::env::var("RABBITMQ_TEST_URL")
                    .expect("set RABBITMQ_TEST_URL to an isolated RabbitMQ instance");
                let topology = JobTopology {
                    prefix: format!("test-{}.", Uuid::now_v7().simple()),
                };
                let queue = RabbitMqJobQueue::connect_with(&url, topology.clone())
                    .await
                    .expect("connect and declare topology");
                Self {
                    url,
                    topology,
                    queue,
                }
            }

            fn job(&self, kind: JobKind) -> JobEnvelope {
                let tenant = if kind.is_system_scoped() {
                    SYSTEM_TENANT_ID
                } else {
                    Uuid::now_v7()
                };
                JobEnvelope::new(Uuid::now_v7(), kind, tenant, serde_json::json!({})).unwrap()
            }

            async fn next(consumer: &RabbitMqJobConsumer) -> Box<dyn JobDelivery> {
                tokio::time::timeout(RECEIVE_TIMEOUT, consumer.next_delivery())
                    .await
                    .expect("a delivery before the timeout")
                    .expect("receive")
                    .expect("consumer still open")
            }

            async fn take_dead_letter(&self) -> Option<lapin::message::Delivery> {
                self.queue
                    .publish_channel
                    .basic_get(
                        self.topology.dead_letter_queue().into(),
                        BasicGetOptions { no_ack: true },
                    )
                    .await
                    .expect("basic.get")
                    .map(|message| message.delivery)
            }

            async fn queue_is_empty(&self, queue: String) -> bool {
                self.queue
                    .publish_channel
                    .basic_get(queue.into(), BasicGetOptions { no_ack: false })
                    .await
                    .expect("basic.get")
                    .is_none()
            }

            async fn cleanup(self) {
                let channel = &self.queue.publish_channel;
                let mut queues = vec![self.topology.dead_letter_queue()];
                queues.extend(JobKind::ALL.map(|kind| self.topology.job_queue(kind)));
                queues.extend(JOB_RETRY_DELAYS.map(|delay| self.topology.retry_exchange(delay)));
                for queue in queues {
                    let _ = channel
                        .queue_delete(queue.into(), QueueDeleteOptions::default())
                        .await;
                }
                let mut exchanges = vec![
                    self.topology.exchange(),
                    self.topology.dead_letter_exchange(),
                ];
                exchanges.extend(JOB_RETRY_DELAYS.map(|delay| self.topology.retry_exchange(delay)));
                for exchange in exchanges {
                    let _ = channel
                        .exchange_delete(exchange.into(), ExchangeDeleteOptions::default())
                        .await;
                }
                let _ = self.queue.close().await;
            }
        }

        fn failure_category(delivery: &lapin::message::Delivery) -> Option<String> {
            match delivery
                .properties
                .headers()
                .as_ref()?
                .inner()
                .get(&ShortString::from(FAILURE_CATEGORY_HEADER))?
            {
                AMQPValue::LongString(value) => Some(value.to_string()),
                _ => None,
            }
        }

        #[tokio::test]
        #[ignore = "requires RABBITMQ_TEST_URL"]
        async fn published_job_is_consumed_once_and_acknowledged() {
            let harness = Harness::new().await;
            let consumer = harness
                .queue
                .consumer(JobKind::AnalyticsReprocess, 1, "test")
                .await
                .unwrap();
            let job = harness.job(JobKind::AnalyticsReprocess);
            harness.queue.publish(&job).await.unwrap();

            let delivery = Harness::next(&consumer).await;
            assert_eq!(delivery.job(), &job);
            delivery.ack().await.unwrap();

            drop(consumer);
            assert!(
                harness
                    .queue_is_empty(harness.topology.job_queue(JobKind::AnalyticsReprocess))
                    .await
            );
            assert!(harness.take_dead_letter().await.is_none());
            harness.cleanup().await;
        }

        #[tokio::test]
        #[ignore = "requires RABBITMQ_TEST_URL"]
        async fn unsettled_job_is_redelivered_after_its_worker_disappears() {
            let harness = Harness::new().await;
            let job = harness.job(JobKind::ExportGenerate);
            harness.queue.publish(&job).await.unwrap();

            // A second connection plays the worker that crashes mid-job.
            let crashing = RabbitMqJobQueue::connect_with(&harness.url, harness.topology.clone())
                .await
                .unwrap();
            let doomed = crashing
                .consumer(JobKind::ExportGenerate, 1, "crashing")
                .await
                .unwrap();
            let in_flight = Harness::next(&doomed).await;
            assert_eq!(in_flight.job(), &job);
            crashing.close().await.unwrap();
            drop(in_flight);

            let survivor = harness
                .queue
                .consumer(JobKind::ExportGenerate, 1, "survivor")
                .await
                .unwrap();
            let redelivered = Harness::next(&survivor).await;
            assert_eq!(redelivered.job(), &job);
            redelivered.ack().await.unwrap();
            harness.cleanup().await;
        }

        #[tokio::test]
        #[ignore = "requires RABBITMQ_TEST_URL"]
        async fn retry_waits_for_the_first_delay_then_redelivers_the_next_attempt() {
            let harness = Harness::new().await;
            let consumer = harness
                .queue
                .consumer(JobKind::IntegrationSync, 1, "test")
                .await
                .unwrap();
            let job = harness.job(JobKind::IntegrationSync);
            harness.queue.publish(&job).await.unwrap();

            let first = Harness::next(&consumer).await;
            let started = std::time::Instant::now();
            assert_eq!(
                first.retry().await.unwrap(),
                RetryOutcome::Scheduled(JOB_RETRY_DELAYS[0])
            );

            let second = Harness::next(&consumer).await;
            assert!(
                started.elapsed() >= JOB_RETRY_DELAYS[0] - Duration::from_millis(500),
                "redelivered after {:?}",
                started.elapsed()
            );
            assert_eq!(second.job().job_id, job.job_id);
            assert_eq!(second.job().attempt, 1);
            second.ack().await.unwrap();
            harness.cleanup().await;
        }

        #[tokio::test]
        #[ignore = "requires RABBITMQ_TEST_URL"]
        async fn exhausted_and_explicit_failures_reach_the_dlq_with_their_category() {
            let harness = Harness::new().await;
            let consumer = harness
                .queue
                .consumer(JobKind::ReportDeliver, 1, "test")
                .await
                .unwrap();

            let mut exhausted = harness.job(JobKind::ReportDeliver);
            exhausted.attempt = JOB_RETRY_DELAYS.len() as u16;
            harness.queue.publish(&exhausted).await.unwrap();
            let delivery = Harness::next(&consumer).await;
            assert_eq!(delivery.retry().await.unwrap(), RetryOutcome::DeadLettered);

            let failed = harness.job(JobKind::ReportDeliver);
            harness.queue.publish(&failed).await.unwrap();
            Harness::next(&consumer)
                .await
                .dead_letter("processor_failed")
                .await
                .unwrap();

            let first = harness
                .take_dead_letter()
                .await
                .expect("exhausted job in DLQ");
            let second = harness.take_dead_letter().await.expect("failed job in DLQ");
            assert_eq!(
                failure_category(&first).as_deref(),
                Some("retries_exhausted")
            );
            assert_eq!(
                serde_json::from_slice::<JobEnvelope>(&first.data)
                    .unwrap()
                    .job_id,
                exhausted.job_id
            );
            assert_eq!(
                failure_category(&second).as_deref(),
                Some("processor_failed")
            );
            drop(consumer);
            assert!(
                harness
                    .queue_is_empty(harness.topology.job_queue(JobKind::ReportDeliver))
                    .await
            );
            harness.cleanup().await;
        }

        #[tokio::test]
        #[ignore = "requires RABBITMQ_TEST_URL"]
        async fn undecodable_message_is_dead_lettered_and_the_next_job_still_arrives() {
            let harness = Harness::new().await;
            let consumer = harness
                .queue
                .consumer(JobKind::AccountDelete, 1, "test")
                .await
                .unwrap();
            publish_confirmed(
                &harness.queue.publish_channel,
                &harness.topology.exchange(),
                JobKind::AccountDelete.routing_key(),
                b"not json",
                BasicProperties::default(),
            )
            .await
            .unwrap();
            let job = harness.job(JobKind::AccountDelete);
            harness.queue.publish(&job).await.unwrap();

            let delivery = Harness::next(&consumer).await;
            assert_eq!(delivery.job(), &job);
            delivery.ack().await.unwrap();
            let dead = harness.take_dead_letter().await.expect("garbage in DLQ");
            assert_eq!(
                failure_category(&dead).as_deref(),
                Some("undecodable_envelope")
            );
            harness.cleanup().await;
        }

        #[tokio::test]
        #[ignore = "requires RABBITMQ_TEST_URL"]
        async fn publishing_without_a_bound_queue_is_an_error_not_a_silent_drop() {
            let harness = Harness::new().await;
            harness
                .queue
                .publish_channel
                .queue_delete(
                    harness.topology.job_queue(JobKind::BillingReconcile).into(),
                    QueueDeleteOptions::default(),
                )
                .await
                .unwrap();
            let result = harness
                .queue
                .publish(&harness.job(JobKind::BillingReconcile))
                .await;
            assert!(
                matches!(result, Err(InfrastructureError::Unavailable(ref message)) if message.contains("could not route")),
                "{result:?}"
            );
            harness.cleanup().await;
        }

        #[tokio::test]
        #[ignore = "requires RABBITMQ_TEST_URL"]
        async fn declaring_the_topology_twice_is_harmless() {
            let harness = Harness::new().await;
            let again = RabbitMqJobQueue::connect_with(&harness.url, harness.topology.clone())
                .await
                .expect("redeclare identical topology");
            again.close().await.unwrap();
            harness.cleanup().await;
        }

        /// Restarts the broker container, so it is opt-in on top of the other broker
        /// tests and CI skips it by name. Covers both durable states a job can be in:
        /// waiting in its queue, and waiting out a retry delay in a TTL queue.
        #[tokio::test]
        #[ignore = "requires RABBITMQ_TEST_URL and RABBITMQ_TEST_RESTART_CONTAINER; restarts the broker"]
        async fn jobs_and_scheduled_retries_survive_a_broker_restart() {
            let container = std::env::var("RABBITMQ_TEST_RESTART_CONTAINER")
                .expect("set RABBITMQ_TEST_RESTART_CONTAINER to the disposable broker container");
            let mut harness = Harness::new().await;
            let kind = JobKind::AiSessionReconcile;
            let jobs: Vec<JobEnvelope> = (0..3).map(|_| harness.job(kind)).collect();
            for job in &jobs {
                harness.queue.publish(job).await.unwrap();
            }
            let consumer = harness.queue.consumer(kind, 1, "before").await.unwrap();
            let retried = Harness::next(&consumer).await;
            let retried_id = retried.job().job_id;
            assert!(matches!(
                retried.retry().await.unwrap(),
                RetryOutcome::Scheduled(_)
            ));
            drop(consumer);

            let status = std::process::Command::new("docker")
                .args(["restart", &container])
                .status()
                .expect("run docker restart");
            assert!(status.success(), "docker restart {container} failed");

            let deadline = std::time::Instant::now() + Duration::from_secs(90);
            harness.queue = loop {
                match RabbitMqJobQueue::connect_with(&harness.url, harness.topology.clone()).await {
                    Ok(queue) => break queue,
                    Err(error) if std::time::Instant::now() < deadline => {
                        eprintln!("waiting for the broker: {error}");
                        tokio::time::sleep(Duration::from_secs(2)).await;
                    }
                    Err(error) => panic!("broker did not come back: {error}"),
                }
            };

            let consumer = harness.queue.consumer(kind, 3, "after").await.unwrap();
            let mut received = std::collections::HashMap::new();
            for _ in 0..jobs.len() {
                let delivery = Harness::next(&consumer).await;
                received.insert(delivery.job().job_id, delivery.job().attempt);
                delivery.ack().await.unwrap();
            }
            for job in &jobs {
                let expected_attempt = u16::from(job.job_id == retried_id);
                assert_eq!(received.get(&job.job_id), Some(&expected_attempt));
            }
            drop(consumer);
            harness.cleanup().await;
        }
    }
}

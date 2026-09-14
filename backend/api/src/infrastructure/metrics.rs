//! Small process-local Prometheus exposition used by the broker workers.
//!
//! The repository intentionally does not attach tenant, entity, path, payload or
//! credential values to a metric label.  The registry is process-local because
//! API replicas and workers are scraped independently; aggregation belongs to the
//! deployment's Prometheus layer.

use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};

use chrono::{DateTime, Utc};
use parking_lot::Mutex;

#[derive(Default)]
pub struct KafkaMetrics {
    pub publish_total: AtomicU64,
    pub publish_failures_total: AtomicU64,
    pub publish_latency_ms_total: AtomicU64,
    pub publish_latency_count: AtomicU64,
    pub consumer_batches_total: AtomicU64,
    pub consumer_records_total: AtomicU64,
    pub consumer_batch_records_total: AtomicU64,
    pub consumer_insert_latency_ms_total: AtomicU64,
    pub consumer_insert_latency_count: AtomicU64,
    pub deduplicated_total: AtomicU64,
    pub tombstoned_total: AtomicU64,
    pub retries_total: AtomicU64,
    pub dlq_total: AtomicU64,
    pub verification_mismatch_total: AtomicU64,
    pub oldest_record_age_seconds: AtomicU64,
    pub end_to_end_delay_ms_total: AtomicU64,
    pub end_to_end_delay_count: AtomicU64,
    pub session_reconcile_latency_ms_total: AtomicU64,
    pub session_reconcile_latency_count: AtomicU64,
    partition_lag: Mutex<BTreeMap<(String, i32), u64>>,
    publish_by_topic: Mutex<BTreeMap<String, (u64, u64, u64)>>,
    categorized: Mutex<BTreeMap<(String, String), u64>>,
}

static GLOBAL: OnceLock<Arc<KafkaMetrics>> = OnceLock::new();

pub fn global_kafka_metrics() -> Arc<KafkaMetrics> {
    GLOBAL
        .get_or_init(|| Arc::new(KafkaMetrics::default()))
        .clone()
}

impl KafkaMetrics {
    pub fn observe_publish(&self, latency_ms: u64, success: bool) {
        self.observe_publish_for_topic("unknown", latency_ms, success);
    }

    pub fn observe_publish_for_topic(&self, topic: &str, latency_ms: u64, success: bool) {
        let topic = bounded_topic_label(topic);
        self.publish_total.fetch_add(1, Ordering::Relaxed);
        self.publish_latency_ms_total
            .fetch_add(latency_ms, Ordering::Relaxed);
        self.publish_latency_count.fetch_add(1, Ordering::Relaxed);
        if !success {
            self.publish_failures_total.fetch_add(1, Ordering::Relaxed);
        }
        let mut by_topic = self.publish_by_topic.lock();
        let entry = by_topic.entry(topic.to_string()).or_default();
        entry.0 += 1;
        entry.1 += latency_ms;
        if !success {
            entry.2 += 1;
        }
    }

    pub fn observe_batch(&self, records: usize) {
        self.consumer_batches_total.fetch_add(1, Ordering::Relaxed);
        self.consumer_records_total
            .fetch_add(records as u64, Ordering::Relaxed);
        self.consumer_batch_records_total
            .fetch_add(records as u64, Ordering::Relaxed);
    }

    pub fn observe_insert(&self, latency_ms: u64) {
        self.consumer_insert_latency_ms_total
            .fetch_add(latency_ms, Ordering::Relaxed);
        self.consumer_insert_latency_count
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn observe_partition_lag(&self, topic: &str, partition: i32, lag: u64) {
        self.partition_lag
            .lock()
            .insert((bounded_topic_label(topic).to_string(), partition), lag);
    }

    pub fn observe_oldest_record_age(&self, age_seconds: u64) {
        self.oldest_record_age_seconds
            // This is a current gauge, not a process-lifetime maximum. Keeping
            // the maximum would leave a stale 15-minute alert visible forever
            // after the consumer drained its backlog.
            .store(age_seconds, Ordering::Relaxed);
    }

    /// Record the non-negative delay from an envelope's receive time to a durable
    /// fact or session visibility point. The timestamp is data, not a label.
    pub fn observe_end_to_end_delay(&self, received_at: DateTime<Utc>) {
        let delay_ms = Utc::now()
            .signed_duration_since(received_at)
            .num_milliseconds()
            .max(0) as u64;
        self.end_to_end_delay_ms_total
            .fetch_add(delay_ms, Ordering::Relaxed);
        self.end_to_end_delay_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn observe_session_reconcile(&self, latency_ms: u64, success: bool) {
        self.session_reconcile_latency_ms_total
            .fetch_add(latency_ms, Ordering::Relaxed);
        self.session_reconcile_latency_count
            .fetch_add(1, Ordering::Relaxed);
        self.increment_category(
            "ai_session_reconcile",
            if success { "success" } else { "failure" },
        );
    }

    pub fn increment_category(&self, metric: &str, category: &str) {
        *self
            .categorized
            .lock()
            .entry((metric.to_string(), category.to_string()))
            .or_default() += 1;
    }

    pub fn render_prometheus(&self, service: &str) -> String {
        let mut output = String::new();
        let _ = writeln!(
            output,
            "# HELP atoaxis_kafka_service_info Kafka worker identity."
        );
        let _ = writeln!(output, "# TYPE atoaxis_kafka_service_info gauge");
        let _ = writeln!(
            output,
            "atoaxis_kafka_service_info{{service=\"{}\"}} 1",
            escape(service)
        );
        write_counter(
            &mut output,
            "publish_total",
            self.publish_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "publish_failures_total",
            self.publish_failures_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "consumer_batches_total",
            self.consumer_batches_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "consumer_records_total",
            self.consumer_records_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "deduplicated_total",
            self.deduplicated_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "tombstoned_total",
            self.tombstoned_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "retries_total",
            self.retries_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "dlq_total",
            self.dlq_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "verification_mismatch_total",
            self.verification_mismatch_total.load(Ordering::Relaxed),
        );
        write_gauge(
            &mut output,
            "oldest_record_age_seconds",
            self.oldest_record_age_seconds.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "end_to_end_delay_ms_total",
            self.end_to_end_delay_ms_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "end_to_end_delay_count",
            self.end_to_end_delay_count.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "session_reconcile_latency_ms_total",
            self.session_reconcile_latency_ms_total
                .load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "session_reconcile_latency_count",
            self.session_reconcile_latency_count.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "publish_latency_ms_total",
            self.publish_latency_ms_total.load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "publish_latency_count",
            self.publish_latency_count.load(Ordering::Relaxed),
        );
        let by_topic = self.publish_by_topic.lock();
        let _ = writeln!(output, "# TYPE atoaxis_kafka_publish_by_topic counter");
        for (topic, (total, latency_ms, failures)) in by_topic.iter() {
            let _ = writeln!(
                output,
                "atoaxis_kafka_publish_by_topic{{topic=\"{}\",result=\"success\"}} {}",
                escape(topic),
                total.saturating_sub(*failures)
            );
            let _ = writeln!(
                output,
                "atoaxis_kafka_publish_by_topic{{topic=\"{}\",result=\"failure\"}} {}",
                escape(topic),
                failures
            );
            let _ = writeln!(
                output,
                "atoaxis_kafka_publish_latency_ms_by_topic{{topic=\"{}\"}} {}",
                escape(topic),
                latency_ms
            );
        }
        write_counter(
            &mut output,
            "consumer_insert_latency_ms_total",
            self.consumer_insert_latency_ms_total
                .load(Ordering::Relaxed),
        );
        write_counter(
            &mut output,
            "consumer_insert_latency_count",
            self.consumer_insert_latency_count.load(Ordering::Relaxed),
        );

        let values = self.partition_lag.lock();
        let _ = writeln!(output, "# TYPE atoaxis_kafka_partition_lag gauge");
        for ((topic, partition), lag) in values.iter() {
            let _ = writeln!(
                output,
                "atoaxis_kafka_partition_lag{{topic=\"{}\",partition=\"{}\"}} {}",
                escape(topic),
                partition,
                lag
            );
        }
        let values = self.categorized.lock();
        let _ = writeln!(output, "# TYPE atoaxis_kafka_events_by_category counter");
        for ((metric, category), count) in values.iter() {
            let _ = writeln!(
                output,
                "atoaxis_kafka_events_by_category{{metric=\"{}\",category=\"{}\"}} {}",
                escape(metric),
                escape(category),
                count
            );
        }
        output
    }
}

/// Keep broker topic labels finite and contract-owned. In particular, never put
/// a caller-provided UUID, session ID or event ID into a Prometheus label.
fn bounded_topic_label(topic: &str) -> &'static str {
    match topic {
        "wakaclock.heartbeat.v1" => "wakaclock.heartbeat.v1",
        "wakaclock.ai-usage.v1" => "wakaclock.ai-usage.v1",
        "wakaclock.ai-edit.v1" => "wakaclock.ai-edit.v1",
        "wakaclock.identity-change.v1" => "wakaclock.identity-change.v1",
        "wakaclock.ingest.dlq.v1" => "wakaclock.ingest.dlq.v1",
        _ => "other",
    }
}

fn write_counter(output: &mut String, name: &str, value: u64) {
    let _ = writeln!(output, "# TYPE atoaxis_kafka_{} counter", name);
    let _ = writeln!(output, "atoaxis_kafka_{} {}", name, value);
}

fn write_gauge(output: &mut String, name: &str, value: u64) {
    let _ = writeln!(output, "# TYPE atoaxis_kafka_{} gauge", name);
    let _ = writeln!(output, "atoaxis_kafka_{} {}", name, value);
}

fn escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

#[cfg(test)]
mod tests {
    use super::KafkaMetrics;

    #[test]
    fn exposition_contains_only_bounded_metadata_labels() {
        let metrics = KafkaMetrics::default();
        metrics.observe_partition_lag("wakaclock.heartbeat.v1", 2, 7);
        metrics.increment_category("dlq", "invalid_heartbeat");
        let output = metrics.render_prometheus("fact-sink");
        assert!(output.contains("partition=\"2\""));
        assert!(output.contains("category=\"invalid_heartbeat\""));
        assert!(!output.contains("user_id"));
        assert!(!output.contains("payload"));
    }
}

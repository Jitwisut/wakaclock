use chrono::{DateTime, Utc};
use serde::Serialize;
use wakaclock_core::queue::{DeliveryQueueSnapshot, QueueReadStatus};

use crate::services::delivery_status::ReceivedDeliverySnapshot;

#[derive(Debug, Serialize)]
pub struct DeliveryStatusResponse {
    pub devices: Vec<DeliveryStatusDevice>,
    pub storage: &'static str,
}

#[derive(Debug, Serialize)]
pub struct DeliveryStatusDevice {
    pub schema_version: u8,
    pub details: Option<wakaclock_core::queue::DeliveryQueueDetails>,
    pub capture: Option<wakaclock_core::queue::CaptureHealthSnapshot>,
    pub device_id: String,
    pub queue_id: String,
    pub sequence: u64,
    pub captured_at: DateTime<Utc>,
    pub received_at: DateTime<Utc>,
    pub age_seconds: i64,
    /// `fresh`, `stale`, or `unavailable`; unavailable probes are never shown as zero.
    pub status: &'static str,
    pub pending: Option<u32>,
    pub retry: Option<u32>,
    pub dead_letter: Option<u32>,
    pub oldest_pending_at: Option<DateTime<Utc>>,
    pub last_successful_delivery_at: Option<DateTime<Utc>>,
}

impl DeliveryStatusDevice {
    pub fn from_received(entry: ReceivedDeliverySnapshot, now: DateTime<Utc>) -> Self {
        // Receipt age catches devices that stopped checking in. Capture age prevents
        // an old offline snapshot from appearing fresh just because it was replayed.
        let age_seconds = now
            .signed_duration_since(entry.received_at)
            .num_seconds()
            .max(
                now.signed_duration_since(entry.snapshot.captured_at)
                    .num_seconds(),
            )
            .max(0);
        let status = match entry.snapshot.read_status {
            QueueReadStatus::Unavailable => "unavailable",
            QueueReadStatus::Available if age_seconds > 5 * 60 => "stale",
            QueueReadStatus::Available => "fresh",
        };
        Self::from_parts(entry.snapshot, entry.received_at, age_seconds, status)
    }

    fn from_parts(
        snapshot: DeliveryQueueSnapshot,
        received_at: DateTime<Utc>,
        age_seconds: i64,
        status: &'static str,
    ) -> Self {
        Self {
            schema_version: snapshot.schema_version,
            details: snapshot.details,
            capture: snapshot.capture,
            device_id: snapshot.device_id,
            queue_id: snapshot.queue_id,
            sequence: snapshot.sequence,
            captured_at: snapshot.captured_at,
            received_at,
            age_seconds,
            status,
            pending: snapshot.pending,
            retry: snapshot.retry,
            dead_letter: snapshot.dead_letter,
            oldest_pending_at: snapshot.oldest_pending_at,
            last_successful_delivery_at: snapshot.last_successful_delivery_at,
        }
    }
}

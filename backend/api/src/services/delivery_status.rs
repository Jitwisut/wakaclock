//! Latest privacy-safe local queue snapshots, scoped to the authenticated account.

use std::{collections::HashMap, sync::Arc};

use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use tokio::sync::RwLock;
use uuid::Uuid;
use wakaclock_core::queue::DeliveryQueueSnapshot;

use crate::infrastructure::postgres::PostgresClient;

#[derive(Debug, Clone)]
pub struct ReceivedDeliverySnapshot {
    pub snapshot: DeliveryQueueSnapshot,
    pub received_at: DateTime<Utc>,
}

type EphemeralEntry = (DeliveryQueueSnapshot, DateTime<Utc>, DateTime<Utc>);

pub struct DeliveryStatusService {
    latest: RwLock<HashMap<(Uuid, String, String), EphemeralEntry>>,
    postgres: Option<Arc<PostgresClient>>,
}

impl DeliveryStatusService {
    pub fn with_postgres(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self {
            latest: RwLock::new(HashMap::new()),
            postgres,
        }
    }

    pub fn storage_mode(&self) -> &'static str {
        if self.postgres.is_some() {
            "postgres"
        } else {
            "ephemeral"
        }
    }

    /// A stale or out-of-order snapshot cannot replace a newer sequence from the same
    /// device and queue, even when requests arrive in a different order.
    pub async fn record(&self, user_id: Uuid, snapshot: DeliveryQueueSnapshot) -> Result<bool> {
        let received_at = Utc::now();
        if let Some(postgres) = &self.postgres {
            let value = serde_json::to_value(&snapshot).context("serialize delivery snapshot")?;
            let updated = postgres.client().execute(
                "INSERT INTO delivery_status_devices
                    (user_id, device_id, queue_id, sequence, captured_at, receipt_at, expires_at, snapshot)
                 VALUES ($1, $2, $3, $4, $5, now(), now() + interval '30 days', $6)
                 ON CONFLICT (user_id, device_id, queue_id) DO UPDATE SET
                    sequence = EXCLUDED.sequence,
                    captured_at = EXCLUDED.captured_at,
                    receipt_at = now(),
                    expires_at = now() + interval '30 days',
                    snapshot = EXCLUDED.snapshot
                 WHERE EXCLUDED.sequence > delivery_status_devices.sequence",
                &[
                    &user_id,
                    &snapshot.device_id,
                    &snapshot.queue_id,
                    &(snapshot.sequence as i64),
                    &snapshot.captured_at,
                    &value,
                ],
            ).await.context("persist delivery snapshot")?;
            return Ok(updated > 0);
        }

        let key = (
            user_id,
            snapshot.device_id.clone(),
            snapshot.queue_id.clone(),
        );
        let mut latest = self.latest.write().await;
        if latest.get(&key).is_some_and(|(current, _, expires)| {
            *expires > received_at && current.sequence >= snapshot.sequence
        }) {
            return Ok(false);
        }
        latest.insert(
            key,
            (snapshot, received_at, received_at + Duration::days(30)),
        );
        Ok(true)
    }

    pub async fn latest(&self, user_id: Uuid) -> Result<Vec<ReceivedDeliverySnapshot>> {
        if let Some(postgres) = &self.postgres {
            let rows = postgres
                .client()
                .query(
                    "SELECT snapshot, receipt_at FROM delivery_status_devices
                 WHERE user_id = $1 AND expires_at > now()
                 ORDER BY receipt_at DESC, device_id, queue_id",
                    &[&user_id],
                )
                .await
                .context("read delivery snapshots")?;
            return rows
                .into_iter()
                .map(|row| {
                    let value: serde_json::Value = row.get("snapshot");
                    let snapshot =
                        serde_json::from_value(value).context("decode delivery snapshot")?;
                    let received_at: DateTime<Utc> = row.get("receipt_at");
                    Ok(ReceivedDeliverySnapshot {
                        snapshot,
                        received_at,
                    })
                })
                .collect();
        }

        let now = Utc::now();
        let mut latest = self.latest.write().await;
        latest.retain(|_, (_, _, expires_at)| *expires_at > now);
        let mut entries: Vec<_> = latest
            .iter()
            .filter(|((owner, _, _), _)| *owner == user_id)
            .map(|(_, (snapshot, received_at, _))| ReceivedDeliverySnapshot {
                snapshot: snapshot.clone(),
                received_at: *received_at,
            })
            .collect();
        entries.sort_by(|left, right| right.received_at.cmp(&left.received_at));
        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use wakaclock_core::queue::QueueReadStatus;

    fn snapshot(sequence: u64) -> DeliveryQueueSnapshot {
        let captured_at = Utc.timestamp_opt(1_800_000_000, 0).unwrap();
        DeliveryQueueSnapshot {
            schema_version: 1,
            device_id: "device-a".to_string(),
            queue_id: "a".repeat(64),
            sequence,
            captured_at,
            read_status: QueueReadStatus::Available,
            pending: Some(0),
            retry: Some(0),
            dead_letter: Some(0),
            oldest_pending_at: None,
            last_successful_delivery_at: None,
        }
    }

    #[tokio::test]
    async fn ephemeral_store_keeps_newest_sequence_per_account_device_and_queue() {
        let service = DeliveryStatusService::with_postgres(None);
        let owner = Uuid::new_v4();
        assert!(service.record(owner, snapshot(3)).await.unwrap());
        assert!(!service.record(owner, snapshot(2)).await.unwrap());
        assert!(service.record(owner, snapshot(4)).await.unwrap());
        assert!(service.latest(Uuid::new_v4()).await.unwrap().is_empty());
        let rows = service.latest(owner).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].snapshot.sequence, 4);
    }

    #[test]
    fn unavailable_snapshots_remain_null_instead_of_zero() {
        let snapshot =
            DeliveryQueueSnapshot::unavailable("device-a".to_string(), "b".repeat(64), 1);
        assert_eq!(snapshot.read_status, QueueReadStatus::Unavailable);
        assert_eq!(snapshot.pending, None);
        assert_eq!(snapshot.retry, None);
        assert_eq!(snapshot.dead_letter, None);
    }
}

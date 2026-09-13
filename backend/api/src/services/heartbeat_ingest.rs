//! Single orchestration boundary for heartbeat ingestion (K3/K4).
//!
//! Handlers perform authentication and request decoding, then call this service
//! for exactly one of the direct, verify, or Kafka-cohort behaviours.  Keeping
//! the decision here prevents single/bulk endpoints from drifting on IDs,
//! acknowledgement semantics, or presence timing.

use anyhow::{anyhow, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::config::brokers::IngestMode;
use crate::config::Config;
use crate::infrastructure::app::AppState;
use crate::infrastructure::contracts::{EventBus, EventTopic, HeartbeatEventV1};
use crate::services::heartbeat::HeartbeatService;
use wakaclock_core::heartbeat::Heartbeat;

pub struct HeartbeatIngestService {
    config: Arc<Config>,
    heartbeat_service: Arc<HeartbeatService>,
    event_bus: Option<Arc<dyn EventBus>>,
}

impl HeartbeatIngestService {
    pub fn new(
        config: Arc<Config>,
        heartbeat_service: Arc<HeartbeatService>,
        event_bus: Option<Arc<dyn EventBus>>,
    ) -> Self {
        Self {
            config,
            heartbeat_service,
            event_bus,
        }
    }

    pub fn should_assign_server_ids(&self, user_id: Uuid) -> bool {
        match self.config.brokers.ingest.mode {
            IngestMode::Direct => false,
            IngestMode::Verify => true,
            IngestMode::Kafka => self
                .config
                .brokers
                .ingest
                .kafka_cohort
                .as_ref()
                .is_some_and(|cohort| cohort.includes(user_id)),
        }
    }

    /// Assign IDs only for paths that need a stable broker identity. Direct mode
    /// intentionally keeps its historical behaviour for old clients.
    pub fn assign_server_ids(&self, user_id: Uuid, heartbeats: &mut [Heartbeat]) {
        if !self.should_assign_server_ids(user_id) {
            return;
        }
        for heartbeat in heartbeats {
            if heartbeat.heartbeat_id.is_none() {
                heartbeat.heartbeat_id = Some(format!("srv-{}", Uuid::now_v7()));
            }
        }
    }

    pub async fn process(
        &self,
        user_id: Uuid,
        machine: String,
        heartbeats: Vec<Heartbeat>,
    ) -> Result<usize> {
        let mode = self.config.brokers.ingest.mode;
        let in_cohort = self
            .config
            .brokers
            .ingest
            .kafka_cohort
            .as_ref()
            .is_some_and(|cohort| cohort.includes(user_id));

        match mode {
            IngestMode::Direct => {
                self.heartbeat_service
                    .process_heartbeats(user_id, machine, heartbeats)
                    .await
            }
            IngestMode::Verify => {
                let inserted = self
                    .heartbeat_service
                    .process_heartbeats(user_id, machine, heartbeats.clone())
                    .await?;
                if let Err(error) = self.publish_all(user_id, &heartbeats).await {
                    // Direct ClickHouse is authoritative in verify mode.  The
                    // mismatch is observable through logs/metrics, but a broker
                    // outage must not make an already accepted heartbeat fail.
                    tracing::error!(user_id = %user_id, %error, "heartbeat verification publish failed");
                }
                Ok(inserted)
            }
            IngestMode::Kafka if in_cohort => {
                self.publish_all(user_id, &heartbeats).await?;
                // The API response is the number acknowledged by Kafka, not a
                // ClickHouse row count.  The consumer performs the write later.
                Ok(heartbeats.len())
            }
            IngestMode::Kafka => {
                // Users outside the explicit cohort retain the break-glass direct
                // path during rollout.
                self.heartbeat_service
                    .process_heartbeats(user_id, machine, heartbeats)
                    .await
            }
        }
    }

    async fn publish_all(&self, user_id: Uuid, heartbeats: &[Heartbeat]) -> Result<()> {
        let bus = self
            .event_bus
            .as_ref()
            .ok_or_else(|| anyhow!("Kafka event bus is not configured"))?;
        // Publish every record and await each acknowledgement.  A partial batch
        // acknowledgement is an error; stable event IDs make client replay safe.
        for heartbeat in heartbeats {
            let event = HeartbeatEventV1::from_heartbeat(heartbeat.clone())?
                .event_for_tenant(user_id, Some("api"))?;
            bus.publish(EventTopic::Heartbeat, &event)
                .await
                .map_err(|error| anyhow!(error.to_string()))?;
        }
        Ok(())
    }
}

/// A small test-only constructor keeps service wiring tests independent from a
/// live AppState while the public handler uses the same implementation.
pub fn build_from_state(state: &AppState) -> HeartbeatIngestService {
    HeartbeatIngestService::new(
        state.config.clone(),
        state.heartbeat_service.clone(),
        state.event_bus.clone(),
    )
}

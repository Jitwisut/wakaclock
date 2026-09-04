//! In-memory latest-snapshot store for privacy-safe AI integration diagnostics.
//!
//! The payload is intentionally metadata-only.  This first rollout keeps the latest
//! report in memory, matching the existing presence prototype; the wire contract is
//! stable so a durable repository can replace the store without a client migration.

use std::collections::HashMap;

use tokio::sync::RwLock;
use uuid::Uuid;
use wakaclock_core::ai::AiDiagnosticsReport;

#[derive(Debug, Default)]
pub struct AiDiagnosticsService {
    latest: RwLock<HashMap<Uuid, AiDiagnosticsReport>>,
}

impl AiDiagnosticsService {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn record(&self, user_id: Uuid, report: AiDiagnosticsReport) -> bool {
        let mut latest = self.latest.write().await;
        if latest
            .get(&user_id)
            .is_some_and(|current| current.captured_at > report.captured_at)
        {
            return false;
        }
        latest.insert(user_id, report);
        true
    }

    pub async fn latest(&self, user_id: Uuid) -> Option<AiDiagnosticsReport> {
        self.latest.read().await.get(&user_id).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use wakaclock_core::ai::{
        AdapterFreshness, AttributionMode, BrokerHealth, ObserverConfig, ParserLagSummary,
        VerificationStatus, AI_DIAGNOSTICS_SCHEMA_VERSION,
    };

    fn report(dead_letter: u32) -> AiDiagnosticsReport {
        AiDiagnosticsReport {
            schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION,
            captured_at: Utc.timestamp_opt(1_700_000_000, 0).unwrap(),
            broker: BrokerHealth {
                running: true,
                dead_letter,
                ..Default::default()
            },
            parser: ParserLagSummary::default(),
            adapters: vec![AdapterFreshness {
                agent: "gemini-cli".to_string(),
                detected: true,
                enabled: true,
                verification: VerificationStatus::Installed,
                ..Default::default()
            }],
        }
    }

    #[tokio::test]
    async fn latest_snapshot_is_scoped_and_monotonic() {
        let service = AiDiagnosticsService::new();
        let user = Uuid::new_v4();
        assert!(service.latest(user).await.is_none());
        assert!(service.record(user, report(0)).await);
        assert!(service.record(user, report(2)).await);
        let mut delayed = report(1);
        delayed.captured_at -= chrono::Duration::seconds(1);
        assert!(!service.record(user, delayed).await);
        assert_eq!(service.latest(user).await.unwrap().broker.dead_letter, 2);
        assert!(service.latest(Uuid::new_v4()).await.is_none());
    }

    #[test]
    fn diagnostics_service_does_not_create_an_inference_mode() {
        let config = ObserverConfig {
            enabled: true,
            attribution_mode: AttributionMode::ObserveOnly,
        };
        assert!(!config.feeds_production());
    }
}

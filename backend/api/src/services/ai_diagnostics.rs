//! planai2.md Phase 7 (p7.2c) — server side of the client→server AI-diagnostics
//! push.
//!
//! Holds the **latest** sanitized [`AiDiagnosticsReport`] per user so the
//! dashboard's AI page can show local broker health, parser lag and adapter
//! freshness that the hosted API otherwise never sees.
//!
//! This is deliberately **in-memory**, mirroring `infrastructure::presence_store`
//! — a prototype store. It does **not** survive a restart and does **not** work
//! across more than one server process; both are real limitations that block
//! production use and both go away by swapping this struct's internals for a
//! repository (`Arc<ClickHouseClient>` + `migrate()` at the end of the
//! `main.rs` sequence) **without changing the public API or the wire type**.
//! Only ever the newest snapshot is read, so no history is kept.

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

    /// Store `report` when it is at least as new as the current snapshot. A
    /// delayed HTTP request must not overwrite a fresh health view after a
    /// reconnect; equal timestamps remain last-write-wins for retry safety.
    /// Returns `true` when the snapshot became the latest value.
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

    /// The newest snapshot for `user_id`, or `None` if the client has never
    /// pushed one (or the server restarted since).
    pub async fn latest(&self, user_id: Uuid) -> Option<AiDiagnosticsReport> {
        self.latest.read().await.get(&user_id).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use wakaclock_core::ai::adapter::VerificationStatus;
    use wakaclock_core::ai::{
        AdapterFreshness, BrokerHealth, ParserLagSummary, AI_DIAGNOSTICS_SCHEMA_VERSION,
    };

    fn report(dead_letter: u32) -> AiDiagnosticsReport {
        AiDiagnosticsReport {
            schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION,
            captured_at: Utc.timestamp_opt(1_700_000_000, 0).unwrap(),
            broker: BrokerHealth {
                running: true,
                inbox_pending: 0,
                inbox_retry: 0,
                inbox_dead_letter: dead_letter,
                last_delivery_unix: None,
                last_error_code: None,
            },
            parser: ParserLagSummary {
                transcripts_watched: 1,
                transcripts_behind: 0,
                max_lag_seconds: 0,
            },
            adapters: vec![AdapterFreshness {
                agent: "claude-code".to_string(),
                detected: true,
                enabled: true,
                verification: VerificationStatus::Verified,
                last_evidence_unix: None,
                ..Default::default()
            }],
        }
    }

    #[tokio::test]
    async fn record_then_latest_round_trips_the_report() {
        let service = AiDiagnosticsService::new();
        let user = Uuid::new_v4();
        assert!(service.latest(user).await.is_none());

        service.record(user, report(0)).await;
        assert_eq!(service.latest(user).await, Some(report(0)));
    }

    #[tokio::test]
    async fn record_is_last_write_wins() {
        let service = AiDiagnosticsService::new();
        let user = Uuid::new_v4();
        service.record(user, report(0)).await;
        service.record(user, report(5)).await;
        assert_eq!(
            service.latest(user).await.unwrap().broker.inbox_dead_letter,
            5
        );
    }

    #[tokio::test]
    async fn a_delayed_snapshot_cannot_replace_a_newer_health_view() {
        let service = AiDiagnosticsService::new();
        let user = Uuid::new_v4();
        assert!(service.record(user, report(5)).await);
        let mut delayed = report(1);
        delayed.captured_at -= chrono::Duration::seconds(1);
        assert!(!service.record(user, delayed).await);
        assert_eq!(
            service.latest(user).await.unwrap().broker.inbox_dead_letter,
            5
        );
    }

    #[tokio::test]
    async fn snapshots_are_scoped_per_user() {
        let service = AiDiagnosticsService::new();
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        service.record(a, report(1)).await;
        assert_eq!(service.latest(a).await.unwrap().broker.inbox_dead_letter, 1);
        assert!(service.latest(b).await.is_none());
    }
}

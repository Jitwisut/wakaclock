//! In-memory latest-snapshot store for privacy-safe AI integration diagnostics.
//!
//! The payload is intentionally metadata-only.  This first rollout keeps the latest
//! report in memory, matching the existing presence prototype; the wire contract is
//! stable so a durable repository can replace the store without a client migration.

use std::{collections::HashMap, sync::Arc};

use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use tokio::sync::RwLock;
use uuid::Uuid;
use wakaclock_core::ai::{AiDiagnosticsReport, AiDiagnosticsReportV2};

use crate::infrastructure::postgres::PostgresClient;

/// `(report, received_at, expires_at)` for one device's latest in-memory diagnostics report.
type LatestV2Entry = (AiDiagnosticsReportV2, DateTime<Utc>, DateTime<Utc>);

pub struct AiDiagnosticsService {
    latest: RwLock<HashMap<Uuid, AiDiagnosticsReport>>,
    latest_v2: RwLock<HashMap<(Uuid, String), LatestV2Entry>>,
    postgres: Option<Arc<PostgresClient>>,
}

impl AiDiagnosticsService {
    pub fn new() -> Self {
        Self {
            latest: RwLock::new(HashMap::new()),
            latest_v2: RwLock::new(HashMap::new()),
            postgres: None,
        }
    }

    pub fn with_postgres(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self {
            latest: RwLock::new(HashMap::new()),
            latest_v2: RwLock::new(HashMap::new()),
            postgres,
        }
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

    pub fn storage_mode(&self) -> &'static str {
        if self.postgres.is_some() {
            "postgres"
        } else {
            "ephemeral"
        }
    }

    pub async fn record_v2(&self, user_id: Uuid, report: AiDiagnosticsReportV2) -> Result<bool> {
        let received_at = Utc::now();
        if let Some(postgres) = &self.postgres {
            let value = serde_json::to_value(&report).context("serialize diagnostics report")?;
            let updated = postgres
                .client()
                .execute(
                    "INSERT INTO ai_diagnostics_devices
                        (user_id, device_id, boot_id, sequence, measured_at, receipt_at, expires_at, report)
                     VALUES ($1, $2, $3, $4, $5, now(), now() + interval '30 days', $6)
                     ON CONFLICT (user_id, device_id) DO UPDATE SET
                        boot_id = EXCLUDED.boot_id,
                        sequence = EXCLUDED.sequence,
                        measured_at = EXCLUDED.measured_at,
                        receipt_at = now(),
                        expires_at = now() + interval '30 days',
                        report = EXCLUDED.report
                     WHERE EXCLUDED.boot_id <> ai_diagnostics_devices.boot_id
                        OR EXCLUDED.sequence > ai_diagnostics_devices.sequence
                        OR (EXCLUDED.sequence = ai_diagnostics_devices.sequence
                            AND EXCLUDED.report = ai_diagnostics_devices.report)",
                    &[
                        &user_id,
                        &report.device_id,
                        &report.boot_id,
                        &(report.sequence as i64),
                        &report.measured_at,
                        &value,
                    ],
                )
                .await
                .context("persist diagnostics report")?;
            return Ok(updated > 0);
        }

        let mut latest = self.latest_v2.write().await;
        let key = (user_id, report.device_id.clone());
        if let Some((current, _, expires_at)) = latest.get(&key) {
            if *expires_at <= received_at {
                latest.remove(&key);
            } else if current.boot_id == report.boot_id && current.sequence >= report.sequence {
                return Ok(false);
            }
        }
        latest.insert(key, (report, received_at, received_at + Duration::days(30)));
        Ok(true)
    }

    pub async fn latest_v2(&self, user_id: Uuid) -> Result<Vec<AiDiagnosticsReportV2>> {
        if let Some(postgres) = &self.postgres {
            let rows = postgres
                .client()
                .query(
                    "SELECT report FROM ai_diagnostics_devices
                     WHERE user_id = $1 AND expires_at > now()
                     ORDER BY receipt_at DESC",
                    &[&user_id],
                )
                .await
                .context("read diagnostics reports")?;
            return rows
                .into_iter()
                .map(|row| {
                    let value: serde_json::Value = row.get(0);
                    serde_json::from_value(value).context("decode diagnostics report")
                })
                .collect();
        }

        let now = Utc::now();
        let mut latest = self.latest_v2.write().await;
        latest.retain(|_, (_, _, expires_at)| *expires_at > now);
        let mut reports: Vec<_> = latest
            .iter()
            .filter(|((owner, _), _)| *owner == user_id)
            .map(|(_, (report, received_at, _))| (report.clone(), *received_at))
            .collect();
        // HashMap iteration is intentionally unordered. Return a stable newest-first
        // view so the dashboard and API clients do not select a random device snapshot.
        reports.sort_by(|left, right| {
            right
                .1
                .cmp(&left.1)
                .then_with(|| right.0.captured_at.cmp(&left.0.captured_at))
                .then_with(|| right.0.sequence.cmp(&left.0.sequence))
                .then_with(|| left.0.device_id.cmp(&right.0.device_id))
        });
        Ok(reports.into_iter().map(|(report, _)| report).collect())
    }
}

impl Default for AiDiagnosticsService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use wakaclock_core::ai::{
        AdapterFreshness, AdapterFreshnessV2, AiDiagnosticsReportV2, AttributionMode, BrokerHealth,
        BrokerHealthV2, DiagnosticMeasurement, DiagnosticsConsent, MeasurementAvailability,
        ObserverConfig, ParserLagSummary, ParserLagSummaryV2, RuntimeHealth, VerificationStatus,
        AI_DIAGNOSTICS_SCHEMA_VERSION, AI_DIAGNOSTICS_SCHEMA_VERSION_V2,
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

    fn report_v2(device_id: &str, boot_id: &str, sequence: u64) -> AiDiagnosticsReportV2 {
        let now = Utc
            .timestamp_opt(1_700_000_000 + sequence as i64, 0)
            .unwrap();
        AiDiagnosticsReportV2 {
            schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION_V2,
            captured_at: now,
            device_id: device_id.to_string(),
            boot_id: boot_id.to_string(),
            sequence,
            measured_at: now,
            runtime_health: RuntimeHealth::Healthy,
            consent: DiagnosticsConsent {
                adapter_tracking: true,
                observer: true,
                diagnostics_upload: true,
            },
            broker: BrokerHealthV2 {
                availability: MeasurementAvailability::Available,
                running: DiagnosticMeasurement::available(true, now),
                pending: DiagnosticMeasurement::available(0, now),
                retry: DiagnosticMeasurement::available(0, now),
                dead_letter: DiagnosticMeasurement::available(0, now),
                last_delivery_at: None,
                last_error_code: None,
            },
            parser: ParserLagSummaryV2 {
                availability: MeasurementAvailability::Available,
                transcripts_watched: DiagnosticMeasurement::available(0, now),
                transcripts_behind: DiagnosticMeasurement::unavailable(),
                max_lag_seconds: DiagnosticMeasurement::unavailable(),
            },
            adapters: vec![AdapterFreshnessV2 {
                agent: "codex".to_string(),
                availability: MeasurementAvailability::Available,
                detected: DiagnosticMeasurement::available(true, now),
                enabled: DiagnosticMeasurement::available(true, now),
                runtime_health: RuntimeHealth::Healthy,
                verification: VerificationStatus::Scaffold,
                last_evidence_at: None,
                diagnostic_code: None,
            }],
        }
    }

    #[tokio::test]
    async fn v2_is_scoped_per_device_and_orders_each_boot_by_sequence() {
        let service = AiDiagnosticsService::new();
        let user = Uuid::new_v4();
        assert!(service
            .record_v2(user, report_v2("device-a", "boot-a", 2))
            .await
            .unwrap());
        assert!(!service
            .record_v2(user, report_v2("device-a", "boot-a", 1))
            .await
            .unwrap());
        assert!(service
            .record_v2(user, report_v2("device-b", "boot-b", 1))
            .await
            .unwrap());
        let reports = service.latest_v2(user).await.unwrap();
        assert_eq!(reports.len(), 2);
        assert!(reports
            .iter()
            .any(|report| report.device_id == "device-a" && report.sequence == 2));
        assert!(reports
            .iter()
            .any(|report| report.device_id == "device-b" && report.sequence == 1));
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

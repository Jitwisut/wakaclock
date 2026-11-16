//! Metadata-only diagnostic snapshots. V2 is durable when PostgreSQL is configured;
//! the compatibility fallback is ephemeral. Retired boot IDs fence late deliveries.

use std::{collections::HashMap, sync::Arc};

use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use tokio::sync::RwLock;
use uuid::Uuid;
use wakaclock_core::ai::{AiDiagnosticsReport, AiDiagnosticsReportV2};

use crate::infrastructure::postgres::PostgresClient;

/// `(report, received_at, expires_at, retired_boot_ids)` for one device's latest in-memory diagnostics report.
type LatestV2Entry = (
    AiDiagnosticsReportV2,
    DateTime<Utc>,
    DateTime<Utc>,
    Vec<String>,
);

pub const MAX_DIAGNOSTICS_DEVICES: usize = 32;
const MAX_MEMORY_DEVICES: usize = 10_000;

#[derive(Debug)]
pub struct DiagnosticsDeviceLimit;
impl std::fmt::Display for DiagnosticsDeviceLimit {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("diagnostics device limit reached")
    }
}
impl std::error::Error for DiagnosticsDeviceLimit {}

pub struct DiagnosticsRead {
    pub reports: Vec<AiDiagnosticsReportV2>,
    pub incomplete: bool,
}

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
            let mut connection = postgres.transaction_client().await?;
            let tx = connection.transaction().await?;
            // Serialize admission across API replicas before counting or inserting.
            // Existing devices remain writable even for legacy accounts above the cap.
            tx.query_one("SELECT id FROM users WHERE id=$1 FOR UPDATE", &[&user_id])
                .await?;
            let exists = tx
                .query_opt(
                    "SELECT 1 FROM ai_diagnostics_devices WHERE user_id=$1 AND device_id=$2",
                    &[&user_id, &report.device_id],
                )
                .await?
                .is_some();
            if !exists {
                let count = tx
                    .query(
                        "SELECT 1 FROM ai_diagnostics_devices WHERE user_id=$1 LIMIT $2",
                        &[&user_id, &(MAX_DIAGNOSTICS_DEVICES as i64)],
                    )
                    .await?
                    .len();
                if count >= MAX_DIAGNOSTICS_DEVICES {
                    return Err(DiagnosticsDeviceLimit.into());
                }
            }
            let inserted = tx.execute(
                "INSERT INTO ai_diagnostics_devices (user_id,device_id,boot_id,sequence,measured_at,receipt_at,expires_at,report)
                 VALUES($1,$2,$3,$4,$5,now(),now()+interval '30 days',$6) ON CONFLICT(user_id,device_id) DO NOTHING",
                &[&user_id,&report.device_id,&report.boot_id,&(report.sequence as i64),&report.measured_at,&value],
            ).await?;
            if inserted > 0 {
                tx.commit().await?;
                return Ok(true);
            }
            // The row lock fences concurrent transitions, including competing new boots.
            let row = tx.query_one("SELECT report,retired_boot_ids FROM ai_diagnostics_devices WHERE user_id=$1 AND device_id=$2 FOR UPDATE", &[&user_id,&report.device_id]).await?;
            let current: AiDiagnosticsReportV2 = serde_json::from_value(row.get("report"))?;
            let mut retired: Vec<String> = row.get("retired_boot_ids");
            if !accept_report(&current, &report, &mut retired)? {
                tx.commit().await?;
                return Ok(false);
            }
            tx.execute("UPDATE ai_diagnostics_devices SET boot_id=$3,sequence=$4,measured_at=$5,receipt_at=now(),expires_at=now()+interval '30 days',report=$6,retired_boot_ids=$7 WHERE user_id=$1 AND device_id=$2",
                &[&user_id,&report.device_id,&report.boot_id,&(report.sequence as i64),&report.measured_at,&value,&retired]).await?;
            tx.commit().await?;
            return Ok(true);
        }

        let mut latest = self.latest_v2.write().await;
        let key = (user_id, report.device_id.clone());
        if !latest.contains_key(&key) {
            if latest.keys().filter(|(owner, _)| *owner == user_id).count()
                >= MAX_DIAGNOSTICS_DEVICES
            {
                return Err(DiagnosticsDeviceLimit.into());
            }
            anyhow::ensure!(
                latest.len() < MAX_MEMORY_DEVICES,
                "diagnostics memory capacity reached"
            );
        }
        let mut retired = Vec::new();
        if let Some((current, _, _, history)) = latest.get(&key) {
            retired = history.clone();
            if !accept_report(current, &report, &mut retired)? {
                return Ok(false);
            }
        }
        latest.insert(
            key,
            (
                report,
                received_at,
                received_at + Duration::days(30),
                retired,
            ),
        );
        Ok(true)
    }

    pub async fn latest_v2(&self, user_id: Uuid) -> Result<Vec<AiDiagnosticsReportV2>> {
        Ok(self.latest_v2_bounded(user_id).await?.reports)
    }

    pub async fn latest_v2_bounded(&self, user_id: Uuid) -> Result<DiagnosticsRead> {
        if let Some(postgres) = &self.postgres {
            let rows = postgres
                .client()
                .query(
                    "SELECT report FROM ai_diagnostics_devices
                     WHERE user_id = $1 AND expires_at > now()
                     ORDER BY receipt_at DESC, device_id ASC LIMIT $2",
                    &[&user_id, &((MAX_DIAGNOSTICS_DEVICES + 1) as i64)],
                )
                .await
                .context("read diagnostics reports")?;
            let incomplete = rows.len() > MAX_DIAGNOSTICS_DEVICES;
            let reports = rows
                .into_iter()
                .take(MAX_DIAGNOSTICS_DEVICES)
                .map(|row| {
                    let value: serde_json::Value = row.get(0);
                    serde_json::from_value(value).context("decode diagnostics report")
                })
                .collect::<Result<Vec<_>>>()?;
            return Ok(DiagnosticsRead {
                reports,
                incomplete,
            });
        }

        let now = Utc::now();
        // Expiry hides reports, but does not erase retired boot fences or free slots.
        let latest = self.latest_v2.read().await;
        let mut reports: Vec<_> = latest
            .iter()
            .filter(|((owner, _), (_, _, expires_at, _))| *owner == user_id && *expires_at > now)
            .map(|(_, (report, received_at, _, _))| (report, *received_at))
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
        let incomplete = reports.len() > MAX_DIAGNOSTICS_DEVICES;
        Ok(DiagnosticsRead {
            reports: reports
                .into_iter()
                .take(MAX_DIAGNOSTICS_DEVICES)
                .map(|(report, _)| report.clone())
                .collect(),
            incomplete,
        })
    }
}

/// UUID-like boot IDs have no ordering. A new boot needs newer measurement
/// evidence; once superseded, a boot can never reclaim the latest slot, even
/// with a larger sequence or clock timestamp. Equal sequences never refresh TTL.
fn accept_report(
    current: &AiDiagnosticsReportV2,
    incoming: &AiDiagnosticsReportV2,
    retired: &mut Vec<String>,
) -> Result<bool> {
    if current.boot_id == incoming.boot_id {
        return Ok(
            incoming.sequence > current.sequence && incoming.measured_at >= current.measured_at
        );
    }
    if retired.contains(&incoming.boot_id) || incoming.measured_at <= current.measured_at {
        return Ok(false);
    }
    anyhow::ensure!(
        retired.len() < 1024,
        "diagnostics boot history capacity reached"
    );
    retired.push(current.boot_id.clone());
    Ok(true)
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
                certification: None,
                certificate_id: None,
                certification_status: None,
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

    #[tokio::test]
    async fn memory_device_cap_preserves_existing_and_expired_boot_fences() {
        let service = AiDiagnosticsService::new();
        let user = Uuid::new_v4();
        for index in 0..MAX_DIAGNOSTICS_DEVICES {
            service
                .record_v2(user, report_v2(&format!("device-{index}"), "boot-a", 1))
                .await
                .unwrap();
        }
        let error = service
            .record_v2(user, report_v2("overflow", "boot-a", 1))
            .await
            .unwrap_err();
        assert!(error.is::<DiagnosticsDeviceLimit>());
        assert!(service
            .record_v2(user, report_v2("device-0", "boot-b", 2))
            .await
            .unwrap());
        {
            let mut records = service.latest_v2.write().await;
            records.get_mut(&(user, "device-0".to_owned())).unwrap().2 =
                Utc::now() - Duration::days(1);
        }
        assert_eq!(
            service.latest_v2(user).await.unwrap().len(),
            MAX_DIAGNOSTICS_DEVICES - 1
        );
        assert!(!service
            .record_v2(user, report_v2("device-0", "boot-a", 999))
            .await
            .unwrap());
        assert!(service
            .record_v2(user, report_v2("overflow", "boot-a", 1))
            .await
            .unwrap_err()
            .is::<DiagnosticsDeviceLimit>());
        assert!(service
            .record_v2(Uuid::new_v4(), report_v2("overflow", "boot-a", 1))
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn memory_global_capacity_rejects_new_records_but_preserves_updates() {
        let service = AiDiagnosticsService::new();
        let user = Uuid::new_v4();
        {
            let mut records = service.latest_v2.write().await;
            for index in 0..MAX_MEMORY_DEVICES {
                records.insert(
                    (user, format!("device-{index}")),
                    (
                        report_v2(&format!("device-{index}"), "boot", 1),
                        Utc::now(),
                        Utc::now() + Duration::days(30),
                        vec![],
                    ),
                );
            }
        }
        let error = service
            .record_v2(Uuid::new_v4(), report_v2("new-device", "boot", 1))
            .await
            .unwrap_err();
        assert!(!error.is::<DiagnosticsDeviceLimit>());
        assert!(service
            .record_v2(user, report_v2("device-0", "boot", 2))
            .await
            .unwrap());
        assert_eq!(service.latest_v2.read().await.len(), MAX_MEMORY_DEVICES);
    }

    #[tokio::test]
    async fn legacy_over_cap_read_is_bounded_and_existing_device_updates() {
        let service = AiDiagnosticsService::new();
        let user = Uuid::new_v4();
        {
            let mut records = service.latest_v2.write().await;
            for index in 0..MAX_DIAGNOSTICS_DEVICES + 3 {
                records.insert(
                    (user, format!("device-{index}")),
                    (
                        report_v2(&format!("device-{index}"), "boot", 1),
                        Utc::now(),
                        Utc::now() + Duration::days(30),
                        vec![],
                    ),
                );
            }
        }
        let read = service.latest_v2_bounded(user).await.unwrap();
        assert!(read.incomplete);
        assert_eq!(read.reports.len(), MAX_DIAGNOSTICS_DEVICES);
        assert!(service
            .record_v2(user, report_v2("device-0", "boot", 2))
            .await
            .unwrap());
        assert!(service
            .record_v2(user, report_v2("new-device", "boot", 1))
            .await
            .unwrap_err()
            .is::<DiagnosticsDeviceLimit>());
    }

    async fn exercise_late_boots(service: &AiDiagnosticsService, user: Uuid) {
        let a = report_v2("ordering-device", "boot-a", 1);
        assert!(service.record_v2(user, a.clone()).await.unwrap());
        let mut b = report_v2("ordering-device", "boot-b", 1);
        b.measured_at = a.measured_at + Duration::seconds(10);
        assert!(service.record_v2(user, b.clone()).await.unwrap());
        // Even a larger sequence/timestamp cannot resurrect a retired boot.
        assert!(!service
            .record_v2(user, report_v2("ordering-device", "boot-a", 999))
            .await
            .unwrap());
        assert!(!service
            .record_v2(user, report_v2("ordering-device", "unseen-old-boot", 1))
            .await
            .unwrap());
        assert!(!service.record_v2(user, b.clone()).await.unwrap());
        let mut conflicting = b.clone();
        conflicting.consent.observer = false;
        assert!(!service.record_v2(user, conflicting).await.unwrap());
        let latest = service.latest_v2(user).await.unwrap();
        assert_eq!(latest[0].boot_id, "boot-b");
        assert_eq!(latest[0].sequence, 1);
    }

    #[tokio::test]
    async fn memory_rejects_retired_and_unseen_older_boots() {
        exercise_late_boots(&AiDiagnosticsService::new(), Uuid::new_v4()).await;
    }

    #[tokio::test]
    #[ignore = "requires isolated POSTGRES_TEST_URL"]
    async fn postgres_rejects_retired_boots_after_restart_and_concurrent_delivery() {
        let config = crate::config::PostgresConfig {
            url: Some(std::env::var("POSTGRES_TEST_URL").unwrap()),
            max_connections: 4,
        };
        let pg = Arc::new(PostgresClient::connect(&config).await.unwrap());
        pg.migrate().await.unwrap();
        pg.migrate().await.unwrap();
        let user = Uuid::now_v7();
        pg.client()
            .execute(
                "INSERT INTO users(id,username) VALUES($1,$2)",
                &[&user, &format!("diagnostics-{user}")],
            )
            .await
            .unwrap();
        let service = AiDiagnosticsService::with_postgres(Some(pg.clone()));
        exercise_late_boots(&service, user).await;
        let restarted = AiDiagnosticsService::with_postgres(Some(Arc::new(
            PostgresClient::connect(&config).await.unwrap(),
        )));
        assert!(!restarted
            .record_v2(user, report_v2("ordering-device", "boot-a", 1000))
            .await
            .unwrap());
        let mut newer = report_v2("ordering-device", "boot-c", 1);
        newer.measured_at += Duration::seconds(20);
        let (first, duplicate) = tokio::join!(
            service.record_v2(user, newer.clone()),
            restarted.record_v2(user, newer)
        );
        assert_ne!(first.unwrap(), duplicate.unwrap());
        assert_eq!(service.latest_v2(user).await.unwrap()[0].boot_id, "boot-c");
        assert!(service.latest_v2(Uuid::new_v4()).await.unwrap().is_empty());
        // Leave one slot, then race two independent connections/replicas.
        for index in 0..MAX_DIAGNOSTICS_DEVICES - 2 {
            service
                .record_v2(user, report_v2(&format!("quota-{index}"), "boot", 1))
                .await
                .unwrap();
        }
        let (first, second) = tokio::join!(
            service.record_v2(user, report_v2("last-slot-a", "boot", 1)),
            restarted.record_v2(user, report_v2("last-slot-b", "boot", 1)),
        );
        assert_ne!(first.is_ok(), second.is_ok());
        let error = if let Err(error) = first {
            error
        } else {
            second.unwrap_err()
        };
        assert!(error.is::<DiagnosticsDeviceLimit>());
        assert_eq!(
            service.latest_v2(user).await.unwrap().len(),
            MAX_DIAGNOSTICS_DEVICES
        );
        assert!(restarted
            .record_v2(user, report_v2("quota-0", "boot", 2))
            .await
            .unwrap());
        pg.client()
            .execute("DELETE FROM users WHERE id=$1", &[&user])
            .await
            .unwrap();
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

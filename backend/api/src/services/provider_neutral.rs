//! Provider-neutral contracts for the R5 jobs that are intentionally still closed.
//!
//! These interfaces are the seam for a future production provider.  The shipped
//! implementation only contains deterministic fakes for acceptance tests; no fake
//! is registered in `AppState`, no endpoint is enabled, and no credential or
//! provider payload is persisted by these types.

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Serialize;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
};
use tokio::sync::Mutex;
use uuid::Uuid;

/// Capability entries exposed by the v2 capability manifest.  The status is
/// deliberately independent from whether a route or job enum exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct ProviderNeutralCapability {
    pub kind: &'static str,
    pub available: bool,
    pub status: &'static str,
    pub provider: Option<&'static str>,
}

pub const PROVIDER_NEUTRAL_CAPABILITIES: &[ProviderNeutralCapability] = &[
    ProviderNeutralCapability {
        kind: "report.deliver",
        available: false,
        status: "provider_required",
        provider: None,
    },
    ProviderNeutralCapability {
        kind: "integration.sync",
        available: false,
        status: "provider_required",
        provider: None,
    },
    ProviderNeutralCapability {
        kind: "billing.reconcile",
        available: false,
        status: "source_of_truth_required",
        provider: None,
    },
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportDeliveryRequest {
    /// This is the only idempotency key a provider may receive for a report.
    pub report_delivery_id: Uuid,
    /// A content hash is enough for a provider adapter contract and avoids
    /// passing report contents through a generic provider interface.
    pub content_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportDeliveryReceipt {
    pub provider_delivery_id: String,
}

#[async_trait]
pub trait ReportDeliveryProvider: Send + Sync {
    async fn deliver(&self, request: ReportDeliveryRequest) -> Result<ReportDeliveryReceipt>;
}

/// Deterministic in-memory sink used by R5 acceptance tests.  Replaying one
/// `report_delivery_id` returns the original receipt and never creates another
/// logical delivery.
#[derive(Clone, Default)]
pub struct FakeReportDeliveryProvider {
    receipts: Arc<Mutex<BTreeMap<Uuid, ReportDeliveryReceipt>>>,
}

impl FakeReportDeliveryProvider {
    pub async fn delivery_count(&self) -> usize {
        self.receipts.lock().await.len()
    }
}

#[async_trait]
impl ReportDeliveryProvider for FakeReportDeliveryProvider {
    async fn deliver(&self, request: ReportDeliveryRequest) -> Result<ReportDeliveryReceipt> {
        if request.content_hash.is_empty() || !request.content_hash.is_ascii() {
            return Err(anyhow!("report content hash is invalid"));
        }
        let mut receipts = self.receipts.lock().await;
        Ok(receipts
            .entry(request.report_delivery_id)
            .or_insert_with(|| ReportDeliveryReceipt {
                provider_delivery_id: format!("fake-report-{}", request.report_delivery_id),
            })
            .clone())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IntegrationSyncRequest {
    pub connection_id: Uuid,
    pub sync_generation: i64,
    pub credential_generation: i64,
    /// Only a digest of the authenticated credential envelope crosses the
    /// provider-neutral boundary.  The plaintext/token is never part of a job.
    pub credential_envelope_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IntegrationSyncReceipt {
    pub connection_id: Uuid,
    pub sync_generation: i64,
}

#[async_trait]
pub trait IntegrationProvider: Send + Sync {
    async fn sync(&self, request: IntegrationSyncRequest) -> Result<IntegrationSyncReceipt>;
}

#[derive(Clone, Default)]
pub struct FakeIntegrationProvider {
    revoked: Arc<Mutex<BTreeSet<Uuid>>>,
    generations: Arc<Mutex<BTreeMap<Uuid, IntegrationGeneration>>>,
}

type IntegrationGeneration = (i64, i64, IntegrationSyncReceipt);

impl FakeIntegrationProvider {
    pub async fn revoke(&self, connection_id: Uuid) {
        self.revoked.lock().await.insert(connection_id);
    }
}

#[async_trait]
impl IntegrationProvider for FakeIntegrationProvider {
    async fn sync(&self, request: IntegrationSyncRequest) -> Result<IntegrationSyncReceipt> {
        if request.sync_generation < 0 || request.credential_generation < 0 {
            return Err(anyhow!("integration generation is invalid"));
        }
        if request.credential_envelope_hash.is_empty()
            || !request.credential_envelope_hash.is_ascii()
        {
            return Err(anyhow!("integration credential envelope is invalid"));
        }
        if self.revoked.lock().await.contains(&request.connection_id) {
            return Err(anyhow!("integration credential is revoked"));
        }

        let mut generations = self.generations.lock().await;
        if let Some((last_sync_generation, last_credential_generation, receipt)) =
            generations.get(&request.connection_id)
        {
            if request.sync_generation < *last_sync_generation
                || (request.sync_generation == *last_sync_generation
                    && request.credential_generation < *last_credential_generation)
            {
                return Err(anyhow!("stale integration sync generation"));
            }
            if request.sync_generation == *last_sync_generation
                && request.credential_generation == *last_credential_generation
            {
                return Ok(receipt.clone());
            }
        }
        let receipt = IntegrationSyncReceipt {
            connection_id: request.connection_id,
            sync_generation: request.sync_generation,
        };
        generations.insert(
            request.connection_id,
            (
                request.sync_generation,
                request.credential_generation,
                receipt.clone(),
            ),
        );
        Ok(receipt)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BillingEntryKind {
    Charge,
    Adjustment,
    Refund,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BillingEntry {
    pub transaction_id: String,
    pub amount_microusd: i64,
    pub kind: BillingEntryKind,
}

impl BillingEntry {
    fn signed_amount(&self) -> i64 {
        match self.kind {
            BillingEntryKind::Charge => self.amount_microusd,
            BillingEntryKind::Adjustment => self.amount_microusd,
            BillingEntryKind::Refund => -self.amount_microusd.abs(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BillingPage {
    pub next_cursor: Option<String>,
    pub entries: Vec<BillingEntry>,
}

#[async_trait]
pub trait BillingSource: Send + Sync {
    async fn fetch_page(&self, cursor: Option<&str>) -> Result<BillingPage>;
}

#[derive(Clone, Default)]
pub struct FakeBillingSource {
    pages: Arc<Mutex<BTreeMap<Option<String>, BillingPage>>>,
}

impl FakeBillingSource {
    pub async fn insert_page(&self, cursor: Option<String>, page: BillingPage) {
        self.pages.lock().await.insert(cursor, page);
    }
}

#[async_trait]
impl BillingSource for FakeBillingSource {
    async fn fetch_page(&self, cursor: Option<&str>) -> Result<BillingPage> {
        let key = cursor.map(ToOwned::to_owned);
        self.pages
            .lock()
            .await
            .get(&key)
            .cloned()
            .ok_or_else(|| anyhow!("billing cursor is not available"))
    }
}

/// Idempotent ledger used by the fake-source acceptance path.  A cursor replay
/// and a duplicate transaction are both no-ops, while adjustments/refunds retain
/// their signed accounting effect.
#[derive(Clone, Default)]
pub struct BillingLedger {
    entries: Arc<Mutex<BTreeMap<String, BillingEntry>>>,
}

impl BillingLedger {
    pub async fn apply_page(&self, page: &BillingPage) -> Result<(usize, i64)> {
        let mut entries = self.entries.lock().await;
        let mut inserted = 0;
        let mut delta = 0;
        for entry in &page.entries {
            if entry.transaction_id.is_empty() || !entry.transaction_id.is_ascii() {
                return Err(anyhow!("billing transaction identity is invalid"));
            }
            if let Some(existing) = entries.get(&entry.transaction_id) {
                if existing != entry {
                    return Err(anyhow!("billing transaction identity conflict"));
                }
                continue;
            }
            delta += entry.signed_amount();
            entries.insert(entry.transaction_id.clone(), entry.clone());
            inserted += 1;
        }
        Ok((inserted, delta))
    }

    pub async fn len(&self) -> usize {
        self.entries.lock().await.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.entries.lock().await.is_empty()
    }
}

pub async fn reconcile_billing_page(
    source: &dyn BillingSource,
    ledger: &BillingLedger,
    cursor: Option<&str>,
) -> Result<(Option<String>, usize, i64)> {
    let page = source.fetch_page(cursor).await?;
    let (inserted, delta) = ledger.apply_page(&page).await?;
    Ok((page.next_cursor, inserted, delta))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn report_delivery_replay_is_idempotent_by_report_delivery_id() {
        let provider = FakeReportDeliveryProvider::default();
        let request = ReportDeliveryRequest {
            report_delivery_id: Uuid::now_v7(),
            content_hash: "sha256:report".to_string(),
        };
        let first = provider.deliver(request.clone()).await.unwrap();
        let replay = provider.deliver(request).await.unwrap();
        assert_eq!(first, replay);
        assert_eq!(provider.delivery_count().await, 1);
    }

    #[tokio::test]
    async fn integration_provider_fences_stale_and_revoked_credentials() {
        let provider = FakeIntegrationProvider::default();
        let connection_id = Uuid::now_v7();
        let current = IntegrationSyncRequest {
            connection_id,
            sync_generation: 2,
            credential_generation: 1,
            credential_envelope_hash: "sha256:credential".to_string(),
        };
        provider.sync(current.clone()).await.unwrap();
        assert!(provider
            .sync(IntegrationSyncRequest {
                sync_generation: 1,
                ..current.clone()
            })
            .await
            .is_err());
        assert!(provider
            .sync(IntegrationSyncRequest {
                credential_generation: 0,
                ..current.clone()
            })
            .await
            .is_err());
        provider
            .sync(IntegrationSyncRequest {
                credential_generation: 2,
                ..current.clone()
            })
            .await
            .unwrap();
        provider.revoke(connection_id).await;
        assert!(provider.sync(current).await.is_err());
    }

    #[tokio::test]
    async fn billing_ledger_handles_cursor_replay_adjustment_and_refund() {
        let source = FakeBillingSource::default();
        source
            .insert_page(
                None,
                BillingPage {
                    next_cursor: Some("page-2".to_string()),
                    entries: vec![BillingEntry {
                        transaction_id: "charge-1".to_string(),
                        amount_microusd: 100,
                        kind: BillingEntryKind::Charge,
                    }],
                },
            )
            .await;
        source
            .insert_page(
                Some("page-2".to_string()),
                BillingPage {
                    next_cursor: None,
                    entries: vec![
                        BillingEntry {
                            transaction_id: "adjustment-1".to_string(),
                            amount_microusd: -20,
                            kind: BillingEntryKind::Adjustment,
                        },
                        BillingEntry {
                            transaction_id: "refund-1".to_string(),
                            amount_microusd: 30,
                            kind: BillingEntryKind::Refund,
                        },
                    ],
                },
            )
            .await;
        let ledger = BillingLedger::default();
        let (cursor, inserted, delta) = reconcile_billing_page(&source, &ledger, None)
            .await
            .unwrap();
        assert_eq!(cursor.as_deref(), Some("page-2"));
        assert_eq!((inserted, delta), (1, 100));
        let (_, inserted, delta) = reconcile_billing_page(&source, &ledger, cursor.as_deref())
            .await
            .unwrap();
        assert_eq!((inserted, delta), (2, -50));
        let (_, inserted, delta) = reconcile_billing_page(&source, &ledger, None)
            .await
            .unwrap();
        assert_eq!((inserted, delta), (0, 0));
        assert_eq!(ledger.len().await, 3);
    }

    #[test]
    fn provider_neutral_capabilities_are_closed_by_default() {
        assert!(PROVIDER_NEUTRAL_CAPABILITIES
            .iter()
            .all(|capability| !capability.available && capability.provider.is_none()));
    }
}

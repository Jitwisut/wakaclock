use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const CALCULATION_VERSION: &str = "team_usage_v1";
pub const MIN_CONTRIBUTORS: usize = 5;

#[derive(Debug, Serialize)]
pub struct TeamConsent {
    pub share_aggregate: bool,
    pub share_individual: bool,
    pub version: i64,
    pub aggregate_from: Option<DateTime<Utc>>,
    pub individual_from: Option<DateTime<Utc>>,
    pub preview: ConsentPreview,
}

#[derive(Debug, Serialize)]
pub struct ConsentPreview {
    pub metadata: Vec<&'static str>,
    pub excludes: Vec<&'static str>,
    pub minimum_contributors: usize,
    pub history_before_consent: bool,
    pub downloaded_exports_recallable: bool,
}

impl Default for ConsentPreview {
    fn default() -> Self {
        Self {
            metadata: vec![
                "provider/model",
                "usage counters",
                "estimated cost",
                "allowed project",
                "confirmed work links",
            ],
            excludes: vec!["source", "diff", "prompt", "response", "CI log"],
            minimum_contributors: MIN_CONTRIBUTORS,
            history_before_consent: false,
            downloaded_exports_recallable: false,
        }
    }
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct Metric<T> {
    pub value: Option<T>,
    pub status: &'static str,
    pub reason: Option<&'static str>,
    pub coverage: Option<f64>,
    pub provenance: &'static str,
    pub updated_at: Option<DateTime<Utc>>,
    pub calculation_version: &'static str,
}

impl<T> Metric<T> {
    pub fn unavailable(reason: &'static str) -> Self {
        Self {
            value: None,
            status: "unavailable",
            reason: Some(reason),
            coverage: None,
            provenance: "canonical_usage_facts",
            updated_at: None,
            calculation_version: CALCULATION_VERSION,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TeamInsights {
    pub organization_id: Uuid,
    pub team_id: Option<Uuid>,
    pub start: String,
    pub end: String,
    pub timezone: String,
    pub generation: i64,
    pub estimated_ai_cost_microusd: Metric<u64>,
    pub currency: &'static str,
    pub merged_pr_cost_microusd: Metric<u64>,
    pub provider_breakdown: Vec<ProviderCost>,
    pub measurement_health: Vec<&'static str>,
    pub production_ready: bool,
}

#[derive(Debug, Serialize)]
pub struct ProviderCost {
    pub provider: String,
    pub model: String,
    pub cost_microusd: Metric<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LinkRequest {
    pub session_id: String,
    pub repository_id: Uuid,
    pub work_item_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LinkDecision {
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct WorkLink {
    pub id: Uuid,
    pub repository_id: Uuid,
    pub work_item_id: i64,
    pub session_id: String,
    pub status: String,
    pub evidence: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TeamWorkItem {
    pub repository_id: Uuid,
    pub external_id: i64,
    pub kind: String,
    pub number: i32,
    pub state: String,
    pub opened_at: DateTime<Utc>,
    pub ready_at: Option<DateTime<Utc>>,
    pub first_review_at: Option<DateTime<Utc>>,
    pub merged_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub synced_at: DateTime<Utc>,
    pub session_details: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ReceiptSession {
    pub session_id: String,
    pub link_id: Uuid,
    pub link_evidence: String,
    pub cost_microusd: Metric<u64>,
    pub allocation: &'static str,
}

#[derive(Debug, Serialize)]
pub struct WorkReceipt {
    pub repository_id: Uuid,
    pub work_item_id: i64,
    pub sessions: Vec<ReceiptSession>,
    pub estimated_cost_microusd: Metric<u64>,
    pub sharing: &'static str,
    pub generation: i64,
}

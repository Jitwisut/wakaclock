use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SummaryItem {
    pub name: String,
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
}

#[derive(Debug, Serialize)]
pub struct SummaryGrandTotal {
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
    /// Optional duration-v2 diagnostics. They are duplicated at the grand-total level
    /// so clients that do not render the evidence object can still compare the two
    /// timelines without changing the legacy fields above.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparable_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_measured_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_additional_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_version: Option<&'static str>,
    /// Strict Active v1 metrics. Legacy `total_seconds` remains the
    /// WakaTime-compatible value for existing consumers.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_human_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_human_only_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_ai_only_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_ai_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_overlap_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_coverage: Option<&'static str>,
    /// Additive: `total_seconds` keeps its WakaTime meaning, and this says how much of
    /// it a client actually measured versus how much the idle bridge inferred, and how
    /// much was attended by a human versus produced by an agent.
    pub evidence: crate::services::activity_timeline::EvidenceSplit,
}

#[derive(Debug, Serialize)]
pub struct SummaryDay {
    pub date: String,
    pub grand_total: SummaryGrandTotal,
    pub languages: Vec<SummaryItem>,
    pub projects: Vec<SummaryItem>,
    pub editors: Vec<SummaryItem>,
    pub operating_systems: Vec<SummaryItem>,
    /// Additive; WakaTime's summaries payload has no categories array.
    pub categories: Vec<SummaryItem>,
}

#[derive(Debug, Serialize)]
pub struct SummaryCalculation {
    pub timezone: String,
    pub timeout_seconds: f64,
    pub writes_only: bool,
    pub scope: &'static str,
    pub comparable_metric: &'static str,
    pub calculation_version: &'static str,
}

#[derive(Debug, Serialize)]
pub struct SummariesResponse {
    pub calculation: SummaryCalculation,
    pub start: String,
    pub end: String,
    pub days: Vec<SummaryDay>,
}

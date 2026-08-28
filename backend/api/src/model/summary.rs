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
pub struct SummariesResponse {
    pub start: String,
    pub end: String,
    pub days: Vec<SummaryDay>,
}

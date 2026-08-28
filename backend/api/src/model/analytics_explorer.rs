use serde::Serialize;

use crate::model::date_range::RangeInfo;

pub const ANALYTICS_EXPLORER_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Default, Serialize)]
pub struct ExplorerAppliedFilters {
    pub category: Option<String>,
    pub editor: Option<String>,
    pub language: Option<String>,
    pub operating_system: Option<String>,
    pub project_id: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExplorerFilterOption {
    pub key: String,
    pub name: String,
    pub total_seconds: f64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ExplorerFilterOptions {
    pub categories: Vec<ExplorerFilterOption>,
    pub editors: Vec<ExplorerFilterOption>,
    pub languages: Vec<ExplorerFilterOption>,
    pub operating_systems: Vec<ExplorerFilterOption>,
    pub projects: Vec<ExplorerFilterOption>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ExplorerBreakdowns {
    pub categories: Vec<ExplorerFilterOption>,
    pub editors: Vec<ExplorerFilterOption>,
    pub languages: Vec<ExplorerFilterOption>,
    pub operating_systems: Vec<ExplorerFilterOption>,
    pub projects: Vec<ExplorerFilterOption>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ExplorerDurationSplit {
    pub ai_seconds: f64,
    pub human_seconds: f64,
    pub other_seconds: f64,
    pub total_seconds: f64,
}

impl ExplorerDurationSplit {
    pub fn add(&mut self, source: &str, seconds: f64) {
        if !seconds.is_finite() || seconds <= 0.0 {
            return;
        }
        self.total_seconds += seconds;
        match source {
            "editor" | "human" => self.human_seconds += seconds,
            "ai" => self.ai_seconds += seconds,
            _ => self.other_seconds += seconds,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ExplorerSummary {
    pub active_days: usize,
    pub ai_share_percent: Option<f64>,
    #[serde(flatten)]
    pub duration: ExplorerDurationSplit,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExplorerTimelineBucket {
    pub bucket: String,
    pub label: String,
    #[serde(flatten)]
    pub duration: ExplorerDurationSplit,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExplorerTimeline {
    pub bucket_seconds: u64,
    pub items: Vec<ExplorerTimelineBucket>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExplorerCalendarCell {
    pub date: String,
    #[serde(flatten)]
    pub duration: ExplorerDurationSplit,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExplorerTimeCell {
    pub hour: u8,
    pub weekday: u8,
    pub weekday_name: String,
    #[serde(flatten)]
    pub duration: ExplorerDurationSplit,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsExplorerResponse {
    pub applied_filters: ExplorerAppliedFilters,
    pub breakdowns: ExplorerBreakdowns,
    pub calendar_heatmap: Vec<ExplorerCalendarCell>,
    pub filter_options: ExplorerFilterOptions,
    pub generated_at: String,
    pub range: RangeInfo,
    pub schema_version: u32,
    pub summary: ExplorerSummary,
    pub time_heatmap: Vec<ExplorerTimeCell>,
    pub timeline: ExplorerTimeline,
}

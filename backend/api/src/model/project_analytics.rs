//! Contracts for the stable-ID project analytics API (Phase 9 PR 9.7/9.8).

use serde::Serialize;
use uuid::Uuid;

use crate::model::date_range::RangeInfo;

pub const PROJECT_ANALYTICS_SCHEMA_VERSION: u32 = 2;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProjectSort {
    AiChanges,
    Duration,
    EstimatedCost,
    Prompts,
    Recent,
    Sessions,
    Tokens,
}

impl ProjectSort {
    pub fn parse(value: Option<&str>) -> Result<Self, &'static str> {
        match value.unwrap_or("duration") {
            "duration" => Ok(Self::Duration),
            "recent" => Ok(Self::Recent),
            "ai_changes" => Ok(Self::AiChanges),
            "prompts" => Ok(Self::Prompts),
            "sessions" => Ok(Self::Sessions),
            "tokens" => Ok(Self::Tokens),
            "estimated_cost" => Ok(Self::EstimatedCost),
            _ => Err("sort must be duration, recent, ai_changes, prompts, sessions, tokens, or estimated_cost"),
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::AiChanges => "ai_changes",
            Self::Duration => "duration",
            Self::EstimatedCost => "estimated_cost",
            Self::Prompts => "prompts",
            Self::Recent => "recent",
            Self::Sessions => "sessions",
            Self::Tokens => "tokens",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SortOrder {
    Asc,
    Desc,
}

impl SortOrder {
    pub fn parse(value: Option<&str>) -> Result<Self, &'static str> {
        match value.unwrap_or("desc") {
            "asc" => Ok(Self::Asc),
            "desc" => Ok(Self::Desc),
            _ => Err("order must be asc or desc"),
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Asc => "asc",
            Self::Desc => "desc",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ProjectAnalyticsListResponse {
    pub data_version: u64,
    pub generated_at: String,
    pub items: Vec<ProjectAnalyticsCard>,
    pub next_cursor: Option<String>,
    pub range: RangeInfo,
    pub schema_version: u32,
    pub totals: ProjectAnalyticsTotals,
}

#[derive(Debug, Serialize)]
pub struct ProjectAnalyticsTotals {
    pub project_count: u64,
    pub total_seconds: i64,
}

#[derive(Clone, Debug, Serialize)]
pub struct ProjectAnalyticsCard {
    pub ai: AttributionTotals,
    /// Compatibility aggregate for both AI actor states.
    pub ai_inferred: AttributionTotals,
    pub ai_verified: AttributionTotals,
    pub attribution_coverage_percent: Option<f64>,
    pub estimated_spend: EstimatedSpend,
    pub human: AttributionTotals,
    pub last_activity_at: Option<String>,
    pub name: String,
    pub project_id: Uuid,
    pub prompts: Option<u64>,
    pub repository: Option<String>,
    pub sessions: Option<u64>,
    pub tokens: TokenTotals,
    pub total_seconds: i64,
    /// Canonical Unknown bucket. `unattributed` below is retained as a response alias.
    pub unknown: UnattributedTotals,
    /// Deprecated compatibility alias for `unknown`.
    pub unattributed: UnattributedTotals,
}

#[derive(Clone, Debug, Serialize)]
pub struct AttributionTotals {
    pub changes: u64,
    pub lines_added: u64,
    pub lines_deleted: u64,
    pub percentage: Option<f64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct UnattributedTotals {
    pub changes: u64,
    pub lines_added: u64,
    pub lines_deleted: u64,
    pub percentage_of_observed: Option<f64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct TokenTotals {
    pub cache_read: Option<u64>,
    pub cache_write: Option<u64>,
    pub coverage_percent: Option<f64>,
    pub input: Option<u64>,
    pub output: Option<u64>,
    pub total: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct EstimatedSpend {
    pub amount_microusd: Option<u64>,
    pub coverage_percent: Option<f64>,
    pub currency: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ProjectAnalyticsDetailResponse {
    pub ai: ProjectAiSummary,
    pub branches: Vec<ProjectBranchItem>,
    pub daily_activity: Vec<ProjectDailyItem>,
    pub data_version: u64,
    pub editors: Vec<ProjectBreakdownItem>,
    pub generated_at: String,
    pub languages: Vec<ProjectBreakdownItem>,
    pub project: ProjectIdentity,
    pub range: ProjectRangeInfo,
    pub schema_version: u32,
    pub summary: ProjectSummary,
    pub top_files: Vec<ProjectFileItem>,
}

#[derive(Debug, Serialize)]
pub struct ProjectIdentity {
    pub name: String,
    pub project_id: Uuid,
    pub repository: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectRangeInfo {
    #[serde(flatten)]
    pub range: RangeInfo,
    pub branch: String,
}

#[derive(Debug, Serialize)]
pub struct ProjectSummary {
    pub active_days: u32,
    pub all_projects_seconds: i64,
    pub last_activity_at: Option<String>,
    pub project_seconds: i64,
}

#[derive(Debug, Serialize)]
pub struct ProjectAiSummary {
    pub ai_lines: u64,
    pub ai_inferred_lines: u64,
    pub ai_percentage: Option<f64>,
    pub attribution_coverage_percent: Option<f64>,
    pub estimated_spend: EstimatedSpend,
    pub human_lines: u64,
    pub ai_verified_lines: u64,
    pub prompts: Option<u64>,
    pub prompts_per_session: Option<f64>,
    pub sessions: Option<u64>,
    pub tokens: TokenTotals,
    pub unknown_lines: Option<u64>,
    /// Deprecated compatibility alias for `unknown_lines`.
    pub unattributed_lines: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ProjectDailyItem {
    pub ai_added: u64,
    pub ai_deleted: u64,
    pub ai_inferred_added: u64,
    pub ai_inferred_deleted: u64,
    pub ai_verified_added: u64,
    pub ai_verified_deleted: u64,
    pub date: String,
    pub human_added: u64,
    pub human_deleted: u64,
    pub total_seconds: i64,
    pub unknown_added: Option<u64>,
    pub unknown_deleted: Option<u64>,
    /// Deprecated compatibility aliases for the Unknown bucket.
    pub unattributed_added: Option<u64>,
    pub unattributed_deleted: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ProjectBreakdownItem {
    pub name: String,
    pub percentage: f64,
    pub total_seconds: i64,
}

#[derive(Debug, Serialize)]
pub struct ProjectBranchItem {
    pub ai_changes: u64,
    pub ai_inferred_changes: u64,
    pub ai_verified_changes: u64,
    pub branch: String,
    pub heartbeat_count: u64,
    pub human_changes: u64,
    pub total_seconds: i64,
    pub unknown_changes: Option<u64>,
    /// Deprecated compatibility alias for `unknown_changes`.
    pub unattributed_changes: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ProjectFileItem {
    pub ai_changes: u64,
    pub ai_inferred_changes: u64,
    pub ai_verified_changes: u64,
    pub display_name: String,
    pub entity_key: String,
    pub human_changes: u64,
    pub language: String,
    pub path: String,
    pub percentage_of_project: f64,
    pub total_seconds: i64,
    pub unknown_changes: Option<u64>,
    /// Deprecated compatibility alias for `unknown_changes`.
    pub unattributed_changes: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ProjectFilesResponse {
    pub attribution_coverage_percent: Option<f64>,
    pub data_version: u64,
    pub generated_at: String,
    pub items: Vec<ProjectFileItem>,
    pub metric: &'static str,
    pub next_cursor: Option<String>,
    pub other_seconds: i64,
    pub project_total_seconds: i64,
    pub range: ProjectRangeInfo,
    pub schema_version: u32,
    pub unit: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ProjectBranchesResponse {
    pub attribution_coverage_percent: Option<f64>,
    pub data_version: u64,
    pub generated_at: String,
    pub items: Vec<ProjectBranchItem>,
    pub next_cursor: Option<String>,
    pub other_seconds: i64,
    pub range: ProjectRangeInfo,
    pub schema_version: u32,
}

#[derive(Debug, Serialize)]
pub struct ProjectDailyResponse {
    pub attribution_coverage_percent: Option<f64>,
    pub data_version: u64,
    pub generated_at: String,
    pub items: Vec<ProjectDailyItem>,
    pub range: ProjectRangeInfo,
    pub schema_version: u32,
}

#[derive(Debug, Serialize)]
pub struct ProjectAiResponse {
    pub data_version: u64,
    pub data: ProjectAiSummary,
    pub generated_at: String,
    pub range: ProjectRangeInfo,
    pub schema_version: u32,
}

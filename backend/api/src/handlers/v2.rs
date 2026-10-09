//! AtoAxis API v2 contracts.
//!
//! v1 keeps the WakaTime-compatible response shapes. v2 uses a stable `data`/`meta`
//! envelope and exposes AtoAxis-specific capability and AI coverage metadata without
//! leaking source code, prompts or model responses.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, post, put},
    Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::{Duration, NaiveDate, Utc};
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;
use wakaclock_core::queue::{DeliveryQueueSnapshot, QueueReadStatus};

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::ai_stats::AiStatsData;
use crate::model::async_job::AsyncJobView;
use crate::model::billing::{Invoice, OrganizationBilling};
use crate::model::date_range::ResolvedRange;
use crate::model::export::{CreateExportRequest, ExportJob};
use crate::model::follow_up::{HumanFollowUpEventRequest, HumanFollowUpStats};
use crate::model::goal::{CreateGoalRequest, Goal, GoalProgress, UpdateGoalRequest};
use crate::model::integration::{
    CreateIntegrationRequest, IntegrationConnection, IntegrationProvider,
};
use crate::model::leaderboard::{
    CreateLeaderboardRequest, Leaderboard, LeaderboardMember, LeaderboardMemberRequest,
};
use crate::model::organization::{
    AcceptedOrganizationInvite, AddOrganizationMemberRequest, AddOrganizationTeamMemberRequest,
    CreateOrganizationRequest, CreateOrganizationTeamRequest, InviteOrganizationMemberRequest,
    Organization, OrganizationAnalytics, OrganizationAnalyticsSharing, OrganizationMember,
    OrganizationTeam, OrganizationTeamMember, OrganizationUserInvite, UpdateOrganizationRequest,
};
use crate::model::profile::{
    CreateShareLinkRequest, PublicProfile, ShareLink, UpdateProfileRequest,
};
use crate::model::report::{CreateReportScheduleRequest, ReportSchedule};

mod team_github;
mod team_insights;
mod team_webhooks;
mod work_sessions;

const WAKATIME_ROUTE_INVENTORY: &str = include_str!("../../../../wakatime-api-routes.json");
const WAKATIME_COMPATIBILITY_MANIFEST: &str =
    include_str!("../../../../docs/wakatime-compatibility-manifest.json");
const PHASE10_FEATURE_MATRIX: &str = include_str!("../../../../docs/phase-10-feature-matrix.json");

#[derive(Debug, Serialize)]
pub struct V2Meta {
    pub request_id: Uuid,
    pub generated_at: String,
    pub timezone: String,
    pub data_freshness: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coverage: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct V2Envelope<T> {
    pub data: T,
    pub meta: V2Meta,
}

#[derive(Debug, Deserialize)]
pub struct RangeQuery {
    pub start: Option<String>,
    pub end: Option<String>,
    pub timezone: Option<String>,
    pub project_id: Option<Uuid>,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AccountDeletionConfirmation {
    pub confirm: bool,
}

#[derive(Debug, Serialize)]
pub struct CapabilityData {
    pub api_version: &'static str,
    pub delivery_snapshot_versions: Vec<u8>,
    pub capture_activity_versions: Vec<u8>,
    pub capture_status_supported: bool,
    pub team_weekly_aggregates_supported: bool,
    pub team_measurement_health_supported: bool,
    pub session_context_versions: Vec<u8>,
    pub team_github_certification: &'static str,
    pub product: &'static str,
    pub transactional_store: &'static str,
    pub analytics_store: &'static str,
    pub postgres_enabled: bool,
    pub presence_v2_available: bool,
    pub privacy: PrivacyCapabilities,
    pub clients: ClientCapabilities,
    pub features: Vec<FeatureCapability>,
    pub line_metric_versions: Vec<LineMetricVersionCapability>,
    pub wakatime_routes: Vec<WakaTimeRouteCapability>,
}

#[derive(Debug, Serialize)]
pub struct LineMetricVersionCapability {
    pub version: &'static str,
    pub status: &'static str,
}

#[derive(Debug, Serialize)]
pub struct PrivacyCapabilities {
    pub stores_source_code: bool,
    pub stores_prompts: bool,
    pub stores_responses: bool,
    pub stores_prompt_lengths: bool,
}

#[derive(Debug, Serialize)]
pub struct ClientCapabilities {
    pub vscode: &'static str,
    pub wakatime_protocol: &'static str,
    pub desktop_tracker: &'static str,
    pub browser_extensions: &'static str,
}

#[derive(Debug, Serialize)]
pub struct FeatureCapability {
    pub available: bool,
    pub key: String,
    pub status: String,
    pub api: String,
}

#[derive(Debug, Serialize)]
pub struct WakaTimeRouteCapability {
    pub method: String,
    pub route: String,
    pub section: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
struct CompatibilityManifest {
    routes: Vec<CompatibilityRoute>,
}

#[derive(Debug, Deserialize)]
struct CompatibilityRoute {
    method: String,
    path: String,
    status: String,
}

#[derive(Debug, Deserialize)]
struct FeatureMatrix {
    features: Vec<FeatureMatrixEntry>,
}

#[derive(Debug, Deserialize)]
struct FeatureMatrixEntry {
    key: String,
    status: String,
    api: String,
}

#[derive(Debug, Serialize)]
pub struct AiEffectivenessData {
    pub stats: AiStatsData,
    pub metrics: AiEffectivenessMetrics,
    pub metrics_v2: crate::model::ai_stats::EffectivenessMetricsV2,
    pub legacy_metrics_deprecated: bool,
}

#[derive(Debug, Serialize)]
pub struct AiEffectivenessMetrics {
    pub ai_line_share: f64,
    pub human_line_share: f64,
    pub unknown_line_share: f64,
    pub prompt_character_count: Option<u64>,
    pub tokens_per_ai_line: Option<f64>,
    pub cost_per_ai_line_microusd: Option<f64>,
    pub human_follow_up_rate: Option<f64>,
    pub coverage: AiCoverage,
}

#[derive(Debug, Serialize)]
pub struct AiCoverage {
    pub attributed_line_changes: u64,
    pub line_change_denominator: u64,
    pub line_attribution: &'static str,
    pub unknown_line_changes: u64,
    pub token_usage: &'static str,
    pub prompt_length: &'static str,
    pub human_follow_up: &'static str,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsData {
    pub summary: Value,
}

#[derive(Debug, Serialize)]
pub struct MeasurementQualityDay {
    pub date: String,
    pub status: &'static str,
    pub total_seconds: f64,
    pub proven_seconds: f64,
    pub inferred_seconds: f64,
    pub active_seconds: Option<f64>,
    pub active_coverage: Option<&'static str>,
    pub heartbeat_count: u64,
    pub reason: Option<&'static str>,
}

#[derive(Debug, Serialize)]
pub struct MeasurementQualityData {
    pub start: String,
    pub end: String,
    pub timezone: String,
    pub calculation_version: &'static str,
    pub timeout_seconds: f64,
    pub total_seconds: f64,
    pub proven_seconds: f64,
    pub inferred_seconds: f64,
    pub attribution_coverage: crate::model::ai_stats::AiStatsCoverage,
    pub attribution_date_basis: &'static str,
    pub delivery_status: &'static str,
    pub project_id: Option<Uuid>,
    pub line_metric_coverage: Vec<LineMetricCoverage>,
    pub days: Vec<MeasurementQualityDay>,
}

#[derive(Debug, Serialize)]
pub struct LineMetricCoverage {
    pub version: String,
    pub status: String,
    pub reason: Option<&'static str>,
    pub heartbeats: u64,
    pub ai_line_changes: u64,
    pub human_line_changes: u64,
    pub unknown_line_changes: u64,
    pub line_change_denominator: u64,
    pub line_coverage_percent: Option<f64>,
    pub ai_verified_heartbeats: u64,
    pub ai_inferred_heartbeats: u64,
    pub human_heartbeats: u64,
    pub unknown_heartbeats: u64,
}

#[derive(Debug, Deserialize, Row)]
struct OperationEvidenceRow {
    time: f64,
    entity: String,
    session_id: Option<String>,
    ai_event_id: Option<String>,
    ai_change_id: Option<String>,
    heartbeat_id: Option<String>,
    ai_agent: Option<String>,
    ai_provider: Option<String>,
    ai_model: Option<String>,
    identity_reason: Option<String>,
    identity_source: Option<String>,
    effective_actor_type: String,
    ai_lines_added: Option<u32>,
    ai_lines_deleted: Option<u32>,
    revision: u32,
    row_key: String,
}

#[derive(Debug, Serialize)]
pub struct OperationEvidence {
    pub event_id: String,
    /// Stable opaque key for a metadata-only repair candidate. Unlike the signed
    /// pagination cursor it contains no source data and does not change by revision.
    pub repair_reference: String,
    pub occurred_at: f64,
    pub actor: String,
    pub agent: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub identity_reason: Option<&'static str>,
    pub identity_source: Option<&'static str>,
    pub lines_added: Option<u32>,
    pub lines_deleted: Option<u32>,
    pub revision: u32,
}

#[derive(Debug, Serialize)]
pub struct OperationEvidencePage {
    pub date_basis: &'static str,
    pub has_more: bool,
    pub next_cursor: Option<String>,
    pub operations: Vec<OperationEvidence>,
}

#[derive(Debug, Serialize)]
pub struct OrganizationMeasurement {
    pub start: String,
    pub end: String,
    pub timezone: String,
    pub status: &'static str,
    pub consenting_members: usize,
    pub total_seconds: Option<f64>,
    pub proven_seconds: Option<f64>,
    pub inferred_seconds: Option<f64>,
    pub attributed_line_changes: u64,
    pub line_change_denominator: u64,
    pub individual: Vec<IndividualMeasurement>,
    pub small_team_inference_warning: bool,
}

#[derive(Debug, Serialize)]
pub struct IndividualMeasurement {
    pub user_id: Uuid,
    pub total_seconds: f64,
    pub attributed_line_changes: u64,
    pub line_change_denominator: u64,
}

#[derive(Debug, Serialize)]
pub struct OrganizationAnalyticsData {
    #[serde(flatten)]
    pub membership: OrganizationAnalytics,
    pub measurement: OrganizationMeasurement,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StartWakaTimeImport {
    pub import_id: Uuid,
    pub total_chunks: i32,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WakaTimeImportChunk {
    pub dump_json: String,
    #[serde(default)]
    pub confirm_legacy_ambiguity: bool,
}

#[derive(Debug, Serialize)]
pub struct WakaTimeImportChunkPreview {
    pub chunk_index: i32,
    pub digest: String,
    pub valid_heartbeats: usize,
    pub invalid_heartbeats: usize,
    pub possible_legacy_duplicates: usize,
    pub legacy_scan_limited: bool,
    pub requires_confirmation: bool,
}

#[derive(Debug, Serialize)]
pub struct WakaTimeImportJob {
    pub id: Uuid,
    pub total_chunks: i32,
    pub received_chunks: Vec<i32>,
    pub imported_heartbeats: i64,
    pub skipped_heartbeats: i64,
    pub possible_legacy_duplicates: i64,
    pub legacy_scan_limited_chunks: i64,
    pub confirmed_legacy_ambiguity_chunks: i64,
    pub issue_counts: std::collections::BTreeMap<String, i64>,
    pub before_total_seconds: f64,
    pub before_calculation_version: String,
    pub after_total_seconds: Option<f64>,
    pub after_calculation_version: Option<String>,
    pub net_change_seconds: Option<f64>,
    pub completed: bool,
}

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/team/webhooks/github", post(team_webhooks::github))
        .route("/me/session-context/capability", get(team_github::capability))
        .route("/me/github/oauth/callback", post(team_github::callback))
        .route("/organizations/:organization_id/integrations/github", get(team_github::status).delete(team_github::disconnect))
        .route("/organizations/:organization_id/integrations/github/authorize", post(team_github::start))
        .route("/organizations/:organization_id/integrations/github/installations", get(team_github::installations))
        .route("/organizations/:organization_id/integrations/github/installations/:installation_id/repositories", get(team_github::repositories))
        .route("/organizations/:organization_id/integrations/github/repositories", put(team_github::select))
        .route("/organizations/:organization_id/integrations/github/work-items", get(team_github::work_page))
        .route("/organizations/:organization_id/integrations/github/sync", post(team_github::sync))
        .route("/organizations/:organization_id/me/github/project-bindings", get(team_github::projects).put(team_github::binding))
        .route("/organizations/:organization_id/me/github/session-context", post(team_github::context))
        .route("/organizations/:organization_id/me/github/suggestions", get(team_github::suggestions))
        .route("/organizations/:organization_id/measurement-health", get(team_insights::measurement_health))
        .route("/organizations/:organization_id/launch-readiness", get(team_insights::readiness))
        .route("/organizations/:organization_id/work-items/:repository_id/:work_item_id/receipt", get(team_insights::receipt))
        .route("/organizations/:organization_id/insights", get(team_insights::insights))
        .route("/organizations/:organization_id/exports/team.csv", get(team_insights::export))
        .route("/organizations/:organization_id/me/consent", get(team_insights::consent))
        .route("/organizations/:organization_id/work-items", get(team_insights::work_items))
        .route("/organizations/:organization_id/me/session-links", get(team_insights::links).post(team_insights::propose))
        .route("/organizations/:organization_id/me/session-links/:link_id", put(team_insights::decide))
        .route("/capabilities", get(capabilities))
        .route("/me", get(me).delete(account_delete))
        .route("/me/analytics", get(analytics))
        .route("/me/measurement-quality", get(measurement_quality))
        .route("/me/ai/operation-evidence", get(operation_evidence))
        .route(
            "/me/measurement-repairs",
            get(list_measurement_repairs).post(start_measurement_repair),
        )
        .route("/me/measurement-repairs/:repair_id", get(get_measurement_repair))
        .route(
            "/me/measurement-repairs/:repair_id/apply",
            post(apply_measurement_repair),
        )
        .route(
            "/me/measurement-repairs/:repair_id/rollback",
            post(rollback_measurement_repair),
        )
        .route(
            "/me/delivery-status",
            get(delivery_status).post(ingest_delivery_status),
        )
        .route("/imports/wakatime", post(wakatime_import_start))
        .route("/imports/wakatime/:import_id", get(wakatime_import_status))
        .route(
            "/imports/wakatime/:import_id/chunks/:chunk_index",
            put(wakatime_import_chunk),
        )
        .route(
            "/imports/wakatime/:import_id/chunks/:chunk_index/preview",
            post(wakatime_import_chunk_preview),
        )
        .route(
            "/imports/wakatime/:import_id/complete",
            post(wakatime_import_complete),
        )
        .route(
            "/me/presence/rooms",
            get(crate::handlers::presence_v2::list_rooms),
        )
        .route(
            "/me/presence/heartbeat",
            post(crate::handlers::presence_v2::heartbeat),
        )
        .route(
            "/me/presence/status",
            get(crate::handlers::presence_v2::get_status)
                .put(crate::handlers::presence_v2::set_status)
                .delete(crate::handlers::presence_v2::clear_status),
        )
        .route(
            "/me/presence/focus",
            get(crate::handlers::presence_v2::get_focus)
                .put(crate::handlers::presence_v2::set_focus)
                .delete(crate::handlers::presence_v2::clear_focus),
        )
        .route(
            "/me/coworking-sessions",
            get(crate::handlers::presence_v2::history),
        )
        .route(
            "/presence/rooms",
            post(crate::handlers::presence_v2::create_room),
        )
        .route(
            "/presence/rooms/:room_id",
            get(crate::handlers::presence_v2::get_room),
        )
        .route(
            "/presence/invites/resolve",
            post(crate::handlers::presence_v2::resolve_invite),
        )
        .route(
            "/presence/rooms/:room_id/join",
            post(crate::handlers::presence_v2::join_room),
        )
        .route(
            "/presence/rooms/:room_id/leave",
            post(crate::handlers::presence_v2::leave_room),
        )
        .route(
            "/presence/rooms/:room_id/end",
            post(crate::handlers::presence_v2::end_room),
        )
        .route(
            "/presence/rooms/:room_id/me",
            put(crate::handlers::presence_v2::update_member),
        )
        .route(
            "/presence/rooms/:room_id/stream-ticket",
            post(crate::handlers::presence_v2::create_stream_ticket),
        )
        .route(
            "/presence/rooms/:room_id/stream",
            get(crate::handlers::presence_v2::stream_presence),
        )
        .route(
            "/presence/rooms/:room_id/invites",
            get(crate::handlers::presence_v2::list_invites)
                .post(crate::handlers::presence_v2::create_invite),
        )
        .route(
            "/presence/rooms/:room_id/invites/:invite_id",
            delete(crate::handlers::presence_v2::revoke_invite),
        )
        .route("/presence/history/summary", get(crate::handlers::presence_v2::office::personal_summary))
        .route("/presence/rooms/:room_id/office", get(crate::handlers::presence_v2::office::snapshot).post(crate::handlers::presence_v2::office::command))
        .route("/presence/rooms/:room_id/messages", get(crate::handlers::presence_v2::office::messages))
        .route("/presence/rooms/:room_id/media-token", post(crate::handlers::presence_v2::office::media_token))
        .route("/me/ai/effectiveness", get(ai_effectiveness))
        .route("/ai/follow-up-events", post(follow_up_event))
        .route("/ai/follow-up", get(follow_up_stats))
        .route("/me/goals", get(goals_list).post(goals_create))
        .route(
            "/me/goals/:goal_id",
            get(goals_get).patch(goals_update).delete(goals_delete),
        )
        .route("/me/goals/:goal_id/progress", get(goals_progress))
        .route("/exports", get(exports_list).post(exports_create))
        .route("/exports/:export_id", get(exports_get).delete(exports_cancel))
        .route("/jobs/:job_id", get(jobs_get))
        .route("/profile", get(profile_get).patch(profile_update))
        .route("/share-links", get(share_links_list).post(share_links_create))
        .route("/share-links/:link_id", delete(share_links_delete))
        .route("/integrations/providers", get(integration_providers))
        .route(
            "/integrations/:provider/connect",
            post(integration_connect),
        )
        .route("/integrations", get(integrations_list))
        .route("/integrations/:integration_id/status", get(integration_status))
        .route("/integrations/:integration_id/sync", post(integration_sync))
        .route("/integrations/:integration_id", delete(integration_disconnect))
        .route(
            "/vcs/:provider/connect",
            post(crate::handlers::vcs::connect),
        )
        .route("/repositories", get(crate::handlers::vcs::repositories))
        .route(
            "/repositories/:repository_id/project-mapping",
            post(crate::handlers::vcs::project_mapping),
        )
        .route("/commits", get(crate::handlers::vcs::commits))
        .route(
            "/commits/analytics",
            get(crate::handlers::vcs::commit_analytics),
        )
        .route("/pull-requests", get(crate::handlers::vcs::pull_requests))
        .route(
            "/pull-requests/:pull_request_id/analytics",
            get(crate::handlers::vcs::pull_request_analytics),
        )
        .route(
            "/organizations",
            get(organizations_list).post(organizations_create),
        )
        .route(
            "/organizations/:organization_id",
            get(organization_get).patch(organization_update),
        )
        .route(
            "/organizations/:organization_id/members",
            get(organization_members).post(organization_add_member),
        )
        .route(
            "/organizations/:organization_id/members/:member_user_id",
            delete(organization_remove_member),
        )
        .route(
            "/organizations/:organization_id/invites",
            get(organization_invites).post(organization_invite_member),
        )
        .route(
            "/organizations/:organization_id/invites/:invite_id",
            delete(organization_revoke_invite),
        )
        .route("/me/organization-invites", get(my_organization_invites))
        .route(
            "/me/organization-invites/:invite_id/accept",
            post(accept_organization_invite),
        )
        .route(
            "/me/organization-invites/:invite_id/decline",
            post(decline_organization_invite),
        )
        .route(
            "/organizations/:organization_id/teams",
            get(organization_teams).post(organization_create_team),
        )
        .route(
            "/organizations/:organization_id/teams/:team_id/members",
            get(organization_team_members).post(organization_add_team_member),
        )
        .route(
            "/organizations/:organization_id/teams/:team_id/members/:member_user_id",
            delete(organization_remove_team_member),
        )
        .route(
            "/organizations/:organization_id/analytics",
            get(organization_analytics),
        )
        .route(
            "/organizations/:organization_id/me/sharing",
            get(organization_analytics_sharing).put(organization_analytics_sharing_update),
        )
        .route(
            "/organizations/:organization_id/presence/summary",
            get(crate::handlers::presence_v2::organization_summary),
        )
        .route(
            "/organizations/:organization_id/presence/heatmap",
            get(crate::handlers::presence_v2::organization_heatmap),
        )
        .route("/organizations/:organization_id/ai", get(organization_analytics))
        .route(
            "/organizations/:organization_id/sso",
            get(crate::handlers::enterprise::sso_get)
                .post(crate::handlers::enterprise::sso_upsert),
        )
        .route(
            "/organizations/:organization_id/sso/:connection_id/enforce",
            post(crate::handlers::enterprise::sso_enforce),
        )
        .route(
            "/organizations/:organization_id/scim-tokens",
            get(crate::handlers::enterprise::scim_tokens_list)
                .post(crate::handlers::enterprise::scim_tokens_create),
        )
        .route(
            "/organizations/:organization_id/scim-tokens/:token_id",
            delete(crate::handlers::enterprise::scim_tokens_revoke),
        )
        .route(
            "/organizations/:organization_id/audit-logs",
            get(organization_audit_logs),
        )
        .route(
            "/organizations/:organization_id/billing",
            get(organization_billing),
        )
        .route(
            "/organizations/:organization_id/invoices",
            get(organization_invoices),
        )
        .route(
            "/leaderboards",
            get(leaderboards_list).post(leaderboards_create),
        )
        .route("/leaderboards/:leaderboard_id", get(leaderboard_get))
        .route(
            "/leaderboards/:leaderboard_id/members",
            get(leaderboard_members).post(leaderboard_add_member),
        )
        .route(
            "/leaderboards/:leaderboard_id/members/:member_user_id",
            delete(leaderboard_remove_member),
        )
        .route(
            "/report-schedules",
            get(report_schedules_list).post(report_schedules_create),
        )
        .route("/report-schedules/:schedule_id", delete(report_schedules_delete))
        .route(
            "/developer/apps",
            get(crate::handlers::oauth::list_apps).post(crate::handlers::oauth::register_app),
        )
        .route(
            "/developer/apps/:client_id",
            delete(crate::handlers::oauth::revoke_app),
        )
        // v2 alias keeps API-key rotation discoverable alongside OAuth app management;
        // the underlying handler is session-only and returns the plaintext exactly once.
        .route(
            "/api-keys",
            get(crate::handlers::v1::api_key::current)
                .post(crate::handlers::v1::api_key::generate)
                .delete(crate::handlers::v1::api_key::revoke),
        )
        .route("/me/work-sessions", get(work_sessions::list))
        .route("/me/work-sessions/:id", get(work_sessions::detail))
        .route("/me/work-sessions/:id/evidence", get(work_sessions::evidence))
        .route("/me/work-sessions/:id/outcome", put(work_sessions::set_outcome).delete(work_sessions::clear_outcome))
        .with_state(app_state)
}

/// Public capability discovery endpoint used by clients and the plugin directory.
///
/// These capabilities describe the currently shipped product surface, not merely the
/// database columns or HTTP routes that happen to exist.  In particular, a route backed
/// by a queued row but without a registered worker must stay unavailable; advertising it
/// as ready would make clients submit work that can never finish.
const RUNTIME_DISABLED_FEATURES: &[&str] = &[
    // These features remain outside the first Production Core cutover until their
    // processors/providers are implemented and independently certified.
    crate::services::RuntimeFeature::DailyWeeklyMonthlyReports.key(),
    crate::services::RuntimeFeature::CalendarIntegrations.key(),
    crate::services::RuntimeFeature::PublicProfilesAndEmbeds.key(),
    crate::services::RuntimeFeature::PrivateLeaderboards.key(),
    crate::services::RuntimeFeature::SsoOidcSaml.key(),
    crate::services::RuntimeFeature::Scim.key(),
    crate::services::RuntimeFeature::SeatBillingEntitlements.key(),
];

fn feature_available(
    key: &str,
    postgres: bool,
    export_available: bool,
    account_deletion_available: bool,
) -> bool {
    if RUNTIME_DISABLED_FEATURES.contains(&key) {
        return false;
    }

    match key {
        "ai_human_follow_up" | "organization_analytics" => false,
        "ai_human_follow_up_events" | "work_session_receipts" => true,
        "data_exports" => export_available && postgres,
        "postgres_transactional_store"
        | "personal_organizations"
        | "goals_crud"
        | "oauth_pkce_and_device_flow"
        | "git_commit_pr_analytics"
        | "resumable_wakatime_import"
        | "delivery_queue_status"
        | "measurement_repair" => postgres,
        "complete_history"
        | "heartbeat_ingestion"
        | "wakatime_protocol"
        | "wakatime_rest_compatibility"
        | "atoaxis_v2_envelope"
        | "ai_line_attribution"
        | "ai_tokens_and_cost"
        | "ai_prompt_length"
        | "measurement_trust_center"
        | "ai_operation_evidence"
        | "oauth_scope_enforcement"
        | "desktop_tracker"
        | "browser_extensions"
        | "language_registry_600_plus"
        | "external_durations" => true,
        "account_deletion" => account_deletion_available && postgres,
        // New matrix entries must opt in explicitly once their runtime contract
        // and dependency health are implemented. A new key must never become
        // available merely because it was added to the documentation JSON.
        _ => false,
    }
}

fn feature_runtime_status(
    key: &str,
    declared_status: &str,
    postgres: bool,
    export_available: bool,
    account_deletion_available: bool,
) -> String {
    if RUNTIME_DISABLED_FEATURES.contains(&key) {
        "disabled".to_string()
    } else if !feature_available(key, postgres, export_available, account_deletion_available) {
        "unavailable".to_string()
    } else {
        declared_status.to_string()
    }
}

pub async fn capabilities(State(state): State<Arc<AppState>>) -> Json<V2Envelope<CapabilityData>> {
    let inventory: Value = serde_json::from_str(WAKATIME_ROUTE_INVENTORY)
        .expect("wakatime-api-routes.json must remain valid JSON");
    let compatibility: CompatibilityManifest =
        serde_json::from_str(WAKATIME_COMPATIBILITY_MANIFEST)
            .expect("wakatime-compatibility-manifest.json must remain valid JSON");
    let features: FeatureMatrix = serde_json::from_str(PHASE10_FEATURE_MATRIX)
        .expect("phase-10-feature-matrix.json must remain valid JSON");
    let account_deletion_available = state.account_deletion_service.request_mode_enabled()
        && state.account_deletion_service.processor_ready();
    let routes = inventory
        .get("documented_routes")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|route| {
            let method = route.get("method")?.as_str()?.to_string();
            let path = route.get("route")?.as_str()?.to_string();
            Some(WakaTimeRouteCapability {
                status: compatibility_route_status(&compatibility, &method, &path),
                method,
                route: path,
                section: route.get("section")?.as_str()?.to_string(),
            })
        })
        .collect();

    Json(envelope(
        CapabilityData {
            api_version: "2",
            delivery_snapshot_versions: vec![1, 2],
            capture_activity_versions: vec![2],
            capture_status_supported: true,
            team_weekly_aggregates_supported: state.config.team_enabled && state.postgres.is_some(),
            team_measurement_health_supported: state.postgres.is_some(),
            session_context_versions: if state.config.team_enabled && state.postgres.is_some() {
                vec![1]
            } else {
                vec![]
            },
            team_github_certification: "staging_certification_pending",
            product: "AtoAxis",
            transactional_store: if state.postgres.is_some() {
                "postgresql"
            } else {
                "clickhouse-compatibility-mode"
            },
            analytics_store: "clickhouse",
            postgres_enabled: state.postgres.is_some(),
            presence_v2_available: state.config.presence_v2_enabled
                && state.postgres.is_some()
                && state.redis_presence.is_some(),
            privacy: PrivacyCapabilities {
                stores_source_code: false,
                stores_prompts: false,
                stores_responses: false,
                stores_prompt_lengths: true,
            },
            clients: ClientCapabilities {
                vscode: "production",
                wakatime_protocol: "compatible",
                desktop_tracker: "privacy-policy-skeleton",
                browser_extensions: "webextension-core",
            },
            features: features
                .features
                .into_iter()
                .map(|feature| {
                    let feature_enabled = (feature.key != "measurement_repair"
                        || state.config.measurement_repair_enabled)
                        && (feature.key != "work_session_receipts"
                            || state.config.work_sessions_enabled);
                    FeatureCapability {
                        available: feature_enabled
                            && feature_available(
                                &feature.key,
                                state.postgres.is_some(),
                                state.export_service.capability_available(),
                                account_deletion_available,
                            ),
                        status: if !feature_enabled {
                            "disabled".to_string()
                        } else {
                            feature_runtime_status(
                                &feature.key,
                                &feature.status,
                                state.postgres.is_some(),
                                state.export_service.capability_available(),
                                account_deletion_available,
                            )
                        },
                        key: feature.key,
                        api: feature.api,
                    }
                })
                .collect(),
            line_metric_versions: vec![
                LineMetricVersionCapability {
                    version: "editor-before-after-v1",
                    status: if state.config.editor_line_metrics_enabled {
                        "supported"
                    } else {
                        "disabled"
                    },
                },
                LineMetricVersionCapability {
                    version: "manual-repair-v1",
                    status: if state.config.measurement_repair_enabled {
                        "owner_supplied_correction"
                    } else {
                        "disabled"
                    },
                },
            ],
            wakatime_routes: routes,
        },
        "UTC",
        None,
    ))
}

pub async fn me(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let user = state
        .user_service
        .get_current(user_id)
        .await
        .map_err(ApiError::internal)?;
    Ok(Json(envelope(
        serde_json::to_value(user).map_err(ApiError::internal)?,
        "UTC",
        None,
    )))
}

/// DELETE /api/v2/me — start the account deletion workflow.
///
/// This is session-only and requires an explicit JSON confirmation. The handler
/// returns after the PostgreSQL tombstone and system job/outbox have committed;
/// the dedicated worker performs cross-store cleanup before the final delete.
pub async fn account_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<AccountDeletionConfirmation>,
) -> Result<(StatusCode, Json<V2Envelope<Value>>), ApiError> {
    let user_id = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if !input.confirm {
        return Err(ApiError::bad_request("confirm must be true"));
    }
    let job = state
        .account_deletion_service
        .request(user_id)
        .await
        .map_err(|error| {
            let message = error.to_string();
            if message.contains("not enabled") || message.contains("requires") {
                ApiError::service_unavailable("account deletion is unavailable")
            } else if message.contains("not found") {
                ApiError::not_found("account not found")
            } else if message.contains("already unavailable") {
                ApiError::conflict("account deletion is already in progress")
            } else {
                tracing::error!(%error, "failed to enqueue account deletion");
                ApiError::service_unavailable("account deletion could not be queued")
            }
        })?;
    Ok((
        StatusCode::ACCEPTED,
        Json(envelope(
            json!({
                "job_id": job.id,
                "processing_state": "pending",
            }),
            "UTC",
            None,
        )),
    ))
}

pub async fn analytics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RangeQuery>,
) -> Result<Json<V2Envelope<AnalyticsData>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_stats").await?;
    let (start, end) = resolve_range(query.start, query.end, query.timezone.as_deref())?;
    let summary = state
        .summary_service
        .get_range_in_timezone(user_id, &start, &end, query.timezone.as_deref())
        .await
        .map_err(ApiError::internal)?;
    Ok(Json(envelope(
        AnalyticsData {
            summary: serde_json::to_value(summary).map_err(ApiError::internal)?,
        },
        query.timezone.as_deref().unwrap_or("UTC"),
        None,
    )))
}

/// Reuses the canonical summary calculation; this endpoint does not reconstruct
/// duration from raw heartbeats or silently treat a day without events as idle.
pub async fn measurement_quality(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RangeQuery>,
) -> Result<Json<V2Envelope<MeasurementQualityData>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_stats").await?;
    require_scope(&state, &headers, "read_ai_analytics").await?;
    let (start, end) = resolve_range(query.start, query.end, query.timezone.as_deref())?;
    let range = ResolvedRange::parse(&start, &end, query.timezone.as_deref())
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let project = resolve_project_filter(&state, user_id, query.project_id).await?;
    let line_metric_coverage =
        fetch_line_metric_coverage(&state, user_id, &range, project.as_ref())
            .await
            .map_err(ApiError::internal)?;
    let mut data = if let Some(project) = project.as_ref() {
        let timeline = state
            .project_analytics_service
            .measurement_timeline(user_id, project.id, &range)
            .await
            .map_err(|error| {
                if error.to_string().contains("project not found") {
                    ApiError::not_found("project not found")
                } else {
                    ApiError::internal(error)
                }
            })?;
        let summary = state
            .summary_service
            .get_range_in_timezone(user_id, &start, &end, query.timezone.as_deref())
            .await
            .map_err(ApiError::internal)?;
        let coverage = coverage_from_metric_groups(&line_metric_coverage, "editor-before-after-v1")
            .or_else(|| coverage_from_metric_groups(&line_metric_coverage, "legacy_unversioned"))
            .unwrap_or_else(empty_project_coverage);
        let mut data = build_measurement_quality(summary, coverage);
        data.days = timeline
            .days
            .into_iter()
            .map(|day| MeasurementQualityDay {
                date: day.date,
                status: if day.heartbeat_count == 0 {
                    "no_observation"
                } else {
                    "observed"
                },
                total_seconds: day.total_seconds,
                proven_seconds: day.proven_seconds,
                inferred_seconds: day.inferred_seconds,
                active_seconds: day.active_seconds,
                active_coverage: Some(day.active_coverage),
                heartbeat_count: day.heartbeat_count,
                reason: (day.heartbeat_count == 0).then_some("no_heartbeat_is_not_proof_of_idle"),
            })
            .collect();
        data.total_seconds = data.days.iter().map(|day| day.total_seconds).sum();
        data.proven_seconds = data.days.iter().map(|day| day.proven_seconds).sum();
        data.inferred_seconds = data.days.iter().map(|day| day.inferred_seconds).sum();
        data.calculation_version = timeline.calculation_version;
        data.timeout_seconds = timeline.timeout_seconds;
        data.attribution_date_basis = "heartbeat_timestamp_in_requested_timezone";
        data.project_id = Some(project.id);
        data
    } else {
        let summary = state
            .summary_service
            .get_range_in_timezone(user_id, &start, &end, query.timezone.as_deref())
            .await
            .map_err(ApiError::internal)?;
        let stats = state
            .ai_stats_service
            .get_range_in_timezone(user_id, &start, &end, query.timezone.as_deref())
            .await
            .map_err(ApiError::internal)?;
        let measured_coverage =
            coverage_from_metric_groups(&line_metric_coverage, "editor-before-after-v1").or_else(
                || coverage_from_metric_groups(&line_metric_coverage, "legacy_unversioned"),
            );
        let coverage = measured_coverage.unwrap_or(stats.data.coverage);
        let mut data = build_measurement_quality(summary, coverage);
        data.attribution_date_basis = "heartbeat_timestamp_in_requested_timezone";
        data.project_id = None;
        data
    };
    data.line_metric_coverage = line_metric_coverage;
    let timezone = range.timezone.to_string();
    Ok(Json(envelope(data, &timezone, None)))
}

/// Receive a metadata-only queue snapshot from one CLI/editor installation.
/// Authentication determines the account; client payloads cannot select another owner.
pub async fn ingest_delivery_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(snapshot): Json<DeliveryQueueSnapshot>,
) -> Result<StatusCode, ApiError> {
    let user_id = require_scope(&state, &headers, "write_logged_time").await?;
    validate_delivery_snapshot(&snapshot)?;
    state
        .delivery_status_service
        .record(user_id, snapshot)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(StatusCode::NO_CONTENT)
}

/// Read only the caller's latest per-device/per-queue delivery snapshots.
pub async fn delivery_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<crate::model::delivery_status::DeliveryStatusResponse>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_stats").await?;
    let now = Utc::now();
    let entries = state
        .delivery_status_service
        .latest(user_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    let devices = entries
        .into_iter()
        .map(|entry| crate::model::delivery_status::DeliveryStatusDevice::from_received(entry, now))
        .collect();
    Ok(Json(envelope(
        crate::model::delivery_status::DeliveryStatusResponse {
            devices,
            storage: state.delivery_status_service.storage_mode(),
        },
        "UTC",
        None,
    )))
}

/// Create an owner-scoped metadata preview for historical AI line corrections.
pub async fn start_measurement_repair(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<crate::model::measurement_repair::StartMeasurementRepair>,
) -> Result<Json<V2Envelope<crate::model::measurement_repair::MeasurementRepairJobView>>, ApiError>
{
    let user_id = require_scope(&state, &headers, "write_logged_time").await?;
    require_measurement_repair_enabled(&state)?;
    let view = state
        .measurement_repair_service
        .create_preview(user_id, request)
        .await
        .map_err(measurement_repair_error)?;
    let timezone = view.timezone.clone();
    Ok(Json(envelope(view, &timezone, None)))
}

/// List the caller's most recent measurement repair previews and audit history.
pub async fn list_measurement_repairs(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<
    Json<V2Envelope<Vec<crate::model::measurement_repair::MeasurementRepairJobView>>>,
    ApiError,
> {
    let user_id = require_scope(&state, &headers, "read_ai_analytics").await?;
    require_measurement_repair_enabled(&state)?;
    let jobs = state
        .measurement_repair_service
        .list(user_id)
        .await
        .map_err(measurement_repair_error)?;
    Ok(Json(envelope(jobs, "UTC", None)))
}

/// Read one repair job. The service always includes the authenticated owner in lookup.
pub async fn get_measurement_repair(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(repair_id): Path<Uuid>,
) -> Result<Json<V2Envelope<crate::model::measurement_repair::MeasurementRepairJobView>>, ApiError>
{
    let user_id = require_scope(&state, &headers, "read_ai_analytics").await?;
    require_measurement_repair_enabled(&state)?;
    let view = state
        .measurement_repair_service
        .get(user_id, repair_id)
        .await
        .map_err(measurement_repair_error)?;
    let timezone = view.timezone.clone();
    Ok(Json(envelope(view, &timezone, None)))
}

/// Applying a correction is a first-party, session-only action.
pub async fn apply_measurement_repair(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(repair_id): Path<Uuid>,
) -> Result<Json<V2Envelope<crate::model::measurement_repair::MeasurementRepairJobView>>, ApiError>
{
    let user_id = require_session_scope(&state, &headers, "write_logged_time").await?;
    require_measurement_repair_enabled(&state)?;
    let view = state
        .measurement_repair_service
        .apply(user_id, repair_id)
        .await
        .map_err(measurement_repair_error)?;
    let timezone = view.timezone.clone();
    Ok(Json(envelope(view, &timezone, None)))
}

/// Rollback appends a new correction revision and also requires the owner's session.
pub async fn rollback_measurement_repair(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(repair_id): Path<Uuid>,
) -> Result<Json<V2Envelope<crate::model::measurement_repair::MeasurementRepairJobView>>, ApiError>
{
    let user_id = require_session_scope(&state, &headers, "write_logged_time").await?;
    require_measurement_repair_enabled(&state)?;
    let view = state
        .measurement_repair_service
        .rollback(user_id, repair_id)
        .await
        .map_err(measurement_repair_error)?;
    let timezone = view.timezone.clone();
    Ok(Json(envelope(view, &timezone, None)))
}

async fn require_session_scope(
    state: &AppState,
    headers: &HeaderMap,
    scope: &'static str,
) -> Result<Uuid, ApiError> {
    let context = auth::resolve_context(state, headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if context.kind != auth::CredentialKind::Session {
        return Err(ApiError::forbidden_scope("session"));
    }
    if !context.allows(scope) {
        return Err(ApiError::forbidden_scope(scope));
    }
    Ok(context.user_id)
}

fn measurement_repair_error(error: anyhow::Error) -> ApiError {
    let message = error.to_string();
    if message.contains("not found") {
        ApiError::not_found(message)
    } else if message.contains("conflict") {
        ApiError::conflict(message)
    } else if message.contains("requires PostgreSQL") {
        ApiError::service_unavailable(message)
    } else if message.contains("invalid")
        || message.contains("requires 1 to")
        || message.contains("cannot exceed")
        || message.contains("must be")
        || message.contains("must have")
    {
        ApiError::bad_request(message)
    } else {
        ApiError::service_unavailable(message)
    }
}

fn validate_delivery_snapshot(snapshot: &DeliveryQueueSnapshot) -> Result<(), ApiError> {
    const MAX_COUNTER: u32 = 1_000_000;
    const MAX_SEQUENCE: u64 = 9_000_000_000_000_000_000;
    let now = Utc::now();
    if ![1, 2].contains(&snapshot.schema_version)
        || snapshot.device_id.trim().is_empty()
        || snapshot.device_id.len() > 128
        || !snapshot.device_id.is_ascii()
        || snapshot.device_id.chars().any(char::is_whitespace)
        || snapshot.queue_id.len() != 64
        || !snapshot
            .queue_id
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        || snapshot.sequence > MAX_SEQUENCE
        || snapshot.captured_at > now + Duration::minutes(5)
    {
        return Err(ApiError::bad_request("invalid delivery status snapshot"));
    }
    match snapshot.read_status {
        QueueReadStatus::Unavailable => {
            if snapshot.pending.is_some()
                || snapshot.retry.is_some()
                || snapshot.dead_letter.is_some()
                || snapshot.oldest_pending_at.is_some()
                || snapshot.details.is_some()
            {
                return Err(ApiError::bad_request(
                    "unavailable queue snapshots must not contain counts",
                ));
            }
        }
        QueueReadStatus::Available => {
            let (Some(pending), Some(retry), Some(dead_letter)) =
                (snapshot.pending, snapshot.retry, snapshot.dead_letter)
            else {
                return Err(ApiError::bad_request(
                    "available queue snapshots require all counters",
                ));
            };
            if pending > MAX_COUNTER
                || retry > MAX_COUNTER
                || dead_letter > MAX_COUNTER
                || (pending == 0 && snapshot.oldest_pending_at.is_some())
                || (pending > 0 && snapshot.oldest_pending_at.is_none())
            {
                return Err(ApiError::bad_request(
                    "delivery status counters are invalid",
                ));
            }
        }
    }
    if snapshot.schema_version == 1 && snapshot.details.is_some() {
        return Err(ApiError::bad_request(
            "v1 snapshots cannot contain v2 details",
        ));
    }
    if snapshot.schema_version == 2 && snapshot.read_status == QueueReadStatus::Available {
        let details = snapshot
            .details
            .as_ref()
            .ok_or_else(|| ApiError::bad_request("v2 snapshots require queue details"))?;
        if details.eligible.saturating_add(details.leased) > snapshot.pending.unwrap_or(0)
            || details.accepted_total > MAX_SEQUENCE
            || details.backlog_error.as_ref().is_some_and(|error| {
                ![
                    "auth_401",
                    "payment_402",
                    "network",
                    "validation",
                    "server_error",
                    "other",
                ]
                .contains(&error.kind.as_str())
                    || error.message_code.len() > 80
                    || !error
                        .message_code
                        .bytes()
                        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
                    || error
                        .http_status
                        .is_some_and(|status| !(400..=599).contains(&status))
                    || error.failed_at > snapshot.captured_at
            })
        {
            return Err(ApiError::bad_request("invalid delivery queue details"));
        }
    }
    if snapshot
        .oldest_pending_at
        .is_some_and(|value| value > snapshot.captured_at)
        || snapshot
            .last_successful_delivery_at
            .is_some_and(|value| value > snapshot.captured_at)
    {
        return Err(ApiError::bad_request(
            "delivery timestamps cannot be later than captured_at",
        ));
    }
    if let Some(capture) = &snapshot.capture {
        if snapshot.schema_version != 2
            || capture.schema_version != 1
            || !["fresh", "unavailable", "parser_failure", "disabled"]
                .contains(&capture.status.as_str())
            || capture.pending > MAX_COUNTER
            || capture.parser_errors > MAX_COUNTER
            || capture.captured_at > now + Duration::minutes(5)
            || capture
                .last_scan_success_at
                .is_some_and(|v| v > capture.captured_at)
        {
            return Err(ApiError::bad_request("invalid capture health snapshot"));
        }
    }
    Ok(())
}

fn build_measurement_quality(
    summary: crate::model::summary::SummariesResponse,
    attribution_coverage: crate::model::ai_stats::AiStatsCoverage,
) -> MeasurementQualityData {
    let mut total_seconds = 0.0;
    let mut proven_seconds = 0.0;
    let mut inferred_seconds = 0.0;
    let days = summary
        .days
        .into_iter()
        .map(|day| {
            let total = day.grand_total;
            total_seconds += total.total_seconds;
            proven_seconds += total.evidence.proven_seconds;
            inferred_seconds += total.evidence.inferred_seconds;
            MeasurementQualityDay {
                date: day.date,
                status: if total.heartbeats == 0 {
                    "no_observation"
                } else {
                    "observed"
                },
                total_seconds: total.total_seconds,
                proven_seconds: total.evidence.proven_seconds,
                inferred_seconds: total.evidence.inferred_seconds,
                active_seconds: total.active_seconds,
                active_coverage: total.active_coverage,
                heartbeat_count: total.heartbeats,
                reason: (total.heartbeats == 0).then_some("no_heartbeat_is_not_proof_of_idle"),
            }
        })
        .collect();
    MeasurementQualityData {
        start: summary.start,
        end: summary.end,
        timezone: summary.calculation.timezone,
        calculation_version: summary.calculation.calculation_version,
        timeout_seconds: summary.calculation.timeout_seconds,
        total_seconds,
        proven_seconds,
        inferred_seconds,
        attribution_coverage,
        // AI stats currently bucket by the stored heartbeat date, not by the
        // requested display timezone. Keep this limitation visible to clients.
        attribution_date_basis: "stored_heartbeat_date",
        // A server read cannot inspect an offline queue on the user's machine.
        delivery_status: "client_status_unavailable",
        project_id: None,
        line_metric_coverage: Vec::new(),
        days,
    }
}

struct TrustProjectFilter {
    id: Uuid,
    names: Vec<String>,
}

async fn resolve_project_filter(
    state: &AppState,
    user_id: Uuid,
    project_id: Option<Uuid>,
) -> Result<Option<TrustProjectFilter>, ApiError> {
    let Some(project_id) = project_id else {
        return Ok(None);
    };
    let names = state
        .project_identity_service
        .owned_project_names(user_id, project_id)
        .await
        .map_err(ApiError::internal)?
        .ok_or_else(|| ApiError::not_found("project not found"))?;
    Ok(Some(TrustProjectFilter {
        id: project_id,
        names,
    }))
}

#[derive(Debug, Deserialize, Row)]
struct LineMetricCoverageRow {
    version: String,
    status: String,
    reason: Option<String>,
    heartbeats: u64,
    ai_line_changes: u64,
    human_line_changes: u64,
    unknown_line_changes: u64,
    ai_verified_heartbeats: u64,
    ai_inferred_heartbeats: u64,
    human_heartbeats: u64,
    unknown_heartbeats: u64,
}

async fn fetch_line_metric_coverage(
    state: &AppState,
    user_id: Uuid,
    range: &ResolvedRange,
    project: Option<&TrustProjectFilter>,
) -> anyhow::Result<Vec<LineMetricCoverage>> {
    let (start, end) = range.unix_bounds();
    let filter = if project.is_some() {
        "h.user_id = ? AND h.time >= ? AND h.time < ? AND \
         (h.project_id = ? OR (h.project_id IS NULL AND h.project IN ?))"
    } else {
        "h.user_id = ? AND h.time >= ? AND h.time < ?"
    };
    let relation = crate::repository::canonical::canonical_winner_relation(filter, "h");
    let effective_actor = crate::services::ai_stats::effective_actor_type_expr();
    let sql = format!(
        "SELECT
            coalesce(nullIf(h.line_metric_version, ''), 'legacy_unversioned') AS version,
            ifNull(nullIf(h.line_measurement_status, ''),
                ifNull(nullIf(h.line_metric_version, ''), 'unversioned')) AS status,
            nullIf(h.line_measurement_reason, '') AS reason,
            count() AS heartbeats,
            sumIf(toUInt64(ifNull(h.ai_lines_added, 0) + ifNull(h.ai_lines_deleted, 0)),
                h.effective_actor_type IN ('ai_verified', 'ai_inferred')) AS ai_line_changes,
            sumIf(toUInt64(ifNull(h.human_lines_added, 0) + ifNull(h.human_lines_deleted, 0)),
                h.effective_actor_type = 'human') AS human_line_changes,
            sum(toUInt64(ifNull(h.unattributed_lines_added, 0) + ifNull(h.unattributed_lines_deleted, 0)))
                + sumIf(toUInt64(ifNull(h.ai_lines_added, 0) + ifNull(h.ai_lines_deleted, 0)
                    + ifNull(h.human_lines_added, 0) + ifNull(h.human_lines_deleted, 0)),
                    h.effective_actor_type = 'unknown')
                + sumIf(toUInt64(ifNull(h.human_lines_added, 0) + ifNull(h.human_lines_deleted, 0)),
                    h.effective_actor_type IN ('ai_verified', 'ai_inferred')) AS unknown_line_changes,
            countIf(h.effective_actor_type = 'ai_verified') AS ai_verified_heartbeats,
            countIf(h.effective_actor_type = 'ai_inferred') AS ai_inferred_heartbeats,
            countIf(h.effective_actor_type = 'human') AS human_heartbeats,
            countIf(h.effective_actor_type = 'unknown') AS unknown_heartbeats
         FROM (
            SELECT h.*, {effective_actor} AS effective_actor_type FROM {relation}
         ) AS h
         GROUP BY version, status, reason
         ORDER BY version ASC, status ASC, reason ASC"
    );
    let mut query = state
        .clickhouse
        .get_client()
        .query(&sql)
        .bind(user_id)
        .bind(start)
        .bind(end);
    if let Some(project) = project {
        query = query.bind(project.id).bind(&project.names);
    }
    let rows = query.fetch_all::<LineMetricCoverageRow>().await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            let version = match row.version.as_str() {
                "editor-before-after-v1" | "legacy_unversioned" | "manual-repair-v1" => row.version,
                _ => "unknown_version".to_string(),
            };
            let status = match row.status.as_str() {
                "measured" | "unavailable" | "unversioned" | "user_repaired" => row.status,
                _ => "unknown".to_string(),
            };
            let attributed = row.ai_line_changes.saturating_add(row.human_line_changes);
            let denominator = attributed.saturating_add(row.unknown_line_changes);
            LineMetricCoverage {
                version,
                status,
                reason: row.reason.as_deref().and_then(line_measurement_reason),
                heartbeats: row.heartbeats,
                ai_line_changes: row.ai_line_changes,
                human_line_changes: row.human_line_changes,
                unknown_line_changes: row.unknown_line_changes,
                line_change_denominator: denominator,
                line_coverage_percent: (denominator > 0)
                    .then(|| attributed as f64 * 100.0 / denominator as f64),
                ai_verified_heartbeats: row.ai_verified_heartbeats,
                ai_inferred_heartbeats: row.ai_inferred_heartbeats,
                human_heartbeats: row.human_heartbeats,
                unknown_heartbeats: row.unknown_heartbeats,
            }
        })
        .collect())
}

fn line_measurement_reason(reason: &str) -> Option<&'static str> {
    match reason {
        "baseline_missing" => Some("baseline_missing"),
        "document_unavailable" => Some("document_unavailable"),
        "document_too_large" => Some("document_too_large"),
        "version_discontinuity" => Some("version_discontinuity"),
        "diff_budget_exceeded" => Some("diff_budget_exceeded"),
        "user_supplied_correction" => Some("user_supplied_correction"),
        _ => None,
    }
}

fn coverage_from_metric_groups(
    groups: &[LineMetricCoverage],
    version: &str,
) -> Option<crate::model::ai_stats::AiStatsCoverage> {
    use crate::model::ai_stats::AiCoverageStatus;
    let matching = groups.iter().filter(|group| group.version == version);
    let mut coverage = crate::model::ai_stats::AiStatsCoverage {
        attributed_line_changes: 0,
        ai_inferred_heartbeats: 0,
        ai_verified_heartbeats: 0,
        heartbeat_denominator: 0,
        human_heartbeats: 0,
        line_change_denominator: 0,
        line_coverage_percent: None,
        status: AiCoverageStatus::NoActivity,
        unknown_heartbeats: 0,
        unknown_line_changes: 0,
    };
    let mut found = false;
    for group in matching {
        found = true;
        coverage.attributed_line_changes = coverage
            .attributed_line_changes
            .saturating_add(group.ai_line_changes)
            .saturating_add(group.human_line_changes);
        coverage.ai_verified_heartbeats = coverage
            .ai_verified_heartbeats
            .saturating_add(group.ai_verified_heartbeats);
        coverage.ai_inferred_heartbeats = coverage
            .ai_inferred_heartbeats
            .saturating_add(group.ai_inferred_heartbeats);
        coverage.human_heartbeats = coverage
            .human_heartbeats
            .saturating_add(group.human_heartbeats);
        coverage.unknown_heartbeats = coverage
            .unknown_heartbeats
            .saturating_add(group.unknown_heartbeats);
        coverage.heartbeat_denominator = coverage
            .heartbeat_denominator
            .saturating_add(group.heartbeats);
        coverage.unknown_line_changes = coverage
            .unknown_line_changes
            .saturating_add(group.unknown_line_changes);
    }
    if !found {
        return None;
    }
    coverage.line_change_denominator = coverage
        .attributed_line_changes
        .saturating_add(coverage.unknown_line_changes);
    coverage.line_coverage_percent = (coverage.line_change_denominator > 0).then(|| {
        coverage.attributed_line_changes as f64 * 100.0 / coverage.line_change_denominator as f64
    });
    coverage.status = if coverage.heartbeat_denominator == 0 {
        AiCoverageStatus::NoActivity
    } else if coverage.unknown_heartbeats > 0 || coverage.unknown_line_changes > 0 {
        AiCoverageStatus::Partial
    } else {
        AiCoverageStatus::Complete
    };
    Some(coverage)
}

fn empty_project_coverage() -> crate::model::ai_stats::AiStatsCoverage {
    crate::model::ai_stats::AiStatsCoverage {
        attributed_line_changes: 0,
        ai_inferred_heartbeats: 0,
        ai_verified_heartbeats: 0,
        heartbeat_denominator: 0,
        human_heartbeats: 0,
        line_change_denominator: 0,
        line_coverage_percent: None,
        status: crate::model::ai_stats::AiCoverageStatus::NoActivity,
        unknown_heartbeats: 0,
        unknown_line_changes: 0,
    }
}

pub async fn operation_evidence(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RangeQuery>,
) -> Result<Json<V2Envelope<OperationEvidencePage>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_ai_analytics").await?;
    let (start, end) = resolve_range(query.start, query.end, query.timezone.as_deref())?;
    let range = ResolvedRange::parse(&start, &end, query.timezone.as_deref())
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let project = resolve_project_filter(&state, user_id, query.project_id).await?;
    let (start_epoch, end_epoch) = range.unix_bounds();
    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let cursor = query
        .cursor
        .as_deref()
        .map(|token| {
            decode_operation_evidence_cursor(
                token,
                &state.config.jwt_secret,
                user_id,
                &start,
                &end,
                &range.timezone.to_string(),
                query.project_id,
            )
        })
        .transpose()?;
    let filter = if project.is_some() {
        "h.user_id = ? AND h.time >= ? AND h.time < ? AND \
         (h.project_id = ? OR (h.project_id IS NULL AND h.project IN ?))"
    } else {
        "h.user_id = ? AND h.time >= ? AND h.time < ?"
    };
    let relation = crate::repository::canonical::canonical_winner_relation(filter, "h");
    let effective_actor = crate::services::ai_stats::effective_actor_type_expr();
    // The key is a one-way digest of internal operation metadata. It gives rows with
    // equal timestamps a deterministic keyset order without putting file paths in the
    // signed page cursor.
    let row_key_expr = "lower(hex(SHA256(concat(
        toString(length(ifNull(h.session_id, ''))), ':', ifNull(h.session_id, ''),
        toString(length(coalesce(nullIf(h.ai_event_id, ''), nullIf(h.ai_change_id, ''), nullIf(h.heartbeat_id, ''), ''))), ':',
            coalesce(nullIf(h.ai_event_id, ''), nullIf(h.ai_change_id, ''), nullIf(h.heartbeat_id, ''), ''),
        toString(length(h.entity)), ':', h.entity
    ))))";
    let cursor_filter = cursor
        .as_ref()
        .map(|_| " AND (h.time < ? OR (h.time = ? AND h.row_key > ?))")
        .unwrap_or("");
    let sql = format!(
        "SELECT h.time, h.entity, h.session_id, h.ai_event_id, h.ai_change_id, \
         h.heartbeat_id, h.ai_agent, h.ai_provider, h.ai_model, h.identity_reason, \
         h.identity_source, h.effective_actor_type, h.ai_lines_added, \
         h.ai_lines_deleted, h.revision, h.row_key FROM ( \
         SELECT h.*, {effective_actor} AS effective_actor_type, {row_key_expr} AS row_key FROM {relation} \
         ) AS h WHERE (length(ifNull(h.ai_event_id, '')) > 0 \
         OR length(ifNull(h.ai_change_id, '')) > 0) \
         {cursor_filter} ORDER BY h.time DESC, h.row_key ASC LIMIT {}",
        limit + 1
    );
    let mut request = state
        .clickhouse
        .get_client()
        .query(&sql)
        .bind(user_id)
        .bind(start_epoch)
        .bind(end_epoch);
    if let Some(project) = project.as_ref() {
        request = request.bind(project.id).bind(&project.names);
    }
    if let Some(cursor) = cursor.as_ref() {
        request = request
            .bind(cursor.last_time)
            .bind(cursor.last_time)
            .bind(&cursor.last_row_key);
    }
    let mut rows = request
        .fetch_all::<OperationEvidenceRow>()
        .await
        .map_err(ApiError::internal)?;
    let has_more = rows.len() > limit;
    rows.truncate(limit);
    let next_cursor = if has_more {
        rows.last()
            .map(|row| {
                encode_operation_evidence_cursor(
                    &state.config.jwt_secret,
                    OperationEvidenceCursor {
                        user_id,
                        start: start.clone(),
                        end: end.clone(),
                        timezone: range.timezone.to_string(),
                        project_id: query.project_id,
                        last_time: row.time,
                        last_row_key: row.row_key.clone(),
                        expires_at: Utc::now().timestamp() + 30 * 60,
                    },
                )
            })
            .transpose()?
    } else {
        None
    };
    let operations = rows
        .into_iter()
        .map(|row| operation_evidence_from_row(user_id, row))
        .collect();
    Ok(Json(envelope(
        OperationEvidencePage {
            date_basis: "heartbeat_timestamp_in_requested_timezone",
            has_more,
            next_cursor,
            operations,
        },
        range.timezone.to_string().as_str(),
        None,
    )))
}

#[derive(Debug, Serialize, Deserialize)]
struct OperationEvidenceCursor {
    user_id: Uuid,
    start: String,
    end: String,
    timezone: String,
    project_id: Option<Uuid>,
    last_time: f64,
    last_row_key: String,
    expires_at: i64,
}

fn encode_operation_evidence_cursor(
    secret: &str,
    cursor: OperationEvidenceCursor,
) -> Result<String, ApiError> {
    let payload = serde_json::to_vec(&cursor).map_err(ApiError::internal)?;
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes());
    let signature = ring::hmac::sign(&key, &payload);
    let token = format!(
        "{}.{}",
        URL_SAFE_NO_PAD.encode(payload),
        URL_SAFE_NO_PAD.encode(signature.as_ref())
    );
    Ok(URL_SAFE_NO_PAD.encode(token))
}

fn decode_operation_evidence_cursor(
    token: &str,
    secret: &str,
    user_id: Uuid,
    start: &str,
    end: &str,
    timezone: &str,
    project_id: Option<Uuid>,
) -> Result<OperationEvidenceCursor, ApiError> {
    let invalid = || ApiError::bad_request("operation evidence cursor is invalid; reload the list");
    let raw = URL_SAFE_NO_PAD.decode(token).map_err(|_| invalid())?;
    let raw = String::from_utf8(raw).map_err(|_| invalid())?;
    let (payload, signature) = raw.split_once('.').ok_or_else(invalid)?;
    let payload = URL_SAFE_NO_PAD.decode(payload).map_err(|_| invalid())?;
    let signature = URL_SAFE_NO_PAD.decode(signature).map_err(|_| invalid())?;
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes());
    ring::hmac::verify(&key, &payload, &signature).map_err(|_| invalid())?;
    let cursor: OperationEvidenceCursor =
        serde_json::from_slice(&payload).map_err(|_| invalid())?;
    if cursor.expires_at <= Utc::now().timestamp() {
        return Err(ApiError::conflict(
            "operation evidence cursor expired; reload the list",
        ));
    }
    if cursor.user_id != user_id
        || cursor.start != start
        || cursor.end != end
        || cursor.timezone != timezone
        || cursor.project_id != project_id
        || !cursor.last_time.is_finite()
        || cursor.last_row_key.len() != 64
    {
        return Err(invalid());
    }
    Ok(cursor)
}

fn operation_evidence_from_row(user_id: Uuid, row: OperationEvidenceRow) -> OperationEvidence {
    let mut hasher = Sha256::new();
    for part in [
        user_id.to_string().as_str(),
        row.session_id.as_deref().unwrap_or_default(),
        row.ai_event_id
            .as_deref()
            .or(row.ai_change_id.as_deref())
            .or(row.heartbeat_id.as_deref())
            .unwrap_or_default(),
        &row.entity,
    ] {
        hasher.update((part.len() as u64).to_le_bytes());
        hasher.update(part.as_bytes());
    }
    let verified = row.effective_actor_type == "ai_verified";
    OperationEvidence {
        event_id: format!("{:x}", hasher.finalize()),
        repair_reference: row.row_key,
        occurred_at: row.time,
        actor: row.effective_actor_type,
        agent: verified.then_some(row.ai_agent).flatten(),
        provider: verified.then_some(row.ai_provider).flatten(),
        model: verified.then_some(row.ai_model).flatten(),
        identity_reason: match row.identity_reason.as_deref() {
            Some("missing_agent") => Some("missing_agent"),
            Some("missing_provider") => Some("missing_provider"),
            Some("missing_model") => Some("missing_model"),
            Some("context_unavailable") => Some("context_unavailable"),
            Some("conflicting_evidence") => Some("conflicting_evidence"),
            _ => None,
        },
        identity_source: match row.identity_source.as_deref() {
            Some("agent_hook") => Some("agent_hook"),
            Some("mcp") => Some("mcp"),
            Some("structured_mcp") => Some("structured_mcp"),
            Some("transcript") => Some("transcript"),
            _ => None,
        },
        lines_added: verified.then_some(row.ai_lines_added).flatten(),
        lines_deleted: verified.then_some(row.ai_lines_deleted).flatten(),
        revision: row.revision,
    }
}

pub async fn ai_effectiveness(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RangeQuery>,
) -> Result<Json<V2Envelope<AiEffectivenessData>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_ai_analytics").await?;
    let (start, end) = resolve_range(query.start, query.end, query.timezone.as_deref())?;
    let stats = state
        .ai_stats_service
        .get_range_in_timezone(user_id, &start, &end, query.timezone.as_deref())
        .await
        .map_err(ApiError::internal)?;

    let ai_lines = (stats.data.total_ai_lines_added + stats.data.total_ai_lines_deleted) as f64;
    let human_lines =
        (stats.data.total_human_lines_added + stats.data.total_human_lines_deleted) as f64;
    let unknown_lines = stats.data.coverage.unknown_line_changes as f64;
    let total_lines = stats.data.coverage.line_change_denominator as f64;
    let ai_line_share = if total_lines > 0.0 {
        ai_lines / total_lines
    } else {
        0.0
    };

    let total_heartbeats = stats.data.total_heartbeats;
    let stats_data = stats.data;
    let stats_coverage = stats_data.coverage.clone();
    let coverage = if total_heartbeats == 0 {
        "no_data"
    } else if stats_data.coverage.status == crate::model::ai_stats::AiCoverageStatus::Partial {
        "partial_line_attribution"
    } else {
        "complete_line_attribution"
    };
    let reported_tokens = stats_data
        .total_input_tokens
        .zip(stats_data.total_output_tokens)
        .map(|(input, output)| input.saturating_add(output));
    let tokens_per_ai_line =
        crate::model::ai_stats::measured_ratio(reported_tokens, ai_lines as u64);
    let cost_per_ai_line_microusd = crate::model::ai_stats::measured_ratio(
        stats_data.total_estimated_cost_microusd,
        ai_lines as u64,
    );
    let prompt_character_count = stats_data.total_prompt_characters;
    let usage_coverage = stats_data.usage_coverage.clone();
    let token_status = if usage_coverage.event_count == 0 {
        "no_data"
    } else if usage_coverage.input_tokens.reported_events == 0
        && usage_coverage.output_tokens.reported_events == 0
    {
        "unavailable"
    } else if usage_coverage.input_tokens.status == "complete"
        && usage_coverage.output_tokens.status == "complete"
    {
        "complete"
    } else {
        "partial"
    };
    let metrics_v2 = crate::model::ai_stats::EffectivenessMetricsV2::new(
        ai_lines as u64,
        human_lines as u64,
        unknown_lines as u64,
        total_lines as u64,
    );

    Ok(Json(envelope(
        AiEffectivenessData {
            metrics_v2,
            legacy_metrics_deprecated: true,
            stats: stats_data,
            metrics: AiEffectivenessMetrics {
                ai_line_share,
                human_line_share: if total_lines > 0.0 {
                    human_lines / total_lines
                } else {
                    0.0
                },
                unknown_line_share: if total_lines > 0.0 {
                    unknown_lines / total_lines
                } else {
                    0.0
                },
                prompt_character_count,
                tokens_per_ai_line,
                cost_per_ai_line_microusd,
                human_follow_up_rate: None,
                coverage: AiCoverage {
                    attributed_line_changes: stats_coverage.attributed_line_changes,
                    line_change_denominator: stats_coverage.line_change_denominator,
                    line_attribution: coverage,
                    unknown_line_changes: stats_coverage.unknown_line_changes,
                    token_usage: token_status,
                    prompt_length: usage_coverage.prompt_characters.status,
                    human_follow_up: "not_available_until_ai_change_ledger_is_enabled",
                },
            },
        },
        query.timezone.as_deref().unwrap_or("UTC"),
        Some(json!({
            "ai_stats": coverage,
            "tokens": token_status,
            "prompt_length": usage_coverage.prompt_characters.status,
            "usage": usage_coverage,
            "date_basis": "event_timestamp_in_requested_timezone",
            "range_end": "exclusive_after_local_end_date",
            "follow_up": "missing"
        })),
    )))
}

pub async fn follow_up_event(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<HumanFollowUpEventRequest>,
) -> Result<StatusCode, ApiError> {
    let user_id = require_scope(&state, &headers, "write_logged_time").await?;
    state
        .follow_up_service
        .record(user_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("must") || error.to_string().contains("invalid") {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn follow_up_stats(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RangeQuery>,
) -> Result<Json<V2Envelope<HumanFollowUpStats>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_ai_analytics").await?;
    let (start_date, end_date) = resolve_range(query.start, query.end, query.timezone.as_deref())?;
    let range = ResolvedRange::parse(&start_date, &end_date, query.timezone.as_deref())
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let (start, end) = range.unix_bounds();
    let stats = state
        .follow_up_service
        .stats(user_id, start, end)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(
        stats,
        query.timezone.as_deref().unwrap_or("UTC"),
        Some(json!({ "denominator": "not_available_until_ai_change_ledger_is_synced" })),
    )))
}

pub async fn goals_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<Vec<Goal>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_goals").await?;
    let goals = state
        .goal_service
        .list_for_user(user_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(goals, "UTC", None)))
}

pub async fn goals_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateGoalRequest>,
) -> Result<(StatusCode, Json<V2Envelope<Goal>>), ApiError> {
    let user_id = require_scope(&state, &headers, "write_goals").await?;
    ensure_pg_identity(&state, user_id).await?;
    let goal = state
        .goal_service
        .create(user_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("unsupported")
                || error.to_string().contains("must")
                || error.to_string().contains("cannot")
            {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok((StatusCode::CREATED, Json(envelope(goal, "UTC", None))))
}

pub async fn goals_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(goal_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = require_scope(&state, &headers, "write_goals").await?;
    let deleted = state
        .goal_service
        .delete(user_id, goal_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found("goal not found"))
    }
}

pub async fn goals_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(goal_id): Path<Uuid>,
) -> Result<Json<V2Envelope<Goal>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_goals").await?;
    let goal = state
        .goal_service
        .get(user_id, goal_id)
        .await
        .map_err(ApiError::service_unavailable)?
        .ok_or_else(|| ApiError::not_found("goal not found"))?;
    Ok(Json(envelope(goal, "UTC", None)))
}

pub async fn goals_update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(goal_id): Path<Uuid>,
    Json(input): Json<UpdateGoalRequest>,
) -> Result<Json<V2Envelope<Goal>>, ApiError> {
    let user_id = require_scope(&state, &headers, "write_goals").await?;
    let goal = state
        .goal_service
        .update(user_id, goal_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("unsupported")
                || error.to_string().contains("must")
                || error.to_string().contains("cannot")
            {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?
        .ok_or_else(|| ApiError::not_found("goal not found"))?;
    Ok(Json(envelope(goal, "UTC", None)))
}

pub async fn goals_progress(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(goal_id): Path<Uuid>,
) -> Result<Json<V2Envelope<GoalProgress>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_goals").await?;
    let progress = state
        .goal_service
        .progress(user_id, goal_id)
        .await
        .map_err(ApiError::service_unavailable)?
        .ok_or_else(|| ApiError::not_found("goal not found"))?;
    let progress_status = if progress.coverage > 0.0 {
        "complete"
    } else {
        "empty"
    };
    Ok(Json(envelope(
        progress,
        "UTC",
        Some(json!({ "progress": progress_status })),
    )))
}

pub async fn exports_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateExportRequest>,
) -> Result<(StatusCode, Json<V2Envelope<ExportJob>>), ApiError> {
    let user_id = require_scope(&state, &headers, "export_data").await?;
    if !state.export_service.capability_available() {
        return Err(ApiError::service_unavailable(
            "export background processor is unavailable",
        ));
    }
    ensure_pg_identity(&state, user_id).await?;
    let idempotency_key = match headers.get("Idempotency-Key") {
        None => None,
        Some(value) => Some(
            value
                .to_str()
                .map_err(|_| ApiError::bad_request("Idempotency-Key must be ASCII"))?,
        ),
    };
    let job = state
        .export_service
        .create(user_id, input, idempotency_key)
        .await
        .map_err(|error| {
            let message = error.to_string();
            if message.contains("conflicts with existing") {
                ApiError::conflict(message)
            } else if message.contains("unsupported") || message.contains("Idempotency-Key") {
                ApiError::bad_request(message)
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok((StatusCode::ACCEPTED, Json(envelope(job, "UTC", None))))
}

pub async fn exports_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<Vec<ExportJob>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "export_data").await?;
    let jobs = state
        .export_service
        .list(user_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(jobs, "UTC", None)))
}

pub async fn exports_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(export_id): Path<Uuid>,
) -> Result<Json<V2Envelope<ExportJob>>, ApiError> {
    let user_id = require_scope(&state, &headers, "export_data").await?;
    let job = state
        .export_service
        .get(user_id, export_id)
        .await
        .map_err(ApiError::service_unavailable)?
        .ok_or_else(|| ApiError::not_found("export job not found"))?;
    Ok(Json(envelope(job, "UTC", None)))
}

pub async fn exports_cancel(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(export_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = require_scope(&state, &headers, "export_data").await?;
    if state
        .export_service
        .cancel(user_id, export_id)
        .await
        .map_err(ApiError::service_unavailable)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found(
            "export job not found or already finished",
        ))
    }
}

/// GET /api/v2/jobs/:job_id — the caller's own background job. Returns state and a
/// sanitized error code only; a job belonging to another account, or a system job,
/// is a 404.
///
/// Account-only, like `POST /api/v1/reprocess` that creates these jobs: a third-party
/// OAuth grant must not read job state (and, once R5 fills `result`, whatever it
/// carries). When export jobs land in R5 and an `export_data` grant legitimately needs
/// to poll, move this to a scope-per-`JobKind` check.
pub async fn jobs_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(job_id): Path<Uuid>,
) -> Result<Json<V2Envelope<AsyncJobView>>, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let job = state
        .job_service
        .get(user_id, job_id)
        .await
        .map_err(ApiError::service_unavailable)?
        .ok_or_else(|| ApiError::not_found("job not found"))?;
    Ok(Json(envelope(job, "UTC", None)))
}

pub async fn profile_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<PublicProfile>>, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let profile = state
        .profile_service
        .get_profile(user_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(profile, "UTC", None)))
}

pub async fn profile_update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<UpdateProfileRequest>,
) -> Result<Json<V2Envelope<PublicProfile>>, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    // Fail before touching PostgreSQL so a disabled public-profile surface
    // cannot mutate visibility or profile settings as a side effect.
    require_runtime_feature(crate::services::RuntimeFeature::PublicProfilesAndEmbeds)?;
    ensure_pg_identity(&state, user_id).await?;
    let profile = state
        .profile_service
        .update_profile(user_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("must") || error.to_string().contains("too long") {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok(Json(envelope(profile, "UTC", None)))
}

pub async fn share_links_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateShareLinkRequest>,
) -> Result<(StatusCode, Json<V2Envelope<ShareLink>>), ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    require_runtime_feature(crate::services::RuntimeFeature::PublicProfilesAndEmbeds)?;
    ensure_pg_identity(&state, user_id).await?;
    let link = state
        .profile_service
        .create_share_link(user_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("unsupported") || error.to_string().contains("expiry") {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok((StatusCode::CREATED, Json(envelope(link, "UTC", None))))
}

pub async fn share_links_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<Vec<ShareLink>>>, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let links = state
        .profile_service
        .list_share_links(user_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(links, "UTC", None)))
}

pub async fn share_links_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(link_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if state
        .profile_service
        .revoke_share_link(user_id, link_id)
        .await
        .map_err(ApiError::service_unavailable)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found(
            "share link not found or already revoked",
        ))
    }
}

pub async fn report_schedules_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateReportScheduleRequest>,
) -> Result<(StatusCode, Json<V2Envelope<ReportSchedule>>), ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    crate::services::require_background_processor().map_err(ApiError::service_unavailable)?;
    ensure_pg_identity(&state, user_id).await?;
    let schedule = state
        .report_service
        .create(user_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("must be") || error.to_string().contains("timezone") {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok((StatusCode::CREATED, Json(envelope(schedule, "UTC", None))))
}

pub async fn report_schedules_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<Vec<ReportSchedule>>>, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let schedules = state
        .report_service
        .list(user_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(schedules, "UTC", None)))
}

pub async fn report_schedules_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(schedule_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if state
        .report_service
        .delete(user_id, schedule_id)
        .await
        .map_err(ApiError::service_unavailable)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found("report schedule not found"))
    }
}

pub async fn integration_providers() -> Json<V2Envelope<Vec<IntegrationProvider>>> {
    Json(envelope(
        crate::services::integrations::IntegrationService::providers().to_vec(),
        "UTC",
        None,
    ))
}

pub async fn integration_connect(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(provider): Path<String>,
    Json(input): Json<CreateIntegrationRequest>,
) -> Result<(StatusCode, Json<V2Envelope<IntegrationConnection>>), ApiError> {
    let user_id = require_scope(&state, &headers, "manage_integrations").await?;
    crate::services::require_background_processor().map_err(ApiError::service_unavailable)?;
    ensure_pg_identity(&state, user_id).await?;
    let connection = state
        .integration_service
        .create(user_id, &provider, input)
        .await
        .map_err(|error| {
            let message = error.to_string();
            if message.contains("unsupported")
                || message.contains("must")
                || message.contains("base64")
                || message.contains("size")
                || message.contains("permission")
            {
                ApiError::bad_request(message)
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok((StatusCode::CREATED, Json(envelope(connection, "UTC", None))))
}

pub async fn integrations_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<Vec<IntegrationConnection>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "manage_integrations").await?;
    let connections = state
        .integration_service
        .list(user_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(connections, "UTC", None)))
}

pub async fn integration_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(integration_id): Path<Uuid>,
) -> Result<Json<V2Envelope<IntegrationConnection>>, ApiError> {
    let user_id = require_scope(&state, &headers, "manage_integrations").await?;
    let connection = state
        .integration_service
        .status(user_id, integration_id)
        .await
        .map_err(ApiError::service_unavailable)?
        .ok_or_else(|| ApiError::not_found("integration not found"))?;
    Ok(Json(envelope(connection, "UTC", None)))
}

pub async fn integration_sync(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(integration_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = require_scope(&state, &headers, "manage_integrations").await?;
    if state
        .integration_service
        .request_sync(user_id, integration_id)
        .await
        .map_err(ApiError::service_unavailable)?
    {
        Ok(StatusCode::ACCEPTED)
    } else {
        Err(ApiError::not_found("integration not found or disconnected"))
    }
}

pub async fn integration_disconnect(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(integration_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = require_scope(&state, &headers, "manage_integrations").await?;
    let provider = state
        .integration_service
        .disconnect(user_id, integration_id)
        .await
        .map_err(ApiError::service_unavailable)?
        .ok_or_else(|| ApiError::not_found("integration not found or already disconnected"))?;
    // WakaTime-compatible disconnect semantics: imported external durations belonging
    // to this connection are removed asynchronously from ClickHouse. The tombstone and
    // audit record stay in PostgreSQL; no event content is returned to the client.
    let _ = state
        .external_duration_service
        .delete_source(user_id, &provider)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn organizations_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<Vec<Organization>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_orgs").await?;
    let organizations = state
        .organizations_service
        .list_for_user(user_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(organizations, "UTC", None)))
}

pub async fn organizations_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateOrganizationRequest>,
) -> Result<(StatusCode, Json<V2Envelope<Organization>>), ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    ensure_pg_identity(&state, user_id).await?;
    let organization = state
        .organizations_service
        .create(user_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("organization")
                || error.to_string().contains("slug")
                || error.to_string().contains("duplicate")
            {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok((
        StatusCode::CREATED,
        Json(envelope(organization, "UTC", None)),
    ))
}

pub async fn organization_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<V2Envelope<Organization>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_orgs").await?;
    let organization = state
        .organizations_service
        .get(user_id, organization_id)
        .await
        .map_err(ApiError::service_unavailable)?
        .ok_or_else(|| ApiError::not_found("organization not found"))?;
    Ok(Json(envelope(organization, "UTC", None)))
}

pub async fn organization_update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(input): Json<UpdateOrganizationRequest>,
) -> Result<Json<V2Envelope<Organization>>, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let organization = state
        .organizations_service
        .update(user_id, organization_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("permission")
                || error.to_string().contains("must contain")
            {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?
        .ok_or_else(|| ApiError::not_found("organization not found"))?;
    Ok(Json(envelope(organization, "UTC", None)))
}

pub async fn organization_members(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<V2Envelope<Vec<OrganizationMember>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_org_members").await?;
    let members = state
        .organizations_service
        .members(user_id, organization_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(members, "UTC", None)))
}

pub async fn organization_add_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(input): Json<AddOrganizationMemberRequest>,
) -> Result<(StatusCode, Json<V2Envelope<OrganizationMember>>), ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let member = state
        .organizations_service
        .add_member(user_id, organization_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("invalid")
                || error.to_string().contains("not found")
                || error.to_string().contains("permission")
            {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok((StatusCode::CREATED, Json(envelope(member, "UTC", None))))
}

pub async fn organization_remove_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((organization_id, member_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if state
        .organizations_service
        .remove_member(user_id, organization_id, member_user_id)
        .await
        .map_err(ApiError::service_unavailable)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found("organization member not found"))
    }
}

pub async fn organization_teams(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<V2Envelope<Vec<OrganizationTeam>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_orgs").await?;
    let teams = state
        .organizations_service
        .teams(user_id, organization_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(teams, "UTC", None)))
}

pub async fn organization_create_team(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(input): Json<CreateOrganizationTeamRequest>,
) -> Result<(StatusCode, Json<V2Envelope<OrganizationTeam>>), ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let team = state
        .organizations_service
        .create_team(user_id, organization_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("team")
                || error.to_string().contains("slug")
                || error.to_string().contains("permission")
            {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok((StatusCode::CREATED, Json(envelope(team, "UTC", None))))
}

/// Maps organization service errors to HTTP: a denied action is 403, a fixable request
/// is 404/400, anything else (PostgreSQL down or unconfigured) is 503.
fn organization_error(error: anyhow::Error) -> ApiError {
    use crate::services::authorization::AuthorizationDenied;
    use crate::services::organizations::OrganizationRequestError;
    if let Some(denied) = error.downcast_ref::<AuthorizationDenied>() {
        return ApiError::forbidden(denied.to_string());
    }
    match error.downcast_ref::<OrganizationRequestError>() {
        Some(OrganizationRequestError::NotFound(message)) => ApiError::not_found(*message),
        Some(OrganizationRequestError::Invalid(message)) => ApiError::bad_request(*message),
        None => ApiError::service_unavailable(error),
    }
}

pub async fn organization_invite_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(input): Json<InviteOrganizationMemberRequest>,
) -> Result<(StatusCode, Json<V2Envelope<OrganizationUserInvite>>), ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let invite = state
        .organizations_service
        .invite_member(user_id, organization_id, input)
        .await
        .map_err(organization_error)?;
    Ok((StatusCode::CREATED, Json(envelope(invite, "UTC", None))))
}

pub async fn organization_invites(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<V2Envelope<Vec<OrganizationUserInvite>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_orgs").await?;
    let invites = state
        .organizations_service
        .pending_invites(user_id, organization_id)
        .await
        .map_err(organization_error)?;
    Ok(Json(envelope(invites, "UTC", None)))
}

pub async fn organization_revoke_invite(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((organization_id, invite_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if state
        .organizations_service
        .revoke_invite(user_id, organization_id, invite_id)
        .await
        .map_err(organization_error)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found("invite not found"))
    }
}

pub async fn my_organization_invites(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<Vec<OrganizationUserInvite>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_orgs").await?;
    let invites = state
        .organizations_service
        .my_invites(user_id)
        .await
        .map_err(organization_error)?;
    Ok(Json(envelope(invites, "UTC", None)))
}

pub async fn accept_organization_invite(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(invite_id): Path<Uuid>,
) -> Result<Json<V2Envelope<AcceptedOrganizationInvite>>, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let accepted = state
        .organizations_service
        .accept_invite(user_id, invite_id)
        .await
        .map_err(organization_error)?;
    Ok(Json(envelope(accepted, "UTC", None)))
}

pub async fn decline_organization_invite(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(invite_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if state
        .organizations_service
        .decline_invite(user_id, invite_id)
        .await
        .map_err(organization_error)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found("invite not found"))
    }
}

pub async fn organization_team_members(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((organization_id, team_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<V2Envelope<Vec<OrganizationTeamMember>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_orgs").await?;
    let members = state
        .organizations_service
        .team_members(user_id, organization_id, team_id)
        .await
        .map_err(organization_error)?;
    Ok(Json(envelope(members, "UTC", None)))
}

pub async fn organization_add_team_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((organization_id, team_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<AddOrganizationTeamMemberRequest>,
) -> Result<(StatusCode, Json<V2Envelope<OrganizationTeamMember>>), ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let member = state
        .organizations_service
        .add_team_member(user_id, organization_id, team_id, input)
        .await
        .map_err(organization_error)?;
    Ok((StatusCode::CREATED, Json(envelope(member, "UTC", None))))
}

pub async fn organization_remove_team_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((organization_id, team_id, member_user_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if state
        .organizations_service
        .remove_team_member(user_id, organization_id, team_id, member_user_id)
        .await
        .map_err(organization_error)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found("team member not found"))
    }
}

pub async fn organization_analytics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Query(query): Query<RangeQuery>,
) -> Result<Json<V2Envelope<OrganizationAnalyticsData>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_org_dashboards").await?;
    let (start, end) = resolve_range(query.start, query.end, query.timezone.as_deref())?;
    crate::model::date_range::ResolvedRange::parse(&start, &end, query.timezone.as_deref())
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let analytics = state
        .organizations_service
        .analytics(user_id, organization_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    // This legacy report has no event-time consent projection or complementary
    // suppression. Preserve its wire shape while closing the alternate read path.
    let measurement = OrganizationMeasurement {
        start,
        end,
        timezone: query.timezone.clone().unwrap_or_else(|| "UTC".to_string()),
        status: "unavailable_privacy_projection",
        consenting_members: 0,
        total_seconds: None,
        proven_seconds: None,
        inferred_seconds: None,
        attributed_line_changes: 0,
        line_change_denominator: 0,
        individual: vec![],
        small_team_inference_warning: false,
    };
    Ok(Json(envelope(
        OrganizationAnalyticsData {
            membership: analytics,
            measurement,
        },
        query.timezone.as_deref().unwrap_or("UTC"),
        Some(
            json!({ "analytics": "unavailable_privacy_projection", "reason": "use_team_insights_when_enabled" }),
        ),
    )))
}

pub async fn organization_analytics_sharing(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<V2Envelope<OrganizationAnalyticsSharing>>, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let sharing = state
        .organizations_service
        .analytics_sharing(user_id, organization_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(sharing, "UTC", None)))
}

pub async fn organization_analytics_sharing_update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(sharing): Json<OrganizationAnalyticsSharing>,
) -> Result<Json<V2Envelope<OrganizationAnalyticsSharing>>, ApiError> {
    let user_id = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if sharing.share_individual && !sharing.share_aggregate {
        return Err(ApiError::bad_request(
            "individual sharing requires aggregate sharing",
        ));
    }
    let sharing = state
        .organizations_service
        .set_analytics_sharing(user_id, organization_id, sharing)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(sharing, "UTC", None)))
}

pub async fn wakatime_import_start(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<StartWakaTimeImport>,
) -> Result<(StatusCode, Json<V2Envelope<WakaTimeImportJob>>), ApiError> {
    let user_id = require_scope(&state, &headers, "write_heartbeats").await?;
    if !(1..=10_000).contains(&input.total_chunks) {
        return Err(ApiError::bad_request(
            "total_chunks must be between 1 and 10000",
        ));
    }
    let postgres = state.postgres.as_ref().ok_or_else(|| {
        ApiError::service_unavailable("PostgreSQL is required for resumable imports")
    })?;
    ensure_pg_identity(&state, user_id).await?;
    let baseline = state
        .all_time_service
        .get_in_timezone(user_id, Some("UTC"))
        .await
        .map_err(ApiError::internal)?;
    let baseline_version = baseline
        .data
        .calculation_version
        .as_deref()
        .unwrap_or("unknown");
    postgres
        .client()
        .execute(
            "INSERT INTO wakatime_import_jobs
                (id, user_id, total_chunks, before_total_seconds, before_calculation_version)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
            &[
                &input.import_id,
                &user_id,
                &input.total_chunks,
                &baseline.data.total_seconds,
                &baseline_version,
            ],
        )
        .await
        .map_err(ApiError::internal)?;
    let job = load_wakatime_import_job(postgres, user_id, input.import_id).await?;
    if job.total_chunks != input.total_chunks || job.completed {
        return Err(ApiError::conflict(
            "import id already exists with different parameters or is complete",
        ));
    }
    Ok((StatusCode::CREATED, Json(envelope(job, "UTC", None))))
}

pub async fn wakatime_import_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(import_id): Path<Uuid>,
) -> Result<Json<V2Envelope<WakaTimeImportJob>>, ApiError> {
    let user_id = require_scope(&state, &headers, "write_heartbeats").await?;
    let postgres = state.postgres.as_ref().ok_or_else(|| {
        ApiError::service_unavailable("PostgreSQL is required for resumable imports")
    })?;
    let job = load_wakatime_import_job(postgres, user_id, import_id).await?;
    Ok(Json(envelope(job, "UTC", None)))
}

pub async fn wakatime_import_chunk_preview(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((import_id, chunk_index)): Path<(Uuid, i32)>,
    Json(input): Json<WakaTimeImportChunk>,
) -> Result<Json<V2Envelope<WakaTimeImportChunkPreview>>, ApiError> {
    let user_id = require_scope(&state, &headers, "write_heartbeats").await?;
    if input.dump_json.len() > 1024 * 1024 || chunk_index < 0 {
        return Err(ApiError::bad_request(
            "chunk exceeds 1 MiB or index is invalid",
        ));
    }
    let postgres = state.postgres.as_ref().ok_or_else(|| {
        ApiError::service_unavailable("PostgreSQL is required for resumable imports")
    })?;
    let _account_lock = postgres
        .account_activity_lock(user_id)
        .await
        .map_err(ApiError::internal)?;
    let mut connection = postgres
        .transaction_client()
        .await
        .map_err(ApiError::internal)?;
    let tx = connection.transaction().await.map_err(ApiError::internal)?;
    let job = tx
        .query_opt(
            "SELECT total_chunks, completed_at IS NOT NULL AS completed
             FROM wakatime_import_jobs WHERE id = $1 AND user_id = $2 FOR UPDATE",
            &[&import_id, &user_id],
        )
        .await
        .map_err(ApiError::internal)?
        .ok_or_else(|| ApiError::not_found("import job not found"))?;
    let total_chunks: i32 = job.get("total_chunks");
    if job.get::<_, bool>("completed") || chunk_index >= total_chunks {
        return Err(ApiError::conflict(
            "import is complete or chunk index is outside the job",
        ));
    }

    let preview = state
        .wakatime_import_service
        .preview_stable(user_id, &input.dump_json)
        .await
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let digest = format!("{:x}", Sha256::digest(input.dump_json.as_bytes()));
    tx.execute(
        "INSERT INTO wakatime_import_chunk_previews
             (job_id, chunk_index, digest, valid_heartbeats, invalid_heartbeats,
              possible_legacy_duplicates, legacy_scan_limited, requires_confirmation, previewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (job_id, chunk_index) DO UPDATE SET
             digest = EXCLUDED.digest,
             valid_heartbeats = EXCLUDED.valid_heartbeats,
             invalid_heartbeats = EXCLUDED.invalid_heartbeats,
             possible_legacy_duplicates = EXCLUDED.possible_legacy_duplicates,
             legacy_scan_limited = EXCLUDED.legacy_scan_limited,
             requires_confirmation = EXCLUDED.requires_confirmation,
             previewed_at = now()",
        &[
            &import_id,
            &chunk_index,
            &digest,
            &(preview.valid_heartbeats as i32),
            &(preview.invalid_heartbeats as i32),
            &(preview.possible_legacy_duplicates as i32),
            &preview.legacy_scan_limited,
            &preview.requires_confirmation,
        ],
    )
    .await
    .map_err(ApiError::internal)?;
    tx.commit().await.map_err(ApiError::internal)?;

    Ok(Json(envelope(
        WakaTimeImportChunkPreview {
            chunk_index,
            digest,
            valid_heartbeats: preview.valid_heartbeats,
            invalid_heartbeats: preview.invalid_heartbeats,
            possible_legacy_duplicates: preview.possible_legacy_duplicates,
            legacy_scan_limited: preview.legacy_scan_limited,
            requires_confirmation: preview.requires_confirmation,
        },
        "UTC",
        None,
    )))
}

pub async fn wakatime_import_chunk(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((import_id, chunk_index)): Path<(Uuid, i32)>,
    Json(input): Json<WakaTimeImportChunk>,
) -> Result<Json<V2Envelope<WakaTimeImportJob>>, ApiError> {
    let user_id = require_scope(&state, &headers, "write_heartbeats").await?;
    if input.dump_json.len() > 1024 * 1024 || chunk_index < 0 {
        return Err(ApiError::bad_request(
            "chunk exceeds 1 MiB or index is invalid",
        ));
    }
    let postgres = state.postgres.as_ref().ok_or_else(|| {
        ApiError::service_unavailable("PostgreSQL is required for resumable imports")
    })?;
    let digest = format!("{:x}", Sha256::digest(input.dump_json.as_bytes()));
    // Hold the account-scoped lock through ClickHouse ingestion and the progress
    // commit. A retry after a failed PostgreSQL commit is safe because v2
    // derives heartbeat IDs from each heartbeat, independent of chunk boundaries.
    let _account_lock = postgres
        .account_activity_lock(user_id)
        .await
        .map_err(ApiError::internal)?;
    let mut connection = postgres
        .transaction_client()
        .await
        .map_err(ApiError::internal)?;
    let tx = connection.transaction().await.map_err(ApiError::internal)?;
    let row = tx
        .query_opt(
            "SELECT total_chunks, completed_at IS NOT NULL AS completed
         FROM wakatime_import_jobs WHERE id = $1 AND user_id = $2 FOR UPDATE",
            &[&import_id, &user_id],
        )
        .await
        .map_err(ApiError::internal)?
        .ok_or_else(|| ApiError::not_found("import job not found"))?;
    let total_chunks: i32 = row.get("total_chunks");
    if row.get::<_, bool>("completed") || chunk_index >= total_chunks {
        return Err(ApiError::conflict(
            "import is complete or chunk index is outside the job",
        ));
    }
    let existing = tx
        .query_opt(
            "SELECT digest FROM wakatime_import_chunks WHERE job_id = $1 AND chunk_index = $2",
            &[&import_id, &chunk_index],
        )
        .await
        .map_err(ApiError::internal)?;
    if let Some(row) = existing {
        if row.get::<_, String>("digest") != digest {
            return Err(ApiError::conflict(
                "chunk index was already uploaded with different content",
            ));
        }
    } else {
        let preview = tx
            .query_opt(
                "SELECT digest, requires_confirmation, possible_legacy_duplicates,
                        legacy_scan_limited
                 FROM wakatime_import_chunk_previews
                 WHERE job_id = $1 AND chunk_index = $2",
                &[&import_id, &chunk_index],
            )
            .await
            .map_err(ApiError::internal)?
            .ok_or_else(|| ApiError::conflict("preview this chunk before importing it"))?;
        if preview.get::<_, String>("digest") != digest {
            return Err(ApiError::conflict(
                "chunk changed after preview; preview the current file chunk again",
            ));
        }

        let latest_preview = state
            .wakatime_import_service
            .preview_stable(user_id, &input.dump_json)
            .await
            .map_err(|error| ApiError::bad_request(error.to_string()))?;
        let confirmation_required =
            preview.get::<_, bool>("requires_confirmation") || latest_preview.requires_confirmation;
        if confirmation_required && !input.confirm_legacy_ambiguity {
            return Err(ApiError::conflict(
                "possible v1-import duplicates need explicit confirmation before importing",
            ));
        }
        let previewed_legacy_duplicates: i32 = preview.get("possible_legacy_duplicates");
        let possible_legacy_duplicates = std::cmp::max(
            previewed_legacy_duplicates,
            latest_preview.possible_legacy_duplicates as i32,
        );
        let legacy_scan_limited: bool =
            preview.get::<_, bool>("legacy_scan_limited") || latest_preview.legacy_scan_limited;

        let result = state
            .wakatime_import_service
            .run_stable(user_id, &input.dump_json)
            .await
            .map_err(|error| ApiError::bad_request(error.to_string()))?;
        tx.execute(
            "INSERT INTO wakatime_import_chunks
                 (job_id, chunk_index, digest, imported_heartbeats, skipped_heartbeats,
                  issue_counts, possible_legacy_duplicates, legacy_scan_limited,
                  confirmed_legacy_ambiguity)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            &[
                &import_id,
                &chunk_index,
                &digest,
                &(result.imported_heartbeats as i32),
                &(result.skipped_heartbeats as i32),
                &serde_json::to_value(&result.issue_counts).map_err(ApiError::internal)?,
                &possible_legacy_duplicates,
                &legacy_scan_limited,
                &(input.confirm_legacy_ambiguity && confirmation_required),
            ],
        )
        .await
        .map_err(ApiError::internal)?;
    }
    tx.commit().await.map_err(ApiError::internal)?;
    let job = load_wakatime_import_job(postgres, user_id, import_id).await?;
    Ok(Json(envelope(job, "UTC", None)))
}

pub async fn wakatime_import_complete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(import_id): Path<Uuid>,
) -> Result<Json<V2Envelope<WakaTimeImportJob>>, ApiError> {
    let user_id = require_scope(&state, &headers, "write_heartbeats").await?;
    let postgres = state.postgres.as_ref().ok_or_else(|| {
        ApiError::service_unavailable("PostgreSQL is required for resumable imports")
    })?;
    let mut connection = postgres
        .transaction_client()
        .await
        .map_err(ApiError::internal)?;
    let tx = connection.transaction().await.map_err(ApiError::internal)?;
    let row = tx
        .query_opt(
            "SELECT total_chunks, completed_at IS NOT NULL AS completed FROM wakatime_import_jobs
         WHERE id = $1 AND user_id = $2 FOR UPDATE",
            &[&import_id, &user_id],
        )
        .await
        .map_err(ApiError::internal)?
        .ok_or_else(|| ApiError::not_found("import job not found"))?;
    let expected: i32 = row.get("total_chunks");
    let uploaded: i64 = tx
        .query_one(
            "SELECT count(*) AS n FROM wakatime_import_chunks WHERE job_id = $1",
            &[&import_id],
        )
        .await
        .map_err(ApiError::internal)?
        .get("n");
    if uploaded != i64::from(expected) {
        return Err(ApiError::conflict("import still has missing chunks"));
    }
    if !row.get::<_, bool>("completed") {
        let final_total = state
            .all_time_service
            .get_in_timezone(user_id, Some("UTC"))
            .await
            .map_err(ApiError::internal)?;
        let final_version = final_total
            .data
            .calculation_version
            .as_deref()
            .unwrap_or("unknown");
        tx.execute(
            "UPDATE wakatime_import_jobs
             SET completed_at = now(), after_total_seconds = $3, after_calculation_version = $4
             WHERE id = $1 AND user_id = $2",
            &[
                &import_id,
                &user_id,
                &final_total.data.total_seconds,
                &final_version,
            ],
        )
        .await
        .map_err(ApiError::internal)?;
    }
    tx.commit().await.map_err(ApiError::internal)?;
    let job = load_wakatime_import_job(postgres, user_id, import_id).await?;
    Ok(Json(envelope(job, "UTC", None)))
}

async fn load_wakatime_import_job(
    postgres: &crate::infrastructure::postgres::PostgresClient,
    user_id: Uuid,
    import_id: Uuid,
) -> Result<WakaTimeImportJob, ApiError> {
    let row = postgres
        .client()
        .query_opt(
            "SELECT id, total_chunks, completed_at IS NOT NULL AS completed,
                before_total_seconds, before_calculation_version,
                after_total_seconds, after_calculation_version
         FROM wakatime_import_jobs WHERE id = $1 AND user_id = $2",
            &[&import_id, &user_id],
        )
        .await
        .map_err(ApiError::internal)?
        .ok_or_else(|| ApiError::not_found("import job not found"))?;
    let chunks = postgres
        .client()
        .query(
            "SELECT chunk_index, imported_heartbeats, skipped_heartbeats, issue_counts,
                    possible_legacy_duplicates, legacy_scan_limited,
                    confirmed_legacy_ambiguity
         FROM wakatime_import_chunks WHERE job_id = $1 ORDER BY chunk_index",
            &[&import_id],
        )
        .await
        .map_err(ApiError::internal)?;
    let mut received_chunks = Vec::new();
    let mut imported_heartbeats = 0_i64;
    let mut skipped_heartbeats = 0_i64;
    let mut possible_legacy_duplicates = 0_i64;
    let mut legacy_scan_limited_chunks = 0_i64;
    let mut confirmed_legacy_ambiguity_chunks = 0_i64;
    let mut issue_counts = std::collections::BTreeMap::new();
    for chunk in chunks {
        received_chunks.push(chunk.get("chunk_index"));
        imported_heartbeats += i64::from(chunk.get::<_, i32>("imported_heartbeats"));
        skipped_heartbeats += i64::from(chunk.get::<_, i32>("skipped_heartbeats"));
        possible_legacy_duplicates += i64::from(chunk.get::<_, i32>("possible_legacy_duplicates"));
        if chunk.get::<_, bool>("legacy_scan_limited") {
            legacy_scan_limited_chunks += 1;
        }
        if chunk.get::<_, bool>("confirmed_legacy_ambiguity") {
            confirmed_legacy_ambiguity_chunks += 1;
        }
        let issues: serde_json::Value = chunk.get("issue_counts");
        if let Ok(issues) =
            serde_json::from_value::<std::collections::BTreeMap<String, i64>>(issues)
        {
            for (reason, count) in issues {
                *issue_counts.entry(reason).or_default() += count;
            }
        }
    }
    Ok(WakaTimeImportJob {
        id: row.get("id"),
        total_chunks: row.get("total_chunks"),
        received_chunks,
        imported_heartbeats,
        skipped_heartbeats,
        possible_legacy_duplicates,
        legacy_scan_limited_chunks,
        confirmed_legacy_ambiguity_chunks,
        issue_counts,
        before_total_seconds: row.get("before_total_seconds"),
        before_calculation_version: row.get("before_calculation_version"),
        after_total_seconds: row.get("after_total_seconds"),
        after_calculation_version: row.get("after_calculation_version"),
        net_change_seconds: row
            .get::<_, Option<f64>>("after_total_seconds")
            .map(|after| after - row.get::<_, f64>("before_total_seconds")),
        completed: row.get("completed"),
    })
}

pub async fn organization_audit_logs(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<V2Envelope<Vec<Value>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_org_dashboards").await?;
    let logs = state
        .organizations_service
        .audit_logs(user_id, organization_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(logs, "UTC", None)))
}

pub async fn organization_billing(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<V2Envelope<OrganizationBilling>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_orgs").await?;
    let billing = state
        .billing_service
        .organization(user_id, organization_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(billing, "UTC", None)))
}

pub async fn organization_invoices(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<V2Envelope<Vec<Invoice>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_orgs").await?;
    let invoices = state
        .billing_service
        .invoices(user_id, organization_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(invoices, "UTC", None)))
}

pub async fn leaderboards_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<V2Envelope<Vec<Leaderboard>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_private_leaderboards").await?;
    require_runtime_feature(crate::services::RuntimeFeature::PrivateLeaderboards)?;
    let boards = state
        .leaderboard_service
        .list(user_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(boards, "UTC", None)))
}

pub async fn leaderboards_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CreateLeaderboardRequest>,
) -> Result<(StatusCode, Json<V2Envelope<Leaderboard>>), ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    require_runtime_feature(crate::services::RuntimeFeature::PrivateLeaderboards)?;
    ensure_pg_identity(&state, user_id).await?;
    let board = state
        .leaderboard_service
        .create(user_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("unsupported")
                || error.to_string().contains("must")
                || error.to_string().contains("permission")
            {
                ApiError::bad_request(error.to_string())
            } else {
                ApiError::service_unavailable(error)
            }
        })?;
    Ok((StatusCode::CREATED, Json(envelope(board, "UTC", None))))
}

pub async fn leaderboard_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(leaderboard_id): Path<Uuid>,
) -> Result<Json<V2Envelope<Leaderboard>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_private_leaderboards").await?;
    require_runtime_feature(crate::services::RuntimeFeature::PrivateLeaderboards)?;
    let board = state
        .leaderboard_service
        .get(user_id, leaderboard_id)
        .await
        .map_err(ApiError::service_unavailable)?
        .ok_or_else(|| ApiError::not_found("leaderboard not found"))?;
    Ok(Json(envelope(board, "UTC", None)))
}

pub async fn leaderboard_members(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(leaderboard_id): Path<Uuid>,
) -> Result<Json<V2Envelope<Vec<LeaderboardMember>>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_private_leaderboards").await?;
    require_runtime_feature(crate::services::RuntimeFeature::PrivateLeaderboards)?;
    let members = state
        .leaderboard_service
        .members(user_id, leaderboard_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(members, "UTC", None)))
}

pub async fn leaderboard_add_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(leaderboard_id): Path<Uuid>,
    Json(input): Json<LeaderboardMemberRequest>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    require_runtime_feature(crate::services::RuntimeFeature::PrivateLeaderboards)?;
    if state
        .leaderboard_service
        .add_member(user_id, leaderboard_id, input)
        .await
        .map_err(ApiError::service_unavailable)?
    {
        Ok(StatusCode::CREATED)
    } else {
        Err(ApiError::bad_request(
            "user is already a leaderboard member or inactive",
        ))
    }
}

pub async fn leaderboard_remove_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((leaderboard_id, member_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ApiError> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    require_runtime_feature(crate::services::RuntimeFeature::PrivateLeaderboards)?;
    if state
        .leaderboard_service
        .remove_member(user_id, leaderboard_id, member_user_id)
        .await
        .map_err(ApiError::service_unavailable)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found("leaderboard member not found"))
    }
}

fn envelope<T>(data: T, timezone: &str, coverage: Option<Value>) -> V2Envelope<T> {
    V2Envelope {
        data,
        meta: V2Meta {
            request_id: Uuid::now_v7(),
            generated_at: Utc::now().to_rfc3339(),
            timezone: timezone.to_string(),
            data_freshness: "unknown",
            coverage,
        },
    }
}

fn resolve_range(
    start: Option<String>,
    end: Option<String>,
    timezone: Option<&str>,
) -> Result<(String, String), ApiError> {
    let today = ResolvedRange::today_date_string(timezone)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let today = NaiveDate::parse_from_str(&today, "%Y-%m-%d")
        .map_err(|_| ApiError::bad_request("today could not be resolved"))?;
    let default_start = today - Duration::days(29);
    let start = start.unwrap_or_else(|| default_start.to_string());
    let end = end.unwrap_or_else(|| today.to_string());
    NaiveDate::parse_from_str(&start, "%Y-%m-%d")
        .map_err(|_| ApiError::bad_request("start must be YYYY-MM-DD"))?;
    NaiveDate::parse_from_str(&end, "%Y-%m-%d")
        .map_err(|_| ApiError::bad_request("end must be YYYY-MM-DD"))?;
    if start > end {
        return Err(ApiError::bad_request("start must be on or before end"));
    }
    ResolvedRange::parse(&start, &end, timezone)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    Ok((start, end))
}

fn compatibility_route_status(
    manifest: &CompatibilityManifest,
    method: &str,
    route: &str,
) -> String {
    manifest
        .routes
        .iter()
        .find(|entry| entry.method.eq_ignore_ascii_case(method) && entry.path == route)
        .map(|entry| entry.status.clone())
        .unwrap_or_else(|| "not_started".to_string())
}

#[cfg(test)]
mod capability_tests {
    use super::{feature_available, feature_runtime_status};

    #[test]
    fn requested_range_over_limit_is_a_client_error_before_stats_query() {
        let error = super::resolve_range(
            Some("2025-01-01".into()),
            Some("2026-09-30".into()),
            Some("Asia/Bangkok"),
        )
        .unwrap_err();
        assert_eq!(error.status, axum::http::StatusCode::BAD_REQUEST);
    }

    #[test]
    fn unfinished_worker_features_are_not_advertised_as_available() {
        for key in [
            "daily_weekly_monthly_reports",
            "calendar_integrations",
            "public_profiles_and_embeds",
            "private_leaderboards",
            "sso_oidc_saml",
            "scim",
            "seat_billing_entitlements",
        ] {
            assert!(
                !feature_available(key, true, false, false),
                "{key} must stay disabled"
            );
            assert_eq!(
                feature_runtime_status(key, "beta", true, false, false),
                "disabled"
            );
        }
        assert!(!feature_available("data_exports", true, false, false));
        assert_eq!(
            feature_runtime_status("data_exports", "partial", true, false, false),
            "unavailable"
        );
    }

    #[test]
    fn postgres_backed_feature_is_unavailable_without_postgres() {
        assert!(!feature_available("goals_crud", false, false, false));
        assert!(!feature_available(
            "resumable_wakatime_import",
            false,
            false,
            false
        ));
        assert!(!feature_available(
            "delivery_queue_status",
            false,
            false,
            false
        ));
        assert!(!feature_available(
            "measurement_repair",
            false,
            false,
            false
        ));
        assert!(feature_available("measurement_repair", true, false, false));
        assert_eq!(
            feature_runtime_status("goals_crud", "beta", false, false, false),
            "unavailable"
        );
    }

    #[test]
    fn available_feature_keeps_declared_status() {
        assert!(feature_available("complete_history", false, false, false));
        assert_eq!(
            feature_runtime_status("complete_history", "production_ready", false, false, false,),
            "production_ready"
        );
    }

    #[test]
    fn unknown_capability_keys_fail_closed() {
        assert!(!feature_available("future_feature", true, false, false));
        assert_eq!(
            feature_runtime_status("future_feature", "beta", true, false, false),
            "unavailable"
        );
    }

    #[test]
    fn configured_export_processor_is_advertised() {
        assert!(feature_available("data_exports", true, true, false));
        assert_eq!(
            feature_runtime_status("data_exports", "partial", true, true, false),
            "partial"
        );
    }

    #[test]
    fn account_deletion_requires_an_explicitly_enabled_processor() {
        assert!(!feature_available("account_deletion", true, false, false));
        assert_eq!(
            feature_runtime_status("account_deletion", "partial", true, false, false),
            "unavailable"
        );
        assert!(feature_available("account_deletion", true, false, true));
        assert_eq!(
            feature_runtime_status("account_deletion", "partial", true, false, true),
            "partial"
        );
    }

    #[test]
    fn disabled_feature_route_guard_returns_a_sanitized_unavailable_error() {
        let error =
            super::require_runtime_feature(crate::services::RuntimeFeature::PrivateLeaderboards)
                .expect_err("private leaderboards are not enabled");
        assert_eq!(error.status, axum::http::StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            error.message,
            "feature private_leaderboards is unavailable in this deployment"
        );
    }
}

#[cfg(test)]
mod measurement_quality_tests {
    use super::{
        build_measurement_quality, coverage_from_metric_groups, operation_evidence_from_row,
        LineMetricCoverage, OperationEvidenceRow,
    };
    use crate::model::ai_stats::{AiCoverageStatus, AiStatsCoverage};
    use crate::model::summary::{
        SummariesResponse, SummaryCalculation, SummaryDay, SummaryGrandTotal,
    };
    use crate::services::activity_timeline::EvidenceSplit;

    #[test]
    fn day_evidence_reconciles_and_no_observation_is_not_called_idle() {
        let day = |date: &str, observed: bool| SummaryDay {
            date: date.to_string(),
            grand_total: SummaryGrandTotal {
                total_seconds: if observed { 90.0 } else { 0.0 },
                hours: 0.0,
                text: String::new(),
                heartbeats: u64::from(observed),
                comparable_seconds: None,
                ai_measured_seconds: None,
                ai_additional_seconds: None,
                calculation_version: Some("legacy"),
                active_seconds: None,
                active_human_seconds: None,
                active_human_only_seconds: None,
                active_ai_only_seconds: None,
                active_ai_seconds: None,
                active_overlap_seconds: None,
                active_coverage: None,
                evidence: EvidenceSplit {
                    proven_seconds: if observed { 60.0 } else { 0.0 },
                    inferred_seconds: if observed { 30.0 } else { 0.0 },
                    ..EvidenceSplit::default()
                },
            },
            languages: Vec::new(),
            projects: Vec::new(),
            editors: Vec::new(),
            operating_systems: Vec::new(),
            categories: Vec::new(),
        };
        let summary = SummariesResponse {
            start: "2026-09-21".to_string(),
            end: "2026-09-22".to_string(),
            calculation: SummaryCalculation {
                timezone: "UTC".to_string(),
                timeout_seconds: 900.0,
                writes_only: false,
                scope: "all_projects_all_categories",
                comparable_metric: "editor_ranges",
                calculation_version: "legacy",
            },
            days: vec![day("2026-09-21", true), day("2026-09-22", false)],
        };
        let coverage = AiStatsCoverage {
            attributed_line_changes: 0,
            ai_inferred_heartbeats: 0,
            ai_verified_heartbeats: 0,
            heartbeat_denominator: 1,
            human_heartbeats: 0,
            line_change_denominator: 0,
            line_coverage_percent: None,
            status: AiCoverageStatus::Partial,
            unknown_heartbeats: 1,
            unknown_line_changes: 0,
        };
        let report = build_measurement_quality(summary, coverage);
        assert_eq!(report.total_seconds, 90.0);
        assert_eq!(report.proven_seconds + report.inferred_seconds, 90.0);
        assert_eq!(report.days[1].status, "no_observation");
        assert_eq!(
            report.days[1].reason,
            Some("no_heartbeat_is_not_proof_of_idle")
        );
    }

    #[test]
    fn operation_receipt_uses_opaque_id_and_hides_unverified_identity() {
        let raw = OperationEvidenceRow {
            time: 1_700_000_000.0,
            entity: "/private/source/secret.rs".to_string(),
            session_id: Some("private-session".to_string()),
            ai_event_id: Some("raw-event".to_string()),
            ai_change_id: None,
            heartbeat_id: None,
            ai_agent: Some("unverified-agent".to_string()),
            ai_provider: Some("unverified-provider".to_string()),
            ai_model: Some("unverified-model".to_string()),
            identity_reason: Some("conflicting_evidence".to_string()),
            identity_source: Some("transcript".to_string()),
            effective_actor_type: "ai_inferred".to_string(),
            ai_lines_added: Some(10),
            ai_lines_deleted: Some(2),
            revision: 1,
            row_key: "a".repeat(64),
        };
        let receipt = operation_evidence_from_row(uuid::Uuid::nil(), raw);
        let serialized = serde_json::to_string(&receipt).unwrap();
        assert!(!serialized.contains("secret.rs"));
        assert!(!serialized.contains("private-session"));
        assert!(!serialized.contains("raw-event"));
        assert!(!serialized.contains("unverified-model"));
        assert!(receipt.agent.is_none());
        assert!(receipt.lines_added.is_none());
    }

    #[test]
    fn line_coverage_selects_one_metric_definition_at_a_time() {
        let group = |version: &str, heartbeats, ai_lines, unknown_lines| LineMetricCoverage {
            version: version.to_string(),
            status: "measured".to_string(),
            reason: None,
            heartbeats,
            ai_line_changes: ai_lines,
            human_line_changes: 0,
            unknown_line_changes: unknown_lines,
            line_change_denominator: ai_lines + unknown_lines,
            line_coverage_percent: None,
            ai_verified_heartbeats: heartbeats,
            ai_inferred_heartbeats: 0,
            human_heartbeats: 0,
            unknown_heartbeats: 0,
        };
        let groups = vec![
            group("editor-before-after-v1", 1, 12, 3),
            group("legacy_unversioned", 8, 100, 0),
        ];
        let coverage = coverage_from_metric_groups(&groups, "editor-before-after-v1").unwrap();
        assert_eq!(coverage.heartbeat_denominator, 1);
        assert_eq!(coverage.line_change_denominator, 15);
        assert_eq!(coverage.attributed_line_changes, 12);
    }
}

#[cfg(test)]
mod operation_evidence_cursor_tests {
    use super::{
        decode_operation_evidence_cursor, encode_operation_evidence_cursor, OperationEvidenceCursor,
    };
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn signed_cursor_is_bound_to_user_range_timezone_and_project() {
        let user_id = Uuid::now_v7();
        let project_id = Uuid::now_v7();
        let token = encode_operation_evidence_cursor(
            "test-secret",
            OperationEvidenceCursor {
                user_id,
                start: "2026-09-01".to_string(),
                end: "2026-09-07".to_string(),
                timezone: "Asia/Bangkok".to_string(),
                project_id: Some(project_id),
                last_time: 1_790_000_000.0,
                last_row_key: "a".repeat(64),
                expires_at: Utc::now().timestamp() + 60,
            },
        )
        .unwrap();

        assert!(decode_operation_evidence_cursor(
            &token,
            "test-secret",
            user_id,
            "2026-09-01",
            "2026-09-07",
            "Asia/Bangkok",
            Some(project_id),
        )
        .is_ok());
        assert!(decode_operation_evidence_cursor(
            &token,
            "test-secret",
            Uuid::now_v7(),
            "2026-09-01",
            "2026-09-07",
            "Asia/Bangkok",
            Some(project_id),
        )
        .is_err());
        assert!(decode_operation_evidence_cursor(
            &token,
            "test-secret",
            user_id,
            "2026-09-01",
            "2026-09-07",
            "UTC",
            Some(project_id),
        )
        .is_err());
    }

    #[test]
    fn cursor_rejects_tampering_and_expiry() {
        let user_id = Uuid::now_v7();
        let now = Utc::now().timestamp();
        let token = encode_operation_evidence_cursor(
            "test-secret",
            OperationEvidenceCursor {
                user_id,
                start: "2026-09-01".to_string(),
                end: "2026-09-07".to_string(),
                timezone: "UTC".to_string(),
                project_id: None,
                last_time: 1_790_000_000.0,
                last_row_key: "b".repeat(64),
                expires_at: now - 1,
            },
        )
        .unwrap();
        let expired = decode_operation_evidence_cursor(
            &token,
            "test-secret",
            user_id,
            "2026-09-01",
            "2026-09-07",
            "UTC",
            None,
        )
        .unwrap_err();
        assert_eq!(expired.status, axum::http::StatusCode::CONFLICT);

        let mut altered = token.into_bytes();
        let index = altered.len() / 2;
        altered[index] = if altered[index] == b'a' { b'b' } else { b'a' };
        let altered = String::from_utf8(altered).unwrap();
        assert!(decode_operation_evidence_cursor(
            &altered,
            "test-secret",
            user_id,
            "2026-09-01",
            "2026-09-07",
            "UTC",
            None,
        )
        .is_err());
    }
}

/// Mirror an authenticated identity into PostgreSQL before a PostgreSQL-backed write
/// puts a foreign key on it.
///
/// Identity lives in ClickHouse and PostgreSQL is optional, so an account created before
/// `POSTGRES_URL` was configured — or one that has only ever authenticated with an API
/// key, which never goes through `register()`/`login()`'s sync path — has no `users` row
/// there. Without this the INSERT fails with a foreign-key violation that reaches the
/// caller as an opaque 503 on an otherwise valid request.
async fn ensure_pg_identity(state: &AppState, user_id: Uuid) -> Result<(), ApiError> {
    state
        .user_service
        .ensure_postgres_identity(user_id)
        .await
        .map_err(ApiError::service_unavailable)
}

/// Guard disabled product mutations before an identity mirror or other helper
/// can write PostgreSQL. Services repeat the guard as a defense-in-depth check
/// for non-HTTP callers.
fn require_runtime_feature(feature: crate::services::RuntimeFeature) -> Result<(), ApiError> {
    crate::services::require_runtime_feature(feature).map_err(ApiError::service_unavailable)
}

fn require_measurement_repair_enabled(state: &AppState) -> Result<(), ApiError> {
    if state.config.measurement_repair_enabled {
        Ok(())
    } else {
        Err(ApiError::service_unavailable(
            "historical measurement repair is disabled in this deployment",
        ))
    }
}

async fn require_scope(
    state: &AppState,
    headers: &HeaderMap,
    scope: &'static str,
) -> Result<Uuid, ApiError> {
    let user_id = auth::resolve_user_id(state, headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    if !auth::require_scope(state, headers, scope).await {
        return Err(ApiError::forbidden_scope(scope));
    }
    Ok(user_id)
}

#[derive(Debug)]
pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn unauthorized() -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message: "authentication required".to_string(),
        }
    }

    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn conflict(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            message: message.into(),
        }
    }

    fn forbidden(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            message: message.into(),
        }
    }

    fn forbidden_scope(scope: &str) -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            message: format!("insufficient OAuth scope: {scope}"),
        }
    }

    fn internal(error: impl std::fmt::Display) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: error.to_string(),
        }
    }

    fn service_unavailable(error: impl std::fmt::Display) -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            message: error.to_string(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            Json(json!({
                "error": {
                    "code": self.status.as_u16(),
                    "message": self.message,
                }
            })),
        )
            .into_response()
    }
}

use axum::response::IntoResponse;

#[cfg(test)]
mod organization_error_tests {
    use super::organization_error;
    use crate::services::authorization::AuthorizationDenied;
    use crate::services::organizations::OrganizationRequestError;
    use axum::http::StatusCode;

    #[test]
    fn maps_organization_errors_to_http_statuses() {
        let denied =
            organization_error(AuthorizationDenied("role does not permit this action").into());
        assert_eq!(denied.status, StatusCode::FORBIDDEN);
        assert_eq!(denied.message, "role does not permit this action");
        assert_eq!(
            organization_error(OrganizationRequestError::NotFound("team not found").into()).status,
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            organization_error(OrganizationRequestError::Invalid("bad role").into()).status,
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            organization_error(anyhow::anyhow!("PostgreSQL is not configured")).status,
            StatusCode::SERVICE_UNAVAILABLE
        );
    }
}

#[cfg(test)]
mod delivery_snapshot_tests {
    use super::*;
    use wakaclock_core::queue::{DeliveryErrorSummary, DeliveryQueueDetails};
    fn available(version: u8) -> DeliveryQueueSnapshot {
        DeliveryQueueSnapshot {
            schema_version: version,
            capture: None,
            device_id: "device".into(),
            queue_id: "a".repeat(64),
            sequence: 1,
            captured_at: Utc::now(),
            read_status: QueueReadStatus::Available,
            pending: Some(1191),
            retry: Some(1191),
            dead_letter: Some(0),
            oldest_pending_at: Some(Utc::now() - Duration::hours(1)),
            last_successful_delivery_at: None,
            details: (version == 2).then_some(DeliveryQueueDetails {
                eligible: 100,
                leased: 0,
                next_retry_at: Some(Utc::now() + Duration::minutes(1)),
                oldest_event_at: Some(Utc::now() - Duration::days(2)),
                accepted_total: 1,
                backlog_error: Some(DeliveryErrorSummary {
                    kind: "network".into(),
                    http_status: None,
                    message_code: "connect_failed".into(),
                    failed_at: Utc::now() - Duration::minutes(1),
                }),
            }),
        }
    }
    #[test]
    fn v1_and_v2_are_supported_and_missing_details_are_not_zero() {
        assert!(validate_delivery_snapshot(&available(1)).is_ok());
        assert!(validate_delivery_snapshot(&available(2)).is_ok());
        let mut invalid = available(2);
        invalid.details = None;
        assert!(validate_delivery_snapshot(&invalid).is_err());
        let unavailable = DeliveryQueueSnapshot::unavailable("device".into(), "a".repeat(64), 2);
        assert!(validate_delivery_snapshot(&unavailable).is_ok());
        assert_eq!(unavailable.pending, None);
    }
    #[test]
    fn capture_health_is_additive_bounded_and_metadata_only() {
        let mut snapshot = available(2);
        let at = snapshot.captured_at;
        snapshot.capture = Some(wakaclock_core::queue::CaptureHealthSnapshot {
            schema_version: 1,
            captured_at: at,
            enabled: true,
            status: "fresh".into(),
            last_scan_success_at: Some(at),
            parser_errors: 0,
            pending: 0,
        });
        assert!(validate_delivery_snapshot(&snapshot).is_ok());
        let mut value = serde_json::to_value(&snapshot).unwrap();
        value["capture"]["prompt"] = serde_json::json!("secret");
        assert!(serde_json::from_value::<DeliveryQueueSnapshot>(value).is_err());
        snapshot.capture.as_mut().unwrap().status = "free form secret".into();
        assert!(validate_delivery_snapshot(&snapshot).is_err());
        snapshot.capture.as_mut().unwrap().status = "fresh".into();
        snapshot.schema_version = 1;
        assert!(validate_delivery_snapshot(&snapshot).is_err());
    }
    #[test]
    fn diagnostics_refuse_freeform_content_and_invalid_counts() {
        let mut invalid = available(2);
        invalid
            .details
            .as_mut()
            .unwrap()
            .backlog_error
            .as_mut()
            .unwrap()
            .message_code = "secret file contents".into();
        assert!(validate_delivery_snapshot(&invalid).is_err());
        invalid = available(2);
        invalid.details.as_mut().unwrap().leased = 1191;
        assert!(validate_delivery_snapshot(&invalid).is_err());
    }
}

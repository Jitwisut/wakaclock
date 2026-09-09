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
use chrono::{Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::ai_stats::AiStatsData;
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
    AddOrganizationMemberRequest, CreateOrganizationRequest, CreateOrganizationTeamRequest,
    Organization, OrganizationAnalytics, OrganizationMember, OrganizationTeam,
    UpdateOrganizationRequest,
};
use crate::model::profile::{
    CreateShareLinkRequest, PublicProfile, ShareLink, UpdateProfileRequest,
};
use crate::model::report::{CreateReportScheduleRequest, ReportSchedule};

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
}

#[derive(Debug, Serialize)]
pub struct CapabilityData {
    pub api_version: &'static str,
    pub product: &'static str,
    pub transactional_store: &'static str,
    pub analytics_store: &'static str,
    pub postgres_enabled: bool,
    pub presence_v2_available: bool,
    pub privacy: PrivacyCapabilities,
    pub clients: ClientCapabilities,
    pub features: Vec<FeatureCapability>,
    pub wakatime_routes: Vec<WakaTimeRouteCapability>,
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

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/capabilities", get(capabilities))
        .route("/me", get(me))
        .route("/me/analytics", get(analytics))
        .route(
            "/me/presence/rooms",
            get(crate::handlers::presence_v2::list_rooms),
        )
        .route(
            "/me/presence/heartbeat",
            post(crate::handlers::presence_v2::heartbeat),
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
            "/organizations/:organization_id/teams",
            get(organization_teams).post(organization_create_team),
        )
        .route(
            "/organizations/:organization_id/analytics",
            get(organization_analytics),
        )
        .route(
            "/organizations/:organization_id/presence/summary",
            get(crate::handlers::presence_v2::organization_summary),
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
        .with_state(app_state)
}

/// Public capability discovery endpoint used by clients and the plugin directory.
fn feature_available(key: &str, postgres: bool) -> bool {
    match key {
        "data_exports" | "daily_weekly_monthly_reports" | "calendar_integrations" => false,
        "postgres_transactional_store"
        | "personal_organizations"
        | "goals_crud"
        | "oauth_pkce_and_device_flow"
        | "git_commit_pr_analytics"
        | "public_profiles_and_embeds"
        | "private_leaderboards"
        | "organization_analytics"
        | "sso_oidc_saml"
        | "scim"
        | "seat_billing_entitlements" => postgres,
        _ => true,
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
                .map(|feature| FeatureCapability {
                    available: feature_available(&feature.key, state.postgres.is_some()),
                    status: if matches!(
                        feature.key.as_str(),
                        "data_exports" | "daily_weekly_monthly_reports" | "calendar_integrations"
                    ) {
                        "partial".to_string()
                    } else {
                        feature.status
                    },
                    key: feature.key,
                    api: feature.api,
                })
                .collect(),
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

pub async fn analytics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RangeQuery>,
) -> Result<Json<V2Envelope<AnalyticsData>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_stats").await?;
    let (start, end) = resolve_range(query.start, query.end)?;
    let summary = state
        .summary_service
        .get_range(user_id, &start, &end)
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

pub async fn ai_effectiveness(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RangeQuery>,
) -> Result<Json<V2Envelope<AiEffectivenessData>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_ai_analytics").await?;
    let (start, end) = resolve_range(query.start, query.end)?;
    let stats = state
        .ai_stats_service
        .get_range(user_id, &start, &end)
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
    let tokens_per_ai_line = reported_tokens.map(|tokens| tokens as f64 / ai_lines.max(1.0));
    let cost_per_ai_line_microusd = stats_data
        .total_estimated_cost_microusd
        .map(|cost| cost as f64 / ai_lines.max(1.0));
    let prompt_character_count = stats_data.total_prompt_characters;

    Ok(Json(envelope(
        AiEffectivenessData {
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
                    token_usage: "not_available_in_heartbeat_stream",
                    prompt_length: "not_available_in_heartbeat_stream",
                    human_follow_up: "not_available_until_ai_change_ledger_is_enabled",
                },
            },
        },
        query.timezone.as_deref().unwrap_or("UTC"),
        Some(json!({
            "ai_stats": if total_heartbeats == 0 { "empty" } else { "complete" },
            "tokens": "missing",
            "prompt_length": "missing",
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
    let (start_date, end_date) = resolve_range(query.start, query.end)?;
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
    ensure_pg_identity(&state, user_id).await?;
    let job = state
        .export_service
        .create(user_id, input)
        .await
        .map_err(|error| {
            if error.to_string().contains("unsupported") {
                ApiError::bad_request(error.to_string())
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

pub async fn organization_analytics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<V2Envelope<OrganizationAnalytics>>, ApiError> {
    let user_id = require_scope(&state, &headers, "read_org_dashboards").await?;
    let analytics = state
        .organizations_service
        .analytics(user_id, organization_id)
        .await
        .map_err(ApiError::service_unavailable)?;
    Ok(Json(envelope(
        analytics,
        "UTC",
        Some(json!({ "analytics": "membership_and_seats_only" })),
    )))
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

fn resolve_range(start: Option<String>, end: Option<String>) -> Result<(String, String), ApiError> {
    let today = Utc::now().date_naive();
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

use anyhow::{Context, Result};
use std::sync::Arc;

use crate::config::Config;
use crate::infrastructure::auth_cache::AuthKeyCache;
use crate::infrastructure::database::ClickHouseClient;
use crate::infrastructure::logger::Logger;
use crate::infrastructure::presence_store::PresenceStore;
use crate::infrastructure::rate_limiter::AuthRateLimiter;
use crate::repository::analytics::AnalyticsRepository;
use crate::repository::coworking_session::CoworkingSessionRepository;
use crate::repository::heartbeat::HeartbeatRepository;
use crate::repository::org::OrgRepository;
use crate::repository::project_merge::ProjectMergeRepository;
use crate::repository::project_rule::ProjectRuleRepository;
use crate::repository::team::TeamRepository;
use crate::services::ai_stats::AiStatsService;
use crate::services::all_time::AllTimeService;
use crate::services::coworking_session::CoworkingSessionService;
use crate::services::duration::DurationService;
use crate::services::heartbeat::HeartbeatService;
use crate::services::insights::InsightsService;
use crate::services::keystroke_stats::KeystrokeStatsService;
use crate::services::org::OrgService;
use crate::services::project_merge::ProjectMergeService;
use crate::services::project_rule::ProjectRuleService;
use crate::services::projects::ProjectsService;
use crate::services::reprocess::ReprocessService;
use crate::services::stats::StatsService;
use crate::services::summary::SummaryService;
use crate::services::team::TeamService;
use crate::services::user::UserService;
use crate::services::wakatime_import::WakaTimeImportService;

/// โครงสร้าง App Container ที่ปฏิบัติตาม Clean Architecture
pub struct AppState {
    pub logger: Arc<Logger>,
    pub config: Arc<Config>,
    pub clickhouse: Arc<ClickHouseClient>,
    pub auth_cache: Arc<AuthKeyCache>,
    pub auth_rate_limiter: Arc<AuthRateLimiter>,
    /// Live coding presence (plan.md Phase 7) — in-memory prototype, see
    /// `presence_store` module docs for what that does and does not mean.
    pub presence: Arc<PresenceStore>,
    pub analytics_repo: Arc<AnalyticsRepository>,
    pub heartbeat_repo: Arc<HeartbeatRepository>,
    pub project_merge_repo: Arc<ProjectMergeRepository>,
    pub project_rule_repo: Arc<ProjectRuleRepository>,
    pub org_repo: Arc<OrgRepository>,
    pub team_repo: Arc<TeamRepository>,
    pub coworking_session_repo: Arc<CoworkingSessionRepository>,
    pub ai_stats_service: Arc<AiStatsService>,
    pub all_time_service: Arc<AllTimeService>,
    pub user_service: Arc<UserService>,
    pub heartbeat_service: Arc<HeartbeatService>,
    pub duration_service: Arc<DurationService>,
    pub insights_service: Arc<InsightsService>,
    pub keystroke_stats_service: Arc<KeystrokeStatsService>,
    pub project_merge_service: Arc<ProjectMergeService>,
    pub projects_service: Arc<ProjectsService>,
    pub reprocess_service: Arc<ReprocessService>,
    pub project_rule_service: Arc<ProjectRuleService>,
    pub stats_service: Arc<StatsService>,
    pub summary_service: Arc<SummaryService>,
    pub wakatime_import_service: Arc<WakaTimeImportService>,
    /// Minimal org layer (plan.md 6.1, scoped-down) — exists only so a presence room can
    /// carry a real team name. Not org-scoped analytics, not billing, see
    /// `handlers/v1/orgs.rs` for the exact boundary.
    pub org_service: Arc<OrgService>,
    pub team_service: Arc<TeamService>,
    /// Group co-working sessions (plan.md 7.4).
    pub coworking_session_service: Arc<CoworkingSessionService>,
}

#[derive(serde::Serialize)]
pub struct AppHealth {
    pub status: HealthStatus,
}

#[derive(serde::Serialize)]
pub enum HealthStatus {
    Ok,
    Error,
}

impl AppState {
    pub async fn health(&self) -> AppHealth {
        let status = if self.clickhouse.health_check().await.is_ok() {
            HealthStatus::Ok
        } else {
            HealthStatus::Error
        };

        AppHealth { status }
    }
}

pub async fn create_app_state() -> Result<AppState> {
    let logger = Arc::new(Logger::new());

    // โหลด Config
    let config = Config::from_env().context("Failed to load application configuration")?;
    let config = Arc::new(config);

    // สร้าง ClickHouse Client
    let clickhouse = Arc::new(
        ClickHouseClient::new(&config.clickhouse)
            .await
            .context("Failed to initialize ClickHouse client")?,
    );

    // Auth key cache starts empty — populated by `AuthKeyCache::refresh()` in main.rs
    // once migrations have created `wakaclock.users`.
    let auth_cache = AuthKeyCache::new();
    let auth_rate_limiter = AuthRateLimiter::new();
    let presence = PresenceStore::new();

    // Initialise Repositories
    let analytics_repo = Arc::new(AnalyticsRepository::new(clickhouse.clone()));
    let heartbeat_repo = Arc::new(HeartbeatRepository::new(clickhouse.clone()));
    let project_merge_repo = Arc::new(ProjectMergeRepository::new(clickhouse.clone()));
    let project_rule_repo = Arc::new(ProjectRuleRepository::new(clickhouse.clone()));
    let org_repo = Arc::new(OrgRepository::new(clickhouse.clone()));
    let team_repo = Arc::new(TeamRepository::new(clickhouse.clone()));
    let coworking_session_repo = Arc::new(CoworkingSessionRepository::new(clickhouse.clone()));

    // Initialise Services
    let ai_stats_service = Arc::new(AiStatsService::new(clickhouse.clone()));
    let all_time_service = Arc::new(AllTimeService::new(clickhouse.clone()));
    let user_service = Arc::new(UserService::new(clickhouse.clone()));
    let heartbeat_service = Arc::new(HeartbeatService::new(heartbeat_repo.clone()));
    let duration_service = Arc::new(DurationService::new(clickhouse.clone()));
    let insights_service = Arc::new(InsightsService::new(clickhouse.clone()));
    let keystroke_stats_service = Arc::new(KeystrokeStatsService::new(clickhouse.clone()));
    let project_merge_service = Arc::new(ProjectMergeService::new(project_merge_repo.clone()));
    let projects_service = Arc::new(ProjectsService::new(clickhouse.clone()));
    let project_rule_service = Arc::new(ProjectRuleService::new(project_rule_repo.clone()));
    let reprocess_service = Arc::new(ReprocessService::new(
        clickhouse.clone(),
        project_rule_service.clone(),
    ));
    let stats_service = Arc::new(StatsService::new(clickhouse.clone()));
    let summary_service = Arc::new(SummaryService::new(clickhouse.clone()));
    let wakatime_import_service = Arc::new(WakaTimeImportService::new(heartbeat_repo.clone()));
    let org_service = Arc::new(OrgService::new(org_repo.clone()));
    let team_service = Arc::new(TeamService::new(team_repo.clone(), org_service.clone()));
    let coworking_session_service =
        Arc::new(CoworkingSessionService::new(coworking_session_repo.clone()));

    Ok(AppState {
        logger,
        config,
        clickhouse,
        auth_cache,
        auth_rate_limiter,
        presence,
        analytics_repo,
        heartbeat_repo,
        project_merge_repo,
        project_rule_repo,
        org_repo,
        team_repo,
        coworking_session_repo,
        ai_stats_service,
        all_time_service,
        user_service,
        heartbeat_service,
        duration_service,
        insights_service,
        keystroke_stats_service,
        project_merge_service,
        projects_service,
        reprocess_service,
        project_rule_service,
        stats_service,
        summary_service,
        wakatime_import_service,
        org_service,
        team_service,
        coworking_session_service,
    })
}

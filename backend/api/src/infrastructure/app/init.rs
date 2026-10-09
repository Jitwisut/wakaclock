use anyhow::{Context, Result};
use std::sync::Arc;

use crate::config::brokers::IngestMode;
use crate::config::{Config, ExportMode};
use crate::infrastructure::contracts::{CredentialVault, EventBus, ObjectStore};
use crate::infrastructure::database::ClickHouseClient;
use crate::infrastructure::postgres::PostgresClient;
use crate::infrastructure::presence_store::PresenceStore;
use crate::infrastructure::rate_limiter::{
    AiDiagnosticsRateLimiter, AnalyticsRateLimiter, AuthRateLimiter, PresenceRateLimiter,
};
use crate::infrastructure::redis_presence::RedisPresenceStore;
use crate::repository::account_analytics::AccountAnalyticsRepository;
use crate::repository::ai_usage::AiUsageRepository;
use crate::repository::analytics::AnalyticsRepository;
use crate::repository::coworking_session::CoworkingSessionRepository;
use crate::repository::external_durations::ExternalDurationRepository;
use crate::repository::follow_up::FollowUpRepository;
use crate::repository::heartbeat::HeartbeatRepository;
use crate::repository::org::OrgRepository;
use crate::repository::presence::PresenceRepository;
use crate::repository::project_analytics::ProjectAnalyticsRepository;
use crate::repository::project_identity::ProjectIdentityRepository;
use crate::repository::project_merge::ProjectMergeRepository;
use crate::repository::project_rule::ProjectRuleRepository;
use crate::repository::team::TeamRepository;
use crate::services::account_analytics::AccountAnalyticsService;
use crate::services::account_deletion::AccountDeletionService;
use crate::services::activity_timeline::{ActivityTimelineService, BridgeConfig};
use crate::services::ai_certification::AiCertificationService;
use crate::services::ai_diagnostics::AiDiagnosticsService;
use crate::services::ai_stats::AiStatsService;
use crate::services::ai_usage::AiUsageService;
use crate::services::all_time::AllTimeService;
use crate::services::authorization::AuthorizationService;
use crate::services::billing::BillingService;
use crate::services::coworking_session::CoworkingSessionService;
use crate::services::dashboard_analytics::DashboardAnalyticsService;
use crate::services::duration::DurationService;
use crate::services::enterprise::EnterpriseService;
use crate::services::exports::ExportService;
use crate::services::external_durations::ExternalDurationService;
use crate::services::follow_up::FollowUpService;
use crate::services::goals::GoalService;
use crate::services::heartbeat::HeartbeatService;
use crate::services::heartbeat_ingest::HeartbeatIngestService;
use crate::services::insights::InsightsService;
use crate::services::integrations::IntegrationService;
use crate::services::jobs::JobService;
use crate::services::keystroke_stats::KeystrokeStatsService;
use crate::services::leaderboards::LeaderboardService;
use crate::services::oauth::OAuthService;
use crate::services::org::OrgService;
use crate::services::organizations::OrganizationsService;
use crate::services::profile::ProfileService;
use crate::services::project_analytics::ProjectAnalyticsService;
use crate::services::project_identity::ProjectIdentityService;
use crate::services::project_merge::ProjectMergeService;
use crate::services::project_rule::ProjectRuleService;
use crate::services::projects::ProjectsService;
use crate::services::reports::ReportService;
use crate::services::reprocess::ReprocessService;
use crate::services::stats::StatsService;
use crate::services::summary::SummaryService;
use crate::services::team::TeamService;
use crate::services::user::UserService;
use crate::services::vcs::VcsService;
use crate::services::wakatime_import::WakaTimeImportService;

/// โครงสร้าง App Container ที่ปฏิบัติตาม Clean Architecture
pub struct AppState {
    pub config: Arc<Config>,
    pub clickhouse: Arc<ClickHouseClient>,
    /// Transactional product store. Optional only during the ClickHouse-only compatibility
    /// rollout; production deployments should set POSTGRES_URL.
    pub postgres: Option<Arc<PostgresClient>>,
    /// Optional Kafka event bus.  Direct mode leaves this unset; verify/kafka
    /// modes are rejected at config validation until the feature is compiled
    /// and the producer is reachable.
    pub event_bus: Option<Arc<dyn EventBus>>,
    pub object_store: Option<Arc<dyn ObjectStore>>,
    pub auth_rate_limiter: Arc<AuthRateLimiter>,
    pub analytics_rate_limiter: Arc<AnalyticsRateLimiter>,
    pub presence_rate_limiter: Arc<PresenceRateLimiter>,
    pub ai_diagnostics_rate_limiter: Arc<AiDiagnosticsRateLimiter>,
    /// Live coding presence (plan.md Phase 7) — in-memory prototype, see
    /// `presence_store` module docs for what that does and does not mean.
    pub presence: Arc<PresenceStore>,
    pub redis_presence: Option<Arc<RedisPresenceStore>>,
    pub presence_repo: Option<Arc<PresenceRepository>>,
    pub analytics_repo: Arc<AnalyticsRepository>,
    pub external_duration_repo: Arc<ExternalDurationRepository>,
    pub follow_up_repo: Arc<FollowUpRepository>,
    pub account_analytics_repo: Arc<AccountAnalyticsRepository>,
    pub ai_usage_repo: Arc<AiUsageRepository>,
    pub heartbeat_repo: Arc<HeartbeatRepository>,
    pub project_identity_repo: Arc<ProjectIdentityRepository>,
    pub project_merge_repo: Arc<ProjectMergeRepository>,
    pub project_rule_repo: Arc<ProjectRuleRepository>,
    pub org_repo: Arc<OrgRepository>,
    pub team_repo: Arc<TeamRepository>,
    pub coworking_session_repo: Arc<CoworkingSessionRepository>,
    pub ai_stats_service: Arc<AiStatsService>,
    pub ai_diagnostics_service: Arc<AiDiagnosticsService>,
    pub delivery_status_service: Arc<crate::services::delivery_status::DeliveryStatusService>,
    pub measurement_repair_service:
        Arc<crate::services::measurement_repair::MeasurementRepairService>,
    pub ai_certification_service: Arc<AiCertificationService>,
    pub account_analytics_service: Arc<AccountAnalyticsService>,
    pub billing_service: Arc<BillingService>,
    pub account_deletion_service: Arc<AccountDeletionService>,
    pub ai_usage_service: Arc<AiUsageService>,
    pub all_time_service: Arc<AllTimeService>,
    pub user_service: Arc<UserService>,
    pub heartbeat_service: Arc<HeartbeatService>,
    pub heartbeat_ingest_service: Arc<HeartbeatIngestService>,
    pub goal_service: Arc<GoalService>,
    pub duration_service: Arc<DurationService>,
    pub enterprise_service: Arc<EnterpriseService>,
    pub vcs_service: Arc<VcsService>,
    pub external_duration_service: Arc<ExternalDurationService>,
    pub follow_up_service: Arc<FollowUpService>,
    pub export_service: Arc<ExportService>,
    pub job_service: Arc<JobService>,
    pub profile_service: Arc<ProfileService>,
    pub report_service: Arc<ReportService>,
    pub activity_timeline_service: Arc<ActivityTimelineService>,
    pub insights_service: Arc<InsightsService>,
    pub integration_service: Arc<IntegrationService>,
    pub leaderboard_service: Arc<LeaderboardService>,
    pub keystroke_stats_service: Arc<KeystrokeStatsService>,
    /// Stable project identity (plan.md 9.3): mints and resolves `project_id`.
    pub project_identity_service: Arc<ProjectIdentityService>,
    pub project_analytics_service: Arc<ProjectAnalyticsService>,
    pub project_merge_service: Arc<ProjectMergeService>,
    pub projects_service: Arc<ProjectsService>,
    pub reprocess_service: Arc<ReprocessService>,
    pub project_rule_service: Arc<ProjectRuleService>,
    pub stats_service: Arc<StatsService>,
    pub dashboard_analytics_service: Arc<DashboardAnalyticsService>,
    pub summary_service: Arc<SummaryService>,
    pub wakatime_import_service: Arc<WakaTimeImportService>,
    /// Minimal org layer (plan.md 6.1, scoped-down) — exists only so a presence room can
    /// carry a real team name. Not org-scoped analytics, not billing, see
    /// `handlers/v1/orgs.rs` for the exact boundary.
    pub org_service: Arc<OrgService>,
    pub organizations_service: Arc<OrganizationsService>,
    pub team_insights_service: Arc<crate::services::team_insights::TeamInsightsService>,
    pub team_github_service: Arc<crate::services::team_github::TeamGithubService>,
    pub oauth_service: Arc<OAuthService>,
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
        // Kafka-cohort API replicas do not need ClickHouse on the request path;
        // the fact-sink owns that dependency. Keep the health endpoint live during
        // a ClickHouse outage so the broker-accepting path is not restarted.
        let clickhouse_required = self.config.brokers.api_requires_clickhouse();
        let clickhouse_ok = !clickhouse_required || self.clickhouse.health_check().await.is_ok();
        let postgres_ok = match &self.postgres {
            Some(postgres) => postgres.health_check().await.is_ok(),
            None => true,
        };
        let redis_ok = match &self.redis_presence {
            Some(redis) => redis.health_check().await.is_ok(),
            None => true,
        };
        let status = if (clickhouse_ok || !clickhouse_required) && postgres_ok && redis_ok {
            HealthStatus::Ok
        } else {
            HealthStatus::Error
        };

        AppHealth { status }
    }
}

pub async fn create_app_state() -> Result<AppState> {
    // Initialise structured logging once during application startup. The logger is a
    // process-level subscriber, so it does not belong in the request state container.
    crate::infrastructure::logger::Logger::new();

    // โหลด Config
    let config = Config::from_env().context("Failed to load application configuration")?;
    config.brokers.log_startup_summary();
    tracing::info!(export_mode = config.export_mode.as_str(), "export mode");
    let config = Arc::new(config);

    // สร้าง ClickHouse Client
    let clickhouse = Arc::new(
        ClickHouseClient::new(&config.clickhouse)
            .await
            .context("Failed to initialize ClickHouse client")?,
    );

    let postgres = match &config.postgres.url {
        Some(_) => Some(Arc::new(
            PostgresClient::connect(&config.postgres)
                .await
                .context("Failed to initialize PostgreSQL client")?,
        )),
        None => {
            tracing::warn!(
                "POSTGRES_URL is not configured; running in ClickHouse-only compatibility mode"
            );
            None
        }
    };

    let event_bus: Option<Arc<dyn EventBus>> = {
        // Keep the direct compatibility path independent from Kafka even when a
        // developer leaves broker settings in the environment for an integration
        // Verify/Kafka modes are the only modes that need a live producer at API
        // startup. Heartbeat and AI usage deliberately have independent rollout
        // switches, so either stream can request the shared producer.
        if config.brokers.ingest.mode == IngestMode::Direct
            && config.brokers.ai_usage.mode == IngestMode::Direct
        {
            None
        } else {
            #[cfg(feature = "kafka")]
            {
                config
                    .brokers
                    .event_bus
                    .as_ref()
                    .map(|event_config| {
                        crate::infrastructure::kafka::KafkaEventBus::connect(
                            event_config,
                            "wakaclock-api",
                        )
                        .map(|bus| Arc::new(bus) as Arc<dyn EventBus>)
                    })
                    .transpose()
                    .map_err(|error| anyhow::anyhow!(error.to_string()))?
            }
            #[cfg(not(feature = "kafka"))]
            {
                if config.brokers.event_bus.is_some() {
                    tracing::warn!(
                        "Kafka event bus configured but server was built without the kafka feature"
                    );
                }
                None
            }
        }
    };

    let auth_rate_limiter = AuthRateLimiter::new();
    let analytics_rate_limiter = AnalyticsRateLimiter::new();
    let presence_rate_limiter = PresenceRateLimiter::new();
    let ai_diagnostics_rate_limiter = AiDiagnosticsRateLimiter::new();
    let presence = PresenceStore::new();
    let (redis_presence, presence_repo) = if config.presence_v2_enabled {
        if postgres.is_none() {
            anyhow::bail!("PRESENCE_V2_ENABLED=true requires POSTGRES_URL");
        }
        if config.redis.url.is_none() {
            anyhow::bail!("PRESENCE_V2_ENABLED=true requires REDIS_URL");
        }
        let redis = RedisPresenceStore::connect(&config.redis)
            .await?
            .context("PRESENCE_V2_ENABLED=true requires a reachable Redis instance")?;
        let repository = postgres
            .as_ref()
            .map(|postgres| Arc::new(PresenceRepository::new(postgres.clone())))
            .expect("PostgreSQL presence repository checked above");
        (Some(redis), Some(repository))
    } else {
        (None, None)
    };

    // Initialise Repositories
    let analytics_repo = Arc::new(AnalyticsRepository::new(clickhouse.clone()));
    let external_duration_repo = Arc::new(ExternalDurationRepository::new(clickhouse.clone()));
    let follow_up_repo = Arc::new(FollowUpRepository::new(clickhouse.clone()));
    let account_analytics_repo = Arc::new(AccountAnalyticsRepository::new(clickhouse.clone()));
    let ai_usage_repo = Arc::new(AiUsageRepository::new(clickhouse.clone()));
    let heartbeat_repo = Arc::new(HeartbeatRepository::new(clickhouse.clone()));
    let project_identity_repo = Arc::new(ProjectIdentityRepository::new(clickhouse.clone()));
    let project_analytics_repo = Arc::new(ProjectAnalyticsRepository::new(clickhouse.clone()));
    let project_merge_repo = Arc::new(ProjectMergeRepository::new(clickhouse.clone()));
    let project_rule_repo = Arc::new(ProjectRuleRepository::new(clickhouse.clone()));
    let org_repo = Arc::new(OrgRepository::new(clickhouse.clone()));
    let team_repo = Arc::new(TeamRepository::new(clickhouse.clone()));
    let coworking_session_repo = Arc::new(CoworkingSessionRepository::new(clickhouse.clone()));

    // Initialise Services
    let ai_stats_service = Arc::new(AiStatsService::new(clickhouse.clone()));
    let ai_diagnostics_service = Arc::new(AiDiagnosticsService::with_postgres(postgres.clone()));
    let delivery_status_service = Arc::new(
        crate::services::delivery_status::DeliveryStatusService::with_postgres(postgres.clone()),
    );
    let measurement_repair_service = Arc::new(
        crate::services::measurement_repair::MeasurementRepairService::new(
            postgres.clone(),
            heartbeat_repo.clone(),
        ),
    );
    let ai_certification_service =
        Arc::new(AiCertificationService::builtin().map_err(|error| {
            anyhow::anyhow!("failed to load AI certification catalog: {error}")
        })?);
    let account_analytics_service =
        Arc::new(AccountAnalyticsService::new(account_analytics_repo.clone()));
    let authorization_service = Arc::new(AuthorizationService::new(postgres.clone()));
    let enterprise_service = Arc::new(EnterpriseService::new(
        postgres.clone(),
        authorization_service.clone(),
    ));
    let billing_service = Arc::new(BillingService::new(
        postgres.clone(),
        authorization_service.clone(),
    ));
    let mut bridge_config = match config.agent_idle_timeout_seconds {
        Some(agent) => BridgeConfig::split(config.idle_timeout_seconds, agent),
        None => BridgeConfig::single(config.idle_timeout_seconds),
    };
    bridge_config.combined_v2 = config.duration_combined_v2;
    bridge_config.primary_mode = config.duration_primary_mode;
    let dashboard_analytics_service = Arc::new(DashboardAnalyticsService::new(
        clickhouse.clone(),
        bridge_config,
    ));
    let all_time_service = Arc::new(AllTimeService::new(clickhouse.clone(), bridge_config));
    // Master key for credentials the product must show again (the dashboard API
    // key today). Unset in local dev without ATOAXIS_KMS_KEY_ID — keys then stay
    // hash-only and reads return blank, the pre-existing behaviour.
    let credential_secret_box = match &config.credential_master_key {
        Some(raw) => Some(Arc::new(
            crate::infrastructure::secret_box::SecretBox::from_env_value(raw)?,
        )),
        None => None,
    };
    let credential_vault: Option<Arc<dyn CredentialVault>> = credential_secret_box
        .clone()
        .map(|vault| vault as Arc<dyn CredentialVault>);
    let user_service = Arc::new(
        UserService::new(clickhouse.clone(), postgres.clone(), credential_secret_box)
            .with_ingest_state(config.brokers.ingest_state_source, postgres.clone()),
    );
    let duration_service = Arc::new(DurationService::new(clickhouse.clone(), bridge_config));
    let external_duration_service =
        Arc::new(ExternalDurationService::new(external_duration_repo.clone()));
    let follow_up_service = Arc::new(FollowUpService::new(follow_up_repo.clone()));
    let object_store = crate::infrastructure::object_store::S3ObjectStore::from_env()?
        .map(|store| Arc::new(store) as Arc<dyn ObjectStore>);
    let export_service = Arc::new(ExportService::new(
        postgres.clone(),
        clickhouse.clone(),
        object_store.clone(),
        config.export_mode,
    ));
    if config.export_mode == ExportMode::Job && !export_service.processor_ready() {
        anyhow::bail!(
            "ATOAXIS_EXPORT_MODE=job requires PostgreSQL and a configured S3 object store"
        );
    }
    let job_service = Arc::new(JobService::new(postgres.clone()));
    let account_deletion_service = Arc::new(AccountDeletionService::new(
        postgres.clone(),
        clickhouse.clone(),
        object_store.clone(),
        redis_presence.clone(),
        config.account_deletion_mode,
    ));
    if config.account_deletion_mode == crate::config::AccountDeletionMode::Job
        && !account_deletion_service.processor_ready()
    {
        anyhow::bail!(
            "ATOAXIS_ACCOUNT_DELETION_MODE=job requires PostgreSQL and a configured S3 object store"
        );
    }
    let profile_service = Arc::new(ProfileService::new(postgres.clone()));
    let report_service = Arc::new(ReportService::new(postgres.clone()));
    let activity_timeline_service = Arc::new(ActivityTimelineService::new(
        clickhouse.clone(),
        bridge_config,
    ));
    // Constructed after the timeline: commit and pull-request attribution reads the
    // canonical timeline rather than deriving its own durations.
    let vcs_service = Arc::new(
        VcsService::new(
            postgres.clone(),
            authorization_service.clone(),
            activity_timeline_service.clone(),
        )
        .with_credential_vault(credential_vault.clone()),
    );
    let insights_service = Arc::new(InsightsService::new(clickhouse.clone(), bridge_config));
    let integration_service = Arc::new(
        IntegrationService::new(postgres.clone()).with_credential_vault(credential_vault.clone()),
    );
    let leaderboard_service = Arc::new(LeaderboardService::new(
        postgres.clone(),
        authorization_service.clone(),
    ));
    let keystroke_stats_service = Arc::new(KeystrokeStatsService::new(clickhouse.clone()));
    let project_merge_service = Arc::new(ProjectMergeService::new(project_merge_repo.clone()));
    let project_identity_service = Arc::new(ProjectIdentityService::new(
        project_identity_repo.clone(),
        project_merge_repo.clone(),
    ));
    let ai_usage_service = Arc::new(AiUsageService::new(
        ai_usage_repo.clone(),
        project_identity_service.clone(),
        postgres.clone(),
    ));
    let project_analytics_service = Arc::new(ProjectAnalyticsService::new(
        project_analytics_repo.clone(),
        project_identity_service.clone(),
        config.jwt_secret.clone(),
        clickhouse.clone(),
        bridge_config,
    ));
    let heartbeat_service = Arc::new(HeartbeatService::new(
        heartbeat_repo.clone(),
        project_identity_service.clone(),
    ));
    let heartbeat_ingest_service = Arc::new(HeartbeatIngestService::new(
        config.clone(),
        heartbeat_service.clone(),
        event_bus.clone(),
        postgres.clone(),
    ));
    let goal_service = Arc::new(GoalService::with_clickhouse(
        postgres.clone(),
        clickhouse.clone(),
        bridge_config,
    ));
    let projects_service = Arc::new(ProjectsService::new(clickhouse.clone(), bridge_config));
    let project_rule_service = Arc::new(
        ProjectRuleService::new(project_rule_repo.clone())
            .with_ingest_state(config.brokers.ingest_state_source, postgres.clone()),
    );
    let reprocess_service = Arc::new(ReprocessService::new(
        postgres.clone(),
        clickhouse.clone(),
        project_rule_service.clone(),
        project_identity_service.clone(),
        account_analytics_service.clone(),
    ));
    let stats_service = Arc::new(StatsService::new(clickhouse.clone(), bridge_config));
    let summary_service = Arc::new(SummaryService::new(clickhouse.clone(), bridge_config));
    let wakatime_import_service = Arc::new(WakaTimeImportService::new(heartbeat_repo.clone()));
    let org_service = Arc::new(OrgService::new(org_repo.clone()));
    let organizations_service = Arc::new(OrganizationsService::new(
        postgres.clone(),
        authorization_service.clone(),
        presence_repo.clone(),
    ));
    let team_insights_service = Arc::new(crate::services::team_insights::TeamInsightsService::new(
        postgres.clone().map(|pg| {
            Arc::new(
                crate::repository::team_insights::TeamInsightsRepository::new(
                    pg,
                    clickhouse.clone(),
                ),
            )
        }),
        authorization_service.clone(),
        config.team_enabled,
    ));
    let oauth_service = Arc::new(OAuthService::new(postgres.clone()));
    let team_github_service = Arc::new(crate::services::team_github::TeamGithubService::new(
        postgres.clone().map(|pg| {
            Arc::new(crate::repository::team_github::GithubRepositoryStore::new(
                pg,
            ))
        }),
        authorization_service.clone(),
        credential_vault,
        postgres.clone().map(|pg| {
            Arc::new(
                crate::repository::team_insights::TeamInsightsRepository::new(
                    pg,
                    clickhouse.clone(),
                ),
            )
        }),
        config.team_enabled,
    )?);
    let team_service = Arc::new(TeamService::new(team_repo.clone(), org_service.clone()));
    let coworking_session_service =
        Arc::new(CoworkingSessionService::new(coworking_session_repo.clone()));

    Ok(AppState {
        config,
        clickhouse,
        postgres,
        event_bus,
        object_store,
        auth_rate_limiter,
        analytics_rate_limiter,
        presence_rate_limiter,
        ai_diagnostics_rate_limiter,
        presence,
        redis_presence,
        presence_repo,
        analytics_repo,
        external_duration_repo,
        follow_up_repo,
        account_analytics_repo,
        ai_usage_repo,
        heartbeat_repo,
        project_identity_repo,
        project_merge_repo,
        project_rule_repo,
        org_repo,
        team_repo,
        coworking_session_repo,
        ai_stats_service,
        ai_diagnostics_service,
        delivery_status_service,
        measurement_repair_service,
        ai_certification_service,
        account_analytics_service,
        billing_service,
        account_deletion_service,
        ai_usage_service,
        all_time_service,
        user_service,
        heartbeat_service,
        heartbeat_ingest_service,
        goal_service,
        duration_service,
        enterprise_service,
        vcs_service,
        external_duration_service,
        follow_up_service,
        export_service,
        job_service,
        profile_service,
        report_service,
        activity_timeline_service,
        insights_service,
        integration_service,
        leaderboard_service,
        keystroke_stats_service,
        project_identity_service,
        project_analytics_service,
        project_merge_service,
        projects_service,
        reprocess_service,
        project_rule_service,
        stats_service,
        dashboard_analytics_service,
        summary_service,
        wakatime_import_service,
        org_service,
        organizations_service,
        team_insights_service,
        team_github_service,
        oauth_service,
        team_service,
        coworking_session_service,
    })
}

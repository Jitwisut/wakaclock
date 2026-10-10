pub mod account_analytics;
pub mod account_deletion;
pub mod activity_timeline;
pub mod ai_certification;
pub mod ai_diagnostics;
pub mod ai_stats;
pub mod ai_usage;
pub mod all_time;
pub mod analytics_explorer;
pub mod authorization;
pub mod background_worker;
pub mod billing;
pub mod coworking_session;
pub mod dashboard_analytics;
pub mod delivery_status;
pub mod duration;
pub mod enterprise;
pub mod exports;
pub mod external_durations;
pub mod follow_up;
pub mod goals;
pub mod heartbeat;
pub mod heartbeat_ingest;
pub mod insights;
pub mod integrations;
pub mod jobs;
#[cfg(feature = "kafka")]
pub mod kafka_ai_usage;
#[cfg(feature = "kafka")]
pub mod kafka_heartbeat;
pub mod keystroke_stats;
pub mod leaderboards;
pub mod measurement_repair;
pub mod oauth;
pub mod org;
pub mod organizations;
pub mod profile;
pub mod project_analytics;
pub mod project_identity;
pub mod project_merge;
pub mod project_rule;
pub mod projects;
pub mod reports;
pub mod reprocess;
pub mod stats;
pub mod summary;
pub mod team;
pub mod team_billing;
pub mod team_insights;
pub mod team_release;
pub mod team_webhooks;
pub mod user;
pub mod vcs;
pub mod vcs_attribution;
pub mod wakatime_import;

/// Product surfaces that are deliberately fail-closed until their complete
/// runtime/provider contract is implemented and certified. Keeping this list
/// typed prevents a new route from inventing a capability key that is absent
/// from the capability matrix.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeFeature {
    DailyWeeklyMonthlyReports,
    CalendarIntegrations,
    PublicProfilesAndEmbeds,
    PrivateLeaderboards,
    SsoOidcSaml,
    Scim,
    SeatBillingEntitlements,
}

impl RuntimeFeature {
    pub const fn key(self) -> &'static str {
        match self {
            Self::DailyWeeklyMonthlyReports => "daily_weekly_monthly_reports",
            Self::CalendarIntegrations => "calendar_integrations",
            Self::PublicProfilesAndEmbeds => "public_profiles_and_embeds",
            Self::PrivateLeaderboards => "private_leaderboards",
            Self::SsoOidcSaml => "sso_oidc_saml",
            Self::Scim => "scim",
            Self::SeatBillingEntitlements => "seat_billing_entitlements",
        }
    }
}

/// Fail closed for a feature whose provider/runtime implementation is not yet
/// available. The indirection keeps call sites honest without relying on
/// unreachable-code allowances, and gives future enablement one gate to change.
pub fn require_runtime_feature(feature: RuntimeFeature) -> anyhow::Result<()> {
    anyhow::bail!(
        "feature {} is unavailable in this deployment",
        feature.key()
    )
}

/// Provider-backed job processors that are not yet implemented remain closed. Never
/// acknowledge or accept one of those operations until a durable worker and its
/// dependencies are available. Registered processors (reprocess, projection, export,
/// AI-session reconcile and account deletion) use the shared worker runtime instead.
pub fn require_background_processor() -> anyhow::Result<()> {
    anyhow::bail!("this background operation is unavailable in this build")
}

#[cfg(test)]
mod tests {
    use super::{require_runtime_feature, RuntimeFeature};

    #[test]
    fn disabled_runtime_feature_keys_are_stable_and_fail_closed() {
        let features = [
            (
                RuntimeFeature::DailyWeeklyMonthlyReports,
                "daily_weekly_monthly_reports",
            ),
            (
                RuntimeFeature::CalendarIntegrations,
                "calendar_integrations",
            ),
            (
                RuntimeFeature::PublicProfilesAndEmbeds,
                "public_profiles_and_embeds",
            ),
            (RuntimeFeature::PrivateLeaderboards, "private_leaderboards"),
            (RuntimeFeature::SsoOidcSaml, "sso_oidc_saml"),
            (RuntimeFeature::Scim, "scim"),
            (
                RuntimeFeature::SeatBillingEntitlements,
                "seat_billing_entitlements",
            ),
        ];
        for (feature, key) in features {
            assert_eq!(feature.key(), key);
            let error = require_runtime_feature(feature).expect_err("feature must be closed");
            assert!(error.to_string().contains(key));
        }
    }
}

pub mod team_github;
pub mod team_github_sync;
pub mod team_trust;

pub mod team_github_redelivery;

pub mod team_context;

pub mod team_merged_cost;

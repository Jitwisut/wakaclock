pub mod account_analytics;
pub mod ai_usage;
pub mod analytics;
pub mod canonical;
pub mod coworking_session;
pub mod external_durations;
pub mod follow_up;
pub mod heartbeat;
pub mod ingest_state;
pub mod org;
pub mod presence;
pub mod project_analytics;
pub mod project_identity;
pub mod project_merge;
pub mod project_rule;
pub mod team;
pub mod team_github;
pub mod team_insights;
#[cfg(test)]
mod team_privacy_tests;
pub mod team_webhooks;

pub mod presence_office;

pub mod team_trust;

#[cfg(test)]
mod team_trust_tests;

pub mod team_store_retention;

#[cfg(test)]
mod team_github_tests;

pub mod copilot_daily;

pub mod copilot_reports;

#[cfg(test)]
mod copilot_reports_tests;

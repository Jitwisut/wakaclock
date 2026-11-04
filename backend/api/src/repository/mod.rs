pub mod account_analytics;
pub mod agent_universe;
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
pub mod project_city;
pub mod project_identity;
pub mod project_merge;
pub mod project_rule;
pub mod team;
pub mod team_github;
pub mod team_github_replay;
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
pub mod team_actions;
#[cfg(test)]
mod team_actions_tests;

#[cfg(test)]
mod copilot_reports_tests;

#[cfg(test)]
mod team_cost_equations_tests;
#[cfg(test)]
mod team_cost_tests;
#[cfg(test)]
mod team_readiness_tests;

pub mod team_stripe;
#[cfg(test)]
mod team_stripe_tests;

pub mod team_stripe_customer;
mod team_stripe_customer_lookup;
mod team_stripe_customer_recovery;
mod team_stripe_customer_resolution;

pub mod team_stripe_quote;

pub mod team_stripe_checkout;
pub mod team_stripe_checkout_control;
pub mod team_stripe_checkout_projection;

pub mod team_seats;

pub mod team_analytics_entitlement;
pub mod team_organization_birth;
pub mod team_organization_recovery;
pub mod team_pilot;
pub mod team_stripe_portal;
pub mod team_subscription_cancellation;
pub mod team_trial;
pub mod team_upgrade_preview;

pub mod team_usage_admissions;

pub mod team_usage_scan;

pub mod copilot_admission;

pub mod team_financial_guard;
pub mod team_financial_ingress;
pub mod team_financial_inventory;

pub mod team_financial_recovery;
pub mod team_financial_transaction_recovery;

mod team_financial_locks;

pub(crate) mod user_identity_sync;

mod team_financial_transaction;
#[cfg(test)]
mod team_financial_transaction_tests;

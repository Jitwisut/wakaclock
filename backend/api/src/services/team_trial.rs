//! Self-service trial contract. Configuration is a rollout prerequisite, never a
//! replacement for current Owner, enrollment, consent or privacy proofs.
use anyhow::{ensure, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const FLAG: &str = "ATOAXIS_TEAM_SELF_SERVICE_TRIAL_ENABLED";
pub fn enabled() -> Result<bool> {
    match std::env::var(FLAG) {
        Ok(value) => parse_flag(Some(&value)),
        Err(std::env::VarError::NotPresent) => Ok(false),
        Err(_) => anyhow::bail!("team_trial_configuration_invalid"),
    }
}
fn parse_flag(value: Option<&str>) -> Result<bool> {
    match value {
        None | Some("0" | "false") => Ok(false),
        Some("1" | "true") => Ok(true),
        _ => anyhow::bail!("team_trial_configuration_invalid"),
    }
}
pub(crate) fn require_enabled() -> Result<()> {
    ensure!(enabled()?, super::team_insights::TeamError::Disabled);
    Ok(())
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StartTrial {
    pub package_seats: u16,
    pub confirm: bool,
}
impl StartTrial {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.confirm && super::team_billing::PACKAGES.contains(&self.package_seats),
            super::team_insights::TeamError::Invalid("confirm a supported trial package")
        );
        Ok(())
    }
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecoverTrial {
    pub transition_id: Uuid,
    pub expected_revision: i64,
    pub confirm: bool,
}
impl RecoverTrial {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.confirm && !self.transition_id.is_nil() && self.expected_revision == 1,
            super::team_insights::TeamError::Invalid(
                "confirm the original initial trial transition"
            )
        );
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Disposition {
    NotStarted,
    Active,
    Expired,
    SubscriptionManaged,
    RecoveryRequired,
    Unconfirmed,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Recovery {
    pub transition_id: Uuid,
    pub expected_revision: i64,
}
#[derive(Debug, Clone, Serialize)]
pub struct TrialStatus {
    pub disposition: Disposition,
    pub package_seats: Option<i32>,
    pub developer_seats: i64,
    pub trial_started_at: Option<DateTime<Utc>>,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub entitlement_revision: Option<i64>,
    pub observed_at: DateTime<Utc>,
    pub can_start: bool,
    pub recovery: Option<Recovery>,
    pub reason: Option<&'static str>,
    pub analytics_status: &'static str,
    pub analytics_reason: &'static str,
    pub trial_days: i64,
    pub packages: Vec<u16>,
    pub payment_card_required: bool,
    pub personal_capture_affected: bool,
    #[serde(skip)]
    pub(crate) fence: super::super::repository::team_trial::Fence,
}

pub(crate) fn project(
    current: Option<&super::team_analytics_entitlement::State>,
    recovery: Option<Recovery>,
    financial_confirmed: bool,
    developer_seats: i64,
    purchase_exists: bool,
    now: DateTime<Utc>,
    fence: crate::repository::team_trial::Fence,
) -> TrialStatus {
    let known = financial_confirmed || recovery.is_some();
    let disposition = if recovery.is_some() {
        Disposition::RecoveryRequired
    } else if !financial_confirmed {
        Disposition::Unconfirmed
    } else if let Some(state) = current {
        if state.ever_paid {
            Disposition::SubscriptionManaged
        } else if now < state.trial_ends_at {
            Disposition::Active
        } else {
            Disposition::Expired
        }
    } else {
        Disposition::NotStarted
    };
    let can_start =
        disposition == Disposition::NotStarted && !purchase_exists && developer_seats <= 100;
    let reason = if !known {
        Some("financial_history_unconfirmed")
    } else if disposition == Disposition::NotStarted && purchase_exists {
        Some("existing_purchase_requires_review")
    } else if disposition == Disposition::NotStarted && developer_seats > 100 {
        Some("developer_capacity_exceeded")
    } else {
        None
    };
    let current = if known { current } else { None };
    TrialStatus {
        disposition,
        package_seats: current.map(|s| s.package_seats),
        developer_seats,
        trial_started_at: current.map(|s| s.trial_started_at),
        trial_ends_at: current.map(|s| s.trial_ends_at),
        entitlement_revision: current.map(|s| s.revision),
        observed_at: now,
        can_start,
        recovery,
        reason,
        analytics_status: "unconfirmed",
        analytics_reason: "independent_privacy_proof_pending",
        trial_days: super::team_billing::TRIAL_DAYS,
        packages: super::team_billing::PACKAGES.to_vec(),
        payment_card_required: false,
        personal_capture_affected: false,
        fence,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn default_off_and_explicit_terms_cannot_supply_time_state_or_identity() {
        for value in [None, Some("0"), Some("false")] {
            assert!(!parse_flag(value).unwrap());
        }
        for value in [Some("1"), Some("true")] {
            assert!(parse_flag(value).unwrap());
        }
        for value in [Some("yes"), Some(""), Some("TRUE")] {
            assert!(parse_flag(value).is_err());
        }
        assert!(StartTrial {
            package_seats: 10,
            confirm: true
        }
        .validate()
        .is_ok());
        assert!(StartTrial {
            package_seats: 11,
            confirm: true
        }
        .validate()
        .is_err());
        assert!(StartTrial {
            package_seats: 10,
            confirm: false
        }
        .validate()
        .is_err());
        assert!(serde_json::from_value::<StartTrial>(
            serde_json::json!({"package_seats":10,"confirm":true,"started_at":"2020-01-01"})
        )
        .is_err());
        let recovery = RecoverTrial {
            transition_id: Uuid::now_v7(),
            expected_revision: 1,
            confirm: true,
        };
        assert!(recovery.validate().is_ok());
        assert!(RecoverTrial {
            expected_revision: 2,
            ..recovery
        }
        .validate()
        .is_err());
        assert!(serde_json::from_value::<RecoverTrial>(serde_json::json!({"transition_id":Uuid::now_v7(),"expected_revision":1,"confirm":true,"user_id":Uuid::now_v7()})).is_err());
    }
    #[test]
    fn trial_projection_separates_commit_recovery_expiry_and_analytics_readiness() {
        use super::super::team_analytics_entitlement::State;
        let now = Utc::now();
        let current = State::trial(10, now).unwrap();
        let project_case = |state: Option<&State>,
                            recovery: Option<Recovery>,
                            confirmed: bool,
                            developers,
                            purchase,
                            at| {
            project(
                state,
                recovery,
                confirmed,
                developers,
                purchase,
                at,
                crate::repository::team_trial::Fence::fixture(),
            )
        };
        let empty = project_case(None, None, true, 1, false, now);
        assert_eq!(empty.disposition, Disposition::NotStarted);
        assert!(empty.can_start);
        assert_eq!(empty.trial_started_at, None);
        assert_eq!(empty.analytics_status, "unconfirmed");
        assert!(!project_case(None, None, true, 1, true, now).can_start);
        assert!(!project_case(None, None, true, 101, false, now).can_start);
        let unknown = project_case(Some(&current), None, false, 1, false, now);
        assert_eq!(unknown.disposition, Disposition::Unconfirmed);
        assert_eq!(unknown.trial_started_at, None);
        assert_eq!(unknown.package_seats, None);
        assert!(!unknown.can_start);
        let pending = project_case(
            Some(&current),
            Some(Recovery {
                transition_id: Uuid::now_v7(),
                expected_revision: 1,
            }),
            false,
            1,
            false,
            now,
        );
        assert_eq!(pending.disposition, Disposition::RecoveryRequired);
        assert_eq!(pending.trial_started_at, Some(current.trial_started_at));
        assert!(!pending.can_start);
        let active = project_case(Some(&current), None, true, 10, false, now);
        assert_eq!(active.disposition, Disposition::Active);
        assert!(!active.can_start);
        let expired = project_case(Some(&current), None, true, 10, false, current.trial_ends_at);
        assert_eq!(expired.disposition, Disposition::Expired);
        assert_eq!(expired.trial_ends_at, Some(current.trial_ends_at));
        assert!(!expired.can_start);
        let mut paid = current.clone();
        paid.ever_paid = true;
        assert_eq!(
            project_case(Some(&paid), None, true, 10, false, now).disposition,
            Disposition::SubscriptionManaged
        );
        let json = serde_json::to_string(&active).unwrap();
        assert!(!json.contains("sql_hash"));
        assert!(!json.contains("token"));
        assert!(!active.personal_capture_affected && !active.payment_card_required);
    }
}

//! Commercial policy is separate from personal telemetry and duration capture.
use chrono::{DateTime, Duration, Utc};
use serde::Serialize;

pub const PACKAGES: [u16; 4] = [10, 25, 50, 100];
pub const TRIAL_DAYS: i64 = 14;
pub const GRACE_DAYS: i64 = 7;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubscriptionState {
    Trialing,
    Active,
    PastDue,
    Canceled,
    Incomplete,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct AnalyticsEntitlement {
    pub may_add_analytics: bool,
    pub may_read_retained: bool,
    pub may_export_retained: bool,
    pub personal_capture_affected: bool,
}

pub fn entitlement(
    state: SubscriptionState,
    now: DateTime<Utc>,
    period_end: DateTime<Utc>,
    first_payment_failure: Option<DateTime<Utc>>,
) -> AnalyticsEntitlement {
    let may_add = match state {
        SubscriptionState::Trialing | SubscriptionState::Active => now < period_end,
        SubscriptionState::PastDue => {
            first_payment_failure.is_some_and(|at| now < at + Duration::days(GRACE_DAYS))
        }
        SubscriptionState::Canceled | SubscriptionState::Incomplete => false,
    };
    AnalyticsEntitlement {
        may_add_analytics: may_add,
        may_read_retained: true,
        may_export_retained: true,
        personal_capture_affected: false,
    }
}

pub fn validate_downgrade(
    target: u16,
    developers_to_keep: Option<&[uuid::Uuid]>,
    current_developers: &[uuid::Uuid],
) -> anyhow::Result<()> {
    anyhow::ensure!(PACKAGES.contains(&target), "unsupported package");
    let Some(developers_to_keep) = developers_to_keep else {
        anyhow::ensure!(
            current_developers.len() <= target as usize,
            "select developers to keep before downgrade"
        );
        return Ok(());
    };
    let selected: std::collections::BTreeSet<_> = developers_to_keep.iter().copied().collect();
    anyhow::ensure!(
        selected.len() == developers_to_keep.len(),
        "duplicate retained seat"
    );
    anyhow::ensure!(
        selected.len() <= target as usize,
        "retained seats exceed package"
    );
    anyhow::ensure!(
        selected.iter().all(|id| current_developers.contains(id)),
        "retained seat is outside organization"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn grace_uses_first_failure_and_never_deletes_personal_data() {
        let at = Utc::now();
        let before = entitlement(
            SubscriptionState::PastDue,
            at + Duration::days(6),
            at,
            Some(at),
        );
        assert!(before.may_add_analytics);
        let after = entitlement(
            SubscriptionState::PastDue,
            at + Duration::days(7),
            at,
            Some(at),
        );
        assert!(!after.may_add_analytics);
        assert!(after.may_read_retained && after.may_export_retained);
        assert!(!after.personal_capture_affected);
        assert!(!entitlement(SubscriptionState::PastDue, at, at, None).may_add_analytics);
    }
    #[test]
    fn downgrade_cannot_choose_or_drop_seats_implicitly() {
        let users: Vec<_> = (1..=25).map(uuid::Uuid::from_u128).collect();
        assert!(validate_downgrade(10, None, &users).is_err());
        assert!(validate_downgrade(10, Some(&users[..8]), &users).is_ok());
        assert!(validate_downgrade(10, Some(&[users[0]; 10]), &users).is_err());
        assert!(validate_downgrade(11, Some(&users[..10]), &users).is_err());
    }
}

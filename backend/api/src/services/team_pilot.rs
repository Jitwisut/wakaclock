//! Local operator review of one Team pilot configuration. A referenced Owner
//! is not an authenticated caller. No consent, trial or payment is granted.
use anyhow::{ensure, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Policy {
    pub timezone: String,
    pub locked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Observation {
    pub enabled: bool,
    pub generation: i64,
    pub policy: Option<Policy>,
    pub published: bool,
    pub enrollment: String,
    pub privacy: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Body {
    pub schema: u8,
    pub id: Uuid,
    pub organization: Uuid,
    pub reviewed_owner: Uuid,
    pub namespace: Uuid,
    pub prepared_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub expected: Observation,
    pub enabled: bool,
    pub timezone: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Plan {
    pub(crate) body: Body,
    pub(crate) hash: String,
}

/// Fixed dispositions only. Never print SQL errors, paths or supplied values.
pub fn failure_code(error: &anyhow::Error) -> &'static str {
    const SAFE: &[&str] = &[
        "team_pilot_plan_invalid",
        "team_pilot_plan_expired_or_future",
        "team_pilot_explicit_approval_required",
        "team_pilot_timezone_locked",
        "team_pilot_timezone_invalid",
        "team_pilot_predecessor_changed_prepare_again",
        "team_pilot_operation_conflict",
        "team_pilot_namespace_changed",
        "team_pilot_reviewed_owner_no_longer_current",
        "team_pilot_rollout_evidence_missing",
        "team_pilot_global_feature_disabled",
        "team_pilot_commit_unconfirmed_retry_original_plan",
    ];
    for cause in error.chain() {
        let text = cause.to_string();
        if let Some(code) = SAFE.iter().find(|code| **code == text) {
            return code;
        }
    }
    "team_pilot_independent_evidence_or_dependency_unconfirmed"
}

impl Plan {
    pub(crate) fn new(body: Body) -> Result<Self> {
        let hash = super::team_financial_guard::fingerprint(&body)?;
        let plan = Self { body, hash };
        plan.validate()?;
        Ok(plan)
    }
    pub fn validate(&self) -> Result<()> {
        let b = &self.body;
        ensure!(
            b.schema == 1
                && ![b.id, b.organization, b.reviewed_owner, b.namespace].contains(&Uuid::nil())
                && b.id != b.organization
                && b.id != b.reviewed_owner
                && b.expected.generation >= 0
                && b.expires_at == b.prepared_at + Duration::minutes(15)
                && b.timezone.parse::<chrono_tz::Tz>().is_ok()
                && b.expected
                    .policy
                    .as_ref()
                    .is_none_or(|p| p.timezone.parse::<chrono_tz::Tz>().is_ok())
                && [&b.expected.privacy, &b.expected.enrollment]
                    .into_iter()
                    .all(|h| super::team_financial_recovery::digest(h))
                && self.hash == super::team_financial_guard::fingerprint(b)?,
            "team_pilot_plan_invalid"
        );
        ensure!(
            !(b.expected.published
                || b.expected
                    .policy
                    .as_ref()
                    .is_some_and(|p| p.locked_at.is_some()))
                || b.expected
                    .policy
                    .as_ref()
                    .is_some_and(|p| p.timezone == b.timezone),
            "team_pilot_timezone_locked"
        );
        Ok(())
    }
    pub(crate) fn require_fresh(&self, now: DateTime<Utc>) -> Result<()> {
        self.validate()?;
        ensure!(
            self.body.prepared_at <= now && now <= self.body.expires_at,
            "team_pilot_plan_expired_or_future"
        );
        Ok(())
    }
    pub fn approve(&self, hash: &str, pilot_only: bool, no_consent_change: bool) -> Result<()> {
        self.validate()?;
        ensure!(
            pilot_only && no_consent_change && hash == self.hash,
            "team_pilot_explicit_approval_required"
        );
        Ok(())
    }
    pub fn summary(&self) -> serde_json::Value {
        serde_json::json!({"schema_version":1,"operation_id":self.body.id,
            "organization_id":self.body.organization,"plan_hash":self.hash,
            "expires_at":self.body.expires_at,"enabled":self.body.enabled,"timezone":self.body.timezone,
            "actor_kind":"local_operator","applied":false,"starts_trial":false,
            "changes_consent":false,"production_ready":false})
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    pub(crate) fn fixture() -> Plan {
        let now = Utc::now();
        Plan::new(Body {
            schema: 1,
            id: Uuid::now_v7(),
            organization: Uuid::now_v7(),
            reviewed_owner: Uuid::now_v7(),
            namespace: Uuid::now_v7(),
            prepared_at: now,
            expires_at: now + Duration::minutes(15),
            expected: Observation {
                enabled: false,
                generation: 1,
                policy: None,
                published: false,
                enrollment: "a".repeat(64),
                privacy: "b".repeat(64),
            },
            enabled: true,
            timezone: "Asia/Bangkok".into(),
        })
        .unwrap()
    }
    #[test]
    fn plan_is_exact_review_not_authority_and_timezone_changes_do_not_rewrite_history() {
        let plan = fixture();
        assert!(plan.approve(&plan.hash, true, true).is_ok());
        assert!(plan.approve(&plan.hash, false, true).is_err());
        assert!(plan.approve(&"c".repeat(64), true, true).is_err());
        assert!(plan
            .require_fresh(plan.body.expires_at + Duration::microseconds(1))
            .is_err());
        assert!(plan
            .require_fresh(plan.body.prepared_at - Duration::microseconds(1))
            .is_err());
        let mut changed = plan.body.clone();
        changed.expected.policy = Some(Policy {
            timezone: "UTC".into(),
            locked_at: None,
        });
        changed.expected.published = true;
        assert!(Plan::new(changed.clone()).is_err());
        changed.timezone = "UTC".into();
        assert!(Plan::new(changed).is_ok());
        let mut tampered = plan.clone();
        tampered.body.enabled = false;
        assert!(tampered.validate().is_err());
        assert!(serde_json::from_value::<Plan>(
            serde_json::json!({"body":plan.body,"hash":plan.hash,"credential":"synthetic"})
        )
        .is_err());
    }
    #[test]
    fn private_plan_roundtrip_never_overwrites_or_follows_a_link() {
        let root = std::env::temp_dir()
            .canonicalize()
            .unwrap()
            .join(format!("atoaxis-pilot-plan-{}", Uuid::now_v7()));
        std::fs::create_dir(&root).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        let path = root.join("plan.json");
        let plan = fixture();
        crate::infrastructure::team_pilot_plan::write(&path, &plan).unwrap();
        assert_eq!(
            crate::infrastructure::team_pilot_plan::read(&path).unwrap(),
            plan
        );
        assert!(crate::infrastructure::team_pilot_plan::write(&path, &plan).is_err());
        #[cfg(unix)]
        {
            use std::os::unix::fs::{symlink, PermissionsExt};
            let alias = root.join("alias.json");
            symlink(&path, &alias).unwrap();
            assert!(crate::infrastructure::team_pilot_plan::read(&alias).is_err());
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
            assert!(crate::infrastructure::team_pilot_plan::read(&path).is_err());
        }
        std::fs::remove_dir_all(root).unwrap();
    }
}

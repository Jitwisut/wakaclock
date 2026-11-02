//! Explicit operator plans. A plan/approval is never payment or tenant authority.
use super::{team_financial_guard::fingerprint, team_financial_ingress::Scope};
use anyhow::{ensure, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub(crate) fn digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    ProspectiveBootstrap,
    ResumeBootstrap { target: Uuid },
    ResolvePendingReceipt { target: Uuid },
    ConfirmCommittedTransaction { target: Uuid, proposal_hash: String },
    NoChange,
    Blocked { reason: Reason },
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Reason {
    HistoricalEvidenceRequired,
    CommittedSqlMismatch,
    Conflict,
    PendingStateMismatch,
    AccountEvidenceAmbiguous,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Counts {
    pub inbox: u64,
    pub jobs: u64,
    pub financial_objects: u64,
    pub legacy_scope_unconfirmed: bool,
    pub independent_sources: u64,
}
impl Counts {
    pub(crate) fn empty_for_bootstrap(&self) -> bool {
        self.inbox == 0
            && self.jobs == 0
            && self.financial_objects == 0
            && !self.legacy_scope_unconfirmed
            && self.independent_sources == 0
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Body {
    pub schema: u8,
    pub id: Uuid,
    pub namespace: Uuid,
    pub scope: Scope,
    pub prepared_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub evidence_hash: String,
    pub account_fence: String,
    pub sql_fence: String,
    pub instance: String,
    pub counts: Counts,
    pub action: Action,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Plan {
    pub(crate) body: Body,
    pub(crate) digest: String,
}
impl Plan {
    pub(crate) fn new(body: Body) -> Result<Self> {
        let result = Self {
            digest: fingerprint(&body)?,
            body,
        };
        result.validate()?;
        Ok(result)
    }
    pub fn validate(&self) -> Result<()> {
        let b = &self.body;
        b.scope.key()?;
        ensure!(
            b.schema == 1
                && !b.id.is_nil()
                && !b.namespace.is_nil()
                && b.expires_at - b.prepared_at == Duration::minutes(15)
                && digest(&b.evidence_hash)
                && digest(&b.account_fence)
                && digest(&b.sql_fence)
                && digest(&b.instance)
                && fingerprint(b)? == self.digest,
            "financial_recovery_plan_invalid"
        );
        if let Action::ResumeBootstrap { target } | Action::ResolvePendingReceipt { target } =
            &b.action
        {
            ensure!(!target.is_nil(), "financial_recovery_target_invalid");
        }
        if b.action == Action::ProspectiveBootstrap {
            ensure!(
                b.counts.empty_for_bootstrap(),
                "financial_recovery_bootstrap_not_empty"
            );
        }
        if let Action::ConfirmCommittedTransaction {
            target,
            proposal_hash,
        } = &b.action
        {
            ensure!(
                !target.is_nil() && digest(proposal_hash),
                "financial_recovery_transaction_target_invalid"
            );
        }
        Ok(())
    }
    pub fn namespace(&self) -> Uuid {
        self.body.namespace
    }
    pub fn scope(&self) -> &Scope {
        &self.body.scope
    }
    pub fn plan_digest(&self) -> &str {
        &self.digest
    }
    pub fn summary(&self) -> serde_json::Value {
        serde_json::json!({"plan_id":self.body.id,"plan_digest":self.digest,"action":self.body.action,"counts":self.body.counts,"prepared_at":self.body.prepared_at,"expires_at":self.body.expires_at,"can_apply":!matches!(self.body.action,Action::NoChange|Action::Blocked{..}),"prospective_only":!matches!(self.body.action,Action::ConfirmCommittedTransaction{..}),"sql_replay":false,"financial_sources":"unconfirmed","product_authorization_enabled":false})
    }
    pub(crate) fn current_at(&self, now: DateTime<Utc>) -> Result<()> {
        self.validate()?;
        ensure!(
            now >= self.body.prepared_at && now < self.body.expires_at,
            "financial_recovery_plan_expired_or_clock_changed"
        );
        Ok(())
    }
}
/// Constructed only by an explicit local operator acknowledgment. The caller must
/// own the private authority/plan files; this is not an HTTP authorization token.
pub struct Approval {
    plan_digest: String,
}
impl Approval {
    pub fn reviewed(
        plan: &Plan,
        namespace: Uuid,
        scope: &Scope,
        plan_digest: &str,
        acknowledge_prospective_only: bool,
    ) -> Result<Self> {
        plan.validate()?;
        ensure!(
            acknowledge_prospective_only
                && !matches!(plan.body.action, Action::ConfirmCommittedTransaction { .. })
                && namespace == plan.body.namespace
                && scope == &plan.body.scope
                && plan_digest == plan.digest,
            "financial_recovery_explicit_review_required"
        );
        Ok(Self {
            plan_digest: plan_digest.into(),
        })
    }
    pub fn reviewed_transaction(
        plan: &Plan,
        namespace: Uuid,
        scope: &Scope,
        plan_digest: &str,
        acknowledge_readback_only: bool,
    ) -> Result<Self> {
        plan.validate()?;
        ensure!(
            acknowledge_readback_only
                && matches!(plan.body.action, Action::ConfirmCommittedTransaction { .. })
                && namespace == plan.body.namespace
                && scope == &plan.body.scope
                && plan_digest == plan.digest,
            "financial_recovery_explicit_transaction_review_required"
        );
        Ok(Self {
            plan_digest: plan_digest.into(),
        })
    }
    pub(crate) fn check(&self, plan: &Plan) -> Result<()> {
        plan.validate()?;
        ensure!(
            self.plan_digest == plan.digest,
            "financial_recovery_approval_changed"
        );
        Ok(())
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    pub fn fixture() -> Plan {
        let now = Utc::now();
        Plan::new(Body {
            schema: 1,
            id: Uuid::now_v7(),
            namespace: Uuid::now_v7(),
            scope: Scope {
                account: "acct_plan".into(),
                live: false,
            },
            prepared_at: now,
            expires_at: now + Duration::minutes(15),
            evidence_hash: "a".repeat(64),
            account_fence: "b".repeat(64),
            sql_fence: "c".repeat(64),
            instance: "d".repeat(64),
            counts: Counts {
                inbox: 0,
                jobs: 0,
                financial_objects: 0,
                legacy_scope_unconfirmed: false,
                independent_sources: 0,
            },
            action: Action::ProspectiveBootstrap,
        })
        .unwrap()
    }
    #[test]
    fn transaction_review_cannot_use_bootstrap_approval_or_change_fences() {
        let legacy = fixture();
        assert!(Approval::reviewed_transaction(
            &legacy,
            legacy.namespace(),
            legacy.scope(),
            legacy.plan_digest(),
            true
        )
        .is_err());
        let mut body = legacy.body;
        body.action = Action::ConfirmCommittedTransaction {
            target: Uuid::now_v7(),
            proposal_hash: "e".repeat(64),
        };
        let plan = Plan::new(body).unwrap();
        assert!(Approval::reviewed(
            &plan,
            plan.namespace(),
            plan.scope(),
            plan.plan_digest(),
            true
        )
        .is_err());
        assert!(Approval::reviewed_transaction(
            &plan,
            plan.namespace(),
            plan.scope(),
            plan.plan_digest(),
            false
        )
        .is_err());
        let approval = Approval::reviewed_transaction(
            &plan,
            plan.namespace(),
            plan.scope(),
            plan.plan_digest(),
            true,
        )
        .unwrap();
        approval.check(&plan).unwrap();
        for field in ["transaction", "proposal", "sql", "instance", "account"] {
            let mut changed = plan.clone();
            match field {
                "transaction" => {
                    let Action::ConfirmCommittedTransaction { target, .. } =
                        &mut changed.body.action
                    else {
                        unreachable!()
                    };
                    *target = Uuid::now_v7();
                }
                "proposal" => {
                    let Action::ConfirmCommittedTransaction { proposal_hash, .. } =
                        &mut changed.body.action
                    else {
                        unreachable!()
                    };
                    *proposal_hash = "f".repeat(64);
                }
                "sql" => changed.body.sql_fence = "f".repeat(64),
                "instance" => changed.body.instance = "f".repeat(64),
                _ => changed.body.scope.live = true,
            }
            assert!(changed.validate().is_err());
            let rehashed = Plan::new(changed.body).unwrap();
            assert!(approval.check(&rehashed).is_err());
        }
        let mut body = plan.body.clone();
        body.action = Action::ConfirmCommittedTransaction {
            target: Uuid::nil(),
            proposal_hash: "e".repeat(64),
        };
        assert!(Plan::new(body).is_err());
    }
    #[test]
    fn exact_plan_approval_target_evidence_and_expiry_are_binding() {
        let p = fixture();
        assert!(Approval::reviewed(&p, p.namespace(), p.scope(), p.plan_digest(), false).is_err());
        let approval =
            Approval::reviewed(&p, p.namespace(), p.scope(), p.plan_digest(), true).unwrap();
        approval.check(&p).unwrap();
        for changed in ["evidence", "account", "action", "expiry"] {
            let mut x = p.clone();
            match changed {
                "evidence" => x.body.evidence_hash = "e".repeat(64),
                "account" => x.body.scope.live = true,
                "action" => x.body.action = Action::NoChange,
                _ => x.body.expires_at += Duration::seconds(1),
            };
            assert!(x.validate().is_err());
            assert!(approval.check(&x).is_err());
        }
        assert!(p
            .current_at(p.body.prepared_at - Duration::seconds(1))
            .is_err());
        assert!(p.current_at(p.body.expires_at).is_err());
        assert!(p.current_at(p.body.prepared_at).is_ok());
        let mut scope = p.scope().clone();
        scope.account = "acct_other".into();
        assert!(Approval::reviewed(&p, p.namespace(), &scope, p.plan_digest(), true).is_err());
    }
}

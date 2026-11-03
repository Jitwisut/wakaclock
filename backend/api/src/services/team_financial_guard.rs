//! Independent enrollment/entitlement history. This proof does not reconstruct
//! Stripe bindings, quotes, external outcomes or payment observations.
use super::team_analytics_entitlement::State;
use super::team_organization_birth::{BirthConfirmation, BirthEntry, OrganizationBirth};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Head {
    Legacy,
    FreshUnenrolled { creation: Uuid },
    Enrolled { state: Box<State> },
    Quarantined,
    Deleted,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Pending {
    pub transition_id: Uuid,
    pub state: Box<State>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub head: Head,
    pub pending: Option<Pending>,
    pub committed_transition_id: Option<Uuid>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Event {
    FinancialTransaction {
        event: Box<super::team_financial_transaction::Event>,
    },
    FinancialIngress {
        event: Box<super::team_financial_ingress::Event>,
    },
    FinancialSource {
        event: Box<super::team_financial_source::Event>,
    },
    Initialize {
        namespace: Uuid,
        created_at: DateTime<Utc>,
        legacy_organizations: Vec<Uuid>,
    },
    PrepareOrganizationBirth {
        birth: Box<OrganizationBirth>,
    },
    ConfirmOrganizationBirth {
        organization: Uuid,
        creation: Uuid,
        metadata_hash: String,
    },
    ConfirmOrganizationBirthReviewed {
        confirmation: Box<BirthConfirmation>,
    },
    RegisterLegacy {
        organization: Uuid,
    },
    Prepare {
        organization: Uuid,
        expected: Head,
        transition: Pending,
    },
    Commit {
        organization: Uuid,
        transition_id: Uuid,
    },
    Quarantine {
        organization: Uuid,
    },
    Delete {
        organization: Uuid,
    },
}
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Snapshot {
    pub namespace: Option<Uuid>,
    pub organizations: BTreeMap<Uuid, Entry>,
    pub births: BTreeMap<Uuid, BirthEntry>,
    pub sources: super::team_financial_source::Snapshot,
    pub ingress: super::team_financial_ingress::Snapshot,
    pub transactions: super::team_financial_transaction::Snapshot,
    pub(super) used_enrollment_transitions: BTreeSet<Uuid>,
}
impl Snapshot {
    pub fn apply(&mut self, event: &Event) -> Result<()> {
        if let Event::FinancialTransaction { event } = event {
            let Some(change) = self.transactions.plan(self, event)? else {
                return Ok(());
            };
            // Validate every member on a full clone. Any failure retains the
            // complete old group/heads; there is no partially prepared intent.
            let mut next = self.clone();
            for member in &change.members {
                next.apply_member(member, true)?;
            }
            next.transactions.groups.insert(change.id, change.entry);
            *self = next;
            return Ok(());
        }
        self.transactions.fence(event)?;
        self.apply_member(event, false)
    }
    fn apply_member(&mut self, event: &Event, grouped: bool) -> Result<()> {
        if let Event::Initialize {
            namespace,
            legacy_organizations,
            ..
        } = event
        {
            ensure!(
                self.namespace.is_none(),
                "financial_guard_already_initialized"
            );
            ensure!(!namespace.is_nil(), "financial_guard_namespace_invalid");
            let ids = legacy_organizations
                .iter()
                .copied()
                .collect::<std::collections::BTreeSet<_>>();
            ensure!(
                ids.len() == legacy_organizations.len() && !ids.contains(&Uuid::nil()),
                "financial_guard_roster_invalid"
            );
            self.namespace = Some(*namespace);
            self.organizations = ids
                .into_iter()
                .map(|id| {
                    (
                        id,
                        Entry {
                            head: Head::Legacy,
                            pending: None,
                            committed_transition_id: None,
                        },
                    )
                })
                .collect();
            return Ok(());
        }
        ensure!(self.namespace.is_some(), "financial_guard_not_initialized");
        if let Event::FinancialIngress { event } = event {
            return self.ingress.apply(event);
        }
        if let Event::FinancialSource { event } = event {
            use super::team_financial_source::{Event as SourceEvent, FreezeReason};
            let scope = event.scope();
            let roster = self.organizations.get(&scope.organization);
            let evidence_only = matches!(
                event.as_ref(),
                SourceEvent::Outcome { .. }
                    | SourceEvent::RejectedOutcome { .. }
                    | SourceEvent::CustomerLookup { .. }
                    | SourceEvent::CheckoutObservation { .. }
                    | SourceEvent::CancellationObservation { .. }
                    | SourceEvent::CancellationFailure { .. }
                    | SourceEvent::CheckoutFailure { .. }
                    | SourceEvent::Freeze { .. }
            );
            if !evidence_only {
                if self.births.contains_key(&scope.organization) {
                    self.confirmed_birth(scope.organization)?;
                }
                let roster = roster.context("financial_guard_unknown_organization")?;
                ensure!(
                    !matches!(roster.head, Head::Quarantined | Head::Deleted),
                    "financial_guard_organization_closed"
                );
                if matches!(event.as_ref(), SourceEvent::Dispatch { .. }) {
                    ensure!(
                        roster.pending.is_none(),
                        "financial_guard_reconciliation_required"
                    );
                }
            }
            let mut sources = self.sources.clone();
            sources.apply(event)?;
            if let SourceEvent::CustomerLookup { observation, .. } = event.as_ref() {
                let authorized=self.transactions.groups.values().any(|g|g.committed
                    && g.proposal.account.account==scope.account && g.proposal.account.live==scope.live
                    && g.proposal.writer.as_ref().is_some_and(|w|matches!(w,
                        super::team_financial_transaction::Writer::CustomerRecoveryAuthorization{
                            organization,request,actor,expected_revision,authorized_at
                        } if *organization==scope.organization && request.operation==observation.operation
                            && request.request_hash==observation.request_hash && *actor==observation.actor
                            && expected_revision.checked_add(1)==Some(observation.authorization_revision)
                            && observation.observed_at>=*authorized_at
                            && fingerprint(w).is_ok_and(|h|h==observation.authorization_hash))));
                if !authorized {
                    sources.apply(&SourceEvent::Freeze {
                        scope: scope.clone(),
                        reason: FreezeReason::RequestIdentityConflict,
                    })?;
                }
            }
            if evidence_only {
                let reason = match roster {
                    None => Some(FreezeReason::OrganizationUnconfirmed),
                    Some(_)
                        if self
                            .births
                            .get(&scope.organization)
                            .is_some_and(|b| !b.confirmed) =>
                    {
                        Some(FreezeReason::OrganizationUnconfirmed)
                    }
                    Some(entry) if matches!(entry.head, Head::Quarantined | Head::Deleted) => {
                        Some(FreezeReason::OrganizationClosed)
                    }
                    _ => None,
                };
                if let Some(reason) = reason {
                    sources.apply(&SourceEvent::Freeze {
                        scope: scope.clone(),
                        reason,
                    })?;
                }
            }
            self.sources = sources;
            return Ok(());
        }
        if let Event::PrepareOrganizationBirth { birth } = event {
            birth.validate()?;
            ensure!(
                Some(birth.namespace) == self.namespace,
                "onboarding_namespace_mismatch"
            );
            self.transactions
                .require_organization_free(birth.organization)?;
            if let Some(old) = self.births.get(&birth.organization) {
                ensure!(old.birth == **birth, "onboarding_birth_conflict");
                return Ok(()); // Retained fact only; never reopen a closed/enrolled head.
            }
            let ids = birth.reserved_ids();
            ensure!(
                ids.iter().all(|id| !self.identity_known(*id)),
                "onboarding_identity_already_known"
            );
            ensure!(
                !self
                    .sources
                    .scopes
                    .values()
                    .any(|e| e.scope.organization == birth.organization)
                    && !self.transactions.groups.values().any(|g| g
                        .proposal
                        .sources
                        .iter()
                        .any(|s| s.scope.organization == birth.organization)
                        || g.proposal
                            .enrollments
                            .iter()
                            .any(|e| e.organization == birth.organization)),
                "onboarding_scope_already_known"
            );
            self.births.insert(
                birth.organization,
                BirthEntry {
                    birth: (**birth).clone(),
                    confirmed: false,
                    confirmations: BTreeMap::new(),
                },
            );
            self.organizations.insert(
                birth.organization,
                Entry {
                    head: Head::FreshUnenrolled {
                        creation: birth.creation,
                    },
                    pending: None,
                    committed_transition_id: None,
                },
            );
            return Ok(());
        }
        if let Event::ConfirmOrganizationBirthReviewed { confirmation } = event {
            confirmation.validate()?;
            self.transactions
                .require_organization_free(confirmation.organization)?;
            let org = self
                .organizations
                .get(&confirmation.organization)
                .context("onboarding_birth_missing")?;
            ensure!(
                !matches!(org.head, Head::Deleted | Head::Quarantined) && org.pending.is_none(),
                "onboarding_workspace_closed_or_pending"
            );
            let entry = self
                .births
                .get(&confirmation.organization)
                .context("onboarding_birth_missing")?;
            ensure!(
                entry.birth.creation == confirmation.creation
                    && entry.birth.digest()? == confirmation.birth_digest,
                "onboarding_birth_confirmation_conflict"
            );
            if let Some(old) = entry.confirmations.get(&confirmation.id) {
                ensure!(
                    old == confirmation.as_ref(),
                    "onboarding_confirmation_conflict"
                );
                return Ok(());
            }
            ensure!(
                !self.identity_known(confirmation.id),
                "onboarding_identity_already_known"
            );
            ensure!(
                entry.confirmations.len() < 100,
                "onboarding_confirmation_review_limit"
            );
            let entry = self
                .births
                .get_mut(&confirmation.organization)
                .context("onboarding_birth_missing")?;
            entry
                .confirmations
                .insert(confirmation.id, (**confirmation).clone());
            entry.confirmed = true;
            return Ok(());
        }
        if let Event::ConfirmOrganizationBirth {
            organization,
            creation,
            metadata_hash,
        } = event
        {
            self.transactions.require_organization_free(*organization)?;
            let entry = self
                .births
                .get_mut(organization)
                .context("onboarding_birth_missing")?;
            ensure!(
                entry.birth.creation == *creation && entry.birth.digest()? == *metadata_hash,
                "onboarding_birth_confirmation_conflict"
            );
            // Confirmation is historical evidence, never permission to reopen a
            // quarantined/deleted workspace or reset a later enrollment.
            entry.confirmed = true;
            return Ok(());
        }
        if let Event::RegisterLegacy { organization } = event {
            ensure!(
                !organization.is_nil() && !self.identity_known(*organization),
                "financial_guard_organization_already_known"
            );
            self.organizations.insert(
                *organization,
                Entry {
                    head: Head::Legacy,
                    pending: None,
                    committed_transition_id: None,
                },
            );
            return Ok(());
        }
        let org = match event {
            Event::Prepare { organization, .. }
            | Event::Commit { organization, .. }
            | Event::Quarantine { organization }
            | Event::Delete { organization } => organization,
            Event::PrepareOrganizationBirth { .. }
            | Event::ConfirmOrganizationBirth { .. }
            | Event::ConfirmOrganizationBirthReviewed { .. }
            | Event::Initialize { .. }
            | Event::FinancialTransaction { .. }
            | Event::RegisterLegacy { .. }
            | Event::FinancialSource { .. }
            | Event::FinancialIngress { .. } => unreachable!(),
        };
        if matches!(event, Event::Prepare { .. } | Event::Commit { .. })
            && self.births.contains_key(org)
        {
            self.confirmed_birth(*org)?;
        }
        if let Event::Prepare { transition, .. } = event {
            ensure!(
                !self.births.values().any(|b| b
                    .birth
                    .reserved_ids()
                    .contains(&transition.transition_id)
                    || b.confirmations.contains_key(&transition.transition_id)),
                "onboarding_identity_already_known"
            );
        }
        let entry = self
            .organizations
            .get_mut(org)
            .context("financial_guard_unknown_organization")?;
        match event {
            Event::Prepare {
                expected,
                transition,
                ..
            } => {
                ensure!(
                    grouped
                        || !self
                            .used_enrollment_transitions
                            .contains(&transition.transition_id),
                    "financial_guard_transition_id_reused"
                );
                ensure!(
                    entry.head == *expected && entry.pending.is_none(),
                    "financial_guard_predecessor_or_pending_conflict"
                );
                transition.state.validate()?;
                ensure!(
                    !transition.transition_id.is_nil(),
                    "financial_guard_transition_invalid"
                );
                match &entry.head {
                    Head::Legacy | Head::FreshUnenrolled { .. } => ensure!(
                        transition.state.revision == 1,
                        "financial_guard_initial_revision_invalid"
                    ),
                    Head::Enrolled { state } => ensure!(
                        transition.state.revision
                            == state
                                .revision
                                .checked_add(1)
                                .context("financial_guard_revision_overflow")?
                            && transition.state.activated_at == state.activated_at
                            && transition.state.trial_started_at == state.trial_started_at
                            && transition.state.trial_ends_at == state.trial_ends_at,
                        "financial_guard_trial_or_revision_changed"
                    ),
                    _ => anyhow::bail!("financial_guard_organization_closed"),
                }
                entry.pending = Some(transition.clone());
                self.used_enrollment_transitions
                    .insert(transition.transition_id);
            }
            Event::Commit { transition_id, .. } => {
                ensure!(
                    matches!(
                        entry.head,
                        Head::Legacy | Head::FreshUnenrolled { .. } | Head::Enrolled { .. }
                    ),
                    "financial_guard_organization_closed"
                );
                let pending = entry
                    .pending
                    .as_ref()
                    .context("financial_guard_no_pending_transition")?;
                ensure!(
                    pending.transition_id == *transition_id,
                    "financial_guard_transition_conflict"
                );
                entry.head = Head::Enrolled {
                    state: pending.state.clone(),
                };
                entry.committed_transition_id = Some(*transition_id);
                entry.pending = None;
            }
            Event::Quarantine { .. } => {
                ensure!(
                    entry.head != Head::Deleted,
                    "financial_guard_deleted_is_absorbing"
                );
                entry.head = Head::Quarantined;
                // Retain a proposal as evidence; quarantine never grants its coverage.
            }
            Event::Delete { .. } => entry.head = Head::Deleted,
            Event::PrepareOrganizationBirth { .. }
            | Event::ConfirmOrganizationBirth { .. }
            | Event::ConfirmOrganizationBirthReviewed { .. }
            | Event::Initialize { .. }
            | Event::FinancialTransaction { .. }
            | Event::RegisterLegacy { .. }
            | Event::FinancialSource { .. }
            | Event::FinancialIngress { .. } => unreachable!(),
        }
        if matches!(event, Event::Quarantine { .. } | Event::Delete { .. }) {
            self.sources.freeze_organization(*org);
        }
        Ok(())
    }
    /// Immutable independent birth proof; this alone grants no trial or consent.
    pub fn confirmed_birth(&self, org: Uuid) -> Result<&OrganizationBirth> {
        let entry = self.births.get(&org).context("onboarding_birth_missing")?;
        entry.birth.validate()?;
        ensure!(
            entry.confirmed
                && entry.birth.organization == org
                && Some(entry.birth.namespace) == self.namespace,
            "onboarding_birth_unconfirmed"
        );
        Ok(&entry.birth)
    }
    pub(crate) fn identity_known(&self, id: Uuid) -> bool {
        self.organizations.contains_key(&id)
            || self
                .births
                .values()
                .any(|b| b.birth.reserved_ids().contains(&id) || b.confirmations.contains_key(&id))
            || self.used_enrollment_transitions.contains(&id)
            || self.transactions.groups.contains_key(&id)
            || super::team_financial_transaction::operation_known(self, id)
            || self.sources.scopes.values().any(|s| {
                s.scope.organization == id
                    || s.used_transitions.contains_key(&id)
                    || s.review.as_ref().is_some_and(|r| r.id == id)
            })
            || self
                .ingress
                .accounts
                .values()
                .any(|a| a.used_transitions.contains_key(&id) || a.review == id)
            || self.ingress.bootstraps.values().any(|b| b.plan == id)
            || self.ingress.operator_reviews.contains_key(&id)
    }
    /// Exact committed agreement only. Caller must fence a DB observation between
    /// two equal independent ledger tokens. A proposal never permits analytics.
    pub fn verify(&self, org: Uuid, database: Option<&State>) -> Result<Head> {
        self.transactions.require_organization_free(org)?;
        let entry = self
            .organizations
            .get(&org)
            .context("financial_guard_unknown_organization")?;
        ensure!(
            entry.pending.is_none(),
            "financial_guard_reconciliation_required"
        );
        match (&entry.head, database) {
            (Head::Legacy, None) => Ok(Head::Legacy),
            (Head::FreshUnenrolled { creation }, None) => {
                let birth = self.confirmed_birth(org)?;
                ensure!(
                    birth.creation == *creation,
                    "onboarding_birth_head_conflict"
                );
                Ok(entry.head.clone())
            }
            (Head::Enrolled { state }, Some(observed)) => {
                state.validate()?;
                observed.validate()?;
                ensure!(
                    state.as_ref() == observed,
                    "financial_guard_database_head_mismatch"
                );
                Ok(entry.head.clone())
            }
            _ => anyhow::bail!("financial_guard_database_or_scope_unconfirmed"),
        }
    }
}
pub fn fingerprint<T: Serialize>(value: &T) -> Result<String> {
    Ok(format!("{:x}", Sha256::digest(serde_json::to_vec(value)?)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;
    fn initial() -> (Snapshot, Uuid, State) {
        let org = Uuid::now_v7();
        let mut s = Snapshot::default();
        s.apply(&Event::Initialize {
            namespace: Uuid::now_v7(),
            created_at: Utc::now(),
            legacy_organizations: vec![org],
        })
        .unwrap();
        (s, org, State::trial(10, Utc::now()).unwrap())
    }
    #[test]
    fn pre_enrollment_restore_unknown_and_uncommitted_proposal_fail_closed() {
        let (mut s, org, state) = initial();
        assert_eq!(s.verify(org, None).unwrap(), Head::Legacy);
        assert!(s.verify(Uuid::now_v7(), None).is_err());
        let id = Uuid::now_v7();
        s.apply(&Event::Prepare {
            organization: org,
            expected: Head::Legacy,
            transition: Pending {
                transition_id: id,
                state: state.clone().into(),
            },
        })
        .unwrap();
        assert!(s.verify(org, None).is_err());
        assert!(s.verify(org, Some(&state)).is_err());
        s.apply(&Event::Commit {
            organization: org,
            transition_id: id,
        })
        .unwrap();
        assert!(s.verify(org, None).is_err());
        assert!(s.verify(org, Some(&state)).is_ok());
        let mut wrong = state.clone();
        wrong.windows[0].end += Duration::days(1);
        assert!(s.verify(org, Some(&wrong)).is_err());
    }
    #[test]
    fn trial_reset_revision_rollback_and_deleted_scope_are_rejected() {
        let (mut s, org, state) = initial();
        let id = Uuid::now_v7();
        s.apply(&Event::Prepare {
            organization: org,
            expected: Head::Legacy,
            transition: Pending {
                transition_id: id,
                state: state.clone().into(),
            },
        })
        .unwrap();
        assert!(s
            .apply(&Event::Commit {
                organization: org,
                transition_id: Uuid::now_v7()
            })
            .is_err());
        s.apply(&Event::Commit {
            organization: org,
            transition_id: id,
        })
        .unwrap();
        let mut restart = State::trial(10, Utc::now() + Duration::days(1)).unwrap();
        restart.revision = 2;
        assert!(s
            .apply(&Event::Prepare {
                organization: org,
                expected: Head::Enrolled {
                    state: state.clone().into()
                },
                transition: Pending {
                    transition_id: Uuid::now_v7(),
                    state: restart.into()
                }
            })
            .is_err());
        s.apply(&Event::Delete { organization: org }).unwrap();
        assert!(s.verify(org, Some(&state)).is_err());
        assert!(s.apply(&Event::Quarantine { organization: org }).is_err());
    }
    #[test]
    fn quarantine_keeps_proposal_evidence_and_blocks_confirmation() {
        let (mut s, org, state) = initial();
        let id = Uuid::now_v7();
        s.apply(&Event::Prepare {
            organization: org,
            expected: Head::Legacy,
            transition: Pending {
                transition_id: id,
                state: state.into(),
            },
        })
        .unwrap();
        s.apply(&Event::Quarantine { organization: org }).unwrap();
        assert!(s.organizations[&org].pending.is_some());
        assert!(s
            .apply(&Event::Commit {
                organization: org,
                transition_id: id
            })
            .is_err());
        assert!(s
            .apply(&Event::RegisterLegacy { organization: org })
            .is_err());
    }
}

#[cfg(test)]
#[path = "team_organization_birth_tests.rs"]
mod organization_birth_tests;

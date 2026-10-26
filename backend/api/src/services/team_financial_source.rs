//! Independent financial-source evidence. Recording an external outcome never
//! grants payment, consent, a binding, or analytics. Runtime SQL/provider wiring
//! and reviewed baseline admission are separate prerequisites.
use super::team_financial_guard::fingerprint;
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

fn digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|v| v.is_ascii_digit() || (b'a'..=b'f').contains(&v))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Scope {
    pub organization: Uuid,
    pub account: String,
    pub live: bool,
}
impl Scope {
    pub fn key(&self) -> Result<String> {
        ensure!(
            !self.organization.is_nil() && super::team_stripe::id(&self.account, "acct_"),
            "financial_source_scope_invalid"
        );
        fingerprint(self)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Root {
    pub schema: u8,
    pub revision: u64,
    pub records: u64,
    pub hash: String,
}
impl Root {
    pub fn empty(scope: &Scope) -> Result<Self> {
        scope.key()?;
        Ok(Self {
            schema: 1,
            revision: 1,
            records: 0,
            hash: fingerprint(&(1_u8, scope, BTreeMap::<String, String>::new()))?,
        })
    }
    fn validate(&self) -> Result<()> {
        ensure!(
            self.schema == 1 && self.revision > 0 && digest(&self.hash),
            "financial_source_root_invalid"
        );
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewKind {
    ReviewedEmpty,
    ReviewedInventory,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Review {
    pub id: Uuid,
    pub kind: ReviewKind,
    pub evidence_hash: String,
    pub reviewed_at: DateTime<Utc>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationKind {
    CreateCustomer,
    CreateCheckout,
}
/// Only digests of the immutable request/key, never a credential or hosted URL.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AcceptedRequest {
    pub operation: Uuid,
    pub kind: OperationKind,
    pub actor: Uuid,
    pub request_hash: String,
    pub idempotency_hash: String,
    pub accepted_at: DateTime<Utc>,
}
impl AcceptedRequest {
    fn validate(&self) -> Result<()> {
        ensure!(
            !self.operation.is_nil()
                && !self.actor.is_nil()
                && digest(&self.request_hash)
                && digest(&self.idempotency_hash),
            "financial_source_request_invalid"
        );
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Transition {
    pub id: Uuid,
    pub next: Root,
    pub change_hash: String,
    pub accepted: Vec<AcceptedRequest>,
    /// Exact retained outcomes incorporated by the same confirmed SQL change.
    pub resolved_outcomes: BTreeSet<Uuid>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Dispatch {
    pub operation: Uuid,
    pub request_hash: String,
    pub idempotency_hash: String,
    /// First possible send is immutable across retries, lease changes and restart.
    pub first_attempt_at: DateTime<Utc>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum ProviderIdentity {
    Customer {
        customer: String,
    },
    Checkout {
        session: String,
        customer: String,
        subscription: Option<String>,
    },
}
impl ProviderIdentity {
    fn validate(&self) -> Result<()> {
        let id = super::team_stripe::id;
        ensure!(
            match self {
                Self::Customer { customer } => id(customer, "cus_"),
                Self::Checkout {
                    session,
                    customer,
                    subscription,
                } =>
                    id(session, "cs_")
                        && id(customer, "cus_")
                        && subscription.as_ref().is_none_or(|s| id(s, "sub_")),
            },
            "financial_source_provider_identity_invalid"
        );
        Ok(())
    }
    fn agrees(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Customer { customer: a }, Self::Customer { customer: b }) => a == b,
            (
                Self::Checkout {
                    session: a,
                    customer: ac,
                    subscription: asub,
                },
                Self::Checkout {
                    session: b,
                    customer: bc,
                    subscription: bsub,
                },
            ) => a == b && ac == bc && asub.as_ref().zip(bsub.as_ref()).is_none_or(|(a, b)| a == b),
            _ => false,
        }
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Outcome {
    pub id: Uuid,
    pub operation: Uuid,
    pub request_hash: String,
    pub evidence_hash: String,
    pub observed_at: DateTime<Utc>,
    pub identity: Option<ProviderIdentity>,
}
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FreezeReason {
    OperatorRequested,
    RestoredHeadMismatch,
    UnknownCommit,
    ProviderIdentityConflict,
    OrganizationClosed,
    OrganizationUnconfirmed,
    RequestIdentityConflict,
    OutcomeIdentityConflict,
    UnmatchedOperation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub scope: Scope,
    pub head: Option<Root>,
    pub review: Option<Review>,
    pub pending: Option<Transition>,
    pub committed_transition: Option<Uuid>,
    pub used_transitions: BTreeMap<Uuid, String>,
    pub accepted: BTreeMap<Uuid, AcceptedRequest>,
    pub dispatches: BTreeMap<Uuid, Dispatch>,
    pub outcomes: BTreeMap<Uuid, Outcome>,
    /// Preserve conflicting variants without overwriting the original receipt.
    pub conflicting_outcomes: BTreeMap<String, Outcome>,
    pub unapplied_outcomes: BTreeSet<Uuid>,
    pub frozen: BTreeSet<FreezeReason>,
}
impl Entry {
    fn unknown(scope: &Scope) -> Self {
        Self {
            scope: scope.clone(),
            head: None,
            review: None,
            pending: None,
            committed_transition: None,
            used_transitions: BTreeMap::new(),
            accepted: BTreeMap::new(),
            dispatches: BTreeMap::new(),
            outcomes: BTreeMap::new(),
            conflicting_outcomes: BTreeMap::new(),
            unapplied_outcomes: BTreeSet::new(),
            frozen: BTreeSet::new(),
        }
    }
    fn ready(&self) -> Result<&Root> {
        ensure!(
            self.unapplied_outcomes.is_empty(),
            "financial_source_outcome_reconciliation_required"
        );
        self.transition_ready()
    }
    fn transition_ready(&self) -> Result<&Root> {
        ensure!(self.frozen.is_empty(), "financial_source_frozen");
        ensure!(
            self.pending.is_none(),
            "financial_source_commit_reconciliation_required"
        );
        self.head.as_ref().context("financial_source_uninitialized")
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Event {
    Seed {
        scope: Scope,
        head: Root,
        review: Review,
        accepted: Vec<AcceptedRequest>,
    },
    Prepare {
        scope: Scope,
        expected: Root,
        transition: Transition,
    },
    Commit {
        scope: Scope,
        transition: Uuid,
    },
    Dispatch {
        scope: Scope,
        dispatch: Dispatch,
    },
    Outcome {
        scope: Scope,
        outcome: Outcome,
    },
    /// An invalid provider result and its absorbing integrity failure are one
    /// durable fact; a crash cannot leave only the non-rejected half.
    RejectedOutcome {
        scope: Scope,
        outcome: Outcome,
    },
    Freeze {
        scope: Scope,
        reason: FreezeReason,
    },
}
impl Event {
    pub fn scope(&self) -> &Scope {
        match self {
            Self::Seed { scope, .. }
            | Self::Prepare { scope, .. }
            | Self::Commit { scope, .. }
            | Self::Dispatch { scope, .. }
            | Self::Outcome { scope, .. }
            | Self::RejectedOutcome { scope, .. }
            | Self::Freeze { scope, .. } => scope,
        }
    }
}
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Snapshot {
    pub scopes: BTreeMap<String, Entry>,
}
fn requests(values: &[AcceptedRequest]) -> Result<BTreeMap<Uuid, AcceptedRequest>> {
    let mut result = BTreeMap::new();
    for request in values {
        request.validate()?;
        ensure!(
            result.insert(request.operation, request.clone()).is_none(),
            "financial_source_duplicate_operation"
        );
    }
    Ok(result)
}
impl Snapshot {
    pub fn freeze_organization(&mut self, org: Uuid) {
        for entry in self
            .scopes
            .values_mut()
            .filter(|entry| entry.scope.organization == org)
        {
            entry.frozen.insert(FreezeReason::OrganizationClosed);
        }
    }
    pub fn verify(&self, scope: &Scope, database: &Root) -> Result<&Entry> {
        database.validate()?;
        let entry = self
            .scopes
            .get(&scope.key()?)
            .context("financial_source_uninitialized")?;
        ensure!(
            entry.scope == *scope && entry.ready()? == database,
            "financial_source_database_head_mismatch"
        );
        Ok(entry)
    }
    /// Validate against a clone so rejected evidence never partially mutates state.
    pub fn apply(&mut self, event: &Event) -> Result<()> {
        let key = event.scope().key()?;
        let mut entry = self
            .scopes
            .get(&key)
            .cloned()
            .unwrap_or_else(|| Entry::unknown(event.scope()));
        ensure!(
            entry.scope == *event.scope(),
            "financial_source_scope_mismatch"
        );
        match event {
            Event::Seed {
                scope,
                head,
                review,
                accepted,
            } => {
                // Even an orphan outcome/freeze proves this is not a fresh empty scope.
                ensure!(
                    !self.scopes.contains_key(&key),
                    "financial_source_scope_already_known"
                );
                head.validate()?;
                ensure!(
                    head.revision == 1 && !review.id.is_nil() && digest(&review.evidence_hash),
                    "financial_source_review_invalid"
                );
                let accepted = requests(accepted)?;
                ensure!(
                    review.kind != ReviewKind::ReviewedEmpty
                        || (accepted.is_empty() && *head == Root::empty(scope)?),
                    "financial_source_review_not_empty"
                );
                entry.head = Some(head.clone());
                entry.review = Some(review.clone());
                entry.accepted = accepted;
            }
            Event::Prepare {
                expected,
                transition,
                ..
            } => {
                if entry.frozen.is_empty()
                    && entry.head.as_ref() == Some(expected)
                    && entry.pending.as_ref() == Some(transition)
                {
                    return Ok(());
                }
                ensure!(
                    entry.transition_ready()? == expected,
                    "financial_source_predecessor_changed"
                );
                ensure!(
                    !entry.used_transitions.contains_key(&transition.id),
                    "financial_source_transition_id_reused"
                );
                ensure!(
                    transition
                        .resolved_outcomes
                        .is_subset(&entry.unapplied_outcomes),
                    "financial_source_outcome_resolution_invalid"
                );
                ensure!(
                    entry.unapplied_outcomes.is_empty() || transition.accepted.is_empty(),
                    "financial_source_unresolved_external_outcome"
                );
                transition.next.validate()?;
                ensure!(
                    !transition.id.is_nil()
                        && digest(&transition.change_hash)
                        && transition.next.revision
                            == expected
                                .revision
                                .checked_add(1)
                                .context("financial_source_revision_overflow")?,
                    "financial_source_transition_invalid"
                );
                for (id, request) in requests(&transition.accepted)? {
                    ensure!(
                        entry.accepted.get(&id).is_none_or(|old| old == &request),
                        "financial_source_operation_conflict"
                    );
                }
                entry
                    .used_transitions
                    .insert(transition.id, fingerprint(&(expected, transition))?);
                entry.pending = Some(transition.clone());
            }
            Event::Commit { transition, .. } => {
                ensure!(entry.frozen.is_empty(), "financial_source_frozen");
                if entry.pending.is_none() && entry.committed_transition == Some(*transition) {
                    return Ok(());
                }
                let next = entry
                    .pending
                    .as_ref()
                    .context("financial_source_no_pending_transition")?;
                ensure!(
                    next.id == *transition,
                    "financial_source_transition_conflict"
                );
                entry.accepted.extend(requests(&next.accepted)?);
                for outcome in &next.resolved_outcomes {
                    entry.unapplied_outcomes.remove(outcome);
                }
                entry.head = Some(next.next.clone());
                entry.committed_transition = Some(*transition);
                entry.pending = None;
            }
            Event::Dispatch { dispatch, .. } => {
                entry.ready()?;
                let request = entry
                    .accepted
                    .get(&dispatch.operation)
                    .context("financial_source_request_not_committed")?;
                ensure!(
                    request.request_hash == dispatch.request_hash
                        && request.idempotency_hash == dispatch.idempotency_hash
                        && dispatch.first_attempt_at >= request.accepted_at,
                    "financial_source_dispatch_conflict"
                );
                ensure!(
                    entry
                        .dispatches
                        .get(&dispatch.operation)
                        .is_none_or(|old| old == dispatch),
                    "financial_source_first_dispatch_changed"
                );
                entry
                    .dispatches
                    .insert(dispatch.operation, dispatch.clone());
            }
            Event::Outcome { outcome, .. } | Event::RejectedOutcome { outcome, .. } => {
                if matches!(event, Event::RejectedOutcome { .. }) {
                    entry.frozen.insert(FreezeReason::RequestIdentityConflict);
                }
                ensure!(
                    !outcome.id.is_nil()
                        && !outcome.operation.is_nil()
                        && digest(&outcome.request_hash)
                        && digest(&outcome.evidence_hash),
                    "financial_source_outcome_invalid"
                );
                if let Some(identity) = &outcome.identity {
                    identity.validate()?;
                }
                // Evidence retention is permitted when a head/lease/SQL row is missing
                // or frozen. It neither initializes the head nor authorizes a dispatch.
                let request = entry.accepted.get(&outcome.operation).or_else(|| {
                    entry
                        .pending
                        .as_ref()
                        .and_then(|p| p.accepted.iter().find(|r| r.operation == outcome.operation))
                });
                match request {
                    Some(request) => {
                        let kind_matches = outcome.identity.as_ref().is_none_or(|identity| {
                            matches!(
                                (&request.kind, identity),
                                (
                                    OperationKind::CreateCustomer,
                                    ProviderIdentity::Customer { .. }
                                ) | (
                                    OperationKind::CreateCheckout,
                                    ProviderIdentity::Checkout { .. }
                                )
                            )
                        });
                        if request.request_hash != outcome.request_hash || !kind_matches {
                            entry.frozen.insert(FreezeReason::RequestIdentityConflict);
                        }
                    }
                    None => {
                        entry.frozen.insert(FreezeReason::UnmatchedOperation);
                    }
                }
                if let Some(prior) = entry.outcomes.get(&outcome.id) {
                    if prior == outcome {
                        self.scopes.insert(key, entry);
                        return Ok(());
                    }
                    entry.frozen.insert(FreezeReason::OutcomeIdentityConflict);
                    entry
                        .conflicting_outcomes
                        .insert(fingerprint(outcome)?, outcome.clone());
                    entry.unapplied_outcomes.insert(outcome.id);
                    self.scopes.insert(key, entry);
                    return Ok(());
                }
                if let Some(identity) = &outcome.identity {
                    if entry.outcomes.values().any(|old| {
                        old.operation == outcome.operation
                            && old
                                .identity
                                .as_ref()
                                .is_some_and(|prior| !identity.agrees(prior))
                    }) {
                        entry.frozen.insert(FreezeReason::ProviderIdentityConflict);
                    }
                }
                entry.outcomes.insert(outcome.id, outcome.clone());
                entry.unapplied_outcomes.insert(outcome.id);
            }
            Event::Freeze { reason, .. } => {
                entry.frozen.insert(reason.clone());
            }
        }
        self.scopes.insert(key, entry);
        Ok(())
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    pub(crate) fn fixture() -> (Snapshot, Scope, Root, AcceptedRequest) {
        let scope = Scope {
            organization: Uuid::now_v7(),
            account: "acct_fixture".into(),
            live: false,
        };
        let root = Root::empty(&scope).unwrap();
        let mut snapshot = Snapshot::default();
        snapshot
            .apply(&Event::Seed {
                scope: scope.clone(),
                head: root.clone(),
                review: Review {
                    id: Uuid::now_v7(),
                    kind: ReviewKind::ReviewedEmpty,
                    evidence_hash: "a".repeat(64),
                    reviewed_at: Utc::now(),
                },
                accepted: vec![],
            })
            .unwrap();
        let request = AcceptedRequest {
            operation: Uuid::now_v7(),
            kind: OperationKind::CreateCustomer,
            actor: Uuid::now_v7(),
            request_hash: "b".repeat(64),
            idempotency_hash: "c".repeat(64),
            accepted_at: Utc::now(),
        };
        (snapshot, scope, root, request)
    }
    #[test]
    fn source_seed_is_explicit_scoped_and_never_replaces_known_evidence() {
        let (mut snapshot, scope, root, _) = fixture();
        snapshot.verify(&scope, &root).unwrap();
        let mut wrong = scope.clone();
        wrong.live = true;
        assert!(snapshot.verify(&wrong, &root).is_err());
        wrong = scope.clone();
        wrong.account = "acct_other".into();
        assert!(snapshot.verify(&wrong, &root).is_err());
        let seed = Event::Seed {
            scope: scope.clone(),
            head: root.clone(),
            review: Review {
                id: Uuid::now_v7(),
                kind: ReviewKind::ReviewedEmpty,
                evidence_hash: "a".repeat(64),
                reviewed_at: Utc::now(),
            },
            accepted: vec![],
        };
        assert!(snapshot.apply(&seed).is_err());
        let mut unknown = Snapshot::default();
        unknown
            .apply(&Event::Freeze {
                scope: scope.clone(),
                reason: FreezeReason::RestoredHeadMismatch,
            })
            .unwrap();
        assert!(unknown.apply(&seed).is_err());
        assert!(unknown.verify(&scope, &root).is_err());
    }
    #[test]
    fn source_request_commit_dispatch_and_unknown_commit_are_distinct() {
        let (mut snapshot, scope, root, request) = fixture();
        let dispatch = Dispatch {
            operation: request.operation,
            request_hash: request.request_hash.clone(),
            idempotency_hash: request.idempotency_hash.clone(),
            first_attempt_at: Utc::now(),
        };
        let send = Event::Dispatch {
            scope: scope.clone(),
            dispatch: dispatch.clone(),
        };
        assert!(snapshot.apply(&send).is_err());
        let next = Root {
            schema: 1,
            revision: 2,
            records: 1,
            hash: "d".repeat(64),
        };
        let transition = Transition {
            id: Uuid::now_v7(),
            next: next.clone(),
            change_hash: "e".repeat(64),
            accepted: vec![request.clone()],
            resolved_outcomes: Default::default(),
        };
        snapshot
            .apply(&Event::Prepare {
                scope: scope.clone(),
                expected: root.clone(),
                transition: transition.clone(),
            })
            .unwrap();
        assert!(snapshot.verify(&scope, &root).is_err());
        assert!(snapshot.apply(&send).is_err());
        assert!(snapshot
            .apply(&Event::Commit {
                scope: scope.clone(),
                transition: Uuid::now_v7()
            })
            .is_err());
        snapshot
            .apply(&Event::Commit {
                scope: scope.clone(),
                transition: transition.id,
            })
            .unwrap();
        assert!(snapshot.verify(&scope, &root).is_err()); // restored older SQL root
        snapshot.verify(&scope, &next).unwrap();
        snapshot.apply(&send).unwrap();
        snapshot.apply(&send).unwrap();
        let mut changed = dispatch.clone();
        changed.first_attempt_at += chrono::Duration::seconds(1);
        assert!(snapshot
            .apply(&Event::Dispatch {
                scope: scope.clone(),
                dispatch: changed
            })
            .is_err());
        snapshot
            .apply(&Event::Freeze {
                scope: scope.clone(),
                reason: FreezeReason::UnknownCommit,
            })
            .unwrap();
        assert!(snapshot.apply(&send).is_err()); // exact old dispatch is not authorization after freeze
        assert_eq!(
            snapshot.scopes[&scope.key().unwrap()].dispatches[&request.operation],
            dispatch
        );
    }
    #[test]
    fn source_outcomes_survive_missing_sql_or_frozen_scope_and_conflicts_are_preserved() {
        let (_, scope, root, request) = fixture();
        let mut snapshot = Snapshot::default();
        let outcome = Outcome {
            id: Uuid::now_v7(),
            operation: request.operation,
            request_hash: request.request_hash.clone(),
            evidence_hash: "f".repeat(64),
            observed_at: Utc::now(),
            identity: Some(ProviderIdentity::Customer {
                customer: "cus_first".into(),
            }),
        };
        snapshot
            .apply(&Event::Outcome {
                scope: scope.clone(),
                outcome: outcome.clone(),
            })
            .unwrap();
        assert!(snapshot.verify(&scope, &root).is_err());
        let mut conflict = outcome.clone();
        conflict.id = Uuid::now_v7();
        conflict.identity = Some(ProviderIdentity::Customer {
            customer: "cus_other".into(),
        });
        snapshot
            .apply(&Event::Outcome {
                scope: scope.clone(),
                outcome: conflict,
            })
            .unwrap();
        let entry = &snapshot.scopes[&scope.key().unwrap()];
        assert_eq!(entry.outcomes.len(), 2);
        assert!(entry
            .frozen
            .contains(&FreezeReason::ProviderIdentityConflict));
        snapshot
            .apply(&Event::Outcome {
                scope: scope.clone(),
                outcome: outcome.clone(),
            })
            .unwrap();
        let mut same_id = outcome;
        same_id.evidence_hash = "0".repeat(64);
        snapshot
            .apply(&Event::Outcome {
                scope: scope.clone(),
                outcome: same_id,
            })
            .unwrap();
        assert_eq!(snapshot.scopes[&scope.key().unwrap()].outcomes.len(), 2);
        assert_eq!(
            snapshot.scopes[&scope.key().unwrap()]
                .conflicting_outcomes
                .len(),
            1
        );
        assert!(snapshot.scopes[&scope.key().unwrap()]
            .frozen
            .contains(&FreezeReason::OutcomeIdentityConflict));
    }

    #[test]
    fn source_outcome_must_be_incorporated_by_exact_committed_transition() {
        let (mut snapshot, scope, initial, request) = fixture();
        let root = Root {
            schema: 1,
            revision: 2,
            records: 1,
            hash: "a".repeat(64),
        };
        let accepted = Transition {
            id: Uuid::now_v7(),
            next: root.clone(),
            change_hash: "b".repeat(64),
            accepted: vec![request.clone()],
            resolved_outcomes: Default::default(),
        };
        snapshot
            .apply(&Event::Prepare {
                scope: scope.clone(),
                expected: initial,
                transition: accepted.clone(),
            })
            .unwrap();
        snapshot
            .apply(&Event::Commit {
                scope: scope.clone(),
                transition: accepted.id,
            })
            .unwrap();
        let outcome = Outcome {
            id: Uuid::now_v7(),
            operation: request.operation,
            request_hash: request.request_hash.clone(),
            evidence_hash: "f".repeat(64),
            observed_at: Utc::now(),
            identity: Some(ProviderIdentity::Customer {
                customer: "cus_observed".into(),
            }),
        };
        snapshot
            .apply(&Event::Outcome {
                scope: scope.clone(),
                outcome: outcome.clone(),
            })
            .unwrap();
        assert!(
            snapshot.verify(&scope, &root).is_err(),
            "an unsaved provider result cannot leave the old head usable"
        );
        let next = Root {
            schema: 1,
            revision: 3,
            records: 1,
            hash: "0".repeat(64),
        };
        let mut change = Transition {
            id: Uuid::now_v7(),
            next: next.clone(),
            change_hash: "1".repeat(64),
            accepted: vec![request],
            resolved_outcomes: BTreeSet::from([outcome.id]),
        };
        assert!(
            snapshot
                .apply(&Event::Prepare {
                    scope: scope.clone(),
                    expected: root.clone(),
                    transition: change.clone()
                })
                .is_err(),
            "reconcile external outcomes before accepting new create work"
        );
        change.accepted.clear();
        let mut invalid = change.clone();
        invalid.resolved_outcomes.insert(Uuid::now_v7());
        assert!(snapshot
            .apply(&Event::Prepare {
                scope: scope.clone(),
                expected: root.clone(),
                transition: invalid
            })
            .is_err());
        snapshot
            .apply(&Event::Prepare {
                scope: scope.clone(),
                expected: root.clone(),
                transition: change.clone(),
            })
            .unwrap();
        assert!(snapshot.verify(&scope, &next).is_err());
        snapshot
            .apply(&Event::Commit {
                scope: scope.clone(),
                transition: change.id,
            })
            .unwrap();
        snapshot.verify(&scope, &next).unwrap();
        // A lost response to the retention write cannot resurrect already applied work.
        snapshot
            .apply(&Event::Outcome {
                scope: scope.clone(),
                outcome: outcome.clone(),
            })
            .unwrap();
        snapshot.verify(&scope, &next).unwrap();
        assert_eq!(
            snapshot.scopes[&scope.key().unwrap()].outcomes[&outcome.id],
            outcome
        );
    }

    #[test]
    fn source_pending_request_conflicts_are_retained_and_freeze_before_commit() {
        for case in ["matching", "hash", "kind"] {
            let (mut snapshot, scope, root, request) = fixture();
            let next = Root {
                schema: 1,
                revision: 2,
                records: 1,
                hash: "a".repeat(64),
            };
            let pending = Transition {
                id: Uuid::now_v7(),
                next: next.clone(),
                change_hash: "b".repeat(64),
                accepted: vec![request.clone()],
                resolved_outcomes: Default::default(),
            };
            snapshot
                .apply(&Event::Prepare {
                    scope: scope.clone(),
                    expected: root,
                    transition: pending.clone(),
                })
                .unwrap();
            let observed = Outcome {
                id: Uuid::now_v7(),
                operation: request.operation,
                request_hash: if case == "hash" {
                    "c".repeat(64)
                } else {
                    request.request_hash.clone()
                },
                evidence_hash: "d".repeat(64),
                observed_at: Utc::now(),
                identity: Some(if case == "kind" {
                    ProviderIdentity::Checkout {
                        session: "cs_observed".into(),
                        customer: "cus_observed".into(),
                        subscription: None,
                    }
                } else {
                    ProviderIdentity::Customer {
                        customer: "cus_observed".into(),
                    }
                }),
            };
            snapshot
                .apply(&Event::Outcome {
                    scope: scope.clone(),
                    outcome: observed.clone(),
                })
                .unwrap();
            let entry = &snapshot.scopes[&scope.key().unwrap()];
            assert_eq!(entry.outcomes[&observed.id], observed);
            assert_eq!(entry.pending.as_ref(), Some(&pending));
            assert_eq!(
                entry
                    .frozen
                    .contains(&FreezeReason::RequestIdentityConflict),
                case != "matching"
            );
            let commit = snapshot.apply(&Event::Commit {
                scope: scope.clone(),
                transition: pending.id,
            });
            assert_eq!(commit.is_ok(), case == "matching");
            assert!(
                snapshot.verify(&scope, &next).is_err(),
                "even a matching late outcome remains unapplied after the earlier pending commit"
            );
        }
    }

    #[test]
    fn source_historical_transition_id_cannot_confirm_a_different_sql_change() {
        let (mut snapshot, scope, mut head, _) = fixture();
        let original = Uuid::now_v7();
        for id in [original, Uuid::now_v7()] {
            let next = Root {
                schema: 1,
                revision: head.revision + 1,
                records: 0,
                hash: "b".repeat(64),
            };
            let transition = Transition {
                id,
                next: next.clone(),
                change_hash: "c".repeat(64),
                accepted: vec![],
                resolved_outcomes: Default::default(),
            };
            snapshot
                .apply(&Event::Prepare {
                    scope: scope.clone(),
                    expected: head,
                    transition,
                })
                .unwrap();
            snapshot
                .apply(&Event::Commit {
                    scope: scope.clone(),
                    transition: id,
                })
                .unwrap();
            head = next;
        }
        let next = Root {
            schema: 1,
            revision: head.revision + 1,
            records: 0,
            hash: "d".repeat(64),
        };
        let mut transition = Transition {
            id: original,
            next: next.clone(),
            change_hash: "e".repeat(64),
            accepted: vec![],
            resolved_outcomes: Default::default(),
        };
        assert!(snapshot
            .apply(&Event::Prepare {
                scope: scope.clone(),
                expected: head.clone(),
                transition: transition.clone()
            })
            .is_err());
        snapshot.verify(&scope, &head).unwrap();
        transition.id = Uuid::now_v7();
        snapshot
            .apply(&Event::Prepare {
                scope: scope.clone(),
                expected: head,
                transition: transition.clone(),
            })
            .unwrap();
        assert!(snapshot
            .apply(&Event::Commit {
                scope: scope.clone(),
                transition: original
            })
            .is_err());
        assert!(snapshot.verify(&scope, &next).is_err());
        assert_eq!(
            snapshot.scopes[&scope.key().unwrap()].pending.as_ref(),
            Some(&transition)
        );
    }
}

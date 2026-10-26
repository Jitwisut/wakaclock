//! Atomic independent intent for one SQL transaction. This is not a SQL commit
//! proof: a coordinator must confirm only after known commit or exact readback.
use super::{
    team_financial_guard::{fingerprint, Event as GuardEvent, Head, Pending, Snapshot as Guard},
    team_financial_ingress as ingress, team_financial_source as source,
};
use anyhow::{ensure, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

const MAX_GROUPS: usize = 10_000;
const MAX_SOURCES: usize = 100;
// Leave room for the outer event/record envelope under the journal's 1 MiB cap.
const MAX_PROPOSAL_BYTES: usize = 768 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SourceChange {
    pub scope: source::Scope,
    pub expected: source::Root,
    pub transition: source::Transition,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnrollmentChange {
    pub organization: Uuid,
    pub expected: Head,
    pub transition: Pending,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ScheduleTarget {
    pub organization: Uuid,
    pub customer: String,
    pub subscription: String,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum CustomerStage {
    FirstAttempt {
        first_attempt_at: chrono::DateTime<chrono::Utc>,
    },
    Stop {
        first_attempt_at: Option<chrono::DateTime<chrono::Utc>>,
        owner_changed: bool,
    },
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum CustomerProjection {
    Verified { lease: Uuid },
    EvidenceOnly { owner_changed: bool },
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Writer {
    CustomerRecoveryAuthorization {
        organization: Uuid,
        request: source::AcceptedRequest,
        actor: Uuid,
        expected_revision: i64,
        authorized_at: chrono::DateTime<chrono::Utc>,
    },
    CustomerResolution {
        organization: Uuid,
        request: source::AcceptedRequest,
        customer: String,
        outcomes: BTreeMap<Uuid, String>,
        expected_revision: i64,
        observed_at: chrono::DateTime<chrono::Utc>,
        projection: CustomerProjection,
    },
    CustomerLifecycle {
        organization: Uuid,
        request: source::AcceptedRequest,
        stage: CustomerStage,
    },
    CustomerRequest {
        organization: Uuid,
        request: source::AcceptedRequest,
    },
    Quote {
        organization: Uuid,
        actor: Uuid,
        quote: Uuid,
        customer_operation: Uuid,
        customer_revision: i64,
        customer: String,
        offer_hash: String,
    },
    Scheduler {
        targets: Vec<ScheduleTarget>,
    },
    Reconciliation {
        target: ScheduleTarget,
        lease: Uuid,
        revision: i64,
        binding_revision: i64,
        observation_hash: String,
    },
}
impl Writer {
    pub fn change_hash(&self, account: &ingress::Scope, scope: &source::Scope) -> Result<String> {
        fingerprint(&("financial_normal_writer_v1", account, self, scope))
    }
    pub fn resolved(&self, scope: &source::Scope) -> std::collections::BTreeSet<Uuid> {
        match self {
            Self::CustomerResolution {
                organization,
                outcomes,
                ..
            } if *organization == scope.organization => outcomes.keys().copied().collect(),
            _ => Default::default(),
        }
    }
    fn validate(&self, p: &Proposal) -> Result<()> {
        if let Self::CustomerResolution {
            organization,
            request,
            customer,
            outcomes,
            expected_revision,
            observed_at,
            projection,
        } = self
        {
            ensure!(
                p.mode == Mode::ResolveOutcomes
                    && p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && !outcomes.is_empty()
                    && outcomes.len() <= 100
                    && *expected_revision > 0
                    && observed_at >= &request.accepted_at
                    && super::team_stripe::id(customer, "cus_")
                    && outcomes.iter().all(|(id, h)| !id.is_nil()
                        && h.len() == 64
                        && h.bytes().all(|b| b.is_ascii_hexdigit()))
                    && p.sources
                        .iter()
                        .any(|s| s.scope.organization == *organization),
                "financial_customer_resolution_invalid"
            );
            if let CustomerProjection::Verified { lease } = projection {
                ensure!(
                    !lease.is_nil(),
                    "financial_customer_resolution_lease_invalid"
                );
            }
            for source in &p.sources {
                ensure!(
                    source.transition.accepted.is_empty()
                        && source.transition.change_hash
                            == self.change_hash(&p.account, &source.scope)?
                        && source.transition.resolved_outcomes == self.resolved(&source.scope),
                    "financial_customer_resolution_scope_invalid"
                );
            }
            return Ok(());
        }
        if let Self::CustomerRecoveryAuthorization {
            organization,
            request,
            actor,
            expected_revision,
            authorized_at,
        } = self
        {
            ensure!(
                p.mode == Mode::Normal
                    && p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && p.sources.len() == 1
                    && !actor.is_nil()
                    && *expected_revision > 0
                    && *expected_revision < i64::MAX
                    && authorized_at >= &request.accepted_at,
                "financial_customer_recovery_authorization_invalid"
            );
            let source = &p.sources[0];
            let original = super::team_stripe_customer_request::Request::new(
                source.scope.clone(),
                request.operation,
                request.actor,
            )?
            .accepted(request.accepted_at)?;
            ensure!(
                source.scope.organization == *organization
                    && request == &original
                    && source.transition.accepted.is_empty()
                    && source.transition.resolved_outcomes.is_empty()
                    && source.transition.change_hash
                        == self.change_hash(&p.account, &source.scope)?,
                "financial_customer_recovery_authorization_scope_invalid"
            );
            return Ok(());
        }
        ensure!(
            p.mode == Mode::Normal && p.ingress.is_none(),
            "financial_transaction_writer_invalid"
        );
        if let Self::CustomerRequest {
            organization,
            request,
        }
        | Self::CustomerLifecycle {
            organization,
            request,
            ..
        } = self
        {
            ensure!(
                p.sources.len() == 1 && p.enrollments.is_empty(),
                "financial_transaction_customer_request_invalid"
            );
            let source = &p.sources[0];
            let expected = super::team_stripe_customer_request::Request::new(
                source.scope.clone(),
                request.operation,
                request.actor,
            )?
            .accepted(request.accepted_at)?;
            let accepted = if matches!(self, Self::CustomerRequest { .. }) {
                vec![expected.clone()]
            } else {
                vec![]
            };
            if let Self::CustomerLifecycle { stage, .. } = self {
                let first = match stage {
                    CustomerStage::FirstAttempt { first_attempt_at } => Some(*first_attempt_at),
                    CustomerStage::Stop {
                        first_attempt_at,
                        owner_changed,
                    } => {
                        ensure!(
                            *owner_changed || first_attempt_at.is_some(),
                            "financial_customer_stop_invalid"
                        );
                        *first_attempt_at
                    }
                };
                ensure!(
                    first.is_none_or(|t| t >= request.accepted_at),
                    "financial_customer_first_attempt_invalid"
                );
            }
            ensure!(
                source.scope.organization == *organization
                    && request == &expected
                    && source.transition.accepted == accepted
                    && source.transition.resolved_outcomes.is_empty()
                    && source.transition.change_hash
                        == self.change_hash(&p.account, &source.scope)?,
                "financial_transaction_customer_request_invalid"
            );
            return Ok(());
        }
        if let Self::Quote {
            organization,
            actor,
            quote,
            customer_operation,
            customer_revision,
            customer,
            offer_hash,
        } = self
        {
            ensure!(
                !organization.is_nil()
                    && !actor.is_nil()
                    && !quote.is_nil()
                    && !customer_operation.is_nil()
                    && *customer_revision > 0
                    && super::team_stripe::id(customer, "cus_")
                    && offer_hash.len() == 64
                    && offer_hash.bytes().all(|b| b.is_ascii_hexdigit())
                    && p.sources.len() == 1
                    && p.enrollments.is_empty(),
                "financial_transaction_quote_invalid"
            );
            let source = &p.sources[0];
            ensure!(
                source.scope.organization == *organization
                    && source.transition.accepted.is_empty()
                    && source.transition.resolved_outcomes.is_empty()
                    && source.transition.change_hash
                        == self.change_hash(&p.account, &source.scope)?,
                "financial_transaction_quote_scope_invalid"
            );
            return Ok(());
        }
        let targets = match self {
            Self::Quote { .. }
            | Self::CustomerRecoveryAuthorization { .. }
            | Self::CustomerRequest { .. }
            | Self::CustomerLifecycle { .. }
            | Self::CustomerResolution { .. } => {
                unreachable!("single-scope writer validated above")
            }
            Self::Scheduler { targets } => {
                ensure!(
                    p.enrollments.is_empty(),
                    "financial_transaction_writer_invalid"
                );
                targets.as_slice()
            }
            Self::Reconciliation {
                target,
                lease,
                revision,
                binding_revision,
                observation_hash,
            } => {
                ensure!(
                    !lease.is_nil()
                        && *revision > 0
                        && *binding_revision > 0
                        && observation_hash.len() == 64
                        && observation_hash.bytes().all(|b| b.is_ascii_hexdigit())
                        && p.sources.len() == 1
                        && p.enrollments
                            .iter()
                            .all(|e| e.organization == target.organization),
                    "financial_transaction_observation_invalid"
                );
                for e in &p.enrollments {
                    ensure!(
                        matches!(e.expected, Head::Enrolled { .. })
                            && e.transition.state.source_revision == *revision
                            && e.transition.state.scope.as_ref().is_some_and(|s| s.account
                                == p.account.account
                                && s.live == p.account.live
                                && s.customer == target.customer
                                && s.subscription == target.subscription
                                && s.binding_revision == *binding_revision),
                        "financial_transaction_observation_enrollment_invalid"
                    );
                }
                std::slice::from_ref(target)
            }
        };
        ensure!(
            !targets.is_empty()
                && targets.len() <= 100
                && targets
                    .windows(2)
                    .all(|t| t[0].subscription < t[1].subscription),
            "financial_transaction_schedule_targets_invalid"
        );
        for target in targets {
            ensure!(
                !target.organization.is_nil()
                    && target.customer.starts_with("cus_")
                    && target.subscription.starts_with("sub_")
                    && [&target.customer, &target.subscription]
                        .iter()
                        .all(|s| s.len() <= 255
                            && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')),
                "financial_transaction_schedule_identity_invalid"
            );
            ensure!(
                p.sources
                    .iter()
                    .any(|s| s.scope.organization == target.organization),
                "financial_transaction_schedule_scope_invalid"
            );
        }
        for source in &p.sources {
            ensure!(
                targets
                    .iter()
                    .any(|t| t.organization == source.scope.organization)
                    && source.transition.accepted.is_empty()
                    && source.transition.resolved_outcomes.is_empty()
                    && source.transition.change_hash
                        == self.change_hash(&p.account, &source.scope)?,
                "financial_transaction_writer_source_invalid"
            );
        }
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Proposal {
    pub id: Uuid,
    pub namespace: Uuid,
    pub account: ingress::Scope,
    pub expected_ingress: ingress::Head,
    pub mode: Mode,
    /// Account history, all its source observations, and participating org heads.
    pub observation_hash: String,
    /// Strictly increasing organization IDs; no silent sorting/truncation.
    pub sources: Vec<SourceChange>,
    /// Strictly increasing subset of source organizations.
    pub enrollments: Vec<EnrollmentChange>,
    pub ingress: Option<ingress::Proposal>,
    /// Optional typed source-only writer. Omitted for exact legacy checksums.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub writer: Option<Writer>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Normal,
    ResolveOutcomes,
}
impl Proposal {
    pub fn digest(&self) -> Result<String> {
        fingerprint(&("financial_transaction_v1", self))
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Event {
    Prepare {
        proposal: Box<Proposal>,
    },
    Confirm {
        transaction: Uuid,
        proposal_hash: String,
    },
}
#[derive(Debug, Clone, PartialEq)]
pub struct Entry {
    pub proposal: Proposal,
    pub proposal_hash: String,
    pub committed: bool,
}
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Snapshot {
    pub groups: BTreeMap<Uuid, Entry>,
}
pub(super) struct Change {
    pub id: Uuid,
    pub entry: Entry,
    pub members: Vec<GuardEvent>,
}
pub(crate) fn retired_nonparticipant(
    state: &Guard,
    source: &source::Entry,
    members: &[SourceChange],
) -> bool {
    !members.iter().any(|m| m.scope == source.scope)
        && source.head.is_some()
        && source.pending.is_none()
        && source.unapplied_outcomes.is_empty()
        && source.frozen.len() == 1
        && source
            .frozen
            .contains(&source::FreezeReason::OrganizationClosed)
        && state
            .organizations
            .get(&source.scope.organization)
            .is_some_and(|o| matches!(o.head, Head::Quarantined | Head::Deleted))
}
impl Snapshot {
    /// Operator metadata only; no IDs, roots, retained payloads or readiness grant.
    pub fn diagnostic(&self) -> serde_json::Value {
        let pending = self.groups.values().filter(|e| !e.committed).count();
        serde_json::json!({"scope":"financial_transaction_journal_only","pending":pending,"confirmed":self.groups.len()-pending,"status":if pending>0 {"reconciliation_required"}else{"recorded"},"product_authorization_enabled":false,"production_ready":false})
    }
    pub fn require_account_free(&self, scope: &ingress::Scope) -> Result<()> {
        scope.key()?;
        ensure!(
            !self
                .groups
                .values()
                .any(|e| !e.committed && e.proposal.account == *scope),
            "financial_transaction_account_reconciliation_required"
        );
        Ok(())
    }
    pub fn require_organization_free(&self, organization: Uuid) -> Result<()> {
        ensure!(
            !self.groups.values().any(|e| !e.committed
                && e.proposal
                    .sources
                    .iter()
                    .any(|s| s.scope.organization == organization)),
            "financial_transaction_organization_reconciliation_required"
        );
        Ok(())
    }
    pub(crate) fn history_for_org(&self, org: Uuid) -> Vec<(Uuid, &str, bool)> {
        self.groups
            .values()
            .filter(|e| {
                e.proposal
                    .sources
                    .iter()
                    .any(|s| s.scope.organization == org)
            })
            .map(|e| (e.proposal.id, e.proposal_hash.as_str(), e.committed))
            .collect()
    }
    pub(crate) fn history_for_source(&self, scope: &source::Scope) -> Vec<(Uuid, &str, bool)> {
        self.groups
            .values()
            .filter(|e| {
                (e.proposal.account.account == scope.account
                    && e.proposal.account.live == scope.live)
                    || e.proposal
                        .sources
                        .iter()
                        .any(|s| s.scope.organization == scope.organization)
            })
            .map(|e| (e.proposal.id, e.proposal_hash.as_str(), e.committed))
            .collect()
    }
    /// Prevent a member's ordinary idempotent retry from partially confirming a
    /// group. Evidence-only appends and emergency closure remain permitted.
    pub(crate) fn fence(&self, event: &GuardEvent) -> Result<()> {
        match event {
            GuardEvent::FinancialIngress { event } => {
                if !matches!(event.as_ref(), ingress::Event::Conflict { .. }) {
                    self.require_account_free(event.scope())?;
                }
            }
            GuardEvent::FinancialSource { event } => {
                if !matches!(
                    event.as_ref(),
                    source::Event::Outcome { .. }
                        | source::Event::RejectedOutcome { .. }
                        | source::Event::Freeze { .. }
                ) {
                    self.require_account_free(&ingress::Scope {
                        account: event.scope().account.clone(),
                        live: event.scope().live,
                    })?;
                    self.require_organization_free(event.scope().organization)?;
                }
            }
            GuardEvent::Prepare {
                organization,
                transition,
                ..
            } => {
                self.require_organization_free(*organization)?;
                ensure!(
                    !self.groups.contains_key(&transition.transition_id),
                    "financial_transaction_identity_reused"
                );
            }
            GuardEvent::Commit { organization, .. } => {
                self.require_organization_free(*organization)?
            }
            _ => (),
        }
        // A committed group ID is never available for a new standalone member.
        let identities = match event {
            GuardEvent::FinancialIngress { event } => match event.as_ref() {
                ingress::Event::Prepare { proposal, .. } => vec![proposal.receipt.transition],
                ingress::Event::PrepareBootstrap { bootstrap, .. } => vec![bootstrap.plan],
                ingress::Event::ConfirmBootstrap {
                    bootstrap, review, ..
                } => vec![*bootstrap, review.id],
                ingress::Event::Seed {
                    receipts, review, ..
                } => std::iter::once(*review)
                    .chain(receipts.iter().map(|r| r.transition))
                    .collect(),
                ingress::Event::Confirm {
                    transition, review, ..
                } => std::iter::once(*transition)
                    .chain(review.iter().map(|r| r.id))
                    .collect(),
                _ => vec![],
            },
            GuardEvent::FinancialSource { event } => match event.as_ref() {
                source::Event::Prepare { transition, .. } => vec![transition.id],
                source::Event::Commit { transition, .. } => vec![*transition],
                source::Event::Seed { review, .. } => vec![review.id],
                _ => vec![],
            },
            GuardEvent::Commit { transition_id, .. } => vec![*transition_id],
            _ => vec![],
        };
        ensure!(
            identities.iter().all(|id| !self.groups.contains_key(id)),
            "financial_transaction_identity_reused"
        );
        Ok(())
    }
    pub(super) fn plan(&self, state: &Guard, event: &Event) -> Result<Option<Change>> {
        match event {
            Event::Prepare { proposal } => self.prepare(state, proposal),
            Event::Confirm {
                transaction,
                proposal_hash,
            } => {
                let known = self
                    .groups
                    .get(transaction)
                    .context("financial_transaction_unknown")?;
                ensure!(
                    known.proposal_hash == *proposal_hash,
                    "financial_transaction_confirmation_changed"
                );
                if known.committed {
                    return Ok(None);
                }
                let p = &known.proposal;
                for source in state.sources.scopes.values().filter(|s| {
                    s.scope.account == p.account.account && s.scope.live == p.account.live
                }) {
                    if retired_nonparticipant(state, source, &p.sources) {
                        continue;
                    }
                    ensure!(
                        source.frozen.is_empty(),
                        "financial_transaction_account_source_frozen"
                    );
                    ensure!(
                        source
                            .pending
                            .as_ref()
                            .is_none_or(|pending| pending.id == p.id
                                && p.sources.iter().any(|member| member.scope == source.scope)),
                        "financial_transaction_unrelated_pending_source"
                    );
                }
                // Use only the retained intent; the caller cannot replace members.
                let mut members = Vec::new();
                for s in &p.sources {
                    members.push(GuardEvent::FinancialSource {
                        event: Box::new(source::Event::Commit {
                            scope: s.scope.clone(),
                            transition: p.id,
                        }),
                    });
                }
                for e in &p.enrollments {
                    members.push(GuardEvent::Commit {
                        organization: e.organization,
                        transition_id: p.id,
                    });
                }
                if let Some(i) = &p.ingress {
                    members.push(GuardEvent::FinancialIngress {
                        event: Box::new(ingress::Event::Confirm {
                            scope: p.account.clone(),
                            transition: p.id,
                            head: i.next.clone(),
                            review: None,
                        }),
                    });
                } else {
                    // Even a reservation-only account must remain conflict-free.
                    state.ingress.entry(&p.account)?.ready()?;
                }
                let mut entry = known.clone();
                entry.committed = true;
                Ok(Some(Change {
                    id: p.id,
                    entry,
                    members,
                }))
            }
        }
    }
    fn prepare(&self, state: &Guard, p: &Proposal) -> Result<Option<Change>> {
        ensure!(
            serde_json::to_vec(p)?.len() <= MAX_PROPOSAL_BYTES,
            "financial_transaction_size_limit"
        );
        let digest = p.digest()?;
        if let Some(known) = self.groups.get(&p.id) {
            ensure!(
                known.proposal == *p && known.proposal_hash == digest,
                "financial_transaction_identity_conflict"
            );
            return Ok(None);
        }
        ensure!(
            self.groups.len() < MAX_GROUPS,
            "financial_transaction_capacity"
        );
        ensure!(
            !p.id.is_nil() && Some(p.namespace) == state.namespace,
            "financial_transaction_namespace_or_id_invalid"
        );
        p.account.key()?;
        if let Some(writer) = &p.writer {
            writer.validate(p)?;
            if let Writer::CustomerRecoveryAuthorization {
                organization,
                request,
                ..
            } = writer
            {
                let scope = source::Scope {
                    organization: *organization,
                    account: p.account.account.clone(),
                    live: p.account.live,
                };
                ensure!(
                    state
                        .sources
                        .scopes
                        .get(&scope.key()?)
                        .and_then(|s| s.accepted.get(&request.operation))
                        == Some(request),
                    "financial_customer_original_request_changed"
                );
            }
            if let Writer::CustomerResolution {
                organization,
                request,
                customer,
                outcomes,
                ..
            } = writer
            {
                let scope = source::Scope {
                    organization: *organization,
                    account: p.account.account.clone(),
                    live: p.account.live,
                };
                let entry = state
                    .sources
                    .scopes
                    .get(&scope.key()?)
                    .context("financial_source_uninitialized")?;
                let identity = Some(source::ProviderIdentity::Customer {
                    customer: customer.clone(),
                });
                let evidence = super::team_stripe_customer_request::result_hash(
                    &scope,
                    request.operation,
                    &identity,
                    true,
                )?;
                ensure!(
                    entry.accepted.get(&request.operation) == Some(request)
                        && entry.dispatches.contains_key(&request.operation)
                        && outcomes
                            .iter()
                            .all(|(id, h)| entry.unapplied_outcomes.contains(id)
                                && entry.outcomes.get(id).is_some_and(|o| o.operation
                                    == request.operation
                                    && o.request_hash == request.request_hash
                                    && o.identity == identity
                                    && o.evidence_hash == evidence
                                    && fingerprint(o).is_ok_and(|actual| actual == *h))),
                    "financial_customer_resolution_evidence_changed"
                );
            }
            if let Writer::CustomerLifecycle {
                organization,
                request,
                ..
            } = writer
            {
                let scope = source::Scope {
                    organization: *organization,
                    account: p.account.account.clone(),
                    live: p.account.live,
                };
                ensure!(
                    state
                        .sources
                        .scopes
                        .get(&scope.key()?)
                        .and_then(|s| s.accepted.get(&request.operation))
                        == Some(request),
                    "financial_customer_request_unconfirmed"
                );
            }
        }
        ensure!(
            !p.sources.is_empty()
                && p.sources.len() <= MAX_SOURCES
                && p.sources
                    .windows(2)
                    .all(|s| s[0].scope.organization < s[1].scope.organization),
            "financial_transaction_sources_invalid"
        );
        ensure!(
            p.enrollments.len() <= p.sources.len()
                && p.enrollments
                    .windows(2)
                    .all(|e| e[0].organization < e[1].organization),
            "financial_transaction_enrollments_invalid"
        );
        self.require_account_free(&p.account)?;
        let account = state.ingress.entry(&p.account)?;
        account.ready()?;
        ensure!(
            account.head == p.expected_ingress,
            "financial_transaction_ingress_predecessor_changed"
        );
        match p.mode {
            Mode::Normal => {
                ensure!(
                    p.sources
                        .iter()
                        .all(|s| s.transition.resolved_outcomes.is_empty()),
                    "financial_transaction_resolution_mode_required"
                );
                // A retained outcome can change association across organizations.
                // Normal operation must not route around it through another org.
                for entry in state.sources.scopes.values().filter(|s| {
                    s.scope.account == p.account.account && s.scope.live == p.account.live
                }) {
                    if retired_nonparticipant(state, entry, &p.sources) {
                        continue;
                    }
                    let head = entry
                        .head
                        .as_ref()
                        .context("financial_source_uninitialized")?;
                    state.sources.verify(&entry.scope, head)?;
                }
            }
            Mode::ResolveOutcomes => {
                ensure!(
                    p.sources
                        .iter()
                        .any(|s| !s.transition.resolved_outcomes.is_empty())
                        && p.sources.iter().all(|s| s.transition.accepted.is_empty()),
                    "financial_transaction_resolution_invalid"
                );
                for source in state.sources.scopes.values().filter(|s| {
                    s.scope.account == p.account.account && s.scope.live == p.account.live
                }) {
                    if retired_nonparticipant(state, source, &p.sources) {
                        continue;
                    }
                    ensure!(
                        source.frozen.is_empty()
                            && source.pending.is_none()
                            && source.head.is_some(),
                        "financial_transaction_account_source_not_ready"
                    );
                }
            }
        }
        ensure!(
            !state.used_enrollment_transitions.contains(&p.id)
                && !state
                    .sources
                    .scopes
                    .values()
                    .any(|s| s.used_transitions.contains_key(&p.id))
                && !state
                    .sources
                    .scopes
                    .values()
                    .any(|s| s.review.as_ref().is_some_and(|r| r.id == p.id))
                && !state
                    .ingress
                    .accounts
                    .values()
                    .any(|a| a.used_transitions.contains_key(&p.id) || a.review == p.id)
                && !state.ingress.bootstraps.values().any(|b| b.plan == p.id)
                && !state.ingress.operator_reviews.contains_key(&p.id),
            "financial_transaction_identity_reused"
        );
        let mut members = Vec::new();
        for s in &p.sources {
            ensure!(
                s.scope.account == p.account.account
                    && s.scope.live == p.account.live
                    && s.transition.id == p.id,
                "financial_transaction_member_scope_invalid"
            );
            self.require_organization_free(s.scope.organization)?;
            let org = state
                .organizations
                .get(&s.scope.organization)
                .context("financial_guard_unknown_organization")?;
            ensure!(
                org.pending.is_none() && matches!(org.head, Head::Legacy | Head::Enrolled { .. }),
                "financial_transaction_organization_not_ready"
            );
            members.push(GuardEvent::FinancialSource {
                event: Box::new(source::Event::Prepare {
                    scope: s.scope.clone(),
                    expected: s.expected.clone(),
                    transition: s.transition.clone(),
                }),
            });
        }
        for e in &p.enrollments {
            ensure!(
                p.sources
                    .iter()
                    .any(|s| s.scope.organization == e.organization)
                    && e.transition.transition_id == p.id,
                "financial_transaction_enrollment_scope_invalid"
            );
            members.push(GuardEvent::Prepare {
                organization: e.organization,
                expected: e.expected.clone(),
                transition: e.transition.clone(),
            });
        }
        if let Some(i) = &p.ingress {
            ensure!(
                i.receipt.transition == p.id && i.expected == p.expected_ingress,
                "financial_transaction_ingress_scope_invalid"
            );
            members.push(GuardEvent::FinancialIngress {
                event: Box::new(ingress::Event::Prepare {
                    scope: p.account.clone(),
                    proposal: i.clone(),
                }),
            });
        }
        ensure!(
            observation_hash(
                state,
                &p.account,
                &p.sources
                    .iter()
                    .map(|s| s.scope.organization)
                    .collect::<Vec<_>>()
            )? == p.observation_hash,
            "financial_transaction_observation_changed"
        );
        Ok(Some(Change {
            id: p.id,
            entry: Entry {
                proposal: p.clone(),
                proposal_hash: digest,
                committed: false,
            },
            members,
        }))
    }
}
/// Capture before SQL mutation, then compare again at durable Prepare. A matching
/// hash is an observation fence, never a capability or a substitute for SQL locks.
pub fn observation_hash(
    state: &Guard,
    account: &ingress::Scope,
    organizations: &[Uuid],
) -> Result<String> {
    account.key()?;
    ensure!(
        !organizations.is_empty()
            && organizations.len() <= MAX_SOURCES
            && organizations.windows(2).all(|o| o[0] < o[1]),
        "financial_transaction_sources_invalid"
    );
    let sources: Vec<_> = state
        .sources
        .scopes
        .values()
        .filter(|s| s.scope.account == account.account && s.scope.live == account.live)
        .collect();
    let orgs = organizations
        .iter()
        .map(|o| {
            Ok((
                *o,
                state
                    .organizations
                    .get(o)
                    .context("financial_guard_unknown_organization")?,
            ))
        })
        .collect::<Result<Vec<_>>>()?;
    fingerprint(&(
        "financial_transaction_observation_v1",
        state.namespace,
        account,
        state.ingress.entry(account)?,
        sources,
        orgs,
    ))
}

#[cfg(test)]
#[path = "team_financial_transaction_tests.rs"]
pub(crate) mod tests;

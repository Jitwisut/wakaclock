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

/// Namespace-wide operation reservation, including evidence without a SQL row.
/// Receipt/lease/transaction IDs belong to other domains and are not nonces here.
/// New cancellation acceptance uses this under the journal lock; it does not
/// retroactively change the validation of historical writers.
pub(crate) fn operation_known(state: &Guard, operation: Uuid) -> bool {
    state.births.values().any(|b| {
        b.birth.reserved_ids().contains(&operation) || b.confirmations.contains_key(&operation)
    }) || state.sources.scopes.values().any(|entry| {
        entry.accepted.contains_key(&operation)
            || entry.dispatches.contains_key(&operation)
            || entry
                .pending
                .as_ref()
                .is_some_and(|p| p.accepted.iter().any(|r| r.operation == operation))
            || entry
                .outcomes
                .values()
                .chain(entry.conflicting_outcomes.values())
                .any(|r| r.operation == operation)
            || entry
                .customer_lookups
                .values()
                .chain(entry.conflicting_customer_lookups.values())
                .any(|r| r.operation == operation)
            || entry
                .checkout_observations
                .values()
                .chain(entry.conflicting_checkout_observations.values())
                .any(|r| r.operation == operation)
            || entry
                .checkout_failures
                .values()
                .chain(entry.conflicting_checkout_failures.values())
                .any(|r| r.operation == operation)
            || entry
                .cancellation_observations
                .values()
                .chain(entry.conflicting_cancellation_observations.values())
                .any(|r| r.request.operation() == operation)
            || entry
                .cancellation_failures
                .values()
                .chain(entry.conflicting_cancellation_failures.values())
                .any(|r| r.request.operation() == operation)
    }) || state.transactions.groups.values().any(|group| {
        group.proposal.sources.iter().any(|s| {
            s.transition
                .accepted
                .iter()
                .any(|r| r.operation == operation)
        }) || group
            .proposal
            .writer
            .as_ref()
            .is_some_and(|w| w.references_operation(operation))
    })
}

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
pub enum CheckoutStage {
    ResumeReadback {
        first_attempt_at: Option<chrono::DateTime<chrono::Utc>>,
        actor: Uuid,
        session: Option<String>,
    },
    FirstAttempt {
        first_attempt_at: chrono::DateTime<chrono::Utc>,
    },
    Stop {
        first_attempt_at: Option<chrono::DateTime<chrono::Utc>>,
        lookup_only: bool,
        recovery_actor: Option<Uuid>,
        reason: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        provider_receipt: Option<Uuid>,
    },
    RecoveryAuthorization {
        first_attempt_at: Option<chrono::DateTime<chrono::Utc>>,
        actor: Uuid,
        authorized_at: chrono::DateTime<chrono::Utc>,
    },
}
impl CheckoutStage {
    pub(crate) fn stop_disposition(reason: &str) -> Result<&'static str> {
        Ok(match reason {
            "owner_authorization_changed" => "owner_changed",
            "quote_expired_before_attempt" => "expired",
            "checkout_scope_changed"
            | "developer_capacity_changed"
            | "checkout_session_identity_missing"
            | "checkout_request_unconfirmed"
            | "idempotency_window_unconfirmed"
            | "checkout_not_found_unconfirmed"
            | "checkout_candidates_ambiguous"
            | "checkout_lookup_limit"
            | "subscription_unconfirmed"
            | "unsupported_contract"
            | "provider_scope_mismatch" => "recovery_required",
            _ => anyhow::bail!("financial_checkout_stop_reason_invalid"),
        })
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum CheckoutProjection {
    Current { lease: Uuid },
    EvidenceOnly { owner_changed: bool },
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CheckoutBinding {
    pub subscription: String,
    pub binding_revision: i64,
    pub requested_revision: i64,
    pub observation_hash: String,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Writer {
    CancellationResult {
        projection: Box<super::team_subscription_cancellation::projection::CancellationProjection>,
    },
    CancellationLifecycle {
        request: super::team_subscription_cancellation::FrozenCancellation,
        expected_revision: i64,
        stage: super::team_subscription_cancellation::lifecycle::CancellationStage,
    },
    CancellationRequest {
        request: super::team_subscription_cancellation::FrozenCancellation,
        read: super::team_subscription_cancellation::ReadEvidence,
    },
    CheckoutProjection {
        organization: Uuid,
        request: source::AcceptedRequest,
        observation: super::team_stripe_checkout_receipt::Observation,
        expected_revision: i64,
        expected_actor: Uuid,
        subscription_before: Option<String>,
        subscription_after: Option<String>,
        projection: CheckoutProjection,
        outcomes: BTreeMap<Uuid, String>,
        binding: Option<CheckoutBinding>,
    },
    CheckoutLifecycle {
        organization: Uuid,
        request: source::AcceptedRequest,
        expected_revision: i64,
        stage: CheckoutStage,
    },
    CheckoutRequest {
        organization: Uuid,
        quote: Uuid,
        customer: String,
        request: source::AcceptedRequest,
    },
    CustomerLookupProjection {
        organization: Uuid,
        request: source::AcceptedRequest,
        observation: source::CustomerLookup,
        customer_before: Option<String>,
        outcomes: BTreeMap<Uuid, String>,
        resolved_customer: Option<String>,
        projected_at: chrono::DateTime<chrono::Utc>,
        projection: CustomerProjection,
    },
    CustomerLookupStop {
        organization: Uuid,
        request: source::AcceptedRequest,
        actor: Uuid,
        revision: i64,
        stopped_at: chrono::DateTime<chrono::Utc>,
        customer_before: Option<String>,
        outcomes: BTreeMap<Uuid, String>,
        resolved_customer: Option<String>,
    },
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
    UpgradePreviewRequest {
        request: Box<super::team_stripe_change_payment::preview::PreviewRequest>,
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
    fn references_operation(&self, operation: Uuid) -> bool {
        match self {
            Self::UpgradePreviewRequest { request } => request.quote_id == operation,
            Self::CancellationResult { projection } => projection.request.operation() == operation,
            Self::CancellationRequest { request, .. }
            | Self::CancellationLifecycle { request, .. } => request.operation() == operation,
            Self::CheckoutProjection { request, .. }
            | Self::CheckoutLifecycle { request, .. }
            | Self::CheckoutRequest { request, .. }
            | Self::CustomerLookupProjection { request, .. }
            | Self::CustomerLookupStop { request, .. }
            | Self::CustomerRecoveryAuthorization { request, .. }
            | Self::CustomerResolution { request, .. }
            | Self::CustomerLifecycle { request, .. }
            | Self::CustomerRequest { request, .. } => request.operation == operation,
            Self::Quote {
                customer_operation, ..
            } => *customer_operation == operation,
            Self::Scheduler { .. } | Self::Reconciliation { .. } => false,
        }
    }
    pub fn change_hash(&self, account: &ingress::Scope, scope: &source::Scope) -> Result<String> {
        fingerprint(&("financial_normal_writer_v1", account, self, scope))
    }
    pub fn resolved(&self, scope: &source::Scope) -> std::collections::BTreeSet<Uuid> {
        match self {
            Self::CancellationResult { projection } if projection.request.scope() == scope => {
                projection.outcomes.keys().copied().collect()
            }
            Self::CheckoutProjection {
                organization,
                outcomes,
                ..
            }
            | Self::CustomerResolution {
                organization,
                outcomes,
                ..
            }
            | Self::CustomerLookupProjection {
                organization,
                outcomes,
                ..
            }
            | Self::CustomerLookupStop {
                organization,
                outcomes,
                ..
            } if *organization == scope.organization => outcomes.keys().copied().collect(),
            _ => Default::default(),
        }
    }
    fn validate(&self, p: &Proposal) -> Result<()> {
        if let Self::UpgradePreviewRequest { request } = self {
            request.validate()?;
            ensure!(
                p.mode == Mode::Normal
                    && p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && p.sources.len() == 1
                    && request.scope.account == p.account.account
                    && request.scope.live == p.account.live,
                "financial_upgrade_preview_request_invalid"
            );
            let change = &p.sources[0];
            ensure!(
                change.scope == request.scope
                    && change.transition.accepted == vec![request.accepted_request()?]
                    && change.transition.resolved_outcomes.is_empty()
                    && change.transition.change_hash
                        == self.change_hash(&p.account, &change.scope)?,
                "financial_upgrade_preview_request_scope_invalid"
            );
            return Ok(());
        }
        if let Self::CancellationResult { projection } = self {
            projection.validate()?;
            ensure!(
                p.mode == Mode::ResolveOutcomes
                    && p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && projection.request.scope().account == p.account.account
                    && projection.request.scope().live == p.account.live
                    && p.sources
                        .iter()
                        .any(|change| change.scope == *projection.request.scope()),
                "financial_cancellation_result_scope_invalid"
            );
            for change in &p.sources {
                ensure!(
                    change.transition.accepted.is_empty()
                        && change.transition.resolved_outcomes == self.resolved(&change.scope)
                        && change.transition.change_hash
                            == self.change_hash(&p.account, &change.scope)?,
                    "financial_cancellation_result_scope_invalid"
                );
            }
            return Ok(());
        }
        if let Self::CancellationLifecycle {
            request,
            expected_revision,
            stage,
        } = self
        {
            stage.validate(request, *expected_revision)?;
            ensure!(
                p.mode == Mode::Normal
                    && p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && p.sources.len() == 1
                    && request.scope().account == p.account.account
                    && request.scope().live == p.account.live,
                "financial_cancellation_lifecycle_invalid"
            );
            let change = &p.sources[0];
            ensure!(
                change.scope == *request.scope()
                    && change.transition.accepted.is_empty()
                    && change.transition.resolved_outcomes.is_empty()
                    && change.transition.change_hash
                        == self.change_hash(&p.account, &change.scope)?,
                "financial_cancellation_lifecycle_scope_invalid"
            );
            return Ok(());
        }
        if let Self::CancellationRequest { request, read } = self {
            request.validate()?;
            read.validate(request)?;
            ensure!(
                p.mode == Mode::Normal
                    && p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && p.sources.len() == 1
                    && request.scope().account == p.account.account
                    && request.scope().live == p.account.live,
                "financial_cancellation_request_invalid"
            );
            let change = &p.sources[0];
            ensure!(
                change.scope == *request.scope()
                    && change.transition.accepted == vec![request.accepted_request()?]
                    && change.transition.resolved_outcomes.is_empty()
                    && change.transition.change_hash
                        == self.change_hash(&p.account, &change.scope)?,
                "financial_cancellation_request_scope_invalid"
            );
            return Ok(());
        }
        if let Self::CheckoutProjection {
            organization,
            request,
            observation,
            expected_revision,
            expected_actor,
            subscription_before,
            subscription_after,
            projection,
            outcomes,
            binding,
        } = self
        {
            ensure!(
                p.mode
                    == if outcomes.is_empty() {
                        Mode::Normal
                    } else {
                        Mode::ResolveOutcomes
                    }
                    && p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && !p.sources.is_empty()
                    && (!outcomes.is_empty() || p.sources.len() == 1)
                    && request.kind == source::OperationKind::CreateCheckout
                    && *expected_revision > 0
                    && *expected_revision < i64::MAX
                    && observation.source_claim
                    && observation.operation == request.operation
                    && observation.request_hash == request.request_hash
                    && observation.revision <= *expected_revision
                    && !expected_actor.is_nil()
                    && observation.observed_at >= request.accepted_at
                    && outcomes.len() <= 100
                    && outcomes.iter().all(|(id, hash)| !id.is_nil()
                        && hash.len() == 64
                        && hash.bytes().all(|b| b.is_ascii_hexdigit())),
                "financial_checkout_projection_invalid"
            );
            let scope = p
                .sources
                .iter()
                .find(|s| s.scope.organization == *organization)
                .context("financial_checkout_projection_scope_missing")?;
            observation.validate(&scope.scope)?;
            ensure!(
                subscription_before
                    .as_ref()
                    .zip(observation.session.subscription.as_ref())
                    .is_none_or(|(a, b)| a == b)
                    && subscription_before
                        .as_ref()
                        .zip(subscription_after.as_ref())
                        .is_none_or(|(a, b)| a == b)
                    && (subscription_before.is_none() || subscription_after.is_some())
                    && subscription_after
                        .as_ref()
                        .is_none_or(|id| super::team_stripe::id(id, "sub_")),
                "financial_checkout_subscription_conflict"
            );
            if let CheckoutProjection::Current { lease } = projection {
                ensure!(
                    !lease.is_nil()
                        && observation.revision == *expected_revision
                        && observation.actor == *expected_actor
                        && *lease == observation.lease
                        && observation.kind
                            == super::team_stripe_checkout_receipt::ObservationKind::ResourceRead
                        && subscription_after == &observation.session.subscription,
                    "financial_checkout_current_observation_required"
                );
            }
            if let Some(binding) = binding {
                ensure!(
                    matches!(projection, CheckoutProjection::Current { .. })
                        && observation.session.status == "complete"
                        && observation.session.subscription.as_deref()
                            == Some(binding.subscription.as_str())
                        && super::team_stripe::id(&binding.subscription, "sub_")
                        && binding.binding_revision > 0
                        && binding.requested_revision > 0
                        && binding.observation_hash.len() == 64
                        && binding
                            .observation_hash
                            .bytes()
                            .all(|b| b.is_ascii_hexdigit()),
                    "financial_checkout_binding_invalid"
                );
            }
            for source in &p.sources {
                ensure!(
                    source.transition.accepted.is_empty()
                        && source.transition.resolved_outcomes == self.resolved(&source.scope)
                        && source.transition.change_hash
                            == self.change_hash(&p.account, &source.scope)?,
                    "financial_checkout_projection_scope_invalid"
                );
            }
            return Ok(());
        }
        if let Self::CheckoutLifecycle {
            organization,
            request,
            expected_revision,
            stage,
        } = self
        {
            ensure!(
                p.mode == Mode::Normal
                    && p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && p.sources.len() == 1
                    && *expected_revision > 0
                    && *expected_revision < i64::MAX
                    && request.kind == source::OperationKind::CreateCheckout,
                "financial_checkout_lifecycle_invalid"
            );
            match stage {
                CheckoutStage::ResumeReadback {
                    first_attempt_at,
                    actor,
                    session,
                } => ensure!(
                    !actor.is_nil()
                        && first_attempt_at.is_none_or(|at| at >= request.accepted_at)
                        && session.as_ref().is_none_or(|id| super::team_stripe::id(
                            id,
                            if p.account.live {
                                "cs_live_"
                            } else {
                                "cs_test_"
                            }
                        )),
                    "financial_checkout_resume_invalid"
                ),
                CheckoutStage::FirstAttempt { first_attempt_at } => ensure!(
                    *expected_revision == 1 && first_attempt_at >= &request.accepted_at,
                    "financial_checkout_first_attempt_invalid"
                ),
                CheckoutStage::Stop {
                    first_attempt_at,
                    recovery_actor,
                    reason,
                    provider_receipt,
                    ..
                } => {
                    CheckoutStage::stop_disposition(reason)?;
                    let provider_reason = matches!(
                        reason.as_str(),
                        "checkout_not_found_unconfirmed"
                            | "checkout_candidates_ambiguous"
                            | "checkout_lookup_limit"
                            | "subscription_unconfirmed"
                            | "unsupported_contract"
                            | "provider_scope_mismatch"
                    );
                    ensure!(
                        !provider_reason || provider_receipt.is_some(),
                        "financial_checkout_failure_receipt_required"
                    );
                    ensure!(
                        provider_receipt.is_none_or(|id| !id.is_nil()),
                        "financial_checkout_failure_receipt_invalid"
                    );

                    ensure!(
                        first_attempt_at.is_none_or(|t| t >= request.accepted_at)
                            && recovery_actor.is_none_or(|id| !id.is_nil()),
                        "financial_checkout_stop_invalid"
                    );
                }
                CheckoutStage::RecoveryAuthorization {
                    first_attempt_at,
                    actor,
                    authorized_at,
                } => ensure!(
                    !actor.is_nil()
                        && authorized_at >= &request.accepted_at
                        && first_attempt_at.is_none_or(|t| t >= request.accepted_at),
                    "financial_checkout_authorization_invalid"
                ),
            }
            let source = &p.sources[0];
            ensure!(
                source.scope.organization == *organization
                    && source.transition.accepted.is_empty()
                    && source.transition.resolved_outcomes.is_empty()
                    && source.transition.change_hash
                        == self.change_hash(&p.account, &source.scope)?,
                "financial_checkout_lifecycle_scope_invalid"
            );
            return Ok(());
        }
        if let Self::CheckoutRequest {
            organization,
            quote,
            customer,
            request,
        } = self
        {
            ensure!(
                p.mode == Mode::Normal
                    && p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && p.sources.len() == 1
                    && !quote.is_nil()
                    && !request.operation.is_nil()
                    && !request.actor.is_nil()
                    && request.kind == source::OperationKind::CreateCheckout
                    && super::team_stripe::id(customer, "cus_")
                    && request.request_hash.len() == 64
                    && request.request_hash.bytes().all(|b| b.is_ascii_hexdigit())
                    && request.idempotency_hash
                        == fingerprint(&format!("atoaxis-checkout-v1-{}", request.operation))?,
                "financial_checkout_request_invalid"
            );
            let source = &p.sources[0];
            ensure!(
                source.scope.organization == *organization
                    && source.transition.accepted == vec![request.clone()]
                    && source.transition.resolved_outcomes.is_empty()
                    && source.transition.change_hash
                        == self.change_hash(&p.account, &source.scope)?,
                "financial_checkout_request_scope_invalid"
            );
            return Ok(());
        }
        if let Self::CustomerLookupProjection {
            organization,
            request,
            observation,
            customer_before,
            outcomes,
            resolved_customer,
            projected_at,
            projection,
        } = self
        {
            ensure!(
                p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && !p.sources.is_empty()
                    && p.sources
                        .iter()
                        .any(|s| s.scope.organization == *organization)
                    && observation.operation == request.operation
                    && observation.request_hash == request.request_hash
                    && observation.authorization_revision > 1
                    && observation.authorization_revision < i64::MAX
                    && *projected_at >= request.accepted_at
                    && outcomes.len() <= 100
                    && (!outcomes.is_empty() || p.sources.len() == 1)
                    && resolved_customer.is_some() != outcomes.is_empty()
                    && resolved_customer
                        .as_ref()
                        .is_none_or(|id| super::team_stripe::id(id, "cus_"))
                    && customer_before
                        .as_ref()
                        .is_none_or(|id| super::team_stripe::id(id, "cus_"))
                    && p.mode
                        == if outcomes.is_empty() {
                            Mode::Normal
                        } else {
                            Mode::ResolveOutcomes
                        },
                "financial_customer_lookup_projection_invalid"
            );
            ensure!(
                matches!(
                    observation.result,
                    source::CustomerLookupResult::Verified { .. }
                        | source::CustomerLookupResult::NotFound
                        | source::CustomerLookupResult::Deleted { .. }
                ),
                "financial_customer_lookup_projection_conflict"
            );
            if let source::CustomerLookupResult::Verified { customer, .. } = &observation.result {
                ensure!(
                    customer_before.as_ref().is_none_or(|v| v == customer),
                    "financial_customer_lookup_identity_changed"
                );
            }
            if let CustomerProjection::Verified { lease } = projection {
                ensure!(
                    *lease == observation.lease
                        && !lease.is_nil()
                        && matches!(
                            observation.result,
                            source::CustomerLookupResult::Verified { .. }
                        ),
                    "financial_customer_lookup_lease_invalid"
                );
            }
            for source in &p.sources {
                ensure!(
                    source.transition.accepted.is_empty()
                        && source.transition.resolved_outcomes == self.resolved(&source.scope)
                        && source.transition.change_hash
                            == self.change_hash(&p.account, &source.scope)?,
                    "financial_customer_lookup_scope_invalid"
                );
            }
            return Ok(());
        }
        if let Self::CustomerLookupStop {
            organization,
            request,
            actor,
            revision,
            stopped_at,
            customer_before,
            outcomes,
            resolved_customer,
        } = self
        {
            ensure!(
                p.ingress.is_none()
                    && p.enrollments.is_empty()
                    && !p.sources.is_empty()
                    && p.sources
                        .iter()
                        .any(|s| s.scope.organization == *organization)
                    && !actor.is_nil()
                    && *revision > 1
                    && *revision < i64::MAX
                    && *stopped_at >= request.accepted_at
                    && customer_before
                        .as_ref()
                        .is_none_or(|v| super::team_stripe::id(v, "cus_"))
                    && resolved_customer.is_some() != outcomes.is_empty()
                    && outcomes.len() <= 100
                    && resolved_customer
                        .as_ref()
                        .is_none_or(|v| super::team_stripe::id(v, "cus_"))
                    && p.mode
                        == if outcomes.is_empty() {
                            Mode::Normal
                        } else {
                            Mode::ResolveOutcomes
                        },
                "financial_customer_lookup_stop_invalid"
            );
            for source in &p.sources {
                ensure!(
                    source.transition.accepted.is_empty()
                        && source.transition.resolved_outcomes == self.resolved(&source.scope)
                        && source.transition.change_hash
                            == self.change_hash(&p.account, &source.scope)?,
                    "financial_customer_lookup_stop_scope_invalid"
                );
            }
            return Ok(());
        }
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
                    && (!outcomes.is_empty() || p.sources.len() == 1)
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
            Self::CustomerLookupProjection { .. }
            | Self::CancellationRequest { .. }
            | Self::CancellationResult { .. }
            | Self::CancellationLifecycle { .. }
            | Self::CustomerLookupStop { .. }
            | Self::CheckoutRequest { .. }
            | Self::CheckoutLifecycle { .. }
            | Self::CheckoutProjection { .. }
            | Self::Quote { .. }
            | Self::UpgradePreviewRequest { .. }
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
    ConfirmReviewed {
        transaction: Uuid,
        proposal_hash: String,
        review: OperatorReview,
    },
}
/// Metadata for an explicit exact-next review. Neither this receipt nor its
/// caller-supplied evidence digest establishes independent backup freshness.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OperatorReview {
    pub id: Uuid,
    pub plan_digest: String,
    pub evidence_hash: String,
    pub reviewed_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}
impl OperatorReview {
    fn validate(&self) -> Result<()> {
        ensure!(
            !self.id.is_nil()
                && super::team_financial_recovery::digest(&self.plan_digest)
                && super::team_financial_recovery::digest(&self.evidence_hash)
                && self.reviewed_at < self.expires_at
                && self.expires_at - self.reviewed_at <= chrono::Duration::minutes(15),
            "financial_transaction_review_invalid"
        );
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq)]
pub struct Entry {
    pub proposal: Proposal,
    pub proposal_hash: String,
    pub committed: bool,
    pub operator_review: Option<OperatorReview>,
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
                        | source::Event::CustomerLookup { .. }
                        | source::Event::CheckoutObservation { .. }
                        | source::Event::CheckoutFailure { .. }
                        | source::Event::CancellationObservation { .. }
                        | source::Event::CancellationFailure { .. }
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
            identities.iter().all(|id| !self.groups.contains_key(id)
                && self
                    .groups
                    .values()
                    .all(|g| g.operator_review.as_ref().is_none_or(|r| r.id != *id))),
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
            }
            | Event::ConfirmReviewed {
                transaction,
                proposal_hash,
                ..
            } => {
                let review = match event {
                    Event::ConfirmReviewed { review, .. } => Some(review),
                    _ => None,
                };
                let known = self
                    .groups
                    .get(transaction)
                    .context("financial_transaction_unknown")?;
                ensure!(
                    known.proposal_hash == *proposal_hash,
                    "financial_transaction_confirmation_changed"
                );
                if let Some(review) = review {
                    review.validate()?;
                    ensure!(
                        known.proposal.writer.is_some()
                            && known.proposal.ingress.is_none()
                            && !self.groups.contains_key(&review.id)
                            && !state.used_enrollment_transitions.contains(&review.id)
                            && !state
                                .sources
                                .scopes
                                .values()
                                .any(|s| s.used_transitions.contains_key(&review.id)
                                    || s.review.as_ref().is_some_and(|r| r.id == review.id))
                            && !state
                                .ingress
                                .accounts
                                .values()
                                .any(|a| a.used_transitions.contains_key(&review.id)
                                    || a.review == review.id)
                            && !state
                                .ingress
                                .bootstraps
                                .values()
                                .any(|b| b.plan == review.id)
                            && !state.ingress.operator_reviews.contains_key(&review.id)
                            && self.groups.values().all(|g| g.proposal.id == *transaction
                                || g.operator_review.as_ref().is_none_or(|r| r.id != review.id)),
                        "financial_transaction_review_reused"
                    );
                    ensure!(
                        !known.committed || known.operator_review.as_ref() == Some(review),
                        "financial_transaction_review_changed"
                    );
                }
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
                entry.operator_review = review.cloned();
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
            if let Writer::UpgradePreviewRequest { request } = writer {
                ensure!(
                    !operation_known(state, request.quote_id),
                    "financial_upgrade_preview_nonce_already_retained"
                );
            }
            if let Writer::CancellationResult { projection } = writer {
                use super::team_subscription_cancellation::projection::{
                    self as policy, ProjectionMode,
                };
                let request = &projection.request;
                let observation = &projection.observation;
                let request_hash = request.request_hash()?;
                let entry = state
                    .sources
                    .scopes
                    .get(&request.scope().key()?)
                    .context("financial_source_uninitialized")?;
                ensure!(
                    entry.accepted.get(&request.operation()) == Some(&request.accepted_request()?)
                        && entry.cancellation_observations.get(&observation.id)
                            == Some(observation)
                        && projection.outcomes.iter().all(|(id, hash)| entry
                            .unapplied_outcomes
                            .contains(id)
                            && entry
                                .outcomes
                                .get(id)
                                .is_some_and(|outcome| outcome.operation == request.operation()
                                    && outcome.id == observation.outcome
                                    && outcome.request_hash == request_hash
                                    && outcome.identity
                                        == Some(observation.subscription.identity())
                                    && fingerprint(outcome).is_ok_and(|actual| actual == *hash))),
                    "financial_cancellation_result_evidence_changed"
                );
                let epoch = policy::exchange_epoch(state, request, &projection.exchange)?;
                if matches!(
                    &projection.mode,
                    ProjectionMode::RetainedOnly {
                        resume_initial_read: true,
                        ..
                    }
                ) {
                    ensure!(
                        policy::never_mutated(state, request),
                        "financial_cancellation_initial_read_resume_mutation_history"
                    );
                }
                if matches!(
                    &projection.mode,
                    ProjectionMode::Current { .. }
                        | ProjectionMode::RetainedOnly { park: true, .. }
                ) {
                    ensure!(
                        epoch == policy::latest_exchange_epoch(state, request)?,
                        "financial_cancellation_result_cannot_replace_newer_exchange"
                    );
                }
            }
            if let Writer::CancellationLifecycle {
                request,
                expected_revision,
                stage,
            } = writer
            {
                use super::team_subscription_cancellation::lifecycle::{
                    authorization_hash, CancellationStage, ExchangeKind,
                };
                let entry = state
                    .sources
                    .scopes
                    .get(&request.scope().key()?)
                    .context("financial_source_uninitialized")?;
                ensure!(
                    entry.accepted.get(&request.operation()) == Some(&request.accepted_request()?),
                    "financial_cancellation_original_request_changed"
                );
                if let CancellationStage::BeginExchange { exchange } = stage {
                    ensure!(
                        !state.transactions.groups.values().any(|group| {
                            match group.proposal.writer.as_ref() {
                                Some(Writer::CancellationLifecycle {
                                    stage: CancellationStage::BeginExchange { exchange: known },
                                    ..
                                }) => known.id == exchange.id,
                                Some(Writer::CancellationRequest { read, .. }) => {
                                    read.exchange == exchange.id
                                }
                                _ => false,
                            }
                        }) && !state.sources.scopes.values().any(|entry| entry
                            .cancellation_observations
                            .values()
                            .chain(entry.conflicting_cancellation_observations.values())
                            .any(|o| o.attempt.exchange == exchange.id)
                            || entry
                                .cancellation_failures
                                .values()
                                .chain(entry.conflicting_cancellation_failures.values())
                                .any(|o| o.attempt.exchange == exchange.id)),
                        "financial_cancellation_exchange_already_retained"
                    );
                    let expected = if *expected_revision == 1 {
                        ensure!(
                            exchange.actor == request.actor(),
                            "financial_cancellation_original_actor_changed"
                        );
                        authorization_hash(
                            request,
                            1,
                            request.actor(),
                            request.accepted_at(),
                            "request_cancel_at_period_end",
                        )?
                    } else {
                        let authorization = state
                            .transactions
                            .groups
                            .values()
                            .filter(|g| g.committed && g.proposal.account == p.account)
                            .filter_map(|g| g.proposal.writer.as_ref())
                            .find_map(|w| match w {
                                Writer::CancellationLifecycle {
                                    request: r,
                                    expected_revision: rev,
                                    stage:
                                        CancellationStage::RecoveryAuthorization {
                                            actor,
                                            authorized_at,
                                            ..
                                        },
                                } if r == request
                                    && rev.checked_add(1) == Some(*expected_revision)
                                    && *actor == exchange.actor =>
                                {
                                    Some((*actor, *authorized_at))
                                }
                                _ => None,
                            })
                            .context("financial_cancellation_recovery_authorization_missing")?;
                        ensure!(
                            exchange.kind == ExchangeKind::ResourceRead,
                            "financial_cancellation_recovery_is_read_only"
                        );
                        authorization_hash(
                            request,
                            *expected_revision,
                            authorization.0,
                            authorization.1,
                            "reconcile_existing_cancellation",
                        )?
                    };
                    ensure!(
                        exchange.authorization_hash == expected,
                        "financial_cancellation_authorization_changed"
                    );
                    if let Some(dispatch) = entry.dispatches.get(&request.operation()) {
                        ensure!(
                            exchange.first_attempt_at == Some(dispatch.first_attempt_at),
                            "financial_cancellation_first_attempt_changed"
                        );
                    }
                }
            }
            if let Writer::CancellationRequest { request, .. } = writer {
                // This runs under the guard's journal lock. SQL PKs alone cannot
                // reserve a nonce after a lost SQL transaction/retained Prepare.
                // The exact same group retry returned above before this check.
                ensure!(
                    !operation_known(state, request.operation()),
                    "cancellation_operation_already_retained"
                );
            }
            if let Writer::CustomerLookupProjection {
                organization,
                request,
                observation,
                outcomes,
                resolved_customer,
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
                ensure!(
                    entry.accepted.get(&request.operation) == Some(request)
                        && entry.customer_lookups.get(&observation.id) == Some(observation)
                        && fingerprint(recovery_authorization(
                            state,
                            &scope,
                            request,
                            observation.actor,
                            observation.authorization_revision
                        )?)? == observation.authorization_hash,
                    "financial_customer_lookup_receipt_changed"
                );
                if let source::CustomerLookupResult::Verified { customer, outcome } =
                    &observation.result
                {
                    let identity = Some(source::ProviderIdentity::Customer {
                        customer: customer.clone(),
                    });
                    let observed = entry
                        .outcomes
                        .get(outcome)
                        .context("financial_customer_lookup_outcome_missing")?;
                    ensure!(
                        observed.operation == request.operation
                            && observed.request_hash == request.request_hash
                            && observed.identity == identity
                            && observed.evidence_hash
                                == super::team_stripe_customer_request::result_hash(
                                    &scope,
                                    request.operation,
                                    &identity,
                                    true
                                )?
                            && outcomes
                                .iter()
                                .all(|(id, h)| entry.unapplied_outcomes.contains(id)
                                    && entry.outcomes.get(id).is_some_and(|o| o.operation
                                        == request.operation
                                        && o.identity == identity
                                        && o.request_hash == request.request_hash
                                        && o.evidence_hash == observed.evidence_hash
                                        && fingerprint(o).is_ok_and(|v| v == *h))),
                        "financial_customer_lookup_outcome_changed"
                    );
                }
                if !outcomes.is_empty() {
                    let customer = resolved_customer
                        .as_ref()
                        .context("financial_lookup_resolution_customer_missing")?;
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
                        match &observation.result {
                            source::CustomerLookupResult::Verified { customer: c, .. }
                            | source::CustomerLookupResult::Deleted { customer: c } =>
                                c == customer,
                            source::CustomerLookupResult::NotFound => true,
                            _ => false,
                        } && outcomes
                            .iter()
                            .all(|(id, h)| entry.unapplied_outcomes.contains(id)
                                && entry.outcomes.get(id).is_some_and(|o| o.operation
                                    == request.operation
                                    && o.request_hash == request.request_hash
                                    && o.identity == identity
                                    && o.evidence_hash == evidence
                                    && fingerprint(o).is_ok_and(|v| v == *h))),
                        "financial_lookup_retained_resolution_changed"
                    );
                }
            }
            if let Writer::CustomerLookupStop {
                organization,
                request,
                actor,
                revision,
                outcomes,
                resolved_customer,
                ..
            } = writer
            {
                let scope = source::Scope {
                    organization: *organization,
                    account: p.account.account.clone(),
                    live: p.account.live,
                };
                recovery_authorization(state, &scope, request, *actor, *revision)?;
                if !outcomes.is_empty() {
                    let customer = resolved_customer
                        .as_ref()
                        .context("financial_lookup_resolution_customer_missing")?;
                    let identity = Some(source::ProviderIdentity::Customer {
                        customer: customer.clone(),
                    });
                    let evidence = super::team_stripe_customer_request::result_hash(
                        &scope,
                        request.operation,
                        &identity,
                        true,
                    )?;
                    let entry = state
                        .sources
                        .scopes
                        .get(&scope.key()?)
                        .context("financial_source_uninitialized")?;
                    ensure!(
                        outcomes
                            .iter()
                            .all(|(id, h)| entry.unapplied_outcomes.contains(id)
                                && entry.outcomes.get(id).is_some_and(|o| o.operation
                                    == request.operation
                                    && o.request_hash == request.request_hash
                                    && o.identity == identity
                                    && o.evidence_hash == evidence
                                    && fingerprint(o).is_ok_and(|v| v == *h))),
                        "financial_lookup_retained_resolution_changed"
                    );
                }
            }
            if let Writer::CheckoutProjection {
                organization,
                request,
                observation,
                outcomes,
                subscription_before,
                subscription_after,
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
                let known = super::team_stripe_checkout_receipt::known_subscription(
                    entry,
                    request.operation,
                    &observation.session.id,
                    &observation.session.customer,
                )?;
                ensure!(
                    *subscription_after
                        == subscription_before
                            .clone()
                            .or(known)
                            .or(observation.session.subscription.clone()),
                    "financial_checkout_subscription_changed"
                );
                ensure!(
                    entry.accepted.get(&request.operation) == Some(request)
                        && entry.checkout_observations.get(&observation.id) == Some(observation)
                        && entry
                            .outcomes
                            .get(&observation.outcome)
                            .is_some_and(|o| o.operation == request.operation
                                && o.request_hash == request.request_hash
                                && o.identity == Some(observation.session.identity()))
                        && outcomes
                            .iter()
                            .all(|(id, hash)| entry.unapplied_outcomes.contains(id)
                                && entry
                                    .outcomes
                                    .get(id)
                                    .is_some_and(|o| o.operation == request.operation
                                        && o.request_hash == request.request_hash
                                        && fingerprint(o).is_ok_and(|value| value == *hash))),
                    "financial_checkout_projection_evidence_changed"
                );
            }
            if let Writer::CheckoutLifecycle {
                organization,
                request,
                stage,
                expected_revision,
            } = writer
            {
                let scope = source::Scope {
                    organization: *organization,
                    account: p.account.account.clone(),
                    live: p.account.live,
                };
                if let CheckoutStage::Stop {
                    provider_receipt: Some(id),
                    recovery_actor,
                    reason,
                    ..
                } = stage
                {
                    let failure = state
                        .sources
                        .scopes
                        .get(&scope.key()?)
                        .and_then(|entry| entry.checkout_failures.get(id))
                        .context("financial_checkout_failure_receipt_missing")?;
                    ensure!(
                        failure.operation == request.operation
                            && failure.request_hash == request.request_hash
                            && failure.attempt.source_claim
                            && failure.attempt.revision == *expected_revision
                            && failure.attempt.actor == recovery_actor.unwrap_or(request.actor)
                            && failure.detail.result.terminal()
                            && failure.detail.result.reason() == reason,
                        "financial_checkout_failure_receipt_changed"
                    );
                }
                ensure!(
                    state
                        .sources
                        .scopes
                        .get(&scope.key()?)
                        .and_then(|e| e.accepted.get(&request.operation))
                        == Some(request),
                    "financial_checkout_original_request_changed"
                );
            }
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
            self.groups
                .values()
                .all(|g| g.operator_review.as_ref().is_none_or(|r| r.id != p.id))
                && !state.used_enrollment_transitions.contains(&p.id)
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
                && !state.ingress.operator_reviews.contains_key(&p.id)
                && !state
                    .births
                    .values()
                    .any(|b| b.birth.reserved_ids().contains(&p.id)
                        || b.confirmations.contains_key(&p.id)),
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
                operator_review: None,
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

/// Original create identity and current lookup authority remain separate.
/// This is historical authorization evidence, never a current Owner grant.
pub(crate) fn recovery_authorization<'a>(
    state: &'a Guard,
    scope: &source::Scope,
    request: &source::AcceptedRequest,
    actor: Uuid,
    revision: i64,
) -> Result<&'a Writer> {
    ensure!(
        state
            .sources
            .scopes
            .get(&scope.key()?)
            .and_then(|e| e.accepted.get(&request.operation))
            == Some(request),
        "financial_customer_original_request_changed"
    );
    state.transactions.groups.values().filter(|g|g.committed
        && g.proposal.account.account==scope.account && g.proposal.account.live==scope.live)
        .filter_map(|g|g.proposal.writer.as_ref()).find(|w|matches!(w,
            Writer::CustomerRecoveryAuthorization{organization,request:r,actor:a,expected_revision,..}
            if *organization==scope.organization && r==request && *a==actor && expected_revision.checked_add(1)==Some(revision)))
        .context("financial_customer_recovery_authorization_unconfirmed")
}
#[cfg(test)]
#[path = "team_financial_transaction_tests.rs"]
pub(crate) mod tests;

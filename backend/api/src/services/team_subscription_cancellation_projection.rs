//! Deterministic result projection. This model never grants HTTP or paid access.
use super::lifecycle::{Exchange, ExchangeKind};
use super::*;
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Basis {
    pub revision: i64,
    pub actor: Uuid,
    pub first_attempt_at: Option<DateTime<Utc>>,
    pub recovery_actor: Option<Uuid>,
    pub read_only: bool,
    pub disposition: String,
    pub last_observation: Option<Uuid>,
    pub observed_at: Option<DateTime<Utc>>,
    pub lease: Option<Uuid>,
    pub lease_until: Option<DateTime<Utc>>,
}
impl Basis {
    pub fn validate(&self, request: &FrozenCancellation) -> Result<()> {
        request.validate()?;
        ensure!(
            self.revision > 0
                && self.actor == self.recovery_actor.unwrap_or(request.actor())
                && self
                    .recovery_actor
                    .is_none_or(|id| !id.is_nil() && self.read_only)
                && self
                    .first_attempt_at
                    .is_none_or(|at| at >= request.accepted_at())
                && self.last_observation.is_none_or(|id| !id.is_nil())
                && self.last_observation.is_some() == self.observed_at.is_some()
                && self.lease.is_some() == self.lease_until.is_some()
                && self.lease.is_none_or(|id| !id.is_nil())
                && [
                    "pending",
                    "owner_changed",
                    "recovery_required",
                    "provider_scheduled",
                    "effective",
                    "withdrawn",
                    "changed"
                ]
                .contains(&self.disposition.as_str()),
            "cancellation_projection_basis_invalid"
        );
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum ProjectionMode {
    Current {
        account_lease: Uuid,
    },
    RetainedOnly {
        park: bool,
        owner_changed: bool,
        #[serde(default, skip_serializing_if = "is_false")]
        resume_initial_read: bool,
    },
}
fn is_false(value: &bool) -> bool {
    !*value
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CancellationProjection {
    pub request: FrozenCancellation,
    pub observation: Observation,
    pub exchange: Exchange,
    pub basis: Basis,
    pub mode: ProjectionMode,
    pub projected_at: DateTime<Utc>,
    /// Exact pending outcome occurrence; other results remain pending/retained.
    pub outcomes: BTreeMap<Uuid, String>,
}
impl CancellationProjection {
    pub fn validate(&self) -> Result<()> {
        self.request.validate()?;
        self.basis.validate(&self.request)?;
        self.observation.validate(self.request.scope())?;
        self.exchange
            .validate(&self.request, self.exchange.revision)?;
        ensure!(
            self.observation.request == self.request
                && self.observation.attempt.source_claim
                && self.observation.subscription.customer == self.request.customer()
                && self.observation.subscription.subscription == self.request.subscription()
                && self.observation.attempt.actor == self.exchange.actor
                && self.observation.attempt.revision == self.exchange.revision
                && self.observation.attempt.lease == self.exchange.lease
                && self.observation.attempt.exchange == self.exchange.id
                && self.observation.kind
                    == if self.exchange.kind == ExchangeKind::Mutation {
                        ObservationKind::MutationResponse
                    } else {
                        ObservationKind::ResourceRead
                    }
                && self.basis.revision >= self.exchange.revision
                && self.projected_at.timestamp_subsec_nanos() % 1000 == 0
                && self.projected_at >= self.request.accepted_at()
                && self.outcomes.len() == 1
                && self.outcomes.contains_key(&self.observation.outcome)
                && self.outcomes.values().all(|hash| hash.len() == 64
                    && hash
                        .bytes()
                        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))),
            "cancellation_projection_invalid"
        );
        match &self.mode {
            ProjectionMode::Current { account_lease } => {
                ensure!(
                    !account_lease.is_nil()
                        && *account_lease == self.exchange.account_lease
                        && self.basis.actor == self.exchange.actor
                        && self.basis.revision == self.exchange.revision
                        && self.basis.lease == Some(self.exchange.lease)
                        && self
                            .basis
                            .lease_until
                            .is_some_and(|until| self.projected_at < until)
                        && self.basis.first_attempt_at == self.exchange.first_attempt_at
                        && self.basis.last_observation == self.exchange.previous_observation
                        && ["pending", "provider_scheduled"]
                            .contains(&self.basis.disposition.as_str())
                        && self.exchange.prepared_at <= self.observation.observed_at
                        && self.observation.observed_at <= self.projected_at
                        && self.projected_at
                            < self
                                .exchange
                                .prepared_at
                                .checked_add_signed(chrono::Duration::seconds(60))
                                .context("cancellation_projection_time_invalid")?
                        && (self.exchange.kind != ExchangeKind::Mutation
                            || (!self.basis.read_only && self.basis.recovery_actor.is_none())),
                    "cancellation_current_projection_invalid"
                );
            }
            ProjectionMode::RetainedOnly { park: true, .. } => {
                ensure!(
                    self.basis.actor == self.exchange.actor
                        && self.basis.revision == self.exchange.revision
                        && self.basis.last_observation == self.exchange.previous_observation
                        && self
                            .basis
                            .lease
                            .is_none_or(|lease| lease == self.exchange.lease)
                        && self
                            .basis
                            .lease_until
                            .is_none_or(|until| until <= self.projected_at)
                        && !["effective", "withdrawn"].contains(&self.basis.disposition.as_str()),
                    "cancellation_historical_projection_cannot_park_newer_work"
                );
            }
            ProjectionMode::RetainedOnly {
                park: false,
                resume_initial_read,
                ..
            } => {
                ensure!(
                    !resume_initial_read,
                    "cancellation_initial_read_resume_invalid"
                );
            }
        }
        if let ProjectionMode::RetainedOnly {
            park,
            owner_changed,
            resume_initial_read: true,
        } = &self.mode
        {
            ensure!(
                *park
                    && !owner_changed
                    && !self.basis.read_only
                    && self.basis.recovery_actor.is_none()
                    && self.basis.revision == 1
                    && self.basis.actor == self.request.actor()
                    && self.basis.first_attempt_at.is_none()
                    && self.exchange.kind == ExchangeKind::ResourceRead
                    && self.exchange.first_attempt_at.is_none()
                    && self.basis.last_observation.is_none()
                    && self.exchange.previous_observation.is_none(),
                "cancellation_initial_read_resume_invalid"
            );
        }
        Ok(())
    }
    pub fn next(&self) -> Result<Basis> {
        self.validate()?;
        let mut next = self.basis.clone();
        match &self.mode {
            ProjectionMode::Current { .. } => {
                let disposition = self
                    .request
                    .disposition(&self.observation.subscription, self.observation.observed_at)?;
                next.disposition = match disposition {
                    Disposition::NotObservedScheduled
                        if self.exchange.kind == ExchangeKind::Mutation =>
                    {
                        "recovery_required"
                    }
                    Disposition::NotObservedScheduled if self.basis.read_only => {
                        "recovery_required"
                    }
                    Disposition::NotObservedScheduled => "pending",
                    Disposition::ProviderObservedScheduled => "provider_scheduled",
                    Disposition::EffectiveAtExpectedBoundary => "effective",
                    Disposition::ChangedOrUnconfirmed => "changed",
                }
                .into();
                next.read_only |= next.disposition != "pending";
                next.last_observation = Some(self.observation.id);
                next.observed_at = Some(self.observation.observed_at);
                next.lease = None;
                next.lease_until = None;
            }
            ProjectionMode::RetainedOnly {
                park: true,
                owner_changed,
                resume_initial_read,
            } => {
                next.disposition = if *resume_initial_read {
                    "pending"
                } else if *owner_changed {
                    "owner_changed"
                } else {
                    "recovery_required"
                }
                .into();
                next.read_only |= !resume_initial_read;
                next.lease = None;
                next.lease_until = None;
            }
            ProjectionMode::RetainedOnly { park: false, .. } => {}
        }
        Ok(next)
    }
    pub fn audit_hash(&self) -> Result<String> {
        self.validate()?;
        fingerprint(&("cancellation_result_projection_v1", self))
    }
}
/// SQL source revision orders prepared exchanges, never timestamp proximity.
pub(crate) fn exchange_epoch(
    state: &crate::services::team_financial_guard::Snapshot,
    request: &FrozenCancellation,
    exchange: &Exchange,
) -> Result<u64> {
    use crate::services::team_financial_transaction::Writer;
    let generations=state.transactions.groups.values().filter(|group|group.committed)
        .filter(|group|matches!(group.proposal.writer.as_ref(),Some(Writer::CancellationLifecycle {request:original,stage:lifecycle::CancellationStage::BeginExchange {exchange:prepared},..}) if original==request && prepared==exchange))
        .flat_map(|group|group.proposal.sources.iter().filter(|source|source.scope==*request.scope()).map(|source|source.transition.next.revision)).collect::<Vec<_>>();
    ensure!(
        generations.len() == 1,
        "cancellation_exchange_confirmation_unconfirmed"
    );
    Ok(generations[0])
}
pub(crate) fn latest_exchange_epoch(
    state: &crate::services::team_financial_guard::Snapshot,
    request: &FrozenCancellation,
) -> Result<u64> {
    use crate::services::team_financial_transaction::Writer;
    state.transactions.groups.values().filter(|group|group.committed)
        .filter(|group|matches!(group.proposal.writer.as_ref(),Some(Writer::CancellationLifecycle {request:original,stage:lifecycle::CancellationStage::BeginExchange {..},..}) if original==request))
        .flat_map(|group|group.proposal.sources.iter().filter(|source|source.scope==*request.scope()).map(|source|source.transition.next.revision)).max().context("cancellation_exchange_confirmation_unconfirmed")
}
/// Absence of a SQL timestamp alone is insufficient. Retained/pending prepared
/// mutations, possible sends and even contradictory historical results fence
/// the narrow automatic resume of an initial read.
pub(crate) fn never_mutated(
    state: &crate::services::team_financial_guard::Snapshot,
    request: &FrozenCancellation,
) -> bool {
    use crate::services::{
        team_financial_transaction::Writer, team_stripe_checkout_receipt::FailurePhase,
    };
    !state.transactions.groups.values().any(|group|matches!(group.proposal.writer.as_ref(),Some(Writer::CancellationLifecycle {request:original,stage:lifecycle::CancellationStage::BeginExchange {exchange},..})
        if original.operation()==request.operation() && exchange.kind==ExchangeKind::Mutation))
        && !state.sources.scopes.values().any(|entry|entry.dispatches.contains_key(&request.operation())
            || entry.cancellation_observations.values().chain(entry.conflicting_cancellation_observations.values()).any(|observation|observation.request.operation()==request.operation() && observation.kind==ObservationKind::MutationResponse)
            || entry.cancellation_failures.values().chain(entry.conflicting_cancellation_failures.values()).any(|observation|observation.request.operation()==request.operation() && observation.detail.phase==FailurePhase::CancellationMutation))
}

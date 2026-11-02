//! End-of-period cancellation evidence. These contracts do not grant a current
//! Owner, dispatch permission, payment or analytics coverage. SQL acceptance,
//! sealed runtime claims and projection must precede activation of a producer.
use super::{team_financial_guard::fingerprint, team_financial_source as source, team_stripe::id};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

pub const FLAG: &str = "ATOAXIS_TEAM_SUBSCRIPTION_CANCELLATION_ENABLED";
#[path = "team_subscription_cancellation_lifecycle.rs"]
pub mod lifecycle;
#[path = "team_subscription_cancellation_projection.rs"]
pub mod projection;
#[cfg(test)]
#[path = "team_subscription_cancellation_projection_tests.rs"]
mod projection_tests;
pub fn require_enabled() -> Result<()> {
    ensure!(enabled()?, super::team_insights::TeamError::Disabled);
    Ok(())
}
pub fn enabled() -> Result<bool> {
    match std::env::var(FLAG) {
        Ok(value) => parse_flag(Some(&value)),
        Err(std::env::VarError::NotPresent) => parse_flag(None),
        Err(_) => anyhow::bail!("cancellation_configuration_invalid"),
    }
}
fn parse_flag(value: Option<&str>) -> Result<bool> {
    match value {
        None | Some("0" | "false") => Ok(false),
        Some("1" | "true") => Ok(true),
        _ => anyhow::bail!("cancellation_configuration_invalid"),
    }
}
#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CancellationSelection {
    pub operation_id: Uuid,
    pub expected_binding_revision: i64,
    pub expected_source_revision: i64,
    pub expected_period_end: DateTime<Utc>,
    pub confirm: bool,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RecoverCancellation {
    pub operation_id: Uuid,
    pub expected_revision: i64,
    pub confirm: bool,
}
impl RecoverCancellation {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.confirm
                && !self.operation_id.is_nil()
                && self.expected_revision > 0
                && self.expected_revision < i64::MAX,
            super::team_insights::TeamError::Invalid(
                "confirm read-only recovery of the original cancellation revision"
            )
        );
        Ok(())
    }
}
impl CancellationSelection {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.confirm
                && !self.operation_id.is_nil()
                && self.expected_binding_revision > 0
                && self.expected_source_revision > 0
                && self.expected_period_end.timestamp_subsec_nanos() % 1000 == 0,
            super::team_insights::TeamError::Invalid(
                "confirm the existing subscription revision and billing boundary"
            )
        );
        Ok(())
    }
}

/// A readonly acceptance observation. Provider state remains unknown until a
/// typed lifecycle projection exists; an accepted request is not cancellation.
#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct CancellationStatus {
    pub schema_version: u8,
    pub operation_id: Uuid,
    pub revision: i64,
    pub accepted_at: DateTime<Utc>,
    pub expected_period_end: DateTime<Utc>,
    pub requested_by_current_owner: bool,
    pub authorization_current_owner: bool,
    pub acceptance: &'static str,
    pub provider_disposition: Option<&'static str>,
    pub reason: &'static str,
    pub dispatch_available: bool,
    /// Operational state is separate from the last actual provider observation.
    pub state: String,
    pub read_only: bool,
    pub retry_at: DateTime<Utc>,
    pub last_error_code: Option<String>,
    pub provider_observed_at: Option<DateTime<Utc>>,
    /// Configuration observation, never a claim that a worker process is live.
    pub worker_configured: Option<bool>,
    pub observed_at: DateTime<Utc>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct CancellationTerms {
    pub binding_revision: i64,
    pub source_revision: i64,
    pub period_end: DateTime<Utc>,
    pub provider_observed_at: DateTime<Utc>,
    pub confirmation_expires_at: DateTime<Utc>,
}
#[derive(Debug, Serialize)]
pub struct CancellationView {
    pub schema_version: u8,
    pub operation: Option<CancellationStatus>,
    pub selection: Option<CancellationTerms>,
    pub checked_at: DateTime<Utc>,
}
impl FrozenCancellation {
    pub(crate) fn matches_selection(&self, input: &CancellationSelection) -> Result<()> {
        input.validate()?;
        ensure!(
            input.operation_id == self.operation()
                && input.expected_binding_revision == self.binding_revision()
                && input.expected_source_revision == self.source_revision()
                && input.expected_period_end == self.period_end(),
            super::team_insights::TeamError::ProjectionChanged
        );
        Ok(())
    }
}
/// A current-Owner/config/SQL failure is not a provider-wide auth failure.
pub enum PreparationFailure {
    Authority(anyhow::Error),
    Provider(crate::infrastructure::stripe::ProviderError),
}
impl From<anyhow::Error> for PreparationFailure {
    fn from(value: anyhow::Error) -> Self {
        Self::Authority(value)
    }
}
impl From<crate::infrastructure::stripe::ProviderError> for PreparationFailure {
    fn from(value: crate::infrastructure::stripe::ProviderError) -> Self {
        Self::Provider(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FrozenCancellation {
    schema_version: u8,
    operation: Uuid,
    scope: source::Scope,
    original_actor: Uuid,
    customer: String,
    subscription: String,
    item: String,
    binding_revision: i64,
    source_revision: i64,
    price: String,
    currency: String,
    amount_minor: i64,
    period_start: DateTime<Utc>,
    period_end: DateTime<Utc>,
    accepted_at: DateTime<Utc>,
}
impl FrozenCancellation {
    /// Inputs are server-resolved observations, never a JSON body accepted as
    /// authority. The eventual repository also verifies these exact revisions.
    pub fn new(
        scope: source::Scope,
        actor: Uuid,
        operation: Uuid,
        binding_revision: i64,
        source_revision: i64,
        before: &Subscription,
        accepted_at: DateTime<Utc>,
    ) -> Result<Self> {
        scope.key()?;
        before.validate(&scope)?;
        let result = Self {
            schema_version: 1,
            operation,
            scope,
            original_actor: actor,
            customer: before.customer.clone(),
            subscription: before.subscription.clone(),
            item: before
                .item
                .clone()
                .context("cancellation_item_unconfirmed")?,
            binding_revision,
            source_revision,
            price: before
                .price
                .clone()
                .context("cancellation_price_unconfirmed")?,
            currency: before
                .currency
                .clone()
                .context("cancellation_currency_unconfirmed")?,
            amount_minor: before
                .amount_minor
                .context("cancellation_amount_unconfirmed")?,
            period_start: before
                .period_start
                .context("cancellation_period_unconfirmed")?,
            period_end: before
                .period_end
                .context("cancellation_period_unconfirmed")?,
            accepted_at,
        };
        result.validate()?;
        result.before_mutation(before, accepted_at)?;
        Ok(result)
    }
    pub fn validate(&self) -> Result<()> {
        self.scope.key()?;
        ensure!(
            self.schema_version == 1
                && !self.operation.is_nil()
                && !self.original_actor.is_nil()
                && self.binding_revision > 0
                && self.source_revision > 0
                && id(&self.customer, "cus_")
                && id(&self.subscription, "sub_")
                && id(&self.item, "si_")
                && id(&self.price, "price_")
                && self.currency.len() == 3
                && self.currency.bytes().all(|v| v.is_ascii_lowercase())
                && self.amount_minor >= 0
                && self.accepted_at.timestamp_subsec_nanos() % 1000 == 0
                && self.period_start <= self.accepted_at
                && self.accepted_at < self.period_end,
            "cancellation_request_invalid"
        );
        Ok(())
    }
    pub fn operation(&self) -> Uuid {
        self.operation
    }
    pub fn scope(&self) -> &source::Scope {
        &self.scope
    }
    pub fn subscription(&self) -> &str {
        &self.subscription
    }
    pub fn customer(&self) -> &str {
        &self.customer
    }
    pub fn actor(&self) -> Uuid {
        self.original_actor
    }
    pub fn accepted_at(&self) -> DateTime<Utc> {
        self.accepted_at
    }
    pub fn period_end(&self) -> DateTime<Utc> {
        self.period_end
    }
    pub fn binding_revision(&self) -> i64 {
        self.binding_revision
    }
    pub fn source_revision(&self) -> i64 {
        self.source_revision
    }
    pub fn item(&self) -> &str {
        &self.item
    }
    pub fn price(&self) -> &str {
        &self.price
    }
    pub fn currency(&self) -> &str {
        &self.currency
    }
    pub fn amount_minor(&self) -> i64 {
        self.amount_minor
    }
    pub fn period_start(&self) -> DateTime<Utc> {
        self.period_start
    }
    /// Retry compares the original business selection, retaining the original
    /// server acceptance time/body/key rather than generating replacements.
    pub fn same_intent(&self, other: &Self) -> bool {
        let mut original = self.clone();
        original.accepted_at = other.accepted_at;
        original == *other
    }
    /// Only a future sealed dispatch proof may pass these fields to HTTP. No
    /// DELETE/immediate cancellation, arbitrary timestamp, refund or price change.
    pub fn provider_body(&self) -> Result<Vec<(&'static str, &'static str)>> {
        self.validate()?;
        Ok(vec![("cancel_at_period_end", "true")])
    }
    pub fn request_hash(&self) -> Result<String> {
        self.validate()?;
        fingerprint(&(
            "stripe_cancel_at_period_end_request_v1",
            self,
            self.provider_body()?,
        ))
    }
    pub fn idempotency_key(&self) -> Result<String> {
        Ok(format!(
            "atoaxis-cancel-at-period-end-v1-{}",
            self.request_hash()?
        ))
    }
    pub fn accepted_request(&self) -> Result<source::AcceptedRequest> {
        Ok(source::AcceptedRequest {
            operation: self.operation,
            kind: source::OperationKind::CancelAtPeriodEnd,
            actor: self.original_actor,
            request_hash: self.request_hash()?,
            idempotency_hash: fingerprint(&self.idempotency_key()?)?,
            accepted_at: self.accepted_at,
        })
    }
    pub fn before_mutation(&self, current: &Subscription, now: DateTime<Utc>) -> Result<()> {
        self.validate()?;
        current.validate(&self.scope)?;
        ensure!(
            self.accepted_at <= now
                && now < self.period_end
                && self.matches_terms(current)
                && ["active", "trialing", "past_due", "unpaid", "paused"]
                    .contains(&current.status.as_str())
                && !current.cancel_at_period_end
                && current.cancel_at.is_none()
                && current.ended_at.is_none()
                && current.canceled_at.is_none()
                && !current.scheduled_or_pending_update,
            "cancellation_predecessor_changed_or_unconfirmed"
        );
        Ok(())
    }
    fn matches_terms(&self, current: &Subscription) -> bool {
        current.customer == self.customer
            && current.subscription == self.subscription
            && current.item.as_deref() == Some(self.item.as_str())
            && current.items_complete
            && current.price.as_deref() == Some(self.price.as_str())
            && current.currency.as_deref() == Some(self.currency.as_str())
            && current.amount_minor == Some(self.amount_minor)
            && current.quantity == Some(1)
            && current.period_start == Some(self.period_start)
            && current.period_end == Some(self.period_end)
    }
    /// This is an observation disposition, never an entitlement decision. In
    /// particular canceled_at is the request time for scheduled cancellations.
    pub fn disposition(
        &self,
        current: &Subscription,
        observed_at: DateTime<Utc>,
    ) -> Result<Disposition> {
        self.validate()?;
        current.validate(&self.scope)?;
        ensure!(
            observed_at >= self.accepted_at,
            "cancellation_observation_before_request"
        );
        if !self.matches_terms(current) || current.scheduled_or_pending_update {
            return Ok(Disposition::ChangedOrUnconfirmed);
        }
        if current.status == "canceled" {
            return Ok(
                if current.ended_at == Some(self.period_end) && observed_at >= self.period_end {
                    Disposition::EffectiveAtExpectedBoundary
                } else {
                    Disposition::ChangedOrUnconfirmed
                },
            );
        }
        if current.ended_at.is_some()
            || current.canceled_at.is_some_and(|at| at > observed_at)
            || !["active", "trialing", "past_due", "unpaid", "paused"]
                .contains(&current.status.as_str())
        {
            return Ok(Disposition::ChangedOrUnconfirmed);
        }
        Ok(
            if current.cancel_at_period_end
                && current.cancel_at.is_none_or(|at| at == self.period_end)
                && observed_at < self.period_end
            {
                Disposition::ProviderObservedScheduled
            } else if !current.cancel_at_period_end
                && current.cancel_at.is_none()
                && observed_at < self.period_end
            {
                Disposition::NotObservedScheduled
            } else {
                Disposition::ChangedOrUnconfirmed
            },
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Disposition {
    NotObservedScheduled,
    ProviderObservedScheduled,
    EffectiveAtExpectedBoundary,
    ChangedOrUnconfirmed,
}

/// Strict metadata allowlist. Provider descriptions, cancellation comments,
/// payment details, raw objects and URLs never enter this serializable type.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Subscription {
    pub customer: String,
    pub subscription: String,
    pub live: bool,
    pub status: String,
    pub cancel_at_period_end: bool,
    pub cancel_at: Option<DateTime<Utc>>,
    pub canceled_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub item: Option<String>,
    pub period_start: Option<DateTime<Utc>>,
    pub period_end: Option<DateTime<Utc>>,
    pub price: Option<String>,
    pub currency: Option<String>,
    pub amount_minor: Option<i64>,
    pub quantity: Option<i64>,
    pub items_complete: bool,
    pub scheduled_or_pending_update: bool,
}
fn optional_time(value: &Value) -> Result<Option<DateTime<Utc>>> {
    ensure!(!value.is_boolean(), "cancellation_time_invalid");
    if value.is_null() {
        return Ok(None);
    }
    Ok(Some(
        DateTime::from_timestamp(value.as_i64().context("cancellation_time_invalid")?, 0)
            .context("cancellation_time_invalid")?,
    ))
}
impl Subscription {
    pub fn parse(raw: &Value, live: bool, observed_at: DateTime<Utc>) -> Result<Self> {
        let subscription = raw["id"]
            .as_str()
            .context("cancellation_subscription_missing")?;
        let customer = raw["customer"]
            .as_str()
            .context("cancellation_customer_missing")?;
        let snapshot =
            super::team_stripe::snapshot(raw, subscription, customer, live, observed_at)?;
        // Missing lifecycle/schedule fields are unknown, not null or safe to overwrite.
        for field in [
            "cancel_at",
            "canceled_at",
            "ended_at",
            "schedule",
            "pending_update",
        ] {
            ensure!(
                raw.get(field).is_some(),
                "cancellation_lifecycle_unconfirmed"
            );
        }
        let result = Self {
            customer: snapshot.customer_id,
            subscription: snapshot.subscription_id,
            live,
            status: snapshot.status,
            cancel_at_period_end: snapshot.cancel_at_period_end,
            cancel_at: optional_time(&raw["cancel_at"])?,
            canceled_at: optional_time(&raw["canceled_at"])?,
            ended_at: optional_time(&raw["ended_at"])?,
            item: snapshot.subscription_item_id,
            period_start: snapshot.period_start,
            period_end: snapshot.period_end,
            price: snapshot.price_id,
            currency: snapshot.currency,
            amount_minor: snapshot.amount_minor,
            quantity: snapshot.quantity,
            items_complete: snapshot.items_complete,
            scheduled_or_pending_update: !raw["schedule"].is_null()
                || !raw["pending_update"].is_null(),
        };
        result.validate_mode(live)?;
        Ok(result)
    }
    pub fn validate(&self, scope: &source::Scope) -> Result<()> {
        scope.key()?;
        self.validate_mode(scope.live)
    }
    fn validate_mode(&self, live: bool) -> Result<()> {
        ensure!(
            self.live == live
                && id(&self.customer, "cus_")
                && id(&self.subscription, "sub_")
                && [
                    "incomplete",
                    "incomplete_expired",
                    "trialing",
                    "active",
                    "past_due",
                    "canceled",
                    "unpaid",
                    "paused"
                ]
                .contains(&self.status.as_str())
                && self.item.as_ref().is_none_or(|v| id(v, "si_"))
                && self.price.as_ref().is_none_or(|v| id(v, "price_"))
                && self
                    .currency
                    .as_ref()
                    .is_none_or(|v| v.len() == 3 && v.bytes().all(|b| b.is_ascii_lowercase()))
                && self.amount_minor.is_none_or(|v| v >= 0)
                && self.quantity.is_none_or(|v| v >= 0)
                && self
                    .period_start
                    .zip(self.period_end)
                    .is_none_or(|(a, b)| a < b),
            "cancellation_metadata_invalid"
        );
        Ok(())
    }
    pub fn identity(&self) -> source::ProviderIdentity {
        source::ProviderIdentity::Subscription {
            customer: self.customer.clone(),
            subscription: self.subscription.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObservationKind {
    MutationResponse,
    ResourceRead,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attempt {
    pub actor: Uuid,
    pub revision: i64,
    pub lease: Uuid,
    /// One actual HTTP exchange, durably assigned before that request. Replaying
    /// its response keeps this ID; another request in the same lease gets a new ID.
    pub exchange: Uuid,
    pub source_claim: bool,
}
/// Closed diagnostic metadata only. This is not a Subscription Outcome and
/// cannot authorize retries/projection or discard a retained positive result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FailureObservation {
    pub id: Uuid,
    pub request: FrozenCancellation,
    pub attempt: Attempt,
    pub observed_at: DateTime<Utc>,
    pub detail: super::team_stripe_checkout_receipt::FailureDetail,
}
impl FailureObservation {
    pub fn validate(&self, scope: &source::Scope) -> Result<()> {
        use super::team_stripe_checkout_receipt::{FailurePhase, FailureResult};
        self.request.validate()?;
        ensure!(
            !self.id.is_nil()
                && self.request.scope() == scope
                && !self.attempt.actor.is_nil()
                && self.attempt.revision > 0
                && !self.attempt.lease.is_nil()
                && !self.attempt.exchange.is_nil()
                && matches!(
                    self.detail.phase,
                    FailurePhase::CancellationAccount
                        | FailurePhase::CancellationMutation
                        | FailurePhase::CancellationRead
                )
                && matches!(self.detail.result, FailureResult::Provider { .. })
                && self
                    .detail
                    .http_status
                    .is_none_or(|status| (100..=599).contains(&status)),
            "cancellation_failure_invalid"
        );
        Ok(())
    }
}
/// Normalized read evidence, not an authorization capability. The repository
/// accepts it only inside an opaque preparation sealed to current SQL/source
/// predecessor and Owner. Deserializing this type proves no provider request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReadEvidence {
    pub exchange: Uuid,
    pub observed_at: DateTime<Utc>,
    pub valid_until: DateTime<Utc>,
    pub subscription: Subscription,
}
impl ReadEvidence {
    pub fn validate(&self, request: &FrozenCancellation) -> Result<()> {
        request.validate()?;
        ensure!(
            !self.exchange.is_nil()
                && self.observed_at <= request.accepted_at()
                && request.accepted_at() < self.valid_until
                && self.observed_at < self.valid_until
                && self.valid_until - self.observed_at <= chrono::Duration::seconds(60),
            "cancellation_read_evidence_invalid_or_expired"
        );
        request.before_mutation(&self.subscription, request.accepted_at())
    }
    pub fn digest(&self, request: &FrozenCancellation) -> Result<String> {
        self.validate(request)?;
        fingerprint(&(
            "stripe_cancel_at_period_end_read_v1",
            request.request_hash()?,
            self,
        ))
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Observation {
    pub id: Uuid,
    pub request: FrozenCancellation,
    pub attempt: Attempt,
    pub kind: ObservationKind,
    pub observed_at: DateTime<Utc>,
    pub subscription: Subscription,
    pub outcome: Uuid,
}
impl Observation {
    pub fn validate(&self, scope: &source::Scope) -> Result<()> {
        self.request.validate()?;
        self.subscription.validate(scope)?;
        ensure!(
            !self.id.is_nil()
                && !self.outcome.is_nil()
                && self.request.scope() == scope
                && !self.attempt.actor.is_nil()
                && !self.attempt.lease.is_nil()
                && !self.attempt.exchange.is_nil()
                && self.attempt.revision > 0,
            "cancellation_observation_invalid"
        );
        Ok(())
    }
}
/// Identify an observation occurrence by the actual attempt and contract, never
/// wall-clock proximity. Exact retry deduplicates; another HTTP exchange is new
/// unresolved evidence even for the same state, including A -> B -> A.
pub fn result_hash(
    scope: &source::Scope,
    operation: Uuid,
    attempt: &Attempt,
    kind: &ObservationKind,
    metadata: &Subscription,
) -> Result<String> {
    scope.key()?;
    metadata.validate(scope)?;
    ensure!(
        !operation.is_nil()
            && !attempt.actor.is_nil()
            && !attempt.lease.is_nil()
            && !attempt.exchange.is_nil()
            && attempt.revision > 0,
        "cancellation_result_invalid"
    );
    fingerprint(&(
        "stripe_cancel_at_period_end_observation_result_v1",
        scope,
        operation,
        attempt,
        kind,
        metadata,
    ))
}

#[cfg(test)]
#[path = "team_subscription_cancellation_tests.rs"]
pub(crate) mod tests;

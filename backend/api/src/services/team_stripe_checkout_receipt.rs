//! Allowlisted Checkout observation metadata. No URL, response body or credential.
use super::team_financial_source::{ProviderIdentity, Scope};
use anyhow::{ensure, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObservationKind {
    CreateResponse,
    ResourceRead,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Session {
    pub id: String,
    pub customer: String,
    pub price: String,
    pub currency: String,
    pub amount_minor: i64,
    pub live: bool,
    pub status: String,
    pub expires_at: DateTime<Utc>,
    pub subscription: Option<String>,
}
impl Session {
    pub(crate) fn from_evidence(value: &super::team_stripe_checkout::SessionEvidence) -> Self {
        Self {
            id: value.id.clone(),
            customer: value.customer.clone(),
            price: value.price.clone(),
            currency: value.currency.clone(),
            amount_minor: value.amount_minor,
            live: value.live,
            status: value.status.clone(),
            expires_at: value.expires_at,
            subscription: value.subscription.clone(),
        }
    }
    pub(crate) fn identity(&self) -> ProviderIdentity {
        ProviderIdentity::Checkout {
            session: self.id.clone(),
            customer: self.customer.clone(),
            subscription: self.subscription.clone(),
        }
    }
    pub(crate) fn validate(&self, scope: &Scope) -> Result<()> {
        use super::team_stripe::id;
        ensure!(
            self.live == scope.live
                && id(&self.id, if self.live { "cs_live_" } else { "cs_test_" })
                && id(&self.customer, "cus_")
                && id(&self.price, "price_")
                && self.currency.len() == 3
                && self.currency.bytes().all(|b| b.is_ascii_lowercase())
                && self.amount_minor >= 0
                && ["open", "complete", "expired"].contains(&self.status.as_str())
                && self
                    .subscription
                    .as_ref()
                    .is_none_or(|value| id(value, "sub_"))
                && (self.status == "complete" || self.subscription.is_none()),
            "financial_checkout_observation_invalid"
        );
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attempt {
    pub actor: Uuid,
    pub revision: i64,
    pub lease: Uuid,
    /// Capture provenance only. This flag is never a SQL/Owner/lease grant.
    pub source_claim: bool,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Observation {
    pub id: Uuid,
    pub operation: Uuid,
    pub request_hash: String,
    pub actor: Uuid,
    pub revision: i64,
    pub lease: Uuid,
    /// Capture provenance only. This flag is never a SQL/Owner/lease grant.
    pub source_claim: bool,
    pub kind: ObservationKind,
    pub observed_at: DateTime<Utc>,
    pub session: Session,
    pub outcome: Uuid,
}
impl Observation {
    pub(crate) fn validate(&self, scope: &Scope) -> Result<()> {
        ensure!(
            !self.id.is_nil()
                && !self.operation.is_nil()
                && !self.actor.is_nil()
                && !self.lease.is_nil()
                && !self.outcome.is_nil()
                && self.revision > 0
                && self.request_hash.len() == 64
                && self.request_hash.bytes().all(|b| b.is_ascii_hexdigit()),
            "financial_checkout_observation_invalid"
        );
        self.session.validate(scope)
    }
}
pub(crate) fn result_hash(
    scope: &Scope,
    operation: Uuid,
    identity: &ProviderIdentity,
) -> Result<String> {
    super::team_financial_guard::fingerprint(&(
        "stripe_checkout_identity_v1",
        scope,
        operation,
        identity,
    ))
}

/// None is unknown, never permission to combine competing subscriptions. Include
/// applied identities and receipt history rather than checking only the target.
pub(crate) fn known_subscription(
    entry: &super::team_financial_source::Entry,
    operation: Uuid,
    session: &str,
    customer: &str,
) -> Result<Option<String>> {
    let mut known = std::collections::BTreeSet::new();
    for outcome in entry
        .outcomes
        .values()
        .filter(|value| value.operation == operation)
    {
        let Some(ProviderIdentity::Checkout {
            session: id,
            customer: owner,
            subscription,
        }) = &outcome.identity
        else {
            anyhow::bail!("financial_checkout_identity_unconfirmed");
        };
        ensure!(
            id == session && owner == customer,
            "financial_checkout_identity_conflict"
        );
        if let Some(value) = subscription {
            known.insert(value.clone());
        }
    }
    for receipt in entry
        .checkout_observations
        .values()
        .filter(|value| value.operation == operation)
    {
        ensure!(
            receipt.session.id == session && receipt.session.customer == customer,
            "financial_checkout_identity_conflict"
        );
        if let Some(value) = &receipt.session.subscription {
            known.insert(value.clone());
        }
    }
    ensure!(known.len() <= 1, "financial_checkout_subscription_conflict");
    Ok(known.into_iter().next())
}

/// Logical flow phase, not an HTTP request count. Outer flows can retain a
/// failure already observed by an inner resource read without duplicating facts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FailurePhase {
    CreateFlow,
    ResourceRead,
    LookupFlow,
    SubscriptionRead,
    WorkerCallback,
    CancellationAccount,
    CancellationMutation,
    CancellationRead,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FailureCode {
    Network,
    ProviderUnavailable,
    RateLimited,
    AuthRequired,
    PermissionRequired,
    NotFound,
    UnsupportedContract,
    ScopeMismatch,
    ObservationChanged,
}
impl FailureCode {
    pub(crate) fn reason(self) -> &'static str {
        match self {
            Self::Network => "network",
            Self::ProviderUnavailable => "provider_unavailable",
            Self::RateLimited => "rate_limited",
            Self::AuthRequired => "auth_required",
            Self::PermissionRequired => "permission_required",
            Self::NotFound => "subscription_unconfirmed",
            Self::UnsupportedContract => "unsupported_contract",
            Self::ScopeMismatch => "provider_scope_mismatch",
            Self::ObservationChanged => "observation_changed",
        }
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum FailureResult {
    LookupNotFound,
    LookupAmbiguous,
    LookupLimit,
    Provider { code: FailureCode },
}
impl FailureResult {
    pub(crate) fn lookup(reason: &str) -> Result<Self> {
        Ok(match reason {
            "checkout_not_found_unconfirmed" => Self::LookupNotFound,
            "checkout_candidates_ambiguous" => Self::LookupAmbiguous,
            "checkout_lookup_limit" => Self::LookupLimit,
            _ => anyhow::bail!("financial_checkout_lookup_reason_invalid"),
        })
    }
    pub(crate) fn reason(&self) -> &'static str {
        match self {
            Self::LookupNotFound => "checkout_not_found_unconfirmed",
            Self::LookupAmbiguous => "checkout_candidates_ambiguous",
            Self::LookupLimit => "checkout_lookup_limit",
            Self::Provider { code } => code.reason(),
        }
    }
    pub(crate) fn terminal(&self) -> bool {
        matches!(
            self,
            Self::LookupNotFound
                | Self::LookupAmbiguous
                | Self::LookupLimit
                | Self::Provider {
                    code: FailureCode::NotFound
                        | FailureCode::UnsupportedContract
                        | FailureCode::ScopeMismatch
                }
        )
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FailureDetail {
    pub phase: FailurePhase,
    pub result: FailureResult,
    pub http_status: Option<i32>,
    pub retry_after: Option<DateTime<Utc>>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FailureObservation {
    pub id: Uuid,
    pub operation: Uuid,
    pub request_hash: String,
    pub attempt: Attempt,
    pub observed_at: DateTime<Utc>,
    pub detail: FailureDetail,
}
impl FailureObservation {
    pub(crate) fn validate(&self) -> Result<()> {
        ensure!(
            !self.id.is_nil()
                && !self.operation.is_nil()
                && !self.attempt.actor.is_nil()
                && self.attempt.revision > 0
                && !self.attempt.lease.is_nil()
                && self.request_hash.len() == 64
                && self.request_hash.bytes().all(|b| b.is_ascii_hexdigit())
                && self
                    .detail
                    .http_status
                    .is_none_or(|status| (100..=599).contains(&status)),
            "financial_checkout_failure_invalid"
        );
        ensure!(
            matches!(self.detail.result, FailureResult::Provider { .. })
                || (self.detail.phase == FailurePhase::LookupFlow
                    && self.detail.http_status.is_none()
                    && self.detail.retry_after.is_none()),
            "financial_checkout_failure_detail_invalid"
        );
        Ok(())
    }
}

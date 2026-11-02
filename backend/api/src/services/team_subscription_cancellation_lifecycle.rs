//! Prepared exchanges are evidence of a possible send, never proof HTTP ran.
use super::*;
use chrono::Duration;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExchangeKind {
    Mutation,
    ResourceRead,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Exchange {
    pub id: Uuid,
    pub actor: Uuid,
    pub revision: i64,
    pub lease: Uuid,
    pub account_lease: Uuid,
    pub kind: ExchangeKind,
    pub prepared_at: DateTime<Utc>,
    pub first_attempt_at: Option<DateTime<Utc>>,
    /// Causal predecessor captured before this request, never inferred from time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_observation: Option<Uuid>,
    /// Digest of the exact retained SQL authorization, not a reusable grant.
    pub authorization_hash: String,
}
fn precise(at: DateTime<Utc>) -> bool {
    at.timestamp_subsec_nanos() % 1000 == 0
}
fn digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
impl Exchange {
    pub fn validate(&self, request: &FrozenCancellation, revision: i64) -> Result<()> {
        request.validate()?;
        ensure!(
            !self.id.is_nil()
                && !self.actor.is_nil()
                && !self.lease.is_nil()
                && !self.account_lease.is_nil()
                && revision > 0
                && self.revision == revision
                && precise(self.prepared_at)
                && self.prepared_at >= request.accepted_at()
                && self.previous_observation.is_none_or(|id| !id.is_nil())
                && digest(&self.authorization_hash)
                && self.first_attempt_at.is_none_or(|at| precise(at)
                    && request.accepted_at() <= at
                    && at <= self.prepared_at),
            "cancellation_exchange_invalid"
        );
        if self.kind == ExchangeKind::Mutation {
            let first = self
                .first_attempt_at
                .context("cancellation_first_attempt_unconfirmed")?;
            ensure!(
                revision == 1
                    && self.actor == request.actor()
                    && self.prepared_at < request.period_end()
                    && self.prepared_at
                        < first
                            .checked_add_signed(Duration::hours(23))
                            .context("cancellation_window_invalid")?,
                "cancellation_mutation_authority_or_window_changed"
            );
        }
        Ok(())
    }
    pub fn metadata_hash(&self, request: &FrozenCancellation) -> Result<String> {
        self.validate(request, self.revision)?;
        fingerprint(&(
            "cancellation_prepared_exchange_v1",
            request.request_hash()?,
            self,
        ))
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    OwnerChanged,
    StateChanged,
    ReadbackRequired,
    AuthRequired,
    PermissionRequired,
}
impl StopReason {
    pub fn code(&self) -> &'static str {
        match self {
            Self::OwnerChanged => "owner_authorization_changed",
            Self::StateChanged => "subscription_state_changed",
            Self::ReadbackRequired => "cancellation_readback_required",
            Self::AuthRequired => "provider_auth_required",
            Self::PermissionRequired => "provider_permission_required",
        }
    }
    pub fn disposition(&self) -> &'static str {
        match self {
            Self::OwnerChanged => "owner_changed",
            Self::StateChanged => "changed",
            _ => "recovery_required",
        }
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum CancellationStage {
    BeginExchange {
        exchange: Exchange,
    },
    Stop {
        actor: Uuid,
        lease: Uuid,
        stopped_at: DateTime<Utc>,
        first_attempt_at: Option<DateTime<Utc>>,
        recovery_actor: Option<Uuid>,
        read_only: bool,
        reason: StopReason,
    },
    RecoveryAuthorization {
        actor: Uuid,
        authorized_at: DateTime<Utc>,
        first_attempt_at: Option<DateTime<Utc>>,
    },
}
impl CancellationStage {
    pub fn validate(&self, request: &FrozenCancellation, revision: i64) -> Result<()> {
        request.validate()?;
        ensure!(
            revision > 0 && revision < i64::MAX,
            "cancellation_revision_invalid"
        );
        match self {
            Self::BeginExchange { exchange } => exchange.validate(request, revision),
            Self::Stop {
                actor,
                lease,
                stopped_at,
                first_attempt_at,
                recovery_actor,
                read_only,
                ..
            } => {
                ensure!(
                    !actor.is_nil()
                        && !lease.is_nil()
                        && *actor == recovery_actor.unwrap_or(request.actor())
                        && recovery_actor.is_none_or(|id| !id.is_nil())
                        && (recovery_actor.is_none() || *read_only)
                        && precise(*stopped_at)
                        && *stopped_at >= request.accepted_at()
                        && first_attempt_at.is_none_or(|at| precise(at)
                            && request.accepted_at() <= at
                            && at <= *stopped_at),
                    "cancellation_stop_invalid"
                );
                Ok(())
            }
            Self::RecoveryAuthorization {
                actor,
                authorized_at,
                first_attempt_at,
            } => {
                ensure!(
                    !actor.is_nil()
                        && precise(*authorized_at)
                        && *authorized_at >= request.accepted_at()
                        && first_attempt_at.is_none_or(|at| precise(at)
                            && request.accepted_at() <= at
                            && at <= *authorized_at),
                    "cancellation_recovery_authorization_invalid"
                );
                Ok(())
            }
        }
    }
    pub fn audit_hash(&self, request: &FrozenCancellation, revision: i64) -> Result<String> {
        self.validate(request, revision)?;
        fingerprint(&(
            "cancellation_lifecycle_audit_v1",
            request.request_hash()?,
            revision,
            self,
        ))
    }
}
pub fn authorization_hash(
    request: &FrozenCancellation,
    revision: i64,
    actor: Uuid,
    at: DateTime<Utc>,
    action: &str,
) -> Result<String> {
    request.validate()?;
    ensure!(
        revision > 0
            && !actor.is_nil()
            && precise(at)
            && at >= request.accepted_at()
            && if revision == 1 {
                actor == request.actor()
                    && at == request.accepted_at()
                    && action == "request_cancel_at_period_end"
            } else {
                action == "reconcile_existing_cancellation"
            },
        "cancellation_authorization_invalid"
    );
    fingerprint(&(
        "cancellation_sql_authorization_v1",
        request.request_hash()?,
        revision,
        actor,
        at,
        action,
    ))
}

#[cfg(test)]
#[path = "team_subscription_cancellation_lifecycle_tests.rs"]
mod tests;

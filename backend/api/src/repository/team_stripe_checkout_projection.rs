//! Exact retained Checkout evidence -> SQL. No result grants paid analytics.
use super::{
    team_financial_transaction::NormalWrite,
    team_stripe_checkout::{CheckoutClaim, CheckoutRepository},
    team_stripe_checkout_control as control,
    team_stripe_quote::QuoteRepository,
};
use crate::{
    infrastructure::team_financial_guard::FinancialGuard,
    services::{
        authorization::{AuthorizationDenied, AuthorizationService},
        team_financial_guard::fingerprint,
        team_financial_ingress::Scope as Account,
        team_financial_source::{AcceptedRequest, Scope},
        team_financial_transaction::{CheckoutBinding, CheckoutProjection, Writer},
        team_insights::TeamError,
        team_stripe_checkout::{SessionEvidence, SubscriptionEvidence},
        team_stripe_checkout_receipt::{self as receipt, Observation, ObservationKind},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use tokio_postgres::Transaction;
use uuid::Uuid;

fn account(scope: &Scope) -> Account {
    Account {
        account: scope.account.clone(),
        live: scope.live,
    }
}
pub(super) async fn begin<'a>(
    tx: deadpool_postgres::Transaction<'a>,
    guard: &FinancialGuard,
    scope: &Scope,
    observation: &Observation,
) -> Result<NormalWrite<'a>> {
    let state = guard.read()?.snapshot;
    let entry = state
        .sources
        .scopes
        .get(&scope.key()?)
        .context("financial_source_uninitialized")?;
    ensure!(
        entry.checkout_observations.get(&observation.id) == Some(observation),
        "financial_checkout_observation_changed"
    );
    if entry
        .outcomes
        .values()
        .any(|o| o.operation == observation.operation && entry.unapplied_outcomes.contains(&o.id))
    {
        return NormalWrite::begin_checkout_resolution(
            tx,
            guard,
            &account(scope),
            scope,
            observation.operation,
            &observation.session,
        )
        .await;
    }
    NormalWrite::begin_organization(tx, guard, &account(scope), scope.organization).await
}

pub(super) async fn complete(
    repo: &CheckoutRepository,
    c: &CheckoutClaim,
    e: &SessionEvidence,
    binding: Option<&SubscriptionEvidence>,
) -> Result<bool> {
    let guard = repo.authority()?;
    let original = c.source_request(guard)?;
    // Only the provider resource-read boundary may create a ResourceRead receipt.
    // A caller passing a parsed POST response cannot promote it here.
    let scope = Scope {
        organization: c.proof.org,
        account: c.proof.account.clone(),
        live: c.proof.live,
    };
    repo.settle_history(&account(&scope)).await?;
    let state = guard.read()?.snapshot;
    let entry = state
        .sources
        .scopes
        .get(&scope.key()?)
        .context("financial_source_uninitialized")?;
    let metadata = receipt::Session::from_evidence(e);
    let observation = entry
        .checkout_observations
        .values()
        .find(|value| {
            value.source_claim
                && value.operation == c.operation
                && value.request_hash == original.request_hash
                && value.actor == c.proof.actor
                && value.revision == c.revision
                && value.lease == c.lease
                && value.kind == ObservationKind::ResourceRead
                && value.session == metadata
        })
        .context("financial_checkout_observation_missing")?
        .clone();
    let mut db = repo.postgres().transaction_client().await?;
    let tx = db.transaction().await?;
    apply(tx, guard, &scope, original, observation, Some(c), binding).await
}

/// Cold recovery preserves an observed identity, never recreates a request or a
/// usable current grant. A subsequent fresh authorized read must confirm state.
pub(super) async fn resume(
    repo: &CheckoutRepository,
    tx: deadpool_postgres::Transaction<'_>,
    scope: Scope,
    observation: Observation,
) -> Result<()> {
    let guard = repo.authority()?;
    let state = guard.read()?.snapshot;
    let original = state
        .sources
        .scopes
        .get(&scope.key()?)
        .and_then(|entry| entry.accepted.get(&observation.operation))
        .context("financial_checkout_request_unconfirmed")?
        .clone();
    apply(tx, guard, &scope, original, observation, None, None).await?;
    Ok(())
}
async fn apply(
    tx: deadpool_postgres::Transaction<'_>,
    guard: &FinancialGuard,
    scope: &Scope,
    original: AcceptedRequest,
    observation: Observation,
    claim: Option<&CheckoutClaim>,
    binding: Option<&SubscriptionEvidence>,
) -> Result<bool> {
    let write = begin(tx, guard, scope, &observation).await?;
    let candidate = write.sql().query_opt("SELECT actor_id,recovery_actor,revision FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4", &[&original.operation,&scope.organization,&scope.account,&scope.live]).await?.context("financial_checkout_request_missing")?;
    let actor: Uuid = candidate
        .get::<_, Option<Uuid>>("recovery_actor")
        .unwrap_or(candidate.get("actor_id"));
    let expected_revision: i64 = candidate.get("revision");
    let owner = match AuthorizationService::require_locked_billing_owner(
        write.sql(),
        actor,
        scope.organization,
    )
    .await
    {
        Ok(()) => true,
        Err(error) if error.downcast_ref::<AuthorizationDenied>().is_some() => false,
        Err(error) => return Err(error),
    };
    let row = write.sql().query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR UPDATE", &[&original.operation,&scope.organization,&scope.account,&scope.live]).await?.context("financial_checkout_request_missing")?;
    ensure!(
        row.get::<_, i64>("revision") == expected_revision
            && row
                .get::<_, Option<Uuid>>("recovery_actor")
                .unwrap_or(row.get("actor_id"))
                == actor,
        "financial_checkout_predecessor_changed"
    );
    if claim.is_some() && (expected_revision != observation.revision || actor != observation.actor)
    {
        write.rollback().await?;
        return Ok(false);
    }
    ensure!(
        observation.revision <= expected_revision,
        "financial_checkout_observation_from_future_revision"
    );
    ensure!(
        [
            "pending",
            "session_open",
            "awaiting_verification",
            "recovery_required",
            "owner_changed"
        ]
        .contains(&row.get::<_, String>("disposition").as_str()),
        "financial_checkout_projection_predecessor_changed"
    );
    let quote = write
        .sql()
        .query_one(
            "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
            &[&row.get::<_, Uuid>("quote_id")],
        )
        .await?;
    ensure!(
        control::original(&row, &quote, scope)? == original
            && quote.get::<_, String>("customer_id") == observation.session.customer
            && quote.get::<_, String>("price_id") == observation.session.price
            && quote.get::<_, String>("currency") == observation.session.currency
            && quote.get::<_, i64>("amount_minor") == observation.session.amount_minor,
        "financial_checkout_original_request_changed"
    );
    let now: DateTime<Utc> = write
        .sql()
        .query_one("SELECT clock_timestamp()", &[])
        .await?
        .get(0);
    let lease: Option<Uuid> = row.get("lease_id");
    let deadline: Option<DateTime<Utc>> = row.get("lease_until");
    ensure!(
        !(lease.is_some()
            && deadline.is_some_and(|at| at > now)
            && (claim.is_none() || lease != Some(observation.lease))),
        "financial_checkout_newer_claim_active"
    );
    ensure!(
        row.get::<_, Option<String>>("session_id")
            .is_none_or(|value| value == observation.session.id),
        "financial_checkout_session_conflict"
    );
    let subscription_before: Option<String> = row.get("subscription_id");
    let state = guard.read()?.snapshot;
    let entry = state
        .sources
        .scopes
        .get(&scope.key()?)
        .context("financial_source_uninitialized")?;
    ensure!(
        entry.accepted.get(&original.operation) == Some(&original),
        "financial_checkout_original_request_changed"
    );
    let known = receipt::known_subscription(
        entry,
        original.operation,
        &observation.session.id,
        &observation.session.customer,
    )?;
    ensure!(
        subscription_before
            .as_ref()
            .zip(known.as_ref())
            .is_none_or(|(a, b)| a == b),
        "financial_checkout_subscription_conflict"
    );
    let subscription_after = subscription_before
        .clone()
        .or(known)
        .or(observation.session.subscription.clone());
    let customer_current = if owner {
        match QuoteRepository::guard(
            write.sql(),
            observation.actor,
            scope.organization,
            &scope.account,
            scope.live,
        )
        .await
        {
            Ok(proof) => Some(proof),
            Err(error)
                if error.downcast_ref::<AuthorizationDenied>().is_some()
                    || error.downcast_ref::<TeamError>().is_some() =>
            {
                None
            }
            Err(error) => return Err(error),
        }
    } else {
        None
    };
    let current = claim.is_some_and(|c| {
        customer_current.as_ref() == Some(&c.proof)
            && lease == Some(c.lease)
            && deadline.is_some_and(|at| at > now)
            && observation.kind == ObservationKind::ResourceRead
            && subscription_after == observation.session.subscription
    });
    ensure!(
        claim.is_none()
            || row.get::<_, String>("disposition") != "awaiting_verification"
            || observation.session.status == "complete",
        "financial_checkout_lifecycle_regressed"
    );
    let mut bound = None;
    if current {
        if let Some(value) = binding {
            ensure!(
                observation.session.status == "complete"
                    && value.operation == original.operation
                    && value.session == observation.session.id
                    && value.live == scope.live
                    && observation.session.subscription.as_deref()
                        == Some(value.snapshot.subscription_id.as_str())
                    && value.snapshot.customer_id == observation.session.customer
                    && value.snapshot.price_id.as_deref()
                        == Some(observation.session.price.as_str())
                    && value.snapshot.currency.as_deref()
                        == Some(observation.session.currency.as_str())
                    && value.snapshot.amount_minor == Some(observation.session.amount_minor)
                    && value.snapshot.quantity == Some(1)
                    && value.snapshot.items_complete,
                "financial_checkout_binding_unconfirmed"
            );
            let binding_revision: i64 = write.sql().query_one("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,$2,$3,$4,$5) RETURNING revision", &[&scope.organization,&scope.account,&scope.live,&observation.session.customer,&value.snapshot.subscription_id]).await?.get(0);
            let requested_revision: i64 = write.sql().query_one("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id) VALUES($1,$2,$3) ON CONFLICT(account_id,livemode,subscription_id) DO UPDATE SET requested_revision=team_stripe_reconcile_jobs.requested_revision+1 RETURNING requested_revision", &[&scope.account,&scope.live,&value.snapshot.subscription_id]).await?.get(0);
            bound = Some(CheckoutBinding {
                subscription: value.snapshot.subscription_id.clone(),
                binding_revision,
                requested_revision,
                observation_hash: fingerprint(&value.snapshot)?,
            });
        }
    }
    let projection = if current {
        CheckoutProjection::Current {
            lease: observation.lease,
        }
    } else {
        CheckoutProjection::EvidenceOnly {
            owner_changed: !owner,
        }
    };
    let disposition = disposition(&projection, &observation, bound.as_ref());
    let error = error(&projection);
    let next_revision = expected_revision
        .checked_add(1)
        .context("financial_checkout_revision_overflow")?;
    write.sql().execute("UPDATE team_stripe_checkout_intents SET revision=$2,session_id=$3,session_expires_at=$4,subscription_id=$5,observed_at=$6,disposition=$7,last_error_code=$8,last_http_status=NULL,attempts=0,retry_at=GREATEST(retry_at,clock_timestamp()+interval '60 seconds'),lease_id=NULL,lease_until=NULL WHERE operation_id=$1", &[&original.operation,&next_revision,&observation.session.id,&observation.session.expires_at,&subscription_after,&observation.observed_at,&disposition,&error]).await?;
    let outcomes = write
        .lookup_resolution()
        .map(|(_, values)| values)
        .unwrap_or_default();
    let final_deadline = if current { deadline } else { None };
    write
        .commit_checkout_projection(
            Writer::CheckoutProjection {
                organization: scope.organization,
                request: original,
                expected_revision,
                expected_actor: actor,
                observation,
                subscription_before,
                subscription_after,
                projection,
                outcomes,
                binding: bound,
            },
            final_deadline,
        )
        .await?;
    Ok(current)
}
fn disposition(
    projection: &CheckoutProjection,
    observation: &Observation,
    binding: Option<&CheckoutBinding>,
) -> &'static str {
    match projection {
        CheckoutProjection::EvidenceOnly {
            owner_changed: true,
        } => "owner_changed",
        CheckoutProjection::EvidenceOnly {
            owner_changed: false,
        } => "recovery_required",
        CheckoutProjection::Current { .. } if binding.is_some() => "bound",
        CheckoutProjection::Current { .. } => match observation.session.status.as_str() {
            "open" => "session_open",
            "complete" => "awaiting_verification",
            _ => "expired",
        },
    }
}
fn error(projection: &CheckoutProjection) -> Option<&'static str> {
    match projection {
        CheckoutProjection::Current { .. } => None,
        CheckoutProjection::EvidenceOnly {
            owner_changed: true,
        } => Some("owner_authorization_changed"),
        CheckoutProjection::EvidenceOnly {
            owner_changed: false,
        } => Some("checkout_resource_readback_required"),
    }
}
/// Confirm only a complete exact-next SQL result; never replay the predecessor.
pub(super) async fn committed(
    tx: &Transaction<'_>,
    account: &Account,
    writer: &Writer,
) -> Result<()> {
    let Writer::CheckoutProjection {
        organization,
        request,
        observation,
        expected_revision,
        expected_actor,
        subscription_after,
        projection,
        binding,
        ..
    } = writer
    else {
        anyhow::bail!("financial_transaction_writer_mismatch");
    };
    let row = tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4", &[&request.operation,organization,&account.account,&account.live]).await?.context("financial_checkout_request_missing")?;
    let quote = tx
        .query_one(
            "SELECT * FROM team_stripe_quotes WHERE id=$1",
            &[&row.get::<_, Uuid>("quote_id")],
        )
        .await?;
    let scope = Scope {
        organization: *organization,
        account: account.account.clone(),
        live: account.live,
    };
    ensure!(
        control::original(&row, &quote, &scope)? == *request
            && row
                .get::<_, Option<Uuid>>("recovery_actor")
                .unwrap_or(row.get("actor_id"))
                == *expected_actor
            && row.get::<_, i64>("revision")
                == expected_revision
                    .checked_add(1)
                    .context("financial_checkout_revision_overflow")?
            && row.get::<_, Option<String>>("session_id").as_deref()
                == Some(observation.session.id.as_str())
            && row.get::<_, Option<String>>("subscription_id") == *subscription_after
            && row.get::<_, Option<DateTime<Utc>>>("session_expires_at")
                == Some(observation.session.expires_at)
            && row.get::<_, Option<DateTime<Utc>>>("observed_at") == Some(observation.observed_at)
            && row.get::<_, String>("disposition")
                == disposition(projection, observation, binding.as_ref())
            && row.get::<_, Option<String>>("last_error_code").as_deref() == error(projection)
            && row.get::<_, Option<Uuid>>("lease_id").is_none()
            && row.get::<_, Option<DateTime<Utc>>>("lease_until").is_none(),
        "financial_checkout_projection_next_unconfirmed"
    );
    if let Some(binding) = binding {
        ensure!(tx.query_opt("SELECT 1 FROM team_stripe_bindings b JOIN team_stripe_reconcile_jobs j USING(account_id,livemode,subscription_id) WHERE b.organization_id=$1 AND b.account_id=$2 AND b.livemode=$3 AND b.customer_id=$4 AND b.subscription_id=$5 AND b.enabled AND b.revision=$6 AND j.requested_revision=$7", &[organization,&account.account,&account.live,&observation.session.customer,&binding.subscription,&binding.binding_revision,&binding.requested_revision]).await?.is_some(), "financial_checkout_binding_next_unconfirmed");
    }
    Ok(())
}

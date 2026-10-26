//! Exact retained customer evidence -> canonical SQL, with no create/replay path.
use super::{
    team_financial_transaction::NormalWrite,
    team_stripe_customer::{CustomerClaim, CustomerRepository},
};
use crate::{
    infrastructure::team_financial_guard::FinancialGuard,
    services::{
        authorization::{AuthorizationDenied, AuthorizationService},
        team_financial_ingress as ingress,
        team_financial_source::Scope,
        team_financial_transaction::{CustomerProjection, Writer},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub(super) async fn complete(
    repo: &CustomerRepository,
    c: &CustomerClaim,
    customer: &str,
) -> Result<bool> {
    let guard = repo
        .guard_for_resolution()?
        .context("financial_guard_configuration_unconfirmed")?;
    let original = c.projection_request(guard)?;
    let scope = Scope {
        organization: c.organization_id,
        account: c.account_id.clone(),
        live: c.livemode,
    };
    let account = ingress::Scope {
        account: c.account_id.clone(),
        live: c.livemode,
    };
    repo.settle_resolution_history(&account).await?;
    let state = guard.read()?.snapshot;
    let entry = state
        .sources
        .scopes
        .get(&scope.key()?)
        .context("financial_source_uninitialized")?;
    let unapplied = entry
        .outcomes
        .values()
        .any(|o| o.operation == c.operation_id && entry.unapplied_outcomes.contains(&o.id));
    if !unapplied {
        return current(repo, c, customer, guard).await;
    }
    let mut db = repo.postgres_for_resolution().transaction_client().await?;
    let tx = db.transaction().await?;
    let write = NormalWrite::begin_customer_resolution(
        tx,
        guard,
        &account,
        &scope,
        c.operation_id,
        customer,
    )
    .await?;
    ensure!(
        write.customer_selection()?.request() == original,
        "financial_customer_claim_identity_changed"
    );
    // Participant billing locks are already sorted/held before any Owner or row
    // lock. No account/org/User locks span the preceding provider request.
    let allowed = match AuthorizationService::require_locked_billing_owner(
        write.sql(),
        c.actor,
        c.organization_id,
    )
    .await
    {
        Ok(()) => true,
        Err(e) if e.downcast_ref::<AuthorizationDenied>().is_some() => false,
        Err(e) => return Err(e),
    };
    let row=write.sql().query_opt("SELECT requested_by,revision,disposition,customer_id,lease_id,lease_until,lookup_only,created_at FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR UPDATE",&[&c.operation_id,&c.organization_id,&c.account_id,&c.livemode]).await?.context("financial_customer_request_missing")?;
    let revision: i64 = row.get(1);
    ensure!(
        row.get::<_, Uuid>(0) == original.actor
            && revision == c.revision
            && revision == 1
            && row.get::<_, String>(2) == "pending"
            && row.get::<_, Option<String>>(3).is_none()
            && !row.get::<_, bool>(6)
            && row.get::<_, DateTime<Utc>>(7) == original.accepted_at,
        "financial_customer_projection_predecessor_changed"
    );
    let lease: Option<Uuid> = row.get(4);
    let deadline: Option<DateTime<Utc>> = row.get(5);
    let now: DateTime<Utc> = write
        .sql()
        .query_one("SELECT clock_timestamp()", &[])
        .await?
        .get(0);
    ensure!(
        !(lease.is_some() && lease != Some(c.lease_id) && deadline.is_some_and(|t| t > now)),
        "financial_customer_newer_claim_active"
    );
    let (projection, disposition, error, final_deadline) =
        if allowed && lease == Some(c.lease_id) && deadline.is_some_and(|t| t > now) {
            (
                CustomerProjection::Verified { lease: c.lease_id },
                "verified",
                None,
                deadline,
            )
        } else {
            (
                CustomerProjection::EvidenceOnly {
                    owner_changed: !allowed,
                },
                if allowed {
                    "recovery_required"
                } else {
                    "owner_changed"
                },
                Some(if allowed {
                    "customer_lease_recovery_required"
                } else {
                    "owner_authorization_changed"
                }),
                None,
            )
        };
    let next = revision
        .checked_add(1)
        .context("financial_customer_revision_overflow")?;
    write.sql().execute("UPDATE team_stripe_customer_operations SET revision=$2,customer_id=$3,disposition=$4,last_error_code=$5,observed_at=$6,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&c.operation_id,&next,&customer,&disposition,&error,&now]).await?;
    let selected = write.customer_selection()?;
    let writer = Writer::CustomerResolution {
        organization: c.organization_id,
        request: selected.request().clone(),
        customer: customer.into(),
        outcomes: selected.outcomes().clone(),
        expected_revision: revision,
        observed_at: now,
        projection,
    };
    write
        .commit_customer_resolution(writer, final_deadline)
        .await?;
    // A historical confirmation is not a response grant. Re-read current Owner,
    // canonical source and SQL state independently before acknowledging usable.
    current(repo, c, customer, guard).await
}
async fn current(
    repo: &CustomerRepository,
    c: &CustomerClaim,
    customer: &str,
    guard: &FinancialGuard,
) -> Result<bool> {
    let mut db = repo.postgres_for_resolution().transaction_client().await?;
    let tx = db.transaction().await?;
    super::team_financial_locks::organization(&tx, &c.account_id, c.livemode, c.organization_id)
        .await?;
    match AuthorizationService::require_locked_billing_owner(&tx, c.actor, c.organization_id).await
    {
        Ok(()) => (),
        Err(e) if e.downcast_ref::<AuthorizationDenied>().is_some() => {
            tx.rollback().await?;
            return Ok(false);
        }
        Err(e) => return Err(e),
    }
    let account = ingress::Scope {
        account: c.account_id.clone(),
        live: c.livemode,
    };
    let write = NormalWrite::begin_organization(tx, guard, &account, c.organization_id).await?;
    let yes:bool=write.sql().query_one("SELECT EXISTS(SELECT 1 FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND disposition='verified' AND customer_id=$5)",&[&c.operation_id,&c.organization_id,&c.account_id,&c.livemode,&customer]).await?.get(0);
    ensure!(
        write.commit_operational(None).await?,
        "financial_customer_read_unconfirmed"
    );
    Ok(yes)
}
/// Read-only exact-next receipt. No current lease/Owner is used to rewrite the
/// past, and this function never returns a current CustomerProof.
pub(super) async fn committed(
    tx: &tokio_postgres::Transaction<'_>,
    account: &crate::services::team_financial_ingress::Scope,
    writer: &Writer,
) -> Result<()> {
    let Writer::CustomerResolution {
        organization,
        request,
        customer,
        expected_revision,
        observed_at,
        projection,
        ..
    } = writer
    else {
        anyhow::bail!("financial_transaction_writer_mismatch");
    };
    let row=tx.query_opt("SELECT requested_by,revision,disposition,customer_id,observed_at,created_at,lookup_only,lease_id,lease_until FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4",&[&request.operation,organization,&account.account,&account.live]).await?.context("financial_customer_request_missing")?;
    let disposition = match projection {
        CustomerProjection::Verified { .. } => "verified",
        CustomerProjection::EvidenceOnly {
            owner_changed: true,
        } => "owner_changed",
        CustomerProjection::EvidenceOnly {
            owner_changed: false,
        } => "recovery_required",
    };
    ensure!(
        row.get::<_, Uuid>(0) == request.actor
            && row.get::<_, i64>(1)
                == expected_revision
                    .checked_add(1)
                    .context("financial_customer_revision_overflow")?
            && row.get::<_, String>(2) == disposition
            && row.get::<_, Option<String>>(3).as_deref() == Some(customer.as_str())
            && row.get::<_, Option<DateTime<Utc>>>(4) == Some(*observed_at)
            && row.get::<_, DateTime<Utc>>(5) == request.accepted_at
            && !row.get::<_, bool>(6)
            && row.get::<_, Option<Uuid>>(7).is_none()
            && row.get::<_, Option<DateTime<Utc>>>(8).is_none(),
        "financial_customer_resolution_next_conflict"
    );
    Ok(())
}

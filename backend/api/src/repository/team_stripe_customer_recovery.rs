//! Owner-confirmed lookup authority, separate from immutable create acceptance.
use super::{team_financial_transaction::NormalWrite, team_stripe_customer::CustomerRepository};
use crate::{
    infrastructure::team_financial_guard::FinancialGuard,
    services::{
        authorization::AuthorizationService,
        team_financial_ingress::Scope as Account,
        team_financial_source::{AcceptedRequest, Scope},
        team_financial_transaction::Writer,
        team_insights::TeamError,
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub(super) fn original(
    guard: &FinancialGuard,
    scope: &Scope,
    operation: Uuid,
) -> Result<AcceptedRequest> {
    let request = guard
        .read()?
        .snapshot
        .sources
        .scopes
        .get(&scope.key()?)
        .and_then(|s| s.accepted.get(&operation))
        .cloned()
        .context("financial_customer_request_unconfirmed")?;
    let expected = crate::services::team_stripe_customer_request::Request::new(
        scope.clone(),
        operation,
        request.actor,
    )?
    .accepted(request.accepted_at)?;
    ensure!(
        request == expected,
        "financial_customer_original_request_changed"
    );
    Ok(request)
}

pub(super) async fn authorize(
    repo: &CustomerRepository,
    tx: deadpool_postgres::Transaction<'_>,
    account: &Account,
    actor: Uuid,
    organization: Uuid,
    operation: Uuid,
    expected_revision: i64,
) -> Result<()> {
    ensure!(
        expected_revision > 0 && expected_revision < i64::MAX,
        TeamError::ProjectionChanged
    );
    let guard = repo
        .guard_for_resolution()?
        .context("financial_guard_configuration_unconfirmed")?;
    let scope = Scope {
        organization,
        account: account.account.clone(),
        live: account.live,
    };
    let write = NormalWrite::begin_organization(tx, guard, account, organization).await?;
    AuthorizationService::require_locked_billing_owner(write.sql(), actor, organization).await?;
    let original = original(guard, &scope, operation)?;
    let row=write.sql().query_opt("SELECT revision,disposition,requested_by,lookup_only,created_at FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR UPDATE",&[&operation,&organization,&account.account,&account.live]).await?.ok_or(TeamError::NotFound)?;
    ensure!(
        row.get::<_, DateTime<Utc>>(4) == original.accepted_at,
        "financial_customer_original_request_changed"
    );
    let next = expected_revision + 1;
    if row.get::<_, i64>(0) == next
        && row.get::<_, String>(1) == "pending"
        && row.get::<_, Uuid>(2) == actor
        && row.get::<_, bool>(3)
    {
        let at = authorization(write.sql(), operation, next, actor).await?;
        ensure!(guard.read()?.snapshot.transactions.groups.values().any(|g|g.committed && g.proposal.account==*account && matches!(&g.proposal.writer,Some(Writer::CustomerRecoveryAuthorization{organization:o,request,actor:a,expected_revision:r,authorized_at}) if *o==organization && request==&original && *a==actor && *r==expected_revision && *authorized_at==at)),"financial_customer_recovery_authorization_unconfirmed");
        ensure!(
            write.commit_operational(None).await?,
            "financial_customer_recovery_authorization_unconfirmed"
        );
        return Ok(());
    }
    ensure!(
        row.get::<_, i64>(0) == expected_revision
            && ["owner_changed", "recovery_required"].contains(&row.get::<_, String>(1).as_str()),
        TeamError::ProjectionChanged
    );
    let at: DateTime<Utc> = write
        .sql()
        .query_one("SELECT clock_timestamp()", &[])
        .await?
        .get(0);
    write.sql().execute("UPDATE team_stripe_customer_operations SET requested_by=$2,revision=$3,lookup_only=true,disposition='pending',lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&operation,&actor,&next]).await?;
    write.sql().execute("INSERT INTO team_stripe_customer_authorizations(operation_id,revision,actor_id,authorized_at,action) VALUES($1,$2,$3,$4,'reconcile_existing_customer')",&[&operation,&next,&actor,&at]).await?;
    write
        .commit_customer_recovery_authorization(Writer::CustomerRecoveryAuthorization {
            organization,
            request: original,
            actor,
            expected_revision,
            authorized_at: at,
        })
        .await
}

async fn authorization(
    tx: &tokio_postgres::Transaction<'_>,
    operation: Uuid,
    revision: i64,
    actor: Uuid,
) -> Result<DateTime<Utc>> {
    let row=tx.query_opt("SELECT actor_id,authorized_at,action FROM team_stripe_customer_authorizations WHERE operation_id=$1 AND revision=$2",&[&operation,&revision]).await?.context("financial_customer_recovery_authorization_missing")?;
    ensure!(
        row.get::<_, Uuid>(0) == actor && row.get::<_, String>(2) == "reconcile_existing_customer",
        "financial_customer_recovery_authorization_changed"
    );
    Ok(row.get(1))
}

/// Exact committed-next confirmation has no current Owner grant. Canonical
/// source/checkpoint verification is performed by the shared coordinator too.
pub(super) async fn committed(
    tx: &tokio_postgres::Transaction<'_>,
    account: &Account,
    writer: &Writer,
) -> Result<()> {
    let Writer::CustomerRecoveryAuthorization {
        organization,
        request,
        actor,
        expected_revision,
        authorized_at,
    } = writer
    else {
        anyhow::bail!("financial_transaction_writer_mismatch")
    };
    let next = expected_revision
        .checked_add(1)
        .context("financial_customer_revision_overflow")?;
    let row=tx.query_opt("SELECT revision,disposition,requested_by,lookup_only,created_at,lease_id,lease_until FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4",&[&request.operation,organization,&account.account,&account.live]).await?.context("financial_customer_request_missing")?;
    ensure!(
        row.get::<_, i64>(0) == next
            && row.get::<_, String>(1) == "pending"
            && row.get::<_, Uuid>(2) == *actor
            && row.get::<_, bool>(3)
            && row.get::<_, DateTime<Utc>>(4) == request.accepted_at
            && row.get::<_, Option<Uuid>>(5).is_none()
            && row.get::<_, Option<DateTime<Utc>>>(6).is_none()
            && authorization(tx, request.operation, next, *actor).await? == *authorized_at,
        "financial_customer_recovery_next_conflict"
    );
    Ok(())
}

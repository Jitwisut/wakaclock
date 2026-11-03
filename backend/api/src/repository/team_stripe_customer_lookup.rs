//! Receipt-bound recovery lookup. Retained evidence never grants a new create.
use super::{
    team_financial_transaction::NormalWrite,
    team_stripe_customer::{CustomerClaim, CustomerRepository},
    team_stripe_customer_recovery as recovery,
};
use crate::{
    infrastructure::team_financial_guard::FinancialGuard,
    services::{
        authorization::{AuthorizationDenied, AuthorizationService},
        team_financial_ingress::Scope as Account,
        team_financial_source::{self as source, CustomerLookupResult as Kind},
        team_financial_transaction::{CustomerProjection, Writer},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;

fn account(scope: &source::Scope) -> Account {
    Account {
        account: scope.account.clone(),
        live: scope.live,
    }
}
fn owner(result: Result<()>) -> Result<bool> {
    match result {
        Ok(()) => Ok(true),
        Err(e) if e.downcast_ref::<AuthorizationDenied>().is_some() => Ok(false),
        Err(e) => Err(e),
    }
}
/// Select only this operation's validated unapplied identity; arbitrary exclusion
/// sets and another operation's pending evidence cannot authorize a lookup.
pub(super) async fn begin<'a>(
    tx: deadpool_postgres::Transaction<'a>,
    guard: &FinancialGuard,
    scope: &source::Scope,
    operation: Uuid,
) -> Result<NormalWrite<'a>> {
    let state = guard.read()?.snapshot;
    let entry = state
        .sources
        .scopes
        .get(&scope.key()?)
        .context("financial_source_uninitialized")?;
    let pending = entry
        .outcomes
        .values()
        .find(|o| o.operation == operation && entry.unapplied_outcomes.contains(&o.id));
    if let Some(outcome) = pending {
        let Some(source::ProviderIdentity::Customer { customer }) = &outcome.identity else {
            anyhow::bail!("financial_lookup_identity_unresolved")
        };
        return NormalWrite::begin_customer_resolution(
            tx,
            guard,
            &account(scope),
            scope,
            operation,
            customer,
        )
        .await;
    }
    NormalWrite::begin_organization(tx, guard, &account(scope), scope.organization).await
}

pub(super) async fn claim(
    repo: &CustomerRepository,
    tx: deadpool_postgres::Transaction<'_>,
    scope: source::Scope,
    operation: Uuid,
    actor: Uuid,
) -> Result<Option<CustomerClaim>> {
    let guard = repo
        .guard_for_resolution()?
        .context("financial_guard_configuration_unconfirmed")?;
    let request = recovery::original(guard, &scope, operation)?;
    let write = begin(tx, guard, &scope, operation).await?;
    let allowed = owner(
        AuthorizationService::require_locked_billing_owner(write.sql(), actor, scope.organization)
            .await,
    )?;
    let row=write.sql().query_opt("SELECT * FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND requested_by=$5 AND lookup_only AND disposition='pending' AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) FOR UPDATE",&[&operation,&scope.organization,&scope.account,&scope.live,&actor]).await?;
    let Some(row) = row else {
        write.rollback().await?;
        return Ok(None);
    };
    let revision: i64 = row.get("revision");
    ensure!(
        row.get::<_, DateTime<Utc>>("created_at") == request.accepted_at,
        "financial_customer_original_request_changed"
    );
    recovery::verify(write.sql(), guard, &scope, &request, actor, revision).await?;
    let now: DateTime<Utc> = write
        .sql()
        .query_one("SELECT clock_timestamp()", &[])
        .await?
        .get(0);
    if !allowed {
        let next = revision
            .checked_add(1)
            .context("financial_customer_revision_overflow")?;
        write.sql().execute("UPDATE team_stripe_customer_operations SET revision=$2,disposition='owner_changed',observed_at=$3,last_error_code='owner_authorization_changed',lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&operation,&next,&now]).await?;
        let selected = write.lookup_resolution();
        let resolved_customer = selected.as_ref().map(|v| v.0.clone());
        let outcomes = selected.map(|v| v.1).unwrap_or_default();
        write
            .commit_lookup_stop(Writer::CustomerLookupStop {
                organization: scope.organization,
                request,
                actor,
                revision,
                stopped_at: now,
                customer_before: row.get("customer_id"),
                outcomes,
                resolved_customer,
            })
            .await?;
        return Ok(None);
    }
    let lease = Uuid::now_v7();
    let deadline = now + chrono::Duration::seconds(180);
    let customer: Option<String> = row.get("customer_id");
    write.sql().execute("UPDATE team_stripe_customer_operations SET lease_id=$2,lease_until=$3,attempts=attempts+1 WHERE operation_id=$1",&[&operation,&lease,&deadline]).await?;
    write.commit_lookup_claim(deadline).await?;
    let mut c = CustomerClaim {
        operation_id: operation,
        organization_id: scope.organization,
        actor,
        lease_id: lease,
        account_id: scope.account,
        livemode: scope.live,
        revision,
        lookup_only: true,
        customer_id: customer,
        financial: None,
    };
    repo.seal_source_claim(&mut c, request)?;
    Ok(Some(c))
}

pub(super) async fn preflight(
    pg: &crate::infrastructure::postgres::PostgresClient,
    guard: &FinancialGuard,
    scope: &source::Scope,
    request: &source::AcceptedRequest,
    c: &CustomerClaim,
    expected_token: &str,
) -> Result<()> {
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    ensure!(
        super::team_financial_inventory::account_source_token(guard, &account(scope))?
            == expected_token,
        "financial_customer_source_changed"
    );
    let write = begin(tx, guard, scope, c.operation_id).await?;
    AuthorizationService::require_locked_billing_owner(write.sql(), c.actor, scope.organization)
        .await?;
    recovery::verify(write.sql(), guard, scope, request, c.actor, c.revision).await?;
    let row=write.sql().query_opt("SELECT lease_until FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND requested_by=$5 AND revision=$6 AND lease_id=$7 AND lease_until>clock_timestamp() AND lookup_only AND disposition='pending' AND customer_id IS NOT DISTINCT FROM $8 AND created_at=$9 FOR SHARE",&[&c.operation_id,&scope.organization,&scope.account,&scope.live,&c.actor,&c.revision,&c.lease_id,&c.customer_id,&request.accepted_at]).await?.context("financial_customer_lease_unconfirmed")?;
    ensure!(
        super::team_financial_inventory::account_source_token(guard, &account(scope))?
            == expected_token,
        "financial_customer_source_changed"
    );
    write.commit_lookup_claim(row.get(0)).await
}
pub(super) async fn fail(
    repo: &CustomerRepository,
    c: &CustomerClaim,
    error: &crate::infrastructure::stripe::ProviderError,
) -> Result<()> {
    let guard = repo
        .guard_for_resolution()?
        .context("financial_guard_configuration_unconfirmed")?;
    let scope = source::Scope {
        organization: c.organization_id,
        account: c.account_id.clone(),
        live: c.livemode,
    };
    let mut db = repo.postgres_for_resolution().transaction_client().await?;
    let tx = db.transaction().await?;
    let write = begin(tx, guard, &scope, c.operation_id).await?;
    let row=write.sql().query_opt("SELECT lease_until FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND requested_by=$5 AND revision=$6 AND lease_id=$7 AND lease_until>clock_timestamp() AND lookup_only AND disposition='pending' FOR UPDATE",&[&c.operation_id,&scope.organization,&scope.account,&scope.live,&c.actor,&c.revision,&c.lease_id]).await?;
    let Some(row) = row else {
        write.rollback().await?;
        return Ok(());
    };
    let deadline = row.get(0);
    write.sql().execute("UPDATE team_stripe_customer_operations SET retry_at=GREATEST(clock_timestamp()+make_interval(secs=>LEAST(3600,15*power(2,LEAST(attempts,8)))::double precision),COALESCE($2,clock_timestamp())),last_error_code=$3,last_http_status=$4,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&c.operation_id,&error.retry_after,&error.kind.code(),&error.status]).await?;
    write.commit_lookup_claim(deadline).await
}

pub(super) fn resumable(
    guard: &FinancialGuard,
    row: &tokio_postgres::Row,
) -> Result<Option<source::CustomerLookup>> {
    if !row.get::<_, bool>("lookup_only") {
        return Ok(None);
    }
    let scope = source::Scope {
        organization: row.get("organization_id"),
        account: row.get("account_id"),
        live: row.get("livemode"),
    };
    let state = guard.read()?.snapshot;
    let Some(entry) = state.sources.scopes.get(&scope.key()?) else {
        return Ok(None);
    };
    Ok(entry
        .customer_lookups
        .values()
        .find(|r| {
            r.operation == row.get::<_, Uuid>("operation_id")
                && r.actor == row.get::<_, Uuid>("requested_by")
                && r.authorization_revision == row.get::<_, i64>("revision")
                && Some(r.lease) == row.get::<_, Option<Uuid>>("lease_id")
        })
        .cloned())
}

pub(super) async fn resume(
    repo: &CustomerRepository,
    tx: deadpool_postgres::Transaction<'_>,
    scope: source::Scope,
    observation: source::CustomerLookup,
) -> Result<()> {
    apply(
        repo,
        tx,
        Input {
            request: recovery::original(
                repo.guard_for_resolution()?
                    .context("financial_guard_configuration_unconfirmed")?,
                &scope,
                observation.operation,
            )?,
            scope,
            observation,
            expected_customer: None,
        },
    )
    .await?;
    Ok(())
}
struct Input {
    scope: source::Scope,
    request: source::AcceptedRequest,
    observation: source::CustomerLookup,
    expected_customer: Option<Option<String>>,
}

pub(super) async fn project_claim(
    repo: &CustomerRepository,
    c: &CustomerClaim,
    customer: Option<&str>,
) -> Result<bool> {
    ensure!(c.lookup_only, "financial_lookup_claim_required");
    let guard = repo
        .guard_for_resolution()?
        .context("financial_guard_configuration_unconfirmed")?;
    let request = c.projection_request(guard)?.clone();
    let scope = source::Scope {
        organization: c.organization_id,
        account: c.account_id.clone(),
        live: c.livemode,
    };
    repo.settle_resolution_history(&account(&scope)).await?;
    let state = guard.read()?.snapshot;
    let entry = state
        .sources
        .scopes
        .get(&scope.key()?)
        .context("financial_source_uninitialized")?;
    let observation = entry
        .customer_lookups
        .values()
        .find(|r| {
            r.operation == c.operation_id
                && r.actor == c.actor
                && r.authorization_revision == c.revision
                && r.lease == c.lease_id
                && match (&r.result, customer) {
                    (Kind::Verified { customer: a, .. }, Some(b)) => a == b,
                    (Kind::NotFound | Kind::Deleted { .. }, None) => true,
                    _ => false,
                }
        })
        .cloned()
        .context("financial_lookup_receipt_missing")?;
    let mut db = repo.postgres_for_resolution().transaction_client().await?;
    let tx = db.transaction().await?;
    apply(
        repo,
        tx,
        Input {
            scope: scope.clone(),
            request,
            observation,
            expected_customer: Some(c.customer_id.clone()),
        },
    )
    .await?;
    current(repo, &scope, c, customer).await
}

async fn apply(
    repo: &CustomerRepository,
    tx: deadpool_postgres::Transaction<'_>,
    input: Input,
) -> Result<()> {
    let Input {
        scope,
        request,
        observation,
        expected_customer,
    } = input;
    let guard = repo
        .guard_for_resolution()?
        .context("financial_guard_configuration_unconfirmed")?;
    let write = begin(tx, guard, &scope, request.operation).await?;
    let state = guard.read()?.snapshot;
    ensure!(
        state
            .sources
            .scopes
            .get(&scope.key()?)
            .and_then(|e| e.customer_lookups.get(&observation.id))
            == Some(&observation),
        "financial_lookup_receipt_changed"
    );
    let allowed = owner(
        AuthorizationService::require_locked_billing_owner(
            write.sql(),
            observation.actor,
            scope.organization,
        )
        .await,
    )?;
    let row=write.sql().query_opt("SELECT * FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR UPDATE",&[&request.operation,&scope.organization,&scope.account,&scope.live]).await?.context("financial_customer_request_missing")?;
    if row.get::<_, i64>("revision") != observation.authorization_revision
        || row.get::<_, String>("disposition") != "pending"
    {
        // A previous completion or a newer authorization wins. Retain all late
        // evidence; only the actual current response reader may return a grant.
        write.rollback().await?;
        return Ok(());
    }
    ensure!(
        row.get::<_, Uuid>("requested_by") == observation.actor
            && row.get::<_, bool>("lookup_only")
            && row.get::<_, DateTime<Utc>>("created_at") == request.accepted_at,
        "financial_lookup_predecessor_changed"
    );
    recovery::verify(
        write.sql(),
        guard,
        &scope,
        &request,
        observation.actor,
        observation.authorization_revision,
    )
    .await?;
    let before: Option<String> = row.get("customer_id");
    ensure!(
        expected_customer.as_ref().is_none_or(|v| v == &before),
        "financial_lookup_customer_changed"
    );
    let lease: Option<Uuid> = row.get("lease_id");
    let deadline: Option<DateTime<Utc>> = row.get("lease_until");
    let now: DateTime<Utc> = write
        .sql()
        .query_one("SELECT clock_timestamp()", &[])
        .await?
        .get(0);
    ensure!(
        !(lease.is_some() && lease != Some(observation.lease) && deadline.is_some_and(|d| d > now)),
        "financial_customer_newer_claim_active"
    );
    let positive = matches!(observation.result, Kind::Verified { .. });
    let customer = match &observation.result {
        Kind::Verified { customer, .. } => {
            ensure!(
                before.as_ref().is_none_or(|v| v == customer),
                "financial_customer_provider_identity_changed"
            );
            Some(customer.clone())
        }
        Kind::NotFound | Kind::Deleted { .. } => before.clone(),
        _ => anyhow::bail!("financial_lookup_conflicting_disposition"),
    };
    let (projection, final_deadline) = if positive
        && allowed
        && lease == Some(observation.lease)
        && deadline.is_some_and(|d| d > now)
    {
        (
            CustomerProjection::Verified {
                lease: observation.lease,
            },
            deadline,
        )
    } else {
        (
            CustomerProjection::EvidenceOnly {
                owner_changed: !allowed,
            },
            None,
        )
    };
    let disposition = disposition(&projection);
    let error = match (&observation.result, &projection) {
        (_, CustomerProjection::Verified { .. }) => None,
        (
            _,
            CustomerProjection::EvidenceOnly {
                owner_changed: true,
            },
        ) => Some("owner_authorization_changed"),
        (Kind::NotFound, _) => Some("customer_not_found_unconfirmed"),
        (Kind::Deleted { .. }, _) => Some("customer_deleted"),
        _ => Some("customer_lease_recovery_required"),
    };
    let next = observation
        .authorization_revision
        .checked_add(1)
        .context("financial_customer_revision_overflow")?;
    write.sql().execute("UPDATE team_stripe_customer_operations SET revision=$2,disposition=$3,customer_id=$4,observed_at=$5,last_error_code=$6,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&request.operation,&next,&disposition,&customer,&now,&error]).await?;
    let selected = write.lookup_resolution();
    let resolved_customer = selected.as_ref().map(|v| v.0.clone());
    let outcomes = selected.map(|v| v.1).unwrap_or_default();
    write
        .commit_lookup_projection(
            Writer::CustomerLookupProjection {
                organization: scope.organization,
                request,
                observation,
                customer_before: before,
                outcomes,
                resolved_customer,
                projected_at: now,
                projection,
            },
            final_deadline,
        )
        .await
}
fn disposition(projection: &CustomerProjection) -> &'static str {
    match projection {
        CustomerProjection::Verified { .. } => "verified",
        CustomerProjection::EvidenceOnly {
            owner_changed: true,
        } => "owner_changed",
        _ => "recovery_required",
    }
}

async fn current(
    repo: &CustomerRepository,
    scope: &source::Scope,
    c: &CustomerClaim,
    customer: Option<&str>,
) -> Result<bool> {
    let guard = repo
        .guard_for_resolution()?
        .context("financial_guard_configuration_unconfirmed")?;
    let mut db = repo.postgres_for_resolution().transaction_client().await?;
    let tx = db.transaction().await?;
    super::team_financial_locks::organization(&tx, &scope.account, scope.live, scope.organization)
        .await?;
    if !owner(
        AuthorizationService::require_locked_billing_owner(&tx, c.actor, scope.organization).await,
    )? {
        tx.rollback().await?;
        return Ok(false);
    }
    let write =
        NormalWrite::begin_organization(tx, guard, &account(scope), scope.organization).await?;
    let matching_history=guard.read()?.snapshot.transactions.groups.values().any(|g|g.committed
        && g.proposal.account==account(scope) && matches!(&g.proposal.writer,
            Some(Writer::CustomerLookupProjection{organization,observation,projection:CustomerProjection::Verified{lease},..})
            if *organization==scope.organization && observation.operation==c.operation_id
                && observation.actor==c.actor && observation.authorization_revision==c.revision
                && *lease==c.lease_id && matches!((&observation.result,customer),(Kind::Verified{customer:a,..},Some(b)) if a==b)));
    let yes:bool=write.sql().query_one("SELECT EXISTS(SELECT 1 FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND revision=$5 AND requested_by=$6 AND lookup_only AND disposition='verified' AND customer_id=$7)",&[&c.operation_id,&scope.organization,&scope.account,&scope.live,&c.revision.checked_add(1).context("financial_customer_revision_overflow")?,&c.actor,&customer]).await?.get(0);
    ensure!(
        write.commit_operational(None).await?,
        "financial_customer_read_unconfirmed"
    );
    Ok(yes && matching_history)
}

pub(super) async fn committed(
    tx: &tokio_postgres::Transaction<'_>,
    account: &Account,
    writer: &Writer,
) -> Result<()> {
    let (organization, request, actor, revision, at, lookup, expected_customer) = match writer {
        Writer::CustomerLookupProjection {
            organization,
            request,
            observation,
            customer_before,
            projected_at,
            projection,
            ..
        } => (
            organization,
            request,
            observation.actor,
            observation.authorization_revision,
            *projected_at,
            disposition(projection),
            match &observation.result {
                Kind::Verified { customer, .. } => Some(customer.clone()),
                _ => customer_before.clone(),
            },
        ),
        Writer::CustomerLookupStop {
            organization,
            request,
            actor,
            revision,
            stopped_at,
            customer_before,
            ..
        } => (
            organization,
            request,
            *actor,
            *revision,
            *stopped_at,
            "owner_changed",
            customer_before.clone(),
        ),
        _ => anyhow::bail!("financial_transaction_writer_mismatch"),
    };
    let row=tx.query_opt("SELECT * FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4",&[&request.operation,organization,&account.account,&account.live]).await?.context("financial_customer_request_missing")?;
    ensure!(
        row.get::<_, i64>("revision")
            == revision
                .checked_add(1)
                .context("financial_customer_revision_overflow")?
            && row.get::<_, Uuid>("requested_by") == actor
            && row.get::<_, String>("disposition") == lookup
            && row.get::<_, bool>("lookup_only")
            && row.get::<_, DateTime<Utc>>("created_at") == request.accepted_at
            && row.get::<_, Option<DateTime<Utc>>>("observed_at") == Some(at)
            && row.get::<_, Option<Uuid>>("lease_id").is_none()
            && row.get::<_, Option<DateTime<Utc>>>("lease_until").is_none()
            && row.get::<_, Option<String>>("customer_id") == expected_customer,
        "financial_lookup_next_conflict"
    );
    Ok(())
}

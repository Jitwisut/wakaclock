//! Scoped customer claims and provider-boundary proof. No response grants a binding.
use super::{CustomerClaim, CustomerRepository};
use crate::{
    infrastructure::{postgres::PostgresClient, team_financial_guard::FinancialGuard},
    repository::{
        team_financial_ingress as ingress, team_financial_inventory as inventory,
        team_financial_transaction::NormalWrite,
    },
    services::{
        authorization::{AuthorizationDenied, AuthorizationService},
        team_financial_guard::fingerprint,
        team_financial_source as source,
        team_financial_transaction::{CustomerStage, Writer},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub(crate) struct Proof {
    pg: Arc<PostgresClient>,
    guard: Option<FinancialGuard>,
    scope: source::Scope,
    request: source::AcceptedRequest,
    source_mode: bool,
    token: Option<String>,
    claim_hash: String,
}
impl std::fmt::Debug for Proof {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("CustomerProof(redacted)")
    }
}
fn identity(c: &CustomerClaim) -> Result<String> {
    fingerprint(&(
        c.operation_id,
        c.organization_id,
        c.actor,
        c.lease_id,
        &c.account_id,
        c.livemode,
        c.revision,
        c.lookup_only,
        &c.customer_id,
    ))
}
impl Proof {
    pub(super) fn new(
        repo: &CustomerRepository,
        c: &CustomerClaim,
        request: source::AcceptedRequest,
        source_mode: bool,
    ) -> Result<Self> {
        let scope = source::Scope {
            organization: c.organization_id,
            account: c.account_id.clone(),
            live: c.livemode,
        };
        let guard = repo.guard()?.cloned();
        let token = guard
            .as_ref()
            .map(|g| {
                if source_mode {
                    g.read()?.source_token(&scope)
                } else {
                    inventory::account_source_token(
                        g,
                        &crate::services::team_financial_ingress::Scope {
                            account: scope.account.clone(),
                            live: scope.live,
                        },
                    )
                }
            })
            .transpose()?;
        Ok(Self {
            pg: repo.pg.clone(),
            guard,
            scope,
            request,
            source_mode,
            token,
            claim_hash: identity(c)?,
        })
    }
    pub(super) fn same_authority(&self, guard: Option<&FinancialGuard>) -> Result<()> {
        ensure!(
            match (&self.guard, guard) {
                (Some(a), Some(b)) => a.same_authority(b),
                (None, None) => true,
                _ => false,
            },
            "financial_customer_authority_changed"
        );
        Ok(())
    }
    pub(super) fn projection_request(
        &self,
        c: &CustomerClaim,
        guard: &FinancialGuard,
    ) -> Result<&source::AcceptedRequest> {
        self.same_authority(Some(guard))?;
        ensure!(
            self.source_mode && identity(c)? == self.claim_hash,
            "financial_customer_claim_identity_changed"
        );
        Ok(&self.request)
    }
    pub(super) fn is_source(&self) -> bool {
        self.source_mode
    }
    pub(super) fn retain(
        &self,
        c: &CustomerClaim,
        customer: Option<&str>,
        verified: bool,
    ) -> Result<()> {
        ensure!(
            identity(c)? == self.claim_hash,
            "financial_customer_claim_identity_changed"
        );
        if let Some(guard) = &self.guard {
            guard.retain_customer_outcome(
                self.scope.clone(),
                &self.request,
                customer,
                verified,
                self.source_mode,
            )?;
        }
        Ok(())
    }
    pub(super) async fn preflight(
        &self,
        c: &CustomerClaim,
        authority: Option<&FinancialGuard>,
    ) -> Result<()> {
        self.same_authority(authority)?;
        ensure!(
            identity(c)? == self.claim_hash,
            "financial_customer_claim_identity_changed"
        );
        let account = crate::services::team_financial_ingress::Scope {
            account: c.account_id.clone(),
            live: c.livemode,
        };
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        crate::repository::team_financial_locks::organization(
            &tx,
            &account.account,
            account.live,
            c.organization_id,
        )
        .await?;
        AuthorizationService::require_locked_billing_owner(&tx, c.actor, c.organization_id).await?;
        let row=tx.query_opt("SELECT first_attempt_at,lease_until FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND requested_by=$5 AND lease_id=$6 AND revision=$7 AND lookup_only=$8 AND customer_id IS NOT DISTINCT FROM $9 AND disposition='pending' AND lease_until>clock_timestamp() FOR SHARE",&[&c.operation_id,&c.organization_id,&c.account_id,&c.livemode,&c.actor,&c.lease_id,&c.revision,&c.lookup_only,&c.customer_id]).await?.context("financial_customer_lease_unconfirmed")?;
        let first: DateTime<Utc> = row
            .get::<_, Option<DateTime<Utc>>>(0)
            .context("financial_customer_first_attempt_missing")?;
        let mut deadline: DateTime<Utc> = row.get(1);
        if !c.lookup_only {
            deadline = deadline.min(first + chrono::Duration::hours(23));
        }
        // A configured independent authority cannot authorize a create without
        // an explicitly reviewed source baseline. Legacy read/lookup remains a
        // rollout path, not an implicit baseline or accepted-create proof.
        ensure!(
            c.lookup_only || self.guard.is_none() || self.source_mode,
            "financial_customer_baseline_required"
        );
        if let Some(guard) = &self.guard {
            ingress::ready(&tx, guard, &account).await?;
            if self.source_mode {
                ensure!(
                    guard.read()?.source_token(&self.scope)?
                        == *self
                            .token
                            .as_ref()
                            .context("financial_customer_proof_missing")?,
                    "financial_customer_source_changed"
                );
                let state = guard.read()?.snapshot;
                let entry = state
                    .sources
                    .scopes
                    .get(&self.scope.key()?)
                    .context("financial_source_uninitialized")?;
                let dispatch = entry
                    .dispatches
                    .get(&c.operation_id)
                    .context("financial_customer_dispatch_missing")?;
                ensure!(
                    entry.accepted.get(&c.operation_id) == Some(&self.request)
                        && dispatch.first_attempt_at == first
                        && dispatch.request_hash == self.request.request_hash
                        && dispatch.idempotency_hash == self.request.idempotency_hash,
                    "financial_customer_dispatch_changed"
                );
                let write =
                    NormalWrite::begin_organization(tx, guard, &account, c.organization_id).await?;
                ensure!(
                    write.commit_customer_claim(deadline).await?,
                    "financial_customer_lease_unconfirmed"
                );
                return Ok(());
            }
            ensure!(
                !crate::repository::team_financial_transaction::source_mode(&tx, guard, &account)
                    .await?,
                "financial_customer_source_changed"
            );
            ensure!(
                inventory::account_source_token(guard, &account)?
                    == *self
                        .token
                        .as_ref()
                        .context("financial_customer_proof_missing")?,
                "financial_customer_source_changed"
            );
        } else {
            ingress::require_authority(&tx, &account, None).await?;
        }
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        ensure!(now < deadline, "financial_customer_lease_unconfirmed");
        tx.commit().await?;
        Ok(())
    }
}

pub(super) async fn claim(
    repo: &CustomerRepository,
    tx: deadpool_postgres::Transaction<'_>,
    account: &crate::services::team_financial_ingress::Scope,
) -> Result<Option<CustomerClaim>> {
    let guard = repo
        .guard()?
        .context("financial_guard_configuration_unconfirmed")?;
    let retired = crate::repository::team_financial_transaction::retired(guard, account)?;
    let row=tx.query_opt("SELECT operation_id,organization_id,requested_by FROM team_stripe_customer_operations WHERE account_id=$1 AND livemode=$2 AND disposition='pending' AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) AND NOT(organization_id=ANY($3::uuid[])) ORDER BY retry_at,created_at,operation_id LIMIT 1",&[&account.account,&account.live,&retired]).await?;
    let Some(candidate) = row else {
        tx.commit().await?;
        return Ok(None);
    };
    let op: Uuid = candidate.get(0);
    let org: Uuid = candidate.get(1);
    let actor: Uuid = candidate.get(2);
    crate::repository::team_seats::lock(&tx, org).await?;
    let allowed = match AuthorizationService::require_locked_billing_owner(&tx, actor, org).await {
        Ok(()) => true,
        Err(e) if e.downcast_ref::<AuthorizationDenied>().is_some() => false,
        Err(e) => return Err(e),
    };
    let write = NormalWrite::begin_organization(tx, guard, account, org).await?;
    let row=write.sql().query_opt("SELECT * FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND requested_by=$5 AND disposition='pending' AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) FOR UPDATE",&[&op,&org,&account.account,&account.live,&actor]).await?;
    let Some(row) = row else {
        write.rollback().await?;
        return Ok(None);
    };
    ensure!(
        row.get::<_, i64>("revision") == 1
            && !row.get::<_, bool>("lookup_only")
            && row.get::<_, Option<String>>("customer_id").is_none(),
        "financial_customer_reauthorization_integration_required"
    );
    let scope = source::Scope {
        organization: org,
        account: account.account.clone(),
        live: account.live,
    };
    let request =
        crate::services::team_stripe_customer_request::Request::new(scope.clone(), op, actor)?
            .accepted(row.get("created_at"))?;
    let state = guard.read()?.snapshot;
    let entry = state
        .sources
        .scopes
        .get(&scope.key()?)
        .context("financial_source_uninitialized")?;
    ensure!(
        entry.accepted.get(&op) == Some(&request),
        "financial_customer_request_unconfirmed"
    );
    let first: Option<DateTime<Utc>> = row.get("first_attempt_at");
    if let Some(first) = first {
        let retained=entry.dispatches.get(&op).is_some_and(|d|d.first_attempt_at==first && d.request_hash==request.request_hash && d.idempotency_hash==request.idempotency_hash)
            || state.transactions.groups.values().any(|g|g.committed && g.proposal.account==*account && matches!(&g.proposal.writer,Some(Writer::CustomerLifecycle{organization,request:r,stage:CustomerStage::FirstAttempt{first_attempt_at}}) if *organization==org && r==&request && *first_attempt_at==first));
        ensure!(retained, "financial_customer_first_attempt_unconfirmed");
    }
    let now: DateTime<Utc> = write
        .sql()
        .query_one("SELECT clock_timestamp()", &[])
        .await?
        .get(0);
    if !allowed
        || first.is_some_and(|t| now.signed_duration_since(t) >= chrono::Duration::hours(23))
    {
        write.sql().execute("UPDATE team_stripe_customer_operations SET revision=2,disposition=$2,last_error_code=$3,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&op,&if allowed {"recovery_required"}else{"owner_changed"},&if allowed {"idempotency_window_unconfirmed"}else{"owner_authorization_changed"}]).await?;
        write
            .commit_customer_lifecycle(
                Writer::CustomerLifecycle {
                    organization: org,
                    request,
                    stage: CustomerStage::Stop {
                        first_attempt_at: first,
                        owner_changed: !allowed,
                    },
                },
                None,
            )
            .await?;
        return Ok(None);
    }
    let initial = first.is_none();
    let first = first.unwrap_or(now);
    let lease = Uuid::now_v7();
    let deadline = now + chrono::Duration::seconds(180);
    write.sql().execute("UPDATE team_stripe_customer_operations SET first_attempt_at=$2,lease_id=$3,lease_until=$4,attempts=attempts+1 WHERE operation_id=$1",&[&op,&first,&lease,&deadline]).await?;
    if initial {
        write
            .commit_customer_lifecycle(
                Writer::CustomerLifecycle {
                    organization: org,
                    request: request.clone(),
                    stage: CustomerStage::FirstAttempt {
                        first_attempt_at: first,
                    },
                },
                Some(deadline),
            )
            .await?;
    } else if !write.commit_customer_claim(deadline).await? {
        return Ok(None);
    }
    // No provider request can begin until this immutable first-possible-send
    // receipt is fsynced. A crash before it only permits exact original readback.
    guard.record_source(source::Event::Dispatch {
        scope,
        dispatch: source::Dispatch {
            operation: op,
            request_hash: request.request_hash.clone(),
            idempotency_hash: request.idempotency_hash.clone(),
            first_attempt_at: first,
        },
    })?;
    let mut claim = CustomerClaim {
        operation_id: op,
        organization_id: org,
        actor,
        lease_id: lease,
        account_id: account.account.clone(),
        livemode: account.live,
        revision: 1,
        lookup_only: false,
        customer_id: None,
        financial: None,
    };
    claim.financial = Some(Proof::new(repo, &claim, request, true)?);
    Ok(Some(claim))
}

pub(super) async fn fail(
    repo: &CustomerRepository,
    c: &CustomerClaim,
    e: &crate::infrastructure::stripe::ProviderError,
) -> Result<()> {
    let proof = c
        .financial
        .as_ref()
        .context("financial_customer_claim_proof_required")?;
    proof.same_authority(repo.guard()?)?;
    ensure!(
        identity(c)? == proof.claim_hash,
        "financial_customer_claim_identity_changed"
    );
    let guard = repo
        .guard()?
        .context("financial_guard_configuration_unconfirmed")?;
    let account = crate::services::team_financial_ingress::Scope {
        account: c.account_id.clone(),
        live: c.livemode,
    };
    let mut db = repo.pg.transaction_client().await?;
    let tx = db.transaction().await?;
    crate::repository::team_financial_locks::organization(
        &tx,
        &c.account_id,
        c.livemode,
        c.organization_id,
    )
    .await?;
    let write = NormalWrite::begin_organization(tx, guard, &account, c.organization_id).await?;
    let row=write.sql().query_opt("SELECT lease_until FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND requested_by=$5 AND lease_id=$6 AND revision=$7 AND disposition='pending' AND lease_until>clock_timestamp() FOR UPDATE",&[&c.operation_id,&c.organization_id,&c.account_id,&c.livemode,&c.actor,&c.lease_id,&c.revision]).await?;
    let Some(row) = row else {
        write.rollback().await?;
        return Ok(());
    };
    let deadline: DateTime<Utc> = row.get(0);
    write.sql().execute("UPDATE team_stripe_customer_operations SET retry_at=GREATEST(clock_timestamp()+make_interval(secs=>LEAST(3600,15*power(2,LEAST(attempts,8)))::double precision),COALESCE($2,clock_timestamp())),last_error_code=$3,last_http_status=$4,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&c.operation_id,&e.retry_after,&e.kind.code(),&e.status]).await?;
    write.commit_customer_claim(deadline).await?;
    Ok(())
}

//! Server-owned customer creation receipts. Never binds caller-supplied provider IDs.
use crate::{
    infrastructure::{postgres::PostgresClient, stripe::ProviderError},
    services::authorization::{AuthorizationDenied, AuthorizationService},
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;
#[path = "team_stripe_customer_dispatch.rs"]
mod dispatch;
#[derive(Debug, Serialize)]
pub struct CustomerStatus {
    pub operation_id: Uuid,
    pub disposition: String,
    pub last_error_code: Option<String>,
    pub observed_at: Option<DateTime<Utc>>,
    pub revision: i64,
    pub retry_at: DateTime<Utc>,
    pub lookup_only: bool,
}
#[derive(Debug)]
pub struct CustomerClaim {
    pub operation_id: Uuid,
    pub organization_id: Uuid,
    pub actor: Uuid,
    pub lease_id: Uuid,
    pub account_id: String,
    pub livemode: bool,
    pub revision: i64,
    pub lookup_only: bool,
    pub customer_id: Option<String>,
    pub(crate) financial: Option<dispatch::Proof>,
}
impl CustomerClaim {
    pub(crate) async fn provider_preflight(
        &self,
        guard: Option<&crate::infrastructure::team_financial_guard::FinancialGuard>,
    ) -> Result<()> {
        self.financial
            .as_ref()
            .context("financial_customer_claim_proof_required")?
            .preflight(self, guard)
            .await
    }
    pub(super) fn projection_request(
        &self,
        guard: &crate::infrastructure::team_financial_guard::FinancialGuard,
    ) -> Result<&crate::services::team_financial_source::AcceptedRequest> {
        self.financial
            .as_ref()
            .context("financial_customer_claim_proof_required")?
            .projection_request(self, guard)
    }
    pub(crate) fn retain_provider_result(
        &self,
        customer: Option<&str>,
        verified: bool,
    ) -> Result<()> {
        self.financial
            .as_ref()
            .context("financial_customer_claim_proof_required")?
            .retain(self, customer, verified)
    }
}
#[cfg(test)]
type AfterLegacyMode =
    std::sync::Arc<parking_lot::Mutex<Option<Box<dyn FnOnce() -> Result<()> + Send>>>>;
pub struct CustomerRepository {
    pg: Arc<PostgresClient>,
    financial_guard: Option<crate::infrastructure::team_financial_guard::FinancialGuard>,
    financial_configuration_error: bool,
    #[cfg(test)]
    after_legacy_mode: AfterLegacyMode,
}
impl CustomerRepository {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        match crate::infrastructure::team_financial_guard::FinancialObservation::from_environment()
        {
            Ok(a) => Self::with_financial_authority(pg, a.guard().cloned(), false),
            Err(_) => Self::with_financial_authority(pg, None, true),
        }
    }
    pub(crate) fn with_financial_authority(
        pg: Arc<PostgresClient>,
        financial_guard: Option<crate::infrastructure::team_financial_guard::FinancialGuard>,
        financial_configuration_error: bool,
    ) -> Self {
        Self {
            pg,
            financial_guard,
            financial_configuration_error,
            #[cfg(test)]
            after_legacy_mode: Default::default(),
        }
    }
    fn guard(
        &self,
    ) -> Result<Option<&crate::infrastructure::team_financial_guard::FinancialGuard>> {
        ensure!(
            !self.financial_configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        Ok(self.financial_guard.as_ref())
    }
    #[cfg(test)]
    pub(super) fn after_legacy_mode_once(
        &self,
        hook: impl FnOnce() -> Result<()> + Send + 'static,
    ) {
        *self.after_legacy_mode.lock() = Some(Box::new(hook));
    }
    async fn source_mode(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        guard: &crate::infrastructure::team_financial_guard::FinancialGuard,
        account: &crate::services::team_financial_ingress::Scope,
    ) -> Result<bool> {
        let mode = super::team_financial_transaction::source_mode(tx, guard, account).await?;
        #[cfg(test)]
        if !mode {
            let hook = self.after_legacy_mode.lock().take();
            if let Some(hook) = hook {
                hook()?;
            }
        }
        Ok(mode)
    }
    fn source_token(
        &self,
        account: &crate::services::team_financial_ingress::Scope,
    ) -> Result<Option<String>> {
        self.guard()?
            .map(|g| super::team_financial_inventory::account_source_token(g, account))
            .transpose()
    }
    fn unchanged(
        &self,
        account: &crate::services::team_financial_ingress::Scope,
        token: &Option<String>,
    ) -> Result<()> {
        ensure!(
            self.source_token(account)? == *token,
            "financial_source_changed_before_commit"
        );
        Ok(())
    }
    /// Writers not yet integrated with the typed coordinator must never mutate
    /// source-backed canonical state through the legacy rollout path.
    async fn legacy_only(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        account: &crate::services::team_financial_ingress::Scope,
    ) -> Result<Option<String>> {
        super::team_financial_ingress::require_authority(tx, account, self.guard()?).await?;
        let token = self.source_token(account)?;
        if let Some(guard) = self.guard()? {
            super::team_financial_ingress::ready(tx, guard, account).await?;
            ensure!(
                !self.source_mode(tx, guard, account).await?,
                "financial_customer_dispatch_integration_required"
            );
        }
        Ok(token)
    }
    async fn settle_request_history(
        &self,
        account: &crate::services::team_financial_ingress::Scope,
    ) -> Result<()> {
        let Some(guard) = self.guard()? else {
            return Ok(());
        };
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_ingress::lock(&tx, account).await?;
        let pending=guard.read()?.snapshot.transactions.groups.values().any(|g| !g.committed && g.proposal.account==*account && matches!(g.proposal.writer,Some(crate::services::team_financial_transaction::Writer::CustomerRecoveryAuthorization { .. } | crate::services::team_financial_transaction::Writer::CustomerRequest { .. } | crate::services::team_financial_transaction::Writer::CustomerLifecycle { .. } | crate::services::team_financial_transaction::Writer::CustomerResolution { .. })));
        if pending {
            super::team_financial_transaction::reconcile_customer_request_history(
                tx, guard, account,
            )
            .await?;
        } else {
            tx.rollback().await?;
        }
        Ok(())
    }
    pub(super) fn guard_for_resolution(
        &self,
    ) -> Result<Option<&crate::infrastructure::team_financial_guard::FinancialGuard>> {
        self.guard()
    }
    pub(super) fn postgres_for_resolution(&self) -> &PostgresClient {
        &self.pg
    }
    pub(super) async fn settle_resolution_history(
        &self,
        account: &crate::services::team_financial_ingress::Scope,
    ) -> Result<()> {
        self.settle_request_history(account).await
    }
    pub async fn request(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
        create: bool,
    ) -> Result<Option<CustomerStatus>> {
        ensure!(
            crate::services::team_stripe::id(account, "acct_"),
            "invalid account scope"
        );
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        self.settle_request_history(&scope).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_locks::organization(&tx, account, live, org).await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        super::team_financial_ingress::require_authority(&tx, &scope, self.guard()?).await?;
        let fence = self.source_token(&scope)?;
        if let Some(guard) = self.guard()? {
            super::team_financial_ingress::ready(&tx, guard, &scope).await?;
            if self.source_mode(&tx, guard, &scope).await? {
                let write = super::team_financial_transaction::NormalWrite::begin_organization(
                    tx, guard, &scope, org,
                )
                .await?;
                let (status, inserted) =
                    request_row(write.sql(), actor, org, account, live, create).await?;
                if let Some(row) = &status {
                    let at: DateTime<Utc> = row.get("created_at");
                    let view = status_view(row);
                    if inserted {
                        let accepted = crate::services::team_stripe_customer_request::Request::new(
                            crate::services::team_financial_source::Scope {
                                organization: org,
                                account: account.into(),
                                live,
                            },
                            row.get("operation_id"),
                            row.get("requested_by"),
                        )?
                        .accepted(at)?;

                        write.commit_customer_request(crate::services::team_financial_transaction::Writer::CustomerRequest {organization:org, request:accepted}).await?;
                    } else {
                        let source_scope = crate::services::team_financial_source::Scope {
                            organization: org,
                            account: account.into(),
                            live,
                        };
                        let original = super::team_stripe_customer_recovery::original(
                            guard,
                            &source_scope,
                            view.operation_id,
                        )?;
                        ensure!(
                            original.accepted_at == at,
                            "financial_customer_original_request_changed"
                        );
                        ensure!(
                            write.commit_operational(None).await?,
                            "financial_customer_request_unconfirmed"
                        );
                    }
                    return Ok(Some(view));
                }
                ensure!(
                    write.commit_operational(None).await?,
                    "financial_customer_request_unconfirmed"
                );
                return Ok(None);
            }
        }
        let (row, _) = request_row(&tx, actor, org, account, live, create).await?;
        let status = row.as_ref().map(status_view);
        self.unchanged(&scope, &fence)?;
        tx.commit().await?;
        Ok(status)
    }
    pub async fn authorize_recovery(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
        operation: Uuid,
        revision: i64,
    ) -> Result<()> {
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        self.settle_request_history(&scope).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_ingress::lock(&tx, &scope).await?;
        super::team_financial_ingress::require_authority(&tx, &scope, self.guard()?).await?;
        let fence = self.source_token(&scope)?;
        if let Some(guard) = self.guard()? {
            super::team_financial_ingress::ready(&tx, guard, &scope).await?;
            if self.source_mode(&tx, guard, &scope).await? {
                return super::team_stripe_customer_recovery::authorize(
                    self, tx, &scope, actor, org, operation, revision,
                )
                .await;
            }
        }
        super::team_financial_locks::organization(&tx, account, live, org).await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        let row=tx.query_opt("SELECT revision,disposition FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR UPDATE",&[&operation,&org,&account,&live]).await?;
        let row = row.ok_or(crate::services::team_insights::TeamError::NotFound)?;
        if row.get::<_, i64>(0) != revision
            || !["owner_changed", "recovery_required"].contains(&row.get::<_, String>(1).as_str())
        {
            return Err(crate::services::team_insights::TeamError::ProjectionChanged.into());
        }
        tx.execute("UPDATE team_stripe_customer_operations SET requested_by=$2,revision=revision+1,lookup_only=true,disposition='pending',lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&operation,&actor]).await?;
        tx.execute("INSERT INTO team_stripe_customer_authorizations(operation_id,revision,actor_id,action) VALUES($1,$2,$3,'reconcile_existing_customer')",&[&operation,&(revision+1),&actor]).await?;
        self.unchanged(&scope, &fence)?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn unresolved(&self, c: &CustomerClaim, reason: &str) -> Result<()> {
        ensure!(
            [
                "customer_not_found_unconfirmed",
                "customer_candidates_ambiguous",
                "customer_deleted"
            ]
            .contains(&reason),
            "unsupported recovery reason"
        );
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let scope = crate::services::team_financial_ingress::Scope {
            account: c.account_id.clone(),
            live: c.livemode,
        };
        super::team_financial_ingress::lock(&tx, &scope).await?;
        let fence = self.legacy_only(&tx, &scope).await?;
        super::team_financial_locks::organization(
            &tx,
            &c.account_id,
            c.livemode,
            c.organization_id,
        )
        .await?;
        tx.execute("UPDATE team_stripe_customer_operations SET revision=revision+1,disposition='recovery_required',last_error_code=$3,observed_at=clock_timestamp(),lease_id=NULL,lease_until=NULL WHERE operation_id=$1 AND lease_id=$2 AND lease_until>clock_timestamp() AND revision=$4 AND disposition='pending' AND organization_id=$5 AND account_id=$6 AND livemode=$7 AND requested_by=$8",&[&c.operation_id,&c.lease_id,&reason,&c.revision,&c.organization_id,&c.account_id,&c.livemode,&c.actor]).await?;
        self.unchanged(&scope, &fence)?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn claim(&self, account: &str, live: bool) -> Result<Option<CustomerClaim>> {
        let account_scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        self.settle_request_history(&account_scope).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        super::team_financial_ingress::lock(&tx, &scope).await?;
        super::team_financial_ingress::require_authority(&tx, &scope, self.guard()?).await?;
        let fence = self.source_token(&scope)?;
        if let Some(guard) = self.guard()? {
            super::team_financial_ingress::ready(&tx, guard, &scope).await?;
            if self.source_mode(&tx, guard, &scope).await? {
                return dispatch::claim(self, tx, &scope).await;
            }
        }
        super::team_financial_locks::account(&tx, account, live).await?;
        // Discover without row locks, then revalidate the exact candidate after
        // account/billing/owner locks. SKIP LOCKED alone cannot order owner locks.
        let candidate=tx.query_opt("SELECT operation_id,organization_id,requested_by FROM team_stripe_customer_operations WHERE account_id=$1 AND livemode=$2 AND disposition='pending' AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) ORDER BY retry_at,created_at,operation_id LIMIT 1",&[&account,&live]).await?;
        let Some(candidate) = candidate else {
            self.unchanged(&scope, &fence)?;
            tx.commit().await?;
            return Ok(None);
        };
        let operation: Uuid = candidate.get(0);
        let organization: Uuid = candidate.get(1);
        let initiator: Uuid = candidate.get(2);
        super::team_financial_locks::organization(&tx, account, live, organization).await?;
        let owner_allowed =
            match AuthorizationService::require_locked_billing_owner(&tx, initiator, organization)
                .await
            {
                Ok(()) => true,
                Err(e) if e.downcast_ref::<AuthorizationDenied>().is_some() => false,
                Err(e) => return Err(e),
            };
        let row=tx.query_opt("SELECT operation_id,organization_id,requested_by,first_attempt_at,revision,lookup_only,customer_id,created_at FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND requested_by=$3 AND account_id=$4 AND livemode=$5 AND disposition='pending' AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) FOR UPDATE",&[&operation,&organization,&initiator,&account,&live]).await?;
        let Some(r) = row else {
            self.unchanged(&scope, &fence)?;
            tx.commit().await?;
            return Ok(None);
        };
        let op: Uuid = r.get(0);
        let org = r.get(1);
        let actor = r.get(2);
        let first: Option<DateTime<Utc>> = r.get(3);
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let revision: i64 = r.get(4);
        let lookup_only: bool = r.get(5);
        let customer_id: Option<String> = r.get(6);
        let accepted_at: DateTime<Utc> = r.get(7);
        if self.guard()?.is_some() && !lookup_only {
            // Stable prerequisite, not a retryable provider/network failure.
            // Keep the request but do not start its first-attempt clock or lease.
            tx.execute("UPDATE team_stripe_customer_operations SET last_error_code='financial_customer_baseline_required' WHERE operation_id=$1",&[&op]).await?;
            self.unchanged(&scope, &fence)?;
            tx.commit().await?;
            return Ok(None);
        }
        // Stripe v1 may prune idempotency keys after 24h. Never blindly recreate after ambiguity.
        let mut stop = first
            .filter(|t| {
                !lookup_only && now.signed_duration_since(*t) >= chrono::Duration::hours(23)
            })
            .map(|_| ("recovery_required", "idempotency_window_unconfirmed"));
        if !owner_allowed {
            stop = Some(("owner_changed", "owner_authorization_changed"));
        }
        if let Some((state, reason)) = stop {
            tx.execute("UPDATE team_stripe_customer_operations SET revision=revision+1,disposition=$2,last_error_code=$3,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&op,&state,&reason]).await?;
            self.unchanged(&scope, &fence)?;
            tx.commit().await?;
            return Ok(None);
        }
        let lease = Uuid::now_v7();
        tx.execute("UPDATE team_stripe_customer_operations SET first_attempt_at=COALESCE(first_attempt_at,clock_timestamp()),lease_id=$2,lease_until=clock_timestamp()+interval '180 seconds',attempts=attempts+1 WHERE operation_id=$1",&[&op,&lease]).await?;
        self.unchanged(&scope, &fence)?;
        tx.commit().await?;
        let mut claim = CustomerClaim {
            operation_id: op,
            organization_id: org,
            actor,
            lease_id: lease,
            account_id: account.into(),
            livemode: live,
            revision,
            lookup_only,
            customer_id,
            financial: None,
        };
        let request = crate::services::team_stripe_customer_request::Request::new(
            crate::services::team_financial_source::Scope {
                organization: org,
                account: account.into(),
                live,
            },
            op,
            actor,
        )?
        .accepted(accepted_at)?;
        claim.financial = Some(dispatch::Proof::new(self, &claim, request, false)?);
        Ok(Some(claim))
    }
    pub async fn complete(&self, c: &CustomerClaim, customer: &str) -> Result<bool> {
        ensure!(
            crate::services::team_stripe::id(customer, "cus_"),
            "invalid customer proof"
        );
        if let Some(proof) = &c.financial {
            proof.same_authority(self.guard()?)?;
            // Retain before checking current Owner/lease/SQL existence. A durable
            // external observation does not itself authorize its projection.
            proof.retain(c, Some(customer), true)?;
            if proof.is_source() {
                return super::team_stripe_customer_resolution::complete(self, c, customer).await;
            }
        }
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let scope = crate::services::team_financial_ingress::Scope {
            account: c.account_id.clone(),
            live: c.livemode,
        };
        super::team_financial_ingress::lock(&tx, &scope).await?;
        let fence = self.legacy_only(&tx, &scope).await?;
        super::team_financial_locks::organization(
            &tx,
            &c.account_id,
            c.livemode,
            c.organization_id,
        )
        .await?;
        let allowed = match AuthorizationService::require_locked_billing_owner(
            &tx,
            c.actor,
            c.organization_id,
        )
        .await
        {
            Ok(()) => true,
            Err(e) if e.downcast_ref::<AuthorizationDenied>().is_some() => false,
            Err(e) => return Err(e),
        };
        let row=tx.query_opt("SELECT customer_id,lease_until FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND requested_by=$5 AND lease_id=$6 AND lease_until>clock_timestamp() AND disposition='pending' AND revision=$7 FOR UPDATE",&[&c.operation_id,&c.organization_id,&c.account_id,&c.livemode,&c.actor,&c.lease_id,&c.revision]).await?;
        let Some(row) = row else {
            self.unchanged(&scope, &fence)?;
            tx.commit().await?;
            return Ok(false);
        };
        ensure!(
            row.get::<_, Option<String>>(0)
                .as_deref()
                .is_none_or(|id| id == customer),
            "customer identity conflict"
        );
        let deadline: DateTime<Utc> = row.get(1);
        // Preserve even an orphaned provider result; it must not become a usable binding.
        tx.execute("UPDATE team_stripe_customer_operations SET revision=revision+1,customer_id=$2,disposition=$3,last_error_code=$4,observed_at=clock_timestamp(),lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&c.operation_id,&customer,&if allowed{"verified"}else{"owner_changed"},&if allowed{None}else{Some("owner_authorization_changed")}]).await?;
        let checked_at: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        if checked_at >= deadline {
            tx.rollback().await?;
            return Ok(false);
        }
        self.unchanged(&scope, &fence)?;
        tx.commit().await?;
        Ok(allowed)
    }
    pub async fn fail(&self, c: &CustomerClaim, e: &ProviderError) -> Result<()> {
        if c.financial.as_ref().is_some_and(|p| p.is_source()) {
            return dispatch::fail(self, c, e).await;
        }
        let retry = e.retry_after;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let scope = crate::services::team_financial_ingress::Scope {
            account: c.account_id.clone(),
            live: c.livemode,
        };
        super::team_financial_ingress::lock(&tx, &scope).await?;
        let fence = self.legacy_only(&tx, &scope).await?;
        super::team_financial_locks::organization(
            &tx,
            &c.account_id,
            c.livemode,
            c.organization_id,
        )
        .await?;
        tx.execute("UPDATE team_stripe_customer_operations SET retry_at=GREATEST(clock_timestamp()+make_interval(secs=>LEAST(3600,15*power(2,LEAST(attempts,8)))::double precision),COALESCE($3,clock_timestamp())),last_error_code=$4,last_http_status=$5,lease_id=NULL,lease_until=NULL WHERE operation_id=$1 AND lease_id=$2 AND lease_until>clock_timestamp() AND disposition='pending' AND organization_id=$6 AND account_id=$7 AND livemode=$8 AND requested_by=$9 AND revision=$10",&[&c.operation_id,&c.lease_id,&retry,&e.kind.code(),&e.status,&c.organization_id,&c.account_id,&c.livemode,&c.actor,&c.revision]).await?;
        self.unchanged(&scope, &fence)?;
        tx.commit().await?;
        Ok(())
    }
}

fn status_view(r: &tokio_postgres::Row) -> CustomerStatus {
    CustomerStatus {
        operation_id: r.get("operation_id"),
        disposition: r.get("disposition"),
        last_error_code: r.get("last_error_code"),
        observed_at: r.get("observed_at"),
        revision: r.get("revision"),
        retry_at: r.get("retry_at"),
        lookup_only: r.get("lookup_only"),
    }
}
async fn request_row(
    tx: &tokio_postgres::Transaction<'_>,
    actor: Uuid,
    org: Uuid,
    account: &str,
    live: bool,
    create: bool,
) -> Result<(Option<tokio_postgres::Row>, bool)> {
    let inserted = if create {
        // Fresh statement time, not transaction-start now(), is the immutable
        // acceptance boundary also retained in the independent request journal.
        let at: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        tx.execute("INSERT INTO team_stripe_customer_operations(operation_id,organization_id,requested_by,account_id,livemode,created_at,retry_at) VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT(organization_id,account_id,livemode) DO NOTHING",&[&Uuid::now_v7(),&org,&actor,&account,&live,&at]).await?==1
    } else {
        false
    };
    let row=tx.query_opt("SELECT * FROM team_stripe_customer_operations WHERE organization_id=$1 AND account_id=$2 AND livemode=$3",&[&org,&account,&live]).await?;
    Ok((row, inserted))
}
/// Exact immutable initial acceptance receipt, with no current Owner grant.
/// Missing SQL or a predecessor is never recreated by this read-only check.
pub(super) async fn committed_request(
    tx: &tokio_postgres::Transaction<'_>,
    account: &crate::services::team_financial_ingress::Scope,
    writer: &crate::services::team_financial_transaction::Writer,
) -> Result<()> {
    use crate::services::team_financial_transaction::{CustomerStage, Writer};
    let (organization, request, stage) = match writer {
        Writer::CustomerRequest {
            organization,
            request,
        } => (organization, request, None),
        Writer::CustomerLifecycle {
            organization,
            request,
            stage,
        } => (organization, request, Some(stage)),
        _ => anyhow::bail!("financial_transaction_writer_mismatch"),
    };
    let row=tx.query_opt("SELECT * FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4",&[&request.operation,organization,&account.account,&account.live]).await?.context("financial_customer_request_missing")?;
    let expected = crate::services::team_stripe_customer_request::Request::new(
        crate::services::team_financial_source::Scope {
            organization: *organization,
            account: account.account.clone(),
            live: account.live,
        },
        row.get("operation_id"),
        row.get("requested_by"),
    )?
    .accepted(row.get("created_at"))?;
    let first: Option<DateTime<Utc>> = row.get("first_attempt_at");
    let (revision, disposition) = match stage {
        None => {
            ensure!(first.is_none(), "financial_customer_request_conflict");
            (1, "pending")
        }
        Some(CustomerStage::FirstAttempt { first_attempt_at }) => {
            ensure!(
                first == Some(*first_attempt_at),
                "financial_customer_first_attempt_conflict"
            );
            (1, "pending")
        }
        Some(CustomerStage::Stop {
            first_attempt_at,
            owner_changed,
        }) => {
            ensure!(
                first == *first_attempt_at,
                "financial_customer_first_attempt_conflict"
            );
            (
                2,
                if *owner_changed {
                    "owner_changed"
                } else {
                    "recovery_required"
                },
            )
        }
    };
    ensure!(
        &expected == request
            && row.get::<_, i64>("revision") == revision
            && row.get::<_, String>("disposition") == disposition
            && !row.get::<_, bool>("lookup_only")
            && row.get::<_, Option<String>>("customer_id").is_none()
            && row.get::<_, Option<DateTime<Utc>>>("observed_at").is_none(),
        "financial_customer_request_conflict"
    );
    Ok(())
}

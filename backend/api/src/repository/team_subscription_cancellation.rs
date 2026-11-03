//! SQL acceptance, not provider mutation. Opaque preparation can be minted only
//! after a sealed current provider read and a matching SQL/source predecessor.
use crate::{
    infrastructure::{
        postgres::PostgresClient,
        team_financial_guard::{CommercialDeployment, FinancialGuard},
    },
    services::{
        authorization::AuthorizationService,
        team_financial_ingress::Scope as Account,
        team_financial_transaction::Writer,
        team_subscription_cancellation::{FrozenCancellation, ReadEvidence},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Duration, Utc};
use std::sync::Arc;
use uuid::Uuid;

/// Not Deserialize/Serialize/Clone; a caller cannot promote a request body or
/// ordinary metadata constructor into provider-read/Owner/source authority.
pub struct PreparedCancellation {
    request: FrozenCancellation,
    read: ReadEvidence,
    account_token: String,
    enrollment_token: String,
    seal: PreparationSeal,
}
impl PreparedCancellation {
    pub(crate) async fn recheck(&self) -> Result<()> {
        match &self.seal {
            PreparationSeal::Provider(proof) => proof.recheck(None).await,
            #[cfg(test)]
            PreparationSeal::Synthetic => Ok(()),
        }
    }
}
enum PreparationSeal {
    Provider(Box<CancellationReadProof>),
    #[cfg(test)]
    Synthetic,
}
#[path = "team_subscription_cancellation_preparation.rs"]
mod preparation;
pub use preparation::CancellationReadProof;
#[path = "team_subscription_cancellation_status.rs"]
mod status;
pub use status::SavedCancellation;
#[path = "team_subscription_cancellation_control.rs"]
mod control;
pub(super) use control::committed_lifecycle;
#[path = "team_subscription_cancellation_dispatch.rs"]
mod dispatch;
pub use dispatch::{CancellationClaim, CancellationExchangeProof};
#[path = "team_subscription_cancellation_projection.rs"]
mod projection;
pub(super) use projection::committed_projection;
#[derive(Clone)]
pub struct CancellationRepository {
    pg: Arc<PostgresClient>,
    deployment: CommercialDeployment,
}
impl CancellationRepository {
    pub fn new(pg: Arc<PostgresClient>, deployment: CommercialDeployment) -> Self {
        Self { pg, deployment }
    }
    fn guard(&self) -> Result<&FinancialGuard> {
        let current = CommercialDeployment::required_from_environment()?;
        ensure!(
            current.guard().same_authority(self.deployment.guard()),
            "financial_guard_configuration_changed"
        );
        Ok(self.deployment.guard())
    }
    /// Confirm only a retained typed SQL next state. No predecessor replay,
    /// provider request, Owner grant or missing-ledger initialization occurs.
    pub async fn reconcile_history(&self, account: &Account) -> Result<()> {
        account.key()?;
        let guard = self.guard()?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::team_financial_ingress::lock(&tx, account).await?;
        if guard
            .read()?
            .snapshot
            .transactions
            .groups
            .values()
            .any(|g| !g.committed && g.proposal.account == *account)
        {
            super::team_financial_transaction::reconcile_account_history(tx, guard, account)
                .await?;
        } else {
            tx.rollback().await?;
        }
        Ok(())
    }
    /// Still not exposed by a runtime route. A production preparation must keep
    /// its sealed provider-read proof through acceptance and final precommit.
    pub async fn accept(&self, prepared: PreparedCancellation) -> Result<FrozenCancellation> {
        let PreparedCancellation {
            request,
            read,
            account_token,
            enrollment_token,
            seal,
        } = prepared;
        match &seal {
            PreparationSeal::Provider(proof) => {
                proof.validate_prepared(self, &request, &read)?;
                proof.recheck(None).await?;
            }
            #[cfg(test)]
            PreparationSeal::Synthetic => {}
        }
        read.validate(&request)?;
        let scope = request.scope();
        let account = Account {
            account: scope.account.clone(),
            live: scope.live,
        };
        self.reconcile_history(&account).await?;
        let guard = self.guard()?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::team_financial_locks::organization(
            &tx,
            &account.account,
            account.live,
            scope.organization,
        )
        .await?;
        AuthorizationService::require_locked_billing_owner(
            &tx,
            request.actor(),
            scope.organization,
        )
        .await?;
        ensure!(
            tx.query_opt(
                "SELECT 1 FROM team_rollouts WHERE organization_id=$1 AND enabled FOR SHARE",
                &[&scope.organization]
            )
            .await?
            .is_some(),
            crate::services::team_insights::TeamError::Disabled
        );
        super::team_financial_ingress::require_authority(&tx, &account, Some(guard)).await?;
        ensure!(
            super::team_financial_transaction::source_mode(&tx, guard, &account).await?,
            "cancellation_source_evidence_required"
        );
        ensure!(
            super::team_financial_inventory::account_source_token(guard, &account)?
                == account_token
                && guard.read()?.organization_token(scope.organization)? == enrollment_token,
            "cancellation_preparation_changed"
        );
        let write = super::team_financial_transaction::NormalWrite::begin_customer(
            tx,
            guard,
            &account,
            scope.organization,
            request.customer(),
        )
        .await?;
        if let Some(row) = write
            .sql()
            .query_opt(
                "SELECT * FROM team_subscription_cancellations WHERE operation_id=$1 FOR UPDATE",
                &[&request.operation()],
            )
            .await?
        {
            let original = decode(&row)?;
            ensure!(
                original.same_intent(&request),
                "cancellation_operation_identity_conflict"
            );
            verify_initial_history(
                write.sql(),
                &original,
                &row.get::<_, serde_json::Value>("read_evidence"),
            )
            .await?;
            ensure!(
                guard
                    .read()?
                    .snapshot
                    .sources
                    .scopes
                    .get(&scope.key()?)
                    .and_then(|e| e.accepted.get(&original.operation()))
                    == Some(&original.accepted_request()?),
                "cancellation_original_acceptance_unconfirmed"
            );
            ensure!(
                write
                    .commit_read_before(read.valid_until.min(request.period_end()))
                    .await?,
                "cancellation_preparation_expired"
            );
            return Ok(original);
        }
        // The normal source check happens before any insert. A duplicate UUID
        // outside this scope is a conflict and cannot overwrite another account.
        ensure!(
            !crate::services::team_financial_transaction::operation_known(
                &guard.read()?.snapshot,
                request.operation()
            ),
            "cancellation_operation_already_retained"
        );
        ensure!(!write.sql().query_one("SELECT EXISTS(SELECT 1 FROM team_subscription_cancellations WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND disposition NOT IN ('effective','withdrawn'))",&[&account.account,&account.live,&request.subscription()]).await?.get::<_,bool>(0),
            "cancellation_subscription_reserved");
        ensure!(!write.sql().query_one("SELECT EXISTS(SELECT 1 FROM team_stripe_checkout_intents WHERE organization_id=$1 AND disposition NOT IN ('expired','bound'))",&[&scope.organization]).await?.get::<_,bool>(0),
            "cancellation_other_purchase_unresolved");
        let now: DateTime<Utc> = write
            .sql()
            .query_one("SELECT clock_timestamp()", &[])
            .await?
            .get(0);
        ensure!(
            request.accepted_at() <= now && now < read.valid_until && now < request.period_end(),
            "cancellation_preparation_expired"
        );
        verify_basis(write.sql(), &request, &read, now).await?;
        match &seal {
            PreparationSeal::Provider(_) => {
                crate::services::team_subscription_cancellation::require_enabled()?;
                self.guard()?;
            }
            #[cfg(test)]
            PreparationSeal::Synthetic => {}
        }
        let accepted = request.accepted_request()?;
        let frozen = serde_json::to_value(&request)?;
        let read_json = serde_json::to_value(&read)?;
        let read_hash = read.digest(&request)?;
        write.sql().execute("INSERT INTO team_subscription_cancellations(operation_id,organization_id,account_id,livemode,actor_id,customer_id,subscription_id,frozen_request,request_sha256,idempotency_sha256,read_evidence,read_sha256,accepted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
            &[&request.operation(),&scope.organization,&scope.account,&scope.live,&request.actor(),&request.customer(),&request.subscription(),&frozen,&accepted.request_hash,&accepted.idempotency_hash,&read_json,&read_hash,&request.accepted_at()]).await?;
        write.sql().execute("INSERT INTO team_subscription_cancellation_authorizations(operation_id,revision,actor_id,authorized_at,action) VALUES($1,1,$2,$3,'request_cancel_at_period_end')",&[&request.operation(),&request.actor(),&request.accepted_at()]).await?;
        let audit_hash = audit_hash(&request, &read)?;
        write.sql().execute("INSERT INTO team_subscription_cancellation_audit(operation_id,revision,actor_id,action,recorded_at,metadata_hash) VALUES($1,1,$2,'request_cancel_at_period_end',$3,$4)",&[&request.operation(),&request.actor(),&request.accepted_at(),&audit_hash]).await?;
        write
            .commit_cancellation_request(
                Writer::CancellationRequest {
                    request: request.clone(),
                    read: read.clone(),
                },
                read.valid_until.min(request.period_end()),
            )
            .await?;
        Ok(request)
    }
}
fn decode(row: &tokio_postgres::Row) -> Result<FrozenCancellation> {
    let request: FrozenCancellation = serde_json::from_value(row.get("frozen_request"))
        .map_err(|_| anyhow::anyhow!("cancellation_sql_contract_invalid"))?;
    request.validate()?;
    let read: ReadEvidence = serde_json::from_value(row.get("read_evidence"))
        .map_err(|_| anyhow::anyhow!("cancellation_sql_contract_invalid"))?;
    read.validate(&request)?;
    let accepted = request.accepted_request()?;
    ensure!(
        row.get::<_, Uuid>("operation_id") == request.operation()
            && row.get::<_, Uuid>("organization_id") == request.scope().organization
            && row.get::<_, String>("account_id") == request.scope().account
            && row.get::<_, bool>("livemode") == request.scope().live
            && row.get::<_, Uuid>("actor_id") == request.actor()
            && row.get::<_, String>("customer_id") == request.customer()
            && row.get::<_, String>("subscription_id") == request.subscription()
            && row.get::<_, String>("request_sha256") == accepted.request_hash
            && row.get::<_, String>("idempotency_sha256") == accepted.idempotency_hash
            && row.get::<_, String>("read_sha256") == read.digest(&request)?
            && row.get::<_, DateTime<Utc>>("accepted_at") == request.accepted_at(),
        "cancellation_sql_contract_changed"
    );
    Ok(request)
}
fn audit_hash(request: &FrozenCancellation, read: &ReadEvidence) -> Result<String> {
    crate::services::team_financial_guard::fingerprint(&(
        "request_cancel_at_period_end_v1",
        request,
        read,
    ))
}
async fn verify_initial_history(
    tx: &tokio_postgres::Transaction<'_>,
    request: &FrozenCancellation,
    read_json: &serde_json::Value,
) -> Result<()> {
    let read: ReadEvidence = serde_json::from_value(read_json.clone())
        .map_err(|_| anyhow::anyhow!("cancellation_sql_contract_invalid"))?;
    read.validate(request)?;
    ensure!(tx.query_opt("SELECT 1 FROM team_subscription_cancellation_authorizations WHERE operation_id=$1 AND revision=1 AND actor_id=$2 AND authorized_at=$3 AND action='request_cancel_at_period_end' FOR SHARE",&[&request.operation(),&request.actor(),&request.accepted_at()]).await?.is_some(),"cancellation_authorization_missing_or_changed");
    ensure!(tx.query_opt("SELECT 1 FROM team_subscription_cancellation_audit WHERE operation_id=$1 AND revision=1 AND actor_id=$2 AND recorded_at=$3 AND action='request_cancel_at_period_end' AND metadata_hash=$4 FOR SHARE",&[&request.operation(),&request.actor(),&request.accepted_at(),&audit_hash(request,&read)?]).await?.is_some(),"cancellation_audit_missing_or_changed");
    Ok(())
}
async fn verify_basis(
    tx: &tokio_postgres::Transaction<'_>,
    request: &FrozenCancellation,
    read: &ReadEvidence,
    now: DateTime<Utc>,
) -> Result<()> {
    let scope = request.scope();
    let row=tx.query_opt("SELECT b.account_id,b.livemode,b.customer_id,b.subscription_id,b.revision,b.enabled,s.binding_revision,s.source_revision,s.subscription_item_id,s.price_id,s.currency,s.amount_minor,s.quantity,s.period_start,s.period_end,s.items_complete,s.cancel_at_period_end,s.observed_at,j.requested_revision,j.applied_revision,s.provider_status FROM team_stripe_bindings b JOIN team_stripe_snapshots s ON s.organization_id=b.organization_id JOIN team_stripe_reconcile_jobs j ON j.account_id=b.account_id AND j.livemode=b.livemode AND j.subscription_id=b.subscription_id WHERE b.organization_id=$1 FOR SHARE OF b,s,j",&[&scope.organization]).await?.context("cancellation_canonical_snapshot_missing")?;
    let observed: DateTime<Utc> = row.get(17);
    ensure!(
        row.get::<_, String>(0) == scope.account
            && row.get::<_, bool>(1) == scope.live
            && row.get::<_, String>(2) == request.customer()
            && row.get::<_, String>(3) == request.subscription()
            && row.get::<_, i64>(4) == request.binding_revision()
            && row.get::<_, bool>(5)
            && row.get::<_, i64>(6) == request.binding_revision()
            && row.get::<_, i64>(7) == request.source_revision()
            && row.get::<_, Option<String>>(8).as_deref() == Some(request.item())
            && row.get::<_, Option<String>>(9).as_deref() == Some(request.price())
            && row.get::<_, Option<String>>(10).as_deref() == Some(request.currency())
            && row.get::<_, Option<i64>>(11) == Some(request.amount_minor())
            && row.get::<_, Option<i64>>(12) == Some(1)
            && row.get::<_, Option<DateTime<Utc>>>(13) == Some(request.period_start())
            && row.get::<_, Option<DateTime<Utc>>>(14) == Some(request.period_end())
            && row.get::<_, bool>(15)
            && !row.get::<_, bool>(16)
            && observed <= read.observed_at
            && observed <= now
            && now - observed < Duration::minutes(5)
            && row.get::<_, i64>(18) == request.source_revision()
            && row.get::<_, i64>(19) == request.source_revision()
            && row.get::<_, String>(20) == read.subscription.status,
        "cancellation_canonical_predecessor_changed"
    );
    // Lifecycle/schedule fields are proved by the sealed read, not these older
    // snapshot columns. This comparison must never be used to mint that proof.
    read.validate(request)
}
/// Exact SQL-next verification only. Historical confirmation does not require
/// current Owner permissions, which a new product read must check separately.
pub(super) async fn committed_request(
    tx: &tokio_postgres::Transaction<'_>,
    account: &Account,
    writer: &Writer,
) -> Result<()> {
    let Writer::CancellationRequest { request, read } = writer else {
        anyhow::bail!("financial_transaction_writer_mismatch")
    };
    ensure!(
        request.scope().account == account.account && request.scope().live == account.live,
        "cancellation_writer_scope_changed"
    );
    let row = tx
        .query_opt(
            "SELECT * FROM team_subscription_cancellations WHERE operation_id=$1 FOR SHARE",
            &[&request.operation()],
        )
        .await?
        .context("cancellation_committed_request_missing")?;
    ensure!(
        decode(&row)? == *request
            && row.get::<_, serde_json::Value>("read_evidence") == serde_json::to_value(read)?
            && row.get::<_, i64>("revision") == 1
            && row.get::<_, String>("disposition") == "pending"
            && row
                .get::<_, Option<DateTime<Utc>>>("first_attempt_at")
                .is_none()
            && row.get::<_, Option<Uuid>>("recovery_actor").is_none()
            && !row.get::<_, bool>("read_only")
            && row.get::<_, Option<Uuid>>("last_observation_id").is_none()
            && row.get::<_, Option<DateTime<Utc>>>("observed_at").is_none(),
        "cancellation_committed_request_changed"
    );
    verify_initial_history(tx, request, &serde_json::to_value(read)?).await
}

#[cfg(test)]
#[path = "team_subscription_cancellation_tests.rs"]
mod tests;

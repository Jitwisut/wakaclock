//! Server-owned customer creation receipts. Never binds caller-supplied provider IDs.
use crate::{
    infrastructure::{postgres::PostgresClient, stripe::ProviderError},
    services::authorization::{AuthorizationDenied, AuthorizationService},
};
use anyhow::{ensure, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;
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
}
pub struct CustomerRepository {
    pg: Arc<PostgresClient>,
}
impl CustomerRepository {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        Self { pg }
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
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        if create {
            tx.execute("INSERT INTO team_stripe_customer_operations(operation_id,organization_id,requested_by,account_id,livemode) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,account_id,livemode) DO NOTHING",&[&Uuid::now_v7(),&org,&actor,&account,&live]).await?;
        }
        let row=tx.query_opt("SELECT operation_id,disposition,last_error_code,observed_at,revision,retry_at,lookup_only FROM team_stripe_customer_operations WHERE organization_id=$1 AND account_id=$2 AND livemode=$3",&[&org,&account,&live]).await?;
        let status = row.map(|r| CustomerStatus {
            operation_id: r.get(0),
            disposition: r.get(1),
            last_error_code: r.get(2),
            observed_at: r.get(3),
            revision: r.get(4),
            retry_at: r.get(5),
            lookup_only: r.get(6),
        });
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
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
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
        self.pg.execute("UPDATE team_stripe_customer_operations SET revision=revision+1,disposition='recovery_required',last_error_code=$3,observed_at=clock_timestamp(),lease_id=NULL,lease_until=NULL WHERE operation_id=$1 AND lease_id=$2 AND lease_until>now() AND revision=$4 AND disposition='pending'",&[&c.operation_id,&c.lease_id,&reason,&c.revision]).await?;
        Ok(())
    }
    pub async fn claim(&self, account: &str, live: bool) -> Result<Option<CustomerClaim>> {
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let row=tx.query_opt("SELECT operation_id,organization_id,requested_by,first_attempt_at,clock_timestamp() AS observed,revision,lookup_only,customer_id FROM team_stripe_customer_operations WHERE account_id=$1 AND livemode=$2 AND disposition='pending' AND retry_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY retry_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1",&[&account,&live]).await?;
        let Some(r) = row else {
            tx.commit().await?;
            return Ok(None);
        };
        let op: Uuid = r.get(0);
        let org = r.get(1);
        let actor = r.get(2);
        let first: Option<DateTime<Utc>> = r.get(3);
        let now: DateTime<Utc> = r.get(4);
        let revision: i64 = r.get(5);
        let lookup_only: bool = r.get(6);
        let customer_id: Option<String> = r.get(7);
        // Stripe v1 may prune idempotency keys after 24h. Never blindly recreate after ambiguity.
        let mut stop = first
            .filter(|t| {
                !lookup_only && now.signed_duration_since(*t) >= chrono::Duration::hours(23)
            })
            .map(|_| ("recovery_required", "idempotency_window_unconfirmed"));
        if let Err(e) = AuthorizationService::require_locked_billing_owner(&tx, actor, org).await {
            if e.downcast_ref::<AuthorizationDenied>().is_none() {
                return Err(e);
            }
            stop = Some(("owner_changed", "owner_authorization_changed"));
        }
        if let Some((state, reason)) = stop {
            tx.execute("UPDATE team_stripe_customer_operations SET revision=revision+1,disposition=$2,last_error_code=$3,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&op,&state,&reason]).await?;
            tx.commit().await?;
            return Ok(None);
        }
        let lease = Uuid::now_v7();
        tx.execute("UPDATE team_stripe_customer_operations SET first_attempt_at=COALESCE(first_attempt_at,clock_timestamp()),lease_id=$2,lease_until=now()+interval '180 seconds',attempts=attempts+1 WHERE operation_id=$1",&[&op,&lease]).await?;
        tx.commit().await?;
        Ok(Some(CustomerClaim {
            operation_id: op,
            organization_id: org,
            actor,
            lease_id: lease,
            account_id: account.into(),
            livemode: live,
            revision,
            lookup_only,
            customer_id,
        }))
    }
    pub async fn complete(&self, c: &CustomerClaim, customer: &str) -> Result<bool> {
        ensure!(
            crate::services::team_stripe::id(customer, "cus_"),
            "invalid customer proof"
        );
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let row=tx.query_opt("SELECT customer_id FROM team_stripe_customer_operations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND requested_by=$5 AND lease_id=$6 AND lease_until>now() AND disposition='pending' AND revision=$7 FOR UPDATE",&[&c.operation_id,&c.organization_id,&c.account_id,&c.livemode,&c.actor,&c.lease_id,&c.revision]).await?;
        let Some(row) = row else {
            tx.commit().await?;
            return Ok(false);
        };
        ensure!(
            row.get::<_, Option<String>>(0)
                .as_deref()
                .is_none_or(|id| id == customer),
            "customer identity conflict"
        );
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
        // Preserve even an orphaned provider result; it must not become a usable binding.
        tx.execute("UPDATE team_stripe_customer_operations SET revision=revision+1,customer_id=$2,disposition=$3,last_error_code=$4,observed_at=clock_timestamp(),lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&c.operation_id,&customer,&if allowed{"verified"}else{"owner_changed"},&if allowed{None}else{Some("owner_authorization_changed")}]).await?;
        tx.commit().await?;
        Ok(allowed)
    }
    pub async fn fail(&self, c: &CustomerClaim, e: &ProviderError) -> Result<()> {
        let retry = e.retry_after;
        self.pg.execute("UPDATE team_stripe_customer_operations SET retry_at=GREATEST(now()+make_interval(secs=>LEAST(3600,15*power(2,LEAST(attempts,8)))::double precision),COALESCE($3,now())),last_error_code=$4,last_http_status=$5,lease_id=NULL,lease_until=NULL WHERE operation_id=$1 AND lease_id=$2 AND lease_until>now() AND disposition='pending'",&[&c.operation_id,&c.lease_id,&retry,&e.kind.code(),&e.status]).await?;
        Ok(())
    }
}

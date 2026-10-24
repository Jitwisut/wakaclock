//! Durable financial metadata; observations alone do not grant analytics access.
use crate::{
    infrastructure::postgres::PostgresClient,
    services::team_stripe::{Event, Snapshot},
};
use anyhow::{ensure, Result};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, PartialEq)]
pub enum Acceptance {
    Accepted,
    Duplicate,
}
#[derive(Debug, Clone)]
pub struct Claim {
    pub account_id: String,
    pub livemode: bool,
    pub subscription_id: String,
    pub revision: i64,
    pub lease_id: Uuid,
    pub organization_id: Uuid,
    pub binding_revision: i64,
    pub customer_id: String,
}
#[derive(Debug, Clone, Copy)]
pub enum Failure {
    Network,
    Provider,
    RateLimited,
    Auth,
    Permission,
    NotFound,
    InvalidContract,
    ScopeMismatch,
    ObservationChanged,
}
impl Failure {
    pub(crate) fn code(self) -> &'static str {
        match self {
            Self::Network => "network",
            Self::Provider => "provider_unavailable",
            Self::RateLimited => "rate_limited",
            Self::Auth => "auth_required",
            Self::Permission => "permission_required",
            Self::NotFound => "subscription_unconfirmed",
            Self::InvalidContract => "unsupported_contract",
            Self::ScopeMismatch => "provider_scope_mismatch",
            Self::ObservationChanged => "observation_changed",
        }
    }
}
#[derive(Clone)]
pub struct TeamStripeRepository {
    pg: Arc<PostgresClient>,
    guard: Option<crate::infrastructure::team_financial_guard::FinancialObservation>,
    guard_configuration_error: bool,
}
impl TeamStripeRepository {
    fn ingress_guard(
        &self,
    ) -> Result<Option<&crate::infrastructure::team_financial_guard::FinancialGuard>> {
        ensure!(
            !self.guard_configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        Ok(self.guard.as_ref().and_then(|g| g.guard()))
    }
    pub(crate) fn checkouts(&self) -> super::team_stripe_checkout::CheckoutRepository {
        super::team_stripe_checkout::CheckoutRepository::with_financial_authority(
            self.pg.clone(),
            self.guard.as_ref().and_then(|g| g.guard()).cloned(),
            self.guard_configuration_error,
        )
    }
    pub(crate) fn customers(&self) -> super::team_stripe_customer::CustomerRepository {
        super::team_stripe_customer::CustomerRepository::new(self.pg.clone())
    }
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        match crate::infrastructure::team_financial_guard::FinancialObservation::from_environment()
        {
            Ok(guard) => Self {
                pg,
                guard: Some(guard),
                guard_configuration_error: false,
            },
            Err(_) => Self {
                pg,
                guard: None,
                guard_configuration_error: true,
            },
        }
    }
    pub fn new_guarded(
        pg: Arc<PostgresClient>,
        guard: crate::infrastructure::team_financial_guard::CommercialDeployment,
    ) -> Self {
        Self {
            pg,
            guard: Some(guard.observation()),
            guard_configuration_error: false,
        }
    }
    /// Called only after signature/account/mode validation. Commit is the ACK boundary.
    pub async fn accept(&self, event: &Event, hash: &str) -> Result<Acceptance> {
        ensure!(
            hash.len() == 64 && hash.bytes().all(|c| c.is_ascii_hexdigit()),
            "invalid event digest"
        );
        let scope = crate::services::team_financial_ingress::Scope {
            account: event.account_id.clone(),
            live: event.livemode,
        };
        if let Some(guard) = self.ingress_guard()? {
            let notification =
                crate::services::team_financial_ingress::Notification::new(event, hash)?;
            return super::team_financial_ingress::accept(&self.pg, guard, &scope, notification)
                .await;
        }
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_ingress::lock(&tx, &scope).await?;
        let inserted=tx.execute("INSERT INTO team_stripe_inbox(account_id,livemode,event_id,payload_hash,event_kind,event_created,customer_id,subscription_id,invoice_id,disposition) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
            &[&event.account_id,&event.livemode,&event.event_id,&hash,&event.kind,&event.created,&event.customer_id,&event.subscription_id,&event.invoice_id,&if event.supported {"pending"} else {"ignored"}]).await?;
        if inserted == 0 {
            let prior:String=tx.query_one("SELECT payload_hash FROM team_stripe_inbox WHERE account_id=$1 AND livemode=$2 AND event_id=$3",&[&event.account_id,&event.livemode,&event.event_id]).await?.get(0);
            ensure!(prior == hash, "event identity conflict");
            tx.commit().await?;
            return Ok(Acceptance::Duplicate);
        }
        if event.supported {
            let sub = event
                .subscription_id
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("subscription identity missing"))?;
            let rev:i64=tx.query_one("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id) VALUES($1,$2,$3) ON CONFLICT(account_id,livemode,subscription_id) DO UPDATE SET requested_revision=team_stripe_reconcile_jobs.requested_revision+1 RETURNING requested_revision",&[&event.account_id,&event.livemode,sub]).await?.get(0);
            // A fresh event never clears a Retry-After deadline or an outstanding lease.
            tx.execute("UPDATE team_stripe_inbox SET requested_revision=$4 WHERE account_id=$1 AND livemode=$2 AND event_id=$3",&[&event.account_id,&event.livemode,&event.event_id,&rev]).await?;
        }
        tx.commit().await?;
        Ok(Acceptance::Accepted)
    }
    /// Idle reconciliation repairs missed notifications; never accumulates work every poll.
    pub async fn schedule_bound(&self, account: &str, live: bool) -> Result<u64> {
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_ingress::lock(&tx, &scope).await?;
        if let Some(guard) = self.ingress_guard()? {
            super::team_financial_ingress::ready(&tx, guard, &scope).await?;
        }
        let count=tx.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id)
            SELECT account_id,livemode,subscription_id FROM team_stripe_bindings WHERE enabled AND account_id=$1 AND livemode=$2
            ON CONFLICT(account_id,livemode,subscription_id) DO UPDATE SET requested_revision=team_stripe_reconcile_jobs.requested_revision+1
            WHERE team_stripe_reconcile_jobs.requested_revision=team_stripe_reconcile_jobs.applied_revision AND (team_stripe_reconcile_jobs.last_success_at IS NULL OR team_stripe_reconcile_jobs.last_success_at < now()-interval '5 minutes')",
            &[&account,&live]).await?;
        tx.commit().await?;
        Ok(count)
    }
    /// The database transaction finishes before any provider HTTP request starts.
    pub async fn claim(&self, account: &str, live: bool) -> Result<Option<Claim>> {
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        super::team_financial_ingress::lock(&tx, &scope).await?;
        if let Some(guard) = self.ingress_guard()? {
            super::team_financial_ingress::ready(&tx, guard, &scope).await?;
        }
        let row=tx.query_opt("SELECT j.subscription_id,j.requested_revision FROM team_stripe_reconcile_jobs j
            WHERE j.account_id=$1 AND j.livemode=$2 AND j.requested_revision>j.applied_revision AND j.retry_at<=clock_timestamp()
              AND (j.lease_until IS NULL OR j.lease_until<=clock_timestamp())
              AND EXISTS(SELECT 1 FROM team_stripe_bindings b WHERE b.account_id=j.account_id AND b.livemode=j.livemode AND b.subscription_id=j.subscription_id AND b.enabled)
            ORDER BY j.retry_at,j.subscription_id FOR UPDATE OF j SKIP LOCKED LIMIT 1",&[&account,&live]).await?;
        let Some(row) = row else {
            tx.commit().await?;
            return Ok(None);
        };
        let sub: String = row.get(0);
        let revision: i64 = row.get(1);
        let binding=tx.query_opt("SELECT organization_id,revision,customer_id FROM team_stripe_bindings WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND enabled FOR SHARE",&[&account,&live,&sub]).await?;
        let Some(binding) = binding else {
            tx.commit().await?;
            return Ok(None);
        };
        let lease_id = Uuid::now_v7();
        tx.execute("UPDATE team_stripe_reconcile_jobs SET lease_id=$4,lease_until=clock_timestamp()+interval '180 seconds' WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3",&[&account,&live,&sub,&lease_id]).await?;
        let claim = Claim {
            account_id: account.into(),
            livemode: live,
            subscription_id: sub,
            revision,
            lease_id,
            organization_id: binding.get(0),
            binding_revision: binding.get(1),
            customer_id: binding.get(2),
        };
        tx.commit().await?;
        Ok(Some(claim))
    }
    /// CAS rejects a response fetched under an old lease, binding or event revision.
    pub async fn complete(&self, claim: &Claim, snapshot: &Snapshot) -> Result<bool> {
        self.complete_observation(claim, snapshot, None).await
    }
    pub async fn complete_observation(
        &self,
        claim: &Claim,
        snapshot: &Snapshot,
        invoice: Option<&crate::services::team_stripe_invoice::Invoice>,
    ) -> Result<bool> {
        ensure!(
            !self.guard_configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        if let Some(i) = invoice {
            ensure!(
                snapshot.latest_invoice_id.as_deref() == Some(&i.invoice_id)
                    && i.customer_id == claim.customer_id
                    && i.subscription_id == claim.subscription_id
                    && i.livemode == claim.livemode,
                "invoice identity conflict"
            );
        }
        ensure!(
            snapshot.subscription_id == claim.subscription_id
                && snapshot.customer_id == claim.customer_id,
            "snapshot identity conflict"
        );
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let scope = crate::services::team_financial_ingress::Scope {
            account: claim.account_id.clone(),
            live: claim.livemode,
        };
        super::team_financial_ingress::lock(&tx, &scope).await?;
        if let Some(guard) = self.ingress_guard()? {
            super::team_financial_ingress::ready(&tx, guard, &scope).await?;
        }
        super::team_seats::lock(&tx, claim.organization_id).await?;
        let row=tx.query_opt("SELECT requested_revision,lease_until FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND lease_id=$4 AND lease_until>clock_timestamp() FOR UPDATE",&[&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.lease_id]).await?;
        let Some(row) = row else {
            tx.commit().await?;
            return Ok(false);
        };
        let binding=tx.query_opt("SELECT revision FROM team_stripe_bindings WHERE organization_id=$1 AND account_id=$2 AND livemode=$3 AND subscription_id=$4 AND customer_id=$5 AND enabled FOR SHARE",&[&claim.organization_id,&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.customer_id]).await?;
        let checked_at: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let valid = row.get::<_, i64>(0) == claim.revision
            && row.get::<_, DateTime<Utc>>(1) > checked_at
            && binding.is_some_and(|b| b.get::<_, i64>(0) == claim.binding_revision);
        if !valid {
            tx.execute("UPDATE team_stripe_reconcile_jobs SET lease_id=NULL,lease_until=NULL WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND lease_id=$4",&[&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.lease_id]).await?;
            tx.commit().await?;
            return Ok(false);
        }
        // Preserve provider evidence; no entitlement is inferred from a checkout redirect or this snapshot.
        let failure:Option<DateTime<Utc>>=tx.query_one("SELECT min(event_created) FROM team_stripe_inbox WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND invoice_id=$4 AND event_kind='invoice.payment_failed'",&[&claim.account_id,&claim.livemode,&claim.subscription_id,&snapshot.latest_invoice_id]).await?.get(0);
        tx.execute("INSERT INTO team_stripe_snapshots(organization_id,binding_revision,source_revision,provider_status,period_start,period_end,trial_end,cancel_at_period_end,latest_invoice_id,first_payment_failure_at,price_id,currency,amount_minor,quantity,items_complete,observed_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            ON CONFLICT(organization_id) DO UPDATE SET binding_revision=EXCLUDED.binding_revision,source_revision=EXCLUDED.source_revision,provider_status=EXCLUDED.provider_status,period_start=EXCLUDED.period_start,period_end=EXCLUDED.period_end,trial_end=EXCLUDED.trial_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,latest_invoice_id=EXCLUDED.latest_invoice_id,first_payment_failure_at=EXCLUDED.first_payment_failure_at,price_id=EXCLUDED.price_id,currency=EXCLUDED.currency,amount_minor=EXCLUDED.amount_minor,quantity=EXCLUDED.quantity,items_complete=EXCLUDED.items_complete,observed_at=EXCLUDED.observed_at",
            &[&claim.organization_id,&claim.binding_revision,&claim.revision,&snapshot.status,&snapshot.period_start,&snapshot.period_end,&snapshot.trial_end,&snapshot.cancel_at_period_end,&snapshot.latest_invoice_id,&failure,&snapshot.price_id,&snapshot.currency,&snapshot.amount_minor,&snapshot.quantity,&snapshot.items_complete,&snapshot.observed_at]).await?;
        // Read accepted terms under the same binding/job transaction as the snapshot.
        let package = tx.query_opt("SELECT q.package_seats,q.price_id,q.currency,q.amount_minor FROM team_stripe_checkout_intents c JOIN team_stripe_quotes q ON q.id=c.quote_id WHERE c.organization_id=$1 AND c.account_id=$2 AND c.livemode=$3 AND c.subscription_id=$4 AND c.disposition='bound' AND q.organization_id=c.organization_id AND q.account_id=c.account_id AND q.livemode=c.livemode AND q.customer_id=$5 FOR SHARE OF c,q", &[&claim.organization_id,&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.customer_id]).await?
            .map(|r| crate::services::team_stripe_payment::AcceptedPackage { seats:r.get(0),price:r.get(1),currency:r.get(2),amount_minor:r.get(3) });
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let assessment =
            crate::services::team_stripe_payment::assess(snapshot, invoice, package.as_ref(), now);
        tx.execute(
            "UPDATE team_stripe_snapshots SET payment_assessment=$2 WHERE organization_id=$1",
            &[&claim.organization_id, &serde_json::to_value(&assessment)?],
        )
        .await?;
        let change = super::team_analytics_entitlement::observe(
            &tx,
            claim,
            snapshot,
            invoice,
            &assessment,
            now,
            self.guard
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("financial_guard_configuration_unconfirmed"))?,
        )
        .await?;
        let invoice_value = invoice.map(serde_json::to_value).transpose()?;
        tx.execute("UPDATE team_stripe_snapshots SET invoice_observation=$2,subscription_item_id=$3 WHERE organization_id=$1",&[&claim.organization_id,&invoice_value,&snapshot.subscription_item_id]).await?;
        // Package/history locks can wait after the initial lease check. Do not ACK
        // or retain any observation made by a worker whose lease expired meanwhile.
        let lease_valid: bool = tx.query_one("SELECT lease_until>clock_timestamp() FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND lease_id=$4", &[&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.lease_id]).await?.get(0);
        if !lease_valid {
            tx.rollback().await?;
            return Ok(false);
        }
        tx.execute("UPDATE team_stripe_inbox SET disposition='processed',processed_at=now() WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND requested_revision<=$4 AND disposition='pending'",&[&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.revision]).await?;
        tx.execute("UPDATE team_stripe_reconcile_jobs SET applied_revision=$4,lease_id=NULL,lease_until=NULL,attempts=0,last_error_code=NULL,last_http_status=NULL,last_success_at=now() WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3",&[&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.revision]).await?;
        let pending = super::team_analytics_entitlement::prepare_change(
            self.guard.as_ref().and_then(|authority| authority.guard()),
            claim.organization_id,
            &change,
        )?;
        let after_prepare: DateTime<Utc> = tx
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .map_err(|error| {
                if pending.is_some() {
                    anyhow::anyhow!("financial_guard_commit_reconciliation_required")
                } else {
                    error.into()
                }
            })?
            .get(0);
        if after_prepare >= row.get::<_, DateTime<Utc>>(1) {
            let rollback = tx.rollback().await;
            if pending.is_some() {
                anyhow::bail!("financial_guard_commit_reconciliation_required");
            }
            rollback?;
            return Ok(false);
        }
        tx.commit().await.map_err(|error| {
            if pending.is_some() {
                anyhow::anyhow!("financial_guard_commit_reconciliation_required")
            } else {
                error.into()
            }
        })?;
        super::team_analytics_entitlement::confirm_change(
            self.guard.as_ref().and_then(|authority| authority.guard()),
            claim.organization_id,
            &change,
            pending.as_ref(),
        )?;
        Ok(true)
    }
    pub async fn fail(
        &self,
        claim: &Claim,
        error: Failure,
        status: Option<i32>,
        retry_after: Option<DateTime<Utc>>,
    ) -> Result<bool> {
        ensure!(
            status.is_none_or(|s| (100..=599).contains(&s)),
            "invalid HTTP status"
        );
        // Only enumerated metadata is persisted, never provider response bodies/tokens.
        let count=self.pg.execute("UPDATE team_stripe_reconcile_jobs SET attempts=LEAST(attempts+1,30),last_error_code=$5,last_http_status=$6,
            retry_at=GREATEST(now()+make_interval(secs => LEAST(3600.0,15.0*power(2.0,LEAST(attempts,8)))),COALESCE($7,now()),
                CASE WHEN $5 IN ('auth_required','permission_required','subscription_unconfirmed','unsupported_contract','provider_scope_mismatch') THEN now()+interval '1 hour' ELSE now() END),
            lease_id=NULL,lease_until=NULL WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND lease_id=$4 AND lease_until>now()",
            &[&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.lease_id,&error.code(),&status,&retry_after]).await?;
        Ok(count == 1)
    }
}

impl TeamStripeRepository {
    pub async fn claim_scope(&self, account: &str, live: bool) -> Result<Option<Uuid>> {
        self.pg.execute("INSERT INTO team_stripe_runtime_status(account_id,livemode) VALUES($1,$2) ON CONFLICT DO NOTHING",&[&account,&live]).await?;
        let lease = Uuid::now_v7();
        let row=self.pg.query_opt("UPDATE team_stripe_runtime_status SET lease_id=$3,lease_until=now()+interval '180 seconds',last_tick_at=now() WHERE account_id=$1 AND livemode=$2 AND retry_at<=now() AND (lease_until IS NULL OR lease_until<=now()) RETURNING lease_id",&[&account,&live,&lease]).await?;
        Ok(row.map(|r| r.get(0)))
    }
    pub async fn finish_scope(
        &self,
        account: &str,
        live: bool,
        lease: Uuid,
        provider_observed: bool,
    ) -> Result<bool> {
        Ok(self
            .pg
            .execute(
                "UPDATE team_stripe_runtime_status SET lease_id=NULL,lease_until=NULL,
            last_provider_success_at=CASE WHEN $4 THEN now() ELSE last_provider_success_at END,
            last_error_code=CASE WHEN $4 THEN NULL ELSE last_error_code END,
            last_http_status=CASE WHEN $4 THEN NULL ELSE last_http_status END,
            attempts=CASE WHEN $4 THEN 0 ELSE attempts END
            WHERE account_id=$1 AND livemode=$2 AND lease_id=$3 AND lease_until>now()",
                &[&account, &live, &lease, &provider_observed],
            )
            .await?
            == 1)
    }
    pub async fn fail_scope(
        &self,
        account: &str,
        live: bool,
        lease: Uuid,
        error: &crate::infrastructure::stripe::ProviderError,
    ) -> Result<bool> {
        Ok(self.pg.execute("UPDATE team_stripe_runtime_status SET attempts=LEAST(attempts+1,30),last_error_code=$4,last_http_status=$5,
            retry_at=GREATEST(now()+make_interval(secs => LEAST(3600.0,15.0*power(2.0,LEAST(attempts,8)))),COALESCE($6,now()),
              CASE WHEN $4 IN ('auth_required','permission_required','subscription_unconfirmed','unsupported_contract','provider_scope_mismatch') THEN now()+interval '1 hour' ELSE now() END),lease_id=NULL,lease_until=NULL
            WHERE account_id=$1 AND livemode=$2 AND lease_id=$3 AND lease_until>now()",
            &[&account,&live,&lease,&error.kind.code(),&error.status,&error.retry_after]).await?==1)
    }
}

//! Durable purchase confirmation. Does not grant access or infer payment from a session.
use super::team_stripe_quote::{CustomerProof, QuoteRepository};
use crate::{
    infrastructure::{postgres::PostgresClient, stripe::ProviderError},
    services::{
        authorization::{AuthorizationDenied, AuthorizationService},
        team_insights::TeamError,
        team_stripe_checkout::{
            CheckoutPolicy, ExpectedSession, FrozenRequest, SessionEvidence, SubscriptionEvidence,
        },
    },
};
use anyhow::{ensure, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Serialize)]
pub struct CheckoutStatus {
    pub operation_id: Uuid,
    pub quote_id: Uuid,
    pub revision: i64,
    pub disposition: String,
    pub retry_at: DateTime<Utc>,
    pub observed_at: Option<DateTime<Utc>>,
    pub last_error_code: Option<String>,
    pub checkout_available: bool,
    pub payment_verified: bool,
    pub test_checkout_destination_available: bool,
    pub lookup_only: bool,
    pub invoice_assessment: Option<crate::services::team_stripe_payment::Assessment>,
}
#[derive(PartialEq)]
pub struct CheckoutDestinationProof {
    pub operation: Uuid,
    pub revision: i64,
    pub proof: CustomerProof,
    pub session: String,
    pub price: String,
    pub currency: String,
    pub amount_minor: i64,
    pub request_hash: String,
}
impl CheckoutDestinationProof {
    pub fn expected(&self) -> ExpectedSession<'_> {
        ExpectedSession {
            operation: self.operation,
            customer: &self.proof.customer,
            price: &self.price,
            currency: &self.currency,
            amount_minor: self.amount_minor,
            live: self.proof.live,
        }
    }
}
pub struct CheckoutClaim {
    pub operation: Uuid,
    pub revision: i64,
    pub lease: Uuid,
    pub proof: CustomerProof,
    pub price: String,
    pub currency: String,
    pub amount_minor: i64,
    pub seats: u16,
    pub catalog_hash: String,
    pub request: FrozenRequest,
    pub session_id: Option<String>,
    pub lookup_only: bool,
}
impl CheckoutClaim {
    pub fn expected(&self) -> ExpectedSession<'_> {
        ExpectedSession {
            operation: self.operation,
            customer: &self.proof.customer,
            price: &self.price,
            currency: &self.currency,
            amount_minor: self.amount_minor,
            live: self.proof.live,
        }
    }
}
pub struct CheckoutRepository {
    pg: Arc<PostgresClient>,
    financial_guard: Option<crate::infrastructure::team_financial_guard::FinancialGuard>,
    financial_configuration_error: bool,
}
impl CheckoutRepository {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        match crate::infrastructure::team_financial_guard::FinancialObservation::from_environment()
        {
            Ok(observation) => {
                Self::with_financial_authority(pg, observation.guard().cloned(), false)
            }
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
        }
    }
    async fn serialize(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        org: Uuid,
        account: &str,
        live: bool,
    ) -> Result<()> {
        super::team_financial_locks::organization(tx, account, live, org).await?;
        ensure!(
            !self.financial_configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        super::team_financial_ingress::require_authority(tx, &scope, self.financial_guard.as_ref())
            .await?;
        if let Some(guard) = &self.financial_guard {
            ensure!(
                !super::team_financial_transaction::source_mode(tx, guard, &scope).await?,
                "financial_checkout_source_integration_required"
            );
        }
        Ok(())
    }
    pub async fn request(
        &self,
        proof: &CustomerProof,
        quote: Uuid,
        digest: &str,
        confirmed: bool,
        policy: &CheckoutPolicy,
    ) -> Result<CheckoutStatus> {
        ensure!(
            confirmed,
            TeamError::Invalid("confirm the displayed package price")
        );
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        self.serialize(&tx, proof.org, &proof.account, proof.live)
            .await?;
        let current =
            QuoteRepository::guard(&tx, proof.actor, proof.org, &proof.account, proof.live).await?;
        let q=tx.query_opt("SELECT * FROM team_stripe_quotes WHERE id=$1 AND organization_id=$2 AND actor_id=$3 FOR SHARE",&[&quote,&proof.org,&proof.actor]).await?.ok_or(TeamError::NotFound)?;
        QuoteRepository::check(&q, &current, digest)?;
        // A retry returns exactly the existing operation even after its original quote expires.
        if let Some(row) = tx
            .query_opt(
                "SELECT * FROM team_stripe_checkout_intents WHERE quote_id=$1",
                &[&quote],
            )
            .await?
        {
            let result = Self::view(&row);
            tx.commit().await?;
            return Ok(result);
        }
        ensure!(tx.query_opt("SELECT 1 FROM team_stripe_checkout_intents WHERE organization_id=$1 AND disposition<>'expired'",&[&proof.org]).await?.is_none(),TeamError::Invalid("existing checkout must be reconciled first"));
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        ensure!(
            q.get::<_, DateTime<Utc>>("expires_at") > now,
            TeamError::Invalid("quote expired; request a new quote")
        );
        Self::capacity(&tx, proof.org, q.get("package_seats")).await?;
        let id = Uuid::now_v7();
        let price: String = q.get("price_id");
        let currency: String = q.get("currency");
        let expected = ExpectedSession {
            operation: id,
            customer: &current.customer,
            price: &price,
            currency: &currency,
            amount_minor: q.get("amount_minor"),
            live: current.live,
        };
        let frozen = FrozenRequest::new(&expected, policy)?;
        let request = serde_json::to_value(&frozen)?;
        let request_hash = frozen.digest()?;
        let row=tx.query_one("INSERT INTO team_stripe_checkout_intents(operation_id,organization_id,actor_id,quote_id,account_id,livemode,request_metadata,request_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",&[&id,&proof.org,&proof.actor,&quote,&proof.account,&proof.live,&request,&request_hash]).await?;
        let result = Self::view(&row);
        tx.commit().await?;
        Ok(result)
    }
    async fn capacity(tx: &tokio_postgres::Transaction<'_>, org: Uuid, seats: i32) -> Result<()> {
        let n:i64=tx.query_one("SELECT count(*) FROM organization_members m WHERE m.organization_id=$1 AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer'",&[&org]).await?.get(0);
        ensure!(
            n <= i64::from(seats),
            TeamError::Invalid("package has fewer seats than current developers")
        );
        Ok(())
    }
    pub async fn status(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
        operation: Uuid,
    ) -> Result<CheckoutStatus> {
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        self.serialize(&tx, org, account, live).await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4",&[&operation,&org,&account,&live]).await?.ok_or(TeamError::NotFound)?;
        let mut result = Self::view(&row);
        result.invoice_assessment =
            Self::invoice_assessment(&tx, org, account, live, operation).await?;
        tx.commit().await?;
        Ok(result)
    }
    async fn invoice_assessment(
        tx: &tokio_postgres::Transaction<'_>,
        org: Uuid,
        account: &str,
        live: bool,
        operation: Uuid,
    ) -> Result<Option<crate::services::team_stripe_payment::Assessment>> {
        let row = tx.query_opt("SELECT s.payment_assessment,clock_timestamp(),(b.enabled AND b.revision=s.binding_revision AND s.source_revision=j.applied_revision AND j.requested_revision=j.applied_revision) AS current FROM team_stripe_bindings b JOIN team_stripe_snapshots s USING(organization_id) JOIN team_stripe_reconcile_jobs j ON j.account_id=b.account_id AND j.livemode=b.livemode AND j.subscription_id=b.subscription_id JOIN team_stripe_checkout_intents c ON c.organization_id=b.organization_id AND c.account_id=b.account_id AND c.livemode=b.livemode AND c.subscription_id=b.subscription_id WHERE b.organization_id=$1 AND b.account_id=$2 AND b.livemode=$3 AND c.operation_id=$4 AND c.disposition='bound'", &[&org,&account,&live,&operation]).await?;
        let Some(r) = row else {
            return Ok(None);
        };
        let Some(value) = r.get::<_, Option<serde_json::Value>>(0) else {
            return Ok(None);
        };
        let assessment: crate::services::team_stripe_payment::Assessment =
            serde_json::from_value(value)?;
        Ok(Some(assessment.current(r.get(1), r.get(2))))
    }
    pub async fn destination_proof(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
        expected: (Uuid, i64),
    ) -> Result<CheckoutDestinationProof> {
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let proof = QuoteRepository::guard(&tx, actor, org, account, live).await?;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR SHARE",&[&expected.0,&org,&account,&live]).await?.ok_or(TeamError::NotFound)?;
        ensure!(
            row.get::<_, i64>("revision") == expected.1
                && row.get::<_, String>("disposition") == "session_open",
            TeamError::ProjectionChanged
        );
        let quote: Uuid = row.get("quote_id");
        let q = tx
            .query_one(
                "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                &[&quote],
            )
            .await?;
        Self::check_recovery_scope(&q, &proof)?;
        let session: Option<String> = row.get("session_id");
        let request: Option<serde_json::Value> = row.get("request_metadata");
        let hash: Option<String> = row.get("request_sha256");
        let result = CheckoutDestinationProof {
            operation: expected.0,
            revision: expected.1,
            proof,
            session: session.ok_or(TeamError::ProjectionChanged)?,
            price: q.get("price_id"),
            currency: q.get("currency"),
            amount_minor: q.get("amount_minor"),
            request_hash: hash.ok_or(TeamError::ProjectionChanged)?,
        };
        FrozenRequest::restore(
            &request.ok_or(TeamError::ProjectionChanged)?,
            &result.request_hash,
            &result.expected(),
        )?;
        tx.commit().await?;
        Ok(result)
    }
    pub async fn latest(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
    ) -> Result<Option<CheckoutStatus>> {
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        self.serialize(&tx, org, account, live).await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE organization_id=$1 AND account_id=$2 AND livemode=$3 ORDER BY confirmed_at DESC,operation_id DESC LIMIT 1", &[&org,&account,&live]).await?;
        let mut result = row.as_ref().map(Self::view);
        if let Some(status) = result.as_mut() {
            status.invoice_assessment =
                Self::invoice_assessment(&tx, org, account, live, status.operation_id).await?;
        }
        tx.commit().await?;
        Ok(result)
    }
    pub async fn authorize_recovery(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
        expected: (Uuid, i64),
    ) -> Result<()> {
        let (operation, revision) = expected;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        self.serialize(&tx, org, account, live).await?;
        let proof = QuoteRepository::guard(&tx, actor, org, account, live).await?;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR UPDATE", &[&operation,&org,&account,&live]).await?.ok_or(TeamError::NotFound)?;
        let checked_at: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        ensure!(
            row.get::<_, i64>("revision") == revision
                && ["recovery_required", "owner_changed"]
                    .contains(&row.get::<_, String>("disposition").as_str()),
            TeamError::ProjectionChanged
        );
        ensure!(
            row.get::<_, Option<DateTime<Utc>>>("lease_until")
                .is_none_or(|t| t <= checked_at),
            TeamError::ProjectionChanged
        );
        let quote: Uuid = row.get("quote_id");
        let q = tx
            .query_one(
                "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                &[&quote],
            )
            .await?;
        Self::check_recovery_scope(&q, &proof)?;
        // Keep the original quote/initiator immutable. Current Owner authorizes lookup only.
        // Preserve retry_at, including Retry-After; the worker still checks its account cooldown.
        tx.execute("UPDATE team_stripe_checkout_intents SET recovery_actor=$2,lookup_only=true,disposition='pending',revision=revision+1,lease_id=NULL,lease_until=NULL WHERE operation_id=$1", &[&operation,&actor]).await?;
        tx.execute("INSERT INTO team_stripe_checkout_authorizations(operation_id,revision,actor_id,action) VALUES($1,$2,$3,'reconcile_existing_checkout')", &[&operation,&(revision+1),&actor]).await?;
        tx.commit().await?;
        Ok(())
    }
    fn check_recovery_scope(q: &tokio_postgres::Row, proof: &CustomerProof) -> Result<()> {
        let mut original = proof.clone();
        original.actor = q.get("actor_id");
        QuoteRepository::check(q, &original, &q.get::<_, String>("catalog_sha256"))
    }
    pub async fn claim(
        &self,
        account: &str,
        live: bool,
        digest: &str,
    ) -> Result<Option<CheckoutClaim>> {
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_locks::account(&tx, account, live).await?;
        let candidate=tx.query_opt("SELECT operation_id,organization_id,COALESCE(recovery_actor,actor_id) AS billing_actor FROM team_stripe_checkout_intents WHERE account_id=$1 AND livemode=$2 AND (disposition IN ('pending','session_open','awaiting_verification') OR (disposition='recovery_required' AND last_error_code='idempotency_window_unconfirmed')) AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) ORDER BY retry_at,confirmed_at,operation_id LIMIT 1",&[&account,&live]).await?;
        let Some(candidate) = candidate else {
            tx.commit().await?;
            return Ok(None);
        };
        let operation: Uuid = candidate.get(0);
        let org: Uuid = candidate.get(1);
        self.serialize(&tx, org, account, live).await?;
        let candidate_actor: Uuid = candidate.get("billing_actor");
        let proof = QuoteRepository::guard(&tx, candidate_actor, org, account, live).await;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND COALESCE(recovery_actor,actor_id)=$5 AND (disposition IN ('pending','session_open','awaiting_verification') OR (disposition='recovery_required' AND last_error_code='idempotency_window_unconfirmed')) AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) FOR UPDATE",&[&operation,&org,&account,&live,&candidate_actor]).await?;
        let Some(row) = row else {
            tx.commit().await?;
            return Ok(None);
        };
        let recovery_actor: Option<Uuid> = row.get("recovery_actor");
        let quote: Uuid = row.get("quote_id");
        let q = tx
            .query_one(
                "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                &[&quote],
            )
            .await?;
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let first: Option<DateTime<Utc>> = row.get("first_attempt_at");
        let session_id: Option<String> = row.get("session_id");
        let state: String = row.get("disposition");
        let lookup_only = session_id.is_none()
            && (row.get::<_, bool>("lookup_only")
                || first
                    .is_some_and(|t| now.signed_duration_since(t) >= chrono::Duration::hours(23)));
        let effective_digest = if session_id.is_some() || lookup_only {
            q.get::<_, String>("catalog_sha256")
        } else {
            digest.to_owned()
        };
        let mut stop = match &proof {
            Ok(p) => {
                let checked = if recovery_actor.is_some() && row.get::<_, bool>("lookup_only") {
                    Self::check_recovery_scope(&q, p)
                } else {
                    QuoteRepository::check(&q, p, &effective_digest)
                };
                if checked.is_err() {
                    Some(("recovery_required", "checkout_scope_changed"))
                } else {
                    None
                }
            }
            Err(e) if e.downcast_ref::<AuthorizationDenied>().is_some() => {
                Some(("owner_changed", "owner_authorization_changed"))
            }
            Err(e) if e.downcast_ref::<TeamError>().is_some() => {
                Some(("recovery_required", "checkout_scope_changed"))
            }
            Err(_) => return Err(proof.err().unwrap()),
        };
        if session_id.is_none() && first.is_none() && q.get::<_, DateTime<Utc>>("expires_at") <= now
        {
            stop = Some(("expired", "quote_expired_before_attempt"));
        }
        if stop.is_none() && session_id.is_none() && !lookup_only {
            if let Err(e) = Self::capacity(&tx, org, q.get("package_seats")).await {
                if e.downcast_ref::<TeamError>().is_none() {
                    return Err(e);
                }
                stop = Some(("recovery_required", "developer_capacity_changed"));
            }
        }
        if stop.is_none() && session_id.is_none() && !lookup_only && state != "pending" {
            stop = Some(("recovery_required", "checkout_session_identity_missing"));
        }
        let price: String = q.get("price_id");
        let currency: String = q.get("currency");
        let frozen = if let Ok(p) = &proof {
            let expected = ExpectedSession {
                operation,
                customer: &p.customer,
                price: &price,
                currency: &currency,
                amount_minor: q.get("amount_minor"),
                live: p.live,
            };
            let value: Option<serde_json::Value> = row.get("request_metadata");
            let hash: Option<String> = row.get("request_sha256");
            value
                .zip(hash)
                .and_then(|(v, h)| FrozenRequest::restore(&v, &h, &expected).ok())
        } else {
            None
        };
        if stop.is_none() && frozen.is_none() {
            stop = Some(("recovery_required", "checkout_request_unconfirmed"));
        }
        if let Some((state, reason)) = stop {
            tx.execute("UPDATE team_stripe_checkout_intents SET disposition=$2,last_error_code=$3,revision=revision+1,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&operation,&state,&reason]).await?;
            tx.commit().await?;
            return Ok(None);
        }
        let proof = proof?;
        let lease = Uuid::now_v7();
        let revision = row.get("revision");
        tx.execute("UPDATE team_stripe_checkout_intents SET disposition=CASE WHEN disposition='recovery_required' THEN 'pending' ELSE disposition END,first_attempt_at=COALESCE(first_attempt_at,clock_timestamp()),attempts=attempts+1,lease_id=$2,lease_until=clock_timestamp()+interval '180 seconds' WHERE operation_id=$1",&[&operation,&lease]).await?;
        let result = CheckoutClaim {
            operation,
            revision,
            lease,
            proof,
            price: q.get("price_id"),
            currency: q.get("currency"),
            amount_minor: q.get("amount_minor"),
            seats: q.get::<_, i32>("package_seats") as u16,
            catalog_hash: q.get("catalog_sha256"),
            request: frozen.ok_or(TeamError::ProjectionChanged)?,
            session_id,
            lookup_only,
        };
        tx.commit().await?;
        Ok(Some(result))
    }
    pub async fn unresolved(&self, claim: &CheckoutClaim, reason: &str) -> Result<()> {
        ensure!(
            claim.lookup_only
                && [
                    "checkout_not_found_unconfirmed",
                    "checkout_candidates_ambiguous",
                    "checkout_lookup_limit"
                ]
                .contains(&reason),
            "invalid checkout recovery disposition"
        );
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        self.serialize(&tx, claim.proof.org, &claim.proof.account, claim.proof.live)
            .await?;
        tx.execute("UPDATE team_stripe_checkout_intents SET disposition='recovery_required',revision=revision+1,last_error_code=$4,observed_at=clock_timestamp(),lease_id=NULL,lease_until=NULL WHERE operation_id=$1 AND revision=$2 AND lease_id=$3 AND lease_until>clock_timestamp() AND disposition='pending' AND organization_id=$5 AND account_id=$6 AND livemode=$7", &[&claim.operation,&claim.revision,&claim.lease,&reason,&claim.proof.org,&claim.proof.account,&claim.proof.live]).await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn receive(&self, claim: &CheckoutClaim, e: &SessionEvidence) -> Result<bool> {
        self.receive_verified(claim, e, None).await
    }
    pub async fn receive_verified(
        &self,
        claim: &CheckoutClaim,
        e: &SessionEvidence,
        binding: Option<&SubscriptionEvidence>,
    ) -> Result<bool> {
        if let Some(b) = binding {
            ensure!(
                e.status == "complete"
                    && b.operation == claim.operation
                    && b.session == e.id
                    && b.live == claim.proof.live
                    && Some(&b.snapshot.subscription_id) == e.subscription.as_ref()
                    && b.snapshot.customer_id == claim.proof.customer
                    && b.snapshot.price_id.as_deref() == Some(&claim.price)
                    && b.snapshot.currency.as_deref() == Some(&claim.currency)
                    && b.snapshot.amount_minor == Some(claim.amount_minor)
                    && b.snapshot.quantity == Some(1)
                    && b.snapshot.items_complete,
                TeamError::ProjectionChanged
            );
        }
        ensure!(
            e.operation == claim.operation
                && e.customer == claim.proof.customer
                && e.price == claim.price
                && e.currency == claim.currency
                && e.amount_minor == claim.amount_minor
                && e.live == claim.proof.live,
            TeamError::ProjectionChanged
        );
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let scope = crate::services::team_financial_ingress::Scope {
            account: claim.proof.account.clone(),
            live: claim.proof.live,
        };
        super::team_financial_ingress::lock(&tx, &scope).await?;
        if binding.is_some() {
            ensure!(
                !self.financial_configuration_error,
                "financial_guard_configuration_unconfirmed"
            );
            if let Some(guard) = &self.financial_guard {
                super::team_financial_ingress::ready(&tx, guard, &scope).await?;
            }
        }
        self.serialize(&tx, claim.proof.org, &claim.proof.account, claim.proof.live)
            .await?;
        let allowed = match QuoteRepository::guard(
            &tx,
            claim.proof.actor,
            claim.proof.org,
            &claim.proof.account,
            claim.proof.live,
        )
        .await
        {
            Ok(p) => {
                p.operation == claim.proof.operation
                    && p.revision == claim.proof.revision
                    && p.customer == claim.proof.customer
            }
            Err(e)
                if e.downcast_ref::<AuthorizationDenied>().is_some()
                    || e.downcast_ref::<TeamError>().is_some() =>
            {
                false
            }
            Err(e) => return Err(e),
        };
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND revision=$2 AND lease_id=$3 AND lease_until>clock_timestamp() AND disposition IN ('pending','session_open','awaiting_verification') AND organization_id=$4 AND account_id=$5 AND livemode=$6 FOR UPDATE",&[&claim.operation,&claim.revision,&claim.lease,&claim.proof.org,&claim.proof.account,&claim.proof.live]).await?;
        let Some(row) = row else {
            tx.commit().await?;
            return Ok(false);
        };
        ensure!(
            row.get::<_, Option<String>>("session_id")
                .is_none_or(|id| id == e.id),
            TeamError::ProjectionChanged
        );
        let deadline: DateTime<Utc> = row.get("lease_until");
        let previous: String = row.get("disposition");
        ensure!(
            previous != "awaiting_verification" || e.status == "complete",
            TeamError::ProjectionChanged
        );
        ensure!(
            row.get::<_, Option<String>>("subscription_id")
                .is_none_or(|id| Some(id) == e.subscription),
            TeamError::ProjectionChanged
        );
        if allowed {
            if let Some(b) = binding {
                tx.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,$2,$3,$4,$5)",&[&claim.proof.org,&claim.proof.account,&claim.proof.live,&claim.proof.customer,&b.snapshot.subscription_id]).await?;
                // Binding plus scheduling is atomic. A missed pre-binding webhook remains reconciliable.
                tx.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id) VALUES($1,$2,$3) ON CONFLICT(account_id,livemode,subscription_id) DO UPDATE SET requested_revision=team_stripe_reconcile_jobs.requested_revision+1",&[&claim.proof.account,&claim.proof.live,&b.snapshot.subscription_id]).await?;
            }
        }
        let state = if !allowed {
            "owner_changed"
        } else if binding.is_some() {
            "bound"
        } else {
            match e.status.as_str() {
                "open" => "session_open",
                "complete" => "awaiting_verification",
                _ => "expired",
            }
        };
        // Store provider identity even when the initiator lost access. Never auto-release ambiguity.
        tx.execute("UPDATE team_stripe_checkout_intents SET session_id=$2,session_expires_at=$3,subscription_id=$4,observed_at=$5,disposition=$6,revision=revision+1,last_error_code=$7,last_http_status=NULL,attempts=0,retry_at=clock_timestamp()+interval '60 seconds',lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&claim.operation,&e.id,&e.expires_at,&e.subscription,&e.observed_at,&state,&if allowed{None}else{Some("owner_authorization_changed")}]).await?;
        let checked_at: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        if checked_at >= deadline {
            tx.rollback().await?;
            return Ok(false);
        }
        tx.commit().await?;
        Ok(allowed)
    }
    pub async fn fail(&self, claim: &CheckoutClaim, e: &ProviderError) -> Result<()> {
        use super::team_stripe::Failure;
        let state = if matches!(
            e.kind,
            Failure::InvalidContract | Failure::ScopeMismatch | Failure::NotFound
        ) {
            "recovery_required"
        } else {
            "retry"
        };
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        self.serialize(&tx, claim.proof.org, &claim.proof.account, claim.proof.live)
            .await?;
        tx.execute("UPDATE team_stripe_checkout_intents SET disposition=CASE WHEN $4='retry' THEN disposition ELSE $4 END,retry_at=GREATEST(clock_timestamp()+make_interval(secs=>LEAST(3600,15*power(2,LEAST(attempts,8)))::double precision),COALESCE($5,clock_timestamp())),last_error_code=$6,last_http_status=$7,lease_id=NULL,lease_until=NULL WHERE operation_id=$1 AND revision=$2 AND lease_id=$3 AND lease_until>clock_timestamp() AND disposition IN ('pending','session_open','awaiting_verification') AND organization_id=$8 AND account_id=$9 AND livemode=$10",&[&claim.operation,&claim.revision,&claim.lease,&state,&e.retry_after,&e.kind.code(),&e.status,&claim.proof.org,&claim.proof.account,&claim.proof.live]).await?;
        tx.commit().await?;
        Ok(())
    }
    fn view(r: &tokio_postgres::Row) -> CheckoutStatus {
        CheckoutStatus {
            operation_id: r.get("operation_id"),
            quote_id: r.get("quote_id"),
            revision: r.get("revision"),
            disposition: r.get("disposition"),
            retry_at: r.get("retry_at"),
            observed_at: r.get("observed_at"),
            last_error_code: r.get("last_error_code"),
            checkout_available: false,
            payment_verified: false,
            invoice_assessment: None,
            test_checkout_destination_available: false,
            lookup_only: r.get("lookup_only"),
        }
    }
}

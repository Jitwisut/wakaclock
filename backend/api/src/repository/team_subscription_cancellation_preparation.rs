//! Current SQL/source/Owner proof for a readonly Stripe preparation. No SQL lock
//! is held across HTTP, and no deserialized metadata can mint a prepared action.
use super::*;
use crate::services::{
    team_financial_guard::fingerprint,
    team_insights::TeamError,
    team_subscription_cancellation::{require_enabled, CancellationSelection, Subscription},
};
use serde::Serialize;

#[derive(Clone, PartialEq, Eq, Serialize)]
struct Canonical {
    account: String,
    live: bool,
    customer: String,
    subscription: String,
    binding_revision: i64,
    source_revision: i64,
    item: String,
    price: String,
    currency: String,
    amount_minor: i64,
    period_start: DateTime<Utc>,
    period_end: DateTime<Utc>,
    observed_at: DateTime<Utc>,
    status: String,
}
impl Canonical {
    fn selection(&self, input: &CancellationSelection) -> Result<()> {
        input.validate()?;
        ensure!(
            input.expected_binding_revision == self.binding_revision
                && input.expected_source_revision == self.source_revision
                && input.expected_period_end == self.period_end,
            TeamError::ProjectionChanged
        );
        Ok(())
    }
    fn metadata(&self, metadata: &Subscription) -> Result<()> {
        ensure!(
            metadata.customer == self.customer
                && metadata.subscription == self.subscription
                && metadata.live == self.live
                && metadata.item.as_deref() == Some(self.item.as_str())
                && metadata.price.as_deref() == Some(self.price.as_str())
                && metadata.currency.as_deref() == Some(self.currency.as_str())
                && metadata.amount_minor == Some(self.amount_minor)
                && metadata.quantity == Some(1)
                && metadata.period_start == Some(self.period_start)
                && metadata.period_end == Some(self.period_end)
                && metadata.items_complete
                && metadata.status == self.status,
            TeamError::ProjectionChanged
        );
        Ok(())
    }
}
#[derive(Clone, PartialEq, Eq, Serialize)]
struct Pin {
    actor: Uuid,
    organization: Uuid,
    canonical: Canonical,
    account_token: String,
    enrollment_token: String,
}
struct Captured {
    pin: Pin,
    at: DateTime<Utc>,
    lease_until: Option<DateTime<Utc>>,
}
/// No Debug/Serialize/Deserialize/Clone. Caller-visible getters identify only
/// the scoped provider resource; the actual seal remains private to this module.
pub struct CancellationReadProof {
    repository: CancellationRepository,
    pin: Pin,
    selection: CancellationSelection,
    lease: Uuid,
    captured_at: DateTime<Utc>,
    valid_until: DateTime<Utc>,
}
impl CancellationRepository {
    /// Readonly selection for the UI. It carries revisions/time, never provider
    /// identity or dispatch authority; acceptance recaptures all prerequisites.
    pub async fn cancellation_view(
        &self,
        actor: Uuid,
        org: Uuid,
        operation: Option<Uuid>,
    ) -> Result<crate::services::team_subscription_cancellation::CancellationView> {
        use crate::services::team_subscription_cancellation::CancellationView;
        let operation = match operation {
            Some(id) => Some(id),
            None => self.pg.query_opt("SELECT c.operation_id FROM team_subscription_cancellations c WHERE c.organization_id=$1 AND (NOT EXISTS(SELECT 1 FROM team_stripe_bindings b WHERE b.organization_id=$1) OR EXISTS(SELECT 1 FROM team_stripe_bindings b WHERE b.organization_id=$1 AND b.account_id=c.account_id AND b.livemode=c.livemode AND b.subscription_id=c.subscription_id)) ORDER BY c.accepted_at DESC,c.operation_id DESC LIMIT 1", &[&org]).await?.map(|row|row.get(0)),
        };
        if let Some(operation) = operation {
            let saved = self
                .find_saved(actor, org, operation)
                .await?
                .context("cancellation_saved_acceptance_unconfirmed_reconciliation_required")?;
            let status = saved.response().await?;
            return Ok(CancellationView {
                schema_version: 1,
                checked_at: status.observed_at,
                operation: Some(status),
                selection: None,
            });
        }
        let before = self.capture_selection(actor, org).await?;
        let after = self.capture_selection(actor, org).await?;
        ensure!(before.0 == after.0, TeamError::ProjectionChanged);
        Ok(CancellationView {
            schema_version: 1,
            operation: None,
            selection: Some(after.1),
            checked_at: after.2,
        })
    }
    async fn capture_selection(
        &self,
        actor: Uuid,
        org: Uuid,
    ) -> Result<(
        String,
        crate::services::team_subscription_cancellation::CancellationTerms,
        DateTime<Utc>,
    )> {
        use crate::services::team_subscription_cancellation::CancellationTerms;
        require_enabled()?;
        let api = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("cancellation_provider_configuration_unavailable")?;
        let account = Account {
            account: api.account_id,
            live: api.livemode,
        };
        let guard = self.guard()?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::super::team_financial_locks::organization(&tx, &account.account, account.live, org)
            .await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        let rollout=tx.query_opt("SELECT to_jsonb(r) FROM team_rollouts r WHERE organization_id=$1 AND enabled FOR SHARE", &[&org]).await?.context(TeamError::Disabled)?;
        super::super::team_financial_ingress::require_authority(&tx, &account, Some(guard)).await?;
        ensure!(
            super::super::team_financial_transaction::source_mode(&tx, guard, &account).await?,
            "cancellation_source_evidence_required"
        );
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let current = canonical(&tx, org, now).await?;
        ensure!(
            current.account == account.account && current.live == account.live,
            TeamError::ProjectionChanged
        );
        ensure!(tx.query_opt("SELECT 1 FROM team_subscription_cancellations WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND disposition NOT IN ('effective','withdrawn') LIMIT 1 FOR SHARE", &[&account.account,&account.live,&current.subscription]).await?.is_none(),TeamError::ProjectionChanged);
        let enrollment = super::super::team_analytics_entitlement::load(&tx, org).await?;
        let snapshot = guard.read()?;
        snapshot.snapshot.verify(org, enrollment.as_ref())?;
        let source = super::super::team_financial_inventory::account_source_token(guard, &account)?;
        let enrollment_token = snapshot.organization_token(org)?;
        let token = fingerprint(&(
            &current,
            &source,
            &enrollment_token,
            rollout.get::<_, serde_json::Value>(0),
        ))?;
        let selection = CancellationTerms {
            binding_revision: current.binding_revision,
            source_revision: current.source_revision,
            period_end: current.period_end,
            provider_observed_at: current.observed_at,
            confirmation_expires_at: (current.observed_at + Duration::minutes(5))
                .min(current.period_end),
        };
        let write = super::super::team_financial_transaction::NormalWrite::begin_organization(
            tx, guard, &account, org,
        )
        .await?;
        ensure!(
            write
                .commit_read_before(selection.confirmation_expires_at)
                .await?,
            "cancellation_selection_expired"
        );
        self.guard()?;
        require_enabled()?;
        ensure!(
            super::super::team_financial_inventory::account_source_token(guard, &account)?
                == source
                && guard.read()?.organization_token(org)? == enrollment_token,
            TeamError::ProjectionChanged
        );
        Ok((token, selection, now))
    }
    pub async fn read_proof(
        &self,
        actor: Uuid,
        org: Uuid,
        input: CancellationSelection,
        lease: Uuid,
    ) -> Result<CancellationReadProof> {
        require_enabled()?;
        input.validate()?;
        ensure!(!lease.is_nil(), "cancellation_account_lease_required");
        let captured = self
            .capture_read(actor, org, &input, Some(lease), None)
            .await?;
        let expires = (captured.at + Duration::seconds(60))
            .min(captured.pin.canonical.period_end)
            .min(
                captured
                    .lease_until
                    .context("cancellation_account_lease_unconfirmed")?,
            );
        ensure!(captured.at < expires, "cancellation_preparation_expired");
        Ok(CancellationReadProof {
            repository: self.clone(),
            pin: captured.pin,
            selection: input,
            lease,
            captured_at: captured.at,
            valid_until: expires,
        })
    }
    async fn capture_read(
        &self,
        actor: Uuid,
        org: Uuid,
        input: &CancellationSelection,
        lease: Option<Uuid>,
        deadline: Option<DateTime<Utc>>,
    ) -> Result<Captured> {
        require_enabled()?;
        let api = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("cancellation_provider_configuration_unavailable")?;
        let guard = self.guard()?;
        ensure!(
            !crate::services::team_financial_transaction::operation_known(
                &guard.read()?.snapshot,
                input.operation_id
            ),
            "cancellation_operation_already_retained_load_saved_status"
        );
        let account = Account {
            account: api.account_id,
            live: api.livemode,
        };
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::super::team_financial_locks::organization(&tx, &account.account, account.live, org)
            .await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        ensure!(
            tx.query_opt(
                "SELECT 1 FROM team_rollouts WHERE organization_id=$1 AND enabled FOR SHARE",
                &[&org]
            )
            .await?
            .is_some(),
            TeamError::Disabled
        );
        super::super::team_financial_ingress::require_authority(&tx, &account, Some(guard)).await?;
        ensure!(
            super::super::team_financial_transaction::source_mode(&tx, guard, &account).await?,
            "cancellation_source_evidence_required"
        );
        let at: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let canonical = canonical(&tx, org, at).await?;
        ensure!(
            canonical.account == account.account && canonical.live == account.live,
            TeamError::ProjectionChanged
        );
        canonical.selection(input)?;
        ensure!(tx.query_opt("SELECT 1 FROM team_subscription_cancellations WHERE operation_id=$1 OR (account_id=$2 AND livemode=$3 AND subscription_id=$4 AND disposition NOT IN ('effective','withdrawn')) LIMIT 1 FOR SHARE",&[&input.operation_id,&account.account,&account.live,&canonical.subscription]).await?.is_none(),
            TeamError::Invalid("load the saved cancellation; an existing operation cannot be replaced"));
        let enrollment = super::super::team_analytics_entitlement::load(&tx, org).await?;
        let state = guard.read()?;
        state.snapshot.verify(org, enrollment.as_ref())?;
        let pin = Pin {
            actor,
            organization: org,
            canonical,
            account_token: super::super::team_financial_inventory::account_source_token(
                guard, &account,
            )?,
            enrollment_token: state.organization_token(org)?,
        };
        let lease_until = if let Some(lease) = lease {
            Some(tx.query_opt("SELECT lease_until FROM team_stripe_runtime_status WHERE account_id=$1 AND livemode=$2 AND lease_id=$3 AND lease_until>clock_timestamp() AND retry_at<=clock_timestamp() FOR SHARE",&[&account.account,&account.live,&lease]).await?.context("cancellation_account_lease_unconfirmed")?.get::<_,DateTime<Utc>>(0))
        } else {
            None
        };
        let end = deadline
            .unwrap_or(at + Duration::seconds(60))
            .min(pin.canonical.period_end)
            .min(lease_until.unwrap_or(at + Duration::seconds(60)));
        ensure!(at < end, "cancellation_preparation_expired");
        let write = super::super::team_financial_transaction::NormalWrite::begin_customer(
            tx,
            guard,
            &account,
            org,
            &pin.canonical.customer,
        )
        .await?;
        require_enabled()?;
        ensure!(
            write.commit_read_before(end).await?,
            "cancellation_preparation_expired"
        );
        ensure!(
            guard.read()?.organization_token(org)? == pin.enrollment_token
                && super::super::team_financial_inventory::account_source_token(guard, &account)?
                    == pin.account_token,
            TeamError::ProjectionChanged
        );
        Ok(Captured {
            pin,
            at,
            lease_until,
        })
    }
    pub async fn complete_read(
        &self,
        proof: CancellationReadProof,
        resource: crate::infrastructure::stripe::CancellationResourceRead,
    ) -> Result<PreparedCancellation> {
        ensure!(
            Arc::ptr_eq(&self.pg, &proof.repository.pg)
                && self.guard()?.same_authority(proof.repository.guard()?),
            "cancellation_preparation_repository_changed"
        );
        ensure!(
            resource.proof_key() == proof.proof_key()?,
            "cancellation_provider_read_scope_changed"
        );
        let captured = proof.capture(Some(proof.lease)).await?;
        let metadata = resource.subscription();
        captured.pin.canonical.metadata(metadata)?;
        ensure!(
            proof.captured_at <= resource.observed_at()
                && resource.observed_at() <= captured.at
                && captured.at < proof.valid_until,
            "cancellation_read_time_unconfirmed"
        );
        let request = FrozenCancellation::new(
            crate::services::team_financial_source::Scope {
                organization: proof.pin.organization,
                account: proof.account().into(),
                live: proof.live(),
            },
            proof.pin.actor,
            proof.selection.operation_id,
            proof.pin.canonical.binding_revision,
            proof.pin.canonical.source_revision,
            metadata,
            captured.at,
        )?;
        let read = ReadEvidence {
            exchange: resource.exchange(),
            observed_at: resource.observed_at(),
            valid_until: proof.valid_until,
            subscription: metadata.clone(),
        };
        read.validate(&request)?;
        Ok(PreparedCancellation {
            request,
            read,
            account_token: proof.pin.account_token.clone(),
            enrollment_token: proof.pin.enrollment_token.clone(),
            seal: PreparationSeal::Provider(Box::new(proof)),
        })
    }
}
impl CancellationReadProof {
    pub(crate) fn account(&self) -> &str {
        &self.pin.canonical.account
    }
    pub(crate) fn live(&self) -> bool {
        self.pin.canonical.live
    }
    pub(crate) fn subscription(&self) -> &str {
        &self.pin.canonical.subscription
    }
    pub(crate) fn customer(&self) -> &str {
        &self.pin.canonical.customer
    }
    pub(crate) fn proof_key(&self) -> Result<String> {
        fingerprint(&(
            "cancellation_read_proof_v1",
            &self.pin,
            &self.selection,
            self.lease,
            self.captured_at,
            self.valid_until,
        ))
    }
    async fn capture(&self, lease: Option<Uuid>) -> Result<Captured> {
        let current = self
            .repository
            .capture_read(
                self.pin.actor,
                self.pin.organization,
                &self.selection,
                lease,
                Some(self.valid_until),
            )
            .await?;
        ensure!(
            current.pin == self.pin
                && current.at >= self.captured_at
                && current.at < self.valid_until,
            TeamError::ProjectionChanged
        );
        Ok(current)
    }
    pub(crate) async fn preflight(&self, guard: Option<&FinancialGuard>) -> Result<()> {
        ensure!(
            guard.is_some_and(|g| g.same_authority(self.repository.deployment.guard())),
            "cancellation_provider_authority_changed"
        );
        self.capture(Some(self.lease)).await?;
        Ok(())
    }
    pub(super) async fn recheck(&self, lease: Option<Uuid>) -> Result<()> {
        self.capture(lease).await?;
        Ok(())
    }
    pub(super) fn validate_prepared(
        &self,
        repository: &CancellationRepository,
        request: &FrozenCancellation,
        read: &ReadEvidence,
    ) -> Result<()> {
        require_enabled()?;
        ensure!(
            Arc::ptr_eq(&repository.pg, &self.repository.pg)
                && repository.guard()?.same_authority(self.repository.guard()?),
            "cancellation_preparation_repository_changed"
        );
        self.pin.canonical.selection(&self.selection)?;
        self.pin.canonical.metadata(&read.subscription)?;
        ensure!(
            request.actor() == self.pin.actor
                && request.scope().organization == self.pin.organization
                && request.scope().account == self.account()
                && request.scope().live == self.live()
                && request.operation() == self.selection.operation_id
                && request.binding_revision() == self.pin.canonical.binding_revision
                && request.source_revision() == self.pin.canonical.source_revision
                && request.period_end() == self.pin.canonical.period_end
                && read.valid_until == self.valid_until
                && read.observed_at >= self.captured_at,
            "cancellation_preparation_changed"
        );
        read.validate(request)
    }
}

async fn canonical(
    tx: &tokio_postgres::Transaction<'_>,
    org: Uuid,
    now: DateTime<Utc>,
) -> Result<Canonical> {
    let row=tx.query_opt("SELECT b.account_id,b.livemode,b.customer_id,b.subscription_id,b.revision,b.enabled,s.binding_revision,s.source_revision,s.subscription_item_id,s.price_id,s.currency,s.amount_minor,s.quantity,s.period_start,s.period_end,s.items_complete,s.cancel_at_period_end,s.observed_at,j.requested_revision,j.applied_revision,s.provider_status FROM team_stripe_bindings b JOIN team_stripe_snapshots s ON s.organization_id=b.organization_id JOIN team_stripe_reconcile_jobs j ON j.account_id=b.account_id AND j.livemode=b.livemode AND j.subscription_id=b.subscription_id WHERE b.organization_id=$1 FOR SHARE OF b,s,j",&[&org]).await?.context("cancellation_canonical_snapshot_missing")?;
    let revision: i64 = row.get(4);
    let source: i64 = row.get(7);
    let observed: DateTime<Utc> = row.get(17);
    ensure!(
        revision > 0
            && source > 0
            && row.get::<_, bool>(5)
            && row.get::<_, i64>(6) == revision
            && row.get::<_, i64>(18) == source
            && row.get::<_, i64>(19) == source
            && row.get::<_, Option<i64>>(12) == Some(1)
            && row.get::<_, bool>(15)
            && !row.get::<_, bool>(16)
            && observed <= now
            && now - observed < Duration::minutes(5),
        "cancellation_canonical_predecessor_changed"
    );
    let value = Canonical {
        account: row.get(0),
        live: row.get(1),
        customer: row.get(2),
        subscription: row.get(3),
        binding_revision: revision,
        source_revision: source,
        item: row
            .get::<_, Option<String>>(8)
            .context("cancellation_item_unconfirmed")?,
        price: row
            .get::<_, Option<String>>(9)
            .context("cancellation_price_unconfirmed")?,
        currency: row
            .get::<_, Option<String>>(10)
            .context("cancellation_currency_unconfirmed")?,
        amount_minor: row
            .get::<_, Option<i64>>(11)
            .context("cancellation_amount_unconfirmed")?,
        period_start: row
            .get::<_, Option<DateTime<Utc>>>(13)
            .context("cancellation_period_unconfirmed")?,
        period_end: row
            .get::<_, Option<DateTime<Utc>>>(14)
            .context("cancellation_period_unconfirmed")?,
        observed_at: observed,
        status: row.get(20),
    };
    let id = crate::services::team_stripe::id;
    ensure!(
        id(&value.account, "acct_")
            && id(&value.customer, "cus_")
            && id(&value.subscription, "sub_")
            && id(&value.item, "si_")
            && id(&value.price, "price_")
            && value.amount_minor >= 0
            && value.currency.len() == 3
            && value.currency.bytes().all(|b| b.is_ascii_lowercase()),
        "cancellation_canonical_identity_invalid"
    );
    ensure!(
        value.period_start <= now
            && now < value.period_end
            && ["active", "trialing", "past_due", "unpaid", "paused"]
                .contains(&value.status.as_str()),
        "cancellation_canonical_predecessor_changed"
    );
    Ok(value)
}

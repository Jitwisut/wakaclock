//! Durable original preview request receiver. This grants no HTTP, accepted
//! monetary quote, paid access or capacity. Preparation is sealed to current
//! SQL/source/catalog; actual provider execution is a separate runtime boundary.
use crate::{
    infrastructure::{
        postgres::PostgresClient,
        team_financial_guard::{CommercialDeployment, FinancialGuard},
    },
    services::{
        authorization::AuthorizationService,
        team_financial_guard::fingerprint,
        team_financial_ingress::Scope as Account,
        team_financial_transaction::{operation_known, Writer},
        team_insights::TeamError,
        team_stripe_catalog::Catalog,
        team_stripe_change_payment::preview::{self, PreviewRequest},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Arc;
use tokio_postgres::Transaction;
use uuid::Uuid;

/// Private pins can only be minted by the current-SQL/source/catalog preparation
/// factory. Metadata from a client/JSON is not this capability.
pub struct PreparedUpgradePreview {
    request: PreviewRequest,
    source_token: String,
    enrollment_token: String,
    valid_until: DateTime<Utc>,
}
#[derive(Serialize)]
pub struct QueuedUpgradePreview {
    pub schema_version: u8,
    pub quote_id: Uuid,
    pub requested_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub duplicate: bool,
    pub durable_acceptance: &'static str,
    pub provider_preview: &'static str,
}
#[derive(Clone)]
pub struct UpgradePreviewRepository {
    pg: Arc<PostgresClient>,
    deployment: CommercialDeployment,
}
impl UpgradePreviewRepository {
    pub fn new(pg: Arc<PostgresClient>, deployment: CommercialDeployment) -> Self {
        Self { pg, deployment }
    }
    fn guard(&self) -> Result<&FinancialGuard> {
        let current = CommercialDeployment::required_from_environment()?;
        ensure!(
            current.guard().same_authority(self.deployment.guard()),
            "upgrade_preview_authority_changed"
        );
        Ok(self.deployment.guard())
    }
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
            .any(|group| !group.committed && group.proposal.account == *account)
        {
            super::team_financial_transaction::reconcile_account_history(tx, guard, account)
                .await?;
        } else {
            tx.rollback().await?;
        }
        Ok(())
    }
    /// Same-ID service retry reads the original durable request before creating
    /// a new preparation. It never restamps or rewrites a retained request.
    pub async fn request_preview(
        &self,
        actor: Uuid,
        org: Uuid,
        input: preview::PreviewSelection,
    ) -> Result<QueuedUpgradePreview> {
        input.validate()?;
        if let Some(known) = self
            .saved_request(actor, org, input.quote_id, Some(&input))
            .await?
        {
            return Ok(known);
        }
        let original = input.clone();
        let prepared = self.prepare(actor, org, input).await?;
        let created = self.enqueue(prepared).await?;
        let mut result = self
            .saved_request(actor, org, original.quote_id, Some(&original))
            .await?
            .context("upgrade_preview_saved_acceptance_unconfirmed")?;
        result.duplicate = created.duplicate;
        Ok(result)
    }
    /// Current Owner proof, with no mutation flag/provider credential required.
    /// The pin is recaptured before releasing only the ingress receipt DTO.
    pub async fn saved_request(
        &self,
        actor: Uuid,
        org: Uuid,
        quote: Uuid,
        input: Option<&preview::PreviewSelection>,
    ) -> Result<Option<QueuedUpgradePreview>> {
        ensure!(
            !actor.is_nil() && !org.is_nil() && !quote.is_nil(),
            TeamError::Invalid("original preview identity required")
        );
        let row=self.pg.query_opt("SELECT account_id,livemode FROM team_subscription_upgrade_previews WHERE quote_id=$1 AND organization_id=$2", &[&quote,&org]).await?;
        let Some(row) = row else {
            let guard = self.guard()?;
            let mut db = self.pg.transaction_client().await?;
            let tx = db.transaction().await?;
            tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
                .await?;
            super::team_seats::lock(&tx, org).await?;
            AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
            ensure!(
                !operation_known(&guard.read()?.snapshot, quote),
                "upgrade_preview_saved_acceptance_unconfirmed_reconciliation_required"
            );
            tx.commit().await?;
            self.guard()?;
            return Ok(None);
        };
        let account = Account {
            account: row.get(0),
            live: row.get(1),
        };
        self.reconcile_history(&account).await?;
        let first = self.capture_saved(actor, org, quote, &account).await?;
        if let Some(input) = input {
            first.0.matches_selection(input)?;
        }
        let second = self.capture_saved(actor, org, quote, &account).await?;
        ensure!(
            first.0 == second.0 && first.1 == second.1,
            TeamError::ProjectionChanged
        );
        Ok(Some(ack(&second.0, true)))
    }
    async fn capture_saved(
        &self,
        actor: Uuid,
        org: Uuid,
        quote: Uuid,
        account: &Account,
    ) -> Result<(PreviewRequest, String)> {
        let guard = self.guard()?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::team_financial_locks::organization(&tx, &account.account, account.live, org).await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        let rollout=tx.query_opt("SELECT to_jsonb(r) FROM team_rollouts r WHERE organization_id=$1 AND enabled FOR SHARE", &[&org]).await?.context(TeamError::Disabled)?;
        super::team_financial_ingress::require_authority(&tx, account, Some(guard)).await?;
        ensure!(
            super::team_financial_transaction::source_mode(&tx, guard, account).await?,
            "upgrade_preview_source_required"
        );
        let row=tx.query_opt("SELECT request_metadata,to_jsonb(p) AS record FROM team_subscription_upgrade_previews p WHERE quote_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR SHARE", &[&quote,&org,&account.account,&account.live]).await?.context("upgrade_preview_saved_acceptance_unconfirmed")?;
        let request: PreviewRequest = serde_json::from_value(row.get("request_metadata"))
            .map_err(|_| anyhow::anyhow!("upgrade_preview_saved_request_invalid"))?;
        request.validate()?;
        ensure!(
            request.quote_id == quote
                && request.scope.organization == org
                && request.scope.account == account.account
                && request.scope.live == account.live,
            "upgrade_preview_saved_scope_changed"
        );
        verify_request_history(&tx, &request).await?;
        let independent = guard.read()?;
        ensure!(
            independent
                .snapshot
                .sources
                .scopes
                .get(&request.scope.key()?)
                .and_then(|entry| entry.accepted.get(&quote))
                == Some(&request.accepted_request()?),
            "upgrade_preview_original_acceptance_unconfirmed"
        );
        let state = super::team_analytics_entitlement::load(&tx, org).await?;
        independent.snapshot.verify(org, state.as_ref())?;
        let source = super::team_financial_inventory::account_source_token(guard, account)?;
        let enrollment = independent.organization_token(org)?;
        let pin = fingerprint(&(
            row.get::<_, serde_json::Value>("record"),
            rollout.get::<_, serde_json::Value>(0),
            &source,
            &enrollment,
        ))?;
        let write = super::team_financial_transaction::NormalWrite::begin_organization(
            tx, guard, account, org,
        )
        .await?;
        ensure!(
            write.commit_operational(None).await?,
            "upgrade_preview_saved_status_unconfirmed"
        );
        self.guard()?;
        ensure!(
            super::team_financial_inventory::account_source_token(guard, account)? == source
                && guard.read()?.organization_token(org)? == enrollment,
            TeamError::ProjectionChanged
        );
        Ok((request, pin))
    }
    /// No HTTP or writes. Captures original terms once; the caller must load an
    /// already-retained quote instead of invoking this to renew its timestamp.
    pub async fn prepare(
        &self,
        actor: Uuid,
        org: Uuid,
        input: preview::PreviewSelection,
    ) -> Result<PreparedUpgradePreview> {
        input.validate()?;
        preview::require_enabled()?;
        let guard = self.guard()?;
        let locator = self
            .pg
            .query_opt(
                "SELECT account_id,livemode FROM team_stripe_bindings WHERE organization_id=$1",
                &[&org],
            )
            .await?
            .context("upgrade_preview_binding_unavailable")?;
        let account = Account {
            account: locator.get(0),
            live: locator.get(1),
        };
        self.reconcile_history(&account).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::team_financial_locks::organization(&tx, &account.account, account.live, org).await?;
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
        super::team_financial_ingress::require_authority(&tx, &account, Some(guard)).await?;
        ensure!(
            super::team_financial_transaction::source_mode(&tx, guard, &account).await?,
            "upgrade_preview_source_required"
        );
        ensure!(
            !operation_known(&guard.read()?.snapshot, input.quote_id)
                && tx
                    .query_opt(
                        "SELECT 1 FROM team_subscription_upgrade_previews WHERE quote_id=$1",
                        &[&input.quote_id]
                    )
                    .await?
                    .is_none(),
            "upgrade_preview_nonce_retained_load_original"
        );
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let row=tx.query_opt("SELECT b.customer_id,b.subscription_id,s.subscription_item_id,s.price_id,s.currency,s.period_start,s.period_end,s.observed_at FROM team_stripe_bindings b JOIN team_stripe_snapshots s ON s.organization_id=b.organization_id WHERE b.organization_id=$1 AND b.account_id=$2 AND b.livemode=$3 FOR SHARE OF b,s", &[&org,&account.account,&account.live]).await?.context("upgrade_preview_binding_changed")?;
        let state = super::team_analytics_entitlement::load(&tx, org)
            .await?
            .context("upgrade_original_package_unconfirmed")?;
        let independent = guard.read()?;
        independent.snapshot.verify(org, Some(&state))?;
        let catalog = Catalog::from_env(&account.account, account.live)?
            .context("upgrade_catalog_unavailable")?;
        let package = catalog
            .package(u16::try_from(input.package_seats).context("upgrade_package_invalid")?)?;
        let scope = crate::services::team_financial_source::Scope {
            organization: org,
            account: account.account.clone(),
            live: account.live,
        };
        let requested_second =
            DateTime::from_timestamp(now.timestamp(), 0).context("upgrade_preview_time_invalid")?;
        let end: DateTime<Utc> = row
            .get::<_, Option<DateTime<Utc>>>("period_end")
            .context("upgrade_preview_period_unconfirmed")?;
        let request = PreviewRequest {
            schema: 1,
            quote_id: input.quote_id,
            scope,
            actor,
            customer: row.get("customer_id"),
            subscription: row.get("subscription_id"),
            item: row
                .get::<_, Option<String>>("subscription_item_id")
                .context("upgrade_preview_item_unconfirmed")?,
            from_price: row
                .get::<_, Option<String>>("price_id")
                .context("upgrade_preview_price_unconfirmed")?,
            to_price: package.price_id.clone(),
            from_seats: state.package_seats,
            to_seats: input.package_seats,
            currency: row
                .get::<_, Option<String>>("currency")
                .context("upgrade_preview_currency_unconfirmed")?,
            to_amount_minor: package.amount_minor,
            binding_revision: input.expected_binding_revision,
            source_revision: input.expected_source_revision,
            catalog_revision: catalog.revision(),
            catalog_sha256: catalog.digest()?,
            period_start: row
                .get::<_, Option<DateTime<Utc>>>("period_start")
                .context("upgrade_preview_period_unconfirmed")?,
            period_end: end,
            proration_at: requested_second,
            requested_at: now,
            expires_at: (now + chrono::Duration::minutes(10)).min(end),
        };
        request.validate()?;
        ensure!(
            end == input.expected_period_end && request.currency == catalog.currency(),
            TeamError::ProjectionChanged
        );
        validate_current(&tx, &request, now).await?;
        let observed: DateTime<Utc> = row.get("observed_at");
        let valid_until = (now + chrono::Duration::seconds(60))
            .min(observed + chrono::Duration::minutes(5))
            .min(end);
        let source_token = super::team_financial_inventory::account_source_token(guard, &account)?;
        let enrollment_token = independent.organization_token(org)?;
        let write = super::team_financial_transaction::NormalWrite::begin_organization(
            tx, guard, &account, org,
        )
        .await?;
        self.guard()?;
        preview::require_enabled()?;
        validate_catalog(&request)?;
        ensure!(
            write.commit_read_before(valid_until).await?,
            "upgrade_preview_preparation_expired"
        );
        ensure!(
            super::team_financial_inventory::account_source_token(guard, &account)? == source_token
                && guard.read()?.organization_token(org)? == enrollment_token,
            "upgrade_preview_preparation_changed"
        );
        Ok(PreparedUpgradePreview {
            request,
            source_token,
            enrollment_token,
            valid_until,
        })
    }
    pub async fn enqueue(&self, prepared: PreparedUpgradePreview) -> Result<QueuedUpgradePreview> {
        let request = &prepared.request;
        request.validate()?;
        let guard = self.guard()?;
        let account = Account {
            account: request.scope.account.clone(),
            live: request.scope.live,
        };
        self.reconcile_history(&account).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::team_financial_locks::organization(
            &tx,
            &account.account,
            account.live,
            request.scope.organization,
        )
        .await?;
        AuthorizationService::require_locked_billing_owner(
            &tx,
            request.actor,
            request.scope.organization,
        )
        .await?;
        ensure!(
            tx.query_opt(
                "SELECT 1 FROM team_rollouts WHERE organization_id=$1 AND enabled FOR SHARE",
                &[&request.scope.organization]
            )
            .await?
            .is_some(),
            TeamError::Disabled
        );
        super::team_financial_ingress::require_authority(&tx, &account, Some(guard)).await?;
        ensure!(
            super::team_financial_transaction::source_mode(&tx, guard, &account).await?,
            "upgrade_preview_source_required"
        );
        let write = super::team_financial_transaction::NormalWrite::begin_organization(
            tx,
            guard,
            &account,
            request.scope.organization,
        )
        .await?;
        let existing = write
            .sql()
            .query_opt(
                "SELECT 1 FROM team_subscription_upgrade_previews WHERE quote_id=$1 FOR UPDATE",
                &[&request.quote_id],
            )
            .await?
            .is_some();
        let accepted = request.accepted_request()?;
        if existing {
            verify_request_history(write.sql(), request).await?;
            ensure!(
                guard
                    .read()?
                    .snapshot
                    .sources
                    .scopes
                    .get(&request.scope.key()?)
                    .and_then(|entry| entry.accepted.get(&request.quote_id))
                    == Some(&accepted),
                "upgrade_preview_original_acceptance_unconfirmed"
            );
            self.guard()?;
            ensure!(
                write.commit_operational(None).await?,
                "upgrade_preview_original_read_unconfirmed"
            );
            return Ok(ack(request, true));
        }
        preview::require_enabled()?;
        let independent = guard.read()?;
        ensure!(
            !operation_known(&independent.snapshot, request.quote_id),
            "upgrade_preview_nonce_retained_reconciliation_required"
        );
        ensure!(
            super::team_financial_inventory::account_source_token(guard, &account)?
                == prepared.source_token
                && independent.organization_token(request.scope.organization)?
                    == prepared.enrollment_token,
            "upgrade_preview_preparation_changed"
        );
        let now: DateTime<Utc> = write
            .sql()
            .query_one("SELECT clock_timestamp()", &[])
            .await?
            .get(0);
        let deadline = prepared.valid_until.min(request.expires_at);
        ensure!(
            prepared.valid_until
                <= request
                    .requested_at
                    .checked_add_signed(chrono::Duration::seconds(60))
                    .context("upgrade_preview_preparation_time_invalid")?
                && now >= request.requested_at
                && now < deadline,
            "upgrade_preview_preparation_expired"
        );
        validate_current(write.sql(), request, now).await?;
        validate_catalog(request)?;
        let metadata = serde_json::to_value(request)?;
        write.sql().execute("INSERT INTO team_subscription_upgrade_previews(quote_id,organization_id,account_id,livemode,actor_id,customer_id,subscription_id,request_metadata,request_sha256,idempotency_sha256,requested_at,expires_at,retry_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$11)",
            &[&request.quote_id,&request.scope.organization,&account.account,&account.live,&request.actor,&request.customer,&request.subscription,&metadata,&accepted.request_hash,&accepted.idempotency_hash,&request.requested_at,&request.expires_at]).await?;
        write.sql().execute("INSERT INTO team_subscription_upgrade_preview_audit(quote_id,organization_id,actor_id,recorded_at,request_sha256,action) VALUES($1,$2,$3,$4,$5,'request_upgrade_preview')", &[&request.quote_id,&request.scope.organization,&request.actor,&request.requested_at,&accepted.request_hash]).await?;
        self.guard()?;
        preview::require_enabled()?;
        validate_catalog(request)?;
        write
            .commit_upgrade_preview_request(
                Writer::UpgradePreviewRequest {
                    request: Box::new(request.clone()),
                },
                deadline,
            )
            .await?;
        self.guard()?;
        Ok(ack(request, false))
    }
}
fn ack(request: &PreviewRequest, duplicate: bool) -> QueuedUpgradePreview {
    QueuedUpgradePreview {
        schema_version: 1,
        quote_id: request.quote_id,
        requested_at: request.requested_at,
        expires_at: request.expires_at,
        duplicate,
        durable_acceptance: "observed",
        provider_preview: "unconfirmed",
    }
}
fn validate_catalog(request: &PreviewRequest) -> Result<()> {
    let catalog = Catalog::from_env(&request.scope.account, request.scope.live)?
        .context("upgrade_catalog_unavailable")?;
    let package =
        catalog.package(u16::try_from(request.to_seats).context("upgrade_package_invalid")?)?;
    ensure!(
        catalog.revision() == request.catalog_revision
            && catalog.digest()? == request.catalog_sha256
            && catalog.currency() == request.currency
            && package.price_id == request.to_price
            && package.amount_minor == request.to_amount_minor,
        "upgrade_catalog_changed"
    );
    Ok(())
}
async fn validate_current(
    tx: &Transaction<'_>,
    request: &PreviewRequest,
    now: DateTime<Utc>,
) -> Result<()> {
    let row=tx.query_opt("SELECT b.account_id,b.livemode,b.customer_id,b.subscription_id,b.revision,b.enabled,s.binding_revision,s.source_revision,s.subscription_item_id,s.price_id,s.currency,s.quantity,s.period_start,s.period_end,s.items_complete,s.cancel_at_period_end,s.observed_at,s.provider_status,j.requested_revision,j.applied_revision FROM team_stripe_bindings b JOIN team_stripe_snapshots s ON s.organization_id=b.organization_id JOIN team_stripe_reconcile_jobs j ON j.account_id=b.account_id AND j.livemode=b.livemode AND j.subscription_id=b.subscription_id WHERE b.organization_id=$1 FOR SHARE OF b,s,j", &[&request.scope.organization]).await?.context("upgrade_preview_current_subscription_missing")?;
    let observed: DateTime<Utc> = row.get(16);
    ensure!(
        row.get::<_, String>(0) == request.scope.account
            && row.get::<_, bool>(1) == request.scope.live
            && row.get::<_, String>(2) == request.customer
            && row.get::<_, String>(3) == request.subscription
            && row.get::<_, bool>(5)
            && row.get::<_, i64>(4) == request.binding_revision
            && row.get::<_, i64>(6) == request.binding_revision
            && row.get::<_, i64>(7) == request.source_revision
            && row.get::<_, i64>(18) == request.source_revision
            && row.get::<_, i64>(19) == request.source_revision
            && row.get::<_, Option<String>>(8).as_deref() == Some(request.item.as_str())
            && row.get::<_, Option<String>>(9).as_deref() == Some(request.from_price.as_str())
            && row.get::<_, Option<String>>(10).as_deref() == Some(request.currency.as_str())
            && row.get::<_, Option<i64>>(11) == Some(1)
            && row.get::<_, Option<DateTime<Utc>>>(12) == Some(request.period_start)
            && row.get::<_, Option<DateTime<Utc>>>(13) == Some(request.period_end)
            && row.get::<_, bool>(14)
            && !row.get::<_, bool>(15)
            && row.get::<_, String>(17) == "active"
            && observed <= now
            && now - observed < chrono::Duration::minutes(5),
        TeamError::ProjectionChanged
    );
    let state = super::team_analytics_entitlement::load(tx, request.scope.organization)
        .await?
        .context("upgrade_original_package_unconfirmed")?;
    state.validate()?;
    ensure!(
        state.package_seats == request.from_seats
            && state
                .scope
                .as_ref()
                .is_some_and(|scope| scope.account == request.scope.account
                    && scope.live == request.scope.live
                    && scope.customer == request.customer
                    && scope.subscription == request.subscription
                    && scope.binding_revision == request.binding_revision),
        TeamError::ProjectionChanged
    );
    Ok(())
}
pub(super) async fn verify_request_history(
    tx: &Transaction<'_>,
    request: &PreviewRequest,
) -> Result<()> {
    request.validate()?;
    let row = tx
        .query_opt(
            "SELECT * FROM team_subscription_upgrade_previews WHERE quote_id=$1 FOR SHARE",
            &[&request.quote_id],
        )
        .await?
        .context("upgrade_preview_committed_request_missing")?;
    let metadata: PreviewRequest = serde_json::from_value(row.get("request_metadata"))
        .map_err(|_| anyhow::anyhow!("upgrade_preview_saved_request_invalid"))?;
    let accepted = request.accepted_request()?;
    ensure!(
        metadata == *request
            && row.get::<_, Uuid>("organization_id") == request.scope.organization
            && row.get::<_, String>("account_id") == request.scope.account
            && row.get::<_, bool>("livemode") == request.scope.live
            && row.get::<_, Uuid>("actor_id") == request.actor
            && row.get::<_, String>("customer_id") == request.customer
            && row.get::<_, String>("subscription_id") == request.subscription
            && row.get::<_, String>("request_sha256") == accepted.request_hash
            && row.get::<_, String>("idempotency_sha256") == accepted.idempotency_hash
            && row.get::<_, DateTime<Utc>>("requested_at") == request.requested_at
            && row.get::<_, DateTime<Utc>>("expires_at") == request.expires_at,
        "upgrade_preview_original_request_changed"
    );
    ensure!(tx.query_opt("SELECT 1 FROM team_subscription_upgrade_preview_audit WHERE quote_id=$1 AND organization_id=$2 AND actor_id=$3 AND recorded_at=$4 AND request_sha256=$5 AND action='request_upgrade_preview' FOR SHARE", &[&request.quote_id,&request.scope.organization,&request.actor,&request.requested_at,&accepted.request_hash]).await?.is_some(),"upgrade_preview_request_audit_missing_or_changed");
    Ok(())
}
/// Historical exact-next only. No current Owner, catalog, expiry or HTTP grant.
pub(super) async fn committed_request(
    tx: &Transaction<'_>,
    account: &Account,
    writer: &Writer,
) -> Result<()> {
    let Writer::UpgradePreviewRequest { request } = writer else {
        anyhow::bail!("financial_transaction_writer_mismatch")
    };
    ensure!(
        request.scope.account == account.account && request.scope.live == account.live,
        "upgrade_preview_request_scope_changed"
    );
    verify_request_history(tx, request).await?;
    let row=tx.query_one("SELECT disposition,revision,last_observation_id,observed_at FROM team_subscription_upgrade_previews WHERE quote_id=$1 FOR SHARE", &[&request.quote_id]).await?;
    ensure!(
        row.get::<_, String>(0) == "pending"
            && row.get::<_, i64>(1) == 1
            && row.get::<_, Option<Uuid>>(2).is_none()
            && row.get::<_, Option<DateTime<Utc>>>(3).is_none(),
        "upgrade_preview_request_next_unconfirmed"
    );
    Ok(())
}

//! Immutable base price evidence with a current owner/customer/catalog fence.
use crate::{
    infrastructure::postgres::PostgresClient,
    services::{
        authorization::AuthorizationService, team_insights::TeamError,
        team_stripe_catalog::VerifiedOffer,
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;
#[derive(Clone, PartialEq)]
pub struct CustomerProof {
    pub operation: Uuid,
    pub revision: i64,
    pub customer: String,
    pub org: Uuid,
    pub actor: Uuid,
    pub account: String,
    pub live: bool,
}
#[derive(Serialize)]
pub struct Quote {
    pub id: Uuid,
    pub package_seats: i32,
    pub currency: String,
    pub amount_minor: String,
    pub tax_behavior: String,
    pub catalog_revision: String,
    pub catalog_sha256: String,
    pub observed_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub interval: &'static str,
    pub quantity: u16,
    pub total_due_minor: Option<String>,
    pub checkout_available: bool,
    pub test_checkout_confirmation_available: bool,
}
#[cfg(test)]
type AfterLegacyMode =
    std::sync::Arc<parking_lot::Mutex<Option<Box<dyn FnOnce() -> Result<()> + Send>>>>;
pub struct QuoteRepository {
    pg: Arc<PostgresClient>,
    authority: Option<crate::infrastructure::team_financial_guard::FinancialObservation>,
    configuration_error: bool,
    #[cfg(test)]
    after_legacy_mode: AfterLegacyMode,
}
impl QuoteRepository {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        match crate::infrastructure::team_financial_guard::FinancialObservation::from_environment()
        {
            Ok(authority) => Self {
                pg,
                authority: Some(authority),
                configuration_error: false,
                #[cfg(test)]
                after_legacy_mode: Default::default(),
            },
            Err(_) => Self {
                pg,
                authority: None,
                configuration_error: true,
                #[cfg(test)]
                after_legacy_mode: Default::default(),
            },
        }
    }
    pub fn new_guarded(
        pg: Arc<PostgresClient>,
        deployment: crate::infrastructure::team_financial_guard::CommercialDeployment,
    ) -> Self {
        Self {
            pg,
            authority: Some(deployment.observation()),
            configuration_error: false,
            #[cfg(test)]
            after_legacy_mode: Default::default(),
        }
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
        scope: &crate::services::team_financial_ingress::Scope,
    ) -> Result<bool> {
        let mode = super::team_financial_transaction::source_mode(tx, guard, scope).await?;
        #[cfg(test)]
        if !mode {
            let hook = self.after_legacy_mode.lock().take();
            if let Some(hook) = hook {
                hook()?;
            }
        }
        Ok(mode)
    }
    fn financial_guard(
        &self,
    ) -> Result<Option<&crate::infrastructure::team_financial_guard::FinancialGuard>> {
        ensure!(
            !self.configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        Ok(self.authority.as_ref().and_then(|a| a.guard()))
    }
    async fn settle_quote_history(
        &self,
        scope: &crate::services::team_financial_ingress::Scope,
    ) -> Result<()> {
        let Some(guard) = self.financial_guard()? else {
            return Ok(());
        };
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_ingress::lock(&tx, scope).await?;
        let is_quote = guard
            .read()?
            .snapshot
            .transactions
            .groups
            .values()
            .any(|g| {
                !g.committed
                    && g.proposal.account == *scope
                    && matches!(
                        g.proposal.writer,
                        Some(crate::services::team_financial_transaction::Writer::Quote { .. })
                    )
            });
        if is_quote {
            super::team_financial_transaction::reconcile_quote_history(tx, guard, scope).await?;
        } else {
            tx.rollback().await?;
        }
        Ok(())
    }
    pub(super) async fn guard(
        tx: &tokio_postgres::Transaction<'_>,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
    ) -> Result<CustomerProof> {
        super::team_financial_locks::organization(tx, account, live, org).await?;
        AuthorizationService::require_locked_billing_owner(tx, actor, org).await?;
        if tx
            .query_opt(
                "SELECT 1 FROM team_stripe_bindings WHERE organization_id=$1 FOR SHARE",
                &[&org],
            )
            .await?
            .is_some()
        {
            return Err(
                TeamError::Invalid("existing subscription requires a package-change flow").into(),
            );
        }
        let row=tx.query_opt("SELECT operation_id,revision,customer_id FROM team_stripe_customer_operations WHERE organization_id=$1 AND account_id=$2 AND livemode=$3 AND disposition='verified' AND customer_id IS NOT NULL FOR SHARE",&[&org,&account,&live]).await?.ok_or(TeamError::Invalid("verified billing customer required"))?;
        Ok(CustomerProof {
            operation: row.get(0),
            revision: row.get(1),
            customer: row.get(2),
            org,
            actor,
            account: account.into(),
            live,
        })
    }
    pub async fn customer(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
    ) -> Result<CustomerProof> {
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        self.settle_quote_history(&scope).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let proof = Self::guard(&tx, actor, org, account, live).await?;
        super::team_financial_ingress::require_authority(&tx, &scope, self.financial_guard()?)
            .await?;
        if let Some(guard) = self.financial_guard()? {
            super::team_financial_ingress::ready(&tx, guard, &scope).await?;
            let token = super::team_financial_inventory::account_source_token(guard, &scope)?;
            if self.source_mode(&tx, guard, &scope).await? {
                let write = super::team_financial_transaction::NormalWrite::begin_customer(
                    tx,
                    guard,
                    &scope,
                    org,
                    &proof.customer,
                )
                .await?;
                write.commit_operational(None).await?;
                return Ok(proof);
            }
            ensure!(
                super::team_financial_inventory::account_source_token(guard, &scope)? == token,
                "financial_source_changed_before_commit"
            );
        }
        tx.commit().await?;
        Ok(proof)
    }
    pub async fn save(
        &self,
        id: Uuid,
        proof: &CustomerProof,
        offer: &VerifiedOffer,
    ) -> Result<Quote> {
        let scope = crate::services::team_financial_ingress::Scope {
            account: proof.account.clone(),
            live: proof.live,
        };
        self.settle_quote_history(&scope).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let current = Self::guard(&tx, proof.actor, proof.org, &proof.account, proof.live).await?;
        ensure!(current == *proof, TeamError::ProjectionChanged);
        super::team_financial_ingress::require_authority(&tx, &scope, self.financial_guard()?)
            .await?;
        if let Some(guard) = self.financial_guard()? {
            super::team_financial_ingress::ready(&tx, guard, &scope).await?;
            let token = super::team_financial_inventory::account_source_token(guard, &scope)?;
            if self.source_mode(&tx, guard, &scope).await? {
                let write = super::team_financial_transaction::NormalWrite::begin_customer(
                    tx,
                    guard,
                    &scope,
                    proof.org,
                    &proof.customer,
                )
                .await?;
                let (quote, inserted, expires) =
                    Self::save_row(write.sql(), id, proof, offer).await?;
                if inserted {
                    write
                        .commit_quote(quote_writer(id, proof, offer)?, expires)
                        .await?;
                } else {
                    ensure!(
                        write.commit_quote_read(expires).await?,
                        TeamError::Invalid("quote expired; request a new quote")
                    );
                }
                return Ok(quote);
            }
            let (quote, _, _) = Self::save_row(&tx, id, proof, offer).await?;
            ensure!(
                super::team_financial_inventory::account_source_token(guard, &scope)? == token,
                "financial_source_changed_before_commit"
            );
            tx.commit().await?;
            return Ok(quote);
        }
        let (quote, _, _) = Self::save_row(&tx, id, proof, offer).await?;
        tx.commit().await?;
        Ok(quote)
    }
    async fn save_row(
        tx: &tokio_postgres::Transaction<'_>,
        id: Uuid,
        proof: &CustomerProof,
        offer: &VerifiedOffer,
    ) -> Result<(Quote, bool, DateTime<Utc>)> {
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        ensure!(
            offer.observed_at <= now + chrono::Duration::minutes(1)
                && offer.observed_at > now - chrono::Duration::minutes(10),
            TeamError::ProjectionChanged
        );
        let expires = (now + chrono::Duration::minutes(10))
            .min(offer.observed_at + chrono::Duration::minutes(10));
        let seats = i32::from(offer.package.seats);
        let inserted=tx.execute("INSERT INTO team_stripe_quotes(id,organization_id,actor_id,account_id,livemode,customer_operation,customer_revision,customer_id,package_seats,price_id,product_id,currency,amount_minor,tax_behavior,catalog_revision,catalog_sha256,observed_at,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT(id) DO NOTHING",&[&id,&proof.org,&proof.actor,&proof.account,&proof.live,&proof.operation,&proof.revision,&proof.customer,&seats,&offer.package.price_id,&offer.package.product_id,&offer.currency,&offer.package.amount_minor,&offer.package.tax_behavior,&offer.catalog_revision.to_string(),&offer.catalog_sha256,&offer.observed_at,&expires,&now]).await?;
        let row = tx
            .query_one("SELECT * FROM team_stripe_quotes WHERE id=$1", &[&id])
            .await?;
        Self::check(&row, proof, &offer.catalog_sha256)?;
        ensure!(
            row.get::<_, i32>("package_seats") == seats
                && row.get::<_, String>("price_id") == offer.package.price_id
                && row.get::<_, i64>("amount_minor") == offer.package.amount_minor
                && row.get::<_, String>("currency") == offer.currency,
            TeamError::ProjectionChanged
        );
        ensure!(
            row.get::<_, DateTime<Utc>>("expires_at") > now,
            TeamError::Invalid("quote expired; request a new quote")
        );
        ensure!(
            row_offer_hash(&row)? == offer_hash(offer)?,
            TeamError::ProjectionChanged
        );
        let expires = row.get("expires_at");
        let quote = Self::view(&row);
        Ok((quote, inserted == 1, expires))
    }
    pub async fn get(&self, proof: &CustomerProof, id: Uuid, digest: &str) -> Result<Quote> {
        let scope = crate::services::team_financial_ingress::Scope {
            account: proof.account.clone(),
            live: proof.live,
        };
        self.settle_quote_history(&scope).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let current = Self::guard(&tx, proof.actor, proof.org, &proof.account, proof.live).await?;
        super::team_financial_ingress::require_authority(&tx, &scope, self.financial_guard()?)
            .await?;
        if let Some(guard) = self.financial_guard()? {
            super::team_financial_ingress::ready(&tx, guard, &scope).await?;
            let token = super::team_financial_inventory::account_source_token(guard, &scope)?;
            if self.source_mode(&tx, guard, &scope).await? {
                let write = super::team_financial_transaction::NormalWrite::begin_customer(
                    tx,
                    guard,
                    &scope,
                    proof.org,
                    &current.customer,
                )
                .await?;
                let result = Self::get_row(write.sql(), &current, id, digest).await?;
                let expires = result.expires_at;
                ensure!(write.commit_quote_read(expires).await?, TeamError::NotFound);
                return Ok(result);
            }
            let result = Self::get_row(&tx, &current, id, digest).await?;
            ensure!(
                super::team_financial_inventory::account_source_token(guard, &scope)? == token,
                "financial_source_changed_before_commit"
            );
            tx.commit().await?;
            return Ok(result);
        }
        let result = Self::get_row(&tx, &current, id, digest).await?;
        tx.commit().await?;
        Ok(result)
    }
    async fn get_row(
        tx: &tokio_postgres::Transaction<'_>,
        current: &CustomerProof,
        id: Uuid,
        digest: &str,
    ) -> Result<Quote> {
        let row=tx.query_opt("SELECT * FROM team_stripe_quotes WHERE id=$1 AND organization_id=$2 AND actor_id=$3 AND expires_at>clock_timestamp()",&[&id,&current.org,&current.actor]).await?.ok_or(TeamError::NotFound)?;
        Self::check(&row, current, digest)?;
        Ok(Self::view(&row))
    }
    pub(super) fn check(row: &tokio_postgres::Row, p: &CustomerProof, digest: &str) -> Result<()> {
        ensure!(
            row.get::<_, Uuid>("organization_id") == p.org
                && row.get::<_, Uuid>("actor_id") == p.actor
                && row.get::<_, String>("account_id") == p.account
                && row.get::<_, bool>("livemode") == p.live
                && row.get::<_, Uuid>("customer_operation") == p.operation
                && row.get::<_, i64>("customer_revision") == p.revision
                && row.get::<_, String>("customer_id") == p.customer
                && row.get::<_, String>("catalog_sha256") == digest,
            TeamError::ProjectionChanged
        );
        Ok(())
    }
    fn view(r: &tokio_postgres::Row) -> Quote {
        Quote {
            id: r.get("id"),
            package_seats: r.get("package_seats"),
            currency: r.get("currency"),
            amount_minor: r.get::<_, i64>("amount_minor").to_string(),
            tax_behavior: r.get("tax_behavior"),
            catalog_revision: r.get("catalog_revision"),
            catalog_sha256: r.get("catalog_sha256"),
            observed_at: r.get("observed_at"),
            expires_at: r.get("expires_at"),
            interval: "month",
            quantity: 1,
            total_due_minor: None,
            checkout_available: false,
            test_checkout_confirmation_available: false,
        }
    }
}

fn offer_hash(offer: &VerifiedOffer) -> Result<String> {
    ensure!(
        offer.interval == "month" && offer.quantity == 1,
        "financial_quote_terms_unsupported"
    );
    crate::services::team_financial_guard::fingerprint(&(
        "quote_offer_v1",
        &offer.package,
        &offer.currency,
        offer.catalog_revision,
        &offer.catalog_sha256,
        offer.observed_at.timestamp_micros(),
        offer.interval,
        offer.quantity,
    ))
}
fn row_offer_hash(row: &tokio_postgres::Row) -> Result<String> {
    let package = crate::services::team_stripe_catalog::Package {
        seats: u16::try_from(row.get::<_, i32>("package_seats"))?,
        price_id: row.get("price_id"),
        product_id: row.get("product_id"),
        amount_minor: row.get("amount_minor"),
        tax_behavior: row.get("tax_behavior"),
    };
    let revision = row
        .get::<_, String>("catalog_revision")
        .parse::<u64>()
        .context("financial_quote_catalog_invalid")?;
    crate::services::team_financial_guard::fingerprint(&(
        "quote_offer_v1",
        package,
        row.get::<_, String>("currency"),
        revision,
        row.get::<_, String>("catalog_sha256"),
        row.get::<_, DateTime<Utc>>("observed_at")
            .timestamp_micros(),
        "month",
        1_u16,
    ))
}
fn quote_writer(
    id: Uuid,
    proof: &CustomerProof,
    offer: &VerifiedOffer,
) -> Result<crate::services::team_financial_transaction::Writer> {
    Ok(crate::services::team_financial_transaction::Writer::Quote {
        organization: proof.org,
        actor: proof.actor,
        quote: id,
        customer_operation: proof.operation,
        customer_revision: proof.revision,
        customer: proof.customer.clone(),
        offer_hash: offer_hash(offer)?,
    })
}
/// Exact committed immutable history only; no current owner/catalog/expiry grant.
pub(super) async fn committed_quote(
    tx: &tokio_postgres::Transaction<'_>,
    scope: &crate::services::team_financial_ingress::Scope,
    writer: &crate::services::team_financial_transaction::Writer,
) -> Result<()> {
    let crate::services::team_financial_transaction::Writer::Quote {
        organization,
        actor,
        quote,
        customer_operation,
        customer_revision,
        customer,
        offer_hash,
    } = writer
    else {
        anyhow::bail!("financial_transaction_writer_mismatch");
    };
    let row=tx.query_opt("SELECT * FROM team_stripe_quotes WHERE id=$1 AND organization_id=$2 AND actor_id=$3 AND account_id=$4 AND livemode=$5 AND customer_operation=$6 AND customer_revision=$7 AND customer_id=$8",&[quote,organization,actor,&scope.account,&scope.live,customer_operation,customer_revision,customer]).await?.context("financial_quote_commit_unconfirmed")?;
    ensure!(
        row_offer_hash(&row)? == *offer_hash,
        "financial_quote_immutable_terms_changed"
    );
    let created: DateTime<Utc> = row.get("created_at");
    let expires: DateTime<Utc> = row.get("expires_at");
    let observed: DateTime<Utc> = row.get("observed_at");
    ensure!(
        expires > created
            && expires <= created + chrono::Duration::minutes(10)
            && expires <= observed + chrono::Duration::minutes(10),
        "financial_quote_lifetime_invalid"
    );
    Ok(())
}

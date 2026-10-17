//! Immutable base price evidence with a current owner/customer/catalog fence.
use crate::{
    infrastructure::postgres::PostgresClient,
    services::{
        authorization::AuthorizationService, team_insights::TeamError,
        team_stripe_catalog::VerifiedOffer,
    },
};
use anyhow::{ensure, Result};
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
pub struct QuoteRepository {
    pg: Arc<PostgresClient>,
}
impl QuoteRepository {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        Self { pg }
    }
    pub(super) async fn guard(
        tx: &tokio_postgres::Transaction<'_>,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
    ) -> Result<CustomerProof> {
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
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let proof = Self::guard(&tx, actor, org, account, live).await?;
        tx.commit().await?;
        Ok(proof)
    }
    pub async fn save(
        &self,
        id: Uuid,
        proof: &CustomerProof,
        offer: &VerifiedOffer,
    ) -> Result<Quote> {
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let current = Self::guard(&tx, proof.actor, proof.org, &proof.account, proof.live).await?;
        ensure!(
            current.operation == proof.operation
                && current.revision == proof.revision
                && current.customer == proof.customer,
            TeamError::ProjectionChanged
        );
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        ensure!(
            offer.observed_at <= now + chrono::Duration::minutes(1)
                && offer.observed_at > now - chrono::Duration::minutes(10),
            TeamError::ProjectionChanged
        );
        let expires = (now + chrono::Duration::minutes(10))
            .min(offer.observed_at + chrono::Duration::minutes(10));
        let seats = i32::from(offer.package.seats);
        tx.execute("INSERT INTO team_stripe_quotes(id,organization_id,actor_id,account_id,livemode,customer_operation,customer_revision,customer_id,package_seats,price_id,product_id,currency,amount_minor,tax_behavior,catalog_revision,catalog_sha256,observed_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(id) DO NOTHING",&[&id,&proof.org,&proof.actor,&proof.account,&proof.live,&proof.operation,&proof.revision,&proof.customer,&seats,&offer.package.price_id,&offer.package.product_id,&offer.currency,&offer.package.amount_minor,&offer.package.tax_behavior,&offer.catalog_revision.to_string(),&offer.catalog_sha256,&offer.observed_at,&expires]).await?;
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
        let quote = Self::view(&row);
        tx.commit().await?;
        Ok(quote)
    }
    pub async fn get(&self, proof: &CustomerProof, id: Uuid, digest: &str) -> Result<Quote> {
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let current = Self::guard(&tx, proof.actor, proof.org, &proof.account, proof.live).await?;
        let row=tx.query_opt("SELECT * FROM team_stripe_quotes WHERE id=$1 AND organization_id=$2 AND actor_id=$3 AND expires_at>clock_timestamp()",&[&id,&proof.org,&proof.actor]).await?.ok_or(TeamError::NotFound)?;
        Self::check(&row, &current, digest)?;
        let result = Self::view(&row);
        tx.commit().await?;
        Ok(result)
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

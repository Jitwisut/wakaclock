//! Typed Checkout lifecycle and exact historical readback, never a provider grant.
use crate::services::{
    team_financial_ingress::Scope as Account,
    team_financial_source::{AcceptedRequest, Scope},
    team_financial_transaction::{CheckoutStage, Writer},
    team_stripe_checkout::{ExpectedSession, FrozenRequest},
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use tokio_postgres::{Row, Transaction};
use uuid::Uuid;

/// Recompute the original accepted contract from retained metadata only. Current
/// configuration/actor/return URL may never regenerate an older request.
pub(super) fn original(row: &Row, quote: &Row, scope: &Scope) -> Result<AcceptedRequest> {
    ensure!(
        row.get::<_, Uuid>("organization_id") == scope.organization
            && row.get::<_, String>("account_id") == scope.account
            && row.get::<_, bool>("livemode") == scope.live
            && row.get::<_, Uuid>("quote_id") == quote.get::<_, Uuid>("id")
            && quote.get::<_, Uuid>("organization_id") == scope.organization
            && quote.get::<_, String>("account_id") == scope.account
            && quote.get::<_, bool>("livemode") == scope.live
            && row.get::<_, Uuid>("actor_id") == quote.get::<_, Uuid>("actor_id"),
        "financial_checkout_original_scope_changed"
    );
    let customer: String = quote.get("customer_id");
    let price: String = quote.get("price_id");
    let currency: String = quote.get("currency");
    let expected = ExpectedSession {
        operation: row.get("operation_id"),
        customer: &customer,
        price: &price,
        currency: &currency,
        amount_minor: quote.get("amount_minor"),
        live: scope.live,
    };
    let value: serde_json::Value = row
        .get::<_, Option<serde_json::Value>>("request_metadata")
        .context("financial_checkout_request_missing")?;
    let hash: String = row
        .get::<_, Option<String>>("request_sha256")
        .context("financial_checkout_request_missing")?;
    FrozenRequest::restore(&value, &hash, &expected)?.accepted(
        scope,
        row.get("actor_id"),
        row.get("quote_id"),
        &expected,
        row.get("confirmed_at"),
    )
}

/// Exact-next SQL evidence for a retained lifecycle writer after a lost Confirm.
/// The full coordinator additionally checks every source/enrollment checkpoint.
pub(super) async fn committed(
    tx: &Transaction<'_>,
    account: &Account,
    writer: &Writer,
) -> Result<()> {
    let Writer::CheckoutLifecycle {
        organization,
        request,
        expected_revision,
        stage,
    } = writer
    else {
        anyhow::bail!("financial_transaction_writer_mismatch");
    };
    let row = tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4", &[&request.operation, organization, &account.account, &account.live]).await?.context("financial_checkout_request_missing")?;
    let quote = tx
        .query_one(
            "SELECT * FROM team_stripe_quotes WHERE id=$1",
            &[&row.get::<_, Uuid>("quote_id")],
        )
        .await?;
    let scope = Scope {
        organization: *organization,
        account: account.account.clone(),
        live: account.live,
    };
    ensure!(
        original(&row, &quote, &scope)? == *request,
        "financial_checkout_original_request_changed"
    );
    let revision: i64 = row.get("revision");
    let first: Option<DateTime<Utc>> = row.get("first_attempt_at");
    match stage {
        CheckoutStage::ResumeReadback {
            first_attempt_at,
            actor,
            session,
        } => ensure!(
            revision
                == expected_revision
                    .checked_add(1)
                    .context("financial_checkout_revision_overflow")?
                && first == *first_attempt_at
                && row.get::<_, bool>("lookup_only")
                && row
                    .get::<_, Option<Uuid>>("recovery_actor")
                    .unwrap_or(row.get("actor_id"))
                    == *actor
                && row.get::<_, Option<String>>("session_id") == *session
                && row.get::<_, String>("disposition") == "pending",
            "financial_checkout_resume_next_unconfirmed"
        ),
        CheckoutStage::FirstAttempt { first_attempt_at } => ensure!(
            revision == *expected_revision
                && revision == 1
                && first == Some(*first_attempt_at)
                && row.get::<_, String>("disposition") == "pending"
                && !row.get::<_, bool>("lookup_only")
                && row.get::<_, Option<Uuid>>("recovery_actor").is_none()
                && row.get::<_, Option<String>>("session_id").is_none()
                && row.get::<_, Option<String>>("subscription_id").is_none(),
            "financial_checkout_first_attempt_next_unconfirmed"
        ),
        CheckoutStage::Stop {
            first_attempt_at,
            lookup_only,
            recovery_actor,
            reason,
            ..
        } => {
            ensure!(
                revision
                    == expected_revision
                        .checked_add(1)
                        .context("financial_checkout_revision_overflow")?
                    && first == *first_attempt_at
                    && row.get::<_, bool>("lookup_only") == *lookup_only
                    && row.get::<_, Option<Uuid>>("recovery_actor") == *recovery_actor
                    && row.get::<_, String>("disposition")
                        == CheckoutStage::stop_disposition(reason)?
                    && row.get::<_, Option<String>>("last_error_code").as_deref()
                        == Some(reason.as_str()),
                "financial_checkout_stop_next_unconfirmed"
            );
        }
        CheckoutStage::RecoveryAuthorization {
            first_attempt_at,
            actor,
            authorized_at,
        } => {
            ensure!(
                revision
                    == expected_revision
                        .checked_add(1)
                        .context("financial_checkout_revision_overflow")?
                    && first == *first_attempt_at
                    && row.get::<_, bool>("lookup_only")
                    && row.get::<_, Option<Uuid>>("recovery_actor") == Some(*actor)
                    && row.get::<_, String>("disposition") == "pending",
                "financial_checkout_authorization_next_unconfirmed"
            );
            let authorization = tx.query_opt("SELECT actor_id,authorized_at,action FROM team_stripe_checkout_authorizations WHERE operation_id=$1 AND revision=$2", &[&request.operation, &revision]).await?.context("financial_checkout_authorization_missing")?;
            ensure!(
                authorization.get::<_, Uuid>(0) == *actor
                    && authorization.get::<_, DateTime<Utc>>(1) == *authorized_at
                    && authorization.get::<_, String>(2) == "reconcile_existing_checkout",
                "financial_checkout_authorization_changed"
            );
        }
    }
    if !matches!(
        stage,
        CheckoutStage::FirstAttempt { .. } | CheckoutStage::ResumeReadback { .. }
    ) {
        ensure!(
            row.get::<_, Option<Uuid>>("lease_id").is_none()
                && row.get::<_, Option<DateTime<Utc>>>("lease_until").is_none(),
            "financial_checkout_next_lease_unconfirmed"
        );
    }
    Ok(())
}

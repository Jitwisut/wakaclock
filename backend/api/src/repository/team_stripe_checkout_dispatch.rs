//! A captured Checkout claim checked again immediately before a provider request.
use super::{CheckoutClaim, CheckoutRepository, CheckoutTransaction};
use crate::{
    infrastructure::{postgres::PostgresClient, team_financial_guard::FinancialGuard},
    repository::{
        team_financial_inventory as inventory, team_stripe_checkout_control as control,
        team_stripe_quote::QuoteRepository,
    },
    services::{
        team_financial_guard::fingerprint,
        team_financial_ingress::Scope as Account,
        team_financial_source::{AcceptedRequest, Scope},
        team_financial_transaction::{CheckoutStage, Writer},
        team_stripe_checkout::SessionEvidence,
        team_stripe_checkout_receipt::{Attempt, ObservationKind},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

pub(crate) struct Proof {
    pg: Arc<PostgresClient>,
    guard: Option<FinancialGuard>,
    scope: Scope,
    request: AcceptedRequest,
    token: Option<String>,
    source_mode: bool,
    claim_hash: String,
}
fn identity(c: &CheckoutClaim) -> Result<String> {
    fingerprint(&(
        c.operation,
        c.revision,
        c.lease,
        (
            c.proof.operation,
            c.proof.revision,
            &c.proof.customer,
            c.proof.org,
            c.proof.actor,
            &c.proof.account,
            c.proof.live,
        ),
        (
            &c.price,
            &c.currency,
            c.amount_minor,
            c.seats,
            &c.catalog_hash,
        ),
        c.request.digest()?,
        &c.session_id,
        c.lookup_only,
    ))
}
impl Proof {
    pub(super) fn new(
        repo: &CheckoutRepository,
        c: &CheckoutClaim,
        request: AcceptedRequest,
        token: Option<String>,
        source_mode: bool,
    ) -> Result<Self> {
        ensure!(
            request.operation == c.operation,
            "financial_checkout_claim_identity_changed"
        );
        Ok(Self {
            pg: repo.pg.clone(),
            guard: repo.financial_guard.clone(),
            scope: Scope {
                organization: c.proof.org,
                account: c.proof.account.clone(),
                live: c.proof.live,
            },
            request,
            token,
            source_mode,
            claim_hash: identity(c)?,
        })
    }
    pub(super) fn source_request<'a>(
        &'a self,
        c: &CheckoutClaim,
        guard: &FinancialGuard,
    ) -> Result<&'a AcceptedRequest> {
        ensure!(
            self.source_mode
                && identity(c)? == self.claim_hash
                && self
                    .guard
                    .as_ref()
                    .is_some_and(|captured| captured.same_authority(guard)),
            "financial_checkout_claim_identity_changed"
        );
        Ok(&self.request)
    }
    pub(super) fn retain(
        &self,
        c: &CheckoutClaim,
        evidence: &SessionEvidence,
        kind: ObservationKind,
    ) -> Result<()> {
        ensure!(
            identity(c)? == self.claim_hash
                && evidence.operation == c.operation
                && evidence.customer == c.proof.customer
                && evidence.price == c.price
                && evidence.currency == c.currency
                && evidence.amount_minor == c.amount_minor
                && evidence.live == c.proof.live,
            "financial_checkout_claim_identity_changed"
        );
        if let Some(guard) = &self.guard {
            guard.retain_checkout_observation(
                self.scope.clone(),
                &self.request,
                Attempt {
                    actor: c.proof.actor,
                    revision: c.revision,
                    lease: c.lease,
                    source_claim: self.source_mode,
                },
                kind,
                evidence,
            )?;
        }
        Ok(())
    }
    pub(super) fn retain_failure(
        &self,
        c: &CheckoutClaim,
        detail: crate::services::team_stripe_checkout_receipt::FailureDetail,
    ) -> Result<Option<Uuid>> {
        ensure!(
            identity(c)? == self.claim_hash,
            "financial_checkout_claim_identity_changed"
        );
        self.guard
            .as_ref()
            .map(|guard| {
                guard.retain_checkout_failure(
                    self.scope.clone(),
                    &self.request,
                    Attempt {
                        actor: c.proof.actor,
                        revision: c.revision,
                        lease: c.lease,
                        source_claim: self.source_mode,
                    },
                    detail,
                )
            })
            .transpose()
            .map(Option::flatten)
    }
    pub(super) async fn preflight(
        &self,
        c: &CheckoutClaim,
        authority: Option<&FinancialGuard>,
        create: bool,
    ) -> Result<()> {
        ensure!(
            identity(c)? == self.claim_hash
                && match (&self.guard, authority) {
                    (Some(a), Some(b)) => a.same_authority(b),
                    (None, None) => true,
                    _ => false,
                },
            "financial_checkout_authority_changed"
        );
        let account = Account {
            account: self.scope.account.clone(),
            live: self.scope.live,
        };
        let current_token = || {
            self.guard
                .as_ref()
                .map(|g| {
                    if self.source_mode {
                        inventory::checkout_claim_token(g, &self.scope, c.operation)
                    } else {
                        inventory::account_source_token(g, &account)
                    }
                })
                .transpose()
        };
        ensure!(
            current_token()? == self.token,
            "financial_checkout_source_changed"
        );
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let repo = CheckoutRepository::with_financial_authority(
            self.pg.clone(),
            self.guard.clone(),
            false,
        );
        // Account and all currently known participant locks precede Owner/rows.
        let pending_observation = if self.source_mode {
            let state = self
                .guard
                .as_ref()
                .context("financial_guard_configuration_unconfirmed")?
                .read()?
                .snapshot;
            let entry = state
                .sources
                .scopes
                .get(&self.scope.key()?)
                .context("financial_source_uninitialized")?;
            if entry
                .outcomes
                .values()
                .any(|o| o.operation == c.operation && entry.unapplied_outcomes.contains(&o.id))
            {
                ensure!(!create, "financial_checkout_result_already_observed");
                Some(
                    entry
                        .checkout_observations
                        .values()
                        .filter(|value| {
                            value.source_claim
                                && value.operation == c.operation
                                && value.actor == c.proof.actor
                                && value.revision == c.revision
                                && value.lease == c.lease
                        })
                        .max_by_key(|value| {
                            (
                                value.kind == ObservationKind::ResourceRead,
                                value.observed_at,
                            )
                        })
                        .context("financial_checkout_observation_missing")?
                        .clone(),
                )
            } else {
                None
            }
        } else {
            None
        };
        let write = if let Some(observation) = pending_observation {
            CheckoutTransaction::Source(
                crate::repository::team_stripe_checkout_projection::begin(
                    tx,
                    self.guard
                        .as_ref()
                        .context("financial_guard_configuration_unconfirmed")?,
                    &self.scope,
                    &observation,
                )
                .await?,
            )
        } else {
            repo.read(tx, c.proof.org, &c.proof.account, c.proof.live)
                .await?
        };
        ensure!(
            matches!(&write, CheckoutTransaction::Source(_)) == self.source_mode,
            "financial_checkout_source_changed"
        );
        let customer = QuoteRepository::guard(
            write.sql(),
            c.proof.actor,
            c.proof.org,
            &c.proof.account,
            c.proof.live,
        )
        .await?;
        ensure!(customer == c.proof, "financial_checkout_customer_changed");
        let row = write.sql().query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND revision=$5 AND lease_id=$6 AND lease_until>clock_timestamp() AND COALESCE(recovery_actor,actor_id)=$7 AND session_id IS NOT DISTINCT FROM $8 AND disposition IN ('pending','session_open','awaiting_verification') FOR SHARE", &[&c.operation,&c.proof.org,&c.proof.account,&c.proof.live,&c.revision,&c.lease,&c.proof.actor,&c.session_id]).await?.context("financial_checkout_lease_unconfirmed")?;
        let quote = write
            .sql()
            .query_one(
                "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                &[&row.get::<_, Uuid>("quote_id")],
            )
            .await?;
        ensure!(
            control::original(&row, &quote, &self.scope)? == self.request,
            "financial_checkout_original_request_changed"
        );
        CheckoutRepository::check_recovery_scope(&quote, &customer)?;
        let now: DateTime<Utc> = write
            .sql()
            .query_one("SELECT clock_timestamp()", &[])
            .await?
            .get(0);
        let first: Option<DateTime<Utc>> = row.get("first_attempt_at");
        let mut deadline: DateTime<Utc> = row.get("lease_until");
        if let Some(actor) = row.get::<_, Option<Uuid>>("recovery_actor") {
            ensure!(
                actor == c.proof.actor && row.get::<_, bool>("lookup_only"),
                "financial_checkout_recovery_actor_changed"
            );
            let auth = write.sql().query_opt("SELECT revision,actor_id,authorized_at,action FROM team_stripe_checkout_authorizations WHERE operation_id=$1 AND revision<=$2 ORDER BY revision DESC LIMIT 1", &[&c.operation,&c.revision]).await?.context("financial_checkout_authorization_missing")?;
            ensure!(
                auth.get::<_, Uuid>(1) == actor
                    && auth.get::<_, String>(3) == "reconcile_existing_checkout",
                "financial_checkout_authorization_changed"
            );
            if self.source_mode {
                let guard = self
                    .guard
                    .as_ref()
                    .context("financial_guard_configuration_unconfirmed")?;
                let state = guard.read()?.snapshot;
                ensure!(state.transactions.groups.values().any(|group| group.committed && group.proposal.account == account
                    && matches!(&group.proposal.writer, Some(Writer::CheckoutLifecycle { organization, request, expected_revision, stage: CheckoutStage::RecoveryAuthorization { actor: a, authorized_at, .. } })
                        if *organization == c.proof.org && request == &self.request && *a == actor
                        && expected_revision.checked_add(1) == Some(auth.get::<_,i64>(0))
                        && *authorized_at == auth.get::<_,DateTime<Utc>>(2))), "financial_checkout_authorization_unconfirmed");
            }
        }
        if create {
            ensure!(
                !c.lookup_only
                    && c.session_id.is_none()
                    && c.revision == 1
                    && row.get::<_, String>("disposition") == "pending"
                    && !row.get::<_, bool>("lookup_only")
                    && row.get::<_, Option<Uuid>>("recovery_actor").is_none()
                    && (self.guard.is_none() || self.source_mode),
                "financial_checkout_create_not_authorized"
            );
            CheckoutRepository::capacity(write.sql(), c.proof.org, i32::from(c.seats)).await?;
            let first = first.context("financial_checkout_first_attempt_missing")?;
            ensure!(
                first >= self.request.accepted_at && now >= first,
                "financial_checkout_first_attempt_unconfirmed"
            );
            deadline = deadline.min(first + chrono::Duration::hours(23));
            if let Some(guard) = &self.guard {
                let state = guard.read()?.snapshot;
                let entry = state
                    .sources
                    .scopes
                    .get(&self.scope.key()?)
                    .context("financial_source_uninitialized")?;
                ensure!(
                    entry.accepted.get(&c.operation) == Some(&self.request)
                        && entry
                            .dispatches
                            .get(&c.operation)
                            .is_some_and(|d| d.first_attempt_at == first
                                && d.request_hash == self.request.request_hash
                                && d.idempotency_hash == self.request.idempotency_hash),
                    "financial_checkout_dispatch_unconfirmed"
                );
            }
        } else if c.session_id.is_none() && c.lookup_only {
            ensure!(
                c.lookup_only
                    && (row.get::<_, bool>("lookup_only")
                        || first.is_some_and(
                            |t| now.signed_duration_since(t) >= chrono::Duration::hours(23)
                        )),
                "financial_checkout_lookup_not_authorized"
            );
        }
        ensure!(
            current_token()? == self.token,
            "financial_checkout_source_changed"
        );
        write.commit_before(deadline).await
    }
}

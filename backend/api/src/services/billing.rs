use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::billing::{Invoice, OrganizationBilling};
use crate::services::authorization::{AuthorizationService, OrganizationAction};

pub struct BillingService {
    postgres: Option<Arc<PostgresClient>>,
    authorization: Arc<AuthorizationService>,
}

impl BillingService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        authorization: Arc<AuthorizationService>,
    ) -> Self {
        Self {
            postgres,
            authorization,
        }
    }

    pub async fn team_trial_status(
        &self,
        actor: Uuid,
        org: Uuid,
    ) -> Result<super::team_trial::TrialStatus> {
        super::team_trial::require_enabled()?;
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let deployment = crate::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let mut result =
            crate::repository::team_trial::status(&pg, org, actor, &deployment).await?;
        // A committed trial changes privacy generation. Never rewrite/export the
        // independent registry here to make activation look analytics-ready.
        let privacy = crate::repository::team_trust::TeamTrustRepository::new(pg.clone())
            .guard(org)
            .await
            .is_ok();
        if privacy
            && !matches!(
                result.disposition,
                super::team_trial::Disposition::RecoveryRequired
                    | super::team_trial::Disposition::Unconfirmed
            )
        {
            result.analytics_status = "observed";
            result.analytics_reason =
                "privacy_and_enrollment_agree_consent_and_fact_admission_still_required";
        }
        crate::repository::team_trial::validate(&pg, org, actor, &deployment, &result).await?;
        Ok(result)
    }
    pub async fn stripe_portal_destination(
        &self,
        actor: Uuid,
        org: Uuid,
        input: super::team_stripe_portal::PortalRequest,
    ) -> Result<super::team_stripe_portal::HostedPortal> {
        input.validate()?;
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        anyhow::ensure!(
            super::team_stripe_portal::enabled()?,
            super::team_insights::TeamError::Disabled
        );
        let config = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("Stripe unavailable")?;
        let policy = super::team_stripe_portal::PortalPolicy::from_environment(
            &config.account_id,
            config.livemode,
        )?;
        let account = config.account_id.clone();
        let live = config.livemode;
        let client = crate::infrastructure::stripe::StripeClient::new(config)?;
        let deployment=crate::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let runtime = crate::repository::team_stripe::TeamStripeRepository::new_guarded(
            pg.clone(),
            deployment.clone(),
        );
        let repository =
            crate::repository::team_stripe_portal::PortalRepository::new(pg, deployment);
        let lease = runtime
            .claim_scope(&account, live)
            .await?
            .context("Stripe account busy or backing off")?;
        let proof = match repository.proof(actor, org, &policy, lease).await {
            Ok(proof) => proof,
            Err(error) => {
                runtime.finish_scope(&account, live, lease, false).await?;
                return Err(error);
            }
        };
        let result = match client
            .portal_destination(&proof, &policy, input.request_id)
            .await
        {
            Ok(result) => result,
            Err(super::team_stripe_portal::PortalFailure::Authority(error)) => {
                runtime.finish_scope(&account, live, lease, false).await?;
                return Err(error);
            }
            Err(super::team_stripe_portal::PortalFailure::Provider(error)) => {
                runtime.fail_scope(&account, live, lease, &error).await?;
                return Err(anyhow::anyhow!(
                    "portal unavailable or unconfirmed; request a fresh check"
                ));
            }
        };
        anyhow::ensure!(
            runtime.finish_scope(&account, live, lease, true).await?,
            "portal_scope_lease_unconfirmed"
        );
        // The final proof deliberately excludes the now-released operational
        // lease but repeats Owner/customer/binding/source/config checks.
        proof.response_fence(&policy).await?;
        result.fresh_at(chrono::Utc::now())?;
        Ok(result)
    }
    pub async fn team_cancellation_view(
        &self,
        actor: Uuid,
        org: Uuid,
        operation: Option<Uuid>,
    ) -> Result<super::team_subscription_cancellation::CancellationView> {
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let deployment=crate::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        crate::repository::team_subscription_cancellation::CancellationRepository::new(
            pg, deployment,
        )
        .cancellation_view(actor, org, operation)
        .await
    }
    /// Reads accepted history without requiring a live provider credential or
    /// the mutation flag. Current Owner/source/generation fences still apply.
    pub async fn team_cancellation_status(
        &self,
        actor: Uuid,
        org: Uuid,
        operation: Uuid,
    ) -> Result<super::team_subscription_cancellation::CancellationStatus> {
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let deployment = crate::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let repository =
            crate::repository::team_subscription_cancellation::CancellationRepository::new(
                pg, deployment,
            );
        repository
            .find_saved(actor, org, operation)
            .await?
            .context("cancellation_saved_acceptance_unconfirmed_reconciliation_required")?
            .response()
            .await
    }
    /// Explicit current-Owner authorization of resource readback only. This can
    /// never create a fresh cancellation or reset its first possible send time.
    pub async fn recover_team_cancellation(
        &self,
        actor: Uuid,
        org: Uuid,
        input: super::team_subscription_cancellation::RecoverCancellation,
    ) -> Result<super::team_subscription_cancellation::CancellationStatus> {
        input.validate()?;
        super::team_subscription_cancellation::require_enabled()?;
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let deployment=crate::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let repository =
            crate::repository::team_subscription_cancellation::CancellationRepository::new(
                pg, deployment,
            );
        repository
            .authorize_readback(actor, org, input.operation_id, input.expected_revision)
            .await?;
        self.team_cancellation_status(actor, org, input.operation_id)
            .await
    }
    /// Unknown response -> inspect the original operation first. Existing
    /// acceptance never calls the provider, renews a read or creates a new nonce.
    /// This method is not routed until the lifecycle/worker/API is complete.
    pub async fn accept_team_cancellation(
        &self,
        actor: Uuid,
        org: Uuid,
        input: super::team_subscription_cancellation::CancellationSelection,
    ) -> Result<super::team_subscription_cancellation::CancellationStatus> {
        input.validate()?;
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let deployment = crate::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let repository =
            crate::repository::team_subscription_cancellation::CancellationRepository::new(
                pg, deployment,
            );
        if let Some(saved) = repository
            .find_saved(actor, org, input.operation_id)
            .await?
        {
            saved.matches_selection(&input)?;
            return saved.response().await;
        }
        // Only the sealed factory's complete authority/provider proof can
        // authorize a new acceptance. The empty probe above grants nothing.
        let operation = input.operation_id;
        let prepared = self.prepare_team_cancellation(actor, org, input).await?;
        repository.accept(prepared).await?;
        repository
            .find_saved(actor, org, operation)
            .await?
            .context("cancellation_saved_acceptance_unconfirmed_reconciliation_required")?
            .response()
            .await
    }
    /// Explicit readonly preparation. This opaque result cannot be returned as
    /// an accepted operation; the existing worker needs its own fresh claim.
    pub async fn prepare_team_cancellation(
        &self,
        actor: Uuid,
        org: Uuid,
        input: super::team_subscription_cancellation::CancellationSelection,
    ) -> Result<crate::repository::team_subscription_cancellation::PreparedCancellation> {
        use super::team_subscription_cancellation as cancellation;
        cancellation::require_enabled()?;
        input.validate()?;
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let config = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("Stripe unavailable")?;
        let account = config.account_id.clone();
        let live = config.livemode;
        let client = crate::infrastructure::stripe::StripeClient::new(config)?;
        let deployment=crate::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let runtime = crate::repository::team_stripe::TeamStripeRepository::new_guarded(
            pg.clone(),
            deployment.clone(),
        );
        let repository =
            crate::repository::team_subscription_cancellation::CancellationRepository::new(
                pg, deployment,
            );
        repository
            .reconcile_history(&super::team_financial_ingress::Scope {
                account: account.clone(),
                live,
            })
            .await?;
        let lease = runtime
            .claim_scope(&account, live)
            .await?
            .context("Stripe account busy or backing off")?;
        let proof = match repository.read_proof(actor, org, input, lease).await {
            Ok(value) => value,
            Err(error) => {
                runtime.finish_scope(&account, live, lease, false).await?;
                return Err(error);
            }
        };
        let resource = match client.read_cancellation_preparation(&proof).await {
            Ok(value) => value,
            Err(cancellation::PreparationFailure::Authority(error)) => {
                runtime.finish_scope(&account, live, lease, false).await?;
                return Err(error);
            }
            Err(cancellation::PreparationFailure::Provider(error)) => {
                runtime.fail_scope(&account, live, lease, &error).await?;
                return Err(anyhow::anyhow!(
                    "cancellation preparation unavailable or unconfirmed; reload the saved status"
                ));
            }
        };
        let prepared = match repository.complete_read(proof, resource).await {
            Ok(value) => value,
            Err(error) => {
                runtime.finish_scope(&account, live, lease, false).await?;
                return Err(error);
            }
        };
        anyhow::ensure!(
            runtime.finish_scope(&account, live, lease, true).await?,
            "cancellation_account_lease_unconfirmed"
        );
        prepared.recheck().await?;
        Ok(prepared)
    }
    pub async fn start_team_trial(
        &self,
        actor: Uuid,
        org: Uuid,
        input: super::team_trial::StartTrial,
    ) -> Result<super::team_trial::TrialStatus> {
        input.validate()?;
        super::team_trial::require_enabled()?;
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let deployment = crate::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
        let pg = self.postgres.as_ref().context("PostgreSQL unavailable")?;
        crate::repository::team_analytics_entitlement::start_self_service_trial(
            pg,
            org,
            actor,
            i32::from(input.package_seats),
            &deployment,
        )
        .await?;
        self.team_trial_status(actor, org).await
    }
    pub async fn recover_team_trial(
        &self,
        actor: Uuid,
        org: Uuid,
        input: super::team_trial::RecoverTrial,
    ) -> Result<super::team_trial::TrialStatus> {
        input.validate()?;
        super::team_trial::require_enabled()?;
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let deployment = crate::infrastructure::team_financial_guard::CommercialDeployment::required_from_environment()?;
        let pg = self.postgres.as_ref().context("PostgreSQL unavailable")?;
        crate::repository::team_analytics_entitlement::reconcile_self_service_trial(
            pg,
            org,
            actor,
            input.transition_id,
            &deployment,
        )
        .await?;
        self.team_trial_status(actor, org).await
    }

    pub async fn stripe_checkout_status(
        &self,
        actor: Uuid,
        org: Uuid,
    ) -> Result<Option<crate::repository::team_stripe_checkout::CheckoutStatus>> {
        anyhow::ensure!(
            super::team_stripe::enabled(),
            "Stripe checkout diagnostics disabled"
        );
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let config = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("Stripe unavailable")?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let mut result = crate::repository::team_stripe_checkout::CheckoutRepository::new(pg)
            .latest(actor, org, &config.account_id, config.livemode)
            .await?;
        if let Some(status) = result.as_mut() {
            status.test_checkout_destination_available = status.disposition == "session_open"
                && super::team_stripe_checkout::CheckoutPolicy::from_test_env(config.livemode)
                    .ok()
                    .flatten()
                    .is_some();
        }
        Ok(result)
    }
    pub async fn recover_stripe_checkout(
        &self,
        actor: Uuid,
        org: Uuid,
        operation: Uuid,
        revision: i64,
        confirmed: bool,
    ) -> Result<()> {
        anyhow::ensure!(
            super::team_stripe::enabled(),
            "Stripe checkout recovery disabled"
        );
        anyhow::ensure!(
            confirmed && revision > 0,
            super::team_insights::TeamError::Invalid(
                "confirm recovery and provide current revision"
            )
        );
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let config = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("Stripe unavailable")?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        crate::repository::team_stripe_checkout::CheckoutRepository::new(pg)
            .authorize_recovery(
                actor,
                org,
                &config.account_id,
                config.livemode,
                (operation, revision),
            )
            .await
    }
    pub async fn stripe_checkout_destination(
        &self,
        actor: Uuid,
        org: Uuid,
        operation: Uuid,
        revision: i64,
    ) -> Result<super::team_stripe_checkout::HostedCheckout> {
        anyhow::ensure!(super::team_stripe::enabled(), "Stripe checkout disabled");
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let config = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("Stripe unavailable")?;
        anyhow::ensure!(
            super::team_stripe_checkout::CheckoutPolicy::from_test_env(config.livemode)?.is_some(),
            super::team_insights::TeamError::Invalid("test checkout unavailable")
        );
        let account = config.account_id.clone();
        let live = config.livemode;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let repository =
            crate::repository::team_stripe_checkout::CheckoutRepository::new(pg.clone());
        let proof = repository
            .destination_proof(actor, org, &account, live, (operation, revision))
            .await?;
        let runtime = crate::repository::team_stripe::TeamStripeRepository::new(pg);
        let lease = runtime
            .claim_scope(&account, live)
            .await?
            .context("Stripe account busy or backing off")?;
        let client = crate::infrastructure::stripe::StripeClient::new(config)?;
        let destination = match client.hosted_checkout(&proof).await {
            Ok(result) => {
                runtime.finish_scope(&account, live, lease, true).await?;
                result
            }
            Err(error) => {
                runtime.fail_scope(&account, live, lease, &error).await?;
                return Err(anyhow::anyhow!("hosted checkout unavailable"));
            }
        };
        let current = repository
            .destination_proof(actor, org, &account, live, (operation, revision))
            .await?;
        anyhow::ensure!(
            current == proof,
            super::team_insights::TeamError::ProjectionChanged
        );
        anyhow::ensure!(
            super::team_stripe_checkout::CheckoutPolicy::from_test_env(live)?.is_some(),
            "test checkout disabled during readback"
        );
        // URL leaves only this authenticated no-store response; never a storage/diagnostics record.
        Ok(destination)
    }

    pub async fn prepare_stripe_checkout(
        &self,
        actor: Uuid,
        org: Uuid,
        quote: Uuid,
        confirmed: bool,
    ) -> Result<crate::repository::team_stripe_checkout::CheckoutStatus> {
        anyhow::ensure!(super::team_stripe::enabled(), "Stripe checkout disabled");
        anyhow::ensure!(
            confirmed,
            super::team_insights::TeamError::Invalid("confirm the displayed package price")
        );
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let config = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("Stripe unavailable")?;
        let policy = super::team_stripe_checkout::CheckoutPolicy::from_test_env(config.livemode)?
            .ok_or(super::team_insights::TeamError::Invalid(
            "test checkout confirmation unavailable",
        ))?;
        let catalog =
            super::team_stripe_catalog::Catalog::from_env(&config.account_id, config.livemode)?
                .context("approved price catalog unavailable")?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let proof = crate::repository::team_stripe_quote::QuoteRepository::new(pg.clone())
            .customer(actor, org, &config.account_id, config.livemode)
            .await?;
        crate::repository::team_stripe_checkout::CheckoutRepository::new(pg)
            .request(&proof, quote, &catalog.digest()?, true, &policy)
            .await
    }

    pub async fn stripe_quote(
        &self,
        actor: Uuid,
        org: Uuid,
        id: Uuid,
        seats: Option<u16>,
    ) -> Result<crate::repository::team_stripe_quote::Quote> {
        anyhow::ensure!(super::team_stripe::enabled(), "Stripe pricing disabled");
        if seats.is_some_and(|n| !super::team_billing::PACKAGES.contains(&n)) {
            return Err(super::team_insights::TeamError::Invalid("unsupported package").into());
        }
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let config = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("Stripe unavailable")?;
        let account = config.account_id.clone();
        let live = config.livemode;
        let catalog = super::team_stripe_catalog::Catalog::from_env(&account, live)?
            .context("approved price catalog unavailable")?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        let quotes = crate::repository::team_stripe_quote::QuoteRepository::new(pg.clone());
        let proof = quotes.customer(actor, org, &account, live).await?;
        let mut quote = if let Some(seats) = seats {
            let client = crate::infrastructure::stripe::StripeClient::new(config)?;
            let runtime = crate::repository::team_stripe::TeamStripeRepository::new(pg);
            let lease = runtime
                .claim_scope(&account, live)
                .await?
                .context("Stripe account busy or backing off")?;
            let offer = match client.verified_package(&catalog, seats).await {
                Ok(offer) => {
                    runtime.finish_scope(&account, live, lease, true).await?;
                    offer
                }
                Err(e) => {
                    runtime.fail_scope(&account, live, lease, &e).await?;
                    return Err(anyhow::anyhow!("provider price unavailable"));
                }
            };
            let current = super::team_stripe_catalog::Catalog::from_env(&account, live)?
                .context("approved price catalog unavailable")?;
            anyhow::ensure!(
                current.digest()? == offer.catalog_sha256,
                super::team_insights::TeamError::ProjectionChanged
            );
            quotes.save(id, &proof, &offer).await?
        } else {
            quotes.get(&proof, id, &catalog.digest()?).await?
        };
        // Missing/malformed internal policy must not break price-only preview.
        quote.test_checkout_confirmation_available =
            super::team_stripe_checkout::CheckoutPolicy::from_test_env(live)
                .ok()
                .flatten()
                .is_some();
        Ok(quote)
    }

    pub async fn recover_stripe_customer(
        &self,
        actor: Uuid,
        org: Uuid,
        operation: Uuid,
        revision: i64,
        confirmed: bool,
    ) -> Result<()> {
        anyhow::ensure!(
            super::team_stripe::enabled(),
            "Stripe customer setup disabled"
        );
        if !confirmed || revision < 1 {
            return Err(super::team_insights::TeamError::Invalid(
                "confirm recovery and provide current revision",
            )
            .into());
        }
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let config = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("Stripe unavailable")?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        crate::repository::team_stripe_customer::CustomerRepository::new(pg)
            .authorize_recovery(
                actor,
                org,
                &config.account_id,
                config.livemode,
                operation,
                revision,
            )
            .await
    }
    pub async fn stripe_customer(
        &self,
        actor: Uuid,
        org: Uuid,
        create: bool,
    ) -> Result<Option<crate::repository::team_stripe_customer::CustomerStatus>> {
        anyhow::ensure!(
            super::team_stripe::enabled(),
            "Stripe customer setup disabled"
        );
        self.authorization
            .require(actor, org, OrganizationAction::ManageBilling, None)
            .await?;
        let config = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("Stripe unavailable")?;
        let pg = self.postgres.clone().context("PostgreSQL unavailable")?;
        crate::repository::team_stripe_customer::CustomerRepository::new(pg)
            .request(actor, org, &config.account_id, config.livemode, create)
            .await
    }

    pub async fn stripe_webhook(
        &self,
        body: &[u8],
        signature: &str,
    ) -> std::result::Result<
        crate::repository::team_stripe::Acceptance,
        super::team_stripe::WebhookFailure,
    > {
        use super::team_stripe::{Ingress, WebhookFailure};
        let config = crate::infrastructure::stripe::StripeWebhookConfig::from_env()
            .map_err(|_| WebhookFailure::Unavailable)?
            .ok_or(WebhookFailure::Disabled)?;
        let pg = self.postgres.clone().ok_or(WebhookFailure::Unavailable)?;
        let ingress = Ingress::new(
            crate::repository::team_stripe::TeamStripeRepository::new(pg),
            config.account_id,
            config.livemode,
            config.webhook_secret,
        )
        .map_err(|_| WebhookFailure::Unavailable)?;
        ingress.accept(body, signature, chrono::Utc::now()).await
    }

    pub async fn organization(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<OrganizationBilling> {
        super::require_runtime_feature(super::RuntimeFeature::SeatBillingEntitlements)?;
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageBilling,
                None,
            )
            .await?;
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT b.provider, s.plan, s.status, s.current_period_start,
                        s.current_period_end,
                        (SELECT count(*) FROM organization_seats os
                          WHERE os.organization_id = $1 AND os.seat_type = 'developer'
                            AND os.billable) AS developer_seats,
                        (SELECT count(*) FROM organization_seats os
                          WHERE os.organization_id = $1 AND os.seat_type = 'viewer'
                            AND os.billable) AS viewer_seats
                 FROM billing_customers b
                 LEFT JOIN LATERAL (
                    SELECT plan, status, current_period_start, current_period_end
                    FROM subscriptions WHERE billing_customer_id = b.id
                    ORDER BY created_at DESC LIMIT 1
                 ) s ON TRUE
                 WHERE b.organization_id = $1
                 LIMIT 1",
                &[&organization_id],
            )
            .await
            .context("failed to load organization billing")?;
        if let Some(row) = row {
            Ok(OrganizationBilling {
                organization_id,
                provider: row.get("provider"),
                plan: row.get("plan"),
                status: row.get("status"),
                current_period_start: row.get("current_period_start"),
                current_period_end: row.get("current_period_end"),
                developer_seats: row.get("developer_seats"),
                viewer_seats: row.get("viewer_seats"),
            })
        } else {
            Ok(OrganizationBilling {
                organization_id,
                // No payment provider is selected in this deployment. Returning
                // a concrete provider here would falsely imply that charges or
                // webhook reconciliation are available.
                provider: "unconfigured".to_string(),
                plan: None,
                status: None,
                current_period_start: None,
                current_period_end: None,
                developer_seats: 0,
                viewer_seats: 0,
            })
        }
    }

    pub async fn invoices(&self, actor: Uuid, organization_id: Uuid) -> Result<Vec<Invoice>> {
        super::require_runtime_feature(super::RuntimeFeature::SeatBillingEntitlements)?;
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageBilling,
                None,
            )
            .await?;
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT i.id, i.number, i.currency, i.subtotal_microusd, i.total_microusd,
                        i.status, i.period_start, i.period_end, i.created_at
                 FROM invoices i JOIN billing_customers b ON b.id = i.billing_customer_id
                 WHERE b.organization_id = $1 ORDER BY i.created_at DESC LIMIT 100",
                &[&organization_id],
            )
            .await
            .context("failed to list organization invoices")?;
        rows.into_iter()
            .map(|row| {
                Ok(Invoice {
                    id: row.get("id"),
                    number: row.get("number"),
                    currency: row.get("currency"),
                    subtotal_microusd: row.get("subtotal_microusd"),
                    total_microusd: row.get("total_microusd"),
                    status: row.get("status"),
                    period_start: row.get("period_start"),
                    period_end: row.get("period_end"),
                    created_at: row.get("created_at"),
                })
            })
            .collect()
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .context("PostgreSQL is not configured; set POSTGRES_URL")
    }
}

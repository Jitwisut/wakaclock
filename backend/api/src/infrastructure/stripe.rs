//! Stripe receiver credentials use the existing local envelope vault.
//! No Debug implementation: neither secrets nor decrypted documents belong in logs.
use super::secret_box::SecretBox;
use anyhow::{ensure, Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct WebhookSecrets {
    webhook_secret: String,
}
pub struct StripeWebhookConfig {
    pub account_id: String,
    pub livemode: bool,
    pub webhook_secret: Vec<u8>,
}
impl StripeWebhookConfig {
    pub fn from_env() -> Result<Option<Self>> {
        if !crate::services::team_stripe::enabled() {
            return Ok(None);
        }
        let account =
            std::env::var("ATOAXIS_STRIPE_ACCOUNT_ID").context("Stripe account unavailable")?;
        let live = match std::env::var("ATOAXIS_STRIPE_MODE").ok().as_deref() {
            Some("test") => false,
            Some("live") => true,
            _ => anyhow::bail!("Stripe mode must be explicit"),
        };
        let key = std::env::var("ATOAXIS_KMS_KEY_ID").context("Stripe vault key unavailable")?;
        let vault = SecretBox::from_env_value(&key)?;
        let path = std::env::var("ATOAXIS_STRIPE_WEBHOOK_CREDENTIALS_PATH")
            .context("Stripe envelope unavailable")?;
        let encrypted = std::fs::read(path).context("Stripe envelope unavailable")?;
        Self::open(&vault, &encrypted, &account, live).map(Some)
    }
    fn open(vault: &SecretBox, encrypted: &[u8], account: &str, live: bool) -> Result<Self> {
        ensure!(
            crate::services::team_stripe::id(account, "acct_"),
            "Stripe account invalid"
        );
        let context = format!(
            "stripe-webhook:{account}:{}",
            if live { "live" } else { "test" }
        );
        let plaintext = vault
            .open(context.as_bytes(), encrypted)
            .context("Stripe envelope rejected")?;
        let secrets: WebhookSecrets =
            serde_json::from_slice(&plaintext).context("Stripe credential schema rejected")?;
        ensure!(
            secrets.webhook_secret.starts_with("whsec_") && secrets.webhook_secret.len() > 6,
            "Stripe webhook secret unavailable"
        );
        Ok(Self {
            account_id: account.into(),
            livemode: live,
            webhook_secret: secrets.webhook_secret.into_bytes(),
        })
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};
    #[test]
    fn credential_envelope_is_account_and_mode_bound() {
        let vault = SecretBox::from_env_value(&STANDARD.encode([7_u8; 32])).unwrap();
        let encrypted = vault
            .seal(
                b"stripe-webhook:acct_fixture:test",
                br#"{"webhook_secret":"whsec_local_fixture"}"#,
            )
            .unwrap();
        assert!(StripeWebhookConfig::open(&vault, &encrypted, "acct_fixture", false).is_ok());
        assert!(StripeWebhookConfig::open(&vault, &encrypted, "acct_other", false).is_err());
        assert!(StripeWebhookConfig::open(&vault, &encrypted, "acct_fixture", true).is_err());
    }
}

pub const API_VERSION: &str = "2025-04-30.basil";
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ApiSecrets {
    api_key: String,
}
/// Separate envelope from the webhook signing secret; never serializable/debuggable.
pub struct StripeApiConfig {
    pub account_id: String,
    pub livemode: bool,
    api_key: String,
}
impl StripeApiConfig {
    pub fn from_env() -> Result<Option<Self>> {
        if !crate::services::team_stripe::enabled() {
            return Ok(None);
        }
        let account =
            std::env::var("ATOAXIS_STRIPE_ACCOUNT_ID").context("Stripe account unavailable")?;
        let live = match std::env::var("ATOAXIS_STRIPE_MODE").ok().as_deref() {
            Some("test") => false,
            Some("live") => true,
            _ => anyhow::bail!("Stripe mode must be explicit"),
        };
        ensure!(
            crate::services::team_stripe::id(&account, "acct_"),
            "Stripe account invalid"
        );
        let vault = SecretBox::from_env_value(
            &std::env::var("ATOAXIS_KMS_KEY_ID").context("Stripe vault unavailable")?,
        )?;
        let encrypted = std::fs::read(
            std::env::var("ATOAXIS_STRIPE_API_CREDENTIALS_PATH")
                .context("Stripe API envelope unavailable")?,
        )
        .context("Stripe API envelope unavailable")?;
        let aad = format!(
            "stripe-api:{account}:{}",
            if live { "live" } else { "test" }
        );
        let plaintext = vault
            .open(aad.as_bytes(), &encrypted)
            .context("Stripe API envelope rejected")?;
        let secret: ApiSecrets =
            serde_json::from_slice(&plaintext).context("Stripe API envelope invalid")?;
        ensure!(valid_key(&secret.api_key, live), "Stripe key mode mismatch");
        Ok(Some(Self {
            account_id: account,
            livemode: live,
            api_key: secret.api_key,
        }))
    }
}
fn valid_key(key: &str, live: bool) -> bool {
    let mode = if live { "live" } else { "test" };
    [format!("sk_{mode}_"), format!("rk_{mode}_")]
        .iter()
        .any(|p| key.starts_with(p) && key.len() > p.len())
        && key.len() <= 512
        && key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}
#[derive(Debug, Clone, Copy)]
pub struct ProviderError {
    pub kind: crate::repository::team_stripe::Failure,
    pub status: Option<i32>,
    pub retry_after: Option<chrono::DateTime<chrono::Utc>>,
}
impl std::fmt::Display for ProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.kind.code())
    }
}
impl std::error::Error for ProviderError {}
impl ProviderError {
    fn contract() -> Self {
        Self {
            kind: crate::repository::team_stripe::Failure::InvalidContract,
            status: None,
            retry_after: None,
        }
    }
    fn scope() -> Self {
        Self {
            kind: crate::repository::team_stripe::Failure::ScopeMismatch,
            status: None,
            retry_after: None,
        }
    }
    fn network() -> Self {
        Self {
            kind: crate::repository::team_stripe::Failure::Network,
            status: None,
            retry_after: None,
        }
    }
}
pub fn retry_deadline(
    header: Option<&str>,
    now: chrono::DateTime<chrono::Utc>,
) -> Option<chrono::DateTime<chrono::Utc>> {
    let raw = header?.trim();
    if let Ok(seconds) = raw.parse::<u64>() {
        return Some(
            i64::try_from(seconds)
                .ok()
                .and_then(chrono::Duration::try_seconds)
                .and_then(|d| now.checked_add_signed(d))
                .unwrap_or(chrono::DateTime::<chrono::Utc>::MAX_UTC),
        );
    }
    chrono::DateTime::parse_from_rfc2822(raw)
        .ok()
        .map(|d| d.with_timezone(&chrono::Utc))
}
pub enum CustomerLookup {
    Verified(String),
    Unconfirmed(&'static str),
}
pub struct StripeClient {
    client: reqwest::Client,
    origin: String,
    config: StripeApiConfig,
    financial_guard: Option<crate::infrastructure::team_financial_guard::FinancialGuard>,
}
impl StripeClient {
    pub fn new(config: StripeApiConfig) -> Result<Self> {
        Self::build(config, "https://api.stripe.com".into(), true)
    }
    fn build(config: StripeApiConfig, origin: String, https: bool) -> Result<Self> {
        let client = reqwest::Client::builder()
            .https_only(https)
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(std::time::Duration::from_secs(5))
            .timeout(std::time::Duration::from_secs(10))
            .build()?;
        Ok(Self {
            client,
            origin,
            config,
            financial_guard:
                crate::infrastructure::team_financial_guard::FinancialObservation::from_environment(
                )?
                .guard()
                .cloned(),
        })
    }
    #[cfg(test)]
    pub(crate) fn fixture(port: u16, account: &str) -> Self {
        Self::build(
            StripeApiConfig {
                account_id: account.into(),
                livemode: false,
                api_key: "rk_test_synthetic".into(),
            },
            format!("http://127.0.0.1:{port}"),
            false,
        )
        .unwrap()
    }
    #[cfg(test)]
    pub(crate) fn fixture_guarded(
        port: u16,
        account: &str,
        guard: crate::infrastructure::team_financial_guard::FinancialGuard,
    ) -> Self {
        let mut client = Self::fixture(port, account);
        client.financial_guard = Some(guard);
        client
    }
    pub fn account(&self) -> &str {
        &self.config.account_id
    }
    pub fn livemode(&self) -> bool {
        self.config.livemode
    }
    async fn get(&self, path: &str) -> std::result::Result<serde_json::Value, ProviderError> {
        self.request(self.client.get(format!("{}{path}", self.origin)))
            .await
    }
    async fn request(
        &self,
        request: reqwest::RequestBuilder,
    ) -> std::result::Result<serde_json::Value, ProviderError> {
        self.request_response(request, false).await
    }
    async fn request_response(
        &self,
        request: reqwest::RequestBuilder,
        accepted_write_may_exist: bool,
    ) -> std::result::Result<serde_json::Value, ProviderError> {
        use crate::repository::team_stripe::Failure;
        let mut response = request
            .bearer_auth(&self.config.api_key)
            .header("Stripe-Version", API_VERSION)
            .send()
            .await
            .map_err(|_| ProviderError::network())?;
        let code = response.status().as_u16();
        if !response.status().is_success() {
            let kind = match code {
                401 => Failure::Auth,
                403 => Failure::Permission,
                404 => Failure::NotFound,
                429 => Failure::RateLimited,
                500..=599 => Failure::Provider,
                _ => Failure::InvalidContract,
            };
            return Err(ProviderError {
                kind,
                status: Some(i32::from(code)),
                retry_after: retry_deadline(
                    response
                        .headers()
                        .get("retry-after")
                        .and_then(|h| h.to_str().ok()),
                    chrono::Utc::now(),
                ),
            });
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| ProviderError::network())?
        {
            if bytes.len() + chunk.len() > 2_000_000 {
                return Err(ProviderError::contract());
            }
            bytes.extend_from_slice(&chunk);
        }
        // A truncated success response may follow an accepted write. Keep the same idempotency identity.
        serde_json::from_slice(&bytes).map_err(|_| {
            if accepted_write_may_exist {
                ProviderError::network()
            } else {
                ProviderError::contract()
            }
        })
    }
    /// Uses only the frozen, durably accepted request. Retry identity never contains credentials.
    pub async fn create_checkout_session(
        &self,
        claim: &crate::repository::team_stripe_checkout::CheckoutClaim,
        catalog: &crate::services::team_stripe_catalog::Catalog,
    ) -> std::result::Result<crate::services::team_stripe_checkout::SessionEvidence, ProviderError>
    {
        if claim.session_id.is_some() || claim.lookup_only {
            return Err(ProviderError::contract());
        }
        if claim.proof.account != self.account() || claim.proof.live != self.livemode() {
            return Err(ProviderError::scope());
        }
        let digest = catalog.digest().map_err(|_| ProviderError::contract())?;
        if digest != claim.catalog_hash {
            return Err(ProviderError::contract());
        }
        let offer = self.verified_package(catalog, claim.seats).await?;
        if offer.package.price_id != claim.price
            || offer.currency != claim.currency
            || offer.package.amount_minor != claim.amount_minor
        {
            return Err(ProviderError::contract());
        }
        let stored = serde_json::to_value(&claim.request).map_err(|_| ProviderError::contract())?;
        let frozen = crate::services::team_stripe_checkout::FrozenRequest::restore(
            &stored,
            &claim
                .request
                .digest()
                .map_err(|_| ProviderError::contract())?,
            &claim.expected(),
        )
        .map_err(|_| ProviderError::contract())?;
        let value = self
            .request_response(
                self.client
                    .post(format!("{}/v1/checkout/sessions", self.origin))
                    .header(
                        "Idempotency-Key",
                        format!("atoaxis-checkout-v1-{}", claim.operation),
                    )
                    .form(&frozen.form()),
                true,
            )
            .await?;
        let receipt = crate::services::team_stripe_checkout::SessionEvidence::parse(
            &value,
            &claim.expected(),
            chrono::Utc::now(),
        )
        .map_err(|_| ProviderError::contract())?;
        // Re-read the exact resource; POST response is not canonical payment/subscription proof.
        self.checkout_session(&receipt.id, claim).await
    }
    /// Current resource readback; never trusts a browser success redirect as payment proof.
    pub async fn checkout_session(
        &self,
        session: &str,
        claim: &crate::repository::team_stripe_checkout::CheckoutClaim,
    ) -> std::result::Result<crate::services::team_stripe_checkout::SessionEvidence, ProviderError>
    {
        if claim.proof.account != self.account() || claim.proof.live != self.livemode() {
            return Err(ProviderError::scope());
        }
        if !crate::services::team_stripe::id(
            session,
            if self.livemode() {
                "cs_live_"
            } else {
                "cs_test_"
            },
        ) {
            return Err(ProviderError::contract());
        }
        self.verify_account().await?;
        let value = self
            .request_response(
                self.client
                    .get(format!("{}/v1/checkout/sessions/{session}", self.origin))
                    .query(&[("expand[]", "line_items")]),
                true,
            )
            .await?;
        if value["id"].as_str() != Some(session) {
            return Err(ProviderError::contract());
        }
        crate::services::team_stripe_checkout::SessionEvidence::parse(
            &value,
            &claim.expected(),
            chrono::Utc::now(),
        )
        .map_err(|_| ProviderError::contract())
    }
    pub async fn hosted_checkout(
        &self,
        proof: &crate::repository::team_stripe_checkout::CheckoutDestinationProof,
    ) -> std::result::Result<crate::services::team_stripe_checkout::HostedCheckout, ProviderError>
    {
        if proof.proof.account != self.account() || proof.proof.live != self.livemode() {
            return Err(ProviderError::scope());
        }
        if !crate::services::team_stripe::id(
            &proof.session,
            if self.livemode() {
                "cs_live_"
            } else {
                "cs_test_"
            },
        ) {
            return Err(ProviderError::contract());
        }
        self.verify_account().await?;
        let value = self
            .request(
                self.client
                    .get(format!(
                        "{}/v1/checkout/sessions/{}",
                        self.origin, proof.session
                    ))
                    .query(&[("expand[]", "line_items")]),
            )
            .await?;
        crate::services::team_stripe_checkout::HostedCheckout::parse(
            &value,
            &proof.expected(),
            &proof.session,
            chrono::Utc::now(),
        )
        .map_err(|_| ProviderError::contract())
    }
    pub async fn lookup_checkout_session(
        &self,
        claim: &crate::repository::team_stripe_checkout::CheckoutClaim,
    ) -> std::result::Result<CheckoutLookup, ProviderError> {
        if !claim.lookup_only
            || claim.session_id.is_some()
            || claim.proof.account != self.account()
            || claim.proof.live != self.livemode()
        {
            return Err(ProviderError::scope());
        }
        self.verify_account().await?;
        let mut cursor: Option<String> = None;
        let mut seen = std::collections::HashSet::new();
        let mut candidate: Option<String> = None;
        let operation = claim.operation.to_string();
        // A bounded scan that cannot prove uniqueness remains unconfirmed, never a new purchase.
        for _ in 0..5 {
            let mut params = vec![
                ("customer", claim.proof.customer.as_str()),
                ("limit", "100"),
            ];
            if let Some(c) = cursor.as_ref() {
                params.push(("starting_after", c));
            }
            let page = self
                .request(
                    self.client
                        .get(format!("{}/v1/checkout/sessions", self.origin))
                        .query(&params),
                )
                .await?;
            let data = page["data"]
                .as_array()
                .ok_or_else(ProviderError::contract)?;
            let more = page["has_more"]
                .as_bool()
                .ok_or_else(ProviderError::contract)?;
            if page["object"] != "list" || data.len() > 100 || (more && data.is_empty()) {
                return Err(ProviderError::contract());
            }
            for item in data {
                let id = item["id"].as_str().ok_or_else(ProviderError::contract)?;
                if item["object"] != "checkout.session"
                    || item["customer"].as_str() != Some(&claim.proof.customer)
                    || item["livemode"].as_bool() != Some(claim.proof.live)
                    || !crate::services::team_stripe::id(
                        id,
                        if claim.proof.live {
                            "cs_live_"
                        } else {
                            "cs_test_"
                        },
                    )
                {
                    return Err(ProviderError::scope());
                }
                if !seen.insert(id.to_owned()) {
                    return Err(ProviderError::contract());
                }
                let metadata_match =
                    item["metadata"]["atoaxis_checkout_operation"].as_str() == Some(&operation);
                let reference_match = item["client_reference_id"].as_str() == Some(&operation);
                if metadata_match || reference_match {
                    if !metadata_match || !reference_match {
                        return Err(ProviderError::scope());
                    }
                    if candidate.is_some() {
                        return Ok(CheckoutLookup::Unconfirmed("checkout_candidates_ambiguous"));
                    }
                    candidate = Some(id.into());
                }
                cursor = Some(id.into());
            }
            if !more {
                return match candidate {
                    Some(id) => self
                        .checkout_session(&id, claim)
                        .await
                        .map(CheckoutLookup::Verified),
                    None => Ok(CheckoutLookup::Unconfirmed(
                        "checkout_not_found_unconfirmed",
                    )),
                };
            }
        }
        Ok(CheckoutLookup::Unconfirmed("checkout_lookup_limit"))
    }
    pub async fn checkout_subscription(
        &self,
        claim: &crate::repository::team_stripe_checkout::CheckoutClaim,
        session: &crate::services::team_stripe_checkout::SessionEvidence,
    ) -> std::result::Result<
        Option<crate::services::team_stripe_checkout::SubscriptionEvidence>,
        ProviderError,
    > {
        use crate::services::team_stripe_checkout::SubscriptionEvidence;
        if session.status != "complete" || session.subscription.is_none() {
            return Ok(None);
        }
        if claim.proof.account != self.account() || claim.proof.live != self.livemode() {
            return Err(ProviderError::scope());
        }
        self.verify_account().await?;
        let sub = session
            .subscription
            .as_ref()
            .ok_or_else(ProviderError::contract)?;
        let raw = self.get(&format!("/v1/subscriptions/{sub}")).await?;
        let at = chrono::Utc::now();
        let before = SubscriptionEvidence::parse(&raw, session, &claim.expected(), at)
            .map_err(|_| ProviderError::contract())?;
        let current = self.checkout_session(&session.id, claim).await?;
        if current.status != "complete" || current.subscription != session.subscription {
            return Err(ProviderError {
                kind: crate::repository::team_stripe::Failure::ObservationChanged,
                status: None,
                retry_after: None,
            });
        }
        let raw = self.get(&format!("/v1/subscriptions/{sub}")).await?;
        let after = SubscriptionEvidence::parse(&raw, &current, &claim.expected(), at)
            .map_err(|_| ProviderError::contract())?;
        if before.snapshot != after.snapshot {
            return Err(ProviderError {
                kind: crate::repository::team_stripe::Failure::ObservationChanged,
                status: None,
                retry_after: None,
            });
        }
        Ok(Some(after))
    }
    pub async fn verified_package(
        &self,
        catalog: &crate::services::team_stripe_catalog::Catalog,
        seats: u16,
    ) -> std::result::Result<crate::services::team_stripe_catalog::VerifiedOffer, ProviderError>
    {
        if !catalog.matches_scope(self.account(), self.livemode()) {
            return Err(ProviderError::scope());
        }
        let package = catalog
            .package(seats)
            .map_err(|_| ProviderError::contract())?;
        self.verify_account().await?;
        let value = self
            .request(
                self.client
                    .get(format!("{}/v1/prices/{}", self.origin, package.price_id))
                    .query(&[("expand[]", "product")]),
            )
            .await?;
        catalog
            .verify(seats, &value, chrono::Utc::now())
            .map_err(|_| ProviderError::contract())
    }
    pub async fn lookup_customer(
        &self,
        claim: &crate::repository::team_stripe_customer::CustomerClaim,
    ) -> std::result::Result<CustomerLookup, ProviderError> {
        claim
            .provider_preflight(self.financial_guard.as_ref())
            .await
            .map_err(|_| ProviderError::scope())?;
        if !claim.lookup_only
            || claim.account_id != self.account()
            || claim.livemode != self.livemode()
        {
            return Err(ProviderError::scope());
        }
        let id = if let Some(id) = claim.customer_id.as_ref() {
            if !crate::services::team_stripe::id(id, "cus_") {
                return Err(ProviderError::contract());
            }
            id.clone()
        } else {
            let query = format!("metadata['atoaxis_operation']:'{}'", claim.operation_id);
            let raw = self
                .request(
                    self.client
                        .get(format!("{}/v1/customers/search", self.origin))
                        .query(&[("query", query.as_str()), ("limit", "2")]),
                )
                .await?;
            let data = raw["data"].as_array().ok_or_else(ProviderError::contract)?;
            if raw["object"] != "search_result" || data.len() > 2 {
                return Err(ProviderError::contract());
            }
            let more = raw["has_more"]
                .as_bool()
                .ok_or_else(ProviderError::contract)?;
            for value in data {
                Self::customer_identity(value, claim)?;
            }
            if more || data.len() > 1 {
                return Ok(CustomerLookup::Unconfirmed("customer_candidates_ambiguous"));
            }
            let Some(value) = data.first() else {
                return Ok(CustomerLookup::Unconfirmed(
                    "customer_not_found_unconfirmed",
                ));
            };
            Self::customer_identity(value, claim)?
        };
        // Search is eventually consistent. A positive candidate needs fresh resource verification;
        // a missing result never authorizes another create operation.
        let value = match self.get(&format!("/v1/customers/{id}")).await {
            Err(e) if matches!(e.kind, crate::repository::team_stripe::Failure::NotFound) => {
                return Ok(CustomerLookup::Unconfirmed(
                    "customer_not_found_unconfirmed",
                ))
            }
            other => other?,
        };
        if value["id"].as_str() != Some(&id) {
            return Err(ProviderError::scope());
        }
        if value["deleted"].as_bool() == Some(true) {
            return Ok(CustomerLookup::Unconfirmed("customer_deleted"));
        }
        Ok(CustomerLookup::Verified(Self::customer_identity(
            &value, claim,
        )?))
    }
    fn customer_identity(
        value: &serde_json::Value,
        claim: &crate::repository::team_stripe_customer::CustomerClaim,
    ) -> std::result::Result<String, ProviderError> {
        let operation = claim.operation_id.to_string();
        let id = value["id"].as_str().ok_or_else(ProviderError::contract)?;
        if value["object"] != "customer"
            || value["livemode"].as_bool() != Some(claim.livemode)
            || value["deleted"].as_bool() == Some(true)
            || value["metadata"]["atoaxis_operation"].as_str() != Some(&operation)
            || !crate::services::team_stripe::id(id, "cus_")
        {
            return Err(ProviderError::scope());
        }
        Ok(id.into())
    }
    pub async fn create_customer(
        &self,
        claim: &crate::repository::team_stripe_customer::CustomerClaim,
    ) -> std::result::Result<String, ProviderError> {
        claim
            .provider_preflight(self.financial_guard.as_ref())
            .await
            .map_err(|_| ProviderError::scope())?;
        if claim.lookup_only
            || claim.account_id != self.account()
            || claim.livemode != self.livemode()
        {
            return Err(ProviderError::scope());
        }
        let request = crate::services::team_stripe_customer_request::Request::new(
            crate::services::team_financial_source::Scope {
                organization: claim.organization_id,
                account: claim.account_id.clone(),
                live: claim.livemode,
            },
            claim.operation_id,
            claim.actor,
        )
        .map_err(|_| ProviderError::contract())?;
        let value = self
            .request(
                self.client
                    .post(format!(
                        "{}{}",
                        self.origin,
                        crate::services::team_stripe_customer_request::Request::PATH
                    ))
                    .header("Idempotency-Key", request.key())
                    .form(&request.form()),
            )
            .await?;
        let result = Self::customer_identity(&value, claim);
        let customer = value["id"]
            .as_str()
            .filter(|id| crate::services::team_stripe::id(id, "cus_"));
        claim
            .retain_provider_result(customer, result.is_ok())
            .map_err(|_| ProviderError::contract())?;
        result
    }
    pub async fn verify_account(&self) -> std::result::Result<(), ProviderError> {
        let value = self.get("/v1/account").await?;
        if value["object"] != "account" || value["id"].as_str() != Some(self.account()) {
            return Err(ProviderError::scope());
        }
        Ok(())
    }
    pub async fn subscription(
        &self,
        claim: &crate::repository::team_stripe::Claim,
    ) -> std::result::Result<crate::services::team_stripe::Snapshot, ProviderError> {
        if claim.account_id != self.account()
            || claim.livemode != self.livemode()
            || !crate::services::team_stripe::id(&claim.subscription_id, "sub_")
        {
            return Err(ProviderError::scope());
        }
        let value = self
            .get(&format!("/v1/subscriptions/{}", claim.subscription_id))
            .await?;
        if value["customer"].as_str() != Some(&claim.customer_id)
            || value["livemode"].as_bool() != Some(claim.livemode)
            || value["id"].as_str() != Some(&claim.subscription_id)
        {
            return Err(ProviderError::scope());
        }
        crate::services::team_stripe::snapshot(
            &value,
            &claim.subscription_id,
            &claim.customer_id,
            claim.livemode,
            chrono::Utc::now(),
        )
        .map_err(|_| ProviderError::contract())
    }
}

#[cfg(test)]
mod transport_tests {
    use super::*;
    use axum::{routing::get, Json, Router};
    use serde_json::json;
    #[test]
    fn retry_after_seconds_date_and_key_modes() {
        let now = chrono::DateTime::from_timestamp(1_000, 0).unwrap();
        assert_eq!(retry_deadline(Some("120"), now).unwrap().timestamp(), 1120);
        assert_eq!(
            retry_deadline(Some("Thu, 01 Jan 1970 00:20:00 GMT"), now)
                .unwrap()
                .timestamp(),
            1200
        );
        assert!(retry_deadline(Some("unknown"), now).is_none());
        assert_eq!(
            retry_deadline(Some("18446744073709551615"), now),
            Some(chrono::DateTime::<chrono::Utc>::MAX_UTC)
        );
        assert!(valid_key("rk_test_fixture", false));
        assert!(!valid_key("sk_live_fixture", false));
        assert!(!valid_key("pk_test_fixture", false));
    }
    #[tokio::test]
    async fn fixed_version_auth_scope_and_error_body_redaction() {
        use axum::{
            http::{HeaderMap, StatusCode},
            response::IntoResponse,
        };
        let app = Router::new()
            .route(
                "/redirect",
                get(|| async {
                    (StatusCode::FOUND, [("location", "/v1/account")]).into_response()
                }),
            )
            .route(
                "/v1/account",
                get(|headers: HeaderMap| async move {
                    assert_eq!(headers["stripe-version"], API_VERSION);
                    assert_eq!(headers["authorization"], "Bearer rk_test_synthetic");
                    Json(json!({"object":"account","id":"acct_other","email":"PRIVATE_FIXTURE"}))
                }),
            )
            .route(
                "/v1/subscriptions/sub_fixture",
                get(|| async {
                    (
                        StatusCode::TOO_MANY_REQUESTS,
                        [("retry-after", "120")],
                        "PRIVATE_FIXTURE token source",
                    )
                        .into_response()
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let task = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let client = StripeClient::fixture(port, "acct_fixture");
        let error = client.verify_account().await.unwrap_err();
        assert!(matches!(
            error.kind,
            crate::repository::team_stripe::Failure::ScopeMismatch
        ));
        let error = client
            .get("/v1/subscriptions/sub_fixture")
            .await
            .unwrap_err();
        assert_eq!(error.status, Some(429));
        assert!(error.retry_after.unwrap() > chrono::Utc::now() + chrono::Duration::seconds(115));
        assert!(!format!("{error:?}").contains("PRIVATE_FIXTURE"));
        let redirect = client.get("/redirect").await.unwrap_err();
        assert_eq!(redirect.status, Some(302));
        let disconnected = StripeClient::fixture(0, "acct_fixture")
            .verify_account()
            .await
            .unwrap_err();
        assert!(matches!(
            disconnected.kind,
            crate::repository::team_stripe::Failure::Network
        ));
        assert_eq!(disconnected.to_string(), "network");
        task.abort();
        let _ = task.await;
    }
}

impl StripeClient {
    pub async fn current_observation(
        &self,
        claim: &crate::repository::team_stripe::Claim,
    ) -> std::result::Result<
        (
            crate::services::team_stripe::Snapshot,
            Option<crate::services::team_stripe_invoice::Invoice>,
        ),
        ProviderError,
    > {
        let before = self.subscription(claim).await?;
        let Some(invoice_id) = before.latest_invoice_id.as_ref() else {
            return Ok((before, None));
        };
        let raw = self.get(&format!("/v1/invoices/{invoice_id}")).await?;
        let mut invoice = crate::services::team_stripe_invoice::invoice(
            &raw,
            &before,
            claim.livemode,
            chrono::Utc::now(),
        )
        .map_err(|_| ProviderError::contract())?;
        let initial_invoice = invoice.clone();
        let mut ids: std::collections::BTreeSet<String> =
            invoice.lines.iter().map(|l| l.id.clone()).collect();
        // Bounded pagination; partial coverage remains explicit and cannot establish paid service.
        for _ in 0..10 {
            if invoice.lines_complete {
                break;
            }
            if invoice.lines.len() >= 1000 {
                break;
            }
            let cursor = invoice
                .lines
                .last()
                .ok_or_else(ProviderError::contract)?
                .id
                .clone();
            let limit = 100_usize.min(1000 - invoice.lines.len());
            let raw = self
                .get(&format!(
                    "/v1/invoices/{invoice_id}/lines?limit={limit}&starting_after={cursor}"
                ))
                .await?;
            let data = raw["data"].as_array().ok_or_else(ProviderError::contract)?;
            if raw["object"] != "list" || data.is_empty() || data.len() > limit {
                return Err(ProviderError::contract());
            }
            for value in data {
                let line = crate::services::team_stripe_invoice::line_for_invoice(
                    value,
                    claim.livemode,
                    invoice_id,
                )
                .map_err(|_| ProviderError::contract())?;
                if !ids.insert(line.id.clone()) {
                    return Err(ProviderError::contract());
                }
                invoice.lines.push(line);
            }
            invoice.lines_complete = !raw["has_more"]
                .as_bool()
                .ok_or_else(ProviderError::contract)?;
        }
        invoice.line_coverage_reason = if invoice.lines_complete {
            None
        } else {
            Some("pagination_limit".into())
        };
        // Fence the invoice independently: payment/line changes need not change subscription fields.
        // Compare only allowlisted metadata, including its first page. This detects observed
        // changes, not an atomic snapshot guarantee from the provider API.
        let raw = self.get(&format!("/v1/invoices/{invoice_id}")).await?;
        let checked_invoice = crate::services::team_stripe_invoice::invoice(
            &raw,
            &before,
            claim.livemode,
            initial_invoice.observed_at,
        )
        .map_err(|_| ProviderError::contract())?;
        if checked_invoice != initial_invoice {
            return Err(ProviderError {
                kind: crate::repository::team_stripe::Failure::ObservationChanged,
                status: None,
                retry_after: None,
            });
        }
        // No hybrid old-invoice/new-package observation when provider state changes mid-request.
        let after = self.subscription(claim).await?;
        let mut comparable = before;
        comparable.observed_at = after.observed_at;
        if comparable != after {
            return Err(ProviderError {
                kind: crate::repository::team_stripe::Failure::ObservationChanged,
                status: None,
                retry_after: None,
            });
        }
        Ok((after, Some(invoice)))
    }
}

#[cfg(test)]
mod invoice_transport_tests {
    use super::*;
    use axum::{
        extract::{Query, State},
        routing::get,
        Json, Router,
    };
    use serde_json::{json, Value};
    use std::{
        collections::HashMap,
        sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        },
    };
    fn line(n: usize) -> Value {
        json!({"id":format!("il_{n}"),"object":"line_item","livemode":false,"amount":100,"currency":"usd","quantity":1,"parent":{"type":"subscription_item_details","subscription_item_details":{"subscription":"sub_fixture","subscription_item":"si_fixture","proration":false}},"pricing":{"price_details":{"price":"price_fixture"}},"period":{"start":1,"end":2},"description":"PRIVATE_FIXTURE"})
    }
    #[tokio::test]
    async fn invoice_pagination_is_bounded_and_duplicate_cursor_is_rejected() {
        let mode = Arc::new(AtomicUsize::new(0));
        let app=Router::new().route("/v1/subscriptions/sub_fixture",get(||async{Json(json!({"id":"sub_fixture","object":"subscription","customer":"cus_fixture","livemode":false,"status":"active","cancel_at_period_end":false,"latest_invoice":"in_fixture","items":{"has_more":false,"data":[{"id":"si_fixture","quantity":1,"current_period_start":1,"current_period_end":2,"price":{"id":"price_fixture","currency":"usd","unit_amount":100}}]}}))}))
            .route("/v1/invoices/in_fixture",get(|State(mode):State<Arc<AtomicUsize>>|async move {let paid=if mode.load(Ordering::SeqCst)==4 {99} else {100};Json(json!({"id":"in_fixture","object":"invoice","customer":"cus_fixture","livemode":false,"parent":{"subscription_details":{"subscription":"sub_fixture"}},"status":"paid","currency":"usd","amount_due":100,"amount_paid":paid,"amount_remaining":0,"status_transitions":{"paid_at":1},"lines":{"data":[line(0)],"has_more":true},"description":"PRIVATE_FIXTURE"}))}))
            .route("/v1/invoices/in_fixture/lines",get(|State(mode):State<Arc<AtomicUsize>>,Query(query):Query<HashMap<String,String>>|async move {
                let start:usize=query["starting_after"].strip_prefix("il_").unwrap().parse().unwrap();let limit:usize=query["limit"].parse().unwrap();assert!(limit<=100);
                let (data,more)=match mode.load(Ordering::SeqCst){3=>{mode.store(4,Ordering::SeqCst);(vec![line(1)],false)},5=>{let mut wrong=line(1);wrong["invoice"]=json!("in_other");(vec![wrong],false)},1=>(vec![line(start)],false),2=>((start+1..=start+limit).map(line).collect(),true),_=>(vec![line(1)],false)};
                Json(json!({"object":"list","data":data,"has_more":more}))
            })).with_state(mode.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let task = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let client = StripeClient::fixture(port, "acct_fixture");
        let claim = crate::repository::team_stripe::Claim {
            account_id: "acct_fixture".into(),
            livemode: false,
            subscription_id: "sub_fixture".into(),
            customer_id: "cus_fixture".into(),
            revision: 1,
            binding_revision: 1,
            lease_id: uuid::Uuid::now_v7(),
            organization_id: uuid::Uuid::now_v7(),
        };
        let (_, invoice) = client.current_observation(&claim).await.unwrap();
        let invoice = invoice.unwrap();
        assert!(invoice.lines_complete);
        assert_eq!(invoice.lines.len(), 2);
        assert!(!serde_json::to_string(&invoice)
            .unwrap()
            .contains("PRIVATE_FIXTURE"));
        mode.store(1, Ordering::SeqCst);
        assert!(client.current_observation(&claim).await.is_err());
        mode.store(3, Ordering::SeqCst);
        let changed = client.current_observation(&claim).await.unwrap_err();
        assert!(matches!(
            changed.kind,
            crate::repository::team_stripe::Failure::ObservationChanged
        ));
        mode.store(5, Ordering::SeqCst);
        let wrong_parent = client.current_observation(&claim).await.unwrap_err();
        assert!(matches!(
            wrong_parent.kind,
            crate::repository::team_stripe::Failure::InvalidContract
        ));
        mode.store(2, Ordering::SeqCst);
        let (s, invoice) = client.current_observation(&claim).await.unwrap();
        let invoice = invoice.unwrap();
        assert!(!invoice.lines_complete);
        assert_eq!(invoice.lines.len(), 1000);
        assert_eq!(
            invoice.line_coverage_reason.as_deref(),
            Some("pagination_limit")
        );
        assert!(invoice.covered_until(&s, chrono::Utc::now()).is_none());
        task.abort();
        let _ = task.await;
    }
}

#[cfg(test)]
mod catalog_transport_tests {
    use super::*;
    use axum::{
        extract::{Query, State},
        routing::get,
        Json, Router,
    };
    use serde_json::json;
    use std::{
        collections::HashMap,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
    };
    #[tokio::test]
    async fn approved_package_uses_verified_account_and_expanded_price_read_only() {
        let bad = Arc::new(AtomicBool::new(false));
        let app=Router::new().route("/v1/account",get(||async{Json(json!({"id":"acct_fixture","object":"account"}))}))
            .route("/v1/prices/price_10",get(|State(bad):State<Arc<AtomicBool>>,Query(q):Query<HashMap<String,String>>|async move{
                assert_eq!(q.get("expand[]").map(String::as_str),Some("product"));
                Json(json!({"object":"price","id":"price_10","active":true,"livemode":false,"currency":if bad.load(Ordering::SeqCst){"eur"}else{"usd"},"unit_amount":2500,"unit_amount_decimal":"2500","tax_behavior":"exclusive","type":"recurring","billing_scheme":"per_unit","recurring":{"interval":"month","interval_count":1,"usage_type":"licensed"},"product":{"id":"prod_fixture","object":"product","active":true,"livemode":false},"metadata":{"private":"PRIVATE_FIXTURE"}}))
            })).with_state(bad.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let task = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let packages:[serde_json::Value;4]=[10,25,50,100].map(|seats|json!({"seats":seats,"price_id":format!("price_{seats}"),"product_id":"prod_fixture","amount_minor":2500,"tax_behavior":"exclusive"}));
        let config=serde_json::to_vec(&json!({"schema_version":1,"revision":1,"owner_approved":true,"account_id":"acct_fixture","livemode":false,"currency":"usd","packages":packages})).unwrap();
        let catalog =
            crate::services::team_stripe_catalog::Catalog::parse(&config, "acct_fixture", false)
                .unwrap();
        let client = StripeClient::fixture(port, "acct_fixture");
        let offer = client.verified_package(&catalog, 10).await.unwrap();
        assert_eq!(offer.package.amount_minor, 2500);
        assert_eq!(offer.quantity, 1);
        assert!(!offer.checkout_available);
        assert!(!serde_json::to_string(&offer)
            .unwrap()
            .contains("PRIVATE_FIXTURE"));
        bad.store(true, Ordering::SeqCst);
        assert!(matches!(
            client.verified_package(&catalog, 10).await,
            Err(ProviderError {
                kind: crate::repository::team_stripe::Failure::InvalidContract,
                ..
            })
        ));
        assert!(matches!(
            StripeClient::fixture(port, "acct_other")
                .verified_package(&catalog, 10)
                .await,
            Err(ProviderError {
                kind: crate::repository::team_stripe::Failure::ScopeMismatch,
                ..
            })
        ));
        task.abort();
        let _ = task.await;
    }
}

#[cfg(test)]
mod checkout_transport_tests {
    use super::*;
    use axum::{extract::Query, routing::get, Json, Router};
    use serde_json::json;
    use std::collections::HashMap;
    use uuid::Uuid;
    #[tokio::test]
    async fn checkout_readback_checks_account_resource_and_expanded_items() {
        let op = Uuid::new_v4();
        let app=Router::new().route("/v1/account",get(||async{Json(json!({"id":"acct_checkout","object":"account"}))}))
            .route("/v1/checkout/sessions/cs_test_checkout",get(move |Query(q):Query<HashMap<String,String>>|async move{
                assert_eq!(q.get("expand[]").map(String::as_str),Some("line_items"));
                Json(json!({"object":"checkout.session","id":"cs_test_checkout","mode":"subscription","livemode":false,"customer":"cus_checkout","client_reference_id":op,"metadata":{"atoaxis_checkout_operation":op},"status":"open","payment_status":"unpaid","currency":"usd","amount_subtotal":2500,"expires_at":1792032600,"subscription":null,"line_items":{"has_more":false,"data":[{"quantity":1,"price":{"id":"price_checkout","currency":"usd","unit_amount":2500}}]},"customer_details":{"email":"PRIVATE_FIXTURE"},"url":"PRIVATE_FIXTURE"}))
            }));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let task = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let mut claim = crate::repository::team_stripe_checkout::CheckoutClaim {
            operation: op,
            revision: 1,
            lease: Uuid::new_v4(),
            proof: crate::repository::team_stripe_quote::CustomerProof {
                operation: Uuid::new_v4(),
                revision: 1,
                customer: "cus_checkout".into(),
                org: Uuid::new_v4(),
                actor: Uuid::new_v4(),
                account: "acct_checkout".into(),
                live: false,
            },
            price: "price_checkout".into(),
            currency: "usd".into(),
            amount_minor: 2500,
            seats: 10,
            catalog_hash: "fixture".into(),
            session_id: None,
            lookup_only: false,
            request: crate::services::team_stripe_checkout::FrozenRequest::new(
                &crate::services::team_stripe_checkout::ExpectedSession{operation:op,customer:"cus_checkout",price:"price_checkout",currency:"usd",amount_minor:2500,live:false},
                &crate::services::team_stripe_checkout::CheckoutPolicy::parse(br#"{"schema_version":1,"owner_approved":true,"return_origin":"https://billing.example.test","automatic_tax":true}"#).unwrap()).unwrap(),
        };
        let client = StripeClient::fixture(port, "acct_checkout");
        let result = client
            .checkout_session("cs_test_checkout", &claim)
            .await
            .unwrap();
        assert_eq!(result.id, "cs_test_checkout");
        assert_eq!(result.status, "open");
        assert!(client
            .checkout_session("cs_test_../other", &claim)
            .await
            .is_err());
        claim.proof.customer = "cus_wrong".into();
        assert!(client
            .checkout_session("cs_test_checkout", &claim)
            .await
            .is_err());
        claim.proof.customer = "cus_checkout".into();
        claim.operation = Uuid::new_v4();
        assert!(client
            .checkout_session("cs_test_checkout", &claim)
            .await
            .is_err());
        claim.operation = op;
        assert!(StripeClient::fixture(port, "acct_other")
            .checkout_session("cs_test_checkout", &claim)
            .await
            .is_err());
        task.abort();
        let _ = task.await;
    }
}

#[cfg(test)]
mod checkout_creation_tests {
    use super::*;
    use crate::{
        repository::{team_stripe_checkout::CheckoutClaim, team_stripe_quote::CustomerProof},
        services::{
            team_stripe_catalog::Catalog,
            team_stripe_checkout::{CheckoutPolicy, ExpectedSession, FrozenRequest},
        },
    };
    use axum::{
        extract::State,
        http::{HeaderMap, StatusCode},
        response::IntoResponse,
        routing::{get, post},
        Form, Json, Router,
    };
    use serde_json::{json, Value};
    use std::{collections::BTreeMap, sync::Arc};
    use tokio::sync::Mutex;
    use uuid::Uuid;
    #[derive(Default)]
    struct Fixture {
        posts: usize,
        creations: usize,
        key: Option<String>,
        form: Option<BTreeMap<String, String>>,
        result: Value,
    }
    #[tokio::test]
    async fn checkout_create_retries_frozen_request_after_response_loss_and_reads_back() {
        let op = Uuid::new_v4();
        let response = json!({"object":"checkout.session","id":"cs_test_durable","mode":"subscription","livemode":false,"customer":"cus_create","client_reference_id":op,"metadata":{"atoaxis_checkout_operation":op},"status":"open","payment_status":"unpaid","currency":"usd","amount_subtotal":2500,"expires_at":(chrono::Utc::now()+chrono::Duration::hours(24)).timestamp(),"subscription":null,"line_items":{"has_more":false,"data":[{"quantity":1,"price":{"id":"price_10","currency":"usd","unit_amount":2500}}]},"customer_details":{"email":"PRIVATE_FIXTURE"},"url":"PRIVATE_FIXTURE"});
        let state = Arc::new(Mutex::new(Fixture {
            result: response,
            ..Fixture::default()
        }));
        let price = json!({"object":"price","id":"price_10","active":true,"livemode":false,"currency":"usd","unit_amount":2500,"tax_behavior":"exclusive","type":"recurring","billing_scheme":"per_unit","recurring":{"interval":"month","interval_count":1,"usage_type":"licensed"},"product":{"id":"prod_create","object":"product","active":true,"livemode":false}});
        let app = Router::new()
            .route(
                "/v1/account",
                get(|| async { Json(json!({"id":"acct_create","object":"account"})) }),
            )
            .route(
                "/v1/prices/price_10",
                get(move || {
                    let p = price.clone();
                    async move { Json(p) }
                }),
            )
            .route(
                "/v1/checkout/sessions",
                post(
                    |State(state): State<Arc<Mutex<Fixture>>>,
                     headers: HeaderMap,
                     Form(form): Form<BTreeMap<String, String>>| async move {
                        let mut f = state.lock().await;
                        f.posts += 1;
                        let key = headers
                            .get("idempotency-key")
                            .unwrap()
                            .to_str()
                            .unwrap()
                            .to_owned();
                        if let Some(old) = &f.key {
                            assert_eq!(old, &key);
                            assert_eq!(f.form.as_ref(), Some(&form));
                        } else {
                            f.key = Some(key);
                            f.form = Some(form);
                            f.creations += 1;
                        }
                        if f.posts == 1 {
                            return (StatusCode::OK, "{").into_response();
                        } // accepted, truncated response
                        Json(f.result.clone()).into_response()
                    },
                ),
            )
            .route(
                "/v1/checkout/sessions/cs_test_durable",
                get(|State(state): State<Arc<Mutex<Fixture>>>| async move {
                    Json(state.lock().await.result.clone())
                }),
            )
            .with_state(state.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let task = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let packages=[10,25,50,100].map(|n|json!({"seats":n,"price_id":format!("price_{n}"),"product_id":"prod_create","amount_minor":2500,"tax_behavior":"exclusive"}));
        let catalog=Catalog::parse(&serde_json::to_vec(&json!({"schema_version":1,"revision":1,"owner_approved":true,"account_id":"acct_create","livemode":false,"currency":"usd","packages":packages})).unwrap(),"acct_create",false).unwrap();
        let policy=CheckoutPolicy::parse(br#"{"schema_version":1,"owner_approved":true,"return_origin":"https://billing.example.test","automatic_tax":true}"#).unwrap();
        let frozen = FrozenRequest::new(
            &ExpectedSession {
                operation: op,
                customer: "cus_create",
                price: "price_10",
                currency: "usd",
                amount_minor: 2500,
                live: false,
            },
            &policy,
        )
        .unwrap();
        let mut claim = CheckoutClaim {
            operation: op,
            revision: 1,
            lease: Uuid::new_v4(),
            proof: CustomerProof {
                operation: Uuid::new_v4(),
                revision: 1,
                customer: "cus_create".into(),
                org: Uuid::new_v4(),
                actor: Uuid::new_v4(),
                account: "acct_create".into(),
                live: false,
            },
            price: "price_10".into(),
            currency: "usd".into(),
            amount_minor: 2500,
            seats: 10,
            catalog_hash: catalog.digest().unwrap(),
            session_id: None,
            lookup_only: false,
            request: frozen,
        };
        let client = StripeClient::fixture(port, "acct_create");
        let lost = client
            .create_checkout_session(&claim, &catalog)
            .await
            .err()
            .unwrap();
        assert!(matches!(
            lost.kind,
            crate::repository::team_stripe::Failure::Network
        ));
        let receipt = client
            .create_checkout_session(&claim, &catalog)
            .await
            .unwrap();
        assert_eq!(receipt.id, "cs_test_durable");
        {
            let s = state.lock().await;
            assert_eq!(s.creations, 1);
            assert_eq!(s.posts, 2);
            let form = s.form.as_ref().unwrap();
            assert_eq!(form["line_items[0][quantity]"], "1");
            assert_eq!(form["automatic_tax[enabled]"], "true");
            assert_eq!(
                form["subscription_data[metadata][atoaxis_checkout_operation]"],
                op.to_string()
            );
            assert!(form["success_url"]
                .starts_with("https://billing.example.test/dashboard/wakaclock/teams?"));
            assert!(!serde_json::to_string(form)
                .unwrap()
                .contains("PRIVATE_FIXTURE"));
        }
        claim.catalog_hash = "changed".into();
        assert!(client
            .create_checkout_session(&claim, &catalog)
            .await
            .is_err());
        assert_eq!(state.lock().await.posts, 2);
        task.abort();
        let _ = task.await;
    }
}

/// Lookup outcomes do not authorize another create operation.
pub enum CheckoutLookup {
    Verified(crate::services::team_stripe_checkout::SessionEvidence),
    Unconfirmed(&'static str),
}

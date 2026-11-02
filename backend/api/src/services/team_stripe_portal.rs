//! Ephemeral billing-details portal. Session creation is not a payment, a
//! subscription change or durable financial acceptance. URLs leave only the
//! authenticated no-store response and are never diagnostic/storage fields.
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;
use uuid::Uuid;

pub const FLAG: &str = "ATOAXIS_TEAM_STRIPE_PORTAL_ENABLED";
pub const POLICY_PATH: &str = "ATOAXIS_STRIPE_PORTAL_POLICY_PATH";
/// Local Owner/policy/freshness failures must release the operational lease
/// without poisoning provider-wide auth/backoff for unrelated organizations.
pub enum PortalFailure {
    Authority(anyhow::Error),
    Provider(crate::infrastructure::stripe::ProviderError),
}
impl From<anyhow::Error> for PortalFailure {
    fn from(error: anyhow::Error) -> Self {
        Self::Authority(error)
    }
}
impl From<crate::infrastructure::stripe::ProviderError> for PortalFailure {
    fn from(error: crate::infrastructure::stripe::ProviderError) -> Self {
        Self::Provider(error)
    }
}
pub fn enabled() -> Result<bool> {
    match std::env::var(FLAG).as_deref() {
        Err(std::env::VarError::NotPresent) | Ok("0" | "false") => Ok(false),
        Ok("1" | "true") => Ok(true),
        _ => anyhow::bail!("portal_configuration_invalid"),
    }
}
#[derive(Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PortalPolicy {
    schema_version: u8,
    owner_approved: bool,
    account_id: String,
    livemode: bool,
    configuration_id: String,
    configuration_updated_at: i64,
    return_origin: String,
    customer_update_fields: Vec<String>,
    invoice_history: bool,
    payment_method_update: bool,
}
impl PortalPolicy {
    pub fn from_environment(account: &str, live: bool) -> Result<Self> {
        ensure!(enabled()?, super::team_insights::TeamError::Disabled);
        let path = std::env::var(POLICY_PATH).context("approved portal policy unavailable")?;
        // Bound the read before allocation; no policy content is printed.
        use std::io::Read;
        let file = std::fs::File::open(path).context("approved portal policy unavailable")?;
        let mut bytes = Vec::new();
        file.take(16385).read_to_end(&mut bytes)?;
        Self::parse(&bytes, account, live)
    }
    pub fn parse(bytes: &[u8], account: &str, live: bool) -> Result<Self> {
        ensure!(bytes.len() <= 16384, "portal_policy_limit");
        let policy: Self =
            serde_json::from_slice(bytes).map_err(|_| anyhow::anyhow!("portal_policy_invalid"))?;
        ensure!(
            policy.schema_version == 1
                && policy.owner_approved
                && policy.account_id == account
                && policy.livemode == live
                && super::team_stripe::id(account, "acct_")
                && super::team_stripe::id(&policy.configuration_id, "bpc_")
                && policy.configuration_updated_at > 0,
            "portal_policy_unapproved_or_scope_changed"
        );
        let url = reqwest::Url::parse(&policy.return_origin)
            .map_err(|_| anyhow::anyhow!("portal_return_origin_invalid"))?;
        ensure!(
            url.scheme() == "https"
                && url.host_str().is_some()
                && url.username().is_empty()
                && url.password().is_none()
                && url.query().is_none()
                && url.fragment().is_none()
                && url.path() == "/"
                && url.origin().ascii_serialization() == policy.return_origin,
            "portal_return_origin_invalid"
        );
        let fields: BTreeSet<_> = policy
            .customer_update_fields
            .iter()
            .map(String::as_str)
            .collect();
        ensure!(
            fields.len() == policy.customer_update_fields.len()
                && fields
                    .iter()
                    .all(
                        |s| ["address", "email", "name", "phone", "shipping", "tax_id"].contains(s)
                    )
                && (!fields.is_empty() || policy.invoice_history || policy.payment_method_update),
            "portal_features_unapproved"
        );
        Ok(policy)
    }
    pub fn digest(&self) -> Result<String> {
        super::team_financial_guard::fingerprint(self)
    }
    pub(crate) fn configuration(&self) -> &str {
        &self.configuration_id
    }
    pub(crate) fn account(&self) -> &str {
        &self.account_id
    }
    pub(crate) fn live(&self) -> bool {
        self.livemode
    }
    pub(crate) fn return_url(&self) -> String {
        format!("{}/dashboard/wakaclock/teams", self.return_origin)
    }
    pub(crate) fn purposes(&self) -> Vec<&'static str> {
        let mut result = Vec::new();
        if !self.customer_update_fields.is_empty() {
            result.push("customer_update");
        }
        if self.invoice_history {
            result.push("invoice_history");
        }
        if self.payment_method_update {
            result.push("payment_method_update");
        }
        result
    }
    /// Dedicated configurations must be versioned, not edited underneath issued
    /// sessions. A readback detects observed drift but cannot revoke an issued URL.
    pub fn verify_configuration(&self, value: &Value) -> Result<()> {
        ensure!(
            value["object"] == "billing_portal.configuration"
                && value["id"].as_str() == Some(self.configuration())
                && value["active"] == true
                && value["livemode"].as_bool() == Some(self.live())
                && value["updated"].as_i64() == Some(self.configuration_updated_at)
                && value.get("application").is_some_and(Value::is_null)
                && value["login_page"]["enabled"] == false,
            "portal_configuration_unconfirmed"
        );
        let features = value["features"]
            .as_object()
            .context("portal_features_missing")?;
        ensure!(
            features.keys().all(|key| [
                "customer_update",
                "invoice_history",
                "payment_method_update",
                "subscription_update",
                "subscription_cancel"
            ]
            .contains(&key.as_str()))
                && value["features"]["subscription_update"]["enabled"] == false
                && value["features"]["subscription_cancel"]["enabled"] == false
                && value["features"]["invoice_history"]["enabled"].as_bool()
                    == Some(self.invoice_history)
                && value["features"]["payment_method_update"]["enabled"].as_bool()
                    == Some(self.payment_method_update)
                && value["features"]["customer_update"]["enabled"].as_bool()
                    == Some(!self.customer_update_fields.is_empty()),
            "portal_features_changed"
        );
        let observed = match value["features"]["customer_update"].get("allowed_updates") {
            Some(Value::Array(values)) => values
                .iter()
                .map(|v| v.as_str().context("portal_customer_field_invalid"))
                .collect::<Result<Vec<_>>>()?,
            Some(Value::Null) if self.customer_update_fields.is_empty() => Vec::new(),
            _ => anyhow::bail!("portal_customer_fields_missing"),
        };
        let fields: BTreeSet<_> = observed.iter().copied().collect();
        ensure!(
            fields.len() == observed.len()
                && fields
                    == self
                        .customer_update_fields
                        .iter()
                        .map(String::as_str)
                        .collect(),
            "portal_customer_fields_changed"
        );
        Ok(())
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PortalRequest {
    pub request_id: Uuid,
    pub confirm: bool,
}
impl PortalRequest {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.confirm && !self.request_id.is_nil(),
            super::team_insights::TeamError::Invalid("confirm opening the billing portal")
        );
        Ok(())
    }
}

// No Debug: the bearer URL must not appear in logs through derived formatting.
#[derive(Serialize)]
pub struct HostedPortal {
    pub request_id: Uuid,
    pub url: String,
    pub observed_at: DateTime<Utc>,
    pub display_until: DateTime<Utc>,
    pub provider_expires_at: Option<DateTime<Utc>>,
    pub purposes: Vec<&'static str>,
    pub payment_or_access_confirmed: bool,
}
impl HostedPortal {
    pub(crate) fn parse(
        value: &Value,
        policy: &PortalPolicy,
        customer: &str,
        request_id: Uuid,
        at: DateTime<Utc>,
    ) -> Result<Self> {
        let id = value["id"]
            .as_str()
            .context("portal_session_identity_missing")?;
        let created = value["created"]
            .as_i64()
            .and_then(|t| DateTime::from_timestamp(t, 0))
            .context("portal_creation_time_missing")?;
        ensure!(
            value["object"] == "billing_portal.session"
                && super::team_stripe::id(id, "bps_")
                && value["configuration"].as_str() == Some(policy.configuration())
                && value["customer"].as_str() == Some(customer)
                && super::team_stripe::id(customer, "cus_")
                && value["livemode"].as_bool() == Some(policy.live())
                && value.get("flow").is_some_and(Value::is_null)
                && value.get("on_behalf_of").is_some_and(Value::is_null)
                && value["customer_account"].is_null()
                && value["return_url"].as_str() == Some(policy.return_url().as_str())
                && created <= at
                && at - created <= Duration::seconds(60),
            "portal_session_scope_or_freshness_unconfirmed"
        );
        let url = value["url"]
            .as_str()
            .context("portal_destination_missing")?;
        ensure!(portal_url(url), "portal_destination_invalid");
        Ok(Self {
            request_id,
            url: url.into(),
            observed_at: at,
            display_until: at + Duration::seconds(30),
            provider_expires_at: None,
            purposes: policy.purposes(),
            payment_or_access_confirmed: false,
        })
    }
    pub fn fresh_at(&self, at: DateTime<Utc>) -> Result<()> {
        ensure!(
            self.observed_at <= at && at < self.display_until,
            "portal_display_window_expired_or_clock_changed"
        );
        Ok(())
    }
}
pub fn portal_url(raw: &str) -> bool {
    if raw.len() > 8192 || !raw.bytes().all(|b| (33..=126).contains(&b)) {
        return false;
    }
    let Ok(url) = reqwest::Url::parse(raw) else {
        return false;
    };
    if url.scheme() != "https"
        || url.host_str() != Some("billing.stripe.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.fragment().is_some()
    {
        return false;
    }
    let token = if url.path() == "/p/session" {
        let pairs = url.query_pairs().collect::<Vec<_>>();
        if pairs.len() != 1 || pairs[0].0 != "secret" {
            return false;
        }
        pairs[0].1.to_string()
    } else if let Some(token) = url.path().strip_prefix("/p/session/") {
        if url.query().is_some() {
            return false;
        }
        token.to_owned()
    } else {
        return false;
    };
    !token.is_empty()
        && token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn policy_value() -> Value {
        json!({"schema_version":1,"owner_approved":true,"account_id":"acct_fixture",
            "livemode":false,"configuration_id":"bpc_fixture","configuration_updated_at":1793059200,
            "return_origin":"https://team.example","customer_update_fields":["email","address"],
            "invoice_history":true,"payment_method_update":true})
    }
    fn policy(value: &Value) -> Result<PortalPolicy> {
        PortalPolicy::parse(&serde_json::to_vec(value)?, "acct_fixture", false)
    }
    fn configuration() -> Value {
        json!({"object":"billing_portal.configuration","id":"bpc_fixture","active":true,
            "livemode":false,"updated":1793059200,"application":null,"login_page":{"enabled":false},
            "features":{"customer_update":{"enabled":true,"allowed_updates":["address","email"]},
                "invoice_history":{"enabled":true},"payment_method_update":{"enabled":true},
                "subscription_cancel":{"enabled":false},"subscription_update":{"enabled":false}}})
    }
    fn session() -> Value {
        json!({"object":"billing_portal.session","id":"bps_fixture","configuration":"bpc_fixture",
            "customer":"cus_fixture","livemode":false,"flow":null,"on_behalf_of":null,
            "created":1793059200,"return_url":"https://team.example/dashboard/wakaclock/teams",
            "url":"https://billing.stripe.com/p/session/fixture_token"})
    }
    fn at() -> DateTime<Utc> {
        DateTime::from_timestamp(1793059200, 0).unwrap()
    }
    #[test]
    fn portal_policy_requires_explicit_owner_scope_and_exact_origin() {
        let valid = policy_value();
        assert!(policy(&valid).is_ok());
        for (field, bad) in [
            ("owner_approved", json!(false)),
            ("schema_version", json!(2)),
            ("account_id", json!("acct_other")),
            ("livemode", json!(true)),
            ("configuration_updated_at", json!(0)),
            ("configuration_id", json!("cus_wrong")),
            ("customer_update_fields", json!(["email", "email"])),
            ("customer_update_fields", json!(["unreviewed_field"])),
        ] {
            let mut changed = valid.clone();
            changed[field] = bad;
            assert!(policy(&changed).is_err(), "{field}");
        }
        for origin in [
            "http://team.example",
            "https://team.example/",
            "https://team.example/path",
            "https://owner:password@team.example",
            "https://team.example?redirect=1",
            "https://team.example#fragment",
        ] {
            let mut changed = valid.clone();
            changed["return_origin"] = json!(origin);
            assert!(policy(&changed).is_err());
        }
        let mut unknown = valid;
        unknown["client_selected_customer"] = json!("cus_other");
        assert!(policy(&unknown).is_err());
        assert!(PortalPolicy::parse(&vec![b' '; 16385], "acct_fixture", false).is_err());
    }
    #[test]
    fn portal_configuration_cannot_enable_subscription_changes_or_drift() {
        let approved = policy(&policy_value()).unwrap();
        assert!(approved.verify_configuration(&configuration()).is_ok());
        for pointer in [
            "/active",
            "/livemode",
            "/updated",
            "/application",
            "/login_page/enabled",
            "/features/customer_update/enabled",
            "/features/invoice_history/enabled",
            "/features/payment_method_update/enabled",
            "/features/subscription_cancel/enabled",
            "/features/subscription_update/enabled",
        ] {
            let mut changed = configuration();
            let field = changed.pointer_mut(pointer).unwrap();
            *field = match field {
                Value::Bool(v) => json!(!*v),
                Value::Number(_) => json!(1793059201),
                _ => json!("ca_unapproved"),
            };
            assert!(
                approved.verify_configuration(&changed).is_err(),
                "{pointer}"
            );
        }
        let mut changed = configuration();
        changed["features"]["new_feature"] = json!({"enabled":true});
        assert!(approved.verify_configuration(&changed).is_err());
        changed = configuration();
        changed["features"]["customer_update"]["allowed_updates"] = json!(["email", "email"]);
        assert!(approved.verify_configuration(&changed).is_err());
        let mut disabled = policy_value();
        disabled["customer_update_fields"] = json!([]);
        let approved = policy(&disabled).unwrap();
        changed = configuration();
        changed["features"]["customer_update"] = json!({"enabled":false,"allowed_updates":null});
        assert!(approved.verify_configuration(&changed).is_ok());
    }
    #[test]
    fn portal_urls_only_accept_the_two_documented_stripe_forms() {
        for url in [
            "https://billing.stripe.com/p/session/fixture_token",
            "https://billing.stripe.com/p/session?secret=fixture_token",
        ] {
            assert!(portal_url(url));
        }
        for url in [
            "http://billing.stripe.com/p/session/a",
            "https://billing.stripe.com.evil.example/p/session/a",
            "https://owner@billing.stripe.com/p/session/a",
            "https://billing.stripe.com:444/p/session/a",
            "https://billing.stripe.com/p/session/",
            "https://billing.stripe.com/p/session/a?redirect=1",
            "https://billing.stripe.com/p/session/a#fragment",
            "https://billing.stripe.com/p/session?secret=a&secret=b",
            "https://billing.stripe.com/p/session?secret=a&redirect=1",
            "https://billing.stripe.com/p/session?secret=a%2Fb",
            "https://billing.stripe.com/p/session/a/b",
            "https://billing.stripe.com/p/session/a\n",
        ] {
            assert!(!portal_url(url));
        }
    }
    #[test]
    fn portal_session_keeps_provider_expiry_unknown_and_fences_scope_and_age() {
        let approved = policy(&policy_value()).unwrap();
        let request = Uuid::new_v4();
        let parsed =
            HostedPortal::parse(&session(), &approved, "cus_fixture", request, at()).unwrap();
        assert!(parsed.provider_expires_at.is_none());
        assert!(!parsed.payment_or_access_confirmed);
        assert_eq!(
            parsed.display_until - parsed.observed_at,
            Duration::seconds(30)
        );
        assert!(parsed.fresh_at(at() + Duration::seconds(29)).is_ok());
        assert!(parsed.fresh_at(at() + Duration::seconds(30)).is_err());
        assert!(parsed.fresh_at(at() - Duration::seconds(1)).is_err());
        for (field, bad) in [
            ("customer", json!("cus_other")),
            ("configuration", json!("bpc_other")),
            ("livemode", json!(true)),
            ("flow", json!({"type":"subscription_cancel"})),
            ("on_behalf_of", json!("acct_other")),
            ("customer_account", json!("acct_other")),
            ("created", json!(1793059201)),
            ("created", json!(1793059139)),
            ("return_url", json!("https://evil.example")),
            ("url", json!("https://evil.example")),
        ] {
            let mut changed = session();
            changed[field] = bad;
            assert!(
                HostedPortal::parse(&changed, &approved, "cus_fixture", request, at()).is_err(),
                "{field}"
            );
        }
    }
    #[test]
    fn portal_request_cannot_supply_customer_or_return_url() {
        let request = Uuid::new_v4();
        let valid = json!({"request_id":request,"confirm":true});
        assert!(serde_json::from_value::<PortalRequest>(valid.clone())
            .unwrap()
            .validate()
            .is_ok());
        for field in [
            "customer",
            "return_url",
            "configuration",
            "actor",
            "organization_id",
        ] {
            let mut changed = valid.clone();
            changed[field] = json!("untrusted");
            assert!(serde_json::from_value::<PortalRequest>(changed).is_err());
        }
        assert!(PortalRequest {
            request_id: Uuid::nil(),
            confirm: true
        }
        .validate()
        .is_err());
        assert!(PortalRequest {
            request_id: request,
            confirm: false
        }
        .validate()
        .is_err());
    }
}

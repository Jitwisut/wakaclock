//! Allowlisted subscription observations. Webhook snapshots never provision access.
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub fn enabled() -> bool {
    std::env::var("ATOAXIS_TEAM_STRIPE_ENABLED").ok().as_deref() == Some("1")
}
pub fn id(value: &str, prefix: &str) -> bool {
    value.starts_with(prefix)
        && value.len() > prefix.len()
        && value.len() <= 200
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
}
fn object_id(v: &Value, prefix: &str) -> Result<String> {
    let s = v
        .as_str()
        .or_else(|| v.get("id").and_then(Value::as_str))
        .context("provider identity missing")?;
    ensure!(id(s, prefix), "provider identity invalid");
    Ok(s.to_owned())
}
fn time(v: &Value) -> Result<DateTime<Utc>> {
    DateTime::from_timestamp(v.as_i64().context("provider timestamp missing")?, 0)
        .context("provider timestamp invalid")
}
fn optional_time(v: &Value) -> Result<Option<DateTime<Utc>>> {
    if v.is_null() {
        Ok(None)
    } else {
        time(v).map(Some)
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Event {
    pub account_id: String,
    pub livemode: bool,
    pub event_id: String,
    pub kind: String,
    pub created: DateTime<Utc>,
    pub customer_id: Option<String>,
    pub subscription_id: Option<String>,
    pub invoice_id: Option<String>,
    pub supported: bool,
}
pub fn event(body: &[u8], account: &str, livemode: bool, now: DateTime<Utc>) -> Result<Event> {
    ensure!(
        body.len() <= 2_000_000 && id(account, "acct_"),
        "webhook contract invalid"
    );
    let v: Value = serde_json::from_slice(body).context("webhook contract invalid")?;
    ensure!(
        v.get("account").is_none_or(|a| a.as_str() == Some(account)),
        "provider account mismatch"
    );
    ensure!(
        v["livemode"].as_bool() == Some(livemode),
        "provider mode mismatch"
    );
    let event_id = object_id(&v, "evt_")?;
    let created = time(&v["created"])?;
    ensure!(
        created <= now + chrono::Duration::minutes(5),
        "future event timestamp"
    );
    let kind = v["type"].as_str().context("event type missing")?;
    ensure!(
        kind.len() <= 128
            && kind
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_'),
        "event type invalid"
    );
    let mut out = Event {
        account_id: account.into(),
        livemode,
        event_id,
        kind: kind.into(),
        created,
        customer_id: None,
        subscription_id: None,
        invoice_id: None,
        supported: false,
    };
    let o = &v["data"]["object"];
    match kind {
        "customer.subscription.created"
        | "customer.subscription.updated"
        | "customer.subscription.deleted"
        | "customer.subscription.paused"
        | "customer.subscription.resumed"
        | "customer.subscription.trial_will_end" => {
            ensure!(
                o["object"] == "subscription",
                "subscription event contract invalid"
            );
            out.subscription_id = Some(object_id(o, "sub_")?);
            out.customer_id = Some(object_id(&o["customer"], "cus_")?);
            out.supported = true;
        }
        "invoice.paid" | "invoice.payment_failed" | "invoice.payment_action_required" => {
            ensure!(o["object"] == "invoice", "invoice event contract invalid");
            out.invoice_id = Some(object_id(o, "in_")?);
            out.customer_id = Some(object_id(&o["customer"], "cus_")?);
            let subscription = o
                .get("subscription")
                .filter(|s| !s.is_null())
                .unwrap_or(&o["parent"]["subscription_details"]["subscription"]);
            if !subscription.is_null() {
                out.subscription_id = Some(object_id(subscription, "sub_")?);
                out.supported = true;
            }
        }
        "checkout.session.completed"
        | "checkout.session.async_payment_succeeded"
        | "checkout.session.async_payment_failed" => {
            ensure!(
                o["object"] == "checkout.session",
                "checkout event contract invalid"
            );
            if !o["subscription"].is_null() {
                out.subscription_id = Some(object_id(&o["subscription"], "sub_")?);
                out.customer_id = Some(object_id(&o["customer"], "cus_")?);
                out.supported = true;
            }
        }
        _ => (),
    }
    Ok(out)
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Snapshot {
    pub subscription_id: String,
    pub customer_id: String,
    pub status: String,
    pub period_start: Option<DateTime<Utc>>,
    pub period_end: Option<DateTime<Utc>>,
    pub trial_end: Option<DateTime<Utc>>,
    pub cancel_at_period_end: bool,
    pub latest_invoice_id: Option<String>,
    pub price_id: Option<String>,
    pub subscription_item_id: Option<String>,
    pub currency: Option<String>,
    pub amount_minor: Option<i64>,
    pub quantity: Option<i64>,
    pub items_complete: bool,
    pub observed_at: DateTime<Utc>,
}
pub fn snapshot(
    v: &Value,
    subscription: &str,
    customer: &str,
    livemode: bool,
    at: DateTime<Utc>,
) -> Result<Snapshot> {
    ensure!(
        v["object"] == "subscription"
            && object_id(v, "sub_")? == subscription
            && object_id(&v["customer"], "cus_")? == customer
            && v["livemode"].as_bool() == Some(livemode),
        "subscription scope mismatch"
    );
    let status = v["status"]
        .as_str()
        .context("subscription status missing")?;
    ensure!(
        [
            "trialing",
            "active",
            "past_due",
            "canceled",
            "incomplete",
            "incomplete_expired",
            "unpaid",
            "paused"
        ]
        .contains(&status),
        "subscription status unsupported"
    );
    let items = v["items"]["data"]
        .as_array()
        .context("subscription items missing")?;
    ensure!(items.len() <= 100, "subscription item limit");
    let complete = v["items"]["has_more"].as_bool() == Some(false) && items.len() == 1;
    let item = items.first().filter(|_| complete);
    let price = item.map(|i| &i["price"]);
    let optional_string = |field: &str| price.and_then(|p| p[field].as_str()).map(String::from);
    let price_id = optional_string("id");
    ensure!(
        price_id.as_ref().is_none_or(|p| id(p, "price_")),
        "price identity invalid"
    );
    let currency = optional_string("currency");
    ensure!(
        currency
            .as_ref()
            .is_none_or(|c| c.len() == 3 && c.bytes().all(|b| b.is_ascii_lowercase())),
        "currency invalid"
    );
    let amount = price.and_then(|p| p["unit_amount"].as_i64());
    let quantity = item.and_then(|i| i["quantity"].as_i64());
    ensure!(
        amount.is_none_or(|n| n >= 0) && quantity.is_none_or(|n| n >= 0),
        "billing amount invalid"
    );
    let start = optional_time(
        item.map(|i| &i["current_period_start"])
            .unwrap_or(&Value::Null),
    )?;
    let end = optional_time(
        item.map(|i| &i["current_period_end"])
            .unwrap_or(&Value::Null),
    )?;
    ensure!(
        start.zip(end).is_none_or(|(a, b)| a < b),
        "billing period invalid"
    );
    let invoice = if v["latest_invoice"].is_null() {
        None
    } else {
        Some(object_id(&v["latest_invoice"], "in_")?)
    };
    Ok(Snapshot {
        subscription_id: subscription.into(),
        customer_id: customer.into(),
        status: status.into(),
        period_start: start,
        period_end: end,
        trial_end: optional_time(&v["trial_end"])?,
        cancel_at_period_end: v["cancel_at_period_end"]
            .as_bool()
            .context("cancellation state missing")?,
        latest_invoice_id: invoice,
        price_id,
        subscription_item_id: item
            .and_then(|i| i.get("id"))
            .map(|v| object_id(v, "si_"))
            .transpose()?,
        currency,
        amount_minor: amount,
        quantity,
        items_complete: complete,
        observed_at: at,
    })
}
#[derive(Debug, Clone, Copy)]
pub enum WebhookFailure {
    Disabled,
    Unavailable,
    InvalidSignature,
    InvalidMetadata,
    NotDurable,
}
impl std::fmt::Display for WebhookFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Disabled => "Stripe receiver disabled",
            Self::Unavailable => "Stripe receiver unavailable",
            Self::InvalidSignature => "invalid webhook signature",
            Self::InvalidMetadata => "invalid webhook metadata",
            Self::NotDurable => "webhook not durably accepted; retry delivery",
        })
    }
}
impl std::error::Error for WebhookFailure {}

/// Signed ingress boundary. Callers must select server-owned account/mode/secret configuration.
/// This type deliberately has no Debug/Serialize implementation.
pub struct Ingress {
    repository: crate::repository::team_stripe::TeamStripeRepository,
    account: String,
    livemode: bool,
    secret: Vec<u8>,
}
impl Ingress {
    pub fn new(
        repository: crate::repository::team_stripe::TeamStripeRepository,
        account: String,
        livemode: bool,
        secret: Vec<u8>,
    ) -> Result<Self> {
        ensure!(
            id(&account, "acct_") && !secret.is_empty(),
            "Stripe ingress configuration unavailable"
        );
        Ok(Self {
            repository,
            account,
            livemode,
            secret,
        })
    }
    pub async fn accept(
        &self,
        body: &[u8],
        signature: &str,
        now: DateTime<Utc>,
    ) -> std::result::Result<crate::repository::team_stripe::Acceptance, WebhookFailure> {
        if body.len() > 2_000_000 {
            return Err(WebhookFailure::InvalidMetadata);
        }
        super::team_webhooks::verify_stripe(&self.secret, body, signature, now.timestamp())
            .map_err(|_| WebhookFailure::InvalidSignature)?;
        let metadata = event(body, &self.account, self.livemode, now)
            .map_err(|_| WebhookFailure::InvalidMetadata)?;
        self.repository
            .accept(&metadata, &super::team_webhooks::payload_hash(body))
            .await
            .map_err(|_| WebhookFailure::NotDurable)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn metadata_drops_sensitive_fields_and_does_not_trust_checkout() {
        let v = json!({"id":"evt_a","type":"checkout.session.completed","created":Utc::now().timestamp(),"livemode":false,"data":{"object":{"object":"checkout.session","customer":"cus_a","subscription":"sub_a","metadata":{"organization_id":"spoofed"},"client_secret":"PRIVATE_FIXTURE","email":"PRIVATE_FIXTURE"}}});
        let e = event(
            &serde_json::to_vec(&v).unwrap(),
            "acct_a",
            false,
            Utc::now(),
        )
        .unwrap();
        let encoded = serde_json::to_string(&e).unwrap();
        assert!(!encoded.contains("PRIVATE_FIXTURE") && !encoded.contains("spoofed"));
        assert!(event(&serde_json::to_vec(&v).unwrap(), "acct_a", true, Utc::now()).is_err());
        let mut other = v;
        other["account"] = json!("acct_b");
        assert!(event(
            &serde_json::to_vec(&other).unwrap(),
            "acct_a",
            false,
            Utc::now()
        )
        .is_err());
    }
    #[test]
    fn payment_failure_identity_supports_basil_and_legacy_without_body_storage() {
        let now = Utc::now();
        let v = json!({"id":"evt_a","type":"invoice.payment_failed","created":now.timestamp(),"livemode":false,"data":{"object":{"object":"invoice","id":"in_a","customer":"cus_a","parent":{"subscription_details":{"subscription":"sub_a"}},"description":"PRIVATE_FIXTURE"}}});
        let e = event(&serde_json::to_vec(&v).unwrap(), "acct_a", false, now).unwrap();
        assert_eq!(e.subscription_id.as_deref(), Some("sub_a"));
        assert_eq!(e.invoice_id.as_deref(), Some("in_a"));
        assert!(!serde_json::to_string(&e)
            .unwrap()
            .contains("PRIVATE_FIXTURE"));
    }
    #[test]
    fn amounts_are_provider_minor_units_unknown_never_zero() {
        let v = json!({"object":"subscription","id":"sub_a","customer":"cus_a","livemode":false,"status":"active","cancel_at_period_end":false,"items":{"has_more":false,"data":[{"current_period_start":1,"current_period_end":2,"quantity":1,"price":{"id":"price_a","currency":"jpy","unit_amount":null}}]}});
        let s = snapshot(&v, "sub_a", "cus_a", false, Utc::now()).unwrap();
        assert!(s.amount_minor.is_none());
        assert_eq!(s.currency.as_deref(), Some("jpy"));
        let mut more = v;
        more["items"]["has_more"] = json!(true);
        let s = snapshot(&more, "sub_a", "cus_a", false, Utc::now()).unwrap();
        assert!(!s.items_complete && s.price_id.is_none() && s.period_end.is_none());
    }
}

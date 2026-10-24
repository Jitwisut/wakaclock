//! Allowlisted Checkout evidence. A complete session is not paid entitlement.
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde_json::Value;
use uuid::Uuid;

pub struct ExpectedSession<'a> {
    pub operation: Uuid,
    pub customer: &'a str,
    pub price: &'a str,
    pub currency: &'a str,
    pub amount_minor: i64,
    pub live: bool,
}
/// Constructible only through the checked provider parser; URLs/customer details are dropped.
pub struct SessionEvidence {
    pub(crate) operation: Uuid,
    pub(crate) customer: String,
    pub(crate) price: String,
    pub(crate) currency: String,
    pub(crate) amount_minor: i64,
    pub(crate) live: bool,
    pub(crate) id: String,
    pub(crate) status: String,
    pub(crate) expires_at: DateTime<Utc>,
    pub(crate) subscription: Option<String>,
    pub(crate) observed_at: DateTime<Utc>,
}
impl SessionEvidence {
    pub fn parse(value: &Value, expected: &ExpectedSession<'_>, at: DateTime<Utc>) -> Result<Self> {
        let operation = expected.operation.to_string();
        ensure!(
            value["object"] == "checkout.session"
                && value["mode"] == "subscription"
                && value["livemode"].as_bool() == Some(expected.live)
                && value["customer"].as_str() == Some(expected.customer)
                && value["client_reference_id"].as_str() == Some(&operation)
                && value["metadata"]["atoaxis_checkout_operation"].as_str() == Some(&operation),
            "checkout identity unconfirmed"
        );
        let id = value["id"]
            .as_str()
            .context("checkout identity unavailable")?;
        ensure!(
            super::team_stripe::id(
                id,
                if expected.live {
                    "cs_live_"
                } else {
                    "cs_test_"
                }
            ),
            "checkout identity invalid"
        );
        let status = value["status"]
            .as_str()
            .context("checkout status unavailable")?;
        ensure!(
            ["open", "complete", "expired"].contains(&status),
            "checkout status unknown"
        );
        ensure!(
            ["paid", "unpaid", "no_payment_required"]
                .contains(&value["payment_status"].as_str().unwrap_or("")),
            "checkout payment status unknown"
        );
        let lines = value["line_items"]["data"]
            .as_array()
            .context("checkout items unavailable")?;
        ensure!(
            value["line_items"]["has_more"] == false && lines.len() == 1,
            "checkout items incomplete"
        );
        let line = &lines[0];
        ensure!(
            line["quantity"] == 1
                && line["price"]["id"].as_str() == Some(expected.price)
                && line["price"]["currency"].as_str() == Some(expected.currency)
                && line["price"]["unit_amount"].as_i64() == Some(expected.amount_minor)
                && value["currency"].as_str() == Some(expected.currency)
                && value["amount_subtotal"].as_i64() == Some(expected.amount_minor),
            "checkout package changed"
        );
        let expires_at = value["expires_at"]
            .as_i64()
            .and_then(|t| DateTime::from_timestamp(t, 0))
            .context("checkout expiry unavailable")?;
        let subscription = if value["subscription"].is_null() {
            None
        } else {
            let id = value["subscription"]
                .as_str()
                .context("checkout subscription ambiguous")?;
            ensure!(
                super::team_stripe::id(id, "sub_"),
                "checkout subscription invalid"
            );
            Some(id.to_owned())
        };
        ensure!(
            status == "complete" || subscription.is_none(),
            "checkout lifecycle ambiguous"
        );
        Ok(Self {
            operation: expected.operation,
            customer: expected.customer.into(),
            price: expected.price.into(),
            currency: expected.currency.into(),
            amount_minor: expected.amount_minor,
            live: expected.live,
            id: id.into(),
            status: status.into(),
            expires_at,
            subscription,
            observed_at: at,
        })
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn checkout_evidence_is_scoped_and_drops_untrusted_fields() {
        let op = Uuid::new_v4();
        let e = ExpectedSession {
            operation: op,
            customer: "cus_test",
            price: "price_test",
            currency: "usd",
            amount_minor: 2500,
            live: false,
        };
        let value = json!({"object":"checkout.session","id":"cs_test_fixture","mode":"subscription","livemode":false,"customer":"cus_test","client_reference_id":op,"metadata":{"atoaxis_checkout_operation":op},"status":"complete","payment_status":"unpaid","currency":"usd","amount_subtotal":2500,"expires_at":1792029000,"subscription":"sub_test","line_items":{"has_more":false,"data":[{"quantity":1,"price":{"id":"price_test","currency":"usd","unit_amount":2500}}]},"customer_details":{"email":"PRIVATE_FIXTURE"},"url":"PRIVATE_FIXTURE"});
        let evidence = SessionEvidence::parse(&value, &e, Utc::now()).unwrap();
        assert_eq!(evidence.status, "complete"); // unpaid still must wait for independent invoice evidence.
        assert_eq!(evidence.subscription.as_deref(), Some("sub_test"));
        for (key, bad) in [
            ("customer", json!("cus_other")),
            ("client_reference_id", json!(Uuid::new_v4())),
            ("livemode", json!(true)),
            ("mode", json!("payment")),
            ("currency", json!("thb")),
            ("amount_subtotal", json!(0)),
            ("payment_status", json!("unknown")),
            ("expires_at", json!(null)),
            ("subscription", json!({"id":"sub_test"})),
            ("status", json!("open")),
        ] {
            let mut wrong = value.clone();
            wrong[key] = bad;
            assert!(
                SessionEvidence::parse(&wrong, &e, Utc::now()).is_err(),
                "{key}"
            );
        }
        let mut wrong = value.clone();
        wrong["line_items"]["has_more"] = json!(true);
        assert!(SessionEvidence::parse(&wrong, &e, Utc::now()).is_err());
        let mut wrong = value.clone();
        wrong["line_items"]["data"][0]["quantity"] = json!(2);
        assert!(SessionEvidence::parse(&wrong, &e, Utc::now()).is_err());
    }
}

/// Server policy, never supplied by a browser confirmation payload.
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CheckoutPolicy {
    schema_version: u16,
    owner_approved: bool,
    return_origin: String,
    automatic_tax: bool,
}
impl CheckoutPolicy {
    /// Internal staging only. Live purchase remains blocked until the launch gates pass.
    pub fn test_confirmation_allowed(live: bool, flag: Option<&str>) -> bool {
        !live && matches!(flag, Some("1" | "true"))
    }
    pub fn from_test_env(live: bool) -> Result<Option<Self>> {
        if !Self::test_confirmation_allowed(
            live,
            std::env::var("ATOAXIS_TEAM_STRIPE_TEST_CHECKOUT_ENABLED")
                .ok()
                .as_deref(),
        ) {
            return Ok(None);
        }
        let path = std::env::var("ATOAXIS_STRIPE_CHECKOUT_POLICY_PATH")
            .context("approved checkout policy unavailable")?;
        let bytes = std::fs::read(path).context("approved checkout policy unavailable")?;
        Self::parse(&bytes).map(Some)
    }
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        ensure!(bytes.len() <= 16_384, "checkout policy too large");
        let p: Self = serde_json::from_slice(bytes)
            .map_err(|_| anyhow::anyhow!("checkout policy invalid"))?;
        ensure!(
            p.schema_version == 1 && p.owner_approved,
            "checkout policy not approved"
        );
        Self::origin(&p.return_origin)?;
        Ok(p)
    }
    fn origin(raw: &str) -> Result<()> {
        let url = reqwest::Url::parse(raw)
            .map_err(|_| anyhow::anyhow!("checkout return origin invalid"))?;
        ensure!(
            url.scheme() == "https"
                && url.host_str().is_some()
                && url.username().is_empty()
                && url.password().is_none()
                && url.query().is_none()
                && url.fragment().is_none()
                && url.path() == "/"
                && url.origin().ascii_serialization() == raw,
            "checkout return origin must be an HTTPS origin"
        );
        Ok(())
    }
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FrozenRequest {
    schema_version: u16,
    operation: Uuid,
    customer: String,
    price: String,
    return_origin: String,
    automatic_tax: bool,
}
impl FrozenRequest {
    pub fn new(expected: &ExpectedSession<'_>, policy: &CheckoutPolicy) -> Result<Self> {
        CheckoutPolicy::origin(&policy.return_origin)?;
        ensure!(
            super::team_stripe::id(expected.customer, "cus_")
                && super::team_stripe::id(expected.price, "price_"),
            "checkout request identity invalid"
        );
        Ok(Self {
            schema_version: 1,
            operation: expected.operation,
            customer: expected.customer.into(),
            price: expected.price.into(),
            return_origin: policy.return_origin.clone(),
            automatic_tax: policy.automatic_tax,
        })
    }
    pub fn digest(&self) -> Result<String> {
        use sha2::{Digest, Sha256};
        Ok(format!("{:x}", Sha256::digest(serde_json::to_vec(self)?)))
    }
    pub fn restore(value: &Value, digest: &str, expected: &ExpectedSession<'_>) -> Result<Self> {
        let request: Self = serde_json::from_value(value.clone())
            .map_err(|_| anyhow::anyhow!("checkout request schema unavailable"))?;
        ensure!(
            request.schema_version == 1
                && request.operation == expected.operation
                && request.customer == expected.customer
                && request.price == expected.price
                && request.digest()? == digest,
            "checkout request changed"
        );
        CheckoutPolicy::origin(&request.return_origin)?;
        Ok(request)
    }
    pub fn form(&self) -> std::collections::BTreeMap<String, String> {
        let op = self.operation.to_string();
        [
            ("mode", "subscription".into()),
            ("customer", self.customer.clone()),
            ("line_items[0][price]", self.price.clone()),
            ("line_items[0][quantity]", "1".into()),
            ("client_reference_id", op.clone()),
            ("metadata[atoaxis_checkout_operation]", op.clone()),
            (
                "subscription_data[metadata][atoaxis_checkout_operation]",
                op.clone(),
            ),
            (
                "success_url",
                format!(
                    "{}/dashboard/wakaclock/teams?billing=return&operation={op}",
                    self.return_origin
                ),
            ),
            (
                "cancel_url",
                format!(
                    "{}/dashboard/wakaclock/teams?billing=cancel&operation={op}",
                    self.return_origin
                ),
            ),
            ("automatic_tax[enabled]", self.automatic_tax.to_string()),
            ("adaptive_pricing[enabled]", "false".into()),
            ("allow_promotion_codes", "false".into()),
            ("expand[]", "line_items".into()),
        ]
        .into_iter()
        .map(|(k, v)| (k.into(), v))
        .collect()
    }
}
#[cfg(test)]
mod request_tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn frozen_checkout_request_uses_approved_origin_and_rejects_tampering() {
        let op = Uuid::new_v4();
        let expected = ExpectedSession {
            operation: op,
            customer: "cus_test",
            price: "price_test",
            currency: "usd",
            amount_minor: 100,
            live: false,
        };
        let policy = json!({"schema_version":1,"owner_approved":true,"return_origin":"https://billing.example.test","automatic_tax":true});
        let parsed = CheckoutPolicy::parse(&serde_json::to_vec(&policy).unwrap()).unwrap();
        let request = FrozenRequest::new(&expected, &parsed).unwrap();
        let digest = request.digest().unwrap();
        let v = serde_json::to_value(&request).unwrap();
        let restored = FrozenRequest::restore(&v, &digest, &expected).unwrap();
        assert_eq!(request.form(), restored.form());
        assert_eq!(request.form()["line_items[0][quantity]"], "1");
        assert_eq!(request.form()["automatic_tax[enabled]"], "true");
        assert!(!request.form().contains_key("expires_at")); // retry does not regenerate a time-dependent value
        let mut bad = v.clone();
        bad["price"] = json!("price_other");
        assert!(FrozenRequest::restore(&bad, &digest, &expected).is_err());
        let mut bad = v.clone();
        bad["return_origin"] = json!("https://other.example.test");
        assert!(FrozenRequest::restore(&bad, &digest, &expected).is_err());
        for origin in [
            "http://localhost:3000",
            "https://user:pass@example.test",
            "https://example.test/path",
            "https://example.test?token=secret",
            "https://example.test#secret",
            "javascript:alert(1)",
        ] {
            let mut bad = policy.clone();
            bad["return_origin"] = json!(origin);
            assert!(CheckoutPolicy::parse(&serde_json::to_vec(&bad).unwrap()).is_err());
        }
        let mut bad = policy;
        bad["owner_approved"] = json!(false);
        assert!(CheckoutPolicy::parse(&serde_json::to_vec(&bad).unwrap()).is_err());
    }
}

/// Verified ownership/terms of the subscription produced by this exact Checkout operation.
/// Establishes identity for ongoing invoice reconciliation, never paid entitlement.
pub struct SubscriptionEvidence {
    pub(crate) operation: Uuid,
    pub(crate) session: String,
    pub(crate) live: bool,
    pub(crate) snapshot: super::team_stripe::Snapshot,
}
impl SubscriptionEvidence {
    pub fn parse(
        value: &Value,
        session: &SessionEvidence,
        expected: &ExpectedSession<'_>,
        at: DateTime<Utc>,
    ) -> Result<Self> {
        ensure!(
            session.status == "complete"
                && session.operation == expected.operation
                && session.customer == expected.customer
                && session.live == expected.live,
            "checkout completion unconfirmed"
        );
        let sub = session
            .subscription
            .as_deref()
            .context("checkout subscription unavailable")?;
        ensure!(
            value["metadata"]["atoaxis_checkout_operation"].as_str()
                == Some(expected.operation.to_string().as_str()),
            "subscription operation unconfirmed"
        );
        let snapshot =
            super::team_stripe::snapshot(value, sub, expected.customer, expected.live, at)?;
        ensure!(
            snapshot.items_complete
                && snapshot.quantity == Some(1)
                && snapshot.price_id.as_deref() == Some(expected.price)
                && snapshot.currency.as_deref() == Some(expected.currency)
                && snapshot.amount_minor == Some(expected.amount_minor),
            "subscription package changed"
        );
        Ok(Self {
            operation: expected.operation,
            session: session.id.clone(),
            live: expected.live,
            snapshot,
        })
    }
}
#[cfg(test)]
mod subscription_tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn binding_proof_checks_operation_customer_and_terms_without_claiming_payment() {
        let op = Uuid::new_v4();
        let e = ExpectedSession {
            operation: op,
            customer: "cus_bind",
            price: "price_bind",
            currency: "usd",
            amount_minor: 2500,
            live: false,
        };
        let session=SessionEvidence::parse(&json!({"object":"checkout.session","id":"cs_test_bind","mode":"subscription","livemode":false,"customer":"cus_bind","client_reference_id":op,"metadata":{"atoaxis_checkout_operation":op},"status":"complete","payment_status":"unpaid","currency":"usd","amount_subtotal":2500,"expires_at":1792100000,"subscription":"sub_bind","line_items":{"has_more":false,"data":[{"quantity":1,"price":{"id":"price_bind","currency":"usd","unit_amount":2500}}]}}),&e,Utc::now()).unwrap();
        let raw = json!({"object":"subscription","id":"sub_bind","customer":"cus_bind","livemode":false,"metadata":{"atoaxis_checkout_operation":op},"status":"incomplete","cancel_at_period_end":false,"latest_invoice":null,"items":{"has_more":false,"data":[{"id":"si_bind","quantity":1,"current_period_start":1792000000,"current_period_end":1794600000,"price":{"id":"price_bind","currency":"usd","unit_amount":2500}}]}});
        assert_eq!(
            SubscriptionEvidence::parse(&raw, &session, &e, Utc::now())
                .unwrap()
                .snapshot
                .status,
            "incomplete"
        );
        for (key, v) in [
            ("id", json!("sub_other")),
            ("customer", json!("cus_other")),
            ("livemode", json!(true)),
            (
                "metadata",
                json!({"atoaxis_checkout_operation":Uuid::new_v4()}),
            ),
        ] {
            let mut bad = raw.clone();
            bad[key] = v;
            assert!(SubscriptionEvidence::parse(&bad, &session, &e, Utc::now()).is_err());
        }
        let mut bad = raw.clone();
        bad["items"]["data"][0]["quantity"] = json!(2);
        assert!(SubscriptionEvidence::parse(&bad, &session, &e, Utc::now()).is_err());
        let mut bad = raw;
        bad["items"]["has_more"] = json!(true);
        assert!(SubscriptionEvidence::parse(&bad, &session, &e, Utc::now()).is_err());
    }
}

#[cfg(test)]
mod purchase_gate_tests {
    use super::CheckoutPolicy;
    #[test]
    fn purchase_is_explicit_test_only_until_live_launch_gates_pass() {
        for flag in [
            None,
            Some(""),
            Some("false"),
            Some("0"),
            Some("yes"),
            Some("TRUE"),
        ] {
            assert!(!CheckoutPolicy::test_confirmation_allowed(false, flag));
        }
        for flag in [Some("1"), Some("true")] {
            assert!(CheckoutPolicy::test_confirmation_allowed(false, flag));
            assert!(!CheckoutPolicy::test_confirmation_allowed(true, flag));
        }
    }
}

/// Ephemeral browser destination. Never persist or log the hosted URL.
#[derive(serde::Serialize)]
pub struct HostedCheckout {
    pub operation_id: Uuid,
    pub url: String,
    pub expires_at: DateTime<Utc>,
    pub observed_at: DateTime<Utc>,
}
impl HostedCheckout {
    pub fn parse(
        value: &Value,
        expected: &ExpectedSession<'_>,
        session: &str,
        now: DateTime<Utc>,
    ) -> Result<Self> {
        let receipt = SessionEvidence::parse(value, expected, now)?;
        ensure!(
            receipt.id == session && receipt.status == "open" && receipt.expires_at > now,
            "checkout not open"
        );
        let raw = value["url"]
            .as_str()
            .context("hosted checkout unavailable")?;
        ensure!(
            raw.len() <= 8192
                && raw.is_ascii()
                && !raw.bytes().any(|c| c.is_ascii_control() || c == b' '),
            "hosted checkout invalid"
        );
        ensure!(
            raw.split('#').next()
                == Some(format!("https://checkout.stripe.com/c/pay/{session}").as_str()),
            "hosted checkout invalid"
        );
        let url =
            reqwest::Url::parse(raw).map_err(|_| anyhow::anyhow!("hosted checkout invalid"))?;
        ensure!(
            url.scheme() == "https"
                && url.host_str() == Some("checkout.stripe.com")
                && url.username().is_empty()
                && url.password().is_none()
                && url.port().is_none()
                && url.query().is_none()
                && url.path() == format!("/c/pay/{session}"),
            "hosted checkout invalid"
        );
        Ok(Self {
            operation_id: expected.operation,
            url: raw.into(),
            expires_at: receipt.expires_at,
            observed_at: now,
        })
    }
}

#[cfg(test)]
mod hosted_tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn hosted_destination_is_current_session_bound_and_not_an_open_redirect() {
        let op = Uuid::new_v4();
        let now = Utc::now();
        let expected = ExpectedSession {
            operation: op,
            customer: "cus_hosted",
            price: "price_hosted",
            currency: "usd",
            amount_minor: 2500,
            live: false,
        };
        let raw = json!({"object":"checkout.session","id":"cs_test_hosted","mode":"subscription","livemode":false,"customer":"cus_hosted","client_reference_id":op,"metadata":{"atoaxis_checkout_operation":op},"status":"open","payment_status":"unpaid","currency":"usd","amount_subtotal":2500,"expires_at":(now+chrono::Duration::hours(1)).timestamp(),"subscription":null,"line_items":{"has_more":false,"data":[{"quantity":1,"price":{"id":"price_hosted","currency":"usd","unit_amount":2500}}]},"url":"https://checkout.stripe.com/c/pay/cs_test_hosted#opaque"});
        assert!(HostedCheckout::parse(&raw, &expected, "cs_test_hosted", now).is_ok());
        for url in [
            "http://checkout.stripe.com/c/pay/cs_test_hosted",
            "https://checkout.stripe.com.evil.test/c/pay/cs_test_hosted",
            "https://checkout.stripe.com@evil.test/c/pay/cs_test_hosted",
            "https://checkout.stripe.com:443/c/pay/cs_test_hosted",
            "https://checkout.stripe.com/c/pay/cs_test_other",
            "https://checkout.stripe.com/c/pay/cs_test_hosted?redirect=evil",
            "https://checkout.stripe.com/c/pay/../pay/cs_test_hosted",
            "https://checkout.stripe.com/c/pay/cs_test_hosted\n",
        ] {
            let mut bad = raw.clone();
            bad["url"] = json!(url);
            assert!(HostedCheckout::parse(&bad, &expected, "cs_test_hosted", now).is_err());
        }
        let mut closed = raw.clone();
        closed["status"] = json!("complete");
        assert!(HostedCheckout::parse(&closed, &expected, "cs_test_hosted", now).is_err());
        let mut expired = raw;
        expired["expires_at"] = json!(now.timestamp());
        assert!(HostedCheckout::parse(&expired, &expected, "cs_test_hosted", now).is_err());
    }
}

//! Allowlisted settlement evidence, separate from subscription entitlement and AI cost.
use super::team_stripe::{id, Snapshot};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvoiceLine {
    pub id: String,
    pub amount_minor: Option<i64>,
    pub currency: String,
    pub price_id: Option<String>,
    pub subscription_id: Option<String>,
    pub subscription_item_id: Option<String>,
    pub quantity: Option<i64>,
    pub proration: Option<bool>,
    pub period_start: Option<DateTime<Utc>>,
    pub period_end: Option<DateTime<Utc>>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Invoice {
    pub invoice_id: String,
    pub customer_id: String,
    pub subscription_id: String,
    pub livemode: bool,
    pub status: Option<String>,
    pub currency: String,
    pub amount_due_minor: Option<i64>,
    pub amount_paid_minor: Option<i64>,
    pub amount_remaining_minor: Option<i64>,
    pub paid_at: Option<DateTime<Utc>>,
    pub finalized_at: Option<DateTime<Utc>>,
    pub due_at: Option<DateTime<Utc>>,
    pub billing_reason: Option<String>,
    pub lines: Vec<InvoiceLine>,
    pub lines_complete: bool,
    pub line_coverage_reason: Option<String>,
    pub observed_at: DateTime<Utc>,
}
fn identity(v: &Value, prefix: &str) -> Result<String> {
    let s = v
        .as_str()
        .or_else(|| v["id"].as_str())
        .context("invoice identity unavailable")?;
    ensure!(id(s, prefix), "invoice identity invalid");
    Ok(s.into())
}
fn optional_id(v: &Value, prefix: &str) -> Result<Option<String>> {
    if v.is_null() {
        Ok(None)
    } else {
        identity(v, prefix).map(Some)
    }
}
fn amount(v: &Value) -> Result<Option<i64>> {
    if v.is_null() {
        Ok(None)
    } else {
        v.as_i64().map(Some).context("invoice amount invalid")
    }
}
fn time(v: &Value) -> Result<Option<DateTime<Utc>>> {
    if v.is_null() {
        Ok(None)
    } else {
        DateTime::from_timestamp(v.as_i64().context("invoice time invalid")?, 0)
            .map(Some)
            .context("invoice time invalid")
    }
}
fn currency(v: &Value) -> Result<String> {
    let c = v.as_str().context("invoice currency unavailable")?;
    ensure!(
        c.len() == 3 && c.bytes().all(|b| b.is_ascii_lowercase()),
        "invoice currency invalid"
    );
    Ok(c.into())
}

pub fn invoice(
    v: &Value,
    snapshot: &Snapshot,
    livemode: bool,
    at: DateTime<Utc>,
) -> Result<Invoice> {
    ensure!(
        v["object"] == "invoice" && v["livemode"].as_bool() == Some(livemode),
        "invoice scope mismatch"
    );
    let invoice_id = identity(v, "in_")?;
    let customer = identity(&v["customer"], "cus_")?;
    let legacy = optional_id(&v["subscription"], "sub_")?;
    let parent = optional_id(&v["parent"]["subscription_details"]["subscription"], "sub_")?;
    ensure!(
        legacy
            .as_ref()
            .zip(parent.as_ref())
            .is_none_or(|(a, b)| a == b),
        "invoice subscription conflict"
    );
    let sub = parent
        .or(legacy)
        .context("invoice subscription unavailable")?;
    ensure!(
        snapshot.latest_invoice_id.as_deref() == Some(&invoice_id)
            && customer == snapshot.customer_id
            && sub == snapshot.subscription_id,
        "invoice scope mismatch"
    );
    let status = v["status"].as_str().map(String::from);
    ensure!(
        v["status"].is_null()
            || status.as_deref().is_some_and(|s| [
                "draft",
                "open",
                "paid",
                "void",
                "uncollectible"
            ]
            .contains(&s)),
        "invoice status unsupported"
    );
    let reason = v["billing_reason"].as_str().map(|r| {
        if [
            "manual",
            "quote_accept",
            "subscription",
            "subscription_create",
            "subscription_cycle",
            "subscription_update",
            "subscription_threshold",
            "upcoming",
        ]
        .contains(&r)
        {
            r.to_string()
        } else {
            "other".into()
        }
    });
    let data = v["lines"]["data"]
        .as_array()
        .context("invoice lines unavailable")?;
    ensure!(data.len() <= 1000, "invoice lines limit");
    let mut lines = Vec::new();
    let mut ids = std::collections::BTreeSet::new();
    for raw in data {
        let line = line_for_invoice(raw, livemode, &invoice_id)?;
        ensure!(
            ids.insert(line.id.clone()),
            "duplicate invoice line identity"
        );
        lines.push(line);
    }
    Ok(Invoice {
        invoice_id,
        customer_id: customer,
        subscription_id: sub,
        livemode,
        status,
        currency: currency(&v["currency"])?,
        amount_due_minor: amount(&v["amount_due"])?,
        amount_paid_minor: amount(&v["amount_paid"])?,
        amount_remaining_minor: amount(&v["amount_remaining"])?,
        paid_at: time(&v["status_transitions"]["paid_at"])?,
        finalized_at: time(&v["status_transitions"]["finalized_at"])?,
        due_at: time(&v["due_date"])?,
        billing_reason: reason,
        lines,
        lines_complete: v["lines"]["has_more"].as_bool() == Some(false),
        line_coverage_reason: if v["lines"]["has_more"].as_bool() == Some(false) {
            None
        } else {
            Some("pagination_unconfirmed".into())
        },
        observed_at: at,
    })
}
pub fn line_for_invoice(v: &Value, live: bool, invoice_id: &str) -> Result<InvoiceLine> {
    ensure!(
        optional_id(&v["invoice"], "in_")?
            .as_deref()
            .is_none_or(|id| id == invoice_id),
        "invoice line parent mismatch"
    );
    line(v, live)
}
pub fn line(v: &Value, live: bool) -> Result<InvoiceLine> {
    ensure!(
        v["object"] == "line_item" && v["livemode"].as_bool() == Some(live),
        "invoice line scope mismatch"
    );
    let parent = &v["parent"];
    let details = match parent["type"].as_str() {
        Some("subscription_item_details") => &parent["subscription_item_details"],
        Some("invoice_item_details") => &parent["invoice_item_details"],
        _ => &Value::Null,
    };
    let start = time(&v["period"]["start"])?;
    let end = time(&v["period"]["end"])?;
    ensure!(
        start.zip(end).is_none_or(|(a, b)| a <= b),
        "invoice service period invalid"
    );
    let qty = amount(&v["quantity"])?;
    ensure!(qty.is_none_or(|q| q >= 0), "invoice quantity invalid");
    Ok(InvoiceLine {
        id: identity(v, "il_")?,
        amount_minor: amount(&v["amount"])?,
        currency: currency(&v["currency"])?,
        price_id: optional_id(&v["pricing"]["price_details"]["price"], "price_")?,
        subscription_id: optional_id(&details["subscription"], "sub_")?,
        subscription_item_id: optional_id(&details["subscription_item"], "si_")?,
        quantity: qty,
        proration: details["proration"].as_bool(),
        period_start: start,
        period_end: end,
    })
}
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Settlement {
    Settled,
    Unpaid,
    Unconfirmed,
}
impl Invoice {
    /// A settled invoice is evidence of invoice settlement, not a paid package grant.
    pub fn settlement(&self) -> Settlement {
        match self.status.as_deref() {
            Some("paid")
                if self.amount_remaining_minor == Some(0)
                    && self.paid_at.is_some_and(|at| at <= self.observed_at)
                    && self
                        .amount_due_minor
                        .zip(self.amount_paid_minor)
                        .is_some_and(|(due, paid)| due >= 0 && paid >= due) =>
            {
                Settlement::Settled
            }
            Some("open" | "draft" | "void" | "uncollectible") => Settlement::Unpaid,
            _ => Settlement::Unconfirmed,
        }
    }
    /// No guessed invoice-level period. Unknown/partial lines cannot establish service coverage.
    pub fn covered_until(&self, snapshot: &Snapshot, at: DateTime<Utc>) -> Option<DateTime<Utc>> {
        if self.settlement() != Settlement::Settled
            || !self.lines_complete
            || !snapshot.items_complete
            || self.customer_id != snapshot.customer_id
            || self.subscription_id != snapshot.subscription_id
            || snapshot.period_start.is_none_or(|start| start > at)
            || snapshot.latest_invoice_id.as_deref() != Some(&self.invoice_id)
            || snapshot.currency.as_deref() != Some(&self.currency)
        {
            return None;
        }
        if self.lines.iter().any(|line| {
            line.subscription_item_id == snapshot.subscription_item_id
                && line.price_id == snapshot.price_id
                && line.amount_minor.is_some_and(|a| a < 0)
                && line.period_start.is_some_and(|s| s <= at)
                && line.period_end.is_some_and(|e| e > at)
        }) {
            return None;
        }
        self.lines
            .iter()
            .filter(|line| {
                line.subscription_id.as_deref() == Some(&snapshot.subscription_id)
                    && line.subscription_item_id.is_some()
                    && line.subscription_item_id == snapshot.subscription_item_id
                    && line.price_id.is_some()
                    && line.price_id == snapshot.price_id
                    && line.currency == self.currency
                    && line.quantity.is_some()
                    && line.quantity == snapshot.quantity
                    && line.amount_minor.is_some_and(|a| a >= 0)
                    && line.proration.is_some()
                    && line.period_start.is_some_and(|s| s <= at)
            })
            .filter_map(|line| {
                line.period_end
                    .zip(snapshot.period_end)
                    .map(|(a, b)| a.min(b))
            })
            .filter(|end| *end > at)
            .max()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn fixture() -> (Snapshot, Value, DateTime<Utc>) {
        let at = DateTime::from_timestamp(200, 0).unwrap();
        let s=super::super::team_stripe::snapshot(&json!({"id":"sub_a","object":"subscription","customer":"cus_a","livemode":false,"status":"active","cancel_at_period_end":false,"latest_invoice":"in_a","items":{"has_more":false,"data":[{"id":"si_a","quantity":1,"current_period_start":100,"current_period_end":300,"price":{"id":"price_a","currency":"usd","unit_amount":100}}]}}),"sub_a","cus_a",false,at).unwrap();
        let v = json!({"id":"in_a","object":"invoice","customer":"cus_a","livemode":false,"parent":{"subscription_details":{"subscription":"sub_a"}},"status":"paid","currency":"usd","amount_due":100,"amount_paid":100,"amount_remaining":0,"status_transitions":{"paid_at":150},"period_start":1,"period_end":2,"description":"PRIVATE_FIXTURE","confirmation_secret":{"client_secret":"PRIVATE_FIXTURE"},"lines":{"has_more":false,"data":[{"id":"il_a","object":"line_item","livemode":false,"amount":100,"currency":"usd","quantity":1,"parent":{"type":"subscription_item_details","subscription_item_details":{"subscription":"sub_a","subscription_item":"si_a","proration":false}},"pricing":{"price_details":{"price":"price_a"}},"period":{"start":100,"end":300},"description":"PRIVATE_FIXTURE"}]}});
        (s, v, at)
    }
    #[test]
    fn service_coverage_comes_from_matching_line_not_invoice_period() {
        let (s, v, at) = fixture();
        let i = invoice(&v, &s, false, at).unwrap();
        assert_eq!(i.settlement(), Settlement::Settled);
        assert_eq!(i.covered_until(&s, at).unwrap().timestamp(), 300);
        assert!(!serde_json::to_string(&i)
            .unwrap()
            .contains("PRIVATE_FIXTURE"));
        let mut s = s;
        s.subscription_item_id = Some("si_other".into());
        assert!(i.covered_until(&s, at).is_none());
        s.subscription_item_id = Some("si_a".into());
        s.price_id = Some("price_other".into());
        assert!(i.covered_until(&s, at).is_none());
    }
    #[test]
    fn zero_invoices_are_not_unknown_and_partial_or_credited_lines_do_not_grant_coverage() {
        let (s, mut v, at) = fixture();
        v["amount_due"] = json!(0);
        v["amount_paid"] = json!(0);
        let i = invoice(&v, &s, false, at).unwrap();
        assert_eq!(i.settlement(), Settlement::Settled);
        v["amount_paid"] = Value::Null;
        assert_eq!(
            invoice(&v, &s, false, at).unwrap().settlement(),
            Settlement::Unconfirmed
        );
        v["amount_paid"] = json!(0);
        v["lines"]["has_more"] = json!(true);
        assert!(invoice(&v, &s, false, at)
            .unwrap()
            .covered_until(&s, at)
            .is_none());
        v["lines"]["has_more"] = json!(false);
        let mut credit = v["lines"]["data"][0].clone();
        credit["id"] = json!("il_credit");
        credit["amount"] = json!(-100);
        v["lines"]["data"].as_array_mut().unwrap().push(credit);
        assert!(invoice(&v, &s, false, at)
            .unwrap()
            .covered_until(&s, at)
            .is_none());
    }
    #[test]
    fn invoice_scope_currency_and_conflicting_subscription_evidence() {
        let (s, mut v, at) = fixture();
        v["customer"] = json!("cus_other");
        assert!(invoice(&v, &s, false, at).is_err());
        v["customer"] = json!("cus_a");
        assert!(invoice(&v, &s, true, at).is_err());
        v["subscription"] = json!("sub_other");
        assert!(invoice(&v, &s, false, at).is_err());
        v["subscription"] = Value::Null;
        v["status"] = json!("open");
        assert_eq!(
            invoice(&v, &s, false, at).unwrap().settlement(),
            Settlement::Unpaid
        );
        v["status"] = json!("paid");
        v["currency"] = json!("jpy");
        assert!(invoice(&v, &s, false, at)
            .unwrap()
            .covered_until(&s, at)
            .is_none());
    }
}

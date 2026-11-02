//! Package-change invoice policy, separate from full initial-package coverage.
//! All inputs are normalized metadata. A result never grants capacity/access or
//! proves HTTP correlation, Owner consent, canonical revisions or source history.
use super::{
    team_billing::PACKAGES,
    team_stripe::Snapshot,
    team_stripe_invoice::{self, Invoice, InvoiceLine, Settlement},
    team_stripe_payment::{AcceptedPackage, Assessment},
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use uuid::Uuid;

#[path = "team_stripe_change_preview.rs"]
pub mod preview;

/// Line identity differs between preview and final invoice. Preserve a counted
/// semantic multiset; merging line amounts or ignoring duplicates is unsafe.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProrationLine {
    pub price: String,
    pub item: String,
    pub currency: String,
    pub amount_minor: i64,
    pub quantity: i64,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InvoiceTotals {
    pub subtotal_minor: Option<i64>,
    pub total_minor: Option<i64>,
    pub due_minor: Option<i64>,
}
impl InvoiceTotals {
    fn parse(value: &Value) -> Result<Self> {
        fn amount(value: &Value, key: &str) -> Result<Option<i64>> {
            if value.get(key).is_none_or(Value::is_null) {
                return Ok(None);
            }
            value[key]
                .as_i64()
                .map(Some)
                .context("change_invoice_amount_invalid")
        }
        Ok(Self {
            subtotal_minor: amount(value, "subtotal")?,
            total_minor: amount(value, "total")?,
            due_minor: amount(value, "amount_due")?,
        })
    }
    fn complete(&self) -> bool {
        self.subtotal_minor.is_some()
            && self.total_minor.is_some()
            && self.due_minor.is_some_and(|due| due >= 0)
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChangeInvoice {
    pub invoice: Invoice,
    pub totals: InvoiceTotals,
}
impl ChangeInvoice {
    /// The caller must independently prove invoice_reference belongs to the
    /// original mutation. A current latest_invoice field is not that proof.
    pub fn parse(
        value: &Value,
        invoice_reference: &str,
        customer: &str,
        subscription: &str,
        live: bool,
        at: DateTime<Utc>,
    ) -> Result<Self> {
        Ok(Self {
            invoice: team_stripe_invoice::invoice_for_operation(
                value,
                invoice_reference,
                customer,
                subscription,
                live,
                at,
            )?,
            totals: InvoiceTotals::parse(value)?,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AcceptedUpgrade {
    pub operation: Uuid,
    pub scope: super::team_financial_source::Scope,
    pub customer: String,
    pub subscription: String,
    pub item: String,
    pub from_price: String,
    pub to_price: String,
    pub from_seats: i32,
    pub to_seats: i32,
    pub currency: String,
    pub to_amount_minor: i64,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub proration_at: DateTime<Utc>,
    pub accepted_at: DateTime<Utc>,
    pub accepted_totals: InvoiceTotals,
    pub accepted_lines: Vec<ProrationLine>,
}

/// Scoped metadata composition, not a source/Owner/payment authority. Private
/// fields prevent pairing an unrelated bare Assessment with a subscription.
#[derive(Debug, Clone, PartialEq)]
pub struct BaseCoverage {
    scope: super::team_financial_source::Scope,
    customer: String,
    subscription: String,
    item: String,
    price: String,
    currency: String,
    period_start: DateTime<Utc>,
    period_end: DateTime<Utc>,
    invoice_id: String,
    assessment: Assessment,
}
impl BaseCoverage {
    pub fn from_initial(
        scope: &super::team_financial_source::Scope,
        snapshot: &Snapshot,
        invoice: &Invoice,
        package: &AcceptedPackage,
        now: DateTime<Utc>,
    ) -> Result<Self> {
        scope.key()?;
        let assessment =
            super::team_stripe_payment::assess(snapshot, Some(invoice), Some(package), now);
        ensure!(
            assessment.state == "settled"
                && assessment.livemode == Some(scope.live)
                && assessment.accepted_terms_verified
                && snapshot.observed_at <= now
                && invoice.observed_at <= now,
            "original_package_coverage_unconfirmed"
        );
        Ok(Self {
            scope: scope.clone(),
            customer: snapshot.customer_id.clone(),
            subscription: snapshot.subscription_id.clone(),
            item: snapshot
                .subscription_item_id
                .clone()
                .context("original_package_item_unconfirmed")?,
            price: package.price.clone(),
            currency: package.currency.clone(),
            period_start: snapshot
                .period_start
                .context("original_package_period_unconfirmed")?,
            period_end: snapshot
                .period_end
                .context("original_package_period_unconfirmed")?,
            invoice_id: invoice.invoice_id.clone(),
            assessment,
        })
    }
    pub fn invoice_id(&self) -> &str {
        &self.invoice_id
    }
    fn matches(&self, request: &AcceptedUpgrade) -> bool {
        self.scope == request.scope
            && self.customer == request.customer
            && self.subscription == request.subscription
            && self.item == request.item
            && self.price == request.from_price
            && self.currency == request.currency
            && self.period_start == request.period_start
            && self.period_end == request.period_end
    }
}
impl AcceptedUpgrade {
    pub fn validate(&self) -> Result<()> {
        self.scope.key()?;
        let id = super::team_stripe::id;
        ensure!(
            !self.operation.is_nil()
                && id(&self.customer, "cus_")
                && id(&self.subscription, "sub_")
                && id(&self.item, "si_")
                && id(&self.from_price, "price_")
                && id(&self.to_price, "price_")
                && self.from_price != self.to_price
                && self.to_seats > self.from_seats
                && PACKAGES.iter().any(|n| i32::from(*n) == self.from_seats)
                && PACKAGES.iter().any(|n| i32::from(*n) == self.to_seats)
                && self.to_amount_minor >= 0
                && self.currency.len() == 3
                && self.currency.bytes().all(|b| b.is_ascii_lowercase())
                && self.period_start <= self.proration_at
                && self.proration_at <= self.accepted_at
                && self.accepted_at < self.period_end
                && self.proration_at.timestamp_subsec_nanos() == 0
                && self.accepted_totals.complete()
                && !self.accepted_lines.is_empty()
                && self.accepted_lines.len() <= 1000,
            "accepted_upgrade_contract_invalid"
        );
        for line in &self.accepted_lines {
            ensure!(
                line.item == self.item
                    && line.currency == self.currency
                    && line.quantity == 1
                    && line.start == self.proration_at
                    && line.end == self.period_end
                    && ((line.price == self.to_price && line.amount_minor >= 0)
                        || (line.price == self.from_price && line.amount_minor <= 0)),
                "accepted_upgrade_proration_scope_invalid"
            );
        }
        ensure!(
            self.accepted_lines
                .iter()
                .any(|line| line.price == self.to_price),
            "accepted_upgrade_new_price_line_missing"
        );
        // For this contract every invoice line belongs to the accepted change.
        // Taxes/discounts/balance can change total/due but not the line subtotal.
        let subtotal: i128 = self
            .accepted_lines
            .iter()
            .map(|line| i128::from(line.amount_minor))
            .sum();
        ensure!(
            Some(subtotal) == self.accepted_totals.subtotal_minor.map(i128::from),
            "accepted_upgrade_subtotal_mismatch"
        );
        Ok(())
    }
}
#[derive(Debug, Serialize, PartialEq)]
pub struct UpgradeAssessment {
    pub calculation_version: u8,
    pub state: &'static str,
    pub reason: &'static str,
    pub operation: Uuid,
    pub invoice_id: Option<String>,
    pub package_seats: Option<i32>,
    pub covered_until: Option<DateTime<Utc>>,
    pub observed_at: DateTime<Utc>,
    pub access_granted: bool,
    #[serde(skip)]
    coverage: Option<BaseCoverage>,
}
impl UpgradeAssessment {
    /// Available only after this module validated scoped base + exact settled
    /// change. It cannot be deserialized from an API response as a coverage proof.
    pub fn into_coverage(self) -> Option<BaseCoverage> {
        self.coverage
    }
}
fn ledger(lines: &[ProrationLine]) -> BTreeMap<ProrationLine, usize> {
    let mut values = BTreeMap::new();
    for line in lines {
        *values.entry(line.clone()).or_default() += 1;
    }
    values
}
fn normalize(lines: &[InvoiceLine], request: &AcceptedUpgrade) -> Option<Vec<ProrationLine>> {
    lines
        .iter()
        .map(|line| {
            if line.proration != Some(true)
                || line.subscription_id.as_deref() != Some(&request.subscription)
            {
                return None;
            }
            Some(ProrationLine {
                price: line.price_id.clone()?,
                item: line.subscription_item_id.clone()?,
                currency: line.currency.clone(),
                amount_minor: line.amount_minor?,
                quantity: line.quantity?,
                start: line.period_start?,
                end: line.period_end?,
            })
        })
        .collect()
}
/// Base coverage is the fresh original package proof captured at acceptance.
/// linked_invoice must come from durable original-operation correlation. The
/// repository still needs Owner/revision/source and settlement fences before
/// using an assessment in an atomic entitlement change.
pub fn assess_upgrade(
    request: &AcceptedUpgrade,
    base: &BaseCoverage,
    current: &Snapshot,
    linked_invoice: Option<&str>,
    invoice: Option<&ChangeInvoice>,
    now: DateTime<Utc>,
) -> UpgradeAssessment {
    let mut result = UpgradeAssessment {
        calculation_version: 1,
        state: "unconfirmed",
        reason: "accepted_upgrade_unconfirmed",
        operation: request.operation,
        invoice_id: None,
        package_seats: None,
        covered_until: None,
        observed_at: current.observed_at,
        access_granted: false,
        coverage: None,
    };
    if !base.matches(request) {
        result.reason = "original_package_scope_mismatch";
        return result;
    }
    let base = &base.assessment;
    let reason = if request.validate().is_err() {
        Some("accepted_upgrade_unconfirmed")
    } else if base.calculation_version != 1
        || base.state != "settled"
        || !base.accepted_terms_verified
        || base.livemode != Some(request.scope.live)
        || base.package_seats != Some(request.from_seats)
        || base.observed_at > request.accepted_at
        || base.valid_until <= request.accepted_at
        || base
            .covered_until
            .is_none_or(|end| end < request.period_end)
    {
        Some("original_package_coverage_unconfirmed")
    } else if now >= request.period_end {
        Some("upgrade_coverage_expired")
    } else if current.observed_at > now || now - current.observed_at >= Duration::minutes(5) {
        Some("subscription_observation_stale")
    } else if !current.items_complete
        || current.status != "active"
        || current.customer_id != request.customer
        || current.subscription_id != request.subscription
        || current.subscription_item_id.as_deref() != Some(&request.item)
        || current.price_id.as_deref() != Some(&request.to_price)
        || current.currency.as_deref() != Some(&request.currency)
        || current.amount_minor != Some(request.to_amount_minor)
        || current.quantity != Some(1)
        || current.period_start != Some(request.period_start)
        || current.period_end != Some(request.period_end)
    {
        Some("target_subscription_unconfirmed")
    } else {
        None
    };
    if let Some(reason) = reason {
        result.reason = reason;
        return result;
    }
    let Some(invoice) = invoice else {
        result.reason = "change_invoice_unavailable";
        return result;
    };
    let i = &invoice.invoice;
    result.observed_at = i.observed_at.min(current.observed_at);
    if linked_invoice != Some(i.invoice_id.as_str())
        || i.customer_id != request.customer
        || i.subscription_id != request.subscription
        || i.livemode != request.scope.live
    {
        result.reason = "original_change_invoice_unconfirmed";
        return result;
    }
    result.invoice_id = Some(i.invoice_id.clone());
    if i.observed_at < request.accepted_at
        || i.observed_at > now
        || now - i.observed_at >= Duration::minutes(5)
    {
        result.reason = "change_invoice_observation_stale";
        return result;
    }
    if i.currency != request.currency
        || i.billing_reason.as_deref() != Some("subscription_update")
        || !i.lines_complete
        || !invoice.totals.complete()
        || invoice.totals != request.accepted_totals
        || i.amount_due_minor != invoice.totals.due_minor
        || normalize(&i.lines, request)
            .is_none_or(|actual| ledger(&actual) != ledger(&request.accepted_lines))
    {
        result.reason = "accepted_proration_mismatch";
        return result;
    }
    // Stripe's paid_at has whole-second precision. Preserve both facts and
    // compare at their common precision; identity comes from the original
    // operation's invoice pin, never from temporal proximity.
    if i.paid_at
        .is_none_or(|paid| paid.timestamp() < request.accepted_at.timestamp())
        || i.settlement() != Settlement::Settled
    {
        result.state = "payment_pending";
        result.reason = "change_invoice_not_settled";
        return result;
    }
    result.state = "settled";
    result.reason = "matching_accepted_proration_and_original_coverage";
    result.package_seats = Some(request.to_seats);
    result.covered_until = Some(request.period_end);
    result.coverage = Some(BaseCoverage {
        scope: request.scope.clone(),
        customer: request.customer.clone(),
        subscription: request.subscription.clone(),
        item: request.item.clone(),
        price: request.to_price.clone(),
        currency: request.currency.clone(),
        period_start: request.period_start,
        period_end: request.period_end,
        invoice_id: i.invoice_id.clone(),
        assessment: Assessment {
            calculation_version: 1,
            livemode: Some(request.scope.live),
            state: "settled".into(),
            reason: "matching_accepted_proration_and_original_coverage".into(),
            package_seats: Some(request.to_seats),
            covered_until: Some(request.period_end),
            observed_at: result.observed_at,
            valid_until: (result.observed_at + Duration::minutes(5)).min(request.period_end),
            access_granted: false,
            accepted_terms_verified: true,
        },
    });
    result
}

#[cfg(test)]
#[path = "team_stripe_change_payment_tests.rs"]
mod tests;

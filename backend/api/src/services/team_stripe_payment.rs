//! Current invoice coverage for accepted package terms, never a seat/access grant.
use super::{
    team_billing::PACKAGES,
    team_stripe::Snapshot,
    team_stripe_invoice::{Invoice, Settlement},
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

pub struct AcceptedPackage {
    pub seats: i32,
    pub price: String,
    pub currency: String,
    pub amount_minor: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Assessment {
    pub calculation_version: u8,
    pub livemode: Option<bool>,
    pub state: String,
    pub reason: String,
    pub package_seats: Option<i32>,
    pub covered_until: Option<DateTime<Utc>>,
    pub observed_at: DateTime<Utc>,
    pub valid_until: DateTime<Utc>,
    pub access_granted: bool,
    #[serde(default)]
    pub accepted_terms_verified: bool,
}
impl Assessment {
    fn unconfirmed(at: DateTime<Utc>, reason: &str) -> Self {
        Self {
            calculation_version: 1,
            livemode: None,
            state: "unconfirmed".into(),
            reason: reason.into(),
            package_seats: None,
            covered_until: None,
            observed_at: at,
            valid_until: at + Duration::minutes(5),
            access_granted: false,
            accepted_terms_verified: false,
        }
    }
    pub fn current(mut self, now: DateTime<Utc>, revisions_current: bool) -> Self {
        let reason = if self.calculation_version != 1 {
            Some("assessment_version_unsupported")
        } else if !revisions_current {
            Some("reconciliation_pending")
        } else if now < self.observed_at {
            Some("observation_in_future")
        } else if now >= self.valid_until {
            Some("observation_stale")
        } else if self.covered_until.is_some_and(|end| now >= end) {
            Some("coverage_expired")
        } else {
            None
        };
        if let Some(reason) = reason {
            self.state = "unconfirmed".into();
            self.reason = reason.into();
            self.package_seats = None;
            self.accepted_terms_verified = false;
            self.covered_until = None;
        }
        self.access_granted = false;
        self
    }
}
/// Inputs are independently read provider metadata and a server-accepted, scoped quote.
/// Subscription active / Checkout complete alone is insufficient, including async payments.
pub fn assess(
    s: &Snapshot,
    invoice: Option<&Invoice>,
    package: Option<&AcceptedPackage>,
    now: DateTime<Utc>,
) -> Assessment {
    let at = invoice.map_or(s.observed_at, |i| i.observed_at.min(s.observed_at));
    let mut result = Assessment::unconfirmed(at, "accepted_package_unconfirmed");
    result.livemode = invoice.map(|i| i.livemode);
    if s.observed_at > now || invoice.is_some_and(|i| i.observed_at > now) {
        result.reason = "observation_in_future".into();
        return result;
    }
    let Some(p) = package else {
        return result.current(now, true);
    };
    if !PACKAGES.iter().any(|n| i32::from(*n) == p.seats)
        || !s.items_complete
        || s.price_id.as_deref() != Some(&p.price)
        || s.currency.as_deref() != Some(&p.currency)
        || s.amount_minor != Some(p.amount_minor)
        || s.quantity != Some(1)
    {
        result.reason = "accepted_package_mismatch".into();
    } else {
        result.accepted_terms_verified = true;
        if s.status != "active" {
            result.reason = "subscription_not_active".into();
        } else if let Some(i) = invoice {
            result.reason = "invoice_coverage_unconfirmed".into();
            if i.settlement() == Settlement::Unpaid {
                result.state = "unpaid".into();
                result.reason = "invoice_not_settled".into();
            } else if let Some(end) = i.covered_until(s, now) {
                // A proration alone cannot establish payment for a full initial package.
                // Package changes need their own confirmed quote/allocation policy.
                let full_period = i.lines.iter().any(|l| {
                    l.proration == Some(false)
                        && l.subscription_id.as_deref() == Some(&s.subscription_id)
                        && l.subscription_item_id == s.subscription_item_id
                        && l.price_id.as_deref() == Some(&p.price)
                        && l.currency == p.currency
                        && l.quantity == Some(1)
                        && l.amount_minor.is_some_and(|a| a >= 0)
                        && l.period_start == s.period_start
                        && l.period_end.is_some_and(|e| e >= end)
                });
                if full_period {
                    result.state = "settled".into();
                    result.reason = "matching_invoice_coverage".into();
                    result.package_seats = Some(p.seats);
                    result.covered_until = Some(end);
                }
            }
        } else {
            result.reason = "invoice_unavailable".into();
        }
    }
    result.current(now, true)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;
    pub(crate) fn fixture(at: DateTime<Utc>) -> (Snapshot, Invoice, AcceptedPackage) {
        let start = (at - Duration::days(1)).timestamp();
        let end = (at + Duration::days(29)).timestamp();
        let s = crate::services::team_stripe::snapshot(&json!({"id":"sub_payment","object":"subscription","customer":"cus_payment","livemode":false,"status":"active","cancel_at_period_end":false,"latest_invoice":"in_payment","items":{"has_more":false,"data":[{"id":"si_payment","quantity":1,"current_period_start":start,"current_period_end":end,"price":{"id":"price_payment","currency":"usd","unit_amount":100}}]}}), "sub_payment", "cus_payment", false, at).unwrap();
        let i = crate::services::team_stripe_invoice::invoice(&json!({"id":"in_payment","object":"invoice","customer":"cus_payment","livemode":false,"parent":{"subscription_details":{"subscription":"sub_payment"}},"status":"paid","currency":"usd","amount_due":100,"amount_paid":100,"amount_remaining":0,"status_transitions":{"paid_at":start},"lines":{"has_more":false,"data":[{"id":"il_payment","object":"line_item","livemode":false,"amount":100,"currency":"usd","quantity":1,"parent":{"type":"subscription_item_details","subscription_item_details":{"subscription":"sub_payment","subscription_item":"si_payment","proration":false}},"pricing":{"price_details":{"price":"price_payment"}},"period":{"start":start,"end":end}}]}}), &s, false, at).unwrap();
        (
            s,
            i,
            AcceptedPackage {
                seats: 10,
                price: "price_payment".into(),
                currency: "usd".into(),
                amount_minor: 100,
            },
        )
    }
    #[test]
    fn active_or_checkout_identity_never_substitutes_for_invoice_and_accepted_terms() {
        let at = Utc::now();
        let (mut s, mut i, mut p) = fixture(at);
        let a = assess(&s, Some(&i), Some(&p), at);
        assert_eq!(a.state, "settled");
        assert_eq!(a.package_seats, Some(10));
        assert!(!a.access_granted);
        assert_eq!(assess(&s, None, Some(&p), at).state, "unconfirmed");
        assert_eq!(assess(&s, Some(&i), None, at).state, "unconfirmed");
        p.amount_minor = 101;
        assert_eq!(
            assess(&s, Some(&i), Some(&p), at).reason,
            "accepted_package_mismatch"
        );
        p.amount_minor = 100;
        i.status = Some("open".into());
        assert_eq!(assess(&s, Some(&i), Some(&p), at).state, "unpaid");
        i.status = Some("paid".into());
        s.status = "trialing".into();
        assert_eq!(
            assess(&s, Some(&i), Some(&p), at).reason,
            "subscription_not_active"
        );
    }
    #[test]
    fn freshness_pending_credit_partial_and_proration_cannot_look_paid() {
        let at = Utc::now();
        let (s, mut i, p) = fixture(at);
        let a = assess(&s, Some(&i), Some(&p), at);
        for (now, current) in [
            (at + Duration::minutes(5), true),
            (at - Duration::seconds(1), true),
            (at, false),
        ] {
            let a = a.clone().current(now, current);
            assert_eq!(a.state, "unconfirmed");
            assert_eq!(a.package_seats, None);
        }
        i.lines[0].proration = Some(true);
        assert_eq!(assess(&s, Some(&i), Some(&p), at).state, "unconfirmed");
        i.lines[0].proration = Some(false);
        i.lines_complete = false;
        assert_eq!(assess(&s, Some(&i), Some(&p), at).state, "unconfirmed");
        i.lines_complete = true;
        i.lines[0].amount_minor = Some(-100);
        assert_eq!(assess(&s, Some(&i), Some(&p), at).state, "unconfirmed");
    }
    #[test]
    fn grace_term_proof_rejects_missing_changed_or_incomplete_packages() {
        let at = Utc::now();
        let (mut s, _, p) = fixture(at);
        s.status = "past_due".into();
        let proof = assess(&s, None, Some(&p), at);
        assert!(proof.accepted_terms_verified);
        assert_eq!(proof.state, "unconfirmed");
        assert!(
            !proof
                .current(at + Duration::minutes(5), true)
                .accepted_terms_verified
        );
        assert!(!assess(&s, None, None, at).accepted_terms_verified);
        s.price_id = Some("price_changed".into());
        assert!(!assess(&s, None, Some(&p), at).accepted_terms_verified);
        s.price_id = Some(p.price.clone());
        s.quantity = Some(2);
        assert!(!assess(&s, None, Some(&p), at).accepted_terms_verified);
        s.quantity = Some(1);
        s.items_complete = false;
        assert!(!assess(&s, None, Some(&p), at).accepted_terms_verified);
    }
    #[test]
    fn incompatible_terms_and_subscription_states_remain_unconfirmed() {
        let at = Utc::now();
        let (s, i, p) = fixture(at);
        for status in [
            "trialing",
            "past_due",
            "unpaid",
            "canceled",
            "incomplete",
            "incomplete_expired",
            "paused",
        ] {
            let mut changed = s.clone();
            changed.status = status.into();
            assert_eq!(
                assess(&changed, Some(&i), Some(&p), at).state,
                "unconfirmed"
            );
        }
        for field in 0..5 {
            let mut changed = s.clone();
            match field {
                0 => changed.currency = Some("eur".into()),
                1 => changed.quantity = Some(2),
                2 => changed.items_complete = false,
                3 => changed.price_id = Some("price_other".into()),
                _ => changed.amount_minor = None,
            }
            assert_eq!(
                assess(&changed, Some(&i), Some(&p), at).reason,
                "accepted_package_mismatch"
            );
        }
        let mut future = s.clone();
        future.observed_at = at + Duration::seconds(1);
        assert_eq!(
            assess(&future, Some(&i), Some(&p), at).reason,
            "observation_in_future"
        );
        let mut unknown = assess(&s, Some(&i), Some(&p), at);
        unknown.calculation_version = 2;
        assert_eq!(
            unknown.current(at, true).reason,
            "assessment_version_unsupported"
        );
    }
    #[test]
    fn zero_settlement_is_evidence_not_cash_and_unknown_amount_never_zero() {
        let at = Utc::now();
        let (s, mut i, p) = fixture(at);
        i.amount_due_minor = Some(0);
        i.amount_paid_minor = Some(0);
        let a = assess(&s, Some(&i), Some(&p), at);
        assert_eq!(a.state, "settled");
        assert!(!a.access_granted);
        i.amount_paid_minor = None;
        assert_eq!(assess(&s, Some(&i), Some(&p), at).state, "unconfirmed");
        i.amount_paid_minor = Some(0);
        i.paid_at = Some(at + Duration::seconds(1));
        assert_eq!(assess(&s, Some(&i), Some(&p), at).state, "unconfirmed");
    }
}

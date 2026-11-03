//! Metadata policy regressions only; these fixtures mint no provider/source proof.
use super::*;
use serde_json::json;

#[test]
fn upgrade_rejects_base_metadata_from_a_different_financial_scope() {
    let (request, base, current, invoice, now) = fixture();
    for change in ["account", "organization"] {
        let mut different = base.clone();
        if change == "account" {
            different.scope.account = "acct_other".into();
        } else {
            different.scope.organization = Uuid::now_v7();
        }
        let result = assess_upgrade(
            &request,
            &different,
            &current,
            Some("in_upgrade"),
            Some(&invoice),
            now,
        );
        assert_eq!(result.reason, "original_package_scope_mismatch");
        assert!(!result.access_granted);
    }
}

#[test]
fn upgrade_rejects_settled_base_from_another_subscription_despite_identical_seats_and_period() {
    let (request, _, current, invoice, now) = fixture();
    let at = request.proration_at;
    let (mut other_snapshot, mut other_invoice, package) =
        super::super::team_stripe_payment::tests::fixture(at);
    other_snapshot.customer_id = "cus_other".into();
    other_snapshot.subscription_id = "sub_other".into();
    other_invoice.customer_id = "cus_other".into();
    other_invoice.subscription_id = "sub_other".into();
    for line in &mut other_invoice.lines {
        line.subscription_id = Some("sub_other".into());
    }
    let other = BaseCoverage::from_initial(
        &request.scope,
        &other_snapshot,
        &other_invoice,
        &package,
        at,
    )
    .unwrap();
    assert_eq!(other.assessment.package_seats, Some(request.from_seats));
    assert_eq!(other.assessment.covered_until, Some(request.period_end));
    let result = assess_upgrade(
        &request,
        &other,
        &current,
        Some("in_upgrade"),
        Some(&invoice),
        now,
    );
    assert_eq!(result.reason, "original_package_scope_mismatch");
    assert_eq!(result.package_seats, None);
}

#[test]
fn upgrade_paid_at_uses_provider_second_precision_without_rewriting_the_original_times() {
    let (mut request, base, current, mut invoice, now) = fixture();
    request.accepted_at += Duration::microseconds(123456);
    invoice.invoice.paid_at = DateTime::from_timestamp(request.accepted_at.timestamp(), 0);
    let retained = invoice.invoice.paid_at;
    let result = assess_upgrade(
        &request,
        &base,
        &current,
        Some("in_upgrade"),
        Some(&invoice),
        now,
    );
    assert_eq!(result.state, "settled");
    assert_eq!(invoice.invoice.paid_at, retained);
    let coverage = result.into_coverage().unwrap();
    assert_eq!(coverage.invoice_id(), "in_upgrade");
    assert_eq!(coverage.price, request.to_price);
    assert_eq!(coverage.assessment.package_seats, Some(25));
    invoice.invoice.paid_at = retained.map(|paid| paid - Duration::seconds(1));
    assert_ne!(
        assess_upgrade(
            &request,
            &base,
            &current,
            Some("in_upgrade"),
            Some(&invoice),
            now
        )
        .state,
        "settled"
    );
}

fn fixture() -> (
    AcceptedUpgrade,
    BaseCoverage,
    Snapshot,
    ChangeInvoice,
    DateTime<Utc>,
) {
    let at = DateTime::from_timestamp(Utc::now().timestamp(), 0).unwrap();
    let (before, old_invoice, package) = super::super::team_stripe_payment::tests::fixture(at);
    let scope = super::super::team_financial_source::Scope {
        organization: Uuid::now_v7(),
        account: "acct_change_policy".into(),
        live: false,
    };
    let base = BaseCoverage::from_initial(&scope, &before, &old_invoice, &package, at).unwrap();
    assert_eq!(base.assessment.state, "settled");
    let mut current = before.clone();
    current.price_id = Some("price_upgrade".into());
    current.amount_minor = Some(250);
    current.observed_at = at + Duration::seconds(3);
    current.latest_invoice_id = Some("in_later_unrelated".into());
    let lines = vec![
        ProrationLine {
            price: package.price.clone(),
            item: before.subscription_item_id.clone().unwrap(),
            currency: "usd".into(),
            amount_minor: -50,
            quantity: 1,
            start: at,
            end: before.period_end.unwrap(),
        },
        ProrationLine {
            price: "price_upgrade".into(),
            item: before.subscription_item_id.clone().unwrap(),
            currency: "usd".into(),
            amount_minor: 125,
            quantity: 1,
            start: at,
            end: before.period_end.unwrap(),
        },
    ];
    let request = AcceptedUpgrade {
        operation: Uuid::now_v7(),
        scope,
        customer: before.customer_id.clone(),
        subscription: before.subscription_id.clone(),
        item: before.subscription_item_id.clone().unwrap(),
        from_price: package.price,
        to_price: "price_upgrade".into(),
        from_seats: 10,
        to_seats: 25,
        currency: "usd".into(),
        to_amount_minor: 250,
        period_start: before.period_start.unwrap(),
        period_end: before.period_end.unwrap(),
        proration_at: at,
        accepted_at: at + Duration::seconds(1),
        accepted_totals: InvoiceTotals {
            subtotal_minor: Some(75),
            total_minor: Some(90),
            due_minor: Some(90),
        },
        accepted_lines: lines.clone(),
    };
    let mut invoice = old_invoice;
    invoice.invoice_id = "in_upgrade".into();
    invoice.billing_reason = Some("subscription_update".into());
    invoice.amount_due_minor = Some(90);
    invoice.amount_paid_minor = Some(90);
    invoice.amount_remaining_minor = Some(0);
    invoice.paid_at = Some(at + Duration::seconds(2));
    invoice.observed_at = current.observed_at;
    invoice.lines = lines
        .iter()
        .enumerate()
        .map(|(n, line)| InvoiceLine {
            id: format!("il_change{n}"),
            amount_minor: Some(line.amount_minor),
            currency: line.currency.clone(),
            price_id: Some(line.price.clone()),
            subscription_id: Some(request.subscription.clone()),
            subscription_item_id: Some(line.item.clone()),
            quantity: Some(1),
            proration: Some(true),
            period_start: Some(line.start),
            period_end: Some(line.end),
        })
        .collect();
    (
        request.clone(),
        base,
        current,
        ChangeInvoice {
            invoice,
            totals: request.accepted_totals,
        },
        at + Duration::seconds(4),
    )
}
#[test]
fn package_change_accepts_exact_proration_without_turning_it_into_initial_package_coverage() {
    let (request, base, current, invoice, now) = fixture();
    let result = assess_upgrade(
        &request,
        &base,
        &current,
        Some("in_upgrade"),
        Some(&invoice),
        now,
    );
    assert_eq!(result.state, "settled");
    assert_eq!(result.package_seats, Some(25));
    assert_eq!(result.covered_until, Some(request.period_end));
    assert!(!result.access_granted);
    // Keep the original full-package assessor strict: the historical change
    // invoice is not current full-period payment or a replacement Checkout.
    let initial = super::super::team_stripe_payment::assess(
        &current,
        Some(&invoice.invoice),
        Some(&super::super::team_stripe_payment::AcceptedPackage {
            seats: 25,
            price: request.to_price,
            currency: "usd".into(),
            amount_minor: 250,
        }),
        now,
    );
    assert_ne!(initial.state, "settled");
    assert!(!initial.access_granted);
}
#[test]
fn package_change_requires_original_invoice_full_ledger_and_settlement_not_an_active_subscription()
{
    let (request, base, current, invoice, now) = fixture();
    assert_eq!(
        assess_upgrade(&request, &base, &current, None, Some(&invoice), now).reason,
        "original_change_invoice_unconfirmed"
    );
    for change in [
        "paid",
        "amount",
        "line",
        "duplicate",
        "scope",
        "reason",
        "partial",
        "missing_total",
        "future",
        "stale",
    ] {
        let mut changed = invoice.clone();
        match change {
            "paid" => {
                changed.invoice.status = Some("open".into());
                changed.invoice.paid_at = None;
            }
            "amount" => changed.totals.due_minor = Some(91),
            "line" => changed.invoice.lines[0].amount_minor = Some(-51),
            "duplicate" => changed.invoice.lines.push(changed.invoice.lines[0].clone()),
            "scope" => changed.invoice.customer_id = "cus_other".into(),
            "reason" => changed.invoice.billing_reason = Some("subscription_cycle".into()),
            "partial" => changed.invoice.lines_complete = false,
            "missing_total" => changed.totals.total_minor = None,
            "future" => changed.invoice.observed_at = now + Duration::seconds(1),
            _ => changed.invoice.observed_at = now - Duration::minutes(6),
        }
        let result = assess_upgrade(
            &request,
            &base,
            &current,
            Some("in_upgrade"),
            Some(&changed),
            now,
        );
        assert_ne!(result.state, "settled", "{change}");
        assert_eq!(result.package_seats, None);
        assert!(!result.access_granted);
    }
}
#[test]
fn package_change_preserves_original_coverage_boundary_and_requires_fresh_accepted_base() {
    let (mut request, mut base, mut current, invoice, now) = fixture();
    current.price_id = Some(request.from_price.clone());
    assert_eq!(
        assess_upgrade(
            &request,
            &base,
            &current,
            Some("in_upgrade"),
            Some(&invoice),
            now
        )
        .reason,
        "target_subscription_unconfirmed"
    );
    current.price_id = Some(request.to_price.clone());
    base.assessment.covered_until = Some(request.period_end - Duration::seconds(1));
    assert_eq!(
        assess_upgrade(
            &request,
            &base,
            &current,
            Some("in_upgrade"),
            Some(&invoice),
            now
        )
        .reason,
        "original_package_coverage_unconfirmed"
    );
    base.assessment.covered_until = Some(request.period_end);
    base.assessment.valid_until = request.accepted_at;
    assert_ne!(
        assess_upgrade(
            &request,
            &base,
            &current,
            Some("in_upgrade"),
            Some(&invoice),
            now
        )
        .state,
        "settled"
    );
    request.accepted_lines[0].start -= Duration::seconds(1);
    assert!(request.validate().is_err());
}
#[test]
fn operation_invoice_parser_keeps_original_pin_instead_of_following_latest_and_drops_private_fields(
) {
    let (request, _, current, invoice, _) = fixture();
    let value = json!({"object":"invoice","id":"in_upgrade","customer":request.customer,"livemode":false,
        "parent":{"subscription_details":{"subscription":request.subscription}},"status":"paid","currency":"usd", "billing_reason":"subscription_update",
        "subtotal":75,"total":90,"amount_due":90,"amount_paid":90,"amount_remaining":0,"status_transitions":{"paid_at":request.accepted_at.timestamp()+1},
        "lines":{"has_more":false,"data":invoice.invoice.lines.iter().map(|line|json!({"object":"line_item","id":line.id,"livemode":false,"amount":line.amount_minor,"currency":line.currency,"quantity":1,
            "parent":{"type":"subscription_item_details","subscription_item_details":{"subscription":request.subscription,"subscription_item":request.item,"proration":true}},
            "pricing":{"price_details":{"price":line.price_id}},"period":{"start":request.proration_at.timestamp(),"end":request.period_end.timestamp()}})).collect::<Vec<_>>()},
        "customer_email":"PRIVATE_CHANGE_MARKER","metadata":{"prompt":"PRIVATE_CHANGE_MARKER"},"description":"PRIVATE_CHANGE_MARKER"});
    assert!(team_stripe_invoice::invoice(&value, &current, false, current.observed_at).is_err());
    let parsed = ChangeInvoice::parse(
        &value,
        "in_upgrade",
        &request.customer,
        &request.subscription,
        false,
        current.observed_at,
    )
    .unwrap();
    assert_eq!(parsed.totals, request.accepted_totals);
    assert!(!serde_json::to_string(&parsed)
        .unwrap()
        .contains("PRIVATE_CHANGE_MARKER"));
    assert!(ChangeInvoice::parse(
        &value,
        "in_wrong",
        &request.customer,
        &request.subscription,
        false,
        current.observed_at
    )
    .is_err());
    let mut unknown = value;
    unknown.as_object_mut().unwrap().remove("total");
    assert_eq!(
        ChangeInvoice::parse(
            &unknown,
            "in_upgrade",
            &request.customer,
            &request.subscription,
            false,
            current.observed_at
        )
        .unwrap()
        .totals
        .total_minor,
        None
    );
}

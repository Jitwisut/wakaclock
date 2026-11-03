//! Synthetic metadata contracts only. No provider/SQL/source authority or ACK.
use super::*;
use serde_json::json;

pub(crate) fn fixture() -> (PreviewRequest, Value, DateTime<Utc>) {
    let at = DateTime::from_timestamp(Utc::now().timestamp(), 0).unwrap();
    let start = at - Duration::days(5);
    let end = at + Duration::days(25);
    let request = PreviewRequest {
        schema: 1,
        quote_id: Uuid::now_v7(),
        scope: Scope {
            organization: Uuid::now_v7(),
            account: "acct_preview".into(),
            live: false,
        },
        actor: Uuid::now_v7(),
        customer: "cus_preview".into(),
        subscription: "sub_preview".into(),
        item: "si_preview".into(),
        from_price: "price_old".into(),
        to_price: "price_new".into(),
        from_seats: 10,
        to_seats: 25,
        currency: "usd".into(),
        to_amount_minor: 250,
        binding_revision: 2,
        source_revision: 9,
        catalog_revision: 1,
        catalog_sha256: "a".repeat(64),
        period_start: start,
        period_end: end,
        proration_at: at,
        requested_at: at,
        expires_at: at + Duration::minutes(10),
    };
    let line = |id: &str, price: &str, amount: i64| {
        json!({"id":id,"object":"line_item","invoice":"upcoming_in_preview","livemode":false,
        "currency":"usd","amount":amount,"quantity":1,"parent":{"type":"subscription_item_details","subscription_item_details":{"subscription":"sub_preview","subscription_item":"si_preview","proration":true}},
        "pricing":{"price_details":{"price":price}},"period":{"start":at.timestamp(),"end":end.timestamp()}})
    };
    let value = json!({"id":"upcoming_in_preview","object":"invoice","livemode":false,"customer":"cus_preview","currency":"usd",
        "parent":{"subscription_details":{"subscription":"sub_preview"}},"subtotal":75,"total":90,"amount_due":90,
        "lines":{"data":[line("il_credit","price_old",-50),line("il_debit","price_new",125)],"has_more":false},
        "description":"PRIVATE_PREVIEW_MARKER","metadata":{"source":"PRIVATE_PREVIEW_MARKER"},"customer_email":"PRIVATE_PREVIEW_MARKER"});
    (request, value, at + Duration::seconds(1))
}
#[test]
fn preview_body_and_original_update_keep_the_same_proration_instant_and_quantity() {
    let (request, value, at) = fixture();
    let original_hash = request.metadata_hash().unwrap();
    let body: BTreeMap<_, _> = request.provider_body().unwrap().into_iter().collect();
    assert_eq!(body["subscription_details[items][0][quantity]"], "1");
    assert_eq!(
        body["subscription_details[proration_behavior]"],
        "always_invoice"
    );
    let preview = UpgradePreview::parse(request.clone(), &value, at).unwrap();
    let operation = Uuid::now_v7();
    let accepted = preview
        .proposed_upgrade(operation, at + Duration::seconds(1))
        .unwrap();
    let update: BTreeMap<_, _> = accepted.provider_body().unwrap().into_iter().collect();
    assert_eq!(
        update["proration_date"],
        body["subscription_details[proration_date]"]
    );
    assert_eq!(update["items[0][id]"], request.item);
    assert_eq!(update["items[0][price]"], request.to_price);
    assert_eq!(update["payment_behavior"], "pending_if_incomplete");
    assert_eq!(accepted.accepted_totals.due_minor, Some(90));
    let roundtrip: AcceptedUpgrade =
        serde_json::from_slice(&serde_json::to_vec(&accepted).unwrap()).unwrap();
    assert_eq!(
        accepted.request_hash().unwrap(),
        roundtrip.request_hash().unwrap()
    );
    assert_eq!(
        accepted.idempotency_key().unwrap(),
        roundtrip.idempotency_key().unwrap()
    );
    assert_ne!(
        accepted.idempotency_key().unwrap(),
        request.idempotency_key().unwrap()
    );
    assert_eq!(request.metadata_hash().unwrap(), original_hash);
    assert!(!serde_json::to_string(&preview)
        .unwrap()
        .contains("PRIVATE_PREVIEW_MARKER"));
}
#[test]
fn incomplete_preview_records_unknown_and_partial_metadata_but_never_accepts_it_as_zero() {
    let (request, value, at) = fixture();
    for change in ["total", "due", "amount", "partial", "kind", "scope"] {
        let mut raw = value.clone();
        match change {
            "total" => {
                raw.as_object_mut().unwrap().remove("total");
            }
            "due" => {
                raw.as_object_mut().unwrap().remove("amount_due");
            }
            "amount" => raw["lines"]["data"][0]["amount"] = Value::Null,
            "partial" => raw["lines"]["has_more"] = json!(true),
            "kind" => {
                raw["lines"]["data"][0]["parent"]["subscription_item_details"]["proration"] =
                    Value::Null
            }
            _ => {
                raw["lines"]["data"][0]["parent"]["subscription_item_details"]["subscription"] =
                    json!("sub_other")
            }
        }
        let preview = UpgradePreview::parse(request.clone(), &raw, at).unwrap();
        if change == "total" {
            assert_eq!(preview.totals.total_minor, None);
        }
        assert!(
            preview.proposed_upgrade(Uuid::now_v7(), at).is_err(),
            "{change}"
        );
    }
}
#[test]
fn preview_rejects_conflicting_identity_duplicate_lines_and_original_quote_nonce_reuse() {
    let (request, value, at) = fixture();
    for change in [
        "customer",
        "mode",
        "sub",
        "parent",
        "duplicate",
        "parent_invoice",
    ] {
        let mut raw = value.clone();
        match change {
            "customer" => raw["customer"] = json!("cus_other"),
            "mode" => raw["livemode"] = json!(true),
            "sub" => raw["parent"]["subscription_details"]["subscription"] = json!("sub_other"),
            "parent" => raw["subscription"] = json!("sub_other"),
            "duplicate" => raw["lines"]["data"][1] = raw["lines"]["data"][0].clone(),
            _ => raw["lines"]["data"][0]["invoice"] = json!("upcoming_in_other"),
        }
        assert!(
            UpgradePreview::parse(request.clone(), &raw, at).is_err(),
            "{change}"
        );
    }
    let preview = UpgradePreview::parse(request.clone(), &value, at).unwrap();
    assert!(preview.proposed_upgrade(request.quote_id, at).is_err());
    assert!(preview
        .proposed_upgrade(Uuid::now_v7(), request.expires_at)
        .is_err());
    let early = UpgradePreview::parse(
        request.clone(),
        &value,
        request.requested_at - Duration::seconds(1),
    )
    .unwrap();
    assert!(early.proposed_upgrade(Uuid::now_v7(), at).is_err());
    let mut other = request;
    other.scope.account = "acct_other".into();
    assert_ne!(
        other.idempotency_key().unwrap(),
        preview.request.idempotency_key().unwrap()
    );
}

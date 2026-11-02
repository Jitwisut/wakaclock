//! Model regression only. These fixtures do not prove SQL, HTTP or durability.
use super::*;

fn fixture() -> (FrozenCancellation, Exchange) {
    let (request, _) = super::super::tests::fixture();
    let exchange = Exchange {
        id: Uuid::now_v7(),
        actor: request.actor(),
        revision: 1,
        lease: Uuid::now_v7(),
        account_lease: Uuid::now_v7(),
        kind: ExchangeKind::Mutation,
        prepared_at: request.accepted_at(),
        first_attempt_at: Some(request.accepted_at()),
        previous_observation: None,
        authorization_hash: authorization_hash(
            &request,
            1,
            request.actor(),
            request.accepted_at(),
            "request_cancel_at_period_end",
        )
        .unwrap(),
    };
    (request, exchange)
}
#[test]
fn cancellation_prepared_exchange_is_not_send_evidence_and_does_not_renew_mutation_window() {
    let (request, exchange) = fixture();
    exchange.validate(&request, 1).unwrap();
    let hash = exchange.metadata_hash(&request).unwrap();
    let wire = serde_json::to_value(&exchange).unwrap();
    assert!(wire.get("previous_observation").is_none());
    assert_eq!(
        serde_json::from_value::<Exchange>(wire.clone()).unwrap(),
        exchange
    );
    let mut causal = exchange.clone();
    causal.previous_observation = Some(Uuid::now_v7());
    assert_ne!(causal.metadata_hash(&request).unwrap(), hash);
    causal.previous_observation = Some(Uuid::nil());
    assert!(causal.validate(&request, 1).is_err());
    assert!(wire.get("sent_at").is_none());
    assert!(wire.get("dispatched").is_none());
    let mut changed = exchange.clone();
    changed.prepared_at += Duration::hours(23);
    assert!(changed.validate(&request, 1).is_err());
    changed = exchange.clone();
    changed.first_attempt_at = None;
    assert!(changed.validate(&request, 1).is_err());
    changed = exchange.clone();
    changed.actor = Uuid::now_v7();
    assert!(changed.validate(&request, 1).is_err());
    changed = exchange.clone();
    changed.revision = 2;
    assert!(changed.validate(&request, 2).is_err());
    changed = exchange.clone();
    changed.account_lease = Uuid::nil();
    assert!(changed.validate(&request, 1).is_err());
    changed = exchange.clone();
    changed.prepared_at += Duration::nanoseconds(1);
    assert!(changed.validate(&request, 1).is_err());
    for field in ["id", "lease", "account_lease"] {
        let mut value = wire.clone();
        value[field] = serde_json::to_value(Uuid::now_v7()).unwrap();
        let next: Exchange = serde_json::from_value(value).unwrap();
        assert_ne!(next.metadata_hash(&request).unwrap(), hash);
    }
    assert_eq!(
        request.idempotency_key().unwrap(),
        request.clone().idempotency_key().unwrap()
    );
}
#[test]
fn cancellation_readback_and_new_owner_authorization_cannot_be_promoted_to_mutation() {
    let (request, mut read) = fixture();
    read.actor = Uuid::now_v7();
    read.revision = 3;
    read.kind = ExchangeKind::ResourceRead;
    read.prepared_at = request.period_end() + Duration::days(1);
    read.first_attempt_at = None; // A resource read cannot claim a first mutation.
    read.authorization_hash = authorization_hash(
        &request,
        3,
        read.actor,
        request.accepted_at(),
        "reconcile_existing_cancellation",
    )
    .unwrap();
    read.validate(&request, 3).unwrap();
    let mut mutation = read.clone();
    mutation.kind = ExchangeKind::Mutation;
    assert!(mutation.validate(&request, 3).is_err());
    assert!(authorization_hash(
        &request,
        1,
        read.actor,
        request.accepted_at(),
        "request_cancel_at_period_end"
    )
    .is_err());
    assert!(authorization_hash(
        &request,
        3,
        read.actor,
        request.accepted_at(),
        "request_cancel_at_period_end"
    )
    .is_err());
    let stage = CancellationStage::RecoveryAuthorization {
        actor: read.actor,
        authorized_at: request.accepted_at(),
        first_attempt_at: None,
    };
    stage.validate(&request, 2).unwrap();
    assert!(stage.validate(&request, i64::MAX).is_err());
    let mut wire = serde_json::to_value(&stage).unwrap();
    wire["read_only"] = Value::Bool(false);
    assert!(serde_json::from_value::<CancellationStage>(wire).is_err());
}

//! Synthetic metadata only; these tests do not constitute provider or SQL evidence.
use super::*;
use crate::infrastructure::team_financial_guard::{FinancialGuard, TestLedger};
use chrono::Duration;
use serde_json::json;

fn at() -> DateTime<Utc> {
    DateTime::from_timestamp(1793059200, 0).unwrap()
}
fn raw() -> Value {
    json!({"object":"subscription","id":"sub_cancel","customer":"cus_cancel","livemode":false,
        "status":"active","cancel_at_period_end":false,"cancel_at":null,"canceled_at":null,
        "ended_at":null,"schedule":null,"pending_update":null,"latest_invoice":null,"trial_end":null,
        "items":{"has_more":false,"data":[{"id":"si_cancel","quantity":1,
            "current_period_start":1792972800,"current_period_end":1795651200,
            "price":{"id":"price_cancel","currency":"usd","unit_amount":2500}}]},
        "description":"PRIVATE_FIXTURE_CONTENT","metadata":{"prompt":"PRIVATE_FIXTURE_CONTENT"},
        "cancellation_details":{"comment":"PRIVATE_FIXTURE_CONTENT"}})
}
pub(crate) fn fixture() -> (FrozenCancellation, Subscription) {
    let before = Subscription::parse(&raw(), false, at()).unwrap();
    let request = FrozenCancellation::new(
        source::Scope {
            organization: Uuid::now_v7(),
            account: "acct_cancel".into(),
            live: false,
        },
        Uuid::now_v7(),
        Uuid::now_v7(),
        1,
        1,
        &before,
        at(),
    )
    .unwrap();
    (request, before)
}
fn seed(request: &FrozenCancellation) -> source::Event {
    source::Event::Seed {
        scope: request.scope().clone(),
        head: source::Root::empty(request.scope()).unwrap(),
        review: source::Review {
            id: Uuid::now_v7(),
            kind: source::ReviewKind::ReviewedInventory,
            evidence_hash: "a".repeat(64),
            reviewed_at: at(),
        },
        accepted: vec![request.accepted_request().unwrap()],
    }
}
fn dispatch(request: &FrozenCancellation) -> source::Event {
    let accepted = request.accepted_request().unwrap();
    source::Event::Dispatch {
        scope: request.scope().clone(),
        dispatch: source::Dispatch {
            operation: request.operation(),
            request_hash: accepted.request_hash,
            idempotency_hash: accepted.idempotency_hash,
            first_attempt_at: at(),
        },
    }
}
fn attempt(request: &FrozenCancellation) -> Attempt {
    Attempt {
        actor: request.actor(),
        revision: 1,
        lease: Uuid::now_v7(),
        exchange: Uuid::now_v7(),
        source_claim: true,
    }
}

#[test]
fn cancellation_failures_keep_retry_after_across_restart_and_clock_anomalies_keep_evidence_frozen()
{
    use crate::services::team_stripe_checkout_receipt::{
        FailureCode, FailureDetail, FailurePhase, FailureResult,
    };
    let (request, metadata) = fixture();
    let f = TestLedger::new(&[request.scope().organization]);
    f.guard.record_source(seed(&request)).unwrap();
    let attempt = attempt(&request);
    let retry = Utc::now() + Duration::minutes(5);
    let detail = FailureDetail {
        phase: FailurePhase::CancellationRead,
        result: FailureResult::Provider {
            code: FailureCode::RateLimited,
        },
        http_status: Some(429),
        retry_after: Some(retry),
    };
    let id = f
        .guard
        .retain_cancellation_failure(&request, attempt.clone(), detail.clone())
        .unwrap();
    let retained = f.guard.read().unwrap();
    let sequence = retained.sequence;
    assert_eq!(
        retained.snapshot.sources.scopes[&request.scope().key().unwrap()]
            .outcomes
            .len(),
        0
    );
    let restarted = FinancialGuard::new(f.path().to_path_buf())
        .unwrap()
        .pin_namespace(f.guard.namespace().unwrap())
        .unwrap();
    assert_eq!(
        restarted
            .retain_cancellation_failure(&request, attempt.clone(), detail)
            .unwrap(),
        id
    );
    assert_eq!(restarted.read().unwrap().sequence, sequence);
    assert_eq!(
        restarted
            .checkout_retry_after(&request.scope().account, request.scope().live)
            .unwrap(),
        Some(retry)
    );
    assert!(restarted
        .checkout_cooldown("acct_other", false)
        .unwrap()
        .is_none());
    assert!(restarted
        .checkout_cooldown(&request.scope().account, true)
        .unwrap()
        .is_none());
    let mut clock = retained.snapshot.sources.scopes[&request.scope().key().unwrap()]
        .cancellation_failures[&id]
        .clone();
    clock.id = Uuid::now_v7();
    clock.observed_at = request.accepted_at() - Duration::seconds(1);
    restarted
        .record_source(source::Event::CancellationFailure {
            scope: request.scope().clone(),
            observation: clock,
        })
        .unwrap();
    let observation = restarted
        .retain_cancellation_observation(
            &request,
            attempt,
            ObservationKind::ResourceRead,
            &metadata,
            request.accepted_at() - Duration::seconds(1),
        )
        .unwrap();
    let current = restarted.read().unwrap();
    let entry = &current.snapshot.sources.scopes[&request.scope().key().unwrap()];
    assert!(entry
        .frozen
        .contains(&source::FreezeReason::ObservationTimeUnconfirmed));
    assert_eq!(entry.cancellation_failures.len(), 2);
    assert_eq!(entry.cancellation_observations.len(), 1);
    assert_eq!(
        entry.cancellation_observations[&observation].observed_at,
        request.accepted_at() - Duration::seconds(1)
    );
    assert!(current.source_token(request.scope()).is_ok()); // A token is not source readiness/authority.
    assert!(current
        .snapshot
        .sources
        .verify(request.scope(), entry.head.as_ref().unwrap())
        .is_err());
    assert!(!serde_json::to_string(entry)
        .unwrap()
        .contains("PRIVATE_FIXTURE_CONTENT"));
}
#[test]
fn cancellation_frozen_request_has_only_end_period_provider_effect_and_stable_scope() {
    let (request, before) = fixture();
    assert_eq!(
        request.provider_body().unwrap(),
        vec![("cancel_at_period_end", "true")]
    );
    let bytes = serde_json::to_vec(&request).unwrap();
    let replay: FrozenCancellation = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(
        request.idempotency_key().unwrap(),
        replay.idempotency_key().unwrap()
    );
    assert_eq!(
        request.accepted_request().unwrap(),
        replay.accepted_request().unwrap()
    );
    for field in [
        "schema_version",
        "operation",
        "original_actor",
        "binding_revision",
        "source_revision",
        "period_start",
        "period_end",
        "accepted_at",
        "customer",
        "subscription",
        "item",
        "price",
        "currency",
        "amount_minor",
    ] {
        let mut changed = serde_json::to_value(&request).unwrap();
        changed[field] = Value::Null;
        assert!(
            serde_json::from_value::<FrozenCancellation>(changed).is_err(),
            "{field}"
        );
    }
    let mut changed = request.clone();
    changed.original_actor = Uuid::now_v7();
    assert_ne!(
        changed.idempotency_key().unwrap(),
        request.idempotency_key().unwrap()
    );
    changed = request.clone();
    changed.scope.organization = Uuid::now_v7();
    assert_ne!(
        changed.request_hash().unwrap(),
        request.request_hash().unwrap()
    );
    changed = request.clone();
    changed.period_end += Duration::seconds(1);
    assert_ne!(
        changed.request_hash().unwrap(),
        request.request_hash().unwrap()
    );
    assert!(request
        .before_mutation(&before, at() - Duration::seconds(1))
        .is_err());
    assert!(request
        .before_mutation(&before, request.period_end())
        .is_err());
}
#[test]
fn cancellation_acceptance_precision_and_retry_never_change_original_business_terms() {
    let (request, before) = fixture();
    assert!(FrozenCancellation::new(
        request.scope().clone(),
        request.actor(),
        request.operation(),
        1,
        1,
        &before,
        request.accepted_at() + Duration::nanoseconds(1)
    )
    .is_err());
    let later = FrozenCancellation::new(
        request.scope().clone(),
        request.actor(),
        request.operation(),
        1,
        1,
        &before,
        request.accepted_at() + Duration::microseconds(1),
    )
    .unwrap();
    assert!(request.same_intent(&later));
    assert_ne!(
        request.accepted_request().unwrap(),
        later.accepted_request().unwrap()
    );
    let evidence = ReadEvidence {
        exchange: Uuid::now_v7(),
        observed_at: request.accepted_at(),
        valid_until: request.accepted_at() + Duration::seconds(60),
        subscription: before,
    };
    assert!(evidence.validate(&request).is_ok());
    let mut changed = evidence.clone();
    changed.valid_until += Duration::microseconds(1);
    assert!(changed.validate(&request).is_err());
    changed = evidence.clone();
    changed.observed_at = request.accepted_at() + Duration::microseconds(1);
    assert!(changed.validate(&request).is_err());
    changed = evidence.clone();
    changed.subscription.scheduled_or_pending_update = true;
    assert!(changed.validate(&request).is_err());
    changed = evidence;
    changed.exchange = Uuid::nil();
    assert!(changed.validate(&request).is_err());
    let mut foreign = later;
    foreign.subscription = "sub_other".into();
    assert!(!request.same_intent(&foreign));
}
#[test]
fn cancellation_selection_is_confirmation_of_canonical_terms_not_client_owned_provider_identity() {
    let (request, _) = fixture();
    let value = json!({"operation_id":request.operation(),"expected_binding_revision":1,
        "expected_source_revision":1,"expected_period_end":request.period_end(),"confirm":true});
    let input: CancellationSelection = serde_json::from_value(value.clone()).unwrap();
    input.validate().unwrap();
    for field in [
        "actor",
        "user_id",
        "customer",
        "subscription",
        "account_id",
        "livemode",
        "price",
        "scope",
        "raw_response",
    ] {
        let mut changed = value.clone();
        changed[field] = json!("PRIVATE_CANCELLATION_INPUT");
        assert!(serde_json::from_value::<CancellationSelection>(changed).is_err());
    }
    for (field, bad) in [
        ("confirm", json!(false)),
        ("operation_id", json!(Uuid::nil())),
        ("expected_binding_revision", json!(0)),
        ("expected_source_revision", json!(-1)),
    ] {
        let mut changed = value.clone();
        changed[field] = bad;
        assert!(serde_json::from_value::<CancellationSelection>(changed)
            .unwrap()
            .validate()
            .is_err());
    }
    let mut changed = input;
    changed.expected_period_end += Duration::nanoseconds(1);
    assert!(changed.validate().is_err());
}
#[test]
fn cancellation_rollout_flag_is_default_off_and_rejects_ambiguous_configuration() {
    assert!(!parse_flag(None).unwrap());
    for value in ["0", "false"] {
        assert!(!parse_flag(Some(value)).unwrap());
    }
    for value in ["1", "true"] {
        assert!(parse_flag(Some(value)).unwrap());
    }
    for value in ["", "on", "TRUE", "yes", "unexpected"] {
        assert!(parse_flag(Some(value)).is_err());
    }
}
#[test]
fn cancellation_schedule_request_time_is_not_effective_end_or_payment_evidence() {
    let (request, mut current) = fixture();
    assert_eq!(
        request.disposition(&current, at()).unwrap(),
        Disposition::NotObservedScheduled
    );
    current.cancel_at_period_end = true;
    current.cancel_at = Some(request.period_end());
    current.canceled_at = Some(at()); // Stripe records the schedule request time here.
    assert_eq!(
        request.disposition(&current, at()).unwrap(),
        Disposition::ProviderObservedScheduled
    );
    assert!(request.before_mutation(&current, at()).is_err());
    // Neither elapsed local time nor canceled_at alone confirms actual cancellation.
    assert_eq!(
        request.disposition(&current, request.period_end()).unwrap(),
        Disposition::ChangedOrUnconfirmed
    );
    current.status = "canceled".into();
    assert_eq!(
        request.disposition(&current, request.period_end()).unwrap(),
        Disposition::ChangedOrUnconfirmed
    );
    current.ended_at = Some(request.period_end());
    assert_eq!(
        request.disposition(&current, request.period_end()).unwrap(),
        Disposition::EffectiveAtExpectedBoundary
    );
    current.ended_at = Some(at()); // An external immediate cancellation is a different boundary.
    assert_eq!(
        request.disposition(&current, request.period_end()).unwrap(),
        Disposition::ChangedOrUnconfirmed
    );
}
#[test]
fn cancellation_missing_lifecycle_and_competing_provider_change_do_not_become_safe_defaults() {
    let (request, before) = fixture();
    for field in [
        "cancel_at",
        "canceled_at",
        "ended_at",
        "schedule",
        "pending_update",
    ] {
        let mut value = raw();
        value.as_object_mut().unwrap().remove(field);
        assert!(Subscription::parse(&value, false, at()).is_err(), "{field}");
    }
    for field in ["schedule", "pending_update"] {
        let mut value = raw();
        value[field] = json!({"id":"sub_sched_competing"});
        let observed = Subscription::parse(&value, false, at()).unwrap();
        assert!(request.before_mutation(&observed, at()).is_err());
        assert_eq!(
            request.disposition(&observed, at()).unwrap(),
            Disposition::ChangedOrUnconfirmed
        );
    }
    let mut changed = before.clone();
    changed.price = Some("price_external".into());
    assert!(request.before_mutation(&changed, at()).is_err());
    assert_eq!(
        request.disposition(&changed, at()).unwrap(),
        Disposition::ChangedOrUnconfirmed
    );
    let safe = serde_json::to_string(&(request, before)).unwrap();
    assert!(!safe.contains("PRIVATE_FIXTURE_CONTENT"));
    assert!(!safe.contains("cancellation_details"));
    assert!(!safe.contains("description"));
}
#[test]
fn cancellation_receiver_durable_restart_exact_retry_separates_observation_and_identity() {
    let (request, mut metadata) = fixture();
    let f = TestLedger::new(&[request.scope().organization]);
    f.guard.record_source(seed(&request)).unwrap();
    f.guard.record_source(dispatch(&request)).unwrap();
    metadata.cancel_at_period_end = true;
    metadata.canceled_at = Some(at());
    let original = attempt(&request);
    let id = f
        .guard
        .retain_cancellation_observation(
            &request,
            original.clone(),
            ObservationKind::MutationResponse,
            &metadata,
            at(),
        )
        .unwrap();
    let retained = f.guard.read().unwrap();
    let entry = retained
        .snapshot
        .sources
        .scopes
        .get(&request.scope().key().unwrap())
        .unwrap();
    assert!(entry.frozen.is_empty());
    assert_eq!(entry.outcomes.len(), 1);
    assert_eq!(entry.cancellation_observations.len(), 1);
    assert_eq!(entry.unapplied_outcomes.len(), 1); // No SQL projection/dispatch authority.
    let restarted = FinancialGuard::new(f.path().to_path_buf())
        .unwrap()
        .pin_namespace(f.guard.namespace().unwrap())
        .unwrap();
    assert_eq!(
        restarted
            .retain_cancellation_observation(
                &request,
                original,
                ObservationKind::MutationResponse,
                &metadata,
                at() + Duration::seconds(10)
            )
            .unwrap(),
        id
    );
    assert_eq!(restarted.read().unwrap().sequence, retained.sequence);
    let mut lookup = attempt(&request);
    lookup.actor = Uuid::now_v7();
    lookup.revision = 2;
    let next = restarted
        .retain_cancellation_observation(
            &request,
            lookup,
            ObservationKind::ResourceRead,
            &metadata,
            at() + Duration::seconds(20),
        )
        .unwrap();
    assert_ne!(next, id);
    let snapshot = restarted.read().unwrap();
    let entry = &snapshot.snapshot.sources.scopes[&request.scope().key().unwrap()];
    assert_eq!(entry.outcomes.len(), 2); // Separate occurrences, not duplicate Stripe resources.
    let outcomes: Vec<_> = entry.outcomes.values().collect();
    assert_eq!(outcomes[0].identity, outcomes[1].identity);
    assert_eq!(entry.cancellation_observations.len(), 2);
    assert!(entry.frozen.is_empty());
    assert_eq!(entry.cancellation_observations[&id].observed_at, at());
    assert_eq!(
        entry.cancellation_observations[&next].observed_at,
        at() + Duration::seconds(20)
    );
}
#[test]
fn cancellation_receiver_retains_unknown_or_wrong_identity_but_freezes_authority() {
    let (request, mut metadata) = fixture();
    let f = TestLedger::new(&[request.scope().organization]);
    metadata.customer = "cus_unexpected".into();
    let id = f
        .guard
        .retain_cancellation_observation(
            &request,
            attempt(&request),
            ObservationKind::ResourceRead,
            &metadata,
            at(),
        )
        .unwrap();
    let snapshot = f.guard.read().unwrap();
    let entry = &snapshot.snapshot.sources.scopes[&request.scope().key().unwrap()];
    assert!(entry
        .frozen
        .contains(&source::FreezeReason::UnmatchedOperation));
    assert!(entry
        .frozen
        .contains(&source::FreezeReason::RequestIdentityConflict));
    assert_eq!(
        entry.cancellation_observations[&id].subscription.customer,
        "cus_unexpected"
    );
    assert!(entry.head.is_none()); // Evidence is not automatic initialization.
    assert!(f.guard.record_source(seed(&request)).is_err());
}
#[test]
fn cancellation_late_response_is_retained_after_unknown_quarantined_or_deleted_roster() {
    use crate::services::team_financial_guard::{Event as GuardEvent, Head};
    for closed in ["unknown", "quarantined", "deleted"] {
        let (request, metadata) = fixture();
        let org = request.scope().organization;
        let f = TestLedger::new(if closed == "unknown" {
            &[]
        } else {
            std::slice::from_ref(&org)
        });
        if closed != "unknown" {
            f.guard.record_source(seed(&request)).unwrap();
            f.guard.record_source(dispatch(&request)).unwrap();
            if closed == "quarantined" {
                f.guard.quarantine(org).unwrap();
            } else {
                // Construct only this synthetic closed roster through the normal
                // outer snapshot event. No live ledger or deletion is performed.
                let mut state = f.guard.read().unwrap().snapshot;
                state
                    .apply(&GuardEvent::Delete { organization: org })
                    .unwrap();
                assert!(matches!(state.organizations[&org].head, Head::Deleted));
                // The production journal deletion method is intentionally not
                // exposed here: verify the exact outer-guard boundary with the
                // real normalized event after separately exercising fsync/replay.
                let outcome_id = Uuid::now_v7();
                let observation = Observation {
                    id: Uuid::now_v7(),
                    request: request.clone(),
                    attempt: attempt(&request),
                    kind: ObservationKind::MutationResponse,
                    observed_at: at(),
                    subscription: metadata.clone(),
                    outcome: outcome_id,
                };
                let outcome = source::Outcome {
                    id: outcome_id,
                    operation: request.operation(),
                    request_hash: request.request_hash().unwrap(),
                    evidence_hash: result_hash(
                        request.scope(),
                        request.operation(),
                        &observation.attempt,
                        &observation.kind,
                        &metadata,
                    )
                    .unwrap(),
                    observed_at: at(),
                    identity: Some(metadata.identity()),
                };
                state
                    .apply(&GuardEvent::FinancialSource {
                        event: Box::new(source::Event::CancellationObservation {
                            scope: request.scope().clone(),
                            observation: observation.clone(),
                            outcome,
                        }),
                    })
                    .unwrap();
                let entry = &state.sources.scopes[&request.scope().key().unwrap()];
                assert!(entry
                    .frozen
                    .contains(&source::FreezeReason::OrganizationClosed));
                assert_eq!(
                    entry.cancellation_observations[&observation.id],
                    observation
                );
                continue;
            }
        }
        let id = f
            .guard
            .retain_cancellation_observation(
                &request,
                attempt(&request),
                ObservationKind::MutationResponse,
                &metadata,
                at(),
            )
            .unwrap();
        let reopened = FinancialGuard::new(f.path().to_path_buf())
            .unwrap()
            .pin_namespace(f.guard.namespace().unwrap())
            .unwrap();
        let state = reopened.read().unwrap();
        let entry = &state.snapshot.sources.scopes[&request.scope().key().unwrap()];
        assert!(entry.cancellation_observations.contains_key(&id));
        assert!(entry.frozen.contains(if closed == "unknown" {
            &source::FreezeReason::OrganizationUnconfirmed
        } else {
            &source::FreezeReason::OrganizationClosed
        }));
    }
}
#[test]
fn cancellation_receiver_post_needs_original_dispatch_and_conflicts_preserve_history() {
    let (request, metadata) = fixture();
    let f = TestLedger::new(&[request.scope().organization]);
    f.guard.record_source(seed(&request)).unwrap();
    let mut invalid = attempt(&request);
    invalid.actor = Uuid::now_v7();
    let id = f
        .guard
        .retain_cancellation_observation(
            &request,
            invalid,
            ObservationKind::MutationResponse,
            &metadata,
            at(),
        )
        .unwrap();
    let snapshot = f.guard.read().unwrap();
    let entry = &snapshot.snapshot.sources.scopes[&request.scope().key().unwrap()];
    assert!(entry
        .frozen
        .contains(&source::FreezeReason::RequestIdentityConflict));
    let mut receipt = entry.cancellation_observations[&id].clone();
    let outcome = entry.outcomes[&receipt.outcome].clone();
    receipt.observed_at += Duration::seconds(1);
    f.guard
        .record_source(source::Event::CancellationObservation {
            scope: request.scope().clone(),
            observation: receipt.clone(),
            outcome,
        })
        .unwrap();
    let snapshot = f.guard.read().unwrap();
    let entry = &snapshot.snapshot.sources.scopes[&request.scope().key().unwrap()];
    assert!(entry
        .frozen
        .contains(&source::FreezeReason::LookupObservationConflict));
    assert_eq!(entry.cancellation_observations[&id].observed_at, at());
    assert_eq!(
        entry
            .conflicting_cancellation_observations
            .values()
            .next()
            .unwrap(),
        &receipt
    );
}
#[test]
fn cancellation_empty_fields_preserve_old_source_serialization_and_tokens() {
    let (snapshot, scope, _, _) = source::tests::fixture();
    let before = serde_json::to_value(&snapshot.scopes[&scope.key().unwrap()]).unwrap();
    assert!(before.get("cancellation_observations").is_none());
    assert!(before
        .get("conflicting_cancellation_observations")
        .is_none());
    let restored: source::Entry = serde_json::from_value(before.clone()).unwrap();
    assert!(restored.cancellation_observations.is_empty());
    assert_eq!(serde_json::to_value(restored).unwrap(), before);
}
#[test]
fn cancellation_changed_state_after_projection_is_pending_again_without_identity_conflict() {
    let (request, mut metadata) = fixture();
    let f = TestLedger::new(&[request.scope().organization]);
    f.guard.record_source(seed(&request)).unwrap();
    f.guard.record_source(dispatch(&request)).unwrap();
    metadata.cancel_at_period_end = true;
    metadata.canceled_at = Some(at());
    f.guard
        .retain_cancellation_observation(
            &request,
            attempt(&request),
            ObservationKind::MutationResponse,
            &metadata,
            at(),
        )
        .unwrap();
    let state = f.guard.read().unwrap();
    let entry = &state.snapshot.sources.scopes[&request.scope().key().unwrap()];
    let old_outcome = *entry.unapplied_outcomes.iter().next().unwrap();
    let expected = entry.head.clone().unwrap();
    // Synthetic source-only projection, not evidence that SQL projection exists.
    let next = source::Root {
        schema: 1,
        revision: expected.revision + 1,
        records: expected.records,
        hash: "d".repeat(64),
    };
    let transition = source::Transition {
        id: Uuid::now_v7(),
        next: next.clone(),
        change_hash: "e".repeat(64),
        accepted: vec![],
        resolved_outcomes: std::collections::BTreeSet::from([old_outcome]),
    };
    f.guard
        .record_source(source::Event::Prepare {
            scope: request.scope().clone(),
            expected,
            transition: transition.clone(),
        })
        .unwrap();
    f.guard
        .record_source(source::Event::Commit {
            scope: request.scope().clone(),
            transition: transition.id,
        })
        .unwrap();
    f.guard
        .read()
        .unwrap()
        .snapshot
        .sources
        .verify(request.scope(), &next)
        .unwrap();
    metadata.status = "canceled".into();
    metadata.ended_at = Some(request.period_end());
    let current = f
        .guard
        .retain_cancellation_observation(
            &request,
            attempt(&request),
            ObservationKind::ResourceRead,
            &metadata,
            request.period_end(),
        )
        .unwrap();
    let state = f.guard.read().unwrap();
    let entry = &state.snapshot.sources.scopes[&request.scope().key().unwrap()];
    let new_outcome = entry.cancellation_observations[&current].outcome;
    assert_ne!(old_outcome, new_outcome);
    assert!(entry.frozen.is_empty());
    assert!(!entry.unapplied_outcomes.contains(&old_outcome));
    assert!(entry.unapplied_outcomes.contains(&new_outcome));
    assert_eq!(
        entry.outcomes[&old_outcome].identity,
        entry.outcomes[&new_outcome].identity
    );
    assert!(state
        .snapshot
        .sources
        .verify(request.scope(), &next)
        .is_err());
}
fn project_all_source_only(guard: &FinancialGuard, request: &FrozenCancellation) {
    let state = guard.read().unwrap();
    let entry = &state.snapshot.sources.scopes[&request.scope().key().unwrap()];
    let expected = entry.head.clone().unwrap();
    let transition = source::Transition {
        id: Uuid::now_v7(),
        next: source::Root {
            schema: 1,
            revision: expected.revision + 1,
            records: expected.records,
            hash: fingerprint(&(expected.revision, &entry.unapplied_outcomes)).unwrap(),
        },
        change_hash: "e".repeat(64),
        accepted: vec![],
        resolved_outcomes: entry.unapplied_outcomes.clone(),
    };
    guard
        .record_source(source::Event::Prepare {
            scope: request.scope().clone(),
            expected,
            transition: transition.clone(),
        })
        .unwrap();
    guard
        .record_source(source::Event::Commit {
            scope: request.scope().clone(),
            transition: transition.id,
        })
        .unwrap();
}
#[test]
fn cancellation_aba_and_same_state_new_attempt_are_unresolved_but_exact_replay_is_not_new() {
    let (request, mut metadata) = fixture();
    let f = TestLedger::new(&[request.scope().organization]);
    f.guard.record_source(seed(&request)).unwrap();
    let mut ids = std::collections::BTreeSet::new();
    let mut last = None;
    for (index, scheduled) in [false, true, false, false].into_iter().enumerate() {
        metadata.cancel_at_period_end = scheduled;
        metadata.canceled_at = scheduled.then_some(at());
        let current_attempt = attempt(&request);
        let receipt = f
            .guard
            .retain_cancellation_observation(
                &request,
                current_attempt.clone(),
                ObservationKind::ResourceRead,
                &metadata,
                at() + Duration::seconds(index as i64),
            )
            .unwrap();
        let state = f.guard.read().unwrap();
        let entry = &state.snapshot.sources.scopes[&request.scope().key().unwrap()];
        let outcome = entry.cancellation_observations[&receipt].outcome;
        assert!(ids.insert(outcome));
        assert_eq!(entry.outcomes.len(), index + 1);
        assert_eq!(
            entry.unapplied_outcomes,
            std::collections::BTreeSet::from([outcome])
        );
        assert!(entry.frozen.is_empty());
        assert!(state
            .snapshot
            .sources
            .verify(request.scope(), entry.head.as_ref().unwrap())
            .is_err());
        // Explicitly simulate projection between A -> B -> A. No SQL/provider
        // projection or causal attribution is certified by this fixture.
        project_all_source_only(&f.guard, &request);
        last = Some((current_attempt, receipt));
    }
    let state = f.guard.read().unwrap();
    let entry = &state.snapshot.sources.scopes[&request.scope().key().unwrap()];
    assert!(entry
        .outcomes
        .values()
        .all(|v| v.identity == Some(metadata.identity())));
    let (last_attempt, last_receipt) = last.unwrap();
    assert_eq!(
        f.guard
            .retain_cancellation_observation(
                &request,
                last_attempt,
                ObservationKind::ResourceRead,
                &metadata,
                at() + Duration::seconds(50)
            )
            .unwrap(),
        last_receipt
    );
    let replay = f.guard.read().unwrap();
    assert_eq!(replay.sequence, state.sequence);
    assert!(
        replay.snapshot.sources.scopes[&request.scope().key().unwrap()]
            .unapplied_outcomes
            .is_empty()
    );
}
#[test]
fn cancellation_separate_http_reads_in_same_lease_need_distinct_exchange_identity() {
    let (request, metadata) = fixture();
    let f = TestLedger::new(&[request.scope().organization]);
    f.guard.record_source(seed(&request)).unwrap();
    let original = attempt(&request);
    let first = f
        .guard
        .retain_cancellation_observation(
            &request,
            original.clone(),
            ObservationKind::ResourceRead,
            &metadata,
            at(),
        )
        .unwrap();
    project_all_source_only(&f.guard, &request);
    let mut second = original.clone();
    second.exchange = Uuid::now_v7();
    let next = f
        .guard
        .retain_cancellation_observation(
            &request,
            second.clone(),
            ObservationKind::ResourceRead,
            &metadata,
            at() + Duration::seconds(1),
        )
        .unwrap();
    assert_ne!(first, next);
    let state = f.guard.read().unwrap();
    let entry = &state.snapshot.sources.scopes[&request.scope().key().unwrap()];
    assert!(entry
        .unapplied_outcomes
        .contains(&entry.cancellation_observations[&next].outcome));
    assert!(!entry
        .unapplied_outcomes
        .contains(&entry.cancellation_observations[&first].outcome));
    second.exchange = Uuid::nil();
    assert!(f
        .guard
        .retain_cancellation_observation(
            &request,
            second,
            ObservationKind::ResourceRead,
            &metadata,
            at()
        )
        .is_err());
    assert_eq!(f.guard.read().unwrap().sequence, state.sequence);
}

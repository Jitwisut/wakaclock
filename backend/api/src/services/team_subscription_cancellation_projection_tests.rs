//! Synthetic policy fixtures. No SQL/provider/current authority is granted.
use super::lifecycle::{Exchange, ExchangeKind};
use super::projection::{Basis, CancellationProjection, ProjectionMode};
use super::*;
use chrono::Duration;
use std::collections::BTreeMap;

fn fixture() -> CancellationProjection {
    let (request, subscription) = super::tests::fixture();
    let at = request.accepted_at() + Duration::seconds(1);
    let exchange = Exchange {
        id: Uuid::now_v7(),
        actor: request.actor(),
        revision: 1,
        lease: Uuid::now_v7(),
        account_lease: Uuid::now_v7(),
        kind: ExchangeKind::ResourceRead,
        prepared_at: at,
        first_attempt_at: None,
        previous_observation: None,
        authorization_hash: super::lifecycle::authorization_hash(
            &request,
            1,
            request.actor(),
            request.accepted_at(),
            "request_cancel_at_period_end",
        )
        .unwrap(),
    };
    let observation = Observation {
        id: Uuid::now_v7(),
        request: request.clone(),
        attempt: Attempt {
            actor: exchange.actor,
            revision: 1,
            lease: exchange.lease,
            exchange: exchange.id,
            source_claim: true,
        },
        kind: ObservationKind::ResourceRead,
        observed_at: at + Duration::seconds(1),
        subscription,
        outcome: Uuid::now_v7(),
    };
    let basis = Basis {
        revision: 1,
        actor: request.actor(),
        first_attempt_at: None,
        recovery_actor: None,
        read_only: false,
        disposition: "pending".into(),
        last_observation: None,
        observed_at: None,
        lease: Some(exchange.lease),
        lease_until: Some(at + Duration::seconds(60)),
    };
    CancellationProjection {
        mode: ProjectionMode::Current {
            account_lease: exchange.account_lease,
        },
        request,
        observation: observation.clone(),
        exchange,
        basis,
        projected_at: at + Duration::seconds(2),
        outcomes: BTreeMap::from([(observation.outcome, "a".repeat(64))]),
    }
}
#[test]
fn cancellation_projection_causal_predecessor_blocks_old_result_without_using_nearby_times() {
    let projection = fixture();
    let next = projection.next().unwrap();
    assert_eq!(next.revision, projection.basis.revision);
    assert_eq!(next.last_observation, Some(projection.observation.id));
    assert!(!next.read_only);
    let mut stale = projection.clone();
    stale.basis.last_observation = Some(Uuid::now_v7());
    stale.basis.observed_at = Some(projection.projected_at);
    assert!(stale.next().is_err());
    stale.mode = ProjectionMode::RetainedOnly {
        park: false,
        owner_changed: false,
        resume_initial_read: false,
    };
    assert_eq!(stale.next().unwrap(), stale.basis);
    stale.mode = ProjectionMode::RetainedOnly {
        park: true,
        owner_changed: false,
        resume_initial_read: false,
    };
    assert!(stale.next().is_err());
    let mut missing = projection.clone();
    missing.observation.attempt.exchange = Uuid::now_v7();
    assert!(missing.next().is_err());
    let mut extra = projection;
    extra.outcomes.insert(Uuid::now_v7(), "b".repeat(64));
    assert!(extra.next().is_err());
}
#[test]
fn cancellation_projection_cold_or_owner_revoked_result_cannot_recreate_mutation_authority() {
    let mut projection = fixture();
    projection.projected_at += Duration::minutes(2);
    assert!(projection.next().is_err());
    projection.mode = ProjectionMode::RetainedOnly {
        park: true,
        owner_changed: true,
        resume_initial_read: false,
    };
    let next = projection.next().unwrap();
    assert!(next.read_only);
    assert_eq!(next.disposition, "owner_changed");
    assert_eq!(next.last_observation, None);
    assert_eq!(next.observed_at, None);
    assert_eq!(next.first_attempt_at, None);
    assert_eq!(next.lease, None);
    let mut newer = projection.clone();
    newer.basis.lease = Some(Uuid::now_v7());
    assert!(newer.next().is_err());
    newer.mode = ProjectionMode::RetainedOnly {
        park: false,
        owner_changed: true,
        resume_initial_read: false,
    };
    assert_eq!(newer.next().unwrap(), newer.basis);
}
#[test]
fn cancellation_projection_scheduled_unknown_and_read_only_are_not_inferred_from_time() {
    let mut projection = fixture();
    projection.observation.subscription.cancel_at_period_end = true;
    projection.observation.subscription.canceled_at = Some(projection.observation.observed_at);
    let next = projection.next().unwrap();
    assert_eq!(next.disposition, "provider_scheduled");
    assert!(next.read_only);
    projection.observation.subscription.price = None;
    assert_eq!(projection.next().unwrap().disposition, "changed");
    projection = fixture();
    projection.basis.read_only = true;
    assert_eq!(projection.next().unwrap().disposition, "recovery_required");
    projection = fixture();
    projection.projected_at = projection.request.period_end();
    assert!(projection.next().is_err());
}
#[test]
fn cancellation_projection_effective_requires_provider_ended_at_the_original_boundary() {
    let mut projection = fixture();
    let end = projection.request.period_end();
    projection.exchange.prepared_at = end - Duration::seconds(5);
    projection.observation.observed_at = end + Duration::seconds(1);
    projection.projected_at = end + Duration::seconds(2);
    projection.basis.lease_until = Some(end + Duration::seconds(60));
    projection.observation.subscription.status = "canceled".into();
    projection.observation.subscription.ended_at = Some(end);
    assert_eq!(projection.next().unwrap().disposition, "effective");
    projection.observation.subscription.ended_at = Some(end - Duration::seconds(1));
    assert_eq!(projection.next().unwrap().disposition, "changed");
    projection.observation.subscription.ended_at = None;
    projection.observation.subscription.canceled_at = Some(end);
    assert_eq!(projection.next().unwrap().disposition, "changed");
}

#[test]
fn cancellation_initial_read_restart_resumes_without_promoting_old_evidence_or_old_schema() {
    let mut projection = fixture();
    projection.projected_at += Duration::minutes(2);
    projection.mode = ProjectionMode::RetainedOnly {
        park: true,
        owner_changed: false,
        resume_initial_read: true,
    };
    let next = projection.next().unwrap();
    assert_eq!(next.disposition, "pending");
    assert!(!next.read_only);
    assert_eq!(next.first_attempt_at, None);
    assert_eq!(next.last_observation, None);
    assert_eq!(next.observed_at, None);
    assert_eq!(next.lease, None);
    // A fresh actual read must still be projected before any mutation.
    let old: ProjectionMode = serde_json::from_value(serde_json::json!({
        "kind":"retained_only", "park":true, "owner_changed":false,
    }))
    .unwrap();
    assert!(serde_json::to_value(&old)
        .unwrap()
        .get("resume_initial_read")
        .is_none());
    projection.mode = old;
    assert!(projection.next().unwrap().read_only);
    assert_eq!(projection.next().unwrap().disposition, "recovery_required");
    projection.mode = ProjectionMode::RetainedOnly {
        park: true,
        owner_changed: false,
        resume_initial_read: true,
    };
    for invalid in ["owner", "read_only", "first", "predecessor"] {
        let mut changed = projection.clone();
        match invalid {
            "owner" => {
                changed.mode = ProjectionMode::RetainedOnly {
                    park: true,
                    owner_changed: true,
                    resume_initial_read: true,
                }
            }
            "read_only" => changed.basis.read_only = true,
            "first" => changed.basis.first_attempt_at = Some(changed.request.accepted_at()),
            _ => {
                let prior = Uuid::now_v7();
                changed.basis.last_observation = Some(prior);
                changed.basis.observed_at = Some(changed.observation.observed_at);
                changed.exchange.previous_observation = Some(prior);
            }
        }
        assert!(changed.next().is_err(), "{invalid}");
    }
}

#[test]
fn cancellation_restart_does_not_use_missing_sql_first_attempt_as_proof_of_no_send() {
    use crate::services::{team_financial_guard::Snapshot, team_financial_source as source};
    let projection = fixture();
    let mut state = Snapshot::default();
    let (sources, scope, _, _) = source::tests::fixture();
    state.sources = sources;
    assert!(super::projection::never_mutated(
        &state,
        &projection.request
    ));
    // Even a possible dispatch retained in another scope fences this nonce.
    state
        .sources
        .scopes
        .get_mut(&scope.key().unwrap())
        .unwrap()
        .dispatches
        .insert(
            projection.request.operation(),
            source::Dispatch {
                operation: projection.request.operation(),
                request_hash: "a".repeat(64),
                idempotency_hash: "b".repeat(64),
                first_attempt_at: projection.request.accepted_at(),
            },
        );
    assert!(!super::projection::never_mutated(
        &state,
        &projection.request
    ));
    assert_eq!(projection.basis.first_attempt_at, None);
}

use super::*;
use crate::services::{
    team_financial_ingress as ingress, team_financial_source as source,
    team_financial_transaction::{
        self as transaction,
        tests::{fixture, proposal},
    },
};

fn ledger(enroll: bool, notify: bool) -> (TestLedger, transaction::Proposal) {
    let (state, p) = fixture(3);
    let orgs = p
        .sources
        .iter()
        .map(|s| s.scope.organization)
        .collect::<Vec<_>>();
    let ledger = TestLedger::new(&orgs);
    ledger
        .guard
        .record_ingress(ingress::Event::Seed {
            scope: p.account.clone(),
            receipts: vec![],
            review: Uuid::now_v7(),
            review_hash: "a".repeat(64),
        })
        .unwrap();
    for entry in state.sources.scopes.values() {
        ledger
            .guard
            .record_source(source::Event::Seed {
                scope: entry.scope.clone(),
                head: entry.head.clone().unwrap(),
                review: entry.review.clone().unwrap(),
                accepted: vec![],
            })
            .unwrap();
    }
    let p = proposal(
        &ledger.guard.read().unwrap().snapshot,
        &p.account,
        &orgs[..2],
        enroll,
        notify,
    );
    (ledger, p)
}
fn prepare(p: &transaction::Proposal) -> transaction::Event {
    transaction::Event::Prepare {
        proposal: Box::new(p.clone()),
    }
}
fn confirm(p: &transaction::Proposal) -> transaction::Event {
    transaction::Event::Confirm {
        transaction: p.id,
        proposal_hash: p.digest().unwrap(),
    }
}

#[test]
fn financial_group_retains_late_atomic_evidence_without_unfencing_dispatch_or_confirmation() {
    use crate::services::{
        team_stripe_checkout as checkout, team_stripe_checkout_receipt as receipt,
        team_subscription_cancellation as cancel,
    };
    for member in [true, false] {
        let (request, mut metadata) = cancel::tests::fixture();
        let other = Uuid::now_v7();
        let f = TestLedger::new(&[request.scope().organization, other]);
        let account = ingress::Scope {
            account: request.scope().account.clone(),
            live: false,
        };
        f.guard
            .record_ingress(ingress::Event::Seed {
                scope: account.clone(),
                receipts: vec![],
                review: Uuid::now_v7(),
                review_hash: "a".repeat(64),
            })
            .unwrap();
        let accepted = source::AcceptedRequest {
            operation: Uuid::now_v7(),
            kind: source::OperationKind::CreateCheckout,
            actor: request.actor(),
            request_hash: "b".repeat(64),
            idempotency_hash: "c".repeat(64),
            accepted_at: request.accepted_at(),
        };
        for org in [request.scope().organization, other] {
            let scope = source::Scope {
                organization: org,
                account: account.account.clone(),
                live: false,
            };
            f.guard
                .record_source(source::Event::Seed {
                    head: source::Root::empty(&scope).unwrap(),
                    scope,
                    review: source::Review {
                        id: Uuid::now_v7(),
                        kind: source::ReviewKind::ReviewedInventory,
                        evidence_hash: "a".repeat(64),
                        reviewed_at: request.accepted_at(),
                    },
                    accepted: if org == request.scope().organization {
                        vec![request.accepted_request().unwrap(), accepted.clone()]
                    } else {
                        vec![]
                    },
                })
                .unwrap();
        }
        for r in [request.accepted_request().unwrap(), accepted.clone()] {
            f.guard
                .record_source(source::Event::Dispatch {
                    scope: request.scope().clone(),
                    dispatch: source::Dispatch {
                        operation: r.operation,
                        request_hash: r.request_hash,
                        idempotency_hash: r.idempotency_hash,
                        first_attempt_at: request.accepted_at(),
                    },
                })
                .unwrap();
        }
        let group_org = if member {
            request.scope().organization
        } else {
            other
        };
        let p = proposal(
            &f.guard.read().unwrap().snapshot,
            &account,
            &[group_org],
            false,
            false,
        );
        f.guard.record_transaction(prepare(&p)).unwrap();
        metadata.cancel_at_period_end = true;
        let attempt = cancel::Attempt {
            actor: request.actor(),
            revision: 1,
            lease: Uuid::now_v7(),
            exchange: Uuid::now_v7(),
            source_claim: true,
        };
        let id = f
            .guard
            .retain_cancellation_observation(
                &request,
                attempt.clone(),
                cancel::ObservationKind::MutationResponse,
                &metadata,
                request.accepted_at(),
            )
            .unwrap();
        let checkout_attempt = receipt::Attempt {
            actor: request.actor(),
            revision: 1,
            lease: Uuid::now_v7(),
            source_claim: true,
        };
        let evidence = checkout::SessionEvidence {
            operation: accepted.operation,
            customer: "cus_late".into(),
            price: "price_late".into(),
            currency: "usd".into(),
            amount_minor: 2500,
            live: false,
            id: "cs_test_late".into(),
            status: "open".into(),
            expires_at: request.period_end(),
            subscription: None,
            observed_at: request.accepted_at(),
        };
        f.guard
            .retain_checkout_observation(
                request.scope().clone(),
                &accepted,
                checkout_attempt.clone(),
                receipt::ObservationKind::CreateResponse,
                &evidence,
            )
            .unwrap()
            .unwrap();
        let failure = f
            .guard
            .retain_checkout_failure(
                request.scope().clone(),
                &accepted,
                checkout_attempt,
                receipt::FailureDetail {
                    phase: receipt::FailurePhase::ResourceRead,
                    result: receipt::FailureResult::Provider {
                        code: receipt::FailureCode::ProviderUnavailable,
                    },
                    http_status: Some(503),
                    retry_after: None,
                },
            )
            .unwrap()
            .unwrap();
        let retained = f.guard.read().unwrap();
        assert_eq!(retained.snapshot.transactions.groups[&p.id].proposal, p);
        assert!(!retained.snapshot.transactions.groups[&p.id].committed);
        let entry = &retained.snapshot.sources.scopes[&request.scope().key().unwrap()];
        assert_eq!(entry.cancellation_observations.len(), 1);
        assert_eq!(entry.checkout_observations.len(), 1);
        assert_eq!(entry.checkout_failures.len(), 1);
        assert_eq!(entry.unapplied_outcomes.len(), 2);
        assert_eq!(
            f.guard
                .retain_cancellation_observation(
                    &request,
                    attempt,
                    cancel::ObservationKind::MutationResponse,
                    &metadata,
                    request.accepted_at()
                )
                .unwrap(),
            id
        );
        assert_eq!(f.guard.read().unwrap().sequence, retained.sequence);
        let mut conflict = entry.checkout_failures[&failure].clone();
        conflict.detail.http_status = Some(500);
        f.guard
            .record_source(source::Event::CheckoutFailure {
                scope: request.scope().clone(),
                observation: conflict,
            })
            .unwrap();
        assert!(f
            .guard
            .record_source(source::Event::Dispatch {
                scope: request.scope().clone(),
                dispatch: entry.dispatches[&request.operation()].clone()
            })
            .is_err());
        assert!(f
            .guard
            .record_source(source::Event::Commit {
                scope: p.sources[0].scope.clone(),
                transition: p.id
            })
            .is_err());
        assert!(f.guard.record_transaction(confirm(&p)).is_err());
        let restarted = FinancialGuard::new(f.path().to_path_buf())
            .unwrap()
            .pin_namespace(f.guard.namespace().unwrap())
            .unwrap();
        let reopened = restarted.read().unwrap();
        assert_eq!(reopened.snapshot.transactions.groups[&p.id].proposal, p);
        let entry = &reopened.snapshot.sources.scopes[&request.scope().key().unwrap()];
        assert_eq!(entry.conflicting_checkout_failures.len(), 1);
        assert!(!entry.frozen.is_empty());
        assert_eq!(entry.cancellation_observations.len(), 1);
        assert_eq!(entry.checkout_observations.len(), 1);
    }
}

#[test]
fn financial_group_durable_restart_exact_receipts_and_tokens() {
    let (ledger, p) = ledger(false, false);
    let before = ledger.guard.read().unwrap();
    let org = p.sources[0].scope.organization;
    let other = *before
        .snapshot
        .organizations
        .keys()
        .find(|o| !p.sources.iter().any(|s| s.scope.organization == **o))
        .unwrap();
    let original = before.organization_token(org).unwrap();
    let unrelated = before.organization_token(other).unwrap();
    let status = ledger.guard.record_transaction(prepare(&p)).unwrap();
    assert_eq!(
        status,
        TransactionRecord {
            status: TransactionStatus::Prepared,
            appended: true
        }
    );
    let restarted = FinancialGuard::new(ledger.guard.path.clone())
        .unwrap()
        .pin_namespace(p.namespace)
        .unwrap();
    let pending = restarted.read().unwrap();
    assert_eq!(pending.sequence, before.sequence + 1);
    assert_eq!(pending.snapshot.transactions.groups[&p.id].proposal, p);
    assert_ne!(pending.organization_token(org).unwrap(), original);
    assert_eq!(pending.organization_token(other).unwrap(), unrelated);
    assert!(pending.source_token(&p.sources[0].scope).is_err());
    assert!(pending.snapshot.verify(org, None).is_err());
    assert_eq!(
        restarted.record_transaction(prepare(&p)).unwrap(),
        TransactionRecord {
            status: TransactionStatus::Prepared,
            appended: false
        }
    );
    assert_eq!(restarted.read().unwrap().sequence, pending.sequence);
    // File-only protocol fixture. A production SQL coordinator must establish
    // commit/readback before invoking this primitive; this test grants no rights.
    assert_eq!(
        restarted.record_transaction(confirm(&p)).unwrap(),
        TransactionRecord {
            status: TransactionStatus::Confirmed,
            appended: true
        }
    );
    let done = restarted.read().unwrap();
    assert_eq!(done.sequence, pending.sequence + 1);
    assert_ne!(
        done.organization_token(org).unwrap(),
        original,
        "source-only transaction must not create an enrollment-token ABA"
    );
    assert_eq!(done.organization_token(other).unwrap(), unrelated);
    assert!(done.source_token(&p.sources[0].scope).is_ok());
    assert_eq!(
        restarted.record_transaction(confirm(&p)).unwrap(),
        TransactionRecord {
            status: TransactionStatus::Confirmed,
            appended: false
        }
    );
    assert_eq!(
        restarted.record_transaction(prepare(&p)).unwrap(),
        TransactionRecord {
            status: TransactionStatus::Confirmed,
            appended: false
        }
    );
    assert_eq!(restarted.read().unwrap().sequence, done.sequence);
}
#[test]
fn financial_group_failed_sync_or_confirmation_retains_complete_intent() {
    use std::sync::atomic::Ordering;
    let (ledger, p) = ledger(true, true);
    let before = ledger.guard.read().unwrap().sequence;
    ledger.guard.sync_failures.store(1, Ordering::SeqCst);
    assert!(ledger.guard.record_transaction(prepare(&p)).is_err());
    // Full frame survived the injected failed ACK/fsync. A locked read must
    // reestablish durability, never truncate it or retain only one member.
    let pending = ledger.guard.read().unwrap();
    assert_eq!(pending.sequence, before + 1);
    assert_eq!(pending.snapshot.transactions.groups[&p.id].proposal, p);
    for s in &p.sources {
        assert!(pending.snapshot.sources.scopes[&s.scope.key().unwrap()]
            .pending
            .is_some());
    }
    for e in &p.enrollments {
        assert!(
            ledger
                .guard
                .prepare(e.organization, e.expected.clone(), e.transition.clone())
                .is_err(),
            "ordinary exact prepare cannot bypass the group fence"
        );
        assert!(ledger
            .guard
            .confirm_committed(e.organization, p.id, &e.transition.state)
            .is_err());
    }
    assert!(
        !ledger
            .guard
            .record_transaction(prepare(&p))
            .unwrap()
            .appended
    );
    ledger.guard.fail_transaction_confirmation_once();
    assert!(ledger.guard.record_transaction(confirm(&p)).is_err());
    assert_eq!(ledger.guard.read().unwrap().sequence, pending.sequence);
    assert!(!ledger.guard.read().unwrap().snapshot.transactions.groups[&p.id].committed);
    ledger.guard.sync_failures.store(1, Ordering::SeqCst);
    assert!(ledger.guard.record_transaction(confirm(&p)).is_err());
    let done = ledger.guard.read().unwrap();
    assert!(done.snapshot.transactions.groups[&p.id].committed);
    assert_eq!(done.sequence, pending.sequence + 1);
    assert!(
        !ledger
            .guard
            .record_transaction(confirm(&p))
            .unwrap()
            .appended
    );
    for e in &p.enrollments {
        assert!(ledger
            .guard
            .confirm_committed(e.organization, p.id, &e.transition.state)
            .is_err());
    }
    assert_eq!(ledger.guard.read().unwrap().sequence, done.sequence);
}
#[test]
fn financial_group_busy_lock_or_torn_frame_never_acknowledges_or_truncates() {
    let (ledger, p) = ledger(false, false);
    let original = std::fs::read(&ledger.guard.path).unwrap();
    let lock = FinancialGuard::options()
        .open(ledger.guard.lock_path())
        .unwrap();
    lock.try_lock_exclusive().unwrap();
    assert!(ledger.guard.record_transaction(prepare(&p)).is_err());
    assert_eq!(std::fs::read(&ledger.guard.path).unwrap(), original);
    drop(lock);
    ledger.guard.record_transaction(prepare(&p)).unwrap();
    let mut file = OpenOptions::new()
        .append(true)
        .open(&ledger.guard.path)
        .unwrap();
    file.write_all(b"{incomplete_group").unwrap();
    file.sync_all().unwrap();
    drop(file);
    let torn = std::fs::read(&ledger.guard.path).unwrap();
    assert!(ledger.guard.read().is_err());
    assert!(ledger.guard.record_transaction(confirm(&p)).is_err());
    assert_eq!(std::fs::read(&ledger.guard.path).unwrap(), torn);
}

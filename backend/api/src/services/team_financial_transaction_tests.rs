use super::*;
use crate::services::team_analytics_entitlement::State;
use chrono::{DateTime, Utc};

pub(crate) fn proposal(
    state: &Guard,
    account: &ingress::Scope,
    orgs: &[Uuid],
    enroll: bool,
    notify: bool,
) -> Proposal {
    let id = Uuid::now_v7();
    let now = DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).unwrap();
    let sources = orgs
        .iter()
        .map(|org| {
            let scope = source::Scope {
                organization: *org,
                account: account.account.clone(),
                live: account.live,
            };
            let expected = state.sources.scopes[&scope.key().unwrap()]
                .head
                .clone()
                .unwrap();
            SourceChange {
                scope: scope.clone(),
                transition: source::Transition {
                    id,
                    next: source::Root {
                        schema: 1,
                        revision: expected.revision + 1,
                        records: expected.records + 1,
                        hash: fingerprint(&(id, &scope)).unwrap(),
                    },
                    change_hash: "a".repeat(64),
                    accepted: vec![],
                    resolved_outcomes: Default::default(),
                },
                expected,
            }
        })
        .collect();
    let enrollments = if enroll {
        orgs.iter()
            .map(|org| {
                let expected = state.organizations[org].head.clone();
                let next = match &expected {
                    Head::Legacy => State::trial(10, now).unwrap(),
                    Head::Enrolled { state } => {
                        let mut next = state.as_ref().clone();
                        next.revision += 1;
                        next
                    }
                    _ => panic!("closed fixture"),
                };
                EnrollmentChange {
                    organization: *org,
                    expected,
                    transition: Pending {
                        transition_id: id,
                        state: Box::new(next),
                    },
                }
            })
            .collect()
    } else {
        vec![]
    };
    let entry = state.ingress.entry(account).unwrap();
    let ingress = notify.then(|| {
        entry
            .propose(ingress::Receipt {
                notification: ingress::Notification {
                    event_id: format!("evt_{}", id.simple()),
                    payload_hash: "b".repeat(64),
                    kind: "fixture.observed".into(),
                    created: now,
                    customer: None,
                    subscription: None,
                    invoice: None,
                    supported: false,
                },
                received_at: now,
                requested_revision: None,
                job_before: None,
                transition: id,
            })
            .unwrap()
    });
    Proposal {
        id,
        namespace: state.namespace.unwrap(),
        account: account.clone(),
        expected_ingress: entry.head.clone(),
        mode: Mode::Normal,
        observation_hash: observation_hash(state, account, orgs).unwrap(),
        sources,
        enrollments,
        ingress,
        writer: None,
    }
}
pub(crate) fn fixture(count: usize) -> (Guard, Proposal) {
    let mut state = Guard::default();
    let mut orgs: Vec<_> = (0..count).map(|_| Uuid::now_v7()).collect();
    orgs.sort();
    state
        .apply(&GuardEvent::Initialize {
            namespace: Uuid::now_v7(),
            created_at: Utc::now(),
            legacy_organizations: orgs.clone(),
        })
        .unwrap();
    let account = ingress::Scope {
        account: "acct_group_fixture".into(),
        live: false,
    };
    state
        .apply(&GuardEvent::FinancialIngress {
            event: Box::new(ingress::Event::Seed {
                scope: account.clone(),
                receipts: vec![],
                review: Uuid::now_v7(),
                review_hash: "a".repeat(64),
            }),
        })
        .unwrap();
    for org in &orgs {
        let scope = source::Scope {
            organization: *org,
            account: account.account.clone(),
            live: account.live,
        };
        state
            .apply(&GuardEvent::FinancialSource {
                event: Box::new(source::Event::Seed {
                    head: source::Root::empty(&scope).unwrap(),
                    scope,
                    review: source::Review {
                        id: Uuid::now_v7(),
                        kind: source::ReviewKind::ReviewedEmpty,
                        evidence_hash: "b".repeat(64),
                        reviewed_at: Utc::now(),
                    },
                    accepted: vec![],
                }),
            })
            .unwrap();
    }
    let p = proposal(&state, &account, &orgs, true, true);
    (state, p)
}

#[test]
fn group_scheduler_typed_targets_bind_scope_order_and_preserve_legacy_wire() {
    let (mut state, mut p) = fixture(2);
    p.ingress = None;
    p.enrollments.clear();
    assert!(!serde_json::to_value(&p)
        .unwrap()
        .as_object()
        .unwrap()
        .contains_key("writer"));
    let legacy = serde_json::to_vec(&p).unwrap();
    assert_eq!(
        serde_json::to_vec(&serde_json::from_slice::<Proposal>(&legacy).unwrap()).unwrap(),
        legacy
    );
    let targets = p
        .sources
        .iter()
        .enumerate()
        .map(|(n, s)| ScheduleTarget {
            organization: s.scope.organization,
            customer: format!("cus_scheduler{n}"),
            subscription: format!("sub_scheduler{n}"),
        })
        .collect::<Vec<_>>();
    p.writer = Some(Writer::Scheduler { targets });
    for source in &mut p.sources {
        source.transition.change_hash = p
            .writer
            .as_ref()
            .unwrap()
            .change_hash(&p.account, &source.scope)
            .unwrap();
    }
    let before = state.clone();
    for case in 0..5 {
        let mut bad = p.clone();
        match case {
            0 => {
                let Some(Writer::Scheduler { targets }) = &mut bad.writer else {
                    unreachable!()
                };
                targets.reverse();
            }
            1 => {
                let Some(Writer::Scheduler { targets }) = &mut bad.writer else {
                    unreachable!()
                };
                targets[0].organization = Uuid::now_v7();
            }
            2 => {
                let Some(Writer::Scheduler { targets }) = &mut bad.writer else {
                    unreachable!()
                };
                targets[0].customer = "PRIVATE_INVALID_CUSTOMER!".into();
            }
            3 => bad.sources[0].transition.change_hash = "f".repeat(64),
            _ => {
                let Some(Writer::Scheduler { targets }) = &mut bad.writer else {
                    unreachable!()
                };
                targets.clear();
            }
        }
        assert!(prepare(&mut state, &bad).is_err());
        assert_eq!(state, before);
    }
    prepare(&mut state, &p).unwrap();
    confirm(&mut state, &p).unwrap();
}

#[test]
fn group_provider_writer_cannot_create_initial_enrollment_or_reuse_another_observation() {
    let (mut state, mut p) = fixture(1);
    p.ingress = None;
    let target = ScheduleTarget {
        organization: p.sources[0].scope.organization,
        customer: "cus_observed".into(),
        subscription: "sub_observed".into(),
    };
    p.writer = Some(Writer::Reconciliation {
        target,
        lease: Uuid::now_v7(),
        revision: 1,
        binding_revision: 1,
        observation_hash: "a".repeat(64),
    });
    p.sources[0].transition.change_hash = p
        .writer
        .as_ref()
        .unwrap()
        .change_hash(&p.account, &p.sources[0].scope)
        .unwrap();
    let before = state.clone();
    assert!(prepare(&mut state, &p).is_err());
    assert_eq!(state, before);
    p.enrollments.clear();
    prepare(&mut state, &p).unwrap();
    confirm(&mut state, &p).unwrap();
    let mut reused = p.clone();
    let Some(Writer::Reconciliation {
        observation_hash, ..
    }) = &mut reused.writer
    else {
        unreachable!()
    };
    *observation_hash = "b".repeat(64);
    let before = state.clone();
    assert!(prepare(&mut state, &reused).is_err());
    assert_eq!(state, before);
}

#[test]
fn group_quote_writer_binds_actor_customer_offer_and_single_scope_without_activation() {
    let (mut state, mut p) = fixture(1);
    p.ingress = None;
    p.enrollments.clear();
    p.writer = Some(Writer::Quote {
        organization: p.sources[0].scope.organization,
        actor: Uuid::now_v7(),
        quote: Uuid::now_v7(),
        customer_operation: Uuid::now_v7(),
        customer_revision: 1,
        customer: "cus_quote_group".into(),
        offer_hash: "a".repeat(64),
    });
    p.sources[0].transition.change_hash = p
        .writer
        .as_ref()
        .unwrap()
        .change_hash(&p.account, &p.sources[0].scope)
        .unwrap();
    for case in 0..3 {
        let mut bad = p.clone();
        let Some(Writer::Quote {
            offer_hash,
            actor,
            customer_revision,
            ..
        }) = &mut bad.writer
        else {
            unreachable!()
        };
        match case {
            0 => *offer_hash = "b".repeat(64),
            1 => *actor = Uuid::nil(),
            _ => *customer_revision = 0,
        };
        let before = state.clone();
        assert!(prepare(&mut state, &bad).is_err());
        assert_eq!(state, before);
    }
    prepare(&mut state, &p).unwrap();
    confirm(&mut state, &p).unwrap();
}
fn prepare(state: &mut Guard, p: &Proposal) -> Result<()> {
    state.apply(&GuardEvent::FinancialTransaction {
        event: Box::new(Event::Prepare {
            proposal: Box::new(p.clone()),
        }),
    })
}
fn confirm(state: &mut Guard, p: &Proposal) -> Result<()> {
    state.apply(&GuardEvent::FinancialTransaction {
        event: Box::new(Event::Confirm {
            transaction: p.id,
            proposal_hash: p.digest()?,
        }),
    })
}
#[test]
fn group_members_prepare_and_confirm_atomically_and_historical_retries_never_rewind() {
    let (mut state, p) = fixture(2);
    prepare(&mut state, &p).unwrap();
    for s in &p.sources {
        assert!(state.sources.verify(&s.scope, &s.expected).is_err());
        assert_eq!(
            state.sources.scopes[&s.scope.key().unwrap()].pending,
            Some(s.transition.clone())
        );
        assert!(state.verify(s.scope.organization, None).is_err());
    }
    assert!(state.ingress.entry(&p.account).unwrap().pending.is_some());
    assert!(!state.transactions.groups[&p.id].committed);
    let pending = state.clone();
    let mut wrong = Event::Confirm {
        transaction: p.id,
        proposal_hash: "c".repeat(64),
    };
    assert!(state
        .apply(&GuardEvent::FinancialTransaction {
            event: Box::new(wrong.clone())
        })
        .is_err());
    assert_eq!(state, pending);
    for s in &p.sources {
        assert!(state
            .apply(&GuardEvent::FinancialSource {
                event: Box::new(source::Event::Commit {
                    scope: s.scope.clone(),
                    transition: p.id
                })
            })
            .is_err());
    }
    assert!(state
        .apply(&GuardEvent::Commit {
            organization: p.sources[0].scope.organization,
            transition_id: p.id
        })
        .is_err());
    let i = p.ingress.as_ref().unwrap();
    assert!(state
        .apply(&GuardEvent::FinancialIngress {
            event: Box::new(ingress::Event::Confirm {
                scope: p.account.clone(),
                transition: p.id,
                head: i.next.clone(),
                review: None
            })
        })
        .is_err());
    assert_eq!(state, pending);
    prepare(&mut state, &p).unwrap();
    assert_eq!(state, pending);
    confirm(&mut state, &p).unwrap();
    for s in &p.sources {
        state.sources.verify(&s.scope, &s.transition.next).unwrap();
    }
    for e in &p.enrollments {
        state
            .verify(e.organization, Some(&e.transition.state))
            .unwrap();
    }
    state.ingress.entry(&p.account).unwrap().ready().unwrap();
    let orgs = p
        .sources
        .iter()
        .map(|s| s.scope.organization)
        .collect::<Vec<_>>();
    let next = proposal(&state, &p.account, &orgs, true, true);
    prepare(&mut state, &next).unwrap();
    confirm(&mut state, &next).unwrap();
    let advanced = state.clone();
    prepare(&mut state, &p).unwrap();
    confirm(&mut state, &p).unwrap();
    assert_eq!(state, advanced);
    let mut changed = p.clone();
    changed.sources[0].transition.change_hash = "d".repeat(64);
    assert!(prepare(&mut state, &changed).is_err());
    let mut single = next.sources[0].transition.clone();
    single.id = p.id;
    single.next.revision += 1;
    assert!(state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Prepare {
                scope: next.sources[0].scope.clone(),
                expected: next.sources[0].transition.next.clone(),
                transition: single
            })
        })
        .is_err());
    wrong = Event::Confirm {
        transaction: Uuid::now_v7(),
        proposal_hash: p.digest().unwrap(),
    };
    assert!(state
        .apply(&GuardEvent::FinancialTransaction {
            event: Box::new(wrong)
        })
        .is_err());
    assert_eq!(state, advanced);
}
#[test]
fn group_invalid_last_member_leaves_no_partial_intent() {
    let (mut state, p) = fixture(2);
    let original = state.clone();
    let mut bad = p.clone();
    bad.enrollments[1].transition.state.revision = 2;
    assert!(prepare(&mut state, &bad).is_err());
    assert_eq!(state, original);
    bad = p.clone();
    bad.ingress.as_mut().unwrap().next.hash = "d".repeat(64);
    assert!(prepare(&mut state, &bad).is_err());
    assert_eq!(state, original);
    bad = p.clone();
    bad.sources[1].expected.hash = "e".repeat(64);
    assert!(prepare(&mut state, &bad).is_err());
    assert_eq!(state, original);
    assert!(state.transactions.groups.is_empty());
}
#[test]
fn group_scope_order_size_namespace_and_observation_are_strict() {
    let (state, p) = fixture(2);
    let mut cases = Vec::new();
    let mut bad = p.clone();
    bad.namespace = Uuid::now_v7();
    cases.push(bad);
    let mut bad = p.clone();
    bad.id = Uuid::nil();
    cases.push(bad);
    let mut bad = p.clone();
    bad.sources.swap(0, 1);
    cases.push(bad);
    let mut bad = p.clone();
    bad.sources[1] = bad.sources[0].clone();
    cases.push(bad);
    let mut bad = p.clone();
    bad.sources[0].scope.live = true;
    cases.push(bad);
    let mut bad = p.clone();
    bad.sources[0].scope.account = "acct_other".into();
    cases.push(bad);
    let mut bad = p.clone();
    bad.sources[0].transition.id = Uuid::now_v7();
    cases.push(bad);
    let mut bad = p.clone();
    bad.enrollments[0].organization = Uuid::now_v7();
    cases.push(bad);
    let mut bad = p.clone();
    bad.enrollments[0].transition.transition_id = Uuid::now_v7();
    cases.push(bad);
    let mut bad = p.clone();
    bad.ingress.as_mut().unwrap().receipt.transition = Uuid::now_v7();
    cases.push(bad);
    let mut bad = p.clone();
    bad.expected_ingress.hash = "e".repeat(64);
    cases.push(bad);
    let mut bad = p.clone();
    bad.observation_hash = "e".repeat(64);
    cases.push(bad);
    let mut bad = p.clone();
    bad.sources.clear();
    cases.push(bad);
    let mut bad = p.clone();
    bad.sources = vec![bad.sources[0].clone(); MAX_SOURCES + 1];
    cases.push(bad);
    let mut bad = p.clone();
    bad.observation_hash = "x".repeat(MAX_PROPOSAL_BYTES);
    cases.push(bad);
    for bad in cases {
        let mut current = state.clone();
        assert!(prepare(&mut current, &bad).is_err());
        assert_eq!(current, state);
    }
    let mut unknown = serde_json::to_value(&p).unwrap();
    unknown["prompt"] = serde_json::json!("PRIVATE_GROUP_MARKER");
    let error = serde_json::from_value::<Proposal>(unknown)
        .unwrap_err()
        .to_string();
    assert!(!error.contains("PRIVATE_GROUP_MARKER"));
}
#[test]
fn group_reserves_account_and_organizations_even_without_ingress_or_enrollment_changes() {
    let (mut state, p) = fixture(1);
    let org = p.sources[0].scope.organization;
    let second = ingress::Scope {
        account: "acct_second_group".into(),
        live: false,
    };
    state
        .apply(&GuardEvent::FinancialIngress {
            event: Box::new(ingress::Event::Seed {
                scope: second.clone(),
                receipts: vec![],
                review: Uuid::now_v7(),
                review_hash: "a".repeat(64),
            }),
        })
        .unwrap();
    let scope = source::Scope {
        organization: org,
        account: second.account.clone(),
        live: false,
    };
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Seed {
                head: source::Root::empty(&scope).unwrap(),
                scope: scope.clone(),
                review: source::Review {
                    id: Uuid::now_v7(),
                    kind: source::ReviewKind::ReviewedEmpty,
                    evidence_hash: "b".repeat(64),
                    reviewed_at: Utc::now(),
                },
                accepted: vec![],
            }),
        })
        .unwrap();
    let first = proposal(&state, &p.account, &[org], false, false);
    let competing = proposal(&state, &second, &[org], false, false);
    prepare(&mut state, &first).unwrap();
    assert!(state.transactions.require_account_free(&p.account).is_err());
    assert!(state.verify(org, None).is_err());
    let pending = state.clone();
    assert!(prepare(&mut state, &competing).is_err());
    assert_eq!(state, pending);
    assert!(state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Prepare {
                scope: scope.clone(),
                expected: competing.sources[0].expected.clone(),
                transition: competing.sources[0].transition.clone()
            })
        })
        .is_err());
    assert!(state
        .apply(&GuardEvent::Prepare {
            organization: org,
            expected: Head::Legacy,
            transition: Pending {
                transition_id: Uuid::now_v7(),
                state: Box::new(State::trial(10, Utc::now()).unwrap())
            }
        })
        .is_err());
    assert_eq!(state, pending);
    confirm(&mut state, &first).unwrap();
    state.verify(org, None).unwrap();
    state.transactions.require_account_free(&p.account).unwrap();
}
fn request() -> source::AcceptedRequest {
    source::AcceptedRequest {
        operation: Uuid::now_v7(),
        kind: source::OperationKind::CreateCustomer,
        actor: Uuid::now_v7(),
        request_hash: "e".repeat(64),
        idempotency_hash: "f".repeat(64),
        accepted_at: Utc::now(),
    }
}
fn outcome(request: &source::AcceptedRequest) -> source::Outcome {
    source::Outcome {
        id: Uuid::now_v7(),
        operation: request.operation,
        request_hash: request.request_hash.clone(),
        evidence_hash: "d".repeat(64),
        observed_at: Utc::now(),
        identity: Some(source::ProviderIdentity::Customer {
            customer: "cus_group_fixture".into(),
        }),
    }
}
#[test]
fn group_late_matching_outcome_is_retained_but_not_marked_applied() {
    let (mut state, mut p) = fixture(2);
    let r = request();
    p.sources[0].transition.accepted.push(r.clone());
    prepare(&mut state, &p).unwrap();
    let observed = outcome(&r);
    let scope = p.sources[0].scope.clone();
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Outcome {
                scope: scope.clone(),
                outcome: observed.clone(),
            }),
        })
        .unwrap();
    confirm(&mut state, &p).unwrap();
    let entry = &state.sources.scopes[&scope.key().unwrap()];
    assert_eq!(entry.outcomes[&observed.id], observed);
    assert!(entry.unapplied_outcomes.contains(&observed.id));
    assert!(state
        .sources
        .verify(&scope, &p.sources[0].transition.next)
        .is_err());
    assert!(state.transactions.groups[&p.id].committed);
}
#[test]
fn group_conflicting_outcome_ingress_conflict_or_closure_keeps_entire_group_pending() {
    for kind in 0..4 {
        let (mut state, mut p) = fixture(2);
        let r = request();
        p.sources[1].transition.accepted.push(r.clone());
        prepare(&mut state, &p).unwrap();
        match kind {
            0 => {
                let mut o = outcome(&r);
                o.request_hash = "a".repeat(64);
                state
                    .apply(&GuardEvent::FinancialSource {
                        event: Box::new(source::Event::Outcome {
                            scope: p.sources[1].scope.clone(),
                            outcome: o,
                        }),
                    })
                    .unwrap();
            }
            1 => {
                let mut n = p.ingress.as_ref().unwrap().receipt.notification.clone();
                n.payload_hash = "c".repeat(64);
                state
                    .apply(&GuardEvent::FinancialIngress {
                        event: Box::new(ingress::Event::Conflict {
                            scope: p.account.clone(),
                            notification: n,
                        }),
                    })
                    .unwrap();
            }
            2 => state
                .apply(&GuardEvent::Quarantine {
                    organization: p.sources[1].scope.organization,
                })
                .unwrap(),
            _ => state
                .apply(&GuardEvent::Delete {
                    organization: p.sources[1].scope.organization,
                })
                .unwrap(),
        }
        let before = state.clone();
        assert!(confirm(&mut state, &p).is_err());
        assert_eq!(state, before);
        assert!(!state.transactions.groups[&p.id].committed);
        assert!(state.transactions.require_account_free(&p.account).is_err());
        assert_eq!(
            state.sources.scopes[&p.sources[0].scope.key().unwrap()].head,
            Some(p.sources[0].expected.clone())
        );
    }
}
#[test]
fn group_no_ingress_member_still_rejects_account_conflict_at_confirmation() {
    let (mut state, p) = fixture(1);
    prepare(&mut state, &p).unwrap();
    confirm(&mut state, &p).unwrap();
    let org = p.sources[0].scope.organization;
    let next = proposal(&state, &p.account, &[org], false, false);
    prepare(&mut state, &next).unwrap();
    let mut n = p.ingress.unwrap().receipt.notification;
    n.payload_hash = "c".repeat(64);
    state
        .apply(&GuardEvent::FinancialIngress {
            event: Box::new(ingress::Event::Conflict {
                scope: next.account.clone(),
                notification: n,
            }),
        })
        .unwrap();
    let before = state.clone();
    assert!(confirm(&mut state, &next).is_err());
    assert_eq!(state, before);
}
#[test]
fn group_never_reuses_prior_standalone_enrollment_or_source_identity() {
    let (mut state, p) = fixture(1);
    let org = p.sources[0].scope.organization;
    let id = Uuid::now_v7();
    let single = Pending {
        transition_id: id,
        state: Box::new(State::trial(10, Utc::now()).unwrap()),
    };
    state
        .apply(&GuardEvent::Prepare {
            organization: org,
            expected: Head::Legacy,
            transition: single,
        })
        .unwrap();
    state
        .apply(&GuardEvent::Commit {
            organization: org,
            transition_id: id,
        })
        .unwrap();
    // Advance again so the reused ID is no longer the current enrollment head.
    let next = proposal(&state, &p.account, &[org], true, false);
    state
        .apply(&GuardEvent::Prepare {
            organization: org,
            expected: next.enrollments[0].expected.clone(),
            transition: next.enrollments[0].transition.clone(),
        })
        .unwrap();
    state
        .apply(&GuardEvent::Commit {
            organization: org,
            transition_id: next.id,
        })
        .unwrap();
    let mut reused = proposal(&state, &p.account, &[org], false, false);
    reused.id = id;
    reused.sources[0].transition.id = id;
    let before = state.clone();
    assert!(prepare(&mut state, &reused).is_err());
    assert_eq!(state, before);
}

#[test]
fn group_never_reuses_a_standalone_source_id_from_another_organization() {
    let (mut state, p) = fixture(2);
    let first = &p.sources[0];
    let id = Uuid::now_v7();
    let mut change = first.transition.clone();
    change.id = id;
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Prepare {
                scope: first.scope.clone(),
                expected: first.expected.clone(),
                transition: change,
            }),
        })
        .unwrap();
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Commit {
                scope: first.scope.clone(),
                transition: id,
            }),
        })
        .unwrap();
    let second = p.sources[1].scope.organization;
    let mut reused = proposal(&state, &p.account, &[second], false, false);
    reused.id = id;
    reused.sources[0].transition.id = id;
    let before = state.clone();
    assert!(prepare(&mut state, &reused).is_err());
    assert_eq!(state, before);
}

#[test]
fn group_resolution_is_explicit_has_no_new_creates_and_clears_only_named_outcomes() {
    let (mut state, mut p) = fixture(2);
    let request = request();
    p.sources[0].transition.accepted.push(request.clone());
    prepare(&mut state, &p).unwrap();
    confirm(&mut state, &p).unwrap();
    let scope = p.sources[0].scope.clone();
    let first = outcome(&request);
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Outcome {
                scope: scope.clone(),
                outcome: first.clone(),
            }),
        })
        .unwrap();
    let orgs = p
        .sources
        .iter()
        .map(|s| s.scope.organization)
        .collect::<Vec<_>>();
    let mut resolution = proposal(&state, &p.account, &orgs, false, false);
    let unchanged = state.clone();
    assert!(prepare(&mut state, &resolution).is_err());
    assert_eq!(state, unchanged);
    resolution.mode = Mode::ResolveOutcomes;
    assert!(prepare(&mut state, &resolution).is_err());
    resolution.sources[0]
        .transition
        .resolved_outcomes
        .insert(first.id);
    resolution.sources[1]
        .transition
        .accepted
        .push(super::tests::request());
    assert!(prepare(&mut state, &resolution).is_err());
    assert_eq!(state, unchanged);
    resolution.sources[1].transition.accepted.clear();
    prepare(&mut state, &resolution).unwrap();
    let later = outcome(&request);
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Outcome {
                scope: scope.clone(),
                outcome: later.clone(),
            }),
        })
        .unwrap();
    confirm(&mut state, &resolution).unwrap();
    let entry = &state.sources.scopes[&scope.key().unwrap()];
    assert!(!entry.unapplied_outcomes.contains(&first.id));
    assert!(entry.unapplied_outcomes.contains(&later.id));
    assert_eq!(entry.outcomes.len(), 2);
}

#[test]
fn group_identity_cannot_be_reused_by_bootstrap_seed_or_operator_review() {
    let (mut state, p) = fixture(1);
    prepare(&mut state, &p).unwrap();
    confirm(&mut state, &p).unwrap();
    let account = ingress::Scope {
        account: "acct_other_review".into(),
        live: false,
    };
    let now = DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).unwrap();
    let bootstrap = ingress::Bootstrap {
        plan: p.id,
        digest: "a".repeat(64),
        evidence_hash: "b".repeat(64),
        coverage_started_at: now,
    };
    let review = ingress::OperatorReview {
        id: p.id,
        scope: p.account.clone(),
        digest: "c".repeat(64),
        evidence_hash: "d".repeat(64),
        reviewed_at: now,
        kind: ingress::ReviewKind::PendingReceipt,
        target: p.id,
    };
    let events = [
        ingress::Event::PrepareBootstrap {
            scope: account.clone(),
            bootstrap,
        },
        ingress::Event::Seed {
            scope: account.clone(),
            receipts: vec![],
            review: p.id,
            review_hash: "a".repeat(64),
        },
        ingress::Event::Confirm {
            scope: p.account.clone(),
            transition: Uuid::now_v7(),
            head: state.ingress.entry(&p.account).unwrap().head.clone(),
            review: Some(review),
        },
    ];
    let before = state.clone();
    for event in events {
        assert_eq!(
            state
                .apply(&GuardEvent::FinancialIngress {
                    event: Box::new(event)
                })
                .unwrap_err()
                .to_string(),
            "financial_transaction_identity_reused"
        );
        assert_eq!(state, before);
    }
}

#[test]
fn group_rejects_legacy_seed_review_ids_in_the_reverse_direction() {
    let (state, p) = fixture(1);
    for id in [
        state.ingress.entry(&p.account).unwrap().review,
        state.sources.scopes[&p.sources[0].scope.key().unwrap()]
            .review
            .as_ref()
            .unwrap()
            .id,
    ] {
        let mut reused = p.clone();
        reused.id = id;
        for s in &mut reused.sources {
            s.transition.id = id;
        }
        for e in &mut reused.enrollments {
            e.transition.transition_id = id;
        }
        let mut receipt = reused.ingress.take().unwrap().receipt;
        receipt.transition = id;
        reused.ingress = Some(
            state
                .ingress
                .entry(&p.account)
                .unwrap()
                .propose(receipt)
                .unwrap(),
        );
        let mut current = state.clone();
        assert_eq!(
            prepare(&mut current, &reused).unwrap_err().to_string(),
            "financial_transaction_identity_reused"
        );
        assert_eq!(current, state);
    }
}

#[test]
fn group_account_freeze_outside_members_blocks_confirmation_and_normal_routing() {
    let (mut state, p) = fixture(2);
    let org = p.sources[0].scope.organization;
    let only = proposal(&state, &p.account, &[org], false, false);
    prepare(&mut state, &only).unwrap();
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Freeze {
                scope: p.sources[1].scope.clone(),
                reason: source::FreezeReason::OrganizationUnconfirmed,
            }),
        })
        .unwrap();
    let before = state.clone();
    assert!(confirm(&mut state, &only).is_err());
    assert_eq!(state, before);
    let (mut other, p) = fixture(2);
    let req = request();
    // Unknown operation in an unrelated source is retained/frozen; a normal
    // proposal may not bypass it merely by targeting the other organization.
    other
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Outcome {
                scope: p.sources[1].scope.clone(),
                outcome: outcome(&req),
            }),
        })
        .unwrap();
    let candidate = proposal(
        &other,
        &p.account,
        &[p.sources[0].scope.organization],
        false,
        false,
    );
    let before = other.clone();
    assert!(prepare(&mut other, &candidate).is_err());
    assert_eq!(other, before);
}

#[test]
fn group_retired_nonparticipant_does_not_stop_other_org_but_unknown_evidence_still_does() {
    let (mut state, p) = fixture(2);
    let retired = p.sources[1].scope.organization;
    state
        .apply(&GuardEvent::Delete {
            organization: retired,
        })
        .unwrap();
    let active = proposal(
        &state,
        &p.account,
        &[p.sources[0].scope.organization],
        false,
        false,
    );
    prepare(&mut state, &active).unwrap();
    confirm(&mut state, &active).unwrap();
    assert!(state.verify(retired, None).is_err());
    let req = request();
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Outcome {
                scope: p.sources[1].scope.clone(),
                outcome: outcome(&req),
            }),
        })
        .unwrap();
    let next = proposal(
        &state,
        &p.account,
        &[p.sources[0].scope.organization],
        false,
        false,
    );
    let before = state.clone();
    assert!(prepare(&mut state, &next).is_err());
    assert_eq!(state, before);
}

#[test]
fn group_customer_request_binds_exact_http_contract_before_acceptance() {
    let (mut state, mut p) = fixture(1);
    p.ingress = None;
    p.enrollments.clear();
    let scope = p.sources[0].scope.clone();
    let request = crate::services::team_stripe_customer_request::Request::new(
        scope.clone(),
        Uuid::now_v7(),
        Uuid::now_v7(),
    )
    .unwrap()
    .accepted(Utc::now())
    .unwrap();
    p.writer = Some(Writer::CustomerRequest {
        organization: scope.organization,
        request: request.clone(),
    });
    p.sources[0].transition.accepted = vec![request];
    p.sources[0].transition.change_hash = p
        .writer
        .as_ref()
        .unwrap()
        .change_hash(&p.account, &scope)
        .unwrap();
    for case in 0..5 {
        let mut bad = p.clone();
        match case {
            0 => bad.sources[0].transition.accepted.clear(),
            1 => bad.sources[0].transition.accepted[0].actor = Uuid::now_v7(),
            2 => bad.sources[0].transition.accepted[0].idempotency_hash = "f".repeat(64),
            3 => bad.sources[0].transition.accepted[0].accepted_at += chrono::Duration::seconds(1),
            _ => bad.sources[0].scope.organization = Uuid::now_v7(),
        }
        let before = state.clone();
        assert!(prepare(&mut state, &bad).is_err());
        assert_eq!(state, before);
    }
    prepare(&mut state, &p).unwrap();
    assert!(state.sources.scopes[&scope.key().unwrap()]
        .accepted
        .is_empty());
    confirm(&mut state, &p).unwrap();
    assert_eq!(
        state.sources.scopes[&scope.key().unwrap()].accepted.len(),
        1
    );
}

#[test]
fn customer_resolution_binds_exact_retained_evidence_and_never_clears_late_ids() {
    let (mut state, mut accept) = fixture(2);
    accept.ingress = None;
    accept.enrollments.clear();
    let scope = accept.sources[0].scope.clone();
    let request = crate::services::team_stripe_customer_request::Request::new(
        scope.clone(),
        Uuid::now_v7(),
        Uuid::now_v7(),
    )
    .unwrap()
    .accepted(Utc::now())
    .unwrap();
    accept.writer = Some(Writer::CustomerRequest {
        organization: scope.organization,
        request: request.clone(),
    });
    accept.sources[0].transition.accepted = vec![request.clone()];
    for s in &mut accept.sources {
        s.transition.change_hash = accept
            .writer
            .as_ref()
            .unwrap()
            .change_hash(&accept.account, &s.scope)
            .unwrap();
    }
    // Request writer has exactly one participant.
    accept.sources.truncate(1);
    accept.observation_hash =
        observation_hash(&state, &accept.account, &[scope.organization]).unwrap();
    prepare(&mut state, &accept).unwrap();
    confirm(&mut state, &accept).unwrap();
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Dispatch {
                scope: scope.clone(),
                dispatch: source::Dispatch {
                    operation: request.operation,
                    request_hash: request.request_hash.clone(),
                    idempotency_hash: request.idempotency_hash.clone(),
                    first_attempt_at: Utc::now(),
                },
            }),
        })
        .unwrap();
    let mut first = outcome(&request);
    first.evidence_hash = crate::services::team_stripe_customer_request::result_hash(
        &scope,
        request.operation,
        &first.identity,
        true,
    )
    .unwrap();
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Outcome {
                scope: scope.clone(),
                outcome: first.clone(),
            }),
        })
        .unwrap();
    let orgs = [scope.organization];
    let mut resolution = proposal(&state, &accept.account, &orgs, false, false);
    resolution.mode = Mode::ResolveOutcomes;
    resolution.writer = Some(Writer::CustomerResolution {
        organization: scope.organization,
        request: request.clone(),
        customer: "cus_group_fixture".into(),
        outcomes: [(first.id, fingerprint(&first).unwrap())].into(),
        expected_revision: 1,
        observed_at: Utc::now(),
        projection: CustomerProjection::Verified {
            lease: Uuid::now_v7(),
        },
    });
    resolution.sources[0]
        .transition
        .resolved_outcomes
        .insert(first.id);
    resolution.sources[0].transition.change_hash = resolution
        .writer
        .as_ref()
        .unwrap()
        .change_hash(&resolution.account, &scope)
        .unwrap();
    for case in 0..6 {
        let mut bad = resolution.clone();
        match case {
            0 => bad.mode = Mode::Normal,
            1 => bad.sources[0].transition.resolved_outcomes.clear(),
            2 => {
                if let Some(Writer::CustomerResolution { outcomes, .. }) = &mut bad.writer {
                    outcomes.insert(Uuid::now_v7(), "a".repeat(64));
                }
            }
            3 => {
                if let Some(Writer::CustomerResolution { customer, .. }) = &mut bad.writer {
                    *customer = "cus_other".into();
                }
            }
            4 => {
                if let Some(Writer::CustomerResolution { request, .. }) = &mut bad.writer {
                    request.actor = Uuid::now_v7();
                }
            }
            _ => {
                if let Some(Writer::CustomerResolution { outcomes, .. }) = &mut bad.writer {
                    outcomes.insert(first.id, "b".repeat(64));
                }
            }
        }
        // Recompute the declared writer digest so semantic checks, rather than
        // an accidentally stale digest, reject forged evidence/reference sets.
        bad.sources[0].transition.change_hash = bad
            .writer
            .as_ref()
            .unwrap()
            .change_hash(&bad.account, &scope)
            .unwrap();
        let before = state.clone();
        assert!(prepare(&mut state, &bad).is_err(), "case {case}");
        assert_eq!(state, before);
    }
    prepare(&mut state, &resolution).unwrap();
    let mut late = first.clone();
    late.id = Uuid::now_v7();
    state
        .apply(&GuardEvent::FinancialSource {
            event: Box::new(source::Event::Outcome {
                scope: scope.clone(),
                outcome: late.clone(),
            }),
        })
        .unwrap();
    confirm(&mut state, &resolution).unwrap();
    let entry = &state.sources.scopes[&scope.key().unwrap()];
    assert_eq!(entry.outcomes.len(), 2);
    assert!(!entry.unapplied_outcomes.contains(&first.id));
    assert!(entry.unapplied_outcomes.contains(&late.id));
}

#[test]
fn customer_recovery_authorization_retains_original_create_actor_and_rejects_forgery() {
    let (mut state, mut p) = fixture(1);
    p.ingress = None;
    p.enrollments.clear();
    let scope = p.sources[0].scope.clone();
    let request = crate::services::team_stripe_customer_request::Request::new(
        scope.clone(),
        Uuid::now_v7(),
        Uuid::now_v7(),
    )
    .unwrap()
    .accepted(Utc::now())
    .unwrap();
    p.writer = Some(Writer::CustomerRequest {
        organization: scope.organization,
        request: request.clone(),
    });
    p.sources[0].transition.accepted = vec![request.clone()];
    p.sources[0].transition.change_hash = p
        .writer
        .as_ref()
        .unwrap()
        .change_hash(&p.account, &scope)
        .unwrap();
    prepare(&mut state, &p).unwrap();
    confirm(&mut state, &p).unwrap();
    let mut next = proposal(&state, &p.account, &[scope.organization], false, false);
    let actor = Uuid::now_v7();
    next.writer = Some(Writer::CustomerRecoveryAuthorization {
        organization: scope.organization,
        request: request.clone(),
        actor,
        expected_revision: 2,
        authorized_at: Utc::now(),
    });
    next.sources[0].transition.change_hash = next
        .writer
        .as_ref()
        .unwrap()
        .change_hash(&p.account, &scope)
        .unwrap();
    for case in 0..6 {
        let mut bad = next.clone();
        if let Some(Writer::CustomerRecoveryAuthorization {
            request,
            actor,
            expected_revision,
            authorized_at,
            ..
        }) = &mut bad.writer
        {
            match case {
                0 => request.actor = Uuid::now_v7(),
                1 => *actor = Uuid::nil(),
                2 => *expected_revision = i64::MAX,
                3 => *authorized_at = request.accepted_at - chrono::Duration::seconds(1),
                4 => request.idempotency_hash = "a".repeat(64),
                _ => request.operation = Uuid::now_v7(),
            }
        }
        bad.sources[0].transition.change_hash = bad
            .writer
            .as_ref()
            .unwrap()
            .change_hash(&bad.account, &scope)
            .unwrap();
        let unchanged = state.clone();
        assert!(prepare(&mut state, &bad).is_err());
        assert_eq!(state, unchanged);
    }
    prepare(&mut state, &next).unwrap();
    confirm(&mut state, &next).unwrap();
    assert_eq!(
        state.sources.scopes[&scope.key().unwrap()].accepted[&request.operation],
        request
    );
    assert_ne!(request.actor, actor);
}

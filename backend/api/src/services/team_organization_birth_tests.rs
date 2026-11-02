//! Metadata-only independent-history regressions. Kept separate from SQL and
//! native verification; compile-checking these is not a behavioral test result.
use super::*;

fn fixture() -> (Snapshot, OrganizationBirth) {
    let mut state = Snapshot::default();
    let namespace = Uuid::now_v7();
    state
        .apply(&Event::Initialize {
            namespace,
            created_at: Utc::now(),
            legacy_organizations: vec![],
        })
        .unwrap();
    let birth = OrganizationBirth {
        schema: 1,
        namespace,
        organization: Uuid::now_v7(),
        creator: Uuid::now_v7(),
        intent: Uuid::now_v7(),
        creation: Uuid::now_v7(),
        audit: Uuid::now_v7(),
        created_at: DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).unwrap(),
        request_hash: "a".repeat(64),
    };
    (state, birth)
}
fn prepare(state: &mut Snapshot, birth: &OrganizationBirth) -> Result<()> {
    state.apply(&Event::PrepareOrganizationBirth {
        birth: Box::new(birth.clone()),
    })
}
fn confirm(state: &mut Snapshot, birth: &OrganizationBirth) -> Result<()> {
    state.apply(&Event::ConfirmOrganizationBirth {
        organization: birth.organization,
        creation: birth.creation,
        metadata_hash: birth.digest()?,
    })
}
#[test]
fn prepared_birth_is_not_trial_permission_and_confirmation_never_resets_enrollment() {
    let (mut s, b) = fixture();
    assert!(s.verify(b.organization, None).is_err());
    prepare(&mut s, &b).unwrap();
    assert!(s.verify(b.organization, None).is_err());
    let head = Head::FreshUnenrolled {
        creation: b.creation,
    };
    let trial = State::trial(10, b.created_at).unwrap();
    let proposed = Event::Prepare {
        organization: b.organization,
        expected: head.clone(),
        transition: Pending {
            transition_id: Uuid::now_v7(),
            state: Box::new(trial.clone()),
        },
    };
    assert!(s.apply(&proposed).is_err());
    confirm(&mut s, &b).unwrap();
    assert_eq!(s.verify(b.organization, None).unwrap(), head);
    assert!(s.verify(b.organization, Some(&trial)).is_err());
    s.apply(&proposed).unwrap();
    let id = s.organizations[&b.organization]
        .pending
        .as_ref()
        .unwrap()
        .transition_id;
    s.apply(&Event::Commit {
        organization: b.organization,
        transition_id: id,
    })
    .unwrap();
    assert!(s.verify(b.organization, Some(&trial)).is_ok());
    let enrolled = s.clone();
    prepare(&mut s, &b).unwrap();
    confirm(&mut s, &b).unwrap();
    assert_eq!(s, enrolled);
    assert!(s.verify(b.organization, None).is_err());
}
#[test]
fn birth_identity_and_namespace_cannot_be_reused_or_reclassified_legacy() {
    let (mut s, b) = fixture();
    let mut wrong = b.clone();
    wrong.namespace = Uuid::now_v7();
    assert!(prepare(&mut s, &wrong).is_err());
    prepare(&mut s, &b).unwrap();
    let before = s.clone();
    for reserved in b.reserved_ids() {
        assert!(s
            .apply(&Event::RegisterLegacy {
                organization: reserved
            })
            .is_err());
        let mut reused = b.clone();
        reused.organization = Uuid::now_v7();
        reused.creation = Uuid::now_v7();
        reused.audit = Uuid::now_v7();
        reused.intent = reserved;
        assert!(prepare(&mut s, &reused).is_err());
        assert_eq!(s, before);
    }
    wrong = b.clone();
    wrong.request_hash = "b".repeat(64);
    assert!(prepare(&mut s, &wrong).is_err());
    assert!(confirm(&mut s, &wrong).is_err());
    assert_eq!(s, before);
}
#[test]
fn late_birth_confirmation_cannot_reopen_closed_scope() {
    for deleted in [false, true] {
        let (mut s, b) = fixture();
        prepare(&mut s, &b).unwrap();
        s.apply(&if deleted {
            Event::Delete {
                organization: b.organization,
            }
        } else {
            Event::Quarantine {
                organization: b.organization,
            }
        })
        .unwrap();
        let closed = s.organizations[&b.organization].head.clone();
        confirm(&mut s, &b).unwrap();
        prepare(&mut s, &b).unwrap();
        assert_eq!(s.organizations[&b.organization].head, closed);
        assert!(s.verify(b.organization, None).is_err());
    }
}
#[test]
fn malformed_birth_metadata_and_unknown_event_schema_are_not_accepted() {
    let (_, b) = fixture();
    let mut wrong = b.clone();
    wrong.audit = wrong.creation;
    assert!(wrong.validate().is_err());
    wrong = b.clone();
    wrong.request_hash = "F".repeat(64);
    assert!(wrong.validate().is_err());
    let mut value = serde_json::to_value(&b).unwrap();
    value["prompt"] = serde_json::json!("forbidden-field");
    assert!(serde_json::from_value::<OrganizationBirth>(value).is_err());
    assert_eq!(
        serde_json::to_string(&Head::Legacy).unwrap(),
        "{\"kind\":\"legacy\"}"
    );
    assert!(serde_json::from_value::<Event>(
        serde_json::json!({"kind":"prepare_organization_birth","birth":b,"extra":true})
    )
    .is_err());
}

#[test]
fn reviewed_confirmation_preserves_original_birth_and_cannot_reopen_or_overwrite() {
    let (mut s, b) = fixture();
    prepare(&mut s, &b).unwrap();
    let review = super::super::team_organization_birth::BirthConfirmation {
        schema: 1,
        id: Uuid::now_v7(),
        organization: b.organization,
        creation: b.creation,
        actor: Uuid::now_v7(),
        birth_digest: b.digest().unwrap(),
        observation: "c".repeat(64),
        requested_at: b.created_at,
    };
    let event = Event::ConfirmOrganizationBirthReviewed {
        confirmation: Box::new(review.clone()),
    };
    s.apply(&event).unwrap();
    assert_eq!(s.births[&b.organization].birth, b);
    assert_eq!(
        s.births[&b.organization].confirmations.get(&review.id),
        Some(&review)
    );
    assert!(s.verify(b.organization, None).is_ok());
    let confirmed = s.clone();
    s.apply(&event).unwrap();
    assert_eq!(s, confirmed);
    let mut changed = review.clone();
    changed.actor = Uuid::now_v7();
    assert!(s
        .apply(&Event::ConfirmOrganizationBirthReviewed {
            confirmation: Box::new(changed)
        })
        .is_err());
    assert_eq!(s, confirmed);
    s.apply(&Event::Quarantine {
        organization: b.organization,
    })
    .unwrap();
    let closed = s.clone();
    assert!(s.apply(&event).is_err());
    assert_eq!(s, closed);
}

#[test]
fn recovery_tag_cannot_fall_through_to_creation_or_accept_a_client_actor() {
    use crate::model::organization::CreateOrganizationRequest;
    let org = Uuid::now_v7();
    assert!(serde_json::from_value::<CreateOrganizationRequest>(
        serde_json::json!({"name":"Synthetic workspace"})
    )
    .is_ok());
    assert!(serde_json::from_value::<CreateOrganizationRequest>(
        serde_json::json!({"action":"inspect_birth","organization_id":org})
    )
    .is_ok());
    for action in ["inspect_birth", "confirm_birth", "unsupported"] {
        assert!(serde_json::from_value::<CreateOrganizationRequest>(serde_json::json!({"action":action,"name":"must not create","organization_id":org,"actor":Uuid::now_v7()})).is_err());
    }
}

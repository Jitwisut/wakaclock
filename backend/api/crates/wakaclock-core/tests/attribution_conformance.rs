use serde::Deserialize;
use std::str::FromStr;
use wakaclock_core::ai::is_known_agent_id;
use wakaclock_core::heartbeat::{resolve_attribution, ActorType, AttributionInput};

const FIXTURE: &str = include_str!("../../../../../fixtures/ai-attribution/decision-v1.json");

#[derive(Debug, Deserialize)]
struct Fixture {
    schema_version: u8,
    contract: String,
    cases: Vec<Case>,
}

#[derive(Debug, Deserialize)]
struct Case {
    id: String,
    input: Input,
    expected: Expected,
}

#[derive(Debug, Default, Deserialize)]
struct Input {
    explicit_actor_type: Option<String>,
    explicit_confidence: Option<f32>,
    legacy_is_ai_generated: Option<bool>,
    ai_agent: Option<String>,
    known_agent_id: Option<bool>,
    ai_source: Option<String>,
    ai_confidence: Option<String>,
    ai_event_id: Option<String>,
    ai_lines_added: Option<u32>,
    ai_lines_deleted: Option<u32>,
    human_lines_added: Option<u32>,
    human_lines_deleted: Option<u32>,
    unattributed_lines_added: Option<u32>,
    unattributed_lines_deleted: Option<u32>,
    keystrokes: Option<u32>,
    chars_added: Option<u32>,
    chars_deleted: Option<u32>,
    positive_editor_evidence: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Expected {
    kind: String,
    actor_type: Option<String>,
    confidence: Option<f32>,
}

#[test]
fn shared_decision_fixture_matches_rust_resolver() {
    let fixture: Fixture = serde_json::from_str(FIXTURE).expect("decision fixture must parse");
    assert_eq!(fixture.schema_version, 1);
    assert_eq!(fixture.contract, "canonical_attribution_decision");
    assert!(!fixture.cases.is_empty());

    for case in fixture.cases {
        let named_agent_evidence = case
            .input
            .ai_agent
            .as_deref()
            .is_some_and(|agent| !agent.trim().is_empty() && is_known_agent_id(agent));
        if let Some(declared) = case.input.known_agent_id {
            assert_eq!(
                named_agent_evidence, declared,
                "fixture known-agent declaration drifted for {}",
                case.id
            );
        }

        let explicit_actor_type = case
            .input
            .explicit_actor_type
            .as_deref()
            .map(ActorType::from_str)
            .transpose()
            .unwrap_or_else(|error| panic!("invalid actor type in {}: {error}", case.id));
        let result = resolve_attribution(AttributionInput {
            explicit_actor_type,
            explicit_confidence: case.input.explicit_confidence,
            legacy_is_ai_generated: case.input.legacy_is_ai_generated,
            ai_agent: case.input.ai_agent.as_deref(),
            ai_source: case.input.ai_source.as_deref(),
            ai_confidence: case.input.ai_confidence.as_deref(),
            ai_event_id: case.input.ai_event_id.as_deref(),
            ai_lines_added: case.input.ai_lines_added,
            ai_lines_deleted: case.input.ai_lines_deleted,
            human_lines_added: case.input.human_lines_added,
            human_lines_deleted: case.input.human_lines_deleted,
            unattributed_lines_added: case.input.unattributed_lines_added,
            unattributed_lines_deleted: case.input.unattributed_lines_deleted,
            keystrokes: case.input.keystrokes,
            chars_added: case.input.chars_added,
            chars_deleted: case.input.chars_deleted,
            positive_editor_evidence: case.input.positive_editor_evidence.unwrap_or(false),
        });

        match case.expected.kind.as_str() {
            "rejected" => assert!(result.is_err(), "{} should be rejected", case.id),
            "resolved" => {
                let resolved = result.unwrap_or_else(|error| {
                    panic!("{} should resolve, got rejection: {error}", case.id)
                });
                let expected_actor = case
                    .expected
                    .actor_type
                    .as_deref()
                    .and_then(|value| ActorType::from_str(value).ok())
                    .unwrap_or_else(|| panic!("{} needs an expected actor", case.id));
                assert_eq!(resolved.actor_type, expected_actor, "actor for {}", case.id);
                let expected_confidence = case
                    .expected
                    .confidence
                    .unwrap_or_else(|| panic!("{} needs expected confidence", case.id));
                assert!(
                    (resolved.confidence - expected_confidence).abs() < 0.000_01,
                    "confidence for {}: got {}, expected {}",
                    case.id,
                    resolved.confidence,
                    expected_confidence
                );
            }
            other => panic!("unsupported expected result kind {other} in {}", case.id),
        }
    }
}

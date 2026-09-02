//! plan-phase8.md p8.1 — evidence intake.
//!
//! Every producer shape → one [`CorrelationInput`]. The correlation engine sees
//! a single normalised record type; this module is the only place that knows how
//! each producer stamps its fields.
//!
//! Metadata only, and it **never guesses**: a producer record missing a field it
//! needs (an entity path) is dropped with a bounded, content-free
//! [`IntakeDrop`], not patched with an invented value —
//! `RAW_FILE_CHANGE_WITHOUT_PROVENANCE != HUMAN` starts here.

use std::path::Path;

use chrono::{DateTime, Utc};

use crate::ai::correlation_engine::{CorrelationInput, EvidenceKind};
use crate::ai::event::AiEventSource;
use crate::ai::filesystem_observer::{FileChangeKind, FileChangedEvent};
use crate::ai::session::SessionProcessEvidence;
use crate::broker::{BrokerChangeKind, BrokerEventType, BrokerEventV1, TransportKind};

/// Why a producer record could not become a [`CorrelationInput`]. The producer's
/// own id and a coarse reason only — never any of the payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IntakeDrop {
    pub lineage_id: String,
    pub reason: IntakeDropReason,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntakeDropReason {
    /// No entity path on the record.
    NoEntity,
    /// A broker event that is not a file change (e.g. a session lifecycle event).
    NotAFileChange,
}

/// The outcome of mapping a batch of producer records for one correlation pass.
#[derive(Debug, Default)]
pub struct IntakeBatch {
    pub inputs: Vec<CorrelationInput>,
    pub drops: Vec<IntakeDrop>,
}

impl IntakeBatch {
    fn keep(&mut self, input: CorrelationInput) {
        self.inputs.push(input);
    }

    fn dropped(&mut self, lineage_id: impl Into<String>, reason: IntakeDropReason) {
        self.drops.push(IntakeDrop {
            lineage_id: lineage_id.into(),
            reason,
        });
    }
}

fn non_empty(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then_some(trimmed)
}

/// Map one normalised broker event — a native hook, an MCP write, a completed
/// transcript tool call, or a before/after tool snapshot.
pub fn from_broker_event(event: &BrokerEventV1, batch: &mut IntakeBatch) {
    if !matches!(event.event_type, BrokerEventType::FileChange) {
        batch.dropped(event.event_id.clone(), IntakeDropReason::NotAFileChange);
        return;
    }
    let Some(entity) = non_empty(&event.entity) else {
        batch.dropped(event.event_id.clone(), IntakeDropReason::NoEntity);
        return;
    };

    let mut input = CorrelationInput::new(
        event.event_id.clone(),
        broker_evidence_kind(event),
        entity,
        event.occurred_at,
    )
    .with_agent(event.agent.clone())
    .with_change_kind(event.change_kind)
    .with_confidence(event.confidence.clone());

    if let Some(root) = event.project_root.as_deref().and_then(non_empty) {
        input = input.with_workspace(root);
    }
    if let Some(id) = event.session_id.as_deref().and_then(non_empty) {
        input = input.with_session_id(id);
    }
    if let Some(id) = event.tool_event_id.as_deref().and_then(non_empty) {
        input = input.with_tool_event_id(id);
    }
    batch.keep(input);
}

/// Which [`EvidenceKind`] a broker event's transport maps to. Falls back to the
/// `source` field when the free-text transport does not place it precisely.
fn broker_evidence_kind(event: &BrokerEventV1) -> EvidenceKind {
    match TransportKind::classify(event.transport.as_deref()) {
        TransportKind::NativePlugin => EvidenceKind::NativeHook,
        TransportKind::Mcp => EvidenceKind::StructuredMcp,
        TransportKind::Transcript => EvidenceKind::CompletedTranscriptToolCall,
        TransportKind::ToolSnapshot => EvidenceKind::ToolSnapshot,
        TransportKind::Filesystem => EvidenceKind::FilesystemObserver,
        TransportKind::Editor => EvidenceKind::EditorInput,
        TransportKind::Cli | TransportKind::Other => match event.source {
            AiEventSource::AgentHook => EvidenceKind::NativeHook,
            AiEventSource::Mcp => EvidenceKind::StructuredMcp,
            AiEventSource::Transcript => EvidenceKind::CompletedTranscriptToolCall,
            AiEventSource::IdeTelemetry => EvidenceKind::EditorInput,
        },
    }
}

/// Map one filesystem-observer change. On its own this is only
/// `FileChangedWithoutSufficientProvenance` — an agent session or a native hook
/// for the same entity is what the engine correlates it with.
pub fn from_file_change(
    event: &FileChangedEvent,
    workspace: Option<&Path>,
    lineage_id: impl Into<String>,
    fingerprint: Option<String>,
    batch: &mut IntakeBatch,
) {
    let lineage_id = lineage_id.into();
    let Some(entity) = event.path.to_str().and_then(non_empty) else {
        batch.dropped(lineage_id, IntakeDropReason::NoEntity);
        return;
    };

    let mut input = CorrelationInput::new(
        lineage_id,
        EvidenceKind::FilesystemObserver,
        entity,
        event.observed_at,
    )
    .with_change_kind(match event.kind {
        FileChangeKind::Created => BrokerChangeKind::Create,
        FileChangeKind::Modified => BrokerChangeKind::Modify,
        FileChangeKind::Removed => BrokerChangeKind::Delete,
    });
    if let Some(ws) = workspace {
        input = input.with_workspace(ws);
    }
    if let Some(fp) = fingerprint {
        input = input.with_fingerprint(fp);
    }
    batch.keep(input);
}

/// Map one session/process observation against a file it may have changed. The
/// engine — not this function — decides via `evidence_strength` whether the
/// session is strong enough to infer (planai2.md §5: process name alone is not).
pub fn from_session_evidence(
    session: &SessionProcessEvidence,
    entity: &str,
    occurred_at: DateTime<Utc>,
    lineage_id: impl Into<String>,
    batch: &mut IntakeBatch,
) {
    let lineage_id = lineage_id.into();
    let Some(entity) = non_empty(entity) else {
        batch.dropped(lineage_id, IntakeDropReason::NoEntity);
        return;
    };

    let mut input = CorrelationInput::new(
        lineage_id,
        EvidenceKind::SessionProcessObserver,
        entity,
        occurred_at,
    )
    .with_agent(session.agent.clone())
    .with_evidence_strength(session.strength);

    if let Some(ws) = session.workspace.as_deref() {
        input = input.with_workspace(ws);
    }
    if let Some(id) = session.session_id.as_deref().and_then(non_empty) {
        input = input.with_session_id(id);
    }
    if let Some(id) = session.tool_event_id.as_deref().and_then(non_empty) {
        input = input.with_tool_event_id(id);
    }
    batch.keep(input);
}

/// Map one positive editor-input observation — a buffered editor change or a
/// save the editor sidecar recorded. This is the only `human` predicate in §5.
pub fn from_editor_input(
    entity: &str,
    workspace: Option<&Path>,
    occurred_at: DateTime<Utc>,
    lineage_id: impl Into<String>,
    batch: &mut IntakeBatch,
) {
    let lineage_id = lineage_id.into();
    let Some(entity) = non_empty(entity) else {
        batch.dropped(lineage_id, IntakeDropReason::NoEntity);
        return;
    };

    let mut input =
        CorrelationInput::new(lineage_id, EvidenceKind::EditorInput, entity, occurred_at);
    if let Some(ws) = workspace {
        input = input.with_workspace(ws);
    }
    batch.keep(input);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::event::AiConfidence;
    use crate::ai::session::EvidenceStrength;
    use crate::broker::{BrokerEventType, BROKER_SCHEMA_VERSION};

    fn hook_event() -> BrokerEventV1 {
        BrokerEventV1 {
            schema_version: BROKER_SCHEMA_VERSION,
            producer_version: Some(1),
            event_type: BrokerEventType::FileChange,
            event_id: "hook-1".to_string(),
            occurred_at: Utc::now(),
            entity: "/ws/src/lib.rs".to_string(),
            project_root: Some("/ws".to_string()),
            change_kind: BrokerChangeKind::Modify,
            previous_entity: None,
            agent: "claude-code".to_string(),
            provider: None,
            model: None,
            session_id: Some("s-1".to_string()),
            source: AiEventSource::AgentHook,
            confidence: AiConfidence::Verified,
            actor_type: None,
            actor_confidence: None,
            lines_added: Some(3),
            lines_deleted: Some(0),
            active_seconds: Some(1.0),
            transport: Some("native_plugin".to_string()),
            tool: Some("Edit".to_string()),
            tool_event_id: Some("t-1".to_string()),
        }
    }

    fn fs_event() -> FileChangedEvent {
        FileChangedEvent {
            path: "/ws/src/lib.rs".into(),
            kind: FileChangeKind::Modified,
            observed_at: Utc::now(),
        }
    }

    fn session() -> SessionProcessEvidence {
        SessionProcessEvidence {
            agent: "cursor".to_string(),
            provider: None,
            pid: 42,
            ppid: None,
            process_identity: "cursor".to_string(),
            workspace: Some("/ws".into()),
            session_id: Some("cur-1".to_string()),
            tool_event_id: None,
            started_at: Utc::now(),
            last_activity_at: Utc::now(),
            ended_at: None,
            strength: EvidenceStrength::ProcessTreeCwdMatch,
        }
    }

    #[test]
    fn every_producer_shape_maps_to_a_correlation_input_with_its_lineage() {
        let mut batch = IntakeBatch::default();
        from_broker_event(&hook_event(), &mut batch);
        from_file_change(
            &fs_event(),
            Some(Path::new("/ws")),
            "fs-1",
            Some("caf1:abcd".to_string()),
            &mut batch,
        );
        from_session_evidence(
            &session(),
            "/ws/src/lib.rs",
            Utc::now(),
            "sess-1",
            &mut batch,
        );
        from_editor_input(
            "/ws/src/lib.rs",
            Some(Path::new("/ws")),
            Utc::now(),
            "ed-1",
            &mut batch,
        );

        assert!(batch.drops.is_empty());
        let kinds: Vec<_> = batch.inputs.iter().map(|i| i.kind).collect();
        assert_eq!(
            kinds,
            vec![
                EvidenceKind::NativeHook,
                EvidenceKind::FilesystemObserver,
                EvidenceKind::SessionProcessObserver,
                EvidenceKind::EditorInput,
            ]
        );
        let lineage: Vec<_> = batch.inputs.iter().map(|i| i.lineage_id.as_str()).collect();
        assert_eq!(lineage, vec!["hook-1", "fs-1", "sess-1", "ed-1"]);
        // The engine's own strength gate depends on this being carried through.
        assert_eq!(
            batch.inputs[2].evidence_strength,
            Some(EvidenceStrength::ProcessTreeCwdMatch)
        );
        assert_eq!(batch.inputs[1].fingerprint.as_deref(), Some("caf1:abcd"));
    }

    #[test]
    fn transport_drives_the_evidence_kind_with_a_source_fallback() {
        let mut batch = IntakeBatch::default();
        let mut mcp = hook_event();
        mcp.transport = Some("mcp_bridge".to_string());
        from_broker_event(&mcp, &mut batch);

        let mut transcript = hook_event();
        transcript.transport = None;
        transcript.source = AiEventSource::Transcript;
        from_broker_event(&transcript, &mut batch);

        assert_eq!(batch.inputs[0].kind, EvidenceKind::StructuredMcp);
        assert_eq!(
            batch.inputs[1].kind,
            EvidenceKind::CompletedTranscriptToolCall
        );
    }

    #[test]
    fn an_intake_record_carries_no_content_field() {
        let mut batch = IntakeBatch::default();
        from_broker_event(&hook_event(), &mut batch);
        let json = serde_json::to_string(&batch.inputs[0]).unwrap();
        for forbidden in [
            "\"content",
            "\"diff",
            "\"patch",
            "\"prompt",
            "\"source_code",
            "\"text\"",
            "\"body\"",
            "argv",
            "clipboard",
        ] {
            assert!(!json.contains(forbidden), "leaked {forbidden}: {json}");
        }
    }

    #[test]
    fn a_malformed_producer_record_is_dropped_not_guessed() {
        let mut batch = IntakeBatch::default();

        let mut no_entity = hook_event();
        no_entity.entity = "   ".to_string();
        from_broker_event(&no_entity, &mut batch);

        from_editor_input("", None, Utc::now(), "ed-blank", &mut batch);
        from_session_evidence(&session(), "", Utc::now(), "sess-blank", &mut batch);

        assert!(batch.inputs.is_empty());
        assert_eq!(
            batch.drops,
            vec![
                IntakeDrop {
                    lineage_id: "hook-1".to_string(),
                    reason: IntakeDropReason::NoEntity
                },
                IntakeDrop {
                    lineage_id: "ed-blank".to_string(),
                    reason: IntakeDropReason::NoEntity
                },
                IntakeDrop {
                    lineage_id: "sess-blank".to_string(),
                    reason: IntakeDropReason::NoEntity
                },
            ]
        );
    }

    #[test]
    fn a_non_file_change_broker_event_is_dropped() {
        // Every current BrokerEventType is FileChange; guard the mapping anyway so
        // a future lifecycle event can never silently become a file verdict.
        let event = hook_event();
        assert!(matches!(event.event_type, BrokerEventType::FileChange));
        let mut batch = IntakeBatch::default();
        from_broker_event(&event, &mut batch);
        assert_eq!(batch.inputs.len(), 1);
        assert!(batch.drops.is_empty());
    }
}

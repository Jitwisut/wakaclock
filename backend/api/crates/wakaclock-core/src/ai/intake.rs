//! Production evidence intake for the universal attribution engine.
//!
//! Every producer has a slightly different envelope (`BrokerEventV1`, filesystem
//! notifications, process/session observations, or editor observations).  The
//! correlation engine deliberately accepts only one shape.  This module is the
//! narrow, metadata-only bridge between those producers and the engine.  It never
//! reads file contents and it never invents a missing identity; malformed records
//! are returned as bounded diagnostics so callers can drop them safely.

use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ai::correlation::EditorObservation;
use crate::ai::correlation_engine::{CorrelationInput, EvidenceKind, SystemActorKind};
use crate::ai::event::{AiConfidence, AiEventSource};
use crate::ai::filesystem_observer::{FileChangeKind, FileChangedEvent};
use crate::ai::path::normalize_lexical;
use crate::ai::session::SessionProcessEvidence;
use crate::broker::{BrokerChangeKind, BrokerEventV1, TransportKind};

const MAX_DIAGNOSTIC_BYTES: usize = 160;

/// A safe, bounded reason why one producer record could not enter the engine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IntakeDiagnostic {
    pub producer: String,
    pub reason: String,
}

impl IntakeDiagnostic {
    fn new(producer: impl Into<String>, reason: impl Into<String>) -> Self {
        let mut reason = reason.into();
        if reason.len() > MAX_DIAGNOSTIC_BYTES {
            reason.truncate(MAX_DIAGNOSTIC_BYTES);
        }
        Self {
            producer: producer.into(),
            reason,
        }
    }
}

/// Result of converting a mixed producer batch.  Inputs preserve producer order;
/// diagnostics preserve the order in which malformed records were encountered.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct IntakeBatch {
    pub inputs: Vec<CorrelationInput>,
    pub diagnostics: Vec<IntakeDiagnostic>,
}

impl IntakeBatch {
    pub fn push_result(&mut self, result: Result<CorrelationInput, IntakeDiagnostic>) {
        match result {
            Ok(input) => self.inputs.push(input),
            Err(diagnostic) => self.diagnostics.push(diagnostic),
        }
    }
}

/// Convert one durable broker event into the common correlation shape.
pub fn from_broker_event(event: &BrokerEventV1) -> Result<CorrelationInput, IntakeDiagnostic> {
    let entity = absolute_entity("broker", &event.entity)?;
    let workspace = event
        .project_root
        .as_deref()
        .map(|root| absolute_entity("broker.project_root", root))
        .transpose()?;

    let kind = evidence_kind_for_event(event).ok_or_else(|| {
        IntakeDiagnostic::new(
            "broker",
            "event transport/source does not map to a supported evidence kind",
        )
    })?;

    let mut input = CorrelationInput::new(event.event_id.clone(), kind, entity, event.occurred_at)
        .with_confidence(event.confidence.clone());
    if let Some(root) = workspace {
        input.workspace = Some(root);
    }
    input.agent = Some(event.agent.clone());
    input.change_kind = Some(event.change_kind);
    input.session_id = event.session_id.clone();
    input.tool_event_id = event.tool_event_id.clone();
    input.fingerprint = event.payload_hash().ok();
    input.system_actor = system_actor_for_tool(event.tool.as_deref());
    Ok(input)
}

/// Convert a filesystem notification.  `agent` and `session_id` are optional
/// corroborating hints supplied by the caller's process/session ledger; they are
/// intentionally not inferred here from a file name.
pub fn from_file_change(
    event: &FileChangedEvent,
    workspace: &Path,
    agent: Option<&str>,
    session_id: Option<&str>,
    fingerprint: Option<String>,
) -> Result<CorrelationInput, IntakeDiagnostic> {
    let workspace = absolute_path("filesystem.workspace", workspace)?;
    let entity = absolute_path("filesystem", &event.path)?;
    if !entity.starts_with(&workspace) {
        return Err(IntakeDiagnostic::new(
            "filesystem",
            "changed path is outside the registered workspace",
        ));
    }
    let mut input = CorrelationInput::new(
        file_change_lineage(event),
        EvidenceKind::FilesystemObserver,
        entity,
        event.observed_at,
    )
    .with_workspace(workspace)
    .with_change_kind(file_change_kind(event.kind));
    if let Some(agent) = agent.filter(|value| !value.trim().is_empty()) {
        input.agent = Some(agent.to_string());
    }
    if let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) {
        input.session_id = Some(session_id.to_string());
    }
    input.fingerprint = fingerprint;
    Ok(input)
}

/// Convert session/process evidence for one changed entity.  A process scan is
/// workspace-scoped, so the caller supplies the file that is being evaluated; the
/// evidence strength remains attached and the engine still rejects name-only scans.
pub fn from_session_evidence(
    evidence: &SessionProcessEvidence,
    entity: &Path,
    occurred_at: DateTime<Utc>,
) -> Result<CorrelationInput, IntakeDiagnostic> {
    let entity = absolute_path("session", entity)?;
    let workspace = evidence
        .workspace
        .as_deref()
        .map(|root| absolute_path("session.workspace", root))
        .transpose()?;
    let mut input = CorrelationInput::new(
        session_lineage(evidence),
        EvidenceKind::SessionProcessObserver,
        entity,
        occurred_at,
    )
    .with_agent(evidence.agent.clone())
    .with_confidence(AiConfidence::Inferred)
    .with_evidence_strength(evidence.strength);
    if let Some(root) = workspace {
        input.workspace = Some(root);
    }
    input.session_id = evidence.session_id.clone();
    input.tool_event_id = evidence.tool_event_id.clone();
    Ok(input)
}

/// Convert an editor observation into one positive editor input per observed
/// window.  The engine uses the window timestamps for conflict/human decisions;
/// line counters stay metadata-only and are not copied into the wire heartbeat.
pub fn from_editor_observation(
    observation: &EditorObservation,
) -> Result<CorrelationInput, IntakeDiagnostic> {
    let entity = absolute_path("editor", &observation.entity)?;
    let mut input = CorrelationInput::new(
        format!(
            "editor:{}:{}",
            entity.display(),
            observation.window_end.timestamp_millis()
        ),
        EvidenceKind::EditorInput,
        entity,
        observation.window_end,
    )
    .with_confidence(AiConfidence::Unknown);
    input.workspace = observation
        .project_root
        .as_deref()
        .map(|root| absolute_path("editor.project_root", root))
        .transpose()?;
    Ok(input)
}

/// Convert all broker events in one bounded pass.  The caller may then append
/// filesystem/session/editor inputs with the same `IntakeBatch`.
pub fn to_correlation_inputs(events: &[BrokerEventV1]) -> IntakeBatch {
    let mut batch = IntakeBatch::default();
    for event in events {
        batch.push_result(from_broker_event(event));
    }
    batch
}

fn evidence_kind_for_event(event: &BrokerEventV1) -> Option<EvidenceKind> {
    match event.transport_kind() {
        TransportKind::NativePlugin => Some(EvidenceKind::NativeHook),
        TransportKind::Mcp => Some(EvidenceKind::StructuredMcp),
        TransportKind::Transcript => Some(EvidenceKind::CompletedTranscriptToolCall),
        TransportKind::ToolSnapshot => Some(EvidenceKind::ToolSnapshot),
        TransportKind::Filesystem => Some(EvidenceKind::FilesystemObserver),
        TransportKind::Editor => Some(EvidenceKind::EditorInput),
        // A bare CLI/unknown event does not establish a producer kind. Dropping it
        // from universal correlation is safer than upgrading weak metadata.
        TransportKind::Cli | TransportKind::Other => match event.source {
            AiEventSource::AgentHook => Some(EvidenceKind::NativeHook),
            AiEventSource::Mcp => Some(EvidenceKind::StructuredMcp),
            AiEventSource::Transcript => Some(EvidenceKind::CompletedTranscriptToolCall),
            AiEventSource::IdeTelemetry => None,
        },
    }
}

fn system_actor_for_tool(tool: Option<&str>) -> Option<SystemActorKind> {
    let tool = tool?.trim().to_ascii_lowercase();
    let matches_any = |terms: &[&str]| terms.iter().any(|term| tool.contains(term));
    if matches_any(&[
        "prettier",
        "rustfmt",
        "gofmt",
        "black",
        "formatter",
        "format",
    ]) {
        Some(SystemActorKind::Formatter)
    } else if matches_any(&["build", "compiler", "tsc", "webpack", "bundler"]) {
        Some(SystemActorKind::Build)
    } else if matches_any(&[
        "git_checkout",
        "git-checkout",
        "git checkout",
        "git_merge",
        "git-merge",
        "rebase",
        "stash",
    ]) {
        Some(SystemActorKind::VersionControl)
    } else if matches_any(&["codegen", "protobuf", "openapi", "orm"]) {
        Some(SystemActorKind::Codegen)
    } else {
        None
    }
}

fn file_change_kind(kind: FileChangeKind) -> BrokerChangeKind {
    match kind {
        FileChangeKind::Created => BrokerChangeKind::Create,
        FileChangeKind::Modified => BrokerChangeKind::Modify,
        FileChangeKind::Removed => BrokerChangeKind::Delete,
    }
}

fn file_change_lineage(event: &FileChangedEvent) -> String {
    // The path is kept only as input to a local UUID; it is not exposed as a
    // lineage identity on the wire.  This gives repeated notify events a stable,
    // opaque identity while preserving per-file separation.
    crate::ai::event::opaque_file_event_id(
        "fs1",
        &format!(
            "{}:{}",
            event.observed_at.timestamp_millis(),
            event.kind as u8
        ),
        &event.path.to_string_lossy(),
    )
}

fn session_lineage(evidence: &SessionProcessEvidence) -> String {
    format!(
        "session:{}:{}",
        evidence.agent,
        evidence.session_id.as_deref().unwrap_or("pid")
    )
}

fn absolute_entity(producer: &str, value: &str) -> Result<PathBuf, IntakeDiagnostic> {
    absolute_path(producer, Path::new(value))
}

fn absolute_path(producer: &str, path: &Path) -> Result<PathBuf, IntakeDiagnostic> {
    if !path.is_absolute() {
        return Err(IntakeDiagnostic::new(
            producer,
            "entity/workspace path must be absolute",
        ));
    }
    Ok(normalize_lexical(path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::event::{AiConfidence, AiEventSource};
    use crate::ai::session::EvidenceStrength;
    use crate::broker::{BrokerChangeKind, BrokerEventType, BROKER_SCHEMA_VERSION};

    fn broker_event(transport: Option<&str>) -> BrokerEventV1 {
        BrokerEventV1 {
            schema_version: BROKER_SCHEMA_VERSION,
            producer_version: None,
            event_type: BrokerEventType::FileChange,
            event_id: "event-1".to_string(),
            occurred_at: DateTime::from_timestamp(1_700_000_000, 0).unwrap(),
            entity: "/workspace/src/main.rs".to_string(),
            project_root: Some("/workspace".to_string()),
            change_kind: BrokerChangeKind::Modify,
            previous_entity: None,
            agent: "codex".to_string(),
            provider: Some("openai".to_string()),
            model: None,
            session_id: Some("session-1".to_string()),
            turn_id: None,
            identity_message_id: None,
            identity_status: None,
            identity_reason: None,
            identity_source: None,
            producer_surface: None,
            source: AiEventSource::AgentHook,
            confidence: AiConfidence::Verified,
            actor_type: None,
            actor_confidence: None,
            lines_added: Some(2),
            lines_deleted: Some(1),
            content_fingerprint: None,
            active_seconds: Some(1.0),
            transport: transport.map(str::to_string),
            tool: Some("apply_patch".to_string()),
            tool_event_id: Some("tool-1".to_string()),
            editor: None,
        }
    }

    #[test]
    fn every_supported_producer_shape_maps_to_a_kind_and_lineage() {
        for transport in [
            "native_plugin",
            "mcp",
            "transcript",
            "tool_snapshot",
            "filesystem",
            "vscode",
        ] {
            let input = from_broker_event(&broker_event(Some(transport))).unwrap();
            assert!(!input.lineage_id.is_empty());
            assert!(input.entity.is_absolute());
        }
    }

    #[test]
    fn malformed_relative_records_are_dropped_not_guessed() {
        let mut event = broker_event(Some("native_plugin"));
        event.entity = "src/main.rs".to_string();
        let error = from_broker_event(&event).unwrap_err();
        assert_eq!(error.producer, "broker");
        assert!(error.reason.contains("absolute"));
    }

    #[test]
    fn intake_serialization_has_no_content_fields() {
        let input = from_broker_event(&broker_event(Some("native_plugin"))).unwrap();
        let json = serde_json::to_string(&input).unwrap();
        for forbidden in ["content", "prompt", "response", "command", "patch", "text"] {
            assert!(
                !json.contains(forbidden),
                "found forbidden field {forbidden}"
            );
        }
    }

    #[test]
    fn session_process_name_only_keeps_its_weak_strength() {
        let evidence = SessionProcessEvidence {
            agent: "codex".to_string(),
            provider: None,
            pid: 7,
            ppid: None,
            process_identity: "codex".to_string(),
            workspace: Some(PathBuf::from("/workspace")),
            session_id: None,
            tool_event_id: None,
            started_at: DateTime::from_timestamp(1_700_000_000, 0).unwrap(),
            last_activity_at: DateTime::from_timestamp(1_700_000_000, 0).unwrap(),
            ended_at: None,
            strength: EvidenceStrength::ProcessNameOnly,
        };
        let input = from_session_evidence(
            &evidence,
            Path::new("/workspace/src/main.rs"),
            evidence.last_activity_at,
        )
        .unwrap();
        assert_eq!(
            input.evidence_strength,
            Some(EvidenceStrength::ProcessNameOnly)
        );
    }
}

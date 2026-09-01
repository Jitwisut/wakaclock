//! planai2.md Phase 5 — the **Universal Correlation Engine**.
//!
//! Every producer (native hook, structured MCP, a completed transcript tool call,
//! a before/after tool snapshot, the filesystem observer, the session/process
//! observer, editor input) normalises its observation into one [`CorrelationInput`]
//! and pushes it here via [`CorrelationEngine::ingest`]. Nothing in this module
//! reads or stores file content — only paths, kinds, timestamps, identities and
//! opaque fingerprints cross its boundary.
//!
//! This file is intake + the window table (p5.1 / p5.0). The decision rules that
//! turn a set of inputs for one entity into `ai_verified` / `ai_inferred` /
//! `human` / `unknown` are p5.2, built on top of this.

use std::path::PathBuf;

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

use crate::ai::event::AiConfidence;
use crate::ai::path::normalize_lexical;
use crate::broker::BrokerChangeKind;

/// planai2.md p5.0: one named, individually-reasoned window per evidence pair —
/// **never a single shared constant**. The engine is handed a `&CorrelationWindows`
/// so tests and a future config can vary them; [`CorrelationWindows::DEFAULT`] is
/// the tuned set. Each field's doc comment carries the rationale, so the numbers
/// cannot be collapsed together without deleting a documented reason.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CorrelationWindows {
    /// hook ↔ transcript for the same edit. The transcript is appended by the
    /// *same* tool moments after its hook fires; a wider window would merge two
    /// genuinely separate edits of one file into a single canonical event.
    #[serde(with = "secs")]
    pub hook_to_transcript: Duration,
    /// editor input ↔ AI edit (line-level attribution). Unchanged from
    /// `correlation.rs`'s `EXACT_MATCH_WINDOW`, measured to the editor flush
    /// *window*; the VS Code side's 15 s is point-to-point and deliberately not
    /// unified with this.
    #[serde(with = "secs")]
    pub editor_to_ai_edit: Duration,
    /// a filesystem change ↔ a recent agent tool call or live session in the same
    /// workspace. Wider, because fs events lag (fsync, editor debounce, the
    /// atomic-save rename sequence) and "a tool was active around this" tolerates
    /// more slack than a line-level claim — but still short of a formatter or
    /// `git` run minutes later.
    #[serde(with = "secs")]
    pub filesystem_to_agent_activity: Duration,
    /// a before/after tool snapshot ↔ a native hook event for the same file. The
    /// snapshot brackets one shell/MCP tool call; its hook fires inside that
    /// bracket. Covers a slow multi-file `apply_patch` without reaching the next
    /// tool call.
    #[serde(with = "secs")]
    pub snapshot_to_hook: Duration,
    /// a lone filesystem change ↔ editor input, to decide it was a human save.
    /// Matches the VS Code extension's own `CORRELATION_WINDOW_SECONDS`.
    #[serde(with = "secs")]
    pub filesystem_to_editor_input: Duration,
    /// grace added to a still-live session's `last_activity_at` when testing
    /// "was this session live at change time `t`" (`started_at <= t <=
    /// last_activity_at + grace`). A scan cadence is seconds-to-a-minute, so ~90 s
    /// of prior liveness is still plausible causation; 5 min of silence is not.
    #[serde(with = "secs")]
    pub session_liveness_grace: Duration,
}

impl CorrelationWindows {
    pub const DEFAULT: Self = Self {
        hook_to_transcript: Duration::seconds(10),
        editor_to_ai_edit: Duration::seconds(5),
        filesystem_to_agent_activity: Duration::seconds(60),
        snapshot_to_hook: Duration::seconds(30),
        filesystem_to_editor_input: Duration::seconds(15),
        session_liveness_grace: Duration::seconds(120),
    };

    /// The window that governs correlating an input of `a` with an input of `b`.
    /// Order-independent. `None` for a pair that is not time-window correlated
    /// (e.g. two of the same kind, or session-liveness which is an interval test).
    pub fn between(&self, a: EvidenceKind, b: EvidenceKind) -> Option<Duration> {
        use EvidenceKind::*;
        // Normalise to `EvidenceKind`'s (strongest-first) ordering so each pair
        // is written once; the arms below are all in that canonical order.
        let mut pair = [a, b];
        pair.sort();
        match pair {
            [NativeHook, CompletedTranscriptToolCall] => Some(self.hook_to_transcript),
            [NativeHook, ToolSnapshot] => Some(self.snapshot_to_hook),
            [NativeHook, EditorInput]
            | [StructuredMcp, EditorInput]
            | [CompletedTranscriptToolCall, EditorInput] => Some(self.editor_to_ai_edit),
            [FilesystemObserver, EditorInput] => Some(self.filesystem_to_editor_input),
            [NativeHook, FilesystemObserver]
            | [StructuredMcp, FilesystemObserver]
            | [CompletedTranscriptToolCall, FilesystemObserver]
            | [ToolSnapshot, FilesystemObserver]
            | [FilesystemObserver, SessionProcessObserver] => {
                Some(self.filesystem_to_agent_activity)
            }
            _ => None,
        }
    }
}

impl Default for CorrelationWindows {
    fn default() -> Self {
        Self::DEFAULT
    }
}

/// serde helper: a `chrono::Duration` as whole seconds.
mod secs {
    use chrono::Duration;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(d: &Duration, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_i64(d.num_seconds())
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Duration, D::Error> {
        Ok(Duration::seconds(i64::deserialize(d)?))
    }
}

/// Which producer an observation came from — the primary axis of planai2.md's
/// producer priority and the key to [`CorrelationWindows::between`]. Ordered
/// strongest-evidence-first so `sort()` / `Ord` is meaningful.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceKind {
    /// A native agent hook / plugin fired for this exact file.
    NativeHook,
    /// A structured MCP / tool-bridge write event.
    StructuredMcp,
    /// A completed tool call parsed from an agent transcript.
    CompletedTranscriptToolCall,
    /// A before/after git-sweep snapshot around a shell/MCP tool call.
    ToolSnapshot,
    /// The universal filesystem observer saw the file change.
    FilesystemObserver,
    /// The session/process observer saw an agent live in the workspace.
    SessionProcessObserver,
    /// Positive editor-input evidence (keystrokes / a buffered editor change).
    EditorInput,
}

impl EvidenceKind {
    /// Evidence that, for its own file, is a *verified* AI edit on its own
    /// (planai2.md §5 `ai_verified` predicate).
    pub fn is_verified_ai_edit(self) -> bool {
        matches!(
            self,
            Self::NativeHook | Self::StructuredMcp | Self::CompletedTranscriptToolCall
        )
    }
}

/// One normalised observation from any producer. Metadata only — no file content,
/// no command arguments, no prompt/response text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CorrelationInput {
    /// The producer's own stable id for this observation, kept verbatim so a
    /// later verdict can be explained back to its sources (p5.5 lineage) without
    /// the engine inventing identity.
    pub lineage_id: String,
    pub kind: EvidenceKind,
    /// Lexically-normalised absolute path of the file this observation is about.
    pub entity: PathBuf,
    #[serde(default)]
    pub workspace: Option<PathBuf>,
    pub occurred_at: DateTime<Utc>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub change_kind: Option<BrokerChangeKind>,
    /// The producer's self-asserted confidence (never upgraded by the engine —
    /// planai2.md p1.0/D4).
    #[serde(default = "unknown_confidence")]
    pub confidence: AiConfidence,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub tool_event_id: Option<String>,
    /// Opaque content/blob fingerprint (e.g. from `fingerprint_changed_file`), for
    /// "the same bytes again" vs "a real edit" — never the bytes themselves.
    #[serde(default)]
    pub fingerprint: Option<String>,
}

fn unknown_confidence() -> AiConfidence {
    AiConfidence::Unknown
}

impl CorrelationInput {
    /// Construct with the required fields; optional metadata is filled with the
    /// builder-ish setters or left `None`. `entity` is normalised on the way in.
    pub fn new(
        lineage_id: impl Into<String>,
        kind: EvidenceKind,
        entity: impl Into<PathBuf>,
        occurred_at: DateTime<Utc>,
    ) -> Self {
        Self {
            lineage_id: lineage_id.into(),
            kind,
            entity: normalize_lexical(&entity.into()),
            workspace: None,
            occurred_at,
            agent: None,
            change_kind: None,
            confidence: AiConfidence::Unknown,
            session_id: None,
            tool_event_id: None,
            fingerprint: None,
        }
    }

    pub fn with_workspace(mut self, workspace: impl Into<PathBuf>) -> Self {
        self.workspace = Some(workspace.into());
        self
    }
    pub fn with_agent(mut self, agent: impl Into<String>) -> Self {
        self.agent = Some(agent.into());
        self
    }
    pub fn with_change_kind(mut self, kind: BrokerChangeKind) -> Self {
        self.change_kind = Some(kind);
        self
    }
    pub fn with_confidence(mut self, confidence: AiConfidence) -> Self {
        self.confidence = confidence;
        self
    }
    pub fn with_session_id(mut self, id: impl Into<String>) -> Self {
        self.session_id = Some(id.into());
        self
    }
    pub fn with_tool_event_id(mut self, id: impl Into<String>) -> Self {
        self.tool_event_id = Some(id.into());
        self
    }
    pub fn with_fingerprint(mut self, fp: impl Into<String>) -> Self {
        self.fingerprint = Some(fp.into());
        self
    }
}

/// Accepts a `CorrelationInput` from any producer and holds them for the decision
/// pass (p5.2). Preserves every input's `lineage_id` and insertion order.
#[derive(Debug, Clone)]
pub struct CorrelationEngine {
    windows: CorrelationWindows,
    inputs: Vec<CorrelationInput>,
}

impl CorrelationEngine {
    pub fn new(windows: CorrelationWindows) -> Self {
        Self {
            windows,
            inputs: Vec::new(),
        }
    }

    pub fn with_default_windows() -> Self {
        Self::new(CorrelationWindows::DEFAULT)
    }

    pub fn windows(&self) -> &CorrelationWindows {
        &self.windows
    }

    /// Take in one observation. No dedup or decision here — that is p5.2/p5.6.
    pub fn ingest(&mut self, input: CorrelationInput) {
        self.inputs.push(input);
    }

    pub fn inputs(&self) -> &[CorrelationInput] {
        &self.inputs
    }

    pub fn len(&self) -> usize {
        self.inputs.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inputs.is_empty()
    }

    /// Every ingested input for one normalised entity, in insertion order.
    pub fn for_entity<'a>(
        &'a self,
        entity: &'a std::path::Path,
    ) -> impl Iterator<Item = &'a CorrelationInput> + 'a {
        let target = normalize_lexical(entity);
        self.inputs.iter().filter(move |i| i.entity == target)
    }

    /// The distinct normalised entities that have at least one input.
    pub fn entities(&self) -> Vec<PathBuf> {
        let mut seen: Vec<PathBuf> = self.inputs.iter().map(|i| i.entity.clone()).collect();
        seen.sort();
        seen.dedup();
        seen
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn all_kinds() -> [EvidenceKind; 7] {
        [
            EvidenceKind::NativeHook,
            EvidenceKind::StructuredMcp,
            EvidenceKind::CompletedTranscriptToolCall,
            EvidenceKind::ToolSnapshot,
            EvidenceKind::FilesystemObserver,
            EvidenceKind::SessionProcessObserver,
            EvidenceKind::EditorInput,
        ]
    }

    #[test]
    fn every_producer_kind_can_be_ingested_and_keeps_its_lineage_id() {
        let mut engine = CorrelationEngine::with_default_windows();
        let now = Utc::now();
        for (i, kind) in all_kinds().into_iter().enumerate() {
            engine.ingest(
                CorrelationInput::new(format!("lineage-{i}"), kind, "/w/src/main.rs", now)
                    .with_workspace("/w"),
            );
        }
        assert_eq!(engine.len(), 7);
        let ids: Vec<&str> = engine
            .inputs()
            .iter()
            .map(|i| i.lineage_id.as_str())
            .collect();
        assert_eq!(
            ids,
            vec![
                "lineage-0",
                "lineage-1",
                "lineage-2",
                "lineage-3",
                "lineage-4",
                "lineage-5",
                "lineage-6"
            ]
        );
        // Every kind is represented exactly once, order preserved.
        let kinds: Vec<EvidenceKind> = engine.inputs().iter().map(|i| i.kind).collect();
        assert_eq!(kinds, all_kinds().to_vec());
    }

    #[test]
    fn entity_is_normalised_on_intake_and_grouping_uses_the_normal_form() {
        let mut engine = CorrelationEngine::with_default_windows();
        let now = Utc::now();
        engine.ingest(CorrelationInput::new(
            "a",
            EvidenceKind::NativeHook,
            "/w/src/../src/./main.rs",
            now,
        ));
        engine.ingest(CorrelationInput::new(
            "b",
            EvidenceKind::FilesystemObserver,
            "/w/src/main.rs",
            now,
        ));
        engine.ingest(CorrelationInput::new(
            "c",
            EvidenceKind::EditorInput,
            "/w/src/other.rs",
            now,
        ));

        assert_eq!(engine.inputs()[0].entity, PathBuf::from("/w/src/main.rs"));
        let for_main: Vec<&str> = engine
            .for_entity(std::path::Path::new("/w/src/main.rs"))
            .map(|i| i.lineage_id.as_str())
            .collect();
        assert_eq!(for_main, vec!["a", "b"]);
        assert_eq!(
            engine.entities(),
            vec![
                PathBuf::from("/w/src/main.rs"),
                PathBuf::from("/w/src/other.rs")
            ]
        );
    }

    #[test]
    fn correlation_windows_are_distinct_and_round_trip() {
        let w = CorrelationWindows::DEFAULT;
        assert_eq!(w.hook_to_transcript, Duration::seconds(10));
        assert_eq!(w.editor_to_ai_edit, Duration::seconds(5));
        assert_eq!(w.filesystem_to_agent_activity, Duration::seconds(60));
        assert_eq!(w.snapshot_to_hook, Duration::seconds(30));
        assert_eq!(w.filesystem_to_editor_input, Duration::seconds(15));
        assert_eq!(w.session_liveness_grace, Duration::seconds(120));
        // No two windows are the same value by accident of a shared constant.
        let vals = [
            w.hook_to_transcript,
            w.editor_to_ai_edit,
            w.filesystem_to_agent_activity,
            w.snapshot_to_hook,
            w.filesystem_to_editor_input,
        ];
        for (i, a) in vals.iter().enumerate() {
            for b in &vals[i + 1..] {
                assert_ne!(a, b, "two evidence-pair windows collapsed to one value");
            }
        }

        let json = serde_json::to_string(&w).unwrap();
        let back: CorrelationWindows = serde_json::from_str(&json).unwrap();
        assert_eq!(w, back);
    }

    #[test]
    fn between_maps_evidence_pairs_to_the_right_window_order_independently() {
        let w = CorrelationWindows::DEFAULT;
        assert_eq!(
            w.between(
                EvidenceKind::NativeHook,
                EvidenceKind::CompletedTranscriptToolCall
            ),
            Some(Duration::seconds(10))
        );
        assert_eq!(
            w.between(
                EvidenceKind::CompletedTranscriptToolCall,
                EvidenceKind::NativeHook
            ),
            Some(Duration::seconds(10))
        );
        assert_eq!(
            w.between(EvidenceKind::FilesystemObserver, EvidenceKind::EditorInput),
            Some(Duration::seconds(15))
        );
        assert_eq!(
            w.between(
                EvidenceKind::FilesystemObserver,
                EvidenceKind::SessionProcessObserver
            ),
            Some(Duration::seconds(60))
        );
        assert_eq!(
            w.between(EvidenceKind::ToolSnapshot, EvidenceKind::NativeHook),
            Some(Duration::seconds(30))
        );
        // A pair with no time-window relationship.
        assert_eq!(
            w.between(EvidenceKind::NativeHook, EvidenceKind::NativeHook),
            None
        );
        assert_eq!(
            w.between(
                EvidenceKind::SessionProcessObserver,
                EvidenceKind::EditorInput
            ),
            None
        );
    }

    #[test]
    fn a_correlation_input_carries_no_content_field() {
        let now = Utc::now();
        let input = CorrelationInput::new("x", EvidenceKind::NativeHook, "/w/a.rs", now)
            .with_fingerprint("blob:deadbeef")
            .with_agent("codex")
            .with_confidence(AiConfidence::Verified);
        let json = serde_json::to_string(&input).unwrap();
        for forbidden in [
            "\"content",
            "\"diff",
            "\"patch",
            "\"prompt",
            "\"source",
            "\"argv",
        ] {
            assert!(!json.contains(forbidden), "leaked a content field: {json}");
        }
        let back: CorrelationInput = serde_json::from_str(&json).unwrap();
        assert_eq!(input, back);
    }

    #[test]
    fn is_verified_ai_edit_only_for_the_direct_producers() {
        assert!(EvidenceKind::NativeHook.is_verified_ai_edit());
        assert!(EvidenceKind::StructuredMcp.is_verified_ai_edit());
        assert!(EvidenceKind::CompletedTranscriptToolCall.is_verified_ai_edit());
        assert!(!EvidenceKind::ToolSnapshot.is_verified_ai_edit());
        assert!(!EvidenceKind::FilesystemObserver.is_verified_ai_edit());
        assert!(!EvidenceKind::SessionProcessObserver.is_verified_ai_edit());
        assert!(!EvidenceKind::EditorInput.is_verified_ai_edit());
    }
}

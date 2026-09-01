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
use crate::ai::session::EvidenceStrength;
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
    /// For a `SessionProcessObserver` / `ToolSnapshot` input: the ladder rank of
    /// the underlying evidence, so the engine — not the producer — decides
    /// whether it is `is_strong_enough_to_infer()` (planai2.md §5: "process name
    /// alone is not enough for `ai_inferred`").
    #[serde(default)]
    pub evidence_strength: Option<EvidenceStrength>,
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
            evidence_strength: None,
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
    pub fn with_evidence_strength(mut self, strength: EvidenceStrength) -> Self {
        self.evidence_strength = Some(strength);
        self
    }

    /// True when this input, on its own, establishes an AI *authorship* of its
    /// file (planai2.md §5 `ai_verified`: native hook / structured MCP write /
    /// completed structured tool call).
    fn is_verified_ai(&self) -> bool {
        self.kind.is_verified_ai_edit()
    }

    /// True when this input is "a recent agent tool or session" strong enough to
    /// support `ai_inferred` (planai2.md §5). A completed/structured tool call
    /// always qualifies; a session/process observation qualifies only if its
    /// `EvidenceStrength` clears the p4 bar — a bare process-name match does not.
    fn is_inferring_agent_activity(&self) -> bool {
        match self.kind {
            EvidenceKind::NativeHook
            | EvidenceKind::StructuredMcp
            | EvidenceKind::CompletedTranscriptToolCall
            | EvidenceKind::ToolSnapshot => true,
            EvidenceKind::SessionProcessObserver => self
                .evidence_strength
                .map(EvidenceStrength::is_strong_enough_to_infer)
                .unwrap_or(false),
            EvidenceKind::FilesystemObserver | EvidenceKind::EditorInput => false,
        }
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

    /// planai2.md §5: decide the verdict for **one change** to `entity` observed
    /// at `at`, over the inputs already ingested for that entity.
    ///
    /// §5 lists the four predicates (`ai_verified`, `ai_inferred`, `human`,
    /// `unknown`) as independent boolean formulas with **no stated precedence**.
    /// The order below is the p5.2 DECISION (tracker Decisions log,
    /// 2026-09-01 — p5.2), pinned by the §5 acceptance criteria: absence of AI
    /// evidence must not manufacture `human`, and a simultaneous human/AI
    /// conflict must not auto-resolve to `human`.
    ///
    /// 1. two+ distinct agents with **verified** evidence → `unknown` (competing)
    /// 2. one **verified** producer for the file             → `ai_verified`
    /// 3. positive editor input **and** AI activity inside the
    ///    `editor_to_ai_edit` conflict window                → `unknown` (conflict)
    /// 4. two+ distinct agents with **inferring** activity   → `unknown` (competing)
    /// 5. file changed + exactly one agent's inferring activity + the pair's
    ///    time window matches + fingerprint/shape matches + no editor input
    ///    close enough to explain the change                 → `ai_inferred`
    /// 6. positive editor input, correlation window closed   → `human`
    ///    (still open → `unknown`, an AI edit could still land)
    /// 7. file changed, none of the above                    → `unknown`
    /// 8. nothing relevant in-window                         → `unknown`
    pub fn verdict_for(&self, entity: &std::path::Path, at: DateTime<Utc>) -> Verdict {
        self.decide(self.for_entity(entity).collect(), at)
    }

    /// As [`verdict_for`], but first **hard-clips** the entity's inputs to
    /// `bounds` before deciding (planai2.md §5 "clip evidence to the query day /
    /// session boundary" — a hard clip, deliberately *not* one of the
    /// [`CorrelationWindows`]). Evidence whose timestamps straddle midnight is
    /// therefore attributed to each day on its own, and a prior day's or prior
    /// session's evidence cannot reach into the query range.
    pub fn verdict_for_within(
        &self,
        entity: &std::path::Path,
        at: DateTime<Utc>,
        bounds: ClipBounds,
    ) -> Verdict {
        self.decide(
            self.for_entity(entity)
                .filter(|i| bounds.contains(i.occurred_at))
                .collect(),
            at,
        )
    }

    /// Inputs for `entity` that fall inside `bounds` — the hard clip of p5.3,
    /// exposed for callers that need the surviving evidence, not just the
    /// verdict.
    pub fn inputs_for_within<'a>(
        &'a self,
        entity: &'a std::path::Path,
        bounds: ClipBounds,
    ) -> Vec<&'a CorrelationInput> {
        self.for_entity(entity)
            .filter(|i| bounds.contains(i.occurred_at))
            .collect()
    }

    /// Shared core of [`verdict_for`] and [`verdict_for_within`]: the §5
    /// predicate ladder over an already-selected `all` (one entity, optionally
    /// day/session-clipped).
    fn decide(&self, all: Vec<&CorrelationInput>, at: DateTime<Utc>) -> Verdict {
        let w = &self.windows;
        if all.is_empty() {
            return Verdict::unknown(VerdictReason::NoEvidence, Vec::new());
        }

        // TimeWindowMatches: anchor on "a change was observed at `at`"
        // (`FilesystemObserver`) and take each candidate's window from the
        // per-evidence-pair table, never one shared constant.
        let window_for = |k: EvidenceKind| {
            w.between(EvidenceKind::FilesystemObserver, k)
                .unwrap_or(w.filesystem_to_agent_activity)
        };
        let relevant: Vec<&CorrelationInput> = all
            .iter()
            .copied()
            .filter(|i| within(i.occurred_at, at, window_for(i.kind)))
            .collect();
        if relevant.is_empty() {
            return Verdict::unknown(VerdictReason::NoEvidence, Vec::new());
        }

        let file_changed = relevant
            .iter()
            .any(|i| i.kind == EvidenceKind::FilesystemObserver);
        let editor: Vec<&CorrelationInput> = relevant
            .iter()
            .copied()
            .filter(|i| i.kind == EvidenceKind::EditorInput)
            .collect();
        let verified: Vec<&CorrelationInput> = relevant
            .iter()
            .copied()
            .filter(|i| i.is_verified_ai())
            .collect();
        let inferring: Vec<&CorrelationInput> = relevant
            .iter()
            .copied()
            .filter(|i| i.is_inferring_agent_activity())
            .collect();

        // 1. Competing verified agents.
        if distinct_agents(&verified) >= 2 {
            return Verdict::unknown(
                VerdictReason::MultipleCompetingAiSessions,
                lineage(&verified),
            );
        }

        // 2. A verified producer for this exact file. §5 `ai_verified` is the
        //    strongest tier; it outranks concurrent editor input (the conflict
        //    rule applies to inferred-strength AI evidence).
        if !verified.is_empty() {
            return Verdict {
                verdict: AiVerdict::AiVerified,
                reason: VerdictReason::DirectAiProducer,
                supporting_lineage: lineage(&verified),
            };
        }

        // 3. Human/AI conflict: editor input with AI activity inside the
        //    `editor_to_ai_edit` window. Never auto-resolves to `human`.
        let conflicting_ai: Vec<&CorrelationInput> = inferring
            .iter()
            .copied()
            .filter(|ai| {
                editor
                    .iter()
                    .any(|e| within(ai.occurred_at, e.occurred_at, w.editor_to_ai_edit))
            })
            .collect();
        if !editor.is_empty() && !conflicting_ai.is_empty() {
            let mut ids = lineage(&editor);
            ids.extend(lineage(&conflicting_ai));
            return Verdict::unknown(VerdictReason::ConflictingHumanAndAiEvidence, ids);
        }

        // 4. Competing inferring agents (each already past the p4 strength bar).
        if distinct_agents(&inferring) >= 2 {
            return Verdict::unknown(
                VerdictReason::MultipleCompetingAiSessions,
                lineage(&inferring),
            );
        }

        // 5. AI inferred.
        let editor_explains_change = editor
            .iter()
            .any(|e| within(e.occurred_at, at, w.filesystem_to_editor_input));
        if file_changed && !inferring.is_empty() && !editor_explains_change {
            let fs: Vec<&CorrelationInput> = relevant
                .iter()
                .copied()
                .filter(|i| i.kind == EvidenceKind::FilesystemObserver)
                .collect();
            let shape_ok = inferring
                .iter()
                .all(|ai| fs.iter().any(|f| fingerprint_or_shape_matches(f, ai)));
            if shape_ok {
                let mut ids = lineage(&fs);
                ids.extend(lineage(&inferring));
                return Verdict {
                    verdict: AiVerdict::AiInferred,
                    reason: VerdictReason::InferredFromAgentActivity,
                    supporting_lineage: ids,
                };
            }
        }

        // 6. Human (or "window still open").
        if let Some(latest_editor) = editor.iter().map(|e| e.occurred_at).max() {
            if at >= latest_editor + w.editor_to_ai_edit {
                return Verdict {
                    verdict: AiVerdict::Human,
                    reason: VerdictReason::PositiveEditorInput,
                    supporting_lineage: lineage(&editor),
                };
            }
            return Verdict::unknown(VerdictReason::CorrelationWindowStillOpen, lineage(&editor));
        }

        // 7. A change with no sufficient provenance.
        if file_changed {
            let fs: Vec<&CorrelationInput> = relevant
                .iter()
                .copied()
                .filter(|i| i.kind == EvidenceKind::FilesystemObserver)
                .collect();
            return Verdict::unknown(
                VerdictReason::FileChangedWithoutSufficientProvenance,
                lineage(&fs),
            );
        }

        // 8. Nothing that attributes a change.
        Verdict::unknown(VerdictReason::NoEvidence, Vec::new())
    }
}

/// `|a - b| <= window`, in whole seconds.
fn within(a: DateTime<Utc>, b: DateTime<Utc>, window: Duration) -> bool {
    (a - b).num_seconds().abs() <= window.num_seconds()
}

/// planai2.md §5 `FingerprintOrChangeShapeMatches`: prefer an exact fingerprint
/// match, fall back to the change-kind shape; if neither is available on both
/// sides it cannot be disproved, so it does not veto (the other conjuncts gate).
fn fingerprint_or_shape_matches(a: &CorrelationInput, b: &CorrelationInput) -> bool {
    if let (Some(fa), Some(fb)) = (&a.fingerprint, &b.fingerprint) {
        return fa == fb;
    }
    if let (Some(ka), Some(kb)) = (a.change_kind, b.change_kind) {
        return ka == kb;
    }
    true
}

/// Count of distinct non-empty `agent` labels across the inputs.
fn distinct_agents(inputs: &[&CorrelationInput]) -> usize {
    let mut agents: Vec<&str> = inputs.iter().filter_map(|i| i.agent.as_deref()).collect();
    agents.sort_unstable();
    agents.dedup();
    agents.len()
}

/// `lineage_id`s of the given inputs, in the order given.
fn lineage(inputs: &[&CorrelationInput]) -> Vec<String> {
    inputs.iter().map(|i| i.lineage_id.clone()).collect()
}

/// The four outcomes of planai2.md §5. `system` is deliberately **not** one of
/// them — a system actor (formatter / build / `git checkout` / `git merge` /
/// codegen, p5.4) resolves to [`AiVerdict::Unknown`] with a system
/// [`VerdictReason`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AiVerdict {
    AiVerified,
    AiInferred,
    Human,
    Unknown,
}

/// Which §5 clause produced the [`AiVerdict`]. Retained so a result can be
/// explained after the fact (planai2.md §5 "evidence lineage") — it names the
/// rule, never any source content.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerdictReason {
    /// `ai_verified`: a native hook / structured MCP write / completed tool call
    /// for this exact file.
    DirectAiProducer,
    /// `ai_inferred`: file changed + one agent's recent tool/session, in-window,
    /// fingerprint/shape consistent, no competitor, no human save to explain it.
    InferredFromAgentActivity,
    /// `human`: positive editor input, correlation window closed, no conflicting
    /// AI evidence.
    PositiveEditorInput,
    /// `unknown`: a file change with no sufficient provenance.
    FileChangedWithoutSufficientProvenance,
    /// `unknown`: positive editor input **and** AI evidence inside the conflict
    /// window — never auto-resolved to `human`.
    ConflictingHumanAndAiEvidence,
    /// `unknown`: two or more distinct agents have competing evidence in-window.
    MultipleCompetingAiSessions,
    /// `unknown`: editor input seen but the correlation window has not closed —
    /// an AI edit could still land.
    CorrelationWindowStillOpen,
    /// `unknown`: nothing relevant was ingested for this entity/time.
    NoEvidence,
}

/// A §5 decision plus the lineage that backs it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Verdict {
    pub verdict: AiVerdict,
    pub reason: VerdictReason,
    /// `lineage_id`s of every input that supports this verdict, in the order the
    /// engine considered them. Kept verbatim; the observations' content is never
    /// stored.
    pub supporting_lineage: Vec<String>,
}

impl Verdict {
    fn unknown(reason: VerdictReason, lineage: impl Into<Vec<String>>) -> Self {
        Self {
            verdict: AiVerdict::Unknown,
            reason,
            supporting_lineage: lineage.into(),
        }
    }
}

/// A half-open `[start, end)` instant range used for the planai2.md §5 **hard
/// clip** — "clip evidence to the query day / session boundary". This is not a
/// tolerance window: evidence outside the range is *removed* before the verdict,
/// so an edit that straddles midnight is scored once per day and a prior
/// session's evidence never bleeds into the current one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClipBounds {
    /// Inclusive lower bound.
    pub start: DateTime<Utc>,
    /// Exclusive upper bound.
    pub end: DateTime<Utc>,
}

impl ClipBounds {
    /// `start..end`. If `end <= start` the range is empty and clips everything.
    pub fn new(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        Self { start, end }
    }

    /// The UTC calendar day containing `instant`: `[00:00:00, next 00:00:00)`.
    pub fn utc_day(instant: DateTime<Utc>) -> Self {
        let start = instant
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .expect("00:00:00 is always valid")
            .and_utc();
        Self {
            start,
            end: start + Duration::days(1),
        }
    }

    /// Clip from `session_start` up to (and excluding) `until` — e.g. a
    /// session's `started_at` and the end of the query day. Evidence before the
    /// session began is dropped.
    pub fn session(session_start: DateTime<Utc>, until: DateTime<Utc>) -> Self {
        Self {
            start: session_start,
            end: until,
        }
    }

    pub fn contains(&self, t: DateTime<Utc>) -> bool {
        self.start <= t && t < self.end
    }

    /// The overlap of two clips (e.g. a session window intersected with a day),
    /// or `None` when they do not overlap.
    pub fn intersect(&self, other: &Self) -> Option<Self> {
        let start = self.start.max(other.start);
        let end = self.end.min(other.end);
        (start < end).then_some(Self { start, end })
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

    // ---- p5.2: §5 decision rules -------------------------------------------

    const FILE: &str = "/w/src/main.rs";

    fn at(base: DateTime<Utc>, secs: i64) -> DateTime<Utc> {
        base + Duration::seconds(secs)
    }

    fn ci(id: &str, kind: EvidenceKind, when: DateTime<Utc>) -> CorrelationInput {
        CorrelationInput::new(id, kind, FILE, when).with_workspace("/w")
    }

    fn verdict(engine: &CorrelationEngine, when: DateTime<Utc>) -> Verdict {
        engine.verdict_for(std::path::Path::new(FILE), when)
    }

    #[test]
    fn a_native_hook_for_the_file_is_ai_verified() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("hook-1", EvidenceKind::NativeHook, t0).with_agent("claude-code"));
        let v = verdict(&e, t0);
        assert_eq!(v.verdict, AiVerdict::AiVerified);
        assert_eq!(v.reason, VerdictReason::DirectAiProducer);
        assert_eq!(v.supporting_lineage, vec!["hook-1"]);
    }

    #[test]
    fn two_agents_both_verified_for_one_file_is_unknown_competing() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("mcp-a", EvidenceKind::StructuredMcp, t0).with_agent("claude-code"));
        e.ingest(
            ci(
                "tool-b",
                EvidenceKind::CompletedTranscriptToolCall,
                at(t0, 2),
            )
            .with_agent("codex"),
        );
        let v = verdict(&e, at(t0, 1));
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(v.reason, VerdictReason::MultipleCompetingAiSessions);
    }

    #[test]
    fn p5_a4_a_shell_change_from_an_active_verified_session_is_ai_inferred() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(
            ci("fs-1", EvidenceKind::FilesystemObserver, t0)
                .with_change_kind(BrokerChangeKind::Modify),
        );
        e.ingest(
            ci("sess-1", EvidenceKind::SessionProcessObserver, at(t0, -5))
                .with_agent("codex")
                .with_evidence_strength(EvidenceStrength::ProcessTreeCwdMatch),
        );
        let v = verdict(&e, t0);
        assert_eq!(v.verdict, AiVerdict::AiInferred);
        assert_eq!(v.reason, VerdictReason::InferredFromAgentActivity);
        assert!(v.supporting_lineage.contains(&"fs-1".to_string()));
        assert!(v.supporting_lineage.contains(&"sess-1".to_string()));
    }

    #[test]
    fn p4_a3_process_name_only_sessions_cannot_infer_and_stay_unknown() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("fs-1", EvidenceKind::FilesystemObserver, t0));
        for (i, agent) in ["codex", "claude-code", "gemini-cli"]
            .into_iter()
            .enumerate()
        {
            e.ingest(
                ci(
                    &format!("name-{i}"),
                    EvidenceKind::SessionProcessObserver,
                    at(t0, -3),
                )
                .with_agent(agent)
                .with_evidence_strength(EvidenceStrength::ProcessNameOnly),
            );
        }
        let v = verdict(&e, t0);
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(
            v.reason,
            VerdictReason::FileChangedWithoutSufficientProvenance
        );
    }

    #[test]
    fn p3_a5_and_p5_a1_a_lone_filesystem_change_is_unknown_never_human_or_ai() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("fs-1", EvidenceKind::FilesystemObserver, t0));
        let v = verdict(&e, t0);
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(
            v.reason,
            VerdictReason::FileChangedWithoutSufficientProvenance
        );
    }

    #[test]
    fn p4_a1_a_session_with_no_change_produces_no_attribution() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(
            ci("sess-1", EvidenceKind::SessionProcessObserver, t0)
                .with_agent("codex")
                .with_evidence_strength(EvidenceStrength::ChildOfToolCall),
        );
        let v = verdict(&e, t0);
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(v.reason, VerdictReason::NoEvidence);
    }

    #[test]
    fn positive_editor_input_after_the_window_closes_is_human() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("edit-1", EvidenceKind::EditorInput, t0));
        e.ingest(
            ci("fs-1", EvidenceKind::FilesystemObserver, at(t0, 1))
                .with_change_kind(BrokerChangeKind::Modify),
        );
        // 5 s (editor_to_ai_edit) later, nothing from an agent showed up.
        let v = verdict(&e, at(t0, 6));
        assert_eq!(v.verdict, AiVerdict::Human);
        assert_eq!(v.reason, VerdictReason::PositiveEditorInput);
        assert_eq!(v.supporting_lineage, vec!["edit-1"]);
    }

    #[test]
    fn editor_input_while_the_window_is_still_open_is_unknown_not_yet_human() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("edit-1", EvidenceKind::EditorInput, t0));
        let v = verdict(&e, at(t0, 2)); // < 5 s
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(v.reason, VerdictReason::CorrelationWindowStillOpen);
    }

    #[test]
    fn p5_a3_simultaneous_human_and_inferred_ai_edit_is_unknown_not_human() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("edit-1", EvidenceKind::EditorInput, t0));
        e.ingest(ci("fs-1", EvidenceKind::FilesystemObserver, at(t0, 1)));
        e.ingest(
            ci("sess-1", EvidenceKind::SessionProcessObserver, at(t0, 2))
                .with_agent("codex")
                .with_evidence_strength(EvidenceStrength::ProcessTreeCwdMatch),
        );
        let v = verdict(&e, at(t0, 10));
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(v.reason, VerdictReason::ConflictingHumanAndAiEvidence);
    }

    #[test]
    fn p5_a2_a_human_edit_just_before_an_ai_edit_keeps_its_own_human_verdict() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        // Human types at t0; the correlation window closes with no agent nearby.
        e.ingest(ci("edit-1", EvidenceKind::EditorInput, t0));
        // A separate AI edit 40 s later.
        e.ingest(ci("fs-2", EvidenceKind::FilesystemObserver, at(t0, 40)));
        e.ingest(
            ci("sess-2", EvidenceKind::SessionProcessObserver, at(t0, 38))
                .with_agent("codex")
                .with_evidence_strength(EvidenceStrength::ChildOfToolCall),
        );

        // The human's change, evaluated at its own time, stays Human.
        let human = verdict(&e, at(t0, 6));
        assert_eq!(human.verdict, AiVerdict::Human);

        // The later AI change, evaluated at its time, is the agent's — the human
        // input is long out of window and does not swallow it, nor vice versa.
        let ai = verdict(&e, at(t0, 40));
        assert_eq!(ai.verdict, AiVerdict::AiInferred);
    }

    #[test]
    fn two_strong_agent_sessions_competing_is_unknown() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("fs-1", EvidenceKind::FilesystemObserver, t0));
        e.ingest(
            ci("sess-a", EvidenceKind::SessionProcessObserver, at(t0, -2))
                .with_agent("codex")
                .with_evidence_strength(EvidenceStrength::ProcessTreeCwdMatch),
        );
        e.ingest(
            ci("sess-b", EvidenceKind::SessionProcessObserver, at(t0, -3))
                .with_agent("claude-code")
                .with_evidence_strength(EvidenceStrength::ChildOfToolCall),
        );
        let v = verdict(&e, t0);
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(v.reason, VerdictReason::MultipleCompetingAiSessions);
    }

    #[test]
    fn a_fingerprint_mismatch_blocks_ai_inferred() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("fs-1", EvidenceKind::FilesystemObserver, t0).with_fingerprint("blob:aaaa"));
        e.ingest(
            ci("snap-1", EvidenceKind::ToolSnapshot, at(t0, -2))
                .with_agent("codex")
                .with_fingerprint("blob:bbbb"),
        );
        let v = verdict(&e, t0);
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(
            v.reason,
            VerdictReason::FileChangedWithoutSufficientProvenance
        );
    }

    #[test]
    fn a_change_outside_every_window_is_unknown_no_evidence() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("fs-old", EvidenceKind::FilesystemObserver, t0));
        // 10 minutes later — well past filesystem_to_agent_activity (60 s).
        let v = verdict(&e, at(t0, 600));
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(v.reason, VerdictReason::NoEvidence);
    }

    #[test]
    fn confidence_comes_from_the_evidence_combination_not_the_agent_name() {
        let t0 = Utc::now();
        let shape = |agent: &str| {
            let mut e = CorrelationEngine::with_default_windows();
            e.ingest(ci("fs-1", EvidenceKind::FilesystemObserver, t0));
            e.ingest(
                ci("sess-1", EvidenceKind::SessionProcessObserver, at(t0, -4))
                    .with_agent(agent)
                    .with_evidence_strength(EvidenceStrength::ProcessTreeCwdMatch),
            );
            verdict(&e, t0).verdict
        };
        assert_eq!(shape("codex"), AiVerdict::AiInferred);
        assert_eq!(shape("some-unknown-agent"), AiVerdict::AiInferred);
        assert_eq!(shape("claude-code"), AiVerdict::AiInferred);
    }

    #[test]
    fn the_verdict_carries_the_lineage_that_backed_it_and_no_content() {
        let t0 = Utc::now();
        let mut e = CorrelationEngine::with_default_windows();
        e.ingest(ci("fs-1", EvidenceKind::FilesystemObserver, t0));
        e.ingest(
            ci("sess-1", EvidenceKind::SessionProcessObserver, at(t0, -4))
                .with_agent("codex")
                .with_evidence_strength(EvidenceStrength::ProcessTreeCwdMatch),
        );
        let v = verdict(&e, t0);
        assert_eq!(v.supporting_lineage, vec!["fs-1", "sess-1"]);
        let json = serde_json::to_string(&v).unwrap();
        for forbidden in ["\"content", "\"diff", "\"patch", "\"prompt", "\"source"] {
            assert!(!json.contains(forbidden), "verdict leaked content: {json}");
        }
    }

    // ---- p5.3: day / session boundary hard-clip ---------------------------

    fn utc(y: i32, m: u32, d: u32, h: u32, mi: u32, s: u32) -> DateTime<Utc> {
        chrono::NaiveDate::from_ymd_opt(y, m, d)
            .unwrap()
            .and_hms_opt(h, mi, s)
            .unwrap()
            .and_utc()
    }

    #[test]
    fn clip_bounds_utc_day_is_midnight_to_midnight_and_half_open() {
        let day = ClipBounds::utc_day(utc(2026, 9, 1, 13, 20, 0));
        assert_eq!(day.start, utc(2026, 9, 1, 0, 0, 0));
        assert_eq!(day.end, utc(2026, 9, 2, 0, 0, 0));
        assert!(day.contains(utc(2026, 9, 1, 0, 0, 0)));
        assert!(day.contains(utc(2026, 9, 1, 23, 59, 59)));
        assert!(!day.contains(utc(2026, 9, 2, 0, 0, 0)));
        assert!(!day.contains(utc(2026, 8, 31, 23, 59, 59)));
    }

    #[test]
    fn an_edit_spanning_midnight_is_attributed_to_each_day_separately() {
        let mut e = CorrelationEngine::with_default_windows();
        // Day 1, just before midnight: an AI edit (fs change + strong session).
        e.ingest(ci(
            "fs-d1",
            EvidenceKind::FilesystemObserver,
            utc(2026, 9, 1, 23, 59, 40),
        ));
        e.ingest(
            ci(
                "sess-d1",
                EvidenceKind::SessionProcessObserver,
                utc(2026, 9, 1, 23, 59, 20),
            )
            .with_agent("codex")
            .with_evidence_strength(EvidenceStrength::ProcessTreeCwdMatch),
        );
        // Day 2, just after midnight: a human save.
        e.ingest(ci(
            "edit-d2",
            EvidenceKind::EditorInput,
            utc(2026, 9, 2, 0, 0, 20),
        ));
        e.ingest(ci(
            "fs-d2",
            EvidenceKind::FilesystemObserver,
            utc(2026, 9, 2, 0, 0, 22),
        ));

        let day1 = ClipBounds::utc_day(utc(2026, 9, 1, 12, 0, 0));
        let day2 = ClipBounds::utc_day(utc(2026, 9, 2, 12, 0, 0));

        // Day 1's verdict sees only day-1 evidence -> the AI edit.
        let v1 = e.verdict_for_within(
            std::path::Path::new(FILE),
            utc(2026, 9, 1, 23, 59, 40),
            day1,
        );
        assert_eq!(v1.verdict, AiVerdict::AiInferred);
        assert!(v1.supporting_lineage.iter().all(|id| id.ends_with("-d1")));

        // Day 2's verdict sees only day-2 evidence -> the human save.
        let v2 = e.verdict_for_within(std::path::Path::new(FILE), utc(2026, 9, 2, 0, 0, 30), day2);
        assert_eq!(v2.verdict, AiVerdict::Human);
        assert_eq!(v2.supporting_lineage, vec!["edit-d2"]);

        // Without the clip, day-2's session-less human save would still be Human,
        // but the earlier AI evidence is now in scope as noise — the clip is what
        // keeps the two days' evidence from mixing.
        assert!(e
            .inputs_for_within(std::path::Path::new(FILE), day1)
            .iter()
            .all(|i| i.lineage_id.ends_with("-d1")));
    }

    #[test]
    fn evidence_from_before_a_session_started_is_clipped_out() {
        let mut e = CorrelationEngine::with_default_windows();
        let session_start = utc(2026, 9, 1, 10, 0, 0);
        // A change 30 s before this session existed — cannot be this session's.
        e.ingest(ci(
            "fs-early",
            EvidenceKind::FilesystemObserver,
            utc(2026, 9, 1, 9, 59, 30),
        ));
        e.ingest(
            ci(
                "sess",
                EvidenceKind::SessionProcessObserver,
                utc(2026, 9, 1, 9, 59, 45),
            )
            .with_agent("codex")
            .with_evidence_strength(EvidenceStrength::ProcessTreeCwdMatch),
        );

        let bounds = ClipBounds::session(session_start, utc(2026, 9, 2, 0, 0, 0));
        let v = e.verdict_for_within(
            std::path::Path::new(FILE),
            utc(2026, 9, 1, 9, 59, 30),
            bounds,
        );
        // Both the pre-session change and the pre-session sighting are dropped.
        assert_eq!(v.verdict, AiVerdict::Unknown);
        assert_eq!(v.reason, VerdictReason::NoEvidence);
        assert!(e
            .inputs_for_within(std::path::Path::new(FILE), bounds)
            .is_empty());
    }

    #[test]
    fn clip_bounds_intersect_is_the_overlap_or_none() {
        let a = ClipBounds::new(utc(2026, 9, 1, 8, 0, 0), utc(2026, 9, 1, 18, 0, 0));
        let b = ClipBounds::new(utc(2026, 9, 1, 12, 0, 0), utc(2026, 9, 2, 2, 0, 0));
        let both = a.intersect(&b).unwrap();
        assert_eq!(both.start, utc(2026, 9, 1, 12, 0, 0));
        assert_eq!(both.end, utc(2026, 9, 1, 18, 0, 0));
        let disjoint = ClipBounds::new(utc(2026, 9, 3, 0, 0, 0), utc(2026, 9, 4, 0, 0, 0));
        assert_eq!(a.intersect(&disjoint), None);
    }
}

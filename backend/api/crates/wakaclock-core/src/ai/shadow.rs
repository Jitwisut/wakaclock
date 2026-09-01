//! planai2.md Phase 7 — **shadow mode**.
//!
//! The universal detection pipeline (Phases 3–6) must be able to run without
//! touching production attribution until a precision/recall bar is met. This
//! module is the switch.
//!
//! [`ObserverConfig`] gates the pipeline. `enabled` turns the observer on at
//! all; `attribution_mode` chooses whether its verdicts *feed* production
//! ([`AttributionMode::Infer`]) or are only *recorded for comparison*
//! ([`AttributionMode::ObserveOnly`] — the type default, and the documented
//! rollout-start state is `enabled = true` with the mode left at
//! `observe_only`). Two kill switches — per workspace and per [`EvidenceKind`]
//! — take a project or an evidence source out of the observer with no config
//! migration and no restart, and putting one back is symmetric (planai2.md
//! "rollback ไม่ต้อง migrate หรือลบข้อมูล").
//!
//! [`ShadowRecord`] is the sanitized comparison row: the verdict the engine
//! *proposed* against the native-hook *oracle*, plus the canonical-activity
//! join key and the lineage a Phase 7.4 precision/recall report needs —
//! metadata only, never a diff, prompt, command argument, or file text.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ai::correlation_engine::{AiVerdict, EvidenceKind, Verdict, VerdictReason};
use crate::ai::event::normalize_agent_id;
use crate::ai::path::normalize_lexical;

/// Platform-id normalisation — the analogue of [`normalize_agent_id`] for the
/// editor/CLI surface an evidence source came from. Lower-cases and strips
/// whitespace, so `"VS Code"`, `"vs code"` and `"vscode"` are one id.
fn normalize_platform_id(raw: &str) -> String {
    raw.chars()
        .filter(|c| !c.is_whitespace())
        .flat_map(char::to_lowercase)
        .collect()
}

/// Which agents (or platforms) a staged rollout covers — planai2.md Phase 7,
/// "rollout เปิดแบบ per-agent/per-platform ได้".
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RolloutScope {
    /// Every id — the terminal rollout state.
    #[default]
    All,
    /// Only these ids. An empty set covers **nothing**, so a half-configured
    /// rollout fails closed instead of silently going global.
    Only(BTreeSet<String>),
}

impl RolloutScope {
    /// A staged rollout over exactly these agent ids (each is run through
    /// [`normalize_agent_id`], so `"Claude Code"` and `"claude-code"` match).
    pub fn agents<I, S>(ids: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        Self::Only(
            ids.into_iter()
                .map(|id| normalize_agent_id(id.as_ref()))
                .collect(),
        )
    }

    /// A staged rollout over exactly these platform ids (lower-cased).
    pub fn platforms<I, S>(ids: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        Self::Only(
            ids.into_iter()
                .map(|id| normalize_platform_id(id.as_ref()))
                .collect(),
        )
    }

    /// `id` must already be normalised by the caller.
    fn covers(&self, id: &str) -> bool {
        match self {
            Self::All => true,
            Self::Only(ids) => ids.contains(id),
        }
    }
}

/// Whether the universal observer's verdicts change production attribution.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttributionMode {
    /// Record the proposed attribution and compare it to the native-hook
    /// oracle; **change nothing** in production. The default and the
    /// rollout-start state.
    #[default]
    ObserveOnly,
    /// The observer's verdicts feed production attribution.
    Infer,
}

/// Runtime gate for the universal detection pipeline.
///
/// `Default` is the observer fully off (`enabled = false`), which is also the
/// only state in which [`observe`] both returns no production verdict *and*
/// writes no shadow record.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObserverConfig {
    /// Master switch. `false` is the observer fully off. The documented first
    /// rollout step is `enabled = true` with `attribution_mode` left at
    /// `observe_only` (see [`ObserverConfig::observe_only_rollout_start`]).
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub attribution_mode: AttributionMode,
    /// Per-workspace kill switch: lexically-normalised roots the observer must
    /// ignore even while `enabled`. Adding or removing one is a set edit, not a
    /// migration.
    #[serde(default)]
    pub disabled_workspaces: BTreeSet<PathBuf>,
    /// Per-source kill switch: evidence kinds the ingest path must not feed to
    /// the engine while the observer is running.
    #[serde(default)]
    pub disabled_sources: BTreeSet<EvidenceKind>,
    /// Staged rollout over agents. `All` (the default) is every agent; a
    /// staged rollout narrows it to a named set.
    #[serde(default)]
    pub rollout_agents: RolloutScope,
    /// Staged rollout over platforms (the editor / CLI surface). `All` by
    /// default.
    #[serde(default)]
    pub rollout_platforms: RolloutScope,
}

impl ObserverConfig {
    /// The documented rollout-start config: the observer is on, but every
    /// verdict is shadow-only.
    pub fn observe_only_rollout_start() -> Self {
        Self {
            enabled: true,
            attribution_mode: AttributionMode::ObserveOnly,
            ..Self::default()
        }
    }

    /// Kill switch — stop observing `root`. Returns `true` if it was newly
    /// disabled.
    pub fn disable_workspace(&mut self, root: &Path) -> bool {
        self.disabled_workspaces.insert(normalize_lexical(root))
    }

    /// Undo [`disable_workspace`]. Returns `true` if it had been disabled.
    pub fn enable_workspace(&mut self, root: &Path) -> bool {
        self.disabled_workspaces.remove(&normalize_lexical(root))
    }

    /// Kill switch — stop feeding evidence of `kind` to the engine. Returns
    /// `true` if it was newly disabled.
    pub fn disable_source(&mut self, kind: EvidenceKind) -> bool {
        self.disabled_sources.insert(kind)
    }

    /// Undo [`disable_source`]. Returns `true` if it had been disabled.
    pub fn enable_source(&mut self, kind: EvidenceKind) -> bool {
        self.disabled_sources.remove(&kind)
    }

    /// Is evidence of `kind` live for the observer right now? The ingest path
    /// calls this before handing a `CorrelationInput` to the engine.
    pub fn source_live(&self, kind: EvidenceKind) -> bool {
        self.enabled && !self.disabled_sources.contains(&kind)
    }

    /// Is `root` live for the observer right now?
    pub fn workspace_live(&self, root: &Path) -> bool {
        self.enabled && !self.disabled_workspaces.contains(&normalize_lexical(root))
    }

    /// Is `agent` inside the current staged rollout? Ingest-path predicate,
    /// alongside [`Self::source_live`] and [`Self::workspace_live`].
    pub fn agent_in_rollout(&self, agent: &str) -> bool {
        self.enabled && self.rollout_agents.covers(&normalize_agent_id(agent))
    }

    /// Is `platform` inside the current staged rollout?
    pub fn platform_in_rollout(&self, platform: &str) -> bool {
        self.enabled
            && self
                .rollout_platforms
                .covers(&normalize_platform_id(platform))
    }

    /// Whether the observer is allowed to change production attribution at all.
    /// Only `enabled` **and** [`AttributionMode::Infer`] qualifies; every other
    /// state — including `enabled` + `observe_only` — is shadow.
    pub fn feeds_production(&self) -> bool {
        self.enabled && self.attribution_mode == AttributionMode::Infer
    }
}

/// What a change actually was, per an **independent** dataset label — a tool
/// call's file manifest ⇒ [`LabeledActor::Ai`], a keystroke-logged session ⇒
/// [`LabeledActor::Human`]. Never derived from the engine's `proposed` grade or
/// the adapter's `oracle`; it is the third, independent axis the Phase 7.4
/// precision/recall report scores against.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LabeledActor {
    Ai,
    Human,
}

/// How a proposed verdict lined up with the native-hook oracle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OracleAgreement {
    /// Proposed grade equals the oracle's grade.
    Match,
    /// Proposed grade differs from the oracle's grade.
    Mismatch,
    /// No native-hook oracle fired for this change — the common case, and the
    /// reason shadow mode exists at all.
    NoOracle,
}

/// One sanitized shadow observation.
///
/// Carries the join key ([`ShadowRecord::canonical_fingerprint`], the p6.1
/// canonical-activity id) and lineage a Phase 7.4 report needs. Unlike the
/// engine's [`Verdict`] lineage record — which by p5.5 leaks no fingerprint
/// value — a `ShadowRecord` *does* keep the fingerprint: it is an opaque id and
/// the only thing that lines a proposal up with a verified event. It still
/// carries no diff, prompt, command argument, clipboard, or file text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShadowRecord {
    /// Lexically-normalised path of the changed file.
    pub entity: PathBuf,
    #[serde(default)]
    pub workspace: Option<PathBuf>,
    /// Canonical-activity fingerprint (p6.1) — the report join key.
    #[serde(default)]
    pub canonical_fingerprint: Option<String>,
    /// The grade the universal engine proposed.
    pub proposed: AiVerdict,
    /// Which §5 clause produced the proposal.
    pub proposed_reason: VerdictReason,
    /// The native-hook oracle's grade, when one fired for this change.
    #[serde(default)]
    pub oracle: Option<AiVerdict>,
    /// Independent dataset label for this change, when the shadow corpus has
    /// one. Scored against by the Phase 7.4 report; not set in live capture.
    #[serde(default)]
    pub ground_truth: Option<LabeledActor>,
    /// Producer `lineage_id`s behind the proposal, verbatim (p5.5).
    pub supporting_lineage: Vec<String>,
    pub observed_at: DateTime<Utc>,
}

impl ShadowRecord {
    /// A record for `proposed`, with no oracle and no join key yet.
    pub fn new(entity: &Path, proposed: &Verdict, observed_at: DateTime<Utc>) -> Self {
        Self {
            entity: normalize_lexical(entity),
            workspace: None,
            canonical_fingerprint: None,
            proposed: proposed.verdict,
            proposed_reason: proposed.reason,
            oracle: None,
            ground_truth: None,
            supporting_lineage: proposed.supporting_lineage.clone(),
            observed_at,
        }
    }

    pub fn with_workspace(mut self, root: &Path) -> Self {
        self.workspace = Some(normalize_lexical(root));
        self
    }

    pub fn with_canonical_fingerprint(mut self, fingerprint: impl Into<String>) -> Self {
        self.canonical_fingerprint = Some(fingerprint.into());
        self
    }

    pub fn with_oracle(mut self, oracle: AiVerdict) -> Self {
        self.oracle = Some(oracle);
        self
    }

    pub fn with_ground_truth(mut self, actor: LabeledActor) -> Self {
        self.ground_truth = Some(actor);
        self
    }

    /// How the proposal compared to the oracle.
    pub fn agreement(&self) -> OracleAgreement {
        match self.oracle {
            None => OracleAgreement::NoOracle,
            Some(oracle) if oracle == self.proposed => OracleAgreement::Match,
            Some(_) => OracleAgreement::Mismatch,
        }
    }
}

/// An append-only log of [`ShadowRecord`]s — the dataset a Phase 7.4
/// precision/recall report reads.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ShadowLog {
    records: Vec<ShadowRecord>,
}

impl ShadowLog {
    pub fn record(&mut self, record: ShadowRecord) {
        self.records.push(record);
    }

    pub fn records(&self) -> &[ShadowRecord] {
        &self.records
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    /// `(match, mismatch, no_oracle)` counts across the log.
    pub fn agreement_counts(&self) -> (usize, usize, usize) {
        let mut matched = 0;
        let mut mismatched = 0;
        let mut no_oracle = 0;
        for record in &self.records {
            match record.agreement() {
                OracleAgreement::Match => matched += 1,
                OracleAgreement::Mismatch => mismatched += 1,
                OracleAgreement::NoOracle => no_oracle += 1,
            }
        }
        (matched, mismatched, no_oracle)
    }
}

/// What one correlated change means for production and for the shadow log.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObserverOutcome {
    /// The verdict production should apply, or `None` to leave production's
    /// existing (native-hook / pre-universal) attribution untouched. `None`
    /// whenever the observer is not in `enabled` + [`AttributionMode::Infer`],
    /// or the workspace is killed.
    pub production: Option<Verdict>,
    /// The shadow record to append, or `None` when the observer is fully off.
    pub record: Option<ShadowRecord>,
}

/// Run the observer for one correlated change.
///
/// `proposed` is the universal engine's verdict; `oracle` is the native-hook
/// grade for the same change when one exists. The returned
/// [`ObserverOutcome::production`] is `None` in every state except `enabled` +
/// [`AttributionMode::Infer`] on a live workspace — so `observe_only` never
/// changes production output, which is the Phase 7 acceptance criterion.
pub fn observe(
    config: &ObserverConfig,
    entity: &Path,
    workspace: Option<&Path>,
    proposed: &Verdict,
    oracle: Option<AiVerdict>,
    observed_at: DateTime<Utc>,
) -> ObserverOutcome {
    if !config.enabled {
        return ObserverOutcome {
            production: None,
            record: None,
        };
    }
    if let Some(root) = workspace {
        if !config.workspace_live(root) {
            return ObserverOutcome {
                production: None,
                record: None,
            };
        }
    }

    let mut record = ShadowRecord::new(entity, proposed, observed_at);
    if let Some(root) = workspace {
        record = record.with_workspace(root);
    }
    if let Some(grade) = oracle {
        record = record.with_oracle(grade);
    }

    let production = if config.feeds_production() {
        Some(proposed.clone())
    } else {
        None
    };

    ObserverOutcome {
        production,
        record: Some(record),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WS: &str = "/home/dev/project";
    const FILE: &str = "/home/dev/project/src/lib.rs";

    fn verdict(grade: AiVerdict, reason: VerdictReason) -> Verdict {
        Verdict {
            verdict: grade,
            reason,
            supporting_lineage: vec!["hook:1".to_string(), "fs:2".to_string()],
        }
    }

    fn inferred() -> Verdict {
        verdict(
            AiVerdict::AiInferred,
            VerdictReason::InferredFromAgentActivity,
        )
    }

    #[test]
    fn observer_config_round_trips_and_defaults_to_off_and_observe_only() {
        let config = ObserverConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.attribution_mode, AttributionMode::ObserveOnly);
        assert!(config.disabled_workspaces.is_empty());
        assert!(config.disabled_sources.is_empty());
        assert!(!config.feeds_production());

        let json = serde_json::to_string(&config).unwrap();
        let back: ObserverConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config, back);
    }

    #[test]
    fn the_rollout_start_config_records_but_does_not_feed_production() {
        // planai2.md: "observer.enabled = true / attribution_mode = observe_only"
        // is the state the universal observer must *start* in.
        let config = ObserverConfig::observe_only_rollout_start();
        assert!(config.enabled);
        assert_eq!(config.attribution_mode, AttributionMode::ObserveOnly);
        assert!(!config.feeds_production());

        let outcome = observe(
            &config,
            Path::new(FILE),
            Some(Path::new(WS)),
            &inferred(),
            None,
            Utc::now(),
        );
        assert!(outcome.production.is_none());
        assert!(outcome.record.is_some());
    }

    #[test]
    fn observe_only_and_observer_off_produce_the_same_absence_of_production_attribution() {
        // planai2.md p7.A1 / "observe-only ไม่เปลี่ยน heartbeat/analytics ปัจจุบัน".
        //
        // The full "byte-identical analytics output" claim is trivially true
        // today because `CorrelationEngine` has no production call site — nothing
        // outside this crate's tests consumes a `Verdict`. What this test pins is
        // the switch itself: in `observe_only`, and with the observer off, the
        // production-facing result is the *same* — `None`, i.e. "keep the
        // existing attribution". The real end-to-end assertion lands when a
        // future wiring item connects the engine to the heartbeat path.
        let off = ObserverConfig::default();
        let observe_only = ObserverConfig::observe_only_rollout_start();

        let a = observe(
            &off,
            Path::new(FILE),
            Some(Path::new(WS)),
            &inferred(),
            None,
            Utc::now(),
        );
        let b = observe(
            &observe_only,
            Path::new(FILE),
            Some(Path::new(WS)),
            &inferred(),
            None,
            Utc::now(),
        );

        assert_eq!(a.production, None);
        assert_eq!(b.production, None);
        assert!(!off.feeds_production());
        assert!(!observe_only.feeds_production());
    }

    #[test]
    fn flipping_to_infer_is_the_only_switch_that_changes_production_output() {
        let entity = Path::new(FILE);
        let ws = Some(Path::new(WS));
        let proposed = inferred();

        let observe_only = ObserverConfig::observe_only_rollout_start();
        assert_eq!(
            observe(&observe_only, entity, ws, &proposed, None, Utc::now()).production,
            None
        );

        // Toggling the kill switches on the observe-only config still yields no
        // production effect — they are not the switch that matters here.
        let mut fiddled = observe_only.clone();
        fiddled.disable_source(EvidenceKind::NativeHook);
        fiddled.disable_workspace(Path::new("/some/other/ws"));
        assert_eq!(
            observe(&fiddled, entity, ws, &proposed, None, Utc::now()).production,
            None
        );

        // Change *only* the mode.
        let mut inferring = observe_only.clone();
        inferring.attribution_mode = AttributionMode::Infer;
        let outcome = observe(&inferring, entity, ws, &proposed, None, Utc::now());
        assert_eq!(outcome.production, Some(proposed));
    }

    #[test]
    fn a_per_source_kill_switch_disables_exactly_that_source() {
        let mut config = ObserverConfig::observe_only_rollout_start();
        assert!(config.disable_source(EvidenceKind::NativeHook));
        assert!(!config.disable_source(EvidenceKind::NativeHook)); // idempotent

        assert!(!config.source_live(EvidenceKind::NativeHook));
        for kind in [
            EvidenceKind::StructuredMcp,
            EvidenceKind::CompletedTranscriptToolCall,
            EvidenceKind::ToolSnapshot,
            EvidenceKind::FilesystemObserver,
            EvidenceKind::SessionProcessObserver,
            EvidenceKind::EditorInput,
        ] {
            assert!(config.source_live(kind), "{kind:?} should stay live");
        }

        assert!(config.enable_source(EvidenceKind::NativeHook));
        assert!(config.source_live(EvidenceKind::NativeHook));
    }

    #[test]
    fn a_per_workspace_kill_switch_removes_only_that_workspace() {
        let mut config = ObserverConfig::observe_only_rollout_start();
        config.attribution_mode = AttributionMode::Infer;
        config.disable_workspace(Path::new("/home/dev/project"));

        let killed = observe(
            &config,
            Path::new("/home/dev/project/src/lib.rs"),
            Some(Path::new("/home/dev/project")),
            &inferred(),
            None,
            Utc::now(),
        );
        assert_eq!(killed.production, None);
        assert_eq!(killed.record, None);

        let live = observe(
            &config,
            Path::new("/home/dev/other/src/lib.rs"),
            Some(Path::new("/home/dev/other")),
            &inferred(),
            None,
            Utc::now(),
        );
        assert!(live.production.is_some());
        assert!(live.record.is_some());

        // A non-normalised form of the same root is still killed.
        assert!(!config.workspace_live(Path::new("/home/dev/project/../project")));
    }

    #[test]
    fn a_shadow_record_is_metadata_only() {
        let record = ShadowRecord::new(Path::new(FILE), &inferred(), Utc::now())
            .with_workspace(Path::new(WS))
            .with_canonical_fingerprint("caf1:9d0e")
            .with_oracle(AiVerdict::AiVerified);

        let json = serde_json::to_string(&record).unwrap();
        // The join key and lineage are allowed — they are opaque ids.
        assert!(json.contains("canonical_fingerprint"));
        assert!(json.contains("supporting_lineage"));
        assert!(json.contains("\"proposed\""));
        assert!(json.contains("\"oracle\""));
        // Evidence content never is.
        for forbidden in [
            "\"content",
            "\"diff",
            "\"patch",
            "\"prompt",
            "\"source",
            "\"text",
            "\"body",
            "\"argv",
            "clipboard",
        ] {
            assert!(!json.contains(forbidden), "leaked content field: {json}");
        }
    }

    #[test]
    fn oracle_agreement_is_match_mismatch_or_no_oracle() {
        let base = ShadowRecord::new(Path::new(FILE), &inferred(), Utc::now());
        assert_eq!(base.clone().agreement(), OracleAgreement::NoOracle);
        assert_eq!(
            base.clone().with_oracle(AiVerdict::AiInferred).agreement(),
            OracleAgreement::Match
        );
        assert_eq!(
            base.clone().with_oracle(AiVerdict::Human).agreement(),
            OracleAgreement::Mismatch
        );

        let mut log = ShadowLog::default();
        log.record(base.clone());
        log.record(base.clone().with_oracle(AiVerdict::AiInferred));
        log.record(base.with_oracle(AiVerdict::Human));
        assert_eq!(log.agreement_counts(), (1, 1, 1));
        assert_eq!(log.len(), 3);
    }

    // ---- planai2.md Phase 7 acceptance criteria ------------------------------
    //
    // p7.A1 and p7.A4's "does not change / deletes no data" clauses are checked
    // at the module-contract level. The full end-to-end claim (no diff in
    // heartbeat / analytics output) holds today only because `CorrelationEngine`
    // has no production call site — see the Phase 7 acceptance heading in
    // planai2-progress.md and the p7.3 / p7.4 Decisions-log entries. The
    // wiring item owes the end-to-end assertion.

    #[test]
    fn p7_a1_observe_only_mode_does_not_change_current_output() {
        let proposals = [
            inferred(),
            verdict(AiVerdict::AiVerified, VerdictReason::DirectAiProducer),
            verdict(AiVerdict::Human, VerdictReason::PositiveEditorInput),
        ];
        let off = ObserverConfig::default();
        let observe_only = ObserverConfig::observe_only_rollout_start();

        for proposed in &proposals {
            let with_observer = observe(
                &observe_only,
                Path::new(FILE),
                Some(Path::new(WS)),
                proposed,
                None,
                Utc::now(),
            );
            let without = observe(
                &off,
                Path::new(FILE),
                Some(Path::new(WS)),
                proposed,
                None,
                Utc::now(),
            );
            // Same production-facing result — nothing — as the observer being
            // off, for every grade.
            assert_eq!(with_observer.production, None);
            assert_eq!(without.production, None);
        }
    }

    #[test]
    fn p7_a3_rollout_is_enabled_per_agent_and_per_platform() {
        let mut staged = ObserverConfig::observe_only_rollout_start();
        staged.rollout_agents = RolloutScope::agents(["Claude Code"]);
        staged.rollout_platforms = RolloutScope::platforms(["VS Code"]);

        // Per-agent: only the named agent is in the rollout, normalisation and
        // all.
        assert!(staged.agent_in_rollout("claude-code"));
        assert!(staged.agent_in_rollout("claude")); // normalises to claude-code
        assert!(!staged.agent_in_rollout("cursor"));

        // Per-platform: independent of the agent scope.
        assert!(staged.platform_in_rollout("vscode"));
        assert!(staged.platform_in_rollout("VS Code"));
        assert!(!staged.platform_in_rollout("jetbrains"));

        // `All` (the default / terminal state) covers everyone.
        let wide = ObserverConfig::observe_only_rollout_start();
        assert!(wide.agent_in_rollout("anything"));
        assert!(wide.platform_in_rollout("anything"));

        // An empty `Only` fails closed, and a disabled observer is in no
        // rollout at all.
        let mut closed = ObserverConfig::observe_only_rollout_start();
        closed.rollout_agents = RolloutScope::Only(BTreeSet::new());
        assert!(!closed.agent_in_rollout("claude-code"));
        let mut disabled = staged.clone();
        disabled.enabled = false;
        assert!(!disabled.agent_in_rollout("claude-code"));
    }

    #[test]
    fn p7_a4_rollback_needs_no_migration_and_deletes_no_data() {
        // (a) No migration: a pre-rollout config JSON — none of the rollout /
        // kill-switch fields — still deserializes, defaulting to "wide open".
        let legacy = r#"{"enabled":true,"attribution_mode":"infer"}"#;
        let cfg: ObserverConfig = serde_json::from_str(legacy).unwrap();
        assert!(cfg.enabled);
        assert_eq!(cfg.rollout_agents, RolloutScope::All);
        assert_eq!(cfg.rollout_platforms, RolloutScope::All);
        assert!(cfg.disabled_workspaces.is_empty());
        assert!(cfg.disabled_sources.is_empty());

        // (b) Turning the observer off is a single in-place field flip that
        // loses nothing: re-enabling restores the exact same config.
        let mut full = ObserverConfig::observe_only_rollout_start();
        full.attribution_mode = AttributionMode::Infer;
        full.disable_source(EvidenceKind::NativeHook);
        full.disable_workspace(Path::new("/ws/a"));
        full.rollout_agents = RolloutScope::agents(["claude-code"]);

        let mut rolled_back = full.clone();
        rolled_back.enabled = false;
        let round_tripped: ObserverConfig =
            serde_json::from_str(&serde_json::to_string(&rolled_back).unwrap()).unwrap();
        let mut restored = round_tripped;
        restored.enabled = true;
        assert_eq!(restored, full, "rollback + re-enable is lossless");

        // (c) The shadow log is append-only — `record` only grows it and there
        // is no clear / drain / remove. A rollback stops appending; it deletes
        // nothing already captured.
        let mut log = ShadowLog::default();
        assert_eq!(log.len(), 0);
        log.record(ShadowRecord::new(Path::new(FILE), &inferred(), Utc::now()));
        log.record(ShadowRecord::new(Path::new(FILE), &inferred(), Utc::now()));
        assert_eq!(log.len(), 2);
        assert_eq!(log.records().len(), 2);
    }
}

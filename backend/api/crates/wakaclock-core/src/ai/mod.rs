//! AI-agent transcript attribution (plan.md Phase 8). This module holds the
//! transcript-parsing pipeline that runs in `wakaclock-cli`/`wakaclock-core`; it is
//! separate from the hook-based fallback shipped in `extensions/ai-agents/`, which
//! posts heartbeats directly without going through this normalized event model.
//!
//! `event.rs`, `patch.rs`, `path.rs` and `parser.rs` hold pure, I/O-free types and the
//! shared parser contract. `codex.rs` and `claude.rs` are real, file-reading
//! implementations validated against fixtures derived from real local transcripts (see
//! `CAPABILITIES.md`). `gemini.rs` accepts the stable JSON/JSONL edit-result contract
//! used by Gemini CLI releases and ignores any unproven conversational claims.
//! `correlation.rs` matches AI events to editor-observed buffers (in-memory pool
//! only). `sidecar.rs` is a lighter-weight, time-and-entity-only check against the same
//! broker-written JSONL file `extensions/vscode/src/aiAttribution.ts` reads, for
//! editor producers that don't track line deltas per change (currently
//! `wakaclock-ls`). `state.rs` persists parser cursors and delivered-event identity to
//! SQLite so a re-run doesn't re-attribute the same edit twice; `wakaclock ai sync`
//! takes the companion cross-process `~/.wakaclock/ai-sync.lock` across scan, delivery
//! and state commit so overlapping sync processes exit as a nonfatal `AlreadyRunning`
//! result.

pub mod adapter;
pub mod claude;
pub mod codex;
pub mod correlation;
pub mod event;
pub mod filesystem_observer;
pub mod follow_up;
pub mod gemini;
mod jsonl;
pub mod parser;
pub mod patch;
pub mod path;
pub mod process_observer;
pub mod sidecar;
pub mod state;
pub mod usage;
pub mod workspace;

pub use adapter::{
    AdapterManifest, AdapterRegistry, ExecutableDetection, HealthProbe, InstallContext,
    InstallOutcome, InstallStrategy, NativeHookCapabilities, Verification, VerificationStatus,
};
pub use claude::ClaudeCodeParser;
pub use codex::CodexParser;
pub use correlation::{
    correlate, expire_unmatched, AiAttribution, CorrelationOutcome, EditorObservation,
};
pub use event::{normalize_agent_id, AiConfidence, AiEditEvent, AiEventSource};
pub use filesystem_observer::{
    canonicalize_within_root, coalesce_burst, fingerprint_changed_file, is_excluded_path,
    FileChangeKind, FileChangedEvent, ObserverPool, SyncOutcome, WorkspaceIgnore, WorkspaceWatcher,
};
pub use follow_up::{AiLineOwnership, FollowUpRate, HumanFollowUpEvent, HumanFollowUpLedger};
pub use gemini::GeminiCliParser;
pub use parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor, TranscriptLag,
};
pub use patch::{
    count_content_lines, count_structured_patch_lines, count_unified_diff_lines, parse_apply_patch,
    ApplyPatchFileChange, LineDelta, StructuredPatchHunk,
};
pub use path::{
    normalize_lexical, resolve_within_workspace, to_comparable_string, PathResolveError,
};
pub use process_observer::{
    match_agent as match_ai_process_agent, scan as scan_ai_processes, DetectedAiProcess,
};
pub use sidecar::{has_nearby_event, has_nearby_event_in_home_dir};
pub use state::AiAttributionState;
pub use usage::{
    parse_claude_usage, parse_claude_usage_str, parse_codex_usage, parse_codex_usage_str,
    parse_gemini_usage, parse_gemini_usage_str, AiUsageIngestReport, AiUsageRecord, TokenSource,
};
pub use workspace::{workspace_id_for, LeaseError, WorkspaceLease, WorkspaceRegistry};

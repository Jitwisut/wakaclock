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
//! only). `state.rs` persists parser cursors and delivered-event identity to SQLite so
//! a re-run doesn't re-attribute the same edit twice; the cross-process `ai-sync.lock`
//! plan.md 8.6 also calls for is not yet implemented (see state.rs's doc comment for
//! why a single local writer is safe without it, just uncoordinated).
//!
//! Several modules from the wider universal-adapter research line
//! (`correlation_engine`, `dedup`, `filesystem_observer`, `intake`, `pipeline`,
//! `process_observer`, `session`, `shadow`, `shadow_corpus`, `shadow_report`,
//! `sidecar`, `workspace`) exist on disk as reference material but are
//! deliberately not declared here — see `plans/decision-accuracy-over-coverage.md`.
//! `intake.rs` is the producer→correlation_engine bridge for that research line and
//! has no other caller, so it stays excluded alongside the engine it feeds.
//! Identity may only come from a native hook, a structured MCP event, or a completed
//! transcript tool call; filesystem/process correlation stays a diagnostics-only
//! research line, never a production attribution source.
//!
//! `canonical.rs` is declared — unlike its research-line siblings — because
//! `fingerprint_for_heartbeat` is a real, needed dependency of the server's
//! heartbeat dedup key (`backend/api/src/services/heartbeat.rs`) and is pure
//! hashing over already-known metadata, never identity inference. Its
//! multi-producer evidence-folding types (`CanonicalActivity`/`ChildEvidence`,
//! which do need `correlation_engine::EvidenceKind`) live in `dedup.rs`
//! instead, so `canonical.rs` itself has no path to the excluded engine.

pub mod adapter;
pub mod canonical;
pub mod claude;
pub mod codex;
pub mod correlation;
pub mod diagnostics;
pub mod event;
pub mod follow_up;
pub mod gemini;
mod jsonl;
pub mod parser;
pub mod patch;
pub mod path;
pub mod producer;
pub mod provider;
pub mod revision;
pub mod state;
pub mod usage;

pub use adapter::{AdapterManifest, AdapterRegistry, InstallStrategy};
pub use canonical::fingerprint_for_heartbeat;
pub use claude::ClaudeCodeParser;
pub use codex::CodexParser;
pub use correlation::{
    correlate, expire_unmatched, AiAttribution, CorrelationOutcome, EditorObservation,
};
pub use diagnostics::{
    build_report as build_ai_diagnostics_report, AdapterFreshness, AdapterFreshnessV2,
    AiDiagnosticsReport, AiDiagnosticsReportV2, AttributionMode, BrokerHealth, BrokerHealthV2,
    DiagnosticMeasurement, DiagnosticsConsent, MeasurementAvailability, ObserverConfig,
    ParserLagSummary, ParserLagSummaryV2, RuntimeHealth, VerificationStatus,
    AI_DIAGNOSTICS_SCHEMA_VERSION, AI_DIAGNOSTICS_SCHEMA_VERSION_V2,
};
pub use event::{
    is_known_agent_id, normalize_agent_id, AiConfidence, AiEditEvent, AiEventSource,
    KNOWN_AGENT_IDS,
};
pub use follow_up::{AiLineOwnership, FollowUpRate, HumanFollowUpEvent, HumanFollowUpLedger};
pub use gemini::GeminiCliParser;
pub use parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor, TranscriptLag,
};
pub use patch::{
    count_content_lines, count_structured_patch_lines, count_unified_diff_lines, LineDelta,
    StructuredPatchHunk,
};
pub use path::{
    normalize_lexical, resolve_within_workspace, to_comparable_string, PathResolveError,
};
pub use producer::{
    normalize_client_id, normalize_model_id, normalize_provider_id, PRODUCER_CONTRACT_VERSION,
};
pub use provider::{
    canonical_provider_alias, is_known_provider_id, provider_aliases, provider_for_endpoint,
    KNOWN_PROVIDER_IDS,
};
pub use revision::{
    prove_alias, AliasEvidence, AliasProofKind, AttributionRetentionPolicy, AttributionRevision,
    RevisionCandidate, RevisionWriteOutcome, ATTRIBUTION_REVISION_RETENTION_SECONDS,
    EVENT_ALIAS_RETENTION_SECONDS, LATE_RECONCILIATION_GRACE_SECONDS,
    PENDING_OBSERVATION_RETENTION_SECONDS,
};
pub use state::AiAttributionState;
pub use usage::{
    parse_claude_usage, parse_claude_usage_str, parse_codex_usage, parse_codex_usage_str,
    parse_gemini_usage, parse_gemini_usage_str, AiUsageIngestReport, AiUsageRecord, TokenSource,
};

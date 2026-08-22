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

pub mod claude;
pub mod codex;
pub mod correlation;
pub mod event;
pub mod gemini;
mod jsonl;
pub mod parser;
pub mod patch;
pub mod path;
pub mod state;
pub mod usage;

pub use claude::ClaudeCodeParser;
pub use codex::CodexParser;
pub use correlation::{
    correlate, expire_unmatched, AiAttribution, CorrelationOutcome, EditorObservation,
};
pub use event::{normalize_agent_id, AiConfidence, AiEditEvent, AiEventSource};
pub use gemini::GeminiCliParser;
pub use parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor,
};
pub use patch::{
    count_content_lines, count_structured_patch_lines, count_unified_diff_lines, LineDelta,
    StructuredPatchHunk,
};
pub use path::{
    normalize_lexical, resolve_within_workspace, to_comparable_string, PathResolveError,
};
pub use state::AiAttributionState;
pub use usage::{
    parse_claude_usage, parse_claude_usage_str, parse_codex_usage, parse_codex_usage_str,
    parse_gemini_usage, parse_gemini_usage_str, AiUsageIngestReport, AiUsageRecord, TokenSource,
};

//! AI-agent transcript attribution (plan.md Phase 8). This module holds the
//! transcript-parsing pipeline that runs in `wakaclock-cli`/`wakaclock-core`; it is
//! separate from the hook-based fallback shipped in `extensions/ai-agents/`, which
//! posts heartbeats directly without going through this normalized event model.
//!
//! Only `event.rs`, `patch.rs`, `path.rs` and `parser.rs` exist so far — pure,
//! I/O-free types and the shared parser contract, validated against fixtures derived
//! from real local transcripts (see `CAPABILITIES.md`). `correlation.rs`, `state.rs`
//! and the per-agent parsers (`codex.rs`, `claude.rs`, `gemini.rs`) are not yet
//! implemented.

pub mod event;
pub mod parser;
pub mod patch;
pub mod path;

pub use event::{normalize_agent_id, AiConfidence, AiEditEvent, AiEventSource};
pub use parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor,
};
pub use patch::{
    count_structured_patch_lines, count_unified_diff_lines, LineDelta, StructuredPatchHunk,
};
pub use path::{
    normalize_lexical, resolve_within_workspace, to_comparable_string, PathResolveError,
};

//! AI-agent transcript attribution (plan.md Phase 8). This module holds the
//! transcript-parsing pipeline that runs in `wakaclock-cli`/`wakaclock-core`; it is
//! separate from the hook-based fallback shipped in `extensions/ai-agents/`, which
//! posts heartbeats directly without going through this normalized event model.
//!
//! `event.rs`, `patch.rs`, `path.rs` and `parser.rs` hold pure, I/O-free types and the
//! shared parser contract. `codex.rs` and `claude.rs` are real, file-reading
//! implementations validated against fixtures derived from real local transcripts (see
//! `CAPABILITIES.md`). `gemini.rs` is not implemented — Gemini CLI wasn't available to
//! verify a real transcript shape against, see `fixtures/gemini_cli/README.md`.
//! `correlation.rs` and `state.rs` (matching events to editor heartbeats, cross-process
//! cursor persistence) are not yet implemented.

pub mod claude;
pub mod codex;
pub mod event;
mod jsonl;
pub mod parser;
pub mod patch;
pub mod path;

pub use claude::ClaudeCodeParser;
pub use codex::CodexParser;
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

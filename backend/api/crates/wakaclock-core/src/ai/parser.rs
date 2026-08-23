use crate::ai::event::AiEditEvent;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

/// Where to look for a transcript before falling back to platform-specific default
/// locations (plan.md 8.4: "Resolve paths from an explicit Wakaclock configuration
/// override first, then agent configuration/environment, then documented
/// platform-specific candidate paths").
#[derive(Debug, Clone, Default)]
pub struct DiscoveryContext {
    pub home_dir: PathBuf,
    pub config_override: Option<PathBuf>,
}

/// The five states a parser must be able to report distinctly (plan.md 8.4), surfaced
/// as-is in `wakaclock ai status` and the extension status UI — collapsing any of these
/// into a generic "not working" loses information a user needs to self-diagnose.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiscoveryState {
    NotInstalled,
    InstalledNoTranscript,
    TranscriptFound {
        path: PathBuf,
    },
    PermissionDenied {
        path: PathBuf,
    },
    UnsupportedVersion {
        path: PathBuf,
        found_version: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiscoveryResult {
    pub state: DiscoveryState,
}

/// Bounds on a single parse pass so a malformed or extremely large transcript cannot
/// cause unbounded memory/CPU use on every 30-second heartbeat flush (plan.md 8.4).
#[derive(Debug, Clone, Copy)]
pub struct ParseContext {
    pub max_record_bytes: usize,
    pub max_batch_records: usize,
}

impl Default for ParseContext {
    fn default() -> Self {
        Self {
            max_record_bytes: 1024 * 1024,
            max_batch_records: 2_000,
        }
    }
}

/// Enough identity to survive log rotation: source path plus a file-identity marker
/// (e.g. inode where available), a byte offset, and the last stable record seen
/// (plan.md 8.4: "cursor should include enough identity to survive log rotation").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParserCursor {
    pub source_path: String,
    pub file_identity: Option<String>,
    pub byte_offset: u64,
    pub last_record_id: Option<String>,
    pub last_record_time: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct ParseWarning {
    pub record_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct ParseBatch {
    pub events: Vec<AiEditEvent>,
    pub next_cursor: ParserCursor,
    pub warnings: Vec<ParseWarning>,
}

#[derive(Debug, Error)]
pub enum AiParseError {
    #[error("transcript not found at {path}")]
    NotFound { path: String },
    #[error("permission denied reading {path}")]
    PermissionDenied { path: String },
    #[error("unsupported transcript schema version: {version:?}")]
    UnsupportedSchema { version: Option<String> },
    #[error("malformed record: {0}")]
    Malformed(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

/// One implementation per supported agent (`codex.rs`, `claude.rs`, `gemini.rs`).
/// Correlation logic (`correlation.rs`, not yet implemented) depends only on this
/// trait, never on an individual parser, so a new agent adds a struct here without
/// touching matching logic (plan.md 8.4/8.5.4).
pub trait AiActivityParser {
    /// Stable identifier, e.g. `"codex"`. Must match [`crate::ai::event::normalize_agent_id`]'s
    /// output for this agent.
    fn id(&self) -> &'static str;

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult;

    /// Return every usable transcript source. The original `discover` API reports the
    /// newest source for backwards compatibility, while the always-on agent uses this
    /// additive method so concurrent sessions are never silently skipped.
    fn discover_sources(&self, context: &DiscoveryContext) -> Vec<DiscoveryResult> {
        vec![self.discover(context)]
    }

    /// Errors here must be isolated per agent — plan.md 8.4: "One broken Claude record
    /// must not suppress a valid Codex batch or the ordinary editor heartbeat," so
    /// callers should treat an `Err` as "skip this agent for this cycle," never as fatal.
    fn parse_since(
        &self,
        context: &ParseContext,
        cursor: Option<&ParserCursor>,
    ) -> Result<ParseBatch, AiParseError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovery_states_are_distinguishable() {
        let states = [
            DiscoveryState::NotInstalled,
            DiscoveryState::InstalledNoTranscript,
            DiscoveryState::TranscriptFound {
                path: PathBuf::from("/home/dev/.claude/projects/x/y.jsonl"),
            },
            DiscoveryState::PermissionDenied {
                path: PathBuf::from("/home/dev/.codex/sessions"),
            },
            DiscoveryState::UnsupportedVersion {
                path: PathBuf::from("/home/dev/.claude/projects/x/y.jsonl"),
                found_version: Some("99".to_string()),
            },
        ];
        for (i, a) in states.iter().enumerate() {
            for (j, b) in states.iter().enumerate() {
                assert_eq!(a == b, i == j);
            }
        }
    }

    #[test]
    fn default_parse_context_bounds_batch_size() {
        let context = ParseContext::default();
        assert!(context.max_record_bytes > 0);
        assert!(context.max_batch_records > 0);
    }
}

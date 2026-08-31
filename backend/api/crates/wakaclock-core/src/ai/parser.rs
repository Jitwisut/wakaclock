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

/// planai2.md Phase 0.4: byte-level scanner health for one transcript, so
/// `wakaclock doctor ai` can say *how far behind* a scanner is — not just whether
/// it has ever run. `lag_bytes` is what a growing-file follower still owes;
/// `ever_scanned` distinguishes "cursor at 0 because brand new" from "cursor at 0
/// because the scanner never ran".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct TranscriptLag {
    pub file_size: u64,
    pub cursor_offset: u64,
    pub lag_bytes: u64,
    pub ever_scanned: bool,
    pub last_event_at: Option<DateTime<Utc>>,
}

impl TranscriptLag {
    /// `file_size` is the transcript's current length; `cursor` is the saved parser
    /// cursor for it, if any. A cursor whose offset runs past the file (rotation,
    /// truncation) reports zero lag rather than a nonsensical negative.
    pub fn measure(file_size: u64, cursor: Option<&ParserCursor>) -> Self {
        let cursor_offset = cursor.map(|c| c.byte_offset).unwrap_or(0);
        Self {
            file_size,
            cursor_offset,
            lag_bytes: file_size.saturating_sub(cursor_offset),
            ever_scanned: cursor.is_some(),
            last_event_at: cursor.and_then(|c| c.last_record_time),
        }
    }
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

    #[test]
    fn transcript_lag_reports_bytes_owed_and_scan_history() {
        // Never scanned: cursor absent → full file is lag, ever_scanned false.
        let fresh = TranscriptLag::measure(4096, None);
        assert_eq!(fresh.lag_bytes, 4096);
        assert_eq!(fresh.cursor_offset, 0);
        assert!(!fresh.ever_scanned);
        assert!(fresh.last_event_at.is_none());

        // Partially scanned: lag is the unread tail.
        let cursor = ParserCursor {
            source_path: "/x.jsonl".to_string(),
            file_identity: None,
            byte_offset: 3000,
            last_record_id: Some("r1".to_string()),
            last_record_time: Some(DateTime::<Utc>::from_timestamp(1_700_000_000, 0).unwrap()),
        };
        let behind = TranscriptLag::measure(4096, Some(&cursor));
        assert_eq!(behind.lag_bytes, 1096);
        assert!(behind.ever_scanned);
        assert!(behind.last_event_at.is_some());

        // Rotation/truncation: cursor past EOF → zero lag, not a wraparound.
        let rotated = TranscriptLag::measure(10, Some(&cursor));
        assert_eq!(rotated.lag_bytes, 0);
    }
}

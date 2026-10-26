use crate::ai::event::AiEditEvent;
use crate::ai::source::{SourceCheckpoint, SourceKind};
use crate::ai::usage::AiUsageRecord;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
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
    /// Wall-clock budget for one parser pass. Readers of SQLite or whole-document
    /// sources stop at this budget and resume from their checkpoint next pass.
    pub time_budget: Duration,
    /// Upper bound on bytes a non-JSONL reader may load in one pass.
    pub max_read_bytes: u64,
}

impl Default for ParseContext {
    fn default() -> Self {
        Self {
            max_record_bytes: 1024 * 1024,
            max_batch_records: 2_000,
            time_budget: Duration::from_secs(5),
            max_read_bytes: 64 * 1024 * 1024,
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
    /// Parser context is checkpointed with the byte cursor so a bounded read or
    /// process restart cannot borrow a model from a different turn/session. Older
    /// checkpoints deserialize with `None`; adapters then rebuild a bounded prefix.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<ParserContext>,
}

/// Serializable, adapter-neutral transcript context. Codex uses `turns` and
/// `pending_calls`; Claude Code uses the same pending-call shape for `tool_use_id`.
/// Only metadata needed to pair a completed edit is retained — never prompts,
/// responses, patches or source code.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct ParserContext {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub session_cwd: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    /// Why provider evidence is incomplete, when a transcript explicitly
    /// reported an internal/synthetic marker.
    #[serde(default)]
    pub provider_reason: Option<String>,
    /// The transcript reported two different providers for this session. Keep
    /// the conflict bit even when normalization drops both values so a later
    /// file edit cannot silently inherit whichever record happened to be last.
    #[serde(default)]
    pub provider_conflict: bool,
    /// The execution surface reported by transcript session metadata. This is
    /// intentionally separate from editor evidence: `originator` can tell us
    /// that Codex Desktop produced the transcript, but cannot prove that VS Code
    /// was open for the same workspace.
    #[serde(default)]
    pub producer_surface: Option<String>,
    /// True once the adapter has read the session metadata for this transcript.
    /// This lets an upgrade replay only the bounded metadata prefix once when an
    /// old checkpoint did not yet persist `originator`, without rescanning every
    /// pass for agents that have no surface label.
    #[serde(default)]
    pub producer_surface_seen: bool,
    #[serde(default)]
    pub current_turn_id: Option<String>,
    #[serde(default)]
    pub turns: Vec<ParserTurnContext>,
    #[serde(default)]
    pub pending_calls: Vec<ParserPendingCall>,
    /// Resume point for a SQLite or whole-document source. JSONL parsers leave it
    /// `None` and keep using the cursor's byte offset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<SourceCheckpoint>,
    /// Oldest usage time (Unix milliseconds) a database-backed source may report. One
    /// database holds a tool's whole history, so on first sight only the last day is
    /// read, matching the replay window for JSONL files; seeding sets it to now.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub history_floor_ms: Option<i64>,
}

/// How far back a database-backed source reports usage the first time it is read.
pub const SHARED_SOURCE_HISTORY: chrono::Duration = chrono::Duration::hours(24);

/// The usage floor stored in `cursor`, or the first-sight window ending at `now`.
pub fn history_floor(cursor: Option<&ParserCursor>, now: DateTime<Utc>) -> DateTime<Utc> {
    cursor
        .and_then(|cursor| cursor.context.as_ref())
        .and_then(|context| context.history_floor_ms)
        .and_then(DateTime::<Utc>::from_timestamp_millis)
        .unwrap_or(now - SHARED_SOURCE_HISTORY)
}

/// Keep the floor chosen on first sight so later passes do not move it.
pub fn keep_history_floor(context: &mut ParserContext, cursor: &ParserCursor, now: DateTime<Utc>) {
    if context.history_floor_ms.is_none() {
        context.history_floor_ms = Some(history_floor(Some(cursor), now).timestamp_millis());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParserTurnContext {
    pub id: String,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    /// Why the turn's model evidence is incomplete, when a provider marker such
    /// as `<synthetic>` was explicitly reported.  This is metadata-only and lets
    /// repair distinguish a marker from a genuinely absent field after restart.
    #[serde(default)]
    pub identity_reason: Option<String>,
    /// The same turn carried incompatible model evidence.
    #[serde(default)]
    pub identity_conflict: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParserPendingCall {
    pub id: String,
    #[serde(default)]
    pub turn_id: Option<String>,
    /// Message identifier that owns this call when the transcript exposes one.
    /// It is kept separately from the tool/call id because a message can contain
    /// several tool uses and repair must never substitute one for the other.
    #[serde(default)]
    pub identity_message_id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub identity_reason: Option<String>,
    /// The call's direct/turn evidence conflicted before its completion record.
    #[serde(default)]
    pub identity_conflict: bool,
    #[serde(default)]
    pub cwd: Option<String>,
    /// Kept for backwards compatibility with checkpoints written by an older
    /// parser. New checkpoints leave this empty and rewind to the call record so
    /// source/patch text is never persisted in parser state.
    #[serde(default)]
    pub input: Option<String>,
    #[serde(default)]
    pub occurred_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub offset_before: Option<u64>,
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
    /// Rows a SQLite source still owes; `None` for byte-addressed sources.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lag_rows: Option<u64>,
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
            lag_rows: None,
        }
    }

    /// Lag for a SQLite source: `max_rowid` is the store's current highest rowid and
    /// the cursor's [`SourceCheckpoint::Sqlite`] holds the last row already read.
    pub fn measure_rows(max_rowid: i64, cursor: Option<&ParserCursor>) -> Self {
        let last_rowid = cursor
            .and_then(|c| c.context.as_ref())
            .and_then(|context| match context.source {
                Some(SourceCheckpoint::Sqlite { last_rowid, .. }) => Some(last_rowid),
                _ => None,
            })
            .unwrap_or(0);
        Self {
            file_size: 0,
            cursor_offset: 0,
            lag_bytes: 0,
            ever_scanned: cursor.is_some(),
            last_event_at: cursor.and_then(|c| c.last_record_time),
            lag_rows: Some(max_rowid.saturating_sub(last_rowid).max(0) as u64),
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
pub trait AiActivityParser: Send + Sync {
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

    /// How this parser's source is addressed. Every existing parser reads JSONL.
    fn source_kind(&self) -> SourceKind {
        SourceKind::Jsonl
    }

    /// Token/prompt usage found in `source`. Usage is kept separate from edit events
    /// because one model response can edit several files. `cursor` lets a parser
    /// read incrementally; parsers that rescan the whole source may ignore it.
    fn parse_usage(
        &self,
        _source: &Path,
        _cursor: Option<&ParserCursor>,
    ) -> std::io::Result<Vec<AiUsageRecord>> {
        Ok(Vec::new())
    }

    /// [`Self::parse_usage`] limited to `budget`, for the bounded automatic pass. Parsers
    /// that read a large shared database override it; the default ignores the budget.
    fn parse_usage_within(
        &self,
        source: &Path,
        cursor: Option<&ParserCursor>,
        _budget: Duration,
    ) -> std::io::Result<Vec<AiUsageRecord>> {
        self.parse_usage(source, cursor)
    }

    /// Whether a saved cursor can resume against a source whose current length is
    /// `source_len`. For JSONL a cursor past the end means the file was replaced.
    fn cursor_is_reusable(&self, cursor: &ParserCursor, source_len: u64) -> bool {
        cursor.byte_offset <= source_len
    }

    /// The cursor used to skip a source's existing history on first discovery, so
    /// enabling an adapter does not upload months of past sessions.
    fn seed_at_head(&self, cursor: &ParserCursor, source_len: u64) -> ParserCursor {
        let mut seeded = cursor.clone();
        seeded.byte_offset = source_len;
        seeded
    }
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
            context: None,
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

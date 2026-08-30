use crate::ai::follow_up::HumanFollowUpLedger;
use crate::ai::parser::ParserCursor;
use crate::error::AppError;
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Local, per-machine parser cursors and delivered-event identity — plan.md 8.6's
/// `ai-attribution.sqlite3`. This is deliberately separate from `queue.rs`'s
/// `heartbeat_queue`: that table holds heartbeats waiting to be *sent*, this one
/// tracks which AI events have *already* been turned into a heartbeat, so a re-run of
/// `wakaclock ai sync` against the same transcript never re-attributes the same edit
/// twice (plan.md 8.0's required outcome: "exactly one AI edit event for that patch").
///
/// Not yet implemented: the cross-process `ai-sync.lock` plan.md 8.6 also calls for.
/// A single local SQLite writer already serializes concurrent opens at the OS/SQLite
/// level, so two overlapping `wakaclock ai sync` invocations won't corrupt state —
/// they just aren't coordinated to skip redundant work, which the lock exists for.
pub struct AiAttributionState {
    conn: Connection,
}

impl AiAttributionState {
    /// Opens `~/.wakaclock/ai-attribution.sqlite3`, creating it and its parent
    /// directory if needed.
    pub fn open() -> Result<Self, AppError> {
        Self::open_at(&Self::db_path())
    }

    /// Opens (or creates) the state database at an explicit path — the seam tests use
    /// to avoid touching the real `~/.wakaclock` directory.
    pub fn open_at(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        // Hooks are independent CLI processes. Wait briefly for another hook's
        // activity-cursor transaction instead of dropping the heartbeat on SQLITE_BUSY.
        conn.busy_timeout(std::time::Duration::from_secs(2))?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS parser_state (
                parser_id   TEXT PRIMARY KEY,
                cursor_json TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS delivered_events (
                event_id     TEXT PRIMARY KEY,
                parser_id    TEXT NOT NULL,
                delivered_at INTEGER NOT NULL
            );

            -- Usage parsers read a whole transcript because providers do not share
            -- one append-only format. Keep successful usage IDs locally so the
            -- always-on scan does not upload the same full transcript every tick.
            -- IDs are marked only after the API acknowledges the batch; an error or
            -- process crash therefore remains safely retryable.
            CREATE TABLE IF NOT EXISTS delivered_usage (
                usage_event_id TEXT PRIMARY KEY,
                delivered_at   INTEGER NOT NULL
            );

            -- A single cursor for activity observed outside the editor (Claude/Codex
            -- hooks and transcript sync). It lets separate CLI processes join AI
            -- heartbeats into WakaTime-style durations without counting each process'
            -- first event as a fabricated second of work.
            CREATE TABLE IF NOT EXISTS activity_cursors (
                stream_id TEXT PRIMARY KEY,
                last_time REAL NOT NULL
            );

            -- Hook and transcript paths can observe the same patch with different
            -- provider event IDs. Keep a short-lived content/time fingerprint so the
            -- always-on watcher does not upload a second heartbeat for that patch.
            CREATE TABLE IF NOT EXISTS delivered_fingerprints (
                entity TEXT NOT NULL,
                occurred_at REAL NOT NULL,
                lines_added INTEGER NOT NULL,
                lines_deleted INTEGER NOT NULL,
                event_id TEXT,
                delivered_at INTEGER NOT NULL
            );

            -- Source-free AI line ownership. The JSON contains only opaque file IDs,
            -- line ranges, timestamps and follow-up flags; it is never uploaded as-is.
            CREATE TABLE IF NOT EXISTS follow_up_ledger (
                ledger_id TEXT PRIMARY KEY CHECK (ledger_id = 'default'),
                ledger_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            -- Crash-safe BeforeTool snapshots. The payload contains only workspace
            -- metadata/fingerprints, never source text, prompts, responses or commands.
            CREATE TABLE IF NOT EXISTS ai_tool_sessions (
                tool_event_id TEXT PRIMARY KEY,
                snapshot_json TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            ",
        )?;
        Ok(Self { conn })
    }

    pub fn load_follow_up_ledger(&self) -> Result<HumanFollowUpLedger, AppError> {
        let json: Option<String> = self
            .conn
            .query_row(
                "SELECT ledger_json FROM follow_up_ledger WHERE ledger_id = 'default'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        match json {
            Some(value) => Ok(serde_json::from_str(&value)?),
            None => Ok(HumanFollowUpLedger::default()),
        }
    }

    pub fn save_follow_up_ledger(&self, ledger: &HumanFollowUpLedger) -> Result<(), AppError> {
        let json = serde_json::to_string(ledger)?;
        self.conn.execute(
            "INSERT INTO follow_up_ledger (ledger_id, ledger_json, updated_at)
             VALUES ('default', ?1, ?2)
             ON CONFLICT(ledger_id) DO UPDATE SET
                ledger_json = excluded.ledger_json,
                updated_at = excluded.updated_at",
            params![json, chrono::Utc::now().timestamp()],
        )?;
        Ok(())
    }

    /// Record an activity timestamp and return the duration from the previous activity
    /// when the gap is inside the configured timeout. This is the same mini-duration
    /// rule WakaTime applies to consecutive heartbeats: an isolated event contributes
    /// zero, while a gap at or beyond the timeout starts a new session.
    ///
    /// The cursor is updated transactionally because agent hooks are separate CLI
    /// processes and can arrive concurrently.
    pub fn record_activity(
        &mut self,
        stream_id: &str,
        timestamp: f64,
        timeout_seconds: f64,
    ) -> Result<f64, AppError> {
        if !timestamp.is_finite() || !timeout_seconds.is_finite() || timeout_seconds <= 0.0 {
            return Err(AppError::Validation(
                "activity timestamp and timeout must be finite; timeout must be positive"
                    .to_string(),
            ));
        }

        let tx = self.conn.transaction()?;
        let previous: Option<f64> = tx
            .query_row(
                "SELECT last_time FROM activity_cursors WHERE stream_id = ?1",
                params![stream_id],
                |row| row.get(0),
            )
            .optional()?;

        // Retries can arrive after newer events. Never move the cursor backwards: doing
        // so would let a later event re-count the whole interval after the retry.
        let active_seconds = match previous {
            Some(last) if timestamp <= last => 0.0,
            Some(last) => {
                let gap = timestamp - last;
                if gap <= timeout_seconds {
                    gap
                } else {
                    0.0
                }
            }
            None => 0.0,
        };

        if previous.is_none_or(|last| timestamp > last) {
            tx.execute(
                "INSERT INTO activity_cursors (stream_id, last_time) VALUES (?1, ?2)
                 ON CONFLICT(stream_id) DO UPDATE SET last_time = excluded.last_time",
                params![stream_id, timestamp],
            )?;
        }
        tx.commit()?;

        Ok(active_seconds)
    }

    /// `None` means this parser has never run before (or its cursor was pruned) —
    /// callers should start from the path `discover()` reports, byte offset zero.
    pub fn load_cursor(&self, parser_id: &str) -> Result<Option<ParserCursor>, AppError> {
        let json: Option<String> = self
            .conn
            .query_row(
                "SELECT cursor_json FROM parser_state WHERE parser_id = ?1",
                params![parser_id],
                |row| row.get(0),
            )
            .optional()?;
        match json {
            Some(text) => Ok(Some(serde_json::from_str(&text)?)),
            None => Ok(None),
        }
    }

    pub fn save_cursor(&self, parser_id: &str, cursor: &ParserCursor) -> Result<(), AppError> {
        let json = serde_json::to_string(cursor)?;
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO parser_state (parser_id, cursor_json, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(parser_id) DO UPDATE SET
                cursor_json = excluded.cursor_json,
                updated_at = excluded.updated_at",
            params![parser_id, json, now],
        )?;
        Ok(())
    }

    /// Every `event_id` in `candidates` that has **not** already been marked
    /// delivered — the set a caller should actually build heartbeats for. Plan.md 8.6:
    /// "Enforce `event_id` uniqueness locally so transcript replay, hook retry and
    /// parser retry converge on one event."
    pub fn filter_undelivered(&self, candidates: &[String]) -> Result<HashSet<String>, AppError> {
        let mut undelivered = HashSet::with_capacity(candidates.len());
        for event_id in candidates {
            let exists: bool = self
                .conn
                .query_row(
                    "SELECT 1 FROM delivered_events WHERE event_id = ?1",
                    params![event_id],
                    |_| Ok(true),
                )
                .optional()?
                .unwrap_or(false);
            if !exists {
                undelivered.insert(event_id.clone());
            }
        }
        Ok(undelivered)
    }

    /// Idempotent — marking an already-delivered `event_id` again is a no-op, not an
    /// error, since a crash between sending a heartbeat and recording delivery must be
    /// safe to retry (plan.md 8.6: "A crash must either leave the old cursor replayable
    /// or commit both events and the new cursor").
    pub fn mark_delivered(&self, event_id: &str, parser_id: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "INSERT OR IGNORE INTO delivered_events (event_id, parser_id, delivered_at)
             VALUES (?1, ?2, ?3)",
            params![event_id, parser_id, now],
        )?;
        Ok(())
    }

    /// Returns usage IDs that have not yet been acknowledged by the API.
    ///
    /// This is deliberately separate from edit-event delivery: a model response may
    /// produce several file heartbeats, but its token usage is one logical event.
    pub fn filter_undelivered_usage(
        &self,
        candidates: &[String],
    ) -> Result<HashSet<String>, AppError> {
        let mut undelivered = HashSet::with_capacity(candidates.len());
        for usage_event_id in candidates {
            let exists: bool = self
                .conn
                .query_row(
                    "SELECT 1 FROM delivered_usage WHERE usage_event_id = ?1",
                    params![usage_event_id],
                    |_| Ok(true),
                )
                .optional()?
                .unwrap_or(false);
            if !exists {
                undelivered.insert(usage_event_id.clone());
            }
        }
        Ok(undelivered)
    }

    /// Marks an acknowledged usage batch. `INSERT OR IGNORE` makes this safe when
    /// a retry races with another scan or when a process restarts after the server
    /// accepted the request but before local state was persisted.
    pub fn mark_usage_delivered(&self, usage_event_ids: &[String]) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp();
        for usage_event_id in usage_event_ids {
            self.conn.execute(
                "INSERT OR IGNORE INTO delivered_usage (usage_event_id, delivered_at)
                 VALUES (?1, ?2)",
                params![usage_event_id, now],
            )?;
        }
        Ok(())
    }

    pub fn mark_fingerprint(
        &self,
        entity: &str,
        occurred_at: f64,
        lines_added: u32,
        lines_deleted: u32,
        event_id: Option<&str>,
    ) -> Result<(), AppError> {
        self.conn.execute(
            "INSERT INTO delivered_fingerprints
             (entity, occurred_at, lines_added, lines_deleted, event_id, delivered_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                entity,
                occurred_at,
                lines_added,
                lines_deleted,
                event_id,
                chrono::Utc::now().timestamp()
            ],
        )?;
        Ok(())
    }

    pub fn has_fingerprint(
        &self,
        entity: &str,
        occurred_at: f64,
        lines_added: u32,
        lines_deleted: u32,
    ) -> Result<bool, AppError> {
        let found: Option<i64> = self
            .conn
            .query_row(
                "SELECT 1 FROM delivered_fingerprints
                 WHERE entity = ?1 AND abs(occurred_at - ?2) <= 15
                   AND lines_added = ?3 AND lines_deleted = ?4
                 ORDER BY delivered_at DESC LIMIT 1",
                params![entity, occurred_at, lines_added, lines_deleted],
                |row| row.get(0),
            )
            .optional()?;
        Ok(found.is_some())
    }

    /// Persist one BeforeTool workspace snapshot. Re-running the same stable tool id
    /// replaces the snapshot atomically, which makes hook retries and process restarts
    /// converge without accumulating source-derived state.
    pub fn save_tool_session(
        &self,
        tool_event_id: &str,
        snapshot_json: &str,
        started_at: i64,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "INSERT INTO ai_tool_sessions (tool_event_id, snapshot_json, started_at, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(tool_event_id) DO UPDATE SET
                snapshot_json = excluded.snapshot_json,
                started_at = excluded.started_at,
                updated_at = excluded.updated_at",
            params![tool_event_id, snapshot_json, started_at, now],
        )?;
        Ok(())
    }

    pub fn load_tool_session(&self, tool_event_id: &str) -> Result<Option<String>, AppError> {
        Ok(self
            .conn
            .query_row(
                "SELECT snapshot_json FROM ai_tool_sessions WHERE tool_event_id = ?1",
                params![tool_event_id],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn delete_tool_session(&self, tool_event_id: &str) -> Result<(), AppError> {
        self.conn.execute(
            "DELETE FROM ai_tool_sessions WHERE tool_event_id = ?1",
            params![tool_event_id],
        )?;
        Ok(())
    }

    /// Abandoned BeforeTool snapshots are metadata-only but still bounded. Twenty-four
    /// hours is intentionally much longer than a normal tool call so an AfterTool retry
    /// after a CLI/editor restart can still close the original session.
    pub fn prune_tool_sessions_older_than(
        &self,
        retention_seconds: i64,
    ) -> Result<usize, AppError> {
        let cutoff = chrono::Utc::now().timestamp() - retention_seconds.max(0);
        Ok(self.conn.execute(
            "DELETE FROM ai_tool_sessions WHERE updated_at < ?1",
            params![cutoff],
        )?)
    }

    /// Bounded retention for the delivered-event dedup table — plan.md 8.6's "30 days
    /// or 50,000 IDs, whichever is smaller" default, applied here as a simple age cutoff.
    /// Returns the number of rows removed.
    pub fn prune_delivered_older_than(&self, retention_days: i64) -> Result<usize, AppError> {
        let cutoff = chrono::Utc::now().timestamp() - retention_days * 24 * 60 * 60;
        let removed = self.conn.execute(
            "DELETE FROM delivered_events WHERE delivered_at < ?1",
            params![cutoff],
        )?;
        self.conn.execute(
            "DELETE FROM delivered_fingerprints WHERE delivered_at < ?1",
            params![cutoff],
        )?;
        self.conn.execute(
            "DELETE FROM delivered_usage WHERE delivered_at < ?1",
            params![cutoff],
        )?;
        Ok(removed)
    }

    fn db_path() -> PathBuf {
        let home = dirs::home_dir().expect("could not resolve home directory");
        home.join(".wakaclock").join("ai-attribution.sqlite3")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::event::{AiConfidence, AiEditEvent, AiEventSource};
    use std::path::PathBuf as StdPathBuf;

    fn temp_db_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "wakaclock-core-ai-state-test-{}-{name}.sqlite3",
            std::process::id()
        ))
    }

    fn sample_event(id: &str) -> AiEditEvent {
        AiEditEvent {
            event_id: id.to_string(),
            agent: "claude-code".to_string(),
            provider: Some("anthropic".to_string()),
            model: None,
            session_id: None,
            occurred_at: chrono::Utc::now(),
            entity: StdPathBuf::from("src/lib.rs"),
            project_root: None,
            lines_added: Some(1),
            lines_deleted: None,
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        }
    }

    #[test]
    fn load_cursor_is_none_before_anything_is_saved() {
        let path = temp_db_path("empty-cursor");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        assert_eq!(state.load_cursor("claude-code").unwrap(), None);
    }

    #[test]
    fn save_and_load_cursor_round_trips() {
        let path = temp_db_path("round-trip-cursor");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        let cursor = ParserCursor {
            source_path: "/home/dev/.claude/projects/x/y.jsonl".to_string(),
            file_identity: None,
            byte_offset: 1234,
            last_record_id: Some("toolu_1".to_string()),
            last_record_time: Some(chrono::Utc::now()),
        };
        state.save_cursor("claude-code", &cursor).unwrap();
        let loaded = state.load_cursor("claude-code").unwrap().unwrap();
        assert_eq!(loaded.byte_offset, 1234);
        assert_eq!(loaded.source_path, cursor.source_path);
    }

    #[test]
    fn save_cursor_overwrites_the_previous_value_for_the_same_parser() {
        let path = temp_db_path("overwrite-cursor");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        let first = ParserCursor {
            source_path: "a.jsonl".to_string(),
            file_identity: None,
            byte_offset: 10,
            last_record_id: None,
            last_record_time: None,
        };
        let second = ParserCursor {
            byte_offset: 20,
            ..first.clone()
        };
        state.save_cursor("codex", &first).unwrap();
        state.save_cursor("codex", &second).unwrap();
        assert_eq!(state.load_cursor("codex").unwrap().unwrap().byte_offset, 20);
    }

    #[test]
    fn undelivered_events_are_filtered_out_once_marked() {
        let path = temp_db_path("filter-undelivered");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        let event = sample_event("toolu_1");

        let before = state
            .filter_undelivered(std::slice::from_ref(&event.event_id))
            .unwrap();
        assert!(before.contains(&event.event_id));

        state
            .mark_delivered(&event.event_id, "claude-code")
            .unwrap();

        let after = state
            .filter_undelivered(std::slice::from_ref(&event.event_id))
            .unwrap();
        assert!(!after.contains(&event.event_id));
    }

    #[test]
    fn mark_delivered_twice_is_not_an_error() {
        let path = temp_db_path("mark-twice");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        state.mark_delivered("toolu_1", "claude-code").unwrap();
        state.mark_delivered("toolu_1", "claude-code").unwrap();
        let remaining = state.filter_undelivered(&["toolu_1".to_string()]).unwrap();
        assert!(remaining.is_empty());
    }

    #[test]
    fn usage_ids_are_filtered_until_the_api_acknowledges_them() {
        let path = temp_db_path("usage-delivery");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        let ids = vec!["usage-1".to_string(), "usage-2".to_string()];

        assert_eq!(state.filter_undelivered_usage(&ids).unwrap().len(), 2);
        state.mark_usage_delivered(&ids[..1]).unwrap();
        let remaining = state.filter_undelivered_usage(&ids).unwrap();
        assert!(!remaining.contains("usage-1"));
        assert!(remaining.contains("usage-2"));

        // A repeated acknowledgement is idempotent and does not make the row
        // appear as pending again.
        state.mark_usage_delivered(&ids[..1]).unwrap();
        assert!(!state
            .filter_undelivered_usage(&ids[..1])
            .unwrap()
            .contains("usage-1"));
    }

    #[test]
    fn tool_session_snapshot_survives_reopen_and_can_be_deleted() {
        let path = temp_db_path("tool-session");
        let _ = std::fs::remove_file(&path);
        {
            let state = AiAttributionState::open_at(&path).unwrap();
            state
                .save_tool_session("tool-1", r#"{"files":3}"#, 123)
                .unwrap();
        }
        {
            let state = AiAttributionState::open_at(&path).unwrap();
            assert_eq!(
                state.load_tool_session("tool-1").unwrap().as_deref(),
                Some(r#"{"files":3}"#)
            );
            state.delete_tool_session("tool-1").unwrap();
            assert_eq!(state.load_tool_session("tool-1").unwrap(), None);
        }
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn hook_fingerprint_deduplicates_a_transcript_event_with_a_different_id() {
        let path = temp_db_path("fingerprint");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        state
            .mark_fingerprint("/workspace/src/lib.rs", 100.0, 3, 1, Some("hook-1"))
            .unwrap();
        assert!(state
            .has_fingerprint("/workspace/src/lib.rs", 112.0, 3, 1)
            .unwrap());
        assert!(!state
            .has_fingerprint("/workspace/src/lib.rs", 116.0, 4, 1)
            .unwrap());
    }

    #[test]
    fn activity_cursor_joins_only_gaps_inside_the_timeout() {
        let path = temp_db_path("activity-cursor");
        let _ = std::fs::remove_file(&path);
        let mut state = AiAttributionState::open_at(&path).unwrap();

        assert_eq!(state.record_activity("ai", 100.0, 900.0).unwrap(), 0.0);
        assert_eq!(state.record_activity("ai", 160.0, 900.0).unwrap(), 60.0);
        assert_eq!(state.record_activity("ai", 1_060.0, 900.0).unwrap(), 900.0);
        assert_eq!(state.record_activity("ai", 1_000.0, 900.0).unwrap(), 0.0);
        assert_eq!(state.record_activity("ai", 1_090.0, 900.0).unwrap(), 30.0);
    }

    #[test]
    fn activity_cursor_includes_exactly_two_minutes_but_not_more() {
        let path =
            std::env::temp_dir().join(format!("wakaclock-ai-strict-{}.db", uuid::Uuid::new_v4()));
        let mut state = AiAttributionState::open_at(&path).unwrap();
        assert_eq!(
            state.record_activity("ai-strict", 1_000.0, 120.0).unwrap(),
            0.0
        );
        assert_eq!(
            state.record_activity("ai-strict", 1_120.0, 120.0).unwrap(),
            120.0
        );
        assert_eq!(
            state.record_activity("ai-strict", 1_241.0, 120.0).unwrap(),
            0.0
        );
        drop(state);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn prune_removes_only_events_older_than_retention() {
        let path = temp_db_path("prune");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        state.mark_delivered("recent", "claude-code").unwrap();
        // Backdate an old row directly — mark_delivered always stamps "now".
        state
            .conn
            .execute(
                "INSERT INTO delivered_events (event_id, parser_id, delivered_at) VALUES (?1, ?2, ?3)",
                params!["old", "claude-code", chrono::Utc::now().timestamp() - 40 * 24 * 60 * 60],
            )
            .unwrap();

        let removed = state.prune_delivered_older_than(30).unwrap();
        assert_eq!(removed, 1);
        assert!(state
            .filter_undelivered(&["old".to_string()])
            .unwrap()
            .contains("old"));
        assert!(!state
            .filter_undelivered(&["recent".to_string()])
            .unwrap()
            .contains("recent"));
    }
}

use crate::ai::follow_up::HumanFollowUpLedger;
use crate::ai::parser::ParserCursor;
use crate::ai::revision::{
    prove_alias, AliasEvidence, AttributionRetentionPolicy, AttributionRevision, RevisionCandidate,
    RevisionWriteOutcome,
};
use crate::ai::usage::AiUsageRecord;
use crate::error::AppError;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Local, per-machine parser cursors and delivered-event identity — plan.md 8.6's
/// `ai-attribution.sqlite3`. This is deliberately separate from `queue.rs`'s
/// `heartbeat_queue`: that table holds heartbeats waiting to be *sent*, this one
/// tracks which AI events have *already* been turned into a heartbeat, so a re-run of
/// `wakaclock ai sync` against the same transcript never re-attributes the same edit
/// twice (plan.md 8.0's required outcome: "exactly one AI edit event for that patch").
///
/// The CLI takes the companion cross-process `~/.wakaclock/ai-sync.lock` before it
/// scans, delivers, and commits state. SQLite still protects this database if another
/// integration writes directly, while the CLI lock prevents duplicate sync work.
pub struct AiAttributionState {
    conn: Connection,
}

#[derive(Debug, Clone)]
pub struct PendingUsage {
    pub record: AiUsageRecord,
    pub attempt: u32,
    pub next_retry_at: i64,
}

/// Metadata-only counters for the durable AI token-usage queue.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct UsageQueueStatus {
    pub pending: usize,
    pub eligible: usize,
    pub retry: usize,
    pub dead_letter: usize,
    pub conflicts: usize,
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
            PRAGMA journal_mode = WAL;
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
                -- The already-sanitised record lets a later transcript scan
                -- detect an ID collision instead of silently treating a changed
                -- payload as an old successful delivery. NULL is retained for
                -- rows created by older clients before this column existed.
                record_json    TEXT,
                delivered_at   INTEGER NOT NULL
            );

            -- Usage is persisted before the network call. The JSON is the already
            -- sanitised AiUsageRecord, never a raw transcript line. This queue is
            -- intentionally independent from heartbeat_queue because its stable
            -- identity and retry semantics are different.
            CREATE TABLE IF NOT EXISTS pending_usage (
                usage_event_id TEXT PRIMARY KEY,
                record_json    TEXT NOT NULL,
                next_retry_at  INTEGER NOT NULL DEFAULT 0,
                attempt        INTEGER NOT NULL DEFAULT 0,
                error_code     TEXT,
                created_at     INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS usage_dead_letters (
                usage_event_id TEXT PRIMARY KEY,
                record_json    TEXT NOT NULL,
                attempt        INTEGER NOT NULL,
                error_code     TEXT NOT NULL,
                failed_at      INTEGER NOT NULL
            );

            -- A provider occasionally reuses an event ID while changing its
            -- token/model metadata. Never replace the delivered row and never
            -- retry the same collision forever: retain the sanitised later
            -- record for inspection while allowing the parser cursor to advance.
            CREATE TABLE IF NOT EXISTS usage_conflicts (
                conflict_id    TEXT PRIMARY KEY,
                usage_event_id TEXT NOT NULL,
                record_json    TEXT NOT NULL,
                conflict_kind  TEXT NOT NULL,
                detected_at    INTEGER NOT NULL
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

            -- Append-only local attribution decisions. Every correction repeats the
            -- full measured activity and increments revision; readers must select the
            -- greatest revision for one operation before summing any bucket.
            CREATE TABLE IF NOT EXISTS attribution_revisions (
                operation_id       TEXT NOT NULL,
                revision           INTEGER NOT NULL,
                payload_hash       TEXT NOT NULL,
                decision_json      TEXT NOT NULL,
                created_at         INTEGER NOT NULL,
                PRIMARY KEY (operation_id, revision),
                UNIQUE (operation_id, payload_hash)
            );

            -- Cross-producer identity is additive. An alias always points directly to
            -- a canonical producer event; insertion rejects alias chains.
            CREATE TABLE IF NOT EXISTS event_aliases (
                alias_event_id     TEXT PRIMARY KEY,
                canonical_event_id TEXT NOT NULL,
                proof_kind         TEXT NOT NULL,
                created_at         INTEGER NOT NULL,
                last_seen_at       INTEGER NOT NULL
            );
            ",
        )?;
        // `CREATE TABLE IF NOT EXISTS` does not add columns to an installation
        // created by an older client. Upgrade this one additive column without
        // making concurrent CLI starts fail when one process wins the schema race.
        let has_delivered_record = conn
            .query_row(
                "SELECT 1 FROM pragma_table_info('delivered_usage') WHERE name = 'record_json'",
                [],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);
        if !has_delivered_record {
            match conn.execute(
                "ALTER TABLE delivered_usage ADD COLUMN record_json TEXT",
                [],
            ) {
                Ok(_) => {}
                Err(error) if error.to_string().contains("duplicate column name") => {}
                Err(error) => return Err(error.into()),
            }
        }
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

    /// Commit a parser checkpoint together with the events that were delivered from
    /// that checkpoint. Keeping both writes in one SQLite transaction means a crash
    /// can only leave the old cursor (which is replay-safe) or the new cursor plus
    /// every delivered event ID; it can never advance past an event without its
    /// dedup marker.
    pub fn save_cursor_and_mark_delivered(
        &mut self,
        parser_id: &str,
        cursor: &ParserCursor,
        event_ids: &[String],
    ) -> Result<(), AppError> {
        let cursor_json = serde_json::to_string(cursor)?;
        let now_rfc3339 = chrono::Utc::now().to_rfc3339();
        let now = chrono::Utc::now().timestamp();
        let tx = self.conn.transaction()?;
        tx.execute(
            "INSERT INTO parser_state (parser_id, cursor_json, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(parser_id) DO UPDATE SET
                cursor_json = excluded.cursor_json,
                updated_at = excluded.updated_at",
            params![parser_id, cursor_json, now_rfc3339],
        )?;
        for event_id in event_ids {
            tx.execute(
                "INSERT OR IGNORE INTO delivered_events (event_id, parser_id, delivered_at)
                 VALUES (?1, ?2, ?3)",
                params![event_id, parser_id, now],
            )?;
        }
        tx.commit()?;
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
    pub fn mark_usage_delivered(&mut self, usage_event_ids: &[String]) -> Result<(), AppError> {
        let now = chrono::Utc::now().timestamp();
        let tx = self.conn.transaction()?;
        for usage_event_id in usage_event_ids {
            let pending_record: Option<String> = tx
                .query_row(
                    "SELECT record_json FROM pending_usage WHERE usage_event_id = ?1",
                    params![usage_event_id],
                    |row| row.get(0),
                )
                .optional()?;
            tx.execute(
                "INSERT OR IGNORE INTO delivered_usage
                 (usage_event_id, record_json, delivered_at)
                 VALUES (?1, ?2, ?3)",
                params![usage_event_id, pending_record, now],
            )?;
            tx.execute(
                "DELETE FROM pending_usage WHERE usage_event_id = ?1",
                params![usage_event_id],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// Persist usage before attempting delivery. A repeated identical record is
    /// a no-op; a local ID collision with different sanitised payload is retained
    /// in the conflict quarantine before the parser advances, so it cannot turn
    /// into an ambiguous retry or block unrelated sessions.
    pub fn enqueue_pending_usage(&self, records: &[AiUsageRecord]) -> Result<usize, AppError> {
        let now = chrono::Utc::now().timestamp();
        // Validate and insert the complete batch under one SQLite transaction.
        // Conflicting records are quarantined in the same transaction, so an
        // earlier valid sibling is durable even when a later transcript row is
        // inconsistent with an existing stable ID.
        let tx = self.conn.unchecked_transaction()?;
        let mut inserted = 0;
        for record in records {
            record.validate().map_err(AppError::Validation)?;
            let record_json = serde_json::to_string(record)?;
            if let Some(existing) = tx
                .query_row(
                    "SELECT record_json FROM pending_usage WHERE usage_event_id = ?1",
                    params![&record.usage_event_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()?
            {
                if existing != record_json {
                    Self::record_usage_conflict_tx(
                        &tx,
                        record,
                        &record_json,
                        "pending_payload_conflict",
                        now,
                    )?;
                }
                continue;
            }
            let delivered_record: Option<Option<String>> = tx
                .query_row(
                    "SELECT record_json FROM delivered_usage WHERE usage_event_id = ?1",
                    params![&record.usage_event_id],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(stored_record) = delivered_record {
                if let Some(stored_record) = stored_record {
                    if stored_record != record_json {
                        Self::record_usage_conflict_tx(
                            &tx,
                            record,
                            &record_json,
                            "delivered_payload_conflict",
                            now,
                        )?;
                    }
                }
                continue;
            }
            // A permanent HTTP 4xx was already recorded in the local dead-letter
            // table.  Transcript scans are intentionally replayable, so without
            // this guard the next watcher tick would recreate the same pending
            // row and turn a non-retryable failure into an infinite retry loop.
            let dead_letter_record: Option<String> = tx
                .query_row(
                    "SELECT record_json FROM usage_dead_letters WHERE usage_event_id = ?1",
                    params![&record.usage_event_id],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(dead_letter_record) = dead_letter_record {
                if dead_letter_record != record_json {
                    Self::record_usage_conflict_tx(
                        &tx,
                        record,
                        &record_json,
                        "dead_letter_payload_conflict",
                        now,
                    )?;
                }
                continue;
            }
            inserted += tx.execute(
                "INSERT OR IGNORE INTO pending_usage
                 (usage_event_id, record_json, next_retry_at, attempt, error_code, created_at)
                 VALUES (?1, ?2, 0, 0, NULL, ?3)",
                params![&record.usage_event_id, record_json, now],
            )?;
        }
        tx.commit()?;
        Ok(inserted)
    }

    fn record_usage_conflict_tx(
        tx: &rusqlite::Transaction<'_>,
        record: &AiUsageRecord,
        record_json: &str,
        conflict_kind: &str,
        detected_at: i64,
    ) -> Result<(), AppError> {
        let digest = Sha256::digest(record_json.as_bytes());
        let conflict_id = format!("{}:{digest:x}", record.usage_event_id);
        tx.execute(
            "INSERT OR IGNORE INTO usage_conflicts
             (conflict_id, usage_event_id, record_json, conflict_kind, detected_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                conflict_id,
                record.usage_event_id,
                record_json,
                conflict_kind,
                detected_at
            ],
        )?;
        Ok(())
    }

    /// Return only records whose retry timer has elapsed. Ordering by creation
    /// and ID makes batch retries deterministic across watcher restarts.
    pub fn pending_usage_due(&self, now: i64) -> Result<Vec<PendingUsage>, AppError> {
        let mut statement = self.conn.prepare(
            "SELECT record_json, attempt, next_retry_at
             FROM pending_usage
             WHERE next_retry_at <= ?1
             ORDER BY created_at, usage_event_id",
        )?;
        let rows = statement.query_map(params![now], |row| {
            let record_json: String = row.get(0)?;
            let record = serde_json::from_str::<AiUsageRecord>(&record_json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;
            Ok(PendingUsage {
                record,
                attempt: row.get::<_, u32>(1)?,
                next_retry_at: row.get(2)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    /// Read the usage queue counters in one SQLite statement for the on-demand
    /// status contract. The records themselves remain local and are never exposed
    /// through this method.
    pub fn usage_queue_status(&self, now: i64) -> Result<UsageQueueStatus, AppError> {
        self.conn
            .query_row(
                "SELECT
                    (SELECT COUNT(*) FROM pending_usage),
                    (SELECT COUNT(*) FROM pending_usage WHERE next_retry_at <= ?1),
                    (SELECT COUNT(*) FROM pending_usage WHERE attempt > 0),
                    (SELECT COUNT(*) FROM usage_dead_letters),
                    (SELECT COUNT(*) FROM usage_conflicts)",
                params![now],
                |row| {
                    Ok(UsageQueueStatus {
                        pending: row.get(0)?,
                        eligible: row.get(1)?,
                        retry: row.get(2)?,
                        dead_letter: row.get(3)?,
                        conflicts: row.get(4)?,
                    })
                },
            )
            .map_err(AppError::from)
    }

    /// Keep a transient failure queued with a bounded, sanitized error code.
    pub fn mark_usage_retry(
        &mut self,
        usage_event_ids: &[String],
        next_retry_at: i64,
        error_code: &str,
    ) -> Result<(), AppError> {
        let code = sanitize_usage_error_code(error_code);
        let tx = self.conn.transaction()?;
        for usage_event_id in usage_event_ids {
            tx.execute(
                "UPDATE pending_usage
                 SET attempt = attempt + 1, next_retry_at = ?2, error_code = ?3
                 WHERE usage_event_id = ?1",
                params![usage_event_id, next_retry_at, code],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// Permanent 4xx responses leave a bounded local audit trail and stop retrying
    /// forever. The stored record remains metadata-only and can be repaired by a
    /// future operator tool without reopening the transcript.
    pub fn move_usage_dead_letter(
        &mut self,
        usage_event_ids: &[String],
        error_code: &str,
    ) -> Result<usize, AppError> {
        let code = sanitize_usage_error_code(error_code);
        let now = chrono::Utc::now().timestamp();
        let tx = self.conn.transaction()?;
        let mut moved = 0;
        for usage_event_id in usage_event_ids {
            let Some((record_json, attempt)) = tx
                .query_row(
                    "SELECT record_json, attempt FROM pending_usage WHERE usage_event_id = ?1",
                    params![usage_event_id],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?)),
                )
                .optional()?
            else {
                continue;
            };
            tx.execute(
                "INSERT OR REPLACE INTO usage_dead_letters
                 (usage_event_id, record_json, attempt, error_code, failed_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![usage_event_id, record_json, attempt, code, now],
            )?;
            tx.execute(
                "DELETE FROM pending_usage WHERE usage_event_id = ?1",
                params![usage_event_id],
            )?;
            moved += 1;
        }
        tx.commit()?;
        Ok(moved)
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

    /// Append one full-value attribution decision and return whether a new revision
    /// was written. The payload hash is checked across the entire operation history,
    /// not only against the latest row, so a delayed retry of an older decision cannot
    /// create a spurious revision after a stronger correction has already landed.
    pub fn append_attribution_revision(
        &mut self,
        candidate: RevisionCandidate,
    ) -> Result<RevisionWriteOutcome, AppError> {
        candidate.validate().map_err(AppError::Validation)?;
        let operation_id = candidate.operation_id.clone();
        let payload_hash = candidate.payload_hash.clone();
        let tx = self.conn.transaction()?;

        let existing_revision: Option<i64> = tx
            .query_row(
                "SELECT revision FROM attribution_revisions
                 WHERE operation_id = ?1 AND payload_hash = ?2
                 LIMIT 1",
                params![&operation_id, &payload_hash],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(revision) = existing_revision {
            let revision = u32::try_from(revision).map_err(|_| {
                AppError::Validation("stored attribution revision is out of range".to_string())
            })?;
            tx.commit()?;
            return Ok(RevisionWriteOutcome::Unchanged { revision });
        }

        let latest: Option<(i64, String)> = tx
            .query_row(
                "SELECT revision, decision_json FROM attribution_revisions
                 WHERE operation_id = ?1
                 ORDER BY revision DESC LIMIT 1",
                params![&operation_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        let revision = match latest {
            Some((value, decision_json)) => {
                let previous: AttributionRevision = serde_json::from_str(&decision_json)?;
                if !previous.preserves_measurement(&candidate) {
                    return Err(AppError::Conflict(
                        "attribution revision cannot change measured time or line totals"
                            .to_string(),
                    ));
                }
                u32::try_from(value)
                    .map_err(|_| {
                        AppError::Validation(
                            "stored attribution revision is out of range".to_string(),
                        )
                    })?
                    .checked_add(1)
                    .ok_or_else(|| {
                        AppError::Validation("attribution revision overflow".to_string())
                    })?
            }
            None => 0,
        };
        let stored = AttributionRevision::from_candidate(candidate, revision)
            .map_err(AppError::Validation)?;
        let decision_json = serde_json::to_string(&stored)?;
        tx.execute(
            "INSERT INTO attribution_revisions
             (operation_id, revision, payload_hash, decision_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                stored.operation_id,
                i64::from(stored.revision),
                stored.payload_hash,
                decision_json,
                stored.created_at
            ],
        )?;
        tx.commit()?;
        Ok(RevisionWriteOutcome::Inserted { revision })
    }

    /// Read the canonical-winner row for one operation. This is the only valid local
    /// read shape once correction rows exist: summing every revision would double
    /// count the same measured activity.
    pub fn latest_attribution_revision(
        &self,
        operation_id: &str,
    ) -> Result<Option<AttributionRevision>, AppError> {
        let decision_json: Option<String> = self
            .conn
            .query_row(
                "SELECT decision_json FROM attribution_revisions
                 WHERE operation_id = ?1
                 ORDER BY revision DESC LIMIT 1",
                params![operation_id],
                |row| row.get(0),
            )
            .optional()?;
        decision_json
            .map(|json| serde_json::from_str(&json).map_err(AppError::from))
            .transpose()
    }

    /// Record a cross-producer alias only when [`prove_alias`] finds direct proof.
    /// Returns `true` for a new mapping and `false` when the same mapping was already
    /// present and only its last-seen timestamp was refreshed.
    pub fn record_event_alias(
        &self,
        left: &AliasEvidence,
        right: &AliasEvidence,
        canonical_event_id: &str,
        now: i64,
    ) -> Result<bool, AppError> {
        let proof_kind = prove_alias(left, right).ok_or_else(|| {
            AppError::Validation(
                "event alias requires matching entity plus tool-event or content-version proof"
                    .to_string(),
            )
        })?;
        if !crate::ai::event::is_safe_event_id(&left.event_id)
            || !crate::ai::event::is_safe_event_id(&right.event_id)
            || !crate::ai::event::is_safe_event_id(canonical_event_id)
        {
            return Err(AppError::Validation(
                "event alias IDs must be safe event IDs".to_string(),
            ));
        }
        if canonical_event_id != left.event_id && canonical_event_id != right.event_id {
            return Err(AppError::Validation(
                "canonical_event_id must be one of the proven producer event IDs".to_string(),
            ));
        }
        let alias_event_id = if canonical_event_id == left.event_id {
            &right.event_id
        } else {
            &left.event_id
        };

        // An alias must never point at another alias. This keeps resolution one hop
        // and makes canonical-winner reads deterministic.
        let canonical_is_alias: bool = self
            .conn
            .query_row(
                "SELECT 1 FROM event_aliases WHERE alias_event_id = ?1 LIMIT 1",
                params![canonical_event_id],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);
        if canonical_is_alias {
            return Err(AppError::Conflict(
                "canonical event is already an alias".to_string(),
            ));
        }

        let existing: Option<(String, String)> = self
            .conn
            .query_row(
                "SELECT canonical_event_id, proof_kind FROM event_aliases
                 WHERE alias_event_id = ?1",
                params![alias_event_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if let Some((existing_canonical, existing_proof)) = existing {
            if existing_canonical != canonical_event_id || existing_proof != proof_kind.as_str() {
                return Err(AppError::Conflict(
                    "alias event is already bound to a different canonical operation".to_string(),
                ));
            }
            self.conn.execute(
                "UPDATE event_aliases SET last_seen_at = ?2 WHERE alias_event_id = ?1",
                params![alias_event_id, now],
            )?;
            return Ok(false);
        }

        self.conn.execute(
            "INSERT INTO event_aliases
             (alias_event_id, canonical_event_id, proof_kind, created_at, last_seen_at)
             VALUES (?1, ?2, ?3, ?4, ?4)",
            params![alias_event_id, canonical_event_id, proof_kind.as_str(), now],
        )?;
        Ok(true)
    }

    /// Resolve one event ID through at most one alias hop. The insertion guard above
    /// guarantees that a returned canonical ID is always a real producer event.
    pub fn resolve_canonical_event_id(&self, event_id: &str) -> Result<String, AppError> {
        Ok(self
            .conn
            .query_row(
                "SELECT canonical_event_id FROM event_aliases
                 WHERE alias_event_id = ?1",
                params![event_id],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or_else(|| event_id.to_string()))
    }

    /// Remove only superseded revision rows and stale alias mappings. The current
    /// max-revision row for every operation is retained even when it is old, so a
    /// later read never loses the operation's canonical decision.
    pub fn prune_attribution_history(
        &self,
        now: i64,
        policy: AttributionRetentionPolicy,
    ) -> Result<usize, AppError> {
        policy.validate().map_err(AppError::Validation)?;
        let revision_cutoff = now.saturating_sub(policy.revision_retention_seconds);
        let alias_cutoff = now.saturating_sub(policy.alias_retention_seconds);
        let removed_revisions = self.conn.execute(
            "DELETE FROM attribution_revisions
             WHERE created_at < ?1
               AND EXISTS (
                   SELECT 1 FROM attribution_revisions newer
                   WHERE newer.operation_id = attribution_revisions.operation_id
                     AND newer.revision > attribution_revisions.revision
               )",
            params![revision_cutoff],
        )?;
        let removed_aliases = self.conn.execute(
            "DELETE FROM event_aliases WHERE last_seen_at < ?1",
            params![alias_cutoff],
        )?;
        Ok(removed_revisions + removed_aliases)
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

fn sanitize_usage_error_code(code: &str) -> String {
    let normalized: String = code
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '_' || character == '-' {
                character.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .take(64)
        .collect();
    if normalized.is_empty() {
        "unknown".to_string()
    } else {
        normalized
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::event::{AiConfidence, AiEditEvent, AiEventSource};
    use crate::broker::BrokerChangeKind;
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
            turn_id: None,
            identity_message_id: None,
            identity_status: None,
            identity_reason: None,
            identity_source: None,
            tool_event_id: None,
            producer_surface: None,
            occurred_at: chrono::Utc::now(),
            entity: StdPathBuf::from("src/lib.rs"),
            project_root: None,
            change_kind: BrokerChangeKind::Modify,
            previous_entity: None,
            lines_added: Some(1),
            lines_deleted: None,
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        }
    }

    fn sample_usage(id: &str) -> AiUsageRecord {
        AiUsageRecord {
            usage_event_id: id.to_string(),
            ai_session_id: "session-1".to_string(),
            occurred_at: chrono::Utc::now(),
            agent: "claude-code".to_string(),
            provider: Some("anthropic".to_string()),
            model: Some("claude-sonnet-5".to_string()),
            prompt_count: 1,
            prompt_character_count: Some(10),
            input_tokens: Some(10),
            output_tokens: Some(5),
            cache_read_tokens: None,
            cache_write_tokens: None,
            token_source: crate::ai::usage::TokenSource::Transcript,
            project_hint: Some("wakaclock".to_string()),
        }
    }

    #[test]
    fn attribution_state_uses_wal_and_waits_for_concurrent_writers() {
        let path = temp_db_path("pragmas");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        let journal_mode: String = state
            .conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        let busy_timeout_ms: i64 = state
            .conn
            .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
            .unwrap();
        assert_eq!(journal_mode.to_ascii_lowercase(), "wal");
        assert_eq!(busy_timeout_ms, 2_000);
        drop(state);
        let _ = std::fs::remove_file(path);
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
            context: None,
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
            context: None,
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
    fn cursor_and_delivery_checkpoint_commit_together() {
        let path = temp_db_path("cursor-delivery-transaction");
        let _ = std::fs::remove_file(&path);
        let mut state = AiAttributionState::open_at(&path).unwrap();
        let cursor = ParserCursor {
            source_path: "session.jsonl".to_string(),
            file_identity: None,
            byte_offset: 42,
            last_record_id: Some("call-1".to_string()),
            last_record_time: None,
            context: Some(crate::ai::parser::ParserContext::default()),
        };
        state
            .save_cursor_and_mark_delivered(
                "codex:session.jsonl",
                &cursor,
                &["event-1".to_string(), "event-1".to_string()],
            )
            .unwrap();

        assert_eq!(
            state.load_cursor("codex:session.jsonl").unwrap(),
            Some(cursor)
        );
        let undelivered = state
            .filter_undelivered(&["event-1".to_string(), "event-2".to_string()])
            .unwrap();
        assert!(!undelivered.contains("event-1"));
        assert!(undelivered.contains("event-2"));
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
        let mut state = AiAttributionState::open_at(&path).unwrap();
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
    fn pending_usage_survives_reopen_and_acknowledgement_is_atomic() {
        let path = temp_db_path("pending-usage");
        let _ = std::fs::remove_file(&path);
        let record = sample_usage("pending-1");
        {
            let state = AiAttributionState::open_at(&path).unwrap();
            assert_eq!(
                state
                    .enqueue_pending_usage(std::slice::from_ref(&record))
                    .unwrap(),
                1
            );
        }
        {
            let mut state = AiAttributionState::open_at(&path).unwrap();
            let pending = state
                .pending_usage_due(chrono::Utc::now().timestamp())
                .unwrap();
            assert_eq!(pending.len(), 1);
            assert_eq!(pending[0].record, record);
            state
                .mark_usage_delivered(&["pending-1".to_string()])
                .unwrap();
            assert!(state
                .pending_usage_due(chrono::Utc::now().timestamp())
                .unwrap()
                .is_empty());
            assert!(state
                .filter_undelivered_usage(&["pending-1".to_string()])
                .unwrap()
                .is_empty());
        }
    }

    #[test]
    fn a_conflicting_usage_batch_quarantines_only_the_conflicting_record() {
        let path = temp_db_path("pending-usage-atomic-conflict");
        let _ = std::fs::remove_file(&path);
        let first = sample_usage("batch-first");
        let sibling = sample_usage("batch-sibling");
        let mut conflicting = first.clone();
        conflicting.output_tokens = Some(999);
        let state = AiAttributionState::open_at(&path).unwrap();

        assert_eq!(
            state
                .enqueue_pending_usage(&[sibling, first, conflicting])
                .unwrap(),
            2
        );
        assert_eq!(
            state
                .pending_usage_due(chrono::Utc::now().timestamp())
                .unwrap()
                .len(),
            2
        );
        assert_eq!(
            state
                .usage_queue_status(chrono::Utc::now().timestamp())
                .unwrap()
                .conflicts,
            1
        );
    }

    #[test]
    fn delivered_usage_quarantines_a_later_payload_collision() {
        let path = temp_db_path("delivered-usage-collision");
        let _ = std::fs::remove_file(&path);
        let first = sample_usage("delivered-collision");
        {
            let state = AiAttributionState::open_at(&path).unwrap();
            state
                .enqueue_pending_usage(std::slice::from_ref(&first))
                .unwrap();
            let mut state = state;
            state
                .mark_usage_delivered(std::slice::from_ref(&first.usage_event_id))
                .unwrap();
        }

        let mut conflicting = first;
        conflicting.output_tokens = Some(999);
        let state = AiAttributionState::open_at(&path).unwrap();
        assert_eq!(state.enqueue_pending_usage(&[conflicting]).unwrap(), 0);
        assert_eq!(
            state
                .usage_queue_status(chrono::Utc::now().timestamp())
                .unwrap()
                .conflicts,
            1
        );
    }

    #[test]
    fn dead_lettered_usage_quarantines_a_later_payload_collision() {
        let path = temp_db_path("dead-letter-usage-collision");
        let _ = std::fs::remove_file(&path);
        let first = sample_usage("dead-letter-collision");
        {
            let state = AiAttributionState::open_at(&path).unwrap();
            state
                .enqueue_pending_usage(std::slice::from_ref(&first))
                .unwrap();
            let mut state = state;
            state
                .move_usage_dead_letter(std::slice::from_ref(&first.usage_event_id), "validation")
                .unwrap();
        }

        let mut conflicting = first;
        conflicting.output_tokens = Some(999);
        let state = AiAttributionState::open_at(&path).unwrap();
        assert_eq!(state.enqueue_pending_usage(&[conflicting]).unwrap(), 0);
        assert_eq!(
            state
                .usage_queue_status(chrono::Utc::now().timestamp())
                .unwrap()
                .conflicts,
            1
        );
    }

    #[test]
    fn transient_usage_retry_is_bounded_and_permanent_error_dead_letters() {
        let path = temp_db_path("usage-retry-dlq");
        let _ = std::fs::remove_file(&path);
        let first = sample_usage("retry-1");
        let second = sample_usage("dead-1");
        let mut state = AiAttributionState::open_at(&path).unwrap();
        state.enqueue_pending_usage(&[first, second]).unwrap();
        state
            .mark_usage_retry(
                &["retry-1".to_string()],
                chrono::Utc::now().timestamp() + 60,
                "http_503",
            )
            .unwrap();
        assert_eq!(
            state
                .pending_usage_due(chrono::Utc::now().timestamp())
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            state
                .move_usage_dead_letter(&["dead-1".to_string()], "validation")
                .unwrap(),
            1
        );
        assert_eq!(state.pending_usage_due(i64::MAX).unwrap().len(), 1);
    }

    #[test]
    fn a_dead_lettered_usage_id_is_not_recreated_by_the_next_transcript_scan() {
        let path = temp_db_path("usage-dead-letter-sticky");
        let _ = std::fs::remove_file(&path);
        let record = sample_usage("dead-sticky");
        let mut state = AiAttributionState::open_at(&path).unwrap();
        assert_eq!(
            state
                .enqueue_pending_usage(std::slice::from_ref(&record))
                .unwrap(),
            1
        );
        assert_eq!(
            state
                .move_usage_dead_letter(
                    std::slice::from_ref(&record.usage_event_id),
                    "permanent_http_4xx",
                )
                .unwrap(),
            1
        );
        assert_eq!(state.enqueue_pending_usage(&[record]).unwrap(), 0);
        assert!(state.pending_usage_due(i64::MAX).unwrap().is_empty());
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

    fn revision_candidate(
        operation_id: &str,
        payload_hash: &str,
        actor_type: crate::heartbeat::ActorType,
        created_at: i64,
    ) -> RevisionCandidate {
        RevisionCandidate {
            operation_id: operation_id.to_string(),
            payload_hash: payload_hash.to_string(),
            actor_type,
            actor_confidence: 0.8,
            active_seconds: 30.0,
            human_lines_added: 10,
            human_lines_deleted: 2,
            ai_lines_added: 0,
            ai_lines_deleted: 0,
            unattributed_lines_added: 0,
            unattributed_lines_deleted: 0,
            created_at,
        }
    }

    #[test]
    fn attribution_revision_ledger_is_idempotent_and_survives_reopen() {
        let path = temp_db_path("attribution-revisions");
        let _ = std::fs::remove_file(&path);
        {
            let mut state = AiAttributionState::open_at(&path).unwrap();
            assert_eq!(
                state
                    .append_attribution_revision(revision_candidate(
                        "event-revision-1",
                        "payload-1",
                        crate::heartbeat::ActorType::Unknown,
                        100,
                    ))
                    .unwrap(),
                RevisionWriteOutcome::Inserted { revision: 0 }
            );
            assert_eq!(
                state
                    .append_attribution_revision(revision_candidate(
                        "event-revision-1",
                        "payload-1",
                        crate::heartbeat::ActorType::Unknown,
                        100,
                    ))
                    .unwrap(),
                RevisionWriteOutcome::Unchanged { revision: 0 }
            );
            assert_eq!(
                state
                    .append_attribution_revision(revision_candidate(
                        "event-revision-1",
                        "payload-2",
                        crate::heartbeat::ActorType::AiVerified,
                        110,
                    ))
                    .unwrap(),
                RevisionWriteOutcome::Inserted { revision: 1 }
            );
            let latest = state
                .latest_attribution_revision("event-revision-1")
                .unwrap()
                .unwrap();
            assert_eq!(latest.revision, 1);
            assert_eq!(latest.actor_type, crate::heartbeat::ActorType::AiVerified);
            assert_eq!(latest.active_seconds, 30.0);
            assert_eq!(latest.human_lines_added, 10);
        }
        let state = AiAttributionState::open_at(&path).unwrap();
        assert_eq!(
            state
                .latest_attribution_revision("event-revision-1")
                .unwrap()
                .unwrap()
                .revision,
            1
        );
        drop(state);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn event_alias_ledger_requires_direct_proof_and_resolves_one_hop() {
        let path = temp_db_path("event-aliases");
        let _ = std::fs::remove_file(&path);
        let state = AiAttributionState::open_at(&path).unwrap();
        let canonical =
            AliasEvidence::new("canonical-event-1", "entity-1").with_tool_event_id("call-1");
        let alias = AliasEvidence::new("alias-event-1", "entity-1")
            .with_tool_event_id("call-1")
            .with_session_id("session-1");

        assert!(state
            .record_event_alias(&canonical, &alias, "canonical-event-1", 100)
            .unwrap());
        assert!(!state
            .record_event_alias(&canonical, &alias, "canonical-event-1", 101)
            .unwrap());
        assert_eq!(
            state.resolve_canonical_event_id("alias-event-1").unwrap(),
            "canonical-event-1"
        );

        let session_only_left =
            AliasEvidence::new("alias-event-2", "entity-1").with_session_id("session-1");
        let session_only_right =
            AliasEvidence::new("canonical-event-2", "entity-1").with_session_id("session-1");
        assert!(state
            .record_event_alias(
                &session_only_left,
                &session_only_right,
                "canonical-event-2",
                102,
            )
            .is_err());
        drop(state);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn attribution_history_prune_keeps_current_revision_and_recent_aliases() {
        let path = temp_db_path("attribution-history-prune");
        let _ = std::fs::remove_file(&path);
        let mut state = AiAttributionState::open_at(&path).unwrap();
        state
            .append_attribution_revision(revision_candidate(
                "event-prune-1",
                "payload-old",
                crate::heartbeat::ActorType::Unknown,
                700,
            ))
            .unwrap();
        state
            .append_attribution_revision(revision_candidate(
                "event-prune-1",
                "payload-current",
                crate::heartbeat::ActorType::AiVerified,
                900,
            ))
            .unwrap();
        let old_alias_left =
            AliasEvidence::new("canonical-prune-old", "entity-old").with_tool_event_id("call-old");
        let old_alias_right =
            AliasEvidence::new("alias-prune-old", "entity-old").with_tool_event_id("call-old");
        state
            .record_event_alias(
                &old_alias_left,
                &old_alias_right,
                "canonical-prune-old",
                800,
            )
            .unwrap();
        let recent_alias_left = AliasEvidence::new("canonical-prune-new", "entity-new")
            .with_content_version("version-new");
        let recent_alias_right =
            AliasEvidence::new("alias-prune-new", "entity-new").with_content_version("version-new");
        state
            .record_event_alias(
                &recent_alias_left,
                &recent_alias_right,
                "canonical-prune-new",
                950,
            )
            .unwrap();

        let policy = AttributionRetentionPolicy {
            late_reconciliation_grace_seconds: 10,
            revision_retention_seconds: 100,
            alias_retention_seconds: 100,
            pending_observation_retention_seconds: 100,
        };
        let removed = state.prune_attribution_history(1_000, policy).unwrap();
        assert_eq!(removed, 2);
        assert_eq!(
            state
                .latest_attribution_revision("event-prune-1")
                .unwrap()
                .unwrap()
                .revision,
            1
        );
        assert_eq!(
            state.resolve_canonical_event_id("alias-prune-old").unwrap(),
            "alias-prune-old"
        );
        assert_eq!(
            state.resolve_canonical_event_id("alias-prune-new").unwrap(),
            "canonical-prune-new"
        );
        drop(state);
        let _ = std::fs::remove_file(path);
    }
}

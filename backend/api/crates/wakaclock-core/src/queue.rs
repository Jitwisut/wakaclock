// crates/wakaclock-core/src/queue.rs

use crate::{
    ai::HandoffLedger,
    error::AppError,
    heartbeat::{union_activity_seconds, ActivitySegment},
};
use chrono::{DateTime, TimeZone, Utc};
use chrono_tz::Tz;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json;
use std::path::PathBuf;
use uuid::Uuid;

pub struct Queue {
    conn: Connection,
}

/// One scope's delivery failure. `kind` and `http_status` are what user-facing
/// state is decided from; `detail` is a bounded local diagnostic only.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeliveryFailureRecord {
    pub kind: String,
    pub http_status: Option<u16>,
    pub message_code: String,
    pub detail: Option<String>,
    pub recorded_at: i64,
    pub last_attempt_at: i64,
    pub consecutive_failures: i64,
}

impl DeliveryFailureRecord {
    pub fn new(kind: &str, http_status: Option<u16>, message_code: &str) -> Self {
        Self {
            kind: kind.to_string(),
            http_status,
            message_code: message_code.to_string(),
            detail: None,
            recorded_at: 0,
            last_attempt_at: 0,
            consecutive_failures: 0,
        }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
}

/// What a same-account rebind changed.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct RebindReport {
    pub rows_moved: usize,
    pub duplicates_dropped: usize,
}

/// Authenticated transport boundary that owns queued activity.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QueueScope {
    pub destination: String,
    pub owner: String,
}

const FLUSH_BATCH_SIZE: usize = 100;
const FLUSH_LEASE_SECONDS: i64 = 60;

impl Queue {
    /// เปิด SQLite database ที่ ~/.wakaclock/queue.db
    pub fn open() -> Result<Self, AppError> {
        Self::open_at(&Self::db_path())
    }

    /// Open a queue at an explicit path. Production callers use [`Self::open`];
    /// the path form lets lifecycle tests exercise a disposable SQLite database
    /// without changing HOME or touching a user's queue.
    pub fn open_at(path: &std::path::Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(AppError::Io)?;
        }

        let conn = Connection::open(path).map_err(AppError::Queue)?;
        conn.busy_timeout(std::time::Duration::from_secs(2))
            .map_err(AppError::Queue)?;

        // สร้าง table ถ้ายังไม่มี
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS heartbeat_queue (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                heartbeat_id TEXT,
                payload     TEXT NOT NULL,        -- JSON ของ heartbeat
                created_at  INTEGER NOT NULL,     -- unix timestamp
                retry_count INTEGER DEFAULT 0,
                next_retry_at INTEGER DEFAULT 0,
                destination TEXT NOT NULL DEFAULT '',
                owner_scope TEXT NOT NULL DEFAULT '',
                session_id TEXT NOT NULL DEFAULT '',
                entity TEXT NOT NULL DEFAULT '',
                revision INTEGER NOT NULL DEFAULT 0,
                lease_owner TEXT,
                lease_until INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS heartbeat_dead_letter (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                heartbeat_id TEXT,
                payload TEXT NOT NULL,
                destination TEXT NOT NULL,
                owner_scope TEXT NOT NULL,
                reason TEXT NOT NULL,
                failed_at INTEGER NOT NULL
            );

            -- Metadata-only remote/container handoff state. The actual heartbeat
            -- payload stays in heartbeat_queue; this snapshot only protects the
            -- accepted receipt/dedup ledger across a runtime restart.
            CREATE TABLE IF NOT EXISTS topology_handoff_state (
                state_key   TEXT PRIMARY KEY,
                snapshot    BLOB NOT NULL,
                updated_at  INTEGER NOT NULL
            );

            -- Unsent activity is never expired implicitly. Delivery, explicit
            -- recovery, or a visible dead-letter transition owns deletion.

            -- Server-issued proof of which account a credential belongs to, per
            -- origin. `credential_scope` is the queue owner scope (a hash of the API
            -- key, never the key); `owner_id` is the opaque `queue_owner_id` the
            -- server returned for an authenticated request with that credential.
            CREATE TABLE IF NOT EXISTS credential_owner (
                destination      TEXT NOT NULL,
                credential_scope TEXT NOT NULL,
                owner_id         TEXT NOT NULL,
                verified_at      INTEGER NOT NULL,
                PRIMARY KEY (destination, credential_scope)
            );

            -- Why delivery last failed, per origin + queue owner. Scoped so a
            -- refusal for one account/server never describes another, and stored
            -- beside the rows it is about so both move in one transaction.
            CREATE TABLE IF NOT EXISTS delivery_state (
                destination          TEXT NOT NULL,
                owner_scope          TEXT NOT NULL,
                kind                 TEXT NOT NULL,
                http_status          INTEGER,
                message_code         TEXT NOT NULL,
                sanitized_detail     TEXT,
                recorded_at          INTEGER NOT NULL,
                last_attempt_at      INTEGER NOT NULL,
                consecutive_failures INTEGER NOT NULL,
                PRIMARY KEY (destination, owner_scope)
            );

            -- Metadata-only record of every same-account queue rebind.
            CREATE TABLE IF NOT EXISTS queue_rebind_audit (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                destination        TEXT NOT NULL,
                from_scope         TEXT NOT NULL,
                to_scope           TEXT NOT NULL,
                owner_id           TEXT NOT NULL,
                rows_moved         INTEGER NOT NULL,
                duplicates_dropped INTEGER NOT NULL,
                rebound_at         INTEGER NOT NULL
            );
        ",
        )
        .map_err(AppError::Queue)?;

        // Older queue databases predate retry scheduling. Migrate them in place so an
        // upgrade never drops durable heartbeats or hammers a server that is offline.
        let has_retry_column: bool = conn
            .prepare("PRAGMA table_info(heartbeat_queue)")
            .map_err(AppError::Queue)?
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(AppError::Queue)?
            .filter_map(Result::ok)
            .any(|name| name == "next_retry_at");
        if !has_retry_column {
            conn.execute(
                "ALTER TABLE heartbeat_queue ADD COLUMN next_retry_at INTEGER DEFAULT 0",
                [],
            )
            .map_err(AppError::Queue)?;
        }

        let has_heartbeat_id: bool = conn
            .prepare("PRAGMA table_info(heartbeat_queue)")
            .map_err(AppError::Queue)?
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(AppError::Queue)?
            .filter_map(Result::ok)
            .any(|name| name == "heartbeat_id");
        if !has_heartbeat_id {
            conn.execute(
                "ALTER TABLE heartbeat_queue ADD COLUMN heartbeat_id TEXT",
                [],
            )
            .map_err(AppError::Queue)?;
        }

        for (name, definition) in [
            ("destination", "TEXT NOT NULL DEFAULT ''"),
            ("owner_scope", "TEXT NOT NULL DEFAULT ''"),
            ("session_id", "TEXT NOT NULL DEFAULT ''"),
            ("entity", "TEXT NOT NULL DEFAULT ''"),
            ("revision", "INTEGER NOT NULL DEFAULT 0"),
            ("lease_owner", "TEXT"),
            ("lease_until", "INTEGER NOT NULL DEFAULT 0"),
        ] {
            let exists = conn
                .prepare("PRAGMA table_info(heartbeat_queue)")
                .map_err(AppError::Queue)?
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(AppError::Queue)?
                .filter_map(Result::ok)
                .any(|column| column == name);
            if !exists {
                conn.execute(
                    &format!("ALTER TABLE heartbeat_queue ADD COLUMN {name} {definition}"),
                    [],
                )
                .map_err(AppError::Queue)?;
            }
        }

        // Backfill identities for rows written by pre-id clients. When the old payload
        // has no identity at all, derive one from the exact JSON bytes and persist it
        // into the payload too. That makes an interrupted flush/restart converge on one
        // queue row without pretending to rewrite the server's raw history.
        let legacy: Vec<(i64, String)> = {
            let mut statement = conn
                .prepare("SELECT id, payload FROM heartbeat_queue WHERE heartbeat_id IS NULL")
                .map_err(AppError::Queue)?;
            let rows = statement
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
                .map_err(AppError::Queue)?
                .filter_map(Result::ok)
                .collect();
            rows
        };
        for (id, payload) in legacy {
            let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&payload) else {
                continue;
            };
            let heartbeat_id = value
                .get("heartbeat_id")
                .and_then(|value| value.as_str())
                .filter(|value| !value.trim().is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| {
                    let namespace = Uuid::new_v5(&Uuid::NAMESPACE_OID, payload.as_bytes());
                    format!("legacy:{namespace}")
                });
            if let Some(object) = value.as_object_mut() {
                object.insert(
                    "heartbeat_id".to_string(),
                    serde_json::Value::String(heartbeat_id.clone()),
                );
            }
            let updated_payload = serde_json::to_string(&value).unwrap_or(payload);
            conn.execute(
                "UPDATE heartbeat_queue SET heartbeat_id = ?1, payload = ?2
                 WHERE id = ?3 AND heartbeat_id IS NULL",
                params![heartbeat_id, updated_payload, id],
            )
            .map_err(AppError::Queue)?;
        }

        let queued_payloads: Vec<(i64, String)> = {
            let mut statement = conn
                .prepare("SELECT id, payload FROM heartbeat_queue")
                .map_err(AppError::Queue)?;
            let rows = statement
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
                .map_err(AppError::Queue)?
                .filter_map(Result::ok)
                .collect();
            rows
        };
        for (id, payload) in queued_payloads {
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&payload) else {
                continue;
            };
            let session_id = value
                .get("session_id")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let entity = value
                .get("entity")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let revision = value
                .get("revision")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(0)
                .min(i64::MAX as u64) as i64;
            conn.execute(
                "UPDATE heartbeat_queue SET session_id = ?1, entity = ?2, revision = ?3
                 WHERE id = ?4",
                params![session_id, entity, revision, id],
            )
            .map_err(AppError::Queue)?;
        }

        // Retain one exact transport revision per owner and destination. A newer
        // correction is a separate row; dropping its base would make it an orphan.
        conn.execute(
            "DELETE FROM heartbeat_queue
             WHERE heartbeat_id IS NOT NULL
               AND id NOT IN (
                 SELECT MIN(id) FROM heartbeat_queue
                 WHERE heartbeat_id IS NOT NULL
                 GROUP BY destination, owner_scope, heartbeat_id, session_id, entity, revision
               )",
            [],
        )
        .map_err(AppError::Queue)?;
        conn.execute("DROP INDEX IF EXISTS heartbeat_queue_heartbeat_id_idx", [])
            .map_err(AppError::Queue)?;
        conn.execute(
            "DROP INDEX IF EXISTS heartbeat_queue_delivery_identity_idx",
            [],
        )
        .map_err(AppError::Queue)?;
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS heartbeat_queue_delivery_identity_idx
             ON heartbeat_queue(destination, owner_scope, heartbeat_id, session_id, entity, revision)
             WHERE heartbeat_id IS NOT NULL",
            [],
        )
        .map_err(AppError::Queue)?;

        Ok(Self { conn })
    }

    /// บันทึก heartbeat payload ลง queue
    pub fn push(&self, payload: &serde_json::Value) -> Result<(), AppError> {
        self.push_scoped(
            payload,
            &QueueScope {
                destination: String::new(),
                owner: String::new(),
            },
        )
    }

    pub fn push_scoped(
        &self,
        payload: &serde_json::Value,
        scope: &QueueScope,
    ) -> Result<(), AppError> {
        self.push_scoped_after(payload, scope, None)
    }

    /// Queue a payload that is not eligible for delivery yet.
    ///
    /// A server that answers 429/503 with `Retry-After` is asking for that delay on
    /// the *first* attempt too, not only on a later flush; without this the row was
    /// immediately eligible and the next flush ignored the server's request.
    pub fn push_scoped_after(
        &self,
        payload: &serde_json::Value,
        scope: &QueueScope,
        retry_after_seconds: Option<u64>,
    ) -> Result<(), AppError> {
        let retry_delay = retry_after_seconds.unwrap_or(0).min(86_400) as i64;
        let json = serde_json::to_string(payload).map_err(AppError::Serde)?;
        let now = chrono::Utc::now().timestamp();
        let heartbeat_id = payload
            .get("heartbeat_id")
            .and_then(|value| value.as_str())
            .filter(|value| !value.trim().is_empty());
        let session_id = payload
            .get("session_id")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        let entity = payload
            .get("entity")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        let revision = payload
            .get("revision")
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(0)
            .min(i64::MAX as u64) as i64;
        if let Some(heartbeat_id) = heartbeat_id {
            let exists: bool = self
                .conn
                .query_row(
                    "SELECT EXISTS(
                         SELECT 1 FROM heartbeat_queue
                         WHERE destination = ?1 AND owner_scope = ?2
                           AND heartbeat_id = ?3 AND session_id = ?4
                           AND entity = ?5 AND revision = ?6
                     )",
                    params![
                        &scope.destination,
                        &scope.owner,
                        heartbeat_id,
                        session_id,
                        entity,
                        revision
                    ],
                    |row| row.get(0),
                )
                .map_err(AppError::Queue)?;
            if exists {
                return Ok(());
            }
        }

        self.conn
            .execute(
                "INSERT OR IGNORE INTO heartbeat_queue
                 (heartbeat_id, payload, created_at, destination, owner_scope,
                  session_id, entity, revision, next_retry_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
                         strftime('%s', 'now') + ?9)",
                params![
                    heartbeat_id,
                    json,
                    now,
                    &scope.destination,
                    &scope.owner,
                    session_id,
                    entity,
                    revision,
                    retry_delay
                ],
            )
            .map_err(AppError::Queue)?;

        Ok(())
    }

    /// ดึง heartbeats ทั้งหมดที่ค้างอยู่
    pub fn pop_all(&self) -> Result<Vec<(i64, serde_json::Value)>, AppError> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, payload FROM heartbeat_queue
                 WHERE next_retry_at <= strftime('%s', 'now')
                 ORDER BY created_at ASC",
            )
            .map_err(AppError::Queue)?;

        let rows = stmt
            .query_map([], |row| {
                let id: i64 = row.get(0)?;
                let json: String = row.get(1)?;
                Ok((id, json))
            })
            .map_err(AppError::Queue)?;

        let mut result = vec![];
        for row in rows {
            let (id, json) = row.map_err(AppError::Queue)?;
            let value: serde_json::Value = serde_json::from_str(&json).map_err(AppError::Serde)?;
            result.push((id, value));
        }

        Ok(result)
    }

    /// Atomically lease one bounded delivery batch for this exact owner and origin.
    /// Expired leases are reclaimable after a crashed process.
    pub fn claim_batch_scoped(
        &self,
        scope: &QueueScope,
        lease_owner: &str,
    ) -> Result<Vec<(i64, serde_json::Value)>, AppError> {
        self.conn
            .execute(
                "UPDATE heartbeat_queue
                 SET lease_owner = ?1, lease_until = strftime('%s', 'now') + ?2
                 WHERE id IN (
                     SELECT id FROM heartbeat_queue
                     WHERE destination = ?3 AND owner_scope = ?4
                       AND next_retry_at <= strftime('%s', 'now')
                       AND (lease_owner IS NULL OR lease_until <= strftime('%s', 'now'))
                     ORDER BY created_at ASC, heartbeat_id ASC, revision ASC, id ASC
                     LIMIT ?5
                 )",
                params![
                    lease_owner,
                    FLUSH_LEASE_SECONDS,
                    &scope.destination,
                    &scope.owner,
                    FLUSH_BATCH_SIZE as i64
                ],
            )
            .map_err(AppError::Queue)?;

        let mut statement = self
            .conn
            .prepare(
                "SELECT id, payload FROM heartbeat_queue
                 WHERE lease_owner = ?1
                 ORDER BY created_at ASC, heartbeat_id ASC, revision ASC, id ASC",
            )
            .map_err(AppError::Queue)?;
        let claimed = statement
            .query_map(params![lease_owner], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(AppError::Queue)?
            .map(|row| {
                let (id, payload) = row.map_err(AppError::Queue)?;
                let value = serde_json::from_str(&payload).map_err(AppError::Serde)?;
                Ok((id, value))
            })
            .collect();
        claimed
    }

    pub fn release_claim(&self, lease_owner: &str) -> Result<(), AppError> {
        self.conn
            .execute(
                "UPDATE heartbeat_queue SET lease_owner = NULL, lease_until = 0
                 WHERE lease_owner = ?1",
                params![lease_owner],
            )
            .map_err(AppError::Queue)?;
        Ok(())
    }

    /// Delay a failed row with bounded exponential backoff. The payload remains in
    /// SQLite and is eligible again after 60s, 120s, 240s ... up to one hour.
    pub fn mark_retry(&self, id: i64) -> Result<(), AppError> {
        self.mark_retry_after(id, None)
    }

    /// Retry with a server-provided `Retry-After` delay when present, otherwise
    /// use the bounded local exponential schedule.
    pub fn mark_retry_after(
        &self,
        id: i64,
        retry_after_seconds: Option<u64>,
    ) -> Result<(), AppError> {
        if let Some(delay) = retry_after_seconds {
            let delay = delay.min(86_400);
            self.conn
                .execute(
                    "UPDATE heartbeat_queue
                     SET retry_count = retry_count + 1,
                         next_retry_at = strftime('%s', 'now') + ?1,
                         lease_owner = NULL,
                         lease_until = 0
                     WHERE id = ?2",
                    params![delay as i64, id],
                )
                .map_err(AppError::Queue)?;
            return Ok(());
        }
        self.conn
            .execute(
                "UPDATE heartbeat_queue
                 SET retry_count = retry_count + 1,
                     next_retry_at = strftime('%s', 'now') +
                       CASE
                         WHEN retry_count < 1 THEN 60
                         WHEN retry_count < 2 THEN 120
                         WHEN retry_count < 3 THEN 240
                         WHEN retry_count < 4 THEN 480
                         WHEN retry_count < 5 THEN 960
                         WHEN retry_count < 6 THEN 1920
                         ELSE 3600
                       END,
                     lease_owner = NULL,
                     lease_until = 0
                 WHERE id = ?1",
                params![id],
            )
            .map_err(AppError::Queue)?;
        Ok(())
    }

    /// ลบ heartbeat ที่ส่งสำเร็จแล้วออกจาก queue
    pub fn remove(&self, id: i64) -> Result<(), AppError> {
        self.conn
            .execute("DELETE FROM heartbeat_queue WHERE id = ?1", params![id])
            .map_err(AppError::Queue)?;

        Ok(())
    }

    /// Move a permanently malformed row out of the live queue without erasing the
    /// only recoverable copy of its payload.
    pub fn dead_letter(&self, id: i64, reason: &str) -> Result<(), AppError> {
        let transaction = self.conn.unchecked_transaction().map_err(AppError::Queue)?;
        transaction
            .execute(
                "INSERT INTO heartbeat_dead_letter
                 (heartbeat_id, payload, destination, owner_scope, reason, failed_at)
                 SELECT heartbeat_id, payload, destination, owner_scope, ?1,
                        strftime('%s', 'now')
                 FROM heartbeat_queue WHERE id = ?2",
                params![reason, id],
            )
            .map_err(AppError::Queue)?;
        transaction
            .execute("DELETE FROM heartbeat_queue WHERE id = ?1", params![id])
            .map_err(AppError::Queue)?;
        transaction.commit().map_err(AppError::Queue)?;
        Ok(())
    }

    pub fn dead_letter_len(&self) -> Result<usize, AppError> {
        self.conn
            .query_row("SELECT COUNT(*) FROM heartbeat_dead_letter", [], |row| {
                row.get(0)
            })
            .map_err(AppError::Queue)
    }

    /// จำนวน heartbeats ที่ค้างอยู่
    pub fn len(&self) -> Result<usize, AppError> {
        let count: usize = self
            .conn
            .query_row("SELECT COUNT(*) FROM heartbeat_queue", [], |row| row.get(0))
            .map_err(AppError::Queue)?;

        Ok(count)
    }

    pub fn len_scoped(&self, scope: &QueueScope) -> Result<usize, AppError> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM heartbeat_queue
                 WHERE destination = ?1 AND owner_scope = ?2",
                params![&scope.destination, &scope.owner],
                |row| row.get(0),
            )
            .map_err(AppError::Queue)
    }

    /// Rows this scope could deliver right now: not leased and past their retry
    /// deadline. `len_scoped` counts the backlog; this counts what a flush would
    /// actually pick up, which is what "the queue is stuck" versus "waiting on a
    /// backoff" means to a user.
    pub fn eligible_len_scoped(&self, scope: &QueueScope) -> Result<usize, AppError> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM heartbeat_queue
                 WHERE destination = ?1 AND owner_scope = ?2
                   AND next_retry_at <= strftime('%s', 'now')
                   AND (lease_owner IS NULL OR lease_until <= strftime('%s', 'now'))",
                params![&scope.destination, &scope.owner],
                |row| row.get(0),
            )
            .map_err(AppError::Queue)
    }

    /// Record why delivery failed for exactly this origin + owner.
    ///
    /// `consecutive_failures` keeps counting while the same scope keeps failing and
    /// resets when it is cleared, so a single blip is distinguishable from an
    /// outage. `detail` is bounded and only ever a local diagnostic: user-facing
    /// decisions use `kind`/`http_status`/`message_code`.
    pub fn record_delivery_failure(
        &self,
        scope: &QueueScope,
        failure: &DeliveryFailureRecord,
    ) -> Result<(), AppError> {
        let detail: Option<String> = failure
            .detail
            .as_deref()
            .map(|detail| detail.chars().take(512).collect());
        self.conn
            .execute(
                "INSERT INTO delivery_state
                 (destination, owner_scope, kind, http_status, message_code,
                  sanitized_detail, recorded_at, last_attempt_at, consecutive_failures)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, strftime('%s', 'now'),
                         strftime('%s', 'now'), 1)
                 ON CONFLICT(destination, owner_scope) DO UPDATE SET
                     kind = excluded.kind,
                     http_status = excluded.http_status,
                     message_code = excluded.message_code,
                     sanitized_detail = excluded.sanitized_detail,
                     last_attempt_at = excluded.last_attempt_at,
                     -- A different failure starts its own streak; the same one continues.
                     recorded_at = CASE
                         WHEN delivery_state.kind = excluded.kind
                         THEN delivery_state.recorded_at ELSE excluded.recorded_at END,
                     consecutive_failures = CASE
                         WHEN delivery_state.kind = excluded.kind
                         THEN delivery_state.consecutive_failures + 1 ELSE 1 END",
                params![
                    &scope.destination,
                    &scope.owner,
                    &failure.kind,
                    failure.http_status.map(i64::from),
                    &failure.message_code,
                    detail
                ],
            )
            .map_err(AppError::Queue)?;
        Ok(())
    }

    /// Clear this scope's failure, optionally only when it is one of `kinds`.
    ///
    /// A successful *probe* proves reachability, so it may clear a network or
    /// server failure — but not a 401/402, which only a successful delivery (or a
    /// repaired credential/entitlement) resolves. Returns whether a row was cleared.
    pub fn clear_delivery_failure(
        &self,
        scope: &QueueScope,
        kinds: Option<&[&str]>,
    ) -> Result<bool, AppError> {
        let cleared = match kinds {
            None => self
                .conn
                .execute(
                    "DELETE FROM delivery_state WHERE destination = ?1 AND owner_scope = ?2",
                    params![&scope.destination, &scope.owner],
                )
                .map_err(AppError::Queue)?,
            Some([]) => 0,
            Some(kinds) => {
                let placeholders = (3..3 + kinds.len())
                    .map(|index| format!("?{index}"))
                    .collect::<Vec<_>>()
                    .join(", ");
                let mut values: Vec<&dyn rusqlite::ToSql> = vec![&scope.destination, &scope.owner];
                values.extend(kinds.iter().map(|kind| kind as &dyn rusqlite::ToSql));
                self.conn
                    .execute(
                        &format!(
                            "DELETE FROM delivery_state
                             WHERE destination = ?1 AND owner_scope = ?2
                               AND kind IN ({placeholders})"
                        ),
                        values.as_slice(),
                    )
                    .map_err(AppError::Queue)?
            }
        };
        Ok(cleared > 0)
    }

    /// This scope's delivery failure, if it has one that is still unresolved.
    pub fn delivery_failure_for(
        &self,
        scope: &QueueScope,
    ) -> Result<Option<DeliveryFailureRecord>, AppError> {
        self.conn
            .query_row(
                "SELECT kind, http_status, message_code, sanitized_detail, recorded_at,
                        last_attempt_at, consecutive_failures
                 FROM delivery_state WHERE destination = ?1 AND owner_scope = ?2",
                params![&scope.destination, &scope.owner],
                |row| {
                    Ok(DeliveryFailureRecord {
                        kind: row.get(0)?,
                        http_status: row.get::<_, Option<i64>>(1)?.map(|value| value as u16),
                        message_code: row.get(2)?,
                        detail: row.get(3)?,
                        recorded_at: row.get(4)?,
                        last_attempt_at: row.get(5)?,
                        consecutive_failures: row.get(6)?,
                    })
                },
            )
            .optional()
            .map_err(AppError::Queue)
    }

    /// Rows this scope cannot deliver: queued under another credential or origin.
    /// They are kept, never deleted, until a same-account proof rebinds them or the
    /// matching credential/origin is used again.
    pub fn orphaned_len(&self, current: &QueueScope) -> Result<usize, AppError> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM heartbeat_queue
                 WHERE NOT (destination = ?1 AND owner_scope = ?2)",
                params![&current.destination, &current.owner],
                |row| row.get(0),
            )
            .map_err(AppError::Queue)
    }

    /// Record the server's proof of which account `scope`'s credential belongs to.
    pub fn record_credential_owner(
        &self,
        scope: &QueueScope,
        owner_id: &str,
    ) -> Result<(), AppError> {
        self.conn
            .execute(
                "INSERT INTO credential_owner (destination, credential_scope, owner_id, verified_at)
                 VALUES (?1, ?2, ?3, strftime('%s', 'now'))
                 ON CONFLICT(destination, credential_scope)
                 DO UPDATE SET owner_id = excluded.owner_id, verified_at = excluded.verified_at",
                params![&scope.destination, &scope.owner, owner_id],
            )
            .map_err(AppError::Queue)?;
        Ok(())
    }

    /// Move rows queued under an older credential of the *same account* onto
    /// `current`, atomically.
    ///
    /// Only credentials whose recorded server proof (`credential_owner`) names the
    /// same `owner_id` on the same origin qualify, and `current` itself must carry
    /// that proof. A row whose exact delivery identity (heartbeat id, session,
    /// entity, revision) is already queued under `current` is dropped instead of
    /// moved; every other row keeps its payload bytes, timestamp and retry state.
    /// Any failure rolls the whole rebind back.
    pub fn rebind_same_owner(
        &self,
        current: &QueueScope,
        owner_id: &str,
    ) -> Result<RebindReport, AppError> {
        let transaction = self.conn.unchecked_transaction().map_err(AppError::Queue)?;
        let current_owner: Option<String> = transaction
            .query_row(
                "SELECT owner_id FROM credential_owner
                 WHERE destination = ?1 AND credential_scope = ?2",
                params![&current.destination, &current.owner],
                |row| row.get(0),
            )
            .optional()
            .map_err(AppError::Queue)?;
        if current_owner.as_deref() != Some(owner_id) {
            return Err(AppError::Validation(
                "queue rebind requires a recorded owner proof for the current credential"
                    .to_string(),
            ));
        }
        let from_scopes: Vec<String> = {
            let mut statement = transaction
                .prepare(
                    "SELECT credential_scope FROM credential_owner
                     WHERE destination = ?1 AND owner_id = ?2 AND credential_scope != ?3",
                )
                .map_err(AppError::Queue)?;
            let rows = statement
                .query_map(
                    params![&current.destination, owner_id, &current.owner],
                    |row| row.get(0),
                )
                .map_err(AppError::Queue)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(AppError::Queue)?;
            rows
        };

        let mut report = RebindReport::default();
        for from_scope in from_scopes {
            let duplicates = transaction
                .execute(
                    "DELETE FROM heartbeat_queue
                     WHERE destination = ?1 AND owner_scope = ?2 AND heartbeat_id IS NOT NULL
                       AND EXISTS (
                         SELECT 1 FROM heartbeat_queue AS kept
                         WHERE kept.destination = heartbeat_queue.destination
                           AND kept.owner_scope = ?3
                           AND kept.heartbeat_id = heartbeat_queue.heartbeat_id
                           AND kept.session_id = heartbeat_queue.session_id
                           AND kept.entity = heartbeat_queue.entity
                           AND kept.revision = heartbeat_queue.revision
                       )",
                    params![&current.destination, &from_scope, &current.owner],
                )
                .map_err(AppError::Queue)?;
            let moved = transaction
                .execute(
                    "UPDATE heartbeat_queue SET owner_scope = ?3
                     WHERE destination = ?1 AND owner_scope = ?2",
                    params![&current.destination, &from_scope, &current.owner],
                )
                .map_err(AppError::Queue)?;
            if moved + duplicates > 0 {
                transaction
                    .execute(
                        "INSERT INTO queue_rebind_audit
                         (destination, from_scope, to_scope, owner_id, rows_moved,
                          duplicates_dropped, rebound_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, strftime('%s', 'now'))",
                        params![
                            &current.destination,
                            &from_scope,
                            &current.owner,
                            owner_id,
                            moved as i64,
                            duplicates as i64
                        ],
                    )
                    .map_err(AppError::Queue)?;
            }
            report.rows_moved += moved;
            report.duplicates_dropped += duplicates;
        }
        transaction.commit().map_err(AppError::Queue)?;
        Ok(report)
    }

    /// Whether the durable heartbeat queue has no pending rows.
    pub fn is_empty(&self) -> Result<bool, AppError> {
        Ok(self.len()? == 0)
    }

    /// Persist the topology handoff ledger atomically with a single SQLite row.
    /// The ledger is metadata-only and bounded so a remote collector cannot turn
    /// the queue database into an unbounded payload store.
    pub fn save_handoff_ledger(&self, ledger: &HandoffLedger) -> Result<(), AppError> {
        const MAX_HANDOFF_SNAPSHOT_BYTES: usize = 2 * 1024 * 1024;
        let snapshot = ledger
            .snapshot()
            .map_err(|error| AppError::Validation(error.to_string()))?;
        if snapshot.len() > MAX_HANDOFF_SNAPSHOT_BYTES {
            return Err(AppError::Validation(
                "topology handoff snapshot exceeds the local bound".to_string(),
            ));
        }
        self.conn
            .execute(
                "INSERT INTO topology_handoff_state (state_key, snapshot, updated_at)
                 VALUES ('default', ?1, strftime('%s', 'now'))
                 ON CONFLICT(state_key) DO UPDATE SET
                    snapshot = excluded.snapshot,
                    updated_at = excluded.updated_at",
                params![snapshot],
            )
            .map_err(AppError::Queue)?;
        Ok(())
    }

    /// Restore a previously persisted handoff ledger. Corrupt state is surfaced as
    /// validation failure so a caller can quarantine it instead of accepting an
    /// ambiguous identity map.
    pub fn load_handoff_ledger(&self) -> Result<Option<HandoffLedger>, AppError> {
        let snapshot: Option<Vec<u8>> = self
            .conn
            .query_row(
                "SELECT snapshot FROM topology_handoff_state WHERE state_key = 'default'",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(AppError::Queue)?;
        snapshot
            .map(|bytes| {
                HandoffLedger::restore(&bytes)
                    .map_err(|error| AppError::Validation(error.to_string()))
            })
            .transpose()
    }

    pub fn clear_handoff_ledger(&self) -> Result<(), AppError> {
        self.conn
            .execute(
                "DELETE FROM topology_handoff_state WHERE state_key = 'default'",
                [],
            )
            .map_err(AppError::Queue)?;
        Ok(())
    }

    /// Sum the active time in the offline queue for the calendar day in `timezone`.
    /// Queue entries keep the original heartbeat timestamp, so a heartbeat queued just
    /// before midnight is not accidentally shown on the wrong local day after a
    /// restart. Malformed legacy rows are ignored rather than making the status bar
    /// unavailable.
    pub fn queued_seconds_for_day(&self, timezone: Option<&str>) -> Result<f64, AppError> {
        Ok(union_activity_seconds(
            &self.queued_segments_for_day(timezone)?,
        ))
    }

    /// Return the queued intervals for the local day. Keeping intervals (rather than
    /// only a sum) lets the CLI union offline data with server-confirmed intervals
    /// without counting a retry twice while a flush is in flight.
    pub fn queued_segments_for_day(
        &self,
        timezone: Option<&str>,
    ) -> Result<Vec<ActivitySegment>, AppError> {
        self.queued_segments_for_day_query(timezone, None)
    }

    pub fn queued_segments_for_day_scoped(
        &self,
        timezone: Option<&str>,
        scope: &QueueScope,
    ) -> Result<Vec<ActivitySegment>, AppError> {
        self.queued_segments_for_day_query(timezone, Some(scope))
    }

    fn queued_segments_for_day_query(
        &self,
        timezone: Option<&str>,
        scope: Option<&QueueScope>,
    ) -> Result<Vec<ActivitySegment>, AppError> {
        let zone: Tz = timezone
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("UTC")
            .parse()
            .map_err(|_| AppError::Validation("invalid timezone".to_string()))?;
        let today = Utc::now().with_timezone(&zone).date_naive();
        let day_start = zone
            .from_local_datetime(&today.and_hms_opt(0, 0, 0).expect("valid midnight"))
            .single()
            .map(|value| value.timestamp() as f64)
            .unwrap_or(0.0);
        let next_day_start = zone
            .from_local_datetime(
                &today
                    .succ_opt()
                    .expect("valid next day")
                    .and_hms_opt(0, 0, 0)
                    .expect("valid midnight"),
            )
            .single()
            .map(|value| value.timestamp() as f64)
            .unwrap_or(day_start + 86_400.0);
        let destination = scope.map(|value| value.destination.as_str());
        let owner = scope.map(|value| value.owner.as_str());
        let mut stmt = self
            .conn
            .prepare(
                "SELECT payload FROM heartbeat_queue
                 WHERE ?1 IS NULL OR (destination = ?1 AND owner_scope = ?2)",
            )
            .map_err(AppError::Queue)?;
        let rows = stmt
            .query_map(params![destination, owner], |row| row.get::<_, String>(0))
            .map_err(AppError::Queue)?;
        let mut segments_for_day = Vec::new();
        for row in rows {
            let json = row.map_err(AppError::Queue)?;
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&json) else {
                continue;
            };
            let Some(time) = value.get("time").and_then(serde_json::Value::as_f64) else {
                continue;
            };
            if !time.is_finite() {
                continue;
            }
            let seconds = time.floor() as i64;
            let nanos = ((time - time.floor()).max(0.0) * 1_000_000_000.0) as u32;
            let Some(timestamp) = DateTime::<Utc>::from_timestamp(seconds, nanos) else {
                continue;
            };
            if timestamp.with_timezone(&zone).date_naive() == today {
                let mut segments = value
                    .get("activity_segments")
                    .and_then(|value| {
                        serde_json::from_value::<Vec<ActivitySegment>>(value.clone()).ok()
                    })
                    .unwrap_or_default();
                if segments.is_empty() {
                    if let Some(active_seconds) = value
                        .get("active_seconds")
                        .and_then(serde_json::Value::as_f64)
                    {
                        if active_seconds.is_finite()
                            && active_seconds > 0.0
                            && active_seconds <= 120.0
                        {
                            segments.push(ActivitySegment {
                                segment_id: format!(
                                    "legacy:{}",
                                    value
                                        .get("heartbeat_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("queue")
                                ),
                                start: (time - active_seconds).max(0.0),
                                end: time,
                                source: None,
                            });
                        }
                    }
                }
                for segment in segments {
                    let clipped_start = segment.start.max(day_start);
                    let clipped_end = segment.end.min(next_day_start);
                    if clipped_end > clipped_start {
                        segments_for_day.push(ActivitySegment {
                            start: clipped_start,
                            end: clipped_end,
                            source: Some("queued".to_string()),
                            ..segment
                        });
                    }
                }
            }
        }
        Ok(segments_for_day)
    }

    fn db_path() -> PathBuf {
        let home = dirs::home_dir().expect("หา home directory ไม่เจอ");
        home.join(".wakaclock").join("queue.db")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::{
        CollectorCapabilities, CollectorRegistration, CollectorTransport, EditorSurface,
        ExecutionSurface, HandoffEvent, HandoffEventIdentity, HandoffIngestOutcome,
        TopologyIdentityInput,
    };
    use chrono::DateTime;
    use uuid::Uuid;

    fn test_ledger() -> HandoffLedger {
        let topology = TopologyIdentityInput {
            execution: ExecutionSurface::DevContainer,
            editor: EditorSurface::Vscode,
            device_seed: "queue-test-device".to_string(),
            workspace_key: "queue-test-workspace".to_string(),
            worktree_key: "queue-test-worktree".to_string(),
            session_id: "queue-test-session".to_string(),
            runtime_instance_key: Some("container-1".to_string()),
            repository_id: None,
        }
        .build()
        .unwrap();
        let registration = CollectorRegistration::new(
            "collector-queue-test",
            Some("bridge-queue-test".to_string()),
            "boot-queue-test",
            topology,
            CollectorTransport::AuthenticatedBridge,
            CollectorCapabilities {
                file_mutations: true,
                ..Default::default()
            },
        )
        .unwrap();
        let mut ledger = HandoffLedger::default();
        ledger.register(registration).unwrap();
        let event = HandoffEvent {
            identity: HandoffEventIdentity {
                event_id: "queue-event-1".to_string(),
                operation_id: Some("queue-tool-1".to_string()),
                mutation_id: Some("queue-file-v1".to_string()),
                scope_id: None,
            },
            source_sequence: 1,
            occurred_at: DateTime::from_timestamp(1, 0).unwrap(),
        };
        assert_eq!(
            ledger.ingest("collector-queue-test", event),
            Ok(HandoffIngestOutcome::Accepted { receipt_id: 1 })
        );
        ledger
    }

    #[test]
    fn handoff_snapshot_survives_queue_reopen_and_can_be_cleared() {
        let path =
            std::env::temp_dir().join(format!("wakaclock-topology-queue-{}.db", Uuid::new_v4()));
        let ledger = test_ledger();
        {
            let queue = Queue::open_at(&path).unwrap();
            queue.save_handoff_ledger(&ledger).unwrap();
            assert_eq!(
                queue.load_handoff_ledger().unwrap().unwrap().pending_len(),
                1
            );
        }
        {
            let queue = Queue::open_at(&path).unwrap();
            let restored = queue.load_handoff_ledger().unwrap().unwrap();
            assert_eq!(restored.pending_len(), 1);
            queue.clear_handoff_ledger().unwrap();
            assert!(queue.load_handoff_ledger().unwrap().is_none());
        }
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn old_handoff_snapshot_is_not_deleted_while_it_may_hold_pending_receipts() {
        let path = std::env::temp_dir().join(format!(
            "wakaclock-topology-queue-retention-{}.db",
            Uuid::new_v4()
        ));
        let ledger = test_ledger();
        {
            let queue = Queue::open_at(&path).unwrap();
            queue.save_handoff_ledger(&ledger).unwrap();
            queue
                .conn
                .execute(
                    "UPDATE topology_handoff_state SET updated_at = strftime('%s', 'now') - 2592001",
                    [],
                )
                .unwrap();
        }
        let queue = Queue::open_at(&path).unwrap();
        assert_eq!(
            queue.load_handoff_ledger().unwrap().unwrap().pending_len(),
            1
        );
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn correction_revisions_are_distinct_and_delivered_in_order() {
        let path =
            std::env::temp_dir().join(format!("wakaclock-revision-queue-{}.db", Uuid::new_v4()));
        let queue = Queue::open_at(&path).unwrap();
        let scope = QueueScope {
            destination: "https://one.example".to_string(),
            owner: "owner-a".to_string(),
        };
        for revision in [1, 0, 1] {
            queue
                .push_scoped(
                    &serde_json::json!({
                        "heartbeat_id": "same",
                        "session_id": "session",
                        "entity": "a.rs",
                        "revision": revision
                    }),
                    &scope,
                )
                .unwrap();
        }
        let rows = queue.claim_batch_scoped(&scope, "lease-a").unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].1["revision"], 0);
        assert_eq!(rows[1].1["revision"], 1);
        drop(queue);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn queue_scope_and_lease_prevent_cross_account_delivery() {
        let path =
            std::env::temp_dir().join(format!("wakaclock-scoped-queue-{}.db", Uuid::new_v4()));
        let queue = Queue::open_at(&path).unwrap();
        let owner_a = QueueScope {
            destination: "https://one.example".to_string(),
            owner: "owner-a".to_string(),
        };
        let owner_b = QueueScope {
            destination: "https://one.example".to_string(),
            owner: "owner-b".to_string(),
        };
        queue
            .push_scoped(
                &serde_json::json!({"heartbeat_id":"a", "entity":"a.rs"}),
                &owner_a,
            )
            .unwrap();
        assert_eq!(queue.len_scoped(&owner_a).unwrap(), 1);
        assert_eq!(queue.len_scoped(&owner_b).unwrap(), 0);
        assert!(queue
            .claim_batch_scoped(&owner_b, "lease-b")
            .unwrap()
            .is_empty());
        assert_eq!(
            queue.claim_batch_scoped(&owner_a, "lease-a").unwrap().len(),
            1
        );
        assert!(queue
            .claim_batch_scoped(&owner_a, "second-process")
            .unwrap()
            .is_empty());
        drop(queue);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn malformed_rows_move_to_recoverable_dead_letter_storage() {
        let path =
            std::env::temp_dir().join(format!("wakaclock-dead-letter-queue-{}.db", Uuid::new_v4()));
        let queue = Queue::open_at(&path).unwrap();
        queue
            .push(&serde_json::json!({"heartbeat_id":"bad", "entity":"a.rs"}))
            .unwrap();
        let row = queue.pop_all().unwrap().remove(0);
        queue.dead_letter(row.0, "HTTP 422").unwrap();
        assert_eq!(queue.len().unwrap(), 0);
        assert_eq!(queue.dead_letter_len().unwrap(), 1);
        drop(queue);
        let _ = std::fs::remove_file(path);
    }

    // -----------------------------------------------------------------------
    // Offline reliability Phase 02 — same-account queue rebind
    // -----------------------------------------------------------------------

    const ORIGIN: &str = "https://api.example.test";
    const OWNER_1: &str = "1111111111111111111111111111111111111111111111111111111111111111";
    const OWNER_2: &str = "2222222222222222222222222222222222222222222222222222222222222222";

    struct TempQueue {
        path: std::path::PathBuf,
        queue: Queue,
    }

    impl TempQueue {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("wakaclock-rebind-queue-{}.db", Uuid::new_v4()));
            let queue = Queue::open_at(&path).unwrap();
            Self { path, queue }
        }

        /// (heartbeat_id, owner_scope, destination, payload bytes, retry_count)
        fn rows(&self) -> Vec<(String, String, String, String, i64)> {
            let mut statement = self
                .queue
                .conn
                .prepare(
                    "SELECT heartbeat_id, owner_scope, destination, payload, retry_count
                     FROM heartbeat_queue ORDER BY id",
                )
                .unwrap();
            let rows = statement
                .query_map([], |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                })
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();
            rows
        }
    }

    impl Drop for TempQueue {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.path);
        }
    }

    fn scope(destination: &str, key: &str) -> QueueScope {
        QueueScope {
            destination: destination.to_string(),
            owner: format!("key:{key}"),
        }
    }

    fn row(heartbeat_id: &str, time: f64, revision: u64) -> serde_json::Value {
        serde_json::json!({
            "heartbeat_id": heartbeat_id,
            "entity": "/fixture/main.rs",
            "time": time,
            "revision": revision,
            "active_seconds": 30.0,
        })
    }

    #[test]
    fn same_owner_rebind_is_atomic_and_preserves_every_row() {
        let temp = TempQueue::new();
        let (old, new) = (scope(ORIGIN, "old"), scope(ORIGIN, "new"));
        for index in 0..5 {
            temp.queue
                .push_scoped(
                    &row(&format!("hb-{index}"), 1_000.0 + index as f64, 0),
                    &old,
                )
                .unwrap();
        }
        temp.queue.record_credential_owner(&old, OWNER_1).unwrap();
        temp.queue.record_credential_owner(&new, OWNER_1).unwrap();

        let report = temp.queue.rebind_same_owner(&new, OWNER_1).unwrap();

        assert_eq!(report.rows_moved, 5);
        assert_eq!(report.duplicates_dropped, 0);
        assert_eq!(temp.queue.len_scoped(&old).unwrap(), 0);
        assert_eq!(temp.queue.len_scoped(&new).unwrap(), 5);
        assert_eq!(temp.queue.len().unwrap(), 5);
        let audits: i64 = temp
            .queue
            .conn
            .query_row("SELECT COUNT(*) FROM queue_rebind_audit", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(audits, 1);
        // A second rebind is a no-op.
        assert_eq!(
            temp.queue.rebind_same_owner(&new, OWNER_1).unwrap(),
            RebindReport::default()
        );
    }

    #[test]
    fn rebind_preserves_heartbeat_id_timestamp_revision_and_payload_bytes() {
        let temp = TempQueue::new();
        let (old, new) = (scope(ORIGIN, "old"), scope(ORIGIN, "new"));
        temp.queue
            .push_scoped(&row("hb-keep", 1_234.5, 3), &old)
            .unwrap();
        let (id, _) = temp
            .queue
            .claim_batch_scoped(&old, "lease")
            .unwrap()
            .remove(0);
        temp.queue.mark_retry(id).unwrap();
        let before = temp.rows();

        temp.queue.record_credential_owner(&old, OWNER_1).unwrap();
        temp.queue.record_credential_owner(&new, OWNER_1).unwrap();
        temp.queue.rebind_same_owner(&new, OWNER_1).unwrap();

        let after = temp.rows();
        assert_eq!(after.len(), 1);
        assert_eq!(after[0].0, before[0].0, "heartbeat id");
        assert_eq!(
            after[0].3, before[0].3,
            "payload bytes (time, revision) unchanged"
        );
        assert_eq!(after[0].4, before[0].4, "retry state unchanged");
        assert_eq!(after[0].1, new.owner);
    }

    #[test]
    fn different_owner_proof_is_rejected_without_mutation() {
        let temp = TempQueue::new();
        let (account_1, account_2) = (scope(ORIGIN, "acct1"), scope(ORIGIN, "acct2"));
        temp.queue
            .push_scoped(&row("hb-a", 1_000.0, 0), &account_1)
            .unwrap();
        temp.queue
            .record_credential_owner(&account_1, OWNER_1)
            .unwrap();
        temp.queue
            .record_credential_owner(&account_2, OWNER_2)
            .unwrap();
        let before = temp.rows();

        // Account 2 has its own proof, but it names a different owner.
        assert_eq!(
            temp.queue.rebind_same_owner(&account_2, OWNER_2).unwrap(),
            RebindReport::default()
        );
        // Claiming account 1's owner without a matching recorded proof fails.
        assert!(temp.queue.rebind_same_owner(&account_2, OWNER_1).is_err());
        assert_eq!(temp.rows(), before);
    }

    #[test]
    fn different_origin_rebind_is_rejected() {
        let temp = TempQueue::new();
        let old = scope("https://old.example.test", "old");
        let new = scope(ORIGIN, "new");
        temp.queue
            .push_scoped(&row("hb-origin", 1_000.0, 0), &old)
            .unwrap();
        temp.queue.record_credential_owner(&old, OWNER_1).unwrap();
        temp.queue.record_credential_owner(&new, OWNER_1).unwrap();
        let before = temp.rows();

        assert_eq!(
            temp.queue.rebind_same_owner(&new, OWNER_1).unwrap(),
            RebindReport::default()
        );
        assert_eq!(temp.rows(), before);
        assert_eq!(temp.queue.orphaned_len(&new).unwrap(), 1);
    }

    #[test]
    fn rebind_conflict_deduplicates_only_exact_delivery_identity() {
        let temp = TempQueue::new();
        let (old, new) = (scope(ORIGIN, "old"), scope(ORIGIN, "new"));
        // Same delivery identity queued under both credentials (retry after rotation).
        temp.queue
            .push_scoped(&row("hb-same", 1_000.0, 0), &old)
            .unwrap();
        temp.queue
            .push_scoped(&row("hb-same", 1_000.0, 0), &new)
            .unwrap();
        // Same heartbeat id but a newer revision: a distinct correction, must survive.
        temp.queue
            .push_scoped(&row("hb-same", 1_000.0, 1), &old)
            .unwrap();
        temp.queue
            .push_scoped(&row("hb-other", 1_001.0, 0), &old)
            .unwrap();
        temp.queue.record_credential_owner(&old, OWNER_1).unwrap();
        temp.queue.record_credential_owner(&new, OWNER_1).unwrap();

        let report = temp.queue.rebind_same_owner(&new, OWNER_1).unwrap();

        assert_eq!(report.duplicates_dropped, 1);
        assert_eq!(report.rows_moved, 2);
        assert_eq!(temp.queue.len_scoped(&new).unwrap(), 3);
        assert_eq!(temp.queue.len().unwrap(), 3);
    }

    #[test]
    fn crash_before_commit_leaves_the_old_scope_intact() {
        let temp = TempQueue::new();
        let (old, new) = (scope(ORIGIN, "old"), scope(ORIGIN, "new"));
        temp.queue
            .push_scoped(&row("hb-1", 1_000.0, 0), &old)
            .unwrap();
        temp.queue
            .push_scoped(&row("hb-2", 1_001.0, 0), &old)
            .unwrap();
        temp.queue.record_credential_owner(&old, OWNER_1).unwrap();
        temp.queue.record_credential_owner(&new, OWNER_1).unwrap();
        let before = temp.rows();
        // Force the final write of the transaction (the audit insert) to fail after
        // the rows were already updated inside it.
        temp.queue
            .conn
            .execute("DROP TABLE queue_rebind_audit", [])
            .unwrap();

        assert!(temp.queue.rebind_same_owner(&new, OWNER_1).is_err());
        assert_eq!(
            temp.rows(),
            before,
            "a failed rebind must roll back entirely"
        );
    }

    #[test]
    fn legacy_rows_are_visible_as_recovery_required_not_deleted() {
        let temp = TempQueue::new();
        let (legacy, new) = (scope(ORIGIN, "revoked"), scope(ORIGIN, "new"));
        // Rows from a key that was never verified: no owner proof exists for it.
        temp.queue
            .push_scoped(&row("hb-legacy-1", 1_000.0, 0), &legacy)
            .unwrap();
        temp.queue
            .push_scoped(&row("hb-legacy-2", 1_001.0, 0), &legacy)
            .unwrap();
        temp.queue.record_credential_owner(&new, OWNER_1).unwrap();

        assert_eq!(
            temp.queue.rebind_same_owner(&new, OWNER_1).unwrap(),
            RebindReport::default()
        );
        assert_eq!(temp.queue.orphaned_len(&new).unwrap(), 2);
        assert_eq!(temp.queue.len_scoped(&legacy).unwrap(), 2);
        assert!(temp
            .queue
            .claim_batch_scoped(&new, "lease")
            .unwrap()
            .is_empty());
    }

    // -----------------------------------------------------------------------
    // Offline reliability Phase 03 — scoped delivery state and recovery leases
    // -----------------------------------------------------------------------

    #[test]
    fn failure_state_is_isolated_by_origin_and_owner() {
        let temp = TempQueue::new();
        let mine = scope(ORIGIN, "mine");
        let other_account = scope(ORIGIN, "other");
        let other_origin = scope("https://other.example.test", "mine");

        temp.queue
            .record_delivery_failure(
                &mine,
                &DeliveryFailureRecord::new("payment_402", Some(402), "http_status"),
            )
            .unwrap();

        assert_eq!(
            temp.queue
                .delivery_failure_for(&mine)
                .unwrap()
                .unwrap()
                .kind,
            "payment_402"
        );
        assert!(temp
            .queue
            .delivery_failure_for(&other_account)
            .unwrap()
            .is_none());
        assert!(temp
            .queue
            .delivery_failure_for(&other_origin)
            .unwrap()
            .is_none());

        // A success elsewhere must not resolve this scope's refusal.
        temp.queue
            .clear_delivery_failure(&other_account, None)
            .unwrap();
        temp.queue
            .clear_delivery_failure(&other_origin, None)
            .unwrap();
        assert!(temp.queue.delivery_failure_for(&mine).unwrap().is_some());
    }

    #[test]
    fn a_probe_clears_only_network_and_server_failures() {
        let temp = TempQueue::new();
        let target = scope(ORIGIN, "mine");
        let probe_kinds = ["network", "server_error"];

        for (kind, status) in [("network", None), ("server_error", Some(503))] {
            temp.queue
                .record_delivery_failure(&target, &DeliveryFailureRecord::new(kind, status, "x"))
                .unwrap();
            assert!(temp
                .queue
                .clear_delivery_failure(&target, Some(&probe_kinds))
                .unwrap());
            assert!(temp.queue.delivery_failure_for(&target).unwrap().is_none());
        }

        for (kind, status) in [("auth_401", Some(401)), ("payment_402", Some(402))] {
            temp.queue
                .record_delivery_failure(&target, &DeliveryFailureRecord::new(kind, status, "x"))
                .unwrap();
            assert!(!temp
                .queue
                .clear_delivery_failure(&target, Some(&probe_kinds))
                .unwrap());
            let kept = temp.queue.delivery_failure_for(&target).unwrap().unwrap();
            assert_eq!(kept.kind, kind, "a probe must not resolve a refusal");
            // A delivery success clears it.
            assert!(temp.queue.clear_delivery_failure(&target, None).unwrap());
        }
    }

    #[test]
    fn repeated_failures_of_the_same_kind_count_up_and_a_new_kind_restarts() {
        let temp = TempQueue::new();
        let target = scope(ORIGIN, "mine");
        let network = DeliveryFailureRecord::new("network", None, "connect_failed");
        temp.queue
            .record_delivery_failure(&target, &network)
            .unwrap();
        temp.queue
            .record_delivery_failure(&target, &network)
            .unwrap();
        let repeated = temp.queue.delivery_failure_for(&target).unwrap().unwrap();
        assert_eq!(repeated.consecutive_failures, 2);

        temp.queue
            .record_delivery_failure(
                &target,
                &DeliveryFailureRecord::new("payment_402", Some(402), "http_status"),
            )
            .unwrap();
        let switched = temp.queue.delivery_failure_for(&target).unwrap().unwrap();
        assert_eq!(switched.kind, "payment_402");
        assert_eq!(switched.consecutive_failures, 1);
    }

    #[test]
    fn two_recovery_workers_do_not_deliver_the_same_lease() {
        let temp = TempQueue::new();
        let target = scope(ORIGIN, "mine");
        for index in 0..3 {
            temp.queue
                .push_scoped(
                    &row(&format!("hb-{index}"), 1_000.0 + index as f64, 0),
                    &target,
                )
                .unwrap();
        }

        let first = temp.queue.claim_batch_scoped(&target, "worker-a").unwrap();
        let second = temp.queue.claim_batch_scoped(&target, "worker-b").unwrap();

        assert_eq!(first.len(), 3);
        assert!(second.is_empty(), "a leased row must not be claimed twice");
        assert_eq!(temp.queue.eligible_len_scoped(&target).unwrap(), 0);
    }

    #[test]
    fn shutdown_and_restart_reclaim_expired_lease() {
        let temp = TempQueue::new();
        let target = scope(ORIGIN, "mine");
        temp.queue
            .push_scoped(&row("hb-crash", 1_000.0, 0), &target)
            .unwrap();
        let claimed = temp
            .queue
            .claim_batch_scoped(&target, "worker-crashed")
            .unwrap();
        assert_eq!(claimed.len(), 1);

        // The process died without releasing: nothing else may take it yet.
        assert!(temp
            .queue
            .claim_batch_scoped(&target, "worker-new")
            .unwrap()
            .is_empty());

        // Once the lease deadline passes, the row is recoverable.
        temp.queue
            .conn
            .execute("UPDATE heartbeat_queue SET lease_until = 0", [])
            .unwrap();
        let reclaimed = temp
            .queue
            .claim_batch_scoped(&target, "worker-new")
            .unwrap();
        assert_eq!(reclaimed.len(), 1);
        assert_eq!(
            temp.rows().len(),
            1,
            "the row is delivered, never duplicated"
        );
    }

    #[test]
    fn a_row_waiting_on_a_backoff_is_queued_but_not_eligible() {
        let temp = TempQueue::new();
        let target = scope(ORIGIN, "mine");
        temp.queue
            .push_scoped_after(&row("hb-delayed", 1_000.0, 0), &target, Some(120))
            .unwrap();

        assert_eq!(temp.queue.len_scoped(&target).unwrap(), 1);
        assert_eq!(temp.queue.eligible_len_scoped(&target).unwrap(), 0);
        assert!(temp
            .queue
            .claim_batch_scoped(&target, "worker")
            .unwrap()
            .is_empty());
    }
}

//! Reader for the `cursorDiskKV` table of a VS Code–fork `state.vscdb` (Cursor, Windsurf).
//!
//! Each chat message ("bubble") is one row keyed `bubbleId:<composerId>:<bubbleId>` with
//! a JSON value. Only that key prefix is queried: the same database holds unrelated
//! editor state. A bubble is often written first and updated in place later (a tool call
//! moves from pending to completed, token counts are filled in), and an in-place update
//! keeps its rowid, so each pass also re-reads a window of recent rows. Events derived
//! from a bubble use IDs that do not change between reads, so re-reading is idempotent
//! downstream (delivered events, dry-run edits and usage are all keyed by ID).

use crate::ai::source::SourceCheckpoint;
use crate::ai::sqlite_source::{open_read_only, read_rows_after, SqliteRead, SqliteReadOptions};
use rusqlite::types::ValueRef;
use serde_json::Value;
use std::path::Path;

/// Rowids re-read below the checkpoint each pass to catch bubbles updated in place.
pub const RESCAN_ROWS: i64 = 500;

const BUBBLE_QUERY: &str = "SELECT rowid, key, value FROM cursorDiskKV \
     WHERE rowid > ?1 AND key LIKE 'bubbleId:%' ORDER BY rowid LIMIT ?2";
const MAX_BUBBLE_ROWID: &str =
    "SELECT COALESCE(MAX(rowid), 0) FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'";

#[derive(Debug, Clone, PartialEq)]
pub struct Bubble {
    pub composer_id: String,
    pub bubble_id: String,
    pub value: Value,
}

#[derive(Debug)]
pub struct BubbleRead {
    pub bubbles: Vec<Bubble>,
    /// Checkpoint to store for the next pass (unchanged when nothing was read).
    pub checkpoint: Option<SourceCheckpoint>,
    /// The database was locked by its owner; nothing was read this pass.
    pub locked: bool,
}

fn split_key(key: &str) -> Option<(String, String)> {
    let mut parts = key.strip_prefix("bubbleId:")?.splitn(2, ':');
    let composer = parts.next().filter(|part| !part.is_empty())?;
    let bubble = parts.next().filter(|part| !part.is_empty())?;
    Some((composer.to_string(), bubble.to_string()))
}

fn json_value(raw: ValueRef<'_>) -> Option<Value> {
    let bytes = match raw {
        ValueRef::Text(bytes) | ValueRef::Blob(bytes) => bytes,
        _ => return None,
    };
    serde_json::from_slice(bytes).ok()
}

/// Read bubbles newer than the checkpoint, plus a window of recent rows.
pub fn read_bubbles(
    db: &Path,
    checkpoint: Option<&SourceCheckpoint>,
    options: &SqliteReadOptions,
) -> rusqlite::Result<BubbleRead> {
    let (last_rowid, previous) = match checkpoint {
        Some(SourceCheckpoint::Sqlite {
            last_rowid,
            fingerprint,
        }) => (*last_rowid, fingerprint.as_ref()),
        _ => (0, None),
    };
    let start = last_rowid.saturating_sub(RESCAN_ROWS).max(0);
    let read = read_rows_after(
        db,
        start,
        previous,
        BUBBLE_QUERY,
        |row| {
            let key: String = row.get(1)?;
            let value = json_value(row.get_ref(2)?);
            Ok(split_key(&key)
                .zip(value)
                .map(|((composer_id, bubble_id), value)| Bubble {
                    composer_id,
                    bubble_id,
                    value,
                }))
        },
        options,
    )?;
    Ok(match read {
        SqliteRead::Missing | SqliteRead::Unchanged => BubbleRead {
            bubbles: Vec::new(),
            checkpoint: checkpoint.cloned(),
            locked: false,
        },
        SqliteRead::Locked => BubbleRead {
            bubbles: Vec::new(),
            checkpoint: checkpoint.cloned(),
            locked: true,
        },
        SqliteRead::Rows {
            rows,
            last_rowid: read_to,
            fingerprint,
            complete,
        } => BubbleRead {
            bubbles: rows.into_iter().flatten().collect(),
            checkpoint: Some(SourceCheckpoint::Sqlite {
                last_rowid: read_to.max(last_rowid),
                // A pass cut short by the row limit or time budget must not record the
                // fingerprint, or the next pass would skip the unread rows as unchanged.
                fingerprint: complete.then_some(fingerprint),
            }),
            locked: false,
        },
    })
}

/// Highest bubble rowid, used to skip existing history on first discovery.
pub fn max_bubble_rowid(db: &Path, options: &SqliteReadOptions) -> rusqlite::Result<i64> {
    open_read_only(db, options.busy_timeout)?.query_row(MAX_BUBBLE_ROWID, [], |row| row.get(0))
}

#[cfg(test)]
pub(crate) mod test_db {
    use rusqlite::{params, Connection};
    use std::path::{Path, PathBuf};

    pub fn path(name: &str) -> PathBuf {
        let nonce = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("wakaclock-vscdb-{name}-{nonce}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("state.vscdb")
    }

    /// The table shape VS Code forks use for key/value state.
    pub fn create(path: &Path) -> Connection {
        let connection = Connection::open(path).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS cursorDiskKV \
                 (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB);",
            )
            .unwrap();
        connection
    }

    pub fn put(connection: &Connection, key: &str, value: &serde_json::Value) {
        connection
            .execute(
                "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
                params![key, serde_json::to_vec(value).unwrap()],
            )
            .unwrap();
    }

    /// Update in place, keeping the rowid, as the editor does when a bubble changes.
    pub fn update(connection: &Connection, key: &str, value: &serde_json::Value) {
        connection
            .execute(
                "UPDATE cursorDiskKV SET value = ?2 WHERE key = ?1",
                params![key, serde_json::to_vec(value).unwrap()],
            )
            .unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_bubble_keys_are_read() {
        let db = test_db::path("keys");
        let connection = test_db::create(&db);
        test_db::put(
            &connection,
            "composerData:c1",
            &json!({"private": "editor state"}),
        );
        test_db::put(&connection, "bubbleId:c1:b1", &json!({"type": 1}));
        test_db::put(&connection, "checkpointId:c1", &json!({"x": 1}));
        let read = read_bubbles(&db, None, &SqliteReadOptions::default()).unwrap();
        assert_eq!(read.bubbles.len(), 1);
        assert_eq!(read.bubbles[0].composer_id, "c1");
        assert_eq!(read.bubbles[0].bubble_id, "b1");
    }

    #[test]
    fn a_bubble_updated_in_place_is_seen_again() {
        let db = test_db::path("update");
        let connection = test_db::create(&db);
        test_db::put(&connection, "bubbleId:c1:b1", &json!({"status": "pending"}));
        let first = read_bubbles(&db, None, &SqliteReadOptions::default()).unwrap();
        test_db::update(
            &connection,
            "bubbleId:c1:b1",
            &json!({"status": "completed"}),
        );
        let second = read_bubbles(
            &db,
            first.checkpoint.as_ref(),
            &SqliteReadOptions::default(),
        )
        .unwrap();
        assert_eq!(second.bubbles[0].value["status"], "completed");
    }

    #[test]
    fn an_unchanged_database_reads_nothing_and_keeps_its_checkpoint() {
        let db = test_db::path("unchanged");
        let connection = test_db::create(&db);
        test_db::put(&connection, "bubbleId:c1:b1", &json!({"type": 1}));
        drop(connection);
        let first = read_bubbles(&db, None, &SqliteReadOptions::default()).unwrap();
        let second = read_bubbles(
            &db,
            first.checkpoint.as_ref(),
            &SqliteReadOptions::default(),
        )
        .unwrap();
        assert!(second.bubbles.is_empty());
        assert_eq!(second.checkpoint, first.checkpoint);
    }

    #[test]
    fn a_text_value_and_a_malformed_value_are_handled() {
        let db = test_db::path("values");
        let connection = test_db::create(&db);
        connection
            .execute(
                "INSERT INTO cursorDiskKV (key, value) VALUES ('bubbleId:c1:b1', '{\"type\":2}')",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO cursorDiskKV (key, value) VALUES ('bubbleId:c1:b2', 'not json')",
                [],
            )
            .unwrap();
        let read = read_bubbles(&db, None, &SqliteReadOptions::default()).unwrap();
        assert_eq!(read.bubbles.len(), 1);
        assert_eq!(read.bubbles[0].value["type"], 2);
    }

    #[test]
    fn max_rowid_counts_only_bubbles() {
        let db = test_db::path("max");
        let connection = test_db::create(&db);
        test_db::put(&connection, "bubbleId:c1:b1", &json!({}));
        test_db::put(&connection, "composerData:c1", &json!({}));
        assert_eq!(
            max_bubble_rowid(&db, &SqliteReadOptions::default()).unwrap(),
            1
        );
    }
}

//! Read-only access to another tool's SQLite session store.
//!
//! The store belongs to a running application, so reading must never change it or
//! hold it up: the database is opened read-only through a `mode=ro` URI (never
//! `immutable=1`, because the owner may be writing its WAL), a busy store is skipped
//! for this pass instead of waited on, rows are read in small rowid-ordered batches,
//! and a watchdog interrupts a query that outlives the pass's time budget.

use crate::ai::source::DbFingerprint;
use rusqlite::{params, Connection, ErrorCode, OpenFlags, Row};
use std::cell::Cell;
use std::path::Path;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

/// Reads on this thread that stopped short since the last [`take_read_outcomes`]. A
/// caller takes them right after running one parser, so the counts belong to it
/// without every parser having to report them.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ReadOutcomes {
    /// Reads stopped by the time budget (not by the row limit).
    pub budget_hits: u32,
    /// Reads skipped or cut short because the owner held a lock.
    pub busy: u32,
    /// Queries that failed for another reason, which is how an unknown schema shows.
    pub failures: u32,
}

thread_local! {
    static READ_OUTCOMES: Cell<ReadOutcomes> = Cell::new(ReadOutcomes::default());
}

/// Return and reset this thread's read outcomes.
pub fn take_read_outcomes() -> ReadOutcomes {
    READ_OUTCOMES.with(|outcomes| outcomes.take())
}

fn note(update: impl FnOnce(&mut ReadOutcomes)) {
    READ_OUTCOMES.with(|outcomes| {
        let mut current = outcomes.get();
        update(&mut current);
        outcomes.set(current);
    });
}

#[derive(Debug, Clone, Copy)]
pub struct SqliteReadOptions {
    /// Rows fetched per query.
    pub batch_rows: usize,
    /// Rows read in one pass; the rest wait for the next pass.
    pub max_rows: usize,
    /// How long to wait for a writer's lock before skipping the store this pass.
    pub busy_timeout: Duration,
    /// Wall-clock budget for the whole pass, enforced by interrupting the query.
    pub time_budget: Duration,
}

impl Default for SqliteReadOptions {
    fn default() -> Self {
        Self {
            batch_rows: 256,
            max_rows: 5_000,
            busy_timeout: Duration::from_millis(250),
            time_budget: Duration::from_secs(5),
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum SqliteRead<T> {
    /// The database file does not exist.
    Missing,
    /// Neither the database nor its WAL changed since `previous`.
    Unchanged,
    /// Another process held the lock; try again next pass.
    Locked,
    Rows {
        rows: Vec<T>,
        /// Highest rowid read; the next pass resumes after it.
        last_rowid: i64,
        fingerprint: DbFingerprint,
        /// False when the row limit or time budget stopped the pass early.
        complete: bool,
    },
}

/// Open `path` read-only. The URI form is required for `mode=ro`, so characters that
/// would be read as URI syntax are percent-encoded.
pub fn open_read_only(path: &Path, busy_timeout: Duration) -> rusqlite::Result<Connection> {
    let uri = format!("file:{}?mode=ro", encode_uri_path(&path.to_string_lossy()));
    let connection = Connection::open_with_flags(
        uri,
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    connection.busy_timeout(busy_timeout)?;
    Ok(connection)
}

fn encode_uri_path(path: &str) -> String {
    let mut encoded = String::with_capacity(path.len());
    for character in path.chars() {
        match character {
            '%' => encoded.push_str("%25"),
            '?' => encoded.push_str("%3F"),
            '#' => encoded.push_str("%23"),
            ' ' => encoded.push_str("%20"),
            other => encoded.push(other),
        }
    }
    encoded
}

fn is_lock_error(error: &rusqlite::Error) -> bool {
    matches!(
        error,
        rusqlite::Error::SqliteFailure(failure, _)
            if matches!(failure.code, ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked)
    )
}

fn is_interrupt(error: &rusqlite::Error) -> bool {
    matches!(
        error,
        rusqlite::Error::SqliteFailure(failure, _) if failure.code == ErrorCode::OperationInterrupted
    )
}

/// Read rows newer than `last_rowid`.
///
/// `query` must select the rowid as its first column, take `?1` as the last rowid
/// already read and `?2` as a row limit, and order by rowid ascending — for example
/// `SELECT rowid, key, value FROM t WHERE rowid > ?1 ORDER BY rowid LIMIT ?2`.
pub fn read_rows_after<T>(
    path: &Path,
    last_rowid: i64,
    previous: Option<&DbFingerprint>,
    query: &str,
    mut map: impl FnMut(&Row) -> rusqlite::Result<T>,
    options: &SqliteReadOptions,
) -> rusqlite::Result<SqliteRead<T>> {
    let Ok(Some(fingerprint)) = DbFingerprint::of(path) else {
        return Ok(SqliteRead::Missing);
    };
    if previous == Some(&fingerprint) {
        return Ok(SqliteRead::Unchanged);
    }
    let connection = match open_read_only(path, options.busy_timeout) {
        Ok(connection) => connection,
        Err(error) if is_lock_error(&error) => {
            note(|outcomes| outcomes.busy += 1);
            return Ok(SqliteRead::Locked);
        }
        Err(error) => {
            note(|outcomes| outcomes.failures += 1);
            return Err(error);
        }
    };

    let deadline = Instant::now() + options.time_budget;
    let interrupt = connection.get_interrupt_handle();
    let (finished, finished_signal) = mpsc::channel::<()>();
    let budget = options.time_budget;
    let watchdog = thread::spawn(move || {
        if finished_signal.recv_timeout(budget).is_err() {
            interrupt.interrupt();
        }
    });

    let outcome = read_batches(&connection, last_rowid, query, &mut map, options, deadline);
    let _ = finished.send(());
    let _ = watchdog.join();

    match outcome {
        Ok((rows, last, complete)) => Ok(SqliteRead::Rows {
            rows,
            last_rowid: last,
            fingerprint,
            complete,
        }),
        Err(BatchError::Locked { rows, last }) if rows.is_empty() && last == last_rowid => {
            note(|outcomes| outcomes.busy += 1);
            Ok(SqliteRead::Locked)
        }
        Err(BatchError::Locked { rows, last }) => {
            note(|outcomes| outcomes.busy += 1);
            Ok(SqliteRead::Rows {
                rows,
                last_rowid: last,
                fingerprint,
                complete: false,
            })
        }
        Err(BatchError::Sqlite(error)) => {
            note(|outcomes| outcomes.failures += 1);
            Err(error)
        }
    }
}

enum BatchError<T> {
    Locked { rows: Vec<T>, last: i64 },
    Sqlite(rusqlite::Error),
}

fn read_batches<T>(
    connection: &Connection,
    last_rowid: i64,
    query: &str,
    map: &mut impl FnMut(&Row) -> rusqlite::Result<T>,
    options: &SqliteReadOptions,
    deadline: Instant,
) -> Result<(Vec<T>, i64, bool), BatchError<T>> {
    let mut statement = match connection.prepare(query) {
        Ok(statement) => statement,
        Err(error) if is_lock_error(&error) => {
            return Err(BatchError::Locked {
                rows: Vec::new(),
                last: last_rowid,
            })
        }
        Err(error) => return Err(BatchError::Sqlite(error)),
    };
    let mut rows = Vec::new();
    let mut last = last_rowid;
    loop {
        if rows.len() >= options.max_rows {
            return Ok((rows, last, false));
        }
        if Instant::now() >= deadline {
            note(|outcomes| outcomes.budget_hits += 1);
            return Ok((rows, last, false));
        }
        let limit = options.batch_rows.min(options.max_rows - rows.len()) as i64;
        let mut fetched = 0usize;
        let mut cursor = match statement.query(params![last, limit]) {
            Ok(cursor) => cursor,
            Err(error) if is_lock_error(&error) => return Err(BatchError::Locked { rows, last }),
            Err(error) if is_interrupt(&error) => {
                note(|outcomes| outcomes.budget_hits += 1);
                return Ok((rows, last, false));
            }
            Err(error) => return Err(BatchError::Sqlite(error)),
        };
        loop {
            match cursor.next() {
                Ok(Some(row)) => {
                    let rowid: i64 = row.get(0).map_err(BatchError::Sqlite)?;
                    rows.push(map(row).map_err(BatchError::Sqlite)?);
                    last = rowid;
                    fetched += 1;
                }
                Ok(None) => break,
                Err(error) if is_lock_error(&error) => {
                    return Err(BatchError::Locked { rows, last })
                }
                Err(error) if is_interrupt(&error) => {
                    note(|outcomes| outcomes.budget_hits += 1);
                    return Ok((rows, last, false));
                }
                Err(error) => return Err(BatchError::Sqlite(error)),
            }
        }
        if (fetched as i64) < limit {
            return Ok((rows, last, true));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};
    use std::path::PathBuf;

    const QUERY: &str = "SELECT rowid, value FROM items WHERE rowid > ?1 ORDER BY rowid LIMIT ?2";

    fn temp_db(name: &str) -> PathBuf {
        let nonce = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("wakaclock sqlite #{name} {nonce}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("store.db")
    }

    fn seed(path: &Path, rows: i64) -> Connection {
        let writer = Connection::open(path).unwrap();
        writer
            .execute_batch("CREATE TABLE IF NOT EXISTS items (value TEXT NOT NULL);")
            .unwrap();
        for index in 0..rows {
            writer
                .execute(
                    "INSERT INTO items (value) VALUES (?1)",
                    params![format!("v{index}")],
                )
                .unwrap();
        }
        writer
    }

    fn read(path: &Path, after: i64, options: &SqliteReadOptions) -> SqliteRead<String> {
        read_rows_after(path, after, None, QUERY, |row| row.get(1), options).unwrap()
    }

    fn file_hash(path: &Path) -> String {
        format!("{:x}", Sha256::digest(std::fs::read(path).unwrap()))
    }

    #[test]
    fn rows_are_read_after_the_cursor_across_batches() {
        let path = temp_db("batches");
        drop(seed(&path, 10));
        let options = SqliteReadOptions {
            batch_rows: 3,
            ..SqliteReadOptions::default()
        };
        match read(&path, 4, &options) {
            SqliteRead::Rows {
                rows,
                last_rowid,
                complete,
                ..
            } => {
                assert_eq!(rows, (4..10).map(|i| format!("v{i}")).collect::<Vec<_>>());
                assert_eq!(last_rowid, 10);
                assert!(complete);
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn the_row_limit_stops_a_pass_and_the_next_pass_resumes() {
        let path = temp_db("limit");
        drop(seed(&path, 10));
        let options = SqliteReadOptions {
            batch_rows: 4,
            max_rows: 6,
            ..SqliteReadOptions::default()
        };
        let SqliteRead::Rows {
            rows,
            last_rowid,
            complete,
            ..
        } = read(&path, 0, &options)
        else {
            panic!("expected rows");
        };
        assert_eq!((rows.len(), last_rowid, complete), (6, 6, false));
        let SqliteRead::Rows {
            rows,
            last_rowid,
            complete,
            ..
        } = read(&path, last_rowid, &options)
        else {
            panic!("expected rows");
        };
        assert_eq!((rows.len(), last_rowid, complete), (4, 10, true));
    }

    #[test]
    fn an_unchanged_store_is_not_opened_and_a_missing_one_is_reported() {
        let path = temp_db("unchanged");
        drop(seed(&path, 2));
        let SqliteRead::Rows { fingerprint, .. } = read(&path, 0, &SqliteReadOptions::default())
        else {
            panic!("expected rows");
        };
        let again = read_rows_after(
            &path,
            2,
            Some(&fingerprint),
            QUERY,
            |row| row.get::<_, String>(1),
            &SqliteReadOptions::default(),
        )
        .unwrap();
        assert_eq!(again, SqliteRead::Unchanged);
        assert_eq!(
            read(
                &path.with_file_name("absent.db"),
                0,
                &SqliteReadOptions::default()
            ),
            SqliteRead::Missing
        );
    }

    #[test]
    fn rows_committed_to_an_open_wal_are_visible() {
        let path = temp_db("wal");
        let writer = seed(&path, 1);
        writer.pragma_update(None, "journal_mode", "WAL").unwrap();
        writer
            .execute("INSERT INTO items (value) VALUES ('from-wal')", [])
            .unwrap();
        // The writer stays open, so the new row lives only in the WAL.
        let SqliteRead::Rows { rows, .. } = read(&path, 1, &SqliteReadOptions::default()) else {
            panic!("expected rows");
        };
        assert_eq!(rows, vec!["from-wal".to_string()]);
        drop(writer);
    }

    #[test]
    fn a_locked_store_is_skipped_without_waiting() {
        let path = temp_db("locked");
        let writer = seed(&path, 3);
        writer.execute_batch("BEGIN EXCLUSIVE;").unwrap();
        take_read_outcomes();
        let started = Instant::now();
        assert_eq!(
            read(&path, 0, &SqliteReadOptions::default()),
            SqliteRead::Locked
        );
        assert!(started.elapsed() < Duration::from_secs(2));
        assert_eq!(take_read_outcomes().busy, 1);
        writer.execute_batch("ROLLBACK;").unwrap();
    }

    #[test]
    fn a_query_past_the_budget_is_interrupted() {
        let path = temp_db("budget");
        drop(seed(&path, 300));
        // A three-way cross join over 300 rows is far slower than the budget.
        let slow = "SELECT rowid, value FROM items \
                    WHERE rowid > ?1 AND (SELECT count(*) FROM items a, items b, items c) >= 0 \
                    ORDER BY rowid LIMIT ?2";
        let options = SqliteReadOptions {
            time_budget: Duration::from_millis(200),
            ..SqliteReadOptions::default()
        };
        take_read_outcomes();
        let started = Instant::now();
        let result = read_rows_after(
            &path,
            0,
            None,
            slow,
            |row| row.get::<_, String>(1),
            &options,
        )
        .unwrap();
        assert!(started.elapsed() < Duration::from_secs(5));
        match result {
            SqliteRead::Rows { complete, .. } => assert!(!complete),
            other => panic!("unexpected {other:?}"),
        }
        assert_eq!(take_read_outcomes().budget_hits, 1);
    }

    #[test]
    fn a_row_limit_is_not_a_budget_hit_but_a_failed_query_is_counted() {
        let path = temp_db("outcomes");
        drop(seed(&path, 10));
        take_read_outcomes();
        let options = SqliteReadOptions {
            max_rows: 4,
            ..SqliteReadOptions::default()
        };
        let SqliteRead::Rows { complete, .. } = read(&path, 0, &options) else {
            panic!("expected rows");
        };
        assert!(!complete);
        assert_eq!(take_read_outcomes(), ReadOutcomes::default());
        let missing = read_rows_after(
            &path,
            0,
            None,
            "SELECT rowid, value FROM no_such_table WHERE rowid > ?1 ORDER BY rowid LIMIT ?2",
            |row| row.get::<_, String>(1),
            &SqliteReadOptions::default(),
        );
        assert!(missing.is_err());
        assert_eq!(take_read_outcomes().failures, 1);
        assert_eq!(take_read_outcomes(), ReadOutcomes::default());
    }

    #[test]
    fn reading_never_changes_the_store() {
        let path = temp_db("checksum");
        drop(seed(&path, 20));
        let before = file_hash(&path);
        let _ = read(&path, 0, &SqliteReadOptions::default());
        assert_eq!(file_hash(&path), before);
        let connection = open_read_only(&path, Duration::from_millis(50)).unwrap();
        assert!(connection
            .execute("INSERT INTO items (value) VALUES ('x')", [])
            .is_err());
    }
}

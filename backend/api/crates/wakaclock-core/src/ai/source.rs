//! Checkpoints for transcript stores that are not append-only JSONL.
//!
//! [`super::parser::ParserCursor`] tracks a byte offset, which is right for a JSONL
//! file that only ever grows. Several agents instead keep sessions in SQLite (rows
//! appended and sometimes updated in place) or in a JSON document they rewrite whole.
//! Those parsers store a [`SourceCheckpoint`] in the cursor's
//! [`super::parser::ParserContext::source`], so the cursor shape and every existing
//! JSONL checkpoint stay unchanged.
//!
//! A fingerprint is size plus modification time. It is only used to skip a store that
//! has not changed since the last pass; it never decides which events are new.

use serde::{Deserialize, Serialize};
use std::io;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// How a parser's source is read. JSONL is the default for every existing parser.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SourceKind {
    #[default]
    Jsonl,
    Sqlite,
    JsonSnapshot,
}

/// Size and modification time of one file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileFingerprint {
    pub size: u64,
    /// Nanoseconds since the Unix epoch (fits `i64` until 2262); `None` when the
    /// platform reports no mtime.
    #[serde(default)]
    pub modified_nanos: Option<i64>,
}

impl FileFingerprint {
    /// `Ok(None)` when the file does not exist.
    pub fn of(path: &Path) -> io::Result<Option<Self>> {
        let metadata = match std::fs::metadata(path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        let modified_nanos = metadata
            .modified()
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .and_then(|elapsed| i64::try_from(elapsed.as_nanos()).ok());
        Ok(Some(Self {
            size: metadata.len(),
            modified_nanos,
        }))
    }
}

/// A SQLite database is unchanged only when both the main file and its write-ahead
/// log are unchanged: a WAL-mode writer can add rows without touching the main file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DbFingerprint {
    pub db: FileFingerprint,
    #[serde(default)]
    pub wal: Option<FileFingerprint>,
}

impl DbFingerprint {
    /// `Ok(None)` when the database file does not exist.
    pub fn of(db_path: &Path) -> io::Result<Option<Self>> {
        let Some(db) = FileFingerprint::of(db_path)? else {
            return Ok(None);
        };
        Ok(Some(Self {
            db,
            wal: FileFingerprint::of(&wal_path(db_path))?,
        }))
    }
}

fn wal_path(db_path: &Path) -> PathBuf {
    let mut name = db_path.as_os_str().to_owned();
    name.push("-wal");
    PathBuf::from(name)
}

/// Resume point for a non-JSONL source.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SourceCheckpoint {
    /// Rows with a rowid above `last_rowid` are new. Rows updated in place are found
    /// through the record-hash table in [`super::state::AiAttributionState`].
    Sqlite {
        last_rowid: i64,
        #[serde(default)]
        fingerprint: Option<DbFingerprint>,
    },
    /// The whole document is re-read when the file changes; records are compared by
    /// hash, so a rewrite with no new records emits nothing.
    JsonSnapshot {
        #[serde(default)]
        fingerprint: Option<FileFingerprint>,
        /// Records at or before this time (Unix milliseconds) were already seen, for
        /// example when existing history was skipped on first discovery.
        #[serde(default)]
        seen_through_ms: Option<i64>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let nonce = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("wakaclock-source-{name}-{nonce}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn missing_file_has_no_fingerprint() {
        let dir = temp_dir("missing");
        assert_eq!(FileFingerprint::of(&dir.join("absent.json")).unwrap(), None);
        assert_eq!(DbFingerprint::of(&dir.join("absent.db")).unwrap(), None);
    }

    #[test]
    fn appending_to_the_wal_changes_the_database_fingerprint() {
        let dir = temp_dir("wal");
        let db = dir.join("store.db");
        std::fs::write(&db, b"main").unwrap();
        let before = DbFingerprint::of(&db).unwrap().unwrap();
        assert_eq!(before.wal, None);

        std::fs::write(dir.join("store.db-wal"), b"new frame").unwrap();
        let after = DbFingerprint::of(&db).unwrap().unwrap();
        assert_eq!(after.db, before.db);
        assert_ne!(after, before);
    }

    #[test]
    fn checkpoints_round_trip_through_json() {
        let checkpoint = SourceCheckpoint::Sqlite {
            last_rowid: 42,
            fingerprint: Some(DbFingerprint {
                db: FileFingerprint {
                    size: 10,
                    modified_nanos: Some(7),
                },
                wal: None,
            }),
        };
        let json = serde_json::to_string(&checkpoint).unwrap();
        assert!(json.contains("\"kind\":\"sqlite\""));
        assert_eq!(
            serde_json::from_str::<SourceCheckpoint>(&json).unwrap(),
            checkpoint
        );
    }
}

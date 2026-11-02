//! Sources an agent rewrites as one JSON document (for example a task's
//! `ui_messages.json` or a chat session file).
//!
//! A byte offset means nothing when the whole file is rewritten, so the file is
//! re-read only when its fingerprint changes and each record is compared with the
//! hash stored for it. A rewrite that adds nothing emits nothing, and a record
//! changed in place keeps its key, so its event ID stays the same.

use crate::ai::source::FileFingerprint;
use crate::ai::state::AiAttributionState;
use crate::error::AppError;
use sha2::{Digest, Sha256};
use std::io;
use std::path::Path;

#[derive(Debug, PartialEq, Eq)]
pub enum SnapshotRead {
    Missing,
    /// Same size and modification time as `previous`.
    Unchanged,
    /// Larger than the pass's read limit; skipped rather than read partially.
    TooLarge {
        size: u64,
    },
    Changed {
        fingerprint: FileFingerprint,
        bytes: Vec<u8>,
    },
}

/// Read `path` when it changed since `previous`, up to `max_bytes`.
pub fn read_if_changed(
    path: &Path,
    previous: Option<&FileFingerprint>,
    max_bytes: u64,
) -> io::Result<SnapshotRead> {
    let Some(fingerprint) = FileFingerprint::of(path)? else {
        return Ok(SnapshotRead::Missing);
    };
    if previous == Some(&fingerprint) {
        return Ok(SnapshotRead::Unchanged);
    }
    if fingerprint.size > max_bytes {
        return Ok(SnapshotRead::TooLarge {
            size: fingerprint.size,
        });
    }
    Ok(SnapshotRead::Changed {
        fingerprint,
        bytes: std::fs::read(path)?,
    })
}

/// Stable content hash of one record. `serde_json::Value` objects serialize with
/// sorted keys, so the hash does not depend on the writer's key order.
pub fn record_hash(record: &serde_json::Value) -> String {
    let bytes = serde_json::to_vec(record).unwrap_or_default();
    format!("{:x}", Sha256::digest(&bytes))
}

/// Keys of the records that are new or changed since the last pass over `source`.
pub fn changed_record_keys<'a>(
    state: &AiAttributionState,
    parser_id: &str,
    source: &str,
    records: impl IntoIterator<Item = (String, &'a serde_json::Value)>,
) -> Result<Vec<String>, AppError> {
    let mut changed = Vec::new();
    for (key, record) in records {
        if state.record_hash_is_new(parser_id, source, &key, &record_hash(record))? {
            changed.push(key);
        }
    }
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::path::PathBuf;

    fn temp_dir(name: &str) -> PathBuf {
        let nonce = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("wakaclock-snapshot-{name}-{nonce}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn keyed(records: &[serde_json::Value]) -> Vec<(String, &serde_json::Value)> {
        records
            .iter()
            .map(|record| (record["ts"].to_string(), record))
            .collect()
    }

    #[test]
    fn an_unchanged_file_is_not_reread_and_a_large_one_is_skipped() {
        let dir = temp_dir("read");
        let path = dir.join("ui_messages.json");
        assert_eq!(
            read_if_changed(&path, None, 1024).unwrap(),
            SnapshotRead::Missing
        );
        std::fs::write(&path, b"[1,2,3]").unwrap();
        let SnapshotRead::Changed { fingerprint, bytes } =
            read_if_changed(&path, None, 1024).unwrap()
        else {
            panic!("expected a read");
        };
        assert_eq!(bytes, b"[1,2,3]");
        assert_eq!(
            read_if_changed(&path, Some(&fingerprint), 1024).unwrap(),
            SnapshotRead::Unchanged
        );
        assert_eq!(
            read_if_changed(&path, None, 3).unwrap(),
            SnapshotRead::TooLarge { size: 7 }
        );
    }

    #[test]
    fn a_rewrite_emits_only_new_or_changed_records() {
        let dir = temp_dir("records");
        let state = AiAttributionState::open_at(&dir.join("state.sqlite3")).unwrap();
        let first = vec![
            json!({"ts": 1, "say": "tool"}),
            json!({"ts": 2, "say": "text"}),
        ];
        assert_eq!(
            changed_record_keys(&state, "cline", "/task/1", keyed(&first)).unwrap(),
            vec!["1".to_string(), "2".to_string()]
        );

        // The agent rewrites the whole file: same two records plus one new one, with
        // record 2 updated in place (for example token counts filled in later).
        let rewritten = vec![
            json!({"ts": 1, "say": "tool"}),
            json!({"ts": 2, "say": "text", "tokens": 5}),
            json!({"ts": 3, "say": "tool"}),
        ];
        assert_eq!(
            changed_record_keys(&state, "cline", "/task/1", keyed(&rewritten)).unwrap(),
            vec!["2".to_string(), "3".to_string()]
        );
        assert!(
            changed_record_keys(&state, "cline", "/task/1", keyed(&rewritten))
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn record_hash_ignores_key_order() {
        let left: serde_json::Value = serde_json::from_str(r#"{"a":1,"b":2}"#).unwrap();
        let right: serde_json::Value = serde_json::from_str(r#"{"b":2,"a":1}"#).unwrap();
        assert_eq!(record_hash(&left), record_hash(&right));
    }
}

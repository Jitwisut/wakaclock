//! Persistent, bounded shadow-corpus storage for the production observer.
//!
//! Shadow records contain only attribution grades, opaque lineage/fingerprint
//! values, paths and timestamps.  This module keeps the local log bounded and
//! provides the report command with one canonical read path.  It intentionally
//! uses JSONL rather than a second database schema: a partial final line can be
//! ignored after a crash and rotation is a simple atomic rewrite.

use std::fs;
use std::path::{Path, PathBuf};

use crate::ai::shadow::{ShadowLog, ShadowRecord};
use crate::ai::shadow_report::{compare_to_oracle, ShadowComparisonReport};
use crate::broker::broker_runtime_dir;
use crate::error::AppError;

pub const SHADOW_LOG_FILENAME: &str = "ai-shadow-log.jsonl";
pub const DEFAULT_MAX_RECORDS: usize = 10_000;

pub fn default_path() -> PathBuf {
    broker_runtime_dir().join(SHADOW_LOG_FILENAME)
}

/// Load a log, dropping malformed/truncated lines.  A malformed local record is
/// not allowed to stop heartbeats or make the report command unusable.
pub fn load(path: &Path) -> Result<ShadowLog, AppError> {
    let Ok(content) = fs::read_to_string(path) else {
        return Ok(ShadowLog::default());
    };
    let mut log = ShadowLog::default();
    for line in content.lines() {
        if let Ok(record) = serde_json::from_str::<ShadowRecord>(line) {
            log.record(record);
        }
    }
    Ok(log)
}

/// Append one record and retain only the newest `max_records`.  The rewrite is
/// atomic, private and metadata-only; it avoids unbounded growth while preserving
/// the most recent evidence for `shadow-report`.
pub fn append(path: &Path, record: &ShadowRecord, max_records: usize) -> Result<(), AppError> {
    let mut log = load(path)?;
    log.record(record.clone());
    let records = log.records();
    let start = records.len().saturating_sub(max_records.max(1));
    let mut encoded = String::new();
    for item in &records[start..] {
        encoded.push_str(&serde_json::to_string(item)?);
        encoded.push('\n');
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let staging = path.with_extension(format!("staging-{}", std::process::id()));
    fs::write(&staging, encoded)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&staging, fs::Permissions::from_mode(0o600))?;
    }
    fs::rename(staging, path)?;
    Ok(())
}

pub fn load_default() -> Result<ShadowLog, AppError> {
    load(&default_path())
}

pub fn append_default(record: &ShadowRecord) -> Result<(), AppError> {
    append(&default_path(), record, DEFAULT_MAX_RECORDS)
}

pub fn report(path: &Path) -> Result<ShadowComparisonReport, AppError> {
    Ok(compare_to_oracle(&load(path)?))
}

pub fn report_default() -> Result<ShadowComparisonReport, AppError> {
    report(&default_path())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::correlation_engine::{AiVerdict, Verdict, VerdictReason};
    use chrono::Utc;

    fn record(index: usize) -> ShadowRecord {
        let verdict = Verdict {
            verdict: AiVerdict::AiInferred,
            reason: VerdictReason::InferredFromAgentActivity,
            supporting_lineage: vec![format!("lineage-{index}")],
        };
        ShadowRecord::new(Path::new("/workspace/src/main.rs"), &verdict, Utc::now())
    }

    #[test]
    fn append_rotates_to_a_bounded_metadata_only_log() {
        let dir = std::env::temp_dir().join(format!("wakaclock-shadow-{}", uuid::Uuid::new_v4()));
        let path = dir.join("shadow.jsonl");
        for index in 0..5 {
            append(&path, &record(index), 3).unwrap();
        }
        let loaded = load(&path).unwrap();
        assert_eq!(loaded.len(), 3);
        let text = fs::read_to_string(&path).unwrap();
        assert!(!text.contains("prompt"));
        assert!(!text.contains("content"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn truncated_or_malformed_tail_is_ignored() {
        let dir = std::env::temp_dir().join(format!("wakaclock-shadow-{}", uuid::Uuid::new_v4()));
        let path = dir.join("shadow.jsonl");
        fs::create_dir_all(&dir).unwrap();
        fs::write(&path, "not-json\n{\"truncated\":").unwrap();
        assert!(load(&path).unwrap().is_empty());
        let _ = fs::remove_dir_all(dir);
    }
}

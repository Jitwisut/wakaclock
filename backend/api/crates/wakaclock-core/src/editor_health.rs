//! Metadata-only extension observations, scoped exactly like the delivery queue.
use crate::{error::AppError, queue::QueueScope};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, io::Write, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct EditorJournalHealth {
    pub status: String,
    pub pending: Option<u32>,
    pub dead_letter: u32,
    pub last_observed_at: DateTime<Utc>,
}
impl EditorJournalHealth {
    pub fn validate(&self) -> bool {
        [
            "ready",
            "write_failure",
            "corrupt",
            "locked",
            "stale",
            "unavailable",
            "paused_by_user",
            "stopped",
            "handoff_pending",
            "incompatible",
        ]
        .contains(&self.status.as_str())
    }
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JournalObservation {
    pub schema_version: u8,
    pub scope_id: String,
    pub collector_id: String,
    pub health: EditorJournalHealth,
}
pub fn scope_id(scope: &QueueScope) -> String {
    format!(
        "{:x}",
        Sha256::digest(format!("{}\0{}", scope.destination, scope.owner).as_bytes())
    )
}
pub fn save(
    directory: &Path,
    scope: &QueueScope,
    observation: &JournalObservation,
) -> Result<(), AppError> {
    if observation.schema_version != 1
        || observation.scope_id != scope_id(scope)
        || uuid::Uuid::parse_str(&observation.collector_id).is_err()
        || !observation.health.validate()
        || (Utc::now() - observation.health.last_observed_at)
            .num_seconds()
            .abs()
            > 60
    {
        return Err(AppError::Validation("journal_health_invalid".into()));
    }
    let dir = directory
        .join("editor-journal-health")
        .join(scope_id(scope));
    fs::create_dir_all(&dir)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o700))?;
    }
    let path = dir.join(format!("{}.json", observation.collector_id));
    let staged = path.with_extension("tmp");
    let mut options = fs::OpenOptions::new();
    options.create(true).truncate(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&staged)?;
    file.write_all(&serde_json::to_vec(observation)?)?;
    file.sync_all()?;
    fs::rename(staged, path)?;
    #[cfg(unix)]
    fs::File::open(&dir)?.sync_all()?;
    Ok(())
}
pub fn read(directory: &Path, scope: &QueueScope, now: DateTime<Utc>) -> EditorJournalHealth {
    let mut result = EditorJournalHealth {
        status: "unavailable".into(),
        pending: None,
        dead_letter: 0,
        last_observed_at: now,
    };
    let Ok(entries) = fs::read_dir(
        directory
            .join("editor-journal-health")
            .join(scope_id(scope)),
    ) else {
        return result;
    };
    let mut count = 0;
    let mut pending = 0u32;
    let mut status = "ready";
    let mut known = true;
    let priority = |status: &str| match status {
        "corrupt" | "write_failure" | "locked" => 5,
        "incompatible" => 4,
        "unavailable" => 3,
        "stale" => 2,
        "paused_by_user" | "handoff_pending" | "stopped" => 1,
        _ => 0,
    };
    let mut inspected = 0;
    for entry in entries {
        let Ok(entry) = entry else {
            known = false;
            status = "unavailable";
            continue;
        };
        if entry.path().extension().is_none_or(|s| s != "json") {
            continue;
        }
        inspected += 1;
        if inspected > 512 {
            known = false;
            if priority(status) < 3 {
                status = "unavailable";
            }
            break;
        }
        let observation = fs::read(entry.path())
            .ok()
            .and_then(|b| serde_json::from_slice::<JournalObservation>(&b).ok());
        let Some(observation) = observation else {
            known = false;
            if priority(status) < 3 {
                status = "unavailable";
            }
            continue;
        };
        if observation.schema_version != 1
            || observation.scope_id != scope_id(scope)
            || uuid::Uuid::parse_str(&observation.collector_id).is_err()
            || !observation.health.validate()
        {
            known = false;
            if priority(status) < 3 {
                status = "unavailable";
            }
            continue;
        }
        let health = observation.health;
        if health.status == "stopped" && health.pending == Some(0) {
            continue;
        }
        count += 1;
        pending = pending.saturating_add(health.pending.unwrap_or(0));
        result.dead_letter = result.dead_letter.saturating_add(health.dead_letter);
        result.last_observed_at = result.last_observed_at.min(health.last_observed_at);
        let age = (now - health.last_observed_at).num_seconds();
        let effective = if !(-60..=300).contains(&age) && priority(&health.status) < 2 {
            "stale"
        } else {
            health.status.as_str()
        };
        if priority(effective) > priority(status) {
            status = match effective {
                "corrupt" => "corrupt",
                "write_failure" => "write_failure",
                "locked" => "locked",
                "incompatible" => "incompatible",
                "stale" => "stale",
                "paused_by_user" => "paused_by_user",
                "handoff_pending" => "handoff_pending",
                "stopped" => "stopped",
                _ => "unavailable",
            };
        }
        if health.pending.is_none() {
            known = false;
            if priority(status) < 3 {
                status = "unavailable";
            }
        }
    }
    result.status = if count == 0 { "unavailable" } else { status }.into();
    if count > 0 && known {
        result.pending = Some(pending);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn upstream_failure_is_not_hidden_by_an_empty_queue_or_a_stale_window() {
        let directory = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let scope = QueueScope {
            destination: "https://server.test".into(),
            owner: "fixture".into(),
        };
        let now = Utc::now();
        let observation = JournalObservation {
            schema_version: 1,
            scope_id: scope_id(&scope),
            collector_id: uuid::Uuid::new_v4().to_string(),
            health: EditorJournalHealth {
                status: "write_failure".into(),
                pending: Some(3),
                dead_letter: 1,
                last_observed_at: now,
            },
        };
        save(&directory, &scope, &observation).unwrap();
        let health = read(&directory, &scope, now + chrono::Duration::minutes(6));
        assert_eq!(health.status, "write_failure");
        assert_eq!(health.pending, Some(3));
        assert_eq!(health.dead_letter, 1);
        let other = QueueScope {
            owner: "other".into(),
            ..scope.clone()
        };
        assert_eq!(read(&directory, &other, now).pending, None);
        fs::write(
            directory
                .join("editor-journal-health")
                .join(scope_id(&scope))
                .join("incomplete.tmp"),
            "partial",
        )
        .unwrap();
        assert_eq!(read(&directory, &scope, now).status, "write_failure");
        fs::remove_dir_all(directory).unwrap();
    }
}

//! User intent is independent of process liveness. Corrupt/unreadable state fails
//! closed; neither a login nor a supervisor restart silently resumes capture.
use crate::error::AppError;
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PauseInterval {
    pub component: String,
    pub started_at: i64,
    pub ended_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RuntimeState {
    pub schema_version: u8,
    pub generation: u64,
    pub desired: BTreeMap<String, bool>,
    pub intervals: Vec<PauseInterval>,
    pub updated_at: i64,
}
impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            schema_version: 1,
            generation: 0,
            desired: BTreeMap::new(),
            intervals: Vec::new(),
            updated_at: 0,
        }
    }
}
pub fn directory() -> Result<PathBuf, AppError> {
    dirs::home_dir()
        .map(|h| h.join(".wakaclock"))
        .ok_or_else(|| AppError::Validation("runtime_home_unavailable".into()))
}
pub fn read_at(directory: &Path) -> Result<RuntimeState, AppError> {
    match fs::read(directory.join("runtime-desired.json")) {
        Ok(bytes) => {
            let state: RuntimeState = serde_json::from_slice(&bytes)?;
            if state.schema_version != 1 {
                return Err(AppError::Validation("runtime_schema_unsupported".into()));
            }
            Ok(state)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(RuntimeState::default()),
        Err(e) => Err(e.into()),
    }
}
pub fn read() -> Result<RuntimeState, AppError> {
    read_at(&directory()?)
}
pub fn paused(component: &str) -> bool {
    read()
        .map(|s| !s.desired.get(component).copied().unwrap_or(true))
        .unwrap_or(true)
}
pub fn capture_allowed_at(at: i64) -> bool {
    read()
        .map(|s| {
            !s.intervals.iter().any(|i| {
                i.component == "capture"
                    && at >= i.started_at
                    && i.ended_at.is_none_or(|end| at < end)
            })
        })
        .unwrap_or(false)
}
pub fn set_at(
    directory: &Path,
    component: &str,
    running: bool,
    now: i64,
) -> Result<RuntimeState, AppError> {
    if !["capture", "delivery", "backend-local", "all"].contains(&component) {
        return Err(AppError::Validation("runtime_component_invalid".into()));
    }
    fs::create_dir_all(directory)?;
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(directory.join("runtime-desired.lock"))?;
    lock.lock_exclusive()?;
    let mut state = read_at(directory)?;
    let components: &[&str] = if component == "all" {
        &["capture", "delivery", "backend-local"]
    } else {
        &[component]
    };
    for component in components {
        let previous = state.desired.get(*component).copied().unwrap_or(true);
        if previous == running {
            continue;
        }
        state.desired.insert(component.to_string(), running);
        if running {
            if let Some(interval) = state
                .intervals
                .iter_mut()
                .rev()
                .find(|i| i.component == *component && i.ended_at.is_none())
            {
                interval.ended_at = Some(now.max(interval.started_at));
            }
        } else {
            state.intervals.push(PauseInterval {
                component: component.to_string(),
                started_at: now,
                ended_at: None,
            });
        }
    }
    state.generation += 1;
    state.updated_at = now;
    let temporary_path = directory.join("runtime-desired.tmp");
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut output = options.open(&temporary_path)?;
    output.write_all(&serde_json::to_vec(&state)?)?;
    output.sync_all()?;
    fs::rename(temporary_path, directory.join("runtime-desired.json"))?;
    #[cfg(unix)]
    fs::File::open(directory)?.sync_all()?;
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pause_survives_restart_and_resume_closes_interval() {
        let dir = std::env::temp_dir().join(format!("runtime-intent-{}", uuid::Uuid::new_v4()));
        set_at(&dir, "capture", false, 100).unwrap();
        let state = read_at(&dir).unwrap();
        assert!(!state.desired["capture"]);
        set_at(&dir, "delivery", false, 200).unwrap();
        let state = set_at(&dir, "capture", true, 300).unwrap();
        assert!(!state.desired["delivery"]);
        assert_eq!(state.intervals[0].ended_at, Some(300));
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn corrupt_intent_is_not_silently_replaced() {
        let dir = std::env::temp_dir().join(format!("runtime-corrupt-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&dir).unwrap();
        fs::write(dir.join("runtime-desired.json"), b"invalid").unwrap();
        assert!(set_at(&dir, "all", true, 100).is_err());
        assert_eq!(
            fs::read(dir.join("runtime-desired.json")).unwrap(),
            b"invalid"
        );
        fs::remove_dir_all(dir).unwrap();
    }
}

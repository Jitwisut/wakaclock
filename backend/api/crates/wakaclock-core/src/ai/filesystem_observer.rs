//! Phase B of the Universal Detector Core (planai.md Phase 3 — "Universal Workspace
//! Observer"). Watches a workspace root for file creates/writes/deletes and reports
//! them as raw evidence — never as an attribution decision.
//!
//! planai.md's own rule for this phase, stated directly: "Filesystem change อย่างเดียว
//! ห้ามสรุปว่าเป็น AI" (a filesystem change alone must never be concluded as AI).
//! `prettier --write`, `eslint --fix`, a compiler, `git checkout`, `git merge`, and a
//! human all produce the exact same signal this module sees — one file, changed, at
//! one instant. Turning that into `AI_INFERRED` (or ruling it out as `HUMAN`) is the
//! Evidence Correlation Engine's job (planai.md Phase 8, not built), which combines
//! this module's output with the Process Observer's (`process_observer.rs`, Phase A)
//! and any native hook evidence. This module produces `FILE_CHANGED`, deliberately
//! never `AI_CHANGED_FILE`.
//!
//! No file content is ever read here — only paths, event kinds and timestamps cross
//! this module's boundary, matching every other producer's metadata-only contract.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

/// Directories a workspace watcher must never descend into — build output, VCS
/// internals, and dependency trees produce enormous unrelated write volume and are
/// never where a developer or an agent is "coding". Kept as an independent copy of
/// `wakaclock-cli::tool_snapshot::EXCLUDED_DIRS` (`wakaclock-core` cannot depend on
/// `wakaclock-cli`, which depends on it) — if one list changes, check the other.
const EXCLUDED_DIR_NAMES: &[&str] = &[
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "target",
    ".next",
    "dist",
    "build",
    "coverage",
    "vendor",
    ".cache",
    ".turbo",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileChangeKind {
    Created,
    Modified,
    Removed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileChangedEvent {
    pub path: PathBuf,
    pub kind: FileChangeKind,
    /// This process's own observation time, not a filesystem-reported timestamp —
    /// matches how every other evidence producer in this module stamps `occurred_at`.
    pub observed_at: DateTime<Utc>,
}

/// True when any path component matches an excluded directory name exactly (not a
/// substring match — a real project directory named e.g. `distillery` must not be
/// excluded just because it contains `dist`).
pub fn is_excluded_path(path: &Path) -> bool {
    path.components().any(|component| {
        component
            .as_os_str()
            .to_str()
            .is_some_and(|name| EXCLUDED_DIR_NAMES.contains(&name))
    })
}

/// Collapses every notify sub-kind (`CreateKind::File`, `CreateKind::Folder`,
/// `ModifyKind::Data(_)`, `ModifyKind::Name(_)`, platform-specific rename halves,
/// ...) into the three kinds this module reports. Reliably splitting a rename into
/// its old/new path pair is platform-dependent behavior notify's own docs describe as
/// "may or may not be available for any particular backend" — rather than guess at
/// that per-platform detail, a rename surfaces as `Removed` for the old path and
/// `Created` for the new one, which is still correct *evidence* (something changed at
/// each path) even though it loses the "these two were the same rename" fact.
fn translate_event_kind(kind: &EventKind) -> Option<FileChangeKind> {
    match kind {
        EventKind::Create(_) => Some(FileChangeKind::Created),
        EventKind::Modify(_) => Some(FileChangeKind::Modified),
        EventKind::Remove(_) => Some(FileChangeKind::Removed),
        // Access(_)/Any/Other are not evidence a file's content changed.
        _ => None,
    }
}

/// A live filesystem watcher over one workspace root. Holds the OS-level watch handle
/// for its lifetime — dropping this stops watching and the OS resource is released.
pub struct WorkspaceWatcher {
    // Never read directly; must simply outlive `receiver` so the OS watch stays
    // registered. The underlying platform backend (FSEvents/inotify/etc.) is chosen
    // automatically by `notify::recommended_watcher`.
    _watcher: RecommendedWatcher,
    receiver: Receiver<notify::Result<Event>>,
}

impl WorkspaceWatcher {
    /// Starts watching `root` recursively. Returns as soon as the OS watch is
    /// registered; events begin arriving asynchronously after that.
    pub fn watch(root: &Path) -> notify::Result<Self> {
        let (sender, receiver) = mpsc::channel();
        let mut watcher = notify::recommended_watcher(sender)?;
        watcher.watch(root, RecursiveMode::Recursive)?;
        Ok(Self {
            _watcher: watcher,
            receiver,
        })
    }

    /// Blocks for up to `timeout` waiting for the next in-scope change. Returns
    /// `None` on timeout, a notify-internal error, or if every event received in
    /// that window was excluded-directory noise or a non-content-change kind — the
    /// caller cannot distinguish those cases from this return value alone, which is
    /// deliberate: none of them are actionable differently at this layer.
    pub fn next_event(&self, timeout: Duration) -> Option<FileChangedEvent> {
        let deadline = Instant::now() + timeout;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return None;
            }
            let received = match self.receiver.recv_timeout(remaining) {
                Ok(received) => received,
                Err(RecvTimeoutError::Timeout) => return None,
                Err(RecvTimeoutError::Disconnected) => return None,
            };
            let Ok(event) = received else {
                continue;
            };
            let Some(kind) = translate_event_kind(&event.kind) else {
                continue;
            };
            let Some(path) = event.paths.into_iter().next() else {
                continue;
            };
            if is_excluded_path(&path) {
                continue;
            }
            return Some(FileChangedEvent {
                path,
                kind,
                observed_at: Utc::now(),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn excludes_git_and_dependency_directories() {
        assert!(is_excluded_path(Path::new("/repo/.git/HEAD")));
        assert!(is_excluded_path(Path::new(
            "/repo/node_modules/pkg/index.js"
        )));
        assert!(is_excluded_path(Path::new("/repo/target/debug/app")));
        assert!(!is_excluded_path(Path::new("/repo/src/main.rs")));
    }

    #[test]
    fn does_not_exclude_a_project_directory_that_merely_contains_an_excluded_name() {
        // "dist" is excluded; "distillery" (a real, plausible project name) must not
        // be — component match must be exact, not a substring test.
        assert!(!is_excluded_path(Path::new("/repo/distillery/src/lib.rs")));
    }

    #[test]
    fn translate_event_kind_maps_the_three_reported_kinds() {
        assert_eq!(
            translate_event_kind(&EventKind::Create(notify::event::CreateKind::File)),
            Some(FileChangeKind::Created)
        );
        assert_eq!(
            translate_event_kind(&EventKind::Modify(notify::event::ModifyKind::Data(
                notify::event::DataChange::Content
            ))),
            Some(FileChangeKind::Modified)
        );
        assert_eq!(
            translate_event_kind(&EventKind::Remove(notify::event::RemoveKind::File)),
            Some(FileChangeKind::Removed)
        );
        assert_eq!(translate_event_kind(&EventKind::Any), None);
    }

    #[test]
    fn watches_a_real_temp_directory_and_observes_a_real_file_write() {
        // The one test in this module that proves the OS-level watch actually works
        // on this machine, not just that the translation logic is correct in
        // isolation — matches the standard this session has held every other
        // producer to (Codex/Cursor/process observer all had bugs a pure unit test
        // could not have caught).
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-fs-observer-test-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        fs::create_dir_all(&dir).unwrap();

        let watcher = WorkspaceWatcher::watch(&dir).expect("watch should start");

        let target = dir.join("app.py");
        fs::write(&target, "value = 1\n").unwrap();

        let event = watcher.next_event(Duration::from_secs(10));
        let _ = fs::remove_dir_all(&dir);

        let event = event.expect("expected a real filesystem event within the timeout");
        assert!(
            matches!(
                event.kind,
                FileChangeKind::Created | FileChangeKind::Modified
            ),
            "expected Created or Modified for a new file, got {:?}",
            event.kind
        );
        assert_eq!(event.path.file_name(), target.file_name());
    }
}

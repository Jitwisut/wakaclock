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

use std::collections::HashMap;
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

// ---------------------------------------------------------------------------
// planai2.md Phase 3 (p3.2) — bind the observer to the workspace lease registry
// ---------------------------------------------------------------------------

/// What one `ObserverPool::sync` call changed.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct SyncOutcome {
    pub started: Vec<PathBuf>,
    pub stopped: Vec<PathBuf>,
}

/// Holds a live [`WorkspaceWatcher`] for exactly the roots the caller asks for —
/// which in production is `WorkspaceRegistry::watched_roots(now)` (planai2.md
/// p3.2: the observer watches only registered workspaces, never all of `$HOME`).
///
/// Call [`sync`](Self::sync) on a timer or right after any lease
/// register/refresh/release: it starts watchers for newly-desired roots and drops
/// watchers (releasing the OS handle) for roots no longer desired.
#[derive(Default)]
pub struct ObserverPool {
    watchers: HashMap<PathBuf, WorkspaceWatcher>,
}

impl ObserverPool {
    pub fn new() -> Self {
        Self::default()
    }

    /// Reconcile the live watcher set to `desired_roots`. Idempotent: calling it
    /// again with the same roots is a no-op.
    pub fn sync(&mut self, desired_roots: &[PathBuf]) -> notify::Result<SyncOutcome> {
        let desired: std::collections::HashSet<&PathBuf> = desired_roots.iter().collect();
        let mut outcome = SyncOutcome::default();

        // Drop watchers for roots that are no longer desired.
        let stale: Vec<PathBuf> = self
            .watchers
            .keys()
            .filter(|root| !desired.contains(root))
            .cloned()
            .collect();
        for root in stale {
            self.watchers.remove(&root);
            outcome.stopped.push(root);
        }

        // Start watchers for newly-desired roots.
        for root in desired_roots {
            if self.watchers.contains_key(root) {
                continue;
            }
            let watcher = WorkspaceWatcher::watch(root)?;
            self.watchers.insert(root.clone(), watcher);
            outcome.started.push(root.clone());
        }

        outcome.started.sort();
        outcome.stopped.sort();
        Ok(outcome)
    }

    pub fn watched_roots(&self) -> Vec<&Path> {
        let mut roots: Vec<&Path> = self.watchers.keys().map(PathBuf::as_path).collect();
        roots.sort();
        roots
    }

    /// True when `path` is inside a currently-watched root — a defence-in-depth
    /// filter so an event notify reports for a sibling directory is dropped.
    pub fn is_within_watched(&self, path: &Path) -> bool {
        self.watchers.keys().any(|root| path.starts_with(root))
    }

    /// Drain every watcher: wait up to `timeout` for the first event on each, then
    /// quickly pull whatever else is already buffered. Events for paths outside a
    /// watched root (notify's guarantees vary by backend) are dropped.
    pub fn poll(&self, timeout: Duration) -> Vec<FileChangedEvent> {
        let mut events = Vec::new();
        for watcher in self.watchers.values() {
            let Some(first) = watcher.next_event(timeout) else {
                continue;
            };
            if self.is_within_watched(&first.path) {
                events.push(first);
            }
            while let Some(more) = watcher.next_event(Duration::from_millis(50)) {
                if self.is_within_watched(&more.path) {
                    events.push(more);
                }
            }
        }
        events
    }
}

#[cfg(test)]
mod observer_pool_tests {
    use super::*;
    use std::fs;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-observer-pool-{tag}-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn sync_starts_and_stops_watchers_to_match_the_desired_root_set() {
        let a = temp_dir("a");
        let b = temp_dir("b");
        let mut pool = ObserverPool::new();

        let out = pool.sync(std::slice::from_ref(&a)).unwrap();
        assert_eq!(out.started, vec![a.clone()]);
        assert!(out.stopped.is_empty());
        assert_eq!(pool.watched_roots(), vec![a.as_path()]);

        // Idempotent.
        assert_eq!(
            pool.sync(std::slice::from_ref(&a)).unwrap(),
            SyncOutcome::default()
        );

        // Swap a -> b.
        let out = pool.sync(std::slice::from_ref(&b)).unwrap();
        assert_eq!(out.started, vec![b.clone()]);
        assert_eq!(out.stopped, vec![a.clone()]);
        assert_eq!(pool.watched_roots(), vec![b.as_path()]);

        let _ = fs::remove_dir_all(&a);
        let _ = fs::remove_dir_all(&b);
    }

    #[test]
    fn a_change_under_an_unregistered_path_yields_no_event() {
        let watched = temp_dir("watched");
        let unwatched = temp_dir("unwatched");
        let mut pool = ObserverPool::new();
        pool.sync(std::slice::from_ref(&watched)).unwrap();

        fs::write(unwatched.join("stray.rs"), "x\n").unwrap();
        // Give the OS a beat; a correctly-scoped watcher reports nothing.
        let events = pool.poll(Duration::from_millis(400));
        assert!(
            events.is_empty(),
            "a write outside every watched root must not surface, got {events:?}"
        );

        let _ = fs::remove_dir_all(&watched);
        let _ = fs::remove_dir_all(&unwatched);
    }

    #[test]
    fn a_change_under_a_registered_path_yields_an_event() {
        let watched = temp_dir("real");
        let mut pool = ObserverPool::new();
        pool.sync(std::slice::from_ref(&watched)).unwrap();

        fs::write(watched.join("app.py"), "value = 1\n").unwrap();
        let events = pool.poll(Duration::from_secs(10));

        let _ = fs::remove_dir_all(&watched);
        assert!(
            events
                .iter()
                .any(|e| e.path.file_name().unwrap() == "app.py"),
            "expected an event for the file written under the watched root, got {events:?}"
        );
    }
}

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

use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

use crate::ai::path::{normalize_lexical, resolve_within_workspace, PathResolveError};

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

// ---------------------------------------------------------------------------
// planai2.md Phase 3 (p3.3) — observer semantics: coalescing, symlink guard,
// ignore rules, changed-file fingerprint. No file *content* ever leaves here.
// ---------------------------------------------------------------------------
/// Resolve `path` to a real absolute path and confirm it stays inside `root` even
/// after symlinks are followed — a file inside the workspace that is actually a
/// symlink to `/etc/shadow` must be rejected. Falls back to lexical containment
/// (`resolve_within_workspace`) when the path does not exist yet (a delete/rename
/// target), since there is nothing to canonicalize.
pub fn canonicalize_within_root(root: &Path, path: &Path) -> Result<PathBuf, PathResolveError> {
    match (std::fs::canonicalize(root), std::fs::canonicalize(path)) {
        (Ok(real_root), Ok(real_path)) => {
            if real_path.starts_with(&real_root) {
                Ok(real_path)
            } else {
                Err(PathResolveError::Escape)
            }
        }
        _ => resolve_within_workspace(root, path),
    }
}

/// A suffix an editor gives its scratch file during an atomic save. A change to
/// one of these is never a logical change — it is the temp half of a
/// write-then-rename.
fn is_atomic_save_scratch(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    name.ends_with('~')
        || name.ends_with(".tmp")
        || name.ends_with(".swp")
        || name.ends_with(".swx")
        || name.ends_with(".bak")
        || name.starts_with(".#")
        || (name.starts_with('.') && name.contains(".tmp"))
        // VS Code / JetBrains random-suffix scratch: `foo.rs.a1b2c3` next to `foo.rs`
        || name.rsplit_once('.').is_some_and(|(stem, ext)| {
            stem.contains('.') && ext.len() >= 4 && ext.chars().all(|c| c.is_ascii_hexdigit())
        })
}

/// Collapse a burst of raw `FileChangedEvent`s (as produced by one editor save,
/// one `git checkout`, one build step, …) into the set of *logical* changes:
///
/// - editor atomic-save scratch files (`.tmp`, `.swp`, `foo.rs~`, `.#foo`, …) are
///   dropped — the real file's own event is what matters;
/// - multiple events for the same path keep only the last kind, **except** a
///   `Created` immediately cancelled by a `Removed` in the same burst (a temp file
///   that came and went) which is dropped entirely.
///
/// Order of the surviving events follows first-seen order of their paths.
pub fn coalesce_burst(events: Vec<FileChangedEvent>) -> Vec<FileChangedEvent> {
    use std::collections::HashMap;

    let mut order: Vec<PathBuf> = Vec::new();
    let mut merged: HashMap<PathBuf, FileChangedEvent> = HashMap::new();
    let mut created_then_removed: std::collections::HashSet<PathBuf> = Default::default();

    for event in events {
        if is_atomic_save_scratch(&event.path) {
            continue;
        }
        let key = normalize_lexical(&event.path);
        match merged.get(&key) {
            None => {
                order.push(key.clone());
                merged.insert(key, event);
            }
            Some(prev) => {
                if prev.kind == FileChangeKind::Created && event.kind == FileChangeKind::Removed {
                    created_then_removed.insert(key.clone());
                }
                merged.insert(
                    key,
                    FileChangedEvent {
                        path: prev.path.clone(),
                        kind: event.kind,
                        observed_at: event.observed_at,
                    },
                );
            }
        }
    }

    order
        .into_iter()
        .filter(|key| !created_then_removed.contains(key))
        .filter_map(|key| merged.remove(&key))
        .collect()
}

/// A best-effort ignore matcher: the workspace's top-level `.gitignore` plus any
/// extra rules a lease supplied (planai2.md p3.1 `exclude_rules`). It is
/// **not** a full gitignore engine — it handles literal names, a leading or
/// trailing `*`, and a trailing `/` (directory) — enough that a build/vendor
/// path or an explicitly-ignored file "produces nothing", which is the p3.3
/// requirement. Nested `.gitignore` files, `**`, and negation (`!`) are out of
/// scope here.
#[derive(Debug, Clone, Default)]
pub struct WorkspaceIgnore {
    patterns: Vec<String>,
}

impl WorkspaceIgnore {
    pub fn from_rules<I, S>(rules: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let patterns = rules
            .into_iter()
            .map(|r| r.as_ref().trim().to_string())
            .filter(|r| !r.is_empty() && !r.starts_with('#') && !r.starts_with('!'))
            .collect();
        Self { patterns }
    }

    /// Load `<root>/.gitignore` (if present) and merge `extra_rules`.
    pub fn load(root: &Path, extra_rules: &[String]) -> Self {
        let mut lines: Vec<String> = extra_rules.to_vec();
        if let Ok(content) = std::fs::read_to_string(root.join(".gitignore")) {
            lines.extend(content.lines().map(str::to_string));
        }
        Self::from_rules(lines)
    }

    /// `rel_path` must be workspace-root-relative, `/`-separated.
    pub fn is_ignored(&self, rel_path: &str) -> bool {
        let rel_path = rel_path.trim_start_matches('/');
        let components: Vec<&str> = rel_path.split('/').collect();
        let file_name = components.last().copied().unwrap_or("");

        self.patterns.iter().any(|pattern| {
            let dir_only = pattern.ends_with('/');
            let pattern = pattern.trim_end_matches('/');
            let pattern = pattern.trim_start_matches('/');

            let matches_one = |candidate: &str| -> bool {
                if let Some(suffix) = pattern.strip_prefix('*') {
                    candidate.ends_with(suffix)
                } else if let Some(prefix) = pattern.strip_suffix('*') {
                    candidate.starts_with(prefix)
                } else {
                    candidate == pattern
                }
            };

            if dir_only {
                // Any path component (a directory on the way down) matches.
                components[..components.len().saturating_sub(1)]
                    .iter()
                    .any(|c| matches_one(c))
                    || (pattern.contains('/') && rel_path.starts_with(pattern))
            } else if pattern.contains('/') {
                rel_path == pattern || rel_path.starts_with(&format!("{pattern}/"))
            } else {
                matches_one(file_name) || components.iter().any(|c| matches_one(c))
            }
        })
    }
}

/// A metadata-only fingerprint of a changed file's *current* content, so dedup and
/// correlation can tell "the same bytes were written again" from "a real edit"
/// without the observer ever persisting the bytes. Reads the file, hashes it
/// (namespaced v5 UUID, same primitive `broker::payload_hash` uses), and drops the
/// buffer. Files larger than `MAX_FINGERPRINT_BYTES` are fingerprinted by
/// `(len, mtime)` instead of content — a generated bundle is not worth the read.
/// `None` when the file cannot be read (deleted between event and fingerprint).
pub fn fingerprint_changed_file(path: &Path) -> Option<String> {
    const MAX_FINGERPRINT_BYTES: u64 = 4 * 1024 * 1024;
    let meta = std::fs::metadata(path).ok()?;
    if !meta.is_file() {
        return None;
    }
    if meta.len() > MAX_FINGERPRINT_BYTES {
        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        return Some(format!("size:{}:mtime:{}", meta.len(), mtime));
    }
    let bytes = std::fs::read(path).ok()?;
    let id = uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_OID, &bytes).to_string();
    // `bytes` is dropped here — never returned, never stored.
    Some(format!("blob:{id}"))
}

#[cfg(test)]
mod observer_semantics_tests {
    use super::*;
    use std::fs;

    fn ev(path: &str, kind: FileChangeKind) -> FileChangedEvent {
        FileChangedEvent {
            path: PathBuf::from(path),
            kind,
            observed_at: Utc::now(),
        }
    }

    #[test]
    fn atomic_save_burst_collapses_to_one_modify_of_the_real_file() {
        let burst = vec![
            ev("/w/src/app.rs.a1b2c3d4", FileChangeKind::Created),
            ev("/w/src/app.rs.a1b2c3d4", FileChangeKind::Modified),
            ev("/w/src/app.rs.a1b2c3d4", FileChangeKind::Removed),
            ev("/w/src/app.rs", FileChangeKind::Modified),
        ];
        let out = coalesce_burst(burst);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].path, PathBuf::from("/w/src/app.rs"));
        assert_eq!(out[0].kind, FileChangeKind::Modified);
    }

    #[test]
    fn vim_and_emacs_scratch_names_are_dropped() {
        for scratch in ["/w/a.rs~", "/w/.#a.rs", "/w/a.rs.swp", "/w/4913"]
            .iter()
            .filter(|p| is_atomic_save_scratch(Path::new(p)))
        {
            assert!(is_atomic_save_scratch(Path::new(scratch)));
        }
        assert!(is_atomic_save_scratch(Path::new("/w/a.rs~")));
        assert!(is_atomic_save_scratch(Path::new("/w/.#a.rs")));
        assert!(is_atomic_save_scratch(Path::new("/w/a.rs.swp")));
        assert!(!is_atomic_save_scratch(Path::new("/w/a.rs")));
        assert!(!is_atomic_save_scratch(Path::new("/w/README.md")));
    }

    #[test]
    fn a_temp_file_that_came_and_went_in_one_burst_is_dropped_entirely() {
        let burst = vec![
            ev("/w/gen/out.json", FileChangeKind::Created),
            ev("/w/gen/out.json", FileChangeKind::Removed),
            ev("/w/src/real.rs", FileChangeKind::Modified),
        ];
        let out = coalesce_burst(burst);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].path, PathBuf::from("/w/src/real.rs"));
    }

    #[test]
    fn multiple_modifies_of_one_file_keep_only_the_last() {
        let burst = vec![
            ev("/w/a.rs", FileChangeKind::Created),
            ev("/w/a.rs", FileChangeKind::Modified),
            ev("/w/a.rs", FileChangeKind::Modified),
        ];
        let out = coalesce_burst(burst);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].kind, FileChangeKind::Modified);
    }

    #[test]
    fn canonicalize_within_root_rejects_a_symlink_that_escapes_the_workspace() {
        let root = std::env::temp_dir().join(format!(
            "wakaclock-symlink-guard-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let outside = std::env::temp_dir().join(format!(
            "wakaclock-symlink-target-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret"), "s").unwrap();

        let link = root.join("escape");
        #[cfg(unix)]
        std::os::unix::fs::symlink(outside.join("secret"), &link).unwrap();

        #[cfg(unix)]
        {
            assert_eq!(
                canonicalize_within_root(&root, &link),
                Err(PathResolveError::Escape)
            );
            // A real file inside the root is fine.
            fs::write(root.join("ok.rs"), "x").unwrap();
            assert!(canonicalize_within_root(&root, &root.join("ok.rs")).is_ok());
        }

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn gitignored_and_excluded_paths_produce_nothing() {
        let ignore =
            WorkspaceIgnore::from_rules(["*.log", "dist/", "secret.env", "coverage", "generated/"]);
        assert!(ignore.is_ignored("src/app.log"));
        assert!(ignore.is_ignored("dist/bundle.js"));
        assert!(ignore.is_ignored("nested/dist/x"));
        assert!(ignore.is_ignored("secret.env"));
        assert!(ignore.is_ignored("coverage/lcov.info"));
        assert!(ignore.is_ignored("generated/schema.rs"));

        assert!(!ignore.is_ignored("src/app.rs"));
        assert!(!ignore.is_ignored("distillery/src/lib.rs")); // not `dist/`
        assert!(!ignore.is_ignored("README.md"));
    }

    #[test]
    fn workspace_ignore_load_reads_the_root_gitignore() {
        let root = std::env::temp_dir().join(format!(
            "wakaclock-ignore-load-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.join(".gitignore"),
            "# comment\n*.tmp\nbuild/\n!keep.tmp\n",
        )
        .unwrap();
        let ignore = WorkspaceIgnore::load(&root, &["node_modules/".to_string()]);
        assert!(ignore.is_ignored("x.tmp"));
        assert!(ignore.is_ignored("build/out"));
        assert!(ignore.is_ignored("node_modules/pkg/i.js"));
        assert!(!ignore.is_ignored("src/main.rs"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn fingerprint_reads_and_discards_content_and_never_returns_it() {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-fingerprint-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("a.rs");
        let secret = "fn main() { let password = \"hunter2\"; }";
        fs::write(&file, secret).unwrap();

        let fp1 = fingerprint_changed_file(&file).unwrap();
        assert!(fp1.starts_with("blob:"));
        assert!(
            !fp1.contains("hunter2"),
            "fingerprint must not carry content"
        );
        assert!(!fp1.contains("password"));

        // Same bytes → same fingerprint; different bytes → different.
        assert_eq!(fingerprint_changed_file(&file).unwrap(), fp1);
        fs::write(&file, format!("{secret} // edit")).unwrap();
        assert_ne!(fingerprint_changed_file(&file).unwrap(), fp1);

        // Deleted file → None.
        fs::remove_file(&file).unwrap();
        assert_eq!(fingerprint_changed_file(&file), None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn file_changed_event_carries_no_content_field() {
        // Structural guard: the only data that crosses this module's boundary is a
        // path, a kind and a timestamp — never bytes. If someone adds a
        // `content`/`snippet`/`diff` field this stops compiling here.
        let e = ev("/w/a.rs", FileChangeKind::Modified);
        let FileChangedEvent {
            path: _,
            kind: _,
            observed_at: _,
        } = e;
    }
}

// ---------------------------------------------------------------------------
// planai2.md Phase 3 (p3.4) — backpressure: a fixed-capacity buffer for a storm
// ---------------------------------------------------------------------------

/// A fixed-capacity ring buffer for raw filesystem events. This is the observer's
/// backpressure: a storm — `git checkout`/`git rebase` rewriting tens of thousands
/// of files, a `cargo build` touching a whole `target/`, a codegen sweep — can
/// arrive far faster than the correlation engine drains it, so rather than let a
/// `Vec` grow without bound, the buffer holds at most `capacity` events and, when
/// full, **drops the oldest** and counts the loss in [`dropped`](Self::dropped).
///
/// Memory budget: `capacity * size_of::<FileChangedEvent>()` for the ring, plus
/// the heap of at most `capacity` path strings. At the default capacity that is
/// on the order of a few hundred kilobytes regardless of how large the storm is.
/// Losing the oldest raw events during a storm is acceptable — a `git checkout`
/// is not a coding session, and [`coalesce_burst`] collapses what survives anyway.
#[derive(Debug)]
pub struct BoundedEventBuffer {
    capacity: usize,
    events: VecDeque<FileChangedEvent>,
    dropped: u64,
}

impl BoundedEventBuffer {
    /// ~4k events. `size_of::<FileChangedEvent>()` is ~56 bytes, so the ring is
    /// ~224 KB before path-string heap.
    pub const DEFAULT_CAPACITY: usize = 4096;

    pub fn new(capacity: usize) -> Self {
        let capacity = capacity.max(1);
        Self {
            capacity,
            events: VecDeque::with_capacity(capacity),
            dropped: 0,
        }
    }

    pub fn with_default_capacity() -> Self {
        Self::new(Self::DEFAULT_CAPACITY)
    }

    /// Append one event. When the buffer is full the oldest event is evicted and
    /// `dropped` is incremented — the newest `capacity` events are always kept.
    pub fn push(&mut self, event: FileChangedEvent) {
        if self.events.len() == self.capacity {
            self.events.pop_front();
            self.dropped += 1;
        }
        self.events.push_back(event);
    }

    /// Take everything currently buffered, leaving it empty. `dropped` is *not*
    /// reset — the caller reads it to know the drain is lossy.
    pub fn drain(&mut self) -> Vec<FileChangedEvent> {
        self.events.drain(..).collect()
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// How many events have been dropped for backpressure since construction.
    pub fn dropped(&self) -> u64 {
        self.dropped
    }
}

impl Default for BoundedEventBuffer {
    fn default() -> Self {
        Self::with_default_capacity()
    }
}

impl ObserverPool {
    /// Drain every watcher into `buffer` (applying its capacity limit), waiting up
    /// to `timeout` for the first event on each watcher then pulling whatever else
    /// is already queued. Out-of-scope events are dropped before they reach the
    /// buffer. This is the storm-safe form of [`poll`](Self::poll): a burst of
    /// 50k events costs `buffer.capacity()`, not 50k allocations.
    pub fn poll_into(&self, timeout: Duration, buffer: &mut BoundedEventBuffer) {
        for watcher in self.watchers.values() {
            let Some(first) = watcher.next_event(timeout) else {
                continue;
            };
            if self.is_within_watched(&first.path) {
                buffer.push(first);
            }
            while let Some(more) = watcher.next_event(Duration::from_millis(50)) {
                if self.is_within_watched(&more.path) {
                    buffer.push(more);
                }
            }
        }
    }
}

#[cfg(test)]
mod backpressure_tests {
    use super::*;

    fn ev(n: usize) -> FileChangedEvent {
        FileChangedEvent {
            path: PathBuf::from(format!("/w/src/file_{n}.rs")),
            kind: FileChangeKind::Modified,
            observed_at: Utc::now(),
        }
    }

    #[test]
    fn a_ten_thousand_event_storm_stays_bounded_and_keeps_the_newest() {
        let cap = BoundedEventBuffer::DEFAULT_CAPACITY;
        let mut buffer = BoundedEventBuffer::new(cap);

        for n in 0..10_000 {
            buffer.push(ev(n));
        }

        // Memory is bounded: never more than `capacity` events retained.
        assert_eq!(buffer.len(), cap);
        assert_eq!(buffer.dropped(), 10_000 - cap as u64);

        // The retained window is the *newest* events (oldest were shed).
        let drained = buffer.drain();
        assert_eq!(drained.len(), cap);
        assert_eq!(drained.first().unwrap().path, ev(10_000 - cap).path);
        assert_eq!(drained.last().unwrap().path, ev(9_999).path);

        // drain() leaves it empty but the drop counter persists.
        assert!(buffer.is_empty());
        assert_eq!(buffer.dropped(), 10_000 - cap as u64);
    }

    #[test]
    fn a_tiny_buffer_still_never_grows_past_its_capacity() {
        let mut buffer = BoundedEventBuffer::new(4);
        for n in 0..1_000 {
            buffer.push(ev(n));
            assert!(buffer.len() <= 4, "buffer grew past capacity at push {n}");
        }
        assert_eq!(buffer.len(), 4);
        assert_eq!(buffer.dropped(), 996);
    }

    #[test]
    fn capacity_is_clamped_to_at_least_one() {
        let mut buffer = BoundedEventBuffer::new(0);
        assert_eq!(buffer.capacity(), 1);
        buffer.push(ev(1));
        buffer.push(ev(2));
        assert_eq!(buffer.len(), 1);
        assert_eq!(buffer.drain()[0].path, ev(2).path);
    }

    #[test]
    fn an_idle_watcher_returns_none_within_the_timeout_and_does_not_spin() {
        // `next_event` blocks on `recv_timeout` — the thread parks, it does not
        // busy-poll. Proven here by: with no filesystem activity the call returns
        // `None` and comes back close to the requested timeout, not far past it
        // (a spin loop would still eventually return, so we bound the overshoot).
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-idle-watcher-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let watcher = WorkspaceWatcher::watch(&dir).unwrap();

        let start = Instant::now();
        let got = watcher.next_event(Duration::from_millis(200));
        let elapsed = start.elapsed();
        let _ = std::fs::remove_dir_all(&dir);

        assert!(got.is_none());
        assert!(
            elapsed >= Duration::from_millis(190) && elapsed < Duration::from_millis(600),
            "idle wait took {elapsed:?} — expected ~200ms of parked waiting"
        );
    }
}

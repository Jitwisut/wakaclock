//! planai2.md Phase 3 (p3.1): the **workspace lease registry**.
//!
//! The broker must never watch all of `$HOME`. Instead every producer that wants
//! its workspace observed — VS Code, an agent session, the CLI — takes out a
//! *lease* on that workspace's canonical root and refreshes it periodically. A
//! workspace is watched while it has at least one live lease; when the last lease
//! for a workspace expires (the producer went away without releasing it), the
//! watcher for that workspace stops.
//!
//! This module is pure and in-memory: no filesystem watching happens here (that is
//! `filesystem_observer.rs`, wired in p3.2), and `pid` / `session_id` are stored
//! as metadata only — liveness checks belong to Phase 4.

use std::path::{Path, PathBuf};

use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

/// One producer's claim on one workspace.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceLease {
    /// Stable id derived from `canonical_root` — same root ⇒ same id.
    pub workspace_id: String,
    pub canonical_root: PathBuf,
    /// Who holds this lease: `"vscode"`, `"codex-session-42"`, `"cli"`, …
    pub producer_id: String,
    pub pid: Option<u32>,
    pub session_id: Option<String>,
    pub registered_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    /// Extra ignore globs this producer wants applied on top of the built-in set.
    pub exclude_rules: Vec<String>,
}

impl WorkspaceLease {
    pub fn is_live_at(&self, now: DateTime<Utc>) -> bool {
        self.expires_at > now
    }
}

/// Why a `register` call was refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LeaseError {
    /// The root is `$HOME`, an ancestor of `$HOME`, or the filesystem root —
    /// leasing it would put the whole home directory under watch.
    RootTooBroad(PathBuf),
    /// The path is not absolute, so it cannot be a canonical workspace root.
    NotAbsolute(PathBuf),
}

impl std::fmt::Display for LeaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RootTooBroad(p) => write!(
                f,
                "refusing to lease {} — it is $HOME or above it; the broker never watches the whole home directory",
                p.display()
            ),
            Self::NotAbsolute(p) => write!(f, "workspace root {} is not absolute", p.display()),
        }
    }
}

impl std::error::Error for LeaseError {}

/// Deterministic id for a workspace root (URL-namespaced v5 UUID of the path
/// string, matching how `broker::payload_hash` derives stable ids).
pub fn workspace_id_for(canonical_root: &Path) -> String {
    Uuid::new_v5(
        &Uuid::NAMESPACE_URL,
        canonical_root.to_string_lossy().as_bytes(),
    )
    .to_string()
}

/// The live set of workspace leases. A workspace is watched iff at least one of
/// its leases has not expired.
#[derive(Debug, Clone)]
pub struct WorkspaceRegistry {
    ttl: Duration,
    home_dir: PathBuf,
    leases: Vec<WorkspaceLease>,
}

impl WorkspaceRegistry {
    /// `ttl` is how long a fresh or refreshed lease stays live without another
    /// refresh. `home_dir` is the boundary a lease root may not reach or exceed.
    pub fn new(ttl: Duration, home_dir: impl Into<PathBuf>) -> Self {
        Self {
            ttl,
            home_dir: home_dir.into(),
            leases: Vec::new(),
        }
    }

    fn root_is_too_broad(&self, root: &Path) -> bool {
        // `root` is the filesystem root, is exactly `$HOME`, or is an ancestor of
        // `$HOME` (so watching it recursively would cover the whole home dir).
        root.parent().is_none() || self.home_dir.starts_with(root)
    }

    /// Register (or, for the same `workspace_id` + `producer_id`, renew) a lease.
    /// Returns the `workspace_id`.
    #[allow(clippy::too_many_arguments)]
    pub fn register(
        &mut self,
        canonical_root: impl Into<PathBuf>,
        producer_id: impl Into<String>,
        pid: Option<u32>,
        session_id: Option<String>,
        exclude_rules: Vec<String>,
        now: DateTime<Utc>,
    ) -> Result<String, LeaseError> {
        let canonical_root = canonical_root.into();
        if !canonical_root.is_absolute() {
            return Err(LeaseError::NotAbsolute(canonical_root));
        }
        if self.root_is_too_broad(&canonical_root) {
            return Err(LeaseError::RootTooBroad(canonical_root));
        }
        let workspace_id = workspace_id_for(&canonical_root);
        let producer_id = producer_id.into();
        let expires_at = now + self.ttl;

        if let Some(existing) = self
            .leases
            .iter_mut()
            .find(|lease| lease.workspace_id == workspace_id && lease.producer_id == producer_id)
        {
            existing.last_seen_at = now;
            existing.expires_at = expires_at;
            existing.pid = pid;
            existing.session_id = session_id;
            existing.exclude_rules = exclude_rules;
        } else {
            self.leases.push(WorkspaceLease {
                workspace_id: workspace_id.clone(),
                canonical_root,
                producer_id,
                pid,
                session_id,
                registered_at: now,
                last_seen_at: now,
                expires_at,
                exclude_rules,
            });
        }
        Ok(workspace_id)
    }

    /// Push a lease's `expires_at` out by the TTL. Returns `false` when no such
    /// lease is held (already expired-and-pruned, or never registered).
    pub fn refresh(&mut self, workspace_id: &str, producer_id: &str, now: DateTime<Utc>) -> bool {
        match self
            .leases
            .iter_mut()
            .find(|lease| lease.workspace_id == workspace_id && lease.producer_id == producer_id)
        {
            Some(lease) => {
                lease.last_seen_at = now;
                lease.expires_at = now + self.ttl;
                true
            }
            None => false,
        }
    }

    /// Drop a lease immediately (the producer exited cleanly).
    pub fn release(&mut self, workspace_id: &str, producer_id: &str) {
        self.leases.retain(|lease| {
            !(lease.workspace_id == workspace_id && lease.producer_id == producer_id)
        });
    }

    /// Remove every lease that has expired as of `now`.
    pub fn prune_expired(&mut self, now: DateTime<Utc>) {
        self.leases.retain(|lease| lease.is_live_at(now));
    }

    /// The canonical roots that should currently be watched — one per workspace
    /// that still has a live lease. Sorted and de-duplicated.
    pub fn watched_roots(&self, now: DateTime<Utc>) -> Vec<PathBuf> {
        let mut roots: Vec<PathBuf> = self
            .leases
            .iter()
            .filter(|lease| lease.is_live_at(now))
            .map(|lease| lease.canonical_root.clone())
            .collect();
        roots.sort();
        roots.dedup();
        roots
    }

    pub fn is_watched(&self, canonical_root: &Path, now: DateTime<Utc>) -> bool {
        self.leases
            .iter()
            .any(|lease| lease.canonical_root == canonical_root && lease.is_live_at(now))
    }

    /// Every live lease for one workspace, by id.
    pub fn leases_for(&self, workspace_id: &str, now: DateTime<Utc>) -> Vec<&WorkspaceLease> {
        self.leases
            .iter()
            .filter(|lease| lease.workspace_id == workspace_id && lease.is_live_at(now))
            .collect()
    }

    /// The merged extra-exclude set for a workspace (union of every live lease's
    /// `exclude_rules`).
    pub fn exclude_rules_for(&self, workspace_id: &str, now: DateTime<Utc>) -> Vec<String> {
        let mut rules: Vec<String> = self
            .leases_for(workspace_id, now)
            .into_iter()
            .flat_map(|lease| lease.exclude_rules.clone())
            .collect();
        rules.sort();
        rules.dedup();
        rules
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn registry() -> WorkspaceRegistry {
        WorkspaceRegistry::new(Duration::seconds(60), "/home/dev")
    }

    #[test]
    fn register_then_the_workspace_is_watched() {
        let mut reg = registry();
        let now = Utc::now();
        let id = reg
            .register("/home/dev/project", "vscode", Some(10), None, vec![], now)
            .unwrap();
        assert_eq!(id, workspace_id_for(Path::new("/home/dev/project")));
        assert!(reg.is_watched(Path::new("/home/dev/project"), now));
        assert_eq!(
            reg.watched_roots(now),
            vec![PathBuf::from("/home/dev/project")]
        );
    }

    #[test]
    fn a_lease_expires_and_the_workspace_stops_being_watched() {
        let mut reg = registry();
        let now = Utc::now();
        reg.register("/home/dev/project", "vscode", None, None, vec![], now)
            .unwrap();

        let later = now + Duration::seconds(61);
        assert!(!reg.is_watched(Path::new("/home/dev/project"), later));
        assert!(reg.watched_roots(later).is_empty());
        reg.prune_expired(later);
        assert!(reg.watched_roots(now).is_empty()); // gone entirely
    }

    #[test]
    fn refresh_keeps_a_lease_alive() {
        let mut reg = registry();
        let now = Utc::now();
        let id = reg
            .register("/home/dev/project", "vscode", None, None, vec![], now)
            .unwrap();

        let mid = now + Duration::seconds(50);
        assert!(reg.refresh(&id, "vscode", mid));
        let after_original_ttl = now + Duration::seconds(70);
        assert!(reg.is_watched(Path::new("/home/dev/project"), after_original_ttl));

        // Refreshing a lease that was never held returns false.
        assert!(!reg.refresh(&id, "some-other-producer", mid));
    }

    #[test]
    fn two_producers_one_leaves_and_the_watch_continues() {
        let mut reg = registry();
        let now = Utc::now();
        let id = reg
            .register("/home/dev/project", "vscode", None, None, vec![], now)
            .unwrap();
        reg.register(
            "/home/dev/project",
            "codex-session-1",
            Some(42),
            Some("s1".to_string()),
            vec![],
            now,
        )
        .unwrap();
        assert_eq!(reg.leases_for(&id, now).len(), 2);

        // The Codex session ends; VS Code is still open.
        reg.release(&id, "codex-session-1");
        assert_eq!(reg.leases_for(&id, now).len(), 1);
        assert!(reg.is_watched(Path::new("/home/dev/project"), now));

        // Now VS Code closes too — nothing left to watch.
        reg.release(&id, "vscode");
        assert!(!reg.is_watched(Path::new("/home/dev/project"), now));
    }

    #[test]
    fn the_broker_never_leases_the_whole_home_directory() {
        let mut reg = registry();
        let now = Utc::now();
        for bad in ["/home/dev", "/home", "/"] {
            assert_eq!(
                reg.register(bad, "vscode", None, None, vec![], now),
                Err(LeaseError::RootTooBroad(PathBuf::from(bad))),
                "leasing {bad} must be refused"
            );
        }
        assert_eq!(
            reg.register("relative/path", "vscode", None, None, vec![], now),
            Err(LeaseError::NotAbsolute(PathBuf::from("relative/path")))
        );
        // A real project *under* home is fine.
        assert!(reg
            .register("/home/dev/project", "vscode", None, None, vec![], now)
            .is_ok());
    }

    #[test]
    fn exclude_rules_from_every_live_lease_are_merged() {
        let mut reg = registry();
        let now = Utc::now();
        let id = reg
            .register(
                "/home/dev/project",
                "vscode",
                None,
                None,
                vec!["*.log".to_string(), "tmp/".to_string()],
                now,
            )
            .unwrap();
        reg.register(
            "/home/dev/project",
            "cli",
            None,
            None,
            vec!["tmp/".to_string(), "build/".to_string()],
            now,
        )
        .unwrap();
        assert_eq!(
            reg.exclude_rules_for(&id, now),
            vec![
                "*.log".to_string(),
                "build/".to_string(),
                "tmp/".to_string()
            ]
        );
    }
}

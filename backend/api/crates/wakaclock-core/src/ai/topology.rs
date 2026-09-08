//! F7 topology identity and workspace mapping contract.
//!
//! A local editor process cannot safely stand in for a collector that runs on an
//! SSH host, inside WSL, or in a dev container.  The first F7 boundary is therefore
//! deliberately small: every producer must carry an explicit execution surface and
//! opaque identity tuple, while path mapping stays local to the collector.  This
//! module does not discover remote hosts and never hashes a repository basename as
//! an identity.  Callers provide a persisted device seed and explicit workspace /
//! worktree keys obtained from their runtime or VCS integration.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// Version of the local topology contract.  This is intentionally separate from
/// `BROKER_SCHEMA_VERSION`: F7 can validate identity locally before the wire envelope
/// and its compatibility matrix are upgraded in F8.
pub const TOPOLOGY_SCHEMA_VERSION: u8 = 1;
const MAX_ID_BYTES: usize = 128;

/// Where the collector that observed the mutation is running.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionSurface {
    Local,
    SshRemote,
    Wsl,
    DevContainer,
    RemoteExtensionHost,
    CloudJob,
    Unknown,
}

/// Editor or protocol that supplied editor-side observations.  A value here is
/// descriptive only; it never upgrades a generic LSP change to AI authorship.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EditorSurface {
    None,
    Vscode,
    Jetbrains,
    Neovim,
    Zed,
    Lsp,
    Browser,
    Unknown,
}

/// Opaque identity tuple attached to a producer session.  None of the fields are
/// paths, hostnames, usernames, repository names, or secrets.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TopologyContext {
    pub schema_version: u8,
    pub execution: ExecutionSurface,
    pub editor: EditorSurface,
    pub device_id: String,
    pub workspace_id: String,
    pub worktree_id: String,
    pub session_id: String,
    /// Stable identity of a container/VM/job instance when the execution surface
    /// has one. It is intentionally absent for an ordinary local process.
    #[serde(default)]
    pub runtime_instance_id: Option<String>,
    /// Opaque VCS identity, when a producer can obtain one from repository
    /// metadata. A project/repository basename is never accepted as this value.
    #[serde(default)]
    pub repository_id: Option<String>,
}

impl TopologyContext {
    /// Validate the identity boundary before a context is persisted or associated
    /// with an event. The fields are opaque labels, so validation is deliberately
    /// stricter than a user-facing display string.
    pub fn validate(&self) -> Result<(), TopologyError> {
        if self.schema_version != TOPOLOGY_SCHEMA_VERSION {
            return Err(TopologyError::UnsupportedSchema(self.schema_version));
        }
        for (field, value) in [
            ("device_id", self.device_id.as_str()),
            ("workspace_id", self.workspace_id.as_str()),
            ("worktree_id", self.worktree_id.as_str()),
            ("session_id", self.session_id.as_str()),
        ] {
            validate_id(field, value)?;
        }
        for (field, value) in [
            ("runtime_instance_id", self.runtime_instance_id.as_deref()),
            ("repository_id", self.repository_id.as_deref()),
        ] {
            if let Some(value) = value {
                validate_id(field, value)?;
                if field == "repository_id" && !value.starts_with("repository:") {
                    return Err(TopologyError::InvalidRepositoryId);
                }
            }
        }
        if matches!(self.execution, ExecutionSurface::CloudJob)
            && self.runtime_instance_id.is_none()
        {
            return Err(TopologyError::MissingRuntimeInstance {
                surface: self.execution,
            });
        }
        Ok(())
    }

    /// Identity used by a deduplicator. Equal values mean the same collector
    /// session scope; different devices, worktrees, or sessions never merge merely
    /// because their paths or repository names happen to match.
    pub fn dedup_scope(&self) -> (&str, &str, &str, &str) {
        (
            &self.device_id,
            &self.workspace_id,
            &self.worktree_id,
            &self.session_id,
        )
    }
}

/// Explicit inputs used to derive opaque IDs. `device_seed` must be persisted by
/// the installation (for example in the CLI state directory); deriving it from a
/// hostname or a path would merge clones and split a device after a rename.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TopologyIdentityInput {
    pub execution: ExecutionSurface,
    pub editor: EditorSurface,
    pub device_seed: String,
    /// Caller-provided stable key for one logical workspace. The fallback helper
    /// below uses a normalized local root only when the caller explicitly chooses it.
    pub workspace_key: String,
    /// Stable worktree key. A VCS worktree ID or explicit runtime mount key is
    /// appropriate; a repository basename is not.
    pub worktree_key: String,
    pub session_id: String,
    pub runtime_instance_key: Option<String>,
    pub repository_id: Option<String>,
}

impl TopologyIdentityInput {
    pub fn build(self) -> Result<TopologyContext, TopologyError> {
        validate_seed("device_seed", &self.device_seed)?;
        validate_seed("workspace_key", &self.workspace_key)?;
        validate_seed("worktree_key", &self.worktree_key)?;
        validate_seed("session_id", &self.session_id)?;
        if let Some(key) = self.runtime_instance_key.as_deref() {
            validate_seed("runtime_instance_key", key)?;
        }
        if let Some(repository_id) = self.repository_id.as_deref() {
            validate_repository_id(repository_id)?;
        }

        let device_id = opaque_id("device", &[&self.device_seed]);
        let workspace_id = opaque_id(
            "workspace",
            &[
                &device_id,
                surface_name(self.execution),
                &self.workspace_key,
            ],
        );
        let worktree_id = opaque_id("worktree", &[&workspace_id, &self.worktree_key]);
        let runtime_instance_id = self
            .runtime_instance_key
            .map(|key| opaque_id("runtime", &[&device_id, surface_name(self.execution), &key]));
        let session_id = opaque_id("session", &[&device_id, &self.session_id]);

        let repository_id = self
            .repository_id
            .map(|value| opaque_id("repository", &[&value]));
        let context = TopologyContext {
            schema_version: TOPOLOGY_SCHEMA_VERSION,
            execution: self.execution,
            editor: self.editor,
            device_id,
            workspace_id,
            worktree_id,
            session_id,
            runtime_instance_id,
            repository_id,
        };
        context.validate()?;
        Ok(context)
    }
}

/// Stable identity from a local root. This is only a convenience for a producer
/// that has no VCS identity yet; the path is used as key material and never appears
/// in the resulting context. Remote collectors should prefer an explicit workspace
/// key supplied by their bridge so a remount can retain identity.
pub fn from_local_root(
    execution: ExecutionSurface,
    editor: EditorSurface,
    device_seed: impl Into<String>,
    local_root: &Path,
    worktree_key: impl Into<String>,
    session_id: impl Into<String>,
) -> Result<TopologyContext, TopologyError> {
    if !local_root.is_absolute() {
        return Err(TopologyError::RelativePath(local_root.to_path_buf()));
    }
    let normalized = lexical_normalize(local_root);
    TopologyIdentityInput {
        execution,
        editor,
        device_seed: device_seed.into(),
        workspace_key: format!("path:{}", normalized.display()),
        worktree_key: worktree_key.into(),
        session_id: session_id.into(),
        runtime_instance_key: None,
        repository_id: None,
    }
    .build()
}

/// One explicit local↔remote path mapping. It is kept out of serialized telemetry
/// so a diagnostics response cannot expose a user's home directory or remote path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceMapping {
    pub workspace_id: String,
    pub worktree_id: String,
    pub local_root: PathBuf,
    pub remote_root: Option<String>,
}

impl WorkspaceMapping {
    pub fn new(
        context: &TopologyContext,
        local_root: impl Into<PathBuf>,
        remote_root: Option<String>,
    ) -> Result<Self, TopologyError> {
        context.validate()?;
        let local_root = local_root.into();
        if !local_root.is_absolute() {
            return Err(TopologyError::RelativePath(local_root));
        }
        if let Some(remote_root) = remote_root.as_deref() {
            if remote_root.trim().is_empty() || !remote_root.starts_with('/') {
                return Err(TopologyError::InvalidRemoteRoot);
            }
        }
        Ok(Self {
            workspace_id: context.workspace_id.clone(),
            worktree_id: context.worktree_id.clone(),
            local_root: lexical_normalize(&local_root),
            remote_root,
        })
    }

    fn contains(&self, path: &Path) -> bool {
        lexical_normalize(path).starts_with(&self.local_root)
    }
}

/// Local registry used by a collector to resolve an event to exactly one explicit
/// workspace/worktree. It refuses overlapping roots because choosing one by basename
/// or insertion order would silently attribute events to the wrong worktree.
#[derive(Debug, Clone, Default)]
pub struct WorkspaceMappingRegistry {
    mappings: Vec<WorkspaceMapping>,
}

impl WorkspaceMappingRegistry {
    pub fn register(&mut self, mapping: WorkspaceMapping) -> Result<(), TopologyError> {
        if self.mappings.iter().any(|existing| {
            existing.local_root == mapping.local_root
                && (existing.workspace_id != mapping.workspace_id
                    || existing.worktree_id != mapping.worktree_id)
        }) {
            return Err(TopologyError::ConflictingMapping(mapping.local_root));
        }
        if self.mappings.iter().any(|existing| {
            existing.workspace_id == mapping.workspace_id
                && existing.worktree_id == mapping.worktree_id
                && existing.local_root == mapping.local_root
        }) {
            return Ok(());
        }
        if self.mappings.iter().any(|existing| {
            existing.local_root.starts_with(&mapping.local_root)
                || mapping.local_root.starts_with(&existing.local_root)
        }) {
            return Err(TopologyError::AmbiguousMapping {
                path: mapping.local_root,
            });
        }
        if let Some(remote_root) = mapping.remote_root.as_deref() {
            let remote_root = lexical_normalize(Path::new(remote_root));
            if self.mappings.iter().any(|existing| {
                existing
                    .remote_root
                    .as_deref()
                    .map(Path::new)
                    .map(lexical_normalize)
                    .is_some_and(|existing_root| {
                        existing_root.starts_with(&remote_root)
                            || remote_root.starts_with(&existing_root)
                    })
            }) {
                return Err(TopologyError::AmbiguousMapping { path: remote_root });
            }
        }
        self.mappings.push(mapping);
        self.mappings
            .sort_by(|a, b| a.local_root.cmp(&b.local_root));
        Ok(())
    }

    /// Resolve a path only when one exact registered root contains it. There is no
    /// basename fallback and no guess from a repository/project label.
    pub fn resolve(&self, path: &Path) -> Result<Option<&WorkspaceMapping>, TopologyError> {
        if !path.is_absolute() {
            return Err(TopologyError::RelativePath(path.to_path_buf()));
        }
        let matches: Vec<&WorkspaceMapping> = self
            .mappings
            .iter()
            .filter(|mapping| mapping.contains(path))
            .collect();
        match matches.as_slice() {
            [] => Ok(None),
            [mapping] => Ok(Some(mapping)),
            _ => Err(TopologyError::AmbiguousMapping {
                path: lexical_normalize(path),
            }),
        }
    }

    /// Resolve a path reported by a remote collector against its explicit remote
    /// mount. Remote paths never fall back to a basename or to the local root.
    pub fn resolve_remote(
        &self,
        remote_path: &str,
    ) -> Result<Option<&WorkspaceMapping>, TopologyError> {
        if !remote_path.starts_with('/') {
            return Err(TopologyError::InvalidRemoteRoot);
        }
        let normalized = lexical_normalize(Path::new(remote_path));
        let matches: Vec<&WorkspaceMapping> = self
            .mappings
            .iter()
            .filter(|mapping| {
                mapping
                    .remote_root
                    .as_deref()
                    .map(Path::new)
                    .map(|root| normalized.starts_with(lexical_normalize(root)))
                    .unwrap_or(false)
            })
            .collect();
        match matches.as_slice() {
            [] => Ok(None),
            [mapping] => Ok(Some(mapping)),
            _ => Err(TopologyError::AmbiguousMapping { path: normalized }),
        }
    }

    pub fn len(&self) -> usize {
        self.mappings.len()
    }

    pub fn is_empty(&self) -> bool {
        self.mappings.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum TopologyError {
    #[error("topology {0} field is empty or contains unsupported characters")]
    InvalidField(&'static str),
    #[error("topology {0} field is too long")]
    FieldTooLong(&'static str),
    #[error("topology repository_id must be an explicit stable id, not a basename")]
    InvalidRepositoryId,
    #[error("unsupported topology schema version {0}")]
    UnsupportedSchema(u8),
    #[error("{surface:?} topology requires a runtime_instance_id")]
    MissingRuntimeInstance { surface: ExecutionSurface },
    #[error("topology path must be absolute: {0}")]
    RelativePath(PathBuf),
    #[error("remote root must be an absolute non-empty path")]
    InvalidRemoteRoot,
    #[error("a different topology already owns local root {0}")]
    ConflictingMapping(PathBuf),
    #[error("workspace mapping overlaps another registered root at {path}")]
    AmbiguousMapping { path: PathBuf },
}

fn validate_seed(field: &'static str, value: &str) -> Result<(), TopologyError> {
    if value.trim().is_empty() || value.chars().any(|character| character.is_control()) {
        return Err(TopologyError::InvalidField(field));
    }
    if value.len() > 1024 {
        return Err(TopologyError::FieldTooLong(field));
    }
    Ok(())
}

fn validate_id(field: &'static str, value: &str) -> Result<(), TopologyError> {
    if value.is_empty()
        || value.len() > MAX_ID_BYTES
        || !value.bytes().all(|byte| {
            // Serialized topology IDs are opaque labels. A slash would make a
            // hand-crafted context look like a filesystem path and violate the
            // privacy boundary even though normal builders only emit UUIDs.
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':')
        })
    {
        return if value.len() > MAX_ID_BYTES {
            Err(TopologyError::FieldTooLong(field))
        } else {
            Err(TopologyError::InvalidField(field))
        };
    }
    Ok(())
}

fn validate_repository_id(value: &str) -> Result<(), TopologyError> {
    validate_seed("repository_id", value)?;
    // A basename is not a repository identity: two clones named `app` must remain
    // separate. Require a namespaced or opaque-looking key supplied by the VCS
    // bridge (`remote:...`, `git:...`, `id:...`, etc.).
    if !value.contains(':') || value.ends_with(':') {
        return Err(TopologyError::InvalidRepositoryId);
    }
    Ok(())
}

fn surface_name(surface: ExecutionSurface) -> &'static str {
    match surface {
        ExecutionSurface::Local => "local",
        ExecutionSurface::SshRemote => "ssh_remote",
        ExecutionSurface::Wsl => "wsl",
        ExecutionSurface::DevContainer => "dev_container",
        ExecutionSurface::RemoteExtensionHost => "remote_extension_host",
        ExecutionSurface::CloudJob => "cloud_job",
        ExecutionSurface::Unknown => "unknown",
    }
}

fn opaque_id(prefix: &str, parts: &[&str]) -> String {
    let material = parts.join("|");
    format!(
        "{prefix}:{}",
        Uuid::new_v5(&Uuid::NAMESPACE_URL, material.as_bytes())
    )
}

fn lexical_normalize(path: &Path) -> PathBuf {
    let mut output = PathBuf::new();
    for component in path.components() {
        use std::path::Component;
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if output.components().next_back().is_some() {
                    output.pop();
                }
            }
            other => output.push(other.as_os_str()),
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(workspace_key: &str, worktree_key: &str) -> TopologyIdentityInput {
        TopologyIdentityInput {
            execution: ExecutionSurface::SshRemote,
            editor: EditorSurface::Vscode,
            device_seed: "install-seed-a".to_string(),
            workspace_key: workspace_key.to_string(),
            worktree_key: worktree_key.to_string(),
            session_id: "session-a".to_string(),
            runtime_instance_key: Some("remote-host-a".to_string()),
            repository_id: Some("remote:git.example.test/team/app.git".to_string()),
        }
    }

    #[test]
    fn same_explicit_identity_is_stable_across_reconnects() {
        let first = input("remote-workspace-1", "worktree-1").build().unwrap();
        let second = input("remote-workspace-1", "worktree-1").build().unwrap();
        assert_eq!(first.device_id, second.device_id);
        assert_eq!(first.workspace_id, second.workspace_id);
        assert_eq!(first.worktree_id, second.worktree_id);
        assert_eq!(first.dedup_scope(), second.dedup_scope());
    }

    #[test]
    fn different_devices_and_worktrees_never_merge_by_repository_name() {
        let first = input("remote-a", "worktree-a").build().unwrap();
        let mut other_device = input("remote-a", "worktree-a");
        other_device.device_seed = "install-seed-b".to_string();
        let other_device = other_device.build().unwrap();
        let other_worktree = input("remote-a", "worktree-b").build().unwrap();
        assert_ne!(first.workspace_id, other_device.workspace_id);
        assert_ne!(first.worktree_id, other_worktree.worktree_id);
        assert_eq!(first.repository_id, other_worktree.repository_id);
    }

    #[test]
    fn local_root_is_used_as_key_but_never_serialized() {
        let context = from_local_root(
            ExecutionSurface::Local,
            EditorSurface::Neovim,
            "install-seed",
            Path::new("/Users/dev/app"),
            "git-worktree-1",
            "session-1",
        )
        .unwrap();
        let json = serde_json::to_string(&context).unwrap();
        assert!(!json.contains("/Users/dev/app"));
        assert!(!json.contains("git.example.test"));
        assert!(context.workspace_id.starts_with("workspace:"));
    }

    #[test]
    fn basename_repository_identity_is_rejected() {
        let mut value = input("workspace", "worktree");
        value.repository_id = Some("app".to_string());
        assert_eq!(value.build(), Err(TopologyError::InvalidRepositoryId));
    }

    #[test]
    fn serialized_ids_reject_path_like_values_even_when_prefixed() {
        let mut context = input("workspace", "worktree").build().unwrap();
        context.device_id = "device:/Users/alice".to_string();
        assert!(matches!(
            context.validate(),
            Err(TopologyError::InvalidField("device_id"))
        ));
    }

    #[test]
    fn cloud_jobs_require_a_runtime_instance() {
        let mut value = input("workspace", "worktree");
        value.execution = ExecutionSurface::CloudJob;
        value.runtime_instance_key = None;
        assert!(matches!(
            value.build(),
            Err(TopologyError::MissingRuntimeInstance {
                surface: ExecutionSurface::CloudJob
            })
        ));
    }

    #[test]
    fn mapping_requires_explicit_non_overlapping_roots() {
        let first = input("workspace-a", "worktree-a").build().unwrap();
        let second = input("workspace-b", "worktree-b").build().unwrap();
        let mut registry = WorkspaceMappingRegistry::default();
        registry
            .register(WorkspaceMapping::new(&first, "/remote/work-a", None).unwrap())
            .unwrap();
        assert!(matches!(
            registry.register(WorkspaceMapping::new(&second, "/remote/work-a", None).unwrap()),
            Err(TopologyError::ConflictingMapping(_))
        ));
        assert!(matches!(
            registry.register(WorkspaceMapping::new(&second, "/remote", None).unwrap()),
            Err(TopologyError::AmbiguousMapping { .. })
        ));
    }

    #[test]
    fn mapping_does_not_fall_back_to_a_repository_basename() {
        let context = input("workspace-a", "worktree-a").build().unwrap();
        let mut registry = WorkspaceMappingRegistry::default();
        registry
            .register(WorkspaceMapping::new(&context, "/remote/work-a", None).unwrap())
            .unwrap();
        assert!(registry
            .resolve(Path::new("/remote/other/app/src/lib.rs"))
            .unwrap()
            .is_none());
        assert_eq!(
            registry
                .resolve(Path::new("/remote/work-a/src/lib.rs"))
                .unwrap()
                .unwrap()
                .worktree_id,
            context.worktree_id
        );
    }

    #[test]
    fn remote_mount_mapping_is_explicit_and_non_overlapping() {
        let first = input("workspace-a", "worktree-a").build().unwrap();
        let second = input("workspace-b", "worktree-b").build().unwrap();
        let mut registry = WorkspaceMappingRegistry::default();
        registry
            .register(
                WorkspaceMapping::new(&first, "/local/a", Some("/workspace/a".to_string()))
                    .unwrap(),
            )
            .unwrap();
        assert_eq!(
            registry
                .resolve_remote("/workspace/a/src/main.rs")
                .unwrap()
                .unwrap()
                .worktree_id,
            first.worktree_id
        );
        assert!(registry
            .resolve_remote("/workspace/other/main.rs")
            .unwrap()
            .is_none());
        assert!(matches!(
            registry.register(
                WorkspaceMapping::new(
                    &second,
                    "/local/b",
                    Some("/workspace/a/nested".to_string()),
                )
                .unwrap(),
            ),
            Err(TopologyError::AmbiguousMapping { .. })
        ));
    }

    #[test]
    fn relative_paths_are_rejected_before_mapping() {
        let context = input("workspace-a", "worktree-a").build().unwrap();
        assert_eq!(
            WorkspaceMapping::new(&context, "relative/workspace", None),
            Err(TopologyError::RelativePath(PathBuf::from(
                "relative/workspace"
            )))
        );
    }
}

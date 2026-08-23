use std::path::{Component, Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PathResolveError {
    #[error("path escapes workspace root")]
    Escape,
}

/// Lexically normalize `.`/`..` components without touching the filesystem. Unlike
/// `Path::canonicalize`, this never requires the path to exist — plan.md 8.7 requires
/// resolving paths for deleted/renamed files, which by definition don't exist anymore.
/// A leading `..` that would climb above the path's own root is dropped rather than
/// producing a path outside it, matching lexical (not symlink-aware) normalization.
pub fn normalize_lexical(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !matches!(
                    out.components().next_back(),
                    None | Some(Component::RootDir)
                ) {
                    out.pop();
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Resolve `candidate` against `workspace_root`, returning the normalized absolute path
/// only if it stays within the root. `candidate` may be relative (resolved against the
/// root) or already absolute (validated against the root as-is) — an agent transcript's
/// working directory and an editor's absolute entity path are handled the same way
/// (plan.md 8.7: "Resolve agent-relative paths using the transcript's working
/// directory; resolve editor paths using the editor-provided absolute entity").
pub fn resolve_within_workspace(
    workspace_root: &Path,
    candidate: &Path,
) -> Result<PathBuf, PathResolveError> {
    let joined = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        workspace_root.join(candidate)
    };

    let normalized_root = normalize_lexical(workspace_root);
    let normalized_candidate = normalize_lexical(&joined);

    if normalized_candidate.starts_with(&normalized_root) {
        Ok(normalized_candidate)
    } else {
        Err(PathResolveError::Escape)
    }
}

/// A stable, forward-slash display form for cross-platform comparison during
/// correlation. Does not touch the filesystem and does not imply the path exists.
pub fn to_comparable_string(path: &Path) -> String {
    normalize_lexical(path).to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_lexical_collapses_dot_and_dotdot() {
        let normalized = normalize_lexical(Path::new("/a/./b/../c"));
        assert_eq!(normalized, PathBuf::from("/a/c"));
    }

    #[test]
    fn normalize_lexical_does_not_climb_above_root() {
        let normalized = normalize_lexical(Path::new("/a/../../etc/passwd"));
        assert_eq!(normalized, PathBuf::from("/etc/passwd"));
    }

    #[test]
    fn resolve_within_workspace_accepts_relative_child() {
        let root = Path::new("/home/dev/example-project");
        let resolved = resolve_within_workspace(root, Path::new("src/lib.rs")).unwrap();
        assert_eq!(
            resolved,
            PathBuf::from("/home/dev/example-project/src/lib.rs")
        );
    }

    #[test]
    fn resolve_within_workspace_accepts_absolute_child() {
        let root = Path::new("/home/dev/example-project");
        let resolved =
            resolve_within_workspace(root, Path::new("/home/dev/example-project/src/lib.rs"))
                .unwrap();
        assert_eq!(
            resolved,
            PathBuf::from("/home/dev/example-project/src/lib.rs")
        );
    }

    #[test]
    fn resolve_within_workspace_rejects_traversal_escape() {
        let root = Path::new("/home/dev/example-project");
        let result = resolve_within_workspace(root, Path::new("../../etc/passwd"));
        assert_eq!(result, Err(PathResolveError::Escape));
    }

    #[test]
    fn resolve_within_workspace_rejects_unrelated_absolute_path() {
        let root = Path::new("/home/dev/example-project");
        let result = resolve_within_workspace(root, Path::new("/etc/passwd"));
        assert_eq!(result, Err(PathResolveError::Escape));
    }

    #[test]
    fn resolve_within_workspace_does_not_require_the_file_to_exist() {
        let root = Path::new("/home/dev/example-project");
        let resolved = resolve_within_workspace(root, Path::new("src/deleted_file.rs")).unwrap();
        assert_eq!(
            resolved,
            PathBuf::from("/home/dev/example-project/src/deleted_file.rs")
        );
    }

    #[test]
    fn to_comparable_string_normalizes_separators() {
        assert_eq!(
            to_comparable_string(Path::new("/a/./b")),
            "/a/b".to_string()
        );
    }
}

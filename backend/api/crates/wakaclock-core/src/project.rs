// crates/wakaclock-core/src/project.rs

//! The single place that decides a heartbeat's project name.
//!
//! Every producer (editor heartbeats, AI transcript sync, agent hooks) must resolve its
//! project here instead of deriving a name from a reported cwd or the nearest manifest.
//! Spreading that decision across call sites is how nested crates (`wakaclock-core`),
//! editor subfolders (`vscode`), linked worktrees (`phase8`) and temp folders (`tmp`)
//! each ended up in the dashboard as projects of their own.
//!
//! Resolution is a plain `stat` walk over the entity's ancestors. It deliberately does
//! not use `gix`: ref resolution can block while a checkout is changing, and this runs
//! inside the broker, where one stalled event holds up the durable queue.

use std::fs;
use std::path::{Path, PathBuf};

const PROJECT_MANIFESTS: [&str; 5] = [
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "go.mod",
    "composer.json",
];

const WORKSPACE_MARKERS: [&str; 4] = ["pnpm-workspace.yaml", "lerna.json", "nx.json", "rush.json"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectSource {
    /// Nearest Git working tree; linked worktrees report the main repository's name.
    Git,
    /// A non-Git monorepo root (`pnpm-workspace.yaml`, `package.json` workspaces, …).
    Workspace,
    /// The workspace root the producer reported, confirmed by a manifest.
    Hint,
    /// The nearest non-Git folder with a single-project manifest.
    Manifest,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedProject {
    pub name: String,
    /// Working-tree root that contains the entity (the linked worktree itself, not the
    /// main repository), so callers can still validate workspace boundaries against it.
    pub root: PathBuf,
    pub source: ProjectSource,
}

/// Resolve the project that owns `entity`.
///
/// Order: Git working tree → non-Git workspace marker → `hint_root` (a reported cwd,
/// only if it contains the entity and carries a manifest) → nearest manifest → `None`.
/// Git always wins over manifests, so a `Cargo.toml` inside a repository never names
/// the project. Home, temp and agent-state folders are never accepted as a root.
pub fn resolve_project(entity: &Path, hint_root: Option<&Path>) -> Option<ResolvedProject> {
    let denied = DeniedRoots::current();
    let start = if entity.is_dir() {
        entity
    } else {
        entity.parent()?
    };

    if let Some(resolved) = resolve_git(start, denied) {
        return Some(resolved);
    }

    let mut nearest_manifest = None;
    for ancestor in start.ancestors() {
        if denied.contains(ancestor) {
            continue;
        }
        if has_workspace_marker(ancestor) {
            return named(ancestor, ProjectSource::Workspace);
        }
        if nearest_manifest.is_none() && has_manifest(ancestor) {
            nearest_manifest = Some(ancestor);
        }
    }

    if let Some(hint) = hint_root {
        if entity.starts_with(hint) && !denied.contains(hint) && has_manifest(hint) {
            if let Some(resolved) = named(hint, ProjectSource::Hint) {
                return Some(resolved);
            }
        }
    }

    nearest_manifest.and_then(|root| named(root, ProjectSource::Manifest))
}

/// True when `path` looks like the root of a project: a Git working tree, a non-Git
/// workspace marker, or a single-project manifest.
pub fn has_project_marker(path: &Path) -> bool {
    path.join(".git").exists() || has_workspace_marker(path) || has_manifest(path)
}

fn has_manifest(path: &Path) -> bool {
    PROJECT_MANIFESTS
        .iter()
        .any(|marker| path.join(marker).is_file())
}

fn has_workspace_marker(path: &Path) -> bool {
    if WORKSPACE_MARKERS
        .iter()
        .any(|marker| path.join(marker).is_file())
    {
        return true;
    }

    fs::read_to_string(path.join("package.json"))
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
        .and_then(|value| value.get("workspaces").cloned())
        .is_some()
}

fn resolve_git(start: &Path, denied: &DeniedRoots) -> Option<ResolvedProject> {
    for ancestor in start.ancestors() {
        let dot_git = ancestor.join(".git");
        let Ok(metadata) = fs::metadata(&dot_git) else {
            continue;
        };
        if denied.contains(ancestor) {
            // A dotfiles repository at `$HOME` must not claim every loose file.
            continue;
        }
        let name = if metadata.is_file() {
            linked_worktree_repository_name(ancestor, &dot_git).or_else(|| folder_name(ancestor))
        } else {
            folder_name(ancestor)
        }?;
        return Some(ResolvedProject {
            name,
            root: ancestor.to_path_buf(),
            source: ProjectSource::Git,
        });
    }
    None
}

/// A linked worktree's `.git` file points at `<main>/.git/worktrees/<name>`, whose
/// `commondir` leads back to the main `.git` directory. Report that repository's name
/// (as `git::discover` does through `gix`). Submodules have no `commondir` and keep
/// their own folder name.
fn linked_worktree_repository_name(worktree_root: &Path, dot_git: &Path) -> Option<String> {
    let content = fs::read_to_string(dot_git).ok()?;
    let gitdir = content
        .lines()
        .find_map(|line| line.strip_prefix("gitdir:"))
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    let gitdir = worktree_root.join(gitdir);
    let commondir = fs::read_to_string(gitdir.join("commondir")).ok()?;
    let common = gitdir.join(commondir.trim());
    let common = common.canonicalize().unwrap_or(common);
    common.parent().and_then(folder_name)
}

fn named(root: &Path, source: ProjectSource) -> Option<ResolvedProject> {
    folder_name(root).map(|name| ResolvedProject {
        name,
        root: root.to_path_buf(),
        source,
    })
}

fn folder_name(path: &Path) -> Option<String> {
    path.file_name()
        .map(|name| name.to_string_lossy().trim().to_string())
        .filter(|name| !name.is_empty())
}

/// Folders that are containers of projects, never projects themselves.
struct DeniedRoots {
    home: Option<PathBuf>,
    exact: Vec<PathBuf>,
}

impl DeniedRoots {
    fn current() -> &'static Self {
        static CURRENT: std::sync::OnceLock<DeniedRoots> = std::sync::OnceLock::new();
        CURRENT.get_or_init(|| Self::new(dirs::home_dir(), std::env::temp_dir()))
    }

    fn new(home: Option<PathBuf>, temp_dir: PathBuf) -> Self {
        let mut exact = vec![
            PathBuf::from("/tmp"),
            PathBuf::from("/private/tmp"),
            PathBuf::from("/var/tmp"),
            PathBuf::from("/private/var/tmp"),
            PathBuf::from("/var/folders"),
            PathBuf::from("/private/var/folders"),
            temp_dir,
        ];
        // Resolve the temp symlinks (`/tmp` → `/private/tmp`, `/var` → `/private/var`)
        // once. Home children are compared literally so this never touches a
        // TCC-protected folder.
        let canonical: Vec<PathBuf> = exact
            .iter()
            .filter_map(|path| path.canonicalize().ok())
            .collect();
        exact.extend(canonical);
        if let Some(home) = home.as_ref() {
            for child in [".claude", ".codex", "Desktop", "Documents", "Downloads"] {
                exact.push(home.join(child));
            }
        }
        Self { home, exact }
    }

    fn contains(&self, path: &Path) -> bool {
        // `/`, `/Users` and `$HOME` itself are all ancestors-or-self of home.
        if self
            .home
            .as_ref()
            .is_some_and(|home| home.starts_with(path))
        {
            return true;
        }
        path.parent().is_none() || self.exact.iter().any(|denied| denied == path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(label: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "wakaclock-project-test-{label}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(&path).unwrap();
            // Canonical so comparisons survive macOS's `/var` → `/private/var` link.
            TempDir(path.canonicalize().unwrap())
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn write(path: &Path, content: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    fn run_git(dir: &Path, args: &[&str]) {
        let status = Command::new("git")
            .args(args)
            .current_dir(dir)
            .env("GIT_AUTHOR_NAME", "test")
            .env("GIT_AUTHOR_EMAIL", "test@example.com")
            .env("GIT_COMMITTER_NAME", "test")
            .env("GIT_COMMITTER_EMAIL", "test@example.com")
            .status()
            .expect("run git");
        assert!(status.success(), "git {args:?} failed in {dir:?}");
    }

    /// A repository shaped like this one: no manifest at the root, manifests in subfolders.
    fn monorepo_without_root_manifest(tmp: &TempDir) -> PathBuf {
        let repo = tmp.0.join("wakaclock");
        fs::create_dir_all(repo.join(".git")).unwrap();
        write(
            &repo.join("backend/api/Cargo.toml"),
            "[workspace]\nmembers = []\n",
        );
        write(
            &repo.join("backend/api/crates/wakaclock-core/Cargo.toml"),
            "[package]\nname = \"wakaclock-core\"\n",
        );
        write(
            &repo.join("extensions/vscode/package.json"),
            r#"{"name":"atoaxis-vscode"}"#,
        );
        write(&repo.join("frontend/app/package.json"), r#"{"name":"app"}"#);
        repo
    }

    fn name(entity: &Path, hint: Option<&Path>) -> Option<String> {
        resolve_project(entity, hint).map(|resolved| resolved.name)
    }

    #[test]
    fn nested_crate_manifest_inside_a_git_repo_reports_the_repository() {
        let tmp = TempDir::new("nested-crate");
        let repo = monorepo_without_root_manifest(&tmp);
        let entity = repo.join("backend/api/crates/wakaclock-core/src/ai/codex.rs");
        write(&entity, "fn main() {}\n");

        let resolved = resolve_project(&entity, None).unwrap();
        assert_eq!(resolved.name, "wakaclock");
        assert_eq!(resolved.root, repo);
        assert_eq!(resolved.source, ProjectSource::Git);
    }

    #[test]
    fn nested_package_json_inside_a_git_repo_reports_the_repository() {
        let tmp = TempDir::new("nested-package");
        let repo = monorepo_without_root_manifest(&tmp);

        assert_eq!(
            name(&repo.join("extensions/vscode/src/buffer.ts"), None),
            Some("wakaclock".to_string())
        );
        assert_eq!(
            name(&repo.join("frontend/app/lib/wakaclock/types.ts"), None),
            Some("wakaclock".to_string())
        );
    }

    #[test]
    fn file_at_a_repo_root_without_a_manifest_reports_the_repository() {
        let tmp = TempDir::new("root-file");
        let repo = monorepo_without_root_manifest(&tmp);

        assert_eq!(
            name(&repo.join("WAKACLOCK-DURATION-SMOKE.md"), None),
            Some("wakaclock".to_string())
        );
    }

    #[test]
    fn deleted_file_inside_a_repo_still_reports_the_repository() {
        let tmp = TempDir::new("deleted-file");
        let repo = monorepo_without_root_manifest(&tmp);
        let missing = repo.join("frontend/app/lib/removed/ga.ts");
        assert!(!missing.exists());

        assert_eq!(name(&missing, None), Some("wakaclock".to_string()));
    }

    #[test]
    fn a_subfolder_hint_never_outranks_the_git_repository() {
        let tmp = TempDir::new("subfolder-hint");
        let repo = monorepo_without_root_manifest(&tmp);
        let hint = repo.join("backend/api");

        assert_eq!(
            name(
                &repo.join("backend/api/crates/wakaclock-core/src/lib.rs"),
                Some(&hint)
            ),
            Some("wakaclock".to_string())
        );
        assert_eq!(
            name(
                &repo.join("extensions/vscode/src/cli.ts"),
                Some(&repo.join("extensions/vscode"))
            ),
            Some("wakaclock".to_string())
        );
    }

    #[test]
    fn linked_worktree_reports_the_main_repository_and_its_own_root() {
        let tmp = TempDir::new("worktree");
        let main_repo = tmp.0.join("wakaclock");
        fs::create_dir_all(&main_repo).unwrap();
        run_git(&main_repo, &["init", "-q", "-b", "main"]);
        write(&main_repo.join("README.md"), "hello");
        run_git(&main_repo, &["add", "README.md"]);
        run_git(&main_repo, &["commit", "-q", "-m", "init"]);
        let worktree = main_repo.join(".worktrees/phase8");
        run_git(
            &main_repo,
            &[
                "worktree",
                "add",
                "-q",
                "-b",
                "phase8",
                worktree.to_str().unwrap(),
            ],
        );
        write(
            &worktree.join("backend/api/crates/wakaclock-core/Cargo.toml"),
            "[package]\nname = \"wakaclock-core\"\n",
        );
        let entity = worktree.join("backend/api/crates/wakaclock-core/src/ai/dedup.rs");

        let resolved = resolve_project(&entity, None).unwrap();
        assert_eq!(resolved.name, "wakaclock");
        assert_eq!(resolved.root, worktree);

        let gix = crate::git::discover(entity.to_str().unwrap()).unwrap();
        assert_eq!(resolved.name, gix.project, "must agree with git::discover");
    }

    #[test]
    fn main_checkout_agrees_with_git_discover() {
        let tmp = TempDir::new("parity");
        let repo = tmp.0.join("AI-tiktok");
        fs::create_dir_all(&repo).unwrap();
        run_git(&repo, &["init", "-q", "-b", "main"]);
        let entity = repo.join("ai-affiliate-studio/package.json");
        write(&entity, r#"{"name":"ai-affiliate-studio"}"#);

        let gix = crate::git::discover(entity.to_str().unwrap()).unwrap();
        assert_eq!(name(&entity, None), Some(gix.project));
        assert_eq!(name(&entity, None), Some("AI-tiktok".to_string()));
    }

    #[test]
    fn loose_files_in_temp_and_agent_state_folders_have_no_project() {
        let home = PathBuf::from("/Users/example");
        let denied = DeniedRoots::new(Some(home.clone()), PathBuf::from("/var/folders/x/T"));

        for path in [
            PathBuf::from("/"),
            PathBuf::from("/Users"),
            home.clone(),
            home.join(".claude"),
            home.join(".codex"),
            home.join("Desktop"),
            PathBuf::from("/tmp"),
            PathBuf::from("/private/tmp"),
            PathBuf::from("/var/folders/x/T"),
        ] {
            assert!(denied.contains(&path), "{path:?} must be denied");
        }
        assert!(!denied.contains(&home.join("Desktop/wakaclock")));
        assert!(!denied.contains(&PathBuf::from("/private/tmp/wk-t2")));

        assert_eq!(
            name(
                Path::new("/private/tmp/loose-smoke.txt"),
                Some(Path::new("/private/tmp"))
            ),
            None
        );
        if let Some(real_home) = dirs::home_dir() {
            let plan = real_home.join(".claude/plans/no-such-plan-for-test.md");
            assert_eq!(name(&plan, Some(&real_home.join(".claude/plans"))), None);
        }
    }

    #[test]
    fn non_git_monorepo_root_wins_over_nested_package_names() {
        let tmp = TempDir::new("non-git-monorepo");
        let root = tmp.0.join("monorepo");
        let nested = root
            .join("apps/desktop/node_modules/ibm-plex-sans-thai/src")
            .join("styles.css");
        write(
            &root.join("pnpm-workspace.yaml"),
            "packages:\n  - 'apps/*'\n",
        );
        write(
            &root.join("package.json"),
            r#"{"private":true,"workspaces":["apps/*"]}"#,
        );
        write(
            &root.join("apps/desktop/node_modules/ibm-plex-sans-thai/package.json"),
            r#"{"name":"ibm-plex-sans-thai"}"#,
        );
        write(&nested, "body {}\n");

        let resolved = resolve_project(&nested, None).unwrap();
        assert_eq!(resolved.name, "monorepo");
        assert_eq!(resolved.source, ProjectSource::Workspace);
    }

    #[test]
    fn plain_non_git_package_uses_its_package_root() {
        let tmp = TempDir::new("plain-package");
        let root = tmp.0.join("testatoaxis");
        let nested = root.join("src/lib.ts");
        write(&root.join("package.json"), r#"{"name":"plain-project"}"#);
        write(&nested, "export {};\n");

        let resolved = resolve_project(&nested, None).unwrap();
        assert_eq!(resolved.name, "testatoaxis");
        assert_eq!(resolved.source, ProjectSource::Manifest);
    }

    #[test]
    fn non_git_hint_with_a_manifest_outranks_a_nested_package() {
        let tmp = TempDir::new("non-git-hint");
        let root = tmp.0.join("testatoaxis");
        write(&root.join("package.json"), r#"{"name":"testatoaxis"}"#);
        write(
            &root.join("packages/probe/package.json"),
            r#"{"name":"probe"}"#,
        );
        let entity = root.join("packages/probe/src/index.js");

        assert_eq!(name(&entity, None), Some("probe".to_string()));
        assert_eq!(name(&entity, Some(&root)), Some("testatoaxis".to_string()));
        // A hint that does not contain the entity is ignored.
        assert_eq!(
            name(&entity, Some(&tmp.0.join("elsewhere"))),
            Some("probe".to_string())
        );
    }

    #[test]
    fn non_git_folder_without_markers_has_no_project() {
        let tmp = TempDir::new("no-markers");
        let entity = tmp.0.join("notes/scratch.txt");
        write(&entity, "x");

        assert_eq!(resolve_project(&entity, Some(&tmp.0.join("notes"))), None);
    }
}

// crates/wakaclock-core/src/git.rs

use std::path::{Path, PathBuf};

pub struct GitInfo {
    pub project: String, // ชื่อ repo หลัก (ไม่ใช่ชื่อโฟลเดอร์ของ linked worktree)
    pub branch: String,  // branch ของ worktree ที่กำลังแก้ไขอยู่จริง
    pub root: PathBuf,   // working-tree root ของ worktree ปัจจุบัน
}

/// หา repo จาก path ของไฟล์ที่กำลังแก้ ผ่าน `gix` แทนการเดินหาโฟลเดอร์ที่มี `.git` เอง
///
/// เหตุผลที่ต้องใช้ `gix`: `.git` ของ linked worktree (`git worktree add`) เป็น**ไฟล์**
/// (`gitdir: .../.git/worktrees/<name>`) ไม่ใช่ repo แยกกัน การเดินขึ้นไปเรื่อย ๆ แล้วหยุดที่
/// `.git` ตัวแรกที่เจอ (ไม่ว่าจะเป็นไฟล์หรือโฟลเดอร์) จะตั้งชื่อ project ตามชื่อโฟลเดอร์ของ
/// worktree นั้นแทนที่จะเป็นชื่อ repo จริง ทำให้ repo เดียวกันถูกนับเป็นหลาย project ใน
/// dashboard ทั้งที่ผู้ใช้ทำงานอยู่ใน repo เดียวตลอด
///
/// `project` จึงต้องมาจาก `common_dir()` เสมอ — gix เอกสารว่าคืน "the main git repository
/// if this is a repository on a linked work-tree, or the git_dir itself" — ส่วน `branch`
/// ยังคงอ่านจาก HEAD ของ worktree ปัจจุบันจริง ๆ ไม่ปนกัน
pub fn discover(entity_path: &str) -> Option<GitInfo> {
    let path = Path::new(entity_path);

    // ถ้า entity เป็นไฟล์ ให้เริ่มจาก parent folder
    let start = if path.is_file() {
        path.parent()?
    } else {
        path
    };

    let repo = gix::discover(start).ok()?;

    // `common_dir()` may contain literal `..` components (e.g. a linked worktree's
    // common dir is reported as `.../.git/worktrees/<name>/../..`) — `Path::parent()`/
    // `file_name()` operate on syntax, not semantics, so an unresolved `..` segment
    // must be canonicalized away before deriving the project name from it.
    let common_dir = repo
        .common_dir()
        .canonicalize()
        .unwrap_or_else(|_| repo.common_dir().to_path_buf());
    let project_root = common_dir.parent().unwrap_or(&common_dir);
    let project = project_root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let root = repo
        .work_dir()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| project_root.to_path_buf());

    Some(GitInfo {
        project,
        branch: current_branch_name(&repo),
        root,
    })
}

/// ชื่อ branch ปัจจุบัน หรือ commit hash ย่อ 7 ตัวถ้าอยู่ใน detached HEAD
fn current_branch_name(repo: &gix::Repository) -> String {
    match repo.head_name() {
        Ok(Some(name)) => name.shorten().to_string(),
        _ => repo
            .head_id()
            .map(|id| id.to_hex_with_len(7).to_string())
            .unwrap_or_else(|_| "main".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(label: &str) -> Self {
            let unique = format!(
                "wakaclock-git-test-{label}-{}-{:?}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            );
            let path = std::env::temp_dir().join(unique);
            fs::create_dir_all(&path).expect("create temp dir");
            TempDir(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
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
        assert!(status.success(), "git {:?} failed in {:?}", args, dir);
    }

    #[test]
    fn linked_worktree_reports_main_repo_as_project_but_keeps_own_branch() {
        let tmp = TempDir::new("worktree");
        // ตั้งชื่อ repo หลักไม่ตรงกับชื่อ branch ของ worktree เพื่อพิสูจน์ว่าไม่ได้ปนกัน
        let main_repo = tmp.0.join("wakaclock");
        fs::create_dir_all(&main_repo).unwrap();

        run_git(&main_repo, &["init", "-q", "-b", "main"]);
        fs::write(main_repo.join("README.md"), "hello").unwrap();
        run_git(&main_repo, &["add", "README.md"]);
        run_git(&main_repo, &["commit", "-q", "-m", "init"]);

        let worktree_path = tmp.0.join("wk-t5");
        run_git(
            &main_repo,
            &[
                "worktree",
                "add",
                "-b",
                "feature/t5",
                worktree_path.to_str().unwrap(),
            ],
        );

        let entity = worktree_path.join("README.md");
        let info = discover(entity.to_str().unwrap()).expect("discover succeeds");

        assert_eq!(
            info.project, "wakaclock",
            "project must be the main repo's name, not the linked worktree's own folder name"
        );
        assert_eq!(info.branch, "feature/t5");
    }

    #[test]
    fn main_worktree_still_reports_its_own_name_and_branch() {
        let tmp = TempDir::new("main-only");
        let repo = tmp.0.join("wakaclock");
        fs::create_dir_all(&repo).unwrap();

        run_git(&repo, &["init", "-q", "-b", "main"]);
        fs::write(repo.join("README.md"), "hello").unwrap();
        run_git(&repo, &["add", "README.md"]);
        run_git(&repo, &["commit", "-q", "-m", "init"]);

        let entity = repo.join("README.md");
        let info = discover(entity.to_str().unwrap()).expect("discover succeeds");

        assert_eq!(info.project, "wakaclock");
        assert_eq!(info.branch, "main");
    }

    #[test]
    fn non_git_path_returns_none() {
        let tmp = TempDir::new("no-git");
        let entity = tmp.0.join("scratch.txt");
        fs::write(&entity, "no repo here").unwrap();

        assert!(discover(entity.to_str().unwrap()).is_none());
    }
}

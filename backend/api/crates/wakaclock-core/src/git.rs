// crates/wakaclock-core/src/git.rs

use std::path::{Path, PathBuf};

pub struct GitInfo {
    pub project: String, // ชื่อ project = ชื่อโฟลเดอร์ root
    pub branch: String,  // ชื่อ branch ปัจจุบัน
    pub root: PathBuf,   // path ของ .git folder
}

/// หา .git จาก path ของไฟล์ที่กำลังแก้
/// เดินขึ้นไปเรื่อยๆ จนเจอโฟลเดอร์ที่มี .git อยู่
pub fn discover(entity_path: &str) -> Option<GitInfo> {
    let path = Path::new(entity_path);

    // ถ้า entity เป็นไฟล์ ให้เริ่มจาก parent folder
    let start = if path.is_file() {
        path.parent()?.to_path_buf()
    } else {
        path.to_path_buf()
    };

    // เดินขึ้นไปเรื่อยๆ จนเจอ .git
    let mut current = start.as_path();
    loop {
        let git_dir = current.join(".git");
        if git_dir.exists() {
            let project = current
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            let branch = read_branch(&git_dir).unwrap_or("main".to_string());

            return Some(GitInfo {
                project,
                branch,
                root: current.to_path_buf(),
            });
        }

        // ขึ้นไป parent
        match current.parent() {
            Some(parent) => current = parent,
            None => return None, // ถึง root แล้วไม่เจอ .git
        }
    }
}

/// อ่าน branch ปัจจุบันจาก .git/HEAD
fn read_branch(git_dir: &Path) -> Option<String> {
    let head_path = git_dir.join("HEAD");
    let content = std::fs::read_to_string(head_path).ok()?;

    // HEAD มีเนื้อหาแบบนี้: "ref: refs/heads/main\n"
    let content = content.trim();
    if content.starts_with("ref: refs/heads/") {
        let branch = content.strip_prefix("ref: refs/heads/")?.to_string();
        Some(branch)
    } else {
        // detached HEAD state — ใช้ commit hash แทน
        Some(content.chars().take(7).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discover_from_file() {
        // ทดสอบกับไฟล์ในโปรเจกต์ตัวเอง
        let result = discover("src/main.rs");
        // ถ้าไม่ได้รันใน git repo จะได้ None ซึ่ง ok
        println!("Git info: {:?}", result.map(|g| g.project));
    }
}

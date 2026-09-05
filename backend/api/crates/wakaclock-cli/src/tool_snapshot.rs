use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap, HashSet},
    fs,
    io::{self, BufReader, Read},
    path::{Path, PathBuf},
    process::Command,
    time::UNIX_EPOCH,
};

const MAX_SNAPSHOT_FILES: usize = 20_000;
const EXCLUDED_DIRS: &[&str] = &[
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

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AiToolInput {
    pub tool_event_id: String,
    pub agent: String,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub tool: Option<String>,
    #[serde(default)]
    pub transport: Option<String>,
    #[serde(default)]
    pub workspace_root: Option<PathBuf>,
    #[serde(default)]
    pub cwd: Option<PathBuf>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct FileFingerprint {
    pub size: u64,
    pub modified_ns: u128,
    pub content_hash: String,
    pub line_count: Option<u32>,
    pub tracked: bool,
    pub dirty_before: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ToolSnapshot {
    pub tool_event_id: String,
    pub agent: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub session_id: Option<String>,
    pub tool: Option<String>,
    pub transport: Option<String>,
    pub workspace_root: PathBuf,
    pub started_at: DateTime<Utc>,
    pub files: BTreeMap<String, FileFingerprint>,
    pub git_backed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkspaceChangeKind {
    Created,
    Modified,
    Deleted,
    Renamed,
}

impl WorkspaceChangeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Modified => "modified",
            Self::Deleted => "deleted",
            Self::Renamed => "renamed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceChange {
    pub kind: WorkspaceChangeKind,
    pub entity: PathBuf,
    pub previous_entity: Option<PathBuf>,
    pub lines_added: Option<u32>,
    pub lines_deleted: Option<u32>,
}

pub fn validate_input(input: &AiToolInput) -> Result<(), String> {
    if input.tool_event_id.trim().is_empty() {
        return Err("tool_event_id must not be empty".to_string());
    }
    if input.agent.trim().is_empty() {
        return Err("agent must not be empty".to_string());
    }
    Ok(())
}

pub fn capture(input: &AiToolInput) -> Result<ToolSnapshot, Box<dyn std::error::Error>> {
    validate_input(input).map_err(io::Error::other)?;
    let requested_root = input
        .workspace_root
        .as_deref()
        .or(input.cwd.as_deref())
        .unwrap_or(Path::new("."));
    let requested_root = absolutize(requested_root)?;
    let git_root = discover_git_root(&requested_root);
    let (workspace_root, git_backed) = match git_root {
        Some(root) => (root, true),
        None => (requested_root, false),
    };
    capture_at_root(input, workspace_root, git_backed, Utc::now())
}

pub fn capture_for_existing(
    input: &AiToolInput,
    previous: &ToolSnapshot,
) -> Result<ToolSnapshot, Box<dyn std::error::Error>> {
    capture_at_root(
        input,
        previous.workspace_root.clone(),
        previous.git_backed,
        previous.started_at,
    )
}

fn capture_at_root(
    input: &AiToolInput,
    workspace_root: PathBuf,
    git_backed: bool,
    started_at: DateTime<Utc>,
) -> Result<ToolSnapshot, Box<dyn std::error::Error>> {
    if !workspace_root.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("workspace does not exist: {}", workspace_root.display()),
        )
        .into());
    }

    let index_hashes = if git_backed {
        git_index_hashes(&workspace_root)?
    } else {
        HashMap::new()
    };
    let tracked: BTreeSet<PathBuf> = index_hashes.keys().map(PathBuf::from).collect();
    let dirty = if git_backed {
        git_dirty_paths(&workspace_root)?
    } else {
        HashSet::new()
    };
    let candidates = if git_backed {
        git_paths(
            &workspace_root,
            &[
                "ls-files",
                "--cached",
                "--others",
                "--exclude-standard",
                "-z",
            ],
        )?
    } else {
        recursive_files(&workspace_root)?
    };

    let working_hashes = if git_backed {
        let needs_hash: Vec<PathBuf> = candidates
            .iter()
            .filter(|relative| {
                let key = comparable_relative(relative);
                !tracked.contains(*relative) || dirty.contains(&key)
            })
            .cloned()
            .collect();
        git_hash_objects(&workspace_root, &needs_hash)?
    } else {
        HashMap::new()
    };

    if candidates.len() > MAX_SNAPSHOT_FILES {
        return Err(io::Error::other(format!(
            "workspace snapshot contains {} files; safety limit is {MAX_SNAPSHOT_FILES}",
            candidates.len()
        ))
        .into());
    }

    let mut files = BTreeMap::new();
    for relative in candidates {
        let full = workspace_root.join(&relative);
        // Never follow a tracked/untracked symlink outside the workspace while building
        // privacy-sensitive attribution metadata. Symlink target changes are left
        // unattributed rather than reading arbitrary external files.
        let metadata = match fs::symlink_metadata(&full) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error.into()),
        };
        if !metadata.file_type().is_file() {
            continue;
        }
        let key = comparable_relative(&relative);
        let is_tracked = tracked.contains(&relative);
        let is_dirty = dirty.contains(&key);
        let mut fingerprint = if git_backed && is_tracked && !is_dirty {
            // Clean tracked content is already hashed by Git. Reusing the index blob id
            // avoids opening every source file on every shell command; if the file is
            // later modified, Git marks it dirty and the AfterTool snapshot hashes the
            // working-tree bytes instead.
            FileFingerprint {
                // Git's index blob is the authoritative content identity for a clean
                // tracked path, so no per-file stat/read is needed on the hot BeforeTool
                // path. Dirty/untracked entries still carry real size/mtime metadata.
                size: 0,
                modified_ns: 0,
                content_hash: index_hashes
                    .get(&key)
                    .cloned()
                    .ok_or_else(|| io::Error::other(format!("missing Git index hash for {key}")))?,
                line_count: None,
                tracked: true,
                dirty_before: false,
            }
        } else {
            let mut value = fingerprint_file(&full)?;
            if git_backed {
                if let Some(git_hash) = working_hashes.get(&key) {
                    value.content_hash = git_hash.clone();
                }
            }
            value
        };
        fingerprint.tracked = is_tracked;
        fingerprint.dirty_before = is_dirty;
        files.insert(key, fingerprint);
    }

    Ok(ToolSnapshot {
        tool_event_id: input.tool_event_id.trim().to_string(),
        agent: input.agent.trim().to_string(),
        provider: trimmed(input.provider.clone()),
        model: trimmed(input.model.clone()),
        session_id: trimmed(input.session_id.clone()),
        tool: trimmed(input.tool.clone()),
        transport: trimmed(input.transport.clone()),
        workspace_root,
        started_at,
        files,
        git_backed,
    })
}

pub fn diff(
    before: &ToolSnapshot,
    after: &ToolSnapshot,
) -> Result<Vec<WorkspaceChange>, Box<dyn std::error::Error>> {
    if before.workspace_root != after.workspace_root {
        return Err(io::Error::other("tool snapshots belong to different workspaces").into());
    }

    let before_paths: BTreeSet<&String> = before.files.keys().collect();
    let after_paths: BTreeSet<&String> = after.files.keys().collect();
    let mut deleted: Vec<String> = before_paths
        .difference(&after_paths)
        .map(|value| (*value).clone())
        .collect();
    let mut created: Vec<String> = after_paths
        .difference(&before_paths)
        .map(|value| (*value).clone())
        .collect();

    let mut changes = Vec::new();
    for path in before_paths.intersection(&after_paths) {
        let old = &before.files[*path];
        let new = &after.files[*path];
        if old.content_hash != new.content_hash {
            let (lines_added, lines_deleted) = line_delta_if_safe(before, path, old)?;
            changes.push(WorkspaceChange {
                kind: WorkspaceChangeKind::Modified,
                entity: before.workspace_root.join(path),
                previous_entity: None,
                lines_added,
                lines_deleted,
            });
        }
    }

    // A pure move preserves the content hash. Only infer a rename when the hash maps
    // one-to-one; identical generated files are ambiguous and remain create+delete.
    let mut deleted_by_hash: HashMap<&str, Vec<String>> = HashMap::new();
    for path in &deleted {
        deleted_by_hash
            .entry(before.files[path].content_hash.as_str())
            .or_default()
            .push(path.clone());
    }
    let mut created_by_hash: HashMap<&str, Vec<String>> = HashMap::new();
    for path in &created {
        created_by_hash
            .entry(after.files[path].content_hash.as_str())
            .or_default()
            .push(path.clone());
    }

    let mut renamed_deleted = HashSet::new();
    let mut renamed_created = HashSet::new();
    for (hash, old_paths) in &deleted_by_hash {
        let Some(new_paths) = created_by_hash.get(hash) else {
            continue;
        };
        if old_paths.len() == 1 && new_paths.len() == 1 {
            let old_path = &old_paths[0];
            let new_path = &new_paths[0];
            renamed_deleted.insert(old_path.clone());
            renamed_created.insert(new_path.clone());
            changes.push(WorkspaceChange {
                kind: WorkspaceChangeKind::Renamed,
                entity: before.workspace_root.join(new_path),
                previous_entity: Some(before.workspace_root.join(old_path)),
                lines_added: Some(0),
                lines_deleted: Some(0),
            });
        }
    }

    deleted.retain(|path| !renamed_deleted.contains(path));
    created.retain(|path| !renamed_created.contains(path));

    for path in deleted {
        let old = &before.files[&path];
        let (_, proven_deleted) = line_delta_if_safe(before, &path, old)?;
        changes.push(WorkspaceChange {
            kind: WorkspaceChangeKind::Deleted,
            entity: before.workspace_root.join(&path),
            previous_entity: None,
            lines_added: Some(0),
            lines_deleted: proven_deleted.or(old.line_count),
        });
    }
    for path in created {
        let new = &after.files[&path];
        changes.push(WorkspaceChange {
            kind: WorkspaceChangeKind::Created,
            entity: before.workspace_root.join(&path),
            previous_entity: None,
            lines_added: new.line_count,
            lines_deleted: Some(0),
        });
    }

    changes.sort_by(|left, right| left.entity.cmp(&right.entity));
    Ok(changes)
}

fn line_delta_if_safe(
    snapshot: &ToolSnapshot,
    relative: &str,
    old: &FileFingerprint,
) -> Result<(Option<u32>, Option<u32>), Box<dyn std::error::Error>> {
    if !snapshot.git_backed || !old.tracked || old.dirty_before {
        return Ok((None, None));
    }
    let output = Command::new("git")
        .arg("-C")
        .arg(&snapshot.workspace_root)
        .args(["diff", "--numstat", "HEAD", "--"])
        .arg(relative)
        .output()?;
    if !output.status.success() {
        return Ok((None, None));
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let Some(line) = text.lines().next() else {
        return Ok((None, None));
    };
    let mut parts = line.split('\t');
    let Some(added) = parts.next().and_then(|value| value.parse::<u32>().ok()) else {
        return Ok((None, None));
    };
    let Some(deleted) = parts.next().and_then(|value| value.parse::<u32>().ok()) else {
        return Ok((None, None));
    };
    Ok((Some(added), Some(deleted)))
}

pub fn stable_change_event_id(tool_event_id: &str, change: &WorkspaceChange) -> String {
    let mut hasher = Sha256::new();
    hasher.update(tool_event_id.as_bytes());
    hasher.update([0]);
    hasher.update(change.kind.as_str().as_bytes());
    hasher.update([0]);
    hasher.update(change.entity.to_string_lossy().as_bytes());
    if let Some(previous) = &change.previous_entity {
        hasher.update([0]);
        hasher.update(previous.to_string_lossy().as_bytes());
    }
    format!("tool:{}", hex_digest(hasher.finalize().as_slice()))
}

fn fingerprint_file(path: &Path) -> Result<FileFingerprint, io::Error> {
    let metadata = fs::metadata(path)?;
    let modified_ns = modified_ns(&metadata);
    let file = fs::File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    let mut newline_count = 0u32;
    let mut saw_bytes = false;
    let mut last_byte = 0u8;
    let mut binary = false;
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        let chunk = &buffer[..read];
        hasher.update(chunk);
        if chunk.contains(&0) {
            binary = true;
        }
        newline_count = newline_count
            .saturating_add(chunk.iter().filter(|&&byte| byte == b'\n').count() as u32);
        saw_bytes = true;
        last_byte = chunk[read - 1];
    }
    let line_count = if binary {
        None
    } else if !saw_bytes {
        Some(0)
    } else if last_byte == b'\n' {
        Some(newline_count)
    } else {
        Some(newline_count.saturating_add(1))
    };
    Ok(FileFingerprint {
        size: metadata.len(),
        modified_ns,
        content_hash: hex_digest(hasher.finalize().as_slice()),
        line_count,
        tracked: false,
        dirty_before: false,
    })
}

fn hex_digest(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(output, "{byte:02x}");
    }
    output
}

fn modified_ns(metadata: &fs::Metadata) -> u128 {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_nanos())
        .unwrap_or(0)
}

fn git_index_hashes(root: &Path) -> Result<HashMap<String, String>, io::Error> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["ls-files", "-s", "-z"])
        .output()?;
    if !output.status.success() {
        return Err(io::Error::other(
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }
    let mut hashes = HashMap::new();
    for record in output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let Some(tab) = record.iter().position(|byte| *byte == b'\t') else {
            continue;
        };
        let header = String::from_utf8_lossy(&record[..tab]);
        let mut fields = header.split_whitespace();
        let _mode = fields.next();
        let Some(hash) = fields.next() else { continue };
        let path = String::from_utf8_lossy(&record[tab + 1..]).into_owned();
        hashes.insert(comparable_relative(Path::new(&path)), hash.to_string());
    }
    Ok(hashes)
}

fn git_hash_objects(root: &Path, paths: &[PathBuf]) -> Result<HashMap<String, String>, io::Error> {
    let mut hashes = HashMap::new();
    for chunk in paths.chunks(256) {
        if chunk.is_empty() {
            continue;
        }
        let mut command = Command::new("git");
        command.arg("-C").arg(root).arg("hash-object").arg("--");
        for path in chunk {
            command.arg(path);
        }
        let output = command.output()?;
        if !output.status.success() {
            return Err(io::Error::other(
                String::from_utf8_lossy(&output.stderr).into_owned(),
            ));
        }
        let text = std::str::from_utf8(&output.stdout).map_err(io::Error::other)?;
        let values: Vec<&str> = text.lines().collect();
        if values.len() != chunk.len() {
            return Err(io::Error::other(
                "git hash-object returned an unexpected number of hashes",
            ));
        }
        for (path, hash) in chunk.iter().zip(values) {
            hashes.insert(comparable_relative(path), hash.trim().to_string());
        }
    }
    Ok(hashes)
}

fn discover_git_root(path: &Path) -> Option<PathBuf> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let root = String::from_utf8(output.stdout).ok()?;
    let root = root.trim();
    (!root.is_empty()).then(|| PathBuf::from(root))
}

fn git_paths(root: &Path, args: &[&str]) -> Result<BTreeSet<PathBuf>, io::Error> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()?;
    if !output.status.success() {
        return Err(io::Error::other(
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }
    Ok(output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|bytes| !bytes.is_empty())
        .map(|bytes| PathBuf::from(String::from_utf8_lossy(bytes).into_owned()))
        .collect())
}

fn git_dirty_paths(root: &Path) -> Result<HashSet<String>, io::Error> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["status", "--porcelain=v1", "-z", "--untracked-files=normal"])
        .output()?;
    if !output.status.success() {
        return Err(io::Error::other(
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }
    let records: Vec<&[u8]> = output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
        .collect();
    let mut dirty = HashSet::new();
    let mut index = 0usize;
    while index < records.len() {
        let record = records[index];
        if record.len() < 4 {
            index += 1;
            continue;
        }
        let status = &record[..2];
        let path = String::from_utf8_lossy(&record[3..]).into_owned();
        dirty.insert(comparable_relative(Path::new(&path)));
        if (status.contains(&b'R') || status.contains(&b'C')) && index + 1 < records.len() {
            index += 1;
            let other = String::from_utf8_lossy(records[index]).into_owned();
            dirty.insert(comparable_relative(Path::new(&other)));
        }
        index += 1;
    }
    Ok(dirty)
}

fn recursive_files(root: &Path) -> Result<BTreeSet<PathBuf>, io::Error> {
    let mut output = BTreeSet::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(directory) = stack.pop() {
        for entry in fs::read_dir(&directory)? {
            let entry = entry?;
            let path = entry.path();
            let file_type = entry.file_type()?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                let name = entry.file_name();
                if EXCLUDED_DIRS.iter().any(|excluded| name == *excluded) {
                    continue;
                }
                stack.push(path);
            } else if file_type.is_file() {
                if let Ok(relative) = path.strip_prefix(root) {
                    output.insert(relative.to_path_buf());
                    if output.len() > MAX_SNAPSHOT_FILES {
                        return Ok(output);
                    }
                }
            }
        }
    }
    Ok(output)
}

fn absolutize(path: &Path) -> Result<PathBuf, io::Error> {
    if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        Ok(std::env::current_dir()?.join(path))
    }
}

fn comparable_relative(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn trimmed(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let value = value.trim();
        (!value.is_empty()).then(|| value.to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "wakaclock-tool-snapshot-{}-{label}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn input(root: &Path) -> AiToolInput {
        AiToolInput {
            tool_event_id: "tool-1".to_string(),
            agent: "claude-code".to_string(),
            provider: Some("anthropic".to_string()),
            model: None,
            session_id: Some("session-1".to_string()),
            tool: Some("Bash".to_string()),
            transport: Some("shell_hook".to_string()),
            workspace_root: Some(root.to_path_buf()),
            cwd: None,
        }
    }

    fn init_git(root: &Path) {
        for args in [
            vec!["init"],
            vec!["config", "user.email", "wakaclock-test@example.invalid"],
            vec!["config", "user.name", "WakaClock Test"],
        ] {
            let status = Command::new("git")
                .arg("-C")
                .arg(root)
                .args(args)
                .status()
                .unwrap();
            assert!(status.success());
        }
    }

    fn commit_all(root: &Path) {
        for args in [vec!["add", "."], vec!["commit", "-m", "baseline"]] {
            let status = Command::new("git")
                .arg("-C")
                .arg(root)
                .args(args)
                .status()
                .unwrap();
            assert!(status.success());
        }
    }

    #[test]
    fn clean_git_file_gets_exact_numstat_delta() {
        let root = temp_dir("git-clean-delta");
        init_git(&root);
        fs::write(root.join("a.txt"), "one\ntwo\n").unwrap();
        commit_all(&root);
        let before = capture(&input(&root)).unwrap();
        fs::write(root.join("a.txt"), "one\nchanged\nthree\n").unwrap();
        let after = capture_for_existing(&input(&root), &before).unwrap();
        let changes = diff(&before, &after).unwrap();
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].lines_added, Some(2));
        assert_eq!(changes[0].lines_deleted, Some(1));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn preexisting_dirty_git_file_keeps_modified_line_delta_unknown() {
        let root = temp_dir("git-dirty-delta");
        init_git(&root);
        fs::write(root.join("a.txt"), "base\n").unwrap();
        commit_all(&root);
        fs::write(root.join("a.txt"), "human-before-ai\n").unwrap();
        let before = capture(&input(&root)).unwrap();
        fs::write(root.join("a.txt"), "human-before-ai\nai-change\n").unwrap();
        let after = capture_for_existing(&input(&root), &before).unwrap();
        let changes = diff(&before, &after).unwrap();
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, WorkspaceChangeKind::Modified);
        assert_eq!(changes[0].lines_added, None);
        assert_eq!(changes[0].lines_deleted, None);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn detects_modified_file_even_when_it_was_already_present() {
        let root = temp_dir("modify");
        fs::write(root.join("a.txt"), "before\n").unwrap();
        let before = capture(&input(&root)).unwrap();
        fs::write(root.join("a.txt"), "after\n").unwrap();
        let after = capture_for_existing(&input(&root), &before).unwrap();
        let changes = diff(&before, &after).unwrap();
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, WorkspaceChangeKind::Modified);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn detects_create_and_delete_with_exact_whole_file_line_counts() {
        let root = temp_dir("create-delete");
        fs::write(root.join("old.txt"), "one\ntwo\n").unwrap();
        let before = capture(&input(&root)).unwrap();
        fs::remove_file(root.join("old.txt")).unwrap();
        fs::write(root.join("new.txt"), "a\nb\nc").unwrap();
        let after = capture_for_existing(&input(&root), &before).unwrap();
        let changes = diff(&before, &after).unwrap();
        assert!(changes.iter().any(|change| {
            change.kind == WorkspaceChangeKind::Deleted && change.lines_deleted == Some(2)
        }));
        assert!(changes.iter().any(|change| {
            change.kind == WorkspaceChangeKind::Created && change.lines_added == Some(3)
        }));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn infers_a_one_to_one_pure_rename_from_the_content_hash() {
        let root = temp_dir("rename");
        fs::write(root.join("old.txt"), "same\n").unwrap();
        let before = capture(&input(&root)).unwrap();
        fs::rename(root.join("old.txt"), root.join("new.txt")).unwrap();
        let after = capture_for_existing(&input(&root), &before).unwrap();
        let changes = diff(&before, &after).unwrap();
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, WorkspaceChangeKind::Renamed);
        assert!(changes[0]
            .previous_entity
            .as_ref()
            .is_some_and(|path| path.ends_with("old.txt")));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn unchanged_content_does_not_create_an_event() {
        let root = temp_dir("unchanged");
        fs::write(root.join("a.txt"), "same\n").unwrap();
        let before = capture(&input(&root)).unwrap();
        fs::write(root.join("a.txt"), "same\n").unwrap();
        let after = capture_for_existing(&input(&root), &before).unwrap();
        assert!(diff(&before, &after).unwrap().is_empty());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn non_git_snapshot_skips_dependency_and_build_directories() {
        let root = temp_dir("exclude");
        fs::write(root.join("keep.txt"), "x\n").unwrap();
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::write(root.join("node_modules/pkg/nope.js"), "x\n").unwrap();
        fs::create_dir_all(root.join("dist")).unwrap();
        fs::write(root.join("dist/nope.js"), "x\n").unwrap();
        let snapshot = capture(&input(&root)).unwrap();
        assert_eq!(snapshot.files.len(), 1);
        assert!(snapshot.files.contains_key("keep.txt"));
        let _ = fs::remove_dir_all(root);
    }
}

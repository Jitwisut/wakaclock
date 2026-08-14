use serde::{Deserialize, Serialize};

/// Net line counts for one file's patch. Counts hunk-body `+`/`-` lines only —
/// `+++`/`---` file headers and `@@` hunk headers are never counted (plan.md 8.3:
/// "Ignore +++/--- headers and metadata; handle file add/delete/rename and multiple
/// hunks explicitly").
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct LineDelta {
    pub added: u32,
    pub deleted: u32,
}

impl LineDelta {
    fn add_line(&mut self, line: &str) {
        match line.as_bytes().first() {
            Some(b'+') if !line.starts_with("+++") => self.added += 1,
            Some(b'-') if !line.starts_with("---") => self.deleted += 1,
            _ => {}
        }
    }
}

/// One hunk in Claude Code's `toolUseResult.structuredPatch` shape: `lines` are
/// already split, each prefixed ` `/`+`/`-` with no `@@` header of its own.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct StructuredPatchHunk {
    #[serde(rename = "oldStart")]
    pub old_start: i64,
    #[serde(rename = "oldLines")]
    pub old_lines: i64,
    #[serde(rename = "newStart")]
    pub new_start: i64,
    #[serde(rename = "newLines")]
    pub new_lines: i64,
    pub lines: Vec<String>,
}

/// Count added/deleted lines across every hunk of a structured patch (Claude Code).
pub fn count_structured_patch_lines(hunks: &[StructuredPatchHunk]) -> LineDelta {
    let mut delta = LineDelta::default();
    for hunk in hunks {
        for line in &hunk.lines {
            delta.add_line(line);
        }
    }
    delta
}

/// Count added/deleted lines in a raw unified-diff text blob (Codex's
/// `payload.changes[path].unified_diff`). Tolerates an optional leading `---`/`+++`
/// file-header pair even though none was observed in the fixtures, since the format
/// is otherwise standard unified diff.
pub fn count_unified_diff_lines(diff_text: &str) -> LineDelta {
    let mut delta = LineDelta::default();
    for line in diff_text.lines() {
        if line.starts_with("@@") || line.starts_with("\\ No newline") {
            continue;
        }
        delta.add_line(line);
    }
    delta
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load_fixture(relative: &str) -> serde_json::Value {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/");
        let full = format!("{path}{relative}");
        let raw = std::fs::read_to_string(&full).unwrap_or_else(|e| panic!("read {full}: {e}"));
        serde_json::from_str(&raw).unwrap_or_else(|e| panic!("parse {full}: {e}"))
    }

    #[test]
    fn structured_patch_counts_update_hunk() {
        let fixture = load_fixture("claude_code/edit_tool_result.json");
        let hunks: Vec<StructuredPatchHunk> =
            serde_json::from_value(fixture["toolUseResult"]["structuredPatch"].clone())
                .expect("structuredPatch parses");

        let delta = count_structured_patch_lines(&hunks);
        assert_eq!(delta.added, 2);
        assert_eq!(delta.deleted, 2);
    }

    #[test]
    fn structured_patch_counts_new_file_as_pure_addition() {
        let fixture = load_fixture("claude_code/write_tool_result.json");
        let hunks: Vec<StructuredPatchHunk> =
            serde_json::from_value(fixture["toolUseResult"]["structuredPatch"].clone())
                .expect("structuredPatch parses");

        let delta = count_structured_patch_lines(&hunks);
        assert_eq!(delta.added, 3);
        assert_eq!(delta.deleted, 0);
    }

    #[test]
    fn unified_diff_counts_update_and_add_per_file() {
        let fixture = load_fixture("codex/patch_apply_end.json");
        let changes = fixture["payload"]["changes"]
            .as_object()
            .expect("changes map");

        let updated = changes["/home/dev/example-project/src/greeting.rs"]["unified_diff"]
            .as_str()
            .expect("unified_diff string");
        let update_delta = count_unified_diff_lines(updated);
        assert_eq!(update_delta.added, 2);
        assert_eq!(update_delta.deleted, 2);

        let added_file = changes["/home/dev/example-project/src/new_module.rs"]["unified_diff"]
            .as_str()
            .expect("unified_diff string");
        let add_delta = count_unified_diff_lines(added_file);
        assert_eq!(add_delta.added, 3);
        assert_eq!(add_delta.deleted, 0);
    }

    #[test]
    fn unified_diff_ignores_file_headers_and_hunk_markers() {
        let diff = "--- a/x.txt\n+++ b/x.txt\n@@ -1,1 +1,2 @@\n-old\n+new\n+extra\n";
        let delta = count_unified_diff_lines(diff);
        assert_eq!(delta.added, 2);
        assert_eq!(delta.deleted, 1);
    }

    #[test]
    fn multi_file_patch_apply_end_splits_into_per_file_deltas() {
        let fixture = load_fixture("codex/patch_apply_end.json");
        let changes = fixture["payload"]["changes"]
            .as_object()
            .expect("changes map");
        assert_eq!(changes.len(), 2, "one apply_patch call touching two files");
    }
}

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

/// One file's line delta from an OpenAI `apply_patch` DSL blob — Codex's actual
/// real-world tool-call format (`response_item` → `custom_tool_call` with
/// `name: "apply_patch"`), not the `event_msg`/`patch_apply_end` shape this parser
/// was originally written against. Confirmed against 156 real local Codex session
/// files on 2026-08-31: every one of them uses this format; none used
/// `patch_apply_end`. Ported from the shell hook's awk implementation
/// (`extensions/ai-agents/codex/heartbeat-hook.sh`) so the transcript parser and the
/// shell hook agree on one parsing rule instead of drifting independently.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApplyPatchFileChange {
    pub path: String,
    /// Set only when a `*** Move to:` marker renames the file this section started
    /// with `*** Update File:`.
    pub previous_path: Option<String>,
    pub delta: LineDelta,
}

/// Parses `*** Begin Patch` / `*** Update File: <path>` / `*** Add File: <path>` /
/// `*** Delete File: <path>` / `*** Move to: <path>` / `*** End Patch` markers, with
/// `+`/`-`-prefixed body lines counted per file section — one call can touch several
/// files, each reported separately rather than pooling all counts under the first
/// path (the bug the shell hook's own doc comment records fixing with `head -n1`).
pub fn parse_apply_patch(text: &str) -> Vec<ApplyPatchFileChange> {
    let mut out = Vec::new();
    let mut current: Option<ApplyPatchFileChange> = None;

    for line in text.lines() {
        if let Some(path) = line
            .strip_prefix("*** Update File: ")
            .or_else(|| line.strip_prefix("*** Add File: "))
            .or_else(|| line.strip_prefix("*** Delete File: "))
        {
            if let Some(change) = current.take() {
                out.push(change);
            }
            current = Some(ApplyPatchFileChange {
                path: path.to_string(),
                previous_path: None,
                delta: LineDelta::default(),
            });
            continue;
        }
        if let Some(new_path) = line.strip_prefix("*** Move to: ") {
            if let Some(change) = current.as_mut() {
                change.previous_path =
                    Some(std::mem::replace(&mut change.path, new_path.to_string()));
            }
            continue;
        }
        if line.starts_with("*** End Patch") {
            if let Some(change) = current.take() {
                out.push(change);
            }
            continue;
        }
        if let Some(change) = current.as_mut() {
            change.delta.add_line(line);
        }
    }
    if let Some(change) = current {
        out.push(change);
    }
    out
}

/// Count lines in a whole-file content blob as a pure addition — Claude Code's
/// `Write` result for a brand-new file carries an empty `structuredPatch` (there is
/// nothing to diff against) and puts the full text in `content` instead. Mirrors the
/// same "count records, not trailing-newline bytes" rule the VS Code buffer's
/// `countChangedLines` uses, so a file ending in `\n` doesn't count one phantom empty
/// line.
pub fn count_content_lines(content: &str) -> u32 {
    if content.is_empty() {
        return 0;
    }
    let newline_count = content.matches('\n').count();
    if content.ends_with('\n') {
        newline_count as u32
    } else {
        newline_count as u32 + 1
    }
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
    fn new_file_write_has_an_empty_structured_patch_use_content_instead() {
        // Corrected 2026-08-14 against a real live session: a brand-new file's
        // structuredPatch is empty, not a single addition hunk — see CAPABILITIES.md's
        // correction note. The line count comes from `content` via
        // `count_content_lines`, exercised directly below.
        let fixture = load_fixture("claude_code/write_tool_result.json");
        let hunks: Vec<StructuredPatchHunk> =
            serde_json::from_value(fixture["toolUseResult"]["structuredPatch"].clone())
                .expect("structuredPatch parses");
        assert!(hunks.is_empty());

        let content = fixture["toolUseResult"]["content"]
            .as_str()
            .expect("content string");
        assert_eq!(count_content_lines(content), 3);
    }

    #[test]
    fn count_content_lines_does_not_count_a_phantom_trailing_line() {
        assert_eq!(count_content_lines("one\ntwo\nthree\n"), 3);
        assert_eq!(count_content_lines("one\ntwo\nthree"), 3);
        assert_eq!(count_content_lines(""), 0);
        assert_eq!(count_content_lines("no newline at all"), 1);
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

    #[test]
    fn apply_patch_splits_a_multi_file_call_into_one_change_per_file() {
        // Regression test for the shell hook's own documented `head -n1` bug
        // (`extensions/ai-agents/codex/heartbeat-hook.sh`): a single apply_patch call
        // touching several files must report each file separately, not pool every
        // count under the first path.
        let patch = "*** Begin Patch\n\
*** Update File: src/a.py\n\
@@\n\
-old_a\n\
+new_a\n\
+extra_a\n\
*** Add File: src/b.py\n\
+line_one\n\
+line_two\n\
*** Delete File: src/c.py\n\
-gone_one\n\
-gone_two\n\
-gone_three\n\
*** End Patch\n";
        let changes = parse_apply_patch(patch);
        assert_eq!(changes.len(), 3);

        assert_eq!(changes[0].path, "src/a.py");
        assert_eq!(changes[0].previous_path, None);
        assert_eq!(changes[0].delta.added, 2);
        assert_eq!(changes[0].delta.deleted, 1);

        assert_eq!(changes[1].path, "src/b.py");
        assert_eq!(changes[1].delta.added, 2);
        assert_eq!(changes[1].delta.deleted, 0);

        assert_eq!(changes[2].path, "src/c.py");
        assert_eq!(changes[2].delta.added, 0);
        assert_eq!(changes[2].delta.deleted, 3);
    }

    #[test]
    fn apply_patch_move_to_renames_and_keeps_the_body_deltas() {
        let patch = "*** Begin Patch\n\
*** Update File: old/name.py\n\
*** Move to: new/name.py\n\
-old_line\n\
+new_line\n\
*** End Patch\n";
        let changes = parse_apply_patch(patch);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "new/name.py");
        assert_eq!(changes[0].previous_path.as_deref(), Some("old/name.py"));
        assert_eq!(changes[0].delta.added, 1);
        assert_eq!(changes[0].delta.deleted, 1);
    }

    #[test]
    fn apply_patch_ignores_stray_lines_before_the_first_file_marker() {
        let patch = "*** Begin Patch\nsome preamble that is not a file marker\n*** Update File: x.py\n+added\n*** End Patch\n";
        let changes = parse_apply_patch(patch);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "x.py");
        assert_eq!(changes[0].delta.added, 1);
    }

    #[test]
    fn apply_patch_on_empty_or_malformed_text_yields_no_changes() {
        assert_eq!(parse_apply_patch(""), Vec::new());
        assert_eq!(
            parse_apply_patch("not a patch at all\njust text\n"),
            Vec::new()
        );
    }
}

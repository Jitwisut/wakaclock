//! Task logs of the Cline extension family: Cline, Roo Code, Kilo Code and IBM Bob.
//!
//! Each task is a directory under the extension's VS Code `globalStorage` folder holding
//! `ui_messages.json`, a JSON array of `{ts, type, ask|say, text}` messages that the
//! extension rewrites as the task progresses. One parser serves the family; a profile
//! gives the agent ID, the extension folder names and the editor apps that host it.
//!
//! - A file edit is a `tool` message whose `text` (a JSON object) names an editing tool
//!   and a path; lines come from its diff or new content, counted in memory only.
//! - Usage is an `api_req_started` message whose `text` reports `tokensIn`/`tokensOut`,
//!   once it is two minutes old so a streaming request is not sent with partial counts.
//!
//! Whether the user rejected an approval-gated edit is not recorded in a way this
//! parser has verified, so edits stay local dry-run evidence (these are new runtimes).
//! The format was taken from public facts; no local task log was available. Task text,
//! diffs and file contents are never kept.

use crate::ai::event::{opaque_file_event_id, AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::fields::{count_at, embedded_object, string_at};
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParserCursor,
};
use crate::ai::patch::{count_content_lines, count_unified_diff_lines, LineDelta};
use crate::ai::snapshot_source::{read_if_changed, SnapshotRead};
use crate::ai::source::{FileFingerprint, SourceCheckpoint, SourceKind};
use crate::ai::usage::{AiUsageRecord, TokenSource};
use crate::broker::BrokerChangeKind;
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const USAGE_SETTLE_SECONDS: i64 = 120;
const VSCODE_APPS: &[&str] = &["Code", "Code - Insiders", "Cursor", "Windsurf", "VSCodium"];
const REMOTE_SERVERS: &[&str] = &[".vscode-server", ".cursor-server", ".windsurf-server"];

pub struct Profile {
    pub agent: &'static str,
    /// Extension folder names under `globalStorage`, lower-case (VS Code lower-cases them).
    extension_dirs: &'static [&'static str],
    apps: &'static [&'static str],
}

pub const CLINE: Profile = Profile {
    agent: "cline",
    extension_dirs: &["saoudrizwan.claude-dev"],
    apps: VSCODE_APPS,
};
pub const ROO_CODE: Profile = Profile {
    agent: "roo-code",
    extension_dirs: &[
        "rooveterinaryinc.roo-cline",
        "rooveterinaryinc.roo-code-nightly",
    ],
    apps: VSCODE_APPS,
};
pub const KILO_CODE: Profile = Profile {
    agent: "kilo-code",
    extension_dirs: &["kilocode.kilo-code"],
    apps: VSCODE_APPS,
};
pub const IBM_BOB: Profile = Profile {
    agent: "ibm-bob",
    extension_dirs: &["ibm.bob-code"],
    apps: &["IBM Bob", "Bob-IDE"],
};

pub struct UiMessagesParser {
    profile: &'static Profile,
}

impl UiMessagesParser {
    pub fn new(profile: &'static Profile) -> Self {
        Self { profile }
    }

    fn global_storage_dirs(&self, context: &DiscoveryContext) -> Vec<PathBuf> {
        if let Some(root) = &context.config_override {
            return vec![root.clone()];
        }
        let home = &context.home_dir;
        let app_base = if cfg!(target_os = "macos") {
            home.join("Library/Application Support")
        } else if cfg!(target_os = "windows") {
            home.join("AppData/Roaming")
        } else {
            home.join(".config")
        };
        let mut dirs: Vec<PathBuf> = self
            .profile
            .apps
            .iter()
            .map(|app| app_base.join(app).join("User").join("globalStorage"))
            .collect();
        dirs.extend(
            REMOTE_SERVERS
                .iter()
                .map(|server| home.join(server).join("data/User/globalStorage")),
        );
        dirs
    }

    fn task_logs(&self, context: &DiscoveryContext) -> (bool, Vec<PathBuf>) {
        let mut installed = false;
        let mut logs = Vec::new();
        for storage in self.global_storage_dirs(context) {
            let Ok(entries) = fs::read_dir(&storage) else {
                continue;
            };
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
                if !self.profile.extension_dirs.contains(&name.as_str()) {
                    continue;
                }
                installed = true;
                let Ok(tasks) = fs::read_dir(entry.path().join("tasks")) else {
                    continue;
                };
                for task in tasks.flatten() {
                    let log = task.path().join("ui_messages.json");
                    if log.is_file() {
                        logs.push(log);
                    }
                }
            }
        }
        logs.sort();
        (installed, logs)
    }

    fn messages(bytes: &[u8]) -> Vec<Value> {
        serde_json::from_slice::<Value>(bytes)
            .ok()
            .and_then(|value| value.as_array().cloned())
            .unwrap_or_default()
    }

    fn edit_event(&self, task: &str, message: &Value) -> Option<AiEditEvent> {
        if string_at(message, &["ask", "say"]).as_deref() != Some("tool") {
            return None;
        }
        let tool = embedded_object(message.get("text"));
        let name = string_at(&tool, &["tool"])?;
        let change_kind = match name.as_str() {
            "editedExistingFile" | "appliedDiff" | "searchAndReplace" | "insertContent" => {
                BrokerChangeKind::Modify
            }
            "newFileCreated" | "writeToFile" => BrokerChangeKind::Create,
            "fileDeleted" => BrokerChangeKind::Delete,
            _ => return None,
        };
        let path = string_at(&tool, &["path", "filePath"])?;
        let delta = line_delta(&tool, change_kind);
        let ts = message.get("ts").and_then(Value::as_i64)?;
        Some(AiEditEvent {
            event_id: opaque_file_event_id(
                &format!("{}-v1", self.profile.agent),
                &format!("{task}:{ts}"),
                &path,
            ),
            agent: self.profile.agent.to_string(),
            provider: None,
            model: None,
            session_id: Some(task.to_string()),
            turn_id: None,
            identity_message_id: None,
            identity_status: None,
            identity_reason: None,
            identity_source: Some(AiEventSource::Transcript.as_str().to_string()),
            tool_event_id: Some(ts.to_string()),
            producer_surface: None,
            occurred_at: DateTime::<Utc>::from_timestamp_millis(ts).unwrap_or_else(Utc::now),
            // Paths are workspace-relative in these logs; the workspace root is not
            // recorded alongside them, so the path stays relative.
            entity: PathBuf::from(&path),
            project_root: None,
            change_kind,
            previous_entity: None,
            lines_added: delta.map(|delta| delta.added),
            lines_deleted: delta.map(|delta| delta.deleted),
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        })
    }

    fn usage_record(
        &self,
        task: &str,
        message: &Value,
        now: DateTime<Utc>,
    ) -> Option<AiUsageRecord> {
        if string_at(message, &["say"]).as_deref() != Some("api_req_started") {
            return None;
        }
        let ts = message.get("ts").and_then(Value::as_i64)?;
        let occurred_at = DateTime::<Utc>::from_timestamp_millis(ts)?;
        if (now - occurred_at).num_seconds() < USAGE_SETTLE_SECONDS {
            return None;
        }
        let request = embedded_object(message.get("text"));
        let input = count_at(&request, &["tokensIn"]);
        let output = count_at(&request, &["tokensOut"]);
        if input.unwrap_or(0) == 0 && output.unwrap_or(0) == 0 {
            return None;
        }
        Some(AiUsageRecord {
            usage_event_id: format!("{}-usage-v1:{task}:{ts}", self.profile.agent),
            ai_session_id: task.to_string(),
            collector_id: None,
            occurred_at,
            agent: self.profile.agent.to_string(),
            provider: None,
            model: None,
            prompt_count: 0,
            prompt_character_count: None,
            input_tokens: input.map(u64::from),
            output_tokens: output.map(u64::from),
            cache_read_tokens: count_at(&request, &["cacheReads"]).map(u64::from),
            cache_write_tokens: count_at(&request, &["cacheWrites"]).map(u64::from),
            token_source: TokenSource::Transcript,
            project_hint: None,
        })
    }
}

/// Lines changed by one tool message: a SEARCH/REPLACE or unified diff, or the full
/// content of a newly written file. Deletions report no line counts.
fn line_delta(tool: &Value, kind: BrokerChangeKind) -> Option<LineDelta> {
    if kind == BrokerChangeKind::Delete {
        return None;
    }
    if let Some(diff) = string_at(tool, &["diff"]) {
        return Some(if diff.contains("<<<<<<< SEARCH") {
            search_replace_lines(&diff)
        } else {
            count_unified_diff_lines(&diff)
        });
    }
    string_at(tool, &["content"]).map(|content| LineDelta {
        added: count_content_lines(&content),
        deleted: 0,
    })
}

fn search_replace_lines(diff: &str) -> LineDelta {
    let mut delta = LineDelta {
        added: 0,
        deleted: 0,
    };
    let mut section = 0u8; // 1 = search, 2 = replace
    for line in diff.lines() {
        match line.trim_end() {
            text if text.starts_with("<<<<<<< SEARCH") => section = 1,
            "=======" if section == 1 => section = 2,
            text if text.starts_with(">>>>>>> REPLACE") => section = 0,
            text if text.starts_with(":start_line:") || text == "-------" => {}
            _ if section == 1 => delta.deleted += 1,
            _ if section == 2 => delta.added += 1,
            _ => {}
        }
    }
    delta
}

fn task_id(log: &Path) -> String {
    log.parent()
        .and_then(Path::file_name)
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "unknown-task".to_string())
}

fn snapshot_state(cursor: Option<&ParserCursor>) -> (Option<FileFingerprint>, Option<i64>) {
    match cursor
        .and_then(|cursor| cursor.context.as_ref())
        .and_then(|context| context.source.as_ref())
    {
        Some(SourceCheckpoint::JsonSnapshot {
            fingerprint,
            seen_through_ms,
        }) => (*fingerprint, *seen_through_ms),
        _ => (None, None),
    }
}

fn after_watermark(message: &Value, seen_through: Option<i64>) -> bool {
    let ts = message.get("ts").and_then(Value::as_i64);
    match (ts, seen_through) {
        (Some(ts), Some(mark)) => ts > mark,
        _ => true,
    }
}

impl AiActivityParser for UiMessagesParser {
    fn id(&self) -> &'static str {
        self.profile.agent
    }

    fn source_kind(&self) -> SourceKind {
        SourceKind::JsonSnapshot
    }

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult {
        let (installed, logs) = self.task_logs(context);
        let newest = logs.into_iter().max_by_key(|path| {
            fs::metadata(path)
                .and_then(|metadata| metadata.modified())
                .ok()
        });
        DiscoveryResult {
            state: match (installed, newest) {
                (false, _) => DiscoveryState::NotInstalled,
                (true, Some(path)) => DiscoveryState::TranscriptFound { path },
                (true, None) => DiscoveryState::InstalledNoTranscript,
            },
        }
    }

    fn discover_sources(&self, context: &DiscoveryContext) -> Vec<DiscoveryResult> {
        let (installed, logs) = self.task_logs(context);
        if !installed {
            return vec![DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            }];
        }
        if logs.is_empty() {
            return vec![DiscoveryResult {
                state: DiscoveryState::InstalledNoTranscript,
            }];
        }
        logs.into_iter()
            .map(|path| DiscoveryResult {
                state: DiscoveryState::TranscriptFound { path },
            })
            .collect()
    }

    fn parse_since(
        &self,
        context: &ParseContext,
        cursor: Option<&ParserCursor>,
    ) -> Result<ParseBatch, AiParseError> {
        let cursor = cursor.ok_or_else(|| AiParseError::NotFound {
            path: "<no cursor: call discover() first and seed a cursor from its path>".to_string(),
        })?;
        let log = PathBuf::from(&cursor.source_path);
        let (previous, seen_through) = snapshot_state(Some(cursor));
        let read = read_if_changed(&log, previous.as_ref(), context.max_read_bytes)
            .map_err(AiParseError::Io)?;
        let (events, fingerprint) = match read {
            SnapshotRead::Changed { fingerprint, bytes } => {
                let task = task_id(&log);
                let events: Vec<AiEditEvent> = Self::messages(&bytes)
                    .iter()
                    .filter(|message| after_watermark(message, seen_through))
                    .filter_map(|message| self.edit_event(&task, message))
                    .collect();
                (events, Some(fingerprint))
            }
            SnapshotRead::Missing | SnapshotRead::Unchanged | SnapshotRead::TooLarge { .. } => {
                (Vec::new(), previous)
            }
        };
        let mut next_context = cursor.context.clone().unwrap_or_default();
        next_context.source = Some(SourceCheckpoint::JsonSnapshot {
            fingerprint,
            seen_through_ms: seen_through,
        });
        Ok(ParseBatch {
            next_cursor: ParserCursor {
                source_path: cursor.source_path.clone(),
                file_identity: cursor.file_identity.clone(),
                byte_offset: 0,
                last_record_id: events
                    .last()
                    .map(|event| event.event_id.clone())
                    .or_else(|| cursor.last_record_id.clone()),
                last_record_time: events
                    .last()
                    .map(|event| event.occurred_at)
                    .or(cursor.last_record_time),
                context: Some(next_context),
            },
            events,
            warnings: Vec::new(),
        })
    }

    fn parse_usage(
        &self,
        source: &Path,
        cursor: Option<&ParserCursor>,
    ) -> std::io::Result<Vec<AiUsageRecord>> {
        let (previous, seen_through) = snapshot_state(cursor);
        let SnapshotRead::Changed { bytes, .. } =
            read_if_changed(source, previous.as_ref(), 64 * 1024 * 1024)?
        else {
            return Ok(Vec::new());
        };
        let task = task_id(source);
        let now = Utc::now();
        Ok(Self::messages(&bytes)
            .iter()
            .filter(|message| after_watermark(message, seen_through))
            .filter_map(|message| self.usage_record(&task, message, now))
            .collect())
    }

    fn cursor_is_reusable(&self, _cursor: &ParserCursor, _source_len: u64) -> bool {
        true
    }

    /// Mark every message already in the log as seen, so enabling the adapter does not
    /// upload a task's history.
    fn seed_at_head(&self, cursor: &ParserCursor, _source_len: u64) -> ParserCursor {
        let latest = fs::read(&cursor.source_path)
            .ok()
            .map(|bytes| Self::messages(&bytes))
            .and_then(|messages| {
                messages
                    .iter()
                    .filter_map(|message| message.get("ts").and_then(Value::as_i64))
                    .max()
            });
        let mut seeded = cursor.clone();
        let mut context = seeded.context.clone().unwrap_or_default();
        context.source = Some(SourceCheckpoint::JsonSnapshot {
            fingerprint: None,
            seen_through_ms: latest,
        });
        seeded.context = Some(context);
        seeded
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const SECRET: &str = "SECRET-MARKER-41b2";
    const OLD_TS: i64 = 1_793_008_800_000; // 2026-10-26T10:00:00Z

    fn tool(ts: i64, ask_or_say: &str, body: Value) -> Value {
        json!({"ts": ts, "type": ask_or_say, ask_or_say: "tool", "text": body.to_string()})
    }

    fn task_log(home: &Path, ext: &str, task: &str, messages: &[Value]) -> PathBuf {
        let dir = home.join("storage").join(ext).join("tasks").join(task);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("ui_messages.json");
        fs::write(&path, serde_json::to_vec(messages).unwrap()).unwrap();
        path
    }

    fn temp_home(name: &str) -> PathBuf {
        let nonce = Utc::now().timestamp_nanos_opt().unwrap_or_default();
        std::env::temp_dir().join(format!("wakaclock-uimsg-{name}-{nonce}"))
    }

    fn sample() -> Vec<Value> {
        vec![
            json!({"ts": OLD_TS, "type": "say", "say": "task", "text": SECRET}),
            tool(
                OLD_TS + 1,
                "ask",
                json!({"tool": "editedExistingFile", "path": "src/a.ts",
                "diff": format!("<<<<<<< SEARCH\n:start_line:3\n-------\n{SECRET}\n=======\none\ntwo\n>>>>>>> REPLACE")}),
            ),
            tool(
                OLD_TS + 2,
                "say",
                json!({"tool": "newFileCreated", "path": "src/new.ts", "content": "a\nb\nc\n"}),
            ),
            tool(
                OLD_TS + 3,
                "ask",
                json!({"tool": "readFile", "path": "src/a.ts"}),
            ),
            json!({"ts": OLD_TS + 4, "type": "say", "say": "api_req_started",
                   "text": json!({"request": SECRET, "tokensIn": 1500, "tokensOut": 200, "cacheReads": 50}).to_string()}),
        ]
    }

    fn cursor_for(path: &Path) -> ParserCursor {
        ParserCursor {
            source_path: path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        }
    }

    fn parse(parser: &UiMessagesParser, cursor: &ParserCursor) -> ParseBatch {
        parser
            .parse_since(&ParseContext::default(), Some(cursor))
            .unwrap()
    }

    #[test]
    fn tool_messages_become_edits_with_line_counts() {
        let home = temp_home("edits");
        let log = task_log(&home, "saoudrizwan.claude-dev", "task-1", &sample());
        let batch = parse(&UiMessagesParser::new(&CLINE), &cursor_for(&log));
        let summary: Vec<(String, Option<u32>, Option<u32>)> = batch
            .events
            .iter()
            .map(|event| {
                (
                    event.entity.to_string_lossy().into_owned(),
                    event.lines_added,
                    event.lines_deleted,
                )
            })
            .collect();
        assert_eq!(
            summary,
            vec![
                ("src/a.ts".to_string(), Some(2), Some(1)),
                ("src/new.ts".to_string(), Some(3), Some(0)),
            ]
        );
        assert_eq!(batch.events[0].agent, "cline");
        assert_eq!(batch.events[0].session_id.as_deref(), Some("task-1"));
        assert_eq!(batch.events[1].change_kind, BrokerChangeKind::Create);
    }

    #[test]
    fn an_unchanged_log_emits_nothing_and_ids_are_stable_across_rewrites() {
        let home = temp_home("rewrite");
        let log = task_log(&home, "kilocode.kilo-code", "t", &sample());
        let parser = UiMessagesParser::new(&KILO_CODE);
        let first = parse(&parser, &cursor_for(&log));
        assert!(parse(&parser, &first.next_cursor).events.is_empty());
        let mut grown = sample();
        grown.push(tool(
            OLD_TS + 9,
            "say",
            json!({"tool": "appliedDiff", "path": "src/b.ts", "diff": "@@ -1 +1 @@\n-a\n+b"}),
        ));
        fs::write(&log, serde_json::to_vec(&grown).unwrap()).unwrap();
        let second = parse(&parser, &first.next_cursor);
        assert_eq!(second.events.len(), 3);
        assert_eq!(second.events[0].event_id, first.events[0].event_id);
    }

    #[test]
    fn seeding_skips_existing_history() {
        let home = temp_home("seed");
        let log = task_log(&home, "rooveterinaryinc.roo-cline", "t", &sample());
        let parser = UiMessagesParser::new(&ROO_CODE);
        let seeded = parser.seed_at_head(&cursor_for(&log), 0);
        assert!(parse(&parser, &seeded).events.is_empty());
        assert!(parser.parse_usage(&log, Some(&seeded)).unwrap().is_empty());
        let mut grown = sample();
        grown.push(tool(OLD_TS + 9, "say", json!({"tool": "editedExistingFile", "path": "src/c.ts", "diff": "@@ -1 +1 @@\n-a\n+b"})));
        fs::write(&log, serde_json::to_vec(&grown).unwrap()).unwrap();
        assert_eq!(parse(&parser, &seeded).events.len(), 1);
    }

    #[test]
    fn usage_comes_from_settled_requests() {
        let home = temp_home("usage");
        let mut messages = sample();
        messages.push(
            json!({"ts": Utc::now().timestamp_millis(), "type": "say", "say": "api_req_started",
                             "text": json!({"tokensIn": 9, "tokensOut": 9}).to_string()}),
        );
        let log = task_log(&home, "saoudrizwan.claude-dev", "t", &messages);
        let records = UiMessagesParser::new(&CLINE)
            .parse_usage(&log, None)
            .unwrap();
        assert_eq!(records.len(), 1);
        let usage = &records[0];
        assert_eq!(
            (
                usage.input_tokens,
                usage.output_tokens,
                usage.cache_read_tokens
            ),
            (Some(1500), Some(200), Some(50))
        );
        assert_eq!(usage.ai_session_id, "t");
        usage.validate().unwrap();
    }

    #[test]
    fn discovery_matches_extension_folders_case_insensitively() {
        let home = temp_home("discover");
        task_log(&home, "RooVeterinaryInc.roo-cline", "t1", &sample());
        task_log(&home, "saoudrizwan.claude-dev", "t2", &sample());
        let context = DiscoveryContext {
            home_dir: home.clone(),
            config_override: Some(home.join("storage")),
        };
        assert_eq!(
            UiMessagesParser::new(&ROO_CODE)
                .discover_sources(&context)
                .len(),
            1
        );
        assert_eq!(
            UiMessagesParser::new(&IBM_BOB).discover(&context).state,
            DiscoveryState::NotInstalled
        );
    }

    #[test]
    fn no_task_text_diff_or_request_leaves_the_parser() {
        let home = temp_home("privacy");
        let log = task_log(&home, "saoudrizwan.claude-dev", "t", &sample());
        let parser = UiMessagesParser::new(&CLINE);
        let batch = parse(&parser, &cursor_for(&log));
        let rendered = format!(
            "{:?}{:?}{:?}",
            batch.events,
            batch.next_cursor,
            parser.parse_usage(&log, None).unwrap()
        );
        assert!(!rendered.contains(SECRET));
    }

    #[test]
    fn search_replace_blocks_are_counted_without_markers() {
        let delta = search_replace_lines(
            "<<<<<<< SEARCH\n:start_line:1\n-------\nold1\nold2\n=======\nnew1\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nx\n=======\ny\nz\n>>>>>>> REPLACE",
        );
        assert_eq!((delta.added, delta.deleted), (3, 3));
    }
}

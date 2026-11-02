//! Append-only JSONL session logs of CLI agents whose record shapes differ in nesting
//! but share the facts: Qwen Code, Pi, Kiro, Factory Droid and Kimi (CLI and Code).
//!
//! A profile names the agent, where its logs live and which files are session logs.
//! Records are searched (bounded depth) for a completed file-editing tool result:
//!
//! - an editing tool name (edit/write/replace/patch/…, never read/list/search),
//! - a file path, and
//! - evidence that the change happened: a diff, or added/removed line counts, in the
//!   object or its result (`result`, `response`, `resultDisplay`, `details`, `output`).
//!
//! A tool *request* that only carries the content it intends to write is not an edit,
//! and neither is a result marked failed. This under-counts edits whose result reports
//! neither a diff nor counts, which the accuracy-first rule prefers to guessing. Usage
//! is the first token block found in a record. These formats were taken from public
//! facts with no local sample, and the runtimes are new, so edits stay dry-run.
//! Prompt text, arguments, content and diffs are never kept.

use crate::ai::event::{opaque_file_event_id, AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::fields::{count_at, embedded_object, string_at, timestamp_at};
use crate::ai::jsonl::JsonlCursorReader;
use crate::ai::normalize_identity_model;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor,
};
use crate::ai::patch::{count_unified_diff_lines, LineDelta};
use crate::ai::usage::{AiUsageRecord, TokenSource};
use crate::broker::BrokerChangeKind;
use chrono::Utc;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_DEPTH: usize = 6;
const EDIT_WORDS: [&str; 8] = [
    "edit",
    "write",
    "replace",
    "patch",
    "create",
    "insert",
    "str_replace",
    "modify",
];
const READ_WORDS: [&str; 6] = ["read", "view", "list", "search", "grep", "glob"];
const NAME_KEYS: [&str; 4] = ["name", "tool_name", "toolName", "tool"];
const PATH_KEYS: [&str; 7] = [
    "file_path",
    "filePath",
    "path",
    "fileName",
    "filename",
    "target_file",
    "absolute_path",
];
const ARG_KEYS: [&str; 4] = ["args", "arguments", "input", "params"];
const RESULT_KEYS: [&str; 6] = [
    "result",
    "response",
    "resultDisplay",
    "details",
    "output",
    "content",
];
const DIFF_KEYS: [&str; 5] = ["diff", "fileDiff", "patch", "unified_diff", "unifiedDiff"];
const ADDED_KEYS: [&str; 5] = [
    "linesAdded",
    "lines_added",
    "additions",
    "model_added_lines",
    "added",
];
const REMOVED_KEYS: [&str; 6] = [
    "linesRemoved",
    "lines_removed",
    "deletions",
    "model_removed_lines",
    "removed",
    "linesDeleted",
];
const TIME_KEYS: [&str; 5] = ["timestamp", "time", "created_at", "createdAt", "ts"];
const MODEL_KEYS: [&str; 4] = ["model", "modelId", "model_name", "modelName"];

pub struct JsonlProfile {
    pub agent: &'static str,
    /// Directories under the home directory that hold the agent's session logs.
    roots: &'static [&'static str],
    is_session_log: fn(&Path) -> bool,
}

fn has_extension(path: &Path, extension: &str) -> bool {
    path.extension().is_some_and(|ext| ext == extension)
}

fn parent_named(path: &Path, name: &str) -> bool {
    path.parent()
        .and_then(Path::file_name)
        .is_some_and(|parent| parent == name)
}

fn file_named(path: &Path, name: &str) -> bool {
    path.file_name().is_some_and(|file| file == name)
}

pub const QWEN_CODE: JsonlProfile = JsonlProfile {
    agent: "qwen-code",
    roots: &[".qwen/projects"],
    is_session_log: |path| has_extension(path, "jsonl") && parent_named(path, "chats"),
};
pub const PI: JsonlProfile = JsonlProfile {
    agent: "pi",
    roots: &[".pi/agent/sessions"],
    is_session_log: |path| has_extension(path, "jsonl"),
};
pub const KIRO: JsonlProfile = JsonlProfile {
    agent: "kiro",
    roots: &[".kiro/sessions"],
    is_session_log: |path| {
        file_named(path, "messages.jsonl")
            || (has_extension(path, "jsonl") && parent_named(path, "cli"))
    },
};
pub const FACTORY_DROID: JsonlProfile = JsonlProfile {
    agent: "factory-droid",
    roots: &[".factory/sessions"],
    is_session_log: |path| has_extension(path, "jsonl"),
};
pub const KIMI: JsonlProfile = JsonlProfile {
    agent: "kimi-code-cli",
    roots: &[".kimi/sessions", ".kimi-code"],
    is_session_log: |path| file_named(path, "wire.jsonl"),
};

pub struct JsonlFamilyParser {
    profile: &'static JsonlProfile,
}

impl JsonlFamilyParser {
    pub fn new(profile: &'static JsonlProfile) -> Self {
        Self { profile }
    }

    fn roots(&self, context: &DiscoveryContext) -> Vec<PathBuf> {
        match &context.config_override {
            Some(root) => vec![root.clone()],
            None => self
                .profile
                .roots
                .iter()
                .map(|root| context.home_dir.join(root))
                .collect(),
        }
    }

    fn logs(&self, context: &DiscoveryContext) -> (bool, Vec<PathBuf>) {
        let mut installed = false;
        let mut logs = Vec::new();
        for root in self.roots(context) {
            if root.exists() {
                installed = true;
                collect(&root, 0, self.profile.is_session_log, &mut logs);
            }
        }
        logs.sort();
        (installed, logs)
    }
}

fn collect(dir: &Path, depth: usize, keep: fn(&Path) -> bool, out: &mut Vec<PathBuf>) {
    if depth > 6 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect(&path, depth + 1, keep, out);
        } else if keep(&path) {
            out.push(path);
        }
    }
}

/// A session is the file stem, or the parent directory for fixed file names.
fn session_of(log: &Path) -> String {
    let fixed = ["messages.jsonl", "wire.jsonl", "events.jsonl"];
    let use_parent = log
        .file_name()
        .is_some_and(|name| fixed.iter().any(|fixed| name == *fixed));
    let name = if use_parent {
        log.parent().and_then(Path::file_name)
    } else {
        log.file_stem()
    };
    name.map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "unknown-session".to_string())
}

#[derive(Debug, PartialEq)]
struct EditFound {
    name: String,
    path: String,
    delta: LineDelta,
    call_id: Option<String>,
}

fn is_edit_tool(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    EDIT_WORDS.iter().any(|word| name.contains(word))
        && !READ_WORDS.iter().any(|word| name.contains(word))
}

fn failed(object: &Value) -> bool {
    object.get("success").and_then(Value::as_bool) == Some(false)
        || object.get("is_error").and_then(Value::as_bool) == Some(true)
        || object.get("isError").and_then(Value::as_bool) == Some(true)
        || string_at(object, &["status"]).is_some_and(|status| {
            matches!(
                status.to_ascii_lowercase().as_str(),
                "error" | "failed" | "failure" | "cancelled" | "rejected"
            )
        })
}

/// `object` and its result objects up to two levels down (for example
/// `response.resultDisplay`), where tools report what they changed.
fn layers(object: &Value) -> Vec<Value> {
    let mut layers = vec![object.clone()];
    let mut frontier = vec![object.clone()];
    for _ in 0..2 {
        let next: Vec<Value> = frontier
            .iter()
            .flat_map(|layer| {
                RESULT_KEYS
                    .iter()
                    .filter_map(|key| layer.get(*key))
                    .map(|value| embedded_object(Some(value)))
                    .filter(Value::is_object)
                    .collect::<Vec<_>>()
            })
            .collect();
        layers.extend(next.iter().cloned());
        frontier = next;
    }
    layers
}

/// Evidence that a change happened, in `object` or one of its result layers.
fn change_evidence(object: &Value) -> Option<LineDelta> {
    for candidate in layers(object) {
        if failed(&candidate) {
            continue;
        }
        let added = count_at(&candidate, &ADDED_KEYS);
        let removed = count_at(&candidate, &REMOVED_KEYS);
        if added.is_some() || removed.is_some() {
            return Some(LineDelta {
                added: added.unwrap_or(0),
                deleted: removed.unwrap_or(0),
            });
        }
        if let Some(diff) = string_at(&candidate, &DIFF_KEYS) {
            return Some(count_unified_diff_lines(&diff));
        }
    }
    None
}

fn path_of(object: &Value) -> Option<String> {
    string_at(object, &PATH_KEYS)
        .or_else(|| {
            ARG_KEYS
                .iter()
                .filter_map(|key| object.get(*key))
                .map(|value| embedded_object(Some(value)))
                .find_map(|arguments| string_at(&arguments, &PATH_KEYS))
        })
        .or_else(|| {
            layers(object)
                .iter()
                .skip(1)
                .find_map(|layer| string_at(layer, &PATH_KEYS))
        })
}

fn find_edits(value: &Value, depth: usize, out: &mut Vec<EditFound>) {
    if depth > MAX_DEPTH {
        return;
    }
    match value {
        Value::Object(map) => {
            if let Some(name) = string_at(value, &NAME_KEYS).filter(|name| is_edit_tool(name)) {
                if !failed(value) {
                    if let (Some(path), Some(delta)) = (path_of(value), change_evidence(value)) {
                        let call_id = string_at(
                            value,
                            &["id", "call_id", "callId", "toolCallId", "tool_use_id"],
                        );
                        out.push(EditFound {
                            name,
                            path,
                            delta,
                            call_id,
                        });
                        return;
                    }
                }
            }
            for child in map.values() {
                find_edits(child, depth + 1, out);
            }
        }
        Value::Array(items) => {
            for item in items {
                find_edits(item, depth + 1, out);
            }
        }
        _ => {}
    }
}

fn find_first<'a>(
    value: &'a Value,
    depth: usize,
    test: &dyn Fn(&Value) -> bool,
) -> Option<&'a Value> {
    if depth > MAX_DEPTH {
        return None;
    }
    if test(value) {
        return Some(value);
    }
    match value {
        Value::Object(map) => map
            .values()
            .find_map(|child| find_first(child, depth + 1, test)),
        Value::Array(items) => items
            .iter()
            .find_map(|item| find_first(item, depth + 1, test)),
        _ => None,
    }
}

const INPUT_KEYS: [&str; 4] = [
    "input_tokens",
    "inputTokens",
    "prompt_tokens",
    "promptTokens",
];
const OUTPUT_KEYS: [&str; 4] = [
    "output_tokens",
    "outputTokens",
    "completion_tokens",
    "completionTokens",
];

fn has_tokens(value: &Value) -> bool {
    count_at(value, &INPUT_KEYS).is_some() || count_at(value, &OUTPUT_KEYS).is_some()
}

fn model_in(record: &Value) -> Option<String> {
    find_first(record, 0, &|value| string_at(value, &MODEL_KEYS).is_some())
        .and_then(|value| string_at(value, &MODEL_KEYS))
        .and_then(|name| normalize_identity_model(Some(&name)))
}

impl JsonlFamilyParser {
    fn edit_events(&self, record: &Value, session: &str, offset: u64) -> Vec<AiEditEvent> {
        let mut found = Vec::new();
        find_edits(record, 0, &mut found);
        let occurred_at = timestamp_at(record, &TIME_KEYS).unwrap_or_else(Utc::now);
        let model = model_in(record);
        found
            .into_iter()
            .enumerate()
            .map(|(index, edit)| {
                let operation = format!(
                    "{session}:{}",
                    edit.call_id
                        .clone()
                        .unwrap_or_else(|| format!("{offset}.{index}"))
                );
                AiEditEvent {
                    event_id: opaque_file_event_id(
                        &format!("{}-v1", self.profile.agent),
                        &operation,
                        &edit.path,
                    ),
                    agent: self.profile.agent.to_string(),
                    provider: None,
                    model: model.clone(),
                    session_id: Some(session.to_string()),
                    turn_id: None,
                    identity_message_id: None,
                    identity_status: None,
                    identity_reason: None,
                    identity_source: Some(AiEventSource::Transcript.as_str().to_string()),
                    tool_event_id: edit.call_id,
                    producer_surface: None,
                    occurred_at,
                    entity: PathBuf::from(&edit.path),
                    project_root: None,
                    change_kind: if edit.name.to_ascii_lowercase().contains("create") {
                        BrokerChangeKind::Create
                    } else {
                        BrokerChangeKind::Modify
                    },
                    previous_entity: None,
                    lines_added: Some(edit.delta.added),
                    lines_deleted: Some(edit.delta.deleted),
                    input_tokens: None,
                    output_tokens: None,
                    source: AiEventSource::Transcript,
                    confidence: AiConfidence::Verified,
                }
            })
            .collect()
    }

    fn usage_record(&self, record: &Value, session: &str, offset: u64) -> Option<AiUsageRecord> {
        let tokens = find_first(record, 0, &has_tokens)?;
        let occurred_at = timestamp_at(record, &TIME_KEYS)?;
        let input = count_at(tokens, &INPUT_KEYS);
        let output = count_at(tokens, &OUTPUT_KEYS);
        if input.unwrap_or(0) == 0 && output.unwrap_or(0) == 0 {
            return None;
        }
        let id = string_at(record, &["id", "uuid", "messageId", "message_id"])
            .unwrap_or_else(|| offset.to_string());
        Some(AiUsageRecord {
            usage_event_id: format!("{}-usage-v1:{session}:{id}", self.profile.agent),
            ai_session_id: session.to_string(),
            collector_id: None,
            occurred_at,
            agent: self.profile.agent.to_string(),
            provider: None,
            model: model_in(record),
            prompt_count: 0,
            prompt_character_count: None,
            input_tokens: input.map(u64::from),
            output_tokens: output.map(u64::from),
            cache_read_tokens: count_at(
                tokens,
                &[
                    "cache_read_tokens",
                    "cacheReadTokens",
                    "cache_read_input_tokens",
                    "cacheRead",
                ],
            )
            .map(u64::from),
            cache_write_tokens: count_at(
                tokens,
                &[
                    "cache_write_tokens",
                    "cacheWriteTokens",
                    "cache_creation_input_tokens",
                    "cacheWrite",
                ],
            )
            .map(u64::from),
            token_source: TokenSource::Transcript,
            project_hint: None,
        })
    }
}

impl AiActivityParser for JsonlFamilyParser {
    fn id(&self) -> &'static str {
        self.profile.agent
    }

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult {
        let (installed, logs) = self.logs(context);
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
        let (installed, logs) = self.logs(context);
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
        let session = session_of(&log);
        let mut reader = JsonlCursorReader::open(&log, cursor.byte_offset).map_err(|error| {
            match error.kind() {
                std::io::ErrorKind::NotFound => AiParseError::NotFound {
                    path: cursor.source_path.clone(),
                },
                std::io::ErrorKind::PermissionDenied => AiParseError::PermissionDenied {
                    path: cursor.source_path.clone(),
                },
                _ => AiParseError::Io(error),
            }
        })?;
        let mut events = Vec::new();
        let mut warnings = Vec::new();
        let mut offset = cursor.byte_offset;
        while events.len() < context.max_batch_records {
            let Some(line) = reader
                .next_line(context.max_record_bytes)
                .map_err(AiParseError::Io)?
            else {
                break;
            };
            offset = line.offset_after;
            if line.too_large {
                warnings.push(ParseWarning {
                    record_id: None,
                    message: format!("skipped oversized {} record", self.profile.agent),
                });
                continue;
            }
            let Ok(record) = serde_json::from_str::<Value>(&line.text) else {
                warnings.push(ParseWarning {
                    record_id: None,
                    message: format!("skipped malformed {} record", self.profile.agent),
                });
                continue;
            };
            events.extend(self.edit_events(&record, &session, line.offset_before));
        }
        let last = events.last();
        Ok(ParseBatch {
            next_cursor: ParserCursor {
                source_path: cursor.source_path.clone(),
                file_identity: cursor.file_identity.clone(),
                byte_offset: offset,
                last_record_id: last
                    .map(|event| event.event_id.clone())
                    .or_else(|| cursor.last_record_id.clone()),
                last_record_time: last
                    .map(|event| event.occurred_at)
                    .or(cursor.last_record_time),
                context: cursor.context.clone(),
            },
            events,
            warnings,
        })
    }

    fn parse_usage(
        &self,
        source: &Path,
        _cursor: Option<&ParserCursor>,
    ) -> std::io::Result<Vec<AiUsageRecord>> {
        let contents = fs::read_to_string(source)?;
        let session = session_of(source);
        let mut offset = 0u64;
        let mut records = Vec::new();
        for line in contents.split_inclusive('\n') {
            if let Ok(record) = serde_json::from_str::<Value>(line.trim()) {
                records.extend(self.usage_record(&record, &session, offset));
            }
            offset += line.len() as u64;
        }
        Ok(records)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const SECRET: &str = "SECRET-MARKER-5e77";

    fn write_log(path: &Path, records: &[Value]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let body: String = records.iter().map(|record| format!("{record}\n")).collect();
        fs::write(path, body).unwrap();
    }

    fn temp_home(name: &str) -> PathBuf {
        let nonce = Utc::now().timestamp_nanos_opt().unwrap_or_default();
        std::env::temp_dir().join(format!("wakaclock-jsonl-family-{name}-{nonce}"))
    }

    fn parse(profile: &'static JsonlProfile, log: &Path) -> ParseBatch {
        let cursor = ParserCursor {
            source_path: log.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        };
        JsonlFamilyParser::new(profile)
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap()
    }

    #[test]
    fn a_nested_tool_result_with_a_diff_is_an_edit() {
        let home = temp_home("qwen");
        let log = home.join(".qwen/projects/p1/chats/s1.jsonl");
        write_log(
            &log,
            &[
                json!({"type": "user", "timestamp": "2026-10-26T10:00:00Z", "message": {"parts": [{"text": SECRET}]}}),
                json!({"type": "tool_result", "timestamp": "2026-10-26T10:00:01Z", "model": "qwen3-coder",
                   "message": {"parts": [{"functionResponse": {"id": "fc-1", "name": "replace",
                       "response": {"resultDisplay": {"fileName": "src/a.ts",
                           "fileDiff": format!("@@ -1 +1,2 @@\n-{SECRET}\n+x\n+y")}}}}]}}),
            ],
        );
        let batch = parse(&QWEN_CODE, &log);
        assert_eq!(batch.events.len(), 1);
        let edit = &batch.events[0];
        assert_eq!(edit.agent, "qwen-code");
        assert_eq!(edit.entity, PathBuf::from("src/a.ts"));
        assert_eq!((edit.lines_added, edit.lines_deleted), (Some(2), Some(1)));
        assert_eq!(edit.session_id.as_deref(), Some("s1"));
    }

    #[test]
    fn a_request_without_change_evidence_or_a_failed_result_is_not_an_edit() {
        let home = temp_home("pi");
        let log = home.join(".pi/agent/sessions/x/s.jsonl");
        write_log(
            &log,
            &[
                json!({"type": "message", "timestamp": "2026-10-26T10:00:00Z", "message": {"role": "assistant",
                   "content": [{"type": "toolCall", "id": "t1", "name": "write",
                                "arguments": {"path": "src/new.ts", "content": SECRET}}]}}),
                json!({"type": "message", "timestamp": "2026-10-26T10:00:01Z", "message": {"role": "toolResult",
                   "toolName": "edit", "isError": true, "details": {"path": "src/x.ts", "diff": "@@ -1 +1 @@\n-a\n+b"}}}),
                json!({"type": "message", "timestamp": "2026-10-26T10:00:02Z", "message": {"role": "toolResult",
                   "toolName": "edit", "path": "src/y.ts", "details": {"diff": "@@ -1 +1 @@\n-a\n+b"}}}),
                json!({"type": "message", "timestamp": "2026-10-26T10:00:03Z", "message": {"role": "toolResult",
                   "toolName": "read_file", "path": "src/y.ts", "details": {"diff": "x"}}}),
            ],
        );
        let batch = parse(&PI, &log);
        let paths: Vec<&Path> = batch
            .events
            .iter()
            .map(|event| event.entity.as_path())
            .collect();
        assert_eq!(paths, vec![Path::new("src/y.ts")]);
        assert_eq!(batch.events[0].agent, "pi");
    }

    #[test]
    fn line_counts_are_accepted_as_change_evidence() {
        let home = temp_home("kiro");
        let log = home.join(".kiro/sessions/abc/messages.jsonl");
        write_log(
            &log,
            &[
                json!({"type": "tool_result", "timestamp": 1_793_008_800_000_i64,
            "tool": "fs_write", "input": {"path": "/repo/b.rs"}, "result": {"linesAdded": 4, "linesRemoved": 0}}),
            ],
        );
        let batch = parse(&KIRO, &log);
        assert_eq!(batch.events.len(), 1);
        assert_eq!(batch.events[0].session_id.as_deref(), Some("abc"));
        assert_eq!(batch.events[0].lines_added, Some(4));
    }

    #[test]
    fn usage_is_read_once_per_record_with_model() {
        let home = temp_home("usage");
        let log = home.join(".factory/sessions/s.jsonl");
        write_log(
            &log,
            &[
                json!({"id": "m1", "timestamp": "2026-10-26T10:00:00Z", "message": {"model": "claude-sonnet-4",
                   "usage": {"input_tokens": 700, "output_tokens": 90, "cache_read_input_tokens": 10}}}),
                json!({"id": "m2", "timestamp": "2026-10-26T10:00:01Z", "usage": {"input_tokens": 0, "output_tokens": 0}}),
            ],
        );
        let records = JsonlFamilyParser::new(&FACTORY_DROID)
            .parse_usage(&log, None)
            .unwrap();
        assert_eq!(records.len(), 1);
        let usage = &records[0];
        assert_eq!(usage.usage_event_id, "factory-droid-usage-v1:s:m1");
        assert_eq!(
            (
                usage.input_tokens,
                usage.output_tokens,
                usage.cache_read_tokens
            ),
            (Some(700), Some(90), Some(10))
        );
        usage.validate().unwrap();
    }

    #[test]
    fn discovery_uses_each_profiles_file_rule() {
        let home = temp_home("discover");
        write_log(&home.join(".kimi/sessions/a/wire.jsonl"), &[json!({})]);
        write_log(&home.join(".kimi-code/b/wire.jsonl"), &[json!({})]);
        write_log(&home.join(".kimi-code/b/other.jsonl"), &[json!({})]);
        let context = DiscoveryContext {
            home_dir: home.clone(),
            config_override: None,
        };
        assert_eq!(
            JsonlFamilyParser::new(&KIMI)
                .discover_sources(&context)
                .len(),
            2
        );
        assert_eq!(
            JsonlFamilyParser::new(&QWEN_CODE).discover(&context).state,
            DiscoveryState::NotInstalled
        );
    }

    #[test]
    fn no_prompt_argument_or_diff_text_leaves_the_parser() {
        let home = temp_home("privacy");
        let log = home.join(".qwen/projects/p/chats/s.jsonl");
        write_log(
            &log,
            &[
                json!({"timestamp": "2026-10-26T10:00:00Z", "name": "edit", "path": "a.rs",
            "args": {"old": SECRET}, "diff": format!("@@ -1 +1 @@\n-{SECRET}\n+x"),
            "usage": {"input_tokens": 1, "output_tokens": 1}, "prompt": SECRET}),
            ],
        );
        let parser = JsonlFamilyParser::new(&QWEN_CODE);
        let batch = parse(&QWEN_CODE, &log);
        let rendered = format!(
            "{:?}{:?}{:?}",
            batch.events,
            batch.next_cursor,
            parser.parse_usage(&log, None).unwrap()
        );
        assert!(!rendered.contains(SECRET));
    }
}

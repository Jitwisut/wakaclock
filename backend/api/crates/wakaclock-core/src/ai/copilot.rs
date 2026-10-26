//! GitHub Copilot transcript adapter (VS Code chat/agent and Copilot CLI).
//!
//! Both surfaces write an append-only JSONL event log with the same envelope
//! (`{type, id, timestamp, data}`): VS Code under
//! `<editor>/User/workspaceStorage/<hash>/GitHub.copilot-chat/transcripts/*.jsonl` and the
//! CLI under `~/.copilot/session-state/<id>/events.jsonl`. One parser reads both and
//! labels each event with `producer_surface` (`vscode` or `cli`) under the single agent
//! ID `copilot`.
//!
//! A file edit is emitted only when a tool request that names a file is followed by a
//! successful completion for the same tool call; a model saying it edited a file is not
//! evidence. The record shapes for tool execution were not yet observed in a real local
//! transcript when this was written, so field names are matched tolerantly and an
//! unknown shape yields no edit rather than a guessed one. Copilot is a new runtime, so
//! its edits stay local dry-run evidence (`AdapterRuntime::emits_edit_heartbeats`).
//!
//! Prompt text, assistant content, reasoning and tool arguments other than a file path
//! are never kept: prompts contribute only a count and a character length.

use crate::ai::event::{opaque_file_event_id, AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::jsonl::JsonlCursorReader;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserContext, ParserCursor, ParserTurnContext,
};
use crate::ai::usage::{AiUsageRecord, TokenSource};
use crate::ai::{normalize_identity_model, normalize_identity_provider};
use crate::broker::BrokerChangeKind;
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

const AGENT: &str = "copilot";
const SESSION_TURN_ID: &str = "copilot-session";
/// A tool request whose completion has not arrived yet holds the cursor back so the
/// completion can be paired on the next pass. A request older than this never
/// completed (cancelled or crashed) and stops holding the cursor.
const PENDING_REQUEST_WINDOW_SECONDS: i64 = 10 * 60;
const EDIT_WORDS: [&str; 8] = [
    "edit",
    "write",
    "create",
    "replace",
    "insert",
    "apply_patch",
    "patch",
    "str_replace",
];
const READ_ONLY_WORDS: [&str; 6] = ["read", "view", "list", "search", "grep", "find"];
const EDITOR_DIRS: [&str; 3] = ["Code", "Code - Insiders", "VSCodium"];

pub struct CopilotParser;

impl CopilotParser {
    pub fn new() -> Self {
        Self
    }

    /// Directories that hold Copilot transcripts for this platform, most specific first.
    fn roots(context: &DiscoveryContext) -> Vec<(PathBuf, Surface)> {
        if let Some(root) = &context.config_override {
            return vec![(root.clone(), Surface::from_path(root))];
        }
        let home = &context.home_dir;
        let user_dirs: Vec<PathBuf> = EDITOR_DIRS
            .iter()
            .map(|editor| {
                if cfg!(target_os = "macos") {
                    home.join("Library/Application Support").join(editor)
                } else if cfg!(target_os = "windows") {
                    home.join("AppData/Roaming").join(editor)
                } else {
                    home.join(".config").join(editor)
                }
            })
            .map(|dir| dir.join("User").join("workspaceStorage"))
            .collect();
        let mut roots: Vec<(PathBuf, Surface)> = user_dirs
            .into_iter()
            .map(|dir| (dir, Surface::VsCode))
            .collect();
        roots.push((home.join(".copilot").join("session-state"), Surface::Cli));
        roots
    }

    fn transcripts(context: &DiscoveryContext) -> (bool, Vec<PathBuf>) {
        let mut any_root = false;
        let mut files = Vec::new();
        for (root, _) in Self::roots(context) {
            if !root.exists() {
                continue;
            }
            any_root = true;
            collect_transcripts(&root, 0, &mut files);
        }
        files.sort();
        (any_root, files)
    }
}

impl Default for CopilotParser {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Surface {
    VsCode,
    Cli,
}

impl Surface {
    /// VS Code paths contain `GitHub.copilot-chat`, which also contains the text
    /// `.copilot`, so the CLI is recognised by whole path components only.
    fn from_path(path: &Path) -> Self {
        let is_component = |name: &str| path.components().any(|part| part.as_os_str() == name);
        if path.to_string_lossy().contains("GitHub.copilot-chat") {
            Self::VsCode
        } else if is_component(".copilot") || is_component("session-state") {
            Self::Cli
        } else {
            Self::VsCode
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::VsCode => "vscode",
            Self::Cli => "cli",
        }
    }
}

/// Collect `GitHub.copilot-chat/transcripts/*.jsonl` (VS Code) and `events.jsonl`
/// (CLI) below `dir`. Depth is bounded; unreadable directories are skipped.
fn collect_transcripts(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 4 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_transcripts(&path, depth + 1, out);
        } else if is_transcript(&path) {
            out.push(path);
        }
    }
}

fn is_transcript(path: &Path) -> bool {
    if path.extension().is_none_or(|ext| ext != "jsonl") {
        return false;
    }
    let in_vscode_transcripts = path
        .parent()
        .is_some_and(|parent| parent.ends_with("GitHub.copilot-chat/transcripts"));
    let is_cli_events = path.file_name().is_some_and(|name| name == "events.jsonl");
    in_vscode_transcripts || is_cli_events
}

impl AiActivityParser for CopilotParser {
    fn id(&self) -> &'static str {
        AGENT
    }

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult {
        let (any_root, files) = Self::transcripts(context);
        let newest = files.into_iter().max_by_key(|path| {
            fs::metadata(path)
                .and_then(|metadata| metadata.modified())
                .ok()
        });
        DiscoveryResult {
            state: match (any_root, newest) {
                (false, _) => DiscoveryState::NotInstalled,
                (true, Some(path)) => DiscoveryState::TranscriptFound { path },
                (true, None) => DiscoveryState::InstalledNoTranscript,
            },
        }
    }

    fn discover_sources(&self, context: &DiscoveryContext) -> Vec<DiscoveryResult> {
        let (any_root, files) = Self::transcripts(context);
        if !any_root {
            return vec![DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            }];
        }
        if files.is_empty() {
            return vec![DiscoveryResult {
                state: DiscoveryState::InstalledNoTranscript,
            }];
        }
        files
            .into_iter()
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
        let path = PathBuf::from(&cursor.source_path);
        let surface = Surface::from_path(&path);
        let mut reader = JsonlCursorReader::open(&path, cursor.byte_offset).map_err(|error| {
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
        let mut session = SessionState::from_cursor(cursor);
        let mut pending: HashMap<String, PendingRequest> = HashMap::new();
        let mut events = Vec::new();
        let mut warnings = Vec::new();
        let mut offset = cursor.byte_offset;
        let mut last_id = cursor.last_record_id.clone();
        let mut last_time = cursor.last_record_time;
        let mut newest_record: Option<DateTime<Utc>> = None;

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
                    message: "skipped oversized copilot transcript record".to_string(),
                });
                continue;
            }
            let Ok(record) = serde_json::from_str::<Value>(&line.text) else {
                warnings.push(ParseWarning {
                    record_id: None,
                    message: "skipped malformed copilot transcript record".to_string(),
                });
                continue;
            };
            let record_type = string_at(&record, &["type"]).unwrap_or_default();
            let data = record.get("data").unwrap_or(&Value::Null);
            let occurred_at = timestamp(&record).unwrap_or_else(Utc::now);
            newest_record = newest_record.max(Some(occurred_at));
            session.observe(&record_type, data);
            for request in tool_requests(&record_type, data) {
                pending.insert(
                    request.call_id.clone(),
                    PendingRequest {
                        request,
                        offset_before: line.offset_before,
                        occurred_at,
                    },
                );
            }
            let Some(completion) = tool_completion(&record_type, data) else {
                continue;
            };
            let Some(pending_request) = pending.remove(&completion.call_id) else {
                continue;
            };
            if !completion.success {
                continue;
            }
            if let Some(event) = edit_event(
                &pending_request.request,
                &completion,
                &session,
                surface,
                occurred_at,
            ) {
                last_id = Some(event.event_id.clone());
                last_time = Some(event.occurred_at);
                events.push(event);
            }
        }

        // Hold the cursor at the oldest request still waiting for its completion, so
        // the pair is found next pass. Re-emitted events keep the same ID. A request the
        // log has moved well past is treated as abandoned, measured against the newest
        // record read rather than the wall clock so replaying old logs behaves the same.
        let horizon = newest_record.unwrap_or_else(Utc::now);
        if let Some(rewind) = pending
            .values()
            .filter(|waiting| {
                waiting.request.edits_a_file()
                    && (horizon - waiting.occurred_at).num_seconds()
                        < PENDING_REQUEST_WINDOW_SECONDS
            })
            .map(|waiting| waiting.offset_before)
            .min()
        {
            offset = offset.min(rewind);
        }

        Ok(ParseBatch {
            events,
            next_cursor: ParserCursor {
                source_path: cursor.source_path.clone(),
                file_identity: cursor.file_identity.clone(),
                byte_offset: offset,
                last_record_id: last_id,
                last_record_time: last_time,
                context: Some(session.into_context(cursor.context.as_ref())),
            },
            warnings,
        })
    }

    fn parse_usage(
        &self,
        source: &Path,
        _cursor: Option<&ParserCursor>,
    ) -> std::io::Result<Vec<AiUsageRecord>> {
        let contents = fs::read_to_string(source)?;
        Ok(parse_copilot_usage_str(&contents))
    }
}

/// Session facts carried across parse passes: the session ID and the latest model.
struct SessionState {
    session_id: Option<String>,
    model: Option<String>,
}

impl SessionState {
    fn from_cursor(cursor: &ParserCursor) -> Self {
        let context = cursor.context.as_ref();
        Self {
            session_id: context.and_then(|context| context.session_id.clone()),
            model: context.and_then(|context| {
                context
                    .turns
                    .iter()
                    .find(|turn| turn.id == SESSION_TURN_ID)
                    .and_then(|turn| turn.model.clone())
            }),
        }
    }

    fn observe(&mut self, record_type: &str, data: &Value) {
        if let Some(session_id) = string_at(data, &["sessionId", "session_id"]) {
            if record_type == "session.start" || self.session_id.is_none() {
                self.session_id = Some(session_id);
            }
        }
        if let Some(model) = string_at(
            data,
            &[
                "newModel",
                "selectedModel",
                "model",
                "modelId",
                "resolvedModel",
            ],
        ) {
            self.model = normalize_identity_model(Some(&model));
        }
    }

    fn into_context(self, previous: Option<&ParserContext>) -> ParserContext {
        let mut context = previous.cloned().unwrap_or_default();
        context.session_id = self.session_id;
        context.turns.retain(|turn| turn.id != SESSION_TURN_ID);
        context.turns.push(ParserTurnContext {
            id: SESSION_TURN_ID.to_string(),
            cwd: None,
            model: self.model,
            identity_reason: None,
            identity_conflict: false,
        });
        context
    }
}

#[derive(Debug, Clone)]
struct ToolRequest {
    call_id: String,
    name: String,
    path: Option<String>,
}

impl ToolRequest {
    fn edits_a_file(&self) -> bool {
        let name = self.name.to_ascii_lowercase();
        self.path.is_some()
            && EDIT_WORDS.iter().any(|word| name.contains(word))
            && !READ_ONLY_WORDS.iter().any(|word| name.contains(word))
    }

    fn change_kind(&self) -> BrokerChangeKind {
        if self.name.to_ascii_lowercase().contains("create") {
            BrokerChangeKind::Create
        } else {
            BrokerChangeKind::Modify
        }
    }
}

struct PendingRequest {
    request: ToolRequest,
    offset_before: u64,
    occurred_at: DateTime<Utc>,
}

struct ToolCompletion {
    call_id: String,
    success: bool,
    lines_added: Option<u32>,
    lines_deleted: Option<u32>,
}

/// Tool requests announced by this record: the `toolRequests` of an assistant message,
/// or a `tool.execution_start` event.
fn tool_requests(record_type: &str, data: &Value) -> Vec<ToolRequest> {
    let mut requests = Vec::new();
    if let Some(list) = data.get("toolRequests").and_then(Value::as_array) {
        requests.extend(list.iter().filter_map(tool_request));
    }
    if record_type == "tool.execution_start" {
        requests.extend(tool_request(data));
    }
    requests
}

fn tool_request(value: &Value) -> Option<ToolRequest> {
    let call_id = string_at(value, &["toolCallId", "callId", "id"])?;
    let name = string_at(value, &["name", "toolName", "tool"])?;
    let arguments = match value.get("arguments").or_else(|| value.get("input")) {
        Some(Value::String(text)) => serde_json::from_str::<Value>(text).unwrap_or(Value::Null),
        Some(other) => other.clone(),
        None => Value::Null,
    };
    let path = string_at(&arguments, &["filePath", "file_path", "path", "uri"]).map(|raw| {
        raw.strip_prefix("file://")
            .map(str::to_string)
            .unwrap_or(raw)
    });
    Some(ToolRequest {
        call_id,
        name,
        path,
    })
}

fn tool_completion(record_type: &str, data: &Value) -> Option<ToolCompletion> {
    if !matches!(
        record_type,
        "tool.execution_complete" | "tool.execution_end" | "tool.result"
    ) {
        return None;
    }
    let call_id = string_at(data, &["toolCallId", "callId", "id"])?;
    let result_type = string_at(data, &["resultType", "status"])
        .or_else(|| {
            data.get("result")
                .and_then(|result| string_at(result, &["resultType", "status"]))
        })
        .map(|value| value.to_ascii_lowercase());
    let failed = data.get("success").and_then(Value::as_bool) == Some(false)
        || data.get("error").is_some_and(|error| !error.is_null())
        || result_type.as_deref().is_some_and(|value| {
            [
                "failure",
                "failed",
                "error",
                "rejected",
                "cancelled",
                "denied",
            ]
            .contains(&value)
        });
    Some(ToolCompletion {
        call_id,
        success: !failed,
        lines_added: find_count(
            data,
            &["linesAdded", "addedLines", "lines_added", "linesInserted"],
            3,
        ),
        lines_deleted: find_count(
            data,
            &[
                "linesRemoved",
                "removedLines",
                "lines_removed",
                "linesDeleted",
                "deletedLines",
            ],
            3,
        ),
    })
}

fn edit_event(
    request: &ToolRequest,
    completion: &ToolCompletion,
    session: &SessionState,
    surface: Surface,
    occurred_at: DateTime<Utc>,
) -> Option<AiEditEvent> {
    if !request.edits_a_file() {
        return None;
    }
    let path = request.path.as_deref()?;
    let session_id = session.session_id.clone();
    let operation = format!(
        "{}:{}",
        session_id.as_deref().unwrap_or("unknown-session"),
        request.call_id
    );
    Some(AiEditEvent {
        event_id: opaque_file_event_id("copilot-v1", &operation, path),
        agent: AGENT.to_string(),
        provider: normalize_identity_provider(Some("github")),
        model: session.model.clone(),
        session_id,
        turn_id: None,
        identity_message_id: None,
        identity_status: None,
        identity_reason: None,
        identity_source: Some(AiEventSource::Transcript.as_str().to_string()),
        tool_event_id: Some(request.call_id.clone()),
        producer_surface: Some(surface.label().to_string()),
        occurred_at,
        entity: PathBuf::from(path),
        project_root: None,
        change_kind: request.change_kind(),
        previous_entity: None,
        lines_added: completion.lines_added,
        lines_deleted: completion.lines_deleted,
        input_tokens: None,
        output_tokens: None,
        source: AiEventSource::Transcript,
        confidence: AiConfidence::Verified,
    })
}

/// Token usage reported by Copilot events, with the prompts submitted since the
/// previous usage record. Only counts and lengths leave this function.
pub fn parse_copilot_usage_str(contents: &str) -> Vec<AiUsageRecord> {
    let mut session_id = "unknown-session".to_string();
    let mut model: Option<String> = None;
    let mut pending_prompts = 0u32;
    let mut pending_chars = 0u64;
    let mut records = Vec::new();
    for line in contents.lines() {
        let Ok(record) = serde_json::from_str::<Value>(line.trim()) else {
            continue;
        };
        let record_type = string_at(&record, &["type"]).unwrap_or_default();
        let data = record.get("data").unwrap_or(&Value::Null);
        if let Some(id) = string_at(data, &["sessionId", "session_id"]) {
            session_id = id;
        }
        if let Some(name) = string_at(
            data,
            &[
                "newModel",
                "selectedModel",
                "model",
                "modelId",
                "resolvedModel",
            ],
        ) {
            model = normalize_identity_model(Some(&name));
        }
        if record_type == "user.message" {
            pending_prompts += 1;
            pending_chars += data
                .get("content")
                .and_then(Value::as_str)
                .map(|text| text.chars().count() as u64)
                .unwrap_or(0);
            continue;
        }
        let usage = data.get("usage").unwrap_or(data);
        let input = find_count(
            usage,
            &[
                "inputTokens",
                "input_tokens",
                "promptTokens",
                "prompt_tokens",
            ],
            1,
        );
        let output = find_count(
            usage,
            &[
                "outputTokens",
                "output_tokens",
                "completionTokens",
                "completion_tokens",
            ],
            1,
        );
        let cache_read = find_count(
            usage,
            &["cacheReadTokens", "cache_read_tokens", "cachedTokens"],
            1,
        );
        let cache_write = find_count(usage, &["cacheWriteTokens", "cache_write_tokens"], 1);
        if input.is_none() && output.is_none() && cache_read.is_none() && cache_write.is_none() {
            continue;
        }
        let (Some(event_id), Some(occurred_at)) = (string_at(&record, &["id"]), timestamp(&record))
        else {
            continue;
        };
        records.push(AiUsageRecord {
            usage_event_id: format!("copilot-usage-v1:{event_id}"),
            ai_session_id: session_id.clone(),
            collector_id: None,
            occurred_at,
            agent: AGENT.to_string(),
            provider: normalize_identity_provider(Some("github")),
            model: model.clone(),
            prompt_count: pending_prompts,
            prompt_character_count: (pending_chars > 0).then_some(pending_chars),
            input_tokens: input.map(u64::from),
            output_tokens: output.map(u64::from),
            cache_read_tokens: cache_read.map(u64::from),
            cache_write_tokens: cache_write.map(u64::from),
            token_source: TokenSource::Transcript,
            project_hint: None,
        });
        pending_prompts = 0;
        pending_chars = 0;
    }
    records
}

fn string_at(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_string)
    })
}

fn timestamp(record: &Value) -> Option<DateTime<Utc>> {
    let raw = record.get("timestamp")?;
    if let Some(text) = raw.as_str() {
        return DateTime::parse_from_rfc3339(text)
            .ok()
            .map(|time| time.with_timezone(&Utc));
    }
    raw.as_i64()
        .and_then(DateTime::<Utc>::from_timestamp_millis)
}

/// A non-negative integer under one of `keys`, searched in `value` and up to
/// `max_depth` levels of nested objects (telemetry is often nested).
fn find_count(value: &Value, keys: &[&str], max_depth: usize) -> Option<u32> {
    let object = value.as_object()?;
    for key in keys {
        if let Some(count) = object.get(*key).and_then(Value::as_u64) {
            return u32::try_from(count).ok();
        }
    }
    if max_depth == 0 {
        return None;
    }
    object
        .values()
        .filter(|nested| nested.is_object())
        .find_map(|nested| find_count(nested, keys, max_depth - 1))
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("fixtures/copilot/agent_edit_session.jsonl");
    const SECRET: &str = "SECRET-MARKER-7f3a";

    fn temp_root(name: &str) -> PathBuf {
        let nonce = Utc::now().timestamp_nanos_opt().unwrap_or_default();
        std::env::temp_dir().join(format!("wakaclock-copilot-{name}-{nonce}"))
    }

    fn vscode_transcript(root: &Path, contents: &str) -> PathBuf {
        let dir = root
            .join("ws-hash")
            .join("GitHub.copilot-chat")
            .join("transcripts");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("session-1.jsonl");
        fs::write(&path, contents).unwrap();
        path
    }

    fn cursor_for(path: &Path, offset: u64) -> ParserCursor {
        ParserCursor {
            source_path: path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: offset,
            last_record_id: None,
            last_record_time: None,
            context: None,
        }
    }

    fn parse(path: &Path, offset: u64) -> ParseBatch {
        CopilotParser::new()
            .parse_since(&ParseContext::default(), Some(&cursor_for(path, offset)))
            .unwrap()
    }

    #[test]
    fn successful_file_edits_become_events_and_others_do_not() {
        let root = temp_root("edits");
        let path = vscode_transcript(&root, FIXTURE);
        let batch = parse(&path, 0);
        // The fixture has: an edit that succeeds, a file creation that succeeds, a read,
        // an edit that fails, and a request with no completion yet.
        let entities: Vec<String> = batch
            .events
            .iter()
            .map(|event| event.entity.to_string_lossy().into_owned())
            .collect();
        assert_eq!(entities, vec!["/repo/src/app.ts", "/repo/src/new.ts"]);
        let edit = &batch.events[0];
        assert_eq!(edit.agent, "copilot");
        assert_eq!(edit.producer_surface.as_deref(), Some("vscode"));
        assert_eq!(edit.session_id.as_deref(), Some("sess-1"));
        assert_eq!(edit.model.as_deref(), Some("gpt-4.1"));
        assert_eq!((edit.lines_added, edit.lines_deleted), (Some(3), Some(1)));
        assert_eq!(batch.events[1].change_kind, BrokerChangeKind::Create);
        assert_eq!(batch.events[1].lines_added, None);
    }

    #[test]
    fn a_request_without_its_completion_holds_the_cursor_back() {
        let root = temp_root("pending");
        let path = vscode_transcript(&root, FIXTURE);
        let batch = parse(&path, 0);
        let file_len = fs::metadata(&path).unwrap().len();
        assert!(batch.next_cursor.byte_offset < file_len);

        // Once the completion is appended, the next pass pairs it and re-emits the
        // earlier events with the same IDs.
        let completion = format!(
            "{}\n",
            serde_json::json!({"type":"tool.execution_complete","id":"e9","timestamp":"2026-10-26T10:00:09Z","data":{"toolCallId":"call-5","success":true}})
        );
        let mut contents = FIXTURE.to_string();
        contents.push_str(&completion);
        fs::write(&path, contents).unwrap();
        let next = CopilotParser::new()
            .parse_since(&ParseContext::default(), Some(&batch.next_cursor))
            .unwrap();
        assert!(next
            .events
            .iter()
            .any(|event| event.entity == Path::new("/repo/src/late.ts")));
        assert_eq!(
            next.next_cursor.byte_offset,
            fs::metadata(&path).unwrap().len()
        );
    }

    #[test]
    fn session_and_model_survive_a_resumed_pass() {
        let root = temp_root("resume");
        let path = vscode_transcript(&root, FIXTURE);
        let first = parse(&path, 0);
        let context = first.next_cursor.context.clone().unwrap();
        assert_eq!(context.session_id.as_deref(), Some("sess-1"));
        let state = SessionState::from_cursor(&first.next_cursor);
        assert_eq!(state.model.as_deref(), Some("gpt-4.1"));
    }

    #[test]
    fn a_vscode_path_is_not_mistaken_for_the_cli() {
        let vscode = Path::new(
            "/u/Library/Application Support/Code/User/workspaceStorage/h/GitHub.copilot-chat/transcripts/s.jsonl",
        );
        assert_eq!(Surface::from_path(vscode), Surface::VsCode);
        let cli = Path::new("/u/.copilot/session-state/abc/events.jsonl");
        assert_eq!(Surface::from_path(cli), Surface::Cli);
    }

    #[test]
    fn cli_events_are_labelled_cli() {
        let root = temp_root("cli");
        let dir = root.join(".copilot").join("session-state").join("abc");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("events.jsonl");
        fs::write(&path, FIXTURE).unwrap();
        let batch = parse(&path, 0);
        assert!(batch
            .events
            .iter()
            .all(|event| event.producer_surface.as_deref() == Some("cli")));
    }

    #[test]
    fn discovery_finds_both_surfaces_under_an_override_root() {
        let root = temp_root("discover");
        let vscode = vscode_transcript(&root, FIXTURE);
        let cli_dir = root.join("session-state").join("abc");
        fs::create_dir_all(&cli_dir).unwrap();
        fs::write(cli_dir.join("events.jsonl"), FIXTURE).unwrap();
        fs::write(root.join("unrelated.jsonl"), "{}\n").unwrap();
        let context = DiscoveryContext {
            home_dir: root.clone(),
            config_override: Some(root.clone()),
        };
        let found: Vec<PathBuf> = CopilotParser::new()
            .discover_sources(&context)
            .into_iter()
            .filter_map(|result| match result.state {
                DiscoveryState::TranscriptFound { path } => Some(path),
                _ => None,
            })
            .collect();
        assert_eq!(found.len(), 2);
        assert!(found.contains(&vscode));
        let missing = DiscoveryContext {
            home_dir: root.join("nobody"),
            config_override: Some(root.join("nobody")),
        };
        assert_eq!(
            CopilotParser::new().discover(&missing).state,
            DiscoveryState::NotInstalled
        );
    }

    #[test]
    fn usage_counts_prompts_and_tokens_without_content() {
        let records = parse_copilot_usage_str(FIXTURE);
        assert_eq!(records.len(), 1);
        let usage = &records[0];
        assert_eq!(usage.agent, "copilot");
        assert_eq!(usage.ai_session_id, "sess-1");
        assert_eq!(usage.prompt_count, 1);
        assert_eq!(
            usage.prompt_character_count,
            Some(SECRET.chars().count() as u64 + 11)
        );
        assert_eq!(
            (usage.input_tokens, usage.output_tokens),
            (Some(1200), Some(340))
        );
        usage.validate().unwrap();
    }

    #[test]
    fn no_prompt_reasoning_or_argument_text_leaves_the_parser() {
        let root = temp_root("privacy");
        let path = vscode_transcript(&root, FIXTURE);
        let batch = parse(&path, 0);
        let rendered = format!(
            "{:?}{:?}{:?}",
            batch.events,
            batch.next_cursor,
            parse_copilot_usage_str(FIXTURE)
        );
        assert!(FIXTURE.contains(SECRET));
        assert!(!rendered.contains(SECRET), "prompt/argument text leaked");
        assert!(!rendered.contains("private reasoning"));
    }

    #[test]
    fn a_line_still_being_written_is_left_for_the_next_pass() {
        let root = temp_root("partial");
        let path = vscode_transcript(
            &root,
            "{\"type\":\"session.start\",\"id\":\"e1\",\"timestamp\":\"2026-10-26T10:00:00Z\",\"data\":{\"sessionId\":\"s\"}}\n{\"type\":\"user.mes",
        );
        let batch = parse(&path, 0);
        assert!(batch.events.is_empty());
        assert!(batch.warnings.is_empty());
        assert!(batch.next_cursor.byte_offset < fs::metadata(&path).unwrap().len());
    }
}

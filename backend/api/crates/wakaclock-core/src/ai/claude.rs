use crate::ai::event::{AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::jsonl::JsonlCursorReader;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserContext, ParserCursor, ParserPendingCall,
};
use crate::ai::{
    is_internal_marker, normalize_identity_model, normalize_identity_provider, IdentityStatus,
    REASON_CONFLICTING_EVIDENCE, REASON_INTERNAL_MARKER,
};
use crate::ai::patch::{
    count_content_lines, count_structured_patch_lines, LineDelta, StructuredPatchHunk,
};
use crate::ai::path::resolve_within_workspace;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Tool names whose result proves a file edit (plan.md 8.5.2: "Parse only tool-result
/// records that prove a file edit/write. A conversational claim ... is not evidence").
/// Kept in step with the PostToolUse matcher in the atoaxis-heartbeat plugin: a tool
/// that only one of the two knows about produces either a missing heartbeat or a
/// duplicate one. Edits a model makes through `Bash` (`sed -i`, a heredoc redirect) are
/// deliberately *not* here — a shell command cannot be reliably read as "these files
/// changed", and a wrong attribution is worse than a missing one. That gap needs a
/// file-watcher, not a bigger list.
const FILE_EDIT_TOOLS: [&str; 4] = ["Edit", "Write", "MultiEdit", "NotebookEdit"];

pub struct ClaudeCodeParser;

impl ClaudeCodeParser {
    pub fn new() -> Self {
        Self
    }

    fn projects_root(context: &DiscoveryContext) -> PathBuf {
        context
            .config_override
            .clone()
            .unwrap_or_else(|| context.home_dir.join(".claude").join("projects"))
    }
}

impl Default for ClaudeCodeParser {
    fn default() -> Self {
        Self::new()
    }
}

impl AiActivityParser for ClaudeCodeParser {
    fn id(&self) -> &'static str {
        "claude-code"
    }

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult {
        let root = Self::projects_root(context);
        if !root.exists() {
            return DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            };
        }

        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                return DiscoveryResult {
                    state: DiscoveryState::PermissionDenied { path: root },
                };
            }
            Err(_) => {
                return DiscoveryResult {
                    state: DiscoveryState::InstalledNoTranscript,
                };
            }
        };

        // One level: projects_root/<cwd-slug>/<session-uuid>.jsonl — bounded, no
        // recursive walk needed (plan.md 8.4: "Do not recursively scan a user's whole
        // home directory").
        let mut candidates = Vec::new();
        for project_dir in entries.flatten() {
            let project_path = project_dir.path();
            if !project_path.is_dir() {
                continue;
            }
            if let Ok(session_files) = fs::read_dir(&project_path) {
                for session_file in session_files.flatten() {
                    let path = session_file.path();
                    if path.extension().is_some_and(|ext| ext == "jsonl") {
                        candidates.push(path);
                    }
                }
            }
        }

        if candidates.is_empty() {
            return DiscoveryResult {
                state: DiscoveryState::InstalledNoTranscript,
            };
        }

        let latest = candidates
            .into_iter()
            .max_by_key(|path| fs::metadata(path).and_then(|m| m.modified()).ok());
        DiscoveryResult {
            state: DiscoveryState::TranscriptFound {
                path: latest.expect("non-empty candidates has a max"),
            },
        }
    }

    fn discover_sources(&self, context: &DiscoveryContext) -> Vec<DiscoveryResult> {
        let root = Self::projects_root(context);
        if !root.exists() {
            return vec![DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            }];
        }
        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                return vec![DiscoveryResult {
                    state: DiscoveryState::PermissionDenied { path: root },
                }]
            }
            Err(_) => {
                return vec![DiscoveryResult {
                    state: DiscoveryState::InstalledNoTranscript,
                }]
            }
        };
        let mut candidates = Vec::new();
        for project_dir in entries.flatten() {
            let project_path = project_dir.path();
            if !project_path.is_dir() {
                continue;
            }
            if let Ok(session_files) = fs::read_dir(project_path) {
                for session_file in session_files.flatten() {
                    let path = session_file.path();
                    if path.extension().is_some_and(|ext| ext == "jsonl") {
                        candidates.push(path);
                    }
                }
            }
        }
        candidates.sort();
        if candidates.is_empty() {
            vec![DiscoveryResult {
                state: DiscoveryState::InstalledNoTranscript,
            }]
        } else {
            candidates
                .into_iter()
                .map(|path| DiscoveryResult {
                    state: DiscoveryState::TranscriptFound { path },
                })
                .collect()
        }
    }

    fn parse_since(
        &self,
        context: &ParseContext,
        cursor: Option<&ParserCursor>,
    ) -> Result<ParseBatch, AiParseError> {
        let cursor = cursor.ok_or_else(|| AiParseError::NotFound {
            path: "<no cursor: call discover() first and seed a cursor from its path>".to_string(),
        })?;
        let source_path = PathBuf::from(&cursor.source_path);

        let replay_prefix = cursor.context.is_none() && cursor.byte_offset > 0;
        let read_offset = if replay_prefix { 0 } else { cursor.byte_offset };
        let mut reader = JsonlCursorReader::open(&source_path, read_offset).map_err(
            |error| match error.kind() {
                std::io::ErrorKind::NotFound => AiParseError::NotFound {
                    path: cursor.source_path.clone(),
                },
                std::io::ErrorKind::PermissionDenied => AiParseError::PermissionDenied {
                    path: cursor.source_path.clone(),
                },
                _ => AiParseError::Io(error),
            },
        )?;

        let mut events = Vec::new();
        let mut warnings = Vec::new();
        // tool_use_id -> model, populated from `assistant` records so it's available
        // once the matching `user`/tool_result record for the same call arrives later
        // in the stream (plan.md 8.5.2 capability note: model lives on the assistant
        // turn, not on the tool result).
        let saved_context = cursor.context.clone().unwrap_or_default();
        let mut pending_tool_uses: HashMap<String, PendingClaudeToolUse> = saved_context
            .pending_calls
            .iter()
            .map(|pending| {
                (
                    pending.id.clone(),
                    PendingClaudeToolUse {
                        model: normalize_identity_model(pending.model.as_deref()),
                        identity_reason: pending.identity_reason.clone(),
                        identity_message_id: pending.identity_message_id.clone(),
                        project_root: pending.cwd.clone().map(PathBuf::from),
                        identity_conflict: pending.identity_conflict,
                        offset_before: pending.offset_before.unwrap_or(cursor.byte_offset),
                        occurred_at: pending.occurred_at,
                    },
                )
            })
            .collect();
        let mut session_id = saved_context.session_id.clone();
        let mut last_offset = read_offset;
        let mut last_record_time: Option<DateTime<Utc>> = cursor.last_record_time;
        let mut last_record_id: Option<String> = cursor.last_record_id.clone();

        while events.len() < context.max_batch_records {
            let line = match reader.next_line(context.max_record_bytes) {
                Ok(Some(line)) => line,
                Ok(None) => break,
                Err(error) => return Err(AiParseError::Io(error)),
            };
            last_offset = line.offset_after;

            if line.too_large {
                warnings.push(ParseWarning {
                    record_id: None,
                    message: "skipped oversized claude code transcript record".to_string(),
                });
                continue;
            }
            if line.text.trim().is_empty() {
                continue;
            }

            let record: ClaudeRecord = match serde_json::from_str(&line.text) {
                Ok(record) => record,
                Err(error) => {
                    warnings.push(ParseWarning {
                        record_id: None,
                        message: format!("malformed claude code record: {error}"),
                    });
                    continue;
                }
            };
            if let Some(next_session_id) = record.session_id.clone() {
                if session_id
                    .as_deref()
                    .is_some_and(|current| current != next_session_id)
                {
                    // A transcript file can contain resumed sessions. Pending
                    // tool IDs are scoped to their session; retaining them across
                    // a boundary could attach a result to the wrong model.
                    pending_tool_uses.clear();
                }
                session_id = Some(next_session_id);
            }

            match record.record_type.as_str() {
                "assistant" => {
                    let Some(message) = record.message else {
                        continue;
                    };
                    let blocks = match message.content {
                        Some(ClaudeMessageContent::Blocks(blocks)) => blocks,
                        // Claude records also contain ordinary text, progress maps, and
                        // other non-tool content. Those are valid records, but they do
                        // not prove a file edit and must not become parse warnings.
                        Some(ClaudeMessageContent::Other(_)) | None => continue,
                    };
                    for block in blocks {
                        if block.block_type == "tool_use"
                            && FILE_EDIT_TOOLS.contains(&block.name.as_deref().unwrap_or(""))
                        {
                            if let Some(id) = block.id {
                                let reported_model =
                                    normalize_identity_model(message.model.as_deref());
                                let reported_identity_reason = message
                                    .model
                                    .as_deref()
                                    .filter(|value| is_internal_marker(value))
                                    .map(|_| REASON_INTERNAL_MARKER.to_string());
                                let reported_message_id = message
                                    .id
                                    .as_deref()
                                    .and_then(|value| {
                                        crate::ai::normalize_identity_reference(Some(value))
                                    });
                                let mut identity_conflict = false;
                                let (
                                    model,
                                    identity_message_id,
                                    project_root,
                                    offset_before,
                                    occurred_at,
                                    identity_reason,
                                ) =
                                    if let Some(previous) = pending_tool_uses.get(&id) {
                                        identity_conflict = previous.identity_conflict;
                                        if previous.model.as_deref() != reported_model.as_deref()
                                            && previous.model.is_some()
                                            && reported_model.is_some()
                                        {
                                            identity_conflict = true;
                                        }
                                        if previous.identity_message_id.as_deref()
                                            != reported_message_id.as_deref()
                                            && previous.identity_message_id.is_some()
                                            && reported_message_id.is_some()
                                        {
                                            // A tool id appearing under two assistant
                                            // messages is ambiguous even when both
                                            // messages report the same model. Do not
                                            // silently keep whichever record was read
                                            // last as the authoring evidence.
                                            identity_conflict = true;
                                        }

                                        // Duplicate assistant records are emitted by some
                                        // Claude clients while a tool call is streamed. Keep
                                        // the strongest evidence already observed when a
                                        // later duplicate omits the model or cwd, and retain
                                        // the earliest record for restart-safe checkpointing.
                                        let model =
                                            reported_model.or_else(|| previous.model.clone());
                                        let identity_reason = model.is_none().then(|| {
                                            reported_identity_reason
                                                .clone()
                                                .or_else(|| previous.identity_reason.clone())
                                        }).flatten();
                                        (
                                            model,
                                            reported_message_id
                                                .or_else(|| previous.identity_message_id.clone()),
                                            record
                                                .cwd
                                                .clone()
                                                .map(PathBuf::from)
                                                .or_else(|| previous.project_root.clone()),
                                            previous.offset_before.min(line.offset_before),
                                            previous.occurred_at.or(record.timestamp),
                                            identity_reason,
                                        )
                                    } else {
                                        (
                                            reported_model,
                                            reported_message_id,
                                            record.cwd.clone().map(PathBuf::from),
                                            line.offset_before,
                                            record.timestamp,
                                            reported_identity_reason,
                                        )
                                    };
                                if let Some(previous) = pending_tool_uses.get(&id) {
                                    // Keep a conflict sticky across duplicate records; a
                                    // later record must not silently downgrade it.
                                    if previous.identity_conflict {
                                        identity_conflict = true;
                                    }
                                }
                                pending_tool_uses.insert(
                                    id,
                                    PendingClaudeToolUse {
                                        model: (!identity_conflict).then_some(model).flatten(),
                                        identity_reason: identity_conflict
                                            .then(|| REASON_CONFLICTING_EVIDENCE.to_string())
                                            .or(identity_reason),
                                        identity_message_id: (!identity_conflict)
                                            .then_some(identity_message_id)
                                            .flatten(),
                                        project_root,
                                        identity_conflict,
                                        offset_before,
                                        occurred_at,
                                    },
                                );
                            }
                        }
                    }
                }
                "user" => {
                    let Some(message) = &record.message else {
                        continue;
                    };
                    let Some(blocks) = message.content.as_ref().and_then(|content| match content {
                        ClaudeMessageContent::Blocks(blocks) => Some(blocks),
                        ClaudeMessageContent::Other(_) => None,
                    }) else {
                        continue;
                    };
                    let Some(block) = blocks.first() else {
                        continue;
                    };
                    if block.block_type != "tool_result" {
                        continue;
                    }
                    let Some(tool_use_id) = block.tool_use_id.clone() else {
                        continue;
                    };
                    last_record_id = Some(tool_use_id.clone());
                    // A tool_result is terminal for this tool_use_id, including
                    // failures and results that contain no file mutation. Remove
                    // the pending call before inspecting the optional result body;
                    // otherwise the cursor would rewind forever and replay the same
                    // failed/empty call on every sync.
                    let pending = pending_tool_uses.remove(&tool_use_id);
                    if block.is_error.unwrap_or(false) {
                        continue;
                    }

                    let Some(ClaudeToolUseResultValue::Object(result)) =
                        record.tool_use_result.as_ref()
                    else {
                        continue;
                    };
                    let Some(file_path) = result
                        .file_path
                        .clone()
                        .or_else(|| result.notebook_path.clone())
                    else {
                        continue;
                    };
                    // A populated structuredPatch proves an edit to existing content;
                    // an empty one with a content blob proves a brand-new file (see
                    // ClaudeToolUseResult's doc comment). Either is real evidence of a
                    // file mutation — a completely absent/empty result with no content
                    // is not, and is skipped rather than counted as a zero-line edit.
                    let hunks = result.structured_patch.clone().unwrap_or_default();
                    let delta = if !hunks.is_empty() {
                        count_structured_patch_lines(&hunks)
                    } else if let Some(content) =
                        result.content.as_deref().filter(|c| !c.is_empty())
                    {
                        LineDelta {
                            added: count_content_lines(content),
                            deleted: 0,
                        }
                    } else {
                        continue;
                    };
                    let Some(timestamp) = record.timestamp else {
                        continue;
                    };
                    last_record_time = Some(timestamp);
                    let project_root =
                        record.cwd.clone().map(PathBuf::from).or_else(|| {
                            pending.as_ref().and_then(|tool| tool.project_root.clone())
                        });
                    let entity = resolve_entity(&file_path, project_root.as_deref());
                    let identity_conflict = pending
                        .as_ref()
                        .is_some_and(|tool| tool.identity_conflict);
                    // A conflicting assistant message is evidence that we cannot
                    // safely attribute this edit to either model. Keep the
                    // activity, but never leak the first model we happened to
                    // observe into the canonical tuple.
                    let model = pending
                        .as_ref()
                        .filter(|tool| !tool.identity_conflict)
                        .and_then(|tool| tool.model.clone());
                    let identity_message_id = pending
                        .as_ref()
                        .and_then(|tool| tool.identity_message_id.clone());
                    let identity_reason = pending
                        .as_ref()
                        .and_then(|tool| tool.identity_reason.clone());

                    if replay_prefix && line.offset_before < cursor.byte_offset {
                        continue;
                    }
                    events.push(AiEditEvent {
                        event_id: format!("claude-code-v1:{tool_use_id}"),
                        agent: "claude-code".to_string(),
                        provider: (!identity_conflict).then(|| "anthropic".to_string()),
                        model: normalize_identity_model(model.as_deref()),
                        session_id: record.session_id.clone().or_else(|| session_id.clone()),
                        turn_id: None,
                        identity_message_id,
                        identity_status: identity_conflict
                            .then(|| IdentityStatus::Conflict.as_str().to_string())
                            .or_else(|| identity_reason.as_ref().map(|_| IdentityStatus::Partial.as_str().to_string())),
                        identity_reason: identity_conflict
                            .then(|| REASON_CONFLICTING_EVIDENCE.to_string())
                            .or(identity_reason),
                        identity_source: Some(AiEventSource::Transcript.as_str().to_string()),
                        tool_event_id: Some(tool_use_id.clone()),
                        occurred_at: timestamp,
                        entity,
                        project_root,
                        change_kind: crate::broker::BrokerChangeKind::Modify,
                        previous_entity: None,
                        lines_added: Some(delta.added),
                        lines_deleted: Some(delta.deleted),
                        input_tokens: None,
                        output_tokens: None,
                        source: AiEventSource::Transcript,
                        confidence: AiConfidence::Verified,
                    });
                }
                _ => {}
            }
        }

        if let Some(offset) = pending_tool_uses
            .values()
            .map(|pending| pending.offset_before)
            .min()
        {
            // If the result has not arrived yet, rewind to the assistant
            // tool_use record. A later pass can then pair a result appended
            // after this checkpoint without losing its model context.
            last_offset = offset;
        }

        let pending_calls = pending_tool_uses
            .iter()
            .map(|(id, pending)| ParserPendingCall {
                id: id.clone(),
                turn_id: None,
                identity_message_id: pending.identity_message_id.clone(),
                model: pending.model.clone(),
                identity_reason: pending.identity_reason.clone(),
                identity_conflict: pending.identity_conflict,
                cwd: pending
                    .project_root
                    .as_ref()
                    .map(|path| path.to_string_lossy().into_owned()),
                input: None,
                occurred_at: pending.occurred_at,
                offset_before: Some(pending.offset_before),
            })
            .collect();

        Ok(ParseBatch {
            events,
            next_cursor: ParserCursor {
                source_path: cursor.source_path.clone(),
                file_identity: cursor.file_identity.clone(),
                byte_offset: last_offset,
                last_record_id,
                last_record_time,
                context: Some(ParserContext {
                    session_id,
                    session_cwd: None,
                    provider: normalize_identity_provider(Some("anthropic")),
                    provider_reason: None,
                    provider_conflict: false,
                    current_turn_id: None,
                    turns: Vec::new(),
                    pending_calls,
                }),
            },
            warnings,
        })
    }
}

fn resolve_entity(raw_path: &str, project_root: Option<&Path>) -> PathBuf {
    let candidate = Path::new(raw_path);
    match project_root {
        Some(root) => {
            resolve_within_workspace(root, candidate).unwrap_or_else(|_| candidate.to_path_buf())
        }
        None => candidate.to_path_buf(),
    }
}

#[derive(Debug, Deserialize)]
struct ClaudeRecord {
    #[serde(rename = "type")]
    record_type: String,
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    cwd: Option<String>,
    timestamp: Option<DateTime<Utc>>,
    message: Option<ClaudeMessage>,
    #[serde(rename = "toolUseResult")]
    tool_use_result: Option<ClaudeToolUseResultValue>,
}

#[derive(Debug)]
struct PendingClaudeToolUse {
    model: Option<String>,
    identity_reason: Option<String>,
    identity_message_id: Option<String>,
    project_root: Option<PathBuf>,
    identity_conflict: bool,
    offset_before: u64,
    occurred_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
struct ClaudeMessage {
    /// Stable assistant message id that owns the tool_use block. Older
    /// transcripts may omit it or call it `message_id`.
    #[serde(alias = "message_id")]
    id: Option<String>,
    model: Option<String>,
    content: Option<ClaudeMessageContent>,
}

/// A Claude transcript contains both structured content blocks and ordinary text or
/// progress objects. Keep the latter as an opaque value so valid non-edit records do
/// not look malformed to the parser; the value is never inspected or retained.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
#[allow(dead_code)]
enum ClaudeMessageContent {
    Blocks(Vec<ClaudeContentBlock>),
    Other(Value),
}

#[derive(Debug, Deserialize)]
struct ClaudeContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    id: Option<String>,
    name: Option<String>,
    #[serde(rename = "tool_use_id")]
    tool_use_id: Option<String>,
    #[serde(rename = "is_error")]
    is_error: Option<bool>,
}

/// Deliberately loose: Edit/Write results carry different key sets (see
/// CAPABILITIES.md) and MultiEdit's shape has not been directly verified. Both
/// verified shapes agree on `filePath`, but `structuredPatch` is only populated for an
/// *existing*-file edit — a brand-new file (`Write` with no prior content) reports an
/// **empty** `structuredPatch` and puts the whole file in `content` instead (found by
/// running this parser against a real session; see CAPABILITIES.md's correction note).
#[derive(Debug, Deserialize, Clone)]
#[serde(untagged)]
#[allow(dead_code)]
enum ClaudeToolUseResultValue {
    Object(ClaudeToolUseResult),
    Other(Value),
}

#[derive(Debug, Deserialize, Clone)]
struct ClaudeToolUseResult {
    #[serde(rename = "filePath")]
    file_path: Option<String>,
    /// `NotebookEdit`'s result shape has not been verified against a real transcript.
    /// The alias costs nothing and lets the event through if it turns out to use this
    /// key; if it uses neither, the tool is still covered by the PostToolUse hook.
    #[serde(rename = "notebookPath")]
    notebook_path: Option<String>,
    #[serde(rename = "structuredPatch")]
    structured_patch: Option<Vec<StructuredPatchHunk>>,
    content: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_fixture(name: &str, source_relative: &str) -> PathBuf {
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/claude_code/");
        let raw = fs::read_to_string(format!("{fixtures}{source_relative}")).unwrap();

        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-claude-test-{}-{name}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("session.jsonl");
        let mut file = fs::File::create(&path).unwrap();
        let compact: serde_json::Value = serde_json::from_str(&raw).unwrap();
        writeln!(file, "{}", serde_json::to_string(&compact).unwrap()).unwrap();
        path
    }

    fn assistant_record_line(tool_use_id: &str) -> String {
        serde_json::json!({
            "type": "assistant",
            "sessionId": "018f0000-aaaa-7000-8000-000000000001",
            "cwd": "/home/dev/example-project",
            "message": {
                "id": "msg_01ExampleAssistantMessage000001",
                "model": "claude-sonnet-5",
                "content": [
                    {"type": "tool_use", "id": tool_use_id, "name": "Edit", "input": {}}
                ]
            }
        })
        .to_string()
    }

    #[test]
    fn discover_reports_not_installed_when_projects_dir_is_absent() {
        let home = std::env::temp_dir().join(format!(
            "wakaclock-core-claude-discover-missing-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&home);
        let parser = ClaudeCodeParser::new();
        let result = parser.discover(&DiscoveryContext {
            home_dir: home,
            config_override: None,
        });
        assert_eq!(result.state, DiscoveryState::NotInstalled);
    }

    #[test]
    fn discover_finds_session_file_one_level_under_project_dir() {
        let home = std::env::temp_dir().join(format!(
            "wakaclock-core-claude-discover-found-{}",
            std::process::id()
        ));
        let project_dir = home
            .join(".claude")
            .join("projects")
            .join("-home-dev-example");
        fs::create_dir_all(&project_dir).unwrap();
        let session = project_dir.join("session.jsonl");
        fs::write(&session, "{}\n").unwrap();

        let parser = ClaudeCodeParser::new();
        let result = parser.discover(&DiscoveryContext {
            home_dir: home,
            config_override: None,
        });
        match result.state {
            DiscoveryState::TranscriptFound { path } => assert_eq!(path, session),
            other => panic!("expected TranscriptFound, got {other:?}"),
        }
    }

    #[test]
    fn parse_since_extracts_edit_with_model_from_preceding_assistant_record() {
        let fixture_path = write_fixture("edit", "edit_tool_result.json");
        // Prepend the assistant tool_use record that names the model, matching real
        // stream order (assistant record precedes its tool_result).
        let assistant_line = assistant_record_line("toolu_01ExampleEditCallId000001");
        let existing = fs::read_to_string(&fixture_path).unwrap();
        fs::write(&fixture_path, format!("{assistant_line}\n{existing}")).unwrap();

        let parser = ClaudeCodeParser::new();
        let cursor = ParserCursor {
            source_path: fixture_path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        };
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap();

        assert_eq!(batch.events.len(), 1);
        let event = &batch.events[0];
        assert_eq!(event.lines_added, Some(2));
        assert_eq!(event.lines_deleted, Some(2));
        assert_eq!(event.model.as_deref(), Some("claude-sonnet-5"));
        assert_eq!(
            event.identity_message_id.as_deref(),
            Some("msg_01ExampleAssistantMessage000001")
        );
        assert_eq!(
            event.event_id,
            "claude-code-v1:toolu_01ExampleEditCallId000001"
        );
        assert_eq!(event.source, AiEventSource::Transcript);
        assert_eq!(event.confidence, AiConfidence::Verified);
        assert!(event.entity.ends_with("greeting.rs"));
    }

    #[test]
    fn parse_since_treats_new_file_write_as_pure_addition() {
        let fixture_path = write_fixture("write", "write_tool_result.json");
        let parser = ClaudeCodeParser::new();
        let cursor = ParserCursor {
            source_path: fixture_path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        };
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap();

        assert_eq!(batch.events.len(), 1);
        assert_eq!(batch.events[0].lines_added, Some(3));
        assert_eq!(batch.events[0].lines_deleted, Some(0));
        // No preceding assistant record in this fixture: model is honestly unknown,
        // never guessed.
        assert_eq!(batch.events[0].model, None);
    }

    #[test]
    fn parse_since_skips_failed_tool_results() {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-claude-error-{}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("session.jsonl");
        let record = serde_json::json!({
            "type": "user",
            "sessionId": "s1",
            "cwd": "/home/dev/example-project",
            "timestamp": "2026-08-14T09:00:00.000Z",
            "message": {"content": [{"type": "tool_result", "tool_use_id": "toolu_err", "is_error": true}]},
            "toolUseResult": {"filePath": "/home/dev/example-project/src/x.rs", "structuredPatch": []}
        });
        fs::write(
            &path,
            format!("{}\n", serde_json::to_string(&record).unwrap()),
        )
        .unwrap();

        let parser = ClaudeCodeParser::new();
        let cursor = ParserCursor {
            source_path: path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        };
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap();
        assert!(batch.events.is_empty());
    }

    #[test]
    fn failed_tool_result_releases_pending_context() {
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-claude-failed-pending-{}",
            std::process::id()
        ));
        let records = [
            serde_json::json!({
                "type": "assistant",
                "sessionId": "s-failed",
                "message": {
                    "model": "claude-sonnet-5",
                    "content": [{"type": "tool_use", "id": "edit-failed", "name": "Edit"}]
                }
            }),
            serde_json::json!({
                "type": "user",
                "sessionId": "s-failed",
                "timestamp": "2026-09-06T10:00:00Z",
                "message": {
                    "content": [{"type": "tool_result", "tool_use_id": "edit-failed", "is_error": true}]
                },
                "toolUseResult": {
                    "filePath": "/workspace/src/lib.rs",
                    "structuredPatch": [{"oldStart": 1, "oldLines": 1, "newStart": 1, "newLines": 2, "lines": ["-old", "+new", "+line"]}]
                }
            }),
        ];
        fs::write(
            &path,
            records
                .iter()
                .map(serde_json::Value::to_string)
                .collect::<Vec<_>>()
                .join("\n")
                + "\n",
        )
        .unwrap();

        let parser = ClaudeCodeParser::new();
        let cursor = ParserCursor {
            source_path: path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        };
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap();
        assert!(batch.events.is_empty());
        assert!(batch
            .next_cursor
            .context
            .as_ref()
            .is_some_and(|context| context.pending_calls.is_empty()));
        assert_eq!(
            batch.next_cursor.byte_offset,
            fs::metadata(&path).unwrap().len()
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn parse_since_ignores_non_edit_content_shapes_without_warnings() {
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-claude-shapes-{}",
            std::process::id()
        ));
        let records = [
            serde_json::json!({
                "type": "assistant",
                "message": {"content": "ordinary text"}
            }),
            serde_json::json!({
                "type": "user",
                "message": {
                    "content": [{"type": "tool_result", "tool_use_id": "bash-1"}]
                },
                "toolUseResult": "shell output"
            }),
            serde_json::json!({
                "type": "user",
                "message": {"content": {"progress": true}},
                "toolUseResult": []
            }),
        ];
        fs::write(
            &path,
            records
                .iter()
                .map(serde_json::Value::to_string)
                .collect::<Vec<_>>()
                .join("\n")
                + "\n",
        )
        .unwrap();

        let parser = ClaudeCodeParser::new();
        let cursor = ParserCursor {
            source_path: path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        };
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap();
        assert!(batch.events.is_empty());
        assert!(batch.warnings.is_empty());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn parse_since_uses_assistant_cwd_when_tool_result_omits_it() {
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-claude-cwd-fallback-{}",
            std::process::id()
        ));
        let records = [
            serde_json::json!({
                "type": "assistant",
                "cwd": "/workspace",
                "message": {
                    "model": "claude-sonnet-5",
                    "content": [{"type": "tool_use", "id": "edit-1", "name": "Edit"}]
                }
            }),
            serde_json::json!({
                "type": "user",
                "timestamp": "2026-09-06T10:00:00Z",
                "message": {
                    "content": [{"type": "tool_result", "tool_use_id": "edit-1"}]
                },
                "toolUseResult": {
                    "filePath": "src/lib.rs",
                    "structuredPatch": [{
                        "oldStart": 1,
                        "oldLines": 1,
                        "newStart": 1,
                        "newLines": 2,
                        "lines": ["-old", "+new", "+line"]
                    }]
                }
            }),
        ];
        fs::write(
            &path,
            records
                .iter()
                .map(serde_json::Value::to_string)
                .collect::<Vec<_>>()
                .join("\n")
                + "\n",
        )
        .unwrap();

        let parser = ClaudeCodeParser::new();
        let cursor = ParserCursor {
            source_path: path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        };
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap();
        assert_eq!(batch.events.len(), 1);
        let event = &batch.events[0];
        assert_eq!(event.project_root, Some(PathBuf::from("/workspace")));
        assert_eq!(event.entity, PathBuf::from("/workspace/src/lib.rs"));
        assert_eq!(event.model.as_deref(), Some("claude-sonnet-5"));
        assert_eq!(event.lines_added, Some(2));
        assert_eq!(event.lines_deleted, Some(1));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn internal_model_marker_stays_partial_and_never_becomes_a_model_name() {
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-claude-internal-model-{}",
            std::process::id()
        ));
        let records = [
            serde_json::json!({
                "type": "assistant",
                "sessionId": "marker-session",
                "cwd": "/workspace",
                "message": {
                    "id": "marker-message",
                    "model": "<synthetic>",
                    "content": [{"type": "tool_use", "id": "marker-edit", "name": "Edit"}]
                }
            }),
            serde_json::json!({
                "type": "user",
                "sessionId": "marker-session",
                "timestamp": "2026-09-06T10:00:00Z",
                "message": {
                    "content": [{"type": "tool_result", "tool_use_id": "marker-edit"}]
                },
                "toolUseResult": {
                    "filePath": "/workspace/src/lib.rs",
                    "structuredPatch": [{
                        "oldStart": 1,
                        "oldLines": 1,
                        "newStart": 1,
                        "newLines": 1,
                        "lines": ["-old", "+new"]
                    }]
                }
            }),
        ];
        fs::write(
            &path,
            records
                .iter()
                .map(serde_json::Value::to_string)
                .collect::<Vec<_>>()
                .join("\n")
                + "\n",
        )
        .unwrap();

        let batch = ClaudeCodeParser::new()
            .parse_since(
                &ParseContext::default(),
                Some(&ParserCursor {
                    source_path: path.to_string_lossy().into_owned(),
                    file_identity: None,
                    byte_offset: 0,
                    last_record_id: None,
                    last_record_time: None,
                    context: None,
                }),
            )
            .unwrap();

        assert_eq!(batch.events.len(), 1);
        assert_eq!(batch.events[0].model, None);
        assert_eq!(batch.events[0].identity_status.as_deref(), Some("partial"));
        assert_eq!(
            batch.events[0].identity_reason.as_deref(),
            Some(REASON_INTERNAL_MARKER)
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn reused_tool_id_across_assistant_messages_is_a_conflict() {
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-claude-message-conflict-{}",
            std::process::id()
        ));
        let assistant = |message_id: &str| {
            serde_json::json!({
                "type": "assistant",
                "sessionId": "conflict-session",
                "cwd": "/workspace",
                "message": {
                    "id": message_id,
                    "model": "claude-sonnet-5",
                    "content": [{"type": "tool_use", "id": "reused-edit", "name": "Edit"}]
                }
            })
        };
        let records = [
            assistant("message-one"),
            assistant("message-two"),
            serde_json::json!({
                "type": "user",
                "sessionId": "conflict-session",
                "timestamp": "2026-09-06T10:00:00Z",
                "message": {
                    "content": [{"type": "tool_result", "tool_use_id": "reused-edit"}]
                },
                "toolUseResult": {
                    "filePath": "/workspace/src/lib.rs",
                    "structuredPatch": [{
                        "oldStart": 1,
                        "oldLines": 1,
                        "newStart": 1,
                        "newLines": 1,
                        "lines": ["-old", "+new"]
                    }]
                }
            }),
        ];
        fs::write(
            &path,
            records
                .iter()
                .map(serde_json::Value::to_string)
                .collect::<Vec<_>>()
                .join("\n")
                + "\n",
        )
        .unwrap();

        let batch = ClaudeCodeParser::new()
            .parse_since(
                &ParseContext::default(),
                Some(&ParserCursor {
                    source_path: path.to_string_lossy().into_owned(),
                    file_identity: None,
                    byte_offset: 0,
                    last_record_id: None,
                    last_record_time: None,
                    context: None,
                }),
            )
            .unwrap();

        assert_eq!(batch.events.len(), 1);
        assert_eq!(batch.events[0].model, None);
        assert_eq!(batch.events[0].identity_message_id, None);
        assert_eq!(batch.events[0].identity_status.as_deref(), Some("conflict"));
        assert_eq!(
            batch.events[0].identity_reason.as_deref(),
            Some(REASON_CONFLICTING_EVIDENCE)
        );
        let _ = fs::remove_file(path);
    }
}

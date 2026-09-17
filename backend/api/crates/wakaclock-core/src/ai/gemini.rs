//! Gemini CLI transcript adapter.
//!
//! Gemini CLI has shipped more than one local transcript shape.  The adapter therefore
//! accepts the stable facts shared by the JSON/JSONL formats (tool name, file path,
//! patch/content, session, timestamp and model) and deliberately ignores conversational
//! content.  A record is emitted only when a successful file-edit tool result proves a
//! mutation; a model saying that it edited a file is not evidence.

use crate::ai::event::{opaque_file_event_id, AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::jsonl::JsonlCursorReader;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor,
};
use crate::ai::patch::{count_content_lines, count_unified_diff_lines};
use crate::ai::path::resolve_within_workspace;
use crate::ai::{normalize_identity_model, normalize_identity_provider};
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_WALK_DEPTH: usize = 5;
const EDIT_TOOLS: [&str; 8] = [
    "edit",
    "write",
    "write_file",
    "replace",
    "multiedit",
    "apply_patch",
    "patch",
    "save",
];

pub struct GeminiCliParser;

impl GeminiCliParser {
    pub fn new() -> Self {
        Self
    }

    fn root(context: &DiscoveryContext) -> PathBuf {
        context
            .config_override
            .clone()
            .unwrap_or_else(|| context.home_dir.join(".gemini").join("tmp"))
    }
}

impl Default for GeminiCliParser {
    fn default() -> Self {
        Self::new()
    }
}

fn walk(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) -> std::io::Result<()> {
    if depth > MAX_WALK_DEPTH {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() {
            walk(&path, depth + 1, out)?;
        } else if path
            .extension()
            .is_some_and(|ext| ext == "json" || ext == "jsonl")
        {
            out.push(path);
        }
    }
    Ok(())
}

impl AiActivityParser for GeminiCliParser {
    fn id(&self) -> &'static str {
        "gemini-cli"
    }

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult {
        let root = Self::root(context);
        if !root.exists() {
            return DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            };
        }
        let mut discovered = Vec::new();
        match walk(&root, 0, &mut discovered) {
            Ok(()) => {
                let mut files = discovered;
                files.retain(|path| {
                    path.extension()
                        .is_some_and(|ext| ext == "json" || ext == "jsonl")
                });
                match files.into_iter().max_by_key(|path| {
                    fs::metadata(path)
                        .and_then(|metadata| metadata.modified())
                        .ok()
                }) {
                    Some(path) => DiscoveryResult {
                        state: DiscoveryState::TranscriptFound { path },
                    },
                    None => DiscoveryResult {
                        state: DiscoveryState::InstalledNoTranscript,
                    },
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => DiscoveryResult {
                state: DiscoveryState::PermissionDenied { path: root },
            },
            Err(_) => DiscoveryResult {
                state: DiscoveryState::InstalledNoTranscript,
            },
        }
    }

    fn discover_sources(&self, context: &DiscoveryContext) -> Vec<DiscoveryResult> {
        let root = Self::root(context);
        if !root.exists() {
            return vec![DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            }];
        }
        let mut files = Vec::new();
        match walk(&root, 0, &mut files) {
            Ok(()) => {
                files.retain(|path| {
                    path.extension()
                        .is_some_and(|ext| ext == "json" || ext == "jsonl")
                });
                files.sort();
                if files.is_empty() {
                    vec![DiscoveryResult {
                        state: DiscoveryState::InstalledNoTranscript,
                    }]
                } else {
                    files
                        .into_iter()
                        .map(|path| DiscoveryResult {
                            state: DiscoveryState::TranscriptFound { path },
                        })
                        .collect()
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                vec![DiscoveryResult {
                    state: DiscoveryState::PermissionDenied { path: root },
                }]
            }
            Err(_) => vec![DiscoveryResult {
                state: DiscoveryState::InstalledNoTranscript,
            }],
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
        let path = PathBuf::from(&cursor.source_path);
        if path.extension().is_some_and(|ext| ext == "json") {
            return parse_json_document(&path, cursor);
        }

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
        let mut events = Vec::new();
        let mut warnings = Vec::new();
        let mut offset = cursor.byte_offset;
        let mut last_id = cursor.last_record_id.clone();
        let mut last_time = cursor.last_record_time;
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
                    message: "skipped oversized gemini transcript record".to_string(),
                });
                continue;
            }
            let Ok(value) = serde_json::from_str::<Value>(&line.text) else {
                warnings.push(ParseWarning {
                    record_id: None,
                    message: "skipped malformed gemini transcript record".to_string(),
                });
                continue;
            };
            if let Some(event) = parse_edit(&value, line.offset_after) {
                last_id = Some(event.event_id.clone());
                last_time = Some(event.occurred_at);
                events.push(event);
            }
        }
        Ok(ParseBatch {
            events,
            next_cursor: ParserCursor {
                source_path: cursor.source_path.clone(),
                file_identity: cursor.file_identity.clone(),
                byte_offset: offset,
                last_record_id: last_id,
                last_record_time: last_time,
                context: cursor.context.clone(),
            },
            warnings,
        })
    }
}

fn parse_json_document(path: &Path, cursor: &ParserCursor) -> Result<ParseBatch, AiParseError> {
    if cursor.byte_offset > 0 {
        return Ok(ParseBatch {
            events: Vec::new(),
            next_cursor: cursor.clone(),
            warnings: Vec::new(),
        });
    }
    let contents = fs::read_to_string(path).map_err(AiParseError::Io)?;
    let value: Value = serde_json::from_str(&contents)
        .map_err(|error| AiParseError::Malformed(error.to_string()))?;
    let records = value
        .get("messages")
        .or_else(|| value.get("entries"))
        .or_else(|| value.get("records"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| value.as_array().cloned().unwrap_or_default());
    let events = records
        .iter()
        .enumerate()
        .filter_map(|(index, record)| parse_edit(record, index as u64))
        .collect::<Vec<_>>();
    Ok(ParseBatch {
        events,
        next_cursor: ParserCursor {
            source_path: cursor.source_path.clone(),
            file_identity: cursor.file_identity.clone(),
            byte_offset: contents.len() as u64,
            last_record_id: None,
            last_record_time: None,
            context: cursor.context.clone(),
        },
        warnings: Vec::new(),
    })
}

fn parse_edit(value: &Value, offset: u64) -> Option<AiEditEvent> {
    let tool = first_string(value, &["tool_name", "toolName", "name", "tool", "action"])
        .map(|name| name.to_ascii_lowercase())?;
    if !EDIT_TOOLS.iter().any(|candidate| tool.contains(candidate)) {
        return None;
    }
    if first_bool(value, &["success", "ok"]).is_some_and(|success| !success) {
        return None;
    }
    let path = first_string(
        value,
        &["file_path", "filePath", "path", "filename", "file"],
    )?;
    let root = first_string(value, &["cwd", "working_directory", "workspace"]).map(PathBuf::from);
    let entity = root
        .as_deref()
        .and_then(|root| resolve_within_workspace(root, Path::new(&path)).ok())
        .unwrap_or_else(|| PathBuf::from(&path));
    let diff = first_string(value, &["unified_diff", "unifiedDiff", "patch", "diff"]);
    let content = first_string(value, &["new_content", "newContent", "content"]);
    let delta = diff.as_deref().map(count_unified_diff_lines).or_else(|| {
        content.as_deref().map(|text| crate::ai::patch::LineDelta {
            added: count_content_lines(text),
            deleted: 0,
        })
    })?;
    if delta.added == 0 && delta.deleted == 0 {
        return None;
    }
    let occurred_at = first_timestamp(value).unwrap_or_else(Utc::now);
    let operation_id = first_string(value, &["event_id", "eventId", "call_id", "callId", "id"])
        .unwrap_or_else(|| offset.to_string());
    let event_id = opaque_file_event_id("gemini-cli-v1", &operation_id, &path);
    Some(AiEditEvent {
        event_id,
        agent: "gemini-cli".to_string(),
        provider: normalize_identity_provider(Some("google")),
        model: normalize_identity_model(
            first_string(value, &["model", "model_name", "modelName"]).as_deref(),
        ),
        session_id: first_string(value, &["session_id", "sessionId", "session"]),
        turn_id: first_string(value, &["turn_id", "turnId"]),
        identity_message_id: first_string(value, &["message_id", "messageId"]),
        identity_status: None,
        identity_reason: None,
        identity_source: Some(AiEventSource::Transcript.as_str().to_string()),
        tool_event_id: Some(operation_id),
        producer_surface: None,
        occurred_at,
        entity,
        project_root: root,
        change_kind: crate::broker::BrokerChangeKind::Modify,
        previous_entity: None,
        lines_added: Some(delta.added),
        lines_deleted: Some(delta.deleted),
        input_tokens: None,
        output_tokens: None,
        source: AiEventSource::Transcript,
        confidence: AiConfidence::Verified,
    })
}

fn first_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str).map(str::to_string))
}

fn first_bool(value: &Value, keys: &[&str]) -> Option<bool> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_bool))
}

fn first_timestamp(value: &Value) -> Option<DateTime<Utc>> {
    let raw = ["timestamp", "time", "created_at", "createdAt"]
        .iter()
        .find_map(|key| value.get(*key))?;
    if let Some(number) = raw.as_f64() {
        let seconds = if number > 10_000_000_000.0 {
            number / 1000.0
        } else {
            number
        };
        return DateTime::from_timestamp(seconds as i64, 0);
    }
    raw.as_str()
        .and_then(|text| DateTime::parse_from_rfc3339(text).ok())
        .map(|date| date.with_timezone(&Utc))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn parses_verified_write_record_without_retaining_content() {
        let value = serde_json::json!({
            "type": "tool_result",
            "tool_name": "write_file",
            "id": "call-1",
            "file_path": "/workspace/src/lib.rs",
            "cwd": "/workspace",
            "timestamp": "2026-08-22T10:00:00Z",
            "model": "gemini-2.5-pro",
            "new_content": "fn main() {}\n"
        });
        let event = parse_edit(&value, 10).unwrap();
        assert_eq!(event.agent, "gemini-cli");
        assert_eq!(event.lines_added, Some(1));
        assert_eq!(event.entity, PathBuf::from("/workspace/src/lib.rs"));
        assert!(!event.event_id.contains("/workspace"));
        assert!(!event.event_id.contains("lib.rs"));
        let encoded = serde_json::to_string(&event).unwrap();
        assert!(!encoded.contains("fn main"));
    }

    #[test]
    fn parser_reads_jsonl_and_resumes() {
        let path = std::env::temp_dir().join(format!("gemini-parser-{}.jsonl", std::process::id()));
        let mut file = fs::File::create(&path).unwrap();
        writeln!(file, "{{\"tool\":\"apply_patch\",\"path\":\"src/a.ts\",\"diff\":\"@@ -0,0 +1 @@\\n+new\",\"timestamp\":\"2026-08-22T10:00:00Z\"}}").unwrap();
        let parser = GeminiCliParser::new();
        let cursor = ParserCursor {
            source_path: path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        };
        let first = parser
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap();
        assert_eq!(first.events.len(), 1);
        assert!(!first.events[0].event_id.contains("src/a.ts"));
        let second = parser
            .parse_since(&ParseContext::default(), Some(&first.next_cursor))
            .unwrap();
        assert!(second.events.is_empty());
        let _ = fs::remove_file(path);
    }
}

use crate::ai::event::{AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::jsonl::JsonlCursorReader;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor,
};
use crate::ai::patch::{
    count_content_lines, count_structured_patch_lines, LineDelta, StructuredPatchHunk,
};
use crate::ai::path::resolve_within_workspace;
use chrono::{DateTime, Utc};
use serde::Deserialize;
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

        let mut reader = JsonlCursorReader::open(&source_path, cursor.byte_offset).map_err(
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
        let mut pending_tool_use_models: HashMap<String, Option<String>> = HashMap::new();
        let mut last_offset = cursor.byte_offset;
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

            match record.record_type.as_str() {
                "assistant" => {
                    let Some(message) = record.message else {
                        continue;
                    };
                    for block in message.content.unwrap_or_default() {
                        if block.block_type == "tool_use"
                            && FILE_EDIT_TOOLS.contains(&block.name.as_deref().unwrap_or(""))
                        {
                            if let Some(id) = block.id {
                                pending_tool_use_models.insert(id, message.model.clone());
                            }
                        }
                    }
                }
                "user" => {
                    let Some(message) = &record.message else {
                        continue;
                    };
                    let Some(block) = message.content.as_ref().and_then(|c| c.first()) else {
                        continue;
                    };
                    if block.block_type != "tool_result" {
                        continue;
                    }
                    if block.is_error.unwrap_or(false) {
                        continue;
                    }
                    let Some(tool_use_id) = block.tool_use_id.clone() else {
                        continue;
                    };
                    last_record_id = Some(tool_use_id.clone());

                    let Some(result) = record.tool_use_result.as_ref() else {
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
                    let project_root = record.cwd.clone().map(PathBuf::from);
                    let entity = resolve_entity(&file_path, project_root.as_deref());
                    let model = pending_tool_use_models.remove(&tool_use_id).flatten();

                    events.push(AiEditEvent {
                        event_id: format!("claude-code-v1:{tool_use_id}"),
                        agent: "claude-code".to_string(),
                        provider: Some("anthropic".to_string()),
                        model,
                        session_id: record.session_id.clone(),
                        tool_event_id: Some(tool_use_id.clone()),
                        occurred_at: timestamp,
                        entity,
                        project_root,
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

        Ok(ParseBatch {
            events,
            next_cursor: ParserCursor {
                source_path: cursor.source_path.clone(),
                file_identity: cursor.file_identity.clone(),
                byte_offset: last_offset,
                last_record_id,
                last_record_time,
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
    tool_use_result: Option<ClaudeToolUseResult>,
}

#[derive(Debug, Deserialize)]
struct ClaudeMessage {
    model: Option<String>,
    content: Option<Vec<ClaudeContentBlock>>,
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
        };
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap();
        assert!(batch.events.is_empty());
    }
}

use crate::ai::event::{AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::jsonl::JsonlCursorReader;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor,
};
use crate::ai::patch::{count_unified_diff_lines, parse_apply_patch};
use crate::ai::path::resolve_within_workspace;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Bounds the `sessions/YYYY/MM/DD/rollout-*.jsonl` walk. Real trees are three levels
/// deep; a couple of levels of slack tolerates a differently-shaped future layout
/// without turning into an unbounded home-directory scan (plan.md 8.4: "Do not
/// recursively scan a user's whole home directory").
const MAX_WALK_DEPTH: usize = 5;

pub struct CodexParser;

impl CodexParser {
    pub fn new() -> Self {
        Self
    }

    fn sessions_root(context: &DiscoveryContext) -> PathBuf {
        context
            .config_override
            .clone()
            .unwrap_or_else(|| context.home_dir.join(".codex").join("sessions"))
    }

    fn find_rollout_files(root: &Path) -> io_result_alias::Result<Vec<PathBuf>> {
        let mut out = Vec::new();
        walk(root, 0, &mut out)?;
        Ok(out)
    }
}

impl Default for CodexParser {
    fn default() -> Self {
        Self::new()
    }
}

fn walk(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) -> io_result_alias::Result<()> {
    if depth > MAX_WALK_DEPTH {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            walk(&path, depth + 1, out)?;
        } else if path.extension().is_some_and(|ext| ext == "jsonl") {
            out.push(path);
        }
    }
    Ok(())
}

/// Local alias so the walk helper's error type reads clearly at call sites without
/// importing `std::io` under a name that collides with other `io` usages in this file.
mod io_result_alias {
    pub type Result<T> = std::io::Result<T>;
}

impl AiActivityParser for CodexParser {
    fn id(&self) -> &'static str {
        "codex"
    }

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult {
        let root = Self::sessions_root(context);
        if !root.exists() {
            return DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            };
        }

        match Self::find_rollout_files(&root) {
            Ok(files) if files.is_empty() => DiscoveryResult {
                state: DiscoveryState::InstalledNoTranscript,
            },
            Ok(files) => {
                let latest = files
                    .into_iter()
                    .max_by_key(|path| fs::metadata(path).and_then(|m| m.modified()).ok());
                DiscoveryResult {
                    state: DiscoveryState::TranscriptFound {
                        path: latest.unwrap_or(root),
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
        let root = Self::sessions_root(context);
        if !root.exists() {
            return vec![DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            }];
        }
        match Self::find_rollout_files(&root) {
            Ok(mut files) => {
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
        let mut turn_context: HashMap<String, TurnContext> = HashMap::new();
        let mut session_id: Option<String> = None;
        let mut session_cwd: Option<PathBuf> = None;
        let mut last_offset = cursor.byte_offset;
        let mut last_record_time: Option<DateTime<Utc>> = cursor.last_record_time;
        let mut last_record_id: Option<String> = cursor.last_record_id.clone();
        // `response_item` records (the real apply_patch call/output pair — see below)
        // carry no `turn_id` of their own, unlike `event_msg`/`patch_apply_end`. Each
        // `turn_context` record precedes the response_items generated within that
        // turn in the transcript's own timestamp order, so tracking "the most
        // recently seen turn" is the correlation the format actually offers.
        let mut current_turn_id: Option<String> = None;
        // A `custom_tool_call` (the apply_patch call itself, carrying the patch text)
        // is matched to its `custom_tool_call_output` (proof the call completed) by
        // `call_id`. Known limitation: this map is local to one parse batch, so a
        // call/output pair split across a batch boundary is lost rather than carried
        // over — accepted for now as a rare edge case, not solved here.
        let mut pending_apply_patch: HashMap<String, PendingApplyPatch> = HashMap::new();

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
                    message: "skipped oversized codex transcript record".to_string(),
                });
                continue;
            }
            if line.text.trim().is_empty() {
                continue;
            }

            let record: CodexRecord = match serde_json::from_str(&line.text) {
                Ok(record) => record,
                Err(error) => {
                    warnings.push(ParseWarning {
                        record_id: None,
                        message: format!("malformed codex record: {error}"),
                    });
                    continue;
                }
            };
            last_record_time = Some(record.timestamp);

            match record.record_type.as_str() {
                "session_meta" => {
                    let parsed: Result<SessionMetaPayload, _> =
                        serde_json::from_value(record.payload);
                    if let Ok(meta) = parsed {
                        session_id = Some(meta.session_id);
                        session_cwd = meta.cwd.map(PathBuf::from);
                    }
                }
                "turn_context" => {
                    let parsed: Result<TurnContextPayload, _> =
                        serde_json::from_value(record.payload);
                    if let Ok(turn) = parsed {
                        current_turn_id = Some(turn.turn_id.clone());
                        turn_context.insert(
                            turn.turn_id,
                            TurnContext {
                                cwd: turn.cwd.map(PathBuf::from),
                                model: turn.model,
                            },
                        );
                    }
                }
                "event_msg" => {
                    let inner_type = record
                        .payload
                        .get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default();
                    if inner_type != "patch_apply_end" {
                        continue;
                    }
                    let parsed: PatchApplyEndPayload = match serde_json::from_value(record.payload)
                    {
                        Ok(payload) => payload,
                        Err(error) => {
                            warnings.push(ParseWarning {
                                record_id: None,
                                message: format!("malformed patch_apply_end payload: {error}"),
                            });
                            continue;
                        }
                    };
                    last_record_id = Some(parsed.call_id.clone());
                    if !parsed.success {
                        continue;
                    }
                    let turn = parsed.turn_id.as_ref().and_then(|id| turn_context.get(id));
                    let project_root = turn
                        .and_then(|t| t.cwd.clone())
                        .or_else(|| session_cwd.clone());
                    let model = turn.and_then(|t| t.model.clone());

                    for (raw_path, change) in parsed.changes {
                        let delta = change
                            .unified_diff
                            .as_deref()
                            .map(count_unified_diff_lines)
                            .unwrap_or_default();
                        let entity = resolve_entity(&raw_path, project_root.as_deref());
                        events.push(AiEditEvent {
                            event_id: format!("codex-v1:{}:{raw_path}", parsed.call_id),
                            agent: "codex".to_string(),
                            provider: Some("openai".to_string()),
                            model: model.clone(),
                            session_id: session_id.clone(),
                            occurred_at: record.timestamp,
                            entity,
                            project_root: project_root.clone(),
                            lines_added: Some(delta.added),
                            lines_deleted: Some(delta.deleted),
                            input_tokens: None,
                            output_tokens: None,
                            source: AiEventSource::Transcript,
                            confidence: AiConfidence::Verified,
                        });
                    }
                }
                // Real Codex sessions carry the apply_patch call and its file edits
                // here, not in `event_msg`/`patch_apply_end` above — confirmed against
                // 156 real local session files on 2026-08-31, none of which contained
                // a `patch_apply_end` record at all. The `event_msg` arm is kept
                // rather than removed: it is still exercised by this module's fixture
                // tests and may match an older or future Codex build's format: this
                // parser accepts either shape rather than assuming the one currently
                // observed is the only one that will ever exist.
                "response_item" => {
                    let parsed: Result<ResponseItemPayload, _> =
                        serde_json::from_value(record.payload);
                    let Ok(item) = parsed else {
                        continue;
                    };
                    match item.item_type.as_str() {
                        "custom_tool_call" if item.name.as_deref() == Some("apply_patch") => {
                            if let (Some(call_id), Some(input)) = (item.call_id, item.input) {
                                pending_apply_patch.insert(
                                    call_id,
                                    PendingApplyPatch {
                                        input,
                                        turn_id: current_turn_id.clone(),
                                        timestamp: record.timestamp,
                                    },
                                );
                            }
                        }
                        "custom_tool_call_output" => {
                            let Some(call_id) = item.call_id else {
                                continue;
                            };
                            // The output's own content is never inspected — only its
                            // presence matters, as proof the call actually completed
                            // rather than being interrupted mid-flight. Parsing a
                            // free-text confirmation for a success/failure signal
                            // would be brittle (the real shape varies: sometimes a
                            // string, sometimes a content-block list) and risks
                            // matching on text that is exactly the kind of content
                            // this parser must never retain.
                            let Some(pending) = pending_apply_patch.remove(&call_id) else {
                                continue;
                            };
                            last_record_id = Some(call_id.clone());
                            let turn = pending.turn_id.as_ref().and_then(|id| turn_context.get(id));
                            let project_root = turn
                                .and_then(|t| t.cwd.clone())
                                .or_else(|| session_cwd.clone());
                            let model = turn.and_then(|t| t.model.clone());

                            for change in parse_apply_patch(&pending.input) {
                                let entity = resolve_entity(&change.path, project_root.as_deref());
                                events.push(AiEditEvent {
                                    event_id: format!("codex-v2:{call_id}:{}", change.path),
                                    agent: "codex".to_string(),
                                    provider: Some("openai".to_string()),
                                    model: model.clone(),
                                    session_id: session_id.clone(),
                                    occurred_at: pending.timestamp,
                                    entity,
                                    project_root: project_root.clone(),
                                    lines_added: Some(change.delta.added),
                                    lines_deleted: Some(change.delta.deleted),
                                    input_tokens: None,
                                    output_tokens: None,
                                    source: AiEventSource::Transcript,
                                    confidence: AiConfidence::Verified,
                                });
                            }
                        }
                        _ => {}
                    }
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

struct TurnContext {
    cwd: Option<PathBuf>,
    model: Option<String>,
}

/// A `response_item` record's payload. Only the fields this parser actually reads —
/// `custom_tool_call`/`custom_tool_call_output` share this shape with every other
/// response item type (`message`, `reasoning`, `function_call`, ...), so everything
/// else is intentionally left undeserialized rather than modeled.
#[derive(Debug, Deserialize)]
struct ResponseItemPayload {
    #[serde(rename = "type")]
    item_type: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    call_id: Option<String>,
    /// The apply_patch call's own patch-text argument. Present only on
    /// `custom_tool_call`; deliberately not read at all for `custom_tool_call_output`,
    /// whose `output` field is never deserialized here — see the call site's comment
    /// on why that content is never inspected.
    #[serde(default)]
    input: Option<String>,
}

/// An apply_patch call waiting for its matching `custom_tool_call_output`.
struct PendingApplyPatch {
    input: String,
    turn_id: Option<String>,
    timestamp: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CodexRecord {
    timestamp: DateTime<Utc>,
    #[serde(rename = "type")]
    record_type: String,
    #[serde(default)]
    payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct SessionMetaPayload {
    // Real current session_meta records use `id`, not `session_id` — confirmed
    // against 156 real local Codex session files on 2026-08-31, none of which had
    // a `session_id` key. `#[serde(alias)]` accepts either shape without knowing
    // which Codex build produced which, since this parser has to be tolerant across
    // versions it can't detect ahead of time.
    #[serde(alias = "id")]
    session_id: String,
    cwd: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TurnContextPayload {
    turn_id: String,
    cwd: Option<String>,
    model: Option<String>,
}

/// `event_msg` records nest a second `type` discriminator inside `payload`
/// (`"patch_apply_end"`, `"token_count"`, ...) — checked against `payload.type` before
/// this struct is deserialized, so it only needs the fields this parser actually uses.
#[derive(Debug, Deserialize)]
struct PatchApplyEndPayload {
    call_id: String,
    turn_id: Option<String>,
    #[serde(default)]
    success: bool,
    changes: HashMap<String, CodexChange>,
}

#[derive(Debug, Deserialize)]
struct CodexChange {
    unified_diff: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_fixture_copy(name: &str) -> PathBuf {
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let patch_apply_end =
            fs::read_to_string(format!("{fixtures}patch_apply_end.json")).unwrap();

        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-test-{}-{name}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("rollout-test.jsonl");
        let mut file = fs::File::create(&path).unwrap();
        for line in [&session_meta, &turn_context, &patch_apply_end] {
            let compact: serde_json::Value = serde_json::from_str(line).unwrap();
            writeln!(file, "{}", serde_json::to_string(&compact).unwrap()).unwrap();
        }
        path
    }

    /// The real-world shape, as opposed to `write_fixture_copy`'s `patch_apply_end`
    /// shape — see `custom_tool_call.json`'s own comment history / the doc comment on
    /// the `"response_item"` match arm for why both are kept.
    fn write_response_item_fixture_copy(name: &str) -> PathBuf {
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let call = fs::read_to_string(format!("{fixtures}custom_tool_call.json")).unwrap();
        let output = fs::read_to_string(format!("{fixtures}custom_tool_call_output.json")).unwrap();

        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-response-item-test-{}-{name}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("rollout-test.jsonl");
        let mut file = fs::File::create(&path).unwrap();
        for line in [&session_meta, &turn_context, &call, &output] {
            let compact: serde_json::Value = serde_json::from_str(line).unwrap();
            writeln!(file, "{}", serde_json::to_string(&compact).unwrap()).unwrap();
        }
        path
    }

    #[test]
    fn discover_reports_not_installed_when_sessions_dir_is_absent() {
        let home = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-discover-missing-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&home);
        let parser = CodexParser::new();
        let result = parser.discover(&DiscoveryContext {
            home_dir: home,
            config_override: None,
        });
        assert_eq!(result.state, DiscoveryState::NotInstalled);
    }

    #[test]
    fn discover_reports_installed_no_transcript_for_empty_dir() {
        let home = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-discover-empty-{}",
            std::process::id()
        ));
        fs::create_dir_all(home.join(".codex").join("sessions")).unwrap();
        let parser = CodexParser::new();
        let result = parser.discover(&DiscoveryContext {
            home_dir: home,
            config_override: None,
        });
        assert_eq!(result.state, DiscoveryState::InstalledNoTranscript);
    }

    #[test]
    fn discover_finds_nested_rollout_file() {
        let home = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-discover-found-{}",
            std::process::id()
        ));
        let nested = home
            .join(".codex")
            .join("sessions")
            .join("2026")
            .join("08")
            .join("14");
        fs::create_dir_all(&nested).unwrap();
        let rollout = nested.join("rollout-example.jsonl");
        fs::write(&rollout, "{}\n").unwrap();

        let parser = CodexParser::new();
        let result = parser.discover(&DiscoveryContext {
            home_dir: home,
            config_override: None,
        });
        match result.state {
            DiscoveryState::TranscriptFound { path } => assert_eq!(path, rollout),
            other => panic!("expected TranscriptFound, got {other:?}"),
        }
    }

    #[test]
    fn parse_since_requires_a_seeded_cursor() {
        let parser = CodexParser::new();
        let result = parser.parse_since(&ParseContext::default(), None);
        assert!(matches!(result, Err(AiParseError::NotFound { .. })));
    }

    #[test]
    fn parse_since_splits_multi_file_patch_into_one_event_per_file() {
        let path = write_fixture_copy("split");
        let parser = CodexParser::new();
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

        assert_eq!(batch.events.len(), 2);
        assert!(batch.warnings.is_empty());

        let greeting = batch
            .events
            .iter()
            .find(|e| e.entity.ends_with("greeting.rs"))
            .expect("greeting.rs event present");
        assert_eq!(greeting.lines_added, Some(2));
        assert_eq!(greeting.lines_deleted, Some(2));
        assert_eq!(greeting.model.as_deref(), Some("example-model-id"));
        assert_eq!(
            greeting.session_id.as_deref(),
            Some("018f0000-bbbb-7000-8000-000000000000")
        );
        assert_eq!(greeting.source, AiEventSource::Transcript);
        assert_eq!(greeting.confidence, AiConfidence::Verified);

        let new_module = batch
            .events
            .iter()
            .find(|e| e.entity.ends_with("new_module.rs"))
            .expect("new_module.rs event present");
        assert_eq!(new_module.lines_added, Some(3));
        assert_eq!(new_module.lines_deleted, Some(0));

        assert_ne!(greeting.event_id, new_module.event_id);
    }

    #[test]
    fn parse_since_reads_the_real_response_item_apply_patch_shape() {
        // Regression test: real Codex sessions never emit `event_msg`/
        // `patch_apply_end` (confirmed against 156 real local session files on
        // 2026-08-31) — every apply_patch call shows up as a `response_item` pair,
        // `custom_tool_call` (name="apply_patch", carrying the patch text in `input`)
        // followed by `custom_tool_call_output` (proof the call completed). Before
        // this fix, `record_type` had no arm for `"response_item"` at all, so this
        // exact real-world shape parsed to zero events, silently, on every session.
        let path = write_response_item_fixture_copy("split");
        let parser = CodexParser::new();
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

        assert_eq!(batch.events.len(), 2);
        assert!(batch.warnings.is_empty());

        let greeting = batch
            .events
            .iter()
            .find(|e| e.entity.ends_with("greeting.rs"))
            .expect("greeting.rs event present");
        assert_eq!(greeting.lines_added, Some(3));
        assert_eq!(greeting.lines_deleted, Some(1));
        assert_eq!(greeting.model.as_deref(), Some("example-model-id"));
        assert_eq!(
            greeting.session_id.as_deref(),
            Some("018f0000-bbbb-7000-8000-000000000000")
        );
        assert_eq!(greeting.source, AiEventSource::Transcript);
        assert_eq!(greeting.confidence, AiConfidence::Verified);

        let new_module = batch
            .events
            .iter()
            .find(|e| e.entity.ends_with("new_module.rs"))
            .expect("new_module.rs event present");
        assert_eq!(new_module.lines_added, Some(3));
        assert_eq!(new_module.lines_deleted, Some(0));

        assert_ne!(greeting.event_id, new_module.event_id);
    }

    #[test]
    fn parse_since_ignores_a_custom_tool_call_output_with_no_matching_call() {
        // A batch boundary (or a genuinely dropped call record) can leave an output
        // with nothing to pair against — this must be skipped, not panic or emit a
        // phantom event with no line data.
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let output = fs::read_to_string(format!("{fixtures}custom_tool_call_output.json")).unwrap();
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-orphan-output-{}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("rollout-test.jsonl");
        let mut file = fs::File::create(&path).unwrap();
        for line in [&session_meta, &output] {
            let compact: serde_json::Value = serde_json::from_str(line).unwrap();
            writeln!(file, "{}", serde_json::to_string(&compact).unwrap()).unwrap();
        }

        let parser = CodexParser::new();
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
        assert!(batch.warnings.is_empty());
    }

    #[test]
    fn parse_since_is_resumable_via_returned_cursor() {
        let path = write_fixture_copy("resume");
        let parser = CodexParser::new();
        let first_cursor = ParserCursor {
            source_path: path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
        };
        let first_batch = parser
            .parse_since(&ParseContext::default(), Some(&first_cursor))
            .unwrap();
        assert_eq!(first_batch.events.len(), 2);

        let second_batch = parser
            .parse_since(&ParseContext::default(), Some(&first_batch.next_cursor))
            .unwrap();
        assert!(second_batch.events.is_empty(), "no new records past EOF");
        assert_eq!(
            second_batch.next_cursor.byte_offset,
            first_batch.next_cursor.byte_offset
        );
    }

    #[test]
    fn parse_since_skips_malformed_lines_without_failing_the_batch() {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-malformed-{}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("rollout-malformed.jsonl");
        fs::write(&path, "not json at all\n{\"timestamp\":\"2026-08-14T00:00:00Z\",\"type\":\"session_meta\",\"payload\":{\"session_id\":\"s1\",\"cwd\":\"/x\"}}\n").unwrap();

        let parser = CodexParser::new();
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
        assert_eq!(batch.warnings.len(), 1);
        assert!(batch.events.is_empty());
    }
}

use crate::ai::event::{opaque_file_event_id, AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::jsonl::JsonlCursorReader;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor,
};
use crate::ai::patch::{count_unified_diff_lines, parse_apply_patch};
use crate::ai::path::resolve_within_workspace;
use crate::broker::BrokerChangeKind;
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
        let mut session_provider: Option<String> = None;
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
        // over. The parser now rewinds the returned cursor to the first pending
        // call instead, so the next bounded pass replays the pair safely.
        let mut pending_apply_patch: HashMap<String, PendingApplyPatch> = HashMap::new();
        let mut completed_apply_patch = std::collections::HashSet::new();
        let mut failed_apply_patch = std::collections::HashSet::new();

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
                        // Current Codex Desktop records may carry both the newer
                        // `id` and the older `session_id` compatibility field. A
                        // serde alias rejects that valid shape as a duplicate;
                        // decode both explicitly and prefer the canonical `id`.
                        session_id = meta.id.or(meta.session_id);
                        session_cwd = meta.cwd.map(PathBuf::from);
                        session_provider = meta.model_provider;
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
                        pending_apply_patch.remove(&parsed.call_id);
                        failed_apply_patch.insert(parsed.call_id.clone());
                        continue;
                    }
                    // Current Codex CLI may emit both patch_apply_end and a later
                    // custom_tool_call_output for one call. The end record is the
                    // authoritative completion proof; never emit a second event
                    // when the output arrives.
                    if completed_apply_patch.contains(&parsed.call_id) {
                        continue;
                    }
                    pending_apply_patch.remove(&parsed.call_id);
                    completed_apply_patch.insert(parsed.call_id.clone());
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
                        let previous_entity = change
                            .previous_path
                            .as_deref()
                            .map(|path| resolve_entity(path, project_root.as_deref()));
                        // A rename without its source path cannot satisfy the broker's
                        // identity invariant. Keep the edit observable as a modify until
                        // the transcript provides both sides of the rename.
                        let change_kind = change
                            .change_type
                            .as_deref()
                            .and_then(BrokerChangeKind::from_tool_operation)
                            .filter(|kind| {
                                *kind != BrokerChangeKind::Rename || previous_entity.is_some()
                            })
                            .unwrap_or(BrokerChangeKind::Modify);
                        events.push(AiEditEvent {
                            event_id: opaque_file_event_id("codex-v1", &parsed.call_id, &raw_path),
                            agent: "codex".to_string(),
                            provider: session_provider
                                .clone()
                                .or_else(|| Some("openai".to_string())),
                            model: model.clone(),
                            session_id: session_id.clone(),
                            tool_event_id: Some(parsed.call_id.clone()),
                            occurred_at: record.timestamp,
                            entity,
                            project_root: project_root.clone(),
                            lines_added: Some(delta.added),
                            lines_deleted: Some(delta.deleted),
                            change_kind,
                            previous_entity,
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
                        "custom_tool_call" => {
                            // A failed/cancelled call must never become file
                            // evidence merely because a later output record exists.
                            // Successful current records use `completed`; older
                            // records may omit status, so absence remains accepted.
                            if item
                                .status
                                .as_deref()
                                .is_some_and(|status| status != "completed" && status != "success")
                            {
                                if let Some(call_id) = item.call_id {
                                    failed_apply_patch.insert(call_id);
                                }
                                continue;
                            }
                            let input = match item.name.as_deref() {
                                // Older/current CLI transcripts expose the native tool
                                // directly as `name = "apply_patch"`.
                                Some("apply_patch") => item.input,
                                // Codex Desktop executes the same tool through its
                                // `exec` bridge. Its input is JavaScript-like text such
                                // as `text(await tools.apply_patch("..."))`, or a
                                // `const patch = "..."; ... apply_patch(patch)` wrapper.
                                Some("exec") => {
                                    item.input.as_deref().and_then(extract_apply_patch_input)
                                }
                                _ => None,
                            };
                            if let (Some(call_id), Some(input)) = (item.call_id, input) {
                                if failed_apply_patch.contains(&call_id)
                                    || completed_apply_patch.contains(&call_id)
                                {
                                    continue;
                                }
                                pending_apply_patch.insert(
                                    call_id,
                                    PendingApplyPatch {
                                        input,
                                        turn_id: current_turn_id.clone(),
                                        timestamp: record.timestamp,
                                        offset_before: line.offset_before,
                                    },
                                );
                            }
                        }
                        "custom_tool_call_output" => {
                            let Some(call_id) = item.call_id else {
                                continue;
                            };
                            if completed_apply_patch.contains(&call_id)
                                || failed_apply_patch.contains(&call_id)
                            {
                                continue;
                            }
                            if item
                                .status
                                .as_deref()
                                .is_some_and(|status| status != "completed" && status != "success")
                            {
                                pending_apply_patch.remove(&call_id);
                                failed_apply_patch.insert(call_id);
                                continue;
                            }
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
                            completed_apply_patch.insert(call_id.clone());
                            last_record_id = Some(call_id.clone());
                            let turn = pending.turn_id.as_ref().and_then(|id| turn_context.get(id));
                            let project_root = turn
                                .and_then(|t| t.cwd.clone())
                                .or_else(|| session_cwd.clone());
                            let model = turn.and_then(|t| t.model.clone());

                            let mut path_occurrences = HashMap::<String, usize>::new();
                            for change in parse_apply_patch(&pending.input) {
                                // Codex Desktop sometimes represents a full replacement
                                // as `*** Delete File` followed by `*** Add File` for the
                                // same path in one tool call. The path alone is therefore
                                // not a unique operation identity. Keep the first ID
                                // backward-compatible and add a deterministic occurrence
                                // suffix only for repeated paths so the broker does not
                                // reject the batch as conflicting payloads.
                                let occurrence =
                                    path_occurrences.entry(change.path.clone()).or_insert(0);
                                let operation_id = if *occurrence == 0 {
                                    call_id.clone()
                                } else {
                                    format!("{}:{}", call_id, *occurrence)
                                };
                                *occurrence += 1;
                                let entity = resolve_entity(&change.path, project_root.as_deref());
                                events.push(AiEditEvent {
                                    event_id: opaque_file_event_id(
                                        "codex-v2",
                                        &operation_id,
                                        &change.path,
                                    ),
                                    agent: "codex".to_string(),
                                    provider: session_provider
                                        .clone()
                                        .or_else(|| Some("openai".to_string())),
                                    model: model.clone(),
                                    session_id: session_id.clone(),
                                    tool_event_id: Some(call_id.clone()),
                                    occurred_at: pending.timestamp,
                                    entity,
                                    project_root: project_root.clone(),
                                    lines_added: Some(change.delta.added),
                                    lines_deleted: Some(change.delta.deleted),
                                    change_kind: change.change_kind,
                                    previous_entity: change
                                        .previous_path
                                        .as_deref()
                                        .map(|path| resolve_entity(path, project_root.as_deref())),
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

        // Never checkpoint past an apply_patch call whose completion record has
        // not arrived yet. The next pass starts at the call and can pair it with
        // an output written after this bounded read. Replaying preceding records
        // is intentional: local delivered-event dedup makes it idempotent.
        if let Some(offset) = pending_apply_patch
            .values()
            .map(|pending| pending.offset_before)
            .min()
        {
            last_offset = offset;
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

/// Extract the apply_patch DSL from Codex Desktop's `exec` bridge input.
///
/// The bridge is not itself a source of file evidence: only a successfully paired
/// `custom_tool_call_output` is emitted below. This helper therefore only unwraps the
/// string argument and deliberately ignores shell commands or unrelated text that merely
/// mentions `apply_patch`.
fn extract_apply_patch_input(input: &str) -> Option<String> {
    const MARKER: &str = "tools.apply_patch(";
    let marker_start = input.find(MARKER)?;
    let argument = input[marker_start + MARKER.len()..].trim_start();

    if argument.starts_with('"') {
        return parse_json_string_prefix(argument).map(|(value, _)| value);
    }

    // The desktop wrapper often binds the patch first and passes the variable to the
    // tool: `const patch = "..."; text(await tools.apply_patch(patch));`.
    let variable_end =
        argument.find(|character: char| !character.is_ascii_alphanumeric() && character != '_')?;
    let variable = &argument[..variable_end];
    if variable.is_empty() {
        return None;
    }
    let assignment_marker = format!("{variable} =");
    let assignment_start = input[..marker_start].rfind(&assignment_marker)?;
    let assigned = input[assignment_start + assignment_marker.len()..].trim_start();
    parse_json_string_prefix(assigned).map(|(value, _)| value)
}

/// Parse one JSON/JavaScript-compatible double-quoted string at the start of `input`.
/// Codex serializes the bridge input as JSON, so JSON string escaping covers the observed
/// `\\n`, `\\t`, `\\"`, and Unicode forms while avoiding an eval-like parser.
fn parse_json_string_prefix(input: &str) -> Option<(String, usize)> {
    if !input.starts_with('"') {
        return None;
    }

    let mut escaped = false;
    for (index, character) in input.char_indices().skip(1) {
        if escaped {
            escaped = false;
            continue;
        }
        match character {
            '\\' => escaped = true,
            '"' => {
                let literal = &input[..index + character.len_utf8()];
                let value = serde_json::from_str::<String>(literal).ok()?;
                return Some((value, index + character.len_utf8()));
            }
            _ => {}
        }
    }
    None
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
    /// Current Codex marks completed/failed tool calls explicitly. We only use
    /// this bounded status token; output text is deliberately never inspected.
    #[serde(default)]
    status: Option<String>,
}

/// An apply_patch call waiting for its matching `custom_tool_call_output`.
struct PendingApplyPatch {
    input: String,
    turn_id: Option<String>,
    timestamp: DateTime<Utc>,
    offset_before: u64,
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
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    id: Option<String>,
    cwd: Option<String>,
    #[serde(default)]
    model_provider: Option<String>,
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
    #[serde(rename = "type", default)]
    change_type: Option<String>,
    #[serde(
        rename = "previous_path",
        alias = "previousPath",
        alias = "old_path",
        alias = "oldPath",
        default
    )]
    previous_path: Option<String>,
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

    fn write_exec_response_item_fixture_copy(name: &str) -> PathBuf {
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let call = fs::read_to_string(format!("{fixtures}custom_tool_call_exec.json")).unwrap();
        let output =
            fs::read_to_string(format!("{fixtures}custom_tool_call_exec_output.json")).unwrap();

        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-exec-response-item-test-{}-{name}",
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
        assert!(!greeting.event_id.contains("greeting.rs"));
        assert!(!greeting.event_id.contains("/workspace"));

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
    fn parse_since_preserves_legacy_rename_identity_when_source_is_present() {
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let mut patch: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(format!("{fixtures}patch_apply_end.json")).unwrap(),
        )
        .unwrap();
        patch["payload"]["changes"] = serde_json::json!({
            "/home/dev/example-project/src/new_name.rs": {
                "type": "rename",
                "previous_path": "/home/dev/example-project/src/old_name.rs",
                "unified_diff": "@@ -1 +1 @@\n-old\n+new\n"
            }
        });

        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-legacy-rename-{}.jsonl",
            std::process::id()
        ));
        let mut file = fs::File::create(&path).unwrap();
        for value in [
            serde_json::from_str::<serde_json::Value>(&session_meta).unwrap(),
            serde_json::from_str::<serde_json::Value>(&turn_context).unwrap(),
            patch,
        ] {
            writeln!(file, "{}", serde_json::to_string(&value).unwrap()).unwrap();
        }

        let batch = CodexParser::new()
            .parse_since(
                &ParseContext::default(),
                Some(&ParserCursor {
                    source_path: path.to_string_lossy().into_owned(),
                    file_identity: None,
                    byte_offset: 0,
                    last_record_id: None,
                    last_record_time: None,
                }),
            )
            .unwrap();

        assert_eq!(batch.events.len(), 1);
        let event = &batch.events[0];
        assert_eq!(event.change_kind, BrokerChangeKind::Rename);
        assert!(event.entity.ends_with("new_name.rs"));
        assert!(event
            .previous_entity
            .as_ref()
            .is_some_and(|path| path.ends_with("old_name.rs")));
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
        assert_eq!(greeting.change_kind, BrokerChangeKind::Modify);
        assert_eq!(greeting.model.as_deref(), Some("example-model-id"));
        assert_eq!(
            greeting.session_id.as_deref(),
            Some("018f0000-bbbb-7000-8000-000000000000")
        );
        assert_eq!(greeting.source, AiEventSource::Transcript);
        assert_eq!(greeting.confidence, AiConfidence::Verified);
        assert!(!greeting.event_id.contains("greeting.rs"));
        assert!(!greeting.event_id.contains("/workspace"));

        let new_module = batch
            .events
            .iter()
            .find(|e| e.entity.ends_with("new_module.rs"))
            .expect("new_module.rs event present");
        assert_eq!(new_module.lines_added, Some(3));
        assert_eq!(new_module.lines_deleted, Some(0));
        assert_eq!(new_module.change_kind, BrokerChangeKind::Create);

        assert_ne!(greeting.event_id, new_module.event_id);
    }

    #[test]
    fn parse_since_disambiguates_repeated_file_markers_in_one_call() {
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let mut call: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(format!("{fixtures}custom_tool_call.json")).unwrap(),
        )
        .unwrap();
        call["payload"]["call_id"] = serde_json::json!("call-repeated-file-marker");
        call["payload"]["input"] = serde_json::json!(
            "*** Begin Patch\n*** Delete File: src/replaced.rs\n*** Add File: src/replaced.rs\nnew contents\n*** End Patch\n"
        );
        let mut output: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(format!("{fixtures}custom_tool_call_output.json")).unwrap(),
        )
        .unwrap();
        output["payload"]["call_id"] = serde_json::json!("call-repeated-file-marker");

        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-repeated-path-{}.jsonl",
            std::process::id()
        ));
        let mut file = fs::File::create(&path).unwrap();
        for value in [
            serde_json::from_str::<serde_json::Value>(&session_meta).unwrap(),
            serde_json::from_str::<serde_json::Value>(&turn_context).unwrap(),
            call,
            output,
        ] {
            writeln!(file, "{}", serde_json::to_string(&value).unwrap()).unwrap();
        }

        let batch = CodexParser::new()
            .parse_since(
                &ParseContext::default(),
                Some(&ParserCursor {
                    source_path: path.to_string_lossy().into_owned(),
                    file_identity: None,
                    byte_offset: 0,
                    last_record_id: None,
                    last_record_time: None,
                }),
            )
            .unwrap();

        assert_eq!(batch.events.len(), 2);
        assert_ne!(batch.events[0].event_id, batch.events[1].event_id);
        assert!(batch
            .events
            .iter()
            .all(|event| event.entity.ends_with("replaced.rs")));
        assert_eq!(batch.events[0].change_kind, BrokerChangeKind::Delete);
        assert_eq!(batch.events[1].change_kind, BrokerChangeKind::Create);
    }

    #[test]
    fn parse_since_reads_codex_desktop_exec_apply_patch_shape() {
        // Codex Desktop routes the native apply_patch tool through an `exec` bridge;
        // the patch is the quoted argument to `tools.apply_patch`, rather than the
        // response item's `input` value itself. This is the shape emitted by the
        // current desktop session writer.
        let path = write_exec_response_item_fixture_copy("desktop-wrapper");
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

        assert_eq!(batch.events.len(), 1);
        assert!(batch.warnings.is_empty());
        let event = &batch.events[0];
        assert!(event.entity.ends_with("desktop_wrapper.rs"));
        assert_eq!(event.lines_added, Some(1));
        assert_eq!(event.lines_deleted, Some(0));
        assert_eq!(event.change_kind, BrokerChangeKind::Create);
        assert_eq!(event.confidence, AiConfidence::Verified);
    }

    #[test]
    fn parse_since_prefers_patch_apply_end_over_duplicate_output() {
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let mut call: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(format!("{fixtures}custom_tool_call.json")).unwrap(),
        )
        .unwrap();
        let mut output: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(format!("{fixtures}custom_tool_call_output.json")).unwrap(),
        )
        .unwrap();
        let call_id = "exec-shared-completion-id";
        call["payload"]["call_id"] = serde_json::json!(call_id);
        output["payload"]["call_id"] = serde_json::json!(call_id);
        let patch_end: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(format!("{fixtures}patch_apply_end.json")).unwrap(),
        )
        .unwrap();
        let mut patch_end = patch_end;
        patch_end["payload"]["call_id"] = serde_json::json!(call_id);

        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-duplicate-completion-{}.jsonl",
            std::process::id()
        ));
        let mut file = fs::File::create(&path).unwrap();
        for value in [
            serde_json::from_str::<serde_json::Value>(&session_meta).unwrap(),
            serde_json::from_str::<serde_json::Value>(&turn_context).unwrap(),
            call,
            patch_end,
            output,
        ] {
            writeln!(file, "{}", serde_json::to_string(&value).unwrap()).unwrap();
        }

        let batch = CodexParser::new()
            .parse_since(
                &ParseContext::default(),
                Some(&ParserCursor {
                    source_path: path.to_string_lossy().into_owned(),
                    file_identity: None,
                    byte_offset: 0,
                    last_record_id: None,
                    last_record_time: None,
                }),
            )
            .unwrap();
        assert_eq!(batch.events.len(), 2, "two files, one completion source");
        assert!(batch
            .events
            .iter()
            .all(|event| event.event_id.starts_with("codex-v1:")));
    }

    #[test]
    fn parse_since_accepts_current_session_meta_with_both_id_fields() {
        // Some 0.153.x Desktop records retain `session_id` while also adding the
        // canonical `id`. `#[serde(alias = "id")]` rejects that shape as a
        // duplicate field; both fields must remain readable without losing cwd or
        // session identity.
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let mut session_meta: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap(),
        )
        .unwrap();
        session_meta["payload"]["session_id"] = serde_json::json!("legacy-session-id");
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let call = fs::read_to_string(format!("{fixtures}custom_tool_call.json")).unwrap();
        let output = fs::read_to_string(format!("{fixtures}custom_tool_call_output.json")).unwrap();
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-both-session-{}-{}.jsonl",
            std::process::id(),
            "current"
        ));
        let mut file = fs::File::create(&path).unwrap();
        writeln!(file, "{}", serde_json::to_string(&session_meta).unwrap()).unwrap();
        for line in [turn_context, call, output] {
            let compact: serde_json::Value = serde_json::from_str(&line).unwrap();
            writeln!(file, "{}", serde_json::to_string(&compact).unwrap()).unwrap();
        }

        let batch = CodexParser::new()
            .parse_since(
                &ParseContext::default(),
                Some(&ParserCursor {
                    source_path: path.to_string_lossy().into_owned(),
                    file_identity: None,
                    byte_offset: 0,
                    last_record_id: None,
                    last_record_time: None,
                }),
            )
            .unwrap();

        assert_eq!(batch.events.len(), 2);
        assert!(batch.events.iter().all(
            |event| event.session_id.as_deref() == Some("018f0000-bbbb-7000-8000-000000000000")
        ));
    }

    #[test]
    fn parse_since_rewinds_an_unpaired_call_until_completion_arrives() {
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let call = fs::read_to_string(format!("{fixtures}custom_tool_call.json")).unwrap();
        let output = fs::read_to_string(format!("{fixtures}custom_tool_call_output.json")).unwrap();
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-pending-{}-{}.jsonl",
            std::process::id(),
            "completion"
        ));
        let mut file = fs::File::create(&path).unwrap();
        for line in [session_meta, turn_context, call] {
            let compact: serde_json::Value = serde_json::from_str(&line).unwrap();
            writeln!(file, "{}", serde_json::to_string(&compact).unwrap()).unwrap();
        }

        let parser = CodexParser::new();
        let first = parser
            .parse_since(
                &ParseContext::default(),
                Some(&ParserCursor {
                    source_path: path.to_string_lossy().into_owned(),
                    file_identity: None,
                    byte_offset: 0,
                    last_record_id: None,
                    last_record_time: None,
                }),
            )
            .unwrap();
        assert!(first.events.is_empty());
        assert!(first.next_cursor.byte_offset < fs::metadata(&path).unwrap().len());

        let mut file = fs::OpenOptions::new().append(true).open(&path).unwrap();
        let compact: serde_json::Value = serde_json::from_str(&output).unwrap();
        writeln!(file, "{}", serde_json::to_string(&compact).unwrap()).unwrap();

        let second = parser
            .parse_since(&ParseContext::default(), Some(&first.next_cursor))
            .unwrap();
        assert_eq!(second.events.len(), 2);
        assert!(second.warnings.is_empty());
    }

    #[test]
    fn parse_since_ignores_failed_custom_tool_calls_even_if_output_is_present() {
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let mut call: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(format!("{fixtures}custom_tool_call.json")).unwrap(),
        )
        .unwrap();
        call["payload"]["status"] = serde_json::json!("failed");
        let output = fs::read_to_string(format!("{fixtures}custom_tool_call_output.json")).unwrap();
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-failed-{}-{}.jsonl",
            std::process::id(),
            "apply"
        ));
        let mut file = fs::File::create(&path).unwrap();
        for value in [
            serde_json::from_str::<serde_json::Value>(&session_meta).unwrap(),
            serde_json::from_str::<serde_json::Value>(&turn_context).unwrap(),
            call,
            serde_json::from_str::<serde_json::Value>(&output).unwrap(),
        ] {
            writeln!(file, "{}", serde_json::to_string(&value).unwrap()).unwrap();
        }

        let batch = CodexParser::new()
            .parse_since(
                &ParseContext::default(),
                Some(&ParserCursor {
                    source_path: path.to_string_lossy().into_owned(),
                    file_identity: None,
                    byte_offset: 0,
                    last_record_id: None,
                    last_record_time: None,
                }),
            )
            .unwrap();
        assert!(batch.events.is_empty());
        assert_eq!(
            batch.next_cursor.byte_offset,
            fs::metadata(&path).unwrap().len()
        );
    }

    #[test]
    fn extract_apply_patch_input_accepts_desktop_literal_and_variable_wrappers() {
        let direct = r#"text(await tools.apply_patch("*** Begin Patch\n*** Add File: src/direct.rs\n+one\n*** End Patch"));"#;
        assert_eq!(
            extract_apply_patch_input(direct).as_deref(),
            Some("*** Begin Patch\n*** Add File: src/direct.rs\n+one\n*** End Patch")
        );

        let variable = r#"const patch = "*** Begin Patch\n*** Add File: src/variable.rs\n+one\n*** End Patch";\ntext(await tools.apply_patch(patch));"#;
        assert_eq!(
            extract_apply_patch_input(variable).as_deref(),
            Some("*** Begin Patch\n*** Add File: src/variable.rs\n+one\n*** End Patch")
        );
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

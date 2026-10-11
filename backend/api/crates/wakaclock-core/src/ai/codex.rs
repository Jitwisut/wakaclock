use crate::ai::event::{opaque_file_event_id, AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::jsonl::JsonlCursorReader;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserContext, ParserCursor, ParserPendingCall, ParserTurnContext,
};
use crate::ai::patch::{
    count_content_lines, count_unified_diff_lines, parse_apply_patch, LineDelta,
};
use crate::ai::path::resolve_within_workspace;
use crate::ai::{
    is_internal_marker, normalize_identity_model, normalize_identity_provider, IdentityStatus,
    REASON_CONFLICTING_EVIDENCE, REASON_INTERNAL_MARKER,
};
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

        // Checkpoints written before identity context existed — including the
        // producer-surface field added for Codex Desktop — are replayed from a
        // bounded prefix once. Events before the old cursor are suppressed, but
        // their session/turn/call metadata rebuilds the context needed by the
        // unread tail.
        let saved_context = cursor.context.clone().unwrap_or_default();
        let replay_prefix = cursor.byte_offset > 0
            && (cursor.context.is_none() || !saved_context.producer_surface_seen);
        let read_offset = if replay_prefix { 0 } else { cursor.byte_offset };
        let mut reader = JsonlCursorReader::open(&source_path, read_offset).map_err(|error| {
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
        let mut turn_context: HashMap<String, TurnContext> = saved_context
            .turns
            .iter()
            .map(|turn| {
                (
                    turn.id.clone(),
                    TurnContext {
                        cwd: turn.cwd.clone().map(PathBuf::from),
                        model: normalize_identity_model(turn.model.as_deref()),
                        identity_reason: turn.identity_reason.clone(),
                        identity_conflict: turn.identity_conflict,
                    },
                )
            })
            .collect();
        let mut session_id: Option<String> = saved_context.session_id.clone();
        let mut session_cwd: Option<PathBuf> = saved_context.session_cwd.clone().map(PathBuf::from);
        let mut session_provider: Option<String> = saved_context
            .provider
            .as_deref()
            .and_then(|provider| normalize_identity_provider(Some(provider)));
        let mut session_provider_reason = saved_context.provider_reason.clone();
        let mut session_provider_conflict = saved_context.provider_conflict;
        let mut producer_surface = saved_context.producer_surface.clone();
        let mut producer_surface_seen = saved_context.producer_surface_seen;
        let mut last_offset = read_offset;
        let mut last_record_time: Option<DateTime<Utc>> = cursor.last_record_time;
        let mut last_record_id: Option<String> = cursor.last_record_id.clone();
        // `response_item` records (the real apply_patch call/output pair — see below)
        // carry no `turn_id` of their own, unlike `event_msg`/`patch_apply_end`. Each
        // `turn_context` record precedes the response_items generated within that
        // turn in the transcript's own timestamp order, so tracking "the most
        // recently seen turn" is the correlation the format actually offers.
        let mut current_turn_id: Option<String> = saved_context.current_turn_id.clone();
        // A `custom_tool_call` (the apply_patch call itself, carrying the patch text)
        // is matched to its `custom_tool_call_output` (proof the call completed) by
        // `call_id`. A pending call is checkpointed by stable references and the
        // cursor is rewound while its result is missing, so the next bounded pass
        // can re-read the call without persisting patch/source text.
        let mut pending_apply_patch: HashMap<String, PendingApplyPatch> = saved_context
            .pending_calls
            .iter()
            .filter_map(|pending| {
                Some((
                    pending.id.clone(),
                    PendingApplyPatch {
                        input: pending.input.clone()?,
                        turn_id: pending.turn_id.clone(),
                        model: normalize_identity_model(pending.model.as_deref()),
                        identity_reason: pending.identity_reason.clone(),
                        timestamp: pending.occurred_at?,
                        offset_before: pending.offset_before?,
                        identity_conflict: pending.identity_conflict,
                    },
                ))
            })
            .collect();
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
                        let next_session_id = meta.id.or(meta.session_id);
                        if session_id
                            .as_deref()
                            .zip(next_session_id.as_deref())
                            .is_some_and(|(current, next)| current != next)
                        {
                            // Session and turn identity are scoped together. A
                            // resumed transcript may contain more than one
                            // session; never let a pending call or model from the
                            // previous session explain the next session's edit.
                            turn_context.clear();
                            pending_apply_patch.clear();
                            completed_apply_patch.clear();
                            failed_apply_patch.clear();
                            session_provider = None;
                            session_provider_reason = None;
                            session_provider_conflict = false;
                            current_turn_id = None;
                        }
                        session_id = next_session_id;
                        session_cwd = meta.cwd.map(PathBuf::from);
                        producer_surface = normalize_codex_surface(meta.originator.as_deref());
                        producer_surface_seen = true;
                        let provider = normalize_identity_provider(meta.model_provider.as_deref());
                        let provider_marker = meta
                            .model_provider
                            .as_deref()
                            .is_some_and(is_internal_marker);
                        if let (Some(previous), Some(next)) =
                            (session_provider.as_deref(), provider.as_deref())
                        {
                            if previous != next {
                                session_provider_conflict = true;
                                session_provider = None;
                                session_provider_reason =
                                    Some(REASON_CONFLICTING_EVIDENCE.to_string());
                            }
                        } else if !session_provider_conflict && provider.is_some() {
                            session_provider = provider;
                            session_provider_reason = None;
                        } else if !session_provider_conflict && provider_marker {
                            session_provider_reason = Some(REASON_INTERNAL_MARKER.to_string());
                        }
                    }
                }
                "turn_context" => {
                    let parsed: Result<TurnContextPayload, _> =
                        serde_json::from_value(record.payload);
                    if let Ok(turn) = parsed {
                        current_turn_id = Some(turn.turn_id.clone());
                        let model = normalize_identity_model(turn.model.as_deref());
                        let model_marker = turn.model.as_deref().is_some_and(is_internal_marker);
                        let cwd = turn.cwd.map(PathBuf::from);
                        if let Some(previous) = turn_context.get_mut(&turn.turn_id) {
                            if let (Some(previous_model), Some(next_model)) =
                                (previous.model.as_deref(), model.as_deref())
                            {
                                if previous_model != next_model {
                                    previous.identity_conflict = true;
                                    previous.model = None;
                                    previous.identity_reason =
                                        Some(REASON_CONFLICTING_EVIDENCE.to_string());
                                }
                            } else if !previous.identity_conflict && model.is_some() {
                                previous.model = model;
                                previous.identity_reason = None;
                            } else if !previous.identity_conflict && model_marker {
                                previous.identity_reason = Some(REASON_INTERNAL_MARKER.to_string());
                            }
                            if previous.cwd.is_none() {
                                previous.cwd = cwd;
                            }
                        } else {
                            turn_context.insert(
                                turn.turn_id,
                                TurnContext {
                                    cwd,
                                    model,
                                    identity_reason: model_marker
                                        .then(|| REASON_INTERNAL_MARKER.to_string()),
                                    identity_conflict: false,
                                },
                            );
                        }
                    }
                }
                "event_msg" => {
                    let inner_type = record
                        .payload
                        .get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default();
                    if inner_type == "item_completed" {
                        let parsed: ItemCompletedPayload =
                            match serde_json::from_value(record.payload) {
                                Ok(payload) => payload,
                                Err(error) => {
                                    warnings.push(ParseWarning {
                                        record_id: None,
                                        message: format!(
                                            "malformed item_completed payload: {error}"
                                        ),
                                    });
                                    continue;
                                }
                            };
                        if parsed.item.item_type != "FileChange"
                            || parsed.item.status.as_deref() != Some("completed")
                        {
                            continue;
                        }
                        let Some(item_id) = parsed.item.id.as_deref().filter(|id| !id.is_empty())
                        else {
                            continue;
                        };
                        if completed_apply_patch.contains(item_id) {
                            // A legacy response_item completion and the newer native
                            // FileChange completion can describe one exec bridge call.
                            // The operation has already been emitted, so keep one
                            // event rather than creating a duplicate heartbeat.
                            continue;
                        }

                        let event_turn_id =
                            parsed.turn_id.clone().or_else(|| current_turn_id.clone());
                        let turn = event_turn_id.as_ref().and_then(|id| turn_context.get(id));
                        let project_root = turn
                            .and_then(|context| context.cwd.clone())
                            .or_else(|| session_cwd.clone());
                        let model = turn.and_then(|context| context.model.clone());
                        let identity_reason = turn
                            .and_then(|context| context.identity_reason.clone())
                            .or_else(|| session_provider_reason.clone());
                        let identity_conflict = session_provider_conflict
                            || turn.is_some_and(|context| context.identity_conflict);
                        let occurred_at = timestamp_from_millis(
                            parsed.completed_at_ms.or(parsed.item.completed_at_ms),
                            record.timestamp,
                        );
                        let mut changes: Vec<(String, CodexItemChange)> =
                            parsed.item.changes.into_iter().collect();
                        changes.sort_by(|left, right| left.0.cmp(&right.0));
                        // The Desktop bridge writes the response-item `exec` call
                        // before this native completion. If both records describe
                        // the same patch, remember the wrapper call as completed so
                        // its output record cannot emit a second copy below. Keep
                        // this correlation metadata-only: patch text is inspected
                        // in memory and never enters the cursor or broker payload.
                        let native_shapes: Vec<FileChangeShape> = changes
                            .iter()
                            .filter_map(|(raw_path, change)| {
                                native_item_change_shape(raw_path, change, project_root.as_deref())
                            })
                            .collect();
                        if native_shapes.len() == changes.len() && !native_shapes.is_empty() {
                            let aliases: Vec<String> = pending_apply_patch
                                .iter()
                                .filter(|(_, pending)| {
                                    pending_apply_patch_matches_native(
                                        pending,
                                        &native_shapes,
                                        occurred_at,
                                        event_turn_id.as_deref(),
                                        project_root.as_deref(),
                                    )
                                })
                                .map(|(call_id, _)| call_id.clone())
                                .collect();
                            // More than one matching wrapper is ambiguous. In that
                            // case leave the pending calls alone and let the normal
                            // event-level dedupe decide without guessing ownership.
                            if aliases.len() == 1 {
                                let call_id = aliases.into_iter().next().unwrap();
                                pending_apply_patch.remove(&call_id);
                                completed_apply_patch.insert(call_id);
                            }
                        }
                        for (raw_path, change) in changes {
                            let Some(operation) = change.change_type.as_deref() else {
                                continue;
                            };
                            let mut change_kind = BrokerChangeKind::from_tool_operation(operation);
                            let mut entity_path = raw_path.clone();
                            let mut previous_path = None;
                            // Codex Desktop records a move as the old path keyed in
                            // `changes`, with the destination in `move_path`. Some
                            // builds label that operation `update`, so move_path is
                            // authoritative when it is present.
                            if let Some(destination) = change
                                .move_path
                                .as_deref()
                                .filter(|path| !path.trim().is_empty())
                            {
                                entity_path = destination.to_string();
                                previous_path = Some(raw_path.as_str());
                                change_kind = Some(BrokerChangeKind::Rename);
                            } else if matches!(change_kind, Some(BrokerChangeKind::Rename)) {
                                // A rename without both sides cannot satisfy the
                                // broker's identity invariant. Preserve the proven
                                // completion as a normal update until both paths are
                                // present in a future native record.
                                change_kind = Some(BrokerChangeKind::Modify);
                            }
                            let Some(change_kind) = change_kind else {
                                continue;
                            };
                            let delta = count_item_change_lines(&change, change_kind);
                            if replay_prefix && line.offset_before < cursor.byte_offset {
                                continue;
                            }
                            push_codex_event(
                                &mut events,
                                build_codex_file_event(
                                    "codex-v2",
                                    &format!("{}:{}", session_id.as_deref().unwrap_or(""), item_id),
                                    &entity_path,
                                    previous_path,
                                    change_kind,
                                    delta,
                                    occurred_at,
                                    session_id.clone(),
                                    event_turn_id.clone(),
                                    project_root.clone(),
                                    (!identity_conflict)
                                        .then(|| session_provider.clone())
                                        .flatten(),
                                    (!identity_conflict)
                                        .then(|| normalize_identity_model(model.as_deref()))
                                        .flatten(),
                                    identity_reason.clone(),
                                    identity_conflict,
                                    producer_surface.clone(),
                                ),
                            );
                        }
                        // Older Codex CLI builds give the native completion the same
                        // id as the apply_patch call. The output record below then
                        // short-circuits on `completed_apply_patch`, so release the
                        // pending call here or it pins the checkpoint forever.
                        pending_apply_patch.remove(item_id);
                        completed_apply_patch.insert(item_id.to_string());
                        last_record_id = Some(item_id.to_string());
                        continue;
                    }
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
                    if failed_apply_patch.contains(&parsed.call_id) {
                        continue;
                    }
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
                    let pending = pending_apply_patch.remove(&parsed.call_id);
                    completed_apply_patch.insert(parsed.call_id.clone());
                    let event_turn_id = parsed
                        .turn_id
                        .clone()
                        .or_else(|| pending.as_ref().and_then(|call| call.turn_id.clone()));
                    let turn = event_turn_id.as_ref().and_then(|id| turn_context.get(id));
                    let project_root = turn
                        .and_then(|t| t.cwd.clone())
                        .or_else(|| session_cwd.clone());
                    let model = turn
                        .and_then(|t| t.model.clone())
                        .or_else(|| pending.as_ref().and_then(|call| call.model.clone()));
                    let identity_reason = turn
                        .and_then(|t| t.identity_reason.clone())
                        .or_else(|| {
                            pending
                                .as_ref()
                                .and_then(|call| call.identity_reason.clone())
                        })
                        .or_else(|| session_provider_reason.clone());
                    let identity_conflict = session_provider_conflict
                        || pending.as_ref().is_some_and(|call| call.identity_conflict)
                        || turn.is_some_and(|turn| turn.identity_conflict);

                    for (raw_path, change) in parsed.changes {
                        let delta = change
                            .unified_diff
                            .as_deref()
                            .map(count_unified_diff_lines)
                            .unwrap_or_default();
                        if delta.added == 0 && delta.deleted == 0 {
                            // A success envelope without a diff does not prove a
                            // file mutation. Keep the heartbeat ledger free of
                            // zero-line phantom edits.
                            continue;
                        }
                        let entity = resolve_entity(&raw_path, project_root.as_deref());
                        let previous_entity = change
                            .previous_path
                            .as_deref()
                            .map(|path| resolve_entity(path, project_root.as_deref()));
                        let event_project_root = effective_project_root(
                            &entity,
                            previous_entity.as_deref(),
                            project_root.clone(),
                        );
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
                        if replay_prefix && line.offset_before < cursor.byte_offset {
                            continue;
                        }
                        events.push(AiEditEvent {
                            event_id: opaque_file_event_id("codex-v1", &parsed.call_id, &raw_path),
                            agent: "codex".to_string(),
                            provider: (!identity_conflict)
                                .then(|| session_provider.clone())
                                .flatten(),
                            model: (!identity_conflict)
                                .then(|| normalize_identity_model(model.as_deref()))
                                .flatten(),
                            session_id: session_id.clone(),
                            turn_id: event_turn_id.clone(),
                            identity_message_id: None,
                            identity_status: identity_conflict
                                .then(|| IdentityStatus::Conflict.as_str().to_string())
                                .or_else(|| {
                                    identity_reason
                                        .as_ref()
                                        .map(|_| IdentityStatus::Partial.as_str().to_string())
                                }),
                            identity_reason: identity_conflict
                                .then(|| REASON_CONFLICTING_EVIDENCE.to_string())
                                .or(identity_reason.clone()),
                            identity_source: Some(AiEventSource::Transcript.as_str().to_string()),
                            tool_event_id: Some(parsed.call_id.clone()),
                            producer_surface: producer_surface.clone(),
                            occurred_at: record.timestamp,
                            entity,
                            project_root: event_project_root,
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
                                let turn_id = current_turn_id.clone();
                                let turn = turn_id
                                    .as_ref()
                                    .and_then(|turn_id| turn_context.get(turn_id));
                                let reported_model = turn.and_then(|turn| turn.model.clone());
                                let mut identity_reason =
                                    turn.and_then(|turn| turn.identity_reason.clone());
                                let mut model = reported_model.clone();
                                let mut identity_conflict = session_provider_conflict
                                    || turn.is_some_and(|turn| turn.identity_conflict);
                                let mut timestamp = record.timestamp;
                                let mut offset_before = line.offset_before;
                                if let Some(previous) = pending_apply_patch.get(&call_id) {
                                    // Reusing an ID for different requested mutations
                                    // makes a later output impossible to correlate.
                                    if previous.input != input {
                                        pending_apply_patch.remove(&call_id);
                                        failed_apply_patch.insert(call_id);
                                        continue;
                                    }
                                    if previous.turn_id != turn_id
                                        || (previous.model.is_some()
                                            && reported_model.is_some()
                                            && previous.model != reported_model)
                                    {
                                        identity_conflict = true;
                                    }
                                    if previous.identity_conflict {
                                        identity_conflict = true;
                                    }
                                    // Some clients repeat a custom_tool_call after
                                    // streaming metadata has been normalized away. Preserve
                                    // a model already tied to this call when the duplicate
                                    // has no model, and keep the earliest location for a
                                    // restart-safe checkpoint.
                                    if model.is_none() {
                                        model = previous.model.clone();
                                    }
                                    if identity_reason.is_none() {
                                        identity_reason = previous.identity_reason.clone();
                                    }
                                    timestamp = std::cmp::min(previous.timestamp, timestamp);
                                    offset_before = previous.offset_before.min(offset_before);
                                }
                                pending_apply_patch.insert(
                                    call_id,
                                    PendingApplyPatch {
                                        input,
                                        turn_id,
                                        model,
                                        identity_reason,
                                        timestamp,
                                        offset_before,
                                        identity_conflict,
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
                            // Completion of exec is not completion of apply_patch.
                            // Inspect only supported result envelopes locally, then
                            // discard them; neither output nor patch enters the cursor.
                            let Some(pending) = pending_apply_patch.remove(&call_id) else {
                                continue;
                            };
                            last_record_id = Some(call_id.clone());
                            let confirmed_files = match normalize_patch_outcome(&item.output, 0) {
                                PatchOutcome::Success(files) => files,
                                PatchOutcome::Failure => {
                                    failed_apply_patch.insert(call_id);
                                    continue;
                                }
                                PatchOutcome::Unavailable => continue,
                            };
                            completed_apply_patch.insert(call_id.clone());
                            if !is_complete_patch(&pending.input) {
                                continue;
                            }
                            let turn = pending.turn_id.as_ref().and_then(|id| turn_context.get(id));
                            let project_root = turn
                                .and_then(|t| t.cwd.clone())
                                .or_else(|| session_cwd.clone());
                            let model = turn
                                .and_then(|t| t.model.clone())
                                .or_else(|| pending.model.clone());
                            let identity_reason = turn
                                .and_then(|turn| turn.identity_reason.clone())
                                .or_else(|| pending.identity_reason.clone())
                                .or_else(|| session_provider_reason.clone());
                            let identity_conflict = session_provider_conflict
                                || pending.identity_conflict
                                || turn.is_some_and(|turn| turn.identity_conflict);

                            let changes = parse_apply_patch(&pending.input);
                            let mut requested_counts = HashMap::new();
                            let mut confirmed_counts = HashMap::new();
                            for change in &changes {
                                *requested_counts
                                    .entry((summary_kind(change.change_kind), change.path.clone()))
                                    .or_insert(0usize) += 1;
                            }
                            for confirmation in confirmed_files {
                                *confirmed_counts.entry(confirmation).or_insert(0usize) += 1;
                            }
                            let mut path_occurrences = HashMap::<String, usize>::new();
                            for change in changes {
                                // Stable occurrence identity includes unconfirmed
                                // requests so a partial result cannot shift later IDs.
                                let occurrence =
                                    path_occurrences.entry(change.path.clone()).or_insert(0);
                                let operation_id = if *occurrence == 0 {
                                    call_id.clone()
                                } else {
                                    format!("{}:{}", call_id, *occurrence)
                                };
                                *occurrence += 1;
                                let key = (summary_kind(change.change_kind), change.path.clone());
                                // A single summary entry cannot distinguish which
                                // of two same-path/same-kind requests succeeded.
                                if confirmed_counts.get(&key) != requested_counts.get(&key) {
                                    continue;
                                }
                                if change.change_kind == BrokerChangeKind::Modify
                                    && change.delta.added == 0
                                    && change.delta.deleted == 0
                                {
                                    continue;
                                }
                                let entity = resolve_entity(&change.path, project_root.as_deref());
                                let previous_entity = change
                                    .previous_path
                                    .as_deref()
                                    .map(|path| resolve_entity(path, project_root.as_deref()));
                                let event_project_root = effective_project_root(
                                    &entity,
                                    previous_entity.as_deref(),
                                    project_root.clone(),
                                );
                                if replay_prefix && line.offset_before < cursor.byte_offset {
                                    continue;
                                }
                                push_codex_event(
                                    &mut events,
                                    AiEditEvent {
                                        event_id: opaque_file_event_id(
                                            "codex-v2",
                                            &operation_id,
                                            &change.path,
                                        ),
                                        agent: "codex".to_string(),
                                        provider: (!identity_conflict)
                                            .then(|| session_provider.clone())
                                            .flatten(),
                                        model: (!identity_conflict)
                                            .then(|| normalize_identity_model(model.as_deref()))
                                            .flatten(),
                                        session_id: session_id.clone(),
                                        turn_id: pending.turn_id.clone(),
                                        identity_message_id: None,
                                        identity_status: identity_conflict
                                            .then(|| IdentityStatus::Conflict.as_str().to_string())
                                            .or_else(|| {
                                                identity_reason.as_ref().map(|_| {
                                                    IdentityStatus::Partial.as_str().to_string()
                                                })
                                            }),
                                        identity_reason: identity_conflict
                                            .then(|| REASON_CONFLICTING_EVIDENCE.to_string())
                                            .or(identity_reason.clone()),
                                        identity_source: Some(
                                            AiEventSource::Transcript.as_str().to_string(),
                                        ),
                                        tool_event_id: Some(call_id.clone()),
                                        producer_surface: producer_surface.clone(),
                                        occurred_at: pending.timestamp,
                                        entity,
                                        project_root: event_project_root,
                                        lines_added: Some(change.delta.added),
                                        lines_deleted: change.deleted_lines(),
                                        change_kind: change.change_kind,
                                        previous_entity,
                                        input_tokens: None,
                                        output_tokens: None,
                                        source: AiEventSource::Transcript,
                                        confidence: AiConfidence::Verified,
                                    },
                                );
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

        // Keep the active turn and every pending call's turn ahead of the bounded
        // cache.  HashMap iteration order is deliberately unspecified; taking the
        // first 128 entries could otherwise evict the exact context needed to
        // attribute a completion after a restart.  The remaining historical turns
        // are only a fallback for records that arrive without an explicit turn id.
        let mut required_turn_ids = Vec::new();
        if let Some(turn_id) = current_turn_id.as_ref() {
            required_turn_ids.push(turn_id.clone());
        }
        for pending in pending_apply_patch.values() {
            if let Some(turn_id) = pending.turn_id.as_ref() {
                if !required_turn_ids.iter().any(|required| required == turn_id) {
                    required_turn_ids.push(turn_id.clone());
                }
            }
        }
        let mut serialized_turns = Vec::with_capacity(128.min(turn_context.len()));
        for turn_id in &required_turn_ids {
            if let Some(turn) = turn_context.get(turn_id) {
                serialized_turns.push(ParserTurnContext {
                    id: turn_id.clone(),
                    cwd: turn
                        .cwd
                        .as_ref()
                        .map(|path| path.to_string_lossy().into_owned()),
                    model: turn.model.clone(),
                    identity_reason: turn.identity_reason.clone(),
                    identity_conflict: turn.identity_conflict,
                });
            }
        }
        for (id, turn) in turn_context.iter() {
            if serialized_turns.len() >= 128
                || serialized_turns
                    .iter()
                    .any(|saved| saved.id.as_str() == id.as_str())
            {
                continue;
            }
            serialized_turns.push(ParserTurnContext {
                id: id.clone(),
                cwd: turn
                    .cwd
                    .as_ref()
                    .map(|path| path.to_string_lossy().into_owned()),
                model: turn.model.clone(),
                identity_reason: turn.identity_reason.clone(),
                identity_conflict: turn.identity_conflict,
            });
        }
        let serialized_pending = pending_apply_patch
            .iter()
            .map(|(id, pending)| ParserPendingCall {
                id: id.clone(),
                turn_id: pending.turn_id.clone(),
                identity_message_id: None,
                model: pending.model.clone().or_else(|| {
                    pending.turn_id.as_ref().and_then(|turn_id| {
                        turn_context
                            .get(turn_id)
                            .and_then(|turn| turn.model.clone())
                    })
                }),
                identity_reason: pending.identity_reason.clone().or_else(|| {
                    pending
                        .turn_id
                        .as_ref()
                        .and_then(|turn_id| turn_context.get(turn_id))
                        .and_then(|turn| turn.identity_reason.clone())
                }),
                identity_conflict: pending.identity_conflict,
                cwd: pending
                    .turn_id
                    .as_ref()
                    .and_then(|turn_id| turn_context.get(turn_id))
                    .and_then(|turn| turn.cwd.as_ref())
                    .map(|path| path.to_string_lossy().into_owned()),
                // The cursor is rewound to `offset_before` while a call is
                // pending, so the next pass re-reads the call and reconstructs
                // its patch locally.  Do not persist patch/source text in the
                // checkpoint; only the stable references and correlation data
                // belong in parser state.
                input: None,
                occurred_at: Some(pending.timestamp),
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
                    session_cwd: session_cwd.map(|path| path.to_string_lossy().into_owned()),
                    provider: session_provider,
                    provider_reason: session_provider_reason,
                    provider_conflict: session_provider_conflict,
                    producer_surface,
                    producer_surface_seen,
                    current_turn_id,
                    turns: serialized_turns,
                    pending_calls: serialized_pending,
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

/// Choose the narrowest trustworthy workspace root for a completed file change.
///
/// Codex Desktop can keep one conversation alive while the user asks it to edit a
/// different checkout. In that case the turn/session cwd is stale, while the native
/// FileChange path is absolute and authoritative. Keeping the stale cwd makes broker
/// validation reject the event as outside `project_root`. Resolve the project that owns
/// the changed path instead (see `crate::project`); if none exists, omit the root so the
/// event is still delivered without inventing a project name.
fn effective_project_root(
    entity: &Path,
    previous_entity: Option<&Path>,
    declared_root: Option<PathBuf>,
) -> Option<PathBuf> {
    if let Some(root) = declared_root.as_ref() {
        if entity.starts_with(root)
            && previous_entity.is_none_or(|previous| previous.starts_with(root))
            && has_codex_project_marker(root)
        {
            return declared_root;
        }
    }

    // Resolve from the changed path itself. The repository root wins over any nested
    // manifest, so an edit under `crates/wakaclock-cli` is bounded by the repository
    // rather than by that crate's `Cargo.toml`.
    crate::project::resolve_project(entity, None)
        .map(|resolved| resolved.root)
        .filter(|root| previous_entity.is_none_or(|previous| previous.starts_with(root)))
}

fn has_codex_project_marker(path: &Path) -> bool {
    if path.join(".git").exists() {
        return true;
    }
    [
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "go.mod",
        "composer.json",
        "pnpm-workspace.yaml",
        "lerna.json",
        "nx.json",
        "rush.json",
    ]
    .iter()
    .any(|marker| path.join(marker).is_file())
}

/// Recognize only an unconditional, single native call whose result is forwarded.
/// General JavaScript cannot establish which nested call produced an output. In
/// particular, substring extraction would accept comments, dead branches, aliases,
/// multiple calls, or a patch literal unrelated to the successful inner result.
///
/// The bridge is not itself a source of file evidence: only a successfully paired
/// `custom_tool_call_output` is emitted below. This helper therefore only unwraps the
/// string argument and deliberately ignores shell commands or unrelated text that merely
/// mentions `apply_patch`.
fn extract_apply_patch_input(input: &str) -> Option<String> {
    let mut input = input.trim();
    let mut binding = None;
    if let Some(declaration) = input.strip_prefix("const ") {
        let (name, assigned) = declaration.split_once('=')?;
        let name = name.trim();
        if name.is_empty()
            || !name
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
        {
            return None;
        }
        let assigned = assigned.trim_start();
        let (value, end) = parse_json_string_prefix(assigned)?;
        input = assigned[end..].trim_start().strip_prefix(';')?.trim_start();
        // Some observed desktop inputs encode a trailing newline twice.
        input = input.strip_prefix("\\n").unwrap_or(input).trim_start();
        binding = Some((name, value));
    }
    let argument = input
        .strip_prefix("text(await tools.apply_patch(")?
        .trim_start();
    let (patch, remainder) = if argument.starts_with('"') {
        let (value, end) = parse_json_string_prefix(argument)?;
        (value, &argument[end..])
    } else {
        let (name, value) = binding?;
        (value, argument.strip_prefix(name)?)
    };
    let trailing = remainder.trim_start().strip_prefix("))")?.trim();
    let trailing = trailing.strip_prefix(';').unwrap_or(trailing).trim();
    let trailing = trailing.strip_suffix("\\n").unwrap_or(trailing).trim();
    trailing.is_empty().then_some(patch)
}

fn summary_kind(kind: BrokerChangeKind) -> char {
    match kind {
        BrokerChangeKind::Create => 'A',
        BrokerChangeKind::Delete => 'D',
        BrokerChangeKind::Modify | BrokerChangeKind::Rename => 'M',
    }
}

fn is_complete_patch(input: &str) -> bool {
    let mut lines = input.trim().lines();
    lines.next() == Some("*** Begin Patch")
        && lines.next_back() == Some("*** End Patch")
        && !lines.any(|line| line == "*** Begin Patch" || line == "*** End Patch")
}

/// Internal outcome only: the persisted event contract still contains successful
/// file edits. Unknown/failed output produces no edit, and does not alter independent
/// session/usage/time observations. Strings live only in this bounded parse.
#[derive(Debug, PartialEq, Eq)]
enum PatchOutcome {
    Success(Vec<(char, String)>),
    Failure,
    Unavailable,
}

fn normalize_patch_outcome(value: &serde_json::Value, depth: usize) -> PatchOutcome {
    if depth > 8 {
        return PatchOutcome::Unavailable;
    }
    match value {
        serde_json::Value::String(text) => {
            let text = text.trim();
            // Bridge outputs can JSON-encode the native result once more.
            if text.starts_with('{') || text.starts_with('[') || text.starts_with('"') {
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(text) {
                    return normalize_patch_outcome(&value, depth + 1);
                }
            }
            if text.starts_with("Error:") || text.starts_with("error:") {
                return PatchOutcome::Failure;
            }
            let mut lines = text.lines();
            if lines.next() != Some("Success. Updated the following files:") {
                return PatchOutcome::Unavailable;
            }
            let mut files = Vec::new();
            for line in lines {
                let Some((kind, path)) = line.split_once(' ') else {
                    return PatchOutcome::Unavailable;
                };
                if !matches!(kind, "A" | "M" | "D") || path.trim().is_empty() {
                    return PatchOutcome::Unavailable;
                }
                files.push((kind.chars().next().unwrap(), path.to_string()));
            }
            if files.is_empty() {
                PatchOutcome::Unavailable
            } else {
                PatchOutcome::Success(files)
            }
        }
        serde_json::Value::Object(object) => {
            if object.get("isError").and_then(|v| v.as_bool()) == Some(true)
                || object.get("success").and_then(|v| v.as_bool()) == Some(false)
                || object.get("error").is_some_and(|v| !v.is_null())
                || object
                    .get("exit_code")
                    .is_some_and(|v| v.as_i64() != Some(0))
                || object
                    .get("metadata")
                    .and_then(|v| v.get("exit_code"))
                    .is_some_and(|v| v.as_i64() != Some(0))
                || object
                    .get("status")
                    .is_some_and(|v| !matches!(v.as_str(), Some("completed" | "success")))
            {
                return PatchOutcome::Failure;
            }
            if object.get("type").and_then(|v| v.as_str()) == Some("text") {
                if ["output", "result", "content"]
                    .iter()
                    .any(|key| object.contains_key(*key))
                {
                    return PatchOutcome::Unavailable;
                }
                return object
                    .get("text")
                    .map_or(PatchOutcome::Unavailable, |value| {
                        normalize_patch_outcome(value, depth + 1)
                    });
            }
            // Exactly one payload field: do not pick a successful child from an
            // ambiguous envelope with a different failed or unreported sibling.
            let mut payloads = ["output", "result", "content"]
                .iter()
                .filter_map(|key| object.get(*key));
            match (payloads.next(), payloads.next()) {
                (Some(payload), None) => normalize_patch_outcome(payload, depth + 1),
                _ => PatchOutcome::Unavailable,
            }
        }
        // One text result is the supported MCP content-block representation.
        // Multiple blocks may describe different inner calls; do not pool them.
        serde_json::Value::Array(values) if values.len() == 1 => {
            normalize_patch_outcome(&values[0], depth + 1)
        }
        _ => PatchOutcome::Unavailable,
    }
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
    identity_reason: Option<String>,
    identity_conflict: bool,
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
    /// The apply_patch call's patch argument, held only during this local parse.
    #[serde(default)]
    input: Option<String>,
    /// Completion status is a veto on failure, never proof of a file edit.
    #[serde(default)]
    status: Option<String>,
    /// Read only to normalize known result envelopes; never persisted or emitted.
    #[serde(default)]
    output: serde_json::Value,
}

/// An apply_patch call waiting for its matching `custom_tool_call_output`.
struct PendingApplyPatch {
    input: String,
    turn_id: Option<String>,
    model: Option<String>,
    identity_reason: Option<String>,
    timestamp: DateTime<Utc>,
    offset_before: u64,
    identity_conflict: bool,
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
    #[serde(default)]
    originator: Option<String>,
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

#[derive(Debug, Deserialize)]
struct ItemCompletedPayload {
    #[serde(default)]
    turn_id: Option<String>,
    /// Current Codex Desktop places completion time on the event payload, while
    /// a few prerelease shapes placed it inside the item. Prefer this field and
    /// retain the nested fallback for compatibility.
    #[serde(default)]
    completed_at_ms: Option<i64>,
    item: FileChangeItem,
}

#[derive(Debug, Deserialize)]
struct FileChangeItem {
    #[serde(rename = "type")]
    item_type: String,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    completed_at_ms: Option<i64>,
    #[serde(default)]
    changes: HashMap<String, CodexItemChange>,
}

#[derive(Debug, Deserialize)]
struct CodexItemChange {
    #[serde(rename = "type", default)]
    change_type: Option<String>,
    #[serde(default)]
    unified_diff: Option<String>,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    move_path: Option<String>,
}

/// Metadata-only identity used to correlate a native `FileChange` item with the
/// response-item `exec` wrapper that caused it. It deliberately contains no patch
/// text, file content, or command output.
#[derive(Debug, Clone, PartialEq, Eq)]
struct FileChangeShape {
    entity: PathBuf,
    previous_entity: Option<PathBuf>,
    change_kind: BrokerChangeKind,
    delta: LineDelta,
}

pub(crate) fn normalize_codex_surface(originator: Option<&str>) -> Option<String> {
    // Only the exact Desktop provenance has a captured contract in this checkout.
    // Missing/new labels do not prove CLI or IDE execution.
    match originator
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("codex desktop" | "codex-desktop") => Some("codex-desktop".into()),
        _ => Some("codex-unknown".into()),
    }
}

fn timestamp_from_millis(value: Option<i64>, fallback: DateTime<Utc>) -> DateTime<Utc> {
    value
        .and_then(DateTime::<Utc>::from_timestamp_millis)
        .unwrap_or(fallback)
}

fn count_item_change_lines(change: &CodexItemChange, kind: BrokerChangeKind) -> LineDelta {
    if let Some(diff) = change.unified_diff.as_deref() {
        return count_unified_diff_lines(diff);
    }
    let Some(content) = change.content.as_deref() else {
        return LineDelta::default();
    };
    match kind {
        BrokerChangeKind::Create => LineDelta {
            added: count_content_lines(content),
            deleted: 0,
        },
        BrokerChangeKind::Delete => LineDelta {
            added: 0,
            deleted: count_content_lines(content),
        },
        // A full replacement without a diff still proves a mutation. Treat the
        // available content as added lines and leave the deleted side at zero;
        // the broker never receives the content itself.
        BrokerChangeKind::Modify | BrokerChangeKind::Rename => LineDelta {
            added: count_content_lines(content),
            deleted: 0,
        },
    }
}

fn native_item_change_shape(
    raw_path: &str,
    change: &CodexItemChange,
    project_root: Option<&Path>,
) -> Option<FileChangeShape> {
    let operation = change.change_type.as_deref()?;
    let mut change_kind = BrokerChangeKind::from_tool_operation(operation);
    let mut entity_path = raw_path;
    let mut previous_path = None;
    if let Some(destination) = change
        .move_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
    {
        entity_path = destination;
        previous_path = Some(raw_path);
        change_kind = Some(BrokerChangeKind::Rename);
    } else if matches!(change_kind, Some(BrokerChangeKind::Rename)) {
        change_kind = Some(BrokerChangeKind::Modify);
    }
    let change_kind = change_kind?;
    Some(FileChangeShape {
        entity: resolve_entity(entity_path, project_root),
        previous_entity: previous_path.map(|path| resolve_entity(path, project_root)),
        change_kind,
        delta: count_item_change_lines(change, change_kind),
    })
}

fn apply_patch_change_shape(
    change: &crate::ai::patch::ApplyPatchFileChange,
    project_root: Option<&Path>,
) -> FileChangeShape {
    FileChangeShape {
        entity: resolve_entity(&change.path, project_root),
        previous_entity: change
            .previous_path
            .as_deref()
            .map(|path| resolve_entity(path, project_root)),
        change_kind: change.change_kind,
        delta: change.delta,
    }
}

fn file_change_shape_order(left: &FileChangeShape, right: &FileChangeShape) -> std::cmp::Ordering {
    left.entity
        .cmp(&right.entity)
        .then_with(|| left.previous_entity.cmp(&right.previous_entity))
        .then_with(|| left.change_kind.as_str().cmp(right.change_kind.as_str()))
        .then_with(|| left.delta.added.cmp(&right.delta.added))
        .then_with(|| left.delta.deleted.cmp(&right.delta.deleted))
}

fn line_deltas_compatible(left: LineDelta, right: LineDelta) -> bool {
    // A marker-only apply_patch section carries no line body, so zero/zero is
    // unknown rather than a proven empty edit. Treat it as a wildcard when the
    // native FileChange has a content-derived count (notably Delete File).
    (left.added == 0 && left.deleted == 0)
        || (right.added == 0 && right.deleted == 0)
        || left == right
}

fn pending_apply_patch_matches_native(
    pending: &PendingApplyPatch,
    native_shapes: &[FileChangeShape],
    occurred_at: DateTime<Utc>,
    event_turn_id: Option<&str>,
    project_root: Option<&Path>,
) -> bool {
    if let (Some(pending_turn), Some(event_turn)) = (pending.turn_id.as_deref(), event_turn_id) {
        if pending_turn != event_turn {
            return false;
        }
    }
    if (pending.timestamp.timestamp_millis() - occurred_at.timestamp_millis()).abs() > 5_000 {
        return false;
    }

    let mut patch_shapes: Vec<FileChangeShape> = parse_apply_patch(&pending.input)
        .iter()
        .map(|change| apply_patch_change_shape(change, project_root))
        .collect();
    if patch_shapes.len() != native_shapes.len() || patch_shapes.is_empty() {
        return false;
    }
    let mut native_shapes = native_shapes.to_vec();
    patch_shapes.sort_by(file_change_shape_order);
    native_shapes.sort_by(file_change_shape_order);
    patch_shapes
        .iter()
        .zip(native_shapes.iter())
        .all(|(patch, native)| {
            patch.entity == native.entity
                && patch.previous_entity == native.previous_entity
                && patch.change_kind == native.change_kind
                && line_deltas_compatible(patch.delta, native.delta)
        })
}

#[allow(clippy::too_many_arguments)]
fn build_codex_file_event(
    id_prefix: &str,
    operation_id: &str,
    raw_path: &str,
    previous_path: Option<&str>,
    change_kind: BrokerChangeKind,
    delta: LineDelta,
    occurred_at: DateTime<Utc>,
    session_id: Option<String>,
    turn_id: Option<String>,
    project_root: Option<PathBuf>,
    provider: Option<String>,
    model: Option<String>,
    identity_reason: Option<String>,
    identity_conflict: bool,
    producer_surface: Option<String>,
) -> AiEditEvent {
    let entity = resolve_entity(raw_path, project_root.as_deref());
    let previous_entity = previous_path.map(|path| resolve_entity(path, project_root.as_deref()));
    let project_root = effective_project_root(&entity, previous_entity.as_deref(), project_root);
    AiEditEvent {
        event_id: opaque_file_event_id(id_prefix, operation_id, raw_path),
        agent: "codex".to_string(),
        provider,
        model,
        session_id,
        turn_id,
        identity_message_id: None,
        identity_status: identity_conflict
            .then(|| IdentityStatus::Conflict.as_str().to_string())
            .or_else(|| {
                identity_reason
                    .as_ref()
                    .map(|_| IdentityStatus::Partial.as_str().to_string())
            }),
        identity_reason: identity_conflict
            .then(|| REASON_CONFLICTING_EVIDENCE.to_string())
            .or(identity_reason),
        identity_source: Some(AiEventSource::Transcript.as_str().to_string()),
        tool_event_id: Some(operation_id.to_string()),
        producer_surface,
        occurred_at,
        entity,
        project_root,
        lines_added: Some(delta.added),
        lines_deleted: Some(delta.deleted),
        change_kind,
        previous_entity,
        input_tokens: None,
        output_tokens: None,
        source: AiEventSource::Transcript,
        confidence: AiConfidence::Verified,
    }
}

/// The same Codex Desktop mutation can be represented twice in one transcript:
/// the response-item `exec` bridge proves the tool call, then the native
/// `item_completed/FileChange` event describes the completed file. Keep the first
/// metadata record and suppress the second representation without comparing or
/// persisting either side's source text.
fn push_codex_event(events: &mut Vec<AiEditEvent>, candidate: AiEditEvent) {
    let duplicate = events.iter().any(|existing| {
        existing.agent == candidate.agent
            && existing.entity == candidate.entity
            && existing.change_kind == candidate.change_kind
            && existing.previous_entity == candidate.previous_entity
            && existing.session_id == candidate.session_id
            // Repeated same-path operations in one apply_patch call share the
            // call id, while the wrapped exec and native FileChange records
            // have different operation ids. Keep the former distinct and
            // collapse only the latter representation pair.
            && existing.tool_event_id != candidate.tool_event_id
            && optional_values_compatible(existing.turn_id.as_deref(), candidate.turn_id.as_deref())
            && line_count_values_compatible(existing.lines_added, candidate.lines_added)
            && line_count_values_compatible(existing.lines_deleted, candidate.lines_deleted)
            && (existing.occurred_at.timestamp_millis() - candidate.occurred_at.timestamp_millis())
                .abs()
                <= 5_000
    });
    if !duplicate {
        events.push(candidate);
    }
}

fn optional_values_compatible<T: PartialEq>(left: Option<T>, right: Option<T>) -> bool {
    left.is_none() || right.is_none() || left == right
}

fn line_count_values_compatible(left: Option<u32>, right: Option<u32>) -> bool {
    optional_values_compatible(left, right)
        || matches!((left, right), (Some(0), Some(value)) | (Some(value), Some(0)) if value > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn file_change_outside_stale_session_root_uses_its_own_project_marker() {
        let base = std::env::temp_dir().join(format!(
            "wakaclock-codex-cross-project-{}",
            std::process::id()
        ));
        let stale_root = base.join("original-project");
        let actual_root = base.join("testatoaxis");
        let entity = actual_root.join("src/session-tracker.js");
        fs::create_dir_all(entity.parent().unwrap()).unwrap();
        fs::create_dir_all(&stale_root).unwrap();
        fs::write(
            actual_root.join("package.json"),
            r#"{"name":"testatoaxis"}"#,
        )
        .unwrap();
        fs::write(&entity, "export const value = 1;\n").unwrap();

        assert_eq!(
            effective_project_root(&entity, None, Some(stale_root)),
            Some(actual_root.clone())
        );

        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn file_change_in_a_nested_crate_is_bounded_by_the_repository_not_the_crate() {
        let base = std::env::temp_dir().join(format!(
            "wakaclock-codex-nested-crate-{}",
            std::process::id()
        ));
        let repo = base.join("wakaclock");
        let crate_root = repo.join("backend/api/crates/wakaclock-cli");
        let entity = crate_root.join("src/broker.rs");
        fs::create_dir_all(repo.join(".git")).unwrap();
        fs::create_dir_all(entity.parent().unwrap()).unwrap();
        fs::write(
            crate_root.join("Cargo.toml"),
            "[package]\nname = \"wakaclock-cli\"\n",
        )
        .unwrap();

        // Missing turn cwd, and a stale cwd from another checkout, both fall back to the
        // repository root.
        assert_eq!(
            effective_project_root(&entity, None, None),
            Some(repo.clone())
        );
        assert_eq!(
            effective_project_root(&entity, None, Some(base.join("AI-tiktok"))),
            Some(repo.clone())
        );

        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn file_change_without_a_trusted_marker_does_not_invent_a_root() {
        let entity = std::env::temp_dir()
            .join(format!("wakaclock-codex-no-project-{}", std::process::id()))
            .join("notes.txt");

        assert_eq!(
            effective_project_root(&entity, None, Some(PathBuf::from("/different"))),
            None
        );
    }

    #[test]
    fn stale_declared_root_without_a_marker_is_not_forwarded_to_the_broker() {
        let root = std::env::temp_dir().join(format!(
            "wakaclock-codex-unmarked-root-{}",
            std::process::id()
        ));
        let entity = root.join("src/notes.txt");

        assert_eq!(effective_project_root(&entity, None, Some(root)), None);
    }

    fn parse_outcome_fixture(
        name: &str,
        input: &str,
        output: serde_json::Value,
        status: Option<&str>,
    ) -> ParseBatch {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let sequence = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "wakaclock-codex-outcome-{}-{sequence}.jsonl",
            std::process::id()
        ));
        let mut file = fs::File::create(&path).unwrap();
        for payload in [
            serde_json::json!({"type":"session_meta", "payload":{"id":"outcome-session", "cwd":"/workspace"}}),
            serde_json::json!({"type":"turn_context", "payload":{"turn_id":"outcome-turn", "model":"example-model-id"}}),
            serde_json::json!({"type":"response_item", "payload":{"type":"custom_tool_call", "name":name, "call_id":"outcome-call", "input":input}}),
            serde_json::json!({"type":"response_item", "payload":{"type":"custom_tool_call_output", "call_id":"outcome-call", "status":status, "output":output}}),
        ] {
            let mut record = payload;
            record["timestamp"] = serde_json::json!("2026-09-15T00:00:00Z");
            writeln!(file, "{record}").unwrap();
        }
        let parser = CodexParser::new();
        let batch = parser
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
        // The output terminates the call even when unavailable. Restart does not
        // rewind forever, emit another event, or retain raw output/patch text.
        assert_eq!(
            batch.next_cursor.byte_offset,
            fs::metadata(&path).unwrap().len()
        );
        assert!(parser
            .parse_since(&ParseContext::default(), Some(&batch.next_cursor))
            .unwrap()
            .events
            .is_empty());
        assert!(batch
            .next_cursor
            .context
            .as_ref()
            .unwrap()
            .pending_calls
            .is_empty());
        fs::remove_file(path).unwrap();
        batch
    }

    const OUTCOME_PATCH: &str = "*** Begin Patch\n*** Add File: src/ok.rs\n+one\n*** End Patch";
    const OUTCOME_SUCCESS: &str = "Success. Updated the following files:\nA src/ok.rs\n";

    #[test]
    fn outputs_require_recognized_mutation_evidence_even_with_completed_status() {
        for output in [
            serde_json::Value::Null,
            serde_json::json!(""),
            serde_json::json!("Error: Failed to find expected lines. No files were modified."),
            serde_json::json!("No files were modified."),
            serde_json::json!("Script completed"),
            serde_json::json!("Success"),
            serde_json::json!("Success. Updated the following files:\n"),
            serde_json::json!("Success. Updated the following files:\nA src/other.rs\n"),
            serde_json::json!("Success. Updated the following files:\nM src/ok.rs\n"),
            serde_json::json!({"success":true}),
            serde_json::json!({"status":"completed", "output":"Error: apply_patch failed"}),
            serde_json::json!({"exit_code":0, "output":"No changes"}),
            serde_json::json!({"isError":true, "content":[{"type":"text", "text":OUTCOME_SUCCESS}]}),
            serde_json::json!({"success":false, "output":OUTCOME_SUCCESS}),
            serde_json::json!({"exit_code":1, "output":OUTCOME_SUCCESS}),
            serde_json::json!({"metadata":{"exit_code":1}, "output":OUTCOME_SUCCESS}),
            serde_json::json!({"type":"text", "text":OUTCOME_SUCCESS, "result":{"isError":true}}),
            serde_json::json!({"status":"cancelled", "output":OUTCOME_SUCCESS}),
            serde_json::json!({"output":OUTCOME_SUCCESS, "result":{"isError":true}}),
            serde_json::json!([{"type":"text", "text":OUTCOME_SUCCESS}, {"type":"text", "text":"Error"}]),
            serde_json::json!(format!("{OUTCOME_SUCCESS}Error: second patch failed")),
        ] {
            for status in [None, Some("completed"), Some("success")] {
                let batch =
                    parse_outcome_fixture("apply_patch", OUTCOME_PATCH, output.clone(), status);
                assert!(
                    batch.events.is_empty(),
                    "output {output}, status {status:?}"
                );
                assert!(batch.warnings.is_empty());
            }
        }
        for status in ["failed", "cancelled", "interrupted", "in_progress"] {
            assert!(parse_outcome_fixture(
                "apply_patch",
                OUTCOME_PATCH,
                serde_json::json!(OUTCOME_SUCCESS),
                Some(status)
            )
            .events
            .is_empty());
        }
    }

    #[test]
    fn recognized_direct_and_single_exec_result_envelopes_preserve_success() {
        let wrapper = format!(
            "text(await tools.apply_patch({}));",
            serde_json::to_string(OUTCOME_PATCH).unwrap()
        );
        for output in [
            serde_json::json!(OUTCOME_SUCCESS),
            serde_json::json!([{"type":"text", "text":OUTCOME_SUCCESS}]),
            serde_json::json!({"content":[{"type":"text", "text":OUTCOME_SUCCESS}], "isError":false}),
            serde_json::json!({"exit_code":0, "output":OUTCOME_SUCCESS}),
            serde_json::json!({"result":{"output":OUTCOME_SUCCESS}}),
            serde_json::json!(serde_json::to_string(
                &serde_json::json!({"output":OUTCOME_SUCCESS})
            )
            .unwrap()),
        ] {
            for (name, input) in [("apply_patch", OUTCOME_PATCH), ("exec", wrapper.as_str())] {
                let batch = parse_outcome_fixture(name, input, output.clone(), None);
                assert_eq!(batch.events.len(), 1, "{name}: {output}");
                assert_eq!(batch.events[0].lines_added, Some(1));
                assert_eq!(batch.events[0].confidence, AiConfidence::Verified);
            }
        }
    }

    #[test]
    fn wrapper_completion_cannot_verify_unrelated_or_multiple_inner_calls() {
        let literal = serde_json::to_string(OUTCOME_PATCH).unwrap();
        for input in [
            format!("if (false) {{ text(await tools.apply_patch({literal})); }}"),
            format!("// text(await tools.apply_patch({literal}));"),
            format!("await tools.apply_patch({literal}); text('done');"),
            format!("text(await tools.apply_patch({literal})); text(await tools.apply_patch({literal}));"),
            format!("text(await tools.exec({literal}));"),
            format!("text(await Promise.all([tools.apply_patch({literal}), tools.apply_patch({literal})]));"),
            format!("const patch = {literal}; patch = 'other'; text(await tools.apply_patch(patch));"),
        ] {
            assert!(parse_outcome_fixture("exec", &input, serde_json::json!(OUTCOME_SUCCESS), Some("completed")).events.is_empty(), "{input}");
        }
        let input = format!("text(await tools.apply_patch({literal}));");
        for output in [
            serde_json::json!({"status":"completed", "output":{"isError":true, "content":[{"type":"text", "text":"Error: patch failed"}]}}),
            serde_json::json!({"status":"completed", "output":[]}),
        ] {
            assert!(
                parse_outcome_fixture("exec", &input, output, Some("completed"))
                    .events
                    .is_empty()
            );
        }
    }

    #[test]
    fn partial_summary_verifies_only_matching_file_operations() {
        let input = "*** Begin Patch\n*** Add File: src/unconfirmed.rs\n+other\n*** Add File: src/ok.rs\n+one\n*** End Patch";
        let batch = parse_outcome_fixture(
            "apply_patch",
            input,
            serde_json::json!(OUTCOME_SUCCESS),
            None,
        );
        assert_eq!(batch.events.len(), 1);
        assert!(batch.events[0].entity.ends_with("src/ok.rs"));
    }

    #[test]
    fn repeated_same_kind_path_requires_complete_operation_evidence() {
        let input = "*** Begin Patch\n*** Update File: src/ok.rs\n+one\n*** Update File: src/ok.rs\n+two\n*** End Patch";
        let batch = parse_outcome_fixture(
            "apply_patch",
            input,
            serde_json::json!("Success. Updated the following files:\nM src/ok.rs\n"),
            None,
        );
        assert!(batch.events.is_empty());
        let batch = parse_outcome_fixture(
            "apply_patch",
            input,
            serde_json::json!("Success. Updated the following files:\nM src/ok.rs\nM src/ok.rs\n"),
            None,
        );
        assert_eq!(batch.events.len(), 2);
        assert_ne!(batch.events[0].event_id, batch.events[1].event_id);
    }

    #[test]
    fn truncated_patch_and_zero_line_modify_do_not_become_edits() {
        for input in [
            "*** Begin Patch\n*** Add File: src/ok.rs\n+one",
            "*** Add File: src/ok.rs\n+one\n*** End Patch",
            "*** Begin Patch\n*** Add File: src/ok.rs\n+one\n*** End Patch\n*** Begin Patch\n*** End Patch",
        ] {
            assert!(parse_outcome_fixture("apply_patch", input, serde_json::json!(OUTCOME_SUCCESS), None).events.is_empty());
        }
        let input = "*** Begin Patch\n*** Update File: src/ok.rs\n@@\n unchanged\n*** End Patch";
        assert!(parse_outcome_fixture(
            "apply_patch",
            input,
            serde_json::json!("Success. Updated the following files:\nM src/ok.rs\n"),
            None
        )
        .events
        .is_empty());
    }

    #[test]
    fn successful_bodyless_delete_preserves_unavailable_deleted_lines() {
        let input = "*** Begin Patch\n*** Delete File: src/ok.rs\n*** End Patch";
        let batch = parse_outcome_fixture(
            "apply_patch",
            input,
            serde_json::json!("Success. Updated the following files:\nD src/ok.rs\n"),
            None,
        );
        assert_eq!(batch.events.len(), 1);
        assert_eq!(batch.events[0].change_kind, BrokerChangeKind::Delete);
        assert_eq!(batch.events[0].lines_deleted, None);
    }

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

    fn write_item_completed_fixture_copy(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-item-completed-test-{}-{name}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("rollout-test.jsonl");
        let completed_at_ms = DateTime::parse_from_rfc3339("2026-09-16T12:00:03Z")
            .unwrap()
            .timestamp_millis();
        let records = [
            serde_json::json!({
                "type": "session_meta",
                "timestamp": "2026-09-16T12:00:00Z",
                "payload": {
                    "id": "native-session",
                    "cwd": "/workspace",
                    "model_provider": "openai",
                    "originator": "Codex Desktop"
                }
            }),
            serde_json::json!({
                "type": "turn_context",
                "timestamp": "2026-09-16T12:00:01Z",
                "payload": {
                    "turn_id": "native-turn",
                    "cwd": "/workspace",
                    "model": "gpt-5.6-sol"
                }
            }),
            serde_json::json!({
                "type": "event_msg",
                "timestamp": "2026-09-16T12:00:03Z",
                "payload": {
                    "type": "item_completed",
                    "completed_at_ms": completed_at_ms,
                    "turn_id": "native-turn",
                    "item": {
                        "type": "FileChange",
                        "id": "file-change-completed",
                        "status": "completed",
                        "changes": {
                            "/workspace/new.md": {
                                "type": "create",
                                "content": "one\ntwo\n"
                            },
                            "/workspace/old.md": {
                                "type": "update",
                                "unified_diff": "@@ -1 +1 @@\n-old\n+new\n"
                            },
                            "/workspace/remove.md": {
                                "type": "delete",
                                "content": "gone\n"
                            },
                            "/workspace/old-name.md": {
                                "type": "update",
                                "move_path": "/workspace/new-name.md",
                                "content": "renamed\n"
                            }
                        }
                    }
                }
            }),
            serde_json::json!({
                "type": "event_msg",
                "timestamp": "2026-09-16T12:00:04Z",
                "payload": {
                    "type": "item_completed",
                    "turn_id": "native-turn",
                    "item": {
                        "type": "FileChange",
                        "id": "file-change-failed",
                        "status": "failed",
                        "changes": {
                            "/workspace/should-not-appear.md": {
                                "type": "create",
                                "content": "secret"
                            }
                        }
                    }
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
            context: None,
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
    fn patch_completion_without_turn_reference_does_not_use_latest_model() {
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-missing-turn-{}.jsonl",
            std::process::id()
        ));
        let records = [
            serde_json::json!({
                "timestamp": "2026-09-06T10:00:00Z",
                "type": "session_meta",
                "payload": {"id": "session-a", "cwd": "/workspace", "model_provider": "openai"}
            }),
            serde_json::json!({
                "timestamp": "2026-09-06T10:00:01Z",
                "type": "turn_context",
                "payload": {"turn_id": "turn-a", "cwd": "/workspace", "model": "gpt-5.6-sol"}
            }),
            serde_json::json!({
                "timestamp": "2026-09-06T10:00:02Z",
                "type": "turn_context",
                "payload": {"turn_id": "turn-b", "cwd": "/workspace", "model": "gpt-5.6-luna"}
            }),
            serde_json::json!({
                "timestamp": "2026-09-06T10:00:03Z",
                "type": "event_msg",
                "payload": {
                    "type": "patch_apply_end",
                    "call_id": "call-no-turn",
                    "success": true,
                    "changes": {
                        "/workspace/src/lib.rs": {
                            "unified_diff": "@@ -1 +1 @@\n-old\n+new\n"
                        }
                    }
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

        let batch = CodexParser::new()
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
        let event = &batch.events[0];
        assert_eq!(event.model, None);
        assert_eq!(event.turn_id, None);
        assert_eq!(event.provider.as_deref(), Some("openai"));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn internal_turn_model_marker_is_reported_as_partial_identity() {
        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-internal-model-{}.jsonl",
            std::process::id()
        ));
        let records = [
            serde_json::json!({
                "timestamp": "2026-09-06T10:00:00Z",
                "type": "session_meta",
                "payload": {"id": "marker-session", "cwd": "/workspace", "model_provider": "openai"}
            }),
            serde_json::json!({
                "timestamp": "2026-09-06T10:00:01Z",
                "type": "turn_context",
                "payload": {"turn_id": "marker-turn", "cwd": "/workspace", "model": "<synthetic>"}
            }),
            serde_json::json!({
                "timestamp": "2026-09-06T10:00:02Z",
                "type": "event_msg",
                "payload": {
                    "type": "patch_apply_end",
                    "call_id": "marker-call",
                    "turn_id": "marker-turn",
                    "success": true,
                    "changes": {
                        "/workspace/src/lib.rs": {
                            "unified_diff": "@@ -1 +1 @@\n-old\n+new\n"
                        }
                    }
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

        let batch = CodexParser::new()
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
                    context: None,
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
            context: None,
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
        output["payload"]["output"] = serde_json::json!(
            "Success. Updated the following files:\nD src/replaced.rs\nA src/replaced.rs\n"
        );

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
                    context: None,
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
            context: None,
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
    fn parse_since_reads_native_file_change_operations_and_ignores_failed_items() {
        let path = write_item_completed_fixture_copy("operations");
        let batch = CodexParser::new()
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

        assert_eq!(batch.events.len(), 4);
        assert!(batch
            .events
            .iter()
            .all(|event| event.producer_surface.as_deref() == Some("codex-desktop")));
        let created = batch
            .events
            .iter()
            .find(|event| event.entity.ends_with("new.md"))
            .unwrap();
        assert_eq!(created.change_kind, BrokerChangeKind::Create);
        assert_eq!(created.lines_added, Some(2));
        assert_eq!(created.lines_deleted, Some(0));

        let modified = batch
            .events
            .iter()
            .find(|event| event.entity.ends_with("old.md"))
            .unwrap();
        assert_eq!(modified.change_kind, BrokerChangeKind::Modify);
        assert_eq!(modified.lines_added, Some(1));
        assert_eq!(modified.lines_deleted, Some(1));

        let deleted = batch
            .events
            .iter()
            .find(|event| event.entity.ends_with("remove.md"))
            .unwrap();
        assert_eq!(deleted.change_kind, BrokerChangeKind::Delete);
        assert_eq!(deleted.lines_added, Some(0));
        assert_eq!(deleted.lines_deleted, Some(1));

        let renamed = batch
            .events
            .iter()
            .find(|event| event.entity.ends_with("new-name.md"))
            .unwrap();
        assert_eq!(renamed.change_kind, BrokerChangeKind::Rename);
        assert!(renamed
            .previous_entity
            .as_ref()
            .is_some_and(|entity| entity.ends_with("old-name.md")));
        let completed_at_ms = DateTime::parse_from_rfc3339("2026-09-16T12:00:03Z")
            .unwrap()
            .timestamp_millis();
        assert_eq!(renamed.occurred_at.timestamp_millis(), completed_at_ms);
        assert!(!batch
            .events
            .iter()
            .any(|event| event.entity.ends_with("should-not-appear.md")));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn parse_since_rebuilds_codex_desktop_surface_for_an_old_checkpoint() {
        let path = write_item_completed_fixture_copy("surface-migration");
        let bytes = fs::read(&path).unwrap();
        let third_record_offset = bytes
            .iter()
            .enumerate()
            .filter(|(_, byte)| **byte == b'\n')
            .nth(1)
            .map(|(index, _)| index + 1)
            .unwrap() as u64;
        let batch = CodexParser::new()
            .parse_since(
                &ParseContext::default(),
                Some(&ParserCursor {
                    source_path: path.to_string_lossy().into_owned(),
                    file_identity: None,
                    byte_offset: third_record_offset,
                    last_record_id: None,
                    last_record_time: None,
                    context: Some(ParserContext {
                        session_id: Some("native-session".to_string()),
                        producer_surface: None,
                        producer_surface_seen: false,
                        ..ParserContext::default()
                    }),
                }),
            )
            .unwrap();

        assert_eq!(batch.events.len(), 4);
        assert!(batch
            .events
            .iter()
            .all(|event| event.producer_surface.as_deref() == Some("codex-desktop")));
        assert!(batch
            .next_cursor
            .context
            .as_ref()
            .is_some_and(|context| context.producer_surface_seen));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn parse_since_deduplicates_wrapped_exec_and_native_file_change() {
        let path = write_exec_response_item_fixture_copy("native-duplicate");
        let native = serde_json::json!({
            "type": "event_msg",
            "timestamp": "2026-08-14T09:19:43.000Z",
            "payload": {
                "type": "item_completed",
                "item": {
                    "type": "FileChange",
                    "id": "native-file-change-id",
                    "status": "completed",
                    "changes": {
                        "/home/dev/example-project/src/desktop_wrapper.rs": {
                            "type": "create",
                            "content": "pub fn from_desktop_wrapper() {}\n"
                        }
                    }
                }
            }
        });
        let mut file = fs::OpenOptions::new().append(true).open(&path).unwrap();
        writeln!(file, "{}", native).unwrap();

        let batch = CodexParser::new()
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
        assert!(batch.events[0].entity.ends_with("desktop_wrapper.rs"));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn parse_since_deduplicates_native_file_change_before_wrapped_exec_output() {
        // Current Codex Desktop ordering is: custom_tool_call -> native
        // FileChange completion -> custom_tool_call_output. The native item id
        // and wrapper call id differ, so this exercises the metadata correlation
        // rather than only the in-batch event comparison above.
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let call_id = "call_native_before_output";
        let file_path = "/home/dev/example-project/src/native_before_output.rs";
        let patch_text = format!("*** Begin Patch\n*** Delete File: {file_path}\n*** End Patch");
        let call = serde_json::json!({
            "type": "response_item",
            "timestamp": "2026-08-14T09:19:42.000Z",
            "payload": {
                "type": "custom_tool_call",
                "status": "completed",
                "call_id": call_id,
                "name": "exec",
                "input": format!(
                    "const patch = {}; text(await tools.apply_patch(patch));",
                    serde_json::to_string(&patch_text).unwrap()
                )
            }
        });
        let completed_at_ms = DateTime::parse_from_rfc3339("2026-08-14T09:19:42.100Z")
            .unwrap()
            .timestamp_millis();
        let native = serde_json::json!({
            "type": "event_msg",
            "timestamp": "2026-08-14T09:19:42.100Z",
            "payload": {
                "type": "item_completed",
                "turn_id": "018f0000-bbbb-7000-8000-000000000002",
                "completed_at_ms": completed_at_ms,
                "item": {
                        "type": "FileChange",
                        "id": "native-file-change-before-output",
                        "status": "completed",
                        "changes": {
                            file_path: {
                            "type": "delete",
                            "content": "line one\nline two\n"
                        }
                    }
                }
            }
        });
        let output = serde_json::json!({
            "type": "response_item",
            "timestamp": "2026-08-14T09:19:42.500Z",
            "payload": {
                "type": "custom_tool_call_output",
                "call_id": call_id
            }
        });

        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-native-before-output-{}.jsonl",
            std::process::id()
        ));
        let mut file = fs::File::create(&path).unwrap();
        for value in [
            serde_json::from_str::<serde_json::Value>(&session_meta).unwrap(),
            serde_json::from_str::<serde_json::Value>(&turn_context).unwrap(),
            call,
            native,
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
                    context: None,
                }),
            )
            .unwrap();

        assert_eq!(batch.events.len(), 1);
        assert_eq!(
            batch.events[0].tool_event_id.as_deref(),
            Some("018f0000-bbbb-7000-8000-000000000000:native-file-change-before-output")
        );
        assert_eq!(batch.events[0].lines_added, Some(0));
        assert_eq!(batch.events[0].lines_deleted, Some(2));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn native_file_change_with_the_call_id_releases_the_pending_cursor() {
        // June-July 2026 Codex CLI ordering: apply_patch call -> FileChange completion
        // carrying the *same* id -> custom_tool_call_output. The native record emits the
        // event; the call must stop holding the checkpoint, or every later pass rewinds
        // to it and re-reads the rest of the transcript forever.
        let fixtures = concat!(env!("CARGO_MANIFEST_DIR"), "/src/ai/fixtures/codex/");
        let session_meta = fs::read_to_string(format!("{fixtures}session_meta.json")).unwrap();
        let turn_context = fs::read_to_string(format!("{fixtures}turn_context.json")).unwrap();
        let call_id = "call_native_shares_call_id";
        let file_path = "/home/dev/example-project/src/recreated.rs";
        let call = serde_json::json!({
            "type": "response_item",
            "timestamp": "2026-08-14T09:19:42.000Z",
            "payload": {
                "type": "custom_tool_call",
                "status": "completed",
                "call_id": call_id,
                "name": "apply_patch",
                "input": format!(
                    "*** Begin Patch\n*** Delete File: {file_path}\n*** Add File: {file_path}\n+pub fn recreated() {{}}\n*** End Patch"
                )
            }
        });
        let native = serde_json::json!({
            "type": "event_msg",
            "timestamp": "2026-08-14T09:19:42.100Z",
            "payload": {
                "type": "item_completed",
                "turn_id": "018f0000-bbbb-7000-8000-000000000002",
                "item": {
                    "type": "FileChange",
                    "id": call_id,
                    "status": "completed",
                    "changes": {
                        file_path: {
                            "type": "add",
                            "content": "pub fn recreated() {}\n"
                        }
                    }
                }
            }
        });
        let output = serde_json::json!({
            "type": "response_item",
            "timestamp": "2026-08-14T09:19:42.200Z",
            "payload": {
                "type": "custom_tool_call_output",
                "call_id": call_id,
                "output": format!(
                    "Exit code: 0\nWall time: 0.2 seconds\nOutput:\nSuccess. Updated the following files:\nA {file_path}\nD {file_path}\n"
                )
            }
        });

        let path = std::env::temp_dir().join(format!(
            "wakaclock-core-codex-native-shares-call-id-{}.jsonl",
            std::process::id()
        ));
        let mut file = fs::File::create(&path).unwrap();
        for value in [
            serde_json::from_str::<serde_json::Value>(&session_meta).unwrap(),
            serde_json::from_str::<serde_json::Value>(&turn_context).unwrap(),
            call,
            native,
            output,
        ] {
            writeln!(file, "{}", serde_json::to_string(&value).unwrap()).unwrap();
        }
        let file_len = fs::metadata(&path).unwrap().len();

        let batch = CodexParser::new()
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
        assert!(batch.events[0].entity.ends_with("recreated.rs"));
        assert_eq!(batch.next_cursor.byte_offset, file_len);
        assert!(batch
            .next_cursor
            .context
            .as_ref()
            .is_some_and(|context| context.pending_calls.is_empty()));

        // A checkpoint saved by the buggy parser (offset rewound to the call, the call
        // still listed as pending) must also advance once re-read.
        let stuck = ParserCursor {
            byte_offset: 0,
            ..batch.next_cursor.clone()
        };
        let resumed = CodexParser::new()
            .parse_since(&ParseContext::default(), Some(&stuck))
            .unwrap();
        assert_eq!(resumed.next_cursor.byte_offset, file_len);
        let _ = fs::remove_file(path);
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
                    context: None,
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
                    context: None,
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
                    context: None,
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
                    context: None,
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
            context: None,
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
            context: None,
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
            context: None,
        };
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap();
        assert_eq!(batch.warnings.len(), 1);
        assert!(batch.events.is_empty());
    }
}

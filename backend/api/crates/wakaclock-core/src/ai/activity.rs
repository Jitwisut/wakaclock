//! Codex activity evidence, separate from file mutations. No transcript contents
//! or tool arguments enter the durable v2 envelope or cursor context.
use super::jsonl::JsonlCursorReader;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BrokerActivityEventV2 {
    pub schema_version: u8,
    pub event_id: String,
    pub revision: u32,
    pub session_id: String,
    pub project_root: PathBuf,
    pub kind: ActivityKind,
    pub operation_id: String,
    pub occurred_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub provenance: String,
    pub tool: Option<String>,
    pub status: Option<String>,
    pub producer_surface: String,
    #[serde(default)]
    pub monitoring_only: bool,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ActivityKind {
    TaskStart,
    TaskEnd,
    ToolStart,
    ToolEnd,
    MessageComplete,
}

/// Provider-neutral project activity. v2 remains a nested, unchanged evidence
/// contract; edits and usage retain their existing independent streams.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BrokerActivityEventV3 {
    pub schema_version: u8,
    pub adapter_id: String,
    pub execution_surface: String,
    pub provider_schema_version: String,
    pub activity: BrokerActivityEventV2,
}
impl BrokerActivityEventV3 {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != 3
            || super::AdapterRegistry::builtin()
                .get(&self.adapter_id)
                .is_none()
            || !["cli", "ide", "desktop", "inline", "mcp"]
                .contains(&self.execution_surface.as_str())
            || self.provider_schema_version.is_empty()
            || self.provider_schema_version.len() > 80
            || !self
                .provider_schema_version
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
        {
            return Err("invalid_activity_v3_contract".into());
        }
        self.activity.validate()
    }
    pub fn normalized(&self) -> Result<BrokerActivityEventV2, String> {
        self.validate()?;
        let mut event = self.activity.clone();
        if self.adapter_id != "codex" {
            event.event_id = opaque(&format!(
                "activity-v3\0{}\0{}\0{}\0{:?}",
                self.adapter_id, event.session_id, event.operation_id, event.kind
            ));
            // Identical operation identity permits native to revise a wrapper;
            // no wall-clock proximity, line counts or transcript text are used.
            event.revision =
                event.revision.saturating_mul(2) + u32::from(event.provenance == "native");
        }
        event.validate()?;
        Ok(event)
    }
}

impl BrokerActivityEventV2 {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != 2
            || self.event_id.is_empty()
            || !self.project_root.is_absolute()
            || self.session_id.is_empty()
        {
            return Err("invalid_activity_metadata".into());
        }
        let token = |s: &str, limit: usize| {
            !s.is_empty()
                && s.len() <= limit
                && s.chars()
                    .all(|c| c.is_ascii_alphanumeric() || "_-.:/".contains(c))
        };
        if !token(&self.event_id, 256)
            || !token(&self.operation_id, 256)
            || !token(&self.session_id, 256)
            || !token(&self.producer_surface, 80)
            || !matches!(self.provenance.as_str(), "native" | "wrapper")
            || self.tool.as_deref().is_some_and(|v| !token(v, 160))
            || self.status.as_deref().is_some_and(|v| !token(v, 80))
            || self.revision > 1_000_000
            || self.tool.as_deref().is_some_and(waits_for_user) && self.started_at.is_some()
        {
            return Err("invalid_activity_metadata".into());
        }
        if self.occurred_at > Utc::now() + chrono::Duration::minutes(5)
            || self.started_at.is_some_and(|s| s > self.occurred_at)
        {
            return Err("invalid_activity_timestamp".into());
        }
        if self.started_at.is_some() && self.kind != ActivityKind::ToolEnd {
            return Err("only_tools_carry_measured_intervals".into());
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ActivityCursor {
    #[serde(default)]
    pub capture_since: Option<DateTime<Utc>>,
    #[serde(default)]
    pub capture_until: Option<DateTime<Utc>>,
    pub offset: u64,
    pub file_identity: String,
    pub context: ActivityContext,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ActivityContext {
    session: String,
    root: PathBuf,
    surface: String,
    turn: String,
    native_stream: bool,
    #[serde(default)]
    monitoring_only: bool,
    calls: BTreeMap<String, PendingTool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PendingTool {
    started: DateTime<Utc>,
    completed: Option<DateTime<Utc>>,
    tool: String,
    native_seen: bool,
    fallback_emitted: bool,
}
pub struct ActivityBatch {
    pub events: Vec<BrokerActivityEventV2>,
    pub cursor: ActivityCursor,
    pub records: usize,
    pub contracts: BTreeMap<(String, u32), ActivityContract>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ActivityContract {
    pub adapter_id: String,
    pub execution_surface: String,
    pub provider_schema_version: String,
}
impl BrokerActivityEventV3 {
    pub fn contract(&self) -> ActivityContract {
        ActivityContract {
            adapter_id: self.adapter_id.clone(),
            execution_surface: self.execution_surface.clone(),
            provider_schema_version: self.provider_schema_version.clone(),
        }
    }
}
pub fn opaque(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}
fn instant(value: &Value) -> Option<DateTime<Utc>> {
    value
        .as_str()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|v| v.with_timezone(&Utc))
}
fn millis(value: &Value) -> Option<DateTime<Utc>> {
    value.as_i64().and_then(DateTime::from_timestamp_millis)
}
fn make(
    c: &ActivityContext,
    kind: ActivityKind,
    op: &str,
    at: DateTime<Utc>,
    started: Option<DateTime<Utc>>,
    native: bool,
    tool: Option<String>,
    status_revision: (Option<String>, u32),
) -> Option<BrokerActivityEventV2> {
    let (status, revision) = status_revision;
    if c.session.is_empty() || !c.root.is_absolute() {
        return None;
    }
    let operation_id = opaque(&format!("{}\0{}", c.session, op));
    // Native corrections of a fallback deliberately keep the fallback ID.
    let event_id = opaque(&format!(
        "codex-activity-v2\0{}\0{:?}\0{}",
        c.session, kind, op
    ));
    Some(BrokerActivityEventV2 {
        schema_version: 2,
        event_id,
        revision: (if native { revision + 1 } else { revision })
            + u32::from(tool.as_deref().is_some_and(waits_for_user)),
        session_id: c.session.clone(),
        project_root: c.root.clone(),
        kind,
        operation_id,
        occurred_at: at,
        started_at: if tool.as_deref().is_some_and(waits_for_user) {
            None
        } else {
            started
        },
        provenance: if native { "native" } else { "wrapper" }.into(),
        tool,
        status,
        producer_surface: c.surface.clone(),
        monitoring_only: c.monitoring_only,
    })
}
fn waits_for_user(tool: &str) -> bool {
    let name = tool.rsplit('.').next().unwrap_or(tool).to_ascii_lowercase();
    matches!(
        name.as_str(),
        "request_user_input"
            | "request_user_input_async"
            | "askuserquestion"
            | "ask_user"
            | "ask_user_question"
    )
}
fn emit(events: &mut Vec<BrokerActivityEventV2>, event: Option<BrokerActivityEventV2>) {
    if let Some(e) = event {
        events.push(e);
    }
}
/// Parse only complete records, bounding work per tick. Cursor and events are
/// committed together by ActivityStore; failure leaves the previous offset intact.
pub fn parse_activity(
    path: &Path,
    previous: &ActivityCursor,
    now: DateTime<Utc>,
) -> Result<ActivityBatch, String> {
    let metadata = std::fs::metadata(path).map_err(|_| "transcript_unavailable")?;
    #[cfg(unix)]
    let identity = {
        use std::os::unix::fs::MetadataExt;
        format!("{}:{}", metadata.dev(), metadata.ino())
    };
    #[cfg(not(unix))]
    let identity = format!("{:?}", metadata.created().ok());
    let mut cursor = if previous.file_identity == identity && previous.offset <= metadata.len() {
        previous.clone()
    } else {
        ActivityCursor {
            capture_since: previous.capture_since,
            capture_until: previous.capture_until,
            ..ActivityCursor::default()
        }
    };
    cursor.file_identity = identity;
    let mut reader =
        JsonlCursorReader::open(path, cursor.offset).map_err(|_| "transcript_unavailable")?;
    let mut events = Vec::new();
    let mut records = 0;
    while records < 2000 {
        let Some(line) = reader
            .next_line(4 * 1024 * 1024)
            .map_err(|_| "transcript_read_failed")?
        else {
            break;
        };
        if line.too_large {
            return Err("transcript_record_too_large".into());
        }
        let r: Value = serde_json::from_str(&line.text).map_err(|_| "transcript_invalid_json")?;
        cursor.offset = line.offset_after;
        records += 1;
        let p = &r["payload"];
        let c = &mut cursor.context;
        let Some(at) = instant(&r["timestamp"]) else {
            continue;
        };
        let inspect = cursor.capture_since.is_none_or(|since| at >= since)
            && cursor.capture_until.is_none_or(|until| at < until);
        match r["type"].as_str().unwrap_or("") {
            "session_meta" => {
                c.session = p["session_id"]
                    .as_str()
                    .or(p["id"].as_str())
                    .unwrap_or("")
                    .into();
                if let Some(root) = p["cwd"].as_str() {
                    c.root = PathBuf::from(root);
                }
                c.monitoring_only = p["source"]
                    .as_str()
                    .is_some_and(|v| matches!(v, "automation" | "heartbeat"))
                    || p["thread_source"]
                        .as_str()
                        .is_some_and(|v| matches!(v, "automation" | "heartbeat"));
                c.surface = if p["originator"]
                    .as_str()
                    .is_some_and(|s| s.contains("desktop"))
                {
                    "codex-desktop"
                } else {
                    "codex"
                }
                .into();
            }
            "turn_context" => {
                c.turn = p["turn_id"].as_str().unwrap_or("").into();
                if let Some(root) = p["cwd"].as_str() {
                    c.root = PathBuf::from(root);
                }
            }
            "event_msg" => match p["type"].as_str().unwrap_or("") {
                "task_started" | "task_complete" => {
                    let start = p["type"] == "task_started";
                    let op = p["turn_id"].as_str().unwrap_or(&c.turn);
                    emit(
                        &mut events,
                        make(
                            c,
                            if start {
                                ActivityKind::TaskStart
                            } else {
                                ActivityKind::TaskEnd
                            },
                            op,
                            at,
                            None,
                            true,
                            None,
                            (None, 1),
                        ),
                    );
                }
                "item_completed" => {
                    c.native_stream = true;
                    let item = &p["item"];
                    let typ = item["type"].as_str().unwrap_or("");
                    // Unknown native variants must not silently look like a complete scan.
                    // Returning an opaque code leaves this batch's durable cursor unchanged.
                    if inspect
                        && !matches!(
                            typ,
                            "CommandExecution"
                                | "McpToolCall"
                                | "Extension"
                                | "ImageView"
                                | "AgentMessage"
                                | "FileChange"
                                | "UserMessage"
                                | "Reasoning"
                                | "ContextCompaction"
                                | "Plan"
                        )
                    {
                        return Err("unsupported_native_item".into());
                    }
                    if inspect
                        && matches!(
                            typ,
                            "CommandExecution"
                                | "McpToolCall"
                                | "Extension"
                                | "ImageView"
                                | "AgentMessage"
                        )
                        && item["id"].as_str().is_none_or(str::is_empty)
                    {
                        return Err("activity_operation_id_missing".into());
                    }
                    let end = millis(&p["completed_at_ms"]).unwrap_or(at);
                    let start = millis(&p["started_at_ms"]);
                    if matches!(
                        typ,
                        "CommandExecution"
                            | "McpToolCall"
                            | "FileChange"
                            | "Extension"
                            | "ImageView"
                    ) {
                        // Matching operation IDs permit a native correction. Generic
                        // outer wrappers remain markers once a native stream is
                        // known; timestamp overlap alone is not identity proof.
                        let mut corrections = Vec::new();
                        for (id, call) in &mut c.calls {
                            if (item["id"].as_str() == Some(id.as_str())
                                || (call.fallback_emitted
                                    && matches!(
                                        call.tool.as_str(),
                                        "exec"
                                            | "functions.exec"
                                            | "code_mode_exec"
                                            | "unified_exec"
                                            | "apply_patch"
                                    )))
                                && call.started <= end
                                && call.completed.is_none_or(|v| start.unwrap_or(end) <= v)
                                && start.unwrap_or(end) >= call.started
                            {
                                call.native_seen = true;
                                if call.fallback_emitted {
                                    call.fallback_emitted = false;
                                    corrections.push((
                                        id.clone(),
                                        call.completed.unwrap_or(end),
                                        call.tool.clone(),
                                    ));
                                }
                            }
                        }
                        for (id, end, tool) in corrections {
                            emit(
                                &mut events,
                                make(
                                    c,
                                    ActivityKind::ToolEnd,
                                    &id,
                                    end,
                                    None,
                                    true,
                                    Some(tool),
                                    (Some("native_children".into()), 2),
                                ),
                            );
                        }
                    }
                    let op = item["id"].as_str();
                    if let Some(op) = op {
                        if matches!(
                            typ,
                            "CommandExecution" | "McpToolCall" | "Extension" | "ImageView"
                        ) {
                            let tool = Some(
                                match typ {
                                    "CommandExecution" => "exec_command",
                                    "McpToolCall" => item["tool"]
                                        .as_str()
                                        .filter(|v| {
                                            v.len() <= 128
                                                && v.chars().all(|ch| {
                                                    ch.is_ascii_alphanumeric() || "_.-".contains(ch)
                                                })
                                        })
                                        .unwrap_or("mcp"),
                                    "ImageView" => "view_image",
                                    _ => "extension",
                                }
                                .into(),
                            );
                            if let Some(start) = start.filter(|s| *s <= end) {
                                emit(
                                    &mut events,
                                    make(
                                        c,
                                        ActivityKind::ToolStart,
                                        op,
                                        start,
                                        None,
                                        true,
                                        tool.clone(),
                                        (None, 1),
                                    ),
                                );
                            }
                            let status = item["status"]
                                .as_str()
                                .filter(|v| matches!(*v, "completed" | "failed" | "interrupted"))
                                .map(str::to_owned);
                            emit(
                                &mut events,
                                make(
                                    c,
                                    ActivityKind::ToolEnd,
                                    op,
                                    end,
                                    start.filter(|s| *s <= end),
                                    true,
                                    tool,
                                    (status, 1),
                                ),
                            );
                        } else if typ == "AgentMessage" {
                            emit(
                                &mut events,
                                make(
                                    c,
                                    ActivityKind::MessageComplete,
                                    op,
                                    end,
                                    None,
                                    true,
                                    None,
                                    (None, 1),
                                ),
                            );
                        }
                    }
                }
                _ => {}
            },
            "response_item" => match p["type"].as_str().unwrap_or("") {
                "function_call" | "custom_tool_call" => {
                    if inspect
                        && (p["call_id"].as_str().is_none_or(str::is_empty)
                            || p["name"].as_str().is_none_or(str::is_empty))
                    {
                        return Err("activity_tool_metadata_missing".into());
                    }
                    if let (Some(id), Some(tool)) = (p["call_id"].as_str(), p["name"].as_str()) {
                        // Whitelist tool identifiers, never serialize arguments/input.
                        let tool = if tool.len() <= 128
                            && tool
                                .chars()
                                .all(|ch| ch.is_ascii_alphanumeric() || "_.-".contains(ch))
                        {
                            tool.to_owned()
                        } else {
                            "tool".into()
                        };
                        c.calls.insert(
                            id.into(),
                            PendingTool {
                                started: at,
                                completed: None,
                                tool: tool.clone(),
                                native_seen: false,
                                fallback_emitted: false,
                            },
                        );
                        emit(
                            &mut events,
                            make(
                                c,
                                ActivityKind::ToolStart,
                                id,
                                at,
                                None,
                                false,
                                Some(tool),
                                (None, 1),
                            ),
                        );
                    }
                }
                "function_call_output" | "custom_tool_call_output" => {
                    if inspect && p["call_id"].as_str().is_none_or(str::is_empty) {
                        return Err("activity_operation_id_missing".into());
                    }
                    if let Some(id) = p["call_id"].as_str() {
                        if let Some(call) = c.calls.get_mut(id) {
                            call.completed = Some(at);
                        }
                    }
                }
                "message" if !c.native_stream && p["role"] == "assistant" => {
                    let op = p["id"]
                        .as_str()
                        .map(str::to_owned)
                        .unwrap_or_else(|| format!("message:{}", at.timestamp_micros()));
                    emit(
                        &mut events,
                        make(
                            c,
                            ActivityKind::MessageComplete,
                            &op,
                            at,
                            None,
                            false,
                            None,
                            (None, 1),
                        ),
                    );
                }
                typ if inspect
                    && (typ.contains("tool")
                        || typ.ends_with("_call")
                        || typ.ends_with("_call_output")) =>
                {
                    return Err("unsupported_tool_record".into());
                }
                _ => {}
            },
            _ => {}
        }
    }
    // Allow native records to arrive in the next append before using a wrapper.
    let c = &mut cursor.context;
    let mut fallback = Vec::new();
    for (id, call) in &mut c.calls {
        if let Some(end) = call.completed {
            if records < 2000
                && !call.fallback_emitted
                && now - end >= chrono::Duration::seconds(30)
                && end >= call.started
            {
                call.fallback_emitted = true;
                fallback.push((
                    id.clone(),
                    if call.native_seen
                        || (c.native_stream
                            && matches!(
                                call.tool.as_str(),
                                "exec"
                                    | "functions.exec"
                                    | "code_mode_exec"
                                    | "unified_exec"
                                    | "apply_patch"
                            ))
                    {
                        None
                    } else {
                        Some(call.started)
                    },
                    end,
                    call.tool.clone(),
                ));
            }
        }
    }
    for (id, start, end, tool) in fallback {
        emit(
            &mut events,
            make(
                c,
                ActivityKind::ToolEnd,
                &id,
                end,
                start,
                false,
                Some(tool),
                (None, 1),
            ),
        );
    }
    if records < 2000 {
        c.calls
            .retain(|_, v| v.completed.is_none() || now - v.started < chrono::Duration::hours(6));
    }
    if c.calls.len() > 2000 {
        return Err("too_many_pending_tools".into());
    }
    for e in &events {
        e.validate()?;
    }
    Ok(ActivityBatch {
        events,
        cursor,
        records,
        contracts: BTreeMap::new(),
    })
}

/// Common incremental reader. Only metadata survives normalization. An unknown
/// schema leaves the cursor immediately before that record while accepted earlier
/// records can commit; other sources continue independently.
pub fn parse_shared_activity(
    adapter: &str,
    surface: &str,
    metadata_contract: bool,
    path: &Path,
    previous: &ActivityCursor,
    now: DateTime<Utc>,
) -> Result<(ActivityBatch, Option<String>), String> {
    if adapter == "codex" && !metadata_contract {
        return parse_activity(path, previous, now).map(|batch| (batch, None));
    }
    if super::AdapterRegistry::builtin().get(adapter).is_none() {
        return Err("unknown_activity_adapter".into());
    }
    let metadata = std::fs::metadata(path).map_err(|_| "transcript_unavailable")?;
    #[cfg(unix)]
    let identity = {
        use std::os::unix::fs::MetadataExt;
        format!("{}:{}", metadata.dev(), metadata.ino())
    };
    #[cfg(not(unix))]
    let identity = format!("{:?}", metadata.created().ok());
    let mut cursor = if previous.file_identity == identity && previous.offset <= metadata.len() {
        previous.clone()
    } else {
        ActivityCursor {
            capture_since: previous.capture_since,
            capture_until: previous.capture_until,
            ..Default::default()
        }
    };
    cursor.file_identity = identity;
    let mut reader =
        JsonlCursorReader::open(path, cursor.offset).map_err(|_| "transcript_unavailable")?;
    let mut events = Vec::new();
    let mut records = 0;
    let mut blocked = None;
    let mut contracts = BTreeMap::new();
    while records < 2000 {
        let Some(line) = reader
            .next_line(2 * 1024 * 1024)
            .map_err(|_| "transcript_read_failure")?
        else {
            break;
        };
        let parsed = if line.too_large {
            Err("activity_record_too_large".to_string())
        } else {
            serde_json::from_str::<Value>(&line.text)
                .map_err(|_| "activity_invalid_json".to_string())
                .and_then(|record| {
                    if metadata_contract {
                        let envelope: BrokerActivityEventV3 = serde_json::from_value(record)
                            .map_err(|_| "activity_unknown_schema".to_string())?;
                        if envelope.adapter_id != adapter || envelope.execution_surface != surface {
                            return Err("activity_source_scope_mismatch".into());
                        }
                        let event = envelope.normalized()?;
                        contracts.insert(
                            (event.event_id.clone(), event.revision),
                            envelope.contract(),
                        );
                        Ok(vec![event])
                    } else if adapter == "claude-code" {
                        claude_activity_record(&record, &mut cursor.context, surface)
                    } else {
                        Err("activity_native_schema_pending".into())
                    }
                })
        };
        match parsed {
            Ok(mut accepted) => {
                if adapter == "claude-code" && !metadata_contract {
                    for event in &accepted {
                        contracts.insert(
                            (event.event_id.clone(), event.revision),
                            ActivityContract {
                                adapter_id: adapter.into(),
                                execution_surface: surface.into(),
                                provider_schema_version: "claude-transcript-v1".into(),
                            },
                        );
                    }
                }
                events.append(&mut accepted);
                cursor.offset = line.offset_after;
                records += 1;
            }
            Err(error) => {
                cursor.offset = line.offset_before;
                blocked = Some(error);
                break;
            }
        }
    }
    events.retain(|event| {
        cursor
            .capture_since
            .is_none_or(|start| event.occurred_at >= start)
            && cursor
                .capture_until
                .is_none_or(|end| event.occurred_at < end)
    });
    Ok((
        ActivityBatch {
            events,
            cursor,
            records,
            contracts,
        },
        blocked,
    ))
}
fn claude_activity_record(
    record: &Value,
    context: &mut ActivityContext,
    surface: &str,
) -> Result<Vec<BrokerActivityEventV2>, String> {
    let kind = record["type"].as_str().ok_or("activity_unknown_schema")?;
    if ![
        "assistant",
        "user",
        "system",
        "summary",
        "progress",
        "file-history-snapshot",
        "queue-operation",
        "last-prompt",
        "custom-title",
        "agent-name",
    ]
    .contains(&kind)
    {
        return Err("activity_unknown_schema".into());
    }
    if !["assistant", "user"].contains(&kind) {
        return Ok(vec![]);
    }
    // Session and cwd are historical metadata on the record, never inferred from
    // today's branch or a document reopened after a crash.
    if let Some(session) = record["sessionId"].as_str() {
        context.session = session.to_string();
    }
    if let Some(root) = record["cwd"].as_str() {
        context.root = PathBuf::from(root);
    }
    context.surface = surface.into();
    let blocks = record["message"]["content"].as_array();
    let relevant = blocks.is_some_and(|blocks| {
        blocks
            .iter()
            .any(|b| matches!(b["type"].as_str(), Some("tool_use" | "tool_result")))
    }) || record["message"]["stop_reason"] == "end_turn";
    if !relevant {
        return Ok(vec![]);
    }
    let at = instant(&record["timestamp"]).ok_or("activity_timestamp_missing")?;
    if context.session.is_empty() || !context.root.is_absolute() {
        return Err("activity_session_context_missing".into());
    }
    let mut events = Vec::new();
    if let Some(blocks) = blocks {
        for block in blocks {
            let (event_kind, operation) = match block["type"].as_str() {
                Some("tool_use") => (ActivityKind::ToolStart, block["id"].as_str()),
                Some("tool_result") => (ActivityKind::ToolEnd, block["tool_use_id"].as_str()),
                _ => continue,
            };
            let operation = operation.ok_or("activity_operation_identity_missing")?;
            let outcome = if block["is_error"] == true {
                Some("failed".into())
            } else {
                None
            };
            // Transcript timestamps prove markers, not execution-only intervals:
            // permission waits and scheduling may lie between these records.
            let mut event = make(
                context,
                event_kind,
                operation,
                at,
                None,
                true,
                None,
                (outcome, 0),
            )
            .ok_or("activity_invalid_metadata")?;
            event.revision = 0;
            events.push(
                BrokerActivityEventV3 {
                    schema_version: 3,
                    adapter_id: "claude-code".into(),
                    execution_surface: surface.into(),
                    provider_schema_version: "claude-transcript-v1".into(),
                    activity: event,
                }
                .normalized()?,
            );
        }
    }
    if record["message"]["stop_reason"] == "end_turn" {
        let operation = record["message"]["id"]
            .as_str()
            .ok_or("activity_message_identity_missing")?;
        let mut event = make(
            context,
            ActivityKind::MessageComplete,
            operation,
            at,
            None,
            true,
            None,
            (None, 0),
        )
        .ok_or("activity_invalid_metadata")?;
        event.revision = 0;
        events.push(
            BrokerActivityEventV3 {
                schema_version: 3,
                adapter_id: "claude-code".into(),
                execution_surface: surface.into(),
                provider_schema_version: "claude-transcript-v1".into(),
                activity: event,
            }
            .normalized()?,
        );
    }
    Ok(events)
}

#[cfg(test)]
mod shared_tests {
    use super::*;
    #[test]
    fn claude_native_and_transcript_share_usage_identity_and_ordered_revisions() {
        let root = std::env::temp_dir();
        let at = Utc::now() - chrono::Duration::seconds(10);
        let record = serde_json::json!({"type":"assistant","sessionId":"native-session","cwd":root,"timestamp":at,"message":{"content":[{"type":"tool_use","id":"call","name":"Read","input":{"source":"SENSITIVE"}}]}});
        let transcript = claude_activity_record(&record, &mut ActivityContext::default(), "cli")
            .unwrap()
            .remove(0);
        let hook=super::super::native_activity::normalize_hook("claude-code","cli",&serde_json::json!({"hook_event_name":"PreToolUse","session_id":"native-session","cwd":root,"tool_use_id":"call"}),Utc::now(),"observation").unwrap().event.unwrap().normalized().unwrap();
        assert_eq!(transcript.event_id, hook.event_id);
        assert!(transcript.revision < hook.revision);
        assert_eq!(transcript.session_id, "native-session");
        assert_eq!(
            super::super::usage::scoped_session_id("device", "claude-code", &hook.session_id),
            super::super::usage::scoped_session_id("device", "claude-code", "native-session")
        );
        assert!(hook.started_at.is_none());
        assert!(transcript.started_at.is_none());
    }
    #[test]
    fn contract_and_cursor_commit_together_and_survive_verified_key_rotation() {
        let root = std::env::temp_dir().join(format!("capture-rebind-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let queue = crate::queue::Queue::open_at(&root.join("queue.db")).unwrap();
        let old = crate::queue::QueueScope {
            destination: "https://fixture.test".into(),
            owner: "old".into(),
        };
        let current = crate::queue::QueueScope {
            owner: "current".into(),
            ..old.clone()
        };
        let envelope=super::super::native_activity::normalize_hook("kilo-code","ide",&serde_json::json!({"hook_event_name":"tool.execute.before","sessionID":"session","callID":"call","directory":root,"timestamp":Utc::now()}),Utc::now(),"observation").unwrap().event.unwrap();
        let source = root.join("metadata.jsonl");
        std::fs::write(
            &source,
            format!("{}\n", serde_json::to_string(&envelope).unwrap()),
        )
        .unwrap();
        let (batch, error) = parse_shared_activity(
            "kilo-code",
            "ide",
            true,
            &source,
            &ActivityCursor::default(),
            Utc::now(),
        )
        .unwrap();
        assert_eq!(error, None);
        let event = &batch.events[0];
        let store = ActivityStore::open(&root.join("capture.db")).unwrap();
        let old_scope = crate::editor_health::scope_id(&old);
        let new_scope = crate::editor_health::scope_id(&current);
        store
            .commit_for_adapter(&old_scope, "source", &batch, "kilo-code", "ide")
            .unwrap();
        store.rebind_verified_scopes(&queue, &current).unwrap();
        assert_eq!(store.pending_count(&old_scope).unwrap(), 1);
        assert_eq!(store.pending_count(&new_scope).unwrap(), 0);
        queue.record_credential_owner(&old, "account").unwrap();
        queue.record_credential_owner(&current, "account").unwrap();
        store.rebind_verified_scopes(&queue, &current).unwrap();
        assert_eq!(store.pending_count(&old_scope).unwrap(), 0);
        assert_eq!(store.pending(&new_scope).unwrap()[0], *event);
        assert_eq!(
            store.cursor(&new_scope, "source").unwrap().offset,
            batch.cursor.offset
        );
        assert_eq!(
            store
                .contract_for(&new_scope, &event.event_id, event.revision)
                .unwrap(),
            Some(envelope.contract())
        );
        assert_eq!(
            store
                .wire_revision(&new_scope, &event.event_id, event.revision)
                .unwrap(),
            0
        );
        // A conflicting schema at the same evidence revision rolls back the
        // cursor and keeps the original accepted metadata.
        let mut conflicting = batch;
        conflicting.cursor.offset += 1;
        conflicting
            .contracts
            .values_mut()
            .next()
            .unwrap()
            .provider_schema_version = "incompatible-revision".into();
        assert!(store
            .commit_for_adapter(&new_scope, "source", &conflicting, "kilo-code", "ide")
            .is_err());
        assert_eq!(
            store.cursor(&new_scope, "source").unwrap().offset,
            conflicting.cursor.offset - 1
        );
        drop(store);
        drop(queue);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn claude_non_edit_activity_preserves_markers_without_inventing_intervals_or_contents() {
        let path =
            std::env::temp_dir().join(format!("claude-activity-{}.jsonl", uuid::Uuid::new_v4()));
        let at = Utc::now() - chrono::Duration::minutes(1);
        let records = [
            serde_json::json!({"type":"assistant","sessionId":"session","cwd":std::env::temp_dir(),"timestamp":at,"message":{"content":[{"type":"tool_use","id":"call","name":"Bash","input":{"command":"SENSITIVE_COMMAND"}}]}}),
            serde_json::json!({"type":"user","sessionId":"session","cwd":std::env::temp_dir(),"timestamp":at+chrono::Duration::seconds(10),"message":{"content":[{"type":"tool_result","tool_use_id":"call","is_error":true,"content":"SENSITIVE_RESPONSE"}]}}),
        ];
        std::fs::write(
            &path,
            records.iter().map(|r| format!("{r}\n")).collect::<String>(),
        )
        .unwrap();
        let (batch, error) = parse_shared_activity(
            "claude-code",
            "cli",
            false,
            &path,
            &ActivityCursor::default(),
            Utc::now(),
        )
        .unwrap();
        assert_eq!(error, None);
        assert_eq!(batch.events.len(), 2);
        assert!(batch.events.iter().all(|e| e.started_at.is_none()));
        assert_eq!(batch.events[0].operation_id, batch.events[1].operation_id);
        assert_eq!(batch.events[1].status.as_deref(), Some("failed"));
        let metadata = serde_json::to_string(&batch.cursor).unwrap()
            + &serde_json::to_string(&batch.events).unwrap();
        assert!(!metadata.contains("SENSITIVE"));
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn unknown_schema_commits_good_prefix_but_never_advances_over_the_problem() {
        let path =
            std::env::temp_dir().join(format!("activity-schema-{}.jsonl", uuid::Uuid::new_v4()));
        let good = "{\"type\":\"system\"}\n";
        std::fs::write(&path, format!("{good}{{\"type\":\"new-schema\"}}\n")).unwrap();
        let (batch, error) = parse_shared_activity(
            "claude-code",
            "cli",
            false,
            &path,
            &ActivityCursor::default(),
            Utc::now(),
        )
        .unwrap();
        assert_eq!(batch.records, 1);
        assert_eq!(batch.cursor.offset, good.len() as u64);
        assert_eq!(error.as_deref(), Some("activity_unknown_schema"));
        let (again, error) = parse_shared_activity(
            "claude-code",
            "cli",
            false,
            &path,
            &batch.cursor,
            Utc::now(),
        )
        .unwrap();
        assert_eq!(again.cursor.offset, batch.cursor.offset);
        assert!(error.is_some());
        std::fs::remove_file(path).unwrap();
    }
}

pub struct ActivityStore {
    conn: Connection,
}
impl ActivityStore {
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        conn.busy_timeout(std::time::Duration::from_secs(2))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS activity_adapter(scope TEXT,event_id TEXT,adapter TEXT NOT NULL,surface TEXT NOT NULL,PRIMARY KEY(scope,event_id));
        CREATE TABLE IF NOT EXISTS activity_contract(scope TEXT,event_id TEXT,revision INTEGER,metadata TEXT NOT NULL,PRIMARY KEY(scope,event_id,revision));
        CREATE TABLE IF NOT EXISTS activity_cursor(scope TEXT, source TEXT, cursor TEXT NOT NULL, PRIMARY KEY(scope,source));
        CREATE TABLE IF NOT EXISTS activity_inbox_v2(scope TEXT,event_id TEXT,revision INTEGER,wire_revision INTEGER NOT NULL,payload TEXT NOT NULL,handed_off INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(scope,event_id,revision));")?;
        Ok(Self { conn })
    }
    /// Proof comes from the existing queue's verified account/origin ledger.
    /// Preserve payloads, wire revisions and cursor context exactly; ambiguous
    /// overlapping histories stay parked rather than silently selecting one.
    pub fn rebind_verified_scopes(
        &self,
        queue: &crate::queue::Queue,
        current: &crate::queue::QueueScope,
    ) -> Result<(), crate::error::AppError> {
        let aliases = queue.verified_editor_journal_scopes(current)?;
        let current = crate::editor_health::scope_id(current);
        let tx = self
            .conn
            .unchecked_transaction()
            .map_err(crate::error::AppError::Queue)?;
        let merge = || -> Result<(), rusqlite::Error> {
            for alias in aliases {
                let old = crate::editor_health::scope_id(&alias);
                for (table, key, comparison) in [
                    (
                        "activity_inbox_v2",
                        "a.event_id=b.event_id AND a.revision=b.revision",
                        "a.payload!=b.payload OR a.wire_revision!=b.wire_revision",
                    ),
                    (
                        "activity_contract",
                        "a.event_id=b.event_id AND a.revision=b.revision",
                        "a.metadata!=b.metadata",
                    ),
                    (
                        "activity_adapter",
                        "a.event_id=b.event_id",
                        "a.adapter!=b.adapter OR a.surface!=b.surface",
                    ),
                    ("activity_cursor", "a.source=b.source", "a.cursor!=b.cursor"),
                ] {
                    let conflicts:u64=tx.query_row(&format!("SELECT count(*) FROM {table} a JOIN {table} b ON {key} WHERE a.scope=?1 AND b.scope=?2 AND ({comparison})"),params![old,current],|row|row.get(0))?;
                    if conflicts > 0 {
                        return Err(rusqlite::Error::InvalidParameterName(
                            "capture_scope_rebind_conflict".into(),
                        ));
                    }
                }
                tx.execute("INSERT OR IGNORE INTO activity_inbox_v2 SELECT ?2,event_id,revision,wire_revision,payload,handed_off FROM activity_inbox_v2 WHERE scope=?1",params![old,current])?;
                // A proven already completed handoff wins over a pending copy.
                tx.execute("UPDATE activity_inbox_v2 AS current SET handed_off=1 WHERE scope=?2 AND EXISTS(SELECT 1 FROM activity_inbox_v2 old WHERE old.scope=?1 AND old.event_id=current.event_id AND old.revision=current.revision AND old.handed_off=1)",params![old,current])?;
                tx.execute("INSERT OR IGNORE INTO activity_contract SELECT ?2,event_id,revision,metadata FROM activity_contract WHERE scope=?1",params![old,current])?;
                tx.execute("INSERT OR IGNORE INTO activity_adapter SELECT ?2,event_id,adapter,surface FROM activity_adapter WHERE scope=?1",params![old,current])?;
                tx.execute("INSERT OR IGNORE INTO activity_cursor SELECT ?2,source,cursor FROM activity_cursor WHERE scope=?1",params![old,current])?;
                for table in [
                    "activity_inbox_v2",
                    "activity_contract",
                    "activity_adapter",
                    "activity_cursor",
                ] {
                    tx.execute(&format!("DELETE FROM {table} WHERE scope=?1"), [&old])?;
                }
            }
            Ok(())
        };
        merge().map_err(crate::error::AppError::Queue)?;
        tx.commit().map_err(crate::error::AppError::Queue)
    }
    pub fn cursor(&self, scope: &str, source: &str) -> Result<ActivityCursor, rusqlite::Error> {
        let raw: Option<String> = self
            .conn
            .query_row(
                "SELECT cursor FROM activity_cursor WHERE scope=?1 AND source=?2",
                params![scope, source],
                |r| r.get(0),
            )
            .optional()?;
        raw.map(|s| {
            serde_json::from_str(&s)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
        })
        .transpose()
        .map(|v| v.unwrap_or_default())
    }
    pub fn commit(
        &self,
        scope: &str,
        source: &str,
        batch: &ActivityBatch,
    ) -> Result<(), rusqlite::Error> {
        self.commit_for_adapter(scope, source, batch, "codex", "cli")
    }
    pub fn commit_for_adapter(
        &self,
        scope: &str,
        source: &str,
        batch: &ActivityBatch,
        adapter: &str,
        surface: &str,
    ) -> Result<(), rusqlite::Error> {
        let tx = self.conn.unchecked_transaction()?;
        for e in &batch.events {
            let prior: Option<String> = tx
                .query_row(
                    "SELECT adapter FROM activity_adapter WHERE scope=?1 AND event_id=?2",
                    params![scope, e.event_id],
                    |r| r.get(0),
                )
                .optional()?;
            if prior.as_deref().is_some_and(|v| v != adapter) {
                return Err(rusqlite::Error::InvalidParameterName(
                    "activity_adapter_conflict".into(),
                ));
            }
            tx.execute(
                "INSERT OR IGNORE INTO activity_adapter VALUES(?1,?2,?3,?4)",
                params![scope, e.event_id, adapter, surface],
            )?;
            if let Some(contract) = batch.contracts.get(&(e.event_id.clone(), e.revision)) {
                if contract.adapter_id != adapter || contract.execution_surface != surface {
                    return Err(rusqlite::Error::InvalidParameterName(
                        "activity_contract_scope_conflict".into(),
                    ));
                }
                let metadata = serde_json::to_string(contract)
                    .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
                let previous:Option<String>=tx.query_row("SELECT metadata FROM activity_contract WHERE scope=?1 AND event_id=?2 AND revision=?3",params![scope,e.event_id,e.revision],|row|row.get(0)).optional()?;
                if previous.is_some_and(|previous| previous != metadata) {
                    return Err(rusqlite::Error::InvalidParameterName(
                        "activity_contract_revision_conflict".into(),
                    ));
                }
                tx.execute(
                    "INSERT OR IGNORE INTO activity_contract VALUES(?1,?2,?3,?4)",
                    params![scope, e.event_id, e.revision, metadata],
                )?;
            }
            let raw = serde_json::to_string(e)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            let existing: Option<String> = tx.query_row(
                "SELECT payload FROM activity_inbox_v2 WHERE scope=?1 AND event_id=?2 AND revision=?3",
                params![scope, e.event_id, e.revision],
                |r| r.get(0),
            ).optional()?;
            if existing.as_ref().is_some_and(|v| v != &raw) {
                return Err(rusqlite::Error::InvalidParameterName(
                    "activity_revision_conflict".into(),
                ));
            }
            // Evidence revisions order native over wrapper; transport revisions
            // are dense from zero and preserve every accepted correction. Keeping
            // each version prevents a crash during handoff from replacing a base.
            let latest: Option<u32> = tx.query_row(
                "SELECT max(revision) FROM activity_inbox_v2 WHERE scope=?1 AND event_id=?2",
                params![scope, e.event_id],
                |r| r.get(0),
            )?;
            if latest.is_none_or(|v| e.revision > v) {
                let wire: u32 = tx.query_row(
                    "SELECT count(*) FROM activity_inbox_v2 WHERE scope=?1 AND event_id=?2",
                    params![scope, e.event_id],
                    |r| r.get(0),
                )?;
                tx.execute("INSERT INTO activity_inbox_v2(scope,event_id,revision,wire_revision,payload) VALUES(?1,?2,?3,?4,?5)",params![scope,e.event_id,e.revision,wire,raw])?;
            }
        }
        let raw = serde_json::to_string(&batch.cursor)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        tx.execute("INSERT INTO activity_cursor VALUES(?1,?2,?3) ON CONFLICT(scope,source) DO UPDATE SET cursor=excluded.cursor",params![scope,source,raw])?;
        tx.commit()
    }
    pub fn adapter_for(&self, scope: &str, id: &str) -> Result<String, rusqlite::Error> {
        Ok(self
            .conn
            .query_row(
                "SELECT adapter FROM activity_adapter WHERE scope=?1 AND event_id=?2",
                params![scope, id],
                |r| r.get(0),
            )
            .optional()?
            .unwrap_or_else(|| "codex".into()))
    }
    pub fn contract_for(
        &self,
        scope: &str,
        id: &str,
        revision: u32,
    ) -> Result<Option<ActivityContract>, rusqlite::Error> {
        let raw:Option<String>=self.conn.query_row("SELECT metadata FROM activity_contract WHERE scope=?1 AND event_id=?2 AND revision=?3",params![scope,id,revision],|row|row.get(0)).optional()?;
        raw.map(|raw| {
            serde_json::from_str(&raw)
                .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
        })
        .transpose()
    }
    pub fn pending(&self, scope: &str) -> Result<Vec<BrokerActivityEventV2>, rusqlite::Error> {
        let mut q=self.conn.prepare("SELECT payload FROM activity_inbox_v2 WHERE scope=?1 AND handed_off=0 ORDER BY event_id,wire_revision LIMIT 500")?;
        let result = q
            .query_map([scope], |r| r.get::<_, String>(0))?
            .map(|r| {
                r.and_then(|s| {
                    serde_json::from_str(&s)
                        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
                })
            })
            .collect();
        result
    }
    pub fn evidence_revision(&self, scope: &str, id: &str) -> Result<Option<u32>, rusqlite::Error> {
        self.conn.query_row(
            "SELECT max(revision) FROM activity_inbox_v2 WHERE scope=?1 AND event_id=?2",
            params![scope, id],
            |r| r.get(0),
        )
    }
    pub fn evidence_at_revision(
        &self,
        scope: &str,
        id: &str,
        revision: u32,
    ) -> Result<Option<BrokerActivityEventV2>, rusqlite::Error> {
        let raw:Option<String>=self.conn.query_row("SELECT payload FROM activity_inbox_v2 WHERE scope=?1 AND event_id=?2 AND revision=?3",params![scope,id,revision],|row|row.get(0)).optional()?;
        raw.map(|raw| {
            serde_json::from_str(&raw)
                .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
        })
        .transpose()
    }
    pub fn wire_revision(
        &self,
        scope: &str,
        id: &str,
        revision: u32,
    ) -> Result<u32, rusqlite::Error> {
        self.conn.query_row("SELECT wire_revision FROM activity_inbox_v2 WHERE scope=?1 AND event_id=?2 AND revision=?3",params![scope,id,revision],|r|r.get(0))
    }
    pub fn mark_handed_off(
        &self,
        scope: &str,
        id: &str,
        revision: u32,
    ) -> Result<(), rusqlite::Error> {
        self.conn.execute("UPDATE activity_inbox_v2 SET handed_off=1 WHERE scope=?1 AND event_id=?2 AND revision=?3",params![scope,id,revision])?;
        Ok(())
    }
    pub fn pending_count(&self, scope: &str) -> Result<u32, rusqlite::Error> {
        self.conn.query_row(
            "SELECT count(*) FROM activity_inbox_v2 WHERE scope=?1 AND handed_off=0",
            [scope],
            |r| r.get(0),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn file(rows: &[Value]) -> PathBuf {
        let path = std::env::temp_dir().join(format!("activity-{}.jsonl", uuid::Uuid::new_v4()));
        std::fs::write(
            &path,
            rows.iter().map(|r| format!("{r}\n")).collect::<String>(),
        )
        .unwrap();
        path
    }
    fn record(at: &str, kind: &str, payload: Value) -> Value {
        json!({"timestamp":at,"type":kind,"payload":payload})
    }
    fn meta() -> Value {
        record(
            "2026-10-06T17:00:00Z",
            "session_meta",
            json!({"id":"session-one","cwd":"/workspace/wakaclock","originator":"codex-desktop","base_instructions":"SECRET_PROMPT"}),
        )
    }
    fn native(at: &str, id: &str, start: i64, end: i64, typ: &str) -> Value {
        record(
            at,
            "event_msg",
            json!({"type":"item_completed","started_at_ms":start,"completed_at_ms":end,"item":{"type":typ,"id":id,"status":"failed","command":"SECRET_COMMAND","content":"SECRET_RESPONSE"}}),
        )
    }
    #[test]
    fn real_gap_markers_and_tools_do_not_invent_task_or_reasoning_time() {
        let rows = vec![
            meta(),
            record(
                "2026-10-06T18:18:09.005Z",
                "event_msg",
                json!({"type":"task_started","turn_id":"turn-one"}),
            ),
            native(
                "2026-10-06T18:18:50.191Z",
                "read",
                1791307129883,
                1791307130191,
                "CommandExecution",
            ),
            record(
                "2026-10-06T18:19:59.850Z",
                "event_msg",
                json!({"type":"task_complete","turn_id":"turn-one"}),
            ),
            native(
                "2026-10-06T19:56:22.574Z",
                "write",
                1791312982500,
                1791312982574,
                "CommandExecution",
            ),
            native(
                "2026-10-06T19:56:30.674Z",
                "message",
                1791312990000,
                1791312990674,
                "AgentMessage",
            ),
            native(
                "2026-10-06T19:56:31Z",
                "thinking",
                1791312980000,
                1791312991000,
                "Reasoning",
            ),
        ];
        let path = file(&rows);
        let b = parse_activity(&path, &ActivityCursor::default(), Utc::now()).unwrap();
        assert_eq!(
            b.events
                .iter()
                .filter(|e| e.kind == ActivityKind::ToolEnd)
                .count(),
            2
        );
        assert!(b
            .events
            .iter()
            .filter(|e| matches!(
                e.kind,
                ActivityKind::TaskStart | ActivityKind::TaskEnd | ActivityKind::MessageComplete
            ))
            .all(|e| e.started_at.is_none()));
        assert!(!b
            .events
            .iter()
            .any(|e| e.tool.as_deref() == Some("Reasoning")));
        let raw =
            serde_json::to_string(&b.cursor).unwrap() + &serde_json::to_string(&b.events).unwrap();
        assert!(!raw.contains("SECRET"));
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn file_change_and_native_children_suppress_outer_wrapper_measurement() {
        let start = DateTime::parse_from_rfc3339("2026-10-06T17:51:33.220Z")
            .unwrap()
            .timestamp_millis();
        let path = file(&[
            meta(),
            record(
                "2026-10-06T17:51:33.220Z",
                "response_item",
                json!({"type":"custom_tool_call","name":"exec","call_id":"outer","input":"SECRET_PATCH"}),
            ),
            native(
                "2026-10-06T17:51:33.276Z",
                "file-operation",
                start + 9,
                start + 56,
                "FileChange",
            ),
            native(
                "2026-10-06T17:51:39.702Z",
                "child",
                start + 700,
                start + 6482,
                "CommandExecution",
            ),
            record(
                "2026-10-06T17:51:40.140Z",
                "response_item",
                json!({"type":"custom_tool_call_output","call_id":"outer","output":"SECRET_OUTPUT"}),
            ),
        ]);
        let b = parse_activity(&path, &ActivityCursor::default(), Utc::now()).unwrap();
        assert_eq!(
            b.events
                .iter()
                .filter(|e| e.kind == ActivityKind::ToolEnd && e.started_at.is_some())
                .count(),
            1
        );
        assert_eq!(
            b.events
                .iter()
                .find(|e| e.kind == ActivityKind::ToolEnd && e.started_at.is_some())
                .unwrap()
                .tool
                .as_deref(),
            Some("exec_command")
        );
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn wrapper_fallback_is_revised_when_native_arrives_late() {
        use std::io::Write;
        let start = DateTime::parse_from_rfc3339("2026-10-06T18:00:00Z")
            .unwrap()
            .timestamp_millis();
        let path = file(&[
            meta(),
            record(
                "2026-10-06T18:00:00Z",
                "response_item",
                json!({"type":"function_call","call_id":"outer","name":"exec"}),
            ),
            record(
                "2026-10-06T18:00:05Z",
                "response_item",
                json!({"type":"function_call_output","call_id":"outer"}),
            ),
        ]);
        let now = DateTime::parse_from_rfc3339("2026-10-06T18:00:40Z")
            .unwrap()
            .with_timezone(&Utc);
        let b = parse_activity(&path, &ActivityCursor::default(), now).unwrap();
        let fallback = b
            .events
            .iter()
            .find(|e| e.kind == ActivityKind::ToolEnd)
            .unwrap();
        assert!(fallback.started_at.is_some());
        let mut f = std::fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap();
        writeln!(
            f,
            "{}",
            native(
                "2026-10-06T18:00:04Z",
                "child",
                start + 1000,
                start + 4000,
                "CommandExecution"
            )
        )
        .unwrap();
        let b2 = parse_activity(&path, &b.cursor, now).unwrap();
        let correction = b2
            .events
            .iter()
            .find(|e| e.event_id == fallback.event_id)
            .unwrap();
        assert!(correction.started_at.is_none());
        assert!(correction.revision > fallback.revision);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn partial_append_restart_rotation_and_malformed_json_preserve_cursor() {
        use std::io::Write;
        let path = file(&[meta()]);
        let b = parse_activity(&path, &ActivityCursor::default(), Utc::now()).unwrap();
        let mut f = std::fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap();
        write!(f, "{{\"timestamp\":").unwrap();
        let partial = parse_activity(&path, &b.cursor, Utc::now()).unwrap();
        assert_eq!(partial.cursor.offset, b.cursor.offset);
        writeln!(f,"\"2026-10-06T18:00:00Z\",\"type\":\"event_msg\",\"payload\":{{\"type\":\"task_started\",\"turn_id\":\"t\"}}}}").unwrap();
        let next = parse_activity(&path, &partial.cursor, Utc::now()).unwrap();
        assert_eq!(next.events.len(), 1);
        writeln!(f, "invalid json").unwrap();
        assert!(parse_activity(&path, &next.cursor, Utc::now()).is_err());
        drop(f);
        std::fs::remove_file(&path).unwrap();
        std::fs::write(&path, format!("{}\n", meta())).unwrap();
        let rotated = parse_activity(&path, &next.cursor, Utc::now()).unwrap();
        assert_eq!(rotated.records, 1);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn waiting_for_user_is_a_marker_never_measured_time() {
        let start = DateTime::parse_from_rfc3339("2026-10-07T01:00:00Z")
            .unwrap()
            .timestamp_millis();
        let path = file(&[
            meta(),
            record(
                "2026-10-07T01:00:00Z",
                "response_item",
                json!({"type":"function_call","call_id":"ask","name":"request_user_input"}),
            ),
            record(
                "2026-10-07T01:30:00Z",
                "event_msg",
                json!({"type":"item_completed","started_at_ms":start,"completed_at_ms":start+1800000,"item":{"type":"McpToolCall","id":"ask","tool":"request_user_input","status":"completed"}}),
            ),
        ]);
        let b = parse_activity(&path, &ActivityCursor::default(), Utc::now()).unwrap();
        assert!(b.events.iter().all(|e| e.started_at.is_none()));
        assert!(b.events.iter().any(|e| e.kind == ActivityKind::ToolEnd));
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn sqlite_transaction_scope_dedup_and_write_failure_are_recoverable() {
        let path = file(&[
            meta(),
            record(
                "2026-10-06T18:00:00Z",
                "event_msg",
                json!({"type":"task_started","turn_id":"turn"}),
            ),
        ]);
        let b = parse_activity(&path, &ActivityCursor::default(), Utc::now()).unwrap();
        let db = path.with_extension("db");
        let store = ActivityStore::open(&db).unwrap();
        store.commit("account-one", "source", &b).unwrap();
        store.commit("account-one", "source", &b).unwrap();
        assert_eq!(store.pending_count("account-one").unwrap(), 1);
        assert_eq!(store.pending_count("account-two").unwrap(), 0);
        let event = store.pending("account-one").unwrap().pop().unwrap();
        store
            .mark_handed_off("account-one", &event.event_id, event.revision)
            .unwrap();
        store.commit("account-one", "source", &b).unwrap();
        assert_eq!(store.pending_count("account-one").unwrap(), 0);
        store.conn.execute_batch("PRAGMA query_only=ON;").unwrap();
        assert!(store.commit("account-two", "source", &b).is_err());
        assert_eq!(store.cursor("account-two", "source").unwrap().offset, 0);
        drop(store);
        let reopened = ActivityStore::open(&db).unwrap();
        assert_eq!(
            reopened.cursor("account-one", "source").unwrap().offset,
            b.cursor.offset
        );
        drop(reopened);
        std::fs::remove_file(path).unwrap();
        std::fs::remove_file(db).unwrap();
    }
    #[test]
    fn native_same_id_overrides_wrapper_start_and_wire_rejects_contents() {
        let start = DateTime::parse_from_rfc3339("2026-10-06T18:00:00Z")
            .unwrap()
            .timestamp_millis();
        let path = file(&[
            meta(),
            record(
                "2026-10-06T18:00:00Z",
                "response_item",
                json!({"type":"function_call","name":"mcp","call_id":"operation"}),
            ),
            native(
                "2026-10-06T18:00:02Z",
                "operation",
                start + 10,
                start + 2000,
                "McpToolCall",
            ),
        ]);
        let b = parse_activity(&path, &ActivityCursor::default(), Utc::now()).unwrap();
        let db = path.with_extension("db");
        let store = ActivityStore::open(&db).unwrap();
        store.commit("scope", "source", &b).unwrap();
        let events = store.pending("scope").unwrap();
        let start = events
            .iter()
            .find(|e| e.kind == ActivityKind::ToolStart)
            .unwrap();
        let latest = events
            .iter()
            .filter(|e| e.kind == ActivityKind::ToolStart)
            .max_by_key(|e| e.revision)
            .unwrap();
        assert_eq!(latest.provenance, "native");
        assert_eq!(events.len(), 3);
        assert_eq!(
            store
                .wire_revision("scope", &start.event_id, start.revision)
                .unwrap(),
            0
        );
        assert_eq!(
            store
                .wire_revision("scope", &latest.event_id, latest.revision)
                .unwrap(),
            1
        );
        let mut raw = serde_json::to_value(start).unwrap();
        raw["prompt"] = json!("secret");
        assert!(serde_json::from_value::<BrokerActivityEventV2>(raw).is_err());
        drop(store);
        std::fs::remove_file(path).unwrap();
        std::fs::remove_file(db).unwrap();
    }
    #[test]
    fn unsupported_activity_retains_cursor_and_exposes_only_static_error() {
        let path = file(&[
            meta(),
            record(
                "2026-10-06T18:00:00Z",
                "event_msg",
                json!({"type":"task_started","turn_id":"turn"}),
            ),
        ]);
        let store = ActivityStore::open(&path.with_extension("db")).unwrap();
        let batch = parse_activity(&path, &ActivityCursor::default(), Utc::now()).unwrap();
        store.commit("scope", "source", &batch).unwrap();
        let before = store.cursor("scope", "source").unwrap();
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap();
        writeln!(
            f,
            "{}",
            native(
                "2026-10-06T18:01:00Z",
                "private-id",
                0,
                0,
                "FuturePrivateTool"
            )
        )
        .unwrap();
        assert_eq!(
            parse_activity(&path, &before, Utc::now()).err().unwrap(),
            "unsupported_native_item"
        );
        assert_eq!(
            store.cursor("scope", "source").unwrap().offset,
            before.offset
        );
        assert_eq!(store.pending("scope").unwrap().len(), 1);
    }

    #[test]
    fn compatibility_guard_respects_replay_window_and_known_non_activity() {
        let start = instant(&json!("2026-10-06T18:00:00Z")).unwrap();
        let rows = [
            meta(),
            native("2026-10-06T17:59:00Z", "old", 0, 0, "FutureTool"),
            native("2026-10-06T18:00:01Z", "reasoning", 0, 0, "Reasoning"),
            native("2026-10-06T18:00:02Z", "plan", 0, 0, "Plan"),
            native("2026-10-06T18:00:03Z", "compact", 0, 0, "ContextCompaction"),
            native("2026-10-06T18:01:00Z", "later", 0, 0, "FutureTool"),
        ];
        let path = file(&rows);
        let cursor = ActivityCursor {
            capture_since: Some(start),
            capture_until: Some(start + chrono::Duration::minutes(1)),
            ..Default::default()
        };
        let batch = parse_activity(&path, &cursor, Utc::now()).unwrap();
        assert!(batch.events.is_empty());
        assert_eq!(batch.cursor.capture_until, cursor.capture_until);
        for typ in ["remote_tool_call", "function_call"] {
            let payload = if typ == "function_call" {
                json!({"type":typ,"name":"exec"})
            } else {
                json!({"type":typ,"input":"PRIVATE_INPUT"})
            };
            let path = file(&[
                meta(),
                record("2026-10-06T18:00:01Z", "response_item", payload),
            ]);
            let code = parse_activity(&path, &cursor, Utc::now()).err().unwrap();
            assert_eq!(
                code,
                if typ == "function_call" {
                    "activity_tool_metadata_missing"
                } else {
                    "unsupported_tool_record"
                }
            );
        }
    }
}

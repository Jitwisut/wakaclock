//! Transient native hook normalization. Only allowlisted activity metadata is
//! durable. Tool arguments, prompts, responses and email never leave this function.
use super::activity::{opaque, ActivityKind, BrokerActivityEventV2, BrokerActivityEventV3};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct NativeActivity {
    pub event: Option<BrokerActivityEventV3>,
    pub reason: &'static str,
    pub timestamp_source: &'static str,
    pub operation_identity: &'static str,
}

pub fn normalize_hook(
    adapter: &str,
    surface: &str,
    raw: &Value,
    observed: DateTime<Utc>,
    observation_id: &str,
) -> Result<NativeActivity, String> {
    if super::AdapterRegistry::builtin().get(adapter).is_none() {
        return Err("activity_adapter_unknown".into());
    }
    let unavailable = |reason| NativeActivity {
        event: None,
        reason,
        timestamp_source: "unavailable",
        operation_identity: "unavailable",
    };
    let string = |name: &str| raw[name].as_str().filter(|s| !s.is_empty());
    let (session, root, hook, provider_operation, kind) = match adapter {
        "claude-code" | "copilot" => {
            let hook = string("hook_event_name").ok_or("activity_hook_schema_unknown")?;
            let kind = match hook {
                "PreToolUse" => ActivityKind::ToolStart,
                "PostToolUse" | "PostToolUseFailure" => ActivityKind::ToolEnd,
                "Stop" => ActivityKind::MessageComplete,
                "SessionStart" | "UserPromptSubmit" if adapter == "copilot" => {
                    ActivityKind::TaskStart
                }
                _ => return Ok(unavailable("activity_hook_not_an_activity_marker")),
            };
            (
                string("session_id"),
                string("cwd"),
                hook,
                string("tool_use_id"),
                kind,
            )
        }
        "gemini-cli" => {
            let hook = string("hook_event_name").ok_or("activity_hook_schema_unknown")?;
            let kind = match hook {
                "BeforeTool" => ActivityKind::ToolStart,
                "AfterTool" => ActivityKind::ToolEnd,
                "BeforeAgent" => ActivityKind::TaskStart,
                "AfterAgent" => ActivityKind::MessageComplete,
                _ => return Ok(unavailable("activity_hook_not_an_activity_marker")),
            };
            // Its documented hook schema does not promise a tool operation ID.
            (string("session_id"), string("cwd"), hook, None, kind)
        }
        "cursor" => {
            let hook = string("hook_event_name").ok_or("activity_hook_schema_unknown")?;
            let kind = match hook {
                "preToolUse" => ActivityKind::ToolStart,
                "postToolUse" | "postToolUseFailure" => ActivityKind::ToolEnd,
                "stop" => ActivityKind::MessageComplete,
                _ => return Ok(unavailable("activity_hook_not_an_activity_marker")),
            };
            let root = raw["workspace_roots"]
                .as_array()
                .filter(|roots| roots.len() == 1)
                .and_then(|roots| roots[0].as_str());
            // A generation is not a unique tool call. Never collapse its tools.
            let operation = if kind == ActivityKind::MessageComplete {
                string("generation_id")
            } else {
                None
            };
            (string("conversation_id"), root, hook, operation, kind)
        }
        "cline" => {
            let hook = string("hookName").ok_or("activity_hook_schema_unknown")?;
            let kind = match hook {
                "TaskStart" | "TaskResume" | "UserPromptSubmit" => ActivityKind::TaskStart,
                "TaskCancel" | "TaskComplete" => ActivityKind::TaskEnd,
                "PreToolUse" => ActivityKind::ToolStart,
                "PostToolUse" => ActivityKind::ToolEnd,
                _ => return Ok(unavailable("activity_hook_not_an_activity_marker")),
            };
            let root = raw["workspaceRoots"]
                .as_array()
                .filter(|roots| roots.len() == 1)
                .and_then(|roots| roots[0].as_str());
            // Tool names do not identify individual invocations.
            (string("taskId"), root, hook, None, kind)
        }
        "kilo-code" | "opencode" => {
            let hook = string("hook_event_name").ok_or("activity_hook_schema_unknown")?;
            let kind = match hook {
                "tool.execute.before" => ActivityKind::ToolStart,
                "tool.execute.after" | "tool.execute.failure" => ActivityKind::ToolEnd,
                _ => return Ok(unavailable("activity_hook_not_an_activity_marker")),
            };
            (
                string("sessionID"),
                string("directory"),
                hook,
                string("callID"),
                kind,
            )
        }
        _ => {
            return Ok(unavailable(
                "activity_native_hook_contract_evidence_pending",
            ))
        }
    };
    let Some(session) = session else {
        return Ok(unavailable("activity_session_identity_unavailable"));
    };
    let Some(root) = root.map(PathBuf::from).filter(|p| p.is_absolute()) else {
        return Ok(unavailable("activity_project_context_unresolved"));
    };
    let timestamp = match raw.get("timestamp") {
        Some(timestamp) => Some(
            timestamp
                .as_str()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .ok_or("activity_hook_timestamp_invalid")?
                .with_timezone(&Utc),
        ),
        None => None,
    };
    let timestamp_source = if timestamp.is_some() {
        "provider_event"
    } else {
        "hook_observed"
    };
    // The canonical usage stream scopes this same native identity with the
    // collector and adapter before transmission. Hashing it again here would
    // split activity and usage into two unrelated canonical sessions.
    let session_id = session.to_string();
    // An observation ID is made before inbox commit and survives its retries.
    // It does not prove equivalence with a native/wrapper provider operation.
    let operation_id = opaque(&format!(
        "{}\0{}",
        session_id,
        provider_operation.unwrap_or(observation_id)
    ));
    let status = if hook.ends_with("Failure")
        || hook.ends_with(".failure")
        || adapter == "cline" && hook == "PostToolUse" && raw["postToolUse"]["success"] == false
    {
        Some("failed".into())
    } else {
        None
    };
    let event = BrokerActivityEventV3 {
        schema_version: 3,
        adapter_id: adapter.into(),
        execution_surface: surface.into(),
        provider_schema_version: format!("{adapter}-hook-v1-{timestamp_source}"),
        activity: BrokerActivityEventV2 {
            // A directly observed hook can supersede a transcript marker for the
            // same proven operation without a same-revision timestamp conflict.
            schema_version: 2,
            event_id: opaque(&format!("{adapter}\0{operation_id}\0{kind:?}")),
            revision: 1,
            session_id,
            project_root: root,
            kind,
            operation_id,
            occurred_at: timestamp.unwrap_or(observed),
            started_at: None,
            provenance: "native".into(),
            tool: None,
            status,
            producer_surface: format!("{adapter}-{surface}"),
            monitoring_only: false,
        },
    };
    event.validate()?;
    Ok(NativeActivity {
        event: Some(event),
        reason: "observed_marker_no_measured_interval",
        timestamp_source,
        operation_identity: if provider_operation.is_some() {
            "provider"
        } else {
            "observation_only"
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_markers_keep_failures_and_missing_identity_is_unavailable() {
        let at = Utc::now();
        let missing = normalize_hook(
            "copilot",
            "ide",
            &serde_json::json!({"hook_event_name":"PostToolUse","cwd":std::env::temp_dir()}),
            at,
            "observation",
        )
        .unwrap();
        assert!(missing.event.is_none());
        assert_eq!(missing.reason, "activity_session_identity_unavailable");
        let failure=normalize_hook("cline","ide",&serde_json::json!({"hookName":"PostToolUse","taskId":"session","workspaceRoots":[std::env::temp_dir()],"timestamp":at,"postToolUse":{"success":false,"result":"SENSITIVE"}}),at,"observation").unwrap().event.unwrap();
        assert_eq!(failure.activity.status.as_deref(), Some("failed"));
        assert!(failure.activity.started_at.is_none());
        assert!(!serde_json::to_string(&failure)
            .unwrap()
            .contains("SENSITIVE"));
        let tool=normalize_hook("kilo-code","ide",&serde_json::json!({"hook_event_name":"tool.execute.failure","sessionID":"session","callID":"call","directory":std::env::temp_dir(),"timestamp":at}),at,"observation").unwrap();
        assert_eq!(tool.operation_identity, "provider");
        assert_eq!(
            tool.event.unwrap().activity.status.as_deref(),
            Some("failed")
        );
    }
    #[test]
    fn hook_contents_and_permission_wait_are_not_measurements() {
        let raw = serde_json::json!({"hook_event_name":"PreToolUse","session_id":"session","cwd":std::env::temp_dir(),"tool_use_id":"call","tool_input":{"command":"SENSITIVE"},"tool_response":"SENSITIVE"});
        let result = normalize_hook("claude-code", "cli", &raw, Utc::now(), "observation").unwrap();
        assert!(!serde_json::to_string(&result)
            .unwrap()
            .contains("SENSITIVE"));
        assert_eq!(result.operation_identity, "provider");
        assert!(result.event.unwrap().activity.started_at.is_none());
    }
    #[test]
    fn one_cursor_generation_can_have_separate_tools() {
        let raw = serde_json::json!({"hook_event_name":"postToolUse","conversation_id":"session","generation_id":"same-generation","workspace_roots":[std::env::temp_dir()]});
        let at = Utc::now();
        let a = normalize_hook("cursor", "ide", &raw, at, "first").unwrap();
        let b = normalize_hook("cursor", "ide", &raw, at, "second").unwrap();
        assert_eq!(a.operation_identity, "observation_only");
        assert_ne!(
            a.event.unwrap().normalized().unwrap().event_id,
            b.event.unwrap().normalized().unwrap().event_id
        );
    }
}

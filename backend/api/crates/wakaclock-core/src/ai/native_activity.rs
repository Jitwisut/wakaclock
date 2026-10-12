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
    let antigravity_operation = if adapter == "antigravity" {
        let key = match string("hook_event_name") {
            Some("PostToolUse") => "stepIdx",
            Some("PostInvocation") => "invocationNum",
            Some("Stop") => "executionNum",
            _ => "",
        };
        raw[key].as_u64().map(|n| format!("{key}:{n}"))
    } else {
        None
    };
    let (session, root, hook, provider_operation, kind) = match adapter {
        "claude-code" | "copilot" => {
            let hook = string("hook_event_name").ok_or("activity_hook_schema_unknown")?;
            let kind = match hook {
                "PreToolUse" => ActivityKind::ToolStart,
                "PostToolUse" | "PostToolUseFailure" => ActivityKind::ToolEnd,
                "Stop" => ActivityKind::MessageComplete,
                "SessionEnd" if adapter == "copilot" => ActivityKind::TaskEnd,
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
        "kimi-code-cli" => {
            let hook = string("hook_event_name").ok_or("activity_hook_schema_unknown")?;
            let kind = match hook {
                "PreToolUse" => ActivityKind::ToolStart,
                "PostToolUse" | "PostToolUseFailure" => ActivityKind::ToolEnd,
                "SessionStart" | "TurnStarted" => ActivityKind::TaskStart,
                "SessionEnd" | "Interrupt" => ActivityKind::TaskEnd,
                "Stop" | "StopFailure" => ActivityKind::MessageComplete,
                _ => return Ok(unavailable("activity_hook_not_an_activity_marker")),
            };
            // PreToolUse is before permission checks. An operation ID is for
            // deduplication only, never proof of permission-free execution time.
            (
                string("session_id"),
                string("cwd"),
                hook,
                string("tool_call_id"),
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
        "roo-code" => {
            if string("provider_version") != Some("3.53.0") {
                return Ok(unavailable("activity_hook_schema_unknown"));
            }
            let hook = string("eventName").ok_or("activity_hook_schema_unknown")?;
            let kind = match hook {
                "taskStarted" | "taskUserMessage" => ActivityKind::TaskStart,
                "taskCompleted" | "taskAborted" => ActivityKind::TaskEnd,
                "taskToolFailed" => ActivityKind::ToolEnd,
                _ => return Ok(unavailable("activity_hook_not_an_activity_marker")),
            };
            let effective =
                string("context_effective_at").and_then(|at| DateTime::parse_from_rfc3339(at).ok());
            let event_at = string("timestamp").and_then(|at| DateTime::parse_from_rfc3339(at).ok());
            if string("context_provenance") != Some("user_confirmed")
                || effective.zip(event_at).is_none_or(|(start, at)| start > at)
            {
                return Ok(unavailable("activity_project_context_unresolved"));
            }
            (string("taskId"), string("project_root"), hook, None, kind)
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
        "antigravity" => {
            let hook = string("hook_event_name").ok_or("activity_hook_schema_unknown")?;
            let kind = match hook {
                "PostToolUse" => ActivityKind::ToolEnd,
                "PostInvocation" => ActivityKind::MessageComplete,
                "Stop" if raw["fullyIdle"] == true => ActivityKind::TaskEnd,
                "Stop" => ActivityKind::MessageComplete,
                // PreToolUse permission decisions are not overridden by tracking.
                _ => return Ok(unavailable("activity_hook_not_an_activity_marker")),
            };
            let root = raw["workspacePaths"]
                .as_array()
                .filter(|roots| roots.len() == 1)
                .and_then(|roots| roots[0].as_str());
            (
                string("conversationId"),
                root,
                hook,
                antigravity_operation.as_deref(),
                kind,
            )
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
                .and_then(|s| {
                    DateTime::parse_from_rfc3339(s)
                        .ok()
                        .map(|at| at.with_timezone(&Utc))
                        .or_else(|| {
                            (adapter == "cline")
                                .then(|| {
                                    s.parse::<i64>()
                                        .ok()
                                        .and_then(DateTime::<Utc>::from_timestamp_millis)
                                })
                                .flatten()
                        })
                })
                .ok_or("activity_hook_timestamp_invalid")?,
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
        || adapter == "antigravity" && raw["failed"] == true
        || adapter == "roo-code" && hook == "taskToolFailed"
    {
        Some("failed".into())
    } else {
        None
    };
    let event = BrokerActivityEventV3 {
        schema_version: 3,
        adapter_id: adapter.into(),
        execution_surface: surface.into(),
        provider_schema_version: if adapter == "roo-code" {
            "roo-code-public-3.53.0-user-confirmed-project".into()
        } else {
            format!("{adapter}-hook-v1-{timestamp_source}")
        },
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
    fn cline_milliseconds_and_roo_user_context_are_real_markers_not_tool_intervals() {
        let at = Utc::now();
        let root = std::env::temp_dir();
        let cline=normalize_hook("cline","ide",&serde_json::json!({"hookName":"PostToolUse","taskId":"cline-task","timestamp":at.timestamp_millis().to_string(),"workspaceRoots":[root]}),at,"original").unwrap().event.unwrap();
        assert_eq!(
            cline.activity.occurred_at.timestamp_millis(),
            at.timestamp_millis()
        );
        assert!(cline.activity.started_at.is_none());
        let mut roo = serde_json::json!({"eventName":"taskToolFailed","taskId":"native-task","provider_version":"3.53.0","timestamp":at,"project_root":root,"context_provenance":"user_confirmed","context_effective_at":at});
        let event = normalize_hook("roo-code", "ide", &roo, at, "original")
            .unwrap()
            .event
            .unwrap();
        assert!(event.activity.started_at.is_none());
        assert_eq!(event.activity.status.as_deref(), Some("failed"));
        assert!(event.provider_schema_version.contains("user-confirmed"));
        let retry = normalize_hook("roo-code", "ide", &roo, at, "original")
            .unwrap()
            .event
            .unwrap();
        let another = normalize_hook("roo-code", "ide", &roo, at, "another-observation")
            .unwrap()
            .event
            .unwrap();
        assert_eq!(event.activity.event_id, retry.activity.event_id);
        assert_ne!(event.activity.event_id, another.activity.event_id);
        roo["context_effective_at"] = serde_json::json!(at + chrono::Duration::seconds(1));
        assert!(normalize_hook("roo-code", "ide", &roo, at, "original")
            .unwrap()
            .event
            .is_none());
        roo.as_object_mut().unwrap().remove("project_root");
        assert!(normalize_hook("roo-code", "ide", &roo, at, "original")
            .unwrap()
            .event
            .is_none());
    }
    #[test]
    fn antigravity_native_step_identity_is_metadata_only_and_not_a_measured_interval() {
        let at = Utc::now();
        let raw = serde_json::json!({"hook_event_name":"PostToolUse","conversationId":"session","workspacePaths":[std::env::temp_dir()],"stepIdx":7,"failed":true,"toolCall":{"args":"SENSITIVE"},"error":"SENSITIVE"});
        let a = normalize_hook("antigravity", "ide", &raw, at, "first-observation").unwrap();
        let b = normalize_hook("antigravity", "ide", &raw, at, "second-observation").unwrap();
        let event = a.event.unwrap();
        assert_eq!(event.activity.event_id, b.event.unwrap().activity.event_id);
        assert!(event.activity.started_at.is_none());
        assert_eq!(event.activity.status.as_deref(), Some("failed"));
        assert!(!serde_json::to_string(&event).unwrap().contains("SENSITIVE"));
        let pre = normalize_hook(
            "antigravity",
            "ide",
            &serde_json::json!({"hook_event_name":"PreToolUse"}),
            at,
            "observation",
        )
        .unwrap();
        assert!(pre.event.is_none());
    }
    #[test]
    fn kimi_markers_exclude_permission_waits_and_contents() {
        let at = Utc::now();
        for hook in ["PreToolUse", "PostToolUseFailure", "Stop"] {
            let marker = normalize_hook("kimi-code-cli", "cli", &serde_json::json!({"hook_event_name":hook,"session_id":"fixture-kimi","cwd":std::env::temp_dir(),"tool_call_id":"call","tool_input":{"command":"SENSITIVE"},"tool_output":"SENSITIVE","timestamp":at}), at, "observation").unwrap().event.unwrap();
            assert!(marker.activity.started_at.is_none());
            assert!(!serde_json::to_string(&marker)
                .unwrap()
                .contains("SENSITIVE"));
        }
        let wait = normalize_hook(
            "kimi-code-cli",
            "cli",
            &serde_json::json!({"hook_event_name":"PermissionRequest"}),
            at,
            "observation",
        )
        .unwrap();
        assert!(wait.event.is_none());
    }
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

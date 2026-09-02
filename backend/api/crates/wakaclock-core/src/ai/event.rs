use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

/// Event IDs cross the local producer/broker boundary and are persisted in the
/// sidecar/inbox. Keep the visible form deliberately narrow so a prompt, command
/// line, or other free-form hook value cannot be smuggled through an allowlisted
/// identity field. Values outside this alphabet are deterministically hashed by
/// the producer/broker while preserving retry identity.
pub fn is_safe_event_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
}

/// Build a stable producer event ID without putting a file path (or any other
/// path-bearing identity) in the value sent across the machine boundary.  The
/// complete identity is still part of the UUIDv5 input, so two files touched by
/// one tool call remain distinct while the emitted ID is opaque metadata.
pub fn opaque_file_event_id(prefix: &str, operation_id: &str, raw_path: &str) -> String {
    let material = format!("{prefix}|{operation_id}|{raw_path}");
    format!(
        "{prefix}:{}",
        Uuid::new_v5(&Uuid::NAMESPACE_OID, material.as_bytes())
    )
}

/// Where an [`AiEditEvent`] was derived from. Distinct from [`AiConfidence`]: a
/// transcript-sourced event can still carry low confidence if correlation was
/// ambiguous, and a hook-sourced event can be `Verified` because the agent process
/// itself emitted it synchronously.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiEventSource {
    Transcript,
    AgentHook,
    IdeTelemetry,
    /// Structured metadata emitted by an MCP/tool bridge such as ChatGPT -> Tan.
    Mcp,
}

impl AiEventSource {
    /// Matches the `ai_source` wire values `wakaclock-cli`'s `--ai-source` flag and
    /// the server already accept (`agent_hook`, `ide_telemetry`) — see
    /// `backend/api/crates/wakaclock-cli/src/main.rs`.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Transcript => "transcript",
            Self::AgentHook => "agent_hook",
            Self::IdeTelemetry => "ide_telemetry",
            Self::Mcp => "mcp",
        }
    }
}

/// Ordered low-to-high so `AiConfidence::Verified > AiConfidence::Correlated`, matching
/// the candidate-scoring order in plan.md 8.7 ("higher evidence confidence (verified
/// before correlated before inferred)").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum AiConfidence {
    Unknown,
    Inferred,
    Correlated,
    Verified,
}

impl AiConfidence {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Unknown => "unknown",
            Self::Inferred => "inferred",
            Self::Correlated => "correlated",
            Self::Verified => "verified",
        }
    }
}

/// A single file mutation attributed to an AI agent, derived from a transcript record,
/// agent hook payload, or IDE telemetry. Deliberately holds only derived metadata —
/// never a prompt, model response, patch body, or raw source text (plan.md 8.3).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AiEditEvent {
    /// Stable across retries. See `event_id` module docs for how this is derived
    /// per source agent.
    pub event_id: String,
    /// Normalized agent identifier, e.g. `"codex"`, `"claude-code"`, `"gemini-cli"`.
    /// Use [`normalize_agent_id`] rather than storing a raw client-supplied string.
    pub agent: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub session_id: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub entity: PathBuf,
    pub project_root: Option<PathBuf>,
    /// `None` means unknown, not zero — some agents expose a tool call without an
    /// exact patch.
    pub lines_added: Option<u32>,
    pub lines_deleted: Option<u32>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub source: AiEventSource,
    pub confidence: AiConfidence,
}

/// Map a client- or transcript-supplied agent label onto the stable identifier used
/// throughout storage and analytics (plan.md 8.3: "Normalize agent names to stable
/// identifiers ... and keep provider/model separate").
pub fn normalize_agent_id(raw: &str) -> String {
    let lowered = raw.trim().to_ascii_lowercase();
    match lowered.as_str() {
        "codex" | "codex-cli" | "codex cli" | "openai-codex" => "codex".to_string(),
        "claude" | "claude-code" | "claude code" | "anthropic-claude-code" => {
            "claude-code".to_string()
        }
        "kilo" | "kilocode" | "kilo-code" | "kilo code" => "kilo-code".to_string(),
        "kimi" | "kimi-cli" | "kimi cli" | "kimi-code" | "kimi-code-cli" => {
            "kimi-code-cli".to_string()
        }
        "deepcode" | "deep-code" | "deepseek-code" => "deep-code".to_string(),
        "gemini" | "gemini-cli" | "gemini cli" | "google-gemini-cli" => "gemini-cli".to_string(),
        other => other.replace([' ', '_'], "-"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn as_str_matches_the_cli_wire_values() {
        assert_eq!(AiEventSource::Transcript.as_str(), "transcript");
        assert_eq!(AiEventSource::AgentHook.as_str(), "agent_hook");
        assert_eq!(AiEventSource::Mcp.as_str(), "mcp");
        assert_eq!(AiConfidence::Verified.as_str(), "verified");
    }

    #[test]
    fn confidence_orders_verified_highest() {
        assert!(AiConfidence::Verified > AiConfidence::Correlated);
        assert!(AiConfidence::Correlated > AiConfidence::Inferred);
        assert!(AiConfidence::Inferred > AiConfidence::Unknown);
    }

    #[test]
    fn normalize_agent_id_canonicalizes_known_agents() {
        assert_eq!(normalize_agent_id("Codex CLI"), "codex");
        assert_eq!(normalize_agent_id("Claude Code"), "claude-code");
        assert_eq!(normalize_agent_id("Kilo Code"), "kilo-code");
        assert_eq!(normalize_agent_id("Kimi CLI"), "kimi-code-cli");
        assert_eq!(normalize_agent_id("Deep Code"), "deep-code");
        assert_eq!(normalize_agent_id("GEMINI-CLI"), "gemini-cli");
    }

    #[test]
    fn normalize_agent_id_passes_through_unknown_agents() {
        assert_eq!(normalize_agent_id("Cursor Agent"), "cursor-agent");
    }

    #[test]
    fn event_serializes_without_raw_content_fields() {
        let event = AiEditEvent {
            event_id: opaque_file_event_id("codex-v1", "exec-1", "src/lib.rs"),
            agent: "codex".to_string(),
            provider: Some("openai".to_string()),
            model: None,
            session_id: None,
            occurred_at: Utc::now(),
            entity: PathBuf::from("src/lib.rs"),
            project_root: None,
            lines_added: Some(3),
            lines_deleted: None,
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        };
        let json = serde_json::to_value(&event).expect("serializes");
        let object = json.as_object().expect("object");
        for forbidden in ["prompt", "response", "patch", "content", "source_text"] {
            assert!(
                !object.contains_key(forbidden),
                "unexpected field: {forbidden}"
            );
        }
    }

    #[test]
    fn opaque_file_event_id_is_stable_distinct_and_path_free() {
        let first = opaque_file_event_id("codex-v1", "call-1", "/Users/alice/project/src/lib.rs");
        assert_eq!(
            first,
            opaque_file_event_id("codex-v1", "call-1", "/Users/alice/project/src/lib.rs")
        );
        assert_ne!(
            first,
            opaque_file_event_id("codex-v1", "call-1", "/Users/alice/project/src/main.rs")
        );
        assert!(!first.contains("/Users/alice/project"));
        assert!(!first.contains("src/lib.rs"));
    }

    #[test]
    fn event_id_allowlist_rejects_free_form_values() {
        assert!(is_safe_event_id("ape1:0123-abc_def"));
        assert!(!is_safe_event_id("prompt: run this command"));
        assert!(!is_safe_event_id("path/src/file.rs"));
        assert!(!is_safe_event_id(&"x".repeat(129)));
    }
}

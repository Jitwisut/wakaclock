use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
        "gemini" | "gemini-cli" | "gemini cli" | "google-gemini-cli" => "gemini-cli".to_string(),
        other => other.replace([' ', '_'], "-"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(normalize_agent_id("GEMINI-CLI"), "gemini-cli");
    }

    #[test]
    fn normalize_agent_id_passes_through_unknown_agents() {
        assert_eq!(normalize_agent_id("Cursor Agent"), "cursor-agent");
    }

    #[test]
    fn event_serializes_without_raw_content_fields() {
        let event = AiEditEvent {
            event_id: "codex:exec-1:src/lib.rs".to_string(),
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
}

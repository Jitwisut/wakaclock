//! Shared metadata-only producer contract for AI-agent adapters.
//!
//! Native hooks (shell, TypeScript, or future Rust integrations) should use this
//! module's rules before handing an event to the local broker.  The producer layer
//! deliberately does not know about HTTP, ClickHouse, or editor attribution: it
//! only normalizes identity, validates bounded metadata and builds the existing
//! `BrokerEventV1` envelope.

use std::path::PathBuf;

use chrono::{DateTime, Utc};
use thiserror::Error;
use uuid::Uuid;

use crate::{
    ai::{
        event::{is_safe_event_id, opaque_file_event_id},
        normalize_agent_id, AiConfidence, AiEventSource,
    },
    broker::{BrokerChangeKind, BrokerEventType, BrokerEventV1, BROKER_SCHEMA_VERSION},
};

/// Version of the producer-side metadata contract.  This is independent from
/// `BROKER_SCHEMA_VERSION`: the broker envelope can stay compatible while an
/// adapter's identity normalization evolves.
pub const PRODUCER_CONTRACT_VERSION: u8 = 1;
const MAX_ID_BYTES: usize = 128;
const MAX_MODEL_BYTES: usize = 256;

/// Metadata that identifies the program and model which produced an event.
/// `client_id` is the coding agent; `provider_id` is the model vendor.  They must
/// never be collapsed into one field (for example Kilo using DeepSeek is still
/// `client_id=kilo-code`, `provider_id=deepseek`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProducerIdentity {
    pub client_id: String,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
}

impl ProducerIdentity {
    pub fn new(
        client_id: impl AsRef<str>,
        provider_id: Option<&str>,
        model_id: Option<&str>,
    ) -> Result<Self, ProducerError> {
        Ok(Self {
            client_id: normalize_client_id(client_id.as_ref())?,
            provider_id: provider_id.map(normalize_provider_id).transpose()?,
            model_id: model_id.map(normalize_model_id).transpose()?,
        })
    }
}

/// Input to [`build_file_change_event`].  All fields are derived metadata; callers
/// must extract only allowlisted values from their native hook payload.
#[derive(Debug, Clone, PartialEq)]
pub struct ProducerFileChange {
    pub identity: ProducerIdentity,
    pub event_id: Option<String>,
    pub session_id: Option<String>,
    pub tool_call_id: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub entity: PathBuf,
    pub project_root: Option<PathBuf>,
    pub change_kind: BrokerChangeKind,
    pub previous_entity: Option<PathBuf>,
    pub lines_added: Option<u32>,
    pub lines_deleted: Option<u32>,
    pub source: AiEventSource,
    pub confidence: AiConfidence,
    pub active_seconds: Option<f64>,
    pub transport: Option<String>,
    pub tool: Option<String>,
}

#[derive(Debug, Error, PartialEq)]
pub enum ProducerError {
    #[error("producer client_id is empty")]
    EmptyClient,
    #[error("producer metadata field '{field}' is invalid")]
    InvalidField { field: &'static str },
    #[error("producer metadata field '{field}' is too long")]
    FieldTooLong { field: &'static str },
    #[error("producer event_id is empty")]
    EmptyEventId,
    #[error("producer event_id is required when session/tool identity is absent")]
    MissingEventIdentity,
    #[error("producer event occurred_at is invalid")]
    InvalidTimestamp,
    #[error("producer active_seconds is invalid")]
    InvalidActiveSeconds,
    #[error("producer event is invalid: {0}")]
    Broker(String),
}

/// Normalize a coding-agent/client label to a stable identifier.
pub fn normalize_client_id(raw: &str) -> Result<String, ProducerError> {
    let value = normalize_agent_id(raw);
    let value = match value.as_str() {
        "codex" | "codex-cli" | "openai-codex" => "codex",
        "claude" | "claude-code" | "anthropic-claude-code" => "claude-code",
        "kilo" | "kilocode" | "kilo-code" => "kilo-code",
        "kimi" | "kimi-cli" | "kimi-code" | "kimi-code-cli" => "kimi-code-cli",
        "deepcode" | "deep-code" | "deepseek-code" => "deep-code",
        "gemini" | "gemini-cli" | "google-gemini-cli" => "gemini-cli",
        other => other,
    };
    validate_identifier("client_id", value, MAX_ID_BYTES)
}

/// Normalize a model provider without treating it as the coding client.
pub fn normalize_provider_id(raw: &str) -> Result<String, ProducerError> {
    let lowered = raw.trim().to_ascii_lowercase();
    // Match documented aliases even when a hook labels them with spaces or
    // underscores, while retaining punctuation for unknown provider IDs.
    let compact: String = lowered
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect();
    let value = match compact.as_str() {
        "openai" | "openaiapi" | "apiopenaicom" => "openai".to_string(),
        "anthropic" | "anthropicapi" | "apianthropiccom" => "anthropic".to_string(),
        "moonshot" | "moonshotai" | "kimi" | "kimiapi" | "apimoonshotcn" => "moonshot".to_string(),
        "deepseek" | "deepseekapi" | "apideepseekcom" => "deepseek".to_string(),
        "google" | "googleai" | "gemini" => "google".to_string(),
        "github" | "githubcopilot" => "github".to_string(),
        _ => lowered.replace([' ', '_'], "-"),
    };
    validate_identifier("provider_id", &value, MAX_ID_BYTES)
}

/// Validate a model identifier while preserving provider-specific punctuation.
/// Model IDs are opaque metadata, not user content; whitespace/control characters
/// are rejected and a conservative byte limit bounds the event payload.
pub fn normalize_model_id(raw: &str) -> Result<String, ProducerError> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(ProducerError::InvalidField { field: "model_id" });
    }
    if value.len() > MAX_MODEL_BYTES {
        return Err(ProducerError::FieldTooLong { field: "model_id" });
    }
    if !value.chars().all(|character| {
        character.is_ascii_alphanumeric()
            || matches!(character, '-' | '_' | '.' | ':' | '/' | '[' | ']' | '+')
    }) {
        return Err(ProducerError::InvalidField { field: "model_id" });
    }
    Ok(value.to_string())
}

/// Build a deterministic producer event ID when a native hook does not supply one.
/// Including the file path is required because one tool call may touch many files.
pub fn file_event_id(input: &ProducerFileChange) -> Result<String, ProducerError> {
    if let Some(event_id) = input.event_id.as_deref() {
        let event_id = non_empty_bounded("event_id", event_id, MAX_ID_BYTES)?;
        if !is_safe_event_id(&event_id) {
            return Ok(opaque_file_event_id(
                "ape1",
                &event_id,
                &input.entity.to_string_lossy(),
            ));
        }
        return Ok(event_id);
    }
    let session = input.session_id.as_deref().unwrap_or("");
    let tool = input
        .tool_call_id
        .as_deref()
        .or(input.tool.as_deref())
        .unwrap_or("");
    if session.is_empty() && tool.is_empty() {
        return Err(ProducerError::MissingEventIdentity);
    }
    let material = format!(
        "atoaxis-producer-v{PRODUCER_CONTRACT_VERSION}|{}|{}|{}|{}|{}|{}",
        input.identity.client_id,
        session,
        tool,
        input.entity.to_string_lossy(),
        input.change_kind.as_str(),
        input.occurred_at.timestamp_millis(),
    );
    Ok(format!(
        "ape{PRODUCER_CONTRACT_VERSION}:{}",
        Uuid::new_v5(&Uuid::NAMESPACE_OID, material.as_bytes())
    ))
}

/// Build and normalize a metadata-only broker event.
pub fn build_file_change_event(input: ProducerFileChange) -> Result<BrokerEventV1, ProducerError> {
    if input.occurred_at.timestamp() <= 0 {
        return Err(ProducerError::InvalidTimestamp);
    }
    if let Some(seconds) = input.active_seconds {
        if !seconds.is_finite() || seconds < 0.0 {
            return Err(ProducerError::InvalidActiveSeconds);
        }
    }
    let event_id = file_event_id(&input)?;
    let session_id = input
        .session_id
        .map(|value| non_empty_bounded("session_id", &value, MAX_ID_BYTES))
        .transpose()?;
    let tool_call_id = input
        .tool_call_id
        .map(|value| non_empty_bounded("tool_call_id", &value, MAX_ID_BYTES))
        .transpose()?;
    let transport = input
        .transport
        .map(|value| metadata_label("transport", &value, MAX_ID_BYTES))
        .transpose()?;
    let tool = input
        .tool
        .map(|value| metadata_label("tool", &value, MAX_ID_BYTES))
        .transpose()?;
    let event = BrokerEventV1 {
        schema_version: BROKER_SCHEMA_VERSION,
        producer_version: Some(PRODUCER_CONTRACT_VERSION),
        event_type: BrokerEventType::FileChange,
        event_id,
        occurred_at: input.occurred_at,
        entity: input.entity.to_string_lossy().into_owned(),
        project_root: input
            .project_root
            .as_ref()
            .map(|path| path.to_string_lossy().into_owned()),
        change_kind: input.change_kind,
        previous_entity: input
            .previous_entity
            .as_ref()
            .map(|path| path.to_string_lossy().into_owned()),
        agent: input.identity.client_id,
        provider: input.identity.provider_id,
        model: input.identity.model_id,
        session_id,
        source: input.source,
        confidence: input.confidence,
        // Let the broker derive the canonical actor from the source/confidence
        // pair.  A producer may be verified, correlated, or inferred; hard-coding
        // `AiVerified` here would incorrectly upgrade weaker evidence.
        actor_type: None,
        actor_confidence: None,
        lines_added: input.lines_added,
        lines_deleted: input.lines_deleted,
        active_seconds: input.active_seconds,
        transport,
        tool,
        tool_event_id: tool_call_id,
    };
    event
        .normalize()
        .map_err(|error| ProducerError::Broker(error.to_string()))
}

fn validate_identifier(
    field: &'static str,
    value: &str,
    max_bytes: usize,
) -> Result<String, ProducerError> {
    if value.is_empty() {
        return if field == "client_id" {
            Err(ProducerError::EmptyClient)
        } else {
            Err(ProducerError::InvalidField { field })
        };
    }
    if value.len() > max_bytes {
        return Err(ProducerError::FieldTooLong { field });
    }
    if !value.chars().all(|character| {
        character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | '/')
    }) {
        return Err(ProducerError::InvalidField { field });
    }
    Ok(value.to_string())
}

fn non_empty_bounded(
    field: &'static str,
    value: &str,
    max_bytes: usize,
) -> Result<String, ProducerError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(if field == "event_id" {
            ProducerError::EmptyEventId
        } else {
            ProducerError::InvalidField { field }
        });
    }
    if value.len() > max_bytes {
        return Err(ProducerError::FieldTooLong { field });
    }
    if value.chars().any(|character| character.is_control()) {
        return Err(ProducerError::InvalidField { field });
    }
    Ok(value.to_string())
}

/// Tool and transport labels are metadata, but they still cross the local broker
/// boundary.  Restrict them to a small identifier alphabet so a producer cannot hide
/// command arguments or source text in an apparently allowlisted field.
fn metadata_label(
    field: &'static str,
    value: &str,
    max_bytes: usize,
) -> Result<String, ProducerError> {
    let value = non_empty_bounded(field, value, max_bytes)?;
    if !value.chars().all(|character| {
        character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | ':' | '/' | '+')
    }) {
        return Err(ProducerError::InvalidField { field });
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::heartbeat::ActorType;
    use std::path::Path;

    fn input() -> ProducerFileChange {
        ProducerFileChange {
            identity: ProducerIdentity::new(
                "Kilo Code",
                Some("DeepSeek API"),
                Some("deepseek-v4-pro"),
            )
            .unwrap(),
            event_id: None,
            session_id: Some("session-1".to_string()),
            tool_call_id: Some("call-1".to_string()),
            occurred_at: DateTime::from_timestamp(1_700_000_000, 0).unwrap(),
            entity: PathBuf::from("/workspace/src/main.rs"),
            project_root: Some(PathBuf::from("/workspace")),
            change_kind: BrokerChangeKind::Modify,
            previous_entity: None,
            lines_added: Some(4),
            lines_deleted: Some(1),
            source: AiEventSource::AgentHook,
            confidence: AiConfidence::Verified,
            active_seconds: Some(0.5),
            transport: Some("native_plugin".to_string()),
            tool: Some("WriteFile".to_string()),
        }
    }

    #[test]
    fn client_and_provider_are_separate() {
        let identity = &input().identity;
        assert_eq!(identity.client_id, "kilo-code");
        assert_eq!(identity.provider_id.as_deref(), Some("deepseek"));
        assert_eq!(identity.model_id.as_deref(), Some("deepseek-v4-pro"));
    }

    #[test]
    fn aliases_normalize_to_stable_clients() {
        assert_eq!(normalize_client_id("Codex CLI").unwrap(), "codex");
        assert_eq!(normalize_client_id("claude").unwrap(), "claude-code");
        assert_eq!(normalize_client_id("kilo").unwrap(), "kilo-code");
        assert_eq!(normalize_client_id("kimi-cli").unwrap(), "kimi-code-cli");
        assert_eq!(normalize_client_id("deep-code").unwrap(), "deep-code");
    }

    #[test]
    fn deterministic_file_id_includes_file_identity() {
        let first = input();
        let mut second = first.clone();
        second.entity = PathBuf::from("/workspace/src/other.rs");
        assert_ne!(
            file_event_id(&first).unwrap(),
            file_event_id(&second).unwrap()
        );
        assert_eq!(
            file_event_id(&first).unwrap(),
            file_event_id(&first).unwrap()
        );
    }

    #[test]
    fn supplied_path_bearing_id_is_hashed_before_delivery() {
        let mut value = input();
        value.event_id = Some("session-1:src/main.rs:1".to_string());
        let event_id = file_event_id(&value).unwrap();
        assert!(event_id.starts_with("ape1:"));
        assert!(!event_id.contains("src/main.rs"));
        assert_eq!(event_id, file_event_id(&value).unwrap());
    }

    #[test]
    fn supplied_free_form_id_is_hashed_before_delivery() {
        let mut value = input();
        value.event_id = Some("prompt: add this secret command now".to_string());
        let event_id = file_event_id(&value).unwrap();
        assert!(is_safe_event_id(&event_id));
        assert!(!event_id.contains("secret"));
    }

    #[test]
    fn event_builder_normalizes_a_metadata_only_broker_event() {
        let event = build_file_change_event(input()).unwrap();
        assert_eq!(event.agent, "kilo-code");
        assert_eq!(event.provider.as_deref(), Some("deepseek"));
        assert_eq!(event.model.as_deref(), Some("deepseek-v4-pro"));
        assert_eq!(event.producer_version, Some(PRODUCER_CONTRACT_VERSION));
        assert_eq!(event.actor_type, Some(ActorType::AiVerified));
        assert!(event.event_id.starts_with("ape1:"));
        let json = serde_json::to_value(event).unwrap();
        let object = json.as_object().unwrap();
        for forbidden in [
            "prompt", "response", "content", "patch", "command", "output",
        ] {
            assert!(!object.contains_key(forbidden), "found {forbidden}");
        }
    }

    #[test]
    fn builder_rejects_content_like_metadata() {
        let mut value = input();
        value.tool = Some("write\nsource".to_string());
        assert!(matches!(
            build_file_change_event(value),
            Err(ProducerError::InvalidField { field: "tool" })
        ));
    }

    #[test]
    fn builder_rejects_free_form_tool_labels() {
        let mut value = input();
        value.tool = Some("write secret source".to_string());
        assert!(matches!(
            build_file_change_event(value),
            Err(ProducerError::InvalidField { field: "tool" })
        ));
    }

    #[test]
    fn builder_requires_an_identity_when_event_id_is_missing() {
        let mut value = input();
        value.session_id = None;
        value.tool_call_id = None;
        value.tool = None;
        assert_eq!(
            file_event_id(&value),
            Err(ProducerError::MissingEventIdentity)
        );
    }

    #[test]
    fn model_validation_rejects_whitespace_and_bounds_payload() {
        assert!(normalize_model_id("deepseek v4").is_err());
        assert!(normalize_model_id(&"x".repeat(MAX_MODEL_BYTES + 1)).is_err());
    }

    #[test]
    fn event_builder_keeps_project_paths_as_paths() {
        let event = build_file_change_event(input()).unwrap();
        assert!(Path::new(&event.entity).starts_with("/workspace"));
        assert_eq!(event.project_root.as_deref(), Some("/workspace"));
    }
}

//! Evidence-based AI identity resolution shared by parsers, hooks and the API.
//!
//! Identity is deliberately separate from [`crate::heartbeat::ActorType`].  A
//! transcript can prove that an AI tool changed a file while still not reporting
//! the model used for that turn.  In that case the activity remains AI evidence,
//! but its identity is partial and must not appear in a confirmed model table.

use super::provider::{canonical_provider_alias, provider_for_endpoint};
use serde::{Deserialize, Serialize};

pub const IDENTITY_SCHEMA_VERSION: u8 = 1;
/// Identity references are opaque IDs, never free-form transcript content. Keep
/// the same conservative alphabet and bound used by event IDs before they cross
/// the broker/API boundary.
pub const MAX_IDENTITY_REFERENCE_BYTES: usize = 128;

/// Completeness of the evidence that names an AI agent/provider/model tuple.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IdentityStatus {
    Confirmed,
    Partial,
    Conflict,
    Unavailable,
}

impl IdentityStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Confirmed => "confirmed",
            Self::Partial => "partial",
            Self::Conflict => "conflict",
            Self::Unavailable => "unavailable",
        }
    }
}

/// A bounded, machine-readable reason for leaving a tuple out of the confirmed
/// table.  Keep these values stable: they are used by the dashboard and repair
/// reports, while the raw transcript remains local to the user's device.
pub const REASON_MISSING_AGENT: &str = "missing_agent";
pub const REASON_MISSING_PROVIDER: &str = "missing_provider";
pub const REASON_MISSING_MODEL: &str = "missing_model";
pub const REASON_INTERNAL_MARKER: &str = "internal_marker";
pub const REASON_CONTEXT_UNAVAILABLE: &str = "context_unavailable";
pub const REASON_CONFLICTING_EVIDENCE: &str = "conflicting_evidence";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityField {
    Agent,
    Provider,
    Model,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IdentityResolution {
    pub status: IdentityStatus,
    pub reason: Option<&'static str>,
    pub source: Option<String>,
    pub agent: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
}

/// Normalize an explicitly reported agent label. Unknown labels are retained as
/// evidence for diagnostics, but callers should only expose known adapters in a
/// confirmed row.
pub fn normalize_agent(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty()
        || value.len() > MAX_IDENTITY_REFERENCE_BYTES
        || value.chars().any(|character| character.is_control())
        || is_placeholder(value)
        || is_internal_marker(value)
    {
        return None;
    }
    Some(value.to_ascii_lowercase().replace([' ', '_'], "-"))
}

/// Normalize a provider only from an explicitly reported alias or documented
/// endpoint. A model name is never inspected here, so `gpt-*` cannot silently
/// turn into an OpenAI provider.
pub fn normalize_provider(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if is_placeholder(value) || is_internal_marker(value) {
        return None;
    }
    if value.len() > 128 || value.chars().any(|character| character.is_control()) {
        return None;
    }
    // A URL or path-looking provider must resolve to a documented first-party
    // endpoint. Never retain an arbitrary proxy URL as if it were a provider.
    if value.contains("://") || value.contains('/') {
        return provider_for_endpoint(value).map(str::to_string);
    }
    // Unknown provider labels are intentionally dropped.  They can remain in
    // local diagnostics as raw producer evidence, but they are not a canonical
    // provider and therefore must never make an AI tuple `confirmed`.
    provider_for_endpoint(value)
        .or_else(|| canonical_provider_alias(value))
        .map(str::to_string)
}

/// Preserve provider-specific model IDs while removing sentinel/internal values.
/// The parser is intentionally permissive about new model names: an allowlist
/// would make a newly released, genuinely reported model look missing.
pub fn normalize_model(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if is_placeholder(value) || is_internal_marker(value) {
        return None;
    }
    if value.len() > 256
        || value
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return None;
    }
    Some(value.to_string())
}

/// Normalize an opaque session/turn/message/tool reference. Invalid values are
/// dropped instead of being uploaded as a prompt, path, or command argument.
pub fn normalize_identity_reference(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() || value.len() > MAX_IDENTITY_REFERENCE_BYTES {
        return None;
    }
    value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
        .then(|| value.to_string())
}

pub fn normalize_identity_status(value: Option<&str>) -> Option<String> {
    let value = value?.trim().to_ascii_lowercase();
    matches!(
        value.as_str(),
        "confirmed" | "partial" | "conflict" | "unavailable"
    )
    .then_some(value)
}

pub fn normalize_identity_reason(value: Option<&str>) -> Option<String> {
    let value = value?.trim().to_ascii_lowercase();
    matches!(
        value.as_str(),
        REASON_MISSING_AGENT
            | REASON_MISSING_PROVIDER
            | REASON_MISSING_MODEL
            | REASON_INTERNAL_MARKER
            | REASON_CONTEXT_UNAVAILABLE
            | REASON_CONFLICTING_EVIDENCE
    )
    .then_some(value)
}

pub fn normalize_identity_source(value: Option<&str>) -> Option<String> {
    let value = value?.trim().to_ascii_lowercase();
    matches!(
        value.as_str(),
        "agent_hook"
            | "mcp"
            | "structured_mcp"
            | "transcript"
            | "tool_call"
            | "turn_context"
            | "session_metadata"
    )
    .then_some(value)
}

pub fn is_placeholder(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "" | "null"
            | "undefined"
            | "unknown"
            | "<unknown>"
            | "none"
            | "n/a"
            | "na"
            | "not reported"
            | "not available"
            | "model_not_reported"
            | "provider_not_reported"
            | "no model"
            | "no provider"
            | "model not reported"
            | "provider not reported"
            | "unattributed"
    )
}

pub fn is_internal_marker(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "<synthetic>" | "synthetic" | "internal model marker" | "internal_model_marker"
    )
}

/// Resolve one identity tuple. `provider_candidates` and `model_candidates` are
/// ordered evidence from the direct tool call/turn/session layers. Distinct
/// non-empty normalized values are a conflict; the resolver never silently picks
/// the newest value.
pub fn resolve_identity(
    agent: Option<&str>,
    provider_candidates: &[Option<&str>],
    model_candidates: &[Option<&str>],
    source: Option<&str>,
    confidence: Option<&str>,
) -> IdentityResolution {
    let normalized_agent = normalize_agent(agent);
    let (provider, provider_conflict, provider_marker) = collect_provider(provider_candidates);
    let (model, model_conflict, model_marker) = collect_model(model_candidates);
    let source = normalize_identity_source(source);
    let has_any = normalized_agent.is_some() || provider.is_some() || model.is_some();
    let trusted_source = source.as_deref().is_some_and(|value| {
        matches!(
            value,
            "agent_hook" | "mcp" | "structured_mcp" | "transcript" | "tool_call" | "turn_context"
        )
    });
    let trusted_confidence = confidence.is_some_and(|value| {
        value.trim().eq_ignore_ascii_case("verified")
            || value.trim().eq_ignore_ascii_case("correlated")
    });

    let reason = if provider_conflict || model_conflict {
        Some(REASON_CONFLICTING_EVIDENCE)
    } else if provider_marker || model_marker {
        Some(REASON_INTERNAL_MARKER)
    } else if !has_any {
        Some(REASON_CONTEXT_UNAVAILABLE)
    } else if normalized_agent.is_none() {
        Some(REASON_MISSING_AGENT)
    } else if provider.is_none() {
        Some(REASON_MISSING_PROVIDER)
    } else if model.is_none() {
        Some(REASON_MISSING_MODEL)
    } else if !trusted_source || !trusted_confidence {
        Some(REASON_CONTEXT_UNAVAILABLE)
    } else {
        None
    };

    // A conflict is useful as a diagnostic, but a value chosen from one side of
    // that conflict must never be presented as the canonical provider/model. The
    // raw candidates stay local to the parser/repair report.
    let (provider, model) = if provider_conflict || model_conflict {
        (None, None)
    } else {
        (provider, model)
    };

    let status = if provider_conflict || model_conflict {
        IdentityStatus::Conflict
    } else if normalized_agent.is_some()
        && provider.is_some()
        && model.is_some()
        && trusted_source
        && trusted_confidence
    {
        IdentityStatus::Confirmed
    } else if has_any {
        IdentityStatus::Partial
    } else {
        // A trusted transport by itself only proves where the record came from;
        // it does not identify an agent/provider/model. Keep that distinction so
        // source-only or marker-only rows land in the unavailable bucket.
        IdentityStatus::Unavailable
    };

    IdentityResolution {
        status,
        reason,
        source,
        agent: normalized_agent,
        provider,
        model,
    }
}

fn collect_provider(values: &[Option<&str>]) -> (Option<String>, bool, bool) {
    let mut normalized = Vec::new();
    let mut marker = false;
    for value in values.iter().flatten() {
        if is_internal_marker(value) {
            marker = true;
        }
        if let Some(value) = normalize_provider(Some(value)) {
            if !normalized.contains(&value) {
                normalized.push(value);
            }
        }
    }
    let conflict = normalized.len() > 1;
    (normalized.into_iter().next(), conflict, marker)
}

fn collect_model(values: &[Option<&str>]) -> (Option<String>, bool, bool) {
    let mut normalized = Vec::new();
    let mut marker = false;
    for value in values.iter().flatten() {
        if is_internal_marker(value) {
            marker = true;
        }
        if let Some(value) = normalize_model(Some(value)) {
            if !normalized.contains(&value) {
                normalized.push(value);
            }
        }
    }
    let conflict = normalized.len() > 1;
    (normalized.into_iter().next(), conflict, marker)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markers_and_placeholders_are_missing_with_reason() {
        let result = resolve_identity(
            Some("codex"),
            &[Some("openai")],
            &[Some("<synthetic>")],
            Some("transcript"),
            Some("verified"),
        );
        assert_eq!(result.status, IdentityStatus::Partial);
        assert_eq!(result.reason, Some(REASON_INTERNAL_MARKER));
        assert_eq!(result.model, None);
    }

    #[test]
    fn complete_identity_requires_provider_and_model_evidence() {
        let result = resolve_identity(
            Some("codex"),
            &[Some("https://api.openai.com/v1")],
            &[Some("gpt-5.6-sol")],
            Some("transcript"),
            Some("verified"),
        );
        assert_eq!(result.status, IdentityStatus::Confirmed);
        assert_eq!(result.provider.as_deref(), Some("openai"));
    }

    #[test]
    fn conflicting_turn_evidence_is_not_resolved_by_last_value() {
        let result = resolve_identity(
            Some("codex"),
            &[Some("openai"), Some("anthropic")],
            &[Some("gpt-5.6-sol")],
            Some("turn_context"),
            Some("verified"),
        );
        assert_eq!(result.status, IdentityStatus::Conflict);
        assert_eq!(result.reason, Some(REASON_CONFLICTING_EVIDENCE));
        assert!(result.provider.is_none());
        assert!(result.model.is_none());
    }

    #[test]
    fn no_identity_evidence_has_context_reason() {
        let result = resolve_identity(None, &[], &[], None, None);
        assert_eq!(result.status, IdentityStatus::Unavailable);
        assert_eq!(result.reason, Some(REASON_CONTEXT_UNAVAILABLE));
    }

    #[test]
    fn trusted_source_without_identity_is_still_unavailable() {
        let result = resolve_identity(None, &[], &[], Some("transcript"), Some("verified"));
        assert_eq!(result.status, IdentityStatus::Unavailable);
        assert_eq!(result.reason, Some(REASON_CONTEXT_UNAVAILABLE));
    }

    #[test]
    fn unknown_provider_is_not_promoted_to_a_confirmed_tuple() {
        let result = resolve_identity(
            Some("codex"),
            &[Some("private-proxy")],
            &[Some("new-model-2026")],
            Some("transcript"),
            Some("verified"),
        );
        assert_eq!(result.status, IdentityStatus::Partial);
        assert_eq!(result.reason, Some(REASON_MISSING_PROVIDER));
        assert!(result.provider.is_none());
        assert_eq!(result.model.as_deref(), Some("new-model-2026"));
    }
}

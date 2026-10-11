//! Implementation inventory, independent from runtime detection/certification.
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActivityCapability {
    pub surface: String,
    pub metric: String,
    pub code_status: String,
    pub reason: String,
    pub channel: String,
    pub live_certification: String,
    pub provider_version: Option<String>,
    /// Code installation surfaces; native/live certification remains separate.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installation_platforms: Option<Vec<String>>,
}
pub fn for_adapter(id: &str) -> Vec<ActivityCapability> {
    let surfaces: &[&str] = match id {
        "codex" => &["cli", "ide", "desktop"],
        "cursor" | "copilot" => &["ide", "inline"],
        "kilo-code" => &["cli", "ide"],
        "generic-mcp" => &["mcp"],
        "windsurf" | "cline" | "roo-code" | "antigravity" => &["ide"],
        _ => &["cli"],
    };
    let mut result = Vec::new();
    for surface in surfaces {
        for metric in [
            "activity_markers",
            "measured_tool_intervals",
            "file_edits",
            "usage_tokens",
            "cost",
            "session_identity",
            "inline_counters",
        ] {
            let native_markers = matches!(
                id,
                "codex"
                    | "claude-code"
                    | "gemini-cli"
                    | "cursor"
                    | "copilot"
                    | "kilo-code"
                    | "cline"
            ) && *surface != "inline"
                && (id != "codex" || *surface == "cli");
            let implemented = match metric {
                "activity_markers" | "session_identity" => native_markers || id == "generic-mcp",
                "measured_tool_intervals" => {
                    id == "codex" && *surface == "cli" || id == "generic-mcp"
                }
                "file_edits" => {
                    matches!(
                        id,
                        "codex" | "claude-code" | "gemini-cli" | "kilo-code" | "kimi-code-cli"
                    ) && (id != "codex" || *surface == "cli")
                        || id == "generic-mcp"
                }
                "usage_tokens" | "cost" => {
                    matches!(id, "codex" | "claude-code" | "gemini-cli")
                        && (id != "codex" || *surface == "cli")
                }
                _ => false,
            };
            let reason = if id == "deep-code" {
                "product_identity_unconfirmed"
            } else if implemented && id == "generic-mcp" {
                "explicit_producer_contract_only"
            } else if implemented
                && id == "kilo-code"
                && matches!(metric, "activity_markers" | "session_identity")
            {
                "explicit_activity_surface_configuration_required"
            } else if implemented {
                if id == "cline" {
                    "macos_hook_setup_windows_contract_evidence_pending"
                } else {
                    "requires_metric_and_version_live_evidence"
                }
            } else if metric == "measured_tool_intervals" && native_markers {
                "markers_do_not_prove_permission_free_execution_interval"
            } else if id == "copilot" && matches!(metric, "usage_tokens" | "cost") {
                "provider_metric_evidence_pending_daily_not_session"
            } else {
                "native_metric_pipeline_evidence_pending"
            };
            result.push(ActivityCapability {
                surface: (*surface).into(),
                metric: metric.into(),
                code_status: if implemented {
                    "implemented"
                } else {
                    "evidence_pending"
                }
                .into(),
                reason: reason.into(),
                channel: if id == "generic-mcp" {
                    "explicit_activity_v3"
                } else if native_markers {
                    "native_metadata_or_transcript"
                } else {
                    "contract_verification_pending"
                }
                .into(),
                live_certification: "pending".into(),
                provider_version: None,
                installation_platforms: (id == "cline" && implemented)
                    .then(|| vec!["macos".into()]),
            });
        }
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exactly_the_registry_adapters_have_separate_metric_dispositions() {
        let registry = super::super::AdapterRegistry::builtin();
        assert_eq!(registry.manifests().len(), 14);
        for adapter in registry.manifests() {
            let capabilities = for_adapter(&adapter.id);
            assert!(!capabilities.is_empty());
            assert!(capabilities
                .iter()
                .all(|c| c.provider_version.is_none() && c.live_certification == "pending"));
        }
        assert!(for_adapter("deep-code")
            .iter()
            .all(|c| c.reason == "product_identity_unconfirmed"));
        assert!(for_adapter("cursor")
            .iter()
            .filter(|c| c.surface == "inline")
            .all(|c| c.code_status != "implemented"));
    }
}

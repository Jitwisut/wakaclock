//! Implementation inventory, independent from runtime detection/certification.
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OperatingSystemCapability {
    pub operating_system: String,
    pub development_status: String,
    pub runtime_status: String,
    pub certification_status: String,
    pub reason: String,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActivityCapability {
    pub surface: String,
    pub metric: String,
    pub code_status: String,
    /// Independent dimensions: implementation is not proof of a running provider.
    #[serde(default)]
    pub development_status: String,
    #[serde(default)]
    pub runtime_status: String,
    #[serde(default)]
    pub certification_status: String,
    #[serde(default)]
    pub operating_systems: Vec<String>,
    #[serde(default)]
    pub os_capabilities: Vec<OperatingSystemCapability>,
    #[serde(default)]
    pub contract_version: Option<String>,
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
        "cursor" => &["ide", "inline"],
        "copilot" => &["cli", "ide", "inline", "daily_api"],
        "kilo-code" => &["cli", "ide"],
        "generic-mcp" => &["mcp"],
        "windsurf" | "cline" | "roo-code" | "antigravity" => &["ide"],
        _ => &["cli"],
    };
    let mut result = Vec::new();
    for surface in surfaces {
        let mut metrics = vec![
            "activity_markers",
            "measured_tool_intervals",
            "file_edits",
            "usage_tokens",
            "cost",
            "session_identity",
            "inline_counters",
        ];
        if id == "copilot" && *surface == "daily_api" {
            metrics.push("daily_feature_counters");
        }
        for metric in metrics {
            let native_markers = matches!(
                id,
                "codex"
                    | "claude-code"
                    | "gemini-cli"
                    | "cursor"
                    | "copilot"
                    | "kilo-code"
                    | "cline"
                    | "kimi-code-cli"
                    | "opencode"
                    | "antigravity"
                    | "roo-code"
            ) && *surface != "inline"
                && (id != "codex" || *surface == "cli")
                && (id != "copilot" || matches!(*surface, "cli" | "ide"));
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
                        || id == "cursor"
                }
                "usage_tokens" | "cost" => {
                    matches!(id, "codex" | "claude-code" | "gemini-cli")
                        && (id != "codex" || *surface == "cli")
                }
                "daily_feature_counters" => id == "copilot" && *surface == "daily_api",
                _ => false,
            };
            let provider_unavailable = id == "copilot"
                && (*surface == "daily_api" && metric != "daily_feature_counters"
                    || *surface == "inline");
            let reason = if provider_unavailable && *surface == "daily_api" {
                "daily_counters_not_event_session_token_model_or_cost_facts"
            } else if provider_unavailable {
                "no_verified_public_cross_extension_copilot_inline_acceptance_contract"
            } else if id == "deep-code" {
                "product_identity_unconfirmed"
            } else if implemented && id == "generic-mcp" {
                "explicit_producer_contract_only"
            } else if implemented
                && id == "kilo-code"
                && matches!(metric, "activity_markers" | "session_identity")
            {
                "explicit_activity_surface_configuration_required"
            } else if implemented && id == "cursor" && metric == "file_edits" {
                "documented_completed_edit_fragments_only_live_evidence_pending"
            } else if implemented && id == "roo-code" {
                "public_task_identity_user_confirmed_project_effective_forward_live_pending"
            } else if implemented && id == "copilot" && *surface == "daily_api" {
                "provider_user_day_feature_only_requires_existing_organization_metrics_permission"
            } else if implemented {
                if id == "opencode" {
                    "native_plugin_v1_1_19_0_v2_2_0_26_live_evidence_pending"
                } else if id == "cline" {
                    "cline_4_1_23_powershell_and_unix_owned_hooks_live_pending"
                } else {
                    "requires_metric_and_version_live_evidence"
                }
            } else if metric == "measured_tool_intervals" && native_markers {
                "markers_do_not_prove_permission_free_execution_interval"
            } else if id == "copilot" && matches!(metric, "usage_tokens" | "cost") {
                "provider_metric_evidence_pending_daily_not_session"
            } else if id == "roo-code" {
                "public_task_events_without_verified_task_project_binding"
            } else if id == "windsurf" {
                "cascade_contract_product_version_confirmation_pending"
            } else {
                "native_metric_pipeline_evidence_pending"
            };
            result.push(ActivityCapability {
                surface: (*surface).into(),
                metric: metric.into(),
                code_status: if provider_unavailable {
                    "unavailable"
                } else if implemented {
                    "implemented"
                } else {
                    "evidence_pending"
                }
                .into(),
                development_status: if implemented {
                    "implemented"
                } else if provider_unavailable {
                    "unavailable"
                } else {
                    "not_implemented"
                }
                .into(),
                runtime_status: "unconfirmed".into(),
                certification_status: "pending".into(),
                operating_systems: vec!["macos".into(), "windows".into()],
                os_capabilities: ["macos", "windows"]
                    .into_iter()
                    .map(|os| OperatingSystemCapability {
                        operating_system: os.into(),
                        development_status: if provider_unavailable {
                            "unavailable"
                        } else if !implemented {
                            "not_implemented"
                        } else {
                            "implemented"
                        }
                        .into(),
                        runtime_status: "unconfirmed".into(),
                        certification_status: "pending".into(),
                        reason: reason.into(),
                    })
                    .collect(),
                contract_version: implemented.then(|| {
                    match metric {
                        "file_edits" => "broker_file_change_v1",
                        "usage_tokens" | "cost" => "canonical_usage_metadata_v1",
                        "daily_feature_counters" => "github_copilot_users_1_day_2026_03_10",
                        _ if id == "roo-code" => "roo_public_3.53.0_user_confirmed_project",
                        _ if id == "opencode" => {
                            "activity_v3:opencode-v1-1.19.0|opencode-v2-2.0.26"
                        }
                        _ if id == "codex" => "codex_activity_v2",
                        _ => "activity_v3:native_hook_v1",
                    }
                    .into()
                }),
                reason: reason.into(),
                channel: if id == "copilot" && *surface == "daily_api" {
                    "github_installation_users_1_day"
                } else if id == "cursor" && *surface == "inline" {
                    "afterTabFileEdit"
                } else if id == "generic-mcp" {
                    "explicit_activity_v3"
                } else if native_markers {
                    "native_metadata_or_transcript"
                } else {
                    "contract_verification_pending"
                }
                .into(),
                live_certification: "pending".into(),
                provider_version: (id == "roo-code").then(|| "3.53.0".into()),
                installation_platforms: (id == "cline" && implemented)
                    .then(|| vec!["macos".into(), "windows".into()]),
            });
        }
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn no_runtime_or_certification_is_inferred_from_implementation() {
        for id in ["codex", "copilot", "cline", "deep-code"] {
            for c in for_adapter(id) {
                assert_eq!(c.runtime_status, "unconfirmed");
                assert_eq!(c.certification_status, "pending");
                assert_eq!(
                    matches!(c.development_status.as_str(), "implemented" | "partial"),
                    c.code_status == "implemented"
                );
                assert_eq!(c.os_capabilities.len(), 2);
                assert!(c
                    .os_capabilities
                    .iter()
                    .all(|os| os.certification_status == "pending"
                        && os.runtime_status == "unconfirmed"));
            }
        }
        for c in for_adapter("copilot")
            .into_iter()
            .filter(|c| !matches!(c.surface.as_str(), "cli" | "ide"))
        {
            assert_eq!(
                c.development_status,
                if c.metric == "daily_feature_counters" {
                    "implemented"
                } else {
                    "unavailable"
                }
            );
        }
    }
    #[test]
    fn exactly_the_registry_adapters_have_separate_metric_dispositions() {
        let registry = super::super::AdapterRegistry::builtin();
        // 14 hook/manual adapters plus 5 transcript-only ones (qwen-code, pi, kiro,
        // factory-droid, ibm-bob) added with the Tier 2 parsers.
        assert_eq!(registry.manifests().len(), 20);
        for adapter in registry.manifests() {
            let capabilities = for_adapter(&adapter.id);
            assert!(!capabilities.is_empty());
            assert!(capabilities.iter().all(|c| (c.provider_version.is_none()
                || adapter.id == "roo-code")
                && c.live_certification == "pending"));
        }
        assert!(for_adapter("deep-code")
            .iter()
            .all(|c| c.reason == "product_identity_unconfirmed"));
        assert!(for_adapter("cursor")
            .iter()
            .filter(|c| c.surface == "inline")
            .all(
                |c| (c.metric == "file_edits" && c.development_status == "implemented")
                    || (c.metric != "file_edits" && c.code_status != "implemented")
            ));
    }
}

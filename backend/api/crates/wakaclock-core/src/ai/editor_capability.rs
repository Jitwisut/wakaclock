//! F7-05 editor capability inventory.
//!
//! Editor telemetry and AI provenance are separate evidence surfaces. An editor can
//! report a document change without knowing whether it came from a person, a formatter,
//! an inline completion, or a remote agent. This catalog is intentionally descriptive:
//! it helps setup/diagnostics explain what a surface can observe, but it never upgrades
//! a generic document change to AI authorship.

use serde::{Deserialize, Serialize};

use super::topology::{EditorSurface, ExecutionSurface};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityStatus {
    Implemented,
    InventoryOnly,
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InputEvidence {
    /// The integration receives editor callbacks that establish a human-input
    /// window, subject to the editor's documented API limits.
    EditorInputWindow,
    /// Only generic document lifecycle/change notifications are available; they
    /// must remain human/unknown until another evidence source decides ownership.
    GenericDocumentChange,
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AiEvidence {
    NativeHook,
    Transcript,
    Sidecar,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EditorCapability {
    pub editor: EditorSurface,
    pub status: CapabilityStatus,
    pub input_evidence: InputEvidence,
    pub ai_evidence: AiEvidence,
    pub supported_execution: Vec<ExecutionSurface>,
    pub notes: String,
}

impl EditorCapability {
    /// Whether this catalog row has a separate AI provenance surface. The editor
    /// event itself remains insufficient to claim authorship.
    pub fn has_separate_ai_evidence(&self) -> bool {
        !matches!(self.ai_evidence, AiEvidence::None)
    }

    /// Backwards-compatible alias for callers that used the first local F7
    /// inventory name. It deliberately delegates to the separate-evidence
    /// predicate rather than treating an editor callback as proof.
    pub fn can_prove_ai_from_editor_event(&self) -> bool {
        self.has_separate_ai_evidence()
    }
}

/// The inventory is kept in code so CLI, diagnostics and future setup surfaces can
/// present the same capability truth. It is not a certification catalog: a native
/// hook still requires a live tuple certificate before a runtime is advertised as
/// verified.
pub fn editor_capability_catalog() -> Vec<EditorCapability> {
    vec![
        EditorCapability {
            editor: EditorSurface::Vscode,
            status: CapabilityStatus::Implemented,
            input_evidence: InputEvidence::EditorInputWindow,
            ai_evidence: AiEvidence::Sidecar,
            supported_execution: vec![
                ExecutionSurface::Local,
                ExecutionSurface::RemoteExtensionHost,
                ExecutionSurface::DevContainer,
            ],
            notes: "VS Code buffer events and metadata-only AI sidecar are implemented; remote/container rows still need topology certification.".to_string(),
        },
        EditorCapability {
            editor: EditorSurface::Zed,
            status: CapabilityStatus::Implemented,
            input_evidence: InputEvidence::GenericDocumentChange,
            ai_evidence: AiEvidence::None,
            supported_execution: vec![ExecutionSurface::Local],
            notes: "Zed integration uses LSP open/change/save notifications. Generic LSP changes do not identify an AI author.".to_string(),
        },
        EditorCapability {
            editor: EditorSurface::Jetbrains,
            status: CapabilityStatus::InventoryOnly,
            input_evidence: InputEvidence::None,
            ai_evidence: AiEvidence::None,
            supported_execution: Vec::new(),
            notes: "No first-party producer is wired yet; survey plugin, save, inline-completion and external-agent surfaces before implementation.".to_string(),
        },
        EditorCapability {
            editor: EditorSurface::Neovim,
            status: CapabilityStatus::InventoryOnly,
            input_evidence: InputEvidence::None,
            ai_evidence: AiEvidence::None,
            supported_execution: Vec::new(),
            notes: "No first-party producer is wired yet; generic autocmd/LSP events are insufficient for AI attribution without explicit provenance.".to_string(),
        },
        EditorCapability {
            editor: EditorSurface::Lsp,
            status: CapabilityStatus::InventoryOnly,
            input_evidence: InputEvidence::GenericDocumentChange,
            ai_evidence: AiEvidence::None,
            supported_execution: vec![ExecutionSurface::Local, ExecutionSurface::RemoteExtensionHost],
            notes: "LSP is a transport, not an authorship signal. Producers must supply a separate hook or transcript identity.".to_string(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_contains_the_surfaces_f7_must_survey() {
        let catalog = editor_capability_catalog();
        for editor in [
            EditorSurface::Vscode,
            EditorSurface::Zed,
            EditorSurface::Jetbrains,
            EditorSurface::Neovim,
            EditorSurface::Lsp,
        ] {
            assert!(catalog.iter().any(|entry| entry.editor == editor));
        }
    }

    #[test]
    fn generic_lsp_and_zed_events_never_claim_ai_authorship() {
        let catalog = editor_capability_catalog();
        for editor in [EditorSurface::Zed, EditorSurface::Lsp] {
            let entry = catalog.iter().find(|entry| entry.editor == editor).unwrap();
            assert_eq!(entry.input_evidence, InputEvidence::GenericDocumentChange);
            assert!(!entry.can_prove_ai_from_editor_event());
        }
    }

    #[test]
    fn unsupported_editor_is_not_promoted_by_its_name() {
        let jetbrains = editor_capability_catalog()
            .into_iter()
            .find(|entry| entry.editor == EditorSurface::Jetbrains)
            .unwrap();
        assert_eq!(jetbrains.status, CapabilityStatus::InventoryOnly);
        assert!(!jetbrains.can_prove_ai_from_editor_event());
    }

    #[test]
    fn only_vscode_has_a_current_editor_sidecar_claim() {
        let catalog = editor_capability_catalog();
        assert!(catalog.iter().any(|entry| {
            entry.editor == EditorSurface::Vscode
                && entry.ai_evidence == AiEvidence::Sidecar
                && entry.can_prove_ai_from_editor_event()
        }));
        assert!(catalog
            .iter()
            .filter(|entry| entry.editor != EditorSurface::Vscode)
            .all(|entry| entry.ai_evidence != AiEvidence::Sidecar));
    }
}

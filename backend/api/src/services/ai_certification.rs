//! Server-owned AI adapter certification lookup.
//!
//! Diagnostics are observations.  This service is the authority that decides
//! whether a reported runtime tuple has a reviewed, current certification.

use std::sync::Arc;

use chrono::Utc;
use wakaclock_core::ai::{
    CertificationCatalogV1, CertificationDecision, CertificationDecisionStatus, CertificationTuple,
    VerificationStatus,
};

#[derive(Clone)]
pub struct AiCertificationService {
    catalog: Arc<CertificationCatalogV1>,
}

impl AiCertificationService {
    pub fn builtin() -> Result<Self, String> {
        Ok(Self {
            catalog: Arc::new(CertificationCatalogV1::builtin()?),
        })
    }

    /// Constructor used by conformance tests and future signed-catalog reloads.
    #[allow(dead_code)]
    pub fn from_catalog(catalog: CertificationCatalogV1) -> Result<Self, String> {
        catalog.validate()?;
        Ok(Self {
            catalog: Arc::new(catalog),
        })
    }

    pub fn resolve(&self, tuple: &CertificationTuple) -> CertificationDecision {
        self.catalog.resolve(tuple, Utc::now())
    }

    /// Apply a server-owned decision to the legacy diagnostics enum.  A client
    /// supplied `verified` value is intentionally ignored by this mapping.
    pub fn effective_status(
        &self,
        claimed: VerificationStatus,
        tuple: Option<&CertificationTuple>,
    ) -> (VerificationStatus, Option<String>, Option<String>) {
        let Some(tuple) = tuple else {
            return (
                if claimed == VerificationStatus::Verified {
                    VerificationStatus::Scaffold
                } else {
                    claimed
                },
                None,
                (claimed == VerificationStatus::Verified)
                    .then(|| "certification_required".to_string()),
            );
        };
        let decision = self.resolve(tuple);
        let (status, reason) = match decision.status {
            CertificationDecisionStatus::Verified => {
                (VerificationStatus::Verified, Some("certification_verified"))
            }
            CertificationDecisionStatus::Unverified => (
                VerificationStatus::Scaffold,
                Some("certification_unverified"),
            ),
            CertificationDecisionStatus::Historical => (
                VerificationStatus::Scaffold,
                Some("certification_historical"),
            ),
            CertificationDecisionStatus::Expired => {
                (VerificationStatus::Scaffold, Some("certification_expired"))
            }
            CertificationDecisionStatus::Revoked => {
                (VerificationStatus::Scaffold, Some("certification_revoked"))
            }
            CertificationDecisionStatus::Invalid => {
                (VerificationStatus::Scaffold, Some("certification_invalid"))
            }
            CertificationDecisionStatus::Mismatch => {
                (VerificationStatus::Scaffold, Some("certification_mismatch"))
            }
            CertificationDecisionStatus::Scaffold => {
                (VerificationStatus::Scaffold, Some("certification_required"))
            }
        };
        (status, decision.certificate_id, reason.map(str::to_string))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{DateTime, Utc};
    use wakaclock_core::ai::{
        CertificationCatalogEntry, CertificationCatalogV1, CertificationTuple,
        CERTIFICATION_CATALOG_SCHEMA_VERSION,
    };

    fn tuple() -> CertificationTuple {
        CertificationTuple {
            adapter_id: "codex".to_string(),
            client_id: "codex".to_string(),
            provider_id: "openai".to_string(),
            model_id: Some("gpt-5.6-sol".to_string()),
            tool_version: Some("0.151.0".to_string()),
            producer_version: Some("0.1.0".to_string()),
            runtime: Some("cli".to_string()),
            os: Some("darwin".to_string()),
            arch: Some("arm64".to_string()),
            edit_modes: vec!["native_single_file".to_string()],
            payload_schema_versions: vec!["response_item".to_string()],
            contract_version: "producer-v1".to_string(),
            fingerprint_version: "caf1".to_string(),
            corpus_version: Some("ground-truth-v1".to_string()),
        }
    }

    fn service(review_status: &str, promotable: bool) -> AiCertificationService {
        let entry = CertificationCatalogEntry {
            certificate_id: "codex-test".to_string(),
            status: VerificationStatus::Verified,
            review_status: review_status.to_string(),
            promotable,
            tuple: tuple(),
            evidence_kind: "live".to_string(),
            checked_at_utc: DateTime::parse_from_rfc3339("2026-09-05T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            expires_at_utc: DateTime::parse_from_rfc3339("2099-09-05T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            artifact_sha256: Some("a".repeat(64)),
            evidence_digest: Some("b".repeat(64)),
            build_sha256: Some("c".repeat(64)),
        };
        AiCertificationService::from_catalog(CertificationCatalogV1 {
            schema_version: CERTIFICATION_CATALOG_SCHEMA_VERSION,
            catalog_version: "test".to_string(),
            generated_at_utc: Utc::now(),
            entries: vec![entry],
            revocations: vec![],
        })
        .unwrap()
    }

    #[test]
    fn client_verified_is_ignored_without_exact_reviewed_tuple() {
        let service = service("pending", false);
        let (status, certificate, reason) =
            service.effective_status(VerificationStatus::Verified, Some(&tuple()));
        assert_eq!(status, VerificationStatus::Scaffold);
        assert_eq!(certificate.as_deref(), Some("codex-test"));
        assert_eq!(reason.as_deref(), Some("certification_required"));
    }

    #[test]
    fn reviewed_exact_tuple_promotes() {
        let service = service("approved", true);
        let (status, certificate, reason) =
            service.effective_status(VerificationStatus::Scaffold, Some(&tuple()));
        assert_eq!(status, VerificationStatus::Verified);
        assert_eq!(certificate.as_deref(), Some("codex-test"));
        assert_eq!(reason.as_deref(), Some("certification_verified"));
    }
}

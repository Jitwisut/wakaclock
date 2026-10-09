//! Server-owned certification records for AI adapter capability claims.
//!
//! A client may report that it observed an adapter, but it cannot turn that
//! observation into a certification.  Certification is a reviewed release
//! artifact with an exact runtime tuple.  This module contains the small,
//! dependency-free resolver used by the API and by conformance tests.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::VerificationStatus;

pub const CERTIFICATION_CATALOG_SCHEMA_VERSION: u8 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct CertificationTuple {
    pub adapter_id: String,
    pub client_id: String,
    pub provider_id: String,
    #[serde(default)]
    pub model_id: Option<String>,
    #[serde(default)]
    pub tool_version: Option<String>,
    #[serde(default)]
    pub producer_version: Option<String>,
    #[serde(default)]
    pub runtime: Option<String>,
    #[serde(default)]
    pub os: Option<String>,
    #[serde(default)]
    pub arch: Option<String>,
    #[serde(default)]
    pub edit_modes: Vec<String>,
    #[serde(default)]
    pub payload_schema_versions: Vec<String>,
    pub contract_version: String,
    pub fingerprint_version: String,
    #[serde(default)]
    pub corpus_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CertificationCatalogEntry {
    pub certificate_id: String,
    pub status: VerificationStatus,
    pub review_status: String,
    pub promotable: bool,
    pub tuple: CertificationTuple,
    pub evidence_kind: String,
    pub checked_at_utc: DateTime<Utc>,
    pub expires_at_utc: DateTime<Utc>,
    #[serde(default)]
    pub artifact_sha256: Option<String>,
    #[serde(default)]
    pub evidence_digest: Option<String>,
    #[serde(default)]
    pub build_sha256: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CertificationRevocation {
    pub certificate_id: String,
    #[serde(default)]
    pub artifact_sha256: Option<String>,
    pub reason_code: String,
    pub revoked_at_utc: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CertificationCatalogV1 {
    pub schema_version: u8,
    pub catalog_version: String,
    pub generated_at_utc: DateTime<Utc>,
    pub entries: Vec<CertificationCatalogEntry>,
    #[serde(default)]
    pub revocations: Vec<CertificationRevocation>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CertificationDecisionStatus {
    Verified,
    Scaffold,
    Unverified,
    Historical,
    Mismatch,
    Expired,
    Revoked,
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CertificationDecision {
    pub status: CertificationDecisionStatus,
    pub certificate_id: Option<String>,
    pub reason: String,
}

impl CertificationDecision {
    fn new(
        status: CertificationDecisionStatus,
        entry: Option<&CertificationCatalogEntry>,
        reason: &str,
    ) -> Self {
        Self {
            status,
            certificate_id: entry.map(|item| item.certificate_id.clone()),
            reason: reason.to_string(),
        }
    }
}

impl CertificationCatalogV1 {
    /// Load the reviewed catalog shipped with the server binary.  The resource
    /// is deliberately inside the core crate so Docker/build contexts cannot
    /// accidentally omit the authority used at runtime.
    pub fn builtin() -> Result<Self, String> {
        let catalog: Self = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/resources/ai-certifications/catalog-v1.json"
        )))
        .map_err(|error| format!("decode certification catalog: {error}"))?;
        catalog.validate()?;
        Ok(catalog)
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != CERTIFICATION_CATALOG_SCHEMA_VERSION {
            return Err(format!(
                "unsupported certification catalog schema_version={}",
                self.schema_version
            ));
        }
        if self.catalog_version.trim().is_empty() || self.catalog_version.len() > 128 {
            return Err("catalog_version must be a bounded label".to_string());
        }
        let mut ids = std::collections::HashSet::new();
        for entry in &self.entries {
            if entry.certificate_id.is_empty()
                || entry.certificate_id.len() > 128
                || !ids.insert(entry.certificate_id.clone())
            {
                return Err("certificate_id values must be unique bounded labels".to_string());
            }
            if entry.review_status != "approved"
                && entry.review_status != "pending"
                && entry.review_status != "historical"
                && entry.review_status != "revoked"
            {
                return Err(format!(
                    "unsupported review_status for {}",
                    entry.certificate_id
                ));
            }
            if entry.evidence_kind != "live"
                && entry.evidence_kind != "fixture"
                && entry.evidence_kind != "historical"
            {
                return Err(format!(
                    "unsupported evidence_kind for {}",
                    entry.certificate_id
                ));
            }
            if entry.expires_at_utc < entry.checked_at_utc {
                return Err(format!(
                    "expiry precedes checked_at for {}",
                    entry.certificate_id
                ));
            }
            if entry.promotable
                && (entry.status != VerificationStatus::Verified
                    || entry.review_status != "approved"
                    || entry.evidence_kind != "live"
                    || entry.tuple.model_id.is_none()
                    || entry.tuple.tool_version.is_none()
                    || entry.tuple.producer_version.is_none()
                    || entry.tuple.runtime.is_none()
                    || entry.tuple.os.is_none()
                    || entry.tuple.arch.is_none()
                    || entry.tuple.corpus_version.is_none()
                    || entry.tuple.edit_modes.is_empty()
                    || entry.tuple.payload_schema_versions.is_empty()
                    || entry.artifact_sha256.is_none()
                    || entry.evidence_digest.is_none()
                    || entry.build_sha256.is_none())
            {
                return Err(format!(
                    "promotable certification {} is incomplete",
                    entry.certificate_id
                ));
            }
            validate_tuple(&entry.tuple)
                .map_err(|error| format!("invalid tuple for {}: {error}", entry.certificate_id))?;
        }
        for revocation in &self.revocations {
            if !ids.contains(&revocation.certificate_id) {
                return Err(format!(
                    "revocation references unknown certificate {}",
                    revocation.certificate_id
                ));
            }
            if revocation.reason_code.is_empty() || revocation.reason_code.len() > 128 {
                return Err("revocation reason_code must be a bounded label".to_string());
            }
        }
        Ok(())
    }

    pub fn resolve(&self, tuple: &CertificationTuple, now: DateTime<Utc>) -> CertificationDecision {
        if validate_tuple(tuple).is_err() {
            return CertificationDecision::new(
                CertificationDecisionStatus::Invalid,
                None,
                "certification_tuple_invalid",
            );
        }
        let Some(entry) = self
            .entries
            .iter()
            .find(|entry| tuple_matches(tuple, &entry.tuple))
        else {
            return CertificationDecision::new(
                CertificationDecisionStatus::Mismatch,
                None,
                "certification_tuple_mismatch",
            );
        };
        if self.revocations.iter().any(|revocation| {
            revocation.certificate_id == entry.certificate_id
                || (revocation.artifact_sha256.is_some()
                    && revocation.artifact_sha256 == entry.artifact_sha256)
        }) {
            return CertificationDecision::new(
                CertificationDecisionStatus::Revoked,
                Some(entry),
                "certification_revoked",
            );
        }
        if entry.expires_at_utc <= now {
            return CertificationDecision::new(
                CertificationDecisionStatus::Expired,
                Some(entry),
                "certification_expired",
            );
        }
        if entry.review_status == "historical" || entry.evidence_kind == "historical" {
            return CertificationDecision::new(
                CertificationDecisionStatus::Historical,
                Some(entry),
                "certification_historical",
            );
        }
        if entry.promotable
            && entry.status == VerificationStatus::Verified
            && entry.review_status == "approved"
            && entry.evidence_kind == "live"
        {
            return CertificationDecision::new(
                CertificationDecisionStatus::Verified,
                Some(entry),
                "certification_verified",
            );
        }
        if entry.status == VerificationStatus::Unsupported {
            CertificationDecision::new(
                CertificationDecisionStatus::Unverified,
                Some(entry),
                "certification_unverified",
            )
        } else {
            CertificationDecision::new(
                CertificationDecisionStatus::Scaffold,
                Some(entry),
                "certification_not_promoted",
            )
        }
    }
}

fn validate_tuple(tuple: &CertificationTuple) -> Result<(), String> {
    for (field, value) in [
        ("adapter_id", &tuple.adapter_id),
        ("client_id", &tuple.client_id),
        ("provider_id", &tuple.provider_id),
        ("contract_version", &tuple.contract_version),
        ("fingerprint_version", &tuple.fingerprint_version),
    ] {
        if value.is_empty() || value.len() > 128 || !is_safe_label(value) {
            return Err(format!("{field} is invalid"));
        }
    }
    for (field, value) in [
        ("model_id", tuple.model_id.as_ref()),
        ("tool_version", tuple.tool_version.as_ref()),
        ("producer_version", tuple.producer_version.as_ref()),
        ("runtime", tuple.runtime.as_ref()),
        ("os", tuple.os.as_ref()),
        ("arch", tuple.arch.as_ref()),
        ("corpus_version", tuple.corpus_version.as_ref()),
    ] {
        if let Some(value) = value {
            if value.is_empty() || value.len() > 256 || !is_safe_label(value) {
                return Err(format!("{field} is invalid"));
            }
        }
    }
    if tuple.edit_modes.is_empty() || tuple.payload_schema_versions.is_empty() {
        return Err("edit_modes and payload_schema_versions must not be empty".to_string());
    }
    if tuple.edit_modes.iter().any(|value| !is_safe_label(value))
        || tuple
            .payload_schema_versions
            .iter()
            .any(|value| !is_safe_label(value))
    {
        return Err("tuple capability labels are invalid".to_string());
    }
    Ok(())
}

fn is_safe_label(value: &str) -> bool {
    value.chars().all(|character| {
        character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | ':' | '/')
    })
}

fn tuple_matches(actual: &CertificationTuple, expected: &CertificationTuple) -> bool {
    actual.adapter_id == expected.adapter_id
        && actual.client_id == expected.client_id
        && actual.provider_id == expected.provider_id
        && actual.model_id == expected.model_id
        && actual.tool_version == expected.tool_version
        && actual.producer_version == expected.producer_version
        && actual.runtime == expected.runtime
        && actual.os == expected.os
        && actual.arch == expected.arch
        && actual.contract_version == expected.contract_version
        && actual.fingerprint_version == expected.fingerprint_version
        && actual.corpus_version == expected.corpus_version
        && actual
            .edit_modes
            .iter()
            .all(|mode| expected.edit_modes.iter().any(|item| item == mode))
        && actual.payload_schema_versions.iter().all(|schema| {
            expected
                .payload_schema_versions
                .iter()
                .any(|item| item == schema)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

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

    fn catalog(entry: CertificationCatalogEntry) -> CertificationCatalogV1 {
        CertificationCatalogV1 {
            schema_version: CERTIFICATION_CATALOG_SCHEMA_VERSION,
            catalog_version: "test".to_string(),
            generated_at_utc: DateTime::parse_from_rfc3339("2026-09-06T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            entries: vec![entry],
            revocations: vec![],
        }
    }

    fn entry() -> CertificationCatalogEntry {
        CertificationCatalogEntry {
            certificate_id: "codex-test".to_string(),
            status: VerificationStatus::Verified,
            review_status: "approved".to_string(),
            promotable: true,
            tuple: tuple(),
            evidence_kind: "live".to_string(),
            checked_at_utc: DateTime::parse_from_rfc3339("2026-09-05T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            expires_at_utc: DateTime::parse_from_rfc3339("2026-10-05T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            artifact_sha256: Some("a".repeat(64)),
            evidence_digest: Some("b".repeat(64)),
            build_sha256: Some("c".repeat(64)),
        }
    }

    #[test]
    fn exact_tuple_is_verified() {
        let catalog = catalog(entry());
        assert!(catalog.validate().is_ok());
        assert_eq!(
            catalog
                .resolve(
                    &tuple(),
                    DateTime::parse_from_rfc3339("2026-09-06T00:00:00Z")
                        .unwrap()
                        .with_timezone(&Utc)
                )
                .status,
            CertificationDecisionStatus::Verified
        );
    }

    #[test]
    fn every_runtime_dimension_must_match() {
        let catalog = catalog(entry());
        let mut candidate = tuple();
        candidate.os = Some("linux".to_string());
        assert_eq!(
            catalog.resolve(&candidate, Utc::now()).status,
            CertificationDecisionStatus::Mismatch
        );
    }

    #[test]
    fn expired_and_revoked_records_fail_closed() {
        let mut expired = entry();
        expired.expires_at_utc = DateTime::parse_from_rfc3339("2026-09-05T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(
            catalog(expired)
                .resolve(
                    &tuple(),
                    DateTime::parse_from_rfc3339("2026-09-06T00:00:00Z")
                        .unwrap()
                        .with_timezone(&Utc)
                )
                .status,
            CertificationDecisionStatus::Expired
        );
        let mut revoked = catalog(entry());
        revoked.revocations.push(CertificationRevocation {
            certificate_id: "codex-test".to_string(),
            artifact_sha256: None,
            reason_code: "test".to_string(),
            revoked_at_utc: Utc::now(),
        });
        assert_eq!(
            revoked.resolve(&tuple(), Utc::now()).status,
            CertificationDecisionStatus::Revoked
        );
    }

    #[test]
    fn historical_records_never_promote() {
        let mut historical = entry();
        historical.review_status = "historical".to_string();
        historical.evidence_kind = "historical".to_string();
        historical.promotable = false;
        assert_eq!(
            catalog(historical)
                .resolve(
                    &tuple(),
                    DateTime::parse_from_rfc3339("2026-09-06T00:00:00Z")
                        .unwrap()
                        .with_timezone(&Utc)
                )
                .status,
            CertificationDecisionStatus::Historical
        );
    }

    #[test]
    fn builtin_catalog_is_valid() {
        assert!(CertificationCatalogV1::builtin().is_ok());
    }
}

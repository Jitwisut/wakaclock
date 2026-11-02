//! Evidence gates are never inferred from a successful build or an empty queue.
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::BTreeMap;

pub const REQUIRED_GATES: &[&str] = &[
    "heartbeat_canary_7_active_days",
    "login_sleep_wake_lifecycle",
    "tenant_isolation",
    "privacy_retention_review",
    "restore_drill",
    "provider_certification_macos",
    "provider_certification_windows",
    "inline_expected_ledger",
    "staging_performance",
    "github_reconciliation",
    "billing_lifecycle",
    "stripe_live_configuration",
    "three_team_14_day_trial",
    "support_incident_runbook",
];

#[derive(Serialize)]
pub struct ReleaseGate {
    pub key: &'static str,
    pub passed: bool,
    pub evidence_ref: Option<String>,
}

/// Recorded assertions are metadata, not a certification of the current build.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct EvidenceRecord {
    pub gate: String,
    pub scope: String,
    pub passed: bool,
    pub evidence_ref: String,
    pub checked_at: DateTime<Utc>,
    pub build: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
pub struct EvidenceDetail {
    pub gate: String,
    pub recorded_passed: bool,
    pub evidence_ref: String,
    pub checked_at: DateTime<Utc>,
    pub build: Option<String>,
    pub build_matches_current: Option<bool>,
    pub metadata_status: &'static str,
    pub reason: &'static str,
    pub certified: bool,
}
#[derive(Debug, Serialize)]
pub struct EvidenceDetails {
    pub schema_version: u8,
    pub local: Vec<EvidenceDetail>,
    pub external: Vec<EvidenceDetail>,
    pub unsupported_scope_present: bool,
    pub external_certification: &'static str,
}
fn sha(value: &str) -> bool {
    value.len() == 40 && value.bytes().all(|b| b.is_ascii_hexdigit())
}
pub fn evidence_details(
    rows: &[EvidenceRecord],
    current_build: Option<&str>,
    now: DateTime<Utc>,
) -> EvidenceDetails {
    let mut out = EvidenceDetails {
        schema_version: 1,
        local: vec![],
        external: vec![],
        unsupported_scope_present: false,
        external_certification: "unconfirmed",
    };
    for row in rows {
        let target = match row.scope.as_str() {
            "local" => &mut out.local,
            "external" => &mut out.external,
            _ => {
                out.unsupported_scope_present = true;
                continue;
            }
        };
        let reason = if !REQUIRED_GATES.contains(&row.gate.as_str()) {
            "gate_unrecognized"
        } else if row.evidence_ref.trim().is_empty() {
            "reference_missing"
        } else if row.checked_at > now {
            "timestamp_future"
        } else if row.checked_at < super::team_trust::cutoff(now) {
            "evidence_outside_review_window"
        } else if row.build.as_deref().is_none_or(|s| !sha(s)) {
            "build_unconfirmed"
        } else {
            "recorded_metadata_only"
        };
        let build_matches_current = row
            .build
            .as_deref()
            .filter(|s| sha(s))
            .zip(current_build.filter(|s| sha(s)))
            .map(|(a, b)| a.eq_ignore_ascii_case(b));
        target.push(EvidenceDetail {
            gate: row.gate.clone(),
            recorded_passed: row.passed,
            evidence_ref: row.evidence_ref.clone(),
            checked_at: row.checked_at,
            build: row.build.clone(),
            build_matches_current,
            metadata_status: if reason == "recorded_metadata_only" {
                "recorded"
            } else {
                "unconfirmed"
            },
            reason,
            certified: false,
        });
    }
    out
}

pub fn release_gates(evidence: &BTreeMap<String, (bool, String)>) -> Vec<ReleaseGate> {
    REQUIRED_GATES
        .iter()
        .map(|key| {
            let row = evidence.get(*key);
            ReleaseGate {
                key,
                passed: row
                    .is_some_and(|(passed, reference)| *passed && !reference.trim().is_empty()),
                evidence_ref: row.map(|(_, reference)| reference.clone()),
            }
        })
        .collect()
}

pub fn production_ready(evidence: &BTreeMap<String, (bool, String)>) -> bool {
    release_gates(evidence).iter().all(|gate| gate.passed)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn partial_and_unreferenced_evidence_never_opens_sales() {
        let mut evidence = BTreeMap::new();
        assert!(!production_ready(&evidence));
        for key in REQUIRED_GATES {
            evidence.insert(key.to_string(), (true, "staging/test-run-1".into()));
        }
        assert!(production_ready(&evidence));
        evidence.insert("stripe_live_configuration".into(), (true, "".into()));
        assert!(!production_ready(&evidence));
        evidence.insert(
            "stripe_live_configuration".into(),
            (false, "unconfirmed".into()),
        );
        assert!(!production_ready(&evidence));
    }
    #[test]
    fn local_external_unknown_and_unbound_metadata_do_not_certify_a_build() {
        let now = Utc::now();
        let base = EvidenceRecord {
            gate: "restore_drill".into(),
            scope: "local".into(),
            passed: true,
            evidence_ref: "fixture/restore.json".into(),
            checked_at: now,
            build: Some("a".repeat(40)),
        };
        let external = EvidenceRecord {
            scope: "external".into(),
            ..base.clone()
        };
        let missing = EvidenceRecord {
            gate: "tenant_isolation".into(),
            scope: "external".into(),
            build: None,
            ..base.clone()
        };
        let unknown = EvidenceRecord {
            scope: "unknown".into(),
            ..base.clone()
        };
        let detail = evidence_details(
            &[base, external, missing, unknown],
            Some(&"a".repeat(40)),
            now,
        );
        assert_eq!(detail.local.len(), 1);
        assert_eq!(detail.external.len(), 2);
        assert_eq!(detail.external[0].build_matches_current, Some(true));
        assert_eq!(detail.external[1].metadata_status, "unconfirmed");
        assert!(detail.unsupported_scope_present);
        assert_eq!(detail.external_certification, "unconfirmed");
        assert!(detail
            .local
            .iter()
            .chain(&detail.external)
            .all(|r| !r.certified));
    }
}

//! Evidence gates are never inferred from a successful build or an empty queue.
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
}

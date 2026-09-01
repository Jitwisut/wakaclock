//! planai2.md Phase 6 — p6.3 dedup ruleset.
//!
//! Given the observations captured for a slice of activity (each already
//! carrying a p6.1 [`CanonicalFingerprint`] and a `payload_hash`), collapse them
//! into one [`CanonicalActivity`] per logical edit and surface the diagnostics
//! the rules require. Six rules, per planai2.md §6:
//!
//! 1. same `event_id` + same payload → duplicate success (drop silently).
//! 2. same `event_id` + different payload → **conflict**: the first-seen payload
//!    stands, the new one is recorded as a diagnostic and dropped (mirrors the
//!    broker inbox's `ON CONFLICT(event_id) DO NOTHING`). Never a silent
//!    overwrite.
//! 3. different `event_id` + same `CanonicalFingerprint` → merge into one
//!    activity.
//! 4. weaker `ai_inferred` evidence is superseded by `ai_verified` — the
//!    activity's `strongest_evidence` is chosen with [`broker::evidence_rank_key`]
//!    (the one p2.1 ladder, never re-derived here).
//! 5. a multi-file event does not multiply duration by file count.
//! 6. duration for a heartbeat comes from a **single** point per activity — the
//!    strongest observation's `active_seconds`, summed across activities, never
//!    across raw observations.

use chrono::{DateTime, Utc};

use crate::ai::canonical::{CanonicalActivity, CanonicalFingerprint, ChildEvidence};
use crate::ai::correlation_engine::EvidenceKind;
use crate::ai::{AiConfidence, AiEventSource};
use crate::broker::evidence_rank_key;

/// One observation entering the dedup pass. A lean projection of whatever event
/// the caller holds — deliberately not `BrokerEventV1` (p6.3 DECISION: that
/// struct is large, has no crate-public builder, and is in active concurrent
/// churn).
#[derive(Debug, Clone, PartialEq)]
pub struct DedupObservation {
    pub event_id: String,
    /// A stable hash of the normalized payload (e.g. `BrokerEventV1::payload_hash`).
    pub payload_hash: String,
    pub fingerprint: CanonicalFingerprint,
    pub kind: EvidenceKind,
    pub lineage_id: String,
    /// This observation's own duration contribution. For a multi-file tool call
    /// the interval has already been placed on one record at ingress
    /// (`spread_single_tool_interval`), so most siblings carry `0.0`.
    pub active_seconds: f64,
    // --- evidence-ladder inputs (ranked via `broker::evidence_rank_key`) ---
    pub transport: Option<String>,
    pub source: AiEventSource,
    pub confidence: AiConfidence,
    pub occurred_at: DateTime<Utc>,
}

impl DedupObservation {
    fn rank(&self) -> (u8, u8, u8, i64) {
        evidence_rank_key(
            self.transport.as_deref(),
            &self.source,
            &self.confidence,
            self.occurred_at,
        )
    }
}

/// An `event_id` seen twice with two different payloads. The first payload was
/// kept; this records the one that was rejected so nothing is lost silently.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DedupConflict {
    pub event_id: String,
    pub kept_payload_hash: String,
    pub rejected_payload_hash: String,
}

/// The result of [`dedup`].
#[derive(Debug, Clone, PartialEq)]
pub struct DedupOutcome {
    /// One activity per distinct fingerprint, in fingerprint order, each with its
    /// child evidence and `strongest_evidence` set.
    pub activities: Vec<CanonicalActivity>,
    /// Sum over activities of the strongest source observation's `active_seconds`
    /// — the value a heartbeat generator should use (rules 5 and 6).
    pub total_active_seconds: f64,
    /// `event_id` collisions with a differing payload (rule 2).
    pub conflicts: Vec<DedupConflict>,
    /// Count of observations dropped as exact duplicates (rule 1).
    pub duplicates_dropped: usize,
}

/// Apply the p6.3 ruleset. Input order is significant: for a given `event_id`
/// the **first** observation is the one that is kept.
pub fn dedup(observations: Vec<DedupObservation>) -> DedupOutcome {
    let mut conflicts = Vec::new();
    let mut duplicates_dropped = 0usize;

    // --- rules 1 & 2: collapse by event_id, first payload wins ---------------
    let mut kept: Vec<DedupObservation> = Vec::new();
    for obs in observations {
        match kept.iter().find(|k| k.event_id == obs.event_id) {
            None => kept.push(obs),
            Some(existing) if existing.payload_hash == obs.payload_hash => {
                duplicates_dropped += 1;
            }
            Some(existing) => {
                conflicts.push(DedupConflict {
                    event_id: obs.event_id.clone(),
                    kept_payload_hash: existing.payload_hash.clone(),
                    rejected_payload_hash: obs.payload_hash.clone(),
                });
            }
        }
    }

    // --- rules 3, 4, 6: one activity per fingerprint ------------------------
    let mut fingerprints: Vec<CanonicalFingerprint> =
        kept.iter().map(|o| o.fingerprint.clone()).collect();
    fingerprints.sort();
    fingerprints.dedup();

    let mut activities = Vec::with_capacity(fingerprints.len());
    let mut total_active_seconds = 0.0f64;

    for fp in fingerprints {
        let group: Vec<&DedupObservation> = kept.iter().filter(|o| o.fingerprint == fp).collect();

        let mut activity = CanonicalActivity::new(fp);
        for obs in &group {
            activity.add_child(obs.kind, obs.lineage_id.clone());
        }

        // rule 4: strongest producer evidence wins (the one p2.1 ladder).
        let strongest = group
            .iter()
            .min_by(|a, b| a.rank().cmp(&b.rank()))
            .expect("a fingerprint group is never empty");
        activity.set_strongest_evidence(ChildEvidence {
            kind: strongest.kind,
            lineage_id: strongest.lineage_id.clone(),
        });

        // rules 5 & 6: one duration point per activity — the strongest
        // observation's own seconds, never the sum over the group.
        total_active_seconds += strongest.active_seconds;

        activities.push(activity);
    }

    DedupOutcome {
        activities,
        total_active_seconds,
        conflicts,
        duplicates_dropped,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    use crate::ai::canonical::CanonicalIdentity;
    use crate::broker::BrokerChangeKind;

    fn fp_for(entity: &str) -> CanonicalFingerprint {
        CanonicalFingerprint::v1(&CanonicalIdentity {
            workspace: Path::new("/w"),
            entity: Path::new(entity),
            change_kind: BrokerChangeKind::Modify,
            occurred_at_unix: 1_000_000,
            content_fingerprint: Some("blob:abc"),
            line_delta: None,
            session_or_tool_id: Some("tool-1"),
        })
    }

    fn obs(event_id: &str, payload_hash: &str, fp: CanonicalFingerprint) -> DedupObservation {
        DedupObservation {
            event_id: event_id.to_string(),
            payload_hash: payload_hash.to_string(),
            fingerprint: fp,
            kind: EvidenceKind::NativeHook,
            lineage_id: format!("lin-{event_id}"),
            active_seconds: 0.0,
            transport: Some("shell_hook".to_string()),
            source: AiEventSource::AgentHook,
            confidence: AiConfidence::Verified,
            occurred_at: DateTime::from_timestamp(1_000_000, 0).unwrap(),
        }
    }

    #[test]
    fn rule1_same_event_id_same_payload_is_a_silent_duplicate() {
        let fp = fp_for("/w/a.rs");
        let out = dedup(vec![
            obs("e1", "h1", fp.clone()),
            obs("e1", "h1", fp.clone()),
            obs("e1", "h1", fp),
        ]);
        assert_eq!(out.duplicates_dropped, 2);
        assert!(out.conflicts.is_empty());
        assert_eq!(out.activities.len(), 1);
        assert_eq!(out.activities[0].children().len(), 1);
    }

    #[test]
    fn rule2_same_event_id_different_payload_is_a_kept_conflict_not_an_overwrite() {
        let fp = fp_for("/w/a.rs");
        let first = obs("e1", "h1", fp.clone());
        let mut second = obs("e1", "h2", fp.clone());
        second.kind = EvidenceKind::FilesystemObserver;
        second.lineage_id = "lin-second".to_string();

        let out = dedup(vec![first, second]);

        assert_eq!(out.duplicates_dropped, 0);
        assert_eq!(
            out.conflicts,
            vec![DedupConflict {
                event_id: "e1".to_string(),
                kept_payload_hash: "h1".to_string(),
                rejected_payload_hash: "h2".to_string(),
            }]
        );
        // The first-seen observation stands; the conflicting payload contributed
        // nothing to the activity.
        assert_eq!(out.activities.len(), 1);
        assert_eq!(out.activities[0].child_lineage_ids(), vec!["lin-e1"]);
    }

    #[test]
    fn rule3_different_event_ids_same_fingerprint_merge_into_one_activity() {
        let fp = fp_for("/w/a.rs");
        let mut hook = obs("hook-evt", "h1", fp.clone());
        hook.kind = EvidenceKind::NativeHook;
        hook.lineage_id = "hook".to_string();
        let mut fs = obs("fs-evt", "h2", fp.clone());
        fs.kind = EvidenceKind::FilesystemObserver;
        fs.lineage_id = "fs".to_string();
        fs.source = AiEventSource::IdeTelemetry;
        fs.confidence = AiConfidence::Inferred;

        let out = dedup(vec![hook, fs]);

        assert!(out.conflicts.is_empty());
        assert_eq!(out.activities.len(), 1, "one fingerprint => one activity");
        assert_eq!(
            out.activities[0].child_lineage_ids(),
            vec!["hook", "fs"],
            "both events' evidence is aggregated"
        );
    }

    #[test]
    fn rule4_verified_evidence_supersedes_inferred_for_the_strongest_pointer() {
        let fp = fp_for("/w/a.rs");
        // Order the weak one first to prove it is not chosen by arrival order.
        let mut fs = obs("fs-evt", "h1", fp.clone());
        fs.kind = EvidenceKind::FilesystemObserver;
        fs.lineage_id = "fs".to_string();
        fs.transport = Some("filesystem".to_string());
        fs.source = AiEventSource::IdeTelemetry;
        fs.confidence = AiConfidence::Inferred;

        let mut hook = obs("hook-evt", "h2", fp.clone());
        hook.kind = EvidenceKind::NativeHook;
        hook.lineage_id = "hook".to_string();
        hook.transport = Some("shell_hook".to_string());
        hook.source = AiEventSource::AgentHook;
        hook.confidence = AiConfidence::Verified;

        let out = dedup(vec![fs, hook]);

        let strongest = out.activities[0].strongest_evidence().unwrap();
        assert_eq!(strongest.kind, EvidenceKind::NativeHook);
        assert_eq!(strongest.lineage_id, "hook");
    }

    #[test]
    fn rule5_a_multi_file_event_does_not_multiply_duration_by_file_count() {
        // Single-file: whole interval on one record.
        let mut single = obs("s0", "h", fp_for("/w/a.rs"));
        single.active_seconds = 300.0;
        let single_total = dedup(vec![single]).total_active_seconds;
        assert_eq!(single_total, 300.0);

        // Multi-file: one tool call touched three files; the interval was placed
        // on the first record at ingress, siblings carry 0.0. Three fingerprints
        // (entity differs) => three activities, but the total is still 300.
        let mut a = obs("m0", "ha", fp_for("/w/a.rs"));
        a.active_seconds = 300.0;
        let mut b = obs("m1", "hb", fp_for("/w/b.rs"));
        b.active_seconds = 0.0;
        let mut c = obs("m2", "hc", fp_for("/w/c.rs"));
        c.active_seconds = 0.0;
        let multi = dedup(vec![a, b, c]);
        assert_eq!(multi.activities.len(), 3);
        assert_eq!(multi.total_active_seconds, single_total);
    }

    #[test]
    fn rule6_replaying_the_same_multi_file_event_adds_no_duration() {
        let build = || {
            let mut a = obs("m0", "ha", fp_for("/w/a.rs"));
            a.active_seconds = 300.0;
            let mut b = obs("m1", "hb", fp_for("/w/b.rs"));
            b.active_seconds = 0.0;
            let mut c = obs("m2", "hc", fp_for("/w/c.rs"));
            c.active_seconds = 0.0;
            vec![a, b, c]
        };
        let mut replayed = build();
        replayed.extend(build()); // the whole event delivered twice

        let out = dedup(replayed);
        assert_eq!(out.duplicates_dropped, 3);
        assert!(out.conflicts.is_empty());
        assert_eq!(out.activities.len(), 3);
        assert_eq!(out.total_active_seconds, 300.0);
    }

    #[test]
    fn two_verified_events_for_one_fingerprint_still_yield_one_duration_point() {
        // A hook and a transcript row, both Verified, same edit: rule 6 says the
        // heartbeat comes from ONE point, not hook+transcript summed.
        let fp = fp_for("/w/a.rs");
        let mut hook = obs("hook", "h1", fp.clone());
        hook.active_seconds = 120.0;
        hook.transport = Some("shell_hook".to_string());
        hook.source = AiEventSource::AgentHook;
        let mut transcript = obs("transcript", "h2", fp.clone());
        transcript.kind = EvidenceKind::CompletedTranscriptToolCall;
        transcript.active_seconds = 120.0;
        transcript.transport = Some("transcript".to_string());
        transcript.source = AiEventSource::Transcript;

        let out = dedup(vec![hook, transcript]);
        assert_eq!(out.activities.len(), 1);
        assert_eq!(out.total_active_seconds, 120.0);
    }
}

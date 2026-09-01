//! planai2.md Phase 7.4 — the shadow-mode precision/recall report.
//!
//! planai2.md's Release Gates section is explicit: universal inference "ต้อง
//! รายงาน precision แยกจาก native adapter recall ห้ามนำ verified/inferred มารวมเป็น
//! ตัวเลขเดียว" — report inference **precision** separately from native-adapter
//! **recall**, never as one blended number.
//!
//! Scoring needs a third input beyond the engine's `proposed` grade and the
//! native adapter's `oracle`: an independent dataset label
//! ([`ShadowRecord::ground_truth`]). The two headline numbers are computed from
//! deliberately disjoint slices of the log and share no term:
//!
//! * **native-adapter recall** relates the *label* to the *oracle* — of the
//!   changes a corpus labels AI, how many did a native adapter directly report.
//!   It never looks at `proposed`.
//! * **universal-inference precision** relates the *proposal* to the *label* —
//!   of the changes the engine graded `ai_inferred`, how many the label
//!   confirms as AI. It never looks at `oracle`, and it ignores every
//!   `ai_verified` proposal (those are the adapter's, not inference's).
//!
//! There is no accessor that combines the two.

use serde::{Deserialize, Serialize};

use crate::ai::correlation_engine::AiVerdict;
use crate::ai::shadow::{LabeledActor, ShadowLog};

/// Counts drawn from a [`ShadowLog`], plus the two ratio accessors. The counts
/// are kept on the struct so a caller can see the base a ratio rests on — a
/// precision of `1.0` over three records next to five hundred unscored ones is
/// a number that gets quoted out of context.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShadowComparisonReport {
    /// Changes the corpus labels as AI ([`LabeledActor::Ai`]).
    pub labeled_ai: usize,
    /// Of `labeled_ai`, how many a native adapter directly reported (`oracle`
    /// present). Recall numerator — independent of `proposed`.
    pub adapter_reported_ai: usize,
    /// `ai_inferred` proposals that carry a corpus label. Precision denominator.
    pub scored_inferences: usize,
    /// Of `scored_inferences`, how many the label confirms as AI.
    pub inference_true_positives: usize,
    /// `ai_inferred` proposals with no corpus label — not scorable for
    /// precision. Surfaced so a precision figure is never read without its base.
    pub unscored_inferences: usize,
}

impl ShadowComparisonReport {
    /// Native-adapter recall: of the changes a corpus labels AI, the fraction a
    /// native adapter directly reported. `None` when the corpus labels no AI
    /// change. **Never** combined with [`Self::universal_inference_precision`] —
    /// planai2.md forbids a single blended verified/inferred number.
    pub fn native_adapter_recall(&self) -> Option<f64> {
        (self.labeled_ai > 0).then(|| self.adapter_reported_ai as f64 / self.labeled_ai as f64)
    }

    /// Universal-inference precision: of the `ai_inferred` proposals that carry
    /// a corpus label, the fraction the label confirms as AI. `None` when
    /// nothing was scorable. **Never** combined with
    /// [`Self::native_adapter_recall`].
    pub fn universal_inference_precision(&self) -> Option<f64> {
        (self.scored_inferences > 0)
            .then(|| self.inference_true_positives as f64 / self.scored_inferences as f64)
    }
}

/// Build the report from a shadow log.
///
/// Recall is tallied only over label-known-AI records; precision only over
/// `ai_inferred` proposals. A record can contribute to both, to one, or to
/// neither — the two tallies are computed independently in the same pass.
pub fn compare_to_oracle(log: &ShadowLog) -> ShadowComparisonReport {
    let mut report = ShadowComparisonReport::default();
    for record in log.records() {
        if record.ground_truth == Some(LabeledActor::Ai) {
            report.labeled_ai += 1;
            if record.oracle.is_some() {
                report.adapter_reported_ai += 1;
            }
        }
        if record.proposed == AiVerdict::AiInferred {
            match record.ground_truth {
                Some(label) => {
                    report.scored_inferences += 1;
                    if label == LabeledActor::Ai {
                        report.inference_true_positives += 1;
                    }
                }
                None => report.unscored_inferences += 1,
            }
        }
    }
    report
}

#[cfg(test)]
mod tests {
    use chrono::Utc;

    use super::*;
    use crate::ai::correlation_engine::{Verdict, VerdictReason};
    use crate::ai::shadow::{ShadowLog, ShadowRecord};

    fn verdict(grade: AiVerdict, reason: VerdictReason) -> Verdict {
        Verdict {
            verdict: grade,
            reason,
            supporting_lineage: vec!["e:1".to_string()],
        }
    }

    fn record(grade: AiVerdict) -> ShadowRecord {
        let reason = match grade {
            AiVerdict::AiVerified => VerdictReason::DirectAiProducer,
            AiVerdict::AiInferred => VerdictReason::InferredFromAgentActivity,
            AiVerdict::Human => VerdictReason::PositiveEditorInput,
            AiVerdict::Unknown => VerdictReason::NoEvidence,
        };
        ShadowRecord::new(
            std::path::Path::new("/ws/src/lib.rs"),
            &verdict(grade, reason),
            Utc::now(),
        )
    }

    #[test]
    fn the_report_keeps_inference_precision_and_native_adapter_recall_as_separate_numbers() {
        let mut log = ShadowLog::default();
        // Three label-known-AI changes a native adapter reported directly.
        for _ in 0..3 {
            log.record(
                record(AiVerdict::AiVerified)
                    .with_ground_truth(LabeledActor::Ai)
                    .with_oracle(AiVerdict::AiVerified),
            );
        }
        // A label-known-AI change no adapter reported and the engine could not
        // grade — a recall miss, invisible to precision.
        log.record(record(AiVerdict::Unknown).with_ground_truth(LabeledActor::Ai));
        // Two inferred proposals with labels — one the label confirms, one it
        // contradicts. A precision hit and a precision miss.
        log.record(record(AiVerdict::AiInferred).with_ground_truth(LabeledActor::Ai));
        log.record(record(AiVerdict::AiInferred).with_ground_truth(LabeledActor::Human));

        let report = compare_to_oracle(&log);

        // Recall relates label→oracle over the five labeled-AI rows; precision
        // relates proposal→label over the two inferred rows. Different
        // relations, and here two visibly different numbers.
        assert_eq!(report.labeled_ai, 5);
        assert_eq!(report.adapter_reported_ai, 3);
        assert_eq!(report.scored_inferences, 2);
        assert_eq!(report.inference_true_positives, 1);

        assert_eq!(report.native_adapter_recall(), Some(0.6));
        assert_eq!(report.universal_inference_precision(), Some(0.5));
    }

    #[test]
    fn precision_is_measured_only_over_inferred_proposals() {
        let mut log = ShadowLog::default();
        for _ in 0..4 {
            log.record(
                record(AiVerdict::AiVerified)
                    .with_ground_truth(LabeledActor::Ai)
                    .with_oracle(AiVerdict::AiVerified),
            );
        }
        let report = compare_to_oracle(&log);
        assert_eq!(report.scored_inferences, 0);
        assert_eq!(report.universal_inference_precision(), None);
        assert_eq!(report.native_adapter_recall(), Some(1.0));
    }

    #[test]
    fn recall_is_measured_only_over_label_known_ai_changes() {
        let mut log = ShadowLog::default();
        for _ in 0..5 {
            log.record(record(AiVerdict::AiInferred)); // no label
        }
        let report = compare_to_oracle(&log);
        assert_eq!(report.labeled_ai, 0);
        assert_eq!(report.native_adapter_recall(), None);
        assert_eq!(report.universal_inference_precision(), None);
        assert_eq!(report.unscored_inferences, 5);
    }

    #[test]
    fn an_inferred_proposal_the_label_calls_human_is_a_precision_miss() {
        let mut log = ShadowLog::default();
        log.record(record(AiVerdict::AiInferred).with_ground_truth(LabeledActor::Ai));
        log.record(record(AiVerdict::AiInferred).with_ground_truth(LabeledActor::Ai));
        log.record(record(AiVerdict::AiInferred).with_ground_truth(LabeledActor::Human));

        let report = compare_to_oracle(&log);
        assert_eq!(report.scored_inferences, 3);
        assert_eq!(report.inference_true_positives, 2);
        assert_eq!(report.universal_inference_precision(), Some(2.0 / 3.0));
    }

    #[test]
    fn unscored_inferences_stay_visible_next_to_a_perfect_precision() {
        let mut log = ShadowLog::default();
        for _ in 0..3 {
            log.record(record(AiVerdict::AiInferred).with_ground_truth(LabeledActor::Ai));
        }
        for _ in 0..100 {
            log.record(record(AiVerdict::AiInferred)); // no label
        }
        let report = compare_to_oracle(&log);
        assert_eq!(report.universal_inference_precision(), Some(1.0));
        assert_eq!(report.unscored_inferences, 100);
    }

    #[test]
    fn the_report_exposes_the_counts_but_no_merged_number_and_no_content() {
        let report = compare_to_oracle(&ShadowLog::default());
        let json = serde_json::to_string(&report).unwrap();
        for key in [
            "labeled_ai",
            "adapter_reported_ai",
            "scored_inferences",
            "inference_true_positives",
            "unscored_inferences",
        ] {
            assert!(json.contains(key), "missing count {key}: {json}");
        }
        // No blended verified/inferred figure, and no evidence content. `score`
        // is intentionally absent from this list — `unscored_inferences` /
        // `scored_inferences` legitimately contain the substring.
        for forbidden in [
            "accuracy",
            "combined",
            "overall",
            "blended",
            "\"f1\"",
            "content",
            "diff",
            "\"patch\"",
            "prompt",
        ] {
            assert!(
                !json.contains(forbidden),
                "leaked merged/content key: {json}"
            );
        }
    }
}

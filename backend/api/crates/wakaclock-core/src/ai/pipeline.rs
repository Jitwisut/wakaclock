//! planai2.md Phase 7 — p7.1 pipeline stage model.
//!
//! Every agent's evidence walks a lifecycle from "we noticed the agent" to "a
//! heartbeat was delivered (or rejected)". [`PipelineTracker`] records where
//! each agent currently is and refuses to move an agent backwards silently;
//! [`PipelineTracker::snapshot`] is the read model an API / CLI / editor panel
//! returns.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// The ordered lifecycle of planai2.md §7. `AgentDetected` is the entry point;
/// `Delivered` and `Rejected` are the two terminal states.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PipelineStage {
    /// The agent's process / transcript / config was seen.
    AgentDetected,
    /// A native hook or adapter for the agent is installed and trusted.
    AdapterInstalled,
    /// At least one evidence record arrived from the agent.
    EvidenceReceived,
    /// The correlation engine produced a verdict for that evidence.
    Correlated,
    /// The verdict was accepted into the local canonical-activity store.
    AcceptedLocally,
    /// A heartbeat was generated and queued for delivery.
    QueuedForDelivery,
    /// The heartbeat reached the server.
    Delivered,
    /// The evidence or heartbeat was rejected (locally or by the server). A
    /// terminal state reachable from any non-terminal stage.
    Rejected,
}

impl PipelineStage {
    /// Forward-progress index. `Delivered` and `Rejected` share the terminal
    /// rank — they are peers, not one "ahead" of the other.
    pub fn rank(self) -> u8 {
        match self {
            Self::AgentDetected => 0,
            Self::AdapterInstalled => 1,
            Self::EvidenceReceived => 2,
            Self::Correlated => 3,
            Self::AcceptedLocally => 4,
            Self::QueuedForDelivery => 5,
            Self::Delivered => 6,
            Self::Rejected => 6,
        }
    }

    pub fn is_terminal(self) -> bool {
        matches!(self, Self::Delivered | Self::Rejected)
    }

    /// Whether an agent at `self` may move to `next`. Forward moves (rank
    /// strictly increases, skipping allowed) are fine; a move to `Rejected` is
    /// allowed from any non-terminal stage; nothing leaves a terminal stage;
    /// equal or backward moves are refused.
    pub fn can_advance_to(self, next: PipelineStage) -> bool {
        if self.is_terminal() {
            return false;
        }
        if next == PipelineStage::Rejected {
            return true;
        }
        next.rank() > self.rank()
    }
}

/// One stage an agent has occupied, with when it was entered.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StageEntry {
    pub stage: PipelineStage,
    pub at: DateTime<Utc>,
}

/// Where one agent currently is in the pipeline, plus how it got there.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentPipelineState {
    pub agent: String,
    pub stage: PipelineStage,
    pub entered_stage_at: DateTime<Utc>,
    /// Every stage this agent has occupied, oldest first — for the diagnostics
    /// timeline. Never holds evidence content, only stage + timestamp.
    pub history: Vec<StageEntry>,
    /// Set only while `stage == Rejected`: a short, non-sensitive reason
    /// (e.g. `"payment_402"`, `"conflicting_evidence"`).
    #[serde(default)]
    pub rejection_reason: Option<String>,
}

impl AgentPipelineState {
    fn new(agent: String, stage: PipelineStage, at: DateTime<Utc>) -> Self {
        Self {
            agent,
            stage,
            entered_stage_at: at,
            history: vec![StageEntry { stage, at }],
            rejection_reason: None,
        }
    }
}

/// Refused a transition that would move an agent to an equal or earlier stage,
/// or out of a terminal stage. planai2.md p7.1: no skipping backwards silently.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
#[error("agent {agent:?} cannot move from {from:?} to {to:?}")]
pub struct StageRegression {
    pub agent: String,
    pub from: PipelineStage,
    pub to: PipelineStage,
}

/// Per-agent pipeline state. Cheap to clone; holds no evidence payloads.
#[derive(Debug, Clone, Default)]
pub struct PipelineTracker {
    agents: BTreeMap<String, AgentPipelineState>,
}

impl PipelineTracker {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record that `agent` reached `stage` at `at`. An agent seen for the first
    /// time is created at `stage`. A forward (or forward-skipping) move updates
    /// the agent and appends to its history. An equal/backward move, or any move
    /// out of a terminal stage, is refused with [`StageRegression`] and leaves
    /// the agent untouched.
    pub fn observe(
        &mut self,
        agent: &str,
        stage: PipelineStage,
        at: DateTime<Utc>,
    ) -> Result<&AgentPipelineState, StageRegression> {
        match self.agents.get_mut(agent) {
            None => {
                self.agents.insert(
                    agent.to_string(),
                    AgentPipelineState::new(agent.to_string(), stage, at),
                );
            }
            Some(state) => {
                if !state.stage.can_advance_to(stage) {
                    return Err(StageRegression {
                        agent: agent.to_string(),
                        from: state.stage,
                        to: stage,
                    });
                }
                state.stage = stage;
                state.entered_stage_at = at;
                state.history.push(StageEntry { stage, at });
                if stage != PipelineStage::Rejected {
                    state.rejection_reason = None;
                }
            }
        }
        Ok(self.agents.get(agent).expect("just inserted or updated"))
    }

    /// Convenience for a rejection with a reason. Follows the same transition
    /// rules as [`observe`](Self::observe).
    pub fn reject(
        &mut self,
        agent: &str,
        reason: impl Into<String>,
        at: DateTime<Utc>,
    ) -> Result<(), StageRegression> {
        self.observe(agent, PipelineStage::Rejected, at)?;
        if let Some(state) = self.agents.get_mut(agent) {
            state.rejection_reason = Some(reason.into());
        }
        Ok(())
    }

    pub fn stage_of(&self, agent: &str) -> Option<PipelineStage> {
        self.agents.get(agent).map(|s| s.stage)
    }

    /// The read model: current state for every known agent, ordered by agent id.
    /// This is what an API endpoint / CLI `doctor` / editor panel returns.
    pub fn snapshot(&self) -> Vec<AgentPipelineState> {
        self.agents.values().cloned().collect()
    }

    pub fn is_empty(&self) -> bool {
        self.agents.is_empty()
    }

    pub fn len(&self) -> usize {
        self.agents.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(secs: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_700_000_000 + secs, 0).unwrap()
    }

    const FULL_CHAIN: [PipelineStage; 7] = [
        PipelineStage::AgentDetected,
        PipelineStage::AdapterInstalled,
        PipelineStage::EvidenceReceived,
        PipelineStage::Correlated,
        PipelineStage::AcceptedLocally,
        PipelineStage::QueuedForDelivery,
        PipelineStage::Delivered,
    ];

    #[test]
    fn pipeline_advances_through_the_chain_and_refuses_to_regress() {
        let mut tracker = PipelineTracker::new();
        for (i, stage) in FULL_CHAIN.into_iter().enumerate() {
            tracker.observe("codex", stage, t(i as i64)).unwrap();
            assert_eq!(tracker.stage_of("codex"), Some(stage));
        }

        // Any backward or equal move is refused, and the agent does not move.
        let err = tracker
            .observe("codex", PipelineStage::Correlated, t(100))
            .unwrap_err();
        assert_eq!(err.from, PipelineStage::Delivered);
        assert_eq!(err.to, PipelineStage::Correlated);
        assert_eq!(tracker.stage_of("codex"), Some(PipelineStage::Delivered));
    }

    #[test]
    fn the_snapshot_returns_the_current_stage_per_agent() {
        let mut tracker = PipelineTracker::new();
        tracker
            .observe("gemini-cli", PipelineStage::AgentDetected, t(0))
            .unwrap();
        tracker
            .observe("claude-code", PipelineStage::AgentDetected, t(0))
            .unwrap();
        tracker
            .observe("claude-code", PipelineStage::EvidenceReceived, t(1))
            .unwrap();
        tracker
            .observe("claude-code", PipelineStage::AcceptedLocally, t(2))
            .unwrap();

        let snap = tracker.snapshot();
        assert_eq!(snap.len(), 2);
        // Ordered by agent id.
        assert_eq!(snap[0].agent, "claude-code");
        assert_eq!(snap[0].stage, PipelineStage::AcceptedLocally);
        assert_eq!(snap[1].agent, "gemini-cli");
        assert_eq!(snap[1].stage, PipelineStage::AgentDetected);
    }

    #[test]
    fn a_rejection_is_reachable_from_any_non_terminal_stage_and_is_terminal() {
        let mut tracker = PipelineTracker::new();
        tracker
            .observe("codex", PipelineStage::AgentDetected, t(0))
            .unwrap();
        tracker
            .observe("codex", PipelineStage::EvidenceReceived, t(1))
            .unwrap();
        tracker.reject("codex", "payment_402", t(2)).unwrap();

        let state = &tracker.snapshot()[0];
        assert_eq!(state.stage, PipelineStage::Rejected);
        assert_eq!(state.rejection_reason.as_deref(), Some("payment_402"));

        // Nothing leaves a terminal stage.
        assert!(tracker
            .observe("codex", PipelineStage::QueuedForDelivery, t(3))
            .is_err());
        assert!(tracker
            .observe("codex", PipelineStage::Rejected, t(3))
            .is_err());
    }

    #[test]
    fn a_forward_skip_is_allowed_and_recorded_in_history() {
        let mut tracker = PipelineTracker::new();
        tracker
            .observe("codex", PipelineStage::AgentDetected, t(0))
            .unwrap();
        // Generic ingress: evidence arrives with no installed adapter — skip a stage.
        tracker
            .observe("codex", PipelineStage::EvidenceReceived, t(1))
            .unwrap();
        let state = &tracker.snapshot()[0];
        assert_eq!(
            state.history.iter().map(|e| e.stage).collect::<Vec<_>>(),
            vec![
                PipelineStage::AgentDetected,
                PipelineStage::EvidenceReceived
            ],
        );
    }

    #[test]
    fn a_first_sighting_can_start_mid_chain() {
        let mut tracker = PipelineTracker::new();
        // We never saw "detected"; the first thing we heard was an evidence record.
        tracker
            .observe("codex", PipelineStage::EvidenceReceived, t(0))
            .unwrap();
        assert_eq!(
            tracker.stage_of("codex"),
            Some(PipelineStage::EvidenceReceived)
        );
    }

    #[test]
    fn the_read_model_serializes_without_evidence_content() {
        let mut tracker = PipelineTracker::new();
        tracker
            .observe("codex", PipelineStage::AgentDetected, t(0))
            .unwrap();
        tracker
            .observe("codex", PipelineStage::Correlated, t(1))
            .unwrap();
        let snap = tracker.snapshot();
        let json = serde_json::to_string(&snap).unwrap();
        for forbidden in [
            "\"content",
            "\"diff",
            "\"patch",
            "\"prompt",
            "\"source",
            "\"payload",
        ] {
            assert!(
                !json.contains(forbidden),
                "pipeline read model leaked: {json}"
            );
        }
        let back: Vec<AgentPipelineState> = serde_json::from_str(&json).unwrap();
        assert_eq!(back, snap);
    }

    #[test]
    fn can_advance_to_encodes_the_transition_rules() {
        use PipelineStage::*;
        assert!(AgentDetected.can_advance_to(AdapterInstalled));
        assert!(AgentDetected.can_advance_to(AcceptedLocally)); // skip forward
        assert!(EvidenceReceived.can_advance_to(Rejected));
        assert!(!Correlated.can_advance_to(Correlated)); // equal
        assert!(!Correlated.can_advance_to(EvidenceReceived)); // backward
        assert!(!Delivered.can_advance_to(Rejected)); // out of terminal
        assert!(!Rejected.can_advance_to(AgentDetected));
    }
}

use crate::ai::event::{AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::path::to_comparable_string;
use chrono::{DateTime, Duration, Utc};
use std::collections::HashMap;
use std::path::PathBuf;

/// "Same canonical file plus closest timestamp" — plan.md 8.7. Applies to line-level
/// AI attribution. The separate 2-minute "context window" that plan.md allows for
/// tagging category `ai coding` without claiming line counts is not implemented here;
/// that requires a first-class `Category::AiCoding` variant this pass didn't add.
///
/// This measures distance to an `EditorObservation`'s *window*
/// (`window_start`/`window_end`), not to a single point — see [`distance_to_window`].
/// `extensions/vscode/src/aiAttribution.ts`'s `CORRELATION_WINDOW_SECONDS` (15s) is
/// the analogous check on the editor side, but measures point-to-point distance
/// against one editor-change timestamp. A 5s-to-a-window match can be more permissive
/// than a 15s-to-a-point match depending on the window's own width, so the two are
/// not directly comparable numbers and must not be unified into one constant.
const EXACT_MATCH_WINDOW: Duration = Duration::seconds(5);

/// One editor-observed buffered change for a single file, as the CLI's flush logic
/// would produce it before deciding whether to attribute it to AI. Deliberately
/// mirrors only the fields correlation needs, not the full wire `Heartbeat` — this
/// module has no dependency on the heartbeat/HTTP layer.
#[derive(Debug, Clone)]
pub struct EditorObservation {
    pub entity: PathBuf,
    pub project_root: Option<PathBuf>,
    pub window_start: DateTime<Utc>,
    pub window_end: DateTime<Utc>,
    pub human_lines_added: u32,
    pub human_lines_deleted: u32,
}

/// One or more [`AiEditEvent`]s merged into a single attribution (plan.md 8.7: "If
/// several AI events for the same file land inside one editor flush window, merge
/// their line counts and retain their individual stable IDs").
#[derive(Debug, Clone, PartialEq)]
pub struct AiAttribution {
    /// Deterministic ID for the merged heartbeat, derived from the source event IDs
    /// so it stays stable across a re-run of the same batch.
    pub aggregate_event_id: String,
    /// Every source `AiEditEvent::event_id` that contributed to this attribution —
    /// preserved even after merging so local delivery state can still dedupe each one
    /// individually (plan.md 8.6/8.7).
    pub source_event_ids: Vec<String>,
    pub agent: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub source: AiEventSource,
    pub confidence: AiConfidence,
    pub lines_added: Option<u32>,
    pub lines_deleted: Option<u32>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CorrelationOutcome {
    /// No AI event could be safely attributed — plan.md 8.0: the system does not guess
    /// merely to increase the AI percentage.
    Unattributed,
    /// The AI event(s) fully account for the observed change. The caller should build
    /// an AI-attributed heartbeat and clear the observed human counters for this
    /// window (plan.md 8.7: "Clear human_lines_added, human_lines_deleted ... for the
    /// portion proven to be the same AI edit").
    AiMatch(AiAttribution),
    /// AI activity was found for this file/window, but the observed human delta
    /// exceeds what the matched AI event(s) account for. Plan.md 8.7's "safety
    /// fallback": record the AI portion, but do **not** clear the human counters —
    /// destroying real human signal to make the AI percentage look cleaner than the
    /// evidence supports is exactly what plan.md 8.0 forbids.
    PartialAiMatch(AiAttribution),
}

/// Correlate one editor-buffered observation against a pool of not-yet-consumed AI
/// events, removing whichever events it matches from the pool so a later observation
/// (plan.md 8.7: "each AI event can match at most one editor heartbeat") can't reuse
/// them.
pub fn correlate(
    pending: &mut Vec<AiEditEvent>,
    observation: &EditorObservation,
) -> CorrelationOutcome {
    let target_entity = to_comparable_string(&observation.entity);

    let candidate_indices: Vec<usize> = pending
        .iter()
        .enumerate()
        .filter(|(_, event)| to_comparable_string(&event.entity) == target_entity)
        .filter(|(_, event)| {
            distance_to_window(event.occurred_at, observation) <= EXACT_MATCH_WINDOW
        })
        .map(|(index, _)| index)
        .collect();

    if candidate_indices.is_empty() {
        return CorrelationOutcome::Unattributed;
    }

    let mut by_agent: HashMap<String, Vec<usize>> = HashMap::new();
    for index in candidate_indices {
        by_agent
            .entry(pending[index].agent.clone())
            .or_default()
            .push(index);
    }

    // The common case: every candidate in the window came from one agent (several
    // hunks/tool calls in the same 30s buffer). Merge them without needing to score
    // anything — there's nothing to disambiguate.
    if by_agent.len() == 1 {
        let indices = by_agent.into_values().next().expect("checked len == 1");
        return finish_match(pending, indices, observation);
    }

    // Rare/adversarial case: two different agents both touched the same file inside
    // the same window. Score each agent's group as one candidate using plan.md 8.7's
    // order (closest timestamp, same project root, compatible line delta, higher
    // confidence) and require an unambiguous winner.
    let mut scored: Vec<(String, Vec<usize>, GroupScore)> = by_agent
        .into_iter()
        .map(|(agent, indices)| {
            let score = score_group(pending, &indices, observation);
            (agent, indices, score)
        })
        .collect();
    scored.sort_by_key(|(_, _, score)| *score);

    let winner_is_unambiguous = scored.len() == 1 || scored[0].2 != scored[1].2;
    if !winner_is_unambiguous {
        // plan.md 8.7: "If candidates tie ambiguously, leave the editor activity
        // unattributed ... Never choose randomly."
        return CorrelationOutcome::Unattributed;
    }

    let (_, indices, _) = scored.remove(0);
    finish_match(pending, indices, observation)
}

fn distance_to_window(occurred_at: DateTime<Utc>, observation: &EditorObservation) -> Duration {
    if occurred_at >= observation.window_start && occurred_at <= observation.window_end {
        Duration::zero()
    } else if occurred_at < observation.window_start {
        observation.window_start - occurred_at
    } else {
        occurred_at - observation.window_end
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct GroupScore {
    // Ascending sort puts the best candidate first: smaller distance, then "has a
    // matching project root" (0 beats 1), then "line delta is compatible" (0 beats
    // 1), then higher confidence (negated so higher confidence sorts first).
    distance_ms: i64,
    root_mismatch: u8,
    incompatible_delta: u8,
    confidence_rank_desc: i8,
}

fn score_group(
    pending: &[AiEditEvent],
    indices: &[usize],
    observation: &EditorObservation,
) -> GroupScore {
    let distance_ms = indices
        .iter()
        .map(|&i| distance_to_window(pending[i].occurred_at, observation).num_milliseconds())
        .min()
        .unwrap_or(i64::MAX);
    let root_mismatch = if indices.iter().any(|&i| {
        matches!(
            (&pending[i].project_root, &observation.project_root),
            (Some(a), Some(b)) if to_comparable_string(a) == to_comparable_string(b)
        )
    }) {
        0
    } else {
        1
    };
    let (merged_added, merged_deleted) = sum_lines(pending, indices);
    let incompatible_delta = if is_compatible_delta(merged_added, merged_deleted, observation) {
        0
    } else {
        1
    };
    let best_confidence = indices
        .iter()
        .map(|&i| confidence_rank(&pending[i].confidence))
        .max()
        .unwrap_or(0);

    GroupScore {
        distance_ms,
        root_mismatch,
        incompatible_delta,
        confidence_rank_desc: -(best_confidence as i8),
    }
}

fn confidence_rank(confidence: &AiConfidence) -> u8 {
    match confidence {
        AiConfidence::Unknown => 0,
        AiConfidence::Inferred => 1,
        AiConfidence::Correlated => 2,
        AiConfidence::Verified => 3,
    }
}

fn sum_lines(pending: &[AiEditEvent], indices: &[usize]) -> (Option<u32>, Option<u32>) {
    let mut added: Option<u32> = None;
    let mut deleted: Option<u32> = None;
    for &i in indices {
        if let Some(value) = pending[i].lines_added {
            added = Some(added.unwrap_or(0) + value);
        }
        if let Some(value) = pending[i].lines_deleted {
            deleted = Some(deleted.unwrap_or(0) + value);
        }
    }
    (added, deleted)
}

/// Mirrors the same tolerant check the VS Code sidecar-based fallback already uses:
/// unknown AI line counts can't disprove compatibility, and a compatible AI event must
/// cover at least as much as was observed (the AI tool may report slightly more, e.g.
/// touching a trailing newline the editor's delta glosses over).
fn is_compatible_delta(
    ai_added: Option<u32>,
    ai_deleted: Option<u32>,
    observation: &EditorObservation,
) -> bool {
    let added_ok = ai_added.is_none_or(|value| value >= observation.human_lines_added);
    let deleted_ok = ai_deleted.is_none_or(|value| value >= observation.human_lines_deleted);
    added_ok && deleted_ok
}

fn finish_match(
    pending: &mut Vec<AiEditEvent>,
    mut indices: Vec<usize>,
    observation: &EditorObservation,
) -> CorrelationOutcome {
    indices.sort_unstable();
    // Remove by descending index so removing a later element never shifts the
    // position of an index still queued for removal, then restore ascending
    // (original pool) order for a deterministic merge result.
    let mut group: Vec<AiEditEvent> = Vec::with_capacity(indices.len());
    for &index in indices.iter().rev() {
        group.push(pending.remove(index));
    }
    group.reverse();

    let (lines_added, lines_deleted) = sum_owned_lines(&group);
    let source_event_ids: Vec<String> = group.iter().map(|event| event.event_id.clone()).collect();
    let aggregate_event_id = if source_event_ids.len() == 1 {
        source_event_ids[0].clone()
    } else {
        format!("merged:{}", source_event_ids.join("+"))
    };
    let best = group
        .iter()
        .max_by_key(|event| confidence_rank(&event.confidence))
        .expect("group is non-empty");

    let attribution = AiAttribution {
        aggregate_event_id,
        source_event_ids,
        agent: best.agent.clone(),
        provider: best.provider.clone(),
        model: best.model.clone(),
        source: best.source.clone(),
        confidence: best.confidence.clone(),
        lines_added,
        lines_deleted,
    };

    if is_compatible_delta(lines_added, lines_deleted, observation) {
        CorrelationOutcome::AiMatch(attribution)
    } else {
        CorrelationOutcome::PartialAiMatch(attribution)
    }
}

fn sum_owned_lines(group: &[AiEditEvent]) -> (Option<u32>, Option<u32>) {
    let mut added: Option<u32> = None;
    let mut deleted: Option<u32> = None;
    for event in group {
        if let Some(value) = event.lines_added {
            added = Some(added.unwrap_or(0) + value);
        }
        if let Some(value) = event.lines_deleted {
            deleted = Some(deleted.unwrap_or(0) + value);
        }
    }
    (added, deleted)
}

/// Drop pending AI events that have sat unmatched longer than `retention` — a light
/// nod to plan.md 8.6's bounded correlation window. The full bounded/persistent
/// version (30 days or 50,000 IDs, whichever is smaller, backed by SQLite) belongs in
/// `state.rs`, not yet implemented; this only bounds the in-memory pool a caller holds
/// during one process's lifetime.
pub fn expire_unmatched(pending: &mut Vec<AiEditEvent>, now: DateTime<Utc>, retention: Duration) {
    pending.retain(|event| now - event.occurred_at <= retention);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::event::{AiConfidence, AiEventSource};
    use chrono::TimeZone;

    fn at(seconds: i64) -> DateTime<Utc> {
        Utc.timestamp_opt(1_700_000_000 + seconds, 0).unwrap()
    }

    fn ai_event(
        id: &str,
        agent: &str,
        entity: &str,
        occurred_at: DateTime<Utc>,
        added: u32,
        deleted: u32,
    ) -> AiEditEvent {
        AiEditEvent {
            event_id: id.to_string(),
            agent: agent.to_string(),
            provider: Some("test-provider".to_string()),
            model: None,
            session_id: None,
            occurred_at,
            entity: PathBuf::from(entity),
            project_root: Some(PathBuf::from("/home/dev/example-project")),
            lines_added: Some(added),
            lines_deleted: Some(deleted),
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        }
    }

    fn observation(
        entity: &str,
        window_start: DateTime<Utc>,
        window_end: DateTime<Utc>,
        added: u32,
        deleted: u32,
    ) -> EditorObservation {
        EditorObservation {
            entity: PathBuf::from(entity),
            project_root: Some(PathBuf::from("/home/dev/example-project")),
            window_start,
            window_end,
            human_lines_added: added,
            human_lines_deleted: deleted,
        }
    }

    #[test]
    fn same_file_within_five_seconds_matches_exactly_once() {
        let mut pending = vec![ai_event("e1", "codex", "src/lib.rs", at(2), 3, 1)];
        let obs = observation("src/lib.rs", at(0), at(5), 3, 1);

        let outcome = correlate(&mut pending, &obs);
        assert_eq!(
            outcome,
            CorrelationOutcome::AiMatch(AiAttribution {
                aggregate_event_id: "e1".to_string(),
                source_event_ids: vec!["e1".to_string()],
                agent: "codex".to_string(),
                provider: Some("test-provider".to_string()),
                model: None,
                source: AiEventSource::Transcript,
                confidence: AiConfidence::Verified,
                lines_added: Some(3),
                lines_deleted: Some(1),
            })
        );
        assert!(
            pending.is_empty(),
            "matched event must be consumed from the pool"
        );
    }

    #[test]
    fn pins_exact_match_window_at_five_seconds_past_the_window_edge() {
        // Pins EXACT_MATCH_WINDOW's actual value, unlike the "within the window" and
        // "well outside" tests above/below: the event here is *outside*
        // `[window_start, window_end]` by precisely 5s, one second inside by 6s. A
        // change to the constant should make one of these two assertions fail.
        let obs = observation("src/lib.rs", at(0), at(5), 3, 1);

        let mut at_the_boundary = vec![ai_event("e1", "codex", "src/lib.rs", at(10), 3, 1)];
        assert!(
            matches!(
                correlate(&mut at_the_boundary, &obs),
                CorrelationOutcome::AiMatch(_)
            ),
            "an event exactly EXACT_MATCH_WINDOW past the window edge must still match"
        );

        let mut past_the_boundary = vec![ai_event("e1", "codex", "src/lib.rs", at(11), 3, 1)];
        assert_eq!(
            correlate(&mut past_the_boundary, &obs),
            CorrelationOutcome::Unattributed,
            "one second past EXACT_MATCH_WINDOW must not match"
        );
    }

    #[test]
    fn same_file_outside_the_window_does_not_erase_human_metrics() {
        // AI event is 30 seconds before the buffer window — well outside the 5s
        // exact-match window, so this must not be treated as the same edit.
        let mut pending = vec![ai_event("e1", "codex", "src/lib.rs", at(0), 3, 1)];
        let obs = observation("src/lib.rs", at(30), at(35), 2, 0);

        let outcome = correlate(&mut pending, &obs);
        assert_eq!(outcome, CorrelationOutcome::Unattributed);
        assert_eq!(
            pending.len(),
            1,
            "unmatched event stays in the pool, untouched"
        );
    }

    #[test]
    fn different_files_never_match_solely_because_timestamps_are_close() {
        let mut pending = vec![ai_event("e1", "codex", "src/other.rs", at(2), 3, 1)];
        let obs = observation("src/lib.rs", at(0), at(5), 3, 1);

        let outcome = correlate(&mut pending, &obs);
        assert_eq!(outcome, CorrelationOutcome::Unattributed);
        assert_eq!(pending.len(), 1);
    }

    #[test]
    fn closest_event_wins_deterministically_among_same_agent_candidates() {
        // Two Codex events for the same file in the window: this is the "several AI
        // events in one editor buffer" merge case, not an ambiguous tie (same agent).
        let mut pending = vec![
            ai_event("e-far", "codex", "src/lib.rs", at(1), 1, 0),
            ai_event("e-near", "codex", "src/lib.rs", at(4), 2, 0),
        ];
        let obs = observation("src/lib.rs", at(0), at(5), 3, 0);

        let outcome = correlate(&mut pending, &obs);
        let CorrelationOutcome::AiMatch(attribution) = outcome else {
            panic!("expected AiMatch");
        };
        assert_eq!(
            attribution.lines_added,
            Some(3),
            "merged, not just the closest"
        );
        assert_eq!(
            attribution.source_event_ids,
            vec!["e-far".to_string(), "e-near".to_string()]
        );
        assert!(pending.is_empty());
    }

    #[test]
    fn ambiguous_tie_across_different_agents_stays_unattributed() {
        // Two different agents, identical distance/root/compatibility/confidence:
        // nothing to legitimately break the tie with, so this must not guess.
        let mut pending = vec![
            ai_event("e-codex", "codex", "src/lib.rs", at(2), 3, 1),
            ai_event("e-claude", "claude-code", "src/lib.rs", at(3), 3, 1),
        ];
        let obs = observation("src/lib.rs", at(0), at(5), 3, 1);

        let outcome = correlate(&mut pending, &obs);
        assert_eq!(outcome, CorrelationOutcome::Unattributed);
        assert_eq!(
            pending.len(),
            2,
            "ambiguous events remain in the pool, neither consumed"
        );
    }

    #[test]
    fn several_ai_events_in_one_buffer_combine_without_losing_event_ids() {
        let mut pending = vec![
            ai_event("hunk-1", "claude-code", "src/lib.rs", at(1), 2, 0),
            ai_event("hunk-2", "claude-code", "src/lib.rs", at(2), 1, 1),
        ];
        let obs = observation("src/lib.rs", at(0), at(5), 3, 1);

        let CorrelationOutcome::AiMatch(attribution) = correlate(&mut pending, &obs) else {
            panic!("expected AiMatch");
        };
        assert_eq!(attribution.lines_added, Some(3));
        assert_eq!(attribution.lines_deleted, Some(1));
        assert_eq!(
            attribution.source_event_ids,
            vec!["hunk-1".to_string(), "hunk-2".to_string()]
        );
        assert_eq!(attribution.aggregate_event_id, "merged:hunk-1+hunk-2");
    }

    #[test]
    fn ai_edit_followed_by_human_correction_produces_partial_match_not_a_full_clear() {
        // The AI event only accounts for 2 added lines, but the observed buffer has 5
        // — a human kept typing after the AI edit landed. Human signal must survive.
        let mut pending = vec![ai_event("e1", "codex", "src/lib.rs", at(1), 2, 0)];
        let obs = observation("src/lib.rs", at(0), at(5), 5, 0);

        let outcome = correlate(&mut pending, &obs);
        match outcome {
            CorrelationOutcome::PartialAiMatch(attribution) => {
                assert_eq!(attribution.lines_added, Some(2));
            }
            other => panic!("expected PartialAiMatch, got {other:?}"),
        }
    }

    #[test]
    fn each_ai_event_matches_at_most_one_observation() {
        let mut pending = vec![ai_event("e1", "codex", "src/lib.rs", at(2), 3, 1)];
        let obs = observation("src/lib.rs", at(0), at(5), 3, 1);

        let first = correlate(&mut pending, &obs);
        assert!(matches!(first, CorrelationOutcome::AiMatch(_)));
        let second = correlate(&mut pending, &obs);
        assert_eq!(second, CorrelationOutcome::Unattributed, "already consumed");
    }

    #[test]
    fn random_event_ordering_converges_on_the_same_output() {
        let base = vec![
            ai_event("a", "claude-code", "src/lib.rs", at(1), 1, 0),
            ai_event("b", "claude-code", "src/lib.rs", at(2), 1, 0),
            ai_event("c", "claude-code", "src/lib.rs", at(3), 1, 0),
        ];
        let obs = observation("src/lib.rs", at(0), at(5), 3, 0);

        let mut forward = base.clone();
        let forward_outcome = correlate(&mut forward, &obs);

        let mut reversed: Vec<AiEditEvent> = base.into_iter().rev().collect();
        let reversed_outcome = correlate(&mut reversed, &obs);

        let (CorrelationOutcome::AiMatch(a), CorrelationOutcome::AiMatch(b)) =
            (forward_outcome, reversed_outcome)
        else {
            panic!("expected both orderings to match");
        };
        assert_eq!(a.lines_added, b.lines_added);
        assert_eq!(a.lines_deleted, b.lines_deleted);
        let mut a_ids = a.source_event_ids;
        let mut b_ids = b.source_event_ids;
        a_ids.sort();
        b_ids.sort();
        assert_eq!(a_ids, b_ids, "same event set regardless of pool ordering");
    }

    #[test]
    fn expire_unmatched_drops_events_past_retention() {
        let mut pending = vec![
            ai_event("old", "codex", "src/lib.rs", at(0), 1, 0),
            ai_event("recent", "codex", "src/lib.rs", at(90), 1, 0),
        ];
        expire_unmatched(&mut pending, at(100), Duration::seconds(30));
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].event_id, "recent");
    }
}

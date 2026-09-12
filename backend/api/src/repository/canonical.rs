//! Shared ClickHouse relation for attribution-canonical heartbeat reads.
//!
//! Heartbeats are append-only because a late producer can only be reconciled safely
//! by writing a higher full-value revision. Every aggregate must therefore select one
//! winner before summing. A per-file event id is the most specific key: one tool
//! call may legitimately mutate several files while sharing one `ai_change_id`.
//! When an event id is absent, the change id is namespaced by the entity and the
//! stable session scope so file rows remain independent without matching on mutable
//! identity metadata, time, or line counts.

/// Build a bounded internal relation that keeps the highest revision for each logical
/// operation. `predicate` is supplied only by trusted repository code and should include
/// the user/time/project scope needed by the caller. The legacy fallback is deliberately
/// query-local; it is not an inference signal and never joins independent rows solely
/// because their line counts or timestamps are close.
pub fn canonical_winner_relation(predicate: &str, alias: &str) -> String {
    format!(
        "(SELECT * FROM ( \
            SELECT h.*, \
                   row_number() OVER ( \
                       PARTITION BY h.user_id, \
                         multiIf( \
                           length(ifNull(h.ai_event_id, '')) > 0, \
                           concat('event:', ifNull(h.ai_event_id, ''), '|session:', ifNull(h.session_id, ''), '|entity:', h.entity), \
                           length(ifNull(h.ai_change_id, '')) > 0, \
                           concat('change:', ifNull(h.ai_change_id, ''), '|session:', ifNull(h.session_id, ''), '|entity:', h.entity), \
                           length(ifNull(h.heartbeat_id, '')) > 0, \
                           concat('heartbeat:', ifNull(h.heartbeat_id, ''), '|session:', ifNull(h.session_id, ''), '|entity:', h.entity), \
                           concat('legacy:', toString(generateUUIDv4())) \
                         ) \
                       ORDER BY h.revision DESC, h.created_at DESC, h.time DESC \
                   ) AS canonical_rank \
            FROM wakaclock.heartbeats AS h \
            WHERE ({predicate}) AND (h.user_id, ifNull(h.heartbeat_id, '')) NOT IN \
                (SELECT user_id, heartbeat_id FROM wakaclock.heartbeat_deletions) \
        ) AS ranked WHERE canonical_rank = 1) AS {alias}"
    )
}

#[cfg(test)]
mod tests {
    use super::canonical_winner_relation;

    #[test]
    fn relation_selects_max_revision_before_consumers_aggregate() {
        let sql = canonical_winner_relation("h.user_id = ?", "h");
        assert!(sql.contains("row_number() OVER"));
        assert!(sql.contains("h.revision DESC"));
        assert!(sql.contains("PARTITION BY h.user_id"));
        assert!(sql.contains("canonical_rank = 1"));
        assert!(sql.contains("h.ai_event_id"));
        assert!(sql.contains("h.heartbeat_id"));
    }

    #[test]
    fn relation_does_not_use_line_or_time_proximity_as_an_identity() {
        let sql = canonical_winner_relation("h.user_id = ?", "h");
        assert!(!sql.contains("ai_lines_added"));
        assert!(!sql.contains("toStartOfInterval"));
        assert!(sql.contains("generateUUIDv4()"));
        assert!(!sql.contains("concat('legacy:', h.entity"));
    }

    #[test]
    fn relation_keeps_multi_file_tool_events_independent() {
        let sql = canonical_winner_relation("h.user_id = ?", "h");
        let event_key = sql.find("length(ifNull(h.ai_event_id, '')) > 0").unwrap();
        let change_key = sql.find("length(ifNull(h.ai_change_id, '')) > 0").unwrap();
        assert!(event_key < change_key, "per-file event ids must win first");
        assert!(sql.contains("|entity:"));
        assert!(sql.contains("|session:"));
        // Identity metadata is mutable: a repair appends a higher revision and
        // may add the turn/message reference later. It must not change the
        // partition key or the old and corrected rows would both be aggregated.
        assert!(!sql.contains("ifNull(h.identity_turn_id, '')"));
        assert!(!sql.contains("ifNull(h.identity_message_id, '')"));
    }
}

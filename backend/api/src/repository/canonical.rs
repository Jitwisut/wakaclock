//! Shared ClickHouse relation for attribution-canonical heartbeat reads.
//!
//! Heartbeats are append-only because a late producer can only be reconciled safely
//! by writing a higher full-value revision. Every aggregate must therefore select one
//! winner before summing. Rows with no operation identity receive a fresh
//! query-local key so independent legacy rows are never merged by matching
//! entity/time metadata.

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
                         coalesce( \
                           nullIf(h.ai_change_id, ''), \
                           nullIf(h.ai_event_id, ''), \
                           nullIf(h.heartbeat_id, ''), \
                           concat('legacy:', toString(generateUUIDv4())) \
                         ) \
                       ORDER BY h.revision DESC, h.created_at DESC, h.time DESC \
                   ) AS canonical_rank \
            FROM wakaclock.heartbeats AS h \
            WHERE {predicate} \
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
}

//! Immutable pre-CLI tool evidence in the existing broker database. Receipts are
//! retained after materialization; accepting a boundary never requires its pair.
//! All identity components are frozen by the caller and scoped to a verified owner.
use super::{AppError, BrokerEventV1, BrokerIngestOutcome, BrokerStore};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};

pub(super) fn initialize(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS broker_tool_pairs (
            scope_id TEXT NOT NULL, pair_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            batch_json TEXT, last_error_code TEXT,
            next_event_index INTEGER NOT NULL DEFAULT 0,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY(scope_id,pair_id)
        );
        CREATE TABLE IF NOT EXISTS broker_tool_boundaries (
            scope_id TEXT NOT NULL, observation_id TEXT NOT NULL,
            pair_id TEXT NOT NULL, phase TEXT NOT NULL,
            payload_hash TEXT NOT NULL, semantic_hash TEXT NOT NULL,
            observation_json TEXT NOT NULL,
            PRIMARY KEY(scope_id,observation_id),
            UNIQUE(scope_id,pair_id,phase)
        );
        CREATE INDEX IF NOT EXISTS broker_tool_pairs_pending
            ON broker_tool_pairs(scope_id,status,attempt_count);",
    )?;
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(broker_tool_pairs)")?
        .query_map([], |r| r.get(1))?
        .collect::<Result<_, _>>()?;
    if !columns.iter().any(|name| name == "next_event_index") {
        conn.execute(
            "ALTER TABLE broker_tool_pairs ADD COLUMN next_event_index INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    Ok(())
}

pub struct BoundaryReceipt<'a> {
    pub scope_id: &'a str,
    pub observation_id: &'a str,
    pub pair_id: &'a str,
    pub phase: &'a str,
    pub payload_hash: &'a str,
    /// Binds phase, original time and owner/adapter/surface as well as metadata.
    pub semantic_hash: &'a str,
    pub observation_json: &'a str,
    pub unavailable: bool,
}

pub struct StoredToolPair {
    pub observations: Vec<String>,
    pub batch: Option<Vec<BrokerEventV1>>,
    pub next_event_index: usize,
}

impl BrokerStore {
    /// ACK boundary evidence only after this immediate FULL-synchronous transaction
    /// commits. A reused phase/ID cannot replace the original measurement.
    pub fn accept_tool_boundary(
        &mut self,
        receipt: BoundaryReceipt<'_>,
    ) -> Result<BrokerIngestOutcome, AppError> {
        if !matches!(receipt.phase, "before" | "after" | "abort") {
            return Err(AppError::Validation(
                "producer_boundary_phase_invalid".into(),
            ));
        }
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing: Option<(String, String, String, String)> = tx
            .query_row(
                "SELECT pair_id,phase,payload_hash,semantic_hash FROM broker_tool_boundaries
             WHERE scope_id=?1 AND observation_id=?2",
                params![receipt.scope_id, receipt.observation_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .optional()?;
        if let Some((pair, phase, hash, semantic)) = existing {
            if pair != receipt.pair_id
                || phase != receipt.phase
                || hash != receipt.payload_hash
                || semantic != receipt.semantic_hash
            {
                return Err(AppError::Conflict("producer_boundary_id_conflict".into()));
            }
            tx.commit()?;
            return Ok(BrokerIngestOutcome::Duplicate);
        }
        let occupied: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM broker_tool_boundaries WHERE scope_id=?1 AND pair_id=?2
                AND (phase=?3 OR (phase IN ('after','abort') AND ?3 IN ('after','abort'))))",
            params![receipt.scope_id, receipt.pair_id, receipt.phase],
            |r| r.get(0),
        )?;
        if occupied {
            return Err(AppError::Conflict(
                "producer_boundary_phase_conflict".into(),
            ));
        }
        tx.execute(
            "INSERT OR IGNORE INTO broker_tool_pairs(scope_id,pair_id) VALUES(?1,?2)",
            params![receipt.scope_id, receipt.pair_id],
        )?;
        tx.execute(
            "INSERT INTO broker_tool_boundaries(scope_id,observation_id,pair_id,phase,payload_hash,semantic_hash,observation_json)
             VALUES(?1,?2,?3,?4,?5,?6,?7)",
            params![receipt.scope_id,receipt.observation_id,receipt.pair_id,receipt.phase,receipt.payload_hash,receipt.semantic_hash,receipt.observation_json],
        )?;
        if receipt.unavailable || receipt.phase == "abort" {
            tx.execute("UPDATE broker_tool_pairs SET status=?3,last_error_code=?4 WHERE scope_id=?1 AND pair_id=?2 AND status='pending'",
                params![receipt.scope_id,receipt.pair_id,if receipt.unavailable {"unavailable"} else {"aborted"},if receipt.unavailable {Some("producer_measurement_unavailable")} else {None}])?;
        }
        tx.commit()?;
        Ok(BrokerIngestOutcome::Accepted)
    }

    pub fn pending_tool_pairs(&self, scope: &str, limit: usize) -> Result<Vec<String>, AppError> {
        Ok(self
            .pending_tool_pairs_scoped(&[scope.to_owned()], limit)?
            .into_iter()
            .map(|(_, pair)| pair)
            .collect())
    }

    /// Fairness spans verified historical scopes as well as pairs within an owner.
    pub fn pending_tool_pairs_scoped(
        &self,
        scopes: &[String],
        limit: usize,
    ) -> Result<Vec<(String, String)>, AppError> {
        let mut statement=self.conn.prepare(
            "SELECT p.scope_id,p.pair_id FROM broker_tool_pairs p WHERE p.scope_id IN (SELECT value FROM json_each(?1)) AND p.status='pending'
             AND (SELECT COUNT(*) FROM broker_tool_boundaries b WHERE b.scope_id=p.scope_id AND b.pair_id=p.pair_id)=2
             ORDER BY p.attempt_count,p.scope_id,p.pair_id LIMIT ?2")?;
        let rows = statement.query_map(
            params![serde_json::to_string(scopes)?, limit.min(1000) as i64],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn load_tool_pair(
        &self,
        scope: &str,
        pair: &str,
    ) -> Result<Option<StoredToolPair>, AppError> {
        let batch: Option<(Option<String>,usize)> = self.conn.query_row(
            "SELECT batch_json,next_event_index FROM broker_tool_pairs WHERE scope_id=?1 AND pair_id=?2 AND status='pending'",
            params![scope,pair], |r| Ok((r.get(0)?,r.get(1)?)),
        ).optional()?;
        let Some((batch, next_event_index)) = batch else {
            return Ok(None);
        };
        let mut statement = self.conn.prepare(
            "SELECT observation_json FROM broker_tool_boundaries WHERE scope_id=?1 AND pair_id=?2 ORDER BY phase",
        )?;
        let observations = statement
            .query_map(params![scope, pair], |r| r.get(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Some(StoredToolPair {
            observations,
            next_event_index,
            batch: batch.map(|json| serde_json::from_str(&json)).transpose()?,
        }))
    }

    /// Persist the complete duration-assigned event batch before any broker ingest.
    /// Concurrent drainers read the winner's frozen batch, never rewrite it.
    pub fn freeze_tool_batch(
        &self,
        scope: &str,
        pair: &str,
        batch: &[BrokerEventV1],
    ) -> Result<Vec<BrokerEventV1>, AppError> {
        self.conn.execute(
            "UPDATE broker_tool_pairs SET batch_json=?3 WHERE scope_id=?1 AND pair_id=?2 AND batch_json IS NULL AND status='pending'",
            params![scope,pair,serde_json::to_string(batch)?],
        )?;
        let json: String = self.conn.query_row(
            "SELECT batch_json FROM broker_tool_pairs WHERE scope_id=?1 AND pair_id=?2",
            params![scope, pair],
            |r| r.get(0),
        )?;
        Ok(serde_json::from_str(&json)?)
    }

    pub fn finish_tool_pair(&self, scope: &str, pair: &str, status: &str) -> Result<(), AppError> {
        if !matches!(status, "materialized" | "aborted" | "unavailable") {
            return Err(AppError::Validation(
                "producer_boundary_status_invalid".into(),
            ));
        }
        self.conn.execute(
            "UPDATE broker_tool_pairs SET status=?3,last_error_code=CASE WHEN last_error_code='producer_clock_unconfirmed' OR ?3='unavailable' THEN last_error_code ELSE NULL END WHERE scope_id=?1 AND pair_id=?2 AND status='pending'",
            params![scope,pair,status],
        )?;
        Ok(())
    }

    /// Progress is committed only after the corresponding broker chunk is durable.
    /// A lost progress write replays that same chunk, preserving per-event duration.
    pub fn advance_tool_pair(&self, scope: &str, pair: &str, next: usize) -> Result<(), AppError> {
        self.conn.execute("UPDATE broker_tool_pairs SET next_event_index=MAX(next_event_index,?3) WHERE scope_id=?1 AND pair_id=?2 AND status='pending'",params![scope,pair,next as i64])?;
        Ok(())
    }

    pub fn tool_boundary_health(&self, scope: &str) -> Result<serde_json::Value, AppError> {
        let count = |condition: &str| -> Result<i64, AppError> {
            Ok(self.conn.query_row(
                &format!(
                    "SELECT COUNT(*) FROM broker_tool_pairs p WHERE scope_id=?1 AND {condition}"
                ),
                params![scope],
                |r| r.get(0),
            )?)
        };
        Ok(serde_json::json!({
            "pending":count("status='pending'")?,
            "ready":count("status='pending' AND (SELECT COUNT(*) FROM broker_tool_boundaries b WHERE b.scope_id=p.scope_id AND b.pair_id=p.pair_id)=2")?,
            "unavailable":count("status='unavailable'")?,
            "retry_pending":count("status='pending' AND last_error_code IS NOT NULL")?,
            "materialized":count("status='materialized'")?,
            "aborted":count("status='aborted'")?,
            "clock_unconfirmed":count("last_error_code='producer_clock_unconfirmed'")?
        }))
    }

    pub fn note_tool_pair_retry(
        &self,
        scope: &str,
        pair: &str,
        code: &str,
    ) -> Result<(), AppError> {
        self.conn.execute(
            "UPDATE broker_tool_pairs SET attempt_count=attempt_count+1,last_error_code=COALESCE(NULLIF(?3,''),last_error_code) WHERE scope_id=?1 AND pair_id=?2 AND status='pending'",
            params![scope,pair,code],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn receipt<'a>(scope: &'a str, id: &'a str, phase: &'a str) -> BoundaryReceipt<'a> {
        BoundaryReceipt {
            scope_id: scope,
            observation_id: id,
            pair_id: "pair",
            phase,
            payload_hash: "hash",
            semantic_hash: "semantic",
            observation_json: "{}",
            unavailable: false,
        }
    }
    #[test]
    fn ready_selection_is_fair_across_verified_owner_scopes() {
        let path = std::env::temp_dir().join(format!(
            "tool-boundary-fairness-{}.db",
            uuid::Uuid::new_v4()
        ));
        let mut store = BrokerStore::open_at(&path).unwrap();
        for scope in ["owner-a", "owner-b"] {
            store
                .accept_tool_boundary(receipt(scope, "start", "before"))
                .unwrap();
            store
                .accept_tool_boundary(receipt(scope, "end", "after"))
                .unwrap();
        }
        let scopes = vec!["owner-a".into(), "owner-b".into()];
        assert_eq!(
            store.pending_tool_pairs_scoped(&scopes, 1).unwrap()[0].0,
            "owner-a"
        );
        store.note_tool_pair_retry("owner-a", "pair", "").unwrap();
        assert_eq!(
            store.pending_tool_pairs_scoped(&scopes, 1).unwrap()[0].0,
            "owner-b"
        );
        assert_eq!(
            store.tool_boundary_health("owner-a").unwrap()["retry_pending"],
            0
        );
        drop(store);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn scope_order_conflict_receipts_survive_reopen_and_completion() {
        let path =
            std::env::temp_dir().join(format!("tool-boundaries-{}.db", uuid::Uuid::new_v4()));
        {
            let mut store = BrokerStore::open_at(&path).unwrap();
            assert_eq!(
                store
                    .accept_tool_boundary(receipt("owner-a", "end", "after"))
                    .unwrap(),
                BrokerIngestOutcome::Accepted
            );
            assert!(store.pending_tool_pairs("owner-a", 10).unwrap().is_empty());
            store
                .accept_tool_boundary(receipt("owner-b", "start", "before"))
                .unwrap();
            assert!(store.pending_tool_pairs("owner-a", 10).unwrap().is_empty());
            store
                .accept_tool_boundary(receipt("owner-a", "start", "before"))
                .unwrap();
            assert_eq!(
                store.pending_tool_pairs("owner-a", 10).unwrap(),
                vec!["pair"]
            );
            assert!(store
                .accept_tool_boundary(receipt("owner-a", "other-start", "before"))
                .is_err());
            assert!(store
                .accept_tool_boundary(receipt("owner-a", "abort", "abort"))
                .is_err());
            let mut changed = receipt("owner-a", "end", "after");
            changed.semantic_hash = "changed-time";
            assert!(store.accept_tool_boundary(changed).is_err());
            store.freeze_tool_batch("owner-a", "pair", &[]).unwrap();
            store
                .finish_tool_pair("owner-a", "pair", "materialized")
                .unwrap();
        }
        let mut store = BrokerStore::open_at(&path).unwrap();
        assert!(store.pending_tool_pairs("owner-a", 10).unwrap().is_empty());
        assert_eq!(
            store
                .accept_tool_boundary(receipt("owner-a", "end", "after"))
                .unwrap(),
            BrokerIngestOutcome::Duplicate
        );
        assert!(store.load_tool_pair("owner-b", "pair").unwrap().is_some());
        drop(store);
        let _ = std::fs::remove_file(path);
    }
}

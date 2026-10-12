//! Frozen context observations share the broker's durable inbox and owner scope.
//! No path, source, command, current workspace lookup or inferred event time.
use super::{AppError, BrokerIngestOutcome, BrokerStore};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FrozenBinding {
    pub origin: String,
    pub user_id: uuid::Uuid,
    pub organization_id: uuid::Uuid,
    pub collector_id: uuid::Uuid,
    pub project_id: uuid::Uuid,
    pub repository_id: uuid::Uuid,
    pub repository: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FrozenContext {
    pub context_version: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_provenance: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_effective_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub binding: Option<FrozenBinding>,
    pub native_session: Option<String>,
    pub repository: Option<String>,
    pub branch: Option<String>,
    pub commit_sha: Option<String>,
    pub reason: Option<String>,
}
impl FrozenContext {
    pub fn valid(&self) -> bool {
        self.context_version == 1
            && matches!(
                (
                    self.project_provenance.as_deref(),
                    self.project_effective_at
                ),
                (None, None) | (Some("user_confirmed"), Some(_))
            )
            && self.binding.as_ref().is_none_or(|binding| {
                self.repository.as_deref() == Some(binding.repository.as_str())
                    && crate::config::Config::normalize_server_url(&binding.origin).is_ok()
                    && reqwest::Url::parse(&binding.origin).is_ok_and(|u| u.password().is_none())
            })
            && self
                .native_session
                .as_ref()
                .is_none_or(|s| !s.is_empty() && s.len() <= 512 && !s.chars().any(char::is_control))
            && self.repository.as_ref().is_none_or(|s| {
                crate::session_context::github_repository(&format!("https://github.com/{s}"))
                    == Some(s.clone())
            })
            && self
                .branch
                .as_ref()
                .is_none_or(|s| !s.is_empty() && s.len() <= 256 && !s.chars().any(char::is_control))
            && self.commit_sha.as_ref().is_none_or(|s| {
                matches!(s.len(), 40 | 64) && s.bytes().all(|b| b.is_ascii_hexdigit())
            })
            && self.reason.as_deref().is_none_or(|s| {
                matches!(
                    s,
                    "native_session_unavailable"
                        | "repository_context_ambiguous"
                        | "workspace_evidence_unavailable"
                        | "historical_context_unavailable"
                        | "repository_evidence_unavailable"
                )
            })
            && (self.reason.is_some()
                || (self.native_session.is_some() && self.repository.is_some()))
    }
}
pub struct ContextReceipt<'a> {
    pub scope: &'a str,
    pub id: &'a str,
    pub adapter: &'a str,
    pub surface: &'a str,
    pub at: DateTime<Utc>,
    pub evidence: &'a FrozenContext,
}
pub struct StoredContext {
    pub id: String,
    pub adapter: String,
    pub at: DateTime<Utc>,
    pub evidence: FrozenContext,
}
pub(super) fn initialize(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS broker_context_observations(scope TEXT NOT NULL,id TEXT NOT NULL,adapter TEXT NOT NULL,surface TEXT NOT NULL,observed_at TEXT NOT NULL,evidence TEXT NOT NULL,semantic_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT,retry_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(scope,id)); CREATE INDEX IF NOT EXISTS broker_context_pending ON broker_context_observations(scope,status,retry_at); CREATE TABLE IF NOT EXISTS broker_context_checkpoints(identity TEXT PRIMARY KEY,last_scope TEXT NOT NULL);")?;
    Ok(())
}
impl BrokerStore {
    pub fn accept_context(
        &mut self,
        r: ContextReceipt<'_>,
    ) -> Result<BrokerIngestOutcome, AppError> {
        if !r.evidence.valid() || r.evidence.project_effective_at.is_some_and(|at| at > r.at) {
            return Err(AppError::Validation("producer_context_invalid".into()));
        }
        let payload = serde_json::to_string(r.evidence)?;
        let hash = format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&(
                r.adapter, r.surface, r.at, r.evidence
            ))?)
        );
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let old: Option<String> = tx
            .query_row(
                "SELECT semantic_hash FROM broker_context_observations WHERE scope=?1 AND id=?2",
                params![r.scope, r.id],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(old) = old {
            if old != hash {
                return Err(AppError::Conflict("producer_context_conflict".into()));
            }
            tx.commit()?;
            return Ok(BrokerIngestOutcome::Duplicate);
        }
        tx.execute("INSERT INTO broker_context_observations(scope,id,adapter,surface,observed_at,evidence,semantic_hash,status,reason) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)", params![r.scope,r.id,r.adapter,r.surface,r.at.to_rfc3339(),payload,hash,if r.evidence.reason.is_some(){"unresolved"}else{"pending"},r.evidence.reason])?;
        tx.commit()?;
        Ok(BrokerIngestOutcome::Accepted)
    }
    /// Durable round-robin across verified aliases. Advancing before a bounded
    /// projection batch prevents a busy scope from starving the remaining scopes.
    pub fn next_context_scope(&self, scopes: &[String]) -> Result<Vec<String>, AppError> {
        if scopes.is_empty() {
            return Ok(Vec::new());
        }
        let mut ordered = scopes.to_vec();
        ordered.sort();
        ordered.dedup();
        let identity = format!("{:x}", Sha256::digest(serde_json::to_vec(&ordered)?));
        let previous: Option<String> = self
            .conn
            .query_row(
                "SELECT last_scope FROM broker_context_checkpoints WHERE identity=?1",
                [&identity],
                |r| r.get(0),
            )
            .optional()?;
        let index = previous
            .and_then(|s| ordered.iter().position(|v| *v == s))
            .map_or(0, |i| (i + 1) % ordered.len());
        ordered.rotate_left(index);
        self.conn.execute("INSERT INTO broker_context_checkpoints(identity,last_scope) VALUES(?1,?2) ON CONFLICT(identity) DO UPDATE SET last_scope=excluded.last_scope",params![identity,ordered[0]])?;
        Ok(ordered)
    }
    pub fn pending_context(
        &self,
        scope: &str,
        now: i64,
        limit: usize,
    ) -> Result<Vec<StoredContext>, AppError> {
        let mut statement = self.conn.prepare("SELECT id,adapter,observed_at,evidence FROM broker_context_observations WHERE scope=?1 AND status='pending' AND retry_at<=?2 ORDER BY retry_at,observed_at,id LIMIT ?3")?;
        let rows = statement.query_map(params![scope, now, limit.min(100)], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?;
        rows.map(|row| {
            let (id, adapter, at, evidence) = row?;
            Ok(StoredContext {
                id,
                adapter,
                at: DateTime::parse_from_rfc3339(&at)
                    .map_err(|_| AppError::Validation("context_timestamp_invalid".into()))?
                    .with_timezone(&Utc),
                evidence: serde_json::from_str(&evidence)?,
            })
        })
        .collect()
    }
    pub fn finish_context(
        &self,
        scope: &str,
        id: &str,
        reason: Option<&str>,
        now: i64,
    ) -> Result<(), AppError> {
        self.conn.execute("UPDATE broker_context_observations SET status=?3,reason=?4,retry_at=?5 WHERE scope=?1 AND id=?2 AND status='pending'",params![scope,id,if reason.is_none(){"projected"}else{"pending"},reason,now+60])?;
        Ok(())
    }
    pub fn context_stages(
        &self,
        scopes: &[String],
        now: DateTime<Utc>,
        version: &str,
    ) -> Result<Vec<crate::queue::PipelineStageHealth>, AppError> {
        let mut stages = Vec::new();
        for scope in scopes {
            let mut query=self.conn.prepare("SELECT adapter,surface,count(*) FILTER(WHERE status='pending'),count(*) FILTER(WHERE status='unresolved'),min(observed_at) FILTER(WHERE status!='projected'),min(reason) FILTER(WHERE status!='projected') FROM broker_context_observations WHERE scope=?1 GROUP BY adapter,surface")?;
            for row in query.query_map([scope], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, u32>(2)?,
                    r.get::<_, u32>(3)?,
                    r.get::<_, Option<String>>(4)?,
                    r.get::<_, Option<String>>(5)?,
                ))
            })? {
                let (adapter, surface, pending, unresolved, oldest, reason) = row?;
                let reason = reason.filter(|r| {
                    matches!(
                        r.as_str(),
                        "context_binding_unresolved"
                            | "context_binding_changed"
                            | "repository_mapping_unresolved"
                            | "native_session_unavailable"
                            | "repository_context_ambiguous"
                            | "workspace_evidence_unavailable"
                            | "historical_context_unavailable"
                            | "repository_evidence_unavailable"
                    )
                });
                stages.push(crate::queue::PipelineStageHealth {
                    adapter_id: adapter,
                    execution_surface: surface,
                    stage: "context".into(),
                    status: if unresolved > 0 || reason.is_some() {
                        "unresolved"
                    } else if pending > 0 {
                        "pending"
                    } else {
                        "observed"
                    }
                    .into(),
                    pending: Some(pending.saturating_add(unresolved)),
                    failure_count: 0,
                    last_observed_at: Some(now),
                    oldest_pending_at: oldest
                        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                        .map(|at| at.with_timezone(&Utc)),
                    error_code: reason,
                    version: version.into(),
                });
            }
        }
        Ok(stages)
    }
    pub fn context_health(&self, scopes: &[String]) -> Result<serde_json::Value, AppError> {
        let mut pending = 0i64;
        let mut unresolved = 0i64;
        let mut oldest: Option<String> = None;
        for scope in scopes {
            let (p,u,at)=self.conn.query_row("SELECT count(*) FILTER(WHERE status='pending'),count(*) FILTER(WHERE status='unresolved'),min(observed_at) FILTER(WHERE status!='projected') FROM broker_context_observations WHERE scope=?1",[scope],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?,r.get::<_,Option<String>>(2)?)))?;
            pending += p;
            unresolved += u;
            if let Some(at) = at {
                if oldest.as_ref().is_none_or(|old| at < *old) {
                    oldest = Some(at);
                }
            }
        }
        Ok(
            serde_json::json!({"status":if unresolved>0{"unresolved"}else if pending>0{"pending"}else{"unconfirmed"},"pending":pending,"unresolved":unresolved,"oldest_pending_at":oldest,"reason":"queue_state_does_not_prove_provider_capture_completeness"}),
        )
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn user_confirmation_is_optional_and_cannot_claim_native_or_future_context() {
        let old = serde_json::json!({"context_version":1,"native_session":"task","repository":"o/r","branch":null,"commit_sha":null,"reason":null,"binding":null});
        let mut e: FrozenContext = serde_json::from_value(old.clone()).unwrap();
        assert_eq!(serde_json::to_value(&e).unwrap(), old);
        e.project_provenance = Some("native".into());
        e.project_effective_at = Some(Utc::now());
        assert!(!e.valid());
        e.project_provenance = Some("user_confirmed".into());
        assert!(e.valid());
        let root =
            std::env::temp_dir().join(format!("roo-context-{}.sqlite", uuid::Uuid::new_v4()));
        let mut store = BrokerStore::open_at(&root).unwrap();
        let at = Utc::now();
        e.project_effective_at = Some(at + chrono::Duration::seconds(1));
        assert!(store
            .accept_context(ContextReceipt {
                scope: "scope",
                id: "original",
                adapter: "roo-code",
                surface: "ide",
                at,
                evidence: &e
            })
            .is_err());
        e.project_effective_at = Some(at);
        assert_eq!(
            store
                .accept_context(ContextReceipt {
                    scope: "scope",
                    id: "original",
                    adapter: "roo-code",
                    surface: "ide",
                    at,
                    evidence: &e
                })
                .unwrap(),
            BrokerIngestOutcome::Accepted
        );
        drop(store);
        std::fs::remove_file(root).unwrap();
    }
    #[test]
    fn context_scope_rotation_is_durable_and_credentials_are_refused() {
        let path =
            std::env::temp_dir().join(format!("context-round-{}.sqlite", uuid::Uuid::new_v4()));
        let scopes = vec!["b".into(), "a".into()];
        let store = BrokerStore::open_at(&path).unwrap();
        assert_eq!(store.next_context_scope(&scopes).unwrap()[0], "a");
        drop(store);
        let store = BrokerStore::open_at(&path).unwrap();
        assert_eq!(store.next_context_scope(&scopes).unwrap()[0], "b");
        assert_eq!(store.next_context_scope(&scopes).unwrap()[0], "a");
        let mut evidence = FrozenContext {
            context_version: 1,
            project_provenance: None,
            project_effective_at: None,
            native_session: Some("s".into()),
            repository: Some("o/r".into()),
            branch: None,
            commit_sha: None,
            reason: None,
            binding: Some(FrozenBinding {
                origin: "https://:secret@stage.test".into(),
                user_id: uuid::Uuid::new_v4(),
                organization_id: uuid::Uuid::new_v4(),
                collector_id: uuid::Uuid::new_v4(),
                project_id: uuid::Uuid::new_v4(),
                repository_id: uuid::Uuid::new_v4(),
                repository: "o/r".into(),
            }),
        };
        assert!(!evidence.valid());
        evidence.binding.as_mut().unwrap().origin = "https://stage.test".into();
        assert!(evidence.valid());
        drop(store);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn frozen_context_survives_restart_and_conflicting_id_is_retained() {
        let root = std::env::temp_dir().join(format!("context-{}.sqlite", uuid::Uuid::new_v4()));
        let evidence = FrozenContext {
            context_version: 1,
            project_provenance: None,
            project_effective_at: None,
            binding: None,
            native_session: Some("task".into()),
            repository: Some("owner/repo".into()),
            branch: Some("original".into()),
            commit_sha: None,
            reason: None,
        };
        let at = Utc::now();
        let receipt = || ContextReceipt {
            scope: "owner",
            id: "id",
            adapter: "codex",
            surface: "unknown",
            at,
            evidence: &evidence,
        };
        {
            let mut store = BrokerStore::open_at(&root).unwrap();
            assert_eq!(
                store.accept_context(receipt()).unwrap(),
                BrokerIngestOutcome::Accepted
            );
        }
        let mut store = BrokerStore::open_at(&root).unwrap();
        assert_eq!(
            store.accept_context(receipt()).unwrap(),
            BrokerIngestOutcome::Duplicate
        );
        let mut changed = evidence.clone();
        changed.branch = Some("current".into());
        assert!(store
            .accept_context(ContextReceipt {
                evidence: &changed,
                ..receipt()
            })
            .is_err());
        assert!(store
            .pending_context("other", at.timestamp(), 100)
            .unwrap()
            .is_empty());
        assert_eq!(
            store.pending_context("owner", at.timestamp(), 100).unwrap()[0]
                .evidence
                .branch,
            Some("original".into())
        );
        store
            .finish_context(
                "owner",
                "id",
                Some("configuration_unavailable"),
                at.timestamp(),
            )
            .unwrap();
        assert!(store
            .pending_context("owner", at.timestamp(), 100)
            .unwrap()
            .is_empty());
        assert_eq!(
            store.context_health(&["owner".into()]).unwrap()["pending"],
            1
        );
        std::fs::remove_file(root).unwrap();
    }
}

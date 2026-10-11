//! Separate metadata stream: recording context never creates or changes a heartbeat.
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{path::Path, process::Command, time::Duration};
use uuid::Uuid;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SessionContext {
    pub event_id: String,
    pub session_id: String,
    pub collector_id: Uuid,
    pub project_id: Uuid,
    pub repository_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub branch: Option<String>,
    pub commit_sha: Option<String>,
    pub provenance: String,
}
#[derive(Debug, PartialEq)]
pub struct GitMetadata {
    pub repository: String,
    pub branch: Option<String>,
    pub commit_sha: Option<String>,
}
/// Allow only GitHub.com repository coordinates. Userinfo/credential/query/path never leave here.
pub fn github_repository(remote: &str) -> Option<String> {
    let path = if let Some(path) = remote.strip_prefix("git@github.com:") {
        path.to_string()
    } else {
        let url = reqwest::Url::parse(remote).ok()?;
        if !matches!(url.scheme(), "https" | "ssh")
            || url.host_str() != Some("github.com")
            || url.port().is_some()
        {
            return None;
        }
        url.path().trim_start_matches('/').to_string()
    };
    let path = path.trim_end_matches('/').trim_end_matches(".git");
    let parts: Vec<_> = path.split('/').collect();
    if parts.len() != 2
        || parts.iter().any(|p| {
            p.is_empty()
                || *p == "."
                || *p == ".."
                || !p
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
        })
    {
        return None;
    }
    Some(format!(
        "{}/{}",
        parts[0].to_ascii_lowercase(),
        parts[1].to_ascii_lowercase()
    ))
}
pub fn observe_git(workspace: &Path) -> Option<GitMetadata> {
    let read = |args: &[&str]| -> Option<String> {
        let out = Command::new("git")
            .arg("-C")
            .arg(workspace)
            .args(args)
            .output()
            .ok()?;
        if !out.status.success() || out.stdout.len() > 4096 {
            return None;
        }
        Some(String::from_utf8(out.stdout).ok()?.trim().to_string())
    };
    let repository =
        github_repository(&read(&["config", "--local", "--get", "remote.origin.url"])?)?;
    let branch = read(&["symbolic-ref", "--quiet", "--short", "HEAD"])
        .filter(|s| !s.is_empty() && s.len() <= 256 && !s.chars().any(char::is_control));
    let commit_sha = read(&["rev-parse", "--verify", "HEAD"])
        .filter(|s| matches!(s.len(), 40 | 64) && s.bytes().all(|b| b.is_ascii_hexdigit()));
    Some(GitMetadata {
        repository,
        branch,
        commit_sha,
    })
}
pub fn canonical_session(user: Uuid, agent: &str, collector: Uuid, usage_session: &str) -> String {
    // Matches the canonical usage/receipt identity; usage_session is already producer scoped.
    format!(
        "{:x}",
        Sha256::digest(
            format!("{user}:{}:{agent}:{collector}:{usage_session}", agent.len()).as_bytes()
        )
    )
}
impl SessionContext {
    pub fn observed(
        user: Uuid,
        agent: &str,
        collector: Uuid,
        usage_session: &str,
        project: Uuid,
        repository: Uuid,
        at: DateTime<Utc>,
        git: GitMetadata,
    ) -> Self {
        let session_id = canonical_session(user, agent, collector, usage_session);
        let identity = serde_json::to_vec(&(
            user,
            repository,
            &session_id,
            at,
            &git.branch,
            &git.commit_sha,
        ))
        .expect("metadata serializes");
        Self {
            event_id: format!("{:x}", Sha256::digest(identity)),
            session_id,
            collector_id: collector,
            project_id: project,
            repository_id: repository,
            occurred_at: at,
            branch: git.branch,
            commit_sha: git.commit_sha,
            provenance: "native_session_git".into(),
        }
    }
}
pub struct ContextQueue {
    conn: Connection,
}
pub struct PendingContext {
    pub event: SessionContext,
    pub lease: String,
    pub attempts: i64,
}
impl ContextQueue {
    pub fn open(path: &Path) -> Result<Self> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let file = std::fs::OpenOptions::new()
                .create(true)
                .truncate(false)
                .write(true)
                .open(path)?;
            file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
        }
        let conn = Connection::open(path)?;
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS session_context_queue(origin TEXT NOT NULL,owner TEXT NOT NULL,organization TEXT NOT NULL,event_id TEXT NOT NULL,payload TEXT NOT NULL,payload_hash TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0,lease TEXT,lease_until INTEGER,dead_letter TEXT,PRIMARY KEY(origin,owner,organization,event_id));")?;
        Ok(Self { conn })
    }
    /// Persist context and the last observed state in the same transaction. The
    /// observation survives ACK/restart; unchanged activity creates no extra rows.
    pub fn observe_changed(
        &mut self,
        origin: &str,
        owner: Uuid,
        org: Uuid,
        event: &SessionContext,
    ) -> Result<bool> {
        self.conn.execute_batch("CREATE TABLE IF NOT EXISTS session_context_observations(origin TEXT NOT NULL,owner TEXT NOT NULL,organization TEXT NOT NULL,session TEXT NOT NULL,repository TEXT NOT NULL,state_hash TEXT NOT NULL,observed_at TEXT NOT NULL,PRIMARY KEY(origin,owner,organization,session,repository)); CREATE TABLE IF NOT EXISTS session_context_observation_receipts(origin TEXT NOT NULL,owner TEXT NOT NULL,organization TEXT NOT NULL,event_id TEXT NOT NULL,payload_hash TEXT NOT NULL,PRIMARY KEY(origin,owner,organization,event_id))")?;
        let tx = self
            .conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let state = format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&(
                event.project_id,
                &event.branch,
                &event.commit_sha
            ))?)
        );
        let owner = owner.to_string();
        let org = org.to_string();
        let repository = event.repository_id.to_string();
        let at = event
            .occurred_at
            .to_rfc3339_opts(chrono::SecondsFormat::Nanos, true);
        // Accepted identity evidence survives ACK and restart.
        let payload = serde_json::to_string(event)?;
        let hash = format!("{:x}", Sha256::digest(payload.as_bytes()));
        let receipt: Option<String> = tx.query_row(
            "SELECT payload_hash FROM session_context_observation_receipts WHERE origin=?1 AND owner=?2 AND organization=?3 AND event_id=?4",
            params![origin, owner, org, event.event_id], |r| r.get(0),
        ).optional()?;
        if let Some(existing) = receipt {
            if existing != hash {
                return Err("context identity conflict".into());
            }
            tx.commit()?;
            return Ok(false);
        }
        tx.execute("INSERT INTO session_context_observation_receipts(origin,owner,organization,event_id,payload_hash) VALUES(?1,?2,?3,?4,?5)", params![origin,owner,org,event.event_id,hash])?;
        let prior=tx.query_row("SELECT state_hash,observed_at FROM session_context_observations WHERE origin=?1 AND owner=?2 AND organization=?3 AND session=?4 AND repository=?5",params![origin,owner,org,event.session_id,repository],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).optional()?;
        let delayed = prior.as_ref().is_some_and(|(_, old)| old >= &at);
        // Preserve delayed historical evidence without rewinding current state.
        if !delayed && prior.as_ref().is_some_and(|(hash, _)| hash == &state) {
            tx.execute("UPDATE session_context_observations SET observed_at=?6 WHERE origin=?1 AND owner=?2 AND organization=?3 AND session=?4 AND repository=?5",params![origin,owner,org,event.session_id,repository,at])?;
            tx.commit()?;
            return Ok(false);
        }
        let n=tx.execute("INSERT INTO session_context_queue(origin,owner,organization,event_id,payload,payload_hash) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(origin,owner,organization,event_id) DO UPDATE SET event_id=excluded.event_id WHERE payload_hash=excluded.payload_hash",params![origin,owner,org,event.event_id,payload,hash])?;
        if n != 1 {
            return Err("context identity conflict".into());
        }
        if !delayed {
            tx.execute("INSERT INTO session_context_observations(origin,owner,organization,session,repository,state_hash,observed_at) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(origin,owner,organization,session,repository) DO UPDATE SET state_hash=excluded.state_hash,observed_at=excluded.observed_at",params![origin,owner,org,event.session_id,repository,state,at])?;
        }
        tx.commit()?;
        Ok(true)
    }
    pub fn enqueue(
        &self,
        origin: &str,
        owner: Uuid,
        org: Uuid,
        event: &SessionContext,
    ) -> Result<()> {
        let payload = serde_json::to_string(event)?;
        let hash = format!("{:x}", Sha256::digest(payload.as_bytes()));
        let n=self.conn.execute("INSERT INTO session_context_queue(origin,owner,organization,event_id,payload,payload_hash) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(origin,owner,organization,event_id) DO UPDATE SET event_id=excluded.event_id WHERE payload_hash=excluded.payload_hash",params![origin,owner.to_string(),org.to_string(),event.event_id,payload,hash])?;
        if n != 1 {
            return Err("context identity conflict".into());
        }
        Ok(())
    }
    pub fn status(
        &self,
        origin: &str,
        owner: Uuid,
        org: Uuid,
        now: i64,
    ) -> Result<serde_json::Value> {
        let (pending,ready,leased,dead,oldest)=self.conn.query_row("SELECT count(*) FILTER(WHERE dead_letter IS NULL),count(*) FILTER(WHERE dead_letter IS NULL AND retry_at<=?4 AND (lease_until IS NULL OR lease_until<=?4)),count(*) FILTER(WHERE dead_letter IS NULL AND lease_until>?4),count(*) FILTER(WHERE dead_letter IS NOT NULL),min(json_extract(payload,'$.occurred_at')) FILTER(WHERE dead_letter IS NULL) FROM session_context_queue WHERE origin=?1 AND owner=?2 AND organization=?3",params![origin,owner.to_string(),org.to_string(),now],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?,r.get::<_,i64>(2)?,r.get::<_,i64>(3)?,r.get::<_,Option<String>>(4)?)))?;
        Ok(
            serde_json::json!({"pending":pending,"eligible":ready,"leased":leased,"dead_letter":dead,"oldest_pending_at":oldest,"capture_status":"unconfirmed","capture_reason":"queue_state_does_not_prove_provider_capture_completeness"}),
        )
    }
    pub fn claim(
        &mut self,
        origin: &str,
        owner: Uuid,
        org: Uuid,
        now: i64,
    ) -> Result<Option<PendingContext>> {
        let tx = self
            .conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let row=tx.query_row("SELECT event_id,payload,attempts FROM session_context_queue WHERE origin=?1 AND owner=?2 AND organization=?3 AND retry_at<=?4 AND dead_letter IS NULL AND (lease_until IS NULL OR lease_until<=?4) ORDER BY retry_at,event_id LIMIT 1",params![origin,owner.to_string(),org.to_string(),now],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,i64>(2)?))).optional()?;
        let Some((id, payload, attempts)) = row else {
            return Ok(None);
        };
        let lease = Uuid::new_v4().to_string();
        tx.execute("UPDATE session_context_queue SET lease=?5,lease_until=?6,attempts=attempts+1 WHERE origin=?1 AND owner=?2 AND organization=?3 AND event_id=?4",params![origin,owner.to_string(),org.to_string(),id,lease,now+90])?;
        tx.commit()?;
        Ok(Some(PendingContext {
            event: serde_json::from_str(&payload)?,
            lease,
            attempts: attempts + 1,
        }))
    }
    pub fn acknowledge(&self, pending: &PendingContext) -> Result<bool> {
        Ok(self.conn.execute(
            "DELETE FROM session_context_queue WHERE event_id=?1 AND lease=?2",
            params![pending.event.event_id, pending.lease],
        )? == 1)
    }
    pub fn retry(&self, pending: &PendingContext, at: i64, dead: Option<&str>) -> Result<()> {
        self.conn.execute("UPDATE session_context_queue SET retry_at=?3,dead_letter=?4,lease=NULL,lease_until=NULL WHERE event_id=?1 AND lease=?2",params![pending.event.event_id,pending.lease,at,dead])?;
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn remote_only_keeps_repository_coordinates() {
        for remote in [
            "https://user:secret@github.com/Owner/Repo.git?token=private",
            "git@github.com:Owner/Repo.git",
            "ssh://git@github.com/Owner/Repo.git",
        ] {
            assert_eq!(github_repository(remote).as_deref(), Some("owner/repo"));
        }
        for remote in [
            "https://github.com.evil.test/o/r",
            "https://github.com/o/r/secret",
            "file:///Users/private",
            "https://github.com/o/../r",
        ] {
            assert!(github_repository(remote).is_none());
        }
    }
    #[test]
    fn queue_survives_restart_and_rejects_duplicate_changes() {
        let file = std::env::temp_dir().join(format!("team-context-{}.sqlite", Uuid::new_v4()));
        let owner = Uuid::new_v4();
        let org = Uuid::new_v4();
        let event = SessionContext::observed(
            owner,
            "codex",
            Uuid::new_v4(),
            "ws1_session",
            Uuid::new_v4(),
            Uuid::new_v4(),
            Utc::now(),
            GitMetadata {
                repository: "o/r".into(),
                branch: Some("task".into()),
                commit_sha: Some("a".repeat(40)),
            },
        );
        {
            let mut q = ContextQueue::open(&file).unwrap();
            q.enqueue("https://stage.test", owner, org, &event).unwrap();
            q.enqueue("https://stage.test", owner, org, &event).unwrap();
            assert!(q
                .claim("https://other.test", owner, org, 1)
                .unwrap()
                .is_none());
            let lease = q
                .claim("https://stage.test", owner, org, 1)
                .unwrap()
                .unwrap();
            assert!(q
                .claim("https://stage.test", owner, org, 2)
                .unwrap()
                .is_none());
            q.retry(&lease, 10, None).unwrap();
        }
        let mut q = ContextQueue::open(&file).unwrap();
        assert!(q
            .claim("https://stage.test", owner, org, 9)
            .unwrap()
            .is_none());
        let pending = q
            .claim("https://stage.test", owner, org, 10)
            .unwrap()
            .unwrap();
        assert_eq!(pending.event, event);
        let mut changed = event.clone();
        changed.branch = Some("changed".into());
        assert!(q
            .enqueue("https://stage.test", owner, org, &changed)
            .is_err());
        assert!(q.acknowledge(&pending).unwrap());
        assert!(q
            .claim("https://stage.test", owner, org, 200)
            .unwrap()
            .is_none());
        drop(q);
        let _ = std::fs::remove_file(file);
    }
    #[test]
    fn observed_changes_commit_with_cursor_and_survive_ack_restart() {
        let path = std::env::temp_dir().join(format!("context-change-{}.sqlite", Uuid::new_v4()));
        let owner = Uuid::new_v4();
        let org = Uuid::new_v4();
        let mut e = SessionContext::observed(
            owner,
            "codex",
            Uuid::new_v4(),
            "ws1_s",
            Uuid::new_v4(),
            Uuid::new_v4(),
            DateTime::from_timestamp(10, 0).unwrap(),
            GitMetadata {
                repository: "o/r".into(),
                branch: Some("a".into()),
                commit_sha: Some("a".repeat(40)),
            },
        );
        {
            let mut q = ContextQueue::open(&path).unwrap();
            assert!(q
                .observe_changed("https://stage.test", owner, org, &e)
                .unwrap());
            let pending = q
                .claim("https://stage.test", owner, org, 1)
                .unwrap()
                .unwrap();
            assert!(q.acknowledge(&pending).unwrap());
        }
        let mut q = ContextQueue::open(&path).unwrap();
        e.occurred_at = DateTime::from_timestamp(20, 0).unwrap();
        e.event_id = "unchanged-new-observation".into();
        assert!(!q
            .observe_changed("https://stage.test", owner, org, &e)
            .unwrap());
        e.branch = Some("b".into());
        e.occurred_at = DateTime::from_timestamp(15, 0).unwrap();
        e.event_id = "delayed-observation".into();
        assert!(q
            .observe_changed("https://stage.test", owner, org, &e)
            .unwrap());
        assert!(!q
            .observe_changed("https://stage.test", owner, org, &e)
            .unwrap());
        let delayed = q
            .claim("https://stage.test", owner, org, 1)
            .unwrap()
            .unwrap();
        assert_eq!(delayed.event.occurred_at.timestamp(), 15);
        assert!(q.acknowledge(&delayed).unwrap());
        let mut conflict = e.clone();
        conflict.branch = Some("conflict".into());
        assert!(q
            .observe_changed("https://stage.test", owner, org, &conflict)
            .is_err());
        let last: String = q
            .conn
            .query_row(
                "SELECT observed_at FROM session_context_observations",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(last.starts_with("1970-01-01T00:00:20"));
        e.occurred_at = DateTime::from_timestamp(21, 0).unwrap();
        e.event_id = "changed".into();
        q.conn.execute_batch("PRAGMA query_only=ON").unwrap();
        assert!(q
            .observe_changed("https://stage.test", owner, org, &e)
            .is_err());
        q.conn.execute_batch("PRAGMA query_only=OFF").unwrap();
        assert!(q
            .observe_changed("https://stage.test", owner, org, &e)
            .unwrap());
        let old = q
            .claim("https://stage.test", owner, org, 1)
            .unwrap()
            .unwrap();
        let recovered = q
            .claim("https://stage.test", owner, org, 92)
            .unwrap()
            .unwrap();
        assert!(!q.acknowledge(&old).unwrap());
        assert_eq!(recovered.event.branch, Some("b".into()));
        assert!(q.acknowledge(&recovered).unwrap());
        drop(q);
        let _ = std::fs::remove_file(path);
    }
}

/// Native hooks are parsed locally. Only session identity and workspace metadata
/// survive this adapter; contents, edits, prompts and tool responses are discarded.
#[derive(Debug)]
pub struct NativeContext {
    pub agent: &'static str,
    pub native_session: String,
    pub workspaces: Vec<std::path::PathBuf>,
    pub provenance: &'static str,
}
pub fn native_context(provider: &str, payload: &serde_json::Value) -> Option<NativeContext> {
    let (agent, session, roots, inline) = match provider {
        "codex" => (
            "codex",
            payload["session_id"].as_str()?,
            vec![std::path::PathBuf::from(payload["cwd"].as_str()?)],
            false,
        ),
        "claude-code" => (
            "claude-code",
            payload["session_id"].as_str()?,
            vec![std::path::PathBuf::from(payload["cwd"].as_str()?)],
            false,
        ),
        "cursor" => {
            let hook = payload["hook_event_name"].as_str()?;
            if !matches!(
                hook,
                "sessionStart"
                    | "sessionEnd"
                    | "preToolUse"
                    | "postToolUse"
                    | "postToolUseFailure"
                    | "beforeShellExecution"
                    | "afterShellExecution"
                    | "afterFileEdit"
                    | "afterTabFileEdit"
                    | "stop"
            ) {
                return None;
            }
            let roots = payload["workspace_roots"]
                .as_array()?
                .iter()
                .filter_map(|v| v.as_str().map(std::path::PathBuf::from))
                .collect::<Vec<_>>();
            (
                "cursor",
                payload["conversation_id"].as_str()?,
                roots,
                hook == "afterTabFileEdit",
            )
        }
        // Daily provider metrics and general document changes provide no session identity.
        "copilot-vscode" => return None,
        _ => return None,
    };
    if session.is_empty()
        || session.len() > 512
        || session.chars().any(char::is_control)
        || roots.is_empty()
        || roots.len() > 32
        || roots.iter().any(|p| !p.is_absolute())
    {
        return None;
    }
    Some(NativeContext {
        agent,
        native_session: session.to_string(),
        workspaces: roots,
        provenance: if inline {
            "native_inline_git"
        } else {
            "native_session_git"
        },
    })
}
#[cfg(test)]
mod native_tests {
    use super::*;
    #[test]
    fn native_provider_fields_do_not_create_usage_or_copy_sensitive_payload() {
        for provider in ["codex", "claude-code"] {
            let parsed=native_context(provider,&serde_json::json!({"session_id":"native-session","cwd":std::env::temp_dir(),"prompt":"FORBIDDEN_PROMPT","tool_response":"FORBIDDEN_RESPONSE","source":"FORBIDDEN_SOURCE"})).unwrap();
            assert_eq!(parsed.native_session, "native-session");
            assert_eq!(parsed.workspaces.len(), 1);
            assert!(!format!("{parsed:?}").contains("FORBIDDEN"));
        }
        let inline=native_context("cursor",&serde_json::json!({"conversation_id":"native-session","hook_event_name":"afterTabFileEdit","workspace_roots":[std::env::temp_dir()],"edits":[{"old_string":"FORBIDDEN_SOURCE","new_string":"FORBIDDEN_RESPONSE"}]})).unwrap();
        assert_eq!(inline.provenance, "native_inline_git");
        assert!(!format!("{inline:?}").contains("FORBIDDEN"));
    }
    #[test]
    fn absent_or_daily_identity_is_explicitly_unresolved() {
        for provider in ["codex", "claude-code", "cursor", "copilot-vscode"] {
            assert!(native_context(
                provider,
                &serde_json::json!({"file_path":"/tmp/fixture","day":"2026-10-08","accepted":3})
            )
            .is_none());
        }
        assert!(native_context("cursor",&serde_json::json!({"conversation_id":"s","hook_event_name":"workspaceOpen","workspace_roots":[std::env::temp_dir()]})).is_none());
    }
}

//! Append-only display metadata. No writes to heartbeats, intervals, or rollups.
use crate::{
    model::{
        date_range::ResolvedRange,
        heartbeat::HeartbeatRow,
        matched_authorship::{MatchRequest, MatchResponse, MatchedAuthorship},
    },
    repository::matched_authorship::{MatchBase, MatchEvent, MatchedAuthorshipRepository},
    services::heartbeat::HeartbeatService,
};
use anyhow::Result;
use std::{
    collections::{BTreeSet, HashMap},
    sync::Arc,
};
use uuid::Uuid;

pub struct MatchedAuthorshipService {
    repo: Arc<MatchedAuthorshipRepository>,
    heartbeats: Arc<HeartbeatService>,
}
impl MatchedAuthorshipService {
    pub fn new(repo: Arc<MatchedAuthorshipRepository>, heartbeats: Arc<HeartbeatService>) -> Self {
        Self { repo, heartbeats }
    }
    pub async fn submit(&self, user: Uuid, request: MatchRequest) -> Result<MatchResponse> {
        request.validate().map_err(anyhow::Error::msg)?;
        let ids = vec![request.heartbeat_id.clone()];
        let bases = self.repo.bases(user, &ids).await?;
        if bases.is_empty() && request.operation == "match" {
            return Ok(MatchResponse {
                status: "base_pending".into(),
                digest: request.digest,
            });
        }
        let valid = bases.len() == 1 && eligible(&bases[0], request.base_revision);
        let event = MatchEvent {
            user_id: user,
            heartbeat_id: request.heartbeat_id,
            base_revision: request.base_revision,
            agent: request.agent,
            evidence_id: request.evidence_id,
            proof: request.proof,
            digest: request.digest,
            operation: if request.operation == "match" && !valid {
                "conflict".into()
            } else {
                request.operation
            },
        };
        let mut events = self.repo.events(user, &ids).await?;
        if !events
            .iter()
            .any(|stored| binding(stored) == binding(&event) && stored.operation == event.operation)
        {
            // Set semantics also handle concurrent retries across API replicas.
            self.repo.insert(&event).await?;
            events = self.repo.events(user, &ids).await?;
        }
        let status = project(user, &event.heartbeat_id, &events, &bases)
            .map(|v| v.status)
            .unwrap_or_else(|| "conflict".into());
        Ok(MatchResponse {
            status,
            digest: event.digest,
        })
    }
    pub async fn history(
        &self,
        user: Uuid,
        range: &ResolvedRange,
    ) -> Result<(Vec<HeartbeatRow>, HashMap<String, MatchedAuthorship>)> {
        let rows = self.heartbeats.get_by_date(user, range).await?;
        let ids: Vec<String> = rows.iter().filter_map(|r| r.heartbeat_id.clone()).collect();
        let mut overlays = HashMap::new();
        for chunk in ids.chunks(500) {
            if let Err(error) = self.load_overlays(user, chunk, &mut overlays).await {
                tracing::warn!(%error, "matched authorship unavailable for heartbeat history");
            }
        }
        Ok((rows, overlays))
    }

    async fn load_overlays(
        &self,
        user: Uuid,
        ids: &[String],
        overlays: &mut HashMap<String, MatchedAuthorship>,
    ) -> Result<()> {
        let events = self.repo.events(user, ids).await?;
        let ids: BTreeSet<_> = events
            .iter()
            .filter(|event| ids.contains(&event.heartbeat_id))
            .map(|event| event.heartbeat_id.clone())
            .collect();
        if ids.is_empty() {
            return Ok(());
        }
        let ids: Vec<_> = ids.into_iter().collect();
        let bases = self.repo.bases(user, &ids).await?;
        for id in ids {
            if let Some(value) = project(user, &id, &events, &bases) {
                overlays.insert(id, value);
            }
        }
        Ok(())
    }
}
fn eligible(base: &MatchBase, revision: u32) -> bool {
    let Ok(segments) = serde_json::from_str::<Vec<wakaclock_core::heartbeat::ActivitySegment>>(
        &base.activity_segments,
    ) else {
        return false;
    };
    base.revision == revision
        && base.actor_type == "unknown"
        && base.entity_type == "file"
        && matches!(
            base.editor.trim().to_ascii_lowercase().as_str(),
            "vscode" | "vs code"
        )
        && base.ai_source.as_deref().is_none_or(|v| v.is_empty())
        && segments
            .iter()
            .all(|s| matches!(s.source.as_deref(), Some("editor" | "editor_active_v1")))
}
fn binding(e: &MatchEvent) -> (&str, u32, &str, &str, &str, &str) {
    (
        &e.heartbeat_id,
        e.base_revision,
        &e.agent,
        &e.evidence_id,
        &e.proof,
        &e.digest,
    )
}
fn project(
    user: Uuid,
    id: &str,
    all: &[MatchEvent],
    bases: &[MatchBase],
) -> Option<MatchedAuthorship> {
    let events: Vec<_> = all
        .iter()
        .filter(|e| e.user_id == user && e.heartbeat_id == id)
        .collect();
    let first = *events.first()?;
    let claims: BTreeSet<_> = events.iter().map(|e| binding(e)).collect();
    let digests: BTreeSet<_> = events.iter().map(|e| e.digest.as_str()).collect();
    let base: Vec<_> = bases.iter().filter(|b| b.heartbeat_id == id).collect();
    let conflict = claims.len() != 1
        || events.iter().any(|e| e.operation == "conflict")
        || all.iter().filter(|e| e.user_id == user).any(|e| {
            (e.digest == first.digest || e.evidence_id == first.evidence_id)
                && binding(e) != binding(first)
        });
    let revoked = events.iter().any(|e| e.operation == "revoke");
    let status = if conflict {
        "conflict"
    } else if revoked {
        "revoked"
    } else if base.len() == 1 && eligible(base[0], first.base_revision) {
        "matched"
    } else {
        "conflict"
    };
    Some(MatchedAuthorship {
        agent: "claude-code".into(),
        status: status.into(),
        digest: (digests.len() == 1).then(|| first.digest.clone()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn event(user: Uuid, id: &str, digest: &str) -> MatchEvent {
        MatchEvent {
            user_id: user,
            heartbeat_id: id.into(),
            base_revision: 0,
            agent: "claude-code".into(),
            evidence_id: "evidence".into(),
            proof: "fingerprint".into(),
            digest: digest.into(),
            operation: "match".into(),
        }
    }
    fn base() -> MatchBase {
        MatchBase {
            heartbeat_id: "h".into(),
            revision: 0,
            actor_type: "unknown".into(),
            entity_type: "file".into(),
            editor: "VS Code".into(),
            activity_segments:
                r#"[{"segment_id":"s","start":1.0,"end":2.0,"source":"editor_active_v1"}]"#.into(),
            ai_source: None,
        }
    }
    #[test]
    fn retries_revokes_and_conflicts_are_order_independent() {
        let user = Uuid::nil();
        let a = event(user, "h", "a");
        let b = event(user, "h", "b");
        assert_eq!(
            project(user, "h", &[a.clone(), a.clone()], &[base()])
                .unwrap()
                .status,
            "matched"
        );
        for events in [vec![a.clone(), b.clone()], vec![b, a.clone()]] {
            let p = project(user, "h", &events, &[base()]).unwrap();
            assert_eq!(p.status, "conflict");
            assert!(p.digest.is_none());
        }
        let mut revoke = a.clone();
        revoke.operation = "revoke".into();
        assert_eq!(
            project(user, "h", &[revoke, a.clone()], &[base()])
                .unwrap()
                .status,
            "revoked"
        );
        let mut changed = a.clone();
        changed.heartbeat_id = "other".into();
        assert_eq!(
            project(user, "h", &[a, changed], &[base()]).unwrap().status,
            "conflict"
        );
    }
    #[test]
    fn accounts_and_changed_bases_fail_closed() {
        let user = Uuid::nil();
        let a = event(user, "h", "a");
        let foreign = event(Uuid::now_v7(), "h", "b");
        assert!(project(user, "h", std::slice::from_ref(&foreign), &[base()]).is_none());
        assert_eq!(
            project(user, "h", &[a.clone(), foreign], &[base()])
                .unwrap()
                .status,
            "matched"
        );
        let mut human = base();
        human.actor_type = "human".into();
        for bases in [vec![], vec![base(), base()], vec![human]] {
            assert_eq!(
                project(user, "h", std::slice::from_ref(&a), &bases)
                    .unwrap()
                    .status,
                "conflict"
            );
        }
    }
}

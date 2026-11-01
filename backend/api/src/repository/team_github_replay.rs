use super::team_github::GithubRepositoryStore;
use crate::model::team_github::GithubInputError;
use crate::model::team_replay::{ReplayCheckFact, ReplayWorkItem, TEAM_REPLAY_MAX_ITEMS};
use anyhow::Result;
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// `None` means the member has no live verified GitHub identity. Authorship is what keeps
/// replay personal: another member's pull request in a shared repository is never returned.
const OWN_ITEMS_SQL: &str = "SELECT w.repository_id,w.external_id,w.number,w.head_sha,w.opened_at,w.ready_at,w.first_review_at,w.merged_at,w.closed_at,w.lifecycle_coverage,r.full_name,b.project_ids \
FROM team_work_items w \
JOIN team_repository_scopes s USING(organization_id,repository_id) \
JOIN team_github_repositories r USING(organization_id,repository_id) \
JOIN LATERAL (SELECT array_agg(m.project_id ORDER BY m.project_id) AS project_ids FROM team_member_project_bindings m WHERE m.organization_id=w.organization_id AND m.repository_id=w.repository_id AND m.user_id=$2) b ON b.project_ids IS NOT NULL \
WHERE w.organization_id=$1 AND w.kind='pull_request' AND w.author_github_id=$3 AND s.enabled \
AND w.opened_at<$5 AND w.provider_updated_at>=$4 \
AND (s.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=s.team_id AND tm.user_id=$2) OR EXISTS(SELECT 1 FROM organization_members om WHERE om.organization_id=$1 AND om.user_id=$2 AND om.deactivated_at IS NULL AND om.role IN ('owner','admin'))) \
ORDER BY w.opened_at,w.repository_id,w.external_id LIMIT $6";

/// Reads every retained check of a head, not only those inside the range: judging a head
/// from part of its checks could report success while a failed check sits outside it.
const CHECK_FACTS_SQL: &str = "SELECT DISTINCT ON (i.repository_id,i.external_id,f.metadata->>'head_sha',f.kind,COALESCE(f.metadata->>'context',f.metadata->>'name',f.external_id)) i.repository_id,i.external_id,f.occurred_at,f.metadata \
FROM unnest($2::uuid[],$3::bigint[],$4::text[]) AS i(repository_id,external_id,head_sha) \
JOIN team_github_facts f ON f.organization_id=$1 AND f.repository_id=i.repository_id AND f.kind IN ('check_run','status') AND (f.work_item_id=i.external_id OR f.metadata->>'head_sha'=i.head_sha) \
WHERE f.occurred_at>=$5 \
ORDER BY i.repository_id,i.external_id,f.metadata->>'head_sha',f.kind,COALESCE(f.metadata->>'context',f.metadata->>'name',f.external_id),f.occurred_at DESC,f.observed_at DESC";

impl GithubRepositoryStore {
    pub async fn own_replay_work(
        &self,
        org: Uuid,
        user: Uuid,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        retained_from: DateTime<Utc>,
    ) -> Result<Option<(Vec<ReplayWorkItem>, Vec<ReplayCheckFact>)>> {
        let Some(identity) = self
            .pg
            .query_opt(
                "SELECT github_user_id FROM team_github_identities WHERE user_id=$1 AND revoked_at IS NULL",
                &[&user],
            )
            .await?
        else {
            return Ok(None);
        };
        let github_user: i64 = identity.get(0);
        let lower = start.max(retained_from);
        let limit = TEAM_REPLAY_MAX_ITEMS as i64 + 1;
        let rows = self
            .pg
            .query(
                OWN_ITEMS_SQL,
                &[&org, &user, &github_user, &lower, &end, &limit],
            )
            .await?;
        if rows.len() > TEAM_REPLAY_MAX_ITEMS {
            return Err(GithubInputError(
                "replay range has too many pull requests; choose a shorter range",
            )
            .into());
        }
        let items = rows
            .into_iter()
            .map(|row| ReplayWorkItem {
                repository_id: row.get("repository_id"),
                external_id: row.get("external_id"),
                number: row.get("number"),
                head_sha: row.get("head_sha"),
                opened_at: row.get("opened_at"),
                ready_at: row.get("ready_at"),
                first_review_at: row.get("first_review_at"),
                merged_at: row.get("merged_at"),
                closed_at: row.get("closed_at"),
                lifecycle_coverage: row.get("lifecycle_coverage"),
                repository: row.get("full_name"),
                project_ids: row.get("project_ids"),
            })
            .collect::<Vec<_>>();
        if items.is_empty() {
            return Ok(Some((items, Vec::new())));
        }
        let repositories = items.iter().map(|i| i.repository_id).collect::<Vec<_>>();
        let externals = items.iter().map(|i| i.external_id).collect::<Vec<_>>();
        let heads = items.iter().map(|i| i.head_sha.clone()).collect::<Vec<_>>();
        let facts = self
            .pg
            .query(
                CHECK_FACTS_SQL,
                &[&org, &repositories, &externals, &heads, &retained_from],
            )
            .await?
            .into_iter()
            .map(|row| ReplayCheckFact {
                repository_id: row.get(0),
                external_id: row.get(1),
                occurred_at: row.get(2),
                metadata: row.get(3),
            })
            .collect();
        Ok(Some((items, facts)))
    }
}

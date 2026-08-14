use anyhow::Result;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

use crate::model::project_identity::{
    BackfillPreview, BackfillPreviewItem, ProjectAliasRow, ProjectIdentityRow,
};
use crate::repository::project_identity::ProjectIdentityRepository;
use crate::repository::project_merge::ProjectMergeRepository;

/// Namespace for deriving deterministic project ids (RFC 4122 v5).
///
/// A fixed namespace is what makes the PR 9.9 backfill re-runnable: the same
/// `(user_id, canonical_name)` always yields the same id, so a backfill can be interrupted
/// and resumed, or run twice, without minting duplicate identities for the same project.
/// A random v4 would make re-running the backfill produce a second identity for history
/// that already had one.
const PROJECT_NAMESPACE: Uuid = Uuid::from_bytes([
    0x9c, 0x2f, 0x4b, 0x1a, 0x7d, 0x3e, 0x4f, 0x58, 0x8a, 0x61, 0xb4, 0xd7, 0xe0, 0x93, 0x25, 0x6c,
]);

/// How many merge hops to follow before giving up. `ProjectMergeService` rejects direct
/// A->B/B->A cycles, but not longer ones (A->B->C->A), and a malformed chain must not spin
/// forever inside a heartbeat write.
const MAX_MERGE_HOPS: usize = 16;

pub struct ProjectIdentityService {
    repo: Arc<ProjectIdentityRepository>,
    merge_repo: Arc<ProjectMergeRepository>,
}

impl ProjectIdentityService {
    pub fn new(
        repo: Arc<ProjectIdentityRepository>,
        merge_repo: Arc<ProjectMergeRepository>,
    ) -> Self {
        Self { repo, merge_repo }
    }

    /// Resolves an incoming project name to a stable `project_id`, minting one the first
    /// time a project is seen.
    ///
    /// Returns `None` for a nameless heartbeat rather than inventing an "Unknown" identity —
    /// an unresolved project must stay visibly unresolved, not silently become a real
    /// project that shows up in the list with a URL.
    pub async fn resolve_project_id(
        &self,
        user_id: Uuid,
        project: Option<&str>,
        repository: Option<&str>,
    ) -> Result<Option<Uuid>> {
        let Some(name) = project.map(str::trim).filter(|name| !name.is_empty()) else {
            return Ok(None);
        };

        // An alias hit short-circuits everything below. This is what makes a rename safe:
        // the old name keeps pointing at the identity it already had instead of being
        // re-derived into a new one and orphaning its history.
        if let Some(alias) = self.repo.find_alias(user_id, name).await? {
            return Ok(Some(alias.project_id));
        }

        let merges = self.merge_repo.list_by_user(user_id).await?;
        let canonical = canonical_name(name, &merges);

        let now = chrono::Utc::now().timestamp().max(0) as u32;

        // Read before deriving. The persisted row is authoritative — `derive_project_id` is
        // only ever used to mint a *new* identity, never to re-derive an existing one,
        // because a canonical name that changed would otherwise fork the project.
        let project_id = match self
            .repo
            .find_by_canonical_name(user_id, &canonical)
            .await?
        {
            Some(existing) => {
                self.repo
                    .upsert_identity(&ProjectIdentityRow {
                        last_heartbeat_at: now,
                        updated_at: now,
                        // ReplacingMergeTree keeps the highest version for this
                        // (user_id, project_id), so this updates in place.
                        version: u64::from(now),
                        repository: pick_repository(&existing.repository, repository),
                        ..existing.clone()
                    })
                    .await?;
                existing.project_id
            }
            None => {
                let project_id = derive_project_id(user_id, &canonical);
                self.repo
                    .upsert_identity(&ProjectIdentityRow {
                        user_id,
                        project_id,
                        canonical_name: canonical.clone(),
                        display_name: canonical.clone(),
                        repository: repository.unwrap_or_default().to_string(),
                        root_fingerprint: String::new(),
                        first_heartbeat_at: now,
                        last_heartbeat_at: now,
                        created_at: now,
                        updated_at: now,
                        version: u64::from(now),
                    })
                    .await?;
                project_id
            }
        };

        // Record the name as it arrived, so the next heartbeat under this name takes the
        // alias short-circuit above and never re-runs merge resolution.
        self.repo
            .upsert_alias(&ProjectAliasRow {
                user_id,
                alias: name.to_string(),
                project_id,
                created_at: now,
                updated_at: now,
            })
            .await?;

        Ok(Some(project_id))
    }

    /// Every project endpoint must prove the caller owns the project before returning
    /// anything about it (plan.md 9.3). A `project_id` is guessable in a way a name is not
    /// — it appears in URLs — so this is the check that stops one account reading another's
    /// project by id.
    ///
    /// Not called yet: the endpoints keyed by `project_id` arrive in PR 9.7/9.8. It lives
    /// here because 9.2 owns the ownership rule, and shipping the rule with the identity it
    /// guards is what stops each later endpoint from inventing its own version.
    #[allow(dead_code)]
    pub async fn verify_ownership(&self, user_id: Uuid, project_id: Uuid) -> Result<bool> {
        Ok(self
            .repo
            .find_by_project_id(user_id, project_id)
            .await?
            .is_some())
    }

    /// Reports what a historical backfill would do, without writing anything.
    ///
    /// PR 9.9 owns the actual backfill. This exists so that migration can be inspected
    /// against real data first — how many identities it would mint, and which names the
    /// merge mapping would fold together — rather than discovered after the fact.
    pub async fn backfill_dry_run(&self, user_id: Uuid) -> Result<BackfillPreview> {
        let unresolved = self.repo.list_unresolved_projects(user_id).await?;
        let merges = self.merge_repo.list_by_user(user_id).await?;

        let mut items = Vec::with_capacity(unresolved.len());
        let mut unresolved_heartbeats = 0u64;
        // Two names that merge onto the same target share one identity, so count distinct
        // ids rather than rows — otherwise a merged pair reads as two creations.
        let mut would_create: HashSet<Uuid> = HashSet::new();

        for row in unresolved {
            let name = row.project.trim();
            unresolved_heartbeats += row.heartbeat_count;

            if name.is_empty() {
                continue;
            }

            let canonical = canonical_name(name, &merges);
            let existing = self
                .repo
                .find_by_canonical_name(user_id, &canonical)
                .await?;
            let project_id = match &existing {
                Some(identity) => identity.project_id,
                None => derive_project_id(user_id, &canonical),
            };

            if existing.is_none() {
                would_create.insert(project_id);
            }

            items.push(BackfillPreviewItem {
                project: name.to_string(),
                is_merged: canonical != name,
                canonical_name: canonical,
                project_id,
                identity_exists: existing.is_some(),
                heartbeat_count: row.heartbeat_count,
            });
        }

        Ok(BackfillPreview {
            unresolved_projects: items.len(),
            unresolved_heartbeats,
            identities_to_create: would_create.len(),
            items,
        })
    }
}

/// Picks the repository to store, preferring what is already recorded.
///
/// A heartbeat may arrive without git context (an AI agent hook editing a file outside a
/// checkout, for example), and an empty value from one client must not erase what another
/// already established.
fn pick_repository(existing: &str, incoming: Option<&str>) -> String {
    if !existing.is_empty() {
        return existing.to_string();
    }
    incoming.unwrap_or_default().to_string()
}

/// Follows the user's merge mapping to the end of the chain.
///
/// Merges are applied here, at resolution time, so that every alias of a merged project
/// lands on one identity. plan.md 9.3 is explicit that renaming rows at read time instead
/// duplicates sessions, tokens and usage when the same source appears under two names.
fn canonical_name(name: &str, merges: &[crate::model::project_merge::ProjectMergeRow]) -> String {
    let mapping: HashMap<&str, &str> = merges
        .iter()
        .map(|merge| (merge.source_project.as_str(), merge.target_project.as_str()))
        .collect();

    let mut current = name;
    let mut seen = HashSet::new();
    seen.insert(current);

    for _ in 0..MAX_MERGE_HOPS {
        let Some(next) = mapping.get(current) else {
            break;
        };
        // A cycle means the mapping is malformed; stop on the current name rather than
        // looping. Resolution has to stay total — a bad merge rule must not fail a write.
        if !seen.insert(*next) {
            break;
        }
        current = next;
    }

    current.to_string()
}

/// Deterministic id for a project, scoped to its owner.
///
/// The user id is part of the hashed name, not just an external scope, so two accounts with
/// a project called "api" get different ids and neither can guess the other's.
fn derive_project_id(user_id: Uuid, canonical_name: &str) -> Uuid {
    Uuid::new_v5(
        &PROJECT_NAMESPACE,
        format!("{user_id}:{canonical_name}").as_bytes(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::project_merge::ProjectMergeRow;

    fn merge(source: &str, target: &str) -> ProjectMergeRow {
        ProjectMergeRow {
            user_id: Uuid::nil(),
            merge_id: Uuid::nil(),
            source_project: source.to_string(),
            target_project: target.to_string(),
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn derived_id_is_stable_across_calls() {
        let user = Uuid::from_u128(1);
        assert_eq!(
            derive_project_id(user, "wakaclock"),
            derive_project_id(user, "wakaclock"),
            "a backfill must be able to re-run without minting a second identity"
        );
    }

    #[test]
    fn derived_id_is_scoped_to_the_owner() {
        let name = "api";
        assert_ne!(
            derive_project_id(Uuid::from_u128(1), name),
            derive_project_id(Uuid::from_u128(2), name),
            "two accounts sharing a project name must not share an identity"
        );
    }

    #[test]
    fn different_names_get_different_ids() {
        let user = Uuid::from_u128(1);
        assert_ne!(
            derive_project_id(user, "api"),
            derive_project_id(user, "web")
        );
    }

    #[test]
    fn canonical_name_is_the_name_itself_without_merges() {
        assert_eq!(canonical_name("api", &[]), "api");
    }

    #[test]
    fn canonical_name_follows_a_merge() {
        let merges = vec![merge("old-api", "api")];
        assert_eq!(canonical_name("old-api", &merges), "api");
    }

    #[test]
    fn canonical_name_follows_a_merge_chain_to_the_end() {
        let merges = vec![merge("a", "b"), merge("b", "c")];
        assert_eq!(
            canonical_name("a", &merges),
            "c",
            "an alias of an alias must land on one identity, not an intermediate one"
        );
    }

    #[test]
    fn merged_names_collapse_onto_one_id() {
        let user = Uuid::from_u128(1);
        let merges = vec![merge("old-api", "api")];
        assert_eq!(
            derive_project_id(user, &canonical_name("old-api", &merges)),
            derive_project_id(user, &canonical_name("api", &merges)),
            "merging exists so both names resolve to a single project"
        );
    }

    #[test]
    fn a_merge_cycle_terminates_instead_of_looping() {
        let merges = vec![merge("a", "b"), merge("b", "c"), merge("c", "a")];
        // The exact landing name does not matter; not hanging and returning something in
        // the cycle does. A malformed merge rule must not be able to stall a write.
        let resolved = canonical_name("a", &merges);
        assert!(["a", "b", "c"].contains(&resolved.as_str()));
    }

    #[test]
    fn a_name_that_is_not_a_merge_source_is_untouched() {
        let merges = vec![merge("old-api", "api")];
        assert_eq!(canonical_name("web", &merges), "web");
    }

    #[test]
    fn existing_repository_is_not_erased_by_a_heartbeat_without_git_context() {
        assert_eq!(
            pick_repository("git@github.com:me/api.git", None),
            "git@github.com:me/api.git"
        );
        assert_eq!(
            pick_repository("git@github.com:me/api.git", Some("")),
            "git@github.com:me/api.git"
        );
    }

    #[test]
    fn repository_is_taken_from_the_heartbeat_when_none_is_recorded() {
        assert_eq!(
            pick_repository("", Some("git@github.com:me/api.git")),
            "git@github.com:me/api.git"
        );
        assert_eq!(pick_repository("", None), "");
    }
}

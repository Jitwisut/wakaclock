use anyhow::{anyhow, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::model::org::{ROLE_MEMBER, ROLE_OWNER};
use crate::model::team::{TeamMemberRow, TeamRow};
use crate::repository::team::TeamRepository;
use crate::services::org::{now_secs, OrgService};

pub struct TeamService {
    repo: Arc<TeamRepository>,
    org_service: Arc<OrgService>,
}

impl TeamService {
    pub fn new(repo: Arc<TeamRepository>, org_service: Arc<OrgService>) -> Self {
        Self { repo, org_service }
    }

    /// Only an org owner/admin can create a team — matches plan.md 6.1's stated rule
    /// that only those roles may manage org structure, applied here one level down.
    pub async fn create(&self, org_id: Uuid, actor_user_id: Uuid, name: String) -> Result<TeamRow> {
        self.org_service
            .require_admin(org_id, actor_user_id)
            .await?;

        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(anyhow!("name cannot be empty"));
        }

        let now = now_secs();
        let team = TeamRow {
            team_id: Uuid::new_v4(),
            org_id,
            name,
            created_at: now,
            updated_at: now,
        };
        self.repo.insert_team(&team).await?;

        // The creator is automatically a team member — otherwise the person who just
        // made the team wouldn't be able to create a presence room tied to it.
        self.repo
            .upsert_member(&TeamMemberRow {
                team_id: team.team_id,
                user_id: actor_user_id,
                role: ROLE_OWNER.to_string(),
                joined_at: now,
                updated_at: now,
            })
            .await?;

        Ok(team)
    }

    pub async fn add_member(
        &self,
        team_id: Uuid,
        actor_user_id: Uuid,
        member_user_id: Uuid,
    ) -> Result<()> {
        let team = self
            .repo
            .get(team_id)
            .await?
            .ok_or_else(|| anyhow!("team not found"))?;

        self.org_service
            .require_admin(team.org_id, actor_user_id)
            .await?;

        let now = now_secs();
        self.repo
            .upsert_member(&TeamMemberRow {
                team_id,
                user_id: member_user_id,
                role: ROLE_MEMBER.to_string(),
                joined_at: now,
                updated_at: now,
            })
            .await
    }

    pub async fn list_for_org(&self, org_id: Uuid) -> Result<Vec<TeamRow>> {
        self.repo.list_for_org(org_id).await
    }

    pub async fn get(&self, team_id: Uuid) -> Result<Option<TeamRow>> {
        self.repo.get(team_id).await
    }

    pub async fn is_member(&self, team_id: Uuid, user_id: Uuid) -> Result<bool> {
        self.repo.is_member(team_id, user_id).await
    }
}

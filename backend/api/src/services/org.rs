use anyhow::{anyhow, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::model::org::{OrgMemberRow, OrgRow, ROLE_ADMIN, ROLE_OWNER};
use crate::repository::org::OrgRepository;

pub struct OrgService {
    repo: Arc<OrgRepository>,
}

impl OrgService {
    pub fn new(repo: Arc<OrgRepository>) -> Self {
        Self { repo }
    }

    pub async fn create(&self, owner_user_id: Uuid, name: String) -> Result<OrgRow> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(anyhow!("name cannot be empty"));
        }

        let now = now_secs();
        let org = OrgRow {
            org_id: Uuid::new_v4(),
            name,
            owner_user_id,
            created_at: now,
            updated_at: now,
        };
        self.repo.insert_org(&org).await?;

        self.repo
            .upsert_member(&OrgMemberRow {
                org_id: org.org_id,
                user_id: owner_user_id,
                role: ROLE_OWNER.to_string(),
                joined_at: now,
                updated_at: now,
            })
            .await?;

        Ok(org)
    }

    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<OrgRow>> {
        self.repo.list_for_user(user_id).await
    }

    /// `None` means "not a member at all" — distinct from having a low-privilege role,
    /// so callers can tell "not in this org" apart from "in it, but not allowed to do X".
    pub async fn role_of(&self, org_id: Uuid, user_id: Uuid) -> Result<Option<String>> {
        self.repo.member_role(org_id, user_id).await
    }

    /// Used by `TeamService::create` — creating a team requires being an org
    /// owner/admin, not just any member.
    pub async fn require_admin(&self, org_id: Uuid, user_id: Uuid) -> Result<()> {
        match self.repo.member_role(org_id, user_id).await? {
            Some(role) if role == ROLE_OWNER || role == ROLE_ADMIN => Ok(()),
            Some(_) => Err(anyhow!("only an org owner or admin can do this")),
            None => Err(anyhow!("not a member of this org")),
        }
    }
}

pub fn now_secs() -> u32 {
    chrono::Utc::now().timestamp().max(0) as u32
}

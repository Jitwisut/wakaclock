use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::organization::{
    AddOrganizationMemberRequest, CreateOrganizationRequest, CreateOrganizationTeamRequest,
    Organization, OrganizationAnalytics, OrganizationMember, OrganizationTeam,
    UpdateOrganizationRequest,
};
use crate::services::authorization::{AuthorizationService, Entitlement, OrganizationAction};

// Keep the role validation in one place. PostgreSQL also has a CHECK constraint,
// but validating before the query gives clients a stable 400 instead of a driver error.
const ROLES: &[&str] = &["admin", "member", "viewer"];
const SEAT_TYPES: &[&str] = &["developer", "viewer"];

pub struct OrganizationsService {
    postgres: Option<Arc<PostgresClient>>,
    authorization: Arc<AuthorizationService>,
}

impl OrganizationsService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        authorization: Arc<AuthorizationService>,
    ) -> Self {
        Self {
            postgres,
            authorization,
        }
    }

    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<Organization>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT o.id, o.slug, o.name, o.personal_owner_id, o.created_at, o.updated_at
                 FROM organizations o
                 JOIN organization_members m ON m.organization_id = o.id
                 WHERE m.user_id = $1 AND m.deactivated_at IS NULL AND o.deleted_at IS NULL
                 ORDER BY o.created_at ASC",
                &[&user_id],
            )
            .await
            .context("failed to list organizations")?;
        rows.into_iter().map(organization_from_row).collect()
    }

    pub async fn create(
        &self,
        owner_user_id: Uuid,
        request: CreateOrganizationRequest,
    ) -> Result<Organization> {
        let name = request.name.trim();
        if name.is_empty() || name.len() > 160 {
            return Err(anyhow!("organization name must contain 1-160 characters"));
        }
        let slug = normalize_slug(request.slug.as_deref().unwrap_or(name))?;
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO organizations (id, slug, name, personal_owner_id)
                 VALUES ($1, $2, $3, NULL)
                 RETURNING id, slug, name, personal_owner_id, created_at, updated_at",
                &[&id, &slug, &name],
            )
            .await
            .context("failed to create organization")?;
        postgres
            .client()
            .execute(
                "INSERT INTO organization_members
                    (organization_id, user_id, role, seat_type)
                 VALUES ($1, $2, 'owner', 'developer')",
                &[&id, &owner_user_id],
            )
            .await
            .context("failed to create organization owner membership")?;
        self.audit(
            id,
            owner_user_id,
            "organization.created",
            "organization",
            Some(id),
            serde_json::json!({ "slug": slug }),
        )
        .await?;
        organization_from_row(row)
    }

    pub async fn get(&self, actor: Uuid, organization_id: Uuid) -> Result<Option<Organization>> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ReadSelf, None)
            .await?;
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT id, slug, name, personal_owner_id, created_at, updated_at
                 FROM organizations WHERE id = $1 AND deleted_at IS NULL",
                &[&organization_id],
            )
            .await
            .context("failed to load organization")?;
        row.map(organization_from_row).transpose()
    }

    pub async fn update(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        request: UpdateOrganizationRequest,
    ) -> Result<Option<Organization>> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ManageTeams, None)
            .await?;
        let Some(name) = request.name else {
            return self.get(actor, organization_id).await;
        };
        let name = name.trim();
        if name.is_empty() || name.len() > 160 {
            return Err(anyhow!("organization name must contain 1-160 characters"));
        }
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "UPDATE organizations SET name = $2, updated_at = now()
                 WHERE id = $1 AND deleted_at IS NULL
                 RETURNING id, slug, name, personal_owner_id, created_at, updated_at",
                &[&organization_id, &name],
            )
            .await
            .context("failed to update organization")?;
        if row.is_some() {
            self.audit(
                organization_id,
                actor,
                "organization.updated",
                "organization",
                Some(organization_id),
                serde_json::json!({ "name_changed": true }),
            )
            .await?;
        }
        row.map(organization_from_row).transpose()
    }

    pub async fn members(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<OrganizationMember>> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ReadOrganization, None)
            .await?;
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT m.user_id, u.username, e.email, m.role, m.seat_type,
                        m.joined_at, m.deactivated_at
                 FROM organization_members m
                 JOIN users u ON u.id = m.user_id
                 LEFT JOIN user_emails e ON e.user_id = u.id AND e.is_primary
                 WHERE m.organization_id = $1
                 ORDER BY m.joined_at ASC",
                &[&organization_id],
            )
            .await
            .context("failed to list organization members")?;
        rows.into_iter().map(member_from_row).collect()
    }

    pub async fn add_member(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        request: AddOrganizationMemberRequest,
    ) -> Result<OrganizationMember> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ManageMembers, None)
            .await?;
        let role = request.role.unwrap_or_else(|| "member".to_string());
        let seat_type = request.seat_type.unwrap_or_else(|| "developer".to_string());
        if !ROLES.contains(&role.as_str()) || !SEAT_TYPES.contains(&seat_type.as_str()) {
            return Err(anyhow!("invalid organization role or seat_type"));
        }
        let postgres = self.required()?;
        if postgres
            .client()
            .query_opt(
                "SELECT 1 FROM users WHERE id = $1 AND is_active AND deleted_at IS NULL",
                &[&request.user_id],
            )
            .await
            .context("failed to resolve organization member")?
            .is_none()
        {
            return Err(anyhow!("user not found or inactive"));
        }
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO organization_members
                    (organization_id, user_id, role, seat_type, deactivated_at)
                 VALUES ($1, $2, $3, $4, NULL)
                 ON CONFLICT (organization_id, user_id) DO UPDATE SET
                    role = EXCLUDED.role, seat_type = EXCLUDED.seat_type,
                    deactivated_at = NULL
                 RETURNING user_id, role, seat_type, joined_at, deactivated_at",
                &[&organization_id, &request.user_id, &role, &seat_type],
            )
            .await
            .context("failed to upsert organization member")?;
        let user = postgres
            .client()
            .query_one(
                "SELECT u.username, e.email
                 FROM users u LEFT JOIN user_emails e ON e.user_id = u.id AND e.is_primary
                 WHERE u.id = $1",
                &[&request.user_id],
            )
            .await
            .context("failed to load organization member profile")?;
        let member = OrganizationMember {
            user_id: row.get("user_id"),
            username: user.get("username"),
            email: user.get("email"),
            role: row.get("role"),
            seat_type: row.get("seat_type"),
            joined_at: row.get("joined_at"),
            deactivated_at: row.get("deactivated_at"),
        };
        self.audit(
            organization_id,
            actor,
            "organization.member_upserted",
            "user",
            Some(member.user_id),
            serde_json::json!({ "role": member.role.clone(), "seat_type": member.seat_type.clone() }),
        )
        .await?;
        Ok(member)
    }

    pub async fn remove_member(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        member_user_id: Uuid,
    ) -> Result<bool> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ManageMembers, None)
            .await?;
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE organization_members SET deactivated_at = now()
                 WHERE organization_id = $1 AND user_id = $2
                   AND role <> 'owner' AND deactivated_at IS NULL",
                &[&organization_id, &member_user_id],
            )
            .await
            .context("failed to deactivate organization member")?;
        if changed == 1 {
            self.audit(
                organization_id,
                actor,
                "organization.member_deactivated",
                "user",
                Some(member_user_id),
                serde_json::json!({}),
            )
            .await?;
        }
        Ok(changed == 1)
    }

    pub async fn teams(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<OrganizationTeam>> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ReadTeam, None)
            .await?;
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT id, organization_id, name, slug, created_at
                 FROM teams WHERE organization_id = $1 ORDER BY created_at ASC",
                &[&organization_id],
            )
            .await
            .context("failed to list organization teams")?;
        rows.into_iter().map(team_from_row).collect()
    }

    pub async fn create_team(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        request: CreateOrganizationTeamRequest,
    ) -> Result<OrganizationTeam> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ManageTeams, None)
            .await?;
        let name = request.name.trim();
        if name.is_empty() || name.len() > 120 {
            return Err(anyhow!("team name must contain 1-120 characters"));
        }
        let slug = normalize_slug(request.slug.as_deref().unwrap_or(name))?;
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO teams (id, organization_id, name, slug)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, organization_id, name, slug, created_at",
                &[&id, &organization_id, &name, &slug],
            )
            .await
            .context("failed to create organization team")?;
        self.audit(
            organization_id,
            actor,
            "organization.team_created",
            "team",
            Some(id),
            serde_json::json!({ "slug": slug }),
        )
        .await?;
        team_from_row(row)
    }

    pub async fn analytics(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<OrganizationAnalytics> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ReadOrganization,
                Some(Entitlement::OrganizationDashboards),
            )
            .await?;
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_one(
                "SELECT
                    (SELECT count(*) FROM organization_members
                      WHERE organization_id = $1 AND deactivated_at IS NULL) AS member_count,
                    (SELECT count(*) FROM organization_members
                      WHERE organization_id = $1 AND deactivated_at IS NULL
                        AND seat_type = 'developer') AS developer_count,
                    (SELECT count(*) FROM teams WHERE organization_id = $1) AS team_count",
                &[&organization_id],
            )
            .await
            .context("failed to load organization analytics")?;
        Ok(OrganizationAnalytics {
            organization_id,
            member_count: row.get("member_count"),
            active_developer_seats: row.get("developer_count"),
            team_count: row.get("team_count"),
            data_freshness: "transactional_membership",
        })
    }

    pub async fn audit_logs(&self, actor: Uuid, organization_id: Uuid) -> Result<Vec<serde_json::Value>> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ReadOrganization, None)
            .await?;
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT id, actor_user_id, action, resource_type, resource_id, metadata, created_at
                 FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 200",
                &[&organization_id],
            )
            .await
            .context("failed to load organization audit logs")?;
        rows.into_iter()
            .map(|row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, Uuid>("id"),
                    "actor_user_id": row.get::<_, Option<Uuid>>("actor_user_id"),
                    "action": row.get::<_, String>("action"),
                    "resource_type": row.get::<_, String>("resource_type"),
                    "resource_id": row.get::<_, Option<Uuid>>("resource_id"),
                    "metadata": row.get::<_, serde_json::Value>("metadata"),
                    "created_at": row.get::<_, DateTime<Utc>>("created_at"),
                }))
            })
            .collect()
    }

    async fn audit(
        &self,
        organization_id: Uuid,
        actor_user_id: Uuid,
        action: &str,
        resource_type: &str,
        resource_id: Option<Uuid>,
        metadata: serde_json::Value,
    ) -> Result<()> {
        let postgres = self.required()?;
        postgres
            .client()
            .execute(
                "INSERT INTO audit_logs
                    (id, organization_id, actor_user_id, action, resource_type, resource_id, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)",
                &[
                    &Uuid::now_v7(),
                    &organization_id,
                    &actor_user_id,
                    &action,
                    &resource_type,
                    &resource_id,
                    &metadata,
                ],
            )
            .await
            .context("failed to write immutable organization audit log")?;
        Ok(())
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn normalize_slug(value: &str) -> Result<String> {
    let slug = value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if !(2..=80).contains(&slug.len()) {
        return Err(anyhow!("slug must contain 2-80 URL-safe characters"));
    }
    Ok(slug)
}

fn organization_from_row(row: Row) -> Result<Organization> {
    Ok(Organization {
        id: row.try_get("id")?,
        slug: row.try_get("slug")?,
        name: row.try_get("name")?,
        personal_owner_id: row.try_get("personal_owner_id")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

fn member_from_row(row: Row) -> Result<OrganizationMember> {
    Ok(OrganizationMember {
        user_id: row.try_get("user_id")?,
        username: row.try_get("username")?,
        email: row.try_get("email")?,
        role: row.try_get("role")?,
        seat_type: row.try_get("seat_type")?,
        joined_at: row.try_get("joined_at")?,
        deactivated_at: row.try_get("deactivated_at")?,
    })
}

fn team_from_row(row: Row) -> Result<OrganizationTeam> {
    Ok(OrganizationTeam {
        id: row.try_get("id")?,
        organization_id: row.try_get("organization_id")?,
        name: row.try_get("name")?,
        slug: row.try_get("slug")?,
        created_at: row.try_get("created_at")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_normalization_is_stable_and_safe() {
        assert_eq!(normalize_slug("Acme  Dev").unwrap(), "acme-dev");
        assert!(normalize_slug("x").is_err());
        assert!(normalize_slug("!!!").is_err());
    }
}

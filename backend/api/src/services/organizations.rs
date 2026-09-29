use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::organization::{
    AddOrganizationMemberRequest, AddOrganizationTeamMemberRequest, CreateOrganizationRequest,
    CreateOrganizationTeamRequest, Organization, OrganizationAnalytics,
    OrganizationAnalyticsSharing, OrganizationMember, OrganizationTeam, OrganizationTeamMember,
    UpdateOrganizationRequest,
};
use crate::repository::presence::PresenceRepository;
use crate::services::authorization::{AuthorizationService, OrganizationAction};

// Keep the role validation in one place. PostgreSQL also has a CHECK constraint,
// but validating before the query gives clients a stable 400 instead of a driver error.
const ROLES: &[&str] = &["admin", "member", "viewer"];
const SEAT_TYPES: &[&str] = &["developer", "viewer"];
const TEAM_ROLES: &[&str] = &["lead", "member", "viewer"];

/// A request the caller can fix — mapped to 404 / 400 by the handler rather than being
/// string-matched out of a generic error.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum OrganizationRequestError {
    #[error("{0}")]
    NotFound(&'static str),
    #[error("{0}")]
    Invalid(&'static str),
}

/// The team role to store, defaulting to `member`.
pub fn team_member_role(role: Option<&str>) -> Result<&'static str, OrganizationRequestError> {
    let role = role.map(str::trim).unwrap_or("member");
    TEAM_ROLES
        .iter()
        .copied()
        .find(|candidate| *candidate == role)
        .ok_or(OrganizationRequestError::Invalid(
            "team role must be lead, member or viewer",
        ))
}

pub struct OrganizationsService {
    postgres: Option<Arc<PostgresClient>>,
    authorization: Arc<AuthorizationService>,
    presence_repo: Option<Arc<PresenceRepository>>,
}

impl OrganizationsService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        authorization: Arc<AuthorizationService>,
        presence_repo: Option<Arc<PresenceRepository>>,
    ) -> Self {
        Self {
            postgres,
            authorization,
            presence_repo,
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
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_one(
                "INSERT INTO organizations (id, slug, name, personal_owner_id)
                 VALUES ($1, $2, $3, NULL)
                 RETURNING id, slug, name, personal_owner_id, created_at, updated_at",
                &[&id, &slug, &name],
            )
            .await
            .context("failed to create organization")?;
        tx.execute(
            "INSERT INTO organization_members
                    (organization_id, user_id, role, seat_type)
                 VALUES ($1, $2, 'owner', 'developer')",
            &[&id, &owner_user_id],
        )
        .await
        .context("failed to create organization owner membership")?;
        tx.execute("INSERT INTO audit_logs (id, organization_id, actor_user_id, action, resource_type, resource_id, metadata)
            VALUES ($1, $2, $3, 'organization.created', 'organization', $2, $4)",
            &[&Uuid::now_v7(), &id, &owner_user_id, &serde_json::json!({"slug": slug})]).await?;
        tx.commit().await?;
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
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageTeams,
                None,
            )
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
            .require(
                actor,
                organization_id,
                OrganizationAction::ReadOrganization,
                None,
            )
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
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageMembers,
                None,
            )
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
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageMembers,
                None,
            )
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

    pub async fn teams(&self, actor: Uuid, organization_id: Uuid) -> Result<Vec<OrganizationTeam>> {
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
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageTeams,
                None,
            )
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
        postgres
            .client()
            .execute(
                "INSERT INTO team_members (team_id, user_id, role)
                 VALUES ($1, $2, 'lead')
                 ON CONFLICT (team_id, user_id) DO NOTHING",
                &[&id, &actor],
            )
            .await
            .context("failed to add team creator as lead")?;
        if let Some(presence_repo) = &self.presence_repo {
            presence_repo
                .ensure_team_room(id, name)
                .await
                .context("failed to create team presence room")?;
        }
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

    /// Members of one team. Any organization member may read it (`ReadTeam`).
    pub async fn team_members(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        team_id: Uuid,
    ) -> Result<Vec<OrganizationTeamMember>> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ReadTeam, None)
            .await?;
        let postgres = self.required()?;
        self.ensure_team_in_organization(postgres, organization_id, team_id)
            .await?;
        let rows = postgres
            .client()
            .query(
                "SELECT tm.user_id, u.username, tm.role, tm.joined_at
                 FROM team_members tm
                 JOIN users u ON u.id = tm.user_id
                 WHERE tm.team_id = $1
                 ORDER BY tm.joined_at ASC",
                &[&team_id],
            )
            .await
            .context("failed to list team members")?;
        rows.into_iter().map(team_member_from_row).collect()
    }

    /// Adds (or re-roles) a team member. The person must already be an active member of
    /// the organization — a team is a subset of the organization, never a side door in.
    pub async fn add_team_member(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        team_id: Uuid,
        request: AddOrganizationTeamMemberRequest,
    ) -> Result<OrganizationTeamMember> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageTeams,
                None,
            )
            .await?;
        let role = team_member_role(request.role.as_deref())?;
        let postgres = self.required()?;
        self.ensure_team_in_organization(postgres, organization_id, team_id)
            .await?;
        if postgres
            .client()
            .query_opt(
                "SELECT 1 FROM organization_members m
                 JOIN users u ON u.id = m.user_id AND u.is_active AND u.deleted_at IS NULL
                 WHERE m.organization_id = $1 AND m.user_id = $2 AND m.deactivated_at IS NULL",
                &[&organization_id, &request.user_id],
            )
            .await
            .context("failed to resolve organization membership for team member")?
            .is_none()
        {
            return Err(OrganizationRequestError::Invalid(
                "add this person to the organization before adding them to a team",
            )
            .into());
        }
        let row = postgres
            .client()
            .query_one(
                "WITH upserted AS (
                     INSERT INTO team_members (team_id, user_id, role)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
                     RETURNING user_id, role, joined_at
                 )
                 SELECT upserted.user_id, u.username, upserted.role, upserted.joined_at
                 FROM upserted JOIN users u ON u.id = upserted.user_id",
                &[&team_id, &request.user_id, &role],
            )
            .await
            .context("failed to upsert team member")?;
        let member = team_member_from_row(row)?;
        self.audit(
            organization_id,
            actor,
            "organization.team_member_upserted",
            "team",
            Some(team_id),
            serde_json::json!({ "user_id": member.user_id, "role": member.role.clone() }),
        )
        .await?;
        Ok(member)
    }

    /// Removes someone from a team. Returns false when they were not on it.
    pub async fn remove_team_member(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        team_id: Uuid,
        member_user_id: Uuid,
    ) -> Result<bool> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageTeams,
                None,
            )
            .await?;
        let postgres = self.required()?;
        self.ensure_team_in_organization(postgres, organization_id, team_id)
            .await?;
        let changed = postgres
            .client()
            .execute(
                "DELETE FROM team_members WHERE team_id = $1 AND user_id = $2",
                &[&team_id, &member_user_id],
            )
            .await
            .context("failed to remove team member")?;
        if changed == 1 {
            self.audit(
                organization_id,
                actor,
                "organization.team_member_removed",
                "team",
                Some(team_id),
                serde_json::json!({ "user_id": member_user_id }),
            )
            .await?;
        }
        Ok(changed == 1)
    }

    /// A team id from the URL must belong to the organization in the same URL; otherwise
    /// an admin of one organization could reach another organization's team.
    async fn ensure_team_in_organization(
        &self,
        postgres: &PostgresClient,
        organization_id: Uuid,
        team_id: Uuid,
    ) -> Result<()> {
        postgres
            .client()
            .query_opt(
                "SELECT 1 FROM teams WHERE id = $1 AND organization_id = $2",
                &[&team_id, &organization_id],
            )
            .await
            .context("failed to resolve team")?
            .map(|_| ())
            .ok_or_else(|| OrganizationRequestError::NotFound("team not found").into())
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
                None,
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

    pub async fn analytics_sharing(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<OrganizationAnalyticsSharing> {
        self.authorization
            .require(actor, organization_id, OrganizationAction::ReadSelf, None)
            .await?;
        let row = self
            .required()?
            .client()
            .query_opt(
                "SELECT share_aggregate, share_individual
             FROM organization_analytics_consents
             WHERE organization_id = $1 AND user_id = $2",
                &[&organization_id, &actor],
            )
            .await?;
        Ok(row
            .map(|row| OrganizationAnalyticsSharing {
                share_aggregate: row.get("share_aggregate"),
                share_individual: row.get("share_individual"),
            })
            .unwrap_or(OrganizationAnalyticsSharing {
                share_aggregate: false,
                share_individual: false,
            }))
    }

    pub async fn set_analytics_sharing(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        sharing: OrganizationAnalyticsSharing,
    ) -> Result<OrganizationAnalyticsSharing> {
        if sharing.share_individual && !sharing.share_aggregate {
            return Err(anyhow!("individual sharing requires aggregate sharing"));
        }
        self.authorization
            .require(actor, organization_id, OrganizationAction::ReadSelf, None)
            .await?;
        let mut client = self.required()?.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_opt(
                "INSERT INTO organization_analytics_consents
                 (organization_id, user_id, share_aggregate, share_individual)
             SELECT $1, $2, $3, $4 FROM organization_members
             WHERE organization_id = $1 AND user_id = $2 AND deactivated_at IS NULL
             ON CONFLICT (organization_id, user_id) DO UPDATE SET
                 share_aggregate = EXCLUDED.share_aggregate,
                 share_individual = EXCLUDED.share_individual,
                 updated_at = now()
             RETURNING share_aggregate, share_individual",
                &[
                    &organization_id,
                    &actor,
                    &sharing.share_aggregate,
                    &sharing.share_individual,
                ],
            )
            .await?;
        let row = row.ok_or_else(|| anyhow!("active organization membership required"))?;
        let saved = OrganizationAnalyticsSharing {
            share_aggregate: row.get("share_aggregate"),
            share_individual: row.get("share_individual"),
        };
        tx.execute(
            "INSERT INTO audit_logs
                (id, organization_id, actor_user_id, action, resource_type, resource_id, metadata)
             VALUES ($1, $2, $3, 'organization.analytics_sharing.updated', 'user', $3, $4)",
            &[
                &Uuid::now_v7(),
                &organization_id,
                &actor,
                &serde_json::json!({
                    "share_aggregate": saved.share_aggregate,
                    "share_individual": saved.share_individual,
                }),
            ],
        )
        .await?;
        tx.commit().await?;
        Ok(saved)
    }

    pub async fn consenting_analytics_members(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<(Uuid, bool)>> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ReadOrganization,
                None,
            )
            .await?;
        let rows = self
            .required()?
            .client()
            .query(
                "SELECT m.user_id, c.share_individual
             FROM organization_members m
             JOIN organization_analytics_consents c
               ON c.organization_id = m.organization_id AND c.user_id = m.user_id
             WHERE m.organization_id = $1 AND m.deactivated_at IS NULL
               AND c.share_aggregate = TRUE
             ORDER BY m.user_id",
                &[&organization_id],
            )
            .await?;
        Ok(rows
            .into_iter()
            .map(|row| (row.get("user_id"), row.get("share_individual")))
            .collect())
    }

    pub async fn audit_logs(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<serde_json::Value>> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ReadOrganization,
                None,
            )
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

fn team_member_from_row(row: Row) -> Result<OrganizationTeamMember> {
    Ok(OrganizationTeamMember {
        user_id: row.try_get("user_id")?,
        username: row.try_get("username")?,
        role: row.try_get("role")?,
        joined_at: row.try_get("joined_at")?,
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
    fn team_roles_default_to_member_and_reject_others() {
        assert_eq!(team_member_role(None), Ok("member"));
        assert_eq!(team_member_role(Some(" lead ")), Ok("lead"));
        assert_eq!(team_member_role(Some("viewer")), Ok("viewer"));
        assert!(matches!(
            team_member_role(Some("owner")),
            Err(OrganizationRequestError::Invalid(_))
        ));
        assert!(matches!(
            team_member_role(Some("")),
            Err(OrganizationRequestError::Invalid(_))
        ));
    }

    #[test]
    fn slug_normalization_is_stable_and_safe() {
        assert_eq!(normalize_slug("Acme  Dev").unwrap(), "acme-dev");
        assert!(normalize_slug("x").is_err());
        assert!(normalize_slug("!!!").is_err());
    }
}

use anyhow::{anyhow, Context, Result};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::leaderboard::{
    CreateLeaderboardRequest, Leaderboard, LeaderboardMember, LeaderboardMemberRequest,
};
use crate::services::authorization::{AuthorizationService, OrganizationAction};

pub struct LeaderboardService {
    postgres: Option<Arc<PostgresClient>>,
    authorization: Arc<AuthorizationService>,
}

impl LeaderboardService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        authorization: Arc<AuthorizationService>,
    ) -> Self {
        Self {
            postgres,
            authorization,
        }
    }

    pub async fn create(
        &self,
        owner_user_id: Uuid,
        request: CreateLeaderboardRequest,
    ) -> Result<Leaderboard> {
        validate(&request)?;
        if let Some(organization_id) = request.organization_id {
            self.authorization
                .require(
                    owner_user_id,
                    organization_id,
                    OrganizationAction::ManageTeams,
                    None,
                )
                .await?;
        }
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO leaderboards
                    (id, organization_id, owner_user_id, visibility, metric, period,
                     language, country, anonymous)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING id, organization_id, owner_user_id, visibility, metric, period,
                           language, country, anonymous, created_at",
                &[
                    &id,
                    &request.organization_id,
                    &Some(owner_user_id),
                    &request.visibility,
                    &request.metric,
                    &request.period,
                    &request.language,
                    &request.country,
                    &request.anonymous.unwrap_or(false),
                ],
            )
            .await
            .context("failed to create leaderboard")?;
        postgres
            .client()
            .execute(
                "INSERT INTO leaderboard_members (leaderboard_id, user_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING",
                &[&id, &owner_user_id],
            )
            .await
            .context("failed to add leaderboard owner")?;
        leaderboard_from_row(row)
    }

    pub async fn list(&self, user_id: Uuid) -> Result<Vec<Leaderboard>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT DISTINCT l.id, l.organization_id, l.owner_user_id, l.visibility,
                        l.metric, l.period, l.language, l.country, l.anonymous, l.created_at
                 FROM leaderboards l
                 LEFT JOIN leaderboard_members lm ON lm.leaderboard_id = l.id
                 LEFT JOIN organization_members om
                   ON om.organization_id = l.organization_id AND om.user_id = $1
                  AND om.deactivated_at IS NULL
                 WHERE l.owner_user_id = $1 OR lm.user_id = $1 OR om.user_id IS NOT NULL
                 ORDER BY l.created_at DESC",
                &[&user_id],
            )
            .await
            .context("failed to list leaderboards")?;
        rows.into_iter().map(leaderboard_from_row).collect()
    }

    pub async fn get(&self, user_id: Uuid, id: Uuid) -> Result<Option<Leaderboard>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT DISTINCT l.id, l.organization_id, l.owner_user_id, l.visibility,
                        l.metric, l.period, l.language, l.country, l.anonymous, l.created_at
                 FROM leaderboards l
                 LEFT JOIN leaderboard_members lm ON lm.leaderboard_id = l.id
                 LEFT JOIN organization_members om
                   ON om.organization_id = l.organization_id AND om.user_id = $1
                  AND om.deactivated_at IS NULL
                 WHERE l.id = $2
                   AND (l.owner_user_id = $1 OR lm.user_id = $1 OR om.user_id IS NOT NULL)",
                &[&user_id, &id],
            )
            .await
            .context("failed to load leaderboard")?;
        row.map(leaderboard_from_row).transpose()
    }

    pub async fn members(
        &self,
        user_id: Uuid,
        leaderboard_id: Uuid,
    ) -> Result<Vec<LeaderboardMember>> {
        self.require_access(user_id, leaderboard_id).await?;
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT lm.user_id, u.username, lm.joined_at
                 FROM leaderboard_members lm JOIN users u ON u.id = lm.user_id
                 WHERE lm.leaderboard_id = $1 ORDER BY lm.joined_at ASC",
                &[&leaderboard_id],
            )
            .await
            .context("failed to list leaderboard members")?;
        rows.into_iter()
            .map(|row| {
                Ok(LeaderboardMember {
                    user_id: row.get("user_id"),
                    username: row.get("username"),
                    joined_at: row.get("joined_at"),
                })
            })
            .collect()
    }

    pub async fn add_member(
        &self,
        actor: Uuid,
        leaderboard_id: Uuid,
        request: LeaderboardMemberRequest,
    ) -> Result<bool> {
        self.require_owner_or_org_admin(actor, leaderboard_id).await?;
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "INSERT INTO leaderboard_members (leaderboard_id, user_id)
                 SELECT $1, u.id FROM users u WHERE u.id = $2 AND u.is_active
                 ON CONFLICT DO NOTHING",
                &[&leaderboard_id, &request.user_id],
            )
            .await
            .context("failed to add leaderboard member")?;
        Ok(changed == 1)
    }

    pub async fn remove_member(
        &self,
        actor: Uuid,
        leaderboard_id: Uuid,
        member_user_id: Uuid,
    ) -> Result<bool> {
        self.require_owner_or_org_admin(actor, leaderboard_id).await?;
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "DELETE FROM leaderboard_members
                 WHERE leaderboard_id = $1 AND user_id = $2
                   AND user_id <> (SELECT owner_user_id FROM leaderboards WHERE id = $1)",
                &[&leaderboard_id, &member_user_id],
            )
            .await
            .context("failed to remove leaderboard member")?;
        Ok(changed == 1)
    }

    async fn require_access(&self, user_id: Uuid, leaderboard_id: Uuid) -> Result<()> {
        if self.get(user_id, leaderboard_id).await?.is_some() {
            Ok(())
        } else {
            Err(anyhow!("leaderboard not found"))
        }
    }

    async fn require_owner_or_org_admin(&self, user_id: Uuid, leaderboard_id: Uuid) -> Result<()> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT owner_user_id, organization_id FROM leaderboards WHERE id = $1",
                &[&leaderboard_id],
            )
            .await
            .context("failed to resolve leaderboard owner")?
            .ok_or_else(|| anyhow!("leaderboard not found"))?;
        let owner: Option<Uuid> = row.get("owner_user_id");
        if owner == Some(user_id) {
            return Ok(());
        }
        if let Some(organization_id) = row.get::<_, Option<Uuid>>("organization_id") {
            self.authorization
                .require(
                    user_id,
                    organization_id,
                    OrganizationAction::ManageMembers,
                    None,
                )
                .await?;
            return Ok(());
        }
        Err(anyhow!("leaderboard owner permission is required"))
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn validate(request: &CreateLeaderboardRequest) -> Result<()> {
    if !matches!(request.visibility.as_str(), "public" | "private") {
        return Err(anyhow!("visibility must be public or private"));
    }
    if !matches!(request.metric.as_str(), "time" | "manual_time" | "ai_time" | "ai_spend") {
        return Err(anyhow!("unsupported leaderboard metric"));
    }
    if !matches!(request.period.as_str(), "weekly" | "monthly") {
        return Err(anyhow!("period must be weekly or monthly"));
    }
    if request.language.as_ref().is_some_and(|value| value.len() > 120)
        || request.country.as_ref().is_some_and(|value| value.len() > 120)
    {
        return Err(anyhow!("leaderboard filter is too long"));
    }
    Ok(())
}

fn leaderboard_from_row(row: Row) -> Result<Leaderboard> {
    Ok(Leaderboard {
        id: row.try_get("id")?,
        organization_id: row.try_get("organization_id")?,
        owner_user_id: row.try_get("owner_user_id")?,
        visibility: row.try_get("visibility")?,
        metric: row.try_get("metric")?,
        period: row.try_get("period")?,
        language: row.try_get("language")?,
        country: row.try_get("country")?,
        anonymous: row.try_get("anonymous")?,
        created_at: row.try_get("created_at")?,
    })
}

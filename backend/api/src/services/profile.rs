use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::middleware::auth;
use crate::model::profile::{
    CreateShareLinkRequest, PublicProfile, PublicShare, ShareLink, UpdateProfileRequest,
};

const SHAREABLE_RESOURCES: &[&str] = &["profile", "project", "chart", "leaderboard"];

pub struct ProfileService {
    postgres: Option<Arc<PostgresClient>>,
}

impl ProfileService {
    pub fn new(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self { postgres }
    }

    pub async fn get_profile(&self, user_id: Uuid) -> Result<PublicProfile> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT p.user_id, p.username, p.is_public, p.show_projects,
                        p.show_languages, p.show_ai_metrics, p.badge
                 FROM public_profiles p WHERE p.user_id = $1",
                &[&user_id],
            )
            .await
            .context("failed to load public profile")?;
        if let Some(row) = row {
            return profile_from_row(row);
        }
        let username: String = postgres
            .client()
            .query_one("SELECT username FROM users WHERE id = $1", &[&user_id])
            .await
            .context("failed to resolve profile username")?
            .get("username");
        Ok(PublicProfile {
            user_id,
            username,
            is_public: false,
            show_projects: false,
            show_languages: false,
            show_ai_metrics: false,
            badge: None,
        })
    }

    pub async fn update_profile(
        &self,
        user_id: Uuid,
        input: UpdateProfileRequest,
    ) -> Result<PublicProfile> {
        let current = self.get_profile(user_id).await?;
        let username = input.username.unwrap_or(current.username);
        validate_username(&username)?;
        if input.badge.as_ref().is_some_and(|value| value.len() > 120) {
            return Err(anyhow!("badge is too long"));
        }
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO public_profiles
                    (user_id, username, is_public, show_projects, show_languages,
                     show_ai_metrics, badge, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, now())
                 ON CONFLICT (user_id) DO UPDATE SET
                    username = EXCLUDED.username,
                    is_public = EXCLUDED.is_public,
                    show_projects = EXCLUDED.show_projects,
                    show_languages = EXCLUDED.show_languages,
                    show_ai_metrics = EXCLUDED.show_ai_metrics,
                    badge = EXCLUDED.badge,
                    updated_at = now()
                 RETURNING user_id, username, is_public, show_projects,
                           show_languages, show_ai_metrics, badge",
                &[
                    &user_id,
                    &username,
                    &input.is_public.unwrap_or(current.is_public),
                    &input.show_projects.unwrap_or(current.show_projects),
                    &input.show_languages.unwrap_or(current.show_languages),
                    &input.show_ai_metrics.unwrap_or(current.show_ai_metrics),
                    &input.badge.or(current.badge),
                ],
            )
            .await
            .context("failed to update public profile")?;
        profile_from_row(row)
    }

    pub async fn create_share_link(
        &self,
        user_id: Uuid,
        input: CreateShareLinkRequest,
    ) -> Result<ShareLink> {
        if !SHAREABLE_RESOURCES.contains(&input.resource_type.as_str()) {
            return Err(anyhow!("unsupported share resource type"));
        }
        if input.expires_at.is_some_and(|value| value <= Utc::now()) {
            return Err(anyhow!("share link expiry must be in the future"));
        }
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let token = auth::generate_key();
        let token_hash = auth::hash_key(&token);
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO share_links
                    (id, owner_user_id, resource_type, resource_id, token_hash, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, resource_type, resource_id, expires_at, revoked_at, created_at",
                &[
                    &id,
                    &user_id,
                    &input.resource_type,
                    &input.resource_id,
                    &token_hash,
                    &input.expires_at,
                ],
            )
            .await
            .context("failed to create share link")?;
        Ok(ShareLink {
            id: row.get("id"),
            resource_type: row.get("resource_type"),
            resource_id: row.get("resource_id"),
            token,
            expires_at: row.get("expires_at"),
            revoked_at: row.get("revoked_at"),
            created_at: row.get("created_at"),
        })
    }

    pub async fn list_share_links(&self, user_id: Uuid) -> Result<Vec<ShareLink>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT id, resource_type, resource_id, expires_at, revoked_at, created_at
                 FROM share_links WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 100",
                &[&user_id],
            )
            .await
            .context("failed to list share links")?;
        rows.into_iter()
            .map(|row| {
                Ok(ShareLink {
                    id: row.get("id"),
                    resource_type: row.get("resource_type"),
                    resource_id: row.get("resource_id"),
                    token: String::new(),
                    expires_at: row.get("expires_at"),
                    revoked_at: row.get("revoked_at"),
                    created_at: row.get("created_at"),
                })
            })
            .collect()
    }

    pub async fn revoke_share_link(&self, user_id: Uuid, link_id: Uuid) -> Result<bool> {
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE share_links SET revoked_at = now()
                 WHERE id = $1 AND owner_user_id = $2 AND revoked_at IS NULL",
                &[&link_id, &user_id],
            )
            .await
            .context("failed to revoke share link")?;
        Ok(changed == 1)
    }

    pub async fn resolve_public_share(&self, token: &str) -> Result<Option<PublicShare>> {
        if token.len() < 20 {
            return Ok(None);
        }
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT s.resource_type, s.resource_id, s.owner_user_id, s.expires_at,
                        p.user_id AS profile_user_id, p.username, p.is_public,
                        p.show_projects, p.show_languages, p.show_ai_metrics, p.badge
                 FROM share_links s
                 LEFT JOIN public_profiles p ON p.user_id = s.owner_user_id
                 WHERE s.token_hash = $1 AND s.revoked_at IS NULL
                   AND (s.expires_at IS NULL OR s.expires_at > now())",
                &[&auth::hash_key(token)],
            )
            .await
            .context("failed to resolve share link")?;
        let Some(row) = row else { return Ok(None) };
        let resource_type: String = row.get("resource_type");
        let profile = if row.try_get::<_, Option<bool>>("is_public")?.unwrap_or(false) {
            Some(PublicProfile {
                user_id: row.get("profile_user_id"),
                username: row.get("username"),
                is_public: true,
                show_projects: row.get("show_projects"),
                show_languages: row.get("show_languages"),
                show_ai_metrics: row.get("show_ai_metrics"),
                badge: row.get("badge"),
            })
        } else {
            None
        };
        // A profile share is a distinct public surface. Never disclose even the
        // profile resource metadata when the owner has disabled public profiles;
        // project/chart links may still be valid because they are independently
        // scoped share grants.
        if resource_type == "profile" && profile.is_none() {
            return Ok(None);
        }
        Ok(Some(PublicShare {
            resource_type,
            resource_id: row.get("resource_id"),
            owner_user_id: row.get("owner_user_id"),
            profile,
            expires_at: row.get("expires_at"),
        }))
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn profile_from_row(row: Row) -> Result<PublicProfile> {
    Ok(PublicProfile {
        user_id: row.try_get("user_id")?,
        username: row.try_get("username")?,
        is_public: row.try_get("is_public")?,
        show_projects: row.try_get("show_projects")?,
        show_languages: row.try_get("show_languages")?,
        show_ai_metrics: row.try_get("show_ai_metrics")?,
        badge: row.try_get("badge")?,
    })
}

fn validate_username(username: &str) -> Result<()> {
    if !(3..=64).contains(&username.len())
        || !username
            .chars()
            .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit() || "_-".contains(character))
    {
        return Err(anyhow!("username must be 3-64 lowercase letters, numbers, '-' or '_'"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_usernames_are_constrained() {
        assert!(validate_username("atoaxis_dev").is_ok());
        assert!(validate_username("AtoAxis").is_err());
        assert!(validate_username("ab").is_err());
    }
}

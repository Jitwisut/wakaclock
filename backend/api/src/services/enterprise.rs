//! Enterprise identity adapters: SSO configuration and SCIM 2.0 provisioning.
//!
//! The service owns the PostgreSQL side of the protocol. OIDC/SAML assertions are
//! intentionally handled by a deployment-specific identity gateway; this layer stores
//! only encrypted configuration and the resulting membership state. SCIM bearer tokens
//! are high-entropy opaque values and only their SHA-256 hashes are persisted.

use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::middleware::auth;
use crate::model::enterprise::{
    ScimGroupRecord, ScimTokenCreated, ScimTokenSummary, ScimUserInput, ScimUserRecord,
    SsoConnection, UpsertSsoRequest,
};
use crate::services::authorization::{AuthorizationService, Entitlement, OrganizationAction};

pub struct EnterpriseService {
    postgres: Option<Arc<PostgresClient>>,
    authorization: Arc<AuthorizationService>,
}

impl EnterpriseService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        authorization: Arc<AuthorizationService>,
    ) -> Self {
        Self {
            postgres,
            authorization,
        }
    }

    pub async fn get_sso(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<Option<SsoConnection>> {
        super::require_runtime_feature(super::RuntimeFeature::SsoOidcSaml)?;
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageSecurity,
                Some(Entitlement::SsoScim),
            )
            .await?;
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT id, organization_id, protocol, issuer, entity_id, enforced,
                        verified_at, created_at, updated_at
                 FROM sso_connections WHERE organization_id = $1",
                &[&organization_id],
            )
            .await
            .context("failed to load SSO connection")?;
        row.map(sso_from_row).transpose()
    }

    pub async fn upsert_sso(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        request: UpsertSsoRequest,
    ) -> Result<SsoConnection> {
        super::require_runtime_feature(super::RuntimeFeature::SsoOidcSaml)?;
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageSecurity,
                Some(Entitlement::SsoScim),
            )
            .await?;
        validate_sso(&request)?;
        let encrypted = BASE64
            .decode(request.encrypted_config.trim())
            .context("encrypted_config must be base64")?;
        if encrypted.len() < 16 || encrypted.len() > 512 * 1024 {
            return Err(anyhow!("encrypted_config has an invalid size"));
        }
        // A new configuration invalidates a previous verification. Enforced SSO is
        // allowed only after the identity gateway records a successful test login.
        if request.enforced {
            return Err(anyhow!(
                "SSO cannot be enforced until a successful test login verifies the connection"
            ));
        }
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO sso_connections
                    (id, organization_id, protocol, issuer, entity_id, encrypted_config,
                     enforced, verified_at)
                 VALUES ($1, $2, $3, $4, $5, $6, FALSE, NULL)
                 ON CONFLICT (organization_id, protocol) DO UPDATE SET
                    issuer = EXCLUDED.issuer,
                    entity_id = EXCLUDED.entity_id,
                    encrypted_config = EXCLUDED.encrypted_config,
                    enforced = FALSE,
                    verified_at = NULL,
                    updated_at = now()
                 RETURNING id, organization_id, protocol, issuer, entity_id, enforced,
                           verified_at, created_at, updated_at",
                &[
                    &id,
                    &organization_id,
                    &request.protocol,
                    &request.issuer,
                    &request.entity_id,
                    &encrypted,
                ],
            )
            .await
            .context("failed to save SSO connection")?;
        sso_from_row(row)
    }

    pub async fn set_sso_enforced(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        connection_id: Uuid,
        enforced: bool,
    ) -> Result<bool> {
        super::require_runtime_feature(super::RuntimeFeature::SsoOidcSaml)?;
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageSecurity,
                Some(Entitlement::SsoScim),
            )
            .await?;
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE sso_connections SET enforced = $3, updated_at = now()
                 WHERE id = $1 AND organization_id = $2
                   AND ($3 = FALSE OR verified_at IS NOT NULL)",
                &[&connection_id, &organization_id, &enforced],
            )
            .await
            .context("failed to update SSO enforcement")?;
        if changed == 0 && enforced {
            return Err(anyhow!(
                "SSO must pass a successful test login before enforcement"
            ));
        }
        Ok(changed == 1)
    }

    pub async fn create_scim_token(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<ScimTokenCreated> {
        super::require_runtime_feature(super::RuntimeFeature::Scim)?;
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageSecurity,
                Some(Entitlement::SsoScim),
            )
            .await?;
        let postgres = self.required()?;
        let plaintext = auth::generate_key();
        let token_hash = auth::hash_key(&plaintext);
        let id = Uuid::now_v7();
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO scim_tokens (id, organization_id, token_hash, expires_at)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, organization_id, last_used_at, expires_at, revoked_at, created_at",
                &[&id, &organization_id, &token_hash, &expires_at],
            )
            .await
            .context("failed to create SCIM token")?;
        Ok(ScimTokenCreated {
            token: scim_token_from_row(row)?,
            plaintext,
        })
    }

    pub async fn list_scim_tokens(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<ScimTokenSummary>> {
        super::require_runtime_feature(super::RuntimeFeature::Scim)?;
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageSecurity,
                Some(Entitlement::SsoScim),
            )
            .await?;
        self.list_scim_tokens_unchecked(organization_id).await
    }

    pub async fn revoke_scim_token(
        &self,
        actor: Uuid,
        organization_id: Uuid,
        token_id: Uuid,
    ) -> Result<bool> {
        super::require_runtime_feature(super::RuntimeFeature::Scim)?;
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageSecurity,
                Some(Entitlement::SsoScim),
            )
            .await?;
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE scim_tokens SET revoked_at = now()
                 WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL",
                &[&token_id, &organization_id],
            )
            .await
            .context("failed to revoke SCIM token")?;
        Ok(changed == 1)
    }

    /// Authenticate SCIM's bearer token and update its last-used timestamp. The
    /// returned organization is the only tenant scope used by SCIM handlers.
    pub async fn organization_for_scim_token(&self, plaintext: &str) -> Result<Uuid> {
        let postgres = self.required()?;
        let token_hash = auth::hash_key(plaintext);
        let row = postgres
            .client()
            .query_opt(
                "UPDATE scim_tokens SET last_used_at = now()
                 WHERE token_hash = $1 AND revoked_at IS NULL
                   AND (expires_at IS NULL OR expires_at > now())
                 RETURNING organization_id",
                &[&token_hash],
            )
            .await
            .context("failed to authenticate SCIM token")?
            .ok_or_else(|| anyhow!("invalid or expired SCIM token"))?;
        Ok(row.get("organization_id"))
    }

    pub async fn scim_users(
        &self,
        organization_id: Uuid,
        start_index: i64,
        count: i64,
    ) -> Result<(i64, Vec<ScimUserRecord>)> {
        let postgres = self.required()?;
        let count = count.clamp(1, 200);
        let start_index = start_index.max(1);
        let total: i64 = postgres
            .client()
            .query_one(
                "SELECT count(*) FROM organization_members WHERE organization_id = $1",
                &[&organization_id],
            )
            .await
            .context("failed to count SCIM users")?
            .get(0);
        let rows = postgres
            .client()
            .query(
                "SELECT u.id, u.username, u.display_name,
                        COALESCE(e.email, u.email) AS email, u.is_active, u.created_at, u.updated_at
                 FROM organization_members m JOIN users u ON u.id = m.user_id
                 LEFT JOIN user_emails e ON e.user_id = u.id AND e.is_primary
                 WHERE m.organization_id = $1
                 ORDER BY u.created_at, u.id OFFSET $2 LIMIT $3",
                &[&organization_id, &(start_index - 1), &count],
            )
            .await
            .context("failed to list SCIM users")?;
        Ok((
            total,
            rows.into_iter()
                .map(scim_user_from_row)
                .collect::<Result<Vec<_>>>()?,
        ))
    }

    pub async fn scim_user(
        &self,
        organization_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<ScimUserRecord>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT u.id, u.username, u.display_name,
                        COALESCE(e.email, u.email) AS email, u.is_active, u.created_at, u.updated_at
                 FROM organization_members m JOIN users u ON u.id = m.user_id
                 LEFT JOIN user_emails e ON e.user_id = u.id AND e.is_primary
                 WHERE m.organization_id = $1 AND u.id = $2",
                &[&organization_id, &user_id],
            )
            .await
            .context("failed to load SCIM user")?;
        row.map(scim_user_from_row).transpose()
    }

    pub async fn scim_upsert_user(
        &self,
        organization_id: Uuid,
        user_id: Option<Uuid>,
        input: ScimUserInput,
    ) -> Result<ScimUserRecord> {
        super::require_runtime_feature(super::RuntimeFeature::Scim)?;
        let username = input
            .username
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty() && value.len() <= 160)
            .ok_or_else(|| anyhow!("SCIM userName is required"))?;
        let email = input
            .emails
            .as_ref()
            .and_then(|emails| {
                emails
                    .iter()
                    .find(|email| email.primary)
                    .or_else(|| emails.first())
            })
            .map(|email| email.value.trim().to_string());
        if email.as_deref().is_some_and(|value| value.len() > 320) {
            return Err(anyhow!("SCIM email is too long"));
        }
        let postgres = self.required()?;
        let id = user_id.unwrap_or_else(Uuid::now_v7);
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO users (id, username, email, display_name, is_active)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username, email = EXCLUDED.email,
                    display_name = EXCLUDED.display_name, is_active = EXCLUDED.is_active,
                    updated_at = now()
                 RETURNING id, username, display_name, email, is_active, created_at, updated_at",
                &[
                    &id,
                    &username,
                    &email,
                    &input.display_name,
                    &input.active.unwrap_or(true),
                ],
            )
            .await
            .context("failed to provision SCIM user")?;
        if let Some(email) = email.as_deref() {
            postgres
                .client()
                .execute(
                    "INSERT INTO user_emails (id, user_id, email, is_primary, is_verified)
                     VALUES ($1, $2, $3, TRUE, TRUE)
                     ON CONFLICT (user_id, email) DO UPDATE SET is_primary = TRUE, is_verified = TRUE",
                    &[&Uuid::now_v7(), &id, &email],
                )
                .await
                .context("failed to provision SCIM email")?;
        }
        postgres
            .client()
            .execute(
                "INSERT INTO organization_members (organization_id, user_id, role, seat_type)
                 VALUES ($1, $2, 'member', 'developer')
                 ON CONFLICT (organization_id, user_id) DO UPDATE SET deactivated_at = NULL",
                &[&organization_id, &id],
            )
            .await
            .context("failed to attach SCIM user to organization")?;
        scim_user_from_row(row)
    }

    pub async fn scim_patch_user(
        &self,
        organization_id: Uuid,
        user_id: Uuid,
        input: crate::model::enterprise::ScimPatchRequest,
    ) -> Result<Option<ScimUserRecord>> {
        super::require_runtime_feature(super::RuntimeFeature::Scim)?;
        if self.scim_user(organization_id, user_id).await?.is_none() {
            return Ok(None);
        }
        let email = input
            .emails
            .as_ref()
            .and_then(|emails| {
                emails
                    .iter()
                    .find(|email| email.primary)
                    .or_else(|| emails.first())
            })
            .map(|email| email.value.trim().to_string());
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_one(
                "UPDATE users SET
                    display_name = COALESCE($3, display_name),
                    email = COALESCE($4, email),
                    is_active = COALESCE($5, is_active), updated_at = now()
                 WHERE id = $1 AND EXISTS (
                    SELECT 1 FROM organization_members WHERE organization_id = $2 AND user_id = $1
                 )
                 RETURNING id, username, display_name, email, is_active, created_at, updated_at",
                &[
                    &user_id,
                    &organization_id,
                    &input.display_name,
                    &email,
                    &input.active,
                ],
            )
            .await
            .context("failed to patch SCIM user")?;
        scim_user_from_row(row).map(Some)
    }

    pub async fn scim_deprovision_user(
        &self,
        organization_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool> {
        super::require_runtime_feature(super::RuntimeFeature::Scim)?;
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE organization_members SET deactivated_at = now()
                 WHERE organization_id = $1 AND user_id = $2 AND deactivated_at IS NULL",
                &[&organization_id, &user_id],
            )
            .await
            .context("failed to deprovision SCIM user")?;
        Ok(changed == 1)
    }

    pub async fn scim_groups(&self, organization_id: Uuid) -> Result<Vec<ScimGroupRecord>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT t.id, t.name, count(tm.user_id), t.created_at
                 FROM teams t LEFT JOIN team_members tm ON tm.team_id = t.id
                 WHERE t.organization_id = $1 GROUP BY t.id ORDER BY t.created_at",
                &[&organization_id],
            )
            .await
            .context("failed to list SCIM groups")?;
        rows.into_iter()
            .map(|row| {
                Ok(ScimGroupRecord {
                    id: row.get("id"),
                    display_name: row.get("name"),
                    member_count: row.get("count"),
                    created_at: row.get("created_at"),
                })
            })
            .collect()
    }

    pub async fn scim_create_group(
        &self,
        organization_id: Uuid,
        display_name: &str,
    ) -> Result<ScimGroupRecord> {
        super::require_runtime_feature(super::RuntimeFeature::Scim)?;
        let name = display_name.trim();
        if name.is_empty() || name.len() > 120 {
            return Err(anyhow!(
                "SCIM group displayName must contain 1-120 characters"
            ));
        }
        let slug = slugify(name)?;
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO teams (id, organization_id, name, slug)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, name, created_at",
                &[&Uuid::now_v7(), &organization_id, &name, &slug],
            )
            .await
            .context("failed to create SCIM group")?;
        Ok(ScimGroupRecord {
            id: row.get("id"),
            display_name: row.get("name"),
            member_count: 0,
            created_at: row.get("created_at"),
        })
    }

    async fn list_scim_tokens_unchecked(
        &self,
        organization_id: Uuid,
    ) -> Result<Vec<ScimTokenSummary>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT id, organization_id, last_used_at, expires_at, revoked_at, created_at
                 FROM scim_tokens WHERE organization_id = $1 ORDER BY created_at DESC",
                &[&organization_id],
            )
            .await
            .context("failed to list SCIM tokens")?;
        rows.into_iter().map(scim_token_from_row).collect()
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn validate_sso(request: &UpsertSsoRequest) -> Result<()> {
    if !matches!(request.protocol.as_str(), "oidc" | "saml") {
        return Err(anyhow!("protocol must be oidc or saml"));
    }
    if request
        .issuer
        .as_deref()
        .is_some_and(|value| value.len() > 2048)
        || request
            .entity_id
            .as_deref()
            .is_some_and(|value| value.len() > 2048)
    {
        return Err(anyhow!("SSO issuer/entity_id is too long"));
    }
    Ok(())
}

fn slugify(value: &str) -> Result<String> {
    let slug = value
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
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
    if slug.is_empty() || slug.len() > 120 {
        return Err(anyhow!("invalid SCIM group name"));
    }
    Ok(slug)
}

fn sso_from_row(row: Row) -> Result<SsoConnection> {
    Ok(SsoConnection {
        id: row.try_get("id")?,
        organization_id: row.try_get("organization_id")?,
        protocol: row.try_get("protocol")?,
        issuer: row.try_get("issuer")?,
        entity_id: row.try_get("entity_id")?,
        enforced: row.try_get("enforced")?,
        verified_at: row.try_get("verified_at")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

fn scim_token_from_row(row: Row) -> Result<ScimTokenSummary> {
    Ok(ScimTokenSummary {
        id: row.try_get("id")?,
        organization_id: row.try_get("organization_id")?,
        last_used_at: row.try_get("last_used_at")?,
        expires_at: row.try_get("expires_at")?,
        revoked_at: row.try_get("revoked_at")?,
        created_at: row.try_get("created_at")?,
    })
}

fn scim_user_from_row(row: Row) -> Result<ScimUserRecord> {
    Ok(ScimUserRecord {
        id: row.try_get("id")?,
        username: row.try_get("username")?,
        display_name: row.try_get("display_name")?,
        email: row.try_get("email")?,
        active: row.try_get("is_active")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

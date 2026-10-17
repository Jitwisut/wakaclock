//! Centralized tenant authorization for Phase 10.
//!
//! Handlers should pass the actor, action, organization and entitlement through this
//! service instead of embedding role conditionals in individual endpoints. The pure
//! decision function is intentionally testable without a database; the async lookup is
//! the adapter used once organization endpoints are migrated to PostgreSQL.

use anyhow::{anyhow, Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrganizationRole {
    Owner,
    Admin,
    Member,
    Viewer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrganizationAction {
    ReadSelf,
    ReadTeam,
    ReadOrganization,
    ManageMembers,
    ManageTeams,
    ManageIntegrations,
    ManageBilling,
    ManageSecurity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Entitlement {
    OrganizationDashboards,
    SsoScim,
}

/// Returned (inside `anyhow::Error`) when `require` denies an action. Its message is the
/// decision's reason, unchanged, so callers that only format the error see the same text
/// as before; callers that need a 403 can `downcast_ref::<AuthorizationDenied>()`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
#[error("{0}")]
pub struct AuthorizationDenied(pub &'static str);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AuthorizationDecision {
    pub allowed: bool,
    pub role: Option<OrganizationRole>,
    pub entitlement: Option<Entitlement>,
    pub reason: &'static str,
}

pub struct AuthorizationService {
    postgres: Option<Arc<PostgresClient>>,
}

impl AuthorizationService {
    /// Locks the exact membership/user/organization rows until a billing mutation commits.
    pub(crate) async fn require_locked_billing_owner(
        tx: &tokio_postgres::Transaction<'_>, actor: Uuid, org: Uuid,
    ) -> Result<()> {
        Self::require_locked_action(tx, actor, org, OrganizationAction::ManageBilling).await
    }
    pub(crate) async fn require_locked_action(
        tx: &tokio_postgres::Transaction<'_>, actor: Uuid, org: Uuid, action: OrganizationAction,
    ) -> Result<()> {
        let row = tx.query_opt("SELECT m.role FROM organization_members m JOIN organizations o ON o.id=m.organization_id JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.deactivated_at IS NULL AND o.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL FOR SHARE OF m,o,u", &[&org,&actor]).await?;
        let role = row.map(|r| parse_role(r.get::<_,String>(0).as_str())).transpose()?;
        let decision = Self::decide(role, action, None, true);
        if !decision.allowed { return Err(AuthorizationDenied(decision.reason).into()); }
        Ok(())
    }

    /// Team reads always resolve the team inside the tenant. ReadTeam alone is
    /// insufficient: an organization member is not a member of every team.
    pub async fn require_team_read(
        &self,
        actor: Uuid,
        org: Uuid,
        team: Option<Uuid>,
    ) -> Result<()> {
        let decision = self
            .require(actor, org, OrganizationAction::ReadSelf, None)
            .await?;
        if let Some(team) = team {
            let postgres = self.postgres.as_deref().context("PostgreSQL unavailable")?;
            let row = postgres
                .query_opt(
                    "SELECT 1 FROM teams t WHERE t.id = $1 AND t.organization_id = $2
                 AND (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id
                   AND tm.user_id = $3) OR $4)",
                    &[
                        &team,
                        &org,
                        &actor,
                        &matches!(
                            decision.role,
                            Some(OrganizationRole::Owner | OrganizationRole::Admin)
                        ),
                    ],
                )
                .await?;
            if row.is_none() {
                return Err(AuthorizationDenied("team is outside actor scope").into());
            }
        } else if !matches!(
            decision.role,
            Some(OrganizationRole::Owner | OrganizationRole::Admin)
        ) {
            return Err(
                AuthorizationDenied("organization-wide insights require owner or admin").into(),
            );
        }
        Ok(())
    }

    pub fn new(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self { postgres }
    }

    pub fn decide(
        role: Option<OrganizationRole>,
        action: OrganizationAction,
        entitlement: Option<Entitlement>,
        entitlement_enabled: bool,
    ) -> AuthorizationDecision {
        let Some(role) = role else {
            return AuthorizationDecision {
                allowed: false,
                role: None,
                entitlement,
                reason: "actor is not an organization member",
            };
        };
        let role_allowed = match action {
            OrganizationAction::ReadSelf => true,
            OrganizationAction::ReadTeam => matches!(
                role,
                OrganizationRole::Owner
                    | OrganizationRole::Admin
                    | OrganizationRole::Member
                    | OrganizationRole::Viewer
            ),
            OrganizationAction::ReadOrganization
            | OrganizationAction::ManageMembers
            | OrganizationAction::ManageTeams
            | OrganizationAction::ManageIntegrations => {
                matches!(role, OrganizationRole::Owner | OrganizationRole::Admin)
            }
            OrganizationAction::ManageBilling | OrganizationAction::ManageSecurity => {
                role == OrganizationRole::Owner
            }
        };
        let entitlement_allowed = entitlement.is_none() || entitlement_enabled;
        AuthorizationDecision {
            allowed: role_allowed && entitlement_allowed,
            role: Some(role),
            entitlement,
            reason: if !role_allowed {
                "role does not permit this action"
            } else if !entitlement_allowed {
                "feature is not enabled for this organization"
            } else {
                "allowed"
            },
        }
    }

    pub async fn require(
        &self,
        actor_user_id: Uuid,
        organization_id: Uuid,
        action: OrganizationAction,
        entitlement: Option<Entitlement>,
    ) -> Result<AuthorizationDecision> {
        let postgres = self
            .postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT m.role FROM organization_members m JOIN organizations o ON o.id = m.organization_id
                 JOIN users u ON u.id = m.user_id
                 WHERE m.organization_id = $1 AND m.user_id = $2 AND m.deactivated_at IS NULL AND o.deleted_at IS NULL
                   AND u.is_active AND u.deleted_at IS NULL",
                &[&organization_id, &actor_user_id],
            )
            .await
            .context("failed to resolve organization membership")?;
        let role = row
            .map(|row| parse_role(row.get::<_, String>("role").as_str()))
            .transpose()?;
        let entitlement_enabled = match entitlement {
            None => true,
            Some(feature) => {
                let key = entitlement_key(feature);
                postgres
                    .client()
                    .query_opt(
                        "SELECT 1 FROM entitlements e
                         JOIN subscriptions s ON s.id = e.subscription_id
                         JOIN billing_customers b ON b.id = s.billing_customer_id
                         WHERE b.organization_id = $1 AND e.feature_key = $2
                           AND s.status IN ('trialing', 'active')
                           AND e.effective_from <= now()
                           AND (e.effective_to IS NULL OR e.effective_to > now())
                         LIMIT 1",
                        &[&organization_id, &key],
                    )
                    .await
                    .context("failed to resolve organization entitlement")?
                    .is_some()
            }
        };
        let decision = Self::decide(role, action, entitlement, entitlement_enabled);
        if decision.allowed {
            Ok(decision)
        } else {
            Err(AuthorizationDenied(decision.reason).into())
        }
    }
}

fn parse_role(value: &str) -> Result<OrganizationRole> {
    match value {
        "owner" => Ok(OrganizationRole::Owner),
        "admin" => Ok(OrganizationRole::Admin),
        "member" => Ok(OrganizationRole::Member),
        "viewer" => Ok(OrganizationRole::Viewer),
        _ => Err(anyhow!("unknown organization role")),
    }
}

fn entitlement_key(entitlement: Entitlement) -> &'static str {
    match entitlement {
        Entitlement::OrganizationDashboards => "organization_dashboards",
        Entitlement::SsoScim => "sso_scim",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_can_manage_security_but_member_cannot() {
        assert!(
            AuthorizationService::decide(
                Some(OrganizationRole::Owner),
                OrganizationAction::ManageSecurity,
                Some(Entitlement::SsoScim),
                true,
            )
            .allowed
        );
        assert!(
            !AuthorizationService::decide(
                Some(OrganizationRole::Member),
                OrganizationAction::ManageSecurity,
                Some(Entitlement::SsoScim),
                true,
            )
            .allowed
        );
    }

    #[test]
    fn entitlements_gate_allowed_roles() {
        let decision = AuthorizationService::decide(
            Some(OrganizationRole::Admin),
            OrganizationAction::ReadOrganization,
            Some(Entitlement::OrganizationDashboards),
            false,
        );
        assert!(!decision.allowed);
        assert_eq!(
            decision.reason,
            "feature is not enabled for this organization"
        );
    }
}

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
    DeleteOrganization,
    ExportData,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Entitlement {
    OrganizationDashboards,
    Integrations,
    Export,
    SsoScim,
    Billing,
}

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
            | OrganizationAction::ManageIntegrations
            | OrganizationAction::ExportData => {
                matches!(role, OrganizationRole::Owner | OrganizationRole::Admin)
            }
            OrganizationAction::ManageBilling
            | OrganizationAction::ManageSecurity
            | OrganizationAction::DeleteOrganization => role == OrganizationRole::Owner,
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
                "SELECT role FROM organization_members
                 WHERE organization_id = $1 AND user_id = $2 AND deactivated_at IS NULL",
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
            Err(anyhow!(decision.reason))
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
        Entitlement::Integrations => "integrations",
        Entitlement::Export => "export",
        Entitlement::SsoScim => "sso_scim",
        Entitlement::Billing => "billing",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_can_manage_security_but_member_cannot() {
        assert!(AuthorizationService::decide(
            Some(OrganizationRole::Owner),
            OrganizationAction::ManageSecurity,
            Some(Entitlement::SsoScim),
            true,
        )
        .allowed);
        assert!(!AuthorizationService::decide(
            Some(OrganizationRole::Member),
            OrganizationAction::ManageSecurity,
            Some(Entitlement::SsoScim),
            true,
        )
        .allowed);
    }

    #[test]
    fn entitlements_gate_allowed_roles() {
        let decision = AuthorizationService::decide(
            Some(OrganizationRole::Admin),
            OrganizationAction::ExportData,
            Some(Entitlement::Export),
            false,
        );
        assert!(!decision.allowed);
        assert_eq!(decision.reason, "feature is not enabled for this organization");
    }
}

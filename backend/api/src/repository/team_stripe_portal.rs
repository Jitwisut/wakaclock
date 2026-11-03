//! A sealed current portal read proof. No portal URL, session or accepted
//! financial transaction is persisted; no provider call holds SQL locks.
use crate::{
    infrastructure::{
        postgres::PostgresClient,
        team_financial_guard::{CommercialDeployment, FinancialGuard},
    },
    services::{
        authorization::AuthorizationService, team_financial_ingress::Scope,
        team_insights::TeamError, team_stripe_portal::PortalPolicy,
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone, PartialEq, Eq)]
struct Identity {
    actor: Uuid,
    organization: Uuid,
    account: String,
    live: bool,
    operation: Uuid,
    revision: i64,
    customer: String,
    binding: Option<(String, i64)>,
    source_token: String,
    enrollment_token: String,
    policy_hash: String,
}
#[derive(Clone)]
pub struct PortalRepository {
    pg: Arc<PostgresClient>,
    deployment: CommercialDeployment,
}
pub struct PortalProof {
    repository: PortalRepository,
    identity: Identity,
    lease: Uuid,
}
impl PortalRepository {
    pub fn new(pg: Arc<PostgresClient>, deployment: CommercialDeployment) -> Self {
        Self { pg, deployment }
    }
    pub async fn proof(
        &self,
        actor: Uuid,
        org: Uuid,
        policy: &PortalPolicy,
        lease: Uuid,
    ) -> Result<PortalProof> {
        ensure!(!lease.is_nil(), "portal_scope_lease_required");
        let identity = self.capture(actor, org, policy, Some(lease)).await?;
        Ok(PortalProof {
            repository: self.clone(),
            identity,
            lease,
        })
    }
    async fn capture(
        &self,
        actor: Uuid,
        org: Uuid,
        policy: &PortalPolicy,
        lease: Option<Uuid>,
    ) -> Result<Identity> {
        let api = crate::infrastructure::stripe::StripeApiConfig::from_env()?
            .context("portal_provider_configuration_unavailable")?;
        ensure!(
            api.account_id == policy.account() && api.livemode == policy.live(),
            TeamError::ProjectionChanged
        );
        let current = CommercialDeployment::required_from_environment()?;
        let guard = self.deployment.guard();
        ensure!(
            current.guard().same_authority(guard),
            "financial_guard_configuration_changed"
        );
        let policy_hash = policy.digest()?;
        ensure!(
            PortalPolicy::from_environment(policy.account(), policy.live())?.digest()?
                == policy_hash,
            TeamError::ProjectionChanged
        );
        let account = Scope {
            account: policy.account().into(),
            live: policy.live(),
        };
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::team_financial_locks::organization(&tx, &account.account, account.live, org).await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        ensure!(
            tx.query_opt(
                "SELECT 1 FROM team_rollouts WHERE organization_id=$1 AND enabled FOR SHARE",
                &[&org]
            )
            .await?
            .is_some(),
            TeamError::Disabled
        );
        super::team_financial_ingress::require_authority(&tx, &account, Some(guard)).await?;
        super::team_financial_ingress::ready(&tx, guard, &account).await?;
        ensure!(
            super::team_financial_transaction::source_mode(&tx, guard, &account).await?,
            "portal_financial_source_evidence_required"
        );
        let row=tx.query_opt("SELECT operation_id,revision,customer_id FROM team_stripe_customer_operations WHERE organization_id=$1 AND account_id=$2 AND livemode=$3 AND disposition='verified' AND customer_id IS NOT NULL FOR SHARE",&[&org,&account.account,&account.live]).await?
            .context(TeamError::Invalid("verified billing customer required"))?;
        let customer: String = row.get(2);
        ensure!(
            row.get::<_, i64>(1) > 0 && crate::services::team_stripe::id(&customer, "cus_"),
            "portal_customer_unconfirmed"
        );
        let binding=tx.query_opt("SELECT account_id,livemode,customer_id,subscription_id,revision,enabled FROM team_stripe_bindings WHERE organization_id=$1 FOR SHARE",&[&org]).await?;
        let binding = if let Some(binding) = binding {
            ensure!(
                binding.get::<_, String>(0) == account.account
                    && binding.get::<_, bool>(1) == account.live
                    && binding.get::<_, String>(2) == customer
                    && binding.get::<_, bool>(5),
                "portal_binding_scope_unconfirmed"
            );
            let subscription: String = binding.get(3);
            let revision: i64 = binding.get(4);
            ensure!(
                revision > 0 && crate::services::team_stripe::id(&subscription, "sub_"),
                "portal_binding_unconfirmed"
            );
            Some((subscription, revision))
        } else {
            None
        };
        let enrollment = super::team_analytics_entitlement::load(&tx, org).await?;
        let read = guard.read()?;
        read.snapshot.verify(org, enrollment.as_ref())?;
        let enrollment_token = read.organization_token(org)?;
        let source_token = super::team_financial_inventory::account_source_token(guard, &account)?;
        let deadline = if let Some(lease) = lease {
            Some(tx.query_opt("SELECT lease_until FROM team_stripe_runtime_status WHERE account_id=$1 AND livemode=$2 AND lease_id=$3 AND lease_until>clock_timestamp() AND retry_at<=clock_timestamp() FOR SHARE",&[&account.account,&account.live,&lease]).await?
                .context("portal_scope_lease_unconfirmed")?.get::<_,DateTime<Utc>>(0))
        } else {
            None
        };
        let identity = Identity {
            actor,
            organization: org,
            account: account.account.clone(),
            live: account.live,
            operation: row.get(0),
            revision: row.get(1),
            customer: customer.clone(),
            binding,
            source_token,
            enrollment_token,
            policy_hash,
        };
        let write = super::team_financial_transaction::NormalWrite::begin_customer(
            tx, guard, &account, org, &customer,
        )
        .await?;
        let committed = if let Some(deadline) = deadline {
            write.commit_read_before(deadline).await?
        } else {
            write.commit_operational(None).await?
        };
        ensure!(committed, "portal_scope_lease_unconfirmed");
        ensure!(
            guard.read()?.organization_token(org)? == identity.enrollment_token
                && super::team_financial_inventory::account_source_token(guard, &account)?
                    == identity.source_token
                && PortalPolicy::from_environment(policy.account(), policy.live())?.digest()?
                    == identity.policy_hash,
            TeamError::ProjectionChanged
        );
        Ok(identity)
    }
}
impl PortalProof {
    pub(crate) fn customer(&self) -> &str {
        &self.identity.customer
    }
    pub(crate) fn account(&self) -> &str {
        &self.identity.account
    }
    pub(crate) fn live(&self) -> bool {
        self.identity.live
    }
    pub(crate) fn request_key(&self, policy: &PortalPolicy, request: Uuid) -> Result<String> {
        ensure!(
            !request.is_nil() && policy.digest()? == self.identity.policy_hash,
            TeamError::ProjectionChanged
        );
        Ok(format!(
            "atoaxis-portal-v1-{}",
            crate::services::team_financial_guard::fingerprint(&(
                self.identity.actor,
                self.identity.organization,
                self.account(),
                self.live(),
                self.identity.operation,
                self.identity.revision,
                self.customer(),
                &self.identity.binding,
                &self.identity.policy_hash,
                policy.return_url(),
                request,
            ))?
        ))
    }
    pub(crate) async fn preflight(
        &self,
        policy: &PortalPolicy,
        client_guard: Option<&FinancialGuard>,
    ) -> Result<()> {
        ensure!(
            client_guard.is_some_and(|g| g.same_authority(self.repository.deployment.guard())),
            "portal_financial_authority_changed"
        );
        let current = self
            .repository
            .capture(
                self.identity.actor,
                self.identity.organization,
                policy,
                Some(self.lease),
            )
            .await?;
        ensure!(current == self.identity, TeamError::ProjectionChanged);
        Ok(())
    }
    pub(crate) async fn response_fence(&self, policy: &PortalPolicy) -> Result<()> {
        let current = self
            .repository
            .capture(
                self.identity.actor,
                self.identity.organization,
                policy,
                None,
            )
            .await?;
        ensure!(current == self.identity, TeamError::ProjectionChanged);
        Ok(())
    }
}

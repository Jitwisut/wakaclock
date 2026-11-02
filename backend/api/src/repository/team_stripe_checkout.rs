//! Durable purchase confirmation. Does not grant access or infer payment from a session.
use super::team_stripe_quote::{CustomerProof, QuoteRepository};
use crate::{
    infrastructure::{postgres::PostgresClient, stripe::ProviderError},
    services::{
        authorization::{AuthorizationDenied, AuthorizationService},
        team_insights::TeamError,
        team_stripe_checkout::{
            CheckoutPolicy, ExpectedSession, FrozenRequest, SessionEvidence, SubscriptionEvidence,
        },
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;
#[path = "team_stripe_checkout_dispatch.rs"]
mod dispatch;

#[derive(Serialize)]
pub struct CheckoutStatus {
    pub operation_id: Uuid,
    pub quote_id: Uuid,
    pub revision: i64,
    pub disposition: String,
    pub retry_at: DateTime<Utc>,
    pub observed_at: Option<DateTime<Utc>>,
    pub last_error_code: Option<String>,
    pub checkout_available: bool,
    pub payment_verified: bool,
    pub test_checkout_destination_available: bool,
    pub lookup_only: bool,
    pub invoice_assessment: Option<crate::services::team_stripe_payment::Assessment>,
}
#[derive(PartialEq)]
pub struct CheckoutDestinationProof {
    pub operation: Uuid,
    pub revision: i64,
    pub proof: CustomerProof,
    pub session: String,
    pub price: String,
    pub currency: String,
    pub amount_minor: i64,
    pub request_hash: String,
}
impl CheckoutDestinationProof {
    pub fn expected(&self) -> ExpectedSession<'_> {
        ExpectedSession {
            operation: self.operation,
            customer: &self.proof.customer,
            price: &self.price,
            currency: &self.currency,
            amount_minor: self.amount_minor,
            live: self.proof.live,
        }
    }
}
pub struct CheckoutClaim {
    pub operation: Uuid,
    pub revision: i64,
    pub lease: Uuid,
    pub proof: CustomerProof,
    pub price: String,
    pub currency: String,
    pub amount_minor: i64,
    pub seats: u16,
    pub catalog_hash: String,
    pub request: FrozenRequest,
    pub session_id: Option<String>,
    pub lookup_only: bool,
    pub(crate) financial: Option<dispatch::Proof>,
}
impl CheckoutClaim {
    pub(super) fn source_request(
        &self,
        guard: &crate::infrastructure::team_financial_guard::FinancialGuard,
    ) -> Result<crate::services::team_financial_source::AcceptedRequest> {
        self.financial
            .as_ref()
            .context("financial_checkout_claim_proof_required")?
            .source_request(self, guard)
            .cloned()
    }
    pub(crate) async fn provider_preflight(
        &self,
        guard: Option<&crate::infrastructure::team_financial_guard::FinancialGuard>,
        create: bool,
    ) -> Result<()> {
        if let Some(proof) = &self.financial {
            return proof.preflight(self, guard, create).await;
        }
        // Unsealed legacy contract callers predate independent financial source
        // authority. A configured authority always requires the sealed proof.
        ensure!(guard.is_none(), "financial_checkout_claim_proof_required");
        Ok(())
    }
    pub(crate) fn retain_session(
        &self,
        evidence: &SessionEvidence,
        kind: crate::services::team_stripe_checkout_receipt::ObservationKind,
    ) -> Result<()> {
        match &self.financial {
            Some(proof) => proof.retain(self, evidence, kind),
            None => Ok(()),
        }
    }
    pub(crate) fn retain_lookup_result(&self, reason: &str) -> Result<Option<Uuid>> {
        use crate::services::team_stripe_checkout_receipt::{
            FailureDetail, FailurePhase, FailureResult,
        };
        ensure!(self.lookup_only, "financial_checkout_lookup_not_authorized");
        let detail = FailureDetail {
            phase: FailurePhase::LookupFlow,
            result: FailureResult::lookup(reason)?,
            http_status: None,
            retry_after: None,
        };
        self.financial
            .as_ref()
            .map(|proof| proof.retain_failure(self, detail))
            .transpose()
            .map(Option::flatten)
    }
    pub(crate) fn retain_provider_failure(
        &self,
        phase: crate::services::team_stripe_checkout_receipt::FailurePhase,
        error: &ProviderError,
    ) -> Result<Option<Uuid>> {
        use super::team_stripe::Failure;
        use crate::services::team_stripe_checkout_receipt::{
            FailureCode as Code, FailureDetail, FailureResult,
        };
        let code = match error.kind {
            Failure::Network => Code::Network,
            Failure::Provider => Code::ProviderUnavailable,
            Failure::RateLimited => Code::RateLimited,
            Failure::Auth => Code::AuthRequired,
            Failure::Permission => Code::PermissionRequired,
            Failure::NotFound => Code::NotFound,
            Failure::InvalidContract => Code::UnsupportedContract,
            Failure::ScopeMismatch => Code::ScopeMismatch,
            Failure::ObservationChanged => Code::ObservationChanged,
        };
        let detail = FailureDetail {
            phase,
            result: FailureResult::Provider { code },
            http_status: error.status,
            retry_after: error.retry_after,
        };
        self.financial
            .as_ref()
            .map(|proof| proof.retain_failure(self, detail))
            .transpose()
            .map(Option::flatten)
    }
    pub fn expected(&self) -> ExpectedSession<'_> {
        ExpectedSession {
            operation: self.operation,
            customer: &self.proof.customer,
            price: &self.price,
            currency: &self.currency,
            amount_minor: self.amount_minor,
            live: self.proof.live,
        }
    }
}
pub struct CheckoutRepository {
    pg: Arc<PostgresClient>,
    financial_guard: Option<crate::infrastructure::team_financial_guard::FinancialGuard>,
    financial_configuration_error: bool,
}
enum CheckoutTransaction<'a> {
    Source(super::team_financial_transaction::NormalWrite<'a>),
    Legacy {
        tx: deadpool_postgres::Transaction<'a>,
        evidence: Option<(
            crate::infrastructure::team_financial_guard::FinancialGuard,
            crate::services::team_financial_ingress::Scope,
            String,
        )>,
    },
}
impl CheckoutTransaction<'_> {
    fn sql(&self) -> &tokio_postgres::Transaction<'_> {
        match self {
            Self::Source(write) => write.sql(),
            Self::Legacy { tx, .. } => tx,
        }
    }
    fn original(
        &self,
        row: &tokio_postgres::Row,
        quote: &tokio_postgres::Row,
    ) -> Result<Option<crate::services::team_financial_source::AcceptedRequest>> {
        match self {
            Self::Source(write) => {
                let (scope, accepted) =
                    write.checkout_request(row.get("organization_id"), row.get("operation_id"))?;
                ensure!(
                    super::team_stripe_checkout_control::original(row, quote, &scope)? == accepted,
                    "financial_checkout_original_request_changed"
                );
                Ok(Some(accepted))
            }
            Self::Legacy { .. } => Ok(None),
        }
    }
    async fn commit_lifecycle(
        self,
        organization: Uuid,
        request: Option<crate::services::team_financial_source::AcceptedRequest>,
        expected_revision: i64,
        stage: crate::services::team_financial_transaction::CheckoutStage,
        deadline: Option<DateTime<Utc>>,
    ) -> Result<()> {
        match self {
            Self::Source(write) => {
                write
                    .commit_checkout_lifecycle(
                        crate::services::team_financial_transaction::Writer::CheckoutLifecycle {
                            organization,
                            request: request.context("financial_checkout_request_unconfirmed")?,
                            expected_revision,
                            stage,
                        },
                        deadline,
                    )
                    .await
            }
            legacy @ Self::Legacy { .. } => match deadline {
                Some(at) => legacy.commit_before(at).await,
                None => legacy.commit().await,
            },
        }
    }
    fn pending_result(&self) -> bool {
        matches!(self, Self::Source(write) if write.lookup_resolution().is_some())
    }
    async fn rollback(self) -> Result<()> {
        match self {
            Self::Source(write) => write.rollback().await,
            Self::Legacy { tx, .. } => {
                tx.rollback().await?;
                Ok(())
            }
        }
    }
    async fn commit_before(self, deadline: DateTime<Utc>) -> Result<()> {
        match self {
            Self::Source(write) => write.commit_checkout_claim(deadline).await,
            legacy @ Self::Legacy { .. } => {
                let now: DateTime<Utc> = legacy
                    .sql()
                    .query_one("SELECT clock_timestamp()", &[])
                    .await?
                    .get(0);
                ensure!(now < deadline, "financial_checkout_lease_unconfirmed");
                legacy.commit().await
            }
        }
    }
    async fn commit(self) -> Result<()> {
        match self {
            Self::Source(write) => ensure!(
                write.commit_operational(None).await?,
                "financial_checkout_read_unconfirmed"
            ),
            Self::Legacy { tx, evidence } => {
                if let Some((guard, scope, token)) = evidence {
                    ensure!(
                        super::team_financial_inventory::account_source_token(&guard, &scope)?
                            == token,
                        "financial_source_changed_before_commit"
                    );
                }
                tx.commit().await?;
            }
        }
        Ok(())
    }
}
impl CheckoutRepository {
    pub fn new(pg: Arc<PostgresClient>) -> Self {
        match crate::infrastructure::team_financial_guard::FinancialObservation::from_environment()
        {
            Ok(observation) => {
                Self::with_financial_authority(pg, observation.guard().cloned(), false)
            }
            Err(_) => Self::with_financial_authority(pg, None, true),
        }
    }
    pub(crate) fn with_financial_authority(
        pg: Arc<PostgresClient>,
        financial_guard: Option<crate::infrastructure::team_financial_guard::FinancialGuard>,
        financial_configuration_error: bool,
    ) -> Self {
        Self {
            pg,
            financial_guard,
            financial_configuration_error,
        }
    }
    pub(super) fn authority(
        &self,
    ) -> Result<&crate::infrastructure::team_financial_guard::FinancialGuard> {
        ensure!(
            !self.financial_configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        self.financial_guard
            .as_ref()
            .context("financial_guard_configuration_unconfirmed")
    }
    pub(super) fn postgres(&self) -> &PostgresClient {
        &self.pg
    }
    async fn serialize(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        org: Uuid,
        account: &str,
        live: bool,
    ) -> Result<()> {
        super::team_financial_locks::organization(tx, account, live, org).await?;
        ensure!(
            !self.financial_configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        super::team_financial_ingress::require_authority(tx, &scope, self.financial_guard.as_ref())
            .await?;
        if let Some(guard) = &self.financial_guard {
            ensure!(
                !super::team_financial_transaction::source_mode(tx, guard, &scope).await?,
                "financial_checkout_source_integration_required"
            );
        }
        Ok(())
    }
    async fn read<'a>(
        &self,
        tx: deadpool_postgres::Transaction<'a>,
        org: Uuid,
        account: &str,
        live: bool,
    ) -> Result<CheckoutTransaction<'a>> {
        ensure!(
            !self.financial_configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        super::team_financial_ingress::lock(&tx, &scope).await?;
        super::team_financial_ingress::require_authority(
            &tx,
            &scope,
            self.financial_guard.as_ref(),
        )
        .await?;
        let evidence = self
            .financial_guard
            .as_ref()
            .map(|guard| {
                Ok::<_, anyhow::Error>((
                    guard.clone(),
                    scope.clone(),
                    super::team_financial_inventory::account_source_token(guard, &scope)?,
                ))
            })
            .transpose()?;
        if let Some(guard) = &self.financial_guard {
            if super::team_financial_transaction::source_mode(&tx, guard, &scope).await? {
                return Ok(CheckoutTransaction::Source(
                    super::team_financial_transaction::NormalWrite::begin_organization(
                        tx, guard, &scope, org,
                    )
                    .await?,
                ));
            }
        }
        self.serialize(&tx, org, account, live).await?;
        Ok(CheckoutTransaction::Legacy { tx, evidence })
    }
    pub async fn request(
        &self,
        proof: &CustomerProof,
        quote: Uuid,
        digest: &str,
        confirmed: bool,
        policy: &CheckoutPolicy,
    ) -> Result<CheckoutStatus> {
        ensure!(
            confirmed,
            TeamError::Invalid("confirm the displayed package price")
        );
        ensure!(
            !self.financial_configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        let scope = crate::services::team_financial_ingress::Scope {
            account: proof.account.clone(),
            live: proof.live,
        };
        self.settle_history(&scope).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_ingress::lock(&tx, &scope).await?;
        super::team_financial_ingress::require_authority(
            &tx,
            &scope,
            self.financial_guard.as_ref(),
        )
        .await?;
        let legacy_token = self
            .financial_guard
            .as_ref()
            .map(|guard| super::team_financial_inventory::account_source_token(guard, &scope))
            .transpose()?;
        if let Some(guard) = &self.financial_guard {
            if super::team_financial_transaction::source_mode(&tx, guard, &scope).await? {
                let write = super::team_financial_transaction::NormalWrite::begin_customer(
                    tx,
                    guard,
                    &scope,
                    proof.org,
                    &proof.customer,
                )
                .await?;
                let (status, accepted) =
                    Self::request_row(write.sql(), proof, quote, digest, policy).await?;
                if let Some((writer, deadline)) = accepted {
                    write.commit_checkout_request(writer, deadline).await?;
                } else {
                    ensure!(
                        write.commit_operational(None).await?,
                        "financial_checkout_read_unconfirmed"
                    );
                }
                return Ok(status);
            }
        }
        self.serialize(&tx, proof.org, &proof.account, proof.live)
            .await?;
        let (status, _) = Self::request_row(&tx, proof, quote, digest, policy).await?;
        ensure!(
            self.financial_guard
                .as_ref()
                .map(|guard| super::team_financial_inventory::account_source_token(guard, &scope))
                .transpose()?
                == legacy_token,
            "financial_source_changed_before_commit"
        );
        tx.commit().await?;
        Ok(status)
    }
    pub(super) async fn settle_history(
        &self,
        scope: &crate::services::team_financial_ingress::Scope,
    ) -> Result<()> {
        let Some(guard) = &self.financial_guard else {
            return Ok(());
        };
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_ingress::lock(&tx, scope).await?;
        let pending = guard
            .read()?
            .snapshot
            .transactions
            .groups
            .values()
            .any(|g| !g.committed && g.proposal.account == *scope);
        if pending {
            super::team_financial_transaction::reconcile_account_history(tx, guard, scope).await?;
        } else {
            tx.rollback().await?;
        }
        Ok(())
    }
    async fn request_row(
        tx: &tokio_postgres::Transaction<'_>,
        proof: &CustomerProof,
        quote: Uuid,
        digest: &str,
        policy: &CheckoutPolicy,
    ) -> Result<(
        CheckoutStatus,
        Option<(
            crate::services::team_financial_transaction::Writer,
            DateTime<Utc>,
        )>,
    )> {
        let current =
            QuoteRepository::guard(tx, proof.actor, proof.org, &proof.account, proof.live).await?;
        ensure!(current == *proof, TeamError::ProjectionChanged);
        let q=tx.query_opt("SELECT * FROM team_stripe_quotes WHERE id=$1 AND organization_id=$2 AND actor_id=$3 FOR SHARE",&[&quote,&proof.org,&proof.actor]).await?.ok_or(TeamError::NotFound)?;
        QuoteRepository::check(&q, &current, digest)?;
        // A retry returns exactly the existing operation even after its original quote expires.
        if let Some(row) = tx
            .query_opt(
                "SELECT * FROM team_stripe_checkout_intents WHERE quote_id=$1",
                &[&quote],
            )
            .await?
        {
            let result = Self::view(&row);
            return Ok((result, None));
        }
        ensure!(tx.query_opt("SELECT 1 FROM team_stripe_checkout_intents WHERE organization_id=$1 AND disposition<>'expired'",&[&proof.org]).await?.is_none(),TeamError::Invalid("existing checkout must be reconciled first"));
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        ensure!(
            q.get::<_, DateTime<Utc>>("expires_at") > now,
            TeamError::Invalid("quote expired; request a new quote")
        );
        Self::capacity(tx, proof.org, q.get("package_seats")).await?;
        let id = Uuid::now_v7();
        let price: String = q.get("price_id");
        let currency: String = q.get("currency");
        let expected = ExpectedSession {
            operation: id,
            customer: &current.customer,
            price: &price,
            currency: &currency,
            amount_minor: q.get("amount_minor"),
            live: current.live,
        };
        let frozen = FrozenRequest::new(&expected, policy)?;
        let request = serde_json::to_value(&frozen)?;
        let request_hash = frozen.digest()?;
        let row=tx.query_one("INSERT INTO team_stripe_checkout_intents(operation_id,organization_id,actor_id,quote_id,account_id,livemode,request_metadata,request_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",&[&id,&proof.org,&proof.actor,&quote,&proof.account,&proof.live,&request,&request_hash]).await?;
        let accepted = frozen.accepted(
            &crate::services::team_financial_source::Scope {
                organization: proof.org,
                account: proof.account.clone(),
                live: proof.live,
            },
            proof.actor,
            quote,
            &expected,
            row.get("confirmed_at"),
        )?;
        Ok((
            Self::view(&row),
            Some((
                crate::services::team_financial_transaction::Writer::CheckoutRequest {
                    organization: proof.org,
                    quote,
                    customer: current.customer,
                    request: accepted,
                },
                q.get("expires_at"),
            )),
        ))
    }
    async fn capacity(tx: &tokio_postgres::Transaction<'_>, org: Uuid, seats: i32) -> Result<()> {
        let n:i64=tx.query_one("SELECT count(*) FROM organization_members m WHERE m.organization_id=$1 AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer'",&[&org]).await?.get(0);
        ensure!(
            n <= i64::from(seats),
            TeamError::Invalid("package has fewer seats than current developers")
        );
        Ok(())
    }
    pub async fn status(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
        operation: Uuid,
    ) -> Result<CheckoutStatus> {
        self.settle_history(&crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        })
        .await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let read = self.read(tx, org, account, live).await?;
        let tx = read.sql();
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4",&[&operation,&org,&account,&live]).await?.ok_or(TeamError::NotFound)?;
        let mut result = Self::view(&row);
        result.invoice_assessment =
            Self::invoice_assessment(&tx, org, account, live, operation).await?;
        read.commit().await?;
        Ok(result)
    }
    async fn invoice_assessment(
        tx: &tokio_postgres::Transaction<'_>,
        org: Uuid,
        account: &str,
        live: bool,
        operation: Uuid,
    ) -> Result<Option<crate::services::team_stripe_payment::Assessment>> {
        let row = tx.query_opt("SELECT s.payment_assessment,clock_timestamp(),(b.enabled AND b.revision=s.binding_revision AND s.source_revision=j.applied_revision AND j.requested_revision=j.applied_revision) AS current FROM team_stripe_bindings b JOIN team_stripe_snapshots s USING(organization_id) JOIN team_stripe_reconcile_jobs j ON j.account_id=b.account_id AND j.livemode=b.livemode AND j.subscription_id=b.subscription_id JOIN team_stripe_checkout_intents c ON c.organization_id=b.organization_id AND c.account_id=b.account_id AND c.livemode=b.livemode AND c.subscription_id=b.subscription_id WHERE b.organization_id=$1 AND b.account_id=$2 AND b.livemode=$3 AND c.operation_id=$4 AND c.disposition='bound'", &[&org,&account,&live,&operation]).await?;
        let Some(r) = row else {
            return Ok(None);
        };
        let Some(value) = r.get::<_, Option<serde_json::Value>>(0) else {
            return Ok(None);
        };
        let assessment: crate::services::team_stripe_payment::Assessment =
            serde_json::from_value(value)?;
        Ok(Some(assessment.current(r.get(1), r.get(2))))
    }
    pub async fn destination_proof(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
        expected: (Uuid, i64),
    ) -> Result<CheckoutDestinationProof> {
        self.settle_history(&crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        })
        .await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let read = self.read(tx, org, account, live).await?;
        let tx = read.sql();
        let proof = QuoteRepository::guard(&tx, actor, org, account, live).await?;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR SHARE",&[&expected.0,&org,&account,&live]).await?.ok_or(TeamError::NotFound)?;
        ensure!(
            row.get::<_, i64>("revision") == expected.1
                && row.get::<_, String>("disposition") == "session_open",
            TeamError::ProjectionChanged
        );
        let quote: Uuid = row.get("quote_id");
        let q = tx
            .query_one(
                "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                &[&quote],
            )
            .await?;
        Self::check_recovery_scope(&q, &proof)?;
        let session: Option<String> = row.get("session_id");
        let request: Option<serde_json::Value> = row.get("request_metadata");
        let hash: Option<String> = row.get("request_sha256");
        let result = CheckoutDestinationProof {
            operation: expected.0,
            revision: expected.1,
            proof,
            session: session.ok_or(TeamError::ProjectionChanged)?,
            price: q.get("price_id"),
            currency: q.get("currency"),
            amount_minor: q.get("amount_minor"),
            request_hash: hash.ok_or(TeamError::ProjectionChanged)?,
        };
        FrozenRequest::restore(
            &request.ok_or(TeamError::ProjectionChanged)?,
            &result.request_hash,
            &result.expected(),
        )?;
        read.commit().await?;
        Ok(result)
    }
    pub async fn latest(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
    ) -> Result<Option<CheckoutStatus>> {
        self.settle_history(&crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        })
        .await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let read = self.read(tx, org, account, live).await?;
        let tx = read.sql();
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE organization_id=$1 AND account_id=$2 AND livemode=$3 ORDER BY confirmed_at DESC,operation_id DESC LIMIT 1", &[&org,&account,&live]).await?;
        let mut result = row.as_ref().map(Self::view);
        if let Some(status) = result.as_mut() {
            status.invoice_assessment =
                Self::invoice_assessment(&tx, org, account, live, status.operation_id).await?;
        }
        read.commit().await?;
        Ok(result)
    }
    pub async fn authorize_recovery(
        &self,
        actor: Uuid,
        org: Uuid,
        account: &str,
        live: bool,
        expected: (Uuid, i64),
    ) -> Result<()> {
        let (operation, revision) = expected;
        self.settle_history(&crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        })
        .await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let write = self.read(tx, org, account, live).await?;
        let tx = write.sql();
        let proof = QuoteRepository::guard(&tx, actor, org, account, live).await?;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR UPDATE", &[&operation,&org,&account,&live]).await?.ok_or(TeamError::NotFound)?;
        let checked_at: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        ensure!(
            row.get::<_, i64>("revision") == revision
                && ["recovery_required", "owner_changed"]
                    .contains(&row.get::<_, String>("disposition").as_str()),
            TeamError::ProjectionChanged
        );
        ensure!(
            row.get::<_, Option<DateTime<Utc>>>("lease_until")
                .is_none_or(|t| t <= checked_at),
            TeamError::ProjectionChanged
        );
        let quote: Uuid = row.get("quote_id");
        let q = tx
            .query_one(
                "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                &[&quote],
            )
            .await?;
        Self::check_recovery_scope(&q, &proof)?;
        let original = write.original(&row, &q)?;
        let next_revision = revision
            .checked_add(1)
            .context("financial_checkout_revision_overflow")?;
        // Keep the original quote/initiator immutable. Current Owner authorizes lookup only.
        // Preserve retry_at, including Retry-After; the worker still checks its account cooldown.
        tx.execute("UPDATE team_stripe_checkout_intents SET recovery_actor=$2,lookup_only=true,disposition='pending',revision=revision+1,lease_id=NULL,lease_until=NULL WHERE operation_id=$1", &[&operation,&actor]).await?;
        tx.execute("INSERT INTO team_stripe_checkout_authorizations(operation_id,revision,actor_id,action,authorized_at) VALUES($1,$2,$3,'reconcile_existing_checkout',$4)", &[&operation,&next_revision,&actor,&checked_at]).await?;
        write
            .commit_lifecycle(
                org,
                original,
                revision,
                crate::services::team_financial_transaction::CheckoutStage::RecoveryAuthorization {
                    first_attempt_at: row.get("first_attempt_at"),
                    actor,
                    authorized_at: checked_at,
                },
                None,
            )
            .await?;
        Ok(())
    }
    fn check_recovery_scope(q: &tokio_postgres::Row, proof: &CustomerProof) -> Result<()> {
        // Read-only recovery keeps the original quote and customer identity.
        // A later verified revision of that same customer is not a new purchase.
        ensure!(
            q.get::<_, Uuid>("organization_id") == proof.org
                && q.get::<_, String>("account_id") == proof.account
                && q.get::<_, bool>("livemode") == proof.live
                && q.get::<_, Uuid>("customer_operation") == proof.operation
                && q.get::<_, String>("customer_id") == proof.customer
                && q.get::<_, i64>("customer_revision") <= proof.revision,
            TeamError::ProjectionChanged
        );
        Ok(())
    }
    pub async fn claim(
        &self,
        account: &str,
        live: bool,
        digest: &str,
    ) -> Result<Option<CheckoutClaim>> {
        let scope = crate::services::team_financial_ingress::Scope {
            account: account.into(),
            live,
        };
        self.settle_history(&scope).await?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        super::team_financial_locks::account(&tx, account, live).await?;
        let retired = self
            .financial_guard
            .as_ref()
            .map(|guard| super::team_financial_transaction::retired(guard, &scope))
            .transpose()?
            .unwrap_or_default();
        let candidate=tx.query_opt("SELECT *,COALESCE(recovery_actor,actor_id) AS billing_actor FROM team_stripe_checkout_intents WHERE account_id=$1 AND livemode=$2 AND NOT(organization_id=ANY($3::uuid[])) AND (disposition IN ('pending','session_open','awaiting_verification') OR (disposition='recovery_required' AND last_error_code IN ('idempotency_window_unconfirmed','checkout_resource_readback_required'))) AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) ORDER BY retry_at,confirmed_at,operation_id LIMIT 1",&[&account,&live,&retired]).await?;
        let Some(candidate) = candidate else {
            tx.commit().await?;
            return Ok(None);
        };
        let operation: Uuid = candidate.get("operation_id");
        let org: Uuid = candidate.get("organization_id");
        let captured_token = self
            .financial_guard
            .as_ref()
            .map(|guard| super::team_financial_inventory::account_source_token(guard, &scope))
            .transpose()?;
        if let Some(guard) = &self.financial_guard {
            if super::team_financial_transaction::source_mode(&tx, guard, &scope).await? {
                let source_scope = crate::services::team_financial_source::Scope {
                    organization: org,
                    account: account.into(),
                    live,
                };
                let state = guard.read()?.snapshot;
                let receipt = state.sources.scopes.get(&source_scope.key()?).and_then(|entry| {
                    let pending = entry.outcomes.values().any(|o| o.operation == operation && entry.unapplied_outcomes.contains(&o.id));
                    entry.checkout_observations.values()
                    .filter(|value| value.source_claim && value.operation == operation
                        && ((pending && value.revision <= candidate.get::<_,i64>("revision"))
                            || (value.revision == candidate.get::<_,i64>("revision")
                                && value.actor == candidate.get::<_,Uuid>("billing_actor")
                                && Some(value.lease) == candidate.get::<_,Option<Uuid>>("lease_id"))))
                    .max_by_key(|value| (value.revision, value.kind == crate::services::team_stripe_checkout_receipt::ObservationKind::ResourceRead, value.observed_at)).cloned() });
                if let Some(receipt) = receipt {
                    super::team_stripe_checkout_projection::resume(self, tx, source_scope, receipt)
                        .await?;
                    return Ok(None);
                }
                let failure = state
                    .sources
                    .scopes
                    .get(&source_scope.key()?)
                    .and_then(|entry| {
                        entry
                            .checkout_failures
                            .values()
                            .filter(|value| {
                                value.attempt.source_claim
                                    && value.operation == operation
                                    && value.detail.result.terminal()
                                    && value.attempt.revision == candidate.get::<_, i64>("revision")
                                    && value.attempt.actor
                                        == candidate.get::<_, Uuid>("billing_actor")
                                    && Some(value.attempt.lease)
                                        == candidate.get::<_, Option<Uuid>>("lease_id")
                            })
                            .max_by_key(|value| value.observed_at)
                            .cloned()
                    });
                if let Some(failure) = failure {
                    self.resume_failure(tx, source_scope, failure).await?;
                    return Ok(None);
                }
            }
        }
        let write = self.read(tx, org, account, live).await?;
        let source_mode = matches!(&write, CheckoutTransaction::Source(_));
        let tx = write.sql();
        let candidate_actor: Uuid = candidate.get("billing_actor");
        let proof = QuoteRepository::guard(&tx, candidate_actor, org, account, live).await;
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND COALESCE(recovery_actor,actor_id)=$5 AND (disposition IN ('pending','session_open','awaiting_verification') OR (disposition='recovery_required' AND last_error_code IN ('idempotency_window_unconfirmed','checkout_resource_readback_required'))) AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) FOR UPDATE",&[&operation,&org,&account,&live,&candidate_actor]).await?;
        let Some(row) = row else {
            write.commit().await?;
            return Ok(None);
        };
        let recovery_actor: Option<Uuid> = row.get("recovery_actor");
        let quote: Uuid = row.get("quote_id");
        let q = tx
            .query_one(
                "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                &[&quote],
            )
            .await?;
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let first: Option<DateTime<Utc>> = row.get("first_attempt_at");
        let session_id: Option<String> = row.get("session_id");
        let state: String = row.get("disposition");
        let lookup_only = session_id.is_none()
            && (row.get::<_, bool>("lookup_only")
                || first
                    .is_some_and(|t| now.signed_duration_since(t) >= chrono::Duration::hours(23)));
        let effective_digest = if session_id.is_some() || lookup_only {
            q.get::<_, String>("catalog_sha256")
        } else {
            digest.to_owned()
        };
        let mut stop = match &proof {
            Ok(p) => {
                let checked = if session_id.is_some() || lookup_only {
                    Self::check_recovery_scope(&q, p)
                } else {
                    QuoteRepository::check(&q, p, &effective_digest)
                };
                if checked.is_err() {
                    Some(("recovery_required", "checkout_scope_changed"))
                } else {
                    None
                }
            }
            Err(e) if e.downcast_ref::<AuthorizationDenied>().is_some() => {
                Some(("owner_changed", "owner_authorization_changed"))
            }
            Err(e) if e.downcast_ref::<TeamError>().is_some() => {
                Some(("recovery_required", "checkout_scope_changed"))
            }
            Err(_) => return Err(proof.err().unwrap()),
        };
        if session_id.is_none()
            && !lookup_only
            && first.is_none()
            && q.get::<_, DateTime<Utc>>("expires_at") <= now
        {
            stop = Some(("expired", "quote_expired_before_attempt"));
        }
        if stop.is_none() && session_id.is_none() && !lookup_only {
            if let Err(e) = Self::capacity(&tx, org, q.get("package_seats")).await {
                if e.downcast_ref::<TeamError>().is_none() {
                    return Err(e);
                }
                stop = Some(("recovery_required", "developer_capacity_changed"));
            }
        }
        if stop.is_none() && session_id.is_none() && !lookup_only && state != "pending" {
            stop = Some(("recovery_required", "checkout_session_identity_missing"));
        }
        let price: String = q.get("price_id");
        let currency: String = q.get("currency");
        let frozen = if let Ok(p) = &proof {
            let expected = ExpectedSession {
                operation,
                customer: &p.customer,
                price: &price,
                currency: &currency,
                amount_minor: q.get("amount_minor"),
                live: p.live,
            };
            let value: Option<serde_json::Value> = row.get("request_metadata");
            let hash: Option<String> = row.get("request_sha256");
            value
                .zip(hash)
                .and_then(|(v, h)| FrozenRequest::restore(&v, &h, &expected).ok())
        } else {
            None
        };
        if stop.is_none() && frozen.is_none() {
            stop = Some(("recovery_required", "checkout_request_unconfirmed"));
        }
        let accepted = write.original(&row, &q)?;
        if let Some((state, reason)) = stop {
            let revision: i64 = row.get("revision");
            revision
                .checked_add(1)
                .context("financial_checkout_revision_overflow")?;
            tx.execute("UPDATE team_stripe_checkout_intents SET disposition=$2,last_error_code=$3,revision=revision+1,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&operation,&state,&reason]).await?;
            write
                .commit_lifecycle(
                    org,
                    accepted,
                    revision,
                    crate::services::team_financial_transaction::CheckoutStage::Stop {
                        first_attempt_at: first,
                        lookup_only: row.get("lookup_only"),
                        recovery_actor,
                        reason: reason.into(),
                        provider_receipt: None,
                    },
                    None,
                )
                .await?;
            return Ok(None);
        }
        let proof = proof?;
        let lease = Uuid::now_v7();
        let previous_revision: i64 = row.get("revision");
        let resume_read = state == "recovery_required";
        let revision = if resume_read {
            previous_revision
                .checked_add(1)
                .context("financial_checkout_revision_overflow")?
        } else {
            previous_revision
        };
        let send = session_id.is_none() && !lookup_only;
        let first_attempt = if send {
            Some(first.unwrap_or(now))
        } else {
            first
        };
        let initial = send && first.is_none();
        let deadline = now + chrono::Duration::seconds(180);
        tx.execute("UPDATE team_stripe_checkout_intents SET disposition=CASE WHEN $6 THEN 'pending' ELSE disposition END,lookup_only=lookup_only OR $6,revision=$4,first_attempt_at=$5,attempts=attempts+1,lease_id=$2,lease_until=$3 WHERE operation_id=$1", &[&operation,&lease,&deadline,&revision,&first_attempt,&resume_read]).await?;
        let source_scope = crate::services::team_financial_source::Scope {
            organization: org,
            account: account.into(),
            live,
        };
        let original = accepted
            .clone()
            .unwrap_or(super::team_stripe_checkout_control::original(
                &row,
                &q,
                &source_scope,
            )?);
        let mut result = CheckoutClaim {
            operation,
            revision,
            lease,
            proof,
            price: q.get("price_id"),
            currency: q.get("currency"),
            amount_minor: q.get("amount_minor"),
            seats: q.get::<_, i32>("package_seats") as u16,
            catalog_hash: q.get("catalog_sha256"),
            request: frozen.ok_or(TeamError::ProjectionChanged)?,
            session_id,
            lookup_only,
            financial: None,
        };
        if !source_mode {
            ensure!(
                self.financial_guard
                    .as_ref()
                    .map(
                        |guard| super::team_financial_inventory::account_source_token(
                            guard, &scope
                        )
                    )
                    .transpose()?
                    == captured_token,
                "financial_source_changed_before_commit"
            );
        }
        if initial {
            write
                .commit_lifecycle(
                    org,
                    accepted,
                    previous_revision,
                    crate::services::team_financial_transaction::CheckoutStage::FirstAttempt {
                        first_attempt_at: first_attempt
                            .context("financial_checkout_first_attempt_missing")?,
                    },
                    Some(deadline),
                )
                .await?;
        } else if resume_read {
            write
                .commit_lifecycle(
                    org,
                    accepted,
                    previous_revision,
                    crate::services::team_financial_transaction::CheckoutStage::ResumeReadback {
                        first_attempt_at: first_attempt,
                        actor: result.proof.actor,
                        session: result.session_id.clone(),
                    },
                    Some(deadline),
                )
                .await?;
        } else {
            write.commit_before(deadline).await?;
        }
        let proof_token = if source_mode {
            let guard = self.authority()?;
            if send {
                guard.record_source(crate::services::team_financial_source::Event::Dispatch {
                    scope: source_scope.clone(),
                    dispatch: crate::services::team_financial_source::Dispatch {
                        operation,
                        request_hash: original.request_hash.clone(),
                        idempotency_hash: original.idempotency_hash.clone(),
                        first_attempt_at: first_attempt
                            .context("financial_checkout_first_attempt_missing")?,
                    },
                })?;
            }
            Some(super::team_financial_inventory::checkout_claim_token(
                guard,
                &source_scope,
                operation,
            )?)
        } else {
            captured_token
        };
        result.financial = Some(dispatch::Proof::new(
            self,
            &result,
            original,
            proof_token,
            source_mode,
        )?);
        Ok(Some(result))
    }
    async fn claim_transaction<'a>(
        &self,
        tx: deadpool_postgres::Transaction<'a>,
        c: &CheckoutClaim,
    ) -> Result<CheckoutTransaction<'a>> {
        ensure!(
            !self.financial_configuration_error,
            "financial_guard_configuration_unconfirmed"
        );
        let account = crate::services::team_financial_ingress::Scope {
            account: c.proof.account.clone(),
            live: c.proof.live,
        };
        super::team_financial_ingress::lock(&tx, &account).await?;
        super::team_financial_ingress::require_authority(
            &tx,
            &account,
            self.financial_guard.as_ref(),
        )
        .await?;
        if let Some(guard) = &self.financial_guard {
            if super::team_financial_transaction::source_mode(&tx, guard, &account).await? {
                let request = c.source_request(guard)?;
                let scope = crate::services::team_financial_source::Scope {
                    organization: c.proof.org,
                    account: c.proof.account.clone(),
                    live: c.proof.live,
                };
                let state = guard.read()?.snapshot;
                let entry = state
                    .sources
                    .scopes
                    .get(&scope.key()?)
                    .context("financial_source_uninitialized")?;
                if entry
                    .outcomes
                    .values()
                    .any(|o| o.operation == c.operation && entry.unapplied_outcomes.contains(&o.id))
                {
                    let receipt = entry.checkout_observations.values().filter(|o| o.source_claim && o.operation == c.operation
                        && o.request_hash == request.request_hash && o.actor == c.proof.actor && o.revision == c.revision && o.lease == c.lease)
                        .max_by_key(|o| (o.kind == crate::services::team_stripe_checkout_receipt::ObservationKind::ResourceRead,o.observed_at)).context("financial_checkout_observation_missing")?.clone();
                    return Ok(CheckoutTransaction::Source(
                        super::team_stripe_checkout_projection::begin(tx, guard, &scope, &receipt)
                            .await?,
                    ));
                }
            }
        }
        self.read(tx, c.proof.org, &c.proof.account, c.proof.live)
            .await
    }
    async fn resume_failure(
        &self,
        tx: deadpool_postgres::Transaction<'_>,
        scope: crate::services::team_financial_source::Scope,
        failure: crate::services::team_stripe_checkout_receipt::FailureObservation,
    ) -> Result<()> {
        let guard = self.authority()?;
        let state = guard.read()?.snapshot;
        let entry = state
            .sources
            .scopes
            .get(&scope.key()?)
            .context("financial_source_uninitialized")?;
        ensure!(
            failure.attempt.source_claim
                && failure.detail.result.terminal()
                && entry.checkout_failures.get(&failure.id) == Some(&failure),
            "financial_checkout_failure_receipt_changed"
        );
        let request = entry
            .accepted
            .get(&failure.operation)
            .context("financial_checkout_request_unconfirmed")?
            .clone();
        let account = crate::services::team_financial_ingress::Scope {
            account: scope.account.clone(),
            live: scope.live,
        };
        let write = super::team_financial_transaction::NormalWrite::begin_organization(
            tx,
            guard,
            &account,
            scope.organization,
        )
        .await?;
        let row = write.sql().query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND revision=$5 AND COALESCE(recovery_actor,actor_id)=$6 AND lease_id=$7 AND (lease_until IS NULL OR lease_until<=clock_timestamp()) AND disposition IN ('pending','session_open','awaiting_verification') FOR UPDATE", &[&failure.operation,&scope.organization,&scope.account,&scope.live,&failure.attempt.revision,&failure.attempt.actor,&failure.attempt.lease]).await?;
        let Some(row) = row else {
            write.rollback().await?;
            return Ok(());
        };
        let q = write
            .sql()
            .query_one(
                "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                &[&row.get::<_, Uuid>("quote_id")],
            )
            .await?;
        ensure!(
            super::team_stripe_checkout_control::original(&row, &q, &scope)? == request,
            "financial_checkout_original_request_changed"
        );
        let reason = failure.detail.result.reason();
        let disposition =
            crate::services::team_financial_transaction::CheckoutStage::stop_disposition(reason)?;
        failure
            .attempt
            .revision
            .checked_add(1)
            .context("financial_checkout_revision_overflow")?;
        write.sql().execute("UPDATE team_stripe_checkout_intents SET revision=revision+1,disposition=$2,last_error_code=$3,last_http_status=$4,observed_at=$5,retry_at=GREATEST(retry_at,COALESCE($6,clock_timestamp())),lease_id=NULL,lease_until=NULL WHERE operation_id=$1", &[&failure.operation,&disposition,&reason,&failure.detail.http_status,&failure.observed_at,&failure.detail.retry_after]).await?;
        write
            .commit_checkout_lifecycle(
                crate::services::team_financial_transaction::Writer::CheckoutLifecycle {
                    organization: scope.organization,
                    request,
                    expected_revision: failure.attempt.revision,
                    stage: crate::services::team_financial_transaction::CheckoutStage::Stop {
                        first_attempt_at: row.get("first_attempt_at"),
                        lookup_only: row.get("lookup_only"),
                        recovery_actor: row.get("recovery_actor"),
                        reason: reason.into(),
                        provider_receipt: Some(failure.id),
                    },
                },
                None,
            )
            .await
    }
    pub async fn unresolved(&self, claim: &CheckoutClaim, reason: &str) -> Result<()> {
        ensure!(
            claim.lookup_only
                && [
                    "checkout_not_found_unconfirmed",
                    "checkout_candidates_ambiguous",
                    "checkout_lookup_limit"
                ]
                .contains(&reason),
            "invalid checkout recovery disposition"
        );
        let provider_receipt = claim.retain_lookup_result(reason)?;
        let mut db = self.pg.transaction_client().await?;
        let write = self
            .claim_transaction(db.transaction().await?, claim)
            .await?;
        let row = write.sql().query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND revision=$5 AND lease_id=$6 AND lease_until>clock_timestamp() AND disposition='pending' FOR UPDATE", &[&claim.operation,&claim.proof.org,&claim.proof.account,&claim.proof.live,&claim.revision,&claim.lease]).await?;
        let Some(row) = row else {
            write.rollback().await?;
            return Ok(());
        };
        let deadline: DateTime<Utc> = row.get("lease_until");
        if write.pending_result() {
            write.sql().execute("UPDATE team_stripe_checkout_intents SET retry_at=GREATEST(retry_at,clock_timestamp()+interval '60 seconds'),last_error_code=$2,lease_id=NULL,lease_until=NULL WHERE operation_id=$1", &[&claim.operation,&reason]).await?;
            return write.commit_before(deadline).await;
        }
        let q = write
            .sql()
            .query_one(
                "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                &[&row.get::<_, Uuid>("quote_id")],
            )
            .await?;
        let original = write.original(&row, &q)?;
        claim
            .revision
            .checked_add(1)
            .context("financial_checkout_revision_overflow")?;
        write.sql().execute("UPDATE team_stripe_checkout_intents SET disposition='recovery_required',revision=revision+1,last_error_code=$2,observed_at=clock_timestamp(),lease_id=NULL,lease_until=NULL WHERE operation_id=$1", &[&claim.operation,&reason]).await?;
        write
            .commit_lifecycle(
                claim.proof.org,
                original,
                claim.revision,
                crate::services::team_financial_transaction::CheckoutStage::Stop {
                    first_attempt_at: row.get("first_attempt_at"),
                    lookup_only: row.get("lookup_only"),
                    recovery_actor: row.get("recovery_actor"),
                    reason: reason.into(),
                    provider_receipt,
                },
                None,
            )
            .await
    }
    pub async fn receive(&self, claim: &CheckoutClaim, e: &SessionEvidence) -> Result<bool> {
        self.receive_verified(claim, e, None).await
    }
    pub async fn receive_verified(
        &self,
        claim: &CheckoutClaim,
        e: &SessionEvidence,
        binding: Option<&SubscriptionEvidence>,
    ) -> Result<bool> {
        if let Some(b) = binding {
            ensure!(
                e.status == "complete"
                    && b.operation == claim.operation
                    && b.session == e.id
                    && b.live == claim.proof.live
                    && Some(&b.snapshot.subscription_id) == e.subscription.as_ref()
                    && b.snapshot.customer_id == claim.proof.customer
                    && b.snapshot.price_id.as_deref() == Some(&claim.price)
                    && b.snapshot.currency.as_deref() == Some(&claim.currency)
                    && b.snapshot.amount_minor == Some(claim.amount_minor)
                    && b.snapshot.quantity == Some(1)
                    && b.snapshot.items_complete,
                TeamError::ProjectionChanged
            );
        }
        ensure!(
            e.operation == claim.operation
                && e.customer == claim.proof.customer
                && e.price == claim.price
                && e.currency == claim.currency
                && e.amount_minor == claim.amount_minor
                && e.live == claim.proof.live,
            TeamError::ProjectionChanged
        );
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        let scope = crate::services::team_financial_ingress::Scope {
            account: claim.proof.account.clone(),
            live: claim.proof.live,
        };
        super::team_financial_ingress::lock(&tx, &scope).await?;
        let legacy_token = self
            .financial_guard
            .as_ref()
            .map(|guard| super::team_financial_inventory::account_source_token(guard, &scope))
            .transpose()?;
        if binding.is_some() {
            ensure!(
                !self.financial_configuration_error,
                "financial_guard_configuration_unconfirmed"
            );
            if let Some(guard) = &self.financial_guard {
                super::team_financial_ingress::ready(&tx, guard, &scope).await?;
            }
        }
        if let Some(guard) = &self.financial_guard {
            if super::team_financial_transaction::source_mode(&tx, guard, &scope).await? {
                tx.rollback().await?;
                return super::team_stripe_checkout_projection::complete(self, claim, e, binding)
                    .await;
            }
        }
        self.serialize(&tx, claim.proof.org, &claim.proof.account, claim.proof.live)
            .await?;
        let allowed = match QuoteRepository::guard(
            &tx,
            claim.proof.actor,
            claim.proof.org,
            &claim.proof.account,
            claim.proof.live,
        )
        .await
        {
            Ok(p) => {
                p.operation == claim.proof.operation
                    && p.revision == claim.proof.revision
                    && p.customer == claim.proof.customer
            }
            Err(e)
                if e.downcast_ref::<AuthorizationDenied>().is_some()
                    || e.downcast_ref::<TeamError>().is_some() =>
            {
                false
            }
            Err(e) => return Err(e),
        };
        let row=tx.query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND revision=$2 AND lease_id=$3 AND lease_until>clock_timestamp() AND disposition IN ('pending','session_open','awaiting_verification') AND organization_id=$4 AND account_id=$5 AND livemode=$6 FOR UPDATE",&[&claim.operation,&claim.revision,&claim.lease,&claim.proof.org,&claim.proof.account,&claim.proof.live]).await?;
        let Some(row) = row else {
            tx.commit().await?;
            return Ok(false);
        };
        ensure!(
            row.get::<_, Option<String>>("session_id")
                .is_none_or(|id| id == e.id),
            TeamError::ProjectionChanged
        );
        let deadline: DateTime<Utc> = row.get("lease_until");
        let previous: String = row.get("disposition");
        ensure!(
            previous != "awaiting_verification" || e.status == "complete",
            TeamError::ProjectionChanged
        );
        ensure!(
            row.get::<_, Option<String>>("subscription_id")
                .is_none_or(|id| Some(id) == e.subscription),
            TeamError::ProjectionChanged
        );
        if allowed {
            if let Some(b) = binding {
                tx.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id) VALUES($1,$2,$3,$4,$5)",&[&claim.proof.org,&claim.proof.account,&claim.proof.live,&claim.proof.customer,&b.snapshot.subscription_id]).await?;
                // Binding plus scheduling is atomic. A missed pre-binding webhook remains reconciliable.
                tx.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id) VALUES($1,$2,$3) ON CONFLICT(account_id,livemode,subscription_id) DO UPDATE SET requested_revision=team_stripe_reconcile_jobs.requested_revision+1",&[&claim.proof.account,&claim.proof.live,&b.snapshot.subscription_id]).await?;
            }
        }
        let state = if !allowed {
            "owner_changed"
        } else if binding.is_some() {
            "bound"
        } else {
            match e.status.as_str() {
                "open" => "session_open",
                "complete" => "awaiting_verification",
                _ => "expired",
            }
        };
        // Store provider identity even when the initiator lost access. Never auto-release ambiguity.
        tx.execute("UPDATE team_stripe_checkout_intents SET session_id=$2,session_expires_at=$3,subscription_id=$4,observed_at=$5,disposition=$6,revision=revision+1,last_error_code=$7,last_http_status=NULL,attempts=0,retry_at=clock_timestamp()+interval '60 seconds',lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&claim.operation,&e.id,&e.expires_at,&e.subscription,&e.observed_at,&state,&if allowed{None}else{Some("owner_authorization_changed")}]).await?;
        let checked_at: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        if checked_at >= deadline {
            tx.rollback().await?;
            return Ok(false);
        }
        ensure!(
            self.financial_guard
                .as_ref()
                .map(|guard| super::team_financial_inventory::account_source_token(guard, &scope))
                .transpose()?
                == legacy_token,
            "financial_source_changed_before_commit"
        );
        tx.commit().await?;
        Ok(allowed)
    }
    pub async fn fail(&self, claim: &CheckoutClaim, e: &ProviderError) -> Result<()> {
        use super::team_stripe::Failure;
        let provider_receipt = claim.retain_provider_failure(
            crate::services::team_stripe_checkout_receipt::FailurePhase::WorkerCallback,
            e,
        )?;
        let permanent = matches!(
            e.kind,
            Failure::InvalidContract | Failure::ScopeMismatch | Failure::NotFound
        );
        let mut db = self.pg.transaction_client().await?;
        let write = self
            .claim_transaction(db.transaction().await?, claim)
            .await?;
        let row = write.sql().query_opt("SELECT * FROM team_stripe_checkout_intents WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND revision=$5 AND lease_id=$6 AND lease_until>clock_timestamp() AND disposition IN ('pending','session_open','awaiting_verification') FOR UPDATE", &[&claim.operation,&claim.proof.org,&claim.proof.account,&claim.proof.live,&claim.revision,&claim.lease]).await?;
        let Some(row) = row else {
            write.rollback().await?;
            return Ok(());
        };
        let deadline: DateTime<Utc> = row.get("lease_until");
        let stop = permanent && !write.pending_result();
        write.sql().execute("UPDATE team_stripe_checkout_intents SET retry_at=GREATEST(retry_at,clock_timestamp()+make_interval(secs=>LEAST(3600,15*power(2,LEAST(attempts,8)))::double precision),COALESCE($2,clock_timestamp())),last_error_code=$3,last_http_status=$4,lease_id=NULL,lease_until=NULL WHERE operation_id=$1", &[&claim.operation,&e.retry_after,&e.kind.code(),&e.status]).await?;
        if stop {
            let q = write
                .sql()
                .query_one(
                    "SELECT * FROM team_stripe_quotes WHERE id=$1 FOR SHARE",
                    &[&row.get::<_, Uuid>("quote_id")],
                )
                .await?;
            let original = write.original(&row, &q)?;
            claim
                .revision
                .checked_add(1)
                .context("financial_checkout_revision_overflow")?;
            write.sql().execute("UPDATE team_stripe_checkout_intents SET disposition='recovery_required',revision=revision+1 WHERE operation_id=$1", &[&claim.operation]).await?;
            write
                .commit_lifecycle(
                    claim.proof.org,
                    original,
                    claim.revision,
                    crate::services::team_financial_transaction::CheckoutStage::Stop {
                        first_attempt_at: row.get("first_attempt_at"),
                        lookup_only: row.get("lookup_only"),
                        recovery_actor: row.get("recovery_actor"),
                        reason: e.kind.code().into(),
                        provider_receipt,
                    },
                    None,
                )
                .await
        } else {
            write.commit_before(deadline).await
        }
    }
    fn view(r: &tokio_postgres::Row) -> CheckoutStatus {
        CheckoutStatus {
            operation_id: r.get("operation_id"),
            quote_id: r.get("quote_id"),
            revision: r.get("revision"),
            disposition: r.get("disposition"),
            retry_at: r.get("retry_at"),
            observed_at: r.get("observed_at"),
            last_error_code: r.get("last_error_code"),
            checkout_available: false,
            payment_verified: false,
            invoice_assessment: None,
            test_checkout_destination_available: false,
            lookup_only: r.get("lookup_only"),
        }
    }
}

/// Exact-next readback after a lost SQL commit/Confirm response. No provider
/// call or current customer/Owner grant is reconstructed from this history.
pub(super) async fn committed_request(
    tx: &tokio_postgres::Transaction<'_>,
    account: &crate::services::team_financial_ingress::Scope,
    writer: &crate::services::team_financial_transaction::Writer,
) -> Result<()> {
    use crate::services::team_financial_transaction::Writer;
    let Writer::CheckoutRequest {
        organization,
        quote,
        customer,
        request,
    } = writer
    else {
        anyhow::bail!("financial_transaction_writer_mismatch");
    };
    let row = tx.query_opt("SELECT c.*,q.customer_id AS quoted_customer,q.price_id,q.currency,q.amount_minor FROM team_stripe_checkout_intents c JOIN team_stripe_quotes q ON q.id=c.quote_id AND q.organization_id=c.organization_id AND q.account_id=c.account_id AND q.livemode=c.livemode WHERE c.operation_id=$1 AND c.organization_id=$2 AND c.account_id=$3 AND c.livemode=$4", &[&request.operation, organization, &account.account, &account.live]).await?.context("financial_checkout_request_missing")?;
    ensure!(
        row.get::<_, Uuid>("quote_id") == *quote
            && row.get::<_, Uuid>("actor_id") == request.actor
            && row.get::<_, i64>("revision") == 1
            && row.get::<_, String>("disposition") == "pending"
            && row
                .get::<_, Option<DateTime<Utc>>>("first_attempt_at")
                .is_none()
            && row.get::<_, Option<String>>("session_id").is_none()
            && row.get::<_, Option<String>>("subscription_id").is_none()
            && row.get::<_, Option<Uuid>>("lease_id").is_none()
            && row.get::<_, Option<DateTime<Utc>>>("lease_until").is_none()
            && !row.get::<_, bool>("lookup_only")
            && row.get::<_, Option<Uuid>>("recovery_actor").is_none()
            && row.get::<_, String>("quoted_customer") == *customer,
        "financial_checkout_request_next_unconfirmed"
    );
    let price: String = row.get("price_id");
    let currency: String = row.get("currency");
    let expected = ExpectedSession {
        operation: request.operation,
        customer,
        price: &price,
        currency: &currency,
        amount_minor: row.get("amount_minor"),
        live: account.live,
    };
    let value: serde_json::Value = row
        .get::<_, Option<serde_json::Value>>("request_metadata")
        .context("financial_checkout_request_missing")?;
    let hash: String = row
        .get::<_, Option<String>>("request_sha256")
        .context("financial_checkout_request_missing")?;
    let frozen = FrozenRequest::restore(&value, &hash, &expected)?;
    ensure!(
        frozen.accepted(
            &crate::services::team_financial_source::Scope {
                organization: *organization,
                account: account.account.clone(),
                live: account.live
            },
            request.actor,
            *quote,
            &expected,
            row.get("confirmed_at")
        )? == *request,
        "financial_checkout_request_changed"
    );
    Ok(())
}

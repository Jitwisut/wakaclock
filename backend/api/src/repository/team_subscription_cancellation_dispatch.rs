//! Opaque operational claims and fresh SQL/source/Owner provider-boundary proofs.
//! No SQL transaction is held during HTTP. A prepared exchange proves neither
//! that HTTP ran nor that the provider accepted a cancellation.
use super::*;
use crate::services::{
    team_financial_guard::fingerprint,
    team_financial_source as source,
    team_insights::TeamError,
    team_subscription_cancellation::{
        lifecycle::{CancellationStage, Exchange, ExchangeKind},
        Disposition, ObservationKind, Subscription,
    },
};

/// A reservation, not a standalone HTTP grant. All fields are server-captured.
/// Deliberately not Clone, Serialize, Deserialize or Debug.
pub struct CancellationClaim {
    repository: CancellationRepository,
    request: FrozenCancellation,
    actor: Uuid,
    revision: i64,
    lease: Uuid,
    account_lease: Uuid,
    first_attempt_at: Option<DateTime<Utc>>,
    recovery_actor: Option<Uuid>,
    read_only: bool,
    expires_at: DateTime<Utc>,
    last_observation: Option<Uuid>,
}
/// Captured cleanup identity, never deserialized from a request or a current
/// permission. Old callbacks can touch only their own exact account/op leases.
pub(crate) struct CancellationTicket {
    request: FrozenCancellation,
    actor: Uuid,
    revision: i64,
    lease: Uuid,
    account_lease: Uuid,
    recovery_actor: Option<Uuid>,
    read_only: bool,
}
#[derive(PartialEq, Eq)]
struct Pin {
    source_token: String,
    enrollment_token: String,
    authorization_hash: String,
    last_observation: Option<Uuid>,
}
struct Capture {
    pin: Pin,
    at: DateTime<Utc>,
    until: DateTime<Utc>,
}
/// Constructed only after the exact typed BeginExchange group is confirmed and
/// a fresh locked capture proves its SQL exchange/audit/current authority.
pub struct CancellationExchangeProof {
    claim: CancellationClaim,
    exchange: Exchange,
    pin: Pin,
    expires_at: DateTime<Utc>,
    guard: FinancialGuard,
}
impl CancellationRepository {
    /// Bounded candidate lookup. The unlocked locator grants nothing; locks,
    /// current Owner, row/revision and source are checked again before reservation.
    pub async fn claim_next(
        &self,
        account: &Account,
        account_lease: Uuid,
    ) -> Result<Option<CancellationClaim>> {
        crate::services::team_subscription_cancellation::require_enabled()?;
        account.key()?;
        ensure!(
            !account_lease.is_nil(),
            "cancellation_account_lease_required"
        );
        self.reconcile_history(account).await?;
        let guard = self.guard()?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::super::team_financial_ingress::lock(&tx, account).await?;
        let candidate=tx.query_opt("SELECT c.operation_id,c.organization_id,c.revision,COALESCE(c.recovery_actor,c.actor_id) AS current_actor FROM team_subscription_cancellations c JOIN organization_members m ON m.organization_id=c.organization_id AND m.user_id=COALESCE(c.recovery_actor,c.actor_id) AND m.role='owner' AND m.deactivated_at IS NULL JOIN users u ON u.id=m.user_id AND u.is_active AND u.deleted_at IS NULL JOIN organizations o ON o.id=c.organization_id AND o.deleted_at IS NULL JOIN team_rollouts r ON r.organization_id=c.organization_id AND r.enabled WHERE c.account_id=$1 AND c.livemode=$2 AND c.disposition IN ('pending','provider_scheduled') AND c.retry_at<=clock_timestamp() AND (c.lease_until IS NULL OR c.lease_until<=clock_timestamp()) ORDER BY c.retry_at,c.accepted_at,c.operation_id LIMIT 1",&[&account.account,&account.live]).await?;
        let Some(candidate) = candidate else {
            tx.rollback().await?;
            return Ok(None);
        };
        let org: Uuid = candidate.get("organization_id");
        let operation: Uuid = candidate.get("operation_id");
        let actor: Uuid = candidate.get("current_actor");
        let revision: i64 = candidate.get("revision");
        super::super::team_financial_locks::organization(&tx, &account.account, account.live, org)
            .await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        rollout(&tx, org).await?;
        super::super::team_financial_ingress::require_authority(&tx, account, Some(guard)).await?;
        ensure!(
            super::super::team_financial_transaction::source_mode(&tx, guard, account).await?,
            "cancellation_source_evidence_required"
        );
        let write = super::super::team_financial_transaction::NormalWrite::begin_organization(
            tx, guard, account, org,
        )
        .await?;
        let row=write.sql().query_opt("SELECT * FROM team_subscription_cancellations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND revision=$5 AND disposition IN ('pending','provider_scheduled') AND retry_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) FOR UPDATE",&[&operation,&org,&account.account,&account.live,&revision]).await?.context("cancellation_claim_predecessor_changed")?;
        let request = decode(&row)?;
        verify_initial_history(
            write.sql(),
            &request,
            &row.get::<_, serde_json::Value>("read_evidence"),
        )
        .await?;
        ensure!(
            row.get::<_, Option<Uuid>>("recovery_actor")
                .unwrap_or(request.actor())
                == actor,
            "cancellation_claim_actor_changed"
        );
        control::authorization(write.sql(), &request, revision, actor).await?;
        let now: DateTime<Utc> = write
            .sql()
            .query_one("SELECT clock_timestamp()", &[])
            .await?
            .get(0);
        ensure!(
            guard
                .checkout_retry_after(&account.account, account.live)?
                .is_none_or(|until| until <= now),
            "cancellation_account_backing_off"
        );
        let account_until:DateTime<Utc>=write.sql().query_opt("SELECT lease_until FROM team_stripe_runtime_status WHERE account_id=$1 AND livemode=$2 AND lease_id=$3 AND lease_until>clock_timestamp() AND retry_at<=clock_timestamp() FOR SHARE",&[&account.account,&account.live,&account_lease]).await?.context("cancellation_account_lease_unconfirmed")?.get(0);
        let until = account_until.min(
            now.checked_add_signed(Duration::seconds(60))
                .context("cancellation_claim_time_invalid")?,
        );
        ensure!(now < until, "cancellation_claim_expired");
        let lease = Uuid::now_v7();
        write.sql().execute("UPDATE team_subscription_cancellations SET lease_id=$2,lease_until=$3,attempts=LEAST(attempts::bigint+1,2147483647)::integer WHERE operation_id=$1",&[&operation,&lease,&until]).await?;
        self.guard()?;
        crate::services::team_subscription_cancellation::require_enabled()?;
        ensure!(
            write.commit_read_before(until).await?,
            "cancellation_claim_expired"
        );
        Ok(Some(CancellationClaim {
            repository: self.clone(),
            request,
            actor,
            revision,
            lease,
            account_lease,
            first_attempt_at: row.get("first_attempt_at"),
            recovery_actor: row.get("recovery_actor"),
            read_only: row.get("read_only"),
            expires_at: until,
            last_observation: row.get("last_observation_id"),
        }))
    }
}
async fn rollout(tx: &tokio_postgres::Transaction<'_>, org: Uuid) -> Result<()> {
    ensure!(
        tx.query_opt(
            "SELECT 1 FROM team_rollouts WHERE organization_id=$1 AND enabled FOR SHARE",
            &[&org]
        )
        .await?
        .is_some(),
        TeamError::Disabled
    );
    Ok(())
}
impl CancellationClaim {
    pub(crate) fn ticket(&self) -> CancellationTicket {
        CancellationTicket {
            request: self.request.clone(),
            actor: self.actor,
            revision: self.revision,
            lease: self.lease,
            account_lease: self.account_lease,
            recovery_actor: self.recovery_actor,
            read_only: self.read_only,
        }
    }
    /// Scheduling hint only. The provider boundary repeats the complete SQL/
    /// source precondition and can reject it; this value grants no HTTP authority.
    pub(crate) fn preferred_kind(&self) -> Result<ExchangeKind> {
        if self.read_only
            || self.recovery_actor.is_some()
            || self.revision != 1
            || self.actor != self.request.actor()
        {
            return Ok(ExchangeKind::ResourceRead);
        }
        let now = Utc::now();
        if now >= self.request.period_end()
            || self.first_attempt_at.is_some_and(|first| {
                first
                    .checked_add_signed(Duration::hours(23))
                    .is_none_or(|end| now >= end)
            })
        {
            return Ok(ExchangeKind::ResourceRead);
        }
        let state = self.repository.guard()?.read()?;
        let hint = self
            .last_observation
            .and_then(|id| {
                state
                    .snapshot
                    .sources
                    .scopes
                    .get(&self.request.scope().key().ok()?)
                    .and_then(|entry| entry.cancellation_observations.get(&id))
            })
            .is_some_and(|observation| {
                observation.request == self.request
                    && observation.kind == ObservationKind::ResourceRead
                    && observation.attempt.actor == self.actor
                    && observation.attempt.revision == self.revision
                    && observation.observed_at <= now
                    && observation
                        .observed_at
                        .checked_add_signed(Duration::seconds(60))
                        .is_some_and(|until| now < until)
                    && self
                        .request
                        .disposition(&observation.subscription, observation.observed_at)
                        .is_ok_and(|state| state == Disposition::NotObservedScheduled)
            });
        Ok(if hint {
            ExchangeKind::Mutation
        } else {
            ExchangeKind::ResourceRead
        })
    }
    pub(crate) fn account(&self) -> &str {
        &self.request.scope().account
    }
    pub(crate) fn live(&self) -> bool {
        self.request.scope().live
    }
    pub(crate) fn operation(&self) -> Uuid {
        self.request.operation()
    }
    pub(crate) fn retain_account_failure(
        &self,
        probe: Uuid,
        error: &crate::infrastructure::stripe::ProviderError,
    ) -> Result<()> {
        self.repository
            .deployment
            .guard()
            .retain_cancellation_failure(
            &self.request,
            crate::services::team_subscription_cancellation::Attempt {
                actor: self.actor,
                revision: self.revision,
                lease: self.lease,
                exchange: probe,
                source_claim: true,
            },
            failure_detail(
                crate::services::team_stripe_checkout_receipt::FailurePhase::CancellationAccount,
                error,
            ),
        )?;
        Ok(())
    }
    /// Before ancillary account verification. It is not a mutation grant and
    /// creates no first-attempt/observation or exchange record.
    pub(crate) async fn preflight_unprepared(
        &self,
        kind: &ExchangeKind,
        guard: Option<&FinancialGuard>,
    ) -> Result<()> {
        self.authority(guard)?;
        self.capture(kind, None, None).await?;
        Ok(())
    }
    fn authority(&self, guard: Option<&FinancialGuard>) -> Result<()> {
        ensure!(
            guard.is_some_and(|g| g.same_authority(self.repository.deployment.guard())),
            "cancellation_provider_authority_changed"
        );
        self.repository.guard()?;
        Ok(())
    }
    pub(crate) async fn prepare_exchange(
        self,
        kind: ExchangeKind,
    ) -> Result<CancellationExchangeProof> {
        let before = self.capture(&kind, None, None).await?;
        let first = if kind == ExchangeKind::Mutation {
            Some(self.first_attempt_at.unwrap_or(before.at))
        } else {
            self.first_attempt_at
        };
        let exchange = Exchange {
            id: Uuid::now_v7(),
            actor: self.actor,
            revision: self.revision,
            lease: self.lease,
            account_lease: self.account_lease,
            kind: kind.clone(),
            prepared_at: before.at,
            first_attempt_at: first,
            previous_observation: before.pin.last_observation,
            authorization_hash: before.pin.authorization_hash,
        };
        self.repository
            .apply_lifecycle(
                self.request.scope().organization,
                self.operation(),
                self.revision,
                CancellationStage::BeginExchange {
                    exchange: exchange.clone(),
                },
            )
            .await?;
        if kind == ExchangeKind::Mutation {
            let accepted = self.request.accepted_request()?;
            self.repository
                .guard()?
                .record_source(source::Event::Dispatch {
                    scope: self.request.scope().clone(),
                    dispatch: source::Dispatch {
                        operation: self.operation(),
                        request_hash: accepted.request_hash,
                        idempotency_hash: accepted.idempotency_hash,
                        first_attempt_at: exchange
                            .first_attempt_at
                            .context("cancellation_first_attempt_unconfirmed")?,
                    },
                })?;
        }
        // Only a confirmed exact exchange can mint a new proof. No token from
        // before BeginExchange is reused; no pending outcome is hidden here.
        let after = self.capture(&kind, Some(&exchange), None).await?;
        ensure!(
            before.pin.last_observation == after.pin.last_observation,
            "cancellation_precondition_observation_changed"
        );
        let guard = self.repository.guard()?.clone();
        Ok(CancellationExchangeProof {
            claim: self,
            exchange,
            pin: after.pin,
            expires_at: after.until,
            guard,
        })
    }
    async fn capture(
        &self,
        kind: &ExchangeKind,
        exchange: Option<&Exchange>,
        deadline: Option<DateTime<Utc>>,
    ) -> Result<Capture> {
        crate::services::team_subscription_cancellation::require_enabled()?;
        let guard = self.repository.guard()?;
        let scope = self.request.scope();
        let account = Account {
            account: scope.account.clone(),
            live: scope.live,
        };
        let mut db = self.repository.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        super::super::team_financial_locks::organization(
            &tx,
            &account.account,
            account.live,
            scope.organization,
        )
        .await?;
        AuthorizationService::require_locked_billing_owner(&tx, self.actor, scope.organization)
            .await?;
        rollout(&tx, scope.organization).await?;
        super::super::team_financial_ingress::require_authority(&tx, &account, Some(guard)).await?;
        ensure!(
            super::super::team_financial_transaction::source_mode(&tx, guard, &account).await?,
            "cancellation_source_evidence_required"
        );
        let write = super::super::team_financial_transaction::NormalWrite::begin_organization(
            tx,
            guard,
            &account,
            scope.organization,
        )
        .await?;
        let row=write.sql().query_opt("SELECT * FROM team_subscription_cancellations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND revision=$5 AND lease_id=$6 AND disposition IN ('pending','provider_scheduled') FOR SHARE",&[&self.operation(),&scope.organization,&scope.account,&scope.live,&self.revision,&self.lease]).await?.context("cancellation_claim_changed")?;
        ensure!(
            decode(&row)? == self.request
                && row.get::<_, Option<Uuid>>("recovery_actor") == self.recovery_actor
                && row.get::<_, bool>("read_only") == self.read_only
                && row
                    .get::<_, Option<Uuid>>("recovery_actor")
                    .unwrap_or(self.request.actor())
                    == self.actor
                && row.get::<_, Option<DateTime<Utc>>>("first_attempt_at")
                    == exchange.map_or(self.first_attempt_at, |e| e.first_attempt_at),
            "cancellation_claim_identity_changed"
        );
        verify_initial_history(
            write.sql(),
            &self.request,
            &row.get::<_, serde_json::Value>("read_evidence"),
        )
        .await?;
        let authorization_hash =
            control::authorization(write.sql(), &self.request, self.revision, self.actor).await?;
        let now: DateTime<Utc> = write
            .sql()
            .query_one("SELECT clock_timestamp()", &[])
            .await?
            .get(0);
        ensure!(
            row.get::<_, DateTime<Utc>>("retry_at") <= now,
            "cancellation_operation_backing_off"
        );
        ensure!(
            guard
                .checkout_retry_after(&scope.account, scope.live)?
                .is_none_or(|until| until <= now),
            "cancellation_account_backing_off"
        );
        let account_until:DateTime<Utc>=write.sql().query_opt("SELECT lease_until FROM team_stripe_runtime_status WHERE account_id=$1 AND livemode=$2 AND lease_id=$3 AND lease_until>clock_timestamp() AND retry_at<=clock_timestamp() FOR SHARE",&[&scope.account,&scope.live,&self.account_lease]).await?.context("cancellation_account_lease_unconfirmed")?.get(0);
        let mut until = self
            .expires_at
            .min(
                row.get::<_, Option<DateTime<Utc>>>("lease_until")
                    .context("cancellation_operation_lease_unconfirmed")?,
            )
            .min(account_until);
        if let Some(deadline) = deadline {
            until = until.min(deadline);
        }
        if let Some(exchange) = exchange {
            ensure!(
                exchange.actor == self.actor
                    && exchange.previous_observation
                        == row.get::<_, Option<Uuid>>("last_observation_id")
                    && exchange.revision == self.revision
                    && exchange.lease == self.lease
                    && exchange.account_lease == self.account_lease
                    && exchange.kind == *kind
                    && exchange.authorization_hash == authorization_hash,
                "cancellation_prepared_exchange_changed"
            );
            control::exchange_next(write.sql(), &self.request, exchange).await?;
            ensure!(guard.read()?.snapshot.transactions.groups.values().any(|group|group.committed
                && matches!(group.proposal.writer.as_ref(),Some(Writer::CancellationLifecycle {request,expected_revision,stage:CancellationStage::BeginExchange {exchange:original}})
                    if request==&self.request && *expected_revision==self.revision && original==exchange)),"cancellation_exchange_confirmation_unconfirmed");
            if *kind == ExchangeKind::Mutation {
                let accepted = self.request.accepted_request()?;
                ensure!(
                    guard
                        .read()?
                        .snapshot
                        .sources
                        .scopes
                        .get(&scope.key()?)
                        .and_then(|entry| entry.dispatches.get(&self.operation()))
                        .is_some_and(|dispatch| dispatch.request_hash == accepted.request_hash
                            && dispatch.idempotency_hash == accepted.idempotency_hash
                            && Some(dispatch.first_attempt_at) == exchange.first_attempt_at),
                    "cancellation_possible_send_unconfirmed"
                );
            }
            until = until.min(
                exchange
                    .prepared_at
                    .checked_add_signed(Duration::seconds(60))
                    .context("cancellation_exchange_time_invalid")?,
            );
        }
        let last: Option<Uuid> = row.get("last_observation_id");
        if *kind == ExchangeKind::Mutation {
            ensure!(
                self.revision == 1
                    && self.actor == self.request.actor()
                    && !self.read_only
                    && self.recovery_actor.is_none(),
                "cancellation_mutation_not_authorized"
            );
            let first = exchange
                .and_then(|e| e.first_attempt_at)
                .or(self.first_attempt_at)
                .unwrap_or(now);
            until = until.min(self.request.period_end()).min(
                first
                    .checked_add_signed(Duration::hours(23))
                    .context("cancellation_window_invalid")?,
            );
            until = until.min(
                mutation_precondition(
                    write.sql(),
                    guard,
                    &self.request,
                    self.actor,
                    self.revision,
                    last,
                    row.get("observed_at"),
                    now,
                )
                .await?,
            );
        }
        let pin = Pin {
            source_token: super::super::team_financial_inventory::account_source_token(
                guard, &account,
            )?,
            enrollment_token: guard.read()?.organization_token(scope.organization)?,
            authorization_hash,
            last_observation: last,
        };
        ensure!(now < until, "cancellation_provider_proof_expired");
        crate::services::team_subscription_cancellation::require_enabled()?;
        self.repository.guard()?;
        ensure!(
            write.commit_read_before(until).await?,
            "cancellation_provider_proof_expired"
        );
        ensure!(
            super::super::team_financial_inventory::account_source_token(guard, &account)?
                == pin.source_token
                && guard.read()?.organization_token(scope.organization)? == pin.enrollment_token,
            TeamError::ProjectionChanged
        );
        Ok(Capture {
            pin,
            at: now,
            until,
        })
    }
}
impl CancellationRepository {
    /// Safe even after Owner revocation/feature pause: releases only transport
    /// metadata under the original opaque ticket. It never resets first-attempt,
    /// changes disposition/read-only, or resolves a retained positive outcome.
    pub(crate) async fn finish_attempt(
        &self,
        ticket: &CancellationTicket,
        error: Option<&crate::infrastructure::stripe::ProviderError>,
    ) -> Result<bool> {
        let scope = ticket.request.scope();
        let account = Account {
            account: scope.account.clone(),
            live: scope.live,
        };
        self.reconcile_history(&account).await?;
        let guard = self.guard()?;
        let state = guard.read()?;
        let pending = state
            .snapshot
            .sources
            .scopes
            .get(&scope.key()?)
            .and_then(|entry| {
                entry
                    .cancellation_observations
                    .values()
                    .find(|observation| {
                        observation.request == ticket.request
                            && entry.unapplied_outcomes.contains(&observation.outcome)
                    })
            })
            .cloned();
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        let write = if let Some(observation) = pending {
            super::super::team_financial_transaction::NormalWrite::begin_cancellation_resolution(
                tx,
                guard,
                &account,
                &ticket.request,
                &observation,
            )
            .await?
        } else {
            super::super::team_financial_transaction::NormalWrite::begin_organization(
                tx,
                guard,
                &account,
                scope.organization,
            )
            .await?
        };
        let row=write.sql().query_opt("SELECT * FROM team_subscription_cancellations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 AND revision=$5 AND lease_id=$6 FOR UPDATE",&[&ticket.request.operation(),&scope.organization,&scope.account,&scope.live,&ticket.revision,&ticket.lease]).await?;
        let Some(row) = row else {
            write.rollback().await?;
            return Ok(false);
        };
        ensure!(
            decode(&row)? == ticket.request
                && row.get::<_, Option<Uuid>>("recovery_actor") == ticket.recovery_actor
                && row.get::<_, bool>("read_only") == ticket.read_only
                && row
                    .get::<_, Option<Uuid>>("recovery_actor")
                    .unwrap_or(ticket.request.actor())
                    == ticket.actor,
            "cancellation_release_ticket_changed"
        );
        ensure!(write.sql().query_opt("SELECT 1 FROM team_stripe_runtime_status WHERE account_id=$1 AND livemode=$2 AND lease_id=$3 AND lease_until>clock_timestamp() FOR SHARE",&[&scope.account,&scope.live,&ticket.account_lease]).await?.is_some(),"cancellation_release_account_lease_changed");
        let code = error.map_or("authority_changed", |error| error.kind.code());
        let status = error.and_then(|error| error.status);
        let retry = error.and_then(|error| error.retry_after);
        write.sql().execute("UPDATE team_subscription_cancellations SET retry_at=GREATEST(retry_at,clock_timestamp()+make_interval(secs=>LEAST(3600.0,15.0*power(2.0,LEAST(attempts,8)))),COALESCE($2,clock_timestamp())),last_error_code=$3,last_http_status=$4,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&ticket.request.operation(),&retry,&code,&status]).await?;
        self.guard()?;
        write.commit_cancellation_operational().await?;
        Ok(true)
    }
}
async fn mutation_precondition(
    tx: &tokio_postgres::Transaction<'_>,
    guard: &FinancialGuard,
    request: &FrozenCancellation,
    actor: Uuid,
    revision: i64,
    last: Option<Uuid>,
    observed_at: Option<DateTime<Utc>>,
    now: DateTime<Utc>,
) -> Result<DateTime<Utc>> {
    let id = last.context("cancellation_current_projected_read_required")?;
    let state = guard.read()?;
    let entry = state
        .snapshot
        .sources
        .scopes
        .get(&request.scope().key()?)
        .context("cancellation_source_unconfirmed")?;
    let observation = entry
        .cancellation_observations
        .get(&id)
        .context("cancellation_current_projected_read_required")?;
    ensure!(
        observation.request == *request
            && observation.kind == ObservationKind::ResourceRead
            && observation.attempt.source_claim
            && observation.attempt.actor == actor
            && observation.attempt.revision == revision
            && observation.observed_at <= now
            && observed_at.map(|v| v.timestamp_micros())
                == Some(observation.observed_at.timestamp_micros())
            && !entry.unapplied_outcomes.contains(&observation.outcome)
            && entry.outcomes.contains_key(&observation.outcome)
            && request.disposition(&observation.subscription, observation.observed_at)?
                == Disposition::NotObservedScheduled,
        "cancellation_current_projected_read_required"
    );
    request.before_mutation(&observation.subscription, now)?;
    let exchange = control::load_exchange(tx, request, observation.attempt.exchange).await?;
    ensure!(exchange.kind==ExchangeKind::ResourceRead && exchange.actor==actor && exchange.revision==revision && exchange.lease==observation.attempt.lease
        && exchange.prepared_at<=observation.observed_at
        && state.snapshot.transactions.groups.values().any(|group|group.committed && matches!(group.proposal.writer.as_ref(),Some(Writer::CancellationLifecycle {request:original,stage:CancellationStage::BeginExchange {exchange:prepared},..}) if original==request && prepared==&exchange)),"cancellation_projected_read_exchange_unconfirmed");
    // Keep the accepted binding/source revisions and business terms. A fresh
    // resource read cannot silently approve a different purchase or subscription.
    let scope = request.scope();
    let row=tx.query_opt("SELECT b.account_id,b.livemode,b.customer_id,b.subscription_id,b.revision,b.enabled,s.binding_revision,s.source_revision,s.subscription_item_id,s.price_id,s.currency,s.amount_minor,s.quantity,s.period_start,s.period_end,s.items_complete,s.cancel_at_period_end,j.requested_revision,j.applied_revision FROM team_stripe_bindings b JOIN team_stripe_snapshots s ON s.organization_id=b.organization_id JOIN team_stripe_reconcile_jobs j ON j.account_id=b.account_id AND j.livemode=b.livemode AND j.subscription_id=b.subscription_id WHERE b.organization_id=$1 FOR SHARE OF b,s,j",&[&scope.organization]).await?.context("cancellation_canonical_predecessor_missing")?;
    ensure!(
        row.get::<_, String>(0) == scope.account
            && row.get::<_, bool>(1) == scope.live
            && row.get::<_, String>(2) == request.customer()
            && row.get::<_, String>(3) == request.subscription()
            && row.get::<_, i64>(4) == request.binding_revision()
            && row.get::<_, bool>(5)
            && row.get::<_, i64>(6) == request.binding_revision()
            && row.get::<_, i64>(7) >= request.source_revision()
            && row.get::<_, Option<String>>(8).as_deref() == Some(request.item())
            && row.get::<_, Option<String>>(9).as_deref() == Some(request.price())
            && row.get::<_, Option<String>>(10).as_deref() == Some(request.currency())
            && row.get::<_, Option<i64>>(11) == Some(request.amount_minor())
            && row.get::<_, Option<i64>>(12) == Some(1)
            && row.get::<_, Option<DateTime<Utc>>>(13) == Some(request.period_start())
            && row.get::<_, Option<DateTime<Utc>>>(14) == Some(request.period_end())
            && row.get::<_, bool>(15)
            && !row.get::<_, bool>(16)
            && row.get::<_, i64>(17) == row.get::<_, i64>(7)
            && row.get::<_, i64>(18) == row.get::<_, i64>(7),
        "cancellation_canonical_predecessor_changed"
    );
    observation
        .observed_at
        .checked_add_signed(Duration::seconds(60))
        .context("cancellation_read_time_invalid")
}
impl CancellationExchangeProof {
    pub(crate) fn account(&self) -> &str {
        self.claim.account()
    }
    pub(crate) fn live(&self) -> bool {
        self.claim.live()
    }
    pub(crate) fn operation(&self) -> Uuid {
        self.claim.operation()
    }
    pub(crate) fn subscription(&self) -> &str {
        self.claim.request.subscription()
    }
    pub(crate) fn request(&self) -> &FrozenCancellation {
        &self.claim.request
    }
    pub(crate) fn exchange_id(&self) -> Uuid {
        self.exchange.id
    }
    pub(crate) async fn preflight(&self, guard: Option<&FinancialGuard>) -> Result<()> {
        self.claim.authority(guard)?;
        let current = self
            .claim
            .capture(
                &self.exchange.kind,
                Some(&self.exchange),
                Some(self.expires_at),
            )
            .await?;
        ensure!(current.pin == self.pin, TeamError::ProjectionChanged);
        Ok(())
    }
    /// Evidence retention deliberately uses captured authority even if current
    /// Owner/config/source changed during HTTP; it grants no current SQL rights.
    pub(crate) fn retain(
        &self,
        subscription: &Subscription,
        observed_at: DateTime<Utc>,
    ) -> Result<Uuid> {
        self.guard.retain_cancellation_observation(
            &self.claim.request,
            crate::services::team_subscription_cancellation::Attempt {
                actor: self.claim.actor,
                revision: self.claim.revision,
                lease: self.claim.lease,
                exchange: self.exchange.id,
                source_claim: true,
            },
            if self.exchange.kind == ExchangeKind::Mutation {
                ObservationKind::MutationResponse
            } else {
                ObservationKind::ResourceRead
            },
            subscription,
            observed_at,
        )
    }
    pub(crate) fn identity_hash(&self) -> Result<String> {
        fingerprint(&(
            self.operation(),
            self.exchange.metadata_hash(&self.claim.request)?,
        ))
    }
    pub(crate) fn retain_failure(
        &self,
        error: &crate::infrastructure::stripe::ProviderError,
    ) -> Result<()> {
        use crate::services::team_stripe_checkout_receipt::FailurePhase;
        self.guard.retain_cancellation_failure(
            &self.claim.request,
            crate::services::team_subscription_cancellation::Attempt {
                actor: self.claim.actor,
                revision: self.claim.revision,
                lease: self.claim.lease,
                exchange: self.exchange.id,
                source_claim: true,
            },
            failure_detail(
                if self.exchange.kind == ExchangeKind::Mutation {
                    FailurePhase::CancellationMutation
                } else {
                    FailurePhase::CancellationRead
                },
                error,
            ),
        )?;
        Ok(())
    }
}
fn failure_detail(
    phase: crate::services::team_stripe_checkout_receipt::FailurePhase,
    error: &crate::infrastructure::stripe::ProviderError,
) -> crate::services::team_stripe_checkout_receipt::FailureDetail {
    use super::super::team_stripe::Failure;
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
    FailureDetail {
        phase,
        result: FailureResult::Provider { code },
        http_status: error.status,
        retry_after: error.retry_after,
    }
}

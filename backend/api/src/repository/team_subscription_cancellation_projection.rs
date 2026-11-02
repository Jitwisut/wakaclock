//! Exact retained result -> SQL/source, with causal predecessor CAS. No provider
//! result here grants paid analytics, a seat, consent or a fresh HTTP capability.
use super::*;
use crate::services::{
    authorization::AuthorizationDenied,
    team_financial_guard::fingerprint,
    team_subscription_cancellation::{
        projection::{self as policy, Basis, CancellationProjection, ProjectionMode},
        Observation,
    },
};
use tokio_postgres::{Row, Transaction};

fn basis(row: &Row, request: &FrozenCancellation) -> Result<Basis> {
    let value = Basis {
        revision: row.get("revision"),
        actor: row
            .get::<_, Option<Uuid>>("recovery_actor")
            .unwrap_or(request.actor()),
        first_attempt_at: row.get("first_attempt_at"),
        recovery_actor: row.get("recovery_actor"),
        read_only: row.get("read_only"),
        disposition: row.get("disposition"),
        last_observation: row.get("last_observation_id"),
        observed_at: row.get("observed_at"),
        lease: row.get("lease_id"),
        lease_until: row.get("lease_until"),
    };
    value.validate(request)?;
    Ok(value)
}
fn same_basis(actual: &Basis, expected: &Basis) -> bool {
    let mut expected = expected.clone();
    // SQL timestamps have microsecond precision; retained provider metadata is
    // kept exactly, with no inferred historical timestamp or clamped clock.
    expected.observed_at = expected
        .observed_at
        .and_then(|at| DateTime::from_timestamp_micros(at.timestamp_micros()));
    actual == &expected
}
pub(crate) async fn committed_projection(
    tx: &Transaction<'_>,
    account: &Account,
    writer: &Writer,
) -> Result<()> {
    let Writer::CancellationResult { projection } = writer else {
        anyhow::bail!("financial_transaction_writer_mismatch")
    };
    projection.validate()?;
    let request = &projection.request;
    ensure!(
        request.scope().account == account.account && request.scope().live == account.live,
        "cancellation_writer_scope_changed"
    );
    let row = tx
        .query_opt(
            "SELECT * FROM team_subscription_cancellations WHERE operation_id=$1 FOR SHARE",
            &[&request.operation()],
        )
        .await?
        .context("cancellation_committed_request_missing")?;
    ensure!(
        decode(&row)? == *request && same_basis(&basis(&row, request)?, &projection.next()?),
        "cancellation_projection_next_unconfirmed"
    );
    verify_initial_history(
        tx,
        request,
        &row.get::<_, serde_json::Value>("read_evidence"),
    )
    .await?;
    control::exchange_next(tx, request, &projection.exchange).await?;
    let audit=tx.query_opt("SELECT operation_id,exchange_id,projected_at,projection_metadata,metadata_sha256 FROM team_subscription_cancellation_projections WHERE observation_id=$1 FOR SHARE",&[&projection.observation.id]).await?.context("cancellation_projection_audit_missing")?;
    let metadata: CancellationProjection = serde_json::from_value(audit.get("projection_metadata"))
        .map_err(|_| anyhow::anyhow!("cancellation_projection_audit_invalid"))?;
    ensure!(
        metadata == **projection
            && audit.get::<_, Uuid>("operation_id") == request.operation()
            && audit.get::<_, Uuid>("exchange_id") == projection.exchange.id
            && audit.get::<_, DateTime<Utc>>("projected_at") == projection.projected_at
            && audit.get::<_, String>("metadata_sha256") == projection.audit_hash()?,
        "cancellation_projection_audit_changed"
    );
    Ok(())
}

impl CancellationRepository {
    /// Only an opaque actual provider result may attempt a current projection.
    /// This result object grants nothing after Owner/row/source/lease changes.
    pub async fn project_result(
        &self,
        result: &crate::infrastructure::stripe::RetainedCancellationResult,
    ) -> Result<bool> {
        let guard = self.guard()?;
        let state = guard.read()?;
        let observation = state
            .snapshot
            .sources
            .scopes
            .values()
            .flat_map(|entry| entry.cancellation_observations.values())
            .find(|observation| {
                observation.id == result.observation()
                    && observation.request.operation() == result.operation()
                    && observation.attempt.exchange == result.exchange()
            })
            .context("cancellation_retained_result_missing")?
            .clone();
        self.project_observation(observation, Some(result)).await
    }
    /// One bounded cold recovery step. It retains historical evidence only; it
    /// cannot turn a file receipt into a new Owner/HTTP grant after restart.
    pub async fn resume_next_result(&self, account: &Account) -> Result<bool> {
        crate::services::team_subscription_cancellation::require_enabled()?;
        self.reconcile_history(account).await?;
        let state = self.guard()?.read()?;
        let observations = state
            .snapshot
            .sources
            .scopes
            .values()
            .filter(|entry| {
                entry.scope.account == account.account && entry.scope.live == account.live
            })
            .flat_map(|entry| {
                entry
                    .cancellation_observations
                    .values()
                    .filter(|observation| entry.unapplied_outcomes.contains(&observation.outcome))
            })
            .take(100)
            .cloned()
            .collect::<Vec<_>>();
        for observation in observations {
            // Do not steal a live caller's result merely because its account
            // lease expired first. Its own operation lease is the boundary.
            let active:bool=self.pg.query_one("SELECT EXISTS(SELECT 1 FROM team_subscription_cancellations WHERE operation_id=$1 AND revision=$2 AND lease_id=$3 AND lease_until>clock_timestamp())",&[&observation.request.operation(),&observation.attempt.revision,&observation.attempt.lease]).await?.get(0);
            if active {
                continue;
            }
            self.project_observation(observation, None).await?;
            return Ok(true);
        }
        Ok(false)
    }
    async fn project_observation(
        &self,
        observation: Observation,
        result: Option<&crate::infrastructure::stripe::RetainedCancellationResult>,
    ) -> Result<bool> {
        crate::services::team_subscription_cancellation::require_enabled()?;
        let request = observation.request.clone();
        let scope = request.scope();
        let account = Account {
            account: scope.account.clone(),
            live: scope.live,
        };
        self.reconcile_history(&account).await?;
        let guard = self.guard()?;
        let state = guard.read()?;
        let entry = state
            .snapshot
            .sources
            .scopes
            .get(&scope.key()?)
            .context("cancellation_source_unconfirmed")?;
        ensure!(
            entry.cancellation_observations.get(&observation.id) == Some(&observation),
            "cancellation_retained_result_changed"
        );
        if !entry.unapplied_outcomes.contains(&observation.outcome) {
            // A resolved receipt is not reprojected to manufacture freshness or
            // a current grant. Its immutable audit remains queryable separately.
            ensure!(self.pg.query_opt("SELECT 1 FROM team_subscription_cancellation_projections WHERE observation_id=$1 AND operation_id=$2",&[&observation.id,&request.operation()]).await?.is_some(),"cancellation_resolved_result_audit_missing");
            return Ok(false);
        }
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        let write =
            super::super::team_financial_transaction::NormalWrite::begin_cancellation_resolution(
                tx,
                guard,
                &account,
                &request,
                &observation,
            )
            .await?;
        let candidate=write.sql().query_opt("SELECT revision,COALESCE(recovery_actor,actor_id) AS current_actor FROM team_subscription_cancellations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4",&[&request.operation(),&scope.organization,&scope.account,&scope.live]).await?.context("cancellation_saved_scope_changed")?;
        let actor: Uuid = candidate.get("current_actor");
        let owner = match AuthorizationService::require_locked_billing_owner(
            write.sql(),
            actor,
            scope.organization,
        )
        .await
        {
            Ok(()) => true,
            Err(error) if error.downcast_ref::<AuthorizationDenied>().is_some() => false,
            Err(error) => return Err(error),
        };
        let row=write.sql().query_opt("SELECT * FROM team_subscription_cancellations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR UPDATE",&[&request.operation(),&scope.organization,&scope.account,&scope.live]).await?.context("cancellation_saved_scope_changed")?;
        ensure!(
            decode(&row)? == request,
            "cancellation_original_request_changed"
        );
        let basis = basis(&row, &request)?;
        ensure!(
            basis.actor == actor && basis.revision == candidate.get::<_, i64>("revision"),
            "cancellation_projection_predecessor_changed"
        );
        verify_initial_history(
            write.sql(),
            &request,
            &row.get::<_, serde_json::Value>("read_evidence"),
        )
        .await?;
        let exchange =
            control::load_exchange(write.sql(), &request, observation.attempt.exchange).await?;
        let state = guard.read()?;
        let epoch = policy::exchange_epoch(&state.snapshot, &request, &exchange)?;
        let latest = epoch == policy::latest_exchange_epoch(&state.snapshot, &request)?;
        let now: DateTime<Utc> = write
            .sql()
            .query_one("SELECT clock_timestamp()", &[])
            .await?
            .get(0);
        let rollout = write
            .sql()
            .query_opt(
                "SELECT 1 FROM team_rollouts WHERE organization_id=$1 AND enabled FOR SHARE",
                &[&scope.organization],
            )
            .await?
            .is_some();
        let account_until=write.sql().query_opt("SELECT lease_until FROM team_stripe_runtime_status WHERE account_id=$1 AND livemode=$2 AND lease_id=$3 AND lease_until>clock_timestamp() FOR SHARE",&[&scope.account,&scope.live,&exchange.account_lease]).await?.map(|row|row.get::<_,DateTime<Utc>>(0));
        let proof_identity =
            fingerprint(&(request.operation(), exchange.metadata_hash(&request)?))?;
        let current=result.is_some_and(|result|result.operation()==request.operation() && result.observation()==observation.id
            && result.exchange()==exchange.id && result.proof_identity()==proof_identity)
            && owner && rollout && latest && basis.actor==exchange.actor && basis.revision==exchange.revision
            && basis.last_observation==exchange.previous_observation && basis.first_attempt_at==exchange.first_attempt_at
            && basis.lease==Some(exchange.lease) && basis.lease_until.is_some_and(|until|now<until)
            && account_until.is_some() && observation.observed_at<=now && exchange.prepared_at<=observation.observed_at
            && now<exchange.prepared_at.checked_add_signed(Duration::seconds(60)).context("cancellation_projection_time_invalid")?
            && ["pending","provider_scheduled"].contains(&basis.disposition.as_str())
            && (exchange.kind!=crate::services::team_subscription_cancellation::lifecycle::ExchangeKind::Mutation || (!basis.read_only && basis.recovery_actor.is_none()));
        let park = !current
            && latest
            && basis.actor == exchange.actor
            && basis.revision == exchange.revision
            && basis.last_observation == exchange.previous_observation
            && basis.lease.is_none_or(|lease| lease == exchange.lease)
            && basis.lease_until.is_none_or(|until| until <= now)
            && !["effective", "withdrawn"].contains(&basis.disposition.as_str());
        let mode = if current {
            ProjectionMode::Current {
                account_lease: exchange.account_lease,
            }
        } else {
            ProjectionMode::RetainedOnly {
                park,
                owner_changed: !owner,
                resume_initial_read:park && owner && !basis.read_only && basis.recovery_actor.is_none() && basis.revision==1
                    && basis.actor==request.actor() && basis.first_attempt_at.is_none() && basis.last_observation.is_none()
                    && exchange.previous_observation.is_none() && exchange.first_attempt_at.is_none()
                    && exchange.kind==crate::services::team_subscription_cancellation::lifecycle::ExchangeKind::ResourceRead
                    && policy::never_mutated(&state.snapshot,&request),
            }
        };
        let outcomes = write.cancellation_outcomes()?.clone();
        let projection = CancellationProjection {
            request: request.clone(),
            observation,
            exchange,
            basis,
            mode,
            projected_at: now,
            outcomes,
        };
        let next = projection.next()?;
        if current || park {
            let delay: i32 = if next.disposition == "pending" && !next.read_only {
                0
            } else {
                60
            };
            let count=write.sql().execute("UPDATE team_subscription_cancellations SET read_only=$2,disposition=$3,last_observation_id=$4,observed_at=$5,lease_id=$6,lease_until=$7,retry_at=GREATEST(retry_at,$8::timestamptz+make_interval(secs=>$9)),last_error_code=CASE WHEN $10 THEN NULL ELSE last_error_code END WHERE operation_id=$1 AND revision=$11 AND last_observation_id IS NOT DISTINCT FROM $12::uuid",&[&request.operation(),&next.read_only,&next.disposition,&next.last_observation,&next.observed_at,&next.lease,&next.lease_until,&now,&delay,&current,&projection.basis.revision,&projection.basis.last_observation]).await?;
            ensure!(count == 1, "cancellation_projection_predecessor_changed");
        }
        let metadata = serde_json::to_value(&projection)?;
        let hash = projection.audit_hash()?;
        write.sql().execute("INSERT INTO team_subscription_cancellation_projections(observation_id,operation_id,exchange_id,projected_at,projection_metadata,metadata_sha256) VALUES($1,$2,$3,$4,$5,$6)",&[&projection.observation.id,&request.operation(),&projection.exchange.id,&now,&metadata,&hash]).await?;
        let deadline = if current {
            Some(
                projection
                    .basis
                    .lease_until
                    .unwrap()
                    .min(account_until.unwrap())
                    .min(
                        projection
                            .exchange
                            .prepared_at
                            .checked_add_signed(Duration::seconds(60))
                            .context("cancellation_projection_time_invalid")?,
                    ),
            )
        } else {
            None
        };
        self.guard()?;
        crate::services::team_subscription_cancellation::require_enabled()?;
        write
            .commit_cancellation_projection(
                Writer::CancellationResult {
                    projection: Box::new(projection),
                },
                deadline,
            )
            .await?;
        Ok(current)
    }
}

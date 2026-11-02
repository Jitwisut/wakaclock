//! Typed lifecycle mutation and exact-next readback. No HTTP capability is
//! returned: a later sealed provider proof must recheck all current authority.
use super::*;
use crate::services::{
    team_insights::TeamError,
    team_subscription_cancellation::lifecycle::{self, CancellationStage, Exchange, ExchangeKind},
};
use tokio_postgres::Transaction;

fn next(revision: i64) -> Result<i64> {
    revision
        .checked_add(1)
        .context("cancellation_revision_overflow")
}
pub(super) async fn authorization(
    tx: &Transaction<'_>,
    request: &FrozenCancellation,
    revision: i64,
    actor: Uuid,
) -> Result<String> {
    let row=tx.query_opt("SELECT actor_id,authorized_at,action FROM team_subscription_cancellation_authorizations WHERE operation_id=$1 AND revision=$2 FOR SHARE",&[&request.operation(),&revision]).await?.context("cancellation_authorization_missing_or_changed")?;
    ensure!(
        row.get::<_, Uuid>(0) == actor,
        "cancellation_authorization_actor_changed"
    );
    lifecycle::authorization_hash(
        request,
        revision,
        actor,
        row.get(1),
        row.get::<_, String>(2).as_str(),
    )
}
fn kind(kind: &ExchangeKind) -> &'static str {
    match kind {
        ExchangeKind::Mutation => "mutation",
        ExchangeKind::ResourceRead => "resource_read",
    }
}
pub(super) async fn exchange_next(
    tx: &Transaction<'_>,
    request: &FrozenCancellation,
    exchange: &Exchange,
) -> Result<()> {
    exchange.validate(request, exchange.revision)?;
    ensure!(
        authorization(tx, request, exchange.revision, exchange.actor).await?
            == exchange.authorization_hash,
        "cancellation_exchange_authorization_changed"
    );
    let row=tx.query_opt("SELECT e.*,a.operation_id AS audit_operation,a.actor_id AS audit_actor,a.recorded_at AS audit_at,a.metadata_sha256 AS audit_hash FROM team_subscription_cancellation_exchanges e JOIN team_subscription_cancellation_exchange_audit a ON a.exchange_id=e.exchange_id WHERE e.exchange_id=$1 FOR SHARE OF e,a",&[&exchange.id]).await?.context("cancellation_prepared_exchange_missing")?;
    let hash = exchange.metadata_hash(request)?;
    ensure!(
        row.get::<_, Uuid>("operation_id") == request.operation()
            && row.get::<_, i64>("authorization_revision") == exchange.revision
            && row.get::<_, Uuid>("actor_id") == exchange.actor
            && row.get::<_, Uuid>("lease_id") == exchange.lease
            && row.get::<_, Uuid>("account_lease_id") == exchange.account_lease
            && row.get::<_, String>("kind") == kind(&exchange.kind)
            && row.get::<_, DateTime<Utc>>("prepared_at") == exchange.prepared_at
            && row.get::<_, Option<DateTime<Utc>>>("first_attempt_at") == exchange.first_attempt_at
            && row.get::<_, Option<Uuid>>("previous_observation_id")
                == exchange.previous_observation
            && row.get::<_, String>("authorization_sha256") == exchange.authorization_hash
            && row.get::<_, String>("metadata_sha256") == hash
            && row.get::<_, Uuid>("audit_operation") == request.operation()
            && row.get::<_, Uuid>("audit_actor") == exchange.actor
            && row.get::<_, DateTime<Utc>>("audit_at") == exchange.prepared_at
            && row.get::<_, String>("audit_hash") == hash,
        "cancellation_prepared_exchange_changed"
    );
    Ok(())
}
pub(super) async fn load_exchange(
    tx: &Transaction<'_>,
    request: &FrozenCancellation,
    id: Uuid,
) -> Result<Exchange> {
    let row=tx.query_opt("SELECT * FROM team_subscription_cancellation_exchanges WHERE exchange_id=$1 AND operation_id=$2 FOR SHARE",&[&id,&request.operation()]).await?.context("cancellation_prepared_exchange_missing")?;
    let exchange = Exchange {
        id,
        actor: row.get("actor_id"),
        revision: row.get("authorization_revision"),
        lease: row.get("lease_id"),
        account_lease: row.get("account_lease_id"),
        kind: match row.get::<_, String>("kind").as_str() {
            "mutation" => ExchangeKind::Mutation,
            "resource_read" => ExchangeKind::ResourceRead,
            _ => anyhow::bail!("cancellation_exchange_kind_invalid"),
        },
        prepared_at: row.get("prepared_at"),
        first_attempt_at: row.get("first_attempt_at"),
        previous_observation: row.get("previous_observation_id"),
        authorization_hash: row.get("authorization_sha256"),
    };
    exchange_next(tx, request, &exchange).await?;
    Ok(exchange)
}
async fn audit_next(
    tx: &Transaction<'_>,
    request: &FrozenCancellation,
    revision: i64,
    actor: Uuid,
    at: DateTime<Utc>,
    action: &str,
    hash: &str,
) -> Result<()> {
    ensure!(tx.query_opt("SELECT 1 FROM team_subscription_cancellation_audit WHERE operation_id=$1 AND revision=$2 AND actor_id=$3 AND recorded_at=$4 AND action=$5 AND metadata_hash=$6 FOR SHARE",&[&request.operation(),&revision,&actor,&at,&action,&hash]).await?.is_some(),"cancellation_lifecycle_audit_missing_or_changed");
    Ok(())
}
/// Historical verification does not require current Owner, flag or live lease.
/// It confirms only the retained SQL next state; the worker must mint a new proof
/// before HTTP. Missing rows/audit/auth cannot be recreated by this decoder.
pub(crate) async fn committed_lifecycle(
    tx: &Transaction<'_>,
    account: &Account,
    writer: &Writer,
) -> Result<()> {
    let Writer::CancellationLifecycle {
        request,
        expected_revision,
        stage,
    } = writer
    else {
        anyhow::bail!("financial_transaction_writer_mismatch")
    };
    stage.validate(request, *expected_revision)?;
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
        decode(&row)? == *request,
        "cancellation_original_request_changed"
    );
    verify_initial_history(
        tx,
        request,
        &row.get::<_, serde_json::Value>("read_evidence"),
    )
    .await?;
    let revision: i64 = row.get("revision");
    let first: Option<DateTime<Utc>> = row.get("first_attempt_at");
    match stage {
        CancellationStage::BeginExchange { exchange } => {
            ensure!(
                revision == *expected_revision
                    && row.get::<_, Option<Uuid>>("last_observation_id")
                        == exchange.previous_observation
                    && first == exchange.first_attempt_at
                    && ["pending", "provider_scheduled"]
                        .contains(&row.get::<_, String>("disposition").as_str())
                    && row.get::<_, Option<Uuid>>("lease_id") == Some(exchange.lease)
                    && row
                        .get::<_, Option<Uuid>>("recovery_actor")
                        .unwrap_or(request.actor())
                        == exchange.actor
                    && (exchange.kind != ExchangeKind::Mutation
                        || (row.get::<_, String>("disposition") == "pending"
                            && !row.get::<_, bool>("read_only")
                            && row.get::<_, Option<Uuid>>("recovery_actor").is_none())),
                "cancellation_exchange_next_unconfirmed"
            );
            exchange_next(tx, request, exchange).await?;
        }
        CancellationStage::Stop {
            actor,
            stopped_at,
            first_attempt_at,
            recovery_actor,
            read_only,
            reason,
            ..
        } => {
            ensure!(
                revision == next(*expected_revision)?
                    && first == *first_attempt_at
                    && row.get::<_, Option<Uuid>>("recovery_actor") == *recovery_actor
                    && row.get::<_, bool>("read_only") == *read_only
                    && row.get::<_, String>("disposition") == reason.disposition()
                    && row.get::<_, Option<String>>("last_error_code").as_deref()
                        == Some(reason.code())
                    && row.get::<_, Option<Uuid>>("lease_id").is_none()
                    && row.get::<_, Option<DateTime<Utc>>>("lease_until").is_none(),
                "cancellation_stop_next_unconfirmed"
            );
            audit_next(
                tx,
                request,
                revision,
                *actor,
                *stopped_at,
                "stop_existing_cancellation",
                &stage.audit_hash(request, *expected_revision)?,
            )
            .await?;
        }
        CancellationStage::RecoveryAuthorization {
            actor,
            authorized_at,
            first_attempt_at,
        } => {
            ensure!(
                revision == next(*expected_revision)?
                    && first == *first_attempt_at
                    && row.get::<_, bool>("read_only")
                    && row.get::<_, Option<Uuid>>("recovery_actor") == Some(*actor)
                    && row.get::<_, String>("disposition") == "pending"
                    && row.get::<_, Option<Uuid>>("lease_id").is_none()
                    && row.get::<_, Option<DateTime<Utc>>>("lease_until").is_none()
                    && row.get::<_, Option<String>>("last_error_code").is_none(),
                "cancellation_recovery_next_unconfirmed"
            );
            ensure!(
                authorization(tx, request, revision, *actor).await?
                    == lifecycle::authorization_hash(
                        request,
                        revision,
                        *actor,
                        *authorized_at,
                        "reconcile_existing_cancellation"
                    )?,
                "cancellation_recovery_authorization_changed"
            );
            audit_next(
                tx,
                request,
                revision,
                *actor,
                *authorized_at,
                "reconcile_existing_cancellation",
                &stage.audit_hash(request, *expected_revision)?,
            )
            .await?;
        }
    }
    Ok(())
}

impl CancellationRepository {
    pub async fn authorize_readback(
        &self,
        actor: Uuid,
        org: Uuid,
        operation: Uuid,
        expected_revision: i64,
    ) -> Result<()> {
        crate::services::team_subscription_cancellation::require_enabled()?;
        ensure!(
            !actor.is_nil() && expected_revision > 0 && expected_revision < i64::MAX,
            TeamError::Invalid("original cancellation revision required")
        );
        let saved = self
            .find_saved(actor, org, operation)
            .await?
            .context("cancellation_saved_acceptance_unconfirmed_reconciliation_required")?;
        let row=self.pg.query_one("SELECT revision,first_attempt_at,clock_timestamp() AS checked_at FROM team_subscription_cancellations WHERE operation_id=$1 AND organization_id=$2",&[&operation,&org]).await?;
        let revision: i64 = row.get("revision");
        if revision == next(expected_revision)? {
            // An exact lost-response retry returns the original authorization;
            // it does not mint another revision/time or borrow its HTTP rights.
            let known=self.guard()?.read()?.snapshot.transactions.groups.values().any(|group| group.committed
                && matches!(group.proposal.writer.as_ref(),Some(Writer::CancellationLifecycle {request,expected_revision:expected,stage:CancellationStage::RecoveryAuthorization {actor:who,first_attempt_at,..}})
                    if request.operation()==operation && request.scope().organization==org && *expected==expected_revision && *who==actor && *first_attempt_at==row.get::<_,Option<DateTime<Utc>>>("first_attempt_at")));
            ensure!(known, "cancellation_revision_changed");
            saved.response().await?;
            return Ok(());
        }
        ensure!(
            revision == expected_revision,
            "cancellation_revision_changed"
        );
        // This first read is a selection only. apply_lifecycle repeats Owner,
        // row/revision/first time and source checks while holding SQL locks.
        let stage = CancellationStage::RecoveryAuthorization {
            actor,
            authorized_at: row.get("checked_at"),
            first_attempt_at: row.get("first_attempt_at"),
        };
        saved.response().await?;
        self.apply_lifecycle(org, operation, expected_revision, stage)
            .await
    }
    /// Internal control surface only. The caller supplies captured stage
    /// metadata; SQL/current-Owner/lease checks below decide whether it can be
    /// committed. This result never authorizes a provider request by itself.
    pub(crate) async fn apply_lifecycle(
        &self,
        org: Uuid,
        operation: Uuid,
        expected_revision: i64,
        stage: CancellationStage,
    ) -> Result<()> {
        crate::services::team_subscription_cancellation::require_enabled()?;
        ensure!(
            !org.is_nil()
                && !operation.is_nil()
                && expected_revision > 0
                && expected_revision < i64::MAX,
            TeamError::Invalid("original cancellation revision required")
        );
        let guard = self.guard()?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        let locator=tx.query_opt("SELECT account_id,livemode FROM team_subscription_cancellations WHERE operation_id=$1 AND organization_id=$2",&[&operation,&org]).await?.context("cancellation_saved_acceptance_unconfirmed_reconciliation_required")?;
        let account = Account {
            account: locator.get(0),
            live: locator.get(1),
        };
        account.key()?;
        super::super::team_financial_locks::organization(&tx, &account.account, account.live, org)
            .await?;
        let actor = match &stage {
            CancellationStage::BeginExchange { exchange } => exchange.actor,
            CancellationStage::RecoveryAuthorization { actor, .. }
            | CancellationStage::Stop { actor, .. } => *actor,
        };
        if !matches!(&stage, CancellationStage::Stop { .. }) {
            AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        }
        ensure!(
            tx.query_opt(
                "SELECT 1 FROM team_rollouts WHERE organization_id=$1 AND enabled FOR SHARE",
                &[&org]
            )
            .await?
            .is_some(),
            TeamError::Disabled
        );
        super::super::team_financial_ingress::require_authority(&tx, &account, Some(guard)).await?;
        ensure!(
            super::super::team_financial_transaction::source_mode(&tx, guard, &account).await?,
            "cancellation_source_evidence_required"
        );
        let write = super::super::team_financial_transaction::NormalWrite::begin_organization(
            tx, guard, &account, org,
        )
        .await?;
        let row=write.sql().query_opt("SELECT * FROM team_subscription_cancellations WHERE operation_id=$1 AND organization_id=$2 AND account_id=$3 AND livemode=$4 FOR UPDATE",&[&operation,&org,&account.account,&account.live]).await?.context("cancellation_saved_scope_changed")?;
        let request = decode(&row)?;
        ensure!(
            row.get::<_, i64>("revision") == expected_revision,
            "cancellation_revision_changed"
        );
        ensure!(
            !["effective", "withdrawn"].contains(&row.get::<_, String>("disposition").as_str()),
            "cancellation_already_terminal"
        );
        verify_initial_history(
            write.sql(),
            &request,
            &row.get::<_, serde_json::Value>("read_evidence"),
        )
        .await?;
        stage.validate(&request, expected_revision)?;
        let now: DateTime<Utc> = write
            .sql()
            .query_one("SELECT clock_timestamp()", &[])
            .await?
            .get(0);
        let first: Option<DateTime<Utc>> = row.get("first_attempt_at");
        let deadline = match &stage {
            CancellationStage::BeginExchange { exchange } => {
                ensure!(
                    row.get::<_, Option<Uuid>>("last_observation_id")
                        == exchange.previous_observation,
                    "cancellation_observation_predecessor_changed"
                );
                ensure!(
                    ["pending", "provider_scheduled"]
                        .contains(&row.get::<_, String>("disposition").as_str())
                        && row.get::<_, DateTime<Utc>>("retry_at") <= now
                        && row.get::<_, Option<Uuid>>("lease_id") == Some(exchange.lease)
                        && row
                            .get::<_, Option<Uuid>>("recovery_actor")
                            .unwrap_or(request.actor())
                            == actor
                        && exchange.prepared_at <= now
                        && now - exchange.prepared_at <= Duration::seconds(60),
                    "cancellation_exchange_predecessor_changed"
                );
                ensure!(
                    authorization(write.sql(), &request, expected_revision, actor).await?
                        == exchange.authorization_hash,
                    "cancellation_authorization_changed"
                );
                if exchange.kind == ExchangeKind::Mutation {
                    ensure!(
                        row.get::<_, String>("disposition") == "pending"
                            && !row.get::<_, bool>("read_only")
                            && row.get::<_, Option<Uuid>>("recovery_actor").is_none()
                            && exchange.first_attempt_at
                                == Some(first.unwrap_or(exchange.prepared_at)),
                        "cancellation_first_attempt_changed"
                    );
                } else {
                    ensure!(
                        exchange.first_attempt_at == first,
                        "cancellation_read_cannot_change_first_attempt"
                    );
                }
                let until = row
                    .get::<_, Option<DateTime<Utc>>>("lease_until")
                    .context("cancellation_lease_unconfirmed")?;
                let account_until:DateTime<Utc>=write.sql().query_opt("SELECT lease_until FROM team_stripe_runtime_status WHERE account_id=$1 AND livemode=$2 AND lease_id=$3 AND lease_until>clock_timestamp() AND retry_at<=clock_timestamp() FOR SHARE",&[&account.account,&account.live,&exchange.account_lease]).await?.context("cancellation_account_lease_unconfirmed")?.get(0);
                let mut deadline = until.min(account_until).min(
                    exchange
                        .prepared_at
                        .checked_add_signed(Duration::seconds(60))
                        .context("cancellation_exchange_time_invalid")?,
                );
                if exchange.kind == ExchangeKind::Mutation {
                    deadline = deadline.min(request.period_end()).min(
                        exchange
                            .first_attempt_at
                            .context("cancellation_first_attempt_unconfirmed")?
                            .checked_add_signed(Duration::hours(23))
                            .context("cancellation_window_invalid")?,
                    );
                }
                ensure!(now < deadline, "cancellation_exchange_deadline_expired");
                let hash = exchange.metadata_hash(&request)?;
                write.sql().execute("INSERT INTO team_subscription_cancellation_exchanges(exchange_id,operation_id,authorization_revision,actor_id,lease_id,account_lease_id,kind,prepared_at,first_attempt_at,previous_observation_id,authorization_sha256,metadata_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",&[&exchange.id,&operation,&expected_revision,&actor,&exchange.lease,&exchange.account_lease,&kind(&exchange.kind),&exchange.prepared_at,&exchange.first_attempt_at,&exchange.previous_observation,&exchange.authorization_hash,&hash]).await?;
                write.sql().execute("INSERT INTO team_subscription_cancellation_exchange_audit(exchange_id,operation_id,actor_id,recorded_at,metadata_sha256) VALUES($1,$2,$3,$4,$5)",&[&exchange.id,&operation,&actor,&exchange.prepared_at,&hash]).await?;
                write.sql().execute("UPDATE team_subscription_cancellations SET first_attempt_at=$2 WHERE operation_id=$1",&[&operation,&exchange.first_attempt_at]).await?;
                Some(deadline)
            }
            CancellationStage::Stop {
                lease,
                stopped_at,
                first_attempt_at,
                recovery_actor,
                read_only,
                reason,
                ..
            } => {
                ensure!(
                    row.get::<_, String>("disposition") == "pending"
                        && row.get::<_, Option<Uuid>>("lease_id") == Some(*lease)
                        && row
                            .get::<_, Option<DateTime<Utc>>>("lease_until")
                            .is_some_and(|until| now < until)
                        && row.get::<_, Option<Uuid>>("recovery_actor") == *recovery_actor
                        && row.get::<_, bool>("read_only") == *read_only
                        && first == *first_attempt_at
                        && *stopped_at <= now
                        && now - *stopped_at <= Duration::seconds(60),
                    "cancellation_stop_predecessor_changed"
                );
                write.sql().execute("UPDATE team_subscription_cancellations SET revision=revision+1,disposition=$2,last_error_code=$3,last_http_status=NULL,lease_id=NULL,lease_until=NULL WHERE operation_id=$1",&[&operation,&reason.disposition(),&reason.code()]).await?;
                insert_audit(
                    write.sql(),
                    &request,
                    expected_revision,
                    actor,
                    *stopped_at,
                    "stop_existing_cancellation",
                    &stage,
                )
                .await?;
                None
            }
            CancellationStage::RecoveryAuthorization {
                authorized_at,
                first_attempt_at,
                ..
            } => {
                ensure!(
                    first == *first_attempt_at
                        && *authorized_at <= now
                        && now - *authorized_at <= Duration::seconds(60)
                        && row
                            .get::<_, Option<DateTime<Utc>>>("lease_until")
                            .is_none_or(|until| until <= now),
                    "cancellation_recovery_predecessor_changed"
                );
                let revision = next(expected_revision)?;
                write.sql().execute("UPDATE team_subscription_cancellations SET revision=$2,read_only=true,recovery_actor=$3,disposition='pending',lease_id=NULL,lease_until=NULL,last_error_code=NULL,last_http_status=NULL,retry_at=GREATEST(retry_at,clock_timestamp()) WHERE operation_id=$1",&[&operation,&revision,&actor]).await?;
                write.sql().execute("INSERT INTO team_subscription_cancellation_authorizations(operation_id,revision,actor_id,authorized_at,action) VALUES($1,$2,$3,$4,'reconcile_existing_cancellation')",&[&operation,&revision,&actor,&authorized_at]).await?;
                insert_audit(
                    write.sql(),
                    &request,
                    expected_revision,
                    actor,
                    *authorized_at,
                    "reconcile_existing_cancellation",
                    &stage,
                )
                .await?;
                None
            }
        };
        self.guard()?;
        crate::services::team_subscription_cancellation::require_enabled()?;
        write
            .commit_cancellation_lifecycle(
                Writer::CancellationLifecycle {
                    request,
                    expected_revision,
                    stage,
                },
                deadline,
            )
            .await
    }
}
async fn insert_audit(
    tx: &Transaction<'_>,
    request: &FrozenCancellation,
    expected: i64,
    actor: Uuid,
    at: DateTime<Utc>,
    action: &str,
    stage: &CancellationStage,
) -> Result<()> {
    tx.execute("INSERT INTO team_subscription_cancellation_audit(operation_id,revision,actor_id,action,recorded_at,metadata_hash) VALUES($1,$2,$3,$4,$5,$6)",&[&request.operation(),&next(expected)?,&actor,&action,&at,&stage.audit_hash(request,expected)?]).await?;
    Ok(())
}

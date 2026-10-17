//! Durable account deletion workflow (R5).
//!
//! Account deletion is intentionally a bounded, system-scoped RabbitMQ job. The
//! request first writes a PostgreSQL tombstone, so authentication and new
//! account-scoped work stop immediately. The worker then drains/cancels queued
//! work, removes external artifacts and cache state, purges every allowlisted
//! ClickHouse table, verifies the purge, and only then deletes the PostgreSQL
//! account row. The tombstone and metadata-only audit trail survive that final
//! delete, so an in-flight Kafka record cannot recreate analytics data silently.

use anyhow::{anyhow, Context, Result};
use clickhouse::Row as ClickHouseRow;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::sync::Arc;
use uuid::Uuid;

use crate::config::AccountDeletionMode;
use crate::infrastructure::contracts::{JobKind, ObjectStore};
use crate::infrastructure::database::ClickHouseClient;
use crate::infrastructure::postgres::PostgresClient;
use crate::infrastructure::redis_presence::RedisPresenceStore;
use crate::model::async_job::{CreatedJob, JobStatus};
use crate::services::background_worker::LeaseGuard;
use crate::services::jobs::{ClaimedJob, JobService};

const ACCOUNT_DELETION_SCHEMA_VERSION: u16 = 1;
const ACCOUNT_DELETION_IDEMPOTENCY_KEY: &str = "request";

/// All ClickHouse tables that may contain account-owned data. The worker also
/// discovers every non-view table with a `user_id` column and fails closed if a
/// new table is not added here. That makes adding a future user table a visible
/// deployment task instead of a silent privacy regression.
const CLICKHOUSE_USER_TABLES: &[&str] = &[
    "heartbeats",
    "heartbeats_incoming",
    "activity_intervals",
    "heartbeat_deletions",
    "ai_identity_repair_runs",
    "ai_identity_repair_corrections",
    "analytics_reprocess_audits",
    "canonical_day_revisions",
    "daily_totals",
    "language_daily",
    "project_daily",
    "editor_daily",
    "os_daily",
    "insights_agg",
    "projects",
    "sync_state",
    "ai_daily",
    "actor_daily_v2",
    "actor_daily_v2_backfill_state",
    "keystroke_daily",
    "member_daily",
    "organization_daily",
    "feature_daily",
    "dependency_daily",
    "commit_activity_daily",
    "ai_model_daily",
    "ai_effectiveness_daily",
    "leaderboard_snapshots",
    "account_projection_versions",
    "machine_daily",
    "ai_client_daily",
    "ai_project_daily",
    "project_file_daily",
    "project_branch_daily",
    "project_language_daily",
    "project_editor_daily",
    "project_activity_daily",
    "project_identities",
    "project_aliases",
    "project_merges",
    "project_rules",
    "orgs",
    "org_members",
    "teams",
    "team_members",
    "coworking_sessions",
    "coworking_session_participants",
    "external_durations_raw",
    "human_follow_up_events",
    "ai_usage_events",
    "ai_sessions",
    "ai_session_projects",
    "ai_changes_raw",
    "users",
];

pub struct AccountDeletionService {
    postgres: Option<Arc<PostgresClient>>,
    clickhouse: Arc<ClickHouseClient>,
    object_store: Option<Arc<dyn ObjectStore>>,
    redis_presence: Option<Arc<RedisPresenceStore>>,
    mode: AccountDeletionMode,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AccountDeletionJobParams {
    schema_version: u16,
    account_id: Uuid,
}

#[derive(Debug, Deserialize, ClickHouseRow)]
struct ClickHouseUserTable {
    table: String,
    engine: String,
}

impl AccountDeletionService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        clickhouse: Arc<ClickHouseClient>,
        object_store: Option<Arc<dyn ObjectStore>>,
        redis_presence: Option<Arc<RedisPresenceStore>>,
        mode: AccountDeletionMode,
    ) -> Self {
        Self {
            postgres,
            clickhouse,
            object_store,
            redis_presence,
            mode,
        }
    }

    /// Object storage is required even when a particular account has no current
    /// export: an old invoice/export artifact must never be orphaned by a hard
    /// delete that cannot inspect and remove it.
    pub fn processor_ready(&self) -> bool {
        self.postgres.is_some() && self.object_store.is_some()
    }

    pub fn request_mode_enabled(&self) -> bool {
        self.mode == AccountDeletionMode::Job
    }

    /// Tombstone the account and enqueue exactly one system-scoped deletion job.
    /// The tombstone, credential revocation, request row, job row and outbox row
    /// commit together, so a successful response can never leave an inaccessible
    /// account without a durable cleanup attempt.
    pub async fn request(&self, account_id: Uuid) -> Result<CreatedJob> {
        if !self.request_mode_enabled() {
            anyhow::bail!("account deletion is not enabled");
        }
        if !self.processor_ready() {
            anyhow::bail!("account deletion requires PostgreSQL and a configured object store");
        }
        let postgres = self.required_postgres()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        PostgresClient::account_activity_transaction_lock(&tx, account_id).await?;
        // Capture before deactivation lets the cleanup worker remove workflow
        // metadata without erasing the request's independent proof obligation.
        tx.query_one("SELECT pg_advisory_xact_lock(74103031)", &[])
            .await?;

        // The row is the idempotency boundary for the destructive operation. A
        // repeated request returns the original system job rather than creating a
        // second hard-delete attempt. Check it before the user row so a replay after
        // the final PostgreSQL delete can still return the original job identity.
        if let Some(existing) = tx
            .query_opt(
                "SELECT async_job_id FROM account_deletion_requests
                 WHERE account_id = $1 FOR UPDATE",
                &[&account_id],
            )
            .await
            .context("load existing account deletion request")?
        {
            let job_id: Uuid = existing
                .get::<_, Option<Uuid>>("async_job_id")
                .context("account deletion request has no async job")?;
            let created = existing_job(&tx, job_id).await?;
            tx.commit().await?;
            return Ok(created);
        }
        let user = tx
            .query_opt(
                "SELECT is_active, deleted_at FROM users WHERE id = $1 FOR UPDATE",
                &[&account_id],
            )
            .await
            .context("load account before deletion request")?;
        let Some(user) = user else {
            if let Some(existing) = tx
                .query_opt(
                    "SELECT async_job_id FROM account_deletion_requests
                     WHERE account_id = $1 FOR UPDATE",
                    &[&account_id],
                )
                .await
                .context("reload account deletion request after account disappearance")?
            {
                let job_id: Uuid = existing
                    .get::<_, Option<Uuid>>("async_job_id")
                    .context("account deletion request has no async job")?;
                let created = existing_job(&tx, job_id).await?;
                tx.commit().await?;
                return Ok(created);
            }
            anyhow::bail!("account not found");
        };
        // A concurrent requester may have committed while this transaction was
        // waiting on the user row lock. Re-read the request after the lock so two
        // clients cannot race past the destructive idempotency boundary.
        if let Some(existing) = tx
            .query_opt(
                "SELECT async_job_id FROM account_deletion_requests
                 WHERE account_id = $1 FOR UPDATE",
                &[&account_id],
            )
            .await
            .context("reload existing account deletion request")?
        {
            let job_id: Uuid = existing
                .get::<_, Option<Uuid>>("async_job_id")
                .context("account deletion request has no async job")?;
            let created = existing_job(&tx, job_id).await?;
            tx.commit().await?;
            return Ok(created);
        }
        let is_active: bool = user.get("is_active");
        let deleted_at: Option<chrono::DateTime<chrono::Utc>> = user.get("deleted_at");
        if !is_active || deleted_at.is_some() {
            anyhow::bail!("account is already unavailable for deletion");
        }
        let team_proof_required = team_action_deletion_required(&tx, account_id).await?;

        tx.execute(
            "UPDATE users
             SET is_active = FALSE, deleted_at = COALESCE(deleted_at, now()), updated_at = now()
             WHERE id = $1",
            &[&account_id],
        )
        .await
        .context("write account deletion tombstone")?;
        tx.execute(
            "UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1",
            &[&account_id],
        )
        .await
        .context("revoke account sessions before deletion")?;
        tx.execute(
            "UPDATE api_keys SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1",
            &[&account_id],
        )
        .await
        .context("revoke account API keys before deletion")?;
        tx.execute(
            "UPDATE user_ingest_access SET status = 'inactive', updated_at = now()
             WHERE user_id = $1",
            &[&account_id],
        )
        .await
        .context("disable account ingest access")?;
        tx.execute(
            "INSERT INTO account_deletion_requests (account_id, status,team_action_ledger_required)
             VALUES ($1, 'requested',$2)",
            &[&account_id, &team_proof_required],
        )
        .await
        .context("create account deletion request")?;

        let created = JobService::create_in_transaction(
            &tx,
            None,
            JobKind::AccountDelete,
            json!({
                "schema_version": ACCOUNT_DELETION_SCHEMA_VERSION,
                "account_id": account_id,
            }),
            Some(ACCOUNT_DELETION_IDEMPOTENCY_KEY),
        )
        .await
        .context("enqueue account deletion job")?;
        tx.execute(
            "UPDATE account_deletion_requests SET async_job_id = $2 WHERE account_id = $1",
            &[&account_id, &created.id],
        )
        .await
        .context("link account deletion request to async job")?;
        insert_audit(
            &tx,
            account_id,
            "request",
            "accepted",
            &json!({ "job_id": created.id }),
        )
        .await?;
        tx.commit()
            .await
            .context("commit account deletion request")?;
        Ok(created)
    }

    pub async fn process(&self, job: &ClaimedJob, lease: LeaseGuard) -> Result<Value> {
        if job.kind != JobKind::AccountDelete || job.user_id.is_some() {
            anyhow::bail!("invalid account deletion job scope");
        }
        let params: AccountDeletionJobParams = serde_json::from_value(job.params.clone())
            .map_err(|_| anyhow!("invalid account deletion job parameters"))?;
        if params.schema_version != ACCOUNT_DELETION_SCHEMA_VERSION {
            anyhow::bail!("invalid account deletion job parameters");
        }
        if !self.processor_ready() {
            anyhow::bail!("account deletion processor dependencies are unavailable");
        }
        self.process_account(params.account_id, job, lease).await
    }

    async fn process_account(
        &self,
        account_id: Uuid,
        job: &ClaimedJob,
        lease: LeaseGuard,
    ) -> Result<Value> {
        let postgres = self.required_postgres()?;
        // Detach this session from the pool. Dropping the detached client closes
        // the connection and releases the session-level lock even when the job
        // is cancelled or an external cleanup step fails.
        let mut connection = postgres.account_activity_lock(account_id).await?;
        self.process_account_locked(account_id, job, &lease, &mut connection)
            .await
    }

    async fn process_account_locked(
        &self,
        account_id: Uuid,
        job: &ClaimedJob,
        lease: &LeaseGuard,
        connection: &mut deadpool_postgres::ClientWrapper,
    ) -> Result<Value> {
        let request = connection
            .query_opt(
                "SELECT status, async_job_id, postgres_purged_at
                   FROM account_deletion_requests
                  WHERE account_id = $1",
                &[&account_id],
            )
            .await
            .context("load account deletion state")?
            .context("account deletion tombstone not found")?;
        let status: String = request.get("status");
        let request_job_id: Option<Uuid> = request.get("async_job_id");
        ensure_job_owns_request(request_job_id, job.id)?;
        if status == "succeeded" {
            return Ok(json!({ "deleted": true, "already_completed": true }));
        }
        if !matches!(status.as_str(), "requested" | "running") {
            anyhow::bail!("account deletion is not executable");
        }
        if request
            .get::<_, Option<chrono::DateTime<chrono::Utc>>>("postgres_purged_at")
            .is_some()
        {
            lease.ensure_active()?;
            let result = finish_postgres_deletion(
                self.postgres
                    .as_ref()
                    .context("PostgreSQL unavailable")?
                    .clone(),
                connection,
                account_id,
            )
            .await?;
            lease.ensure_active()?;
            return Ok(result);
        }

        let user = connection
            .query_opt(
                "SELECT is_active, deleted_at FROM users WHERE id = $1",
                &[&account_id],
            )
            .await
            .context("verify account deletion tombstone")?
            .context("account deletion user tombstone is missing")?;
        let is_active: bool = user.get("is_active");
        let deleted_at: Option<chrono::DateTime<chrono::Utc>> = user.get("deleted_at");
        if is_active || deleted_at.is_none() {
            anyhow::bail!("account deletion tombstone is not active");
        }

        connection
            .execute(
                "UPDATE account_deletion_requests
                 SET status = 'running', started_at = COALESCE(started_at, now()), error_code = NULL
                 WHERE account_id = $1",
                &[&account_id],
            )
            .await
            .context("mark account deletion running")?;

        // Cancel queued account-scoped jobs while preserving their durable rows
        // and outbox deliveries. A delivery that arrives later sees `cancelled`
        // and is acknowledged without executing against deleted data. Running
        // jobs are allowed to finish; deleting underneath one would reintroduce a
        // race between an old worker and the cleanup worker.
        let cancelled_jobs = connection
            .execute(
                "UPDATE async_jobs
                 SET status = 'cancelled', finished_at = now(),
                     error_code = 'account_deleting', lease_owner = NULL, lease_expires_at = NULL
                 WHERE user_id = $1 AND status = 'queued'",
                &[&account_id],
            )
            .await
            .context("cancel queued account jobs")?;
        let running_jobs: i64 = connection
            .query_one(
                "SELECT count(*) FROM async_jobs WHERE user_id = $1 AND status = 'running'",
                &[&account_id],
            )
            .await
            .context("check running account jobs")?
            .get(0);
        if running_jobs > 0 {
            insert_audit_client(
                connection,
                account_id,
                "queue",
                "waiting",
                &json!({
                    "cancelled_queued_jobs": cancelled_jobs,
                    "running_jobs": running_jobs,
                }),
            )
            .await?;
            anyhow::bail!("account deletion waiting for active jobs");
        }
        if cancelled_jobs > 0 {
            insert_audit_client(
                connection,
                account_id,
                "queue",
                "cancelled",
                &json!({ "count": cancelled_jobs }),
            )
            .await?;
        }

        lease.ensure_active()?;
        let object_keys = self.account_object_keys(connection, account_id).await?;
        let object_store = self
            .object_store
            .as_ref()
            .context("account deletion object store is not configured")?;
        for object_key in &object_keys {
            lease.ensure_active()?;
            object_store
                .delete(object_key)
                .await
                .map_err(|error| anyhow!("delete account object: {error}"))?;
        }
        insert_audit_client(
            connection,
            account_id,
            "object_store",
            "purged",
            &json!({ "object_count": object_keys.len() }),
        )
        .await?;

        lease.ensure_active()?;
        if let Some(redis) = &self.redis_presence {
            redis
                .purge_user(account_id)
                .await
                .context("purge account presence cache")?;
        }
        insert_audit_client(
            connection,
            account_id,
            "cache",
            "purged",
            &json!({ "presence_cache": self.redis_presence.is_some() }),
        )
        .await?;

        lease.ensure_active()?;
        let clickhouse = self.purge_clickhouse(account_id).await?;
        insert_audit_client(
            connection,
            account_id,
            "clickhouse",
            "purged",
            &json!({
                "tables": clickhouse.tables,
                "verified_tables": clickhouse.verified_tables,
            }),
        )
        .await?;
        lease.ensure_active()?;

        let tx = connection
            .transaction()
            .await
            .context("start final account deletion transaction")?;
        let running_jobs: i64 = tx
            .query_one(
                "SELECT count(*) FROM async_jobs WHERE user_id = $1 AND status = 'running'",
                &[&account_id],
            )
            .await
            .context("recheck running account jobs")?
            .get(0);
        if running_jobs > 0 {
            tx.rollback().await?;
            anyhow::bail!("account deletion found a concurrent active job");
        }
        // Migration 021 makes these account-scoped rows cascade with the user
        // delete. The explicit identity cleanup documents the privacy boundary
        // and keeps the deletion correct if this transaction is reused with a
        // database that has the legacy constraint shape during migration.
        tx.execute(
            "DELETE FROM ai_usage_ingest_identities WHERE user_id = $1",
            &[&account_id],
        )
        .await
        .context("purge PostgreSQL AI usage identities")?;
        // Serialize the dependency snapshot with workflow writes and restores,
        // so every tombstone emitted by the following DELETE requires export.
        tx.query_one("SELECT pg_advisory_xact_lock(74103031)", &[])
            .await?;
        let team_action_proof = team_action_deletion_required(&tx, account_id).await?;
        tx.execute(
            "DELETE FROM users WHERE id = $1 AND is_active = FALSE AND deleted_at IS NOT NULL",
            &[&account_id],
        )
        .await
        .context("hard-delete PostgreSQL account")?;
        let verification = json!({
            "queued_jobs_cancelled": cancelled_jobs,
            "objects_purged": object_keys.len(),
            "clickhouse_tables": clickhouse.tables,
            "clickhouse_verified_tables": clickhouse.verified_tables,
            "presence_cache_purged": self.redis_presence.is_some(),
        });
        tx.execute(
            "UPDATE account_deletion_requests
             SET postgres_purged_at = now(), team_action_ledger_required=team_action_ledger_required OR $3, verification = $2
             WHERE account_id = $1",
            &[&account_id, &verification, &team_action_proof],
        )
        .await
        .context("checkpoint PostgreSQL deletion awaiting Team proof")?;
        insert_audit(&tx, account_id, "postgres", "purged", &verification).await?;
        tx.commit()
            .await
            .context("commit final account deletion transaction")?;

        lease.ensure_active()?;
        let result = finish_postgres_deletion(
            self.postgres
                .as_ref()
                .context("PostgreSQL unavailable")?
                .clone(),
            connection,
            account_id,
        )
        .await?;
        lease.ensure_active()?;
        Ok(result)
    }

    async fn account_object_keys(
        &self,
        connection: &tokio_postgres::Client,
        account_id: Uuid,
    ) -> Result<BTreeSet<String>> {
        let rows = connection
            .query(
                "SELECT DISTINCT object_key
                 FROM export_artifacts a
                 JOIN export_jobs e ON e.id = a.export_job_id
                 WHERE e.user_id = $1
                 UNION
                 SELECT DISTINCT i.pdf_object_key
                 FROM invoices i
                 JOIN billing_customers c ON c.id = i.billing_customer_id
                 WHERE c.user_id = $1 AND i.pdf_object_key IS NOT NULL",
                &[&account_id],
            )
            .await
            .context("load account object keys")?;
        rows.into_iter()
            .filter_map(|row| row.get::<_, Option<String>>(0))
            .map(|key| {
                if key.is_empty() || key.len() > 1024 || key.starts_with('/') || key.contains("..")
                {
                    Err(anyhow!("account object key is unsafe"))
                } else {
                    Ok(key)
                }
            })
            .collect()
    }

    async fn purge_clickhouse(&self, account_id: Uuid) -> Result<ClickHouseCleanup> {
        let client = self.clickhouse.get_client();
        let database = clickhouse_database_identifier(self.clickhouse.database())?;
        let table_names = CLICKHOUSE_USER_TABLES
            .iter()
            .map(|table| format!("'{table}'"))
            .collect::<Vec<_>>()
            .join(", ");
        let tables = client
            .query(&format!(
                "SELECT DISTINCT c.table, t.engine
                 FROM system.columns c
                 INNER JOIN system.tables t
                   ON t.database = c.database AND t.name = c.table
                 WHERE c.database = currentDatabase()
                   AND c.name = 'user_id'
                   AND t.engine NOT IN ('View', 'MaterializedView')
                   AND c.table IN ({table_names})
                 ORDER BY c.table"
            ))
            .fetch_all::<ClickHouseUserTable>()
            .await
            .context("discover ClickHouse account tables")?;
        let known: BTreeSet<&str> = CLICKHOUSE_USER_TABLES.iter().copied().collect();
        // This query is intentionally broader than the deletion allowlist. A
        // table with user_id that is not known by this worker is a hard failure,
        // not an excuse to delete only the tables we happened to remember.
        let unknown = client
            .query(
                "SELECT DISTINCT c.table
                 FROM system.columns c
                 INNER JOIN system.tables t
                   ON t.database = c.database AND t.name = c.table
                 WHERE c.database = currentDatabase()
                   AND c.name = 'user_id'
                   AND t.engine NOT IN ('View', 'MaterializedView')",
            )
            .fetch_all::<UnknownClickHouseUserTable>()
            .await
            .context("verify ClickHouse account table allowlist")?
            .into_iter()
            .map(|row| row.table)
            .filter(|table| !known.contains(table.as_str()))
            .collect::<Vec<_>>();
        if !unknown.is_empty() {
            anyhow::bail!("ClickHouse account table allowlist is incomplete");
        }

        for table in &tables {
            if table.engine == "Null" {
                // `heartbeats_incoming` is deliberately a Null engine; it has no
                // durable rows to mutate, but remains in the allowlist so a future
                // engine change is caught by the verification query.
                continue;
            }
            client
                .query(&format!(
                    "ALTER TABLE {database}.{} DELETE WHERE user_id = ? SETTINGS mutations_sync = 1",
                    table.table
                ))
                .bind(account_id)
                .execute()
                .await
                .with_context(|| format!("purge ClickHouse account table {}", table.table))?;
        }

        for table in &tables {
            let count: u64 = client
                .query(&format!(
                    "SELECT count() FROM {database}.{} WHERE user_id = ?",
                    table.table
                ))
                .bind(account_id)
                .fetch_one()
                .await
                .with_context(|| format!("verify ClickHouse account table {}", table.table))?;
            if count != 0 {
                anyhow::bail!("ClickHouse account deletion verification failed");
            }
        }
        Ok(ClickHouseCleanup {
            tables: tables.len(),
            verified_tables: tables.len(),
        })
    }

    fn required_postgres(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("account deletion requires PostgreSQL"))
    }
}

fn clickhouse_database_identifier(database: &str) -> Result<String> {
    if database.is_empty()
        || !database
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
    {
        anyhow::bail!("ClickHouse database name contains an unsafe identifier");
    }
    Ok(format!("`{database}`"))
}

fn ensure_job_owns_request(request_job_id: Option<Uuid>, job_id: Uuid) -> Result<()> {
    if request_job_id != Some(job_id) {
        // The account id is carried in the system-job payload, but the
        // tombstone's linked job is the authoritative destructive-operation
        // identity. Never let a duplicate or manually crafted system job
        // execute the cleanup for the account.
        anyhow::bail!("account deletion job does not own the tombstone");
    }
    Ok(())
}

#[derive(Debug, Default, Serialize)]
struct ClickHouseCleanup {
    tables: usize,
    verified_tables: usize,
}

#[derive(Debug, Deserialize, ClickHouseRow)]
struct UnknownClickHouseUserTable {
    table: String,
}

/// Resume after the PostgreSQL commit, including when the user no longer exists.
/// Called under the account activity lock. No transaction stays open during disk
/// export; an export failure keeps the request running and retryable.
pub(crate) async fn team_action_deletion_required(
    tx: &tokio_postgres::Transaction<'_>,
    account_id: Uuid,
) -> Result<bool> {
    Ok(tx.query_one("SELECT EXISTS(SELECT 1 FROM team_action_account_proof_requirements WHERE account_id=$1) OR EXISTS(SELECT 1 FROM team_improvement_actions a WHERE a.owner_id=$1 OR a.created_by=$1 OR a.changed_by=$1) OR EXISTS(SELECT 1 FROM team_improvement_action_history h WHERE h.changed_by=$1 OR h.snapshot->>'owner_id'=$1::uuid::text OR h.snapshot->>'created_by'=$1::uuid::text OR h.snapshot->>'changed_by'=$1::uuid::text)",&[&account_id]).await?.get(0))
}
pub(crate) async fn finish_postgres_deletion(
    postgres: Arc<PostgresClient>,
    connection: &mut deadpool_postgres::ClientWrapper,
    account_id: Uuid,
) -> Result<Value> {
    let row=connection.query_one("SELECT status,postgres_purged_at,team_action_ledger_required,verification FROM account_deletion_requests WHERE account_id=$1",&[&account_id]).await?;
    let status: String = row.get(0);
    if status == "succeeded" {
        return Ok(json!({"deleted":true,"already_completed":true}));
    }
    anyhow::ensure!(
        matches!(status.as_str(), "requested" | "running")
            && row
                .get::<_, Option<chrono::DateTime<chrono::Utc>>>(1)
                .is_some(),
        "PostgreSQL deletion checkpoint required"
    );
    anyhow::ensure!(
        !connection
            .query_one(
                "SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)",
                &[&account_id]
            )
            .await?
            .get::<_, bool>(0),
        "account row still present"
    );
    let required: bool = row.get::<_,bool>(2)||connection.query_one("SELECT EXISTS(SELECT 1 FROM team_action_account_proof_requirements WHERE account_id=$1)",&[&account_id]).await?.get::<_,bool>(0);
    let mut verification: Value = row.get(3);
    if required {
        let path = std::env::var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH")
            .context("Team deletion proof storage unavailable")?;
        crate::repository::team_trust::TeamTrustRepository::new(postgres)
            .export_registry(std::path::Path::new(&path))
            .await
            .context("persist independent Team deletion proof")?;
        verification["team_action_ledger"] = json!("durable");
    }
    let tx = connection.transaction().await?;
    tx.execute("UPDATE account_deletion_requests SET status='succeeded',finished_at=now(),error_code=NULL,verification=$2,team_action_ledger_required=team_action_ledger_required OR $3 WHERE account_id=$1 AND postgres_purged_at IS NOT NULL AND status IN ('requested','running')",&[&account_id,&verification,&required]).await?;
    insert_audit(&tx, account_id, "finalize", "succeeded", &verification).await?;
    tx.commit().await?;
    Ok(
        json!({"deleted":true,"objects_purged":verification.get("objects_purged"),"clickhouse_tables":verification.get("clickhouse_tables")}),
    )
}
async fn existing_job(tx: &tokio_postgres::Transaction<'_>, job_id: Uuid) -> Result<CreatedJob> {
    let row = tx
        .query_one(
            "SELECT id, status FROM async_jobs WHERE id = $1",
            &[&job_id],
        )
        .await
        .context("load existing account deletion job")?;
    let status_raw: String = row.get("status");
    let status = JobStatus::parse(&status_raw)
        .with_context(|| format!("unrecognized account deletion job status: {status_raw}"))?;
    Ok(CreatedJob {
        id: row.get("id"),
        status,
        deduplicated: true,
    })
}

async fn insert_audit<C>(
    client: &C,
    account_id: Uuid,
    stage: &str,
    outcome: &str,
    details: &Value,
) -> Result<()>
where
    C: deadpool_postgres::GenericClient + Sync,
{
    client
        .execute(
            "INSERT INTO account_deletion_audits (account_id, stage, outcome, details)
             VALUES ($1, $2, $3, $4)",
            &[&account_id, &stage, &outcome, details],
        )
        .await
        .context("write account deletion audit")?;
    Ok(())
}

async fn insert_audit_client(
    client: &tokio_postgres::Client,
    account_id: Uuid,
    stage: &str,
    outcome: &str,
    details: &Value,
) -> Result<()> {
    client
        .execute(
            "INSERT INTO account_deletion_audits (account_id, stage, outcome, details)
             VALUES ($1, $2, $3, $4)",
            &[&account_id, &stage, &outcome, details],
        )
        .await
        .context("write account deletion audit")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clickhouse_allowlist_has_no_duplicates_or_unsafe_identifiers() {
        let mut names = BTreeSet::new();
        for table in CLICKHOUSE_USER_TABLES {
            assert!(!table.is_empty());
            assert!(table.as_bytes()[0].is_ascii_lowercase());
            assert!(table
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_'));
            assert!(names.insert(*table), "duplicate table: {table}");
        }
    }

    #[test]
    fn object_key_validation_rejects_absolute_and_parent_paths() {
        for key in ["/exports/a", "exports/../a", ""] {
            assert!(key.is_empty() || key.starts_with('/') || key.contains(".."));
        }
        for key in ["exports/account/artifact.json", "invoices/2026.pdf"] {
            assert!(!key.starts_with('/'));
            assert!(!key.contains(".."));
        }
    }

    #[test]
    fn clickhouse_database_identifier_is_bounded_to_safe_names() {
        assert_eq!(
            clickhouse_database_identifier("wakaclock").unwrap(),
            "`wakaclock`"
        );
        assert!(clickhouse_database_identifier("wakaclock-prod").is_err());
        assert!(clickhouse_database_identifier("wakaclock` DROP TABLE users").is_err());
    }

    #[test]
    fn account_deletion_requires_the_tombstone_job_identity() {
        let job_id = Uuid::now_v7();
        assert!(ensure_job_owns_request(Some(job_id), job_id).is_ok());
        assert!(ensure_job_owns_request(None, job_id).is_err());
        assert!(ensure_job_owns_request(Some(Uuid::now_v7()), job_id).is_err());
    }
}

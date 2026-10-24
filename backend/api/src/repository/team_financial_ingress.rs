//! Account lock precedes billing/job/binding locks. No file lock spans a DB await.
use crate::{
    infrastructure::{postgres::PostgresClient, team_financial_guard::FinancialGuard},
    services::team_financial_ingress::{
        Entry, Event, Head, JobBefore, Notification, Receipt, Scope, MAX_RECEIPTS,
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use std::collections::BTreeMap;
use tokio_postgres::Transaction;
use uuid::Uuid;

pub(crate) async fn lock(tx: &Transaction<'_>, scope: &Scope) -> Result<()> {
    scope.key()?;
    let key = format!("financial-ingress:v1:{}:{}", scope.account, scope.live);
    tx.query_one(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,$2))",
        &[&key, &101_003_i64],
    )
    .await?;
    Ok(())
}
#[derive(Debug, PartialEq)]
struct SqlHead {
    head: Head,
    transition: Option<Uuid>,
}
async fn sql_head(tx: &Transaction<'_>, scope: &Scope) -> Result<SqlHead> {
    let r=tx.query_opt("SELECT schema_version,revision,record_count,root_hash,transition_id FROM team_stripe_ingress_heads WHERE account_id=$1 AND livemode=$2",&[&scope.account,&scope.live]).await?.context("financial_ingress_sql_uninitialized")?;
    Ok(SqlHead {
        head: Head {
            schema: u8::try_from(r.get::<_, i16>(0))?,
            revision: u64::try_from(r.get::<_, i64>(1))?,
            records: u64::try_from(r.get::<_, i64>(2))?,
            hash: r.get(3),
        },
        transition: r.get(4),
    })
}
async fn sql_receipts(tx: &Transaction<'_>, scope: &Scope) -> Result<BTreeMap<String, Receipt>> {
    let rows=tx.query("SELECT event_id,payload_hash,event_kind,event_created,customer_id,subscription_id,invoice_id,requested_revision,received_at,ingress_transition,CASE WHEN pg_column_size(ingress_metadata)<=16384 THEN ingress_metadata ELSE NULL END AS metadata FROM team_stripe_inbox WHERE account_id=$1 AND livemode=$2 LIMIT $3",&[&scope.account,&scope.live,&((MAX_RECEIPTS+1) as i64)]).await?;
    ensure!(rows.len() <= MAX_RECEIPTS, "financial_ingress_limit");
    let mut result = BTreeMap::new();
    for row in rows {
        let value: Option<serde_json::Value> = row.get("metadata");
        let receipt: Receipt =
            serde_json::from_value(value.context("financial_ingress_legacy_or_oversized_row")?)
                .map_err(|_| anyhow::anyhow!("financial_ingress_contract_unsupported"))?;
        receipt.validate()?;
        let n = &receipt.notification;
        ensure!(
            row.get::<_, String>("event_id") == n.event_id
                && row.get::<_, String>("payload_hash") == n.payload_hash
                && row.get::<_, String>("event_kind") == n.kind
                && row.get::<_, DateTime<Utc>>("event_created") == n.created
                && row.get::<_, Option<String>>("customer_id") == n.customer
                && row.get::<_, Option<String>>("subscription_id") == n.subscription
                && row.get::<_, Option<String>>("invoice_id") == n.invoice
                && row.get::<_, Option<i64>>("requested_revision") == receipt.requested_revision
                && row.get::<_, DateTime<Utc>>("received_at") == receipt.received_at
                && row.get::<_, Option<Uuid>>("ingress_transition") == Some(receipt.transition),
            "financial_ingress_sql_receipt_mismatch"
        );
        ensure!(
            result.insert(n.event_id.clone(), receipt).is_none(),
            "financial_ingress_identity_conflict"
        );
    }
    Ok(result)
}
fn independent(guard: &FinancialGuard, scope: &Scope) -> Result<Entry> {
    guard.namespace()?;
    Ok(guard.read()?.snapshot.ingress.entry(scope)?.clone())
}
async fn matches(
    tx: &Transaction<'_>,
    scope: &Scope,
    head: &Head,
    transition: Option<Uuid>,
    receipts: &BTreeMap<String, Receipt>,
) -> Result<()> {
    let sql = sql_head(tx, scope).await?;
    ensure!(
        sql.head == *head && sql.transition == transition,
        "financial_ingress_sql_head_mismatch"
    );
    let actual = sql_receipts(tx, scope).await?;
    ensure!(
        &actual == receipts && Head::inventory(scope, head.revision, &actual)? == *head,
        "financial_ingress_sql_inventory_mismatch"
    );
    Ok(())
}
/// Requires account lock through commit. This is ingress agreement, not payment proof.
pub(crate) async fn ready(
    tx: &Transaction<'_>,
    guard: &FinancialGuard,
    scope: &Scope,
) -> Result<()> {
    let entry = independent(guard, scope)?;
    entry.ready()?;
    matches(
        tx,
        scope,
        &entry.head,
        entry.committed_transition,
        &entry.receipts,
    )
    .await?;
    ensure!(
        independent(guard, scope)? == entry,
        "financial_ingress_changed_during_observation"
    );
    Ok(())
}
async fn job(tx: &Transaction<'_>, scope: &Scope, subscription: &str) -> Result<Option<JobBefore>> {
    Ok(tx.query_opt("SELECT requested_revision,applied_revision FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 FOR UPDATE",&[&scope.account,&scope.live,&subscription]).await?.map(|r|JobBefore{requested:r.get(0),applied:r.get(1)}))
}
async fn write_receipt(tx: &Transaction<'_>, scope: &Scope, receipt: &Receipt) -> Result<()> {
    receipt.validate()?;
    let n = &receipt.notification;
    if n.supported {
        let subscription = n
            .subscription
            .as_ref()
            .context("financial_ingress_subscription_missing")?;
        ensure!(
            job(tx, scope, subscription).await? == receipt.job_before,
            "financial_ingress_job_predecessor_changed"
        );
        let revision = receipt
            .requested_revision
            .context("financial_ingress_revision_missing")?;
        if let Some(before) = &receipt.job_before {
            ensure!(tx.execute("UPDATE team_stripe_reconcile_jobs SET requested_revision=$4 WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND requested_revision=$5 AND applied_revision=$6",&[&scope.account,&scope.live,&subscription,&revision,&before.requested,&before.applied]).await?==1,"financial_ingress_job_predecessor_changed");
        } else {
            tx.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id,requested_revision) VALUES($1,$2,$3,$4)",&[&scope.account,&scope.live,&subscription,&revision]).await?;
        }
    }
    let metadata = serde_json::to_value(receipt)?;
    tx.execute("INSERT INTO team_stripe_inbox(account_id,livemode,event_id,payload_hash,event_kind,event_created,customer_id,subscription_id,invoice_id,requested_revision,disposition,received_at,ingress_metadata,ingress_transition) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",&[&scope.account,&scope.live,&n.event_id,&n.payload_hash,&n.kind,&n.created,&n.customer,&n.subscription,&n.invoice,&receipt.requested_revision,&if n.supported {"pending"}else{"ignored"},&receipt.received_at,&metadata,&receipt.transition]).await?;
    Ok(())
}
async fn advance(
    tx: &Transaction<'_>,
    scope: &Scope,
    expected: &Head,
    next: &Head,
    transition: Uuid,
) -> Result<()> {
    ensure!(tx.execute("UPDATE team_stripe_ingress_heads SET revision=$3,record_count=$4,root_hash=$5,transition_id=$6 WHERE account_id=$1 AND livemode=$2 AND schema_version=$7 AND revision=$8 AND record_count=$9 AND root_hash=$10",&[&scope.account,&scope.live,&i64::try_from(next.revision)?,&i64::try_from(next.records)?,&next.hash,&transition,&i16::from(expected.schema),&i64::try_from(expected.revision)?,&i64::try_from(expected.records)?,&expected.hash]).await?==1,"financial_ingress_sql_head_changed");
    Ok(())
}

/// Replays only the existing independent proposal. Never creates a new event.
pub(super) async fn reconcile_pending(
    tx: &Transaction<'_>,
    scope: &Scope,
    entry: &Entry,
) -> Result<()> {
    entry
        .conflicts
        .is_empty()
        .then_some(())
        .context("financial_ingress_conflict")?;
    let p = entry
        .pending
        .as_ref()
        .context("financial_ingress_pending_missing")?;
    let sql = sql_head(tx, scope).await?;
    let mut next = entry.receipts.clone();
    next.insert(p.receipt.notification.event_id.clone(), p.receipt.clone());
    if sql.head == p.next && sql.transition == Some(p.receipt.transition) {
        matches(tx, scope, &p.next, Some(p.receipt.transition), &next).await?;
    } else {
        matches(
            tx,
            scope,
            &p.expected,
            entry.committed_transition,
            &entry.receipts,
        )
        .await?;
        write_receipt(tx, scope, &p.receipt).await?;
        advance(tx, scope, &p.expected, &p.next, p.receipt.transition).await?;
    }
    Ok(())
}
/// Read-only classification of the exact pending predecessor or committed next.
pub(super) async fn pending_matches(
    tx: &Transaction<'_>,
    scope: &Scope,
    entry: &Entry,
) -> Result<()> {
    ensure!(entry.conflicts.is_empty(), "financial_ingress_conflict");
    let p = entry
        .pending
        .as_ref()
        .context("financial_ingress_pending_missing")?;
    let sql = sql_head(tx, scope).await?;
    if sql.head == p.next && sql.transition == Some(p.receipt.transition) {
        let mut next = entry.receipts.clone();
        next.insert(p.receipt.notification.event_id.clone(), p.receipt.clone());
        matches(tx, scope, &p.next, Some(p.receipt.transition), &next).await
    } else {
        matches(
            tx,
            scope,
            &p.expected,
            entry.committed_transition,
            &entry.receipts,
        )
        .await?;
        if p.receipt.notification.supported {
            ensure!(
                job(
                    tx,
                    scope,
                    p.receipt
                        .notification
                        .subscription
                        .as_ref()
                        .context("financial_ingress_subscription_missing")?
                )
                .await?
                    == p.receipt.job_before,
                "financial_ingress_job_predecessor_changed"
            );
        }
        Ok(())
    }
}

/// Signed metadata only. ACK after SQL and independent durable confirmation.
pub async fn accept(
    pg: &PostgresClient,
    guard: &FinancialGuard,
    scope: &Scope,
    notification: Notification,
) -> Result<super::team_stripe::Acceptance> {
    use super::team_stripe::Acceptance;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    lock(&tx, scope).await?;
    let entry = independent(guard, scope)?;
    let known = entry.receipts.get(&notification.event_id).or_else(|| {
        entry
            .pending
            .as_ref()
            .map(|p| &p.receipt)
            .filter(|r| r.notification.event_id == notification.event_id)
    });
    if let Some(prior) = known {
        if prior.notification != notification {
            guard.record_ingress(Event::Conflict {
                scope: scope.clone(),
                notification,
            })?;
            anyhow::bail!("financial_ingress_identity_conflict");
        }
    }
    ensure!(entry.conflicts.is_empty(), "financial_ingress_conflict");
    if let Some(p) = &entry.pending {
        ensure!(
            p.receipt.notification == notification,
            "financial_ingress_reconciliation_required"
        );
        reconcile_pending(&tx, scope, &entry).await?;
        ensure!(
            independent(guard, scope)? == entry,
            "financial_ingress_changed_before_commit"
        );
        tx.commit().await?;
        guard.record_ingress(Event::Confirm {
            scope: scope.clone(),
            transition: p.receipt.transition,
            head: p.next.clone(),
            review: None,
        })?;
        return Ok(Acceptance::Duplicate);
    }
    ready(&tx, guard, scope).await?;
    if entry.receipts.contains_key(&notification.event_id) {
        tx.commit().await?;
        return Ok(Acceptance::Duplicate);
    }
    let job_before = if notification.supported {
        job(
            &tx,
            scope,
            notification
                .subscription
                .as_ref()
                .context("financial_ingress_subscription_missing")?,
        )
        .await?
    } else {
        None
    };
    let requested_revision = if notification.supported {
        Some(job_before.as_ref().map_or(Ok(1), |j| {
            j.requested
                .checked_add(1)
                .context("financial_ingress_revision_overflow")
        })?)
    } else {
        None
    };
    let received_at: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    let receipt = Receipt {
        notification,
        received_at,
        requested_revision,
        job_before,
        transition: Uuid::now_v7(),
    };
    let proposal = entry.propose(receipt)?;
    write_receipt(&tx, scope, &proposal.receipt).await?;
    advance(
        &tx,
        scope,
        &proposal.expected,
        &proposal.next,
        proposal.receipt.transition,
    )
    .await?;
    // SQL rows remain uncommitted while the independent intent is flushed.
    guard.record_ingress(Event::Prepare {
        scope: scope.clone(),
        proposal: proposal.clone(),
    })?;
    let mut expected = entry;
    expected.used_transitions.insert(
        proposal.receipt.transition,
        crate::services::team_financial_guard::fingerprint(&proposal.receipt)?,
    );
    expected.pending = Some(proposal.clone());
    ensure!(
        independent(guard, scope)? == expected,
        "financial_ingress_changed_before_commit"
    );
    tx.commit().await?;
    guard.record_ingress(Event::Confirm {
        scope: scope.clone(),
        transition: proposal.receipt.transition,
        head: proposal.next,
        review: None,
    })?;
    Ok(Acceptance::Accepted)
}

/// Read-only operator projection. Even a verified ingress is not payment/source
/// authorization. No implicit reviewed baseline is created on missing evidence.
pub async fn diagnostic(
    pg: &PostgresClient,
    guard: &FinancialGuard,
    scope: &Scope,
) -> Result<serde_json::Value> {
    scope.key()?;
    guard.namespace()?;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    lock(&tx, scope).await?;
    let state = guard.read()?;
    let entry = state.snapshot.ingress.accounts.get(&scope.key()?);
    let mut status = "uninitialized";
    if state
        .snapshot
        .ingress
        .bootstraps
        .contains_key(&scope.key()?)
    {
        status = "bootstrap_reconciliation_required";
    }
    if let Some(entry) = entry {
        status = if !entry.conflicts.is_empty() {
            "conflict"
        } else if entry.pending.is_some() {
            "reconciliation_required"
        } else {
            let verified =
                ready(&tx, guard, scope).await.is_ok() && independent(guard, scope)? == *entry;
            if verified {
                "ingress_verified_only"
            } else {
                "unconfirmed"
            }
        };
    }
    tx.commit().await?;
    Ok(
        serde_json::json!({"status":status,"receipts":entry.map_or(0,|e|e.receipts.len()),"financial_sources":"unconfirmed","product_authorization_enabled":false,"production_ready":false}),
    )
}

#[cfg(test)]
pub(crate) async fn seed_empty_fixture(
    pg: &PostgresClient,
    guard: &FinancialGuard,
    scope: &Scope,
) -> Result<()> {
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    lock(&tx, scope).await?;
    ensure!(
        tx.query_one(
            "SELECT count(*) FROM team_stripe_inbox WHERE account_id=$1 AND livemode=$2",
            &[&scope.account, &scope.live]
        )
        .await?
        .get::<_, i64>(0)
            == 0,
        "fixture_inbox_not_empty"
    );
    guard.record_ingress(Event::Seed {
        scope: scope.clone(),
        receipts: vec![],
        review: Uuid::now_v7(),
        review_hash: "a".repeat(64),
    })?;
    let entry = independent(guard, scope)?;
    tx.execute("INSERT INTO team_stripe_ingress_heads(account_id,livemode,schema_version,revision,record_count,root_hash) VALUES($1,$2,1,1,0,$3)",&[&scope.account,&scope.live,&entry.head.hash]).await?;
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
#[path = "team_financial_ingress_tests.rs"]
mod tests;

//! Explicit local operator workflow, never called by HTTP/startup or Stripe retry.
use super::team_financial_ingress as ingress;
use crate::{
    infrastructure::{postgres::PostgresClient, team_financial_guard::FinancialGuard},
    services::{
        team_financial_guard::fingerprint,
        team_financial_ingress::{Bootstrap, Event, Head, OperatorReview, ReviewKind, Scope},
        team_financial_recovery::{Action, Approval, Body, Counts, Plan, Reason},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use std::collections::BTreeMap;
use tokio_postgres::Transaction;
use uuid::Uuid;

// A rare explicit review may briefly block financial writes across accounts.
// This prevents an empty observation racing with an unguarded legacy writer.
// No provider call/file lock is held while waiting. Deadlock/timeout aborts safely.
async fn fence_writers(tx: &Transaction<'_>) -> Result<()> {
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'; SET LOCAL TIME ZONE 'UTC'; LOCK TABLE billing_customers,team_stripe_customer_operations,team_stripe_customer_authorizations,team_stripe_quotes,team_stripe_checkout_intents,team_stripe_checkout_authorizations,team_stripe_bindings,team_stripe_snapshots,team_financial_source_heads,team_financial_source_tombstones,team_stripe_ingress_heads,team_stripe_inbox,team_stripe_reconcile_jobs IN SHARE MODE").await?;
    Ok(())
}
struct Observation {
    sql: String,
    instance: String,
    counts: Counts,
    head: Option<Value>,
}
async fn observe(
    tx: &Transaction<'_>,
    scope: &Scope,
    independent_sources: u64,
) -> Result<Observation> {
    // One MVCC statement. Immutable ingress metadata only; processing status,
    // retry/lease clocks and credentials are not returned or part of agreement.
    let row=tx.query_one(r#"
WITH inbox AS (SELECT event_id,payload_hash,event_kind,extract(epoch FROM event_created)*1000000 AS created_us,customer_id,subscription_id,invoice_id,requested_revision,extract(epoch FROM received_at)*1000000 AS received_us,ingress_transition,ingress_metadata FROM team_stripe_inbox WHERE account_id=$1 AND livemode=$2 ORDER BY event_id LIMIT 10001),
jobs AS (SELECT subscription_id,requested_revision,applied_revision FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND livemode=$2 ORDER BY subscription_id LIMIT 10001),
head AS (SELECT schema_version,revision,record_count,root_hash,transition_id FROM team_stripe_ingress_heads WHERE account_id=$1 AND livemode=$2),
objects AS (SELECT
 (SELECT count(*) FROM team_stripe_customer_operations WHERE account_id=$1 AND livemode=$2)+
 (SELECT count(*) FROM team_stripe_quotes WHERE account_id=$1 AND livemode=$2)+
 (SELECT count(*) FROM team_stripe_checkout_intents WHERE account_id=$1 AND livemode=$2)+
 (SELECT count(*) FROM team_stripe_bindings WHERE account_id=$1 AND livemode=$2)+
 (SELECT count(*) FROM team_stripe_snapshots s JOIN team_stripe_bindings b ON b.organization_id=s.organization_id WHERE b.account_id=$1 AND b.livemode=$2)+
 (SELECT count(*) FROM team_financial_source_heads WHERE account_id=$1 AND livemode=$2)+
 (SELECT count(*) FROM team_financial_source_tombstones WHERE account_id=$1 AND livemode=$2) AS n),
legacy AS (SELECT EXISTS(SELECT 1 FROM billing_customers WHERE provider='stripe') OR EXISTS(SELECT 1 FROM team_stripe_snapshots s WHERE NOT EXISTS(SELECT 1 FROM team_stripe_bindings b WHERE b.organization_id=s.organization_id)) AS unknown),
sizes AS (SELECT (SELECT count(*) FROM inbox) AS ni,(SELECT count(*) FROM jobs) AS nj,(SELECT coalesce(sum(pg_column_size(i)),0) FROM inbox i)+(SELECT coalesce(sum(pg_column_size(j)),0) FROM jobs j) AS bytes)
SELECT jsonb_build_object('head',(SELECT to_jsonb(h) FROM head h),'financial_objects',o.n,'legacy',l.unknown,'inbox',CASE WHEN s.ni<=10000 AND s.bytes<=8388608 THEN (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY event_id),'[]'::jsonb) FROM inbox i) ELSE 'null'::jsonb END,'jobs',CASE WHEN s.nj<=10000 THEN (SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY subscription_id),'[]'::jsonb) FROM jobs j) ELSE 'null'::jsonb END),
 jsonb_build_array(current_database(),current_user,current_schema(),inet_server_addr()::text,inet_server_port(),extract(epoch FROM pg_postmaster_start_time())::text),s.ni,s.nj,o.n,l.unknown,s.bytes
FROM objects o CROSS JOIN legacy l CROSS JOIN sizes s
"#,&[&scope.account,&scope.live]).await?;
    let ni: i64 = row.get(2);
    let nj: i64 = row.get(3);
    let bytes: i64 = row.get(6);
    ensure!(
        ni <= 10000 && nj <= 10000 && bytes <= 8388608,
        "financial_recovery_inventory_limit"
    );
    let data: Value = row.get(0);
    let instance: Value = row.get(1);
    Ok(Observation {
        sql: fingerprint(&data)?,
        instance: fingerprint(&instance)?,
        counts: Counts {
            inbox: u64::try_from(ni)?,
            jobs: u64::try_from(nj)?,
            financial_objects: u64::try_from(row.get::<_, i64>(4))?,
            legacy_scope_unconfirmed: row.get(5),
            independent_sources,
        },
        head: data.get("head").filter(|h| !h.is_null()).cloned(),
    })
}
fn snapshot_fence(
    s: &crate::services::team_financial_guard::Snapshot,
    scope: &Scope,
) -> Result<(String, u64)> {
    let key = scope.key()?;
    let sources: Vec<_> = s
        .sources
        .scopes
        .values()
        .filter(|e| e.scope.account == scope.account && e.scope.live == scope.live)
        .collect();
    Ok((
        fingerprint(&(
            s.namespace,
            scope,
            s.ingress.accounts.get(&key),
            s.ingress.bootstraps.get(&key),
            &sources,
        ))?,
        sources.len() as u64,
    ))
}
fn account_fence(guard: &FinancialGuard, scope: &Scope) -> Result<(String, u64)> {
    snapshot_fence(&guard.read()?.snapshot, scope)
}
fn empty_head_matches(o: &Observation, scope: &Scope, target: Uuid) -> Result<bool> {
    let h = Head::inventory(scope, 1, &BTreeMap::new())?;
    Ok(o.head
        == Some(
            serde_json::json!({"schema_version":1,"revision":1,"record_count":0,"root_hash":h.hash,"transition_id":target}),
        ))
}
async fn classify(
    tx: &Transaction<'_>,
    guard: &FinancialGuard,
    scope: &Scope,
    o: &Observation,
) -> Result<Action> {
    let state = guard.read()?;
    let key = scope.key()?;
    if let Some(b) = state.snapshot.ingress.bootstraps.get(&key) {
        return Ok(
            if o.counts.empty_for_bootstrap()
                && (o.head.is_none() || empty_head_matches(o, scope, b.plan)?)
            {
                Action::ResumeBootstrap { target: b.plan }
            } else {
                Action::Blocked {
                    reason: Reason::PendingStateMismatch,
                }
            },
        );
    }
    let Some(e) = state.snapshot.ingress.accounts.get(&key) else {
        return Ok(if o.counts.empty_for_bootstrap() && o.head.is_none() {
            Action::ProspectiveBootstrap
        } else {
            Action::Blocked {
                reason: Reason::HistoricalEvidenceRequired,
            }
        });
    };
    if !e.conflicts.is_empty() {
        return Ok(Action::Blocked {
            reason: Reason::Conflict,
        });
    }
    if let Some(p) = &e.pending {
        return Ok(if ingress::pending_matches(tx, scope, e).await.is_ok() {
            Action::ResolvePendingReceipt {
                target: p.receipt.transition,
            }
        } else {
            Action::Blocked {
                reason: Reason::PendingStateMismatch,
            }
        });
    }
    Ok(if ingress::ready(tx, guard, scope).await.is_ok() {
        Action::NoChange
    } else {
        Action::Blocked {
            reason: Reason::CommittedSqlMismatch,
        }
    })
}
async fn clock(tx: &Transaction<'_>) -> Result<DateTime<Utc>> {
    Ok(tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0))
}

pub async fn prepare(
    pg: &PostgresClient,
    guard: &FinancialGuard,
    scope: &Scope,
    evidence_hash: &str,
) -> Result<Plan> {
    ensure!(
        crate::services::team_financial_recovery::digest(evidence_hash),
        "financial_recovery_evidence_hash_required"
    );
    let namespace = guard.namespace()?;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    ingress::lock(&tx, scope).await?;
    fence_writers(&tx).await?;
    let (account, nsources) = account_fence(guard, scope)?;
    let o = observe(&tx, scope, nsources).await?;
    let action = classify(&tx, guard, scope, &o).await?;
    ensure!(
        account_fence(guard, scope)?.0 == account,
        "financial_recovery_evidence_changed"
    );
    let now = clock(&tx).await?;
    let p = Plan::new(Body {
        schema: 1,
        id: Uuid::now_v7(),
        namespace,
        scope: scope.clone(),
        prepared_at: now,
        expires_at: now + Duration::minutes(15),
        evidence_hash: evidence_hash.into(),
        account_fence: account,
        sql_fence: o.sql,
        instance: o.instance,
        counts: o.counts,
        action,
    })?;
    tx.commit().await?;
    Ok(p)
}
/// Only an explicit local command calls this. Never infers an old baseline.
pub async fn apply(
    pg: &PostgresClient,
    guard: &FinancialGuard,
    plan: &Plan,
    approval: &Approval,
) -> Result<Value> {
    approval.check(plan)?;
    ensure!(
        guard.namespace()? == plan.namespace(),
        "financial_recovery_namespace_mismatch"
    );
    let scope = plan.scope();
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    ingress::lock(&tx, scope).await?;
    fence_writers(&tx).await?;
    let state = guard.read()?;
    if let Some(known) = state.snapshot.ingress.operator_reviews.get(&plan.body.id) {
        ensure!(
            known.scope == *scope
                && known.digest == plan.digest
                && known.evidence_hash == plan.body.evidence_hash,
            "financial_recovery_review_conflict"
        );
        ingress::ready(&tx, guard, scope).await?;
        tx.commit().await?;
        return Ok(
            serde_json::json!({"status":"already_applied","product_authorization_enabled":false}),
        );
    }
    plan.current_at(clock(&tx).await?)?;
    let (account, n) = account_fence(guard, scope)?;
    let o = observe(&tx, scope, n).await?;
    ensure!(
        account == plan.body.account_fence
            && o.sql == plan.body.sql_fence
            && o.instance == plan.body.instance
            && o.counts == plan.body.counts,
        "financial_recovery_plan_stale_prepare_again"
    );
    ensure!(
        classify(&tx, guard, scope, &o).await? == plan.body.action,
        "financial_recovery_action_changed"
    );
    let now = clock(&tx).await?;
    plan.current_at(now)?;
    let (target, kind) = match plan.body.action {
        Action::ProspectiveBootstrap => (plan.body.id, ReviewKind::Bootstrap),
        Action::ResumeBootstrap { target } => (target, ReviewKind::BootstrapRecovery),
        Action::ResolvePendingReceipt { target } => (target, ReviewKind::PendingReceipt),
        _ => anyhow::bail!("financial_recovery_plan_not_applicable"),
    };
    let review = OperatorReview {
        id: plan.body.id,
        scope: scope.clone(),
        kind: kind.clone(),
        target,
        digest: plan.digest.clone(),
        evidence_hash: plan.body.evidence_hash.clone(),
        reviewed_at: now,
    };
    ensure!(
        snapshot_fence(&state.snapshot, scope)?.0 == account,
        "financial_recovery_evidence_changed"
    );
    let mut expected_snapshot = state.snapshot.clone();
    let confirmation = if kind == ReviewKind::PendingReceipt {
        let entry = state.snapshot.ingress.entry(scope)?;
        let p = entry
            .pending
            .as_ref()
            .context("financial_recovery_pending_missing")?;
        ensure!(
            p.receipt.transition == target,
            "financial_recovery_pending_changed"
        );
        ingress::reconcile_pending(&tx, scope, entry).await?;
        Event::Confirm {
            scope: scope.clone(),
            transition: target,
            head: p.next.clone(),
            review: Some(review),
        }
    } else {
        let b = if kind == ReviewKind::Bootstrap {
            Bootstrap {
                plan: target,
                digest: plan.digest.clone(),
                evidence_hash: plan.body.evidence_hash.clone(),
                coverage_started_at: now,
            }
        } else {
            state
                .snapshot
                .ingress
                .bootstraps
                .get(&scope.key()?)
                .context("financial_recovery_bootstrap_missing")?
                .clone()
        };
        let head = Head::inventory(scope, 1, &BTreeMap::new())?;
        if o.head.is_none() {
            tx.execute("INSERT INTO team_stripe_ingress_heads(account_id,livemode,schema_version,revision,record_count,root_hash,transition_id) VALUES($1,$2,1,1,0,$3,$4)",&[&scope.account,&scope.live,&head.hash,&target]).await?;
        }
        plan.current_at(clock(&tx).await?)?;
        if kind == ReviewKind::Bootstrap {
            let prepare = Event::PrepareBootstrap {
                scope: scope.clone(),
                bootstrap: b,
            };
            expected_snapshot.ingress.apply(&prepare)?;
            guard.record_ingress(prepare)?;
            #[cfg(test)]
            {
                let delay = guard.take_prepare_delay_ms();
                if delay > 0 {
                    tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                }
            }
        }
        Event::ConfirmBootstrap {
            scope: scope.clone(),
            bootstrap: target,
            review,
        }
    };
    // If intent was written before expiry but COMMIT/response is delayed, retain
    // that exact pending operation for a newly reviewed recovery; never reseed.
    plan.current_at(clock(&tx).await?)?;
    ensure!(
        account_fence(guard, scope)?.0 == snapshot_fence(&expected_snapshot, scope)?.0,
        "financial_recovery_evidence_changed"
    );
    tx.commit().await?;
    guard.record_ingress(confirmation)?;
    Ok(
        serde_json::json!({"status":"applied_ingress_only","financial_sources":"unconfirmed","product_authorization_enabled":false,"prospective_only":true}),
    )
}

#[cfg(test)]
#[path = "team_financial_recovery_tests.rs"]
mod tests;

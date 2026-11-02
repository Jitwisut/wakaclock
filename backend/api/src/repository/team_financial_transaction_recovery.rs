//! Reviewed confirmation of retained typed writers whose SQL next-state already
//! exists. This path issues no provider request, SQL replay, baseline or grant.
use super::{
    team_financial_ingress as ingress, team_financial_recovery as recovery,
    team_financial_transaction as coordinator,
};
use crate::{
    infrastructure::{postgres::PostgresClient, team_financial_guard::FinancialGuard},
    services::{
        team_financial_guard::fingerprint,
        team_financial_ingress::Scope,
        team_financial_recovery::{Action, Approval, Body, Plan},
        team_financial_transaction::{self as protocol, Entry, Event, OperatorReview},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::Duration;
use serde_json::{json, Value};
use uuid::Uuid;

async fn lock(tx: &deadpool_postgres::Transaction<'_>, scope: &Scope) -> Result<()> {
    // Apply timeouts before waiting for the account lock, not only table locks.
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    ingress::lock(tx, scope).await?;
    recovery::fence_writers(tx).await
}
fn pending(guard: &FinancialGuard, scope: &Scope) -> Result<Entry> {
    guard
        .read()?
        .snapshot
        .transactions
        .groups
        .values()
        .find(|g| !g.committed && g.proposal.account == *scope)
        .cloned()
        .context("financial_transaction_reconciliation_required")
}
fn sql_fence(observed: &recovery::Observation, entry: &Entry) -> Result<String> {
    fingerprint(&(
        "committed_transaction_readback_v1",
        &observed.sql,
        &entry.proposal_hash,
    ))
}
fn source_count(guard: &FinancialGuard, scope: &Scope) -> Result<u64> {
    Ok(u64::try_from(
        guard
            .read()?
            .snapshot
            .sources
            .scopes
            .values()
            .filter(|s| s.scope.account == scope.account && s.scope.live == scope.live)
            .count(),
    )?)
}

/// Prepare is read-only apart from lock acquisition. A predecessor/missing row,
/// ambiguous state, unsupported untyped writer, or conflict produces no plan.
/// The supplied review digest is a reference, never a freshness attestation.
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
    scope.key()?;
    let namespace = guard.namespace()?;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    lock(&tx, scope).await?;
    let known = pending(guard, scope)?;
    let writer = known
        .proposal
        .writer
        .as_ref()
        .context("financial_transaction_typed_writer_required")?;
    let (checked, account_fence) =
        coordinator::readback_writer(&tx, guard, scope, Some(writer)).await?;
    ensure!(checked == known, "financial_recovery_transaction_changed");
    let observed = recovery::observe(&tx, scope, source_count(guard, scope)?).await?;
    let now = recovery::clock(&tx).await?;
    let plan = Plan::new(Body {
        schema: 1,
        id: Uuid::now_v7(),
        namespace,
        scope: scope.clone(),
        prepared_at: now,
        expires_at: now + Duration::minutes(15),
        evidence_hash: evidence_hash.into(),
        account_fence: account_fence.clone(),
        sql_fence: sql_fence(&observed, &known)?,
        instance: observed.instance,
        counts: observed.counts,
        action: Action::ConfirmCommittedTransaction {
            target: known.proposal.id,
            proposal_hash: known.proposal_hash.clone(),
        },
    })?;
    recheck(guard, &known, &account_fence)?;
    tx.commit().await?;
    Ok(plan)
}

fn recheck(guard: &FinancialGuard, known: &Entry, expected: &str) -> Result<()> {
    let state = guard.read()?.snapshot;
    let organizations = known
        .proposal
        .sources
        .iter()
        .map(|s| s.scope.organization)
        .collect::<Vec<_>>();
    ensure!(
        state.transactions.groups.get(&known.proposal.id) == Some(known)
            && protocol::observation_hash(&state, &known.proposal.account, &organizations)?
                == expected,
        "financial_recovery_plan_stale_prepare_again"
    );
    Ok(())
}

/// The only mutation is a single fsynced ConfirmReviewed frame after successful
/// read-only SQL commit. Crash before that append keeps the original intent;
/// exact Apply retry never replays SQL or overwrites newer financial work.
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
    let Action::ConfirmCommittedTransaction {
        target,
        proposal_hash,
    } = &plan.body.action
    else {
        anyhow::bail!("financial_recovery_transaction_plan_required");
    };
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    lock(&tx, plan.scope()).await?;
    let known = guard
        .read()?
        .snapshot
        .transactions
        .groups
        .get(target)
        .cloned()
        .context("financial_transaction_unknown")?;
    ensure!(
        known.proposal.account == *plan.scope() && known.proposal_hash == *proposal_hash,
        "financial_recovery_transaction_changed"
    );
    if known.committed {
        let review = known
            .operator_review
            .as_ref()
            .context("financial_recovery_already_confirmed_prepare_again")?;
        ensure!(
            review.id == plan.body.id
                && review.plan_digest == plan.digest
                && review.evidence_hash == plan.body.evidence_hash,
            "financial_recovery_review_conflict"
        );
        tx.commit().await?;
        return Ok(summary("already_recorded"));
    }
    plan.current_at(recovery::clock(&tx).await?)?;
    let writer = known
        .proposal
        .writer
        .as_ref()
        .context("financial_transaction_typed_writer_required")?;
    let (checked, account_fence) =
        coordinator::readback_writer(&tx, guard, plan.scope(), Some(writer)).await?;
    let observed = recovery::observe(&tx, plan.scope(), source_count(guard, plan.scope())?).await?;
    ensure!(
        checked == known
            && account_fence == plan.body.account_fence
            && sql_fence(&observed, &known)? == plan.body.sql_fence
            && observed.instance == plan.body.instance
            && observed.counts == plan.body.counts,
        "financial_recovery_plan_stale_prepare_again"
    );
    let now = recovery::clock(&tx).await?;
    plan.current_at(now)?;
    recheck(guard, &known, &account_fence)?;
    tx.commit()
        .await
        .map_err(|_| anyhow::anyhow!("financial_transaction_commit_reconciliation_required"))?;
    guard.record_reviewed_transaction(
        Event::ConfirmReviewed {
            transaction: *target,
            proposal_hash: proposal_hash.clone(),
            review: OperatorReview {
                id: plan.body.id,
                plan_digest: plan.digest.clone(),
                evidence_hash: plan.body.evidence_hash.clone(),
                reviewed_at: now,
                expires_at: plan.body.expires_at,
            },
        },
        &account_fence,
    )?;
    Ok(summary("confirmed_committed_sql"))
}

fn summary(status: &str) -> Value {
    json!({"status":status,"scope":"historical_exact_next_confirmation_only",
        "sql_replayed":false,"provider_request_sent":false,"independent_restore_freshness":"unconfirmed",
        "product_authorization_enabled":false,"production_ready":false})
}

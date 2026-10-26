//! Common lock order for financial facts. Serialization is not authorization.
use crate::services::team_financial_ingress::Scope;
use anyhow::Result;
use tokio_postgres::Transaction;
use uuid::Uuid;

/// Acquire before any tenant/operation/owner row. Never acquire after a row lock
/// while waiting on a different account; callers must resolve candidate scope first.
pub(super) async fn account(tx: &Transaction<'_>, account: &str, live: bool) -> Result<()> {
    super::team_financial_ingress::lock(
        tx,
        &Scope {
            account: account.into(),
            live,
        },
    )
    .await
}
/// Account -> organization billing -> owner/scope -> semantic row -> fresh clock.
/// Does not prove enrollment, payment, provider identity, consent or source roots.
pub(super) async fn organization(
    tx: &Transaction<'_>,
    account_id: &str,
    live: bool,
    org: Uuid,
) -> Result<()> {
    account(tx, account_id, live).await?;
    super::team_seats::lock(tx, org).await
}

#[cfg(test)]
#[path = "team_financial_locks_tests.rs"]
mod tests;

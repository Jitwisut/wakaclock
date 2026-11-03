//! Admission capacity from accepted purchase terms. Never grants paid analytics access.
use crate::services::organizations::OrganizationRequestError;
use anyhow::{ensure, Result};
use tokio_postgres::Transaction;
use uuid::Uuid;

/// Acquire before membership/invite/Checkout row locks; retained until commit.
pub async fn lock(tx: &Transaction<'_>, org: Uuid) -> Result<()> {
    tx.query_one(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        &[&format!("team-billing:{org}")],
    )
    .await?;
    Ok(())
}
pub(crate) async fn try_lock(tx: &Transaction<'_>, org: Uuid) -> Result<bool> {
    Ok(tx
        .query_one(
            "SELECT pg_try_advisory_xact_lock(hashtextextended($1,0))",
            &[&format!("team-billing:{org}")],
        )
        .await?
        .get(0))
}

/// Caller holds `lock`. Invitations reserve no seat until accepted. Inactive user
/// accounts retain their membership seat until explicitly removed/deactivated.
pub async fn admit(
    tx: &Transaction<'_>,
    org: Uuid,
    user: Uuid,
    role: &str,
    seat: &str,
) -> Result<()> {
    if role == "owner" {
        tx.query_opt(
            "SELECT id FROM users WHERE id=$1 AND is_active AND deleted_at IS NULL FOR SHARE",
            &[&user],
        )
        .await?
        .ok_or(OrganizationRequestError::Conflict(
            "an active account is required for ownership",
        ))?;
    }
    if role == "viewer" || seat != "developer" {
        return Ok(());
    }
    // A retained active developer is not a new seat. Authorization for any
    // role change belongs to the caller; this never grants analytics access.
    if tx.query_opt("SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND deactivated_at IS NULL AND role<>'viewer' AND seat_type='developer'", &[&org,&user]).await?.is_some() {
        return Ok(());
    }
    let observation =
        crate::infrastructure::team_financial_guard::FinancialObservation::from_environment()?;
    let state = super::team_analytics_entitlement::load(tx, org).await?;
    if state.is_some() {
        observation.require_enrolled()?;
    }
    let before = if let Some(guard) = observation.guard() {
        let read = guard.read()?;
        if state.is_none()
            && !read.snapshot.organizations.contains_key(&org)
            && role == "owner"
            && fresh_personal_owner(tx, org, user, &read.snapshot).await?
        {
            // No new baseline/roster entry is created. Ordinary financial/Team
            // work on this unknown scope still requires separate enrollment.
            ensure!(
                unregistered_scope(&guard.read()?.snapshot, org)?
                    == unregistered_scope(&read.snapshot, org)?,
                "financial_scope_changed_during_personal_creation"
            );
            return Ok(());
        }
        super::team_organization_birth::verify_retained(tx, org, &read).await?;
        read.snapshot.verify(org, state.as_ref())?;
        Some(read.organization_token(org)?)
    } else {
        None
    };
    ensure!(
        state.is_none() || before.is_some(),
        "financial_guard_required_for_enrolled_organization"
    );
    let checkout = tx.query_opt("SELECT q.package_seats FROM team_stripe_checkout_intents c JOIN team_stripe_quotes q ON q.id=c.quote_id AND q.organization_id=c.organization_id AND q.account_id=c.account_id AND q.livemode=c.livemode WHERE c.organization_id=$1 AND c.disposition<>'expired'", &[&org]).await?;
    // Trial expiry stops new analytics; it does not turn member capacity into
    // unlimited seats. A later paid package change must update canonical terms.
    let cap = combined_capacity(
        checkout.map(|r| r.get(0)),
        state.as_ref().map(|s| s.package_seats),
    )?;
    let Some(cap) = cap else {
        return Ok(());
    }; // Pre-commercial organizations unchanged.
    let occupied: i64 = tx.query_one("SELECT count(*) FROM organization_members WHERE organization_id=$1 AND user_id<>$2 AND deactivated_at IS NULL AND seat_type='developer' AND role<>'viewer'", &[&org,&user]).await?.get(0);
    if let Some(guard) = observation.guard() {
        ensure!(
            Some(guard.read()?.organization_token(org)?) == before,
            "financial_guard_changed_during_seat_admission"
        );
    }
    if occupied >= i64::from(cap) {
        return Err(OrganizationRequestError::Invalid(
            "developer seats full; remove a developer or change the package",
        )
        .into());
    }
    Ok(())
}

fn unregistered_scope(
    state: &crate::services::team_financial_guard::Snapshot,
    org: Uuid,
) -> Result<String> {
    ensure!(
        state.namespace.is_some()
            && !state.organizations.contains_key(&org)
            && !state
                .sources
                .scopes
                .values()
                .any(|s| s.scope.organization == org)
            && !state.transactions.groups.values().any(|g| g
                .proposal
                .sources
                .iter()
                .any(|s| s.scope.organization == org)
                || g.proposal.enrollments.iter().any(|e| e.organization == org)),
        "financial_personal_scope_history_unconfirmed"
    );
    crate::services::team_financial_guard::fingerprint(&(
        "fresh_personal_owner_seat_v1",
        state.namespace,
        org,
    ))
}
async fn fresh_personal_owner(
    tx: &Transaction<'_>,
    org: Uuid,
    user: Uuid,
    independent: &crate::services::team_financial_guard::Snapshot,
) -> Result<bool> {
    unregistered_scope(independent, org)?;
    // xmin alone also matches UPDATEs. Live creation paths never update
    // organizations.created_at; require both its original transaction timestamp
    // and current row-version XID. Cast xid8 to xid explicitly for wraparound.
    // This is narrowly the first owner seat in a newly inserted personal org,
    // not a missing-entitlement or arbitrary new-organization fallback.
    Ok(tx
        .query_one(
            r#"SELECT EXISTS(SELECT 1 FROM organizations o
      WHERE o.id=$1 AND o.personal_owner_id=$2 AND o.deleted_at IS NULL
        AND o.created_at=transaction_timestamp() AND o.xmin=pg_current_xact_id()::xid
        AND NOT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM team_rollouts WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM team_analytics_entitlement_history WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM team_stripe_customer_operations WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM team_stripe_quotes WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM team_stripe_checkout_intents WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM team_stripe_bindings WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM team_stripe_snapshots WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM billing_customers WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM team_financial_source_heads WHERE organization_id=$1)
        AND NOT EXISTS(SELECT 1 FROM team_financial_source_tombstones WHERE organization_id=$1))"#,
            &[&org, &user],
        )
        .await?
        .get(0))
}

fn combined_capacity(checkout: Option<i32>, enrollment: Option<i32>) -> Result<Option<i32>> {
    for cap in [checkout, enrollment].into_iter().flatten() {
        ensure!(
            crate::services::team_billing::PACKAGES
                .iter()
                .any(|n| i32::from(*n) == cap),
            "seat_capacity_unconfirmed"
        );
    }
    Ok(match (checkout, enrollment) {
        (Some(a), Some(b)) => Some(a.min(b)),
        (Some(a), None) | (None, Some(a)) => Some(a),
        (None, None) => None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn trial_capacity_never_disappears_when_there_is_no_checkout_or_time_window() {
        assert_eq!(combined_capacity(None, None).unwrap(), None);
        assert_eq!(combined_capacity(Some(25), None).unwrap(), Some(25));
        assert_eq!(combined_capacity(None, Some(10)).unwrap(), Some(10));
        assert_eq!(combined_capacity(Some(25), Some(10)).unwrap(), Some(10));
        assert_eq!(combined_capacity(Some(10), Some(25)).unwrap(), Some(10));
        assert!(combined_capacity(None, Some(11)).is_err());
    }
}

//! Admission capacity from accepted purchase terms. Never grants paid analytics access.
use crate::services::organizations::OrganizationRequestError;
use anyhow::Result;
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
/// Caller holds `lock`. Invitations reserve no seat until accepted. Inactive user
/// accounts retain their membership seat until explicitly removed/deactivated.
pub async fn admit(
    tx: &Transaction<'_>,
    org: Uuid,
    user: Uuid,
    role: &str,
    seat: &str,
) -> Result<()> {
    if role == "viewer" || seat != "developer" {
        return Ok(());
    }
    let cap = tx.query_opt("SELECT q.package_seats FROM team_stripe_checkout_intents c JOIN team_stripe_quotes q ON q.id=c.quote_id AND q.organization_id=c.organization_id AND q.account_id=c.account_id AND q.livemode=c.livemode WHERE c.organization_id=$1 AND c.disposition<>'expired'", &[&org]).await?;
    let Some(cap) = cap else {
        return Ok(());
    }; // Pre-commercial organizations unchanged.
    let occupied: i64 = tx.query_one("SELECT count(*) FROM organization_members WHERE organization_id=$1 AND user_id<>$2 AND deactivated_at IS NULL AND seat_type='developer' AND role<>'viewer'", &[&org,&user]).await?.get(0);
    if occupied >= i64::from(cap.get::<_, i32>(0)) {
        return Err(OrganizationRequestError::Invalid(
            "developer seats full; remove a developer or change the package",
        )
        .into());
    }
    Ok(())
}

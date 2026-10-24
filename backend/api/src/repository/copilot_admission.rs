//! Admission receipts are never minted by reads or scheduling hints.
use crate::{
    infrastructure::postgres::PostgresClient, services::team_analytics_entitlement::State,
};
use anyhow::Result;
use chrono::{DateTime, NaiveDate, Utc};
use std::collections::BTreeSet;
use tokio_postgres::Transaction;
use uuid::Uuid;

const CORRECTION_DAYS: &str = "SELECT DISTINCT a.day FROM team_copilot_admissions a JOIN team_github_identities g ON g.user_id=a.user_id AND g.github_user_id=a.github_user_id JOIN organization_analytics_consents c ON c.organization_id=a.organization_id AND c.user_id=a.user_id WHERE a.organization_id=$1 AND a.installation_id=$2 AND a.provider_account_id=$3 AND g.revoked_at IS NULL AND c.share_aggregate AND c.aggregate_from=a.consent_from AND a.day::timestamp AT TIME ZONE 'UTC'>=clock_timestamp()-interval '12 months' AND NOT EXISTS(SELECT 1 FROM team_webhook_dispositions d WHERE d.provider='copilot_daily' AND d.delivery_id=a.organization_id::text||':'||a.user_id::text||':'||a.installation_id::text||':'||a.day::text||':'||a.feature)";

pub async fn hint(pg: &PostgresClient, org: Uuid) -> Result<Option<State>> {
    Ok(super::team_financial_guard::read(pg, org)
        .await?
        .state()
        .cloned())
}

pub async fn correction_days(
    pg: &PostgresClient,
    org: Uuid,
    installation: i64,
    account: i64,
) -> Result<BTreeSet<NaiveDate>> {
    let proof = super::team_financial_guard::read(pg, org).await?;
    let days = pg
        .query(CORRECTION_DAYS, &[&org, &installation, &account])
        .await?
        .into_iter()
        .map(|r| r.get(0))
        .collect();
    super::team_financial_guard::validate(pg, org, &proof).await?;
    Ok(days)
}

pub(crate) async fn correction_days_in(
    tx: &Transaction<'_>,
    org: Uuid,
    installation: i64,
    account: i64,
) -> Result<BTreeSet<NaiveDate>> {
    Ok(tx
        .query(CORRECTION_DAYS, &[&org, &installation, &account])
        .await?
        .into_iter()
        .map(|r| r.get(0))
        .collect())
}

pub async fn existing(
    tx: &Transaction<'_>,
    org: Uuid,
    installation: i64,
    account: i64,
    day: NaiveDate,
) -> Result<BTreeSet<(i64, String)>> {
    Ok(tx.query("SELECT a.github_user_id,a.feature FROM team_copilot_admissions a JOIN team_github_identities g ON g.user_id=a.user_id AND g.github_user_id=a.github_user_id JOIN organization_analytics_consents c ON c.organization_id=a.organization_id AND c.user_id=a.user_id WHERE a.organization_id=$1 AND a.installation_id=$2 AND a.provider_account_id=$3 AND a.day=$4 AND g.revoked_at IS NULL AND c.share_aggregate AND c.aggregate_from=a.consent_from AND NOT EXISTS(SELECT 1 FROM team_webhook_dispositions d WHERE d.provider='copilot_daily' AND d.delivery_id=a.organization_id::text||':'||a.user_id::text||':'||a.installation_id::text||':'||a.day::text||':'||a.feature) FOR SHARE OF a", &[&org,&installation,&account,&day]).await?.into_iter().map(|r|(r.get(0),r.get(1))).collect())
}

/// Called only after the authoritative completed-day replacement, within the same
/// transaction. ON CONFLICT never transfers a receipt to another provider identity.
pub(crate) async fn mint(
    tx: &Transaction<'_>,
    org: Uuid,
    installation: i64,
    day: NaiveDate,
    financial: &super::team_financial_guard::TransactionProof,
    generation: i64,
    now: DateTime<Utc>,
) -> Result<u64> {
    let state = financial.enrolled_state(org)?;
    Ok(tx.execute("INSERT INTO team_copilot_admissions(organization_id,user_id,installation_id,day,feature,provider_account_id,github_user_id,consent_version,consent_from,entitlement_revision,privacy_generation,admitted_at) SELECT organization_id,user_id,installation_id,day,feature,provider_account_id,github_user_id,consent_version,consent_from,$4,$5,$6 FROM team_copilot_daily_facts WHERE organization_id=$1 AND installation_id=$2 AND day=$3 AND NOT blocked ON CONFLICT DO NOTHING", &[&org,&installation,&day,&state.revision,&generation,&now]).await?)
}

/// Invalidate response fences on enrollment, exact receipt or absorbing disposition
/// changes. No counters/credentials; source manifests alone cannot detect old restore.
pub async fn fence(tx: &Transaction<'_>, org: Uuid) -> Result<serde_json::Value> {
    Ok(tx.query_one("SELECT jsonb_build_object('enrolled',EXISTS(SELECT 1 FROM team_analytics_entitlements WHERE organization_id=$1),'receipts',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY user_id,installation_id,day,feature) FROM team_copilot_admissions a WHERE organization_id=$1),'[]'::jsonb),'dispositions',COALESCE((SELECT jsonb_agg(jsonb_build_array(delivery_id,reason,disposed_at) ORDER BY delivery_id) FROM team_webhook_dispositions WHERE provider='copilot_daily' AND split_part(delivery_id,':',1)=$1::uuid::text),'[]'::jsonb))", &[&org]).await?.get(0))
}

/// Bounded privacy cleanup also retires receipts whose mutable fact was removed by
/// a provider correction. The absorbing marker survives backup restore/replay.
pub async fn cleanup(
    tx: &Transaction<'_>,
    org: Uuid,
    cutoff: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Result<u64> {
    tx.query_opt(
        "SELECT generation FROM team_rollouts WHERE organization_id=$1 FOR UPDATE",
        &[&org],
    )
    .await?;
    let rows = tx.query("SELECT a.user_id,a.installation_id,a.day,a.feature FROM team_copilot_admissions a LEFT JOIN organization_analytics_consents c ON c.organization_id=a.organization_id AND c.user_id=a.user_id LEFT JOIN organization_members m ON m.organization_id=a.organization_id AND m.user_id=a.user_id LEFT JOIN users u ON u.id=a.user_id LEFT JOIN team_github_identities g ON g.user_id=a.user_id LEFT JOIN team_github_installations i ON i.organization_id=a.organization_id AND i.installation_id=a.installation_id WHERE a.organization_id=$1 AND (a.day::timestamp AT TIME ZONE 'UTC'<$2 OR NOT COALESCE(c.share_aggregate,false) OR c.aggregate_from IS DISTINCT FROM a.consent_from OR m.user_id IS NULL OR m.deactivated_at IS NOT NULL OR m.seat_type<>'developer' OR m.role='viewer' OR NOT COALESCE(u.is_active,false) OR u.deleted_at IS NOT NULL OR g.revoked_at IS NOT NULL OR g.github_user_id IS DISTINCT FROM a.github_user_id OR i.account_id IS DISTINCT FROM a.provider_account_id OR i.status='removed' OR EXISTS(SELECT 1 FROM team_webhook_dispositions d WHERE d.provider='copilot_daily' AND d.delivery_id=a.organization_id::text||':'||a.user_id::text||':'||a.installation_id::text||':'||a.day::text||':'||a.feature)) ORDER BY a.day,a.user_id,a.feature LIMIT 100 FOR UPDATE OF a", &[&org,&cutoff]).await?;
    for r in &rows {
        let user: Uuid = r.get(0);
        let installation: i64 = r.get(1);
        let day: NaiveDate = r.get(2);
        let feature: String = r.get(3);
        let key = format!("{org}:{user}:{installation}:{day}:{feature}");
        tx.execute("INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at) VALUES('copilot_daily',$1,'admission_removed','sharing_or_retention_removed',$2) ON CONFLICT DO NOTHING", &[&key,&now]).await?;
        tx.execute("DELETE FROM team_copilot_daily_facts WHERE organization_id=$1 AND user_id=$2 AND installation_id=$3 AND day=$4 AND feature=$5", &[&org,&user,&installation,&day,&feature]).await?;
        tx.execute("DELETE FROM team_copilot_admissions WHERE organization_id=$1 AND user_id=$2 AND installation_id=$3 AND day=$4 AND feature=$5", &[&org,&user,&installation,&day,&feature]).await?;
        super::copilot_reports::commit_day_manifest(tx, org, day).await?;
    }
    Ok(rows.len() as u64)
}

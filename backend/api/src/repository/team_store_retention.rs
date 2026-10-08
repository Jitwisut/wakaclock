//! Bounded cleanup of legacy organization-only ClickHouse projections. Personal tables
//! are deliberately absent from the allowlist. These legacy projections have no readers.
use crate::infrastructure::{database::ClickHouseClient, postgres::PostgresClient};
use anyhow::Result;
use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

pub async fn tick(
    pg: Arc<PostgresClient>,
    ch: Arc<ClickHouseClient>,
    now: DateTime<Utc>,
) -> Result<bool> {
    pg.execute("INSERT INTO team_store_cleanup(organization_id) SELECT organization_id FROM team_rollouts ON CONFLICT DO NOTHING", &[]).await?;
    let mut connection = pg.transaction_client().await?;
    let tx = connection.transaction().await?;
    let Some(row)=tx.query_opt("SELECT j.organization_id,r.generation,j.generation,j.cutoff FROM team_store_cleanup j JOIN team_rollouts r USING(organization_id) WHERE (j.completed_at IS NULL OR j.completed_at<$1::timestamptz-interval '1 hour' OR j.generation<>r.generation) AND (j.lease_until IS NULL OR j.lease_until<$1) ORDER BY j.completed_at NULLS FIRST,j.organization_id FOR UPDATE OF j SKIP LOCKED LIMIT 1", &[&now]).await? else {return Ok(false)};
    let org: Uuid = row.get(0);
    let generation: i64 = row.get(1);
    let previous: Option<i64> = row.get(2);
    let cutoff: DateTime<Utc> = row
        .get::<_, Option<DateTime<Utc>>>(3)
        .unwrap_or(crate::services::team_trust::cutoff(now));
    let token = Uuid::now_v7();
    tx.execute("UPDATE team_store_cleanup SET lease_token=$2,lease_until=$3::timestamptz+interval '300 seconds',cutoff=$4 WHERE organization_id=$1",&[&org,&token,&now,&cutoff]).await?;
    tx.commit().await?;
    // No database row lock spans an external store request. A repeated mutation is idempotent.
    let result = clean(&pg, &ch, org, generation != previous.unwrap_or(-1), cutoff).await;
    match result {
        Ok(done) => {
            pg.execute("UPDATE team_store_cleanup j SET completed_at=CASE WHEN $4 AND r.generation=$3 THEN $5::timestamptz ELSE NULL END,generation=CASE WHEN $4 THEN $3 ELSE j.generation END,cutoff=CASE WHEN $4 AND r.generation=$3 THEN NULL ELSE j.cutoff END,lease_token=NULL,lease_until=NULL,error_code=NULL FROM team_rollouts r WHERE j.organization_id=$1 AND r.organization_id=$1 AND j.lease_token=$2", &[&org,&token,&generation,&done,&now]).await?;
        }
        Err(error) => {
            pg.execute("UPDATE team_store_cleanup SET error_code='dependency_failure',lease_token=NULL,lease_until=$3::timestamptz+interval '60 seconds' WHERE organization_id=$1 AND lease_token=$2", &[&org,&token,&now]).await?;
            return Err(error);
        }
    }
    Ok(true)
}
async fn clean(
    pg: &PostgresClient,
    ch: &ClickHouseClient,
    org: Uuid,
    changed: bool,
    cutoff: DateTime<Utc>,
) -> Result<bool> {
    let members=pg.query("SELECT m.user_id,c.aggregate_from FROM organization_members m JOIN organization_analytics_consents c USING(organization_id,user_id) JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.deactivated_at IS NULL AND m.seat_type='developer' AND u.is_active AND u.deleted_at IS NULL AND c.share_aggregate AND c.aggregate_from IS NOT NULL",&[&org]).await?;
    let mut done = true;
    for table in ["member_daily", "organization_daily"] {
        let exists = ch
            .get_client()
            .query("SELECT count() FROM system.tables WHERE database=currentDatabase() AND name=?")
            .bind(table)
            .fetch_one::<u64>()
            .await?;
        if exists == 0 {
            continue;
        }
        let condition = if table == "organization_daily" {
            // The legacy sum has no contributor ledger; discard it on a privacy generation change.
            if changed {
                "organization_id=?".to_string()
            } else {
                "organization_id=? AND date<=toDate(?)".to_string()
            }
        } else {
            let allow = members
                .iter()
                .map(|_| "(user_id=? AND date>toDate(?))")
                .collect::<Vec<_>>()
                .join(" OR ");
            format!(
                "organization_id=? AND (date<=toDate(?) OR NOT ({}))",
                if allow.is_empty() { "0" } else { &allow }
            )
        };
        let keys = if table == "member_daily" {
            "organization_id,user_id,date"
        } else {
            "organization_id,date"
        };
        let sql=format!("ALTER TABLE {table} DELETE WHERE ({keys}) IN (SELECT DISTINCT {keys} FROM {table} WHERE {condition} ORDER BY date LIMIT 100) SETTINGS mutations_sync=2");
        let count_sql = format!("SELECT count() FROM {table} WHERE {condition}");
        for mutation in [true, false] {
            let client = ch.get_client();
            let mut query = client
                .query(if mutation { &sql } else { &count_sql })
                .bind(org);
            if table == "member_daily" || !changed {
                query = query.bind(cutoff.format("%Y-%m-%d").to_string());
            }
            if table == "member_daily" {
                for row in &members {
                    query = query.bind(row.get::<_, Uuid>(0)).bind(
                        row.get::<_, DateTime<Utc>>(1)
                            .format("%Y-%m-%d")
                            .to_string(),
                    );
                }
            }
            if mutation {
                query.execute().await?;
            } else {
                done &= query.fetch_one::<u64>().await? == 0;
            }
        }
    }
    Ok(done)
}

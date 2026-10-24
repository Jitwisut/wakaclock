//! Immutable organization fact admission, separate from mutable personal usage.
//! A receipt is necessary, never sufficient: current privacy projection still applies.
use crate::{
    infrastructure::postgres::PostgresClient, model::ai_usage::AiUsageEventRow,
    services::team_analytics_entitlement::State,
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use uuid::Uuid;

#[derive(Debug, Default, PartialEq)]
pub struct AdmissionResult {
    pub admitted: u32,
    pub duplicate: u32,
    pub withheld: u32,
    pub conflict: u32,
}
#[derive(Debug)]
struct Receipt {
    project: Uuid,
    context: String,
    event_time: DateTime<Utc>,
    revision: i64,
    payload: Option<String>,
    consent_from: DateTime<Utc>,
    admitted_at: DateTime<Utc>,
}
fn context(f: &AiUsageEventRow) -> Result<String> {
    // Mutable model/pricing/counters are corrections, not a new session identity.
    Ok(format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&(
            &f.ai_agent,
            &f.collector_id,
            &f.ai_session_id,
        ))?)
    ))
}
fn eligible(r: &Receipt, f: &AiUsageEventRow, s: &State, now: DateTime<Utc>) -> bool {
    let Some(at) = DateTime::from_timestamp(i64::from(f.event_time), 0) else {
        return false;
    };
    at == r.event_time
        && f.project_id == Some(r.project)
        && f.project_attribution_method.as_deref() == Some("explicit_project_hint")
        && context(f).is_ok_and(|c| c == r.context)
        && i64::try_from(f.version).is_ok_and(|v| {
            v >= r.revision && (v != r.revision || f.event_payload_hash == r.payload)
        })
        && at >= r.consent_from
        && at <= now
        && r.admitted_at <= now
        && s.covered_at(at)
        && at >= crate::services::team_trust::cutoff(now)
}
fn receipt(row: &tokio_postgres::Row) -> Receipt {
    Receipt {
        project: row.get("project_id"),
        context: row.get("context_hash"),
        event_time: row.get("event_time"),
        revision: row.get("source_revision"),
        payload: row.get("payload_hash"),
        consent_from: row.get("consent_from"),
        admitted_at: row.get("admitted_at"),
    }
}
/// Trusted canonical reader/worker only; no producer HTTP endpoint accepts these facts.
/// A whole batch commits with the privacy/entitlement proof checked after any lock wait.
pub async fn admit(
    pg: &PostgresClient,
    org: Uuid,
    facts: &[AiUsageEventRow],
) -> Result<AdmissionResult> {
    admit_inner(pg, org, facts, None).await
}

pub async fn admit_page(
    pg: &PostgresClient,
    claim: &super::team_usage_scan::Claim,
    facts: &[AiUsageEventRow],
) -> Result<AdmissionResult> {
    let mut previous = (claim.after_user.clone(), claim.after_event.clone());
    for fact in facts {
        let key = (fact.user_id.to_string(), fact.usage_event_id.clone());
        ensure!(key > previous, "admission page order invalid");
        let at = DateTime::from_timestamp(i64::from(fact.event_time), 0)
            .context("invalid event timestamp")?;
        ensure!(
            at >= claim.from && at < claim.before,
            "admission page outside checkpoint window"
        );
        previous = key;
    }
    admit_inner(pg, claim.org, facts, Some(claim)).await
}

async fn admit_inner(
    pg: &PostgresClient,
    org: Uuid,
    facts: &[AiUsageEventRow],
    scan: Option<&super::team_usage_scan::Claim>,
) -> Result<AdmissionResult> {
    ensure!(facts.len() <= 100, "admission batch exceeds 100");
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    super::team_seats::lock(&tx, org).await?;
    let state = super::team_analytics_entitlement::load(&tx, org)
        .await?
        .context("organization not enrolled in commercial analytics")?;
    let financial = super::team_financial_guard::TransactionProof::capture(org, Some(&state))?;
    let scan_deadline = if let Some(scan) = scan {
        Some(super::team_usage_scan::lock_claim(&tx, scan).await?)
    } else {
        None
    };
    let row = tx
        .query_opt(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1 AND enabled",
            &[&org],
        )
        .await?
        .context("Team disabled")?;
    let generation: i64 = row.get(0);
    let mut result = AdmissionResult::default();
    for f in facts {
        let Some(project) = f.project_id else {
            result.withheld += 1;
            continue;
        };
        let at = DateTime::from_timestamp(i64::from(f.event_time), 0)
            .context("event timestamp invalid")?;
        ensure!(
            !f.usage_event_id.is_empty() && f.usage_event_id.len() <= 1024,
            "usage identity invalid"
        );
        let revision = i64::try_from(f.version).context("usage revision unsupported")?;
        let digest = context(f)?;
        let key = disposition_key(org, f.user_id, &f.usage_event_id);
        let deleted:bool=tx.query_one("SELECT EXISTS(SELECT 1 FROM team_webhook_dispositions WHERE provider='team_usage_admission' AND delivery_id=$1)",&[&key]).await?.get(0);
        if deleted {
            result.withheld += 1;
            continue;
        }

        if let Some(r)=tx.query_opt("SELECT * FROM team_usage_admissions WHERE organization_id=$1 AND user_id=$2 AND usage_event_id=$3",&[&org,&f.user_id,&f.usage_event_id]).await? {
            let r=receipt(&r);
            if r.project==project && r.context==digest && r.event_time==at && (revision!=r.revision || r.payload==f.event_payload_hash) {result.duplicate+=1;} else {result.conflict+=1;}
            continue;
        }
        if f.project_attribution_method.as_deref() != Some("explicit_project_hint")
            || !state.covered_at(at)
        {
            result.withheld += 1;
            continue;
        }
        let consent=tx.query_opt("SELECT c.consent_version,c.aggregate_from FROM organization_analytics_consents c JOIN organization_members m USING(organization_id,user_id) JOIN users u ON u.id=m.user_id JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer' AND u.is_active AND u.deleted_at IS NULL AND o.deleted_at IS NULL AND c.share_aggregate AND c.aggregate_from IS NOT NULL AND c.aggregate_from<=$3",&[&org,&f.user_id,&at]).await?;
        let Some(consent) = consent else {
            result.withheld += 1;
            continue;
        };
        let allowed:bool=tx.query_one("SELECT EXISTS(SELECT 1 FROM team_repository_scopes s WHERE s.organization_id=$1 AND s.enabled AND (s.project_id=$3 OR EXISTS(SELECT 1 FROM team_member_project_bindings b WHERE b.organization_id=s.organization_id AND b.repository_id=s.repository_id AND b.user_id=$2 AND b.project_id=$3)))",&[&org,&f.user_id,&project]).await?.get(0);
        if !allowed {
            result.withheld += 1;
            continue;
        }
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        if !state.covered_at(now) || at > now || at < crate::services::team_trust::cutoff(now) {
            result.withheld += 1;
            continue;
        }
        let version: i64 = consent.get(0);
        let since: DateTime<Utc> = consent.get(1);
        tx.execute("INSERT INTO team_usage_admissions(organization_id,user_id,usage_event_id,context_hash,project_id,event_time,source_revision,payload_hash,consent_version,consent_from,entitlement_revision,privacy_generation,admitted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",&[&org,&f.user_id,&f.usage_event_id,&digest,&project,&at,&revision,&f.event_payload_hash,&version,&since,&state.revision,&generation,&now]).await?;
        result.admitted += 1;
    }
    // Consent/scope mutations advance this row in their own transaction. If they
    // committed while candidates were examined, discard the entire admission batch.
    let row = tx
        .query_opt(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1 AND enabled FOR SHARE",
            &[&org],
        )
        .await?
        .context("Team access changed")?;
    ensure!(
        row.get::<_, i64>(0) == generation,
        "Team projection changed during admission"
    );
    let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    ensure!(
        result.admitted == 0 || state.covered_at(now),
        "entitlement expired during admission"
    );
    if let Some(scan) = scan {
        let last = facts
            .last()
            .map(|f| (f.user_id.to_string(), f.usage_event_id.clone()));
        super::team_usage_scan::advance(&tx, scan, last, facts.len() == 100).await?;
        let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        ensure!(
            result.admitted == 0 || state.covered_at(now),
            "entitlement expired during checkpoint"
        );
    }
    financial.validate()?;
    // File verification can consume time too; use a new DB clock after it.
    let now: DateTime<Utc> = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    ensure!(
        result.admitted == 0 || state.covered_at(now),
        "entitlement expired during financial verification"
    );
    if let Some(deadline) = scan_deadline {
        // advance() has intentionally released the lease inside this transaction;
        // its original deadline must still cover the final commit decision.
        super::team_usage_scan::validate_deadline(&tx, deadline).await?;
    }
    tx.commit().await?;
    Ok(result)
}
/// Only filtering, never admission during a dashboard/receipt/CSV request.
/// Organizations not yet enrolled retain the pre-commercial behavior; public
/// enrollment remains disabled until the worker and independent restore ledger exist.
pub async fn retain(
    pg: &PostgresClient,
    org: Uuid,
    facts: Vec<AiUsageEventRow>,
) -> Result<Vec<AiUsageEventRow>> {
    let proof = super::team_financial_guard::read(pg, org).await?;
    let Some(state) = proof.state() else {
        super::team_financial_guard::validate(pg, org, &proof).await?;
        return Ok(facts);
    };
    let mut receipts = BTreeMap::new();
    // Bound query parameters; batch reads contain no source/command/prompt data.
    for chunk in facts.chunks(1000) {
        let users = chunk.iter().map(|f| f.user_id).collect::<Vec<_>>();
        let ids = chunk
            .iter()
            .map(|f| f.usage_event_id.clone())
            .collect::<Vec<_>>();
        for r in pg.query("SELECT a.* FROM team_usage_admissions a JOIN unnest($2::uuid[],$3::text[]) AS requested(user_id,usage_event_id) USING(user_id,usage_event_id) WHERE a.organization_id=$1 AND NOT EXISTS(SELECT 1 FROM team_webhook_dispositions d WHERE d.provider='team_usage_admission' AND d.delivery_id=a.organization_id::text||':'||a.user_id::text||':'||encode(sha256(convert_to(a.usage_event_id,'UTF8')),'hex'))",&[&org,&users,&ids]).await? {
            receipts.insert((r.get::<_,Uuid>("user_id"),r.get::<_,String>("usage_event_id")),receipt(&r));
        }
    }
    let now: DateTime<Utc> = pg.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    let retained = facts
        .into_iter()
        .filter(|f| {
            receipts
                .get(&(f.user_id, f.usage_event_id.clone()))
                .is_some_and(|r| eligible(r, f, state, now))
        })
        .collect();
    super::team_financial_guard::validate(pg, org, &proof).await?;
    Ok(retained)
}

fn disposition_key(org: Uuid, user: Uuid, event: &str) -> String {
    format!("{org}:{user}:{:x}", Sha256::digest(event.as_bytes()))
}
/// Called by the existing bounded retention worker, with the same cutoff for the job.
/// The independent privacy registry already mirrors dispositions. Restored receipts
/// remain unreadable even before their physical deletion is retried.
pub async fn cleanup(
    tx: &tokio_postgres::Transaction<'_>,
    org: Uuid,
    cutoff: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Result<u64> {
    let rows=tx.query("SELECT a.user_id,a.usage_event_id,a.context_hash FROM team_usage_admissions a LEFT JOIN organization_analytics_consents c USING(organization_id,user_id) LEFT JOIN organization_members m USING(organization_id,user_id) LEFT JOIN users u ON u.id=a.user_id WHERE a.organization_id=$1 AND (a.event_time<$2 OR NOT COALESCE(c.share_aggregate,FALSE) OR c.aggregate_from IS NULL OR a.event_time<c.aggregate_from OR m.user_id IS NULL OR m.deactivated_at IS NOT NULL OR m.seat_type<>'developer' OR m.role='viewer' OR NOT COALESCE(u.is_active,FALSE) OR u.deleted_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM team_repository_scopes s WHERE s.organization_id=a.organization_id AND s.enabled AND (s.project_id=a.project_id OR EXISTS(SELECT 1 FROM team_member_project_bindings b WHERE b.organization_id=s.organization_id AND b.repository_id=s.repository_id AND b.user_id=a.user_id AND b.project_id=a.project_id)))) ORDER BY a.user_id,a.usage_event_id LIMIT 100 FOR UPDATE OF a",&[&org,&cutoff]).await?;
    for r in &rows {
        let user: Uuid = r.get(0);
        let id: String = r.get(1);
        let hash: String = r.get(2);
        let key = disposition_key(org, user, &id);
        tx.execute("INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at) VALUES('team_usage_admission',$1,$2,'sharing_scope_or_retention_removed',$3) ON CONFLICT DO NOTHING",&[&key,&hash,&now]).await?;
        tx.execute("DELETE FROM team_usage_admissions WHERE organization_id=$1 AND user_id=$2 AND usage_event_id=$3",&[&org,&user,&id]).await?;
    }
    Ok(rows.len() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::PostgresConfig;
    use chrono::Duration;
    fn fact(user: Uuid, project: Uuid, at: DateTime<Utc>, id: &str) -> AiUsageEventRow {
        AiUsageEventRow {
            user_id: user,
            date: (at.timestamp() / 86400) as u16,
            usage_event_id: id.into(),
            event_payload_hash: Some("a".repeat(64)),
            ai_session_id: "session".into(),
            collector_id: Some("fixture".into()),
            event_time: at.timestamp() as u32,
            project_id: Some(project),
            project_attribution_method: Some("explicit_project_hint".into()),
            ai_agent: "Fixture".into(),
            ai_provider: None,
            ai_model: None,
            prompt_count: 0,
            prompt_character_count: None,
            input_tokens: None,
            output_tokens: None,
            cache_read_tokens: None,
            cache_write_tokens: None,
            estimated_cost_microusd: None,
            pricing_version: None,
            token_source: "provider".into(),
            version: 1,
            received_at: at.timestamp() as u32,
        }
    }
    #[test]
    fn receipt_allows_cost_corrections_not_identity_moves_or_uncovered_time() {
        let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        let state = State::trial(10, now - Duration::days(1)).unwrap();
        let mut f = fact(
            Uuid::now_v7(),
            Uuid::now_v7(),
            now - Duration::hours(1),
            "event",
        );
        let r = Receipt {
            project: f.project_id.unwrap(),
            context: context(&f).unwrap(),
            event_time: now - Duration::hours(1),
            revision: 1,
            payload: f.event_payload_hash.clone(),
            consent_from: state.activated_at,
            admitted_at: now - Duration::minutes(1),
        };
        assert!(eligible(&r, &f, &state, now));
        f.estimated_cost_microusd = Some(500);
        f.pricing_version = Some("corrected".into());
        f.version = 2;
        f.event_payload_hash = Some("b".repeat(64));
        assert!(eligible(&r, &f, &state, now));
        f.version = 1;
        assert!(!eligible(&r, &f, &state, now));
        f.version = 2;
        f.ai_session_id = "other".into();
        assert!(!eligible(&r, &f, &state, now));
        f.ai_session_id = "session".into();
        f.event_time = (r.event_time + Duration::minutes(1)).timestamp() as u32;
        assert!(
            !eligible(&r, &f, &state, now),
            "covered timestamp moves remain conflicts"
        );
        f.event_time = (state.activated_at - Duration::seconds(1)).timestamp() as u32;
        assert!(!eligible(&r, &f, &state, now));
        f.event_time = (now + Duration::seconds(1)).timestamp() as u32;
        assert!(!eligible(&r, &f, &state, now));
    }
    // Synthetic historical consent only. The transaction-local fixture setting
    // cannot escape this private test database or alter production trigger behavior.
    async fn historical_consent(pg: &PostgresClient, org: Uuid, user: Uuid, at: DateTime<Utc>) {
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        tx.batch_execute("SET LOCAL session_replication_role=replica")
            .await
            .unwrap();
        tx.execute("UPDATE organization_analytics_consents SET aggregate_from=$3 WHERE organization_id=$1 AND user_id=$2", &[&org,&user,&at]).await.unwrap();
        tx.commit().await.unwrap();
    }
    #[tokio::test]
    #[ignore = "requires isolated POSTGRES_TEST_URL"]
    async fn team_usage_admission_expiry_consent_scope_replay_and_correction() {
        let url = std::env::var("POSTGRES_TEST_URL").unwrap();
        assert_eq!(
            url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
            Some("atoaxis_stripe_test")
        );
        let pg = PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap();
        pg.migrate().await.unwrap();
        pg.migrate().await.unwrap();
        let org = Uuid::now_v7();
        let user = Uuid::now_v7();
        let project = Uuid::now_v7();
        let repository = Uuid::now_v7();
        let now = DateTime::from_timestamp(Utc::now().timestamp(), 0).unwrap();
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Admission fixture')",
            &[&org, &org.to_string()],
        )
        .await
        .unwrap();
        pg.execute(
            "INSERT INTO users(id,username) VALUES($1,$2)",
            &[&user, &user.to_string()],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer')",&[&org,&user]).await.unwrap();
        pg.execute("INSERT INTO team_rollouts(organization_id,enabled) VALUES($1,TRUE) ON CONFLICT(organization_id) DO UPDATE SET enabled=TRUE",&[&org]).await.unwrap();
        pg.execute("INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate,aggregate_from) VALUES($1,$2,TRUE,$3)",&[&org,&user,&(now-Duration::days(1))]).await.unwrap();
        pg.execute("INSERT INTO team_repository_scopes(organization_id,repository_id,github_repository_id,github_installation_id,project_id,enabled) VALUES($1,$2,99151,99152,$3,TRUE)",&[&org,&repository,&project]).await.unwrap();
        historical_consent(&pg, org, user, now - Duration::days(1)).await;
        let f = fact(user, project, now - Duration::hours(1), "first");
        // Legacy organizations remain unchanged, and the worker cannot enroll them.
        assert_eq!(retain(&pg, org, vec![f.clone()]).await.unwrap().len(), 1);
        assert!(admit(&pg, org, std::slice::from_ref(&f)).await.is_err());
        let before: i64 = pg
            .query_one(
                "SELECT generation FROM team_rollouts WHERE organization_id=$1",
                &[&org],
            )
            .await
            .unwrap()
            .get(0);
        let financial_guard_fixture =
            crate::infrastructure::team_financial_guard::TestLedger::new(&[org]);
        super::super::team_analytics_entitlement::start_trial(
            &pg,
            org,
            user,
            10,
            &financial_guard_fixture.deployment(),
        )
        .await
        .unwrap();
        assert_eq!(
            pg.query_one(
                "SELECT generation FROM team_rollouts WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            before + 1
        );
        // Synthetic clock fixture: the organization was explicitly activated two hours earlier.
        let mut state = State::trial(10, now - Duration::hours(2)).unwrap();
        pg.execute(
            "UPDATE team_analytics_entitlements SET state=$2 WHERE organization_id=$1",
            &[&org, &serde_json::to_value(&state).unwrap()],
        )
        .await
        .unwrap();
        assert!(
            admit(&pg, org, std::slice::from_ref(&f)).await.is_err(),
            "an enrolled producer cannot bypass independent configuration"
        );
        let independent =
            crate::infrastructure::team_financial_guard::TestLedger::enrolled(org, &state);
        let _financial_environment = independent.environment();
        assert!(retain(&pg, org, vec![f.clone()]).await.unwrap().is_empty());
        let first = vec![f.clone()];
        let second = first.clone();
        let (a, b) = tokio::join!(admit(&pg, org, &first), admit(&pg, org, &second));
        let (a, b) = (a.unwrap(), b.unwrap());
        assert_eq!(a.admitted + b.admitted, 1);
        assert_eq!(a.duplicate + b.duplicate, 1);
        assert_eq!(retain(&pg, org, vec![f.clone()]).await.unwrap().len(), 1);
        // Database failure midway through a batch leaves neither new receipt.
        pg.execute("ALTER TABLE team_usage_admissions ADD CONSTRAINT fixture_admission_failure CHECK(usage_event_id<>'reject') NOT VALID",&[]).await.unwrap();
        let good = fact(user, project, now - Duration::minutes(45), "good");
        let bad = fact(user, project, now - Duration::minutes(44), "reject");
        assert!(admit(&pg, org, &[good.clone(), bad]).await.is_err());
        assert!(retain(&pg, org, vec![good]).await.unwrap().is_empty());
        pg.execute(
            "ALTER TABLE team_usage_admissions DROP CONSTRAINT fixture_admission_failure",
            &[],
        )
        .await
        .unwrap();
        // A scope-ineligible record does not stop an eligible sibling.
        let good = fact(user, project, now - Duration::minutes(40), "second");
        let wrong = fact(user, Uuid::now_v7(), now - Duration::minutes(40), "wrong");
        let mixed = admit(&pg, org, &[good.clone(), wrong]).await.unwrap();
        assert_eq!(mixed.admitted, 1);
        assert_eq!(mixed.withheld, 1);
        let mut correction = good.clone();
        correction.version = 2;
        correction.estimated_cost_microusd = Some(700);
        correction.event_payload_hash = Some("b".repeat(64));
        assert_eq!(
            retain(&pg, org, vec![correction.clone()]).await.unwrap()[0].estimated_cost_microusd,
            Some(700)
        );
        let mut moved = correction.clone();
        moved.event_time += 60;
        assert_eq!(
            admit(&pg, org, std::slice::from_ref(&moved))
                .await
                .unwrap()
                .conflict,
            1
        );
        assert!(retain(&pg, org, vec![moved]).await.unwrap().is_empty());
        correction.ai_session_id = "different".into();
        assert!(retain(&pg, org, vec![correction]).await.unwrap().is_empty());
        // Scanner leases/checkpoints survive response loss and process replacement.
        // Full pages of out-of-scope metadata advance; they never become receipts.
        let scan = super::super::team_usage_scan::claim(&pg)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(scan.org, org);
        assert!(super::super::team_usage_scan::claim(&pg)
            .await
            .unwrap()
            .is_none());
        let outside = Uuid::now_v7();
        let page = (0..100)
            .map(|i| {
                fact(
                    user,
                    outside,
                    now - Duration::minutes(20),
                    &format!("scan-{i:03}"),
                )
            })
            .collect::<Vec<_>>();
        assert_eq!(admit_page(&pg, &scan, &page).await.unwrap().withheld, 100);
        // Lost response: the old token cannot advance twice or replace a newer page.
        assert!(admit_page(&pg, &scan, &page).await.is_err());
        let next = super::super::team_usage_scan::claim(&pg)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(next.after_event, "scan-099");
        assert_eq!(next.before, scan.before);
        super::super::team_usage_scan::retry(&pg, &scan)
            .await
            .unwrap();
        assert_eq!(
            pg.query_one(
                "SELECT lease_token FROM team_usage_admission_scans WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, Option<Uuid>>(0),
            Some(next.token)
        );
        pg.execute("UPDATE team_usage_admission_scans SET lease_until=clock_timestamp()-interval '1 second' WHERE organization_id=$1",&[&org]).await.unwrap();
        assert!(admit_page(&pg, &next, &[]).await.is_err());
        let replacement = super::super::team_usage_scan::claim(&pg)
            .await
            .unwrap()
            .unwrap();
        assert_ne!(replacement.token, next.token);
        assert_eq!(replacement.after_event, next.after_event);
        // Fault after receipt creation must roll back both receipt and checkpoint.
        pg.execute("ALTER TABLE team_usage_admission_scans ADD CONSTRAINT fixture_scan_checkpoint_failure CHECK(last_success_at IS NULL) NOT VALID",&[]).await.unwrap();
        let checkpoint_fact = fact(user, project, now - Duration::minutes(15), "z-checkpoint");
        assert!(
            admit_page(&pg, &replacement, std::slice::from_ref(&checkpoint_fact))
                .await
                .is_err()
        );
        assert!(retain(&pg, org, vec![checkpoint_fact])
            .await
            .unwrap()
            .is_empty());
        assert_eq!(
            pg.query_one(
                "SELECT lease_token FROM team_usage_admission_scans WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, Option<Uuid>>(0),
            Some(replacement.token)
        );
        pg.execute("ALTER TABLE team_usage_admission_scans DROP CONSTRAINT fixture_scan_checkpoint_failure",&[]).await.unwrap();
        admit_page(&pg, &replacement, &[]).await.unwrap();
        assert!(super::super::team_usage_scan::claim(&pg)
            .await
            .unwrap()
            .is_none());
        let completed = pg.query_one("SELECT scan_before,after_event,last_completed_at FROM team_usage_admission_scans WHERE organization_id=$1",&[&org]).await.unwrap();
        assert!(completed.get::<_, Option<DateTime<Utc>>>(0).is_none());
        assert_eq!(completed.get::<_, String>(1), "");
        assert!(completed.get::<_, Option<DateTime<Utc>>>(2).is_some());
        // Operational health reveals no contributor counts/cursors and is withheld
        // from non-administrators. Membership changes during response construction
        // must reject the already assembled admin diagnostics.
        let health_pg = std::sync::Arc::new(
            PostgresClient::connect(&PostgresConfig {
                url: std::env::var("POSTGRES_TEST_URL").ok(),
                max_connections: 4,
            })
            .await
            .unwrap(),
        );
        let health_ch = std::sync::Arc::new(
            crate::infrastructure::database::ClickHouseClient::new(
                &crate::config::ClickHouseConfig {
                    url: "http://127.0.0.1:1".into(),
                    user: None,
                    password: None,
                    database: "unused_fixture".into(),
                },
            )
            .await
            .unwrap(),
        );
        let health_service =
            std::sync::Arc::new(crate::services::team_insights::TeamInsightsService::new(
                Some(std::sync::Arc::new(
                    super::super::team_insights::TeamInsightsRepository::new(
                        health_pg.clone(),
                        health_ch,
                    ),
                )),
                std::sync::Arc::new(crate::services::authorization::AuthorizationService::new(
                    Some(health_pg),
                )),
                true,
            ));
        let delivery = std::sync::Arc::new(
            crate::services::delivery_status::DeliveryStatusService::with_postgres(None),
        );
        let diagnostics = health_service
            .measurement_health(user, org, &delivery)
            .await
            .unwrap();
        assert_eq!(diagnostics["team"]["usage_admission"]["status"], "observed");
        assert_eq!(
            diagnostics["team"]["usage_admission"]["reason"],
            "latest_sweep_observed_capture_unconfirmed"
        );
        let details = diagnostics["team"]["usage_admission"].to_string();
        assert!(
            !details.contains("scan-099")
                && !details.contains(&user.to_string())
                && !details.contains("count")
        );
        assert!(health_service
            .measurement_health(user, Uuid::now_v7(), &delivery)
            .await
            .is_err());
        let mut policy_db = pg.transaction_client().await.unwrap();
        let policy_tx = policy_db.transaction().await.unwrap();
        policy_tx
            .batch_execute("LOCK TABLE team_report_policies IN SHARE MODE")
            .await
            .unwrap();
        let h = health_service.clone();
        let d = delivery.clone();
        let health_read = tokio::spawn(async move { h.measurement_health(user, org, &d).await });
        let mut policy_waiting = false;
        for _ in 0..100 {
            if pg.query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='relation'",&[]).await.unwrap().get::<_,i64>(0)>0 {policy_waiting=true;break;}
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert!(
            policy_waiting,
            "health must reach final policy read before role change"
        );
        pg.execute(
            "UPDATE organization_members SET role='member' WHERE organization_id=$1 AND user_id=$2",
            &[&org, &user],
        )
        .await
        .unwrap();
        policy_tx.commit().await.unwrap();
        assert!(health_read.await.unwrap().is_err());
        let member_health = health_service
            .measurement_health(user, org, &delivery)
            .await
            .unwrap();
        assert_eq!(
            member_health["team"]["usage_admission"]["status"],
            "withheld"
        );
        assert!(member_health["team"]["usage_admission"]
            .get("updated_at")
            .is_none());
        pg.execute(
            "UPDATE organization_members SET role='owner' WHERE organization_id=$1 AND user_id=$2",
            &[&org, &user],
        )
        .await
        .unwrap();
        // Expiration closes new identities while keeping accepted history available.
        state.windows[0].end = now - Duration::minutes(1);
        super::super::team_financial_guard::set_test_state(&pg, &independent, org, &mut state)
            .await;
        let late = fact(user, project, now - Duration::minutes(35), "late");
        assert_eq!(
            admit(&pg, org, std::slice::from_ref(&late))
                .await
                .unwrap()
                .withheld,
            1
        );
        assert_eq!(
            retain(&pg, org, vec![f.clone(), good.clone(), late])
                .await
                .unwrap()
                .len(),
            2
        );
        // Resume is prospective; an event in the unpaid gap is still excluded.
        let resume = Utc::now();
        state
            .windows
            .push(crate::services::team_analytics_entitlement::Window {
                kind: crate::services::team_analytics_entitlement::Kind::Paid,
                start: resume,
                end: resume + Duration::days(30),
            });
        super::super::team_financial_guard::set_test_state(&pg, &independent, org, &mut state)
            .await;
        let gap = fact(user, project, now - Duration::seconds(30), "gap");
        assert_eq!(admit(&pg, org, &[gap]).await.unwrap().withheld, 1);
        // Entitlement can expire while a database lock delays INSERT. The final
        // clock check must roll back a record that was eligible before waiting.
        let deadline = Utc::now() + Duration::seconds(2);
        state.windows.last_mut().unwrap().end = deadline;
        super::super::team_financial_guard::set_test_state(&pg, &independent, org, &mut state)
            .await;
        let mut deadline_db = pg.transaction_client().await.unwrap();
        let deadline_tx = deadline_db.transaction().await.unwrap();
        deadline_tx
            .batch_execute("LOCK TABLE team_usage_admissions IN SHARE MODE")
            .await
            .unwrap();
        let pg_deadline = PostgresClient::connect(&PostgresConfig {
            url: std::env::var("POSTGRES_TEST_URL").ok(),
            max_connections: 4,
        })
        .await
        .unwrap();
        let deadline_fact = fact(user, project, now - Duration::minutes(25), "deadline_wait");
        let deadline_worker =
            tokio::spawn(async move { admit(&pg_deadline, org, &[deadline_fact]).await });
        let mut deadline_waiting = false;
        for _ in 0..100 {
            if pg.query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='relation'",&[]).await.unwrap().get::<_,i64>(0)>0 {deadline_waiting=true;break;}
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert!(
            deadline_waiting,
            "admission must reach INSERT before expiry"
        );
        let wait = (deadline + Duration::milliseconds(50) - Utc::now())
            .to_std()
            .unwrap_or_default();
        tokio::time::sleep(wait).await;
        deadline_tx.commit().await.unwrap();
        let error = deadline_worker.await.unwrap().unwrap_err();
        assert!(error
            .to_string()
            .contains("entitlement expired during admission"));
        assert_eq!(pg.query_one("SELECT count(*) FROM team_usage_admissions WHERE organization_id=$1 AND usage_event_id='deadline_wait'",&[&org]).await.unwrap().get::<_,i64>(0),0);
        state.windows.last_mut().unwrap().end = Utc::now() + Duration::days(30);
        super::super::team_financial_guard::set_test_state(&pg, &independent, org, &mut state)
            .await;
        pg.execute("UPDATE organization_analytics_consents SET share_aggregate=FALSE,share_individual=FALSE WHERE organization_id=$1 AND user_id=$2",&[&org,&user]).await.unwrap();
        let after = fact(user, project, now - Duration::minutes(30), "after_revoke");
        assert_eq!(admit(&pg, org, &[after]).await.unwrap().withheld, 1);
        // Revoke while INSERT waits on a fixture table lock. The final generation
        // fence must roll back the accepted-looking row before it becomes visible.
        pg.execute("UPDATE organization_analytics_consents SET share_aggregate=TRUE,aggregate_from=$3 WHERE organization_id=$1 AND user_id=$2",&[&org,&user,&(now-Duration::days(1))]).await.unwrap();
        historical_consent(&pg, org, user, now - Duration::days(1)).await;
        let mut lock_db = pg.transaction_client().await.unwrap();
        let lock_tx = lock_db.transaction().await.unwrap();
        lock_tx
            .batch_execute("LOCK TABLE team_usage_admissions IN SHARE MODE")
            .await
            .unwrap();
        let pg2 = PostgresClient::connect(&PostgresConfig {
            url: std::env::var("POSTGRES_TEST_URL").ok(),
            max_connections: 4,
        })
        .await
        .unwrap();
        let racing = fact(user, project, now - Duration::minutes(25), "racing");
        let worker = tokio::spawn(async move { admit(&pg2, org, &[racing]).await });
        let mut waiting = false;
        for _ in 0..100 {
            if pg.query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='relation'",&[]).await.unwrap().get::<_,i64>(0)>0 {waiting=true;break;}
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert!(
            waiting,
            "admission must have reached its INSERT before revocation"
        );
        pg.execute("UPDATE organization_analytics_consents SET share_aggregate=FALSE WHERE organization_id=$1 AND user_id=$2",&[&org,&user]).await.unwrap();
        lock_tx.commit().await.unwrap();
        assert!(worker.await.unwrap().is_err());
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_usage_admissions WHERE organization_id=$1",
                &[&org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            2
        );
        let backup = pg
            .query(
                "SELECT to_jsonb(a) FROM team_usage_admissions a WHERE organization_id=$1",
                &[&org],
            )
            .await
            .unwrap();
        let mut cleanup_db = pg.transaction_client().await.unwrap();
        let tx = cleanup_db.transaction().await.unwrap();
        assert_eq!(
            cleanup(
                &tx,
                org,
                crate::services::team_trust::cutoff(Utc::now()),
                Utc::now()
            )
            .await
            .unwrap(),
            2
        );
        tx.commit().await.unwrap();
        // Simulate an old database restoring the receipts while current disposition
        // evidence survives independently; neither read nor replay may revive them.
        for row in backup {
            let value: serde_json::Value = row.get(0);
            pg.execute("INSERT INTO team_usage_admissions SELECT * FROM jsonb_populate_record(NULL::team_usage_admissions,$1)",&[&value]).await.unwrap();
        }
        assert!(retain(&pg, org, vec![f.clone(), good])
            .await
            .unwrap()
            .is_empty());
        assert_eq!(admit(&pg, org, &[f]).await.unwrap().withheld, 1);
        // Even a blocked checkpoint INSERT is inside the overall tick deadline;
        // it must not hang the shared privacy worker indefinitely.
        let mut blocked_db = pg.transaction_client().await.unwrap();
        let blocked_tx = blocked_db.transaction().await.unwrap();
        blocked_tx
            .batch_execute("LOCK TABLE team_usage_admission_scans IN SHARE MODE")
            .await
            .unwrap();
        let worker_pg = std::sync::Arc::new(
            PostgresClient::connect(&PostgresConfig {
                url: std::env::var("POSTGRES_TEST_URL").ok(),
                max_connections: 4,
            })
            .await
            .unwrap(),
        );
        let unused_ch = std::sync::Arc::new(
            crate::infrastructure::database::ClickHouseClient::new(
                &crate::config::ClickHouseConfig {
                    url: "http://127.0.0.1:1".into(),
                    user: None,
                    password: None,
                    database: "unused_fixture".into(),
                },
            )
            .await
            .unwrap(),
        );
        let worker_repo =
            super::super::team_insights::TeamInsightsRepository::new(worker_pg.clone(), unused_ch);
        let trust = super::super::team_trust::TeamTrustRepository::new(worker_pg);
        let bounded = tokio::time::timeout(
            std::time::Duration::from_secs(12),
            crate::services::team_usage_admission_worker::tick(&worker_repo, &trust),
        )
        .await
        .expect("shared privacy worker must not hang");
        assert!(bounded
            .unwrap_err()
            .to_string()
            .contains("tick deadline exceeded"));
        blocked_tx.commit().await.unwrap();
        // An external closure while INSERT is waiting must roll back every
        // accepted-looking receipt, without relying on a dashboard/read guard.
        pg.execute("UPDATE organization_analytics_consents SET share_aggregate=TRUE WHERE organization_id=$1 AND user_id=$2", &[&org,&user]).await.unwrap();
        historical_consent(&pg, org, user, now - Duration::days(1)).await;
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        tx.batch_execute("LOCK TABLE team_usage_admissions IN SHARE MODE")
            .await
            .unwrap();
        let blocked_pg = PostgresClient::connect(&PostgresConfig {
            url: std::env::var("POSTGRES_TEST_URL").ok(),
            max_connections: 4,
        })
        .await
        .unwrap();
        let sample = fact(user, project, now - Duration::minutes(20), "financial-race");
        let pending = tokio::spawn(async move { admit(&blocked_pg, org, &[sample]).await });
        let mut waiting = false;
        for _ in 0..100 {
            let n:i64 = pg.query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'INSERT INTO team_usage_admissions%'", &[]).await.unwrap().get(0);
            if n > 0 {
                waiting = true;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert!(waiting, "financial race must reach actual INSERT wait");
        independent.guard.quarantine(org).unwrap();
        tx.commit().await.unwrap();
        assert!(pending
            .await
            .unwrap()
            .unwrap_err()
            .to_string()
            .starts_with("financial_guard_"));
        assert_eq!(pg.query_one("SELECT count(*) FROM team_usage_admissions WHERE organization_id=$1 AND usage_event_id='financial-race'", &[&org]).await.unwrap().get::<_,i64>(0), 0);
        pg.execute("UPDATE team_usage_admission_scans SET next_run_at=clock_timestamp() WHERE organization_id=$1", &[&org]).await.unwrap();
        assert!(super::super::team_usage_scan::claim(&pg)
            .await
            .unwrap()
            .is_none());
        let scan = pg.query_one("SELECT error_code,lease_token FROM team_usage_admission_scans WHERE organization_id=$1", &[&org]).await.unwrap();
        assert_eq!(
            scan.get::<_, Option<String>>(0).as_deref(),
            Some("financial_guard_unconfirmed")
        );
        assert!(scan.get::<_, Option<Uuid>>(1).is_none());
        assert!(
            super::super::team_usage_scan::observation(&pg, org, Utc::now())
                .await
                .unwrap()
                .access_active
                .is_none()
        );
        assert!(retain(&pg, org, vec![]).await.is_err());
        pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
            .await
            .unwrap();
        pg.execute("DELETE FROM users WHERE id=$1", &[&user])
            .await
            .unwrap();
    }
}

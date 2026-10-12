//! Synthetic metadata only, explicitly isolated database. No production credentials.
use super::copilot_reports::*;
use crate::{
    config::PostgresConfig,
    infrastructure::postgres::PostgresClient,
    repository::team_trust::{Registry, TeamTrustRepository},
    services::{authorization::AuthorizationService, copilot_daily::COUNTERS},
};
use chrono::{Datelike, Duration, Utc};
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::Arc};
use uuid::Uuid;
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn weekly_copilot_bundle_source_fences_corrections_and_restore() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_team_test")
    );
    let pg = Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    pg.migrate().await.unwrap();
    if let Ok(stage) = std::env::var("COPILOT_DRILL_STAGE") {
        if stage != "seed" {
            let path = std::path::PathBuf::from(std::env::var("COPILOT_DRILL_LEDGER").unwrap());
            assert!(path.starts_with("/private/tmp/atoaxis-copilot-reports-test"));
            std::env::set_var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH", &path);
            let state = pg
                .query_one("SELECT org,owner FROM copilot_drill_state", &[])
                .await
                .unwrap();
            let org: Uuid = state.get(0);
            let owner: Uuid = state.get(1);
            let trust = TeamTrustRepository::new(pg.clone());
            if stage == "revoke" {
                let before: i64 = pg
                    .query_one(
                        "SELECT generation FROM team_rollouts WHERE organization_id=$1",
                        &[&org],
                    )
                    .await
                    .unwrap()
                    .get(0);
                pg.execute("UPDATE users SET is_active=false WHERE id=$1", &[&owner])
                    .await
                    .unwrap();
                pg.execute("UPDATE users SET is_active=true WHERE id=$1", &[&owner])
                    .await
                    .unwrap();
                assert!(
                    pg.query_one(
                        "SELECT generation FROM team_rollouts WHERE organization_id=$1",
                        &[&org]
                    )
                    .await
                    .unwrap()
                    .get::<_, i64>(0)
                        >= before + 2
                );
                assert_eq!(pg.query_one("SELECT count(*) FROM team_weekly_publications WHERE organization_id=$1 AND invalidated_at IS NULL",&[&org]).await.unwrap().get::<_,i64>(0),0);

                pg.execute(
                    "UPDATE team_github_identities SET revoked_at=now() WHERE user_id=$1",
                    &[&owner],
                )
                .await
                .unwrap();
                pg.execute("UPDATE organization_analytics_consents SET share_aggregate=false WHERE organization_id=$1 AND user_id=$2",&[&org,&owner]).await.unwrap();
                trust.export_registry(&path).await.unwrap();
            } else {
                assert_eq!(stage, "verify");
                assert!(trust.guard(org).await.is_err());
                assert!(trust.export_registry(&path).await.is_err());
                let ledger: Registry =
                    serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
                trust.reconcile_restore(&ledger).await.unwrap();
                assert!(!pg
                    .query_one(
                        "SELECT enabled FROM team_rollouts WHERE organization_id=$1",
                        &[&org]
                    )
                    .await
                    .unwrap()
                    .get::<_, bool>(0));
                assert!(!pg.query_one("SELECT enabled FROM team_copilot_daily_integrations WHERE organization_id=$1",&[&org]).await.unwrap().get::<_,bool>(0));
                assert_eq!(pg.query_one("SELECT count(*) FROM team_weekly_publications WHERE organization_id=$1 AND invalidated_at IS NULL",&[&org]).await.unwrap().get::<_,i64>(0),0);
                assert_eq!(pg.query_one("SELECT count(*) FROM team_copilot_daily_facts WHERE organization_id=$1 AND NOT blocked",&[&org]).await.unwrap().get::<_,i64>(0),0);
                assert!(
                    pg.query_one(
                        "SELECT count(*) FROM team_copilot_daily_facts WHERE organization_id=$1",
                        &[&org]
                    )
                    .await
                    .unwrap()
                    .get::<_, i64>(0)
                        > 0
                );
                trust.export_registry(&path).await.unwrap();
                trust.guard(org).await.unwrap();
            }
            return;
        }
    }

    let today = Utc::now().date_naive();
    let start = today - Duration::days(today.weekday().num_days_from_monday() as i64 + 7);
    let from = start.and_hms_opt(0, 0, 0).unwrap().and_utc();
    let benchmark = std::env::var("COPILOT_REPORT_BENCHMARK").ok().as_deref() == Some("1");
    let historical = from - Duration::days(if benchmark { 84 } else { 1 });
    let org = Uuid::now_v7();
    let team = Uuid::now_v7();
    let other = Uuid::now_v7();
    let users = (0..if benchmark { 100 } else { 10 })
        .map(|_| Uuid::now_v7())
        .collect::<Vec<_>>();
    let account = (Uuid::new_v4().as_u128() & 0x7fffffffffffffff) as i64;
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'synthetic Copilot reports')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO teams(id,organization_id,name,slug) VALUES($1,$2,'test team','test')",
        &[&team, &org],
    )
    .await
    .unwrap();
    for (n, user) in users.iter().enumerate() {
        pg.execute(
            "INSERT INTO users(id,username) VALUES($1,$2)",
            &[&user, &user.to_string()],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,$3,'developer')",&[&org,&user,&if n==0{"owner"}else{"member"}]).await.unwrap();
        pg.execute("INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate,share_individual) VALUES($1,$2,true,false)",&[&org,&user]).await.unwrap();
        let github = account - n as i64;
        pg.execute("INSERT INTO team_github_identities(user_id,github_user_id,login,verified_at) VALUES($1,$2,'synthetic',$3)",&[&user,&github,&historical]).await.unwrap();
        if n < users.len() / 2 {
            pg.execute(
                "INSERT INTO team_members(team_id,user_id) VALUES($1,$2)",
                &[&team, &user],
            )
            .await
            .unwrap();
        }
    }
    pg.execute(
        "UPDATE team_rollouts SET enabled=true WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO team_github_installations(installation_id,organization_id,account_id,account_login,status) VALUES($1,$2,$1,'test','active')",&[&account,&org]).await.unwrap();
    pg.execute("INSERT INTO team_copilot_daily_integrations(organization_id,installation_id,start_day,enabled) VALUES($1,$2,$3,true)",&[&org,&account,&start]).await.unwrap();
    // Independent fixture ledger proves old membership/consent; normal code never backdates it.
    let mut c = pg.transaction_client().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.batch_execute("SET LOCAL session_replication_role=replica")
        .await
        .unwrap();
    tx.execute(
        "UPDATE organization_analytics_consents SET aggregate_from=$2 WHERE organization_id=$1",
        &[&org, &historical],
    )
    .await
    .unwrap();
    tx.execute(
        "UPDATE team_copilot_membership_intervals SET valid_from=$2 WHERE organization_id=$1",
        &[&org, &historical],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let metrics: Value = COUNTERS
        .iter()
        .map(|key| ((*key).to_owned(), json!(1)))
        .collect::<serde_json::Map<_, _>>()
        .into();
    for d in if benchmark { -83..7 } else { 0..7 } {
        let day = start + Duration::days(d);
        pg.execute("INSERT INTO team_copilot_daily_facts(organization_id,user_id,installation_id,day,feature,metrics,payload_hash,consent_version,consent_from,github_user_id,provider_account_id) SELECT $1,c.user_id,$2,$3,'completion',$4,'fixture',c.consent_version,c.aggregate_from,g.github_user_id,$2 FROM organization_analytics_consents c JOIN team_github_identities g USING(user_id) WHERE c.organization_id=$1",&[&org,&account,&day,&metrics]).await.unwrap();
        let mut c = pg.transaction_client().await.unwrap();
        let tx = c.transaction().await.unwrap();
        tx.query_one(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1 FOR UPDATE",
            &[&org],
        )
        .await
        .unwrap();
        commit_day_manifest(&tx, org, day).await.unwrap();
        tx.commit().await.unwrap();
    }
    let auth = AuthorizationService::new(Some(pg.clone()));
    assert!(auth.require_team_read(users[0], org, None).await.is_ok());
    assert!(auth
        .require_team_read(users[users.len() / 2], org, Some(team))
        .await
        .is_err());
    assert!(auth.require_team_read(users[0], other, None).await.is_err());
    let repo = CopilotReportsRepository::new(pg.clone());
    let trust = TeamTrustRepository::new(pg.clone());
    trust.policy(org).await.unwrap();
    assert_eq!(trust.policy(org).await.unwrap(), "Asia/Bangkok");
    let path = std::env::var("COPILOT_DRILL_LEDGER")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::temp_dir().join(format!("copilot-weekly-{}.json", Uuid::now_v7()))
        });

    let empty = Registry {
        schema_version: 1,
        checked_at: Utc::now(),
        organizations: BTreeMap::new(),
        dispositions: vec![],
    };
    std::fs::write(&path, serde_json::to_vec(&empty).unwrap()).unwrap();
    trust.export_registry(&path).await.unwrap();
    let upgraded: Registry = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    assert_eq!(upgraded.schema_version, 2);
    // A crashed older binary must not roll a v2 head back to v1.
    let mut old_candidate = serde_json::to_value(&upgraded).unwrap();
    old_candidate["schema_version"] = serde_json::json!(1);
    std::fs::write(
        path.with_extension("tmp"),
        serde_json::to_vec(&old_candidate).unwrap(),
    )
    .unwrap();
    assert!(trust.export_registry(&path).await.is_err());
    std::fs::remove_file(path.with_extension("tmp")).unwrap();
    std::env::set_var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH", &path);
    trust.guard(org).await.unwrap();
    let report = repo.report(org, None, start).await.unwrap();
    assert_eq!(report.cells[0].value, Some(users.len() as i64 * 7));
    assert_eq!(report.ingestion_status, "reports_ingested");
    assert_eq!(report.capture_status, "unconfirmed");
    let team_report = repo.report(org, Some(team), start).await.unwrap();
    assert_eq!(team_report.cells[0].value, Some(users.len() as i64 / 2 * 7));
    assert_eq!(report.publication_id, team_report.publication_id);
    assert!(crate::services::copilot_reports::csv(&team_report)
        .contains(&format!("\"{}\"", users.len() / 2 * 7)));
    assert!(!crate::services::copilot_reports::csv(&team_report).contains(&users[0].to_string()));
    trust.export_registry(&path).await.unwrap();
    trust.guard(org).await.unwrap();
    assert_eq!(repo.fence(org).await.unwrap(), team_report.fence);
    if benchmark {
        // Exercise the actual service including authorization, disk ledger sync,
        // JSON/CSV construction and the handler's final response gate. Lazy CH
        // is a disabled localhost URL: this PostgreSQL-only path never calls it.
        let ch = Arc::new(
            crate::infrastructure::database::ClickHouseClient::new(
                &crate::config::ClickHouseConfig {
                    url: "http://127.0.0.1:1".into(),
                    user: None,
                    password: None,
                    database: "synthetic_only".into(),
                },
            )
            .await
            .unwrap(),
        );
        let service = crate::services::team_insights::TeamInsightsService::new(
            Some(Arc::new(
                crate::repository::team_insights::TeamInsightsRepository::new(pg.clone(), ch),
            )),
            Arc::new(auth),
            true,
        );
        std::env::set_var("ATOAXIS_COPILOT_DAILY_ENABLED", "1");
        std::env::set_var("ATOAXIS_COPILOT_WEEKLY_ENABLED", "1");
        // Populate immutable releases from twelve full weeks before timing.
        for w in 1..12 {
            let r = service
                .copilot_report(users[0], org, None, start - Duration::days(w * 7), "UTC")
                .await
                .unwrap();
            assert_eq!(r.cells[0].value, Some(700));
        }
        let mut samples = Vec::new();
        for n in 0..20 {
            let at = std::time::Instant::now();
            let r = service
                .copilot_report(
                    users[0],
                    org,
                    if n % 2 == 0 { None } else { Some(team) },
                    start,
                    "UTC",
                )
                .await
                .unwrap();
            assert_eq!(r.cells[0].value, Some(if n % 2 == 0 { 700 } else { 350 }));
            let bytes = serde_json::to_vec(&r).unwrap();
            let csv = crate::services::copilot_reports::csv(&r);
            assert!(!bytes.is_empty() && !csv.is_empty());
            service
                .validate_copilot_response(users[0], &r)
                .await
                .unwrap();
            samples.push(at.elapsed().as_micros() as u64);
        }
        samples.sort();
        let p95 = samples[18];
        eprintln!(
            "copilot_local_service_benchmark={}",
            json!({"members":100,"days":90,"facts":9000,
            "samples":20,"p95_microseconds":p95,"maximum_microseconds":samples[19],
            "scope":"native PostgreSQL service with JSON/CSV and final fence; no HTTP/browser/load concurrency"})
        );
        assert!(p95 <= 2_000_000, "local report service p95 exceeded 2s");
        std::env::remove_var("ATOAXIS_COPILOT_DAILY_ENABLED");
        std::env::remove_var("ATOAXIS_COPILOT_WEEKLY_ENABLED");
    }
    if std::env::var("COPILOT_DRILL_STAGE").ok().as_deref() == Some("seed") {
        pg.execute(
            "CREATE TABLE IF NOT EXISTS copilot_drill_state(org UUID NOT NULL,owner UUID NOT NULL)",
            &[],
        )
        .await
        .unwrap();
        pg.execute("TRUNCATE copilot_drill_state", &[])
            .await
            .unwrap();
        pg.execute(
            "INSERT INTO copilot_drill_state(org,owner) VALUES($1,$2)",
            &[&org, &users[0]],
        )
        .await
        .unwrap();
        return;
    }
    // Identical refresh is a new observation, not a changed equation/revision.
    let entry = trust.registry_entry(org).await.unwrap();
    let mut c = pg.transaction_client().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.query_one(
        "SELECT generation FROM team_rollouts WHERE organization_id=$1 FOR UPDATE",
        &[&org],
    )
    .await
    .unwrap();
    commit_day_manifest(&tx, org, start).await.unwrap();
    tx.commit().await.unwrap();
    assert_eq!(
        trust.registry_entry(org).await.unwrap().copilot_sources,
        entry.copilot_sources
    );
    assert_eq!(
        repo.report(org, None, start).await.unwrap().publication_id,
        report.publication_id
    );
    // Crash before day commit cannot leave either deletion or a source barrier.
    let saved = repo.fence(org).await.unwrap();
    let mut client = pg.transaction_client().await.unwrap();
    let rollback = client.transaction().await.unwrap();
    rollback
        .query_one(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1 FOR UPDATE",
            &[&org],
        )
        .await
        .unwrap();
    rollback
        .execute(
            "DELETE FROM team_copilot_daily_facts WHERE organization_id=$1 AND day=$2",
            &[&org, &start],
        )
        .await
        .unwrap();
    commit_day_manifest(&rollback, org, start).await.unwrap();
    rollback.rollback().await.unwrap();
    assert_eq!(repo.fence(org).await.unwrap(), saved);
    assert_eq!(
        repo.report(org, None, start).await.unwrap().cells[0].value,
        report.cells[0].value
    );
    // Serialize correction with publication; no corrected numeric republish.
    let before = repo.fence(org).await.unwrap();
    let mut c = pg.transaction_client().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.query_one(
        "SELECT generation FROM team_rollouts WHERE organization_id=$1 FOR UPDATE",
        &[&org],
    )
    .await
    .unwrap();
    tx.execute(
        "DELETE FROM team_copilot_daily_facts WHERE organization_id=$1 AND day=$2",
        &[&org, &start],
    )
    .await
    .unwrap();
    commit_day_manifest(&tx, org, start).await.unwrap();
    let reader_pg = pg.clone();
    let reader = tokio::spawn(async move {
        CopilotReportsRepository::new(reader_pg)
            .report(org, None, start)
            .await
    });
    // Confirm the reader actually waits on the publication authority, rather
    // than merely sequencing two requests in the test process.
    tokio::time::timeout(std::time::Duration::from_secs(3),async {
        loop {
            if pg.query_one("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname='atoaxis_team_test' AND wait_event_type='Lock' AND query LIKE 'SELECT generation FROM team_rollouts%')",&[]).await.unwrap().get::<_,bool>(0) {break;}
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    }).await.expect("report reader did not contend on publication lock");
    assert!(!reader.is_finished());
    tx.commit().await.unwrap();
    let serialized = reader.await.unwrap().unwrap();
    assert_eq!(serialized.status, "invalidated");
    assert!(serialized.cells.iter().all(|c| c.value.is_none()));
    assert_ne!(repo.fence(org).await.unwrap(), before);
    assert!(trust.guard(org).await.is_err());
    let invalid = repo.report(org, None, start).await.unwrap();
    assert_eq!(invalid.status, "invalidated");
    assert!(invalid.cells.iter().all(|c| c.value.is_none()));
    trust.export_registry(&path).await.unwrap();
    trust.guard(org).await.unwrap();
    let ch = Arc::new(
        crate::infrastructure::database::ClickHouseClient::new(&crate::config::ClickHouseConfig {
            url: "http://127.0.0.1:1".into(),
            user: None,
            password: None,
            database: "synthetic_only".into(),
        })
        .await
        .unwrap(),
    );
    let service = crate::services::team_insights::TeamInsightsService::new(
        Some(Arc::new(
            crate::repository::team_insights::TeamInsightsRepository::new(pg.clone(), ch),
        )),
        Arc::new(AuthorizationService::new(Some(pg.clone()))),
        true,
    );
    std::env::set_var("ATOAXIS_COPILOT_DAILY_ENABLED", "1");
    std::env::set_var("ATOAXIS_COPILOT_WEEKLY_ENABLED", "1");
    let old_json = serde_json::to_vec(&report).unwrap();
    let old_csv = crate::services::copilot_reports::csv(&report);
    assert!(!old_json.is_empty() && !old_csv.is_empty());
    assert!(service
        .validate_copilot_response(users[0], &report)
        .await
        .is_err());
    service
        .validate_copilot_response(users[0], &invalid)
        .await
        .unwrap();
    std::env::remove_var("ATOAXIS_COPILOT_DAILY_ENABLED");
    std::env::remove_var("ATOAXIS_COPILOT_WEEKLY_ENABLED");
    // Replaying an old source state cannot overwrite a newer independent ledger.
    let checkpoint=pg.query_one("SELECT revision,fingerprint FROM team_copilot_day_manifests WHERE organization_id=$1 AND day=$2",&[&org,&start]).await.unwrap();
    pg.execute("UPDATE team_copilot_day_manifests SET revision=1,fingerprint='old_backup' WHERE organization_id=$1 AND day=$2",&[&org,&start]).await.unwrap();
    assert!(trust.guard(org).await.is_err());
    assert!(trust.export_registry(&path).await.is_err());
    pg.execute("UPDATE team_copilot_day_manifests SET revision=$3,fingerprint=$4 WHERE organization_id=$1 AND day=$2",&[&org,&start,&checkpoint.get::<_,i64>(0),&checkpoint.get::<_,String>(1)]).await.unwrap();
    // Consent withdrawal is immediately a generation barrier, including cached/export responses.
    let fence = repo.fence(org).await.unwrap();
    pg.execute("UPDATE organization_analytics_consents SET share_aggregate=false WHERE organization_id=$1 AND user_id=$2",&[&org,&users[0]]).await.unwrap();
    assert_ne!(repo.fence(org).await.unwrap(), fence);
    trust.export_registry(&path).await.unwrap();
    let ledger: Registry = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    trust.reconcile_restore(&ledger).await.unwrap();
    assert!(!pg
        .query_one(
            "SELECT enabled FROM team_copilot_daily_integrations WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    assert!(repo.report(org, None, start).await.is_err());
    assert!(pg.query_one("SELECT count(*) FROM team_weekly_publications WHERE organization_id=$1 AND invalidated_at IS NULL",&[&org]).await.unwrap().get::<_,i64>(0)==0);
    std::fs::remove_file(path).unwrap();
}

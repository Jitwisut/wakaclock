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
                // The backup was taken at cost source revision 3. Preserve a
                // newer independent head 10 across an actual dump/restore.
                for _ in 0..7 {
                    pg.execute("UPDATE team_work_items SET merged_at=merged_at+interval '1 second' WHERE organization_id=$1 AND external_id=991",&[&org]).await.unwrap();
                }
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
                let source_head = ledger
                    .dispositions
                    .iter()
                    .filter(|d| {
                        d.provider == "team_cost_source"
                            && d.delivery_id.starts_with(&format!("{org}:"))
                    })
                    .map(|d| {
                        d.delivery_id
                            .split_once(':')
                            .unwrap()
                            .1
                            .parse::<i64>()
                            .unwrap()
                    })
                    .max()
                    .unwrap();
                assert_eq!(source_head, 10);
                assert_eq!(
                    pg.query_one(
                        "SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1",
                        &[&org]
                    )
                    .await
                    .unwrap()
                    .get::<_, i64>(0),
                    3
                );
                trust.reconcile_restore(&ledger).await.unwrap();
                assert_eq!(
                    pg.query_one(
                        "SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1",
                        &[&org]
                    )
                    .await
                    .unwrap()
                    .get::<_, i64>(0),
                    source_head + 1
                );
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
    // Source-only PR corrections advance an operational clock without wiping
    // every privacy publication. Rollback rolls back both marker and mutation.
    let source_repo = Uuid::now_v7();
    let project = Uuid::now_v7();
    pg.execute("INSERT INTO team_repository_scopes(organization_id,repository_id,github_repository_id,github_installation_id,project_id,enabled) VALUES($1,$2,$3,$3,$4,TRUE)",&[&org,&source_repo,&account,&project]).await.unwrap();
    let generation: i64 = pg
        .query_one(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get(0);
    let revision: i64 = pg
        .query_one(
            "SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap()
        .get(0);
    pg.execute("INSERT INTO team_work_items(organization_id,repository_id,external_id,kind,number,state,opened_at,merged_at,provider_updated_at) VALUES($1,$2,991,'pull_request',991,'merged',$3,$3,$3)",&[&org,&source_repo,&from]).await.unwrap();
    pg.execute("UPDATE team_work_items SET merged_at=merged_at+interval '1 second' WHERE organization_id=$1 AND external_id=991",&[&org]).await.unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT generation FROM team_rollouts WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        generation
    );
    assert_eq!(
        pg.query_one(
            "SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        revision + 2
    );
    pg.execute("UPDATE team_work_items SET merged_at=merged_at WHERE organization_id=$1 AND external_id=991",&[&org]).await.unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        revision + 2
    );
    let mut clock_client = pg.transaction_client().await.unwrap();
    let clock_tx = clock_client.transaction().await.unwrap();
    clock_tx
        .execute(
            "DELETE FROM team_work_items WHERE organization_id=$1 AND external_id=991",
            &[&org],
        )
        .await
        .unwrap();
    clock_tx.rollback().await.unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        revision + 2
    );
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
        std::env::set_var("ATOAXIS_TEAM_WORKFLOW_ENABLED", "1");
        // Populate immutable releases from twelve full weeks before timing.
        for w in 1..12 {
            let r = service
                .copilot_report(users[0], org, None, start - Duration::days(w * 7), "UTC")
                .await
                .unwrap();
            assert_eq!(r.cells[0].value, Some(700));
        }
        let request = crate::services::team_comparison::Request {
            family: crate::services::team_comparison::Family::Copilot,
            baseline_week: start - Duration::days(7),
            followup_week: start,
            timezone: "UTC".into(),
            team_id: None,
        };
        let comparison = service
            .weekly_comparison(users[0], org, request)
            .await
            .unwrap();
        assert_eq!(comparison.changes[0].difference.as_deref(), Some("0"));
        service
            .validate_weekly_comparison(users[0], &comparison)
            .await
            .unwrap();
        assert!(!serde_json::to_string(&comparison)
            .unwrap()
            .contains("copilot_proof"));
        std::env::remove_var("ATOAXIS_TEAM_WORKFLOW_ENABLED");
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
    // An operational action resolves only current admitted aggregate reports;
    // its owner receives no individual sharing grant. Editing its revision
    // during response construction closes the old bound comparison.
    std::env::set_var("ATOAXIS_TEAM_WORKFLOW_ENABLED", "1");
    let action_id = Uuid::now_v7();
    let mut action = crate::services::team_actions::Edit {
        request_id: Uuid::new_v4(),
        expected_revision: 0,
        owner_id: users[0],
        title: "Evaluate completion adoption".into(),
        focus: "tool_evaluation".into(),
        family: crate::services::team_comparison::Family::Copilot,
        baseline_week: start - Duration::days(7),
        followup_week: start,
        status: "active".into(),
    };
    service
        .mutate_action(users[0], org, action_id, None, Some(&action), None)
        .await
        .unwrap();
    let bound = service
        .action_comparison(users[0], org, action_id, None)
        .await
        .unwrap();
    assert_eq!(bound.action_revision, 1);
    assert_eq!(bound.report.baseline.timezone, "UTC");
    assert!(bound.report.changes.iter().all(|c| c.difference.is_none()));
    let encoded = serde_json::to_vec(&bound).unwrap();
    assert!(!String::from_utf8(encoded).unwrap().contains("action_proof"));
    service
        .validate_action_comparison(users[0], org, &bound)
        .await
        .unwrap();
    let summary_request = crate::services::team_weekly_summary::Request {
        family: crate::services::team_comparison::Family::Copilot,
        week_start: start,
        timezone: "UTC".into(),
        team_id: None,
        include_actions: true,
        actions_after: None,
    };
    let first_summary = service
        .weekly_summary(users[0], org, summary_request.clone())
        .await
        .unwrap();
    assert_eq!(first_summary.actions.len(), 1);
    assert_eq!(
        first_summary.action_basis,
        "current_metadata_at_read_time_not_historical_status"
    );
    assert!(first_summary.cells.iter().all(|c| c.value.is_none()));
    let serialized = serde_json::to_string(&first_summary).unwrap();
    assert!(!serialized.contains("action_proof") && !serialized.contains("copilot_proof"));
    // Earliest IDs are a different family or do not intersect the selected week.
    // Filter before pagination; full CSV must include later matches exactly once.
    for i in 0..30 {
        let mut other = action.clone();
        other.request_id = Uuid::new_v4();
        other.title = format!("Nonmatching action {i}");
        if i % 2 == 0 {
            other.family = crate::services::team_comparison::Family::TeamCost;
        } else {
            other.baseline_week = start - Duration::days(21);
            other.followup_week = start - Duration::days(14);
        }
        service
            .mutate_action(users[0], org, Uuid::now_v7(), None, Some(&other), None)
            .await
            .unwrap();
    }
    for i in 0..35 {
        let mut matching = action.clone();
        matching.request_id = Uuid::new_v4();
        matching.title = format!("Matching action {i}");
        service
            .mutate_action(users[0], org, Uuid::now_v7(), None, Some(&matching), None)
            .await
            .unwrap();
    }
    let summary = service
        .weekly_summary(users[0], org, summary_request.clone())
        .await
        .unwrap();
    assert_eq!(summary.actions.len(), 25);
    assert!(summary.actions.iter().all(|a| a.family
        == crate::services::team_comparison::Family::Copilot
        && a.followup_week >= start));
    let mut next_request = summary_request.clone();
    next_request.actions_after = summary.actions_next_cursor;
    let next = service
        .weekly_summary(users[0], org, next_request.clone())
        .await
        .unwrap();
    assert_eq!(next.actions.len(), 11);
    assert!(next.actions_next_cursor.is_none());
    assert!(service
        .weekly_summary_export(users[0], org, next_request)
        .await
        .is_err());
    let full = service
        .weekly_summary_export(users[0], org, summary_request.clone())
        .await
        .unwrap();
    assert_eq!(full.actions.len(), 36);
    assert_eq!(
        full.actions
            .iter()
            .map(|a| a.id)
            .collect::<std::collections::BTreeSet<_>>()
            .len(),
        36
    );
    assert!(full.actions_next_cursor.is_none());
    let full_csv = crate::services::team_weekly_summary::csv(&full);
    assert_eq!(
        full_csv
            .lines()
            .filter(|l| l.starts_with("\"action_current_metadata\""))
            .count(),
        36
    );
    service
        .validate_weekly_summary(users[0], &full)
        .await
        .unwrap();
    assert!(service
        .validate_weekly_summary(users[0], &first_summary)
        .await
        .is_err());
    let action_generation = trust.registry_entry(org).await.unwrap().generation;
    action.expected_revision = 1;
    action.request_id = Uuid::new_v4();
    action.title = "Follow up on completion adoption".into();
    service
        .mutate_action(users[0], org, action_id, None, Some(&action), None)
        .await
        .unwrap();
    assert_eq!(
        trust.registry_entry(org).await.unwrap().generation,
        action_generation
    );
    assert!(service
        .validate_action_comparison(users[0], org, &bound)
        .await
        .is_err());
    assert!(service
        .validate_weekly_summary(users[0], &full)
        .await
        .is_err());
    let fresh_summary = service
        .weekly_summary_export(users[0], org, summary_request)
        .await
        .unwrap();
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
    assert!(service
        .validate_weekly_summary(users[0], &fresh_summary)
        .await
        .is_err());
    pg.execute("UPDATE organization_members SET deactivated_at=now() WHERE organization_id=$1 AND user_id=$2", &[&org,&users[0]]).await.unwrap();
    assert!(service
        .validate_weekly_summary(users[0], &fresh_summary)
        .await
        .is_err());
    pg.execute("UPDATE organization_members SET deactivated_at=NULL WHERE organization_id=$1 AND user_id=$2", &[&org,&users[0]]).await.unwrap();
    trust.export_registry(&path).await.unwrap();
    std::env::remove_var("ATOAXIS_TEAM_WORKFLOW_ENABLED");
    std::env::remove_var("ATOAXIS_COPILOT_DAILY_ENABLED");
    std::env::remove_var("ATOAXIS_COPILOT_WEEKLY_ENABLED");

    // Independent ledger is newer than the restored backup's operational clock:
    // revision 3 -> 10. Restore must import the original markers before disabling
    // the repository creates revision 11, never reuse ordinal 4 with a new date.
    let backup_revision = revision + 2;
    for _ in 0..7 {
        pg.execute("UPDATE team_work_items SET merged_at=merged_at+interval '1 second' WHERE organization_id=$1 AND external_id=991",&[&org]).await.unwrap();
    }
    trust.export_registry(&path).await.unwrap();
    let ledger: Registry = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    let source_head = backup_revision + 7;
    assert_eq!(
        pg.query_one(
            "SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        source_head
    );
    pg.execute("DELETE FROM team_webhook_dispositions WHERE provider='team_cost_source' AND split_part(delivery_id,':',1)=$1 AND split_part(delivery_id,':',2)::bigint>$2",&[&org.to_string(),&backup_revision]).await.unwrap();
    pg.execute(
        "UPDATE team_cost_source_revisions SET revision=$2 WHERE organization_id=$1",
        &[&org, &backup_revision],
    )
    .await
    .unwrap();
    let original = ledger
        .dispositions
        .iter()
        .find(|d| {
            d.provider == "team_cost_source"
                && d.delivery_id == format!("{}:{}", org, backup_revision + 1)
        })
        .unwrap();
    let conflicting_at = original.disposed_at + Duration::seconds(1);
    pg.execute("INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at) VALUES($1,$2,$3,$4,$5)",&[&original.provider,&original.delivery_id,&original.payload_hash,&original.reason,&conflicting_at]).await.unwrap();
    assert!(trust.reconcile_restore(&ledger).await.is_err());
    assert!(pg.query_one("SELECT enabled FROM team_repository_scopes WHERE organization_id=$1 AND repository_id=$2",&[&org,&source_repo]).await.unwrap().get::<_,bool>(0));
    assert_eq!(
        pg.query_one(
            "SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        backup_revision
    );
    pg.execute(
        "DELETE FROM team_webhook_dispositions WHERE provider=$1 AND delivery_id=$2",
        &[&original.provider, &original.delivery_id],
    )
    .await
    .unwrap();
    trust.reconcile_restore(&ledger).await.unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT revision FROM team_cost_source_revisions WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        source_head + 1
    );
    assert_eq!(pg.query_one("SELECT disposed_at FROM team_webhook_dispositions WHERE provider=$1 AND delivery_id=$2",&[&original.provider,&original.delivery_id]).await.unwrap().get::<_,chrono::DateTime<Utc>>(0),original.disposed_at);
    trust.export_registry(&path).await.unwrap();
    trust.guard(org).await.unwrap();
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

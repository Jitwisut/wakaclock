//! Joint PostgreSQL/real ClickHouse report faults. Synthetic metadata only.
use crate::{
    config::PostgresConfig,
    infrastructure::{database::ClickHouseClient, postgres::PostgresClient},
    model::ai_usage::AiUsageEventRow,
    repository::{
        ai_usage::AiUsageRepository,
        team_insights::TeamInsightsRepository,
        team_trust::{Registry, TeamTrustRepository},
    },
    services::{
        authorization::AuthorizationService,
        team_comparison::{Family, Request},
        team_insights::TeamInsightsService,
    },
};
use axum::{
    body::Bytes,
    extract::{OriginalUri, State},
    http::{Method, StatusCode},
    routing::any,
    Router,
};
use chrono::{Datelike, Duration, Utc};
use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tokio::sync::Notify;
use uuid::Uuid;

struct Gate {
    upstream: String,
    armed: AtomicBool,
    after_read: AtomicBool,
    entered: Notify,
    release: Notify,
}
async fn forward(
    State(g): State<Arc<Gate>>,
    OriginalUri(uri): OriginalUri,
    method: Method,
    body: Bytes,
) -> (StatusCode, Bytes) {
    let query_marker = "FROM wakaclock.ai_usage_events FINAL";
    let usage_read = String::from_utf8_lossy(&body).contains(query_marker)
        || reqwest::Url::parse(&format!("http://fixture{uri}"))
            .unwrap()
            .query_pairs()
            .any(|(key, value)| key == "query" && value.contains(query_marker));
    let stop = usage_read && g.armed.swap(false, Ordering::SeqCst);
    let after = g.after_read.load(Ordering::SeqCst);
    if stop && !after {
        g.entered.notify_one();
        g.release.notified().await;
    }
    let response = reqwest::Client::new()
        .request(
            reqwest::Method::from_bytes(method.as_str().as_bytes()).unwrap(),
            format!("{}{uri}", g.upstream),
        )
        .body(body)
        .send()
        .await
        .unwrap();
    let status = StatusCode::from_u16(response.status().as_u16()).unwrap();
    let bytes = response.bytes().await.unwrap();
    if stop && after {
        g.entered.notify_one();
        g.release.notified().await;
    }
    (status, bytes)
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL and real CLICKHOUSE_TEST_URL"]
async fn team_cost_joint_canonical_correction_and_pg_source_races() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_team_test")
    );
    let upstream = std::env::var("CLICKHOUSE_TEST_URL").unwrap();
    assert_eq!(upstream, "http://127.0.0.1:58125", "dedicated fixture only");
    let pg = Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let direct = crate::test_support::clickhouse_client().await;
    let usage = AiUsageRepository::new(direct.clone());
    usage.migrate().await.unwrap();
    let gate = Arc::new(Gate {
        upstream,
        armed: AtomicBool::new(false),
        after_read: AtomicBool::new(false),
        entered: Notify::new(),
        release: Notify::new(),
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let router = Router::new()
        .route("/", any(forward))
        .with_state(gate.clone());
    let proxy = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    let ch = Arc::new(
        ClickHouseClient::new(&crate::config::ClickHouseConfig {
            url: format!("http://{address}"),
            user: None,
            password: None,
            database: "wakaclock".into(),
        })
        .await
        .unwrap(),
    );
    let org = Uuid::now_v7();
    let repository = Uuid::now_v7();
    let project = Uuid::now_v7();
    let now = Utc::now();
    let monday = now.date_naive() - Duration::days(i64::from(now.weekday().num_days_from_monday()));
    let followup = monday - Duration::days(7);
    let baseline = followup - Duration::days(7);
    let at = |d: chrono::NaiveDate| d.and_hms_opt(12, 0, 0).unwrap().and_utc();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Joint cost fixture')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    let mut users = vec![];
    let mut facts = vec![];
    for i in 0..5 {
        let user = Uuid::now_v7();
        users.push(user);
        pg.execute(
            "INSERT INTO users(id,username) VALUES($1,$2)",
            &[&user, &user.to_string()],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,$3,'developer')",&[&org,&user,&if i==0 {"owner"} else {"member"}]).await.unwrap();
        pg.execute("INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate,share_individual) VALUES($1,$2,TRUE,TRUE)",&[&org,&user]).await.unwrap();
        pg.execute("UPDATE organization_analytics_consents SET aggregate_from=$3,individual_from=$3 WHERE organization_id=$1 AND user_id=$2",&[&org,&user,&(at(baseline)-Duration::days(14))]).await.unwrap();
        for (week, cost) in [(baseline, 100), (followup, 200)] {
            let timestamp = at(week).timestamp() as u32;
            facts.push(AiUsageEventRow {
                user_id: user,
                date: (timestamp / 86400) as u16,
                usage_event_id: format!("fixture-{user}-{week}"),
                event_payload_hash: Some(format!("fixture-{cost}")),
                ai_session_id: format!("session-{week}"),
                collector_id: Some("fixture".into()),
                event_time: timestamp,
                project_id: Some(project),
                project_attribution_method: Some("explicit_project_hint".into()),
                ai_agent: "Fixture".into(),
                ai_provider: Some("fixture".into()),
                ai_model: Some("fixture-v1".into()),
                prompt_count: 0,
                prompt_character_count: None,
                input_tokens: Some(10),
                output_tokens: Some(20),
                cache_read_tokens: Some(0),
                cache_write_tokens: Some(0),
                estimated_cost_microusd: Some(cost),
                pricing_version: Some("fixture-price-v1".into()),
                token_source: "provider".into(),
                version: 1,
                received_at: timestamp,
            });
        }
    }
    // Seed a historical-consent backup, as the existing provider fixture does.
    // Runtime consent changes still start now; no normal API can backdate sharing.
    let mut historical_client = pg.transaction_client().await.unwrap();
    let tx = historical_client.transaction().await.unwrap();
    tx.batch_execute("SET LOCAL session_replication_role=replica")
        .await
        .unwrap();
    tx.execute("UPDATE organization_analytics_consents SET aggregate_from=$2,individual_from=$2 WHERE organization_id=$1", &[&org,&(at(baseline)-Duration::days(14))]).await.unwrap();
    tx.execute(
        "UPDATE team_consent_history SET effective_at=$2 WHERE organization_id=$1",
        &[&org, &(at(baseline) - Duration::days(14))],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    pg.execute("INSERT INTO team_repository_scopes(organization_id,repository_id,github_repository_id,github_installation_id,project_id,enabled) VALUES($1,$2,99101,99102,$3,TRUE)",&[&org,&repository,&project]).await.unwrap();
    for (week, id) in [(baseline, 1_i64), (followup, 2)] {
        pg.execute("INSERT INTO team_work_items(organization_id,repository_id,external_id,kind,number,state,opened_at,merged_at,provider_updated_at) VALUES($1,$2,$3::bigint,'pull_request',($3::bigint)::integer,'closed',$4,$5,$5)",&[&org,&repository,&id,&at(week),&(at(week)+Duration::hours(1))]).await.unwrap();
        for fact in facts
            .iter()
            .filter(|f| f.event_time == at(week).timestamp() as u32)
        {
            pg.execute("INSERT INTO team_session_links(id,organization_id,user_id,repository_id,work_item_id,session_id,status,evidence) VALUES($1,$2,$3,$4,$5,$6,'confirmed','owner_confirmation')",&[&Uuid::now_v7(),&org,&fact.user_id,&repository,&id,&crate::services::team_merged_cost::session(fact)]).await.unwrap();
        }
    }
    usage.insert_usage_events(&facts).await.unwrap();
    let trust = TeamTrustRepository::new(pg.clone());
    trust.policy(org).await.unwrap();
    let path = std::env::temp_dir().join(format!("atoaxis-joint-cost-ledger-{org}.json"));
    std::fs::write(
        &path,
        serde_json::to_vec(&Registry {
            schema_version: 1,
            checked_at: now,
            organizations: BTreeMap::new(),
            dispositions: vec![],
        })
        .unwrap(),
    )
    .unwrap();
    std::env::set_var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH", &path);
    std::env::set_var("ATOAXIS_TEAM_WORKFLOW_ENABLED", "1");
    pg.execute(
        "UPDATE team_rollouts SET enabled=TRUE WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    trust.export_registry(&path).await.unwrap();
    let team_repo = Arc::new(TeamInsightsRepository::new(pg.clone(), ch));
    let service = Arc::new(TeamInsightsService::new(
        Some(team_repo.clone()),
        Arc::new(AuthorizationService::new(Some(pg.clone()))),
        true,
    ));
    let actor = users[0];
    // The commercial path must produce the same independent report ledger after
    // autonomous admission, rather than admitting on the first dashboard request.
    let financial_guard_fixture =
        crate::infrastructure::team_financial_guard::TestLedger::new(&[org]);
    super::team_analytics_entitlement::start_trial(
        &pg,
        org,
        actor,
        10,
        &financial_guard_fixture.deployment(),
    )
    .await
    .unwrap();
    let mut entitlement = crate::services::team_analytics_entitlement::State::trial(
        10,
        at(baseline) - Duration::days(1),
    )
    .unwrap();
    entitlement
        .windows
        .push(crate::services::team_analytics_entitlement::Window {
            kind: crate::services::team_analytics_entitlement::Kind::Paid,
            start: entitlement.trial_ends_at,
            end: Utc::now() + Duration::days(30),
        });
    // Synthetic historical commercial fixture only; no runtime API backdates trial.
    pg.execute(
        "UPDATE team_analytics_entitlements SET state=$2 WHERE organization_id=$1",
        &[&org, &serde_json::to_value(&entitlement).unwrap()],
    )
    .await
    .unwrap();
    let read_guard = crate::infrastructure::team_financial_guard::TestLedger::enrolled(org, &entitlement);
    let _financial_environment = read_guard.environment();
    trust.export_registry(&path).await.unwrap();
    assert!(team_repo
        .admitted_facts(
            org,
            &users,
            at(baseline).timestamp() as u32,
            Utc::now().timestamp() as u32
        )
        .await
        .unwrap()
        .is_empty());
    crate::services::team_usage_admission_worker::tick(&team_repo, &trust)
        .await
        .unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_usage_admissions WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        10
    );
    // A completed sweep restarts independently to find late identities, even with
    // lexical keys before the previous cursor; no received_at watermark is used.
    let mut delayed = facts[0].clone();
    delayed.usage_event_id = "000-late-canonical".into();
    delayed.event_time = Utc::now().timestamp() as u32;
    delayed.date = (delayed.event_time / 86400) as u16;
    delayed.received_at = delayed.event_time;
    usage.insert_usage_events(&[delayed.clone()]).await.unwrap();
    assert!(team_repo
        .admitted_facts(org, &users, delayed.event_time, delayed.event_time + 1)
        .await
        .unwrap()
        .is_empty());
    pg.execute("UPDATE team_usage_admission_scans SET next_run_at=clock_timestamp() WHERE organization_id=$1",&[&org]).await.unwrap();
    crate::services::team_usage_admission_worker::tick(&team_repo, &trust)
        .await
        .unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_usage_admissions WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        11
    );
    assert_eq!(
        team_repo
            .admitted_facts(org, &users, delayed.event_time, delayed.event_time + 1)
            .await
            .unwrap()
            .len(),
        1
    );
    let request = Request {
        family: Family::TeamCost,
        baseline_week: baseline,
        followup_week: followup,
        timezone: "Asia/Bangkok".into(),
        team_id: None,
    };
    let report = service
        .weekly_comparison(actor, org, request.clone())
        .await
        .unwrap();
    assert_eq!(
        report.baseline.cells["estimated_ai_cost_microusd"].value,
        Some(500)
    );
    assert_eq!(
        report.followup.cells["estimated_ai_cost_microusd"].value,
        Some(1000)
    );
    service
        .validate_weekly_comparison(actor, &report)
        .await
        .unwrap();
    let summary_request = crate::services::team_weekly_summary::Request {
        family: Family::TeamCost,
        week_start: followup,
        timezone: "Asia/Bangkok".into(),
        team_id: None,
        include_actions: false,
        actions_after: None,
    };
    let summary = service
        .weekly_summary_export(actor, org, summary_request.clone())
        .await
        .unwrap();
    assert_eq!(
        summary
            .cells
            .iter()
            .find(|c| c.metric == "merged_pr_cost")
            .unwrap()
            .value
            .as_deref(),
        Some("1000")
    );
    assert!(crate::services::team_weekly_summary::csv(&summary).contains("\"1000\""));
    // A real canonical correction arriving after serialization invalidates both outputs.
    let mut corrected = facts[1].clone();
    corrected.version = 2;
    corrected.estimated_cost_microusd = Some(350);
    corrected.event_payload_hash = Some("fixture-price-correction".into());
    usage
        .insert_usage_events(&[corrected.clone()])
        .await
        .unwrap();
    assert!(service
        .validate_weekly_summary(actor, &summary)
        .await
        .is_err());
    assert!(service
        .validate_weekly_comparison(actor, &report)
        .await
        .is_err());
    // The normal privacy worker exports the newly invalidated generation.
    trust.export_registry(&path).await.unwrap();
    // Published correction is withheld; it cannot be republished as a revised number.
    let withheld = service
        .weekly_summary(actor, org, summary_request.clone())
        .await
        .unwrap();
    assert!(withheld.cells.iter().all(|c| c.value.is_none()));
    // Current ingress rejects changing time/date for one payload ID. A restored or
    // future canonical revision still must never resurrect its older physical date.
    let mut moved = corrected.clone();
    moved.version = 3;
    moved.event_time = at(followup + Duration::days(8)).timestamp() as u32;
    moved.date = (moved.event_time / 86400) as u16;
    usage.insert_usage_events(&[moved.clone()]).await.unwrap();
    assert!(
        service
            .validate_weekly_summary(actor, &withheld)
            .await
            .is_err(),
        "new logical revision outside week cannot leave old proof valid"
    );
    let retention = crate::services::team_trust::cutoff(Utc::now()).timestamp() as u32;
    let end = at(followup + Duration::days(7)).timestamp() as u32;
    let selected = team_repo.facts(&users, retention, end).await.unwrap();
    assert!(
        !selected
            .iter()
            .any(|f| f.usage_event_id == moved.usage_event_id),
        "canonical selection must precede week filter across physical dates"
    );
    moved.version = 4;
    moved.event_time = retention - 86400;
    moved.date = (moved.event_time / 86400) as u16;
    usage.insert_usage_events(&[moved]).await.unwrap();
    let selected = team_repo.facts(&users, retention, end).await.unwrap();
    assert!(
        !selected
            .iter()
            .any(|f| f.usage_event_id == corrected.usage_event_id),
        "canonical selection must precede retention filter across physical dates"
    );
    corrected.version = 5;
    usage
        .insert_usage_events(&[corrected.clone()])
        .await
        .unwrap();
    trust.export_registry(&path).await.unwrap();
    // During joint source capture PG changes between its revision and canonical read.
    gate.after_read.store(false, Ordering::SeqCst);
    gate.armed.store(true, Ordering::SeqCst);
    let s = service.clone();
    let q = request.clone();
    let pending = tokio::spawn(async move { s.weekly_comparison(actor, org, q).await });
    tokio::time::timeout(std::time::Duration::from_secs(10), gate.entered.notified())
        .await
        .unwrap();
    pg.execute("UPDATE team_work_items SET merged_at=merged_at+interval '1 second' WHERE organization_id=$1 AND external_id=1",&[&org]).await.unwrap();
    trust.export_registry(&path).await.unwrap();
    gate.release.notify_one();
    assert!(pending.await.unwrap().is_err());
    // Canonical response is already captured, then a correction occurs before it returns.
    gate.after_read.store(true, Ordering::SeqCst);
    gate.armed.store(true, Ordering::SeqCst);
    let s = service.clone();
    let q = request.clone();
    let pending = tokio::spawn(async move { s.weekly_comparison(actor, org, q).await });
    tokio::time::timeout(std::time::Duration::from_secs(10), gate.entered.notified())
        .await
        .unwrap();
    corrected.version = 6;
    corrected.estimated_cost_microusd = None;
    corrected.pricing_version = None;
    corrected.event_payload_hash = Some("fixture-unknown-price".into());
    usage.insert_usage_events(&[corrected]).await.unwrap();
    gate.release.notify_one();
    assert!(pending.await.unwrap().is_err());
    // Independent financial proof is not the privacy generation. A completed
    // billing transition during read/render must still invalidate the response.
    trust.export_registry(&path).await.unwrap();
    let range = crate::model::date_range::ResolvedRange::parse(
        &baseline.to_string(), &(baseline + Duration::days(6)).to_string(), Some("Asia/Bangkok")
    ).unwrap();
    let captured = service.insights(actor, org, None, range).await.unwrap();
    let receipt = service.receipt(actor, org, None, repository, 1).await.unwrap();
    let own_receipt = service.receipt_page(actor, org, None, repository, 1, None, true).await.unwrap();
    service.validate_financial_response(org, &receipt.financial_fence).await.unwrap();
    service.validate_financial_response(org, &own_receipt.financial_fence).await.unwrap();
    assert!(!serde_json::to_string(&receipt).unwrap().contains("financial_fence"));
    let serialized = serde_json::to_string(&captured).unwrap();
    assert!(!serialized.contains("financial_fence"));
    assert!(!serialized.contains(&read_guard.guard.namespace().unwrap().to_string()));
    service.validate_financial_response(org, &captured.financial_fence).await.unwrap();
    let generation = team_repo.generation(org).await.unwrap();
    let mut changed = entitlement.clone();
    changed.revision += 1;
    changed.observed_at = Utc::now();
    let transition = Uuid::now_v7();
    read_guard.guard.prepare(org, crate::services::team_financial_guard::Head::Enrolled { state: Box::new(entitlement) }, crate::services::team_financial_guard::Pending { transition_id: transition, state: Box::new(changed.clone()) }).unwrap();
    assert!(service.validate_financial_response(org, &captured.financial_fence).await.is_err());
    pg.execute("UPDATE team_analytics_entitlements SET revision=$2,state=$3 WHERE organization_id=$1", &[&org,&changed.revision,&serde_json::to_value(&changed).unwrap()]).await.unwrap();
    read_guard.guard.confirm_committed(org, transition, &changed).unwrap();
    assert!(service.validate_financial_response(org, &receipt.financial_fence).await.is_err());
    assert!(service.validate_financial_response(org, &own_receipt.financial_fence).await.is_err());
    assert_eq!(team_repo.generation(org).await.unwrap(), generation);
    assert!(service.validate_financial_response(org, &captured.financial_fence).await.is_err(), "current agreement alone must not approve an older response");
    assert!(service.weekly_summary(actor, org, summary_request).await.is_ok(), "fresh read may retain expired/historical receipts under a newly matching proof");
    proxy.abort();
    std::env::remove_var("ATOAXIS_TEAM_WORKFLOW_ENABLED");
    std::fs::remove_file(path).unwrap();
}

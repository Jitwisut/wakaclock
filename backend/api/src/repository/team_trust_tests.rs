//! Synthetic-only local integration; never uses POSTGRES_URL.
use crate::{
    config::PostgresConfig,
    infrastructure::postgres::PostgresClient,
    repository::team_trust::{Registry, TeamTrustRepository},
};
use chrono::{NaiveDate, Utc};
use std::{collections::BTreeSet, sync::Arc};
use uuid::Uuid;
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn weekly_registry_revocation_cleanup_and_restore() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_team_test")
    );
    let pg = Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url.clone()),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    pg.migrate().await.unwrap();
    let org = Uuid::now_v7();
    let owner = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&owner, &owner.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Phase 2 fixture')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer')",&[&org,&owner]).await.unwrap();
    pg.execute("INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate,share_individual) VALUES($1,$2,true,true)",&[&org,&owner]).await.unwrap();
    let repo = TeamTrustRepository::new(pg.clone());
    repo.policy(org).await.unwrap();
    let generation = repo.registry_entry(org).await.unwrap().generation;
    let people = (1..=5).map(Uuid::from_u128).collect::<BTreeSet<_>>();
    let week = NaiveDate::from_ymd_opt(2026, 9, 28).unwrap();
    assert!(repo
        .release(org, week, "org", generation, "original", &people)
        .await
        .unwrap());
    assert!(repo
        .release(org, week, "org", generation, "original", &people)
        .await
        .unwrap());
    let publication_ledger = repo.registry_entry(org).await.unwrap();
    assert_eq!(publication_ledger.publication_marks[&week].len(), 1);
    assert!(repo
        .release(
            org,
            week,
            "same-equation-second-view",
            generation,
            "original",
            &people
        )
        .await
        .unwrap());
    let second_ledger = repo.registry_entry(org).await.unwrap();
    assert_eq!(second_ledger.publication_marks[&week].len(), 2);
    let publication_file =
        std::env::temp_dir().join(format!("atoaxis-publication-{}.json", Uuid::now_v7()));
    std::fs::write(
        &publication_file,
        serde_json::to_vec(&Registry {
            schema_version: 1,
            checked_at: Utc::now(),
            organizations: [(org, second_ledger)].into_iter().collect(),
            dispositions: vec![],
        })
        .unwrap(),
    )
    .unwrap();
    pg.execute("DELETE FROM team_weekly_publications WHERE organization_id=$1 AND view_key='same-equation-second-view'",&[&org]).await.unwrap();
    assert!(repo.export_registry(&publication_file).await.is_err());
    std::fs::remove_file(publication_file).unwrap();
    let overlap = (2..=6).map(Uuid::from_u128).collect();
    assert!(!repo
        .release(org, week, "team", generation, "other", &overlap)
        .await
        .unwrap());
    assert!(pg
        .execute(
            "UPDATE team_report_policies SET timezone='UTC' WHERE organization_id=$1",
            &[&org]
        )
        .await
        .is_err());
    assert!(!repo
        .release(org, week, "org", generation, "corrected", &people)
        .await
        .unwrap());
    assert!(!repo
        .release(
            org,
            week,
            "org",
            repo.registry_entry(org).await.unwrap().generation,
            "corrected",
            &people
        )
        .await
        .unwrap());
    let entry = repo.registry_entry(org).await.unwrap();
    let ledger = Registry {
        schema_version: 1,
        checked_at: Utc::now(),
        organizations: [(org, entry.clone())].into_iter().collect(),
        dispositions: vec![],
    };
    // A retained head cannot be silently replaced by an older restore.
    let file = std::env::temp_dir().join(format!("atoaxis-team-registry-{}.json", Uuid::now_v7()));
    std::fs::write(&file, serde_json::to_vec(&ledger).unwrap()).unwrap();
    repo.export_registry(&file).await.unwrap();
    pg.execute(
        "UPDATE team_rollouts SET generation=generation-1 WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    assert!(repo.export_registry(&file).await.is_err());
    repo.reconcile_restore(&ledger).await.unwrap();
    let consent=pg.query_one("SELECT share_aggregate,share_individual FROM organization_analytics_consents WHERE organization_id=$1 AND user_id=$2",&[&org,&owner]).await.unwrap();
    assert!(!consent.get::<_, bool>(0));
    assert!(!consent.get::<_, bool>(1));
    assert!(!pg
        .query_one(
            "SELECT enabled FROM team_rollouts WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    repo.export_registry(&file).await.unwrap();
    let newest = repo.registry_entry(org).await.unwrap().generation;
    assert!(!repo
        .release(org, week, "new-view", newest, "new", &people)
        .await
        .unwrap());
    // Generation race: old report cannot publish after consent withdrawal.
    pg.execute("UPDATE organization_analytics_consents SET share_aggregate=true WHERE organization_id=$1 AND user_id=$2",&[&org,&owner]).await.unwrap();
    let before = repo.registry_entry(org).await.unwrap().generation;
    pg.execute("UPDATE organization_analytics_consents SET share_aggregate=false WHERE organization_id=$1 AND user_id=$2",&[&org,&owner]).await.unwrap();
    assert!(repo
        .release(org, week, "race", before, "race", &people)
        .await
        .is_err());
    // The real API uses an upsert. Its INSERT trigger must not duplicate version 1.
    let old_version:i64=pg.query_one("SELECT consent_version FROM organization_analytics_consents WHERE organization_id=$1 AND user_id=$2",&[&org,&owner]).await.unwrap().get(0);
    for _ in 0..2 {
        pg.execute("INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate,share_individual) VALUES($1,$2,TRUE,FALSE) ON CONFLICT(organization_id,user_id) DO UPDATE SET share_aggregate=EXCLUDED.share_aggregate,share_individual=EXCLUDED.share_individual",&[&org,&owner]).await.unwrap();
    }
    let new_version:i64=pg.query_one("SELECT consent_version FROM organization_analytics_consents WHERE organization_id=$1 AND user_id=$2",&[&org,&owner]).await.unwrap().get(0);
    assert_eq!(new_version, old_version + 1);
    // More than one allocation batch must drain before the checkpoint advances.
    let repository = Uuid::now_v7();
    let project = Uuid::now_v7();
    let link = Uuid::now_v7();
    pg.execute("INSERT INTO team_repository_scopes(organization_id,repository_id,github_repository_id,github_installation_id,project_id,enabled) VALUES($1,$2,751033,751031,$3,TRUE)",&[&org,&repository,&project]).await.unwrap();
    pg.execute("INSERT INTO team_work_items(organization_id,repository_id,external_id,kind,number,state,opened_at,provider_updated_at) VALUES($1,$2,751035,'pull_request',1,'open',now(),now())",&[&org,&repository]).await.unwrap();
    pg.execute("INSERT INTO team_session_links(id,organization_id,repository_id,work_item_id,user_id,session_id,status,evidence) VALUES($1,$2,$3,751035,$4,repeat('a',64),'confirmed','owner_confirmation')",&[&link,&org,&repository,&owner]).await.unwrap();
    pg.execute("INSERT INTO team_usage_allocations(user_id,usage_identity,link_id) SELECT $1,lpad(to_hex(n),64,'0'),$2 FROM generate_series(1,205) n",&[&owner,&link]).await.unwrap();
    pg.execute("UPDATE team_cleanup_jobs SET completed_at=NULL,phase=1,retry_at=now() WHERE organization_id=$1",&[&org]).await.unwrap();
    for _ in 0..100 {
        repo.cleanup_tick(Utc::now()).await.unwrap();
    }
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_usage_allocations WHERE link_id=$1",
            &[&link]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    // A worker chunk can be resumed; only organization audit rows are purged.
    pg.execute("UPDATE team_cleanup_jobs SET completed_at=NULL,phase=0,retry_at=now() WHERE organization_id=$1",&[&org]).await.unwrap();
    let old = Uuid::now_v7();
    let recent = Uuid::now_v7();
    pg.execute("INSERT INTO audit_logs(id,organization_id,action,resource_type,created_at) VALUES($1,$2,'test','test',now()-interval '13 months'),($3,$2,'test','test',now())",&[&old,&org,&recent]).await.unwrap();
    for _ in 0..100 {
        repo.cleanup_tick(Utc::now()).await.unwrap();
    }
    assert_eq!(
        pg.query_one("SELECT count(*) FROM audit_logs WHERE id=$1", &[&old])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    assert_eq!(
        pg.query_one("SELECT count(*) FROM audit_logs WHERE id=$1", &[&recent])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
    assert!(repo
        .registry_entry(org)
        .await
        .unwrap()
        .retention_before
        .is_some());
    // Process crash/suspend: an open claim excludes another worker; rollback releases it.
    pg.execute("UPDATE team_cleanup_jobs SET completed_at=NULL,phase=0,retry_at=now() WHERE organization_id=$1",&[&org]).await.unwrap();
    let mut claimed = pg.transaction_client().await.unwrap();
    let tx = claimed.transaction().await.unwrap();
    tx.query(
        "SELECT organization_id FROM team_cleanup_jobs WHERE completed_at IS NULL FOR UPDATE",
        &[],
    )
    .await
    .unwrap();
    // Skip-locked policy is verified directly without contending the scheduler's upsert.
    let skipped=pg.query_opt("SELECT organization_id FROM team_cleanup_jobs WHERE completed_at IS NULL FOR UPDATE SKIP LOCKED LIMIT 1",&[]).await.unwrap();
    assert!(skipped.is_none());
    tx.rollback().await.unwrap();
    drop(claimed);
    assert!(repo.cleanup_tick(Utc::now()).await.unwrap());
    // Atomic file crash recovery: preserve the next monotonic ledger head.
    repo.export_registry(&file).await.unwrap();
    let mut candidate: Registry = serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
    candidate.checked_at = Utc::now();
    std::fs::write(
        file.with_extension("tmp"),
        serde_json::to_vec(&candidate).unwrap(),
    )
    .unwrap();
    repo.export_registry(&file).await.unwrap();
    assert!(!file.with_extension("tmp").exists());
    // Old inbox data is disposed once; redelivery cannot recreate metadata.
    let delivery = format!("expired-{}", Uuid::now_v7());
    pg.execute("INSERT INTO team_webhook_inbox(provider,delivery_id,payload_hash,metadata,received_at) VALUES('github',$1,'stable-hash','{}',now()-interval '13 months')",&[&delivery]).await.unwrap();
    pg.execute("UPDATE team_cleanup_jobs SET completed_at=NULL,phase=5,retry_at=now() WHERE organization_id=$1",&[&org]).await.unwrap();
    for _ in 0..20 {
        repo.cleanup_tick(Utc::now()).await.unwrap();
    }
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_webhook_dispositions WHERE delivery_id=$1",
            &[&delivery]
        )
        .await
        .unwrap()
        .is_some());
    let event = crate::services::team_webhooks::GithubMetadata {
        event: "installation".into(),
        action: "deleted".into(),
        installation_id: 1,
        repository_id: None,
        item: None,
        review_at: None,
        details: None,
    };
    let inbox = crate::repository::team_webhooks::TeamWebhookRepository::new(pg.clone());
    inbox
        .accept_github(&delivery, "stable-hash", &event)
        .await
        .unwrap();
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_webhook_inbox WHERE delivery_id=$1",
            &[&delivery]
        )
        .await
        .unwrap()
        .is_none());
    assert!(inbox
        .accept_github(&delivery, "conflicting-hash", &event)
        .await
        .is_err());
    // A database that cannot write must reject acceptance; retry must retain the original identity.
    let readonly = Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(format!(
                "{url}?options=-c%20default_transaction_read_only%3Don"
            )),
            max_connections: 2,
        })
        .await
        .unwrap(),
    );
    let readonly_inbox =
        crate::repository::team_webhooks::TeamWebhookRepository::new(readonly.clone());
    let refused = format!("readonly-{}", Uuid::now_v7());
    assert!(readonly_inbox
        .accept_github(&refused, "fixture-hash", &event)
        .await
        .is_err());
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_webhook_inbox WHERE delivery_id=$1",
            &[&refused]
        )
        .await
        .unwrap()
        .is_none());
    assert!(TeamTrustRepository::new(readonly)
        .cleanup_tick(Utc::now())
        .await
        .is_err());
    inbox
        .accept_github(&refused, "fixture-hash", &event)
        .await
        .unwrap();
    inbox
        .accept_github(&refused, "fixture-hash", &event)
        .await
        .unwrap();
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_webhook_inbox WHERE delivery_id=$1",
            &[&refused]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    pg.execute(
        "DELETE FROM team_webhook_inbox WHERE delivery_id=$1",
        &[&refused],
    )
    .await
    .unwrap();
    // Missing registry blocks reading and automatic initialization.
    std::fs::remove_file(&file).unwrap();
    assert!(repo.export_registry(&file).await.is_err());
    pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
        .await
        .unwrap();
    pg.execute("DELETE FROM users WHERE id=$1", &[&owner])
        .await
        .unwrap();
}

#[tokio::test]
#[ignore = "requires isolated PostgreSQL/ClickHouse and TEAM_DRILL_STAGE"]
async fn restore_drill_fixture_stages() {
    let stage = std::env::var("TEAM_DRILL_STAGE").unwrap();
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
    let ch = crate::test_support::clickhouse_client().await;
    let usage = crate::repository::ai_usage::AiUsageRepository::new(ch.clone());
    usage.migrate().await.unwrap();
    let org = Uuid::from_u128(0x741031);
    let user = Uuid::from_u128(0x741032);
    let repository = Uuid::from_u128(0x741033);
    let project = Uuid::from_u128(0x741034);
    let trust = TeamTrustRepository::new(pg.clone());
    let path = std::path::PathBuf::from(std::env::var("ATOAXIS_TEAM_PRIVACY_LEDGER_PATH").unwrap());
    match stage.as_str() {
        "seed" => {
            pg.execute("INSERT INTO users(id,username) VALUES($1,'restore-synthetic-user') ON CONFLICT DO NOTHING",&[&user]).await.unwrap();
            pg.execute("INSERT INTO organizations(id,slug,name) VALUES($1,'restore-synthetic-org','Restore synthetic fixture') ON CONFLICT DO NOTHING",&[&org]).await.unwrap();
            pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer') ON CONFLICT DO NOTHING",&[&org,&user]).await.unwrap();
            pg.execute("INSERT INTO organization_analytics_consents(organization_id,user_id,share_aggregate,share_individual) VALUES($1,$2,true,true) ON CONFLICT(organization_id,user_id) DO UPDATE SET share_aggregate=TRUE,share_individual=TRUE",&[&org,&user]).await.unwrap();
            pg.execute(
                "UPDATE team_rollouts SET enabled=FALSE WHERE organization_id=$1",
                &[&org],
            )
            .await
            .unwrap();
            pg.execute("INSERT INTO team_repository_scopes(organization_id,repository_id,github_repository_id,github_installation_id,project_id,enabled) VALUES($1,$2,741033,741031,$3,true) ON CONFLICT DO NOTHING",&[&org,&repository,&project]).await.unwrap();
            pg.execute("INSERT INTO team_work_items(organization_id,repository_id,external_id,kind,number,state,opened_at,provider_updated_at) VALUES($1,$2,741035,'pull_request',1,'open',now(),now()) ON CONFLICT DO NOTHING",&[&org,&repository]).await.unwrap();
            pg.execute("INSERT INTO team_member_project_bindings(organization_id,user_id,project_id,repository_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",&[&org,&user,&project,&repository]).await.unwrap();
            pg.execute("INSERT INTO team_session_contexts(organization_id,user_id,event_id,payload_hash,session_id,collector_id,project_id,repository_id,occurred_at,branch,commit_sha,provenance) VALUES($1,$2,$3,'fixture',$3,$2,$4,$5,now(),'fixture/branch',$6,'native_session_git') ON CONFLICT DO NOTHING",&[&org,&user,&"a".repeat(64),&project,&repository,&"b".repeat(40)]).await.unwrap();
            pg.execute("INSERT INTO team_github_facts(organization_id,repository_id,kind,external_id,occurred_at,metadata) VALUES($1,$2,'ready','fixture-ready',now(),jsonb_build_object('provenance','fixture')) ON CONFLICT DO NOTHING",&[&org,&repository]).await.unwrap();
            ch.get_client().query("CREATE TABLE IF NOT EXISTS member_daily(organization_id UUID,user_id UUID,date Date,total_seconds Float64,heartbeat_count UInt64) ENGINE=SummingMergeTree ORDER BY(organization_id,user_id,date)").execute().await.unwrap();
            ch.get_client().query("CREATE TABLE IF NOT EXISTS organization_daily(organization_id UUID,date Date,total_seconds Float64,heartbeat_count UInt64) ENGINE=SummingMergeTree ORDER BY(organization_id,date)").execute().await.unwrap();
            for table in ["member_daily", "organization_daily"] {
                ch.get_client().query(&format!("ALTER TABLE {table} DELETE WHERE organization_id=? SETTINGS mutations_sync=2")).bind(org).execute().await.unwrap();
            }
            ch.get_client()
                .query("INSERT INTO member_daily VALUES(?,?,'2024-02-29',1,1),(?,?,today(),2,2)")
                .bind(org)
                .bind(user)
                .bind(org)
                .bind(user)
                .execute()
                .await
                .unwrap();
            ch.get_client()
                .query("INSERT INTO organization_daily VALUES(?,'2024-02-29',1,1),(?,today(),2,2)")
                .bind(org)
                .bind(org)
                .execute()
                .await
                .unwrap();
            pg.execute(
                "DELETE FROM team_store_cleanup WHERE organization_id=$1",
                &[&org],
            )
            .await
            .unwrap();
            // Canonical personal usage persists across Team retention; it is not deleted by this worker.
            ch.get_client().query("ALTER TABLE wakaclock.ai_usage_events DELETE WHERE usage_event_id='restore-stable-usage' SETTINGS mutations_sync=2").execute().await.unwrap();
            ch.get_client().query("INSERT INTO wakaclock.ai_usage_events(user_id,date,usage_event_id,ai_session_id,event_time,ai_agent,token_source,version,received_at,project_id,project_attribution_method) VALUES (?,today(),'restore-stable-usage','fixture-session',toUInt32(now()),'fixture','provider',1,toUInt32(now()),?,'explicit_project_hint')").bind(user).bind(project).execute().await.unwrap();
            trust.policy(org).await.unwrap();
            std::fs::write(
                &path,
                serde_json::to_vec(&Registry {
                    schema_version: 1,
                    checked_at: Utc::now(),
                    organizations: Default::default(),
                    dispositions: vec![],
                })
                .unwrap(),
            )
            .unwrap();
            trust.export_registry(&path).await.unwrap();
            pg.execute(
                "UPDATE team_rollouts SET enabled=TRUE WHERE organization_id=$1",
                &[&org],
            )
            .await
            .unwrap();
            assert!(trust.guard(org).await.is_ok());
        }
        "revoke" => {
            pg.execute("UPDATE organization_analytics_consents SET share_aggregate=FALSE,share_individual=FALSE WHERE organization_id=$1 AND user_id=$2",&[&org,&user]).await.unwrap();
            for _ in 0..100 {
                trust.cleanup_tick(Utc::now()).await.unwrap();
            }
            for _ in 0..100 {
                if !crate::repository::team_store_retention::tick(
                    pg.clone(),
                    ch.clone(),
                    Utc::now(),
                )
                .await
                .unwrap()
                {
                    break;
                }
            }
            for table in ["member_daily", "organization_daily"] {
                assert_eq!(
                    ch.get_client()
                        .query(&format!(
                            "SELECT count() FROM {table} WHERE organization_id=?"
                        ))
                        .bind(org)
                        .fetch_one::<u64>()
                        .await
                        .unwrap(),
                    0
                );
            }
            trust.export_registry(&path).await.unwrap();
            assert!(trust.guard(org).await.is_ok());
        }
        "verify-old-restore" => {
            assert!(trust.guard(org).await.is_err());
            assert!(trust.export_registry(&path).await.is_err());
            let ledger: Registry = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
            trust.reconcile_restore(&ledger).await.unwrap();
            for _ in 0..100 {
                trust.cleanup_tick(Utc::now()).await.unwrap();
            }
            for _ in 0..100 {
                if !crate::repository::team_store_retention::tick(
                    pg.clone(),
                    ch.clone(),
                    Utc::now(),
                )
                .await
                .unwrap()
                {
                    break;
                }
            }
            for table in ["member_daily", "organization_daily"] {
                assert_eq!(
                    ch.get_client()
                        .query(&format!(
                            "SELECT count() FROM {table} WHERE organization_id=?"
                        ))
                        .bind(org)
                        .fetch_one::<u64>()
                        .await
                        .unwrap(),
                    0
                );
            }
            trust.export_registry(&path).await.unwrap();
            assert!(trust.guard(org).await.is_ok());
            let row=pg.query_one("SELECT share_aggregate,share_individual FROM organization_analytics_consents WHERE organization_id=$1 AND user_id=$2",&[&org,&user]).await.unwrap();
            assert!(!row.get::<_, bool>(0));
            assert!(!row.get::<_, bool>(1));
            assert!(!pg
                .query_one(
                    "SELECT enabled FROM team_rollouts WHERE organization_id=$1",
                    &[&org]
                )
                .await
                .unwrap()
                .get::<_, bool>(0));
            assert_eq!(
                pg.query_one(
                    "SELECT count(*) FROM team_session_contexts WHERE organization_id=$1",
                    &[&org]
                )
                .await
                .unwrap()
                .get::<_, i64>(0),
                0
            );
            assert_eq!(
                pg.query_one(
                    "SELECT count(*) FROM team_github_facts WHERE organization_id=$1",
                    &[&org]
                )
                .await
                .unwrap()
                .get::<_, i64>(0),
                0
            );
            let count=ch.get_client().query("SELECT count() FROM wakaclock.ai_usage_events FINAL WHERE usage_event_id='restore-stable-usage'").fetch_one::<u64>().await.unwrap();
            assert_eq!(count, 1);
        }
        _ => panic!("unknown fixture stage"),
    }
}

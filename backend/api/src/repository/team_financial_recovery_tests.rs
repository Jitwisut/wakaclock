use super::*;
use crate::{
    config::PostgresConfig, infrastructure::team_financial_plan,
    services::team_financial_ingress::tests::fixture,
};
fn approval(p: &Plan) -> Approval {
    Approval::reviewed(p, p.namespace(), p.scope(), p.plan_digest(), true).unwrap()
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_ingress_operator_plan_prospective_recovery_and_restore_fences() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url.clone()),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let root =
        std::path::PathBuf::from(std::env::var("TEAM_FINANCIAL_INVENTORY_TEST_DIR").unwrap())
            .parent()
            .unwrap()
            .join(format!("operator-{}", Uuid::now_v7()));
    std::fs::create_dir(&root).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    let path = root.join("ledger.jsonl");
    let namespace = Uuid::now_v7();
    let guard = FinancialGuard::new(path.clone()).unwrap();
    guard.initialize(namespace, vec![]).unwrap();
    let guard = guard.pin_namespace(namespace).unwrap();
    let scope = Scope {
        account: format!("acct_operator{}", Uuid::now_v7().simple()),
        live: false,
    };
    let evidence = "a".repeat(64);
    let p = prepare(&pg, &guard, &scope, &evidence).await.unwrap();
    assert_eq!(p.body.action, Action::ProspectiveBootstrap);
    assert!(guard.read().unwrap().snapshot.ingress.accounts.is_empty());
    let planfile = root.join("plan.json");
    team_financial_plan::write(&planfile, &p).unwrap();
    assert_eq!(team_financial_plan::read(&planfile).unwrap(), p);
    guard.fail_ingress_confirmation_once();
    assert!(apply(&pg, &guard, &p, &approval(&p)).await.is_err());
    let state = guard.read().unwrap();
    assert!(state.snapshot.ingress.entry(&scope).is_err());
    let original = state.snapshot.ingress.bootstraps[&scope.key().unwrap()].clone();
    assert!(apply(&pg, &guard, &p, &approval(&p)).await.is_err());
    let resume = prepare(&pg, &guard, &scope, &evidence).await.unwrap();
    assert_eq!(
        resume.body.action,
        Action::ResumeBootstrap { target: p.body.id }
    );
    apply(&pg, &guard, &resume, &approval(&resume))
        .await
        .unwrap();
    let entry = guard
        .read()
        .unwrap()
        .snapshot
        .ingress
        .entry(&scope)
        .unwrap()
        .clone();
    assert_eq!(
        entry.coverage_started_at,
        Some(original.coverage_started_at)
    );
    assert_eq!(
        apply(&pg, &guard, &resume, &approval(&resume))
            .await
            .unwrap()["status"],
        "already_applied"
    );
    let (_, _, mut receipt) = fixture();
    receipt.transition = Uuid::now_v7();
    receipt.notification.event_id = "evt_operator".into();
    let proposal = entry.propose(receipt.clone()).unwrap();
    guard
        .record_ingress(Event::Prepare {
            scope: scope.clone(),
            proposal,
        })
        .unwrap();
    let pending = prepare(&pg, &guard, &scope, &evidence).await.unwrap();
    assert_eq!(
        pending.body.action,
        Action::ResolvePendingReceipt {
            target: receipt.transition
        }
    );
    let mut stale = pending.clone();
    stale.body.instance = "b".repeat(64);
    stale = Plan::new(stale.body).unwrap();
    assert!(apply(&pg, &guard, &stale, &approval(&stale)).await.is_err());
    apply(&pg, &guard, &pending, &approval(&pending))
        .await
        .unwrap();
    let current = guard
        .read()
        .unwrap()
        .snapshot
        .ingress
        .entry(&scope)
        .unwrap()
        .clone();
    assert_eq!(current.receipts["evt_operator"], receipt);
    assert_eq!(
        apply(&pg, &guard, &resume, &approval(&resume))
            .await
            .unwrap()["status"],
        "already_applied"
    );
    pg.execute(
        "DELETE FROM team_stripe_inbox WHERE account_id=$1 AND livemode=$2",
        &[&scope.account, &scope.live],
    )
    .await
    .unwrap();
    assert!(apply(&pg, &guard, &pending, &approval(&pending))
        .await
        .is_err());
    let blocked = prepare(&pg, &guard, &scope, &evidence).await.unwrap();
    assert_eq!(
        blocked.body.action,
        Action::Blocked {
            reason: Reason::CommittedSqlMismatch
        }
    );
    assert!(apply(&pg, &guard, &blocked, &approval(&blocked))
        .await
        .is_err());
    let binary = std::env::var("TEAM_FINANCIAL_GUARD_TEST_BIN").unwrap();
    let cli_scope = format!("acct_cli{}", Uuid::now_v7().simple());
    let cli_plan = root.join("cli-plan.json");
    let result = tokio::process::Command::new(&binary)
        .args([
            "prepare-ingress-recovery",
            path.to_str().unwrap(),
            "--namespace",
            &namespace.to_string(),
            "--account",
            &cli_scope,
            "--evidence-hash",
            &evidence,
            "--output",
            cli_plan.to_str().unwrap(),
        ])
        .env("POSTGRES_URL", &url)
        .output()
        .await
        .unwrap();
    assert!(result.status.success(), "operator prepare failed");
    let summary: Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(summary["action"]["kind"], "prospective_bootstrap");
    assert!(!String::from_utf8_lossy(&result.stdout).contains(&cli_scope));
    let cp = team_financial_plan::read(&cli_plan).unwrap();
    for ack in [false, true] {
        let mut cmd = tokio::process::Command::new(&binary);
        cmd.args([
            "apply-ingress-recovery",
            path.to_str().unwrap(),
            "--namespace",
            &namespace.to_string(),
            "--account",
            &cli_scope,
            "--plan",
            cli_plan.to_str().unwrap(),
            "--approve-plan",
            cp.plan_digest(),
        ])
        .env("POSTGRES_URL", &url);
        if ack {
            cmd.arg("--acknowledge-prospective-only");
        }
        assert_eq!(cmd.output().await.unwrap().status.success(), ack);
    }
    // Bootstrap COMMIT failure leaves an independently recorded pending intent.
    let rollback_scope = Scope {
        account: format!("acct_rollback{}", Uuid::now_v7().simple()),
        live: false,
    };
    let rollback = prepare(&pg, &guard, &rollback_scope, &evidence)
        .await
        .unwrap();
    pg.execute("CREATE FUNCTION fixture_bootstrap_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture_bootstrap_failure'; END $$",&[]).await.unwrap();
    pg.execute("CREATE CONSTRAINT TRIGGER fixture_bootstrap_fail AFTER INSERT ON team_stripe_ingress_heads DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_bootstrap_fail()",&[]).await.unwrap();
    assert!(apply(&pg, &guard, &rollback, &approval(&rollback))
        .await
        .is_err());
    pg.execute(
        "DROP TRIGGER fixture_bootstrap_fail ON team_stripe_ingress_heads",
        &[],
    )
    .await
    .unwrap();
    pg.execute("DROP FUNCTION fixture_bootstrap_fail()", &[])
        .await
        .unwrap();
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_stripe_ingress_heads WHERE account_id=$1",
            &[&rollback_scope.account]
        )
        .await
        .unwrap()
        .is_none());
    let retry = prepare(&pg, &guard, &rollback_scope, &evidence)
        .await
        .unwrap();
    assert_eq!(
        retry.body.action,
        Action::ResumeBootstrap {
            target: rollback.body.id
        }
    );
    apply(&pg, &guard, &retry, &approval(&retry)).await.unwrap();
    // Changing SQL emptiness invalidates a previously reviewed plan.
    let dirty_scope = Scope {
        account: format!("acct_dirty{}", Uuid::now_v7().simple()),
        live: false,
    };
    let dirty = prepare(&pg, &guard, &dirty_scope, &evidence).await.unwrap();
    pg.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id) VALUES($1,false,'sub_dirty')",&[&dirty_scope.account]).await.unwrap();
    assert!(apply(&pg, &guard, &dirty, &approval(&dirty)).await.is_err());
    assert!(matches!(
        prepare(&pg, &guard, &dirty_scope, &evidence)
            .await
            .unwrap()
            .body
            .action,
        Action::Blocked {
            reason: Reason::HistoricalEvidenceRequired
        }
    ));
    // A plan that expires while waiting for the account lock must not mutate.
    let expiry_scope = Scope {
        account: format!("acct_expiry{}", Uuid::now_v7().simple()),
        live: false,
    };
    let mut exp = prepare(&pg, &guard, &expiry_scope, &evidence)
        .await
        .unwrap();
    exp.body.expires_at = Utc::now() + Duration::milliseconds(200);
    exp.body.prepared_at = exp.body.expires_at - Duration::minutes(15);
    let exp = Plan::new(exp.body).unwrap();
    let mut db = pg.transaction_client().await.unwrap();
    let tx = db.transaction().await.unwrap();
    ingress::lock(&tx, &expiry_scope).await.unwrap();
    let cloned_pg = pg.clone();
    let cloned_guard = guard.clone();
    let waiting =
        tokio::spawn(async move { apply(&cloned_pg, &cloned_guard, &exp, &approval(&exp)).await });
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    tx.commit().await.unwrap();
    assert!(waiting.await.unwrap().is_err());
    assert!(guard
        .read()
        .unwrap()
        .snapshot
        .ingress
        .entry(&expiry_scope)
        .is_err());
    // Review finding: an independent source append during bootstrap fsync gap
    // must roll SQL back, retain pending bootstrap and require a new decision.
    let race_scope = Scope {
        account: format!("acct_race{}", Uuid::now_v7().simple()),
        live: false,
    };
    let race = prepare(&pg, &guard, &race_scope, &evidence).await.unwrap();
    guard.delay_prepare_once_ms(600);
    let cloned_pg = pg.clone();
    let cloned_guard = guard.clone();
    let applying =
        tokio::spawn(
            async move { apply(&cloned_pg, &cloned_guard, &race, &approval(&race)).await },
        );
    for _ in 0..100 {
        if guard
            .read()
            .unwrap()
            .snapshot
            .ingress
            .bootstraps
            .contains_key(&race_scope.key().unwrap())
        {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    assert!(guard
        .read()
        .unwrap()
        .snapshot
        .ingress
        .bootstraps
        .contains_key(&race_scope.key().unwrap()));
    guard
        .record_source(crate::services::team_financial_source::Event::Freeze {
            scope: crate::services::team_financial_source::Scope {
                organization: Uuid::now_v7(),
                account: race_scope.account.clone(),
                live: false,
            },
            reason: crate::services::team_financial_source::FreezeReason::UnknownCommit,
        })
        .unwrap();
    assert!(applying.await.unwrap().is_err());
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_stripe_ingress_heads WHERE account_id=$1",
            &[&race_scope.account]
        )
        .await
        .unwrap()
        .is_none());
    assert!(matches!(
        prepare(&pg, &guard, &race_scope, &evidence)
            .await
            .unwrap()
            .body
            .action,
        Action::Blocked {
            reason: Reason::PendingStateMismatch
        }
    ));
    std::fs::remove_dir_all(root).unwrap();
}

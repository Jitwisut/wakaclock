//! Test-only preparation minting. No production constructor, HTTP or provider
//! evidence is provided by this fixture; execute only with isolated PostgreSQL.
#[path = "team_subscription_cancellation_projection_tests.rs"]
mod projection_tests;
use super::*;
use crate::{
    config::PostgresConfig,
    infrastructure::team_financial_guard::TestLedger,
    services::{
        team_financial_guard::Head, team_financial_source as source,
        team_subscription_cancellation::Subscription,
    },
};

struct CancellationFlag(Option<std::ffi::OsString>);
impl CancellationFlag {
    fn enabled() -> Self {
        let previous = std::env::var_os(crate::services::team_subscription_cancellation::FLAG);
        std::env::set_var(crate::services::team_subscription_cancellation::FLAG, "1");
        Self(previous)
    }
    fn disabled() -> Self {
        let previous = std::env::var_os(crate::services::team_subscription_cancellation::FLAG);
        std::env::set_var(crate::services::team_subscription_cancellation::FLAG, "0");
        Self(previous)
    }
}
impl Drop for CancellationFlag {
    fn drop(&mut self) {
        let key = crate::services::team_subscription_cancellation::FLAG;
        if let Some(value) = &self.0 {
            std::env::set_var(key, value)
        } else {
            std::env::remove_var(key)
        }
    }
}

struct Fixture {
    pg: Arc<PostgresClient>,
    ledger: TestLedger,
    scope: source::Scope,
    owner: Uuid,
    viewer: Uuid,
    before: Subscription,
}
impl Fixture {
    async fn new(pg: Arc<PostgresClient>) -> Self {
        let organization = Uuid::now_v7();
        let owner = Uuid::now_v7();
        let viewer = Uuid::now_v7();
        for user in [owner, viewer] {
            pg.execute(
                "INSERT INTO users(id,username,is_active) VALUES($1,$2,true)",
                &[&user, &user.to_string()],
            )
            .await
            .unwrap();
        }
        pg.execute("INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Synthetic cancellation fixture')",&[&organization,&organization.to_string()]).await.unwrap();
        for (user, role, seat) in [(owner, "owner", "developer"), (viewer, "viewer", "viewer")] {
            pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,$3,$4)",&[&organization,&user,&role,&seat]).await.unwrap();
        }
        pg.execute(
            "UPDATE team_rollouts SET enabled=true WHERE organization_id=$1",
            &[&organization],
        )
        .await
        .unwrap();
        let ledger = TestLedger::new(&[organization]);
        let scope = source::Scope {
            organization,
            account: format!("acct_cancel{}", organization.simple()),
            live: false,
        };
        let account = Account {
            account: scope.account.clone(),
            live: false,
        };
        super::super::team_financial_ingress::seed_empty_fixture(&pg, &ledger.guard, &account)
            .await
            .unwrap();
        let now: DateTime<Utc> = pg
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        // Provider boundaries use Unix seconds; acceptance/audit stay DB micros.
        let boundary = DateTime::from_timestamp(now.timestamp(), 0).unwrap();
        let start = boundary - Duration::days(1);
        let end = boundary + Duration::days(29);
        let before = Subscription {
            customer: format!("cus_cancel{}", organization.simple()),
            subscription: format!("sub_cancel{}", organization.simple()),
            live: false,
            status: "active".into(),
            cancel_at_period_end: false,
            cancel_at: None,
            canceled_at: None,
            ended_at: None,
            item: Some("si_cancel_fixture".into()),
            period_start: Some(start),
            period_end: Some(end),
            price: Some("price_cancel_fixture".into()),
            currency: Some("usd".into()),
            amount_minor: Some(2500),
            quantity: Some(1),
            items_complete: true,
            scheduled_or_pending_update: false,
        };
        pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id,enabled) VALUES($1,$2,false,$3,$4,true)",&[&organization,&scope.account,&before.customer,&before.subscription]).await.unwrap();
        pg.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id,requested_revision,applied_revision,last_success_at) VALUES($1,false,$2,1,1,$3)",&[&scope.account,&before.subscription,&now]).await.unwrap();
        pg.execute("INSERT INTO team_stripe_snapshots(organization_id,binding_revision,source_revision,provider_status,period_start,period_end,cancel_at_period_end,price_id,currency,amount_minor,quantity,items_complete,observed_at,subscription_item_id) VALUES($1,1,1,'active',$2,$3,false,$4,'usd',2500,1,true,$5,$6)",&[&organization,&start,&end,&before.price,&now,&before.item]).await.unwrap();
        // Explicit synthetic review, never runtime baseline initialization.
        let digest = super::super::team_financial_inventory::preview(&pg, &ledger.guard, &scope)
            .await
            .unwrap()
            .digest;
        let head = source::Root {
            schema: digest.schema,
            revision: 1,
            records: digest.records,
            hash: digest.hash,
        };
        ledger
            .guard
            .record_source(source::Event::Seed {
                scope: scope.clone(),
                head: head.clone(),
                review: source::Review {
                    id: Uuid::now_v7(),
                    kind: source::ReviewKind::ReviewedInventory,
                    evidence_hash: "a".repeat(64),
                    reviewed_at: now,
                },
                accepted: vec![],
            })
            .unwrap();
        pg.execute("INSERT INTO team_financial_source_heads(organization_id,account_id,livemode,schema_version,revision,record_count,root_hash,updated_at) VALUES($1,$2,false,1,1,$3,$4,$5)",&[&organization,&scope.account,&(head.records as i64),&head.hash,&now]).await.unwrap();
        Self {
            pg,
            ledger,
            scope,
            owner,
            viewer,
            before,
        }
    }
    fn account(&self) -> Account {
        Account {
            account: self.scope.account.clone(),
            live: false,
        }
    }
    fn repository(&self) -> CancellationRepository {
        CancellationRepository::new(self.pg.clone(), self.ledger.deployment())
    }
    async fn preparation(&self, operation: Uuid, actor: Uuid) -> PreparedCancellation {
        let now: DateTime<Utc> = self
            .pg
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        let request = FrozenCancellation::new(
            self.scope.clone(),
            actor,
            operation,
            1,
            1,
            &self.before,
            now,
        )
        .unwrap();
        let read = ReadEvidence {
            exchange: Uuid::now_v7(),
            observed_at: now,
            valid_until: now + Duration::seconds(60),
            subscription: self.before.clone(),
        };
        PreparedCancellation {
            request,
            read,
            account_token: super::super::team_financial_inventory::account_source_token(
                &self.ledger.guard,
                &self.account(),
            )
            .unwrap(),
            enrollment_token: self
                .ledger
                .guard
                .read()
                .unwrap()
                .organization_token(self.scope.organization)
                .unwrap(),
            seal: PreparationSeal::Synthetic,
        }
    }
    async fn count(&self) -> i64 {
        self.pg
            .query_one(
                "SELECT count(*) FROM team_subscription_cancellations WHERE organization_id=$1",
                &[&self.scope.organization],
            )
            .await
            .unwrap()
            .get(0)
    }
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL; serial fixture only, no provider evidence"]
async fn financial_cancellation_acceptance_exact_next_idempotency_owner_and_rollback_fences() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
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
    let _default_flag = CancellationFlag::disabled();
    {
        let f = Fixture::new(pg.clone()).await;
        let _environment = f.ledger.environment();
        let operation = Uuid::now_v7();
        let prepared = f.preparation(operation, f.owner).await;
        let original = prepared.request.clone();
        let repo = f.repository();
        assert_eq!(repo.accept(prepared).await.unwrap(), original);
        assert_eq!(f.count().await, 1);
        let accepted = f.ledger.guard.read().unwrap();
        assert!(matches!(
            accepted.snapshot.organizations[&f.scope.organization].head,
            Head::Legacy
        ));
        let entry = &accepted.snapshot.sources.scopes[&f.scope.key().unwrap()];
        assert_eq!(
            entry.accepted[&operation],
            original.accepted_request().unwrap()
        );
        assert!(
            super::super::team_financial_inventory::preview(&pg, &f.ledger.guard, &f.scope)
                .await
                .unwrap()
                .independent_source_matches
        );
        let selection = crate::services::team_subscription_cancellation::CancellationSelection {
            operation_id: operation,
            expected_binding_revision: original.binding_revision(),
            expected_source_revision: original.source_revision(),
            expected_period_end: original.period_end(),
            confirm: true,
        };
        let saved = repo
            .find_saved(f.owner, f.scope.organization, operation)
            .await
            .unwrap()
            .unwrap();
        saved.matches_selection(&selection).unwrap();
        let status = saved.response().await.unwrap();
        assert_eq!(status.accepted_at, original.accepted_at());
        assert_eq!(status.operation_id, operation);
        assert_eq!(status.acceptance, "observed");
        assert_eq!(
            status.reason,
            "worker_disabled_or_configuration_unconfirmed"
        );
        assert_eq!(status.provider_disposition, None);
        assert!(!status.dispatch_available);
        assert!(status.requested_by_current_owner);
        let view = repo
            .cancellation_view(f.owner, f.scope.organization, None)
            .await
            .unwrap();
        assert!(view.selection.is_none());
        let saved_view = view.operation.as_ref().unwrap();
        assert_eq!(saved_view.operation_id, status.operation_id);
        assert_eq!(saved_view.revision, status.revision);
        assert_eq!(saved_view.accepted_at, status.accepted_at);
        assert_eq!(saved_view.provider_disposition, None);
        assert!(!saved_view.worker_configured.unwrap());
        // Existing requests remain readable with mutation disabled, while both
        // latest and explicit-operation lookup require the current Owner.
        assert!(repo
            .cancellation_view(f.viewer, f.scope.organization, Some(operation))
            .await
            .is_err());
        assert!(repo
            .cancellation_view(f.viewer, f.scope.organization, None)
            .await
            .is_err());
        assert!(repo
            .find_saved(f.viewer, f.scope.organization, operation)
            .await
            .is_err());
        assert!(repo
            .find_saved(f.owner, f.scope.organization, Uuid::now_v7())
            .await
            .unwrap()
            .is_none());
        let saved = repo
            .find_saved(f.owner, f.scope.organization, operation)
            .await
            .unwrap()
            .unwrap();
        let mut changed = selection.clone();
        changed.expected_period_end += Duration::seconds(1);
        assert!(saved.matches_selection(&changed).is_err());
        // Final response is revoked if the Owner changes after preparation.
        pg.execute(
            "UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",
            &[&f.scope.organization, &f.owner],
        )
        .await
        .unwrap();
        assert!(saved.response().await.is_err());
        pg.execute(
            "UPDATE organization_members SET role='owner' WHERE organization_id=$1 AND user_id=$2",
            &[&f.scope.organization, &f.owner],
        )
        .await
        .unwrap();
        // Retry the service with no provider config/flag requirement: the saved
        // branch returns before the readonly provider-preparation path.
        let service = crate::services::billing::BillingService::new(
            Some(pg.clone()),
            Arc::new(AuthorizationService::new(Some(pg.clone()))),
        );
        let replay = service
            .accept_team_cancellation(f.owner, f.scope.organization, selection)
            .await
            .unwrap();
        assert_eq!(replay.accepted_at, original.accepted_at());
        assert_eq!(f.ledger.guard.read().unwrap().sequence, accepted.sequence);
        let repeated = f.preparation(operation, f.owner).await;
        assert!(repeated.request.same_intent(&original));
        assert_eq!(repo.accept(repeated).await.unwrap(), original);
        assert_eq!(f.ledger.guard.read().unwrap().sequence, accepted.sequence);
        assert_eq!(f.count().await, 1);
        assert!(repo
            .accept(f.preparation(Uuid::now_v7(), f.viewer).await)
            .await
            .is_err());
        assert!(repo
            .accept(f.preparation(Uuid::now_v7(), f.owner).await)
            .await
            .is_err()); // Single active subscription reservation.
        let mut stale = f.preparation(Uuid::now_v7(), f.owner).await;
        stale.account_token = "b".repeat(64);
        assert!(repo.accept(stale).await.is_err());
        let mut invalid = f.preparation(Uuid::now_v7(), f.owner).await;
        invalid.read.subscription.scheduled_or_pending_update = true;
        assert!(repo.accept(invalid).await.is_err());
        assert_eq!(f.count().await, 1);
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        assert!(
            super::super::team_analytics_entitlement::load(&tx, f.scope.organization)
                .await
                .unwrap()
                .is_none()
        );
        tx.rollback().await.unwrap();
    }
    {
        let f = Fixture::new(pg.clone()).await;
        let _environment = f.ledger.environment();
        let operation = Uuid::now_v7();
        let prepared = f.preparation(operation, f.owner).await;
        let original = prepared.request.clone();
        f.ledger.guard.fail_transaction_confirmation_once();
        assert!(f.repository().accept(prepared).await.is_err());
        assert_eq!(f.count().await, 1); // SQL committed, durable ACK is still withheld.
        assert!(f
            .ledger
            .guard
            .read()
            .unwrap()
            .snapshot
            .transactions
            .groups
            .values()
            .any(|g| !g.committed));
        // Historical confirmation does not mint a current Owner response.
        pg.execute(
            "UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",
            &[&f.scope.organization, &f.owner],
        )
        .await
        .unwrap();
        f.repository()
            .reconcile_history(&f.account())
            .await
            .unwrap();
        let state = f.ledger.guard.read().unwrap();
        assert!(state
            .snapshot
            .transactions
            .groups
            .values()
            .all(|g| g.committed));
        assert_eq!(
            state.snapshot.sources.scopes[&f.scope.key().unwrap()].accepted[&operation],
            original.accepted_request().unwrap()
        );
        assert!(f
            .repository()
            .accept(f.preparation(operation, f.owner).await)
            .await
            .is_err());
        assert_eq!(f.count().await, 1);
    }
    for missing in ["operation", "audit", "authorization"] {
        let f = Fixture::new(pg.clone()).await;
        let _environment = f.ledger.environment();
        let operation = Uuid::now_v7();
        f.ledger.guard.fail_transaction_confirmation_once();
        assert!(f
            .repository()
            .accept(f.preparation(operation, f.owner).await)
            .await
            .is_err());
        let sql = match missing {
            "operation" => "DELETE FROM team_subscription_cancellations WHERE operation_id=$1",
            "audit" => "DELETE FROM team_subscription_cancellation_audit WHERE operation_id=$1",
            _ => "DELETE FROM team_subscription_cancellation_authorizations WHERE operation_id=$1",
        };
        pg.execute(sql, &[&operation]).await.unwrap();
        let sequence = f.ledger.guard.read().unwrap().sequence;
        assert!(f
            .repository()
            .find_saved(f.owner, f.scope.organization, operation)
            .await
            .is_err());
        assert!(f
            .repository()
            .reconcile_history(&f.account())
            .await
            .is_err());
        assert_eq!(f.ledger.guard.read().unwrap().sequence, sequence); // No confirmation, predecessor replay or repair by insertion.
        assert_eq!(f.count().await, if missing == "operation" { 0 } else { 1 });
    }
    {
        use crate::services::team_subscription_cancellation::lifecycle::{
            self, CancellationStage, Exchange, ExchangeKind,
        };
        let f = Fixture::new(pg.clone()).await;
        let _environment = f.ledger.environment();
        let _flag = CancellationFlag::enabled();
        let operation = Uuid::now_v7();
        let request = f
            .repository()
            .accept(f.preparation(operation, f.owner).await)
            .await
            .unwrap();
        let lease = Uuid::now_v7();
        let account_lease = Uuid::now_v7();
        pg.execute("UPDATE team_subscription_cancellations SET lease_id=$2,lease_until=clock_timestamp()+interval '2 minutes' WHERE operation_id=$1",&[&operation,&lease]).await.unwrap();
        pg.execute("INSERT INTO team_stripe_runtime_status(account_id,livemode,lease_id,lease_until) VALUES($1,false,$2,clock_timestamp()+interval '2 minutes')",&[&f.scope.account,&account_lease]).await.unwrap();
        let at: DateTime<Utc> = pg
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        let exchange = Exchange {
            id: Uuid::now_v7(),
            actor: f.owner,
            revision: 1,
            lease,
            account_lease,
            kind: ExchangeKind::Mutation,
            prepared_at: at,
            first_attempt_at: Some(at),
            previous_observation: None,
            authorization_hash: lifecycle::authorization_hash(
                &request,
                1,
                f.owner,
                request.accepted_at(),
                "request_cancel_at_period_end",
            )
            .unwrap(),
        };
        let stage = CancellationStage::BeginExchange {
            exchange: exchange.clone(),
        };
        f.ledger.guard.fail_transaction_confirmation_once();
        assert!(f
            .repository()
            .apply_lifecycle(f.scope.organization, operation, 1, stage.clone())
            .await
            .is_err());
        assert_eq!(pg.query_one("SELECT count(*) FROM team_subscription_cancellation_exchanges WHERE operation_id=$1",&[&operation]).await.unwrap().get::<_,i64>(0),1);
        f.repository()
            .reconcile_history(&f.account())
            .await
            .unwrap();
        let sequence = f.ledger.guard.read().unwrap().sequence;
        assert!(f
            .repository()
            .apply_lifecycle(f.scope.organization, operation, 1, stage)
            .await
            .is_err());
        assert_eq!(f.ledger.guard.read().unwrap().sequence, sequence); // No replacement exchange/SQL replay.
        assert!(f
            .repository()
            .authorize_readback(f.owner, f.scope.organization, operation, 1)
            .await
            .is_err()); // Actual lease still active.
        pg.execute("UPDATE team_subscription_cancellations SET lease_until=clock_timestamp()-interval '1 second',retry_at=clock_timestamp()+interval '5 minutes' WHERE operation_id=$1",&[&operation]).await.unwrap();
        let retry_before: DateTime<Utc> = pg
            .query_one(
                "SELECT retry_at FROM team_subscription_cancellations WHERE operation_id=$1",
                &[&operation],
            )
            .await
            .unwrap()
            .get(0);
        assert!(f
            .repository()
            .authorize_readback(f.viewer, f.scope.organization, operation, 1)
            .await
            .is_err());
        f.repository()
            .authorize_readback(f.owner, f.scope.organization, operation, 1)
            .await
            .unwrap();
        let row=pg.query_one("SELECT revision,read_only,recovery_actor,first_attempt_at,retry_at FROM team_subscription_cancellations WHERE operation_id=$1",&[&operation]).await.unwrap();
        assert_eq!(row.get::<_, i64>(0), 2);
        assert!(row.get::<_, bool>(1));
        assert_eq!(row.get::<_, Option<Uuid>>(2), Some(f.owner));
        assert_eq!(row.get::<_, Option<DateTime<Utc>>>(3), Some(at));
        assert_eq!(row.get::<_, DateTime<Utc>>(4), retry_before);
        let sequence = f.ledger.guard.read().unwrap().sequence;
        f.repository()
            .authorize_readback(f.owner, f.scope.organization, operation, 1)
            .await
            .unwrap();
        assert_eq!(f.ledger.guard.read().unwrap().sequence, sequence); // Lost-response recovery retry keeps original revision/time.
        let snapshot = f.ledger.guard.read().unwrap();
        assert!(!snapshot.snapshot.sources.scopes[&f.scope.key().unwrap()]
            .dispatches
            .contains_key(&operation)); // Prepared != sent.
        let status = f
            .repository()
            .find_saved(f.owner, f.scope.organization, operation)
            .await
            .unwrap()
            .unwrap()
            .response()
            .await
            .unwrap();
        assert_eq!(status.provider_disposition, None);
        assert!(!status.dispatch_available);
    }
    {
        let f = Fixture::new(pg.clone()).await;
        let _environment = f.ledger.environment();
        let first = f.preparation(Uuid::now_v7(), f.owner).await;
        let second = f.preparation(Uuid::now_v7(), f.owner).await;
        let repository = f.repository();
        let (a, b) = tokio::join!(repository.accept(first), repository.accept(second));
        assert!(a.is_ok() || b.is_ok());
        assert_eq!(f.count().await, 1);
    }
    {
        use crate::services::team_subscription_cancellation::lifecycle::ExchangeKind;
        let f = Fixture::new(pg.clone()).await;
        let _environment = f.ledger.environment();
        let _flag = CancellationFlag::enabled();
        let operation = Uuid::now_v7();
        f.repository()
            .accept(f.preparation(operation, f.owner).await)
            .await
            .unwrap();
        let account_lease = Uuid::now_v7();
        pg.execute("INSERT INTO team_stripe_runtime_status(account_id,livemode,lease_id,lease_until) VALUES($1,false,$2,clock_timestamp()+interval '2 minutes')",&[&f.scope.account,&account_lease]).await.unwrap();
        let claim = f
            .repository()
            .claim_next(&f.account(), account_lease)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(claim.operation(), operation);
        assert!(claim
            .preflight_unprepared(&ExchangeKind::Mutation, Some(&f.ledger.guard))
            .await
            .is_err()); // No current projected read -> no POST.
        claim
            .preflight_unprepared(&ExchangeKind::ResourceRead, Some(&f.ledger.guard))
            .await
            .unwrap();
        let proof = claim
            .prepare_exchange(ExchangeKind::ResourceRead)
            .await
            .unwrap();
        proof.preflight(Some(&f.ledger.guard)).await.unwrap();
        let exchange = proof.exchange_id();
        assert!(f
            .repository()
            .claim_next(&f.account(), account_lease)
            .await
            .unwrap()
            .is_none()); // Operation lease, not number of processes.
        pg.execute(
            "UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",
            &[&f.scope.organization, &f.owner],
        )
        .await
        .unwrap();
        assert!(proof.preflight(Some(&f.ledger.guard)).await.is_err());
        // A synthetic late response checks retention after revocation; this is
        // not real HTTP/provider evidence or canonical result projection.
        let at: DateTime<Utc> = pg
            .query_one("SELECT clock_timestamp()", &[])
            .await
            .unwrap()
            .get(0);
        let id = proof.retain(&f.before, at).unwrap();
        let state = f.ledger.guard.read().unwrap();
        let entry = &state.snapshot.sources.scopes[&f.scope.key().unwrap()];
        assert_eq!(
            entry.cancellation_observations[&id].attempt.exchange,
            exchange
        );
        assert!(entry
            .unapplied_outcomes
            .contains(&entry.cancellation_observations[&id].outcome));
        assert!(!entry.dispatches.contains_key(&operation)); // Read did not set possible mutation time.
        assert_eq!(pg.query_one("SELECT first_attempt_at FROM team_subscription_cancellations WHERE operation_id=$1",&[&operation]).await.unwrap().get::<_,Option<DateTime<Utc>>>(0),None);
    }
}

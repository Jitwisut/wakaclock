//! Synthetic SQL/file boundary and actual signed-ingress coordinator fixtures.
use super::{team_financial_ingress as ingress, team_financial_inventory as inventory};
use crate::{
    config::PostgresConfig,
    infrastructure::{
        postgres::PostgresClient,
        team_financial_guard::{TestLedger, TransactionStatus},
    },
    services::{
        team_financial_ingress::Scope as Account,
        team_financial_source as source,
        team_financial_transaction::{self as transaction, tests::proposal},
    },
};
use chrono::Utc;
use uuid::Uuid;

struct IngressFixture {
    pg: std::sync::Arc<PostgresClient>,
    ledger: TestLedger,
    account: Account,
    scopes: Vec<source::Scope>,
    repository: super::team_stripe::TeamStripeRepository,
    receiver: crate::services::team_stripe::Ingress,
}
impl IngressFixture {
    async fn new(pg: std::sync::Arc<PostgresClient>, seeded: bool) -> Self {
        let orgs = [Uuid::now_v7(), Uuid::now_v7()];
        for org in orgs {
            pg.execute("INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Synthetic coordinator fixture')", &[&org,&org.to_string()]).await.unwrap();
        }
        let ledger = TestLedger::new(&orgs);
        let account = Account {
            account: format!("acct_coordinator{}", orgs[0].simple()),
            live: false,
        };
        ingress::seed_empty_fixture(&pg, &ledger.guard, &account)
            .await
            .unwrap();
        let scopes = orgs
            .into_iter()
            .map(|organization| source::Scope {
                organization,
                account: account.account.clone(),
                live: false,
            })
            .collect::<Vec<_>>();
        pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id,enabled) VALUES($1,$2,false,'cus_coordinator','sub_coordinator',false)",&[&orgs[0],&account.account]).await.unwrap();
        if seeded {
            for scope in &scopes {
                // Explicit synthetic approval only. Runtime never seeds from SQL.
                let d = inventory::preview(&pg, &ledger.guard, scope)
                    .await
                    .unwrap()
                    .digest;
                let head = source::Root {
                    schema: d.schema,
                    revision: 1,
                    records: d.records,
                    hash: d.hash,
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
                            reviewed_at: Utc::now(),
                        },
                        accepted: vec![],
                    })
                    .unwrap();
                pg.execute("INSERT INTO team_financial_source_heads(organization_id,account_id,livemode,schema_version,revision,record_count,root_hash,updated_at) VALUES($1,$2,false,1,1,$3,$4,clock_timestamp())",&[&scope.organization,&account.account,&(head.records as i64),&head.hash]).await.unwrap();
            }
        }
        let repository =
            super::team_stripe::TeamStripeRepository::new_guarded(pg.clone(), ledger.deployment());
        let receiver = crate::services::team_stripe::Ingress::new(
            repository.clone(),
            account.account.clone(),
            false,
            b"whsec_coordinator_fixture".to_vec(),
        )
        .unwrap();
        Self {
            pg,
            ledger,
            account,
            scopes,
            repository,
            receiver,
        }
    }
    async fn seed_sources(&self) {
        self.seed_sources_accepted(None).await;
    }
    async fn seed_sources_accepted(&self, accepted: Option<&source::AcceptedRequest>) {
        let pg = &self.pg;
        let guard = &self.ledger.guard;
        let scopes = &self.scopes;
        for scope in scopes {
            // Explicit synthetic approval only. Runtime never seeds from SQL.
            let d = inventory::preview(pg, guard, scope).await.unwrap().digest;
            let head = source::Root {
                schema: d.schema,
                revision: 1,
                records: d.records,
                hash: d.hash,
            };
            guard
                .record_source(source::Event::Seed {
                    scope: scope.clone(),
                    head: head.clone(),
                    review: source::Review {
                        id: Uuid::now_v7(),
                        kind: source::ReviewKind::ReviewedInventory,
                        evidence_hash: "a".repeat(64),
                        reviewed_at: Utc::now(),
                    },
                    accepted: accepted
                        .filter(|_| scope.organization == self.scopes[0].organization)
                        .cloned()
                        .into_iter()
                        .collect(),
                })
                .unwrap();
            pg.execute("INSERT INTO team_financial_source_heads(organization_id,account_id,livemode,schema_version,revision,record_count,root_hash,updated_at) VALUES($1,$2,false,1,1,$3,$4,clock_timestamp())",&[&scope.organization,&scope.account,&(head.records as i64),&head.hash]).await.unwrap();
        }
    }
    fn body(&self, id: &str, unbound: bool, now: chrono::DateTime<Utc>) -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({"id":id,"livemode":false,"created":now.timestamp(),"type":"invoice.payment_failed","data":{"object":{"object":"invoice","id":"in_coordinator","customer":if unbound {"cus_unbound"}else{"cus_coordinator"},"subscription":if unbound {"sub_unbound"}else{"sub_coordinator"},"prompt":"PRIVATE_COORDINATOR_DO_NOT_STORE","description":"PRIVATE_COORDINATOR_DO_NOT_STORE"}}})).unwrap()
    }
    async fn raw_accept(
        &self,
        body: &[u8],
        now: chrono::DateTime<Utc>,
    ) -> anyhow::Result<super::team_stripe::Acceptance> {
        let event = crate::services::team_stripe::event(body, &self.account.account, false, now)?;
        self.repository
            .accept(&event, &crate::services::team_webhooks::payload_hash(body))
            .await
    }
    async fn inbox_count(&self) -> i64 {
        self.pg
            .query_one(
                "SELECT count(*) FROM team_stripe_inbox WHERE account_id=$1",
                &[&self.account.account],
            )
            .await
            .unwrap()
            .get(0)
    }
    async fn close(self) {
        for scope in self.scopes {
            self.pg
                .execute(
                    "DELETE FROM organizations WHERE id=$1",
                    &[&scope.organization],
                )
                .await
                .unwrap();
        }
        for table in [
            "team_stripe_inbox",
            "team_stripe_reconcile_jobs",
            "team_stripe_ingress_heads",
        ] {
            self.pg
                .execute(
                    &format!("DELETE FROM {table} WHERE account_id=$1"),
                    &[&self.account.account],
                )
                .await
                .unwrap();
        }
    }
}
fn signed(body: &[u8], now: chrono::DateTime<Utc>) -> String {
    let mut bytes = format!("{}.", now.timestamp()).into_bytes();
    bytes.extend_from_slice(body);
    let mac = ring::hmac::sign(
        &ring::hmac::Key::new(ring::hmac::HMAC_SHA256, b"whsec_coordinator_fixture"),
        &bytes,
    );
    format!(
        "t={},v1={}",
        now.timestamp(),
        mac.as_ref()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    )
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_source_scheduler_exact_batch_lost_confirmation_and_operational_claim() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let f = IngressFixture::new(pg.clone(), false).await;
    pg.execute(
        "UPDATE team_stripe_bindings SET enabled=true WHERE organization_id=$1",
        &[&f.scopes[0].organization],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id,enabled) VALUES($1,$2,false,'cus_coordinator2','sub_coordinator2',true)",&[&f.scopes[1].organization,&f.account.account]).await.unwrap();
    f.seed_sources().await;
    let guard = &f.ledger.guard;
    let account_before = guard.read().unwrap().snapshot.ingress;
    guard.fail_transaction_confirmation_once();
    assert!(f
        .repository
        .schedule_bound(&f.account.account, false)
        .await
        .is_err());
    let pending = guard
        .read()
        .unwrap()
        .snapshot
        .transactions
        .groups
        .values()
        .find(|g| !g.committed)
        .unwrap()
        .clone();
    assert_eq!(pending.proposal.sources.len(), 2);
    let Some(transaction::Writer::Scheduler { targets }) = &pending.proposal.writer else {
        panic!("missing typed scheduler");
    };
    assert_eq!(targets.len(), 2);
    assert!(pending.proposal.ingress.is_none());
    assert_eq!(pg.query_one("SELECT count(*) FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND requested_revision=1 AND applied_revision=0",&[&f.account.account]).await.unwrap().get::<_,i64>(0),2);
    assert!(f.repository.claim(&f.account.account, false).await.is_err());
    // Exact-next readback confirms the retained transaction; it does not queue
    // the same requests twice even though the caller lost the prior result.
    assert_eq!(
        f.repository
            .schedule_bound(&f.account.account, false)
            .await
            .unwrap(),
        2
    );
    assert!(guard.read().unwrap().snapshot.transactions.groups[&pending.proposal.id].committed);
    assert_eq!(guard.read().unwrap().snapshot.ingress, account_before);
    assert_eq!(
        f.repository
            .schedule_bound(&f.account.account, false)
            .await
            .unwrap(),
        0
    );
    for scope in &f.scopes {
        let p = inventory::preview(&pg, guard, scope).await.unwrap();
        assert!(p.independent_source_matches);
        assert_eq!(p.checkpoint.unwrap().revision, 2);
    }
    let source_before = guard.read().unwrap().snapshot.sources;
    let claim = f
        .repository
        .claim(&f.account.account, false)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(guard.read().unwrap().snapshot.sources, source_before);
    assert!(
        inventory::preview(&pg, guard, &f.scopes[0])
            .await
            .unwrap()
            .independent_source_matches
    );
    let retry = Utc::now() + chrono::Duration::minutes(10);
    assert!(f
        .repository
        .fail(
            &claim,
            super::team_stripe::Failure::RateLimited,
            Some(429),
            Some(retry)
        )
        .await
        .unwrap());
    assert_eq!(guard.read().unwrap().snapshot.sources, source_before);
    assert!(pg.query_one("SELECT retry_at>=$3 FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND subscription_id=$2",&[&f.account.account,&claim.subscription_id,&retry]).await.unwrap().get::<_,bool>(0));
    // Changing a canonical requested revision outside the writer is detected
    // before another provider lease can be issued; no automatic baseline repair.
    pg.execute("UPDATE team_stripe_reconcile_jobs SET requested_revision=requested_revision+1,retry_at=clock_timestamp() WHERE account_id=$1",&[&f.account.account]).await.unwrap();
    assert!(f.repository.claim(&f.account.account, false).await.is_err());
    assert_eq!(pg.query_one("SELECT count(*) FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND lease_id IS NOT NULL",&[&f.account.account]).await.unwrap().get::<_,i64>(0),0);
    f.close().await;

    // A proven closed org whose binding remains enabled cannot monopolize the
    // scheduler batch or the first lease candidate for another active org.
    for closed_job in [false, true] {
        let f = IngressFixture::new(pg.clone(), false).await;
        pg.execute(
            "UPDATE team_stripe_bindings SET enabled=true WHERE organization_id=$1",
            &[&f.scopes[0].organization],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id,enabled) VALUES($1,$2,false,'cus_closed','sub_aaa_closed',true)",&[&f.scopes[1].organization,&f.account.account]).await.unwrap();
        if closed_job {
            pg.execute("INSERT INTO team_stripe_reconcile_jobs(account_id,livemode,subscription_id) VALUES($1,false,'sub_aaa_closed')",&[&f.account.account]).await.unwrap();
        }
        f.seed_sources().await;
        f.ledger.guard.quarantine(f.scopes[1].organization).unwrap();
        let before = f.ledger.guard.read().unwrap().snapshot.sources.scopes
            [&f.scopes[1].key().unwrap()]
            .clone();
        assert_eq!(
            f.repository
                .schedule_bound(&f.account.account, false)
                .await
                .unwrap(),
            1
        );
        let claim = f
            .repository
            .claim(&f.account.account, false)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(claim.organization_id, f.scopes[0].organization);
        assert_eq!(
            f.ledger.guard.read().unwrap().snapshot.sources.scopes[&f.scopes[1].key().unwrap()],
            before
        );
        assert_eq!(pg.query_one("SELECT count(*) FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND subscription_id='sub_aaa_closed'",&[&f.account.account]).await.unwrap().get::<_,i64>(0),i64::from(closed_job));
        f.close().await;
    }

    // Last participant fails predecessor validation: neither job is scheduled.
    let f = IngressFixture::new(pg.clone(), false).await;
    pg.execute(
        "UPDATE team_stripe_bindings SET enabled=true WHERE organization_id=$1",
        &[&f.scopes[0].organization],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id,enabled) VALUES($1,$2,false,'cus_scheduler2','sub_scheduler2',true)",&[&f.scopes[1].organization,&f.account.account]).await.unwrap();
    f.seed_sources().await;
    pg.execute(
        "DELETE FROM team_financial_source_heads WHERE organization_id=$1",
        &[&f.scopes[1].organization],
    )
    .await
    .unwrap();
    let before = f.ledger.guard.read().unwrap().snapshot;
    assert!(f
        .repository
        .schedule_bound(&f.account.account, false)
        .await
        .is_err());
    assert_eq!(f.ledger.guard.read().unwrap().snapshot, before);
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_reconcile_jobs WHERE account_id=$1",
            &[&f.account.account]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    f.close().await;

    // Deferred SQL failure preserves the entire group, and a later scheduler
    // retry cannot replay the predecessor job INSERT from the retained intent.
    let f = IngressFixture::new(pg.clone(), false).await;
    pg.execute(
        "UPDATE team_stripe_bindings SET enabled=true WHERE organization_id=$1",
        &[&f.scopes[0].organization],
    )
    .await
    .unwrap();
    f.seed_sources().await;
    pg.execute("CREATE FUNCTION fixture_schedule_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_scheduler_commit_failure'; END $$",&[]).await.unwrap();
    pg.execute("CREATE CONSTRAINT TRIGGER fixture_schedule_commit_failure AFTER INSERT ON team_stripe_reconcile_jobs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_schedule_commit_failure()",&[]).await.unwrap();
    assert!(f
        .repository
        .schedule_bound(&f.account.account, false)
        .await
        .is_err());
    let before = f.ledger.guard.read().unwrap().snapshot;
    assert_eq!(
        before
            .transactions
            .groups
            .values()
            .filter(|g| !g.committed)
            .count(),
        1
    );
    pg.execute(
        "DROP TRIGGER fixture_schedule_commit_failure ON team_stripe_reconcile_jobs",
        &[],
    )
    .await
    .unwrap();
    pg.execute("DROP FUNCTION fixture_schedule_commit_failure()", &[])
        .await
        .unwrap();
    assert!(f
        .repository
        .schedule_bound(&f.account.account, false)
        .await
        .is_err());
    assert_eq!(f.ledger.guard.read().unwrap().snapshot, before);
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_reconcile_jobs WHERE account_id=$1",
            &[&f.account.account]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    f.close().await;
}

async fn observation_fixture(
    pg: std::sync::Arc<PostgresClient>,
) -> (
    IngressFixture,
    super::team_stripe::Claim,
    crate::services::team_stripe::Snapshot,
) {
    let f = IngressFixture::new(pg.clone(), false).await;
    let org = f.scopes[0].organization;
    let owner = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&owner, &owner.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",
        &[&org, &owner],
    )
    .await
    .unwrap();
    pg.execute(
        "UPDATE team_stripe_bindings SET enabled=true WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    super::team_analytics_entitlement::start_trial(&pg, org, owner, 10, &f.ledger.deployment())
        .await
        .unwrap();
    f.seed_sources().await;
    let now = Utc::now();
    let body = f.body("evt_coordinator_observation", false, now);
    f.receiver
        .accept(&body, &signed(&body, now), now)
        .await
        .unwrap();
    let claim = f
        .repository
        .claim(&f.account.account, false)
        .await
        .unwrap()
        .unwrap();
    let (mut snapshot, _, _) = crate::services::team_stripe_payment::tests::fixture(Utc::now());
    snapshot.customer_id = claim.customer_id.clone();
    snapshot.subscription_id = claim.subscription_id.clone();
    (f, claim, snapshot)
}

async fn quote_fixture(
    pg: std::sync::Arc<PostgresClient>,
    seeded: bool,
) -> (
    IngressFixture,
    super::team_stripe_quote::QuoteRepository,
    super::team_stripe_quote::CustomerProof,
    crate::services::team_stripe_catalog::VerifiedOffer,
) {
    use serde_json::json;
    let f = IngressFixture::new(pg.clone(), false).await;
    let org = f.scopes[0].organization;
    let actor = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&actor, &actor.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",
        &[&org, &actor],
    )
    .await
    .unwrap();
    pg.execute(
        "DELETE FROM team_stripe_bindings WHERE organization_id=$1",
        &[&org],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO team_stripe_customer_operations(operation_id,organization_id,requested_by,account_id,livemode,disposition,customer_id) VALUES($1,$2,$3,$4,false,'verified','cus_quote_source')",&[&Uuid::now_v7(),&org,&actor,&f.account.account]).await.unwrap();
    if seeded {
        f.seed_sources().await;
    }
    let repository =
        super::team_stripe_quote::QuoteRepository::new_guarded(pg.clone(), f.ledger.deployment());
    let proof = repository
        .customer(actor, org, &f.account.account, false)
        .await
        .unwrap();
    let packages=[10,25,50,100].map(|n|json!({"seats":n,"price_id":format!("price_{n}"),"product_id":"prod_quote_source","amount_minor":2500,"tax_behavior":"exclusive"}));
    let config = json!({"schema_version":1,"revision":1,"owner_approved":true,"account_id":f.account.account,"livemode":false,"currency":"usd","packages":packages});
    let catalog = crate::services::team_stripe_catalog::Catalog::parse(
        &serde_json::to_vec(&config).unwrap(),
        &f.account.account,
        false,
    )
    .unwrap();
    let price = json!({"object":"price","id":"price_10","livemode":false,"active":true,"currency":"usd","unit_amount":2500,"tax_behavior":"exclusive","type":"recurring","billing_scheme":"per_unit","recurring":{"interval":"month","interval_count":1,"usage_type":"licensed"},"product":{"object":"product","id":"prod_quote_source","active":true,"livemode":false},"metadata":{"prompt":"PRIVATE_QUOTE_SOURCE_DO_NOT_STORE"}});
    let offer = catalog.verify(10, &price, Utc::now()).unwrap();
    (f, repository, proof, offer)
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_source_quote_atomic_terms_history_owner_expiry_and_predecessor_fences() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let (f, repo, proof, mut offer) = quote_fixture(pg.clone(), true).await;
    let id = Uuid::now_v7();
    let (a, b) = tokio::join!(repo.save(id, &proof, &offer), repo.save(id, &proof, &offer));
    let a = a.unwrap();
    let b = b.unwrap();
    assert_eq!(a.expires_at, b.expires_at);
    let before = f.ledger.guard.read().unwrap().snapshot;
    assert_eq!(before.transactions.groups.len(), 1);
    assert_eq!(
        repo.get(&proof, id, &offer.catalog_sha256)
            .await
            .unwrap()
            .id,
        id
    );
    let product = offer.package.product_id.clone();
    offer.package.product_id = "prod_different".into();
    assert!(repo.save(id, &proof, &offer).await.is_err());
    offer.package.product_id = product;
    let tax = offer.package.tax_behavior.clone();
    offer.package.tax_behavior = "inclusive".into();
    assert!(repo.save(id, &proof, &offer).await.is_err());
    offer.package.tax_behavior = tax;
    assert_eq!(f.ledger.guard.read().unwrap().snapshot, before);
    assert!(
        inventory::preview(&pg, &f.ledger.guard, &f.scopes[0])
            .await
            .unwrap()
            .independent_source_matches
    );
    let row: serde_json::Value = pg
        .query_one(
            "SELECT to_jsonb(q) FROM team_stripe_quotes q WHERE id=$1",
            &[&id],
        )
        .await
        .unwrap()
        .get(0);
    assert!(!row
        .to_string()
        .contains("PRIVATE_QUOTE_SOURCE_DO_NOT_STORE"));
    assert!(!std::fs::read_to_string(f.ledger.path())
        .unwrap()
        .contains("PRIVATE_QUOTE_SOURCE_DO_NOT_STORE"));
    f.close().await;

    // History confirmation must remain recoverable after the quote expires and
    // its original actor loses ownership. Neither actor can revive that quote.
    let (f, repo, proof, mut offer) = quote_fixture(pg.clone(), true).await;
    offer.observed_at = Utc::now() - chrono::Duration::minutes(10) + chrono::Duration::seconds(3);
    let id = Uuid::now_v7();
    f.ledger.guard.fail_transaction_confirmation_once();
    assert!(repo.save(id, &proof, &offer).await.is_err());
    let pending = f
        .ledger
        .guard
        .read()
        .unwrap()
        .snapshot
        .transactions
        .groups
        .values()
        .find(|g| !g.committed)
        .unwrap()
        .clone();
    pg.execute(
        "UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",
        &[&proof.org, &proof.actor],
    )
    .await
    .unwrap();
    let new_owner = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&new_owner, &new_owner.to_string()],
    )
    .await
    .unwrap();
    pg.execute(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",
        &[&proof.org, &new_owner],
    )
    .await
    .unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(3100)).await;
    let current = repo
        .customer(new_owner, proof.org, &proof.account, false)
        .await
        .unwrap();
    assert!(
        f.ledger.guard.read().unwrap().snapshot.transactions.groups[&pending.proposal.id].committed
    );
    assert!(repo.get(&proof, id, &offer.catalog_sha256).await.is_err());
    assert!(repo.get(&current, id, &offer.catalog_sha256).await.is_err());
    assert!(repo.save(id, &current, &offer).await.is_err());
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_quotes WHERE organization_id=$1",
            &[&proof.org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    assert!(
        inventory::preview(&pg, &f.ledger.guard, &f.scopes[0])
            .await
            .unwrap()
            .independent_source_matches
    );
    f.close().await;

    for mode in 0..3 {
        let (f, repo, proof, offer) = quote_fixture(pg.clone(), false).await;
        let id = Uuid::now_v7();
        if mode == 2 {
            repo.save(id, &proof, &offer).await.unwrap();
        }
        let path = f.ledger.path().to_path_buf();
        let namespace = f.ledger.guard.namespace().unwrap();
        let scope = f.scopes[0].clone();
        repo.after_legacy_mode_once(move || {
            let guard = crate::infrastructure::team_financial_guard::FinancialGuard::new(path)?
                .pin_namespace(namespace)?;
            guard.record_source(source::Event::Outcome {
                scope,
                outcome: source::Outcome {
                    id: Uuid::now_v7(),
                    operation: Uuid::now_v7(),
                    request_hash: "a".repeat(64),
                    evidence_hash: "b".repeat(64),
                    observed_at: Utc::now(),
                    identity: Some(source::ProviderIdentity::Customer {
                        customer: "cus_quote_source".into(),
                    }),
                },
            })
        });
        let error = match mode {
            0 => repo
                .customer(proof.actor, proof.org, &proof.account, false)
                .await
                .err()
                .unwrap(),
            1 => repo.save(id, &proof, &offer).await.err().unwrap(),
            _ => repo
                .get(&proof, id, &offer.catalog_sha256)
                .await
                .err()
                .unwrap(),
        };
        assert_eq!(error.to_string(), "financial_source_changed_before_commit");
        assert_eq!(
            pg.query_one(
                "SELECT count(*) FROM team_stripe_quotes WHERE organization_id=$1",
                &[&proof.org]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            i64::from(mode == 2)
        );
        let state = f.ledger.guard.read().unwrap().snapshot;
        let entry = &state.sources.scopes[&f.scopes[0].key().unwrap()];
        assert!(entry.head.is_none());
        assert_eq!(entry.unapplied_outcomes.len(), 1);
        assert!(state.transactions.groups.is_empty());
        f.close().await;
    }

    let (f, repo, proof, offer) = quote_fixture(pg.clone(), true).await;
    pg.execute("CREATE FUNCTION fixture_quote_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_quote_commit_failure'; END $$",&[]).await.unwrap();
    pg.execute("CREATE CONSTRAINT TRIGGER fixture_quote_commit_failure AFTER INSERT ON team_stripe_quotes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_quote_commit_failure()",&[]).await.unwrap();
    let id = Uuid::now_v7();
    assert!(repo.save(id, &proof, &offer).await.is_err());
    let before = f.ledger.guard.read().unwrap().snapshot;
    pg.execute(
        "DROP TRIGGER fixture_quote_commit_failure ON team_stripe_quotes",
        &[],
    )
    .await
    .unwrap();
    pg.execute("DROP FUNCTION fixture_quote_commit_failure()", &[])
        .await
        .unwrap();
    assert!(repo.save(id, &proof, &offer).await.is_err());
    assert_eq!(f.ledger.guard.read().unwrap().snapshot, before);
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_quotes WHERE id=$1",
            &[&id]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    f.close().await;
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_source_observation_atomic_enrollment_exact_history_retry_and_expired_lease() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let (f, claim, snapshot) = observation_fixture(pg.clone()).await;
    let guard = &f.ledger.guard;
    guard.fail_transaction_confirmation_once();
    assert!(f.repository.complete(&claim, &snapshot).await.is_err());
    let pending = guard
        .read()
        .unwrap()
        .snapshot
        .transactions
        .groups
        .values()
        .find(|g| !g.committed)
        .unwrap()
        .clone();
    assert!(matches!(
        pending.proposal.writer,
        Some(transaction::Writer::Reconciliation { .. })
    ));
    assert_eq!(pending.proposal.enrollments.len(), 1);
    let enrollment = &pending.proposal.enrollments[0];
    assert_eq!(
        pg.query_one(
            "SELECT state FROM team_analytics_entitlements WHERE organization_id=$1",
            &[&claim.organization_id]
        )
        .await
        .unwrap()
        .get::<_, serde_json::Value>(0),
        serde_json::to_value(enrollment.transition.state.as_ref()).unwrap()
    );
    assert_eq!(
        pg.query_one(
            "SELECT applied_revision FROM team_stripe_reconcile_jobs WHERE account_id=$1",
            &[&f.account.account]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        claim.revision
    );
    assert_eq!(pg.query_one("SELECT count(*) FROM team_stripe_inbox WHERE account_id=$1 AND disposition='processed'",&[&f.account.account]).await.unwrap().get::<_,i64>(0),1);
    // A changed provider observation cannot resolve this group's retained intent.
    let mut different = snapshot.clone();
    different.status = "canceled".into();
    assert!(f.repository.complete(&claim, &different).await.is_err());
    // A source-root match alone is insufficient if canonical enrollment history
    // was removed by a restore; no synthetic history is inserted by recovery.
    let history=pg.query_one("SELECT reason,state,recorded_at FROM team_analytics_entitlement_history WHERE organization_id=$1 AND revision=$2",&[&claim.organization_id,&enrollment.transition.state.revision]).await.unwrap();
    pg.execute(
        "DELETE FROM team_analytics_entitlement_history WHERE organization_id=$1 AND revision=$2",
        &[
            &claim.organization_id,
            &enrollment.transition.state.revision,
        ],
    )
    .await
    .unwrap();
    assert!(f.repository.complete(&claim, &snapshot).await.is_err());
    assert!(!guard.read().unwrap().snapshot.transactions.groups[&pending.proposal.id].committed);
    pg.execute("INSERT INTO team_analytics_entitlement_history(organization_id,revision,reason,state,recorded_at) VALUES($1,$2,$3,$4,$5)",&[&claim.organization_id,&enrollment.transition.state.revision,&history.get::<_,String>(0),&history.get::<_,serde_json::Value>(1),&history.get::<_,chrono::DateTime<Utc>>(2)]).await.unwrap();
    // Completion already cleared the provider lease; exact SQL-next recovery
    // must not require that old lease to remain alive or replay the snapshot.
    assert!(f.repository.complete(&claim, &snapshot).await.unwrap());
    assert!(guard.read().unwrap().snapshot.transactions.groups[&pending.proposal.id].committed);
    assert!(
        inventory::preview(&pg, guard, &f.scopes[0])
            .await
            .unwrap()
            .independent_source_matches
    );
    let state = guard.read().unwrap().snapshot;
    assert!(!f.repository.complete(&claim, &snapshot).await.unwrap());
    assert_eq!(guard.read().unwrap().snapshot, state);
    f.close().await;

    let (f, claim, snapshot) = observation_fixture(pg.clone()).await;
    pg.execute("UPDATE team_stripe_reconcile_jobs SET lease_until=clock_timestamp()+interval '700 milliseconds' WHERE account_id=$1",&[&f.account.account]).await.unwrap();
    f.ledger.guard.delay_prepare_once_ms(1000);
    assert_eq!(
        f.repository
            .complete(&claim, &snapshot)
            .await
            .unwrap_err()
            .to_string(),
        "financial_transaction_lease_reconciliation_required"
    );
    let state = f.ledger.guard.read().unwrap().snapshot;
    assert_eq!(
        state
            .transactions
            .groups
            .values()
            .filter(|g| !g.committed)
            .count(),
        1
    );
    assert_eq!(
        pg.query_one(
            "SELECT revision FROM team_analytics_entitlements WHERE organization_id=$1",
            &[&claim.organization_id]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_snapshots WHERE organization_id=$1",
            &[&claim.organization_id]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        pg.query_one(
            "SELECT applied_revision FROM team_stripe_reconcile_jobs WHERE account_id=$1",
            &[&f.account.account]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert!(f.repository.complete(&claim, &snapshot).await.is_err());
    assert_eq!(f.ledger.guard.read().unwrap().snapshot, state);
    f.close().await;
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_source_signed_ingress_coordinator_exact_retry_and_final_fences() {
    use super::team_stripe::Acceptance;
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let f = IngressFixture::new(pg.clone(), true).await;
    let guard = &f.ledger.guard;
    let unrelated = guard
        .read()
        .unwrap()
        .organization_token(f.scopes[1].organization)
        .unwrap();
    let now = Utc::now();
    let first = f.body("evt_coordinator_first", false, now);
    let sig = signed(&first, now);
    assert!(f.receiver.accept(&first, "invalid", now).await.is_err());
    assert_eq!(
        f.receiver.accept(&first, &sig, now).await.unwrap(),
        Acceptance::Accepted
    );
    let observed = inventory::preview(&pg, guard, &f.scopes[0]).await.unwrap();
    assert!(observed.independent_source_matches && observed.checkpoint_matches);
    assert_eq!(observed.checkpoint.unwrap().revision, 2);
    assert_eq!(
        guard
            .read()
            .unwrap()
            .organization_token(f.scopes[1].organization)
            .unwrap(),
        unrelated
    );
    let (a, b) = tokio::join!(
        f.receiver.accept(&first, &sig, now),
        f.receiver.accept(&first, &sig, now)
    );
    assert_eq!(a.unwrap(), Acceptance::Duplicate);
    assert_eq!(b.unwrap(), Acceptance::Duplicate);
    assert_eq!(f.inbox_count().await, 1);

    // A closed unrelated participant cannot stop this account's active org.
    guard.quarantine(f.scopes[1].organization).unwrap();
    guard.fail_transaction_confirmation_once();
    let lost = f.body("evt_coordinator_lost", false, now);
    let sig = signed(&lost, now);
    assert!(f.receiver.accept(&lost, &sig, now).await.is_err());
    assert_eq!(f.inbox_count().await, 2);
    let state = guard.read().unwrap().snapshot;
    let pending = state
        .transactions
        .groups
        .values()
        .find(|g| !g.committed)
        .unwrap();
    let id = pending.proposal.id;
    assert_eq!(
        inventory::preview(&pg, guard, &f.scopes[0])
            .await
            .unwrap()
            .checkpoint
            .unwrap()
            .revision,
        3
    );
    let other = f.body("evt_coordinator_other", false, now);
    assert!(f
        .receiver
        .accept(&other, &signed(&other, now), now)
        .await
        .is_err());
    assert_eq!(
        f.receiver.accept(&lost, &sig, now).await.unwrap(),
        Acceptance::Duplicate
    );
    assert!(guard.read().unwrap().snapshot.transactions.groups[&id].committed);
    assert_eq!(f.inbox_count().await, 2);
    assert_eq!(
        pg.query_one(
            "SELECT requested_revision FROM team_stripe_reconcile_jobs WHERE account_id=$1",
            &[&f.account.account]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        2
    );
    assert!(
        inventory::preview(&pg, guard, &f.scopes[0])
            .await
            .unwrap()
            .independent_source_matches
    );
    let before = guard.read().unwrap().snapshot.sources;
    let unbound = f.body("evt_coordinator_unbound", true, now);
    assert_eq!(
        f.receiver
            .accept(&unbound, &signed(&unbound, now), now)
            .await
            .unwrap(),
        Acceptance::Accepted
    );
    assert_eq!(guard.read().unwrap().snapshot.sources, before);
    assert!(
        inventory::preview(&pg, guard, &f.scopes[0])
            .await
            .unwrap()
            .independent_source_matches
    );
    let rows: serde_json::Value = pg
        .query_one(
            "SELECT jsonb_agg(to_jsonb(i)) FROM team_stripe_inbox i WHERE account_id=$1",
            &[&f.account.account],
        )
        .await
        .unwrap()
        .get(0);
    assert!(!rows
        .to_string()
        .contains("PRIVATE_COORDINATOR_DO_NOT_STORE"));
    assert!(!std::fs::read_to_string(f.ledger.path())
        .unwrap()
        .contains("PRIVATE_COORDINATOR_DO_NOT_STORE"));
    guard.quarantine(f.scopes[0].organization).unwrap();
    assert!(f
        .receiver
        .accept(&other, &signed(&other, now), now)
        .await
        .is_err());
    assert_eq!(f.inbox_count().await, 3);
    f.close().await;

    // SQL COMMIT fails after durable Prepare: keep the entire intent and never
    // replay its predecessor as a fresh event or confirm only the ingress head.
    let f = IngressFixture::new(pg.clone(), true).await;
    pg.execute("CREATE FUNCTION fixture_source_group_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_commit_failure'; END $$",&[]).await.unwrap();
    pg.execute("CREATE CONSTRAINT TRIGGER fixture_source_group_commit_failure AFTER INSERT ON team_stripe_inbox DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_source_group_commit_failure()",&[]).await.unwrap();
    let failed = f.body("evt_coordinator_rollback", false, now);
    assert!(f
        .receiver
        .accept(&failed, &signed(&failed, now), now)
        .await
        .is_err());
    assert_eq!(f.inbox_count().await, 0);
    let state = f.ledger.guard.read().unwrap().snapshot;
    assert_eq!(
        state
            .transactions
            .groups
            .values()
            .filter(|g| !g.committed)
            .count(),
        1
    );
    assert_eq!(
        inventory::preview(&pg, &f.ledger.guard, &f.scopes[0])
            .await
            .unwrap()
            .checkpoint
            .unwrap()
            .revision,
        1
    );
    pg.execute(
        "DROP TRIGGER fixture_source_group_commit_failure ON team_stripe_inbox",
        &[],
    )
    .await
    .unwrap();
    pg.execute("DROP FUNCTION fixture_source_group_commit_failure()", &[])
        .await
        .unwrap();
    assert!(f
        .receiver
        .accept(&failed, &signed(&failed, now), now)
        .await
        .is_err());
    assert_eq!(f.inbox_count().await, 0);
    assert_eq!(f.ledger.guard.read().unwrap().snapshot, state);
    f.close().await;

    // Restored/missing checkpoints and ambiguous historical owners must not
    // silently select the old ingress-only path or auto-seed an independent root.
    for scenario in 0..4 {
        let f = IngressFixture::new(pg.clone(), scenario != 2).await;
        match scenario {
            0 => {
                pg.execute(
                    "DELETE FROM team_financial_source_heads WHERE organization_id=$1",
                    &[&f.scopes[0].organization],
                )
                .await
                .unwrap();
            }
            1 => {
                pg.execute("UPDATE team_financial_source_heads SET root_hash=repeat('f',64) WHERE organization_id=$1",&[&f.scopes[0].organization]).await.unwrap();
            }
            2 => {
                pg.execute("INSERT INTO team_financial_source_heads(organization_id,account_id,livemode,schema_version,revision,record_count,root_hash,updated_at) VALUES($1,$2,false,1,1,0,repeat('e',64),clock_timestamp())",&[&f.scopes[0].organization,&f.account.account]).await.unwrap();
            }
            _ => {
                pg.execute("INSERT INTO team_financial_source_tombstones(organization_id,account_id,livemode,record_kind,record_key_hash,prior_record_hash,customer_id,reason,recorded_at) VALUES($1,$2,false,'binding',repeat('a',64),repeat('b',64),'cus_coordinator','approved_recovery',clock_timestamp())",&[&f.scopes[1].organization,&f.account.account]).await.unwrap();
            }
        }
        let before = f.ledger.guard.read().unwrap().snapshot;
        let body = f.body("evt_coordinator_invalid", false, now);
        assert!(
            f.receiver
                .accept(&body, &signed(&body, now), now)
                .await
                .is_err(),
            "scenario {scenario}"
        );
        assert_eq!(f.inbox_count().await, 0);
        assert_eq!(f.ledger.guard.read().unwrap().snapshot, before);
        pg.execute(
            "DELETE FROM team_financial_source_tombstones WHERE account_id=$1",
            &[&f.account.account],
        )
        .await
        .unwrap();
        f.close().await;
    }
    // Deterministically inject new independent ownership *after* ingress fsync,
    // both before any source baseline exists and in source mode with no owner.
    for seeded in [false, true] {
        let f = IngressFixture::new(pg.clone(), seeded).await;
        let path = f.ledger.path().to_path_buf();
        let namespace = f.ledger.guard.namespace().unwrap();
        let scope = f.scopes[0].clone();
        f.ledger.guard.after_ingress_prepare_once(move || {
            let guard = crate::infrastructure::team_financial_guard::FinancialGuard::new(path)?
                .pin_namespace(namespace)?;
            guard.record_source(source::Event::Outcome {
                scope,
                outcome: source::Outcome {
                    id: Uuid::now_v7(),
                    operation: Uuid::now_v7(),
                    request_hash: "a".repeat(64),
                    evidence_hash: "b".repeat(64),
                    observed_at: Utc::now(),
                    identity: Some(source::ProviderIdentity::Customer {
                        customer: "cus_unbound".into(),
                    }),
                },
            })
        });
        let body = f.body("evt_coordinator_association_race", true, now);
        assert_eq!(
            f.raw_accept(&body, now).await.unwrap_err().to_string(),
            "financial_source_changed_before_commit"
        );
        assert_eq!(f.inbox_count().await, 0);
        let state = f.ledger.guard.read().unwrap().snapshot;
        assert!(state.ingress.entry(&f.account).unwrap().pending.is_some());
        assert_eq!(
            state.sources.scopes[&f.scopes[0].key().unwrap()]
                .unapplied_outcomes
                .len(),
            1
        );
        assert!(f.raw_accept(&body, now).await.is_err());
        assert_eq!(f.inbox_count().await, 0);
        assert_eq!(f.ledger.guard.read().unwrap().snapshot, state);
        f.close().await;
    }
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_transaction_sql_boundary_pending_rollback_and_lost_confirmation() {
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
    for commit in [false, true] {
        let org = Uuid::now_v7();
        pg.execute(
            "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Synthetic group boundary')",
            &[&org, &org.to_string()],
        )
        .await
        .unwrap();
        let ledger = TestLedger::new(&[org]);
        let guard = &ledger.guard;
        let account = Account {
            account: format!("acct_group{}", org.simple()),
            live: false,
        };
        let scope = source::Scope {
            organization: org,
            account: account.account.clone(),
            live: false,
        };
        ingress::seed_empty_fixture(&pg, guard, &account)
            .await
            .unwrap();
        let empty = source::Root::empty(&scope).unwrap();
        guard
            .record_source(source::Event::Seed {
                scope: scope.clone(),
                head: empty.clone(),
                review: source::Review {
                    id: Uuid::now_v7(),
                    kind: source::ReviewKind::ReviewedEmpty,
                    evidence_hash: "a".repeat(64),
                    reviewed_at: Utc::now(),
                },
                accepted: vec![],
            })
            .unwrap();
        pg.execute("INSERT INTO team_financial_source_heads(organization_id,account_id,livemode,schema_version,revision,record_count,root_hash,updated_at) VALUES($1,$2,false,1,1,0,$3,clock_timestamp())",&[&org,&account.account,&empty.hash]).await.unwrap();
        assert!(
            inventory::preview(&pg, guard, &scope)
                .await
                .unwrap()
                .independent_source_matches
        );
        let before = guard.read().unwrap();
        let token = before.organization_token(org).unwrap();
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        super::team_financial_locks::organization(&tx, &account.account, false, org)
            .await
            .unwrap();
        ingress::ready(&tx, guard, &account).await.unwrap();
        let op = Uuid::now_v7();
        let actor = Uuid::now_v7();
        tx.execute("INSERT INTO team_stripe_customer_operations(operation_id,organization_id,requested_by,account_id,livemode,disposition) VALUES($1,$2,$3,$4,false,'pending')",&[&op,&org,&actor,&account.account]).await.unwrap();
        let staged = inventory::in_transaction(&tx, guard, &scope).await.unwrap();
        assert_eq!(staged.digest.records, 1);
        let mut intent = proposal(&before.snapshot, &account, &[org], false, false);
        intent.sources[0].transition.next = source::Root {
            schema: staged.digest.schema,
            revision: 2,
            records: staged.digest.records,
            hash: staged.digest.hash,
        };
        let next = &intent.sources[0].transition.next;
        tx.execute("UPDATE team_financial_source_heads SET revision=2,record_count=$3,root_hash=$4,transition_id=$5 WHERE organization_id=$1 AND account_id=$2",&[&org,&account.account,&(next.records as i64),&next.hash,&intent.id]).await.unwrap();
        guard
            .record_transaction(transaction::Event::Prepare {
                proposal: Box::new(intent.clone()),
            })
            .unwrap();
        assert!(ingress::ready(&tx, guard, &account).await.is_err());
        assert!(guard.read().unwrap().snapshot.verify(org, None).is_err());
        if commit {
            tx.commit().await.unwrap();
        } else {
            tx.rollback().await.unwrap();
        }
        drop(db);
        let observed = inventory::preview(&pg, guard, &scope).await.unwrap();
        assert!(observed.checkpoint_matches);
        assert_eq!(observed.digest.records, if commit { 1 } else { 0 });
        assert!(!observed.independent_source_matches);
        assert!(observed.financial_transaction_pending);
        assert_eq!(
            ingress::diagnostic(&pg, guard, &account).await.unwrap()["status"],
            "financial_transaction_reconciliation_required"
        );
        assert!(
            super::team_financial_guard::inspect(&pg, guard, org, guard.namespace().unwrap())
                .await
                .is_err()
        );
        let cli = std::env::var("TEAM_FINANCIAL_GUARD_TEST_BIN").unwrap();
        let inspected = std::process::Command::new(cli)
            .arg("inspect")
            .arg(ledger.path())
            .output()
            .unwrap();
        assert!(inspected.status.success());
        let metadata: serde_json::Value = serde_json::from_slice(&inspected.stdout).unwrap();
        assert_eq!(metadata["financial_transactions"]["pending"], 1);
        assert_eq!(
            metadata["financial_transactions"]["product_authorization_enabled"],
            false
        );
        let text = String::from_utf8(inspected.stdout).unwrap();
        for forbidden in [
            &account.account,
            &intent.digest().unwrap(),
            &op.to_string(),
            &next.hash,
        ] {
            assert!(!text.contains(forbidden));
        }
        // The old ingress-only recovery path must not replay/confirm just this
        // reservation's account while the complete SQL intent is unresolved.
        assert!(
            super::team_financial_recovery::prepare(&pg, guard, &account, &"a".repeat(64))
                .await
                .is_err()
        );
        let confirm = transaction::Event::Confirm {
            transaction: intent.id,
            proposal_hash: intent.digest().unwrap(),
        };
        if commit {
            guard.fail_transaction_confirmation_once();
            assert!(guard.record_transaction(confirm.clone()).is_err());
            assert!(!guard.read().unwrap().snapshot.transactions.groups[&intent.id].committed);
            let sequence = guard.read().unwrap().sequence;
            assert_eq!(
                guard.record_transaction(confirm.clone()).unwrap().status,
                TransactionStatus::Confirmed
            );
            assert_eq!(guard.read().unwrap().sequence, sequence + 1);
            assert!(
                inventory::preview(&pg, guard, &scope)
                    .await
                    .unwrap()
                    .independent_source_matches
            );
            let mut db = pg.transaction_client().await.unwrap();
            let tx = db.transaction().await.unwrap();
            ingress::lock(&tx, &account).await.unwrap();
            ingress::ready(&tx, guard, &account).await.unwrap();
            tx.rollback().await.unwrap();
            assert_ne!(
                guard.read().unwrap().organization_token(org).unwrap(),
                token
            );
            let inspection =
                super::team_financial_guard::inspect(&pg, guard, org, guard.namespace().unwrap())
                    .await
                    .unwrap();
            assert_eq!(inspection.enrollment, "explicit_legacy");
            assert!(!inspection.product_authorization_enabled);
            assert!(!guard.record_transaction(confirm).unwrap().appended);
        } else {
            // No automatic predecessor replay. The intent and all reservations
            // survive rollback; an operator/coordinator recovery is still needed.
            assert!(!guard.read().unwrap().snapshot.transactions.groups[&intent.id].committed);
            assert_eq!(
                guard.read().unwrap().snapshot.transactions.groups[&intent.id].proposal,
                intent
            );
        }
        pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
            .await
            .unwrap();
        pg.execute(
            "DELETE FROM team_stripe_ingress_heads WHERE account_id=$1",
            &[&account.account],
        )
        .await
        .unwrap();
    }
}

async fn customer_request_fixture(
    pg: std::sync::Arc<PostgresClient>,
    seeded: bool,
) -> (IngressFixture, Uuid, Uuid) {
    let f = IngressFixture::new(pg.clone(), false).await;
    // Customer creation fixtures have no existing provider binding. Deletion is
    // before the explicitly reviewed synthetic baseline, never runtime repair.
    pg.execute(
        "DELETE FROM team_stripe_bindings WHERE organization_id=$1",
        &[&f.scopes[0].organization],
    )
    .await
    .unwrap();
    let mut actors = Vec::new();
    for _ in 0..2 {
        let actor = Uuid::now_v7();
        pg.execute(
            "INSERT INTO users(id,username) VALUES($1,$2)",
            &[&actor, &actor.to_string()],
        )
        .await
        .unwrap();
        pg.execute(
            "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",
            &[&f.scopes[0].organization, &actor],
        )
        .await
        .unwrap();
        actors.push(actor);
    }
    if seeded {
        f.seed_sources().await;
    }
    (f, actors[0], actors[1])
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_source_customer_request_acceptance_history_and_legacy_fences() {
    use super::team_stripe_customer::{CustomerClaim, CustomerRepository};
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    let (f, actor, other) = customer_request_fixture(pg.clone(), true).await;
    let org = f.scopes[0].organization;
    let repo = f.repository.customers();
    assert!(repo
        .request(actor, org, &f.account.account, false, false)
        .await
        .unwrap()
        .is_none());
    assert!(f
        .ledger
        .guard
        .read()
        .unwrap()
        .snapshot
        .transactions
        .groups
        .is_empty());
    let (a, b) = tokio::join!(
        repo.request(actor, org, &f.account.account, false, true),
        repo.request(other, org, &f.account.account, false, true)
    );
    let a = a.unwrap().unwrap();
    let b = b.unwrap().unwrap();
    assert_eq!(a.operation_id, b.operation_id);
    let state = f.ledger.guard.read().unwrap().snapshot;
    assert_eq!(state.transactions.groups.len(), 1);
    let accepted = &state.sources.scopes[&f.scopes[0].key().unwrap()].accepted[&a.operation_id];
    let row=pg.query_one("SELECT requested_by,created_at FROM team_stripe_customer_operations WHERE operation_id=$1",&[&a.operation_id]).await.unwrap();
    assert_eq!(accepted.actor, row.get::<_, Uuid>(0));
    assert_eq!(accepted.accepted_at, row.get::<_, chrono::DateTime<Utc>>(1));
    assert!(
        inventory::preview(&pg, &f.ledger.guard, &f.scopes[0])
            .await
            .unwrap()
            .independent_source_matches
    );
    let source_claim = repo
        .claim(&f.account.account, false)
        .await
        .unwrap()
        .unwrap();
    source_claim
        .provider_preflight(Some(&f.ledger.guard))
        .await
        .unwrap();
    let claim = CustomerClaim {
        operation_id: a.operation_id,
        organization_id: org,
        actor,
        lease_id: Uuid::now_v7(),
        account_id: f.account.account.clone(),
        livemode: false,
        revision: 1,
        lookup_only: false,
        customer_id: None,
        financial: None,
    };
    assert!(repo.complete(&claim, "cus_blocked").await.is_err());
    assert!(repo
        .unresolved(&claim, "customer_not_found_unconfirmed")
        .await
        .is_err());
    assert!(repo
        .fail(
            &claim,
            &crate::infrastructure::stripe::ProviderError {
                kind: super::team_stripe::Failure::Network,
                status: None,
                retry_after: None
            }
        )
        .await
        .is_err());
    assert!(repo
        .authorize_recovery(actor, org, &f.account.account, false, a.operation_id, 1)
        .await
        .is_err());
    let row=pg.query_one("SELECT attempts,first_attempt_at,revision,customer_id FROM team_stripe_customer_operations WHERE operation_id=$1",&[&a.operation_id]).await.unwrap();
    assert_eq!(row.get::<_, i32>(0), 1);
    assert!(row.get::<_, Option<chrono::DateTime<Utc>>>(1).is_some());
    assert_eq!(row.get::<_, i64>(2), 1);
    assert!(row.get::<_, Option<String>>(3).is_none());
    // Caller/contract tampering cannot be normalized into a fresh accepted request.
    pg.execute(
        "UPDATE team_stripe_customer_operations SET requested_by=$2 WHERE operation_id=$1",
        &[&a.operation_id, &Uuid::now_v7()],
    )
    .await
    .unwrap();
    assert!(repo
        .request(actor, org, &f.account.account, false, true)
        .await
        .is_err());
    f.close().await;

    // Confirm immutable history after lost response even when the old Owner was
    // revoked; the old actor still receives no current response authorization.
    let (f, actor, other) = customer_request_fixture(pg.clone(), true).await;
    let org = f.scopes[0].organization;
    let repo = f.repository.customers();
    f.ledger.guard.fail_transaction_confirmation_once();
    assert!(repo
        .request(actor, org, &f.account.account, false, true)
        .await
        .is_err());
    let pending = f
        .ledger
        .guard
        .read()
        .unwrap()
        .snapshot
        .transactions
        .groups
        .values()
        .find(|g| !g.committed)
        .unwrap()
        .clone();
    pg.execute(
        "UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &actor],
    )
    .await
    .unwrap();
    let fresh = CustomerRepository::with_financial_authority(
        pg.clone(),
        Some(f.ledger.guard.clone()),
        false,
    );
    assert!(fresh
        .request(actor, org, &f.account.account, false, true)
        .await
        .is_err());
    assert!(
        f.ledger.guard.read().unwrap().snapshot.transactions.groups[&pending.proposal.id].committed
    );
    let status = fresh
        .request(other, org, &f.account.account, false, true)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        f.ledger
            .guard
            .read()
            .unwrap()
            .snapshot
            .transactions
            .groups
            .len(),
        1
    );
    assert_eq!(
        f.ledger.guard.read().unwrap().snapshot.sources.scopes[&f.scopes[0].key().unwrap()]
            .accepted[&status.operation_id]
            .actor,
        actor
    );
    f.close().await;

    // Commit failure retains the entire pending acceptance and never replays its
    // missing SQL row as a new operation on retry.
    let (f, actor, _) = customer_request_fixture(pg.clone(), true).await;
    let org = f.scopes[0].organization;
    let repo = f.repository.customers();
    pg.execute("CREATE FUNCTION fixture_customer_request_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_customer_request_commit_failure'; END $$",&[]).await.unwrap();
    pg.execute("CREATE CONSTRAINT TRIGGER fixture_customer_request_commit_failure AFTER INSERT ON team_stripe_customer_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_customer_request_commit_failure()",&[]).await.unwrap();
    assert!(repo
        .request(actor, org, &f.account.account, false, true)
        .await
        .is_err());
    pg.execute(
        "DROP TRIGGER fixture_customer_request_commit_failure ON team_stripe_customer_operations",
        &[],
    )
    .await
    .unwrap();
    pg.execute(
        "DROP FUNCTION fixture_customer_request_commit_failure()",
        &[],
    )
    .await
    .unwrap();
    assert!(repo
        .request(actor, org, &f.account.account, false, true)
        .await
        .is_err());
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_stripe_customer_operations WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    let state = f.ledger.guard.read().unwrap().snapshot;
    assert_eq!(state.transactions.groups.len(), 1);
    assert!(!state.transactions.groups.values().next().unwrap().committed);
    assert!(state.sources.scopes[&f.scopes[0].key().unwrap()]
        .accepted
        .is_empty());
    f.close().await;

    for mode in 0..7 {
        let (f, actor, _) = customer_request_fixture(pg.clone(), false).await;
        let org = f.scopes[0].organization;
        let legacy = f.repository.customers();
        let op = legacy
            .request(actor, org, &f.account.account, false, true)
            .await
            .unwrap()
            .unwrap()
            .operation_id;
        let claim = if (3..=5).contains(&mode) {
            // A guarded legacy claim is a read-only recovery, not a source-free
            // create. Keep the same authority so this fixture reaches the later
            // mode-selection race instead of the earlier authority fence.
            pg.execute(
                "UPDATE team_stripe_customer_operations SET lookup_only=true WHERE operation_id=$1",
                &[&op],
            )
            .await
            .unwrap();
            f.repository
                .customers()
                .claim(&f.account.account, false)
                .await
                .unwrap()
        } else {
            None
        };
        if mode == 6 {
            pg.execute("UPDATE team_stripe_customer_operations SET disposition='recovery_required' WHERE operation_id=$1",&[&op]).await.unwrap();
        }
        let before = pg
            .query_one(
                "SELECT to_jsonb(c) FROM team_stripe_customer_operations c WHERE operation_id=$1",
                &[&op],
            )
            .await
            .unwrap()
            .get::<_, serde_json::Value>(0);
        let repo = f.repository.customers();
        let path = f.ledger.path().to_path_buf();
        let namespace = f.ledger.guard.namespace().unwrap();
        let scope = f.scopes[0].clone();
        repo.after_legacy_mode_once(move || {
            let guard = crate::infrastructure::team_financial_guard::FinancialGuard::new(path)?
                .pin_namespace(namespace)?;
            guard.record_source(source::Event::Outcome {
                scope,
                outcome: source::Outcome {
                    id: Uuid::now_v7(),
                    operation: Uuid::now_v7(),
                    request_hash: "a".repeat(64),
                    evidence_hash: "b".repeat(64),
                    observed_at: Utc::now(),
                    identity: Some(source::ProviderIdentity::Customer {
                        customer: "cus_late_customer".into(),
                    }),
                },
            })
        });
        let error = match mode {
            0 => repo
                .request(actor, org, &f.account.account, false, true)
                .await
                .err(),
            1 => repo
                .request(actor, org, &f.account.account, false, false)
                .await
                .err(),
            2 => repo.claim(&f.account.account, false).await.err(),
            3 => repo
                .complete(claim.as_ref().unwrap(), "cus_late_customer")
                .await
                .err(),
            4 => repo
                .unresolved(claim.as_ref().unwrap(), "customer_not_found_unconfirmed")
                .await
                .err(),
            5 => repo
                .fail(
                    claim.as_ref().unwrap(),
                    &crate::infrastructure::stripe::ProviderError {
                        kind: super::team_stripe::Failure::Network,
                        status: None,
                        retry_after: None,
                    },
                )
                .await
                .err(),
            _ => repo
                .authorize_recovery(actor, org, &f.account.account, false, op, 1)
                .await
                .err(),
        }
        .unwrap();
        assert_eq!(
            error.to_string(),
            "financial_source_changed_before_commit",
            "mode {mode}"
        );
        assert_eq!(
            pg.query_one(
                "SELECT to_jsonb(c) FROM team_stripe_customer_operations c WHERE operation_id=$1",
                &[&op]
            )
            .await
            .unwrap()
            .get::<_, serde_json::Value>(0),
            before
        );
        let state = f.ledger.guard.read().unwrap().snapshot;
        assert_eq!(
            state.sources.scopes[&f.scopes[0].key().unwrap()]
                .unapplied_outcomes
                .len(),
            1
        );
        assert!(state.transactions.groups.is_empty());
        f.close().await;
    }
    let (f, actor, _) = customer_request_fixture(pg.clone(), false).await;
    let blocked = CustomerRepository::with_financial_authority(pg, None, true);
    assert_eq!(
        blocked
            .request(
                actor,
                f.scopes[0].organization,
                &f.account.account,
                false,
                true
            )
            .await
            .unwrap_err()
            .to_string(),
        "financial_guard_configuration_unconfirmed"
    );
    f.close().await;
}

type CustomerHttpFixture = (
    u16,
    tokio::sync::oneshot::Receiver<()>,
    std::sync::mpsc::Sender<()>,
    std::thread::JoinHandle<()>,
);
fn customer_http_fixture(operation: Uuid, valid: bool) -> CustomerHttpFixture {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let (started, observed) = tokio::sync::oneshot::channel();
    let (release, waiting) = std::sync::mpsc::channel();
    let handle = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
            .unwrap();
        let mut bytes = Vec::new();
        let mut buffer = [0; 2048];
        loop {
            let n = stream.read(&mut buffer).unwrap();
            assert!(n > 0);
            bytes.extend_from_slice(&buffer[..n]);
            if let Some(end) = bytes.windows(4).position(|b| b == b"\r\n\r\n") {
                let header = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
                let size: usize = header
                    .lines()
                    .find_map(|l| l.strip_prefix("content-length:"))
                    .unwrap()
                    .trim()
                    .parse()
                    .unwrap();
                if bytes.len() >= end + 4 + size {
                    break;
                }
            }
            assert!(bytes.len() < 8192);
        }
        let request = String::from_utf8(bytes).unwrap();
        assert!(request.starts_with("POST /v1/customers HTTP/1.1"));
        assert!(request
            .to_lowercase()
            .contains(&format!("idempotency-key: atoaxis-customer-v1-{operation}")));
        assert!(request.contains(&operation.to_string()));
        started.send(()).unwrap();
        waiting
            .recv_timeout(std::time::Duration::from_secs(5))
            .unwrap();
        let body=serde_json::to_vec(&serde_json::json!({"object":"customer","id":"cus_dispatch_source","livemode":!valid,"metadata":{"atoaxis_operation":operation},"description":"PRIVATE_CUSTOMER_DISPATCH_DO_NOT_STORE"})).unwrap();
        write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len()).unwrap();
        stream.write_all(&body).unwrap();
    });
    (port, observed, release, handle)
}
#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_source_customer_dispatch_retention_lease_restart_and_baseline() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    for valid in [true, false] {
        let (f, actor, _) = customer_request_fixture(pg.clone(), true).await;
        let org = f.scopes[0].organization;
        let repo = f.repository.customers();
        let op = repo
            .request(actor, org, &f.account.account, false, true)
            .await
            .unwrap()
            .unwrap()
            .operation_id;
        let claim = std::sync::Arc::new(
            repo.claim(&f.account.account, false)
                .await
                .unwrap()
                .unwrap(),
        );
        let state = f.ledger.guard.read().unwrap();
        assert!(state.snapshot.sources.scopes[&f.scopes[0].key().unwrap()]
            .dispatches
            .contains_key(&op));
        let sequence = state.sequence;
        let (port, started, release, server) = customer_http_fixture(op, valid);
        let client = crate::infrastructure::stripe::StripeClient::fixture_guarded(
            port,
            &f.account.account,
            f.ledger.guard.clone(),
        );
        let sending = claim.clone();
        let task = tokio::spawn(async move { client.create_customer(&sending).await });
        tokio::time::timeout(std::time::Duration::from_secs(5), started)
            .await
            .unwrap()
            .unwrap();
        // The response survives both changes. Resolution records the customer
        // as evidence-only and must not grant current billing authority.
        pg.execute(
            "UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",
            &[&org, &actor],
        )
        .await
        .unwrap();
        pg.execute("UPDATE team_stripe_customer_operations SET lease_until=clock_timestamp()-interval '1 second' WHERE operation_id=$1",&[&op]).await.unwrap();
        release.send(()).unwrap();
        let result = task.await.unwrap();
        server.join().unwrap();
        assert_eq!(result.is_ok(), valid);
        let state = f.ledger.guard.read().unwrap();
        assert_eq!(
            state.sequence,
            sequence + 1,
            "retention/rejection must be one durable record"
        );
        let entry = &state.snapshot.sources.scopes[&f.scopes[0].key().unwrap()];
        assert_eq!(entry.outcomes.len(), 1);
        assert_eq!(entry.unapplied_outcomes.len(), 1);
        assert_eq!(
            entry
                .frozen
                .contains(&source::FreezeReason::RequestIdentityConflict),
            !valid
        );
        let outcome = entry.outcomes.values().next().unwrap().clone();
        let reopened = crate::infrastructure::team_financial_guard::FinancialGuard::new(
            f.ledger.path().to_path_buf(),
        )
        .unwrap()
        .pin_namespace(f.ledger.guard.namespace().unwrap())
        .unwrap();
        assert_eq!(
            reopened.read().unwrap().snapshot.sources.scopes[&f.scopes[0].key().unwrap()],
            *entry
        );
        if valid {
            let a = claim.clone();
            let b = claim.clone();
            let (a, b) = tokio::join!(
                tokio::task::spawn_blocking(
                    move || a.retain_provider_result(Some("cus_dispatch_source"), true)
                ),
                tokio::task::spawn_blocking(
                    move || b.retain_provider_result(Some("cus_dispatch_source"), true)
                )
            );
            a.unwrap().unwrap();
            b.unwrap().unwrap();
            assert_eq!(f.ledger.guard.read().unwrap().sequence, state.sequence);
            assert!(!repo.complete(&claim, "cus_dispatch_source").await.unwrap());
            let stable = f.ledger.guard.read().unwrap();
            assert!(stable.sequence > state.sequence);
            assert!(stable.snapshot.sources.scopes[&f.scopes[0].key().unwrap()]
                .unapplied_outcomes
                .is_empty());
            assert!(
                inventory::preview(&pg, &f.ledger.guard, &f.scopes[0])
                    .await
                    .unwrap()
                    .independent_source_matches
            );
            assert_eq!(
                stable.snapshot.sources.scopes[&f.scopes[0].key().unwrap()].outcomes[&outcome.id],
                outcome
            );
            assert!(repo
                .complete(&claim, "cus_conflicting_source")
                .await
                .is_err());
            let state = f.ledger.guard.read().unwrap().snapshot;
            let entry = &state.sources.scopes[&f.scopes[0].key().unwrap()];
            assert_eq!(entry.outcomes.len(), 2);
            assert!(entry
                .frozen
                .contains(&source::FreezeReason::ProviderIdentityConflict));
        }
        let row = pg.query_one("SELECT customer_id,disposition FROM team_stripe_customer_operations WHERE operation_id=$1", &[&op]).await.unwrap();
        assert_eq!(
            row.get::<_, Option<String>>(0).as_deref(),
            if valid {
                Some("cus_dispatch_source")
            } else {
                None
            }
        );
        assert_eq!(
            row.get::<_, String>(1),
            if valid { "owner_changed" } else { "pending" }
        );
        assert!(!std::fs::read_to_string(f.ledger.path())
            .unwrap()
            .contains("PRIVATE_CUSTOMER_DISPATCH_DO_NOT_STORE"));
        f.close().await;
    }
    // SQL committed first-attempt, but the final independent confirmation was
    // lost: readback confirms that exact history, then reuses the original time.
    let (f, actor, _) = customer_request_fixture(pg.clone(), true).await;
    let org = f.scopes[0].organization;
    let repo = f.repository.customers();
    let op = repo
        .request(actor, org, &f.account.account, false, true)
        .await
        .unwrap()
        .unwrap()
        .operation_id;
    f.ledger.guard.fail_transaction_confirmation_once();
    assert!(repo.claim(&f.account.account, false).await.is_err());
    let first: chrono::DateTime<Utc> = pg
        .query_one(
            "SELECT first_attempt_at FROM team_stripe_customer_operations WHERE operation_id=$1",
            &[&op],
        )
        .await
        .unwrap()
        .get(0);
    assert!(repo
        .claim(&f.account.account, false)
        .await
        .unwrap()
        .is_none());
    pg.execute("UPDATE team_stripe_customer_operations SET lease_until=clock_timestamp()-interval '1 second' WHERE operation_id=$1",&[&op]).await.unwrap();
    let claim = repo
        .claim(&f.account.account, false)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        f.ledger.guard.read().unwrap().snapshot.sources.scopes[&f.scopes[0].key().unwrap()]
            .dispatches[&op]
            .first_attempt_at,
        first
    );
    assert_eq!(
        f.ledger
            .guard
            .read()
            .unwrap()
            .snapshot
            .transactions
            .groups
            .len(),
        2
    );
    // Expired, wrong-authority and tampered claims must never open a connection.
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let port = listener.local_addr().unwrap().port();
    let unguarded = crate::infrastructure::stripe::StripeClient::fixture(port, &f.account.account);
    assert!(unguarded.create_customer(&claim).await.is_err());
    let client = crate::infrastructure::stripe::StripeClient::fixture_guarded(
        port,
        &f.account.account,
        f.ledger.guard.clone(),
    );
    let mut tampered = claim;
    let lease = tampered.lease_id;
    tampered.lease_id = Uuid::now_v7();
    assert!(client.create_customer(&tampered).await.is_err());
    tampered.lease_id = lease;
    pg.execute("UPDATE team_stripe_customer_operations SET lease_until=clock_timestamp()-interval '1 second' WHERE operation_id=$1",&[&op]).await.unwrap();
    assert!(client.create_customer(&tampered).await.is_err());
    assert!(matches!(listener.accept(),Err(e) if e.kind()==std::io::ErrorKind::WouldBlock));
    f.close().await;
    // Synthetic reviewed historical baseline: the unchanged 23-hour window is
    // measured from the original independent possible dispatch, never a new lease.
    let (f, actor, _) = customer_request_fixture(pg.clone(), false).await;
    let org = f.scopes[0].organization;
    let repo = f.repository.customers();
    let op = repo
        .request(actor, org, &f.account.account, false, true)
        .await
        .unwrap()
        .unwrap()
        .operation_id;
    let accepted_at = chrono::DateTime::from_timestamp_micros(
        (Utc::now() - chrono::Duration::hours(24)).timestamp_micros(),
    )
    .unwrap();
    let first = accepted_at + chrono::Duration::minutes(30);
    pg.execute("UPDATE team_stripe_customer_operations SET created_at=$2,first_attempt_at=$3 WHERE operation_id=$1",&[&op,&accepted_at,&first]).await.unwrap();
    let request =
        crate::services::team_stripe_customer_request::Request::new(f.scopes[0].clone(), op, actor)
            .unwrap()
            .accepted(accepted_at)
            .unwrap();
    f.seed_sources_accepted(Some(&request)).await;
    f.ledger
        .guard
        .record_source(source::Event::Dispatch {
            scope: f.scopes[0].clone(),
            dispatch: source::Dispatch {
                operation: op,
                request_hash: request.request_hash,
                idempotency_hash: request.idempotency_hash,
                first_attempt_at: first,
            },
        })
        .unwrap();
    assert!(repo
        .claim(&f.account.account, false)
        .await
        .unwrap()
        .is_none());
    let row=pg.query_one("SELECT revision,disposition,first_attempt_at,lease_id FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op]).await.unwrap();
    assert_eq!(row.get::<_, i64>(0), 2);
    assert_eq!(row.get::<_, String>(1), "recovery_required");
    assert_eq!(row.get::<_, chrono::DateTime<Utc>>(2), first);
    assert!(row.get::<_, Option<Uuid>>(3).is_none());
    assert!(
        inventory::preview(&pg, &f.ledger.guard, &f.scopes[0])
            .await
            .unwrap()
            .independent_source_matches
    );
    f.close().await;
    let (f, actor, _) = customer_request_fixture(pg.clone(), true).await;
    let org = f.scopes[0].organization;
    let repo = f.repository.customers();
    let op = repo
        .request(actor, org, &f.account.account, false, true)
        .await
        .unwrap()
        .unwrap()
        .operation_id;
    pg.execute(
        "UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",
        &[&org, &actor],
    )
    .await
    .unwrap();
    assert!(repo
        .claim(&f.account.account, false)
        .await
        .unwrap()
        .is_none());
    let row=pg.query_one("SELECT revision,disposition,first_attempt_at FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op]).await.unwrap();
    assert_eq!(row.get::<_, i64>(0), 2);
    assert_eq!(row.get::<_, String>(1), "owner_changed");
    assert!(row.get::<_, Option<chrono::DateTime<Utc>>>(2).is_none());
    assert!(
        inventory::preview(&pg, &f.ledger.guard, &f.scopes[0])
            .await
            .unwrap()
            .independent_source_matches
    );
    f.close().await;
    // Configured source-free create waits for approved baseline. No new unknown
    // source, first-attempt timer, provider lease or transient-network retry.
    let (f, actor, _) = customer_request_fixture(pg.clone(), false).await;
    let org = f.scopes[0].organization;
    let repo = f.repository.customers();
    let op = repo
        .request(actor, org, &f.account.account, false, true)
        .await
        .unwrap()
        .unwrap()
        .operation_id;
    assert!(repo
        .claim(&f.account.account, false)
        .await
        .unwrap()
        .is_none());
    let row=pg.query_one("SELECT first_attempt_at,lease_id,last_error_code FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op]).await.unwrap();
    assert!(row.get::<_, Option<chrono::DateTime<Utc>>>(0).is_none());
    assert!(row.get::<_, Option<Uuid>>(1).is_none());
    assert_eq!(
        row.get::<_, String>(2),
        "financial_customer_baseline_required"
    );
    assert!(f
        .ledger
        .guard
        .read()
        .unwrap()
        .snapshot
        .sources
        .scopes
        .is_empty());
    f.close().await;
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_source_customer_resolution_exact_evidence_history_and_fences() {
    use super::team_stripe_quote::QuoteRepository;
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    // Distinct fixtures: usable, lost Confirm, failed SQL commit, lease expiry
    // after Prepare, already expired lease, newer claim, damaged predecessor,
    // competing provider owner, and late evidence after exact selection.
    for mode in 0..9 {
        let (f, actor, _) = customer_request_fixture(pg.clone(), mode != 7).await;
        let org = f.scopes[0].organization;
        if mode == 7 {
            pg.execute("INSERT INTO team_stripe_bindings(organization_id,account_id,livemode,customer_id,subscription_id,enabled) VALUES($1,$2,false,'cus_dispatch_source','sub_competing_resolution',false)", &[&f.scopes[1].organization,&f.account.account]).await.unwrap();
            f.seed_sources().await;
        }
        let repo = f.repository.customers();
        let op = repo
            .request(actor, org, &f.account.account, false, true)
            .await
            .unwrap()
            .unwrap()
            .operation_id;
        let claim = repo
            .claim(&f.account.account, false)
            .await
            .unwrap()
            .unwrap();
        if mode == 0 {
            // Ingress was durably accepted while its customer was unassociated.
            // Adding retained evidence must absorb this fact into the new root.
            let now = Utc::now();
            let mut body: serde_json::Value =
                serde_json::from_slice(&f.body("evt_resolution_association", true, now)).unwrap();
            body["data"]["object"]["customer"] = serde_json::json!("cus_dispatch_source");
            let body = serde_json::to_vec(&body).unwrap();
            f.receiver
                .accept(&body, &signed(&body, now), now)
                .await
                .unwrap();
            assert_eq!(f.inbox_count().await, 1);
        }
        claim
            .retain_provider_result(Some("cus_dispatch_source"), true)
            .unwrap();
        let key = f.scopes[0].key().unwrap();
        let evidence = f.ledger.guard.read().unwrap().snapshot.sources.scopes[&key]
            .outcomes
            .values()
            .next()
            .unwrap()
            .clone();
        match mode {
            1 => f.ledger.guard.fail_transaction_confirmation_once(),
            2 => {
                pg.execute("CREATE FUNCTION fixture_resolution_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_resolution_commit_failure'; END $$",&[]).await.unwrap();
                pg.execute("CREATE CONSTRAINT TRIGGER fixture_resolution_commit_failure AFTER UPDATE ON team_stripe_customer_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_resolution_commit_failure()",&[]).await.unwrap();
            }
            3 => {
                pg.execute("UPDATE team_stripe_customer_operations SET lease_until=clock_timestamp()+interval '500 milliseconds' WHERE operation_id=$1", &[&op]).await.unwrap();
                f.ledger.guard.delay_prepare_once_ms(1000);
            }
            4 => {
                pg.execute("UPDATE team_stripe_customer_operations SET lease_until=clock_timestamp()-interval '1 second' WHERE operation_id=$1", &[&op]).await.unwrap();
            }
            5 => {
                pg.execute("UPDATE team_stripe_customer_operations SET lease_id=$2,lease_until=clock_timestamp()+interval '5 minutes' WHERE operation_id=$1", &[&op,&Uuid::now_v7()]).await.unwrap();
            }
            6 => {
                pg.execute("UPDATE team_stripe_customer_operations SET revision=revision+1 WHERE operation_id=$1", &[&op]).await.unwrap();
            }
            8 => f.ledger.guard.delay_prepare_once_ms(1000),
            _ => (),
        }
        let result = if mode == 8 {
            let complete = repo.complete(&claim, "cus_dispatch_source");
            let arrive = async {
                tokio::time::timeout(std::time::Duration::from_secs(5), async {
                    loop {
                        if f.ledger
                            .guard
                            .read()
                            .unwrap()
                            .snapshot
                            .transactions
                            .groups
                            .values()
                            .any(|g| !g.committed)
                        {
                            break;
                        }
                        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                    }
                })
                .await
                .unwrap();
                let mut late = evidence.clone();
                late.id = Uuid::now_v7();
                f.ledger
                    .guard
                    .record_source(source::Event::Outcome {
                        scope: f.scopes[0].clone(),
                        outcome: late,
                    })
                    .unwrap();
            };
            tokio::join!(complete, arrive).0
        } else {
            repo.complete(&claim, "cus_dispatch_source").await
        };
        match mode {
            0 => assert!(result.unwrap()),
            4 => assert!(!result.unwrap()),
            _ => assert!(result.is_err(), "mode {mode} must fail closed"),
        }
        if mode == 2 {
            pg.execute(
                "DROP TRIGGER fixture_resolution_commit_failure ON team_stripe_customer_operations",
                &[],
            )
            .await
            .unwrap();
            pg.execute("DROP FUNCTION fixture_resolution_commit_failure()", &[])
                .await
                .unwrap();
        }
        if mode == 1 {
            // SQL is already committed. Confirm that exact next state even if
            // original Owner is revoked; never return a current usage grant.
            pg.execute("UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",&[&org,&actor]).await.unwrap();
            assert!(!repo.complete(&claim, "cus_dispatch_source").await.unwrap());
        }
        let row=pg.query_one("SELECT revision,disposition,customer_id FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op]).await.unwrap();
        let state = f.ledger.guard.read().unwrap().snapshot;
        let entry = &state.sources.scopes[&key];
        assert_eq!(entry.outcomes[&evidence.id], evidence);
        if matches!(mode, 0 | 1 | 4) {
            assert_eq!(row.get::<_, i64>(0), 2);
            assert_eq!(
                row.get::<_, Option<String>>(2).as_deref(),
                Some("cus_dispatch_source")
            );
            assert_eq!(
                row.get::<_, String>(1),
                if mode == 4 {
                    "recovery_required"
                } else {
                    "verified"
                }
            );
            assert!(entry.unapplied_outcomes.is_empty());
            for scope in &f.scopes {
                assert!(
                    inventory::preview(&pg, &f.ledger.guard, scope)
                        .await
                        .unwrap()
                        .independent_source_matches
                );
            }
            assert!(state.transactions.groups.values().all(|g| g.committed));
            if mode == 0 {
                let quote = QuoteRepository::new_guarded(pg.clone(), f.ledger.deployment());
                let proof = quote
                    .customer(actor, org, &f.account.account, false)
                    .await
                    .unwrap();
                assert_eq!(proof.revision, 2);
                assert_eq!(proof.customer, "cus_dispatch_source");
                assert!(repo.complete(&claim, "cus_dispatch_source").await.unwrap());
            }
        } else {
            assert_eq!(row.get::<_, String>(1), "pending");
            assert!(row.get::<_, Option<String>>(2).is_none());
            assert!(entry.unapplied_outcomes.contains(&evidence.id));
            if matches!(mode, 2 | 3 | 8) {
                let before = state.clone();
                assert!(before.transactions.groups.values().any(|g| !g.committed));
                assert!(repo.complete(&claim, "cus_dispatch_source").await.is_err());
                assert_eq!(f.ledger.guard.read().unwrap().snapshot, before);
            }
            if mode == 8 {
                assert_eq!(entry.unapplied_outcomes.len(), 2);
            }
        }
        f.close().await;
    }
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_sql_checkpoint_requires_same_account_authority() {
    use super::{
        team_stripe::TeamStripeRepository, team_stripe_checkout::CheckoutRepository,
        team_stripe_customer::CustomerRepository, team_stripe_quote::QuoteRepository,
    };
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    for source_only in [false, true] {
        let (f, guarded, proof, offer) = quote_fixture(pg.clone(), true).await;
        let quote = Uuid::now_v7();
        guarded.save(quote, &proof, &offer).await.unwrap();
        if source_only {
            pg.execute(
                "DELETE FROM team_stripe_ingress_heads WHERE account_id=$1 AND livemode=false",
                &[&f.account.account],
            )
            .await
            .unwrap();
        }
        let customers = CustomerRepository::new(pg.clone());
        for create in [false, true] {
            assert_eq!(
                customers
                    .request(proof.actor, proof.org, &proof.account, false, create)
                    .await
                    .err()
                    .unwrap()
                    .to_string(),
                "financial_guard_configuration_unconfirmed"
            );
        }
        assert_eq!(
            customers
                .claim(&proof.account, false)
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        assert_eq!(
            customers
                .authorize_recovery(
                    proof.actor,
                    proof.org,
                    &proof.account,
                    false,
                    proof.operation,
                    proof.revision
                )
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        let quotes = QuoteRepository::new(pg.clone());
        assert_eq!(
            quotes
                .customer(proof.actor, proof.org, &proof.account, false)
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        assert_eq!(
            quotes
                .save(Uuid::now_v7(), &proof, &offer)
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        assert_eq!(
            quotes
                .get(&proof, quote, &offer.catalog_sha256)
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        let stripe = TeamStripeRepository::new(pg.clone());
        let now = Utc::now();
        let body = f.body("evt_missing_authority", false, now);
        let event = crate::services::team_stripe::event(&body, &proof.account, false, now).unwrap();
        assert_eq!(
            stripe
                .accept(&event, &crate::services::team_webhooks::payload_hash(&body))
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        assert_eq!(
            stripe
                .schedule_bound(&proof.account, false)
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        assert_eq!(
            stripe
                .claim(&proof.account, false)
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        let checkout = CheckoutRepository::new(pg.clone());
        assert_eq!(
            checkout
                .latest(proof.actor, proof.org, &proof.account, false)
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        assert_eq!(
            checkout
                .status(
                    proof.actor,
                    proof.org,
                    &proof.account,
                    false,
                    Uuid::now_v7()
                )
                .await
                .err()
                .unwrap()
                .to_string(),
            "financial_guard_configuration_unconfirmed"
        );
        // The same account's live mode has no checkpoint. Never turn an
        // account-specific rollout fence into a process-global outage.
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        let live = Account {
            account: proof.account.clone(),
            live: true,
        };
        ingress::lock(&tx, &live).await.unwrap();
        ingress::require_authority(&tx, &live, None).await.unwrap();
        tx.rollback().await.unwrap();
        assert_eq!(f.inbox_count().await, 0);
        f.close().await;
    }
}

#[tokio::test]
#[ignore = "requires isolated POSTGRES_TEST_URL"]
async fn financial_source_customer_recovery_authorization_original_identity_atomicity_and_history()
{
    use crate::services::authorization::AuthorizationDenied;
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_stripe_test")
    );
    let pg = std::sync::Arc::new(
        PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 8,
        })
        .await
        .unwrap(),
    );
    pg.migrate().await.unwrap();
    for mode in 0..5 {
        let (f, original_actor, recovery_actor) = customer_request_fixture(pg.clone(), true).await;
        let org = f.scopes[0].organization;
        let scope_key = f.scopes[0].key().unwrap();
        let repo = f.repository.customers();
        let op = repo
            .request(original_actor, org, &f.account.account, false, true)
            .await
            .unwrap()
            .unwrap()
            .operation_id;
        if mode == 4 {
            pg.execute("UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",&[&org,&original_actor]).await.unwrap();
            assert!(repo
                .claim(&f.account.account, false)
                .await
                .unwrap()
                .is_none());
        } else {
            let claim = repo
                .claim(&f.account.account, false)
                .await
                .unwrap()
                .unwrap();
            claim
                .retain_provider_result(Some("cus_recovery_authorization"), true)
                .unwrap();
            pg.execute("UPDATE team_stripe_customer_operations SET lease_until=clock_timestamp()-interval '1 second' WHERE operation_id=$1",&[&op]).await.unwrap();
            assert!(!repo
                .complete(&claim, "cus_recovery_authorization")
                .await
                .unwrap());
        }
        let before = f.ledger.guard.read().unwrap().snapshot.sources.scopes[&scope_key].clone();
        let original = before.accepted[&op].clone();
        let row=pg.query_one("SELECT revision,customer_id,first_attempt_at FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op]).await.unwrap();
        let customer: Option<String> = row.get(1);
        let first: Option<chrono::DateTime<Utc>> = row.get(2);
        assert_eq!(row.get::<_, i64>(0), 2);
        // Wrong scope/revision/role must not append a source transition or audit.
        assert!(repo
            .authorize_recovery(
                recovery_actor,
                f.scopes[1].organization,
                &f.account.account,
                false,
                op,
                2
            )
            .await
            .is_err());
        assert!(repo
            .authorize_recovery(recovery_actor, org, &f.account.account, true, op, 2)
            .await
            .is_err());
        assert!(repo
            .authorize_recovery(recovery_actor, org, &f.account.account, false, op, 1)
            .await
            .is_err());
        if mode == 1 {
            f.ledger.guard.fail_transaction_confirmation_once();
        }
        if mode == 2 {
            pg.execute("CREATE FUNCTION fixture_customer_recovery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_recovery_authorization_failure'; END $$",&[]).await.unwrap();
            pg.execute("CREATE CONSTRAINT TRIGGER fixture_customer_recovery_failure AFTER INSERT ON team_stripe_customer_authorizations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_customer_recovery_failure()",&[]).await.unwrap();
        }
        let winner = if mode == 3 {
            let (a, b) = tokio::join!(
                repo.authorize_recovery(original_actor, org, &f.account.account, false, op, 2),
                repo.authorize_recovery(recovery_actor, org, &f.account.account, false, op, 2)
            );
            assert_ne!(a.is_ok(), b.is_ok());
            if a.is_ok() {
                original_actor
            } else {
                recovery_actor
            }
        } else {
            let result = repo
                .authorize_recovery(recovery_actor, org, &f.account.account, false, op, 2)
                .await;
            assert_eq!(result.is_ok(), !matches!(mode, 1 | 2));
            recovery_actor
        };
        if mode == 2 {
            pg.execute("DROP TRIGGER fixture_customer_recovery_failure ON team_stripe_customer_authorizations",&[]).await.unwrap();
            pg.execute("DROP FUNCTION fixture_customer_recovery_failure()", &[])
                .await
                .unwrap();
            let pending = f.ledger.guard.read().unwrap().snapshot;
            assert!(pending.transactions.groups.values().any(|g| !g.committed));
            assert!(repo
                .authorize_recovery(recovery_actor, org, &f.account.account, false, op, 2)
                .await
                .is_err());
            assert_eq!(f.ledger.guard.read().unwrap().snapshot, pending);
        } else if mode == 1 {
            pg.execute("UPDATE organization_members SET role='viewer' WHERE organization_id=$1 AND user_id=$2",&[&org,&recovery_actor]).await.unwrap();
            let error = repo
                .authorize_recovery(recovery_actor, org, &f.account.account, false, op, 2)
                .await
                .unwrap_err();
            assert!(error.downcast_ref::<AuthorizationDenied>().is_some());
            assert!(f
                .ledger
                .guard
                .read()
                .unwrap()
                .snapshot
                .transactions
                .groups
                .values()
                .all(|g| g.committed));
        } else {
            let state = f.ledger.guard.read().unwrap().snapshot;
            repo.authorize_recovery(winner, org, &f.account.account, false, op, 2)
                .await
                .unwrap();
            assert_eq!(f.ledger.guard.read().unwrap().snapshot, state);
            let status = repo
                .request(winner, org, &f.account.account, false, false)
                .await
                .unwrap()
                .unwrap();
            assert_eq!(status.revision, 3);
            assert!(status.lookup_only);
            assert_eq!(status.disposition, "pending");
        }
        let after = f.ledger.guard.read().unwrap().snapshot.sources.scopes[&scope_key].clone();
        assert_eq!(after.accepted[&op], original);
        assert_eq!(after.dispatches, before.dispatches);
        assert_eq!(after.outcomes, before.outcomes);
        let row=pg.query_one("SELECT revision,requested_by,customer_id,first_attempt_at,lookup_only,created_at FROM team_stripe_customer_operations WHERE operation_id=$1",&[&op]).await.unwrap();
        assert_eq!(row.get::<_, i64>(0), if mode == 2 { 2 } else { 3 });
        assert_eq!(
            row.get::<_, Uuid>(1),
            if mode == 2 { original_actor } else { winner }
        );
        assert_eq!(row.get::<_, Option<String>>(2), customer);
        assert_eq!(row.get::<_, Option<chrono::DateTime<Utc>>>(3), first);
        assert_eq!(row.get::<_, bool>(4), mode != 2);
        assert_eq!(row.get::<_, chrono::DateTime<Utc>>(5), original.accepted_at);
        let audits: i64 = pg
            .query_one(
                "SELECT count(*) FROM team_stripe_customer_authorizations WHERE operation_id=$1",
                &[&op],
            )
            .await
            .unwrap()
            .get(0);
        assert_eq!(audits, i64::from(mode != 2));
        if mode != 2 {
            assert!(
                inventory::preview(&pg, &f.ledger.guard, &f.scopes[0])
                    .await
                    .unwrap()
                    .independent_source_matches
            );
        }
        f.close().await;
    }
}

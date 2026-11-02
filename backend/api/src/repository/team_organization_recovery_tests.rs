//! Metadata-only fixtures. These tests remain deferred to the verification phase.
use super::*;
use crate::{config::PostgresConfig, infrastructure::team_financial_guard::TestLedger};

struct Flag(Option<std::ffi::OsString>);
impl Drop for Flag {
    fn drop(&mut self) {
        if let Some(old) = &self.0 {
            std::env::set_var(team_organization_birth::FLAG, old);
        } else {
            std::env::remove_var(team_organization_birth::FLAG);
        }
    }
}

#[tokio::test]
#[ignore = "isolated atoaxis_team_onboarding_test only; verification phase, run serially"]
async fn new_owner_confirmation_retains_original_request_across_lost_ack_and_restore() {
    let url = std::env::var("POSTGRES_TEST_URL").unwrap();
    assert_eq!(
        url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
        Some("atoaxis_team_onboarding_test")
    );
    let pg = PostgresClient::connect(&PostgresConfig {
        url: Some(url),
        max_connections: 8,
    })
    .await
    .unwrap();
    pg.migrate().await.unwrap();
    let ledger = TestLedger::new(&[]);
    let deployment = ledger.deployment();
    let _env = ledger.environment();
    let _flag = Flag(std::env::var_os(team_organization_birth::FLAG));
    std::env::set_var(team_organization_birth::FLAG, "true");
    let creator = Uuid::now_v7();
    let owner = Uuid::now_v7();
    let member = Uuid::now_v7();
    for user in [creator, owner, member] {
        pg.execute(
            "INSERT INTO users(id,username,is_active) VALUES($1,$2,true)",
            &[&user, &user.to_string()],
        )
        .await
        .unwrap();
    }
    let intent = Uuid::now_v7();
    let slug = format!("fixture-{intent}");
    ledger.guard.fail_birth_confirmation_once();
    assert!(crate::repository::team_organization_birth::create(
        &pg,
        creator,
        "Synthetic pending creation",
        &slug,
        intent,
        &deployment
    )
    .await
    .is_err());
    let birth = ledger
        .guard
        .read()
        .unwrap()
        .snapshot
        .births
        .values()
        .find(|b| b.birth.intent == intent)
        .unwrap()
        .birth
        .clone();
    let org = birth.organization;
    assert!(pg
        .query_opt("SELECT 1 FROM organizations WHERE id=$1", &[&org])
        .await
        .unwrap()
        .is_some());
    assert!(!ledger.guard.read().unwrap().snapshot.births[&org].confirmed);
    pg.execute("UPDATE organization_members SET deactivated_at=clock_timestamp() WHERE organization_id=$1 AND user_id=$2", &[&org,&creator]).await.unwrap();
    for (user, role) in [(owner, "owner"), (member, "member")] {
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,$3,'developer')", &[&org,&user,&role]).await.unwrap();
    }
    for denied in [creator, member] {
        assert!(execute(
            &pg,
            denied,
            OrganizationBirthAction::InspectBirth {
                organization_id: org
            },
            &deployment
        )
        .await
        .is_err());
    }
    std::env::set_var(team_organization_birth::FLAG, "false");
    let off = execute(
        &pg,
        owner,
        OrganizationBirthAction::InspectBirth {
            organization_id: org,
        },
        &deployment,
    )
    .await
    .unwrap()
    .creation_recovery
    .unwrap();
    assert!(!off.can_confirm);
    assert!(!off.starts_trial);
    assert!(!off.creates_organization);
    std::env::set_var(team_organization_birth::FLAG, "true");
    let observed = execute(
        &pg,
        owner,
        OrganizationBirthAction::InspectBirth {
            organization_id: org,
        },
        &deployment,
    )
    .await
    .unwrap()
    .creation_recovery
    .unwrap();
    assert_eq!(observed.disposition, "confirmation_required");
    assert!(observed.can_confirm);
    let id = Uuid::now_v7();
    let request = OrganizationBirthAction::ConfirmBirth {
        organization_id: org,
        creation_id: observed.creation_id,
        expected_birth_digest: observed.birth_digest.clone(),
        expected_observation: observed.observation.clone(),
        confirmation_id: id,
    };
    ledger.guard.fail_birth_confirmation_once();
    assert!(execute(&pg, owner, request.clone(), &deployment)
        .await
        .is_err());
    assert!(!ledger.guard.read().unwrap().snapshot.births[&org].confirmed);
    let saved = execute(
        &pg,
        owner,
        OrganizationBirthAction::InspectBirth {
            organization_id: org,
        },
        &deployment,
    )
    .await
    .unwrap()
    .creation_recovery
    .unwrap();
    assert_eq!(saved.disposition, "confirmation_requested");
    assert_eq!(saved.confirmation_id, Some(id));
    assert!(!saved.confirmation_recorded);
    let wrong = OrganizationBirthAction::ConfirmBirth {
        organization_id: org,
        creation_id: saved.creation_id,
        expected_birth_digest: saved.birth_digest,
        expected_observation: saved.observation,
        confirmation_id: Uuid::now_v7(),
    };
    assert!(execute(&pg, owner, wrong, &deployment).await.is_err());
    pg.execute("UPDATE organization_members SET deactivated_at=clock_timestamp() WHERE organization_id=$1 AND user_id=$2", &[&org,&owner]).await.unwrap();
    assert!(execute(&pg, owner, request.clone(), &deployment)
        .await
        .is_err());
    assert!(!ledger.guard.read().unwrap().snapshot.births[&org].confirmed);
    pg.execute("UPDATE organization_members SET deactivated_at=NULL WHERE organization_id=$1 AND user_id=$2", &[&org,&owner]).await.unwrap();
    let confirmed = execute(&pg, owner, request.clone(), &deployment)
        .await
        .unwrap()
        .creation_recovery
        .unwrap();
    assert!(confirmed.confirmation_recorded);
    assert_eq!(confirmed.confirmation_id, Some(id));
    assert_eq!(confirmed.disposition, "confirmed");
    assert!(
        execute(&pg, owner, request.clone(), &deployment)
            .await
            .unwrap()
            .creation_recovery
            .unwrap()
            .confirmation_recorded
    );
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM team_organization_birth_confirmations WHERE organization_id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    assert_eq!(
        ledger.guard.read().unwrap().snapshot.births[&org].birth,
        birth
    );
    assert!(crate::repository::team_financial_guard::read(&pg, org)
        .await
        .is_ok());
    pg.execute(
        "DELETE FROM team_organization_birth_confirmations WHERE id=$1",
        &[&id],
    )
    .await
    .unwrap();
    assert!(crate::repository::team_financial_guard::read(&pg, org)
        .await
        .is_err());
    assert!(execute(&pg, owner, request, &deployment).await.is_err());
    assert!(pg
        .query_opt(
            "SELECT 1 FROM team_organization_birth_confirmations WHERE id=$1",
            &[&id]
        )
        .await
        .unwrap()
        .is_none());
    assert_eq!(
        ledger.guard.read().unwrap().snapshot.births[&org]
            .confirmations
            .len(),
        1
    );
}

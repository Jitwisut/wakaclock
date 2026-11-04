use super::*;
use crate::config::PostgresConfig;

async fn fixture() -> (Arc<PostgresClient>, OrganizationsService, Uuid, [Uuid; 3]) {
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
    let auth = Arc::new(AuthorizationService::new(Some(pg.clone())));
    let service = OrganizationsService::new(Some(pg.clone()), auth, None);
    let org = Uuid::now_v7();
    let users = [Uuid::now_v7(), Uuid::now_v7(), Uuid::now_v7()];
    pg.execute(
        "INSERT INTO organizations(id,slug,name) VALUES($1,$2,'Synthetic owner test')",
        &[&org, &org.to_string()],
    )
    .await
    .unwrap();
    for (user, role) in users.iter().zip(["owner", "admin", "member"]) {
        pg.execute(
            "INSERT INTO users(id,username) VALUES($1,$2)",
            &[user, &user.to_string()],
        )
        .await
        .unwrap();
        pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,$3,'developer')", &[&org,user,&role]).await.unwrap();
    }
    (pg, service, org, users)
}

#[tokio::test]
#[ignore = "isolated atoaxis_team_test only"]
async fn owner_cannot_be_removed_and_only_one_competing_transfer_can_commit() {
    let (pg, service, org, [owner, admin, member]) = fixture().await;
    let edit = AddOrganizationMemberRequest {
        user_id: owner,
        role: Some("member".into()),
        seat_type: None,
    };
    assert!(matches!(
        service
            .add_member(admin, org, edit)
            .await
            .unwrap_err()
            .downcast_ref(),
        Some(OrganizationRequestError::Conflict(_))
    ));
    assert!(matches!(
        service
            .remove_member(owner, org, owner)
            .await
            .unwrap_err()
            .downcast_ref(),
        Some(OrganizationRequestError::Conflict(_))
    ));
    assert!(service
        .transfer_ownership(admin, org, member)
        .await
        .is_err());
    assert!(service
        .transfer_ownership(owner, org, Uuid::now_v7())
        .await
        .is_err());
    let (a, b) = tokio::join!(
        service.transfer_ownership(owner, org, admin),
        service.transfer_ownership(owner, org, member)
    );
    assert_ne!(a.is_ok(), b.is_ok(), "{a:?}, {b:?}");
    let winner = if a.is_ok() { admin } else { member };
    let rows = pg.query("SELECT user_id FROM organization_members WHERE organization_id=$1 AND role='owner' AND deactivated_at IS NULL",&[&org]).await.unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].get::<_, Uuid>(0), winner);
    assert_eq!(pg.query_one("SELECT count(*) FROM audit_logs WHERE organization_id=$1 AND action='organization.ownership_transferred'",&[&org]).await.unwrap().get::<_,i64>(0),1);
    assert!(service.remove_member(winner, org, owner).await.unwrap());
}

#[tokio::test]
#[ignore = "isolated atoaxis_team_test only"]
async fn deletion_requires_successor_and_closes_only_a_single_user_personal_workspace() {
    let (pg, service, org, [owner, admin, _]) = fixture().await;
    let personal = Uuid::now_v7();
    pg.execute(
        "INSERT INTO organizations(id,slug,name,personal_owner_id) VALUES($1,$2,'Personal',$3)",
        &[&personal, &personal.to_string(), &owner],
    )
    .await
    .unwrap();
    pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,'owner','developer')", &[&personal,&owner]).await.unwrap();
    assert!(service
        .transfer_ownership(owner, personal, admin)
        .await
        .is_err());
    // The request uses only PostgreSQL. External deletes belong to the later worker.
    use crate::infrastructure::database::ClickHouseClient;
    use crate::infrastructure::object_store::{S3ObjectStore, S3ObjectStoreConfig};
    use crate::services::account_deletion::AccountDeletionService;
    let clickhouse = ClickHouseClient::new(&crate::config::ClickHouseConfig {
        url: "http://127.0.0.1:1".into(),
        user: None,
        password: None,
        database: "unused".into(),
    })
    .await
    .unwrap();
    let object_store = S3ObjectStore::new(S3ObjectStoreConfig {
        endpoint: "http://127.0.0.1:1".parse().unwrap(),
        bucket: "unused".into(),
        region: "local".into(),
        access_key_id: Uuid::new_v4().to_string(),
        secret_access_key: Uuid::new_v4().to_string(),
        session_token: None,
        path_style: true,
        allow_http: true,
    })
    .unwrap();
    let deletion = AccountDeletionService::new(
        Some(pg.clone()),
        Arc::new(clickhouse),
        Some(Arc::new(object_store)),
        None,
        crate::config::AccountDeletionMode::Job,
    );
    assert!(matches!(
        deletion.request(owner).await.unwrap_err().downcast_ref(),
        Some(OrganizationRequestError::Conflict(_))
    ));
    assert!(pg
        .query_one("SELECT is_active FROM users WHERE id=$1", &[&owner])
        .await
        .unwrap()
        .get::<_, bool>(0));
    assert!(pg
        .query(
            "SELECT 1 FROM account_deletion_requests WHERE account_id=$1",
            &[&owner]
        )
        .await
        .unwrap()
        .is_empty());
    assert!(pg
        .query_one(
            "SELECT deleted_at IS NULL FROM organizations WHERE id=$1",
            &[&personal]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    service.transfer_ownership(owner, org, admin).await.unwrap();
    let job = deletion.request(owner).await.unwrap();
    assert_eq!(deletion.request(owner).await.unwrap().id, job.id);
    assert!(pg
        .query_one(
            "SELECT deleted_at IS NOT NULL FROM organizations WHERE id=$1",
            &[&personal]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    assert!(service
        .authorization
        .require(admin, org, OrganizationAction::ManageSecurity, None)
        .await
        .is_ok());
}

#[tokio::test]
#[ignore = "isolated atoaxis_team_test only"]
async fn transfer_and_removal_cannot_install_an_inactive_owner() {
    let (pg, service, org, [owner, admin, member]) = fixture().await;
    let (transfer, removal) = tokio::join!(
        service.transfer_ownership(owner, org, member),
        service.remove_member(admin, org, member)
    );
    assert_ne!(
        transfer.is_ok(),
        matches!(removal, Ok(true)),
        "{transfer:?}, {removal:?}"
    );
    let rows = pg.query("SELECT m.user_id FROM organization_members m JOIN users u ON u.id=m.user_id
        WHERE m.organization_id=$1 AND m.role='owner' AND m.deactivated_at IS NULL AND u.is_active AND u.deleted_at IS NULL",
        &[&org]).await.unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(
        rows[0].get::<_, Uuid>(0),
        if transfer.is_ok() { member } else { owner }
    );
}

#[tokio::test]
#[ignore = "isolated atoaxis_team_test only"]
async fn reinviting_an_inactive_legacy_owner_grants_only_the_invited_role() {
    let (pg, service, org, [owner, _, member]) = fixture().await;
    pg.execute("UPDATE organization_members SET role='owner', deactivated_at=now() WHERE organization_id=$1 AND user_id=$2",
        &[&org,&member]).await.unwrap();
    let invite = service
        .invite_member(
            owner,
            org,
            InviteOrganizationMemberRequest {
                username: member.to_string(),
                role: Some("viewer".into()),
                seat_type: Some("viewer".into()),
            },
        )
        .await
        .unwrap();
    let accepted = service.accept_invite(member, invite.id).await.unwrap();
    assert_eq!(
        (accepted.role.as_str(), accepted.seat_type.as_str()),
        ("viewer", "viewer")
    );
}

#[tokio::test]
#[ignore = "isolated atoaxis_team_test only"]
async fn deleting_the_sole_member_of_a_team_workspace_closes_it() {
    let (pg, service, _, _) = fixture().await;
    let solo = Uuid::now_v7();
    pg.execute(
        "INSERT INTO users(id,username) VALUES($1,$2)",
        &[&solo, &solo.to_string()],
    )
    .await
    .unwrap();
    let team = service
        .create(
            solo,
            CreateOrganizationRequest::Create(
                crate::model::organization::CreateOrganizationFields {
                    name: "Solo Team".into(),
                    slug: Some(format!("solo-{}", solo.simple())),
                    creation_request_id: None,
                },
            ),
        )
        .await
        .unwrap();
    assert!(team.personal_owner_id.is_none());
    let mut db = pg.transaction_client().await.unwrap();
    let tx = db.transaction().await.unwrap();
    prepare_owned_workspaces_for_deletion(&tx, solo)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert!(pg
        .query_one(
            "SELECT deleted_at IS NOT NULL FROM organizations WHERE id=$1",
            &[&team.id]
        )
        .await
        .unwrap()
        .get::<_, bool>(0));
    assert_eq!(
        pg.query_one(
            "SELECT count(*) FROM audit_logs WHERE organization_id=$1 AND action='organization.closed_for_account_deletion'",
            &[&team.id]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
}

//! Fresh workspace identity only. The independent journal reserves the original
//! intent before SQL writes. Recovery confirms existing SQL; it never replays a
//! missing creation, initializes a legacy baseline, or grants a trial/consent.
use crate::{
    infrastructure::{postgres::PostgresClient, team_financial_guard::CommercialDeployment},
    model::organization::{Organization, OrganizationCreationReceipt},
    services::{
        authorization::AuthorizationService,
        team_financial_guard::fingerprint,
        team_organization_birth::{BirthConfirmation, BirthEntry, OrganizationBirth},
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use tokio_postgres::{GenericClient, Row, Transaction};
use uuid::Uuid;

pub(super) fn organization(row: Row) -> Organization {
    Organization {
        id: row.get(0),
        slug: row.get(1),
        name: row.get(2),
        personal_owner_id: row.get(3),
        created_at: row.get(4),
        updated_at: row.get(5),
        creation_receipt: None,
        creation_recovery: None,
    }
}

/// Called inside the caller's organization billing lock. Current ownership is
/// checked separately: historical creator identity is not current authority.
pub(crate) async fn verify_sql(tx: &Transaction<'_>, birth: &OrganizationBirth) -> Result<()> {
    verify_sql_inner(tx, birth, true).await
}
/// Nonlocking read projection. This never tries to take a second organization's
/// write lock on another pool connection. Caller retains its before/after ledger
/// token and final response validation, just as for enrollment observations.
pub(crate) async fn verify_readonly(pg: &PostgresClient, entry: &BirthEntry) -> Result<()> {
    let db = pg.transaction_client().await?;
    verify_entry_inner(&**db, entry, false).await
}
/// A scheduling hint must not acquire organization row locks after a job lease.
/// It cannot be used to mint receipts; the authoritative transaction rechecks.
pub(crate) async fn verify_hint(tx: &Transaction<'_>, entry: &BirthEntry) -> Result<()> {
    verify_entry_inner(tx, entry, false).await
}
pub(crate) async fn verify_entry(tx: &Transaction<'_>, entry: &BirthEntry) -> Result<()> {
    verify_entry_inner(tx, entry, true).await
}
async fn verify_entry_inner<C: GenericClient + Sync>(
    tx: &C,
    entry: &BirthEntry,
    locked: bool,
) -> Result<()> {
    ensure!(entry.confirmed, "onboarding_birth_unconfirmed");
    verify_sql_inner(tx, &entry.birth, locked).await?;
    for confirmation in entry.confirmations.values() {
        verify_confirmation_sql(tx, confirmation, locked).await?;
    }
    Ok(())
}
pub(super) async fn verify_confirmation_sql<C: GenericClient + Sync>(
    tx: &C,
    expected: &BirthConfirmation,
    locked: bool,
) -> Result<()> {
    expected.validate()?;
    let sql = if locked {
        "SELECT organization_id,actor_id,creation_id,requested_at,metadata_hash,metadata FROM team_organization_birth_confirmations WHERE id=$1 FOR SHARE"
    } else {
        "SELECT organization_id,actor_id,creation_id,requested_at,metadata_hash,metadata FROM team_organization_birth_confirmations WHERE id=$1"
    };
    let row = tx
        .query_opt(sql, &[&expected.id])
        .await?
        .context("onboarding_confirmation_receipt_missing")?;
    ensure!(
        row.get::<_, Uuid>(0) == expected.organization
            && row.get::<_, Uuid>(1) == expected.actor
            && row.get::<_, Uuid>(2) == expected.creation
            && row.get::<_, DateTime<Utc>>(3) == expected.requested_at
            && row.get::<_, String>(4) == expected.digest()?
            && serde_json::from_value::<BirthConfirmation>(row.get(5))? == *expected,
        "onboarding_confirmation_receipt_conflict"
    );
    Ok(())
}
async fn verify_sql_inner<C: GenericClient + Sync>(
    tx: &C,
    birth: &OrganizationBirth,
    locked: bool,
) -> Result<()> {
    birth.validate()?;
    let row = tx.query_opt(if locked { "SELECT namespace,intent_id,creation_id,creator_id,created_at,metadata_hash,metadata FROM team_organization_birth_receipts WHERE organization_id=$1 FOR SHARE" } else { "SELECT namespace,intent_id,creation_id,creator_id,created_at,metadata_hash,metadata FROM team_organization_birth_receipts WHERE organization_id=$1" }, &[&birth.organization]).await?
        .context("onboarding_sql_birth_missing")?;
    ensure!(
        row.get::<_, Uuid>(0) == birth.namespace
            && row.get::<_, Uuid>(1) == birth.intent
            && row.get::<_, Uuid>(2) == birth.creation
            && row.get::<_, Uuid>(3) == birth.creator
            && row.get::<_, DateTime<Utc>>(4) == birth.created_at
            && row.get::<_, String>(5) == birth.digest()?
            && serde_json::from_value::<OrganizationBirth>(row.get(6))? == *birth,
        "onboarding_sql_birth_conflict"
    );
    let audit = tx.query_opt(if locked { "SELECT id,creation_id,metadata_hash,created_at FROM team_organization_birth_audit WHERE organization_id=$1 FOR SHARE" } else { "SELECT id,creation_id,metadata_hash,created_at FROM team_organization_birth_audit WHERE organization_id=$1" }, &[&birth.organization]).await?
        .context("onboarding_sql_birth_audit_missing")?;
    ensure!(
        audit.get::<_, Uuid>(0) == birth.audit
            && audit.get::<_, Uuid>(1) == birth.creation
            && audit.get::<_, String>(2) == birth.digest()?
            && audit.get::<_, DateTime<Utc>>(3) == birth.created_at,
        "onboarding_sql_birth_audit_conflict"
    );
    let row = tx.query_opt(if locked { "SELECT personal_owner_id,created_at FROM organizations WHERE id=$1 AND deleted_at IS NULL FOR SHARE" } else { "SELECT personal_owner_id,created_at FROM organizations WHERE id=$1 AND deleted_at IS NULL" }, &[&birth.organization]).await?
        .context("onboarding_workspace_missing")?;
    ensure!(
        row.get::<_, Option<Uuid>>(0).is_none()
            && row.get::<_, DateTime<Utc>>(1) == birth.created_at,
        "onboarding_workspace_identity_conflict"
    );
    Ok(())
}

/// Also used at trial/read boundaries: a confirmed journal entry cannot paper
/// over a restored database that lost the original minimal birth proof.
pub(crate) async fn verify_retained(
    tx: &Transaction<'_>,
    org: Uuid,
    independent: &crate::infrastructure::team_financial_guard::Read,
) -> Result<()> {
    if independent.snapshot.births.contains_key(&org) {
        independent.snapshot.confirmed_birth(org)?;
        verify_entry(
            tx,
            independent
                .snapshot
                .births
                .get(&org)
                .context("onboarding_birth_missing")?,
        )
        .await?;
    }
    Ok(())
}

pub(crate) async fn create(
    pg: &PostgresClient,
    actor: Uuid,
    name: &str,
    slug: &str,
    intent: Uuid,
    deployment: &CommercialDeployment,
) -> Result<Organization> {
    ensure!(
        !actor.is_nil() && !intent.is_nil(),
        "onboarding_identity_invalid"
    );
    let guard = deployment.guard();
    let namespace = guard.namespace()?;
    let request_hash = fingerprint(&(1_u8, namespace, actor, name, slug))?;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    // Serialize the nonce before taking the eventual organization/user locks.
    tx.query_one(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,$2))",
        &[&format!("team-organization-birth:v1:{intent}"), &83_762_i64],
    )
    .await?;
    let original = guard
        .read()?
        .snapshot
        .births
        .values()
        .find(|e| e.birth.intent == intent)
        .cloned();
    if let Some(original) = original {
        ensure!(
            original.birth.creator == actor
                && original.birth.request_hash == request_hash
                && original.birth.namespace == namespace,
            "onboarding_request_conflict"
        );
        tx.rollback().await?;
        return recover(pg, actor, &original.birth, deployment).await;
    }
    // A receipt absent from the independent history is not evidence of a new
    // workspace. Do not replace it, even if a database restore made it visible.
    ensure!(
        tx.query_opt(
            "SELECT 1 FROM team_organization_birth_receipts WHERE intent_id=$1",
            &[&intent]
        )
        .await?
        .is_none(),
        "onboarding_independent_birth_missing"
    );
    ensure!(
        tx.query_opt("SELECT 1 FROM organizations WHERE slug=$1", &[&slug])
            .await?
            .is_none(),
        "organization slug is already in use"
    );
    let org = Uuid::now_v7();
    super::team_seats::lock(&tx, org).await?;
    ensure!(
        tx.query_opt(
            "SELECT 1 FROM users WHERE id=$1 AND is_active AND deleted_at IS NULL FOR SHARE",
            &[&actor]
        )
        .await?
        .is_some(),
        "onboarding_current_user_required"
    );
    let created_at = tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
    let birth = OrganizationBirth {
        schema: 1,
        namespace,
        organization: org,
        creator: actor,
        intent,
        creation: Uuid::now_v7(),
        audit: Uuid::now_v7(),
        created_at,
        request_hash,
    };
    guard.prepare_organization_birth(&birth)?;
    let token = guard.read()?.organization_token(org)?;
    tx.execute("INSERT INTO organizations(id,slug,name,personal_owner_id,created_at,updated_at) VALUES($1,$2,$3,NULL,$4,$4)",
        &[&org,&slug,&name,&created_at]).await?;
    tx.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type,joined_at) VALUES($1,$2,'owner','developer',$3)",
        &[&org,&actor,&created_at]).await?;
    let hash = birth.digest()?;
    tx.execute("INSERT INTO team_organization_birth_receipts(organization_id,namespace,intent_id,creation_id,creator_id,created_at,metadata_hash,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        &[&org,&namespace,&intent,&birth.creation,&actor,&created_at,&hash,&serde_json::to_value(&birth)?]).await?;
    tx.execute("INSERT INTO team_organization_birth_audit(id,organization_id,creation_id,metadata_hash,created_at) VALUES($1,$2,$3,$4,$5)",
        &[&birth.audit,&org,&birth.creation,&hash,&created_at]).await?;
    tx.execute("INSERT INTO audit_logs(id,organization_id,actor_user_id,action,resource_type,resource_id,metadata,created_at) VALUES($1,$2,$3,'organization.created','organization',$2,$4,$5)",
        &[&birth.audit,&org,&actor,&serde_json::json!({"creation_id":birth.creation}),&created_at]).await?;
    verify_sql(&tx, &birth).await?;
    ensure!(
        guard.read()?.organization_token(org)? == token,
        "onboarding_history_changed"
    );
    tx.commit()
        .await
        .map_err(|_| anyhow::anyhow!("onboarding_creation_unconfirmed"))?;
    recover(pg, actor, &birth, deployment).await
}

async fn recover(
    pg: &PostgresClient,
    actor: Uuid,
    birth: &OrganizationBirth,
    deployment: &CommercialDeployment,
) -> Result<Organization> {
    let guard = deployment.guard();
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    super::team_seats::lock(&tx, birth.organization).await?;
    AuthorizationService::require_locked_billing_owner(&tx, actor, birth.organization).await?;
    verify_sql(&tx, birth).await?;
    guard.confirm_organization_birth(birth)?;
    let independent = guard.read()?;
    // A pending enrollment or emergency closure cannot be reset by creation retry.
    let entry = independent
        .snapshot
        .organizations
        .get(&birth.organization)
        .context("onboarding_birth_missing")?;
    ensure!(
        !matches!(
            entry.head,
            crate::services::team_financial_guard::Head::Deleted
                | crate::services::team_financial_guard::Head::Quarantined
        ),
        "onboarding_workspace_closed"
    );
    ensure!(
        independent.snapshot.confirmed_birth(birth.organization)? == birth,
        "onboarding_birth_conflict"
    );
    verify_retained(&tx, birth.organization, &independent).await?;
    let token = independent.organization_token(birth.organization)?;
    let row = tx.query_one("SELECT id,slug,name,personal_owner_id,created_at,updated_at FROM organizations WHERE id=$1 AND deleted_at IS NULL", &[&birth.organization]).await?;
    ensure!(
        guard.read()?.organization_token(birth.organization)? == token,
        "onboarding_history_changed"
    );
    tx.commit().await?;
    let mut result = organization(row);
    result.creation_receipt = Some(OrganizationCreationReceipt {
        schema: 1,
        request_id: birth.intent,
        disposition: "confirmed",
    });
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{config::PostgresConfig, infrastructure::team_financial_guard::TestLedger};

    #[tokio::test]
    #[ignore = "isolated atoaxis_team_onboarding_test database only; verification phase"]
    async fn fresh_organization_original_nonce_concurrency_owner_and_restored_sql_loss() {
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
        let _environment = ledger.guard.environment();
        let actor = Uuid::now_v7();
        let other = Uuid::now_v7();
        for id in [actor, other] {
            pg.execute(
                "INSERT INTO users(id,username,is_active) VALUES($1,$2,true)",
                &[&id, &id.to_string()],
            )
            .await
            .unwrap();
        }
        let intent = Uuid::now_v7();
        let slug = format!("fixture-{intent}");
        let (first, second) = tokio::join!(
            create(
                &pg,
                actor,
                "Synthetic workspace",
                &slug,
                intent,
                &deployment
            ),
            create(
                &pg,
                actor,
                "Synthetic workspace",
                &slug,
                intent,
                &deployment
            )
        );
        let first = first.unwrap();
        assert_eq!(first.id, second.unwrap().id);
        assert!(create(
            &pg,
            other,
            "Synthetic workspace",
            &slug,
            intent,
            &deployment
        )
        .await
        .is_err());
        assert!(create(
            &pg,
            actor,
            "Changed original request",
            &slug,
            intent,
            &deployment
        )
        .await
        .is_err());
        let independent = ledger.guard.read().unwrap();
        let birth = independent
            .snapshot
            .confirmed_birth(first.id)
            .unwrap()
            .clone();
        assert!(independent.snapshot.verify(first.id, None).is_ok());
        assert!(super::super::team_analytics_entitlement::start_trial(
            &pg,
            first.id,
            other,
            10,
            &deployment
        )
        .await
        .is_err());
        let trial = super::super::team_analytics_entitlement::start_trial(
            &pg,
            first.id,
            actor,
            10,
            &deployment,
        )
        .await
        .unwrap();
        assert_eq!(trial.revision, 1);
        let after = ledger.guard.read().unwrap();
        assert!(after.snapshot.verify(first.id, Some(&trial)).is_ok());
        assert!(after.snapshot.verify(first.id, None).is_err());
        {
            let mut db = pg.transaction_client().await.unwrap();
            let tx = db.transaction().await.unwrap();
            super::super::team_seats::lock(&tx, first.id).await.unwrap();
            let proof = super::super::team_financial_guard::TransactionProof::capture(
                &tx,
                first.id,
                Some(&trial),
            )
            .await
            .unwrap();
            assert_eq!(proof.enrolled_state(first.id).unwrap(), &trial);
            assert!(super::super::team_financial_guard::HintProof::capture_in(
                &tx,
                first.id,
                Some(&trial)
            )
            .await
            .is_ok());
            tx.rollback().await.unwrap();
        }
        assert!(super::super::team_financial_guard::HintProof::capture(
            &pg,
            first.id,
            Some(&trial)
        )
        .await
        .is_ok());
        assert!(super::super::team_financial_guard::read(&pg, first.id)
            .await
            .is_ok());
        pg.execute(
            "UPDATE organizations SET name='Renamed current workspace' WHERE id=$1",
            &[&first.id],
        )
        .await
        .unwrap();
        assert_eq!(
            create(
                &pg,
                actor,
                "Synthetic workspace",
                &slug,
                intent,
                &deployment
            )
            .await
            .unwrap()
            .name,
            "Renamed current workspace"
        );
        pg.execute(
            "DELETE FROM team_organization_birth_receipts WHERE organization_id=$1",
            &[&first.id],
        )
        .await
        .unwrap();
        {
            let mut db = pg.transaction_client().await.unwrap();
            let tx = db.transaction().await.unwrap();
            super::super::team_seats::lock(&tx, first.id).await.unwrap();
            assert!(
                super::super::team_financial_guard::TransactionProof::capture(
                    &tx,
                    first.id,
                    Some(&trial)
                )
                .await
                .is_err()
            );
            assert!(super::super::team_financial_guard::HintProof::capture_in(
                &tx,
                first.id,
                Some(&trial)
            )
            .await
            .is_err());
            tx.rollback().await.unwrap();
        }
        assert!(super::super::team_financial_guard::HintProof::capture(
            &pg,
            first.id,
            Some(&trial)
        )
        .await
        .is_err());
        assert!(super::super::team_financial_guard::read(&pg, first.id)
            .await
            .is_err());
        assert!(create(
            &pg,
            actor,
            "Synthetic workspace",
            &slug,
            intent,
            &deployment
        )
        .await
        .is_err());
        assert!(super::super::team_analytics_entitlement::start_trial(
            &pg,
            first.id,
            actor,
            10,
            &deployment
        )
        .await
        .is_err());
        assert_eq!(
            ledger.guard.read().unwrap().snapshot.births[&first.id].birth,
            birth
        );
    }

    #[tokio::test]
    #[ignore = "isolated atoaxis_team_onboarding_test database only; verification phase"]
    async fn prepared_birth_without_sql_is_never_replayed_as_new_creation() {
        let url = std::env::var("POSTGRES_TEST_URL").unwrap();
        assert_eq!(
            url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
            Some("atoaxis_team_onboarding_test")
        );
        let pg = PostgresClient::connect(&PostgresConfig {
            url: Some(url),
            max_connections: 4,
        })
        .await
        .unwrap();
        pg.migrate().await.unwrap();
        let ledger = TestLedger::new(&[]);
        let deployment = ledger.deployment();
        let actor = Uuid::now_v7();
        let org = Uuid::now_v7();
        let intent = Uuid::now_v7();
        let slug = format!("fixture-{intent}");
        let name = "Synthetic prepared workspace";
        let namespace = ledger.guard.namespace().unwrap();
        let b = OrganizationBirth {
            schema: 1,
            namespace,
            organization: org,
            creator: actor,
            intent,
            creation: Uuid::now_v7(),
            audit: Uuid::now_v7(),
            created_at: DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).unwrap(),
            request_hash: fingerprint(&(1_u8, namespace, actor, name, &slug)).unwrap(),
        };
        ledger.guard.prepare_organization_birth(&b).unwrap();
        assert!(create(&pg, actor, name, &slug, intent, &deployment)
            .await
            .is_err());
        assert!(pg
            .query_opt("SELECT 1 FROM organizations WHERE id=$1", &[&org])
            .await
            .unwrap()
            .is_none());
        let state = ledger.guard.read().unwrap();
        assert!(!state.snapshot.births[&org].confirmed);
        assert!(state.snapshot.verify(org, None).is_err());
    }
}

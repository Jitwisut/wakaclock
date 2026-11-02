//! Current-Owner confirmation of already committed workspace birth. An immutable
//! SQL request is committed before independent confirmation; response-loss retry
//! reads both proofs. No organization, membership or entitlement is replayed.
use crate::{
    infrastructure::{
        postgres::PostgresClient,
        team_financial_guard::{CommercialDeployment, Read},
    },
    model::organization::{Organization, OrganizationBirthAction, OrganizationCreationRecovery},
    services::{
        authorization::AuthorizationService,
        team_financial_guard::Head,
        team_organization_birth::{self, BirthConfirmation, BirthEntry},
    },
};
use anyhow::{ensure, Context, Result};
use tokio_postgres::Transaction;
use uuid::Uuid;

struct Scope {
    independent: Read,
    entry: BirthEntry,
    token: String,
}

async fn scope(
    tx: &Transaction<'_>,
    org: Uuid,
    actor: Uuid,
    deployment: &CommercialDeployment,
) -> Result<Scope> {
    ensure!(
        !org.is_nil() && !actor.is_nil(),
        "onboarding_confirmation_scope_invalid"
    );
    super::team_seats::lock(tx, org).await?;
    AuthorizationService::require_locked_billing_owner(tx, actor, org).await?;
    let independent = deployment.guard().read()?;
    independent
        .snapshot
        .transactions
        .require_organization_free(org)?;
    let roster = independent
        .snapshot
        .organizations
        .get(&org)
        .context("onboarding_birth_missing")?;
    ensure!(
        !matches!(roster.head, Head::Quarantined | Head::Deleted) && roster.pending.is_none(),
        "onboarding_history_reconciliation_required"
    );
    let entry = independent
        .snapshot
        .births
        .get(&org)
        .context("onboarding_birth_missing")?
        .clone();
    ensure!(
        Some(entry.birth.namespace) == independent.snapshot.namespace,
        "onboarding_namespace_mismatch"
    );
    super::team_organization_birth::verify_sql(tx, &entry.birth).await?;
    for review in entry.confirmations.values() {
        super::team_organization_birth::verify_confirmation_sql(tx, review, true).await?;
    }
    let token = independent.organization_token(org)?;
    Ok(Scope {
        independent,
        entry,
        token,
    })
}

async fn own_request(
    tx: &Transaction<'_>,
    org: Uuid,
    actor: Uuid,
    creation: Uuid,
) -> Result<Option<BirthConfirmation>> {
    let row = tx.query_opt("SELECT metadata FROM team_organization_birth_confirmations WHERE organization_id=$1 AND actor_id=$2 AND creation_id=$3 FOR SHARE", &[&org,&actor,&creation]).await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let review: BirthConfirmation = serde_json::from_value(row.get(0))?;
    ensure!(
        review.organization == org && review.actor == actor && review.creation == creation,
        "onboarding_confirmation_receipt_conflict"
    );
    super::team_organization_birth::verify_confirmation_sql(tx, &review, true).await?;
    Ok(Some(review))
}

async fn reply(tx: &Transaction<'_>, actor: Uuid, scope: &Scope) -> Result<Organization> {
    let birth = &scope.entry.birth;
    let own = own_request(tx, birth.organization, actor, birth.creation).await?;
    let recorded = own
        .as_ref()
        .is_some_and(|r| scope.entry.confirmations.get(&r.id) == Some(r));
    let pending_request = own.is_some() && !recorded;
    let row = tx.query_one("SELECT id,slug,name,personal_owner_id,created_at,updated_at FROM organizations WHERE id=$1 AND deleted_at IS NULL", &[&birth.organization]).await?;
    let mut result = super::team_organization_birth::organization(row);
    result.creation_recovery = Some(OrganizationCreationRecovery {
        schema: 1,
        organization_id: birth.organization,
        creation_id: birth.creation,
        birth_digest: birth.digest()?,
        observation: own
            .as_ref()
            .map_or_else(|| scope.token.clone(), |r| r.observation.clone()),
        disposition: if pending_request {
            "confirmation_requested"
        } else if scope.entry.confirmed {
            "confirmed"
        } else {
            "confirmation_required"
        },
        confirmation_id: own.map(|r| r.id),
        confirmation_recorded: recorded,
        can_confirm: team_organization_birth::enabled()?
            && (pending_request || !scope.entry.confirmed),
        creates_organization: false,
        starts_trial: false,
    });
    Ok(result)
}

async fn inspect(
    pg: &PostgresClient,
    org: Uuid,
    actor: Uuid,
    deployment: &CommercialDeployment,
) -> Result<Organization> {
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    let proof = scope(&tx, org, actor, deployment).await?;
    let result = reply(&tx, actor, &proof).await?;
    ensure!(
        deployment.guard().read()?.organization_token(org)? == proof.token,
        "onboarding_history_changed"
    );
    tx.commit().await?;
    Ok(result)
}

pub(crate) async fn execute(
    pg: &PostgresClient,
    actor: Uuid,
    action: OrganizationBirthAction,
    deployment: &CommercialDeployment,
) -> Result<Organization> {
    let OrganizationBirthAction::ConfirmBirth {
        organization_id: org,
        creation_id,
        expected_birth_digest,
        expected_observation,
        confirmation_id,
    } = action
    else {
        let OrganizationBirthAction::InspectBirth { organization_id } = action else {
            unreachable!()
        };
        return inspect(pg, organization_id, actor, deployment).await;
    };
    ensure!(team_organization_birth::enabled()?, "onboarding_disabled");
    let guard = deployment.guard();
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    let proof = scope(&tx, org, actor, deployment).await?;
    ensure!(
        proof.entry.birth.creation == creation_id
            && proof.entry.birth.digest()? == expected_birth_digest,
        "onboarding_birth_confirmation_conflict"
    );
    let original = if let Some(original) = own_request(&tx, org, actor, creation_id).await? {
        ensure!(
            original.id == confirmation_id
                && original.birth_digest == expected_birth_digest
                && original.observation == expected_observation,
            "onboarding_original_confirmation_required"
        );
        original
    } else {
        // An acknowledged independent review whose SQL audit disappeared cannot
        // be reconstructed, even if its workspace/creator still exists.
        ensure!(
            !proof.independent.snapshot.identity_known(confirmation_id),
            "onboarding_confirmation_receipt_missing"
        );
        ensure!(
            !proof.entry.confirmed && proof.token == expected_observation,
            "onboarding_observation_changed"
        );
        ensure!(
            tx.query_opt(
                "SELECT 1 FROM team_organization_birth_confirmations WHERE id=$1",
                &[&confirmation_id]
            )
            .await?
            .is_none(),
            "onboarding_confirmation_identity_conflict"
        );
        let original = BirthConfirmation {
            schema: 1,
            id: confirmation_id,
            organization: org,
            creation: creation_id,
            actor,
            birth_digest: expected_birth_digest,
            observation: expected_observation,
            requested_at: tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0),
        };
        original.validate()?;
        tx.execute("INSERT INTO team_organization_birth_confirmations(id,organization_id,actor_id,creation_id,requested_at,metadata_hash,metadata) VALUES($1,$2,$3,$4,$5,$6,$7)",
            &[&original.id,&org,&actor,&creation_id,&original.requested_at,&original.digest()?,&serde_json::to_value(&original)?]).await?;
        tx.execute("INSERT INTO audit_logs(id,organization_id,actor_user_id,action,resource_type,resource_id,metadata,created_at) VALUES($1,$2,$3,'organization.birth_confirmation_requested','organization',$2,$4,$5)",
            &[&original.id,&org,&actor,&serde_json::json!({"creation_id":creation_id,"birth_digest":original.birth_digest}),&original.requested_at]).await?;
        original
    };
    ensure!(
        guard.read()?.organization_token(org)? == proof.token,
        "onboarding_history_changed"
    );
    tx.commit()
        .await
        .map_err(|_| anyhow::anyhow!("onboarding_confirmation_request_unconfirmed"))?;
    drop(db);
    // Reacquire current authority after SQL commit. Owner removal between phases
    // retains only a requested audit; it cannot authorize the later file append.
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
        .await?;
    let proof = scope(&tx, org, actor, deployment).await?;
    ensure!(
        own_request(&tx, org, actor, creation_id).await?.as_ref() == Some(&original),
        "onboarding_confirmation_receipt_conflict"
    );
    ensure!(team_organization_birth::enabled()?, "onboarding_disabled");
    guard.confirm_reviewed_birth(&original, &proof.token)?;
    let after = scope(&tx, org, actor, deployment).await?;
    ensure!(
        after.entry.confirmations.get(&original.id) == Some(&original),
        "onboarding_confirmation_unconfirmed"
    );
    let result = reply(&tx, actor, &after).await?;
    ensure!(
        guard.read()?.organization_token(org)? == after.token,
        "onboarding_history_changed"
    );
    tx.commit().await?;
    Ok(result)
}

#[cfg(test)]
#[path = "team_organization_recovery_tests.rs"]
mod tests;

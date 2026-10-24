//! Read-only independent enrollment agreement. This is one prerequisite for a
//! projection, never a substitute for consent, admission, or financial source recovery.
use crate::infrastructure::{
    postgres::PostgresClient,
    team_financial_guard::{CommercialDeployment, FinancialGuard},
};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;
#[derive(Serialize)]
pub struct DatabaseCheck {
    pub organization_id: Uuid,
    pub namespace: Uuid,
    pub enrollment: String,
    pub verified_at: DateTime<Utc>,
    pub scope: &'static str,
    pub financial_sources: &'static str,
    pub product_authorization_enabled: bool,
}
/// Private response proof. Never expose the namespace, token, or entitlement state
/// through HTTP/CSV; a request must compare the same proof before sending data.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReadProof {
    namespace: Option<Uuid>,
    token: Option<String>,
    state: Option<crate::services::team_analytics_entitlement::State>,
}

impl ReadProof {
    pub(crate) fn state(&self) -> Option<&crate::services::team_analytics_entitlement::State> {
        self.state.as_ref()
    }
}

/// Independent state agreement only; callers select an authoritative or hint API.
struct StateProof {
    organization: Uuid,
    guard: Option<FinancialGuard>,
    state: Option<crate::services::team_analytics_entitlement::State>,
    token: Option<String>,
}
fn runtime_guard(enrolled: bool) -> Result<Option<FinancialGuard>> {
    if enrolled {
        Ok(Some(
            CommercialDeployment::required_from_environment()?
                .guard()
                .clone(),
        ))
    } else {
        FinancialGuard::from_environment()
    }
}
impl StateProof {
    fn capture(
        organization: Uuid,
        state: Option<&crate::services::team_analytics_entitlement::State>,
    ) -> Result<Self> {
        let guard = runtime_guard(state.is_some())?;
        let token = Self::observe(guard.as_ref(), organization, state)?;
        Ok(Self {
            organization,
            guard,
            state: state.cloned(),
            token,
        })
    }
    fn observe(
        guard: Option<&FinancialGuard>,
        org: Uuid,
        state: Option<&crate::services::team_analytics_entitlement::State>,
    ) -> Result<Option<String>> {
        let Some(guard) = guard else {
            ensure!(
                state.is_none(),
                "financial_guard_required_for_enrolled_organization"
            );
            return Ok(None);
        };
        guard.namespace()?;
        let current = guard.read()?;
        current.snapshot.verify(org, state)?;
        Ok(Some(current.organization_token(org)?))
    }
    fn validate(&self) -> Result<()> {
        let current = runtime_guard(self.state.is_some())?;
        ensure!(
            match (&self.guard, &current) {
                (None, None) => true,
                (Some(a), Some(b)) => a.same_authority(b),
                _ => false,
            },
            "financial_guard_configuration_changed"
        );
        ensure!(
            Self::observe(current.as_ref(), self.organization, self.state.as_ref())? == self.token,
            "financial_guard_changed_during_transaction"
        );
        Ok(())
    }
}

/// Only a caller retaining billing/entitlement locks through commit may mint.
/// Short file locks never encompass a SQL await.
pub(crate) struct TransactionProof(StateProof);
impl TransactionProof {
    pub(crate) fn capture(
        org: Uuid,
        state: Option<&crate::services::team_analytics_entitlement::State>,
    ) -> Result<Self> {
        Ok(Self(StateProof::capture(org, state)?))
    }
    pub(crate) fn validate(&self) -> Result<()> {
        self.0.validate()
    }
    pub(crate) fn enrolled_state(
        &self,
        org: Uuid,
    ) -> Result<&crate::services::team_analytics_entitlement::State> {
        ensure!(
            self.0.organization == org,
            "financial_guard_transaction_scope_changed"
        );
        self.validate()?;
        self.0
            .state
            .as_ref()
            .context("commercial_enrollment_required")
    }
}
/// A claim/diagnostic hint cannot be passed to receipt minting. Claiming owns a
/// job row, not billing locks; authoritative admission rechecks in the right order.
pub(crate) struct HintProof(StateProof);
impl HintProof {
    pub(crate) fn capture(
        org: Uuid,
        state: Option<&crate::services::team_analytics_entitlement::State>,
    ) -> Result<Self> {
        Ok(Self(StateProof::capture(org, state)?))
    }
    pub(crate) fn validate(&self) -> Result<()> {
        self.0.validate()
    }
}

/// Normal administrative closure is ordered with admission by the same billing
/// lock. Emergency file-only closure is separate and does not fence SQL COMMIT.
/// Internal only; an HTTP/operator surface and deployment restore policy remain gated.
pub async fn quarantine(
    pg: &PostgresClient,
    guard: &FinancialGuard,
    org: Uuid,
    actor: Uuid,
    request: Uuid,
) -> Result<()> {
    ensure!(!request.is_nil(), "financial_quarantine_request_required");
    guard.namespace()?;
    let mut db = pg.transaction_client().await?;
    let tx = db.transaction().await?;
    super::team_seats::lock(&tx, org).await?;
    crate::services::authorization::AuthorizationService::require_locked_billing_owner(
        &tx, actor, org,
    )
    .await?;
    let _ = super::team_analytics_entitlement::load(&tx, org).await?;
    if let Some(row) = tx
        .query_opt(
            "SELECT organization_id,actor_user_id,action FROM audit_logs WHERE id=$1 FOR SHARE",
            &[&request],
        )
        .await?
    {
        ensure!(
            row.get::<_, Option<Uuid>>(0) == Some(org)
                && row.get::<_, Option<Uuid>>(1) == Some(actor)
                && row.get::<_, String>(2) == "team.financial.quarantined",
            "financial_quarantine_request_conflict"
        );
    } else {
        tx.execute("INSERT INTO audit_logs(id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,$3,'team.financial.quarantined','organization',$2,$4)", &[&request,&org,&actor,&serde_json::json!({"reason":"owner_requested_closure"})]).await?;
    }
    guard.quarantine(org)?;
    tx.commit()
        .await
        .map_err(|_| anyhow::anyhow!("financial_quarantine_commit_reconciliation_required"))?;
    Ok(())
}

pub async fn fence(pg: &PostgresClient, org: Uuid) -> Result<String> {
    crate::services::team_financial_guard::fingerprint(&read(pg, org).await?)
}

pub async fn validate_fence(pg: &PostgresClient, org: Uuid, expected: &str) -> Result<()> {
    ensure!(
        fence(pg, org).await? == expected,
        "financial_guard_changed_during_projection"
    );
    Ok(())
}

pub async fn read(pg: &PostgresClient, org: Uuid) -> Result<ReadProof> {
    let guard = FinancialGuard::from_environment()?;
    let proof = read_with_guard(pg, org, guard.as_ref()).await?;
    let current = runtime_guard(proof.state.is_some())?;
    ensure!(
        match (&guard, &current) {
            (None, None) => true,
            (Some(a), Some(b)) => a.same_authority(b),
            _ => false,
        },
        "financial_guard_configuration_changed"
    );
    // Check the same organization's token again after validating deployment mode.
    ensure!(
        StateProof::observe(current.as_ref(), org, proof.state.as_ref())? == proof.token,
        "financial_guard_changed_during_projection"
    );
    Ok(proof)
}

pub async fn validate(pg: &PostgresClient, org: Uuid, proof: &ReadProof) -> Result<()> {
    ensure!(
        read(pg, org).await? == *proof,
        "financial_guard_changed_during_projection"
    );
    Ok(())
}

async fn read_with_guard(
    pg: &PostgresClient,
    org: Uuid,
    guard: Option<&FinancialGuard>,
) -> Result<ReadProof> {
    let before = guard.map(FinancialGuard::read).transpose()?;
    let token = before
        .as_ref()
        .map(|r| r.organization_token(org))
        .transpose()?;
    let row = pg
        .query_opt(
            "SELECT e.revision,e.state FROM organizations o LEFT JOIN team_analytics_entitlements e ON e.organization_id=o.id WHERE o.id=$1 AND o.deleted_at IS NULL",
            &[&org],
        )
        .await?
        .context("financial_guard_organization_missing_or_deleted")?;
    let state = row
        .get::<_, Option<serde_json::Value>>(1)
        .map(|value| {
            let state: crate::services::team_analytics_entitlement::State =
                serde_json::from_value(value)?;
            state.validate()?;
            ensure!(
                Some(state.revision) == row.get::<_, Option<i64>>(0),
                "financial_guard_database_revision_invalid"
            );
            Ok::<_, anyhow::Error>(state)
        })
        .transpose()?;
    let Some(guard) = guard else {
        // Only never-enrolled precommercial deployments may omit configuration.
        // Commercial deployment configuration must require the ledger independently
        // of DB rows, so restoring an older DB cannot re-enable this branch.
        ensure!(
            state.is_none(),
            "financial_guard_required_for_enrolled_organization"
        );
        return Ok(ReadProof {
            namespace: None,
            token: None,
            state: None,
        });
    };
    let namespace = guard.namespace()?;
    let after = guard.read()?;
    ensure!(
        before.as_ref().and_then(|r| r.snapshot.namespace) == Some(namespace)
            && after.snapshot.namespace == Some(namespace),
        "financial_guard_namespace_mismatch"
    );
    ensure!(
        token.as_ref() == Some(&after.organization_token(org)?),
        "financial_guard_changed_during_observation"
    );
    after.snapshot.verify(org, state.as_ref())?;
    Ok(ReadProof {
        namespace: Some(namespace),
        token,
        state,
    })
}

pub async fn inspect(
    pg: &PostgresClient,
    guard: &FinancialGuard,
    org: Uuid,
    expected_namespace: Uuid,
) -> Result<DatabaseCheck> {
    ensure!(
        guard.namespace()? == expected_namespace,
        "financial_guard_namespace_mismatch"
    );
    let proof = read_with_guard(pg, org, Some(guard)).await?;
    Ok(DatabaseCheck {
        organization_id: org,
        namespace: expected_namespace,
        enrollment: if proof.state.is_some() {
            "enrolled"
        } else {
            "explicit_legacy"
        }
        .into(),
        verified_at: Utc::now(),
        scope: "enrollment_entitlement_only",
        financial_sources: "unconfirmed",
        product_authorization_enabled: false,
    })
}
/// Synthetic historical fixture only. Unlike runtime, this helper can arrange
/// historical coverage; both DB and independent metadata advance explicitly.
#[cfg(test)]
pub(crate) async fn set_test_state(
    pg: &PostgresClient,
    ledger: &crate::infrastructure::team_financial_guard::TestLedger,
    org: Uuid,
    state: &mut crate::services::team_analytics_entitlement::State,
) {
    use crate::services::team_financial_guard::{Head, Pending};
    let previous = ledger.guard.read().unwrap().snapshot.organizations[&org]
        .head
        .clone();
    let Head::Enrolled { state: old } = &previous else {
        panic!("enrolled fixture required")
    };
    state.revision = old.revision + 1;
    let id = Uuid::now_v7();
    ledger
        .guard
        .prepare(
            org,
            previous,
            Pending {
                transition_id: id,
                state: Box::new(state.clone()),
            },
        )
        .unwrap();
    pg.execute(
        "UPDATE team_analytics_entitlements SET revision=$2,state=$3 WHERE organization_id=$1",
        &[
            &org,
            &state.revision,
            &serde_json::to_value(&state).unwrap(),
        ],
    )
    .await
    .unwrap();
    ledger.guard.confirm_committed(org, id, state).unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        config::PostgresConfig,
        services::{
            team_analytics_entitlement::State,
            team_financial_guard::{Head, Pending},
        },
    };
    #[tokio::test]
    #[ignore = "requires isolated POSTGRES_TEST_URL"]
    async fn financial_guard_database_restored_before_enrollment_is_denied() {
        let url = std::env::var("POSTGRES_TEST_URL").unwrap();
        assert_eq!(
            url.parse::<tokio_postgres::Config>().unwrap().get_dbname(),
            Some("atoaxis_team_test")
        );
        let pg = PostgresClient::connect(&PostgresConfig {
            url: Some(url.clone()),
            max_connections: 4,
        })
        .await
        .unwrap();
        pg.migrate().await.unwrap();
        let root = std::env::temp_dir()
            .canonicalize()
            .unwrap()
            .join(format!("atoaxis-financial-db-{}", Uuid::now_v7()));
        std::fs::create_dir(&root).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        let org = Uuid::now_v7();
        let guard = FinancialGuard::new(root.join("guard.jsonl")).unwrap();
        let namespace = Uuid::now_v7();
        guard.initialize(namespace, vec![org]).unwrap();
        let guard = guard.pin_namespace(namespace).unwrap();
        pg.execute("INSERT INTO organizations(id,slug,name) VALUES($1,$2,'synthetic financial restore guard')", &[&org,&org.to_string()]).await.unwrap();
        let actor = Uuid::now_v7();
        let denied = Uuid::now_v7();
        for (id, role) in [(actor, "owner"), (denied, "member")] {
            pg.execute(
                "INSERT INTO users(id,username) VALUES($1,$2)",
                &[&id, &id.to_string()],
            )
            .await
            .unwrap();
            pg.execute("INSERT INTO organization_members(organization_id,user_id,role,seat_type) VALUES($1,$2,$3,'developer')", &[&org,&id,&role]).await.unwrap();
        }
        // Exercise the actual built executable as well as the repository helper;
        // otherwise a missing CLI namespace pin can escape the native DB tests.
        let cli = std::env::var("TEAM_FINANCIAL_GUARD_TEST_BIN")
            .expect("native runner must build and supply the operator CLI");
        let verify_cli = |expected: Uuid, enrollment: Option<&str>| {
            let before = std::fs::read(root.join("guard.jsonl")).unwrap();
            let result = std::process::Command::new(&cli)
                .arg("verify-database")
                .arg(root.join("guard.jsonl"))
                .arg("--namespace")
                .arg(expected.to_string())
                .arg("--organization")
                .arg(org.to_string())
                .env("POSTGRES_URL", &url)
                .output()
                .unwrap();
            assert_eq!(result.status.success(), enrollment.is_some());
            if let Some(enrollment) = enrollment {
                let report: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
                assert_eq!(report["enrollment"], enrollment);
                assert_eq!(report["product_authorization_enabled"], false);
                assert_eq!(report["financial_sources"], "unconfirmed");
            }
            assert!(!String::from_utf8_lossy(&result.stderr).contains(&url));
            assert_eq!(before, std::fs::read(root.join("guard.jsonl")).unwrap());
        };
        verify_cli(namespace, Some("explicit_legacy"));
        verify_cli(Uuid::now_v7(), None);
        // The actual executable must read mixed old enrollment/new source events
        // without interpreting a source seed as payment or product authorization.
        {
            use crate::services::team_financial_source::*;
            let scope = Scope {
                organization: org,
                account: "acct_private_source_fixture".into(),
                live: false,
            };
            guard
                .record_source(Event::Seed {
                    head: Root::empty(&scope).unwrap(),
                    scope,
                    review: Review {
                        id: Uuid::now_v7(),
                        kind: ReviewKind::ReviewedEmpty,
                        evidence_hash: "a".repeat(64),
                        reviewed_at: Utc::now(),
                    },
                    accepted: vec![],
                })
                .unwrap();
            verify_cli(namespace, Some("explicit_legacy"));
        }
        assert_eq!(
            inspect(&pg, &guard, org, namespace)
                .await
                .unwrap()
                .enrollment,
            "explicit_legacy"
        );
        assert!(inspect(&pg, &guard, org, Uuid::now_v7()).await.is_err());
        pg.execute(
            "UPDATE organizations SET deleted_at=now() WHERE id=$1",
            &[&org],
        )
        .await
        .unwrap();
        assert!(inspect(&pg, &guard, org, namespace).await.is_err());
        pg.execute(
            "UPDATE organizations SET deleted_at=NULL WHERE id=$1",
            &[&org],
        )
        .await
        .unwrap();
        assert!(inspect(&pg, &guard, Uuid::now_v7(), namespace)
            .await
            .is_err());
        let legacy = read_with_guard(&pg, org, Some(&guard)).await.unwrap();
        // Expired current access must not erase valid retained historical reads.
        let state = State::trial(10, Utc::now() - chrono::Duration::days(20)).unwrap();
        let id = Uuid::now_v7();
        guard
            .prepare(
                org,
                Head::Legacy,
                Pending {
                    transition_id: id,
                    state: state.clone().into(),
                },
            )
            .unwrap();
        assert!(inspect(&pg, &guard, org, namespace).await.is_err());
        pg.execute("INSERT INTO team_analytics_entitlements(organization_id,revision,state,created_at,updated_at) VALUES($1,1,$2,now(),now())", &[&org,&serde_json::to_value(&state).unwrap()]).await.unwrap();
        assert!(
            inspect(&pg, &guard, org, namespace).await.is_err(),
            "matching DB without external commit confirmation is still pending"
        );
        assert!(
            read_with_guard(&pg, org, None).await.is_err(),
            "missing configuration cannot read an enrolled DB"
        );
        guard.confirm_committed(org, id, &state).unwrap();
        let enrolled = read_with_guard(&pg, org, Some(&guard)).await.unwrap();
        verify_cli(namespace, Some("enrolled"));
        {
            let _environment = guard.environment();
            assert_eq!(read(&pg, org).await.unwrap(), enrolled);
            let transaction = TransactionProof::capture(org, Some(&state)).unwrap();
            std::env::set_var("ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED", "false");
            assert!(
                read(&pg, org).await.is_err(),
                "a journal without commercial deployment mode cannot authorize enrolled reads"
            );
            assert!(TransactionProof::capture(org, Some(&state)).is_err());
            assert!(
                transaction.validate().is_err(),
                "changing only the required flag invalidates the captured proof"
            );
            // Operator comparison remains read-only and does not grant product access.
            verify_cli(namespace, Some("enrolled"));
            std::env::set_var("ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED", "true");
            assert_eq!(read(&pg, org).await.unwrap(), enrolled);
        }

        assert_ne!(
            legacy, enrolled,
            "legacy projection must not survive enrollment"
        );
        assert!(!state.covered_at(Utc::now()));
        let other = Uuid::now_v7();
        guard.register_legacy(other).unwrap();
        assert_eq!(
            enrolled,
            read_with_guard(&pg, org, Some(&guard)).await.unwrap(),
            "unrelated organization must not cancel a response"
        );
        let mut changed = state.clone();
        changed.revision += 1;
        changed.observed_at = Utc::now();
        let next = Uuid::now_v7();
        guard
            .prepare(
                org,
                Head::Enrolled {
                    state: Box::new(state.clone()),
                },
                Pending {
                    transition_id: next,
                    state: Box::new(changed.clone()),
                },
            )
            .unwrap();
        assert!(read_with_guard(&pg, org, Some(&guard)).await.is_err());
        pg.execute(
            "UPDATE team_analytics_entitlements SET revision=$2,state=$3 WHERE organization_id=$1",
            &[
                &org,
                &changed.revision,
                &serde_json::to_value(&changed).unwrap(),
            ],
        )
        .await
        .unwrap();
        assert!(
            read_with_guard(&pg, org, Some(&guard)).await.is_err(),
            "matching pending state is not committed proof"
        );
        guard.confirm_committed(org, next, &changed).unwrap();
        assert_ne!(enrolled, read_with_guard(&pg, org, Some(&guard)).await.unwrap(), "a completed state transition invalidates an in-flight response even without a privacy generation change");
        assert_eq!(
            inspect(&pg, &guard, org, namespace)
                .await
                .unwrap()
                .enrollment,
            "enrolled"
        );
        let request = Uuid::now_v7();
        assert!(quarantine(&pg, &guard, org, denied, request).await.is_err());
        assert!(read_with_guard(&pg, org, Some(&guard)).await.is_ok());
        pg.execute("ALTER TABLE audit_logs ADD CONSTRAINT fixture_financial_quarantine_audit CHECK(action<>'team.financial.quarantined') NOT VALID", &[]).await.unwrap();
        assert!(quarantine(&pg, &guard, org, actor, request).await.is_err());
        assert!(
            read_with_guard(&pg, org, Some(&guard)).await.is_ok(),
            "failed audit before external close must not mutate ledger"
        );
        pg.execute(
            "ALTER TABLE audit_logs DROP CONSTRAINT fixture_financial_quarantine_audit",
            &[],
        )
        .await
        .unwrap();
        let mut db = pg.transaction_client().await.unwrap();
        let tx = db.transaction().await.unwrap();
        crate::repository::team_seats::lock(&tx, org).await.unwrap();
        let worker_pg = PostgresClient::connect(&PostgresConfig {
            url: std::env::var("POSTGRES_TEST_URL").ok(),
            max_connections: 4,
        })
        .await
        .unwrap();
        let worker_guard = guard.clone();
        let pending = tokio::spawn(async move {
            quarantine(&worker_pg, &worker_guard, org, actor, request).await
        });
        let mut waiting = false;
        for _ in 0..100 {
            let n:i64=pg.query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'", &[]).await.unwrap().get(0);
            if n > 0 {
                waiting = true;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert!(
            waiting,
            "normal quarantine must wait for admission's billing lock"
        );
        assert!(read_with_guard(&pg, org, Some(&guard)).await.is_ok());
        tx.commit().await.unwrap();
        pending.await.unwrap().unwrap();
        assert!(read_with_guard(&pg, org, Some(&guard)).await.is_err());
        let sequence = guard.read().unwrap().sequence;
        quarantine(&pg, &guard, org, actor, request).await.unwrap();
        assert_eq!(
            sequence,
            guard.read().unwrap().sequence,
            "response-loss retry must not append another closure"
        );
        assert_eq!(
            pg.query_one("SELECT count(*) FROM audit_logs WHERE id=$1", &[&request])
                .await
                .unwrap()
                .get::<_, i64>(0),
            1
        );
        pg.execute(
            "DELETE FROM team_analytics_entitlements WHERE organization_id=$1",
            &[&org],
        )
        .await
        .unwrap();
        assert!(
            inspect(&pg, &guard, org, namespace).await.is_err(),
            "restored missing row must never become legacy"
        );
        pg.execute("DELETE FROM organizations WHERE id=$1", &[&org])
            .await
            .unwrap();
        pg.execute(
            "DELETE FROM users WHERE id=ANY($1)",
            &[&vec![actor, denied]],
        )
        .await
        .unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }
}

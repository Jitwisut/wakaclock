//! Saved acceptance reads need no Stripe credential or mutation feature flag.
//! They still require current Owner, pinned authority and exact SQL/source proof.
use super::*;
use crate::services::{
    team_financial_guard::fingerprint,
    team_financial_transaction::operation_known,
    team_insights::TeamError,
    team_subscription_cancellation::{CancellationSelection, CancellationStatus},
};

#[derive(PartialEq, Eq)]
struct Pin {
    account: Account,
    row_hash: String,
    source_token: String,
    enrollment_token: String,
    rollout_hash: String,
}
/// Not serializable/constructible by callers. A final fence repeats the read,
/// including Owner and generation, before releasing its safe response DTO.
pub struct SavedCancellation {
    repository: CancellationRepository,
    actor: Uuid,
    organization: Uuid,
    request: FrozenCancellation,
    pin: Pin,
    status: CancellationStatus,
}
impl SavedCancellation {
    pub(crate) fn matches_selection(&self, input: &CancellationSelection) -> Result<()> {
        self.request.matches_selection(input)
    }
    pub(crate) async fn response(self) -> Result<CancellationStatus> {
        let current = self
            .repository
            .capture_saved(
                self.actor,
                self.organization,
                self.request.operation(),
                &self.pin.account,
            )
            .await?;
        ensure!(
            current.pin == self.pin && current.request == self.request,
            TeamError::ProjectionChanged
        );
        // Use the latest successful check time; it is not a provider timestamp.
        Ok(current.status)
    }
}
impl CancellationRepository {
    /// None is only an internal probe. It is not proof that no request was ever
    /// accepted, and cannot itself authorize preparation or an operation insert.
    pub async fn find_saved(
        &self,
        actor: Uuid,
        org: Uuid,
        operation: Uuid,
    ) -> Result<Option<SavedCancellation>> {
        ensure!(
            !actor.is_nil() && !org.is_nil() && !operation.is_nil(),
            TeamError::Invalid("cancellation identity required")
        );
        let guard = self.guard()?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'")
            .await?;
        // This locator is never authority. No private value is returned until
        // the locked Owner/scope/source capture below checks the row again.
        let located = tx.query_opt("SELECT account_id,livemode FROM team_subscription_cancellations WHERE operation_id=$1 AND organization_id=$2", &[&operation,&org]).await?;
        if let Some(row) = located {
            let account = Account {
                account: row.get(0),
                live: row.get(1),
            };
            tx.rollback().await?;
            return Ok(Some(
                self.capture_saved(actor, org, operation, &account).await?,
            ));
        }
        super::super::team_seats::lock(&tx, org).await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        rollout(&tx, org).await?;
        // A retained orphan, pending Prepare, other account or operation family
        // reserves this nonce even if its canonical SQL row has disappeared.
        ensure!(
            !operation_known(&guard.read()?.snapshot, operation),
            "cancellation_saved_acceptance_unconfirmed_reconciliation_required"
        );
        tx.commit().await?;
        self.guard()?;
        Ok(None)
    }
    async fn capture_saved(
        &self,
        actor: Uuid,
        org: Uuid,
        operation: Uuid,
        account: &Account,
    ) -> Result<SavedCancellation> {
        account.key()?;
        let guard = self.guard()?;
        let mut db = self.pg.transaction_client().await?;
        let tx = db.transaction().await?;
        tx.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'; SET LOCAL TIME ZONE 'UTC'").await?;
        super::super::team_financial_locks::organization(&tx, &account.account, account.live, org)
            .await?;
        AuthorizationService::require_locked_billing_owner(&tx, actor, org).await?;
        let rollout_hash = rollout(&tx, org).await?;
        super::super::team_financial_ingress::require_authority(&tx, account, Some(guard)).await?;
        ensure!(
            super::super::team_financial_transaction::source_mode(&tx, guard, account).await?,
            "cancellation_source_evidence_required"
        );
        let row=tx.query_opt("SELECT c.*,to_jsonb(c) AS status_record FROM team_subscription_cancellations c WHERE operation_id=$1 AND organization_id=$2 FOR SHARE", &[&operation,&org]).await?.context("cancellation_saved_acceptance_unconfirmed_reconciliation_required")?;
        let request = decode(&row)?;
        ensure!(
            request.scope().organization == org
                && request.scope().account == account.account
                && request.scope().live == account.live,
            "cancellation_saved_scope_changed"
        );
        verify_initial_history(
            &tx,
            &request,
            &row.get::<_, serde_json::Value>("read_evidence"),
        )
        .await?;
        let snapshot = guard.read()?;
        ensure!(
            snapshot
                .snapshot
                .sources
                .scopes
                .get(&request.scope().key()?)
                .and_then(|entry| entry.accepted.get(&operation))
                == Some(&request.accepted_request()?),
            "cancellation_original_acceptance_unconfirmed"
        );
        let enrollment = super::super::team_analytics_entitlement::load(&tx, org).await?;
        snapshot.snapshot.verify(org, enrollment.as_ref())?;
        let pin = Pin {
            account: account.clone(),
            row_hash: fingerprint(&row.get::<_, serde_json::Value>("status_record"))?,
            source_token: super::super::team_financial_inventory::account_source_token(
                guard, account,
            )?,
            enrollment_token: snapshot.organization_token(org)?,
            rollout_hash,
        };
        let observed_at: DateTime<Utc> =
            tx.query_one("SELECT clock_timestamp()", &[]).await?.get(0);
        let (provider_disposition, provider_observed_at) = projected_provider(
            &tx,
            &snapshot.snapshot,
            &request,
            row.get("last_observation_id"),
            row.get("observed_at"),
        )
        .await?;
        let state: String = row.get("disposition");
        let retry_at: DateTime<Utc> = row.get("retry_at");
        let worker_configured = crate::services::team_subscription_cancellation::enabled().ok();
        let authorization_current_owner = row
            .get::<_, Option<Uuid>>("recovery_actor")
            .unwrap_or(request.actor())
            == actor;
        let reason = if !authorization_current_owner
            && !["effective", "withdrawn"].contains(&state.as_str())
        {
            "current_owner_readback_authorization_required"
        } else {
            status_reason(
                &state,
                worker_configured,
                provider_observed_at,
                retry_at,
                observed_at,
            )
        };
        let status = CancellationStatus {
            schema_version: 1,
            operation_id: operation,
            revision: row.get("revision"),
            accepted_at: request.accepted_at(),
            expected_period_end: request.period_end(),
            requested_by_current_owner: actor == request.actor(),
            authorization_current_owner,
            acceptance: "observed",
            provider_disposition,
            reason,
            // A status response never carries a provider dispatch capability.
            dispatch_available: false,
            state,
            read_only: row.get("read_only"),
            retry_at,
            last_error_code: safe_error(row.get::<_, Option<String>>("last_error_code")),
            provider_observed_at,
            worker_configured,
            observed_at,
        };
        // A queue/row alone does not establish acceptance. Validate the complete
        // canonical inventory and independent root before committing this read.
        let write = super::super::team_financial_transaction::NormalWrite::begin_organization(
            tx, guard, account, org,
        )
        .await?;
        ensure!(
            write.commit_operational(None).await?,
            "cancellation_saved_status_unconfirmed"
        );
        self.guard()?;
        ensure!(
            super::super::team_financial_inventory::account_source_token(guard, account)?
                == pin.source_token
                && guard.read()?.organization_token(org)? == pin.enrollment_token,
            TeamError::ProjectionChanged
        );
        Ok(SavedCancellation {
            repository: self.clone(),
            actor,
            organization: org,
            request,
            pin,
            status,
        })
    }
}

fn safe_error(code: Option<String>) -> Option<String> {
    code.map(|code| {
        if [
            "network",
            "provider_unavailable",
            "rate_limited",
            "auth_required",
            "permission_required",
            "subscription_unconfirmed",
            "unsupported_contract",
            "provider_scope_mismatch",
            "observation_changed",
            "authority_changed",
            "owner_changed",
            "recovery_required",
        ]
        .contains(&code.as_str())
        {
            code
        } else {
            "unconfirmed".into()
        }
    })
}
fn status_reason(
    state: &str,
    configured: Option<bool>,
    provider_at: Option<DateTime<Utc>>,
    retry_at: DateTime<Utc>,
    now: DateTime<Utc>,
) -> &'static str {
    if ["owner_changed", "recovery_required", "changed", "withdrawn"].contains(&state) {
        return "read_only_recovery_required";
    }
    if provider_at.is_some_and(|at| at > now || now - at > Duration::minutes(5)) {
        return "provider_observation_stale";
    }
    match state {
        "effective" => "provider_observed_effective",
        "provider_scheduled" if configured == Some(true) => "provider_observed_scheduled",
        _ if configured != Some(true) => "worker_disabled_or_configuration_unconfirmed",
        _ if retry_at > now => "retry_scheduled",
        _ if provider_at.is_none() => "awaiting_provider_read",
        _ => "awaiting_provider_confirmation",
    }
}
/// Read a confirmed actual observation, never infer a provider state from an
/// accepted row, local time, empty queue or current configuration. Later auth
/// revisions may keep historical evidence; its provider timestamp stays original.
async fn projected_provider(
    tx: &tokio_postgres::Transaction<'_>,
    snapshot: &crate::services::team_financial_guard::Snapshot,
    request: &FrozenCancellation,
    id: Option<Uuid>,
    observed_at: Option<DateTime<Utc>>,
) -> Result<(Option<&'static str>, Option<DateTime<Utc>>)> {
    use crate::services::team_subscription_cancellation::{
        projection::{CancellationProjection, ProjectionMode},
        Disposition,
    };
    let Some(id) = id else {
        ensure!(
            observed_at.is_none(),
            "cancellation_status_observation_changed"
        );
        return Ok((None, None));
    };
    let entry = snapshot
        .sources
        .scopes
        .get(&request.scope().key()?)
        .context("cancellation_status_source_missing")?;
    let observation = entry
        .cancellation_observations
        .get(&id)
        .context("cancellation_status_observation_missing")?;
    ensure!(
        observation.request == *request
            && sql_observation_matches(observed_at, observation.observed_at)
            && !entry.unapplied_outcomes.contains(&observation.outcome),
        "cancellation_status_observation_unconfirmed"
    );
    let row=tx.query_opt("SELECT operation_id,exchange_id,projected_at,projection_metadata,metadata_sha256 FROM team_subscription_cancellation_projections WHERE observation_id=$1 FOR SHARE", &[&id]).await?.context("cancellation_status_projection_missing")?;
    let projection: CancellationProjection = serde_json::from_value(row.get("projection_metadata"))
        .map_err(|_| anyhow::anyhow!("cancellation_status_projection_invalid"))?;
    projection.validate()?;
    ensure!(projection.request == *request && projection.observation == *observation
        && matches!(projection.mode, ProjectionMode::Current {..})
        && row.get::<_,Uuid>("operation_id")==request.operation()
        && row.get::<_,Uuid>("exchange_id")==projection.exchange.id
        && row.get::<_,DateTime<Utc>>("projected_at")==projection.projected_at
        && row.get::<_,String>("metadata_sha256")==projection.audit_hash()?
        && snapshot.transactions.groups.values().any(|group| group.committed
            && matches!(group.proposal.writer.as_ref(), Some(Writer::CancellationResult {projection: saved}) if **saved == projection)),
        "cancellation_status_projection_unconfirmed");
    control::exchange_next(tx, request, &projection.exchange).await?;
    let disposition =
        match request.disposition(&observation.subscription, observation.observed_at)? {
            Disposition::NotObservedScheduled => "not_observed_scheduled",
            Disposition::ProviderObservedScheduled => "provider_scheduled",
            Disposition::EffectiveAtExpectedBoundary => "effective_at_expected_boundary",
            Disposition::ChangedOrUnconfirmed => "changed_or_unconfirmed",
        };
    Ok((Some(disposition), Some(observation.observed_at)))
}
fn sql_observation_matches(sql: Option<DateTime<Utc>>, retained: DateTime<Utc>) -> bool {
    sql == DateTime::from_timestamp_micros(retained.timestamp_micros())
}
async fn rollout(tx: &tokio_postgres::Transaction<'_>, org: Uuid) -> Result<String> {
    let row=tx.query_opt("SELECT to_jsonb(r) FROM team_rollouts r WHERE organization_id=$1 AND enabled FOR SHARE",&[&org]).await?.context(TeamError::Disabled)?;
    fingerprint(&row.get::<_, serde_json::Value>(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_status_distinguishes_transport_configuration_state_and_stale_evidence() {
        let now = Utc::now();
        assert_eq!(
            status_reason("pending", Some(true), None, now, now),
            "awaiting_provider_read"
        );
        assert_eq!(
            status_reason("pending", Some(false), None, now, now),
            "worker_disabled_or_configuration_unconfirmed"
        );
        assert_eq!(
            status_reason("pending", Some(true), None, now + Duration::minutes(1), now),
            "retry_scheduled"
        );
        assert_eq!(
            status_reason(
                "provider_scheduled",
                Some(true),
                Some(now - Duration::minutes(6)),
                now,
                now
            ),
            "provider_observation_stale"
        );
        assert_eq!(
            status_reason("provider_scheduled", Some(true), Some(now), now, now),
            "provider_observed_scheduled"
        );
        assert_eq!(
            status_reason("recovery_required", Some(true), Some(now), now, now),
            "read_only_recovery_required"
        );
        assert_eq!(
            safe_error(Some("PRIVATE_PROVIDER_CONTENT".into())).as_deref(),
            Some("unconfirmed")
        );
    }
    #[test]
    fn cancellation_status_preserves_nanosecond_evidence_when_sql_has_microseconds() {
        let retained = DateTime::parse_from_rfc3339("2026-10-29T10:20:30.123456789Z")
            .unwrap()
            .with_timezone(&Utc);
        let sql = DateTime::from_timestamp_micros(retained.timestamp_micros());
        assert_ne!(sql, Some(retained));
        assert!(sql_observation_matches(sql, retained));
        assert!(!sql_observation_matches(
            sql.map(|time| time + Duration::microseconds(1)),
            retained
        ));
        assert!(!sql_observation_matches(None, retained));
    }
}

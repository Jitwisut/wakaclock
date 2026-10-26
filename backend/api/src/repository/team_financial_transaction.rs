//! Normal financial SQL coordinator; signed ingress and bounded idle scheduling. No seed, provider create, arbitrary-root
//! capability, owner-term replay or production-readiness grant is exposed here.
use super::{team_financial_ingress as ingress, team_financial_inventory as inventory};
use crate::{
    infrastructure::team_financial_guard::{FinancialGuard, TransactionStatus},
    services::{
        team_financial_guard::{fingerprint, Head, Snapshot},
        team_financial_ingress::{Notification, Proposal as IngressProposal, Scope as Account},
        team_financial_source::{Root, Scope, Transition},
        team_financial_transaction::{
            self as protocol, Event, Mode, ScheduleTarget, SourceChange, Writer,
        },
    },
};
use anyhow::{ensure, Context, Result};
use tokio_postgres::Transaction;
use uuid::Uuid;

/// Presence selects the stricter writer protocol; it is never baseline proof.
/// SQL-only restored checkpoints and outcome-only evidence cannot select legacy.
pub(super) async fn source_mode(
    tx: &Transaction<'_>,
    guard: &FinancialGuard,
    account: &Account,
) -> Result<bool> {
    let ledger = guard
        .read()?
        .snapshot
        .sources
        .scopes
        .values()
        .any(|s| s.scope.account == account.account && s.scope.live == account.live);
    let sql:bool=tx.query_one("SELECT EXISTS(SELECT 1 FROM team_financial_source_heads WHERE account_id=$1 AND livemode=$2)",&[&account.account,&account.live]).await?.get(0);
    Ok(ledger || sql)
}
/// Skip only proven closed scopes; unknown/conflicting evidence is not closure.
pub(super) fn retired(guard: &FinancialGuard, account: &Account) -> Result<Vec<Uuid>> {
    let state = guard.read()?.snapshot;
    Ok(state
        .sources
        .scopes
        .values()
        .filter(|s| {
            s.scope.account == account.account
                && s.scope.live == account.live
                && protocol::retired_nonparticipant(&state, s, &[])
        })
        .map(|s| s.scope.organization)
        .collect())
}

fn orgs(scopes: &[Scope]) -> Vec<Uuid> {
    scopes.iter().map(|s| s.organization).collect()
}
fn token(state: &Snapshot, account: &Account, scopes: &[Scope]) -> Result<String> {
    protocol::observation_hash(state, account, &orgs(scopes))
}
fn ingress_change(account: &Account, proposal: &IngressProposal, scope: &Scope) -> Result<String> {
    fingerprint(&("signed_ingress_source_change_v1", account, proposal, scope))
}
async fn enrollment_matches(tx: &Transaction<'_>, state: &Snapshot, org: Uuid) -> Result<()> {
    let sql = super::team_analytics_entitlement::load(tx, org).await?;
    let entry = state
        .organizations
        .get(&org)
        .context("financial_guard_unknown_organization")?;
    ensure!(
        entry.pending.is_none(),
        "financial_guard_reconciliation_required"
    );
    ensure!(
        match (&entry.head, sql.as_ref()) {
            (Head::Legacy, None) => true,
            (Head::Enrolled { state }, Some(observed)) => state.as_ref() == observed,
            _ => false,
        },
        "financial_guard_database_or_scope_unconfirmed"
    );
    Ok(())
}
async fn enrollment_next(tx: &Transaction<'_>, change: &protocol::EnrollmentChange) -> Result<()> {
    ensure!(
        super::team_analytics_entitlement::load(tx, change.organization)
            .await?
            .as_ref()
            == Some(change.transition.state.as_ref()),
        "financial_transaction_enrollment_next_unconfirmed"
    );
    let history=tx.query_opt("SELECT reason,state FROM team_analytics_entitlement_history WHERE organization_id=$1 AND revision=$2",&[&change.organization,&change.transition.state.revision]).await?.context("financial_transaction_enrollment_history_missing")?;
    ensure!(
        history.get::<_, String>(0) == "provider_observed"
            && serde_json::from_value::<crate::services::team_analytics_entitlement::State>(
                history.get(1)
            )? == *change.transition.state,
        "financial_transaction_enrollment_history_conflict"
    );
    Ok(())
}
async fn checkpoint(
    tx: &Transaction<'_>,
    scope: &Scope,
    old: &Root,
    old_transition: Option<Uuid>,
    next: &Root,
    id: Uuid,
) -> Result<()> {
    ensure!(tx.execute("UPDATE team_financial_source_heads SET revision=$4,record_count=$5,root_hash=$6,transition_id=$7,updated_at=clock_timestamp() WHERE organization_id=$1 AND account_id=$2 AND livemode=$3 AND schema_version=$8 AND revision=$9 AND record_count=$10 AND root_hash=$11 AND transition_id IS NOT DISTINCT FROM $12",&[&scope.organization,&scope.account,&scope.live,&i64::try_from(next.revision)?,&i64::try_from(next.records)?,&next.hash,&id,&i16::from(old.schema),&i64::try_from(old.revision)?,&i64::try_from(old.records)?,&old.hash,&old_transition]).await?==1,"financial_source_checkpoint_changed");
    Ok(())
}

struct Association {
    customer: Option<String>,
    subscription: Option<String>,
    expected: inventory::Associations,
}
async fn recheck(
    tx: &Transaction<'_>,
    guard: &FinancialGuard,
    account: &Account,
    associations: &[Association],
) -> Result<()> {
    for a in associations {
        ensure!(
            inventory::associations(
                tx,
                guard,
                account,
                a.customer.as_deref(),
                a.subscription.as_deref()
            )
            .await?
                == a.expected,
            "financial_source_association_changed"
        );
    }
    Ok(())
}
/// Owns the actual transaction so a proof cannot be applied to another connection
/// or confirmed after the caller independently commits/rolls back its transaction.
pub(super) struct NormalWrite<'a> {
    tx: deadpool_postgres::Transaction<'a>,
    guard: FinancialGuard,
    account: Account,
    before: Snapshot,
    scopes: Vec<Scope>,
    associations: Vec<Association>,
    notification: Option<Notification>,
    resolution: Option<inventory::CustomerResolution>,
}
impl<'a> NormalWrite<'a> {
    pub(super) async fn begin(
        tx: deadpool_postgres::Transaction<'a>,
        guard: &FinancialGuard,
        account: &Account,
        notification: &Notification,
        association: inventory::Associations,
    ) -> Result<Self> {
        Self::begin_observed(
            tx,
            guard,
            account,
            vec![Association {
                customer: notification.customer.clone(),
                subscription: notification.subscription.clone(),
                expected: association,
            }],
            Some(notification.clone()),
            None,
        )
        .await
    }
    pub(super) async fn begin_targets(
        tx: deadpool_postgres::Transaction<'a>,
        guard: &FinancialGuard,
        account: &Account,
        targets: &[ScheduleTarget],
    ) -> Result<Self> {
        let mut associations = Vec::new();
        for target in targets {
            let expected = inventory::associations(
                &tx,
                guard,
                account,
                Some(&target.customer),
                Some(&target.subscription),
            )
            .await?;
            ensure!(
                !expected.ambiguous && expected.organizations == vec![target.organization],
                "financial_source_association_unresolved"
            );
            associations.push(Association {
                customer: Some(target.customer.clone()),
                subscription: Some(target.subscription.clone()),
                expected,
            });
        }
        Self::begin_observed(tx, guard, account, associations, None, None).await
    }
    pub(super) async fn begin_customer(
        tx: deadpool_postgres::Transaction<'a>,
        guard: &FinancialGuard,
        account: &Account,
        org: Uuid,
        customer: &str,
    ) -> Result<Self> {
        let expected = inventory::associations(&tx, guard, account, Some(customer), None).await?;
        ensure!(
            !expected.ambiguous && expected.organizations == vec![org],
            "financial_source_association_unresolved"
        );
        Self::begin_observed(
            tx,
            guard,
            account,
            vec![Association {
                customer: Some(customer.into()),
                subscription: None,
                expected,
            }],
            None,
            None,
        )
        .await
    }
    /// A server-resolved org can accept its first request without inventing a
    /// provider association. Roster, enrollment and exact canonical root still apply.
    pub(super) async fn begin_organization(
        tx: deadpool_postgres::Transaction<'a>,
        guard: &FinancialGuard,
        account: &Account,
        organization: Uuid,
    ) -> Result<Self> {
        Self::begin_observed(tx, guard, account, vec![], None, Some(organization)).await
    }
    async fn begin_observed(
        tx: deadpool_postgres::Transaction<'a>,
        guard: &FinancialGuard,
        account: &Account,
        associations: Vec<Association>,
        notification: Option<Notification>,
        organization: Option<Uuid>,
    ) -> Result<Self> {
        ingress::lock(&tx, account).await?;
        let orgs = associations
            .iter()
            .flat_map(|a| a.expected.organizations.iter().copied())
            .chain(organization)
            .collect::<std::collections::BTreeSet<_>>();
        ensure!(
            !orgs.is_empty()
                && orgs.len() <= 100
                && associations.len() <= 100
                && associations
                    .iter()
                    .all(|a| !a.expected.ambiguous && !a.expected.organizations.is_empty()),
            "financial_source_association_unresolved"
        );
        for org in &orgs {
            super::team_seats::lock(&tx, *org).await?;
        }
        ingress::ready(&tx, guard, account).await?;
        recheck(&tx, guard, account, &associations).await?;
        let before = guard.read()?.snapshot;
        let scopes = orgs
            .into_iter()
            .map(|organization| Scope {
                organization,
                account: account.account.clone(),
                live: account.live,
            })
            .collect::<Vec<_>>();
        let expected = token(&before, account, &scopes)?;
        for scope in &scopes {
            before
                .transactions
                .require_organization_free(scope.organization)?;
            enrollment_matches(&tx, &before, scope.organization).await?;
            let observed = inventory::in_transaction(&tx, guard, scope).await?;
            ensure!(
                observed.independent_source_matches
                    && !observed.identity_conflict
                    && !observed.legacy_scope_unconfirmed,
                "financial_source_predecessor_unconfirmed"
            );
            let head = observed
                .checkpoint
                .as_ref()
                .context("financial_source_sql_uninitialized")?;
            let entry = before.sources.verify(scope, head)?;
            ensure!(
                entry.committed_transition == observed.checkpoint_transition,
                "financial_source_checkpoint_changed"
            );
        }
        ensure!(
            token(&guard.read()?.snapshot, account, &scopes)? == expected,
            "financial_source_changed_during_observation"
        );
        Ok(Self {
            tx,
            guard: guard.clone(),
            account: account.clone(),
            before,
            scopes,
            associations,
            notification,
            resolution: None,
        })
    }
    pub(super) async fn begin_customer_resolution(
        tx: deadpool_postgres::Transaction<'a>,
        guard: &FinancialGuard,
        account: &Account,
        scope: &Scope,
        operation: Uuid,
        customer: &str,
    ) -> Result<Self> {
        let selected =
            inventory::select_customer_resolution(&tx, guard, scope, operation, customer).await?;
        ingress::ready(&tx, guard, account).await?;
        for scope in selected.scopes() {
            let before = selected.state();
            before
                .transactions
                .require_organization_free(scope.organization)?;
            enrollment_matches(&tx, before, scope.organization).await?;
            let entry = before
                .sources
                .scopes
                .get(&scope.key()?)
                .context("financial_source_uninitialized")?;
            let head = entry
                .head
                .as_ref()
                .context("financial_source_uninitialized")?;
            let old = selected.before(&tx, guard, scope).await?;
            ensure!(
                !old.identity_conflict
                    && !old.legacy_scope_unconfirmed
                    && old.checkpoint.as_ref() == Some(head)
                    && old.checkpoint_transition == entry.committed_transition
                    && old.digest.schema == head.schema
                    && old.digest.records == head.records
                    && old.digest.hash == head.hash,
                "financial_resolution_predecessor_unconfirmed"
            );
            let after = inventory::in_transaction(&tx, guard, scope).await?;
            ensure!(
                !after.identity_conflict && !after.legacy_scope_unconfirmed,
                "financial_resolution_association_conflict"
            );
        }
        selected.unchanged(guard)?;
        Ok(Self {
            before: selected.state().clone(),
            scopes: selected.scopes().to_vec(),
            tx,
            guard: guard.clone(),
            account: account.clone(),
            associations: vec![],
            notification: None,
            resolution: Some(selected),
        })
    }
    pub(super) fn customer_selection(&self) -> Result<&inventory::CustomerResolution> {
        self.resolution
            .as_ref()
            .context("financial_resolution_selection_missing")
    }
    pub(super) async fn commit_customer_resolution(
        self,
        writer: Writer,
        deadline: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<()> {
        use protocol::CustomerProjection;
        let Writer::CustomerResolution {
            organization,
            request,
            customer,
            outcomes,
            projection,
            ..
        } = &writer
        else {
            anyhow::bail!("financial_transaction_writer_mismatch");
        };
        let selected = self.customer_selection()?;
        ensure!(
            *organization == selected.scope().organization
                && request == selected.request()
                && customer == selected.customer()
                && outcomes == selected.outcomes()
                && matches!(
                    (projection, deadline),
                    (CustomerProjection::Verified { .. }, Some(_))
                        | (CustomerProjection::EvidenceOnly { .. }, None)
                ),
            "financial_resolution_selection_changed"
        );
        self.commit_group(None, Some(writer), None, deadline).await
    }
    pub(super) fn sql(&self) -> &Transaction<'_> {
        &self.tx
    }
    pub(super) async fn rollback(self) -> Result<()> {
        self.tx.rollback().await?;
        Ok(())
    }
    pub(super) async fn commit(self, ingress: IngressProposal) -> Result<()> {
        self.commit_group(Some(ingress), None, None, None).await
    }
    pub(super) async fn commit_schedule(self) -> Result<()> {
        let mut targets = self
            .associations
            .iter()
            .map(|a| {
                Ok(ScheduleTarget {
                    organization: *a
                        .expected
                        .organizations
                        .first()
                        .context("financial_schedule_owner_missing")?,
                    customer: a
                        .customer
                        .clone()
                        .context("financial_schedule_customer_missing")?,
                    subscription: a
                        .subscription
                        .clone()
                        .context("financial_schedule_subscription_missing")?,
                })
            })
            .collect::<Result<Vec<_>>>()?;
        targets.sort_by(|a, b| a.subscription.cmp(&b.subscription));
        self.commit_group(None, Some(Writer::Scheduler { targets }), None, None)
            .await
    }
    /// Lease/retry fields are excluded from canonical inventory. Validate that
    /// no semantic record changed, then commit without inventing a new source fact.
    pub(super) async fn commit_operational(
        self,
        claim: Option<&super::team_stripe::Claim>,
    ) -> Result<bool> {
        self.commit_operational_deadline(claim, None).await
    }
    pub(super) async fn commit_customer_claim(
        self,
        deadline: chrono::DateTime<chrono::Utc>,
    ) -> Result<bool> {
        self.commit_operational_deadline(None, Some(deadline)).await
    }
    pub(super) async fn commit_customer_recovery_authorization(self, writer: Writer) -> Result<()> {
        ensure!(
            matches!(writer, Writer::CustomerRecoveryAuthorization { .. }),
            "financial_transaction_writer_mismatch"
        );
        self.commit_group(None, Some(writer), None, None).await
    }
    pub(super) async fn commit_customer_lifecycle(
        self,
        writer: Writer,
        deadline: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<()> {
        ensure!(
            matches!(writer, Writer::CustomerLifecycle { .. }),
            "financial_transaction_writer_mismatch"
        );
        ensure!(
            matches!(
                (&writer, deadline),
                (
                    Writer::CustomerLifecycle {
                        stage: protocol::CustomerStage::FirstAttempt { .. },
                        ..
                    },
                    Some(_)
                ) | (
                    Writer::CustomerLifecycle {
                        stage: protocol::CustomerStage::Stop { .. },
                        ..
                    },
                    None
                )
            ),
            "financial_customer_deadline_contract_invalid"
        );
        self.commit_group(None, Some(writer), None, deadline).await
    }
    pub(super) async fn commit_quote_read(
        self,
        expires: chrono::DateTime<chrono::Utc>,
    ) -> Result<bool> {
        self.commit_operational_deadline(None, Some(expires)).await
    }
    async fn commit_operational_deadline(
        self,
        claim: Option<&super::team_stripe::Claim>,
        expires: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<bool> {
        recheck(&self.tx, &self.guard, &self.account, &self.associations).await?;
        for scope in &self.scopes {
            enrollment_matches(&self.tx, &self.before, scope.organization).await?;
            let observed = inventory::in_transaction(&self.tx, &self.guard, scope).await?;
            let previous = &self.before.sources.scopes[&scope.key()?];
            ensure!(
                observed.independent_source_matches
                    && observed.checkpoint_transition == previous.committed_transition,
                "financial_source_operational_write_changed_semantics"
            );
        }
        ensure!(
            token(&self.guard.read()?.snapshot, &self.account, &self.scopes)?
                == token(&self.before, &self.account, &self.scopes)?,
            "financial_source_changed_before_commit"
        );
        if let Some(claim) = claim {
            let valid:bool=self.tx.query_one("SELECT EXISTS(SELECT 1 FROM team_stripe_reconcile_jobs WHERE account_id=$1 AND livemode=$2 AND subscription_id=$3 AND lease_id=$4 AND lease_until>clock_timestamp() AND requested_revision=$5)",&[&claim.account_id,&claim.livemode,&claim.subscription_id,&claim.lease_id,&claim.revision]).await?.get(0);
            if !valid {
                self.tx.rollback().await?;
                return Ok(false);
            }
        }
        if let Some(expires) = expires {
            let now: chrono::DateTime<chrono::Utc> = self
                .tx
                .query_one("SELECT clock_timestamp()", &[])
                .await?
                .get(0);
            if now >= expires {
                self.tx.rollback().await?;
                return Ok(false);
            }
        }
        self.tx.commit().await?;
        Ok(true)
    }
    pub(super) async fn commit_observation(
        self,
        writer: Writer,
        change: &super::team_analytics_entitlement::Change,
        deadline: chrono::DateTime<chrono::Utc>,
    ) -> Result<()> {
        let Writer::Reconciliation { target, .. } = &writer else {
            anyhow::bail!("financial_transaction_writer_mismatch");
        };
        let org = target.organization;
        self.commit_group(None, Some(writer), Some((org, change)), Some(deadline))
            .await
    }
    pub(super) async fn commit_customer_request(self, writer: Writer) -> Result<()> {
        ensure!(
            matches!(writer, Writer::CustomerRequest { .. }),
            "financial_transaction_writer_mismatch"
        );
        self.commit_group(None, Some(writer), None, None).await
    }
    pub(super) async fn commit_quote(
        self,
        writer: Writer,
        deadline: chrono::DateTime<chrono::Utc>,
    ) -> Result<()> {
        ensure!(
            matches!(writer, Writer::Quote { .. }),
            "financial_transaction_writer_mismatch"
        );
        self.commit_group(None, Some(writer), None, Some(deadline))
            .await
    }
    async fn commit_group(
        self,
        ingress: Option<IngressProposal>,
        writer: Option<Writer>,
        change: Option<(Uuid, &super::team_analytics_entitlement::Change)>,
        deadline: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<()> {
        let entry = self.before.ingress.entry(&self.account)?;
        let id = if let Some(ingress) = &ingress {
            ensure!(
                entry.propose(ingress.receipt.clone())? == *ingress
                    && self.notification.as_ref() == Some(&ingress.receipt.notification),
                "financial_ingress_predecessor_changed"
            );
            let mut receipts = entry.receipts.clone();
            receipts.insert(
                ingress.receipt.notification.event_id.clone(),
                ingress.receipt.clone(),
            );
            ingress::matches(
                &self.tx,
                &self.account,
                &ingress.next,
                Some(ingress.receipt.transition),
                &receipts,
            )
            .await?;
            ingress.receipt.transition
        } else {
            ensure!(
                self.notification.is_none() && writer.is_some(),
                "financial_transaction_writer_missing"
            );
            ingress::ready(&self.tx, &self.guard, &self.account).await?;
            Uuid::now_v7()
        };
        recheck(&self.tx, &self.guard, &self.account, &self.associations).await?;
        let enrollments = if let Some((org, change)) = change {
            change
                .source_group(&self.guard, org, id)?
                .into_iter()
                .collect::<Vec<_>>()
        } else {
            vec![]
        };
        let mut changes = Vec::new();
        for scope in &self.scopes {
            if let Some(enrollment) = enrollments
                .iter()
                .find(|e| e.organization == scope.organization)
            {
                ensure!(
                    self.before
                        .organizations
                        .get(&scope.organization)
                        .is_some_and(|e| e.head == enrollment.expected && e.pending.is_none()),
                    "financial_guard_changed_before_commit"
                );
                enrollment_next(&self.tx, enrollment).await?;
            } else {
                enrollment_matches(&self.tx, &self.before, scope.organization).await?;
            }

            let previous = self
                .before
                .sources
                .scopes
                .get(&scope.key()?)
                .context("financial_source_uninitialized")?;
            let old = previous
                .head
                .as_ref()
                .context("financial_source_uninitialized")?;
            let observed = inventory::in_transaction(&self.tx, &self.guard, scope).await?;
            ensure!(
                !observed.identity_conflict
                    && !observed.legacy_scope_unconfirmed
                    && observed.checkpoint.as_ref() == Some(old)
                    && observed.checkpoint_transition == previous.committed_transition,
                "financial_source_checkpoint_changed"
            );
            let next = Root {
                schema: observed.digest.schema,
                revision: old
                    .revision
                    .checked_add(1)
                    .context("financial_source_revision_overflow")?,
                records: observed.digest.records,
                hash: observed.digest.hash,
            };
            checkpoint(
                &self.tx,
                scope,
                old,
                previous.committed_transition,
                &next,
                id,
            )
            .await?;
            changes.push(SourceChange {
                scope: scope.clone(),
                expected: old.clone(),
                transition: Transition {
                    id,
                    next,
                    change_hash: if let Some(i) = &ingress {
                        ingress_change(&self.account, i, scope)?
                    } else {
                        writer
                            .as_ref()
                            .context("financial_transaction_writer_missing")?
                            .change_hash(&self.account, scope)?
                    },
                    accepted: match &writer {
                        Some(Writer::CustomerRequest {
                            organization,
                            request,
                        }) if *organization == scope.organization => vec![request.clone()],
                        _ => vec![],
                    },
                    resolved_outcomes: self
                        .resolution
                        .as_ref()
                        .map_or_else(Default::default, |r| r.resolved(scope)),
                },
            });
        }
        let observation = token(&self.before, &self.account, &self.scopes)?;
        ensure!(
            token(&self.guard.read()?.snapshot, &self.account, &self.scopes)? == observation,
            "financial_source_changed_before_prepare"
        );
        let proposal = protocol::Proposal {
            id,
            namespace: self.guard.namespace()?,
            account: self.account.clone(),
            expected_ingress: entry.head.clone(),
            mode: if self.resolution.is_some() {
                Mode::ResolveOutcomes
            } else {
                Mode::Normal
            },
            observation_hash: observation,
            sources: changes,
            enrollments,
            ingress,
            writer,
        };
        let event = Event::Prepare {
            proposal: Box::new(proposal.clone()),
        };
        let mut expected = self.before;
        expected.apply(
            &crate::services::team_financial_guard::Event::FinancialTransaction {
                event: Box::new(event.clone()),
            },
        )?;
        let recorded = self.guard.record_transaction(event)?;
        #[cfg(test)]
        {
            let delay = self.guard.take_prepare_delay_ms();
            if delay > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
            }
        }
        ensure!(
            recorded.status == TransactionStatus::Prepared && recorded.appended,
            "financial_transaction_not_newly_prepared"
        );
        let current = self.guard.read()?.snapshot;
        ensure!(
            current.transactions.groups.get(&proposal.id)
                == expected.transactions.groups.get(&proposal.id)
                && token(&current, &self.account, &self.scopes)?
                    == token(&expected, &self.account, &self.scopes)?,
            "financial_source_changed_before_commit"
        );
        if let Some(deadline) = deadline {
            let now: chrono::DateTime<chrono::Utc> = self
                .tx
                .query_one("SELECT clock_timestamp()", &[])
                .await
                .map_err(|_| {
                    anyhow::anyhow!("financial_transaction_commit_reconciliation_required")
                })?
                .get(0);
            ensure!(
                now < deadline,
                if matches!(proposal.writer, Some(Writer::Quote { .. })) {
                    "financial_quote_expired_reconciliation_required"
                } else {
                    "financial_transaction_lease_reconciliation_required"
                }
            );
        }
        self.tx
            .commit()
            .await
            .map_err(|_| anyhow::anyhow!("financial_transaction_commit_reconciliation_required"))?;
        self.guard.record_transaction(Event::Confirm {
            transaction: proposal.id,
            proposal_hash: proposal.digest()?,
        })?;
        Ok(())
    }
}

/// Retry only the retained signed-ingress group's exact committed next state.
/// A predecessor, missing member, owner terms or provider-create intent is never
/// replayed from this path. It retains the complete pending intent on failure.
pub(super) async fn reconcile_ingress(
    tx: deadpool_postgres::Transaction<'_>,
    guard: &FinancialGuard,
    account: &Account,
    notification: &Notification,
) -> Result<bool> {
    ingress::lock(&tx, account).await?;
    let before = guard.read()?.snapshot;
    let Some(known) = before
        .transactions
        .groups
        .values()
        .find(|g| !g.committed && g.proposal.account == *account)
    else {
        return Ok(false);
    };
    let p = &known.proposal;
    let incoming = p
        .ingress
        .as_ref()
        .context("financial_transaction_reconciliation_required")?;
    if incoming.receipt.notification.event_id == notification.event_id
        && incoming.receipt.notification != *notification
    {
        guard.record_ingress(crate::services::team_financial_ingress::Event::Conflict {
            scope: account.clone(),
            notification: notification.clone(),
        })?;
        anyhow::bail!("financial_ingress_identity_conflict");
    }
    ensure!(
        incoming.receipt.notification == *notification
            && p.mode == Mode::Normal
            && p.enrollments.is_empty()
            && p.sources.iter().all(|s| s.transition.accepted.is_empty()
                && s.transition.resolved_outcomes.is_empty()
                && ingress_change(account, incoming, &s.scope)
                    .is_ok_and(|h| h == s.transition.change_hash)),
        "financial_transaction_reconciliation_required"
    );
    let scopes = p
        .sources
        .iter()
        .map(|s| s.scope.clone())
        .collect::<Vec<_>>();
    for scope in &scopes {
        super::team_seats::lock(&tx, scope.organization).await?;
    }
    let evidence = token(&before, account, &scopes)?;
    let associations = inventory::associations(
        &tx,
        guard,
        account,
        notification.customer.as_deref(),
        notification.subscription.as_deref(),
    )
    .await?;
    ensure!(
        !associations.ambiguous && associations.organizations == orgs(&scopes),
        "financial_source_association_changed"
    );
    let entry = before.ingress.entry(account)?;
    ensure!(
        entry.conflicts.is_empty() && entry.pending.as_ref() == Some(incoming),
        "financial_ingress_conflict_or_pending_changed"
    );
    let mut receipts = entry.receipts.clone();
    receipts.insert(
        incoming.receipt.notification.event_id.clone(),
        incoming.receipt.clone(),
    );
    ingress::matches(&tx, account, &incoming.next, Some(p.id), &receipts).await?;
    for change in &p.sources {
        enrollment_matches(&tx, &before, change.scope.organization).await?;
        let observed = inventory::in_transaction(&tx, guard, &change.scope).await?;
        let next = &change.transition.next;
        ensure!(
            !observed.identity_conflict
                && !observed.legacy_scope_unconfirmed
                && observed.checkpoint.as_ref() == Some(next)
                && observed.checkpoint_transition == Some(p.id)
                && observed.digest.schema == next.schema
                && observed.digest.records == next.records
                && observed.digest.hash == next.hash,
            "financial_transaction_next_state_unconfirmed"
        );
    }
    let current = guard.read()?.snapshot;
    ensure!(
        token(&current, account, &scopes)? == evidence
            && current.transactions.groups.get(&p.id) == Some(known),
        "financial_source_changed_during_readback"
    );
    tx.commit()
        .await
        .map_err(|_| anyhow::anyhow!("financial_transaction_commit_reconciliation_required"))?;
    guard.record_transaction(Event::Confirm {
        transaction: p.id,
        proposal_hash: known.proposal_hash.clone(),
    })?;
    Ok(true)
}

/// Only the exact committed next state of the retained bounded scheduler batch.
/// No job increment, owner terms or provider intent is replayed here.
async fn reconcile_writer(
    tx: deadpool_postgres::Transaction<'_>,
    guard: &FinancialGuard,
    account: &Account,
    expected: Option<&Writer>,
) -> Result<Writer> {
    ingress::lock(&tx, account).await?;
    let before = guard.read()?.snapshot;
    let known = before
        .transactions
        .groups
        .values()
        .find(|g| !g.committed && g.proposal.account == *account)
        .context("financial_transaction_reconciliation_required")?;
    let p = &known.proposal;
    let writer = p
        .writer
        .as_ref()
        .context("financial_transaction_writer_mismatch")?;
    ensure!(
        expected.map_or(matches!(writer, Writer::Scheduler { .. }), |e| e == writer)
            && p.mode
                == if matches!(writer, Writer::CustomerResolution { .. }) {
                    Mode::ResolveOutcomes
                } else {
                    Mode::Normal
                }
            && p.ingress.is_none(),
        "financial_transaction_writer_mismatch"
    );
    let targets = match writer {
        Writer::CustomerRecoveryAuthorization { .. }
        | Writer::CustomerRequest { .. }
        | Writer::CustomerLifecycle { .. }
        | Writer::CustomerResolution { .. } => &[],
        Writer::Quote { .. } => {
            super::team_stripe_quote::committed_quote(&tx, account, writer).await?;
            &[]
        }
        Writer::Scheduler { targets } => targets.as_slice(),
        Writer::Reconciliation { target, .. } => std::slice::from_ref(target),
    };
    let scopes = p
        .sources
        .iter()
        .map(|s| s.scope.clone())
        .collect::<Vec<_>>();
    for scope in &scopes {
        super::team_seats::lock(&tx, scope.organization).await?;
    }
    let evidence = token(&before, account, &scopes)?;
    if matches!(writer, Writer::CustomerRecoveryAuthorization { .. }) {
        super::team_stripe_customer_recovery::committed(&tx, account, writer).await?;
    }
    if matches!(writer, Writer::CustomerResolution { .. }) {
        super::team_stripe_customer_resolution::committed(&tx, account, writer).await?;
    }
    if matches!(
        writer,
        Writer::CustomerRequest { .. } | Writer::CustomerLifecycle { .. }
    ) {
        super::team_stripe_customer::committed_request(&tx, account, writer).await?;
    }
    for target in targets {
        let a = inventory::associations(
            &tx,
            guard,
            account,
            Some(&target.customer),
            Some(&target.subscription),
        )
        .await?;
        ensure!(
            !a.ambiguous && a.organizations == vec![target.organization],
            "financial_source_association_changed"
        );
        ensure!(tx.query_opt("SELECT 1 FROM team_stripe_bindings WHERE organization_id=$1 AND account_id=$2 AND livemode=$3 AND customer_id=$4 AND subscription_id=$5 AND enabled",&[&target.organization,&account.account,&account.live,&target.customer,&target.subscription]).await?.is_some(),"financial_schedule_binding_changed");
    }
    let entry = before.ingress.entry(account)?;
    entry.ready()?;
    ingress::matches(
        &tx,
        account,
        &entry.head,
        entry.committed_transition,
        &entry.receipts,
    )
    .await?;
    for change in &p.sources {
        ensure!(
            change.transition.change_hash
                == p.writer
                    .as_ref()
                    .unwrap()
                    .change_hash(account, &change.scope)?
                && change.transition.accepted
                    == match writer {
                        Writer::CustomerRequest {
                            organization,
                            request,
                        } if *organization == change.scope.organization => vec![request.clone()],
                        _ => vec![],
                    }
                && change.transition.resolved_outcomes == writer.resolved(&change.scope),
            "financial_transaction_writer_mismatch"
        );
        if let Some(enrollment) = p
            .enrollments
            .iter()
            .find(|e| e.organization == change.scope.organization)
        {
            enrollment_next(&tx, enrollment).await?;
        } else {
            enrollment_matches(&tx, &before, change.scope.organization).await?;
        }

        let observed = inventory::in_transaction(&tx, guard, &change.scope).await?;
        let next = &change.transition.next;
        ensure!(
            !observed.identity_conflict
                && !observed.legacy_scope_unconfirmed
                && observed.checkpoint.as_ref() == Some(next)
                && observed.checkpoint_transition == Some(p.id)
                && observed.digest.schema == next.schema
                && observed.digest.records == next.records
                && observed.digest.hash == next.hash,
            "financial_transaction_next_state_unconfirmed"
        );
    }
    let current = guard.read()?.snapshot;
    ensure!(
        token(&current, account, &scopes)? == evidence
            && current.transactions.groups.get(&p.id) == Some(known),
        "financial_source_changed_during_readback"
    );
    tx.commit()
        .await
        .map_err(|_| anyhow::anyhow!("financial_transaction_commit_reconciliation_required"))?;
    guard.record_transaction(Event::Confirm {
        transaction: p.id,
        proposal_hash: known.proposal_hash.clone(),
    })?;
    Ok(writer.clone())
}

pub(super) async fn reconcile_schedule(
    tx: deadpool_postgres::Transaction<'_>,
    guard: &FinancialGuard,
    account: &Account,
) -> Result<u64> {
    let writer = reconcile_writer(tx, guard, account, None).await?;
    let Writer::Scheduler { targets } = writer else {
        anyhow::bail!("financial_transaction_writer_mismatch");
    };
    Ok(targets.len() as u64)
}
pub(super) async fn reconcile_observation(
    tx: deadpool_postgres::Transaction<'_>,
    guard: &FinancialGuard,
    account: &Account,
    writer: &Writer,
) -> Result<()> {
    ensure!(
        matches!(writer, Writer::Reconciliation { .. }),
        "financial_transaction_writer_mismatch"
    );
    reconcile_writer(tx, guard, account, Some(writer)).await?;
    Ok(())
}

/// Durable history only; quote ownership/expiry for a current response is checked
/// separately. Never renew an expired quote or replay a missing SQL insert.
pub(super) async fn reconcile_quote_history(
    tx: deadpool_postgres::Transaction<'_>,
    guard: &FinancialGuard,
    account: &Account,
) -> Result<()> {
    let writer = guard
        .read()?
        .snapshot
        .transactions
        .groups
        .values()
        .find(|g| !g.committed && g.proposal.account == *account)
        .and_then(|g| g.proposal.writer.clone())
        .context("financial_transaction_reconciliation_required")?;
    ensure!(
        matches!(writer, Writer::Quote { .. }),
        "financial_transaction_writer_mismatch"
    );
    reconcile_writer(tx, guard, account, Some(&writer)).await?;
    Ok(())
}
/// Confirm retained customer acceptance history only. No request/Owner/provider
/// work is replayed, and caller authorization for a response is checked separately.
pub(super) async fn reconcile_customer_request_history(
    tx: deadpool_postgres::Transaction<'_>,
    guard: &FinancialGuard,
    account: &Account,
) -> Result<()> {
    let writer = guard
        .read()?
        .snapshot
        .transactions
        .groups
        .values()
        .find(|g| !g.committed && g.proposal.account == *account)
        .and_then(|g| g.proposal.writer.clone())
        .context("financial_transaction_reconciliation_required")?;
    ensure!(
        matches!(
            writer,
            Writer::CustomerRecoveryAuthorization { .. }
                | Writer::CustomerRequest { .. }
                | Writer::CustomerLifecycle { .. }
                | Writer::CustomerResolution { .. }
        ),
        "financial_transaction_writer_mismatch"
    );
    reconcile_writer(tx, guard, account, Some(&writer)).await?;
    Ok(())
}

pub(super) fn observation_writer(
    claim: &super::team_stripe::Claim,
    snapshot: &crate::services::team_stripe::Snapshot,
    invoice: Option<&crate::services::team_stripe_invoice::Invoice>,
) -> Result<Writer> {
    Ok(Writer::Reconciliation {
        target: ScheduleTarget {
            organization: claim.organization_id,
            customer: claim.customer_id.clone(),
            subscription: claim.subscription_id.clone(),
        },
        lease: claim.lease_id,
        revision: claim.revision,
        binding_revision: claim.binding_revision,
        observation_hash: fingerprint(&(snapshot, invoice))?,
    })
}

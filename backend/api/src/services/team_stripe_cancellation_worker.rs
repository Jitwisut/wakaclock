//! Bounded original-operation cancellation loop; all provider calls retain their
//! own evidence. This never provisions access or treats transport ACK as payment.
use super::*;
use crate::{
    repository::team_subscription_cancellation::CancellationRepository,
    services::team_financial_ingress::Scope,
    services::team_subscription_cancellation::{self as cancellation, PreparationFailure},
};

impl StripeWorker {
    pub async fn cancellation_tick(&self) -> Result<Tick> {
        cancellation::require_enabled()?;
        let repository = self.repository.cancellations()?;
        let account = Scope {
            account: self.client.account().into(),
            live: self.client.livemode(),
        };
        let start = Instant::now();
        let mut tick = Tick::default();
        repository.reconcile_history(&account).await?;
        // Metadata recovery makes progress even while provider cooldown applies;
        // the repository leaves a live caller's exact operation lease alone.
        for _ in 0..100 {
            if start.elapsed() >= Duration::from_secs(10) {
                break;
            }
            if !repository.resume_next_result(&account).await? {
                break;
            }
            tick.applied += 1;
        }
        if start.elapsed() >= Duration::from_secs(10) {
            return Ok(tick);
        }
        let Some(lease) = self
            .repository
            .claim_scope(&account.account, account.live)
            .await?
        else {
            tick.idle = tick.applied == 0;
            return Ok(tick);
        };
        let outcome = self
            .cancellation_claimed(&repository, &account, lease, start, tick)
            .await;
        match outcome {
            Ok((tick, observed)) => {
                self.repository
                    .finish_scope(&account.account, account.live, lease, observed)
                    .await?;
                Ok(tick)
            }
            Err(error) => {
                // Every local error path attempts transport-lease release. A
                // stale callback cannot clear a newer account owner/lease.
                let _ = self
                    .repository
                    .finish_scope(&account.account, account.live, lease, false)
                    .await;
                Err(error)
            }
        }
    }
    async fn cancellation_claimed(
        &self,
        repository: &CancellationRepository,
        account: &Scope,
        lease: uuid::Uuid,
        start: Instant,
        mut tick: Tick,
    ) -> Result<(Tick, bool)> {
        let mut observed = false;
        // The fast normal flow is read -> project -> original mutation. A slow
        // exchange is retained fully, then continuation waits for the next tick.
        for _ in 0..2 {
            if start.elapsed() >= Duration::from_secs(10) {
                break;
            }
            cancellation::require_enabled()?;
            let Some(claim) = repository.claim_next(account, lease).await? else {
                tick.idle = tick.applied == 0 && tick.deferred == 0;
                break;
            };
            let ticket = claim.ticket();
            let kind = match claim.preferred_kind() {
                Ok(kind) => kind,
                Err(error) => {
                    let _ = repository.finish_attempt(&ticket, None).await;
                    return Err(error);
                }
            };
            if start.elapsed() >= Duration::from_secs(10) {
                repository.finish_attempt(&ticket, None).await?;
                tick.deferred += 1;
                break;
            }
            match self
                .client
                .execute_cancellation_exchange_before(
                    claim,
                    kind,
                    Some(start + Duration::from_secs(10)),
                )
                .await
            {
                Ok(result) => {
                    observed = true;
                    match repository.project_result(&result).await {
                        Ok(current) => {
                            tick.applied += usize::from(current);
                            tick.deferred += usize::from(!current);
                        }
                        Err(error) => {
                            // Exact history reconciliation may succeed here,
                            // but uncertainty never discards a positive result.
                            let _ = repository.finish_attempt(&ticket, None).await;
                            return Err(error);
                        }
                    }
                }
                Err(PreparationFailure::Authority(_)) => {
                    repository.finish_attempt(&ticket, None).await?;
                    tick.deferred += 1;
                    break; // Local denial is not provider auth failure.
                }
                Err(PreparationFailure::Provider(error)) => {
                    // Client already fsynced the actual failure/Retry-After. The
                    // job cleanup happens while the same account lease is held.
                    let operation = repository.finish_attempt(&ticket, Some(&error)).await;
                    let account_result = self
                        .repository
                        .fail_scope(&account.account, account.live, lease, &error)
                        .await;
                    operation?;
                    account_result?;
                    tick.deferred += 1;
                    return Ok((tick, false));
                }
            }
        }
        Ok((tick, observed))
    }
}

//! Bounded reconciliation of current Stripe metadata. This worker never provisions access.
use crate::{
    infrastructure::stripe::StripeClient,
    repository::team_stripe::{Failure, TeamStripeRepository},
};
use anyhow::Result;
use std::time::{Duration, Instant};

pub struct StripeWorker {
    repository: TeamStripeRepository,
    client: StripeClient,
}
#[derive(Debug, Default)]
pub struct Tick {
    pub applied: usize,
    pub deferred: usize,
    pub idle: bool,
}
impl StripeWorker {
    pub fn new(repository: TeamStripeRepository, client: StripeClient) -> Self {
        Self { repository, client }
    }
    /// One accepted checkout per tick, sharing the account cooldown with reconciliation.
    /// Caller must enable the separate Checkout worker flag and supply the approved catalog.
    pub async fn checkout_tick(
        &self,
        catalog: &super::team_stripe_catalog::Catalog,
    ) -> Result<Tick> {
        let account = self.client.account();
        let live = self.client.livemode();
        anyhow::ensure!(
            catalog.matches_scope(account, live),
            "checkout catalog scope mismatch"
        );
        let Some(lease) = self.repository.claim_scope(account, live).await? else {
            return Ok(Tick {
                idle: true,
                ..Tick::default()
            });
        };
        let checkouts = self.repository.checkouts();
        let Some(claim) = checkouts.claim(account, live, &catalog.digest()?).await? else {
            self.repository
                .finish_scope(account, live, lease, false)
                .await?;
            return Ok(Tick {
                idle: true,
                ..Tick::default()
            });
        };
        let result = if claim.lookup_only {
            match self.client.lookup_checkout_session(&claim).await {
                Ok(crate::infrastructure::stripe::CheckoutLookup::Verified(receipt)) => Ok(receipt),
                Ok(crate::infrastructure::stripe::CheckoutLookup::Unconfirmed(reason)) => {
                    checkouts.unresolved(&claim, reason).await?;
                    self.repository
                        .finish_scope(account, live, lease, true)
                        .await?;
                    return Ok(Tick {
                        applied: 0,
                        deferred: 1,
                        idle: false,
                    });
                }
                Err(e) => Err(e),
            }
        } else if let Some(session) = claim.session_id.as_ref() {
            self.client.checkout_session(session, &claim).await
        } else {
            self.client.create_checkout_session(&claim, catalog).await
        };
        let result = match result {
            // Persist a newly verified Session before any dependent subscription request.
            // Subsequent ticks use its durable ID even if subscription readback is unavailable.
            Ok(receipt) if claim.session_id.is_none() => Ok((receipt, None)),
            Ok(receipt) => self
                .client
                .checkout_subscription(&claim, &receipt)
                .await
                .map(|binding| (receipt, binding)),
            Err(e) => Err(e),
        };
        match result {
            Ok((receipt, binding)) => {
                let applied = checkouts
                    .receive_verified(&claim, &receipt, binding.as_ref())
                    .await?;
                self.repository
                    .finish_scope(account, live, lease, true)
                    .await?;
                Ok(Tick {
                    applied: usize::from(applied),
                    deferred: usize::from(!applied),
                    idle: false,
                })
            }
            Err(error) => {
                self.repository
                    .fail_scope(account, live, lease, &error)
                    .await?;
                checkouts.fail(&claim, &error).await?;
                Ok(Tick {
                    applied: 0,
                    deferred: 1,
                    idle: false,
                })
            }
        }
    }
    pub async fn tick(&self) -> Result<Tick> {
        let account = self.client.account();
        let live = self.client.livemode();
        let Some(lease) = self.repository.claim_scope(account, live).await? else {
            return Ok(Tick {
                idle: true,
                ..Tick::default()
            });
        };
        self.repository.schedule_bound(account, live).await?;
        let start = Instant::now();
        let mut tick = Tick::default();
        let mut observed = false;
        // At most one provisioning job per tick; subscription reconciliation retains its budget.
        let customers = self.repository.customers();
        if let Some(claim) = customers.claim(account, live).await? {
            let result = match self.client.verify_account().await {
                Ok(()) => {
                    observed = true;
                    if claim.lookup_only {
                        self.client.lookup_customer(&claim).await
                    } else {
                        self.client
                            .create_customer(&claim)
                            .await
                            .map(crate::infrastructure::stripe::CustomerLookup::Verified)
                    }
                }
                Err(error) => Err(error),
            };
            match result {
                Ok(crate::infrastructure::stripe::CustomerLookup::Unconfirmed(reason)) => {
                    customers.unresolved(&claim, reason).await?;
                    tick.deferred += 1;
                }
                Ok(crate::infrastructure::stripe::CustomerLookup::Verified(customer)) => {
                    if customers.complete(&claim, &customer).await? {
                        tick.applied += 1;
                    } else {
                        tick.deferred += 1;
                    }
                }
                Err(error) => {
                    // Shared cooldown applies to all writes/reads for this account and mode.
                    self.repository
                        .fail_scope(account, live, lease, &error)
                        .await?;
                    customers.fail(&claim, &error).await?;
                    tick.deferred += 1;
                    return Ok(tick);
                }
            }
        }
        for _ in 0..100 {
            if start.elapsed() >= Duration::from_secs(10) {
                break;
            }
            let Some(claim) = self.repository.claim(account, live).await? else {
                tick.idle = tick.applied == 0 && tick.deferred == 0;
                break;
            };
            // Verify the key's own account, not an arbitrary connected account ID.
            if !observed {
                if let Err(error) = self.client.verify_account().await {
                    self.repository
                        .fail_scope(account, live, lease, &error)
                        .await?;
                    self.repository
                        .fail(&claim, error.kind, error.status, error.retry_after)
                        .await?;
                    tick.deferred += 1;
                    return Ok(tick);
                }
                observed = true;
            }
            match self.client.current_observation(&claim).await {
                Ok((snapshot, invoice)) => {
                    if self
                        .repository
                        .complete_observation(&claim, &snapshot, invoice.as_ref())
                        .await?
                    {
                        tick.applied += 1;
                    } else {
                        tick.deferred += 1;
                    }
                }
                Err(error) => {
                    tick.deferred += 1;
                    let global = !matches!(
                        error.kind,
                        Failure::NotFound | Failure::InvalidContract | Failure::ObservationChanged
                    ) || error.retry_after.is_some();
                    // Commit shared cooldown before releasing any job lease; restart cannot bypass it.
                    if global {
                        self.repository
                            .fail_scope(account, live, lease, &error)
                            .await?;
                    }
                    self.repository
                        .fail(&claim, error.kind, error.status, error.retry_after)
                        .await?;
                    if global {
                        return Ok(tick);
                    }
                }
            }
        }
        self.repository
            .finish_scope(account, live, lease, observed)
            .await?;
        Ok(tick)
    }
}

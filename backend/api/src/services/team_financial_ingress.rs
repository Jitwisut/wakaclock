//! Independent account-level ingress receipts. Never owner/payment authorization.
use super::{team_financial_guard::fingerprint, team_stripe};
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

pub const MAX_RECEIPTS: usize = 10_000;
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Scope {
    pub account: String,
    pub live: bool,
}
impl Scope {
    pub fn key(&self) -> Result<String> {
        ensure!(
            team_stripe::id(&self.account, "acct_"),
            "financial_ingress_scope_invalid"
        );
        fingerprint(&("account_ingress_v1", self))
    }
}
fn hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn micros(time: DateTime<Utc>) -> Result<DateTime<Utc>> {
    DateTime::from_timestamp_micros(time.timestamp_micros())
        .context("financial_ingress_time_invalid")
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Notification {
    pub event_id: String,
    pub payload_hash: String,
    pub kind: String,
    pub created: DateTime<Utc>,
    pub customer: Option<String>,
    pub subscription: Option<String>,
    pub invoice: Option<String>,
    pub supported: bool,
}
impl Notification {
    pub fn new(event: &team_stripe::Event, digest: &str) -> Result<Self> {
        let n = Self {
            event_id: event.event_id.clone(),
            payload_hash: digest.into(),
            kind: event.kind.clone(),
            created: micros(event.created)?,
            customer: event.customer_id.clone(),
            subscription: event.subscription_id.clone(),
            invoice: event.invoice_id.clone(),
            supported: event.supported,
        };
        n.validate()?;
        Ok(n)
    }
    fn validate(&self) -> Result<()> {
        ensure!(
            team_stripe::id(&self.event_id, "evt_")
                && hash(&self.payload_hash)
                && !self.kind.is_empty()
                && self.kind.len() <= 128
                && self
                    .kind
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_')
                && self.created.timestamp_subsec_nanos() % 1000 == 0,
            "financial_ingress_notification_invalid"
        );
        for (id, prefix) in [
            (&self.customer, "cus_"),
            (&self.subscription, "sub_"),
            (&self.invoice, "in_"),
        ] {
            ensure!(
                id.as_ref().is_none_or(|v| team_stripe::id(v, prefix)),
                "financial_ingress_identity_invalid"
            );
        }
        ensure!(
            !self.supported || (self.subscription.is_some() && self.customer.is_some()),
            "financial_ingress_supported_identity_missing"
        );
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JobBefore {
    pub requested: i64,
    pub applied: i64,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Receipt {
    pub notification: Notification,
    pub received_at: DateTime<Utc>,
    pub requested_revision: Option<i64>,
    pub job_before: Option<JobBefore>,
    pub transition: Uuid,
}
impl Receipt {
    pub fn validate(&self) -> Result<()> {
        self.notification.validate()?;
        ensure!(
            !self.transition.is_nil() && self.received_at.timestamp_subsec_nanos() % 1000 == 0,
            "financial_ingress_receipt_invalid"
        );
        let next = self
            .job_before
            .as_ref()
            .map_or(Some(1), |b| b.requested.checked_add(1));
        ensure!(
            self.job_before
                .as_ref()
                .is_none_or(|b| b.requested > 0 && b.applied >= 0 && b.applied <= b.requested),
            "financial_ingress_job_invalid"
        );
        ensure!(
            if self.notification.supported {
                self.requested_revision == next && next.is_some()
            } else {
                self.requested_revision.is_none() && self.job_before.is_none()
            },
            "financial_ingress_revision_invalid"
        );
        Ok(())
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Head {
    pub schema: u8,
    pub revision: u64,
    pub records: u64,
    pub hash: String,
}
impl Head {
    pub fn inventory(
        scope: &Scope,
        revision: u64,
        receipts: &BTreeMap<String, Receipt>,
    ) -> Result<Self> {
        scope.key()?;
        ensure!(
            revision > 0 && receipts.len() <= MAX_RECEIPTS,
            "financial_ingress_limit"
        );
        let mut hashes = BTreeMap::new();
        for (key, value) in receipts {
            value.validate()?;
            ensure!(
                &value.notification.event_id == key,
                "financial_ingress_identity_conflict"
            );
            hashes.insert(key, fingerprint(value)?);
        }
        Ok(Self {
            schema: 1,
            revision,
            records: receipts.len() as u64,
            hash: fingerprint(&(1_u8, scope, hashes))?,
        })
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Proposal {
    pub expected: Head,
    pub next: Head,
    pub receipt: Receipt,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub scope: Scope,
    pub head: Head,
    pub receipts: BTreeMap<String, Receipt>,
    pub pending: Option<Proposal>,
    pub committed_transition: Option<Uuid>,
    pub used_transitions: BTreeMap<Uuid, String>,
    pub conflicts: BTreeMap<String, Notification>,
    pub review: Uuid,
    pub review_hash: String,
}
impl Entry {
    pub fn ready(&self) -> Result<()> {
        ensure!(
            self.pending.is_none(),
            "financial_ingress_reconciliation_required"
        );
        ensure!(self.conflicts.is_empty(), "financial_ingress_conflict");
        Ok(())
    }
    pub fn propose(&self, receipt: Receipt) -> Result<Proposal> {
        self.ready()?;
        receipt.validate()?;
        ensure!(
            !self.receipts.contains_key(&receipt.notification.event_id)
                && !self.used_transitions.contains_key(&receipt.transition),
            "financial_ingress_identity_conflict"
        );
        let mut next = self.receipts.clone();
        next.insert(receipt.notification.event_id.clone(), receipt.clone());
        Ok(Proposal {
            expected: self.head.clone(),
            next: Head::inventory(
                &self.scope,
                self.head
                    .revision
                    .checked_add(1)
                    .context("financial_ingress_limit")?,
                &next,
            )?,
            receipt,
        })
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Event {
    Seed {
        scope: Scope,
        receipts: Vec<Receipt>,
        review: Uuid,
        review_hash: String,
    },
    Prepare {
        scope: Scope,
        proposal: Proposal,
    },
    Confirm {
        scope: Scope,
        transition: Uuid,
        head: Head,
    },
    Conflict {
        scope: Scope,
        notification: Notification,
    },
}
impl Event {
    pub fn scope(&self) -> &Scope {
        match self {
            Self::Seed { scope, .. }
            | Self::Prepare { scope, .. }
            | Self::Confirm { scope, .. }
            | Self::Conflict { scope, .. } => scope,
        }
    }
}
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Snapshot {
    pub accounts: BTreeMap<String, Entry>,
}
impl Snapshot {
    pub fn entry(&self, scope: &Scope) -> Result<&Entry> {
        self.accounts
            .get(&scope.key()?)
            .context("financial_ingress_uninitialized")
    }
    pub fn apply(&mut self, event: &Event) -> Result<()> {
        let scope = event.scope();
        let key = scope.key()?;
        if let Event::Seed {
            receipts,
            review,
            review_hash,
            ..
        } = event
        {
            ensure!(
                !self.accounts.contains_key(&key) && !review.is_nil() && hash(review_hash),
                "financial_ingress_seed_not_reviewed"
            );
            let mut map = BTreeMap::new();
            let mut used = BTreeMap::new();
            for receipt in receipts {
                receipt.validate()?;
                ensure!(
                    map.insert(receipt.notification.event_id.clone(), receipt.clone())
                        .is_none()
                        && used
                            .insert(receipt.transition, fingerprint(receipt)?)
                            .is_none(),
                    "financial_ingress_identity_conflict"
                );
            }
            let head = Head::inventory(scope, 1, &map)?;
            self.accounts.insert(
                key,
                Entry {
                    scope: scope.clone(),
                    head,
                    receipts: map,
                    pending: None,
                    committed_transition: None,
                    used_transitions: used,
                    conflicts: BTreeMap::new(),
                    review: *review,
                    review_hash: review_hash.clone(),
                },
            );
            return Ok(());
        }
        let entry = self
            .accounts
            .get_mut(&key)
            .context("financial_ingress_uninitialized")?;
        match event {
            Event::Prepare { proposal, .. } => {
                ensure!(entry.conflicts.is_empty(), "financial_ingress_conflict");
                if entry.pending.as_ref() == Some(proposal) {
                    return Ok(());
                }
                ensure!(
                    entry.propose(proposal.receipt.clone())? == *proposal,
                    "financial_ingress_predecessor_changed"
                );
                entry
                    .used_transitions
                    .insert(proposal.receipt.transition, fingerprint(&proposal.receipt)?);
                entry.pending = Some(proposal.clone());
            }
            Event::Confirm {
                transition, head, ..
            } => {
                ensure!(entry.conflicts.is_empty(), "financial_ingress_conflict");
                if entry.committed_transition == Some(*transition)
                    && &entry.head == head
                    && entry.pending.is_none()
                {
                    return Ok(());
                }
                let p = entry
                    .pending
                    .as_ref()
                    .context("financial_ingress_pending_missing")?;
                ensure!(
                    p.receipt.transition == *transition && &p.next == head,
                    "financial_ingress_confirmation_changed"
                );
                entry
                    .receipts
                    .insert(p.receipt.notification.event_id.clone(), p.receipt.clone());
                entry.head = p.next.clone();
                entry.committed_transition = Some(*transition);
                entry.pending = None;
            }
            Event::Conflict { notification, .. } => {
                notification.validate()?;
                let prior = entry
                    .receipts
                    .get(&notification.event_id)
                    .or_else(|| {
                        entry
                            .pending
                            .as_ref()
                            .map(|p| &p.receipt)
                            .filter(|r| r.notification.event_id == notification.event_id)
                    })
                    .context("financial_ingress_conflict_identity_unknown")?;
                ensure!(
                    prior.notification != *notification,
                    "financial_ingress_conflict_not_different"
                );
                entry
                    .conflicts
                    .insert(fingerprint(notification)?, notification.clone());
            }
            Event::Seed { .. } => unreachable!(),
        }
        Ok(())
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    pub fn fixture() -> (Scope, Snapshot, Receipt) {
        let scope = Scope {
            account: "acct_ingress".into(),
            live: false,
        };
        let mut state = Snapshot::default();
        state
            .apply(&Event::Seed {
                scope: scope.clone(),
                receipts: vec![],
                review: Uuid::now_v7(),
                review_hash: "a".repeat(64),
            })
            .unwrap();
        let receipt = Receipt {
            notification: Notification {
                event_id: "evt_ingress".into(),
                payload_hash: "b".repeat(64),
                kind: "invoice.paid".into(),
                created: micros(Utc::now()).unwrap(),
                customer: Some("cus_ingress".into()),
                subscription: Some("sub_ingress".into()),
                invoice: Some("in_ingress".into()),
                supported: true,
            },
            received_at: micros(Utc::now()).unwrap(),
            requested_revision: Some(1),
            job_before: None,
            transition: Uuid::now_v7(),
        };
        (scope, state, receipt)
    }
    #[test]
    fn ingress_requires_review_exact_transition_and_keeps_conflicting_signed_metadata() {
        let (scope, mut state, receipt) = fixture();
        let p = state
            .entry(&scope)
            .unwrap()
            .propose(receipt.clone())
            .unwrap();
        let event = Event::Prepare {
            scope: scope.clone(),
            proposal: p.clone(),
        };
        state.apply(&event).unwrap();
        state.apply(&event).unwrap();
        assert!(state.entry(&scope).unwrap().ready().is_err());
        let mut wrong = p.next.clone();
        wrong.hash = "c".repeat(64);
        assert!(state
            .apply(&Event::Confirm {
                scope: scope.clone(),
                transition: receipt.transition,
                head: wrong
            })
            .is_err());
        let confirm = Event::Confirm {
            scope: scope.clone(),
            transition: receipt.transition,
            head: p.next,
        };
        state.apply(&confirm).unwrap();
        state.apply(&confirm).unwrap();
        assert_eq!(state.entry(&scope).unwrap().receipts.len(), 1);
        let mut changed = receipt.notification;
        changed.payload_hash = "d".repeat(64);
        state
            .apply(&Event::Conflict {
                scope: scope.clone(),
                notification: changed,
            })
            .unwrap();
        assert!(state.entry(&scope).unwrap().ready().is_err());
        assert_eq!(state.entry(&scope).unwrap().receipts.len(), 1);
        assert!(state
            .apply(&Event::Seed {
                scope,
                receipts: vec![],
                review: Uuid::now_v7(),
                review_hash: "a".repeat(64)
            })
            .is_err());
    }
    #[test]
    fn ingress_receipts_distinguish_scope_job_predecessor_and_ignored_events() {
        let (scope, state, mut receipt) = fixture();
        let before = state
            .entry(&scope)
            .unwrap()
            .propose(receipt.clone())
            .unwrap();
        receipt.job_before = Some(JobBefore {
            requested: 1,
            applied: 1,
        });
        assert!(receipt.validate().is_err());
        receipt.requested_revision = Some(2);
        let after = state
            .entry(&scope)
            .unwrap()
            .propose(receipt.clone())
            .unwrap();
        assert_ne!(before.next.hash, after.next.hash);
        let mut live = scope.clone();
        live.live = true;
        assert!(state.entry(&live).is_err());
        receipt.notification.supported = false;
        receipt.notification.customer = None;
        receipt.notification.subscription = None;
        receipt.notification.invoice = None;
        receipt.notification.kind = "unhandled.event".into();
        receipt.requested_revision = None;
        receipt.job_before = None;
        let ignored = state.entry(&scope).unwrap().propose(receipt).unwrap();
        assert_ne!(after.next.hash, ignored.next.hash);
    }
}

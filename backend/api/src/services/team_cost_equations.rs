//! Private support for every emitted cost/count equation. No numeric cost copy
//! or raw usage content; exact whole-bundle replay or disjoint history only.
use anyhow::{ensure, Result};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

pub const VERSION: &str = "observed_pr_cost_equations_v1";
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Equations {
    pub schema_version: u8,
    pub calculation_version: String,
    pub costs: BTreeMap<String, BTreeSet<String>>,
    pub counts: BTreeMap<String, BTreeMap<String, BTreeSet<Uuid>>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn hash(n: u64) -> String {
        format!("{n:064x}")
    }
    fn fixture() -> Equations {
        Equations {
            schema_version: 1,
            calculation_version: VERSION.into(),
            costs: BTreeMap::from([
                (
                    "weekly_total".into(),
                    [hash(1), hash(2)].into_iter().collect(),
                ),
                (
                    "fully_priced_observed_numerator".into(),
                    [hash(1)].into_iter().collect(),
                ),
            ]),
            counts: BTreeMap::from([(
                "fully_priced_observed_prs".into(),
                BTreeMap::from([(hash(100), (1..=5).map(Uuid::from_u128).collect())]),
            )]),
        }
    }
    #[test]
    fn exact_bundle_or_disjoint_support_only_including_pr_denominator_and_revisions() {
        let a = fixture();
        let facts = [hash(1), hash(2)].into_iter().collect();
        a.validate(&facts).unwrap();
        assert!(a.compatible(&a, true));
        assert!(!a.compatible(&a, false)); // same IDs, revised value/pricing fingerprint
        let mut b = fixture();
        b.costs
            .values_mut()
            .for_each(|s| *s = [hash(3)].into_iter().collect());
        assert!(!b.compatible(&a, false)); // disjoint usage but reused PR count support
        b.counts.values_mut().for_each(|m| {
            let people = m.values().next().unwrap().clone();
            *m = BTreeMap::from([(hash(200), people)]);
        });
        assert!(b.compatible(&a, false));
        assert!(b.validate(&facts).is_err());
        b.schema_version = 2;
        assert!(b.validate(&[hash(3)].into_iter().collect()).is_err());
    }
}
impl Equations {
    pub fn validate(&self, facts: &BTreeSet<String>) -> Result<()> {
        ensure!(
            self.schema_version == 1
                && self.calculation_version == VERSION
                && !self.costs.is_empty()
                && self.costs.len() <= 100_000
                && self.counts.len() <= 3,
            "cost_equation_schema_unconfirmed"
        );
        for (name, membership) in &self.costs {
            ensure!(
                !name.is_empty()
                    && name.len() <= 128
                    && !membership.is_empty()
                    && membership.is_subset(facts)
                    && membership
                        .iter()
                        .all(|f| super::team_financial_recovery::digest(f)),
                "cost_equation_membership_unconfirmed"
            );
        }
        for (name, prs) in &self.counts {
            ensure!(
                matches!(
                    name.as_str(),
                    "fully_priced_observed_prs"
                        | "merged_prs_with_cost"
                        | "merged_prs_without_cost"
                ),
                "cost_equation_count_unconfirmed"
            );
            ensure!(
                prs.len() <= 100_000
                    && prs
                        .iter()
                        .all(|(id, people)| super::team_financial_recovery::digest(id)
                            && !people.is_empty()
                            && !people.contains(&Uuid::nil())),
                "cost_equation_count_support_unconfirmed"
            );
        }
        Ok(())
    }
    pub fn compatible(&self, old: &Self, same_fingerprint: bool) -> bool {
        if same_fingerprint && self == old {
            return true;
        }
        let cost_disjoint = self
            .costs
            .values()
            .all(|new| old.costs.values().all(|previous| new.is_disjoint(previous)));
        let pr_disjoint = self.counts.values().all(|new| {
            old.counts
                .values()
                .all(|previous| new.keys().all(|id| !previous.contains_key(id)))
        });
        cost_disjoint && pr_disjoint
    }
}

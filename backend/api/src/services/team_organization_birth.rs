//! Minimal independent proof of a new nonpersonal workspace. This creates no
//! trial, enrollment, consent, rollout, payment or analytics permission.
use anyhow::{ensure, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const FLAG: &str = "ATOAXIS_TEAM_ORGANIZATION_ONBOARDING_ENABLED";
pub fn enabled() -> Result<bool> {
    match std::env::var(FLAG) {
        Err(std::env::VarError::NotPresent) => Ok(false),
        Ok(value) if value == "true" || value == "1" => Ok(true),
        Ok(value) if value == "false" || value == "0" => Ok(false),
        _ => anyhow::bail!("onboarding_configuration_invalid"),
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OrganizationBirth {
    pub schema: u8,
    pub namespace: Uuid,
    pub organization: Uuid,
    pub creator: Uuid,
    pub intent: Uuid,
    pub creation: Uuid,
    pub audit: Uuid,
    pub created_at: DateTime<Utc>,
    pub request_hash: String,
}
impl OrganizationBirth {
    pub fn reserved_ids(&self) -> [Uuid; 4] {
        [self.organization, self.intent, self.creation, self.audit]
    }
    pub fn validate(&self) -> Result<()> {
        let ids = self.reserved_ids();
        let unique = ids.into_iter().collect::<std::collections::BTreeSet<_>>();
        ensure!(
            self.schema == 1
                && !self.namespace.is_nil()
                && !self.creator.is_nil()
                && unique.len() == 4
                && !unique.contains(&Uuid::nil())
                && !unique.contains(&self.namespace)
                && !unique.contains(&self.creator)
                && self.created_at.timestamp_subsec_nanos() % 1000 == 0
                && self.request_hash.len() == 64
                && self
                    .request_hash
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
            "onboarding_birth_metadata_invalid"
        );
        Ok(())
    }
    pub fn digest(&self) -> Result<String> {
        self.validate()?;
        super::team_financial_guard::fingerprint(self)
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BirthEntry {
    pub birth: OrganizationBirth,
    pub confirmed: bool,
    #[serde(default, skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    pub confirmations: std::collections::BTreeMap<Uuid, BirthConfirmation>,
}

/// Minimal current-Owner approval of existing committed birth evidence. This is
/// not a creation/trial command and never reconstructs missing SQL rows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BirthConfirmation {
    pub schema: u8,
    pub id: Uuid,
    pub organization: Uuid,
    pub creation: Uuid,
    pub actor: Uuid,
    pub birth_digest: String,
    pub observation: String,
    pub requested_at: DateTime<Utc>,
}
impl BirthConfirmation {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.schema == 1
                && !self.id.is_nil()
                && !self.organization.is_nil()
                && !self.creation.is_nil()
                && !self.actor.is_nil()
                && ![self.organization, self.creation, self.actor].contains(&self.id)
                && self.requested_at.timestamp_subsec_nanos() % 1000 == 0
                && [&self.birth_digest, &self.observation]
                    .iter()
                    .all(|h| h.len() == 64
                        && h.bytes()
                            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))),
            "onboarding_confirmation_invalid"
        );
        Ok(())
    }
    pub fn digest(&self) -> Result<String> {
        self.validate()?;
        super::team_financial_guard::fingerprint(self)
    }
}

//! Normalized original preview and provider bodies. This module makes no HTTP
//! call and supplies no Owner/source/dispatch authority or durable-acceptance ACK.
use super::*;
use crate::services::{
    team_financial_guard::fingerprint, team_financial_source::Scope, team_stripe::id,
};

pub const FLAG: &str = "ATOAXIS_TEAM_SUBSCRIPTION_CHANGES_ENABLED";
pub fn require_enabled() -> Result<()> {
    match std::env::var(FLAG) {
        Ok(value) if value == "1" || value == "true" => Ok(()),
        Err(std::env::VarError::NotPresent) => {
            Err(crate::services::team_insights::TeamError::Disabled.into())
        }
        Ok(value) if value == "0" || value == "false" => {
            Err(crate::services::team_insights::TeamError::Disabled.into())
        }
        _ => anyhow::bail!("subscription_change_flag_invalid"),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PreviewRequest {
    pub schema: u8,
    pub quote_id: Uuid,
    pub scope: Scope,
    pub actor: Uuid,
    pub customer: String,
    pub subscription: String,
    pub item: String,
    pub from_price: String,
    pub to_price: String,
    pub from_seats: i32,
    pub to_seats: i32,
    pub currency: String,
    pub to_amount_minor: i64,
    pub binding_revision: i64,
    pub source_revision: i64,
    pub catalog_revision: u64,
    pub catalog_sha256: String,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub proration_at: DateTime<Utc>,
    pub requested_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PreviewSelection {
    pub quote_id: Uuid,
    pub package_seats: i32,
    pub expected_binding_revision: i64,
    pub expected_source_revision: i64,
    pub expected_period_end: DateTime<Utc>,
}
impl PreviewSelection {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            !self.quote_id.is_nil()
                && PACKAGES.iter().any(|n| i32::from(*n) == self.package_seats)
                && self.expected_binding_revision > 0
                && self.expected_source_revision > 0
                && self.expected_period_end.timestamp_subsec_nanos() % 1000 == 0,
            crate::services::team_insights::TeamError::Invalid(
                "current package revisions and billing boundary required"
            )
        );
        Ok(())
    }
}
impl PreviewRequest {
    pub fn matches_selection(&self, input: &PreviewSelection) -> Result<()> {
        input.validate()?;
        self.validate()?;
        ensure!(
            self.quote_id == input.quote_id
                && self.to_seats == input.package_seats
                && self.binding_revision == input.expected_binding_revision
                && self.source_revision == input.expected_source_revision
                && self.period_end == input.expected_period_end,
            crate::services::team_insights::TeamError::ProjectionChanged
        );
        Ok(())
    }
}
impl PreviewRequest {
    pub fn validate(&self) -> Result<()> {
        self.scope.key()?;
        ensure!(
            self.schema == 1
                && !self.quote_id.is_nil()
                && !self.actor.is_nil()
                && id(&self.customer, "cus_")
                && id(&self.subscription, "sub_")
                && id(&self.item, "si_")
                && id(&self.from_price, "price_")
                && id(&self.to_price, "price_")
                && self.from_price != self.to_price
                && self.to_seats > self.from_seats
                && PACKAGES.iter().any(|n| i32::from(*n) == self.from_seats)
                && PACKAGES.iter().any(|n| i32::from(*n) == self.to_seats)
                && self.currency.len() == 3
                && self.currency.bytes().all(|c| c.is_ascii_lowercase())
                && self.to_amount_minor >= 0
                && self.binding_revision > 0
                && self.source_revision > 0
                && self.catalog_revision > 0
                && self.catalog_sha256.len() == 64
                && self
                    .catalog_sha256
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
                && self.period_start <= self.proration_at
                && self.proration_at < self.period_end
                && self.proration_at.timestamp_subsec_nanos() == 0
                && self.proration_at.timestamp() == self.requested_at.timestamp()
                && self.requested_at.timestamp_subsec_nanos() % 1000 == 0
                && self.expires_at.timestamp_subsec_nanos() % 1000 == 0
                && self.requested_at < self.expires_at
                && self.expires_at
                    == self
                        .requested_at
                        .checked_add_signed(Duration::minutes(10))
                        .context("upgrade_preview_time_invalid")?
                        .min(self.period_end),
            "upgrade_preview_request_invalid"
        );
        Ok(())
    }
    pub fn metadata_hash(&self) -> Result<String> {
        self.validate()?;
        fingerprint(self)
    }
    pub fn accepted_request(
        &self,
    ) -> Result<crate::services::team_financial_source::AcceptedRequest> {
        self.validate()?;
        Ok(crate::services::team_financial_source::AcceptedRequest {
            operation: self.quote_id,
            kind: crate::services::team_financial_source::OperationKind::PreviewUpgrade,
            actor: self.actor,
            request_hash: fingerprint(&(self, self.provider_body()?, self.idempotency_key()?))?,
            idempotency_hash: fingerprint(&self.idempotency_key()?)?,
            accepted_at: self.requested_at,
        })
    }
    pub fn idempotency_key(&self) -> Result<String> {
        self.validate()?;
        Ok(format!(
            "atoaxis-upgrade-preview-{}-{}",
            self.scope.key()?,
            self.quote_id
        ))
    }
    pub fn provider_body(&self) -> Result<Vec<(String, String)>> {
        self.validate()?;
        Ok(vec![
            ("customer".into(), self.customer.clone()),
            ("subscription".into(), self.subscription.clone()),
            (
                "subscription_details[items][0][id]".into(),
                self.item.clone(),
            ),
            (
                "subscription_details[items][0][price]".into(),
                self.to_price.clone(),
            ),
            (
                "subscription_details[items][0][quantity]".into(),
                "1".into(),
            ),
            (
                "subscription_details[proration_behavior]".into(),
                "always_invoice".into(),
            ),
            (
                "subscription_details[proration_date]".into(),
                self.proration_at.timestamp().to_string(),
            ),
        ])
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpgradePreview {
    pub request: PreviewRequest,
    pub preview_id: String,
    pub totals: InvoiceTotals,
    pub lines: Vec<InvoiceLine>,
    pub lines_complete: bool,
    pub observed_at: DateTime<Utc>,
}
fn identity(value: &Value, prefix: &str) -> Result<String> {
    let id_value = value
        .as_str()
        .or_else(|| value.get("id").and_then(Value::as_str))
        .context("upgrade_preview_identity_missing")?;
    ensure!(id(id_value, prefix), "upgrade_preview_identity_invalid");
    Ok(id_value.into())
}
impl UpgradePreview {
    pub fn validate(&self) -> Result<()> {
        self.request.validate()?;
        ensure!(
            id(&self.preview_id, "upcoming_in_") && self.lines.len() <= 1000,
            "upgrade_preview_metadata_invalid"
        );
        let mut ids = std::collections::BTreeSet::new();
        for line in &self.lines {
            ensure!(
                id(&line.id, "il_")
                    && ids.insert(&line.id)
                    && line.currency.len() == 3
                    && line.currency.bytes().all(|c| c.is_ascii_lowercase())
                    && line.price_id.as_ref().is_none_or(|v| id(v, "price_"))
                    && line.subscription_id.as_ref().is_none_or(|v| id(v, "sub_"))
                    && line
                        .subscription_item_id
                        .as_ref()
                        .is_none_or(|v| id(v, "si_"))
                    && line.quantity.is_none_or(|q| q >= 0)
                    && line
                        .period_start
                        .zip(line.period_end)
                        .is_none_or(|(start, end)| start <= end),
                "upgrade_preview_line_metadata_invalid"
            );
        }
        Ok(())
    }
    /// Keep only allowlisted metadata. Missing monetary values or incomplete
    /// lines remain recorded but cannot be converted into accepted terms.
    pub fn parse(request: PreviewRequest, raw: &Value, observed_at: DateTime<Utc>) -> Result<Self> {
        request.validate()?;
        ensure!(
            raw["object"] == "invoice"
                && raw["livemode"].as_bool() == Some(request.scope.live)
                && identity(&raw["customer"], "cus_")? == request.customer
                && raw["currency"].as_str() == Some(request.currency.as_str()),
            "upgrade_preview_scope_mismatch"
        );
        let preview_id = identity(&raw["id"], "upcoming_in_")?;
        let legacy = raw
            .get("subscription")
            .filter(|v| !v.is_null())
            .map(|v| identity(v, "sub_"))
            .transpose()?;
        let parent = raw["parent"]["subscription_details"]
            .get("subscription")
            .filter(|v| !v.is_null())
            .map(|v| identity(v, "sub_"))
            .transpose()?;
        ensure!(
            legacy
                .as_ref()
                .zip(parent.as_ref())
                .is_none_or(|(a, b)| a == b)
                && parent.or(legacy).as_deref() == Some(request.subscription.as_str()),
            "upgrade_preview_subscription_unconfirmed"
        );
        let data = raw["lines"]["data"]
            .as_array()
            .context("upgrade_preview_lines_missing")?;
        ensure!(data.len() <= 1000, "upgrade_preview_line_limit");
        let mut ids = std::collections::BTreeSet::new();
        let mut lines = Vec::new();
        for raw_line in data {
            if let Some(parent) = raw_line.get("invoice").filter(|v| !v.is_null()) {
                ensure!(
                    identity(parent, "upcoming_in_")? == preview_id,
                    "upgrade_preview_line_parent_mismatch"
                );
            }
            let line = team_stripe_invoice::line(raw_line, request.scope.live)?;
            ensure!(
                ids.insert(line.id.clone()),
                "upgrade_preview_duplicate_line_identity"
            );
            lines.push(line);
        }
        let result = Self {
            request,
            preview_id,
            totals: InvoiceTotals::parse(raw)?,
            lines,
            lines_complete: raw["lines"]["has_more"].as_bool() == Some(false),
            observed_at,
        };
        result.validate()?;
        Ok(result)
    }
    /// Produces validated metadata only. A runtime receiver must still persist
    /// the immutable quote and a current Owner's exact amount/revision acceptance
    /// using the financial transaction protocol before treating it as accepted.
    pub fn proposed_upgrade(
        &self,
        operation: Uuid,
        accepted_at: DateTime<Utc>,
    ) -> Result<AcceptedUpgrade> {
        self.validate()?;
        ensure!(
            !operation.is_nil()
                && operation != self.request.quote_id
                && self.lines_complete
                && self.observed_at >= self.request.requested_at
                && self.observed_at <= accepted_at
                && accepted_at < self.request.expires_at
                && self.totals.complete(),
            "upgrade_preview_incomplete_or_expired"
        );
        let request = &self.request;
        let mut lines = Vec::new();
        for line in &self.lines {
            ensure!(
                line.proration == Some(true)
                    && line.subscription_id.as_deref() == Some(request.subscription.as_str()),
                "upgrade_preview_proration_unconfirmed"
            );
            lines.push(ProrationLine {
                price: line
                    .price_id
                    .clone()
                    .context("upgrade_preview_price_unconfirmed")?,
                item: line
                    .subscription_item_id
                    .clone()
                    .context("upgrade_preview_item_unconfirmed")?,
                currency: line.currency.clone(),
                amount_minor: line
                    .amount_minor
                    .context("upgrade_preview_amount_unconfirmed")?,
                quantity: line
                    .quantity
                    .context("upgrade_preview_quantity_unconfirmed")?,
                start: line
                    .period_start
                    .context("upgrade_preview_period_unconfirmed")?,
                end: line
                    .period_end
                    .context("upgrade_preview_period_unconfirmed")?,
            });
        }
        let value = AcceptedUpgrade {
            operation,
            scope: request.scope.clone(),
            customer: request.customer.clone(),
            subscription: request.subscription.clone(),
            item: request.item.clone(),
            from_price: request.from_price.clone(),
            to_price: request.to_price.clone(),
            from_seats: request.from_seats,
            to_seats: request.to_seats,
            currency: request.currency.clone(),
            to_amount_minor: request.to_amount_minor,
            period_start: request.period_start,
            period_end: request.period_end,
            proration_at: request.proration_at,
            accepted_at,
            accepted_totals: self.totals.clone(),
            accepted_lines: lines,
        };
        value.validate()?;
        Ok(value)
    }
}
impl AcceptedUpgrade {
    pub fn idempotency_key(&self) -> Result<String> {
        self.validate()?;
        Ok(format!(
            "atoaxis-upgrade-{}-{}",
            self.scope.key()?,
            self.operation
        ))
    }
    pub fn provider_body(&self) -> Result<Vec<(String, String)>> {
        self.validate()?;
        Ok(vec![
            ("items[0][id]".into(), self.item.clone()),
            ("items[0][price]".into(), self.to_price.clone()),
            ("items[0][quantity]".into(), "1".into()),
            (
                "proration_date".into(),
                self.proration_at.timestamp().to_string(),
            ),
            ("proration_behavior".into(), "always_invoice".into()),
            ("payment_behavior".into(), "pending_if_incomplete".into()),
        ])
    }
    pub fn request_hash(&self) -> Result<String> {
        fingerprint(&(self, &self.provider_body()?, &self.idempotency_key()?))
    }
}

#[cfg(test)]
#[path = "team_stripe_change_preview_tests.rs"]
pub(crate) mod tests;

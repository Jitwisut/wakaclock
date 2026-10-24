//! Canonical metadata hashing, not a source authorization capability.
use super::{team_financial_guard::fingerprint, team_financial_source::Scope};
use anyhow::{ensure, Result};
use chrono::DateTime;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub(crate) const MAX_RECORDS: usize = 50_000;
pub(crate) const MAX_BYTES: usize = 16 * 1024 * 1024;
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InventoryDigest {
    pub schema: u8,
    pub records: u64,
    pub hash: String,
}
pub(crate) struct Records {
    hashes: BTreeMap<String, String>,
    pub counts: BTreeMap<String, usize>,
    bytes: usize,
}
impl Records {
    pub fn new() -> Self {
        Self {
            hashes: BTreeMap::new(),
            counts: BTreeMap::new(),
            bytes: 0,
        }
    }
    pub fn insert(&mut self, tag: &str, id: &str, metadata: Value) -> Result<()> {
        ensure!(
            matches!(
                tag,
                "customer"
                    | "customer_authorization"
                    | "quote"
                    | "checkout"
                    | "checkout_authorization"
                    | "binding"
                    | "snapshot"
                    | "inbox"
                    | "reconciliation"
                    | "deletion_marker"
            ),
            "financial_inventory_kind_unsupported"
        );
        ensure!(
            !id.is_empty() && id.len() <= 256,
            "financial_inventory_identity_invalid"
        );
        ensure!(self.hashes.len() < MAX_RECORDS, "financial_inventory_limit");
        let metadata = canonical(metadata)?;
        let size = serde_json::to_vec(&metadata)?.len();
        ensure!(
            size <= 1024 * 1024 && self.bytes.checked_add(size).is_some_and(|n| n <= MAX_BYTES),
            "financial_inventory_limit"
        );
        let key = fingerprint(&(tag, id))?;
        ensure!(
            !self.hashes.contains_key(&key),
            "financial_inventory_duplicate_identity"
        );
        self.hashes.insert(key, fingerprint(&metadata)?);
        *self.counts.entry(tag.to_owned()).or_default() += 1;
        self.bytes += size;
        Ok(())
    }
    pub fn finish(&self, scope: &Scope) -> Result<InventoryDigest> {
        scope.key()?;
        Ok(InventoryDigest {
            schema: 1,
            records: self.hashes.len() as u64,
            hash: fingerprint(&(1_u8, scope, &self.hashes))?,
        })
    }
}
fn canonical(value: Value) -> Result<Value> {
    Ok(match value {
        Value::Object(values) => {
            let sorted = values
                .into_iter()
                .map(|(k, v)| Ok((k, canonical(v)?)))
                .collect::<Result<BTreeMap<_, _>>>()?;
            Value::Object(sorted.into_iter().collect())
        }
        Value::Array(values) => {
            Value::Array(values.into_iter().map(canonical).collect::<Result<_>>()?)
        }
        Value::Number(ref number) => {
            ensure!(
                number.is_i64() || number.is_u64(),
                "financial_inventory_non_integer_number"
            );
            value
        }
        _ => value,
    })
}
fn same_shape(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(k, v)| b.get(k).is_some_and(|n| same_shape(v, n)))
        }
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same_shape(a, b))
        }
        (Value::Null, Value::Null)
        | (Value::Bool(_), Value::Bool(_))
        | (Value::Number(_), Value::Number(_))
        | (Value::String(_), Value::String(_)) => true,
        _ => false,
    }
}
pub(crate) fn typed_json<T: DeserializeOwned + Serialize>(value: &Value) -> Result<Value> {
    let parsed: T = serde_json::from_value(value.clone())
        .map_err(|_| anyhow::anyhow!("financial_inventory_json_contract_unsupported"))?;
    let mut normalized = serde_json::to_value(parsed)?;
    ensure!(
        same_shape(value, &normalized),
        "financial_inventory_json_contract_unsupported"
    );
    timestamps(&mut normalized)?;
    canonical(normalized)
}
fn timestamps(value: &mut Value) -> Result<()> {
    match value {
        Value::Object(map) => {
            for (key, value) in map.iter_mut() {
                if matches!(
                    key.as_str(),
                    "observed_at"
                        | "paid_at"
                        | "finalized_at"
                        | "due_at"
                        | "period_start"
                        | "period_end"
                        | "covered_until"
                        | "valid_until"
                ) && !value.is_null()
                {
                    let time = value
                        .as_str()
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                        .ok_or_else(|| anyhow::anyhow!("financial_inventory_timestamp_invalid"))?;
                    // JSONB preserves chrono's sub-microsecond precision. Do not
                    // collapse distinct validity/observation times into one root.
                    *value = serde_json::json!([time.timestamp(), time.timestamp_subsec_nanos()]);
                } else {
                    timestamps(value)?;
                }
            }
        }
        Value::Array(values) => {
            for value in values {
                timestamps(value)?;
            }
        }
        _ => (),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use serde_json::json;
    #[test]
    fn canonical_records_are_scoped_typed_bounded_and_never_overwrite_duplicates() {
        let scope = Scope {
            organization: uuid::Uuid::now_v7(),
            account: "acct_fixture".into(),
            live: false,
        };
        let mut records = Records::new();
        assert_eq!(
            records.finish(&scope).unwrap().hash,
            super::super::team_financial_source::Root::empty(&scope)
                .unwrap()
                .hash
        );
        records
            .insert(
                "customer",
                "same",
                json!({"nullable":null,"integer":9007199254740993_i64,"flag":true}),
            )
            .unwrap();
        let before = records.finish(&scope).unwrap();
        assert!(records
            .insert("customer", "same", json!({"other":true}))
            .is_err());
        assert_eq!(before, records.finish(&scope).unwrap());
        records
            .insert("checkout", "same", json!({"flag":true}))
            .unwrap();
        assert_eq!(records.finish(&scope).unwrap().records, 2);
        assert!(records.insert("raw_payload", "x", json!({})).is_err());
        assert!(records
            .insert("customer", "float", json!({"amount":1.5}))
            .is_err());
        assert!(records
            .insert("customer", "oversized", json!({"x":"x".repeat(1024*1024)}))
            .is_err());
        let mut other = scope.clone();
        other.live = true;
        assert_ne!(
            records.finish(&scope).unwrap().hash,
            records.finish(&other).unwrap().hash
        );
    }
    #[test]
    fn stored_json_never_discards_unknown_keys_or_invents_missing_defaults() {
        let (_, invoice, _) = super::super::team_stripe_payment::tests::fixture(Utc::now());
        let raw = serde_json::to_value(invoice).unwrap();
        let mut bad = raw.clone();
        bad["prompt"] = json!("forbidden_fixture_marker");
        assert!(typed_json::<super::super::team_stripe_invoice::Invoice>(&bad).is_err());
        let original = typed_json::<super::super::team_stripe_invoice::Invoice>(&raw).unwrap();
        let mut offset = raw.clone();
        let at = DateTime::parse_from_rfc3339(raw["observed_at"].as_str().unwrap()).unwrap();
        offset["observed_at"] = json!(at
            .with_timezone(&chrono::FixedOffset::east_opt(7 * 3600).unwrap())
            .to_rfc3339());
        assert_eq!(
            original,
            typed_json::<super::super::team_stripe_invoice::Invoice>(&offset).unwrap()
        );
        let mut fine = offset.clone();
        fine["observed_at"] = json!("2026-10-23T00:00:00.123456001Z");
        let first = typed_json::<super::super::team_stripe_invoice::Invoice>(&fine).unwrap();
        fine["observed_at"] = json!("2026-10-23T00:00:00.123456999Z");
        assert_ne!(
            first,
            typed_json::<super::super::team_stripe_invoice::Invoice>(&fine).unwrap()
        );
        let mut missing = raw;
        missing.as_object_mut().unwrap().remove("paid_at");
        assert!(typed_json::<super::super::team_stripe_invoice::Invoice>(&missing).is_err());
    }
}

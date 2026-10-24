//! Owner-configured package prices. This contract never invents prices or opens checkout.
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, io::Read};

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Package {
    pub seats: u16,
    pub price_id: String,
    pub product_id: String,
    pub amount_minor: i64,
    pub tax_behavior: String,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    schema_version: u16,
    revision: u64,
    owner_approved: bool,
    account_id: String,
    livemode: bool,
    currency: String,
    packages: Vec<Package>,
}
#[derive(Serialize)]
pub struct VerifiedOffer {
    pub package: Package,
    pub currency: String,
    pub catalog_revision: u64,
    pub catalog_sha256: String,
    pub observed_at: DateTime<Utc>,
    pub interval: &'static str,
    pub quantity: u16,
    pub checkout_available: bool,
}
impl Catalog {
    pub fn from_env(account: &str, live: bool) -> Result<Option<Self>> {
        let path = match std::env::var("ATOAXIS_STRIPE_PRICE_CATALOG_PATH") {
            Ok(p) => p,
            Err(std::env::VarError::NotPresent) => return Ok(None),
            Err(_) => anyhow::bail!("price catalog path unavailable"),
        };
        let mut bytes = Vec::new();
        std::fs::File::open(path)
            .context("price catalog unavailable")?
            .take(65_537)
            .read_to_end(&mut bytes)
            .context("price catalog unreadable")?;
        Self::parse(&bytes, account, live).map(Some)
    }
    pub fn parse(bytes: &[u8], account: &str, live: bool) -> Result<Self> {
        ensure!(bytes.len() <= 65_536, "price catalog too large");
        let mut c: Self = serde_json::from_slice(bytes)
            .map_err(|_| anyhow::anyhow!("price catalog schema invalid"))?;
        ensure!(
            c.schema_version == 1 && c.revision > 0 && c.owner_approved,
            "price catalog approval unavailable"
        );
        ensure!(
            super::team_stripe::id(account, "acct_")
                && c.account_id == account
                && c.livemode == live,
            "price catalog scope mismatch"
        );
        ensure!(
            c.currency.len() == 3 && c.currency.bytes().all(|b| b.is_ascii_lowercase()),
            "price catalog currency invalid"
        );
        ensure!(
            c.packages.len() == super::team_billing::PACKAGES.len(),
            "price catalog packages incomplete"
        );
        c.packages.sort_by_key(|p| p.seats);
        let mut seats = BTreeSet::new();
        let mut prices = BTreeSet::new();
        for p in &c.packages {
            ensure!(
                super::team_billing::PACKAGES.contains(&p.seats) && seats.insert(p.seats),
                "price catalog package conflict"
            );
            ensure!(
                super::team_stripe::id(&p.price_id, "price_")
                    && prices.insert(&p.price_id)
                    && super::team_stripe::id(&p.product_id, "prod_"),
                "price catalog identity conflict"
            );
            ensure!(
                p.amount_minor >= 0
                    && ["inclusive", "exclusive", "unspecified"].contains(&p.tax_behavior.as_str()),
                "price catalog terms invalid"
            );
        }
        Ok(c)
    }
    pub fn digest(&self) -> Result<String> {
        Ok(format!("{:x}", Sha256::digest(serde_json::to_vec(self)?)))
    }
    pub fn package(&self, seats: u16) -> Result<&Package> {
        self.packages
            .iter()
            .find(|p| p.seats == seats)
            .context("package not configured")
    }
    pub fn matches_scope(&self, account: &str, live: bool) -> bool {
        self.account_id == account && self.livemode == live
    }
    pub fn verify(&self, seats: u16, v: &Value, at: DateTime<Utc>) -> Result<VerifiedOffer> {
        let p = self.package(seats)?;
        ensure!(
            v["object"] == "price"
                && v["id"].as_str() == Some(&p.price_id)
                && v["active"] == true
                && v["livemode"].as_bool() == Some(self.livemode),
            "provider price identity mismatch"
        );
        ensure!(
            v["currency"].as_str() == Some(&self.currency)
                && v["unit_amount"].as_i64() == Some(p.amount_minor)
                && v["tax_behavior"].as_str() == Some(&p.tax_behavior),
            "provider price terms changed"
        );
        ensure!(
            v["type"] == "recurring"
                && v["billing_scheme"] == "per_unit"
                && v["recurring"]["interval"] == "month"
                && v["recurring"]["interval_count"] == 1
                && v["recurring"]["usage_type"] == "licensed",
            "provider package cadence unsupported"
        );
        ensure!(
            v["custom_unit_amount"].is_null()
                && v["transform_quantity"].is_null()
                && v["tiers_mode"].is_null(),
            "provider package amount is variable"
        );
        if !v["unit_amount_decimal"].is_null() {
            ensure!(
                v["unit_amount_decimal"]
                    .as_str()
                    .is_some_and(|s| exact_minor(s, p.amount_minor)),
                "provider fractional amount mismatch"
            );
        }
        ensure!(
            v["product"]["object"] == "product"
                && v["product"]["id"].as_str() == Some(&p.product_id)
                && v["product"]["active"] == true
                && v["product"]["livemode"].as_bool() == Some(self.livemode),
            "provider product unconfirmed"
        );
        let digest = self.digest()?;
        Ok(VerifiedOffer {
            package: p.clone(),
            currency: self.currency.clone(),
            catalog_revision: self.revision,
            catalog_sha256: digest,
            observed_at: at,
            interval: "month",
            quantity: 1,
            checkout_available: false,
        })
    }
}
fn exact_minor(raw: &str, expected: i64) -> bool {
    if raw.len() > 32 {
        return false;
    }
    let (whole, fraction) = raw.split_once('.').unwrap_or((raw, ""));
    !whole.is_empty()
        && whole.bytes().all(|b| b.is_ascii_digit())
        && whole.parse::<i64>().ok() == Some(expected)
        && fraction.len() <= 12
        && fraction.bytes().all(|b| b == b'0')
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn config() -> Value {
        let packages=[10,25,50,100].map(|seats|json!({"seats":seats,"price_id":format!("price_{seats}"),"product_id":"prod_fixture","amount_minor":2500,"tax_behavior":"exclusive"}));
        json!({"schema_version":1,"revision":1,"owner_approved":true,"account_id":"acct_fixture","livemode":false,"currency":"usd","packages":packages})
    }
    fn price() -> Value {
        json!({"id":"price_10","object":"price","active":true,"livemode":false,"currency":"usd","unit_amount":2500,"unit_amount_decimal":"2500.000","tax_behavior":"exclusive","type":"recurring","billing_scheme":"per_unit","recurring":{"interval":"month","interval_count":1,"usage_type":"licensed"},"product":{"id":"prod_fixture","object":"product","active":true,"livemode":false,"name":"PRIVATE_FIXTURE"},"metadata":{"private":"PRIVATE_FIXTURE"}})
    }
    #[test]
    fn catalog_requires_approval_complete_packages_and_scope() {
        let v = config();
        let bytes = serde_json::to_vec(&v).unwrap();
        assert!(Catalog::parse(&bytes, "acct_fixture", false).is_ok());
        assert!(Catalog::parse(&bytes, "acct_other", false).is_err());
        assert!(Catalog::parse(&bytes, "acct_fixture", true).is_err());
        for edit in [
            json!({"owner_approved":false}),
            json!({"revision":0}),
            json!({"schema_version":2}),
            json!({"secret":"PRIVATE_FIXTURE"}),
            json!({"packages":[]}),
        ] {
            let mut bad = v.clone();
            for (k, value) in edit.as_object().unwrap() {
                bad[k] = value.clone();
            }
            assert!(
                Catalog::parse(&serde_json::to_vec(&bad).unwrap(), "acct_fixture", false).is_err()
            );
        }
        let mut bad = v.clone();
        bad["packages"][1]["price_id"] = json!("price_10");
        assert!(Catalog::parse(&serde_json::to_vec(&bad).unwrap(), "acct_fixture", false).is_err());
    }
    #[test]
    fn provider_price_must_match_owner_terms_without_float_or_pii() {
        let c = Catalog::parse(
            &serde_json::to_vec(&config()).unwrap(),
            "acct_fixture",
            false,
        )
        .unwrap();
        let v = price();
        let offer = c.verify(10, &v, Utc::now()).unwrap();
        assert_eq!(offer.quantity, 1);
        assert_eq!(offer.package.seats, 10);
        assert!(!offer.checkout_available);
        assert!(!serde_json::to_string(&offer)
            .unwrap()
            .contains("PRIVATE_FIXTURE"));
        for (field, value) in [
            ("active", json!(false)),
            ("livemode", json!(true)),
            ("currency", json!("eur")),
            ("unit_amount", Value::Null),
            ("unit_amount_decimal", json!("2500.1")),
            ("billing_scheme", json!("tiered")),
            ("custom_unit_amount", json!({})),
            ("transform_quantity", json!({"divide_by":10})),
            ("product", json!("prod_fixture")),
            ("tax_behavior", json!("inclusive")),
        ] {
            let mut bad = v.clone();
            bad[field] = value;
            assert!(c.verify(10, &bad, Utc::now()).is_err(), "{field}");
        }
        let mut bad = v;
        bad["recurring"]["interval"] = json!("year");
        assert!(c.verify(10, &bad, Utc::now()).is_err());
        assert!(c.package(11).is_err());
    }
    #[test]
    fn digest_is_order_independent_but_changes_with_terms() {
        let a = config();
        let c = Catalog::parse(&serde_json::to_vec(&a).unwrap(), "acct_fixture", false).unwrap();
        let at = Utc::now();
        let digest = c.verify(10, &price(), at).unwrap().catalog_sha256;
        let mut b = a.clone();
        b["packages"].as_array_mut().unwrap().reverse();
        assert_eq!(
            Catalog::parse(&serde_json::to_vec(&b).unwrap(), "acct_fixture", false)
                .unwrap()
                .verify(10, &price(), at)
                .unwrap()
                .catalog_sha256,
            digest
        );
        b["revision"] = json!(2);
        assert_ne!(
            Catalog::parse(&serde_json::to_vec(&b).unwrap(), "acct_fixture", false)
                .unwrap()
                .verify(10, &price(), at)
                .unwrap()
                .catalog_sha256,
            digest
        );
        assert!(!exact_minor("2500e0", 2500));
        assert!(!exact_minor("+2500", 2500));
        assert!(!exact_minor("2500.0000000000000", 2500));
    }
}

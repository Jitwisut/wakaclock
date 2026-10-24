//! Consistent, read-only SQL inventory. This is deliberately NOT an admission,
//! dispatch or restore authorization proof. Shared account ingress is unconfirmed.
use crate::{
    infrastructure::{postgres::PostgresClient, team_financial_guard::FinancialGuard},
    services::{
        team_financial_guard::fingerprint,
        team_financial_inventory::{typed_json, InventoryDigest, Records, MAX_BYTES, MAX_RECORDS},
        team_financial_source::{ProviderIdentity, Root, Scope},
        team_stripe_checkout::{ExpectedSession, FrozenRequest},
        team_stripe_invoice::Invoice,
        team_stripe_payment::Assessment,
    },
};
use anyhow::{ensure, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use uuid::Uuid;

/// No Serialize and no conversion into any product authorization capability.
pub struct Preview {
    pub digest: InventoryDigest,
    pub counts: BTreeMap<String, usize>,
    pub checkpoint: Option<Root>,
    pub checkpoint_matches: bool,
    pub identity_conflict: bool,
    pub account_unbound_records: bool,
    pub legacy_scope_unconfirmed: bool,
    pub independent_source_matches: bool,
}
impl Preview {
    /// Counts/booleans only. No financial payload, provider identity or root hash.
    pub fn diagnostic(&self) -> Value {
        json!({"scope":"read_only_inventory_preview", "schema":self.digest.schema,
            "records":self.digest.records, "counts":self.counts,
            "checkpoint":if self.checkpoint.is_none(){"uninitialized"}else if self.checkpoint_matches{"matches_sql_observation"}else{"mismatch"},
            "identity_conflict":self.identity_conflict,
            "account_unbound_records":self.account_unbound_records,
            "legacy_scope_unconfirmed":self.legacy_scope_unconfirmed,
            "independent_source_matches":self.independent_source_matches,
            "account_ingress_proof":"unconfirmed", "writer_fencing":"not_integrated",
            "financial_sources":"unconfirmed", "product_authorization_enabled":false,
            "production_ready":false})
    }
}

#[derive(Serialize)]
struct Identity {
    organization: Uuid,
    customer: String,
    subscription: Option<String>,
}
fn observations(
    state: &crate::infrastructure::team_financial_guard::Read,
    scope: &Scope,
) -> Result<(Value, String)> {
    let entries: Vec<_> = state
        .snapshot
        .sources
        .scopes
        .values()
        .filter(|e| e.scope.account == scope.account && e.scope.live == scope.live)
        .collect();
    let token = fingerprint(&(state.snapshot.namespace, &entries))?;
    let mut identities = Vec::new();
    for entry in entries {
        for outcome in entry
            .outcomes
            .values()
            .chain(entry.conflicting_outcomes.values())
        {
            let identity = match outcome.identity.as_ref() {
                Some(ProviderIdentity::Customer { customer }) => Some((customer.clone(), None)),
                Some(ProviderIdentity::Checkout {
                    customer,
                    subscription,
                    ..
                }) => Some((customer.clone(), subscription.clone())),
                None => None,
            };
            if let Some((customer, subscription)) = identity {
                identities.push(Identity {
                    organization: entry.scope.organization,
                    customer,
                    subscription,
                });
            }
        }
    }
    ensure!(identities.len() <= MAX_RECORDS, "financial_inventory_limit");
    Ok((serde_json::to_value(identities)?, token))
}

struct Table {
    tag: &'static str,
    table: &'static str,
    key: &'static str,
    columns: &'static str,
    /// Scheduling fields are classified here but excluded from the root.
    operational: &'static str,
    times: &'static str,
    from: &'static str,
}
const TABLES: &[Table] = &[
    Table { tag:"customer", table:"team_stripe_customer_operations", key:"x.operation_id::text",
        columns:"operation_id organization_id requested_by account_id livemode disposition customer_id first_attempt_at created_at observed_at revision lookup_only",
        operational:"retry_at attempts lease_id lease_until last_error_code last_http_status", times:"first_attempt_at created_at observed_at",
        from:"team_stripe_customer_operations x WHERE x.organization_id=$1 AND x.account_id=$2 AND x.livemode=$3" },
    Table { tag:"customer_authorization", table:"team_stripe_customer_authorizations", key:"x.operation_id::text||':'||x.revision::text",
        columns:"operation_id revision actor_id authorized_at action", operational:"", times:"authorized_at",
        from:"team_stripe_customer_authorizations x JOIN team_stripe_customer_operations p ON p.operation_id=x.operation_id WHERE p.organization_id=$1 AND p.account_id=$2 AND p.livemode=$3" },
    Table { tag:"quote", table:"team_stripe_quotes", key:"x.id::text",
        columns:"id organization_id actor_id account_id livemode customer_operation customer_revision customer_id package_seats price_id product_id currency amount_minor tax_behavior catalog_revision catalog_sha256 observed_at created_at expires_at",
        operational:"", times:"observed_at created_at expires_at",
        from:"team_stripe_quotes x WHERE x.organization_id=$1 AND x.account_id=$2 AND x.livemode=$3" },
    Table { tag:"checkout", table:"team_stripe_checkout_intents", key:"x.operation_id::text",
        columns:"operation_id organization_id actor_id quote_id account_id livemode disposition revision confirmed_at first_attempt_at session_id session_expires_at subscription_id observed_at request_metadata request_sha256 lookup_only recovery_actor",
        operational:"retry_at attempts lease_id lease_until last_error_code last_http_status", times:"confirmed_at first_attempt_at session_expires_at observed_at",
        from:"team_stripe_checkout_intents x WHERE x.organization_id=$1 AND x.account_id=$2 AND x.livemode=$3" },
    Table { tag:"checkout_authorization", table:"team_stripe_checkout_authorizations", key:"x.operation_id::text||':'||x.revision::text",
        columns:"operation_id revision actor_id authorized_at action", operational:"", times:"authorized_at",
        from:"team_stripe_checkout_authorizations x JOIN team_stripe_checkout_intents p ON p.operation_id=x.operation_id WHERE p.organization_id=$1 AND p.account_id=$2 AND p.livemode=$3" },
    Table { tag:"binding", table:"team_stripe_bindings", key:"x.organization_id::text",
        columns:"organization_id account_id livemode customer_id subscription_id enabled revision created_at", operational:"", times:"created_at",
        from:"team_stripe_bindings x WHERE x.organization_id=$1 AND x.account_id=$2 AND x.livemode=$3" },
    Table { tag:"snapshot", table:"team_stripe_snapshots", key:"x.organization_id::text",
        columns:"organization_id binding_revision source_revision provider_status period_start period_end trial_end cancel_at_period_end latest_invoice_id first_payment_failure_at price_id currency amount_minor quantity items_complete observed_at invoice_observation subscription_item_id payment_assessment",
        operational:"", times:"period_start period_end trial_end first_payment_failure_at observed_at",
        from:"team_stripe_snapshots x JOIN team_stripe_bindings p ON p.organization_id=x.organization_id WHERE p.organization_id=$1 AND p.account_id=$2 AND p.livemode=$3" },
    Table { tag:"inbox", table:"team_stripe_inbox", key:"x.event_id",
        columns:"account_id livemode event_id payload_hash event_kind event_created customer_id subscription_id invoice_id requested_revision disposition received_at processed_at ingress_metadata ingress_transition",
        operational:"", times:"event_created received_at processed_at",
        from:"associated_inbox x" },
    Table { tag:"reconciliation", table:"team_stripe_reconcile_jobs", key:"x.subscription_id",
        columns:"account_id livemode subscription_id requested_revision applied_revision",
        operational:"attempts retry_at lease_id lease_until last_error_code last_http_status last_success_at", times:"",
        from:"team_stripe_reconcile_jobs x WHERE x.account_id=$2 AND x.livemode=$3 AND EXISTS(SELECT 1 FROM owners o WHERE o.organization=$1 AND o.kind='subscription' AND o.identity=x.subscription_id)" },
    Table { tag:"deletion_marker", table:"team_financial_source_tombstones", key:"x.record_kind||':'||x.record_key_hash",
        columns:"organization_id account_id livemode record_kind record_key_hash prior_record_hash customer_id subscription_id reason recorded_at",
        operational:"", times:"recorded_at",
        from:"team_financial_source_tombstones x WHERE x.organization_id=$1 AND x.account_id=$2 AND x.livemode=$3" },
];

fn statement() -> String {
    let mut schema = Vec::new();
    let mut facts = Vec::new();
    for table in TABLES {
        let mut columns: Vec<_> = table
            .columns
            .split_whitespace()
            .chain(table.operational.split_whitespace())
            .collect();
        columns.sort_unstable();
        schema.push(format!(
            "('{}',ARRAY[{}]::text[])",
            table.table,
            columns
                .iter()
                .map(|c| format!("'{c}'"))
                .collect::<Vec<_>>()
                .join(",")
        ));
        let mut fields = table
            .columns
            .split_whitespace()
            .map(|c| {
                let value = if table.times.split_whitespace().any(|t| t == c) {
                    format!("(extract(epoch from x.{c})*1000000)::bigint")
                } else {
                    format!("x.{c}")
                };
                format!("'{c}',{value}")
            })
            .collect::<Vec<_>>();
        if table.tag == "checkout" {
            // Only allowlisted quote context for validating the frozen request.
            fields.push("'expected_request',(SELECT jsonb_build_object('customer',q.customer_id,'price',q.price_id,'currency',q.currency,'amount_minor',q.amount_minor) FROM team_stripe_quotes q WHERE q.id=x.quote_id AND q.organization_id=$1 AND q.account_id=$2 AND q.livemode=$3)".into());
        }
        facts.push(format!(
            "SELECT '{}'::text AS tag,{} AS id,jsonb_build_object({}) AS data FROM {}",
            table.tag,
            table.key,
            fields.join(","),
            table.from
        ));
    }
    schema.push("('team_financial_source_heads',ARRAY['account_id','livemode','organization_id','record_count','revision','root_hash','schema_version','transition_id','updated_at']::text[])".into());
    // One statement = one MVCC snapshot, including schema classification and head.
    // LIMIT+1 is an explicit failure, never a root of a silently truncated subset.
    format!(
        r#"
WITH observed AS (SELECT * FROM jsonb_to_recordset($4::jsonb) AS i(organization uuid,customer text,subscription text)),
identities AS (
 SELECT organization_id AS organization,customer_id AS customer,NULL::text AS subscription FROM team_stripe_customer_operations WHERE account_id=$2 AND livemode=$3
 UNION ALL SELECT organization_id,customer_id,NULL FROM team_stripe_quotes WHERE account_id=$2 AND livemode=$3
 UNION ALL SELECT c.organization_id,q.customer_id,c.subscription_id FROM team_stripe_checkout_intents c JOIN team_stripe_quotes q ON q.id=c.quote_id WHERE c.account_id=$2 AND c.livemode=$3
 UNION ALL SELECT organization_id,customer_id,subscription_id FROM team_stripe_bindings WHERE account_id=$2 AND livemode=$3
 UNION ALL SELECT organization_id,customer_id,subscription_id FROM team_financial_source_tombstones WHERE account_id=$2 AND livemode=$3
 UNION ALL SELECT * FROM observed
), owners AS (
 SELECT DISTINCT organization,'customer'::text AS kind,customer AS identity FROM identities WHERE customer IS NOT NULL
 UNION SELECT DISTINCT organization,'subscription',subscription FROM identities WHERE subscription IS NOT NULL
), associated_inbox AS (
 SELECT i.* FROM team_stripe_inbox i WHERE i.account_id=$2 AND i.livemode=$3 AND EXISTS(
 SELECT 1 FROM owners o WHERE o.organization=$1 AND ((o.kind='customer' AND o.identity=i.customer_id) OR (o.kind='subscription' AND o.identity=i.subscription_id)))
), classified(table_name,columns) AS (VALUES {}),
layout AS (SELECT table_name,array_agg(column_name::text ORDER BY column_name) AS columns FROM information_schema.columns WHERE table_schema=current_schema() GROUP BY table_name),
limited AS MATERIALIZED ({} LIMIT {}),
stats AS (SELECT count(*) AS records,coalesce(sum(octet_length(data::text)),0) AS bytes FROM limited),
head AS (SELECT jsonb_build_object('schema',schema_version,'revision',revision,'records',record_count,'hash',root_hash,'transition',transition_id) AS data FROM team_financial_source_heads WHERE organization_id=$1 AND account_id=$2 AND livemode=$3)
SELECT jsonb_build_object(
 'schema_ok',NOT EXISTS(SELECT 1 FROM classified c LEFT JOIN layout l USING(table_name) WHERE l.columns IS DISTINCT FROM c.columns),
 'too_large',(s.records>{} OR s.bytes>{}),
 'facts',CASE WHEN s.records<={} AND s.bytes<={} THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('tag',tag,'id',id,'data',data)),'[]'::jsonb) FROM limited) ELSE '[]'::jsonb END,
 'head',(SELECT data FROM head),
 'identity_conflict',EXISTS(SELECT 1 FROM owners a JOIN owners b USING(kind,identity) WHERE a.organization=$1 AND b.organization<>$1) OR EXISTS(SELECT 1 FROM associated_inbox i JOIN owners o ON (o.kind='customer' AND o.identity=i.customer_id) OR (o.kind='subscription' AND o.identity=i.subscription_id) WHERE o.organization<>$1),
 'unbound',EXISTS(SELECT 1 FROM team_stripe_inbox i WHERE i.account_id=$2 AND i.livemode=$3 AND NOT EXISTS(SELECT 1 FROM owners o WHERE (o.kind='customer' AND o.identity=i.customer_id) OR (o.kind='subscription' AND o.identity=i.subscription_id))) OR EXISTS(SELECT 1 FROM team_stripe_reconcile_jobs j WHERE j.account_id=$2 AND j.livemode=$3 AND NOT EXISTS(SELECT 1 FROM owners o WHERE o.kind='subscription' AND o.identity=j.subscription_id)),
 'legacy',EXISTS(SELECT 1 FROM billing_customers WHERE organization_id=$1 AND provider='stripe')
) FROM stats s
"#,
        schema.join(","),
        facts.join(" UNION ALL "),
        MAX_RECORDS + 1,
        MAX_RECORDS,
        MAX_BYTES,
        MAX_RECORDS,
        MAX_BYTES
    )
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Checkpoint {
    schema: u8,
    revision: u64,
    records: u64,
    hash: String,
    transition: Option<Uuid>,
}
fn normalize(tag: &str, data: &mut Value) -> Result<()> {
    if tag == "inbox" && !data["ingress_metadata"].is_null() {
        data["ingress_metadata"] = typed_json::<crate::services::team_financial_ingress::Receipt>(
            &data["ingress_metadata"],
        )?;
    }
    if tag == "snapshot" {
        for (field, invoice) in [("invoice_observation", true), ("payment_assessment", false)] {
            let value = data
                .get_mut(field)
                .context("financial_inventory_contract_changed")?;
            if !value.is_null() {
                *value = if invoice {
                    typed_json::<Invoice>(value)?
                } else {
                    typed_json::<Assessment>(value)?
                };
            }
        }
    }
    if tag == "checkout" {
        let op: Uuid = serde_json::from_value(data["operation_id"].clone())?;
        let expected = &data["expected_request"];
        ensure!(expected.is_object(), "financial_inventory_quote_missing");
        match (&data["request_metadata"], data["request_sha256"].as_str()) {
            (Value::Null, None) => (),
            (value, Some(hash)) if !value.is_null() => {
                let expected = ExpectedSession {
                    operation: op,
                    customer: expected["customer"]
                        .as_str()
                        .context("financial_inventory_quote_invalid")?,
                    price: expected["price"]
                        .as_str()
                        .context("financial_inventory_quote_invalid")?,
                    currency: expected["currency"]
                        .as_str()
                        .context("financial_inventory_quote_invalid")?,
                    amount_minor: expected["amount_minor"]
                        .as_i64()
                        .context("financial_inventory_quote_invalid")?,
                    live: data["livemode"]
                        .as_bool()
                        .context("financial_inventory_scope_invalid")?,
                };
                FrozenRequest::restore(value, hash, &expected)
                    .map_err(|_| anyhow::anyhow!("financial_inventory_frozen_request_invalid"))?;
            }
            _ => anyhow::bail!("financial_inventory_frozen_request_invalid"),
        }
        data.as_object_mut()
            .context("financial_inventory_contract_changed")?
            .remove("expected_request");
    }
    Ok(())
}

/// Reads only. Does not migrate, seed, reconcile, dispatch or grant access.
pub async fn preview(
    pg: &PostgresClient,
    guard: &FinancialGuard,
    scope: &Scope,
) -> Result<Preview> {
    scope.key()?;
    guard.namespace()?;
    let (identities, before) = observations(&guard.read()?, scope)?;
    let db = pg.transaction_client().await?;
    let value: Value = db
        .query_one(
            &statement(),
            &[
                &scope.organization,
                &scope.account,
                &scope.live,
                &identities,
            ],
        )
        .await
        .map_err(|_| anyhow::anyhow!("financial_inventory_database_unavailable"))?
        .get(0);
    ensure!(
        value["schema_ok"] == true,
        "financial_inventory_schema_unclassified"
    );
    ensure!(value["too_large"] == false, "financial_inventory_limit");
    let mut records = Records::new();
    for fact in value["facts"]
        .as_array()
        .context("financial_inventory_contract_changed")?
    {
        let tag = fact["tag"]
            .as_str()
            .context("financial_inventory_contract_changed")?;
        let id = fact["id"]
            .as_str()
            .context("financial_inventory_contract_changed")?;
        let mut metadata = fact["data"].clone();
        normalize(tag, &mut metadata)?;
        records.insert(tag, id, metadata)?;
    }
    let digest = records.finish(scope)?;
    let checkpoint: Option<Checkpoint> = serde_json::from_value(value["head"].clone())
        .map_err(|_| anyhow::anyhow!("financial_inventory_checkpoint_invalid"))?;
    let matches = checkpoint.as_ref().is_some_and(|h| {
        h.schema == digest.schema && h.records == digest.records && h.hash == digest.hash
    });
    let source = guard.read()?;
    // Do not permit an observation spanning a source change in either direction.
    ensure!(
        observations(&source, scope)?.1 == before,
        "financial_inventory_observation_changed"
    );
    let independent_source_matches = checkpoint.as_ref().is_some_and(|h| {
        let root = Root {
            schema: h.schema,
            revision: h.revision,
            records: h.records,
            hash: h.hash.clone(),
        };
        matches
            && source
                .snapshot
                .sources
                .verify(scope, &root)
                .is_ok_and(|e| e.committed_transition == h.transition)
    });
    Ok(Preview {
        digest,
        counts: records.counts,
        checkpoint: checkpoint.map(|h| Root {
            schema: h.schema,
            revision: h.revision,
            records: h.records,
            hash: h.hash,
        }),
        checkpoint_matches: matches,
        identity_conflict: value["identity_conflict"] == true,
        account_unbound_records: value["unbound"] == true,
        legacy_scope_unconfirmed: value["legacy"] == true,
        independent_source_matches,
    })
}

#[cfg(test)]
#[path = "team_financial_inventory_tests.rs"]
mod tests;

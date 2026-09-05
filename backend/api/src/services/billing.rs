use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::billing::{Invoice, OrganizationBilling};
use crate::services::authorization::{AuthorizationService, OrganizationAction};

pub struct BillingService {
    postgres: Option<Arc<PostgresClient>>,
    authorization: Arc<AuthorizationService>,
}

impl BillingService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        authorization: Arc<AuthorizationService>,
    ) -> Self {
        Self {
            postgres,
            authorization,
        }
    }

    pub async fn organization(
        &self,
        actor: Uuid,
        organization_id: Uuid,
    ) -> Result<OrganizationBilling> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageBilling,
                None,
            )
            .await?;
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT b.provider, s.plan, s.status, s.current_period_start,
                        s.current_period_end,
                        (SELECT count(*) FROM organization_seats os
                          WHERE os.organization_id = $1 AND os.seat_type = 'developer'
                            AND os.billable) AS developer_seats,
                        (SELECT count(*) FROM organization_seats os
                          WHERE os.organization_id = $1 AND os.seat_type = 'viewer'
                            AND os.billable) AS viewer_seats
                 FROM billing_customers b
                 LEFT JOIN LATERAL (
                    SELECT plan, status, current_period_start, current_period_end
                    FROM subscriptions WHERE billing_customer_id = b.id
                    ORDER BY created_at DESC LIMIT 1
                 ) s ON TRUE
                 WHERE b.organization_id = $1
                 LIMIT 1",
                &[&organization_id],
            )
            .await
            .context("failed to load organization billing")?;
        if let Some(row) = row {
            Ok(OrganizationBilling {
                organization_id,
                provider: row.get("provider"),
                plan: row.get("plan"),
                status: row.get("status"),
                current_period_start: row.get("current_period_start"),
                current_period_end: row.get("current_period_end"),
                developer_seats: row.get("developer_seats"),
                viewer_seats: row.get("viewer_seats"),
            })
        } else {
            Ok(OrganizationBilling {
                organization_id,
                provider: "stripe".to_string(),
                plan: None,
                status: None,
                current_period_start: None,
                current_period_end: None,
                developer_seats: 0,
                viewer_seats: 0,
            })
        }
    }

    pub async fn invoices(&self, actor: Uuid, organization_id: Uuid) -> Result<Vec<Invoice>> {
        self.authorization
            .require(
                actor,
                organization_id,
                OrganizationAction::ManageBilling,
                None,
            )
            .await?;
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT i.id, i.number, i.currency, i.subtotal_microusd, i.total_microusd,
                        i.status, i.period_start, i.period_end, i.created_at
                 FROM invoices i JOIN billing_customers b ON b.id = i.billing_customer_id
                 WHERE b.organization_id = $1 ORDER BY i.created_at DESC LIMIT 100",
                &[&organization_id],
            )
            .await
            .context("failed to list organization invoices")?;
        rows.into_iter()
            .map(|row| {
                Ok(Invoice {
                    id: row.get("id"),
                    number: row.get("number"),
                    currency: row.get("currency"),
                    subtotal_microusd: row.get("subtotal_microusd"),
                    total_microusd: row.get("total_microusd"),
                    status: row.get("status"),
                    period_start: row.get("period_start"),
                    period_end: row.get("period_end"),
                    created_at: row.get("created_at"),
                })
            })
            .collect()
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .context("PostgreSQL is not configured; set POSTGRES_URL")
    }
}

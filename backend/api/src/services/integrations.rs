use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::integration::{
    CreateIntegrationRequest, IntegrationConnection, IntegrationProvider,
};

const PROVIDERS: &[IntegrationProvider] = &[
    IntegrationProvider { id: "google_calendar", display_name: "Google Calendar", auth: "oauth2", supports_webhooks: false },
    IntegrationProvider { id: "microsoft_calendar", display_name: "Microsoft Outlook Calendar", auth: "oauth2", supports_webhooks: false },
    IntegrationProvider { id: "microsoft_teams", display_name: "Microsoft Teams", auth: "oauth2", supports_webhooks: true },
    IntegrationProvider { id: "zoom", display_name: "Zoom", auth: "oauth2", supports_webhooks: true },
    IntegrationProvider { id: "slack", display_name: "Slack", auth: "oauth2", supports_webhooks: true },
    IntegrationProvider { id: "github", display_name: "GitHub", auth: "oauth2", supports_webhooks: true },
    IntegrationProvider { id: "gitlab", display_name: "GitLab", auth: "oauth2", supports_webhooks: true },
    IntegrationProvider { id: "bitbucket", display_name: "Bitbucket", auth: "oauth2", supports_webhooks: true },
    IntegrationProvider { id: "paymo", display_name: "Paymo", auth: "oauth2", supports_webhooks: false },
    IntegrationProvider { id: "zube", display_name: "Zube", auth: "oauth2", supports_webhooks: false },
    IntegrationProvider { id: "generic_webhook", display_name: "Generic webhook", auth: "signed_webhook", supports_webhooks: true },
];

pub struct IntegrationService {
    postgres: Option<Arc<PostgresClient>>,
}

impl IntegrationService {
    pub fn new(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self { postgres }
    }

    pub fn providers() -> &'static [IntegrationProvider] {
        PROVIDERS
    }

    pub async fn create(
        &self,
        user_id: Uuid,
        provider: &str,
        request: CreateIntegrationRequest,
    ) -> Result<IntegrationConnection> {
        let provider = provider_def(provider)?;
        let display_name = request.display_name.trim();
        if display_name.is_empty() || display_name.len() > 160 {
            return Err(anyhow!("display_name must contain 1-160 characters"));
        }
        let encrypted = BASE64
            .decode(request.encrypted_credentials.trim())
            .context("encrypted_credentials must be base64")?;
        if encrypted.len() < 16 || encrypted.len() > 128 * 1024 {
            return Err(anyhow!("encrypted_credentials has an invalid size"));
        }
        if let Some(organization_id) = request.organization_id {
            self.require_org_admin(user_id, organization_id).await?;
        }
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let scopes = request.scopes;
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO integration_connections
                    (id, organization_id, user_id, provider, display_name, status, scopes)
                 VALUES ($1, $2, $3, $4, $5, 'connected', $6)
                 RETURNING id, provider, display_name, status, scopes,
                           last_synced_at, created_at, disconnected_at",
                &[
                    &id,
                    &request.organization_id,
                    &user_id,
                    &provider.id,
                    &display_name,
                    &scopes,
                ],
            )
            .await
            .context("failed to create integration connection")?;
        postgres
            .client()
            .execute(
                "INSERT INTO integration_credentials
                    (connection_id, encrypted_payload, key_version)
                 VALUES ($1, $2, 'client-envelope-v1')",
                &[&id, &encrypted],
            )
            .await
            .context("failed to store encrypted integration credentials")?;
        connection_from_row(row)
    }

    pub async fn list(&self, user_id: Uuid) -> Result<Vec<IntegrationConnection>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT c.id, c.provider, c.display_name, c.status, c.scopes,
                        c.last_synced_at, c.created_at, c.disconnected_at
                 FROM integration_connections c
                 LEFT JOIN organization_members m
                   ON m.organization_id = c.organization_id
                  AND m.user_id = $1 AND m.deactivated_at IS NULL
                 WHERE c.user_id = $1 OR m.user_id IS NOT NULL
                 ORDER BY c.created_at DESC",
                &[&user_id],
            )
            .await
            .context("failed to list integration connections")?;
        rows.into_iter().map(connection_from_row).collect()
    }

    pub async fn status(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> Result<Option<IntegrationConnection>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT c.id, c.provider, c.display_name, c.status, c.scopes,
                        c.last_synced_at, c.created_at, c.disconnected_at
                 FROM integration_connections c
                 LEFT JOIN organization_members m
                   ON m.organization_id = c.organization_id
                  AND m.user_id = $1 AND m.deactivated_at IS NULL
                 WHERE c.id = $2 AND (c.user_id = $1 OR m.user_id IS NOT NULL)",
                &[&user_id, &id],
            )
            .await
            .context("failed to load integration connection")?;
        row.map(connection_from_row).transpose()
    }

    pub async fn request_sync(&self, user_id: Uuid, id: Uuid) -> Result<bool> {
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE integration_connections c
                    SET status = 'syncing'
                  WHERE c.id = $2 AND c.disconnected_at IS NULL
                    AND (c.user_id = $1 OR EXISTS (
                        SELECT 1 FROM organization_members m
                         WHERE m.organization_id = c.organization_id
                           AND m.user_id = $1 AND m.role IN ('owner', 'admin')
                           AND m.deactivated_at IS NULL
                    ))",
                &[&user_id, &id],
            )
            .await
            .context("failed to queue integration sync")?;
        if changed == 1 {
            postgres
                .client()
                .execute(
                    "INSERT INTO outbox_events
                        (id, aggregate_type, aggregate_id, event_type, payload)
                     VALUES ($1, 'integration_connection', $2, 'integration.sync.requested', $3)",
                    &[
                        &Uuid::now_v7(),
                        &id,
                        &serde_json::json!({ "connection_id": id, "requested_by": user_id }),
                    ],
                )
                .await
                .context("failed to publish integration sync outbox event")?;
        }
        Ok(changed == 1)
    }

    pub async fn disconnect(&self, user_id: Uuid, id: Uuid) -> Result<Option<String>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "UPDATE integration_connections c
                    SET status = 'disconnected', disconnected_at = now()
                  WHERE c.id = $2 AND c.disconnected_at IS NULL
                    AND (c.user_id = $1 OR EXISTS (
                        SELECT 1 FROM organization_members m
                         WHERE m.organization_id = c.organization_id
                           AND m.user_id = $1 AND m.role IN ('owner', 'admin')
                           AND m.deactivated_at IS NULL
                    ))
                 RETURNING provider",
                &[&user_id, &id],
            )
            .await
            .context("failed to disconnect integration")?;
        if let Some(row) = row {
            postgres
                .client()
                .execute(
                    "DELETE FROM integration_credentials WHERE connection_id = $1",
                    &[&id],
                )
                .await
                .context("failed to remove integration credentials")?;
            Ok(Some(row.get("provider")))
        } else {
            Ok(None)
        }
    }

    async fn require_org_admin(&self, user_id: Uuid, organization_id: Uuid) -> Result<()> {
        let postgres = self.required()?;
        let allowed = postgres
            .client()
            .query_opt(
                "SELECT 1 FROM organization_members
                 WHERE organization_id = $1 AND user_id = $2
                   AND role IN ('owner', 'admin') AND deactivated_at IS NULL",
                &[&organization_id, &user_id],
            )
            .await
            .context("failed to resolve organization integration permission")?
            .is_some();
        if allowed {
            Ok(())
        } else {
            Err(anyhow!("organization admin permission is required"))
        }
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn provider_def(id: &str) -> Result<&'static IntegrationProvider> {
    PROVIDERS
        .iter()
        .find(|provider| provider.id == id)
        .ok_or_else(|| anyhow!("unsupported integration provider"))
}

fn connection_from_row(row: Row) -> Result<IntegrationConnection> {
    Ok(IntegrationConnection {
        id: row.try_get("id")?,
        provider: row.try_get("provider")?,
        display_name: row.try_get("display_name")?,
        status: row.try_get("status")?,
        scopes: row.try_get("scopes")?,
        last_synced_at: row.try_get::<_, Option<DateTime<Utc>>>("last_synced_at")?,
        created_at: row.try_get("created_at")?,
        disconnected_at: row.try_get("disconnected_at")?,
    })
}


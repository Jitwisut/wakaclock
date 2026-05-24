//! Repository utilities for writing ingestion data into ClickHouse.
//!
//! The product ingestion pipeline writes every payload twice:
//! 1. `product_events` (append-only audit log)
//! 2. `product_current` (ReplacingMergeTree latest snapshot)
//!
//! This repository provides thin wrappers around the ClickHouse client to
//! support batch inserts with backpressure-friendly chunking.

use std::sync::Arc;

use anyhow::Result;
use tracing::{debug, instrument};

use crate::{
    client::database::ClickHouseClient,
    model::ingestion::{ProductCurrentRow, ProductEventRow},
};

const INSERT_BATCH_SIZE: usize = 1000;

pub struct ProductIngestionRepository {
    client: Arc<ClickHouseClient>,
    database: String,
}

impl ProductIngestionRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        let database = client.get_database();
        Self { client, database }
    }

    #[instrument(skip(self, events))]
    pub async fn insert_product_events(&self, events: &[ProductEventRow]) -> Result<()> {
        if events.is_empty() {
            return Ok(());
        }

        let table = format!("{}.product_events", self.database);
        for chunk in events.chunks(INSERT_BATCH_SIZE) {
            let mut insert = self.client.insert::<ProductEventRow>(&table);
            for event in chunk {
                insert = insert.write(event);
            }
            insert.end().await?;
            debug!(
                row_count = chunk.len(),
                "inserted product_events chunk into ClickHouse"
            );
        }

        Ok(())
    }

    #[instrument(skip(self, snapshots))]
    pub async fn upsert_product_current(&self, snapshots: &[ProductCurrentRow]) -> Result<()> {
        if snapshots.is_empty() {
            return Ok(());
        }

        let table = format!("{}.product_current", self.database);
        for chunk in snapshots.chunks(INSERT_BATCH_SIZE) {
            let mut insert = self.client.insert::<ProductCurrentRow>(&table);
            for snapshot in chunk {
                insert = insert.write(snapshot);
            }
            insert.end().await?;
            debug!(
                row_count = chunk.len(),
                "inserted product_current chunk into ClickHouse"
            );
        }

        Ok(())
    }

    pub async fn persist_batch(
        &self,
        events: &[ProductEventRow],
        snapshots: &[ProductCurrentRow],
    ) -> Result<()> {
        self.insert_product_events(events).await?;
        self.upsert_product_current(snapshots).await?;
        Ok(())
    }
}

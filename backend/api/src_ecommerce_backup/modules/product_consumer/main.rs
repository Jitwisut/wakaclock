use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use ecommerce_connect::{
    client::database::clickhouse::ClickHouseClient,
    config::Config,
    infrastructure::{
        logger,
        queue::{rabbitmq::RabbitMqQueue, MessageQueue},
    },
    repository::{clickhouse::ClickHouseRepository, qdrant::QdrantRepository, VectorRepository},
    worker::{ProductConsumerWorker, Worker},
};
use tracing::{error, info};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    logger::init_tracing()?;
    let config = Arc::new(Config::from_env()?);

    let clickhouse_client = Arc::new(
        ClickHouseClient::new(&config.database)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to initialise ClickHouse: {}", e))?,
    );
    let clickhouse_repo = Arc::new(ClickHouseRepository::new(clickhouse_client));

    let mut qdrant_builder = qdrant_client::Qdrant::from_url(&config.qdrant.url);
    if let Some(api_key) = &config.qdrant.api_key {
        qdrant_builder = qdrant_builder.api_key(api_key.clone());
    }
    let qdrant_client = Arc::new(
        qdrant_builder
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to initialise Qdrant: {}", e))?,
    );
    let vector_repo: Arc<dyn VectorRepository> = Arc::new(QdrantRepository::new(
        qdrant_client,
        config.qdrant.collection_prefix.clone(),
    ));

    let rabbit_config = &config.rabbitmq;
    let queue: Arc<dyn MessageQueue> = Arc::new(
        RabbitMqQueue::new_with_settings(
            &rabbit_config.url,
            &rabbit_config.exchange,
            &rabbit_config.queue_prefix,
            rabbit_config.prefetch_count,
        )
        .await?,
    );

    let worker = Arc::new(ProductConsumerWorker::new(
        queue.clone(),
        clickhouse_repo,
        vector_repo,
        config.clone(),
    ));

    let shutdown = Arc::new(AtomicBool::new(false));
    let worker_shutdown = shutdown.clone();
    let worker_handle = {
        let worker = worker.clone();
        tokio::spawn(async move {
            if let Err(err) = worker.start_with_shutdown(worker_shutdown).await {
                error!("Product consumer worker stopped with error: {}", err);
            }
        })
    };

    info!("Product consumer worker started - press Ctrl+C to exit");
    tokio::signal::ctrl_c().await?;
    info!("Shutdown signal received, waiting for worker to exit...");
    shutdown.store(true, Ordering::SeqCst);

    if let Err(err) = worker_handle.await {
        error!("Worker task join error: {}", err);
    }

    worker.stop().await?;
    info!("Product consumer worker stopped cleanly");
    Ok(())
}

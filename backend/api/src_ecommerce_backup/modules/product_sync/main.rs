/// ไฟล์ main.rs - Product Sync Worker Module
/// โมดูล worker สำหรับการซิงค์สินค้าระหว่างแพลตฟอร์มต่างๆ และฐานข้อมูล
/// ประมวลผล ProductSyncMessage จาก RabbitMQ และดำเนินการซิงค์ข้อมูลสินค้า
/// รองรับการซิงค์แบบ real-time และ batch processing
use ecommerce_connect::{
    config::Config,
    infrastructure::logger,
    infrastructure::queue::{
        traits::{JobType, QueueMessage},
        MessageQueue, RabbitMqQueue,
    },
    repository::clickhouse::ClickHouseRepository,
    worker::product_sync::{ProductSyncMessage, ProductSyncWorker},
};
use std::sync::Arc;
use tokio::signal;
use tracing::{error, info};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    logger::init_tracing()?;

    info!("Starting Product Sync Worker");

    // Load configuration
    let config = Config::from_env().expect("Failed to load configuration");

    // Initialize ClickHouse client
    let clickhouse_client = Arc::new(
        ecommerce_connect::client::database::clickhouse::ClickHouseClient::new(&config.database)
            .await
            .expect("Failed to create ClickHouse client"),
    );

    // Skip migrations for now - they should be run separately

    // Initialize repositories
    let clickhouse_repo = Arc::new(ClickHouseRepository::new(clickhouse_client.clone()))
        as Arc<dyn ecommerce_connect::repository::ProductRepository>;

    // Initialize state
    let state = Arc::new(ecommerce_connect::infrastructure::app::App::new().await?);

    // Create product sync worker
    let worker = ProductSyncWorker::new(state.clone(), clickhouse_repo.clone());

    // Initialize RabbitMQ queue
    let rabbit_config = &config.rabbitmq;
    let queue = Arc::new(
        RabbitMqQueue::new_with_settings(
            &rabbit_config.url,
            &rabbit_config.exchange,
            &rabbit_config.queue_prefix,
            rabbit_config.prefetch_count,
        )
        .await?,
    );

    info!("Starting product sync worker...");

    // Create a shutdown signal handler
    let shutdown = Arc::new(tokio::sync::Notify::new());
    let shutdown_clone = shutdown.clone();

    // Spawn signal handler
    tokio::spawn(async move {
        let _ = signal::ctrl_c().await;
        info!("Received shutdown signal");
        shutdown_clone.notify_one();
    });

    // Subscribe to queue
    let worker_arc = Arc::new(worker);
    // Using underscore prefix to indicate intentionally unused variable

    queue
        .subscribe(Box::new(move |msg: QueueMessage| {
            let worker = worker_arc.clone();

            // Process in blocking context since handler is sync
            let result = futures::executor::block_on(async move {
                // Note: We can't check shutdown in sync context without blocking
                // The shutdown will be handled by the main loop

                info!("Processing sync message: {}", msg.id);

                // Check if this is a ProductSync job
                if msg.job_type != JobType::ProductSync {
                    info!("Skipping non-ProductSync message: {:?}", msg.job_type);
                    return Ok(());
                }

                // Parse the payload as ProductSyncMessage
                let sync_msg: ProductSyncMessage =
                    serde_json::from_value(msg.payload).map_err(|e| {
                        error!("Failed to parse ProductSyncMessage: {}", e);
                        ecommerce_connect::model::v1::platfrom::entries::AppError::SerializationError(format!(
                            "Failed to parse sync message: {}",
                            e
                        ))
                    })?;

                info!(
                    "Processing product sync for shop {} on platform {}",
                    sync_msg.shop_id, sync_msg.platform
                );

                // Process the sync message
                if let Err(e) = worker.process_message(sync_msg).await {
                    error!("Failed to process sync message: {}", e);
                    return Err(e);
                }

                info!("Successfully processed sync message: {}", msg.id);
                Ok::<(), ecommerce_connect::model::v1::platfrom::entries::AppError>(())
            });

            // Convert AppError to anyhow::Error
            result.map_err(|e| anyhow::anyhow!("Processing failed: {}", e))
        }))
        .await?;

    info!("Product sync worker stopped");
    Ok(())
}

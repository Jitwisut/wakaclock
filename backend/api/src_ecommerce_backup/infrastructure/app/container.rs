//! ไฟล์ container.rs - Application Container สำหรับ Dependency Injection
//! จัดการ dependencies และ services ทั้งหมดในแอพพลิเคชัน
//! รองรับการ initialize services แบบ lazy loading
//! ใช้ pattern ของ service container สำหรับจัดการ dependencies

use anyhow::Result;
use sqlx::mysql::MySqlPool;
use std::sync::Arc;

use crate::infrastructure::app::App;
use crate::interfaces::webhook::WebhookInterface;
use crate::repository::webhook::MySqlWebhookRepository;
use crate::services::webhook::WebhookService;

/// AppContainer - Container หลักสำหรับจัดการ dependencies ทั้งหมด
/// เป็น wrapper ของ App พื้นฐานและเพิ่ม services เสริม เช่น MySQL และ webhook
/// ใช้ Arc สำหรับ thread-safe sharing และ Option สำหรับ lazy initialization
pub struct AppContainer {
    /// App instance พื้นฐานที่มี core dependencies
    pub app: Arc<App>,
    /// MySQL connection pool สำหรับ webhook data
    mysql_pool: Option<Arc<MySqlPool>>,
    /// Webhook service สำหรับจัดการ webhook notifications
    webhook_service: Option<Arc<dyn WebhookInterface>>,
}

impl AppContainer {
    /// สร้าง AppContainer ใหม่จาก App instance ที่มีอยู่
    /// เริ่มต้นด้วย services ทั้งหมดเป็น None (lazy initialization)
    pub fn new(app: Arc<App>) -> Self {
        Self {
            app,
            mysql_pool: None,
            webhook_service: None,
        }
    }

    /// Initialize MySQL connection pool สำหรับ webhook data storage
    /// ใช้ builder pattern สำหรับ method chaining
    pub async fn with_mysql(&mut self, database_url: &str) -> Result<&mut Self> {
        let pool = MySqlPool::connect(database_url).await?;
        self.mysql_pool = Some(Arc::new(pool));
        Ok(self)
    }

    /// Initialize webhook service พร้อมกับ repository และ database tables
    /// ต้องเรียก with_mysql() ก่อนเพื่อ setup database connection
    pub async fn with_webhook_service(&mut self) -> Result<&mut Self> {
        if let Some(pool) = &self.mysql_pool {
            let repository = Arc::new(MySqlWebhookRepository::new(pool.as_ref().clone()));

            // สร้าง database tables สำหรับ webhook ถ้ายังไม่มี
            repository
                .init_tables()
                .await
                .map_err(|e| anyhow::anyhow!("Failed to init webhook tables: {}", e))?;

            // สร้าง webhook service พร้อม repository
            let service = Arc::new(WebhookService::new(repository));
            self.webhook_service = Some(service);
        } else {
            return Err(anyhow::anyhow!(
                "MySQL pool must be initialized before webhook service"
            ));
        }
        Ok(self)
    }

    /// ดึง webhook service ที่ initialize แล้ว
    /// คืน error ถ้า service ยังไม่ได้ initialize
    pub fn get_webhook_service(&self) -> Result<Arc<dyn WebhookInterface>> {
        self.webhook_service
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Webhook service not initialized"))
    }

    /// ดึง MySQL connection pool ที่ initialize แล้ว
    /// คืน error ถ้า pool ยังไม่ได้ initialize
    pub fn get_mysql_pool(&self) -> Result<Arc<MySqlPool>> {
        self.mysql_pool
            .clone()
            .ok_or_else(|| anyhow::anyhow!("MySQL pool not initialized"))
    }

    /// Build container เป็น Arc สำหรับ thread-safe sharing
    /// ใช้หลังจาก setup services ทั้งหมดแล้ว
    pub fn build(self) -> Arc<Self> {
        Arc::new(self)
    }
}

/// Helper function สำหรับสร้าง AppContainer พร้อม configuration พื้นฐาน
/// รองรับ optional MySQL database URL สำหรับ webhook service
/// คืน Arc<AppContainer> ที่พร้อมใช้งาน
pub async fn new_app_container(database_url: Option<&str>) -> Result<Arc<AppContainer>> {
    // สร้าง base app พร้อม core dependencies
    let app = Arc::new(crate::infrastructure::app::new_app().await?);

    // สร้าง container wrapper
    let mut container = AppContainer::new(app);

    // Initialize MySQL และ webhook service ถ้ามี database URL
    if let Some(db_url) = database_url {
        container.with_mysql(db_url).await?;
        container.with_webhook_service().await?;
    }

    Ok(container.build())
}

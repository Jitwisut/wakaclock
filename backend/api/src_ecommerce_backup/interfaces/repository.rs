/// Repository Interface - อินเทอร์เฟซสำหรับ Repository Pattern
///
/// โมดูลนี้กำหนด generic repository interface สำหรับการเข้าถึงข้อมูล
/// ใช้ Repository pattern เพื่อแยก data access layer จาก business logic
/// รองรับ CRUD operations, filtering, pagination, และ batch operations
///
/// # Features
/// - Generic type support สำหรับ entity types ต่างๆ
/// - Async/await support สำหรับ non-blocking operations
/// - Rich query capabilities พร้อม filtering และ sorting
/// - Pagination support สำหรับ large datasets
/// - Batch operations สำหรับ performance optimization
///
/// # Usage
/// ```rust
/// impl Repository<Product, String> for ProductRepository {
///     async fn find_by_id(&self, id: &String) -> InterfaceResult<Option<Product>> { ... }
/// }
/// ```
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use super::InterfaceResult;

/// Generic repository interface สำหรับการเข้าถึงข้อมูล
///
/// Interface ที่กำหนดวิธีการมาตรฐานสำหรับการจัดการข้อมูล
/// รองรับ entity type T และ ID type ID
#[async_trait]
pub trait Repository<T, ID>: Send + Sync
where
    T: Send + Sync,
    ID: Send + Sync,
{
    /// ค้นหา entity ด้วย ID
    ///
    /// คืนค่า entity ที่ตรงกับ ID ที่กำหนด หรือ None ถ้าไม่พบ
    async fn find_by_id(&self, id: &ID) -> InterfaceResult<Option<T>>;

    /// ค้นหา entities ทั้งหมดพร้อม filtering เพิ่มเติม
    ///
    /// คืนค่า paginated result พร้อม query parameters
    async fn find_all(&self, params: &QueryParams) -> InterfaceResult<PagedResult<T>>;

    /// บันทึก entity ใหม่
    ///
    /// สร้าง entity ใหม่ในฐานข้อมูล และคืนค่า ID ของ entity ที่สร้าง
    async fn save(&self, entity: &T) -> InterfaceResult<ID>;

    /// อัพเดต entity ที่มีอยู่แล้ว
    ///
    /// อัพเดต entity ที่มี ID ตรงกับที่กำหนด
    async fn update(&self, id: &ID, entity: &T) -> InterfaceResult<()>;

    /// ลบ entity ด้วย ID
    ///
    /// ลบ entity ที่มี ID ตรงกับที่กำหนดออกจากฐานข้อมูล
    async fn delete(&self, id: &ID) -> InterfaceResult<()>;

    /// นับจำนวน entities พร้อม filtering เพิ่มเติม
    ///
    /// คืนค่าจำนวน entities ที่ตรงกับ filter conditions
    async fn count(&self, filter: Option<&QueryFilter>) -> InterfaceResult<usize>;

    /// ตรวจสอบว่า entity มีอยู่หรือไม่
    ///
    /// คืนค่า true ถ้า entity มีอยู่ หรือ false ถ้าไม่มี
    async fn exists(&self, id: &ID) -> InterfaceResult<bool> {
        Ok(self.find_by_id(id).await?.is_some())
    }

    /// บันทึก entities แบบ batch
    ///
    /// บันทึก entities หลายตัวพร้อมกันในครั้งเดียว เพื่อประสิทธิภาพ
    async fn save_batch(&self, entities: &[T]) -> InterfaceResult<Vec<ID>>;

    /// อัพเดต entities แบบ batch
    ///
    /// อัพเดต entities หลายตัวพร้อมกันในครั้งเดียว
    async fn update_batch(&self, updates: &[(ID, T)]) -> InterfaceResult<()>;

    /// ลบ entities แบบ batch
    ///
    /// ลบ entities หลายตัวด้วย IDs ที่กำหนดในครั้งเดียว
    async fn delete_batch(&self, ids: &[ID]) -> InterfaceResult<()>;
}

/// Parameters สำหรับ query operations
///
/// รวบรวม parameters ทั้งหมดสำหรับการ query ข้อมูล
/// รวมถึง filtering, sorting, และ pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryParams {
    /// Filter conditions เพิ่มเติม
    pub filter: Option<QueryFilter>,
    /// Sort parameters เพิ่มเติม
    pub sort: Option<SortParams>,
    /// Pagination parameters เพิ่มเติม
    pub pagination: Option<PaginationParams>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryFilter {
    pub conditions: Vec<FilterCondition>,
    pub operator: FilterOperator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub field: String,
    pub operator: ComparisonOperator,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterOperator {
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComparisonOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    GreaterThanOrEqual,
    LessThanOrEqual,
    In,
    NotIn,
    Like,
    NotLike,
    IsNull,
    IsNotNull,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortParams {
    pub field: String,
    pub direction: SortDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: usize,
    pub page_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagedResult<T> {
    pub items: Vec<T>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
    pub total_pages: usize,
}

impl<T> PagedResult<T> {
    pub fn new(items: Vec<T>, total: usize, page: usize, page_size: usize) -> Self {
        let total_pages = (total as f64 / page_size as f64).ceil() as usize;
        Self {
            items,
            total,
            page,
            page_size,
            total_pages,
        }
    }

    pub fn has_next(&self) -> bool {
        self.page < self.total_pages
    }

    pub fn has_prev(&self) -> bool {
        self.page > 1
    }
}

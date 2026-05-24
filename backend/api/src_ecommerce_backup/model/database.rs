//! Database Model
//! โมเดลสำหรับจัดการ database queries, filters และ aggregations
//!
//! ใช้สำหรับการสร้าง query conditions และ data aggregation
//! สำหรับการทำงานกับ ClickHouse และ database อื่นๆ
//! รองรับ type-safe queries และ dynamic filtering

/// โครงสร้างสำหรับการกำหนดเงื่อนไขในการ query ข้อมูล
/// ใช้สำหรับการสร้าง WHERE conditions และ filtering ข้อมูล
/// รองรับ type-safe queries โดยใช้ Any trait
#[derive(Debug)]
pub struct Filter {
    /// ชื่อ field ที่จะกรองข้อมูล
    /// ต้องตรงกับ column name ใน database table
    pub field: String,

    /// ค่าที่จะใช้ในการกรองข้อมูล
    /// เก็บเป็น trait object เพื่อรองรับ types หลากหลาย
    pub value: Box<dyn std::any::Any + Send + Sync>,
}

impl Filter {
    /// สร้าง Filter instance ใหม่
    /// รับ generic type T ที่สามารถ Send + Sync ได้
    pub fn new<T: 'static + std::any::Any + Send + Sync>(field: String, value: T) -> Self {
        Filter {
            field,
            value: Box::new(value),
        }
    }
}

/// โครงสร้างสำหรับการ aggregate ข้อมูล
/// ใช้สำหรับ SUM, COUNT, AVG, GROUP BY และ aggregation functions
/// เหมาะสำหรับ analytics queries และ reporting
#[derive(Debug, Clone)]
pub struct Aggregation {
    /// รายการ fields ที่จะ aggregate
    /// เช่น ["price", "quantity"] สำหรับ SUM(price), COUNT(quantity)
    pub fields: Vec<String>,

    /// Field ที่จะใช้ในการ GROUP BY
    /// เช่น "category_id" เพื่อ group ตามหมวดหมู่สินค้า
    pub group_by: String,
}

impl Aggregation {
    /// สร้าง Aggregation instance ใหม่
    /// รับ fields ที่จะ aggregate และ field สำหรับ GROUP BY
    pub fn new(fields: Vec<String>, group_by: String) -> Self {
        Aggregation { fields, group_by }
    }
}

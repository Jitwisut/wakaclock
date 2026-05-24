// interfaces/database.rs
use anyhow::Result;
use async_trait::async_trait;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// TransactionSession รองรับการทำงานแบบ transactional
/// Transaction session for transactional operations
#[async_trait]
pub trait TransactionSession: Send + Sync {
    async fn commit(&mut self) -> Result<()>;
    async fn rollback(&mut self) -> Result<()>;
}

/// ตัวเลือกสำหรับการ query
/// Query options
#[derive(Debug, Clone, Default)]
pub struct QueryOptions {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort: Option<Vec<SortOption>>,
    pub projection: Option<Vec<String>>,
}

impl QueryOptions {
    pub fn builder() -> QueryOptionsBuilder {
        QueryOptionsBuilder {
            inner: QueryOptions::default(),
        }
    }
}

/// Fluent builder for `QueryOptions`.
#[derive(Debug, Default)]
pub struct QueryOptionsBuilder {
    inner: QueryOptions,
}

impl QueryOptionsBuilder {
    pub fn limit(mut self, limit: i64) -> Self {
        self.inner.limit = Some(limit);
        self
    }

    pub fn offset(mut self, offset: i64) -> Self {
        self.inner.offset = Some(offset);
        self
    }

    pub fn sort(mut self, sort: Vec<SortOption>) -> Self {
        self.inner.sort = Some(sort);
        self
    }

    pub fn projection<I, S>(mut self, fields: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.inner.projection = Some(fields.into_iter().map(Into::into).collect());
        self
    }

    pub fn build(self) -> QueryOptions {
        self.inner
    }
}

/// ตัวเลือกการเรียงลำดับ
/// Sort options
#[derive(Debug, Clone)]
pub struct SortOption {
    pub field: String,
    pub ascending: bool,
}

impl SortOption {
    pub fn new(field: impl Into<String>, ascending: bool) -> Self {
        Self {
            field: field.into(),
            ascending,
        }
    }

    pub fn ascending(field: impl Into<String>) -> Self {
        Self::new(field, true)
    }

    pub fn descending(field: impl Into<String>) -> Self {
        Self::new(field, false)
    }
}

/// ตัวเลือกสำหรับการอัปเดต
/// Update options
#[derive(Debug, Clone, Default)]
pub struct UpdateOptions {
    pub upsert: bool,
    pub return_new: bool,
}

impl UpdateOptions {
    pub fn enable_upsert(mut self) -> Self {
        self.upsert = true;
        self
    }

    pub fn return_new(mut self) -> Self {
        self.return_new = true;
        self
    }
}

/// Filter สำหรับการ query
/// Filter for queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Filter {
    pub conditions: HashMap<String, FilterValue>,
}

impl Filter {
    pub fn new() -> Self {
        Self {
            conditions: HashMap::new(),
        }
    }

    pub fn insert<K, V>(&mut self, key: K, value: V)
    where
        K: Into<String>,
        V: Into<FilterValue>,
    {
        self.conditions.insert(key.into(), value.into());
    }

    pub fn with_condition<K, V>(mut self, key: K, value: V) -> Self
    where
        K: Into<String>,
        V: Into<FilterValue>,
    {
        self.insert(key, value);
        self
    }

    pub fn is_empty(&self) -> bool {
        self.conditions.is_empty()
    }
}

impl Default for Filter {
    fn default() -> Self {
        Self::new()
    }
}

impl<K, V> FromIterator<(K, V)> for Filter
where
    K: Into<String>,
    V: Into<FilterValue>,
{
    fn from_iter<T: IntoIterator<Item = (K, V)>>(iter: T) -> Self {
        let mut filter = Filter::new();
        for (key, value) in iter {
            filter.insert(key, value);
        }
        filter
    }
}

impl From<HashMap<String, FilterValue>> for Filter {
    fn from(map: HashMap<String, FilterValue>) -> Self {
        Self { conditions: map }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FilterValue {
    String(String),
    Number(i64),
    Float(f64),
    Bool(bool),
    Array(Vec<FilterValue>),
    Object(HashMap<String, FilterValue>),
}

impl From<String> for FilterValue {
    fn from(value: String) -> Self {
        FilterValue::String(value)
    }
}

impl<'a> From<&'a str> for FilterValue {
    fn from(value: &'a str) -> Self {
        FilterValue::String(value.to_string())
    }
}

impl From<i64> for FilterValue {
    fn from(value: i64) -> Self {
        FilterValue::Number(value)
    }
}

impl From<u64> for FilterValue {
    fn from(value: u64) -> Self {
        FilterValue::Number(value as i64)
    }
}

impl From<i32> for FilterValue {
    fn from(value: i32) -> Self {
        FilterValue::Number(value as i64)
    }
}

impl From<f64> for FilterValue {
    fn from(value: f64) -> Self {
        FilterValue::Float(value)
    }
}

impl From<bool> for FilterValue {
    fn from(value: bool) -> Self {
        FilterValue::Bool(value)
    }
}

impl From<Vec<FilterValue>> for FilterValue {
    fn from(values: Vec<FilterValue>) -> Self {
        FilterValue::Array(values)
    }
}

impl From<HashMap<String, FilterValue>> for FilterValue {
    fn from(map: HashMap<String, FilterValue>) -> Self {
        FilterValue::Object(map)
    }
}

impl From<Value> for FilterValue {
    fn from(value: Value) -> Self {
        match value {
            Value::String(s) => FilterValue::String(s),
            Value::Number(num) => {
                if let Some(i) = num.as_i64() {
                    FilterValue::Number(i)
                } else if let Some(f) = num.as_f64() {
                    FilterValue::Float(f)
                } else {
                    FilterValue::String(num.to_string())
                }
            }
            Value::Bool(b) => FilterValue::Bool(b),
            Value::Array(arr) => {
                FilterValue::Array(arr.into_iter().map(FilterValue::from).collect())
            }
            Value::Object(map) => FilterValue::Object(
                map.into_iter()
                    .map(|(k, v)| (k, FilterValue::from(v)))
                    .collect(),
            ),
            Value::Null => FilterValue::String("null".to_string()),
        }
    }
}

/// AggregateStage สำหรับการทำ aggregation
/// Aggregate stage for aggregation operations
#[derive(Debug, Clone)]
pub enum AggregateStage {
    Match(Filter),
    Group(GroupStage),
    Sort(Vec<SortOption>),
    Limit(i64),
    Skip(i64),
    Project(HashMap<String, bool>),
}

#[derive(Debug, Clone)]
pub struct GroupStage {
    pub id: String,
    pub fields: HashMap<String, AggregateOperation>,
}

#[derive(Debug, Clone)]
pub enum AggregateOperation {
    Sum(String),
    Avg(String),
    Min(String),
    Max(String),
    Count,
}

/// DatabaseInterface เป็นอินเทอร์เฟซที่ใช้กำหนดฟังก์ชันพื้นฐานสำหรับการทำงานกับฐานข้อมูล
/// DatabaseInterface defines basic functions for working with databases
#[async_trait]
pub trait DatabaseInterface: Send + Sync {
    /// Name คืนค่าชื่อของฐานข้อมูล (เช่น MySQL, MongoDB, ClickHouse)
    /// Returns the database name (e.g., MySQL, MongoDB, ClickHouse)
    fn name(&self) -> &str;

    /// CreateTableAndIndex สร้างตารางและจัดการ Index สำหรับตารางนั้น
    /// tableName: ชื่อตาราง
    /// indexes: แผนที่ (map) ของชื่อ Index และสถานะการใช้งาน (true/false)
    ///
    /// Create table and manage indexes for that table
    /// tableName: table name
    /// indexes: map of index names and enabled status (true/false)
    async fn create_table_and_index(
        &self,
        table_name: &str,
        indexes: HashMap<String, bool>,
        options: &str,
    ) -> Result<()>;

    /// Count คืนค่าจำนวนข้อมูล
    /// tableName: ชื่อตาราง
    /// filter: เงื่อนไขที่ใช้กรองข้อมูล
    ///
    /// Returns the count of data
    /// tableName: table name
    /// filter: conditions for filtering data
    async fn count(&self, table_name: &str, filter: Filter) -> Result<i64>;

    /// GetOne คืนค่าข้อมูลหนึ่งรายการจากตารางโดยใช้ฟิลเตอร์
    /// tableName: ชื่อตาราง
    /// filter: เงื่อนไขที่ใช้กรองข้อมูล
    ///
    /// Returns one data item from table using filter
    /// tableName: table name
    /// filter: conditions for filtering data
    async fn get_one<T: DeserializeOwned>(
        &self,
        table_name: &str,
        filter: Filter,
    ) -> Result<Option<T>>;

    /// GetAll คืนค่าข้อมูลทั้งหมดจากตารางตามฟิลเตอร์และตัวเลือกเพิ่มเติม
    /// tableName: ชื่อตาราง
    /// filters: เงื่อนไขที่ใช้กรองข้อมูล
    /// opts: ตัวเลือกเพิ่มเติม เช่น การจัดเรียง (Sorting), การแบ่งหน้า (Pagination)
    ///
    /// Returns all data from table based on filters and additional options
    /// tableName: table name
    /// filters: conditions for filtering data
    /// opts: additional options like sorting, pagination
    async fn get_all<T: DeserializeOwned>(
        &self,
        table_name: &str,
        filters: Filter,
        opts: QueryOptions,
    ) -> Result<Vec<T>>;

    /// Create เพิ่มข้อมูลใหม่ในตาราง
    /// tableName: ชื่อตาราง
    /// data: ข้อมูลที่ต้องการเพิ่ม
    ///
    /// Add new data to table
    /// tableName: table name
    /// data: data to add
    async fn create<T: Serialize>(&self, table_name: &str, data: &T) -> Result<String>;

    /// Upsert เพิ่มข้อมูลใหม่หรืออัปเดตข้อมูลที่มีอยู่ตามฟิลเตอร์
    /// tableName: ชื่อตาราง
    /// filters: เงื่อนไขที่ใช้กรองข้อมูล
    /// data: ข้อมูลที่ต้องการเพิ่มหรืออัปเดต
    ///
    /// Add new data or update existing data based on filter
    /// tableName: table name
    /// filters: conditions for filtering data
    /// data: data to add or update
    async fn upsert<T: Serialize>(&self, table_name: &str, filters: Filter, data: &T)
        -> Result<()>;

    /// UpdateOne อัปเดตข้อมูลหนึ่งรายการในตารางตามฟิลเตอร์
    /// tableName: ชื่อตาราง
    /// filters: เงื่อนไขที่ใช้กรองข้อมูล
    /// data: ข้อมูลที่ต้องการอัปเดต
    /// opts: ตัวเลือกเพิ่มเติม
    ///
    /// Update one data item in table based on filter
    /// tableName: table name
    /// filters: conditions for filtering data
    /// data: data to update
    /// opts: additional options
    async fn update_one<T: Serialize>(
        &self,
        table_name: &str,
        filters: Filter,
        data: &T,
        opts: UpdateOptions,
    ) -> Result<()>;

    /// UpdateMany อัปเดตข้อมูลหลายรายการในตารางตามฟิลเตอร์
    /// tableName: ชื่อตาราง
    /// filters: เงื่อนไขที่ใช้กรองข้อมูล
    /// data: ข้อมูลที่ต้องการอัปเดต
    /// opts: ตัวเลือกเพิ่มเติม
    ///
    /// Update multiple data items in table based on filter
    /// tableName: table name
    /// filters: conditions for filtering data
    /// data: data to update
    /// opts: additional options
    async fn update_many<T: Serialize>(
        &self,
        table_name: &str,
        filters: Filter,
        data: &T,
        opts: UpdateOptions,
    ) -> Result<i64>;

    /// Patch อัปเดตเฉพาะบางฟิลด์ของข้อมูลในตารางตามฟิลเตอร์
    /// tableName: ชื่อตาราง
    /// filter: เงื่อนไขที่ใช้กรองข้อมูล
    /// data: ข้อมูลที่ต้องการอัปเดต
    ///
    /// Update specific fields of data in table based on filter
    /// tableName: table name
    /// filter: conditions for filtering data
    /// data: data to update
    async fn patch(
        &self,
        table_name: &str,
        filter: Filter,
        data: HashMap<String, serde_json::Value>,
    ) -> Result<()>;

    /// Delete ลบข้อมูลหนึ่งรายการในตารางตามฟิลเตอร์
    /// tableName: ชื่อตาราง
    /// filter: เงื่อนไขที่ใช้กรองข้อมูล
    ///
    /// Delete one data item in table based on filter
    /// tableName: table name
    /// filter: conditions for filtering data
    async fn delete(&self, table_name: &str, filter: Filter) -> Result<()>;

    /// DeleteMany ลบข้อมูลหลายรายการในตารางตามฟิลเตอร์
    /// tableName: ชื่อตาราง
    /// filter: เงื่อนไขที่ใช้กรองข้อมูล
    ///
    /// Delete multiple data items in table based on filter
    /// tableName: table name
    /// filter: conditions for filtering data
    async fn delete_many(&self, table_name: &str, filter: Filter) -> Result<i64>;

    /// Aggregate ดำเนินการ Aggregate เช่น การนับ (Count), การกรอง (Filter), หรือการคำนวณอื่น ๆ
    /// tableName: ชื่อตาราง
    /// match: เงื่อนไขเริ่มต้นในการกรองข้อมูล
    /// pipeline: ขั้นตอนเพิ่มเติมในกระบวนการ Aggregate
    ///
    /// Perform aggregate operations like count, filter, or other calculations
    /// tableName: table name
    /// match: initial conditions for filtering data
    /// pipeline: additional steps in the aggregate process
    async fn aggregate<T: DeserializeOwned>(
        &self,
        table_name: &str,
        match_filter: Filter,
        pipeline: Vec<AggregateStage>,
    ) -> Result<Vec<T>>;

    /// Disconnected ตัดการเชื่อมต่อจากฐานข้อมูล
    /// Disconnect from database
    async fn disconnect(&self) -> Result<()>;

    /// Ping ตรวจสอบการเชื่อมต่อกับฐานข้อมูล
    /// Check database connection
    async fn ping(&self) -> Result<()>;

    /// BeginTransaction เริ่มต้น transaction
    /// Begin transaction
    async fn begin_transaction(&self) -> Result<Box<dyn TransactionSession>>;
}

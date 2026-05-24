/// โมดูลสำหรับ Response Models
///
/// โมดูลนี้รวมโครงสร้างข้อมูลที่ใช้ในการตอบกลับ API requests
/// รวมถึง error handling, file uploads และ performance monitoring
///
/// ประเภท Response หลัก:
/// - File upload responses และ locations
/// - Error responses พร้อม error codes
/// - Performance monitoring data (request times, sizes)
/// - ETL operation responses
/// - Standard API response arrays

///   โครงสร้างข้อมูล File Upload Location
///
/// ข้อมูลตำแหน่งและรายละเอียดไฟล์ที่อัพโหลดแล้ว
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct UploadResponseLocation {
    #[serde(rename = "filename", skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>, // ชื่อไฟล์
    #[serde(rename = "location", skip_serializing_if = "Option::is_none")]
    pub location: Option<String>, // ตำแหน่งที่ใช้เก็บไฟล์
    #[serde(rename = "url", skip_serializing_if = "Option::is_none")]
    pub url: Option<String>, // url ของไฟล์
    #[serde(rename = "content_type", skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>, // ประเภทไฟล์
    #[serde(rename = "content_length", skip_serializing_if = "Option::is_none")]
    pub content_length: Option<i32>, // ขนาดไฟล์
    #[serde(rename = "response_type", skip_serializing_if = "Option::is_none")]
    pub response_type: Option<String>, // ประเภทไฟล์ response (เช่น response_type_file)
}

// ErrorResponse model info
// @Description Error Response
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ErrorResponse {
    #[serde(rename = "message", skip_serializing_if = "Option::is_none")]
    pub message: Option<String>, // error message
    #[serde(rename = "tag", skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>, // error tag from validate
    #[serde(rename = "value", skip_serializing_if = "Option::is_none")]
    pub value: Option<String>, // value error or expect
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_field: Option<String>, // error type
    #[serde(rename = "code", skip_serializing_if = "Option::is_none")]
    pub code: Option<String>, // error code
}

// RequestTimeMicroseconds model info
// @Description Request Time Microseconds
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct RequestTimeMicroseconds {
    #[serde(rename = "client_to_server_duration")]
    pub client_to_server_duration: i64, // ระยะเวลาที่ client เรียกใช้งาน api จนถึงเวลาก่อนที่ server response to client (ไม่นับรวม server เรียกใช้งาน 3rd api)
    #[serde(rename = "client_to_third_party_duration")]
    pub client_to_third_party_duration: i64, // ระยะเวลาที่ server เรียกใช้งาน 3rd api
}

// ResponseSize model info
// @Description Response Size
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ResponseSize {
    #[serde(rename = "headers")]
    pub headers: i32, // ขนาด header size
    #[serde(rename = "body")]
    pub body: i32, // ขนาด body size
    #[serde(rename = "total")]
    pub total: i32, // ขนาดรวม header + body size
}

// RequestData model info
// @Description Request data
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct RequestData {
    #[serde(rename = "curl")]
    pub curl: String, // ข้อมูล request body แบบ `cURL`
}

// ResponseData model info
// @Description Response data
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ResponseData {
    #[serde(rename = "status_code", skip_serializing_if = "Option::is_none")]
    pub status_code: Option<i32>, // รหัส http code ที่ได้จาก 3rd api หรือ จากระบบ
    #[serde(rename = "headers", skip_serializing_if = "Option::is_none")]
    pub headers: Option<std::collections::HashMap<String, String>>, // headers ที่ได้จาก 3rd api หรือ จากระบบ
    #[serde(rename = "success", skip_serializing_if = "Option::is_none")]
    pub success: Option<Vec<serde_json::Value>>, // response body แบบ success ที่ได้จาก 3rd api ที่อยู่ index 0 เสมอ
    #[serde(rename = "error", skip_serializing_if = "Option::is_none")]
    pub error: Option<serde_json::Value>, // response body แบบ error ที่ได้จาก 3rd api หรือ จากระบบ
    #[serde(rename = "files_uploaded", skip_serializing_if = "Option::is_none")]
    pub files_uploaded: Option<Vec<UploadResponseLocation>>, // file location ที่ได้จากการอัปโหลดไฟล์ request / request body
    #[serde(
        rename = "request_time_microseconds",
        skip_serializing_if = "Option::is_none"
    )]
    pub request_time_microseconds: Option<RequestTimeMicroseconds>, // ระยะเวลาของการ process api นับแต่ถูกเรียกใช้งาน api จนถึง response api
    #[serde(rename = "size_byte", skip_serializing_if = "Option::is_none")]
    pub size_byte: Option<ResponseSize>, // ขนาดของ response body จาก 3rd หน่วยเป็น byte
}

// EtlResponseData model info
// @Description Response data for ETL operations
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct EtlResponseData {
    #[serde(rename = "uuid", skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>, // Data id
    #[serde(rename = "request")]
    pub request: RequestData, // ข้อมูลเกี่ยวกับ request body ที่ client call api เข้ามา
    #[serde(rename = "response")]
    pub response: ResponseData, // ข้อมูลเกี่ยว response body
    #[serde(rename = "ref", skip_serializing_if = "Option::is_none")]
    pub ref_field: Option<String>, // ref สำหรับ webhook api tracking
    #[serde(rename = "app_name")]
    pub app_name: String, // ชื่อแอปที่ได้จาก `X-Token` ไว้สำหรับติดตาม Log
    #[serde(rename = "created_at")]
    pub created_at: chrono::DateTime<chrono::Utc>, // เวลาที่ response ถูกสร้าง in ISO 8601 format
}

// ResponseArray model info
// @Description Response Array
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ResponseArray {
    #[serde(rename = "data", skip_serializing_if = "Option::is_none")]
    pub data: Option<Vec<serde_json::Value>>, // Data response
}

pub const HTTP_RESPONSE_TYPE_FILE: &str = "response_type_file";

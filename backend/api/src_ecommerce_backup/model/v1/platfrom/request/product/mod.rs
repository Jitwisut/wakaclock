/// โมดูล request models สำหรับ product operations
///
/// โมดูลนี้รวมโครงสร้างข้อมูลที่ใช้ในการส่งคำขอ
/// สำหรับการจัดการผลิตภัณฑ์ในแพลตฟอร์มต่างๆ
pub mod sync;

// Re-export commonly used types
pub use sync::{
    ListSyncJobsQuery, PlatformProductPullRequest, ProductExportQuery, ProductListQuery,
    ProductMediaDownloadQuery, ProductMediaUploadRequest, ProductSnapshotQuery,
    ProductSyncLogQuery, ProductSyncReviewQuery, PromoteProductSyncRequest, RealtimeSyncRequest,
    SampleCredentialInput, SampleVectorSyncRequest, SyncProductsRequest, SyncQuery,
    SyncRequestBody, SyncToVectorRequest,
};

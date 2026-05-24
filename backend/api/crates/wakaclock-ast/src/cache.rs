// crates/wakaclock-ast/src/cache.rs
//
// Detection Cache — skip re-parsing ถ้าไฟล์ไม่เปลี่ยน
//
// Key:   (absolute_path, mtime_unix_secs)
// Value: AstResult (language, confidence, dependencies)
//
// ใช้ DashMap เพื่อ thread-safe โดยไม่ต้องล็อค global Mutex
// ขนาด cache จำกัดที่ MAX_ENTRIES — ถ้าเกินจะ evict แบบ random (simple)

use dashmap::DashMap;
use std::sync::OnceLock;
use std::time::SystemTime;

const MAX_ENTRIES: usize = 512;

#[derive(Clone)]
pub struct CachedResult {
    pub language: String,
    pub confidence: f32,
    pub dependencies: Vec<String>,
}

/// Cache key = path + mtime
#[derive(Hash, Eq, PartialEq, Clone)]
struct CacheKey {
    path: String,
    mtime_secs: u64,
}

/// Global cache — สร้างครั้งเดียวตลอด process lifetime
fn cache() -> &'static DashMap<CacheKey, CachedResult> {
    static CACHE: OnceLock<DashMap<CacheKey, CachedResult>> = OnceLock::new();
    CACHE.get_or_init(DashMap::new)
}

/// ดึงผลจาก cache ถ้ามี (path + mtime ตรงกัน)
pub fn get(path: &str) -> Option<CachedResult> {
    let mtime = mtime_of(path)?;
    let key = CacheKey {
        path: path.to_string(),
        mtime_secs: mtime,
    };
    cache().get(&key).map(|v| v.clone())
}

/// บันทึกผลลง cache
pub fn insert(path: &str, result: CachedResult) {
    let mtime = match mtime_of(path) {
        Some(m) => m,
        None => return, // ไม่รู้ mtime → ไม่ cache
    };

    let cache = cache();

    // evict ถ้าเกิน MAX_ENTRIES — เอา key แรกที่เจอออก
    if cache.len() >= MAX_ENTRIES {
        if let Some(old_key) = cache.iter().next().map(|e| e.key().clone()) {
            cache.remove(&old_key);
        }
    }

    let key = CacheKey {
        path: path.to_string(),
        mtime_secs: mtime,
    };
    cache.insert(key, result);
}

/// อ่าน mtime ของไฟล์เป็น unix seconds
fn mtime_of(path: &str) -> Option<u64> {
    std::fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs())
}

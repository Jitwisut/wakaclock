use dashmap::DashMap;
use parking_lot::Mutex;
use std::sync::OnceLock;

const MAX_ENTRIES: usize = 512;

#[derive(Clone)]
pub struct CachedResult {
    pub language: String,
    pub confidence: f32,
    pub dependencies: Vec<String>,
}

/// Cache by the exact source slice that detection sees, not filesystem mtime.
///
/// Editor integrations can analyze unsaved buffers whose on-disk mtime has not changed,
/// while files can also be saved multiple times inside one filesystem timestamp tick.
/// Keeping the bounded parser input in the key makes cache hits exact rather than relying
/// on a probabilistic content hash. At 512 entries × 8 KiB, the worst-case key payload is
/// about 4 MiB per process.
#[derive(Hash, Eq, PartialEq, Clone)]
struct CacheKey {
    entity: String,
    source: Vec<u8>,
}

fn cache() -> &'static DashMap<CacheKey, CachedResult> {
    static CACHE: OnceLock<DashMap<CacheKey, CachedResult>> = OnceLock::new();
    CACHE.get_or_init(DashMap::new)
}

/// Serializes mutations that affect the global size invariant.
///
/// `DashMap` makes each individual operation thread-safe, but the bounded-cache operation is
/// a compound `len -> evict -> insert` transaction. Without a write lock two writers can both
/// observe spare capacity and grow the cache beyond `MAX_ENTRIES`.
fn write_lock() -> &'static Mutex<()> {
    static WRITE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    WRITE_LOCK.get_or_init(|| Mutex::new(()))
}

fn key_for(entity: &str, source: &[u8]) -> CacheKey {
    CacheKey {
        entity: entity.to_string(),
        source: source.to_vec(),
    }
}

pub fn get(entity: &str, source: &[u8]) -> Option<CachedResult> {
    cache()
        .get(&key_for(entity, source))
        .map(|value| value.clone())
}

pub fn insert(entity: &str, source: &[u8], result: CachedResult) {
    let key = key_for(entity, source);
    let _guard = write_lock().lock();
    let cache = cache();

    // Updating an existing exact key cannot increase the cache size, so avoid evicting an
    // unrelated entry in that case.
    if cache.contains_key(&key) {
        cache.insert(key, result);
        return;
    }

    if cache.len() >= MAX_ENTRIES {
        // Clone the key while the iterator guard is alive, then drop that guard before remove.
        // Holding a DashMap shard guard across remove can deadlock when both touch one shard.
        let old_key = { cache.iter().next().map(|entry| entry.key().clone()) };
        if let Some(old_key) = old_key {
            cache.remove(&old_key);
        }
    }

    cache.insert(key, result);
    debug_assert!(cache.len() <= MAX_ENTRIES);
}

#[cfg(test)]
pub fn clear_for_tests() {
    let _guard = write_lock().lock();
    cache().clear();
}

#[cfg(test)]
pub fn len_for_tests() -> usize {
    let _guard = write_lock().lock();
    cache().len()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Barrier};

    fn result(language: &str) -> CachedResult {
        CachedResult {
            language: language.to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }
    }

    #[test]
    fn cache_is_keyed_by_source_content() {
        clear_for_tests();
        insert("main.rs", b"fn one() {}", result("Rust"));

        assert!(get("main.rs", b"fn one() {}").is_some());
        assert!(get("main.rs", b"fn two() {}").is_none());
    }

    #[test]
    fn cache_is_bounded() {
        clear_for_tests();
        for index in 0..(MAX_ENTRIES + 32) {
            let entity = format!("file-{index}.rs");
            let source = format!("fn item_{index}() {{}}");
            insert(&entity, source.as_bytes(), result("Rust"));
        }

        assert!(len_for_tests() <= MAX_ENTRIES);
    }

    #[test]
    fn concurrent_writers_preserve_the_bound() {
        clear_for_tests();
        const WRITERS: usize = 8;
        const INSERTS_PER_WRITER: usize = 160;
        let start = Arc::new(Barrier::new(WRITERS));

        let workers: Vec<_> = (0..WRITERS)
            .map(|writer| {
                let start = Arc::clone(&start);
                std::thread::spawn(move || {
                    start.wait();
                    for index in 0..INSERTS_PER_WRITER {
                        let entity = format!("writer-{writer}-file-{index}.rs");
                        let source = format!("fn item_{writer}_{index}() {{}}");
                        insert(&entity, source.as_bytes(), result("Rust"));
                    }
                })
            })
            .collect();

        for worker in workers {
            worker.join().expect("cache writer thread should not panic");
        }

        assert!(len_for_tests() <= MAX_ENTRIES);
    }
}

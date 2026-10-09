pub mod ai;
pub mod api_client;
pub mod broker;
pub mod config;
pub mod error;
pub mod git;
pub mod heartbeat;
pub mod project;
pub mod queue;
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_set() {
        assert!(!version().is_empty());
    }
}

pub mod session_context;

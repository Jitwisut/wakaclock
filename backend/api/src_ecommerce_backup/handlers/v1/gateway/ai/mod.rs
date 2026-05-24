//! Gateway AI routes
//!
//! Provides routing helpers for the AI specific endpoints that expose
//! embedding, completion, chat and vector synchronisation capabilities.

pub mod handler;

pub use handler::AiHandler;

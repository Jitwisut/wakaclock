//! Shared AtoAxis server modules.
//!
//! Keeping the live modules in a library target lets the HTTP API, outbox relay,
//! and background workers use the same configuration, repositories, and domain
//! services without duplicating the module tree in each binary.

pub mod config;
pub mod handlers;
pub mod helpers;
pub mod infrastructure;
pub mod middleware;
pub mod model;
pub mod repository;
pub mod services;

#[cfg(test)]
pub mod test_support;

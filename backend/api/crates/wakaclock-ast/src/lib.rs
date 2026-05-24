// crates/wakaclock-ast/src/lib.rs

mod cache;
mod detector;
mod languages;
mod pool;

pub use detector::{detect, AstResult};

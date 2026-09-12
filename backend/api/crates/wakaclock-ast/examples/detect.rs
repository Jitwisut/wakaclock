//! Manual smoke-test tool for `wakaclock-ast`.
//!
//! Prints what `detect_file` would put on a heartbeat for the given path(s) —
//! useful for trying real files without spinning up the CLI, the extension,
//! or a server. Not part of the crate's public surface or CI; a development
//! aid only.
//!
//! Usage (from `backend/api`):
//!   cargo run -p wakaclock-ast --example detect -- path/to/file.swift [more files...]

use std::env;
use std::path::PathBuf;

fn main() {
    let paths: Vec<PathBuf> = env::args().skip(1).map(PathBuf::from).collect();

    if paths.is_empty() {
        eprintln!("usage: cargo run -p wakaclock-ast --example detect -- <file> [file...]");
        std::process::exit(1);
    }

    for path in paths {
        print!("{}: ", path.display());
        match wakaclock_ast::detect_file(&path) {
            Ok(Some(result)) => {
                println!("{} (confidence {:.2})", result.language, result.confidence);
                if !result.dependencies.is_empty() {
                    println!("  dependencies: {}", result.dependencies.join(", "));
                }
            }
            Ok(None) => println!("no detection (unsupported extension or low-confidence match)"),
            Err(err) => println!("error reading file: {err}"),
        }
    }
}

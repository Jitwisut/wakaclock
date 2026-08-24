use crate::cache::{self, CachedResult};
use crate::languages::{candidates_for, looks_like_objective_c};
use crate::pool::with_parsed_tree;
use std::path::Path;
use std::time::{Duration, Instant};
use tracing::debug;

const MAX_SOURCE_BYTES: usize = 8 * 1024;
const DETECTION_BUDGET: Duration = Duration::from_millis(50);

pub struct AstResult {
    pub language: String,
    pub confidence: f32,
    pub dependencies: Vec<String>,
}

pub fn detect(entity: &str, source: &[u8]) -> Option<AstResult> {
    if let Some(cached) = cache::get(entity) {
        return Some(AstResult {
            language: cached.language,
            confidence: cached.confidence,
            dependencies: cached.dependencies,
        });
    }

    if let Some(static_result) = detect_static_asset(entity, source) {
        cache::insert(
            entity,
            CachedResult {
                language: static_result.language.clone(),
                confidence: static_result.confidence,
                dependencies: static_result.dependencies.clone(),
            },
        );
        return Some(static_result);
    }

    let started_at = Instant::now();
    let source = truncate_source(source);
    let candidates = candidates_for(entity, source);
    if candidates.is_empty() {
        return None;
    }

    let mut best: Option<AstResult> = None;
    let extensionless = Path::new(entity).extension().is_none();

    for (index, (lang_name, language)) in candidates.iter().enumerate() {
        if index > 0 && started_at.elapsed() >= DETECTION_BUDGET && best.is_some() {
            debug!(
                entity,
                elapsed_ms = started_at.elapsed().as_millis(),
                winner = best
                    .as_ref()
                    .map(|value| value.language.as_str())
                    .unwrap_or(""),
                "ast detection budget reached; returning best-so-far"
            );
            break;
        }

        let candidate_started_at = Instant::now();
        let result: Option<(f32, Vec<String>)> =
            with_parsed_tree(lang_name, language, source, |root| {
                let total = count_nodes(root);
                let errors = count_errors(root);
                let mut confidence = if total == 0 {
                    0.0
                } else {
                    1.0 - (errors as f32 / total as f32)
                };

                if *lang_name == "Objective-C" && looks_like_objective_c(source) {
                    confidence = (confidence + 0.15).min(1.0);
                }

                let deps = extract_dependencies(root, source, lang_name);
                (confidence, deps)
            });

        if let Some((confidence, deps)) = result {
            debug!(
                entity,
                candidate = *lang_name,
                candidate_ms = candidate_started_at.elapsed().as_millis(),
                confidence,
                "ast candidate evaluated"
            );

            let is_better = best
                .as_ref()
                .map(|current| confidence > current.confidence)
                .unwrap_or(true);

            if is_better {
                best = Some(AstResult {
                    language: (*lang_name).to_string(),
                    confidence,
                    dependencies: deps,
                });
            }
        }
    }

    if extensionless {
        if source_lacks_signal(source) {
            return None;
        }
        if best.as_ref().is_some_and(|result| result.confidence < 0.6) {
            return None;
        }
    }

    if let Some(ref result) = best {
        cache::insert(
            entity,
            CachedResult {
                language: result.language.clone(),
                confidence: result.confidence,
                dependencies: result.dependencies.clone(),
            },
        );

        debug!(
            entity,
            winner = result.language.as_str(),
            confidence = result.confidence,
            elapsed_ms = started_at.elapsed().as_millis(),
            "ast detection completed"
        );
    }

    best
}

fn detect_static_asset(entity: &str, source: &[u8]) -> Option<AstResult> {
    let file_name = Path::new(entity)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let ext = Path::new(entity)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if file_name == ".env" || file_name.starts_with(".env.") {
        return Some(AstResult {
            language: "Env".to_string(),
            confidence: 1.0,
            dependencies: extract_env_dependencies(source),
        });
    }

    match file_name.as_str() {
        "dockerfile" => {
            return Some(AstResult {
                language: "Dockerfile".to_string(),
                confidence: 1.0,
                dependencies: extract_dockerfile_dependencies(source),
            });
        }
        "makefile" | "justfile" => {
            return Some(AstResult {
                language: "Makefile".to_string(),
                confidence: 1.0,
                dependencies: extract_makefile_dependencies(source),
            });
        }
        _ => {}
    }

    match ext.as_str() {
        "html" | "htm" => Some(AstResult {
            language: "HTML".to_string(),
            confidence: 1.0,
            dependencies: extract_html_dependencies(source),
        }),
        "css" => Some(AstResult {
            language: "CSS".to_string(),
            confidence: 1.0,
            dependencies: extract_css_dependencies(source),
        }),
        "yaml" | "yml" => Some(AstResult {
            language: "YAML".to_string(),
            confidence: 1.0,
            dependencies: extract_yaml_dependencies(source),
        }),
        "md" | "markdown" => Some(AstResult {
            language: "Markdown".to_string(),
            confidence: 1.0,
            dependencies: extract_markdown_dependencies(source),
        }),
        "txt" | "text" => Some(AstResult {
            language: "Text".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "json" => Some(AstResult {
            language: "JSON".to_string(),
            confidence: 1.0,
            dependencies: extract_json_dependencies(source),
        }),
        "toml" => Some(AstResult {
            language: "TOML".to_string(),
            confidence: 1.0,
            dependencies: extract_toml_dependencies(source),
        }),
        "ini" | "cfg" | "conf" => Some(AstResult {
            language: "INI".to_string(),
            confidence: 1.0,
            dependencies: extract_ini_dependencies(source),
        }),
        "xml" | "svg" => Some(AstResult {
            language: "XML".to_string(),
            confidence: 1.0,
            dependencies: extract_xml_dependencies(source),
        }),
        "sh" | "bash" | "zsh" => Some(AstResult {
            language: "Shell".to_string(),
            confidence: 1.0,
            dependencies: extract_shell_dependencies(source),
        }),
        _ => None,
    }
}

fn truncate_source(source: &[u8]) -> &[u8] {
    if source.len() > MAX_SOURCE_BYTES {
        &source[..MAX_SOURCE_BYTES]
    } else {
        source
    }
}

fn source_lacks_signal(source: &[u8]) -> bool {
    !source.iter().any(|byte| byte.is_ascii_alphabetic())
}

fn count_nodes(node: tree_sitter::Node) -> usize {
    let mut count = 1;
    let mut cursor = node.walk();
    if cursor.goto_first_child() {
        loop {
            count += count_nodes(cursor.node());
            if !cursor.goto_next_sibling() {
                break;
            }
        }
    }
    count
}

fn count_errors(node: tree_sitter::Node) -> usize {
    let mut count = if node.is_error() { 1 } else { 0 };
    let mut cursor = node.walk();
    if cursor.goto_first_child() {
        loop {
            count += count_errors(cursor.node());
            if !cursor.goto_next_sibling() {
                break;
            }
        }
    }
    count
}

fn walk_tree<F: FnMut(tree_sitter::Node)>(node: tree_sitter::Node, f: &mut F) {
    f(node);
    let mut cursor = node.walk();
    if cursor.goto_first_child() {
        loop {
            walk_tree(cursor.node(), f);
            if !cursor.goto_next_sibling() {
                break;
            }
        }
    }
}

fn extract_dependencies(root: tree_sitter::Node, source: &[u8], lang: &str) -> Vec<String> {
    let mut deps = match lang {
        "Rust" => extract_rust(root, source),
        "Python" => extract_python(root, source),
        "JavaScript" => extract_js(root, source),
        "TypeScript" | "TSX" => extract_ts(root, source),
        "Go" => extract_go(root, source),
        "C" | "C++" => extract_c(root, source),
        "Objective-C" => extract_objective_c(root, source),
        _ => vec![],
    };
    deps.sort();
    deps.dedup();
    deps
}

fn extract_rust(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| match node.kind() {
        "use_declaration" => {
            if let Some(arg) = node.child_by_field_name("argument") {
                if let Some(text) = node_text(arg, source) {
                    let top = text.split("::").next().unwrap_or(text).trim();
                    if !top.is_empty() && !matches!(top, "crate" | "self" | "super") {
                        deps.push(top.to_string());
                    }
                }
            }
        }
        "extern_crate_declaration" => {
            for i in 0..node.child_count() {
                let Some(child) = node.child(i) else {
                    continue;
                };
                if child.kind() == "identifier" {
                    if let Some(text) = node_text(child, source) {
                        deps.push(text.to_string());
                    }
                }
            }
        }
        _ => {}
    });
    deps
}

fn extract_python(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| match node.kind() {
        "import_statement" => {
            for i in 0..node.child_count() {
                let Some(child) = node.child(i) else {
                    continue;
                };
                if matches!(child.kind(), "dotted_name" | "aliased_import") {
                    let target = if child.kind() == "aliased_import" {
                        child.child(0).unwrap_or(child)
                    } else {
                        child
                    };
                    if let Some(text) = node_text(target, source) {
                        let top = text.split('.').next().unwrap_or(text).trim();
                        deps.push(top.to_string());
                    }
                }
            }
        }
        "import_from_statement" => {
            if let Some(module) = node.child_by_field_name("module_name") {
                if let Some(text) = node_text(module, source) {
                    let trimmed = text.trim_start_matches('.');
                    if !trimmed.is_empty() {
                        let top = trimmed.split('.').next().unwrap_or(trimmed).trim();
                        deps.push(top.to_string());
                    }
                }
            }
        }
        _ => {}
    });
    deps
}

fn extract_js(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| match node.kind() {
        "import_statement" => {
            if let Some(src) = node.child_by_field_name("source") {
                if let Some(text) = string_content(src, source) {
                    deps.push(strip_path_specifier(text));
                }
            }
        }
        "call_expression" => {
            if let Some(func) = node.child_by_field_name("function") {
                if node_text(func, source) == Some("require") {
                    if let Some(args) = node.child_by_field_name("arguments") {
                        for i in 0..args.child_count() {
                            let Some(arg) = args.child(i) else {
                                continue;
                            };
                            if arg.kind() == "string" {
                                if let Some(text) = string_content(arg, source) {
                                    deps.push(strip_path_specifier(text));
                                }
                            }
                        }
                    }
                }
            }
        }
        _ => {}
    });
    deps
}

fn extract_ts(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    extract_js(root, source)
}

fn extract_go(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        if node.kind() == "import_spec" {
            if let Some(path_node) = node.child_by_field_name("path") {
                if let Some(text) = string_content(path_node, source) {
                    let last = text.split('/').next_back().unwrap_or(text).trim();
                    deps.push(last.to_string());
                }
            }
        }
    });
    deps
}

fn extract_c(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        if node.kind() == "preproc_include" {
            for i in 0..node.child_count() {
                let Some(child) = node.child(i) else {
                    continue;
                };
                if matches!(child.kind(), "system_lib_string" | "string_literal") {
                    if let Some(raw) = node_text(child, source) {
                        let clean = raw.trim_matches(|ch| ch == '<' || ch == '>' || ch == '"');
                        deps.push(clean.to_string());
                    }
                }
            }
        }
    });
    deps
}

fn extract_objective_c(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = extract_c(root, source);
    for line in String::from_utf8_lossy(source).lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("#import ") {
            let module = rest
                .trim()
                .trim_matches(|ch| ch == '<' || ch == '>' || ch == '"');
            if !module.is_empty() {
                deps.push(module.to_string());
            }
        }
        if let Some(rest) = trimmed.strip_prefix("@import ") {
            let module = rest
                .trim_end_matches(';')
                .split('.')
                .next()
                .unwrap_or(rest)
                .trim();
            if !module.is_empty() {
                deps.push(module.to_string());
            }
        }
    }
    deps
}

fn node_text<'a>(node: tree_sitter::Node, source: &'a [u8]) -> Option<&'a str> {
    node.utf8_text(source).ok()
}

fn string_content<'a>(node: tree_sitter::Node, source: &'a [u8]) -> Option<&'a str> {
    let raw = node_text(node, source)?;
    let inner = raw.trim_matches(|ch| ch == '\'' || ch == '"');
    if inner.is_empty() {
        None
    } else {
        Some(inner)
    }
}

fn strip_path_specifier(path: &str) -> String {
    if path.starts_with('.') {
        path.split('/').next_back().unwrap_or(path).to_string()
    } else if path.starts_with('@') {
        let parts: Vec<&str> = path.splitn(3, '/').collect();
        parts[..2.min(parts.len())].join("/")
    } else {
        path.split('/').next().unwrap_or(path).to_string()
    }
}

fn extract_html_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for marker in ["src=\"", "src='", "href=\"", "href='"] {
        let mut rest = text.as_ref();
        while let Some(index) = rest.find(marker) {
            let tail = &rest[index + marker.len()..];
            let Some(end) = tail.find(['"', '\'']) else {
                break;
            };
            let value = tail[..end].trim();
            if !value.is_empty() {
                deps.push(value.to_string());
            }
            rest = &tail[end..];
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_css_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for marker in ["@import \"", "@import '", "url(\"", "url('"] {
        let mut rest = text.as_ref();
        while let Some(index) = rest.find(marker) {
            let tail = &rest[index + marker.len()..];
            let Some(end) = tail.find(['"', '\'']) else {
                break;
            };
            let value = tail[..end].trim();
            if !value.is_empty() {
                deps.push(value.to_string());
            }
            rest = &tail[end..];
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_yaml_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('-') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once(':') {
            let key = key.trim();
            if !key.is_empty() {
                deps.push(key.to_string());
            }

            let value = value.trim().trim_matches(|ch| ch == '"' || ch == '\'');
            if looks_like_external_reference(value) {
                deps.push(value.to_string());
            }
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_markdown_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for marker in ["](", "![", "<http", "<https"] {
        if marker == "](" {
            let mut rest = text.as_ref();
            while let Some(index) = rest.find(marker) {
                let tail = &rest[index + marker.len()..];
                let Some(end) = tail.find(')') else {
                    break;
                };
                let value = tail[..end].trim();
                if !value.is_empty() {
                    deps.push(value.to_string());
                }
                rest = &tail[end + 1..];
            }
        }
    }

    let mut rest = text.as_ref();
    while let Some(index) = rest.find('<') {
        let tail = &rest[index + 1..];
        let Some(end) = tail.find('>') else {
            break;
        };
        let value = tail[..end].trim();
        if looks_like_external_reference(value) {
            deps.push(value.to_string());
        }
        rest = &tail[end + 1..];
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_env_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            let key = key.trim();
            if !key.is_empty() {
                deps.push(key.to_string());
            }

            let value = value.trim().trim_matches(|ch| ch == '"' || ch == '\'');
            if looks_like_external_reference(value) {
                deps.push(value.to_string());
            }
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

fn looks_like_external_reference(value: &str) -> bool {
    !value.is_empty()
        && (value.starts_with("http://")
            || value.starts_with("https://")
            || value.starts_with('/')
            || value.contains('.'))
}

fn extract_json_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();
    let bytes = text.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] != b'"' {
            index += 1;
            continue;
        }

        let rest = &text[index + 1..];
        let Some(end_quote) = rest.find('"') else {
            break;
        };
        let token = &rest[..end_quote];
        let after = &rest[end_quote + 1..];
        if after.trim_start().starts_with(':') && !token.is_empty() {
            deps.push(token.to_string());
        }
        index += end_quote + 2;
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_toml_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            deps.push(
                trimmed
                    .trim_matches(|ch| ch == '[' || ch == ']')
                    .to_string(),
            );
            continue;
        }

        if let Some((key, _)) = trimmed.split_once('=') {
            let key = key.trim();
            if !key.is_empty() {
                deps.push(key.to_string());
            }
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_ini_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(';') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            deps.push(
                trimmed
                    .trim_matches(|ch| ch == '[' || ch == ']')
                    .to_string(),
            );
            continue;
        }

        if let Some((key, _)) = trimmed.split_once('=') {
            let key = key.trim();
            if !key.is_empty() {
                deps.push(key.to_string());
            }
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_xml_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();
    let bytes = text.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] != b'<' {
            index += 1;
            continue;
        }

        let rest = &text[index + 1..];
        let Some(end) = rest.find([' ', '>', '/']) else {
            break;
        };
        let token = &rest[..end];
        if !token.is_empty() && !token.starts_with('?') && !token.starts_with('!') {
            deps.push(token.to_string());
        }
        index += end + 1;
    }

    for marker in ["href=\"", "href='", "src=\"", "src='"] {
        let mut rest = text.as_ref();
        while let Some(index) = rest.find(marker) {
            let tail = &rest[index + marker.len()..];
            let Some(end) = tail.find(['"', '\'']) else {
                break;
            };
            let value = tail[..end].trim();
            if !value.is_empty() {
                deps.push(value.to_string());
            }
            rest = &tail[end..];
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_shell_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some(command) = trimmed.split_whitespace().next() {
            if !command.is_empty()
                && !command.contains('=')
                && !command.starts_with('$')
                && !matches!(command, "then" | "do" | "fi" | "done" | "else" | "elif")
            {
                deps.push(command.to_string());
            }
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_dockerfile_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let upper = trimmed.to_ascii_uppercase();
        if upper.starts_with("FROM ") {
            let image = trimmed[5..].split_whitespace().next().unwrap_or("").trim();
            if !image.is_empty() {
                deps.push(image.to_string());
            }
            continue;
        }

        if upper.starts_with("COPY ") || upper.starts_with("ADD ") {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                deps.push(parts[1].to_string());
            }
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

fn extract_makefile_dependencies(source: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(source);
    let mut deps = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some((target, _)) = trimmed.split_once(':') {
            let target = target.trim();
            if !target.is_empty() && !target.contains('=') {
                deps.push(target.to_string());
            }
            continue;
        }

        if let Some((key, _)) = trimmed.split_once('=') {
            let key = key.trim();
            if !key.is_empty() {
                deps.push(key.to_string());
            }
        }
    }

    deps.sort();
    deps.dedup();
    deps
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_rust_and_extracts_dependencies() {
        let src =
            b"use std::collections::HashMap;\nuse serde::{Serialize, Deserialize};\nfn main() {}";
        let result = detect("main.rs", src).unwrap();
        assert_eq!(result.language, "Rust");
        assert!(result.confidence > 0.9);
        assert!(result.dependencies.contains(&"std".to_string()));
        assert!(result.dependencies.contains(&"serde".to_string()));
    }

    #[test]
    fn detects_extensionless_python_from_shebang() {
        let src = b"#!/usr/bin/env python\nimport os\nfrom pathlib import Path\n";
        let result = detect("script-without-ext", src).unwrap();
        assert_eq!(result.language, "Python");
        assert!(result.dependencies.contains(&"os".to_string()));
        assert!(result.dependencies.contains(&"pathlib".to_string()));
    }

    #[test]
    fn detects_extensionless_javascript_from_shebang() {
        let src = b"#!/usr/bin/env node\nconst next = require('next');\n";
        let result = detect("node-script", src).unwrap();
        assert_eq!(result.language, "JavaScript");
        assert!(result.dependencies.contains(&"next".to_string()));
    }

    #[test]
    fn prefers_objective_c_for_objc_header_markers() {
        let src =
            b"#import <Foundation/Foundation.h>\n@interface ViewController : NSObject\n@end\n";
        let result = detect("ViewController.h", src).unwrap();
        assert_eq!(result.language, "Objective-C");
        assert!(result
            .dependencies
            .contains(&"Foundation/Foundation.h".to_string()));
    }

    #[test]
    fn detects_typescript_and_extracts_dependencies() {
        let src = b"import { useState } from 'react';\nimport axios from 'axios';\n";
        let result = detect("app.ts", src).unwrap();
        assert_eq!(result.language, "TypeScript");
        assert!(result.dependencies.contains(&"react".to_string()));
        assert!(result.dependencies.contains(&"axios".to_string()));
    }

    #[test]
    fn cache_returns_same_result() {
        let src = b"use tokio::runtime::Runtime;\nfn main() {}";
        let first = detect("tokio_test.rs", src).unwrap();
        let second = detect("tokio_test.rs", src).unwrap();
        assert_eq!(first.language, second.language);
        assert_eq!(first.dependencies, second.dependencies);
    }

    #[test]
    fn large_files_are_truncated_but_still_detected() {
        let mut src = b"#!/usr/bin/env python\nimport os\n".to_vec();
        src.extend(std::iter::repeat_n(b'#', MAX_SOURCE_BYTES + 128));
        let result = detect("big-script", &src).unwrap();
        assert_eq!(result.language, "Python");
    }

    #[test]
    fn low_confidence_extensionless_content_returns_none() {
        let src = b"{}[]\n<>\n";
        assert!(detect("unknown-file", src).is_none());
    }

    #[test]
    fn detects_css_without_falling_back_to_objective_c() {
        let src = b"@import url('https://fonts.googleapis.com/css2?family=Inter');\nbody { color: red; }\n";
        let result = detect("profile.css", src).unwrap();
        assert_eq!(result.language, "CSS");
        assert!(result
            .dependencies
            .iter()
            .any(|dep| dep.contains("fonts.googleapis.com")));
    }

    #[test]
    fn detects_html_as_static_asset() {
        let src = b"<html><head><link href=\"/styles/app.css\"></head><body><script src=\"/app.js\"></script></body></html>";
        let result = detect("index.html", src).unwrap();
        assert_eq!(result.language, "HTML");
        assert!(result.dependencies.contains(&"/styles/app.css".to_string()));
        assert!(result.dependencies.contains(&"/app.js".to_string()));
    }

    #[test]
    fn detects_yaml_as_static_asset() {
        let src = b"version: '3'\nservices:\n  app:\n    image: example/app:latest\n";
        let result = detect("docker-compose.yml", src).unwrap();
        assert_eq!(result.language, "YAML");
        assert!(result.dependencies.contains(&"version".to_string()));
        assert!(result.dependencies.contains(&"services".to_string()));
    }

    #[test]
    fn detects_markdown_as_static_asset() {
        let src = b"# Hello\nSee [docs](https://example.com/docs)\n";
        let result = detect("README.md", src).unwrap();
        assert_eq!(result.language, "Markdown");
        assert!(result
            .dependencies
            .contains(&"https://example.com/docs".to_string()));
    }

    #[test]
    fn detects_dotenv_as_static_asset() {
        let src = b"API_URL=https://example.com\nTOKEN=abc123\n";
        let result = detect(".env", src).unwrap();
        assert_eq!(result.language, "Env");
        assert!(result.dependencies.contains(&"API_URL".to_string()));
        assert!(result
            .dependencies
            .contains(&"https://example.com".to_string()));
    }

    #[test]
    fn detects_text_files_as_static_asset() {
        let src = b"plain text note\n";
        let result = detect("notes.txt", src).unwrap();
        assert_eq!(result.language, "Text");
    }

    #[test]
    fn detects_json_as_static_asset() {
        let src = b"{\"name\":\"demo\",\"version\":\"1.0.0\",\"scripts\":{\"dev\":\"vite\"}}";
        let result = detect("package.json", src).unwrap();
        assert_eq!(result.language, "JSON");
        assert!(result.dependencies.contains(&"name".to_string()));
        assert!(result.dependencies.contains(&"scripts".to_string()));
    }

    #[test]
    fn detects_toml_as_static_asset() {
        let src = b"[package]\nname = \"demo\"\nversion = \"0.1.0\"\n";
        let result = detect("Cargo.toml", src).unwrap();
        assert_eq!(result.language, "TOML");
        assert!(result.dependencies.contains(&"package".to_string()));
        assert!(result.dependencies.contains(&"name".to_string()));
    }

    #[test]
    fn detects_ini_as_static_asset() {
        let src = b"[server]\nport=8080\nhost=localhost\n";
        let result = detect("app.ini", src).unwrap();
        assert_eq!(result.language, "INI");
        assert!(result.dependencies.contains(&"server".to_string()));
        assert!(result.dependencies.contains(&"port".to_string()));
    }

    #[test]
    fn detects_xml_as_static_asset() {
        let src = b"<svg><use href=\"/icons.svg#x\" /></svg>";
        let result = detect("icon.svg", src).unwrap();
        assert_eq!(result.language, "XML");
        assert!(result.dependencies.contains(&"svg".to_string()));
        assert!(result.dependencies.contains(&"/icons.svg#x".to_string()));
    }

    #[test]
    fn detects_shell_as_static_asset() {
        let src = b"#!/bin/bash\nnpm install\ncargo check\n";
        let result = detect("build.sh", src).unwrap();
        assert_eq!(result.language, "Shell");
        assert!(result.dependencies.contains(&"npm".to_string()));
        assert!(result.dependencies.contains(&"cargo".to_string()));
    }

    #[test]
    fn detects_dockerfile_as_static_asset() {
        let src = b"FROM node:20-alpine\nCOPY package.json ./\n";
        let result = detect("Dockerfile", src).unwrap();
        assert_eq!(result.language, "Dockerfile");
        assert!(result.dependencies.contains(&"node:20-alpine".to_string()));
    }

    #[test]
    fn detects_makefile_as_static_asset() {
        let src = b"build:\n\tcargo build\n\nPORT=8080\n";
        let result = detect("Makefile", src).unwrap();
        assert_eq!(result.language, "Makefile");
        assert!(result.dependencies.contains(&"build".to_string()));
        assert!(result.dependencies.contains(&"PORT".to_string()));
    }
}

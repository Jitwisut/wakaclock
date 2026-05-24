use std::path::Path;
use tree_sitter::Language;

pub type Candidate = (&'static str, Language);

pub fn candidates_for(entity: &str, source: &[u8]) -> Vec<Candidate> {
    let path = Path::new(entity);
    let ext = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let mut candidates = if ext.is_empty() {
        candidates_for_extensionless(path.file_name().and_then(|value| value.to_str()), source)
    } else {
        candidates_for_extension(&ext)
    };

    if looks_like_objective_c(source) {
        prepend_unique(
            &mut candidates,
            ("Objective-C", tree_sitter_c::LANGUAGE.into()),
        );
    }

    candidates
}

pub fn candidates_for_extension(ext: &str) -> Vec<Candidate> {
    match ext {
        "rs" => vec![("Rust", tree_sitter_rust::LANGUAGE.into())],
        "py" | "pyw" => vec![("Python", tree_sitter_python::LANGUAGE.into())],
        "js" | "mjs" | "cjs" => vec![("JavaScript", tree_sitter_javascript::LANGUAGE.into())],
        "jsx" => vec![("JavaScript", tree_sitter_javascript::LANGUAGE.into())],
        "ts" => vec![(
            "TypeScript",
            tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
        )],
        "tsx" => vec![("TSX", tree_sitter_typescript::LANGUAGE_TSX.into())],
        "go" => vec![("Go", tree_sitter_go::LANGUAGE.into())],
        "c" => vec![("C", tree_sitter_c::LANGUAGE.into())],
        "m" | "mm" => vec![
            ("Objective-C", tree_sitter_c::LANGUAGE.into()),
            ("C", tree_sitter_c::LANGUAGE.into()),
        ],
        "cpp" | "cc" | "cxx" | "c++" => vec![("C++", tree_sitter_cpp::LANGUAGE.into())],
        "h" | "hh" => vec![
            ("Objective-C", tree_sitter_c::LANGUAGE.into()),
            ("C++", tree_sitter_cpp::LANGUAGE.into()),
            ("C", tree_sitter_c::LANGUAGE.into()),
        ],
        "hpp" | "hxx" => vec![("C++", tree_sitter_cpp::LANGUAGE.into())],
        _ => vec![],
    }
}

fn candidates_for_extensionless(file_name: Option<&str>, source: &[u8]) -> Vec<Candidate> {
    if let Some(from_name) = candidates_for_special_filename(file_name) {
        return from_name;
    }

    if let Some(from_shebang) = candidates_for_shebang(source) {
        return from_shebang;
    }

    let mut candidates = vec![
        ("Python", tree_sitter_python::LANGUAGE.into()),
        ("JavaScript", tree_sitter_javascript::LANGUAGE.into()),
        (
            "TypeScript",
            tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
        ),
        ("Go", tree_sitter_go::LANGUAGE.into()),
        ("Rust", tree_sitter_rust::LANGUAGE.into()),
        ("C", tree_sitter_c::LANGUAGE.into()),
        ("C++", tree_sitter_cpp::LANGUAGE.into()),
    ];

    if looks_like_objective_c(source) {
        prepend_unique(
            &mut candidates,
            ("Objective-C", tree_sitter_c::LANGUAGE.into()),
        );
    }

    candidates
}

fn candidates_for_special_filename(file_name: Option<&str>) -> Option<Vec<Candidate>> {
    match file_name.unwrap_or("") {
        "Dockerfile" => Some(vec![(
            "Dockerfile",
            tree_sitter_javascript::LANGUAGE.into(),
        )]),
        "Makefile" | "makefile" | "Justfile" | "justfile" => {
            Some(vec![("Makefile", tree_sitter_c::LANGUAGE.into())])
        }
        _ => None,
    }
}

fn candidates_for_shebang(source: &[u8]) -> Option<Vec<Candidate>> {
    let line = first_line(source)?;
    let shebang = line.strip_prefix("#!")?;

    if shebang.contains("python") {
        return Some(vec![("Python", tree_sitter_python::LANGUAGE.into())]);
    }
    if shebang.contains("ts-node") {
        return Some(vec![(
            "TypeScript",
            tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
        )]);
    }
    if shebang.contains("node") || shebang.contains("deno") || shebang.contains("bun") {
        return Some(vec![(
            "JavaScript",
            tree_sitter_javascript::LANGUAGE.into(),
        )]);
    }

    None
}

pub fn looks_like_objective_c(source: &[u8]) -> bool {
    let text = String::from_utf8_lossy(source);
    let indicators = [
        "@interface",
        "@implementation",
        "@protocol",
        "@property",
        "@autoreleasepool",
        "#import ",
        "@import ",
        "[super ",
        "[self ",
    ];

    indicators.iter().any(|indicator| text.contains(indicator))
}

fn prepend_unique(candidates: &mut Vec<Candidate>, candidate: Candidate) {
    if candidates.iter().any(|(name, _)| *name == candidate.0) {
        return;
    }
    candidates.insert(0, candidate);
}

fn first_line(source: &[u8]) -> Option<&str> {
    let line = source.split(|byte| *byte == b'\n').next()?;
    std::str::from_utf8(line).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn h_headers_include_objective_c_candidate() {
        let candidates =
            candidates_for("ViewController.h", b"@interface ViewController : NSObject");
        let names: Vec<&str> = candidates.iter().map(|(name, _)| *name).collect();
        assert!(names.contains(&"Objective-C"));
        assert!(names.contains(&"C"));
        assert!(names.contains(&"C++"));
    }

    #[test]
    fn extensionless_python_uses_shebang() {
        let candidates = candidates_for("script", b"#!/usr/bin/env python\nprint('hi')\n");
        assert_eq!(candidates[0].0, "Python");
    }
}

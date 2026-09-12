use std::path::Path;
use tree_sitter::Language;

pub type Candidate = (&'static str, Language);

pub fn candidates_for(entity: &str, source: &[u8]) -> Vec<Candidate> {
    let path = Path::new(entity);

    // `CMakeLists.txt` is CMake's near-universal project-file name and has a
    // `.txt` extension, which `detect_static_asset` (detector.rs) would
    // otherwise claim as plain Text before this function ever runs — see the
    // matching filename guard there.
    if path
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case("CMakeLists.txt"))
    {
        let mut candidates = vec![("CMake", tree_sitter_cmake::LANGUAGE.into())];
        if looks_like_objective_c(source) {
            prepend_unique(
                &mut candidates,
                ("Objective-C", tree_sitter_c::LANGUAGE.into()),
            );
        }
        return candidates;
    }

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
        "swift" => vec![("Swift", tree_sitter_swift::LANGUAGE.into())],
        "java" => vec![("Java", tree_sitter_java::LANGUAGE.into())],
        "kt" | "kts" => vec![("Kotlin", tree_sitter_kotlin_ng::LANGUAGE.into())],
        // `tree_sitter_dart::language()` returns a `Language` directly (older
        // binding style, predates the `LanguageFn`/`.into()` convention used
        // by every other grammar here — see the Cargo.toml pin comment).
        "dart" => vec![("Dart", tree_sitter_dart::language())],
        "cs" => vec![("C#", tree_sitter_c_sharp::LANGUAGE.into())],
        "rb" => vec![("Ruby", tree_sitter_ruby::LANGUAGE.into())],
        "php" => vec![("PHP", tree_sitter_php::LANGUAGE_PHP.into())],
        "sql" => vec![("SQL", tree_sitter_sequel::LANGUAGE.into())],
        "lua" => vec![("Lua", tree_sitter_lua::LANGUAGE.into())],
        "ps1" | "psm1" | "psd1" => vec![("PowerShell", tree_sitter_powershell::LANGUAGE.into())],
        "r" => vec![("R", tree_sitter_r::LANGUAGE.into())],
        "sol" => vec![("Solidity", tree_sitter_solidity::LANGUAGE.into())],
        // Old binding style (`fn language() -> Language`, no `.into()`) — see
        // the Cargo.toml pin comment.
        "fish" => vec![("Fish", tree_sitter_fish::language())],
        "glsl" | "vert" | "frag" | "geom" | "comp" | "tesc" | "tese" => {
            vec![("GLSL", tree_sitter_glsl::LANGUAGE_GLSL.into())]
        }
        "hlsl" | "fx" | "fxh" | "hlsli" => vec![("HLSL", tree_sitter_hlsl::LANGUAGE_HLSL.into())],
        "ex" | "exs" => vec![("Elixir", tree_sitter_elixir::LANGUAGE.into())],
        "erl" | "hrl" => vec![("Erlang", tree_sitter_erlang::LANGUAGE.into())],
        "groovy" | "gradle" => vec![("Groovy", tree_sitter_groovy::LANGUAGE.into())],
        "hs" => vec![("Haskell", tree_sitter_haskell::LANGUAGE.into())],
        "d" => vec![("D", tree_sitter_d::LANGUAGE.into())],
        "scm" | "ss" => vec![("Scheme", tree_sitter_scheme::LANGUAGE.into())],
        "lisp" | "lsp" => vec![(
            "Common Lisp",
            tree_sitter_commonlisp::LANGUAGE_COMMONLISP.into(),
        )],
        "scala" | "sc" => vec![("Scala", tree_sitter_scala::LANGUAGE.into())],
        "fs" | "fsx" | "fsi" => vec![("F#", tree_sitter_fsharp::LANGUAGE_FSHARP.into())],
        "ml" => vec![("OCaml", tree_sitter_ocaml::LANGUAGE_OCAML.into())],
        "mli" => vec![("OCaml", tree_sitter_ocaml::LANGUAGE_OCAML_INTERFACE.into())],
        "rkt" => vec![("Racket", tree_sitter_racket::LANGUAGE.into())],
        "bicep" => vec![("Bicep", tree_sitter_bicep::LANGUAGE.into())],
        "cmake" => vec![("CMake", tree_sitter_cmake::LANGUAGE.into())],
        // `.bzl` library files — see the `BUILD`/`WORKSPACE` special-filename
        // arm below for the other half of Bazel's file set.
        "bzl" | "bazel" => vec![("Bazel", tree_sitter_starlark::LANGUAGE.into())],
        "nix" => vec![("Nix", tree_sitter_nix::LANGUAGE.into())],
        "asm" | "s" => vec![("Assembly", tree_sitter_asm::LANGUAGE.into())],
        "f90" | "f95" | "f" | "for" => vec![("Fortran", tree_sitter_fortran::LANGUAGE.into())],
        "adb" | "ads" => vec![("Ada", tree_sitter_ada::LANGUAGE.into())],
        "pas" => vec![("Pascal", tree_sitter_pascal::LANGUAGE.into())],
        "v" | "vh" => vec![("Verilog", tree_sitter_verilog::LANGUAGE.into())],
        "jl" => vec![("Julia", tree_sitter_julia::LANGUAGE.into())],
        "sas" => vec![("SAS", tree_sitter_sas::LANGUAGE.into())],
        "gd" => vec![("GDScript", tree_sitter_gdscript::LANGUAGE.into())],
        // Not `.pl`: that's already Perl's extension in detector.rs's static
        // tier (real-world ambiguity noted there) — Prolog gets its other
        // conventional extensions instead.
        "pro" | "prolog" => vec![("Prolog", tree_sitter_prolog::LANGUAGE.into())],
        "agda" => vec![("Agda", tree_sitter_agda::LANGUAGE.into())],
        "diff" | "patch" => vec![("Diff", tree_sitter_diff::LANGUAGE.into())],
        // Old binding style — see the Cargo.toml pin comment.
        "vim" => vec![("Vim script", tree_sitter_vim::language())],
        "sparql" | "rq" => vec![("SPARQL", tree_sitter_sparql::LANGUAGE.into())],
        "proto" => vec![("Protobuf", tree_sitter_proto::LANGUAGE.into())],
        "cu" | "cuh" => vec![("Cuda", tree_sitter_cuda::LANGUAGE_CUDA.into())],
        "ino" => vec![("Arduino", tree_sitter_arduino::LANGUAGE.into())],
        // Old binding style — see the Cargo.toml pin comment.
        "sp" => vec![("SourcePawn", tree_sitter_sourcepawn::language())],
        // Reuses the Starlark grammar already pulled in for Bazel above —
        // `.bzl`/`BUILD`/`WORKSPACE` label their result "Bazel" (see those
        // arms), plain `.star` files label it "Starlark" itself.
        "star" => vec![("Starlark", tree_sitter_starlark::LANGUAGE.into())],
        // Not Pascal's: deliberately left free of a `.pp` mapping back when
        // Pascal was added, specifically for this — Puppet's real-world use
        // of the extension is far more common today.
        "pp" => vec![("Puppet", tree_sitter_puppet::LANGUAGE.into())],
        "zig" => vec![("Zig", tree_sitter_zig::LANGUAGE.into())],
        "rst" => vec![("reStructuredText", tree_sitter_rst::LANGUAGE.into())],
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
        "BUILD" | "WORKSPACE" => Some(vec![("Bazel", tree_sitter_starlark::LANGUAGE.into())]),
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
        "@autoreleasepool",
        "#import ",
        "@import ",
        "[super ",
        "[self ",
    ];

    if indicators.iter().any(|indicator| text.contains(indicator)) {
        return true;
    }

    // `@property` needs its own check: as a bare substring it also matches
    // Swift's `@propertyWrapper` attribute. Objective-C always writes the
    // declaration as `@property(` or `@property ` (attribute list or type),
    // never `@property` glued to more identifier characters.
    text.match_indices("@property").any(|(idx, _)| {
        text[idx + "@property".len()..]
            .chars()
            .next()
            .is_none_or(|next| !next.is_alphanumeric() && next != '_')
    })
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
    fn swift_extension_maps_to_swift() {
        let candidates = candidates_for("ContentView.swift", b"import SwiftUI\n");
        let names: Vec<&str> = candidates.iter().map(|(name, _)| *name).collect();
        assert_eq!(names, vec!["Swift"]);
    }

    #[test]
    fn java_kotlin_dart_extensions_map_to_their_grammars() {
        assert_eq!(
            candidates_for_extension("java")
                .iter()
                .map(|(name, _)| *name)
                .collect::<Vec<_>>(),
            vec!["Java"]
        );
        assert_eq!(
            candidates_for_extension("kt")
                .iter()
                .map(|(name, _)| *name)
                .collect::<Vec<_>>(),
            vec!["Kotlin"]
        );
        assert_eq!(
            candidates_for_extension("kts")
                .iter()
                .map(|(name, _)| *name)
                .collect::<Vec<_>>(),
            vec!["Kotlin"]
        );
        assert_eq!(
            candidates_for_extension("dart")
                .iter()
                .map(|(name, _)| *name)
                .collect::<Vec<_>>(),
            vec!["Dart"]
        );
    }

    #[test]
    fn csharp_ruby_php_sql_lua_powershell_extensions_map_correctly() {
        let cases = [
            ("cs", "C#"),
            ("rb", "Ruby"),
            ("php", "PHP"),
            ("sql", "SQL"),
            ("lua", "Lua"),
            ("ps1", "PowerShell"),
            ("psm1", "PowerShell"),
            ("psd1", "PowerShell"),
        ];
        for (ext, expected) in cases {
            let names: Vec<&str> = candidates_for_extension(ext)
                .iter()
                .map(|(name, _)| *name)
                .collect();
            assert_eq!(names, vec![expected], "ext: {ext}");
        }
    }

    #[test]
    fn r_solidity_fish_glsl_hlsl_extensions_map_correctly() {
        let cases = [
            ("r", "R"),
            ("sol", "Solidity"),
            ("fish", "Fish"),
            ("glsl", "GLSL"),
            ("frag", "GLSL"),
            ("vert", "GLSL"),
            ("hlsl", "HLSL"),
            ("fx", "HLSL"),
        ];
        for (ext, expected) in cases {
            let names: Vec<&str> = candidates_for_extension(ext)
                .iter()
                .map(|(name, _)| *name)
                .collect();
            assert_eq!(names, vec![expected], "ext: {ext}");
        }
    }

    #[test]
    fn backend_general_purpose_extensions_map_correctly() {
        let cases = [
            ("ex", "Elixir"),
            ("exs", "Elixir"),
            ("erl", "Erlang"),
            ("groovy", "Groovy"),
            ("hs", "Haskell"),
            ("d", "D"),
            ("scm", "Scheme"),
            ("lisp", "Common Lisp"),
            ("scala", "Scala"),
            ("fs", "F#"),
            ("ml", "OCaml"),
            ("mli", "OCaml"),
            ("rkt", "Racket"),
        ];
        for (ext, expected) in cases {
            let names: Vec<&str> = candidates_for_extension(ext)
                .iter()
                .map(|(name, _)| *name)
                .collect();
            assert_eq!(names, vec![expected], "ext: {ext}");
        }
    }

    #[test]
    fn infra_as_code_extensions_map_correctly() {
        let cases = [
            ("bicep", "Bicep"),
            ("cmake", "CMake"),
            ("bzl", "Bazel"),
            ("bazel", "Bazel"),
            ("nix", "Nix"),
        ];
        for (ext, expected) in cases {
            let names: Vec<&str> = candidates_for_extension(ext)
                .iter()
                .map(|(name, _)| *name)
                .collect();
            assert_eq!(names, vec![expected], "ext: {ext}");
        }
    }

    #[test]
    fn cmakelists_txt_is_cmake_not_text() {
        let candidates = candidates_for("CMakeLists.txt", b"project(foo)\n");
        let names: Vec<&str> = candidates.iter().map(|(name, _)| *name).collect();
        assert_eq!(names, vec!["CMake"]);
    }

    #[test]
    fn bazel_build_and_workspace_filenames_are_recognized() {
        for name in ["BUILD", "WORKSPACE"] {
            let candidates = candidates_for(name, b"load(\"//foo\", \"bar\")\n");
            let names: Vec<&str> = candidates.iter().map(|(n, _)| *n).collect();
            assert_eq!(names, vec!["Bazel"], "filename: {name}");
        }
    }

    #[test]
    fn chroma_diff_batch_extensions_map_correctly() {
        let cases = [
            ("pp", "Puppet"),
            ("zig", "Zig"),
            ("rst", "reStructuredText"),
        ];
        for (ext, expected) in cases {
            let names: Vec<&str> = candidates_for_extension(ext)
                .iter()
                .map(|(name, _)| *name)
                .collect();
            assert_eq!(names, vec![expected], "ext: {ext}");
        }
    }

    #[test]
    fn final_batch_extensions_map_correctly() {
        let cases = [
            ("jl", "Julia"),
            ("sas", "SAS"),
            ("gd", "GDScript"),
            ("pro", "Prolog"),
            ("prolog", "Prolog"),
            ("agda", "Agda"),
            ("diff", "Diff"),
            ("patch", "Diff"),
            ("vim", "Vim script"),
            ("sparql", "SPARQL"),
            ("rq", "SPARQL"),
            ("proto", "Protobuf"),
            ("cu", "Cuda"),
            ("cuh", "Cuda"),
            ("ino", "Arduino"),
            ("sp", "SourcePawn"),
            ("star", "Starlark"),
        ];
        for (ext, expected) in cases {
            let names: Vec<&str> = candidates_for_extension(ext)
                .iter()
                .map(|(name, _)| *name)
                .collect();
            assert_eq!(names, vec![expected], "ext: {ext}");
        }
    }

    #[test]
    fn systems_low_level_extensions_map_correctly() {
        let cases = [
            ("asm", "Assembly"),
            ("s", "Assembly"),
            ("f90", "Fortran"),
            ("f", "Fortran"),
            ("adb", "Ada"),
            ("ads", "Ada"),
            ("pas", "Pascal"),
            ("v", "Verilog"),
            ("vh", "Verilog"),
        ];
        for (ext, expected) in cases {
            let names: Vec<&str> = candidates_for_extension(ext)
                .iter()
                .map(|(name, _)| *name)
                .collect();
            assert_eq!(names, vec![expected], "ext: {ext}");
        }
    }

    #[test]
    fn extensionless_python_uses_shebang() {
        let candidates = candidates_for("script", b"#!/usr/bin/env python\nprint('hi')\n");
        assert_eq!(candidates[0].0, "Python");
    }
}

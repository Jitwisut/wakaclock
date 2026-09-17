use crate::cache::{self, CachedResult};
use crate::languages::{candidates_for, looks_like_objective_c};
use crate::pool::with_parsed_tree;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::time::{Duration, Instant};
use tracing::debug;

pub const MAX_SOURCE_BYTES: usize = 8 * 1024;
const DETECTION_BUDGET: Duration = Duration::from_millis(50);

pub struct AstResult {
    pub language: String,
    pub confidence: f32,
    pub dependencies: Vec<String>,
}

/// Detect a file from disk while reading at most the parser input budget.
/// In-memory editor buffers should continue using `detect` so unsaved text wins over disk.
pub fn detect_file(path: &Path) -> std::io::Result<Option<AstResult>> {
    let mut file = File::open(path)?;
    let mut source = Vec::with_capacity(MAX_SOURCE_BYTES);
    file.by_ref()
        .take(MAX_SOURCE_BYTES as u64)
        .read_to_end(&mut source)?;
    Ok(detect(&path.to_string_lossy(), &source))
}

pub fn detect(entity: &str, source: &[u8]) -> Option<AstResult> {
    let source = truncate_source(source);

    if let Some(cached) = cache::get(entity, source) {
        return Some(AstResult {
            language: cached.language,
            confidence: cached.confidence,
            dependencies: cached.dependencies,
        });
    }

    if let Some(static_result) = detect_static_asset(entity, source) {
        cache::insert(
            entity,
            source,
            CachedResult {
                language: static_result.language.clone(),
                confidence: static_result.confidence,
                dependencies: static_result.dependencies.clone(),
            },
        );
        return Some(static_result);
    }

    let started_at = Instant::now();
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
            source,
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

    // `.blade.php` is a double extension — `Path::extension()` on
    // `index.blade.php` returns "php", so this has to be a filename check,
    // not an arm below.
    if file_name.ends_with(".blade.php") {
        return Some(AstResult {
            language: "Blade".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        });
    }

    // `CMakeLists.txt` has a `.txt` extension, which the "txt" arm below
    // would otherwise claim as plain Text — bail out here so `detect()`
    // falls through to `candidates_for`, where `languages.rs` gives it the
    // real CMake grammar.
    if file_name == "cmakelists.txt" {
        return None;
    }

    // Meson's own file names, not an extension: `meson.build`'s extension is
    // "build" and `meson_options.txt`'s is "txt" (which the arm below would
    // claim as Text) — neither is a reliable general-purpose extension to
    // key on, so match the exact names Meson actually uses instead.
    if matches!(
        file_name.as_str(),
        "meson.build" | "meson.options" | "meson_options.txt"
    ) {
        return Some(static_lang("Meson"));
    }

    // ApacheConf: `.htaccess` has no `Path::extension()` at all (same as
    // `.env` above), and the other conventional names carry `.conf`, which
    // is already INI's extension below — filename match, checked first.
    if matches!(
        file_name.as_str(),
        ".htaccess" | "httpd.conf" | "apache2.conf" | "apache.conf"
    ) {
        return Some(static_lang("ApacheConf"));
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
        // Extension-trusted, like every other arm above: no grammar backs
        // these, so confidence is a flat 1.0 and dependencies are empty
        // rather than guessed at.
        "applescript" => Some(AstResult {
            language: "AppleScript".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "vue" => Some(AstResult {
            language: "Vue".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "svelte" => Some(AstResult {
            language: "Svelte".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "astro" => Some(AstResult {
            language: "Astro".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "scss" => Some(AstResult {
            language: "SCSS".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "less" => Some(AstResult {
            language: "Less".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "coffee" => Some(AstResult {
            language: "CoffeeScript".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "pug" => Some(AstResult {
            language: "Pug".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "hbs" | "handlebars" => Some(AstResult {
            language: "Handlebars".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "haml" => Some(AstResult {
            language: "Haml".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "jinja" | "jinja2" | "j2" => Some(AstResult {
            language: "Jinja".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "twig" => Some(AstResult {
            language: "Twig".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        "liquid" => Some(AstResult {
            language: "Liquid".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        // No tree-sitter grammar here: HCL's only crates.io release is ABI
        // 15 (see the Cargo.toml comment on the removed dependency).
        "hcl" | "tf" | "tfvars" => Some(AstResult {
            language: "HCL".to_string(),
            confidence: 1.0,
            dependencies: vec![],
        }),
        // No usable grammar for any of these — either no ABI-14-compatible
        // release exists (Crystal, Perl, Nim, Clojure) or no tree-sitter
        // crate is published at all (the rest). See the Cargo.toml comment
        // above the Backend/general-purpose batch for per-language detail.
        "cr" => Some(static_lang("Crystal")),
        // `.pl` is ambiguous with Prolog in the wild; kept as Perl (the far
        // more common real-world use of the extension) now that Prolog has
        // its own grammar too — see `.pro`/`.prolog` in languages.rs.
        "pl" | "pm" => Some(static_lang("Perl")),
        "nim" | "nims" => Some(static_lang("Nim")),
        "clj" | "cljs" | "cljc" => Some(static_lang("Clojure")),
        "purs" => Some(static_lang("PureScript")),
        "res" | "resi" => Some(static_lang("ReScript")),
        "re" | "rei" => Some(static_lang("Reason")),
        "factor" => Some(static_lang("Factor")),
        "fnl" => Some(static_lang("Fennel")),
        "io" => Some(static_lang("Io")),
        "ijs" => Some(static_lang("J")),
        "fy" => Some(static_lang("Fancy")),
        "boo" => Some(static_lang("Boo")),
        "mirah" => Some(static_lang("Mirah")),
        "dylan" => Some(static_lang("Dylan")),
        "e" => Some(static_lang("Eiffel")),
        "fan" => Some(static_lang("Fantom")),
        "bsh" => Some(static_lang("BeanShell")),
        "cfm" | "cfc" => Some(static_lang("ColdFusion")),
        "mojo" => Some(static_lang("Mojo")),
        "mo" => Some(static_lang("Motoko")),
        "bal" => Some(static_lang("Ballerina")),
        // Elm and Emacs Lisp: no ABI-14 grammar release also depends on
        // `tree-sitter` compatibly with this workspace's 0.24 pin — see the
        // long Cargo.toml comment on this batch for why.
        "elm" => Some(static_lang("Elm")),
        "el" => Some(static_lang("Emacs Lisp")),
        "q" => Some(static_lang("Q")),
        // BitBake: every crates.io release pins `tree-sitter` directly to a
        // range excluding this workspace's runtime (the Elm/Emacs-Lisp
        // failure mode — see the Cargo.toml comment on this batch). `.inc`
        // is deliberately not mapped here: it's a generic "included file"
        // extension shared with other build systems, too ambiguous to claim.
        "bb" | "bbappend" | "bbclass" => Some(static_lang("BitBake")),
        "dhall" => Some(static_lang("Dhall")),
        "aug" => Some(static_lang("Augeas")),
        // Systems/low-level's static-tier remainder — see the Cargo.toml
        // comment on this batch for why each has no grammar.
        "cob" | "cbl" => Some(static_lang("COBOL")),
        "vhd" | "vhdl" => Some(static_lang("VHDL")),
        "sv" | "svh" => Some(static_lang("SystemVerilog")),
        "ll" => Some(static_lang("LLVM")),
        "pyx" | "pxd" => Some(static_lang("Cython")),
        "als" => Some(static_lang("Alloy")),
        // Not `.mod`: real-world collision risk is too high (Modula-2,
        // Amiga/tracker music modules) for a niche language's static-tier
        // extension. `.ampl` is unambiguous, if less commonly used.
        "ampl" => Some(static_lang("AMPL")),
        // All of Scripting/shell-adjacent — see the Cargo.toml comment on
        // this batch.
        "bat" | "cmd" => Some(static_lang("Batchfile")),
        "ahk" => Some(static_lang("AutoHotkey")),
        "au3" => Some(static_lang("AutoIt")),
        "awk" => Some(static_lang("Awk")),
        "sed" => Some(static_lang("sed")),
        "tcl" => Some(static_lang("Tcl")),
        "ls" => Some(static_lang("LiveScript")),
        "as" => Some(static_lang("ActionScript")),
        "aj" => Some(static_lang("AspectJ")),
        "raku" | "rakumod" | "p6" => Some(static_lang("Raku")),
        // Final batch — see the long Cargo.toml comment for why each of
        // these has no grammar (no crate published, ABI 15 in every release
        // with nothing to fall back to, or a `tree-sitter`-version-range
        // conflict in every release).
        "tsql" => Some(static_lang("TSQL")),
        "pgsql" => Some(static_lang("PLpgSQL")),
        "kql" => Some(static_lang("Kusto")),
        "wl" | "wls" => Some(static_lang("Wolfram Language")),
        "metal" => Some(static_lang("Metal")),
        "shader" => Some(static_lang("ShaderLab")),
        // `.cl` is also used by some Common Lisp projects in the wild, but
        // this codebase maps Common Lisp to `.lisp`/`.lsp` only, so there's
        // no actual collision here.
        "cl" => Some(static_lang("OpenCL")),
        "pde" => Some(static_lang("Processing")),
        // Not `.bb`: already BitBake's extension above. `.bmx` (BlitzMax,
        // the actively-maintained successor) is the closest unambiguous
        // extension left for the "BlitzBasic" catalog name.
        "bmx" => Some(static_lang("BlitzBasic")),
        "bsv" => Some(static_lang("Bluespec")),
        "idr" => Some(static_lang("Idris")),
        "hoon" => Some(static_lang("Hoon")),
        "ftl" => Some(static_lang("Fluent")),
        "st" => Some(static_lang("Smalltalk")),
        "vala" => Some(static_lang("Vala")),
        "typ" => Some(static_lang("Typst")),
        "g4" => Some(static_lang("ANTLR")),
        "l" => Some(static_lang("Lex")),
        // Theos's Logos preprocessor for iOS tweaks — the most defensible
        // reading of this catalog entry, though the name is generic enough
        // that there's real uncertainty; `.x` (also Theos) is too generic an
        // extension on its own to claim (X10, DirectX effects, etc.).
        "xm" => Some(static_lang("Logos")),
        // Max/MSP (Cycling '74) patcher files — JSON-based, not source text
        // in the usual sense, but this is the real file extension.
        "maxpat" => Some(static_lang("Max")),
        "arc" => Some(static_lang("Arc")),
        "njk" => Some(static_lang("Nunjucks")),
        // TeX vs LaTeX: `.tex` is the general/default convention (most
        // `.tex` files in the wild are LaTeX, but there's no grammar here to
        // confirm that from content); `.ltx` is a real, if less common,
        // LaTeX-specific extension — using it here is how both catalog names
        // resolve without guessing from file content.
        "tex" => Some(static_lang("TeX")),
        "ltx" => Some(static_lang("LaTeX")),
        "roff" | "man" => Some(static_lang("Roff")),
        "feature" => Some(static_lang("Gherkin")),
        "ly" => Some(static_lang("LilyPond")),
        "m4" => Some(static_lang("M4")),
        // Not `.wasm`: that's the compiled binary form — byte-prefix
        // detection is meaningless there, same reasoning as `.scpt` for
        // AppleScript. `.wat`/`.wast` are the text formats.
        "wat" | "wast" => Some(static_lang("WebAssembly")),
        "bsl" => Some(static_lang("1C Enterprise")),
        "abap" => Some(static_lang("ABAP")),
        "aidl" => Some(static_lang("AIDL")),
        // Matlab's only conventional extension is `.m`, which this codebase
        // already gives to Objective-C (a real, well-known ambiguity that
        // every language-detection tool has to resolve with content
        // heuristics, not extension alone) — deliberately left unmapped
        // rather than fighting over `.m` with a working detection path.
        "gp" | "gnuplot" => Some(static_lang("Gnuplot")),
        "nut" => Some(static_lang("Squirrel")),
        "lean" => Some(static_lang("Lean")),
        "org" => Some(static_lang("Org")),
        "scad" => Some(static_lang("OpenSCAD")),
        // From the Chroma-diff batch — see the Cargo.toml comment there.
        "csv" => Some(static_lang("CSV")),
        "graphql" | "gql" => Some(static_lang("GraphQL")),
        "nu" => Some(static_lang("Nu")),
        // Missed entirely until now: present in catalog.rs's LANGUAGES list
        // from before this whole language-coverage effort started, but a
        // parsing artifact in the very first session-start catalog capture
        // dropped it (and, harmlessly, YAML) from every count and "still
        // missing" list produced since — see crates.md. No tree-sitter crate
        // published for it.
        "xq" | "xql" | "xqm" | "xquery" => Some(static_lang("XQuery")),
        // Second Chroma-diff batch — see the Cargo.toml comment there.
        "hx" | "hxml" => Some(static_lang("Haxe")),
        "sml" => Some(static_lang("Standard ML")),
        "vb" => Some(static_lang("VB.net")),
        // Sass's indented syntax — distinct from SCSS above, which already
        // owns `.scss`.
        "sass" => Some(static_lang("Sass")),
        _ => None,
    }
}

/// A static-tier result for a language with no grammar backing it here:
/// fixed max confidence, no dependency extraction attempted.
fn static_lang(language: &str) -> AstResult {
    AstResult {
        language: language.to_string(),
        confidence: 1.0,
        dependencies: vec![],
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
        "Swift" => extract_swift(root, source),
        "Java" => extract_java(root, source),
        "Kotlin" => extract_kotlin(root, source),
        "Dart" => extract_dart(root, source),
        "C#" => extract_csharp(root, source),
        "Ruby" => extract_ruby(root, source),
        "PHP" => extract_php(root, source),
        // SQL has no import/use statement to walk for.
        "SQL" | "Lua" | "PowerShell" | "Fish" | "GLSL" | "HLSL" | "Elixir" | "Erlang"
        | "Groovy" | "Haskell" | "D" | "Scheme" | "Common Lisp" | "Scala" | "F#" | "OCaml"
        | "Racket" | "Bicep" | "CMake" | "Bazel" | "Nix" | "Assembly" | "Fortran" | "Ada"
        | "Pascal" | "Verilog" | "Julia" | "SAS" | "GDScript" | "Prolog" | "Agda" | "Diff"
        | "Vim script" | "SPARQL" | "Protobuf" | "Cuda" | "Arduino" | "SourcePawn" | "Starlark"
        | "Puppet" | "Zig" | "reStructuredText" => {
            vec![]
        }
        "R" => extract_r(root, source),
        "Solidity" => extract_solidity(root, source),
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

fn extract_swift(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        if node.kind() != "import_declaration" {
            return;
        }
        // `import_declaration` holds an `identifier` child carrying the dotted
        // module path (`import UIKit`, `import UIKit.UIView`, `import class
        // Foo.Bar`). Keep only the top-level module name.
        for i in 0..node.child_count() {
            let Some(child) = node.child(i) else {
                continue;
            };
            if child.kind() != "identifier" {
                continue;
            }
            if let Some(text) = node_text(child, source) {
                let top = text.split('.').next().unwrap_or(text).trim();
                if !top.is_empty() {
                    deps.push(top.to_string());
                }
            }
        }
    });
    deps
}

fn extract_java(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        if node.kind() != "import_declaration" {
            return;
        }
        // `import java.util.List;` nests as `scoped_identifier`; a single
        // segment (rare) is a plain `identifier`. Either way the node's own
        // text is the dotted path — take its first component.
        for i in 0..node.child_count() {
            let Some(child) = node.child(i) else {
                continue;
            };
            if !matches!(child.kind(), "identifier" | "scoped_identifier") {
                continue;
            }
            if let Some(text) = node_text(child, source) {
                let top = text.split('.').next().unwrap_or(text).trim();
                if !top.is_empty() {
                    deps.push(top.to_string());
                }
            }
        }
    });
    deps
}

fn extract_kotlin(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        // The grammar names both the import statement and the bare `import`
        // keyword token "import"; `is_named()` tells them apart.
        if node.kind() != "import" || !node.is_named() {
            return;
        }
        for i in 0..node.child_count() {
            let Some(child) = node.child(i) else {
                continue;
            };
            if !matches!(child.kind(), "identifier" | "qualified_identifier") {
                continue;
            }
            if let Some(text) = node_text(child, source) {
                let top = text.split('.').next().unwrap_or(text).trim();
                if !top.is_empty() {
                    deps.push(top.to_string());
                }
            }
        }
    });
    deps
}

fn extract_dart(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        if node.kind() != "uri" {
            return;
        }
        let Some(raw) = string_content(node, source) else {
            return;
        };
        // Only external packages and SDK libraries count as dependencies;
        // a relative import (`import 'src/foo.dart';`) names a file in the
        // same project, not something to attribute to.
        if let Some(rest) = raw.strip_prefix("package:") {
            let name = rest.split('/').next().unwrap_or(rest);
            if !name.is_empty() {
                deps.push(name.to_string());
            }
        } else if let Some(rest) = raw.strip_prefix("dart:") {
            if !rest.is_empty() {
                deps.push(rest.to_string());
            }
        }
    });
    deps
}

fn extract_csharp(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        if node.kind() != "using_directive" {
            return;
        }
        // Despite node-types.json advertising a "name" field, the grammar
        // doesn't actually label it on the plain (non-static, non-alias)
        // form: `using System;` parses as `(using_directive (identifier))`
        // with no field at all — has to be found positionally.
        for i in 0..node.child_count() {
            let Some(child) = node.child(i) else {
                continue;
            };
            if !matches!(child.kind(), "identifier" | "qualified_name") {
                continue;
            }
            if let Some(text) = node_text(child, source) {
                let top = text.split('.').next().unwrap_or(text).trim();
                if !top.is_empty() {
                    deps.push(top.to_string());
                }
            }
        }
    });
    deps
}

fn extract_ruby(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        if node.kind() != "call" {
            return;
        }
        let Some(method) = node.child_by_field_name("method") else {
            return;
        };
        if !matches!(
            node_text(method, source),
            Some("require" | "require_relative" | "gem")
        ) {
            return;
        }
        let Some(args) = node.child_by_field_name("arguments") else {
            return;
        };
        for i in 0..args.child_count() {
            let Some(arg) = args.child(i) else {
                continue;
            };
            if arg.kind() != "string" {
                continue;
            }
            if let Some(text) = string_content(arg, source) {
                let name = text.split('/').next().unwrap_or(text).trim();
                if !name.is_empty() {
                    deps.push(name.to_string());
                }
            }
        }
    });
    deps
}

fn extract_php(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        // `use App\Foo\Bar;` and grouped `use App\{Foo, Bar};` both nest a
        // `namespace_use_clause` per imported name — walk those rather than
        // the outer `namespace_use_declaration`.
        if node.kind() != "namespace_use_clause" {
            return;
        }
        for i in 0..node.child_count() {
            let Some(child) = node.child(i) else {
                continue;
            };
            if !matches!(child.kind(), "name" | "qualified_name") {
                continue;
            }
            if let Some(text) = node_text(child, source) {
                let top = text
                    .trim_start_matches('\\')
                    .split('\\')
                    .next()
                    .unwrap_or(text)
                    .trim();
                if !top.is_empty() {
                    deps.push(top.to_string());
                }
            }
        }
    });
    deps
}

fn extract_r(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        if node.kind() != "call" {
            return;
        }
        let Some(func) = node.child_by_field_name("function") else {
            return;
        };
        if !matches!(
            node_text(func, source),
            Some("library" | "require" | "requireNamespace")
        ) {
            return;
        }
        let Some(args) = node.child_by_field_name("arguments") else {
            return;
        };
        for i in 0..args.child_count() {
            let Some(arg) = args.child(i) else {
                continue;
            };
            if arg.kind() != "argument" {
                continue;
            }
            // `library(dplyr)` passes the package name unquoted (R's normal
            // NSE for this call) — `library("dplyr")` also occurs. Either
            // way the "value" field carries it; trim quotes if present.
            let Some(value) = arg.child_by_field_name("value") else {
                continue;
            };
            if let Some(text) = node_text(value, source) {
                let name = text.trim_matches(|ch| ch == '\'' || ch == '"').trim();
                if !name.is_empty() {
                    deps.push(name.to_string());
                }
            }
        }
    });
    deps
}

fn extract_solidity(root: tree_sitter::Node, source: &[u8]) -> Vec<String> {
    let mut deps = vec![];
    walk_tree(root, &mut |node| {
        if node.kind() != "import_directive" {
            return;
        }
        let Some(source_node) = node.child_by_field_name("source") else {
            return;
        };
        if let Some(text) = string_content(source_node, source) {
            // Same shape as JS specifiers: relative paths, or npm-style
            // `@scope/pkg/...` and `pkg/...` (common via Hardhat/Foundry).
            deps.push(strip_path_specifier(text));
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
    fn detects_swift_and_extracts_imported_modules() {
        let src = b"import SwiftUI\nimport UIKit.UIView\n\nstruct ContentView: View {\n    var body: some View { Text(\"hi\") }\n}\n";
        let result = detect("ContentView.swift", src).unwrap();
        assert_eq!(result.language, "Swift");
        assert!(result.confidence > 0.9);
        assert!(result.dependencies.contains(&"SwiftUI".to_string()));
        assert!(result.dependencies.contains(&"UIKit".to_string()));
    }

    #[test]
    fn swift_property_wrapper_does_not_regress_to_objective_c() {
        // `looks_like_objective_c` matches the substring "@property", which also
        // appears inside Swift's `@propertyWrapper`, so an Objective-C candidate
        // gets prepended. The Swift grammar must still out-score it.
        let src = b"import SwiftUI\n\n@propertyWrapper\nstruct Clamped {\n    private var value: Int = 0\n    var wrappedValue: Int { value }\n}\n";
        let result = detect("Clamped.swift", src).unwrap();
        assert_eq!(result.language, "Swift");
    }

    #[test]
    fn detects_java_and_extracts_imported_packages() {
        let src = b"import java.util.List;\nimport static java.util.Collections.emptyList;\n\nclass Main {}\n";
        let result = detect("Main.java", src).unwrap();
        assert_eq!(result.language, "Java");
        assert!(result.confidence > 0.9);
        assert!(result.dependencies.contains(&"java".to_string()));
    }

    #[test]
    fn detects_kotlin_and_extracts_imported_packages() {
        let src = b"import kotlinx.coroutines.launch\nimport androidx.compose.runtime.Composable\n\nfun main() {}\n";
        let result = detect("Main.kt", src).unwrap();
        assert_eq!(result.language, "Kotlin");
        assert!(result.confidence > 0.9);
        assert!(result.dependencies.contains(&"kotlinx".to_string()));
        assert!(result.dependencies.contains(&"androidx".to_string()));
    }

    #[test]
    fn detects_dart_and_extracts_package_and_sdk_imports_only() {
        let src = b"import 'package:flutter/material.dart';\nimport 'dart:async';\nimport 'src/local_widget.dart';\n\nvoid main() {}\n";
        let result = detect("main.dart", src).unwrap();
        assert_eq!(result.language, "Dart");
        assert!(result.dependencies.contains(&"flutter".to_string()));
        assert!(result.dependencies.contains(&"async".to_string()));
        assert!(!result
            .dependencies
            .iter()
            .any(|dep| dep.contains("local_widget")));
    }

    #[test]
    fn blade_double_extension_is_not_shadowed_by_php() {
        let result = detect("greeting.blade.php", b"<h1>Hello, {{ $name }}</h1>\n").unwrap();
        assert_eq!(result.language, "Blade");
    }

    #[test]
    fn static_template_and_markup_extensions_map_by_name() {
        let cases = [
            ("App.vue", "Vue"),
            ("App.svelte", "Svelte"),
            ("page.astro", "Astro"),
            ("styles.scss", "SCSS"),
            ("styles.less", "Less"),
            ("script.coffee", "CoffeeScript"),
            ("view.pug", "Pug"),
            ("partial.hbs", "Handlebars"),
            ("layout.haml", "Haml"),
            ("email.jinja2", "Jinja"),
            ("page.twig", "Twig"),
            ("template.liquid", "Liquid"),
            ("run.applescript", "AppleScript"),
        ];
        for (entity, expected) in cases {
            let result = detect(entity, b"content").unwrap();
            assert_eq!(result.language, expected, "entity: {entity}");
            assert_eq!(result.confidence, 1.0);
        }
    }

    #[test]
    fn detects_csharp_and_extracts_using_namespaces() {
        let src = b"using System;\nusing System.Collections.Generic;\n\nclass Program {}\n";
        let result = detect("Program.cs", src).unwrap();
        assert_eq!(result.language, "C#");
        assert!(result.confidence > 0.9);
        assert!(result.dependencies.contains(&"System".to_string()));
    }

    #[test]
    fn detects_ruby_and_extracts_required_gems() {
        let src = b"require 'json'\nrequire_relative './helper'\n\nputs 'hi'\n";
        let result = detect("app.rb", src).unwrap();
        assert_eq!(result.language, "Ruby");
        assert!(result.confidence > 0.9);
        assert!(result.dependencies.contains(&"json".to_string()));
    }

    #[test]
    fn detects_php_and_extracts_use_imports() {
        let src = b"<?php\nnamespace App;\nuse App\\Models\\User;\nuse Illuminate\\Support\\Str;\n\nclass Controller {}\n";
        let result = detect("Controller.php", src).unwrap();
        assert_eq!(result.language, "PHP");
        assert!(result.confidence > 0.9);
        assert!(result.dependencies.contains(&"App".to_string()));
        assert!(result.dependencies.contains(&"Illuminate".to_string()));
    }

    #[test]
    fn detects_sql() {
        let src = b"SELECT id, name FROM users WHERE active = true;\n";
        let result = detect("query.sql", src).unwrap();
        assert_eq!(result.language, "SQL");
    }

    #[test]
    fn detects_lua() {
        let src = b"local function greet(name)\n  print('hello, ' .. name)\nend\n";
        let result = detect("greet.lua", src).unwrap();
        assert_eq!(result.language, "Lua");
        assert!(result.confidence > 0.9);
    }

    #[test]
    fn detects_powershell() {
        let src = b"function Get-Greeting {\n  param([string]$Name)\n  Write-Output \"Hello, $Name\"\n}\n";
        let result = detect("Get-Greeting.ps1", src).unwrap();
        assert_eq!(result.language, "PowerShell");
        assert!(result.confidence > 0.9);
    }

    #[test]
    fn detects_r_and_extracts_library_calls() {
        let src = b"library(dplyr)\nrequire(\"ggplot2\")\n\nx <- 1\n";
        let result = detect("analysis.R", src).unwrap();
        assert_eq!(result.language, "R");
        assert!(result.confidence > 0.9);
        assert!(result.dependencies.contains(&"dplyr".to_string()));
        assert!(result.dependencies.contains(&"ggplot2".to_string()));
    }

    #[test]
    fn detects_solidity_and_extracts_imports() {
        let src = b"pragma solidity ^0.8.0;\nimport \"@openzeppelin/contracts/token/ERC20/ERC20.sol\";\nimport \"./Ownable.sol\";\n\ncontract Token is ERC20 {}\n";
        let result = detect("Token.sol", src).unwrap();
        assert_eq!(result.language, "Solidity");
        assert!(result.confidence > 0.9);
        assert!(result
            .dependencies
            .contains(&"@openzeppelin/contracts".to_string()));
        assert!(result.dependencies.contains(&"Ownable.sol".to_string()));
    }

    #[test]
    fn detects_fish() {
        let src = b"function greet\n    echo \"hello, $argv[1]\"\nend\n";
        let result = detect("greet.fish", src).unwrap();
        assert_eq!(result.language, "Fish");
        assert!(result.confidence > 0.9);
    }

    #[test]
    fn detects_glsl_and_hlsl() {
        let glsl = detect(
            "shader.frag",
            b"void main() {\n  gl_FragColor = vec4(1.0);\n}\n",
        )
        .unwrap();
        assert_eq!(glsl.language, "GLSL");
        assert!(glsl.confidence > 0.9);

        let hlsl = detect(
            "shader.hlsl",
            b"float4 main() : SV_TARGET {\n  return float4(1, 1, 1, 1);\n}\n",
        )
        .unwrap();
        assert_eq!(hlsl.language, "HLSL");
        assert!(hlsl.confidence > 0.9);
    }

    #[test]
    fn hcl_extensions_map_to_static_hcl() {
        for entity in ["main.tf", "vars.tfvars", "config.hcl"] {
            let result = detect(entity, b"variable \"region\" {}").unwrap();
            assert_eq!(result.language, "HCL", "entity: {entity}");
            assert_eq!(result.confidence, 1.0);
        }
    }

    #[test]
    fn backend_general_purpose_grammars_detect_with_reasonable_confidence() {
        let cases: &[(&str, &[u8], &str)] = &[
            (
                "foo.ex",
                b"defmodule Foo do\n  def hello, do: :world\nend\n",
                "Elixir",
            ),
            (
                "foo.erl",
                b"-module(foo).\n-export([hello/0]).\nhello() -> world.\n",
                "Erlang",
            ),
            (
                "Greeter.groovy",
                b"class Greeter {\n    static void main(String[] args) {\n        println(\"hello\")\n    }\n}\n",
                "Groovy",
            ),
            (
                "Main.hs",
                b"module Main where\n\nmain :: IO ()\nmain = putStrLn \"hello\"\n",
                "Haskell",
            ),
            (
                "main.d",
                b"import std.stdio;\n\nvoid main() {\n    writeln(\"hello\");\n}\n",
                "D",
            ),
            (
                "greet.scm",
                b"(define (greet name)\n  (display name))\n",
                "Scheme",
            ),
            (
                "greet.lisp",
                b"(defun greet (name)\n  (format t \"hello ~a\" name))\n",
                "Common Lisp",
            ),
            (
                "Main.scala",
                b"object Main {\n  def main(args: Array[String]): Unit = {\n    println(\"hello\")\n  }\n}\n",
                "Scala",
            ),
            (
                "Greet.fs",
                b"let greet name =\n    printfn \"Hello, %s\" name\n",
                "F#",
            ),
            (
                "greet.ml",
                b"let greet name =\n  print_string name\n",
                "OCaml",
            ),
            (
                "greet.rkt",
                b"#lang racket\n(define (greet name)\n  (displayln name))\n",
                "Racket",
            ),
        ];
        for (entity, src, expected) in cases {
            let result = detect(entity, src).unwrap_or_else(|| panic!("no detection for {entity}"));
            assert_eq!(result.language, *expected, "entity: {entity}");
            assert!(
                result.confidence > 0.6,
                "{entity}: confidence too low ({})",
                result.confidence
            );
        }
    }

    #[test]
    fn backend_general_purpose_static_extensions_map_by_name() {
        let cases = [
            ("Foo.cr", "Crystal"),
            ("foo.pl", "Perl"),
            ("foo.nim", "Nim"),
            ("core.clj", "Clojure"),
            ("Foo.purs", "PureScript"),
            ("Foo.res", "ReScript"),
            ("foo.re", "Reason"),
            ("foo.factor", "Factor"),
            ("foo.fnl", "Fennel"),
            ("foo.io", "Io"),
            ("foo.ijs", "J"),
            ("foo.fy", "Fancy"),
            ("foo.boo", "Boo"),
            ("foo.mirah", "Mirah"),
            ("foo.dylan", "Dylan"),
            ("foo.e", "Eiffel"),
            ("foo.fan", "Fantom"),
            ("foo.bsh", "BeanShell"),
            ("foo.cfm", "ColdFusion"),
            ("foo.mojo", "Mojo"),
            ("foo.mo", "Motoko"),
            ("foo.bal", "Ballerina"),
            ("Main.elm", "Elm"),
            ("greet.el", "Emacs Lisp"),
            ("foo.q", "Q"),
        ];
        for (entity, expected) in cases {
            let result = detect(entity, b"content").unwrap();
            assert_eq!(result.language, expected, "entity: {entity}");
            assert_eq!(result.confidence, 1.0);
        }
    }

    #[test]
    fn infra_as_code_grammars_detect_with_reasonable_confidence() {
        let cases: &[(&str, &[u8], &str)] = &[
            (
                "main.bicep",
                b"param location string = 'eastus'\n\nresource sa 'Microsoft.Storage/storageAccounts@2021-04-01' = {\n  name: 'mystorage'\n  location: location\n}\n",
                "Bicep",
            ),
            (
                "CMakeLists.txt",
                b"cmake_minimum_required(VERSION 3.20)\nproject(wakaclock)\n\nadd_executable(app main.c)\n",
                "CMake",
            ),
            (
                "BUILD.bazel",
                b"load(\"@rules_rust//rust:defs.bzl\", \"rust_binary\")\n\nrust_binary(\n    name = \"app\",\n    srcs = [\"main.rs\"],\n)\n",
                "Bazel",
            ),
            (
                "flake.nix",
                b"{\n  outputs = { self, nixpkgs }: {\n    packages.default = nixpkgs.legacyPackages.x86_64-linux.hello;\n  };\n}\n",
                "Nix",
            ),
        ];
        for (entity, src, expected) in cases {
            let result = detect(entity, src).unwrap_or_else(|| panic!("no detection for {entity}"));
            assert_eq!(result.language, *expected, "entity: {entity}");
            assert!(
                result.confidence > 0.6,
                "{entity}: confidence too low ({})",
                result.confidence
            );
        }
    }

    #[test]
    fn infra_as_code_static_names_and_filenames_map_correctly() {
        let by_extension = [
            ("app.bb", "BitBake"),
            ("app.bbappend", "BitBake"),
            ("app.bbclass", "BitBake"),
            ("Prelude.dhall", "Dhall"),
            ("hosts.aug", "Augeas"),
        ];
        for (entity, expected) in by_extension {
            let result = detect(entity, b"content").unwrap();
            assert_eq!(result.language, expected, "entity: {entity}");
            assert_eq!(result.confidence, 1.0);
        }

        let by_filename = ["meson.build", "meson.options", "meson_options.txt"];
        for entity in by_filename {
            let result = detect(entity, b"project('wakaclock', 'c')\n").unwrap();
            assert_eq!(result.language, "Meson", "entity: {entity}");
        }

        let apache_names = [".htaccess", "httpd.conf", "apache2.conf", "apache.conf"];
        for entity in apache_names {
            let result = detect(entity, b"RewriteEngine On\n").unwrap();
            assert_eq!(result.language, "ApacheConf", "entity: {entity}");
        }
    }

    #[test]
    fn apacheconf_filenames_do_not_regress_to_ini() {
        // ".conf" is INI's extension; the ApacheConf filename guard has to
        // run before that arm or these silently become "INI" instead.
        let result = detect("httpd.conf", b"ServerRoot /etc/apache\n").unwrap();
        assert_eq!(result.language, "ApacheConf");
    }

    #[test]
    fn systems_low_level_grammars_detect_with_reasonable_confidence() {
        let cases: &[(&str, &[u8], &str)] = &[
            (
                "boot.asm",
                b"section .text\nglobal _start\n_start:\n    mov eax, 1\n    int 0x80\n",
                "Assembly",
            ),
            (
                "hello.f90",
                b"program hello\n    implicit none\n    print *, \"hello\"\nend program hello\n",
                "Fortran",
            ),
            (
                "greet.adb",
                b"with Ada.Text_IO; use Ada.Text_IO;\nprocedure Greet is\nbegin\n   Put_Line(\"hello\");\nend Greet;\n",
                "Ada",
            ),
            (
                "greet.pas",
                b"program Greet;\nbegin\n  writeln('hello');\nend.\n",
                "Pascal",
            ),
            (
                "counter.v",
                b"module counter(input clk, output reg [3:0] count);\n  always @(posedge clk) count <= count + 1;\nendmodule\n",
                "Verilog",
            ),
        ];
        for (entity, src, expected) in cases {
            let result = detect(entity, src).unwrap_or_else(|| panic!("no detection for {entity}"));
            assert_eq!(result.language, *expected, "entity: {entity}");
            assert!(
                result.confidence > 0.6,
                "{entity}: confidence too low ({})",
                result.confidence
            );
        }
    }

    #[test]
    fn systems_and_scripting_static_extensions_map_by_name() {
        let cases = [
            ("app.cob", "COBOL"),
            ("app.cbl", "COBOL"),
            ("design.vhd", "VHDL"),
            ("design.vhdl", "VHDL"),
            ("module.sv", "SystemVerilog"),
            ("module.svh", "SystemVerilog"),
            ("out.ll", "LLVM"),
            ("app.pyx", "Cython"),
            ("app.pxd", "Cython"),
            ("model.als", "Alloy"),
            ("model.ampl", "AMPL"),
            ("run.bat", "Batchfile"),
            ("run.cmd", "Batchfile"),
            ("script.ahk", "AutoHotkey"),
            ("script.au3", "AutoIt"),
            ("script.awk", "Awk"),
            ("script.sed", "sed"),
            ("script.tcl", "Tcl"),
            ("app.ls", "LiveScript"),
            ("App.as", "ActionScript"),
            ("Aspect.aj", "AspectJ"),
            ("script.raku", "Raku"),
            ("Module.rakumod", "Raku"),
            ("script.p6", "Raku"),
        ];
        for (entity, expected) in cases {
            let result = detect(entity, b"content").unwrap();
            assert_eq!(result.language, expected, "entity: {entity}");
            assert_eq!(result.confidence, 1.0);
        }
    }

    #[test]
    fn final_batch_grammars_detect_with_reasonable_confidence() {
        let cases: &[(&str, &[u8], &str)] = &[
            (
                "greet.jl",
                b"function greet(name)\n    println(\"hello, \", name)\nend\n\ngreet(\"world\")\n",
                "Julia",
            ),
            (
                "greet.sas",
                b"data _null_;\n  put \"hello, world\";\nrun;\n",
                "SAS",
            ),
            (
                "greet.gd",
                b"func greet(name):\n    print(\"hello, \" + name)\n",
                "GDScript",
            ),
            (
                "greet.pro",
                b"greet(Name) :-\n    format(\"hello, ~w~n\", [Name]).\n",
                "Prolog",
            ),
            (
                "Main.agda",
                b"module Main where\n\ngreet : String\ngreet = \"hello\"\n",
                "Agda",
            ),
            (
                "change.diff",
                b"--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-hello\n+hello, world\n",
                "Diff",
            ),
            (
                "greet.vim",
                b"function! Greet(name)\n  echo \"hello, \" . a:name\nendfunction\n",
                "Vim script",
            ),
            (
                "query.sparql",
                b"SELECT ?name WHERE {\n  ?person foaf:name ?name .\n}\n",
                "SPARQL",
            ),
            (
                "greeting.proto",
                b"syntax = \"proto3\";\n\nmessage Greeting {\n  string name = 1;\n}\n",
                "Protobuf",
            ),
            (
                "greet.cu",
                b"__global__ void greet() {\n    printf(\"hello\\n\");\n}\n",
                "Cuda",
            ),
            (
                "sketch.ino",
                b"void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println(\"hello\");\n}\n",
                "Arduino",
            ),
            (
                "plugin.sp",
                b"#include <sourcemod>\n\npublic void OnPluginStart() {\n    PrintToServer(\"hello\");\n}\n",
                "SourcePawn",
            ),
            (
                "greet.star",
                b"def greet(name):\n    return \"hello, \" + name\n\nprint(greet(\"world\"))\n",
                "Starlark",
            ),
        ];
        for (entity, src, expected) in cases {
            let result = detect(entity, src).unwrap_or_else(|| panic!("no detection for {entity}"));
            assert_eq!(result.language, *expected, "entity: {entity}");
            assert!(
                result.confidence > 0.6,
                "{entity}: confidence too low ({})",
                result.confidence
            );
        }
    }

    #[test]
    fn final_batch_static_extensions_map_by_name() {
        let cases = [
            ("q1.tsql", "TSQL"),
            ("fn.pgsql", "PLpgSQL"),
            ("query.kql", "Kusto"),
            ("script.wl", "Wolfram Language"),
            ("script.wls", "Wolfram Language"),
            ("shader.metal", "Metal"),
            ("Custom.shader", "ShaderLab"),
            ("kernel.cl", "OpenCL"),
            ("sketch.pde", "Processing"),
            ("game.bmx", "BlitzBasic"),
            ("Core.bsv", "Bluespec"),
            ("Main.idr", "Idris"),
            ("app.hoon", "Hoon"),
            ("app.ftl", "Fluent"),
            ("App.st", "Smalltalk"),
            ("App.vala", "Vala"),
            ("doc.typ", "Typst"),
            ("Grammar.g4", "ANTLR"),
            ("lexer.l", "Lex"),
            ("Tweak.xm", "Logos"),
            ("patch.maxpat", "Max"),
            ("app.arc", "Arc"),
            ("email.njk", "Nunjucks"),
            ("paper.tex", "TeX"),
            ("paper.ltx", "LaTeX"),
            ("page.roff", "Roff"),
            ("page.man", "Roff"),
            ("login.feature", "Gherkin"),
            ("song.ly", "LilyPond"),
            ("macros.m4", "M4"),
            ("module.wat", "WebAssembly"),
            ("module.wast", "WebAssembly"),
            ("Module.bsl", "1C Enterprise"),
            ("report.abap", "ABAP"),
            ("IMyService.aidl", "AIDL"),
            ("plot.gp", "Gnuplot"),
            ("plot.gnuplot", "Gnuplot"),
            ("game.nut", "Squirrel"),
            ("Proof.lean", "Lean"),
            ("notes.org", "Org"),
            ("model.scad", "OpenSCAD"),
        ];
        for (entity, expected) in cases {
            let result = detect(entity, b"content").unwrap();
            assert_eq!(result.language, expected, "entity: {entity}");
            assert_eq!(result.confidence, 1.0);
        }
    }

    #[test]
    fn matlab_m_extension_stays_objective_c_not_silently_reclaimed() {
        // Matlab's only conventional extension is `.m`, already Objective-C's
        // — confirms the deliberate non-mapping didn't get undone by a later
        // edit.
        let result = detect(
            "ViewController.m",
            b"#import <Foundation/Foundation.h>\n@interface ViewController : NSObject\n@end\n",
        )
        .unwrap();
        assert_eq!(result.language, "Objective-C");
    }

    #[test]
    fn detects_puppet_and_zig_with_reasonable_confidence() {
        let cases: &[(&str, &[u8], &str)] = &[
            (
                "site.pp",
                b"class greet {\n  notify { 'hello, world': }\n}\n\ninclude greet\n",
                "Puppet",
            ),
            (
                "greet.zig",
                b"const std = @import(\"std\");\n\npub fn main() void {\n    std.debug.print(\"hello\\n\", .{});\n}\n",
                "Zig",
            ),
            (
                "README.rst",
                b"Title\n=====\n\nThis is a paragraph with *emphasis* and a `link <https://example.com>`_.\n",
                "reStructuredText",
            ),
        ];
        for (entity, src, expected) in cases {
            let result = detect(entity, src).unwrap_or_else(|| panic!("no detection for {entity}"));
            assert_eq!(result.language, *expected, "entity: {entity}");
            assert!(
                result.confidence > 0.6,
                "{entity}: confidence too low ({})",
                result.confidence
            );
        }
    }

    #[test]
    fn pp_extension_is_puppet_not_pascal() {
        // `.pp` was deliberately left off Pascal's mapping for exactly this —
        // confirms it didn't get reclaimed by a later edit.
        let result = detect("site.pp", b"include greet\n").unwrap();
        assert_eq!(result.language, "Puppet");
    }

    #[test]
    fn chroma_diff_static_extensions_map_by_name() {
        let cases = [
            ("data.csv", "CSV"),
            ("schema.graphql", "GraphQL"),
            ("schema.gql", "GraphQL"),
            ("script.nu", "Nu"),
            ("query.xq", "XQuery"),
            ("query.xql", "XQuery"),
            ("query.xqm", "XQuery"),
            ("query.xquery", "XQuery"),
            ("Program.hx", "Haxe"),
            ("build.hxml", "Haxe"),
            ("Sig.sml", "Standard ML"),
            ("Form.vb", "VB.net"),
            ("styles.sass", "Sass"),
        ];
        for (entity, expected) in cases {
            let result = detect(entity, b"content").unwrap();
            assert_eq!(result.language, expected, "entity: {entity}");
            assert_eq!(result.confidence, 1.0);
        }
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
    fn cache_invalidates_when_editor_buffer_changes_without_a_disk_mtime_change() {
        let first = detect(
            "buffer.ts",
            b"import react from 'react';\nconst value: number = 1;",
        )
        .unwrap();
        let second = detect(
            "buffer.ts",
            b"import axios from 'axios';\nconst value: number = 2;",
        )
        .unwrap();
        assert!(first.dependencies.contains(&"react".to_string()));
        assert!(!first.dependencies.contains(&"axios".to_string()));
        assert!(second.dependencies.contains(&"axios".to_string()));
        assert!(!second.dependencies.contains(&"react".to_string()));
    }

    #[test]
    fn detect_file_reads_only_the_detection_prefix() {
        let unique = format!(
            "wakaclock-ast-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(format!("{unique}.py"));
        let mut source = b"import pathlib\n".to_vec();
        source.extend(std::iter::repeat_n(b'#', MAX_SOURCE_BYTES + 4096));
        std::fs::write(&path, source).unwrap();
        let result = detect_file(&path).unwrap().unwrap();
        std::fs::remove_file(&path).unwrap();
        assert_eq!(result.language, "Python");
        assert!(result.dependencies.contains(&"pathlib".to_string()));
    }

    #[test]
    fn concurrent_detection_is_consistent() {
        let cases = [
            (
                "a.rs",
                b"use serde::Serialize; fn main() {}".as_slice(),
                "Rust",
            ),
            ("b.py", b"import pathlib\nprint('ok')".as_slice(), "Python"),
            (
                "c.ts",
                b"import axios from 'axios'; const n: number = 1;".as_slice(),
                "TypeScript",
            ),
        ];
        std::thread::scope(|scope| {
            for (entity, source, language) in cases {
                scope.spawn(move || {
                    for _ in 0..32 {
                        assert_eq!(detect(entity, source).unwrap().language, language);
                    }
                });
            }
        });
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

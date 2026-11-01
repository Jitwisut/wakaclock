//! Turns daily file facts into modules for the Time Machine city.
//!
//! Heartbeats carry absolute paths, repeat a file once per worktree and include build output,
//! so everything here exists to reach one honest question: how much code does each part of
//! this project hold on each day. It reads no time and adds nothing to any duration.

use anyhow::Result;
use chrono::Utc;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::project_city::{
    CityCoverage, CityFile, CityModule, CityPoint, ProjectCityResponse,
    PROJECT_CITY_MAX_FILE_LINES, PROJECT_CITY_MAX_MODULES, PROJECT_CITY_MAX_ROWS,
    PROJECT_CITY_SCHEMA_VERSION,
};
use crate::repository::project_city::{CityFileDayRow, ProjectCityRepository};

const IGNORED_DIRECTORIES: [&str; 14] = [
    "__pycache__",
    "build",
    "coverage",
    "debug",
    "dist",
    "node_modules",
    "out",
    "output",
    "release",
    "target",
    "test-results",
    "tmp",
    "vendor",
    "venv",
];
const IGNORED_SUFFIXES: [&str; 19] = [
    ".d",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".jsonl",
    ".lock",
    ".log",
    ".map",
    ".min.css",
    ".min.js",
    ".o",
    ".pdf",
    ".png",
    ".rcgu.o",
    ".rlib",
    ".snap",
    ".svg",
    ".tsbuildinfo",
];
const IGNORED_FILES: [&str; 4] = [
    "Cargo.lock",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
];
const IGNORED_LANGUAGES: [&str; 7] = ["", "Binary", "CSV", "Image", "JSON", "Text", "Unknown"];
/// A folder holding more than this share of the code is split into its subfolders.
const SPLIT_SHARE: f64 = 0.12;
const MAX_MODULE_DEPTH: usize = 5;
const TOP_FILES: usize = 8;
const ROOT_SHARE: f64 = 0.6;
const OTHER_MODULE: &str = "other";

#[derive(Debug)]
pub struct TooManyRows;

impl std::fmt::Display for TooManyRows {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "project history is too large to draw")
    }
}

impl std::error::Error for TooManyRows {}

pub struct ProjectCityService {
    repository: ProjectCityRepository,
}

impl ProjectCityService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self {
            repository: ProjectCityRepository::new(clickhouse),
        }
    }

    pub async fn city(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        timezone: &str,
    ) -> Result<ProjectCityResponse> {
        let rows = self
            .repository
            .file_days(user_id, project_id, timezone)
            .await?;
        if rows.len() > PROJECT_CITY_MAX_ROWS {
            return Err(TooManyRows.into());
        }
        Ok(build_project_city(&rows, project_id, timezone))
    }
}

#[derive(Debug, PartialEq, Eq)]
enum Located {
    Relative(Vec<String>),
    Absolute(Vec<String>),
}

/// Worktree checkouts already end in a project-relative path, so they need no root search and
/// fold onto the same file as the main checkout.
fn locate(entity: &str) -> Option<Located> {
    if entity.contains("://") {
        return None;
    }
    let unified = entity.replace('\\', "/");
    let bytes = unified.as_bytes();
    let drive = bytes.len() > 1 && bytes[1] == b':';
    let absolute = unified.starts_with('/') || drive;
    let mut parts = unified
        .split('/')
        .filter(|part| !part.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    if drive {
        parts.remove(0);
    }
    if parts.iter().any(|part| part == ".." || part == ".") || parts.is_empty() {
        return None;
    }
    for index in 0..parts.len() {
        let skip = match parts[index].as_str() {
            ".worktrees" => 2,
            "worktrees" if index > 0 && parts[index - 1] == ".claude" => 2,
            "worktrees" if index > 0 && parts[index - 1] == ".codex" => 3,
            _ => continue,
        };
        let rest = parts.split_off((index + skip).min(parts.len()));
        return (!rest.is_empty()).then_some(Located::Relative(rest));
    }
    Some(if absolute {
        Located::Absolute(parts)
    } else {
        Located::Relative(parts)
    })
}

fn ignored_directory(name: &str) -> bool {
    name.starts_with('.') || IGNORED_DIRECTORIES.contains(&name)
}

fn ignored_file(parts: &[String]) -> bool {
    let Some((name, directories)) = parts.split_last() else {
        return true;
    };
    directories.iter().any(|part| ignored_directory(part))
        || IGNORED_FILES.contains(&name.as_str())
        || IGNORED_SUFFIXES.iter().any(|suffix| name.ends_with(suffix))
}

/// The directory most files share. A child only counts when it holds most of what remains, and
/// ignored children stop counting once a real one exists: otherwise a build folder holding
/// thousands of files would become the project root.
fn project_root(paths: &BTreeSet<Vec<String>>) -> Vec<String> {
    let mut root: Vec<String> = Vec::new();
    loop {
        let mut children: BTreeMap<&str, usize> = BTreeMap::new();
        for path in paths {
            if path.len() > root.len() + 1 && path[..root.len()] == root[..] {
                *children.entry(path[root.len()].as_str()).or_default() += 1;
            }
        }
        if children.keys().any(|name| !ignored_directory(name)) {
            children.retain(|name, _| !ignored_directory(name));
        }
        let total = children.values().sum::<usize>();
        let Some((name, count)) = children.iter().max_by_key(|(_, count)| **count) else {
            return root;
        };
        if total == 0 || (*count as f64) < total as f64 * ROOT_SHARE {
            return root;
        }
        root.push((*name).to_string());
    }
}

#[derive(Debug, Clone, Default)]
struct FileHistory {
    language: String,
    /// day index -> (lines, dependencies). A day only appears when something was reported.
    days: BTreeMap<usize, (Option<u32>, Option<BTreeSet<String>>)>,
    last_lines: u32,
    peak_lines: u32,
}

fn module_paths(files: &BTreeMap<String, u32>, total: u64) -> BTreeMap<String, String> {
    let mut assigned = BTreeMap::new();
    let mut folders: Vec<(String, Vec<&String>)> = vec![(String::new(), files.keys().collect())];
    while let Some((folder, members)) = folders.pop() {
        let depth = if folder.is_empty() {
            0
        } else {
            folder.split('/').count()
        };
        let lines = members
            .iter()
            .map(|path| u64::from(files[*path]))
            .sum::<u64>();
        let mut nested: BTreeMap<String, Vec<&String>> = BTreeMap::new();
        let mut direct = Vec::new();
        for path in members {
            let parts = path.split('/').collect::<Vec<_>>();
            if parts.len() > depth + 1 {
                nested
                    .entry(parts[..=depth].join("/"))
                    .or_default()
                    .push(path);
            } else {
                direct.push(path);
            }
        }
        let split = !nested.is_empty()
            && depth < MAX_MODULE_DEPTH
            && (depth == 0 || lines as f64 > total as f64 * SPLIT_SHARE);
        if split {
            let label = if folder.is_empty() {
                "(root)"
            } else {
                folder.as_str()
            };
            for path in direct {
                assigned.insert(path.clone(), label.to_string());
            }
            folders.extend(nested);
        } else {
            let label = if folder.is_empty() {
                "(root)"
            } else {
                folder.as_str()
            };
            for path in nested.into_values().flatten().chain(direct) {
                assigned.insert(path.clone(), label.to_string());
            }
        }
    }
    assigned
}

/// Pure so the path rules, module rules and history can be tested without a database.
pub fn build_project_city(
    rows: &[CityFileDayRow],
    project_id: Uuid,
    timezone: &str,
) -> ProjectCityResponse {
    let mut coverage = CityCoverage::default();
    let mut located = HashMap::new();
    let mut absolute = BTreeSet::new();
    for row in rows {
        if located.contains_key(row.entity.as_str()) {
            continue;
        }
        let place = locate(&row.entity);
        if let Some(Located::Absolute(parts)) = &place {
            absolute.insert(parts.clone());
        }
        located.insert(row.entity.as_str(), place);
    }
    let root = project_root(&absolute);

    let days = rows
        .iter()
        .map(|row| row.day.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let day_index = days
        .iter()
        .enumerate()
        .map(|(index, day)| (day.as_str(), index))
        .collect::<HashMap<_, _>>();

    let mut histories: BTreeMap<String, FileHistory> = BTreeMap::new();
    let mut ignored = BTreeSet::new();
    let mut outside = BTreeSet::new();
    for row in rows {
        let parts = match located.get(row.entity.as_str()).and_then(Option::as_ref) {
            Some(Located::Relative(parts)) => parts.clone(),
            Some(Located::Absolute(parts))
                if parts.starts_with(&root) && parts.len() > root.len() =>
            {
                parts[root.len()..].to_vec()
            }
            _ => {
                outside.insert(row.entity.as_str());
                continue;
            }
        };
        if ignored_file(&parts)
            || (!row.language.is_empty() && IGNORED_LANGUAGES.contains(&row.language.as_str()))
        {
            ignored.insert(parts.join("/"));
            continue;
        }
        let history = histories.entry(parts.join("/")).or_default();
        if !row.language.is_empty() {
            history.language.clone_from(&row.language);
        }
        let entry = history.days.entry(day_index[row.day.as_str()]).or_default();
        if row.lines > 0 {
            /* The same file in two worktrees on one day: keep the larger, never add them. */
            entry.0 = Some(entry.0.unwrap_or(0).max(row.lines));
            history.peak_lines = history.peak_lines.max(row.lines);
        }
        if !row.dependencies.is_empty() {
            entry
                .1
                .get_or_insert_with(BTreeSet::new)
                .extend(row.dependencies.iter().cloned());
        }
    }

    histories.retain(|path, history| {
        if history.language.is_empty() || history.peak_lines > PROJECT_CITY_MAX_FILE_LINES {
            ignored.insert(path.clone());
            return false;
        }
        if history.peak_lines == 0 {
            coverage.files_without_lines += 1;
            return false;
        }
        true
    });
    for history in histories.values_mut() {
        history.last_lines = history
            .days
            .values()
            .rev()
            .find_map(|(lines, _)| *lines)
            .unwrap_or(0);
    }

    let latest = histories
        .iter()
        .map(|(path, history)| (path.clone(), history.last_lines))
        .collect::<BTreeMap<_, _>>();
    let total = latest.values().map(|lines| u64::from(*lines)).sum::<u64>();
    let mut assigned = module_paths(&latest, total);

    let mut module_lines: BTreeMap<&str, u64> = BTreeMap::new();
    for (path, module) in &assigned {
        *module_lines.entry(module.as_str()).or_default() += u64::from(latest[path]);
    }
    let mut ranked = module_lines
        .into_iter()
        .map(|(module, lines)| (module.to_string(), lines))
        .collect::<Vec<_>>();
    ranked.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    if ranked.len() > PROJECT_CITY_MAX_MODULES {
        let kept = ranked
            .iter()
            .take(PROJECT_CITY_MAX_MODULES - 1)
            .map(|(module, _)| module.clone())
            .collect::<BTreeSet<_>>();
        for module in assigned.values_mut() {
            if !kept.contains(module) {
                *module = OTHER_MODULE.to_string();
            }
        }
    }

    let mut members: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for (path, module) in assigned {
        members.entry(module).or_default().push(path);
    }

    let modules = members
        .into_iter()
        .map(|(module, paths)| {
            let mut weights: BTreeMap<&str, u64> = BTreeMap::new();
            let mut changes: BTreeSet<usize> = BTreeSet::new();
            for path in &paths {
                let history = &histories[path];
                *weights.entry(history.language.as_str()).or_default() +=
                    u64::from(history.last_lines);
                changes.extend(history.days.keys().copied());
            }
            let language = weights
                .iter()
                .max_by_key(|(name, lines)| (**lines, std::cmp::Reverse(**name)))
                .map(|(name, _)| (*name).to_string())
                .unwrap_or_default();

            let mut lines_now: BTreeMap<&str, u32> = BTreeMap::new();
            let mut deps_now: BTreeMap<&str, &BTreeSet<String>> = BTreeMap::new();
            let mut series: Vec<CityPoint> = Vec::new();
            for day in changes {
                for path in &paths {
                    if let Some((lines, dependencies)) = histories[path].days.get(&day) {
                        if let Some(lines) = lines {
                            lines_now.insert(path.as_str(), *lines);
                        }
                        if let Some(dependencies) = dependencies {
                            deps_now.insert(path.as_str(), dependencies);
                        }
                    }
                }
                let lines = lines_now
                    .values()
                    .map(|value| u64::from(*value))
                    .sum::<u64>();
                let files = lines_now.len() as u32;
                let dependencies = deps_now
                    .values()
                    .copied()
                    .flatten()
                    .collect::<BTreeSet<_>>()
                    .len() as u32;
                let changed = series.last().is_none_or(|last| {
                    last.lines != lines || last.files != files || last.dependencies != dependencies
                });
                if changed {
                    series.push(CityPoint {
                        day,
                        lines,
                        files,
                        dependencies,
                    });
                }
            }

            let mut top_files = paths
                .iter()
                .map(|path| CityFile {
                    path: path.clone(),
                    lines: histories[path].last_lines,
                })
                .collect::<Vec<_>>();
            top_files.sort_by(|a, b| b.lines.cmp(&a.lines).then_with(|| a.path.cmp(&b.path)));
            top_files.truncate(TOP_FILES);

            CityModule {
                area: module.split('/').next().unwrap_or(&module).to_string(),
                path: module,
                language,
                series,
                top_files,
            }
        })
        .collect();

    coverage.files_included = histories.len();
    coverage.files_ignored = ignored.len();
    coverage.files_outside_root = outside.len();
    ProjectCityResponse {
        coverage,
        days,
        generated_at: Utc::now().to_rfc3339(),
        modules,
        project_id,
        schema_version: PROJECT_CITY_SCHEMA_VERSION,
        timezone: timezone.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOME: &str = "/Users/someone/Desktop/shop";

    fn row(entity: &str, day: &str, lines: u32, deps: &[&str]) -> CityFileDayRow {
        CityFileDayRow {
            entity: entity.to_string(),
            day: day.to_string(),
            lines,
            language: "Rust".to_string(),
            dependencies: deps.iter().map(|value| (*value).to_string()).collect(),
        }
    }

    fn city(rows: &[CityFileDayRow]) -> ProjectCityResponse {
        build_project_city(rows, Uuid::nil(), "UTC")
    }

    fn module<'a>(city: &'a ProjectCityResponse, path: &str) -> &'a CityModule {
        city.modules
            .iter()
            .find(|module| module.path == path)
            .unwrap_or_else(|| panic!("missing {path}: {:?}", city.modules))
    }

    /// Enough files that the project root is the shared parent, not one subfolder.
    fn spread() -> Vec<CityFileDayRow> {
        ["api", "web", "docs"]
            .iter()
            .flat_map(|folder| {
                (0..4).map(move |index| {
                    row(
                        &format!("{HOME}/{folder}/f{index}.rs"),
                        "2026-08-01",
                        100,
                        &[],
                    )
                })
            })
            .collect()
    }

    #[test]
    fn wire_format_never_carries_an_absolute_path_or_home_directory() {
        let mut rows = spread();
        rows.push(row(
            "C:\\Users\\someone\\shop\\api\\win.rs",
            "2026-08-01",
            50,
            &[],
        ));
        let json = serde_json::to_string(&city(&rows)).unwrap();
        assert!(!json.contains("/Users"));
        assert!(!json.contains("someone"));
        assert!(!json.contains("Desktop"));
        assert!(!json.contains("C:"));
        assert!(json.contains("api/f0.rs"));
    }

    #[test]
    fn worktrees_fold_onto_the_same_file_as_the_main_checkout() {
        let mut rows = spread();
        rows.push(row(
            &format!("{HOME}/.worktrees/feat-a/api/f0.rs"),
            "2026-08-02",
            250,
            &[],
        ));
        rows.push(row(
            &format!("{HOME}/.claude/worktrees/x/api/f0.rs"),
            "2026-08-02",
            200,
            &[],
        ));
        rows.push(row(
            "/Users/someone/.codex/worktrees/job/shop/api/f0.rs",
            "2026-08-02",
            180,
            &[],
        ));
        let built = city(&rows);
        assert_eq!(built.coverage.files_included, 12);
        let file = module(&built, "api")
            .top_files
            .iter()
            .find(|f| f.path == "api/f0.rs")
            .unwrap();
        assert_eq!(
            file.lines, 250,
            "one file, and the worktrees are never added together"
        );
    }

    #[test]
    fn a_large_build_folder_cannot_become_the_project_root() {
        let mut rows = spread();
        for index in 0..500 {
            rows.push(row(
                &format!("{HOME}/output/run/{index}.rs"),
                "2026-08-01",
                10,
                &[],
            ));
        }
        let built = city(&rows);
        assert_eq!(built.coverage.files_included, 12);
        assert_eq!(built.coverage.files_ignored, 500);
        assert!(built.modules.iter().any(|module| module.path == "web"));
    }

    #[test]
    fn a_home_folder_named_like_build_output_does_not_hide_the_project() {
        let rows = ["api", "web"]
            .iter()
            .flat_map(|folder| {
                (0..3).map(move |i| {
                    row(
                        &format!("/home/me/build/shop/{folder}/{i}.rs"),
                        "2026-08-01",
                        90,
                        &[],
                    )
                })
            })
            .collect::<Vec<_>>();
        assert_eq!(city(&rows).coverage.files_included, 6);
    }

    #[test]
    fn ignores_generated_files_binaries_and_unknown_languages() {
        let mut rows = spread();
        rows.push(row(
            &format!("{HOME}/api/Cargo.lock"),
            "2026-08-01",
            900,
            &[],
        ));
        rows.push(row(
            &format!("{HOME}/api/bundle.min.js"),
            "2026-08-01",
            900,
            &[],
        ));
        rows.push(row(
            &format!("{HOME}/debug/deps/core.rcgu.o"),
            "2026-08-01",
            9000,
            &[],
        ));
        rows.push(row(
            &format!("{HOME}/.claude/plan.rs"),
            "2026-08-01",
            900,
            &[],
        ));
        let mut text = row(&format!("{HOME}/api/notes.txt"), "2026-08-01", 900, &[]);
        text.language = "Text".to_string();
        rows.push(text);
        let mut huge = row(
            &format!("{HOME}/api/data.rs"),
            "2026-08-01",
            PROJECT_CITY_MAX_FILE_LINES + 1,
            &[],
        );
        huge.language = "Rust".to_string();
        rows.push(huge);
        let built = city(&rows);
        assert_eq!(built.coverage.files_included, 12);
        assert_eq!(built.coverage.files_ignored, 6);
    }

    #[test]
    fn drops_urls_traversal_and_files_outside_the_root() {
        let mut rows = spread();
        rows.push(row("https://example.com/page", "2026-08-01", 10, &[]));
        rows.push(row(&format!("{HOME}/../secret.rs"), "2026-08-01", 10, &[]));
        rows.push(row("/private/tmp/scratch.rs", "2026-08-01", 10, &[]));
        let built = city(&rows);
        assert_eq!(built.coverage.files_outside_root, 3);
        assert_eq!(built.coverage.files_included, 12);
    }

    #[test]
    fn relative_entities_keep_their_path() {
        let built = city(&[row("src/main.rs", "2026-08-01", 40, &[])]);
        assert_eq!(built.modules[0].top_files[0].path, "src/main.rs");
    }

    #[test]
    fn splits_only_the_folders_that_hold_a_large_share_of_the_code() {
        let mut rows = Vec::new();
        for (folder, lines) in [
            ("web/pages", 900),
            ("web/lib", 800),
            ("docs", 40),
            ("deploy", 10),
        ] {
            for index in 0..3 {
                rows.push(row(
                    &format!("{HOME}/{folder}/f{index}.rs"),
                    "2026-08-01",
                    lines,
                    &[],
                ));
            }
        }
        let built = city(&rows);
        let paths = built
            .modules
            .iter()
            .map(|m| m.path.as_str())
            .collect::<Vec<_>>();
        assert_eq!(paths, vec!["deploy", "docs", "web/lib", "web/pages"]);
        assert_eq!(module(&built, "web/lib").area, "web");
    }

    #[test]
    fn caps_the_module_count_by_folding_the_smallest_into_other() {
        let rows = (0..60)
            .map(|index| {
                row(
                    &format!("{HOME}/m{index}/lib.rs"),
                    "2026-08-01",
                    100 + index,
                    &[],
                )
            })
            .collect::<Vec<_>>();
        let built = city(&rows);
        assert_eq!(built.modules.len(), PROJECT_CITY_MAX_MODULES);
        assert!(built.modules.iter().any(|m| m.path == OTHER_MODULE));
        assert!(
            built.modules.iter().any(|m| m.path == "m59"),
            "largest stays"
        );
    }

    #[test]
    fn history_carries_values_forward_and_shrinks_with_the_code() {
        let mut rows = spread();
        rows.push(row(
            &format!("{HOME}/api/f0.rs"),
            "2026-08-02",
            400,
            &["serde", "tokio"],
        ));
        rows.push(row(
            &format!("{HOME}/api/f1.rs"),
            "2026-08-03",
            0,
            &["axum"],
        ));
        rows.push(row(&format!("{HOME}/api/f0.rs"), "2026-08-04", 100, &[]));
        let built = city(&rows);
        assert_eq!(built.days.len(), 4);
        let series = &module(&built, "api").series;
        assert_eq!(
            series[0],
            CityPoint {
                day: 0,
                lines: 400,
                files: 4,
                dependencies: 0
            }
        );
        assert_eq!(
            series[1],
            CityPoint {
                day: 1,
                lines: 700,
                files: 4,
                dependencies: 2
            }
        );
        assert_eq!(
            series[2],
            CityPoint {
                day: 2,
                lines: 700,
                files: 4,
                dependencies: 3
            }
        );
        assert_eq!(
            series[3],
            CityPoint {
                day: 3,
                lines: 400,
                files: 4,
                dependencies: 3
            }
        );
    }

    #[test]
    fn a_day_with_no_change_adds_no_point() {
        let mut rows = spread();
        rows.push(row(&format!("{HOME}/api/f0.rs"), "2026-08-02", 100, &[]));
        rows.push(row(&format!("{HOME}/api/f0.rs"), "2026-08-03", 110, &[]));
        let built = city(&rows);
        let days = module(&built, "api")
            .series
            .iter()
            .map(|p| p.day)
            .collect::<Vec<_>>();
        assert_eq!(days, vec![0, 2]);
    }

    #[test]
    fn a_file_with_no_line_count_is_reported_not_guessed() {
        let mut rows = spread();
        rows.push(row(&format!("{HOME}/api/empty.rs"), "2026-08-01", 0, &[]));
        let built = city(&rows);
        assert_eq!(built.coverage.files_without_lines, 1);
        assert_eq!(built.coverage.files_included, 12);
    }

    #[test]
    fn top_files_are_largest_first_and_bounded() {
        let rows = (0..12)
            .map(|index| {
                row(
                    &format!("{HOME}/api/f{index}.rs"),
                    "2026-08-01",
                    10 + index,
                    &[],
                )
            })
            .collect::<Vec<_>>();
        let built = city(&rows);
        let top = &built.modules[0].top_files;
        assert_eq!(top.len(), TOP_FILES);
        assert_eq!(top[0].lines, 21);
    }

    #[test]
    fn an_empty_project_is_an_empty_city() {
        let built = city(&[]);
        assert!(built.modules.is_empty());
        assert!(built.days.is_empty());
    }

    #[tokio::test]
    #[ignore = "requires isolated CLICKHOUSE_TEST_URL with heartbeats"]
    async fn draws_the_busiest_projects_from_clickhouse() {
        #[derive(clickhouse::Row, serde::Deserialize)]
        struct Busy {
            #[serde(with = "clickhouse::serde::uuid")]
            user_id: Uuid,
            #[serde(with = "clickhouse::serde::uuid")]
            busy_project: Uuid,
            rows: u64,
        }
        let client = crate::test_support::clickhouse_client().await;
        let busiest = client
            .get_client()
            .query(
                "SELECT user_id, assumeNotNull(project_id) AS busy_project, count() AS rows
                 FROM wakaclock.heartbeats_canonical
                 WHERE project_id IS NOT NULL AND entity_type = 'file'
                 GROUP BY user_id, busy_project ORDER BY rows DESC LIMIT 4",
            )
            .fetch_all::<Busy>()
            .await
            .unwrap();
        assert!(!busiest.is_empty());
        let service = ProjectCityService::new(client);
        for project in busiest {
            let started = std::time::Instant::now();
            let city = service
                .city(project.user_id, project.busy_project, "Asia/Bangkok")
                .await
                .unwrap();
            let json = serde_json::to_string(&city).unwrap();
            let elapsed = started.elapsed().as_millis();
            assert!(!json.contains("/Users/"), "absolute path leaked");
            assert!(!json.contains("/home/"), "absolute path leaked");
            let mut ranked = city
                .modules
                .iter()
                .map(|module| (module.series.last().map_or(0, |p| p.lines), module))
                .collect::<Vec<_>>();
            ranked.sort_by_key(|entry| std::cmp::Reverse(entry.0));
            println!(
                "rows={} days={} modules={} json={}KB {}ms coverage={:?}",
                project.rows,
                city.days.len(),
                city.modules.len(),
                json.len() / 1024,
                elapsed,
                city.coverage
            );
            for (lines, module) in ranked.iter().take(10) {
                let last = module.series.last().unwrap();
                println!(
                    "  {:>7} lines {:>4} files {:>3} deps {} [{}]",
                    lines, last.files, last.dependencies, module.path, module.language
                );
            }
        }
    }

    #[test]
    fn response_has_no_duration_fields() {
        let json = serde_json::to_string(&city(&spread())).unwrap();
        for field in ["seconds", "duration", "active", "total_time"] {
            assert!(!json.contains(field), "{field}");
        }
    }
}

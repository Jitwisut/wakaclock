use serde::Serialize;
use uuid::Uuid;

pub const PROJECT_CITY_SCHEMA_VERSION: u32 = 1;
/// A refused project stays honest; a truncated history would draw a smaller city.
pub const PROJECT_CITY_MAX_ROWS: usize = 200_000;
pub const PROJECT_CITY_MAX_MODULES: usize = 40;
/// A file longer than this is almost always generated, vendored or data.
pub const PROJECT_CITY_MAX_FILE_LINES: u32 = 20_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CityPoint {
    /// Index into `ProjectCityResponse::days`. Only changes are listed.
    pub day: usize,
    pub lines: u64,
    pub files: u32,
    pub dependencies: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CityFile {
    pub path: String,
    pub lines: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CityModule {
    pub path: String,
    pub area: String,
    pub language: String,
    pub series: Vec<CityPoint>,
    pub top_files: Vec<CityFile>,
}

/// What the city could not include, so the page can say so.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct CityCoverage {
    pub files_included: usize,
    pub files_without_lines: usize,
    pub files_ignored: usize,
    pub files_outside_root: usize,
}

/// Paths here are relative to the project. Absolute paths carry the account's home directory
/// and machine layout, so they never leave the service.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProjectCityResponse {
    pub coverage: CityCoverage,
    pub days: Vec<String>,
    pub generated_at: String,
    pub modules: Vec<CityModule>,
    pub project_id: Uuid,
    pub schema_version: u32,
    pub timezone: String,
}

# Language registry contract

The WakaTime-compatible `GET /api/v1/program_languages` endpoint returns the
canonical names used by AtoAxis telemetry. The registry version is exposed by
`GET /api/v1/meta` so clients and reprocessing jobs can pin the detection rules
that produced historical values.

Detection precedence is fixed as:

1. editor-provided language ID;
2. file extension;
3. filename pattern;
4. shebang;
5. tree-sitter/AST detection;
6. plain-text fallback.

The current catalog is an additive seed and is intentionally reported as such;
aliases are not silently renamed because that would change historical
analytics. The remaining Phase 10 work is to import the versioned GitHub
Linguist dataset, preserve AtoAxis aliases, add generated extension/name
indexes and raise the benchmark to at least 600 languages before the registry
is marked `production_ready`.

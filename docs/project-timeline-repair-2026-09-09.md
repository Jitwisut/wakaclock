# Local timeline project repair — 2026-09-09

The unexpected `scenario-*` projects were real heartbeat records from disposable
Codex certification repositories, not labels invented by the dashboard. The
campaign creates Git repositories under temporary `workspace/scenario-*` paths.
Some records had no project after those temporary directories disappeared.

API identity isolation was not sufficient: campaign transcripts written to the
personal Codex home could later be replayed by the personal background collector.
The campaign driver now requires an explicit, separately authenticated Codex home
and rejects the active home, the default personal home, their descendants, and
symlink aliases. This remains enforced even with `--allow-shared-account`.
No credentials are copied, and normal project detection is unchanged.

## Local data repair

- Resolved the account through the authenticated localhost API, rather than using
  the potentially stale user ID in CLI configuration.
- Verified original paths in ClickHouse. Selected 31 certification heartbeat IDs
  by known temporary workspace paths, not by project labels alone.
- Removed two additional records for the verified temporary UI test helper
  `/tmp/waka-ui-followup.cjs`.
- Backed up complete heartbeat and activity interval rows in private local files
  before calling the existing user-scoped bulk deletion endpoint.
- Deletion tombstones prevent the same heartbeat IDs from returning on retry.
- Compared remaining raw records against the original snapshot; unrelated rows
  were retained.
- Verified the September 9 timeline in Asia/Bangkok through the durations API:
  its project set is exactly `mong`, `wakaclock`.

Backups on the repaired machine are in `/private/tmp/wakaclock-project-repair-9g23w70o`
and `/private/tmp/wakaclock-project-repair-rbw5x9ku`. These contain private activity
records, are not committed, and should be retained if rollback is needed. Restoring
requires restoring the rows and removing only the corresponding deletion tombstones.

Validation: campaign driver unit tests, including shared transcript-home rejection.
Historical projects on other dates and unrelated unassigned work were preserved.

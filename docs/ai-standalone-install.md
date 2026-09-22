# Terminal-only installation

Users who do not run VS Code can install the on-demand CLI directly:

```sh
curl -fsSL https://get.atoaxis.com | sh
```

The installer places `wakaclock` in `~/.local/bin`, snapshots existing SQLite state,
removes any retired per-user service registration, and runs the idempotent AI setup
pass. It never registers a LaunchAgent, systemd unit, scheduled task, local HTTP
broker, or long-lived collector. Hook configuration is written only for adapters with
an explicit consent record. To grant consent in a scripted environment, pass `--yes`
to the CLI setup command:

```sh
wakaclock ai setup --all --yes --json
```

The installer accepts `WAKACLOCK_PREFIX`, `WAKACLOCK_VERSION`,
`WAKACLOCK_ARCHIVE_URL`, and (for an internal mirror) `WAKACLOCK_RELEASE_BASE_URL`.
For an air-gapped machine, set `WAKACLOCK_BINARY` to a previously verified binary.
`WAKACLOCK_SHA256` is optional and, when supplied, is checked before extraction.

All integrations send metadata only: no prompt, response, command arguments,
source text, patch body, or clipboard content is read or uploaded. Use
`wakaclock sync --json` processes pending transcripts and queue rows once. Use
`wakaclock doctor ai --json` to inspect on-demand queue state, pipeline stages, and the
bounded hook setup audit log.

# Wakaclock VS Code Extension

This extension captures VS Code editor activity, buffers it in memory, and delegates heartbeat delivery to `wakaclock-cli`.

## Requirements

- `wakaclock-cli` available on your `PATH`, or configured explicitly with `wakaclock.cliPath`
- A working Wakaclock backend and config at `~/.wakaclock/config.toml`

## Settings

- `wakaclock.cliPath`: absolute path to `wakaclock-cli`
- `wakaclock.flushIntervalSeconds`: buffer flush interval, default `30`
- `wakaclock.sameFileHeartbeatMinutes`: same-file gap threshold, default `2`
- `wakaclock.idleMinutes`: idle threshold, default `5`
- `wakaclock.statusBarEnabled`: show today's total in the status bar
- `wakaclock.debugLogging`: enable verbose extension logging
- `wakaclock.trackDebugSessions`: emit debugging heartbeats
- `wakaclock.trackBuildTasks`: emit building heartbeats

Example:

```json
{
  "wakaclock.cliPath": "C:/Users/tanza/Desktop/wakaclock/backend/api/target/debug/wakaclock-cli.exe",
  "wakaclock.statusBarEnabled": true
}
```

## Behavior

- Typing updates an in-memory per-file buffer
- Save always flushes immediately with `is_write=true`
- File switches flush the previous file
- The extension flushes pending typing every 30 seconds by default
- Debug and task lifecycle events send `debugging` and `building` heartbeats
- The status bar uses `wakaclock-cli today`

## Local development

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch the extension host.

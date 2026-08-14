# AtoAxis — Developer Time Tracking for VS Code

AtoAxis records how long you spend coding in VS Code and breaks it down by project,
programming language, branch and editor. This extension captures editor activity,
buffers it in memory, and delegates heartbeat delivery to `wakaclock-cli`, which sends
it to a self-hosted AtoAxis server you run yourself.

> **Naming:** the product is AtoAxis, but the CLI binary, config directory and setting
> keys still ship under the original `wakaclock` name. Commands below are written
> exactly as you must type them.

## Key features

- Tracks coding time per file, project, branch and language
- Records keystrokes and characters added or deleted
- Emits `debugging` heartbeats for debug sessions and `building` heartbeats for tasks
- Shows today's total coding time in the status bar
- Stores your API key in VS Code secret storage, not in `settings.json`
- Buffers activity in memory and flushes on an interval instead of sending per keystroke

## Requirements

- VS Code 1.90 or newer
- `wakaclock-cli` on your `PATH`, or configured via `wakaclock.cliPath`
- A running AtoAxis server and a config file at `~/.wakaclock/config.toml`

## Installation

Install the extension, then set your API key from the command palette:

```
> Wakaclock: Set API Key
> Wakaclock: Configure CLI Path   # only if the binary is not on PATH
```

Alternatively, point at an explicit binary in `settings.json`:

```json
{
  "wakaclock.cliPath": "/usr/local/bin/wakaclock-cli",
  "wakaclock.statusBarEnabled": true
}
```

Verify that tracking works:

```bash
wakaclock-cli status   # server reachable and key present
wakaclock-cli today    # today's total
```

## How it works

- Typing updates an in-memory buffer for the current file
- Saving flushes immediately and marks the heartbeat as a write
- Switching files flushes the file you left
- Pending typing is flushed on a timer, every 30 seconds by default
- Resuming the same file after a gap starts a new heartbeat window
- Background heartbeats stop after the idle threshold passes with no activity
- The status bar total comes from `wakaclock-cli today`

## Supported editors

This is the only editor plugin published for AtoAxis. Other editors can still send
data: the AtoAxis heartbeat API is WakaTime-compatible, so any editor with a WakaTime
plugin can point its `api_url` at your AtoAxis server instead.

## AI tracking

After installation, run `AtoAxis: Show AI Tracking Status`. If Claude Code, Codex CLI or
Gemini CLI is present, `AtoAxis: Set Up AI Tracking` registers the corresponding hook
with a stable path that survives VS Code extension updates. The first activation also
offers this setup once; it never edits another tool's config without your confirmation.
The configured `wakaclock.cliPath` is mirrored to `~/.wakaclock/cli-path` so hooks can
use an absolute CLI path even when the binary is not on the AI tool's `PATH`.

The hooks send only metadata: agent/provider, optional model, file path, line deltas,
timestamp and a stable event id. Claude Code is attributed to Anthropic, Codex to
OpenAI, and Gemini CLI to Google. The dashboard aggregates AI lines separately from
human lines and keystrokes.

Run `AtoAxis: Repair AI Integrations` after changing an agent installation or if an
agent reports that its hook path no longer exists. Cursor, Copilot and other IDE-only
providers are shown as unsupported until they expose an event/telemetry adapter; the
extension does not guess their identity from typing speed or code shape.

## Privacy

Heartbeats contain metadata only: file path, project, branch, detected language, line
and character counts, editor and operating system. They never contain the contents of
your files, anything you typed, or AI prompts and responses. Data is written to a
ClickHouse database on infrastructure you control.

## Settings

| Setting                              | Default | Description                                            |
| ------------------------------------ | ------- | ------------------------------------------------------ |
| `wakaclock.cliPath`                  | `""`    | Absolute path to `wakaclock-cli`; empty resolves `PATH` |
| `wakaclock.flushIntervalSeconds`     | `30`    | How often buffered typing is flushed                    |
| `wakaclock.sameFileHeartbeatMinutes` | `2`     | Gap after which the same file starts a new window       |
| `wakaclock.idleMinutes`              | `5`     | Stop background heartbeats after this much inactivity   |
| `wakaclock.statusBarEnabled`         | `true`  | Show today's total in the status bar                    |
| `wakaclock.trackDebugSessions`       | `true`  | Emit `debugging` heartbeats                             |
| `wakaclock.trackBuildTasks`          | `true`  | Emit `building` heartbeats                              |
| `wakaclock.debugLogging`             | `false` | Verbose logging in the extension host console           |

## Commands

| Command                          | Description                            |
| -------------------------------- | -------------------------------------- |
| `Wakaclock: Set API Key`         | Store your API key in secret storage   |
| `Wakaclock: Clear API Key`       | Remove the stored key                  |
| `Wakaclock: Configure CLI Path`  | Point the extension at the CLI binary  |
| `AtoAxis: Set Up AI Tracking`    | Install hooks for detected AI CLIs     |
| `AtoAxis: Show AI Tracking Status` | Show detected/enabled AI integrations |
| `AtoAxis: Repair AI Integrations` | Re-register managed AI hooks           |
| `Wakaclock: Show Today's Total`  | Display today's tracked time           |
| `Wakaclock: Send Heartbeat Now`  | Flush pending activity immediately     |
| `Wakaclock: Toggle Status Bar`   | Show or hide the status bar item       |

## Limitations

- Sends file activity only — no `app`, `domain` or `url` heartbeats
- AI hooks currently cover Claude Code, Codex CLI and Gemini CLI; Cursor/Copilot need
  provider-specific adapters
- Requires `wakaclock-cli`; it does not talk to the server directly

## Local development

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch the extension host.

## Links

- [Getting started](https://github.com/Jitwisut/wakaclock#readme)
- [Issues](https://github.com/Jitwisut/wakaclock/issues)

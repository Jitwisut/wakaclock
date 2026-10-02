# AtoAxis — Developer Time Tracking for VS Code

AtoAxis records how long you spend coding in VS Code and breaks it down by project,
programming language, branch and editor. This extension captures editor activity,
buffers it in memory, and delegates heartbeat delivery to the `wakaclock` binary, which sends
it to the hosted AtoAxis API. The Marketplace package contains the native CLI for
your operating system, so no Rust toolchain, terminal process or manual binary path
is required.

> **Naming:** the product is AtoAxis, but the CLI binary, config directory and setting
> keys still ship under the original `wakaclock` name. Commands below are written
> exactly as you must type them.

## Key features

- Tracks coding time per file, project, branch and language
- Records keystrokes and characters added or deleted
- Emits `debugging` heartbeats for debug sessions and `building` heartbeats for tasks
- Shows today's total coding time in the status bar
- Stores your API key in VS Code secret storage, not in `settings.json`
- Sends the first edit/save/switch marker immediately, then rate-limits the same file to
  120 seconds while new activity continues
- Keeps one global activity timeline so switching files cannot count the same seconds twice
- Shows server-confirmed, offline-queued and local-buffer seconds (including seconds), and
  stops increasing as soon as activity stops

## Requirements

- VS Code 1.90 or newer
- An AtoAxis API key from your account

## Installation

Install the platform-specific AtoAxis extension from the VS Code Marketplace, then
set your API key from the command palette:

```
> AtoAxis: Set API Key
```
The extension verifies the candidate key before replacing an existing one. If the
server is temporarily offline, it keeps the key pending and queues activity locally.
The status bar shows `AtoAxis: Connect`, `Connecting`, `Verified` or `Offline queued`.

## How it works

- Typing updates an in-memory buffer for the current file
- Saving flushes immediately and marks the heartbeat as a write
- A workspace-scoped filesystem receiver also watches writes made outside VS Code
  (for example Codex Desktop `apply_patch`). It coalesces atomic-save bursts and sends
  an isolated write heartbeat even when no document-change event is raised.
- Switching files flushes the file you left
- A 30-second timer checks buffers, but does not bypass the 120-second heartbeat cadence
- Resuming the same file after a gap starts a new heartbeat window; gaps over 120 seconds
  are never counted, even when the deprecated `idleMinutes` setting is 15
- CLI delivery is serialized and retains activity that arrives while a request is in flight
- The status bar refreshes every 15 seconds and renders local activity immediately without
  creating a persisted or visual tail after the final event

## Supported editors

This is the only editor plugin published for AtoAxis. Other editors can still send
data: the AtoAxis heartbeat API is WakaTime-compatible, so any editor with a WakaTime
plugin can point its `api_url` at your AtoAxis server instead.

## AI tracking

After the API key is verified, AtoAxis detects Claude Code, Codex CLI, Gemini CLI, Kilo
Code and Kimi Code CLI in the background. A multi-select consent dialog lets you enable
each tool independently;
`Not now` defers the prompt and `Don't ask again` disables it. Only after consent does
the extension install hooks/transcript watching and write the key to the protected
agent config. The local AI Activity Broker accepts these events durably before handing
them to the existing heartbeat/outbound queue, and scans transcripts every five
seconds, so AI edits are still recorded when VS Code is closed. Use
`wakaclock broker status --json` or `AtoAxis: Show AI Broker Status` to inspect
pending/retry/dead-letter work. Windows and hosts without a service manager use the
broker as an Extension Host child while the remote workspace is open.
Kilo Code is installed as a managed TypeScript plugin under
`~/.config/kilo/plugin/` (one top-level entrypoint plus private helper modules);
Kimi Code CLI uses a marker-bounded Beta hook block in `~/.kimi-code/config.toml`
or the legacy `~/.kimi/config.toml`. Both adapters preserve user configuration and
remain marked scaffold until a real tool run and broker row are inspected.

The hooks send only metadata: agent/provider, optional model, file path, line deltas,
timestamp and a stable event id. Claude Code is attributed to Anthropic, Codex to
OpenAI, Gemini CLI to Google, and Kilo/Kimi preserve the provider selected for the
request. The dashboard aggregates AI lines separately from human lines and keystrokes.
Kilo inline autocomplete is not claimed as AI evidence without an explicit acceptance
event.

When an external filesystem write is received without a matching native AI sidecar,
the heartbeat remains `unknown`/`unattributed`; the receiver never guesses that a
formatter, build, human process or AI wrote the file. A matching sidecar fingerprint
and line delta means the native AI heartbeat is authoritative, so the receiver
suppresses its duplicate. Without that proof the external marker remains
`unknown`/`unattributed`.

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
| `wakaclock.cliPath`                  | `""`    | Advanced global development override; bundled CLI is used by default |
| `wakaclock.serverUrl`                | `https://api.atoaxis.com` | Advanced global server-origin override |
| `wakaclock.flushIntervalSeconds`     | `30`    | How often buffered activity is checked                  |
| `wakaclock.heartbeatRateLimitSeconds`| `120`   | Strict heartbeat/activity gap; gaps over 120s add zero |
| `wakaclock.sameFileHeartbeatMinutes` | `2`     | Deprecated alias for the rate limit                     |
| `wakaclock.idleMinutes`              | `15`    | Deprecated; strict activity timing always uses 120 seconds |
| `wakaclock.statusBarEnabled`         | `true`  | Show today's total in the status bar                    |
| `wakaclock.trackDebugSessions`       | `true`  | Emit `debugging` heartbeats                             |
| `wakaclock.trackBuildTasks`          | `true`  | Emit `building` heartbeats                              |
| `wakaclock.debugLogging`             | `false` | Verbose logging in the extension host console           |
| `wakaclock.trackClipboardActions`    | `true`  | Track metadata-only copy/paste counts; clipboard contents are never sent or stored |

## Commands

| Command                          | Description                            |
| -------------------------------- | -------------------------------------- |
| `AtoAxis: Set API Key`         | Store your API key in secret storage   |
| `AtoAxis: Clear API Key`       | Remove the stored key                  |
| `AtoAxis: Configure CLI Path`  | Point the extension at the CLI binary  |
| `AtoAxis: Set Up AI Tracking`    | Install hooks for detected AI CLIs     |
| `AtoAxis: Show AI Tracking Status` | Show detected/enabled AI integrations |
| `AtoAxis: Repair AI Integrations` | Re-register managed AI hooks           |
| `AtoAxis: Show Today's Total`  | Display today's tracked time           |
| `AtoAxis: Send Heartbeat Now`  | Flush pending activity immediately     |
| `AtoAxis: Toggle Status Bar`   | Show or hide the status bar item       |

## Limitations

- Sends file activity only — no `app`, `domain` or `url` heartbeats
- AI hooks currently cover Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code
  CLI; Cursor/Copilot need provider-specific adapters
- Native binaries are bundled per Marketplace target; unsupported platforms are
  rejected with a clear CLI-unavailable status rather than executing an unverified file

## Local development

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch the extension host. If the extension is already
running from the symlinked checkout, run **Developer: Reload Window** after compiling;
the Extension Host keeps the previously loaded JavaScript until the window reloads.

## Links

- [Getting started](https://github.com/Jitwisut/wakaclock#readme)
- [Issues](https://github.com/Jitwisut/wakaclock/issues)

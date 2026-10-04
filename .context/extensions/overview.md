# Client Extensions

Four client surfaces under [../../extensions/](../../extensions/). All are
**heartbeat producers** — they send to `POST /api/v1/heartbeats` (or
`/heartbeats.bulk`) and never read analytics.

Shipping identity is **AtoAxis** throughout; `wakaclock` is the internal/command
namespace.

## `extensions/vscode` — VS Code extension

Package `atoaxis-vscode`, publisher `atoaxis`, entry
`out/src/extension.js`, source [../../extensions/vscode/src/](../../extensions/vscode/src/).

| Module | Role |
| --- | --- |
| `extension.ts` | activation, wiring |
| `events.ts`, `activity.ts` | editor event → activity signal |
| `buffer.ts` | batching before send |
| `cli.ts`, `managedCli.ts` | locates / manages the `wakaclock-cli` binary |
| `aiAttribution.ts`, `agentSetup.ts` | AI-agent detection and hook installation |
| `secrets.ts` | API key storage via VS Code SecretStorage |
| `config.ts`, `statusBar.ts`, `commands.ts`, `logging.ts`, `utils.ts` | |

**The extension does not talk HTTP itself — it shells out to the Rust CLI.**
Ingest behaviour changes usually belong in
[../backend/crates.md](../backend/crates.md), not here.

**Project names are decided by the CLI, not the extension.** The extension sends
the VS Code workspace-folder name as `--alternate-project` (and
`alternate_project` in `--extra-heartbeats` JSON) — a WakaTime-style fallback
used only when no project is detected. It never sends `--project`, which is a
hard override. The CLI resolves the name with
`wakaclock_core::project::resolve_project` (`crates/wakaclock-core/src/project.rs`):
git working tree first (a linked worktree reports the main repository's name),
then non-Git workspace markers, then a manifest-confirmed hint root, then the
nearest manifest. A hook or client passing a raw cwd as `project_root` therefore
cannot rename a project — it is only a hint, below git.

```bash
cd extensions/vscode
npm run compile     # tsc -p ./
npm run lint        # tsc --noEmit
npm run test        # vitest
npm run build:resources   # copies extensions/ai-agents into resources/
```

Released by [../../.github/workflows/release-extension.yml](../../.github/workflows/release-extension.yml),
which cross-compiles the Rust CLI for 8 targets and bundles a platform-specific
VSIX per target. **Adding a platform means editing that workflow's matrix.**
Build details: [../../extensions/vscode/BUILDING.md](../../extensions/vscode/BUILDING.md).

## `extensions/browser` — browser extension

Manifest V3, "AtoAxis Activity Tracker".
[../../extensions/browser/chromium/manifest.json](../../extensions/browser/chromium/manifest.json)
and a `firefox/` sibling; shared logic in
[../../extensions/browser/shared/tracker.ts](../../extensions/browser/shared/tracker.ts).

Permissions are deliberately minimal (`storage`, `tabs`, `idle`) and
`"incognito": "not_allowed"`. **Do not widen permissions or enable incognito**
without an explicit product decision — this is a stated privacy posture, not an
oversight.

## `extensions/desktop-tracker` — native fallback

[../../extensions/desktop-tracker/src/policy.ts](../../extensions/desktop-tracker/src/policy.ts)
is a platform-neutral **privacy contract**, not a working tracker. Native
macOS/Windows/Linux adapters implement it.

Non-negotiable rules from
[../../extensions/desktop-tracker/README.md](../../extensions/desktop-tracker/README.md):

- Report only the foreground application by default.
- Run every event through `sanitizeActivity` before it leaves the machine.
- Default AFK timeout 15 minutes.
- Title tracking is **off by default**; private mode and a denylist (password
  managers, financial/healthcare apps) are user controls.
- Raw window titles, clipboard, keystrokes, page contents and source code are
  never sent.

Any new adapter must satisfy all of the above.

## `extensions/ai-agents` — coding-agent hooks

- `plugins/atoaxis-heartbeat/` — a Claude Code plugin
  (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `scripts/heartbeat.sh`).
- `codex/heartbeat-hook.sh` — Codex hook.
- `gemini-cli/` — Gemini CLI hook.

These emit heartbeats when an AI agent edits code. The parsing counterpart lives
in `wakaclock-core::ai` — see [../backend/crates.md](../backend/crates.md), and
add a captured-log fixture when changing parser behaviour.

## Adding a new client

1. Produce a heartbeat matching `wakaclock-core::heartbeat::Heartbeat` — that
   type is the wire format.
2. Authenticate with an API key (`wcl_…`) via `Authorization: Bearer` or the
   WakaTime-compatible `Basic base64(key)` form — [../backend/auth.md](../backend/auth.md).
3. Batch through `/api/v1/heartbeats.bulk`; queue offline rather than dropping.
4. Prefer shelling out to `wakaclock-cli` over reimplementing ingest logic.

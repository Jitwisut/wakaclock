# Changelog

All notable changes to the AtoAxis VS Code extension are listed here.

## 0.2.0 — first Marketplace and Open VSX release (Early Access)

This is the first version published to the extension galleries. Using it requires an
AtoAxis API key, and keys are currently issued to invite-only Early Access members
([join the list](https://www.atoaxis.com/join)).

### Time tracking

- Tracks coding time per file, project, branch and language, plus `debugging` and
  `building` activity for debug sessions and tasks.
- Today's total in the status bar, with `Connect`, `Connecting`, `Verified` and
  `Offline queued` states.
- Records writes made outside VS Code to files in the workspace, for example agent
  `apply_patch` edits, without guessing who made them.
- Metadata-only copy/paste counts; clipboard contents are never sent or stored.

### Reliability

- Ships the native `wakaclock` CLI for your platform, verified against a SHA-256
  manifest before it runs. No separate install or binary path is needed.
- Offline queue and durable journal: activity recorded while the server is
  unreachable is kept and delivered later. Commands are included to inspect, recover
  and retry retained records.
- The API key is kept in VS Code secret storage and verified before it replaces an
  existing key.

### AI attribution

- Opt-in, per-tool consent to install metadata-only hooks for Claude Code, Codex CLI
  and Gemini CLI. Kilo Code and Kimi Code CLI adapters are Beta.
- `AtoAxis: Configure Native Activity Hooks` (including Cline on Windows) and the
  opt-in Roo task bridge are included, but their live certification is still
  pending.
- AI-written lines are reported separately from human lines. Edits without native
  tool evidence stay `unattributed` instead of being guessed.
- `AtoAxis: Test AI Detection`, `Show AI Tracking Status` and
  `Repair AI Integrations` commands.

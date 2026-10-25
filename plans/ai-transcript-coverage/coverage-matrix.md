# Coverage Matrix — จับได้ / จับไม่ได้

วันที่สำรวจ: 2026-10-26 (โค้ดบน `main` @ `c4c51b61`)
แหล่งข้อมูล: โค้ด AtoAxis + อ่าน source ของ `wakatime/wakatime-cli` `pkg/ai/` (branch `develop`)
เพื่อเก็บ **ข้อเท็จจริง** เรื่อง path/format เท่านั้น (clean-room, D3)

> path ในเอกสารนี้เป็นข้อมูลจากการอ่าน source ของคนอื่น ต้องยืนยันกับไฟล์จริงบนเครื่องในแต่ละ phase
> ก่อนเขียน parser และอัปเดตตารางนี้เมื่อพบว่าไม่ตรง

## 1. สถานะปัจจุบันของ AtoAxis

ความหมายคอลัมน์:
- **Hook** = AtoAxis มี hook/plugin ติดตั้งให้ tool นี้แล้ว
- **Transcript** = มี parser อ่านไฟล์ในเครื่องแล้ว
- **Edits** = ได้ per-file line attribution; **markers** = ได้แค่ session/tool activity ไม่มี edit
- **สถานะ** = ไม่มี tool ไหน `verified` ตอนนี้ เพราะใบรับรองใน `certifications/ai-adapters/*`
  (2026-09-03) หมดอายุ 30 วันแล้ว และ registry ลด Claude/Codex เป็น scaffold (`core/src/ai/adapter.rs:588,636`)

| Tool | Hook | Transcript | Edits | Tokens | สถานะ | หลักฐาน |
|---|---|---|---|---|---|---|
| Claude Code | ✔ plugin `PostToolUse` | ✔ `core/src/ai/claude.rs` | ✔ | ✔ `usage.rs` | scaffold (cert หมดอายุ) | `extensions/ai-agents/plugins/atoaxis-heartbeat/hooks/hooks.json` |
| Codex CLI/Desktop | ✔ plugin `apply_patch` | ✔ `core/src/ai/codex.rs` | ✔ | ✔ | scaffold (cert หมดอายุ) | `extensions/ai-agents/codex/hooks/hooks.json`, `cli/src/capture_service.rs` |
| Gemini CLI | ✔ extension | ✔ `core/src/ai/gemini.rs` | ✔ | ✔ | unverified (fixture มีแค่ README) | `core/src/ai/fixtures/` |
| Cursor IDE | ✔ `~/.cursor/hooks.json` | ✘ | ✔ | ✘ | scaffold (สร้างจาก docs) | `extensions/ai-agents/cursor/scripts/heartbeat-hook.sh` |
| Kilo Code | ✔ TS plugin | ✘ | ✔ | ✘ | scaffold | `extensions/ai-agents/kilo-code/src/plugin.ts` |
| Kimi Code CLI | ✔ TOML hook | ✘ | ✔ | ✘ | scaffold (hook ของ Kimi เป็น Beta) | `extensions/ai-agents/kimi-code/` |
| GitHub Copilot | ✔ agent hooks / CLI hooks | ✘ | markers | ✘ | built, ไม่เคยรันกับของจริง | `cli/src/native_hooks.rs`, `cli/src/ai_setup.rs` |
| Cline | ✔ hook files | ✘ | markers | ✘ | built, ไม่เคยรันกับของจริง | `cli/src/native_hooks.rs` |
| Roo Code | ✔ VS Code API bridge | ✘ | markers | ✘ | built, ไม่เคยรันกับของจริง | `extensions/vscode/src/rooBridge.ts` |
| OpenCode | ✔ native plugin | ✘ | markers | ✘ | built, ไม่เคยรันกับของจริง | `cli/src/opencode_plugin.rs` |
| Antigravity | ✔ hooks.json | ✘ | markers | ✘ | built, ไม่เคยรันกับของจริง | `cli/src/native_hooks.rs` |
| Generic MCP | `wakaclock ai emit` | — | ✔ | — | scaffold | `core/src/ai/event.rs` |
| Windsurf, Deep Code | ✘ | ✘ | ✘ | ✘ | ไม่มีอะไรเลย | `core/src/ai/adapter.rs` |
| Tool อื่นทั้งหมดในหัวข้อ 2 | ✘ | ✘ | ✘ | ✘ | ไม่มีอะไรเลย | — |

ข้อมูลบนเครื่องเจ้าของ (2026-10-26):
- มีและใช้ได้: `~/.claude/projects` (มี `structuredPatch` + `tool_use_id`), `~/.codex/sessions`
  (มี `custom_tool_call` ชื่อ `exec` + `call_id`)
- มีโฟลเดอร์แต่ยังไม่มี session: `~/.gemini/tmp` (ไม่มี `chats/`), `~/.copilot` (ไม่มี `session-state/`),
  `~/.kimi-code` (ไม่มี `wire.jsonl`)
- มี VS Code: `AppSup/Code/User/workspaceStorage`, `globalStorage/github.copilot-chat`
- ไม่ได้ติดตั้ง: Cursor, Windsurf, Cline, Roo, Kilo, Kiro, OpenCode, Amp, Continue, Zed, Warp และอื่นๆ

## 2. แหล่งข้อมูลในเครื่องของแต่ละ tool

รูปแบบ checkpoint ที่ต้องใช้ (ดู Phase 01):
- **J** = JSONL ต่อท้ายเรื่อยๆ → byte offset (มีแล้ว)
- **S** = SQLite → rowid/updated_at + fingerprint ของ db และ `-wal`
- **N** = JSON ที่ถูกเขียนทับทั้งไฟล์ → fingerprint ไฟล์ + hash ราย record

ค่าในคอลัมน์ ID = tool-call ID ที่จะใช้เป็น dedupe key (Phase 02) "?" = ต้องยืนยันใน phase นั้น

### Tier 1

| Tool | Path (macOS; Win/Linux ในวงเล็บ) | Format | Edits | Tok | Model | Prompt | ID | Phase |
|---|---|---|---|---|---|---|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` (`$CLAUDE_CONFIG_DIR`; ทุก OS ใต้ home) | J | ✔ `toolUseResult.structuredPatch` | ✔ | ✔ | ✔ | `tool_use_id` | 03 |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`, `archived_sessions/` (`$CODEX_HOME`) | J | ✔ patch text | ✔ `token_count` | ✔ `turn_context` | ✔ | `call_id` | 03 |
| Gemini CLI | `~/.gemini/tmp/<slug>/chats/session-*.json(l)`, `logs.json` | N/J (`$set`/`$rewindTo`) | ✔ `toolCalls` | ✔ | ✔ | ✔ | ? | 03 |
| Antigravity | `~/.gemini/{antigravity,antigravity-ide,antigravity-cli}/brain/<s>/.system_generated/logs/transcript.jsonl`; `*.db` (protobuf) | J (+S) | ✔ | ? | ✔ | ✔ | ? | 03 |
| Cursor IDE | `AppSup/Cursor/User/globalStorage/state.vscdb` ตาราง `cursorDiskKV` key `bubbleId:<composer>:<bubble>` | S | ✔ `toolFormerData` | ✔ `tokenCount` | ✔ | ✔ | bubbleId+toolCall | 04 |
| cursor-agent CLI | `~/.cursor/projects/*/agent-transcripts/**.jsonl`, `~/.cursor/ai-tracking/ai-code-tracking.db` | J+S | ✔ | ? | ? | ✔ | ? | 04 |
| Windsurf | `AppSup/Windsurf/User/globalStorage/state.vscdb` (schema เดียวกับ Cursor) | S | ✔ | ✔ | ✔ | ✔ | bubbleId | 04 |
| Copilot (VS Code) | `AppSup/Code/User/workspaceStorage/<hash>/chatSessions/*.json(l)`, `…/chatEditingSessions/<id>/state.json`; `globalStorage/github.copilot-chat/agent-traces.db` | N+S | ✔ | ✔ | ✔ | ✔ | requestId? | 05 |
| Copilot CLI | `~/.copilot/session-state/<id>/events.jsonl`, `~/.copilot/session-store.db` | J+S | ✔ telemetry lines | ✔ | ✔ | ✔ | ? | 05 |

### Tier 2

| Tool | Path (macOS) | Format | Edits | Tok | Model | Prompt | Phase |
|---|---|---|---|---|---|---|---|
| Cline | `AppSup/{Code,Cursor,Windsurf}/User/globalStorage/saoudrizwan.claude-dev/tasks/<t>/ui_messages.json` | N | ✔ | ✔ `api_req_started` | ? | ✔ | 06 |
| Roo Code | `…/globalStorage/RooVeterinaryInc.roo-cline/tasks/<t>/ui_messages.json` | N | ✔ | ✔ | ? | ✔ | 06 |
| Kilo Code | `…/globalStorage/kilocode.kilo-code/tasks/**/ui_messages.json`; `AppSup/kilo/**` | N+S | ✔ | ✔ | ? | ✔ | 06 |
| IBM Bob | `AppSup/{IBM Bob,Bob-IDE}/User/globalStorage/ibm.bob-code/tasks/**/ui_messages.json` | N | ✔ | ✔ | ? | ✔ | 06 |
| Cody | `AppSup/Code/User/globalStorage/state.vscdb` `ItemTable` key `sourcegraph.cody-ai` | S | ✔ (diff) | ✔ | ✔ | ✔ | 06 |
| Qwen Code | `~/.qwen/projects/*/chats/*.jsonl` (`$QWEN_RUNTIME_DIR`) | J | ✔ | ✔ | ✔ | ✔ | 07 |
| Kimi CLI | `~/.kimi/sessions/**/wire.jsonl` | J | ? | ✔ | ✔ | ✔ | 07 |
| Kimi Code | `~/.kimi-code/**/wire.jsonl`, desktop runtime ใต้ `AppSup/kimi-desktop/` | J | ? | ✔ | ✔ | ✔ | 07 |
| Factory Droid | `~/.factory/sessions/**.jsonl` | J | ? | ✔ | ✔ | ✔ | 07 |
| Grok CLI | `~/.grok/sessions/**/{summary.json,updates.jsonl,hunk_records.jsonl}` | J+N | ✔ hunk | ✔ | ✔ | ✔ | 07 |
| Kiro | `~/.kiro/sessions/**/messages.jsonl`; legacy `AppSup/Kiro/User/globalStorage/kiro.kiroagent/` | J+N | ✔ | ? | ✔ | ✔ | 07 |
| Amp | `~/Library/Caches/amp/logs/threads/**/*.log` (JSON lines) | J | ✔ | ✘ | ✘ | ✘ | 07 |
| Continue | `~/.continue/dev_data/<ver>/{chatInteraction,toolUsage,editOutcome,tokensGenerated}.jsonl` | J | ✔ `editOutcome` | ✔ | ✔ | ✔ | 07 |
| Pi | `~/.pi/agent/sessions/**/*.jsonl` | J | ✔ | ✔ | ✔ | ✔ | 07 |
| OpenCode | `~/.local/share/opencode/opencode*.db` (`session`,`message`,`part`); legacy `storage/**/*.json` | S+N | ✔ | ✔ | ✔ | ✔ | 08 |
| Goose | `~/.local/share/goose/sessions/sessions.db` | S | ✘ | ✔ | ✔ | ✔ | 08 |
| Zed | `AppSup/Zed/threads/threads.db` | S | ? | ? | ? | ? | 08 |
| Qoder | `AppSup/Qoder/SharedClientCache/cache/db/local.db` ตาราง `chat_message` | S | ✔ `diffInfo` | ✔ | ? | ✔ | 08 |
| Warp | `AppSup/dev.warp.Warp-Stable/warp.sqlite` | S | ? | ? | ? | ? | 08 |

### Tier 3 (generic descriptor, Phase 09)

| Tool | Path (macOS) | Format |
|---|---|---|
| OpenClaude | `~/.openclaude/projects/**/*.jsonl` (schema แบบ Claude) | J |
| DeepSeek dsh | `~/.dsh/sessions/**/session*.jsonl(.zstd)` | J (+zstd) |
| CodeBuddy Code | `~/.codebuddy/projects/<p>/*.jsonl` + `subagents/` | J |
| Codebuff | `~/.config/manicode{,-dev,-staging}/**/chat-messages.json` | N |
| CodeWhale | `~/.codewhale/sessions/**.json`, `~/.deepseek/sessions/**.json` | N (token สะสม) |
| Crush | `AppSup/crush/**/*.{db,sqlite,sqlite3}` | S |
| Devin (local) | `~/.local/share/devin/transcripts/**.json` | N |
| Forge | `~/.forge/.forge.db` | S |
| Hermes Agent | `~/.hermes/state.db`, `~/.hermes/profiles/*/state.db` | S |
| LingTai TUI | `~/.lingtai/**/token_ledger.jsonl` | J |
| Mistral Vibe | `~/.vibe/logs/session/**/{messages.jsonl,meta.json}` | J (token สะสม) |
| Mux | `~/.mux/sessions/**/chat.jsonl` | J |
| OMP | `~/.omp/agent/sessions/**.jsonl` | J |
| OpenClaw | `~/.{openclaw,clawdbot,moldbot}/agents/**.jsonl` (บางบรรทัดไม่มี timestamp) | J |
| Open Design | `AppSup/Open Design/**/events.jsonl` | J |
| Quickwork | `~/.quickwork/**` (`.jsonl` + `.db`) | J+S |
| ZCode | `~/.zcode/cli/db/db.sqlite` (`message`,`part`,`session`) | S |
| Zerostack | `AppSup/zerostack/sessions/**.json` | N (token สะสม) |
| Grok desktop | `AppSup/Grok Bot/sand-client-persistence/*.blob` (มีแค่เวลา + prompt length) | N |

## 3. สรุปช่องว่าง (สิ่งที่ยังจับไม่ได้ตอนนี้)

| ช่องว่าง | ผลกระทบ | Phase ที่ปิด |
|---|---|---|
| Hook และ transcript ของ edit เดียวกันใช้ event ID คนละแบบ (`claude-code-${hash}` vs `claude-code-v1:{tool_use_id}`) | `ai_lines_added` อาจนับซ้ำ | 02 |
| Cursor/Windsurf ไม่มี parser และไม่มี token | Tier 1 สองตัวหายจาก token/model | 04 |
| Copilot มีแค่ markers | ไม่รู้ว่า Copilot แก้ไฟล์ไหน | 05 |
| Extension ตระกูล `ui_messages.json` มีแค่ markers หรือไม่มีเลย | Tier 2 ส่วนใหญ่ไม่มี edit/token | 06 |
| CLI ตระกูล JSONL และ SQLite ไม่มีอะไรเลย | ราว 15 tool หายทั้งตัว | 07, 08 |
| Long tail ไม่มีอะไรเลย | ราว 19 tool | 09 |
| ไม่มี tool ไหน verified | ชื่อ tool ใน dashboard ยังเชื่อไม่ได้ | 11 |

## 4. วิธีอัปเดตตารางนี้

- เมื่อจบแต่ละ phase ให้แก้คอลัมน์ "สถานะ" ในหัวข้อ 1 และ "?" ในหัวข้อ 2 ตามที่ยืนยันได้จากไฟล์จริง
- ใส่วันที่และ version ของ tool ที่ใช้ยืนยันใน `certifications/ai-adapters/<id>/`
- ถ้าพบว่า tool เปลี่ยน path/format ให้บันทึกทั้งค่าเก่าและใหม่ ห้ามลบค่าเก่าถ้ายังมีผู้ใช้ version เก่า

# AtoAxis Universal AI Detection Plugin — Master Plan

## เป้าหมาย

สร้างชุด integration ที่ติดตั้งจากจุดเดียวและตรวจจับการแก้ไฟล์จาก AI coding agents
ที่อยู่ในขอบเขตต่อไปนี้:

- Codex
- Claude Code
- Kilo Code
- Kimi Code CLI
- DeepSeek เมื่อทำงานเป็น provider ภายใน coding agent
- DeepSeek-compatible standalone coding client เมื่อมี integration point ที่พิสูจน์ได้

แผนนี้ไม่สร้าง attribution pipeline ใหม่ แต่ต่อยอด Local Broker, transcript parser,
sidecar correlation, offline queue และ canonical dedup ที่มีอยู่ใน WakaClock

เป้าหมาย UX:

```bash
wakaclock ai setup --all
wakaclock doctor ai
```

ผู้ใช้ติดตั้งจากคำสั่งเดียว ระบบค้นหา agent ที่ติดตั้งอยู่ เลือก integration ที่เหมาะสม
และรายงานสุขภาพของทุกส่วนได้จากคำสั่งเดียว

---

## ข้อสรุปด้านสถาปัตยกรรม

คำว่า “Universal plugin” หมายถึงหนึ่งผลิตภัณฑ์และหนึ่ง installer แต่ภายในประกอบด้วย
adapter หลายแบบ เพราะแต่ละ agent มี plugin/hook API ต่างกัน:

```text
Codex plugin ─────────┐
Claude plugin ────────┤
Kilo plugin ──────────┤
Kimi hooks ───────────┼──> Universal Producer SDK
Transcript fallback ──┤              │
Filesystem fallback ──┘              ▼
                               Local AI Broker
                                      │
                                      ▼
                         Correlation + Canonical Dedup
                                      │
                                      ▼
                          Heartbeat + Backend + Frontend
```

Adapter ต้องส่ง metadata เท่านั้น Broker เป็นเจ้าของ durability และ correlation
ส่วน backend เป็นเจ้าของ canonical persistence และ analytics

---

## Identity model

ต้องแยกตัวตนสามชั้นเสมอ:

| Field | ความหมาย | ตัวอย่าง |
|---|---|---|
| `client_id` | โปรแกรมที่สั่งแก้ไฟล์ | `codex`, `kilo-code` |
| `provider_id` | ผู้ให้บริการโมเดล | `openai`, `moonshot`, `deepseek` |
| `model_id` | โมเดลที่ใช้จริง | `gpt-5.6-sol`, `deepseek-v4-pro` |

ตัวอย่างที่ถูกต้อง:

| สถานการณ์ | client | provider | model |
|---|---|---|---|
| Codex ใช้ OpenAI | `codex` | `openai` | model จริงจาก session |
| Codex ใช้ DeepSeek | `codex` | `deepseek` | `deepseek-v4-*` |
| Kilo ใช้ Kimi | `kilo-code` | `moonshot` | Kimi model จริง |
| Kilo ใช้ DeepSeek | `kilo-code` | `deepseek` | DeepSeek model จริง |
| Kimi CLI | `kimi-code-cli` | `moonshot` | Kimi model จริง |

ห้ามตั้ง `client_id=deepseek` เพียงเพราะ model มาจาก DeepSeek หากไฟล์ถูกแก้โดย Codex,
Kilo หรือ Claude Code

---

## Privacy และ attribution invariants

- ห้ามส่งหรือเก็บ prompt, response, source code, patch/diff body, command arguments,
  terminal output, clipboard content หรือ arbitrary unknown fields
- `RAW_FILE_CHANGE_WITHOUT_PROVENANCE != HUMAN`
- `PROCESS_RUNNING != AI_FILE_EDIT`
- tool ที่ fail/cancel ห้ามสร้าง verified edit
- native hook, transcript และ filesystem evidence ของ edit เดียวกันต้องเหลือหนึ่ง activity
- provider/model เป็น metadata ไม่ใช่หลักฐานว่าไฟล์ถูกแก้
- fixture test ไม่เท่ากับ live verification
- adapter ที่ยังไม่เคยรันกับเครื่องมือจริงต้องเป็น `scaffold` หรือ `unverified`
- offline replay ต้องใช้ event identity เดิมและไม่เพิ่ม totals ซ้ำ

---

## สถานะตั้งต้น ณ 2026-09-01

- Claude Code มี native plugin และมี live verification แล้ว
- Codex parser รองรับ transcript จริงและ multi-file `apply_patch`; native
  PostToolUse delivery, backend-row inspection และ native+transcript replay dedup
  ผ่านการรัน CLI จริงแล้ว (เหลือเพียง collision run กับ legacy shell transport)
- Gemini และ Cursor มี integration/scaffold เดิม แต่ไม่ใช่ขอบเขตหลักของแผนนี้
- Kilo Code และ Kimi Code CLI เริ่มมี adapter ใน registry และ producer scaffolds
  แล้ว แต่ยังไม่เลื่อนเป็น `verified` จนกว่าจะมี live run
- DeepSeek ยังไม่มี standalone client; ตอนนี้รองรับเป็น provider metadata ภายใน
  Codex/Kilo เมื่อ hook เปิดเผยค่าจริง
- `planai2` อยู่ระหว่าง Phase 6.1 canonical fingerprint ใน
  `backend/api/crates/wakaclock-core/src/ai/canonical.rs`
- ห้ามเริ่มงาน dedup ของแผนนี้พร้อมกับการแก้ Phase 6.1 ใน session อื่น

สถานะ implementation หลัง Phase 0–5: โค้ด/installer/fixture tests อยู่ใน worktree แล้ว
ตาม [progress ledger](plans/planplugin/progress.md) โดย Kilo/Kimi ยังเป็น `scaffold`
เพราะไม่มี executable ในเครื่องนี้ ส่วน Codex มี live broker/backend evidence และ
native+transcript replay dedup แล้ว เหลือเฉพาะการพิสูจน์ชนกับ legacy shell transport
แบบเจาะจง. Broker worker เพิ่ม bounded transcript auto-scan และ singleton lock แบบ
OS file lease แล้ว; macOS manifest ระบุ `HOME` ให้ LaunchAgent อย่าง explicit เพื่อให้
runtime ใช้ `~/.wakaclock` เดียวกับ CLI. การยืนยัน LaunchAgent บน host นี้ยังติด
ข้อจำกัด process/dynamic-loader ของ runtime จึงไม่นับเป็น live service certification.

อัปเดต completion audit 2026-09-02: Codex CLI `0.151.0-alpha.7.1` ส่งทั้ง
single-file และ multi-file `apply_patch` ผ่าน managed PostToolUse hook เข้า local
broker ได้จริง (metadata-only sidecar ตรงจำนวนไฟล์) และ rows ถูกตรวจใน ClickHouse
พร้อม replay transcript แล้วไม่เพิ่มแถวซ้ำ จาก stable bundle
`~/.wakaclock/agent-plugins/0.1.0` หลังแก้ matcher เป็น `^apply_patch$` และอ่าน
payload จาก `tool_input.command`. Claude migration มี
baseline live เดิม แต่การ refresh หลัง migration ติด OAuth หมดอายุ; Kilo/Kimi ไม่มี
executable ให้ทำ live run. ดังนั้นสถานะที่ยังไม่ปิดคือ Claude re-verification,
legacy-shell collision run และ Kilo/Kimi external verification ไม่ใช่ fixture failure.

Hardening audit 2026-09-02: shell event-ID generation now falls back from
`shasum` to `sha256sum`/`cksum`, and the shared emitter rejects non-scalar or
JSON-looking metadata before it reaches the CLI. The installed managed bundle was
refreshed from the tested source after this audit.

The same privacy boundary now rewrites legacy path-bearing event IDs to deterministic
opaque IDs in the shared emitter and Rust broker; Codex/Gemini transcript parsers use
the path-free UUIDv5 form directly. Transport aliases include
`filesystem_observer`, while `shell_hook` is ranked with `tool_snapshot` and
`process_observer` remains weakest evidence (`Other`) because process presence alone
cannot prove a file edit.

Tool snapshot cleanup now uses one shared deterministic ID helper for before/after and
abort paths, so failed shell calls cannot leave durable pending state. Cursor and
Claude sweep fallbacks cross the same allowlist boundary, and Kimi hook diagnostics
for unsupported or incomplete payloads are intentionally bounded and fail-open.

The refreshed-bundle smoke check also ran a second real Codex `apply_patch` at
2026-09-01T18:58:54Z and received exactly one metadata-only sidecar event, so the
installed path is not merely passing source-tree fixtures.

The isolated ClickHouse keystroke-stats integration check also passed against the
local 24.10 test container on 2026-09-02. That run caught a ClickHouse alias collision
in the Input Activity project/daily filters (an aggregate alias named `copy_actions`
could be resolved inside `WHERE`); qualifying all source columns with `hb` removes
the `ILLEGAL_AGGREGATION` failure without changing the public response contract.
The complete seven-test ignored backend suite (six ClickHouse checks plus the
isolated PostgreSQL OAuth check) now passes single-threaded with explicit test URLs;
the production database was not used.

---

## Phase files

| Phase | งาน | ไฟล์ |
|---|---|---|
| 0 | Runtime readiness และ baseline | [phase-00-runtime-readiness.md](plans/planplugin/phase-00-runtime-readiness.md) |
| 1 | Universal Producer SDK และ event contract | [phase-01-producer-sdk.md](plans/planplugin/phase-01-producer-sdk.md) |
| 2 | Codex native plugin | [phase-02-codex.md](plans/planplugin/phase-02-codex.md) |
| 3 | Claude Code plugin migration | [phase-03-claude-code.md](plans/planplugin/phase-03-claude-code.md) |
| 4 | Kilo Code native plugin | [phase-04-kilo-code.md](plans/planplugin/phase-04-kilo-code.md) |
| 5 | Kimi Code CLI hooks | [phase-05-kimi-code.md](plans/planplugin/phase-05-kimi-code.md) |
| 6 | DeepSeek provider/client support | [phase-06-deepseek.md](plans/planplugin/phase-06-deepseek.md) |
| 7 | Correlation และ cross-transport dedup | [phase-07-correlation-dedup.md](plans/planplugin/phase-07-correlation-dedup.md) |
| 8 | Setup, Doctor, Backend และ Frontend health | [phase-08-product-integration.md](plans/planplugin/phase-08-product-integration.md) |
| 9 | Certification, rollout และ acceptance | [phase-09-certification-rollout.md](plans/planplugin/phase-09-certification-rollout.md) |

---

## Execution order

```text
Phase 0
  ↓
Phase 1
  ↓
Phase 2 Codex ──┐
Phase 3 Claude ─┤
Phase 4 Kilo ───┼──> Phase 7 ──> Phase 8 ──> Phase 9
Phase 5 Kimi ───┤
Phase 6 DeepSeek┘
```

- Phase 0 และ 1 ต้องทำตามลำดับ
- Phase 2–6 ทำแยก change set ได้หลัง contract คงที่
- Phase 7 เริ่มหลัง `planai2` Phase 6.1 ปิดและ tests ผ่านแล้ว
- Phase 8 เริ่มได้บางส่วน แต่ health aggregation ต้องรอ adapter contract
- Phase 9 ต้องใช้ binary/plugin package ที่สร้างจริง ไม่ใช้ fixture แทน live run

---

## Proposed change sets

1. `fix(ai-runtime): establish universal plugin baseline`
2. `feat(ai-plugin): add universal producer sdk`
3. `feat(ai-plugin): add codex native integration`
4. `refactor(ai-plugin): migrate claude to producer sdk`
5. `feat(ai-plugin): add kilo code adapter`
6. `feat(ai-plugin): add kimi code hooks`
7. `feat(ai-identity): normalize deepseek provider metadata`
8. `feat(ai-correlation): deduplicate cross-transport evidence`
9. `feat(ai-health): add setup doctor and dashboard status`
10. `test(ai-plugin): certify universal detection adapters`

แต่ละ commit ต้อง stage เฉพาะไฟล์ใน change set และห้ามรวม uncommitted work จาก
`planai2` หรือ session อื่น

---

## Global gates

Backend/Rust:

```bash
cd backend/api
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

VS Code เมื่อมีการแก้ extension:

```bash
cd extensions/vscode
npm test
```

Frontend เมื่อมีการแก้ dashboard:

```bash
cd frontend/app
npm run validate
```

Repository และ attribution audits:

```bash
git diff --check
python3 scripts/duration-audit/verify_port.py
python3 scripts/duration-audit/golden.py
python3 scripts/duration-audit/verify_actor_migration.py
python3 scripts/duration-audit/verify_certification.py
```

`total_seconds`, daily totals และ Human counters ต้องไม่เปลี่ยนจาก baseline
นอกเหนือจาก AI activities ใหม่ที่พิสูจน์ได้

---

## Definition of Done

- ติดตั้ง integration ที่รองรับได้จาก `wakaclock ai setup --all`
- Codex, Claude Code, Kilo Code และ Kimi Code CLI ผ่าน live edit verification
- DeepSeek แสดง provider/model ถูกต้องภายใต้ host client
- native hook และ transcript ของ edit เดียวกันไม่สร้าง duplicate
- shell-based AI edit จับได้เมื่อมี before/after evidence
- human shell edit ไม่ถูกเลื่อนเป็น verified AI โดย process proximity เพียงอย่างเดียว
- broker offline/restart/replay แล้วข้อมูลไม่หายและ totals ไม่เพิ่มซ้ำ
- `wakaclock doctor ai` บอกจุดเสียของ pipeline ได้ครบ
- Frontend แสดง client, provider, model, confidence, transport และ integration health
- privacy audit ยืนยันว่าไม่มี prompt/source/patch/command output หลุดออกจากเครื่อง
- adapter ที่ยังไม่มี live evidence ไม่แสดงสถานะ `Verified`

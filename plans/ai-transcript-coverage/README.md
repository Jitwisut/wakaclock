# AI Transcript Coverage Plan

วันที่จัดทำ: 2026-10-26
สถานะ: **Planning only — ยังไม่ได้รับอนุญาตให้แก้ protected AI/heartbeat code**

## เป้าหมาย

ทำให้ AtoAxis จับ AI coding tools ในตลาดได้ครอบคลุมระดับเดียวกับ WakaTime โดยยังรักษาหลัก
"accuracy over coverage" ([ADR](../decision-accuracy-over-coverage.md)) และ locked time-counting baseline
ใน [`.context/heartbeat-safety.md`](../../.context/heartbeat-safety.md)

WakaTime ไม่ได้ให้บริษัท AI เขียนโค้ดให้ ทีม WakaTime เขียน parser แยกทีละเครื่องมือใน
`wakatime/wakatime-cli` `pkg/ai/` (ราว 60 ไฟล์) แต่ละตัวอ่านไฟล์ transcript/log/SQLite ที่เครื่องมือนั้น
เก็บไว้ในเครื่องผู้ใช้อยู่แล้ว ส่วน plugin ของ Claude Code ใช้ hook แค่ "สะกิด" ให้ CLI ไป sync
ดังนั้นเมื่อมีโมเดลใหม่ออกมาจึงไม่ต้องเขียนอะไรเพิ่ม เพราะชื่อโมเดลอ่านได้จาก field `model` ใน log
งานจะเกิดก็ต่อเมื่อมี **เครื่องมือ** ใหม่ หรือเครื่องมือเปลี่ยนรูปแบบไฟล์ log

AtoAxis มี parser แบบนี้อยู่แล้ว 3 ตัว (Claude Code, Codex, Gemini CLI) แผนนี้ขยายให้ครบทุก tier

## Invariants ที่ห้ามละเมิด

- ส่งขึ้น server เฉพาะ metadata + counts: เวลา, path ไฟล์, จำนวนบรรทัด, ชื่อ tool, model,
  `prompt_character_count`, tokens **ห้าม** ส่งข้อความ prompt, โค้ด, diff หรือ tool arguments
- Parser อ่านไฟล์ของเครื่องมืออื่นแบบ **read-only** เท่านั้น (SQLite เปิดด้วย `mode=ro`)
  ห้ามเขียน ห้าม lock นาน ห้าม copy ทั้ง database
- Parser หนึ่งตัวพังต้องไม่ทำให้ parser อื่นหรือ editor heartbeat ปกติหยุด
- event ID ที่ส่งไปแล้วต้องคงเดิมเมื่อ re-parse (idempotent) ห้ามส่งซ้ำ
- เครื่องมือที่จับได้ใหม่เริ่มแบบ **time-neutral**: ก่อน certify ส่ง **เฉพาะ usage** (token/model/prompt count)
  ทาง `POST /api/v1/ai/usage` ซึ่งไม่แตะ timeline ห้ามส่ง edit heartbeat (แม้ `active_seconds=0` ก็ยังเป็น anchor
  ที่นับเวลาได้ — ผล Phase 00 A6) การเปิดส่ง edit heartbeat ทำทีละ adapter ใน Phase 11
- ชื่อเครื่องมือจะแสดงได้ก็ต่อเมื่ออยู่ใน `KNOWN_AGENT_IDS` และ source เป็น verified-tier
  นอกนั้นเป็น "Unattributed AI" ตามกฎเดิม (`enforce_attribution_policy`)
- ไม่แตะค่าใดในตาราง Locked baseline (AI cap 6h, editor > AI, idle 15m, `wakatime_compatible`)

## การตัดสินใจของเจ้าของ (2026-10-26)

| # | เรื่อง | ข้อตัดสิน |
|---|---|---|
| D1 | hook vs transcript | **Hybrid**: hook เป็นหลักแบบ real-time, transcript เติม token/model + เก็บ edit ที่ hook พลาด + เป็นแหล่งเดียวของ tool ที่ไม่มี hook; ตัดซ้ำด้วย tool-call ID |
| D2 | Privacy | metadata + prompt/token counts เท่านั้น |
| D3 | License | Clean-room: ใช้แค่ข้อเท็จจริง (path, ชื่อตาราง/field) เขียน Rust เอง ไม่แปลโค้ด Go |
| D4 | Live test | เจ้าของติดตั้ง tool ทีละตัวเมื่อถึง phase; verified ได้จากการรันจริงเท่านั้น |
| D5 | Scope | ครบทุก tool ในตลาด แบ่ง 3 tier |
| D6 | เวลา | เริ่ม time-neutral = ส่งแค่ usage ก่อน certify (แก้ 2026-10-26 ตามผล A6); เปิดส่ง edit heartbeat ทีละ adapter หลัง certify + หลักฐาน 7 วันห่าง WakaTime ≤ 1% |
| D7 | Late hook | รอ hook 5 นาที (grace) ถ้ายังชนให้บันทึก conflict ไม่ retract |
| D8 | OS | **ทุก OS ต้อง certify** (macOS, Windows, Linux; tool ที่ไม่มีบน OS นั้นบันทึก N/A). เครื่องทดสอบ: macOS = เครื่องหลัก, Windows = เครื่องจริงของเจ้าของ, Linux = VM |
| D9 | Duplicate เก่า | Phase 00 วัดแบบอ่านอย่างเดียว แล้วให้เจ้าของตัดสินใจเรื่อง backfill |

## คำย่อ path

- `core/` = `backend/api/crates/wakaclock-core/`
- `cli/` = `backend/api/crates/wakaclock-cli/`
- `server/` = `backend/api/src/`
- `AppSup` = `~/Library/Application Support` (macOS), `%APPDATA%` (Windows), `~/.config` (Linux)
  เว้นแต่ระบุเป็นอย่างอื่นใน [coverage-matrix.md](coverage-matrix.md)

## เอกสารในชุดนี้

| ไฟล์ | หน้าที่ |
|---|---|
| [coverage-matrix.md](coverage-matrix.md) | จับได้/จับไม่ได้ ราย tool พร้อม path ข้อมูลและ phase ที่รับผิดชอบ |
| [approval-gate-template.md](approval-gate-template.md) | แบบฟอร์มขออนุญาตก่อนแก้ protected scope |
| [phase-00-baseline-and-contract.md](phase-00-baseline-and-contract.md) | พิสูจน์ข้อสมมติด้วยหลักฐานจริง (ไม่แก้โค้ด) |
| [phase-00-baseline-results.md](phase-00-baseline-results.md) | ที่กรอกผล Phase 00 |
| [phase-01-source-cursors-and-engine.md](phase-01-source-cursors-and-engine.md) | cursor แยกชนิด source, SQLite reader, registry, usage incremental |
| [phase-02-cross-source-dedupe-and-agent-ids.md](phase-02-cross-source-dedupe-and-agent-ids.md) | ตัดซ้ำ hook ↔ transcript และเพิ่ม agent ID |
| [phase-03-claude-codex-gemini-antigravity.md](phase-03-claude-codex-gemini-antigravity.md) | Tier 1 ที่มี parser แล้ว + Antigravity |
| [phase-04-cursor-windsurf-statevscdb.md](phase-04-cursor-windsurf-statevscdb.md) | Cursor IDE, Windsurf, cursor-agent CLI |
| [phase-05-github-copilot.md](phase-05-github-copilot.md) | Copilot ใน VS Code และ Copilot CLI |
| [phase-06-vscode-extension-family.md](phase-06-vscode-extension-family.md) | Cline, Roo, Kilo, IBM Bob, Cody |
| [phase-07-jsonl-cli-family.md](phase-07-jsonl-cli-family.md) | Qwen, Kimi, Droid, Grok, Kiro, Amp, Continue, Pi |
| [phase-08-sqlite-app-family.md](phase-08-sqlite-app-family.md) | OpenCode, Goose, Zed, Qoder, Warp |
| [phase-09-generic-configurable-parser.md](phase-09-generic-configurable-parser.md) | descriptor engine สำหรับ Tier 3 |
| [phase-10-doctor-dashboard-onboarding.md](phase-10-doctor-dashboard-onboarding.md) | doctor, status, consent, dashboard |
| [phase-11-certification-and-rollout.md](phase-11-certification-and-rollout.md) | live cert × 3 OS, ต่ออายุ, ปลด time-neutral |

## ลำดับ Phase

```
00 ─► 01 ─► 02 ─► 03 ─► 04 ─► 05 ─┬─► 06 ─┐
                                  ├─► 07 ─┼─► 09 ─► 10
                                  └─► 08 ─┘
11 (certification) ทำต่อท้ายทุก phase ที่ผลิต parser ใหม่; การปลด time-neutral ทำตอนท้าย
```

- **00 ก่อนทุกอย่าง** เพราะต้องพิสูจน์ว่า tool-call ID มีทั้งสองฝั่ง และวัด duplicate ที่เกิดอยู่แล้ว
- **01 ก่อน parser ใหม่** เพราะ cursor ปัจจุบันรองรับแค่ JSONL byte offset
- **02 ก่อน 03** เพราะ duplicate ของ Claude/Codex เกิดอยู่แล้วตอนนี้ ไม่ควรเพิ่ม parser ก่อนแก้
- **06/07/08 ทำขนานกันได้** เพราะใช้ engine จาก 01 และไม่แตะไฟล์เดียวกัน (แต่ละ phase เพิ่มไฟล์ parser ของตัวเอง
  ส่วน registry/ID ต้อง merge ทีละ phase)
- **09** ใช้บทเรียนจาก 06–08 ในการกำหนด descriptor

## Tier

| Tier | เครื่องมือ | Phase |
|---|---|---|
| 1 | Claude Code, Codex, Gemini CLI, Antigravity, Cursor (IDE + cursor-agent), GitHub Copilot (VS Code + CLI), Windsurf | 03–05 |
| 2 | Cline, Roo Code, Kilo Code, IBM Bob, Cody, OpenCode, Continue, Amp, Kiro, Qwen Code, Kimi / Kimi Code, Goose, Zed, Qoder, Factory Droid, Grok CLI, Warp, Pi | 06–08 |
| 3 | OpenClaude, DeepSeek dsh, CodeBuddy, Codebuff, CodeWhale, Crush, Devin, Forge, Hermes, LingTai, Mistral Vibe, Mux, OMP, OpenClaw, Open Design, Quickwork, ZCode, Zerostack, Grok desktop | 09 |

## Approval gate

เอกสารชุดนี้ **ไม่ใช่** การอนุมัติให้แก้โค้ด ไฟล์ที่ทุก phase (ยกเว้น 00) จะแตะอยู่ใน protected scope:
`cli/src/**`, `core/src/ai/**` (เมื่อ event กลายเป็น heartbeat/usage), `core/src/heartbeat.rs`,
`extensions/ai-agents/**`, `server/services/heartbeat.rs` และ test/fixture ที่ยืนยัน behavior เหล่านี้

ก่อนเริ่มแต่ละ phase ต้องส่งคำขอตาม [approval-gate-template.md](approval-gate-template.md) และรอคำตอบยืนยัน
- การอนุมัติให้แก้ **ไม่เท่ากับ** การอนุมัติให้ commit หรือ push
- **ห้าม** push, merge หรืออัปเดต `main` ทุกกรณีโดยไม่มีคำสั่งเจ้าของสำหรับ action นั้น
- ทำงานบน branch/worktree ใหม่จาก `main` ตาม [`.context/storage.md`](../../.context/storage.md)
  ห้ามทำบน `codex/team-closure-wip` ที่มีงาน Team ค้างอยู่

## Definition of Done (ทั้งแผน)

1. ทุก tool ใน [coverage-matrix.md](coverage-matrix.md) มีสถานะสุดท้าย: `verified`, `built-unverified`
   (มีเหตุผล เช่น ไม่มีบน OS นั้น) หรือ `out-of-scope` (เจ้าของตัดสิน)
2. Duplicate rate ของ edit ใหม่จาก hook + transcript = 0 ตามวิธีวัดของ Phase 00
3. ยอด `wakatime_compatible` ห่าง WakaTime ≤ 1% ตลอดทุก phase (วัดซ้ำหลังแต่ละ phase)
4. `wakaclock doctor ai` บอกสถานะทุก parser: ติดตั้ง/ไม่ติดตั้ง, lag, budget hit, lock skip
5. ไม่มีข้อความ prompt/โค้ด/diff ออกจากเครื่อง (privacy test ผ่านทุก parser)

## Non-goals

- ไม่เดาชื่อเครื่องมือจาก process/filesystem (ADR เดิมยังมีผล)
- ไม่ส่งหรือเก็บเนื้อหา prompt/โค้ด
- ไม่เปลี่ยน heartbeat wire format (token ไปทาง `POST /api/v1/ai/usage` ที่มีอยู่แล้ว)
- ไม่แก้ค่าใน locked baseline
- ไม่ทำ inline completion (Copilot/Cursor Tab) ในแผนนี้ เพราะไม่มี log ที่ระบุการ accept ได้แน่นอน

## คำถามเปิด (ต้องถามเจ้าของก่อนเริ่ม phase ที่ระบุ)

| # | คำถาม | ถามก่อน |
|---|---|---|
| Q1 | ใช้ ID แยกหรือรวม: `kimi`/`kimi-code`, `copilot`/`copilot-cli`, `cursor`/`cursor-agent` ในรายงาน | P02 |
| Q2 | แก้ค่า `ai_confidence="explicit"` ใน `cli/src/capture_service.rs` เมื่อไร | P00 ผลออก |
| Q3 | Backfill duplicate เก่าหรือไม่ (ตามตัวเลขจาก P00) | หลัง P00 |
| Q4 | Antigravity SQLite เก็บ protobuf: decode เอง (clean-room) หรือใช้แค่ JSONL | P03 |
| Q5 | Tool ที่ให้ได้แค่ token ไม่มี edit (Goose, Continue บางเวอร์ชัน) แสดงใน dashboard อย่างไร | P07/P08 |
| Q6 | Tool ที่ไม่มี hook ต้องขอ consent แยกต่อ tool หรือไม่ (ตอนนี้ sync ผูกกับ hook consent) | P10 |
| Q7 | รอบต่ออายุใบรับรอง 30 วัน: อัตโนมัติด้วย campaign script หรือทำมือ | P11 |
| ~~Q8~~ | ~~เครื่อง Windows/Linux สำหรับ certify~~ → **ตอบแล้ว 2026-10-26**: Windows ใช้เครื่องจริง, Linux ใช้ VM (ดู [Phase 11](phase-11-certification-and-rollout.md)) | — |
| ~~Q9~~ | ~~ถ้า time-neutral ทำให้ยอดขยับ~~ → **ตอบแล้ว 2026-10-26**: ก่อน certify ส่งแค่ usage; edit heartbeat เปิดทีละ adapter หลัง certify | — |

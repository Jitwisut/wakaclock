# Phase 00 — ผลลัพธ์ (template)

สถานะ: **ยังไม่ได้รัน**
วิธีทำ: [phase-00-baseline-and-contract.md](phase-00-baseline-and-contract.md)

> กรอกเฉพาะจำนวน ชนิดค่า และสถานะ ห้ามใส่ prompt, โค้ด, path ส่วนตัว หรือ credential

## ข้อมูลการรัน

| รายการ | ค่า |
|---|---|
| วันที่รัน | |
| ผู้รัน | |
| `main` commit ที่ใช้ | |
| worktree/branch | |
| OS + version | |
| `wakaclock --version` | |
| ช่วงข้อมูลที่ query | |

## A1–A3 tool-call ID สองฝั่ง

| Tool | Version | ID field ใน hook | ID field ใน transcript | ตรงกัน? | หลักฐาน | ผล |
|---|---|---|---|---|---|---|
| Claude Code | | `.tool_use_id` | `tool_use_id` | | | |
| Codex | | `.tool_use_id`? | `call_id` | | | |
| Codex: `exec` ครอบ `apply_patch`? | | — | | | | |
| Gemini CLI | | | | | | |
| Copilot | | | | | | |
| Kimi Code | | | | | | |

หมายเหตุสิ่งที่พบ:

-

## A4 server เก็บ usage ครบ

| ai_agent | rows (7 วัน) | with_tokens | with_prompt_chars | prompt_count ไม่ว่าง | ผล |
|---|---|---|---|---|---|
| claude-code | | | | | |
| codex | | | | | |
| gemini-cli | | | | | |

## A5 duplicate ที่มีอยู่แล้ว

| ช่วง (window) | คู่ที่ซ้ำ | `ai_lines_added` ส่วนเกิน | วินาทีที่ซ้ำ | ต่อวันเฉลี่ย |
|---|---|---|---|---|
| 30 วัน (±5s) | | | | |
| 30 วัน (±10s) | | | | |
| 30 วัน (±30s) | | | | |

แถว transcript ที่ `ai_change_id IS NULL`: ___ / ___

## A8 state DB ใช้ร่วมกัน

| ฝั่ง | path ของ state DB | ผล |
|---|---|---|
| broker (hook accept) | | |
| `run_ai_sync` | | |

แยกตาม agent:

| agent | change ที่ซ้ำ | บรรทัดส่วนเกิน |
|---|---|---|
| claude-code | | |
| codex | | |

ข้อเสนอเรื่อง backfill (ให้เจ้าของตัดสินใจ Q3):

-

## A6 ทดสอบ anchor ของ time-neutral

| กรณี | ยอดก่อน (วินาที) | ยอดหลัง (วินาที) | ต่าง | ผล |
|---|---|---|---|---|
| ช่องว่าง 20 นาที + AI `active_seconds=0` ตรงกลาง | | | | |
| ช่องว่าง 10 นาที (ภายใน idle) + AI `active_seconds=0` | | | | |
| AI `active_seconds=0` หลังกิจกรรมสุดท้าย | | | | |

ข้อสรุป: time-neutral ปลอดภัย / ไม่ปลอดภัย (ถ้าไม่ปลอดภัยต้องตอบ Q9)

## A7 baseline เทียบ WakaTime

| วัน | AtoAxis `wakatime_compatible` | WakaTime | ต่าง % | วินาทีจาก source AI |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| **รวม** | | | | |

ผ่านเกณฑ์ ≤ 1%: ใช่ / ไม่ใช่

## 0.7 `ai_confidence="explicit"`

| source | ai_confidence ที่เก็บ | actor_type ที่เก็บ | จำนวนแถว |
|---|---|---|---|
| codex-activity-v2 | | | |

ข้อเสนอ (ให้เจ้าของตัดสินใจ Q2):

-

## 0.8 path จริงที่ยืนยันแล้ว

| Tool | OS | path ที่พบ | ตรงกับ matrix? |
|---|---|---|---|
| | macOS | | |

## สรุปสำหรับเจ้าของ

- ข้อสมมติที่ไม่เป็นจริงและ phase ที่ต้องแก้แผน:
- คำถามที่ต้องตอบก่อน Phase 01:
- พร้อมเริ่ม Phase 01: ใช่ / ไม่ใช่

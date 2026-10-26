# Phase 10 — Doctor, status, consent และ dashboard

สถานะ: **รอ Phase 09 + approval** (ต้องได้คำตอบ Q5, Q6 ก่อน)
ขึ้นกับ: Phase 01–09 · ส่วน diagnostics บางข้อทำคู่ไปกับแต่ละ phase ได้

## เป้าหมาย

1. ให้ผู้ใช้และทีมเห็นสถานะ parser ทุกตัวได้ในที่เดียว (`wakaclock doctor ai`, `wakaclock ai status`)
2. ขอ consent อย่างถูกต้องสำหรับ tool ที่ไม่มี hook (ตอนนี้ sync ผูกกับ hook consent)
3. แสดงผลใน dashboard โดยไม่ทำให้ผู้ใช้เข้าใจยอดเวลาผิด

## สภาพปัจจุบัน

- `print_ai_status(json)` และ `collect_ai_diagnostics_v2(upload)` ใน `cli/src/main.rs`
- `TranscriptLag` วัดเป็น byte (`core/src/ai/parser.rs`)
- การเริ่ม sync อัตโนมัติจาก editor heartbeat ผูกกับ consent ของ hook (`cli/src/main.rs`)
- dashboard แสดง non-verified AI เป็น "Unattributed AI" (`migrations/001_init.sql` view `ai_daily`,
  `server/services/ai_stats.rs`)

## งาน

### 10.1 Diagnostics ต่อ parser

เพิ่มใน `collect_ai_diagnostics_v2` และ `print_ai_status`:

| field | ความหมาย |
|---|---|
| `parser_id`, `source_kind` | jsonl / sqlite / snapshot / descriptor |
| `install_state` | not_installed / installed_no_data / active |
| `sources` | จำนวน source ที่พบ (ไม่แสดง path เต็มใน upload) |
| `lag` | byte / แถว / record ตามชนิด |
| `last_event_at` | เวลา event ล่าสุดที่ส่ง |
| `budget_hits`, `sqlite_lock_skips`, `parser_panics` | นับต่อ 24 ชม. |
| `schema_unknown` | พบไฟล์แต่ map ไม่ได้ |
| `claims_suppressed`, `claims_conflicts`, `pending_grace` | จาก Phase 02 |
| `cert_status`, `cert_expires_at` | จาก `certifications/ai-adapters/` |
| `time_mode` | time_neutral / counted |

- upload diagnostics ต้องไม่มี path เต็ม, prompt, ชื่อไฟล์โค้ด (ใช้ hash หรือจำนวน)
- `--json` ให้ schema คงที่สำหรับ VS Code extension และ desktop app

### 10.2 Consent ต่อ tool (ตาม Q6)

ตัวเลือกที่จะถามเจ้าของ:
- **แบบ A**: consent เดียว "อ่าน log ของ AI tools ในเครื่อง" + รายการ tool ที่พบ และปิดราย tool ได้
- **แบบ B**: ถามทีละ tool เมื่อพบครั้งแรก

ทั้งสองแบบต้องมี:
- `wakaclock ai sources list` แสดง tool ที่พบ + สถานะเปิด/ปิด
- `wakaclock ai sources disable <id>` / `enable <id>`
- เก็บสถานะใน config เดิมของ wakaclock (ตาม [`.context/environment.md`](../../.context/environment.md))
- ค่าเริ่ม: tool ที่ไม่มี hook = **ปิด** จนกว่าผู้ใช้ยืนยัน (ปลอดภัยกว่า)

### 10.3 Onboarding ใน VS Code extension / desktop app

- หน้า/คำสั่งที่แสดง tool ที่พบในเครื่อง พร้อมสถานะ verified/unverified และปุ่มเปิด/ปิด
- อธิบายสั้นๆ ว่าอ่านอะไรและส่งอะไร (metadata + counts เท่านั้น)
- ไฟล์ที่เกี่ยวข้อง: `extensions/vscode/src/**` (protected — ต้องขออนุมัติรวมใน phase นี้)

### 10.4 Dashboard

- เพิ่มชื่อ/ไอคอนของ agent ID ใหม่ใน frontend (ตาม [`.context/workflows/adding-dashboard-panel.md`](../../.context/workflows/adding-dashboard-panel.md))
- Tool ที่มีแค่ token ไม่มี edit: แสดงตาม Q5 (เช่น อยู่ในหน้า usage/cost แต่ไม่อยู่ในกราฟบรรทัด)
- Tool ที่ยัง time-neutral (ส่งแค่ usage): แสดง token/model ได้; บรรทัดมีแค่ใน dry-run ในเครื่อง แต่ต้องไม่ทำให้ดูเหมือนเวลา AI เพิ่ม
  และต้องมีป้ายบอกว่า "ยังไม่นับเวลา"
- **การเปลี่ยน label, unit, rounding หรือข้อความที่อาจทำให้ผู้ใช้เข้าใจจำนวนเวลาเปลี่ยน**
  อยู่ใน protected scope หมวด 4 ของ heartbeat-safety ต้องขออนุมัติแยก
- Query key ทุกตัวต้องมี `userId` ([`.context/frontend/data-layer.md`](../../.context/frontend/data-layer.md))

## ไฟล์

แก้: `cli/src/main.rs` (status/doctor/sources commands), `core/src/ai/diagnostics.rs`,
`core/src/ai/parser.rs` (`TranscriptLag`), `extensions/vscode/src/**` (onboarding),
`frontend/app/components/wakaclock/**` และ `frontend/app/lib/wakaclock/**` ที่แสดง agent

เพิ่ม: คำสั่ง `wakaclock ai sources`, test ของ JSON schema ของ status

## Tests

| Test | ยืนยัน |
|---|---|
| `wakaclock ai status --json` schema | ฟิลด์ครบ เสถียร |
| diagnostics upload | ไม่มี path เต็ม/prompt |
| sources disable | parser ที่ปิดไม่ถูกเรียก |
| consent ค่าเริ่ม | tool ไม่มี hook ปิดอยู่ |
| VS Code extension tests | onboarding แสดงและเปิด/ปิดได้ |
| frontend `npm run validate` | typecheck + lint + tests ผ่าน |

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์" (มี frontend readback ที่เป็น protected หมวด 4)
2. ทำ: diagnostics, sources commands, consent, onboarding, ป้ายชื่อใน dashboard
3. ผล: ผู้ใช้เห็นและควบคุมได้ว่าอ่าน tool ไหน
4. ความเสี่ยง: label ทำให้เข้าใจยอดเวลาผิด, diagnostics หลุด path, consent ค่าเริ่มผิด
5. หลักฐาน: tests + screenshot dashboard ก่อน/หลัง
- Baseline: ไม่แตะการคำนวณ; ข้อความแสดงผลต้องได้อนุมัติแยกตามหมวด 4

## Exit criteria

- [ ] doctor แสดงทุก parser พร้อมสถานะ
- [ ] consent ทำงานตามข้อตัดสิน Q6
- [ ] dashboard แสดง agent ใหม่และป้าย time-neutral
- [ ] frontend validate ผ่าน

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| ผู้ใช้ตกใจที่ tool อ่าน log ในเครื่อง | อธิบายชัด + ค่าเริ่มปิดสำหรับ tool ไม่มี hook |
| dashboard ทำให้ดูเหมือนเวลาเพิ่ม | ป้าย time-neutral และไม่รวมในยอดเวลา |
| status JSON เปลี่ยนแล้ว extension พัง | versioned schema + test |

# Phase 11 — Certification, ต่ออายุ และ rollout

สถานะ: **ทำต่อท้ายทุก phase ที่มี parser ใหม่** (ต้องได้คำตอบ Q7 ก่อน cert แรก; Q8 ตอบแล้ว)
ขึ้นกับ: parser ของแต่ละ phase · การปลด time-neutral ทำตอนท้ายสุด

## เป้าหมาย

1. ให้ parser แต่ละตัวได้สถานะ `verified` จากการรันจริงบน **macOS, Windows และ Linux** (D8)
2. ต่ออายุใบรับรองทุก 30 วันไม่ให้หลุดเป็น scaffold แบบตอนนี้
3. ปลด time-neutral ทีละ adapter อย่างปลอดภัยต่อ locked baseline (D6)
4. ปล่อย client แบบมี rollback

## เครื่องมือที่มีอยู่แล้ว

| สิ่งที่มี | ที่อยู่ |
|---|---|
| campaign ของ Claude/Codex | `scripts/ai-coverage/run_claude_cli_campaign.py`, `run_codex_cli_campaign.py` |
| live certification | `scripts/ai-coverage/run_live_certification.py` |
| ออก/ตรวจใบรับรอง | `scripts/certify_ai_adapter.py`, `scripts/verify_ai_certification.py` |
| ใบรับรอง | `certifications/ai-adapters/<id>/` |
| อายุใบรับรอง 30 วัน | `core/src/ai/certification.rs`, `docs/ai-adapter-rollout.md` |
| ground truth | `plans/ai-coverage-ground-truth-manifest.md` |
| integration (fake backend) | `scripts/ai-attribution-integration.py` |

## ขั้นตอน live cert มาตรฐาน (ต่อ tool × OS)

1. **เตรียม**: เจ้าของติดตั้ง tool (D4), บันทึก version ของ tool, OS, `wakaclock --version`
2. **ground truth**: สร้าง repo ทดสอบว่างๆ แล้วทำ session ตามสคริปต์นี้ โดยจดสิ่งที่ทำจริงลง manifest
   - prompt 3 ครั้ง
   - สร้างไฟล์ใหม่ 1 ไฟล์
   - แก้ไฟล์เดิม 3 ครั้ง
   - แก้หลายไฟล์ในคำสั่งเดียว 1 ครั้ง
   - edit ที่ล้มเหลว/ถูกปฏิเสธ 1 ครั้ง
   - อ่านไฟล์อย่างเดียว 1 ครั้ง
   - (ถ้ามี) เปลี่ยน model กลาง session 1 ครั้ง
3. **dry-run**: `wakaclock ai sync --dry-run --verbose` → เทียบ edit/บรรทัด/model/token กับ manifest
4. **ส่งจริง**: sync ไปที่ staging backend → readback
   - `wakaclock.heartbeats`: จำนวน change, `ai_agent`, `actor_type`, `ai_source`
   - `wakaclock.ai_usage_events`: token, `prompt_count`, `prompt_character_count`
5. **dedupe** (tool ที่มี hook): ทำซ้ำข้อ 2–4 โดยเปิด hook ด้วย → จำนวน change ต้องเท่าเดิม
6. **privacy**: ค้นใน payload/log/state ว่าไม่มีข้อความ marker ลับที่ใส่ใน prompt
7. **ออกใบรับรอง** ด้วย `run_live_certification.py` แล้วตรวจด้วย `verify_ai_certification.py`
8. **บันทึก** `certifications/ai-adapters/<id>/<os>-<date>.json` (metadata เท่านั้น) และอัปเดต
   [coverage-matrix.md](coverage-matrix.md)

เกณฑ์ผ่าน:
- edit ที่สำเร็จ: ตรง 100%
- edit ที่ล้มเหลว/ปฏิเสธ/อ่านอย่างเดียว: ไม่นับ 100% (หรือ `partial` ที่ระบุเหตุผล)
- บรรทัด: ตรงกับ manifest หรือมี `line_measurement_status` ที่บอกว่าไม่ครบ
- token: ตรงกับที่ tool รายงาน (ถ้ามี)
- duplicate: 0

## ตารางรวม (สถานะ verified = ครบทุก OS ที่ tool รองรับ)

| Tier | Tool | macOS | Windows | Linux | phase |
|---|---|---|---|---|---|
| 1 | Claude Code | ☐ | ☐ | ☐ | 03 |
| 1 | Codex | ☐ | ☐ | ☐ | 03 |
| 1 | Gemini CLI | ☐ | ☐ | ☐ | 03 |
| 1 | Antigravity | ☐ | ☐ | ☐ | 03 |
| 1 | Cursor IDE | ☐ | ☐ | ☐ | 04 |
| 1 | cursor-agent | ☐ | ☐ | ☐ | 04 |
| 1 | Windsurf | ☐ | ☐ | ☐ | 04 |
| 1 | Copilot VS Code | ☐ | ☐ | ☐ | 05 |
| 1 | Copilot CLI | ☐ | ☐ | ☐ | 05 |
| 2 | Cline / Roo / Kilo / IBM Bob / Cody | ☐ | ☐ | ☐ | 06 |
| 2 | Qwen / Kimi / Kimi Code / Droid / Grok / Kiro / Amp / Continue / Pi | ☐ | ☐ | ☐ | 07 |
| 2 | OpenCode / Goose / Zed / Qoder / Warp | ☐ | ☐ | ☐ | 08 |
| 3 | descriptor ที่มีผู้ใช้จริง | ☐ | ☐ | ☐ | 09 |

(ตารางละเอียดต่อ tool อยู่ในไฟล์ phase นั้นๆ)

## เครื่องทดสอบ (Q8 — ตอบแล้ว 2026-10-26)

| OS | เครื่อง | หมายเหตุ |
|---|---|---|
| macOS | เครื่องหลักของเจ้าของ | ใช้เป็น OS แรกของทุก cert |
| Windows | เครื่องจริงของเจ้าของ | ต้องติดตั้ง `wakaclock` build ของ Windows + tool ที่จะทดสอบ; ทดสอบ hook `.ps1` และการ lock SQLite ขณะ editor เปิดอยู่ |
| Linux | VM (เจ้าของเตรียมเอง) | ต้องเป็น desktop (มี GUI) สำหรับ Cursor/Windsurf/VS Code |

ข้อควรระวังของ Linux VM:
- ถ้า VM รันบน Mac ชิป Apple Silicon จะเป็น Linux **ARM64** บาง tool อาจไม่มี build ARM64 สำหรับ Linux
  → บันทึกว่า "ไม่มี build ARM64" แยกจาก N/A (คือ tool มีบน Linux แต่ทดสอบบน VM นี้ไม่ได้)
  และให้เจ้าของตัดสินใจว่าจะหาเครื่อง x86_64 หรือยอมรับสถานะนั้น
- ใช้ distro ที่ผู้ใช้ส่วนใหญ่ใช้ (เช่น Ubuntu LTS) และบันทึก distro + version ในใบรับรอง
- ใช้ snapshot ของ VM ก่อนติดตั้ง tool แต่ละตัว เพื่อทดสอบซ้ำจากสภาพสะอาดได้
- คุมขนาด disk ของ VM ตาม [`.context/storage.md`](../../.context/storage.md)

ทั่วไป:
- Tool ที่ไม่มีบน OS นั้นจริง → บันทึก N/A พร้อมลิงก์หลักฐาน
- ห้ามคัดลอก transcript จริงจากเครื่อง Windows/VM เข้า repo (เก็บแค่ใบรับรองแบบ metadata)

## การต่ออายุใบรับรอง (Q7)

ใบรับรองหมดอายุ 30 วัน ทำให้ Tier 1 จะหมดก่อน Tier 3 เสร็จ ตัวเลือกที่จะถามเจ้าของ:
- **อัตโนมัติ**: ขยาย `run_*_campaign.py` ให้รัน session จริงแบบ headless ได้ (ทำได้กับ CLI tool เท่านั้น)
  และตั้ง schedule
- **ทำมือ**: รอบทุก 4 สัปดาห์ ใช้ checklist นี้ จัดลำดับตามวันที่จะหมด
- ไม่ว่าแบบไหน: doctor ต้องเตือนล่วงหน้า 7 วันก่อนหมดอายุ (Phase 10)

## การปลด time-neutral = เปิดส่ง edit heartbeat (ต่อ adapter)

ผล Phase 00 (A6): heartbeat ทุกแถวเป็น anchor ที่นับเวลาได้แม้ `active_seconds=0` จึงตัดสิน (Q9, 2026-10-26) ว่า
ก่อน certify parser ใหม่ส่งได้แค่ usage (token/model/prompt count) ทาง `/api/v1/ai/usage` เท่านั้น
edit heartbeat จะเปิดเมื่อผ่านเงื่อนไขด้านล่าง และเมื่อเปิดแล้วจะนับเวลาแบบเดียวกับ WakaTime

เงื่อนไขก่อนขอ:
1. adapter `verified` บนทุก OS ที่รองรับ
2. ใช้ `wakaclock ai sync --dry-run` เก็บ edit ที่ "จะส่ง" ของ adapter นั้น 7 วันทำงาน (ไม่ส่งจริง)
3. จำลองยอดแบบ "ถ้าส่ง edit" บนข้อมูล 7 วันนั้น (offline, ไม่แก้ production) แล้วเทียบ WakaTime
4. ยอด `wakatime_compatible` ต้องห่าง WakaTime ≤ 1% ทั้งก่อนและหลังจำลอง

คำขอต้องใช้ [approval-gate-template.md](approval-gate-template.md) ส่วน locked baseline ครบ 3 ข้อ
พร้อมตัวเลขจริง และเป็นคำขอแยกต่อ adapter

หมายเหตุ: Claude Code, Codex, Gemini CLI ส่ง edit heartbeat จาก transcript อยู่แล้วก่อนแผนนี้ (เป็นส่วนหนึ่งของ
baseline ปัจจุบัน) จึงไม่ถูกบังคับให้ถอยเป็น usage-only

## Rollout ของ client

1. server ที่รู้จัก agent ID ใหม่ deploy ก่อน (Phase 02)
2. client build ใหม่ปล่อยแบบ internal → เจ้าของใช้เอง 7 วัน
3. ตรวจ doctor ของเครื่องเจ้าของ: panic = 0, lock skip ต่ำ, duplicate = 0
4. ขยายไปยังผู้ใช้กลุ่มเล็ก (ถ้ามี) แล้วทั้งหมด
5. การ publish VS Code Marketplace / release stable ต้องได้คำสั่งเจ้าของแยก

## Rollback

| ระดับ | วิธี | ผล |
|---|---|---|
| ปิด tool เดียว | `wakaclock ai sources disable <id>` (Phase 10) หรือ flag ใน manifest | parser ไม่ถูกเรียก, cursor คงอยู่ |
| ปิดการนับเวลา | ปิดการส่ง edit heartbeat ของ adapter (กลับเป็น usage-only) | edit ใหม่ไม่ถูกส่ง; แถวที่ส่งไปแล้วยังนับอยู่ ต้องให้เจ้าของตัดสินใจเรื่องข้อมูลเก่า |
| ถอย client | ติดตั้ง version ก่อนหน้า | `parser_state` ใหม่ยังอ่านได้ (serde default) |
| ข้อมูลผิดบน server | ไม่ลบเอง ต้องให้เจ้าของตัดสินใจ (D9 รูปแบบเดียวกัน) | — |

## Exit criteria (ทั้งแผน)

- [ ] ทุก tool ใน matrix มีสถานะสุดท้าย
- [ ] ใบรับรอง Tier 1 ไม่มีตัวไหนหมดอายุ
- [ ] adapter ที่ปลด time-neutral แล้วมีหลักฐาน 1%
- [ ] Definition of Done ใน [README](README.md) ครบ

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| Linux VM เป็น ARM64 แล้ว tool ไม่มี build | บันทึกแยกจาก N/A และให้เจ้าของตัดสินใจหาเครื่อง x86_64 |
| เครื่อง Windows ไม่ว่างตอนต้อง cert | ระหว่างนั้นสถานะเป็น `built-unverified` |
| tool อัปเดตแล้วใบรับรองเก่าไม่ตรง | ผูกใบรับรองกับ version และ doctor เตือนเมื่อ version เปลี่ยน |
| การปลดนับเวลาทำยอดเพี้ยน | ทีละ adapter, จำลองก่อน, rollback ได้ทันที |

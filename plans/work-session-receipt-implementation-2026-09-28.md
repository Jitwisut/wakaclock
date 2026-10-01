# AtoAxis Work Session Receipt — implementation status

วันที่ 28 กันยายน 2026 · สถานะ: **experimental, ปิดโดยค่าเริ่มต้น**

นี่คือสถานะของ implementation ใน working tree ไม่ใช่ผลรับรอง runtime หรือประกาศผ่าน limited beta ทั้งแผน การทดสอบใช้งานจริงเจ็ดวันและ pilot ห้าคนยังต้องเก็บหลักฐานจริง

## สิ่งที่ทำแล้ว

| ชุดงาน | Implementation |
| --- | --- |
| A — ความหมายของตัวเลข | เพิ่ม nullable `metrics_v2` โดยคง field เดิม, ยกเลิก denominator สมมติ, คำนวณ usage coverage จาก records ที่รายงานจริง, แยก attendance กับ authorship และ follow-up events กับ follow-up rate |
| B — Identity | เพิ่ม collector UUID ที่คงที่, scope native session ด้วย collector และ agent, เก็บ identity เดิมของ durable replay, ไม่จับคู่ข้อมูล legacy ด้วยเวลา; มีเครื่องมือบันทึก runtime และแบบบันทึก ground truth |
| C — Backend | List/detail/evidence API จาก usage facts และ canonical winners, signed pagination, owner/scope checks, nullable coverage, version/fingerprint, explicit interval union/overlap |
| D — UI | Sessions พร้อมตัวกรอง, drawer ผ่าน URL, ชื่อโปรเจกต์ของเจ้าของบัญชี, loading/empty/partial/error/stale snapshot, evidence และลิงก์ Trust Center |
| E — Outcome/export | PostgreSQL migration สำหรับ outcome และประวัติ, scope `write_ai_outcomes`, ถอน annotation ได้, cascade เมื่อบัญชีถูกลบ, JSON metadata allowlist, diagnostics เบื้องต้น และ feature flag |

การแก้ canonical revision เลือก revision ล่าสุดก่อนกรอง attribution จึงไม่ดึง verified row เก่ากลับมาเมื่อ correction ใหม่เปลี่ยนเป็น unknown

## หลักฐานทดสอบ

- Server library: 347 ผ่าน; 28 integration/environment tests ถูก ignore ในคำสั่งปกติ
- Core AI: 224 ผ่าน; queue: 24 ผ่าน
- Frontend targeted tests: 25 ผ่าน; TypeScript typecheck ผ่าน
- PostgreSQL 16 + ClickHouse 24.10 ใน containers แยก: receipt integration ผ่าน โดยเรียกหนึ่งใน ignored tests แยกต่างหาก ทดสอบ usage-only, null/zero/partial, replay, session/user/device/agent isolation, canonical correction, ชื่อโปรเจกต์, OAuth read-only write rejection, annotation history และ account cascade
- Explicit interval integration: agent 20s + human context 15s − overlap 5s = union 30s
- Playwright: เส้นทาง deep link → Receipt → outcome/ถอน outcome → JSON download → keyboard close ผ่าน พร้อมตรวจภาพ desktop/mobile; ใช้ API fixtures จึงไม่ใช่ live collector certification
- Server/CLI all-targets และ desktop Rust check ผ่าน
- Compatibility registry ผ่าน: 87 routes / 36 features; `git diff --check` ผ่าน
- ESLint ของ production UI ที่เพิ่ม/แก้ผ่าน ยกเว้น `lib/wakaclock/types.ts` มี sorting errors เดิม 14 จุด ซึ่งตรวจเทียบกับ HEAD แล้ว; ไม่อ้างว่า global lint/coverage gate ผ่าน

ไม่มีการ deploy, เปิด flag ใน environment ของผู้ใช้ หรือรับรอง agent ว่ารองรับสมบูรณ์จากผล synthetic tests

## วิธีทดลองต่อ

ทำตาม [deployment และ validation runbook](../docs/work-session-receipts.md): migrate และอัปเดต API/fact writers ให้ครบก่อนอัปเดต collector แล้วเปิด `ATOAXIS_WORK_SESSIONS_ENABLED=true` บน development deployment

1. สร้างและติดตั้ง collector build ที่จะทดสอบ บันทึก digest และ runtime tuple ด้วย `scripts/work-sessions/capture_runtime.py`
2. ตรวจ capture → queue → ingest → receipt ของ Codex หนึ่ง session และ Claude หนึ่ง session ด้วย ground truth อิสระ
3. เก็บอย่างน้อย 7 วันปฏิทิน และ 10 session ต่อ agent; ทำซ้ำกรณีที่ได้รับผลกระทบเมื่อแก้ capture/identity
4. ทดลองกับผู้ใช้ที่ยินยอม 5 คน แล้วตัดสินใจ limited beta ตามเกณฑ์ในแผน

## ขอบเขตและข้อจำกัดที่ยังเปิดอยู่

- Runtime inventory ที่เก็บได้ยังไม่มี tested collector digest/live readback; ทั้ง Codex และ Claude คง experimental
- Receipt จำกัด 10,000 usage facts และ 10,000 operations ต่อ session; เกินขอบเขตตอบ error ไม่ตัดยอดให้ดูครบ ต้องวัดประสิทธิภาพก่อนเพิ่มขนาด
- Project filter UI ใช้รายการจาก project analytics ปัจจุบันสูงสุด 100 รายการ; receipt แสดงโปรเจกต์ explicit ทั้ง session และไม่แบ่งต้นทุนด้วยสัดส่วนที่เดา
- Diagnostics รายงาน lag/coverage และเหตุผลที่ข้อมูลยังจับคู่ไม่ได้; จำนวน unmatched operations ยังเป็น null และอ้างอิง Trust Center ไม่สร้างยอดขึ้นเอง
- JSON export มี evidence references สูงสุด 100 รายการ และไม่รวมชื่อโปรเจกต์/paths/prompts/source/raw output
- ประวัติ outcome เก็บในฐานข้อมูล; UI แสดงค่าปัจจุบัน การแก้และการถอน ไม่มีข้อความอิสระ
- ยังไม่รัน production build, global frontend coverage gate หรือชุด ignored integration ทั้งหมด จึงยังไม่ใช่หลักฐานพร้อม merge/release ทั้งระบบ

# F6 — Analytics and product experience closeout

วันที่: 2026-09-08  
Branch: `features/ai-coverage-f6-analytics`  
ฐานงาน: `main` ที่ `f3ea2cf`

เอกสารนี้บันทึกผลของ F6 ที่ทำและตรวจสอบได้ในเครื่องพัฒนา โดยไม่อ้างว่า
certified adapter หรือ live production coverage ผ่านแล้ว งาน live ดังกล่าวยังต้องใช้
F4 certificate, authenticated run และ readback จาก broker/API/dashboard ตามเกณฑ์เดิม

## สิ่งที่ทำเสร็จ

### F6-01 — Attribution contract

- เพิ่ม `schema_version: 2` ใน AI stats response แบบ additive
- เพิ่ม `data.coverage` ที่ประกาศ denominator และ partition ชัดเจนสำหรับ
  `AI verified`, `AI inferred`, `Human` และ `Unknown authorship`
- แยก `attributed_line_changes` กับ `unknown_line_changes`; unknown ไม่ถูกบวกเข้า AI
  หรือ Human
- แยกสถานะ `complete`, `partial`, `no_activity` และให้เปอร์เซ็นต์ line coverage เป็น
  `null` เมื่อไม่มี denominator แทนการรายงานศูนย์ปลอม
- เพิ่ม `unknown_line_share` และ denominator เดียวกันใน `/me/ai/effectiveness`

ไฟล์หลัก: `backend/api/src/model/ai_stats.rs`,
`backend/api/src/services/ai_stats.rs`, `backend/api/src/handlers/v2.rs`

### F6-02 — Typed transport, compatibility และ cache isolation

- เพิ่มชนิดข้อมูล frontend สำหรับ coverage และรองรับ field เดิม
  `unattributed_lines_*` ระหว่าง rollout
- กราฟรายวันอ่าน unknown จาก field ใหม่ก่อน แล้ว fallback ไป field เดิมโดยไม่ทำให้
  unknown กลายเป็น AI
- ทุก query key ที่แตะ dashboard analytics ใช้ factory ที่มี `userId`, ช่วงวันที่ และ
  timezone
- Analytics Explorer อ่าน timezone จาก URL หรือ browser อย่างปลอดภัย และส่งค่าเดียวกัน
  ไปทั้ง request กับ query key; reset/href รักษา filter semantics เดิม

ไฟล์หลัก: `frontend/app/lib/wakaclock/types.ts`,
`frontend/app/lib/wakaclock/query-keys.ts`, `frontend/app/hooks/use-analytics-filters.ts`,
`frontend/app/components/wakaclock/analytics/analytics-frame.tsx`

### F6-03 — Analytics presentation

- AI Stats แสดง coverage ของ event และ line แยกกัน พร้อม denominator ที่ตรวจสอบย้อนกลับได้
- กราฟ daily แยก unknown line changes และมี legend อธิบายหลักฐานของแต่ละ actor
- Unknown duration ใน Analytics Explorer แสดง `Unavailable` เมื่อ API ไม่มีค่าที่วัดได้
  ไม่แปลงเป็น measured zero
- ปรับปุ่ม summary ให้มี `aria-pressed` และคำอธิบายที่ screen reader ใช้ได้

ไฟล์หลัก: `frontend/app/app/dashboard/(auth)/wakaclock/ai/page.tsx`,
`frontend/app/components/wakaclock/analytics/source-summary.tsx`,
`frontend/app/components/wakaclock/ai-attribution-legend.tsx`

### F6-04/F6-05 — Multi-device health และ repair guidance

- Diagnostics v2 แสดงทุก device report ที่ API ส่งมา ไม่เลือกเฉพาะรายการแรก
- แยก runtime health ออกจาก certification และแสดง Installed/Detected, Last event,
  Last delivery, Tested coverage และ Needs action
- แสดง `healthy`, `idle`, `degraded`, `disabled`, `unavailable` คนละความหมาย; idle
  ไม่ถูกทำให้เป็น error
- แปลง diagnostic/certification code ที่ allowlist แล้วเป็นข้อความแก้ไขที่ปลอดภัย
  และซ่อน code ดิบไว้ใน Advanced details
- ใช้ fallback v1 เฉพาะเมื่อ v2 ไม่มี snapshot; ถ้า endpoint หนึ่งล้มเหลวแต่มี snapshot
  อีก endpoint จะยังแสดงข้อมูลที่มีอยู่

ไฟล์หลัก: `frontend/app/components/wakaclock/ai-diagnostics-panel.tsx`,
`frontend/app/lib/wakaclock/ai-display.ts`

## หลักฐานการตรวจสอบ

- `cargo fmt --all -- --check` ผ่าน
- `cargo check --workspace` ผ่าน
- `cargo test -p wakaclock-server` ผ่าน: 185 passed, 7 ignored เพราะต้องใช้ ClickHouse/
  PostgreSQL integration fixture
- Frontend `npm run typecheck` ผ่าน
- Frontend `npx eslint . --max-warnings=0` ผ่าน
- Frontend full Vitest ผ่าน: 53 files, 266 tests
- Frontend production build ผ่านด้วย `next build --webpack` เมื่อกำหนด
  `NEXT_PUBLIC_APP_URL=https://atoaxis.com`
- เพิ่ม regression tests สำหรับ coverage partition, no-activity, multi-device guidance,
  timezone filter และ user-scoped query key

Turbopack build ปกติถูก sandbox ปฏิเสธตอนพยายามเปิด process/port (`Operation not
permitted`); Webpack production build ผ่านและ compile/type/page generation ครบ

## ข้อจำกัดที่ยังเป็น release gate

- F4 live certification ยังต้องมี authenticated real-tool run, shipped-bundle digest,
  broker/API/dashboard readback และ human review; F6 ไม่เลื่อนสถานะ capability เป็น
  certified จาก fixture หรือ local snapshot
- ยังไม่มี empirical recall เมื่อไม่มี ground-truth corpus; UI จึงไม่แสดงตัวเลข recall
- Analytics Explorer ใช้ project/timezone/date และมิติที่ canonical timeline มีอยู่
  (เช่น operating system/editor); device-level health แสดงแยกตาม diagnostics report
  และไม่เดา machine identity จาก path หรือชื่อเครื่องที่ไม่ได้อยู่ใน canonical interval
- ClickHouse/PostgreSQL integration และ materialized-view rebuild ต้องรันใน environment
  ที่มี service จริงก่อน release

สถานะ F6: **implemented and validated locally; release/live certification gate remains**

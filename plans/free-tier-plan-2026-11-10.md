# AtoAxis — แผน Free tier และแผน Pro รายบุคคล

วันที่: 10 พฤศจิกายน 2026 · Asia/Bangkok

สถานะ: **แผน / ยังไม่เริ่ม implementation** — ตัวเลขทั้งหมดเป็นข้อเสนอเริ่มต้น
ไม่ใช่การตัดสินใจขั้นสุดท้าย และไม่ใช่ approval ให้แก้ protected code

## 1. เป้าหมาย

เปิดทางให้นักพัฒนาลองใช้ AtoAxis โดยไม่ต้องจ่ายก่อน และให้เหตุผลชัดเจนในการย้ายจาก
WakaTime Free พร้อมแรงจูงใจให้อัปเกรดเป็น Pro ($12/เดือน)

ข้อความหลักที่ต้องการให้ Free สื่อ:
"ดูย้อนหลังได้ 2 เท่าของ WakaTime Free และเห็นว่า AI เขียนโค้ดให้คุณเท่าไหร่ — ฟรี"

## 2. สถานะตั้งต้นที่ตรวจจริง (source `26691320`, local `main`)

- **ยังไม่มีแนวคิด plan/subscription สำหรับผู้ใช้รายบุคคลใน backend**
  `Entitlement` ใน `backend/api/src/services/authorization.rs` มีเพียง
  `OrganizationDashboards` และ `SsoScim` (ระดับองค์กร)
- ราคา $12 แสดงอยู่ที่ `frontend/app/components/marketing/comparison-section.tsx`
  และหน้า pricing แต่ **ยังไม่มีการบังคับใช้** — ปัจจุบันผู้ใช้ทุกคนได้ทุกฟีเจอร์
- ระบบ Stripe ที่มีอยู่เป็นของ Team (`team_stripe_*`, `team_subscription_*`)
  และงาน Stripe ถูกพักไว้ตามคำสั่งเจ้าของ
- การแปลง range ไม่ได้รวมศูนย์: พบ `resolve_range`/`parse_range` แยกกันใน
  `handlers/v2.rs`, `handlers/v1/project_analytics.rs`, `services/stats.rs`,
  `services/insights.rs` และ named ranges (`last_7_days` ฯลฯ) ใน `handlers/v1/catalog.rs`
  ต้องทำ inventory ครบใน P0 ก่อนออกแบบจุดบังคับใช้
- เทียบ WakaTime (ตรวจกับ wakatime.com ส.ค. 2026 ตาม comparison-section):
  Free $0 = 1 สัปดาห์, Basic $9 = 2 สัปดาห์, Premium $14 = ประวัติครบ

ดังนั้นงานจริงคือ **(ก) กำหนดและบังคับใช้ขอบเขต Free** และ **(ข) สร้างแผน Pro รายบุคคล**
พร้อมการชำระเงิน ซึ่งผูกกับการตัดสินใจเรื่อง Stripe ที่พักไว้

## 3. หลักการ

1. **จำกัดการดู ไม่จำกัดการเก็บ** — heartbeat ของทุกแผนถูกเก็บครบเหมือนกัน
   อัปเกรดแล้วประวัติเก่าปรากฏทันที ห้ามลบหรือ downsample ข้อมูลของผู้ใช้ Free
2. **ไม่ลดความแม่นยำใน Free** — ingest, client, AI hooks, canonical timeline
   และ locked time-counting baseline เหมือนกันทุกแผน
3. **Free ต้องดีกว่า WakaTime Free อย่างเห็นได้ชัด**
4. **ไม่กักข้อมูลผู้ใช้** — export ข้อมูลของตัวเองได้ทุกแผน (ความน่าเชื่อถือ + PDPA)
5. **Downgrade ไม่ทำให้ข้อมูลหาย** — แค่ซ่อนช่วงที่เกินสิทธิ์และฟีเจอร์ Pro

## 4. การแบ่งฟีเจอร์ที่เสนอ

| ฟีเจอร์ | Free | Pro ($12) | หมายเหตุ |
|---|---|---|---|
| เก็บข้อมูลทุก editor/AI hook, ไม่จำกัดโปรเจกต์/เครื่อง | ✅ | ✅ | หลักการข้อ 1–2 |
| ช่วงดูย้อนหลัง (dashboard + API) | **14 วัน** | ไม่จำกัด | เท่ากับ WakaTime Basic $9 |
| Dashboard พื้นฐาน (เวลา/ภาษา/โปรเจกต์/editor/OS) | ✅ | ✅ | |
| สัดส่วน Human vs AI, ชื่อ agent ที่ `ai_verified` | ✅ | ✅ | ให้เห็นจุดขายหลัก |
| AI operation evidence ละเอียด, Work Session Receipts | ❌ | ✅ | |
| Measurement Trust Center แบบละเอียด / measurement repair | สรุปสถานะ | ✅ | สถานะคิวส่งข้อมูลควรเห็นได้ทุกแผน |
| AI token usage และต้นทุน | ❌ | ✅ | |
| Time Machine City / Agent Universe | preview หรือ ❌ | ✅ | ยังเป็น experimental + flag |
| Public profile, badge, README stats (`stats/last_7_days`) | ✅ | ✅ | growth loop |
| API ของข้อมูลตัวเอง | ✅ ภายใน 14 วัน | ✅ ทั้งหมด | |
| Export ข้อมูลดิบของตัวเอง | ✅ | ✅ | หลักการข้อ 4 |
| Goals | 2 ตัว | ไม่จำกัด | |
| GitHub commit/PR, Calendar integration | ❌ | ✅ | |
| รายงานอีเมลรายวัน/รายสัปดาห์ | ❌ | ✅ | |
| Import จาก WakaTime | ✅ (ดูได้ตามช่วงของแผน) | ✅ | import แล้วอัปเกรดจะเห็นครบ |
| Private leaderboards | เข้าร่วมได้ | สร้างได้ | ต้องมี PostgreSQL |

คำถามที่เจ้าของต้องตัดสิน (บันทึกผลใน P0):

- [ ] 14 วัน หรือค่าอื่น
- [ ] Time Machine / Agent Universe เป็น preview หรือ Pro ล้วน
- [ ] มี trial Pro (เช่น 14 วัน) ตอนสมัครหรือไม่
- [ ] ผู้ใช้ปัจจุบันทั้งหมด: grandfather เป็น Pro ชั่วคราว/ถาวร หรือย้ายเป็น Free
- [ ] ช่องทางชำระเงินของ Pro รายบุคคล (เกี่ยวกับ Stripe ที่พักไว้)

## 5. ลำดับพัฒนา

### P0 — ตัดสินใจและ inventory (ประมาณ 2–4 วัน)

- [ ] เจ้าของตอบคำถามในหัวข้อ 4
- [ ] Inventory ทุก endpoint ที่รับ range/วันที่ (v1, v2, WakaTime-compatible, export,
      public profile/embeds) พร้อมระบุว่าอยู่ใน protected file map หรือไม่
- [ ] ระบุ exact files ที่แตะ readback semantics ตาม
      [.context/heartbeat-safety.md](../.context/heartbeat-safety.md) และขออนุมัติก่อนแก้
- [ ] ตกลงพฤติกรรมเมื่อขอช่วงเกินสิทธิ์: clamp พร้อม metadata บอกว่าถูกตัด
      หรือ 402/403 พร้อมเหตุผล (แนะนำ clamp + flag เพื่อไม่ทำให้ WakaTime plugin/README widget พัง)

### P1 — Plan model และ entitlement รายบุคคล (ประมาณ 1 สัปดาห์)

- [ ] เพิ่ม personal plan state (Free/Pro + ที่มา: paid/trial/grandfathered/manual)
      ผ่าน additive migration ตาม [.context/data/migrations.md](../.context/data/migrations.md)
- [ ] Service กลางตัดสินสิทธิ์ เช่น `history_window(user)` และ `has_feature(user, feature)`
      identity มาจาก `auth::resolve_user_id` เท่านั้น
- [ ] ไม่มี PostgreSQL: กำหนดพฤติกรรมชัดเจน (เช่น self-hosted = Pro ทั้งหมด) ไม่ panic
- [ ] Feature flag ปิด enforcement ไว้ก่อน (`ATOAXIS_PERSONAL_PLANS_ENABLED` หรือชื่อตามที่ตกลง)
- [ ] Endpoint อ่านแผนของตัวเองสำหรับ frontend (query key มี `userId`)

### P2 — บังคับใช้ช่วงดูย้อนหลังและฟีเจอร์ (ประมาณ 1–2 สัปดาห์)

- [ ] บังคับใช้ history window ที่ชั้น handler/service ที่ resolve range
      **ไม่แตะ ingest, canonical timeline หรือการคำนวณ duration**
- [ ] Gate ฟีเจอร์ Pro ตามตารางหัวข้อ 4 ทั้ง backend และ UI
- [ ] WakaTime-compatible routes ที่ plugin/widget ใช้บ่อยต้องยังทำงานภายในช่วง Free
- [ ] Export ยังได้ข้อมูลครบทุกช่วง (หลักการข้อ 4) — ยืนยันใน P0 ว่าเป็นการตัดสินใจที่ต้องการ

### P3 — Frontend และหน้าราคา (ประมาณ 1 สัปดาห์)

- [ ] แสดงช่วงที่ถูกจำกัดใน range picker และ empty state ที่บอกว่า "อัปเกรดเพื่อดูช่วงนี้"
      (ข้อมูลมีอยู่แต่ซ่อน — ห้ามแสดงเป็น 0)
- [ ] Upgrade prompt ที่ฟีเจอร์ Pro ทั้ง Cinema และ classic layouts
- [ ] อัปเดตหน้า pricing + comparison table (TH/EN) ให้มี Free tier
      และแก้แถว "Free tier" ใน `comparison-section.tsx`

### P4 — การชำระเงิน Pro รายบุคคล (ขึ้นกับการตัดสินใจเรื่อง Stripe)

- [ ] เลือก provider/flow; ถ้าใช้ Stripe ต้องได้รับการปลดพักจากเจ้าของก่อน
- [ ] Webhook → plan state แบบ idempotent, cancel/downgrade ไม่ลบข้อมูล
- [ ] ระหว่างยังไม่มีการชำระเงิน: เปิด Free ได้ก่อน และให้ Pro ผ่าน grandfather/manual

## 6. เกณฑ์ตรวจรับ

- Free และ Pro ได้ **ยอดเวลาเท่ากัน** สำหรับวันเดียวกันภายใน 14 วัน (ตรวจกับ independent fixture)
- อัปเกรด Free → Pro แล้วประวัติก่อนหน้าทั้งหมดปรากฏ; downgrade แล้วไม่มีข้อมูลถูกลบ
- ช่วงที่ถูกจำกัดไม่แสดงเป็น 0 และ response บอกว่าถูกตัด
- Request ที่ส่ง `user_id` ของคนอื่นไม่สามารถเลี่ยงสิทธิ์ได้
- WakaTime plugin, wakatime-cli และ README stats widget ทำงานได้กับบัญชี Free
- Locked time-counting baseline ไม่เปลี่ยน; ไม่มีการแก้ protected files โดยไม่ได้รับอนุมัติ
- ปิด flag แล้วพฤติกรรมกลับเป็นแบบเดิม (ทุกคนได้ทุกฟีเจอร์)

## 7. นอกขอบเขต

- Team/Org billing และ seat (มีแผนแยก)
- การเปลี่ยนวิธีนับเวลา หรือ retention/downsampling ของข้อมูล
- ราคาแบบรายปี/ส่วนลด/คูปอง (ตัดสินหลังเปิด Free)

## 8. ข้อกำหนดการลงมือ

อ่าน `CLAUDE.md` และ context ที่ trigger ก่อนเริ่มแต่ละขั้น: endpoint workflow,
auth, data/migrations, frontend data-layer และ heartbeat-safety เมื่อแตะ readback
แผนนี้ไม่อนุญาต commit/push/merge/deploy หรือการเปิด flag บน production;
ใช้ task branch และห้าม push `main` โดยไม่ได้รับอนุญาต

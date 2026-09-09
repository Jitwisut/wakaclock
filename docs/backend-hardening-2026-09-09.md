# Backend hardening — สถานะการแก้ไข

แก้ไขจาก audit วันที่ 9 กันยายน 2026 บน working tree นี้ ยังไม่ได้ deploy หรือแก้ฐานข้อมูล production

## สิ่งที่แก้แล้ว

| Audit | การแก้ไข | หลักฐาน |
|---|---|---|
| F01 | async auth context ตรวจ credential จาก DB; scoped read routes ตรวจ scope; account mutations ที่ไม่มี write-scope contract ปฏิเสธ OAuth; ปิดช่อง read-scope ใช้แก้ org/member/leaderboard | smoke test limited/empty OAuth grants และ mutation denial |
| F02 | สร้าง key แล้วเก็บเฉพาะ hash; GET คืน null; ล้าง plaintext ใน live ClickHouse ผ่าน migration; UI แสดงครั้งเดียวและไม่เก็บ key ใน query cache | server/API-key panel tests และ smoke read assertion |
| F03 | เลิก in-memory auth cache; PG ตรวจ expiry/revoke/active user ทุก request; session มี unique jti และ durable session record; import legacy key แบบ one-way | issue/revoke/expire ข้ามสอง replica, OAuth และ session revocation |
| F04/F05 | timeline derive จาก canonical raw revision; ไม่อ่าน stale projected interval; tombstone ป้องกัน deleted IDs กลับมาเมื่อ retry; ลบ raw/interval แบบรอ mutation และ ingest ข้าม IDs ที่ถูกลบ | ClickHouse test ลดเวลาเหลือศูนย์/ลบ/retry/cross-user/delayed segments |
| F07 | แทน server file path ด้วย bounded JSON upload; ปฏิเสธ unknown fields; stable import+record IDs; ไม่ใช้ AI session ID เป็น event ID เพื่อไม่รวมหลาย edit เป็นรายการเดียว | import path rejection และ import ซ้ำได้ 0 additional records |
| F08 | registration reserve username ใน PG transaction; identity/password/personal org เขียนใน transaction; key rotate/revoke serialize ด้วย row lock; organization+owner+audit atomic | concurrent register มี winner เดียว และ credential lifecycle smoke |
| F09 | PostgreSQL pool + TLS adapter, timeout, reconnect; error ไม่ใส่ full DSN; migration scripts ใช้ dedicated connection | terminate API DB connections แล้ว request ถัดไปสำเร็จ |
| F10 บางส่วน | migration lock ข้าม replica; CREATE OR REPLACE canonical view; per-user reprocess lock; รอ legacy delete mutation ก่อน replay | DB migrations/startup ผ่าน และ compile/unit checks |
| F13 บางส่วน | Argon2 ใช้ blocking pool; ขนาด credentials/bulk heartbeat ถูกจำกัด; cache project identity ต่อ batch; trusted proxy IP policy; HTTP drain เมื่อ SIGINT/SIGTERM | proxy spoofing unit test และ smoke runner shutdown |

## ป้องกันผลลัพธ์หลอกว่าสำเร็จ แต่ยังไม่ได้ implement feature ครบ

- **F06/F11:** export/report/integration connect/sync ปฏิเสธด้วย 503 ก่อนเขียนงานหรือ credential ใหม่ และ worker binaries ไม่รายงาน readiness สำเร็จเมื่อไม่มี processor การ guard integration ยังป้องกันไม่ให้เก็บ payload ที่อ้างว่า encrypted โดยไม่มี vault แต่ **ยังไม่มี queue consumer, vault integration หรือ worker ที่ส่งมอบผลจริง**
- **F12:** capabilities มี available flag และ worker features เป็น partial/unavailable; PG features ไม่ระบุ available เมื่อไม่มี PostgreSQL; freshness ไม่อ้าง realtime โดยไม่มี watermark
- **F04/F10:** canonical interactive readers เคารพ deletion/revision แล้ว แต่ legacy aggregates ยังไม่ได้ invalidate/publish แบบ atomic ครบทุกตาราง และ reprocess ยังไม่ใช่ durable job
- ยังไม่ได้เพิ่ม organization telemetry analytics, leaderboard ranking, chart embed rendering หรือ SSO login flow เต็มรูปแบบ
- ยังไม่ได้ทำ distributed rate limiting, load/latency benchmark, private-CA TLS configuration หรือ end-to-end provider delivery

## ข้อเปลี่ยนแปลงในการนำขึ้นระบบ

1. ตั้ง POSTGRES_URL และให้ migrations สำเร็จก่อนเปิด traffic; credential migration เป็น one-way ไม่ควรถอด PostgreSQL เพื่อ rollback
2. Session JWT เดิมต้องล็อกอินใหม่ เนื่องจากใช้ durable session registration/jti; legacy API key hashes ถูกนำเข้าครั้งเดียวโดย marker ป้องกันคืนชีพ key ที่ revoke ไปแล้ว
3. UI และ backend ควรขึ้นพร้อมกัน เพราะ import contract เปลี่ยนเป็น dump_json และ API key เปลี่ยนเป็นแสดงครั้งเดียว
4. การล้าง plaintext ใน live table ไม่ล้างข้อมูลใน backup เก่า ต้องจัดการ retention/rotation ตามระบบจริง
5. หากมี consumer ใช้ legacy aggregate tables โดยตรง ต้องย้ายมา canonical source หรือเพิ่ม invalidation ก่อนรับรอง delete/correction consistency ของ consumer นั้น
6. Worker features ที่ยังไม่พร้อมจะตอบ 503 อย่างชัดเจน ต้อง implement และทดสอบจริงก่อนเอา guard ออก

## การทดสอบ

- Rust workspace unit/service/broker tests: **551 passed, 0 failed, 8 ignored** (ignored แยกทดสอบกับ DB ด้านล่าง)
- PostgreSQL/ClickHouse isolated tests: **8 passed, 0 failed** รวม regression ของ correction/deletion/delayed segments
- Cross-replica smoke: concurrent registration, API-key issue/revoke/expiry, OAuth scope/empty grant/revoke, session revoke, file-path rejection, JSON import retry, unavailable worker no-write และ PostgreSQL reconnect
- Frontend: typecheck และ ESLint ของไฟล์ที่แก้ผ่าน; API-key panel tests **4 passed**
- `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all -- --check` และ `git diff --check` ผ่าน
- CI เพิ่ม runner `scripts/backend-security-smoke-runtime.py` ให้สร้าง API สอง process ต่อกับฐานข้อมูล test แล้วปิด process ที่ตัวเองสร้างเมื่อจบ

ไม่มีการแตะ edits เดิมใน `crates/wakaclock-core/src/queue.rs` และ `frontend/app/next-env.d.ts`

แก้ CLI lint เพิ่มหนึ่งบรรทัด (`if let Ok` แทน `.ok()` แล้วจับ `Some`) เพื่อให้ workspace Clippy gate ผ่าน โดยไม่เปลี่ยนพฤติกรรม

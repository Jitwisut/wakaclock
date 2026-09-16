# AtoAxis / WakaClock — Current System Context

วันที่ปรับปรุง: 2026-09-17
Branch: `codex/integrate-all-current-work`
Local commit ล่าสุด: `82a565a` (`feat: complete heartbeat timing and AI attribution pipeline`)
Working tree: มีการแก้ไขตัวรับ filesystem ของ VS Code เพิ่มเติมในรอบนี้ และยังไม่ได้ commit

เอกสารนี้เป็น context สำหรับผู้พัฒนาหรือ agent คนถัดไป ให้ใช้คู่กับ
`plans/time-ai-correctness-progress-2026-09-16.md` และเอกสาร audit ในโฟลเดอร์ `docs/`.
สถานะในเอกสารนี้แยก **local validation** ออกจาก **live certification** เสมอ
และยังไม่มีการประกาศว่าระบบแม่นกว่าหรือเร็วกว่า WakaTime จนกว่าจะมี campaign เปรียบเทียบ
จาก runtime จริงและมี activity oracle อิสระครบตามแผน TA-07.

## ภาพรวมระบบ

AtoAxis (ชื่อ package/client เดิมคือ WakaClock) รับ heartbeat จาก VS Code, CLI และ
AI-agent hooks แล้วคำนวณเวลา ภาษา project และ AI attribution โดยไม่เก็บ source code,
prompt, response หรือ diff text.

```text
VS Code / wakaclock CLI / Codex / Claude hooks
                     │ metadata-only heartbeat
                     ▼
              Rust Axum API :8080
                ┌────┼─────┐
                │    │     │
          PostgreSQL Redis ClickHouse
          transactional presence telemetry/analytics
```

### หน้าที่ของ storage

| ส่วน | หน้าที่ปัจจุบัน |
| --- | --- |
| ClickHouse | แหล่งข้อมูลหลักของ heartbeat, activity intervals, duration, summaries, AI usage และ analytics จำนวนมาก |
| PostgreSQL | identity, user/account state, auth, transactional product data และ account activity lock; ไม่ได้เก็บ heartbeat telemetry ทุกแถว |
| Redis | Presence v2 lease/live snapshot; ไม่ใช่แหล่งประวัติเวลา |
| RabbitMQ | โครงสร้าง job queue แบบ optional; ไม่อยู่บน direct heartbeat path |
| Redpanda/Kafka | โหมด ingest แบบ gated/optional; local direct mode ยังเป็นค่าเริ่มต้น |

เมื่อเปิด `PRESENCE_V2_ENABLED=true` API ต้องเชื่อม PostgreSQL และ Redis ตอน boot
แต่ heartbeat ยังเขียน raw data ลง ClickHouse เป็นหลัก.

## เส้นทาง heartbeat ปัจจุบัน

1. Client ส่ง `POST /api/v1/heartbeats` หรือ `.bulk` พร้อม metadata
2. API authenticate และตรวจ scope/access
3. ถ้ามี PostgreSQL API จะ acquire account activity lock และตรวจ account availability
4. `HeartbeatService` ตรวจ dedup/revision แล้วเขียน `wakaclock.heartbeats` และ
   `wakaclock.activity_intervals` ใน ClickHouse
5. หลัง ClickHouse รับสำเร็จ ระบบอัปเดต presence ใน memory/Redis แบบ best-effort

ฝั่ง VS Code มีตัวรับระดับ filesystem เพิ่มเติมสำหรับไฟล์ที่ถูกเขียนจากภายนอก editor
(เช่น Codex Desktop `apply_patch`) ซึ่งอาจไม่ยิง `onDidChangeTextDocument`: watcher
เฝ้าเฉพาะ workspace folder, รวม atomic-save burst, กัน event ซ้ำกับ editor และส่ง
heartbeat แยก `write=true`, `active_seconds=0` ผ่าน CLI/queue เดิม ตัวรับคำนวณ line
delta และ fingerprint ภายในเครื่องเท่านั้น หากไม่มี sidecar ที่ยืนยันผู้เขียนจะเก็บ
เป็น `unknown`/`unattributed` แทนการเดาว่าเป็น AI หรือ human.

จุดอ้างอิงหลัก:

- `backend/api/src/services/heartbeat_ingest.rs`
- `backend/api/src/services/heartbeat.rs`
- `backend/api/src/repository/heartbeat.rs`
- `backend/api/src/handlers/v1/heartbeats.rs`

PostgreSQL จึงเพิ่ม round trip สำหรับ lock/status check และอาจเพิ่ม latency เล็กน้อย
ต่อ request แต่ไม่ได้เปลี่ยน ClickHouse ให้เป็น PostgreSQL. ในระดับ production ต้อง
ติดตาม PostgreSQL pool/lock wait แยกจาก ClickHouse insert latency.

## Logic การคำนวณเวลา

### WakaTime-compatible timeline

- `IDLE_TIMEOUT_MINUTES` default 15 นาที ใช้เป็นช่วง bridge ระหว่าง evidence ที่พิสูจน์ได้
- clip ช่วงเวลาเข้าขอบเขตวันและ timezone ที่ร้องขอ
- ไม่บวกช่วงที่ไม่มี heartbeat/evidence ต่อเนื่องเกิน timeout
- legacy `active_seconds` หนึ่งค่าถูกจำกัดเป็น trailing evidence window สูงสุด 120 วินาที
  ไม่แตกเป็นช่วงติดกันเพื่อสร้าง session ปลอม

### Active v1

- VS Code สร้าง `editor_active_v1` lease สูงสุด 15 วินาทีต่อช่วง
- ค่า heartbeat cadence 120 วินาทีมีหน้าที่ส่งข้อมูล ไม่ใช่หลักฐานว่า user ทำงานตลอด 120 วินาที
- gap ตั้งแต่ 16 วินาทีขึ้นไปไม่สร้าง human Active time
- AI tool hook สร้าง `ai_tool_v1` จาก start/end ที่สังเกตได้จริง สูงสุด 6 ชั่วโมงต่อ operation
- multi-file operation นับ interval เดียว ไม่คูณตามจำนวนไฟล์
- timeline รวม human และ AI แบบ union; overlap นับครั้งเดียว แต่ API แยก human-only,
  AI-only และ overlap ให้ดูได้
- `active_intervals` ถูกส่งแยกจาก compatibility intervals เพื่อให้ CLI union กับ queue
  โดยไม่บวกเวลาซ้ำหลัง crash/retry

ค่าหลักยังคงค่าเริ่มต้น:

```text
DURATION_PRIMARY_MODE=wakatime_compatible
```

`active_v1` ควรเปิดหลัง shadow comparison และ live parity campaign ผ่านเท่านั้น.
กรณีสำคัญ “เขียน 7 นาที หยุด 1 นาที แล้วกลับมาเขียน” จะไม่กลายเป็น 8 นาทีจาก lease
เพียงอย่างเดียว.

## AI attribution และการตรวจว่าใครเขียนโค้ด

- Codex `apply_patch` ที่มี success evidence และจับคู่ operation ได้ จะเป็น verified AI event
- Codex shell และ Claude shell ใช้ before/after tool snapshot; หากพิสูจน์ชื่อ tool/model
  ไม่ได้ จะเก็บเป็น AI activity ที่ identity ต่ำลงหรือ `unknown` ตาม policy
- failed/no-op/ambiguous wrapper/partial ที่จับคู่ไม่ได้/truncated patch จะไม่สร้าง verified edit
- parser รองรับ patch หลายไฟล์, rename, delete, delete+add และ path ที่มี space
- ไม่ส่ง prompt, response, patch body หรือ source content ไป telemetry
- model/provider/session/tool IDs ต้องอยู่ใน correlation scope เดียวกัน; reused ID ข้าม session
  ห้ามซ่อมข้ามกัน
- VS Code line attribution ใช้ bounded before/after baseline; missing/mixed/large-file baseline
  ให้ `unavailable` หรือ `unknown` ไม่เดาเป็น human/AI
- actor enum เป็น truth หลัก; `is_ai_generated` เป็น compatibility field ที่ derive ตอนสุดท้าย

จุดอ้างอิงหลัก:

- `backend/api/crates/wakaclock-core/src/ai/codex.rs`
- `backend/api/crates/wakaclock-core/src/ai/patch.rs`
- `backend/api/crates/wakaclock-cli/src/broker.rs`
- `extensions/ai-agents/codex/heartbeat-hook.sh`
- `extensions/vscode/src/aiAttribution.ts`
- `extensions/vscode/src/buffer.ts`
- `extensions/vscode/src/externalFileObserver.ts`

## Local development state

Compose หลักอยู่ที่ repository root และเปิดพอร์ตดังนี้:

| Service | Host port |
| --- | ---: |
| API | 8080 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| ClickHouse HTTP | 8123 |
| ClickHouse native | 9000 |
| RabbitMQ AMQP | 5672 |
| RabbitMQ management | 15672 |

ไฟล์ local ที่ใช้งานอยู่คือ `backend/api/.env` (ถูก ignore โดย Git และไม่ควร commit
ค่า secret) โดยชี้ไปที่ `127.0.0.1` และใช้ database/user/password ชุดเดียวกับ
`docker-compose.yml`. Frontend local ชี้ API ไปที่ `http://localhost:8080` ใน
`frontend/app/.env.local`.

คำสั่งเริ่มระบบ:

```bash
cd /Users/jitwisutthobut/Desktop/wakaclock
docker compose -f docker-compose.yml up -d --wait postgres clickhouse redis rabbitmq
make dev-backend
```

ตรวจระบบ:

```bash
curl -i http://127.0.0.1:8080/health
wakaclock verify --json
wakaclock status --json
wakaclock today --json
```

ถ้า API รันใน container แทนการรันบน host ให้ใช้ service names เช่น `postgres:5432`,
`redis:6379` และ `clickhouse:8123`; ห้ามใช้ `127.0.0.1` จากภายใน API container.

## ผลตรวจล่าสุด

ผ่านแล้วใน local:

- core tests: 294 ผ่าน
- server tests: 323 ผ่าน, 27 ignored (integration dependencies)
- CLI tests: 66 ผ่าน
- broker process tests: 7 ผ่าน
- VS Code tests: 131 ผ่าน รวม regression 7 นาที + idle 1 นาที และ external-file receiver
- VS Code compile/lint, frontend typecheck/build และ Python audit tests ผ่าน
- Codex heartbeat hook test ผ่าน
- Docker PostgreSQL, Redis, ClickHouse และ RabbitMQ healthy
- API `/health` ตอบ `200 {"status":"Ok"}`
- CLI verify local API ได้ `authenticated=true`, `reachable=true`, `queue_count=0`
- heartbeat ทดสอบจาก `heartbeat-test.md` ส่งสำเร็จ `sent=1`, `queued=0` และอ่านกลับจาก
  `today` ได้ `last_increment_seconds=1.0`

ข้อจำกัดของผลตรวจ:

- full frontend suite ยังมี failure เดิม 1 รายการใน marketing parity (341 ผ่านจาก 342)
- unit/local tests ไม่ใช่ live certification
- ยังไม่ควรสรุปว่าแม่นหรือดีกว่า WakaTime จนกว่าจะ replay ข้อมูลอิสระ 7 วัน

## งานที่ยังค้างและความเสี่ยง

- TA-07 live certification สำหรับ Codex + Claude Code ยังไม่จบ: ต้องมี Claude login,
  authenticated readback, runtime artifacts และ campaign แยก Codex Desktop
- ต้องวัด p95 heartbeat latency, PostgreSQL pool wait/lock wait, ClickHouse insert latency,
  Redis latency และ queue depth ก่อน production scale
- PostgreSQL lock ถูกถือผ่าน ClickHouse write เพื่อกัน account deletion race; ที่ AI burst สูง
  อาจกลายเป็น bottleneck แม้ ClickHouse จะรับข้อมูลได้มาก
- queue flush แบบ single heartbeat อาจช้าถ้ามี backlog ใหญ่; bulk path ควรถูกใช้เมื่อปลอดภัย
- API direct mode พึ่ง PostgreSQL availability เมื่อ `POSTGRES_URL` เปิดอยู่; หาก PostgreSQL
  ล่ม heartbeat อาจถูกปฏิเสธก่อนถึง ClickHouse
- release CLI ที่ hook ใช้ต้องตรงกับ binary ที่ build ล่าสุด; ตรวจด้วย `wakaclock status`
  และ `cli_path.path_mismatch`

## Git / handoff state

งาน implementation ทั้งชุดถูก commit ใน `82a565a`. การ push ไปยัง
`origin/codex/integrate-all-current-work` ยังรอการยืนยันปลายทางจากผู้ใช้ หลังระบบ
auto-review ปฏิเสธ push ครั้งแรกเพราะไม่สามารถยืนยัน ownership ของ GitHub repository ได้.

เมื่อรับช่วงงาน ให้ตรวจ `git status`, เปิดเอกสารนี้และ progress plan ก่อนแก้โค้ด และอย่า
ใช้ผล local test แทน live certification.

# แผนนำ Kafka และ RabbitMQ มาใช้งานจริง

**สถานะ:** แผนที่ใช้งานอยู่ (active) ของ workstream นี้; R3/R4 เสร็จใน branch
`codex/integrate-all-current-work` เมื่อ 2026-09-13 และ Kafka K-P0/K0.5/K1/K2
มี implementation แบบ feature-gated แล้ว แต่ยังไม่เปิด production จนกว่า isolated
Redpanda/ClickHouse spike และ parity gate จะผ่าน

| ขั้น | สถานะ |
|---|---|
| P0.1 Contract | ✅ 2026-09-11 — `contracts.rs` ตาม D1–D4 + fixture `fixtures/message-envelopes/*-v1.json` (12 tests) |
| P0.2 Config | ✅ 2026-09-11 — `config/brokers.rs` (15 tests); ตั้งค่าไม่ครบหรือขอโหมดที่ยังไม่มีจะไม่ยอม boot |
| R1 RabbitMQ adapter | ✅ 2026-09-11 — `infrastructure/rabbitmq.rs`; integration tests 8 ตัวผ่านกับ RabbitMQ 3.13.7 และ 4.1.8 (รันซ้ำสองรอบไม่มีของค้าง) รวม restart broker |
| R2 Job foundation + relay | ✅ 2026-09-11 — migration `007_async_jobs.sql`, transactional outbox, `services/jobs.rs`, `GET /api/v2/jobs/:job_id`; partial relay, idempotency, sweeper และ broker e2e ผ่าน |
| R3 Worker runtime | ✅ 2026-09-13 — `job-worker` binary, migration `008_job_worker_state.sql`, lease fencing, retry/DLQ outbox, graceful drain และ health endpoints; PG regressions 8/8 และ RabbitMQ adapter 8/8 ผ่าน |
| R4 `analytics.reprocess` | ✅ 2026-09-13 — `ATOAXIS_REPROCESS_MODE=job` ตอบ `202` + `Location`/`job_id`, idempotency บังคับ, worker processor ทำงานจริง; sync mode คงเป็นค่าเริ่มต้น |
| K-P0 heartbeat ID/retry gate | ✅ validation 1..=256 bytes, server IDs ใน verify/kafka และ permanent 4xx ไม่เข้า retry queue |
| K0 spike harness + D6 record | 🟡 harness/decision template พร้อม; ต้องรัน isolated Redpanda + ClickHouse จริงก่อนตัดสิน production |
| K0.5 PostgreSQL ingest state | ✅ migration `009_ingest_state.sql`, backfill command, dual/postgres source wiring |
| K1 Kafka producer | ✅ `rdkafka` feature, idempotent producer, typed heartbeat envelope, topic/infra config |
| K2 heartbeat consumer | ✅ manual-offset fact-sink worker, strict/replay-safe writes, DLQ and health endpoints; e2e/rebalance gate pending |
| K3 verify + K4 cohort rollout | 🟡 orchestration/config/API response implemented; rollout/load/parity gate pending |
| R5 งานชนิดอื่น | ยังไม่เริ่ม |

การตัดสินใจที่ได้แล้ว (2026-09-11): **production ใช้ managed**, **ยอมรับ D5 (outbox) และ K3 (verify mode)**,
**งานแรกคือ `analytics.reprocess`** — ยังไม่ได้เลือกผู้ให้บริการ managed รายไหน

> คำว่า "broker" ใน [ROADMAP.md](ROADMAP.md) และ `docs/ai-activity-broker.md` หมายถึง
> AI activity broker ฝั่ง client ไม่เกี่ยวกับเอกสารนี้ ในเอกสารนี้ใช้ชื่อ Kafka/RabbitMQ ตรง ๆ

## เอกสารนี้ทำอะไร และไม่ทำอะไร

Design ภาพใหญ่มีอยู่แล้วใน [plan.md §9.22](../plan.md) (บรรทัด 4075–4393): envelope,
topic, partition, retention, exchange/queue, job contract, rollout, rollback, deployment
baseline แต่ `plan.md` ถูกจัดเป็น legacy/reference ใน [legacy-plan-index.md](legacy-plan-index.md)
และเขียนก่อน hardening pass วันที่ 2026-09-09

เอกสารนี้**ไม่เขียน §9.22 ซ้ำ** แต่ทำสองอย่าง:

1. ตัดสินจุดที่ §9.22 ขัดกับโค้ดปัจจุบัน (หัวข้อ D1–D10) — เมื่อขัดกัน **เอกสารนี้ชนะ**
2. กำหนดลำดับงานเป็น PR พร้อมเกณฑ์ผ่านของแต่ละขั้น

ส่วนที่ไม่ได้กล่าวถึงที่นี่ (เช่น retention, partition count เริ่มต้น, security controls,
metrics ที่ต้องมี) ให้ใช้ §9.22 ตามเดิม

## หน้าที่ของแต่ละตัว (คงตาม §9.22)

| ตัว | รับผิดชอบ | ห้ามรับผิดชอบ |
|---|---|---|
| **Kafka** | telemetry ปริมาณมากที่ไหลต่อเนื่อง: heartbeat, AI usage, AI edit — key = `user_id`, at-least-once + consumer ที่ idempotent | งานสั่งทำครั้งเดียว, retry แบบหน่วงเวลา, cron |
| **RabbitMQ** | งาน background ที่มีจุดจบ: reprocess, projection rebuild, export, report, integration sync, ลบบัญชี, billing reconcile — retry/backoff + DLQ | firehose ของ heartbeat, สำเนาที่สองของ telemetry |

ตัวหนึ่งไม่ใช่ fallback ของอีกตัว

## สถานะปัจจุบัน (ตรวจจากโค้ด 2026-09-10)

| สิ่ง | สถานะ |
|---|---|
| Client library Kafka/AMQP ใน `Cargo.lock` | ไม่มี |
| `backend/api/src/infrastructure/contracts.rs` | มี versioned event/job envelope, publisher/consumer contracts และ retry targets |
| Heartbeat ingest | `handlers/v1/heartbeats.rs` → `HeartbeatService::process_heartbeats` → ClickHouse ตรง (sync) |
| Worker | `src/bin/job-worker.rs` รัน relay + `analytics.reprocess`; job types อื่นยังไม่เปิด |
| export/report/integration | ถูกกันด้วย `require_background_processor()` → 503 |
| Reprocess | ทำงานจริงแบบ sync ใน HTTP request พร้อม PG advisory lock (`services/reprocess.rs`) — **ไม่ได้**อยู่หลัง 503 guard |
| `outbox_events` (PG) | relay อยู่ใน dedicated `job-worker`; poison row ถูก retire และ retry/DLQ ใช้ target ใน outbox |
| Docker compose | RabbitMQ อยู่ใน `infra-up`; Redpanda ยังอยู่หลัง profile `kafka` จน K1 |

## ข้อตัดสินใจ (D1–D10)

### D1 — ชื่อ topic/routing key: ใช้ชุดเดียว

`contracts.rs` กับ §9.22 ใช้คนละชุด และแบ่งงาน Kafka/RabbitMQ ต่างกัน
(`contracts.rs` เรียกงาน export/report ว่า "topic")

**ตัดสิน:**
- Kafka topics ใช้ชื่อตาม §9.22: `wakaclock.heartbeat.v1`, `wakaclock.ai-usage.v1`,
  `wakaclock.ai-edit.v1`, `wakaclock.identity-change.v1`, `wakaclock.ingest.dlq.v1`
- RabbitMQ: exchange `wakaclock.jobs` (topic, durable), DLX `wakaclock.jobs.dlx`
  routing key = `<domain>.<action>` รวมงานจาก §9.22 และงานที่มีในโค้ด:
  `analytics.reprocess`, `projection.rebuild`, `ai.session.reconcile`, `pricing.reconcile`,
  `export.generate`, `report.deliver`, `integration.sync`, `account.delete`, `billing.reconcile`
- ค่าคงที่ `*_TOPIC` เดิมใน `contracts.rs` ถูกแทนที่ทั้งหมด รวม `TRANSACTION_OUTBOX_TOPIC`
  (outbox ส่งไป RabbitMQ ไม่ใช่ Kafka — ดู D5) และแก้ comment ใน `docker-compose.yml`
  ที่บอกว่า Redpanda ใช้ส่ง outbox

### D2 — `event_id` ต้องคงที่ข้าม retry

`EventEnvelope::new()` สร้าง `event_id` ใหม่ด้วย `Uuid::now_v7()` ทุกครั้ง แล้วคัดลอกไปเป็น
`idempotency_key` ขัดกับกฎ §9.22 ที่ต้องให้ `event_id` คงที่ข้าม HTTP retry, offline replay
และ Kafka replay producer ที่ใช้ `new()` จะไม่ idempotent ตั้งแต่ต้น

**ตัดสิน:** แก้ใน contract ก่อนมี adapter ใด ๆ
- ลบ constructor ที่สุ่ม id; ผู้เรียกต้องส่ง identity ที่คงที่เข้ามาเอง
- Heartbeat: **1 Kafka record ต่อ 1 heartbeat** (ไม่ใช่ต่อ HTTP batch)
  `event_id` = `hb:{heartbeat_id}:{revision}`
- Heartbeat เก่าที่ไม่มี `heartbeat_id`: API กำหนด id ฝั่ง server ตอนรับ (`srv-{uuidv7}`)
  ก่อน publish — คงที่ข้าม Kafka replay; ส่วน HTTP retry ของ client รุ่นเก่าจะซ้ำได้เหมือนวันนี้
  (ไม่แย่ลง) **ต้องผ่าน spike K0 ก่อน** ว่าการมี id ไม่เปลี่ยนผล analytics ของแถว legacy

### D3 — Field ของ envelope

`EventEnvelope` มี `tenant_id`/`event_version`/`idempotency_key` ส่วน JSON ใน §9.22 มี
`schema_version`/`event_type`/`user_id`/`received_at`/`source`/`project_id`

**ตัดสิน:** ชื่อฝั่งโค้ดชนะ เพราะ `backend/api/CLAUDE.md` บังคับไว้เป็น invariant
("every queue message carries `event_id`, `event_version`, `tenant_id`, `occurred_at`,
`trace_id`, `idempotency_key`") แล้ว**เพิ่ม** `event_type`, `received_at`, `source`
- `tenant_id` ของ telemetry ส่วนตัว = `user_id` ของเจ้าของ credential (มาจาก `resolve_user_id` เท่านั้น)
- `project_id` อยู่ใน payload (nullable) ไม่ใช่ใน envelope
- เพิ่ม serde fixture test ของ envelope v1 ใน CI

### D4 — Contract ฝั่ง consume

`JobQueue` มีแค่ `enqueue`/`acknowledge`/`retry_or_dead_letter` ไม่มีฝั่งรับงาน

**ตัดสิน:** แยกเป็น `JobPublisher` (publish + รอ confirm) กับ `JobConsumer`
(stream ของ delivery; แต่ละ delivery มี `ack` / `retry(delay)` / `dead_letter(category)`)
ฝั่ง Kafka เพิ่ม `EventConsumer` แบบบางเพื่อให้ test ได้ แต่ consumer loop จริงอยู่ใน bin

### D5 — สถานะงานเก็บใน PostgreSQL + transactional outbox

§9.22 ให้เก็บ `async_jobs` ใน **ClickHouse** และให้ API ตอบ `202` หลัง RabbitMQ confirm เท่านั้น
ทั้งสองข้อล้าสมัยหลัง F08 ที่ทำให้ PostgreSQL เป็น source of truth ของ state แบบ transaction
และ `export_jobs`, `report_schedules`, `outbox_events` อยู่ใน PG แล้ว

**ตัดสิน:**
- ตาราง `async_jobs` อยู่ใน **PostgreSQL** ตาราง domain เช่น `export_jobs` อ้าง `job_id`
  ไฟล์ migration ใหม่ (`007_…sql`) ต้องเพิ่มเข้า list ใน `PostgresClient::migrate`
  (`backend/api/src/infrastructure/postgres.rs`) ต่อท้าย `006` ด้วย — วางไฟล์ในโฟลเดอร์อย่างเดียวไม่ถูกรัน
  และ SQL ต้อง idempotent เพราะทุกไฟล์ถูกรันซ้ำทุกครั้งที่ boot (ไม่มี version tracking)
- API เขียน `async_jobs` + `outbox_events` ใน **transaction เดียว** → ตอบ `202` + `job_id`
  แล้วลอง publish ทันที (fast path) งานที่ publish ไม่สำเร็จ `outbox-relay` จะส่งให้ภายหลัง
  ด้วย publisher confirm แล้วค่อยตั้ง `published_at`
- **ส่วนที่ต่างจาก §9.22:** RabbitMQ ล่มแล้วงานไม่ถูกปฏิเสธ แค่ล่าช้า เพราะ PG commit แล้ว
  สถานะ `pending_publish` ของ §9.22 ถูกแทนด้วย `outbox_events.published_at IS NULL`
- `Idempotency-Key` ซ้ำ → คืน `job_id` เดิม (unique constraint)
- Feature ที่ใช้งาน background ต้องมี PostgreSQL (ซึ่ง production ต้องมีอยู่แล้วตาม hardening rollout ข้อ 1)

### D6 — กันนับซ้ำเมื่อ Kafka ส่งซ้ำ (ต้องผ่าน spike ก่อน)

`heartbeats_incoming` เป็น `ENGINE = Null` ที่ป้อน `mv_inc_*` แบบบวกสะสม ถ้า record ถูกส่งซ้ำ
จะนับซ้ำ การตรวจ revision ที่มีอยู่ (`existing_heartbeat_revisions`) กันได้เฉพาะแถวที่มี
`heartbeat_id`; แถวที่ไม่มีใช้ `legacy-row:{index}` ใน 3 ที่
(`services/heartbeat.rs:206`, `services/activity_timeline.rs:243`, `services/reprocess.rs:465`)
ซึ่งไม่คงที่ถ้า batch ถูกจัดใหม่

**กลไกที่เสนอ (ต้องยืนยันใน K0):** consumer ประมวลผลแต่ละ partition ตามลำดับ + ตรวจ revision
เดิม + id ฝั่ง server ตาม D2 → record ที่ถูกส่งซ้ำจะเจอ revision ที่เก็บแล้วและถูกข้าม

**ทางสำรองถ้า K0 ไม่ผ่าน:** ClickHouse `insert_deduplication_token` ต่อ consumer batch
(ต้องตั้ง `non_replicated_deduplication_window` และ
`deduplicate_blocks_in_dependent_materialized_views`) หรือ dedup table ตาม §9.22
**ห้ามเขียน consumer (K2) จนกว่า K0 จะบันทึกผลตัดสิน**

### D7 — Error หลังตอบ "รับแล้ว"

วันนี้ revision gap ทำให้ `process_heartbeats` `bail!` → 500 → client เก็บไว้แล้ว retry ไปเรื่อย ๆ
เมื่อ ingest เป็น async client ได้ "รับแล้ว" ไปก่อน error จึงเกิดที่ consumer

**ตัดสิน:**
- API ยังตรวจทุกอย่างที่ไม่ต้องอ่าน state (`payload_to_heartbeat`, `validate`,
  `MAX_HEARTBEAT_REVISION`, จำนวน/ขนาด) และตอบ 400 แบบ sync เหมือนเดิม
- Error ถาวรที่ consumer (revision gap, no stored base) → ส่งไป `wakaclock.ingest.dlq.v1`
  พร้อม error category ที่ sanitize แล้ว, commit offset, ไม่ block partition
- Error ชั่วคราว (ClickHouse ล่ม) → pause partition + backoff, ไม่ commit offset
- ต้องมองเห็นได้: จำนวน DLQ และ lag แสดงใน health detail + log; มี runbook อ่าน DLQ
- ผลข้างเคียงที่ยอมรับ: client ที่ส่ง correction ผิดลำดับจะไม่ติด retry loop อีกต่อไป

### D8 — Read-your-writes และความหน่วง

status bar และ dashboard อ่านทันทีหลัง flush

**ตัดสิน:**
- เป้า: accept → เห็นใน ClickHouse p95 < 3 วินาทีที่โหลดปกติ (consumer batch 1,000 record หรือ
  500 ms ตาม §9.22) — alert/page ตาม §9.22 (5/15 นาที)
- ระหว่าง lag ตัวเลข "today" อาจตามหลังไม่กี่วินาที; phase แรกไม่ทำตัวบอก pending
- Response ของ ingest คงรูปเดิม (`status: "ok"`, `heartbeats_inserted`) เพื่อไม่ต้องแก้ client
  แต่ความหมายของตัวนับเปลี่ยนเป็น "จำนวนที่รับ" — เขียนใน compatibility manifest
- Presence ping (`record_presence_activity`) ยังทำใน API ตามจำนวนที่รับ

### D9 — ลำดับการลบปลอดภัยเพราะ tombstone

`delete_ids` เขียน `heartbeat_deletions` **ก่อน** mutation และ ingest ข้าม id ที่ถูกลบ
record ที่ค้างอยู่ใน Kafka สำหรับ id ที่เพิ่งถูกลบจึงไม่ทำให้ข้อมูลกลับมา
**นี่เป็น dependency:** consumer ต้องคงการตรวจ tombstone และ refactor ใดที่ย้ายการตรวจนี้ต้องมี test

### D10 — Library, build และ hosting

- Kafka: `rdkafka` (librdkafka) — มี idempotent producer และ consumer group ที่ใช้งานจริงได้;
  ต้องใช้ C toolchain + `cmake` → เพิ่ม `cmake` ใน `backend/api/Dockerfile` และบนเครื่อง dev
  (`brew install cmake`)
- RabbitMQ: `lapin`
- ทั้งสองเป็น dependency ของ package `wakaclock-server` เท่านั้น ห้ามอยู่ใน
  `wakaclock-core`/`-cli`/`-ls` เพื่อไม่ให้ release build ของ CLI/LSP ติด toolchain นี้
- Dev: Redpanda single node + RabbitMQ ใน compose
- Production: **managed** (Kafka: Redpanda Cloud/Confluent/Aiven/MSK;
  RabbitMQ: CloudAMQP/Amazon MQ) แทน self-host 3+3 node ตาม §9.22 — ตัดสินแล้ว 2026-09-11;
  ผู้ให้บริการรายไหนยังไม่ได้เลือก (ต้องรองรับ SASL/TLS ตาม env ใน P0.2)
- **Per-user ordering คือข้อจำกัด:** key = `user_id` แก้ race ของการอ่านแล้วค่อยเขียน
  revision ข้าม replica ที่มีอยู่วันนี้ แต่ห้ามประมวลผลขนานภายใน partition เดียว;
  ผู้ใช้ที่ส่งเยอะผิดปกติทำให้ partition เอียงได้

## ลำดับงาน

**RabbitMQ ก่อน Kafka** เพราะ:
- RabbitMQ ปลดล็อก F06 (P1 จาก audit) และ reprocess ที่ยังไม่ durable จาก F10
- Kafka แตะ path ที่ร้อนที่สุด (ingest) และต้องรอผล spike D6

ขนาดบอกเป็นจำนวน PR ไม่ใช่วัน

### Phase 0 — Foundation (2 PR)

**P0.1 Contract** — แก้ `contracts.rs` ตาม D1–D4, envelope fixture test, บันทึกใน §9.22 ว่า
ส่วนไหนถูกแทนโดยเอกสารนี้
**P0.2 Config** — struct config สำหรับ Kafka/RabbitMQ (ไม่ตั้งค่า = ทำงานแบบวันนี้ทุกประการ)
ส่วน `cmake` ใน Dockerfile และ CI service container ย้ายไปอยู่กับ adapter ที่ใช้มัน (R1 = `rabbitmq`,
K1 = `redpanda` + `cmake`) เพราะถ้าเพิ่มตอนนี้จะไม่มีอะไรใช้และตรวจไม่ได้ว่าถูก

Env ที่เสนอ (ชื่อเท่านั้น; ต้องเพิ่มใน `.context/environment.md` ตอน implement):
`ATOAXIS_JOB_QUEUE_URL`, `ATOAXIS_EVENT_BUS_URL` (มีแล้ว), `ATOAXIS_EVENT_BUS_SASL_MECHANISM`,
`ATOAXIS_EVENT_BUS_SASL_USERNAME`, `ATOAXIS_EVENT_BUS_SASL_PASSWORD`, `ATOAXIS_EVENT_BUS_TLS`,
`ATOAXIS_INGEST_MODE` (`direct` | `verify` | `kafka`), `ATOAXIS_INGEST_KAFKA_COHORT`,
`ATOAXIS_REPROCESS_MODE` (`sync` | `job`)

เกณฑ์ผ่าน: `cargo clippy -D warnings` + tests ผ่าน; ไม่ตั้ง env แล้วพฤติกรรมเหมือนเดิม

### RabbitMQ track

**R1 — RabbitMQ adapter** (1 PR)
- `infrastructure/rabbitmq.rs` implement `JobPublisher`/`JobConsumer` ด้วย `lapin`
- ประกาศ topology แบบ idempotent: exchange, DLX, quorum queue ต่อ routing key พร้อม
  `x-delivery-limit`, retry ผ่าน delay queue ที่มี TTL (5s / 30s / 2m / 10m ตาม §9.22)
- publisher confirm, manual ack, prefetch ต่อ queue
- เพิ่ม service container `rabbitmq` ใน CI job ที่รัน ignored tests
- คืน `rabbitmq` เข้า `make infra-up`; `redpanda` ยังอยู่หลัง profile `kafka` (`make infra-kafka-up`) จนถึง K1 — ตามหลักที่ว่าไม่รัน container ที่ยังไม่มีโค้ดใช้
- แก้ `.context/dead-code.md:35` และ `.context/data/overview.md:16` ที่บอกว่าไม่มีโค้ดต่อ broker
- เกณฑ์ผ่าน: ignored integration tests กับ RabbitMQ จริง — confirm, redelivery หลัง nack,
  DLQ หลังครบจำนวนครั้ง, restart broker ระหว่างมีงานแล้วงานไม่หาย

**R2 — Job foundation ใน PostgreSQL** (ทำแล้ว)
- migration `007_async_jobs.sql` + `JobService::create` (idempotency key ต่อ `(user_id, kind, key)`) → job row + outbox row ใน transaction เดียว (D5)
- `JobService::relay_once`: `SELECT … FROM outbox_events WHERE aggregate_type = 'async_job' … FOR UPDATE SKIP LOCKED` → `publish` + confirm → ตั้ง `published_at`; หยุดที่ publish แรกที่ล้มเหลวแล้ว commit เท่าที่สำเร็จ; row ที่ decode ไม่ได้ log แล้วข้าม
- poison row มี `failed_at`/`failure_code` ตั้งแต่ R3: relay retire แถวที่ decode หรือ target ไม่ได้ และ dead-letter สถานะ job เพื่อไม่ให้ค้างบล็อกงานที่ถูกต้องด้านหลัง
- `JobService::sweep_once`: job `running` ที่ `lease_expires_at` เลยเวลา → re-enqueue ผ่าน outbox row ใหม่ `attempt + 1`; ครบ `JOB_RETRY_DELAYS.len()` → `dead_lettered`
- `GET /api/v2/jobs/:job_id` ตรวจ ownership (`user_id = caller`); system job และ job ของคนอื่นเป็น 404
- **ต่างจากแผนเดิม:** relay อยู่ใน process ของ `job-worker` ซึ่งใช้ `src/lib.rs` แชร์ services กับ API; `wakaclock-server` ไม่เปิด RabbitMQ connection เอง และ `src/bin/outbox-relay.rs` เหลือไว้เป็น stub สำหรับ deploy script เก่า
- worker-side transitions (claim/complete/fail) ถูกเพิ่มใน R3 และ `JobService::create` ต่อเข้ากับ `/reprocess` ใน R4
- เกณฑ์ผ่าน (ทำแล้ว): partial relay pass ที่ publish ล้มเหลว → row ที่ confirm แล้วถูก mark, ที่เหลือ retry รอบหน้า, ไม่ publish ซ้ำ (path นี้ commit สะอาด); foreign outbox row (`aggregate_type` อื่น) ไม่ถูกแตะ; Idempotency-Key ซ้ำได้ `job_id` เดิมและไม่เขียน outbox เพิ่ม
- **การรับประกันคือ at-least-once ไม่ใช่ exactly-once:** process ตายหลัง publish ถูก confirm แต่ก่อน `tx.commit()` → `published_at` rollback → รอบถัดไป publish ซ้ำ นี่คือเหตุผลที่ `JobEnvelope` ถือ `job_id` คงที่ และ worker ของ R3 ต้อง idempotent ต่อ `job_id`; งานไม่หาย

**R3 — Worker runtime** (เสร็จ 2026-09-13)
- เพิ่ม `src/lib.rs` และ `src/bin/job-worker.rs` ให้ worker เป็น process แยก; API ยังทำงานแบบ sync ได้เมื่อไม่ได้เปิด job mode
- runtime รับ `analytics.reprocess` ด้วย concurrency = RabbitMQ prefetch, claim พร้อม lease owner, renew, complete/fail และ graceful drain
- `JobService` มี claim/renew/complete/retry/dead-letter แบบ owner-fenced; retry/DLQ เขียน transactional outbox target เดียวกับการเปลี่ยนสถานะ
- worker dedupe ต่อ `job_id`: running/terminal/stale delivery ถูก acknowledge โดยไม่รัน processor ซ้ำ; poison outbox ถูก retire ไม่ให้บล็อกแถวถัดไป
- readiness = เชื่อมต่อ RabbitMQ + มี processor และมี `/live`/`/ready` ที่พอร์ต 8081 (ปรับได้ด้วย env)

**R4 — งานแรก: `analytics.reprocess` (เสร็จ 2026-09-13)**
- เลือกเพราะไม่ต้องพึ่งระบบภายนอกเพิ่ม (export ต้องมี object store, report ต้องมีช่องทางส่ง,
  integration ต้องมี vault) และมี PG advisory lock อยู่แล้ว
- ย้าย body ของ `ReprocessService::run` ไปเป็น processor; `POST /api/v1/reprocess` ตอบ `202` + `job_id` และ `Location: /api/v2/jobs/:job_id` เมื่อ `ATOAXIS_REPROCESS_MODE=job`
- job mode ตรวจ date range ก่อนสร้างงานและบังคับ `Idempotency-Key` แบบ ASCII 1–128 bytes; key เดิมคืน job เดิมโดยไม่เพิ่ม outbox row
- **ข้อควรระวัง:** endpoint นี้ใช้งานได้อยู่วันนี้ (ต่างจากตัวอื่นที่ตอบ 503) จึงคง path แบบ sync
  ไว้หลัง flag จนกว่าจะยืนยันผลใน production
- ค้น `frontend/app` แล้ว (2026-09-10) ไม่พบผู้เรียก `analytics/rebuild`, `reprocess` หรือ `repair`
  การเปลี่ยนเป็น `202` + job status จึงไม่มีหน้า dashboard ที่ต้องย้ายตาม — ผู้เรียกที่เหลือคือ CLI/สคริปต์
  ซึ่งต้องตรวจก่อนเปลี่ยน default
- `projection.rebuild` ที่แตกออกมาได้ child job id แบบ deterministic
- ถอดเงื่อนไข `ReprocessMode::Job` ออกจาก `BrokerConfig::ensure_supported` ใน PR นี้ (K3/K4 ทำแบบเดียวกันกับ `IngestMode`)
- เกณฑ์ผ่านที่ตรวจแล้ว: restart broker ระหว่าง retry แล้วงานยังกลับมา, worker claim/transition ถูก fence และ duplicate delivery ไม่รันซ้ำ; ปิดข้อ "reprocess ยังไม่ใช่ durable job" ของ F10

**R5 — งานที่เหลือ งานละ 1 PR** (ถอด 503 guard ของงานนั้นหลังผ่าน e2e test เท่านั้น)

| งาน | ต้องมีก่อน |
|---|---|
| `export.generate` | `ObjectStore` adapter (S3/MinIO), signed URL, checksum, expiry |
| `report.deliver` + scheduler | ช่องทางส่ง (email provider); scheduler เลือกงานที่ถึงเวลาด้วย `SKIP LOCKED` |
| `integration.sync` | `CredentialVault` (F11) — ต่อยอดจาก `infrastructure/secret_box.rs` ได้ |
| `account.delete` | ลบข้าม PG + ClickHouse + object store พร้อม verification |
| `billing.reconcile` | billing provider |

### Kafka track

**K0 — Spike ความถูกต้อง (gate; harness แยก feature จาก production)**
รันกับ ClickHouse + Redpanda จริง แล้วบันทึกผลเป็น `docs/kafka-ingest-dedup-spike-<date>.md`:
1. ส่ง record ของ heartbeat ที่มี id ซ้ำ (consumer ประมวลผล partition ตามลำดับ + ตรวจ revision) →
   ไม่นับซ้ำใน `heartbeats`, `activity_intervals`, `mv_inc_*`
2. heartbeat legacy ที่ได้ id ฝั่ง server → durations/summaries เท่ากับ path ตรง
3. ล้มเหลวบางส่วนระหว่าง insert raw กับ interval/MV
4. rebalance กลาง batch (consumer สองตัวถือ partition เดียวกันช่วงสั้น ๆ)
5. ทางสำรอง `insert_deduplication_token`

6. นับแถวที่ `heartbeat_id` ยาวเกิน `MAX_SOURCE_ID_LEN` (256) ที่มีอยู่แล้ว — ดูข้อจำกัดด้านล่าง

ผลลัพธ์: `backend/api/src/bin/kafka-spike.rs` และ
`docs/kafka-ingest-dedup-spike-2026-09-13.md` เตรียม isolated topic/decision record
แล้ว แต่ต้องรันกับ endpoint จริงเพื่อเติม counts และตัดสิน D6 ก่อนเปิด cohort production

**เงื่อนไขก่อน K1/K2:** `StableEventId::heartbeat` ปฏิเสธ id ที่ยาวเกิน 256 bytes แต่
`Heartbeat::validate` ใน `wakaclock-core` ตรวจแค่ว่า id ไม่ว่าง ในโหมด Kafka heartbeat ที่ id ยาวจะ
publish ไม่ได้ ต้องเพิ่มการตอบ 400 ที่ API ก่อน publish (ไม่แก้ใน P0.1 เพราะเปลี่ยน path ที่ใช้งานอยู่)

**K1 — Kafka producer adapter** (1 PR)
`infrastructure/kafka.rs` implement `EventBus` ด้วย `rdkafka`: `acks=all`, `enable.idempotence=true`,
compression, `linger.ms` ต่ำ, delivery timeout; key = `user_id`; สคริปต์สร้าง topic สำหรับ dev (`rpk`)
และเอกสาร config สำหรับ production — ignored tests กับ Redpanda; เพิ่ม `cmake` ใน `backend/api/Dockerfile`
และ service container `redpanda` ใน CI

**K2 — Consumer `heartbeat-ingest`** (1–2 PR)
- bin ใหม่ (หรือเปลี่ยนชื่อ `heartbeat-enrichment` ที่เป็น stub) consumer group
  `wakaclock.heartbeat.fact-sink`, ปิด auto-commit
- รวม batch 1,000 record / 500 ms → จัดกลุ่มตาม user → เรียก `HeartbeatService::process_heartbeats`
  **ตัวเดิม** → commit offset หลังสำเร็จ
- error ตาม D7; rebalance แบบ cooperative-sticky และทำ batch ที่ค้างให้เสร็จก่อนคืน partition
- คงการตรวจ tombstone (D9)

**K3 — โหมด verify** (1 PR)
- `ATOAXIS_INGEST_MODE=verify`: API ยังเขียน ClickHouse ตรง (เป็นหลัก) **และ** publish ไป Kafka;
  consumer ไม่เขียน แต่ตรวจว่าทุก id ของ record มีอยู่ใน ClickHouse หลังช่วงเวลาหนึ่ง แล้วรายงานส่วนที่ไม่ตรงและ lag
- **ส่วนที่ต่างจาก §9.22** (ซึ่งใช้ shadow table): logic การเขียนของ consumer คือ `process_heartbeats`
  ตัวเดียวกับ path ตรง สิ่งที่ต้องพิสูจน์คือ transport (ข้อมูลหาย, ลำดับ, serialization, lag)
  ไม่ใช่การคำนวณ จึงไม่ต้องสร้าง schema เงา
- เกณฑ์ผ่าน: รันกับบัญชีจริงอย่างน้อยหนึ่งช่วงที่ใช้งานปกติ ไม่มี mismatch

**K4 — สลับทีละกลุ่มผู้ใช้** (1 PR + ช่วงเฝ้าดู)
- `ATOAXIS_INGEST_MODE=kafka` + cohort (เริ่มจาก allowlist บัญชีของทีม → เปอร์เซ็นต์ตาม hash ของ `user_id`)
- API ตอบหลัง Kafka ack; publish ไม่สำเร็จ → `503` + `Retry-After`
- **ต้องตรวจก่อนเปิด:** CLI (`wakaclock-core` queue) และ VS Code extension เก็บ item ไว้เมื่อได้ 503
  และแสดงให้ผู้ใช้เห็น ไม่ใช่ซ่อนความล้มเหลว
- load test ตามเป้า §9.22 (ack p95 < 250 ms, lag < 60 s) + เป้า read-your-writes ของ D8
- เพิ่ม metrics exporter ก่อน load test (repo ยังไม่มี metrics crate)

**K5 — ขยายและถอด path ตรง** (หลาย PR)
- `/api/v1/ai/usage` → `wakaclock.ai-usage.v1`; consumer group แยกสำหรับงานอื่น
  (เช่น trigger `ai.session.reconcile` เข้า RabbitMQ)
- ถอด path เขียน ClickHouse ตรงหลังผ่าน replay/rollback tests ตาม §9.22 ขั้น 7 เท่านั้น;
  ระหว่างนั้นเก็บ `direct` ไว้เป็น break-glass

## Definition of done ของทุก PR

- ทำตาม layer handler → service → repository และ `auth::resolve_user_id` (CLAUDE.md กฎ 4–5)
- ไม่มี secret, token, prompt, source, path เต็มใน message body/header/key/log
- แก้ `.context/` ที่เกี่ยวข้องใน PR เดียวกัน (เอกสารที่บอกว่า "ไม่มีโค้ดต่อ broker" จะผิดทันทีที่ R1 merge)
- feature ที่ยังไม่ครบยังแสดงเป็น unavailable/partial ใน capabilities (F12)

## สิ่งที่ต้องให้คุณตัดสินใจก่อนเริ่ม

1. ~~**Hosting production:** managed (แนะนำ) หรือ self-host~~ → **managed** (ตัดสินแล้ว 2026-09-11)
2. ~~**ยอมรับส่วนที่ต่างจาก §9.22:** outbox แทนการรอ confirm (D5), verify mode แทน shadow table (K3)~~
   → **ยอมรับ** (2026-09-11)
3. ~~**งานแรก:** `analytics.reprocess` (แนะนำ)~~ → **ยอมรับ** (2026-09-11)
4. **ผู้ให้บริการ managed:** ยังไม่ได้เลือก — config ใน P0.2 เป็นแบบกลาง (SASL/TLS, `amqps://`) ต้องเลือกก่อน R1/K1 ขึ้น production

## ความเสี่ยงที่รู้อยู่

- ภาระดูแลระบบและค่าใช้จ่ายของ broker สองตัว — ลดได้ด้วย managed
- Build ช้าลงและต้องมี `cmake` จาก `rdkafka`
- Partition เอียงจากผู้ใช้ที่ส่งหนัก
- ถ้า K0 ไม่ผ่าน ต้องทำ dedup table ตาม §9.22 ซึ่งเป็นงานใหญ่กว่า และ K2 จะเลื่อน

# Production runtime: Kafka และ RabbitMQ เปิดตลอด

ไฟล์ในโฟลเดอร์นี้กำหนดให้ production ใช้ Kafka และ RabbitMQ เสมอ โดย **ไม่เปลี่ยนค่า default ในโค้ด**
(`direct` / `sync` / `disabled`) ซึ่ง dev, test และ CI ยังใช้อยู่ ค่าที่ทำให้ broker เปิดตลอดอยู่ใน `.env`
ของ production และทุก deploy อ่านไฟล์เดียวกัน จึงไม่มีขั้นตอนที่ต้องเปิดด้วยมือ

| ไฟล์ | หน้าที่ |
| --- | --- |
| `compose.yaml` | API และ worker ทุกตัวจาก image เดียว (`backend/api/Dockerfile`, build `--features kafka`) |
| `.env.example` | รายชื่อตัวแปรและค่าโหมด broker ปลายทาง; copy เป็น `.env` (git-ignored) แล้วใส่ค่าจาก secret store |

API ปฏิเสธการ boot เมื่อโหมด broker ขาด dependency (`backend/api/src/config/brokers.rs`) เช่น
`kafka` ที่ไม่มี `ATOAXIS_EVENT_BUS_URL`, cohort หรือ PostgreSQL และ `job` ที่ไม่มี `ATOAXIS_JOB_QUEUE_URL`
deploy ที่ตั้งค่าไม่ครบจึงล้มทันที ไม่ถอยกลับไป path ตรงแบบเงียบ ๆ

## Process ที่รันตลอดบน server ของเรา

| Service | Binary | หน้าที่ | Health (`/live`, `/ready`) |
| --- | --- | --- | --- |
| `api` | `wakaclock-server` | HTTP API; ส่ง heartbeat/AI usage เข้า Kafka และสร้าง job ผ่าน outbox | `:8080/health` |
| `heartbeat-enrichment` | `heartbeat-enrichment` | Kafka → ClickHouse สำหรับ heartbeat | `:8082` (`KAFKA_CONSUMER_HEALTH_PORT`) |
| `ai-usage-ingest` | `ai-usage-ingest` | Kafka → ClickHouse สำหรับ AI usage | `:8084` (`AI_USAGE_CONSUMER_HEALTH_PORT`) |
| `job-worker` | `job-worker` | outbox relay และ reprocess jobs บน RabbitMQ | `:8081` (`ATOAXIS_JOB_WORKER_HEALTH_PORT`) |
| `ai-session-worker` | `ai-session-worker` | `ai.session.reconcile` jobs | `:8085` (`AI_SESSION_WORKER_HEALTH_PORT`) |
| `projection-worker` | `projection-worker` | projection rebuild jobs | `:8086` (`PROJECTION_WORKER_HEALTH_PORT`) |
| `export-worker` | `export-worker` | `export.generate` → S3 | `:8082` (`EXPORT_WORKER_HEALTH_PORT`) |
| `account-deletion` | `account-deletion` | ลบบัญชีผ่าน job + S3 proof | `:8087` (`ACCOUNT_DELETION_WORKER_HEALTH_PORT`) |
| `heartbeat-verifier`, `ai-usage-verifier` | ชื่อเดียวกัน | shadow verifier ช่วง rollout เท่านั้น (`--profile verify`) | — |

Process เหล่านี้รันบน cloud ของเรา ไม่ใช่เครื่องผู้ใช้ เครื่องผู้ใช้ยังเป็น on-demand: extension/hook → SQLite queue
ในเครื่อง → `https://api.atoaxis.com`

## สิ่งที่ต้องมีก่อน deploy

- Managed PostgreSQL, ClickHouse (สร้าง database `wakaclock` ไว้ก่อน), Redis, Kafka (SASL + TLS),
  RabbitMQ (`amqps`) และ S3 bucket
- DNS `api.atoaxis.com` → reverse proxy/load balancer ที่ terminate TLS แล้วส่งต่อไป `api:8080`
- `.env` ครบตาม `.env.example` จาก secret store

## ลำดับเปิดใช้ (ครั้งแรก)

การสลับ transport ของ heartbeat อยู่ใน protected scope ของ `.context/heartbeat-safety.md` ทุกขั้นที่เปลี่ยนโหมด
ingest ต้องได้รับอนุมัติจากเจ้าของก่อน และต้องเทียบผลรวมเวลา/จำนวน heartbeat ก่อนไปขั้นถัดไป

0. **Ingest state:** รัน `ingest-state-backfill` (dry-run ก่อน แล้ว `--apply`) เพื่อคัดลอก access/project-rule state
   ไป PostgreSQL และตั้ง `ATOAXIS_INGEST_STATE_SOURCE=postgres` binary นี้ **ยังไม่ได้ copy ลง runtime image**
   ใน `backend/api/Dockerfile` ต้องเพิ่มก่อน หรือรันจาก builder stage
1. **Verify:** `ATOAXIS_INGEST_MODE=verify`, `ATOAXIS_AI_USAGE_INGEST_MODE=verify` แล้วเปิด
   `docker compose --profile verify up -d` ให้ verifier เทียบ path ตรงกับ Kafka
2. **Cohort:** `ATOAXIS_INGEST_MODE=kafka` กับ `ATOAXIS_INGEST_KAFKA_COHORT=percent:10` (และ AI usage แยกกัน)
   แล้วขยาย percent ตามผลเฝ้าดู
3. **ปลายทาง:** cohort `all` ตาม `.env.example` แล้วหยุด verifier (`docker compose --profile verify stop`)

RabbitMQ job modes (`job`) เปิดได้ตั้งแต่ deploy แรก เพราะ worker ใช้ PostgreSQL outbox เป็น source of truth

## Rollback

ตั้งโหมดกลับเป็น `direct` / `sync` / `disabled` แล้ว restart API การตั้ง cohort ค้างไว้ไม่ทำให้ boot ล้มในโหมดอื่น
ข้อมูลใน ClickHouse/PostgreSQL และ message ที่ค้างใน broker ไม่ถูกลบ

## Dev และ test ในเครื่อง

```bash
make infra-up          # PostgreSQL, ClickHouse, Redis, RabbitMQ
make infra-kafka-up    # Redpanda (Kafka-compatible)
make dev-job-worker
make dev-heartbeat-enrichment
make dev-ai-usage-ingest
```

ตั้ง `ATOAXIS_EVENT_BUS_URL=localhost:9092`, `ATOAXIS_JOB_QUEUE_URL=amqp://wakaclock:wakaclock-dev-password@127.0.0.1:5672/%2f`
และโหมดที่ต้องการใน `backend/api/.env` ส่วน adapter tests ของ RabbitMQ:

```bash
cd backend/api && RABBITMQ_TEST_URL='amqp://wakaclock:wakaclock-dev-password@127.0.0.1:5672/%2f' \
  cargo test -p wakaclock-server infrastructure::rabbitmq -- --ignored --test-threads=1 \
  --skip survive_a_broker_restart
```

## ยังไม่รวมในไฟล์นี้

- Guard แบบ `ATOAXIS_REQUIRE_BROKERS=true` ที่ทำให้ API ไม่ boot ถ้ามีคน deploy เป็น `direct` โดยไม่ตั้งใจ ต้องแก้
  config ฝั่ง ingest และต้องได้รับอนุมัติก่อน
- Commits บน `features/kafka-rabbitmq-production-readiness` (R5 acceptance, provider contracts, CI readiness gates)
  ยังไม่ได้ merge เข้า main

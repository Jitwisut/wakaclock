# Backend audit และแผนแก้ไข — 9 กันยายน 2026

สถานะการแก้ไขล่าสุดดู [backend-hardening-2026-09-09.md](backend-hardening-2026-09-09.md) รายงานด้านล่างเป็นผลตรวจ **ก่อนแก้ไข**

ตรวจจาก working tree ปัจจุบันของ Rust workspace `backend/api` โดยยังไม่แก้ implementation และไม่ได้เชื่อมต่อ production ข้อค้นพบด้าน runtime ด้านล่างเป็นผลจากการไล่โค้ด ไม่ใช่ผลทดสอบโจมตีหรือ fault injection บนระบบจริง

มีการแก้ไขเดิมใน `crates/wakaclock-core/src/queue.rs` และ `frontend/app/next-env.d.ts` อยู่ก่อนเริ่มตรวจ ไม่ได้แก้สองไฟล์นี้

## ข้อสรุป

แกนรับ telemetry และคำนวณ canonical timeline มี implementation และ unit tests มากพอสมควร แต่ยังมีช่องว่างด้าน OAuth authorization, credential lifecycle, การแก้/ลบข้อมูลกับ projection และงาน background ที่ยังไม่ครบวงจร การมี route หรือ worker binary ไม่ได้แปลว่า feature ทำงาน end-to-end แล้ว

ลำดับที่แนะนำ: ปิดช่องสิทธิ์/credential → แก้ heartbeat correction/deletion → ทำ transactional identity และ durable jobs → เติม product flow และ operational hardening

## Flow ที่ไล่ตรวจ

| Flow | เส้นทางหลัก | ผลตรวจและงานคงเหลือ |
|---|---|---|
| Startup | config → ClickHouse/PostgreSQL/Redis → migrations → auth cache → router | DB health มีแล้ว; PostgreSQL มี connection เดียว ไม่มี recovery; migration เปลี่ยน view ระหว่าง boot |
| Register/login | handler → UserService → ClickHouse → PostgreSQL sync → JWT | check-then-insert สมัครซ้ำได้เมื่อแข่งกัน; sync ข้าม DB ล้มเหลวแต่ยังตอบสำเร็จ |
| API key | session → generate/revoke → DB → local cache | เก็บ plaintext; invalidation ไม่ข้าม instance; partial write ทำให้สถานะไม่ตรงกัน |
| OAuth PKCE/device/refresh/revoke | OAuthService → PostgreSQL → local token cache | มีโค้ด consume grant/rotation และ isolated DB test; endpoint ปลายทางบางตัวไม่ตรวจ scope; cache ไม่กระจาย |
| Heartbeat ingest | auth/scope/access → validate → project identity → dedup/revision → raw/MVs → intervals | มี validation/attribution policy; ต้องแก้ correction projection และทดสอบ retry/concurrency |
| Heartbeat delete | auth/scope → DELETE raw | ไม่ลบ intervals หรือ invalidate aggregates |
| Time analytics | intervals + canonical raw → clip/union/idle bridge → summaries/stats/durations | ใช้ timeline ร่วมกันเป็นจุดแข็ง; projected row เก่าอาจกลบ revision ล่าสุด |
| AI usage/attribution | validate metadata → pricing/project lookup → usage/session → analytics | มีการรักษา unknown/unpriced; ต้องทดสอบ correction/retry และ reconciliation เมื่อ enrichment ล้มเหลว |
| Projects/rules/reprocess | resolve stable ID → backfill → delete aggregates → replay → publish version | มี dry-run/audit; legacy rebuild มีช่วงข้อมูลไม่ครบเมื่อเขียนล้มเหลวหรือรันชนกัน |
| WakaTime import | auth → server file_path → read JSON ทั้งไฟล์ → insert rows | รับ path ของ server จากผู้ใช้; bypass ingest service และไม่มี import job/idempotency workflow |
| Goals | scope → PostgreSQL CRUD → canonical timeline progress | มี implementation; ยังต้อง DB/API lifecycle tests เช่น timezone, update/delete และสิทธิ์ต่าง user |
| Org/team/billing | scope → AuthorizationService → PostgreSQL | มี role/entitlement checks; mutations บางตัวใช้ read scope; multi-statement writes ไม่มี transaction |
| Presence v2 | membership/grant → PG room → Redis lease/ticket/SSE → CH history | มี ticket/expiry/reconciler; ต้องทดสอบ disconnect, API restart และหลาย replica ด้วย DB จริง |
| Integration/VCS | credential registration → sync status/outbox → provider data → attribution | attribution มี logic; worker sync/relay ยังไม่ทำงานจริงใน repository นี้ |
| Exports/reports | create job/schedule → PostgreSQL → worker | หยุดที่บันทึก record; worker ไม่มี processing; export response ไม่มี download URL เสมอ |
| Public sharing/leaderboards | auth → grant/member CRUD → public lookup | มี expiry/revoke/privacy checks; chart badge ยังเป็นข้อความคงที่ และ leaderboard มี membership แต่ไม่มี ranking calculation ใน service |
| Enterprise/SCIM | admin scope/SCIM token → tenant authorization → provisioning | มี management/provisioning code; ต้องแยก readiness ของ SSO configuration ออกจาก login จริงและทดสอบ IdP end-to-end |
| Account deletion | worker binary | ไม่พบงานลบข้าม stores ใน runtime ที่ถูกเรียก |

ขอบเขตนี้เป็นการไล่ route families และ critical write/read paths ไม่ใช่การรับรองทุก branch ของทุก endpoint หรือ client extension ทั้งหมด

## ปัญหาที่ควรแก้

### F01 — P1: OAuth token ที่มีสิทธิ์จำกัดเรียก mutation นอก scope ได้

- จุดหลัก: `src/handlers/v2.rs:794` เป็นต้นไป (`profile_update`, share links, report schedules), `src/handlers/v1/reprocess.rs:17`, `src/handlers/v1/wakatime_import.rs:19`
- ฟังก์ชันเหล่านี้เรียก `resolve_user_id` ซึ่งรับ OAuth token ได้ แต่ไม่มี `require_scope` หรือ session-only guard
- ตัวอย่างเชิงโค้ด: token ที่ได้เพียง `read_goals` สามารถผ่าน auth ของ PATCH profile แล้วตั้ง `is_public=true` ของเจ้าของ token ได้ เพราะ service ไม่ตรวจ credential scope ซ้ำ
- อีกกรณี: organization create/update ใช้ `read_orgs`; add/remove member ใช้ `read_org_members`; leaderboard mutation ใช้ `read_private_leaderboards` แม้ชื่อ scope บอกว่าอ่าน
- แก้: สร้าง auth context กลางที่ระบุ credential type, user, scopes; กำหนด method/path → scope policy ให้ครบ สำหรับการเผยแพร่ข้อมูล/จัดการบัญชีให้ใช้ session-only หรือ write scope ที่ชัดเจน และปรับ consent/manifest พร้อมกัน
- Acceptance: limited OAuth token ได้ 403 สำหรับทุก mutation นอก grant; session/API-key behavior ตรงตาม policy; role checks ยังทำงานหลังผ่าน scope

### F02 — P1: เก็บ API key แบบ plaintext และอ่านกลับได้ตลอด

- จุดหลัก: `src/services/user.rs:247`, `:275`, `:546`; `src/repository/analytics.rs:559`; `src/handlers/v1/api_key.rs:53`
- สร้าง key แล้วเขียนทั้ง hash และ `api_key_plain` ลง ClickHouse; dashboard session อ่าน plaintext กลับได้ ขัดกับ README ที่ระบุ hash/encryption และแสดงครั้งเดียว
- ผลกระทบ: ผู้ที่อ่านตาราง/backup ได้จะได้ credential ที่ใช้งานจริง; เปลี่ยนค่า row อย่างเดียวไม่รับประกันล้าง plaintext เก่าใน storage/backup
- แก้: เก็บเฉพาะ hash/prefix และแสดงครั้งเดียว หรือถ้าผลิตภัณฑ์ต้องอ่านกลับจริงให้ใช้ server-managed envelope encryption/KMS และ audit การเปิดดู; วางแผน rotate key และจัดการข้อมูลเก่าอย่างชัดเจน
- Acceptance: ไม่มี plaintext key ใน DB/log/export; revoke/rotation ทำงานหลัง restart; UI รองรับ key ที่อ่านกลับไม่ได้

### F03 — P1: Auth cache ทำให้ revoke/issue ไม่สอดคล้องระหว่าง replica

- จุดหลัก: `src/infrastructure/auth_cache.rs:17`, `:67`, `:127`; `src/main.rs:133`; handler API-key/OAuth
- cache อยู่ใน process; โหลดจากฐานข้อมูลที่ startup; mutation แก้เฉพาะ cache instance ที่รับ request ไม่มี pub/sub, TTL refresh หรือ database fallback เมื่อ miss
- ตัวอย่าง: issue token ที่ A แล้ว request ไป B อาจได้ 401; revoke ที่ A แล้ว B ยังรับ key เก่าได้ สำหรับ API key ไม่มี expiry ใน cache
- PostgreSQL API-key `expires_at` ถูกตรวจเฉพาะตอนโหลด แต่ไม่เก็บ expiry ไว้ตรวจทุก lookup ต่างจาก OAuth
- `refresh_from_postgres` เพิ่ม active API keys แต่ไม่ล้าง PG key เก่าที่ถูก revoke จึงแก้ด้วย periodic refresh อย่างเดียวไม่ได้
- JWT ตรวจเพียงลายเซ็นและหมดอายุ ไม่ตรวจ account/session revocation ทำให้ไม่มี server-side kill switch สำหรับ session 24 ชั่วโมง
- แก้: credential record เดียวพร้อมชนิด/expiry/scopes/revocation version; authoritative lookup หรือ shared cache + invalidation/revalidation ที่กำหนด SLA; session version/revocation mechanism
- Acceptance: test A/B ทั้ง issue/rotate/revoke/deactivate/expiry โดยไม่ restart และไม่มีช่วง key เก่าถูกยอมรับเกิน SLA

### F04 — P1: ลบ heartbeat แล้วเวลายังค้างใน timeline

- จุดหลัก: `src/repository/heartbeat.rs:618`; `src/services/activity_timeline.rs:217`
- `delete_ids` ลบเฉพาะ `wakaclock.heartbeats`; timeline อ่าน `activity_intervals FINAL` แยกโดยไม่ join ว่า raw row ยังมีอยู่ จึงยังนับ segment ที่ลบ heartbeat ไปแล้ว แม้ raw mutation เสร็จ
- aggregates ที่สร้างจาก incoming ก็ไม่มี invalidation ใน flow นี้
- แก้: durable deletion/tombstone ที่ canonical readers เคารพทันที แล้ว purge intervals และ rebuild affected projections ตาม user/date; ระบุ accepted/pending/completed ให้ตรง async semantics
- Acceptance: ingest → ตรวจทุก time surface → delete → รอ completion → ทุก surface ไม่เหลือเวลา/line count ของข้อมูลนั้น; replay เก่าไม่ทำให้ข้อมูลฟื้นโดยไม่ตั้งใจ

### F05 — P1: Correction revision ไม่ได้แทน interval เก่าทั้งชุด

- จุดหลัก: `src/services/heartbeat.rs:223`, `src/repository/heartbeat.rs:242`, `src/services/activity_timeline.rs:255` และ `:319`
- raw รองรับ revision แต่ interval ใช้ `ReplacingMergeTree(created_at)` และ key `(user_id, segment_id)` ไม่มี heartbeat revision
- ถ้า revision ใหม่เอา segment เดิมออกหรือเปลี่ยน segment ID: segment เก่ายังอยู่ ถ้าแก้เป็นไม่มี segment: ไม่มี row ใหม่ไปแทนเลย
- reader เจอ heartbeat ID ใน projection แล้วข้าม measured intervals ของ canonical raw ทำให้ fallback ไม่แก้ stale projection กรณีนี้
- แก้: ผูก interval set กับ `(user_id, heartbeat_id, revision)` และอ่านเฉพาะ revision ที่ publish สมบูรณ์; ใช้ tombstone สำหรับ removed segments หรือ derive จาก canonical raw ระหว่าง migration
- Acceptance: revision ลดเวลา, ลบทุก segment, เปลี่ยน actor/project, เปลี่ยน segment ID และ projection write fail ต้องให้ผลตรง revision ล่าสุดทุก endpoint

### F06 — P1: Worker binaries ยังไม่ทำงานจริง; export/report/sync ไม่จบ flow

- จุดหลัก: `src/worker_runtime.rs:10`, `src/bin/*.rs`, `src/services/exports.rs:31`, `:110`, `src/services/reports.rs:19`, `src/services/integrations.rs:189`
- runtime ตรวจว่ามี env แล้วรอ Ctrl-C; ไม่มี queue consume, dispatch, ack, retry หรือ adapter injection ที่เรียกใช้งานจริง
- export สร้าง `queued` record แต่ไม่มี enqueue/processor; แม้มี completed record ตัว mapper ยังตอบ `download_url: None`, `checksum: None`
- report บันทึก schedule แต่ไม่มี scheduler/delivery ใน worker; integration เขียน outbox แต่ relay/sync ไม่ consume; account-deletion/billing-reconciliation มีเพียง lifecycle เช่นกัน
- แก้: เลือก durable queue ทางเดียวก่อน (เช่น PostgreSQL job claiming + outbox หรือ broker adapter จริง); implement claim/lease/retry/DLQ/idempotency/status แล้วต่อ export artifact/signed download, report delivery, provider sync, deletion แยกเป็นงาน
- readiness ต้องทดสอบ connection และ processor registration; ปรับ capabilities เป็น partial/unavailable ตามสิ่งที่ต่อจริง
- Acceptance: create → process → complete/fail/cancel; restart ระหว่างงานแล้ว resume; duplicate delivery ไม่สร้างผลซ้ำ; ไม่มี job ค้างเงียบ

### F07 — P1: Import เปิดให้อ่าน path บน server และทำงานหนักใน request

- จุดหลัก: `src/handlers/v1/wakatime_import.rs:19`, `src/services/wakatime_import.rs:25`, `:69`
- รับ `file_path` จากผู้ใช้และอ่านทั้งไฟล์; validation ตรวจเพียง exists/is_file ไม่มีพื้นที่ upload แยกตาม owner ไม่มี size bound ที่ไฟล์ และไม่มี write scope
- ผู้ใช้สามารถให้ API พยายามอ่านไฟล์ที่ process เข้าถึงได้; ไฟล์ JSON ที่ตรง schema อาจถูกนำเข้าเป็นข้อมูลตนเอง ไม่ได้สรุปว่า endpoint ส่งเนื้อหาไฟล์ทั่วไปกลับโดยตรง
- แก้: multipart upload หรือ owned object ID; จำกัดขนาด/จำนวน record; background import; validate และ normalize ผ่าน ingest pipeline เดียวกัน; เก็บ import ID/hash เพื่อกัน retry ซ้ำ
- Acceptance: arbitrary path ไม่อยู่ใน public contract; import ข้าม owner/เกินขนาดถูกปฏิเสธ; retry ได้ผลเดิม; partial failure resume ได้

### F08 — P1: Identity/key dual writes และ multi-step writes ไม่ atomic

- จุดหลัก: `src/services/user.rs:109`, `:141`, `:247`, `:285`, `:479`; `src/services/organizations.rs:57`; `src/services/integrations.rs:189`
- สมัครสมาชิกเช็ค username แล้ว insert ใน ClickHouse ซึ่ง unique key เป็น user_id สอง request ชื่อเดียวกันสามารถผ่าน check พร้อมกัน; PG sync error ถูก log แต่คืน JWT สำเร็จ
- rotate key เขียน ClickHouse ก่อนแล้ว swallow PG error; revoke ถ้า PG error จะคืนก่อน handler ล้าง local cache อาจยังใช้ key เดิมได้ แม้ CH ถูกเปลี่ยนแล้ว
- create organization กับ insert owner membership เป็นคนละ statement; sync status กับ insert outbox ก็แยกกัน ทำให้เกิด org ไม่มี owner หรือ status=syncing แต่ไม่มี event เมื่อคำสั่งหลังล้มเหลว
- แก้: PostgreSQL เป็น source of truth สำหรับ identity/credential ด้วย unique constraints และ transaction; project ไป ClickHouse ผ่าน outbox; รวม mutation+outbox และ org+owner ใน transaction/atomic SQL
- Acceptance: concurrent registration มีผู้ชนะเดียว; fault injection ทุก write boundary ไม่คืน success ที่ไม่ครบ; restart/retry ไม่คืนชีพ key เก่า

### F09 — P2: PostgreSQL connection ไม่ทนต่อ disconnect และ error มี URL เต็ม

- จุดหลัก: `src/infrastructure/postgres.rs:29`
- ใช้ single `Client` และ `NoTls`; เมื่อ connection task จบมีเพียง log ไม่มี reconnect/pool; endpoint PostgreSQL อาจเสียต่อเนื่องจน restart
- connection context format `{url}` ซึ่งอาจมี username/password และถูกส่งผ่าน startup error chain ไป log
- แก้: pool พร้อม timeout/reconnect/backoff; TLS ตาม deployment; redact DSN/credentials ใน errors; readiness แยกจาก liveness
- Acceptance: restart PostgreSQL แล้ว API recovery; TLS-required instance เชื่อมได้; connection error ไม่มี password

### F10 — P2: Reprocess และ migrations มีช่วงข้อมูลไม่พร้อม/ชนกันได้

- จุดหลัก: `src/services/reprocess.rs:151`, `:243`; `src/repository/heartbeat.rs:436`; `src/main.rs:64`
- reprocess ลบ legacy aggregates ก่อน replay และไม่มี lock ครอบงานตาม user/range; versioned projection มี publish step แต่ไม่ได้ทำให้ทุก legacy table atomic
- boot drop canonical view แล้ว create ใหม่; ถ้ามี API instance อื่นอ่านอยู่จะมีช่วง view หาย และการ boot พร้อมกันอาจชน migration
- แก้: single migration runner + migration version/lock; rebuild snapshot ใหม่แล้ว publish; per-user/range job lock และ checkpoint/retry
- Acceptance: failure หลัง delete/rebuild ไม่เผยผลว่างหรือบางส่วนเป็นข้อมูลสมบูรณ์; ingest/reprocess พร้อมกันให้ผล deterministic; rolling deploy ไม่ทำ query ล้ม

### F11 — P2: Credential encryption ของ integration เป็นเพียงข้ออ้างจาก payload

- จุดหลัก: `src/services/integrations.rs:95`
- `encrypted_credentials` ตรวจเพียง decode base64 และความยาว แล้วเก็บ bytes; ไม่มีการใช้ vault/KMS เพื่อสร้างหรือตรวจ envelope ใน flow นี้ Base64 ของ plaintext ก็ผ่านการตรวจดังกล่าว
- ไม่ได้สรุปว่า client ทุกตัวส่ง plaintext แต่ server ยังบังคับคุณสมบัติ encryption ตาม README ไม่ได้
- แก้: server รับ token ผ่าน TLS แล้ว encrypt ผ่าน vault หรือใช้ envelope ที่มี key ID/version และตรวจได้; เพิ่ม rotation/disconnect cleanup เมื่อ worker พร้อม
- Acceptance: stored bytes เป็น ciphertext ที่มี provenance; unauthorized decrypt ไม่ได้; logs/API ไม่คืน credential

### F12 — P2: Product readiness และ metadata ยังไม่สะท้อนผลจริง

- จุดหลัก: `src/handlers/v2.rs:375`, `:1380`; `docs/phase-10-feature-matrix.json`; `src/services/organizations.rs:387`; `src/services/leaderboards.rs:124`; `src/handlers/public.rs:64`
- capabilities โหลด status จาก JSON โดยไม่ปรับตาม worker/storage readiness; envelope กำหนด freshness=`realtime` ทุกครั้งและสร้าง request_id ที่ response แทนการ propagate trace
- organization analytics ปัจจุบันคืน member/seat/team counts; leaderboard service คืนสมาชิก; badge เป็นข้อความ ยังไม่ใช่ analytics chart/ranking สมบูรณ์
- แก้: แยก config/CRUD available กับ end-to-end available; เติม telemetry aggregation/ranking/public rendering ตามขอบเขต product; freshness/coverage มาจาก source watermark; request ID มาจาก middleware
- Acceptance: worker ปิดแล้ว capabilities แสดง unavailable/partial; UI ไม่สัญญาว่ารายงาน/export พร้อม; trace request ถึง job ได้

### F13 — P2: Limits และ graceful shutdown ยังมีช่องว่าง

- จุดหลัก: `src/main.rs:290` โดยประมาณ (server serve); `src/infrastructure/rate_limiter.rs`; `src/handlers/v1/heartbeats.rs:248`; `src/services/user.rs:120`
- auth rate limit ใช้ TCP peer ดังนั้นหลัง proxy ผู้ใช้หลายรายอาจแชร์ bucket; limiter อยู่ใน memory ต่อ replica
- bulk heartbeat ไม่มี explicit record-count/per-account ingest limit แม้ JSON extractor มี default body bound; project resolution ทำแบบ sequential ต่อ heartbeat
- Argon2 hash/verify ทำ synchronous ใน async request task; ยังไม่มี HTTP graceful shutdown/drain ใน main
- แก้: trusted-proxy policy ที่ไม่เชื่อ header จากทุกแหล่ง, shared limiter, batch/count/concurrency limits, cache project resolution ต่อ batch, spawn_blocking สำหรับ password KDF, shutdown signal และ drain
- Acceptance: load test ผ่าน proxy ไม่ throttle ผู้ใช้ทั้งระบบพร้อมกัน; expensive calls ไม่ทำให้ health/ingest starvation; SIGTERM ไม่ตัด accepted writes

## แผนแบ่งงานที่นำไปทำต่อได้

| ลำดับ | ชุดงาน | สิ่งที่แก้ | เกณฑ์ก่อนรวม |
|---|---|---|---|
| 1 | Authorization contract | F01 และปิด path import ตาม F07 | table-driven endpoint tests สำหรับ session/API key/OAuth ทุก scope และ cross-user |
| 2 | Credential lifecycle | F02/F03 และ credential transaction จาก F08 | A/B replica revoke/rotation/expiry; ไม่มี plaintext; restart แล้วสิทธิ์ไม่ย้อนกลับ |
| 3 | Canonical data lifecycle | F04/F05 | ingest/correct/delete/retry/failure tests กับ ClickHouse จริง; ทุก time surface ตรงกัน |
| 4 | Transactional state | identity/org/outbox จาก F08 และ F09 | unique concurrency, rollback/fault injection, database reconnect |
| 5 | Job foundation + export เส้นแรก | F06 | งาน export จริงจบได้พร้อม checksum/download/expiry/cancel/retry ก่อนขยาย worker อื่น |
| 6 | Integration/report/deletion | F06/F07/F11 | provider sandbox sync, scheduled report, import resume และ cross-store deletion verification |
| 7 | Rebuild/deployment robustness | F10/F13 | simultaneous rebuild/ingest, rolling deploy, load test, graceful shutdown |
| 8 | Product truthfulness + completeness | F12 | capability contract ตรง runtime; org analytics/ranking/share แสดงข้อมูลจริงตามสิทธิ์ |

งานปรับ status/capabilities ของ feature ที่ยังไม่ครบควรทำตั้งแต่ชุดแรก ไม่ต้องรอ implementation ครบ ส่วน estimates ควรกำหนดหลังเลือก queue/object-store/vault และตกลงว่าจะเก็บ API key แบบอ่านกลับได้หรือแสดงครั้งเดียว

## Verification และข้อจำกัด

- `cargo test --manifest-path backend/api/Cargo.toml -p wakaclock-server --offline`: **198 passed, 0 failed, 7 ignored**; worker binaries มี 0 tests
- `cargo test --manifest-path backend/api/Cargo.toml --workspace --offline -q`: **550 passed, 0 failed, 7 ignored** ในรอบสุดท้าย ครอบคลุม AST/CLI/broker/core/LS/server; รอบแรกใน sandbox มี broker tests 6 รายการเปิด local socket ไม่ได้ (`Operation not permitted`) จึงรันซ้ำนอก sandbox และผ่านครบ
- 7 ignored ต้องใช้ isolated PostgreSQL/ClickHouse ไม่ได้เปิดรันกับฐานข้อมูลที่อาจมีข้อมูลผู้ใช้
- CI มี job เตรียม PostgreSQL/ClickHouse แล้วรัน ignored tests อยู่แล้ว (`.github/workflows/ci.yml:174` เป็นต้นไป) แต่การตรวจนี้ไม่ได้ยืนยันผลล่าสุดบน CI
- จุดแข็งที่พบ: canonical timeline shared หลาย endpoint, attribution policy ไม่ยกระดับ unknown ตาม boolean อย่างเดียว, tenant role/entitlement service, parameterized SQL ในเส้นทางสำคัญที่อ่าน, presence v2 ticket/lease/reconciler, raw fallback เมื่อ interval query ล้มเหลว
- ต้องเพิ่ม lifecycle/failure/concurrency tests ไม่ใช่เพิ่มเฉพาะ schema-string/route-existence assertions
- ไม่ได้รัน production E2E, load test, provider sync, SSO IdP หรือ DB fault injection; ข้อเสนอด้าน latency/capacity เป็นความเสี่ยงจากโครงสร้างโค้ด ไม่ใช่ค่าที่วัดแล้ว

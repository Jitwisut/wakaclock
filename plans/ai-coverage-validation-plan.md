# AI coverage — Test matrix, metrics และ live certification

วันที่: 2026-09-05 · สถานะ: แผนทดสอบและเป้าหมายที่เสนอ ยังไม่ใช่ผลการทดสอบ

ใช้คู่กับ [execution plan](ai-coverage-execution-plan.md) และ [task ledger](ai-coverage-task-ledger.md) Gate นี้ใช้กับขอบเขตที่ประกาศรองรับจริง ไม่ถือ unsupported mode เป็น pass และไม่อ้าง 100% coverage ของกิจกรรมที่ระบบมองไม่เห็น

## 1. ระดับของหลักฐาน

| ระดับ | ทำอะไร | พิสูจน์อะไรได้ | พิสูจน์อะไรไม่ได้ |
| --- | --- | --- | --- |
| Unit | pure functions + sanitized fixtures | parse/normalize/decision invariants | runtime ส่ง payload รูปแบบนี้จริง |
| Contract | serialize/deserialize client↔broker↔API↔UI | shape/null/version/compatibility | configuration ในเครื่องผู้ใช้ทำงาน |
| Subprocess integration | real CLI/hooks/SQLite กับ input ที่ควบคุม | wiring, persistence, retry, dedup | native AI hook ถูกเรียกจาก AI จริง |
| Database integration | isolated real ClickHouse/Postgres | migrations, query/rollup/revision semantics | production deployment ใช้ binary เดียวกัน |
| Live E2E | real agent/version/runtime แก้ synthetic project | ตั้งแต่ source ถึง dashboard ใน tuple นั้น | runtime/OS/mode อื่นหรือ version ถัดไป |
| Shipped-artifact smoke | ติดตั้ง CLI/VSIX/package ที่จะ release | bundle/resource/platform delivery จริง | ความแม่นยำ universal นอก tested corpus |

Fixture ที่ได้จากการเดาเอกสารต้องติดป้าย synthetic/unverified แม้ subprocess suite ผ่าน ห้ามเปลี่ยนเป็น captured fixture โดยแก้ชื่อไฟล์

## 2. Test environments และ ground truth

- ใช้ disposable project และ synthetic code ที่กำหนดโดย test harness; ไม่เปิด production workspace ให้ agent แก้เพื่อทดสอบ
- แยก test home/config/database/API account และ port จากของผู้ใช้; การตั้ง env ต้องไม่ repurpose HOME/CODEX_HOME ใน session หลัก ใช้ subprocess sandbox ที่เครื่องมือรองรับและ task-specific paths
- บันทึก installed tool/producer/CLI/broker/extension versions, OS/arch/runtime, build digest และ schema versions จริง
- Ground truth ระบุ actor, tool operation, file/workspace identity, expected successful mutations, exact deltas เมื่อรู้ และ observed activity intervals
- เก็บ source/payload จริงเฉพาะชั่วคราวใน test environment ที่ได้รับอนุญาต; published fixtures ต้องแทนเนื้อหา/path ด้วย synthetic values และคง structural edge case
- Ledger ต้องแยก attempted operation, successful file mutation, read/no-op, failed partial mutation และ diagnostics observation
- ตัวชี้วัดใช้ ground-truth operation/file mutation IDs ไม่ใช่ heartbeat count; หนึ่ง call แก้ 100 ไฟล์มี 100 file mutations และ 1 operation
- Recorded cases จากผู้ใช้จริงต้อง sanitize ก่อนเข้าคลัง และไม่เก็บ prompt/source/diff ใน broker/telemetry เพื่อ debug

## 3. Matrix: File mutations และ tool lifecycle

Expected ในตารางใช้ “AI” เฉพาะเมื่อ producer มี direct proof และ route/schema ถูกต้องตาม policy

| ID | Scenario | Expected result |
| --- | --- | --- |
| V-M01 | สร้างไฟล์ใหม่ มี/ไม่มี trailing newline | หนึ่ง canonical create; exact added lines ตาม convention ที่ระบุ |
| V-M02 | แก้หนึ่ง hunk/หลาย hunk | delta จาก operation จริง ไม่ใช่ net diff ทั้ง workspace |
| V-M03 | overwrite ไฟล์เดิมที่มีหลายบรรทัด | ไม่ใช้ added-only match เอา ownership ของ human deletion |
| V-M04 | ลบไฟล์ | หนึ่ง delete; unknown removed lines เป็น null หากพิสูจน์ไม่ได้ |
| V-M05 | rename อย่างเดียว | หนึ่ง rename และ zero line changes เมื่อพิสูจน์ว่า pure rename |
| V-M06 | rename + edit | identity transition และ content delta ถูกต้อง |
| V-M07 | หลายไฟล์จาก call เดียว | distinct file events/shared operation; เวลาไม่คูณจำนวนไฟล์ |
| V-M08 | ไฟล์เดียวถูกแก้หลายครั้งใน call/session เดียว | sequence ไม่ชน; ไม่ collapse legitimate operations |
| V-M09 | ไฟล์ dirty ก่อน AI | ไม่เอา human diff เดิมเป็น AI; count ที่แยกไม่ได้ null |
| V-M10 | ไฟล์ไม่ได้เปิดใน editor/ปิด editor ทั้งหมด | native/transcript still delivered |
| V-M11 | non-Git repo | attribution ใช้ direct event ได้; Git absence ไม่ทำให้เดาชื่อ |
| V-M12 | binary/large/notebook file | metadata operation ได้ตาม capability; line counts N/A/null; notebook convention ระบุชัด |
| V-M13 | CRLF/LF, Unicode, empty file | line-count convention consistent ไม่เอา chars/bytes เป็น lines |
| V-M14 | symlink/case-sensitive path/path traversal | canonical workspace boundary ถูก; escape ไม่ถูกนับเป็น trusted workspace edit |
| V-M15 | read/search/list tool | ไม่มี edit event และไม่มี invented edit duration |
| V-M16 | failed/rejected/cancelled/no-op tool | ไม่มี successful mutation ถ้าไม่มี per-file success proof |
| V-M17 | partial writes ก่อน error | เก็บ explicit successful file results เท่านั้น; unknown residual อยู่ diagnostics |
| V-M18 | shell/heredoc/script/sed/codemod/git apply | named attribution เฉพาะ explicit proof; whole-workspace timing diff ไม่พอ |
| V-M19 | MCP file edit สำเร็จและล้มเหลว | bridge emits ตาม actual result; model narration ไม่ trigger |
| V-M20 | nested tools/code execution wrapper | outer/inner calls ไม่ double count; child/session identity ไม่หาย |

## 4. Matrix: Human, unknown และ concurrency

| ID | Scenario | Expected result |
| --- | --- | --- |
| V-C01 | คนพิมพ์เมื่อไม่มี AI ใช้งาน | human เฉพาะหลักฐาน input ที่รองรับ; unsupported proof = unknown ไม่เดา |
| V-C02 | เปิด AI process ทิ้งไว้แล้วคนแก้ | ไม่มี named AI จาก process presence |
| V-C03 | unsupported AI แก้ผ่าน document API | ไม่ fallback human เพราะ sidecar ว่าง; unknown origin |
| V-C04 | AI event มาหลัง editor event แต่ใน grace | reconcile หนึ่ง ownership; measured activity ไม่หาย |
| V-C05 | AI event มาหลัง grace/backend ingest | revision เปลี่ยน attribution ไม่เพิ่ม canonical counts/time |
| V-C06 | late event ไม่มี exact identity | ไม่แก้ historical row จาก time/delta coincidence |
| V-C07 | คนกับ AI แก้ไฟล์เดียวในเวลาใกล้กัน | ไม่เหมาทั้งไฟล์; ambiguous portions เป็น unknown |
| V-C08 | คนกับ AI เพิ่มจำนวนบรรทัดเท่ากัน | line-count equality ไม่ใช่ ownership proof |
| V-C09 | AI สองตัวแก้ไฟล์เดียว/คนละไฟล์ | session/operation identities แยกถูก ไม่เลือกชื่อจาก event ล่าสุด |
| V-C10 | formatter/save/refactor command | ไม่เรียก AI อัตโนมัติ; reason automation/unknown ตามหลักฐาน |
| V-C11 | paste ภายในไฟล์/ใน workspace/ภายนอก | paste counters ถูก; ไม่มี AI provider/model ที่เดาจาก clipboard |
| V-C12 | undo/redo ของ human/AI/mixed edit | ไม่สร้าง new authorship/line production ซ้ำ; คง input activity ที่วัดได้ |
| V-C13 | IME, multi-cursor, snippet, autocomplete ทั่วไป | ไม่ตี multi-character insert ว่า AI โดยปริยาย |
| V-C14 | AI suggestion ถูก reject/partial accept | reject ไม่มี edit; partial accept นับเฉพาะ applied portion ถ้ามี proof |
| V-C15 | คนตรวจ/อ่านโค้ดระหว่าง agent ทำงาน | review/human activity กับ agent work ไม่ถูกคูณเป็น total wall time |
| V-C16 | sidecar entry นอกช่วง/whole-file overwrite คล้ายกัน | ไม่ claim unrelated edit; consumed IDs ไม่กัน legitimate operation ใหม่ |

## 5. Matrix: Delivery, state และ protocols

| ID | Scenario | Expected result |
| --- | --- | --- |
| V-R01 | hook/transcript/editor เห็น operation เดียว | canonical edit/duration หนึ่งครั้งเมื่อ proof เชื่อมได้ |
| V-R02 | retry exact payload 2/10/100 ครั้ง | result unchanged; transport attempts แยก diagnostics |
| V-R03 | same event ID แต่ payload ขัดกัน | explicit conflict ไม่ overwrite เงียบหรือ merge ต่าง mutation |
| V-R04 | out-of-order tool start/end/output/transcript chunks | รอ completion; ไม่ emit ก่อน proof |
| V-R05 | crash หลัง inbox commit ก่อน sidecar/queue | restart ส่งต่อครบ ไม่มี lost accepted events |
| V-R06 | crash หลัง backend accepts ก่อน local ack | retry ไม่เพิ่ม canonical row/aggregate |
| V-R07 | cursor update, rotation/truncation/partial JSONL | ไม่ข้าม incomplete record; resume/re-discovery ไม่ replay ซ้ำ |
| V-R08 | offline / DNS / timeout / 429 / 5xx | bounded retry/backoff; queue durable; API key ไม่หลุด error logs |
| V-R09 | 401/403 | actionable auth state; ไม่ discard queued data เป็น success |
| V-R10 | disk full / read-only / queue locked | fail-open ต่อ agent; explicit unavailable/backpressure; ไม่รายงาน accepted ถ้าไม่ durable |
| V-R11 | malformed/oversize/unknown schema event | reject/quarantine sanitized metadata; no raw payload retention |
| V-R12 | PID reused / stale socket / two brokers | singleton/lease probe ไม่ healthy ผิด; no split-brain double delivery |
| V-R13 | old producer/new broker และ new producer/old broker | compatible decode หรือ explicit downgrade/unsupported; no silent loss |
| V-R14 | old client/new API และ new client/old API | negotiate schema; API reads ไม่ crash จาก field/enum ใหม่ |
| V-R15 | retention expiry/replay เกิน dedup window | behavior documented; ไม่อ้าง dedup forever ถ้า ID ถูก prune |
| V-R16 | 100 files/1 call + retry + late correction | line/event totals stable; operation time ไม่คูณ 100 |

## 6. Matrix: Health, setup และ certification

| ID | Scenario | Expected result |
| --- | --- | --- |
| V-H01 | broker running/stopped/probe denied | true/false/unavailable แตกต่างกัน |
| V-H02 | agent idle vs parser stalled with fresh records | idle ไม่เตือน broken; stalled มี lag/cursor evidence |
| V-H03 | queue empty vs queue unreadable | measured 0 ต่าง null/unavailable |
| V-H04 | เปิด observer/diagnostics แล้วปิด | production attribution/time output เหมือนเดิม |
| V-H05 | native tracking consent on แต่ observer off | hook ทำงานและ health ไม่รายงาน disabled ผิด |
| V-H06 | devices สองเครื่องส่ง report user เดียวกัน | แสดงแยก; ไม่เขียนทับ report เครื่องอื่น |
| V-H07 | API restart/two replicas/no durable store | durable mode คงข้อมูล; fallback แสดง ephemeral/unavailable |
| V-H08 | clock skew/future captured_at/report replay | receipt ordering/sequence ป้องกัน report ล็อกสถานะตลอดไป |
| V-H09 | install/setup ซ้ำ + CLI/extension ทำพร้อมกัน | managed hooks ไม่ซ้ำ; result ต่อ adapter ถูก |
| V-H10 | custom hooks/corrupt config/space paths | preserve config, parse failure ไม่ overwrite, command quoting ถูก |
| V-H11 | update VSIX/CLI แล้วลบ bundle เก่า | active hooks ยังชี้ stable existing resources |
| V-H12 | uninstall หนึ่ง adapter/all/ทำซ้ำ | ลบเฉพาะ managed ownership; history/user config คงอยู่ |
| V-H13 | client ส่ง Verified เอง | server ไม่เชื่อโดยไม่มี matching catalog |
| V-H14 | real reviewed matching certificate | server promote effective capability ได้จริง |
| V-H15 | cert version/runtime/OS/edit-mode mismatch | ไม่ยืมผล tuple อื่น |
| V-H16 | expired/revoked cert + running adapter | maturity ลดตาม catalog แต่ไม่ rewrite historical event proof แบบเหมารวม |
| V-H17 | registry declaration ไม่มี factory/resource | status ไม่อ้าง installed/working |
| V-H18 | expired tool login ใน live test | blocked/auth_failed ไม่ใช่ verified หรือ success |

## 7. Matrix: API, analytics, privacy และ remote

| ID | Scenario | Expected result |
| --- | --- | --- |
| V-A01 | human/AI-known/AI-unnamed/unknown-origin fixture | AI total ไม่รวม unknown origin; named ranking ไม่รวมชื่อเดา |
| V-A02 | revision/query/rebuild ซ้ำ | canonical totals เท่ากัน ไม่มี sum old+new revisions |
| V-A03 | activity intervals ซ้อน, midnight, timezone/DST | canonical wall-time partition ถูก; no raw-gap recompute |
| V-A04 | agent vendor ต่าง model provider, model missing | breakdown แยกถูก; missing ไม่เป็น guessed default |
| V-A05 | coverage ไม่มี denominator/line count unknown | N/A/null ตาม contract ไม่โชว์ 0%/100% ปลอม |
| V-A06 | user switch/cross-tenant device/report IDs | auth scope และ query cache ไม่รั่วข้อมูล |
| V-A07 | prompt/source/diff/raw error อยู่ใน input | sanitized reject/report; ไม่ persist/transmit content |
| V-A08 | UI error/empty/unavailable/idle/degraded | ความหมายและ next action ต่างกัน; keyboard/reader ใช้งานได้ |
| V-A09 | SSH/local collector เห็นงานเดียวกัน | identity mapping/dedup ไม่รวมต่าง workspace หรือเพิ่มซ้ำ |
| V-A10 | WSL/dev container mounts/teardown/restart | mapping/queue survive ตาม supported topology |
| V-A11 | cloud job commit metadata แต่ไม่มี edit events | ไม่ certify file attribution จาก bot author |
| V-A12 | same repo names/two worktrees/symlink roots | stable workspace/worktree identity ไม่ชน |
| V-A13 | forged source/producer label บน ingress | schema string อย่างเดียวไม่ผ่าน trusted producer binding |
| V-A14 | account/device removed, retention cleanup | report/credentials lifecycle ถูก; replay ไม่คืนข้อมูลที่ลบโดยไม่ตั้งใจ |
| V-A15 | WakaTime-compatible legacy heartbeat ที่ไม่มี agent provenance | preserve compatible activity; ไม่สร้าง named AI/model หรือถือ legacy line counts เป็น first-party proof |

## 8. ตัวชี้วัดและเป้าหมายเริ่มต้น

เป้าหมายนี้เสนอสำหรับ F0 ล็อกก่อน rollout หาก benchmark ชี้ว่าทำไม่ได้ต้องปรับพร้อมเหตุผลก่อน release ไม่แก้ threshold หลังเห็นผลเพื่อให้ผ่าน

### 8.1 ความแม่นยำ

- **Named precision** = จำนวน canonical mutations ที่ตั้งชื่อ AI ถูก / canonical mutations ทั้งหมดที่ระบบตั้งชื่อ AI ใน ground-truth corpus
- **Supported edit recall** = successful AI file mutations ใน supported tuple ที่ตรวจพบและจำแนกถูก / successful AI file mutations จริงของ tuple นั้น
- **Exact line coverage** = observed canonical mutations ที่มี exact line deltas / canonical mutations ที่เกี่ยวข้องและนับได้ใน corpus; ไม่ใช้ sum lines เป็นตัวแทน event coverage
- **Unknown share** = observed eligible mutations ที่ไม่ทราบ authorship / observed eligible mutations ทั้งหมด พร้อม declared eligibility definition
- แยก wrong-agent, AI-as-human, human-as-AI, duplicate และ missed-edit counts; ไม่รายงาน accuracy รวมที่ซ่อน negative cases
- Recall ของ AI ที่ไม่มี source/ground truth วัดไม่ได้ ให้รายงาน unsupported/unobserved ไม่ใช้ 0 หรือ 100%

Gate เริ่มต้น: deterministic positive/negative suite ต้องผ่านทั้งหมด; zero known false named attribution และ zero known duplicate canonical duration; empirical supported recall ≥99% และ named precision ≥99.5% ใน live corpus ที่ระบุชัด

ก่อนอ้างเปอร์เซ็นต์ต่อ tuple เสนออย่างน้อย 1,000 successful file mutations จากหลาย independent calls/sessions และ 500 negative/ambiguous scenarios ที่เกี่ยวข้อง; ต้องรายงาน sample size, mode mix และ uncertainty ไม่ถือ 1,000 ไฟล์จาก call เดียวเป็น independent samples และไม่ขยายผลเป็นความแม่นยำทั่วโลก

หาก sample ยังไม่พอแต่ live smoke ผ่าน แสดง live-tested/limited pilot และจำนวน cases จริง ห้ามตีตรา numeric SLA ที่ยังพิสูจน์ไม่ได้

### 8.2 Delivery latency

วัด timestamp boundaries แยกกัน ไม่ใช้ cross-machine clock ล้วนโดยไม่ชดเชย skew:

| ระยะ | เป้าหมาย p95 ที่เสนอสำหรับเครื่อง benchmark และ healthy network |
| --- | --- |
| native completion → durable local event | ≤5 วินาที |
| completed transcript record → durable local event | ≤15 วินาที |
| durable local event → backend canonical visible | ≤60 วินาที |
| backend visible → dashboard refreshed | ≤30 วินาที |
| offline recovery หลัง network กลับ | queue drain ไม่สูญหาย; วัดตามขนาด backlog ไม่ใช้ fixed SLA ที่ไม่ระบุจำนวน |

Latency ที่เร็วไม่ได้เป็นหลักฐาน attribution ที่ถูก และ grace window ไม่ถูกนำไปเพิ่ม coding time

### 8.3 Performance และ resource bounds

กำหนด reference hardware/OS และ workload ก่อนวัด; เสนอ broker idle CPU เฉลี่ย ≤1% ของหนึ่ง logical core, steady RSS ≤200 MiB ในชุดมาตรฐาน และ incremental scan p95 ≤1 วินาทีบน corpus ที่กำหนด

Workloads: 10k และ 100k tracked files; transcripts รวม 100 MiB และ 1 GiB; steady 1–10 events/s; burst 500 file mutations; เปิด editor 10/100 documents; ทดสอบ no-op shell tool หลายครั้งโดยไม่ full-hash ทั้ง repo ทุก call

Queue/dedup มี bounds เดิมใน core broker: event 64 KiB, batch 500 events/2 MiB, payload retention 7 วัน และ ID retention 30 วัน ให้ตรวจ constants อีกครั้งก่อน implement ไม่ลด retention เงียบ ๆ จน retry ซ้ำได้ เสนอ pending reconciliation TTL 24 ชั่วโมง; disk quota/backpressure ต้องกำหนดตาม queue size จริงใน F0

Performance gate ต้องไม่แลกกับการทำ full source upload, blocking agent tool call หรือ silent event drop

## 9. ขั้นตอน live certification ต่อ tuple

1. ตรวจ F1–F4 relevant gates ผ่าน และเตรียม test account/runtime/login ที่อนุญาต
2. ติดตั้ง shipped candidate bundle ใน isolated environment; บันทึก build/tool versions จริง
3. ตั้งค่า integration ผ่านเส้นทางที่จะให้ผู้ใช้ใช้จริง ไม่แทรก event ด้วยมือแทน native run
4. เก็บ baseline queues/cursors/canonical totals แล้วให้ agent ทำ scenarios ใน synthetic repo
5. ตรวจ native/completed record → broker inbox → sidecar → outbound ack → backend canonical rows → dashboard presentation
6. Run retry/offline/multifile/no-op/failure/concurrent-human subset สำหรับ tuple นั้น
7. Repeat after broker/editor restart และหลัง simulated upgrade ตาม supported platform
8. Compare กับ ground truth โดย case ID; fail/skip/block ต้องเก็บทุกแถว ไม่ทิ้งเพื่อให้ report ผ่าน
9. Sanitize artifact, validate schema/privacy และแนบ reviewer/evidence references ที่ตรวจได้
10. ใส่ reviewed catalog; ตรวจ server promotion จริงและ forged/mismatched catalog rejection
11. Publish support matrix เฉพาะ modes/platforms ที่ผ่าน; เก็บ known limitations และ renewal trigger

## 10. Artifact schema ที่เสนอ

```json
{
  "schema_version": 1,
  "artifact_kind": "adapter_coverage_certification",
  "certificate_id": "example-pending",
  "adapter_id": "example-agent",
  "tool_version": null,
  "producer_version": null,
  "runtime": "cli",
  "platform": { "os": null, "arch": null },
  "edit_modes": [],
  "payload_schema_versions": [],
  "tested_commit_sha": null,
  "tested_build_digest": null,
  "corpus_version": null,
  "started_at": null,
  "completed_at": null,
  "evidence": {
    "native_run": "not_run",
    "broker": "not_run",
    "backend": "not_run",
    "dashboard": "not_run",
    "retry_dedup": "not_run",
    "multi_file": "not_run"
  },
  "scenario_results": [],
  "metrics": null,
  "limitations": [],
  "review_status": "pending",
  "status": "unverified"
}
```

เป็นตัวอย่างที่ตั้งใจให้ไม่ผ่าน Verified gate: required runtime/version/results ยังไม่มี Validator ต้อง reject การ promote artifact แบบนี้ ห้ามคัดลอกแล้วเปลี่ยน status อย่างเดียว

Artifact schema ต้องรองรับ failure/blocker, sample counts, elapsed latency, exact-mode scope, revoked/expiry และ digest ของ sanitized evidence; ไม่บรรจุ source paths/account identifiers/credentials/prompt text

`scripts/duration-audit/certify_live.py` และ `verify_certification.py` ที่มีอยู่รับรองเรื่อง duration ตาม schema ของมัน ไม่ใช้แทน adapter coverage certificate โดยเปลี่ยน label

## 11. คำสั่งตรวจที่มีอยู่แล้ว

คำสั่งต่อไปนี้เป็น runbook สำหรับ implementation ไม่ได้รันทั้งหมดระหว่างจัดทำแผน ให้ตรวจ `.context/commands.md`, package scripts และ CI อีกครั้งก่อนใช้กับ commit ใหม่

Rust: working directory `backend/api`

```bash
cargo fmt --all -- --check
cargo test -p wakaclock-core
cargo test -p wakaclock-cli
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo build --workspace --release
```

VS Code: working directory `extensions/vscode`

```bash
npm run compile
npm run lint
npm test
npm run build:resources
```

Frontend: working directory `frontend/app`

```bash
npm run typecheck
npm run lint:strict
npm run test:run
npm run test:coverage
npm run build
npm run test:e2e
```

Subprocess attribution integration: working directory repository root

```bash
python3 scripts/ai-attribution-integration.py
```

ก่อนใช้ integration script ตรวจ expectations ที่ยังอ้าง inferred/legacy policy แล้วปรับให้ตรง ADR ใหม่โดยไม่ลบ negative assertions เพื่อให้ test ผ่าน Script นี้ใช้ synthetic inputs บางส่วนจึงไม่ใช่ live certification ของ Cursor/agent อื่น

Database tests ใช้ isolated ClickHouse/Postgres ที่กำหนดจาก existing test harness; ไม่ชี้ ignored migration tests ไป production และไม่ hardcode env assumptions จากเอกสารเก่าถ้าตัว harness เปลี่ยนแล้ว

สำหรับงานย่อยรัน targeted regressions และ required checks ที่เกี่ยวข้องก่อน; full release/merge gates ต้องผ่านตาม ROADMAP และ repo hooks หลัง code freeze ไม่รัน suite เดิมซ้ำโดยไม่มี change/failure/new concern

## 12. Release acceptance checklist

- [ ] Decision/unknown semantics และ schema mappings ตรงกัน client/server/UI
- [ ] Deterministic matrix ที่เกี่ยวข้องผ่าน; skipped cases เปิดเผยพร้อม scope
- [ ] New adapters ผ่าน real E2E และ shipped-artifact smoke ตาม tuple
- [ ] Numeric claims มี ground truth/sample size/uncertainty; ไม่มี fabricated metrics
- [ ] Migrations idempotent/additive และ old/new combinations ผ่าน
- [ ] Late correction/replay ไม่เพิ่ม canonical totals หรือ duration
- [ ] Diagnostics collector ใช้ measurements จริงและไม่เปลี่ยน attribution
- [ ] Multi-device/state persistence ตรง deployment mode ที่โฆษณา
- [ ] Setup/update/uninstall รักษา user config และ stable hook paths
- [ ] Certificate catalog promote/revoke/mismatch ทำงานจริง
- [ ] Auth/privacy/resource/performance tests ผ่าน relevant gates
- [ ] Rollback + queue recovery rehearsal ผ่านโดยไม่เปิด inference
- [ ] Support docs/marketing จำกัดตาม verified tuples
- [ ] Blockers/limitations/owners บันทึกครบ; no pending mandatory work ก่อน mark milestone complete

## 13. Failure triage runbook

| อาการ | ตรวจจุดแรก | การแก้/ผลที่คาด |
| --- | --- | --- |
| AI แก้แต่ไม่มี event | tool/runtime mode, hook installed, transcript schema/cursor | แก้ producer/discovery; อย่าเดาจาก filesystem |
| event local มีแต่ backend ไม่มี | outbound queue, auth, last delivery, retry code | recover transport โดย stable IDs |
| backend มีแต่ UI ไม่ขึ้น | range/timezone, query cache, canonical projection, cert scope | fix read/presentation ไม่ emit duplicate event |
| AI ถูกจัดเป็น human | pending editor proof, legacy client, delayed sidecar | ตรวจ F1 path; unknown/correction ตาม exact evidence |
| ชื่อ AI ผิด | producer binding, cross-source aliases, shared workspace/version | disable tuple, preserve evidence, revoke หากจำเป็น |
| เวลา/lines ซ้ำ | shared operation ID, revisions, materialized view sums | canonical repair แบบ scoped + replay regression |
| doctor บอกไม่ทำงานแต่ event ถึง | collector aliases, probe unavailable, observer consent coupling | รวม runtime measurement และแก้ health projection |
| Verified ไม่ขึ้น | tuple/catalog mismatch, expiry/revocation, missing artifact | ไม่ bypass gate; เติม real evidence หรือแก้ resolver |
| remote activity หาย | collector ติดตั้งผิด host/container, mapping, teardown queue | install/repair ฝั่ง runtime จริงและ certify topology |

ทุก incident เก็บ sanitized reason/IDs/counts ที่พอตรวจ ไม่ขยาย logs เป็น prompt/source/diff dump

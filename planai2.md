# WakaClock Universal AI Detection — Execution Plan 2

## เป้าหมาย

ทำให้ WakaClock เป็นตัวกลางรับและเชื่อมโยงหลักฐานการแก้โค้ดจาก AI หลายประเภท
โดยไม่ผูกกับ editor หรือ provider รายเดียว พร้อมแยก Human, AI และ activity ที่ยัง
พิสูจน์ไม่ได้อย่างตรงไปตรงมา

แผนนี้เป็นแผนต่อยอดจาก `planai.md` และงานที่ปิดไปแล้วใน
`code-calm-crown.md` ไม่ใช่การสร้าง Broker หรือ attribution model ชุดใหม่ซ้ำกับของเดิม

เป้าหมายหลัก:

- ตรวจจับ Claude, Codex, Gemini, Cursor, Antigravity, Copilot, Windsurf, Cline,
  Roo, OpenCode, MCP และ agent ใหม่ในอนาคต
- ใช้ direct evidence ก่อน inference เสมอ
- ไม่ตีความว่า `ไม่มี AI evidence = Human`
- ป้องกัน duplicate จาก hook, transcript, editor และ filesystem
- เก็บ event ในเครื่องได้แม้ backend, network หรือ entitlement มีปัญหา
- ไม่เก็บ prompt, response, source code หรือ command arguments
- รักษา duration semantics และ `total_seconds` เดิม

---

## ข้อจำกัดพื้นฐาน

ไม่มีระบบใดระบุผู้เขียนได้แน่นอน 100% เมื่อเครื่องมือนั้นไม่มี hook, transcript,
MCP event หรือหลักฐาน session ที่เชื่อถือได้ File change เพียงอย่างเดียวบอกได้แค่ว่า
ไฟล์เปลี่ยน ไม่สามารถบอกว่า AI, formatter, Git, build tool หรือมนุษย์เป็นผู้เปลี่ยน

ระบบจึงต้องใช้ attribution อย่างน้อยสี่สถานะ:

| Actor type | ความหมาย |
|---|---|
| `human` | มี positive editor/user-input evidence และไม่มี AI evidence แข่งขัน |
| `ai_verified` | มี native hook, MCP event หรือ completed structured tool event ยืนยัน |
| `ai_inferred` | หลักฐานหลายแหล่งสัมพันธ์กัน แต่ไม่มี direct proof |
| `unknown` | ตรวจพบ activity แต่หลักฐานไม่พอตัดสิน หรือมี evidence ขัดกัน |

หลักสำคัญ:

```text
RAW_FILE_CHANGE_WITHOUT_PROVENANCE != HUMAN
PROCESS_RUNNING != AI_FILE_EDIT
CONFLICTING_EVIDENCE != HUMAN
```

---

## สถานะระบบปัจจุบัน

### มีอยู่แล้ว

- Local Broker และ SQLite inbox ใน
  `backend/api/crates/wakaclock-core/src/broker.rs`
- Canonical broker event envelope และ actor resolver
- Native hook/transcript adapters สำหรับ Claude, Codex และ Gemini บางส่วน
- Generic `wakaclock ai emit`, `ai tool-before` และ `ai tool-after`
- Before/After Git/content fingerprint engine ใน
  `backend/api/crates/wakaclock-cli/src/tool_snapshot.rs`
- Editor-side sidecar correlation ใน VS Code
- Core correlation rules ใน
  `backend/api/crates/wakaclock-core/src/ai/correlation.rs`
- Local delivered-event/fingerprint dedup ใน
  `backend/api/crates/wakaclock-core/src/ai/state.rs`
- Backend cross-transport fingerprint dedup ใน
  `backend/api/src/services/heartbeat.rs`
- Offline outbound queue, retry และ broker dead-letter handling
- Attribution integration matrix และ external-process test harness

### ยังไม่ครบ

- Runtime บนเครื่องผู้ใช้ยังสามารถใช้ CLI, service และ hook คนละ version/path กัน
- Broker/transcript scanner ยังไม่มี health contract และ self-repair ที่ชัดเจน
- Native adapter installation ยังผูกกับ agent-specific imperative code
- Codex Desktop/CLI integration ยังต้องย้ายไป native plugin packaging รุ่นปัจจุบัน
- Cursor เป็น scaffold จาก documented payload เท่านั้น ยังไม่ verified กับ payload จริง
- Antigravity และ agent อีกหลายตัวยังไม่มี adapter
- ไม่มี workspace registry/lease กลางสำหรับ observer
- ไม่มี continuous workspace filesystem observer
- Process/session evidence ยังไม่ถูก normalize เข้าสู่ correlation engine
- Correlation/dedup ที่มีอยู่ยังไม่ได้รวม evidence จาก observer ทุกประเภทก่อนสร้าง
  canonical heartbeat
- UI ยังแยก detection failure, local acceptance และ backend delivery ไม่ชัดพอ

### Audit snapshot ที่ทำให้ Codex ตรวจจับไม่ทัน

จากการตรวจเครื่อง development เมื่อ 2026-08-31 พบว่า:

- `wakaclock` ใน `PATH` เป็น binary เก่าที่ไม่มี `broker` command
- LaunchAgent ยังชี้ไป binary แบบเก่าและ service อยู่สถานะหยุด
- Codex config มี hook block รุ่นเก่าเฉพาะ `PostToolUse/apply_patch`
- AtoAxis Codex plugin ยังไม่ได้ติดตั้งผ่าน native plugin system
- transcript file ใหม่กว่าค่า parser cursor อย่างมีนัยสำคัญ จึงมี event ค้างที่ยังไม่ scan
- delivery log เคยได้รับ HTTP 402 ซึ่งต้องแยกออกจาก detection/local capture

ปัญหาเหล่านี้ต้องปิดก่อนใช้ observer inference เป็น production feature

---

## Target Architecture

```text
Native AI hooks ───────┐
Transcript scanners ───┤
MCP/tool middleware ───┤
Filesystem observer ───┼──> Local Broker / Evidence Inbox
Session/process events ─┤                │
Editor input evidence ──┘                ▼
                                 Correlation Engine
                                         │
                                         ▼
                                      Dedup
                                         │
                                         ▼
                               Canonical Activity Event
                                         │
                                         ▼
                               Canonical Heartbeat Generator
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                         Backend API          Offline Queue
```

Broker ต้องเป็นเจ้าของ local durability และ canonicalization ส่วน adapter ทำหน้าที่
แปลง producer-specific payload เป็น evidence เท่านั้น

---

# Phase 0 — Runtime Recovery and Diagnostics

## เป้าหมาย

ทำให้ capability ที่มีอยู่แล้วทำงานจริงและตรวจสอบได้ ก่อนเพิ่ม inference layer

## งานที่ต้องทำ

### 0.1 Single CLI identity

- ให้ VS Code managed CLI, shell `PATH`, hook scripts และ OS service ใช้ binary build
  เดียวกัน
- เพิ่ม build/version/commit SHA ใน `wakaclock status --json`
- ตรวจและแจ้งเตือนเมื่อ CLI path หลายตัวชี้ไปคนละ version
- migrate service manifest ที่ใช้ `agent` alias รุ่นเก่าไป `broker run`

### 0.2 Broker lifecycle

- install/start broker แบบ idempotent บน launchd, systemd user service และ Windows
  Task Scheduler
- ใช้ singleton lock ป้องกัน broker ซ้ำ
- ให้ VS Code ใช้ extension-owned broker เป็น fallback เมื่อ user service ใช้ไม่ได้
- ตรวจว่าการ update CLI ไม่ทิ้ง service manifest ที่ชี้ไป binary เก่า

### 0.3 Codex integration migration

- สร้าง AtoAxis Codex plugin package ตาม native plugin layout รุ่นปัจจุบัน
- migrate direct TOML hook block รุ่นเก่าโดยไม่ลบ config ของผู้ใช้
- ติดตั้ง/upgrade plugin แบบ idempotent
- ตรวจ hook enabled/trusted และแสดง manual action เมื่อ platform บังคับ user trust
- hook path ต้องชี้ไป stable managed directory ไม่ใช่ VSIX/worktree path ชั่วคราว

### 0.4 Transcript scanner recovery

- scanner ต้อง autostart, resume cursor และตาม transcript ที่โตขึ้นได้
- expose `file_size`, `cursor_offset`, `lag_bytes`, `last_scan_at`, `last_event_at`
- format/schema ที่ไม่รองรับต้องแจ้ง diagnostic แทน silent zero events
- parser failure ของ agent หนึ่งต้องไม่หยุด agent อื่น

### 0.5 Doctor command

เพิ่ม:

```text
wakaclock doctor ai --json
```

ต้องรายงาน:

- CLI path/version mismatch
- broker installed/running/version
- adapter detected/installed/enabled/trusted
- latest native-hook event
- latest transcript modification และ parser cursor lag
- broker inbox pending/retry/dead-letter
- outbound queue depth
- backend delivery result แยก `401`, `402`, network และ validation failure
- stale hook/plugin path

## Acceptance Criteria

- Codex Desktop `apply_patch` หนึ่งครั้งเข้า local broker exactly once
- sidecar พร้อมให้ editor correlate ก่อนหรือภายใน bounded fallback window
- broker หยุด/เปิดใหม่แล้ว event ไม่หาย
- backend offline/402 แล้วยังเห็นว่า `captured locally` และ event อยู่ใน queue
- doctor ระบุจุดขาดของ pipeline ได้โดยไม่ต้องเปิด debug log หลายไฟล์เอง

---

# Phase 1 — Canonical Evidence Contract and Adapter Registry

## เป้าหมาย

ทำให้ agent ใหม่เชื่อมต่อผ่าน contract เดียว โดยไม่เพิ่ม attribution logic กระจายตาม
shell script หรือ editor extension

## Canonical evidence

ต่อยอด `BrokerEventV1` ให้รองรับ evidence metadata ที่จำเป็น:

```json
{
  "schema_version": 1,
  "event_type": "file_change",
  "event_id": "provider-session-tool-file",
  "occurred_at": "2026-08-31T10:30:00Z",
  "entity": "/project/src/app.ts",
  "project_root": "/project",
  "change_kind": "modify",
  "agent": "codex",
  "provider": "openai",
  "model": null,
  "session_id": "session-42",
  "tool_event_id": "tool-7",
  "source": "agent_hook",
  "transport": "native_plugin",
  "confidence": "verified",
  "lines_added": 12,
  "lines_deleted": 4
}
```

ห้ามรับหรือเก็บ:

- prompt/response
- source/patch content
- clipboard
- terminal output
- command arguments
- arbitrary unknown fields

## Adapter manifest

สร้าง declarative manifest ต่อ agent เช่น:

```text
id
provider
executable detection
install strategy
native hook capabilities
transcript roots
payload schema versions
supported tool/change kinds
verification status
health probe
```

ย้าย installation logic ใน `extensions/vscode/src/agentSetup.ts` ไปใช้ registry นี้
โดย installer ต้อง atomic, idempotent และ preserve user configuration

## Acceptance Criteria

- เพิ่ม test adapter ได้โดยไม่แก้ correlation/heartbeat code
- adapter ที่ยังไม่ live-verified ต้องแสดง `scaffold` หรือ `unverified`
- unknown payload schema ถูก quarantine พร้อม sanitized diagnostic
- adapter ทุกตัวส่ง metadata shape เดียวเข้ Broker

---

# Phase 2 — Direct Evidence First

## เป้าหมาย

เพิ่ม recall ผ่านหลักฐานที่เชื่อถือได้ก่อนสร้าง universal inference

## Producer priority

1. Native hooks/plugins
2. Structured MCP events
3. Completed transcript tool calls
4. Before/After tool snapshot
5. Filesystem/session inference

## Adapter rollout order

1. Codex Desktop/CLI
2. Claude Code
3. Gemini CLI
4. Cursor — ต้อง live-verify ก่อนเปลี่ยนสถานะจาก scaffold
5. Antigravity
6. Copilot CLI/IDE
7. Windsurf
8. Cline/Roo
9. OpenCode
10. Generic MCP producer SDK

## Generic MCP/tool ingress

- คง `wakaclock ai emit --json`
- คง `wakaclock ai tool-before/tool-after`
- เพิ่ม HTTP/SDK helper ที่อ่าน broker discovery/token อย่างปลอดภัย
- operation ที่ควรรองรับ: write, apply patch, create, move, rename, delete, replace,
  multi-edit และ shell mutation
- one tool call touching N files มี one duration interval และ N file evidence records

## Acceptance Criteria

- Known native adapter recall อย่างน้อย 99%
- hook และ transcript ของ edit เดียวกันเหลือ canonical event เดียว
- failed tool call ไม่สร้าง verified edit
- real payload verification ถูกบันทึกใน `VERIFICATION.md`/capability matrix

---

# Phase 3 — Workspace Registry and Universal Filesystem Observer

## 3.1 Workspace registry

Broker ต้องไม่ watch home directory ทั้งหมด ให้ producer ลงทะเบียน workspace lease:

```text
workspace_id
canonical_root
producer_id
pid/session_id
registered_at
last_seen_at
expires_at
exclude rules
```

VS Code, agent session และ CLI refresh lease เป็นระยะ เมื่อทุก lease หมดอายุจึงหยุด
watch workspace นั้น

## 3.2 Filesystem observer

- ใช้ `notify` crate ซึ่ง map ไป FSEvents/inotify/ReadDirectoryChangesW
- รองรับ create, modify, rename และ delete
- สร้าง raw filesystem evidence เท่านั้น
- coalesce duplicate/atomic-save event
- canonicalize path และป้องกัน symlink escape
- respect `.gitignore`, user excludes, generated/build/vendor directories
- fingerprint เฉพาะไฟล์ที่มี event ไม่ scan/hash repository ทั้งหมดทุก tick
- reuse Git blob/content hashing จาก `tool_snapshot.rs`
- ไม่อ่านหรือ persist source content

## Acceptance Criteria

- watcher ทำงานเฉพาะ registered workspace
- editor atomic save สร้าง logical change เดียว
- rename/delete/create ถูก normalize ถูกต้อง
- event storm มี bounded memory/backpressure
- idle CPU และ memory อยู่ใน budget ที่กำหนด
- filesystem event เพียงอย่างเดียวยังคงเป็น `unknown`

---

# Phase 4 — Agent Session and Process Evidence

## เป้าหมาย

ใช้ session/process เป็นหลักฐานประกอบ ไม่ใช่คำตัดสินว่า AI แก้ไฟล์

## ลำดับความน่าเชื่อถือ

1. Native session/tool lifecycle event
2. Transcript ที่กำลัง append พร้อม session/workspace metadata
3. Child process spawned จาก known agent tool call
4. Process tree + exact cwd/workspace match
5. Process name อย่างเดียว

Process name อย่างเดียวเป็น weak telemetry เท่านั้น เพราะ Cursor เปิดค้างได้,
Copilot/Cline อาจอยู่ใน shared extension host และอาจมีหลาย agent เปิดพร้อมกัน

## Metadata

```text
pid / ppid
process identity
agent / provider
workspace
session_id
tool_event_id
started_at
last_activity_at
ended_at
evidence strength
```

ห้ามเก็บ command arguments หรือ environment secrets

## Acceptance Criteria

- process/session evidence ไม่สร้าง heartbeat โดยลำพัง
- exact workspace/session match มีคะแนนสูงกว่า process-name match
- มีหลาย AI active พร้อมกันแล้วไม่มี direct match ต้องเป็น `unknown`
- process exit/crash ปิด session โดยไม่ใช้ `now` ขยาย duration แบบไม่จำกัด

---

# Phase 5 — Universal Correlation Engine

## กฎการตัดสิน

### AI Verified

```text
Native hook(file)
OR StructuredMcpWrite(file)
OR CompletedStructuredToolCall(file)
```

### AI Inferred

```text
FileChanged(file)
AND RecentAgentToolOrSession(workspace)
AND TimeWindowMatches
AND FingerprintOrChangeShapeMatches
AND NoCompetingAgentEvidence
```

Process name อย่างเดียวไม่พอสำหรับ `ai_inferred`

### Human

```text
PositiveEditorInput(file)
AND CorrelationWindowClosed
AND NoConflictingAiEvidence
```

### Unknown

```text
FileChangedWithoutSufficientProvenance
OR ConflictingHumanAndAiEvidence
OR MultipleCompetingAiSessions
```

## Implementation rules

- correlation windows ต้องมีชื่อและเหตุผลตามประเภท evidence ห้ามรวมทุก window เป็น
  constant เดียว
- clip evidence ตาม query day/session boundary
- formatter, build, Git checkout/merge และ codegen ต้องมี system/unknown treatment
- confidence มาจาก evidence combination ไม่ใช่ agent name
- เก็บ evidence lineage เพื่ออธิบายผลย้อนหลังได้โดยไม่เก็บ source content

## Acceptance Criteria

- Unknown ไม่ถูกเปลี่ยนเป็น Human โดย absence of AI evidence
- Human input ก่อน AI edit ไม่ถูก AI edit กลืนเวลาย้อนหลัง
- simultaneous Human/AI conflict ไม่ถูกตัดสินเป็น Human อัตโนมัติ
- shell mutation จาก active verified tool session ถูก infer ได้
- formatter/git/build ไม่กลายเป็น AI false positive

---

# Phase 6 — Dedup and Canonical Heartbeat Generator

## เป้าหมาย

ขยาย dedup ที่มีอยู่ให้รวม evidence ทุก source ก่อนสร้าง final heartbeat

## Canonical identity

ใช้ versioned fingerprint จาก:

```text
workspace
normalized entity
change kind
bounded timestamp
line delta / content fingerprint
session/tool identity เมื่อมี
```

Canonical activity เก็บ child evidence IDs:

```text
canonical_event
├── native hook evidence
├── transcript evidence
├── filesystem evidence
└── editor evidence
```

## Rules

- same `event_id` + same payload = duplicate success
- same `event_id` + different payload = conflict
- hook/transcript ต่าง event ID แต่ fingerprint เดียวกันต้อง merge
- weaker inferred evidence ถูก verified evidence supersede
- multi-file event ไม่คูณ duration ตามจำนวนไฟล์
- final heartbeat สร้างจาก canonical activity จุดเดียว

## Acceptance Criteria

- Duplicate canonical activity < 0.1%
- VS Code + hook + transcript + filesystem ของ edit เดียวเหลือหนึ่ง activity
- restart/replay ไม่เพิ่ม duration
- evidence conflict ถูกเก็บเป็น diagnostic โดยไม่ overwrite silently

---

# Phase 7 — Observability, Shadow Mode and Rollout

## UI/diagnostics

แสดง pipeline แยกขั้น:

```text
Agent detected
Adapter installed/trusted
Evidence received
Correlated
Accepted locally
Queued for delivery
Delivered / Rejected
```

เพิ่ม:

- `AtoAxis: Test AI Detection`
- `AtoAxis: Repair AI Integrations`
- broker health/status panel
- evidence source/confidence tooltip
- parser lag และ stale adapter warning

## Shadow mode

Universal observer ต้องเริ่มแบบไม่เปลี่ยน production attribution:

```text
observer.enabled = true
observer.attribution_mode = "observe_only"
```

ใน `observe_only` ให้บันทึก sanitized proposed attribution และเทียบกับ native hook
oracle หลังมีข้อมูลเพียงพอจึงเปิด:

```text
observer.attribution_mode = "infer"
```

ต้องมี kill switch ต่อ workspace และต่อ evidence source

## Acceptance Criteria

- observe-only ไม่เปลี่ยน heartbeat/analytics ปัจจุบัน
- มี precision/recall report เทียบกับ verified events
- rollout เปิดแบบ per-agent/per-platform ได้
- rollback ไม่ต้อง migrate หรือลบข้อมูล

---

## Test Strategy

### 1. Contract tests

- real-shape sanitized fixtures ต่อ adapter/schema version
- reject prompt/source/unknown fields
- event ID stability และ path normalization

### 2. External-process tests

- native hook subprocess
- shell `sed`, Python codemod, `git apply`
- broker offline/restart/replay
- multi-file and concurrent agent events

### 3. Observer tests

- atomic save
- create/rename/delete
- formatter และ eslint
- build/codegen burst
- Git checkout/merge/rebase
- symlink และ ignored directories
- multiple workspaces และ expired leases

### 4. Correlation/dedup tests

- hook + transcript
- hook + editor
- transcript + filesystem
- Human typing near AI edit
- two AI agents active simultaneously
- one AI edit touching 50+ files

### 5. Live verification

ทุก adapter ห้าม mark `verified` จนกว่าจะรันกับ tool จริงและบันทึก:

- tool/app version
- event names/schema version
- fields ที่ใช้
- successful/failed tool behavior
- multi-file behavior
- session/restart behavior

Fixture หรือ synthetic payload เพียงอย่างเดียวไม่ถือเป็น live verification

---

## Release Gates and KPI

```text
Known verified-adapter recall             >= 99%
AI false positive                        < 1%
Unknown falsely classified as Human       0%
Duplicate canonical activity              < 0.1%
Event loss after offline/restart           0%
Native MCP attribution                     100%
Duration total regression                  <= existing tolerance
```

Universal inference ต้องผ่าน shadow dataset ก่อนเปิด production และต้องรายงาน
precision แยกจาก native adapter recall ห้ามนำ verified/inferred มารวมเป็นตัวเลขเดียว

---

## Recommended Delivery Order

```text
Phase 0  Runtime/Broker recovery + doctor
Phase 1  Canonical evidence contract + adapter registry
Phase 2  Native hooks/transcript/MCP direct evidence
Phase 3  Workspace registry + filesystem observer
Phase 4  Session/process evidence
Phase 5  Universal correlation
Phase 6  Cross-source dedup + canonical heartbeat
Phase 7  Shadow mode + diagnostics + staged rollout
```

ลำดับนี้ตั้งใจให้ direct evidence ทำงานครบก่อน inference เพื่อไม่ให้เพียงเปิด Cursor,
Cline หรือ Copilot ทิ้งไว้แล้วงานของมนุษย์ทั้ง workspace ถูกนับเป็น AI

---

## Suggested Change Sets

1. `fix(runtime): unify cli broker and adapter health`
2. `feat(ai): add doctor command and parser lag diagnostics`
3. `feat(ai): introduce declarative adapter registry`
4. `feat(ai): ship and verify native codex plugin integration`
5. `feat(ai): add workspace lease registry`
6. `feat(ai): add metadata-only filesystem observer`
7. `feat(ai): ingest agent session and process evidence`
8. `feat(ai): correlate universal evidence in shadow mode`
9. `feat(ai): canonicalize cross-source activity`
10. `feat(ui): expose ai detection pipeline health`
11. `test(ai): certify universal detector rollout`

แต่ละ change set ต้องรักษา backward compatibility, ไม่ใช้ destructive migration และ
ไม่ปนงาน UI/roadmap อื่นที่ไม่เกี่ยวข้อง

---

## Definition of Done

ระบบถือว่าเป็น Universal AI Activity Intermediary เมื่อ:

- known agents ส่ง direct evidence ได้เมื่อ platform รองรับ
- agent ที่ไม่มี adapter ยังสร้าง raw filesystem/session evidence ได้
- inference ต้องอาศัยหลักฐานมากกว่าชื่อ process
- ambiguous activity เป็น `unknown` ไม่ใช่ `human`
- evidence ทุก source ถูก deduplicate ก่อน final heartbeat
- local capture ทำงานแม้ backend ใช้ไม่ได้
- user มองเห็นชัดว่า pipeline ขาดที่ detection, correlation หรือ delivery
- adapter ใหม่เพิ่มผ่าน registry/contract โดยไม่แก้ core attribution rules
- privacy, duration และ regression gates ผ่านครบ


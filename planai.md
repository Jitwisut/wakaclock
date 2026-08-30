# WakaClock Universal AI Activity Detection Plan

## เป้าหมาย

พัฒนา WakaClock ให้เป็นตัวกลางสำหรับตรวจจับและวัด Activity ของทั้ง Human และ AI โดยไม่ผูกกับ AI provider หรือ editor เจ้าใดเจ้าหนึ่ง พร้อมรักษาความแม่นยำการนับเวลาเทียบ WakaTime-compatible reference ให้อยู่ในระดับที่เชื่อถือได้

เป้าหมายหลัก:

- WakaClock ต้องตรวจจับ Human activity และ AI activity ได้อย่างถูกต้อง
- รองรับ Claude, Codex, Gemini, ChatGPT/Tan/MCP, Cursor, Copilot, Windsurf, Cline, Roo และ agent อื่นในอนาคต
- ไม่ตีความว่า `ไม่มี AI evidence = Human`
- รองรับการแก้ไฟล์จาก shell, script, MCP tool และ external process
- ป้องกัน duplicate heartbeat จากหลายแหล่ง
- Event ต้องไม่หายเมื่อ backend/network มีปัญหา
- ค่า duration รวมต้องคลาดเคลื่อนจาก WakaTime-compatible reference ไม่เกิน 1%

---

## Baseline ปัจจุบัน

Source of truth สำหรับ acceptance อยู่ที่
[`scripts/duration-audit/golden.jsonl`](scripts/duration-audit/golden.jsonl) และ
[`scripts/duration-audit/golden.expected.json`](scripts/duration-audit/golden.expected.json)
เท่านั้น: metadata-only, reproducible, WakaClock 3,600 วินาทีเทียบกับ
WakaTime-compatible reference 3,600 วินาที (error 0%). ตัวเลขจากการทดลองกับ
ข้อมูลจริงในส่วนถัดไปเป็น historical findings ไม่ใช่ acceptance baseline
เพราะเปลี่ยนตามบัญชีและช่วงเวลาที่ตรวจ

---

# Phase 0 — Lock Baseline

ก่อนเปลี่ยน architecture ต้องล็อก baseline ปัจจุบันไว้ เพื่อยืนยันว่าการแก้ AI detection ไม่ทำให้ time tracking พัง

## งานที่ต้องทำ

- เก็บ heartbeat dataset ปัจจุบันเป็น Golden Dataset
- เก็บผล WakaClock duration ปัจจุบัน
- เก็บ WakaTime-compatible reference
- เพิ่ม benchmark:
  - Total duration
  - Daily duration
  - Project duration
  - Human duration
  - AI duration
- สร้าง test dataset สำหรับ:
  - Human coding
  - Claude
  - Codex
  - Gemini
  - ChatGPT/Tan/MCP
  - Shell script
  - Bulk file edit

## Acceptance Criteria

```text
Total Duration Error <= 1%
Daily Duration Error <= 3%
```

ห้าม regression แย่กว่า baseline โดยไม่มีเหตุผลและรายงานที่ชัดเจน

---

# Phase 1 — Attribution Correctness

แก้ data model การระบุผู้สร้าง activity ก่อน เพราะ logic แบบนี้ไม่ถูกต้อง:

```text
ไม่มี AI evidence
↓
human
```

กฎใหม่:

```text
RAW_CHANGE_WITHOUT_PROVENANCE != HUMAN
```

หมายเหตุ: editor activity สามารถสรุปเป็น Human ได้หลัง correlation window เมื่อมี
positive editor evidence (เช่น text-change/keystroke) และไม่มี AI evidence ที่แข่งขัน
กันอยู่; แต่การไม่มี AI sidecar ณ instant แรกเพียงอย่างเดียวไม่ควรถูกใช้เป็นหลักฐาน Human

## Attribution States

เปลี่ยนเป็นอย่างน้อย 4 สถานะ:

```text
HUMAN
AI_VERIFIED
AI_INFERRED
UNKNOWN
```

หรือใช้ค่า lowercase ใน API/storage:

```text
human
ai_verified
ai_inferred
unknown
```

ความหมาย:

| State | ความหมาย |
|---|---|
| Human | มีหลักฐานเชิงบวกว่า user เป็นผู้ทำ |
| AI Verified | มี native hook / MCP event / integration ยืนยันโดยตรง |
| AI Inferred | correlation หลาย evidence แล้วมีความมั่นใจสูงว่า AI เป็นผู้ทำ |
| Unknown | ตรวจพบ activity แต่ยังพิสูจน์ไม่ได้ว่า Human หรือ AI |

## Data Model

ถ้าปัจจุบันใช้ boolean:

```typescript
isAi: boolean
```

ให้ migrate เป็น enum เช่น:

```typescript
actorType:
  | "human"
  | "ai_verified"
  | "ai_inferred"
  | "unknown"
```

และเพิ่ม:

```typescript
confidence: number
```

ตัวอย่าง confidence:

```text
1.00 = Native AI hook
0.95 = MCP event
0.80 = process + filesystem correlation
0.60 = weaker filesystem inference
```

## จุดที่ต้องตรวจและแก้

- VS Code attribution
- Backend activity model / DTO
- Database/schema ถ้ายังใช้ `is_ai` แบบ boolean
- Activity Timeline
- Human vs AI filter
- Aggregation
- API responses
- Existing reports / analytics ที่ assume ว่ามีแค่ Human/AI

---

# Phase 2 — WakaClock AI Activity Broker

> Implementation target is the existing `wakaclock` binary with the `broker` command
> family. The Phase 2 stable transport is authenticated loopback HTTP plus the SQLite
> inbox; Unix-socket transport and a separate `wakaclock-broker` artifact are not part
> of this delivery.

สร้าง local service กลางที่รับ event จาก AI ทุกประเภท

ชื่อที่เสนอ:

```text
wakaclock-broker
```

Architecture:

```text
Claude ────────┐
Codex ─────────┤
Gemini ────────┤
Cursor ────────┤
ChatGPT ───────┤
Tan/MCP ───────┤
Other AI ──────┘
        │
        ▼
┌─────────────────────┐
│ WakaClock AI Broker │
└──────────┬──────────┘
           │
           ▼
   Evidence Engine
           │
           ▼
   Heartbeat Pipeline
           │
           ▼
     WakaClock API
```

## Local Transport

รองรับอย่างใดอย่างหนึ่งหรือหลายแบบ:

```text
127.0.0.1:<port>
Unix Socket: ~/.wakaclock/broker.sock
JSONL spool
```

## Canonical Event Schema

ตัวอย่าง:

```json
{
  "event": "file_change",
  "actor": "ai",
  "provider": "chatgpt",
  "agent": "tan",
  "transport": "mcp",
  "tool": "apply_patch",
  "workspace": "/project/wakaclock",
  "file": "src/app.ts",
  "timestamp": "...",
  "session_id": "...",
  "lines_added": 12,
  "lines_deleted": 4,
  "confidence": 1.0
}
```

ไม่จำเป็นต้องส่ง source code หรือ prompt content เพื่อรักษา privacy

---

# Phase 3 — Universal Workspace Observer

เพิ่ม File Observer ระดับ workspace เพื่อจับการแก้ไฟล์จาก process ภายนอก editor

## ต้องตรวจจับ

```text
Create
Write
Rename
Delete
```

ตัวอย่าง raw evidence:

```text
src/a.ts changed
14:32:05.123
```

## กฎสำคัญ

Filesystem change อย่างเดียวห้ามสรุปว่าเป็น AI

เพราะอาจเกิดจาก:

```text
prettier
eslint --fix
compiler
git checkout
git merge
codegen
user
```

ดังนั้น File Observer ทำหน้าที่เพียงสร้าง:

```text
FILE_CHANGED
```

ไม่ใช่:

```text
AI_CHANGED_FILE
```

---

# Phase 4 — Process / Agent Session Observer

ทำให้ WakaClock รู้ว่าใน workspace นั้นมี AI agent ตัวใดกำลัง active

## Known Processes / Agents

ตัวอย่าง:

```text
claude
codex
gemini
cursor
windsurf
cline
roo
copilot
```

รวมถึง MCP host และ adapter ต่าง ๆ

## Metadata ที่ควรเก็บ

```text
pid
ppid
process_name
cwd
workspace
started_at
last_activity
provider
agent
session_id
```

ตัวอย่าง:

```text
PID 18231
agent=claude
cwd=/wakaclock
active=true
```

เมื่อเกิด:

```text
14:30:01 AI session active
14:30:03 src/api.ts changed
```

Evidence Engine จึงค่อย infer ว่า file mutation นั้นอาจมาจาก AI

---

# Phase 5 — MCP / Tan Native Integration

นี่คือ integration สำคัญสำหรับ ChatGPT/Tan/MCP

ทุก write operation ของ MCP ควรส่ง event เข้า WakaClock Broker โดยตรง

## Operation ที่ต้องรองรับ

```text
write_file
apply_patch
create_file
move_file
rename_file
delete_file
replace
multi_edit
```

Flow:

```text
ChatGPT
   ↓
tan.apply_patch
   ↓
MCP middleware
   ├── execute operation
   └── emit WakaClock event
```

Event ที่ WakaClock ควรได้รับ:

```text
provider = openai
agent = chatgpt
transport = mcp
tool = tan.apply_patch
confidence = 1.0
```

การทำงานผ่าน Tan/MCP จึงเป็น `AI_VERIFIED` โดยไม่ต้องเดาจาก filesystem

---

# Phase 6 — AI Adapter Layer

สร้าง adapter interface กลางสำหรับ normalize event ของแต่ละ AI

ตัวอย่าง:

```typescript
interface AiAdapter {
  detect(): boolean
  normalize(event): ActivityEvidence
}
```

โครงสร้างที่เสนอ:

```text
adapters/
├── claude/
├── codex/
├── gemini/
├── cursor/
├── mcp/
├── vscode/
└── generic/
```

Claude/Codex/Gemini hooks ที่มีอยู่ควรเปลี่ยนจากการสร้าง heartbeat เองเป็น:

```text
AI Hook
  ↓
Broker
  ↓
Evidence Engine
  ↓
Canonical Activity
  ↓
Heartbeat Generator
```

ทำให้ attribution logic รวมอยู่ที่เดียว

---

# Phase 7 — Shell Mutation Detection

AI agent สามารถแก้ไฟล์โดยไม่ใช้ structured Edit/Write tools

ตัวอย่าง:

```bash
sed -i
perl -pi
python fix.py
cat > file
echo >> file
git apply
patch
cp
mv
```

ดังนั้นระบบต้อง correlation:

```text
AI Session
+
Shell command/tool evidence
+
File mutation
```

ตัวอย่าง:

```text
Claude active
↓
Bash tool
↓
python migration.py
↓
12 files changed
```

ผลลัพธ์ต้องไม่เป็น `0 AI heartbeat`

ควรถูกจัดเป็น AI Verified หรือ AI Inferred ตามหลักฐานที่มี

---

# Phase 8 — Evidence Correlation Engine

สร้าง engine กลางสำหรับรวม evidence จากหลายแหล่ง

## Evidence Sources

```text
Native hook
MCP event
Filesystem event
Process activity
Editor event
Git diff
AI transcript fallback
```

## ตัวอย่าง Rule

### Verified AI

```text
NativeHook(file)
OR
MCPWrite(file)
```

ผลลัพธ์:

```text
AI_VERIFIED
confidence = 1.0
```

### Inferred AI

```text
FileChanged(file)
AND
AiSessionActive(workspace)
AND
timestamp delta < threshold
```

ผลลัพธ์:

```text
AI_INFERRED
confidence ≈ 0.8
```

### Human

```text
Positive editor/user-input evidence
AND
no conflicting AI evidence
```

ผลลัพธ์:

```text
HUMAN
```

### Unknown

```text
FileChanged
AND
no sufficient evidence
```

ผลลัพธ์:

```text
UNKNOWN
```

---

# Phase 9 — Deduplication

การแก้ไฟล์ครั้งเดียวอาจถูกจับจากหลาย source เช่น:

```text
Claude Hook
Filesystem Watcher
VS Code watcher
MCP
Git diff
```

หากไม่ deduplicate อาจนับเวลาและ activity ซ้ำ

## Fingerprint ที่เสนอ

ใช้หลาย field ร่วมกัน:

```text
workspace
file
timestamp window
change range
session
line delta
```

Deduplication window เริ่มต้นประมาณ:

```text
2–5 seconds
```

แล้วสร้าง canonical event เดียว:

```text
canonical event
├── filesystem evidence
├── claude evidence
├── mcp evidence
└── editor evidence
```

---

# Phase 10 — Canonical Heartbeat Generator

หลัง correlation + deduplication แล้วค่อยสร้าง heartbeat

ไม่ควรให้ adapter แต่ละตัวสร้าง heartbeat final independently

เปลี่ยนจาก:

```text
Claude → heartbeat
Codex → heartbeat
VSCode → heartbeat
```

เป็น:

```text
Claude ─┐
Codex ──┤
VSCode ─┤
MCP ────┤
FS ─────┘
         ↓
Evidence Engine
         ↓
Deduplicator
         ↓
Canonical Activity
         ↓
Heartbeat Generator
```

เป้าหมายคือแก้:

- duplicate heartbeat
- missing AI activity
- inconsistent timeout
- attribution disagreement

---

# Phase 11 — AI Session Tracking

นอกจาก file heartbeat ควรเก็บ AI session แยกต่างหาก

ตัวอย่าง:

```text
Session
Provider: ChatGPT
Agent: tan
Started: 14:20
Ended: 14:47
Workspace: wakaclock
Files touched: 13
```

หรือ:

```text
Provider: Claude
Agent: Claude Code
Transport: CLI
```

Dashboard จะสามารถรายงานตัวอย่างเช่น:

```text
วันนี้
Human       3h 15m
Claude      1h 22m
ChatGPT/Tan 48m
Codex       31m
Unknown      4m
```

---

# Phase 12 — แยก AI Session Time กับ Coding Time

AI มีเวลาสองประเภทที่ไม่ควรปนกัน

## AI Session Time

เวลาที่ agent/session ทำงานหรือ active

## AI Coding Time

เวลาที่มี coding/file activity จริง

ต้องเก็บแยก:

```text
ai_session_duration
coding_duration
```

เพื่อไม่ให้ dashboard ทำให้เข้าใจผิดว่า AI coding อยู่ตลอดเวลาที่ process เปิดอยู่

---

# Phase 13 — Local Delivery Queue

ถ้า backend, network หรือ entitlement มีปัญหา activity ต้องไม่หาย

Broker ควรมี local durable queue เช่น:

```text
~/.wakaclock/events.db
```

แนะนำ SQLite

สถานะ event:

```text
pending
sent
failed
acknowledged
```

ต้องรองรับ:

```text
retry
exponential backoff
batch upload
restart recovery
```

และห้าม silent fail

ต้องมี diagnostics ที่บอกได้ว่า event ไม่ถึง backend เพราะอะไร เช่น network, 401, 402, invalid payload หรือ server error

---

# Phase 14 — Dashboard / UI

หลัง backend correctness เสถียรแล้วค่อยปรับ UI

## Human vs AI

แสดงอย่างน้อย:

```text
Human
Verified AI
Inferred AI
Unknown
```

## AI Drilldown

ตัวอย่าง:

```text
AI
├── Claude
│   └── 2h 31m
├── ChatGPT / Tan
│   └── 1h 14m
├── Codex
│   └── 42m
└── Gemini
    └── 18m
```

## Project Breakdown

```text
wakaclock

Human       55%
AI          43%
Unknown      2%
```

## Evidence Tooltip

ตัวอย่าง Verified:

```text
AI Verified
Detected directly from MCP event
Tool: tan.apply_patch
Confidence: 100%
```

ตัวอย่าง Inferred:

```text
AI Inferred
Detected from active AI session + filesystem activity
Confidence: 82%
```

---

# Phase 15 — Privacy Controls

หาก WakaClock เป็น AI activity intermediary เรื่อง privacy ต้องเป็น default architecture requirement

## Default: ไม่เก็บ

```text
source code
prompt
response
clipboard
terminal output
```

## เก็บเฉพาะ metadata ที่จำเป็น

```text
workspace
file path
timestamp
language
lines added/deleted
AI provider
agent
model (if known)
session
tool
confidence
```

## Settings ที่ควรมี

```text
hash file path
exclude paths
disable process detection
disable transcript fallback
exclude workspace
```

---

# Phase 16 — Integration Test Matrix

ต้องมี integration test จริง ไม่ใช่เฉพาะ unit test

| Scenario | Expected |
|---|---|
| Human typing VS Code | HUMAN |
| Human save file | HUMAN |
| Claude Edit | AI_VERIFIED |
| Claude Write | AI_VERIFIED |
| Claude Bash + sed | AI |
| Claude Python codemod | AI |
| Codex apply_patch | AI_VERIFIED |
| Codex shell | AI |
| Gemini replace | AI |
| Gemini shell | AI |
| ChatGPT → tan.apply_patch | AI_VERIFIED |
| MCP move file | AI_VERIFIED |
| MCP delete/create | AI_VERIFIED |
| prettier save | ไม่ false AI |
| eslint --fix | ไม่ false AI |
| git checkout | UNKNOWN/SYSTEM |
| git merge | UNKNOWN/SYSTEM |
| AI edit 50 files | จับได้ครบ |
| VS Code + AI hook duplicate | 1 canonical activity |
| Backend offline | Queue event ไว้ |
| Restart broker | Event ไม่หาย |
| API rejection | มี diagnostics ชัดเจน |

---

# Phase 17 — Duration Regression + CI Validation

ทุกครั้งที่แก้ AI pipeline ต้องรัน duration audit และ pipeline-equivalent tests

## CI Tests

อย่างน้อย:

```text
duration-audit
AI attribution tests
dedup tests
heartbeat tests
offline queue tests
adapter integration tests
backend tests
frontend tests
typecheck
lint
```

## Release Gates

Fail build หาก:

```text
Duration Total Error > 1%
```

หรือ:

```text
Known AI Detection Recall < 99%
```

หรือ:

```text
Unknown → Human misclassification > 0
```

## Pipeline / CI Validation Requirement

ก่อน push งานที่เกี่ยวข้องกับแผนนี้:

- ต้องรัน test แบบเดียวกับ CI pipeline หรือใกล้เคียงที่สุด
- ต้องตรวจและแก้ pipeline test failures ที่เกี่ยวข้องกับงาน
- ห้าม push หาก pipeline-related tests ยัง fail โดยไม่รายงานสาเหตุที่ชัดเจน
- Final Report ต้องระบุผล test และ pipeline validation

---

# KPI / Release Targets

```text
Duration parity
<= 1%

Known AI Detection Recall
>= 99%

AI false positive
< 1%

Unknown falsely classified as Human
0%

Duplicate heartbeat
< 0.1%

Event loss after offline/restart
0%

Native MCP AI attribution
100%
```

---

# Milestone Plan

## Milestone 1 — Correctness Foundation

ทำ Phase:

```text
0 → 1 → 9 → 17
```

เป้าหมาย:

- ล็อก baseline
- Unknown ห้ามถูกนับเป็น Human
- ป้องกัน duplicate
- มี regression + CI gate

นี่เป็นงานชุดแรกที่ควรลงมือก่อน

---

## Milestone 2 — Universal Detector Core

ทำ Phase:

```text
2 → 3 → 4 → 8 → 10
```

เป้าหมาย:

- สร้าง WakaClock AI Broker
- ตรวจ filesystem activity
- ตรวจ AI process/session
- ทำ evidence correlation
- สร้าง canonical heartbeat จากจุดเดียว

เมื่อ Milestone นี้เสร็จ WakaClock จะไม่ผูกกับ editor หรือ agent เจ้าเดียวอีกต่อไป

---

## Milestone 3 — AI Integrations

ทำ Phase:

```text
5 → 6 → 7 → 11
```

เป้าหมาย:

- MCP/Tan native integration
- Adapter layer
- Shell mutation detection
- AI session tracking

หลัง Milestone นี้ การทำงานผ่าน Tan/MCP ควรถูกตรวจเป็น:

```text
ChatGPT
via MCP
Tool: tan.apply_patch
AI_VERIFIED
```

---

## Milestone 4 — Production Readiness

ทำ Phase:

```text
12 → 13 → 14 → 15 → 16
```

เป้าหมาย:

- แยก AI session time/coding time
- Durable queue
- Dashboard
- Privacy controls
- Integration tests ครบ matrix

---

# Target Architecture

```text
                  AI / HUMAN
                      │
        ┌─────────────┼──────────────┐
        │             │              │
     Editor        AI Hook          MCP
        │             │              │
        └─────────────┼──────────────┘
                      │
               WakaClock Broker
                      │
            ┌─────────┴─────────┐
            │                   │
      File Observer       Process Observer
            │                   │
            └─────────┬─────────┘
                      │
              Evidence Engine
                      │
                Deduplicator
                      │
              Attribution Engine
                      │
             Heartbeat Generator
                      │
                 Local Queue
                      │
                  Backend
                      │
                  Dashboard
```

---

# Recommended Implementation Order

ลำดับการลงมือที่แนะนำ:

1. Phase 0 — Golden dataset + baseline
2. Phase 1 — Attribution enum + UNKNOWN
3. Phase 9 — Deduplication foundation
4. Phase 17 — Regression + CI gates
5. Phase 2 — AI Broker
6. Phase 3 — Workspace Observer
7. Phase 4 — Process/Session Observer
8. Phase 8 — Evidence Correlation Engine
9. Phase 10 — Canonical Heartbeat Generator
10. Phase 5 — MCP/Tan Native Integration
11. Phase 6 — Adapter Layer
12. Phase 7 — Shell Mutation Detection
13. Phase 11 — AI Session Tracking
14. Phase 12 — Session Time vs Coding Time
15. Phase 13 — Delivery Queue
16. Phase 14 — Dashboard
17. Phase 15 — Privacy Controls
18. Phase 16 — Full Integration Matrix

หลักการสำคัญคือ **Correctness ก่อน Coverage และ Coverage ก่อน UI** เพื่อป้องกันการเพิ่ม integration ทีละจุดบน attribution model ที่ยังไม่ถูกต้อง

---

# Implementation Progress — 2026-08-28

## Phase 0/1 closeout checklist

- [ ] Phase 0 — baseline machine-readable ผ่าน และมี live-data certification ล่าสุด
- [ ] Phase 1 — actor enum migration ผ่าน full acceptance suite และไม่เหลือ production
  logic ที่ใช้ `NOT is_ai_generated` เพื่อตัดสิน Human

ให้ติ๊กสองรายการนี้หลังรัน full gates และ release certification เท่านั้น

## Milestone 1 — Correctness

- [x] Sync `scripts/duration-audit/timeline.py` ให้ตรง production Rust เรื่อง heartbeat-time anchor
- [x] Sync Human/AI handover bridging และ `other` attribution ให้ตรง production Rust
- [x] เพิ่ม duration port regression สำหรับ projected/raw anchors, handover, long absence และ WakaTime parity
- [x] เพิ่ม committed metadata-only Golden Dataset และ expected manifest; ตัวเลขทดลองเก่าเก็บเป็น historical finding
- [x] เพิ่ม `verify_port.py` → `golden.py` เป็น CI gate พร้อม total/daily tolerance และ breakdown invariants
- [ ] รัน live API comparison และบันทึก sanitized certification สำหรับ release ล่าสุด
- [x] API/Frontend แยก AI, Human และ Unknown metrics (คง `unattributed` เป็น legacy alias)
- [x] เพิ่ม `human`, `ai_verified`, `ai_inferred`, `unknown` actor enum/confidence พร้อม legacy boolean adapter
- [x] VS Code เก็บ ambiguous nearby AI edit เป็น Unknown แทนการเหมารวม Human
- [x] รักษา ordinary Human editor activity เมื่อไม่มี competing AI evidence หลัง correlation

## Milestone 2/3 — Universal AI ingress (started)

- [x] เพิ่ม `mcp` เป็น `AiEventSource` แบบ first-class
- [x] เพิ่ม `wakaclock ai emit` สำหรับรับ canonical metadata event จาก stdin JSON
- [x] ใช้ event-id dedup + offline heartbeat queue + AI fingerprint pipeline เดิม
- [x] append metadata-only sidecar เพื่อให้ VS Code correlation external edits ได้
- [x] ingress contract ไม่รับ prompt/response/patch/source content และ reject unknown fields
- [x] เพิ่ม `wakaclock ai tool-before` / `tool-after` เป็น shared metadata-only shell/MCP snapshot engine
- [x] persist BeforeTool snapshot ใน SQLite และ recover ข้าม CLI/editor restart ได้; stale session prune หลัง 24 ชั่วโมง
- [x] รองรับ Git และ non-Git workspace พร้อม create/modify/delete และ one-to-one pure rename
- [x] clean tracked Git ใช้ index blob ID; dirty/untracked ใช้ content fingerprint โดยไม่ persist source text
- [x] ไฟล์ที่ dirty ก่อน AI ยังตรวจว่าเปลี่ยนเพิ่มได้ แต่ line delta เป็น unknown ถ้าพิสูจน์ส่วนของ AI แยกไม่ได้
- [x] หนึ่ง shell tool call มี duration เพียงก้อนเดียวแม้แก้หลายไฟล์ โดยทุก event share `ai_change_id = tool_event_id`
- [x] suppress inferred shell event เมื่อมี exact native/verified fingerprint ที่แรงกว่าแล้ว
- [x] Claude, Codex และ Gemini shell/MCP hook adapters ใช้ snapshot engine เดียวกัน
- [ ] เพิ่ม adapter ฝั่ง Tan/MCP ให้เรียก `wakaclock ai emit` หรือ tool-before/tool-after อัตโนมัติหลัง successful mutation
- [ ] เพิ่ม process-tree/filesystem observer สำหรับ agent ที่ไม่มี Before/After hook lifecycle
- [ ] เพิ่ม evidence/dedup engine ครบทุก producer (Editor + Hook + Transcript + MCP + File Observer)

## Phase 2 implementation status — 2026-08-30

### Delivered in the current implementation

- [x] เพิ่ม `BrokerEventV1` แบบ strict metadata-only พร้อม path, rename, size และ
  attribution validation
- [x] เพิ่ม `~/.wakaclock/broker.db` durable inbox: pending/processing/retry/dead-letter,
  lease recovery, bounded backoff, event hash conflict detection, retention และ manual retry
- [x] เพิ่ม `wakaclock broker run/install/uninstall/start/stop/status/retry/rotate-token`
  และให้ `wakaclock agent ...` ใช้ implementation เดียวกันเป็น deprecated alias
- [x] เพิ่ม authenticated loopback HTTP v1, dynamic discovery/token files, health/status,
  single/batch atomic ingest, payload limits และ canonical actor response fields
- [x] ย้าย Claude/Codex/Gemini hooks, transcript sync, `ai emit` และ `tool-after` เข้า
  Broker pipeline; human/editor/LSP ยังคงเส้นทางเดิม
- [x] เพิ่ม direct durable fallback เมื่อ service ใช้งานไม่ได้ และคง outbound heartbeat
  queue เป็นเจ้าของ backend retry
- [x] VS Code ติดตั้ง/refresh broker หลัง verified API key + AI consent, มี remote child
  fallback, status bar และ `AtoAxis: Repair AI Integrations`
- [x] เพิ่ม Rust/HTTP/VS Code tests และเอกสาร `docs/ai-activity-broker.md`

### Acceptance gates — ยังไม่ติ๊กปิดจนกว่าจะมีหลักฐานล่าสุด

- [ ] Phase 0 และ Phase 1 closeout checklist ผ่านอย่างเป็นทางการก่อน
- [ ] Golden Dataset + `verify_port.py` + Rust/VS Code/frontend/full integration gates ผ่าน
- [ ] reliability matrix ผ่าน: offline backend, broker restart/lease recovery, concurrent
  duplicate, atomic 500-event batch และ stable logical heartbeat ID
- [ ] live API comparison certification ล่าสุดบันทึกเฉพาะ totals, วันที่ตรวจ, commit SHA
  และ error metrics โดยไม่เก็บ path/user/source content
- [ ] ตรวจ production code แล้ว boolean `is_ai_generated` เหลือเฉพาะ compatibility adapter

Phase 2 จะปิดได้เมื่อรายการ acceptance ด้านบนครบเท่านั้น งาน Universal Filesystem/Process
Observer, native Tan/MCP middleware และ full evidence/canonical dedup engine ยังคงเป็น
Phase 3–5 และ Phase 8–10 ตามลำดับ

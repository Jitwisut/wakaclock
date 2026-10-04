# AtoAxis: Product Strategy Audit สำหรับยุค Human + AI + Agent

วันที่ตรวจ: 28 กันยายน 2026 (Asia/Bangkok)  
Repository baseline: `80290d5bf1d9597a4e0304d66e4a9fece1f5bf5e`  
ประเภทงาน: implementation audit + current competitive research + development decision

**คำตัดสิน: ทำ Work Session Receipt เป็น Priority #1 โดยต่อยอด Timeline และ Measurement Trust ที่มีแล้ว ให้ตอบได้ว่า “งานนี้เกิดอะไรขึ้น ใคร/เครื่องมือใดทำ มีหลักฐานอะไร และอะไรยังไม่ทราบ” จากนั้นเพิ่ม Intervention Analytics และ Code Outcome Lineage ตาม dependency ของข้อมูล**

เหตุผลที่ต้องเปลี่ยนกรอบการแข่งขัน: WakaTime ปัจจุบันมี AI analytics แล้ว รวมถึง AI/human code, model/token/cost และ Human Follow-up rate ตามหน้า product/team ปัจจุบัน จึงไม่ควรใช้ “เรามี AI ส่วน WakaTime ไม่มี” เป็นสมมติฐานตั้งต้น ([WakaTime](https://wakatime.com/), [Teams](https://wakatime.com/teams)).

## วิธีอ่านและข้อจำกัดของหลักฐาน

- **F — Fact:** ยืนยันได้จาก implementation หรือเอกสารต้นทางที่อ่านจริง ข้อเท็จจริงว่า vendor “ประกาศมี” ไม่ใช่การรับรองคุณภาพจริงของ vendor
- **I — Inference:** ข้อสรุปจากเส้นทางโค้ด/ข้อมูล ต้องพิสูจน์เพิ่มด้วย runtime หรือผู้ใช้
- **A — Assumption:** สมมติฐานเพื่อวางแผน เช่น ขนาดทีม, willingness to pay และเวลา MVP
- **R — Recommendation:** ข้อเสนอและเกณฑ์ผ่านที่ยังไม่ได้เกิดขึ้น
- “ไม่พบ” หมายถึงไม่พบในเส้นทางโค้ด/เอกสารสาธารณะที่ตรวจ ไม่ใช่พิสูจน์ว่าไม่มีอยู่ทุก deployment
- Audit ครอบคลุมเส้นทางสำคัญทั้ง 14 หมวด โดยอ่าน producer → normalization/correlation → storage → service/route → UI และทดสอบเฉพาะส่วน ไม่ได้อ่านทุกบรรทัดทุกไฟล์หรือทำ penetration test
- ไม่เข้าถึง production DB, dashboard ที่ล็อกอินของคู่แข่ง, billing account หรือข้อมูลผู้ใช้จริง ไม่ได้รันแคมเปญ ground truth ใหม่เจ็ดวัน ผลต่อไปนี้จึงไม่ใช่ production certification
- มีไฟล์แผนเดิมแก้ไขค้างอยู่ก่อน audit; รายงานนี้ไม่เปลี่ยนไฟล์นั้นหรือ implementation ของผลิตภัณฑ์

## PHASE 1 — Audit ระบบปัจจุบัน

### 1.1 เส้นทางข้อมูลที่ยืนยันได้

```text
VS Code events / CLI / LSP / native agent hooks / local transcripts
        ↓
local broker + operation identity + correlation + sidecar + SQLite queue
        ↓
Rust API: auth / validation / idempotency / revision
        ├─ PostgreSQL: identities, organizations, consent, jobs, repairs
        ├─ ClickHouse: canonical heartbeats, usage, sessions, analytics
        └─ optional Kafka ingestion + RabbitMQ jobs / worker paths
        ↓
v1 compatibility + v2 evidence/analytics endpoints
        ↓
Next.js: projects / human-AI / timeline / AI diagnostics / Trust / teams

Tauri Desktop: foreground app + OS idle → app heartbeat → API/queue
```

**F:** README ระบุว่า Kafka adapter ยังไม่มี แต่โค้ดมี adapter ภายใต้ Cargo feature `kafka` และ initialization ใน `infrastructure/app/init.rs` แล้ว จึงใช้ implementation เป็นหลัก ไม่ใช้ README ตัดสิน readiness

### 1.2 สิ่งที่มีและสถานะจริงทั้ง 14 หมวด

| หมวด | มี implementation อะไรแล้ว | ความพร้อม / limitation / สิ่งที่ดูพร้อมแต่ยังไม่พร้อม |
|---|---|---|
| 1. Desktop Tracker | Tauri app, macOS/Windows foreground, OS idle, app rules, private mode, queue, sampler แยก delivery | มีตัวจริง ไม่ใช่แค่ `extensions/desktop-tracker` scaffold; Linux foreground คืน error; app focus ไม่พิสูจน์ผู้เขียนโค้ด; live OS certification ยังไม่ยืนยัน [C01] |
| 2. Backend | Rust/Axum, ingest validation, canonical revisions, jobs, OAuth, account/project/org services | โครงสร้างใช้งานได้จริงหลายส่วน แต่ feature gates ปิด reports/calendar/public sharing/leaderboards/SSO/SCIM/billing; การมี handler ไม่เท่ากับใช้งานได้ [C02,C03] |
| 3. Database / Analytics | PostgreSQL control data; ClickHouse raw/canonical heartbeats, usage, sessions, projections, pricing | มีฐานข้อมูลสำหรับ time/usage แล้ว; ยังไม่มี complete task/operation/outcome graph; query correctness และ tenant/revocation concurrency ต้องตรวจด้วย services จริง [C04,C05] |
| 4. Web Dashboard | AI stats, human-AI, project analytics, timeline, Trust Center, repair preview/apply/rollback, team sharing | UI หลักเรียก API จริง; Trust เป็น beta; บางหน้าวัด heartbeat share ขณะที่บางหน้าวัด line share ต้องไม่เรียกรวมว่า AI %; paid flow ไม่พร้อม [C06,C07] |
| 5. IDE / Editor | VS Code change/save/selection/focus/clipboard + external file observer; Zed/LSP; compatibility CLI | VS Code เป็นทางเดินที่ลึกที่สุด; generic document event ไม่พิสูจน์ human; JetBrains/Neovim ใน capability catalog ยัง inventory-only; remote/container ต้อง certify [C08,C09] |
| 6. AI Detection | hooks/transcripts, process presence, filesystem observer, correlation, dedup, canonical identity, certification catalog | Claude/Codex parsers มีจริง; builtin verification เป็น scaffold/stale; Gemini unverified; ชื่อ integration ใน registry ไม่ได้แปลว่าทุกโหมดเก็บได้ [C10,C11] |
| 7. Human vs AI Attribution | `human`, `ai_verified`, `ai_inferred`, `unknown`; confidence/reason; strict named-agent identity; repair revisions | unknown ถูกเก็บแยกดีแล้ว แต่ VS Code ปัจจุบันไม่ส่ง human line counters; ไม่มี fresh field precision/recall; confidence 1 เป็น policy ไม่ใช่ accuracy 100% [C08,C12] |
| 8. Project Analytics | stable project ID, rules/merge, project/language/branch/time, usage/model allocation; repository mapping และ commit/PR read analytics | commit attribution ปัจจุบันอาศัยช่วงเวลา+project+branch ไม่ใช่ line lineage; VCS connect/read ไม่พิสูจน์ว่ามี provider sync worker พร้อม [C13] |
| 9. Team Analytics | org/team/member authorization, aggregate/individual consent default off, consent audit และ UI | มีของจริงระดับ beta; ต้องตรวจถอน consent ระหว่างอ่าน/แคช; ยังไม่มี outcome cohort ที่ comparable; enterprise identity ไม่เปิดใช้งาน [C14,C03] |
| 10. Reports | schedule model/storage, delivery claim/retry states, export job paths | schedule create/claim ถูก runtime/background gates ปิด; ไม่ถือว่ามี scheduled email delivery จริง; export readiness ขึ้นกับ worker/object store [C15] |
| 11. Timeline | canonical intervals, union overlaps, strict active vs bridged comparable duration, agent session span, project/timezone clipping; chart/studio | มี timeline แล้ว ห้ามเสนอซ้ำ; ยังขาด task-level state transitions, wait/approval/test outcome, และ causal links ข้าม session [C16] |
| 12. Privacy / Security | metadata-oriented events, prompt/code/diff ไม่อยู่ใน AiEditEvent, encrypted credentials, auth scopes, consent, account-deletion worker | raw heartbeat ยังมี `entity`/project/branch/machine; metadata อาจ sensitive; Zoom title แบบ opt-in ถูกตัดความยาว ไม่ใช่ PII redaction; deletion ต้อง verify stores/backups จริง [C01,C04,C17] |
| 13. API / Integration | inventoried v1 routes, v2 capabilities/evidence/repair/import, scoped OAuth, standalone agent hooks | verifier ผ่าน 87 routes แต่หมายถึง registry valid ไม่ใช่ครบ 87 route production-ready; integration sync บางทาง fail-closed; ไม่มี receipt/span/outcome contract [C02,C18] |
| 14. Infrastructure | CI Rust/frontend/e2e/isolated broker tests, Docker configs, Redis presence, optional Kafka, RabbitMQ, workers | infra code พร้อมต่อยอด แต่ไม่ได้ตรวจ deployment health; desktop มี Cargo workspace แยก ต้องอย่าถือว่า backend tests ครอบคลุมมัน; อย่าเพิ่ม stack ใหม่ก่อนพิสูจน์ workload [C19] |

### 1.3 Data ที่มีแล้วแต่ยังใช้ไม่เต็มที่ และสิ่งที่ต่อยอดได้ง่าย

| หมวด | Data ที่มีใน contract/storage | ยังไม่ได้แปลงเป็น value ครบ | สิ่งที่ architecture รองรับได้ง่ายกว่าเริ่มใหม่ |
|---|---|---|---|
| Desktop | app/category, capture time, idle/focus state, local delivery state | ความสัมพันธ์ระหว่างงานใน editor และช่วง agent ทำงาน | แสดง context lane แบบ opt-in; ห้ามอนุมาน code authorship จาก app |
| Backend | tenant/user scope, operation revisions, jobs, repairs | explanation และการ replay สูตรระดับหนึ่ง session | receipt read model/versioned calculation บน services เดิม |
| DB/Analytics | heartbeat identity, actor, segments, session/turn/message references, token classes/pricing version | session joins และ uncertainty propagation | materialized receipt projection; ไม่ต้องใช้ graph database |
| Dashboard | range/timezone/project filters, evidence pagination, capability state | ผู้ใช้ต้องเปิดหลายหน้าจึงตอบคำถามงานเดียวได้ | เพิ่ม drill-down ใน timeline/Trust เดิม |
| IDE | before/after line counts, change fingerprint, copy/paste metadata, focus/selection | distinctions ของ paste/unknown และ evidence coverage | producer health UI และ input-source labels; human provenance ยังต้องเพิ่ม signal |
| AI Detection | source/confidence, tool IDs, identity conflicts, diagnostic/certification tuple | adapter regression detection หลังอัปเดต tool | coverage drift alerts และ self-test recipe |
| Attribution | unknown reason, repair history, higher revision | ประเมินว่าข้อมูล “พอใช้ตัดสินใจ” หรือยัง | uncertainty budget ต่อ session; export สูตร+denominator |
| Project | project_id, repo mapping, branch, commit window, tokens/project method | trace จาก operation ไปผลลัพธ์ที่เก็บใน Git | เริ่ม explicit links และทำ local commit checkpoint เพิ่ม |
| Team | membership, consent flags, member totals | privacy-safe cohort comparisons | team aggregate ที่แสดง sample/coverage และ minimum cohort |
| Reports | schedule/job state/export foundations | digest ที่มี evidence links | manual/on-demand digest ก่อนผูกส่งอีเมล |
| Timeline | raw/bridged/combined intervals และ overlap | attended vs agent execution vs waiting | หลาย lane บน common time axis; waiting ต้องมี event ใหม่ |
| Privacy | metadata boundaries/consent/deletion states | ผู้ใช้ตรวจได้ว่าอะไรออกจากเครื่อง | local payload preview + receipt export ที่ไม่มี path |
| API | stable envelopes/scopes/capabilities | external BI อ่าน session evidence ได้ | versioned session/receipt endpoint แบบ tenant-scoped |
| Infra | idempotency, queues, workers, DLQ/verification paths | customer-facing data freshness SLO | end-to-end capture→confirm latency/coverage monitoring |

**ข้อควรระวัง:** “มี field/table” ไม่รับประกันว่ามี producer เติมข้อมูล เช่น `ai_changes_raw` และ follow-up ledger มีโครงสร้าง แต่ยังไม่พบ production caller ที่ record AI/manual line ownership ในเส้นทางที่ตรวจ

### 1.4 Blockers ที่ยืนยันได้จากโค้ด

| ID | Finding | ผลกระทบ / การแก้ที่เสนอ |
|---|---|---|
| B01 | `adapter.rs` ให้ Claude/Codex verification เป็น scaffold; catalog ที่ตรวจมี historical, `promotable:false` | ห้ามขายว่า certified ทุก runtime; certify exact client/tool/bundle/OS tuple ใหม่ |
| B02 | VS Code `buildPayload` ส่ง `human_lines_added/deleted` และ `keystrokes` เป็น undefined; unmatched/mixed line measurements ส่ง unattributed | Human line % อาจไม่วัดได้แม้ผู้ใช้พิมพ์จริง; UI ต้องบอก supported denominator; อย่าแก้ด้วยเอา unknown ไปใส่ human |
| B03 | Follow-up service คืน `eligible_ai_changes:None`, rate `None`; ledger record methods พบเฉพาะ implementation/tests | “มี follow-up API” ยังไม่ใช่ follow-up feature; ต้อง wire collector, mature cohort, deletion/rename semantics |
| B04 | `/me/ai/effectiveness` คืน token/prompt coverage ว่า missing แบบคงที่ ทั้งที่นำ token/cost จาก stats มาคำนวณ | เมื่อมี usage จะได้ค่ากับ coverage ขัดกัน; derive coverage จาก actual usage stream |
| B05 | effectiveness ใช้ `ai_lines.max(1.0)` หาร tokens/cost และ share=0 เมื่อไม่มี denominator | zero-line session กลายเป็น cost/token per line ที่มีตัวเลขทั้งที่ไม่กำหนด; ใช้ null พร้อมเหตุผล; session ที่อ่าน/วิเคราะห์มีคุณค่าได้ |
| B06 | runtime feature gate ปฏิเสธ reports/calendar/public profiles/private leaderboard/SSO/SCIM/billing เสมอ | registry status beta ไม่ใช่ launch readiness; ต้องแสดง disabled และไม่เอาไปสัญญากับลูกค้า |
| B07 | commit attribution เป็น time-window allocation; ไม่มี durable operation→hunk→commit lineage | ห้ามเรียกว่าเปอร์เซ็นต์ AI ใน committed code; แยก activity association กับ code provenance |
| B08 | Desktop ส่ง app heartbeat เป็น human confidence=1 จาก focus/idle และใช้ architecture string เป็น machine | activity attendance ไม่เท่ากับ human code; แยก evidence semantics และ opaque installation/device ID ก่อน cross-device trace |
| B09 | `feature_available` ให้ `ai_human_follow_up` true แม้ rate ยัง unavailable; dependency flags ไม่ใช่ live health check | capability ควรแยก capture/read/metric readiness ไม่ใช้ boolean เดียว |

B04/B05 เป็น defect เชิง semantics ที่อ่านได้ตรงจาก implementation; B02/B03/B06/B07 เป็น capability gaps ที่ยืนยันได้; B08 เป็นความเสี่ยงการตีความ/identity ไม่ใช่หลักฐานว่า line attribution ทุกบรรทัดผิด

## PHASE 2 — WakaTime ปัจจุบัน

### 2.1 Competitive inventory ณ วันที่ตรวจ

| พื้นที่ | ข้อมูลที่ตรวจพบ | หลักฐานและระดับความมั่นใจ |
|---|---|---|
| Tracking/dashboard/plugins | editor heartbeats, projects/languages/branches และ ecosystem plugins กว้าง | F, เอกสารผลิตภัณฑ์/วิธีสร้าง plugin: [Plugins](https://wakatime.com/plugins), [Plugin guide](https://wakatime.com/help/creating-plugin) |
| AI analytics | AI/human changes, model efficiency และ spend อยู่ใน positioning หลักแล้ว | F vendor claim, ไม่ใช่ผลทดสอบอิสระ: [Product](https://wakatime.com/) |
| Agent tracking | มี install pages Claude Code/Codex CLI | F distribution support; ไม่เท่ากับ complete execution tracing: [Claude Code](https://wakatime.com/claude-code), [Codex CLI](https://wakatime.com/codex-cli) |
| Team | AI adoption, per-developer views และ Human Follow-up rate | F vendor claim: [Teams](https://wakatime.com/teams) |
| API | OAuth/API key; summaries/durations/commits/orgs/goals; AI additions/deletions, model/token fields และ AI daily insights | F documented contract; ไม่ได้เรียก authenticated endpoints: [API](https://wakatime.com/developers) |
| Desktop | มี desktop catch-all พร้อมตัวเลือก Mac/Windows/Linux และใช้ร่วม IDE plugin | F public download page: [Desktop](https://wakatime.com/desktop) |
| Privacy | ไม่ส่ง file content; มี controls ซ่อน path/project/branch และ exclude | F documented policy/config: [Data & Privacy](https://wakatime.com/faq#data) |
| Cost | API-token equivalent estimate ไม่ใช่ invoice/subscription charge | F: [Cost FAQ](https://wakatime.com/faq#ai) |

ราคา USD ตาม monthly selector ที่อ่าน: Free $0, Basic $9/เดือน, Premium $14/เดือน, Team $21/developer/เดือน, Business $24/developer/เดือน; Premium annual equivalent $12.83/เดือน, Team $19.25, Business $22. Free dashboard history 1 สัปดาห์ แต่ **ไม่ลบประวัติเดิม**; goals/reports/leaderboards, advanced commit/PR, exports และ Business SSO/OIDC/SCIM อยู่ตาม plan ที่ระบุ ไม่ควรสรุปว่า unlimited retention หรือ enterprise controls เป็นสิ่งที่ WakaTime ไม่มี ([Pricing](https://wakatime.com/pricing)).

### 2.2 WakaTime ทำได้ดีมาก — ไม่ควรแข่งขันด้วยการทำซ้ำ

**I/R:** distribution ผ่าน editor ecosystem, habit/time dashboard, goals/reports/leaderboards, standard project analytics และ established API เป็นฐานที่คู่แข่งมีอยู่แล้ว เราควรรักษา core interoperability และ onboarding ให้ดี ใช้เวลาพัฒนาความต่างเหนือฐานนั้น หลักฐานขอบเขต: [Plugins](https://wakatime.com/plugins), [API](https://wakatime.com/developers), [Pricing](https://wakatime.com/pricing).

### 2.3 ทำได้แต่มีช่องว่างให้ตรวจสอบ

- **Cost semantics:** cost estimate ไม่เท่ากับ actual bill; โอกาสคือ outcome-linked spend พร้อม allocation coverage ไม่ใช่แค่กราฟ token อีกอัน ([FAQ](https://wakatime.com/faq#ai)).
- **Authorship vs attendance vs tool surface:** เป็นคนละมิติ ผู้ใช้เคยรายงานสับสนเมื่อ Codex ทำงานอยู่ใน Cursor; ควรอธิบายสองมิติแยกกัน ไม่บังคับให้ชื่อ editor ต้องเป็นชื่อ agent ([issue #486](https://github.com/wakatime/vscode-wakatime/issues/486)).
- **Effectiveness:** follow-up edit ไม่พิสูจน์ว่า AI ทำงานแย่ อาจเป็น requirement ใหม่หรือ refactor; นี่เป็นข้อจำกัดการตีความ metric ไม่ใช่ข้อกล่าวหาว่าสูตรภายในคู่แข่งผิด ([Teams metric](https://wakatime.com/teams)).

### 2.4 “WakaTime ยังไม่มี” — ใช้คำอย่างมีหลักฐาน

**ยังยืนยัน absolute absence ไม่ได้** จากเอกสารสาธารณะที่ตรวจ ไม่พบสัญญา API/คำอธิบายที่ยืนยันความสามารถเหล่านี้ครบชุด:

1. Receipt หนึ่งงานที่รวมหลาย agent + human activity และ drill down ถึงหลักฐาน/unknown/correction revision
2. Explicit approval-wait / resumed / failed / interrupted state durations ข้ามเครื่องมือ พร้อม missing-event coverage
3. Cohort survival ที่ 7/30 วันพร้อม censoring, operation lineage และแยก rewritten/deleted/unobserved
4. การ export สูตร+evidence+calculation version เพื่อคำนวณผลซ้ำได้โดยไม่ส่ง prompt/source

ฐานการตรวจ: [public product](https://wakatime.com/), [team offering](https://wakatime.com/teams), [API reference](https://wakatime.com/developers). ทั้งสี่ข้อเป็น **candidate gaps** ที่ต้องตรวจ paid demo เพิ่ม ไม่ใช่คำรับรองว่า WakaTime ทำไม่ได้ และห้ามใช้ claims แบบนั้นบน landing page ก่อนพิสูจน์

### 2.5 UX disruption opportunities พร้อมข้อจำกัด

มีรายงาน AI ถูกนับเป็น human ใน [issue #476](https://github.com/wakatime/vscode-wakatime/issues/476) เปิด 8 มีนาคม 2026 และ tool/editor mismatch ใน [issue #486](https://github.com/wakatime/vscode-wakatime/issues/486) เปิด 10 มิถุนายน 2026; **ทั้งสองแสดง Closed ณ วันที่อ่าน** จึงใช้เป็นหลักฐานว่า pain เคยเกิด ไม่ใช่ bug ปัจจุบันที่ยืนยันซ้ำแล้ว

**R:** ทดสอบ UX กับผู้ใช้ว่าอธิบาย “ทำไมตัวเลขนี้นับแบบนี้” ได้เร็วขึ้นหรือไม่ โดยให้ทำโจทย์เดียวกันบนสองผลิตภัณฑ์ วัดเวลาหาคำตอบ/ความถูกต้อง/ความเชื่อมั่น ไม่ตัดสินว่า UI คู่แข่งแย่จากภาพหรือราคาเพียงอย่างเดียว

## PHASE 3 — ตลาด AI Coding และหน่วยวัดใหม่

### 3.1 Workflow ของเครื่องมือที่โจทย์ระบุ

| เครื่องมือ | ความเปลี่ยนแปลงของ workflow / signal ที่มีเอกสารรองรับ | ผลต่อ AtoAxis |
|---|---|---|
| Cursor | Agent/Tab มี hook คนละชุด; มี session/tool/subagent hooks และ AI code tracking API ระดับ commit/change | อย่านับ Cursor เปิดอยู่=AI เขียน; แยก surface/mode และทำ adapter versioned [Cursor hooks](https://prod.cursor.com/docs/hooks), [AI code API](https://docs.cursor.com/en/account/teams/ai-code-tracking-api) |
| Claude Code | มี OTel usage/tool events และ correlation attributes | รับ metadata บาง field ได้โดยไม่สร้าง collector ใหม่ทั้งหมด; ไม่ ingest raw telemetry โดยไม่ allowlist [Monitoring](https://code.claude.com/docs/en/monitoring-usage) |
| Codex | มี OTel API/tool results/approval events และ tool-duration metrics | terminal/IDE/app เป็น runtime คนละ tuple; event export อาจมี output snippet ต้องตัดที่เครื่องก่อนส่ง [Official configuration](https://learn.chatgpt.com/docs/config-file/config-advanced) |
| GitHub Copilot | dashboard แยก user-initiated กับ agent-initiated code changes ตาม model/language | completion acceptance กับ agent execution เป็นคนละ denominator; enterprise analytics เป็นคู่แข่งโดยตรง [Code generation](https://docs.github.com/en/copilot/how-tos/administer-copilot/view-code-generation) |
| Windsurf | Cascade hooks มี pre/post code/tool surfaces | ใช้ native hook แทน process-name inference; docs เดิม redirect ไป Devin desktop ต้อง pin compatibility [Cascade hooks](https://docs.devin.ai/desktop/cascade/hooks) |
| Cline | task มี ID/history/token-cost และ checkpoints; pause/resume ได้ | task boundary เป็น signal ดีกว่าการเว้นช่วง heartbeat; hooks page ที่ fetch มาไม่ให้รายละเอียดเพียงพอ จึงยังไม่รับรอง event schema [Tasks](https://docs.cline.bot/core-workflows/task-management) |
| Roo Code | มี checkpoints เพื่อเปรียบเทียบ/restore งาน | revert เป็น outcome ที่ต้องเก็บ; checkpoint ไม่เท่ากับ human rejection เสมอ [Checkpoints](https://roocodeinc.github.io/Roo-Code/features/checkpoints/) |
| OpenCode | plugin มี tool before/after, session status/error/idle และ permission events | เป็น connector candidate ที่จับ state ได้ตรงกว่า filesystem [Plugins](https://opencode.ai/docs/plugins/) |
| Aider | Git integration/auto-commit, diff/undo และ attribution metadata ปิดได้ | commit author/trailer เป็น hint ไม่ใช่ ground truth ครบทุก line [Git integration](https://aider.chat/docs/git.html) |
| VS Code Agents | มี debug logs, summary, agent-flow, token/error/duration และ OTLP export ใน preview | timeline อย่างเดียวไม่ใหม่แล้ว; จุดต่างต้องรวมข้ามเครื่องมือและทำ longitudinal analysis [Agent debugging](https://code.visualstudio.com/docs/agents/agent-troubleshooting/chat-debug-view) |
| JetBrains AI / Junie | agent ทำ multi-step edits/tests/terminal/debugging ได้ทั้ง IDE/CLI | editor focus และ file write อย่างเดียวพลาดงาน debug/review; first-party AtoAxis producer ยังไม่มี [Junie](https://www.jetbrains.com/help/ai-assistant/junie-agent.html) |
| Terminal / remote agents | tool lifecycle แยกจากหน้าต่าง editor; อาจทำงานตอนผู้ใช้ไม่อยู่ | local foreground tracker มองไม่เห็น cloud execution; ต้องมี collector ฝั่งรันและ authenticated topology [Cursor cloud hooks](https://prod.cursor.com/docs/hooks), [Codex telemetry](https://learn.chatgpt.com/docs/config-file/config-advanced) |

### 3.2 คู่แข่งเพิ่มเติมที่เปลี่ยนข้อเสนอ moat

**F:** Git AI มี Git Notes attribution, agent/model linkage, stats และประกาศ team durability/rework/session-to-production; Entire เชื่อม session/checkpoint กับ commit และเก็บ conversation context. ดังนั้น “AI blame”, “prompt→commit” หรือ “code survival” เพียงชื่อเดียว **ไม่ใช่ตลาดว่าง** ([Git AI](https://github.com/git-ai-project/git-ai), [Entire](https://entire.io/)).

**R:** ศึกษา import/interoperability กับ lineage standards ก่อนเขียน Git rewrite tracking ทุกแบบเอง ความต่างที่ควรพิสูจน์คือ metadata-only, หลักฐานที่คำนวณซ้ำได้, coverage ที่ไม่หลอก และการรวม human attention กับ agent outcomes ข้าม vendor

### 3.3 เราควรวัดอะไร

**I:** workflow เปลี่ยนจากพิมพ์→save เป็น specify→delegate→wait/parallel work→review→intervene→test→commit. เวลามากขึ้นหรือบรรทัดมากขึ้นจึงไม่ใช่ productivity มากขึ้นโดยอัตโนมัติ

| หน่วยวัด | นิยามที่ควรใช้ | Data วันนี้ |
|---|---|---|
| Human activity | union ของช่วง input/focus evidence ภายใต้ policy ที่ประกาศ | มีบางส่วน; ไม่ใช่ cognition/effort ที่วัดตรง |
| Agent execution | union ของ operation spans ที่มี start/end proof | มี segments บางส่วน; ไม่ครอบคลุมทุก tool |
| Wall time | end-start ของ session; แยก unknown gaps | มี session metadata แต่ boundary completeness ต่างกัน |
| Concurrent time | intersection(Human, Agent) | timeline core รองรับ union/overlap |
| Wait-for-human | ช่วง explicit permission request→decision/resume | ต้องเพิ่ม lifecycle events |
| Tool reliability | completed-success/fail/retry/aborted พร้อม denominator | edit parsers มีบางผล; generic execution events ยังไม่ครบ |
| Review / intervention | explicit review decision หรือ human edit overlap ที่มี provenance | ledger ไม่ได้ wire; editor focus ไม่พอ |
| Delivered outcome | user-confirmed result, exact commit link, test result, merged PR แยกสถานะ | commit-time association มี; exact links/CI outcomes ต้องเพิ่ม |
| Durability | generated cohort ที่ยังอยู่/เปลี่ยน/ลบ ณ age N โดยแยก unobserved | ยังไม่มี longitudinal lineage |
| Economic efficiency | observed spend per eligible confirmed outcome พร้อม coverage | spend มี; outcome denominator ขาด |

สูตรที่ต้องใช้ร่วมกัน: `combined = |H ∪ A|`, `overlap = |H| + |A| − |H ∪ A|`. ห้ามบวกเวลาหลาย agent เป็นชั่วโมงทำงานของ developer และห้ามเรียก session lifetime ว่า active coding time

## PHASE 4 — Feature Gap Matrix

ตารางนี้ใช้ ID เดียวกับ Phase 5–6. WakaTime `มี` = พบเอกสาร; `ไม่พบ*` = ไม่มีหลักฐานสาธารณะยืนยันครบตามนิยามที่เสนอ ไม่ใช่ absolute absence. Pain/value เป็น hypothesis รอ user pilot

| ID / Feature | Our Product | WakaTime | Modern workflow / pain | ความต่างที่ควรพิสูจน์ |
|---|---|---|---|---|
| F01 Work Session Receipt | timeline+Trust+evidence มี; workflow receipt ยังไม่มี | ไม่พบ* แบบรวมหลักฐานหนึ่งงาน | ตอบไม่ได้ว่า session นี้เกิดอะไร/เชื่อได้แค่ไหน | หลาย agent/human lane + evidence/unknown + user outcome |
| F02 Explain/correct attribution | มี repair/Trust แล้ว | ไม่พบ* public revision contract | ตัวเลขผิดแล้วตรวจ/แก้ลำบาก | ปรับ UX ของเดิม ไม่สร้าง repair อีกชุด |
| F03 Handoff bottlenecks | time/overlap มี; wait/intervention states ขาด | ไม่พบ* explicit cross-tool waiting | agent เร็วแต่ผู้ใช้เสียเวลารอ/แทรกแซง | อธิบายช่วงติดขัดพร้อมเหตุการณ์จริง |
| F04 Code survival cohorts | ledger scaffold; lineage ขาด | ไม่พบ* age/cohort/censoring contract | code ที่สร้างแล้วหายไปเท่าไร | 7/30d survival + missing observation ไม่ปน deletion |
| F05 Operation→commit lineage | temporal association เท่านั้น | commit analytics มี; exact lineage ไม่ยืนยัน | session ไหนนำไปโค้ดที่ commit จริง | explicit provenance edge ไม่ใช้เวลาบังเอิญตรงกัน |
| F06 Cost per outcome | tokens/cost มี; outcome ขาด | cost/efficiency มี | จ่ายแล้วส่งมอบอะไร | ระบุ eligible confirmed outcome และ allocation |
| F07 Runtime certification | catalog/self-test มี; cert ปัจจุบันขาด | plugins มี; public exact-tuple evidence ไม่พบ* | tool อัปเดตแล้ว tracker เงียบ | certified coverage ต่อ runtime และ test recipe |
| F08 OTel metadata intake | custom hooks/usage intake มี | tracking มี; generic intake contract ไม่พบ* | telemetry กระจัดกระจาย | normalize โดยตัด content ที่เครื่อง |
| F09 Consented team cohorts | consent+aggregate มีแล้ว | team/privacy controls มี | manager ต้องการข้อมูลที่เชื่อและทีมยอมใช้ | outcome/cohort พร้อม participation bias |
| F10 Context switching/focus | timeline มีฐาน | time/insight มี; exact focus semantics ไม่ยืนยัน | สลับงานระหว่างรอ agent | observable switches ไม่อ้างสมาธิภายใน |
| F11 Daily evidence summary | analytics มี; synthesized brief ไม่พบ | daily/weekly reports มี | ผู้ใช้ต้องรวบรวมงานจากหลาย tool | summary ทุกประโยคย้อนถึง receipt ได้ |
| F12 Reproducible evidence export | operation evidence/export foundations | export/API มี; reproducible receipt ไม่พบ* | audit metric ไม่ได้ | schema+formula+revision export โดยไร้ content |
| F13 Acceptance/rejection | clipboard/edit data ไม่ใช่ decision events | human follow-up มี; universal decision scope ไม่ยืนยัน | suggestion ถูกใช้จริงหรือไม่ | native decision denominator; ไม่อนุมานจากการลบ |
| F14 Task-stratified tool comparison | per-model usage มี | per-model efficiency มี | tool ไหนเหมาะกับงานชนิดใด | เปรียบเทียบใน cohort งานคล้ายกันพร้อม uncertainty |
| F15 Rework hotspots | line edits/revisions มี; outcome churn ขาด | follow-up มี | จุดไหนต้องแก้ซ้ำข้าม tool | trace operation/file cohort พร้อม reasons |
| F16 Multi-agent collision trace | conflict/topology core มี | ไม่พบ* workspace collision trace | agent เขียนทับกัน/หลักฐานกำกวม | parent/worktree/session graph ไม่กล่าวหาจาก path อย่างเดียว |
| F17 Coverage drift | diagnostics/certification มี | troubleshooting มี; drift series ไม่พบ* | ผลลดเพราะงานเปลี่ยนหรือ capture เสีย | compare capture health ก่อน effectiveness |
| F18 Migration reconciliation | resumable import+preflight มีแล้ว | export มี | ย้ายแล้วตัวเลขไม่ตรง | ปิด live reconciliation ของเดิม; core ไม่ใช่ moat |
| F19 Auto time-saved/ROI | ไม่มี counterfactual | efficiency claims ไม่พิสูจน์ causal savings | อยากรู้ว่าคุ้มไหม | ยังไม่ควรสัญญาผลลัพธ์ที่ไม่มี baseline |
| F20 Universal autonomy score | ขาด intervention denominator | ไม่พบ* standardized cross-tool score | อยากลดการดูแล agent | เก็บ observed rates ก่อนสร้างเลขคะแนนรวม |

หลักฐานฝั่งคู่แข่งอ้างตามนิยามใน Phase 2: [AI/team](https://wakatime.com/teams), [API/export](https://wakatime.com/developers), [plans/reports](https://wakatime.com/pricing). F04/F05/F14/F16 ยังเผชิญ Git AI/Entire และ native vendor analytics ตาม Phase 3 ด้วย

## PHASE 5 — Feature Candidates และ feasibility

ความยาก L/M/H; เวลาเป็น **A: engineer-days สำหรับ incremental prototype/MVP หลัง blocker สำคัญผ่าน** ไม่รวมเวลาสะสมข้อมูล/rollout. คะแนน user/enterprise/wow/moat 1–5 เป็น judgment ไม่ใช่ผลวิจัยตลาด และไม่ใช่ความมั่นใจทางสถิติ

| ID | Data ที่มี → Data ที่ต้องเพิ่ม | ยาก / MVP | User / Enterprise / Wow / Moat | ข้อจำกัดและการใช้ประโยชน์ |
|---|---|---|---|---|
| F01 | session+usage+segments+receipts → scoped join key, workflow grouping, outcome annotation | M / 12–18 วัน | 5/4/5/3 | เริ่มสอง agent; unmatched events ต้องอยู่ใน unresolved lane |
| F02 | repair revisions+reason → clear explanation/policy label | L / 3–5 วัน | 5/4/3/3 | ปรับของเดิม; user correction ไม่เป็น verified producer evidence |
| F03 | intervals+session → approval request/decision, pause/resume/failure | M–H / 12–20 วัน | 5/4/5/3 | OS idle ไม่บอกว่า user รอ AI; explicit wait เท่านั้น |
| F04 | ownership types+repo IDs → checkpoints, hunk lineage, recurring observations | H / 25–45 วัน + อายุ cohort | 5/5/5/5 | score moat เป็นโอกาสระยะยาว; ไม่มี observations ต้อง censored |
| F05 | operation IDs+commit windows → exact staged-hunk/commit edge | H / 15–25 วัน | 4/5/5/4 | squash/rebase/partial staging ต้อง preserve หรือบอก unresolved |
| F06 | usage/pricing → outcome ledger + allocation policy | M–H / 10–15 วันหลัง F01/F05 | 5/5/4/3 | token equivalent ≠ cash paid; failed attempts รวมอย่างชัดเจน |
| F07 | cert validators+fixtures+diagnostics → fresh runtime corpus/evidence | M / 4–8 วัน + field campaign | 4/5/3/4 | requirement ก่อน launch; ต้องรักษาทุก tool update |
| F08 | producer contract → allowlisted OTel adapters, IDs/retries, redaction tests | M / 8–12 วัน | 4/5/3/2 | ingestion protocol อย่างเดียว copy ง่าย; contents ต้องหยุดก่อน network |
| F09 | consent/membership+totals → eligible outcome cohort/sample threshold | M / 6–10 วันหลัง F01 | 4/5/3/3 | opt-in selection bias; ไม่จัดอันดับคนด้วย LOC/time |
| F10 | timeline/project/focus → context episode rules/user tags | M / 5–8 วัน | 3/3/3/2 | ไม่เท่ากับ cognitive focus หรือ productivity |
| F11 | summaries+receipts → deterministic brief + evidence refs | L–M / 4–6 วัน | 3/3/4/1 | เริ่ม template; LLM ไม่แก้ absence of task semantics |
| F12 | evidence/read+revision → export schema, calculation manifest, integrity check | M / 5–8 วัน | 4/5/3/4 | reproducible ไม่เท่ากับ tamper-proof endpoint attestation |
| F13 | edits/clipboard → proposal/accept/reject IDs ต่อ provider | H / 15–30 วันต่อ scope | 4/4/4/2 | native access จำกัด; unknown ไม่ใช่ rejected |
| F14 | model/project+cost → task type, outcomes, sample-size controls | H / 15–25 วันหลัง F04 | 4/5/4/4 | selection bias/model routing ทำให้ causal comparison ไม่ได้ |
| F15 | repeated file edits → lineage + reason/user labels | M–H / 10–15 วัน | 4/4/4/3 | repeated edits ไม่เท่ากับ defect; ใช้ observed churn |
| F16 | competing-evidence/topology → parent spans, worktree/file identity | H / 15–25 วัน | 4/5/5/4 | เสนอ potential collision ไม่สรุปว่าขัดแย้งจริงทุกครั้ง |
| F17 | diagnostic reasons/lag/cert tuple → per-version baseline/control limits | M / 4–7 วัน | 4/5/4/4 | capture reliability moat; ต้องแยก changed work mix |
| F18 | chunked import/dedup → large-file live acceptance + reconciliation UX | L / 3–5 วัน | 4/2/3/1 | acquisition gate ของเดิม ไม่สร้าง import ใหม่ |
| F19 | time/usage → comparable tasks/control/baseline/labor cost | H / 30+ วันวิจัย | 5/4/5/2 | ไม่มี data ที่พิสูจน์ saved hours; ตัวเลขสวยแต่เสี่ยงผิด |
| F20 | session activity → complete intervention/opportunity labels | H / 20+ วันหลัง F03 | 3/4/4/2 | aggregate score กลบความต่างของ policy/task complexity |

ข้อเสนอใหม่จริงคือ session-level evidence product, explicit handoff states และ longitudinal outcomes; F02/F07/F09/F17/F18 เป็นการทำของเดิมให้ใช้ตัดสินใจได้ ไม่อ้างว่าเป็น feature ใหม่ทั้งหมด

## PHASE 6 — Prioritization แบบตรวจสอบได้

### 6.1 เกณฑ์และน้ำหนัก

ใช้คะแนน 1–5: 1=ต่ำ/ยาก/ข้อมูลแทบไม่มี, 5=สูง/ทำง่าย/ข้อมูลพร้อม. คะแนน feasibility/time เป็น incremental effort หลัง dependencies; copy difficulty สูงแปลว่าคู่แข่งทำตามยาก

`Score /100 = Σ(weight × score /5)`

| P Pain | D Differentiation | F Feasibility | A Data available | T MVP speed | W Demo | C Copy difficulty | R AI relevance | $ Revenue | E Enterprise |
|---|---|---|---|---|---|---|---|---|---|
| 15 | 15 | 12 | 10 | 10 | 8 | 8 | 10 | 6 | 6 |

คะแนนทั้งหมดเป็น **A/R: structured decision model** ไม่ใช่ objective market measurement. ความมั่นใจ data/feasibility สูงกว่าความมั่นใจ pain/revenue เพราะยังไม่มี interview/conversion data

| ID | P | D | F | A | T | W | C | R | $ | E | /100 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | 5 | 4 | 4 | 4 | 4 | 5 | 3 | 5 | 4 | 4 | 85.0 |
| F02 | 5 | 3 | 5 | 5 | 5 | 3 | 3 | 5 | 3 | 4 | 84.0 |
| F03 | 5 | 4 | 3 | 2 | 3 | 5 | 3 | 5 | 4 | 4 | 76.6 |
| F04 | 5 | 4 | 2 | 1 | 1 | 5 | 5 | 5 | 5 | 5 | 73.8 |
| F05 | 4 | 3 | 3 | 2 | 2 | 5 | 4 | 5 | 4 | 5 | 71.4 |
| F06 | 5 | 3 | 3 | 2 | 2 | 4 | 3 | 5 | 5 | 5 | 72.4 |
| F07 | 4 | 4 | 5 | 5 | 5 | 3 | 4 | 5 | 3 | 5 | 86.8 |
| F08 | 4 | 3 | 3 | 2 | 3 | 3 | 2 | 5 | 4 | 5 | 67.0 |
| F09 | 4 | 3 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 5 | 75.0 |
| F10 | 3 | 2 | 4 | 4 | 4 | 3 | 2 | 4 | 3 | 3 | 63.8 |
| F11 | 3 | 2 | 4 | 4 | 4 | 4 | 1 | 4 | 3 | 3 | 63.8 |
| F12 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 5 | 4 | 5 | 81.6 |
| F13 | 4 | 2 | 2 | 1 | 2 | 4 | 2 | 5 | 4 | 4 | 58.0 |
| F14 | 4 | 3 | 3 | 2 | 2 | 4 | 4 | 5 | 5 | 5 | 71.0 |
| F15 | 4 | 3 | 3 | 3 | 3 | 4 | 3 | 5 | 4 | 4 | 71.0 |
| F16 | 4 | 4 | 2 | 2 | 2 | 5 | 4 | 5 | 4 | 5 | 72.0 |
| F17 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 5 | 83.2 |
| F18 | 4 | 1 | 5 | 5 | 5 | 3 | 1 | 3 | 3 | 2 | 65.4 |
| F19 | 5 | 2 | 1 | 1 | 1 | 5 | 2 | 5 | 4 | 4 | 58.2 |
| F20 | 3 | 2 | 2 | 1 | 2 | 4 | 2 | 5 | 3 | 4 | 53.8 |

### 6.2 Build Now / Next / Bet / Avoid

| กลุ่ม | Feature | เหตุผล / ลำดับ |
|---|---|---|
| **Build Now: release gates** | B01–B05/B08–B09, F07, F17 ขั้นต่ำ, F18 live verification | ความแม่นยำ/coverage/readiness มาก่อนคำขาย; ไม่ใช่ทำทุก UI ใหม่ |
| **Build Now: product** | **F01 Work Session Receipt** + F02 explanation และ F12 export ขนาดเล็ก | มี evidence/time/session foundations มากที่สุด และ demo คำตอบของงานหนึ่งชิ้นได้ |
| **Build Next** | F03 handoff, F08 เฉพาะสอง adapter, F09 cohort, F05 local commit link, F06 outcome cost, F11 digest | ต้องมี normalized session IDs/event coverage และ receipt ก่อน |
| **Strategic Bet** | F04 survival, F14 comparisons, F15 rework, F16 multi-agent trace | moat ต้องสะสม lineage/outcomes จริงและ normalize confounders |
| **Avoid / Not Yet** | F19 saved-hours/causal ROI, F20 universal score, F13 ทุก vendor, F10 deep-work เป็น flagship | ข้อมูลไม่รองรับหรือแตกต่างต่ำ; ไม่ใช่ห้ามทำตลอดไป |

F07 ได้คะแนนสูงสุดเพราะเป็นงานปลด blocker แต่ **F01 คือ flagship #1**. F17/F02 เป็นชิ้นส่วน trust ที่บรรจุใน F01 ไม่ควรแยกเป็นสามโครงการแข่งทรัพยากร. F04 มี strategic score ดีแต่ data=1 และ time=1 จึงผ่าน Build Now ไม่ได้

Hard gates เหนือคะแนน: (1) ไม่มี producer/denominator → ไม่อ้าง metric, (2) ไม่ได้ certify → beta/unsupported, (3) ไม่ผ่าน privacy/tenant isolation → ไม่เปิด team, (4) ถ้า competitor demo มี feature เทียบเท่า ต้องปรับ positioning ก่อนเพิ่ม scope

Sensitivity: การเปลี่ยน pain หรือ differentiation ของ F01 ลงหนึ่งระดับลดคะแนน 3 จุดต่อมิติ; หาก pilot ไม่เห็น pain จริง ให้ทำ release gates จบแล้วหยุดขยาย receipt ไม่ใช่ใช้คะแนนเดิมบังคับเดินต่อ

## PHASE 7 — 3 Feature ที่เปลี่ยนตำแหน่งผลิตภัณฑ์

ทั้งสามคือ product pillars ที่สร้างตามลำดับ ไม่ใช่คำสัญญาว่าส่งครบใน 30 วัน. รายละเอียดทั้งหมดด้านล่างเป็น **R** เว้นแต่ระบุว่า reuse ของเดิม

### Feature 1 — Work Session Receipt: หลักฐานการทำงานหนึ่ง session

Positioning: “อธิบายงานที่คุณทำร่วมกับ agent ด้วยหลักฐานที่ตรวจกลับได้”

| ข้อ | รายละเอียด |
|---|---|
| 1. Problem | มีหลายกราฟแต่ยังตอบยากว่า session นี้ agent ทำอะไร ผู้ใช้มีส่วนร่วมช่วงไหน ใช้ข้อมูลอะไรยืนยัน และจบด้วยอะไร |
| 2. User | Solo developer ที่ใช้ Claude/Codex ร่วม VS Code เป็นกลุ่มแรก; team lead ดูได้เฉพาะผู้ยินยอม |
| 3. Current alternative | เปิด agent history, Git, time dashboard และ cost dashboard เอง; vendor debug UI มีรายละเอียดใน tool ของตน |
| 4. Why WakaTime cannot solve it well | หลักฐานสาธารณะที่ตรวจยืนยัน aggregate analytics แต่ไม่ยืนยัน combined receipt contract; เป็น differentiation hypothesis ไม่ใช่ข้อจำกัดถาวรของ WakaTime คู่แข่งเพิ่มได้ จึงต้องทดสอบ workflow จริง |
| 5. Proposed solution | ต่อ timeline/Trust เดิมด้วย session card ที่แสดง human attendance, proven agent execution, unknown spans, tokens/cost coverage, operations, annotation ของผลลัพธ์ และ evidence drill-down |
| 6. User flow | ติดตั้ง/ตรวจ adapter → ทำงานตามปกติ → วันนี้/เลือก session → ดู lane + outcome → คลิกตัวเลขเห็นสูตร/หลักฐาน → export receipt; grouping ข้าม native sessions ให้ผู้ใช้ยืนยันก่อน |
| 7. Data required | tenant-scoped session/operation IDs, project+worktree, capture/event times, activity segments, usage_event_id, pricing version, evidence level, calculation version; เพิ่ม user outcome annotation |
| 8. Detection logic | native session ID เป็น primary; tool ID+mutation evidence เชื่อม operation; ไม่มี ID ให้ unmatched bucket ห้ามจับคู่จากเวลาอย่างเดียว; editor interval ใช้ overlap แสดง association ไม่อ้าง causation |
| 9. Backend changes | สร้าง receipt assembler/projection ที่ reuse canonical winner + activity timeline + usage service; แยก observed/estimated/unavailable ต่อ field; bind cursors กับ tenant/range/project/calculation |
| 10. Desktop changes | reuse broker/CLI queue และ delivery status; เพิ่ม opaque device/collector identity กับ capture-health snapshot; Tauri แสดง session card แบบเล็กได้ภายหลัง ไม่ต้อง rewrite OS tracker |
| 11. Database changes | ClickHouse `work_session_receipts` read model และ evidence membership; PostgreSQL `work_session_annotations`; map native→public opaque session ID; คง raw facts และ revisions สำหรับ rebuild |
| 12. Dashboard changes | เพิ่ม session drawer/card ใน Timeline พร้อม “Why counted?”, unresolved lane และ jump ไป Trust repair ที่มีแล้ว; อย่าสร้าง dashboard หลักใหม่อีกชุด |
| 13. API changes | เสนอ `GET /api/v2/me/work-sessions`, `GET .../:id/receipt`, `GET .../:id/evidence`, `PUT .../:id/annotation`; ใช้ scope เดิมอย่างเหมาะสมหรือเพิ่ม `read_work_sessions`; path เหล่านี้ยังไม่มี |
| 14. Edge cases | parallel agents, agent เปลี่ยน model, session ข้ามเที่ยงคืน, DST, sleep, offline retry, partial logs, tool abort, revision มาช้า, worktree/remote ต่างเครื่อง; single task อาจหลาย session จึงไม่รวมอัตโนมัติแบบมั่นใจเกินหลักฐาน |
| 15. Privacy concerns | ไม่ส่ง source/prompt/diff/output/title; IDs opaque และ scoped; annotation เป็นข้อความผู้ใช้ ต้องกำหนด retention/permission; org access ไม่เปิดโดยอัตโนมัติ |
| 16. MVP scope | macOS local + VS Code + Claude Code/Codex runtime ที่ certify เท่านั้น; native session receipt, time/usage/evidence/unknown, manual outcome; explicit span ที่ขาดไม่เติมด้วย session wall time; ไม่มี auto PR-success claim |
| 17. Future scope | cross-session task graph, remote collectors, tool/test outcomes, consented team rollup, receipt interoperability |
| 18. Demo scenario | งาน 20 นาทีมีคน 8 นาที agent 15 นาที overlap 3 นาที → combined 20 นาที; แสดง 1 operation ที่ unknown และเหตุผล; คลิก operation ที่ verified เห็น source/version; outcome เป็น user-confirmed แยกจาก test/commit proof |
| 19. Success metrics | A: pilot 10–15 คน ≥80% หาคำตอบว่าใครทำ/ข้อมูลหายตรงไหนได้ใน 60 วินาที; ≥50% ใช้ receipt ≥3 วันในสัปดาห์ที่สอง; release: replay ไม่เพิ่ม totals, unauthorized access=0, missing denominator ไม่มีค่าหลอก |
| 20. Competitive moat | UI copy ง่าย; edge-case corpus, cross-tool normalization, revisions และ session outcome history copy ยากกว่า ต้องสะสม quality labels และ workflow adoption; ยังไม่ใช่ moat สำเร็จในวันเปิดตัว |

นิยาม outcome ใน MVP: `user_confirmed`, `linked_commit`, `tests_passed`, `merged` เป็นหลักฐานคนละชนิด ไม่เอา `agent stopped` ไปแปลงเป็น `task succeeded`. เริ่มที่ user confirmation แบบ optional และ explicit local link เท่านั้น

### Feature 2 — Human–Agent Handoff Analytics: งานติดขัดตรงไหน

Positioning: “แยกเวลาที่ agent ทำงานจากเวลาที่รอการตัดสินใจ และหาจุดที่คุณต้องกลับเข้าไปช่วย”

| ข้อ | รายละเอียด |
|---|---|
| 1. Problem | เวลารันรวมไม่บอกว่าช้าเพราะ tool, retry, permission wait หรือ human review; แก้กระบวนการไม่ได้จาก token chart |
| 2. User | developer ที่ใช้ agent หลาย session และ lead ที่ต้องปรับ workflow/policy |
| 3. Current alternative | อ่าน event logs หรือ vendor debug views เอง; time tracker แสดงเวลารวม |
| 4. Why WakaTime cannot solve it well | public duration/follow-up metrics ที่พบไม่ยืนยัน wait-state contract ข้าม vendor; แต่ native tools มี telemetry แล้ว และ WakaTime เพิ่มได้ จึงต้องชนะที่ normalization และ usability |
| 5. Proposed solution | state timeline `executing / awaiting_approval / paused / failed / completed / unknown`; แสดง waits และ intervention counts ที่มีหลักฐาน ไม่ออก autonomy score รวมใน MVP |
| 6. User flow | เปิด receipt → ดู bottleneck ที่สังเกตได้ → คลิก wait เห็น request/decision IDs แบบ metadata → ดูก่อน/หลังปรับ workflow; การเปรียบเทียบเป็น descriptive |
| 7. Data required | span/parent IDs, tool kind, start/end, success/error class, permission_requested/decided, user-vs-policy decision, pause/resume, collector sequence; โดยมากต้องเก็บใหม่ |
| 8. Detection logic | request/decision ต้องจับคู่ด้วย stable ID; duplicate delivery idempotent; auto-approve แยกจาก manual; missing end→right-censored/unknown; ถ้าเครื่องหลับไม่เติม duration ต่อถึงตอนนี้ |
| 9. Backend changes | versioned lifecycle normalizer + state machine + reconciliation; reuse broker identity/queue; track invalid transition และ unmatched event rates |
| 10. Desktop changes | เพิ่ม metadata allowlist adapter สำหรับ hook/OTel ที่ runtime รองรับ;ไม่เก็บ shell command/output; ไม่ใช้ idle เป็น waiting proof; reader ปิดได้ |
| 11. Database changes | `agent_spans`, `agent_state_events`, projection `session_bottlenecks`; partition by tenant/time; session/end revisions และ linkage quality |
| 12. Dashboard changes | เพิ่ม lane ใน receipt เดิม, wait waterfall, coverage badge, tool error categories; team aggregate ต้องผ่าน consent |
| 13. API changes | `POST /api/v2/agent-events/bulk`, `GET .../work-sessions/:id/bottlenecks`; bounded batch/size, idempotency และ write scope แยก; เป็น proposed routes |
| 14. Edge cases | approvals จาก policy, denied/cancelled, retry เดิมคนละ attempt, background terminal child, subagents, tool calls ซ้อน, permission event ส่งไม่ครบ, network skew |
| 15. Privacy concerns | approvals/tool names อาจบอกพฤติกรรม; เก็บ enum/counter แทน args; ไม่แสดง individual waiting ให้ manager โดยไม่ได้ยินยอม; telemetry output snippet ถูกลบทิ้งที่ต้นทาง |
| 16. MVP scope | สอง certified adapters และเฉพาะ events ที่มี documented IDs; tool runtime, error class, explicit approval wait; human-review time ไม่วัดถ้าไม่มี explicit mode/confirmation |
| 17. Future scope | subagent critical path, workload-specific interventions, human edit overlap หลัง lineage พร้อม, policy experiments |
| 18. Demo scenario | session 12 นาที: tool execution 4 นาที, explicit approval wait 5 นาที, unknown gap 3 นาที; user เห็นว่าช้าตรง approval ไม่ใช่ model พร้อม event pair ให้ตรวจ |
| 19. Success metrics | ≥95% lifecycle pairs match ใน certified scripted corpus; p95 captured wait-boundary error ≤2 วินาทีใน local fixture/live script; pilots ชี้ bottleneck actionable ได้ ≥70%; ไม่ใช้ % เวลาลดเป็น causal claim |
| 20. Competitive moat | intervention dataset ที่ normalize approval policies/tasks และสัมพันธ์ผลลัพธ์; raw tool-duration dashboard อย่างเดียว moat ต่ำ |

ข้อจำกัดสำคัญ: “ไม่มี human input ระหว่าง agent run” ไม่เท่ากับ “ประหยัดเวลาคนเท่านั้น”; ผู้ใช้อาจอ่าน คิด หรือทำงานอื่น ไม่มีข้อมูลพอวัด counterfactual savings

### Feature 3 — Code Outcome Lineage: จากการแก้ของ AI ไปสู่ผลที่คงอยู่

Positioning: “ตามผลของงานที่ AI ทำจนถึง commit และการแก้ในภายหลัง โดยบอกช่วงที่สังเกตไม่ได้”

| ข้อ | รายละเอียด |
|---|---|
| 1. Problem | AI สร้างบรรทัดมากไม่ได้แปลว่ามีโค้ดที่ใช้จริง; follow-up edit อย่างเดียวแยก maintenance/rework/requirement change ไม่ได้ |
| 2. User | team lead/EM ที่เลือก tools/workflows; developer ที่ต้องการเรียนรู้ว่า delegation แบบใดได้ผล |
| 3. Current alternative | Git blame/history, vendor commit analytics, Git AI/Entire; ต้องพิสูจน์ incremental value เหนือเครื่องมือเหล่านี้ |
| 4. Why WakaTime cannot solve it well | commit-time/follow-up metrics ไม่ยืนยัน cohort survival contract ตามที่เสนอ; การตาม line state ต้องมี lineage ledger เพิ่ม แต่ไม่ใช่อุปสรรคที่คู่แข่งทำไม่ได้ |
| 5. Proposed solution | verified operation→local checkpoint→staged hunk→commit graph; cohort 7/30d แสดง retained/modified/deleted/unobserved และ cost allocation coverage |
| 6. User flow | opt-in repo → collector ตรวจ baseline → ทำงาน/commit ปกติ → receipt แสดง committed/uncommitted → เมื่อครบอายุ cohort ดู durability พร้อม exclusions → drill down local evidence |
| 7. Data required | operation ID, opaque file ID, local before/after/checkpoint hashes, span mapping, commit/tree parents, rename/rewrite mapping, observation watermark, actor provenance; เก็บใหม่เป็นส่วนใหญ่ |
| 8. Detection logic | ทำ diff/line mapping บนเครื่อง; update ledger ทุก mutation; commit match เฉพาะ staged ranges; mixed/ambiguous→unknown; at age N ต้องมี observation ครบ; whitespace/refactor policy versioned |
| 9. Backend changes | ingest only lineage metadata/aggregates; build cohort eligibility, censoring และ cost denominator; account deletion ลบ lineage edges/projections ทั้งหมด |
| 10. Desktop changes | durable local ownership ledger จาก scaffold เดิม; Git checkpoint listener/explicit command; explore Git AI metadata import ก่อนสร้าง rewrite engine; source ใช้ประมวลผล local เท่านั้น |
| 11. Database changes | `code_change_cohorts`, `lineage_edges`, `cohort_observations`; user/repo scope + policy version + watermark; PostgreSQL consent/settings; ClickHouse aggregates |
| 12. Dashboard changes | Generated→Committed→Observed at day N funnel; survival bands/coverage และ reasons; ห้ามเรียก deleted=bad หรือ retained=correct |
| 13. API changes | `POST /api/v2/lineage-events/bulk`, `GET /api/v2/me/code-outcomes`; schema version, observation states และ line vs operation denominators ชัดเจน |
| 14. Edge cases | partial staging, mixed author hunks, rename/move, formatter, rebase/squash/cherry-pick, generated files, no Git, branch deleted, collector offline, repo คนละเครื่อง, model switch |
| 15. Privacy concerns | file/hunk hashes ยังเป็น linkable metadata; ใช้ tenant/device-scoped HMAC/local mapping แทนส่ง content hash ดิบถ้าไม่จำเป็น; ไม่มี prompts/source upload; cross-user linkage opt-in เท่านั้น |
| 16. MVP scope | repo opt-in, local supported Git subset, verified AI edit→commit + observed 7d cohorts; unsupported rewrites เป็น unresolved; เก็บ field ที่รองรับ 30d แต่ยังไม่อ้างผลจน observation ครบ |
| 17. Future scope | 30/90d cohorts, CI/PR links, rewritten semantics, task-stratified comparisons และ cross-tool economics; ไม่สร้าง “quality score” จาก survival อย่างเดียว |
| 18. Demo scenario | fixture ที่ระบุชัดว่า synthetic: AI-added 100 lines, ติดตามครบ 80, retained 48, modified 20, deleted 12, unobserved 20 → observed-cohort retention 60%, coverage 80%; ไม่แสดง 48% โดยซ่อน missingness |
| 19. Success metrics | checkpoint→commit linking precision/recall จาก independent corpus; supported Git cases preserve attribution after replay; ≥90% observation coverage ใน pilot repo; decision-useful interviews; ไม่มี universal superiority claim |
| 20. Competitive moat | สะสม longitudinal lineage+task context+intervention+outcome หลายเดือนในข้อมูลที่ได้รับอนุญาต; ประวัติที่ไม่เคยเก็บย้อนหลังสร้างไม่ได้ แต่มีคู่แข่งเก็บอยู่แล้ว ต้องชนะ implementation/trust/distribution |

การตัดสินใจ build/buy: ให้ spike 3–5 วันเทียบ local ledger เดิมกับ Git AI export/standard ใน repo fixture ที่ไม่มีข้อมูลผู้ใช้ เลือก integration ถ้าลด Git edge-case work โดยยังคง metadata-only contract; ไม่ติดตั้ง/เชื่อม service เพิ่มใน audit นี้

## PHASE 8 — ความแม่นยำ Human/AI และ Agent Detection

### 8.1 ระดับความแม่นยำปัจจุบัน

**ยังรายงาน accuracy เป็นเปอร์เซ็นต์ไม่ได้อย่างซื่อสัตย์** มี deterministic tests และหลักฐานเก่า แต่ไม่มี labeled ground-truth confusion matrix ของ build ปัจจุบันที่ครอบคลุม exact runtime tuples

สิ่งที่ยืนยันได้: rules ตั้งใจ abstain เมื่อไม่มีหลักฐาน; named AI มาจาก source ที่ชัด; append-only revisions และ duplicate suppression มี implementation/tests. นี่เป็นฐานที่ดีต่อ precision แต่ **coverage/recall ยังไม่ยืนยัน** และ human line observation ของ VS Code ปัจจุบันมีข้อจำกัดชัดเจน

Historical duration artifact มี status pass และเปรียบเทียบ WakaTime แต่ผูก commit เก่า `5d310ae…` และวันที่ 30 สิงหาคม 2026 ไม่ใช่ build ที่ audit; อีกทั้ง parity กับ WakaTime ไม่ใช่ independent accuracy. แผนสถานะเดิมระบุเองว่า fresh seven-day campaign ยังไม่ได้ทำ [C20]

### 8.2 Failure-mode matrix

| Signal / scenario | สิ่งที่โค้ดทำ | False positive / negative หรือ blind spot | สิ่งที่ต้องพิสูจน์/ปรับ |
|---|---|---|---|
| AI code ถูกนับ human | unmatched editor changes เป็น unknown; matched operation ระงับ duplicate counters | ถ้า downstream/UI เรียก human attendance ว่า code ownership จะผิดความหมาย; legacy clients อาจ evidence ต่างกัน | แยก activity actor กับ line actor และแสดง source support |
| Human code ถูกนับ AI | มี conflict rules และ sidecar match restrictions | edit รูปร่างเหมือนกัน/เวลาใกล้กับ agent ในไฟล์เดียว; verified evidence precedence ต้องระวัง mixed edits | fixture concurrent manual+AI, fingerprint/operation ID แทน delta/time อย่างเดียว |
| Human ถูกนับ unknown | buffer ไม่ส่ง human line counts; generic editor change ไม่พิสูจน์ authorship | เป็น abstention ที่ถูกหลักฐานแต่ลด usefulness ของ Human % | อย่าปรับ unknown→human; instrument positive human provenance เฉพาะ API ที่พิสูจน์ได้ |
| Native agent edits | Claude/Codex parser รอ completion/mutation evidence; failed calls ไม่ควรนับ | parser schema เปลี่ยน/late result/unsupported shell mutation → FN | certify CLI/Desktop แยก, tool-version matrix และ mutation modes |
| Terminal agents | process/session/hooks/transcripts รองรับบาง tool | script heredoc/sed/python writes, nested process, cwd missing, detached job อาจหลุด | before/after snapshots + completed tool identity + exclusion tests |
| Background process | process observer ให้ presence ไม่ให้ authorship; whole-word matching แก้ CursorUIViewService case | เปิด tool ทิ้งไว้ไม่ควรเป็นเวลาทำงาน; ชื่อ process บางตัว unverified | negative corpus: idle/open tool/build/watch processes |
| Cline/Roo inside editor | process observer ระบุชัดว่าไม่เห็น extension เป็น process แยก | FN หากคาดหวัง universal detection จาก process scan | native hooks/plugin events; อย่าใช้ process-name promotion |
| Filesystem writes | watcher + fingerprint + broker reconcile; unresolved external event active_seconds=0 | formatter/codegen/git checkout ไม่ใช่ AI; watcher missed/coalesced/restart | system-actor lane, generated-file policy, watcher loss counters |
| Git events | commit analytics ใช้ window/project/branch | commit author หรือเวลาใกล้กันไม่พิสูจน์ AI line ownership | exact staged lineage; ป้าย association ในของเดิม |
| Window focus | Desktop app heartbeat human; title consent; VS Code focus callbacks | mouse activity/reading/agent view ≠ typing; title signal ≠ project proof | attendance เป็นอีกมิติ, machine identity, no line attribution from focus |
| Idle / time | 15-second editor lease และ canonical union/bridging มี; AI session capped last_event | idle policy คนละนิยามกับ comparable time; completion-only ไม่มี duration | live sleep/lock/long-think/read scenarios; แสดง strict/comparable แยก |
| Multiple agents | competing verified/inferred evidence ไป unknown ใน correlation engine | same file/time ไม่พอ identify owner; alias/delayed metadata อาจ conflict | session/tool/file scoped identity, worktree ID และ revisions |
| Model/provider attribution | known-agent allowlist, turn/message context, identity reasons | tool จริงแต่ model ไม่รู้; auto routing และ stale context | keep null/partial; ห้าม fallback เป็น model ล่าสุด |
| Offline / retry | local durable queue, IDs, revision winner | killed sampler pending in-memory intents/late flush ต้องทดสอบ; queue status ไม่ใช่ server confirmation | kill/restart/network outage/dedupe campaign พร้อม independent sent/accepted IDs |
| Remote/container/cloud | topology/handoff contracts และ tests มี | local collector ไม่เห็น remote FS/process; host path mappingผิด | exact topology certification และ collector-local timestamps/sequence |
| Human follow-up | ledger/local persistence + server event count มี | ไม่มี live caller/eligible denominator; interval shift ไม่พอพิสูจน์ code survival | wire producer, full-deletion/rename/observation policy, mature cohort |

### 8.3 Ground-truth protocol ก่อนใช้ AI Coding Intelligence เป็นคำขาย

1. **กำหนด tuple:** adapter/tool version, CLI vs desktop vs extension, OS/arch, local/remote, producer bundle digest, parser schema, calculation version; cert หนึ่ง tuple ไม่ครอบทั้งหมด
2. **ชุด positive:** native patch/create/delete/rename, shell-generated files, inline accept ที่รองรับ, multi-file edit, partial failure, repeated operations และ model switch
3. **ชุด negative:** manual typing/paste, formatter, build output, git checkout/merge, idle process, background agent ใน repo อื่น, no-change tool/read-only session
4. **ชุด mixed:** manual+AI ไฟล์เดียวกัน, concurrent agents/worktrees, delayed sidecar, missed start/end, retry/replay, log truncation/rotation, sleep และ offline
5. **Oracle แยกจาก tracker:** scripted action log และ before/after diffs ที่ local fixture ไม่ใช้ output classifier เองเป็น truth; label agent, mutation, event/line/time คนละแกน
6. **รายงาน per tuple:** AI precision=`TP/(TP+FP)`; AI recall=`TP/(TP+FN+AI-abstentions)` ถ้าแยก abstentions ออกจาก FN; ระบุ convention เพื่อไม่ double-count. รายงาน human confusion, abstention rate, identity completeness และ capture coverage แยกกัน
7. **Denominator coverage:** attributed observed changes / all observed changes ไม่เท่ากับ all actual changes. เปรียบเทียบกับ oracle เพื่อวัด lost-event rate อีกค่า
8. **Release target (R):** เริ่ม ≥100 positive และ ≥100 negative scripted cases ต่อ supported tuple, critical negative cases ไม่เกิด verified false positive, รายงาน Wilson interval; หาก upper FP bound ยังสูงต้องเพิ่ม sample. “0 ใน 100” ยังยืนยัน FP<1% ไม่ได้
9. **Time campaign:** 7 วันจริง มี independently observed active intervals; WakaTime comparison เป็น compatibility track ต่างหาก. กำหนด allowed error จากนิยาม strict/comparable ก่อนดูผล ไม่ tune เพื่อชนะตัวเลขคู่แข่ง
10. **ล้มเหลวอย่างโปร่งใส:** unsupported shape→unknown พร้อม reason; adapter ใหม่ไม่ผ่าน cert ห้ามยกระดับ verified อัตโนมัติ

Tests ที่ผ่านยืนยันว่า rules ทำงานตาม fixtures ไม่ได้ยืนยันว่าทุก native tool version ส่ง signal ตามสมมติฐาน

## PHASE 9 — Moat ที่สะสมได้ใน 3–6 เดือน

### 9.1 Moat ที่มีโอกาสจริง

| Dataset | สิ่งที่เพิ่มเมื่อใช้ต่อเนื่อง | Insight ที่สร้างได้ | สิ่งที่ทำให้ copy ยาก / ข้อจำกัด |
|---|---|---|---|
| Runtime ground-truth + failure corpus | labeled edge cases/tool versions/OS/topologies | adapter regression warning และ evidence reliability ที่แยก coverage | ใช้แรงภาคสนามและ maintenance; คู่แข่งมี distribution ใหญ่กว่า ต้องโฟกัส scope |
| Session→intervention→outcome | explicit waits/retries/decisions + user outcome | workflow ใดต้องดูแลสูง; ช่วง handoff ที่ควรปรับ | raw cost chart สร้างไม่ได้ แต่ task/policy confounders ต้องเก็บ |
| Generated→committed→aged observations | lineage histories/watermarks 7/30/90d | survival/churn แยกตาม repo/task/tool | ย้อนหลังสร้างช่วงที่ไม่เคยสังเกตไม่ได้; Git AI เป็นคู่แข่งตรง |
| Developer baseline ส่วนบุคคล | episode patterns และ annotations จากเจ้าของข้อมูล | workflow drift ของตนเอง ไม่ใช่ ranking คน | customization history เพิ่มคุณค่า; ห้ามอ้างเรียนรู้ความสามารถคนจาก LOC |
| Consented team cohorts | coverage-normalized aggregates และ task mix | effectiveness patterns พร้อม sample size | ต้องได้รับสิทธิ์ใช้ข้อมูลเพื่อ benchmarking แยก; มี selection bias และ re-identification risk |
| Correction / disagreement corpus | producer evidence vs user corrections + adjudication | metric debugging และลด systematic misclassification | self-reported labels ไม่ใช่ truth; ห้ามเอา manual repair กลับไปเพิ่ม precision โดยอัตโนมัติ |

### 9.2 Learning loop ที่ควรสร้าง

`capture → explain uncertainty → optional user clarification → preserve original evidence + correction → validate on held-out corpus → improve adapter/rule → versioned recalculation`

เริ่มจาก deterministic rules และ per-user descriptive baselines ไม่จำเป็นต้องมี ML model ตั้งแต่เดือนแรก. สิ่งที่ “ฉลาดขึ้น” ต้องวัดได้เป็น lower mismatch rate, better supported coverage, faster diagnosis หรือคำแนะนำที่ผู้ใช้ทำตามแล้วประเมินว่ามีประโยชน์

### 9.3 สิ่งที่ไม่ใช่ moat

- token/cost charts, AI summary ทั่วไป, LOC share และ leaderboard: สร้างซ้ำได้และคู่แข่งมีฐานข้อมูลอยู่แล้ว
- เก็บข้อมูลเยอะโดยไม่รู้ missingness: สะสม bias ไม่ใช่ความได้เปรียบ
- schema proprietary โดยห้าม export: สร้าง friction มากกว่าความเชื่อถือ
- “metadata-only” เป็นประโยชน์ด้าน adoption แต่ต้องพิสูจน์และยัง copy ได้
- unknown ต่ำลงเพราะเดาคำตอบมากขึ้น: metric ดูดีแต่ precision เสีย

### 9.4 Commercial model ที่ควรทดสอบ

**A:** กลุ่มแรกคือ developer ที่ใช้ ≥2 AI tools ต่อสัปดาห์และมีปัญหาเข้าใจ time/cost/outcomes; buyer ถัดไปคือ lead ของทีม 5–30 คนที่มีความยินยอมในการแชร์ข้อมูล

**R:** ให้ personal tracking/coverage explanation เป็นฐาน; ทดลองเก็บเงินกับ longer outcome history, team cohort และ evidence export/integration. สัมภาษณ์ willingness to pay ด้วย demo/paid pilot ก่อนลงทุน billing/SSO ทั้งชุด. ตัวเลขราคาของคู่แข่งใช้เป็น reference ไม่ใช่หลักฐานว่าลูกค้าจะจ่ายเราเท่ากัน

Success evidence ที่ต้องขอจาก pilot: ผู้ใช้เปลี่ยนการตัดสินใจอะไรจาก insight, ใช้ซ้ำกี่ครั้ง, ยอมจ่ายเพื่ออะไร และจะเลิกใช้ dashboard เดิมส่วนใด. ไม่จำเป็นต้องบังคับให้ uninstall WakaTime วันแรก; parallel comparison ลด switching risk

## PHASE 10 — Product Strategy Decision และแผนพัฒนา

### 10.1 สิ่งที่ควรหยุดทำ

1. หยุดวาง AI %, token charts, prompt-length chart หรือ desktop tracking เป็น unique selling point โดยไม่เทียบของปัจจุบัน
2. หยุดเปิดพื้นที่ product ใหม่ที่ไม่เกี่ยวกับ evidence/outcome เช่น gamification/leaderboard/coworking เพิ่ม ก่อน core pilot ผ่าน
3. หยุดขยายชื่อ adapter ทุก tool ขณะที่ exact-runtime certification ของสองตัวหลักยังไม่ครบ
4. หยุดเรียก lines/token หรือ human follow-up ว่า quality/productivity/ROI โดยอัตโนมัติ
5. หยุดเริ่มใหม่กับ Timeline, Trust Center, repair, consent หรือ import ที่มีแล้ว; ทำ incremental integration
6. หยุดใช้ feature matrix หรือ unit test pass เป็น production readiness

### 10.2 สิ่งที่ควรแก้ก่อน

ลำดับ **B01/B02 → B04/B05/B09 → B08 → receipt joins → field gates**. B03 ไม่ต้องทำ full follow-up ในเดือนแรก ให้แก้ capability/UX ว่ายัง unavailable แล้ววาง ledger ใน Feature 3. B06 เก็บ fail-closed จนมี end-to-end implementation; B07 แก้ labeling/contract ก่อนสร้าง lineage

### 10.3 Next Killer Feature: Work Session Receipt

- **ทำไม feature นี้:** reuse ส่วนที่ลงทุนไปแล้วสูงสุด, ตอบคำถามหนึ่งงานแทนแสดงหลายกราฟ, มีทางพิสูจน์ด้วย task-completion test
- **ทำไมตอนนี้:** ตลาดมี AI usage dashboards แล้ว; โอกาสคือความเข้าใจที่ตรวจสอบได้ข้ามเครื่องมือ ก่อนแข่งขันใน outcome dataset ที่ยังต้องเก็บเพิ่ม
- **ทำไม user จะสนใจ:** ลดเวลาหาว่า session ไหนคุ้ม/ข้อมูลไหนผิด/ต้องกลับไปดูอะไร เป็น hypothesis ที่ตรวจได้ใน pilot
- **WakaTime เสียเปรียบตรงไหน:** เฉพาะกรณี paid demo ยืนยันว่าไม่มี workflow/evidence contract เทียบเท่า; ไม่มีหลักฐานว่าคู่แข่งถูกล็อกด้วย architecture. ข้อได้เปรียบของเราคือเริ่มจาก canonical evidence/repair ที่มีแล้วและโฟกัส niche
- **MVP:** native session grouping, human/agent overlap, reported/estimated/unknown labels, operation drill-down, outcome annotation, metadata receipt export, exact-runtime support matrix
- **ไม่อยู่ใน MVP:** raw prompts, universal code authorship, autonomous productivity score, causal time saved, full Git survival, all editors/cloud environments

### 10.4 Demo 60 วินาที

| เวลา | สิ่งที่แสดง | สิ่งที่ต้องพิสูจน์ |
|---|---|---|
| 0–10s | เลือก session ของงานตัวอย่าง | project/session identity ไม่จับรวมผิด |
| 10–25s | human 8m / agent 15m / overlap 3m / combined 20m | การนับเวลาทับกันไม่เพิ่มชั่วโมงปลอม |
| 25–40s | คลิก verified operation และ unknown operation | เห็น source, method version, reason ที่อ่านรู้เรื่อง |
| 40–50s | token/cost coverage และ outcome label | estimated price แยก actual bill; user-confirmed แยก test proof |
| 50–60s | export metadata receipt / jump to correction history | คำตอบตรวจกลับได้และไม่มี prompt/source หลุด |

ใช้ deterministic synthetic demo dataset จนมี consented real capture ที่ตรวจแล้ว; อย่านำ synthetic demo ไปอ้าง accuracy หรือ ROI. ถ้า demo ใช้แค่ AI pie chart ให้ถือว่ายังไม่ได้แสดงความต่าง

### 10.5 30-Day Product Roadmap

**A — capacity:** 2 engineers full-time รวมประมาณ 40 engineer-days ใน 4 สัปดาห์ และ PM/UX/QA part-time. กัน buffer 6–8 วันสำหรับ integration/runtime issues. ถ้ามีคนเดียว ให้ทำ release gates + receipt แบบหนึ่ง adapter ภายในเดือนแรก และเลื่อนงานที่เหลือ ไม่ลดเกณฑ์ความซื่อสัตย์ของ metrics

| สัปดาห์ | Deliverables / งานที่ทำ | Dependency | Acceptance / evidence |
|---|---|---|---|
| **Week 1: สัญญาข้อมูลและความจริง** | แก้ B04/B05/B09; แยก line/time actor semantics B02/B08; contract receipt-v1; freeze 2 runtime tuples; เตรียม negative/mixed corpus และเริ่ม seven-day field capture; สัมภาษณ์ 5 users + ตรวจ competitor demo | baseline code และ local tests | unknown/zero denominator คืน null; unsupported metric ไม่แสดง available; เขียนนิยาม time/coverage; actual capture มี build digest |
| **Week 2: Capture→receipt** | scoped session IDs; receipt assembler จาก canonical+usage; API pagination; device identity; out-of-order/replay tests; lifecycle spike ของ Feature 2 เฉพาะ documented events | Week 1 contract | same-event retry totals คงเดิม; cross-user/project access ไม่ผ่าน; partial metadataไม่กลายเป็น zero; field campaign ครบ 7 วันแต่ยังต้อง review |
| **Week 3: ใช้งานจริงใน Dashboard** | session drawer ใน timeline; explanation link ไป Trust; user outcome annotation; bounded metadata export; minimal health/drift; pilot 5–10 users | Week 2 API | demo tasks ผ่าน, no raw content in export, paginationไม่เปลี่ยน totals, recalc revisions stable, permission withdrawal tests ใน isolated PG/CH |
| **Week 4: Validate / decide** | วิเคราะห์ field corpus, latency/coverage; pilot รวม 10–15 คน; reconcile large import; fix critical bugs; lineage integration spike 3 วันเมื่อ gates ผ่าน; limited beta release เฉพาะ tuples ที่ผ่าน | Week 3 + runtime certification | signed-off evidence bundle, ≥80% demo comprehension target, repeated-use signal; fail gate→คง beta/ลด scope; ยังไม่เปิด full enterprise/30d survival |

Day 29–30: สรุป pilot decision, triage, release notes และ backlog รอบต่อไป. **ไม่อ้างว่าเก็บ 30-day code survival ได้ครบในเดือนที่เพิ่งสร้าง collector**

Dependency chain: `metric semantics + certification → scoped session evidence → receipt API → receipt UX/export → lifecycle states → intervention analytics → exact Git lineage → mature outcome cohorts → tool comparisons`

### 10.6 Development tickets ที่หยิบทำได้ทันที

| Ticket | Owner | จุดแก้/เพิ่ม | Definition of done |
|---|---|---|---|
| P0-01 Metric null/coverage | Backend | `handlers/v2.rs::ai_effectiveness`, usage/coverage types | zero AI lines → per-line metrics null; no activity≠0% measured; usage coverage ตรงกับ counters; test no-data/partial/mixed |
| P0-02 Capability truth | Backend + UI | `feature_available`, feature matrix, AI/Trust pages | แยก follow-up events available กับ rate unavailable; runtime disabled ไม่มี CTA ที่สัญญาใช้งานได้ |
| P0-03 Human evidence labels | Extension + UI | VS Code `buildPayload`, AI presenters | ไม่เติม human lines โดยเดา; แยก attendance/line provenance; denominator/unknown ชัดในทุกหน้า |
| P0-04 Live certification | QA/Client | scripts/ai-coverage + adapter catalog | independent labeled fixtures, exact tuple/build digest, negative/mixed cases, accuracy/abstention report; cert promotion only passing scope |
| P0-05 Time truth | QA/Backend | activity_timeline + scripts/duration-audit | seven-day independent reference และ WakaTime parity แยกไฟล์; overlap/sleep/offline invariants |
| P1-01 Session identity | Client/Backend | core events, broker, heartbeat/usage ingress | tenant+collector+native session stable; opaque public ID; unmatched joinsไม่หาย; ไม่มี universal model fallback |
| P1-02 Receipt projection | Backend | new `services/work_sessions.rs`, repository read model | aggregate canonical winners; revision replay; coverage fields; rebuild produces same result |
| P1-03 Receipt endpoints | Backend | v2 routes/types | bounded keyset pagination, range/project/tenant scope, null semantics, authorization tests |
| P1-04 Receipt drawer | Frontend | timeline + Trust components | task→evidence flow ≤60s ใน pilot; empty/partial/error states; ไม่มี heartbeat%=code% label |
| P1-05 Outcome annotation | Full stack | new PG migration + UI | `user_confirmed` แยก measured result; audit/change history; user can retract |
| P1-06 Metadata export | Full stack | receipt JSON schema + UI download | no prompt/source/path/raw output; include method/version/coverage; export reproducible within declared scope |
| P1-07 Field onboarding | Product/QA | existing import/editor migration check | large export reconcile/retry; unsupported editor scope clear; first valid receipt success tracked |
| P2-01 Lifecycle pilot | Client | two OTel/hook adapters | allowlisted request/decision/tool span metadata; pair completeness and redaction acceptance |
| P2-02 Lineage spike | Client/Backend | local follow_up ledger + Git AI interoperability fixture | written build-vs-integrate decision; partial staging/rename/rewrite limitations; no runtime rollout yet |

### 10.7 Release / kill criteria

- **Release:** metric semantics ผ่าน, no double-count replay, isolation/consent ผ่านใน services จริง, supported tuples มี fresh evidence, privacy payload review ผ่าน และ pilot เข้าใจข้อมูลได้ตามเกณฑ์
- **Narrow:** ถ้า human authorship ยังพิสูจน์ไม่ได้ ให้ขาย session evidence/known AI+unknown ไม่ขาย exact human code percentage
- **Pause expansion:** ถ้า user ไม่ใช้ receipt ซ้ำ หรือ competitor มี equivalent workflow และเราไม่ลดเวลาหาคำตอบ ให้หยุดเพิ่ม visualization แล้วใช้ interview หางานที่ยังแก้ไม่ได้
- **Expand:** เมื่อ receipt มี repeat usage และ users ต้องการรู้เหตุผลการรอ ให้ทำ Feature 2; เมื่ออยากเลือก workflow จากผลหลัง commit และยินยอมให้เก็บ lineage จึงทำ Feature 3

## ภาคผนวก A — หลักฐาน implementation ที่ตรวจจริง

ลิงก์ชี้ไฟล์และบรรทัดใน checkout นี้; function names ใช้ค้นซ้ำได้เมื่อโค้ดเคลื่อน. เอกสารแผนใช้ประกอบสถานะ ไม่ใช้แทน implementation

| Ref | Evidence |
|---|---|
| C01 Desktop | [sampler/delivery](/Users/jitwisutthobut/Desktop/wakaclock/apps/desktop/src-tauri/src/engine.rs:142), [app heartbeat actor](/Users/jitwisutthobut/Desktop/wakaclock/apps/desktop/src-tauri/src/engine.rs:360), [policy/title](/Users/jitwisutthobut/Desktop/wakaclock/apps/desktop/src-tauri/src/policy.rs:7), [OS support](/Users/jitwisutthobut/Desktop/wakaclock/apps/desktop/src-tauri/src/tracker/mod.rs:10) |
| C02 Runtime readiness | [runtime feature gates](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/mod.rs:54), [capability runtime mapping](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/handlers/v2.rs:629) |
| C03 Enterprise/billing | [SSO service](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/enterprise.rs:1), [billing reads](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/billing.rs:25) |
| C04 Heartbeat / canonical DB | [heartbeat schema](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/repository/heartbeat.rs:45), [revision winner relation](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/repository/canonical.rs:16) |
| C05 AI usage DB | [usage/session/change/pricing tables](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/repository/ai_usage.rs:65), [usage ingest](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/ai_usage.rs:317) |
| C06 Trust implementation | [Trust page](/Users/jitwisutthobut/Desktop/wakaclock/frontend/app/app/dashboard/(auth)/wakaclock/analytics/trust/page.tsx:57), [operation evidence handler](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/handlers/v2.rs:1482) |
| C07 AI dashboard/semantics | [AI page](/Users/jitwisutthobut/Desktop/wakaclock/frontend/app/app/dashboard/(auth)/wakaclock/ai/page.tsx:44), [effectiveness calculation](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/handlers/v2.rs:1714) |
| C08 Editor signal | [VS Code event subscriptions](/Users/jitwisutthobut/Desktop/wakaclock/extensions/vscode/src/events.ts:12), [payload](/Users/jitwisutthobut/Desktop/wakaclock/extensions/vscode/src/buffer.ts:637), [sidecar classifier](/Users/jitwisutthobut/Desktop/wakaclock/extensions/vscode/src/aiAttribution.ts:157) |
| C09 Editor support | [capability catalog](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/crates/wakaclock-core/src/ai/editor_capability.rs:80) |
| C10 Agent support | [runtime manifests](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/crates/wakaclock-core/src/ai/adapter.rs:556), [catalog](/Users/jitwisutthobut/Desktop/wakaclock/certifications/ai-adapters/catalog-v1.json:1) |
| C11 Detection | [process evidence](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/crates/wakaclock-core/src/ai/process_observer.rs:1), [correlation rules](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/crates/wakaclock-core/src/ai/correlation_engine.rs:372), [filesystem observer](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/crates/wakaclock-core/src/ai/filesystem_observer.rs:1) |
| C12 Attribution | [shared resolver mirror](/Users/jitwisutthobut/Desktop/wakaclock/extensions/vscode/src/attributionDecision.ts:1), [core heartbeat](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/crates/wakaclock-core/src/heartbeat.rs:472), [canonical event identity](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/crates/wakaclock-core/src/ai/event.rs:1) |
| C13 Project/VCS | [commit window attribution](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/vcs_attribution.rs:121), [VCS connect/read](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/vcs.rs:101), [project analytics](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/project_analytics.rs:1) |
| C14 Teams | [consent/membership](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/organizations.rs:418), [team UI](/Users/jitwisutthobut/Desktop/wakaclock/frontend/app/app/dashboard/(auth)/wakaclock/teams/page.tsx:30), [consent migration](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/migrations/postgres/022_org_analytics_consent.sql:1) |
| C15 Follow-up/reports | [unwired local ledger](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/crates/wakaclock-core/src/ai/follow_up.rs:37), [null rate service](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/follow_up.rs:21), [event-count repository](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/repository/follow_up.rs:20), [report gates](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/reports.rs:38) |
| C16 Time | [canonical timeline](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/activity_timeline.rs:225), [union/combined mode](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/activity_timeline.rs:1112), [frontend timeline](/Users/jitwisutthobut/Desktop/wakaclock/frontend/app/components/wakaclock/analytics/timeline-studio.tsx:1) |
| C17 Privacy/security | [metadata-only AI edit type](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/crates/wakaclock-core/src/ai/event.rs:138), [account deletion](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/account_deletion.rs:1), [credential encryption](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/infrastructure/secret_box.rs:1) |
| C18 API/import | [v2 routes](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/handlers/v2.rs:373), [compatibility manifest](/Users/jitwisutthobut/Desktop/wakaclock/docs/wakatime-compatibility-manifest.json:1), [import service](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/services/wakatime_import.rs:1) |
| C19 Infra | [Cargo features](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/Cargo.toml:68), [runtime init](/Users/jitwisutthobut/Desktop/wakaclock/backend/api/src/infrastructure/app/init.rs:234), [CI](/Users/jitwisutthobut/Desktop/wakaclock/.github/workflows/ci.yml:1) |
| C20 Historical evidence | [duration artifact](/Users/jitwisutthobut/Desktop/wakaclock/scripts/duration-audit/certifications/latest.json:1), [existing implementation status](/Users/jitwisutthobut/Desktop/wakaclock/plans/atoaxis-measurement-trust-implementation-status-2026-09-23.md:1) |

## ภาคผนวก B — การตรวจที่รันใน audit นี้

| Check | Result | สิ่งที่ผลนี้ไม่ยืนยัน |
|---|---|---|
| `node scripts/verify-compatibility-manifest.mjs` | ผ่าน: 87 routes, 34 feature entries | ไม่ใช่ E2E ของ 87 routes |
| `python3 -m unittest discover -s scripts/ai-coverage/tests -p 'test_validate_certification.py'` | 7 passed | ไม่ใช่ live adapter certification |
| `cargo test -p wakaclock-core --offline ai:: --lib` | 222 passed, 0 failed | synthetic/rule coverage ไม่ใช่ production precision/recall |
| VS Code Vitest: attributionDecision, lineMeasurement, buffer | 53 passed ใน 3 files | ไม่ได้เปิด IDE ทดสอบแต่ละ vendor/runtime |
| `cargo test -p wakaclock-server --offline --lib activity_timeline -- --quiet` | 39 passed, 1 ignored, 0 failed | ignored test ไม่ได้รัน; ไม่ใช่ production ClickHouse campaign |

รวม **321 tests ผ่าน, 1 ignored** ใน scope ข้างต้น และ manifest check ผ่าน. มี Vite config compatibility warning และ Xcode SDK discovery warning แต่ commands สำเร็จ. ไม่ได้รัน full workspace/frontend build, paid competitor walkthrough, live PostgreSQL/ClickHouse integration หรือ seven-day independent ground truth ในรอบนี้

สิ่งที่ส่งมอบคือข้อค้นพบและ actionable development plan; implementation tickets ใน Phase 10 ยังไม่ได้ลงมือแก้ application code และ readiness gaps ยังคงต้องปิดก่อนเปิดตัว

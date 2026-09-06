# AI coverage — รายการงานและ dependency

วันที่: 2026-09-05 · สถานะเริ่มต้นทุก task: `planned`

ใช้ร่วมกับ [execution plan](ai-coverage-execution-plan.md), [validation plan](ai-coverage-validation-plan.md) และ [ROADMAP](ROADMAP.md) เอกสารนี้ไม่รับรองว่ามี implementation ตามชื่อ task แล้ว

## 1. กติกาการใช้ ledger

- สถานะที่ใช้: planned → in_progress → implemented → validated → certified (เฉพาะ live adapter) → released; blocked ต้องมีเหตุผลและสิ่งที่ต้องได้เพื่อทำต่อ
- Owner เป็นบทบาทของงาน ไม่ได้ระบุบุคคลหรือมอบหมาย subagent: client/core, backend, frontend, integration, release
- Task ปิดต้องแนบ commit/build, tests, artifact หรือข้อจำกัด; “เขียน code แล้ว” ไม่เท่ากับ validated
- Dependency ที่เขียนว่า F1/F2 เป็นต้น หมายถึง exit gate ของระยะนั้นใน execution plan ไม่ใช่เพียงเริ่มเขียนแล้ว
- ทุก task ที่เปลี่ยน contract ต้องอัปเดต producer, consumer, fixtures, compatibility tests และเอกสารในชุดเดียวกัน
- ไฟล์ existing ในส่วนท้ายตรวจว่ามีอยู่แล้ว; ชื่อ module/script ใหม่ด้านล่างเป็นข้อเสนอ ต้องตรวจว่าไม่มี abstraction เดิมที่เหมาะสมก่อนสร้าง

## 2. F0 — Baseline, decisions และ reproduction

Owner: client/core + backend · Effort รวม: 3–5 วันทำงาน

| ID | งานและผลส่งมอบ | ขึ้นกับ | เกณฑ์ปิด |
| --- | --- | --- | --- |
| F0-01 | บันทึก branch/commit, dirty-tree boundary, CLI/extension/broker versions และ module wiring | — | baseline artifact ไม่มี secrets; ไม่ทับงานผู้ใช้ |
| F0-02 | ทำ fixture/reproducer unmatched AI, delayed sidecar, mixed edits และ doctor placeholders | F0-01 | มี expected/actual และ failing assertion ที่ชี้ช่องว่างจริง |
| F0-03 | ADR clarification: unknown authorship vs Unattributed AI; map old actor/bool fields | F0-02 | truth table client/server/UI ไม่มี unknown→AI โดยปริยาย |
| F0-04 | VS Code capability spike: human-input proof, version identity, formatter/paste/IME | F0-01 | ระบุ API ที่มีจริงและกรณีที่ต้อง unknown; ไม่อ้าง typing guarantee จาก document event |
| F0-05 | ออกแบบ canonical operation, aliases, revision และ correction protocol | F0-03, F0-04 | ตัวอย่าง late event/retry/multifile แสดงยอดก่อนหลังถูกต้อง |
| F0-06 | Wire/schema compatibility inventory รวม strict allowlists และ migration owner | F0-05 | ระบุ server-first sequence และ downgrade semantics ครบ |
| F0-07 | Ground-truth corpus, benchmark environment, target budgets, runtime access/cost budget และ release tuple แรก | F0-02 | manifest ของ scenario ที่ทราบผู้เขียนจริง; ไม่มี placeholder result; ระบุบัญชี/runner ที่ต้องใช้โดยไม่เก็บ secrets |

## 3. F1 — Attribution, dedup และ late reconciliation

Owner: client/core + backend · Effort รวม: 8–15 วันทำงาน

| ID | งานและผลส่งมอบ | สถานะ | ขึ้นกับ | เกณฑ์ปิด |
| --- | --- | --- | --- | --- |
| F1-01 | Pure attribution decision function + shared conformance fixtures | validated | F0-03, F0-06 | attribution truth table ผ่านทั้ง Rust/client/server |
| F1-02 | Per-change editor pending observations แยก time/input/line ownership | validated | F0-04, F1-01 | mixed edits ไม่เหมาทั้ง batch; input time ไม่หาย |
| F1-03 | Sidecar version/sequence/resume และ bounded incremental reader | validated | F0-06 | partial append/rotation/restart ไม่ drop หรือ replay ownership ซ้ำ |
| F1-04 | Exact editor↔agent reconciliation; ambiguous result เป็น unknown | validated | F1-02, F1-03 | same-time/same-lines negative case ไม่ขโมย attribution |
| F1-05 | Canonical IDs/aliases ข้าม producer; operation/file/sequence/worktree identity | validated | F0-05 | hook+transcript duplicate รวมได้เฉพาะมี proof; independent edits ไม่ถูกรวม |
| F1-06 | Canonical revision storage/read semantics และ durable reconciliation state | validated | F1-05, F0-06 | late evidence เปลี่ยน classification แต่ไม่เพิ่ม event/time/lines ซ้ำ |
| F1-07 | Broker/server policy boundary และ compatibility projection ของ legacy fields | validated | F1-01, F1-06 | source string ปลอม/unknown schema ไม่ได้ named attribution; legacy reads ใช้ได้ |
| F1-08 | API/ClickHouse projection/reprocess รองรับ canonical winner และ unknown bucket | validated | F1-06, F1-07 | revision replay/rebuild สองครั้งได้ผลเดียวกัน |
| F1-09 | เปลี่ยน unmatched fallback หลัง correction path พร้อม; feature rollout control | validated | F1-04, F1-08 | ไม่มี unmatched=human โดยไร้ human proof; late case ไม่ duplicate |
| F1-10 | Crash-boundary, offline, ordering และ concurrency integration suite | validated locally | F1-03–F1-09 | relevant V-M/V-C/V-R tests ผ่าน; error ไม่ทำคิวหาย |

เสนอแยก PR: decision+fixtures → identity/schema/read path → broker/revisions → editor reconciliation → projections/rollout wiring ไม่รวมทุกส่วนเป็น PR เดียว

## 4. F2 — Diagnostics และ multi-device persistence

Owner: client/core + backend · Effort รวม: 4–7 วันทำงาน

| ID | งานและผลส่งมอบ | สถานะ | ขึ้นกับ | เกณฑ์ปิด |
| --- | --- | --- | --- | --- |
| F2-01 | Health DTO แบบ nullable measurement + availability + measured_at | validated | F0-06 | measured-zero ต่าง unavailable; v1/v2 mapping documented |
| F2-02 | Collector อ่าน process/service, queue, scan/cursor/delivery จริง | validated | F2-01 | running/lag/error มาจาก probes; PID reused ไม่ healthy ปลอม |
| F2-03 | รวม ai doctor/doctor ai/status/self-test ใช้ collector เดียว | validated | F2-02 | snapshot เดียวกันได้ความหมายเดียวทุก command |
| F2-04 | Separate adapter tracking consent / observer / diagnostics upload | validated | F2-01 | observer off แต่ native hook ทำงานแสดงสถานะถูก |
| F2-05 | Device-scoped diagnostics repository + receipt ordering/TTL | validated | F2-01, F0-06 | API restart, two devices, delayed/future-clock report ผ่าน |
| F2-06 | Wire repository/service/AppState และ old-mode degradation | validated | F2-05 | PostgreSQL mode durable; absent-store mode แสดง ephemeral/unavailable จริง |
| F2-07 | Schema validation/size/rate limits, safe error codes, auth scopes | validated | F2-06 | malformed/tenant-mix/raw path cases ถูกป้องกันตาม tests |
| F2-08 | Observer toggle noninterference + idle/stalled diagnostics suite | validated locally | F2-03, F2-04, F2-07 | attribution bytes/time ไม่เปลี่ยนจาก diagnostics toggling |

## 5. F3 — Registry, setup และ packaging

Owner: client/core + integration/release · Effort รวม: 4–7 วันทำงาน

| ID | งานและผลส่งมอบ | สถานะ | ขึ้นกับ | เกณฑ์ปิด |
| --- | --- | --- | --- | --- |
| F3-01 | Registry contract สำหรับ aliases/runtimes/capabilities/install resources | implemented | F0-06 | ตรวจ uniqueness, resource existence, supported schema ได้ |
| F3-02 | Registry-driven CLI parser factory/setup/status/uninstall dispatch | in_progress | F3-01 | manifest ที่ไม่มี implementation ไม่แสดง installable/working |
| F3-03 | Extension ลด duplicate AI lists ใช้ typed CLI contract | in_progress | F3-02 | CLI/VS Code รายการและ outcomes ตรงกัน |
| F3-04 | Structured config merge, ownership ledger, atomic transaction/lock | implemented | F3-02 | preserve hooks, corrupt config และ concurrent setup tests ผ่าน |
| F3-05 | Stable bundle/version/checksum/update/rollback และ resource verification | in_progress | F3-04 | VSIX update ไม่ทำ path ขาด; runtime ใช้ artifact ที่ผ่าน tests |
| F3-06 | Per-OS service/hook dependencies และ restart outside-editor test | planned | F3-05 | macOS/Linux/Windows เฉพาะ tuple ที่รับรองติดตั้งใช้งานจริงได้ |
| F3-07 | Uninstall ref-count/ownership, repeat setup และ partial batch outcome | implemented | F3-04, F3-06 | ไม่ลบ user files/other adapters; failures ไม่ถูกกลบเป็น success |
| F3-08 | Onboarding consent/health integration และ setup runbook | in_progress | F2-03, F2-04, F3-03, F3-07 | first install/repair/update/uninstall flow ตรวจได้จาก UI/CLI |

## 6. F4 — Certification infrastructure

Owner: integration + backend/release · Effort รวม: 4–7 วันทำงาน

| ID | งานและผลส่งมอบ | ขึ้นกับ | เกณฑ์ปิด |
| --- | --- | --- | --- |
| F4-01 | Adapter certification schema + privacy validator | F0-07, F3-01 | missing evidence/fixture-only/PII artifact ไม่ผ่าน |
| F4-02 | Live harness ต่อ source→broker→API→dashboard พร้อม ground truth | F1, F2, F3, F4-01 | ปล่อย artifact เฉพาะสิ่งที่รันจริงและแยก skipped/failed |
| F4-03 | Reviewed certification catalog ใน release artifact + service lookup | F4-01 | client self-claim ไม่ promote; valid matching artifact promote ได้ |
| F4-04 | Tuple matching, version freshness, revocation และ enum mapping | F4-03, F3-01 | mismatch/expired/revoked ไม่ Verified; old enum อ่านได้ |
| F4-05 | Import historical Claude/Codex records และ list missing evidence | F4-01 | ไม่เติมวันที่/version/pass ที่ไม่ปรากฏในหลักฐาน |
| F4-06 | CLI/API/frontend conformance ของ maturity กับ runtime health | F2, F4-04 | certified+stopped แสดง certified/degraded ไม่แสดง healthy |

ตำแหน่งใหม่ที่เสนอ: `scripts/ai-coverage/` สำหรับ harness/validator, `docs/ai-certifications/` สำหรับ sanitized artifacts และ `backend/api/src/services/ai_certification.rs` สำหรับ policy/catalog lookup ทั้งหมดต้องสร้างและ wire จริงก่อนอ้างว่าใช้งานได้

## 7. F5 — Agent coverage backlog

Owner: integration · งานทุกตัวต้องใช้ checklist ใน execution plan และ validation matrix

| ID | งานและผลส่งมอบ | ขึ้นกับ | เกณฑ์ปิด |
| --- | --- | --- | --- |
| F5-01 | Claude CLI refresh หลัง migration: hooks/transcript/write/edit/failures | F4 | matching live certificate และ broker/backend/dashboard evidence |
| F5-02 | Codex CLI current runtime paths, patch variants, hook+transcript dedup | F4 | registry/catalog ตรง live results; paths ที่ยังไม่ผ่านแสดง limitation |
| F5-03 | Gemini CLI real payload/storage inventory → parser fixes → live gate | F4 | ไม่ใช้ synthetic payload รับรอง; exact supported modes ระบุชัด |
| F5-04 | Codex desktop/IDE runtime survey และ certification แยก | F5-02 | tuple ใหม่มีผลจริง; หาก unavailable ให้ blocker ไม่ยืม CLI result |
| F5-05 | Kilo CLI ทั้ง aliases และ selected provider/model | F5-03 | real plugin callback flow, provider provenance, duplicate handling ผ่าน |
| F5-06 | Kilo VS Code | F5-05 | shared extension host/live callback tested แยกจาก CLI |
| F5-07 | Cursor Agent real hook/config/path/session pairing | F5-05 | setup+edit+retry+multifile certificate จริง |
| F5-08 | Cursor Tab acceptance/partial/reject survey และ adapter เมื่อมี evidence | F5-07 | รองรับเฉพาะ modes ที่พิสูจน์; unsupported เป็น valid survey outcome |
| F5-09 | Cline native/storage survey → thin adapter | F5-07 | per-edit completion/file identity จริง หรือ unsupported record |
| F5-10 | Roo native/storage/checkpoint survey → thin adapter | F5-07 | restore/no-op/concurrency ผ่าน หรือ unsupported record |
| F5-11 | Continue inline/agent แยก survey และ certification | F5-07 | inline accept ไม่ถูกเหมารวมจาก agent mode |
| F5-12 | OpenCode plugin/transcript survey → adapter | F3, F4, F5-09–F5-11 survey complete | real events + session/provider metadata ตามที่มี |
| F5-13 | Goose tool/session survey → adapter | F3, F4, F5-09–F5-11 survey complete | real events หรือ explicit unsupported tuple |
| F5-14 | Copilot CLI lifecycle/transcript survey → adapter | F3, F4, F5-09–F5-11 survey complete | CLI certification แยก IDE |
| F5-15 | Copilot IDE/inline capability survey | F5-14 | record accepted/rejected/partial suggestions เมื่อแหล่งรองรับ |
| F5-16 | Windsurf/Antigravity integration surveys | F4, F5 wave exit | verified official/current source; ไม่ใช้ process inference |
| F5-17 | Kimi/standalone Deep Code evidence inventory | parked ตาม roadmap | เริ่ม implementation เมื่อมี real surface/environment; ไม่ตี provider เป็น client |
| F5-18 | Generic MCP wrapper/SDK contract และ custom producer example | F1, F3, F4 | actual successful file tool calls ส่ง metadata อัตโนมัติ ไม่พึ่ง prompt เตือน |

Effort: baseline Claude/Codex/Gemini รวม 6–12 วัน; adapter runtime ถัดไป survey 1–3 วันและ implementation/certification 3–8 วันเมื่อมี evidence surface ส่วน unavailable/closed tool ให้รายงาน survey outcome แล้วทำงานส่วนอื่นต่อ

## 8. F6 — Analytics และ UX

Owner: backend + frontend · Effort รวมกับ initial rollout: 5–9 วันทำงาน

| ID | งานและผลส่งมอบ | ขึ้นกับ | เกณฑ์ปิด |
| --- | --- | --- | --- |
| F6-01 | API partition/coverage contract: human, AI, AI unnamed, unknown origin | F1 | sums/denominators/revision tests ผ่าน |
| F6-02 | Typed endpoints/query keys และ schema old/new compatibility | F6-01, F2 | user-scoped cache, null/empty/error semantics ถูก |
| F6-03 | Human vs AI/legend/model/provider views ตาม evidence | F6-02 | unknown ไม่กลายเป็น AI/human; vendor ไม่เป็น model provider |
| F6-04 | Per-device integration health + certified capability panel | F2, F4, F6-02 | unavailable/idle/degraded/certified แสดงต่างกัน |
| F6-05 | Onboarding/repair messages และ advanced detail | F3, F6-04 | ผู้ใช้เห็น next action ที่แก้สาเหตุ ไม่ใช่ข้อความ failure รวม |
| F6-06 | Dashboard E2E, timezone/device/project filters, accessibility | F6-03–F6-05 | keyboard/screen reader/responsive states และ cross-user tests ผ่าน |

## 9. F7 — Remote, cloud และ editor เพิ่มเติม

Owner: client/core + integration · Effort foundations: 8–15 วัน + certification ต่อ topology

| ID | งานและผลส่งมอบ | ขึ้นกับ | เกณฑ์ปิด |
| --- | --- | --- | --- |
| F7-01 | Topology contract + device/workspace/worktree mapping | F0-05, F1 | path ต่างเครื่อง/ชื่อ repo ซ้ำ/หลาย worktree ไม่รวมผิด |
| F7-02 | SSH/remote extension host collector setup | F7-01, F3, F4 | local+remote duplicate และ reconnect suite ผ่าน |
| F7-03 | WSL/dev container lifecycle และ durable queue handoff | F7-01, F3, F4 | teardown/restart ไม่เสีย accepted events ตาม retention policy |
| F7-04 | Cloud job integration survey และ authenticated metadata path | F7-01, F4 | collector เห็น tool results จริง; ไม่ใช่เดาจาก commit author |
| F7-05 | JetBrains/Neovim/Zed/LSP capability inventory | F1, F3 | known edit/input evidence surfaces แยก; ไม่รับรองด้วยชื่อ editor |
| F7-06 | Browser paste provenance scope record | F0-03 | current paste remains unknown; ไม่มี permission expansion แฝง |

## 10. F8 — Release และ maintenance

Owner: release · ทำร่วมทุก milestone ไม่รอท้ายโครงการ

| ID | งานและผลส่งมอบ | ขึ้นกับ | เกณฑ์ปิด |
| --- | --- | --- | --- |
| F8-01 | Server-first migration/compatibility rehearsal | F1, F2, F4 | old/new client-server combinations ผ่านตาม matrix |
| F8-02 | Shipped CLI/VSIX/native bundle checksums/resources/platform checks | F3, F5 baseline | binaries ที่รับรองตรง artifact ที่ติดตั้ง |
| F8-03 | Lab → internal live → opt-in beta rollout พร้อม limits | F6, F8-01, F8-02 | gates ผ่านและ sample size เพียงพอ ไม่ใช้เวลาอย่างเดียว |
| F8-04 | Disable/revoke/rollback และ queue replay drill | F8-01 | rollback ไม่ทำข้อมูลหาย/เปิด inference/กลับไป guessed human |
| F8-05 | Support matrix, release notes และ troubleshooting runbook | F8-03, F8-04 | รายชื่อที่โฆษณาไม่เกิน certificate tuples |
| F8-06 | Parser drift/version renewal process และ maintenance ownership | F8-05 | version change triggers/test checklist มีคนรับผิดชอบ; ไม่สร้าง schedule จริงในงานวางแผน |

## 11. แผน PR ที่ตรวจได้ทีละชุด

| PR | เนื้อหา | ไม่รวมใน PR เดียวกัน |
| --- | --- | --- |
| PR-01 | F0 decisions/repro fixtures/baseline | เปลี่ยน production counts |
| PR-02 | F1 identity/schema/canonical revision readers และ migration | editor fallback rollout |
| PR-03 | F1 broker dedup/recovery/correction writers | adapters ใหม่ |
| PR-04 | F1 editor pending/exact reconciliation + regression | registry/setup refactor |
| PR-05 | F1 projections/reprocess + unknown API semantics | เปลี่ยน duration definition |
| PR-06 | F2 health collector + command unification | live certification claims |
| PR-07 | F2 device-scoped persistence/compatibility | unrelated presence rewrite |
| PR-08 | F3 registry/setup/extension parity | all AI installs at once |
| PR-09 | F3 update/uninstall/platform packaging | model/provider guessing |
| PR-10 | F4 certification schema/catalog/server resolution | fabricated live artifacts |
| PR-11 | F6 analytics/health UX และ contract tests | general UI redesign |
| PR-12+ | baseline/agent adapters ทีละ runtime พร้อม certificate | รวมหลาย AI ที่พิสูจน์ไม่ได้เข้าก้อนเดียว |
| PR-release | migration/rollout/rollback evidence และ support docs | unrelated repo changes |

ลำดับ merge ของ PR ต้องเคารพ task dependencies โดยเฉพาะ PR-04 ต้องไม่เปิด writer ที่ server PR-02/03/05 ยังอ่านไม่ได้ ใช้ capability gate ระหว่าง staged rollout และตรวจ required repo hooks ก่อน merge/push

## 12. แผนที่ไฟล์ที่เกี่ยวข้อง

| งาน | Existing paths จาก repository root |
| --- | --- |
| Broker/queue | `backend/api/crates/wakaclock-core/src/broker.rs`, `src/queue.rs`, `backend/api/crates/wakaclock-cli/src/broker.rs` |
| Event/identity | `backend/api/crates/wakaclock-core/src/heartbeat.rs`, `src/ai/event.rs`, `src/ai/canonical.rs`, `src/ai/dedup.rs`, `src/ai/producer.rs`, `src/ai/sidecar.rs` |
| Discovery/parser | `backend/api/crates/wakaclock-core/src/ai/parser.rs`, `jsonl.rs`, `state.rs`, `claude.rs`, `codex.rs`, `gemini.rs` |
| Registry/health | `backend/api/crates/wakaclock-core/src/ai/adapter.rs`, `diagnostics.rs`, `backend/api/crates/wakaclock-cli/src/main.rs`, `agent_service.rs` |
| Editor | `extensions/vscode/src/events.ts`, `buffer.ts`, `aiAttribution.ts`, `clipboardTracking.ts`, `aiDetectionSelfTest.ts` |
| Setup/shipping | `extensions/vscode/src/agentSetup.ts`, `managedCli.ts`, `cli.ts`, `extensions/vscode/scripts/copy-ai-agents.js`, `.github/workflows/release-extension.yml`, `install.sh`, `packaging/` |
| Native adapters | `extensions/ai-agents/` และ `extensions/ai-agents/common/` |
| Backend diagnostics | `backend/api/src/handlers/v1/ai_diagnostics.rs`, `src/model/ai_diagnostics.rs`, `src/services/ai_diagnostics.rs`, `src/infrastructure/app/init.rs` |
| Backend data | `backend/api/src/model/heartbeat.rs`, `src/services/heartbeat.rs`, `src/repository/heartbeat.rs`, `src/services/activity_timeline.rs`, `src/services/ai_stats.rs`, `src/services/ai_usage.rs`, `src/services/analytics_explorer.rs` |
| Dashboard data/UI | `frontend/app/lib/wakaclock/types.ts`, `endpoints.ts`, `query-keys.ts`, `frontend/app/components/wakaclock/ai-attribution-legend.tsx`, `evidence-split.tsx`, `analytics/` |
| Tests/ledgers | `extensions/vscode/test/`, `backend/api/crates/wakaclock-core/src/ai/fixtures/`, `CAPABILITIES.md`, `VERIFICATION.md`, `docs/ai-attribution-test-matrix.md`, `scripts/ai-attribution-integration.py` |

`src/...` ในแถวเดียวกันหมายถึง root ของ crate/package ที่ระบุก่อนหน้า ไม่ได้หมายถึง repository root โดยตรง ก่อนแก้ไฟล์ให้ตรวจ `rg --files` และ module wiring อีกครั้ง เพราะ working tree อาจเปลี่ยนจากวันที่ audit

## 13. รูปแบบ evidence ต่อ task

```yaml
task_id: F1-04
status: planned
owner_role: client-core
implementation_commit: null
tested_build_digest: null
test_scenarios: []
automated_result: not_run
live_result: not_run
artifact_links: []
known_limitations: []
blocker: null
next_action: implement_after_dependencies
```

ตัวอย่างนี้เป็น template จึงไม่มีผลผ่านหรือเวอร์ชันปลอม เมื่อ blocked ให้บันทึกสิ่งที่ขาดเฉพาะเจาะจง เช่น tool login, platform runner, undocumented event shape และทำ task อื่นที่ไม่ขึ้นกับสิ่งนั้นต่อ

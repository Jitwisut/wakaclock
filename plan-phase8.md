# Phase 8 — Production Wiring and Zero-Touch Setup

รวมปลายทางของสองแผนที่สร้างเสร็จแล้วแต่ยังไม่ถูกเสียบปลั๊ก:

- **`planai2.md` Phase 0–7** — detection engine (correlation, dedup, canonical,
  shadow, pipeline). โค้ดครบ เทสต์ผ่าน **แต่ไม่มี production call site**
- **`planplugin.md` Phase 0–5** — producer SDK + native adapters + installer.
  โค้ดครบ Codex live-verified **แต่ `ai/producer.rs` ก็ยังไม่ถูกเรียกจาก pipeline**

Phase 8 ไม่สร้าง algorithm ใหม่ หน้าที่เดียวคือ **ทำให้ของที่มีอยู่ทำงานจริง**
และ **ทำให้ผู้ใช้ไม่ต้องพิมพ์คำสั่งใดๆ**

---

## เป้าหมาย

1. **Track A — Wire:** verdict จาก `CorrelationEngine` กลายเป็น `actor_type` จริงบน
   heartbeat โดยผ่าน shadow mode ก่อน และ **ไม่เปลี่ยน duration แม้แต่วินาทีเดียว**
   จนกว่าจะตั้งใจเปิด
2. **Track B — Zero-touch:** ติดตั้ง AtoAxis เสร็จ → agent ทุกตัวที่เครื่องมี ถูกจับ
   ทันที รวมถึง agent ที่ **ไม่มี hook เลย** และ agent ที่รันใน terminal ล้วน

```text
ก่อน Phase 8:  hook เท่านั้น → actor_type    (engine วางอยู่บนหิ้ง)
หลัง Phase 8:  hook → ai_verified
               ไม่มี hook → ai_inferred      (universal inference ทำงานจริง)
               ผู้ใช้พิมพ์คำสั่ง 0 ครั้ง
```

---

## p8.0 DECISION — engine รันฝั่งไหน

**ตัดสิน: รันใน local broker (client-side) ไม่ใช่ server**

เหตุผลที่ปิดประเด็นนี้:

- หลักฐานสามในสี่ชนิดของ §5 **มีอยู่เฉพาะบนเครื่องผู้ใช้** — filesystem observer,
  process/session observer, editor input. server ไม่เคยเห็น (เหตุผลเดียวกับที่
  p7.2c ต้องสร้าง client→server push สำหรับ diagnostics)
- `correlation_engine.rs` / `dedup.rs` / `shadow.rs` อยู่ใน `wakaclock-core` ซึ่งเป็น
  client crate อยู่แล้ว — `WorkspaceRegistry`, `ObserverPool`, `scan_ai_processes`
  ก็อยู่ที่นั่น
- broker เป็น always-on runtime ที่มี inbox ทนทาน (SQLite) + retry/dead-letter อยู่แล้ว

ผลที่ตามมา: server **ไม่ต้องแก้ attribution logic** `resolve_attribution` เดิมยังเป็น
เจ้าของ `ActorType` บน wire — broker แค่ส่ง `actor_type` ที่ correlate แล้วมาให้

---

## สถานะตั้งต้น (ตรวจจากโค้ดจริง 2026-09-02)

| ของที่มี | ตำแหน่ง | สถานะ |
|---|---|---|
| `CorrelationEngine::verdict_for` / `verdict_for_within` | `ai/correlation_engine.rs` | ครบ · **0 call site นอก test** |
| `dedup()` + `CanonicalActivity` + `CanonicalFingerprint` | `ai/dedup.rs`, `ai/canonical.rs` | ครบ · **0 call site** |
| `ObserverConfig` + `observe()` + kill switch + `RolloutScope` | `ai/shadow.rs` | ครบ · **0 call site** |
| `compare_to_oracle` → precision/recall แยกกัน | `ai/shadow_report.rs` | ครบ · **ไม่มี labelled corpus** |
| `PipelineTracker` | `ai/pipeline.rs` | ครบ · **ไม่มีใคร `observe()`** |
| `build_file_change_event` / producer contract | `ai/producer.rs` | ครบ · **0 call site ใน `main.rs`/`broker.rs`** |
| `WorkspaceRegistry` (`register`/`watched_roots`/lease TTL) | `ai/workspace.rs` | ครบ · register ด้วยมือเท่านั้น |
| `scan_ai_processes` → `DetectedAiProcess { cwd }` | `ai/process_observer.rs` | ครบ · ไม่ป้อนอะไรต่อ |
| broker poll loop + bounded transcript auto-scan | `wakaclock-cli/src/broker.rs:534` | ทำงานจริง — **จุดเสียบของ Phase 8** |
| `report_from_doctor_json` + `send_ai_diagnostics` | `ai/diagnostics.rs`, `api_client.rs` | ครบ · **CLI ยังไม่เรียก** (1 บรรทัด) |

**Blocker ที่ต้องเคลียร์ก่อนเริ่ม:** concurrent `TransportKind` rework ใน
`wakaclock-core/src/broker.rs` ยังทำ `broker::tests::transport_kind_ranks_producers_
by_evidence_strength` และ `ai::dedup::tests::p6_a2_...` พัง — p8 พึ่ง
`evidence_rank_key` โดยตรง จึงต้องให้ ranking นิ่งก่อน

---

## Hard invariants (สืบทอดจากทั้งสองแผน — ห้ามละเมิด)

- **Metadata only** — ห้าม prompt, response, source code, patch/diff body, command
  arguments, terminal output, clipboard, arbitrary unknown fields
- `RAW_FILE_CHANGE_WITHOUT_PROVENANCE != HUMAN` · `PROCESS_RUNNING != AI_FILE_EDIT`
  · `CONFLICTING_EVIDENCE != HUMAN`
- **Duration ห้าม regress** — `golden.py` ต้อง `total_error: 0.0` ทุก item
- fixture ≠ live verification (planai2.md บรรทัด 604)
- adapter ที่ยังไม่รันกับ tool จริง = `scaffold`/`unverified` เท่านั้น
- offline replay ต้องใช้ event identity เดิม ไม่เพิ่ม total
- **ห้ามเขียน config ของ tool อื่นโดยไม่มี consent** (invariant ใหม่ของ Track B)

---

# Track A — Wire the engine into production

## p8.1 Evidence intake adapter

ไฟล์ใหม่ `wakaclock-core/src/ai/intake.rs` — แปลงหลักฐานทุกชนิดเป็น
`CorrelationInput` ชนิดเดียว

| ต้นทาง | → `EvidenceKind` | lineage_id |
|---|---|---|
| `BrokerEventV1` (native hook / MCP) | `NativeHook` / `StructuredMcp` จาก `TransportKind` | `event_id` |
| `BrokerEventV1` (transcript) | `CompletedTranscriptToolCall` | `event_id` |
| `BrokerEventV1` (tool snapshot / shell) | `ToolSnapshot` | `event_id` |
| `FileChangedEvent` (filesystem observer) | `FilesystemObserver` | `file_event_id()` |
| `SessionProcessEvidence` | `SessionProcessObserver` + `evidence_strength` | session id |
| editor input (sidecar / `EditorObservation`) | `EditorInput` | sidecar event id |

- ห้ามเดา: input ที่ field ไม่ครบ → **drop + bounded diagnostic** ไม่ใช่เติมค่ามั่ว
- `workspace` มาจาก `project_root` หรือ `WorkspaceRegistry` เท่านั้น
- Tests: `every_producer_shape_maps_to_a_correlation_input_with_its_lineage`,
  `an_intake_record_carries_no_content_field`,
  `a_malformed_producer_record_is_dropped_not_guessed`

## p8.2 Broker correlation pass

ใน `wakaclock-cli/src/broker.rs` poll loop (บรรทัด ~534) เพิ่มขั้นตอนหลัง
transcript auto-scan:

```text
poll:
  รวบรวมหลักฐานในหน้าต่างเวลาปัจจุบัน (inbox pending + fs observer + session scan)
    → intake::to_correlation_inputs()
    → CorrelationEngine::ingest ทั้งหมด
    → สำหรับแต่ละ entity: verdict_for_within(entity, at, ClipBounds::utc_day(at))
    → Vec<(entity, Verdict)>
```

- **Bounded**: จำกัดจำนวน input ต่อรอบ (ใช้ `BoundedEventBuffer` pattern จาก p3.4),
  ทิ้งหลักฐานที่เก่ากว่า window ที่ยาวที่สุด (`session_liveness_grace` 120s)
- engine ถูกสร้างใหม่ทุกรอบ (stateless ระหว่าง poll) — state ทนทานอยู่ใน inbox
- Tests: `a_poll_with_mixed_evidence_produces_one_verdict_per_entity`,
  `an_empty_poll_is_a_no_op`, `the_correlation_pass_is_bounded_under_a_file_storm`

## p8.3 Shadow gate ที่ขอบการ emit

ผูก `shadow::observe()` ระหว่าง verdict กับการสร้าง heartbeat

- `ObserverConfig` โหลดจาก `~/.wakaclock/observer.toml` (ไม่มีไฟล์ = `Default` = ปิด)
- kill switch ถูกเช็คที่ **intake** ไม่ใช่ตอน emit: `source_live(kind)`,
  `workspace_live(root)`, `agent_in_rollout(agent)`, `platform_in_rollout(platform)`
- `observe_only` → เขียน `ShadowRecord` ลงตาราง `shadow_log` ใน broker SQLite
  (rotating, bounded) · **ไม่ปล่อย heartbeat ใหม่ ไม่แตะของเดิม**
- `infer` → verdict กลายเป็น `actor_type`

**เทสต์สำคัญที่สุดของ Phase 8** —
`p8_a1_observe_only_emits_byte_identical_heartbeats_to_observer_off`: รัน fixture
เดียวกันสองรอบ (observer ปิด / `observe_only`) แล้ว **diff heartbeat JSON ทั้งชุด
ต้องเท่ากันทุกไบต์** อันนี้แทน caveat "module-contract only" ของ p7.A1 ได้จริง

## p8.4 Canonical heartbeat emission

เปลี่ยนจาก "1 event → 1 heartbeat" เป็น "N หลักฐาน → dedup → 1 canonical activity →
1 heartbeat"

```text
Vec<(entity, Verdict)> + หลักฐานดิบ
    → DedupObservation (fingerprint = CanonicalFingerprint::v1)
    → dedup()
    → DedupOutcome { activities, total_active_seconds, conflicts }
    → 1 heartbeat ต่อ CanonicalActivity (actor_type = verdict, seconds = strongest obs)
    → submit_events_chunked (path เดิม)
```

- **ห้าม double-emit**: เมื่อ engine เป็นเจ้าของการ emit แล้ว legacy direct-emit
  ต้องปิดภายใต้ flag เดียวกัน ไม่ใช่ทำงานคู่ขนาน
- `conflicts` → เขียนเป็น diagnostic ไม่ overwrite (p6.3 rule 2)
- **นี่คือขั้นที่เสี่ยงต่อ duration ที่สุด** — gate: `verify_port` + `golden.py`
  (`total_error 0.0`) + `verify_actor_migration` + `verify_certification` ทุกครั้ง
- Tests: `one_edit_seen_by_four_producers_emits_exactly_one_heartbeat`,
  `a_multi_file_tool_call_keeps_its_interval_on_the_first_record_only`,
  `restart_and_replay_emit_no_additional_heartbeat`

## p8.5 Pipeline observability ต่อจริง

- เรียก `PipelineTracker::observe()` ที่ stage จริงทั้ง 7: agent detected (process
  scan) → adapter installed (registry) → evidence received (inbox insert) →
  correlated (p8.2) → accepted locally (p8.4) → queued for delivery → delivered /
  rejected (`submit_events_chunked` result)
- `snapshot()` เข้า `doctor ai --json`
- **ปิดหนี้ p7.2c**: `doctor ai` เรียก `report_from_doctor_json()` +
  `api_client.send_ai_diagnostics()` (1 call site ที่ค้างไว้) → dashboard panel
  ที่สร้างไว้แล้วมีข้อมูลจริง
- Tests: `every_pipeline_stage_is_observed_on_a_real_delivery`,
  `a_rejected_delivery_lands_on_the_rejected_stage`

## p8.6 Labelled shadow corpus + precision gate

ปัญหาที่ p7.4 ทิ้งไว้: วัด precision ไม่ได้เพราะไม่มี ground truth ที่ไม่ circular

**วิธีติดฉลากที่ไม่ circular — ใช้ tool-call scope:**

```text
native hook รายงาน tool call 1 ครั้ง → แตะ N ไฟล์ (tool_event_id เดียวกัน)
   ไฟล์ที่มี direct evidence ต่อไฟล์  → proposed = ai_verified
   ไฟล์ที่เหลือใน tool call เดียวกัน  → proposed = ai_inferred
                                        ground_truth = Ai   ← ฉลากมาจาก manifest
                                                             ของ tool call ไม่ใช่
                                                             จาก proposal
   editor session ที่มี keystroke จริง + ไม่มี agent ใน window
                                        → ground_truth = Human
```

- ไฟล์ใหม่ `ai/shadow_corpus.rs` — สร้าง `ShadowRecord` พร้อม `ground_truth` จาก
  หลักฐานที่ capture จริง (ไม่ใช่ fixture)
- คำสั่งใหม่ `wakaclock ai shadow-report --json` → `ShadowComparisonReport`
- **Gate สำหรับพลิกเป็น `infer`** (จาก planai2 Release Gates):
  - universal inference precision **≥ 99%** (AI false positive < 1%)
  - unknown ถูกจัดเป็น human **= 0%**
  - native adapter recall รายงาน **แยกต่างหาก** ห้ามรวมเป็นตัวเลขเดียว
  - duplicate canonical activity < 0.1%
- Tests: `the_corpus_labels_come_from_tool_call_scope_not_from_the_proposal`,
  `precision_and_native_recall_stay_two_numbers`

---

# Track B — Zero-touch setup

## p8.7 Workspace auto-registration

ทำให้ universal inference ทำงานในโฟลเดอร์ที่**ไม่เคยเปิดใน VS Code**

- ทุก poll: `scan_ai_processes()` → สำหรับแต่ละ `DetectedAiProcess.cwd` หา git root
  → `WorkspaceRegistry::register(root, producer_id = "process-observer", ttl)`
- **Guard rails** (บังคับ): ห้าม register `$HOME`, `/`, `/tmp`, path ที่ไม่ใช่ git
  root; จำกัดจำนวน workspace พร้อมกัน; lease หมดอายุเองเมื่อ process หาย
  (`prune_expired`)
- Tests: `an_agent_running_in_an_unregistered_repo_registers_that_root`,
  `home_and_filesystem_root_are_never_registered`,
  `the_lease_expires_when_the_agent_process_is_gone`,
  `auto_registration_is_bounded_to_n_workspaces`

## p8.8 Broker auto-setup ของ native hook

ทำให้ `ai_inferred` อัปเกรดเป็น `ai_verified` เองโดยผู้ใช้ไม่ต้องสั่ง

- ทุก poll (throttle เช่นทุก 10 นาที): `AdapterRegistry::builtin()` → agent ไหน
  **detected แต่ยังไม่มี AtoAxis hook** หรือ **hook ชี้ path เก่า** → รัน install
  แบบ idempotent (กลไกเดิมของ planplugin ที่ preserve user config อยู่แล้ว)
- **Consent — invariant ใหม่:**
  - `wakaclock.autoInstallAgentHooks` (default `true`) แต่ **การเขียนครั้งแรกต้อง
    ผ่าน prompt** จาก extension หรือ `wakaclock ai setup --yes`
  - ถ้าผู้ใช้ปฏิเสธ → บันทึก opt-out ถาวร **ห้ามแตะ config ของ agent นั้นอีก**
  - ทุกครั้งที่เขียน → บันทึกลง audit log ที่ `doctor ai` แสดงได้
- Tests: `a_detected_unhooked_agent_is_installed_once_then_is_a_no_op`,
  `an_opted_out_agent_config_is_never_written`,
  `unrelated_user_config_keys_survive_the_managed_block`,
  `a_stale_hook_path_is_repaired_in_place`

## p8.9 Extension zero-touch onboarding

- VS Code extension: activate → มี API key → `ensureBrokerRunning()` (มีแล้ว) →
  **แสดง consent prompt ครั้งเดียว** → จากนั้นทุกอย่างเป็น background
- สถานะทั้งหมดอยู่ใน AI Stats page (panel diagnostics ที่สร้างไว้แล้ว) + status bar
- ไม่มีขั้นตอนที่ต้องพิมพ์คำสั่ง
- Tests: `activation_with_a_key_starts_the_broker_and_asks_consent_once`,
  `declining_consent_still_tracks_editor_activity`

## p8.10 Standalone installer (ผู้ใช้ terminal ล้วน)

สำหรับคนที่ไม่ลง editor extension เลย

- `curl -fsSL https://get.atoaxis.com | sh` และ Homebrew formula → ลง `wakaclock`
  + ลงทะเบียน broker เป็น login service (launchd / systemd user / Task Scheduler —
  planplugin Phase 0 มีกลไกครบแล้ว)
- หลังจากนั้น p8.7 + p8.8 ทำให้ทุกอย่างเหมือนกับผู้ใช้ที่ลง extension
- Tests: `the_installer_registers_a_login_service_idempotently`

---

## Acceptance criteria

- **p8.A1** `observe_only` ปล่อย heartbeat/analytics **byte-identical** กับ
  observer ปิด — end-to-end ไม่ใช่ module contract *(แทน caveat ของ p7.A1)*
- **p8.A2** agent ที่**ไม่มี hook เลย** (Codex CLI ใน terminal) ในโฟลเดอร์ที่
  auto-register → ได้ `ai_inferred` จริงถึง backend row
- **p8.A3** edit เดียวที่เห็นโดย hook + transcript + filesystem + editor → **1
  heartbeat, 1 duration point** end-to-end · `golden.py total_error 0.0`
- **p8.A4** restart / replay ไม่เพิ่ม duration และไม่เพิ่ม backend row
- **p8.A5** บน labelled corpus: precision ≥ 99%, AI false positive < 1%,
  unknown→human = 0%, native recall รายงานแยก
- **p8.A6** rollback = พลิก `attribution_mode` กลับเป็น `observe_only` — **ไม่ต้อง
  migrate ไม่ลบข้อมูล**; opt-out ของ auto-setup ทำให้ config ของ agent ไม่ถูกแตะ

---

## Gates

```bash
# ทุก item
cd backend/api
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

# ทุก item ที่แตะ heartbeat / duration / attribution  (คือเกือบทั้ง Track A)
python3 scripts/duration-audit/verify_port.py
python3 scripts/duration-audit/golden.py          # ต้อง total_error: 0.0
python3 scripts/duration-audit/verify_actor_migration.py
python3 scripts/duration-audit/verify_certification.py

# เมื่อแตะ extension / dashboard
cd extensions/vscode && npm run lint && npm test
cd frontend/app && npm run validate
```

---

## Execution order

```text
[blocker] concurrent TransportKind rework ต้องนิ่งก่อน (ranking test เขียว)
    ↓
p8.0 DECISION ─→ p8.1 intake ─→ p8.2 correlation pass ─→ p8.3 shadow gate
                                                              ↓
                                          ┌───────────────────┤
                                          ↓                   ↓
                                   p8.4 canonical emit   p8.5 pipeline + p7.2c
                                          ↓
                                   p8.6 corpus + precision gate
                                          ↓
                                   ── flip เป็น infer ต่อ agent/platform ──

Track B ทำขนานได้หลัง p8.1:
p8.7 workspace auto-register ─→ p8.8 broker auto-setup ─→ p8.9 extension UX
                                                       └→ p8.10 installer
```

- **p8.3 ต้องเสร็จก่อน p8.4 เสมอ** — shadow gate คือตาข่ายกันไม่ให้ p8.4 ทำ
  duration พังโดยไม่รู้ตัว
- p8.7 ต้องเสร็จก่อน p8.A2 จะทดสอบได้
- **ห้ามพลิกเป็น `infer` ก่อน p8.6 ผ่าน gate** — planai2 Release Gates ผูกไว้แล้ว

---

## Open decisions (ต้องตัดสินก่อนเริ่ม item ที่เกี่ยวข้อง)

| id | คำถาม | ผูกกับ |
|---|---|---|
| **p8.D1** | `shadow_log` เก็บใน broker SQLite ตารางใหม่ หรือไฟล์ JSONL หมุนเวียน? ต้องมี retention/ขนาดสูงสุดเท่าไร | p8.3 |
| **p8.D2** | consent UX — prompt ครั้งเดียวรวมทุก agent หรือถามต่อ agent? เก็บ opt-out ที่ไหน | p8.8 |
| **p8.D3** | ตอนพลิก `infer` แล้ว heartbeat ที่ engine ปล่อยควรทับหรืออยู่ร่วมกับ hook heartbeat เดิมในช่วง migration? (ข้อเสนอ: engine เป็นเจ้าของ emit ทันทีที่เปิด ไม่มีช่วงคู่ขนาน) | p8.4 |
| **p8.D4** | corpus label เก็บถาวรบนเครื่องผู้ใช้ หรือสร้างใหม่ทุกครั้งที่รัน report? (privacy: label เป็น metadata ล้วน แต่ยังเป็นข้อมูลพฤติกรรม) | p8.6 |

---

## สิ่งที่ Phase 8 **ไม่** ทำ

- ไม่แก้ §5 decision rules, correlation windows, dedup rules — ของเดิมผ่านเทสต์แล้ว
- ไม่แตะ `resolve_attribution` / `ActorType` บน wire — server contract คงเดิม
- ไม่ทำ planplugin Phase 6 (DeepSeek standalone client) และ Phase 9
  (certification/rollout) — แยกเป็นงานของแผนนั้น
- ไม่ปิดหนี้ live verification ของ Kilo/Kimi/Claude re-auth — ต้องมี executable จริง

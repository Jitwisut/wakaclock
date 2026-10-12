# AI adapter development — ผลส่งมอบ 12 ต.ค. 2026

Branch `codex/heartbeat-capture-release` · ฐาน commit `104d096319bedfcdc8702cc1c4419adb826f602f` · Asia/Bangkok

รอบนี้ปิดช่องทางพัฒนาที่ค้างของ **Cline Windows marker hooks, Roo public task bridge และ Copilot daily connector/self readback** พร้อม local regression และ metadata-only health ใช้ producer spool/inbox/context/delivery เดิม ไม่สร้าง transport หรือปรับ duration/timeout/overlap/heartbeat ID ใหม่ ส่งมอบเป็น source commit บน branch ข้างต้น (ดู commit ที่รวมรายงานนี้จาก Git history) ยังไม่ใช่ candidate build ที่ติดตั้งจริง

**ไม่ได้ประกาศว่ารองรับครบทุก metric ของ 14 providers หรือผ่าน live certification** ขอบเขตที่ provider ไม่ให้หลักฐานยังต้องแยกตามตารางด้านล่าง การไม่มี runtime/login เป็น pending ไม่ใช่ unsupported

## เสร็จในรอบนี้

| รายการ | พัฒนา | Local tests | Artifact / live | หลักฐานและขอบเขต |
|---|---|---|---|---|
| Cline Windows owned hooks | เสร็จตาม contract 4.1.23 | ผ่าน | native Windows pending | `<HookName>.ps1`, UTF-8 BOM, PowerShell launcher → shared Python durable producer; timestamp millisecond string รักษา instant; neutral `cancel:false` ไม่ใช่ ACK |
| Cline setup/uninstall/recovery | เสร็จใน source | ผ่าน | pending | แยก ledger Windows/Unix, Thai/spaced paths, exact-generation ownership/lock และรักษา foreign hooks; Windows install ต้อง explicit contract |
| Roo public task bridge | เสร็จตาม API 3.53.0 | ผ่าน | native provider pending | ใช้ taskStarted/taskCompleted/taskAborted/taskUserMessage/taskToolFailed และ native task ID จริง; ไม่อ่าน prompt/tool arguments/token extras |
| Roo before-CLI durability | เสร็จ | ผ่าน | pending | synchronous fsync spool/context ก่อนถือว่ารับแล้ว; idle collector เดิม; CLI หายใช้ cached verified profile ได้เฉพาะ key/origin เดิม; เปลี่ยนบัญชีหยุด bridge |
| Roo task → project | เสร็จสำหรับ explicit local binding | ผ่าน | UI/provider จริง pending | folder confirmation + revision/history/effective time; project `user_confirmed`, ไม่เดา workspace และไม่ replay mapping ใหม่ใส่ event เก่า |
| Context provenance / old receiver | เสร็จ | ผ่าน HTTP fixture | deployment pending | optional frozen fields ไม่เปลี่ยน JSON/hash เดิม; `user_confirmed_task_git` ถูกส่งเมื่อ receiver ประกาศ capability เท่านั้น; old receiver ยังรับ native context และข้อมูลใหม่คง durable pending |
| Roo setup/health/bundling | เสร็จ | ผ่าน | candidate pending | Enable/Disable, Confirm project, Inspect capture; shared TS transpile เป็น bundled CommonJS โดยไม่พึ่ง sibling repo; verifier ตรวจ resource + manifest + embedded CLI capability |
| Copilot daily download/normalization | เสร็จ | ผ่าน | actual GitHub pending | GitHub users-1-day API v2026-03-10; allowlist 7 nullable counters ตาม feature/UTC day; ไม่มี session/token/model/cost inference |
| Copilot durable job/checkpoint/retry | เสร็จ | ผ่าน PG fixture | actual API pending | 100 rows/batch, report hash+offset, lease 120s/request budget 75s, changed report reset atomically, mixed validation quarantine, duplicate/conflict และ Retry-After รวม signed download |
| Copilot privacy/retention/restore guard | เสร็จในชุด local | ผ่าน PG fixture | physical Cloud restore pending | identity + developer membership + consent version/time ก่อนเก็บ; self read final privacy/integration fence; deletion disposition ก่อนลบ; restored scope disabled ก่อนอ่าน |
| Copilot API/UI/self diagnostics | เสร็จ | ผ่าน | deployment pending | owner/admin revision-configure; caller-only daily readback; nullable != zero; account switch/failure/disabled connector ซ่อน report เก่า; auth/permission/rate-limit/dead/stale/unconfirmed แยก |
| Registry dispositions | อัปเดตแล้ว | ผ่าน | ทุก certification pending | development/runtime/certification แยก; เอา legacy producer durability blocker ที่แก้แล้วออก ไม่ใช้ registry count เป็น support count |

Roo mapping เป็นหลักฐานที่ผู้ใช้ยืนยันจากเวลานั้น ไม่ใช่ native project verification หรือการยืนยัน GitHub PR/cost link อัตโนมัติ Cline/Roo markers ไม่ยกระดับเป็น measured tool interval/file mutation เมื่อไม่มี before–after/mutation evidence

## สถานะ adapter ทั้ง 14 ตาม surface/metric

| Adapter | เส้นทางที่มีโค้ด | สิ่งที่ยังต้องทำ/พิสูจน์ | Live |
|---|---|---|---|
| Codex | CLI transcript/activity, durable cursor/inbox/context/delivery เดิม | IDE/Desktop provenance และ metric ที่ไม่มี operation/interval evidence; unknown ไม่เดาเป็น CLI | pending |
| Claude Code | CLI hooks/transcript/shared spool/file boundary เดิม | native payload/lifecycle/permission wait และ metric-specific intervals | pending |
| Gemini CLI | hooks/spool/marker/file/usage เดิม | native hook payload และ reliable measured pair ตาม provider | pending |
| Generic MCP | explicit producer v3 validation/durable ACK/retry | รับรอง producer contract ที่ติดตั้งจริง ไม่อ้างทุก interaction | pending |
| Kilo Code | CLI/IDE explicit surface + durable tool/file/session/context เดิม | native provider versions และ baseline/idle/upgrade | pending |
| Kimi Code CLI | task/tool/message marker + shared durable boundary เดิม | provider payload/session lifecycle จริง | pending |
| Cline | Unix + Windows marker installer/shared producer รอบนี้ | Windows PowerShell/stdin/Python prerequisite และ provider sessions จริง; file edits/intervals ไม่ถูกสร้างจาก marker | pending |
| OpenCode | native plugin v1/v2 + durable observation/context unresolved เดิม | native project lookup/version, install/restart/contract จริง | pending |
| Cursor | Agent hooks + afterTabFileEdit completed edit fragments เดิม | real Agent/Tab payload และ expected ledger; suggested/rejected ไม่มีหลักฐานไม่เดา | pending |
| Copilot | VS Code agent/CLI hook path เดิม; daily connector รอบนี้ | ไม่มี verified public cross-extension local inline acceptance contract; daily เป็นรายวันเท่านั้น; actual App permission/report/API evidence | pending |
| Roo Code | read-only public task bridge + local user-confirmed project รอบนี้ | real provider/API/native install; tool intervals/file edits/usage ที่ไม่มีหลักฐานยังไม่ implemented | pending |
| Antigravity | existing native metadata normalization/setup path | installed product/version/contract และ metric evidence จริง | pending |
| Windsurf | ยังไม่เปิดช่องทางใหม่ | **owner-pending:** Cascade contract/product version | pending |
| Deep Code | คง registry ID; ไม่จับคู่ DeepSeek | **owner-pending:** product identity | pending |

Copilot inline disposition เป็นข้อจำกัดของ **ช่องทาง acceptance ที่ตรวจยืนยันได้สำหรับ extension เรา** ไม่ใช่คำกล่าวว่า Copilot ไม่มี inline completion ช่องทาง daily ไม่ใช้เป็น local event ชดเชย

## ผลตรวจที่รันจริง

| ชุดตรวจ | ผล |
|---|---|
| Rust Core library | 404 ผ่าน, 2 isolated/loopback ignored; capability 2 tests ตรวจซ้ำหลังปรับ registry |
| Rust CLI bins | 98 ผ่าน รวม native hooks 11 tests |
| Rust server library | 421 ผ่าน, 36 environment-dependent ignored; Copilot targeted 3 tests หลังเพิ่ม signed-download Retry-After ผ่าน |
| Context receiver compatibility HTTP | 1 explicitly-run ignored test ผ่าน: legacy/native ยังส่งได้, new provenance pending → receiver upgrade → ID เดิมและ durable ingress; canonical ยัง unconfirmed |
| PostgreSQL isolated | Copilot integration 1 ผ่าน: config ownership/CAS, consent boundaries, restart/duplicate/conflict/Retry-After, identity revoke, cleanup dispositions และ restore barrier |
| Shared Python producer | 28 ผ่าน รวม Cline millisecond timestamp |
| Shared TS spool | 7 ผ่าน รวม Roo old event ไม่ใช้ mapping ใหม่ และ provenance frozen side stream |
| Kilo/OpenCode/shared Node regressions | 18 ผ่านก่อน provenance additive follow-up; shared spool 7 ตรวจซ้ำหลัง follow-up |
| VS Code | 219 tests / 24 files ผ่าน; TypeScript lint ผ่าน; isolated packaged shared resource load ผ่าน |
| Frontend | 16 targeted tests / 4 files ผ่าน; typecheck และ source lint ผ่าน |
| Artifact/certification tooling | 54 tests ผ่าน; synthetic packages ไม่ใช่ artifacts ของ candidate จริง |
| Strict Clippy | workspace/all-targets `-D warnings` ผ่าน; ตรวจซ้ำหลัง final download/capability changes |
| Duration golden | fixture/input เดิม 3,600 วินาที; error 0 |
| Delivery backlog 1,191 ข้าม 3 วัน + new heartbeat | idle recovery/reconciliation ผ่าน; drain 37.559543167 วินาทีใน isolated mock test ไม่ใช่ production measurement |

ผล machine-readable: `output/adapter-development-2026-10-12/latest.json` มีแต่ metadata ผลตรวจ ฐานข้อมูลชั่วคราวปิดแล้ว Docker ไม่ได้เปิดในรอบนี้ ไม่มีการติดตั้ง hook, replay spool หรือเปลี่ยนบัญชี/credential จริง

การเลือก test แบบกว้าง `team_trust` ครั้งหนึ่งรวม fixture helper `restore_drill_fixture_stages` ที่ต้องใช้ `TEAM_RESTORE_PHASE` แล้วขาด environment จึง **ไม่ผ่านและไม่ถูกนับเป็นหลักฐาน** targeted weekly registry/revocation/cleanup/restore guard ผ่าน; ไม่อ้างว่ารัน physical restore drill ใหม่ครบจากผลนี้

## ยังไม่เสร็จ / รอภายนอก

1. **Team weekly aggregate/CSV ของ Copilot daily ยังไม่พัฒนาใน adapter slice นี้:** self readback เท่านั้น ไม่มี cross-person aggregate รั่ว; ต้องใช้ Phase 2 cohort ≥5/publication inference/privacy และกำหนดการแปลง provider UTC days กับ organization week โดยชัดเจนก่อนทำ projection
2. Metrics ที่ contract ยังไม่ให้หลักฐาน (เช่น measured pair, file mutation, inline suggested/rejected, token/model/cost ของบาง adapter) คง not_implemented/evidence_pending/unavailable ราย metric ตาม registry ไม่ประกาศรองรับแทนหลักฐาน
3. Deep Code/Windsurf รอเจ้าของตามข้อตกลงเดิม แยกจากงานส่วนกลาง
4. ยังไม่ได้ deploy migration/API/worker/VSIX จริง หรือใช้ actual GitHub App credentials/read permission; ไม่เปลี่ยน permission เอง
5. ยังไม่มี clean committed candidate ใหม่, 8 artifacts จาก SHA เดียว, Actions native smoke สี่ targets, installed Windows/macOS lifecycle และอย่างน้อย 10 provider sessions ต่อ surface/OS/metric
6. Canary 7 วันทำงานจริง, signing, Marketplace/stable, Cloud restore และ Team commercial gates ยังเป็นงานแยก

## ขั้นถัดไปและ runbook

1. ตรวจ diff/commit เฉพาะงานนี้บน `codex/...` เมื่อเจ้าของสั่ง; แยกไฟล์ค้าง marketing/generated resources/launch ของงานอื่น ไม่ push/merge main
2. Receiver/API พร้อม migration `036` และ context provenance capability **ก่อน** worker/client/UI
3. Roo: enable จาก command เฉพาะ provider 3.53.0; project mapping ต้อง explicit observed task/folder/revision confirmation; Inspect แสดง metadata health ไม่แสดง root/key; account/config change หยุด bridgeและต้อง Enable ใหม่
4. Cline Windows: provider 4.1.23 + Python prerequisite; explicit contract flag; foreign hooks ต้องใช้ additive manual setup ไม่ทับ; enable Hooks ใน Cline แล้วรับรอง native stdin execution จาก installed artifact
5. Copilot: Team rollout + existing verified organization installation/metrics permission + explicit feature flag/API config; สมาชิกต้องยินยอมและ verified GitHub numeric identity; provider day เป็น UTC และไม่ย้อนหลัง consent; lack permission แสดง required ไม่ขอเพิ่ม scopeเอง
6. ตรึง clean candidate → Actions 4 targets → installed native smoke → provider evidence/readback; clean SHA ใหม่หลังแก้ failure ไม่ยืม certificate จาก build เก่า
7. จัดทำ weekly daily-counter projection และ certification แยกจาก self adapter readback; อย่าเปิดขาย/complete gate ก่อนหลักฐานครบ

Rollback: ปิด Roo tracking/Copilot feature flag หรือ disable configured daily connector และถอดเฉพาะ owned Cline hooks; รักษา spool, context IDs, inbox/queue, receipts, mapping/history, report checkpoints และ additive migrations ข้อมูลค้างไม่ถูกลบเพื่อรีเซ็ตสถานะ

## Contract sources และข้อจำกัดหลักฐาน

- [Cline HookProcess](https://github.com/cline/cline/blob/main/apps/vscode/src/core/hooks/HookProcess.ts), [hook factory](https://github.com/cline/cline/blob/main/apps/vscode/src/core/hooks/hook-factory.ts): current Windows .ps1 execution path; รองรับใน source ตาม inspected 4.1.23 ยังไม่ผ่าน PC จริง
- [Roo public API](https://github.com/RooCodeInc/Roo-Code/blob/main/packages/types/src/api.ts), [events](https://github.com/RooCodeInc/Roo-Code/blob/main/packages/types/src/events.ts): native task identity/public markers ไม่อนุมาน workspace หรือ content
- [Copilot REST usage reports](https://docs.github.com/en/rest/copilot/copilot-usage-metrics), [example schema](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema): users/day/feature counters, existing installation read permission; null != zero
- [VS Code InlineCompletion API](https://code.visualstudio.com/api/references/vscode-api#languages.registerInlineCompletionItemProvider): provider registers its own completions; ข้อสรุปว่าเรายังไม่มี verified cross-extension acceptance contract เป็นข้อจำกัดหลักฐานช่องทางของเรา ไม่ใช่การพิสูจน์ว่า provider ไม่มีข้อมูลใดเลย

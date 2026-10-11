# AI adapters และ Journal recovery — implementation ledger

วันที่ตรวจ: 11 ต.ค. 2026 (Asia/Bangkok) · branch `codex/heartbeat-capture-release` · ฐาน `8c5e21d`

**สถานะทั้งแผน: บางส่วน ยังไม่รับรองครบ** ตารางนี้แยกการพัฒนาออกจากหลักฐาน runtime/certification ไม่ใช้จำนวน 14 adapter เป็นจำนวนที่รองรับครบ ไม่มีการติดตั้ง hook จริง ซ่อม journal จริง หรือส่งข้อมูลย้อนหลังของผู้ใช้ในรอบนี้

## สิ่งที่ส่งมอบในชุดนี้

- Registry เพิ่ม `development_status`, `runtime_status`, `certification_status`, `os_capabilities` และ contract แบบ additive; field เดิมยังอยู่ ไฟล์จาก legacy producer ระบุ development เป็น partial จนปิด durability ครบ
- Python/TypeScript producer spool เก็บเฉพาะ allowlist metadata ลง disk ก่อนเรียก CLI; observation ID และเวลาสังเกตเดิมคงอยู่ CLI ไม่พร้อม/response หายไม่ลบ spool
- Collector เดิมระบาย spool ระหว่าง idle ตรวจ durable inbox ACK และ event ID ก่อนลบ แยก scope ตาม account/origin รองรับ API-key เก่าเฉพาะหลักฐาน owner/origin ตรงกัน ใช้ cursor หมุนเวียนเพื่อไม่ให้รายการเสียขวางรายการดี
- Pause capture อ่าน desired state ถาวร; marker ช่วงพักไม่ถูก replay เมื่อ Resume รายการที่พัก/ผิด schema/ยืนยัน project ไม่ได้ยังเก็บไว้พร้อมสถานะ
- Native setup ใช้ ownership ledger และ exact generations; foreign hooks/config และ spool ถูกเก็บไว้เมื่อ uninstall
- VS Code เพิ่ม Inspect Journal, Prepare Journal Recovery, Apply Journal Recovery และ Journal Recovery History ตรวจได้แม้ capture fault
- Runtime/scanner/recovery ใช้ checksum/sequence/schema validator ร่วมกัน หยุดก่อน record แรกที่ตรวจไม่ผ่าน ไม่เชื่อ tail หลังเสีย
- Prepare เก็บ manifest; Apply ต้องกด modal confirmation ตรวจ identity/hash/ownership ใหม่หลังยืนยัน สำรองต้นฉบับทั้งไฟล์และ identity ก่อนสร้าง checkpoint generation ใหม่
- ตรวจ handoff receipts แบบ SQLite READ_ONLY ตาม ID/scope รวม scope เก่าที่มี owner proof ไม่ migrate ไม่ drain ไม่เปิด payload/credential
- Recovery เก็บขั้นตอนถาวร รองรับ interruption ก่อน/หลัง atomic activation และ Apply ซ้ำ ไม่ย้อนกิจกรรมใหม่หลัง activation
- เก็บ receipt observation ใน history; `journal เขียนได้`, `CLI รับแล้ว` และ `server รับแล้ว` แยกกัน Unknown tail/unsnapshotted records ยังคง unconfirmed ไม่มีการล้างคำเตือนประวัติเมื่อ writer กลับมา healthy
- Delivery snapshot เพิ่ม producer spool health และ capability negotiation; old receiver ได้สถานะ unavailable แทนสถานะ journal ใหม่ที่ยังไม่รองรับ Overview/Heartbeats/Team Trust ไม่อนุมาน capture ครบจากคิวว่าง
- Internal artifact verifier ตรวจ recovery commands, compiled module และ CLI capabilities ใหม่; bundle copy ตัด Python cache/node_modules ออก

## Adapter ledger (metric/surface ที่ทำในรอบนี้)

ทุกแถวรับรองจริงเป็น **pending สำหรับ candidate ใหม่** เวอร์ชัน contract ที่อ่านจากเอกสาร/types ไม่ใช่ provider ที่รันผ่านแล้ว

| Adapter / surface | พัฒนา | Local evidence | สิ่งที่ยังขาด / ควรทำต่อ |
|---|---|---|---|
| Codex CLI | เส้นทาง transcript/inbox เดิมคงอยู่; บางส่วนโดยรวม | Core/parser/cursor regression ผ่าน | ตรวจ operation identity native/wrapper และ session context ย้อนหลังกับ provider จริง |
| Codex IDE/Desktop | บางส่วน | Existing provenance fixtures ผ่าน | Discovery และ surface classification ครบทุกแหล่งยังไม่ปิด; ไม่ใช้ branch ปัจจุบันแทนอดีต |
| Claude Code CLI | Native markers + scoped spool/handoff/health เพิ่มแล้ว | Marker/permission-wait/privacy + idle handoff ผ่าน | Legacy file producer durability ยังบางส่วน; tool intervals ไม่อนุมานจาก PreToolUse ก่อน permission |
| Gemini CLI | Hook markers + spool/recovery/setup เพิ่มแล้ว | Native normalization/setup/spool ผ่าน | Hook contract ไม่มี unique operation ID ที่พิสูจน์ execution interval; ไม่เปิด Measured Active จาก marker; legacy file path ยังบางส่วน |
| Generic MCP explicit contract | v3 durable ingress/validation/ACK เดิมใช้ต่อ | v3/core/CLI regression ผ่าน | รับรองเฉพาะ producer ที่ส่ง explicit contract; producer-side retry/spool ของแต่ละ host ต้องตรวจ ไม่อ้างทุก MCP interaction |
| Kilo CLI/IDE | Shared marker spool + owned installer/recovery เพิ่มแล้ว | Plugin 13, shared spool และ installer fixture ผ่าน | CLI/IDE surface ต้องเลือกอย่างชัดเจน; file/session/tool-snapshot producer เดิมยังมีช่องก่อน CLI จึงไม่ถือว่าทั้ง adapter เสร็จ |
| Kimi Code CLI | Task/tool/message normalization + Python spool + owned TOML hook เพิ่มแล้ว | Native/privacy/setup preservation ผ่าน | ตรวจ config family/รุ่นจริง; legacy edit/snapshot path ยังบางส่วน |
| Cline macOS IDE | File-hook setup/recovery + scoped spool เพิ่มแล้ว | Foreign hook, symlink, interruption, neutral response และ metadata tests ผ่าน | Provider/runtime จริงยัง pending; ไม่สร้าง file edits/tool intervals จาก task markers |
| Cline Windows IDE | Normalizer ใช้ร่วมได้; setup ยังไม่ปิด | ยังไม่มี native Windows evidence | ตรวจ Windows hook execution/path contract ก่อนทำ installer; ไม่ใช้การไม่มี Windows เป็น unsupported |
| OpenCode CLI | Native plugin + explicit v1/v2 installer + spool/handoff เพิ่มแล้ว | Native setup/ownership + plugin 3 tests ผ่าน | Gate เฉพาะ types 1.19.0 และ 2.0.26; runtime/version/login pending; API session lookup ที่ไม่มี project evidence ต้องคง unresolved |
| Cursor Agent IDE | Agent markers/spool/setup เพิ่มแล้ว | Native/setup/privacy fixtures ผ่าน | Operation identity tool-level ยังไม่พิสูจน์; generation ID ไม่แทน tool call; legacy file capture ยังบางส่วน |
| Cursor Tab/inline | ยังไม่ปิด pipeline | ยังไม่ทดสอบ integration ใหม่ | ทำ afterTabFileEdit counters แบบ transient ตาม payload จริง; contract/storage/receiver สำหรับ inline ยังต้องพัฒนา |
| Copilot VS Code agent | Native markers/spool + own hook file เพิ่มแล้ว | Native/setup/privacy fixtures ผ่าน | เช็ก workspace trust/chat.useHooks และ payload รุ่นจริง; token/model/cost ที่ไม่มีเป็น unavailable |
| Copilot CLI | Hook file แยก, VS Code-compatible PascalCase contract เพิ่มแล้ว | Owned setup/uninstall/foreign file tests ผ่าน | Provider runtime/login และ exact contract payload pending; custom COPILOT_HOME fail closed; ไม่รวม VS Code/daily/inline |
| Copilot inline / daily API | ยังไม่ปิด pipeline | ไม่มี live ledger | ทำแยก accepted/suggested/agent และ daily team data; ไม่แจก token/cost รายวันลง session/PR |
| Roo Code IDE | ยังไม่ต่อ bridge | ตรวจ official public API แล้ว | task events มี ID แต่ API ที่ตรวจไม่มี task→project binding; ต้องได้ runtime/contract หลักฐานก่อนสร้าง activity ที่ผูก project ห้ามเดาจาก active workspace |
| Windsurf IDE | ยังไม่ต่อ | Contract/product evidence pending | เอกสารปัจจุบัน redirect ไป Devin Desktop; รอเจ้าของเลือกขอบเขต/รุ่นก่อนเปลี่ยน product contract |
| Antigravity IDE | Documented post-tool/invocation/stop markers + owned hooks + spool เพิ่มแล้ว | Normalizer/privacy/setup tests ผ่าน | ไม่ติดตั้ง PreToolUse ที่ต้องส่ง permission decision; ไม่มี measured interval/edit/usage จาก marker; live runtime pending |
| Deep Code | ระงับการจับคู่ provider | Identity regression ผ่าน | รอชื่อ/URL ผลิตภัณฑ์จากเจ้าของ; คง ID เดิมและไม่จับคู่ DeepSeek |

## Journal ledger

| ส่วน | พัฒนา | Local tests | รับรองจริง / ข้อจำกัด |
|---|---|---|---|
| Inspect / scanner | เพิ่มแล้ว | Torn write/checksum/sequence/schema/symlink ผ่าน | Windows filesystem semantics และ native UI ยัง pending |
| Prepare / persisted dry-run | เพิ่มแล้ว | Source unchanged, no verified checkpoint, scope mismatch ผ่าน | ต้องมี identity/verified scope ก่อน Apply; ambiguous legacy ownership ไม่ถูกแย่ง |
| Backup / generation / activation | เพิ่มแล้ว | Before/after activation interruption, Apply ซ้ำ, identity mismatch ผ่าน | Full process-kill matrix ทุก fsync/backup/candidate จุดยังไม่ครบ |
| CLI receipt inspection | เพิ่มแล้ว | Read-only subprocess + same-owner/origin key rotation ผ่าน | Receipts พิสูจน์ local acceptance ไม่ใช่ server delivery |
| History / historical warning | เพิ่มแล้ว | Original retained, nullable unknown, receipt counts ไม่เปลี่ยน completeness ผ่าน | ยังไม่มี UI ตัดสิน unknown tail หรือ manual ownership adjudication; คำเตือนยังอยู่จนมีผลตัดสินที่พิสูจน์ได้ |
| Writer scope / account switch | เพิ่มแล้ว | New token/journal identity + live/reused PID refusal ผ่าน | Guard ที่ ownership ไม่ชัดยังหยุดและต้องตรวจ ไม่ลบอัตโนมัติ |
| Reconciliation / resume | ใช้ pipeline เดิมหลัง Reload | Lost ACK/ID replay และ damaged checkpoint ไม่ adopt ก่อน Apply ผ่าน | History เก็บ observation เวลา Prepare/Apply; ยังไม่ใช่ automatic server receipt reconciliation ราย recovery |

## คำสั่งและขั้นตอนใช้งาน (หลังติดตั้ง candidate ที่ตรวจแล้ว)

1. เปิด Command Palette → **AtoAxis: Inspect Journal** เลือก journal ของ scope นี้หรือ key เก่าที่มี proof; ไม่มีการแก้ journal
2. **Prepare Journal Recovery** อ่านแผนและสถานะ accepted/missing/conflict; unknown tail เป็นไม่ทราบ ไม่เป็นศูนย์
3. **Apply Journal Recovery** ตรวจแผนและกด Apply Recovery; ถ้า hash/account เปลี่ยน, writer ของ window อื่นยังอยู่, backup ล้มเหลว หรือ receipt conflict ให้หยุด ไม่เลือกทับเอง
4. Reload Window เมื่อ activation สำเร็จเพื่อ handoff verified checkpoint ผ่าน ID/time เดิม; ตรวจ delivery แยกใน Trust/Heartbeats
5. **Journal Recovery History** ดู source hash, ownership hash, phases และ receipt observation ไม่ลบ backup/ส่วนเสีย

ตัวอย่าง setup เป็น opt-in ไม่ได้รันกับบัญชีจริงในรอบนี้:

```sh
wakaclock ai activity-setup --adapter claude-code --yes
wakaclock ai activity-setup --adapter kimi-code-cli --yes
wakaclock ai activity-setup --adapter copilot --contract copilot-cli-vscode-compatible-v1 --yes
wakaclock ai activity-setup --adapter opencode --contract opencode-v1-1.19.0 --yes
wakaclock ai activity-setup --adapter opencode --contract opencode-v2-2.0.26 --yes
wakaclock ai activity-setup --adapter antigravity --yes
```

Python 3 เป็น prerequisite ที่ setup ต้องตรวจ; ไม่มี runtime ไม่ถือว่าติดตั้งสำเร็จ OpenCode ตรวจ exact executable version และ custom config root ไม่ถูกเดา Cline Windows setup ยังไม่เปิด Custom CLI/foreign hooks ไม่ถูกเขียนทับ Uninstall/rollback รักษา spool, journals, recovery history และ queue IDs

## ผลตรวจในเครื่อง

- VS Code: 202 tests / 19 files และ TypeScript lint ผ่าน (ตรวจล่าสุดจะบันทึกในรายงาน candidate)
- Core: 387 unit + 1 attribution conformance + 12 offline delivery tests ผ่าน; additive capability/scope inspection checks ตรวจเพิ่มหลังแก้
- CLI: 86 unit tests และ 6 isolated real subprocess handoff tests ผ่าน
- Python producer: 6; shared TypeScript spool: 3; OpenCode native plugin: 3 ผ่าน
- Kilo: 13 plugin tests + installer fixture ผ่าน
- Backend capture health validation + Team trust health targeted tests ผ่าน; ไม่อ้าง full database integration
- Frontend: typecheck + 8 delivery-health tests ผ่าน
- Artifact tooling: 51 tests ผ่าน; ยังต้องตรวจ artifact จริงของ commit ใหม่
- Strict Clippy CLI/Core/Server: `--all-targets -- -D warnings` ผ่านก่อน final source check; ผลล่าสุดอยู่ใน candidate report
- Duration golden: total 3600 seconds, total/day error 0; Python/Rust port regression ผ่าน ไม่เปลี่ยน fixture/formula
- 1,191 backlog ข้ามสามวัน: real CLI + mock loopback server + isolated home ผ่าน; test รวม new heartbeat และ idle drain จบ 39.33 วินาที เงื่อนไข drain ภายใน 2 นาทีผ่าน
- Sandbox ครั้งแรกปฏิเสธ loopback bind จึงรันใหม่ด้วย permission สำหรับ mock test เท่านั้น; ไม่มี Docker/บริการจริง/ข้อมูลจริง

## งานถัดไปเรียงความสำคัญ

1. ปิด legacy file/session producer durability โดยเฉพาะ Kilo/shared shell emit; ห้าม replay tool-before ด้วย baseline ปัจจุบันย้อนหลัง
2. เพิ่ม recovery fault injection ครบ backup/fsync/candidate/guard ทุกจุด และ UI disposition ของ unknown tail/ownership ambiguity
3. ปิด Codex CLI/IDE/Desktop discovery/provenance, scoped producer health ราย adapter และ parked unconfirmed-spool adjudication
4. ต่อ Cursor/Copilot inline และ Copilot daily API ด้วย receiver ก่อน producer; counters/provider meanings ต้องแยก
5. ขอ runtime/contract หลักฐานสำหรับ Roo/Cline Windows และคำตอบเรื่อง Windsurf/Deep Code แล้วต่อเฉพาะ scope ที่ยืนยัน
6. ตรึง candidate ใหม่จาก clean commit, ตรวจ native install/recovery/upgrade/rollback และอย่างน้อย 10 sessions ต่อ surface/OS/metric ที่จะประกาศ
7. Canary 7 วันทำงานจริง, signing และเผยแพร่ทั่วไปยังเป็น gate แยก

## เอกสาร contract ที่ตรวจ

- [Kimi hooks](https://moonshotai.github.io/kimi-cli/en/customization/hooks.html)
- [OpenCode plugins v1](https://opencode.ai/docs/plugins/), [v2](https://dev.opencode.ai/v2/docs/build/plugins/), [migration](https://dev.opencode.ai/v2/docs/build/plugins/migrate-v1/); ตรวจ published official types `@opencode-ai/plugin@1.19.0`, `@opencode/plugin@2.0.26`, `@opencode/schema@2.0.26` แบบ read-only
- [Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference), [VS Code hooks](https://code.visualstudio.com/docs/agents/reference/hooks-reference)
- [Antigravity hooks](https://antigravity.google/docs/hooks)
- [Cursor hooks](https://prod.cursor.com/docs/hooks)
- [Roo public API](https://github.com/RooCodeInc/Roo-Code/blob/main/packages/types/src/api.ts), [event implementation](https://github.com/RooCodeInc/Roo-Code/blob/main/src/extension/api.ts)

เอกสารสนับสนุนการทำ code contract เท่านั้น ไม่แทน payload/live certification ของ candidate บนเครื่องจริง

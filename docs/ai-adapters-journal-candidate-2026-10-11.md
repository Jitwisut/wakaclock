# รายงานส่งมอบ AI adapters / Journal recovery — 11 ต.ค. 2026

**ทั้งแผนยังไม่เสร็จและยังไม่รับรองจริงครบ** ชุดนี้ส่งมอบฐาน durability, recovery แบบผู้ใช้กด Apply และ native activity บางช่องทาง ส่วนงานพัฒนาที่เหลือกับหลักฐานภายนอกแยกไว้ด้านล่าง ไม่มีการใช้ผลจำลองแทน provider/Windows/canary จริง

## Commit และ candidate

- Branch: `codex/heartbeat-capture-release`, ฐาน `8c5e21d`
- `47378ed`: capability แยกสามสถานะ, shared producer spool, native setup/normalization, journal scanner/recovery/commands, read-only receipts และ health
- `250c659`: ปิดการ reuse recovery artifact หลัง fsync ล้มเหลว; ตรวจ durability ใหม่ก่อน activation และเพิ่ม fault injection ทุก file/directory fsync ของ Apply
- Candidate source: `250c659c6b258e16f74f269f8cd6200b770747c2` จาก checkout สะอาด CLI build แบบ `release --locked --offline`; compile/package extension ภายหลัง build CLI และตรวจ source inventory กับ commit อีกครั้ง
- Internal unsigned `0.2.0`, macOS arm64 เท่านั้น; ไม่ใช่ stable/Marketplace และไม่ได้ติดตั้งทับ client จริง ไม่มีการ push หรือ merge เข้า main

Artifacts อยู่ใน `output/ai-adapters-journal-250c659/`:

| Artifact / evidence | ผล |
|---|---|
| `atoaxis-vscode-darwin-arm64.vsix` | SHA256 `47f096506c9490c0497f0c6a295d9813a1da493bc4ca9bd7deb293272c9a3db8` |
| `wakaclock-0.2.0-darwin-arm64-250c659c6b25-internal.tar.gz` | SHA256 `dd4b45b14ba7e0a18aeb8240e031450db95c36e4f1853452a79ccb1007c4f5e1` |
| Binary ในทั้งสอง package | SHA256 `027b8563aea3584ad3210e451d84cb127925fe5751bc6d36ad2f5126e57dc16f`; bytes ตรงกัน |
| AI bundle | 68 ไฟล์; digest `56a8be67c32a0c080ead48d17a23ea6bfd1aaa485b6368ac766037c8f365de6e` |
| `candidate-darwin-arm64.json` | source/compiled inventory, protocol, capability, architecture, hashes; `production_ready=false` |
| `artifact-verification.json` | VSIX + standalone integrity ผ่าน รวม path, hash, bundle และ manifest |
| `native-smoke.json` | binary ที่ดึงจาก archive รัน `--version`/`--help` ได้; ไม่โหลด config ไม่ส่ง activity ไม่ทดแทน install/recovery certification |

ไม่มี Windows/macOS x64 artifact ของ source นี้ ยังไม่มี signing/notarization

## ผลตรวจในเครื่อง

| ชุดตรวจ | ผลและขอบเขต |
|---|---|
| VS Code | 203 tests / 19 files + TypeScript lint ผ่าน; candidate compile/package ผ่าน |
| Journal fsync faults | ล้มเหลวทีละจุดใน file/directory fsync ของ Apply แล้ว resume; ต้นฉบับ/ID/time เดิมคงอยู่, Apply ซ้ำไม่ rewind, historical incomplete ยังอยู่ |
| Core | 387 unit + 1 attribution conformance + 12 offline delivery ผ่าน; full rerun หลัง commit แรกผ่าน |
| CLI | 86 unit + 6 isolated subprocess handoff ผ่าน |
| Shared producers | Python 6, TypeScript 3, OpenCode plugin 3, Kilo 13 และ installer fixture ผ่าน |
| Server / Team trust | targeted capture health validation และ 5 Team trust tests ผ่าน; ไม่อ้าง full database integration |
| Frontend | typecheck + 8 delivery health tests ผ่าน |
| Rust quality | strict Clippy CLI/Core/Server `--all-targets -- -D warnings` ผ่าน; ไม่มี Rust source เปลี่ยนหลังตรวจ |
| Artifact tooling | 51 tests ผ่าน; ตรวจ packages จริงผ่านอีกครั้ง |
| Duration regression | golden total 3600 seconds; total/day error 0; port regression ผ่าน โดย fixture/formula เดิม |
| Backlog 1,191 รายการ / 3 วัน | real CLI, mock loopback API และ isolated data ผ่าน รวมใหม่หนึ่งรายการและ idle drain; test จบ 39.33 วินาที |

ฟิกซ์เจอร์ metadata ใช้ตรวจว่า contents/credential ที่ทำเครื่องหมายไม่หลุดผ่าน allowlist; ยังไม่ใช่ outbound/storage audit ของทุก provider จริง ทั้งชุดไม่เปิด Docker และไม่แตะคิว/journal ของผู้ใช้จริง

## เสร็จแล้วในขอบเขตชุดนี้

| รายการ | พัฒนา / local | รับรองจริง | สิ่งที่ทำต่อ |
|---|---|---|---|
| Capability dimensions / OS rows | เพิ่มแล้ว / ผ่าน | pending | เพิ่ม live evidence ราย metric/surface |
| Native activity producer spool + idle handoff | เพิ่มแล้ว / ผ่าน | pending | ปิด legacy producers และ parked scope adjudication |
| Kimi / Copilot CLI / Antigravity native markers และ owned setup | เพิ่มแล้ว / ผ่าน | pending | ตรวจ payload รุ่นจริงและ native setup |
| OpenCode v1/v2 plugin contracts และ installer | เพิ่มแล้ว / ผ่าน | pending | runtime exact version, unresolved project evidence |
| Claude/Gemini/Cursor/Cline marker paths | ต่อ shared durability แล้ว / ผ่าน | pending | file/session path และ Windows ตาม ledger |
| Inspect / Prepare / Apply / History | เพิ่มแล้ว / ผ่าน | pending | full process-kill/native matrix และ unknown disposition |
| SQLite read-only scoped receipts | เพิ่มแล้ว / ผ่าน | pending | server delivery reconciliation ราย recovery |
| Historical incomplete / spool health | เพิ่มแล้ว / targeted tests ผ่าน | pending | ราย adapter/surface และ deployment ใหม่ |
| Internal macOS arm64 candidate | สร้างและ verify ผ่าน | pending | install/upgrade/rollback จริง ก่อนรับรอง |

รายละเอียด adapter ทั้ง 14 ตัวและ Journal แต่ละช่องทางอยู่ใน [implementation ledger](ai-adapters-journal-recovery.md) จำนวน registry ไม่ใช่จำนวน adapter ที่รองรับครบ

## ยังไม่เสร็จ — งานพัฒนา

1. **P1: legacy file/session/tool-snapshot durability** ของ Kilo และ shared shell producer ยังมีช่องก่อน CLI; ห้าม replay tool-before ด้วย baseline ปัจจุบันย้อนหลัง
2. **P1: Recovery disposition / ownership** ยังไม่มี UI ตัดสินส่วนที่อ่านไม่ได้หรือ legacy ownership ที่กำกวม; ยังไม่มี automatic server receipt reconciliation ต่อ recovery และ full process-kill matrix
3. **P1: Codex surfaces และ health** discovery/provenance CLI/IDE/Desktop ยังไม่ครบ; spool health ยังไม่แยกราย adapter/surface, unconfirmed scope ไม่มีขั้น adjudication และ OpenCode project lookup ที่ unresolved ยังต้องปิด durable disposition
4. **P2: Cursor/Copilot inline และ Copilot daily** receiver/storage/producer contract ยังไม่ครบ ต้องคง accepted/suggested/agent edits และ daily granularity แยกกัน
5. **P2: Roo bridge / Cline Windows setup / Windsurf** ยังไม่ต่อช่องทางที่พิสูจน์ project/runtime contract ได้; การไม่มีเครื่องไม่ใช่ unsupported
6. **P2: global bounded spool work** ปัจจุบันจำกัด 100 records ต่อ verified scope; ต้องปิดงบงานรวมเมื่อมี aliases จำนวนมาก
7. **P2: release targets** candidate ใหม่ยังมีเพียง macOS arm64; native certification, อีกสาม targets, standalone plugin packaging และ release notes/support matrix จากหลักฐานจริงยังต้องทำ

## รอเจ้าของหรือ runtime

- Deep Code: ชื่อ/URL ผลิตภัณฑ์ที่ registry หมายถึง; ไม่มีการจับคู่ DeepSeek
- Windsurf: ยืนยันรุ่น/ผลิตภัณฑ์และขอบเขต หลังเอกสารทางการ redirect ไป Devin Desktop; ไม่เปลี่ยนชื่อ provider แทนเจ้าของ
- Provider runtime/login/payload จริง รวม API ที่พิสูจน์ task→project ของ Roo และ Cline Windows contract
- Windows PC และ architecture ที่จะรับรอง; อย่างน้อย 10 sessions ต่อ adapter/surface/OS/metric พร้อม expected ledger
- Canary 7 วันทำงานจริง, signing และการเผยแพร่ทั่วไปเป็น gate แยก ไม่มีผลผ่านจากชุดจำลองนี้

## งานถัดไปเรียงความสำคัญ

เริ่มจาก legacy producer durability และ durable unresolved disposition จากนั้นปิด recovery adjudication/process-kill, Codex surfaces/health, inline/daily receiver และ targets ที่เหลือ งานส่วนกลางทำต่อได้ระหว่างรอคำตอบ provider ส่วนการติดตั้งเปิดเฉพาะ contract ที่ตรวจแล้วและต้องออก candidate ใหม่ทุกครั้งที่ source เปลี่ยน

การใช้งานซ่อมจริงต้อง Inspect → Prepare → ตรวจแผน → ผู้ใช้กด Apply เท่านั้น ไม่ลบต้นฉบับ, unknown tail, queue IDs หรือ migration เพื่อให้สถานะดูปกติ การ rollback ปิด feature/adapter และคงข้อมูลถาวรไว้

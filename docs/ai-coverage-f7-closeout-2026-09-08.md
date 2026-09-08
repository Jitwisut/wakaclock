# F7 closeout — remote, cloud and additional editor coverage

วันที่: 2026-09-08  
สถานะ: **implementation และ local lifecycle gates ปิดแล้ว; live certification เป็น release gate ภายนอก**

## สิ่งที่ปิดในโค้ด

- เพิ่ม topology contract สำหรับ local, SSH, WSL, dev-container, remote extension
  และ cloud job โดยใช้ opaque device/workspace/worktree/session IDs; path, hostname,
  repository URL และ credential ไม่ออกจาก collector
- เพิ่ม explicit workspace mapping ที่รับเฉพาะ absolute roots และปฏิเสธ basename
  fallback, conflicting roots และ overlapping local/remote mounts
- ต่อ `wakaclock ai emit` เข้ากับ `HandoffLedger` และ SQLite queue: บันทึก receipt
  ก่อน broker submit, acknowledge หลัง accepted/duplicate, replay pending receipt
  หลัง restart และ deduplicate ข้าม reconnect ด้วย scoped mutation proof
- บังคับ authenticated bridge สำหรับ remote surfaces และ authenticated callback
  boundary สำหรับ cloud jobs; `CloudJobEvidence` ต้องมี opaque auth key, job,
  tool และ file-mutation identity และไม่มี commit-author shortcut
- ป้องกัน source-sequence rollback, retired collector reconnect และ concurrent
  ledger load/modify/save ด้วย per-handoff OS lock; reconnect จะ reset sequence
  เฉพาะเมื่อ boot/session เปลี่ยน
- เพิ่ม `wakaclock ai topology --json` และ `wakaclock ai capabilities --json`
  สำหรับ setup/diagnostics โดย editor name ไม่สามารถยกระดับ generic LSP/Zed
  document change เป็น AI authorship
- VS Code extension host ส่ง `remote_extension` surface ให้ CLI เมื่อทำงานผ่าน
  Remote SSH/WSL/Container; runtime และ authenticated bridge IDs ยังต้องมาจาก
  deployment setup ก่อนเริ่มส่ง telemetry
- คง browser paste เป็น `unknown` หากไม่มี bounded provenance token และยังไม่เก็บ
  clipboard contents หรือขอ permission เพิ่ม

## หลักฐาน local

- `cargo fmt --all` ผ่าน
- `cargo check --workspace` ผ่าน
- `cargo test -p wakaclock-core`: 252 ผ่าน และ attribution conformance 1 ผ่าน
- `cargo test -p wakaclock-cli --bin wakaclock`: 58 ผ่าน
- `cargo test -p wakaclock-server --bin wakaclock-server`: 185 ผ่าน, 7 ignored
  (integration database ต้องมี ClickHouse/PostgreSQL แยก)
- VS Code: 108 tests ผ่าน, TypeScript lint และ compile ผ่าน
- AI hook: `bash -n` และ common emitter test ผ่าน
- `git diff --check` ผ่าน
- smoke: SSH accepted + reconnect duplicate, cloud accepted with authenticated
  evidence, and missing bridge rejected

## Release gates ที่ยังต้องใช้ environment จริง

เกณฑ์เหล่านี้อยู่นอก local repository จึงไม่อ้างว่า certified จาก fixture:

1. authenticated SSH/remote-extension bridge run
2. WSL และ dev-container teardown/restart จริง พร้อมตรวจ receipt หลัง process ตาย
3. disposable cloud job ที่ส่ง tool-result callback ผ่าน authenticated boundary ถึง
   dashboard
4. editor capability certification บน JetBrains, Neovim, Zed และ remote extension

Topology ยังไม่ถูกเพิ่มเข้า strict broker v1 envelope จนกว่า F8 compatibility rehearsal
จะกำหนด additive wire migration และ server rollout/rollback ครบถ้วน

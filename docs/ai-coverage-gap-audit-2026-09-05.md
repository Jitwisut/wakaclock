# AI coding coverage: gap audit and proposed execution plan

วันที่ตรวจ: 2026-09-05

ขอบเขต: ตรวจ source ใน working tree ปัจจุบันและเอกสาร upstream; ไม่ได้รัน AI ทุกตัวหรือทดสอบ production ใหม่ ผล live test ที่กล่าวถึงเป็นหลักฐานเดิมใน repository ไฟล์นี้เป็น audit ประกอบ `plans/ROADMAP.md` ไม่ใช่ roadmap หลักฉบับใหม่

แผนดำเนินงานฉบับละเอียด: [execution plan](../plans/ai-coverage-execution-plan.md), [task ledger](../plans/ai-coverage-task-ledger.md), [validation และ certification](../plans/ai-coverage-validation-plan.md)

## ข้อสรุป

โปรเจ็กต์มีโครงสร้างรับเหตุการณ์พร้อมต่อยอดแล้ว ช่องว่างหลักคือจำนวนแหล่งหลักฐานที่เชื่อมต่อจริง ความสอดคล้องของ setup/status/certification และการจัด editor change ที่ไม่มีหลักฐาน AI เป็น human การเพิ่ม filesystem watcher อย่างเดียวไม่สามารถยืนยันผู้เขียนได้

เป้าหมายที่วัดได้ควรเป็น “ตรวจจับทุกการแก้ไฟล์ใน tool/version/runtime ที่ประกาศรองรับ พร้อมรายงานส่วนที่ระบุผู้เขียนไม่ได้” ไม่ใช่รับรอง AI ทุกตัวและทุกเวอร์ชัน 100% โดยไม่มี integration

## เทียบกับ WakaTime

- WakaTime CLI อ่าน AI transcript logs โดยปริยาย และมี parser รายผลิตภัณฑ์จำนวนมาก: [CLI usage](https://github.com/wakatime/wakatime-cli/blob/develop/USAGE.md), [parser orchestration](https://github.com/wakatime/wakatime-cli/blob/develop/pkg/ai/ai.go).
- VS Code plugin เรียก `--sync-ai-activity` และมี heuristic จากการเปลี่ยนข้อความ/sidebar/repeated inserts เพื่อจัด AI activity: [VS Code source](https://github.com/wakatime/vscode-wakatime/blob/master/src/wakatime.ts).
- นี่เป็นการผสมหลายแหล่งข้อมูล ไม่ใช่หลักฐานว่า WakaTime ตรวจ AI ทุกตัวถูกต้อง 100% หรือระบุ model จริงได้ทุกครั้ง
- AtoAxis เลือกความแม่นยำของชื่อ AI ตาม `plans/ROADMAP.md` และ `plans/decision-accuracy-over-coverage.md`; ขยาย native hooks และ completed transcript events ต่อได้โดยไม่เปิด process/filesystem inference

## สิ่งที่มีแล้วและควรใช้ต่อ

- Broker และ metadata-only ingress: `wakaclock ai emit`, sidecar, offline queue และ dedup
- Transcript parsers สำหรับ Claude Code, Codex, Gemini CLI
- Native hook adapters และ snapshot engine สำหรับ tool lifecycle
- Adapter manifest, diagnostics types, CLI setup/status/doctor/uninstall และ VS Code onboarding บางส่วน
- นโยบาย observer ใช้ตรวจสุขภาพเท่านั้น: `ObserverConfig::feeds_production()` คืน false

## ช่องว่างที่พบจาก source

| ลำดับ | หลักฐาน | ผลกระทบ | งานที่เสนอ |
| --- | --- | --- | --- |
| 1 | `extensions/vscode/src/aiAttribution.ts`: ไม่มี sidecar candidate แล้วคืน `human`; `buffer.ts` สะสม ordinary document changes เป็น human ก่อน reconcile | AI ที่ไม่มี adapter หรือ event มาช้าอาจถูกนับเป็นคน | ทดสอบและแก้ fallback โดยใช้หลักฐาน human input ที่มีจริง; ถ้าแยกไม่ได้ใช้ unknown พร้อมเหตุผล โดยไม่เหมารวม unknown ทั้งหมดว่า AI |
| 2 | `main.rs::supported_ai_parsers()` มี Claude/Codex/Gemini เท่านั้น | ชื่อใน registry ไม่ได้ทำให้มี parser จริง | เพิ่ม parser/producer ตามแหล่งหลักฐานจริงทีละ runtime |
| 3 | `main.rs::selected_ai_setup_ids()` และ `canonical_ai_setup_id()` รองรับสามตัวเดียว | setup CLI ไม่ครอบคลุมรายชื่อที่ extension/registry รู้จัก | ใช้ registry ร่วมสำหรับ discovery/setup/status/uninstall และบอก Unsupported อย่างชัดเจน |
| 4 | `main.rs::run_ai_doctor()` กำหนด `running: false`, lag เป็น 0, verification เป็น Scaffold; อีกเส้นทาง `doctor ai` มีการตรวจละเอียดกว่า | คำสั่งคล้ายกันอาจรายงานไม่ตรงกัน; 0 อาจถูกเข้าใจว่าไม่มีปัญหา | รวม health collector ให้สองคำสั่งใช้ข้อมูล runtime เดียวกัน; ข้อมูลที่วัดไม่ได้ต้องแสดง unavailable |
| 5 | `adapter.rs::codex_manifest()` ยังระบุ dry-run/scaffold แต่ `VERIFICATION.md` วันที่ 2026-09-02 บันทึก native event และ backend row จริง | ความพร้อมใน UI/registry อาจไม่สะท้อนหลักฐาน | ผูก version/runtime/certification artifact เข้าสถานะ ไม่ promote จากการแก้ label อย่างเดียว |
| 6 | Cursor/Kilo/Kimi เป็น scaffold; Gemini unverified; Cline/Roo/OpenCode/Copilot/Windsurf/Antigravity หลายรายการยังไม่มี roots/schema/producer จริง | มีรายชื่อรองรับมากกว่าความครอบคลุมที่พิสูจน์แล้ว | inventory payload/storage จริง, fixtures ที่ลบข้อมูลส่วนตัว, live end-to-end certification |
| 7 | Cursor hook ใส่ `provider_id=anysphere`, `model_id=null` | ชื่อผู้ผลิตแอปอาจถูกปะปนกับผู้ให้บริการโมเดล | แยก agent/client, model provider, model; ไม่มีข้อมูลโมเดลให้ null |

ข้อ 1 เป็นความเสี่ยงที่อนุมานจาก code path ยังไม่ได้ทำ live reproduction ใน audit นี้

## สถานะตามหลักฐานที่ตรวจ

| Tool | สถานะที่สรุปได้ |
| --- | --- |
| Claude Code | มี parser/hook และบันทึก live baseline; บันทึกทดสอบหลัง migration ติด authentication จึงต้อง refresh certification |
| Codex | มี parser/hook และบันทึก native delivery/backend row จริง; registry ยังไม่ตรงกับหลักฐาน และต้องทดสอบแต่ละ runtime/tool path แยกกัน |
| Gemini CLI | มี parser/hook แต่ยังไม่มีหลักฐาน live certification ในไฟล์ที่ตรวจ |
| Cursor, Kilo Code, Kimi Code | มี adapter ต้นแบบ; ไม่เท่ากับรับรองใช้งานจริง |
| Cline, Roo, OpenCode, Copilot, Windsurf, Antigravity | registry หลายรายการยังเป็น declaration; ต้องเพิ่ม integration จริง |
| Generic MCP | มี event ingress; MCP server/agent ต้องติดเครื่องมือส่ง event เอง การรองรับ MCP ไม่ได้ทำให้เห็นทุก MCP call อัตโนมัติ |

## แผนลงมือ ตามลำดับที่แนะนำ

### A. ปิดความคลาดเคลื่อนพื้นฐาน

1. ทำ regression สำหรับ unsupported AI editor edit, delayed hook, formatter, paste, undo/redo และคนแก้ไฟล์เดียวกับ AI
2. แยก human evidence, verified AI evidence, AI ที่ทราบว่าเป็น AI แต่ไม่ทราบชื่อ และ unknown authorship ให้ต่างกัน
3. รวม `ai doctor` กับ `doctor ai` ให้ใช้ collector เดียวกัน พร้อม last event, parser lag, queue, last delivery, broker process และข้อผิดพลาดจริง
4. รวมรายการ setup กับ adapter registry โดยยังคง installation consent และรักษา config ผู้ใช้
5. ปรับสถานะ Codex/Claude ให้ผูกหลักฐานและเวอร์ชัน; ตรวจเอกสารที่ล้าสมัย

เกณฑ์ผ่าน: ไม่มีชื่อ AI จาก process presence; ไม่มี human attribution จากการไม่มี AI event เพียงอย่างเดียวในกรณีที่ไม่มีหลักฐาน human; health ไม่รายงานค่าปลอม; setup ซ้ำแล้วไม่สร้าง hook ซ้ำ

### B. รับรองสามเส้นทางหลัก

ทดสอบ Claude และ Codex baseline ใหม่ แล้วปิด Gemini CLI ตาม roadmap ปัจจุบัน ทดสอบ CLI, IDE extension และ desktop แยกกันเมื่อจะประกาศรองรับ อย่าใช้ผลจาก CLI รับรองทุก runtime

แต่ละ adapter ต้องมี: tool/version, OS/runtime, native payload หรือ completed transcript edit, broker event, backend row, dashboard result, retry/dedup, multi-file behavior และ artifact ที่ไม่มี prompt/source/diff

### C. ขยาย adapter แบบเป็นชุด

1. Kilo Code และ Cursor ตาม roadmap โดยแยก Cursor Agent กับ Tab completion
2. สำรวจ Cline/Roo/Continue ว่ามี per-edit records จริง แล้วจึงเลือก hook/plugin/transcript parser
3. OpenCode/Goose/Copilot CLI หลัง setup กลางใช้งานได้; Copilot IDE/inline completion เป็นคนละช่องทางทดสอบ
4. สำรวจ Windsurf/Antigravity และเครื่องมืออื่นจากความต้องการใช้งาน; ยังไม่ประกาศรองรับจนมีหลักฐาน
5. Kimi/standalone Deep Code คงสถานะรอหลักฐานตาม roadmap

รายการหนึ่งใน compatibility matrix ต้องเป็น Tool × Version × Runtime × OS × Edit mode ไม่ใช่ชื่อผลิตภัณฑ์อย่างเดียว ระบุ create/modify/delete/rename, shell, MCP, inline completion, model metadata และข้อจำกัดแยกกัน

### D. รองรับพื้นที่ทำงานนอกเครื่อง

วาง collector ในเครื่องหรือ container ที่ AI แก้ไฟล์จริงสำหรับ SSH, WSL, dev containers และ cloud agents ส่ง metadata พร้อม machine/session/workspace identity; จับคู่ worktree/repository โดยไม่รวมไฟล์ชื่อเหมือนกันคนละ workspace

นี่เป็นขอบเขตที่ต้องตรวจและทดสอบเพิ่มเติม audit นี้ยังไม่ได้พิสูจน์ end-to-end remote coverage ห้ามถือว่า local watcher มองเห็น cloud filesystem ได้

กรณีคัดลอกโค้ดจากเว็บ: editor รู้ว่าเป็น paste ได้บางเส้นทาง แต่ไม่ควรสรุปผู้สร้างโค้ดหรือชื่อโมเดลจาก paste อย่างเดียว ต้องมี provenance integration โดยเฉพาะ หรือเก็บเป็น unknown

## ชุดทดสอบที่ต้องมีต่อ adapter

- create/modify/delete/rename; ไฟล์เปิดและปิดใน editor; ไฟล์ dirty อยู่ก่อน
- apply_patch, shell/script, MCP, multi-file และ nested tool calls ตาม runtime ที่รองรับ
- failed/no-op/cancelled tool; failure ที่มี partial writes ต้องไม่สร้างความสำเร็จปลอมและไม่ละเลย residual mutation ใน diagnostics
- คนกับ AI แก้พร้อมกัน; AI หลายตัว; formatter; paste; undo/redo
- event สลับลำดับ, duplicate hook+transcript+editor, broker restart, offline retry, transcript rotation/truncation
- schema/tool version upgrade; Windows/macOS/Linux และ remote เฉพาะรายการที่จะประกาศรองรับ
- 100 ไฟล์จาก tool call เดียวไม่เพิ่มเวลา 100 เท่า; จำนวนบรรทัดที่พิสูจน์ไม่ได้เป็น null

วัด precision/recall ของ attribution แยกจากความครบของ line deltas และ delivery latency ใช้ ground-truth scenarios ไม่ใช้จำนวน heartbeat เป็น denominator และไม่รายงาน recall ของ AI ที่มองไม่เห็นราวกับวัดได้จริง ตัวเลขเป้าหมายต้องตั้งก่อน rollout และไม่แสดงเป็นผลสำเร็จจนมีรายงานทดสอบ

## งานแรกที่ควรทำเป็นชุดเล็ก

เริ่มจาก A: แก้ unmatched editor attribution พร้อม regression, รวม doctor/runtime status, ทำ setup ให้ใช้ registry เดียวกัน แล้วรับรอง Claude/Codex/Gemini จริง ชุดนี้จะทำให้เห็นชัดว่าเหตุการณ์หายที่ต้นทาง parser broker หรือ backend ก่อนลงทุนเพิ่มรายชื่อ AI อีกหลายตัว

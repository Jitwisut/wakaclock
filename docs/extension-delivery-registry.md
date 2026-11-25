# ทะเบียนส่งมอบ extension รายโปรแกรม

ชุด 0 ของ [แผนส่งมอบ](../plans/extension-delivery-roadmap-2026-11-19.md) ตรวจเมื่อ 19 พฤศจิกายน 2026 ปรับปรุง 22 พฤศจิกายน 2026
ฐาน source คือ `origin/main` `9aa0b11b` หนึ่งแถวต่อโปรแกรม หมายเลขตรงกับ
[plan.md §5](../plan.md#phase-5--atoaxis-extension-coverage-for-every-program-in-the-supplied-image)
แถวท้ายตารางคือ Zed, VS Code และ Desktop ที่ใช้ร่วมกัน

ทะเบียนนี้บันทึกเฉพาะสิ่งที่ตรวจได้จาก source และรายงานทดสอบ ช่องที่ไม่มีหลักฐานเขียนว่า "ไม่ทราบ"
อัปเดตแถวเมื่อมีผลทดสอบใหม่ พร้อมวันที่ SHA และลิงก์หลักฐาน

## สถานะที่ใช้

เรียงจากน้อยไปมาก สถานะสูงกว่าต้องผ่านสถานะก่อนหน้าแล้ว นิยามเต็มอยู่ใน
[เกณฑ์รับงาน](../plans/extension-delivery-roadmap-2026-11-19.md#เกณฑ์รับงานและการเผยแพร่)

| สถานะ | ความหมาย |
|---|---|
| ยังไม่เริ่ม | ไม่มี adapter ใน repo |
| ใช้ build ร่วม ยังไม่ตรวจ | มี build ของตระกูลเดียวกัน แต่ยังไม่ติดตั้งใน host นี้ |
| พัฒนาแล้ว | มีโค้ดและ unit test แต่ยังไม่ผ่าน host จริง |
| ทดสอบอัตโนมัติผ่าน | ผ่าน fixture/loopback หรือ host smoke ที่ไม่มี server จริง |
| ผ่านในโปรแกรมจริง | ติดตั้งใน host แล้วเทียบ event กับ server และ Dashboard |
| ตรวจเวลา | เทียบยอดเวลากับ baseline แล้วผลต่างอยู่ในเกณฑ์ |
| เผยแพร่แล้ว | มีแพ็กเกจหรือ store listing ที่ผู้ใช้ติดตั้งได้ |
| ติดข้อจำกัด | หยุดรอสิ่งภายนอก ระบุสาเหตุในคอลัมน์งานถัดไป |

ประเภท adapter ใช้อักษรของ plan.md §5.5: **N** native, **F** build ร่วมของตระกูล, **C** compatibility shim,
**B** browser extension, **D** desktop tracker, **U** ต้องพึ่ง upstream, **L** legacy

แก้ไขของ Figma, Blender และช่อง Brave ใน smoke test มาใน commit เดียวกับทะเบียนนี้
เจ้าของอนุมัติตาม [heartbeat safety](../.context/heartbeat-safety.md) เมื่อ 20 พ.ย. 2026

## ทะเบียน

| # | โปรแกรม | ชุด | ประเภท | โค้ดใน repo | สถานะ | รุ่น/OS ที่ทดสอบ | หลักฐาน | งานถัดไป |
|---|---|---|---|---|---|---|---|---|
| 1 | Amp CLI | 2C | N/F | ไม่มี | ยังไม่เริ่ม | — | — | หาช่องทาง hook หรือ transcript ที่ผู้ผลิตรองรับ |
| 2 | Android Studio | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | รอ Kotlin plugin ร่วมผ่าน IDEA/PyCharm |
| 3 | Antigravity | 2C | N/F | `wakaclock-core/src/ai/antigravity.rs` | พัฒนาแล้ว | ไม่ได้ติดตั้งบนเครื่องพัฒนา | [CAPABILITIES](../backend/api/crates/wakaclock-core/src/ai/CAPABILITIES.md) | edit เป็น dry-run และไม่อ่าน usage ต้องทดสอบกับตัวจริง |
| 4 | AppCode | 2B | F/L | ไม่มี | ยังไม่เริ่ม | — | — | ระบุรุ่นสุดท้ายที่หาได้ก่อน |
| 5 | Aptana | 4 | F/C/L | ไม่มี | ยังไม่เริ่ม | — | — | ใช้ Eclipse core เมื่อมี |
| 6 | Arduino IDE | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | แยกรุ่น 1 และ 2 |
| 7 | Azure Data Studio | 2A | F/L | VS Code extension | ใช้ build ร่วม ยังไม่ตรวจ | — | — | ระบุรุ่นสุดท้ายที่ VSIX ติดตั้งได้ |
| 8 | Blender | 1B | N | `extensions/blender` | ทดสอบอัตโนมัติผ่าน | Blender 5.2.3 LTS, macOS arm64 | [host validation](extension-host-validation-2026-11-19.md) | อ่านกลับผ่าน server และ Dashboard ด้วยบัญชีทดสอบ, ทดสอบอัปเกรดและช่วงรุ่นที่รองรับ |
| 9 | Brackets | 6 | N/L | ไม่มี | ยังไม่เริ่ม | — | — | ตรวจรุ่นที่ติดตั้งได้ |
| 10 | Brave | 1A | B/F | `extensions/browser` (Chromium MV3) | ทดสอบอัตโนมัติผ่าน | Brave 1.98.63, macOS arm64 | [host validation](extension-host-validation-2026-11-19.md) | idle/lock จริง, ส่งเข้า production, store |
| 11 | C++ Builder | 4 | F/N | ไม่มี | ยังไม่เริ่ม | — | — | ต้องมีเครื่อง Windows และ license RAD Studio |
| 12 | Canva | 3 | B | browser extension ร่วม | ใช้ build ร่วม ยังไม่ตรวจ | — | — | ทำ domain/project mapping สำหรับเว็บ |
| 13 | Chrome | 1A | B/F | `extensions/browser` (Chromium MV3) | ทดสอบอัตโนมัติผ่าน | Chrome 157.0.8103.79, macOS arm64 | [host validation](extension-host-validation-2026-11-19.md) (รวมผลอ่านกลับจาก API และ Dashboard ในเครื่อง 22 พ.ย.), [TEST-REPORT](../extensions/browser/TEST-REPORT.md) | ZIP ที่จะเผยแพร่กับบัญชีจริง → receipt → Dashboard, สองโปรเจกต์ในเบราว์เซอร์แบบมีหน้าจอ, idle/lock/sleep จริง |
| 14 | Claude Code | 2C | N | `extensions/ai-agents/plugins/atoaxis-heartbeat`, `ai/claude.rs` | ทดสอบอัตโนมัติผ่าน | ไม่ทราบรุ่นปัจจุบัน | [VERIFICATION](../backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md): certification 2026-09-03 ระบุ `verified` จาก baseline ก่อน migration | รันซ้ำหลัง OAuth ใหม่ และเทียบกับ Dashboard ก่อนเลื่อนสถานะ |
| 15 | CLion | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | รอ Kotlin plugin ร่วม |
| 16 | Cloud9 | 3 | B | browser extension ร่วม | ใช้ build ร่วม ยังไม่ตรวจ | — | — | domain/project mapping |
| 17 | Coda | 6 | N/L | ไม่มี | ยังไม่เริ่ม | — | — | ตรวจรุ่นที่ติดตั้งได้ |
| 18 | CodeTasty | 3 | B | browser extension ร่วม | ใช้ build ร่วม ยังไม่ตรวจ | — | — | domain/project mapping |
| 19 | Codex CLI | 2C | N | `extensions/ai-agents/codex`, `ai/codex.rs` | ทดสอบอัตโนมัติผ่าน | หลักฐานไม่ตรงรุ่น CLI ปัจจุบัน | [VERIFICATION](../backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md): `historical evidence` 2026-09-03 มีการตรวจแถวใน backend | รันซ้ำกับรุ่นปัจจุบันและเทียบกับ Dashboard, ทดสอบ legacy shell collision |
| 20 | Copilot CLI | 2C | N/F | `ai/copilot.rs` | พัฒนาแล้ว | ไม่มีตัวอย่าง CLI บนเครื่อง | [CAPABILITIES](../backend/api/crates/wakaclock-core/src/ai/CAPABILITIES.md) | ส่งแค่ usage ส่วน edit เป็น dry-run ต้องทดสอบกับ CLI จริง |
| 21 | Cursor | 2A | F | VS Code extension, `ai/cursor.rs` | ใช้ build ร่วม ยังไม่ตรวจ | — | — | ติดตั้ง VSIX แล้วยืนยัน editor ID และแยก event ของ agent |
| 22 | DataGrip | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | ปกปิด SQL ตามบริบท |
| 23 | DataSpell | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | รอ Kotlin plugin ร่วม |
| 24 | DBeaver | 4 | F/C | ไม่มี | ยังไม่เริ่ม | — | — | Eclipse fragment |
| 25 | Delphi | 4 | F/N | ไม่มี | ยังไม่เริ่ม | — | — | ต้องมีเครื่อง Windows และ license RAD Studio |
| 26 | Discord | 3 | D | Desktop tracker | ใช้ build ร่วม ยังไม่ตรวจ | — | — | foreground app แบบ opt-in |
| 27 | Eclipse | 4 | F/C | ไม่มี | ยังไม่เริ่ม | — | — | Eclipse core + product fragments |
| 28 | Edge | 1A | B/F | `extensions/browser` (Chromium MV3) | ทดสอบอัตโนมัติผ่าน | Edge 156.0.4314.58, macOS arm64 | [host validation](extension-host-validation-2026-11-19.md) | idle/lock จริง, ส่งเข้า production, store |
| 29 | Emacs | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | เริ่มผ่าน CLI |
| 30 | Eric | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 31 | Excel | 4 | F/N+D | ไม่มี | ยังไม่เริ่ม | — | — | Office.js add-in ห้ามส่งค่าใน cell |
| 32 | Figma | 1B | N | `extensions/figma` | พัฒนาแล้ว | ยังไม่รันใน Figma | [host validation](extension-host-validation-2026-11-19.md), คิวจริงของ plugin ส่งเข้า API ในเครื่อง 22 พ.ย. (จำลอง clientStorage) | ทดสอบใน Figma ด้วย ID ของผู้พัฒนา: แก้ local/remote, token refresh และปิด plugin ขณะคิวค้าง ดูพื้นที่ clientStorage เมื่อ offline นาน |
| 33 | Firefox | 1A | B | `extensions/browser` (Firefox MV3) | พัฒนาแล้ว | ยังไม่รันใน host รอบนี้ | [README](../extensions/browser/README.md) | ติดตั้งและรันจริงก่อนส่ง AMO signing |
| 34 | Geany | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 35 | Gedit | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 36 | GoLand | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | รอ Kotlin plugin ร่วม |
| 37 | HBuilder X | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | ตรวจ API ก่อน |
| 38 | IDA Pro | 7 | N | ไม่มี | ยังไม่เริ่ม | — | — | ตรวจ SDK และ license ห้ามส่งเนื้อหาไบนารี |
| 39 | IntelliJ IDEA | 2B | F | `extensions/jetbrains` (PR #140) | พัฒนาแล้ว | ยังไม่มีผลใน host จริง | [README](../extensions/jetbrains/README.md) | ติดตั้ง ZIP แล้วตรวจ edit/save กับ server และ Dashboard, ทบทวนกรณี CLI ไม่รับแล้ว event อาจหาย |
| 40 | Jupyter | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | ตัวแทนชุด 5 ห้ามส่งเนื้อหา notebook |
| 41 | Kakoune | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 42 | Kate | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 43 | Kiro | 2A | F | VS Code extension | ใช้ build ร่วม ยังไม่ตรวจ | — | — | ติดตั้ง VSIX แล้วยืนยัน editor ID |
| 44 | Komodo | 6 | N/L | ไม่มี | ยังไม่เริ่ม | — | — | ตรวจรุ่นที่ติดตั้งได้ |
| 45 | Maestro | 3 | U/D | ไม่มี | ยังไม่เริ่ม | — | — | ตรวจช่องทาง provider ที่ผู้ผลิตรองรับ |
| 46 | Micro | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 47 | MPS | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | ตรวจ MPS model |
| 48 | Neovim | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | เริ่มผ่าน CLI |
| 49 | NetBeans | 4 | N | ไม่มี | ยังไม่เริ่ม | — | — | NetBeans module |
| 50 | Notepad++ | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | ต้องมีเครื่อง Windows |
| 51 | Nova | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 52 | Obsidian | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | ตัวแทนชุด 5 ห้ามส่งเนื้อหา vault |
| 53 | OpenCode | 2C | N/F | `extensions/ai-agents/opencode`, parser ใน `wakaclock-core/src/ai` | พัฒนาแล้ว | ไม่มีฐานข้อมูลจริงบนเครื่อง | [CAPABILITIES](../backend/api/crates/wakaclock-core/src/ai/CAPABILITIES.md) | edit เป็น dry-run ต้องทดสอบกับตัวจริง |
| 54 | Oxygen | 4 | F/C | ไม่มี | ยังไม่เริ่ม | — | — | Eclipse fragment หรือ plugin ของ Oxygen |
| 55 | PhpStorm | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | รอ Kotlin plugin ร่วม |
| 56 | Postman | 3 | D | Desktop tracker | ใช้ build ร่วม ยังไม่ตรวจ | — | — | foreground app แบบ opt-in |
| 57 | PowerPoint | 4 | F/N+D | ไม่มี | ยังไม่เริ่ม | — | — | Office.js add-in ห้ามส่งเนื้อหา slide |
| 58 | Processing | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 59 | Pulsar | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 60 | PyCharm | 2B | F | `extensions/jetbrains` (PR #140) | พัฒนาแล้ว | ยังไม่มีผลใน host จริง | [README](../extensions/jetbrains/README.md) | ติดตั้ง ZIP แล้วตรวจ edit/save กับ server และ Dashboard, ทบทวนกรณี CLI ไม่รับแล้ว event อาจหาย |
| 61 | Qoder | 2A | F | VS Code extension | ใช้ build ร่วม ยังไม่ตรวจ | — | — | ติดตั้ง VSIX แล้วยืนยัน editor ID |
| 62 | Recaf | 7 | N | ไม่มี | ยังไม่เริ่ม | — | — | ตรวจ plugin API |
| 63 | ReClassEx | 7 | N/D | ไม่มี | ยังไม่เริ่ม | — | — | ห้ามอ่านหน่วยความจำ ใช้ Desktop ถ้าไม่มี event |
| 64 | Rider | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | รอ Kotlin plugin ร่วม |
| 65 | Roblox Studio | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | ตรวจสิทธิ์ plugin ก่อน |
| 66 | RubyMine | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | รอ Kotlin plugin ร่วม |
| 67 | RustRover | 2B | F | ไม่มี | ยังไม่เริ่ม | — | — | รอ Kotlin plugin ร่วม |
| 68 | Safari | 1A | B | `extensions/browser` (Safari Web Extension + companion) | ติดข้อจำกัด | archive แบบไม่ sign, Xcode, macOS arm64 | [host validation](extension-host-validation-2026-11-19.md) | ต้องมี Apple Developer team และ App Group ที่ provision แล้ว `safari-project.mjs` รองรับ `project.xcproj` แล้ว |
| 69 | SiYuan | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 70 | Sketch | 5 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 71 | SlickEdit | 6 | N | ไม่มี | ยังไม่เริ่ม | — | — | — |
| 72 | SQL Server Studio / SSMS | 4 | F | ไม่มี | ยังไม่เริ่ม | — | — | SSMS VSIX ต้องมีเครื่อง Windows ห้ามส่ง query |
| Zed | Zed | 1B | N | `extensions/zed` | ทดสอบอัตโนมัติผ่าน | Zed 1.26.2 (host แยก), macOS arm64 | [host validation](extension-host-validation-2026-11-19.md) | ดาวน์โหลด language server บนเครื่องสะอาด, ส่ง save/change จริง, offline restart |
| VS Code | VS Code | 0 | N | `extensions/vscode` | พัฒนาแล้ว | ไม่ทราบรุ่นที่ใช้ตรวจ | [heartbeat safety](../.context/heartbeat-safety.md): เจ้าของเทียบยอด 4 ต.ค. 2026 กับ WakaTime (3h 6m เทียบ 3h 4m) แต่บันทึกไม่ได้ระบุชื่อหรือรุ่น editor | เก็บหลักฐานตามเกณฑ์ของแผนก่อนใช้เป็นกรณีอ้างอิง สถานะ Marketplace ไม่ทราบ |
| Desktop | Desktop | 3 | D | `apps/desktop` (Tauri, macOS/Windows), `extensions/desktop-tracker` | พัฒนาแล้ว | ยังไม่ทดสอบใน host รอบนี้ | [tracker](../apps/desktop/src-tauri/src/tracker/mod.rs) | consent, idle, lock, offline และ overlap กับ native plugin บน macOS/Windows |

## สรุปจำนวน

| สถานะ | จำนวน |
|---|---:|
| ตรวจเวลา | 0 |
| ผ่านในโปรแกรมจริง | 0 |
| ทดสอบอัตโนมัติผ่าน | 7 |
| พัฒนาแล้ว | 9 |
| ติดข้อจำกัด | 1 |
| ใช้ build ร่วม ยังไม่ตรวจ | 9 |
| ยังไม่เริ่ม | 49 |
| รวม | 75 |

ยังไม่มีโปรแกรมใดอยู่ในสถานะเผยแพร่แล้วตามเกณฑ์ของแผนนี้

## ข้อจำกัดของการตรวจรอบนี้

- Chrome ผ่านเส้นทาง extension → API → Dashboard ในเครื่องแล้ว (22 พ.ย.) ด้วยบัญชีทดสอบ, build แบบ loopback และ headless
  host อื่นยังเป็น fixture, recording CLI หรือการทดสอบแยกส่วน ยังไม่มี host ใดผ่านด้วยบัญชีจริงบน production
- ฉบับ 20 พ.ย. ให้สถานะ VS Code, Claude Code และ Codex CLI สูงกว่าหลักฐาน ฉบับนี้ลดลงตามนิยามด้านบน
- เครื่องทดสอบ resolve `api.atoaxis.com` ไม่ได้ ผลส่งเข้า production จึงยังไม่ได้ตรวจ
- ทดสอบเฉพาะ macOS arm64 ช่อง Windows และ Linux ยังว่าง

# แผนพัฒนาและส่งมอบ AtoAxis สำหรับโปรแกรมอื่น

ฉบับ 19 พฤศจิกายน 2026 ฐานที่ตรวจบน GitHub main คือ `6606ce62e714ebf331b51ad4720c3162d0e9f10b` ขอบเขตคือ 72 โปรแกรมใน [บัญชีเดิม §5](../plan.md#phase-5--atoaxis-extension-coverage-for-every-program-in-the-supplied-image) พร้อม Zed, VS Code และ Desktop ที่ใช้ร่วมกัน หมายเลขในวงเล็บตรงกับลำดับเดิม เอกสารนี้เป็นแผนเสนอสำหรับการส่งมอบ หลักฐานรอบนี้มาจาก source และรายงานที่มีอยู่ การทดสอบบนเครื่องจริงเป็นงานตามแผน

## ลำดับส่งมอบ

| ชุด | โปรแกรมและจุดตั้งต้น | งานและผลส่งมอบที่ใช้ตัดสินผ่าน |
|---|---|---|
| 0 ฐานร่วม | CLI, OAuth, offline queue, backend, Dashboard และ VS Code มีอยู่แล้ว | ทำทะเบียนหนึ่งแถวต่อโปรแกรม/รุ่น/OS พร้อมประเภทข้อมูลที่จับได้ เจ้าของงาน SHA และลิงก์ผลทดสอบ ตรวจสัญญา CLI และ OAuth ที่ใช้งานจริง ทำชุดทดสอบร่วมสำหรับ install → event → รับเข้า queue → server receipt → อ่านกลับ → ยอดเวลา ตรวจกับ VS Code และ Chrome เป็นกรณีอ้างอิง สำรวจ compatibility shim เฉพาะโปรแกรมที่ต้องพึ่งมัน |
| 1A Browser | Chrome (13), Edge (28), Brave (10), Firefox (33), Safari (68) มี package หรือขั้นตอนสร้าง | เริ่ม Chrome บน macOS จาก candidate ปัจจุบัน ทวน login, consent, AFK, lock, sleep, ปิด worker, offline/restart และยอด browsing จากนั้นใช้ชุดเดียวกันกับ Edge และ Brave แยกโปรแกรม Firefox ต้องติดตั้งและรันได้จริงก่อนส่งเซ็น Safari ต้องทดสอบ signed companion, App Group และหยุดนับเมื่อ companion หาย ส่งมอบแยก browser/OS ตามผล |
| 1B Native ที่มีโค้ด | Zed เพิ่มจาก 72 รายการ, Blender (8), Figma (32) | Zed ทดสอบทั้งเครื่องที่มี language server และเครื่องสะอาดที่ต้องดาวน์โหลดพร้อม checksum เปิด/แก้/บันทึกแล้วตรวจ editor และ project ที่ server Blender ติดตั้ง ZIP จริง ตรวจเปิด/สลับ/บันทึกสองไฟล์, offline และ disable ประเมินการแยก render/design เพิ่มจาก modeling ตามงานที่ host พิสูจน์ได้ Figma ใช้ ID ทดสอบของผู้พัฒนา ตรวจ local/remote edit, token refresh และปิด plugin ขณะค้างส่ง หากงานหายให้แก้การเก็บคิวก่อน beta |
| 2A ตระกูล VS Code | Cursor (21), Kiro (43), Qoder (61), Azure Data Studio (7) ใช้ VS Code เป็นฐาน | ตรวจ API และการติดตั้ง VSIX ใน host แต่ละตัว ยืนยัน editor ID, workspace หลายโฟลเดอร์, virtual document และการแยก event จาก agent ทดสอบรุ่นที่หาได้ Azure Data Studio ให้ระบุรุ่นสุดท้ายที่ผ่านและขอบเขต legacy |
| 2B ตระกูล JetBrains | IntelliJ IDEA (39), PyCharm (60), Android Studio (2), CLion (15), DataGrip (22), DataSpell (23), GoLand (36), MPS (47), PhpStorm (55), Rider (64), RubyMine (66), RustRover (67), AppCode (4) | สร้าง Kotlin plugin ร่วม เริ่ม IDEA และ PyCharm ให้ติดตั้ง จับ edit/save และอ่านข้อมูลกลับได้ก่อน ขยายรายผลิตภัณฑ์ ตรวจ Android project, MPS model และการปกปิด SQL ตามบริบท แยก AppCode เป็นรุ่นเก่าที่ทดสอบได้จริง ใช้ Plugin Verifier ประกอบการทดสอบ host |
| 2C Agent | Amp CLI (1), Antigravity (3), Claude Code (14), Codex CLI (19), Copilot CLI (20), OpenCode (53) | ใช้ [roadmap การยืนยัน agent](ROADMAP.md) ทำทะเบียนแยก CLI/IDE และ marker/การแก้ไฟล์ ยกหลักฐานเดิมที่ตรงรุ่นมาใช้ ทำ regression ของ Claude ที่ปิดงานแล้ว ตรวจแต่ละ adapter ด้วยงานสำเร็จ ยกเลิก และ replay ข้าม hook/transcript ให้ได้ operation เดียว ช่องที่ยังพิสูจน์ไม่ได้ระบุ unknown |
| 3 Desktop และเว็บที่มีข้อจำกัด | Desktop ส่วนกลาง, Canva (12), Cloud9 (16), CodeTasty (18), Discord (26), Postman (56), Maestro (45) | ทดสอบแอป Tauri เดิมบน macOS/Windows พร้อม consent, idle, lock, offline และ overlap กับ native plugin เพิ่ม Linux ตามสิทธิ์ที่ X11/Wayland ให้จริง เว็บใช้ domain/project mapping เป็นขั้นแรก Discord และ Postman ใช้ foreground app ตาม opt-in Maestro ตรวจช่องทาง provider ที่ผู้ผลิตรองรับและติดตาม dependency หากได้แค่ชื่อแอปหรือโดเมนให้แสดงความละเอียดระดับนั้น |
| 4 กลุ่ม JVM, Office และ Windows IDE | Eclipse (27), DBeaver (24), Oxygen (54), Aptana (5), Excel (31), PowerPoint (57), NetBeans (49), C++ Builder (11), Delphi (25), SQL Server Studio / SSMS (72) | ส่ง Eclipse core + product fragments, Office.js add-in, NetBeans module, RAD Studio package และ SSMS VSIX เป็นคนละ increment ทดสอบสิทธิ์และวงจรเปิดเอกสารของ Office บน web/desktop ป้องกันการส่ง query/ค่า cell/slide content เตรียมเครื่อง Windows และรุ่น legacy ก่อนรับรองช่องนั้น |
| 5 เครื่องมือเนื้อหาและพัฒนาเฉพาะทาง | Jupyter (40), Obsidian (52), SiYuan (69), Nova (51), Pulsar (59), Sketch (70), Roblox Studio (65), Arduino IDE (6), Processing (58), HBuilder X (37) | เริ่ม Jupyter และ Obsidian เป็นตัวแทน ทดสอบ notebook และ vault โดยไม่ส่งเนื้อหา ตรวจ API และสิทธิ์แต่ละโปรแกรมก่อนทำ adapter แยก Arduino รุ่น 1 และ 2 แยกกิจกรรม compile/render จากการบันทึกเมื่อมี event รองรับ |
| 6 Terminal และ editor อื่น | Neovim (48), Emacs (29), Kakoune (41), Micro (46), Eric (30), Geany (34), Gedit (35), Kate (42), Notepad++ (50), SlickEdit (71), Brackets (9), Coda (17), Komodo (44) | เริ่ม Neovim/Emacs ผ่าน CLI ทดสอบ terminal หลายหน้าต่าง, file rename, unsaved buffer และการปิด editor ก่อนส่ง จากนั้นทยอยทำ native package ตามระบบของแต่ละโปรแกรม ตรวจ Brackets/Coda/Komodo กับเวอร์ชันที่ติดตั้งได้ และระบุสถานะ legacy หรือข้อจำกัดพร้อมเหตุผล |
| 7 โปรแกรมวิเคราะห์ไบนารี | IDA Pro (38), Recaf (62), ReClassEx (63) | ตรวจ SDK, สิทธิ์ใช้งาน และเวอร์ชัน host ก่อนจัดทำ package จำกัดข้อมูลไว้ที่กิจกรรมของแอป/โปรเจกต์ที่ผู้ใช้อนุญาต ตรวจ payload และ logs ว่าไม่มีเนื้อหาไบนารี หน่วยความจำ หรือข้อมูลจากงานวิเคราะห์ ใช้ Desktop เมื่อ host ไม่มี event ที่รองรับ |

ชุด 1A และ 1B เริ่มทดสอบคู่กันเมื่อชุด 0 มีกรณีอ้างอิง ชุด 2B เริ่มสำรวจ SDK ควบคู่ได้ แต่รอให้เส้นทาง CLI และแบบบันทึกผลผ่านก่อนขยายครบ 13 โปรแกรม ชุด 3 เป็นเงื่อนไขของโปรแกรมที่ต้องพึ่ง Desktop ส่วนชุด 4–7 เปิดเป็นรายตระกูลเมื่อมีเครื่องทดสอบและเจ้าของดูแลแพ็กเกจ

## เกณฑ์รับงานและการเผยแพร่

- **พัฒนาแล้ว** ระบุ SHA, วิธีติดตั้ง, ข้อมูลที่จับได้ และข้อจำกัด เช่น Figma เก็บได้ระหว่างที่ plugin เปิดอยู่
- **ทดสอบอัตโนมัติผ่าน** บันทึกผล mapping, privacy, สลับบัญชี, idle, retry หลัง server รับไปแล้ว, offline ข้าม restart และการถอนการติดตั้ง ใช้ไฟล์สังเคราะห์ที่ตรวจหาใน payload/log ได้
- **ผ่านในโปรแกรมจริง** ติดตั้ง artifact บน host/OS ที่ระบุ เปิดสองโปรเจกต์ สลับไฟล์ แก้ บันทึก หยุด และเปิดใหม่ เทียบ event ที่คาดกับ server และ Dashboard บันทึกเวอร์ชัน, digest, receipt และผลต่าง ใช้กรณีที่ตรงกับสิ่งที่โปรแกรมสังเกตได้ เบราว์เซอร์ให้วัด foreground browsing และแยกจาก coding
- **ตรวจเวลา** เล่นข้อมูลอ้างอิงชุดเดิมผ่าน baseline กับ candidate แล้วเทียบ canonical IDs/revisions, actor, segments, lines, จำนวนรายการ, duration และ Analytics ผลต่างที่ยอมรับคือศูนย์ สำหรับกิจกรรมที่เพิ่มจาก client ใหม่ให้ใช้บัญชีทดสอบ เทียบกับรายการเหตุการณ์อิสระ และตรวจกรณีเปิดหลาย client พร้อมกัน
- **เผยแพร่แล้ว** เก็บลิงก์แพ็กเกจหรือ store, checksum/ลายเซ็นตามช่องทาง, คู่มือถอนและ rollback ทดสอบอัปเกรดและย้อนรุ่นโดยรักษาคิว เริ่มจาก internal → opt-in beta → เปิดทั่วไปเฉพาะรุ่น/OS ที่ผ่าน หากพบข้อมูลผิดบัญชี ข้อมูลส่วนตัวรั่ว ยอดนับซ้ำ หรือคิวหาย ให้หยุดขยายและคืนรุ่นก่อนหน้า
- **ติดข้อจำกัด** ระบุสาเหตุและผู้รับช่วง เช่นไม่มีเครื่องหรือ license, signing ยังไม่พร้อม, vendor API จำกัด หรือ upstream ยังไม่ตอบ พร้อมวันที่ตรวจครั้งล่าสุด สถานะนี้ให้รายงานแยกจากรายการที่เผยแพร่แล้ว

## รอบแรกที่มอบหมายได้

| เวลาโดยประมาณ | เจ้าของบทบาท | งานส่งมอบ |
|---|---|---|
| วันที่ 1–2 | ผู้ดูแล client + QA | ลงทะเบียน 72 โปรแกรมและฐานร่วม ตรวจ candidate, เครื่อง/บัญชีทดสอบ, production hostname/TLS และความพร้อมของ signing อ้างอิงผล Browser วันที่ 7 ต.ค. แล้วบันทึกผลปัจจุบัน |
| วันที่ 3–5 | Browser + QA | Chrome บน macOS แบบติดตั้งใหม่ เก็บผล offline/restart, AFK/lock และ Dashboard พร้อมเปรียบเทียบเวลาจริง เปิด defect ที่ทำซ้ำได้เป็นรายเรื่อง |
| สัปดาห์ที่ 2 | Native client + release | ทดสอบ Zed บนเครื่องสะอาดและ Blender กับสองไฟล์ ตรวจ artifact download/CLI handoff พร้อมกันให้ฝั่ง web ตรวจ Figma ID และคิวข้ามการปิด plugin |
| สิ้นสัปดาห์ที่ 2 | ผู้ดูแลผลิตภัณฑ์ + วิศวกร | เลือก candidate ที่ผ่านเพื่อเข้า internal pilot ระบุ release blockers ของแต่ละตัว และประเมิน effort ใหม่จากเวลาที่ใช้จริง ก่อนจัดคนทำ JetBrains และ browser ที่เหลือ |

ระยะสองสัปดาห์เป็นเป้ารอบแรก สมมติว่ามีผู้ดูแล client, ผู้ทดสอบ และเข้าถึง macOS กับบัญชีทดสอบได้ งาน Windows/Linux, ใบอนุญาตเครื่องมือ และการอนุมัติ store ให้จัดคิวแยก แผนเดิม §5.15 ประเมินงานเต็มจากจุดเริ่มต้นที่ 124–197 คน-สัปดาห์ การประเมินงานที่เหลือควรหักเฉพาะรายการที่ตรวจผ่านแล้ว แยกเวลาพัฒนาออกจากเวลารอสิทธิ์และคิว store

หลักฐานเริ่มต้นอยู่ใน [Browser test report](../extensions/browser/TEST-REPORT.md), [Browser release checklist](../extensions/browser/RELEASE-CHECKLIST.md), [Zed](../extensions/zed/README.md), [Blender](../extensions/blender/README.md), [Figma](../extensions/figma/README.md) และ [Desktop native tracker](../apps/desktop/src-tauri/src/tracker/mod.rs) งานที่แตะ producer หรือการนับเวลาให้ระบุไฟล์และผลต่อ baseline ตาม [heartbeat safety](../.context/heartbeat-safety.md) ก่อนเริ่มแก้

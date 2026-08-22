import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, type FaqEntry, faqSchema, graph } from '@/lib/seo/schema';
import { localizedPath } from '@/lib/seo/site';

import { EarlyAccessForm } from './early-access-form';
import { FaqSection } from './faq-section';
import {
  Breadcrumbs,
  Bullets,
  CodeBlock,
  LeadAnswer,
  MUTED_TEXT,
  PageShell,
  PageTitle,
  RelatedLinks,
  Section,
} from './prose';

export interface ThaiPageData {
  answer: string;
  code?: string;
  description: string;
  faqs: readonly FaqEntry[];
  form?: boolean;
  sections: readonly {
    bullets?: readonly string[];
    heading: string;
    paragraphs: readonly string[];
  }[];
  title: string;
}

export const THAI_PAGE_DATA: Record<string, ThaiPageData> = {
  '/': {
    title: 'ติดตามเวลาการเขียนโค้ดสำหรับนักพัฒนา',
    description: 'AtoAxis ช่วยติดตามเวลาการเขียนโค้ด ประวัติแบบครบถ้วน analytics ของโปรเจกต์ และ AI attribution ผ่าน WakaTime API สำหรับนักพัฒนา โดยไม่เก็บ source code, prompt หรือคำตอบจาก AI',
    answer:
      'AtoAxis คือบริการติดตามเวลาการเขียนโค้ดสำหรับนักพัฒนา รับข้อมูล heartbeat จาก editor แล้วเปลี่ยนเป็นสถิติของเวลา โปรเจกต์ ภาษา branch และ editor พร้อมเก็บประวัติการเขียนโค้ดแบบครบถ้วน โดยไม่เก็บ source code, prompt หรือคำตอบจาก AI',
    sections: [
      {
        heading: 'AtoAxis คืออะไร',
        paragraphs: ['AtoAxis รับ metadata จากกิจกรรมใน editor เช่นไฟล์ โปรเจกต์ ภาษา branch และเวลาที่เกิดกิจกรรม แล้วรวมเป็น dashboard สำหรับดูรูปแบบการทำงานของคุณในระยะยาว'],
      },
      {
        heading: 'สิ่งที่ติดตามได้',
        paragraphs: ['ข้อมูลถูกสรุปตามช่วงเวลา โปรเจกต์ ภาษา editor ระบบปฏิบัติการ และ branch รวมถึง keystrokes, characters และ AI lines ที่ client ระบุ'],
        bullets: ['ประวัติการเขียนโค้ดครบถ้วน', 'การวิเคราะห์เวลาแยกตามโปรเจกต์และภาษา', 'AI attribution เทียบกับ human activity', 'รองรับ editor ผ่าน WakaTime-compatible API'],
      },
      {
        heading: 'สถานะการเปิดให้ใช้งาน',
        paragraphs: ['เว็บไซต์และผลิตภัณฑ์อยู่ในช่วง Early Access ยังไม่มี checkout เปิดใช้งาน เข้าร่วมรายชื่อเพื่อรับข่าวการเปิดตัวและช่วยกำหนด integrations รุ่นถัดไป'],
      },
    ],
    faqs: [
      { question: 'AtoAxis คืออะไร?', answer: 'AtoAxis เป็นบริการติดตามเวลาการเขียนโค้ดที่เปลี่ยน editor heartbeats เป็น analytics ของเวลา โปรเจกต์ ภาษา branch และ editor' },
      { question: 'AtoAxis เก็บ source code หรือไม่?', answer: 'ไม่เก็บ heartbeat มี metadata ของไฟล์และกิจกรรม แต่ไม่มีช่องสำหรับเนื้อหา source code, prompt หรือคำตอบจาก AI' },
      { question: 'ตอนนี้สมัครใช้งานได้หรือยัง?', answer: 'อยู่ในช่วง Early Access และยังไม่เปิด checkout ลงทะเบียนเพื่อรับข่าวการเปิดตัวได้' },
    ],
    form: true,
  },
  '/teams': {
    title: 'Coding Presence สำหรับทีม — Early Access',
    description: 'แนวคิด coding presence ของ AtoAxis ใช้กิจกรรมจาก editor เพื่อแสดงสถานะทีม remote และกำลังเปิดรับผู้สนใจ Early Access โดย prototype ยังไม่ใช่ team dashboard สำหรับ production',
    answer: 'หน้า Teams ของ AtoAxis อธิบาย prototype สำหรับทีม remote ที่ต้องการเห็นว่าใครกำลังเขียนโค้ดอยู่จากกิจกรรมจริงใน editor ฟีเจอร์นี้ยังไม่ใช่ production team dashboard และกำลังเปิดรับผู้สนใจ Early Access',
    sections: [
      { heading: 'แนวคิดของ coding presence', paragraphs: ['สถานะทำงานมาจาก editor heartbeat ไม่ใช่สถานะที่ผู้ใช้ตั้งเอง จึงช่วยให้ทีมเห็นสัญญาณว่าคนกำลัง coding, idle หรือ offline โดยไม่แสดง file path, project หรือ branch ให้คนอื่นดู'] },
      { heading: 'สิ่งที่ยังอยู่ระหว่างพัฒนา', paragraphs: ['องค์กร ทีมย่อย ห้องทำงานร่วมกัน และ avatar presence ยังไม่พร้อมใช้งานเชิง production ต้องทำ persistence, permissions, analytics และ billing ให้เสร็จก่อน'] },
      { heading: 'เข้าร่วม Early Access', paragraphs: ['ลงทะเบียนความสนใจเพื่อรับข่าว prototype และช่วยให้เรารู้ว่าทีมต้องการ workflow แบบใด'] },
    ],
    faqs: [
      { question: 'ฟีเจอร์ Teams ใช้ได้วันนี้หรือไม่?', answer: 'ยังไม่ได้เปิดใช้งาน production; ปัจจุบันเป็น Early Access prototype และ analytics หลักยังเป็นแบบ single account' },
      { question: 'ผู้จัดการจะเห็น file path หรือไม่?', answer: 'แนวคิดของ presence แสดงเพียง activity state และไม่ควรแสดง file path, project หรือ branch' },
    ],
    form: true,
  },
  '/wakatime-alternative': {
    title: 'ทางเลือก WakaTime สำหรับนักพัฒนา',
    description: 'AtoAxis เป็น hosted WakaTime alternative ที่รองรับ API เดิม ประวัติการเขียนโค้ดครบถ้วน และนำเข้าข้อมูลเดิมได้ โดยไม่ต้องเปลี่ยน editor plugin เดิม',
    answer: 'AtoAxis เป็นบริการติดตามเวลาการเขียนโค้ดที่รองรับ WakaTime API editor ที่มี WakaTime plugin อยู่แล้วสามารถเปลี่ยน api_url ไปยัง AtoAxis ได้ และสามารถนำเข้า WakaTime export เพื่อเก็บประวัติเดิมไว้ใน dashboard เดียวกัน',
    code: '[settings]\napi_url = https://api.atoaxis.com/api/v1\napi_key = your_generated_api_key',
    sections: [
      { heading: 'เหมาะกับใคร', paragraphs: ['เหมาะกับนักพัฒนาที่ต้องการประวัติการเขียนโค้ดครบถ้วน analytics ของโปรเจกต์ และไม่อยากเปลี่ยน editor plugin เดิม'] },
      { heading: 'ข้อแตกต่างที่ควรรู้', paragraphs: ['AtoAxis ยังมี plugin ที่เผยแพร่เองสำหรับ VS Code เท่านั้น editor อื่นเชื่อมต่อผ่าน WakaTime protocol และยังไม่มี team analytics หรือ AI token cost tracking'] },
      { heading: 'การเชื่อมต่อ', paragraphs: ['เปลี่ยน api_url ใน config ของ WakaTime plugin เป็น hosted AtoAxis API และใช้ API key จากบัญชีของคุณ โดยไม่ต้องติดตั้ง server เอง'] },
    ],
    faqs: [
      { question: 'ต้องเปลี่ยน editor plugin หรือไม่?', answer: 'ไม่ต้อง หาก editor มี WakaTime plugin ให้เปลี่ยน api_url และใช้ API key ของ AtoAxis ได้' },
      { question: 'นำเข้าประวัติ WakaTime ได้หรือไม่?', answer: 'ได้ ระบบมี import endpoint สำหรับ WakaTime data export' },
      { question: 'AtoAxis เปิดให้ใช้ฟรีหรือยัง?', answer: 'ยังอยู่ใน Early Access และ checkout ยังไม่เปิด ราคาเปิดตัวเป็น planned pricing' },
    ],
  },
  '/ai-coding-tracker': {
    title: 'ติดตามกิจกรรมการเขียนโค้ดด้วย AI',
    description: 'AtoAxis บันทึก AI agent, AI lines และ human keystrokes เพื่อเปรียบเทียบ AI-assisted coding โดยไม่เก็บ prompt, คำตอบ หรือ source code ของคุณ',
    answer: 'AtoAxis รองรับ AI attribution ใน heartbeat โดย client สามารถส่งชื่อ agent และจำนวน AI lines added/deleted จากนั้น dashboard จะแยกข้อมูลตาม agent และวัน เพื่อเทียบกับ human keystrokes โดยไม่อ่าน prompt, response หรือ source code',
    sections: [
      { heading: 'ข้อมูลที่บันทึก', paragraphs: ['AI attribution อยู่ใน heartbeat เดียวกับ metadata ปกติ จึงวิเคราะห์ AI lines, human keystrokes, project, branch, language และวันได้ในช่วงเวลาเดียวกัน'], bullets: ['ชื่อ AI agent', 'AI lines added และ deleted', 'human keystrokes และ characters', 'โปรเจกต์ ภาษา branch และ file path'] },
      { heading: 'เครื่องมือที่รองรับ', paragraphs: ['hook ที่มากับระบบรองรับ Claude Code, Codex CLI และ Gemini CLI ส่วน Cursor และ Copilot ต้องใช้ provider-specific adapter'] },
      { heading: 'สิ่งที่ไม่เก็บ', paragraphs: ['ไม่มี field สำหรับ prompt text, AI response, source code หรือ token cost จึงไม่ควรสรุปค่าใช้จ่าย AI จากข้อมูลนี้'] },
    ],
    faqs: [
      { question: 'AtoAxis เก็บ prompt ของ AI หรือไม่?', answer: 'ไม่เก็บ ระบบเก็บเฉพาะ metadata และจำนวนบรรทัดที่ client ระบุ' },
      { question: 'รองรับ Claude Code และ Codex หรือไม่?', answer: 'มี hook สำหรับ Claude Code, Codex CLI และ Gemini CLI; Cursor และ Copilot ต้องใช้ adapter เพิ่มเติม' },
    ],
  },
  '/developer-analytics': {
    title: 'Developer Analytics และ Coding Metrics',
    description: 'ดู analytics ของเวลาการเขียนโค้ด โปรเจกต์ ภาษา branch keystrokes และ AI attribution จาก AtoAxis heartbeat พร้อมคำอธิบายวิธีคำนวณ session อย่างชัดเจน',
    answer: 'AtoAxis เปลี่ยน editor heartbeat เป็น analytics ของ total time, daily average, best day และ breakdown ตามโปรเจกต์ ภาษา editor ระบบปฏิบัติการ และ branch พร้อม keystrokes, characters และ AI attribution ที่ตรวจสอบวิธีคำนวณได้',
    sections: [
      { heading: 'Metrics ด้านเวลา', paragraphs: ['ดูวันนี้, 7 วัน, 30 วัน, all time หรือกำหนดช่วงวันที่เอง ระบบรวม heartbeat ที่อยู่ใกล้กันเป็น duration block และไม่นับช่วง idle เป็นเวลาทำงาน'], bullets: ['total coding time', 'daily average และจำนวนวันที่มี activity', 'best day ในช่วงที่เลือก', 'duration blocks ของแต่ละวัน'] },
      { heading: 'Breakdown ของงาน', paragraphs: ['แยกผลลัพธ์ตาม project, language, editor, operating system และ Git branch เพื่อดูรูปแบบการทำงานจริง'] },
      { heading: 'สิ่งที่ไม่ได้วัด', paragraphs: ['ระบบไม่สร้าง productivity score, ranking หรือการประเมินคุณภาพงาน และยังไม่มี team rollup'] },
    ],
    faqs: [
      { question: 'Coding time คำนวณอย่างไร?', answer: 'Heartbeat ที่เกิดใกล้กันจะถูกรวมเป็น duration block และช่วงห่างที่นานพอจะจบ session; idle time ระหว่าง block ไม่ถูกนับ' },
      { question: 'ดูภาษาที่ใช้บ่อยที่สุดได้หรือไม่?', answer: 'ได้ ระบบมี language breakdown และใช้ tree-sitter ช่วยตรวจภาษาแทนการดูนามสกุลไฟล์อย่างเดียว' },
    ],
  },
  '/integrations': {
    title: 'Editor Integrations',
    description: 'เชื่อม VS Code ด้วย AtoAxis extension หรือใช้ WakaTime-compatible plugin กับ hosted API โดยไม่ต้องติดตั้ง plugin ใหม่สำหรับ editor อื่น',
    answer: 'AtoAxis มีสองวิธีเชื่อม editor: ติดตั้ง extension ที่เผยแพร่เองสำหรับ VS Code หรือเปลี่ยน api_url ของ editor ที่มี WakaTime plugin ให้ชี้ไปยัง hosted AtoAxis API วิธีหลังไม่ต้องติดตั้ง extension ใหม่',
    sections: [
      { heading: 'VS Code', paragraphs: ['extension ของ AtoAxis บันทึก typing, save, file switch, debug session และ build task พร้อมแสดงเวลาวันนี้ใน status bar'] },
      { heading: 'WakaTime-compatible editors', paragraphs: ['Neovim, JetBrains, Vim และ editor อื่นที่มี WakaTime plugin สามารถใช้ API compatibility โดยเปลี่ยน api_url และใส่ API key ของบัญชี'] },
    ],
    faqs: [
      { question: 'ต้องติดตั้ง extension ใหม่ทุก editor หรือไม่?', answer: 'ไม่ต้อง editor ที่มี WakaTime plugin อยู่แล้วเชื่อมผ่าน API compatibility ได้' },
    ],
  },
  '/integrations/vscode': {
    title: 'VS Code Time Tracking Extension',
    description: 'วิธีทำงานของ AtoAxis VS Code extension ที่ buffer activity แล้วส่ง heartbeat ผ่าน wakaclock-cli พร้อมข้อจำกัดและข้อมูลที่ extension ส่ง',
    answer: 'AtoAxis VS Code extension เก็บกิจกรรมไว้ใน memory buffer แล้วส่งผ่าน wakaclock-cli เมื่อพิมพ์ บันทึกไฟล์ เปลี่ยนไฟล์ เริ่ม debug หรือรัน build task โดยแสดง coding time วันนี้ใน status bar',
    sections: [
      { heading: 'สิ่งที่ extension ติดตาม', paragraphs: ['ระบบส่ง file metadata, project, branch, language, save state, keystroke และ character counts รวมถึง debug/build activity'], bullets: ['VS Code 1.90 หรือใหม่กว่า', 'wakaclock-cli บน PATH หรือกำหนด cliPath', 'AtoAxis account และ API key', 'config ที่ชี้ไปยัง hosted API'] },
      { heading: 'การ buffer', paragraphs: ['การพิมพ์ไม่ส่ง request ทุก keystroke ระบบ buffer ต่อไฟล์และ flush ตามช่วงเวลา ค่าเริ่มต้น 30 วินาที การ save จะ flush ทันที'] },
      { heading: 'ข้อจำกัด', paragraphs: ['extension ส่งเฉพาะ file activity และ AI hooks ปัจจุบันครอบคลุม Claude Code, Codex CLI และ Gemini CLI'] },
    ],
    faqs: [
      { question: 'Extension ทำให้ VS Code ช้าหรือไม่?', answer: 'ระบบ buffer ใน memory และ flush เป็นช่วง พร้อมส่งต่อให้ wakaclock-cli เพื่อลดงานใน extension host' },
      { question: 'ติดตามตอน idle หรือไม่?', answer: 'ไม่ส่ง background heartbeat หลังไม่มี activity เกิน idle threshold' },
    ],
  },
  '/pricing': {
    title: 'ราคาแผนเปิดตัว AtoAxis',
    description: 'ราคาเปิดตัว AtoAxis ที่วางแผนไว้คือ $12 ต่อเดือนหรือ $99 ต่อปี และยังไม่เปิด checkout ในช่วง Early Access จึงยังไม่มีการเรียกเก็บเงิน',
    answer: 'AtoAxis วางแผนราคาเปิดตัวไว้ที่ $12 ต่อเดือนหรือ $99 ต่อปีสำหรับ hosted developer analytics แต่ checkout และเงื่อนไข trial ยังไม่เปิดในช่วง Early Access ลงทะเบียนเพื่อรับรายละเอียดก่อนเปิดขาย',
    sections: [
      { heading: 'Planned pricing', paragraphs: ['ราคาเป็นข้อมูลที่วางแผนไว้ ไม่ใช่คำสั่งซื้อในตอนนี้ รายละเอียด trial, limits และ subscription agreement จะประกาศก่อนเปิด checkout'] },
      { heading: 'สิ่งที่ตั้งใจรวมไว้', paragraphs: ['บริการ hosted, dashboard, editor integrations และประวัติการเขียนโค้ดครบถ้วน โดยไม่ต้องติดตั้ง database หรือจ่ายค่า infrastructure แยก'] },
      { heading: 'สถานะปัจจุบัน', paragraphs: ['ยังไม่มีการเรียกเก็บเงิน เข้าร่วม Early Access เพื่อรับข่าวการเปิดตัว'] },
    ],
    faqs: [
      { question: 'ตอนนี้มีค่าใช้จ่ายหรือไม่?', answer: 'ยังไม่มีการเรียกเก็บเงิน checkout ยังไม่เปิด' },
      { question: 'ราคาเปิดตัวที่วางแผนไว้เท่าไร?', answer: '$12 ต่อเดือนหรือ $99 ต่อปี แต่รายละเอียดสุดท้ายจะประกาศก่อนเปิดขาย' },
    ],
    form: true,
  },
  '/privacy': {
    title: 'Privacy และข้อมูลที่เก็บ',
    description: 'ดูข้อมูลใน AtoAxis heartbeat สิ่งที่ไม่ถูกเก็บ การจัดเก็บบน hosted infrastructure รวม file path และ AI attribution ตลอดจนวิธีลบข้อมูล',
    answer: 'AtoAxis heartbeat เก็บ metadata ของกิจกรรมการเขียนโค้ด เช่น file path, project, branch, language และ counts แต่ไม่เก็บ source code, prompt, AI response หรือเนื้อหา keystroke ข้อมูลถูกส่งผ่าน HTTPS ไปยัง infrastructure ที่ AtoAxis ดำเนินการ',
    sections: [
      { heading: 'ข้อมูลที่ heartbeat มี', paragraphs: ['ระบบอาจเก็บ file path, project, Git branch, language, editor, operating system, line/cursor position, keystrokes, character counts และ AI attribution'] },
      { heading: 'ข้อมูลที่ไม่เก็บ', paragraphs: ['ไม่มี source code, prompt, AI response หรือข้อความของ keystroke ใน heartbeat'] },
      { heading: 'การลบข้อมูล', paragraphs: ['รายละเอียด retention และขั้นตอนลบข้อมูลจะผูกกับบัญชีและข้อกำหนดที่ประกาศก่อนเปิด checkout; ติดต่อทีมงานได้หากต้องการสอบถาม'] },
    ],
    faqs: [
      { question: 'AtoAxis เก็บเนื้อหาไฟล์หรือไม่?', answer: 'ไม่เก็บ เก็บเฉพาะ metadata และตัวเลขสรุปของกิจกรรม' },
      { question: 'ข้อมูลอยู่ที่ไหน?', answer: 'ส่งผ่าน HTTPS และจัดเก็บบน ClickHouse infrastructure ที่ AtoAxis ดำเนินการ' },
    ],
  },
  '/docs': {
    title: 'เอกสาร AtoAxis',
    description: 'เอกสาร AtoAxis สำหรับ hosted setup, VS Code integration, WakaTime-compatible editor และ heartbeat privacy เพื่อให้นักพัฒนาประเมินบริการได้',
    answer: 'เอกสาร AtoAxis อธิบายวิธีประเมิน hosted service, การเชื่อม editor, VS Code extension, WakaTime-compatible API และข้อมูลที่ heartbeat เก็บ เพื่อให้เริ่มต้นได้โดยไม่ต้อง run server เอง',
    sections: [
      { heading: 'เริ่มต้นที่นี่', paragraphs: ['อ่าน Getting Started เพื่อดู account, API key, VS Code extension และ config สำหรับ WakaTime plugin'] },
      { heading: 'เอกสารที่เกี่ยวข้อง', paragraphs: ['ดู VS Code integration สำหรับ settings และ commands, Privacy สำหรับ field ทั้งหมด และ Developer Analytics สำหรับวิธีคำนวณ metrics'] },
    ],
    faqs: [
      { question: 'ต้องติดตั้ง server เองหรือไม่?', answer: 'ไม่ต้อง AtoAxis เป็น hosted service และลูกค้าเชื่อม editor กับ API ที่ให้บริการ' },
    ],
  },
  '/docs/getting-started': {
    title: 'เริ่มต้นใช้งาน AtoAxis',
    description: 'วิธีเตรียมบัญชี API key และเชื่อม VS Code หรือ WakaTime plugin กับ AtoAxis hosted API เมื่อ Early Access เปิด โดยไม่ต้อง run server เอง',
    answer: 'เมื่อ Early Access เปิด ให้สร้างบัญชี AtoAxis สร้าง API key แล้วเชื่อม editor โดยติดตั้ง VS Code extension หรือเปลี่ยน api_url ของ WakaTime plugin ให้ชี้ไปยัง hosted AtoAxis API โดยไม่ต้อง run server เอง',
    code: '[settings]\napi_url = https://api.atoaxis.com/api/v1\napi_key = your_generated_api_key',
    sections: [
      { heading: 'สิ่งที่ต้องเตรียม', paragraphs: ['AtoAxis account, API key และ VS Code 1.90 ขึ้นไปหากใช้ extension; editor อื่นใช้ WakaTime plugin เดิมได้'] },
      { heading: 'เชื่อมต่อ editor', paragraphs: ['VS Code ใช้คำสั่ง Set API Key ส่วน editor อื่นตั้งค่า api_url และ api_key ใน ~/.wakatime.cfg'] },
      { heading: 'ตรวจสอบการทำงาน', paragraphs: ['แก้ไขและ save ไฟล์ รอ flush interval แล้วตรวจ dashboard ว่ามี coding time เพิ่มขึ้น'] },
    ],
    faqs: [
      { question: 'เริ่มใช้งานวันนี้ได้หรือไม่?', answer: 'ผลิตภัณฑ์อยู่ใน Early Access; ลงทะเบียนเพื่อรับสิทธิ์และข่าวการเปิดใช้งาน' },
      { question: 'ต้อง run database เองหรือไม่?', answer: 'ไม่ต้อง ระบบที่วางแผนไว้เป็น hosted service' },
    ],
  },
  '/about': {
    title: 'เกี่ยวกับ AtoAxis',
    description: 'รู้จัก AtoAxis ผู้พัฒนา และแนวคิดของบริการติดตามเวลาการเขียนโค้ดสำหรับนักพัฒนา รวม WakaTime-compatible editor integration และ Early Access',
    answer: 'AtoAxis เป็นบริการติดตามเวลาการเขียนโค้ดที่เผยแพร่โดย StandUpCode / Lodash (Thailand) Co., Ltd. ระบบเปลี่ยน editor heartbeat เป็น analytics และออกแบบให้เก็บประวัติครบถ้วนโดยไม่เก็บ source code',
    sections: [
      { heading: 'เหตุผลที่สร้าง AtoAxis', paragraphs: ['นักพัฒนาควรเห็นรูปแบบเวลาที่ใช้จริงและเก็บประวัติของตัวเองได้ยาวนาน โดยไม่ต้องเดาจากจำนวน commit หรือเปิดเผยเนื้อหา source code'] },
      { heading: 'สถานะผลิตภัณฑ์', paragraphs: ['individual analytics และ VS Code integration เป็นโฟกัสหลัก ส่วน team presence เป็น Early Access prototype และ checkout ยังไม่เปิด'] },
      { heading: 'ผู้เผยแพร่', paragraphs: ['StandUpCode / Lodash (Thailand) Co., Ltd. ดูแลและเผยแพร่ AtoAxis'] },
    ],
    faqs: [],
  },
  '/contact': {
    title: 'ติดต่อ AtoAxis',
    description: 'ติดต่อ AtoAxis เรื่อง Early Access, analytics, integrations, privacy หรือ team coding presence รวมถึงคำถามจากนักพัฒนาที่กำลังประเมินบริการ',
    answer: 'ติดต่อทีม AtoAxis ได้เกี่ยวกับ Early Access, hosted developer analytics, editor integrations, privacy และ prototype ของ team coding presence',
    sections: [
      { heading: 'หัวข้อที่สอบถามได้', paragraphs: ['สอบถาม product, privacy, integrations หรือแสดงความสนใจ team presence ได้ทางแบบฟอร์ม Early Access หรืออีเมล hello@atoaxis.com'] },
    ],
    faqs: [],
    form: true,
  },
  '/terms': {
    title: 'ข้อกำหนด AtoAxis',
    description: 'ข้อกำหนดเบื้องต้นของ AtoAxis Early Access บริการ hosted, acceptable use และความคาดหวังก่อนเปิดตัว รวมเงื่อนไขก่อนเปิด paid checkout',
    answer: 'ข้อกำหนดนี้อธิบายเว็บไซต์และ Early Access ของ AtoAxis การลงทะเบียนยังไม่ใช่ subscription แบบเสียเงิน และรายละเอียดเชิงพาณิชย์ฉบับสุดท้ายจะประกาศก่อนเปิด checkout',
    sections: [
      { heading: 'Early Access', paragraphs: ['การลงทะเบียนไม่มีค่าใช้จ่ายและไม่สร้าง paid subscription สิทธิ์ใช้งานอาจจำกัดหรือเปลี่ยนแปลงระหว่างพัฒนา'] },
      { heading: 'ข้อมูลและบริการ hosted', paragraphs: ['AtoAxis วางแผนเป็น hosted service ข้อมูล heartbeat และ privacy อธิบายไว้ในหน้า Privacy'] },
      { heading: 'การใช้งานที่ยอมรับได้', paragraphs: ['ห้ามส่งอีเมลของผู้อื่นโดยไม่ได้รับอนุญาต พยายามหลบเลี่ยง access control หรือใช้เว็บไซต์ละเมิดกฎหมาย'] },
    ],
    faqs: [],
  },
  '/early-access': {
    title: 'เข้าร่วม AtoAxis Early Access',
    description: 'ลงทะเบียน Early Access สำหรับ developer time tracking, ประวัติครบถ้วน integrations, team presence และข่าวการเปิดตัวฟีเจอร์ในอนาคต เพื่อรับข่าวสารก่อนเปิดใช้งานจริง',
    answer: 'ลงทะเบียนเพื่อรับข่าวเปิดตัว AtoAxis hosted developer time tracking, complete coding history, WakaTime-compatible integrations และ prototype ของ team coding presence',
    sections: [
      { heading: 'สิ่งที่จะได้รับ', paragraphs: ['ข่าวการเปิดใช้งาน รายละเอียดผลิตภัณฑ์ และโอกาสช่วยกำหนด integrations หรือ team workflow รุ่นถัดไป'] },
    ],
    faqs: [],
    form: true,
  },
};

function localizedBreadcrumbs(path: string) {
  const labels: Record<string, string> = {
    '/': 'หน้าหลัก',
    '/about': 'เกี่ยวกับเรา',
    '/contact': 'ติดต่อ',
    '/developer-analytics': 'Developer Analytics',
    '/docs': 'เอกสาร',
    '/docs/getting-started': 'เริ่มต้นใช้งาน',
    '/early-access': 'Early Access',
    '/integrations': 'Integrations',
    '/integrations/vscode': 'VS Code',
    '/privacy': 'Privacy',
    '/pricing': 'ราคา',
    '/teams': 'Teams',
    '/terms': 'ข้อกำหนด',
    '/wakatime-alternative': 'ทางเลือก WakaTime',
    '/ai-coding-tracker': 'AI coding tracker',
  };
  const crumbs = [{ name: 'หน้าหลัก', path: localizedPath('th', '/') }];
  if (path !== '/') crumbs.push({ name: labels[path] ?? path, path: localizedPath('th', path) });
  return crumbs;
}

export function ThaiMarketingPage({ path }: { path: string }) {
  const data = THAI_PAGE_DATA[path];
  const breadcrumbs = localizedBreadcrumbs(path);

  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(breadcrumbs), ...(data.faqs.length > 0 ? [faqSchema(data.faqs)] : []))} />
      <PageShell>
        {path !== '/' ? <Breadcrumbs entries={breadcrumbs} /> : null}
        <PageTitle>{data.title}</PageTitle>
        <LeadAnswer>{data.answer}</LeadAnswer>

        {data.code ? <CodeBlock label="~/.wakatime.cfg">{data.code}</CodeBlock> : null}
        {data.sections.map((section) => (
          <Section heading={section.heading} id={section.heading} key={section.heading}>
            {section.paragraphs.map((paragraph) => (
              <p key={`${section.heading}-${paragraph}`} style={MUTED_TEXT}>
                {paragraph}
              </p>
            ))}
            {section.bullets ? <Bullets items={section.bullets} /> : null}
          </Section>
        ))}

        <RelatedLinks
          heading="หน้าที่เกี่ยวข้อง"
          links={[
            { href: localizedPath('th', '/early-access'), label: 'เข้าร่วม Early Access', description: 'รับข่าวเปิดตัวและอัปเดตผลิตภัณฑ์' },
            { href: localizedPath('th', '/privacy'), label: 'ข้อมูลที่เก็บ', description: 'ดู heartbeat fields และข้อมูลที่ไม่ถูกเก็บ' },
            { href: localizedPath('th', '/docs/getting-started'), label: 'เอกสารเริ่มต้นใช้งาน', description: 'ดูวิธีเชื่อม editor กับ hosted API' },
          ]}
        />
      </PageShell>
      {data.faqs.length > 0 ? <FaqSection entries={data.faqs} heading="คำถามที่พบบ่อย" /> : null}
      {data.form ? <EarlyAccessForm locale="th" sourcePage={`th${path}`} /> : null}
    </>
  );
}

export function ThaiPageMetadata(path: string) {
  return THAI_PAGE_DATA[path];
}

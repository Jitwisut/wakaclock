/**
 * The story the two figurines tell along the tour (owner decision 2026-11-15: a short
 * dialogue box, client-only, en/th). Every line is new UI copy: it is rendered in the browser
 * only, never in the server HTML, and makes no claim the page's own sections do not make.
 * Wording approved by the owner 2026-11-15.
 */

export type Speaker = 'bot' | 'dev';

export interface StoryLine {
  en: string;
  speaker: Speaker;
  th: string;
}

/** Who is speaking, as the box labels them. */
export const SPEAKERS: Record<Speaker, { en: string; th: string }> = {
  dev: { en: 'You', th: 'คุณ' },
  bot: { en: 'AI', th: 'AI' },
};

/** One line on the map (index 0) and one per tour stop, in tour order. */
export const STORY: readonly StoryLine[] = [
  {
    speaker: 'dev',
    en: "Nine o'clock. Let's see where today's time goes.",
    th: 'เก้าโมงแล้ว ไปดูกันว่าเวลาวันนี้หายไปไหนบ้าง',
  },
  {
    speaker: 'dev',
    en: 'Every keystroke leaves a heartbeat. Grab them on the way.',
    th: 'ทุกครั้งที่พิมพ์ จะมีหัวใจดวงเล็กหล่นไว้ เก็บไปด้วยระหว่างทางนะ',
  },
  {
    speaker: 'bot',
    en: 'One day, one ring. Each lit arc is time you spent coding.',
    th: 'หนึ่งวันคือหนึ่งวง ส่วนที่สว่างคือช่วงที่คุณเขียนโค้ด',
  },
  {
    speaker: 'bot',
    en: 'Gold is your time, teal is mine. Counted side by side.',
    th: 'สีทองคือเวลาของคุณ สีเขียวคือของผม นับแยกกันคนละช่อง',
  },
  {
    speaker: 'dev',
    en: 'It all ends up in one dashboard. Tap a tower to look closer.',
    th: 'ทุกอย่างมารวมในแดชบอร์ดเดียว ลองแตะตึกดูใกล้ๆ',
  },
  {
    speaker: 'dev',
    en: 'Half the day gone. Step back and look at the whole picture.',
    th: 'ผ่านไปครึ่งวันแล้ว ถอยออกมาดูภาพรวมกันหน่อย',
  },
  {
    speaker: 'bot',
    en: 'Three steps, and your editor starts sending heartbeats.',
    th: 'แค่สามขั้นตอน editor ของคุณก็เริ่มส่งหัวใจมาแล้ว',
  },
  {
    speaker: 'dev',
    en: 'So what is this thing, exactly? Open it and read.',
    th: 'ตกลงมันคืออะไรกันแน่ ลองเปิดอ่านดู',
  },
  {
    speaker: 'bot',
    en: 'Already on WakaTime? Your plugin can come along.',
    th: 'ใช้ WakaTime อยู่แล้ว? ปลั๊กอินเดิมก็มาด้วยได้',
  },
  {
    speaker: 'dev',
    en: 'One plan, everything in it. Easy choice.',
    th: 'แพลนเดียว รวมทุกอย่างไว้แล้ว เลือกง่าย',
  },
  {
    speaker: 'bot',
    en: 'Still curious? Pull up a chair, the answers are here.',
    th: 'ยังสงสัยอะไรอยู่? นั่งลงก่อน คำตอบอยู่ตรงนี้',
  },
];

/** The end of the day: the summary card after the last stop. */
export const DAY_END = {
  title: { en: 'Day complete', th: 'จบวันแล้ว' },
  coded: { en: 'Coded', th: 'เขียนโค้ด' },
  you: { en: 'You', th: 'คุณ' },
  ai: { en: 'AI', th: 'AI' },
  hearts: { en: 'Heartbeats', th: 'หัวใจที่เก็บได้' },
  note: { en: 'A demo day, not your data.', th: 'วันตัวอย่าง ไม่ใช่ข้อมูลจริงของคุณ' },
  again: { en: 'Start the day again', th: 'เริ่มวันใหม่' },
} as const;

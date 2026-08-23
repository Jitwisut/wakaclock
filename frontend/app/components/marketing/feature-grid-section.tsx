import type { SiteLocale } from '@/lib/seo/site';

/**
 * No per-card icon here on purpose. Six abstract glyphs above six headings carry no
 * information the heading does not already carry, and at this density they read as
 * decoration competing with the text. A hard rule in the accent colour marks each card
 * instead, which is cheaper to scan and consistent with the pixel surface language.
 */

const FEATURES = [
  {
    title: 'Complete history',
    description:
      'Every account keeps your full coding history. Nothing is aged out to a recent window, and there is no higher tier to buy for it.',
  },
  {
    title: 'AI attribution in the API',
    description:
      'Heartbeats accept an AI agent name and AI line counts. Whatever your tooling reports under that field is aggregated per agent and per day.',
  },
  {
    title: 'AI vs. human breakdown',
    description:
      'Lines attributed to an AI agent are counted separately from human keystrokes and characters, so the two can be compared over a date range.',
  },
  {
    title: 'Keystroke-level detail',
    description:
      'Keystrokes and characters added or deleted are recorded per project and per day, alongside elapsed time.',
  },
  {
    title: 'Project rules & merges',
    description:
      'Regex-based project detection and manual merges, applied server-side so every client stays in sync automatically.',
  },
  {
    title: 'AST-based language detection',
    description:
      'Tree-sitter parsing instead of file-extension guessing, so ambiguous extensions like .h are handled correctly.',
  },
];

const TH_FEATURES = [
  {
    title: 'ประวัติครบถ้วน',
    description:
      'ทุกบัญชีเก็บ coding history เต็ม ไม่ตัดเหลือเฉพาะช่วงล่าสุด และไม่ต้องซื้อ tier สูงกว่า',
  },
  {
    title: 'AI attribution ใน API',
    description: 'Heartbeat รองรับชื่อ agent และ AI line counts แล้วรวมผลตาม agent และวัน',
  },
  {
    title: 'แยก AI กับ human',
    description:
      'นับ AI-attributed lines แยกจาก human keystrokes และ characters เพื่อเทียบในช่วงเวลาเดียวกัน',
  },
  {
    title: 'รายละเอียดระดับ keystroke',
    description:
      'เก็บจำนวน keystrokes และ characters เพิ่มหรือลบตาม project และวัน โดยไม่เก็บเนื้อหา',
  },
  {
    title: 'Project rules และ merge',
    description: 'ตรวจ project ด้วย regex และรวมโปรเจกต์ฝั่ง server ให้ client ทุกตัวเห็นตรงกัน',
  },
  {
    title: 'ตรวจภาษาด้วย AST',
    description: 'ใช้ tree-sitter แทนการเดาจากนามสกุลไฟล์เพื่อรองรับไฟล์ที่กำกวม',
  },
];

export function FeatureGridSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const features =
    locale === 'th'
      ? FEATURES.map((feature, index) => ({ ...feature, ...TH_FEATURES[index] }))
      : FEATURES;
  const copy =
    locale === 'th'
      ? {
          heading: 'AtoAxis ติดตามอะไรบ้าง',
          subtitle: 'ไม่ใช่แค่เวลาที่ผ่านไป แต่รวม project, language, วิธีเขียนโค้ด และแหล่งข้อมูล',
        }
      : {
          heading: 'What AtoAxis tracks',
          subtitle:
            'Not just elapsed time: which project and language, how the code was written, and where the data lives.',
        };
  return (
    <section className="mkt-reveal mx-auto max-w-6xl px-4 py-20 md:px-6" id="features">
      <div className="mb-12 text-center">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
        >
          {copy.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: 'var(--mkt-fg-muted)' }}>
          {copy.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            className="mkt-pixel-shadow border-[3px] p-6"
            key={feature.title}
            style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-bg-elevated)' }}
          >
            <span
              aria-hidden
              className="mb-4 block h-1 w-10"
              style={{ background: 'var(--mkt-accent)' }}
            />
            <h3 className="text-base font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--mkt-fg-muted)' }}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

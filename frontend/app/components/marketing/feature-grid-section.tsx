import type { SiteLocale } from '@/lib/seo/site';

import { FeatureGallery } from './feature-gallery';

/** Numbered editorial rows expose capabilities without a wall of cards. */

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
          subtitle:
            'เห็นภาพงานครบขึ้น ตั้งแต่เวลาที่ใช้ โปรเจกต์และภาษา ไปจนถึงการมีส่วนร่วมของ AI',
        }
      : {
          heading: 'What AtoAxis tracks',
          subtitle:
            'Not just elapsed time: which project and language, how the code was written, and where the data lives.',
        };
  return (
    <section className="axis-features axis-section" id="features">
      <div className="axis-section-heading mkt-reveal">
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

      <FeatureGallery locale={locale}>
        {features.map((feature, index) => (
          <article className="axis-feature-row mkt-reveal" key={feature.title}>
            <span aria-hidden="true" className="mkt-feature-number">
              0{index + 1} / ATOAXIS
            </span>
            <h3 className="text-base font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--mkt-fg-muted)' }}>
              {feature.description}
            </p>
            <div aria-hidden="true" className="axis-capability-visual">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </article>
        ))}
      </FeatureGallery>
    </section>
  );
}

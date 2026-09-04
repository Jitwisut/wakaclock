import { LockIcon } from 'lucide-react';

import type { SiteLocale } from '@/lib/seo/site';

const MKT_FG_MUTED = 'var(--mkt-fg-muted)';
const MKT_BORDER = 'var(--mkt-border)';

const WEEKLY_BARS = [
  { en: 'Mon', th: 'จ.', pct: 55 },
  { en: 'Tue', th: 'อ.', pct: 78 },
  { en: 'Wed', th: 'พ.', pct: 40 },
  { en: 'Thu', th: 'พฤ.', pct: 92 },
  { en: 'Fri', th: 'ศ.', pct: 65 },
  { en: 'Sat', th: 'ส.', pct: 18 },
  { en: 'Sun', th: 'อา.', pct: 10 },
];

export function DashboardPreviewSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const statTiles =
    locale === 'th'
      ? [
          { label: 'วันนี้', value: '5ชม. 42น.' },
          { label: 'สัปดาห์นี้', value: '28ชม. 10น.' },
          { label: 'มี AI ช่วย', value: '34%' },
          { label: 'โปรเจกต์ปัจจุบัน', value: 'atoaxis' },
        ]
      : [
          { label: 'Today', value: '5h 42m' },
          { label: 'This week', value: '28h 10m' },
          { label: 'AI-assisted', value: '34%' },
          { label: 'Active project', value: 'atoaxis' },
        ];
  const copy =
    locale === 'th'
      ? {
          heading: 'ทุกอย่างที่คาดหวัง พร้อมสิ่งที่หาไม่ได้จากที่อื่น',
          subtitle: 'ตัวอย่างหน้าจอเพื่ออธิบายโครงสร้างและข้อมูลเท่านั้น',
          activity: 'Activity ย้อนหลัง 7 วัน',
          interpretation:
            'ตัวอย่างนี้แสดงวิธีอ่านหนึ่งสัปดาห์ของนักพัฒนาโดยไม่ต้องเปิดรายงานหลายหน้า บัญชีตัวอย่างมีเวลา 28 ชั่วโมง 10 นาทีในเจ็ดวัน วันนี้ทำไป 5 ชั่วโมง 42 นาที และ 34% ของการเปลี่ยนแปลงบรรทัดที่วัดได้มาจาก AI แท่งกราฟบอกว่ากิจกรรมเกิดวันใด ส่วนการ์ดสรุประยะเวลา attribution และโปรเจกต์ปัจจุบัน ตัวเลขทั้งหมดเป็นข้อมูลตัวอย่างที่ AtoAxis สร้างขึ้นเพื่ออธิบายหน้าจอ ไม่ใช่ผลลัพธ์ของลูกค้าหรือ benchmark ในบัญชีจริง ระบบคำนวณระยะเวลาจาก editor heartbeat ที่เกิดใกล้กัน แบ่งการเปลี่ยนแปลงบรรทัดเป็น AI, human หรือ Unattributed และรายงาน coverage เพื่อไม่เปลี่ยนข้อมูลที่ขาดเป็นศูนย์โดยไม่บอก คุณสามารถเริ่มจากวันที่ผิดปกติใน timeline แล้วกรองตามโปรเจกต์ ภาษา editor หรือ branch ก่อนเปิดดูรายชื่อไฟล์ที่เกี่ยวข้อง',
          source: 'แหล่งข้อมูล: ข้อมูลจำลองโดย AtoAxis ไม่ใช่ข้อมูลลูกค้า',
        }
      : {
          heading: "Everything you'd expect, plus what you can't get elsewhere",
          subtitle: 'Illustrative preview. Layout and data are shown for orientation only.',
          activity: 'Activity, last 7 days',
          interpretation:
            'This worked example shows how a developer can read one week without opening several reports. The illustrative account logged 28 hours 10 minutes across seven days, including 5 hours 42 minutes today, and 34% of its measured line changes were attributed to AI. The bars show when activity happened; the tiles summarize duration, attribution and the active project. Those figures are sample data created for this preview, not customer results or a performance benchmark. In a real account, AtoAxis derives duration from nearby editor heartbeats, labels line changes as AI, human or Unattributed, and reports coverage so missing evidence is not silently converted to zero. Use the timeline to find an unusual day, then filter by project, language, editor or branch before reviewing the related file list.',
          source: 'Data source: illustrative AtoAxis sample, not customer data.',
        };
  return (
    <section
      className="mkt-reveal mx-auto max-w-5xl px-4 py-20 md:px-6"
      id="worked-example"
    >
      <div className="mb-10 text-center">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
        >
          {copy.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: MKT_FG_MUTED }}>
          {copy.subtitle}
        </p>
      </div>

      <div
        className="mkt-pixel-shadow overflow-hidden border-[3px]"
        style={{ borderColor: MKT_BORDER, background: 'var(--mkt-bg-elevated)' }}
      >
        <div
          aria-hidden
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: MKT_BORDER, background: 'var(--mkt-bg-sunken)' }}
        >
          <span className="size-2.5 bg-red-500/70" />
          <span className="size-2.5 bg-yellow-500/70" />
          <span className="size-2.5 bg-green-500/70" />
          <div
            className="ml-3 flex items-center gap-1.5 px-2.5 py-1 text-xs"
            style={{ background: 'var(--mkt-bg)', color: MKT_FG_MUTED }}
          >
            <LockIcon aria-hidden className="size-3" />
            app.atoaxis.com/dashboard
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {statTiles.map((tile) => (
              <div className="border-2 p-4" key={tile.label} style={{ borderColor: MKT_BORDER }}>
                <p className="text-xs" style={{ color: MKT_FG_MUTED }}>
                  {tile.label}
                </p>
                <p
                  className="mt-1 text-lg font-semibold"
                  style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
                >
                  {tile.value}
                </p>
              </div>
            ))}
          </div>

          <div className="border-2 p-4" style={{ borderColor: MKT_BORDER }}>
            <p className="mb-4 text-xs font-medium" style={{ color: MKT_FG_MUTED }}>
              {copy.activity}
            </p>
            <div className="flex h-32 items-end gap-3">
              {WEEKLY_BARS.map((bar) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={bar.en}>
                  <div
                    className="w-full"
                    style={{
                      height: `${bar.pct}%`,
                      background: 'var(--mkt-accent)',
                      opacity: 0.85,
                    }}
                  />
                  <span className="text-[10px]" style={{ color: MKT_FG_MUTED }}>
                    {bar[locale]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-3xl text-sm leading-relaxed">
        <p style={{ color: MKT_FG_MUTED }}>{copy.interpretation}</p>
        <p className="mt-3 font-medium">{copy.source}</p>
      </div>
    </section>
  );
}

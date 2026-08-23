import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { localizedPath, type SiteLocale } from '@/lib/seo/site';

/**
 * The three steps between "interested" and "the dashboard has my data in it".
 *
 * Kept on the homepage rather than only in /docs because the most common reason a
 * developer does not adopt a tracker is not disagreeing with it — it is not knowing how
 * much setup it costs. Every command shown here is the real one, quoted from
 * `wakaclock-cli` and the VS Code extension, so the page and the docs cannot drift.
 */
const COPY = {
  en: {
    heading: 'Three steps to your first heartbeat',
    subtitle:
      'Roughly five minutes, most of it waiting for the extension to install. Nothing to deploy and nothing to configure on a server.',
    cta: 'Read the full setup guide',
    note: 'API keys are issued to Early Access members. Join the list and we will email yours.',
    steps: [
      {
        title: 'Generate an API key',
        body: 'Open Settings in the dashboard and choose Generate key. One key covers every editor and AI hook on the account.',
        command: 'wakaclock-cli config set-key YOUR_API_KEY',
      },
      {
        title: 'Point your editor at it',
        body: 'Install the VS Code extension and run Wakaclock: Set API Key. In any editor that already has a WakaTime plugin, change one line in ~/.wakatime.cfg instead.',
        command: 'api_url = https://api.atoaxis.com/api/v1',
      },
      {
        title: 'Watch it count',
        body: 'Edit a file. The status bar shows today’s total within seconds, and the dashboard Overview shows the same number the server counted.',
        command: 'wakaclock-cli today',
      },
    ],
  },
  th: {
    heading: 'สามขั้นตอนสู่ heartbeat แรกของคุณ',
    subtitle:
      'ใช้เวลาราวห้านาที ซึ่งส่วนใหญ่คือรอ extension ติดตั้งเสร็จ ไม่ต้อง deploy อะไร และไม่ต้องตั้งค่าอะไรบน server',
    cta: 'อ่านคู่มือการติดตั้งฉบับเต็ม',
    note: 'API key ออกให้สมาชิก Early Access เข้าร่วมรายชื่อแล้วเราจะส่ง key ให้ทางอีเมล',
    steps: [
      {
        title: 'สร้าง API key',
        body: 'เปิดหน้า Settings ใน dashboard แล้วกด Generate key ใช้ key เดียวได้กับทุก editor และทุก AI hook ในบัญชีนั้น',
        command: 'wakaclock-cli config set-key YOUR_API_KEY',
      },
      {
        title: 'ชี้ editor มาที่ AtoAxis',
        body: 'ติดตั้ง extension บน VS Code แล้วรัน Wakaclock: Set API Key หรือถ้า editor ของคุณมี WakaTime plugin อยู่แล้ว แก้เพียงบรรทัดเดียวใน ~/.wakatime.cfg',
        command: 'api_url = https://api.atoaxis.com/api/v1',
      },
      {
        title: 'ดูมันเริ่มนับ',
        body: 'ลองแก้ไฟล์สักไฟล์ status bar จะขึ้นยอดของวันนี้ภายในไม่กี่วินาที และหน้า Overview จะแสดงตัวเลขเดียวกับที่ server นับไว้',
        command: 'wakaclock-cli today',
      },
    ],
  },
} as const;

export function QuickStartSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const copy = COPY[locale];

  return (
    <section className="mkt-reveal mx-auto max-w-6xl px-4 py-20 md:px-6" id="quick-start">
      <div className="mb-12 text-center">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
        >
          {copy.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base" style={{ color: 'var(--mkt-fg-muted)' }}>
          {copy.subtitle}
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {copy.steps.map((step, index) => (
          <li
            className="mkt-pixel-shadow flex flex-col border-[3px] p-6"
            key={step.title}
            style={{ background: 'var(--mkt-bg-elevated)', borderColor: 'var(--mkt-border)' }}
          >
            <span
              aria-hidden
              className="mb-4 inline-flex size-10 items-center justify-center border-2 text-sm font-bold"
              style={{
                background: 'var(--mkt-accent)',
                borderColor: 'var(--mkt-border)',
                color: 'var(--mkt-accent-fg)',
                fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace',
              }}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="text-base font-bold">{step.title}</h3>
            <p className="mt-2 flex-1 text-sm" style={{ color: 'var(--mkt-fg-muted)' }}>
              {step.body}
            </p>
            <code
              className="mkt-scanlines mt-4 block overflow-x-auto border-2 p-3 text-xs"
              style={{
                background: 'var(--mkt-code-bg)',
                borderColor: 'var(--mkt-border)',
                color: 'var(--mkt-code-fg)',
                fontFamily: 'var(--font-mkt-body), ui-monospace, monospace',
              }}
            >
              {step.command}
            </code>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button asChild size="lg" variant="outline">
          <Link href={localizedPath(locale, '/docs/getting-started')}>{copy.cta}</Link>
        </Button>
        <p className="text-center text-xs" style={{ color: 'var(--mkt-fg-muted)' }}>
          {copy.note}
        </p>
      </div>
    </section>
  );
}

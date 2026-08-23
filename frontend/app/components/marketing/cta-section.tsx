import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { localizedPath, type SiteLocale } from '@/lib/seo/site';

export function CtaSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const copy =
    locale === 'th'
      ? {
          heading: 'เข้าร่วม AtoAxis Early Access',
          body: 'เป็นกลุ่มแรกที่ได้ลอง hosted developer analytics รับข่าวการเปิดตัว และช่วยกำหนด integration รุ่นถัดไป',
          cta: 'เข้าร่วม Early Access',
        }
      : {
          heading: 'Join the AtoAxis early access list',
          body: 'Be first to try the hosted developer analytics product, receive launch updates, and help shape the next integrations.',
          cta: 'Join early access',
        };
  return (
    <section className="mkt-reveal mx-auto max-w-4xl px-4 py-20 md:px-6">
      <div
        className="mkt-pixel-shadow border-[3px] px-8 py-14 text-center md:px-16"
        style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-bg-elevated)' }}
      >
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
        >
          {copy.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base" style={{ color: 'var(--mkt-fg-muted)' }}>
          {copy.body}
        </p>
        <Button
          asChild
          className="mt-8 px-8"
          size="lg"
          style={{ background: 'var(--mkt-accent)', color: 'var(--mkt-accent-fg)' }}
        >
          <Link href={localizedPath(locale, '/early-access')}>{copy.cta}</Link>
        </Button>
      </div>
    </section>
  );
}

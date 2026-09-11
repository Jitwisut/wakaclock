import Link from 'next/link';

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
    <section className="axis-cta mkt-reveal">
      <div className="axis-cta-inner">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
        >
          {copy.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base" style={{ color: 'var(--mkt-fg-muted)' }}>
          {copy.body}
        </p>
        <Link className="axis-cta-link" href={localizedPath(locale, '/early-access')}>
          <span>{copy.cta}</span>
          <span aria-hidden="true" className="axis-cta-arrow">
            ↗
          </span>
        </Link>
      </div>
    </section>
  );
}

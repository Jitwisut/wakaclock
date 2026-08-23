import Link from 'next/link';

import { localizedPath, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

import { PageShell, PageTitle } from './prose';

export function EarlyAccessSuccess({ locale = 'en' }: { locale?: SiteLocale }) {
  const copy =
    locale === 'th'
      ? {
          title: 'ลงทะเบียนสำเร็จ',
          body: `ได้รับคำขอ Early Access ของคุณแล้ว เราจะติดต่อพร้อมข่าวการเปิดตัว ${SITE_NAME}`,
          back: 'กลับหน้าหลัก',
        }
      : {
          title: 'Thanks, you are on the list',
          body: 'We received your Early Access request. We will contact you with launch updates.',
          back: `Back to ${SITE_NAME}`,
        };
  return (
    <PageShell>
      <PageTitle>{copy.title}</PageTitle>
      <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--mkt-fg-muted)' }}>
        {copy.body}
      </p>
      <Link
        className="mt-8 inline-block underline underline-offset-4"
        href={localizedPath(locale, '/')}
      >
        {copy.back}
      </Link>
    </PageShell>
  );
}

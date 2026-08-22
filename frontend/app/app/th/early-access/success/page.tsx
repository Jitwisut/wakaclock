import Link from 'next/link';

import { PageShell, PageTitle } from '@/components/marketing/prose';
import { createMarketingMetadata, localizedPath } from '@/lib/seo/site';

export const metadata = {
  ...createMarketingMetadata({
    description: 'ลงทะเบียน AtoAxis Early Access สำเร็จ เราจะติดต่อเมื่อมีข่าวการเปิดใช้งาน',
    locale: 'th',
    path: '/early-access',
    title: 'ลงทะเบียนสำเร็จ',
  }),
  robots: { follow: true, index: false },
};

export default function Page() {
  return (
    <PageShell>
      <PageTitle>ลงทะเบียนสำเร็จ</PageTitle>
      <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--mkt-fg-muted)' }}>
        ขอบคุณที่สนใจ AtoAxis เราจะส่งข่าวสาร Early Access และการเปิดตัวไปยังอีเมลของคุณ
      </p>
      <Link className="mt-8 inline-block underline underline-offset-4" href={localizedPath('th', '/')}>
        กลับหน้าหลัก
      </Link>
    </PageShell>
  );
}

import { EarlyAccessSuccess } from '@/components/marketing/early-access-success';
import { createMarketingMetadata } from '@/lib/seo/site';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  ...createMarketingMetadata({
    description: 'ลงทะเบียน AtoAxis Early Access สำเร็จ เราจะติดต่อเมื่อมีข่าวการเปิดใช้งาน',
    locale: 'th',
    path: '/early-access',
    title: 'ลงทะเบียนสำเร็จ',
  }),
  robots: { index: false, follow: false },
};
export default function Page() {
  return <EarlyAccessSuccess locale="th" />;
}

import { EarlyAccessSuccess } from '@/components/marketing/early-access-success';
import { createMarketingMetadata } from '@/lib/seo/site';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  ...createMarketingMetadata({
    title: 'Early Access Request Received',
    description: 'Your AtoAxis Early Access request was received.',
    path: '/early-access',
  }),
  robots: { index: false, follow: false },
};
export default function Page() {
  return <EarlyAccessSuccess locale="en" />;
}

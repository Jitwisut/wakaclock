import Link from 'next/link';

import { PageShell, PageTitle } from '@/components/marketing/prose';
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

export default function EarlyAccessSuccessPage() {
  return (
    <PageShell>
      <PageTitle>Thanks — you are on the list</PageTitle>
      <p className="mt-5 text-base leading-relaxed" style={{ color: 'var(--mkt-fg-muted)' }}>
        We received your Early Access request. We will contact you with launch updates.
      </p>
      <Link className="mt-8 inline-block underline underline-offset-4" href="/">
        Back to AtoAxis
      </Link>
    </PageShell>
  );
}

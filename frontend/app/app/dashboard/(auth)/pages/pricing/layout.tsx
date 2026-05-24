import type React from 'react';

import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Pricing Tables',
    description:
      'Compare your services with flexible and user-friendly pricing tables. Offer your customers the most suitable plan with transparent pricing options.',
    canonical: '/pages/pricing/column',
  });
}

export default function PricingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

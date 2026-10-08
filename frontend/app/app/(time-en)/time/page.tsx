import { TimePage, timePageMetadata } from '@/components/marketing/time/time-page';

import type { Metadata } from 'next';

export const metadata: Metadata = timePageMetadata('en');

export default function Page() {
  return <TimePage locale="en" />;
}

import { TimePage, timePageMetadata } from '@/components/marketing/time/time-page';

import type { Metadata } from 'next';

export const metadata: Metadata = timePageMetadata('th');

export default function Page() {
  return <TimePage locale="th" />;
}

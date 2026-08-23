import {
  marketingHomeMetadata,
  MarketingHomePage,
} from '@/components/marketing/marketing-home-page';

import type { Metadata } from 'next';

export const metadata: Metadata = marketingHomeMetadata('th');
export default function Page() {
  return <MarketingHomePage locale="th" />;
}

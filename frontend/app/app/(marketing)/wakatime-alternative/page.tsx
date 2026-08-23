import {
  LocalizedMarketingPage,
  marketingPageMetadata,
} from '@/components/marketing/localized-page';

import type { Metadata } from 'next';

const PATH = '/wakatime-alternative';
export const metadata: Metadata = marketingPageMetadata(PATH, 'en');
export default function Page() {
  return <LocalizedMarketingPage locale="en" path={PATH} />;
}

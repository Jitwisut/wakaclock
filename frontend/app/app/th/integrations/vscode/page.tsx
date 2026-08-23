import {
  LocalizedMarketingPage,
  marketingPageMetadata,
} from '@/components/marketing/localized-page';

import type { Metadata } from 'next';

const PATH = '/integrations/vscode';
export const metadata: Metadata = marketingPageMetadata(PATH, 'th');
export default function Page() {
  return <LocalizedMarketingPage locale="th" path={PATH} />;
}

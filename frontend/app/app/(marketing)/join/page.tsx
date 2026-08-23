import { CampaignPage, campaignPageMetadata } from '@/components/marketing/campaign-page';

import type { Metadata } from 'next';

export const metadata: Metadata = campaignPageMetadata('en');
export default function Page() {
  return <CampaignPage locale="en" />;
}

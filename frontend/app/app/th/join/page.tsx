import { CampaignPage, campaignPageMetadata } from '@/components/marketing/campaign-page';

import type { Metadata } from 'next';

export const metadata: Metadata = campaignPageMetadata('th');
export default function Page() {
  return <CampaignPage locale="th" />;
}

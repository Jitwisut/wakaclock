import { MarketingLayoutFrame } from '@/components/marketing/marketing-layout-frame';

import './marketing.css';

export const dynamic = 'force-static';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingLayoutFrame locale="en">{children}</MarketingLayoutFrame>;
}

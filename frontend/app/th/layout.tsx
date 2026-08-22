import { MarketingLayoutFrame } from '@/components/marketing/marketing-layout-frame';

import '../(marketing)/marketing.css';

export default function ThaiMarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingLayoutFrame locale="th">{children}</MarketingLayoutFrame>;
}

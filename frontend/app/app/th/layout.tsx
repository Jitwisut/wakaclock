import { MarketingLayoutFrame } from '@/components/marketing/marketing-layout-frame';

// Next.js requires global marketing styles to be imported by this route layout too.
// eslint-disable-next-line boundaries/element-types
import '../(marketing)/marketing.css';

export const dynamic = 'force-static';

export default function ThaiMarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingLayoutFrame locale="th">{children}</MarketingLayoutFrame>;
}

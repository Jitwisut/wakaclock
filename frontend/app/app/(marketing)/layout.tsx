import { MarketingLayoutFrame } from '@/components/marketing/marketing-layout-frame';
import { RootDocument } from '@/lib/seo/root-document';

import '../globals.css';
import './marketing.css';
// The homepage's time-ring experience; every rule is scoped under .tx-root.
import '@/components/marketing/time/time.css';

export const dynamic = 'force-static';
export { SITE_METADATA as metadata, SITE_VIEWPORT as viewport } from '@/lib/seo/root-document';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootDocument lang="en">
      <MarketingLayoutFrame locale="en">{children}</MarketingLayoutFrame>
    </RootDocument>
  );
}

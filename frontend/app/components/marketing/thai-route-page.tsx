import { createMarketingMetadata } from '@/lib/seo/site';

import { ThaiMarketingPage, ThaiPageMetadata } from './thai-page';

export function thaiRouteMetadata(path: string) {
  const data = ThaiPageMetadata(path);

  return createMarketingMetadata({
    description: data.description,
    locale: 'th',
    path,
    title: data.title,
  });
}

export function ThaiRoutePage({ path }: { path: string }) {
  return <ThaiMarketingPage path={path} />;
}

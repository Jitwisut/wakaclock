import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/seo/site';

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#0f172a',
    description: SITE_TAGLINE,
    display: 'standalone',
    icons: [{ sizes: '180x180', src: '/apple-icon', type: 'image/png' }],
    name: SITE_NAME,
    short_name: SITE_NAME,
    start_url: SITE_URL,
    theme_color: '#0f172a',
  };
}

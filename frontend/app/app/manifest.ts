import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/seo/site';

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#f8fcf9',
    description: SITE_TAGLINE,
    display: 'standalone',
    icons: [
      { sizes: '192x192', src: '/atoaxis-symbol-v2.png', type: 'image/png', purpose: 'any' },
      {
        sizes: '512x512',
        src: '/atoaxis-symbol-v2.png',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    name: SITE_NAME,
    short_name: SITE_NAME,
    start_url: SITE_URL,
    theme_color: '#177044',
  };
}

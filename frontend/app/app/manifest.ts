import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/seo/site';

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#f8fcf9',
    description: SITE_TAGLINE,
    display: 'standalone',
    icons: [
      { sizes: '192x192', src: '/atoaxis-mark-192.png', type: 'image/png', purpose: 'any' },
      { sizes: '512x512', src: '/atoaxis-mark-512.png', type: 'image/png', purpose: 'any' },
      { sizes: 'any', src: '/atoaxis-mark.svg', type: 'image/svg+xml', purpose: 'any' },
      {
        sizes: '512x512',
        src: '/atoaxis-maskable-512.png',
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

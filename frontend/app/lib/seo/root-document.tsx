import type { ReactNode } from 'react';

import { PRODUCT_ANSWER, SITE_NAME, SITE_TAGLINE, SITE_URL, SOCIAL_IMAGE_PATH } from './site';

import type { Metadata, Viewport } from 'next';

/** Shared metadata used by each language-aware root layout. */
export const SITE_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Developer Time Tracking`,
    template: `%s | ${SITE_NAME}`,
  },
  description: PRODUCT_ANSWER,
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
    languages: { en: '/', th: '/th', 'x-default': '/' },
    types: { 'application/rss+xml': '/feed.xml' },
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Developer Time Tracking`,
    description: SITE_TAGLINE,
    url: SITE_URL,
    images: [
      {
        alt: `${SITE_NAME} — Developer time tracking`,
        height: 630,
        url: SOCIAL_IMAGE_PATH,
        width: 1200,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Developer Time Tracking`,
    description: SITE_TAGLINE,
    images: [SOCIAL_IMAGE_PATH],
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: { google: 'RA0nx3aI674qLp5GwkgzJPk3-7a7ulAAaDNcBgvtLs4' },
  icons: {
    icon: [
      { url: '/atoaxis-mark.svg', type: 'image/svg+xml' },
      { url: '/atoaxis-mark-192.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/atoaxis-mark-192.png',
    apple: { url: '/atoaxis-apple-touch-180.png', sizes: '180x180' },
  },
  manifest: '/manifest.webmanifest',
};

export const SITE_VIEWPORT: Viewport = { themeColor: '#177044' };

export function RootDocument({ lang, children }: { children: ReactNode; lang: 'en' | 'th' }) {
  return (
    <html data-scroll-behavior="smooth" lang={lang} suppressHydrationWarning>
      <head>
        <link href="https://api.atoaxis.com" rel="dns-prefetch" />
        <link crossOrigin="anonymous" href="https://api.atoaxis.com" rel="preconnect" />
      </head>
      <body className="bg-background group/layout">{children}</body>
    </html>
  );
}

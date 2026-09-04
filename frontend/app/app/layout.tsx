import type React from 'react';

import {
  PRODUCT_ANSWER,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  SOCIAL_IMAGE_PATH,
} from '@/lib/seo/site';

import type { Metadata, Viewport } from 'next';

import './globals.css';

/**
 * `theme-color` tints the mobile browser chrome; it carries no ranking weight. The value
 * is the same slate the PWA manifest declares, so the two never drift apart.
 */
export const viewport: Viewport = {
  themeColor: '#0f172a',
};

/**
 * Cookie-backed dashboard theme state and authenticated providers live under /dashboard,
 * while the marketing route groups opt into static rendering below this root layout.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Developer Time Tracking`,
    template: `%s | ${SITE_NAME}`,
  },
  description: PRODUCT_ANSWER,
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
    languages: {
      en: '/',
      th: '/th',
      'x-default': '/',
    },
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
  /**
   * Without `max-image-preview: large`, Google caps the preview it will show for this
   * site at a thumbnail, which rules the pages out of Discover and shrinks the image in
   * a normal result. The other two are Google's own defaults, restated so the directive
   * reads as a complete policy rather than a single override.
   *
   * Per-page `noindex` still wins over this: the private surfaces set their own robots
   * metadata in their layouts, and a page-level directive overrides the root one.
   */
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: {
    google: 'RA0nx3aI674qLp5GwkgzJPk3-7a7ulAAaDNcBgvtLs4',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon',
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // next-themes updates these root attributes from client-side theme state
  // before hydration; the server cannot render that localStorage/system value.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background group/layout">{children}</body>
    </html>
  );
}

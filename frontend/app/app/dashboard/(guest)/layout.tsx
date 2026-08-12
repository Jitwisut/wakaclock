import type React from 'react';

import type { Metadata } from 'next';

/**
 * Login, register and password-reset routes. Nothing here is useful as a search
 * result, and indexing auth entry points invites credential-phishing lookalikes
 * in the SERP.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function GuestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

import { Suspense } from 'react';

import { AuthScreen } from '@/components/auth/auth-screen';
import { createMarketingMetadata } from '@/lib/seo/site';

import type { Metadata } from 'next';

/**
 * `createMarketingMetadata` builds a full `openGraph`/`twitter` block (title, description,
 * image, siteName) with `url` set to this page's own canonical path. Setting `openGraph`
 * by hand instead — as this used to — replaces the root layout's whole `openGraph` object
 * rather than merging into it (Next resolves each metadata field per segment), which is
 * how the previous version ended up with a share card pointing at `/` with no title: it
 * inherited the root's `openGraph` unchanged because it never overrode any of it.
 */
const BASE_METADATA = createMarketingMetadata({
  description:
    'Sign in to your AtoAxis account to view coding time, project activity and attribution reports.',
  path: '/login',
  title: 'Sign in to your AtoAxis account',
});

export const metadata: Metadata = {
  ...BASE_METADATA,
  title: { absolute: 'Sign in to your AtoAxis account' },
  // Login has no Thai route, unlike every page `createMarketingMetadata` was designed for —
  // override its `en`/`th` hreflang pair rather than link to a `/th/login` that doesn't exist.
  alternates: { canonical: '/login' },
  robots: { index: false, follow: false, nocache: true },
};

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary; the fallback is the page background rather
  // than a spinner, so nothing flashes in and out on a render this fast.
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AuthScreen mode="login" />
    </Suspense>
  );
}

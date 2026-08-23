import { Suspense } from 'react';

import { AuthScreen } from '@/components/auth/auth-screen';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
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

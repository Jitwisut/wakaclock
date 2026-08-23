import { Suspense } from 'react';

import { AuthScreen } from '@/components/auth/auth-screen';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create an account',
  robots: { index: false, follow: false, nocache: true },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AuthScreen mode="register" />
    </Suspense>
  );
}

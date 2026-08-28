import { Suspense } from 'react';

import { RequireUser } from '@/components/wakaclock/require-user';

import { DeviceApprovalScreen } from './components/device-approval-screen';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Approve device',
  robots: { index: false, follow: false, nocache: true },
};

export default function DeviceApprovalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <RequireUser>
        <DeviceApprovalScreen />
      </RequireUser>
    </Suspense>
  );
}

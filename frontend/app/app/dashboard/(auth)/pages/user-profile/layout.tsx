import type React from 'react';

import { ProfileStoreProvider } from '@/app/dashboard/(auth)/pages/user-profile/store';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProfileStoreProvider>{children}</ProfileStoreProvider>;
}

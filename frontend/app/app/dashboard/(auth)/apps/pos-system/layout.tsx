import type React from 'react';

import { PosSystemStoreProvider } from '@/app/dashboard/(auth)/apps/pos-system/store';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PosSystemStoreProvider>{children}</PosSystemStoreProvider>;
}

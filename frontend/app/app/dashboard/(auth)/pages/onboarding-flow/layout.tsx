import type React from 'react';

import { OnboardingStoreProvider } from '@/app/dashboard/(auth)/pages/onboarding-flow/store';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <OnboardingStoreProvider>{children}</OnboardingStoreProvider>;
}

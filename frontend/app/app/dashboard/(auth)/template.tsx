import type * as React from 'react';

import { RouteTransition } from '@/components/wakaclock/route-transition';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <RouteTransition>{children}</RouteTransition>;
}

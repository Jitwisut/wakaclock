'use client';

import { InsightsWorkspace } from '@/components/wakaclock/insights/insights-workspace';
import { RequireUser } from '@/components/wakaclock/require-user';

export default function InsightsPage() {
  return (
    <RequireUser>
      <InsightsWorkspace />
    </RequireUser>
  );
}

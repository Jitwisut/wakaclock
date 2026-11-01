'use client';

import { TimeMachinePanel } from '@/components/wakaclock/analytics/time-machine';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';

export default function TimeMachinePage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Watch your project grow as a city of modules, or replay your work over time."
        title="Time Machine"
      />
      <RequireUser>
        <TimeMachinePanel />
      </RequireUser>
    </div>
  );
}

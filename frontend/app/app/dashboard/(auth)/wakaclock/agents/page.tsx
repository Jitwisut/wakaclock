'use client';

import { Suspense } from 'react';

import { AgentUniversePanel } from '@/components/wakaclock/agents/agent-universe';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { RequireUser } from '@/components/wakaclock/require-user';

export default function AgentUniversePage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="See which AI agents worked on which projects, and how many tokens they used."
        title="Agent Universe"
      />
      <RequireUser>
        <Suspense fallback={null}>
          <AgentUniversePanel />
        </Suspense>
      </RequireUser>
    </div>
  );
}

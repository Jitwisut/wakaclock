'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { GlassSurface } from '@/components/wakaclock/glass/glass-surface';
import { RequireUser } from '@/components/wakaclock/require-user';
import { RequiresPostgres } from '@/components/wakaclock/requires-postgres';

import { TeamsWorkspace } from './components/team-workspace';

export default function TeamsPage() {
  return (
    <RequireUser>
      <RequiresPostgres feature="Teams">
        <GlassSurface>
          <React.Suspense fallback={<Skeleton className="h-[70svh] w-full rounded-[22px]" />}>
            <TeamsWorkspace />
          </React.Suspense>
        </GlassSurface>
      </RequiresPostgres>
    </RequireUser>
  );
}

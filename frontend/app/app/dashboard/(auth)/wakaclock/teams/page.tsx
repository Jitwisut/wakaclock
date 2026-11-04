'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { RequireUser } from '@/components/wakaclock/require-user';
import { RequiresPostgres } from '@/components/wakaclock/requires-postgres';

import { TeamsWorkspace } from './components/team-workspace';

export default function TeamsPage() {
  return (
    <RequireUser>
      <RequiresPostgres feature="Teams">
        <React.Suspense fallback={<Skeleton className="h-[70svh] w-full" />}>
          <TeamsWorkspace />
        </React.Suspense>
      </RequiresPostgres>
    </RequireUser>
  );
}

'use client';

import * as React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getSessionObservation } from '@/lib/wakaclock/session';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const token = useWakaclockUserStore((state) => state.token);
  return <SessionQueries key={getSessionObservation(token)}>{children}</SessionQueries>;
}

function SessionQueries({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

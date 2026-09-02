'use client';

import type * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCapabilities } from '@/hooks/use-capabilities';

/**
 * Gate for features that only exist when the server has a transactional store.
 *
 * Goals, leaderboards and share links live in Postgres, and the server runs perfectly
 * well without one — a ClickHouse-only install is a supported configuration, not a
 * broken one. Without this gate those pages would render a wall of failed requests and
 * read as a bug in the product rather than as a feature this deployment does not include.
 */
export function RequiresPostgres({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature: string;
}) {
  const { isLoading, postgresEnabled } = useCapabilities();

  // Unknown is not the same as unavailable: showing the notice while the answer is still
  // in flight would flash it on every page load for deployments that do have Postgres.
  if (isLoading || postgresEnabled === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!postgresEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{feature} needs a transactional store</CardTitle>
          <CardDescription>
            This server is running in ClickHouse-only mode. Coding time, projects and analytics
            all work; {feature.toLowerCase()} is stored in PostgreSQL, which is not configured
            here.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Set <code className="font-mono">POSTGRES_URL</code> on the server and restart it to
          enable this page.
        </CardContent>
      </Card>
    );
  }

  return children;
}

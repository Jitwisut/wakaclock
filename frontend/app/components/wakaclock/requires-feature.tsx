'use client';

import type * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCapabilities } from '@/hooks/use-capabilities';

/**
 * Gate a page with the server-advertised feature matrix.
 *
 * A route can exist while its runtime is deliberately disabled. Rendering the
 * page in that state causes a guaranteed 503 request and makes an unavailable
 * capability look like a transient application error. Wait for the capability
 * response, then explain the deployment state without making the request.
 */
export function RequiresFeature({
  children,
  feature,
  featureKey,
}: {
  children: React.ReactNode;
  feature: string;
  featureKey: string;
}) {
  const { isLoading, featureAvailability } = useCapabilities();

  if (isLoading || featureAvailability === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (featureAvailability[featureKey] !== true) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{feature} is unavailable in this deployment</CardTitle>
          <CardDescription>
            The server has this capability disabled, so no request was sent. This page will become
            available when the deployment enables the complete {feature.toLowerCase()} runtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Check the server capability manifest or contact the deployment administrator for the
          rollout status.
        </CardContent>
      </Card>
    );
  }

  return children;
}

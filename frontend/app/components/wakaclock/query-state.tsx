'use client';

import { AlertCircleIcon, InboxIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { WakaclockError } from '@/lib/wakaclock/client';

interface QueryStateProps {
  children: React.ReactNode;
  emptyDescription?: string;
  emptyTitle?: string;
  error: unknown;
  isEmpty?: boolean;
  isLoading: boolean;
  skeletonClassName?: string;
}

/**
 * Standard loading / error / empty handling for every wakaclock panel so
 * "no data for this user" never looks like a broken request.
 */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyTitle = 'No data yet',
  emptyDescription = 'Nothing recorded for this range. Send a heartbeat or switch users.',
  skeletonClassName = 'h-40 w-full',
  children,
}: QueryStateProps) {
  if (isLoading) {
    return <Skeleton className={skeletonClassName} />;
  }

  if (error) {
    const message = error instanceof WakaclockError ? error.message : 'Something went wrong.';
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Request failed</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  if (isEmpty) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return children;
}

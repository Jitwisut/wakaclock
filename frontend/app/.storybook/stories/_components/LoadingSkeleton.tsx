import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface LoadingSkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Number of skeleton rows to display */
  rows?: number;
  /** Whether to show a header skeleton */
  showHeader?: boolean;
  /** Visual layout variant */
  variant?: 'card' | 'list' | 'table' | 'text';
}

/**
 * LoadingSkeleton - Reusable loading skeleton component for stories
 *
 * Shows animated skeleton with shimmer effect in various layouts.
 * Uses the existing Skeleton component for consistent styling.
 */
export function LoadingSkeleton({
  rows = 3,
  variant = 'list',
  showHeader = false,
  className,
}: LoadingSkeletonProps) {
  const { t } = useTranslation();

  return (
    <div
      aria-busy="true"
      aria-label={t('loadingSkeleton.ariaLabel', 'Loading content')}
      className={cn('animate-in fade-in duration-300', className)}
      data-slot="loading-skeleton"
      data-state="loading"
      data-testid="story-loading"
      data-variant={variant}
      role="status"
    >
      {variant === 'text' && <TextSkeleton rows={rows} showHeader={showHeader} />}
      {variant === 'list' && <ListSkeleton rows={rows} showHeader={showHeader} />}
      {variant === 'card' && <CardSkeleton rows={rows} showHeader={showHeader} />}
      {variant === 'table' && <TableSkeleton rows={rows} showHeader={showHeader} />}
      <span className="sr-only">{t('loadingSkeleton.srText', 'Loading...')}</span>
    </div>
  );
}

function TextSkeleton({ rows, showHeader }: { rows: number; showHeader: boolean }) {
  return (
    <div className="space-y-3">
      {showHeader && <Skeleton aria-hidden="true" className="h-6 w-1/3" />}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          aria-hidden="true"
          className={cn('h-4', i === rows - 1 ? 'w-2/3' : 'w-full')}
          key={`text-row-${String(i)}`}
        />
      ))}
    </div>
  );
}

function ListSkeleton({ rows, showHeader }: { rows: number; showHeader: boolean }) {
  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center gap-3 border-b pb-3">
          <Skeleton aria-hidden="true" className="h-5 w-1/4" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          className="flex items-center gap-3 rounded-lg border p-3"
          key={`list-item-${String(i)}`}
        >
          <Skeleton aria-hidden="true" className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton aria-hidden="true" className="h-4 w-3/4" />
            <Skeleton aria-hidden="true" className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardSkeleton({ rows, showHeader }: { rows: number; showHeader: boolean }) {
  return (
    <div className="space-y-4">
      {showHeader && <Skeleton aria-hidden="true" className="h-6 w-1/3" />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="space-y-3 rounded-xl border p-4" key={`card-${String(i)}`}>
            <Skeleton aria-hidden="true" className="h-32 w-full rounded-lg" />
            <Skeleton aria-hidden="true" className="h-4 w-3/4" />
            <Skeleton aria-hidden="true" className="h-4 w-1/2" />
            <div className="flex gap-2 pt-2">
              <Skeleton aria-hidden="true" className="h-8 w-20" />
              <Skeleton aria-hidden="true" className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows, showHeader }: { rows: number; showHeader: boolean }) {
  const columns = 4;

  return (
    <div className="w-full space-y-3">
      {showHeader && (
        <div className="flex gap-4 border-b pb-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton aria-hidden="true" className="h-4 flex-1" key={`header-${String(i)}`} />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="flex gap-4" key={`table-row-${String(rowIndex)}`}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              aria-hidden="true"
              className="h-4 flex-1"
              key={`cell-${String(rowIndex)}-${String(colIndex)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

LoadingSkeleton.displayName = 'LoadingSkeleton';

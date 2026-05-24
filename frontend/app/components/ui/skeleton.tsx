import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Skeleton component props
 *
 * @description Props for the Skeleton loading placeholder component.
 */
export type SkeletonProps = React.ComponentProps<'div'> & {
  /**
   * Custom test ID for testing
   * @default 'skeleton'
   */
  testId?: string;
};

/**
 * Skeleton component - Loading placeholder with pulse animation
 *
 * @description
 * A placeholder element with a pulse animation that indicates
 * content is loading. Reduces perceived wait time and layout shift.
 *
 * ## Features
 * - **Pulse Animation**: Subtle shimmer effect
 * - **Composable**: Build complex loading layouts
 * - **Accessible**: aria-busy and aria-live for screen readers
 * - **Flexible Sizing**: Control via className (w-*, h-*)
 *
 * ## Use Cases
 * - Card content placeholders
 * - Text line placeholders
 * - Avatar placeholders
 * - Image loading states
 * - Table row placeholders
 *
 * ## Best Practices
 * - Match skeleton dimensions to actual content
 * - Use multiple skeletons to match content layout
 * - Consider prefers-reduced-motion for animations
 *
 * @example
 * ```tsx
 * // Text lines
 * <div className="space-y-2">
 *   <Skeleton className="h-4 w-[250px]" />
 *   <Skeleton className="h-4 w-[200px]" />
 * </div>
 *
 * // Card skeleton
 * <div className="flex items-center space-x-4">
 *   <Skeleton className="h-12 w-12 rounded-full" />
 *   <div className="space-y-2">
 *     <Skeleton className="h-4 w-[250px]" />
 *     <Skeleton className="h-4 w-[200px]" />
 *   </div>
 * </div>
 *
 * // Image placeholder
 * <Skeleton className="h-[200px] w-full rounded-lg" />
 *
 * // Conditional loading
 * {isLoading ? (
 *   <Skeleton className="h-10 w-full" />
 * ) : (
 *   <Input value={data} />
 * )}
 * ```
 */
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, testId = 'skeleton', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="skeleton"
        data-testid={testId}
        aria-busy="true"
        aria-live="polite"
        className={cn('bg-accent animate-pulse rounded-md', className)}
        {...props}
      />
    );
  }
);
Skeleton.displayName = 'Skeleton';

export { Skeleton };

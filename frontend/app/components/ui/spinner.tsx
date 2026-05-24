import * as React from 'react';

import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Spinner component props
 *
 * @description Props for the Spinner loading indicator component.
 */
export type SpinnerProps = React.ComponentProps<'svg'> & {
  /**
   * Custom test ID for testing
   * @default 'spinner'
   */
  testId?: string;
};

/**
 * Spinner component - Animated loading indicator
 *
 * @description
 * A rotating spinner icon that indicates loading or processing state.
 * Uses CSS animation for smooth rotation.
 *
 * ## Features
 * - **Smooth Animation**: CSS-based rotation for performance
 * - **Scalable**: Adjust size via className
 * - **Accessible**: role="status" with aria-label
 * - **Themeable**: Inherits text color from parent
 *
 * ## Use Cases
 * - Button loading states
 * - Content loading indicators
 * - Form submission feedback
 * - Async data fetching
 * - Page transitions
 *
 * ## Accessibility
 * - `role="status"` for screen reader announcement
 * - `aria-label="Loading"` provides context
 *
 * @example
 * ```tsx
 * // Basic spinner
 * <Spinner />
 *
 * // Larger spinner
 * <Spinner className="size-8" />
 *
 * // In a button
 * <Button disabled>
 *   <Spinner className="mr-2" />
 *   Loading...
 * </Button>
 *
 * // Centered loading state
 * <div className="flex items-center justify-center p-8">
 *   <Spinner className="size-6" />
 * </div>
 *
 * // With custom color
 * <Spinner className="text-primary size-5" />
 * ```
 */
const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, testId = 'spinner', ...props }, ref) => {
    return (
      <Loader2Icon
        ref={ref}
        data-slot="spinner"
        data-testid={testId}
        role="status"
        aria-label="Loading"
        className={cn('size-4 animate-spin', className)}
        {...props}
      />
    );
  }
);
Spinner.displayName = 'Spinner';

export { Spinner };

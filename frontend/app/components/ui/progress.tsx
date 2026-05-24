'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/lib/utils';

/**
 * Progress component props
 *
 * @description Props for the Progress indicator component.
 * @see https://www.radix-ui.com/primitives/docs/components/progress
 */
export type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Custom color class for the progress indicator */
  indicatorColor?: string;
  /**
   * Custom test ID for testing
   * @default 'progress'
   */
  testId?: string;
};

/**
 * Progress component - Visual indicator for completion status
 *
 * @description
 * An accessible progress bar that displays completion percentage
 * with proper ARIA attributes and smooth animations.
 *
 * ## Features
 * - **Value Clamping**: Automatically clamps between 0-100
 * - **Accessible Labels**: Provides aria-valuetext for screen readers
 * - **Custom Colors**: Override indicator color via prop
 * - **Smooth Animation**: CSS transition on value changes
 * - **Indeterminate State**: Shows activity without known completion
 *
 * ## Use Cases
 * - File upload progress
 * - Form completion percentage
 * - Loading indicators
 * - Profile completion status
 * - Download/Installation progress
 *
 * ## Accessibility
 * - `role="progressbar"` (provided by Radix)
 * - `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
 * - `aria-valuetext` for readable percentage
 *
 * @example
 * ```tsx
 * // Basic progress
 * <Progress value={60} />
 *
 * // With custom indicator color
 * <Progress value={75} indicatorColor="bg-green-500" />
 *
 * // With label
 * <div className="space-y-2">
 *   <div className="flex justify-between text-sm">
 *     <span>Uploading...</span>
 *     <span>75%</span>
 *   </div>
 *   <Progress value={75} />
 * </div>
 *
 * // Animated progress
 * const [progress, setProgress] = React.useState(0);
 * React.useEffect(() => {
 *   const timer = setInterval(() => {
 *     setProgress((p) => (p >= 100 ? 0 : p + 10));
 *   }, 500);
 *   return () => clearInterval(timer);
 * }, []);
 * <Progress value={progress} />
 *
 * // Status variants
 * <Progress value={100} indicatorColor="bg-green-500" /> // Success
 * <Progress value={50} indicatorColor="bg-yellow-500" /> // Warning
 * <Progress value={25} indicatorColor="bg-red-500" />    // Error
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/progress
 */
const Progress = React.forwardRef<React.ComponentRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, indicatorColor, value, testId = 'progress', ...props }, ref) => {
    const safeValue = Math.min(Math.max(value ?? 0, 0), 100);
    return (
      <ProgressPrimitive.Root
        ref={ref}
        data-slot="progress"
        data-testid={testId}
        value={safeValue}
        aria-valuetext={`${safeValue}% complete`}
        className={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          data-testid={`${testId}-indicator`}
          className={cn('bg-primary h-full w-full flex-1 transition-all', indicatorColor)}
          style={{ transform: `translateX(-${100 - safeValue}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };

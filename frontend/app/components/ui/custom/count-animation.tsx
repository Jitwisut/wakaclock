'use client';

import * as React from 'react';
import { useEffect, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import { motion, useMotionValue, useMotionValueEvent, animate } from 'motion/react';

/**
 * CountAnimation component props
 *
 * @description Props for the animated number counter component.
 * Extends motion.span props, excluding children.
 */
export interface CountAnimationProps extends Omit<
  React.ComponentPropsWithoutRef<typeof motion.span>,
  'children'
> {
  /** The target number to animate to */
  value?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Starting number for the animation */
  from?: number;
  /**
   * Custom test ID for testing
   * @default 'count-animation'
   */
  testId?: string;
}

/**
 * CountAnimation component - Animated number counter
 *
 * @description
 * A component that smoothly animates from a starting value to a target value.
 * Perfect for dashboards, statistics, and any numeric displays that need visual emphasis.
 *
 * ## Features
 * - **Smooth Animation**: Motion-powered spring animations
 * - **Configurable Duration**: Customize animation timing
 * - **Start Value**: Begin from any number
 * - **Rounded Display**: Shows whole numbers only
 *
 * ## Use Cases
 * - Dashboard statistics
 * - Counter displays
 * - Progress indicators
 * - Achievement badges
 * - Financial metrics
 *
 * ## Accessibility
 * - Uses semantic span element
 * - Screen readers announce final value
 *
 * @example
 * ```tsx
 * // Basic counter
 * <CountAnimation value={1000} />
 *
 * // With custom duration
 * <CountAnimation value={500} duration={3} />
 *
 * // Starting from a different value
 * <CountAnimation value={100} from={50} duration={1} />
 *
 * // Styled counter
 * <CountAnimation
 *   value={9999}
 *   className="text-4xl font-bold text-primary"
 * />
 * ```
 */
const CountAnimation = React.forwardRef<HTMLSpanElement, CountAnimationProps>(
  ({ className, value = 0, duration = 2, from = 0, testId = 'count-animation', ...props }, ref) => {
    const safeNumber = Number.isFinite(value) ? value : 0;
    const safeDuration = Number.isFinite(duration) ? duration : 0;
    const safeFrom = Number.isFinite(from) ? from : 0;
    const shouldAnimate = safeDuration > 0;

    const count = useMotionValue(shouldAnimate ? safeFrom : safeNumber);
    // Render through React state, not by handing the motion value to `motion.span`.
    // A motion-value child rewrites the text node outside React on every frame, and
    // WebKit then never repaints a `background-clip: text` ancestor: Safari showed the
    // whole gradient as a solid box instead of the digits (heartbeats `.bigNumber`).
    const [animatedNumber, setAnimatedNumber] = React.useState(() =>
      Math.round(shouldAnimate ? safeFrom : safeNumber)
    );
    useMotionValueEvent(count, 'change', (latest) => setAnimatedNumber(Math.round(latest)));
    const renderedNumber = shouldAnimate ? animatedNumber : Math.round(safeNumber);

    useLayoutEffect(() => {
      if (shouldAnimate) return;
      count.set(safeNumber);
    }, [count, safeNumber, shouldAnimate]);

    useEffect(() => {
      if (!shouldAnimate) return;

      const animation = animate(count, safeNumber, { duration: safeDuration });

      return animation.stop;
    }, [count, safeDuration, safeNumber, shouldAnimate]);

    return (
      <motion.span
        ref={ref}
        data-slot="count-animation"
        data-testid={testId}
        className={cn(className)}
        {...props}
      >
        {renderedNumber}
      </motion.span>
    );
  }
);
CountAnimation.displayName = 'CountAnimation';

export { CountAnimation };

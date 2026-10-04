'use client';

import * as React from 'react';

import { animate, motion, MotionConfig, useMotionValue, useMotionValueEvent } from 'motion/react';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { formatDurationShort } from '@/lib/wakaclock/format';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Motion defaults for the whole overview. `reducedMotion="user"` makes every `motion.*`
 * element below honour `prefers-reduced-motion` (transforms off, opacity kept) without
 * each component having to check.
 */
export function OverviewMotion({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.6, ease: EASE }}>
      {children}
    </MotionConfig>
  );
}

/** Fades a section up the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      transition={{ delay, duration: 0.6, ease: EASE }}
      viewport={{ margin: '0px 0px -60px 0px', once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Counts a duration up from zero on first render, then eases between later values (the
 * status bar refetches every minute). The final text is exactly `formatDurationShort`,
 * the same formatter the value used before — only the frames in between are animated —
 * and screen readers only ever get the settled value.
 */
export function AnimatedDuration({ className, seconds }: { className?: string; seconds: number }) {
  const reduced = useReducedMotion();
  const value = useMotionValue(0);
  const [text, setText] = React.useState(() => formatDurationShort(0));

  useMotionValueEvent(value, 'change', (latest) => setText(formatDurationShort(latest)));

  React.useEffect(() => {
    if (reduced) {
      value.jump(seconds);
      setText(formatDurationShort(seconds));
      return;
    }
    const controls = animate(value, seconds, { duration: 1.4, ease: EASE });
    return controls.stop;
  }, [reduced, seconds, value]);

  const settled = formatDurationShort(seconds);

  return (
    <span className={className}>
      <span aria-hidden>{text}</span>
      <span className="sr-only">{settled}</span>
    </span>
  );
}

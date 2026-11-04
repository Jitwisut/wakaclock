'use client';

import * as React from 'react';

import { motion, useReducedMotion, useSpring } from 'motion/react';

import { cn } from '@/lib/utils';

const SPRING = { stiffness: 260, damping: 24, mass: 0.6 } as const;

/** Larger surfaces tilt less, so a wide form panel only leans while a tile visibly turns. */
export function tiltAngle(width: number, max?: number): number {
  if (max !== undefined) return max;
  return Math.min(7, Math.max(1.2, 1800 / Math.max(width, 1)));
}

/**
 * Leans its content toward the mouse in 3D, lifts on hover and settles on press, all on
 * springs. Only a mouse drives it: touch, pen and keyboard users get a flat surface, as
 * does anyone who prefers reduced motion. While focus is inside (typing into a form) the
 * surface lies flat so it never moves under the caret.
 */
export function Tilt3D({
  children,
  className,
  max,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const focused = React.useRef(false);
  const hoverScale = React.useRef(1);
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const scale = useSpring(1, SPRING);

  const settle = () => {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (reduceMotion || focused.current || event.pointerType !== 'mouse' || !element) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const angle = tiltAngle(rect.width, max);
    rotateY.set(x * angle * 2);
    rotateX.set(-y * angle * 2);
    hoverScale.current = 1 + Math.min(0.02, 8 / rect.width);
    scale.set(hoverScale.current);
  };

  return (
    <motion.div
      className={cn('will-change-transform', className)}
      data-tilt
      onBlurCapture={() => {
        focused.current = false;
      }}
      onFocusCapture={() => {
        focused.current = true;
        settle();
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && !reduceMotion) scale.set(hoverScale.current - 0.015);
      }}
      onPointerLeave={settle}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        if (!focused.current) scale.set(hoverScale.current);
      }}
      ref={ref}
      style={{ rotateX, rotateY, scale, transformPerspective: 1100 }}
    >
      {children}
    </motion.div>
  );
}

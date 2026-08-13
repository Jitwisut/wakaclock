'use client';

import { motion } from 'motion/react';

const PARTICLE_COLORS = ['#E0342B', '#F5C945', '#2FBFA0', '#B24BF3', '#2E86DE'];

/**
 * A short, decorative particle burst — plays once when two dragged characters are
 * dropped close together in the room canvas, then unmounts (see `room-canvas.tsx`).
 * Square, hard-edged pixels rather than soft circles, matching the rest of the
 * retro-arcade redesign — a blurred/rounded burst would read as claymorphism confetti.
 *
 * Reports the pairing to the server for real (see `startOrJoinSession` in
 * `room-canvas.tsx` — plan.md 7.4's co-working sessions are genuinely recorded); this
 * component itself stays purely decorative and makes no claim in its own copy, since it
 * plays regardless of whether the server call it accompanies happens to succeed.
 */
export function CelebrationBurst() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {PARTICLE_COLORS.map((color, i) => {
        const angle = (i / PARTICLE_COLORS.length) * Math.PI * 2;
        const distance = 46;

        return (
          <motion.span
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              opacity: 0,
              scale: 0.4,
            }}
            className="absolute size-2"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            key={color}
            style={{ background: color }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

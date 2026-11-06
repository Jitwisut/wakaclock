'use client';

import type * as React from 'react';

import { motion, MotionConfig } from 'motion/react';

import { useActivePreset } from '@/components/active-theme';
import { NATIVE_LAYOUT_PRESET } from '@/components/wakaclock/layout-switch';

/**
 * The entrance every dashboard page shares: a fade with a little rise, transform and
 * opacity only, so it stays on the compositor. Next.js remounts a route template on
 * navigation, which replays it per page; the navigation and toolbar live in the layout
 * above and never move. At rest the wrapper's transform is `none`, so it never becomes the
 * containing block for a page's fixed or sticky elements.
 *
 * Cinema cuts in like a camera settling (longer travel, expo ease-out); other presets
 * keep the short fade they were designed with.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const cinema = useActivePreset() === NATIVE_LAYOUT_PRESET;
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        data-slot="route-transition"
        initial={{ opacity: 0, y: cinema ? 14 : 6 }}
        transition={
          cinema
            ? { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
            : { duration: 0.22, ease: [0.2, 0, 0, 1] }
        }
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

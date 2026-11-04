'use client';

import type * as React from 'react';

import { motion, MotionConfig } from 'motion/react';

/**
 * The entrance every dashboard page shares: a short fade with a few pixels of rise,
 * transform and opacity only, so it stays on the compositor. Next.js remounts a route
 * template on navigation, which replays it per page; the sidebar and toolbar live in the
 * layout above and never move. At rest the wrapper's transform is `none`, so it never
 * becomes the containing block for a page's fixed or sticky elements.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        data-slot="route-transition"
        initial={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

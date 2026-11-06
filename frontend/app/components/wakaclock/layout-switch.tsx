'use client';

import type * as React from 'react';

import { useActivePreset } from '@/components/active-theme';

/** The preset whose pages use the rebuilt workspace layouts. */
export const NATIVE_LAYOUT_PRESET = 'motion-native';

/**
 * Picks a page layout by theme. Motion Native has its own composition (bento overview,
 * analytics inspector, grouped forms); every other preset keeps the layout it was designed
 * with, so switching theme in the customizer changes the whole page, not only the colours.
 * Both elements are cheap descriptions; only the chosen one renders.
 */
export function LayoutSwitch({
  classic,
  native,
}: {
  classic: React.ReactNode;
  native: React.ReactNode;
}) {
  return useActivePreset() === NATIVE_LAYOUT_PRESET ? native : classic;
}

/**
 * Setup for the "classic" Vitest project: every theme facade renders the layout the
 * non-Motion-Native presets use, so the same suite checks both layouts.
 */
import { vi } from 'vitest';

vi.mock('@/components/wakaclock/layout-switch', () => ({
  LayoutSwitch: ({ classic }: { classic: React.ReactNode }) => classic,
  NATIVE_LAYOUT_PRESET: 'cinema',
}));

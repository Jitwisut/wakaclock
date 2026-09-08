'use client';

import { useSyncExternalStore } from 'react';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

import type { ThemeProviderProps } from 'next-themes';

const unsubscribe = () => {};
const subscribe = () => unsubscribe;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ThemeProvider({ scriptProps, ...props }: ThemeProviderProps) {
  const client = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);

  // Keep the executable bootstrap in server HTML and during hydration to avoid
  // a theme flash. On client navigation next-themes applies the theme in its
  // effect; its bootstrap must be an inert data block, not a new executable script.
  return (
    <NextThemesProvider
      {...props}
      scriptProps={{
        ...scriptProps,
        type: client ? 'application/x-next-themes-bootstrap' : scriptProps?.type,
      }}
    />
  );
}

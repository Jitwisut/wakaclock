'use client';

import * as React from 'react';

import Cookies from 'js-cookie';

import { DASHBOARD_PANELS_COOKIE, serializeHiddenPanels } from '@/lib/dashboard-panels';

export interface DashboardPanelsContextValue {
  /** Ids the viewer has hidden. */
  hidden: ReadonlySet<string>;
  /** True when the panel should render. */
  isVisible: (id: string) => boolean;
  /** Restores every panel. */
  reset: () => void;
  /** Shows or hides one panel and persists the change. */
  setVisible: (id: string, visible: boolean) => void;
}

const DashboardPanelsContext = React.createContext<DashboardPanelsContextValue | undefined>(
  undefined
);

/**
 * Panel visibility, persisted the same way the theme is: a cookie, so the server render
 * already knows what to draw and a hidden panel never flashes into view before hydration
 * removes it.
 */
export function DashboardPanelsProvider({
  children,
  initialHidden,
}: {
  children: React.ReactNode;
  initialHidden?: readonly string[];
}) {
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(
    () => new Set(initialHidden ?? [])
  );

  const persist = React.useCallback((next: ReadonlySet<string>) => {
    if (typeof window === 'undefined') return;

    const value = serializeHiddenPanels(next);

    if (value) {
      Cookies.set(DASHBOARD_PANELS_COOKIE, value, {
        path: '/',
        expires: 365,
        sameSite: 'Lax',
        secure: window.location.protocol === 'https:',
      });
    } else {
      Cookies.remove(DASHBOARD_PANELS_COOKIE, { path: '/' });
    }
  }, []);

  const setVisible = React.useCallback(
    (id: string, visible: boolean) => {
      setHidden((current) => {
        const next = new Set(current);

        if (visible) next.delete(id);
        else next.add(id);

        persist(next);
        return next;
      });
    },
    [persist]
  );

  const reset = React.useCallback(() => {
    setHidden(() => {
      const next = new Set<string>();
      persist(next);
      return next;
    });
  }, [persist]);

  const value = React.useMemo<DashboardPanelsContextValue>(
    () => ({
      hidden,
      isVisible: (id: string) => !hidden.has(id),
      reset,
      setVisible,
    }),
    [hidden, reset, setVisible]
  );

  return (
    <DashboardPanelsContext.Provider value={value}>{children}</DashboardPanelsContext.Provider>
  );
}

export function useDashboardPanels(): DashboardPanelsContextValue {
  const context = React.useContext(DashboardPanelsContext);

  if (context === undefined) {
    throw new Error('useDashboardPanels must be used within a DashboardPanelsProvider');
  }

  return context;
}

/**
 * Renders `children` only when the panel is switched on.
 *
 * A component rather than a bare hook call so a panel can be hidden from the page that
 * composes it, without every panel component having to know it is hideable.
 */
export function DashboardPanel({ children, id }: { children: React.ReactNode; id: string }) {
  const { isVisible } = useDashboardPanels();

  if (!isVisible(id)) return null;

  return children;
}

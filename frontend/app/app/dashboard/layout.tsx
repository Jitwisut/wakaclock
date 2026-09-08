import React from 'react';

import { cookies } from 'next/headers';
import NextTopLoader from 'nextjs-toploader';

import { ActiveThemeProvider } from '@/components/active-theme';
import { DashboardPanelsProvider } from '@/components/dashboard-panels';
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { DASHBOARD_PANELS_COOKIE, readHiddenPanels } from '@/lib/dashboard-panels';
import { fontVariables } from '@/lib/fonts';
import {
  DEFAULT_THEME,
  type ThemeContentLayout,
  type ThemePreset,
  type ThemeRadius,
  type ThemeScale,
} from '@/lib/themes';
import { cn } from '@/lib/utils';
import { WakaclockUserProvider } from '@/lib/wakaclock/user-store';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * Dashboard-only providers. Keeping these below /dashboard prevents cookies,
 * auth state, dashboard fonts and React Query from making public pages dynamic.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeSettings = {
    preset: (cookieStore.get('theme_preset')?.value ?? DEFAULT_THEME.preset) as ThemePreset,
    scale: (cookieStore.get('theme_scale')?.value ?? DEFAULT_THEME.scale) as ThemeScale,
    radius: (cookieStore.get('theme_radius')?.value ?? DEFAULT_THEME.radius) as ThemeRadius,
    contentLayout: (cookieStore.get('theme_content_layout')?.value ??
      DEFAULT_THEME.contentLayout) as ThemeContentLayout,
  };

  const hiddenPanels = readHiddenPanels(cookieStore.get(DASHBOARD_PANELS_COOKIE)?.value);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange enableSystem>
      {/*
        `fontVariables` has to sit on the same element as the theme attributes. A preset
        declares `--text-family: var(--font-space-mono), …`, and a var() whose variable is
        undefined at that element makes the whole declaration invalid, so the font silently
        falls back to the system stack. The `--font-*` variables come from these classes, so
        they must be defined here, not on a descendant.
      */}
      <ActiveThemeProvider className={fontVariables} initialTheme={themeSettings}>
        <QueryProvider>
          <WakaclockUserProvider>
            <DashboardPanelsProvider initialHidden={hiddenPanels}>
              {/*
              The `data-theme-*` attributes deliberately do NOT live here. They used to,
              rendered from the request cookie, which meant this element kept the theme the
              page was loaded with while `ActiveThemeProvider` moved the live one onto
              <body>. Both matched the `[data-theme-preset='…']` rules in themes.css, and
              this element is the deeper of the two, so its tokens won and switching a
              preset appeared to do nothing until a reload. The provider now owns the
              attributes on its own element, which does re-render.
            */}
              <div className={cn('bg-background min-h-screen font-sans')}>{children}</div>
            </DashboardPanelsProvider>
            <Toaster position="top-center" richColors />
          </WakaclockUserProvider>
        </QueryProvider>
        <NextTopLoader color="var(--primary)" height={2} shadow-sm="none" showSpinner={false} />
      </ActiveThemeProvider>
    </ThemeProvider>
  );
}

import type React from 'react';

import { cookies } from 'next/headers';

import { ActiveThemeProvider } from '@/components/active-theme';
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/lib/fonts';
import { RootDocument, SITE_METADATA } from '@/lib/seo/root-document';
import {
  DEFAULT_THEME,
  type ThemeContentLayout,
  type ThemePreset,
  type ThemeRadius,
  type ThemeScale,
} from '@/lib/themes';
import { WakaclockUserProvider } from '@/lib/wakaclock/user-store';

import type { Metadata } from 'next';

import './auth.css';
import '../globals.css';

/**
 * Sign-in and registration, deliberately outside `/dashboard`.
 *
 * They used to be the same screen: `RequireUser` rendered the credential form inside the
 * authenticated layout, so signing in happened underneath a sidebar and header for an app
 * the visitor could not use yet. These routes carry the dashboard's providers — theme,
 * React Query, the session store — and none of its chrome.
 *
 * That provider stack is deliberately a copy of `app/dashboard/layout.tsx` rather than a
 * shared component, because the two differ in what they wrap. Keep them in step: a
 * provider added to one and not the other is the same class of split-state bug that made
 * theme switching look broken (see the note in `components/active-theme.tsx`).
 */
export const metadata: Metadata = {
  ...SITE_METADATA,
  robots: { index: false, follow: false, nocache: true },
};
export { SITE_VIEWPORT as viewport } from '@/lib/seo/root-document';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({
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

  return (
    <RootDocument lang="en">
      <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange enableSystem>
        {/* fontVariables belongs on the same element as the theme attributes — a preset's
            `--text-family` references a `--font-*` variable and resolves to nothing if that
            variable is not defined where the declaration lives. */}
        <ActiveThemeProvider className={fontVariables} initialTheme={themeSettings}>
          <QueryProvider>
            <WakaclockUserProvider>
              <div className="wakaclock-auth bg-background text-foreground min-h-screen font-sans">
                {children}
              </div>
              <Toaster position="top-center" richColors />
            </WakaclockUserProvider>
          </QueryProvider>
        </ActiveThemeProvider>
      </ThemeProvider>
    </RootDocument>
  );
}

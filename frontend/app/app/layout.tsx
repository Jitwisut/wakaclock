import React from 'react';

import { cookies } from 'next/headers';
import { ThemeProvider } from 'next-themes';
import NextTopLoader from 'nextjs-toploader';

import { ActiveThemeProvider } from '@/components/active-theme';
import { QueryProvider } from '@/components/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/lib/fonts';
import GoogleAnalyticsInit from '@/lib/ga';
import {
  DEFAULT_THEME,
  type ThemeContentLayout,
  type ThemePreset,
  type ThemeRadius,
  type ThemeScale,
} from '@/lib/themes';
import { cn } from '@/lib/utils';
import { WakaclockUserProvider } from '@/lib/wakaclock/user-store';

import './globals.css';

export default async function RootLayout({
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

  const bodyAttributes = Object.fromEntries(
    Object.entries(themeSettings)
      .filter(([_, value]) => value)
      .map(([key, value]) => [
        `data-theme-${key.replaceAll(/([A-Z])/g, '-$1').toLowerCase()}`,
        value,
      ])
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn('bg-background group/layout font-sans', fontVariables)}
        suppressHydrationWarning
        {...bodyAttributes}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
          enableSystem
        >
          <ActiveThemeProvider initialTheme={themeSettings}>
            <QueryProvider>
              <WakaclockUserProvider>
                {children}
                <Toaster position="top-center" richColors />
              </WakaclockUserProvider>
            </QueryProvider>
            <NextTopLoader color="var(--primary)" height={2} shadow-sm="none" showSpinner={false} />
            {process.env.NODE_ENV === 'production' ? <GoogleAnalyticsInit /> : null}
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

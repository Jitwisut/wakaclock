import React from 'react';

import { cookies } from 'next/headers';

import { SiteHeader } from '@/components/layout/header';
import { AppSidebar } from '@/components/layout/sidebar/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen =
    cookieStore.get('sidebar_state')?.value === 'true' ||
    cookieStore.get('sidebar_state') === undefined;

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 64)',
          '--header-height': 'calc(var(--spacing) * 14)',
          '--content-padding': 'calc(var(--spacing) * 4)',
          '--content-margin': 'calc(var(--spacing) * 1.5)',
          '--content-full-height':
            'calc(100vh - var(--header-height) - (var(--content-padding) * 2) - (var(--content-margin) * 2))',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="bg-muted/50 flex flex-1 flex-col">
          <div className="@container/main p-[var(--content-padding)] xl:group-data-[theme-content-layout=centered]/layout:container xl:group-data-[theme-content-layout=centered]/layout:mx-auto">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

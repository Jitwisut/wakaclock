'use client';

import type * as React from 'react';

import { CinemaShell } from '@/components/layout/cinema/cinema-shell';
import { SiteHeader } from '@/components/layout/header';
import { AppSidebar } from '@/components/layout/sidebar/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { LayoutSwitch } from '@/components/wakaclock/layout-switch';

const CLASSIC_SHELL_STYLE = {
  '--sidebar-width': 'calc(var(--spacing) * 64)',
  '--header-height': 'calc(var(--spacing) * 14)',
  '--content-padding': 'calc(var(--spacing) * 4)',
  '--content-margin': 'calc(var(--spacing) * 1.5)',
  '--content-full-height':
    'calc(100vh - var(--header-height) - (var(--content-padding) * 2) - (var(--content-margin) * 2))',
} as React.CSSProperties;

/** The frame every preset except Cinema keeps: shadcn inset sidebar and site header. */
function ClassicShell({
  children,
  defaultOpen,
}: {
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  return (
    <SidebarProvider defaultOpen={defaultOpen} style={CLASSIC_SHELL_STYLE}>
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

/**
 * Theme facade for the dashboard frame: Cinema renders its rail-and-slate shell, every
 * other preset the classic sidebar shell. Both share the `sidebar_state` cookie, so the
 * collapsed/expanded choice survives a preset switch.
 */
export function DashboardShell({
  children,
  defaultOpen,
}: {
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  return (
    <LayoutSwitch
      classic={<ClassicShell defaultOpen={defaultOpen}>{children}</ClassicShell>}
      native={
        <SidebarProvider className="block" defaultOpen={defaultOpen}>
          <CinemaShell>{children}</CinemaShell>
        </SidebarProvider>
      }
    />
  );
}

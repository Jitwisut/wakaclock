'use client';

import * as React from 'react';

import { usePathname } from 'next/navigation';

import Logo from '@/components/layout/logo';
import { NavMain } from '@/components/layout/sidebar/nav-main';
import { NavUser } from '@/components/layout/sidebar/nav-user';
import { SidebarLevelBadge } from '@/components/layout/sidebar/sidebar-level-badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useIsTablet } from '@/hooks/use-mobile';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/** Labels for the AppSidebar component */
export type AppSidebarLabels = {
  /** Application name displayed in the header */
  appName?: string;
  /** Logo alt text */
  logoAlt?: string;
};

/**
 * AppSidebar component props
 *
 * @description Props for the main application sidebar.
 */
export type AppSidebarProps = {
  /** Customizable label strings */
  labels?: AppSidebarLabels;
  /**
   * Custom test ID for testing
   * @default 'app-sidebar'
   */
  testId?: string;
} & React.ComponentProps<typeof Sidebar>;

/**
 * AppSidebar component - Main application sidebar
 *
 * @description
 * The primary sidebar component containing project switching,
 * main navigation, download CTA, and user menu.
 *
 * ## Features
 * - **Project Switcher**: Dropdown for switching between projects
 * - **Main Navigation**: Hierarchical nav menu with collapsible groups
 * - **Download CTA**: Card promoting premium features
 * - **User Menu**: Account settings and logout
 * - **Responsive**: Auto-collapses on tablet, mobile drawer
 *
 * ## Use Cases
 * - Dashboard layouts
 * - Admin panels
 * - Multi-project applications
 *
 * ## Labels (i18n)
 * All text is customizable via the `labels` prop for internationalization.
 *
 * @example
 * ```tsx
 * <SidebarProvider>
 *   <AppSidebar labels={{ appName: 'My App' }} />
 *   <main>{children}</main>
 * </SidebarProvider>
 * ```
 *
 * @see Sidebar - Base sidebar component
 */
const AppSidebar = React.forwardRef<HTMLDivElement, AppSidebarProps>(function AppSidebar(
  { labels, testId = 'app-sidebar', ...props },
  ref
) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const logout = useWakaclockUserStore((store) => store.logout);
  const isTablet = useIsTablet();

  const appName = labels?.appName ?? 'AtoAxis';
  const logoAlt = labels?.logoAlt;

  React.useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  React.useEffect(() => {
    setOpen(!isTablet);
  }, [isTablet, setOpen]);

  return (
    <Sidebar collapsible="icon" data-slot="app-sidebar" data-testid={testId} ref={ref} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="hover:text-foreground h-10 cursor-default group-data-[collapsible=icon]:px-0! hover:bg-transparent"
              data-testid="app-sidebar-brand"
            >
              <Logo alt={logoAlt} />
              <span className="font-display text-foreground font-semibold">{appName}</span>
              <SidebarLevelBadge />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <NavMain />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <NavUser onLogout={logout} />
      </SidebarFooter>
    </Sidebar>
  );
});

AppSidebar.displayName = 'AppSidebar';

export { AppSidebar };

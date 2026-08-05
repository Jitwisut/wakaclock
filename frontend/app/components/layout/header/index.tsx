'use client';

import * as React from 'react';

import { PanelLeftIcon } from 'lucide-react';

import { Notifications, type NotificationsLabels } from '@/components/layout/header/notifications';
import { Search, type SearchLabels } from '@/components/layout/header/search';
import { ThemeSwitch } from '@/components/layout/header/theme-switch';
import { UserMenu } from '@/components/layout/header/user-menu';
import { ThemeCustomizerPanel } from '@/components/theme-customizer';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSidebar } from '@/components/ui/sidebar';
import { SubscriptionBadge } from '@/components/wakaclock/subscription-badge';
import { UserSwitcher } from '@/components/wakaclock/user-switcher';

/**
 * SiteHeader component props
 *
 * @description Props for the main application header.
 */
export interface SiteHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Labels for the notifications dropdown */
  notificationsLabels?: NotificationsLabels;
  /** Labels for the search component */
  searchLabels?: SearchLabels;
  /** Aria label for the sidebar toggle button */
  sidebarToggleAriaLabel?: string;
  /**
   * Custom test ID for testing
   * @default 'site-header'
   */
  testId?: string;
}

/**
 * SiteHeader component - Main application header with navigation controls
 *
 * @description
 * The primary header component containing sidebar toggle, search,
 * notifications, theme controls, and user menu.
 *
 * ## Features
 * - **Sidebar Toggle**: Expand/collapse sidebar button
 * - **Global Search**: Command palette (Ctrl/Cmd+K)
 * - **Notifications**: Dropdown with notification items
 * - **Theme Controls**: Theme switch and customizer panel
 * - **User Menu**: Account actions dropdown
 *
 * ## Accessibility
 * - Sticky positioning for persistent access
 * - Proper ARIA labels on all controls
 * - Keyboard navigable components
 *
 * @example
 * ```tsx
 * <SiteHeader
 *   searchLabels={{ inputPlaceholder: 'Search...' }}
 *   notificationsLabels={{ title: 'Alerts' }}
 * />
 * ```
 */
const SiteHeader = React.forwardRef<HTMLElement, SiteHeaderProps>(
  (
    {
      notificationsLabels,
      searchLabels,
      sidebarToggleAriaLabel,
      testId = 'site-header',
      className: _className,
      ...props
    },
    ref
  ) => {
    const { toggleSidebar } = useSidebar();

    return (
      <header
        className="bg-background/40 sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b backdrop-blur-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) md:rounded-tl-xl md:rounded-tr-xl"
        data-slot="site-header"
        data-testid={testId}
        ref={ref}
        {...props}
      >
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2">
          <Button
            aria-label={sidebarToggleAriaLabel ?? 'Toggle sidebar'}
            data-testid={`${testId}-sidebar-toggle`}
            onClick={toggleSidebar}
            size="icon"
            variant="ghost"
          >
            <PanelLeftIcon />
          </Button>
          <Separator className="mx-2 data-[orientation=vertical]:h-4" orientation="vertical" />
          <Search labels={searchLabels} />

          <div className="ml-auto flex items-center gap-2">
            <SubscriptionBadge />
            <UserSwitcher />
            <Separator className="mx-2 data-[orientation=vertical]:h-4" orientation="vertical" />
            <Notifications labels={notificationsLabels} />
            <ThemeSwitch />
            <ThemeCustomizerPanel />
            <Separator className="mx-2 data-[orientation=vertical]:h-4" orientation="vertical" />
            <UserMenu />
          </div>
        </div>
      </header>
    );
  }
);

SiteHeader.displayName = 'SiteHeader';

export { SiteHeader };

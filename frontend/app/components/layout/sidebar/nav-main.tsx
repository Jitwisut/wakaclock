'use client';

import * as React from 'react';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { LinkPending } from '@/components/link-pending';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useVisibleNavItems } from '@/hooks/use-visible-nav-items';

import { type NavGroup, navItems } from './nav-items';

// Existing imports of the navigation data from this module keep working.
export { type NavGroup, type NavItem, navItems } from './nav-items';

/** Labels for the NavMain component */
export type NavMainLabels = {
  /** Text for "coming soon" badge */
  comingBadge?: string;
  /** Screen-reader text announced while a clicked nav link is still loading */
  loading?: string;
  /** Text for "new" badge */
  newBadge?: string;
};

/**
 * NavMain component props
 *
 * @description Props for the main navigation component.
 */
export type NavMainProps = {
  /** Navigation groups to render */
  items?: NavGroup[];
  /** Customizable label strings */
  labels?: NavMainLabels;
  /**
   * Custom test ID for testing
   * @default 'nav-main'
   */
  testId?: string;
};

export function preserveAnalyticsQuery(pathname: string, queryString: string, href: string) {
  if (
    !pathname.startsWith('/dashboard/wakaclock/analytics') ||
    !href.startsWith('/dashboard/wakaclock/analytics')
  ) {
    return href;
  }
  const params = new URLSearchParams(queryString);
  const projectPrefix = '/dashboard/wakaclock/analytics/projects/';
  if (pathname.startsWith(projectPrefix) && !params.has('project_id')) {
    const projectId = pathname.slice(projectPrefix.length).split('/')[0];
    if (projectId) params.set('project_id', projectId);
  }
  const query = params.toString();
  return query ? `${href}?${query}` : href;
}

/**
 * NavMain component - Main sidebar navigation
 *
 * @description
 * Renders hierarchical navigation with collapsible groups, badges,
 * and icon support. Handles both expanded and icon-only collapsed states.
 *
 * ## Features
 * - **Collapsible Groups**: Multi-level navigation hierarchy
 * - **Badge Support**: New, Coming, and custom data badges
 * - **Icon Support**: Lucide icons for each nav item
 * - **Active State**: Highlights current route
 * - **Responsive**: Dropdown on collapsed, collapsible on expanded
 *
 * ## Use Cases
 * - Dashboard main navigation
 * - Admin panel menus
 * - Multi-section applications
 *
 * ## Navigation Structure
 * ```typescript
 * const items: NavGroup[] = [{
 *   title: 'Dashboards',
 *   items: [
 *     { title: 'Overview', href: '/dashboard', icon: HomeIcon },
 *     { title: 'Analytics', href: '/analytics', icon: ChartIcon, isNew: true },
 *   ]
 * }];
 * ```
 *
 * @example
 * ```tsx
 * <NavMain items={navItems} labels={{ newBadge: 'NEW' }} />
 * ```
 */
const NavMain = React.forwardRef<HTMLDivElement, NavMainProps>(function NavMain(
  { items = navItems, labels, testId = 'nav-main' },
  ref
) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile } = useSidebar();
  const analyticsHref = (href: string) =>
    preserveAnalyticsQuery(pathname, searchParams.toString(), href);
  const comingBadge = labels?.comingBadge ?? 'Coming';
  const newBadge = labels?.newBadge ?? 'New';
  const visibleGroups = useVisibleNavItems(items);

  return (
    <div data-slot="nav-main" data-testid={testId} ref={ref}>
      {visibleGroups.map((nav) => (
        <SidebarGroup key={nav.title}>
          <SidebarGroupLabel data-testid={nav.testId}>{nav.title}</SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {nav.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {Array.isArray(item.items) && item.items.length > 0 ? (
                    <>
                      <div className="hidden group-data-[collapsible=icon]:block">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuButton tooltip={item.title}>
                              {item.icon && <item.icon />}
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align={isMobile ? 'end' : 'start'}
                            className="min-w-48 rounded-lg"
                            side={isMobile ? 'bottom' : 'right'}
                          >
                            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                            {item.items?.map((subMenuItem) => (
                              <DropdownMenuItem
                                asChild
                                className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10!"
                                key={subMenuItem.title}
                              >
                                <a
                                  data-testid={subMenuItem.testId}
                                  href={analyticsHref(subMenuItem.href)}
                                >
                                  {subMenuItem.title}
                                </a>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <Collapsible
                        className="group/collapsible block group-data-[collapsible=icon]:hidden"
                        defaultOpen={item.items.some(
                          (s) => pathname === s.href || pathname.startsWith(`${s.href}/`)
                        )}
                      >
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                            data-testid={item.testId}
                            tooltip={item.title}
                          >
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item?.items?.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                  aria-current={
                                    pathname === subItem.href ||
                                    pathname.startsWith(`${subItem.href}/`)
                                      ? 'page'
                                      : undefined
                                  }
                                  asChild
                                  className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                                  data-testid={subItem.testId}
                                  isActive={
                                    pathname === subItem.href ||
                                    pathname.startsWith(`${subItem.href}/`)
                                  }
                                >
                                  <Link
                                    href={analyticsHref(subItem.href)}
                                    target={subItem.newTab ? '_blank' : ''}
                                  >
                                    <span>
                                      {subItem.title}
                                      <LinkPending label={labels?.loading ?? 'Loading page'} />
                                    </span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    </>
                  ) : (
                    <SidebarMenuButton
                      aria-current={pathname === item.href ? 'page' : undefined}
                      asChild
                      className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                      isActive={pathname === item.href}
                      tooltip={item.title}
                    >
                      <Link href={item.href} target={item.newTab ? '_blank' : ''}>
                        {item.icon && <item.icon />}
                        <span>
                          {item.title}
                          <LinkPending label={labels?.loading ?? 'Loading page'} />
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                  {!!item.isComing && (
                    <SidebarMenuBadge
                      className="peer-hover/menu-button:text-foreground opacity-50"
                      data-testid="nav-main-badge-coming"
                    >
                      {comingBadge}
                    </SidebarMenuBadge>
                  )}
                  {!!item.isNew && (
                    <SidebarMenuBadge
                      className="border border-green-400 text-green-600 peer-hover/menu-button:text-green-600"
                      data-testid="nav-main-badge-new"
                    >
                      {newBadge}
                    </SidebarMenuBadge>
                  )}
                  {!!item.isDataBadge && (
                    <SidebarMenuBadge
                      className="peer-hover/menu-button:text-foreground"
                      data-testid="nav-main-badge-data"
                    >
                      {item.isDataBadge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  );
});

NavMain.displayName = 'NavMain';

export { NavMain };

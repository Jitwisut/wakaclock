'use client';

import * as React from 'react';

import { PlusIcon } from '@radix-ui/react-icons';
import { ChevronsUpDown, ShoppingBagIcon, UserCircle2Icon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Logo from '@/components/layout/logo';
import { NavMain } from '@/components/layout/sidebar/nav-main';
import { NavUser } from '@/components/layout/sidebar/nav-user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

/** Labels for the AppSidebar component */
export type AppSidebarLabels = {
  /** Application name displayed in the header */
  appName?: string;
  /** Blog project name in project switcher */
  blogProjectName?: string;
  /** Blog project status text */
  blogProjectStatus?: string;
  /** Call-to-action button text */
  downloadCta?: string;
  /** Download card description text */
  downloadDescription?: string;
  /** Download card title text */
  downloadTitle?: string;
  /** E-commerce project name in project switcher */
  ecommerceProjectName?: string;
  /** E-commerce project status text */
  ecommerceProjectStatus?: string;
  /** Logo alt text */
  logoAlt?: string;
  /** New project button text */
  newProject?: string;
  /** Projects dropdown heading */
  projectsHeading?: string;
  /** Aria label for projects menu trigger */
  projectsMenuAriaLabel?: string;
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
  const isTablet = useIsTablet();

  const appName = labels?.appName ?? 'Shadcn UI Kit';
  const logoAlt = labels?.logoAlt;
  const projectsHeading = labels?.projectsHeading ?? 'Projects';
  const projectsMenuAriaLabel = labels?.projectsMenuAriaLabel;
  const ecommerceProjectName = labels?.ecommerceProjectName ?? 'E-commerce';
  const ecommerceProjectStatus = labels?.ecommerceProjectStatus ?? 'Active';
  const blogProjectName = labels?.blogProjectName ?? 'Blog Platform';
  const blogProjectStatus = labels?.blogProjectStatus ?? 'Inactive';
  const newProject = labels?.newProject ?? 'New Project';
  const downloadTitle = labels?.downloadTitle ?? 'Download';
  const downloadDescription =
    labels?.downloadDescription ??
    'Unlock lifetime access to all dashboards, templates and components.';
  const downloadCta = labels?.downloadCta ?? 'Get Shadcn UI Kit';

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  aria-label={projectsMenuAriaLabel}
                  className="hover:text-foreground h-10 group-data-[collapsible=icon]:px-0! hover:bg-[var(--primary)]/5"
                  data-testid="app-sidebar-project-switcher"
                >
                  <Logo alt={logoAlt} />
                  <span className="text-foreground font-semibold">{appName}</span>
                  <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="mt-4 w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                data-testid="app-sidebar-project-menu"
                side={isMobile ? 'bottom' : 'right'}
                sideOffset={4}
              >
                <DropdownMenuLabel>{projectsHeading}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-3"
                  data-testid="app-sidebar-project-ecommerce"
                >
                  <div className="flex size-8 items-center justify-center rounded-md border">
                    <ShoppingBagIcon className="text-muted-foreground size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{ecommerceProjectName}</span>
                    <span className="text-xs text-green-700">{ecommerceProjectStatus}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-3"
                  data-testid="app-sidebar-project-blog"
                >
                  <div className="flex size-8 items-center justify-center rounded-md border">
                    <UserCircle2Icon className="text-muted-foreground size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{blogProjectName}</span>
                    <span className="text-muted-foreground text-xs">{blogProjectStatus}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <Button className="w-full" data-testid="app-sidebar-new-project">
                  <PlusIcon />
                  {newProject}
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <NavMain />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <Card className="gap-4 overflow-hidden py-4 group-data-[collapsible=icon]:hidden">
          <CardHeader className="px-3">
            <CardTitle>{downloadTitle}</CardTitle>
            <CardDescription>{downloadDescription}</CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <Button asChild className="w-full">
              <Link href="https://shadcnuikit.com/pricing" target="_blank">
                {downloadCta}
              </Link>
            </Button>
          </CardContent>
        </Card>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
});

AppSidebar.displayName = 'AppSidebar';

export { AppSidebar };

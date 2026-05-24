'use client';

import * as React from 'react';

import {
  ActivityIcon,
  ArchiveRestoreIcon,
  BadgeDollarSignIcon,
  BookAIcon,
  BrainCircuitIcon,
  BrainIcon,
  BrushCleaningIcon,
  Building2Icon,
  CalendarIcon,
  ChartBarDecreasingIcon,
  ChartPieIcon,
  ChevronRight,
  ClipboardCheckIcon,
  ClipboardMinusIcon,
  ComponentIcon,
  CookieIcon,
  CreditCardIcon,
  FingerprintIcon,
  FolderDotIcon,
  FolderIcon,
  GaugeIcon,
  GithubIcon,
  GraduationCapIcon,
  ImagesIcon,
  KeyIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareHeartIcon,
  MessageSquareIcon,
  ProportionsIcon,
  PuzzleIcon,
  RedoDotIcon,
  SettingsIcon,
  ShoppingBagIcon,
  SpeechIcon,
  SquareCheckIcon,
  SquareKanbanIcon,
  StickyNoteIcon,
  UserIcon,
  UsersIcon,
  WalletMinimalIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

/** Navigation group containing a title and list of navigation items */
export type NavGroup = {
  /** Navigation items in this group */
  items: NavItem;
  /** Test ID for the group */
  testId?: string;
  /** Group title displayed as section header */
  title: string;
};

/** Array of navigation item objects */
export type NavItem = {
  /** Navigation link URL */
  href: string;
  /** Lucide icon component */
  icon?: LucideIcon;
  /** Shows "Coming" badge when true */
  isComing?: boolean;
  /** Custom badge text to display */
  isDataBadge?: string;
  /** Shows "New" badge when true */
  isNew?: boolean;
  /** Nested navigation items for collapsible menus */
  items?: NavItem;
  /** Opens link in new tab when true */
  newTab?: boolean;
  /** Test ID for the item */
  testId?: string;
  /** Display title for the navigation item */
  title: string;
}[];

/** Labels for the NavMain component */
export type NavMainLabels = {
  /** Text for "coming soon" badge */
  comingBadge?: string;
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

export const navItems: NavGroup[] = [
  {
    testId: 'nav-main-group-dashboards',
    title: 'Dashboards',
    items: [
      {
        title: 'Classic Dashboard',
        href: '/dashboard/default',
        icon: ChartPieIcon,
      },
      {
        testId: 'nav-main-item-ecommerce',
        title: 'E-commerce',
        href: '#',
        icon: ShoppingBagIcon,
        items: [
          { title: 'Dashboard', href: '/dashboard/ecommerce' },
          {
            testId: 'nav-main-subitem-product-list',
            title: 'Product List',
            href: '/dashboard/pages/products',
          },
          { title: 'Product Detail', href: '/dashboard/pages/products/1' },
          { title: 'Add Product', href: '/dashboard/pages/products/create' },
          {
            testId: 'nav-main-subitem-order-list',
            title: 'Order List',
            href: '/dashboard/pages/orders',
          },
          { title: 'Order Detail', href: '/dashboard/pages/orders/detail' },
        ],
      },
      {
        title: 'Payment Dashboard',
        href: '/dashboard/payment',
        icon: CreditCardIcon,
        items: [
          { title: 'Dashboard', href: '/dashboard/payment' },
          { title: 'Transactions', href: '/dashboard/payment/transactions' },
        ],
      },
      {
        title: 'Hotel Dashboard',
        href: '/dashboard/hotel',
        icon: Building2Icon,
        items: [
          { title: 'Dashboard', href: '/dashboard/hotel' },
          { title: 'Bookings', href: '/dashboard/hotel/bookings' },
        ],
      },
      {
        title: 'Project Management',
        href: '/dashboard/project-management',
        icon: FolderDotIcon,
        items: [
          { title: 'Dashboard', href: '/dashboard/project-management' },
          { title: 'Project List', href: '/dashboard/project-list' },
        ],
      },
      { title: 'Sales', href: '/dashboard/sales', icon: BadgeDollarSignIcon },
      { title: 'CRM', href: '/dashboard/crm', icon: ChartBarDecreasingIcon },
      {
        title: 'Website Analytics',
        href: '/dashboard/website-analytics',
        icon: GaugeIcon,
      },
      {
        title: 'File Manager',
        href: '/dashboard/file-manager',
        icon: FolderIcon,
      },
      { title: 'Crypto', href: '/dashboard/crypto', icon: WalletMinimalIcon },
      { title: 'Academy/School', href: '/dashboard/academy', icon: GraduationCapIcon },
      { title: 'Hospital Management', href: '/dashboard/hospital-management', icon: ActivityIcon },
      {
        title: 'Finance Dashboard',
        href: '/dashboard/finance',
        icon: WalletMinimalIcon,
      },
    ],
  },
  {
    title: 'Apps',
    items: [
      {
        title: 'Kanban',
        href: '/dashboard/apps/kanban',
        icon: SquareKanbanIcon,
      },
      { title: 'Notes', href: '/dashboard/apps/notes', icon: StickyNoteIcon, isDataBadge: '8' },
      { title: 'Chats', href: '/dashboard/apps/chat', icon: MessageSquareIcon, isDataBadge: '5' },
      {
        title: 'Social Media',
        href: '/dashboard/apps/social-media',
        icon: MessageSquareHeartIcon,
        isNew: true,
      },
      { title: 'Mail', href: '/dashboard/apps/mail', icon: MailIcon },
      {
        title: 'Todo List App',
        href: '/dashboard/apps/todo-list-app',
        icon: SquareCheckIcon,
      },
      {
        title: 'Tasks',
        href: '/dashboard/apps/tasks',
        icon: ClipboardCheckIcon,
      },
      { title: 'Calendar', href: '/dashboard/apps/calendar', icon: CalendarIcon },
      {
        title: 'File Manager',
        href: '/dashboard/apps/file-manager',
        icon: ArchiveRestoreIcon,
        isNew: true,
      },
      { title: 'Api Keys', href: '/dashboard/apps/api-keys', icon: KeyIcon },
      { title: 'POS App', href: '/dashboard/apps/pos-system', icon: CookieIcon },
      { title: 'Courses', href: '/dashboard/apps/courses', icon: BookAIcon, isComing: true },
    ],
  },
  {
    title: 'AI Apps',
    items: [
      { title: 'AI Chat', href: '/dashboard/apps/ai-chat', icon: BrainIcon },
      {
        title: 'AI Chat V2',
        href: '/dashboard/apps/ai-chat-v2',
        icon: BrainCircuitIcon,
        isNew: true,
      },
      {
        title: 'Image Generator',
        href: '/dashboard/apps/ai-image-generator',
        icon: ImagesIcon,
      },
      {
        title: 'Text to Speech',
        href: '/dashboard/apps/text-to-speech',
        icon: SpeechIcon,
        isComing: true,
      },
    ],
  },
  {
    title: 'Pages',
    items: [
      {
        title: 'Users List',
        href: '/dashboard/pages/users',
        icon: UsersIcon,
      },
      {
        title: 'Profile',
        href: '/dashboard/pages/profile',
        icon: UserIcon,
      },
      {
        title: 'Profile V2',
        href: '/dashboard/pages/user-profile',
        icon: UserIcon,
      },
      {
        title: 'Onboarding Flow',
        href: '/dashboard/pages/onboarding-flow',
        icon: RedoDotIcon,
      },
      {
        title: 'Empty States',
        href: '/dashboard/pages/empty-states/01',
        icon: BrushCleaningIcon,
        items: [
          { title: 'Empty States 01', href: '/dashboard/pages/empty-states/01' },
          { title: 'Empty States 02', href: '/dashboard/pages/empty-states/02' },
          { title: 'Empty States 03', href: '/dashboard/pages/empty-states/03' },
        ],
      },
      {
        title: 'Settings',
        href: '/dashboard/pages/settings',
        icon: SettingsIcon,
        items: [
          { title: 'Profile', href: '/dashboard/pages/settings' },
          { title: 'Account', href: '/dashboard/pages/settings/account' },
          { title: 'Billing', href: '/dashboard/pages/settings/billing' },
          { title: 'Appearance', href: '/dashboard/pages/settings/appearance' },
          { title: 'Notifications', href: '/dashboard/pages/settings/notifications' },
          { title: 'Display', href: '/dashboard/pages/settings/display' },
        ],
      },
      {
        title: 'Pricing',
        href: '#',
        icon: BadgeDollarSignIcon,
        items: [
          { title: 'Column Pricing', href: '/dashboard/pages/pricing/column' },
          { title: 'Table Pricing', href: '/dashboard/pages/pricing/table' },
          { title: 'Single Pricing', href: '/dashboard/pages/pricing/single' },
        ],
      },
      {
        title: 'Authentication',
        href: '/',
        icon: FingerprintIcon,
        items: [
          { title: 'Login v1', href: '/dashboard/login/v1' },
          { title: 'Login v2', href: '/dashboard/login/v2' },
          { title: 'Register v1', href: '/dashboard/register/v1' },
          { title: 'Register v2', href: '/dashboard/register/v2' },
          { title: 'Forgot Password', href: '/dashboard/forgot-password' },
        ],
      },
      {
        title: 'Error Pages',
        href: '/',
        icon: FingerprintIcon,
        items: [
          { title: '404', href: '/dashboard/pages/error/404' },
          { title: '500', href: '/dashboard/pages/error/500' },
          { title: '403', href: '/dashboard/pages/error/403' },
        ],
      },
    ],
  },
  {
    title: 'Others',
    items: [
      {
        title: 'Widgets',
        href: '#',
        icon: PuzzleIcon,
        items: [
          { title: 'Fitness', href: '/dashboard/widgets/fitness' },
          { title: 'E-commerce', href: '/dashboard/widgets/ecommerce' },
          { title: 'Analytics', href: '/dashboard/widgets/analytics' },
        ],
      },
      {
        title: 'Download Shadcn UI Kit',
        href: '/pricing',
        icon: ClipboardMinusIcon,
        newTab: true,
      },
      {
        title: 'Components',
        href: '/components',
        icon: ComponentIcon,
        newTab: true,
      },
      {
        title: 'Blocks',
        href: '/blocks',
        icon: ComponentIcon,
        newTab: true,
      },
      {
        title: 'Templates',
        href: '/templates',
        icon: ProportionsIcon,
        newTab: true,
      },
      {
        title: 'Github',
        href: 'https://github.com/bundui',
        icon: GithubIcon,
        newTab: true,
      },
    ],
  },
];

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
  const { isMobile } = useSidebar();
  const comingBadge = labels?.comingBadge ?? 'Coming';
  const newBadge = labels?.newBadge ?? 'New';

  return (
    <div data-slot="nav-main" data-testid={testId} ref={ref}>
      {items.map((nav) => (
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
                                <a data-testid={subMenuItem.testId} href={subMenuItem.href}>
                                  {subMenuItem.title}
                                </a>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <Collapsible
                        className="group/collapsible block group-data-[collapsible=icon]:hidden"
                        defaultOpen={item.items.some((s) => s.href === pathname)}
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
                                  aria-current={pathname === subItem.href ? 'page' : undefined}
                                  asChild
                                  className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                                  data-testid={subItem.testId}
                                  isActive={pathname === subItem.href}
                                >
                                  <Link href={subItem.href} target={subItem.newTab ? '_blank' : ''}>
                                    <span>{subItem.title}</span>
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
                        <span>{item.title}</span>
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

'use client';

import * as React from 'react';

import { DotsVerticalIcon } from '@radix-ui/react-icons';
import { BellIcon, CreditCardIcon, LogOutIcon, UserCircle2Icon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const userData = {
  name: 'Toby Belhome',
  email: 'hello@tobybelhome.com',
  avatar: '/images/avatars/01.png',
};

/** Labels for the NavUser component */
export type NavUserLabels = {
  /** Account menu item text */
  account?: string;
  /** Billing menu item text */
  billing?: string;
  /** Log out menu item text */
  logOut?: string;
  /** Notifications menu item text */
  notifications?: string;
  /** Aria label for the user menu trigger */
  triggerAriaLabel?: string;
};

/**
 * NavUser component props
 *
 * @description Props for the user menu component.
 */
export type NavUserProps = {
  /** Customizable label strings */
  labels?: NavUserLabels;
  /** Ends the active application session when the user chooses Log out. */
  onLogout?: () => void;
  /**
   * Custom test ID for testing
   * @default 'nav-user'
   */
  testId?: string;
};

/**
 * NavUser component - User menu in sidebar footer
 *
 * @description
 * Displays user avatar, name, and email with a dropdown menu
 * for account-related actions.
 *
 * ## Features
 * - **User Avatar**: Profile picture with fallback initials
 * - **User Info**: Name and email display
 * - **Dropdown Menu**: Account, billing, notifications, logout
 * - **Responsive**: Adapts to sidebar collapsed state
 *
 * ## Use Cases
 * - Sidebar user profile section
 * - Quick access to account settings
 * - Logout functionality
 *
 * ## Labels (i18n)
 * All menu labels customizable via `labels` prop.
 *
 * @example
 * ```tsx
 * <NavUser labels={{
 *   account: 'My Account',
 *   logOut: 'Sign Out'
 * }} />
 * ```
 */
const NavUser = React.forwardRef<HTMLUListElement, NavUserProps>(function NavUser(
  { labels, onLogout, testId = 'nav-user' },
  ref
) {
  const { isMobile, state } = useSidebar();

  const triggerAriaLabel = labels?.triggerAriaLabel ?? 'User menu';
  const accountLabel = labels?.account ?? 'Account';
  const billingLabel = labels?.billing ?? 'Billing';
  const notificationsLabel = labels?.notifications ?? 'Notifications';
  const logOutLabel = labels?.logOut ?? 'Log out';

  return (
    <SidebarMenu data-slot="nav-user" data-testid={testId} ref={ref}>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label={state === 'collapsed' ? triggerAriaLabel : undefined}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              data-testid="nav-user-trigger"
              size="lg"
            >
              <Avatar className="rounded-full">
                <AvatarImage alt={userData.name} src={userData.avatar} />
                <AvatarFallback className="rounded-lg">JS</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userData.name}</span>
                <span className="text-muted-foreground truncate text-xs">{userData.email}</span>
              </div>
              <DotsVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            data-testid="nav-user-menu"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage alt={userData.name} src={userData.avatar} />
                  <AvatarFallback className="rounded-lg">TB</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{userData.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{userData.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem data-testid="nav-user-item-account">
                <UserCircle2Icon />
                {accountLabel}
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="nav-user-item-billing">
                <CreditCardIcon />
                {billingLabel}
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="nav-user-item-notifications">
                <BellIcon />
                {notificationsLabel}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="nav-user-item-logout" onSelect={onLogout}>
              <LogOutIcon />
              {logOutLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
});

NavUser.displayName = 'NavUser';

export { NavUser };

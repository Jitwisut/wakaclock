'use client';

import * as React from 'react';

import { BadgeCheck, Bell, ChevronRightIcon, CreditCard, LogOut, Sparkles } from 'lucide-react';
import Link from 'next/link';

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
import { Progress } from '@/components/ui/progress';

/**
 * Labels for the UserMenu component
 */
export interface UserMenuLabels {
  account?: string;
  avatarAlt?: string;
  billing?: string;
  creditsHelper?: string;
  creditsRemaining?: string;
  creditsTitle?: string;
  logOut?: string;
  notifications?: string;
  triggerAriaLabel?: string;
  upgradeToPro?: string;
}

/**
 * UserMenu component props
 *
 * @description Props for the user account dropdown menu.
 */
export interface UserMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Customizable labels for internationalization */
  labels?: UserMenuLabels;
  /**
   * Custom test ID for testing
   * @default 'header-user-menu'
   */
  testId?: string;
}

/**
 * UserMenu component - Dropdown menu for user account actions
 *
 * @description
 * A comprehensive user menu dropdown with account actions,
 * upgrade prompts, and usage credits display.
 *
 * ## Features
 * - **User Profile**: Avatar, name, email display
 * - **Account Actions**: Account, billing, notifications links
 * - **Upgrade Prompt**: Pro plan upgrade link
 * - **Credits Display**: Usage progress bar
 * - **Log Out**: Session termination action
 *
 * ## Accessibility
 * - Avatar acts as button with `aria-haspopup="menu"`
 * - Keyboard navigable menu items
 * - Focus management on open/close
 *
 * @example
 * ```tsx
 * <UserMenu labels={{ logOut: 'Sign out', account: 'Profile' }} />
 * ```
 */
const UserMenu = React.forwardRef<HTMLDivElement, UserMenuProps>(
  ({ labels, testId = 'header-user-menu', ...props }, ref) => {
    const triggerAriaLabel = labels?.triggerAriaLabel ?? 'User menu';
    const avatarAlt = labels?.avatarAlt ?? 'User avatar';
    const upgradeToPro = labels?.upgradeToPro ?? 'Upgrade to Pro';
    const account = labels?.account ?? 'Account';
    const billing = labels?.billing ?? 'Billing';
    const notifications = labels?.notifications ?? 'Notifications';
    const logOut = labels?.logOut ?? 'Log out';
    const creditsTitle = labels?.creditsTitle ?? 'Credits';
    const creditsRemaining = labels?.creditsRemaining ?? '5 left';
    const creditsHelper = labels?.creditsHelper ?? 'Daily credits used first';

    return (
      <div data-slot="user-menu" data-testid={testId} ref={ref} {...props}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar
              aria-haspopup="menu"
              aria-label={triggerAriaLabel}
              data-testid={`${testId}-trigger`}
              role="button"
              tabIndex={0}
            >
              <AvatarImage alt={avatarAlt} src="/images/avatars/01.png" />
              <AvatarFallback className="rounded-lg">TB</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
            data-testid={`${testId}-content`}
          >
            <DropdownMenuLabel className="p-0">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar>
                  <AvatarImage alt={avatarAlt} src="/images/avatars/01.png" />
                  <AvatarFallback className="rounded-lg">TB</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Toby Belhome</span>
                  <span className="text-muted-foreground truncate text-xs">
                    hello@tobybelhome.com
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link
                  data-testid={`${testId}-upgrade`}
                  href="https://shadcnuikit.com/pricing"
                  target="_blank"
                >
                  <Sparkles /> {upgradeToPro}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuItem data-testid={`${testId}-account`}>
                <BadgeCheck />
                {account}
              </DropdownMenuItem>
              <DropdownMenuItem data-testid={`${testId}-billing`}>
                <CreditCard />
                {billing}
              </DropdownMenuItem>
              <DropdownMenuItem data-testid={`${testId}-notifications`}>
                <Bell />
                {notifications}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid={`${testId}-logout`}>
              <LogOut />
              {logOut}
            </DropdownMenuItem>
            <div className="bg-muted mt-1.5 rounded-md border" data-testid={`${testId}-credits`}>
              <div className="space-y-3 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium" data-testid={`${testId}-credits-title`}>
                    {creditsTitle}
                  </h4>
                  <div className="text-muted-foreground flex cursor-pointer items-center text-sm">
                    <span data-testid={`${testId}-credits-remaining`}>{creditsRemaining}</span>
                    <ChevronRightIcon className="ml-1 h-4 w-4" />
                  </div>
                </div>
                <Progress
                  data-testid={`${testId}-credits-progress`}
                  indicatorColor="bg-primary"
                  value={40}
                />
                <div
                  className="text-muted-foreground flex items-center text-sm"
                  data-testid={`${testId}-credits-helper`}
                >
                  {creditsHelper}
                </div>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

UserMenu.displayName = 'UserMenu';

export { UserMenu };
export default UserMenu;

'use client';

import * as React from 'react';

import { BellIcon, ClockIcon } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';

import { type NotificationData, notifications } from './data';

const unreadCount = notifications.filter((n) => n.unread_message).length;

/**
 * Labels for the Notifications component
 */
export interface NotificationsLabels {
  accept?: string;
  decline?: string;
  title?: string;
  viewAll?: string;
}

/**
 * Notifications component props
 *
 * @description Props for the notifications dropdown.
 */
export interface NotificationsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Customizable labels for internationalization */
  labels?: NotificationsLabels;
  /**
   * Custom test ID for testing
   * @default 'header-notifications'
   */
  testId?: string;
}

/**
 * Notifications component - Dropdown menu displaying user notifications
 *
 * @description
 * A dropdown menu showing user notifications with unread indicators,
 * scrollable list, and action buttons for confirmation-type notifications.
 *
 * ## Features
 * - **Unread Badge**: Visual indicator on trigger button
 * - **Scrollable List**: ScrollArea for many notifications
 * - **Confirmation Actions**: Accept/Decline buttons
 * - **Time Stamps**: Relative time display
 * - **i18n Ready**: All labels customizable
 *
 * ## Accessibility
 * - `aria-live="polite"` on scroll area
 * - Unread count in aria-label
 * - Keyboard navigable items
 *
 * @example
 * ```tsx
 * <Notifications labels={{ title: 'Alerts', viewAll: 'See all' }} />
 * ```
 */
const Notifications = React.forwardRef<HTMLDivElement, NotificationsProps>(
  ({ labels, testId = 'header-notifications', ...props }, ref) => {
    const isMobile = useIsMobile();
    const title = labels?.title ?? 'Notifications';
    const viewAll = labels?.viewAll ?? 'View all';
    const accept = labels?.accept ?? 'Accept';
    const decline = labels?.decline ?? 'Decline';

    return (
      <div data-slot="notifications" data-testid={testId} ref={ref} {...props}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`${title} (${unreadCount} unread)`}
              className="relative"
              data-testid={`${testId}-trigger`}
              size="icon"
              variant="ghost"
            >
              <>
                <BellIcon className="animate-tada" />
                <span className="bg-destructive absolute end-0 top-0 block size-2 shrink-0 rounded-full" />
              </>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align={isMobile ? 'center' : 'end'}
            className="ms-4 w-80 p-0"
            data-testid={`${testId}-content`}
          >
            <DropdownMenuLabel className="bg-background dark:bg-muted sticky top-0 z-10 p-0">
              <div className="flex justify-between border-b px-6 py-4">
                <div className="font-medium" data-testid={`${testId}-title`}>
                  {title}
                </div>
                <Button asChild className="h-auto p-0 text-xs" size="sm" variant="link">
                  <Link data-testid={`${testId}-view-all`} href="#">
                    {viewAll}
                  </Link>
                </Button>
              </div>
            </DropdownMenuLabel>

            <ScrollArea aria-live="polite" className="h-[350px]">
              {notifications.map((item: NotificationData) => (
                <DropdownMenuItem
                  className="group flex cursor-pointer items-start gap-9 rounded-none border-b px-4 py-3"
                  data-testid={`${testId}-item-${item.id}`}
                  key={item.id}
                >
                  <div className="flex flex-1 items-start gap-2">
                    <div className="flex-none">
                      <Avatar className="size-8">
                        <AvatarImage src={`/images/avatars/${item.avatar}`} />
                        <AvatarFallback> {item.title.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="dark:group-hover:text-default-800 truncate text-sm font-medium">
                        {item.title}
                      </div>
                      <div className="dark:group-hover:text-default-700 text-muted-foreground line-clamp-1 text-xs">
                        {item.desc}
                      </div>
                      {item.type === 'confirm' && (
                        <div className="flex items-center gap-2">
                          <Button
                            data-testid={`${testId}-accept-${item.id}`}
                            size="sm"
                            variant="outline"
                          >
                            {accept}
                          </Button>
                          <Button
                            data-testid={`${testId}-decline-${item.id}`}
                            size="sm"
                            variant="destructive"
                          >
                            {decline}
                          </Button>
                        </div>
                      )}
                      <div className="dark:group-hover:text-default-500 text-muted-foreground flex items-center gap-1 text-xs">
                        <ClockIcon className="size-3!" />
                        {item.date}
                      </div>
                    </div>
                  </div>
                  {item.unread_message && (
                    <div className="flex-0">
                      <span
                        className="bg-destructive/80 block size-2 rounded-full border"
                        data-testid={`${testId}-unread-${item.id}`}
                      />
                    </div>
                  )}
                </DropdownMenuItem>
              ))}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

Notifications.displayName = 'Notifications';

export { Notifications };
export default Notifications;

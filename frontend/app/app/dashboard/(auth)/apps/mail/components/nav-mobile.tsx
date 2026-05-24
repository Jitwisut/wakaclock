'use client';

import { HamburgerMenuIcon } from '@radix-ui/react-icons';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  MessagesSquare,
  Send,
  ShoppingCart,
  Trash2,
  Users2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { accounts } from '../data';

import { AccountSwitcher } from './account-switcher';
import { Nav } from './nav';

export function NavMobile() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost">
          <HamburgerMenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-auto [&>button:first-of-type]:hidden" side="left">
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle>Navigation</DialogTitle>
          </DialogHeader>
        </VisuallyHidden>

        <div className="flex h-[52px] items-center justify-center px-2">
          <AccountSwitcher accounts={accounts} isCollapsed={false} />
        </div>

        <Separator />

        <Nav
          isCollapsed={false}
          links={[
            {
              title: 'Inbox',
              label: '128',
              icon: Inbox,
              variant: 'default',
            },
            {
              title: 'Drafts',
              label: '9',
              icon: File,
              variant: 'ghost',
            },
            {
              title: 'Sent',
              label: '',
              icon: Send,
              variant: 'ghost',
            },
            {
              title: 'Junk',
              label: '23',
              icon: ArchiveX,
              variant: 'ghost',
            },
            {
              title: 'Trash',
              label: '',
              icon: Trash2,
              variant: 'ghost',
            },
            {
              title: 'Archive',
              label: '',
              icon: Archive,
              variant: 'ghost',
            },
          ]}
        />

        <Separator />

        <Nav
          isCollapsed={false}
          links={[
            {
              title: 'Social',
              label: '972',
              icon: Users2,
              dot: <span className="me-2 size-3.5 rounded-full bg-indigo-400 dark:bg-indigo-700" />,
              variant: 'ghost',
            },
            {
              title: 'Updates',
              label: '342',
              icon: AlertCircle,
              dot: <span className="me-2 size-3.5 rounded-full bg-teal-400 dark:bg-teal-700" />,
              variant: 'ghost',
            },
            {
              title: 'Forums',
              label: '128',
              icon: MessagesSquare,
              dot: <span className="me-2 size-3.5 rounded-full bg-orange-400 dark:bg-orange-700" />,
              variant: 'ghost',
            },
            {
              title: 'Shopping',
              label: '8',
              icon: ShoppingCart,
              dot: <span className="me-2 size-3.5 rounded-full bg-lime-400 dark:bg-lime-700" />,
              variant: 'ghost',
            },
            {
              title: 'Promotions',
              label: '21',
              icon: Archive,
              dot: <span className="me-2 size-3.5 rounded-full bg-pink-400 dark:bg-pink-700" />,
              variant: 'ghost',
            },
          ]}
        />
      </SheetContent>
    </Sheet>
  );
}

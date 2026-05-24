'use client';

import {
  BellIcon,
  ContrastIcon,
  CreditCardIcon,
  PaletteIcon,
  ShieldIcon,
  UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const sidebarNavItems = [
  {
    title: 'Profile',
    href: '/dashboard/pages/settings',
    icon: UserIcon,
  },
  {
    title: 'Account',
    href: '/dashboard/pages/settings/account',
    icon: ShieldIcon,
  },
  {
    title: 'Billing',
    href: '/dashboard/pages/settings/billing',
    icon: CreditCardIcon,
  },
  {
    title: 'Appearance',
    href: '/dashboard/pages/settings/appearance',
    icon: PaletteIcon,
  },
  {
    title: 'Notifications',
    href: '/dashboard/pages/settings/notifications',
    icon: BellIcon,
  },
  {
    title: 'Display',
    href: '/dashboard/pages/settings/display',
    icon: ContrastIcon,
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <Card className="py-0">
      <CardContent className="p-2">
        <nav className="flex flex-col space-y-0.5 space-x-2 lg:space-x-0">
          {sidebarNavItems.map((item) => (
            <Button
              asChild
              className={cn(
                'hover:bg-muted justify-start',
                pathname === item.href ? 'bg-muted hover:bg-muted' : ''
              )}
              key={item.href}
              variant="ghost"
            >
              <Link href={item.href}>
                {item.icon && <item.icon />}
                {item.title}
              </Link>
            </Button>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}

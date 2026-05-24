'use client';

import React, { useState } from 'react';

import {
  AlertTriangle,
  CreditCard,
  Globe,
  HelpCircle,
  Home,
  ListTodo,
  MenuIcon,
  Search,
  Settings,
  SettingsIcon,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

import { CreatePostDialog } from './create-post-dialog';

interface NavItem {
  active?: boolean;
  badge?: number;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { icon: <Home />, label: 'Home', badge: 10, active: true },
  { icon: <ListTodo />, label: 'Tasks' },
  { icon: <Users />, label: 'Users', badge: 2 },
  { icon: <Globe />, label: 'APIs' },
  { icon: <CreditCard />, label: 'Subscription' },
  { icon: <Settings />, label: 'Settings' },
  { icon: <HelpCircle />, label: 'Help & Support' },
];

function SidebarContent() {
  return (
    <>
      <div className="relative mb-4 lg:mb-6">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input className="pl-9" placeholder="Search..." />
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Button
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
              item.active
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            key={item.label}
            variant="ghost"
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <Badge
                className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs"
                variant="secondary"
              >
                {item.badge}
              </Badge>
            )}
          </Button>
        ))}
      </nav>
    </>
  );
}

export function SocialMediaSidebar() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Card className="bg-muted flex-1 py-4">
        <CardHeader className="flex items-center gap-3 px-4">
          <Avatar>
            <AvatarImage src="https://i.pravatar.cc/150?img=19" />
            <AvatarFallback>TB</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm">Toby Belhome</div>
            <div className="text-muted-foreground text-xs">@toby</div>
          </div>
          <div className="ms-auto flex">
            <Button size="icon" variant="ghost">
              <SettingsIcon />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost">
                  <MenuIcon />
                </Button>
              </SheetTrigger>
              <SheetContent className="p-4">
                <div className="flex-1">
                  <SidebarContent />
                </div>
                <ProBanner />
                <CreatePostDialog />
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <aside className="flex flex-col gap-4">
      <Card className="bg-muted flex-1">
        <CardHeader className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src="https://i.pravatar.cc/150?img=19" />
            <AvatarFallback>TB</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm">Toby Belhome</div>
            <div className="text-muted-foreground text-xs">@toby</div>
          </div>
          <Button className="ms-auto" size="icon" variant="ghost">
            <SettingsIcon />
          </Button>
        </CardHeader>

        <CardContent>
          <SidebarContent />
          <CreatePostDialog />
        </CardContent>
      </Card>

      <ProBanner />
    </aside>
  );
}

const ProBanner = () => {
  const [showProBanner, setShowProBanner] = useState(true);
  return (
    showProBanner && (
      <Card className="bg-muted relative">
        <Button
          className="text-muted-foreground hover:text-foreground absolute top-2 right-2"
          onClick={() => setShowProBanner(false)}
          size="sm"
          variant="ghost"
        >
          <X />
        </Button>
        <CardContent>
          <div className="bg-background mb-3 flex size-8 items-center justify-center rounded-lg border">
            <AlertTriangle className="size-4" />
          </div>
          <p className="text-muted-foreground mb-3 text-sm">
            Enjoy unlimited access to our template by paying just a small fee.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost">
              Dismiss
            </Button>
            <Button asChild size="sm">
              <Link href="https://shadcnuikit.com/pricing" target="_blank">
                Go Pro
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  );
};

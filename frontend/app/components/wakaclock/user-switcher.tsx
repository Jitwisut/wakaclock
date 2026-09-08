'use client';

import { LogOutIcon, UserRoundIcon } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

function initialsOf(username: string) {
  return username.slice(0, 2).toUpperCase();
}

/**
 * Header identity widget. Purely a display + logout affordance — the actual login and
 * register forms live on their own routes at /login and /register, which RequireUser
 * redirects to, so there's nothing else for this component to do when logged out.
 */
export function UserSwitcher() {
  const username = useWakaclockUserStore((s) => s.username);
  const logout = useWakaclockUserStore((s) => s.logout);

  if (!username) {
    return (
      <Button className="gap-1.5" disabled size="sm" variant="outline">
        <UserRoundIcon className="size-3.5" />
        Not logged in
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-9 gap-2 px-1.5 sm:pr-2 sm:pl-1.5" size="sm" variant="outline">
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">{initialsOf(username)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm sm:inline">{username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Logged in as {username}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => logout()}>
          <LogOutIcon className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Organization } from '@/lib/wakaclock/measurement-types';

/** The current organization at the top of the section list; opens a switcher. */
export function TeamOrgSwitcher({
  current,
  onCreate,
  onSelect,
  organizations,
}: {
  current: Organization;
  onCreate: () => void;
  onSelect: (id: string) => void;
  organizations: Organization[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Organization: ${current.name}. Switch organization`}
          className="bg-card hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors"
          type="button"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{current.name}</span>
            <span className="text-muted-foreground block truncate text-xs">@{current.slug}</span>
          </span>
          <span className="text-muted-foreground text-xs">Switch</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
      >
        <DropdownMenuLabel className="text-xs">Organizations</DropdownMenuLabel>
        <DropdownMenuRadioGroup onValueChange={onSelect} value={current.id}>
          {organizations.map((organization) => (
            <DropdownMenuRadioItem key={organization.id} value={organization.id}>
              <span className="truncate">{organization.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCreate}>New organization…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

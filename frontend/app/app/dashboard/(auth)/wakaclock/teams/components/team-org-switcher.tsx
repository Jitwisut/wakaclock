'use client';

import type * as React from 'react';

import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Organization } from '@/lib/wakaclock/measurement-types';

/** A stable hue per organization so its monogram keeps the same colour everywhere. */
export function organizationHue(organization: Pick<Organization, 'id'>): number {
  let hash = 0;
  for (const char of organization.id) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  return hash;
}

export function OrganizationMonogram({
  organization,
  size = 36,
}: {
  organization: Organization;
  size?: number;
}) {
  const hue = organizationHue(organization);
  const initials = organization.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden
      className="glass-tint font-semibold"
      style={
        {
          width: size,
          height: size,
          '--tint-radius': `${Math.round(size * 0.28)}px`,
          fontSize: Math.round(size * 0.38),
          background: `linear-gradient(145deg, oklch(0.74 0.15 ${hue}), oklch(0.56 0.19 ${(hue + 40) % 360}))`,
        } as React.CSSProperties
      }
    >
      {initials || '·'}
    </span>
  );
}

/** The sidebar's account card: the current organization, switchable like an Apple ID card. */
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
          className="glass-card flex w-full items-center gap-3 p-2.5 text-left transition-transform duration-150 active:scale-[0.98]"
          type="button"
        >
          <OrganizationMonogram organization={current} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{current.name}</span>
            <span className="block truncate text-[12px] text-[var(--glass-label-2)]">
              @{current.slug}
            </span>
          </span>
          <ChevronsUpDownIcon aria-hidden className="size-4 text-[var(--glass-label-3)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="glass-surface glass-menu w-(--radix-dropdown-menu-trigger-width) min-w-60 p-1.5"
      >
        <DropdownMenuLabel className="text-xs">Organizations</DropdownMenuLabel>
        {organizations.map((organization) => (
          <DropdownMenuItem
            className="gap-2.5 rounded-lg"
            key={organization.id}
            onSelect={() => onSelect(organization.id)}
          >
            <OrganizationMonogram organization={organization} size={24} />
            <span className="min-w-0 flex-1 truncate">{organization.name}</span>
            {organization.id === current.id && <CheckIcon aria-hidden className="size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2.5 rounded-lg" onSelect={onCreate}>
          <PlusIcon aria-hidden className="size-4" />
          New Organization…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

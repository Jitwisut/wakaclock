'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import { CommandIcon, SearchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { useVisibleNavItems } from '@/hooks/use-visible-nav-items';

/**
 * Labels for the Search component
 */
export interface SearchLabels {
  desktopInputAriaLabel?: string;
  dialogDescription?: string;
  dialogInputPlaceholder?: string;
  dialogTitle?: string;
  emptyState?: string;
  inputPlaceholder?: string;
  mobileButtonAriaLabel?: string;
}

/**
 * Search component props
 *
 * @description Props for the command palette search.
 */
export interface SearchProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Customizable labels for internationalization */
  labels?: SearchLabels;
  /**
   * Custom test ID for testing
   * @default 'header-search'
   */
  testId?: string;
}

/**
 * Search component - Command palette style search
 *
 * @description
 * A responsive search component with keyboard shortcut support.
 * Shows an input on desktop and icon button on mobile, opening
 * a full command dialog for navigation.
 *
 * ## Features
 * - **Keyboard Shortcut**: Ctrl/Cmd+K to open
 * - **Responsive**: Input on desktop, icon on mobile
 * - **Command Palette**: Full navigation with categories
 * - **i18n Ready**: All labels customizable
 *
 * ## Accessibility
 * - `role="search"` on container
 * - Keyboard navigable command list
 * - Focus management on open/close
 *
 * @example
 * ```tsx
 * <Search labels={{ inputPlaceholder: 'Search commands...' }} />
 * ```
 */
const Search = React.forwardRef<HTMLDivElement, SearchProps>(
  ({ labels, testId = 'header-search', ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    // Same filter the sidebar applies: a deployment that hides Goals from the nav must
    // not offer it here either.
    const visibleNavItems = useVisibleNavItems();
    const inputPlaceholder = labels?.inputPlaceholder ?? 'Search...';
    const desktopInputAriaLabel = labels?.desktopInputAriaLabel ?? inputPlaceholder;
    const mobileButtonAriaLabel = labels?.mobileButtonAriaLabel ?? inputPlaceholder;
    const dialogTitle = labels?.dialogTitle ?? 'Command Palette';
    const dialogDescription = labels?.dialogDescription ?? 'Search for a command to run...';
    const dialogInputPlaceholder = labels?.dialogInputPlaceholder ?? 'Type a command or search...';
    const emptyState = labels?.emptyState ?? 'No results found.';

    useEffect(() => {
      const down = (e: KeyboardEvent) => {
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          setOpen((prev) => !prev);
        }
      };
      document.addEventListener('keydown', down);
      return () => document.removeEventListener('keydown', down);
    }, []);

    return (
      <div
        className="lg:flex-1"
        data-slot="search"
        data-testid={testId}
        ref={ref}
        role="search"
        {...props}
      >
        <div className="relative hidden max-w-sm flex-1 lg:block">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            aria-label={desktopInputAriaLabel}
            className="h-9 w-full cursor-pointer rounded-md border pr-4 pl-10 text-sm shadow-xs"
            data-testid={`${testId}-desktop-input`}
            onFocus={() => setOpen(true)}
            placeholder={inputPlaceholder}
            type="search"
          />
          <div className="absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded-sm bg-zinc-200 p-1 font-mono text-xs font-medium sm:flex dark:bg-neutral-700">
            <CommandIcon className="size-3" />
            <span>k</span>
          </div>
        </div>
        <div className="block lg:hidden">
          <Button
            aria-label={mobileButtonAriaLabel}
            data-testid={`${testId}-mobile-trigger`}
            onClick={() => setOpen(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <SearchIcon />
          </Button>
        </div>
        <CommandDialog
          description={dialogDescription}
          onOpenChange={setOpen}
          open={open}
          title={dialogTitle}
        >
          <CommandInput
            data-testid={`${testId}-command-input`}
            placeholder={dialogInputPlaceholder}
          />
          <CommandList>
            <CommandEmpty data-testid={`${testId}-empty`}>{emptyState}</CommandEmpty>
            {visibleNavItems.map((route) => (
              <React.Fragment key={route.title}>
                <CommandGroup heading={route.title}>
                  {route.items.map((item) => (
                    <CommandItem
                      key={item.href}
                      onSelect={() => {
                        setOpen(false);
                        router.push(item.href);
                      }}
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </React.Fragment>
            ))}
          </CommandList>
        </CommandDialog>
      </div>
    );
  }
);

Search.displayName = 'Search';

export { Search };
export default Search;

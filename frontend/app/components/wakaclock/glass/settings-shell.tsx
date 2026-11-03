'use client';

import * as React from 'react';

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

import { type GlassTint, GlassTintIcon } from './glass-surface';

export interface SettingsItem {
  badge?: React.ReactNode;
  description?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  id: string;
  keywords?: string[];
  label: string;
  tint: GlassTint;
}

export interface SettingsGroup {
  id: string;
  items: SettingsItem[];
  label?: string;
}

const SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 } as const;

function matches(item: SettingsItem, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [item.label, item.description ?? '', ...(item.keywords ?? [])].some((text) =>
    text.toLowerCase().includes(needle)
  );
}

/**
 * A System Settings-style split view: a translucent sidebar of tinted sections and a
 * content pane. Below `md` it becomes an iOS Settings stack — the list is one screen and
 * a section pushes in over it, with a back button.
 *
 * Navigation state belongs to the caller (`activeId`, `view`), so a page can keep it in
 * the URL and a reload or shared link opens the same section.
 */
export function SettingsShell({
  activeId,
  banner,
  children,
  description,
  groups,
  header,
  onBack,
  onSelect,
  title,
  toolbar,
  view,
  windowTitle,
}: {
  activeId: string;
  banner?: React.ReactNode;
  children: React.ReactNode;
  description?: string;
  groups: SettingsGroup[];
  header?: React.ReactNode;
  onBack?: () => void;
  onSelect: (id: string) => void;
  title: string;
  toolbar?: React.ReactNode;
  view: 'detail' | 'list';
  windowTitle: string;
}) {
  const [query, setQuery] = React.useState('');
  const shellRef = React.useRef<HTMLDivElement>(null);
  const visible = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => matches(item, query)) }))
    .filter((group) => group.items.length > 0);
  const firstMatch = visible[0]?.items[0];

  // Whatever changed the section (sidebar, shortcut, search), land at the top of it
  // rather than deep inside the previous section's scroll position.
  const previous = React.useRef(activeId);
  React.useEffect(() => {
    if (previous.current === activeId) return;
    previous.current = activeId;
    const top = shellRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 12, behavior: 'smooth' });
  }, [activeId]);

  return (
    <div
      className="glass-window group/shell relative grid min-h-[calc(100svh-var(--header-height,56px)-2*var(--content-padding,16px))] overflow-clip md:grid-cols-[264px_minmax(0,1fr)]"
      data-view={view}
      ref={shellRef}
    >
      <aside
        aria-label={`${windowTitle} sections`}
        className="glass-sidebar min-w-0 max-md:border-0 max-md:bg-transparent max-md:group-data-[view=detail]/shell:hidden"
      >
        <div className="flex flex-col gap-4 px-3 pt-5 pb-6 md:sticky md:top-(--header-height) md:max-h-[calc(100svh-var(--header-height))] md:overflow-y-auto">
          <div className="px-2">
            <h1 className="text-[34px] leading-tight font-bold tracking-[-0.025em] md:text-[22px] md:tracking-[-0.02em]">
              {windowTitle}
            </h1>
          </div>
          <label className="relative mx-1 block">
            <span className="sr-only">Search {windowTitle.toLowerCase()} settings</span>
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--glass-label-3)]"
            />
            <input
              className="h-8 w-full rounded-[9px] bg-[var(--glass-fill)] pr-2 pl-8 text-[13px] text-[var(--glass-label)] outline-none placeholder:text-[var(--glass-label-3)] focus-visible:bg-[var(--glass-card)] focus-visible:shadow-[0_0_0_3.5px_var(--glass-accent-ring)]"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && firstMatch) onSelect(firstMatch.id);
                if (event.key === 'Escape') setQuery('');
              }}
              placeholder="Search"
              type="search"
              value={query}
            />
          </label>
          {header && <div className="px-1">{header}</div>}
          <nav aria-label={windowTitle} className="flex flex-col gap-4">
            {visible.map((group) => (
              <div className="flex flex-col" key={group.id}>
                {group.label && (
                  <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.02em] text-[var(--glass-label-3)] uppercase">
                    {group.label}
                  </p>
                )}
                <ul className="flex flex-col gap-px max-md:overflow-hidden max-md:rounded-[var(--glass-radius-card)] max-md:bg-[var(--glass-card)] max-md:shadow-[var(--glass-shadow-card)]">
                  {group.items.map((item) => {
                    const active = item.id === activeId;
                    return (
                      <li className="relative" key={item.id}>
                        {active && (
                          <motion.span
                            aria-hidden
                            className="absolute inset-0 rounded-[8px] bg-[var(--glass-accent)] max-md:hidden"
                            layoutId="glass-settings-active"
                            transition={SPRING}
                          />
                        )}
                        <button
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'relative flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-[5px] text-left text-[13.5px] transition-colors duration-150 max-md:min-h-11 max-md:gap-3 max-md:rounded-none max-md:px-4 max-md:text-[16px]',
                            'hover:bg-[var(--glass-fill)] max-md:active:bg-[var(--glass-fill-strong)]',
                            active &&
                              'md:text-[var(--glass-accent-contrast)] md:hover:bg-transparent'
                          )}
                          onClick={() => onSelect(item.id)}
                          type="button"
                        >
                          <GlassTintIcon icon={item.icon} tint={item.tint} />
                          <span className="min-w-0 flex-1 truncate font-medium md:font-normal">
                            {item.label}
                          </span>
                          {item.badge}
                          <ChevronRightIcon
                            aria-hidden
                            className="size-4 text-[var(--glass-label-3)] md:hidden"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {visible.length === 0 && (
              <p className="px-3 text-[13px] text-[var(--glass-label-3)]">
                No settings match “{query}”.
              </p>
            )}
          </nav>
        </div>
      </aside>

      <main
        className="min-w-0 max-md:group-data-[view=list]/shell:hidden"
        key={`${view}:${activeId}`}
      >
        <header className="sticky top-(--header-height) z-10 flex flex-wrap items-end justify-between gap-3 border-b-[0.5px] border-[var(--glass-separator)] bg-[var(--glass-material)] px-5 pt-4 pb-3 backdrop-blur-xl backdrop-saturate-150 md:px-8 md:pt-6">
          <div className="min-w-0">
            {onBack && (
              <button
                className="mb-1 -ml-1.5 inline-flex items-center gap-0.5 rounded-md px-1 text-[16px] text-[var(--glass-accent)] md:hidden"
                onClick={onBack}
                type="button"
              >
                <ChevronLeftIcon aria-hidden className="size-5" strokeWidth={2.4} />
                {windowTitle}
              </button>
            )}
            <h2 className="text-[28px] leading-tight font-bold tracking-[-0.022em]">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[13px] text-[var(--glass-label-2)]">{description}</p>
            )}
          </div>
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </header>
        <div className="glass-push px-4 py-5 md:px-8 md:py-7">
          <div className="mx-auto flex max-w-[880px] flex-col gap-4">
            {banner && (
              <div className="empty:hidden" data-glass-content>
                {banner}
              </div>
            )}
            <motion.div
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              className="flex flex-col gap-4"
              data-glass-content
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.8 }}
            >
              {children}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

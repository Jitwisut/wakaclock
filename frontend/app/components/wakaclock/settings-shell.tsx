'use client';

import * as React from 'react';

import { motion, MotionConfig } from 'motion/react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SettingsItem {
  badge?: React.ReactNode;
  description?: string;
  id: string;
  keywords?: string[];
  label: string;
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
 * A settings-style split view: a section list beside a content pane. Below `md` it
 * becomes a stack — the list is one screen and a section opens over it, with a back
 * link. Built only from theme tokens and shadcn primitives, so the active theme preset
 * (colours, corners, fonts, shadows) styles it like every other dashboard page.
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

  // Whatever changed the section (list, shortcut, search), land at the top of it
  // rather than deep inside the previous section's scroll position.
  const previous = React.useRef(activeId);
  React.useEffect(() => {
    if (previous.current === activeId) return;
    previous.current = activeId;
    const top = shellRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 12, behavior: 'smooth' });
  }, [activeId]);

  return (
    <MotionConfig reducedMotion="user">
      <Card
        className="group/shell grid min-h-[calc(100svh-var(--header-height,56px)-2*var(--content-padding,16px))] gap-0 overflow-clip py-0 md:grid-cols-[248px_minmax(0,1fr)]"
        data-view={view}
        ref={shellRef}
      >
        <aside
          aria-label={`${windowTitle} sections`}
          className="bg-muted/30 min-w-0 max-md:group-data-[view=detail]/shell:hidden md:border-r"
        >
          <div className="flex flex-col gap-4 px-3 pt-5 pb-6 md:sticky md:top-(--header-height) md:max-h-[calc(100svh-var(--header-height))] md:overflow-y-auto">
            <h1 className="font-display px-1 text-3xl font-semibold tracking-tight md:text-2xl">
              {windowTitle}
            </h1>
            <Input
              aria-label={`Search ${windowTitle.toLowerCase()} settings`}
              className="h-8"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && firstMatch) onSelect(firstMatch.id);
                if (event.key === 'Escape') setQuery('');
              }}
              placeholder="Search sections"
              type="search"
              value={query}
            />
            {header}
            <nav aria-label={windowTitle} className="flex flex-col gap-4">
              {visible.map((group) => (
                <div className="flex flex-col gap-1" key={group.id}>
                  {group.label && (
                    <p className="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase">
                      {group.label}
                    </p>
                  )}
                  <ul className="max-md:bg-card flex flex-col gap-0.5 max-md:gap-0 max-md:divide-y max-md:rounded-md max-md:border">
                    {group.items.map((item) => {
                      const active = item.id === activeId;
                      return (
                        <li className="relative" key={item.id}>
                          {active && (
                            <motion.span
                              aria-hidden
                              className="bg-primary absolute inset-0 rounded-md max-md:hidden"
                              layoutId="settings-shell-active"
                              transition={SPRING}
                            />
                          )}
                          <button
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'hover:bg-accent hover:text-accent-foreground relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors max-md:min-h-11 max-md:rounded-none max-md:px-4 max-md:text-base',
                              active &&
                                'md:text-primary-foreground md:hover:text-primary-foreground font-medium md:hover:bg-transparent'
                            )}
                            onClick={() => onSelect(item.id)}
                            type="button"
                          >
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.badge}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {visible.length === 0 && (
                <p className="text-muted-foreground px-2 text-sm">No sections match “{query}”.</p>
              )}
            </nav>
          </div>
        </aside>

        <section
          aria-labelledby="settings-shell-title"
          className="min-w-0 max-md:group-data-[view=list]/shell:hidden"
          key={`${view}:${activeId}`}
        >
          <header className="bg-card sticky top-(--header-height) z-10 flex flex-wrap items-end justify-between gap-3 border-b px-5 pt-4 pb-3 md:px-8 md:pt-6">
            <div className="min-w-0">
              {onBack && (
                <button
                  aria-label={`Back to ${windowTitle}`}
                  className="text-primary mb-1 text-sm font-medium underline-offset-4 hover:underline md:hidden"
                  onClick={onBack}
                  type="button"
                >
                  ‹ {windowTitle}
                </button>
              )}
              <h2
                className="font-display text-2xl font-semibold tracking-tight md:text-3xl"
                id="settings-shell-title"
              >
                {title}
              </h2>
              {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
            </div>
            {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
          </header>
          <div className="max-md:animate-in max-md:fade-in-0 max-md:slide-in-from-right-6 px-4 py-5 duration-300 md:px-8 md:py-6">
            <div className="mx-auto flex max-w-[880px] flex-col gap-4 text-sm">
              {banner && <div className="empty:hidden">{banner}</div>}
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 8 }}
                transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.8 }}
              >
                {children}
              </motion.div>
            </div>
          </div>
        </section>
      </Card>
    </MotionConfig>
  );
}

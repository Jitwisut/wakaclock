'use client';

import * as React from 'react';

import { MenuIcon, PanelLeftIcon } from 'lucide-react';
import { motion, MotionConfig } from 'motion/react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { Notifications } from '@/components/layout/header/notifications';
import { Search } from '@/components/layout/header/search';
import { ThemeSwitch } from '@/components/layout/header/theme-switch';
import { breadcrumbFor } from '@/components/layout/header/toolbar-breadcrumb';
import { UserMenu } from '@/components/layout/header/user-menu';
import Logo from '@/components/layout/logo';
import { preserveAnalyticsQuery } from '@/components/layout/sidebar/nav-main';
import { SidebarLevelBadge } from '@/components/layout/sidebar/sidebar-level-badge';
import { ThemeCustomizerPanel } from '@/components/theme-customizer';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SubscriptionBadge } from '@/components/wakaclock/subscription-badge';
import { SyncStatusIndicator } from '@/components/wakaclock/sync-status-indicator';
import { UserSwitcher } from '@/components/wakaclock/user-switcher';
import { useVisibleNavItems } from '@/hooks/use-visible-nav-items';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { activeScene, type CinemaScene, cinemaScenes } from './cinema-nav';
import styles from './cinema-shell.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

function useScenes() {
  const groups = useVisibleNavItems();
  const pathname = usePathname();
  const queryString = useSearchParams().toString();
  const scenes = React.useMemo(() => cinemaScenes(groups), [groups]);
  const active = React.useMemo(() => activeScene(pathname, scenes), [pathname, scenes]);
  const hrefFor = React.useCallback(
    (href: string) => preserveAnalyticsQuery(pathname, queryString, href),
    [pathname, queryString]
  );
  return { active, hrefFor, pathname, scenes };
}

/**
 * The navigation rail. Each section is a numbered "scene"; the current one carries a 2px
 * green rule that glides between entries. Collapsed, the rail shows icon and number with a
 * tooltip; open, titles slide in and Analytics lists its views.
 */
function CinemaRail() {
  const { open, toggleSidebar } = useSidebar();
  const { active, hrefFor, scenes } = useScenes();

  return (
    <aside aria-label="Dashboard navigation" className={styles.rail} data-testid="cinema-rail">
      <div className={styles.brand}>
        <Logo />
        <span className={styles.brandName}>AtoAxis</span>
        <SidebarLevelBadge />
      </div>
      <nav aria-label="Primary" className={styles.scenes}>
        {scenes.map((scene) => (
          <RailScene
            active={active.scene?.item.href === scene.item.href}
            activeSub={active.subHref}
            hrefFor={hrefFor}
            key={scene.item.href}
            open={open}
            scene={scene}
          />
        ))}
      </nav>
      <div className={styles.railFoot}>
        <button
          aria-expanded={open}
          aria-label={open ? 'Collapse navigation' : 'Expand navigation'}
          className={styles.railToggle}
          data-testid="cinema-rail-toggle"
          onClick={toggleSidebar}
          type="button"
        >
          <PanelLeftIcon />
        </button>
      </div>
    </aside>
  );
}

function RailScene({
  active,
  activeSub,
  hrefFor,
  open,
  scene,
}: {
  active: boolean;
  activeSub: null | string;
  hrefFor: (href: string) => string;
  open: boolean;
  scene: CinemaScene;
}) {
  const { item, number } = scene;
  const Icon = item.icon;
  const link = (
    <Link
      aria-current={active && !activeSub ? 'page' : undefined}
      className={styles.scene}
      data-active={active}
      href={hrefFor(item.href)}
    >
      {active && (
        <motion.span
          aria-hidden
          className={styles.marker}
          layoutId="cinema-rail-marker"
          transition={{ type: 'spring', stiffness: 520, damping: 42 }}
        />
      )}
      <span className={styles.sceneMark}>
        {Icon && <Icon aria-hidden />}
        <span aria-hidden className={styles.sceneNumber}>
          {number}
        </span>
      </span>
      <span className={styles.sceneTitle}>
        {item.title}
        {item.isNew && <span className={styles.newTag}>New</span>}
      </span>
    </Link>
  );

  return (
    <div>
      {open ? (
        link
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.title}</TooltipContent>
        </Tooltip>
      )}
      {active && item.items && (
        <div className={styles.subScenes}>
          {item.items.map((sub) => (
            <Link
              aria-current={activeSub === sub.href ? 'page' : undefined}
              className={styles.subScene}
              href={hrefFor(sub.href)}
              key={sub.href}
            >
              {sub.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small screens: the whole navigation as a full-screen index of numbered scenes. */
function CinemaIndex({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { active, hrefFor, scenes } = useScenes();
  const close = () => onOpenChange(false);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className={styles.index} side="left" testId="cinema-index">
        <div className={styles.indexHead}>
          <SheetTitle className="cinema-label">Index</SheetTitle>
          <SheetDescription className="sr-only">Every section of the dashboard.</SheetDescription>
        </div>
        <nav aria-label="Primary" className={styles.indexList}>
          {scenes.map((scene, order) => {
            const isActive = active.scene?.item.href === scene.item.href;
            return (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={styles.indexItem}
                data-active={isActive}
                initial={{ opacity: 0, y: 14 }}
                key={scene.item.href}
                transition={{ delay: 0.04 + order * 0.025, duration: 0.5, ease: EASE }}
              >
                <span aria-hidden className={styles.indexNumber}>
                  {scene.number}
                </span>
                <Link
                  aria-current={isActive && !active.subHref ? 'page' : undefined}
                  className={styles.indexTitle}
                  href={hrefFor(scene.item.href)}
                  onClick={close}
                >
                  {scene.item.title}
                </Link>
                {isActive && scene.item.items && (
                  <span className={styles.indexSubs}>
                    {scene.item.items.map((sub) => (
                      <Link
                        aria-current={active.subHref === sub.href ? 'page' : undefined}
                        href={hrefFor(sub.href)}
                        key={sub.href}
                        onClick={close}
                      >
                        {sub.title}
                      </Link>
                    ))}
                  </span>
                )}
              </motion.div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/** The slate: scene number and where you are, then the account and status controls. */
function CinemaSlate({ onOpenIndex }: { onOpenIndex: () => void }) {
  const { active, pathname } = useScenes();
  const logout = useWakaclockUserStore((store) => store.logout);
  const trail = React.useMemo(() => breadcrumbFor(pathname), [pathname]);

  return (
    <header className={styles.slate} data-slot="cinema-slate" data-testid="cinema-slate">
      <button
        aria-label="Open navigation"
        className={styles.menuButton}
        data-testid="cinema-index-open"
        onClick={onOpenIndex}
        type="button"
      >
        <MenuIcon aria-hidden className="size-4" />
      </button>
      <div className={styles.slateTitle}>
        {active.scene && (
          <span aria-hidden className={styles.slateNumber}>
            {active.scene.number}
          </span>
        )}
        {trail.length > 0 && (
          <nav aria-label="Breadcrumb" className="hidden min-w-0 lg:block">
            <ol className={styles.slateTrail}>
              {trail.map((crumb, index) => {
                const last = index === trail.length - 1;
                return (
                  <li className="flex min-w-0 items-baseline gap-2" key={crumb.href}>
                    {index > 0 && (
                      <span aria-hidden className={styles.slateDivider}>
                        /
                      </span>
                    )}
                    {last ? (
                      <span aria-current="page" className={styles.slateCurrent}>
                        {crumb.title}
                      </span>
                    ) : (
                      <Link href={crumb.href}>{crumb.title}</Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </div>
      <Search />
      <div className={styles.slateTools}>
        <SubscriptionBadge />
        <UserSwitcher />
        <span aria-hidden className={`${styles.slateRule} hidden sm:block`} />
        <SyncStatusIndicator />
        <Notifications />
        <ThemeSwitch />
        <div className="hidden md:contents">
          <ThemeCustomizerPanel />
        </div>
        <span aria-hidden className={`${styles.slateRule} hidden sm:block`} />
        <UserMenu onLogout={logout} />
      </div>
    </header>
  );
}

/**
 * The Cinema dashboard frame. Lives inside `SidebarProvider` so the rail reuses its open
 * state (cookie-persisted, ⌘B) and header controls that read the sidebar keep working.
 */
export function CinemaShell({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar();
  const [indexOpen, setIndexOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setIndexOpen(false);
  }, [pathname]);

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.frame} data-rail={open ? 'open' : 'closed'} data-slot="cinema-shell">
        <a className={styles.skip} href="#cinema-main">
          Skip to content
        </a>
        <CinemaRail />
        <div className={styles.column}>
          <CinemaSlate onOpenIndex={() => setIndexOpen(true)} />
          <main className={styles.main} id="cinema-main" tabIndex={-1}>
            {children}
          </main>
        </div>
        <CinemaIndex onOpenChange={setIndexOpen} open={indexOpen} />
      </div>
    </MotionConfig>
  );
}

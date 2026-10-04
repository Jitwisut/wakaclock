'use client';

import * as React from 'react';

import { motion, type Variants } from 'motion/react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

import { ApiKeyPanel } from './components/api-key-panel';
import { DashboardPanelsPanel } from './components/dashboard-panels-panel';
import { MaintenancePanel } from './components/maintenance-panel';
import { ProjectMergesPanel } from './components/project-merges-panel';
import { ProjectRulesPanel } from './components/project-rules-panel';
import {
  isSettingsSection,
  SETTINGS_SECTIONS,
  type SettingsSection,
  type SettingsSectionId,
} from './components/sections';
import { SettingsHero } from './components/settings-hero';

const PANELS: Record<SettingsSectionId, React.ComponentType> = {
  'api-key': ApiKeyPanel,
  maintenance: MaintenancePanel,
  merges: ProjectMergesPanel,
  panels: DashboardPanelsPanel,
  rules: ProjectRulesPanel,
};

const SECTION_VARIANTS: Variants = {
  hidden: { filter: 'blur(4px)', opacity: 0, y: 10 },
  shown: { filter: 'blur(0px)', opacity: 1, y: 0 },
};

/**
 * The open section lives in `?tab=` so a section is linkable. It is read after
 * mount (not during render) so the server and first client paint agree.
 */
function useSectionParam(): [SettingsSectionId, (id: SettingsSectionId) => void] {
  const [section, setSection] = React.useState<SettingsSectionId>('api-key');

  React.useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (isSettingsSection(fromUrl)) setSection(fromUrl);
  }, []);

  const change = React.useCallback((id: SettingsSectionId) => {
    setSection(id);
    const url = new URL(window.location.href);
    if (id === 'api-key') url.searchParams.delete('tab');
    else url.searchParams.set('tab', id);
    window.history.replaceState(window.history.state, '', url);
  }, []);

  return [section, change];
}

function SectionIntro({ index, section }: { index: number; section: SettingsSection }) {
  return (
    <header className="mb-5 flex flex-col gap-1.5">
      <span className="text-muted-foreground font-mono text-[11px] tracking-[0.16em] uppercase">
        {String(index + 1).padStart(2, '0')} · {section.hint}
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">{section.label}</h2>
      <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
        {section.description}
      </p>
    </header>
  );
}

function SettingsWorkspace() {
  const reduced = useReducedMotion();
  const [section, setSection] = useSectionParam();

  function navigate(id: SettingsSectionId) {
    setSection(id);
    document.querySelector('#settings-sections')?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <SettingsHero active={section} onNavigate={navigate} />

      <Tabs
        className="scroll-mt-20 gap-5 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8"
        id="settings-sections"
        onValueChange={(value) => isSettingsSection(value) && setSection(value)}
        orientation="vertical"
        value={section}
      >
        {/*
          One rail for every width: a sticky column on desktop, a horizontally scrolling
          pill row on a phone, so every section stays reachable without wrapping.
        */}
        <TabsList className="no-scrollbar bg-muted/60 flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border p-1.5 lg:sticky lg:top-20 lg:flex-col lg:items-stretch lg:overflow-visible">
          {SETTINGS_SECTIONS.map((s) => {
            const isActive = section === s.id;
            const Icon = s.icon;
            return (
              <TabsTrigger
                className="text-muted-foreground hover:text-foreground data-[state=active]:text-foreground relative h-auto flex-none shrink-0 cursor-pointer justify-start gap-3 rounded-xl border-0 px-3 py-2.5 text-left transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none lg:w-full dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
                key={s.id}
                value={s.id}
              >
                {isActive && (
                  <motion.span
                    className="bg-background absolute inset-0 rounded-xl border shadow-sm"
                    layoutId="settings-nav-active"
                    transition={
                      reduced ? { duration: 0 } : { bounce: 0.18, duration: 0.5, type: 'spring' }
                    }
                  />
                )}
                <span
                  className={cn(
                    'relative grid size-7 shrink-0 place-items-center rounded-lg transition-colors',
                    isActive ? 'bg-foreground text-background' : 'bg-background/70'
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <span className="relative flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-muted-foreground hidden text-xs font-normal lg:block">
                    {s.hint}
                  </span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="min-w-0">
          {SETTINGS_SECTIONS.map((s, index) => {
            const Panel = PANELS[s.id];
            // Keep the API-key panel mounted so a freshly generated value remains visible
            // while switching sections; it is also reloaded from the session-only API on mount.
            const keepMounted = s.id === 'api-key';
            return (
              <TabsContent
                className={cn('mt-0', keepMounted && 'data-[state=inactive]:hidden')}
                forceMount={keepMounted ? true : undefined}
                key={s.id}
                value={s.id}
              >
                {/* Driven by state rather than a remount key, so the kept-mounted API-key
                    panel keeps its freshly generated value when it animates back in. */}
                <motion.div
                  animate={section === s.id ? 'shown' : 'hidden'}
                  initial={reduced ? false : 'hidden'}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  variants={reduced ? undefined : SECTION_VARIANTS}
                >
                  <SectionIntro index={index} section={s} />
                  <Panel />
                </motion.div>
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireUser>
      <SettingsWorkspace />
    </RequireUser>
  );
}

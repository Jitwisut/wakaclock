'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';

import { useDashboardPanels } from '@/components/dashboard-panels';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { DASHBOARD_PANELS } from '@/lib/dashboard-panels';
import { cn } from '@/lib/utils';
import { getCurrentApiKey, getProjectMerges, getProjectRules } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../settings.module.css';

import type { SettingsSectionId } from './sections';

const LIVE = 'oklch(0.86 0.17 158)';
const WARN = 'oklch(0.82 0.15 80)';

interface ModuleSpec {
  dot?: string;
  id: SettingsSectionId;
  label: string;
  live?: boolean;
  sub: string;
  value: string;
}

/** A failed or pending request must not read as a real zero. */
function countModule(
  query: { isError: boolean; isLoading: boolean },
  ready: ModuleSpec
): ModuleSpec {
  if (query.isError) return { id: ready.id, label: ready.label, sub: "Couldn't load", value: '—' };
  if (query.isLoading) return { id: ready.id, label: ready.label, sub: 'Loading…', value: '—' };
  return ready;
}

export function SettingsHero({
  active,
  onNavigate,
}: {
  active: SettingsSectionId;
  onNavigate: (id: SettingsSectionId) => void;
}) {
  const reduced = useReducedMotion();
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const username = useWakaclockUserStore((s) => s.username) ?? '';
  const { hidden } = useDashboardPanels();

  // Same keys as the section panels, so these share one cached request each.
  const keyQuery = useQuery({
    queryKey: ['wakaclock', 'api-key', userId],
    queryFn: getCurrentApiKey,
    enabled: Boolean(userId),
  });
  const rulesQuery = useQuery({
    queryKey: wakaclockKeys.projectRules(userId),
    queryFn: () => getProjectRules(userId),
    enabled: Boolean(userId),
  });
  const mergesQuery = useQuery({
    queryKey: wakaclockKeys.projectMerges(userId),
    queryFn: () => getProjectMerges(userId),
    enabled: Boolean(userId),
  });

  const storedKey =
    keyQuery.data?.data?.user_id === userId ? Boolean(keyQuery.data?.data?.api_key) : false;
  const rules = rulesQuery.data?.data ?? [];
  const activeRules = rules.filter((rule) => rule.is_active).length;
  const merges = mergesQuery.data?.data ?? [];
  const hiddenPanels = DASHBOARD_PANELS.filter((panel) => hidden.has(panel.id)).length;
  const visiblePanels = DASHBOARD_PANELS.length - hiddenPanels;

  const modules: ModuleSpec[] = [
    storedKey
      ? {
          dot: LIVE,
          id: 'api-key',
          label: 'API key',
          live: true,
          sub: 'Active and stored',
          value: 'Active',
        }
      : { id: 'api-key', label: 'API key', sub: 'Shown once when created', value: 'Manage' },
    countModule(rulesQuery, {
      dot: activeRules > 0 ? LIVE : undefined,
      id: 'rules',
      label: 'Project rules',
      sub: rules.length > 0 ? `${activeRules} of ${rules.length} active` : 'No rules yet',
      value: String(rules.length),
    }),
    countModule(mergesQuery, {
      id: 'merges',
      label: 'Project merges',
      sub: merges.length === 1 ? '1 project folded' : `${merges.length} projects folded`,
      value: String(merges.length),
    }),
    {
      dot: hiddenPanels > 0 ? WARN : LIVE,
      id: 'panels',
      label: 'Panels',
      sub: hiddenPanels > 0 ? `${hiddenPanels} hidden on this device` : 'Everything visible',
      value: `${visiblePanels}/${DASHBOARD_PANELS.length}`,
    },
  ];

  const initial = (username.trim()[0] ?? '?').toUpperCase();

  return (
    <section aria-labelledby="settings-title" className={cn(styles.hero, 'p-5 sm:p-7')}>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-end">
        <div className="flex min-w-0 flex-col gap-5">
          <div className={cn(styles.eyebrow, 'flex items-center gap-2')}>
            <span
              className={cn(styles.statusDot, styles.statusDotLive)}
              style={{ '--dot': LIVE } as React.CSSProperties}
            />
            Control room
          </div>
          <div className="flex items-center gap-4">
            <motion.span
              animate={{ opacity: 1, scale: 1 }}
              aria-hidden="true"
              className={styles.monogram}
              initial={reduced ? false : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {initial}
            </motion.span>
            <div className="min-w-0">
              <h1 className={styles.title} id="settings-title">
                Settings
              </h1>
              {username && (
                <p className="mt-2 truncate text-sm text-white/65">
                  Signed in as <span className="text-white">{username}</span>
                </p>
              )}
            </div>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-white/65">
            Project rules run at write time, merges at read time; reprocess and import are one-off
            maintenance jobs.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {modules.map((module, index) => (
            <motion.button
              animate={{ opacity: 1, y: 0 }}
              className={cn(styles.module, active === module.id && styles.moduleActive)}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              key={module.id}
              onClick={() => onNavigate(module.id)}
              transition={{ delay: 0.1 + index * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              type="button"
            >
              <span className={cn(styles.moduleLabel, 'flex items-center justify-between gap-2')}>
                {module.label}
                <span
                  aria-hidden="true"
                  className={cn(styles.statusDot, module.live && styles.statusDotLive)}
                  style={module.dot ? ({ '--dot': module.dot } as React.CSSProperties) : undefined}
                />
              </span>
              <span className={styles.moduleValue}>{module.value}</span>
              <span className="truncate text-xs text-white/55">{module.sub}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

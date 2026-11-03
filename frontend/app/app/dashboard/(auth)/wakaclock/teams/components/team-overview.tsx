'use client';

import { ChevronRightIcon, ClockIcon, GlobeIcon, ShieldCheckIcon } from 'lucide-react';

import {
  GlassDot,
  GlassTintIcon,
  type GlassTone,
} from '@/components/wakaclock/glass/glass-surface';
import type { Organization } from '@/lib/wakaclock/measurement-types';
import type { TeamHealthState, TeamMeasurementHealth } from '@/lib/wakaclock/team-types';

import { OrganizationMonogram } from './team-org-switcher';
import { ORGANIZATION_SECTIONS, teamSection, type TeamSectionId } from './team-sections';

/** Maps a server health status onto a traffic-light tone. Unknown words stay amber. */
export function statusTone(status: string | undefined): GlassTone {
  if (!status) return 'idle';
  const value = status.toLowerCase();
  if (/fail|error|block|broken|denied|expired|stale|degraded|revoked/.test(value)) return 'bad';
  if (/unknown|unconfirmed|unavailable|disabled|not_configured|none/.test(value)) return 'idle';
  if (
    /healthy|ok|protected|admitted|active|ready|current|complete|connected|synced|verified/.test(
      value
    )
  ) {
    return 'good';
  }
  return 'warn';
}

/** `events_flowing` → `Events flowing`. */
export function humanize(value: string): string {
  const text = value.replaceAll('_', ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function StatusTile({ label, state }: { label: string; state: TeamHealthState | undefined }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-4 shadow-[-0.5px_-0.5px_0_0_var(--glass-separator)]">
      <span className="text-[12px] text-[var(--glass-label-2)]">{label}</span>
      <span className="flex items-center gap-2 text-[14px] font-semibold">
        <GlassDot tone={statusTone(state?.status)} />
        <span className="truncate">{state ? humanize(state.status) : 'Unconfirmed'}</span>
      </span>
      {state?.reason && (
        <span className="truncate text-[12px] text-[var(--glass-label-3)]">
          {humanize(state.reason)}
        </span>
      )}
    </div>
  );
}

function formatChecked(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function TeamOverviewHero({
  health,
  healthLoading,
  onNavigate,
  organization,
}: {
  health: TeamMeasurementHealth | undefined;
  healthLoading: boolean;
  onNavigate: (section: TeamSectionId) => void;
  organization: Organization;
}) {
  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 p-5 md:p-6">
          <OrganizationMonogram organization={organization} size={60} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[22px] leading-tight font-bold tracking-[-0.02em]">
              {organization.name}
            </p>
            <p className="text-[13px] text-[var(--glass-label-2)]">@{organization.slug}</p>
          </div>
          {health && (
            <div className="flex flex-wrap gap-2 text-[12px] text-[var(--glass-label-2)]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--glass-fill)] px-2.5 py-1">
                <GlobeIcon aria-hidden className="size-3.5" />
                {health.report_timezone}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--glass-fill)] px-2.5 py-1">
                <ClockIcon aria-hidden className="size-3.5" />
                Checked {formatChecked(health.checked_at)}
              </span>
            </div>
          )}
        </div>
        <div
          aria-busy={healthLoading}
          aria-label="Data health at a glance"
          className="grid grid-cols-2 overflow-hidden border-t-[0.5px] border-[var(--glass-separator)] md:grid-cols-4"
          role="group"
        >
          <StatusTile label="Your capture" state={health?.own.capture} />
          <StatusTile label="Your delivery" state={health?.own.delivery} />
          <StatusTile label="GitHub sync" state={health?.team.integration} />
          <StatusTile label="Restore protection" state={health?.restore} />
        </div>
      </div>

      <nav aria-label="Organization shortcuts" className="grid gap-3 sm:grid-cols-2">
        {ORGANIZATION_SECTIONS.filter((id) => id !== 'overview').map((id) => {
          const item = teamSection(id);
          return (
            <button
              className="glass-card group flex items-center gap-3.5 p-4 text-left transition-transform duration-200 ease-[var(--glass-ease)] hover:-translate-y-0.5 active:scale-[0.985]"
              key={id}
              onClick={() => onNavigate(id)}
              type="button"
            >
              <GlassTintIcon icon={item.icon} size={36} tint={item.tint} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">{item.label}</span>
                <span className="line-clamp-2 block text-[12.5px] text-[var(--glass-label-2)]">
                  {item.description}
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden
                className="size-4 text-[var(--glass-label-3)] transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </button>
          );
        })}
      </nav>
    </>
  );
}

export function TeamPrivacyNote() {
  return (
    <p className="flex items-start gap-2 px-1 text-[12.5px] text-[var(--glass-label-2)]">
      <ShieldCheckIcon aria-hidden className="mt-0.5 size-4 flex-none text-[var(--glass-good)]" />
      Team reports include only members who choose to share. Individual totals need a second opt-in.
    </p>
  );
}

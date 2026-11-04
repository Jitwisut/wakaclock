'use client';

import { Card } from '@/components/ui/card';
import { Tilt3D } from '@/components/wakaclock/tilt-3d';
import { cn } from '@/lib/utils';
import type { Organization } from '@/lib/wakaclock/measurement-types';
import type { TeamHealthState, TeamMeasurementHealth } from '@/lib/wakaclock/team-types';

import { ORGANIZATION_SECTIONS, teamSection, type TeamSectionId } from './team-sections';

export type StatusTone = 'bad' | 'good' | 'idle' | 'warn';

/** Maps a server health status onto a traffic-light tone. Unknown words stay amber. */
export function statusTone(status: string | undefined): StatusTone {
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

const TONE_CLASS: Record<StatusTone, string> = {
  bad: 'bg-destructive',
  good: 'bg-primary',
  idle: 'bg-muted-foreground/40',
  warn: 'bg-amber-500',
};

function StatusTile({ label, state }: { label: string; state: TeamHealthState | undefined }) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-1 px-5 py-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span
          aria-hidden
          className={cn('size-2 shrink-0 rounded-full', TONE_CLASS[statusTone(state?.status)])}
        />
        <span className="truncate">{state ? humanize(state.status) : 'Unconfirmed'}</span>
      </span>
      {state?.reason && (
        <span className="text-muted-foreground truncate text-xs">{humanize(state.reason)}</span>
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
      <Tilt3D>
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-end justify-between gap-3 p-5 md:p-6">
            <div className="min-w-0">
              <p className="font-display truncate text-xl font-semibold tracking-tight">
                {organization.name}
              </p>
              <p className="text-muted-foreground truncate text-sm">@{organization.slug}</p>
            </div>
            {health && (
              <p className="text-muted-foreground text-xs">
                <span>{health.report_timezone}</span> · Checked {formatChecked(health.checked_at)}
              </p>
            )}
          </div>
          <div
            aria-busy={healthLoading}
            aria-label="Data health at a glance"
            className="bg-border grid grid-cols-2 gap-px border-t md:grid-cols-4"
            role="group"
          >
            <StatusTile label="Your capture" state={health?.own.capture} />
            <StatusTile label="Your delivery" state={health?.own.delivery} />
            <StatusTile label="GitHub sync" state={health?.team.integration} />
            <StatusTile label="Restore protection" state={health?.restore} />
          </div>
        </Card>
      </Tilt3D>

      <nav aria-label="Organization shortcuts" className="grid gap-3 sm:grid-cols-2">
        {ORGANIZATION_SECTIONS.filter((id) => id !== 'overview').map((id) => {
          const item = teamSection(id);
          return (
            <Tilt3D key={id}>
              <button
                className="bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground flex h-full w-full flex-col gap-1 rounded-xl border p-4 text-left transition-colors"
                data-slot="card"
                onClick={() => onNavigate(id)}
                type="button"
              >
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-muted-foreground line-clamp-2 text-xs">
                  {item.description}
                </span>
              </button>
            </Tilt3D>
          );
        })}
      </nav>
    </>
  );
}

export function TeamPrivacyNote() {
  return (
    <p className="text-muted-foreground px-1 text-xs">
      Team reports include only members who choose to share. Individual totals need a second opt-in.
    </p>
  );
}

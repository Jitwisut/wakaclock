'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { ChevronDownIcon, SparklesIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { GlassTintIcon } from '@/components/wakaclock/glass/glass-surface';
import { SettingsShell } from '@/components/wakaclock/glass/settings-shell';
import { QueryState } from '@/components/wakaclock/query-state';
import { listOrganizations } from '@/lib/wakaclock/endpoints-v2';
import type { Organization } from '@/lib/wakaclock/measurement-types';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getTeamMeasurementHealth } from '@/lib/wakaclock/team-endpoints';
import type { TeamMeasurementHealth } from '@/lib/wakaclock/team-types';
import { closedWeeks } from '@/lib/wakaclock/team-weeks';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { MyOrganizationInvites, OrganizationInvitesPanel } from './organization-invites';
import { OrganizationTeamsPanel } from './organization-teams-panel';
import { TeamActionsPanel } from './team-actions-panel';
import { TeamBillingSetupPanel } from './team-billing-setup-panel';
import { TeamComparisonPanel } from './team-comparison-panel';
import { TeamGithubPanel } from './team-github-panel';
import { TeamInsightsPanel } from './team-insights-panel';
import { TeamOnboardingPanel } from './team-onboarding-panel';
import { TeamOrgSwitcher } from './team-org-switcher';
import { TeamOrganizationCreatePanel } from './team-organization-create-panel';
import { TeamOrganizationRecoveryPanel } from './team-organization-recovery-panel';
import { TeamOverviewHero, TeamPrivacyNote } from './team-overview';
import { isTeamSection, teamSection, teamSectionGroups, type TeamSectionId } from './team-sections';
import { TeamSummaryPanel } from './team-summary-panel';
import { TeamTrustPanel } from './team-trust-panel';

/**
 * Navigation lives in the URL (`?org=&section=`) so a reload or a shared link opens the
 * same place. The native History API keeps it client-side: Next.js syncs it into
 * `useSearchParams` without a server round trip, and the browser back gesture returns
 * from a section to the list on a phone, the way an iOS navigation stack does.
 */
function useTeamLocation() {
  const searchParams = useSearchParams();
  const navigate = React.useCallback(
    (next: { org?: null | string; section?: null | TeamSectionId }, mode: 'push' | 'replace') => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(next)) {
        if (value === null) params.delete(key);
        else if (value !== undefined) params.set(key, value);
      }
      const query = params.toString();
      const suffix = query ? `?${query}` : '';
      const url = `${window.location.pathname}${suffix}`;
      if (mode === 'push') window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    },
    []
  );
  return { org: searchParams.get('org'), section: searchParams.get('section'), navigate };
}

/** `2026-10-26` → `Oct 26`, read as a calendar date (no timezone shift). */
function formatDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function WeekPicker({
  onChange,
  timezone,
  value,
  weeks,
}: {
  onChange: (start: string) => void;
  timezone: string;
  value: string;
  weeks: Array<{ end: string; start: string }>;
}) {
  return (
    <label className="relative inline-flex items-center">
      <select
        aria-label="Completed report week"
        className="h-8 cursor-pointer appearance-none rounded-[9px] bg-[var(--glass-card)] pr-8 pl-3 text-[13px] font-medium text-[var(--glass-label)] shadow-[var(--glass-shadow-control)] outline-none focus-visible:shadow-[0_0_0_3.5px_var(--glass-accent-ring)]"
        onChange={(event) => onChange(event.target.value)}
        title={`Weeks close in ${timezone}`}
        value={value}
      >
        {weeks.map((week) => (
          <option key={week.start} value={week.start}>
            {formatDay(week.start)} – {formatDay(week.end)}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute right-2.5 size-3.5 text-[var(--glass-label-2)]"
      />
    </label>
  );
}

function WelcomeCard() {
  return (
    <div className="glass-card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <GlassTintIcon icon={SparklesIcon} size={56} tint="indigo" />
      <p className="text-[24px] font-bold tracking-[-0.022em]">Bring your team together</p>
      <p className="max-w-md text-[14px] text-[var(--glass-label-2)]">
        Create an organization to invite people, group them into teams and read weekly reports built
        only from what each member chooses to share.
      </p>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="teams-loading">
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

function SectionContent({
  health,
  onNavigate,
  organization,
  section,
  sessionToken,
  userId,
  week,
}: {
  health: { data?: TeamMeasurementHealth; error: unknown; isLoading: boolean };
  onNavigate: (section: TeamSectionId) => void;
  organization: Organization;
  section: Exclude<TeamSectionId, 'create'>;
  sessionToken: null | string;
  userId: string;
  week: { end: string; start: string } | undefined;
}) {
  const orgId = organization.id;
  const timezone = health.error ? undefined : health.data?.report_timezone;
  switch (section) {
    case 'overview': {
      return (
        <>
          <TeamOverviewHero
            health={health.error ? undefined : health.data}
            healthLoading={health.isLoading}
            onNavigate={onNavigate}
            organization={organization}
          />
          <TeamOnboardingPanel key={`setup:${userId}:${orgId}`} organizationId={orgId} />
          <TeamOrganizationRecoveryPanel
            key={`birth:${userId}:${orgId}`}
            organizationId={orgId}
            sessionToken={sessionToken}
            userId={userId}
          />
          <TeamTrustPanel organizationId={orgId} />
          <TeamPrivacyNote />
        </>
      );
    }
    case 'insights': {
      return (
        <QueryState error={health.error} isLoading={health.isLoading}>
          {week && timezone ? (
            <>
              {health.data?.capabilities?.weekly_comparison && (
                <TeamComparisonPanel
                  key={`compare:${userId}:${orgId}`}
                  organizationId={orgId}
                  organizationTimezone={timezone}
                />
              )}
              {health.data?.capabilities?.weekly_summary && (
                <TeamSummaryPanel
                  key={`summary:${userId}:${orgId}`}
                  organizationId={orgId}
                  organizationTimezone={timezone}
                />
              )}
              {health.data?.capabilities?.improvement_actions && (
                <TeamActionsPanel organizationId={orgId} timezone={timezone} />
              )}
              <TeamInsightsPanel
                end={week.end}
                key={`${userId}:${orgId}:${timezone}`}
                organizationId={orgId}
                start={week.start}
                timezone={timezone}
              />
            </>
          ) : (
            <p className="glass-card px-5 py-8 text-center text-[13.5px] text-[var(--glass-label-2)]">
              Reports appear here once the organization has a completed week.
            </p>
          )}
        </QueryState>
      );
    }
    case 'people': {
      return (
        <>
          <OrganizationTeamsPanel organizationId={orgId} />
          <OrganizationInvitesPanel organizationId={orgId} />
        </>
      );
    }
    case 'integrations': {
      return <TeamGithubPanel key={`${userId}:${orgId}`} organizationId={orgId} />;
    }
    default: {
      return <TeamBillingSetupPanel organizationId={orgId} />;
    }
  }
}

export function TeamsWorkspace() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const sessionToken = useWakaclockUserStore((s) => s.token);
  const location = useTeamLocation();

  const organizations = useQuery({
    queryKey: wakaclockKeys.organizations(userId),
    queryFn: listOrganizations,
    enabled: Boolean(userId),
  });
  // A refetch follows an accepted invite or a new organization. Navigation keeps the
  // cached list so the sidebar does not flicker; panels wait for the settled answer.
  const settled = !organizations.isError && !organizations.isFetching;
  const list = organizations.isError ? [] : (organizations.data ?? []);
  const current = list.find((o) => o.id === location.org) ?? list[0];

  const health = useQuery({
    queryKey: wakaclockKeys.teamHealth(userId, current?.id ?? ''),
    queryFn: () => getTeamMeasurementHealth(current?.id ?? ''),
    enabled: Boolean(userId && current),
    retry: false,
    gcTime: 0,
  });
  const timezone = health.isError ? undefined : health.data?.report_timezone;
  const weeks = timezone ? closedWeeks(timezone) : [];
  const [weekChoice, setWeekChoice] = React.useState({ org: '', start: '' });
  const selectedStart = weekChoice.org === current?.id ? weekChoice.start : '';
  const week = weeks.find((w) => w.start === selectedStart) ?? weeks[0];

  const requested = isTeamSection(location.section) ? location.section : null;
  const section: TeamSectionId = current ? (requested ?? 'overview') : 'create';
  const item = teamSection(section);
  const view = !current || requested ? 'detail' : 'list';
  const ready = settled && organizations.isSuccess;

  const goTo = (next: TeamSectionId) =>
    location.navigate({ org: current?.id ?? null, section: next }, 'push');

  let content: React.ReactNode;
  if (organizations.isError) {
    content = (
      <QueryState error={organizations.error} isLoading={false}>
        {null}
      </QueryState>
    );
  } else if (!ready) {
    content = <ShellSkeleton />;
  } else if (section === 'create' || !current) {
    content = (
      <>
        {!current && <WelcomeCard />}
        <TeamOrganizationCreatePanel
          key={`create:${userId}`}
          sessionToken={sessionToken}
          userId={userId}
        />
      </>
    );
  } else {
    content = (
      <SectionContent
        health={health}
        key={`${userId}:${current.id}:${section}`}
        onNavigate={goTo}
        organization={current}
        section={section}
        sessionToken={sessionToken}
        userId={userId}
        week={week}
      />
    );
  }

  return (
    <SettingsShell
      activeId={section}
      banner={<MyOrganizationInvites />}
      description={
        section === 'insights' && timezone
          ? `${item.description} Weeks close in ${timezone}.`
          : item.description
      }
      groups={teamSectionGroups(Boolean(current))}
      header={
        current && (
          <TeamOrgSwitcher
            current={current}
            onCreate={() => goTo('create')}
            onSelect={(id) => location.navigate({ org: id }, 'replace')}
            organizations={list}
          />
        )
      }
      onBack={current ? () => location.navigate({ section: null }, 'push') : undefined}
      onSelect={(id) => goTo(id as TeamSectionId)}
      title={item.label}
      toolbar={
        section === 'insights' &&
        week &&
        timezone && (
          <WeekPicker
            onChange={(start) => setWeekChoice({ org: current?.id ?? '', start })}
            timezone={timezone}
            value={week.start}
            weeks={weeks}
          />
        )
      }
      view={view}
      windowTitle="Teams"
    >
      {content}
    </SettingsShell>
  );
}

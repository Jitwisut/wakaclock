'use client';
import { useIsMutating, useQuery } from '@tanstack/react-query';

import { QueryState } from '@/components/wakaclock/query-state';
import { getGithubConnection } from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getTeamConsent, getTeamMeasurementHealth } from '@/lib/wakaclock/team-endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function TeamOnboardingPanel({ organizationId }: { organizationId: string }) {
  const user = useWakaclockUserStore((s) => s.userId) ?? '';
  const sharing = useIsMutating({ mutationKey: ['team-sharing', user, organizationId] });
  const consent = useQuery({
    queryKey: wakaclockKeys.teamConsent(user, organizationId),
    queryFn: () => getTeamConsent(organizationId),
    enabled: Boolean(user),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const health = useQuery({
    queryKey: wakaclockKeys.teamHealth(user, organizationId),
    queryFn: () => getTeamMeasurementHealth(organizationId),
    enabled: Boolean(user),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const github = useQuery({
    queryKey: wakaclockKeys.teamGithub(user, organizationId),
    queryFn: () => getGithubConnection(organizationId),
    enabled: Boolean(user),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const available =
    !sharing &&
    !consent.isError &&
    !consent.isFetching &&
    !health.isError &&
    !health.isFetching &&
    !github.isError &&
    !github.isFetching;
  return (
    <section aria-label="Team onboarding" className="space-y-2 rounded border p-3">
      <h4>Set up your Team data</h4>
      <p>
        Create teams and invite members below, then install the approved internal client package.
        Each member controls their own sharing.
      </p>
      <QueryState
        error={consent.error ?? health.error ?? github.error}
        isLoading={consent.isLoading || health.isLoading || github.isLoading}
      >
        {available && consent.data && health.data && github.data && (
          <ol className="list-inside list-decimal space-y-1">
            <li>
              Your sharing:{' '}
              {consent.data.share_aggregate ? 'aggregate opt-in active' : 'private by choice'}.
              Individual details: {consent.data.share_individual ? 'opt-in active' : 'private'}.
              Review the sharing preview before opting in.
            </li>
            <li>
              Client evidence: capture {health.data.own.capture.status}; delivery{' '}
              {health.data.own.delivery.status}. An empty queue does not verify complete capture.
            </li>
            <li>
              GitHub identity:{' '}
              {github.data.identity ? 'connected' : 'connect your account in GitHub below'}.{' '}
              {github.data.can_manage
                ? 'Select only approved repositories in GitHub settings below.'
                : 'Ask an administrator to configure selected repositories.'}
            </li>
            <li>
              Sync: {github.data.health.status}. When repository evidence is available, review
              unresolved sessions and confirm links you own.
            </li>
            <li>
              Reports: choose a completed week below. Small groups or unsafe views are withheld; no
              data is not zero. Copilot uses UTC separately.
            </li>
            <li>
              Trust: restore protection {health.data.restore.status}. Resolve missing permissions,
              stale evidence or pending delivery in Trust and GitHub settings.
            </li>
          </ol>
        )}
      </QueryState>
    </section>
  );
}

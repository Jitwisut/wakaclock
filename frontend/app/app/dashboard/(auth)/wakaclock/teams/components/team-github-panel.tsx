'use client';
import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { listOrganizationTeams } from '@/lib/wakaclock/endpoints-v2';
import * as github from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { getTeamWorkReceipt } from '@/lib/wakaclock/team-endpoints';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { CopilotDailyPanel } from './copilot-daily-panel';
import { CopilotWeeklyPanel } from './copilot-weekly-panel';
import { TeamGithubSessions } from './team-github-sessions';

function costText(metric: { reason: null | string; value: null | number }) {
  return metric.value === null
    ? (metric.reason ?? 'unavailable')
    : `$${(metric.value / 1_000_000).toFixed(6)}`;
}

export function TeamGithubPanel({ organizationId }: { organizationId: string }) {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const cache = useQueryClient();
  const key = wakaclockKeys.teamGithub(userId, organizationId);
  const connection = useQuery({
    queryKey: key,
    queryFn: () => github.getGithubConnection(organizationId),
    enabled: Boolean(userId),
    retry: false,
    gcTime: 0,
    refetchInterval: 30_000,
  });
  const visible = connection.isError ? undefined : connection.data;
  const [installation, setInstallation] = React.useState(0);
  const [selected, setSelected] = React.useState<number[]>([]);
  const [project, setProject] = React.useState('');
  const [repository, setRepository] = React.useState('');
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [teamId, setTeamId] = React.useState('');
  const [repositoryTeam, setRepositoryTeam] = React.useState('');
  const [receiptTarget, setReceiptTarget] = React.useState<[string, number] | undefined>();
  const teams = useQuery({
    queryKey: [...key, 'teams', organizationId],
    queryFn: () => listOrganizationTeams(organizationId),
    enabled: Boolean(userId && visible?.configured),
    retry: false,
    gcTime: 0,
  });
  const identities = useQuery({
    queryKey: [...key, 'installations', organizationId],
    queryFn: () => github.getGithubInstallations(organizationId),
    enabled: Boolean(visible?.configured && visible.identity && visible.can_manage),
    retry: false,
    gcTime: 0,
  });
  const choices = useQuery({
    queryKey: [...key, 'choices', installation, organizationId],
    queryFn: () => github.getGithubRepositoryChoices(organizationId, installation),
    enabled: installation > 0 && Boolean(visible?.can_manage),
    retry: false,
    gcTime: 0,
  });
  const projects = useQuery({
    queryKey: [...key, 'projects', organizationId],
    queryFn: () => github.getGithubProjects(organizationId),
    enabled: Boolean(userId && visible?.configured),
    retry: false,
    gcTime: 0,
  });
  const work = useQuery({
    queryKey: [...key, 'work', organizationId, teamId, cursor],
    queryFn: () => github.getGithubWorkPage(organizationId, cursor, teamId || undefined),
    enabled: Boolean(userId && visible?.configured && (visible?.can_manage || teamId)),
    retry: false,
    gcTime: 0,
  });
  const receiptRepository = receiptTarget?.[0] ?? '';
  const receiptItem = receiptTarget?.[1] ?? 0;
  const receipt = useQuery({
    queryKey: [...key, 'receipt', organizationId, teamId, receiptRepository, receiptItem],
    queryFn: () =>
      getTeamWorkReceipt(organizationId, receiptRepository, receiptItem, teamId || undefined),
    enabled: Boolean(receiptTarget && userId && visible?.configured),
    retry: false,
    gcTime: 0,
  });
  const scope = `${userId}:${organizationId}`;
  const scopeRef = React.useRef(scope);
  scopeRef.current = scope;
  const operation = useMutation({
    mutationFn: async ({ run, captured }: { captured: string; run: () => Promise<unknown> }) => {
      await run();
      if (scopeRef.current === captured) await cache.invalidateQueries({ queryKey: key });
    },
  });
  const run = (fn: () => Promise<unknown>) => operation.mutate({ run: fn, captured: scope });
  React.useEffect(() => {
    setInstallation(0);
    setSelected([]);
    setProject('');
    setRepository('');
    setCursor(undefined);
    setTeamId('');
    setRepositoryTeam('');
    setReceiptTarget(undefined);
  }, [scope]);
  React.useEffect(() => {
    if (!visible) return;
    const storage = `github-health:${scope}`;
    const next = `${visible.health.status}:${visible.health.reason}`;
    const old = sessionStorage.getItem(storage);
    if (old && old !== next) toast(`GitHub sync: ${visible.health.status}`);
    sessionStorage.setItem(storage, next);
  }, [visible, scope]);
  return (
    <section aria-label="GitHub connection" className="space-y-3 rounded border p-3">
      <h3 className="font-medium">GitHub</h3>
      <QueryState error={connection.error} isLoading={connection.isLoading}>
        {visible && (
          <div className="space-y-3">
            {!visible.configured ? (
              <p>GitHub App is not configured for this environment.</p>
            ) : (
              <>
                <p>
                  Your GitHub identity: {visible.identity?.login ?? 'Not connected'}. Sharing
                  remains controlled by your consent.
                </p>
                <Button
                  disabled={operation.isPending}
                  onClick={() =>
                    run(async () => {
                      const captured = scope;
                      const result = await github.startGithubAuthorization(organizationId);
                      if (scopeRef.current !== captured) return;
                      const url = new URL(result.authorize_url);
                      if (url.origin !== 'https://github.com') {
                        throw new Error('Invalid authorization URL');
                      }
                      window.location.assign(url.href);
                    })
                  }
                >
                  Connect your GitHub account
                </Button>
                <p>
                  Sync: {visible.health.status} · {visible.health.reason}
                </p>
                <CopilotDailyPanel
                  connection={visible}
                  key={`copilot:${scope}`}
                  organizationId={organizationId}
                />
                {visible.copilot_weekly_reports && (
                  <CopilotWeeklyPanel
                    connection={visible}
                    key={`copilot-weekly:${scope}`}
                    organizationId={organizationId}
                  />
                )}
                {visible.can_manage && (
                  <>
                    {identities.isError && (
                      <p role="alert">
                        Could not load GitHub installations. Reconnect or check your permissions.
                      </p>
                    )}
                    {!identities.isError && identities.data && (
                      <>
                        <a
                          href={identities.data.install_url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Install App on selected repositories
                        </a>
                        <Button onClick={() => void identities.refetch()}>
                          Refresh installations
                        </Button>
                        <select
                          aria-label="GitHub installation"
                          onChange={(e) => {
                            setInstallation(Number(e.target.value));
                            setSelected([]);
                          }}
                          value={installation}
                        >
                          <option value={0}>Choose installation</option>
                          {identities.data.installations
                            .filter((i) => !i.suspended)
                            .map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.account.login}
                              </option>
                            ))}
                        </select>
                      </>
                    )}
                    {choices.isError && <p role="alert">Repository access unavailable.</p>}
                    {!choices.isError &&
                      choices.data?.map((r) => (
                        <label className="block" key={r.id}>
                          <input
                            checked={selected.includes(r.id)}
                            onChange={(e) =>
                              setSelected((old) =>
                                e.target.checked ? [...old, r.id] : old.filter((id) => id !== r.id)
                              )
                            }
                            type="checkbox"
                          />{' '}
                          {r.full_name}
                        </label>
                      ))}
                    <select
                      aria-label="Repository team scope"
                      onChange={(e) => setRepositoryTeam(e.target.value)}
                      value={repositoryTeam}
                    >
                      <option value="">Organization repository scope</option>
                      {!teams.isError &&
                        teams.data?.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      disabled={selected.length === 0 || operation.isPending || choices.isError}
                      onClick={() =>
                        run(() =>
                          github.selectGithubRepositories(
                            organizationId,
                            installation,
                            selected,
                            repositoryTeam || undefined
                          )
                        )
                      }
                    >
                      Connect selected repositories
                    </Button>
                    <Button
                      disabled={operation.isPending}
                      onClick={() => run(() => github.syncGithub(organizationId))}
                    >
                      Resync
                    </Button>
                    <Button
                      disabled={operation.isPending}
                      onClick={() => run(() => github.disconnectGithub(organizationId))}
                    >
                      Disconnect repositories
                    </Button>
                    {visible.repositories.map((r) => (
                      <p key={r.repository_id}>
                        {r.full_name} · {r.enabled ? r.coverage : 'access disabled'} ·{' '}
                        {r.error_code ?? 'no recorded error'}
                      </p>
                    ))}
                  </>
                )}
                {!projects.isError && projects.data && (
                  <div className="space-x-2">
                    <select
                      aria-label="Your project"
                      onChange={(e) => setProject(e.target.value)}
                      value={project}
                    >
                      <option value="">Choose your project</option>
                      {projects.data.projects.map((p) => (
                        <option key={p.project_id} value={p.project_id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Project repository"
                      onChange={(e) => setRepository(e.target.value)}
                      value={repository}
                    >
                      <option value="">Choose repository</option>
                      {projects.data.repositories.map((r) => (
                        <option key={r.repository_id} value={r.repository_id}>
                          {r.full_name}
                        </option>
                      ))}
                    </select>
                    <Button
                      disabled={!project || !repository || operation.isPending}
                      onClick={() =>
                        run(() => github.bindGithubProject(organizationId, project, repository))
                      }
                    >
                      Confirm project mapping
                    </Button>
                  </div>
                )}
                <h4>Selected repository work</h4>
                <select
                  aria-label="Work team scope"
                  onChange={(e) => {
                    setTeamId(e.target.value);
                    setCursor(undefined);
                    setReceiptTarget(undefined);
                  }}
                  value={teamId}
                >
                  <option value="">Choose team or organization scope</option>
                  {!teams.isError &&
                    teams.data?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                {work.isError ? (
                  <p role="alert">Work metadata unavailable. Check repository access and sync.</p>
                ) : (
                  work.data &&
                  !work.isFetching && (
                    <>
                      {work.data.items.map((w) => (
                        <p key={`${w.repository_id}:${w.external_id}`}>
                          <a href={w.url} rel="noopener noreferrer" target="_blank">
                            {w.kind === 'pull_request' ? 'PR' : 'Issue'} #{w.number}
                          </a>{' '}
                          · {w.state} · CI {w.ci.status} · Review wait{' '}
                          {w.review_wait_seconds.value === null
                            ? 'unavailable'
                            : `${w.review_wait_seconds.value}s`}{' '}
                          · Ready to merge{' '}
                          {w.ready_to_merge_seconds.value === null
                            ? 'unavailable'
                            : `${w.ready_to_merge_seconds.value}s`}{' '}
                          · Synced {w.synced_at}{' '}
                          <Button
                            onClick={() => setReceiptTarget([w.repository_id, w.external_id])}
                          >
                            View receipt
                          </Button>
                        </p>
                      ))}
                      <Button disabled={!cursor} onClick={() => setCursor(undefined)}>
                        First page
                      </Button>
                      <Button
                        disabled={!work.data.next}
                        onClick={() => setCursor(work.data?.next ?? undefined)}
                      >
                        Next page
                      </Button>
                      <p>
                        CI shows observed checks for the current commit. Required checks remain
                        unavailable.
                      </p>
                    </>
                  )
                )}
                {receiptTarget &&
                  (receipt.isError ? (
                    <p role="alert">Receipt unavailable. Sharing or access may have changed.</p>
                  ) : (
                    !receipt.isFetching &&
                    receipt.data && (
                      <section aria-label="Work receipt">
                        <h4>Work receipt</h4>
                        <p>
                          Estimated AI cost: {costText(receipt.data.estimated_cost_microusd)} ·{' '}
                          {receipt.data.sharing}
                        </p>
                        {receipt.data.sessions.map((s) => (
                          <p key={s.link_id}>
                            {s.allocation} · {costText(s.cost_microusd)}
                          </p>
                        ))}
                      </section>
                    )
                  ))}
                <TeamGithubSessions key={scope} organizationId={organizationId} />
              </>
            )}
          </div>
        )}
      </QueryState>
      {operation.isError && (
        <p role="alert">
          GitHub action could not finish. Check connection and permissions, then retry.
        </p>
      )}
    </section>
  );
}

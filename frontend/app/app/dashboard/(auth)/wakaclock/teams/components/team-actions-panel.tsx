'use client';
import * as React from 'react';

import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  listOrganizationMembers,
  listOrganizationTeams,
  listTeamMembers,
} from '@/lib/wakaclock/endpoints-v2';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  deleteTeamAction,
  getTeamActionComparison,
  getTeamActionHistory,
  getTeamActions,
  saveTeamAction,
} from '@/lib/wakaclock/team-action-endpoints';
import type { TeamAction, TeamActionEdit } from '@/lib/wakaclock/team-action-types';
import { closedWeeks } from '@/lib/wakaclock/team-weeks';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const focuses = {
  review_flow: 'Reduce review wait',
  tool_evaluation: 'Evaluate a tool',
  measurement_coverage: 'Improve measurement coverage',
  delivery_reliability: 'Improve delivery reliability',
  work_linking: 'Connect activity to work',
};
export function TeamActionsPanel({
  organizationId,
  timezone,
}: {
  organizationId: string;
  timezone: string;
}) {
  const user = useWakaclockUserStore((s) => s.userId);
  return user ? (
    <ActionWorkspace
      key={`${user}:${organizationId}`}
      organizationId={organizationId}
      timezone={timezone}
      user={user}
    />
  ) : null;
}
function ActionWorkspace({
  organizationId: org,
  timezone,
  user,
}: {
  organizationId: string;
  timezone: string;
  user: string;
}) {
  const cache = useQueryClient();
  const [team, setTeam] = React.useState('');
  const [after, setAfter] = React.useState<string>();
  const [history, setHistory] = React.useState<TeamAction>();
  const [comparison, setComparison] = React.useState<TeamAction>();
  const [before, setBefore] = React.useState<number>();
  const [form, setForm] = React.useState<{ edit: TeamActionEdit; id: string }>();
  const [confirmDelete, setConfirmDelete] = React.useState<TeamAction>();
  const [deleteRequest, setDeleteRequest] = React.useState('');
  const key = [...wakaclockKeys.teamGithub(user, org), 'improvement-actions', team];
  const sharing = useIsMutating({ mutationKey: ['team-sharing', user, org] });
  const teams = useQuery({
    queryKey: wakaclockKeys.organizationTeams(user, org),
    queryFn: () => listOrganizationTeams(org),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const page = useQuery({
    queryKey: [...key, org, team, after],
    queryFn: () => getTeamActions(org, team || undefined, after),
    enabled: !sharing,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  });
  const readable =
    !sharing &&
    !page.isError &&
    !page.isFetching &&
    Boolean(page.data) &&
    (!team || (!teams.isError && teams.data?.some((t) => t.id === team)));
  const manage = readable && page.data?.can_manage;
  const members = useQuery({
    queryKey: [...key, 'owners', org, team],
    queryFn: async () => {
      const rows = team ? await listTeamMembers(org, team) : await listOrganizationMembers(org);
      return rows
        .filter((m) => !('deactivated_at' in m) || !m.deactivated_at)
        .map((m) => ({ user_id: m.user_id, username: m.username }));
    },
    enabled: Boolean(manage),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const owners = members.isError || members.isFetching ? [] : (members.data ?? []);
  const historyId = history?.id;
  const historyRevision = history?.revision;
  const past = useQuery({
    queryKey: [...key, 'history', org, team, historyId, historyRevision, before],
    queryFn: () => getTeamActionHistory(org, historyId!, team || undefined, before),
    enabled: readable && Boolean(history),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const comparisonId = comparison?.id;
  const comparisonRevision = comparison?.revision;
  const outcome = useQuery({
    queryKey: [...key, 'comparison', org, team, comparisonId, comparisonRevision],
    queryFn: () => getTeamActionComparison(org, comparisonId!, team || undefined),
    enabled: readable && Boolean(comparisonId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const refresh = () =>
    cache.invalidateQueries({
      queryKey: [...wakaclockKeys.teamGithub(user, org), 'improvement-actions'],
    });
  const save = useMutation({
    mutationFn: (input: { edit: TeamActionEdit; id: string }) =>
      saveTeamAction(org, input.id, team || undefined, input.edit),
    onSuccess: async () => {
      setForm(undefined);
      setHistory(undefined);
      setComparison(undefined);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (input: { action: TeamAction; request: string }) =>
      deleteTeamAction(org, input.action, input.request),
    onSuccess: async () => {
      setConfirmDelete(undefined);
      setHistory(undefined);
      setComparison(undefined);
      await refresh();
    },
  });
  const busy = save.isPending || remove.isPending;
  React.useEffect(() => {
    if (sharing || page.isError || (!page.isFetching && page.data && !page.data.can_manage)) {
      setForm(undefined);
      setConfirmDelete(undefined);
    }
  }, [sharing, page.isError, page.isFetching, page.data]);
  const patch = (edit: Partial<TeamActionEdit>) =>
    setForm((f) => (f ? { ...f, edit: { ...f.edit, ...edit } } : f));
  const fresh = () => {
    const weeks = closedWeeks(timezone);
    setForm({
      id: crypto.randomUUID(),
      edit: {
        request_id: crypto.randomUUID(),
        expected_revision: 0,
        owner_id: owners[0]?.user_id ?? '',
        title: '',
        focus: 'review_flow',
        family: 'team_cost',
        baseline_week: weeks[1]?.start ?? '',
        followup_week: weeks[0]?.start ?? '',
        status: 'planned',
      },
    });
    save.reset();
  };
  const edit = (a: TeamAction) => {
    setForm({
      id: a.id,
      edit: {
        request_id: crypto.randomUUID(),
        expected_revision: a.revision,
        owner_id: a.owner_id,
        title: a.title,
        focus: a.focus,
        family: a.family,
        baseline_week: a.baseline_week,
        followup_week: a.followup_week,
        status: a.status,
      },
    });
    save.reset();
  };
  return (
    <section aria-label="Team improvement actions" className="space-y-3 rounded border p-4">
      <h3 className="font-semibold">Improvement actions</h3>
      <p>
        Track a team change, its owner and comparison weeks. Assignment does not enable sharing of
        personal activity.
      </p>
      <select
        aria-label="Action team"
        disabled={busy}
        onChange={(e) => {
          setTeam(e.target.value);
          setAfter(undefined);
          setForm(undefined);
          setHistory(undefined);
          setComparison(undefined);
          setBefore(undefined);
          setConfirmDelete(undefined);
        }}
        value={team}
      >
        <option value="">Organization</option>
        {!teams.isError &&
          teams.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </select>
      {!readable && (
        <p role="status">
          Actions unavailable while access is being checked. Reload or select an authorized team.
        </p>
      )}
      {readable && (
        <>
          {manage && (
            <button disabled={busy || owners.length === 0} onClick={fresh}>
              New improvement action
            </button>
          )}
          {manage && members.isError && (
            <p>Owner details unavailable. Check team membership before editing.</p>
          )}
          {page.data?.actions.map((a) => (
            <article className="space-y-1 rounded border p-3" key={a.id}>
              <strong>{a.title}</strong>
              <p>
                {a.status} · {a.baseline_week} → {a.followup_week} · {a.timezone}
              </p>
              <p>
                Owner: {owners.find((m) => m.user_id === a.owner_id)?.username ?? 'Assigned member'}{' '}
                · Revision {a.revision}
              </p>
              <button
                onClick={() => {
                  setHistory(a);
                  setBefore(undefined);
                }}
              >
                History
              </button>
              <button onClick={() => setComparison(a)}>Compare weeks</button>
              {manage && (
                <>
                  <button disabled={busy || owners.length === 0} onClick={() => edit(a)}>
                    Edit action
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setConfirmDelete(a);
                      setDeleteRequest(crypto.randomUUID());
                      remove.reset();
                    }}
                  >
                    Delete action
                  </button>
                </>
              )}
            </article>
          ))}
          {!page.data?.actions.length && <p>No readable actions in this scope.</p>}
          {page.data?.next_cursor && (
            <button
              onClick={() => {
                setAfter(page.data?.next_cursor ?? undefined);
                setHistory(undefined);
              }}
            >
              Next actions
            </button>
          )}
          {after && <button onClick={() => setAfter(undefined)}>First actions</button>}
          {manage && form && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (owners.some((m) => m.user_id === form.edit.owner_id)) save.mutate(form);
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Action title
                  <input
                    aria-label="Action title"
                    maxLength={160}
                    onChange={(e) =>
                      patch({ title: e.target.value, request_id: crypto.randomUUID() })
                    }
                    required
                    value={form.edit.title}
                  />
                </label>
                <p>Enter a workflow goal; do not paste source code, prompts or credentials.</p>
                <label>
                  Owner
                  <select
                    aria-label="Action owner"
                    onChange={(e) =>
                      patch({ owner_id: e.target.value, request_id: crypto.randomUUID() })
                    }
                    required
                    value={form.edit.owner_id}
                  >
                    <option value="">Choose owner</option>
                    {owners.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.username}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Focus
                  <select
                    aria-label="Action focus"
                    onChange={(e) =>
                      patch({
                        focus: e.target.value as TeamActionEdit['focus'],
                        request_id: crypto.randomUUID(),
                      })
                    }
                    value={form.edit.focus}
                  >
                    {Object.entries(focuses).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Metric family
                  <select
                    aria-label="Action metric family"
                    onChange={(e) =>
                      patch({
                        family: e.target.value as TeamActionEdit['family'],
                        request_id: crypto.randomUUID(),
                      })
                    }
                    value={form.edit.family}
                  >
                    <option value="team_cost">Team cost · {timezone}</option>
                    <option value="copilot">Copilot counters · UTC</option>
                  </select>
                </label>
                <label>
                  Baseline week
                  <input
                    aria-label="Action baseline week"
                    onChange={(e) =>
                      patch({ baseline_week: e.target.value, request_id: crypto.randomUUID() })
                    }
                    required
                    type="date"
                    value={form.edit.baseline_week}
                  />
                </label>
                <label>
                  Follow-up week
                  <input
                    aria-label="Action follow-up week"
                    onChange={(e) =>
                      patch({ followup_week: e.target.value, request_id: crypto.randomUUID() })
                    }
                    required
                    type="date"
                    value={form.edit.followup_week}
                  />
                </label>
                <p>
                  Choose Monday dates. A future follow-up can be tracked; its report remains
                  unavailable until that week ends.
                </p>
                <label>
                  Status
                  <select
                    aria-label="Action status"
                    onChange={(e) =>
                      patch({
                        status: e.target.value as TeamActionEdit['status'],
                        request_id: crypto.randomUUID(),
                      })
                    }
                    value={form.edit.status}
                  >
                    {['planned', 'active', 'completed', 'cancelled'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                {save.isError && (
                  <p role="alert">
                    Save unconfirmed. Retry the same request, or reload after a revision conflict.
                  </p>
                )}
                <button
                  disabled={busy || !owners.some((m) => m.user_id === form.edit.owner_id)}
                  type="submit"
                >
                  Save action
                </button>
                <button disabled={busy} onClick={() => setForm(undefined)} type="button">
                  Cancel editing
                </button>
              </fieldset>
            </form>
          )}
          {manage && confirmDelete && (
            <div aria-label="Confirm action deletion" role="alertdialog">
              <p>Delete “{confirmDelete.title}”? This identity cannot be reopened.</p>
              <button
                disabled={busy}
                onClick={() => remove.mutate({ action: confirmDelete, request: deleteRequest })}
              >
                Confirm delete
              </button>
              <button disabled={busy} onClick={() => setConfirmDelete(undefined)}>
                Keep action
              </button>
              {remove.isError && <p role="alert">Deletion unconfirmed. Retry or reload.</p>}
            </div>
          )}
          {history && !past.isError && !past.isFetching && past.data && (
            <section aria-label="Action history">
              <h4>Change history</h4>
              {past.data.changes.map((a) => (
                <p key={a.revision}>
                  Revision {a.revision} · {a.title} · {a.status} · {a.updated_at}
                </p>
              ))}
              {past.data.next_revision && (
                <button onClick={() => setBefore(past.data?.next_revision ?? undefined)}>
                  Older changes
                </button>
              )}
              <button onClick={() => setHistory(undefined)}>Close history</button>
            </section>
          )}
          {history && past.isError && (
            <p role="status">
              History unavailable. Current access and revision must be checked again.
            </p>
          )}
          {comparison &&
            (outcome.isError ||
              (!outcome.isFetching && outcome.data?.action_revision !== comparisonRevision)) && (
              <p role="status">
                Comparison unavailable. Reload the action; its follow-up week and current
                privacy/source evidence must be confirmed.
              </p>
            )}
          {comparison &&
          outcome.data &&
            !outcome.isError &&
            !outcome.isFetching &&
            outcome.data?.action_revision === comparisonRevision && (
              <section aria-label="Action comparison">
                <h4>Team comparison for action revision {comparisonRevision}</h4>
                <p>
                  {outcome.data.report.baseline.week_start} →{' '}
                  {outcome.data.report.followup.week_start} ·{' '}
                  {outcome.data.report.baseline.timezone}
                </p>
                <p>
                  These are team metrics, not the owner's personal activity or evidence that AI
                  caused the difference.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Baseline</th>
                      <th>Follow-up</th>
                      <th>Difference</th>
                      <th>Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.data.report.changes.map((c) => (
                      <tr key={c.metric}>
                        <td>
                          {c.metric} · {c.unit}
                        </td>
                        <td>{c.baseline_value ?? 'unavailable'}</td>
                        <td>{c.followup_value ?? 'unavailable'}</td>
                        <td>{c.difference ?? 'unavailable'}</td>
                        <td>
                          {c.baseline_coverage ?? 'unknown'} → {c.followup_coverage ?? 'unknown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => setComparison(undefined)}>Close comparison</button>
              </section>
            )}
        </>
      )}
    </section>
  );
}

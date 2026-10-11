'use client';

import * as React from 'react';
import { SessionRepositoryBinding } from './session-repository-binding';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import * as github from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function TeamGithubSessions({ organizationId }: { organizationId: string }) {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const scope = `${userId}:${organizationId}`;
  const active = React.useRef(scope);
  active.current = scope;
  const cache = useQueryClient();
  const [after, setAfter] = React.useState<string>();
  const [workAfter, setWorkAfter] = React.useState<string>();
  const [target, setTarget] = React.useState('');
  const [historyLink, setHistoryLink] = React.useState('');
  const [historyAfter, setHistoryAfter] = React.useState<string>();
  const [receiptTarget, setReceiptTarget] = React.useState<{ item: number; repository: string }>();
  const [receiptAfter, setReceiptAfter] = React.useState<string>();
  const [relationAfter, setRelationAfter] = React.useState<string>();
  React.useEffect(() => {
    active.current = scope;
    setAfter(undefined);
    setWorkAfter(undefined);
    setTarget('');
    setHistoryLink('');
    setHistoryAfter(undefined);
    setReceiptTarget(undefined);
    setReceiptAfter(undefined);
    setRelationAfter(undefined);
    return () => {
      active.current = '';
    };
  }, [scope]);
  const sessions = useQuery({
    queryKey: wakaclockKeys.teamGithubSessions(userId, organizationId, after),
    queryFn: () => github.getGithubSessions(organizationId, after),
    enabled: Boolean(userId),
    retry: false,
    gcTime: 0,
  });
  const work = useQuery({
    queryKey: wakaclockKeys.teamGithubOwnWork(userId, organizationId, workAfter),
    queryFn: () => github.getGithubOwnWorkPage(organizationId, workAfter),
    enabled: Boolean(userId),
    retry: false,
    gcTime: 0,
  });
  const history = useQuery({
    queryKey: wakaclockKeys.teamGithubHistory(userId, organizationId, historyLink, historyAfter),
    queryFn: () => github.getGithubLinkHistory(organizationId, historyLink, historyAfter),
    enabled: Boolean(userId && historyLink),
    retry: false,
    gcTime: 0,
  });
  const receipt = useQuery({
    queryKey: [
      ...wakaclockKeys.teamGithub(userId, organizationId),
      'own-receipt',
      receiptTarget,
      receiptAfter,
    ],
    queryFn: () =>
      github.getGithubOwnReceipt(
        organizationId,
        receiptTarget!.repository,
        receiptTarget!.item,
        receiptAfter
      ),
    enabled: Boolean(userId && receiptTarget),
    retry: false,
    gcTime: 0,
  });
  const relations = useQuery({
    queryKey: [
      ...wakaclockKeys.teamGithub(userId, organizationId),
      'relationships',
      receiptTarget,
      relationAfter,
    ],
    queryFn: () =>
      github.getGithubRelationships(
        organizationId,
        receiptTarget!.repository,
        receiptTarget!.item,
        relationAfter
      ),
    enabled: Boolean(userId && receiptTarget),
    retry: false,
    gcTime: 0,
  });
  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => {
      const captured = scope;
      await run();
      if (active.current === captured) {
        await cache.invalidateQueries({
          queryKey: wakaclockKeys.teamGithub(userId, organizationId),
        });
      }
    },
  });
  const decide = (
    session: string,
    repo: string,
    item: number,
    status: 'confirmed' | 'rejected'
  ) => {
    const captured = scope;
    action.mutate(async () => {
      const link = await github.proposeGithubLink(organizationId, session, repo, item);
      if (active.current !== captured) return;
      await github.decideGithubLink(organizationId, link.id, status, link.revision);
    });
  };
  const selection = work.data?.items.find((w) => `${w.repository_id}:${w.external_id}` === target);
  const available = !sessions.isError && !sessions.isFetching;
  return (
    <section aria-label="Your work links" className="space-y-3">
      <h4>Your sessions and work links</h4>
      <QueryState error={sessions.error} isLoading={sessions.isLoading}>
        {available && sessions.data && (
          <>
            <p>
              Context capture: {sessions.data.context_health.capture_status} · Pending verification:{' '}
              {sessions.data.context_health.pending} · Dead letter:{' '}
              {sessions.data.context_health.dead_letter}
            </p>
            <Button
              disabled={action.isPending}
              onClick={() => action.mutate(() => github.retryGithubContexts(organizationId))}
            >
              Retry context verification
            </Button>
            <QueryState error={work.error} isLoading={work.isLoading}>
              {!work.isError && !work.isFetching && (
                <>
                  <label>
                    Work to link or replace
                    <select
                      aria-label="Work to link or replace"
                      onChange={(e) => setTarget(e.target.value)}
                      value={target}
                    >
                      <option value="">Choose a PR</option>
                      {work.data?.items
                        .filter((w) => w.kind === 'pull_request')
                        .map((w) => (
                          <option
                            key={`${w.repository_id}:${w.external_id}`}
                            value={`${w.repository_id}:${w.external_id}`}
                          >
                            PR #{w.number} · {w.state}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button
                    onClick={() => {
                      setWorkAfter(undefined);
                      setTarget('');
                    }}
                  >
                    First work page
                  </Button>
                  <Button
                    disabled={!work.data?.next}
                    onClick={() => {
                      setWorkAfter(work.data?.next ?? undefined);
                      setTarget('');
                    }}
                  >
                    Next work page
                  </Button>
                </>
              )}
            </QueryState>
            {sessions.data.items.map((session) => (
              <div className="rounded border p-2" key={session.session_id}>
                <SessionRepositoryBinding
                  organizationId={organizationId}
                  sessionId={session.session_id}
                />
                <p>
                  {session.started_at} – {session.last_event_at} · {session.reason}
                </p>
                {session.candidates.map((candidate) => (
                  <div key={`${candidate.repository_id}:${candidate.external_id}`}>
                    <Button
                      disabled={action.isPending}
                      onClick={() =>
                        decide(
                          session.session_id,
                          candidate.repository_id,
                          candidate.external_id,
                          'confirmed'
                        )
                      }
                    >
                      Confirm candidate PR #{candidate.number}
                    </Button>
                    <Button
                      disabled={action.isPending}
                      onClick={() =>
                        decide(
                          session.session_id,
                          candidate.repository_id,
                          candidate.external_id,
                          'rejected'
                        )
                      }
                    >
                      Reject candidate PR #{candidate.number}
                    </Button>
                  </div>
                ))}
                {session.links.map((link) => (
                  <div key={link.id}>
                    <span>
                      {link.status} · revision {link.revision}
                    </span>
                    <Button
                      disabled={action.isPending || link.status !== 'confirmed'}
                      onClick={() =>
                        action.mutate(() =>
                          github.decideGithubLink(
                            organizationId,
                            link.id,
                            'withdrawn',
                            link.revision
                          )
                        )
                      }
                    >
                      Withdraw link
                    </Button>
                    <Button
                      disabled={
                        action.isPending ||
                        link.status !== 'confirmed' ||
                        !selection ||
                        work.isError ||
                        work.isFetching
                      }
                      onClick={() => {
                        if (selection) {
                          action.mutate(() =>
                            github.replaceGithubLink(
                              organizationId,
                              link,
                              selection.repository_id,
                              selection.external_id
                            )
                          );
                        }
                      }}
                    >
                      Replace with selected PR
                    </Button>
                    <Button
                      onClick={() => {
                        setHistoryLink(link.id);
                        setHistoryAfter(undefined);
                      }}
                    >
                      Link history
                    </Button>
                    <Button
                      onClick={() => {
                        setReceiptTarget({
                          repository: link.repository_id,
                          item: link.work_item_id,
                        });
                        setReceiptAfter(undefined);
                        setRelationAfter(undefined);
                      }}
                    >
                      Your receipt and Issue relations
                    </Button>
                  </div>
                ))}
                {!session.links.some((l) => l.status === 'confirmed') && (
                  <Button
                    disabled={action.isPending || !selection || work.isError || work.isFetching}
                    onClick={() => {
                      if (selection) {
                        decide(
                          session.session_id,
                          selection.repository_id,
                          selection.external_id,
                          'confirmed'
                        );
                      }
                    }}
                  >
                    Confirm selected PR
                  </Button>
                )}
              </div>
            ))}
            {sessions.data.items.length === 0 && (
              <p>
                No consented sessions are available in this scope. This does not prove capture is
                complete.
              </p>
            )}
            <Button onClick={() => setAfter(undefined)}>First session page</Button>
            <Button
              disabled={!sessions.data.next}
              onClick={() => setAfter(sessions.data?.next ?? undefined)}
            >
              Next session page
            </Button>
          </>
        )}
      </QueryState>
      {available && historyLink && (
        <QueryState error={history.error} isLoading={history.isLoading}>
          {!history.isError && !history.isFetching && history.data && (
            <>
              {history.data.items.map((h) => (
                <p key={h.id}>
                  {h.changed_at} · {h.status} · revision {h.revision ?? 'legacy unavailable'}
                </p>
              ))}
              <Button
                disabled={!history.data.next}
                onClick={() => setHistoryAfter(history.data?.next ?? undefined)}
              >
                Next history page
              </Button>
            </>
          )}
        </QueryState>
      )}
      {available && receiptTarget && (
        <>
          <QueryState error={receipt.error} isLoading={receipt.isLoading}>
            {!receipt.isError && !receipt.isFetching && receipt.data && (
              <section aria-label="Your usage receipt">
                <p>
                  Your estimated AI cost:{' '}
                  {receipt.data.estimated_cost_microusd.value === null
                    ? (receipt.data.estimated_cost_microusd.reason ?? 'unavailable')
                    : `$${(receipt.data.estimated_cost_microusd.value / 1_000_000).toFixed(6)}`}{' '}
                  · {receipt.data.sharing}
                </p>
                <p>
                  Usage cutoff: {receipt.data.cost_until ?? 'PR not merged'} ·{' '}
                  {receipt.data.calculation_version} · Coverage:{' '}
                  {receipt.data.estimated_cost_microusd.status}
                </p>
                {receipt.data.sessions.map((s) => (
                  <p key={s.link_id}>
                    {s.allocation} ·{' '}
                    {s.cost_microusd.value === null
                      ? (s.cost_microusd.reason ?? 'unavailable')
                      : `$${(s.cost_microusd.value / 1_000_000).toFixed(6)}`}
                  </p>
                ))}
                <Button
                  disabled={!receipt.data.next}
                  onClick={() => setReceiptAfter(receipt.data?.next ?? undefined)}
                >
                  Next receipt page
                </Button>
              </section>
            )}
          </QueryState>
          <QueryState error={relations.error} isLoading={relations.isLoading}>
            {!relations.isError && !relations.isFetching && relations.data && (
              <section aria-label="Issue relationship history">
                <p>
                  Issue relationships: {relations.data.coverage}. An observed snapshot does not
                  establish a historical start time.
                </p>
                {relations.data.items.map((r) => (
                  <p key={r.event_id}>
                    {r.relationship} · {r.action} · Event: {r.source_at ?? 'unavailable'} ·
                    Observed: {r.observed_at}
                    {r.url && (
                      <a href={r.url} rel="noopener noreferrer" target="_blank">
                        Related Issue
                      </a>
                    )}
                  </p>
                ))}
                <Button
                  disabled={!relations.data.next}
                  onClick={() => setRelationAfter(relations.data?.next ?? undefined)}
                >
                  Next relationship page
                </Button>
              </section>
            )}
          </QueryState>
        </>
      )}
      {action.isError && (
        <p role="alert">
          The work link could not change. Reload to check current sharing, access and revision.
        </p>
      )}
    </section>
  );
}

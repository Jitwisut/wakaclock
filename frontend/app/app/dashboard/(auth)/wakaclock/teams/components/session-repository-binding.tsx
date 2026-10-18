'use client';

import * as React from 'react';

import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import * as github from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function SessionRepositoryBinding({
  organizationId,
  sessionId,
}: {
  organizationId: string;
  sessionId: string;
}) {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  // Remount local form state immediately on identity/scope changes.
  return (
    <BindingForm
      key={`${userId}:${organizationId}:${sessionId}`}
      organizationId={organizationId}
      sessionId={sessionId}
      userId={userId}
    />
  );
}
function BindingForm({
  userId,
  organizationId,
  sessionId,
}: {
  organizationId: string;
  sessionId: string;
  userId: string;
}) {
  const sharingPending =
    useIsMutating({ mutationKey: ['team-sharing', userId, organizationId] }) > 0;
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState('');
  const [before, setBefore] = React.useState<number>();
  const active = React.useRef(true);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const cache = useQueryClient();
  const binding = useQuery({
    queryKey: wakaclockKeys.teamSessionRepository(userId, organizationId, sessionId, before),
    queryFn: () => github.getSessionRepositoryBinding(organizationId, sessionId, before),
    enabled: Boolean(userId && open),
    retry: false,
    gcTime: 0,
    refetchInterval: 15_000,
  });
  const projects = useQuery({
    queryKey: [...wakaclockKeys.teamGithub(userId, organizationId), 'mapping-repositories'],
    queryFn: () => github.getGithubProjects(organizationId),
    enabled: Boolean(userId && open),
    retry: false,
    gcTime: 0,
    refetchInterval: 15_000,
  });
  // Keep an idempotency key across an uncertain response; a changed revision or
  // choice gets a new key. Double click/retry cannot apply a different write.
  const request = React.useRef<{ id: string; key: string } | undefined>(undefined);
  const action = useMutation({
    mutationFn: async (repository: null | string) => {
      if (
        !active.current ||
        sharingPending ||
        !binding.data ||
        binding.isError ||
        binding.isFetching ||
        projects.isError ||
        projects.isFetching
      ) {
        throw new Error('Reload mapping and permissions before confirming');
      }
      const { revision } = binding.data;
      const key = `${revision}:${repository ?? ''}`;
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
      return github.setSessionRepositoryBinding(organizationId, {
        session_id: sessionId,
        repository_id: repository,
        expected_revision: revision,
        request_id: request.current.id,
      });
    },
    onSuccess: async () => {
      if (!active.current) return;
      setTarget('');
      setBefore(undefined);
      await cache.invalidateQueries({ queryKey: wakaclockKeys.teamGithub(userId, organizationId) });
    },
  });
  const available = Boolean(
    binding.data &&
    !sharingPending &&
    !binding.isError &&
    !binding.isFetching &&
    !projects.isError &&
    !projects.isFetching &&
    projects.data
  );
  return (
    <section className="mt-2 rounded border p-2">
      <Button onClick={() => setOpen((value) => !value)}>Repository confirmation</Button>
      {open && (
        <>
          <p>
            User-confirmed context starts at confirmation time. Historical branch/commit and PR
            links remain separate.
          </p>
          <QueryState
            error={binding.error ?? projects.error ?? action.error}
            isLoading={binding.isLoading || projects.isLoading}
          >
            {available && (
              <>
                <p>
                  {binding.data?.current
                    ? `${binding.data.current.provenance} · ${binding.data.current.status} · revision ${binding.data.current.revision} · effective ${binding.data.current.effective_at}`
                    : 'No repository confirmation'}
                </p>
                <label>
                  Repository for this session
                  <select
                    aria-label="Repository for this session"
                    onChange={(event) => setTarget(event.target.value)}
                    value={target}
                  >
                    <option value="">Choose repository</option>
                    {projects.data?.repositories.map((repository) => (
                      <option key={repository.repository_id} value={repository.repository_id}>
                        {repository.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={!target || action.isPending}
                  onClick={() => action.mutate(target)}
                >
                  Confirm repository
                </Button>
                <Button
                  disabled={!binding.data?.current?.repository_id || action.isPending}
                  onClick={() => action.mutate(null)}
                >
                  Remove repository confirmation
                </Button>
                <ol aria-label="Repository confirmation history">
                  {binding.data?.history.map((entry) => (
                    <li key={entry.revision}>
                      Revision {entry.revision} · {entry.provenance} · {entry.status} ·{' '}
                      {entry.effective_at}
                    </li>
                  ))}
                </ol>
                <Button onClick={() => setBefore(undefined)}>Latest history</Button>
                <Button
                  disabled={!binding.data?.next}
                  onClick={() => setBefore(binding.data!.next!)}
                >
                  Older history
                </Button>
              </>
            )}
          </QueryState>
        </>
      )}
    </section>
  );
}

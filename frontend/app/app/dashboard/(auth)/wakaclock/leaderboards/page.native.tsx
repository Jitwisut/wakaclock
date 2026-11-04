'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RequireUser } from '@/components/wakaclock/require-user';
import { RequiresFeature } from '@/components/wakaclock/requires-feature';
import { FieldGroup, Widget } from '@/components/wakaclock/workspace';
import {
  addLeaderboardMember,
  createLeaderboard,
  listLeaderboardMembers,
  listLeaderboards,
  removeLeaderboardMember,
} from '@/lib/wakaclock/endpoints-v2';
import { formatUnixSeconds } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { Leaderboard } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/** Mirrors the validation in services/leaderboards.rs. */
const METRICS = [
  { label: 'All coding time', value: 'time' },
  { label: 'Time typed by hand', value: 'manual_time' },
  { label: 'AI-attributed time', value: 'ai_time' },
  { label: 'Estimated AI spend', value: 'ai_spend' },
] as const;

const PERIODS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
] as const;

function describe(board: Leaderboard): string {
  const metric = METRICS.find((option) => option.value === board.metric)?.label ?? board.metric;
  const period = PERIODS.find((option) => option.value === board.period)?.label ?? board.period;
  return [metric, period, board.language, board.country].filter(Boolean).join(' · ');
}

function MemberList({ board, userId }: { board: Leaderboard; userId: string }) {
  const queryClient = useQueryClient();
  const [memberId, setMemberId] = React.useState('');

  const { data, error, isLoading } = useQuery({
    enabled: Boolean(userId),
    queryFn: () => listLeaderboardMembers(board.id),
    queryKey: wakaclockKeys.leaderboardMembers(userId, board.id),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: wakaclockKeys.leaderboardMembers(userId, board.id),
    });

  const add = useMutation({
    mutationFn: () => addLeaderboardMember(board.id, memberId.trim()),
    onError: (mutationError: Error) => toast.error(mutationError.message),
    onSuccess: () => {
      setMemberId('');
      toast.success('Member added');
      void invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (member: string) => removeLeaderboardMember(board.id, member),
    onError: (mutationError: Error) => toast.error(mutationError.message),
    onSuccess: () => {
      toast.success('Member removed');
      void invalidate();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <QueryState
        emptyDescription="No members yet."
        error={error}
        isEmpty={!isLoading && !error && data?.length === 0}
        isLoading={isLoading}
        skeletonClassName="h-16 w-full"
      >
        <ul aria-label="Members" className="flex flex-col divide-y rounded-lg border">
          {data?.map((member) => (
            <li
              className="flex items-center justify-between gap-2 py-1 pr-1 pl-3 text-sm"
              key={member.user_id}
            >
              <span className="truncate">{member.username}</span>
              <Button
                disabled={remove.isPending}
                onClick={() => remove.mutate(member.user_id)}
                size="sm"
                variant="ghost"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </QueryState>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (memberId.trim()) add.mutate();
        }}
      >
        <div className="grid flex-1 gap-1.5">
          <Label className="text-xs" htmlFor={`member-${board.id}`}>
            Add by user id
          </Label>
          <Input
            id={`member-${board.id}`}
            onChange={(event) => setMemberId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            value={memberId}
          />
        </div>
        <Button disabled={!memberId.trim() || add.isPending} type="submit" variant="outline">
          Add
        </Button>
      </form>
    </div>
  );
}

function LeaderboardForm({ onCreated }: { onCreated: () => void }) {
  const [visibility, setVisibility] = React.useState('private');
  const [metric, setMetric] = React.useState('time');
  const [period, setPeriod] = React.useState('weekly');

  const mutation = useMutation({
    mutationFn: () => createLeaderboard({ metric, period, visibility }),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      toast.success('Leaderboard created');
      onCreated();
    },
  });

  return (
    <form
      aria-labelledby="new-leaderboard-title"
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div>
        <h2 className="text-sm font-semibold tracking-tight" id="new-leaderboard-title">
          New leaderboard
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Members opt in by being added; nobody appears on a board without being a member of it.
        </p>
      </div>

      <FieldGroup legend="Ranking">
        <div className="grid gap-1.5">
          <Label htmlFor="board-metric">Measure</Label>
          <NativeSelect
            id="board-metric"
            onChange={(event) => setMetric(event.target.value)}
            value={metric}
          >
            {METRICS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="board-period">Period</Label>
          <NativeSelect
            id="board-period"
            onChange={(event) => setPeriod(event.target.value)}
            value={period}
          >
            {PERIODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </FieldGroup>

      <FieldGroup footnote="Membership stays opt-in whatever the visibility." legend="Sharing">
        <div className="grid gap-1.5">
          <Label htmlFor="board-visibility">Visibility</Label>
          <NativeSelect
            id="board-visibility"
            onChange={(event) => setVisibility(event.target.value)}
            value={visibility}
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </NativeSelect>
        </div>
      </FieldGroup>

      <Button className="w-full" disabled={mutation.isPending} type="submit">
        {mutation.isPending ? 'Creating…' : 'Create leaderboard'}
      </Button>
    </form>
  );
}

function LeaderboardsPanel() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    enabled: Boolean(userId),
    queryFn: listLeaderboards,
    queryKey: wakaclockKeys.leaderboards(userId),
  });

  const count = data?.length ?? 0;
  const noun = count === 1 ? 'board' : 'boards';

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="leaderboards-list-title" className="flex min-w-0 flex-col gap-3">
        <div className="px-1">
          <h2 className="text-sm font-semibold tracking-tight" id="leaderboards-list-title">
            Your boards
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {count > 0
              ? `${count.toLocaleString()} ${noun} you own or belong to.`
              : 'Boards you own or belong to.'}
          </p>
        </div>
        <QueryState
          emptyDescription="No leaderboards yet. Create one with the New leaderboard form."
          error={error}
          isEmpty={!isLoading && !error && count === 0}
          isLoading={isLoading}
        >
          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            {data?.map((board) => (
              <Widget
                action={
                  <Badge variant={board.visibility === 'public' ? 'default' : 'outline'}>
                    {board.visibility}
                  </Badge>
                }
                description={`Created ${formatUnixSeconds(Date.parse(board.created_at) / 1000)}`}
                key={board.id}
                title={describe(board)}
              >
                <MemberList board={board} userId={userId} />
              </Widget>
            ))}
          </div>
        </QueryState>
      </section>

      <aside
        aria-label="Create a leaderboard"
        className="lg:sticky lg:top-[calc(var(--header-height,56px)+16px)]"
      >
        <LeaderboardForm
          onCreated={() =>
            void queryClient.invalidateQueries({ queryKey: wakaclockKeys.leaderboards(userId) })
          }
        />
      </aside>
    </div>
  );
}

export default function LeaderboardsPage() {
  return (
    <div className="flex flex-col gap-5">
      <WakaclockPageHeader
        description="Private boards among people who have opted in by joining them."
        title="Leaderboards"
      />
      <RequireUser>
        <RequiresFeature feature="Leaderboards" featureKey="private_leaderboards">
          <LeaderboardsPanel />
        </RequiresFeature>
      </RequireUser>
    </div>
  );
}

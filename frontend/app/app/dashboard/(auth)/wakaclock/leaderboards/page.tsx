'use client';

import * as React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RequireUser } from '@/components/wakaclock/require-user';
import { RequiresFeature } from '@/components/wakaclock/requires-feature';
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

function MemberList({ board }: { board: Leaderboard }) {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
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
    <div className="mt-3">
      <QueryState
        emptyDescription="No members yet."
        error={error}
        isEmpty={!isLoading && !error && (data?.length ?? 0) === 0}
        isLoading={isLoading}
        skeletonClassName="h-16 w-full"
      >
        <ul className="mb-3 flex flex-col gap-1.5">
          {data?.map((member) => (
            <li className="flex items-center justify-between gap-2 text-sm" key={member.user_id}>
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
        <Button disabled={!memberId.trim() || add.isPending} size="sm" type="submit">
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
      className="grid gap-4 md:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
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

      <div className="md:col-span-3">
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? 'Creating…' : 'Create leaderboard'}
        </Button>
      </div>
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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New leaderboard</CardTitle>
          <CardDescription>
            Members opt in by being added; nobody appears on a board without being a member of it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardForm
            onCreated={() =>
              void queryClient.invalidateQueries({ queryKey: wakaclockKeys.leaderboards(userId) })
            }
          />
        </CardContent>
      </Card>

      <QueryState
        emptyDescription="No leaderboards yet. Create one above."
        error={error}
        isEmpty={!isLoading && !error && (data?.length ?? 0) === 0}
        isLoading={isLoading}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.map((board) => (
            <Card key={board.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{describe(board)}</CardTitle>
                    <CardDescription>
                      Created {formatUnixSeconds(Date.parse(board.created_at) / 1000)}
                    </CardDescription>
                  </div>
                  <Badge variant={board.visibility === 'public' ? 'default' : 'outline'}>
                    {board.visibility}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <MemberList board={board} />
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryState>
    </div>
  );
}

export default function LeaderboardsPage() {
  return (
    <div className="flex flex-col gap-4">
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

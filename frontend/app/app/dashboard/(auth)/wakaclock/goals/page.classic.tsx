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
import { RequiresPostgres } from '@/components/wakaclock/requires-postgres';
import { getProjects } from '@/lib/wakaclock/endpoints';
import { createGoal, deleteGoal, getGoalProgress, listGoals } from '@/lib/wakaclock/endpoints-v2';
import { daysAgoDateString, formatSeconds, todayDateString } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { Goal } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/** Mirrors `validate_goal` in services/goals.rs — a value not listed there is a 400. */
const METRICS = [
  { label: 'All coding time', value: 'time' },
  { label: 'Time typed by hand', value: 'manual_time' },
  { label: 'AI-attributed time', value: 'ai_time' },
  { label: 'Heartbeats', value: 'heartbeats' },
] as const;

const FILTERS = [
  { label: 'Everything', value: 'all' },
  { label: 'One project', value: 'project' },
  { label: 'One language', value: 'language' },
  { label: 'One editor', value: 'editor' },
  { label: 'One category', value: 'category' },
] as const;

const PERIODS = [
  { label: 'Per day', value: 'daily' },
  { label: 'Per week', value: 'weekly' },
  { label: 'Per month', value: 'monthly' },
] as const;

const DIRECTIONS = [
  { label: 'At least this much', value: 'minimum' },
  { label: 'At most this much', value: 'maximum' },
] as const;

function GoalProgressBar({ goal, userId }: { goal: Goal; userId: string }) {
  const { data, error, isLoading, refetch } = useQuery({
    enabled: Boolean(userId),
    queryFn: () => getGoalProgress(goal.id),
    queryKey: wakaclockKeys.goalProgress(userId, goal.id),
  });

  if (isLoading) {
    return <p className="text-muted-foreground text-xs">Measuring…</p>;
  }

  if (error) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs" role="alert">
        <span>Progress unavailable.</span>
        <Button onClick={() => void refetch()} size="sm" variant="ghost">
          Retry progress
        </Button>
      </div>
    );
  }

  // `coverage` is 0 when no heartbeat fell inside the period. Rendering that as "0% of
  // target" would read as "you did nothing", which is a different claim from "there is
  // nothing to measure yet" — the same distinction the analytics panel makes.
  if (!data || data.coverage === 0) {
    return <p className="text-muted-foreground text-xs">No activity recorded in this period yet</p>;
  }

  const percentage = Math.min(100, Math.max(0, data.percentage));

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">
          {formatSeconds(data.current_seconds)} of {formatSeconds(data.target_seconds)}
        </span>
        <span className="text-muted-foreground">
          {data.on_track ? 'On track' : 'Behind'} · {percentage.toFixed(0)}%
        </span>
      </div>
      {/* Markup borrowed from the RPG xp bar, not the component: that one derives a level
          from all-time seconds, which is a different measurement entirely. */}
      <div
        aria-label={`${goal.name} progress`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(percentage)}
        className="border-border bg-muted h-3 w-full border-2"
        role="progressbar"
      >
        <div
          className="bg-primary h-full transition-[width] duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function GoalForm({ onCreated, userId }: { onCreated: () => void; userId: string }) {
  const [name, setName] = React.useState('');
  const [metric, setMetric] = React.useState<string>('time');
  const [filterKind, setFilterKind] = React.useState<string>('all');
  const [filterValue, setFilterValue] = React.useState('');
  const [period, setPeriod] = React.useState<string>('daily');
  const [direction, setDirection] = React.useState<string>('minimum');
  const [targetHours, setTargetHours] = React.useState('2');

  // A goal filtered to a project name that does not exist measures zero forever and
  // renders as "no activity yet", which is indistinguishable from not having started.
  // Suggesting the names actually present in the data makes that typo hard to make.
  const { data: projects } = useQuery({
    enabled: Boolean(userId) && filterKind === 'project',
    queryFn: () => getProjects(userId, daysAgoDateString(90), todayDateString()),
    queryKey: wakaclockKeys.projects(
      userId,
      daysAgoDateString(90),
      todayDateString(),
      Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
    ),
  });

  const mutation = useMutation({
    mutationFn: () =>
      createGoal({
        direction,
        filter_kind: filterKind,
        filter_value: filterKind === 'all' ? null : filterValue.trim() || null,
        metric,
        name: name.trim(),
        period,
        starts_on: todayDateString(),
        target_seconds: Math.round(Number(targetHours) * 3600),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      setName('');
      setFilterValue('');
      toast.success('Goal created');
      onCreated();
    },
  });

  const targetIsValid = Number(targetHours) > 0 && Number.isFinite(Number(targetHours));
  const canSubmit = name.trim().length > 0 && targetIsValid && !mutation.isPending;

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="goal-name">Name</Label>
        <Input
          id="goal-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Two focused hours"
          value={name}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="goal-target">Target (hours)</Label>
        <Input
          id="goal-target"
          min="0"
          onChange={(event) => setTargetHours(event.target.value)}
          step="0.25"
          type="number"
          value={targetHours}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="goal-metric">Measure</Label>
        <NativeSelect
          id="goal-metric"
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
        <Label htmlFor="goal-period">Period</Label>
        <NativeSelect
          id="goal-period"
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
        <Label htmlFor="goal-direction">Goal is to spend</Label>
        <NativeSelect
          id="goal-direction"
          onChange={(event) => setDirection(event.target.value)}
          value={direction}
        >
          {DIRECTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="goal-filter">Scope</Label>
        <NativeSelect
          id="goal-filter"
          onChange={(event) => setFilterKind(event.target.value)}
          value={filterKind}
        >
          {FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {filterKind !== 'all' && (
        <div className="grid gap-1.5">
          <Label htmlFor="goal-filter-value">Which one</Label>
          <Input
            id="goal-filter-value"
            list={filterKind === 'project' ? 'goal-project-options' : undefined}
            onChange={(event) => setFilterValue(event.target.value)}
            placeholder={filterKind === 'language' ? 'Rust' : 'wakaclock'}
            value={filterValue}
          />
          {filterKind === 'project' && (
            <datalist id="goal-project-options">
              {projects?.data.map((project) => (
                <option key={project.name} value={project.name} />
              ))}
            </datalist>
          )}
        </div>
      )}

      <div className="md:col-span-2">
        <Button disabled={!canSubmit} type="submit">
          {mutation.isPending ? 'Creating…' : 'Create goal'}
        </Button>
      </div>
    </form>
  );
}

function GoalsPanel() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    enabled: Boolean(userId),
    queryFn: listGoals,
    queryKey: wakaclockKeys.goals(userId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: wakaclockKeys.goals(userId) });

  const removal = useMutation({
    mutationFn: deleteGoal,
    onError: (mutationError: Error) => toast.error(mutationError.message),
    onSuccess: () => {
      toast.success('Goal deleted');
      void invalidate();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New goal</CardTitle>
          <CardDescription>
            A goal measures activity you already track — it does not change what is recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoalForm onCreated={() => void invalidate()} userId={userId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your goals</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            emptyDescription="No goals yet. Create one above."
            error={error}
            isEmpty={!isLoading && !error && (data?.length ?? 0) === 0}
            isLoading={isLoading}
          >
            <ul className="flex flex-col gap-4">
              {data?.map((goal) => (
                <li className="border-border border-b pb-4 last:border-b-0 last:pb-0" key={goal.id}>
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{goal.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {METRICS.find((option) => option.value === goal.metric)?.label ??
                          goal.metric}{' '}
                        ·{' '}
                        {PERIODS.find((option) => option.value === goal.period)?.label ??
                          goal.period}
                        {goal.filter_value ? ` · ${goal.filter_value}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{goal.direction}</Badge>
                      <Button
                        disabled={removal.isPending}
                        onClick={() => removal.mutate(goal.id)}
                        size="sm"
                        variant="ghost"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <GoalProgressBar goal={goal} userId={userId} />
                </li>
              ))}
            </ul>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GoalsPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Targets measured against the coding time you already record."
        title="Goals"
      />
      <RequireUser>
        <RequiresPostgres feature="Goals">
          <GoalsPanel />
        </RequiresPostgres>
      </RequireUser>
    </div>
  );
}

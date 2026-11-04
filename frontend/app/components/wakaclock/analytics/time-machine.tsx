'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Pause, Play } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { AnalyticsFilterBar } from '@/components/wakaclock/analytics/analytics-filter-bar';
import { TimeMachineCity } from '@/components/wakaclock/analytics/time-machine-city';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { InspectorLayout } from '@/components/wakaclock/workspace';
import { useAnalyticsFilters } from '@/hooks/use-analytics-filters';
import { useCapabilities } from '@/hooks/use-capabilities';
import { cn } from '@/lib/utils';
import type {
  AnalyticsFilterOptions,
  ReplayEvent,
  ReplayEventsResponse,
  ReplayResponse,
} from '@/lib/wakaclock/analytics';
import { getReplay } from '@/lib/wakaclock/endpoints';
import { listOrganizations } from '@/lib/wakaclock/endpoints-v2';
import { formatDurationShort, formatPercent } from '@/lib/wakaclock/format';
import { getReplayEvents } from '@/lib/wakaclock/github-endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import {
  activeAgentsAt,
  actorGroup,
  aiSessionBands,
  buildActivityTrack,
  buildReplayTimeline,
  eventsForProject,
  formatReplayMoment,
  latestEventAt,
  nextPosition,
  replayEventLabel,
  replayEventMarkers,
  replayEventTone,
  type ReplayRankedItem,
  segmentAt,
  snapshotAt,
  wallTimeAt,
} from '@/lib/wakaclock/replay';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from './time-machine.module.css';

const SPEEDS = [1, 4, 16];
const TRACK_COLUMNS = 120;
const RANKED_ROWS = 6;
const SCRUB_STEPS = 500;
const ACTOR_LABELS = { ai: 'AI', human: 'Human', other: 'Unknown' };
const NO_FILTER_OPTIONS: AnalyticsFilterOptions = {
  categories: [],
  editors: [],
  languages: [],
  operating_systems: [],
  projects: [],
};

function RankedBars({ items, title }: { items: ReplayRankedItem[]; title: string }) {
  const largest = items[0]?.seconds ?? 0;
  return (
    <section aria-label={title} className={styles.ranked}>
      <h3>{title}</h3>
      {items.length === 0 && <p className={styles.note}>Nothing yet.</p>}
      <ol>
        {items.slice(0, RANKED_ROWS).map((item) => (
          <li key={item.key}>
            <span className={styles.rankedName}>{item.name}</span>
            <span className={styles.rankedValue}>{formatDurationShort(item.seconds)}</span>
            <span
              className={styles.rankedBar}
              style={{ width: `${(item.seconds * 100) / largest}%` }}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function aiSessionsNote(status: ReplayResponse['ai_sessions_status']) {
  if (status === 'filtered') {
    return 'AI sessions are hidden while a filter is on, because a session has no proven project or language.';
  }
  return status === 'not_permitted' ? 'This sign-in cannot read AI session details.' : undefined;
}

function githubNote(
  hiddenByFilter: boolean,
  failed: boolean,
  response: ReplayEventsResponse | undefined
) {
  if (hiddenByFilter) {
    return 'GitHub events are hidden while a filter other than Project is on, because they have no language or editor.';
  }
  if (failed) return 'GitHub events are not available for this organization.';
  if (response?.status === 'identity_required') {
    return 'Connect your GitHub account under Teams to see your pull requests.';
  }
  if (response?.unconfirmed_items) {
    return `${response.unconfirmed_items} of your pull requests are still syncing, so some steps may be missing.`;
  }
  return response?.events.length ? 'CI shows the latest result of each check.' : undefined;
}

export function TimeMachinePlayer({
  data,
  events = [],
  githubStatus,
}: {
  data: ReplayResponse;
  events?: ReplayEvent[];
  githubStatus?: string;
}) {
  const timeline = React.useMemo(() => buildReplayTimeline(data.segments), [data.segments]);
  const track = React.useMemo(() => buildActivityTrack(timeline, TRACK_COLUMNS), [timeline]);
  const bands = React.useMemo(
    () => aiSessionBands(timeline, data.ai_sessions),
    [data.ai_sessions, timeline]
  );
  const markers = React.useMemo(() => replayEventMarkers(timeline, events), [events, timeline]);
  const total = timeline.totalSeconds;
  // Opens on the finished picture, which always equals the range total.
  const [position, setPosition] = React.useState(total);
  const [wantsPlay, setWantsPlay] = React.useState(false);
  const [speed, setSpeed] = React.useState(SPEEDS[0]);
  const finished = position >= total;
  const playing = wantsPlay && !finished;

  React.useEffect(() => {
    if (!playing) return undefined;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      const elapsed = now - (previous ?? now);
      previous = now;
      setPosition((current) => nextPosition(current, elapsed, speed, total));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, total]);

  const togglePlayback = () => {
    if (finished) setPosition(0);
    setWantsPlay(finished || !playing);
  };

  const idleLabel = finished ? 'Replay' : 'Play';
  const playLabel = playing ? 'Pause' : idleLabel;
  const snapshot = snapshotAt(timeline, position);
  const segment = segmentAt(timeline, position);
  const wallTime = wallTimeAt(timeline, position);
  const moment = formatReplayMoment(wallTime, data.range.timezone);
  const agents = activeAgentsAt(data.ai_sessions, wallTime);
  const latestEvent = latestEventAt(events, wallTime);
  const note = aiSessionsNote(data.ai_sessions_status);
  const aiShare = snapshot.totalSeconds > 0 ? snapshot.aiSeconds / snapshot.totalSeconds : 0;

  return (
    <section aria-label="Time Machine replay" className={styles.player}>
      <div className={styles.stage}>
        <div>
          <p className={styles.moment}>{moment}</p>
          <p className={styles.current}>
            <span data-actor={actorGroup(segment.actor_type)}>
              {ACTOR_LABELS[actorGroup(segment.actor_type)]}
            </span>
            {[segment.project ?? 'Unknown project', segment.language, segment.branch]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {agents.length > 0 && <p className={styles.note}>AI session: {agents.join(', ')}</p>}
          {latestEvent && (
            <p className={styles.note}>
              Latest on GitHub:{' '}
              <a href={latestEvent.url} rel="noreferrer" target="_blank">
                {replayEventLabel(latestEvent)}
              </a>{' '}
              in {latestEvent.repository}
            </p>
          )}
        </div>
        <dl className={styles.totals}>
          <div>
            <dt>Worked time</dt>
            <dd>{formatDurationShort(snapshot.totalSeconds)}</dd>
          </div>
          <div>
            <dt>Human</dt>
            <dd>{formatDurationShort(snapshot.humanSeconds)}</dd>
          </div>
          <div>
            <dt>AI</dt>
            <dd>{formatDurationShort(snapshot.aiSeconds)}</dd>
          </div>
          <div>
            <dt>Unknown</dt>
            <dd>{formatDurationShort(snapshot.otherSeconds)}</dd>
          </div>
          <div>
            <dt>AI share</dt>
            <dd>{formatPercent(aiShare * 100, 0)}</dd>
          </div>
        </dl>
      </div>

      <div className={styles.timeline}>
        <div aria-hidden="true" className={styles.track}>
          {track.map(({ column, group }) => (
            <span data-actor={group} key={column} />
          ))}
        </div>
        {bands.length > 0 && (
          <div aria-hidden="true" className={styles.bands}>
            {bands.map((band) => (
              <span
                key={band.id}
                style={{ left: `${band.leftPercent}%`, width: `${band.widthPercent}%` }}
                title={band.agent}
              />
            ))}
          </div>
        )}
        {markers.length > 0 && (
          <div aria-label="GitHub events" className={styles.events} role="group">
            {markers.map(({ event, leftPercent, position: eventPosition }) => (
              <a
                aria-label={`${replayEventLabel(event)} in ${event.repository}`}
                data-played={eventPosition <= position}
                data-tone={replayEventTone(event.kind)}
                href={event.url}
                key={event.id}
                rel="noreferrer"
                style={{ left: `${leftPercent}%` }}
                target="_blank"
                title={replayEventLabel(event)}
              />
            ))}
          </div>
        )}
        <input
          aria-label="Replay position"
          aria-valuetext={moment}
          max={total}
          min={0}
          onChange={(event) => {
            setWantsPlay(false);
            setPosition(Number(event.target.value));
          }}
          step={total / SCRUB_STEPS}
          type="range"
          value={position}
        />
      </div>

      <div className={styles.controls}>
        <Button aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback} type="button">
          {playing ? <Pause /> : <Play />}
          {playLabel}
        </Button>
        <div aria-label="Playback speed" className={styles.speeds} role="group">
          {SPEEDS.map((value) => (
            <Button
              aria-pressed={speed === value}
              key={value}
              onClick={() => setSpeed(value)}
              size="sm"
              type="button"
              variant={speed === value ? 'default' : 'outline'}
            >
              {value}x
            </Button>
          ))}
        </div>
        <p className={styles.note}>Skips time with no activity.</p>
      </div>

      <div className={styles.rankedGrid}>
        <RankedBars items={snapshot.projects} title="Projects" />
        <RankedBars items={snapshot.languages} title="Languages" />
      </div>
      <p className={styles.note}>
        Worked time follows the same rules as Analytics, so it includes counted pauses.
        {note && ` ${note}`}
      </p>
      {githubStatus && <p className={styles.note}>{githubStatus}</p>}
    </section>
  );
}

export function TimeMachinePanel() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const { filters, reset, setFilter, setRange, toRequest } = useAnalyticsFilters(7);
  const searchParams = useSearchParams();
  const [view, setView] = React.useState<'city' | 'timeline'>(
    searchParams.get('view') === 'timeline' ? 'timeline' : 'city'
  );
  const { featureAvailability, postgresEnabled } = useCapabilities();
  const disabled = featureAvailability?.time_machine === false;
  const { timezone } = filters;
  const request = toRequest(timezone);
  const { end, start } = request;
  const query = useQuery({
    enabled: Boolean(userId) && !disabled && view === 'timeline',
    queryFn: () => getReplay(request),
    queryKey: [
      ...wakaclockKeys.replay(
        userId,
        request.start,
        request.end,
        timezone,
        request.project_id,
        request.language,
        request.editor,
        request.category,
        request.source,
        request.operating_system,
        request.actor_type
      ),
      request,
    ] as const,
    staleTime: 60_000,
  });

  const [chosenOrganization, setChosenOrganization] = React.useState<string>();
  const organizations = useQuery({
    enabled: Boolean(userId) && !disabled && postgresEnabled === true,
    queryFn: listOrganizations,
    queryKey: wakaclockKeys.organizations(userId),
  });
  const organizationList = organizations.data ?? [];
  const organizationId = chosenOrganization ?? organizationList[0]?.id;
  const hiddenByFilter = Boolean(
    filters.actorType ||
    filters.category ||
    filters.editor ||
    filters.language ||
    filters.operatingSystem ||
    filters.source
  );
  const githubEvents = useQuery({
    enabled: Boolean(organizationId) && !hiddenByFilter,
    queryFn: () => getReplayEvents(organizationId as string, { end, start, timezone }),
    queryKey: wakaclockKeys.replayEvents(userId, organizationId ?? '', start, end, timezone),
    retry: false,
    staleTime: 60_000,
  });
  const visibleEvents = hiddenByFilter
    ? []
    : eventsForProject(githubEvents.data?.events ?? [], filters.projectId);
  const githubStatus =
    organizationId === undefined
      ? undefined
      : githubNote(hiddenByFilter, githubEvents.isError, githubEvents.data);

  if (disabled) {
    return (
      <QueryState
        emptyDescription="Time Machine has not been enabled on this server yet."
        emptyTitle="Time Machine is not available"
        error={null}
        isEmpty
        isLoading={false}
      >
        {null}
      </QueryState>
    );
  }

  const viewPicker = (
    <div
      aria-label="Time Machine view"
      className="bg-muted inline-flex gap-0.5 rounded-lg p-0.5 shadow-[inset_0_0_0_1px_var(--border)]"
      role="group"
    >
      {(['city', 'timeline'] as const).map((value) => (
        <button
          aria-pressed={view === value}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            view === value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          key={value}
          onClick={() => setView(value)}
          type="button"
        >
          {value === 'city' ? 'City' : 'Timeline'}
        </button>
      ))}
    </div>
  );

  if (view === 'city') {
    return (
      <div className="space-y-4">
        {viewPicker}
        <TimeMachineCity events={githubEvents.data?.events} timezone={timezone} />
      </div>
    );
  }

  const activeFilters = [
    filters.projectId,
    filters.language,
    filters.editor,
    filters.category,
    filters.source,
    filters.actorType,
    filters.operatingSystem,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {viewPicker}
        {/* Stays outside QueryState: a refused range must remain fixable from here. */}
        <RangePicker onChange={setRange} value={{ start: filters.start, end: filters.end }} />
      </div>
      <InspectorLayout
        activeCount={activeFilters}
        inspector={
          <div className="flex flex-col gap-3.5">
            <AnalyticsFilterBar
              filters={filters}
              onReset={reset}
              onSetFilter={setFilter}
              options={query.data?.filter_options ?? NO_FILTER_OPTIONS}
            />
            {organizationList.length > 1 && (
              <label className={styles.organization}>
                GitHub organization
                <select
                  onChange={(event) => setChosenOrganization(event.target.value)}
                  value={organizationId}
                >
                  {organizationList.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        }
        inspectorDescription="The replay follows these filters."
        inspectorTitle="Filters"
      >
        <QueryState
          emptyDescription="No activity matches this range and these filters."
          emptyTitle="Nothing to replay"
          error={query.error}
          isEmpty={!query.data?.segments.length}
          isLoading={query.isLoading}
          skeletonClassName="h-96 w-full"
        >
          {query.data && (
            <TimeMachinePlayer
              data={query.data}
              events={visibleEvents}
              githubStatus={githubStatus}
              key={query.data.generated_at}
            />
          )}
        </QueryState>
      </InspectorLayout>
    </div>
  );
}

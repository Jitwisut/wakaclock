'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Pause, Play, Radio } from 'lucide-react';

import {
  chooseTimeQuality,
  readDeviceSignals,
  type TimeSceneQuality,
} from '@/components/marketing/time/time-quality';
import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { Widget } from '@/components/wakaclock/workspace';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useDeliveryHealth } from '@/hooks/use-delivery-health';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import {
  activityColumns,
  agentColour,
  busiestClock,
  formatAgo,
  formatCost,
  formatTokens,
  layoutUniverse,
  LIVE_POLL_MS,
  liveOverlay,
  nextClock,
  rangeReachesToday,
  selectionName,
  topLinks,
  UNIVERSE_LIVE_HOURS,
  universeBounds,
  type UniverseSelection,
  universeStateAt,
  withLive,
} from '@/lib/wakaclock/agent-universe';
import type { AgentLiveResponse, AgentUniverseResponse } from '@/lib/wakaclock/analytics';
import { getAgentLive, getAgentUniverse } from '@/lib/wakaclock/endpoints-v2';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from './agent-universe.module.css';

import type { UniverseScene } from './universe-scene';

const SPEEDS = [1, 3, 8];
const COLUMNS = 180;
const LINKS = 4;
const number = new Intl.NumberFormat('en-US');
const NO_LIVE = { comets: [], heat: new Map<string, number>(), unplaced: 0 };

export interface LiveView {
  /** The range reaches today, so recent activity belongs on this sky. */
  available: boolean;
  data?: AgentLiveResponse;
  enabled: boolean;
  failed: boolean;
  notice?: React.ReactNode;
  onToggle: (enabled: boolean) => void;
}

function moment(clock: number, timezone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'long',
    timeZone: timezone,
  }).format(new Date(clock * 1000));
}

function coverageNote(data: AgentUniverseResponse, liveOn: boolean) {
  const { events, events_with_inferred_project, events_without_project, last_event_at } =
    data.coverage;
  const latest = moment(last_event_at as number, data.range.timezone);
  const parts = [
    liveOn
      ? `Only the latest agent activity is live. The history ends with an event from ${latest}.`
      : `This is history, not live. The latest event is from ${latest}.`,
  ];
  if (events_with_inferred_project) {
    parts.push(
      `${number.format(events_with_inferred_project)} of ${number.format(events)} events have a project that was not explicitly reported.`
    );
  }
  if (events_without_project) {
    parts.push(`${number.format(events_without_project)} events have no project.`);
  }
  return parts.join(' ');
}

function heartbeats(count: number) {
  return `${number.format(count)} ${count === 1 ? 'heartbeat' : 'heartbeats'}`;
}

function liveNotes(live: AgentLiveResponse, unplaced: number) {
  const { future_heartbeats, truncated, unverified_heartbeats } = live.coverage;
  const notes: string[] = [];
  if (unplaced) {
    notes.push(
      `${unplaced} of these are not on this range's sky, so they are listed but not drawn.`
    );
  }
  if (unverified_heartbeats) {
    notes.push(
      `${heartbeats(unverified_heartbeats)} came from agents whose identity is not confirmed, so they are not named.`
    );
  }
  if (future_heartbeats) {
    notes.push(
      `${heartbeats(future_heartbeats)} came from a device clock ahead of the server, so the server's time is shown for them.`
    );
  }
  if (truncated) notes.push(`Only the ${live.activity.length} most recent pairs are shown.`);
  return notes;
}

function LivePanel({
  data,
  live,
  unplaced,
}: {
  data: AgentUniverseResponse;
  live: LiveView;
  unplaced: number;
}) {
  const minutes = live.data ? live.data.window_seconds / 60 : 15;
  return (
    <div aria-live="polite" className={styles.card}>
      <h2>Latest agent activity</h2>
      {!live.data && !live.failed && <p className={styles.note}>Checking for agent activity…</p>}
      {live.data &&
        (live.data.activity.length > 0 ? (
          <ul className={styles.links}>
            {live.data.activity.map((item) => {
              const index = data.agents.findIndex((agent) => agent.name === item.agent);
              return (
                <li key={`${item.agent}:${item.project_key}`}>
                  <span>
                    <span
                      className={styles.dot}
                      style={{ background: agentColour(item.agent, Math.max(index, 0)) }}
                    />
                    {item.agent} on {item.project_name}
                    {item.model && ` · ${item.model}`}
                  </span>
                  <em>
                    {formatAgo((live.data as AgentLiveResponse).server_time - item.last_seen_at)}
                  </em>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.note}>No agent activity in the last {minutes} minutes.</p>
        ))}
      {live.data &&
        liveNotes(live.data, unplaced).map((note) => (
          <p className={styles.note} key={note}>
            {note}
          </p>
        ))}
      {live.failed && (
        <p className={styles.warn}>
          Live data could not be refreshed. {live.data ? 'Showing the last result.' : ''}
        </p>
      )}
      <p className={styles.note}>
        Times come from the reporting device and refresh every {LIVE_POLL_MS / 1000} seconds. A
        device with queued data shows up late.
      </p>
      {live.notice}
    </div>
  );
}

export function UniversePlayer({ data, live }: { data: AgentUniverseResponse; live?: LiveView }) {
  const layout = React.useMemo(() => layoutUniverse(data), [data]);
  const { first, last } = React.useMemo(() => universeBounds(data), [data]);
  const columns = React.useMemo(() => activityColumns(data, COLUMNS), [data]);
  const start = React.useMemo(() => busiestClock(data), [data]);

  const [quality, setQuality] = React.useState<null | TimeSceneQuality>(null);
  const [checked, setChecked] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  React.useEffect(() => {
    const signals = readDeviceSignals();
    setReducedMotion(signals.reducedMotion);
    setQuality(chooseTimeQuality(signals));
    setChecked(true);
  }, []);

  const clockRef = React.useRef(start);
  const [clock, setClock] = React.useState(start);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(SPEEDS[0]);
  const [hidden, setHidden] = React.useState<ReadonlySet<number>>(new Set());
  const [selection, setSelection] = React.useState<null | UniverseSelection>(null);
  const finished = clock >= last;

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const labelsRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<null | UniverseScene>(null);

  const liveOn = Boolean(live?.enabled);
  const liveData = live?.data;
  const overlay = React.useMemo(
    () => (liveData ? liveOverlay(data, liveData) : NO_LIVE),
    [data, liveData]
  );
  const viewAt = React.useCallback(
    (value: number) =>
      liveOn
        ? withLive(universeStateAt(data, last, hidden), overlay, hidden)
        : universeStateAt(data, value, hidden),
    [data, hidden, last, liveOn, overlay]
  );

  const pushView = React.useCallback(
    (value: number) => {
      sceneRef.current?.update({ hidden, playing, selection, state: viewAt(value) });
    },
    [hidden, playing, selection, viewAt]
  );

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!quality || !canvas || !labels) return undefined;
    let cancelled = false;
    let scene: undefined | UniverseScene;
    const load = async () => {
      const { createUniverseScene } = await import('./universe-scene');
      if (cancelled) return;
      scene = createUniverseScene({
        canvas,
        data,
        labels,
        layout,
        maxDpr: quality.maxDpr,
        onSelect: setSelection,
        reducedMotion,
      });
      sceneRef.current = scene;
      pushView(clockRef.current);
    };
    void load();
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
    // The scene is rebuilt for new data only. View changes go through `update`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layout, quality, reducedMotion]);

  React.useEffect(() => pushView(clockRef.current), [pushView]);

  React.useEffect(() => {
    if (!playing || finished) return undefined;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      const elapsed = now - (previous ?? now);
      previous = now;
      const next = nextClock(clockRef.current, elapsed, speed, first, last);
      clockRef.current = next;
      setClock(next);
      pushView(next);
      if (next >= last) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [finished, first, last, playing, pushView, speed]);

  const moveTo = (value: number) => {
    setPlaying(false);
    clockRef.current = value;
    setClock(value);
    pushView(value);
  };
  const togglePlayback = () => {
    if (finished) {
      clockRef.current = first;
      setClock(first);
    }
    setPlaying(finished || !playing);
  };
  const toggleLive = () => {
    setPlaying(false);
    live?.onToggle(!liveOn);
  };
  const toggleAgent = (index: number) => {
    const next = new Set(hidden);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setHidden(next);
    setSelection(null);
  };

  const state = viewAt(clock);
  const liveAgents = new Set(state.live.map((item) => item.agent)).size;
  const idleLabel = finished ? 'Replay' : 'Play';
  const playLabel = playing ? 'Pause' : idleLabel;
  const links = selection ? topLinks(data, state, selection, LINKS) : [];
  const selectedAgent = selection?.kind === 'agent' ? data.agents[selection.index] : null;
  const selectedProject = selection?.kind === 'project' ? data.projects[selection.index] : null;

  return (
    <section aria-label="Agent universe" className={styles.universe}>
      {quality ? (
        <div className={styles.sky}>
          <canvas
            aria-label="Stars are AI agents and planets are projects. Drag to look around."
            className={styles.canvas}
            ref={canvasRef}
          />
          <div aria-hidden="true" className={styles.labels} ref={labelsRef} />
          <div className={styles.hudLeft}>
            <p className={styles.date}>
              {liveOn ? 'Live: latest activity' : moment(clock, data.range.timezone)}
            </p>
          </div>
          <div className={styles.hudRight}>
            {liveOn ? (
              <>
                <strong>{liveAgents}</strong>
                <span>agents drawn from the last 15 minutes</span>
              </>
            ) : (
              <>
                <strong>{new Set(state.live.map((item) => item.session)).size}</strong>
                <span>sessions in the last {UNIVERSE_LIVE_HOURS} hours</span>
              </>
            )}
            <span>
              {formatTokens(state.tokens)} tokens {liveOn ? 'in range' : 'so far'}
            </span>
          </div>
          <div className={styles.zoom}>
            <button aria-label="Zoom in" onClick={() => sceneRef.current?.zoom(0.82)} type="button">
              +
            </button>
            <button
              aria-label="Zoom out"
              onClick={() => sceneRef.current?.zoom(1.22)}
              type="button"
            >
              -
            </button>
          </div>
        </div>
      ) : (
        checked && (
          <p className={styles.note}>
            3D is off on this device, so the agents are shown as the tables below.
          </p>
        )
      )}

      <div className={styles.controls}>
        <div aria-hidden="true" className={styles.strip}>
          {columns.map(({ agent, column, share }) => (
            <span
              key={column}
              style={{
                background:
                  agent === null ? 'transparent' : agentColour(data.agents[agent].name, agent),
                height: `${Math.max(4, share * 100)}%`,
              }}
            />
          ))}
        </div>
        <input
          aria-label="Time in the selected range"
          aria-valuetext={moment(clock, data.range.timezone)}
          className={styles.scrub}
          disabled={liveOn}
          max={last}
          min={first}
          onChange={(event) => moveTo(Number(event.target.value))}
          step={3600}
          type="range"
          value={clock}
        />
        <div className={styles.row}>
          <Button
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={liveOn}
            onClick={togglePlayback}
            type="button"
          >
            {playing ? <Pause /> : <Play />}
            {playLabel}
          </Button>
          {live && (
            <Button
              aria-pressed={liveOn}
              disabled={!live.available}
              onClick={toggleLive}
              title={live.available ? undefined : 'Live needs a range that includes today'}
              type="button"
              variant={liveOn ? 'default' : 'outline'}
            >
              <Radio />
              Live
            </Button>
          )}
          <div
            aria-label="Playback speed"
            className="bg-muted inline-flex gap-0.5 rounded-lg p-0.5 shadow-[inset_0_0_0_1px_var(--border)]"
            role="group"
          >
            {SPEEDS.map((value) => (
              <button
                aria-pressed={speed === value}
                className="text-muted-foreground hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground min-h-8 rounded-md px-3 text-sm font-medium tabular-nums transition-colors aria-pressed:shadow-sm"
                key={value}
                onClick={() => setSpeed(value)}
                type="button"
              >
                {value}x
              </button>
            ))}
          </div>
          <div aria-label="Agents shown" className={styles.group} role="group">
            {data.agents.map((agent, index) => (
              <Button
                aria-pressed={!hidden.has(index)}
                key={agent.name}
                onClick={() => toggleAgent(index)}
                size="sm"
                type="button"
                variant={hidden.has(index) ? 'outline' : 'secondary'}
              >
                <span
                  className={styles.dot}
                  style={{ background: agentColour(agent.name, index) }}
                />
                {agent.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {liveOn && live && <LivePanel data={data} live={live} unplaced={overlay.unplaced} />}

      <div className={styles.below}>
        <Widget
          description="Totals for the whole selected range. Select an agent to see where it worked."
          title="Agents"
        >
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Sessions</th>
                  <th>Tokens</th>
                  <th>Cost</th>
                  <th>Prompts</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((agent, index) => (
                  <tr
                    aria-selected={selection?.kind === 'agent' && selection.index === index}
                    key={agent.name}
                  >
                    <td>
                      <button onClick={() => setSelection({ index, kind: 'agent' })} type="button">
                        <span
                          className={styles.dot}
                          style={{ background: agentColour(agent.name, index) }}
                        />
                        {agent.name}
                      </button>
                    </td>
                    <td>{number.format(agent.sessions)}</td>
                    <td>{formatTokens(agent.tokens)}</td>
                    <td>{formatCost(agent)}</td>
                    <td>
                      {agent.prompts === null ? 'Not reported' : number.format(agent.prompts)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            &ldquo;Not reported&rdquo; means the agent has not sent that value, so it is not zero.
          </p>
        </Widget>
        <Widget
          title={selection ? selectionName(selection, data.agents, data.projects) : 'Details'}
        >
          {selection ? (
            <ul className={styles.links}>
              {selectedAgent?.model && (
                <li>
                  <span>Latest model</span>
                  <em>{selectedAgent.model}</em>
                </li>
              )}
              {selectedProject && (
                <li>
                  <span>Sessions in range</span>
                  <em>{number.format(selectedProject.sessions)}</em>
                </li>
              )}
              {links.map((link) => (
                <li key={link.name}>
                  <span>{link.name}</span>
                  <em>{formatTokens(link.tokens)}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>Select a star or a planet to see who worked there.</p>
          )}
          <p className={styles.note}>{coverageNote(data, liveOn)}</p>
          {data.coverage.projects_total > data.projects.length && (
            <p className={styles.note}>
              Showing the largest projects out of {data.coverage.projects_total}. The rest share one
              planet.
            </p>
          )}
        </Widget>
      </div>
    </section>
  );
}

function LiveDelivery() {
  const health = useDeliveryHealth();
  if (health.state === 'complete' || health.state === 'unknown') return null;
  return <p className={styles.warn}>{health.message}</p>;
}

export function AgentUniversePanel() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const { end, start } = useWakaclockRange(30);
  const { featureAvailability } = useCapabilities();
  const disabled = featureAvailability?.agent_universe === false;
  const [timezone] = React.useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const query = useQuery({
    enabled: Boolean(userId) && !disabled,
    queryFn: () => getAgentUniverse({ end, start, timezone }),
    queryKey: wakaclockKeys.agentUniverse(userId, start, end, timezone),
    staleTime: 60_000,
  });
  const [liveOn, setLiveOn] = React.useState(false);
  const liveAvailable = rangeReachesToday(end, timezone, new Date());
  const liveEnabled = liveOn && liveAvailable;
  const liveQuery = useQuery({
    enabled: Boolean(userId) && !disabled && liveEnabled,
    queryFn: getAgentLive,
    queryKey: wakaclockKeys.agentLive(userId),
    refetchInterval: LIVE_POLL_MS,
    retry: false,
  });

  if (disabled) {
    return (
      <QueryState
        emptyDescription="Agent Universe has not been enabled on this server yet."
        emptyTitle="Agent Universe is not available"
        error={null}
        isEmpty
        isLoading={false}
      >
        {null}
      </QueryState>
    );
  }

  return (
    <QueryState
      emptyDescription="No AI agent sessions were reported in this range."
      emptyTitle="The sky is empty"
      error={query.error}
      isEmpty={!query.data?.agents.length}
      isLoading={query.isLoading}
      skeletonClassName="h-96 w-full"
    >
      {query.data && (
        <UniversePlayer
          data={query.data}
          key={`${start}:${end}`}
          live={{
            available: liveAvailable,
            data: liveQuery.data,
            enabled: liveEnabled,
            failed: Boolean(liveQuery.error),
            notice: liveEnabled && <LiveDelivery />,
            onToggle: setLiveOn,
          }}
        />
      )}
    </QueryState>
  );
}

/** The page's range, in the toolbar; the panel reads the same URL-backed range. */
export function AgentUniverseRange() {
  const { end, setRange, start } = useWakaclockRange(30);
  const { featureAvailability } = useCapabilities();
  if (featureAvailability?.agent_universe === false) return null;
  return <RangePicker onChange={setRange} value={{ end, start }} />;
}

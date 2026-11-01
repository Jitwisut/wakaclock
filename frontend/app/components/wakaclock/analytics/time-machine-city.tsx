'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Pause, Play } from 'lucide-react';

import {
  chooseTimeQuality,
  readDeviceSignals,
  type TimeSceneQuality,
} from '@/components/marketing/time/time-quality';
import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/wakaclock/query-state';
import type {
  ProjectCityModule,
  ProjectCityResponse,
  ReplayEvent,
} from '@/lib/wakaclock/analytics';
import { getProjectAnalytics, getProjectCity } from '@/lib/wakaclock/endpoints';
import { daysAgoDateString, todayDateString } from '@/lib/wakaclock/format';
import {
  busiestModuleOn,
  type CityLayout,
  type CityTower,
  dayIndexOf,
  findShrinks,
  heatColour,
  heatOf,
  languageColour,
  layoutCity,
  moduleStateAt,
  nextCityDay,
  readHiddenAreas,
  storeHiddenAreas,
} from '@/lib/wakaclock/project-city';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { eventsForProject, replayEventLabel, replayEventTone } from '@/lib/wakaclock/replay';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from './time-machine-city.module.css';

import type { CityLens, CityScene } from './city/city-scene';

const SPEEDS = [1, 3, 8];
const TABLE_ROWS = 9;
const PROJECT_LIMIT = 50;
const number = new Intl.NumberFormat('en-US');

interface CityMarker {
  day: number;
  label: string;
  tone: 'failure' | 'neutral' | 'shrink' | 'success';
}

function shortDate(day: string | undefined) {
  if (!day) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${day}T00:00:00Z`));
}

function coverageNote(data: ProjectCityResponse) {
  const { files_ignored, files_included, files_outside_root, files_without_lines } = data.coverage;
  const left = files_ignored + files_outside_root;
  return `${number.format(files_included)} files drawn. ${number.format(left)} skipped as generated or outside the project, ${number.format(files_without_lines)} had no line count. Deleted files stay counted until they are reported again.`;
}

function emptyCityNote(data: ProjectCityResponse | undefined) {
  if (data?.coverage.files_without_lines) {
    return `${number.format(data.coverage.files_without_lines)} files were tracked, but none reported a line count yet.`;
  }
  return 'No source files were recorded for this project yet.';
}

function ModuleRow({
  day,
  layout,
  module,
  onSelect,
  selected,
}: {
  day: number;
  layout: CityLayout;
  module: ProjectCityModule;
  onSelect(path: string): void;
  selected: boolean;
}) {
  const state = moduleStateAt(module, day);
  return (
    <tr aria-selected={selected}>
      <td>
        <button onClick={() => onSelect(module.path)} type="button">
          <span
            className={styles.heat}
            style={{ background: heatColour(heatOf(state.dependencies, layout.maxDependencies)) }}
          />
          {module.path}
        </button>
      </td>
      <td>{number.format(Math.round(state.lines))}</td>
      <td>{state.files}</td>
      <td>{state.dependencies}</td>
    </tr>
  );
}

export function CityPlayer({
  data,
  events = [],
}: {
  data: ProjectCityResponse;
  events?: ReplayEvent[];
}) {
  const projectId = data.project_id;
  const lastDay = Math.max(data.days.length - 1, 0);
  const [hiddenAreas, setHiddenAreas] = React.useState(() => readHiddenAreas(projectId));
  const modules = React.useMemo(
    () => data.modules.filter((module) => !hiddenAreas.has(module.area)),
    [data.modules, hiddenAreas]
  );
  const layout = React.useMemo(() => layoutCity(modules), [modules]);
  const areas = React.useMemo(
    () => [...new Set(data.modules.map((module) => module.area))].sort(),
    [data.modules]
  );

  const markers = React.useMemo(() => {
    const list: CityMarker[] = findShrinks(modules).map((shrink) => ({
      day: shrink.day,
      label: `${shrink.path} lost ${shrink.percent}% of its lines`,
      tone: 'shrink',
    }));
    for (const event of events) {
      const day = dayIndexOf(data.days, event.at, data.timezone);
      if (day >= 0) {
        list.push({ day, label: replayEventLabel(event), tone: replayEventTone(event.kind) });
      }
    }
    return list;
  }, [data.days, data.timezone, events, modules]);

  const [quality, setQuality] = React.useState<null | TimeSceneQuality>(null);
  const [checked, setChecked] = React.useState(false);
  React.useEffect(() => {
    setQuality(chooseTimeQuality(readDeviceSignals()));
    setChecked(true);
  }, []);

  const dayRef = React.useRef(lastDay);
  const [day, setDay] = React.useState(lastDay);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(SPEEDS[0]);
  const [lens, setLens] = React.useState<CityLens>('complexity');
  const [selectedPath, setSelectedPath] = React.useState<null | string>(null);
  const [tip, setTip] = React.useState<{ module: ProjectCityModule; x: number; y: number } | null>(
    null
  );
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<CityScene | null>(null);
  const finished = day >= lastDay;
  const active = playing ? busiestModuleOn(modules, Math.floor(day)) : null;

  const pushView = React.useCallback(
    (value: number) => {
      sceneRef.current?.update({
        activePath: playing ? (busiestModuleOn(modules, Math.floor(value))?.path ?? null) : null,
        day: value,
        lens,
        playing,
        progress: lastDay ? value / lastDay : 1,
        selectedPath,
      });
    },
    [lastDay, lens, modules, playing, selectedPath]
  );

  const showTip = React.useCallback((tower: CityTower | null, event: PointerEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!tower || !rect) {
      setTip(null);
      return;
    }
    setTip({
      module: tower.module,
      x: Math.min(event.clientX - rect.left + 14, rect.width - 270),
      y: Math.max(event.clientY - rect.top - 60, 8),
    });
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!quality || !canvas) return undefined;
    let cancelled = false;
    let scene: CityScene | undefined;
    const load = async () => {
      const { createCityScene } = await import('./city/city-scene');
      if (cancelled) return;
      scene = createCityScene({
        canvas,
        layout,
        maxDpr: quality.maxDpr,
        onHover: showTip,
        onSelect: (tower) => setSelectedPath(tower.module.path),
      });
      sceneRef.current = scene;
      pushView(dayRef.current);
    };
    void load();
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
    // The scene is rebuilt for a new layout only. View changes go through `update`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, quality, showTip]);

  React.useEffect(() => pushView(dayRef.current), [pushView]);

  React.useEffect(() => {
    if (!playing || finished) return undefined;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      const elapsed = now - (previous ?? now);
      previous = now;
      const before = dayRef.current;
      const next = nextCityDay(before, elapsed, speed, lastDay);
      dayRef.current = next;
      if (Math.floor(next) !== Math.floor(before)) {
        const reached = markers.find(
          (marker) => marker.day === Math.floor(next) && marker.tone !== 'neutral'
        );
        if (reached?.tone === 'success' || reached?.tone === 'failure') {
          sceneRef.current?.burst(reached.tone);
        }
        setDay(Math.floor(next));
      }
      pushView(next);
      if (next >= lastDay) {
        setDay(lastDay);
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [finished, lastDay, markers, playing, pushView, speed]);

  const moveTo = (value: number) => {
    setPlaying(false);
    dayRef.current = value;
    setDay(value);
    pushView(value);
  };
  const togglePlayback = () => {
    if (finished) {
      dayRef.current = 0;
      setDay(0);
    }
    setPlaying(finished || !playing);
  };
  const toggleArea = (area: string) => {
    const next = new Set(hiddenAreas);
    if (next.has(area)) next.delete(area);
    else next.add(area);
    storeHiddenAreas(projectId, next);
    setHiddenAreas(next);
    setSelectedPath(null);
  };

  const ranked = modules
    .map((module) => ({ lines: moduleStateAt(module, day).lines, module }))
    .filter((row) => row.lines > 0)
    .sort((left, right) => right.lines - left.lines);
  const totalLines = ranked.reduce((sum, row) => sum + row.lines, 0);
  const selected = modules.find((module) => module.path === selectedPath);
  const marker = markers.find((item) => item.day === day);
  const idleLabel = finished ? 'Replay' : 'Play';
  const playLabel = playing ? 'Pause' : idleLabel;

  return (
    <section aria-label="Project city" className={styles.city}>
      {quality ? (
        <div className={styles.stage} ref={stageRef}>
          <canvas
            aria-label="3D city where each tower is a module. Drag to look around."
            className={styles.canvas}
            key={layout.towers.length}
            ref={canvasRef}
          />
          <div className={styles.hudLeft}>
            <p className={styles.hudDate}>{shortDate(data.days[day])}</p>
            {active && <p className={styles.hudLine}>Most change: {active.path}</p>}
          </div>
          <div className={styles.hudRight}>
            <strong>{number.format(Math.round(totalLines))}</strong>
            <span>lines of code</span>
            <span>{ranked.length} modules</span>
          </div>
          {marker && <p className={styles.hudEvent}>{marker.label}</p>}
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
          {tip && (
            <div className={styles.tip} style={{ left: tip.x, top: tip.y }}>
              <b>{tip.module.path}</b>
              <span>
                {number.format(Math.round(moduleStateAt(tip.module, day).lines))} lines ·{' '}
                {moduleStateAt(tip.module, day).files} files ·{' '}
                {moduleStateAt(tip.module, day).dependencies} dependencies
              </span>
            </div>
          )}
        </div>
      ) : (
        checked && (
          <p className={styles.note}>
            3D is off on this device, so the city is shown as the table below.
          </p>
        )
      )}

      <div className={styles.controls}>
        <div className={styles.track}>
          {markers.map((item) => (
            <i
              data-tone={item.tone}
              key={`${item.day}:${item.label}`}
              style={{ left: `${lastDay ? (item.day * 100) / lastDay : 0}%` }}
              title={item.label}
            />
          ))}
        </div>
        <input
          aria-label="Day in the project"
          aria-valuetext={shortDate(data.days[day])}
          className={styles.scrub}
          max={lastDay}
          min={0}
          onChange={(event) => moveTo(Number(event.target.value))}
          step={1}
          type="range"
          value={day}
        />
        <div className={styles.row}>
          <Button aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback} type="button">
            {playing ? <Pause /> : <Play />}
            {playLabel}
          </Button>
          <div aria-label="Playback speed" className={styles.group} role="group">
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
          <div aria-label="Colour towers by" className={styles.group} role="group">
            {(['complexity', 'language'] as const).map((value) => (
              <Button
                aria-pressed={lens === value}
                key={value}
                onClick={() => setLens(value)}
                size="sm"
                type="button"
                variant={lens === value ? 'default' : 'outline'}
              >
                {value === 'complexity' ? 'Complexity' : 'Language'}
              </Button>
            ))}
          </div>
        </div>
        <div aria-label="Districts shown" className={styles.group} role="group">
          {areas.map((area) => (
            <Button
              aria-pressed={!hiddenAreas.has(area)}
              key={area}
              onClick={() => toggleArea(area)}
              size="sm"
              type="button"
              variant={hiddenAreas.has(area) ? 'outline' : 'secondary'}
            >
              {area}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.below}>
        <div className={styles.card}>
          <h2>Modules</h2>
          <div className={styles.scroll}>
            <table>
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Lines</th>
                  <th>Files</th>
                  <th>Dependencies</th>
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, TABLE_ROWS).map(({ module }) => (
                  <ModuleRow
                    day={day}
                    key={module.path}
                    layout={layout}
                    module={module}
                    onSelect={setSelectedPath}
                    selected={module.path === selectedPath}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.card}>
          <h2>{selected ? `Largest files in ${selected.path}` : 'Inside a module'}</h2>
          {selected ? (
            <ul className={styles.files}>
              {selected.top_files.map((file) => (
                <li key={file.path}>
                  <span>{file.path}</span>
                  <em>{number.format(file.lines)}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>Select a tower to see its largest files.</p>
          )}
          {lens === 'language' && selected && (
            <p className={styles.note}>
              <span
                className={styles.heat}
                style={{ background: languageColour(selected.language) }}
              />
              Mostly {selected.language}
            </p>
          )}
          <p className={styles.note}>
            One floor is {number.format(layout.linesPerFloor)} lines. Width follows the number of
            files. Colour estimates complexity from dependency counts. Line counts come from files
            your editors reported, so they are not an exact count of the repository.
          </p>
          <p className={styles.note}>{coverageNote(data)}</p>
        </div>
      </div>
    </section>
  );
}

export function TimeMachineCity({
  events = [],
  timezone,
}: {
  events?: ReplayEvent[];
  timezone: string;
}) {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const [chosen, setChosen] = React.useState<string>();
  const [end] = React.useState(todayDateString);
  const [start] = React.useState(() => daysAgoDateString(365));
  const projects = useQuery({
    enabled: Boolean(userId),
    queryFn: () =>
      getProjectAnalytics({
        end,
        limit: PROJECT_LIMIT,
        order: 'desc',
        sort: 'duration',
        start,
        timezone,
      }),
    queryKey: [...wakaclockKeys.projectAnalytics(userId, start, end, timezone), 'city'] as const,
    staleTime: 300_000,
  });
  const list = projects.data?.items ?? [];
  const projectId = chosen ?? list[0]?.project_id;
  const city = useQuery({
    enabled: Boolean(projectId),
    queryFn: () => getProjectCity(projectId as string, timezone),
    queryKey: wakaclockKeys.projectCity(userId, projectId ?? '', timezone),
    staleTime: 300_000,
  });

  return (
    <div className={styles.city}>
      {list.length > 0 && (
        <label className={styles.picker}>
          Project
          <select onChange={(event) => setChosen(event.target.value)} value={projectId}>
            {list.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <QueryState
        emptyDescription={
          projectId ? emptyCityNote(city.data) : 'Track a project to start building its city.'
        }
        emptyTitle="Nothing to build yet"
        error={projects.error ?? city.error}
        isEmpty={!city.data?.modules.length}
        isLoading={projects.isLoading || city.isLoading}
        skeletonClassName="h-96 w-full"
      >
        {city.data && (
          <CityPlayer
            data={city.data}
            events={eventsForProject(events, projectId)}
            key={city.data.generated_at}
          />
        )}
      </QueryState>
    </div>
  );
}

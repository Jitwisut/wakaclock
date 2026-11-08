import type { ProjectCityModule, ProjectCityPoint } from './analytics';

/** Towers keep their place as the city plays, so the layout uses each module's largest size. */
const CITY_CELL = 4.8;
const CITY_STREET = 3;
const FLOOR_SIZES = [25, 50, 100, 200, 500, 1000, 2000, 5000];
const MAX_FLOORS = 48;
const SHRINK_SHARE = 0.2;
const SHRINK_MIN_LINES = 100;
const LANGUAGE_COLOURS: Record<string, string> = {
  CSS: '#e0a93f',
  Go: '#35b5c9',
  HTML: '#e2764a',
  JavaScript: '#e3cf57',
  Markdown: '#e6dfcf',
  Python: '#4e8fd1',
  Rust: '#c4583f',
  SQL: '#8f9a94',
  Swift: '#e86d3a',
  TOML: '#a58c6f',
  TSX: '#5a9fd6',
  TypeScript: '#3f82c4',
  YAML: '#9a6fc0',
};
const OTHER_LANGUAGE_COLOUR = '#7f9490';
const HEAT_STOPS = [
  [0x2B, 0xB5, 0xA0],
  [0xE8, 0xC8, 0x4A],
  [0xE0, 0x53, 0x2F],
];

export interface CityTower {
  module: ProjectCityModule;
  short: string;
  x: number;
  z: number;
}

export interface CityDistrict {
  area: string;
  size: number;
  x: number;
  z: number;
}

export interface CityLayout {
  cell: number;
  depth: number;
  districts: CityDistrict[];
  linesPerFloor: number;
  maxDependencies: number;
  towers: CityTower[];
  width: number;
}

export interface CityState {
  dependencies: number;
  files: number;
  lines: number;
}

export interface CityShrink {
  day: number;
  path: string;
  percent: number;
}

function peakLines(module: ProjectCityModule) {
  return Math.max(0, ...module.series.map((point) => point.lines));
}

export function linesPerFloor(largest: number) {
  return FLOOR_SIZES.find((size) => largest / size <= MAX_FLOORS) ?? 10_000;
}

/** Each area is one district, with its tallest towers nearest the middle. */
export function layoutCity(modules: ProjectCityModule[]): CityLayout {
  const areas = [...new Set(modules.map((module) => module.area))]
    .map((area) => {
      const list = modules
        .filter((module) => module.area === area)
        .sort((left, right) => peakLines(right) - peakLines(left));
      const side = Math.ceil(Math.sqrt(list.length));
      return { area, list, side, size: side * CITY_CELL };
    })
    .sort((left, right) => right.size - left.size || left.area.localeCompare(right.area));

  const shelf =
    Math.sqrt(areas.reduce((sum, area) => sum + (area.size + CITY_STREET) ** 2, 0)) * 1.25;
  let cursorX = 0;
  let cursorZ = 0;
  let rowDepth = 0;
  const placed = areas.map((area) => {
    if (cursorX + area.size > shelf && cursorX > 0) {
      cursorX = 0;
      cursorZ += rowDepth + CITY_STREET;
      rowDepth = 0;
    }
    const position = { ...area, x: cursorX, z: cursorZ };
    cursorX += area.size + CITY_STREET;
    rowDepth = Math.max(rowDepth, area.size);
    return position;
  });
  const width = Math.max(0, ...placed.map((area) => area.x + area.size));
  const depth = Math.max(0, ...placed.map((area) => area.z + area.size));

  const towers = placed.flatMap((area) => {
    const centre = (area.side - 1) / 2;
    const cells = Array.from({ length: area.side ** 2 }, (_, index) => [
      Math.floor(index / area.side),
      index % area.side,
    ]).sort(
      (left, right) =>
        Math.hypot(left[0] - centre, left[1] - centre) -
        Math.hypot(right[0] - centre, right[1] - centre)
    );
    return area.list.map((module, index) => ({
      module,
      short: module.path.split('/').slice(1).join('/') || module.path,
      x: area.x - width / 2 + cells[index][0] * CITY_CELL,
      z: area.z - depth / 2 + cells[index][1] * CITY_CELL,
    }));
  });

  return {
    cell: CITY_CELL,
    depth,
    districts: placed.map(({ area, size, x, z }) => ({
      area,
      size,
      x: x - width / 2,
      z: z - depth / 2,
    })),
    linesPerFloor: linesPerFloor(Math.max(0, ...modules.map(peakLines))),
    maxDependencies: Math.max(
      1,
      ...modules.flatMap((module) => module.series.map((point) => point.dependencies))
    ),
    towers,
    width,
  };
}

function pointIndexAt(series: ProjectCityPoint[], day: number) {
  let found = -1;
  for (const [index, point] of series.entries()) {
    if (point.day > day) break;
    found = index;
  }
  return found;
}

/** The state of a module on a day. A fractional day eases toward the next change. */
export function moduleStateAt(module: ProjectCityModule, day: number): CityState {
  const index = pointIndexAt(module.series, day);
  if (index < 0) return { dependencies: 0, files: 0, lines: 0 };
  const point = module.series[index];
  const next = module.series[index + 1];
  const ease = next && next.day <= Math.floor(day) + 1 ? day - Math.floor(day) : 0;
  return {
    dependencies: point.dependencies,
    files: point.files,
    lines: point.lines + (next ? next.lines - point.lines : 0) * ease,
  };
}

export function heatOf(dependencies: number, maxDependencies: number) {
  return Math.min(1, dependencies / maxDependencies);
}

export function heatColour(heat: number) {
  const scaled = Math.max(0, Math.min(1, heat)) * 2;
  const index = Math.min(1, Math.floor(scaled));
  const mix = scaled - index;
  const channels = HEAT_STOPS[index].map((value, channel) =>
    Math.round(value + (HEAT_STOPS[index + 1][channel] - value) * mix)
  );
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function languageColour(language: string) {
  return LANGUAGE_COLOURS[language] ?? OTHER_LANGUAGE_COLOUR;
}

export function towerFootprint(files: number) {
  return files ? 1.3 + Math.min(2.3, Math.sqrt(files) * 0.34) : 0;
}

/** The module that changed the most that day. Only line counts decide this, never time. */
export function busiestModuleOn(modules: ProjectCityModule[], day: number) {
  let busiest: null | ProjectCityModule = null;
  let largest = 0;
  for (const entry of modules) {
    const index = entry.series.findIndex((point) => point.day === day);
    if (index < 0) continue;
    const before = index > 0 ? entry.series[index - 1].lines : 0;
    const change = Math.abs(entry.series[index].lines - before);
    if (change > largest) {
      largest = change;
      busiest = entry;
    }
  }
  return busiest;
}

/** A large drop in lines. The data shows the drop, not why it happened. */
export function findShrinks(modules: ProjectCityModule[]) {
  const shrinks: CityShrink[] = [];
  for (const entry of modules) {
    entry.series.forEach((point, index) => {
      if (index === 0) return;
      const before = entry.series[index - 1].lines;
      const lost = before - point.lines;
      if (lost >= SHRINK_MIN_LINES && lost >= before * SHRINK_SHARE) {
        shrinks.push({
          day: point.day,
          path: entry.path,
          percent: Math.round((lost * 100) / before),
        });
      }
    });
  }
  return shrinks.sort((left, right) => left.day - right.day);
}

/** The last day in the city on or before an event, as a day index. */
export function dayIndexOf(days: string[], epochSeconds: number, timezone: string) {
  const date = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).format(new Date(epochSeconds * 1000));
  let found = -1;
  for (const [index, day] of days.entries()) {
    if (day > date) break;
    found = index;
  }
  return found;
}

export function nextCityDay(day: number, elapsedMs: number, speed: number, lastDay: number) {
  return Math.min(day + (elapsedMs * speed * lastDay) / 30_000, lastDay);
}

export function readHiddenAreas(projectId: string) {
  try {
    const stored = window.localStorage.getItem(`time-machine-city:${projectId}`);
    return new Set<string>(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

export function storeHiddenAreas(projectId: string, areas: Set<string>) {
  try {
    window.localStorage.setItem(`time-machine-city:${projectId}`, JSON.stringify([...areas]));
  } catch {
    // Hiding a district still works for this visit when storage is blocked.
  }
}

import type {
  AgentLiveResponse,
  AgentUniverseResponse,
  UniverseActivity,
  UniverseAgent,
  UniverseProject,
} from './analytics';

const HOUR = 3600;
/** A session counts as recent for this long after its last event hour. */
export const UNIVERSE_LIVE_HOURS = 4;
const AGENT_RING = 8.5;
const PROJECT_RING = 21;
const PLAY_MS = 50_000;
/** How often Live mode asks again. React Query pauses this while the tab is hidden. */
export const LIVE_POLL_MS = 20_000;
const OTHER_KEY = 'other';
const AGENT_COLOURS: Array<[string, string]> = [
  ['claude', '#f0a067'],
  ['codex', '#41d6a6'],
  ['gemini', '#6ea8ff'],
  ['cursor', '#b890ff'],
  ['copilot', '#e6d95a'],
];
const FALLBACK_COLOURS = ['#e77fb3', '#7fd1e6', '#c9e67f', '#e6b07f'];

export type UniversePoint = [number, number, number];

export interface UniverseLayout {
  agents: UniversePoint[];
  projects: UniversePoint[];
}

export interface UniverseState {
  agentTokens: number[];
  edges: Map<string, { sessions: Set<number>; tokens: number }>;
  live: UniverseActivity[];
  liveHeat: Map<string, number>;
  projectTokens: number[];
  sessions: Set<number>;
  tokens: number;
}

export function edgeKey(agent: number, project: number) {
  return `${agent}:${project}`;
}

export function agentColour(name: string, index: number) {
  const lower = name.toLowerCase();
  const known = AGENT_COLOURS.find(([key]) => lower.includes(key));
  return known ? known[1] : FALLBACK_COLOURS[index % FALLBACK_COLOURS.length];
}

/** Agents sit in the middle. Each project goes on the side of the agents that use it most. */
export function layoutUniverse(data: AgentUniverseResponse): UniverseLayout {
  const agents = data.agents.map<UniversePoint>((_, index) => {
    const angle = (index / Math.max(data.agents.length, 1)) * Math.PI * 2 + 0.5;
    return [Math.cos(angle) * AGENT_RING, (index % 2 ? 1 : -1) * 2, Math.sin(angle) * AGENT_RING];
  });
  const pull = data.projects.map(() => [0, 0]);
  for (const item of data.activity) {
    pull[item.project][0] += agents[item.agent][0] * item.tokens;
    pull[item.project][1] += agents[item.agent][2] * item.tokens;
  }
  const order = pull
    .map(([x, z], project) => ({ lean: Math.atan2(z, x), project }))
    .sort((left, right) => left.lean - right.lean || left.project - right.project);
  const projects: UniversePoint[] = data.projects.map(() => [0, 0, 0]);
  order.forEach(({ project }, index) => {
    const angle = (index / order.length) * Math.PI * 2 + order[0].lean;
    projects[project] = [
      Math.cos(angle) * PROJECT_RING,
      ((index % 3) - 1) * 3.5,
      Math.sin(angle) * PROJECT_RING,
    ];
  });
  return { agents, projects };
}

export function universeBounds(data: AgentUniverseResponse) {
  const hours = data.activity.map((item) => item.hour);
  const first = Math.min(...hours);
  return { first, last: Math.max(...hours) + HOUR };
}

/** Everything that has happened by `clock`, leaving out the agents the viewer turned off. */
export function universeStateAt(
  data: AgentUniverseResponse,
  clock: number,
  hidden: ReadonlySet<number> = new Set()
): UniverseState {
  const state: UniverseState = {
    agentTokens: data.agents.map(() => 0),
    edges: new Map(),
    live: [],
    liveHeat: new Map(),
    projectTokens: data.projects.map(() => 0),
    sessions: new Set(),
    tokens: 0,
  };
  for (const item of data.activity) {
    if (item.hour > clock) break;
    if (hidden.has(item.agent)) continue;
    state.agentTokens[item.agent] += item.tokens;
    state.projectTokens[item.project] += item.tokens;
    state.tokens += item.tokens;
    state.sessions.add(item.session);
    const key = edgeKey(item.agent, item.project);
    const edge = state.edges.get(key) ?? { sessions: new Set<number>(), tokens: 0 };
    edge.sessions.add(item.session);
    edge.tokens += item.tokens;
    state.edges.set(key, edge);
    const age = (clock - item.hour) / (UNIVERSE_LIVE_HOURS * HOUR);
    if (age < 1) {
      state.live.push(item);
      state.liveHeat.set(key, Math.max(state.liveHeat.get(key) ?? 0, 1 - age));
    }
  }
  return state;
}

/** The moment with the most recent work, so the first view is not an empty sky. */
export function busiestClock(data: AgentUniverseResponse) {
  const counts = new Map<number, number>();
  for (const item of data.activity) counts.set(item.hour, (counts.get(item.hour) ?? 0) + 1);
  let best = data.activity[0].hour;
  for (const [hour, count] of counts) {
    if (count > (counts.get(best) as number)) best = hour;
  }
  return best;
}

/** Dominant agent per column, sized by how much happened in that slice of the range. */
export function activityColumns(data: AgentUniverseResponse, columns: number) {
  const { first, last } = universeBounds(data);
  const slices = Array.from({ length: columns }, () => new Map<number, number>());
  for (const item of data.activity) {
    const column = Math.min(
      columns - 1,
      Math.floor(((item.hour - first) / (last - first)) * columns)
    );
    slices[column].set(item.agent, (slices[column].get(item.agent) ?? 0) + 1);
  }
  const peak = Math.max(
    ...slices.map((slice) => [...slice.values()].reduce((sum, value) => sum + value, 0))
  );
  return slices.map((slice, column) => {
    const entries = [...slice.entries()].sort((left, right) => right[1] - left[1]);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    return { agent: entries[0]?.[0] ?? null, column, share: total / peak };
  });
}

export function nextClock(
  clock: number,
  elapsedMs: number,
  speed: number,
  first: number,
  last: number
) {
  return Math.min(clock + (elapsedMs * speed * (last - first)) / PLAY_MS, last);
}

export function formatCost(agent: UniverseAgent) {
  if (agent.cost_microusd === null) return 'Not reported';
  const dollars = `$${(agent.cost_microusd / 1_000_000).toFixed(2)}`;
  return agent.cost_status === 'partial' ? `At least ${dollars}` : dollars;
}

export function formatTokens(value: number) {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}K`;
  return String(value);
}

/** The strongest links of an agent or project, largest first. */
export function topLinks(
  data: AgentUniverseResponse,
  state: UniverseState,
  selection: UniverseSelection,
  limit: number
) {
  const links: Array<{ name: string; tokens: number }> = [];
  for (const [key, edge] of state.edges) {
    const [agent, project] = key.split(':').map(Number);
    if (selection.kind === 'agent' && agent === selection.index) {
      links.push({ name: data.projects[project].name, tokens: edge.tokens });
    }
    if (selection.kind === 'project' && project === selection.index) {
      links.push({ name: data.agents[agent].name, tokens: edge.tokens });
    }
  }
  return links.sort((left, right) => right.tokens - left.tokens).slice(0, limit);
}

export interface UniverseSelection {
  index: number;
  kind: 'agent' | 'project';
}

export function selectionName(
  selection: UniverseSelection,
  agents: UniverseAgent[],
  projects: UniverseProject[]
) {
  return selection.kind === 'agent' ? agents[selection.index].name : projects[selection.index].name;
}

/** The live heartbeats drawn on this range's sky, plus how many could not be placed on it. */
export interface LiveOverlay {
  comets: UniverseActivity[];
  heat: Map<string, number>;
  unplaced: number;
}

/**
 * Places each live agent and project on the existing sky. A project folded into the shared
 * "other" planet goes there; an agent or project this range never saw is only listed.
 * Live items get negative session numbers so they never merge with a historical session.
 */
export function liveOverlay(data: AgentUniverseResponse, live: AgentLiveResponse): LiveOverlay {
  const agents = new Map(data.agents.map((agent, index) => [agent.name, index]));
  const projects = new Map<string, number>();
  data.projects.forEach((project, index) => {
    projects.set(project.key, index);
    for (const key of project.folded_keys ?? []) projects.set(key, index);
  });
  const overlay: LiveOverlay = { comets: [], heat: new Map(), unplaced: 0 };
  live.activity.forEach((item, index) => {
    const agent = agents.get(item.agent);
    const project = item.project_key === OTHER_KEY ? undefined : projects.get(item.project_key);
    if (agent === undefined || project === undefined) {
      overlay.unplaced += 1;
      return;
    }
    const key = edgeKey(agent, project);
    const age = (live.server_time - item.last_seen_at) / live.window_seconds;
    overlay.heat.set(key, Math.max(overlay.heat.get(key) ?? 0, Math.max(0.15, 1 - age)));
    overlay.comets.push({
      agent,
      hour: item.last_seen_at,
      project,
      session: -(index + 1),
      tokens: item.heartbeats,
    });
  });
  return overlay;
}

/** History up to the end of the range, with the recent-activity glow replaced by live data. */
export function withLive(
  state: UniverseState,
  overlay: LiveOverlay,
  hidden: ReadonlySet<number>
): UniverseState {
  const comets = overlay.comets.filter((item) => !hidden.has(item.agent));
  const heat = new Map([...overlay.heat].filter(([key]) => !hidden.has(Number(key.split(':')[0]))));
  return { ...state, live: comets, liveHeat: heat };
}

export function formatAgo(seconds: number) {
  if (seconds < 60) return 'just now';
  return `${Math.floor(seconds / 60)} min ago`;
}

/** Live data only makes sense on a range that reaches today. */
export function rangeReachesToday(end: string, timezone: string, now: Date) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  return end >= today;
}

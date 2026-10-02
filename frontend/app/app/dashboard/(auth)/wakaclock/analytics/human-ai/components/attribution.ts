import type {
  AnalyticsActorTypeFilter,
  AnalyticsDurationSplit,
  AnalyticsExplorerResponse,
  AnalyticsFilterOption,
} from '@/lib/wakaclock/analytics';

/**
 * The four actor attributions, in a fixed order so a filter can never repaint a
 * survivor. `inferred` shares the AI hue and is told apart by texture, because it
 * is the same actor at lower certainty — not a separate identity.
 */
export const ACTORS = [
  { field: 'human_seconds', key: 'human', label: 'Human', tone: 'human' },
  { field: 'ai_verified_seconds', key: 'ai_verified', label: 'AI verified', tone: 'ai' },
  { field: 'ai_inferred_seconds', key: 'ai_inferred', label: 'AI inferred', tone: 'inferred' },
  { field: 'unknown_seconds', key: 'unknown', label: 'Unknown', tone: 'unknown' },
] as const satisfies ReadonlyArray<{
  field: keyof AnalyticsDurationSplit;
  key: AnalyticsActorTypeFilter;
  label: string;
  tone: string;
}>;

export type Actor = (typeof ACTORS)[number];
export type ActorKey = Actor['key'];

export interface ActorShare {
  actor: Actor;
  percent: number;
  seconds: number;
}

/** Each actor's seconds and share of the total. Missing fields count as zero. */
export function actorShares(split: AnalyticsDurationSplit): ActorShare[] {
  const total = split.total_seconds;
  return ACTORS.map((actor) => {
    const seconds = split[actor.field] ?? 0;
    return { actor, percent: total > 0 ? (seconds * 100) / total : 0, seconds };
  });
}

export interface DimensionMix {
  key: string;
  name: string;
  seconds: Record<ActorKey, number>;
  total: number;
}

/**
 * Per-item actor mix for one breakdown (projects or categories), built from the
 * unfiltered response plus one actor-filtered response per actor. Returns `null`
 * until every actor response has arrived, so a half-loaded mix is never drawn.
 */
export function dimensionMix(
  items: AnalyticsFilterOption[],
  byActor: Partial<Record<ActorKey, AnalyticsExplorerResponse>>,
  pick: (response: AnalyticsExplorerResponse) => AnalyticsFilterOption[]
): DimensionMix[] | null {
  if (ACTORS.some((actor) => !byActor[actor.key])) return null;
  return items.map((item) => {
    const seconds = Object.fromEntries(
      ACTORS.map((actor) => {
        const response = byActor[actor.key] as AnalyticsExplorerResponse;
        const match = pick(response).find((candidate) => candidate.key === item.key);
        return [actor.key, match?.total_seconds ?? 0];
      })
    ) as Record<ActorKey, number>;
    return { key: item.key, name: item.name, seconds, total: item.total_seconds };
  });
}

/** Share of `total` as a 0–100 number, safe for an empty total. */
export function percentOf(seconds: number, total: number) {
  return total > 0 ? (seconds * 100) / total : 0;
}

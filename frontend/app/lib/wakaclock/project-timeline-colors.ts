export const UNASSIGNED_PROJECT = 'Unassigned';

/** True when a timeline block carries no project (null or blank). */
export function isUnassignedTimelineProject(project: null | string): boolean {
  return !project?.trim();
}

function hashProjectName(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function timelineProjectLabel(project: null | string) {
  const trimmed = project?.trim();
  return trimmed || UNASSIGNED_PROJECT;
}

export function timelineProjectColor(project: null | string) {
  const label = timelineProjectLabel(project);
  if (label === UNASSIGNED_PROJECT) {
    return 'oklch(62% 0.025 250)';
  }

  const hash = hashProjectName(label);
  const hue = hash % 360;
  const chroma = 0.15 + ((hash >>> 9) % 5) * 0.012;
  const lightness = 58 + ((hash >>> 14) % 4) * 3;
  return `oklch(${lightness}% ${chroma.toFixed(3)} ${hue})`;
}

export function orderedTimelineProjects(projects: Array<null | string>) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const project of projects) {
    const label = timelineProjectLabel(project);
    if (seen.has(label)) continue;
    seen.add(label);
    ordered.push(label);
  }

  return ordered;
}

export function timelineProjectTotals(
  entries: Array<{ durationSeconds: number; project: null | string }>,
) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const project = timelineProjectLabel(entry.project);
    totals.set(project, (totals.get(project) ?? 0) + Math.max(0, entry.durationSeconds));
  }

  return totals;
}

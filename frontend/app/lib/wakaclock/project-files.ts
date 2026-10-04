import type { ProjectFileItem } from './types';

/** Older APIs return one row per language, but canonical time is already per entity.
 * Collapse language rows without multiplying that time, and ignore overlapping pages.
 * The entity hash is the identity: sanitized paths can collide across directories.
 */
export function normalizeProjectFiles(rows: ProjectFileItem[]): ProjectFileItem[] {
  const languageRows = new Map<string, ProjectFileItem>();
  for (const row of rows) {
    languageRows.set(JSON.stringify([row.entity_key, row.language]), row);
  }
  const files = new Map<string, ProjectFileItem>();
  for (const row of languageRows.values()) {
    const existing = files.get(row.entity_key);
    if (!existing) {
      files.set(row.entity_key, { ...row });
      continue;
    }
    existing.total_seconds = Math.max(existing.total_seconds, row.total_seconds);
    existing.percentage_of_project = Math.max(
      existing.percentage_of_project,
      row.percentage_of_project
    );
    existing.ai_changes += row.ai_changes;
    existing.ai_verified_changes += row.ai_verified_changes;
    existing.ai_inferred_changes += row.ai_inferred_changes;
    existing.human_changes += row.human_changes;
    existing.unknown_changes = sumKnown(existing.unknown_changes, row.unknown_changes);
    existing.unattributed_changes = sumKnown(
      existing.unattributed_changes,
      row.unattributed_changes
    );
    if (!existing.language || existing.language.toLowerCase() === 'unknown')
      {existing.language = row.language;}
  }
  return [...files.values()];
}

function sumKnown(a: null | number, b: null | number) {
  return a == null || b == null ? null : a + b;
}

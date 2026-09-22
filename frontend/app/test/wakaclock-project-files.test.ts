import { describe, expect, it } from 'vitest';

import { fileFixtures } from '@/.storybook/stories/wakaclock/project-studio.fixtures';
import { normalizeProjectFiles } from '@/lib/wakaclock/project-files';

describe('Project file identity regressions', () => {
  it('merges language variants without counting canonical time twice', () => {
    const known = {
      ...fileFixtures[0],
      total_seconds: 600,
      percentage_of_project: 10,
      ai_changes: 12,
      ai_verified_changes: 10,
      ai_inferred_changes: 2,
      human_changes: 3,
      unknown_changes: 4,
      unattributed_changes: 4,
    };
    const unknown = {
      ...known,
      language: 'Unknown',
      ai_changes: 8,
      ai_verified_changes: 5,
      ai_inferred_changes: 3,
      human_changes: 7,
      unknown_changes: null,
      unattributed_changes: null,
    };
    const result = normalizeProjectFiles([unknown, known]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      language: 'Rust',
      total_seconds: 600,
      percentage_of_project: 10,
      ai_changes: 20,
      ai_verified_changes: 15,
      ai_inferred_changes: 5,
      human_changes: 10,
      unknown_changes: null,
    });
    expect(known.ai_changes).toBe(12);
  });

  it('deduplicates overlapping pages without discarding distinct files with the same sanitized name', () => {
    const first = { ...fileFixtures[0], path: 'main.rs', ai_changes: 12 };
    const other = { ...first, entity_key: 'another-directory-main-rs' };
    const result = normalizeProjectFiles([first, other, first, other]);
    expect(result).toHaveLength(2);
    expect(result.map((file) => file.ai_changes)).toEqual([12, 12]);
  });
});

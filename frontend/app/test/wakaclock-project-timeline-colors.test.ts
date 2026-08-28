import { describe, expect, it } from 'vitest';

import {
  orderedTimelineProjects,
  timelineProjectColor,
  timelineProjectLabel,
  timelineProjectTotals,
} from '@/lib/wakaclock/project-timeline-colors';

describe('project timeline colors', () => {
  it('keeps the same project on the same deterministic color', () => {
    expect(timelineProjectColor('wakaclock')).toBe(timelineProjectColor('wakaclock'));
  });

  it('separates common repo names into distinct project colors', () => {
    const colors = ['wakaclock', 'erp-frontend', 'erp-backend'].map(timelineProjectColor);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('uses one explicit fallback label and color for missing project data', () => {
    expect(timelineProjectLabel(null)).toBe('Unassigned');
    expect(timelineProjectLabel('   ')).toBe('Unassigned');
    expect(timelineProjectColor(null)).toBe(timelineProjectColor('Unassigned'));
  });

  it('keeps project row order stable by first appearance and removes duplicates', () => {
    expect(orderedTimelineProjects(['repo-b', 'repo-a', 'repo-b', null])).toEqual([
      'repo-b',
      'repo-a',
      'Unassigned',
    ]);
  });

  it('aggregates project totals for the row labels', () => {
    const totals = timelineProjectTotals([
      { durationSeconds: 120, project: 'wakaclock' },
      { durationSeconds: 60, project: 'mcp' },
      { durationSeconds: 180, project: 'wakaclock' },
      { durationSeconds: 30, project: null },
    ]);

    expect(totals.get('wakaclock')).toBe(300);
    expect(totals.get('mcp')).toBe(60);
    expect(totals.get('Unassigned')).toBe(30);
  });
});

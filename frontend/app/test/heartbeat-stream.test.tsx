import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { HeartbeatStream } from '@/app/dashboard/(auth)/wakaclock/heartbeats/components/heartbeat-stream';
import { EMPTY_HEARTBEAT_FILTER, type HeartbeatFilter } from '@/lib/wakaclock/heartbeat-stats';
import type { HeartbeatItem } from '@/lib/wakaclock/types';

vi.mock('@/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
function fixture(index: number): HeartbeatItem {
  return {
    active_seconds: null,
    ast_confidence: null,
    ast_language: null,
    cursor_position: null,
    dependencies: [],
    line_number: null,
    lines: null,
    machine: 'test',
    operating_system: 'macOS',
    entity: `src/file-${index}.ts`,
    entity_type: 'file',
    time: new Date(2026, 9, 1, 10, 0, index).getTime() / 1000,
    project: 'Lab',
    branch: 'main',
    language: 'TypeScript',
    category: 'coding',
    editor: 'vscode',
    is_write: index % 2 === 0,
    actor_type: index === 0 ? 'ai_verified' : 'human',
    ai_agent: index === 0 ? 'codex' : null,
  };
}
function setup(rows: HeartbeatItem[], initial = EMPTY_HEARTBEAT_FILTER) {
  const open = vi.fn();
  function Harness() {
    const [filter, setFilter] = useState<HeartbeatFilter>(initial);
    return (
      <HeartbeatStream
        filter={filter}
        onFilterChange={setFilter}
        onOpen={open}
        rows={rows}
        keys={rows.map((_, i) => String(i))}
        freshKeys={new Set(['0'])}
      />
    );
  }
  render(<Harness />);
  return open;
}
it('paginates newest first, preserves the API row index and resets the page on search', () => {
  const open = setup(Array.from({ length: 121 }, (_, i) => fixture(i)));
  expect(screen.getAllByRole('listitem')).toHaveLength(120);
  expect(screen.queryByText('file-0.ts')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Show 1 more/ }));
  expect(screen.getAllByRole('listitem')).toHaveLength(121);
  fireEvent.click(screen.getByText('file-0.ts'));
  expect(open).toHaveBeenCalledWith(0);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'file-120' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('1 of 121 heartbeats match')).toBeVisible();
  fireEvent.click(screen.getByText('Clear all'));
  expect(screen.getAllByRole('listitem')).toHaveLength(120);
});
it('filters writes and AI independently and clears each dimension chip', () => {
  setup([fixture(0), fixture(1)], {
    ...EMPTY_HEARTBEAT_FILTER,
    agent: 'codex',
    project: 'Lab',
    language: 'TypeScript',
    editor: 'vscode',
    hour: 10,
  });
  for (const name of ['Agent: codex', 'Lab', 'TypeScript', 'vscode', '10:00–11:00']) {
    fireEvent.click(screen.getByRole('button', { name: `Remove filter: ${name}` }));
  }
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Writes' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Writes' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI' }));
  expect(screen.getByText('file-0.ts')).toBeVisible();
  expect(screen.queryByText('file-1.ts')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'AI' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});
it('shows an empty result and handles metadata-free rows in separate hours', () => {
  setup([
    {
      ...fixture(0),
      entity: 'root.txt',
      branch: null,
      language: null,
      project: null,
      editor: '',
      ai_agent: null,
      actor_type: 'unknown',
    },
    { ...fixture(1), time: new Date(2026, 9, 1, 11).getTime() / 1000 },
  ]);
  expect(screen.getAllByText('1 heartbeat')).toHaveLength(2);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
  expect(screen.getByText('No heartbeats match these filters.')).toBeVisible();
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompositionCard } from '@/app/dashboard/(auth)/wakaclock/heartbeats/components/composition-card';
import { HeartbeatStream } from '@/app/dashboard/(auth)/wakaclock/heartbeats/components/heartbeat-stream';
import { EMPTY_HEARTBEAT_FILTER, summarizeHeartbeats } from '@/lib/wakaclock/heartbeat-stats';
import type { HeartbeatItem } from '@/lib/wakaclock/types';

const codex: HeartbeatItem = {
  active_seconds: null,
  actor_type: 'ai_verified',
  ai_agent: 'codex',
  ast_confidence: null,
  ast_language: null,
  branch: null,
  category: 'coding',
  cursor_position: null,
  dependencies: [],
  editor: 'vscode',
  entity: '/fixture/file.ts',
  entity_type: 'file',
  is_write: true,
  language: 'TypeScript',
  line_number: null,
  lines: null,
  machine: 'fixture',
  operating_system: 'darwin',
  project: 'fixture',
  time: 1790630000,
};

describe('Heartbeat agent visibility', () => {
  it('lets users find Codex independently from the VS Code editor facet', async () => {
    const onToggle = vi.fn();
    render(
      <CompositionCard
        active={{ agent: null, editor: null, language: null, project: null }}
        onToggle={onToggle}
        summary={summarizeHeartbeats([codex])}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: 'AI agents' }));
    fireEvent.click(screen.getByRole('button', { name: /codex/ }));
    expect(onToggle).toHaveBeenCalledWith('agent', 'codex');
    fireEvent.click(screen.getByRole('tab', { name: 'Editors' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /VS Code/ })).toBeVisible());
  });

  it('shows the Codex badge on narrow screens too and labels the editor separately', () => {
    render(
      <HeartbeatStream
        filter={{ ...EMPTY_HEARTBEAT_FILTER, agent: 'codex' }}
        freshKeys={new Set()}
        keys={['fixture']}
        onFilterChange={vi.fn()}
        onOpen={vi.fn()}
        rows={[codex]}
      />
    );
    const badge = screen.getByText('codex');
    expect(badge).toBeVisible();
    expect(badge.className).not.toMatch(/hidden/);
    expect(screen.getByText('Editor: VS Code')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /editor or agent/ })).toBeVisible();
    expect(screen.getByText('1 of 1 heartbeats match')).toBeVisible();
  });
});

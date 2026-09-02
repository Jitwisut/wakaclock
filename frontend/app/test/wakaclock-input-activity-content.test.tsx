import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardPanelsProvider } from '@/components/dashboard-panels';

vi.mock('@/components/dashboard-panels', () => ({
  DashboardPanel: () => null,
  DashboardPanelsProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      start: '2026-08-30',
      end: '2026-08-30',
      data: {
        total_keystrokes: 0,
        total_chars_added: 25,
        total_chars_deleted: 0,
        total_copy_actions: 1,
        total_paste_actions: 1,
        total_copied_chars: 25,
        total_copied_lines: 2,
        total_pasted_chars: 25,
        total_pasted_lines: 2,
        total_paste_same_file_actions: 0,
        total_paste_same_workspace_actions: 0,
        total_paste_external_or_unknown_actions: 1,
        days_with_activity: 1,
        clipboard_coverage: {
          supported_vscode_heartbeats: 1,
          total_vscode_heartbeats: 1,
          percent: 100,
        },
        projects: [
          {
            name: 'clipboard-only',
            keystrokes: 0,
            chars_added: 25,
            chars_deleted: 0,
            copy_actions: 1,
            paste_actions: 1,
            copied_chars: 25,
            copied_lines: 2,
            pasted_chars: 25,
            pasted_lines: 2,
            paste_same_file_actions: 0,
            paste_same_workspace_actions: 0,
            paste_external_or_unknown_actions: 1,
          },
        ],
        daily: [
          {
            date: '2026-08-30',
            keystrokes: 0,
            chars_added: 25,
            chars_deleted: 0,
            copy_actions: 1,
            paste_actions: 1,
            copied_chars: 25,
            copied_lines: 2,
            pasted_chars: 25,
            pasted_lines: 2,
            paste_same_file_actions: 0,
            paste_same_workspace_actions: 0,
            paste_external_or_unknown_actions: 1,
          },
        ],
      },
    },
    error: null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-wakaclock-range', () => ({
  useWakaclockRange: () => ({ start: '2026-08-30', end: '2026-08-30', setRange: vi.fn() }),
}));

vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (state: { userId: string }) => string) =>
    selector({ userId: 'user-1' }),
}));

import { KeystrokesPanel } from '@/app/dashboard/(auth)/wakaclock/keystrokes/page';

describe('Input Activity content', () => {
  it('renders a Copy/Paste-only range instead of the empty state', () => {
    render(
      <DashboardPanelsProvider>
        <KeystrokesPanel />
      </DashboardPanelsProvider>
    );

    expect(screen.getByText('clipboard-only')).toBeVisible();
    expect(screen.getAllByText('Copy actions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paste actions').length).toBeGreaterThan(0);
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
  });
});

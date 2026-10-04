import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { PulseMonitor } from '@/app/dashboard/(auth)/wakaclock/heartbeats/components/pulse-monitor';
import { summarizeHeartbeats } from '@/lib/wakaclock/heartbeat-stats';
import type { HeartbeatItem } from '@/lib/wakaclock/types';

const state = vi.hoisted(() => ({ reduced: false }));
vi.mock('@/hooks/use-reduced-motion', () => ({ useReducedMotion: () => state.reduced }));
vi.mock('@/app/dashboard/(auth)/wakaclock/heartbeats/components/send-heartbeat-dialog', () => ({
  SendHeartbeatDialog: () => <button>Send test heartbeat</button>,
}));
vi.mock('@/components/ui/custom/count-animation', () => ({
  CountAnimation: ({ value }: { value: number }) => <span>{value}</span>,
}));
afterEach(() => {
  vi.useRealTimers();
  state.reduced = false;
});
const base = {
  beat: 0,
  date: '2026-10-01',
  isToday: false,
  onDateChange: vi.fn(),
  rows: [],
  summary: summarizeHeartbeats([]),
  timezone: null,
  total: 0,
};

it('shows recorded empty data without pretending it is live', () => {
  render(<PulseMonitor {...base} />);
  expect(screen.getByText('Recorded signal')).toBeVisible();
  expect(screen.getAllByText('—')).toHaveLength(2);
  expect(screen.queryByText('Last beat')).not.toBeInTheDocument();
  expect(screen.queryByText('Busiest hour')).not.toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAccessibleName(/Busiest bucket 00:00 with 0 heartbeats/);
});

it('ages the live signal through seconds, minutes and hours and stops its timer on unmount', () => {
  vi.useFakeTimers();
  const now = new Date(2026, 9, 1, 12).getTime();
  vi.setSystemTime(now);
  const summary = { ...base.summary, firstTime: now / 1000, lastTime: now / 1000 };
  const view = render(
    <PulseMonitor {...base} beat={1} isToday summary={summary} timezone="Asia/Bangkok" />
  );
  expect(screen.getByText('Live signal')).toBeVisible();
  expect(screen.getByText('just now')).toBeVisible();
  act(() => vi.advanceTimersByTime(10_000));
  expect(screen.getByText('10s ago')).toBeVisible();
  act(() => vi.advanceTimersByTime(170_000));
  expect(screen.getByText('3m ago')).toBeVisible();
  expect(screen.getByText('Listening')).toBeVisible();
  act(() => {
    vi.setSystemTime(now + 3_600_000);
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByText('1h ago')).toBeVisible();
  const clear = vi.spyOn(window, 'clearInterval');
  view.unmount();
  expect(clear).toHaveBeenCalled();
});

it('shows a quiet current day and renders a single midnight bucket with reduced motion', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 1, 0, 0));
  state.reduced = true;
  render(<PulseMonitor {...base} isToday />);
  expect(screen.getByText('Listening')).toBeVisible();
  expect(screen.getByRole('img').querySelector('path')).toHaveAttribute(
    'd',
    expect.stringMatching(/^M/)
  );
});

it('shows the busiest hour and pointer bucket counts at both chart edges', () => {
  const at = new Date(2026, 9, 1, 0, 1).getTime() / 1000;
  const row = {
    time: at,
    entity: 'fixture',
    entity_type: 'file',
    category: 'coding',
    dependencies: [],
  } as unknown as HeartbeatItem;
  render(<PulseMonitor {...base} rows={[row]} summary={summarizeHeartbeats([row])} total={1} />);
  expect(screen.getByText('Busiest hour')).toBeVisible();
  const chart = screen.getByRole('img');
  vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000 } as DOMRect);
  fireEvent.pointerMove(chart, { clientX: 0 });
  expect(screen.getByText('1 heartbeat')).toBeInTheDocument();
  fireEvent.pointerMove(chart, { clientX: 1000 });
  expect(screen.getByText('0 heartbeats')).toBeInTheDocument();
  fireEvent.pointerLeave(chart);
  expect(screen.queryByText('0 heartbeats')).not.toBeInTheDocument();
});

it('shows the requested day and changes it using local calendar dates', () => {
  const onDateChange = vi.fn();
  render(<PulseMonitor {...base} onDateChange={onDateChange} />);
  fireEvent.click(screen.getByRole('button', { name: /Oct 1, 2026/ }));
  fireEvent.click(screen.getByRole('button', { name: /October 5th, 2026/ }));
  expect(onDateChange).toHaveBeenCalledWith('2026-10-05');
});

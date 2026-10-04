import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { dateKey, useCoworkingHistory } from '@/hooks/use-coworking-history';
import { listCoworkingHistoryV2 } from '@/lib/wakaclock/endpoints-v2';
import { personalPresenceSummary } from '@/lib/wakaclock/office';
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ listCoworkingHistoryV2: vi.fn() }));
vi.mock('@/lib/wakaclock/office', () => ({ personalPresenceSummary: vi.fn() }));
vi.mock('@/lib/wakaclock/presence-client', () => ({ getBrowserTimezone: () => 'Asia/Bangkok' }));
beforeEach(() => {
  vi.mocked(listCoworkingHistoryV2).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(personalPresenceSummary).mockResolvedValue({
    activeDays: 3,
    durationSeconds: 120,
    sessions: 5,
  });
});
it('requests the local day and two disjoint seven-day windows and exposes both summaries', async () => {
  const { result } = renderHook(() => useCoworkingHistory());
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  const today = dateKey(new Date(), 'Asia/Bangkok');
  expect(listCoworkingHistoryV2).toHaveBeenCalledWith({
    from: today,
    to: today,
    timezone: 'Asia/Bangkok',
    limit: 20,
  });
  const windows = vi.mocked(personalPresenceSummary).mock.calls;
  expect(windows).toHaveLength(2);
  expect(windows[0][0].from > windows[1][0].to).toBe(true);
  expect(result.current.weeklySummary).toEqual({
    activeDays: 3,
    durationSeconds: 120,
    sessions: 5,
  });
  expect(result.current.previousSummary).toEqual(result.current.weeklySummary);
  expect(result.current.error).toBeNull();
  expect(dateKey(new Date('2026-10-01T18:00:00Z'), 'Asia/Bangkok')).toBe('2026-10-02');
});
it('does not request disabled history, then loads when enabled', async () => {
  const { result, rerender } = renderHook(({ enabled }) => useCoworkingHistory(enabled), {
    initialProps: { enabled: false },
  });
  await act(() => result.current.reload());
  expect(listCoworkingHistoryV2).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.weeklySummary?.sessions).toBe(5));
});
it('retains the last successful data on an error and clears the error after a successful reload', async () => {
  const { result } = renderHook(() => useCoworkingHistory());
  await waitFor(() => expect(result.current.loading).toBe(false));
  vi.mocked(listCoworkingHistoryV2).mockRejectedValueOnce(new Error('offline'));
  await act(() => result.current.reload());
  expect(result.current.error).toBe('offline');
  expect(result.current.weeklySummary?.sessions).toBe(5);
  vi.mocked(listCoworkingHistoryV2).mockRejectedValueOnce('unavailable');
  await act(() => result.current.reload());
  expect(result.current.error).toBe('History is unavailable');
  await act(() => result.current.reload());
  expect(result.current.error).toBeNull();
});

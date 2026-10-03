import { expect, it, vi } from 'vitest';

import { wakaclockV2Client } from '@/lib/wakaclock/client-v2';
import { getEffectiveness } from '@/lib/wakaclock/work-sessions';

vi.mock('@/lib/wakaclock/client-v2', () => ({
  wakaclockV2Client: { get: vi.fn() },
  unwrapV2: (response: { data: { data: unknown } }) => response.data.data,
}));

it('sends the requested local day timezone and preserves UTC for existing callers', async () => {
  const result = { metrics_v2: { ai_line_share: null }, stats: {} };
  vi.mocked(wakaclockV2Client.get).mockResolvedValue({ data: { data: result } });
  expect(await getEffectiveness('2026-09-30', '2026-09-30', 'Asia/Bangkok')).toBe(result);
  expect(wakaclockV2Client.get).toHaveBeenLastCalledWith('/me/ai/effectiveness', {
    params: { start: '2026-09-30', end: '2026-09-30', timezone: 'Asia/Bangkok' },
  });
  await getEffectiveness('2026-09-30', '2026-09-30');
  expect(wakaclockV2Client.get).toHaveBeenLastCalledWith('/me/ai/effectiveness', {
    params: { start: '2026-09-30', end: '2026-09-30', timezone: 'UTC' },
  });
});

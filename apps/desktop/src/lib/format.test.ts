import { describe, expect, it } from 'vitest';
import { formatDuration } from './format';

describe('formatDuration', () => {
  it('formats hour and minute totals consistently with the web dashboard', () => {
    expect(formatDuration(4 * 3600 + 32 * 60)).toBe('4h 32m');
  });

  it('does not render negative or invalid durations', () => {
    expect(formatDuration(-1)).toBe('0m');
    expect(formatDuration(Number.NaN)).toBe('0m');
  });
});

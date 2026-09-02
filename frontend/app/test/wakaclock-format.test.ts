import { describe, expect, it } from 'vitest';

import {
  formatDurationShort,
  formatMagnitude,
  formatSeconds,
  toDivergingNegative,
} from '@/lib/wakaclock/format';

describe('formatDurationShort', () => {
  /**
   * The reason this formatter exists: charts used to plot decimal hours, so a short
   * session rendered axis ticks like "0.0025h". Every case below must produce something
   * a person can read at a glance.
   */
  it('keeps short durations readable instead of collapsing to zero', () => {
    expect(formatDurationShort(0)).toBe('0s');
    expect(formatDurationShort(1)).toBe('1s');
    expect(formatDurationShort(36)).toBe('36s');
    expect(formatDurationShort(59)).toBe('59s');
  });

  it('switches to minutes at one minute', () => {
    expect(formatDurationShort(60)).toBe('1m');
    expect(formatDurationShort(90)).toBe('1m');
    expect(formatDurationShort(3599)).toBe('59m');
  });

  it('switches to hours at one hour and omits a zero minute remainder', () => {
    expect(formatDurationShort(3600)).toBe('1h');
    expect(formatDurationShort(7200)).toBe('2h');
    expect(formatDurationShort(9000)).toBe('2h 30m');
  });

  it('rounds rather than truncating, so 59.6s does not read as 59s', () => {
    expect(formatDurationShort(59.6)).toBe('1m');
    expect(formatDurationShort(0.4)).toBe('0s');
  });

  it('clamps negatives rather than emitting a minus sign on an axis', () => {
    expect(formatDurationShort(-10)).toBe('0s');
  });

  it('never returns a decimal or an "h" suffix on a sub-minute value', () => {
    for (const seconds of [0.5, 1, 12, 36, 59]) {
      const output = formatDurationShort(seconds);

      expect(output).not.toContain('.');
      expect(output).not.toContain('h');
    }
  });

  /** formatSeconds mirrors the backend and is still correct for totals — but not for axes. */
  it('differs from formatSeconds precisely where formatSeconds loses the value', () => {
    expect(formatSeconds(36)).toBe('0m');
    expect(formatDurationShort(36)).toBe('36s');
  });
});

describe('toDivergingNegative', () => {
  it('mirrors a count onto the negative half of the axis', () => {
    expect(toDivergingNegative(42)).toBe(-42);
    expect(toDivergingNegative(0)).toBe(-0);
  });

  /**
   * The whole reason this helper exists. `unattributed_added` and friends are nullable
   * because the API refuses to report an unknown as a measured zero; negating that
   * directly yields NaN and the bar vanishes without anyone noticing.
   */
  it('keeps an unknown unknown instead of turning it into a number', () => {
    expect(toDivergingNegative(null)).toBeNull();
    expect(toDivergingNegative(undefined)).toBeNull();
  });
});

describe('formatMagnitude', () => {
  it('drops the sign, which the axis already carries', () => {
    expect(formatMagnitude(-1200)).toBe('1,200');
    expect(formatMagnitude(1200)).toBe('1,200');
  });

  it('renders anything that is not a finite number as unknown', () => {
    expect(formatMagnitude(null)).toBe('—');
    expect(formatMagnitude(undefined)).toBe('—');
    expect(formatMagnitude(Number.NaN)).toBe('—');
    expect(formatMagnitude('12')).toBe('—');
  });
});

import { describe, expect, it } from 'vitest';

import { splitWakaTimeExport } from '@/lib/wakaclock/wakatime-import-chunks';

describe('WakaTime export chunking', () => {
  it('splits large history without retaining unrelated user or heartbeat fields', () => {
    const heartbeats = Array.from({ length: 10_001 }, (_, index) => ({
      entity: `/private/project/file-${index}.ts`,
      type: 'file',
      time: 1_800_000_000 + index,
      project: 'project',
      prompt: 'must not be uploaded',
    }));
    const chunks = splitWakaTimeExport(
      JSON.stringify({
        user: { last_plugin: 'vscode', email: 'private@example.com' },
        days: [{ heartbeats }],
      })
    );
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => new TextEncoder().encode(chunk).length <= 1024 * 1024)).toBe(
      true
    );
    const reconstructed = chunks.flatMap((chunk) => {
      const parsed = JSON.parse(chunk) as { days: Array<{ heartbeats: unknown[] }> };
      return parsed.days[0].heartbeats;
    });
    expect(reconstructed).toHaveLength(10_001);
    expect(chunks.join('')).not.toContain('private@example.com');
    expect(chunks.join('')).not.toContain('must not be uploaded');
  });

  it('rejects summary-only exports', () => {
    expect(() =>
      splitWakaTimeExport(JSON.stringify({ user: {}, days: [{ grand_total: {} }] }))
    ).toThrow('No raw heartbeats');
  });
});

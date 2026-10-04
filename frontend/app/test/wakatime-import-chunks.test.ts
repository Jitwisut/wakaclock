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

it.each([null, [], {}, { user: [], days: [] }, { user: {}, days: null }])(
  'rejects malformed export shape %j before producing upload chunks',
  (value) => {
    expect(() => splitWakaTimeExport(JSON.stringify(value))).toThrow('Expected a WakaTime export');
  }
);
it('skips invalid days and heartbeats while preserving permitted metadata', () => {
  const result = splitWakaTimeExport(
    JSON.stringify({
      user: { last_plugin: 12, last_plugin_name: 'VS Code' },
      days: [null, [], { heartbeats: [null, [], 42, { entity: 'ok.ts', time: 1 }] }],
    })
  );
  expect(result).toHaveLength(1);
  expect(JSON.parse(result[0])).toEqual({
    user: { last_plugin: null, last_plugin_name: 'VS Code' },
    days: [{ heartbeats: [{ entity: 'ok.ts', time: 1 }] }],
  });
});
it('uses UTF-8 bytes to split below the budget and rejects a single oversize heartbeat', () => {
  const heartbeat = { entity: 'ก'.repeat(100_000), time: 1 };
  const chunks = splitWakaTimeExport(
    JSON.stringify({ user: {}, days: [{ heartbeats: [heartbeat, heartbeat, heartbeat] }] })
  );
  expect(chunks).toHaveLength(2);
  expect(chunks.every((chunk) => new TextEncoder().encode(chunk).length <= 800_000)).toBe(true);
  expect(() =>
    splitWakaTimeExport(
      JSON.stringify({ user: {}, days: [{ heartbeats: [{ entity: 'ก'.repeat(300_000) }] }] })
    )
  ).toThrow('A single heartbeat exceeds');
});

it('includes large plugin metadata and escaped multibyte fields in every chunk budget', () => {
  const user = { last_plugin: 'ก'.repeat(100_000), last_plugin_name: 'VS Code' };
  const heartbeat = { entity: '"\\\nก'.repeat(25_000), time: 1 };
  const heartbeats = Array.from({ length: 5 }, () => heartbeat);
  const chunks = splitWakaTimeExport(JSON.stringify({ user, days: [{ heartbeats }] }));
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((chunk) => new TextEncoder().encode(chunk).length <= 800_000)).toBe(true);
  expect(
    chunks.flatMap((chunk) => {
      const parsed = JSON.parse(chunk) as { days: { heartbeats: unknown[] }[] };
      return parsed.days[0].heartbeats;
    })
  ).toEqual(heartbeats);
  expect(() =>
    splitWakaTimeExport(
      JSON.stringify({
        user: { last_plugin: 'ก'.repeat(300_000) },
        days: [{ heartbeats: [{ time: 1 }] }],
      })
    )
  ).toThrow('A single heartbeat exceeds');
});

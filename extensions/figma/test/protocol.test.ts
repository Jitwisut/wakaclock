import { describe, expect, it } from 'vitest';

import {
  buildEntity,
  buildHeartbeat,
  hasLocalDocumentChange,
  shouldSendImmediately,
} from '../src/protocol';

describe('Figma privacy boundary', () => {
  it('builds a bounded document/page label and strips line breaks', () => {
    const entity = buildEntity('Secret\nDocument', `Page\t${'x'.repeat(200)}`);
    expect(entity).toContain('Secret Document / Page');
    expect(entity.length).toBeLessThanOrEqual(192);
    expect(entity).not.toContain('\n');
    expect(entity).not.toContain('\t');
  });

  it('emits only the metadata fields allowed by the heartbeat contract', () => {
    expect(buildHeartbeat('Design / Home', true, 1_000)).toEqual({
      category: 'designing',
      editor: 'Figma',
      entity: 'Design / Home',
      entity_type: 'app',
      is_write: true,
      time: 1,
      user_agent: 'atoaxis-figma/0.1.0',
    });
  });

  it('ignores remote-only collaboration changes', () => {
    expect(hasLocalDocumentChange(['REMOTE', 'REMOTE'])).toBe(false);
    expect(hasLocalDocumentChange(['REMOTE', 'LOCAL'])).toBe(true);
  });

  it('throttles non-write activity while allowing writes immediately', () => {
    expect(shouldSendImmediately(false, 10_000, 20_000)).toBe(false);
    expect(shouldSendImmediately(false, 10_000, 40_000)).toBe(true);
    expect(shouldSendImmediately(true, 10_000, 10_001)).toBe(true);
    expect(shouldSendImmediately(false, 0, 1)).toBe(true);
  });
});

import { expect, it } from 'vitest';

import { randomId } from '@/components/ui/custom/minimal-tiptap/utils';

it('returns stable output for a seed', () => {
  expect(randomId('minimal-tiptap')).toBe(randomId('minimal-tiptap'));
});

it('returns different output for different seeds', () => {
  expect(randomId('minimal-tiptap-a')).not.toBe(randomId('minimal-tiptap-b'));
});

it('returns a 9 character id for seeded calls', () => {
  expect(randomId('minimal-tiptap')).toHaveLength(9);
});

import { describe, expect, it } from 'vitest';

import {
  formatAiAgentName,
  formatAiProviderModel,
  formatIntegrationAgentName,
  formatIntegrationProviderModel,
  normalizeAiMetadata,
} from '@/lib/wakaclock/ai-display';

describe('AI metadata display', () => {
  it('normalizes legacy placeholder values', () => {
    expect(normalizeAiMetadata(' unknown ')).toBeNull();
    expect(normalizeAiMetadata('<synthetic>')).toBe('<synthetic>');
    expect(normalizeAiMetadata('claude-sonnet-5')).toBe('claude-sonnet-5');
  });

  it('keeps unknown authorship separate from unattributed AI', () => {
    expect(formatAiAgentName({ actor_type: 'ai_inferred', agent: 'unknown' })).toBe(
      'Unattributed AI'
    );
    expect(formatAiAgentName({ actor_type: 'unknown', agent: 'unknown' })).toBe(
      'Unknown authorship'
    );
    expect(formatAiAgentName({ actor_type: 'ai_verified', agent: 'unknown' })).toBe(
      'AI tool not reported'
    );
  });

  it('does not invent a provider or model for partial metadata', () => {
    expect(formatAiProviderModel(null, 'gpt-5.6-sol', 'ai_verified')).toBe(
      'Provider not reported / gpt-5.6-sol'
    );
    expect(formatAiProviderModel('openai', null, 'ai_verified')).toBe(
      'openai / Model not reported'
    );
    expect(formatIntegrationProviderModel('unknown', null)).toBe(
      'Provider not reported / Model not reported'
    );
    expect(formatIntegrationProviderModel('anthropic', '<synthetic>')).toBe(
      'anthropic / Internal model marker'
    );
    expect(formatIntegrationAgentName('unknown')).toBe('AI agent not reported');
  });
});

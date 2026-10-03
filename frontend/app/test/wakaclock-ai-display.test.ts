import { describe, expect, it } from 'vitest';

import {
  aiAdapterGuidance,
  aiRepairGuidance,
  aiRuntimeGuidance,
  formatAiAgentName,
  formatAiProviderModel,
  formatIntegrationAgentName,
  formatIntegrationProviderModel,
  normalizeAiMetadata,
  isConfirmedAiIdentity,
  formatAiIdentityReason,
  formatActorType,
} from '@/lib/wakaclock/ai-display';
import type { AiAdapterFreshnessV2 } from '@/lib/wakaclock/types';

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

  it('maps certification and bounded diagnostic codes to safe repair actions', () => {
    for (const status of [
      'certification_expired',
      'certification_revoked',
      'certification_mismatch',
      'certification_historical',
      'certification_verified',
    ]) {
      expect(aiRepairGuidance(undefined, status).label).toBeTruthy();
    }
    for (const code of [
      'unsupported',
      'consent_disabled',
      'auth_required',
      'outdated_schema',
      'offline_queue',
      'certification_required',
      'unknown_code',
    ]) {
      expect(aiRepairGuidance(code).detail).not.toContain('/Users/');
    }
    expect(aiRepairGuidance(undefined).label).toBe('No action reported');
  });

  it('keeps idle distinct from disabled, degraded and unavailable runtime states', () => {
    expect(aiRuntimeGuidance('healthy').tone).toBe('success');
    expect(aiRuntimeGuidance('idle').label).toContain('idle');
    expect(aiRuntimeGuidance('degraded').label).toBe('Repair needed');
    expect(aiRuntimeGuidance('disabled').label).toBe('Diagnostics disabled');
    expect(aiRuntimeGuidance('unavailable').label).toBe('Observer unavailable');
    expect(aiRuntimeGuidance('healthy', { diagnostics_upload: false, observer: true }).label).toBe(
      'Diagnostics disabled'
    );
  });

  it('derives adapter setup and runtime guidance without trusting identity metadata', () => {
    const base: AiAdapterFreshnessV2 = {
      agent: 'codex',
      availability: 'available',
      detected: { availability: 'available', measured_at: null, value: true },
      enabled: { availability: 'available', measured_at: null, value: true },
      runtime_health: 'healthy',
      verification: 'unverified',
    };
    expect(aiAdapterGuidance({ ...base, availability: 'unavailable' }).label).toBe(
      'Measurement unavailable'
    );
    expect(
      aiAdapterGuidance({
        ...base,
        diagnostic_code: 'auth_required',
      }).label
    ).toBe('Authentication required');
    expect(
      aiAdapterGuidance({
        ...base,
        certification_status: 'certification_verified',
      }).label
    ).toBe('Certified capability');
    expect(
      aiAdapterGuidance({
        ...base,
        certification_status: 'certification_verified',
        detected: { ...base.detected, value: false },
      }).label
    ).toBe('Needs setup');
    expect(aiAdapterGuidance({ ...base, detected: { ...base.detected, value: false } }).label).toBe(
      'Needs setup'
    );
    expect(aiAdapterGuidance({ ...base, enabled: { ...base.enabled, value: false } }).label).toBe(
      'Needs trust'
    );
    expect(aiAdapterGuidance(base).label).toBe('Healthy');
  });
});

it('does not display missing or internal model markers as a confirmed identity', () => {
  const base = {
    actor_type: 'ai_verified' as const,
    agent: 'codex',
    provider: 'openai',
    model: 'model-v1',
  };
  expect(isConfirmedAiIdentity(base)).toBe(true);
  expect(
    isConfirmedAiIdentity({ ...base, identity_status: 'confirmed', identity_reason: null })
  ).toBe(true);
  expect(
    isConfirmedAiIdentity({
      ...base,
      identity_status: 'confirmed',
      identity_reason: 'context_unavailable',
    })
  ).toBe(false);
  expect(isConfirmedAiIdentity({ ...base, identity_status: 'partial' })).toBe(false);
  expect(isConfirmedAiIdentity({ ...base, actor_type: 'human' })).toBe(false);
  for (const field of ['agent', 'provider', 'model'] as const) {
    for (const value of [
      null,
      '',
      '<synthetic>',
      'synthetic',
      'internal model marker',
      'internal_model_marker',
      'model not reported',
      'provider not reported',
    ]) {
      expect(isConfirmedAiIdentity({ ...base, [field]: value })).toBe(false);
    }
  }
  expect(formatAiIdentityReason()).toBe('Identity evidence is incomplete');
  expect(formatAiIdentityReason('future_reason')).toBe('Identity evidence needs review');
  expect(formatAiIdentityReason('missing_model')).toBe('Model not reported');
  expect(formatActorType()).toBe('Unknown authorship');
  expect(formatAiProviderModel()).toBe('Provider not reported / Model not reported');
  expect(formatIntegrationProviderModel(null, 'model')).toBe('Provider not reported / model');
  expect(formatIntegrationProviderModel('provider', null)).toBe('provider / Model not reported');
});
it('handles equivalent bounded diagnostic codes without exposing server messages', () => {
  for (const [alias, canonical] of [
    ['disabled_by_policy', 'consent_disabled'],
    ['authentication_required', 'auth_required'],
    ['schema_mismatch', 'outdated_schema'],
    ['delivery_pending', 'offline_queue'],
  ])
    expect(aiRepairGuidance(alias)).toEqual(aiRepairGuidance(canonical));
});

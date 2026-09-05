import type { ActorType, AiAgentItem } from './types';

const PLACEHOLDER_VALUES = new Set(['', 'null', 'undefined', 'unknown', '<unknown>']);

export const AI_LABELS = {
  aiAgentNotReported: 'AI agent not reported',
  aiInferred: 'Unattributed AI',
  aiToolNotReported: 'AI tool not reported',
  human: 'Human',
  internalModelMarker: 'Internal model marker',
  modelNotReported: 'Model not reported',
  providerNotReported: 'Provider not reported',
  unknownAuthorship: 'Unknown authorship',
} as const;

/** Treat legacy placeholder strings as missing metadata instead of displaying them as identity. */
export function normalizeAiMetadata(value?: null | string): null | string {
  const normalized = value?.trim();
  if (!normalized || PLACEHOLDER_VALUES.has(normalized.toLowerCase())) return null;
  return normalized;
}

export function formatActorType(actorType?: ActorType): string {
  switch (actorType) {
    case 'ai_verified': {
      return 'AI verified';
    }
    case 'ai_inferred': {
      return 'AI inferred';
    }
    case 'human': {
      return AI_LABELS.human;
    }
    default: {
      return AI_LABELS.unknownAuthorship;
    }
  }
}

export function formatAiAgentName(agent: Pick<AiAgentItem, 'actor_type' | 'agent'>): string {
  switch (agent.actor_type) {
    case 'ai_inferred': {
      return AI_LABELS.aiInferred;
    }
    case 'ai_verified': {
      return normalizeAiMetadata(agent.agent) ?? AI_LABELS.aiToolNotReported;
    }
    case 'human': {
      return AI_LABELS.human;
    }
    default: {
      return AI_LABELS.unknownAuthorship;
    }
  }
}

export function formatIntegrationAgentName(agent?: null | string): string {
  return normalizeAiMetadata(agent) ?? AI_LABELS.aiAgentNotReported;
}

/**
 * Format provider and model independently so one missing field never becomes the ambiguous
 * placeholder pair. Inferred and unknown authorship rows intentionally hide identity.
 */
export function formatAiProviderModel(
  provider?: null | string,
  model?: null | string,
  actorType?: ActorType
): string {
  if (actorType === 'ai_inferred' || actorType === 'human' || actorType === 'unknown') return '—';

  const normalizedProvider = normalizeAiMetadata(provider);
  const normalizedModel = formatModelMetadata(model);
  if (!normalizedProvider && !normalizedModel) {
    return `${AI_LABELS.providerNotReported} / ${AI_LABELS.modelNotReported}`;
  }
  return `${normalizedProvider ?? AI_LABELS.providerNotReported} / ${normalizedModel ?? AI_LABELS.modelNotReported}`;
}

export function formatIntegrationProviderModel(
  provider?: null | string,
  model?: null | string
): string {
  const normalizedProvider = normalizeAiMetadata(provider);
  const normalizedModel = formatModelMetadata(model);
  if (!normalizedProvider && !normalizedModel) {
    return `${AI_LABELS.providerNotReported} / ${AI_LABELS.modelNotReported}`;
  }
  return `${normalizedProvider ?? AI_LABELS.providerNotReported} / ${normalizedModel ?? AI_LABELS.modelNotReported}`;
}

function formatModelMetadata(value?: null | string): null | string {
  const normalized = normalizeAiMetadata(value);
  return normalized?.toLowerCase() === '<synthetic>' ? AI_LABELS.internalModelMarker : normalized;
}

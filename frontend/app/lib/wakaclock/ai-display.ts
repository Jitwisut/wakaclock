import type { ActorType, AiAdapterFreshnessV2, AiAgentItem, AiRuntimeHealth } from './types';

const PLACEHOLDER_VALUES = new Set([
  '',
  'null',
  'undefined',
  'unknown',
  '<unknown>',
  'none',
  'n/a',
  'na',
  'not reported',
  'not available',
  'model_not_reported',
  'provider_not_reported',
  'no model',
  'no provider',
]);

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

export interface AiRepairGuidance {
  detail: string;
  label: string;
  tone: 'neutral' | 'success' | 'warning';
}

export const AI_IDENTITY_REASON_LABELS: Record<string, string> = {
  conflicting_evidence: 'Conflicting evidence',
  context_unavailable: 'Turn context unavailable',
  internal_marker: 'Internal model marker',
  missing_agent: 'Agent not reported',
  missing_model: 'Model not reported',
  missing_provider: 'Provider not reported',
};

/**
 * Translate bounded diagnostic metadata into a user-facing repair action. The server
 * validates these codes, but the UI still treats unknown values conservatively and never
 * renders an arbitrary error string as an instruction.
 */
export function aiRepairGuidance(
  diagnosticCode?: null | string,
  certificationStatus?: null | string
): AiRepairGuidance {
  switch (certificationStatus) {
    case 'certification_expired': {
      return {
        detail: 'Install the current certified adapter version, then run one supported edit.',
        label: 'Certification expired',
        tone: 'warning',
      };
    }
    case 'certification_revoked': {
      return {
        detail: 'Use a supported adapter tuple or contact the administrator for a new review.',
        label: 'Certification revoked',
        tone: 'warning',
      };
    }
    case 'certification_mismatch': {
      return {
        detail:
          'Update the client so its runtime, provider and model tuple matches the reviewed capability.',
        label: 'Tuple mismatch',
        tone: 'warning',
      };
    }
    case 'certification_historical': {
      return {
        detail: 'The evidence is historical. Run the current client before relying on attribution.',
        label: 'Historical evidence',
        tone: 'warning',
      };
    }
    case 'certification_verified': {
      return {
        detail: 'This exact runtime capability is reviewed and available for attribution.',
        label: 'Certified capability',
        tone: 'success',
      };
    }
    default: {
      break;
    }
  }

  switch (diagnosticCode) {
    case 'unsupported': {
      return {
        detail:
          'This runtime is not supported yet. Choose a supported client or keep its events unattributed.',
        label: 'Unsupported runtime',
        tone: 'neutral',
      };
    }
    case 'disabled_by_policy':
    case 'consent_disabled': {
      return {
        detail: 'Enable observer and diagnostics consent in the client settings before retrying.',
        label: 'Diagnostics disabled',
        tone: 'warning',
      };
    }
    case 'auth_required':
    case 'authentication_required': {
      return {
        detail: 'Sign in to the client, then run one supported edit to refresh evidence.',
        label: 'Authentication required',
        tone: 'warning',
      };
    }
    case 'outdated_schema':
    case 'schema_mismatch': {
      return {
        detail: 'Update the client and restart its observer so it can send a supported schema.',
        label: 'Client update required',
        tone: 'warning',
      };
    }
    case 'offline_queue':
    case 'delivery_pending': {
      return {
        detail:
          'Keep the observer running and reconnect; queued events will retry without being counted twice.',
        label: 'Delivery is pending',
        tone: 'warning',
      };
    }
    case 'certification_required': {
      return {
        detail: 'The client was observed but is not certified for attribution yet.',
        label: 'Certification pending',
        tone: 'neutral',
      };
    }
    default: {
      return {
        detail: diagnosticCode
          ? 'Run wakaclock doctor ai and inspect the advanced diagnostic code.'
          : 'No repair action is available until the observer reports a bounded reason.',
        label: diagnosticCode ? 'Needs attention' : 'No action reported',
        tone: diagnosticCode ? 'warning' : 'neutral',
      };
    }
  }
}

export function aiRuntimeGuidance(
  health: AiRuntimeHealth,
  consent?: { diagnostics_upload: boolean; observer: boolean }
): AiRepairGuidance {
  if (consent && (!consent.observer || !consent.diagnostics_upload)) {
    return aiRepairGuidance('consent_disabled');
  }
  switch (health) {
    case 'healthy': {
      return {
        detail: 'The observer is running and the latest measurements are healthy.',
        label: 'Healthy',
        tone: 'success',
      };
    }
    case 'idle': {
      return {
        detail: 'The observer is ready but has not seen a recent event; idle is not a failure.',
        label: 'Ready · idle',
        tone: 'neutral',
      };
    }
    case 'degraded': {
      return {
        detail:
          'Run wakaclock doctor ai and resolve the bounded broker or parser reason shown below.',
        label: 'Repair needed',
        tone: 'warning',
      };
    }
    case 'disabled': {
      return aiRepairGuidance('consent_disabled');
    }
    case 'unavailable': {
      return {
        detail:
          'Start the local observer and reconnect it before expecting new attribution evidence.',
        label: 'Observer unavailable',
        tone: 'warning',
      };
    }
    default: {
      return aiRepairGuidance();
    }
  }
}

export function aiAdapterGuidance(adapter: AiAdapterFreshnessV2): AiRepairGuidance {
  if (adapter.availability !== 'available') {
    return {
      detail: 'This measurement is unavailable; run the observer on the device to collect it.',
      label: 'Measurement unavailable',
      tone: 'neutral',
    };
  }
  if (adapter.detected.value === false) {
    return {
      detail: 'Install or enable this adapter, then run a supported edit.',
      label: 'Needs setup',
      tone: 'warning',
    };
  }
  if (adapter.enabled.value === false) {
    return {
      detail: 'Enable this adapter in the client settings before retrying.',
      label: 'Needs trust',
      tone: 'warning',
    };
  }
  if (adapter.diagnostic_code || adapter.certification_status) {
    return aiRepairGuidance(adapter.diagnostic_code, adapter.certification_status);
  }
  return aiRuntimeGuidance(adapter.runtime_health);
}

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

/** A row is safe for the primary model table only when the new API explicitly
 * marked the tuple confirmed. Missing metadata keeps legacy clients readable,
 * while server responses always include a status for new rows. */
export function isConfirmedAiIdentity(
  agent: Pick<
    AiAgentItem,
    'actor_type' | 'agent' | 'identity_reason' | 'identity_status' | 'model' | 'provider'
  >
): boolean {
  if (agent.actor_type !== 'ai_verified') return false;
  const hasTuple = Boolean(
    usableIdentityValue(agent.agent) &&
      usableIdentityValue(agent.provider) &&
      usableIdentityValue(agent.model)
  );
  if (agent.identity_status) {
    return (
      agent.identity_status.trim().toLowerCase() === 'confirmed' &&
      !usableIdentityValue(agent.identity_reason) &&
      hasTuple
    );
  }
  // Compatibility with pre-identity API responses. New server rows always carry
  // an explicit status; the fallback keeps older dashboards readable without
  // treating a placeholder as a model name.
  return hasTuple;
}

export function formatAiIdentityReason(reason?: null | string): string {
  if (!reason) return 'Identity evidence is incomplete';
  return AI_IDENTITY_REASON_LABELS[reason] ?? 'Identity evidence needs review';
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
  return normalized &&
    ['<synthetic>', 'synthetic', 'internal model marker', 'internal_model_marker'].includes(
      normalized.toLowerCase()
    )
    ? AI_LABELS.internalModelMarker
    : normalized;
}

function usableIdentityValue(value?: null | string): null | string {
  const normalized = normalizeAiMetadata(value);
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (
    lowered === '<synthetic>' ||
    lowered === 'synthetic' ||
    lowered === 'internal model marker' ||
    lowered === 'internal_model_marker' ||
    lowered === 'model not reported' ||
    lowered === 'provider not reported' ||
    lowered === 'not reported' ||
    lowered === 'not available' ||
    lowered === 'model_not_reported' ||
    lowered === 'provider_not_reported' ||
    lowered === 'no model' ||
    lowered === 'no provider'
  ) {
    return null;
  }
  return normalized;
}

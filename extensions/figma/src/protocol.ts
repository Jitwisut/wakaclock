export const NON_WRITE_HEARTBEAT_INTERVAL_MS = 30_000;

export interface FigmaHeartbeat {
  category: 'designing';
  editor: 'Figma';
  entity: string;
  entity_type: 'app';
  is_write: boolean;
  time: number;
  user_agent: 'atoaxis-figma/0.1.0';
}

function safeLabel(value: string, fallback: string): string {
  const compact = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (compact || fallback).slice(0, 96);
}

export function buildEntity(documentName: string, pageName: string): string {
  return `${safeLabel(documentName, 'Untitled')} / ${safeLabel(pageName, 'Page')}`.slice(0, 192);
}

export function buildHeartbeat(entity: string, isWrite: boolean, nowMs = Date.now()): FigmaHeartbeat {
  return {
    category: 'designing',
    editor: 'Figma',
    entity,
    entity_type: 'app',
    is_write: isWrite,
    time: nowMs / 1000,
    user_agent: 'atoaxis-figma/0.1.0',
  };
}

export function hasLocalDocumentChange(origins: readonly string[]): boolean {
  return origins.some((origin) => origin === 'LOCAL');
}

export function shouldSendImmediately(isWrite: boolean, lastSentAtMs: number, nowMs: number): boolean {
  return isWrite || lastSentAtMs === 0 || nowMs - lastSentAtMs >= NON_WRITE_HEARTBEAT_INTERVAL_MS;
}

const CHUNK_BUDGET_BYTES = 800_000;
const HEARTBEAT_FIELDS = [
  'entity',
  'type',
  'time',
  'project',
  'branch',
  'language',
  'dependencies',
  'lines',
  'lineno',
  'cursorpos',
  'is_write',
  'category',
  'created_at',
  'ai_input_tokens',
  'ai_output_tokens',
  'ai_session',
  'ai_line_changes',
  'human_line_changes',
  'machine_name_id',
] as const;

function record(value: unknown): null | Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function* sanitizedHeartbeats(days: unknown[]): Generator<Record<string, unknown>> {
  for (const day of days) {
    const sourceDay = record(day);
    if (!Array.isArray(sourceDay?.heartbeats)) continue;
    for (const value of sourceDay.heartbeats) {
      const source = record(value);
      if (!source) continue;
      const heartbeat: Record<string, unknown> = {};
      for (const field of HEARTBEAT_FIELDS) {
        if (field in source) heartbeat[field] = source[field];
      }
      yield heartbeat;
    }
  }
}

/** Split a WakaTime export into privacy-minimized chunks accepted by the v2 import jobs. */
export function splitWakaTimeExport(raw: string): string[] {
  const root = record(JSON.parse(raw) as unknown);
  const sourceUser = record(root?.user);
  if (!root || !sourceUser || !Array.isArray(root.days)) {
    throw new Error('Expected a WakaTime export with user and days.');
  }
  const user = {
    last_plugin: typeof sourceUser.last_plugin === 'string' ? sourceUser.last_plugin : null,
    last_plugin_name:
      typeof sourceUser.last_plugin_name === 'string' ? sourceUser.last_plugin_name : null,
  };
  const encoder = new TextEncoder();
  const baseSize = encoder.encode(JSON.stringify({ user, days: [{ heartbeats: [] }] })).length;
  const chunks: string[] = [];
  let current: Record<string, unknown>[] = [];
  let currentBytes = baseSize;

  const flush = () => {
    if (current.length === 0) return;
    // Admission below bounds baseSize + every serialized heartbeat + one comma
    // each to 800 KB. That overcounts the first comma, so the actual chunk is
    // already below the server's 1 MiB limit without encoding the whole body again.
    const chunk = JSON.stringify({ user, days: [{ heartbeats: current }] });
    chunks.push(chunk);
    current = [];
    currentBytes = baseSize;
  };

  for (const heartbeat of sanitizedHeartbeats(root.days)) {
    const bytes = encoder.encode(JSON.stringify(heartbeat)).length + 1;
    if (baseSize + bytes > CHUNK_BUDGET_BYTES) {
      throw new Error('A single heartbeat exceeds the import chunk limit.');
    }
    if (currentBytes + bytes > CHUNK_BUDGET_BYTES || current.length >= 5000) flush();
    current.push(heartbeat);
    currentBytes += bytes;
  }
  flush();
  if (chunks.length === 0) {
    throw new Error('No raw heartbeats found. Summary-only exports cannot be imported.');
  }
  return chunks;
}

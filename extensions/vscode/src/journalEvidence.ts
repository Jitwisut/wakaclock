/** Metadata evidence is keyed to an immutable heartbeat/revision, never queue absence. */
export interface RecoveryEvidence {
  heartbeatId: string;
  revision: number;
  cliStatus: 'accepted' | 'missing' | 'conflict' | 'unconfirmed';
  serverAck: 'ingress_accepted' | 'unconfirmed';
  canonical: 'found' | 'missing' | 'superseded' | 'conflict' | 'unavailable';
  observedAt: string;
}
export function validRecoveryEvidence(value: unknown): value is RecoveryEvidence {
  if (!value || typeof value !== 'object') return false;
  const r=value as RecoveryEvidence;
  return Object.keys(r).every(k=>['heartbeatId','revision','cliStatus','serverAck','canonical','observedAt'].includes(k))
    && typeof r.heartbeatId==='string' && /^[a-zA-Z0-9_.:-]{1,256}$/.test(r.heartbeatId)
    && Number.isSafeInteger(r.revision) && r.revision>=0
    && ['accepted','missing','conflict','unconfirmed'].includes(r.cliStatus)
    && ['ingress_accepted','unconfirmed'].includes(r.serverAck)
    && ['found','missing','superseded','conflict','unavailable'].includes(r.canonical)
    && typeof r.observedAt==='string' && Number.isFinite(Date.parse(r.observedAt));
}
export function mergeRecoveryEvidence(previous: readonly RecoveryEvidence[], updates: readonly RecoveryEvidence[]): RecoveryEvidence[] {
  if (!previous.every(validRecoveryEvidence)) throw new Error('journal_recovery_evidence_invalid');
  const rows=new Map(previous.map(row=>[`${row.heartbeatId}:${row.revision}`,row]));
  for (const row of updates) {
    if (!validRecoveryEvidence(row)) throw new Error('journal_recovery_evidence_invalid');
    const key=`${row.heartbeatId}:${row.revision}`;const old=rows.get(key);
    if (!old || Date.parse(row.observedAt)>=Date.parse(old.observedAt)) rows.set(key,row);
  }
  return [...rows.values()];
}

/** Persist the returned cursor only after evidence for this batch is committed. */
export function recoveryEvidenceBatch<T>(records: readonly T[], cursor = 0): { records: T[]; nextCursor: number } {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('journal_recovery_cursor_invalid');
  if (!records.length) return { records: [], nextCursor: 0 };
  const offset = cursor % records.length;
  const batch = records.slice(offset, offset + 100);
  return { records: batch, nextCursor: (offset + batch.length) % records.length };
}

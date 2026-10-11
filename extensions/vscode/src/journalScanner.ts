import { createHash } from "node:crypto";

export interface JournalScan<T> {
  sequence: number;
  state?: T;
  pending: number;
  sourceHash: string;
  verifiedBytes: number;
  errorCode?: string;
  unknownRecords: number | null;
}
export function journalHash(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
/** Stop at the first unverified record. Never resynchronise past corruption. */
export function scanJournal<T>(bytes: Buffer, validate: (state: unknown) => boolean = () => true): JournalScan<T> {
  const result: JournalScan<T> = { sequence: 0, pending: 0, sourceHash: journalHash(bytes), verifiedBytes: 0, unknownRecords: 0 };
  let offset = 0;
  while (offset < bytes.length) {
    const end = bytes.indexOf(10, offset);
    if (end < 0) { result.errorCode = "journal_torn_write"; break; }
    try {
      const record = JSON.parse(bytes.subarray(offset, end).toString("utf8"));
      const body = JSON.stringify({ version: record.version, sequence: record.sequence, state: record.state, pending: record.pending });
      if (record.version !== 1) { result.errorCode = "journal_unknown_schema"; break; }
      if (!Number.isSafeInteger(record.pending) || record.pending < 0 || record.sequence !== result.sequence + 1 || journalHash(body) !== record.checksum) throw new Error();
      if (!validate(record.state)) { result.errorCode = "journal_checkpoint_invalid"; break; }
      result.sequence = record.sequence; result.state = record.state; result.pending = record.pending;
      offset = end + 1; result.verifiedBytes = offset;
    } catch { result.errorCode = "journal_checksum_or_sequence"; break; }
  }
  if (result.errorCode) result.unknownRecords = null;
  return result;
}
export function encodeJournalCheckpoint(state: unknown, pending: number): string {
  const body = { version: 1, sequence: 1, state, pending };
  return JSON.stringify({ ...body, checksum: journalHash(JSON.stringify(body)) }) + "\n";
}

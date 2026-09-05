import { randomUUID } from "node:crypto";
import type { ClipboardCopyMetrics, ClipboardPasteMetrics, PasteOrigin } from "./types";

export const ATOAXIS_CLIPBOARD_MIME = "application/vnd.atoaxis.clipboard-token";
export const PASTE_CHANGE_MATCH_WINDOW_MS = 2_000;
const COPY_TOKEN_TTL_MS = 60 * 60 * 1_000;
const MAX_COPY_TOKENS = 128;

interface PositionLike {
  line: number;
  character: number;
}

export interface RangeLike {
  start: PositionLike;
  end: PositionLike;
  isEmpty?: boolean;
}

interface DocumentLike {
  uri: { fsPath: string; scheme: string };
  version: number;
  offsetAt(position: PositionLike): number;
}

interface CopyTokenRecord {
  entity: string;
  workspace: string | undefined;
  createdAt: number;
}

interface PendingPaste {
  documentVersion: number;
  entity: string;
  origin: PasteOrigin;
  ranges: readonly RangeLike[];
  requestedAt: number;
}

interface ChangeLike {
  range?: RangeLike;
}

export interface PreparedCopy {
  token: string;
  metrics: ClipboardCopyMetrics;
}

export class ClipboardActivityTracker {
  private readonly copyTokens = new Map<string, CopyTokenRecord>();
  private readonly pendingPastes = new Map<string, PendingPaste>();

  public prepareCopy(
    document: DocumentLike,
    ranges: readonly RangeLike[],
    workspace: string | undefined,
    now = Date.now()
  ): PreparedCopy {
    this.pruneCopyTokens(now);
    const token = randomUUID();
    const entity = normalizePath(document.uri.fsPath);
    this.copyTokens.set(token, { entity, workspace, createdAt: now });

    let copiedChars = 0;
    let copiedLines = 0;
    for (const range of ranges) {
      copiedChars += Math.max(0, document.offsetAt(range.end) - document.offsetAt(range.start));
      copiedLines += countRangeLines(range);
    }
    return { token, metrics: { copiedChars, copiedLines } };
  }

  public preparePaste(
    document: DocumentLike,
    ranges: readonly RangeLike[],
    workspace: string | undefined,
    copyToken: string | undefined,
    now = Date.now()
  ): void {
    this.pruneCopyTokens(now);
    const entity = normalizePath(document.uri.fsPath);
    const source = copyToken ? this.copyTokens.get(copyToken) : undefined;
    let origin: PasteOrigin = "external_or_unknown";
    if (source?.entity === entity) {
      origin = "same_file";
    } else if (source?.workspace && workspace && source.workspace === workspace) {
      origin = "same_workspace";
    }
    this.pendingPastes.set(entity, {
      documentVersion: document.version,
      entity,
      origin,
      ranges: [...ranges],
      requestedAt: now
    });
  }

  public consumePaste(
    document: Pick<DocumentLike, "uri" | "version">,
    changes: readonly ChangeLike[],
    changeReason: number | undefined,
    now = Date.now()
  ): ClipboardPasteMetrics | undefined {
    const entity = normalizePath(document.uri.fsPath);
    const pending = this.pendingPastes.get(entity);
    if (!pending) {
      return undefined;
    }
    this.pendingPastes.delete(entity);
    if (
      changeReason === 1 ||
      changeReason === 2 ||
      now - pending.requestedAt > PASTE_CHANGE_MATCH_WINDOW_MS ||
      document.version !== pending.documentVersion + 1 ||
      !rangesMatch(pending.ranges, changes)
    ) {
      return undefined;
    }
    return { origin: pending.origin };
  }

  private pruneCopyTokens(now: number): void {
    for (const [token, record] of this.copyTokens) {
      if (now - record.createdAt > COPY_TOKEN_TTL_MS) {
        this.copyTokens.delete(token);
      }
    }
    while (this.copyTokens.size >= MAX_COPY_TOKENS) {
      const oldest = this.copyTokens.keys().next().value as string | undefined;
      if (!oldest) {
        break;
      }
      this.copyTokens.delete(oldest);
    }
  }
}

function countRangeLines(range: RangeLike): number {
  if (range.isEmpty || positionsEqual(range.start, range.end)) {
    return 0;
  }
  if (range.start.line === range.end.line) {
    return 1;
  }
  return range.end.line - range.start.line + (range.end.character > 0 ? 1 : 0);
}

function rangesMatch(ranges: readonly RangeLike[], changes: readonly ChangeLike[]): boolean {
  if (ranges.length === 0 || changes.length === 0 || changes.some((change) => !change.range)) {
    return false;
  }
  return ranges.every((target) =>
    changes.some(
      (change) =>
        change.range &&
        positionsEqual(change.range.start, target.start) &&
        positionsEqual(change.range.end, target.end)
    )
  );
}

function positionsEqual(left: PositionLike, right: PositionLike): boolean {
  return left.line === right.line && left.character === right.character;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

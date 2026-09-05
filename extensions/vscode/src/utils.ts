import type {
  Selection,
  TextDocument,
  TextDocumentContentChangeEvent,
  TextEditor
} from "vscode";

/**
 * The IANA timezone the CLI must scope "today" to. Every caller that reads or
 * displays today's total has to pass the *same* value — the status bar and the
 * "Show Today" command disagreed on the day boundary when only one of them did.
 */
export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function normalizeFsPath(fsPath: string): string {
  return fsPath.replace(/\\/g, "/");
}

export function isFileDocument(document: Pick<TextDocument, "uri">): boolean {
  return document.uri.scheme === "file";
}

export function getEditorEntity(editor?: Pick<TextEditor, "document">): string | undefined {
  if (!editor || !isFileDocument(editor.document)) {
    return undefined;
  }
  return normalizeFsPath(editor.document.uri.fsPath);
}

export function summarizeTextChanges(
  changes: readonly (Pick<TextDocumentContentChangeEvent, "rangeLength" | "text"> & {
    range?: TextDocumentContentChangeEvent["range"];
  })[]
): {
  charsAdded: number;
  charsDeleted: number;
  keystrokes: number;
  linesAdded: number;
  linesDeleted: number;
} {
  let charsAdded = 0;
  let charsDeleted = 0;
  let keystrokes = 0;
  let linesAdded = 0;
  let linesDeleted = 0;

  for (const change of changes) {
    charsAdded += change.text.length;
    charsDeleted += change.rangeLength;
    keystrokes += Math.max(change.text.length, change.rangeLength, 1);
    linesAdded += countChangedLines(change.text);
    if (change.range) {
      linesDeleted += Math.max(0, change.range.end.line - change.range.start.line);
    }
  }

  return { charsAdded, charsDeleted, keystrokes, linesAdded, linesDeleted };
}

/** Count logical lines in inserted text without sending source content anywhere. */
function countChangedLines(text: string): number {
  if (!text) {
    return 0;
  }
  const newlineCount = (text.match(/\n/g) ?? []).length;
  if (newlineCount > 0) {
    return newlineCount + (text.endsWith("\n") ? 0 : 1);
  }

  // VS Code reports ordinary typing one character at a time. Counting every such
  // event as a new line would turn a 40-character line into 40 human lines. A multi-
  // character paste/AI insertion is still represented as one changed line when it
  // has no newline boundary.
  return text.length > 1 ? 1 : 0;
}

export function getSelectionMetrics(selection?: Pick<Selection, "active">): {
  lineNumber?: number;
  cursorPosition?: number;
} {
  if (!selection) {
    return {};
  }

  return {
    lineNumber: selection.active.line + 1,
    cursorPosition: selection.active.character + 1
  };
}

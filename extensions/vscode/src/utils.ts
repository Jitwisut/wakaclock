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
  /** Inserted text volume for clipboard analytics, not before/after line churn. */
  insertedTextLines: number;
} {
  let charsAdded = 0;
  let charsDeleted = 0;
  let insertedTextLines = 0;
  for (const change of changes) {
    charsAdded += change.text.length;
    charsDeleted += change.rangeLength;
    if (change.text) {
      insertedTextLines += change.text.split("\n").length - (change.text.endsWith("\n") ? 1 : 0);
    }
  }
  return { charsAdded, charsDeleted, insertedTextLines };
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

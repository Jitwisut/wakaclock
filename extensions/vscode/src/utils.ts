import type {
  Selection,
  TextDocument,
  TextDocumentContentChangeEvent,
  TextEditor
} from "vscode";

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
  changes: readonly Pick<TextDocumentContentChangeEvent, "rangeLength" | "text">[]
): { charsAdded: number; charsDeleted: number; keystrokes: number } {
  let charsAdded = 0;
  let charsDeleted = 0;
  let keystrokes = 0;

  for (const change of changes) {
    charsAdded += change.text.length;
    charsDeleted += change.rangeLength;
    keystrokes += Math.max(change.text.length, change.rangeLength, 1);
  }

  return { charsAdded, charsDeleted, keystrokes };
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

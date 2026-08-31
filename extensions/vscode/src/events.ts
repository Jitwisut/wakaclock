import * as vscode from "vscode";
import type { HeartbeatBufferManager } from "./buffer";
import type { WakaclockConfigService } from "./config";
import { Logger } from "./logging";

export function registerEventSubscriptions(
  context: vscode.ExtensionContext,
  configService: WakaclockConfigService,
  bufferManager: Pick<
    HeartbeatBufferManager,
    | "recordEditorSwitch"
    | "recordSave"
    | "recordTextChange"
    | "updateCursor"
    | "getBufferedSeconds"
    | "getBufferedSegments"
    | "flushCurrentEditor"
    | "flushDueBuffers"
  >,
  logger: Logger
): void {
  let previousEditor = vscode.window.activeTextEditor;
  let timer = startFlushTimer();

  function workspaceProject(document?: vscode.TextDocument): string | undefined {
    if (!document) {
      return undefined;
    }
    return vscode.workspace.getWorkspaceFolder(document.uri)?.name;
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const activeSelection =
        vscode.window.activeTextEditor?.document.uri.toString() === event.document.uri.toString()
          ? vscode.window.activeTextEditor.selection
          : undefined;
      void bufferManager.recordTextChange(
        event.document,
        event.contentChanges,
        activeSelection,
        Date.now(),
        workspaceProject(event.document),
        event.reason
      );
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void bufferManager.recordSave(document, Date.now(), workspaceProject(document));
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      const now = Date.now();
      // Observe the new editor first: that closes the previous file's WakaTime-style
      // interval before its buffer is flushed, avoiding a race that could discard the
      // time between the last edit and the editor switch.
      if (editor) {
        bufferManager.updateCursor(
          editor.document,
          editor.selection,
          workspaceProject(editor.document),
          now
        );
      }
      void bufferManager.recordEditorSwitch(previousEditor ?? undefined, editor ?? undefined, now);
      previousEditor = editor;
    }),
    // Losing focus is the last moment the editor can prove the developer was here.
    // Without this the buffered tail of a session sat unflushed until the next edit —
    // which, if the session simply ended, never came.
    vscode.window.onDidChangeWindowState((windowState) => {
      if (windowState.focused) {
        return;
      }
      void bufferManager.flushDueBuffers("focus-lost");
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      bufferManager.updateCursor(
        event.textEditor.document,
        event.selections[0],
        workspaceProject(event.textEditor.document),
        Date.now()
      );
    }),
    vscode.debug.onDidStartDebugSession(() => {
      if (!configService.getSnapshot().trackDebugSessions) {
        return;
      }
      void bufferManager.flushCurrentEditor(
        vscode.window.activeTextEditor,
        "debug-start",
        {
          category: "debugging",
          force: true
        },
        workspaceProject(vscode.window.activeTextEditor?.document)
      );
    }),
    vscode.debug.onDidTerminateDebugSession(() => {
      if (!configService.getSnapshot().trackDebugSessions) {
        return;
      }
      void bufferManager.flushCurrentEditor(
        vscode.window.activeTextEditor,
        "debug-stop",
        {
          category: "debugging",
          force: true
        },
        workspaceProject(vscode.window.activeTextEditor?.document)
      );
    }),
    vscode.tasks.onDidStartTaskProcess(() => {
      if (!configService.getSnapshot().trackBuildTasks) {
        return;
      }
      void bufferManager.flushCurrentEditor(
        vscode.window.activeTextEditor,
        "build-start",
        {
          category: "building",
          force: true
        },
        workspaceProject(vscode.window.activeTextEditor?.document)
      );
    }),
    vscode.tasks.onDidEndTaskProcess(() => {
      if (!configService.getSnapshot().trackBuildTasks) {
        return;
      }
      void bufferManager.flushCurrentEditor(
        vscode.window.activeTextEditor,
        "build-stop",
        {
          category: "building",
          force: true
        },
        workspaceProject(vscode.window.activeTextEditor?.document)
      );
    }),
    configService.onDidChange(() => {
      logger.debug("wakaclock config changed, restarting flush timer");
      clearInterval(timer);
      timer = startFlushTimer();
    }),
    {
      dispose: () => {
        clearInterval(timer);
        // VS Code shutdown: flush what is already measured instead of discarding it.
        void bufferManager.flushDueBuffers("shutdown");
      }
    }
  );

  // Emit an initial marker for the editor that was already active when the extension
  // started. Without this, opening VS Code into an existing file produced no heartbeat
  // until the first text edit or cursor movement.
  if (previousEditor) {
    void bufferManager.recordEditorSwitch(undefined, previousEditor, Date.now());
  }

  function startFlushTimer(): NodeJS.Timeout {
    return setInterval(() => {
      void bufferManager.flushDueBuffers("timer");
    }, configService.getSnapshot().flushIntervalMs);
  }
}

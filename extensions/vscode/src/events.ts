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
        workspaceProject(event.document)
      );
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void bufferManager.recordSave(document, Date.now(), workspaceProject(document));
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      void bufferManager.recordEditorSwitch(previousEditor ?? undefined);
      if (editor) {
        bufferManager.updateCursor(
          editor.document,
          editor.selection,
          workspaceProject(editor.document)
        );
      }
      previousEditor = editor;
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      bufferManager.updateCursor(
        event.textEditor.document,
        event.selections[0],
        workspaceProject(event.textEditor.document)
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
      dispose: () => clearInterval(timer)
    }
  );

  function startFlushTimer(): NodeJS.Timeout {
    return setInterval(() => {
      void bufferManager.flushDueBuffers("timer");
    }, configService.getSnapshot().flushIntervalMs);
  }
}

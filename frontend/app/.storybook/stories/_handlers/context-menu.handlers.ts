/**
 * Context Menu MSW Handlers
 *
 * Mock Service Worker handlers for ContextMenu component stories.
 * Provides API mocking for context menu actions, dynamic menu items,
 * and various HTTP status scenarios.
 *
 * @module context-menu.handlers
 * @see {@link file://./../../../components/ui/context-menu.tsx}
 * @see {@link file://./../_factories/context-menu.factory.ts}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// ============================================================================
// API ENDPOINTS
// ============================================================================

/** Context menu action execution endpoint */
const API_CONTEXT_MENU_ACTION = '/api/context-menu/action';

/** Dynamic context menu items endpoint */
const API_CONTEXT_MENU_ITEMS = '/api/context-menu/items';

/** Clipboard operations endpoint */
const API_CLIPBOARD = '/api/clipboard';

/** File operations endpoint */
const API_FILE_OPERATION = '/api/file/operation';

/** Undo operation endpoint */
const API_UNDO = '/api/undo';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Action request body type */
interface ActionRequestBody {
  action: string;
  metadata?: {
    coordinates?: { x: number; y: number };
    source?: string;
    timestamp?: number;
  };
  payload?: Record<string, unknown>;
  targetId?: string;
}

/** Clipboard operation request body */
interface ClipboardRequestBody {
  content?: string;
  contentType?: string;
  operation: 'copy' | 'cut' | 'paste';
  targetId?: string;
}

/** File operation request body */
interface FileOperationRequestBody {
  destinationId?: string;
  fileId: string;
  newName?: string;
  operation: 'delete' | 'download' | 'duplicate' | 'move' | 'rename';
}

// ============================================================================
// DEFAULT SUCCESS HANDLERS
// ============================================================================

/**
 * Default context menu handlers for success scenarios
 */
export const contextMenuHandlers = [
  // POST /api/context-menu/action - Execute context menu action
  http.post(API_CONTEXT_MENU_ACTION, async ({ request }) => {
    const body = (await request.json()) as ActionRequestBody;
    await delay(faker.number.int({ min: 150, max: 400 }));

    return HttpResponse.json({
      success: true,
      action: body.action,
      targetId: body.targetId,
      executedAt: new Date().toISOString(),
      result: {
        message: i18n.t(
          'handler.contextMenu.actionCompletedSuccessfully',
          'Action "{{action}}" completed successfully',
          { action: body.action }
        ),
        affectedItems: 1,
      },
      metadata: body.metadata,
    });
  }),

  // GET /api/context-menu/items - Get dynamic context menu items
  http.get(API_CONTEXT_MENU_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const contextType = url.searchParams.get('type') ?? 'default';
    await delay(faker.number.int({ min: 100, max: 250 }));

    const menuItems = {
      default: [
        {
          id: 'copy',
          label: i18n.t('handler.contextMenu.copy', 'Copy'),
          icon: 'Copy',
          shortcut: '⌘C',
        },
        {
          id: 'cut',
          label: i18n.t('handler.contextMenu.cut', 'Cut'),
          icon: 'Scissors',
          shortcut: '⌘X',
        },
        {
          id: 'paste',
          label: i18n.t('handler.contextMenu.paste', 'Paste'),
          icon: 'Clipboard',
          shortcut: '⌘V',
        },
        { type: 'separator' },
        {
          id: 'select-all',
          label: i18n.t('handler.contextMenu.selectAll', 'Select All'),
          shortcut: '⌘A',
        },
        { type: 'separator' },
        {
          id: 'delete',
          label: i18n.t('handler.contextMenu.delete', 'Delete'),
          icon: 'Trash',
          destructive: true,
          shortcut: '⌫',
        },
      ],
      file: [
        {
          id: 'open',
          label: i18n.t('handler.contextMenu.open', 'Open'),
          icon: 'FileOpen',
          shortcut: '⌘O',
        },
        {
          id: 'open-with',
          label: i18n.t('handler.contextMenu.openWith', 'Open With...'),
          icon: 'ExternalLink',
        },
        { type: 'separator' },
        {
          id: 'rename',
          label: i18n.t('handler.contextMenu.rename', 'Rename'),
          icon: 'Edit',
          shortcut: '⏎',
        },
        {
          id: 'duplicate',
          label: i18n.t('handler.contextMenu.duplicate', 'Duplicate'),
          icon: 'Copy',
          shortcut: '⌘D',
        },
        {
          id: 'move',
          label: i18n.t('handler.contextMenu.moveTo', 'Move to...'),
          icon: 'FolderInput',
        },
        { type: 'separator' },
        {
          id: 'download',
          label: i18n.t('handler.contextMenu.download', 'Download'),
          icon: 'Download',
          shortcut: '⌘⇧D',
        },
        { id: 'share', label: i18n.t('handler.contextMenu.share', 'Share'), icon: 'Share' },
        { type: 'separator' },
        {
          id: 'delete',
          label: i18n.t('handler.contextMenu.moveToTrash', 'Move to Trash'),
          icon: 'Trash',
          destructive: true,
        },
      ],
      image: [
        {
          id: 'preview',
          label: i18n.t('handler.contextMenu.preview', 'Preview'),
          icon: 'Eye',
          shortcut: 'Space',
        },
        { id: 'edit', label: i18n.t('handler.contextMenu.edit', 'Edit'), icon: 'Edit' },
        { type: 'separator' },
        {
          id: 'copy-image',
          label: i18n.t('handler.contextMenu.copyImage', 'Copy Image'),
          icon: 'Copy',
        },
        {
          id: 'copy-link',
          label: i18n.t('handler.contextMenu.copyImageAddress', 'Copy Image Address'),
          icon: 'Link',
        },
        { type: 'separator' },
        {
          id: 'save-as',
          label: i18n.t('handler.contextMenu.saveImageAs', 'Save Image As...'),
          icon: 'Download',
        },
        {
          id: 'set-wallpaper',
          label: i18n.t('handler.contextMenu.setAsWallpaper', 'Set as Wallpaper'),
          icon: 'Image',
        },
      ],
      text: [
        {
          id: 'copy',
          label: i18n.t('handler.contextMenu.copy', 'Copy'),
          icon: 'Copy',
          shortcut: '⌘C',
        },
        {
          id: 'cut',
          label: i18n.t('handler.contextMenu.cut', 'Cut'),
          icon: 'Scissors',
          shortcut: '⌘X',
        },
        { type: 'separator' },
        {
          id: 'search',
          label: i18n.t('handler.contextMenu.searchWithGoogle', 'Search with Google'),
          icon: 'Search',
        },
        {
          id: 'translate',
          label: i18n.t('handler.contextMenu.translate', 'Translate'),
          icon: 'Languages',
        },
        { type: 'separator' },
        {
          id: 'speak',
          label: i18n.t('handler.contextMenu.speakSelection', 'Speak Selection'),
          icon: 'Volume2',
        },
      ],
      link: [
        {
          id: 'open-link',
          label: i18n.t('handler.contextMenu.openLink', 'Open Link'),
          icon: 'ExternalLink',
        },
        {
          id: 'open-new-tab',
          label: i18n.t('handler.contextMenu.openInNewTab', 'Open in New Tab'),
          icon: 'PlusSquare',
          shortcut: '⌘Click',
        },
        {
          id: 'open-new-window',
          label: i18n.t('handler.contextMenu.openInNewWindow', 'Open in New Window'),
          icon: 'Square',
        },
        { type: 'separator' },
        {
          id: 'copy-link',
          label: i18n.t('handler.contextMenu.copyLinkAddress', 'Copy Link Address'),
          icon: 'Link',
        },
        {
          id: 'copy-link-text',
          label: i18n.t('handler.contextMenu.copyLinkText', 'Copy Link Text'),
          icon: 'Type',
        },
        { type: 'separator' },
        {
          id: 'bookmark',
          label: i18n.t('handler.contextMenu.bookmarkLink', 'Bookmark Link'),
          icon: 'Bookmark',
        },
      ],
    };

    return HttpResponse.json({
      items: menuItems[contextType as keyof typeof menuItems] ?? menuItems.default,
      contextType,
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/clipboard - Clipboard operations
  http.post(API_CLIPBOARD, async ({ request }) => {
    const body = (await request.json()) as ClipboardRequestBody;
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      operation: body.operation,
      contentType: body.contentType ?? 'text/plain',
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/file/operation - File operations
  http.post(API_FILE_OPERATION, async ({ request }) => {
    const body = (await request.json()) as FileOperationRequestBody;
    await delay(faker.number.int({ min: 200, max: 600 }));

    const responses: Record<string, object> = {
      rename: {
        success: true,
        operation: 'rename',
        fileId: body.fileId,
        newName: body.newName,
        message: i18n.t('handler.contextMenu.fileRenamedTo', 'File renamed to "{{name}}"', {
          name: body.newName,
        }),
      },
      duplicate: {
        success: true,
        operation: 'duplicate',
        originalId: body.fileId,
        newId: faker.string.uuid(),
        message: i18n.t(
          'handler.contextMenu.fileDuplicatedSuccessfully',
          'File duplicated successfully'
        ),
      },
      delete: {
        success: true,
        operation: 'delete',
        fileId: body.fileId,
        message: i18n.t('handler.contextMenu.fileMovedToTrash', 'File moved to trash'),
        undoAvailable: true,
        undoExpiresAt: new Date(Date.now() + 30_000).toISOString(),
      },
      move: {
        success: true,
        operation: 'move',
        fileId: body.fileId,
        destinationId: body.destinationId,
        message: i18n.t('handler.contextMenu.fileMovedSuccessfully', 'File moved successfully'),
      },
      download: {
        success: true,
        operation: 'download',
        fileId: body.fileId,
        downloadUrl: `https://example.com/download/${body.fileId}`,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    };

    return HttpResponse.json(responses[body.operation] ?? { success: true });
  }),

  // POST /api/undo - Undo last action
  http.post(API_UNDO, async ({ request }) => {
    const body = (await request.json()) as { actionId: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      actionId: body.actionId,
      undoneAt: new Date().toISOString(),
      message: i18n.t('handler.contextMenu.actionUndoneSuccessfully', 'Action undone successfully'),
    });
  }),
];

// ============================================================================
// STATUS-SPECIFIC HANDLERS
// ============================================================================

/**
 * Context menu handlers organized by HTTP status for testing different scenarios
 */
export const contextMenuStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: contextMenuHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ACTION',
          i18n.t('handler.contextMenu.invalidContextMenuAction', 'Invalid context menu action'),
          API_CONTEXT_MENU_ACTION,
          { action: i18n.t('handler.contextMenu.actionTypeIsRequired', 'Action type is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.contextMenu.authenticationRequiredForThisAction',
            'Authentication required for this action'
          ),
          API_CONTEXT_MENU_ACTION
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.contextMenu.youDoNotHavePermission',
            'You do not have permission to perform this action'
          ),
          API_CONTEXT_MENU_ACTION
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t(
            'handler.contextMenu.theTargetResourceCouldNot',
            'The target resource could not be found'
          ),
          API_CONTEXT_MENU_ACTION
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.contextMenu.resourceIsLockedByAnother',
            'Resource is locked by another user'
          ),
          API_CONTEXT_MENU_ACTION,
          { lockedBy: 'user@example.com', lockedAt: new Date().toISOString() }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.contextMenu.unableToProcessActionDue',
            'Unable to process action due to validation errors'
          ),
          API_CONTEXT_MENU_ACTION,
          {
            targetId: i18n.t('handler.contextMenu.targetIdIsRequired', 'Target ID is required'),
            action: i18n.t('handler.contextMenu.actionNotSupported', 'Action not supported'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.contextMenu.tooManyRequestsPleaseTry',
            'Too many requests. Please try again later.'
          ),
          API_CONTEXT_MENU_ACTION,
          {
            limit: '100/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'ACTION_FAILED',
          i18n.t(
            'handler.contextMenu.failedToExecuteContextMenu',
            'Failed to execute context menu action'
          ),
          API_CONTEXT_MENU_ACTION,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.contextMenu.unableToReachUpstreamService',
            'Unable to reach upstream service'
          ),
          API_CONTEXT_MENU_ACTION
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.contextMenu.serviceIsTemporarilyUnavailableFor',
            'Service is temporarily unavailable for maintenance'
          ),
          API_CONTEXT_MENU_ACTION,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.contextMenu.requestTimedOutWhileProcessing',
            'Request timed out while processing'
          ),
          API_CONTEXT_MENU_ACTION
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_CONTEXT_MENU_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowAction: [
    http.post(API_CONTEXT_MENU_ACTION, async ({ request }) => {
      const body = (await request.json()) as ActionRequestBody;
      await delay(5000);
      return HttpResponse.json({
        success: true,
        action: body.action,
        message: i18n.t(
          'handler.contextMenu.slowActionCompletedAfter5',
          'Slow action completed after 5 seconds'
        ),
        duration: 5000,
      });
    }),
  ],

  slowResponse: [
    http.post(API_CONTEXT_MENU_ACTION, async ({ request }) => {
      const body = (await request.json()) as ActionRequestBody;
      await delay(5000);
      return HttpResponse.json({
        success: true,
        action: body.action,
        message: i18n.t(
          'handler.contextMenu.slowResponseCompletedAfter5',
          'Slow response completed after 5 seconds'
        ),
        duration: 5000,
      });
    }),
    http.get(API_CONTEXT_MENU_ITEMS, async ({ request }) => {
      const url = new URL(request.url);
      const contextType = url.searchParams.get('type') ?? 'default';
      await delay(5000);
      return HttpResponse.json({
        items: [
          {
            id: 'copy',
            label: i18n.t('handler.contextMenu.copy', 'Copy'),
            icon: 'Copy',
            shortcut: '⌘C',
          },
          {
            id: 'paste',
            label: i18n.t('handler.contextMenu.paste', 'Paste'),
            icon: 'Clipboard',
            shortcut: '⌘V',
          },
        ],
        contextType,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_CONTEXT_MENU_ACTION, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.get(API_CONTEXT_MENU_ITEMS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  // ============ DOMAIN-SPECIFIC HANDLERS ============

  /** Delete action with undo support */
  deleteWithUndo: [
    http.post(API_CONTEXT_MENU_ACTION, async ({ request }) => {
      const body = (await request.json()) as ActionRequestBody;
      await delay(500);

      if (body.action === 'delete') {
        return HttpResponse.json({
          success: true,
          action: 'delete',
          targetId: body.targetId,
          message: i18n.t('handler.contextMenu.itemMovedToTrash', 'Item moved to trash'),
          undoAvailable: true,
          undoExpiresAt: new Date(Date.now() + 30_000).toISOString(),
          undoAction: {
            endpoint: API_UNDO,
            method: 'POST',
            payload: { actionId: faker.string.uuid() },
          },
        });
      }

      return HttpResponse.json({ success: true, action: body.action });
    }),
  ],

  /** Clipboard operations */
  clipboardSuccess: [
    http.post(API_CLIPBOARD, async ({ request }) => {
      const body = (await request.json()) as ClipboardRequestBody;
      await delay(100);

      return HttpResponse.json({
        success: true,
        operation: body.operation,
        contentCopied: body.operation === 'copy' || body.operation === 'cut',
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  clipboardDenied: [
    http.post(API_CLIPBOARD, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'CLIPBOARD_DENIED',
          i18n.t(
            'handler.contextMenu.clipboardAccessWasDeniedBy',
            'Clipboard access was denied by the browser'
          ),
          API_CLIPBOARD
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  /** File operations with progress */
  fileOperationWithProgress: [
    http.post(API_FILE_OPERATION, async ({ request }) => {
      const body = (await request.json()) as FileOperationRequestBody;
      // Simulate longer operation with progress
      await delay(2000);

      return HttpResponse.json({
        success: true,
        operation: body.operation,
        fileId: body.fileId,
        progress: 100,
        message: i18n.t(
          'handler.contextMenu.operationCompletedSuccessfully',
          '{{operation}} completed successfully',
          { operation: body.operation }
        ),
      });
    }),
  ],

  /** Rename with validation */
  renameValidation: [
    http.post(API_FILE_OPERATION, async ({ request }) => {
      const body = (await request.json()) as FileOperationRequestBody;
      await delay(300);

      if (body.operation === 'rename') {
        // Simulate validation error for certain characters
        if (body.newName?.includes('/') || body.newName?.includes('\\')) {
          return HttpResponse.json(
            createApiError(
              HTTP_STATUS.BAD_REQUEST,
              'INVALID_FILENAME',
              i18n.t(
                'handler.contextMenu.fileNameContainsInvalidCharacters',
                'File name contains invalid characters'
              ),
              API_FILE_OPERATION,
              { invalidChars: '/, \\' }
            ),
            { status: HTTP_STATUS.BAD_REQUEST }
          );
        }

        // Simulate duplicate name error
        if (body.newName === 'existing-file.txt') {
          return HttpResponse.json(
            createApiError(
              HTTP_STATUS.CONFLICT,
              'DUPLICATE_NAME',
              i18n.t(
                'handler.contextMenu.aFileWithThisName',
                'A file with this name already exists'
              ),
              API_FILE_OPERATION
            ),
            { status: HTTP_STATUS.CONFLICT }
          );
        }

        return HttpResponse.json({
          success: true,
          operation: 'rename',
          fileId: body.fileId,
          newName: body.newName,
          message: i18n.t('handler.contextMenu.fileRenamedTo', 'File renamed to "{{name}}"', {
            name: body.newName,
          }),
        });
      }

      return HttpResponse.json({ success: true, operation: body.operation });
    }),
  ],

  /** Batch operations */
  batchOperation: [
    http.post(API_CONTEXT_MENU_ACTION, async ({ request }) => {
      const body = (await request.json()) as { targetIds?: string[] } & ActionRequestBody;
      await delay(faker.number.int({ min: 500, max: 1500 }));

      const targetCount = body.targetIds?.length ?? 1;

      return HttpResponse.json({
        success: true,
        action: body.action,
        targetIds: body.targetIds ?? [body.targetId],
        processedCount: targetCount,
        message: i18n.t(
          'handler.contextMenu.actionAppliedToItems',
          '{{action}} applied to {{count}} item(s)',
          { action: body.action, count: targetCount }
        ),
        results: Array.from({ length: targetCount }, (_, i) => ({
          id: body.targetIds?.[i] ?? body.targetId,
          success: true,
        })),
      });
    }),
  ],

  /** Partial batch failure */
  batchPartialFailure: [
    http.post(API_CONTEXT_MENU_ACTION, async ({ request }) => {
      const body = (await request.json()) as { targetIds?: string[] } & ActionRequestBody;
      await delay(faker.number.int({ min: 500, max: 1500 }));

      const targetIds = body.targetIds ?? [body.targetId];
      const results = targetIds.map((id, i) => ({
        id,
        success: i % 2 === 0, // Every other item fails
        error:
          i % 2 !== 0
            ? i18n.t('handler.contextMenu.permissionDenied', 'Permission denied')
            : undefined,
      }));

      const successCount = results.filter((r) => r.success).length;

      return HttpResponse.json({
        success: false,
        partialSuccess: true,
        action: body.action,
        processedCount: successCount,
        failedCount: results.length - successCount,
        message: i18n.t(
          'handler.contextMenu.itemsProcessedSuccessfully',
          '{{success}} of {{total}} items processed successfully',
          { success: successCount, total: results.length }
        ),
        results,
      });
    }),
  ],
};

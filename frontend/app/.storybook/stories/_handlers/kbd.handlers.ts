import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints (placeholder for component pattern consistency)
// Note: Kbd is a presentational component and typically doesn't make API calls.
// These handlers are provided for pattern consistency and potential future use cases
// such as loading shortcut configurations from an API.
const API_KBD_SHORTCUTS = '/api/kbd/shortcuts';
const API_KBD_CONFIG = '/api/kbd/config';

// Default success handlers
export const kbdHandlers = [
  // GET /api/kbd/shortcuts - Get available keyboard shortcuts
  http.get(API_KBD_SHORTCUTS, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      shortcuts: [
        {
          key: 'mod+k',
          label: i18n.t('handler.kbd.commandPalette', 'Command Palette'),
          description: i18n.t('handler.kbd.openCommandPalette', 'Open command palette'),
        },
        {
          key: 'mod+s',
          label: i18n.t('handler.kbd.save', 'Save'),
          description: i18n.t('handler.kbd.saveCurrentDocument', 'Save current document'),
        },
        {
          key: 'mod+z',
          label: i18n.t('handler.kbd.undo', 'Undo'),
          description: i18n.t('handler.kbd.undoLastAction', 'Undo last action'),
        },
        {
          key: 'mod+shift+z',
          label: i18n.t('handler.kbd.redo', 'Redo'),
          description: i18n.t('handler.kbd.redoLastUndoneAction', 'Redo last undone action'),
        },
        {
          key: 'mod+f',
          label: i18n.t('handler.kbd.find', 'Find'),
          description: i18n.t('handler.kbd.openSearch', 'Open search'),
        },
        {
          key: 'mod+p',
          label: i18n.t('handler.kbd.quickOpen', 'Quick Open'),
          description: i18n.t('handler.kbd.openFilePicker', 'Open file picker'),
        },
        {
          key: 'escape',
          label: i18n.t('handler.kbd.close', 'Close'),
          description: i18n.t('handler.kbd.closeCurrentPanel', 'Close current panel'),
        },
      ],
      platform: 'mac',
      modKey: '⌘',
    });
  }),

  // GET /api/kbd/config - Get keyboard configuration
  http.get(API_KBD_CONFIG, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));

    return HttpResponse.json({
      showShortcuts: true,
      showModifierSymbols: true,
      platform: 'mac',
      customBindings: {},
    });
  }),
];

// Status-specific handlers for stories
export const kbdStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: kbdHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PLATFORM',
          i18n.t('handler.kbd.invalidPlatformSpecified', 'Invalid platform specified'),
          API_KBD_SHORTCUTS
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.kbd.authenticationRequired', 'Authentication required'),
          API_KBD_SHORTCUTS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_KBD_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.kbd.cannotAccessKeyboardConfiguration',
            'Cannot access keyboard configuration'
          ),
          API_KBD_CONFIG
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.kbd.invalidShortcutConfiguration', 'Invalid shortcut configuration'),
          API_KBD_SHORTCUTS,
          { key: i18n.t('handler.kbd.keyFormatIsInvalid', 'Key format is invalid') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.kbd.tooManyRequests', 'Too many requests'),
          API_KBD_SHORTCUTS,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  notFound: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'SHORTCUTS_NOT_FOUND',
          i18n.t(
            'handler.kbd.keyboardShortcutsConfigurationNotFound',
            'Keyboard shortcuts configuration not found'
          ),
          API_KBD_SHORTCUTS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SHORTCUT_CONFLICT',
          i18n.t(
            'handler.kbd.keyboardShortcutConfigurationConflictDetected',
            'Keyboard shortcut configuration conflict detected'
          ),
          API_KBD_SHORTCUTS,
          { conflictingKey: 'mod+k' }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          i18n.t('handler.kbd.failedToLoadShortcuts', 'Failed to load shortcuts'),
          API_KBD_SHORTCUTS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.kbd.shortcutServiceUnavailable', 'Shortcut service unavailable'),
          API_KBD_SHORTCUTS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.kbd.serviceUnderMaintenance', 'Service under maintenance'),
          API_KBD_SHORTCUTS
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.kbd.requestTimedOut', 'Request timed out'),
          API_KBD_SHORTCUTS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(3000);
      return HttpResponse.json({
        shortcuts: [
          {
            key: 'mod+k',
            label: i18n.t('handler.kbd.command', 'Command'),
            description: i18n.t('handler.kbd.slowLoaded', 'Slow loaded'),
          },
        ],
      });
    }),
  ],

  networkError: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_KBD_SHORTCUTS, async () => {
      await delay(200);
      return HttpResponse.json({
        shortcuts: [],
        platform: 'mac',
        modKey: '⌘',
      });
    }),
  ],
};

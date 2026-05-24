import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// ============================================================================
// SHEET HANDLERS
// ============================================================================
// MSW handlers for Sheet component stories.
// Provides comprehensive API mocking for content loading, save operations,
// slide animations, overlay states, and dialog-content fetching.
// ============================================================================

// ============================================================================
// API ENDPOINTS
// ============================================================================

const API_SHEET_CONTENT = '/api/sheet/content';
const API_SHEET_SAVE = '/api/sheet/save';
const API_SHEET_SETTINGS = '/api/sheet/settings';
const API_DIALOG_CONTENT = '/api/dialog-content/:id';
const API_SHEET_SLIDE = '/api/sheet/slide';
const API_SHEET_OVERLAY = '/api/sheet/overlay';

// Default success handlers
export const sheetHandlers = [
  // GET /api/sheet/content - Load sheet content dynamically
  http.get(API_SHEET_CONTENT, async ({ request }) => {
    const url = new URL(request.url);
    const sheetId = url.searchParams.get('id') ?? 'default';
    const type = url.searchParams.get('type') ?? 'form';
    await delay(faker.number.int({ min: 200, max: 500 }));

    const contents: Record<string, object> = {
      form: {
        id: sheetId,
        type: 'form',
        title: i18n.t('handler.sheet.editProfile', 'Edit Profile'),
        description: i18n.t(
          'handler.sheet.makeChangesToYourProfile',
          'Make changes to your profile here.'
        ),
        fields: [
          {
            name: 'name',
            label: i18n.t('handler.sheet.name', 'Name'),
            type: 'text',
            value: faker.person.fullName(),
          },
          {
            name: 'username',
            label: i18n.t('handler.sheet.username', 'Username'),
            type: 'text',
            value: faker.internet.username(),
          },
          {
            name: 'email',
            label: i18n.t('handler.sheet.email', 'Email'),
            type: 'email',
            value: faker.internet.email(),
          },
        ],
      },
      settings: {
        id: sheetId,
        type: 'settings',
        title: i18n.t('handler.sheet.quickSettings', 'Quick Settings'),
        description: i18n.t('handler.sheet.adjustYourPreferences', 'Adjust your preferences.'),
        options: [
          {
            name: 'theme',
            label: i18n.t('handler.sheet.theme', 'Theme'),
            type: 'select',
            value: 'light',
            options: ['light', 'dark', 'system'],
          },
          {
            name: 'notifications',
            label: i18n.t('handler.sheet.notifications', 'Notifications'),
            type: 'switch',
            value: true,
          },
          {
            name: 'sound',
            label: i18n.t('handler.sheet.sound', 'Sound'),
            type: 'switch',
            value: false,
          },
        ],
      },
      details: {
        id: sheetId,
        type: 'details',
        title: faker.lorem.sentence({ min: 3, max: 6 }),
        description: faker.lorem.sentence({ min: 8, max: 15 }),
        content: faker.lorem.paragraphs({ min: 2, max: 4 }),
        metadata: {
          createdAt: faker.date.past().toISOString(),
          author: faker.person.fullName(),
        },
      },
    };

    return HttpResponse.json(contents[type] ?? contents.form);
  }),

  // POST /api/sheet/save - Save sheet form data
  http.post(API_SHEET_SAVE, async ({ request }) => {
    const body = (await request.json()) as { data: Record<string, unknown>; sheetId: string };
    await delay(faker.number.int({ min: 300, max: 700 }));

    return HttpResponse.json({
      success: true,
      sheetId: body.sheetId,
      savedData: body.data,
      savedAt: new Date().toISOString(),
    });
  }),

  // POST /api/sheet/settings - Update settings via sheet
  http.post(API_SHEET_SETTINGS, async ({ request }) => {
    const body = (await request.json()) as { settings: Record<string, unknown> };
    await delay(faker.number.int({ min: 200, max: 400 }));

    return HttpResponse.json({
      success: true,
      settings: body.settings,
      updatedAt: new Date().toISOString(),
    });
  }),

  // GET /api/dialog-content/:id - Fetch dialog/sheet content dynamically
  http.get(API_DIALOG_CONTENT, async ({ params }) => {
    const { id } = params;
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      id,
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      description: faker.lorem.sentence({ min: 8, max: 15 }),
      content: faker.lorem.paragraphs({ min: 1, max: 3 }),
      cancelLabel: faker.helpers.arrayElement([
        i18n.t('handler.sheet.cancel', 'Cancel'),
        i18n.t('handler.sheet.close', 'Close'),
        i18n.t('handler.sheet.dismiss', 'Dismiss'),
      ]),
      confirmLabel: faker.helpers.arrayElement([
        i18n.t('handler.sheet.save', 'Save'),
        i18n.t('handler.sheet.confirm', 'Confirm'),
        i18n.t('handler.sheet.apply', 'Apply'),
        i18n.t('handler.sheet.submit', 'Submit'),
      ]),
    });
  }),

  // POST /api/sheet/slide - Handle slide animation events
  http.post(API_SHEET_SLIDE, async ({ request }) => {
    const body = (await request.json()) as {
      action: 'close' | 'open';
      sheetId?: string;
      side: 'bottom' | 'left' | 'right' | 'top';
    };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      side: body.side,
      action: body.action,
      sheetId: body.sheetId ?? faker.string.uuid(),
      animationDuration: body.action === 'open' ? 500 : 300,
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/sheet/overlay - Handle overlay interaction events
  http.post(API_SHEET_OVERLAY, async ({ request }) => {
    const body = (await request.json()) as {
      action: 'click' | 'escape' | 'focus-trap';
      sheetId?: string;
    };
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      action: body.action,
      sheetId: body.sheetId ?? faker.string.uuid(),
      shouldClose: body.action === 'click' || body.action === 'escape',
      timestamp: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const sheetStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: sheetHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATA',
          i18n.t('handler.sheet.invalidFormData', 'Invalid form data'),
          API_SHEET_SAVE,
          {
            general: i18n.t(
              'handler.sheet.oneOrMoreFieldsAreInvalid',
              'One or more fields are invalid'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  notFound: [
    http.get(API_SHEET_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONTENT_NOT_FOUND',
          i18n.t('handler.sheet.sheetContentNotFound', 'Sheet content not found'),
          API_SHEET_CONTENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unauthorized: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.sheet.pleaseLogInToSave', 'Please log in to save changes'),
          API_SHEET_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  validationError: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          ...createApiError(
            HTTP_STATUS.UNPROCESSABLE_ENTITY,
            'VALIDATION_ERROR',
            i18n.t('handler.sheet.formValidationFailed', 'Form validation failed'),
            API_SHEET_SAVE
          ),
          errors: {
            email: i18n.t('handler.sheet.invalidEmailFormat', 'Invalid email format'),
            username: i18n.t('handler.sheet.usernameIsAlreadyTaken', 'Username is already taken'),
          },
        },
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  forbidden: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.sheet.accessDenied', 'Access denied'),
          API_SHEET_SAVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNPROCESSABLE_ENTITY',
          i18n.t('handler.sheet.unableToProcessRequest', 'Unable to process request'),
          API_SHEET_SAVE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  conflict: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t('handler.sheet.dataConflictDetected', 'Data conflict detected'),
          API_SHEET_SAVE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.sheet.tooManyRequests', 'Too many requests'),
          API_SHEET_SAVE
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  badGateway: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.sheet.badGateway', 'Bad gateway'),
          API_SHEET_SAVE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.sheet.gatewayTimeout', 'Gateway timeout'),
          API_SHEET_SAVE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  emptyData: [
    http.get(API_SHEET_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json({ id: 'empty', fields: [], content: '' });
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SAVE_FAILED',
          i18n.t('handler.sheet.failedToSaveChanges', 'Failed to save changes'),
          API_SHEET_SAVE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_SHEET_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.sheet.serviceTemporarilyUnavailable', 'Service temporarily unavailable'),
          API_SHEET_SAVE,
          { retryAfter: '300' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SHEET_CONTENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SHEET_CONTENT, async ({ request }) => {
      const url = new URL(request.url);
      const sheetId = url.searchParams.get('id') ?? 'default';
      await delay(4000);
      return HttpResponse.json({
        id: sheetId,
        type: 'details',
        title: i18n.t('handler.sheet.slowContent', 'Slow content'),
        content: i18n.t('handler.sheet.thisTookAWhileTo', 'This took a while to load.'),
      });
    }),
  ],

  slowSave: [
    http.post(API_SHEET_SAVE, async ({ request }) => {
      const body = (await request.json()) as { data: Record<string, unknown>; sheetId: string };
      await delay(5000);
      return HttpResponse.json({
        success: true,
        sheetId: body.sheetId,
        savedData: body.data,
      });
    }),
  ],

  networkError: [
    http.get(API_SHEET_CONTENT, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  // ============ SLIDE ANIMATION HANDLERS ============
  slideOpenSuccess: [
    http.post(API_SHEET_SLIDE, async ({ request }) => {
      const body = (await request.json()) as {
        action: 'close' | 'open';
        side: 'bottom' | 'left' | 'right' | 'top';
      };
      await delay(200);
      return HttpResponse.json({
        success: true,
        side: body.side,
        action: 'open',
        animationDuration: 500,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  slideCloseSuccess: [
    http.post(API_SHEET_SLIDE, async ({ request }) => {
      const body = (await request.json()) as {
        action: 'close' | 'open';
        side: 'bottom' | 'left' | 'right' | 'top';
      };
      await delay(150);
      return HttpResponse.json({
        success: true,
        side: body.side,
        action: 'close',
        animationDuration: 300,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  slideError: [
    http.post(API_SHEET_SLIDE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SLIDE_ANIMATION_FAILED',
          i18n.t(
            'handler.sheet.failedToCompleteSlideAnimation',
            'Failed to complete slide animation'
          ),
          API_SHEET_SLIDE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  // ============ OVERLAY HANDLERS ============
  overlayClickClose: [
    http.post(API_SHEET_OVERLAY, async () => {
      await delay(100);
      return HttpResponse.json({
        success: true,
        action: 'click',
        shouldClose: true,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  overlayEscapeClose: [
    http.post(API_SHEET_OVERLAY, async () => {
      await delay(50);
      return HttpResponse.json({
        success: true,
        action: 'escape',
        shouldClose: true,
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  overlayFocusTrap: [
    http.post(API_SHEET_OVERLAY, async () => {
      await delay(50);
      return HttpResponse.json({
        success: true,
        action: 'focus-trap',
        shouldClose: false,
        focusableElements: ['input', 'button', 'textarea', 'select'],
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  overlayPreventClose: [
    http.post(API_SHEET_OVERLAY, async () => {
      await delay(100);
      return HttpResponse.json({
        success: true,
        action: 'click',
        shouldClose: false,
        reason: 'unsaved_changes',
        message: i18n.t(
          'handler.sheet.youHaveUnsavedChangesAre',
          'You have unsaved changes. Are you sure you want to close?'
        ),
        timestamp: new Date().toISOString(),
      });
    }),
  ],

  // ============ DIALOG CONTENT HANDLERS ============
  dialogContentSuccess: [
    http.get(API_DIALOG_CONTENT, async ({ params }) => {
      const { id } = params;
      await delay(300);
      return HttpResponse.json({
        id,
        title: i18n.t('handler.sheet.dynamicSheetContent', 'Dynamic Sheet Content'),
        description: i18n.t(
          'handler.sheet.thisContentWasLoadedAsynchronously',
          'This content was loaded asynchronously.'
        ),
        content: i18n.t(
          'handler.sheet.sheetContentLoadedSuccessfullyFrom',
          'Sheet content loaded successfully from the server.'
        ),
        cancelLabel: i18n.t('handler.sheet.cancel', 'Cancel'),
        confirmLabel: i18n.t('handler.sheet.save', 'Save'),
      });
    }),
  ],

  dialogContentNotFound: [
    http.get(API_DIALOG_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONTENT_NOT_FOUND',
          i18n.t(
            'handler.sheet.theRequestedSheetContentCould',
            'The requested sheet content could not be found'
          ),
          API_DIALOG_CONTENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  dialogContentLoading: [
    http.get(API_DIALOG_CONTENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  dialogContentSlow: [
    http.get(API_DIALOG_CONTENT, async ({ params }) => {
      const { id } = params;
      await delay(5000);
      return HttpResponse.json({
        id,
        title: i18n.t('handler.sheet.slowlyLoadedContent', 'Slowly Loaded Content'),
        description: i18n.t(
          'handler.sheet.thisContentTookAWhile',
          'This content took a while to load.'
        ),
        content: i18n.t(
          'handler.sheet.finallyLoadedAfter5Seconds',
          'Finally loaded after 5 seconds.'
        ),
        cancelLabel: i18n.t('handler.sheet.close', 'Close'),
        confirmLabel: i18n.t('handler.sheet.done', 'Done'),
      });
    }),
  ],

  // ============ SIDE-SPECIFIC HANDLERS ============
  rightSideContent: [
    http.get(API_SHEET_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json({
        id: 'right-sheet',
        side: 'right',
        title: i18n.t('handler.sheet.rightSidePanel', 'Right Side Panel'),
        description: i18n.t(
          'handler.sheet.thisSheetSlidesInFrom',
          'This sheet slides in from the right edge.'
        ),
        content: i18n.t(
          'handler.sheet.rightsideContentTypicallyUsedFor',
          'Right-side content, typically used for detail views and forms.'
        ),
        width: 'sm:max-w-sm',
      });
    }),
  ],

  leftSideContent: [
    http.get(API_SHEET_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json({
        id: 'left-sheet',
        side: 'left',
        title: i18n.t('handler.sheet.leftSidePanel', 'Left Side Panel'),
        description: i18n.t(
          'handler.sheet.thisSheetSlidesInFrom2',
          'This sheet slides in from the left edge.'
        ),
        content: i18n.t(
          'handler.sheet.leftsideContentTypicallyUsedFor',
          'Left-side content, typically used for navigation and menus.'
        ),
        width: 'sm:max-w-sm',
      });
    }),
  ],

  topSideContent: [
    http.get(API_SHEET_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json({
        id: 'top-sheet',
        side: 'top',
        title: i18n.t('handler.sheet.topPanel', 'Top Panel'),
        description: i18n.t(
          'handler.sheet.thisSheetSlidesInFrom3',
          'This sheet slides in from the top edge.'
        ),
        content: i18n.t(
          'handler.sheet.topsideContentTypicallyUsedFor',
          'Top-side content, typically used for announcements and notifications.'
        ),
        height: 'h-auto',
      });
    }),
  ],

  bottomSideContent: [
    http.get(API_SHEET_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json({
        id: 'bottom-sheet',
        side: 'bottom',
        title: i18n.t('handler.sheet.bottomPanel', 'Bottom Panel'),
        description: i18n.t(
          'handler.sheet.thisSheetSlidesInFrom4',
          'This sheet slides in from the bottom edge.'
        ),
        content: i18n.t(
          'handler.sheet.bottomsideContentTypicallyUsedFor',
          'Bottom-side content, typically used for action sheets and mobile interactions.'
        ),
        height: 'h-auto',
      });
    }),
  ],

  // ============ ARIA/ACCESSIBILITY HANDLERS ============
  ariaDialogRole: [
    http.get(API_SHEET_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json({
        id: 'aria-sheet',
        title: i18n.t('handler.sheet.accessibleSheet', 'Accessible Sheet'),
        description: i18n.t(
          'handler.sheet.thisSheetFollowsAriaDialog',
          'This sheet follows ARIA dialog pattern.'
        ),
        content: i18n.t(
          'handler.sheet.contentWithProperAriaAttributes',
          'Content with proper ARIA attributes for screen readers.'
        ),
        ariaAttributes: {
          role: 'dialog',
          ariaModal: true,
          ariaLabelledby: 'sheet-title',
          ariaDescribedby: 'sheet-description',
        },
      });
    }),
  ],

  focusTrapTest: [
    http.post(API_SHEET_OVERLAY, async () => {
      await delay(100);
      return HttpResponse.json({
        success: true,
        action: 'focus-trap',
        focusableElements: [
          { selector: '[data-testid="input-1"]', tabIndex: 0 },
          { selector: '[data-testid="input-2"]', tabIndex: 0 },
          { selector: '[data-testid="textarea"]', tabIndex: 0 },
          { selector: '[data-testid="btn-cancel"]', tabIndex: 0 },
          { selector: '[data-testid="btn-save"]', tabIndex: 0 },
        ],
        initialFocus: '[data-testid="input-1"]',
        returnFocus: '[data-sheet-trigger]',
      });
    }),
  ],
};

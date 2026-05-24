import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_POPOVER_CONTENT = '/api/popover/content';
const API_POPOVER_SAVE = '/api/popover/save';
const API_POPOVER_DISMISS = '/api/popover/dismiss';

// Default success handlers
export const popoverHandlers = [
  // GET /api/popover/content - Load popover content dynamically
  http.get(API_POPOVER_CONTENT, async ({ request }) => {
    const url = new URL(request.url);
    const popoverId = url.searchParams.get('id') ?? 'default';
    const type = url.searchParams.get('type') ?? 'info';
    await delay(faker.number.int({ min: 150, max: 400 }));

    const contents: Record<string, object> = {
      info: {
        id: popoverId,
        type: 'info',
        title: faker.lorem.sentence({ min: 3, max: 6 }),
        description: faker.lorem.paragraph({ min: 1, max: 2 }),
        learnMoreUrl: faker.internet.url(),
      },
      dimensions: {
        id: popoverId,
        type: 'dimensions',
        fields: [
          {
            name: 'width',
            label: i18n.t('handler.popover.width', 'Width'),
            value: faker.number.int({ min: 100, max: 1000 }),
            unit: 'px',
          },
          {
            name: 'height',
            label: i18n.t('handler.popover.height', 'Height'),
            value: faker.number.int({ min: 100, max: 800 }),
            unit: 'px',
          },
          {
            name: 'maxWidth',
            label: i18n.t('handler.popover.maxWidth', 'Max Width'),
            value: faker.number.int({ min: 500, max: 2000 }),
            unit: 'px',
          },
        ],
      },
      settings: {
        id: popoverId,
        type: 'settings',
        options: [
          {
            name: 'autoPlay',
            label: i18n.t('handler.popover.autoPlay', 'Auto-play'),
            enabled: faker.datatype.boolean(),
          },
          {
            name: 'notifications',
            label: i18n.t('handler.popover.notifications', 'Notifications'),
            enabled: faker.datatype.boolean(),
          },
          {
            name: 'darkMode',
            label: i18n.t('handler.popover.darkMode', 'Dark mode'),
            enabled: faker.datatype.boolean(),
          },
        ],
      },
    };

    return HttpResponse.json(contents[type] ?? contents.info);
  }),

  // POST /api/popover/save - Save popover form data
  http.post(API_POPOVER_SAVE, async ({ request }) => {
    const body = (await request.json()) as { data: Record<string, unknown>; popoverId: string };
    await delay(faker.number.int({ min: 200, max: 400 }));

    return HttpResponse.json({
      success: true,
      popoverId: body.popoverId,
      savedData: body.data,
      savedAt: new Date().toISOString(),
    });
  }),

  // POST /api/popover/dismiss - Track popover dismissal (for onboarding/tips)
  http.post(API_POPOVER_DISMISS, async ({ request }) => {
    const body = (await request.json()) as { dontShowAgain?: boolean; popoverId: string };
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      popoverId: body.popoverId,
      dontShowAgain: body.dontShowAgain ?? false,
      dismissedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const popoverStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: popoverHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_POPOVER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATA',
          i18n.t('handler.popover.invalidPopoverData', 'Invalid popover data'),
          API_POPOVER_SAVE,
          { data: i18n.t('handler.popover.dataFormatIsInvalid', 'Data format is invalid') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_POPOVER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.popover.authenticationRequiredToAccessPopover',
            'Authentication required to access popover content'
          ),
          API_POPOVER_CONTENT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_POPOVER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.popover.authenticationRequiredToSavePopover',
            'Authentication required to save popover data'
          ),
          API_POPOVER_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_POPOVER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.popover.accessDeniedToPopoverContent',
            'Access denied to popover content'
          ),
          API_POPOVER_CONTENT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.post(API_POPOVER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.popover.accessDeniedToSavePopover', 'Access denied to save popover data'),
          API_POPOVER_SAVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_POPOVER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONTENT_NOT_FOUND',
          i18n.t('handler.popover.popoverContentNotFound', 'Popover content not found'),
          API_POPOVER_CONTENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_POPOVER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        {
          ...createApiError(
            HTTP_STATUS.UNPROCESSABLE_ENTITY,
            'VALIDATION_ERROR',
            i18n.t('handler.popover.validationFailed', 'Validation failed'),
            API_POPOVER_SAVE
          ),
          errors: {
            width: i18n.t(
              'handler.popover.widthMustBeBetween100',
              'Width must be between 100 and 2000'
            ),
            height: i18n.t(
              'handler.popover.heightMustBeAPositive',
              'Height must be a positive number'
            ),
          },
        },
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_POPOVER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.popover.tooManyPopoverRequestsPlease',
            'Too many popover requests. Please try again later.'
          ),
          API_POPOVER_CONTENT,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.post(API_POPOVER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.popover.popoverDataHasBeenModified',
            'Popover data has been modified by another user'
          ),
          API_POPOVER_SAVE,
          {
            suggestion: i18n.t(
              'handler.popover.pleaseRefreshAndTryAgain',
              'Please refresh and try again'
            ),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_POPOVER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SAVE_FAILED',
          i18n.t('handler.popover.failedToSavePopoverData', 'Failed to save popover data'),
          API_POPOVER_SAVE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_POPOVER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t('handler.popover.failedToLoadPopoverContent', 'Failed to load popover content'),
          API_POPOVER_CONTENT,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_POPOVER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.popover.popoverServiceTemporarilyUnavailable',
            'Popover service temporarily unavailable'
          ),
          API_POPOVER_CONTENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_POPOVER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.popover.popoverServiceIsUnderMaintenance',
            'Popover service is under maintenance'
          ),
          API_POPOVER_CONTENT,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_POPOVER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.popover.popoverRequestTimedOut', 'Popover request timed out'),
          API_POPOVER_CONTENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_POPOVER_CONTENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_POPOVER_CONTENT, async ({ request }) => {
      const url = new URL(request.url);
      const popoverId = url.searchParams.get('id') ?? 'default';
      await delay(3000);
      return HttpResponse.json({
        id: popoverId,
        type: 'info',
        title: i18n.t('handler.popover.slowContent', 'Slow content'),
        description: i18n.t('handler.popover.thisTookAWhileTo', 'This took a while to load.'),
      });
    }),
  ],

  networkError: [
    http.get(API_POPOVER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_POPOVER_SAVE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_POPOVER_CONTENT, async ({ request }) => {
      const url = new URL(request.url);
      const popoverId = url.searchParams.get('id') ?? 'default';
      await delay(200);
      return HttpResponse.json({
        id: popoverId,
        type: 'empty',
        title: null,
        description: null,
        fields: [],
      });
    }),
  ],
};

// ============================================================================
// DIALOG CONTENT HANDLERS (for async data loading stories)
// ============================================================================

const API_DIALOG_CONTENT = '/api/dialog-content';

/** Handlers for async popover content loading */
export const dialogContentHandlers = [
  // GET /api/dialog-content/:id - Load popover/dialog content dynamically
  http.get(`${API_DIALOG_CONTENT}/:id`, async ({ params }) => {
    const { id } = params;
    await delay(faker.number.int({ min: 200, max: 600 }));

    return HttpResponse.json({
      id,
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      description: faker.lorem.paragraph({ min: 1, max: 2 }),
      content: faker.lorem.paragraphs(2),
      metadata: {
        createdAt: faker.date.recent().toISOString(),
        author: faker.person.fullName(),
      },
    });
  }),
];

// Add dialog content handlers to main popover handlers
popoverHandlers.push(...dialogContentHandlers);

// ============================================================================
// ENTERPRISE FEATURE HANDLERS
// ============================================================================

const API_POPOVER_ANALYTICS = '/api/popover/analytics';
const API_POPOVER_ONBOARDING = '/api/popover/onboarding';

/** Enterprise analytics handlers */
export const popoverAnalyticsHandlers = [
  // POST /api/popover/analytics - Track popover interactions
  http.post(API_POPOVER_ANALYTICS, async ({ request }) => {
    const body = (await request.json()) as {
      action: string;
      popoverId: string;
      timestamp: number;
    };
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      eventId: `evt_${Date.now()}`,
      popoverId: body.popoverId,
      action: body.action,
      receivedAt: new Date().toISOString(),
    });
  }),
];

/** Onboarding flow handlers */
export const popoverOnboardingHandlers = [
  // GET /api/popover/onboarding/progress - Get onboarding progress
  http.get(`${API_POPOVER_ONBOARDING}/progress`, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      currentStep: faker.number.int({ min: 1, max: 5 }),
      totalSteps: 5,
      completedSteps: faker.helpers.arrayElements([1, 2, 3, 4, 5], { min: 0, max: 4 }),
      lastUpdated: new Date().toISOString(),
    });
  }),

  // POST /api/popover/onboarding/complete - Mark step as complete
  http.post(`${API_POPOVER_ONBOARDING}/complete`, async ({ request }) => {
    const body = (await request.json()) as { step: number };
    await delay(faker.number.int({ min: 100, max: 200 }));

    return HttpResponse.json({
      success: true,
      step: body.step,
      completedAt: new Date().toISOString(),
    });
  }),

  // POST /api/popover/onboarding/skip - Skip onboarding
  http.post(`${API_POPOVER_ONBOARDING}/skip`, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));

    return HttpResponse.json({
      success: true,
      skippedAt: new Date().toISOString(),
    });
  }),
];

/** All enterprise handlers combined */
export const popoverEnterpriseHandlers = [
  ...popoverHandlers,
  ...popoverAnalyticsHandlers,
  ...popoverOnboardingHandlers,
];

/** Enterprise status handlers for error scenarios */
export const popoverEnterpriseStatusHandlers = {
  ...popoverStatusHandlers,

  // Analytics errors
  analyticsError: [
    http.post(API_POPOVER_ANALYTICS, async () => {
      await delay(100);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'ANALYTICS_FAILED',
          i18n.t('handler.popover.failedToTrackPopoverEvent', 'Failed to track popover event'),
          API_POPOVER_ANALYTICS
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  // Onboarding errors
  onboardingLoadError: [
    http.get(`${API_POPOVER_ONBOARDING}/progress`, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'ONBOARDING_LOAD_FAILED',
          i18n.t(
            'handler.popover.failedToLoadOnboardingProgress',
            'Failed to load onboarding progress'
          ),
          `${API_POPOVER_ONBOARDING}/progress`
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  onboardingCompleteError: [
    http.post(`${API_POPOVER_ONBOARDING}/complete`, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_STEP',
          i18n.t('handler.popover.invalidOnboardingStep', 'Invalid onboarding step'),
          `${API_POPOVER_ONBOARDING}/complete`
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
};

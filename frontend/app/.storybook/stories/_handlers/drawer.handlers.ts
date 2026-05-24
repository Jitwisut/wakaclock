/**
 * Drawer MSW Handlers
 *
 * Mock Service Worker handlers for Drawer component stories.
 * Provides comprehensive API mocking for:
 * - Drawer content loading
 * - Form submissions from drawer forms
 * - Drawer actions (save, delete, etc.)
 * - Slide/overlay animation state management
 * - Swipe gesture simulation data
 *
 * @module drawer.handlers
 * @see {@link file://./../../../components/ui/drawer.tsx}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// ============================================================================
// CONSTANTS
// ============================================================================

/** Empty drawer title constant */
const EMPTY_DRAWER_TITLE = i18n.t('handler.drawer.emptyDrawer', 'Empty Drawer');
const LABEL_CANCEL = i18n.t('handler.drawer.cancel', 'Cancel');
const LABEL_CLOSE = i18n.t('handler.drawer.close', 'Close');

// ============================================================================
// API ENDPOINTS
// ============================================================================

/** Base drawer content endpoint */
const API_DRAWER_CONTENT = '/api/drawer/content';

/** Drawer content by ID */
const API_DRAWER_CONTENT_BY_ID = '/api/dialog-content/:id';

/** Drawer save endpoint */
const API_DRAWER_SAVE = '/api/drawer/save';

/** Drawer actions endpoint */
const API_DRAWER_ACTIONS = '/api/drawer/actions';

/** Drawer slide animation state endpoint */
const API_DRAWER_SLIDE_STATE = '/api/drawer/slide-state';

/** Drawer overlay state endpoint */
const API_DRAWER_OVERLAY_STATE = '/api/drawer/overlay-state';

/** Drawer swipe gesture endpoint */
const API_DRAWER_SWIPE_GESTURE = '/api/drawer/swipe-gesture';

/** Drawer snap point endpoint */
const API_DRAWER_SNAP_POINT = '/api/drawer/snap-point';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface DrawerContentResponse {
  cancelLabel: string;
  confirmLabel: string;
  content: string;
  description: string;
  direction?: 'bottom' | 'left' | 'right' | 'top';
  id: string;
  metadata?: {
    createdAt: string;
    updatedAt: string;
  };
  title: string;
}

interface SlideStateResponse {
  animationDuration: number;
  direction: 'bottom' | 'left' | 'right' | 'top';
  isAnimating: boolean;
  progress: number;
  state: 'closed' | 'closing' | 'open' | 'opening';
}

interface OverlayStateResponse {
  backdropBlur: boolean;
  isVisible: boolean;
  opacity: number;
}

interface SwipeGestureResponse {
  currentPosition: number;
  direction: 'down' | 'left' | 'right' | 'up';
  dismissed: boolean;
  startPosition: number;
  threshold: number;
  velocity: number;
}

interface SnapPointResponse {
  activeSnapPoint: null | number | string;
  availableSnapPoints: (number | string)[];
  direction: 'down' | 'up';
  nextSnapPoint: null | number | string;
}

// ============================================================================
// DEFAULT SUCCESS HANDLERS
// ============================================================================

export const drawerHandlers = [
  // GET /api/drawer/content - Load drawer content dynamically
  http.get(API_DRAWER_CONTENT, async ({ request }) => {
    const url = new URL(request.url);
    const drawerId = url.searchParams.get('id') ?? 'default';
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json<DrawerContentResponse>({
      id: drawerId,
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      description: faker.lorem.sentence({ min: 8, max: 15 }),
      content: faker.lorem.paragraphs({ min: 2, max: 4 }),
      cancelLabel: LABEL_CANCEL,
      confirmLabel: i18n.t('handler.drawer.save', 'Save'),
      direction: faker.helpers.arrayElement(['top', 'bottom', 'left', 'right']),
      metadata: {
        createdAt: faker.date.recent().toISOString(),
        updatedAt: faker.date.recent().toISOString(),
      },
    });
  }),

  // GET /api/dialog-content/:id - Load drawer content by ID (used by async stories)
  http.get(API_DRAWER_CONTENT_BY_ID, async ({ params }) => {
    const { id } = params;
    await delay(faker.number.int({ min: 300, max: 800 }));

    return HttpResponse.json<DrawerContentResponse>({
      id: String(id),
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      description: faker.lorem.sentence({ min: 8, max: 15 }),
      content: faker.lorem.paragraphs({ min: 2, max: 4 }),
      cancelLabel: LABEL_CANCEL,
      confirmLabel: i18n.t('handler.drawer.confirm', 'Confirm'),
      direction: 'bottom',
      metadata: {
        createdAt: faker.date.recent().toISOString(),
        updatedAt: faker.date.recent().toISOString(),
      },
    });
  }),

  // POST /api/drawer/save - Save drawer form data
  http.post(API_DRAWER_SAVE, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      success: true,
      data: body,
      savedAt: new Date().toISOString(),
      id: faker.string.uuid(),
    });
  }),

  // POST /api/drawer/actions - Execute drawer action
  http.post(API_DRAWER_ACTIONS, async ({ request }) => {
    const body = (await request.json()) as { action: string; data?: Record<string, unknown> };
    await delay(faker.number.int({ min: 200, max: 400 }));

    return HttpResponse.json({
      success: true,
      action: body.action,
      result: {
        message: i18n.t(
          'handler.drawer.actionExecutedSuccessfully',
          'Action "{{action}}" executed successfully',
          { action: body.action }
        ),
      },
    });
  }),

  // GET /api/drawer/slide-state - Get slide animation state
  http.get(API_DRAWER_SLIDE_STATE, async ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') ?? 'bottom';
    await delay(50);

    return HttpResponse.json<SlideStateResponse>({
      state: 'open',
      direction: direction as SlideStateResponse['direction'],
      progress: 1,
      isAnimating: false,
      animationDuration: 300,
    });
  }),

  // GET /api/drawer/overlay-state - Get overlay state
  http.get(API_DRAWER_OVERLAY_STATE, async () => {
    await delay(50);

    return HttpResponse.json<OverlayStateResponse>({
      isVisible: true,
      opacity: 0.5,
      backdropBlur: false,
    });
  }),

  // POST /api/drawer/swipe-gesture - Handle swipe gesture
  http.post(API_DRAWER_SWIPE_GESTURE, async ({ request }) => {
    const body = (await request.json()) as {
      direction: string;
      distance: number;
      velocity: number;
    };
    await delay(50);

    const dismissed = body.velocity > 0.5 || body.distance > 100;

    return HttpResponse.json<SwipeGestureResponse>({
      direction: body.direction as SwipeGestureResponse['direction'],
      velocity: body.velocity,
      startPosition: 0,
      currentPosition: body.distance,
      threshold: 100,
      dismissed,
    });
  }),

  // POST /api/drawer/snap-point - Handle snap point change
  http.post(API_DRAWER_SNAP_POINT, async ({ request }) => {
    const body = (await request.json()) as {
      currentSnapPoint: null | number | string;
      targetSnapPoint: number | string;
    };
    await delay(100);

    return HttpResponse.json<SnapPointResponse>({
      activeSnapPoint: body.targetSnapPoint,
      availableSnapPoints: [0.25, 0.5, 0.75, 1],
      nextSnapPoint: null,
      direction: 'up',
    });
  }),
];

// ============================================================================
// SLIDE/OVERLAY ANIMATION HANDLERS
// ============================================================================

/** Handlers for testing slide animation states */
export const slideAnimationHandlers = {
  /** Slide opening animation */
  opening: [
    http.get(API_DRAWER_SLIDE_STATE, async ({ request }) => {
      const url = new URL(request.url);
      const direction = url.searchParams.get('direction') ?? 'bottom';
      await delay(50);

      return HttpResponse.json<SlideStateResponse>({
        state: 'opening',
        direction: direction as SlideStateResponse['direction'],
        progress: 0.5,
        isAnimating: true,
        animationDuration: 300,
      });
    }),
  ],

  /** Slide closing animation */
  closing: [
    http.get(API_DRAWER_SLIDE_STATE, async ({ request }) => {
      const url = new URL(request.url);
      const direction = url.searchParams.get('direction') ?? 'bottom';
      await delay(50);

      return HttpResponse.json<SlideStateResponse>({
        state: 'closing',
        direction: direction as SlideStateResponse['direction'],
        progress: 0.5,
        isAnimating: true,
        animationDuration: 300,
      });
    }),
  ],

  /** Fully open state */
  open: [
    http.get(API_DRAWER_SLIDE_STATE, async ({ request }) => {
      const url = new URL(request.url);
      const direction = url.searchParams.get('direction') ?? 'bottom';
      await delay(50);

      return HttpResponse.json<SlideStateResponse>({
        state: 'open',
        direction: direction as SlideStateResponse['direction'],
        progress: 1,
        isAnimating: false,
        animationDuration: 300,
      });
    }),
  ],

  /** Fully closed state */
  closed: [
    http.get(API_DRAWER_SLIDE_STATE, async ({ request }) => {
      const url = new URL(request.url);
      const direction = url.searchParams.get('direction') ?? 'bottom';
      await delay(50);

      return HttpResponse.json<SlideStateResponse>({
        state: 'closed',
        direction: direction as SlideStateResponse['direction'],
        progress: 0,
        isAnimating: false,
        animationDuration: 300,
      });
    }),
  ],

  /** Slow animation (for testing) */
  slowAnimation: [
    http.get(API_DRAWER_SLIDE_STATE, async ({ request }) => {
      const url = new URL(request.url);
      const direction = url.searchParams.get('direction') ?? 'bottom';
      await delay(1000);

      return HttpResponse.json<SlideStateResponse>({
        state: 'opening',
        direction: direction as SlideStateResponse['direction'],
        progress: 0.3,
        isAnimating: true,
        animationDuration: 2000,
      });
    }),
  ],
};

/** Handlers for testing overlay states */
export const overlayHandlers = {
  /** Overlay visible */
  visible: [
    http.get(API_DRAWER_OVERLAY_STATE, async () => {
      await delay(50);
      return HttpResponse.json<OverlayStateResponse>({
        isVisible: true,
        opacity: 0.5,
        backdropBlur: false,
      });
    }),
  ],

  /** Overlay hidden */
  hidden: [
    http.get(API_DRAWER_OVERLAY_STATE, async () => {
      await delay(50);
      return HttpResponse.json<OverlayStateResponse>({
        isVisible: false,
        opacity: 0,
        backdropBlur: false,
      });
    }),
  ],

  /** Overlay with blur effect */
  blurred: [
    http.get(API_DRAWER_OVERLAY_STATE, async () => {
      await delay(50);
      return HttpResponse.json<OverlayStateResponse>({
        isVisible: true,
        opacity: 0.3,
        backdropBlur: true,
      });
    }),
  ],

  /** High opacity overlay */
  highOpacity: [
    http.get(API_DRAWER_OVERLAY_STATE, async () => {
      await delay(50);
      return HttpResponse.json<OverlayStateResponse>({
        isVisible: true,
        opacity: 0.8,
        backdropBlur: false,
      });
    }),
  ],
};

// ============================================================================
// SWIPE GESTURE HANDLERS
// ============================================================================

/** Handlers for testing swipe gestures */
export const swipeGestureHandlers = {
  /** Successful swipe dismiss */
  dismissSuccess: [
    http.post(API_DRAWER_SWIPE_GESTURE, async () => {
      await delay(50);
      return HttpResponse.json<SwipeGestureResponse>({
        direction: 'down',
        velocity: 1.2,
        startPosition: 0,
        currentPosition: 200,
        threshold: 100,
        dismissed: true,
      });
    }),
  ],

  /** Swipe below threshold (no dismiss) */
  belowThreshold: [
    http.post(API_DRAWER_SWIPE_GESTURE, async () => {
      await delay(50);
      return HttpResponse.json<SwipeGestureResponse>({
        direction: 'down',
        velocity: 0.2,
        startPosition: 0,
        currentPosition: 50,
        threshold: 100,
        dismissed: false,
      });
    }),
  ],

  /** Fast swipe (always dismiss) */
  fastSwipe: [
    http.post(API_DRAWER_SWIPE_GESTURE, async () => {
      await delay(50);
      return HttpResponse.json<SwipeGestureResponse>({
        direction: 'down',
        velocity: 2.5,
        startPosition: 0,
        currentPosition: 80,
        threshold: 100,
        dismissed: true,
      });
    }),
  ],

  /** Swipe up (for snap points) */
  swipeUp: [
    http.post(API_DRAWER_SWIPE_GESTURE, async () => {
      await delay(50);
      return HttpResponse.json<SwipeGestureResponse>({
        direction: 'up',
        velocity: 0.8,
        startPosition: 200,
        currentPosition: 50,
        threshold: 100,
        dismissed: false,
      });
    }),
  ],

  /** Horizontal swipe (left/right drawers) */
  swipeHorizontal: [
    http.post(API_DRAWER_SWIPE_GESTURE, async ({ request }) => {
      const body = (await request.json()) as { direction: string };
      await delay(50);
      return HttpResponse.json<SwipeGestureResponse>({
        direction: body.direction as 'left' | 'right',
        velocity: 1,
        startPosition: 0,
        currentPosition: 150,
        threshold: 100,
        dismissed: true,
      });
    }),
  ],
};

// ============================================================================
// SNAP POINT HANDLERS
// ============================================================================

/** Handlers for testing snap point interactions */
export const snapPointHandlers = {
  /** Snap to 25% */
  snapTo25: [
    http.post(API_DRAWER_SNAP_POINT, async () => {
      await delay(100);
      return HttpResponse.json<SnapPointResponse>({
        activeSnapPoint: 0.25,
        availableSnapPoints: [0.25, 0.5, 0.75, 1],
        nextSnapPoint: 0.5,
        direction: 'down',
      });
    }),
  ],

  /** Snap to 50% */
  snapTo50: [
    http.post(API_DRAWER_SNAP_POINT, async () => {
      await delay(100);
      return HttpResponse.json<SnapPointResponse>({
        activeSnapPoint: 0.5,
        availableSnapPoints: [0.25, 0.5, 0.75, 1],
        nextSnapPoint: 0.75,
        direction: 'up',
      });
    }),
  ],

  /** Snap to 75% */
  snapTo75: [
    http.post(API_DRAWER_SNAP_POINT, async () => {
      await delay(100);
      return HttpResponse.json<SnapPointResponse>({
        activeSnapPoint: 0.75,
        availableSnapPoints: [0.25, 0.5, 0.75, 1],
        nextSnapPoint: 1,
        direction: 'up',
      });
    }),
  ],

  /** Snap to full (100%) */
  snapToFull: [
    http.post(API_DRAWER_SNAP_POINT, async () => {
      await delay(100);
      return HttpResponse.json<SnapPointResponse>({
        activeSnapPoint: 1,
        availableSnapPoints: [0.25, 0.5, 0.75, 1],
        nextSnapPoint: null,
        direction: 'up',
      });
    }),
  ],
};

// ============================================================================
// STATUS-SPECIFIC HANDLERS
// ============================================================================

export const drawerStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: drawerHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_DRAWER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATA',
          i18n.t('handler.drawer.invalidFormData', 'Invalid form data'),
          API_DRAWER_SAVE,
          { title: i18n.t('handler.drawer.titleIsRequired', 'Title is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  notFound: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONTENT_NOT_FOUND',
          i18n.t('handler.drawer.drawerContentNotFound', 'Drawer content not found'),
          API_DRAWER_CONTENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.get(API_DRAWER_CONTENT_BY_ID, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONTENT_NOT_FOUND',
          i18n.t('handler.drawer.drawerContentNotFound', 'Drawer content not found'),
          API_DRAWER_CONTENT_BY_ID
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unauthorized: [
    http.post(API_DRAWER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.drawer.authenticationRequiredToSave', 'Authentication required to save'),
          API_DRAWER_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_DRAWER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.drawer.youDoNotHavePermission',
            'You do not have permission to save this drawer'
          ),
          API_DRAWER_SAVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  conflict: [
    http.post(API_DRAWER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.drawer.theDrawerContentHasBeen',
            'The drawer content has been modified by another user'
          ),
          API_DRAWER_SAVE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_DRAWER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.drawer.tooManyRequestsPleaseWait',
            'Too many requests. Please wait before trying again.'
          ),
          API_DRAWER_SAVE,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_DRAWER_SAVE, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          ...createApiError(
            HTTP_STATUS.UNPROCESSABLE_ENTITY,
            'VALIDATION_ERROR',
            i18n.t('handler.drawer.formValidationFailed', 'Form validation failed'),
            API_DRAWER_SAVE
          ),
          errors: {
            name: i18n.t('handler.drawer.nameMustBeAtLeast', 'Name must be at least 2 characters'),
            email: i18n.t('handler.drawer.invalidEmailFormat', 'Invalid email format'),
          },
        },
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  validationError: [
    http.post(API_DRAWER_SAVE, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          ...createApiError(
            HTTP_STATUS.UNPROCESSABLE_ENTITY,
            'VALIDATION_ERROR',
            i18n.t('handler.drawer.formValidationFailed', 'Form validation failed'),
            API_DRAWER_SAVE
          ),
          errors: {
            name: i18n.t('handler.drawer.nameMustBeAtLeast', 'Name must be at least 2 characters'),
            email: i18n.t('handler.drawer.invalidEmailFormat', 'Invalid email format'),
          },
        },
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_DRAWER_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SAVE_FAILED',
          i18n.t('handler.drawer.failedToSaveDrawerContent', 'Failed to save drawer content'),
          API_DRAWER_SAVE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t(
            'handler.drawer.invalidResponseFromUpstreamServer',
            'Invalid response from upstream server'
          ),
          API_DRAWER_CONTENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
    http.get(API_DRAWER_CONTENT_BY_ID, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t(
            'handler.drawer.invalidResponseFromUpstreamServer',
            'Invalid response from upstream server'
          ),
          API_DRAWER_CONTENT_BY_ID
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t('handler.drawer.serviceTemporarilyUnavailable', 'Service temporarily unavailable'),
          API_DRAWER_CONTENT,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
    http.get(API_DRAWER_CONTENT_BY_ID, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t('handler.drawer.serviceTemporarilyUnavailable', 'Service temporarily unavailable'),
          API_DRAWER_CONTENT_BY_ID,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t(
            'handler.drawer.theRequestTimedOutWaiting',
            'The request timed out waiting for upstream server'
          ),
          API_DRAWER_CONTENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
    http.get(API_DRAWER_CONTENT_BY_ID, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t(
            'handler.drawer.theRequestTimedOutWaiting',
            'The request timed out waiting for upstream server'
          ),
          API_DRAWER_CONTENT_BY_ID
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_DRAWER_CONTENT_BY_ID, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_DRAWER_CONTENT, async ({ request }) => {
      const url = new URL(request.url);
      const drawerId = url.searchParams.get('id') ?? 'default';
      await delay(5000);
      return HttpResponse.json<DrawerContentResponse>({
        id: drawerId,
        title: i18n.t('handler.drawer.slowloadedContent', 'Slow-loaded content'),
        description: i18n.t(
          'handler.drawer.thisContentTookAWhile',
          'This content took a while to load.'
        ),
        content: faker.lorem.paragraphs(2),
        cancelLabel: LABEL_CANCEL,
        confirmLabel: 'OK',
      });
    }),
    http.get(API_DRAWER_CONTENT_BY_ID, async ({ params }) => {
      const { id } = params;
      await delay(5000);
      return HttpResponse.json<DrawerContentResponse>({
        id: String(id),
        title: i18n.t('handler.drawer.slowloadedContent', 'Slow-loaded content'),
        description: i18n.t(
          'handler.drawer.thisContentTookAWhile',
          'This content took a while to load.'
        ),
        content: faker.lorem.paragraphs(2),
        cancelLabel: LABEL_CANCEL,
        confirmLabel: 'OK',
      });
    }),
  ],

  networkError: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.get(API_DRAWER_CONTENT_BY_ID, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyContent: [
    http.get(API_DRAWER_CONTENT, async ({ request }) => {
      const url = new URL(request.url);
      const drawerId = url.searchParams.get('id') ?? 'default';
      await delay(200);
      return HttpResponse.json({
        id: drawerId,
        title: EMPTY_DRAWER_TITLE,
        description: '',
        content: null,
        cancelLabel: LABEL_CLOSE,
        confirmLabel: 'OK',
        isEmpty: true,
      });
    }),
    http.get(API_DRAWER_CONTENT_BY_ID, async ({ params }) => {
      const { id } = params;
      await delay(200);
      return HttpResponse.json({
        id: String(id),
        title: EMPTY_DRAWER_TITLE,
        description: '',
        content: null,
        cancelLabel: LABEL_CLOSE,
        confirmLabel: 'OK',
        isEmpty: true,
      });
    }),
  ],

  // Alias for emptyContent (stories compatibility)
  emptyData: [
    http.get(API_DRAWER_CONTENT, async ({ request }) => {
      const url = new URL(request.url);
      const drawerId = url.searchParams.get('id') ?? 'default';
      await delay(200);
      return HttpResponse.json({
        id: drawerId,
        title: EMPTY_DRAWER_TITLE,
        description: '',
        content: null,
        cancelLabel: LABEL_CLOSE,
        confirmLabel: 'OK',
        isEmpty: true,
      });
    }),
    http.get(API_DRAWER_CONTENT_BY_ID, async ({ params }) => {
      const { id } = params;
      await delay(200);
      return HttpResponse.json({
        id: String(id),
        title: EMPTY_DRAWER_TITLE,
        description: '',
        content: null,
        cancelLabel: LABEL_CLOSE,
        confirmLabel: 'OK',
        isEmpty: true,
      });
    }),
  ],
};

// ============================================================================
// DIRECTION-SPECIFIC HANDLERS
// ============================================================================

/** Handlers for each drawer direction */
export const drawerDirectionHandlers = {
  /** Bottom drawer content */
  bottom: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json<DrawerContentResponse>({
        id: 'bottom-drawer',
        title: i18n.t('handler.drawer.bottomDrawer', 'Bottom Drawer'),
        description: i18n.t(
          'handler.drawer.thisDrawerSlidesUpFrom',
          'This drawer slides up from the bottom.'
        ),
        content: i18n.t(
          'handler.drawer.bottomDrawerContentWithSwipetodismiss',
          'Bottom drawer content with swipe-to-dismiss support.'
        ),
        cancelLabel: LABEL_CANCEL,
        confirmLabel: i18n.t('handler.drawer.confirm', 'Confirm'),
        direction: 'bottom',
      });
    }),
  ],

  /** Top drawer content */
  top: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json<DrawerContentResponse>({
        id: 'top-drawer',
        title: i18n.t('handler.drawer.topDrawer', 'Top Drawer'),
        description: i18n.t(
          'handler.drawer.thisDrawerSlidesDownFrom',
          'This drawer slides down from the top.'
        ),
        content: i18n.t(
          'handler.drawer.topDrawerContentTypicallyUsed',
          'Top drawer content, typically used for notifications or alerts.'
        ),
        cancelLabel: i18n.t('handler.drawer.dismiss', 'Dismiss'),
        confirmLabel: 'OK',
        direction: 'top',
      });
    }),
  ],

  /** Left drawer content */
  left: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json<DrawerContentResponse>({
        id: 'left-drawer',
        title: i18n.t('handler.drawer.leftDrawer', 'Left Drawer'),
        description: i18n.t(
          'handler.drawer.thisDrawerSlidesInFrom',
          'This drawer slides in from the left.'
        ),
        content: i18n.t(
          'handler.drawer.leftDrawerContentCommonlyUsed',
          'Left drawer content, commonly used for navigation menus.'
        ),
        cancelLabel: LABEL_CLOSE,
        confirmLabel: i18n.t('handler.drawer.apply', 'Apply'),
        direction: 'left',
      });
    }),
  ],

  /** Right drawer content */
  right: [
    http.get(API_DRAWER_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json<DrawerContentResponse>({
        id: 'right-drawer',
        title: i18n.t('handler.drawer.rightDrawer', 'Right Drawer'),
        description: i18n.t(
          'handler.drawer.thisDrawerSlidesInFrom2',
          'This drawer slides in from the right.'
        ),
        content: i18n.t(
          'handler.drawer.rightDrawerContentOftenUsed',
          'Right drawer content, often used for details panels or settings.'
        ),
        cancelLabel: LABEL_CANCEL,
        confirmLabel: i18n.t('handler.drawer.save', 'Save'),
        direction: 'right',
      });
    }),
  ],
};

// ============================================================================
// COMBINED HANDLER SETS
// ============================================================================

/** All drawer handlers combined */
export const allDrawerHandlers = [
  ...drawerHandlers,
  ...slideAnimationHandlers.open,
  ...overlayHandlers.visible,
];

/** Handlers for testing all directions */
export const allDirectionHandlers = [
  ...drawerDirectionHandlers.bottom,
  ...drawerDirectionHandlers.top,
  ...drawerDirectionHandlers.left,
  ...drawerDirectionHandlers.right,
];

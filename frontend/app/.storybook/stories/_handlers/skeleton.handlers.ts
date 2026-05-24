import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SKELETON_CONFIG = '/api/skeleton/config';
const API_SKELETON_CONTENT = '/api/skeleton/content';
const API_SKELETON_PREVIEW = '/api/skeleton/preview';

// Default success handlers
export const skeletonHandlers = [
  // GET /api/skeleton/config - Get skeleton configuration
  http.get(API_SKELETON_CONFIG, async ({ request }) => {
    const url = new URL(request.url);
    const variant = url.searchParams.get('variant') ?? 'default';

    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      variant,
      animation: faker.helpers.arrayElement(['pulse', 'shimmer', 'none']),
      shape: faker.helpers.arrayElement(['rectangle', 'circle', 'rounded']),
      baseColor: faker.color.rgb(),
      highlightColor: faker.color.rgb(),
      duration: faker.number.int({ min: 1000, max: 3000 }),
    });
  }),

  // GET /api/skeleton/content - Simulate loading content
  http.get(API_SKELETON_CONTENT, async ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? 'card';
    const loadTime = Number(url.searchParams.get('loadTime') ?? 2000);

    await delay(loadTime);

    const contentTypes: Record<string, unknown> = {
      card: {
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        image: `/images/placeholder/${faker.number.int({ min: 1, max: 10 })}.jpg`,
        author: faker.person.fullName(),
        date: faker.date.recent().toISOString(),
      },
      profile: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        avatar: `/images/avatars/0${faker.number.int({ min: 1, max: 5 })}.png`,
        bio: faker.lorem.sentences(2),
        joinedAt: faker.date.past().toISOString(),
      },
      list: {
        items: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => ({
          id: faker.string.uuid(),
          title: faker.lorem.words({ min: 2, max: 5 }),
          subtitle: faker.lorem.sentence(),
        })),
      },
      text: {
        paragraphs: Array.from({ length: 3 }, () => faker.lorem.paragraph()),
      },
    };

    return HttpResponse.json({
      type,
      content: contentTypes[type] ?? contentTypes.card,
      loadedAt: new Date().toISOString(),
    });
  }),

  // GET /api/skeleton/preview - Get preview dimensions
  http.get(API_SKELETON_PREVIEW, async ({ request }) => {
    const url = new URL(request.url);
    const layout = url.searchParams.get('layout') ?? 'default';

    await delay(faker.number.int({ min: 100, max: 250 }));

    interface SkeletonLayout {
      columns: number;
      gap: number;
      items: Array<{ height: number; shape: string; width: number | string }>;
      rows: number;
    }

    const layouts: Record<string, SkeletonLayout> = {
      default: {
        rows: 3,
        columns: 1,
        gap: 16,
        items: [
          { width: '100%', height: 200, shape: 'rounded' },
          { width: '60%', height: 24, shape: 'rounded' },
          { width: '100%', height: 80, shape: 'rounded' },
        ],
      },
      profile: {
        rows: 4,
        columns: 1,
        gap: 12,
        items: [
          { width: 80, height: 80, shape: 'circle' },
          { width: '50%', height: 20, shape: 'rounded' },
          { width: '30%', height: 16, shape: 'rounded' },
          { width: '100%', height: 60, shape: 'rounded' },
        ],
      },
      table: {
        rows: 5,
        columns: 4,
        gap: 8,
        items: Array.from({ length: 20 }, () => ({
          width: '100%',
          height: 16,
          shape: 'rounded',
        })),
      },
    };

    const selectedLayout = layouts[layout] ?? layouts.default;
    return HttpResponse.json({
      layout,
      ...selectedLayout,
    });
  }),
];

// Status-specific handlers for stories
export const skeletonStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: skeletonHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.skeleton.invalidSkeletonContentParameters',
            'Invalid skeleton content parameters'
          ),
          API_SKELETON_CONTENT,
          {
            type: i18n.t(
              'handler.skeleton.invalidContentTypeSpecified',
              'Invalid content type specified'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SKELETON_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.skeleton.authenticationRequiredToLoadSkeleton',
            'Authentication required to load skeleton config'
          ),
          API_SKELETON_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.skeleton.accessDeniedToSkeletonContent',
            'Access denied to skeleton content'
          ),
          API_SKELETON_CONTENT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SKELETON_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONFIG_NOT_FOUND',
          i18n.t(
            'handler.skeleton.skeletonConfigurationNotFound',
            'Skeleton configuration not found'
          ),
          API_SKELETON_CONFIG
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONTENT_CONFLICT',
          i18n.t(
            'handler.skeleton.contentWasModifiedDuringLoading',
            'Content was modified during loading'
          ),
          API_SKELETON_CONTENT
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_SKELETON_PREVIEW, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.skeleton.invalidSkeletonPreviewLayout',
            'Invalid skeleton preview layout'
          ),
          API_SKELETON_PREVIEW,
          {
            layout: i18n.t(
              'handler.skeleton.layoutMustBeOneOfDefaultProfileTable',
              'Layout must be one of: default, profile, table'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.skeleton.tooManyContentRequestsPlease',
            'Too many content requests. Please wait.'
          ),
          API_SKELETON_CONTENT,
          { retryAfter: '10' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SKELETON_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t(
            'handler.skeleton.failedToLoadSkeletonConfiguration',
            'Failed to load skeleton configuration'
          ),
          API_SKELETON_CONFIG,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t('handler.skeleton.failedToLoadSkeletonContent', 'Failed to load skeleton content'),
          API_SKELETON_CONTENT,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.skeleton.contentServiceTemporarilyUnavailable',
            'Content service temporarily unavailable'
          ),
          API_SKELETON_CONTENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SKELETON_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.skeleton.skeletonServiceIsUnderMaintenance',
            'Skeleton service is under maintenance'
          ),
          API_SKELETON_CONFIG,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.skeleton.contentRequestTimedOut', 'Content request timed out'),
          API_SKELETON_CONTENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SKELETON_CONFIG, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_SKELETON_CONTENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(6000);
      return HttpResponse.json({
        type: 'card',
        content: {
          title: i18n.t('handler.skeleton.slowlyLoadedContent', 'Slowly Loaded Content'),
          description: i18n.t(
            'handler.skeleton.thisContentTookAWhile',
            'This content took a while to load.'
          ),
        },
        loadedAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.get(API_SKELETON_CONFIG, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SKELETON_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json({
        type: 'empty',
        content: null,
        loadedAt: new Date().toISOString(),
      });
    }),
    http.get(API_SKELETON_PREVIEW, async () => {
      await delay(200);
      return HttpResponse.json({
        layout: 'empty',
        rows: 0,
        columns: 0,
        gap: 0,
        items: [],
      });
    }),
  ],
};

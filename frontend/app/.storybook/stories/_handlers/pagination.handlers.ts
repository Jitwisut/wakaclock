import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_PAGINATION_CONFIG = '/api/pagination/config';
const API_PAGINATION_NAVIGATE = '/api/pagination/navigate';
const API_PAGINATION_DATA = '/api/pagination/data';

// Default success handlers
export const paginationHandlers = [
  // GET /api/pagination/config - Get pagination configuration
  http.get(API_PAGINATION_CONFIG, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      totalPages: faker.number.int({ min: 10, max: 100 }),
      currentPage: 1,
      pageSize: 10,
      siblingCount: 1,
      showFirstLast: true,
      showPrevNext: true,
    });
  }),

  // POST /api/pagination/navigate - Navigate to a specific page
  http.post(API_PAGINATION_NAVIGATE, async ({ request }) => {
    const body = (await request.json()) as { page: number; pageSize?: number };
    await delay(faker.number.int({ min: 150, max: 400 }));

    const totalItems = faker.number.int({ min: 100, max: 1000 });
    const pageSize = body.pageSize ?? 10;
    const totalPages = Math.ceil(totalItems / pageSize);
    const page = Math.max(1, Math.min(body.page, totalPages));

    return HttpResponse.json({
      success: true,
      currentPage: page,
      totalPages,
      pageSize,
      totalItems,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  }),

  // GET /api/pagination/data - Get paginated data
  http.get(API_PAGINATION_DATA, async ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10);

    await delay(faker.number.int({ min: 200, max: 500 }));

    const totalItems = 150;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;

    const items = Array.from({ length: Math.min(pageSize, totalItems - startIndex) }, (_, i) => ({
      id: faker.string.uuid(),
      index: startIndex + i + 1,
      name: faker.person.fullName(),
      email: faker.internet.email(),
    }));

    return HttpResponse.json({
      items,
      pagination: {
        currentPage: page,
        totalPages,
        pageSize,
        totalItems,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  }),
];

// Status-specific handlers for stories
export const paginationStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: paginationHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_PAGINATION_NAVIGATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PAGE',
          i18n.t('handler.pagination.invalidPageNumberProvided', 'Invalid page number provided'),
          API_PAGINATION_NAVIGATE,
          {
            page: i18n.t('handler.pagination.mustBeAPositiveInteger', 'Must be a positive integer'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.pagination.invalidPaginationParameters', 'Invalid pagination parameters'),
          API_PAGINATION_DATA,
          {
            pageSize: i18n.t(
              'handler.pagination.mustBeBetween1And100',
              'Must be between 1 and 100'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_PAGINATION_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.pagination.authenticationRequiredToAccessPagination',
            'Authentication required to access pagination'
          ),
          API_PAGINATION_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.pagination.authenticationRequiredToAccessPaginated',
            'Authentication required to access paginated data'
          ),
          API_PAGINATION_DATA
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_PAGINATION_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.pagination.accessDeniedToPaginationConfiguration',
            'Access denied to pagination configuration'
          ),
          API_PAGINATION_CONFIG
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.pagination.accessDeniedToPaginatedData',
            'Access denied to paginated data'
          ),
          API_PAGINATION_DATA
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'PAGE_NOT_FOUND',
          i18n.t('handler.pagination.theRequestedPageDoesNot', 'The requested page does not exist'),
          API_PAGINATION_DATA
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.post(API_PAGINATION_NAVIGATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'PAGE_NOT_FOUND',
          i18n.t('handler.pagination.theRequestedPageDoesNot', 'The requested page does not exist'),
          API_PAGINATION_NAVIGATE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_PAGINATION_NAVIGATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.pagination.pageNavigationValidationFailed',
            'Page navigation validation failed'
          ),
          API_PAGINATION_NAVIGATE,
          {
            page: i18n.t(
              'handler.pagination.pageNumberExceedsTotalPages',
              'Page number exceeds total pages'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.pagination.tooManyPaginationRequestsPlease',
            'Too many pagination requests. Please slow down.'
          ),
          API_PAGINATION_DATA,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
    http.post(API_PAGINATION_NAVIGATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.pagination.tooManyNavigationRequestsPlease',
            'Too many navigation requests. Please slow down.'
          ),
          API_PAGINATION_NAVIGATE,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'DATA_CONFLICT',
          i18n.t(
            'handler.pagination.paginatedDataHasBeenModified',
            'Paginated data has been modified. Please refresh.'
          ),
          API_PAGINATION_DATA,
          { lastModifiedAt: faker.date.recent().toISOString() }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
    http.post(API_PAGINATION_NAVIGATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'NAVIGATION_CONFLICT',
          i18n.t(
            'handler.pagination.pageDataHasChangedPlease',
            'Page data has changed. Please refresh and try again.'
          ),
          API_PAGINATION_NAVIGATE,
          { lastModifiedAt: faker.date.recent().toISOString() }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          i18n.t('handler.pagination.failedToLoadPaginatedData', 'Failed to load paginated data'),
          API_PAGINATION_DATA,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_PAGINATION_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'CONFIG_ERROR',
          i18n.t(
            'handler.pagination.failedToLoadPaginationConfiguration',
            'Failed to load pagination configuration'
          ),
          API_PAGINATION_CONFIG,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.pagination.paginationServiceTemporarilyUnavailable',
            'Pagination service temporarily unavailable'
          ),
          API_PAGINATION_DATA
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.pagination.paginationServiceIsUnderMaintenance',
            'Pagination service is under maintenance'
          ),
          API_PAGINATION_DATA,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.pagination.paginationRequestTimedOut', 'Pagination request timed out'),
          API_PAGINATION_DATA
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_PAGINATION_CONFIG, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_PAGINATION_DATA, async ({ request }) => {
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page') ?? 1);
      const pageSize = Number(url.searchParams.get('pageSize') ?? 10);

      await delay(4000);

      const totalItems = 50;
      const totalPages = Math.ceil(totalItems / pageSize);

      return HttpResponse.json({
        items: Array.from({ length: pageSize }, (_, i) => ({
          id: faker.string.uuid(),
          index: (page - 1) * pageSize + i + 1,
          name: faker.person.fullName(),
        })),
        pagination: {
          currentPage: page,
          totalPages,
          pageSize,
          totalItems,
        },
      });
    }),
  ],

  networkError: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_PAGINATION_NAVIGATE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_PAGINATION_DATA, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          pageSize: 10,
          totalItems: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }),
  ],
};

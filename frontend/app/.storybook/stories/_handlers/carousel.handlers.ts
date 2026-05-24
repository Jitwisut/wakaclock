import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeSlides } from '../_factories/carousel.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SLIDES = '/api/slides';

// Default success handlers
export const carouselHandlers = [
  // GET /api/slides
  http.get(API_SLIDES, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 5);
    const category = url.searchParams.get('category');

    await delay(faker.number.int({ min: 300, max: 800 }));

    const slides = createFakeSlides(count);

    return HttpResponse.json({
      slides,
      total: slides.length,
      category: category ?? 'all',
    });
  }),
];

// Status-specific handlers for stories
export const carouselStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: carouselHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.carousel.invalidQueryParameters', 'Invalid query parameters'),
          API_SLIDES,
          {
            count: i18n.t(
              'handler.carousel.mustBeAPositiveInteger',
              'Must be a positive integer between 1 and 50'
            ),
            category: i18n.t(
              'handler.carousel.invalidCategorySpecified',
              'Invalid category specified'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.carousel.authenticationRequiredToViewSlides',
            'Authentication required to view slides'
          ),
          API_SLIDES
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.carousel.accessDeniedToThisCarousel',
            'Access denied to this carousel content'
          ),
          API_SLIDES
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CATEGORY_NOT_FOUND',
          i18n.t(
            'handler.carousel.theRequestedSlideCategoryDoes',
            'The requested slide category does not exist'
          ),
          API_SLIDES
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SLIDE_CONFLICT',
          i18n.t(
            'handler.carousel.slideResourceConflictDetected',
            'Slide resource conflict detected'
          ),
          API_SLIDES
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.carousel.requestValidationFailed', 'Request validation failed'),
          API_SLIDES,
          {
            field: 'data',
            error: i18n.t('handler.carousel.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_SLIDES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.carousel.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_SLIDES,
          {
            limit: '200/hour',
            remaining: '0',
            resetAt: new Date(Date.now() + 3_600_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'MEDIA_ERROR',
          i18n.t('handler.carousel.failedToRetrieveSlideMedia', 'Failed to retrieve slide media'),
          API_SLIDES,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'CDN_ERROR',
          i18n.t('handler.carousel.mediaCdnUnavailable', 'Media CDN unavailable'),
          API_SLIDES
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.carousel.carouselServiceIsUnderMaintenance',
            'Carousel service is under maintenance'
          ),
          API_SLIDES,
          {
            retryAfter: '600',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.carousel.mediaServiceTimedOut', 'Media service timed out'),
          API_SLIDES
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SLIDES, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SLIDES, async () => {
      await delay(5000);
      return HttpResponse.json({
        slides: createFakeSlides(5),
        total: 5,
        category: 'all',
      });
    }),
  ],

  networkError: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SLIDES, async () => {
      await delay(300);
      return HttpResponse.json({
        slides: [],
        total: 0,
        category: 'all',
      });
    }),
  ],
};

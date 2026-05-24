import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============ API ENDPOINT CONSTANTS ============

const API_MEDIA_IMAGE = '/api/media/image/:id';
const API_MEDIA_VIDEO = '/api/media/video/:id';
const API_MEDIA_EMBED = '/api/media/embed/:id';

// ============ RESPONSE TYPES ============

interface MediaImageResponse {
  alt: string;
  aspectRatio: number;
  height: number;
  id: string;
  src: string;
  width: number;
}

interface MediaVideoResponse {
  aspectRatio: number;
  duration: number;
  id: string;
  poster: string;
  src: string;
  title: string;
}

interface MediaEmbedResponse {
  aspectRatio: number;
  embedUrl: string;
  id: string;
  provider: string;
  title: string;
}

// ============ DEFAULT SUCCESS HANDLERS ============

/**
 * Default handlers for aspect ratio media API endpoints
 * Simulates successful responses with realistic delays
 */
export const aspectRatioHandlers = [
  // Get image metadata endpoint
  http.get(API_MEDIA_IMAGE, async ({ params }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    const aspectRatios = [16 / 9, 4 / 3, 1, 3 / 2, 21 / 9];
    const aspectRatio = faker.helpers.arrayElement(aspectRatios);
    const width = faker.helpers.arrayElement([800, 1200, 1920, 2560]);
    const height = Math.round(width / aspectRatio);

    const response: MediaImageResponse = {
      id: params.id as string,
      src: `/images/products/0${faker.number.int({ min: 1, max: 9 })}.jpeg`,
      alt: faker.lorem.sentence({ min: 3, max: 8 }),
      width,
      height,
      aspectRatio,
    };

    return HttpResponse.json(response, { status: HTTP_STATUS.OK });
  }),

  // Get video metadata endpoint
  http.get(API_MEDIA_VIDEO, async ({ params }) => {
    await delay(faker.number.int({ min: 150, max: 400 }));

    const response: MediaVideoResponse = {
      id: params.id as string,
      src: faker.internet.url(),
      poster: `/images/products/0${faker.number.int({ min: 1, max: 9 })}.jpeg`,
      title: faker.lorem.words({ min: 2, max: 5 }),
      aspectRatio: faker.helpers.arrayElement([16 / 9, 21 / 9, 4 / 3]),
      duration: faker.number.int({ min: 30, max: 600 }),
    };

    return HttpResponse.json(response, { status: HTTP_STATUS.OK });
  }),

  // Get embed metadata endpoint
  http.get(API_MEDIA_EMBED, async ({ params }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    const providers = [
      'YouTube',
      i18n.t('handler.aspectRatio.vimeo', 'Vimeo'),
      i18n.t('handler.aspectRatio.dailymotion', 'Dailymotion'),
      i18n.t('handler.aspectRatio.twitch', 'Twitch'),
    ];
    const provider = faker.helpers.arrayElement(providers);

    const response: MediaEmbedResponse = {
      id: params.id as string,
      embedUrl: `https://www.${provider.toLowerCase()}.com/embed/${faker.string.alphanumeric(11)}`,
      title: faker.lorem.words({ min: 3, max: 7 }),
      aspectRatio: 16 / 9,
      provider,
    };

    return HttpResponse.json(response, { status: HTTP_STATUS.OK });
  }),
];

// ============ STATUS-SPECIFIC HANDLERS ============

export const aspectRatioStatusHandlers = {
  // Success handlers
  success: aspectRatioHandlers,

  // 4xx Client Errors
  badRequest: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMETERS',
          i18n.t('handler.aspectRatio.invalidImageParameters', 'Invalid image parameters'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.aspectRatio.authenticationRequired', 'Authentication required'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.get(API_MEDIA_VIDEO, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.aspectRatio.authenticationRequired', 'Authentication required'),
          API_MEDIA_VIDEO
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t('handler.aspectRatio.accessDeniedToMedia', 'Access denied to media'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'IMAGE_NOT_FOUND',
          i18n.t('handler.aspectRatio.imageNotFound', 'Image not found'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.get(API_MEDIA_VIDEO, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'VIDEO_NOT_FOUND',
          i18n.t('handler.aspectRatio.videoNotFound', 'Video not found'),
          API_MEDIA_VIDEO
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.get(API_MEDIA_EMBED, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'EMBED_NOT_FOUND',
          i18n.t('handler.aspectRatio.embedNotFound', 'Embed not found'),
          API_MEDIA_EMBED
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'MEDIA_CONFLICT',
          i18n.t(
            'handler.aspectRatio.mediaResourceConflictDetected',
            'Media resource conflict detected'
          ),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.aspectRatio.requestValidationFailed', 'Request validation failed'),
          API_MEDIA_IMAGE,
          {
            field: 'data',
            error: i18n.t('handler.aspectRatio.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT_EXCEEDED',
          i18n.t('handler.aspectRatio.rateLimitExceeded', 'Rate limit exceeded'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'INTERNAL_ERROR',
          i18n.t('handler.aspectRatio.internalServerError', 'Internal server error'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_MEDIA_VIDEO, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'INTERNAL_ERROR',
          i18n.t('handler.aspectRatio.internalServerError', 'Internal server error'),
          API_MEDIA_VIDEO
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.aspectRatio.mediaServiceUnavailable', 'Media service unavailable'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.aspectRatio.serviceTemporarilyUnavailable',
            'Service temporarily unavailable'
          ),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.aspectRatio.gatewayTimeout', 'Gateway timeout'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: HTTP_STATUS.OK });
    }),
    http.get(API_MEDIA_VIDEO, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: HTTP_STATUS.OK });
    }),
    http.get(API_MEDIA_EMBED, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: HTTP_STATUS.OK });
    }),
  ],

  slowResponse: [
    http.get(API_MEDIA_IMAGE, async ({ params }) => {
      await delay(5000);
      return HttpResponse.json(
        {
          id: params.id,
          src: '/images/products/01.jpeg',
          alt: i18n.t('handler.aspectRatio.slowLoadedImage', 'Slow loaded image'),
          width: 1920,
          height: 1080,
          aspectRatio: 16 / 9,
        },
        { status: HTTP_STATUS.OK }
      );
    }),
  ],

  networkError: [
    http.get(API_MEDIA_IMAGE, () => HttpResponse.error()),
    http.get(API_MEDIA_VIDEO, () => HttpResponse.error()),
    http.get(API_MEDIA_EMBED, () => HttpResponse.error()),
  ],

  // Domain-specific handlers
  corruptedImage: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'CORRUPTED_FILE',
          i18n.t('handler.aspectRatio.imageFileIsCorrupted', 'Image file is corrupted'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  unsupportedFormat: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNSUPPORTED_FORMAT',
          i18n.t('handler.aspectRatio.unsupportedImageFormat', 'Unsupported image format'),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  dimensionsTooLarge: [
    http.get(API_MEDIA_IMAGE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'DIMENSIONS_TOO_LARGE',
          i18n.t(
            'handler.aspectRatio.imageDimensionsExceedMaximumAllowed',
            'Image dimensions exceed maximum allowed'
          ),
          API_MEDIA_IMAGE
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
};

// ============ GALLERY HANDLERS ============

/**
 * Handlers for image gallery scenarios
 */
export const galleryHandlers = [
  http.get('/api/gallery', async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));

    const images = Array.from({ length: faker.number.int({ min: 6, max: 12 }) }, (_, i) => {
      const aspectRatios = [16 / 9, 4 / 3, 1, 3 / 2];
      const aspectRatio = aspectRatios[i % aspectRatios.length];
      const width = faker.helpers.arrayElement([400, 600, 800]);

      return {
        id: faker.string.uuid(),
        src: `/images/products/0${(i % 9) + 1}.jpeg`,
        alt: faker.lorem.sentence(),
        width,
        height: Math.round(width / aspectRatio),
        aspectRatio,
      };
    });

    return HttpResponse.json({ images }, { status: HTTP_STATUS.OK });
  }),
];

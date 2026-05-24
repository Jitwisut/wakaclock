import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS MISC HANDLERS
// Enterprise-grade MSW handlers for miscellaneous app pages:
// - Social Media
// - POS System
// - Text to Speech
// - Todo List
// - API Keys
// - AI Image Generator
// ============================================================================

// API Endpoints
const API_SOCIAL = '/api/apps/social';
const API_POS = '/api/apps/pos';
const API_TTS = '/api/apps/tts';
const API_TODO = '/api/apps/todo';
const API_API_KEYS = '/api/apps/api-keys';
const API_IMAGE_GEN = '/api/apps/image-gen';

// ============================================================================
// SOCIAL MEDIA HANDLERS
// ============================================================================

export const appsSocialHandlers = [
  http.get(`${API_SOCIAL}/feed`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const posts = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      author: {
        name: faker.person.fullName(),
        avatar: faker.image.avatar(),
        username: faker.internet.username(),
      },
      content: faker.lorem.paragraphs({ min: 1, max: 3 }),
      image: faker.datatype.boolean({ probability: 0.5 }) ? faker.image.url() : null,
      likes: faker.number.int({ min: 0, max: 1000 }),
      comments: faker.number.int({ min: 0, max: 100 }),
      shares: faker.number.int({ min: 0, max: 50 }),
      createdAt: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ posts });
  }),
];

// ============================================================================
// POS SYSTEM HANDLERS
// ============================================================================

export const appsPosHandlers = [
  http.get(`${API_POS}/products`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const products = Array.from({ length: 20 }, () => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      price: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
      category: faker.commerce.department(),
      stock: faker.number.int({ min: 0, max: 100 }),
      barcode: faker.string.numeric(13),
    }));
    return HttpResponse.json({ products });
  }),

  http.post(`${API_POS}/checkout`, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    const body = (await request.json()) as { items: Array<{ id: string; quantity: number }> };
    return HttpResponse.json({
      transactionId: faker.string.uuid(),
      total: faker.number.float({ min: 10, max: 500, fractionDigits: 2 }),
      itemsCount: body.items.reduce((sum, item) => sum + item.quantity, 0),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(`${API_POS}/tables`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const tables = Array.from({ length: 12 }, (_, i) => ({
      id: `table-${i + 1}`,
      number: i + 1,
      capacity: faker.helpers.arrayElement([2, 4, 6, 8]),
      status: faker.helpers.arrayElement(['available', 'occupied', 'reserved', 'cleaning']),
      currentOrder: faker.helpers.maybe(() => ({
        total: faker.number.float({ min: 20, max: 200, fractionDigits: 2 }),
        items: faker.number.int({ min: 1, max: 10 }),
        startedAt: faker.date.recent().toISOString(),
      })),
    }));
    return HttpResponse.json({ tables });
  }),
];

// ============================================================================
// TEXT TO SPEECH HANDLERS
// ============================================================================

export const appsTtsHandlers = [
  http.post(`${API_TTS}/synthesize`, async ({ request }) => {
    await delay(faker.number.int({ min: 500, max: 1500 }));
    const body = (await request.json()) as { text: string; voice: string };
    return HttpResponse.json({
      audioUrl: faker.internet.url(),
      duration: faker.number.float({ min: 1, max: 60, fractionDigits: 2 }),
      text: body.text,
      voice: body.voice,
      createdAt: new Date().toISOString(),
    });
  }),

  http.get(`${API_TTS}/voices`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const voices = [
      {
        id: 'en-us-female-1',
        name: i18n.t('handler.appsMisc.sarah', 'Sarah'),
        language: 'en-US',
        gender: 'female',
      },
      {
        id: 'en-us-male-1',
        name: i18n.t('handler.appsMisc.john', 'John'),
        language: 'en-US',
        gender: 'male',
      },
      {
        id: 'en-gb-female-1',
        name: i18n.t('handler.appsMisc.emma', 'Emma'),
        language: 'en-GB',
        gender: 'female',
      },
      {
        id: 'ja-jp-female-1',
        name: i18n.t('handler.appsMisc.yuki', 'Yuki'),
        language: 'ja-JP',
        gender: 'female',
      },
    ];
    return HttpResponse.json({ voices });
  }),
];

// ============================================================================
// TODO LIST HANDLERS
// ============================================================================

export const appsTodoHandlers = [
  http.get(`${API_TODO}/items`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const items = Array.from({ length: 15 }, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 3, max: 8 }),
      completed: faker.datatype.boolean({ probability: 0.4 }),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
      dueDate: faker.helpers.maybe(() => faker.date.soon().toISOString()),
      createdAt: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ items });
  }),

  http.post(`${API_TODO}/items`, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as { title: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      title: body.title,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// API KEYS HANDLERS
// ============================================================================

export const appsApiKeysHandlers = [
  http.get(`${API_API_KEYS}/list`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const keys = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        i18n.t('handler.appsMisc.production', 'Production'),
        i18n.t('handler.appsMisc.development', 'Development'),
        i18n.t('handler.appsMisc.testing', 'Testing'),
        i18n.t('handler.appsMisc.staging', 'Staging'),
      ]),
      key: `sk_${faker.helpers.arrayElement(['live', 'test'])}_${faker.string.alphanumeric(32)}`,
      createdAt: faker.date.past().toISOString(),
      lastUsed: faker.helpers.maybe(() => faker.date.recent().toISOString()),
      permissions: faker.helpers.arrayElements(
        ['read', 'write', 'delete', 'admin'],
        faker.number.int({ min: 1, max: 4 })
      ),
    }));
    return HttpResponse.json({ keys });
  }),

  http.post(`${API_API_KEYS}/create`, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const body = (await request.json()) as { name: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      name: body.name,
      key: `sk_live_${faker.string.alphanumeric(32)}`,
      secret: faker.string.alphanumeric(64),
      createdAt: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// AI IMAGE GENERATOR HANDLERS
// ============================================================================

export const appsImageGenHandlers = [
  http.post(`${API_IMAGE_GEN}/generate`, async ({ request }) => {
    await delay(faker.number.int({ min: 2000, max: 5000 }));
    const body = (await request.json()) as { prompt: string; style?: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      prompt: body.prompt,
      style: body.style || 'realistic',
      images: Array.from({ length: 4 }, () => ({
        url: faker.image.url(),
        thumbnail: faker.image.url(),
      })),
      createdAt: new Date().toISOString(),
    });
  }),

  http.get(`${API_IMAGE_GEN}/history`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const generations = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      prompt: faker.lorem.sentence(),
      style: faker.helpers.arrayElement(['realistic', 'artistic', 'anime', 'abstract']),
      imageUrl: faker.image.url(),
      createdAt: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ generations });
  }),
];

// ============================================================================
// COMBINED STATUS HANDLERS
// ============================================================================

export const appsMiscStatusHandlers = {
  success: [
    ...appsSocialHandlers,
    ...appsPosHandlers,
    ...appsTtsHandlers,
    ...appsTodoHandlers,
    ...appsApiKeysHandlers,
    ...appsImageGenHandlers,
  ],
  badRequest: [
    http.get(API_SOCIAL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.appsMisc.invalidRequestParameters', 'Invalid request parameters'),
          API_SOCIAL,
          {
            field: 'data',
            error: i18n.t('handler.appsMisc.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(`${API_API_KEYS}/list`, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsMisc.authenticationRequired', 'Authentication required'),
          API_API_KEYS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(`${API_API_KEYS}/create`, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.appsMisc.cannotCreateApiKeys', 'Cannot create API keys'),
          `${API_API_KEYS}/create`
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_SOCIAL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsMisc.requestValidationFailed', 'Request validation failed'),
          API_SOCIAL,
          {
            field: 'data',
            error: i18n.t('handler.appsMisc.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(`${API_IMAGE_GEN}/generate`, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.appsMisc.tooManyGenerationRequests', 'Too many generation requests'),
          `${API_IMAGE_GEN}/generate`
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  internalServerError: [
    http.post(`${API_TTS}/synthesize`, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appsMisc.ttsServiceUnavailable', 'TTS service unavailable'),
          `${API_TTS}/synthesize`
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.post(`${API_IMAGE_GEN}/generate`, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(`${API_SOCIAL}/feed`, () => HttpResponse.error())],
};

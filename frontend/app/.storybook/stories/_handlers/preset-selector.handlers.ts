import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// PRESET SELECTOR HANDLERS
// Enterprise-grade MSW handlers for theme preset selector component
// ============================================================================

// API Endpoints
const API_PRESET = '/api/preset';
const API_PRESET_LIST = '/api/preset/list';
const API_PRESET_CURRENT = '/api/preset/current';
const API_PRESET_APPLY = '/api/preset/apply';
const API_PRESET_CREATE = '/api/preset/create';
const API_PRESET_DELETE = '/api/preset/:id';

// Types
interface ThemePreset {
  colors: {
    accent: string;
    background: string;
    primary: string;
    secondary: string;
  };
  createdAt: string;
  description: string;
  id: string;
  isCustom: boolean;
  isDefault: boolean;
  name: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const presetSelectorHandlers = [
  // GET all presets
  http.get(API_PRESET_LIST, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const presets: ThemePreset[] = [
      {
        id: 'default',
        name: i18n.t('handler.presetSelector.default', 'Default'),
        description: i18n.t(
          'handler.presetSelector.theDefaultThemePreset',
          'The default theme preset'
        ),
        colors: {
          primary: '#3b82f6',
          secondary: '#64748b',
          accent: '#f59e0b',
          background: '#ffffff',
        },
        isDefault: true,
        isCustom: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ocean',
        name: i18n.t('handler.presetSelector.ocean', 'Ocean'),
        description: i18n.t('handler.presetSelector.coolBlueOceanTheme', 'Cool blue ocean theme'),
        colors: {
          primary: '#0ea5e9',
          secondary: '#06b6d4',
          accent: '#14b8a6',
          background: '#f0f9ff',
        },
        isDefault: false,
        isCustom: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'forest',
        name: i18n.t('handler.presetSelector.forest', 'Forest'),
        description: i18n.t(
          'handler.presetSelector.naturalGreenForestTheme',
          'Natural green forest theme'
        ),
        colors: {
          primary: '#22c55e',
          secondary: '#84cc16',
          accent: '#eab308',
          background: '#f0fdf4',
        },
        isDefault: false,
        isCustom: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sunset',
        name: i18n.t('handler.presetSelector.sunset', 'Sunset'),
        description: i18n.t('handler.presetSelector.warmSunsetColors', 'Warm sunset colors'),
        colors: {
          primary: '#f97316',
          secondary: '#ef4444',
          accent: '#ec4899',
          background: '#fff7ed',
        },
        isDefault: false,
        isCustom: false,
        createdAt: new Date().toISOString(),
      },
    ];
    return HttpResponse.json({ presets });
  }),

  // GET current preset
  http.get(API_PRESET_CURRENT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      presetId: faker.helpers.arrayElement(['default', 'ocean', 'forest', 'sunset']),
      appliedAt: new Date().toISOString(),
    });
  }),

  // POST apply preset
  http.post(API_PRESET_APPLY, async ({ request }) => {
    await delay(faker.number.int({ min: 150, max: 350 }));
    const body = (await request.json()) as { presetId: string };
    return HttpResponse.json({
      success: true,
      presetId: body.presetId,
      appliedAt: new Date().toISOString(),
    });
  }),

  // POST create custom preset
  http.post(API_PRESET_CREATE, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const body = (await request.json()) as Partial<ThemePreset>;
    const newPreset: ThemePreset = {
      id: faker.string.uuid(),
      name: body.name || i18n.t('handler.presetSelector.customPreset', 'Custom Preset'),
      description:
        body.description ||
        i18n.t('handler.presetSelector.aCustomThemePreset', 'A custom theme preset'),
      colors: body.colors || {
        primary: '#3b82f6',
        secondary: '#64748b',
        accent: '#f59e0b',
        background: '#ffffff',
      },
      isDefault: false,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };
    return HttpResponse.json({ preset: newPreset });
  }),

  // DELETE preset
  http.delete(API_PRESET_DELETE, async ({ params }) => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    return HttpResponse.json({
      success: true,
      deletedId: params.id,
      deletedAt: new Date().toISOString(),
    });
  }),

  // Generic endpoint
  http.get(API_PRESET, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      totalPresets: 4,
      customPresetsAllowed: true,
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const presetSelectorStatusHandlers = {
  // Success
  success: presetSelectorHandlers,

  // 4xx Client Errors
  badRequest: [
    http.post(API_PRESET_APPLY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PRESET_ID',
          i18n.t('handler.presetSelector.invalidPresetId', 'Invalid preset ID'),
          API_PRESET_APPLY
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_PRESET_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.presetSelector.authenticationRequiredToCreatePresets',
            'Authentication required to create presets'
          ),
          API_PRESET_CREATE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.delete(API_PRESET_DELETE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'DELETE_FORBIDDEN',
          i18n.t(
            'handler.presetSelector.cannotDeleteDefaultPresets',
            'Cannot delete default presets'
          ),
          API_PRESET_DELETE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_PRESET_APPLY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.presetSelector.presetNotFound', 'Preset not found'),
          API_PRESET_APPLY
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_PRESET_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'NAME_CONFLICT',
          i18n.t(
            'handler.presetSelector.aPresetWithThisName',
            'A preset with this name already exists'
          ),
          API_PRESET_CREATE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_PRESET_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_COLORS',
          i18n.t(
            'handler.presetSelector.invalidColorValuesInPreset',
            'Invalid color values in preset'
          ),
          API_PRESET_CREATE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_PRESET_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.presetSelector.tooManyPresetOperationsPlease',
            'Too many preset operations. Please wait.'
          ),
          API_PRESET_CREATE
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_PRESET_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.presetSelector.failedToLoadPresets', 'Failed to load presets'),
          API_PRESET_LIST
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_PRESET_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.presetSelector.presetServiceUnavailable', 'Preset service unavailable'),
          API_PRESET_LIST
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_PRESET_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.presetSelector.presetServiceTemporarilyUnavailable',
            'Preset service temporarily unavailable'
          ),
          API_PRESET_LIST
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_PRESET_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.presetSelector.presetServiceTimeout', 'Preset service timeout'),
          API_PRESET_LIST
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_PRESET_LIST, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_PRESET_LIST, async () => {
      await delay(3000);
      return HttpResponse.json({ presets: [] });
    }),
  ],

  networkError: [http.get(API_PRESET_LIST, () => HttpResponse.error())],

  emptyData: [
    http.get(API_PRESET_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ presets: [] });
    }),
  ],
};

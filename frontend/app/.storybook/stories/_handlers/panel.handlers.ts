import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// THEME CUSTOMIZER PANEL HANDLERS
// Enterprise-grade MSW handlers for theme customizer panel component
// ============================================================================

// API Endpoints
const API_PANEL = '/api/panel';
const API_PANEL_CONFIG = '/api/panel/config';
const API_PANEL_STATE = '/api/panel/state';
const API_PANEL_SETTINGS = '/api/panel/settings';
const API_PANEL_EXPORT = '/api/panel/export';
const API_PANEL_IMPORT = '/api/panel/import';

// Types
interface PanelConfig {
  isOpen: boolean;
  pinned: boolean;
  position: 'left' | 'right';
  sections: string[];
  width: number;
}

interface PanelSettings {
  animationDuration: number;
  animationEnabled: boolean;
  closeOnOutsideClick: boolean;
  rememberState: boolean;
  showOverlay: boolean;
}

interface ThemeExport {
  exportedAt: string;
  settings: PanelSettings;
  theme: Record<string, unknown>;
  version: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const panelHandlers = [
  // GET panel config
  http.get(API_PANEL_CONFIG, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const config: PanelConfig = {
      isOpen: faker.datatype.boolean(),
      position: faker.helpers.arrayElement(['left', 'right']),
      width: faker.helpers.arrayElement([320, 360, 400]),
      pinned: faker.datatype.boolean(),
      sections: ['colors', 'radius', 'scale', 'layout'],
    };
    return HttpResponse.json(config);
  }),

  // PUT update panel config
  http.put(API_PANEL_CONFIG, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const body = (await request.json()) as Partial<PanelConfig>;
    return HttpResponse.json({
      success: true,
      config: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // GET panel state
  http.get(API_PANEL_STATE, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    return HttpResponse.json({
      isOpen: faker.datatype.boolean(),
      activeSection: faker.helpers.arrayElement(['colors', 'radius', 'scale', 'layout', null]),
      lastModified: new Date().toISOString(),
    });
  }),

  // POST toggle panel state
  http.post(API_PANEL_STATE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as { isOpen: boolean };
    return HttpResponse.json({
      success: true,
      isOpen: body.isOpen,
      timestamp: new Date().toISOString(),
    });
  }),

  // GET panel settings
  http.get(API_PANEL_SETTINGS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const settings: PanelSettings = {
      animationEnabled: true,
      animationDuration: 300,
      closeOnOutsideClick: true,
      showOverlay: true,
      rememberState: true,
    };
    return HttpResponse.json(settings);
  }),

  // PUT update panel settings
  http.put(API_PANEL_SETTINGS, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const body = (await request.json()) as Partial<PanelSettings>;
    return HttpResponse.json({
      success: true,
      settings: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // POST export theme
  http.post(API_PANEL_EXPORT, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const exportData: ThemeExport = {
      theme: {
        colorMode: 'dark',
        radius: 'md',
        scale: 1,
        preset: 'default',
      },
      settings: {
        animationEnabled: true,
        animationDuration: 300,
        closeOnOutsideClick: true,
        showOverlay: true,
        rememberState: true,
      },
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    return HttpResponse.json(exportData);
  }),

  // POST import theme
  http.post(API_PANEL_IMPORT, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const body = (await request.json()) as ThemeExport;
    return HttpResponse.json({
      success: true,
      imported: body,
      appliedAt: new Date().toISOString(),
    });
  }),

  // Generic endpoint
  http.get(API_PANEL, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      features: ['export', 'import', 'presets', 'customization'],
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const panelStatusHandlers = {
  // Success
  success: panelHandlers,

  // 4xx Client Errors
  badRequest: [
    http.put(API_PANEL_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONFIG',
          i18n.t('handler.panel.invalidPanelConfiguration', 'Invalid panel configuration'),
          API_PANEL_CONFIG
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.put(API_PANEL_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.panel.authenticationRequiredToModifyPanel',
            'Authentication required to modify panel'
          ),
          API_PANEL_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.put(API_PANEL_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'PANEL_DISABLED',
          i18n.t('handler.panel.panelCustomizationIsDisabled', 'Panel customization is disabled'),
          API_PANEL_CONFIG
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_PANEL_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.panel.panelConfigurationNotFound', 'Panel configuration not found'),
          API_PANEL_CONFIG
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_PANEL_IMPORT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'IMPORT_CONFLICT',
          i18n.t(
            'handler.panel.importConflictsWithExistingTheme',
            'Import conflicts with existing theme'
          ),
          API_PANEL_IMPORT
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_PANEL_IMPORT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_FORMAT',
          i18n.t('handler.panel.invalidThemeFileFormat', 'Invalid theme file format'),
          API_PANEL_IMPORT
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_PANEL_EXPORT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t(
            'handler.panel.tooManyExportRequestsPlease',
            'Too many export requests. Please wait.'
          ),
          API_PANEL_EXPORT
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_PANEL_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.panel.failedToLoadPanelConfiguration',
            'Failed to load panel configuration'
          ),
          API_PANEL_CONFIG
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_PANEL_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.panel.panelServiceUnavailable', 'Panel service unavailable'),
          API_PANEL_CONFIG
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_PANEL_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.panel.panelServiceTemporarilyUnavailable',
            'Panel service temporarily unavailable'
          ),
          API_PANEL_CONFIG
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_PANEL_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.panel.panelServiceTimeout', 'Panel service timeout'),
          API_PANEL_CONFIG
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_PANEL_CONFIG, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_PANEL_CONFIG, async () => {
      await delay(3000);
      return HttpResponse.json({
        isOpen: false,
        position: 'right',
        width: 360,
        pinned: false,
        sections: ['colors', 'radius', 'scale', 'layout'],
      });
    }),
  ],

  networkError: [http.get(API_PANEL_CONFIG, () => HttpResponse.error())],

  emptyData: [
    http.get(API_PANEL_CONFIG, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};

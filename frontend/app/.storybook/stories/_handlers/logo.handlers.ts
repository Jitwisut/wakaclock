import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// LOGO HANDLERS
// Enterprise-grade MSW handlers for logo component
// ============================================================================

// API Endpoints
const API_LOGO = '/api/logo';
const API_LOGO_CONFIG = '/api/logo/config';
const API_LOGO_VARIANTS = '/api/logo/variants';

// Types
interface LogoConfig {
  alt: string;
  height: number;
  src: string;
  variant: 'dark' | 'default' | 'light' | 'monochrome';
  width: number;
}

interface LogoVariant {
  description: string;
  id: string;
  name: string;
  src: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const logoHandlers = [
  // GET logo config
  http.get(API_LOGO_CONFIG, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const config: LogoConfig = {
      src: '/images/logo.png',
      alt: i18n.t('handler.logo.companyLogo', 'Company Logo'),
      width: 32,
      height: 32,
      variant: 'default',
    };
    return HttpResponse.json(config);
  }),

  // PUT update logo config
  http.put(API_LOGO_CONFIG, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const body = (await request.json()) as Partial<LogoConfig>;
    return HttpResponse.json({
      success: true,
      config: body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // GET logo variants
  http.get(API_LOGO_VARIANTS, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const variants: LogoVariant[] = [
      {
        id: 'default',
        name: i18n.t('handler.logo.default', 'Default'),
        src: '/images/logo.png',
        description: i18n.t('handler.logo.standardLogo', 'Standard logo'),
      },
      {
        id: 'dark',
        name: i18n.t('handler.logo.darkMode', 'Dark Mode'),
        src: '/images/logo-dark.png',
        description: i18n.t('handler.logo.forDarkBackgrounds', 'For dark backgrounds'),
      },
      {
        id: 'light',
        name: i18n.t('handler.logo.lightMode', 'Light Mode'),
        src: '/images/logo-light.png',
        description: i18n.t('handler.logo.forLightBackgrounds', 'For light backgrounds'),
      },
      {
        id: 'monochrome',
        name: i18n.t('handler.logo.monochrome', 'Monochrome'),
        src: '/images/logo-mono.png',
        description: i18n.t('handler.logo.singleColorVariant', 'Single color variant'),
      },
    ];
    return HttpResponse.json({ variants });
  }),

  // Generic endpoint
  http.get(API_LOGO, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      currentVariant: 'default',
    });
  }),
];

// ============================================================================
// STATUS HANDLERS - Full HTTP Status Coverage
// ============================================================================

export const logoStatusHandlers = {
  // Success
  success: logoHandlers,

  // 4xx Client Errors
  badRequest: [
    http.put(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONFIG',
          i18n.t('handler.logo.invalidLogoConfiguration', 'Invalid logo configuration'),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.put(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.logo.authenticationRequiredToModifyLogo',
            'Authentication required to modify logo'
          ),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.put(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'LOGO_LOCKED',
          i18n.t('handler.logo.logoConfigurationIsLocked', 'Logo configuration is locked'),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.logo.logoConfigurationNotFound', 'Logo configuration not found'),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.put(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'VARIANT_CONFLICT',
          i18n.t('handler.logo.logoVariantConflict', 'Logo variant conflict'),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.put(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_IMAGE',
          i18n.t('handler.logo.invalidLogoImageFormat', 'Invalid logo image format'),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.put(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t('handler.logo.tooManyLogoUpdatesPlease', 'Too many logo updates. Please wait.'),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // 5xx Server Errors
  internalServerError: [
    http.get(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.logo.failedToLoadLogoConfiguration', 'Failed to load logo configuration'),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'BAD_GATEWAY',
          i18n.t('handler.logo.logoServiceUnavailable', 'Logo service unavailable'),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          i18n.t(
            'handler.logo.logoServiceTemporarilyUnavailable',
            'Logo service temporarily unavailable'
          ),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_LOGO_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'GATEWAY_TIMEOUT',
          i18n.t('handler.logo.logoServiceTimeout', 'Logo service timeout'),
          API_LOGO_CONFIG
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // Special States
  loading: [
    http.get(API_LOGO_CONFIG, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_LOGO_CONFIG, async () => {
      await delay(3000);
      return HttpResponse.json({
        src: '/images/logo.png',
        alt: i18n.t('handler.logo.companyLogo', 'Company Logo'),
        width: 32,
        height: 32,
        variant: 'default',
      });
    }),
  ],

  networkError: [http.get(API_LOGO_CONFIG, () => HttpResponse.error())],

  emptyData: [
    http.get(API_LOGO_CONFIG, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};

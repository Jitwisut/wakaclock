import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// ICON HANDLERS
// Enterprise-grade MSW handlers for icon component
// ============================================================================

// API Endpoints
const API_ICON = '/api/icon';
const API_ICON_LIST = '/api/icon/list';
const API_ICON_SEARCH = '/api/icon/search';
const API_ICON_CATEGORIES = '/api/icon/categories';
const API_ICON_FAVORITES = '/api/icon/favorites';
const API_ICON_CUSTOM = '/api/icon/custom';

// Types
interface IconInfo {
  category: string;
  name: string;
  tags: string[];
  variants: string[];
}

interface IconCategory {
  count: number;
  id: string;
  name: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const iconHandlers = [
  http.get(API_ICON_LIST, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10);
    const category = url.searchParams.get('category');

    const allIcons: IconInfo[] = [
      {
        name: i18n.t('handler.icon.home', 'Home'),
        category: 'navigation',
        tags: ['house', 'main'],
        variants: ['outline', 'filled'],
      },
      {
        name: i18n.t('handler.icon.settings', 'Settings'),
        category: 'actions',
        tags: ['gear', 'config'],
        variants: ['outline', 'filled'],
      },
      {
        name: i18n.t('handler.icon.user', 'User'),
        category: 'people',
        tags: ['person', 'profile'],
        variants: ['outline', 'filled', 'circle'],
      },
      {
        name: i18n.t('handler.icon.search', 'Search'),
        category: 'actions',
        tags: ['find', 'magnify'],
        variants: ['outline'],
      },
      {
        name: i18n.t('handler.icon.bell', 'Bell'),
        category: 'notifications',
        tags: ['alert', 'notification'],
        variants: ['outline', 'filled', 'ring'],
      },
      {
        name: i18n.t('handler.icon.mail', 'Mail'),
        category: 'communication',
        tags: ['email', 'envelope'],
        variants: ['outline', 'filled', 'open'],
      },
      {
        name: i18n.t('handler.icon.calendar', 'Calendar'),
        category: 'date',
        tags: ['schedule', 'date'],
        variants: ['outline', 'filled'],
      },
      {
        name: i18n.t('handler.icon.chart', 'Chart'),
        category: 'data',
        tags: ['graph', 'analytics'],
        variants: ['bar', 'line', 'pie'],
      },
      {
        name: i18n.t('handler.icon.file', 'File'),
        category: 'files',
        tags: ['document', 'paper'],
        variants: ['outline', 'filled', 'text'],
      },
      {
        name: i18n.t('handler.icon.folder', 'Folder'),
        category: 'files',
        tags: ['directory', 'storage'],
        variants: ['outline', 'filled', 'open'],
      },
    ];

    const filteredIcons = category
      ? allIcons.filter((icon) => icon.category === category)
      : allIcons;

    const startIndex = (page - 1) * limit;
    const paginatedIcons = filteredIcons.slice(startIndex, startIndex + limit);

    return HttpResponse.json({
      icons: paginatedIcons,
      total: filteredIcons.length,
      page,
      limit,
      hasMore: startIndex + limit < filteredIcons.length,
    });
  }),

  http.get(API_ICON_SEARCH, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    const results: IconInfo[] = [
      {
        name: i18n.t('handler.icon.home', 'Home'),
        category: 'navigation',
        tags: ['house', 'main'],
        variants: ['outline', 'filled'],
      },
      {
        name: i18n.t('handler.icon.homeAlt', 'HomeAlt'),
        category: 'navigation',
        tags: ['house', 'building'],
        variants: ['outline'],
      },
    ].filter(
      (icon) =>
        icon.name.toLowerCase().includes(query.toLowerCase()) ||
        icon.tags.some((tag) => tag.includes(query.toLowerCase()))
    );

    return HttpResponse.json({ results, query, total: results.length });
  }),

  http.get(API_ICON_CATEGORIES, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const categories: IconCategory[] = [
      { id: 'navigation', name: i18n.t('handler.icon.navigation', 'Navigation'), count: 25 },
      { id: 'actions', name: i18n.t('handler.icon.actions', 'Actions'), count: 45 },
      { id: 'people', name: i18n.t('handler.icon.people', 'People'), count: 20 },
      {
        id: 'notifications',
        name: i18n.t('handler.icon.notifications', 'Notifications'),
        count: 15,
      },
      {
        id: 'communication',
        name: i18n.t('handler.icon.communication', 'Communication'),
        count: 30,
      },
      { id: 'date', name: i18n.t('handler.icon.dateAndTime', 'Date & Time'), count: 18 },
      { id: 'data', name: i18n.t('handler.icon.dataAndAnalytics', 'Data & Analytics'), count: 35 },
      { id: 'files', name: i18n.t('handler.icon.filesAndFolders', 'Files & Folders'), count: 28 },
    ];
    return HttpResponse.json({ categories, total: categories.length });
  }),

  http.get(API_ICON_FAVORITES, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const favorites = [
      i18n.t('handler.icon.home', 'Home'),
      i18n.t('handler.icon.settings', 'Settings'),
      i18n.t('handler.icon.user', 'User'),
      i18n.t('handler.icon.search', 'Search'),
      i18n.t('handler.icon.bell', 'Bell'),
    ];
    return HttpResponse.json({ favorites, total: favorites.length });
  }),

  http.post(API_ICON_FAVORITES, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { action: 'add' | 'remove'; iconName: string };
    return HttpResponse.json({
      success: true,
      iconName: body.iconName,
      action: body.action,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(API_ICON_CUSTOM, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as { category?: string; name: string; svg: string };
    return HttpResponse.json({
      success: true,
      id: faker.string.uuid(),
      name: body.name,
      category: body.category || 'custom',
      createdAt: new Date().toISOString(),
    });
  }),

  http.get(API_ICON, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      totalIcons: 500,
      totalCategories: 8,
      defaultSize: 24,
      availableSizes: [16, 20, 24, 32, 48],
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const iconStatusHandlers = {
  success: iconHandlers,
  badRequest: [
    http.get(API_ICON_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_QUERY',
          i18n.t('handler.icon.searchQueryIsInvalid', 'Search query is invalid'),
          API_ICON_SEARCH
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_ICON_CUSTOM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.icon.authenticationRequiredToUploadCustom',
            'Authentication required to upload custom icons'
          ),
          API_ICON_CUSTOM
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_ICON_CUSTOM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'UPLOAD_FORBIDDEN',
          i18n.t('handler.icon.customIconUploadsNotAllowed', 'Custom icon uploads not allowed'),
          API_ICON_CUSTOM
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_ICON_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'ICON_NOT_FOUND',
          i18n.t('handler.icon.noIconsFoundMatchingQuery', 'No icons found matching query'),
          API_ICON_SEARCH
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  unprocessableEntity: [
    http.post(API_ICON_CUSTOM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'INVALID_SVG',
          i18n.t('handler.icon.invalidSvgFormat', 'Invalid SVG format'),
          API_ICON_CUSTOM
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],
  tooManyRequests: [
    http.get(API_ICON_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.icon.tooManySearchRequests', 'Too many search requests'),
          API_ICON_SEARCH
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  internalServerError: [
    http.get(API_ICON_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.icon.failedToLoadIcons', 'Failed to load icons'),
          API_ICON_LIST
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_ICON_LIST, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_ICON_LIST, () => HttpResponse.error())],
  emptyData: [
    http.get(API_ICON_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ icons: [], total: 0, page: 1, limit: 50, hasMore: false });
    }),
  ],
  noSearchResults: [
    http.get(API_ICON_SEARCH, async ({ request }) => {
      await delay(100);
      const url = new URL(request.url);
      const query = url.searchParams.get('q') || '';
      return HttpResponse.json({ results: [], query, total: 0 });
    }),
  ],
};

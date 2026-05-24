import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeAutocompleteOptions,
  createFakeCommandGroups,
  createFakeRecentSearches,
  createFakeSearchResponse,
  createFakeSearchResults,
} from '../_factories/search.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SEARCH = '/api/search';
const API_SEARCH_SUGGESTIONS = '/api/search/suggestions';
const API_SEARCH_RECENT = '/api/search/recent';
const API_COMMAND = '/api/command';
const API_AUTOCOMPLETE = '/api/autocomplete';

// Default success handlers
export const searchHandlers = [
  // GET /api/search
  http.get(API_SEARCH, async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 150, max: 500 }));

    if (!query || query.length < 2) {
      return HttpResponse.json({ results: [], total: 0, query, took: 0 });
    }

    const response = createFakeSearchResponse(query, limit);
    return HttpResponse.json(response);
  }),

  // GET /api/search/suggestions
  http.get(API_SEARCH_SUGGESTIONS, async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';

    await delay(faker.number.int({ min: 100, max: 300 }));

    if (!query || query.length === 0) {
      return HttpResponse.json({ suggestions: [] });
    }

    return HttpResponse.json({
      suggestions: Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => `${query} ${faker.lorem.word()}`
      ),
    });
  }),

  // GET /api/search/recent
  http.get(API_SEARCH_RECENT, async () => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    return HttpResponse.json({ searches: createFakeRecentSearches(5) });
  }),

  // DELETE /api/search/recent
  http.delete(API_SEARCH_RECENT, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // GET /api/command
  http.get(API_COMMAND, async () => {
    await delay(faker.number.int({ min: 150, max: 400 }));
    return HttpResponse.json({ groups: createFakeCommandGroups() });
  }),

  // GET /api/autocomplete
  http.get(API_AUTOCOMPLETE, async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';

    await delay(faker.number.int({ min: 100, max: 300 }));

    if (!query || query.length === 0) {
      return HttpResponse.json({ options: [] });
    }

    const options = createFakeAutocompleteOptions(6);
    // Filter by query
    const filtered = options.filter(
      (o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase())
    );

    return HttpResponse.json({ options: filtered });
  }),
];

// Status-specific handlers for stories
export const searchStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: searchHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_SEARCH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_QUERY',
          i18n.t('handler.search.searchQueryIsInvalid', 'Search query is invalid'),
          API_SEARCH,
          {
            query: i18n.t(
              'handler.search.queryMustBeAtLeast',
              'Query must be at least 2 characters'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SEARCH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.search.authenticationRequiredForSearch',
            'Authentication required for search'
          ),
          API_SEARCH
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_SEARCH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'SEARCH_DISABLED',
          i18n.t('handler.search.searchIsDisabledForYour', 'Search is disabled for your account'),
          API_SEARCH
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.search.searchRateLimitExceeded', 'Search rate limit exceeded'),
          API_SEARCH,
          {
            limit: '30/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_SEARCH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.search.searchValidationFailed', 'Search validation failed'),
          API_SEARCH,
          {
            query: i18n.t(
              'handler.search.queryContainsInvalidCharacters',
              'Query contains invalid characters'
            ),
            filters: i18n.t(
              'handler.search.invalidFilterCombination',
              'Invalid filter combination'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SEARCH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SEARCH_ERROR',
          i18n.t(
            'handler.search.searchServiceEncounteredAnError',
            'Search service encountered an error'
          ),
          API_SEARCH,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SEARCH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.search.searchIndexUnavailable', 'Search index unavailable'),
          API_SEARCH
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SEARCH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'INDEX_REBUILDING',
          i18n.t('handler.search.searchIndexIsBeingRebuilt', 'Search index is being rebuilt'),
          API_SEARCH,
          {
            retryAfter: '120',
            progress: '45%',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SEARCH, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.search.searchQueryTimedOut', 'Search query timed out'),
          API_SEARCH
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SEARCH, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(5000);
      return HttpResponse.json(createFakeSearchResponse(query, 10));
    }),
  ],

  networkError: [
    http.get(API_SEARCH, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  empty: [
    http.get(API_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(300);
      return HttpResponse.json({
        results: [],
        total: 0,
        query,
        took: faker.number.int({ min: 10, max: 50 }),
        suggestions: [
          i18n.t('handler.search.tryDifferentKeywords', 'Try different keywords'),
          i18n.t('handler.search.checkYourSpelling', 'Check your spelling'),
        ],
      });
    }),
  ],

  // Alias for consistency
  get emptyData() {
    return this.empty;
  },

  notFound: [
    http.get(API_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.search.noResultsFound', 'No results found for "{{query}}"', { query }),
          API_SEARCH
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.get(API_COMMAND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.search.commandGroupNotFound', 'Command group not found'),
          API_COMMAND
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  manyResults: [
    http.get(API_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(300);
      return HttpResponse.json({
        results: createFakeSearchResults(20),
        total: faker.number.int({ min: 100, max: 500 }),
        query,
        took: faker.number.int({ min: 50, max: 200 }),
      });
    }),
  ],

  withSuggestions: [
    http.get(API_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(300);
      return HttpResponse.json({
        results: createFakeSearchResults(5),
        total: 5,
        query,
        took: faker.number.int({ min: 10, max: 50 }),
        suggestions: [`${query} tutorial`, `${query} examples`, `best ${query}`, `${query} guide`],
      });
    }),
  ],
};

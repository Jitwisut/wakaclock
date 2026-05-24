import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  COMMAND_GROUP_HEADINGS,
  createFakeCommandGroups,
  createFakeRecentCommands,
  createFakeSearchResults,
  type FakeCommandGroup,
  type FakeCommandItem,
} from '../_factories/command.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// ═══════════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

const API_COMMAND = '/api/command';
const API_COMMAND_SEARCH = '/api/command/search';
const API_COMMAND_EXECUTE = '/api/command/execute';
const API_COMMAND_RECENT = '/api/command/recent';
const API_COMMAND_SUGGESTIONS = '/api/command/suggestions';
const API_COMMAND_HISTORY = '/api/command/history';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Note: filterCommands helper is available but not currently used in handlers
// It can be used for client-side filtering scenarios
// function filterCommands(commands: FakeCommandItem[], query: string): FakeCommandItem[] {
//   if (!query || query.trim() === '') return commands;
//   const lowerQuery = query.toLowerCase().trim();
//   return commands.filter(
//     (cmd) =>
//       cmd.label.toLowerCase().includes(lowerQuery) ||
//       cmd.description?.toLowerCase().includes(lowerQuery) ||
//       cmd.keywords?.some((k) => k.toLowerCase().includes(lowerQuery)) ||
//       cmd.value?.toLowerCase().includes(lowerQuery)
//   );
// }

/** Group commands by their group property */
function groupCommands(commands: FakeCommandItem[]): FakeCommandGroup[] {
  const grouped = commands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.group]) {
        acc[cmd.group] = [];
      }
      acc[cmd.group].push(cmd);
      return acc;
    },
    {} as Record<string, FakeCommandItem[]>
  );

  return Object.entries(grouped).map(([groupId, items]) => ({
    id: groupId,
    heading: COMMAND_GROUP_HEADINGS[groupId as keyof typeof COMMAND_GROUP_HEADINGS] ?? groupId,
    items,
    priority: 0,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT SUCCESS HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export const commandHandlers = [
  // GET /api/command - Get all commands grouped
  http.get(API_COMMAND, async () => {
    await delay(faker.number.int({ min: 150, max: 400 }));
    return HttpResponse.json({
      groups: createFakeCommandGroups(4),
      timestamp: new Date().toISOString(),
    });
  }),

  // GET /api/command/search - Search commands with query parameter
  http.get(API_COMMAND_SEARCH, async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const group = url.searchParams.get('group');

    await delay(faker.number.int({ min: 100, max: 300 }));

    let results = createFakeSearchResults(query);

    // Filter by group if specified
    if (group) {
      results = results.filter((cmd) => cmd.group === group);
    }

    // Apply limit
    results = results.slice(0, limit);

    // Group results
    const groupedResults = groupCommands(results);

    return HttpResponse.json({
      results,
      groups: groupedResults,
      total: results.length,
      query,
      took: faker.number.int({ min: 10, max: 100 }),
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/command/execute - Execute a command
  http.post(API_COMMAND_EXECUTE, async ({ request }) => {
    const body = (await request.json()) as {
      args?: Record<string, unknown>;
      commandId: string;
    };

    await delay(faker.number.int({ min: 200, max: 500 }));

    // Simulate command execution
    return HttpResponse.json({
      success: true,
      commandId: body.commandId,
      executedAt: new Date().toISOString(),
      result: {
        message: i18n.t(
          'handler.command.commandExecutedSuccessfullyWithId',
          'Command "{{commandId}}" executed successfully',
          { commandId: body.commandId }
        ),
        data: body.args,
      },
    });
  }),

  // GET /api/command/recent - Get recently used commands
  http.get(API_COMMAND_RECENT, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 5);

    await delay(faker.number.int({ min: 100, max: 200 }));

    const recentCommands = createFakeRecentCommands(limit);

    return HttpResponse.json({
      commands: recentCommands,
      total: recentCommands.length,
      timestamp: new Date().toISOString(),
    });
  }),

  // GET /api/command/suggestions - Get command suggestions
  http.get(API_COMMAND_SUGGESTIONS, async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';

    await delay(faker.number.int({ min: 50, max: 150 }));

    // Generate suggestions based on query
    const baseSuggestions = createFakeSearchResults(query).slice(0, 5);

    return HttpResponse.json({
      suggestions: baseSuggestions.map((cmd) => ({
        id: cmd.id,
        label: cmd.label,
        icon: cmd.icon,
        shortcut: cmd.shortcut,
      })),
      query,
      timestamp: new Date().toISOString(),
    });
  }),

  // GET /api/command/history - Get command execution history
  http.get(API_COMMAND_HISTORY, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 100, max: 300 }));

    const history = Array.from({ length: limit }, () => ({
      id: faker.string.uuid(),
      commandId: faker.string.alphanumeric(8),
      label: faker.helpers.arrayElement([
        i18n.t('handler.command.openFile', 'Open File'),
        i18n.t('handler.command.saveDocument', 'Save Document'),
        i18n.t('handler.command.goToDashboard', 'Go to Dashboard'),
        i18n.t('handler.command.toggleTheme', 'Toggle Theme'),
      ]),
      executedAt: faker.date.recent().toISOString(),
      success: faker.datatype.boolean({ probability: 0.9 }),
    }));

    return HttpResponse.json({
      history,
      total: history.length,
      timestamp: new Date().toISOString(),
    });
  }),

  // DELETE /api/command/history - Clear command history
  http.delete(API_COMMAND_HISTORY, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // DELETE /api/command/recent - Clear recent commands
  http.delete(API_COMMAND_RECENT, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS-SPECIFIC HANDLERS (For Stories)
// ═══════════════════════════════════════════════════════════════════════════════

export const commandStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: commandHandlers,

  // ============ SEARCH SPECIFIC ============
  searchSuccess: [
    http.get(API_COMMAND_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(200);

      const results = createFakeSearchResults(query);
      return HttpResponse.json({
        results,
        groups: groupCommands(results),
        total: results.length,
        query,
        took: 50,
      });
    }),
  ],

  searchEmpty: [
    http.get(API_COMMAND_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(200);

      return HttpResponse.json({
        results: [],
        groups: [],
        total: 0,
        query,
        took: 10,
        suggestions: [
          i18n.t('handler.command.tryDifferentKeywords', 'Try different keywords'),
          i18n.t('handler.command.checkYourSpelling', 'Check your spelling'),
        ],
      });
    }),
  ],

  searchSlow: [
    http.get(API_COMMAND_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(3000);

      const results = createFakeSearchResults(query);
      return HttpResponse.json({
        results,
        groups: groupCommands(results),
        total: results.length,
        query,
        took: 3000,
      });
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_COMMAND_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_QUERY',
          i18n.t('handler.command.searchQueryIsInvalid', 'Search query is invalid'),
          API_COMMAND_SEARCH,
          {
            query: i18n.t(
              'handler.command.queryContainsInvalidCharacters',
              'Query contains invalid characters'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_COMMAND_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_COMMAND',
          i18n.t('handler.command.invalidCommandIdOrArguments', 'Invalid command ID or arguments'),
          API_COMMAND_EXECUTE,
          { commandId: i18n.t('handler.command.commandIdIsRequired', 'Command ID is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_COMMAND_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.command.authenticationRequiredToSearchCommands',
            'Authentication required to search commands'
          ),
          API_COMMAND_SEARCH
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_COMMAND_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.command.authenticationRequiredToExecuteCommands',
            'Authentication required to execute commands'
          ),
          API_COMMAND_EXECUTE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_COMMAND_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.command.youDoNotHavePermission',
            'You do not have permission to search commands'
          ),
          API_COMMAND_SEARCH
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.post(API_COMMAND_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.command.insufficientPermissionsToExecuteThis',
            'Insufficient permissions to execute this command'
          ),
          API_COMMAND_EXECUTE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_COMMAND_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `No commands found for "${query}"`,
          API_COMMAND_SEARCH
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.post(API_COMMAND_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'COMMAND_NOT_FOUND',
          i18n.t('handler.command.commandNotFound', 'Command not found'),
          API_COMMAND_EXECUTE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_COMMAND_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.command.commandSearchRateLimitExceeded',
            'Command search rate limit exceeded'
          ),
          API_COMMAND_SEARCH,
          {
            limit: '100/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
    http.post(API_COMMAND_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.command.commandExecutionRateLimitExceeded',
            'Command execution rate limit exceeded'
          ),
          API_COMMAND_EXECUTE,
          { limit: '50/minute', remaining: '0' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_COMMAND_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.command.commandArgumentsValidationFailed',
            'Command arguments validation failed'
          ),
          API_COMMAND_EXECUTE,
          {
            args: i18n.t('handler.command.invalidArgumentFormat', 'Invalid argument format'),
            commandId: i18n.t(
              'handler.command.commandRequiresSpecificArguments',
              'Command requires specific arguments'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  conflict: [
    http.post(API_COMMAND_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'COMMAND_IN_PROGRESS',
          i18n.t(
            'handler.command.thisCommandIsAlreadyBeing',
            'This command is already being executed'
          ),
          API_COMMAND_EXECUTE,
          {
            existingExecutionId: faker.string.uuid(),
            startedAt: new Date().toISOString(),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_COMMAND_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SEARCH_ERROR',
          i18n.t(
            'handler.command.commandSearchServiceEncounteredAn',
            'Command search service encountered an error'
          ),
          API_COMMAND_SEARCH,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_COMMAND_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'EXECUTION_FAILED',
          i18n.t('handler.command.failedToExecuteCommand', 'Failed to execute command'),
          API_COMMAND_EXECUTE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_COMMAND_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.command.commandServiceUnavailable', 'Command service unavailable'),
          API_COMMAND_SEARCH
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_COMMAND_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.command.commandServiceIsUnderMaintenance',
            'Command service is under maintenance'
          ),
          API_COMMAND_SEARCH,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_COMMAND_SEARCH, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.command.commandSearchTimedOut', 'Command search timed out'),
          API_COMMAND_SEARCH
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_COMMAND, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_COMMAND_SEARCH, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowSearch: [
    http.get(API_COMMAND_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(5000);

      const results = createFakeSearchResults(query);
      return HttpResponse.json({
        results,
        groups: groupCommands(results),
        total: results.length,
        query,
        took: 5000,
      });
    }),
  ],

  slowResponse: [
    http.get(API_COMMAND_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(5000);

      const results = createFakeSearchResults(query);
      return HttpResponse.json({
        results,
        groups: groupCommands(results),
        total: results.length,
        query,
        took: 5000,
      });
    }),
    http.post(API_COMMAND_EXECUTE, async ({ request }) => {
      const body = (await request.json()) as { commandId: string };
      await delay(5000);
      return HttpResponse.json({
        success: true,
        commandId: body.commandId,
        executedAt: new Date().toISOString(),
        result: {
          message: i18n.t(
            'handler.command.commandExecutedAfterDelay',
            'Command executed after delay'
          ),
        },
      });
    }),
  ],

  networkError: [
    http.get(API_COMMAND, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.get(API_COMMAND_SEARCH, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyResults: [
    http.get(API_COMMAND, async () => {
      await delay(200);
      return HttpResponse.json({
        groups: [],
        timestamp: new Date().toISOString(),
      });
    }),
    http.get(API_COMMAND_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      await delay(200);
      return HttpResponse.json({
        results: [],
        groups: [],
        total: 0,
        query,
        took: 10,
      });
    }),
  ],

  // ============ EXECUTION SPECIFIC ============
  executeSuccess: [
    http.post(API_COMMAND_EXECUTE, async ({ request }) => {
      const body = (await request.json()) as { commandId: string };
      await delay(500);
      return HttpResponse.json({
        success: true,
        commandId: body.commandId,
        executedAt: new Date().toISOString(),
        result: {
          message: i18n.t(
            'handler.command.commandExecutedSuccessfully',
            'Command executed successfully'
          ),
        },
      });
    }),
  ],

  executePending: [
    http.post(API_COMMAND_EXECUTE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  executeError: [
    http.post(API_COMMAND_EXECUTE, async ({ request }) => {
      const body = (await request.json()) as { commandId: string };
      await delay(500);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'EXECUTION_FAILED',
          `Failed to execute command "${body.commandId}"`,
          API_COMMAND_EXECUTE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  // ============ FILTER SPECIFIC ============
  filterByGroup: [
    http.get(API_COMMAND_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';
      const group = url.searchParams.get('group');

      await delay(200);

      let results = createFakeSearchResults(query);

      if (group) {
        results = results.filter((cmd) => cmd.group === group);
      }

      return HttpResponse.json({
        results,
        groups: groupCommands(results),
        total: results.length,
        query,
        filter: { group },
        took: 30,
      });
    }),
  ],

  // ============ DEBOUNCED SEARCH ============
  debouncedSearch: [
    http.get(API_COMMAND_SEARCH, async ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') ?? '';

      // Simulate debounce by having variable delay based on query length
      const delayMs = Math.min(query.length * 50, 500);
      await delay(delayMs);

      const results = createFakeSearchResults(query);
      return HttpResponse.json({
        results,
        groups: groupCommands(results),
        total: results.length,
        query,
        took: delayMs,
      });
    }),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED HANDLERS (For Complex Scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

/** Handlers for full command palette functionality */
export const commandPaletteHandlers = [
  ...commandHandlers,
  // Add any additional handlers for complex scenarios
];

/** Handlers for search-only functionality */
export const commandSearchHandlers = [
  commandHandlers.find((h) => h.info.path === API_COMMAND_SEARCH)!,
  commandHandlers.find((h) => h.info.path === API_COMMAND_SUGGESTIONS)!,
].filter(Boolean);

/** Handlers for execution-only functionality */
export const commandExecuteHandlers = [
  commandHandlers.find((h) => h.info.path === API_COMMAND_EXECUTE)!,
].filter(Boolean);

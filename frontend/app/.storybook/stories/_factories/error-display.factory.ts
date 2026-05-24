/**
 * ErrorDisplay Component Factory
 *
 * Generates fake data for ErrorDisplay component stories and tests.
 * Supports various HTTP error codes, detail configurations, and edge cases.
 *
 * @module error-display.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * HTTP error status codes
 */
export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504;

/**
 * Error severity levels
 */
export type ErrorSeverity = 'critical' | 'error' | 'info' | 'warning';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All HTTP error status codes
 */
export const HTTP_ERROR_STATUSES: HttpErrorStatus[] = [
  400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504,
];

/**
 * Client error codes (4xx)
 */
export const CLIENT_ERROR_STATUSES: HttpErrorStatus[] = [400, 401, 403, 404, 409, 422, 429];

/**
 * Server error codes (5xx)
 */
export const SERVER_ERROR_STATUSES: HttpErrorStatus[] = [500, 502, 503, 504];

/**
 * Error severity levels
 */
export const ERROR_SEVERITIES: ErrorSeverity[] = ['critical', 'error', 'warning', 'info'];

/**
 * HTTP error information by status code
 */
export const HTTP_ERROR_INFO: Record<
  HttpErrorStatus,
  {
    code: string;
    description: string;
    details: Record<string, string>;
    message: string;
  }
> = {
  400: {
    message: i18n.t('factory.errorDisplay.badRequest', 'Bad Request'),
    description: i18n.t(
      'factory.errorDisplay.theServerCouldNotUnderstand',
      'The server could not understand the request due to invalid syntax.'
    ),
    code: 'ERR_BAD_REQUEST',
    details: {
      parameter: 'email',
      issue: i18n.t('factory.errorDisplay.invalidEmailFormat', 'Invalid email format'),
      received: 'not-an-email',
    },
  },
  401: {
    message: i18n.t('factory.errorDisplay.unauthorized', 'Unauthorized'),
    description: i18n.t(
      'factory.errorDisplay.authenticationIsRequiredToAccess',
      'Authentication is required to access this resource.'
    ),
    code: 'ERR_UNAUTHORIZED',
    details: {
      reason: i18n.t('factory.errorDisplay.missingOrInvalidToken', 'Missing or invalid token'),
      header: i18n.t('factory.errorDisplay.authorization', 'Authorization'),
    },
  },
  403: {
    message: i18n.t('factory.errorDisplay.forbidden', 'Forbidden'),
    description: i18n.t(
      'factory.errorDisplay.youDoNotHavePermission',
      'You do not have permission to access this resource.'
    ),
    code: 'ERR_FORBIDDEN',
    details: {
      resource: '/api/admin/users',
      requiredRole: 'admin',
      currentRole: 'viewer',
    },
  },
  404: {
    message: i18n.t('factory.errorDisplay.notFound', 'Not Found'),
    description: i18n.t(
      'factory.errorDisplay.theRequestedResourceCouldNot',
      'The requested resource could not be found on the server.'
    ),
    code: 'ERR_NOT_FOUND',
    details: {
      resource: '/api/users/12345',
      suggestion: i18n.t(
        'factory.errorDisplay.checkTheResourceIdOr',
        'Check the resource ID or verify it exists'
      ),
    },
  },
  409: {
    message: i18n.t('factory.errorDisplay.conflict', 'Conflict'),
    description: i18n.t(
      'factory.errorDisplay.theRequestConflictsWithThe',
      'The request conflicts with the current state of the resource.'
    ),
    code: 'ERR_CONFLICT',
    details: {
      resource: '/api/users/email',
      conflict: i18n.t(
        'factory.errorDisplay.emailAddressAlreadyRegistered',
        'Email address already registered'
      ),
    },
  },
  422: {
    message: i18n.t('factory.errorDisplay.unprocessableEntity', 'Unprocessable Entity'),
    description: i18n.t(
      'factory.errorDisplay.theRequestWasWellformedBut',
      'The request was well-formed but was unable to be followed due to semantic errors.'
    ),
    code: 'ERR_VALIDATION',
    details: {
      field: 'username',
      minLength: '3',
      maxLength: '50',
    },
  },
  429: {
    message: i18n.t('factory.errorDisplay.tooManyRequests', 'Too Many Requests'),
    description: i18n.t(
      'factory.errorDisplay.youHaveSentTooMany',
      'You have sent too many requests in a given amount of time.'
    ),
    code: 'ERR_RATE_LIMITED',
    details: {
      limit: '100',
      remaining: '0',
      retryAfter: '60 seconds',
    },
  },
  500: {
    message: i18n.t('factory.errorDisplay.internalServerError', 'Internal Server Error'),
    description: i18n.t(
      'factory.errorDisplay.anUnexpectedErrorOccurredOn',
      'An unexpected error occurred on the server.'
    ),
    code: 'ERR_INTERNAL',
    details: {
      requestId: 'req_abc123xyz',
      timestamp: '2024-01-01T00:00:00Z',
    },
  },
  502: {
    message: i18n.t('factory.errorDisplay.badGateway', 'Bad Gateway'),
    description: i18n.t(
      'factory.errorDisplay.theServerReceivedAnInvalid',
      'The server received an invalid response from an upstream server.'
    ),
    code: 'ERR_BAD_GATEWAY',
    details: {
      upstream: 'api.external-service.com',
      timeout: '30s',
    },
  },
  503: {
    message: i18n.t('factory.errorDisplay.serviceUnavailable', 'Service Unavailable'),
    description: i18n.t(
      'factory.errorDisplay.theServerIsTemporarilyUnavailable',
      'The server is temporarily unavailable due to maintenance or overload.'
    ),
    code: 'ERR_SERVICE_UNAVAILABLE',
    details: {
      reason: i18n.t('factory.errorDisplay.scheduledMaintenance', 'Scheduled maintenance'),
      retryAfter: '300 seconds',
    },
  },
  504: {
    message: i18n.t('factory.errorDisplay.gatewayTimeout', 'Gateway Timeout'),
    description: i18n.t(
      'factory.errorDisplay.theServerDidNotReceive',
      'The server did not receive a timely response from an upstream server.'
    ),
    code: 'ERR_GATEWAY_TIMEOUT',
    details: {
      timeout: '60s',
      upstream: 'database-cluster.internal',
    },
  },
};

/**
 * Common error codes
 */
export const ERROR_CODES: string[] = [
  'ERR_AUTH_FAILED',
  'ERR_BAD_GATEWAY',
  'ERR_BAD_REQUEST',
  'ERR_CONFLICT',
  'ERR_FORBIDDEN',
  'ERR_GATEWAY_TIMEOUT',
  'ERR_INTERNAL',
  'ERR_NETWORK',
  'ERR_NOT_FOUND',
  'ERR_RATE_LIMITED',
  'ERR_SERVICE_UNAVAILABLE',
  'ERR_UNAUTHORIZED',
  'ERR_VALIDATION',
];

/**
 * Common error messages
 */
export const ERROR_MESSAGES: string[] = [
  i18n.t(
    'factory.errorDisplay.anErrorOccurredWhileProcessing',
    'An error occurred while processing your request.'
  ),
  i18n.t(
    'factory.errorDisplay.authenticationFailedPleaseLogIn',
    'Authentication failed. Please log in again.'
  ),
  i18n.t('factory.errorDisplay.failedToFetchDataPlease', 'Failed to fetch data. Please try again.'),
  i18n.t('factory.errorDisplay.networkConnectionLost', 'Network connection lost.'),
  i18n.t('factory.errorDisplay.permissionDenied', 'Permission denied.'),
  i18n.t('factory.errorDisplay.requestTimedOut', 'Request timed out.'),
  i18n.t('factory.errorDisplay.resourceNotFound', 'Resource not found.'),
  i18n.t('factory.errorDisplay.serviceTemporarilyUnavailable', 'Service temporarily unavailable.'),
  i18n.t('factory.errorDisplay.somethingWentWrong', 'Something went wrong.'),
  i18n.t(
    'factory.errorDisplay.validationFailedForTheSubmitted',
    'Validation failed for the submitted form.'
  ),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Fake error display configuration
 */
export interface FakeErrorDisplay {
  code?: string;
  details?: Record<string, string>;
  message: string;
  onRetry?: () => void;
  status?: number;
}

/**
 * Fake error display with severity
 */
export interface FakeErrorDisplayWithSeverity extends FakeErrorDisplay {
  severity: ErrorSeverity;
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

const noop = () => {};

/**
 * Create a fake error display
 */
export function createFakeErrorDisplay(overrides?: Partial<FakeErrorDisplay>): FakeErrorDisplay {
  const status = faker.helpers.arrayElement(HTTP_ERROR_STATUSES);
  const info = HTTP_ERROR_INFO[status];

  return {
    code: faker.helpers.maybe(() => info.code, { probability: 0.7 }),
    details: faker.helpers.maybe(() => info.details, { probability: 0.5 }),
    message: info.description,
    onRetry: faker.helpers.maybe(() => noop, { probability: 0.6 }),
    status,
    ...overrides,
  };
}

/**
 * Create multiple fake error displays
 */
export function createFakeErrorDisplays(
  count: number,
  overrides?: Partial<FakeErrorDisplay>
): FakeErrorDisplay[] {
  return Array.from({ length: count }, () => createFakeErrorDisplay(overrides));
}

// ============================================================================
// STATUS FACTORIES
// ============================================================================

/**
 * Create a fake error display for a specific HTTP status
 */
export function createFakeErrorForStatus(
  status: HttpErrorStatus,
  overrides?: Partial<FakeErrorDisplay>
): FakeErrorDisplay {
  const info = HTTP_ERROR_INFO[status];
  return createFakeErrorDisplay({
    status,
    code: info.code,
    message: info.description,
    details: info.details,
    ...overrides,
  });
}

/**
 * Create error with retry button
 */
export function createFakeErrorWithRetry(overrides?: Partial<FakeErrorDisplay>): FakeErrorDisplay {
  return createFakeErrorDisplay({
    onRetry: () => {},
    ...overrides,
  });
}

/**
 * Create error without retry button
 */
export function createFakeErrorWithoutRetry(
  overrides?: Partial<FakeErrorDisplay>
): FakeErrorDisplay {
  return createFakeErrorDisplay({
    onRetry: undefined,
    ...overrides,
  });
}

/**
 * Create minimal error (message only)
 */
export function createFakeMinimalError(overrides?: Partial<FakeErrorDisplay>): FakeErrorDisplay {
  return createFakeErrorDisplay({
    code: undefined,
    details: undefined,
    onRetry: undefined,
    status: undefined,
    ...overrides,
  });
}

/**
 * Create complete error (all fields populated)
 */
export function createFakeCompleteError(overrides?: Partial<FakeErrorDisplay>): FakeErrorDisplay {
  const status = faker.helpers.arrayElement(HTTP_ERROR_STATUSES);
  const info = HTTP_ERROR_INFO[status];
  return createFakeErrorDisplay({
    code: info.code,
    details: info.details,
    message: info.description,
    onRetry: () => {},
    status,
    ...overrides,
  });
}

/**
 * Create error with long text (edge case)
 */
export function createFakeErrorLongText(overrides?: Partial<FakeErrorDisplay>): FakeErrorDisplay {
  return createFakeErrorDisplay({
    message: faker.lorem.paragraph(5),
    details: {
      longValue1: faker.lorem.sentence(10),
      longValue2: faker.lorem.sentence(10),
      longValue3: faker.lorem.sentence(10),
    },
    ...overrides,
  });
}

/**
 * Create error with many details (edge case)
 */
export function createFakeErrorManyDetails(
  overrides?: Partial<FakeErrorDisplay>
): FakeErrorDisplay {
  const details: Record<string, string> = {};
  for (let i = 1; i <= 8; i++) {
    details[`field${i}`] = faker.word.words(2);
  }
  return createFakeErrorDisplay({
    details,
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create error displays for all HTTP status codes
 */
export function createErrorStatusMatrix(): {
  error: FakeErrorDisplay;
  status: HttpErrorStatus;
}[] {
  return HTTP_ERROR_STATUSES.map((status) => ({
    error: createFakeErrorForStatus(status, { onRetry: () => {} }),
    status,
  }));
}

/**
 * Create error displays for client errors only
 */
export function createClientErrorMatrix(): {
  error: FakeErrorDisplay;
  status: HttpErrorStatus;
}[] {
  return CLIENT_ERROR_STATUSES.map((status) => ({
    error: createFakeErrorForStatus(status),
    status,
  }));
}

/**
 * Create error displays for server errors only
 */
export function createServerErrorMatrix(): {
  error: FakeErrorDisplay;
  status: HttpErrorStatus;
}[] {
  return SERVER_ERROR_STATUSES.map((status) => ({
    error: createFakeErrorForStatus(status, { onRetry: () => {} }),
    status,
  }));
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive test data
 */
export function createErrorDisplayTestData(): {
  basic: FakeErrorDisplay;
  clientErrors: ReturnType<typeof createClientErrorMatrix>;
  complete: FakeErrorDisplay;
  longText: FakeErrorDisplay;
  manyDetails: FakeErrorDisplay;
  minimal: FakeErrorDisplay;
  serverErrors: ReturnType<typeof createServerErrorMatrix>;
  statusMatrix: ReturnType<typeof createErrorStatusMatrix>;
  withoutRetry: FakeErrorDisplay;
  withRetry: FakeErrorDisplay;
} {
  return {
    basic: createFakeErrorDisplay(),
    clientErrors: createClientErrorMatrix(),
    complete: createFakeCompleteError(),
    longText: createFakeErrorLongText(),
    manyDetails: createFakeErrorManyDetails(),
    minimal: createFakeMinimalError(),
    serverErrors: createServerErrorMatrix(),
    statusMatrix: createErrorStatusMatrix(),
    withRetry: createFakeErrorWithRetry(),
    withoutRetry: createFakeErrorWithoutRetry(),
  };
}

/**
 * Create showcase of all error display configurations
 */
export function createErrorDisplayShowcase(): {
  clientErrors: ReturnType<typeof createClientErrorMatrix>;
  serverErrors: ReturnType<typeof createServerErrorMatrix>;
  statusMatrix: ReturnType<typeof createErrorStatusMatrix>;
  testData: ReturnType<typeof createErrorDisplayTestData>;
} {
  return {
    clientErrors: createClientErrorMatrix(),
    serverErrors: createServerErrorMatrix(),
    statusMatrix: createErrorStatusMatrix(),
    testData: createErrorDisplayTestData(),
  };
}

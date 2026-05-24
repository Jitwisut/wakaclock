import i18n from 'i18next';

export const HTTP_STATUS = {
  // 2xx Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // 3xx Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  path: string;
  status: HttpStatus;
  timestamp: string;
}

export function createApiError(
  status: HttpStatus,
  code: string,
  message: string,
  path: string,
  details?: Record<string, string>
): ApiError {
  return {
    status,
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    path,
  };
}

export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

export function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

export function getErrorMessage(status: HttpStatus): string {
  const messages: Record<HttpStatus, string> = {
    [HTTP_STATUS.OK]: i18n.t('util.httpStatus.ok', 'OK'),
    [HTTP_STATUS.CREATED]: i18n.t('util.httpStatus.created', 'Created'),
    [HTTP_STATUS.ACCEPTED]: i18n.t('util.httpStatus.accepted', 'Accepted'),
    [HTTP_STATUS.NO_CONTENT]: i18n.t('util.httpStatus.noContent', 'No Content'),
    [HTTP_STATUS.MOVED_PERMANENTLY]: i18n.t(
      'util.httpStatus.movedPermanently',
      'Moved Permanently'
    ),
    [HTTP_STATUS.FOUND]: i18n.t('util.httpStatus.found', 'Found'),
    [HTTP_STATUS.NOT_MODIFIED]: i18n.t('util.httpStatus.notModified', 'Not Modified'),
    [HTTP_STATUS.BAD_REQUEST]: i18n.t('util.httpStatus.badRequest', 'Bad Request'),
    [HTTP_STATUS.UNAUTHORIZED]: i18n.t('util.httpStatus.unauthorized', 'Unauthorized'),
    [HTTP_STATUS.PAYMENT_REQUIRED]: i18n.t('util.httpStatus.paymentRequired', 'Payment Required'),
    [HTTP_STATUS.FORBIDDEN]: i18n.t('util.httpStatus.forbidden', 'Forbidden'),
    [HTTP_STATUS.NOT_FOUND]: i18n.t('util.httpStatus.notFound', 'Not Found'),
    [HTTP_STATUS.METHOD_NOT_ALLOWED]: i18n.t(
      'util.httpStatus.methodNotAllowed',
      'Method Not Allowed'
    ),
    [HTTP_STATUS.CONFLICT]: i18n.t('util.httpStatus.conflict', 'Conflict'),
    [HTTP_STATUS.GONE]: i18n.t('util.httpStatus.gone', 'Gone'),
    [HTTP_STATUS.PAYLOAD_TOO_LARGE]: i18n.t('util.httpStatus.payloadTooLarge', 'Payload Too Large'),
    [HTTP_STATUS.UNPROCESSABLE_ENTITY]: i18n.t(
      'util.httpStatus.unprocessableEntity',
      'Unprocessable Entity'
    ),
    [HTTP_STATUS.TOO_MANY_REQUESTS]: i18n.t('util.httpStatus.tooManyRequests', 'Too Many Requests'),
    [HTTP_STATUS.INTERNAL_SERVER_ERROR]: i18n.t(
      'util.httpStatus.internalServerError',
      'Internal Server Error'
    ),
    [HTTP_STATUS.NOT_IMPLEMENTED]: i18n.t('util.httpStatus.notImplemented', 'Not Implemented'),
    [HTTP_STATUS.BAD_GATEWAY]: i18n.t('util.httpStatus.badGateway', 'Bad Gateway'),
    [HTTP_STATUS.SERVICE_UNAVAILABLE]: i18n.t(
      'util.httpStatus.serviceUnavailable',
      'Service Unavailable'
    ),
    [HTTP_STATUS.GATEWAY_TIMEOUT]: i18n.t('util.httpStatus.gatewayTimeout', 'Gateway Timeout'),
  };

  return messages[status] ?? i18n.t('util.httpStatus.unknownError', 'Unknown Error');
}

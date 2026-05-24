/**
 * @fileoverview MSW handlers for InputOTP component stories
 * @module input-otp.handlers
 * @description Provides comprehensive mock service worker handlers for OTP
 * verification scenarios including send, verify, resend, and various error states.
 *
 * ## API Endpoints
 * - POST /api/otp/send - Send OTP code to destination
 * - POST /api/otp/verify - Verify OTP code
 * - POST /api/verify/otp - Alternative verify endpoint (used by stories)
 * - POST /api/otp/resend - Resend OTP code
 * - POST /api/otp/validate - Validate OTP format
 *
 * ## Handler Categories
 * - Success handlers (2xx)
 * - Client error handlers (4xx)
 * - Server error handlers (5xx)
 * - Special state handlers (loading, timeout, network error)
 * - Domain-specific handlers (2FA, payment, email verification)
 *
 * @example
 * ```typescript
 * import { inputOtpHandlers, inputOtpStatusHandlers } from './_handlers/input-otp.handlers';
 *
 * // Use default handlers
 * parameters: { msw: { handlers: inputOtpHandlers } }
 *
 * // Use specific error state
 * parameters: { msw: { handlers: inputOtpStatusHandlers.otpExpired } }
 * ```
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// ============================================================================
// API ENDPOINT CONSTANTS
// ============================================================================

/** Send OTP code endpoint */
const API_OTP_SEND = '/api/otp/send';

/** Verify OTP code endpoint */
const API_OTP_VERIFY = '/api/otp/verify';

/** Alternative verify endpoint (used by some stories) */
const API_VERIFY_OTP = '/api/verify/otp';

/** Resend OTP code endpoint */
const API_OTP_RESEND = '/api/otp/resend';

/** Validate OTP format endpoint */
const API_OTP_VALIDATE = '/api/otp/validate';

/** 2FA specific endpoint */
const API_2FA_VERIFY = '/api/2fa/verify';

/** Payment OTP endpoint */
const API_PAYMENT_OTP = '/api/payment/verify-otp';

// ============================================================================
// RESPONSE MESSAGE CONSTANTS
// ============================================================================

/** Success message for OTP verification */
const MSG_OTP_VERIFIED = i18n.t(
  'handler.inputOtp.otpVerifiedSuccessfully',
  'OTP verified successfully'
);

/** Error message for invalid OTP code */
const MSG_INVALID_CODE = i18n.t(
  'handler.inputOtp.theCodeYouEnteredIs',
  'The code you entered is incorrect'
);

/** Error message for expired OTP code */
const MSG_CODE_EXPIRED = i18n.t(
  'handler.inputOtp.thisCodeHasExpiredPlease',
  'This code has expired. Please request a new one.'
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Masks an email address for privacy
 * @param email - Email address to mask
 * @returns Masked email (e.g., "te***@example.com")
 */
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex > 2) {
    return `${email.slice(0, 2)}***${email.slice(atIndex)}`;
  }
  return email;
}

/**
 * Masks a phone number for privacy
 * @param phone - Phone number to mask
 * @returns Masked phone (e.g., "+1***7890")
 */
function maskPhone(phone: string): string {
  if (phone.length > 5) {
    return `${phone.slice(0, 3)}***${phone.slice(-4)}`;
  }
  return phone;
}

/**
 * Generates a random verification token
 * @returns Random alphanumeric token
 */
function generateToken(): string {
  return faker.string.alphanumeric(32);
}

/**
 * Generates expiry timestamp
 * @param minutes - Minutes until expiry
 * @returns ISO timestamp string
 */
function generateExpiryTime(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/** OTP send request body */
interface OtpSendRequest {
  destination: string;
  purpose?: '2fa' | 'email-verification' | 'password-reset' | 'payment' | 'phone-verification';
  type?: 'email' | 'sms' | 'voice';
}

/** OTP verify request body */
interface OtpVerifyRequest {
  code: string;
  otp?: string; // Alternative field name
  sessionId?: string;
  userId?: string;
}

/** OTP resend request body */
interface OtpResendRequest {
  destination?: string;
  sessionId: string;
}

// ============================================================================
// DEFAULT SUCCESS HANDLERS
// ============================================================================

/**
 * Default OTP handlers for success scenarios
 * Includes send, verify (both endpoints), and resend handlers
 */
export const inputOtpHandlers = [
  // POST /api/otp/send - Send OTP code
  http.post(API_OTP_SEND, async ({ request }) => {
    const body = (await request.json()) as OtpSendRequest;
    await delay(faker.number.int({ min: 500, max: 1500 }));

    const isEmail = body.type === 'email';
    const maskedDestination = isEmail ? maskEmail(body.destination) : maskPhone(body.destination);

    return HttpResponse.json({
      success: true,
      destination: body.destination,
      type: body.type ?? 'sms',
      purpose: body.purpose ?? 'phone-verification',
      expiresAt: generateExpiryTime(5),
      codeLength: 6,
      maskedDestination,
      sessionId: faker.string.uuid(),
      canResendAt: generateExpiryTime(1),
    });
  }),

  // POST /api/otp/verify - Verify OTP code (primary endpoint)
  http.post(API_OTP_VERIFY, async ({ request }) => {
    const body = (await request.json()) as OtpVerifyRequest;
    const code = body.code ?? body.otp ?? '';
    await delay(faker.number.int({ min: 300, max: 800 }));

    // Accept codes starting with "1" as valid
    const isValid = code.length === 6 && code.startsWith('1');

    if (isValid) {
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        verifiedAt: new Date().toISOString(),
        message: MSG_OTP_VERIFIED,
      });
    }

    return HttpResponse.json(
      {
        success: false,
        verified: false,
        valid: false,
        error: 'INVALID_CODE',
        message: MSG_INVALID_CODE,
        attemptsRemaining: faker.number.int({ min: 1, max: 4 }),
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
  }),

  // POST /api/verify/otp - Alternative verify endpoint (used by stories)
  http.post(API_VERIFY_OTP, async ({ request }) => {
    const body = (await request.json()) as OtpVerifyRequest;
    const code = body.code ?? body.otp ?? '';
    await delay(faker.number.int({ min: 300, max: 800 }));

    // Accept codes starting with "1" as valid
    const isValid = code.length === 6 && code.startsWith('1');

    if (isValid) {
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        verifiedAt: new Date().toISOString(),
        message: MSG_OTP_VERIFIED,
      });
    }

    return HttpResponse.json(
      {
        success: false,
        verified: false,
        valid: false,
        error: 'INVALID_CODE',
        message: MSG_INVALID_CODE,
        attemptsRemaining: faker.number.int({ min: 1, max: 4 }),
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
  }),

  // POST /api/otp/resend - Resend OTP code
  http.post(API_OTP_RESEND, async ({ request }) => {
    const body = (await request.json()) as OtpResendRequest;
    await delay(faker.number.int({ min: 500, max: 1200 }));

    return HttpResponse.json({
      success: true,
      sessionId: body.sessionId ?? faker.string.uuid(),
      expiresAt: generateExpiryTime(5),
      canResendAt: generateExpiryTime(1),
      message: i18n.t('handler.inputOtp.newCodeSentSuccessfully', 'New code sent successfully'),
    });
  }),

  // POST /api/otp/validate - Validate OTP format
  http.post(API_OTP_VALIDATE, async ({ request }) => {
    const body = (await request.json()) as { code: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    const isValidFormat = /^\d{6}$/.test(body.code);

    return HttpResponse.json({
      valid: isValidFormat,
      format: 'numeric',
      length: body.code.length,
      expectedLength: 6,
    });
  }),
];

// ============================================================================
// STATUS-SPECIFIC HANDLERS FOR STORIES
// ============================================================================

/**
 * Status-specific handlers organized by response category
 * Use these to test specific error states and edge cases
 */
export const inputOtpStatusHandlers = {
  // ============ 2xx SUCCESS ============

  /** Default success handlers */
  success: inputOtpHandlers,

  /** Verification success (any code) */
  verifySuccess: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(500);
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        verifiedAt: new Date().toISOString(),
        message: MSG_OTP_VERIFIED,
      });
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(500);
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        verifiedAt: new Date().toISOString(),
        message: MSG_OTP_VERIFIED,
      });
    }),
  ],

  /** Verification with additional metadata */
  verifySuccessWithMetadata: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(500);
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        verifiedAt: new Date().toISOString(),
        message: MSG_OTP_VERIFIED,
        user: {
          id: faker.string.uuid(),
          email: faker.internet.email(),
          verified: true,
        },
        session: {
          id: faker.string.uuid(),
          expiresAt: generateExpiryTime(60),
        },
      });
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============

  /** Invalid OTP code */
  invalidCode: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'INVALID_CODE',
          message: MSG_INVALID_CODE,
          attemptsRemaining: 3,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'INVALID_CODE',
          message: MSG_INVALID_CODE,
          attemptsRemaining: 3,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  /** Expired OTP code */
  expiredCode: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(HTTP_STATUS.BAD_REQUEST, 'CODE_EXPIRED', MSG_CODE_EXPIRED, API_OTP_VERIFY),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(HTTP_STATUS.BAD_REQUEST, 'CODE_EXPIRED', MSG_CODE_EXPIRED, API_VERIFY_OTP),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  /** Maximum attempts reached */
  maxAttemptsReached: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'MAX_ATTEMPTS',
          i18n.t(
            'handler.inputOtp.maximumVerificationAttemptsReachedPlease',
            'Maximum verification attempts reached. Please request a new code.'
          ),
          API_OTP_VERIFY,
          { waitTime: '300', attemptsRemaining: '0' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  /** Resend cooldown active */
  resendCooldown: [
    http.post(API_OTP_RESEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'COOLDOWN_ACTIVE',
          i18n.t(
            'handler.inputOtp.pleaseWaitBeforeRequestingA',
            'Please wait before requesting a new code'
          ),
          API_OTP_RESEND,
          { waitSeconds: '45' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  /** Bad request - invalid format */
  badRequest: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_FORMAT',
          i18n.t('handler.inputOtp.invalidOtpFormat', 'Invalid OTP format'),
          API_OTP_VERIFY
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_FORMAT',
          i18n.t('handler.inputOtp.invalidOtpFormat', 'Invalid OTP format'),
          API_VERIFY_OTP
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  /** Unauthorized - session expired */
  unauthorized: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t(
            'handler.inputOtp.sessionExpiredPleaseLogIn',
            'Session expired. Please log in again.'
          ),
          API_OTP_VERIFY
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t(
            'handler.inputOtp.sessionExpiredPleaseLogIn',
            'Session expired. Please log in again.'
          ),
          API_VERIFY_OTP
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  /** Forbidden - account locked */
  forbidden: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCOUNT_LOCKED',
          i18n.t(
            'handler.inputOtp.accountIsLockedDueTo',
            'Account is locked due to too many failed attempts'
          ),
          API_OTP_VERIFY
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCOUNT_LOCKED',
          i18n.t(
            'handler.inputOtp.accountIsLockedDueTo',
            'Account is locked due to too many failed attempts'
          ),
          API_VERIFY_OTP
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  /** Unprocessable entity - validation failed */
  unprocessableEntity: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          i18n.t('handler.inputOtp.otpValidationFailed', 'OTP validation failed'),
          API_OTP_VERIFY,
          { code: i18n.t('handler.inputOtp.codeMustBe6Digits', 'Code must be 6 digits') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          i18n.t('handler.inputOtp.otpValidationFailed', 'OTP validation failed'),
          API_VERIFY_OTP,
          { otp: i18n.t('handler.inputOtp.codeMustBe6Digits', 'Code must be 6 digits') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  /** Not found - OTP session not found */
  notFound: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'SESSION_NOT_FOUND',
          i18n.t('handler.inputOtp.otpSessionNotFoundOr', 'OTP session not found or has expired'),
          API_OTP_VERIFY
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'SESSION_NOT_FOUND',
          i18n.t('handler.inputOtp.otpSessionNotFoundOr', 'OTP session not found or has expired'),
          API_VERIFY_OTP
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  /** Conflict - OTP already used */
  conflict: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'OTP_ALREADY_USED',
          i18n.t('handler.inputOtp.thisOtpCodeHasAlready', 'This OTP code has already been used'),
          API_OTP_VERIFY
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'OTP_ALREADY_USED',
          i18n.t('handler.inputOtp.thisOtpCodeHasAlready', 'This OTP code has already been used'),
          API_VERIFY_OTP
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  /** Too many requests - rate limited */
  tooManyRequests: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.inputOtp.tooManyVerificationAttemptsPlease',
            'Too many verification attempts. Please try again later.'
          ),
          API_OTP_VERIFY,
          {
            limit: '5/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.inputOtp.tooManyVerificationAttemptsPlease',
            'Too many verification attempts. Please try again later.'
          ),
          API_VERIFY_OTP,
          {
            limit: '5/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  /** Wrong code with remaining attempts */
  wrongCodeWithAttempts: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'INVALID_CODE',
          message: i18n.t(
            'handler.inputOtp.incorrectCode2AttemptsRemaining',
            'Incorrect code. 2 attempts remaining.'
          ),
          attemptsRemaining: 2,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'INVALID_CODE',
          message: i18n.t(
            'handler.inputOtp.incorrectCode2AttemptsRemaining',
            'Incorrect code. 2 attempts remaining.'
          ),
          attemptsRemaining: 2,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  /** Last attempt warning */
  lastAttempt: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'INVALID_CODE',
          message: i18n.t(
            'handler.inputOtp.incorrectCodeThisIsYour',
            'Incorrect code. This is your last attempt!'
          ),
          attemptsRemaining: 1,
          warning: true,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'INVALID_CODE',
          message: i18n.t(
            'handler.inputOtp.incorrectCodeThisIsYour',
            'Incorrect code. This is your last attempt!'
          ),
          attemptsRemaining: 1,
          warning: true,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============

  /** Internal server error */
  internalServerError: [
    http.post(API_OTP_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SEND_FAILED',
          i18n.t(
            'handler.inputOtp.failedToSendVerificationCode',
            'Failed to send verification code'
          ),
          API_OTP_SEND,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'VERIFICATION_FAILED',
          i18n.t('handler.inputOtp.verificationServiceError', 'Verification service error'),
          API_OTP_VERIFY,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'VERIFICATION_FAILED',
          i18n.t('handler.inputOtp.verificationServiceError', 'Verification service error'),
          API_VERIFY_OTP,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  /** Bad gateway */
  badGateway: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.inputOtp.otpServiceTemporarilyUnavailable',
            'OTP service temporarily unavailable'
          ),
          API_OTP_VERIFY
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.inputOtp.otpServiceTemporarilyUnavailable',
            'OTP service temporarily unavailable'
          ),
          API_VERIFY_OTP
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  /** Service unavailable */
  serviceUnavailable: [
    http.post(API_OTP_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SMS_SERVICE_DOWN',
          i18n.t(
            'handler.inputOtp.smsServiceIsTemporarilyUnavailable',
            'SMS service is temporarily unavailable'
          ),
          API_OTP_SEND,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_DOWN',
          i18n.t(
            'handler.inputOtp.verificationServiceIsTemporarilyUnavailable',
            'Verification service is temporarily unavailable'
          ),
          API_OTP_VERIFY,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'SERVICE_DOWN',
          i18n.t(
            'handler.inputOtp.verificationServiceIsTemporarilyUnavailable',
            'Verification service is temporarily unavailable'
          ),
          API_VERIFY_OTP,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  /** Gateway timeout */
  gatewayTimeout: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.inputOtp.otpVerificationTimedOutPlease',
            'OTP verification timed out. Please try again.'
          ),
          API_OTP_VERIFY
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.inputOtp.otpVerificationTimedOutPlease',
            'OTP verification timed out. Please try again.'
          ),
          API_VERIFY_OTP
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============

  /** Infinite loading */
  loading: [
    http.post(API_OTP_VERIFY, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  /** Slow verification (3-5 seconds) */
  slowVerification: [
    http.post(API_OTP_VERIFY, async ({ request }) => {
      const body = (await request.json()) as OtpVerifyRequest;
      const code = body.code ?? body.otp ?? '';
      await delay(4000);
      return HttpResponse.json({
        success: true,
        verified: code.length === 6,
        valid: code.length === 6,
        token: generateToken(),
      });
    }),
    http.post(API_VERIFY_OTP, async ({ request }) => {
      const body = (await request.json()) as OtpVerifyRequest;
      const code = body.code ?? body.otp ?? '';
      await delay(4000);
      return HttpResponse.json({
        success: true,
        verified: code.length === 6,
        valid: code.length === 6,
        token: generateToken(),
      });
    }),
  ],

  /** Slow response (5 seconds) */
  slowResponse: [
    http.post(API_OTP_VERIFY, async ({ request }) => {
      const body = (await request.json()) as OtpVerifyRequest;
      const code = body.code ?? body.otp ?? '';
      await delay(5000);
      return HttpResponse.json({
        success: true,
        verified: code.length === 6,
        valid: code.length === 6,
        token: generateToken(),
      });
    }),
    http.post(API_VERIFY_OTP, async ({ request }) => {
      const body = (await request.json()) as OtpVerifyRequest;
      const code = body.code ?? body.otp ?? '';
      await delay(5000);
      return HttpResponse.json({
        success: true,
        verified: code.length === 6,
        valid: code.length === 6,
        token: generateToken(),
      });
    }),
  ],

  /** Network error */
  networkError: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  // ============ STORY COMPATIBILITY ALIASES ============

  /** OTP expired (alias for expiredCode) */
  otpExpired: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(HTTP_STATUS.BAD_REQUEST, 'CODE_EXPIRED', MSG_CODE_EXPIRED, API_OTP_VERIFY),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(HTTP_STATUS.BAD_REQUEST, 'CODE_EXPIRED', MSG_CODE_EXPIRED, API_VERIFY_OTP),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  /** OTP max attempts (alias for maxAttemptsReached) */
  otpMaxAttempts: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'MAX_ATTEMPTS',
          i18n.t(
            'handler.inputOtp.maximumVerificationAttemptsReachedPlease',
            'Maximum verification attempts reached. Please request a new code.'
          ),
          API_OTP_VERIFY,
          { waitTime: '300', attemptsRemaining: '0' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'MAX_ATTEMPTS',
          i18n.t(
            'handler.inputOtp.maximumVerificationAttemptsReachedPlease',
            'Maximum verification attempts reached. Please request a new code.'
          ),
          API_VERIFY_OTP,
          { waitTime: '300', attemptsRemaining: '0' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ DOMAIN-SPECIFIC HANDLERS ============

  /** 2FA verification success */
  twoFactorSuccess: [
    http.post(API_2FA_VERIFY, async () => {
      await delay(500);
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        twoFactorEnabled: true,
        backupCodesRemaining: faker.number.int({ min: 5, max: 10 }),
        verifiedAt: new Date().toISOString(),
      });
    }),
    http.post(API_OTP_VERIFY, async () => {
      await delay(500);
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        twoFactorEnabled: true,
        backupCodesRemaining: faker.number.int({ min: 5, max: 10 }),
        verifiedAt: new Date().toISOString(),
      });
    }),
  ],

  /** 2FA verification failure */
  twoFactorFailure: [
    http.post(API_2FA_VERIFY, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'INVALID_2FA_CODE',
          message: i18n.t(
            'handler.inputOtp.invalidAuthenticatorCode',
            'Invalid authenticator code'
          ),
          attemptsRemaining: 2,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  /** Payment OTP verification success */
  paymentOtpSuccess: [
    http.post(API_PAYMENT_OTP, async () => {
      await delay(800);
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        transactionId: `TXN-${faker.string.alphanumeric(10).toUpperCase()}`,
        paymentAuthorized: true,
        verifiedAt: new Date().toISOString(),
      });
    }),
  ],

  /** Payment OTP verification failure */
  paymentOtpFailure: [
    http.post(API_PAYMENT_OTP, async () => {
      await delay(500);
      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'PAYMENT_OTP_INVALID',
          message: i18n.t(
            'handler.inputOtp.paymentVerificationFailedPleaseTry',
            'Payment verification failed. Please try again.'
          ),
          attemptsRemaining: 2,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  /** Email verification OTP success */
  emailVerificationSuccess: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(500);
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        emailVerified: true,
        email: faker.internet.email(),
        verifiedAt: new Date().toISOString(),
      });
    }),
  ],

  /** Phone verification OTP success */
  phoneVerificationSuccess: [
    http.post(API_OTP_VERIFY, async () => {
      await delay(500);
      return HttpResponse.json({
        success: true,
        verified: true,
        valid: true,
        token: generateToken(),
        phoneVerified: true,
        phone: maskPhone(faker.phone.number()),
        verifiedAt: new Date().toISOString(),
      });
    }),
  ],

  /** Resend success with cooldown */
  resendSuccess: [
    http.post(API_OTP_RESEND, async () => {
      await delay(500);
      return HttpResponse.json({
        success: true,
        sessionId: faker.string.uuid(),
        expiresAt: generateExpiryTime(5),
        canResendAt: generateExpiryTime(1),
        message: i18n.t('handler.inputOtp.newVerificationCodeSent', 'New verification code sent'),
        deliveryMethod: 'sms',
      });
    }),
  ],
};

// ============================================================================
// HANDLER COMPOSITION HELPERS
// ============================================================================

/**
 * Creates a custom verify handler with specific behavior
 * @param config - Handler configuration
 * @returns MSW handler
 */
export function createCustomVerifyHandler(config: {
  attemptsRemaining?: number;
  delay?: number;
  message?: string;
  success: boolean;
}) {
  return [
    http.post(API_OTP_VERIFY, async () => {
      await delay(config.delay ?? 300);

      if (config.success) {
        return HttpResponse.json({
          success: true,
          verified: true,
          valid: true,
          token: generateToken(),
          verifiedAt: new Date().toISOString(),
          message:
            config.message ??
            i18n.t('handler.inputOtp.otpVerifiedSuccessfully', 'OTP verified successfully'),
        });
      }

      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'INVALID_CODE',
          message: config.message ?? i18n.t('handler.inputOtp.invalidCode', 'Invalid code'),
          attemptsRemaining: config.attemptsRemaining ?? 3,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_VERIFY_OTP, async () => {
      await delay(config.delay ?? 300);

      if (config.success) {
        return HttpResponse.json({
          success: true,
          verified: true,
          valid: true,
          token: generateToken(),
          verifiedAt: new Date().toISOString(),
          message:
            config.message ??
            i18n.t('handler.inputOtp.otpVerifiedSuccessfully', 'OTP verified successfully'),
        });
      }

      return HttpResponse.json(
        {
          success: false,
          verified: false,
          valid: false,
          error: 'INVALID_CODE',
          message: config.message ?? i18n.t('handler.inputOtp.invalidCode', 'Invalid code'),
          attemptsRemaining: config.attemptsRemaining ?? 3,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ];
}

/**
 * Combines multiple handler sets
 * @param handlers - Array of handler arrays to combine
 * @returns Combined handler array
 */
export function combineInputOtpHandlers(
  ...handlers: Array<typeof inputOtpHandlers>
): typeof inputOtpHandlers {
  return handlers.flat();
}

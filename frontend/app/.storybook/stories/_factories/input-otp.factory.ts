/**
 * @fileoverview Factory functions for generating fake InputOTP component data
 * @module input-otp.factory
 * @description Provides comprehensive test data generation for InputOTP components
 * including verification codes, PIN inputs, 2FA tokens, and more.
 *
 * @example
 * ```typescript
 * import { createFakeInputOTP, createFake2FAInputOTP } from './_factories/input-otp.factory';
 *
 * // Create a random OTP input configuration
 * const otpInput = createFakeInputOTP();
 *
 * // Create a 2FA-specific configuration
 * const twoFAInput = createFake2FAInputOTP();
 * ```
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * OTP length options
 * @description Common OTP code lengths
 */
export type InputOTPLength = 4 | 5 | 6 | 7 | 8;

/**
 * OTP input mode
 * @description Controls what type of characters are allowed
 */
export type InputOTPMode = 'alphanumeric' | 'mixed' | 'numeric';

/**
 * OTP purpose type
 * @description Describes the purpose of the OTP
 */
export type InputOTPPurpose =
  | 'email-verification'
  | 'password-reset'
  | 'payment-confirmation'
  | 'phone-verification'
  | 'two-factor-auth';

/**
 * OTP verification state
 * @description Current state of OTP verification
 */
export type InputOTPVerificationState =
  | 'error'
  | 'expired'
  | 'idle'
  | 'invalid'
  | 'loading'
  | 'rate-limited'
  | 'success';

/**
 * OTP slot state
 * @description State of an individual OTP slot
 */
export type InputOTPSlotState = 'active' | 'empty' | 'error' | 'filled';

/**
 * OTP layout type
 * @description How the OTP slots are arranged
 */
export type InputOTPLayout = 'grouped' | 'single' | 'split';

/**
 * OTP size variant
 * @description Size of the OTP input slots
 */
export type InputOTPSize = 'lg' | 'md' | 'sm' | 'xl';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Common OTP lengths */
export const INPUT_OTP_LENGTHS: InputOTPLength[] = [4, 5, 6, 7, 8];

/** All available OTP modes */
export const INPUT_OTP_MODES: InputOTPMode[] = ['numeric', 'alphanumeric', 'mixed'];

/** All available OTP purposes */
export const INPUT_OTP_PURPOSES: InputOTPPurpose[] = [
  'two-factor-auth',
  'email-verification',
  'phone-verification',
  'password-reset',
  'payment-confirmation',
];

/** All available verification states */
export const INPUT_OTP_VERIFICATION_STATES: InputOTPVerificationState[] = [
  'idle',
  'loading',
  'success',
  'error',
  'invalid',
  'expired',
  'rate-limited',
];

/** All available slot states */
export const INPUT_OTP_SLOT_STATES: InputOTPSlotState[] = ['empty', 'filled', 'active', 'error'];

/** All available layout options */
export const INPUT_OTP_LAYOUTS: InputOTPLayout[] = ['single', 'grouped', 'split'];

/** All available size variants */
export const INPUT_OTP_SIZES: InputOTPSize[] = ['sm', 'md', 'lg', 'xl'];

/** Common numeric OTP patterns */
export const INPUT_OTP_NUMERIC_PATTERNS = ['123456', '000000', '111111', '654321', '999999'];

/** Common alphanumeric OTP patterns */
export const INPUT_OTP_ALPHANUMERIC_PATTERNS = ['A1B2C3', 'ABC123', 'X7Y8Z9', 'SECURE', 'VERIFY'];

/** Verification state: rate-limited */
const STATE_RATE_LIMITED: InputOTPVerificationState = 'rate-limited';

/** Common error messages */
const ERROR_INVALID_CODE = i18n.t(
  'factory.inputOtp.invalidVerificationCode',
  'Invalid verification code'
);
const ERROR_EXPIRED_CODE = i18n.t('factory.inputOtp.codeHasExpired', 'Code has expired');
const ERROR_TOO_MANY_ATTEMPTS = i18n.t('factory.inputOtp.tooManyAttempts', 'Too many attempts');
const ERROR_NETWORK = i18n.t('factory.inputOtp.networkErrorOccurred', 'Network error occurred');

export const INPUT_OTP_ERROR_MESSAGES = {
  expired: ERROR_EXPIRED_CODE,
  invalid: ERROR_INVALID_CODE,
  network: ERROR_NETWORK,
  rateLimited: ERROR_TOO_MANY_ATTEMPTS,
};

/** Verification success messages */
export const INPUT_OTP_SUCCESS_MESSAGES = [
  i18n.t('factory.inputOtp.codeVerifiedSuccessfully', 'Code verified successfully'),
  i18n.t('factory.inputOtp.verificationComplete', 'Verification complete'),
  i18n.t('factory.inputOtp.authenticationSuccessful', 'Authentication successful'),
  i18n.t('factory.inputOtp.identityConfirmed', 'Identity confirmed'),
];

/** Aria labels for OTP inputs */
const ARIA_LABEL_OTP = i18n.t('factory.inputOtp.onetimePasswordInput', 'One-time password input');
const ARIA_LABEL_2FA = i18n.t(
  'factory.inputOtp.twofactorAuthenticationCode',
  'Two-factor authentication code'
);
const ARIA_LABEL_PIN = i18n.t('factory.inputOtp.pinCode', 'PIN code');
const ARIA_LABEL_VERIFY = i18n.t('factory.inputOtp.verificationCode', 'Verification code');

export const INPUT_OTP_ARIA_LABELS = {
  otp: ARIA_LABEL_OTP,
  pin: ARIA_LABEL_PIN,
  twoFA: ARIA_LABEL_2FA,
  verification: ARIA_LABEL_VERIFY,
};

/** Placeholder descriptions for OTP types */
export const INPUT_OTP_DESCRIPTIONS: Record<InputOTPPurpose, string> = {
  'email-verification': i18n.t(
    'factory.inputOtp.enterTheCodeSentToYourEmail',
    'Enter the code sent to your email'
  ),
  'password-reset': i18n.t(
    'factory.inputOtp.enterThePasswordResetCode',
    'Enter the password reset code'
  ),
  'payment-confirmation': i18n.t(
    'factory.inputOtp.enterThePaymentVerificationCode',
    'Enter the payment verification code'
  ),
  'phone-verification': i18n.t(
    'factory.inputOtp.enterTheCodeSentToYourPhone',
    'Enter the code sent to your phone'
  ),
  'two-factor-auth': i18n.t(
    'factory.inputOtp.enterYour2faCodeFromYourAuthenticatorApp',
    'Enter your 2FA code from your authenticator app'
  ),
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents a single OTP slot configuration
 */
export interface FakeInputOTPSlot {
  /** Whether the slot has a fake caret */
  hasFakeCaret: boolean;
  /** Slot index */
  index: number;
  /** Whether the slot is currently focused */
  isActive: boolean;
  /** Current state of the slot */
  state: InputOTPSlotState;
  /** Value in the slot (single character) */
  value: string;
}

/**
 * Represents a group of OTP slots
 */
export interface FakeInputOTPGroup {
  /** Unique identifier */
  id: string;
  /** Number of slots in the group */
  slotCount: number;
  /** Slots in this group */
  slots: FakeInputOTPSlot[];
}

/**
 * Represents a complete InputOTP configuration
 */
export interface FakeInputOTP {
  /** Aria label for accessibility */
  ariaLabel: string;
  /** Whether the input is auto-focused */
  autoFocus: boolean;
  /** Auto-submit when complete */
  autoSubmit: boolean;
  /** Additional className */
  className?: string;
  /** Container className */
  containerClassName?: string;
  /** Description text */
  description: string;
  /** Whether the input is disabled */
  disabled: boolean;
  /** Error message if verification failed */
  errorMessage?: string;
  /** Groups of OTP slots */
  groups: FakeInputOTPGroup[];
  /** Unique identifier */
  id: string;
  /** Layout type */
  layout: InputOTPLayout;
  /** Whether to mask the input (like password) */
  masked: boolean;
  /** Maximum length of the OTP code */
  maxLength: InputOTPLength;
  /** Input mode (numeric, alphanumeric, mixed) */
  mode: InputOTPMode;
  /** Display name */
  name: string;
  /** Purpose of the OTP */
  purpose: InputOTPPurpose;
  /** Size variant */
  size: InputOTPSize;
  /** Success message if verification succeeded */
  successMessage?: string;
  /** Test ID */
  testId?: string;
  /** Current value of the OTP input */
  value: string;
  /** Current verification state */
  verificationState: InputOTPVerificationState;
}

/**
 * Represents a 2FA OTP configuration
 */
export interface Fake2FAInputOTP extends FakeInputOTP {
  /** Authenticator app name */
  authenticatorApp: string;
  /** Backup codes available */
  backupCodesAvailable: boolean;
  /** Whether this is a backup code entry */
  isBackupCode: boolean;
  /** Remember device option */
  rememberDevice: boolean;
  /** Time remaining for current code */
  timeRemaining: number;
}

/**
 * Represents an email verification OTP configuration
 */
export interface FakeEmailVerificationOTP extends FakeInputOTP {
  /** Resend code available */
  canResend: boolean;
  /** Email address being verified */
  email: string;
  /** Whether the email is masked */
  emailMasked: boolean;
  /** Seconds until resend is available */
  resendCooldown: number;
}

/**
 * Represents a phone verification OTP configuration
 */
export interface FakePhoneVerificationOTP extends FakeInputOTP {
  /** Resend code available */
  canResend: boolean;
  /** SMS or voice call delivery */
  deliveryMethod: 'sms' | 'voice';
  /** Whether the phone is masked */
  phoneMasked: boolean;
  /** Phone number being verified */
  phoneNumber: string;
  /** Seconds until resend is available */
  resendCooldown: number;
}

/**
 * Represents a payment confirmation OTP configuration
 */
export interface FakePaymentOTP extends FakeInputOTP {
  /** Transaction amount */
  amount: number;
  /** Last 4 digits of card */
  cardLast4: string;
  /** Currency code */
  currency: string;
  /** Merchant name */
  merchantName: string;
  /** Transaction reference */
  transactionRef: string;
}

/**
 * Represents a password reset OTP configuration
 */
export interface FakePasswordResetOTP extends FakeInputOTP {
  /** Email for password reset */
  email: string;
  /** Expiry time in minutes */
  expiryMinutes: number;
  /** Whether the link has been used */
  linkUsed: boolean;
}

/**
 * Represents OTP verification response
 */
export interface FakeOTPVerificationResponse {
  /** Error code if failed */
  errorCode?: string;
  /** Response message */
  message: string;
  /** Remaining attempts */
  remainingAttempts?: number;
  /** Time until retry allowed */
  retryAfter?: number;
  /** Whether verification was successful */
  success: boolean;
  /** Whether the code is valid */
  valid: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determines the state of an OTP slot
 */
function getSlotState(char: string, isActive: boolean): InputOTPSlotState {
  if (char) {
    return 'filled';
  }
  if (isActive) {
    return 'active';
  }
  return 'empty';
}

/**
 * Generates a random numeric OTP code
 */
function generateNumericOTP(length: number): string {
  return Array.from({ length }, () => faker.number.int({ min: 0, max: 9 })).join('');
}

/**
 * Generates a random alphanumeric OTP code
 */
function generateAlphanumericOTP(length: number): string {
  return faker.string.alphanumeric({ length, casing: 'upper' });
}

/**
 * Generates an OTP code based on mode
 */
function generateOTPCode(length: number, mode: InputOTPMode): string {
  if (mode === 'numeric') {
    return generateNumericOTP(length);
  }
  if (mode === 'alphanumeric') {
    return generateAlphanumericOTP(length);
  }
  // Mixed mode: combine numeric and alphanumeric
  return Array.from({ length }, () =>
    faker.datatype.boolean()
      ? faker.number.int({ min: 0, max: 9 }).toString()
      : faker.string.alpha({ length: 1, casing: 'upper' })
  ).join('');
}

/**
 * Creates fake OTP slots from a value
 */
function createFakeOTPSlots(value: string, maxLength: number): FakeInputOTPSlot[] {
  return Array.from({ length: maxLength }, (_, index) => {
    const char = value[index] || '';
    const isActive = index === value.length;

    return {
      index,
      state: getSlotState(char, isActive),
      value: char,
      isActive,
      hasFakeCaret: isActive,
    };
  });
}

/**
 * Creates fake OTP groups based on layout
 */
function createFakeOTPGroups(
  value: string,
  maxLength: number,
  layout: InputOTPLayout
): FakeInputOTPGroup[] {
  const slots = createFakeOTPSlots(value, maxLength);

  if (layout === 'single') {
    return [
      {
        id: faker.string.uuid(),
        slots,
        slotCount: maxLength,
      },
    ];
  }

  if (layout === 'grouped' || layout === 'split') {
    // Split into two groups
    const midpoint = Math.ceil(maxLength / 2);
    return [
      {
        id: faker.string.uuid(),
        slots: slots.slice(0, midpoint),
        slotCount: midpoint,
      },
      {
        id: faker.string.uuid(),
        slots: slots.slice(midpoint),
        slotCount: maxLength - midpoint,
      },
    ];
  }

  return [
    {
      id: faker.string.uuid(),
      slots,
      slotCount: maxLength,
    },
  ];
}

/**
 * Gets error message for verification state
 */
function getErrorMessage(state: InputOTPVerificationState): string | undefined {
  if (state === 'invalid') {
    return ERROR_INVALID_CODE;
  }
  if (state === 'expired') {
    return ERROR_EXPIRED_CODE;
  }
  if (state === STATE_RATE_LIMITED) {
    return ERROR_TOO_MANY_ATTEMPTS;
  }
  if (state === 'error') {
    return ERROR_NETWORK;
  }
  return undefined;
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a single fake InputOTP configuration
 * @param overrides - Optional partial object to override default values
 * @returns A fake InputOTP configuration
 */
export function createFakeInputOTP(overrides?: Partial<FakeInputOTP>): FakeInputOTP {
  const maxLength = faker.helpers.arrayElement(INPUT_OTP_LENGTHS);
  const mode = faker.helpers.arrayElement(INPUT_OTP_MODES);
  const purpose = faker.helpers.arrayElement(INPUT_OTP_PURPOSES);
  const layout = faker.helpers.arrayElement(INPUT_OTP_LAYOUTS);
  const verificationState = faker.helpers.arrayElement(INPUT_OTP_VERIFICATION_STATES);
  const hasValue = faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false;
  const value = hasValue ? generateOTPCode(faker.number.int({ min: 1, max: maxLength }), mode) : '';

  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      i18n.t('factory.inputOtp.otpInput', 'OTP Input'),
      i18n.t('factory.inputOtp.verificationCode2', 'Verification Code'),
      i18n.t('factory.inputOtp.twoFaCode', '2FA Code'),
      i18n.t('factory.inputOtp.pinEntry', 'PIN Entry'),
    ]),
    maxLength,
    mode,
    purpose,
    value,
    verificationState,
    errorMessage: getErrorMessage(verificationState),
    successMessage:
      verificationState === 'success'
        ? faker.helpers.arrayElement(INPUT_OTP_SUCCESS_MESSAGES)
        : undefined,
    layout,
    size: faker.helpers.arrayElement(INPUT_OTP_SIZES),
    groups: createFakeOTPGroups(value, maxLength, layout),
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }) ?? false,
    autoFocus: faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false,
    ariaLabel: INPUT_OTP_DESCRIPTIONS[purpose].split('.')[0] || ARIA_LABEL_OTP,
    description: INPUT_OTP_DESCRIPTIONS[purpose],
    masked: faker.helpers.maybe(() => true, { probability: 0.2 }) ?? false,
    autoSubmit: faker.helpers.maybe(() => true, { probability: 0.7 }) ?? false,
    containerClassName: faker.helpers.maybe(() => 'custom-container', { probability: 0.1 }),
    className: faker.helpers.maybe(() => 'custom-otp', { probability: 0.1 }),
    testId: `otp-input-${faker.string.alphanumeric(8)}`,
    ...overrides,
  };
}

/**
 * Creates multiple fake InputOTP configurations
 * @param count - Number of configurations to create
 * @returns Array of fake InputOTP configurations
 */
export function createFakeInputOTPs(count: number): FakeInputOTP[] {
  return Array.from({ length: count }, () => createFakeInputOTP());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a 2FA OTP configuration
 * @param overrides - Optional partial object to override default values
 * @returns A 2FA-specific InputOTP configuration
 */
export function createFake2FAInputOTP(overrides?: Partial<Fake2FAInputOTP>): Fake2FAInputOTP {
  return {
    ...createFakeInputOTP({
      name: i18n.t('factory.inputOtp.twoFaCode', '2FA Code'),
      maxLength: 6,
      mode: 'numeric',
      purpose: 'two-factor-auth',
      layout: 'grouped',
      ariaLabel: ARIA_LABEL_2FA,
      description: INPUT_OTP_DESCRIPTIONS['two-factor-auth'],
    }),
    authenticatorApp: faker.helpers.arrayElement([
      i18n.t('factory.inputOtp.googleAuthenticator', 'Google Authenticator'),
      i18n.t('factory.inputOtp.microsoftAuthenticator', 'Microsoft Authenticator'),
      i18n.t('factory.inputOtp.authy', 'Authy'),
      '1Password',
      i18n.t('factory.inputOtp.duoMobile', 'Duo Mobile'),
    ]),
    backupCodesAvailable: faker.helpers.maybe(() => true, { probability: 0.8 }) ?? false,
    timeRemaining: faker.number.int({ min: 5, max: 30 }),
    isBackupCode: faker.helpers.maybe(() => true, { probability: 0.1 }) ?? false,
    rememberDevice: faker.helpers.maybe(() => true, { probability: 0.3 }) ?? false,
    ...overrides,
  };
}

/**
 * Creates an email verification OTP configuration
 * @param overrides - Optional partial object to override default values
 * @returns An email verification InputOTP configuration
 */
export function createFakeEmailVerificationOTP(
  overrides?: Partial<FakeEmailVerificationOTP>
): FakeEmailVerificationOTP {
  const email = faker.internet.email();
  const [localPart, domain] = email.split('@');
  const maskedLocal = `${localPart.slice(0, 2)}***`;
  const maskedEmail = `${maskedLocal}@${domain}`;

  return {
    ...createFakeInputOTP({
      name: i18n.t('factory.inputOtp.emailVerification', 'Email Verification'),
      maxLength: 6,
      mode: 'numeric',
      purpose: 'email-verification',
      layout: 'grouped',
      ariaLabel: ARIA_LABEL_VERIFY,
      description: INPUT_OTP_DESCRIPTIONS['email-verification'],
    }),
    email,
    emailMasked: true,
    canResend: faker.helpers.maybe(() => true, { probability: 0.7 }) ?? false,
    resendCooldown: faker.number.int({ min: 0, max: 60 }),
    ...overrides,
    // Include the masked email in description
    description: i18n.t('factory.inputOtp.enterCodeEmail', 'Enter the code sent to {{email}}', {
      email: maskedEmail,
    }),
  };
}

/**
 * Creates a phone verification OTP configuration
 * @param overrides - Optional partial object to override default values
 * @returns A phone verification InputOTP configuration
 */
export function createFakePhoneVerificationOTP(
  overrides?: Partial<FakePhoneVerificationOTP>
): FakePhoneVerificationOTP {
  const phoneNumber = faker.phone.number();
  const maskedPhone = phoneNumber.slice(0, -4).replaceAll(/\d/g, '*') + phoneNumber.slice(-4);

  return {
    ...createFakeInputOTP({
      name: i18n.t('factory.inputOtp.phoneVerification', 'Phone Verification'),
      maxLength: 6,
      mode: 'numeric',
      purpose: 'phone-verification',
      layout: 'grouped',
      ariaLabel: ARIA_LABEL_VERIFY,
      description: INPUT_OTP_DESCRIPTIONS['phone-verification'],
    }),
    phoneNumber,
    phoneMasked: true,
    canResend: faker.helpers.maybe(() => true, { probability: 0.7 }) ?? false,
    resendCooldown: faker.number.int({ min: 0, max: 60 }),
    deliveryMethod: faker.helpers.arrayElement(['sms', 'voice']),
    ...overrides,
    // Include the masked phone in description
    description: i18n.t('factory.inputOtp.enterCodePhone', 'Enter the code sent to {{phone}}', {
      phone: maskedPhone,
    }),
  };
}

/**
 * Creates a payment confirmation OTP configuration
 * @param overrides - Optional partial object to override default values
 * @returns A payment confirmation InputOTP configuration
 */
export function createFakePaymentOTP(overrides?: Partial<FakePaymentOTP>): FakePaymentOTP {
  const amount = faker.number.float({ min: 10, max: 1000, fractionDigits: 2 });
  const currency = faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'JPY']);

  return {
    ...createFakeInputOTP({
      name: i18n.t('factory.inputOtp.paymentVerification', 'Payment Verification'),
      maxLength: 6,
      mode: 'numeric',
      purpose: 'payment-confirmation',
      layout: 'grouped',
      ariaLabel: i18n.t('factory.inputOtp.paymentVerificationCode', 'Payment verification code'),
      description: INPUT_OTP_DESCRIPTIONS['payment-confirmation'],
    }),
    amount,
    currency,
    merchantName: faker.company.name(),
    cardLast4: faker.finance.creditCardNumber().slice(-4),
    transactionRef: faker.string.alphanumeric(10).toUpperCase(),
    ...overrides,
  };
}

/**
 * Creates a password reset OTP configuration
 * @param overrides - Optional partial object to override default values
 * @returns A password reset InputOTP configuration
 */
export function createFakePasswordResetOTP(
  overrides?: Partial<FakePasswordResetOTP>
): FakePasswordResetOTP {
  return {
    ...createFakeInputOTP({
      name: i18n.t('factory.inputOtp.passwordReset', 'Password Reset'),
      maxLength: 6,
      mode: 'numeric',
      purpose: 'password-reset',
      layout: 'grouped',
      ariaLabel: i18n.t('factory.inputOtp.passwordResetCode', 'Password reset code'),
      description: INPUT_OTP_DESCRIPTIONS['password-reset'],
    }),
    email: faker.internet.email(),
    expiryMinutes: faker.helpers.arrayElement([10, 15, 30, 60]),
    linkUsed: faker.helpers.maybe(() => true, { probability: 0.2 }) ?? false,
    ...overrides,
  };
}

/**
 * Creates a PIN entry OTP configuration
 * @param overrides - Optional partial object to override default values
 * @returns A PIN entry InputOTP configuration
 */
export function createFakePINInputOTP(overrides?: Partial<FakeInputOTP>): FakeInputOTP {
  return createFakeInputOTP({
    name: i18n.t('factory.inputOtp.pinEntry', 'PIN Entry'),
    maxLength: 4,
    mode: 'numeric',
    layout: 'single',
    ariaLabel: ARIA_LABEL_PIN,
    description: i18n.t('factory.inputOtp.enterYour4digitPin', 'Enter your 4-digit PIN'),
    masked: true,
    ...overrides,
  });
}

/**
 * Creates an OTP verification response
 * @param success - Whether verification was successful
 * @param overrides - Optional partial object to override default values
 * @returns A fake OTP verification response
 */
export function createFakeOTPVerificationResponse(
  success: boolean,
  overrides?: Partial<FakeOTPVerificationResponse>
): FakeOTPVerificationResponse {
  if (success) {
    return {
      success: true,
      valid: true,
      message: faker.helpers.arrayElement(INPUT_OTP_SUCCESS_MESSAGES),
      ...overrides,
    };
  }

  const errorType = faker.helpers.arrayElement(['invalid', 'expired', 'rateLimited'] as const);
  const errorMessages: Record<typeof errorType, string> = {
    expired: INPUT_OTP_ERROR_MESSAGES.expired,
    invalid: INPUT_OTP_ERROR_MESSAGES.invalid,
    rateLimited: INPUT_OTP_ERROR_MESSAGES.rateLimited,
  };
  return {
    success: false,
    valid: false,
    message: errorMessages[errorType],
    errorCode: errorType.toUpperCase().replace('-', '_'),
    remainingAttempts: errorType === 'invalid' ? faker.number.int({ min: 0, max: 3 }) : undefined,
    retryAfter: errorType === 'rateLimited' ? faker.number.int({ min: 30, max: 300 }) : undefined,
    ...overrides,
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of OTP inputs by length
 * @returns Array of InputOTP configurations for length testing
 */
export function createFakeInputOTPLengthMatrix(): FakeInputOTP[] {
  return INPUT_OTP_LENGTHS.map((length) =>
    createFakeInputOTP({
      name: i18n.t('factory.inputOtp.nDigitOtp', '{{length}}-digit OTP', { length }),
      maxLength: length,
      layout: length > 5 ? 'grouped' : 'single',
    })
  );
}

/**
 * Creates a matrix of OTP inputs by mode
 * @returns Array of InputOTP configurations for mode testing
 */
export function createFakeInputOTPModeMatrix(): FakeInputOTP[] {
  return INPUT_OTP_MODES.map((mode) =>
    createFakeInputOTP({
      name: i18n.t('factory.inputOtp.modeOtp', '{{mode}} OTP', {
        mode: mode.charAt(0).toUpperCase() + mode.slice(1),
      }),
      mode,
      value: generateOTPCode(6, mode),
    })
  );
}

/**
 * Creates a matrix of OTP inputs by verification state
 * @returns Array of InputOTP configurations for state testing
 */
export function createFakeInputOTPStateMatrix(): FakeInputOTP[] {
  return INPUT_OTP_VERIFICATION_STATES.map((state) =>
    createFakeInputOTP({
      name: i18n.t('factory.inputOtp.stateName', 'State: {{state}}', { state }),
      verificationState: state,
      value: state === 'idle' ? '' : '123456',
      errorMessage: getErrorMessage(state),
      successMessage:
        state === 'success' ? faker.helpers.arrayElement(INPUT_OTP_SUCCESS_MESSAGES) : undefined,
    })
  );
}

/**
 * Creates a matrix of OTP inputs by layout
 * @returns Array of InputOTP configurations for layout testing
 */
export function createFakeInputOTPLayoutMatrix(): FakeInputOTP[] {
  return INPUT_OTP_LAYOUTS.map((layout) =>
    createFakeInputOTP({
      name: i18n.t('factory.inputOtp.layoutName', 'Layout: {{layout}}', { layout }),
      layout,
      maxLength: 6,
      value: '123',
    })
  );
}

/**
 * Creates a matrix of OTP inputs by size
 * @returns Array of InputOTP configurations for size testing
 */
export function createFakeInputOTPSizeMatrix(): FakeInputOTP[] {
  return INPUT_OTP_SIZES.map((size) =>
    createFakeInputOTP({
      name: i18n.t('factory.inputOtp.sizeName', 'Size: {{size}}', { size }),
      size,
      maxLength: 6,
    })
  );
}

/**
 * Creates a matrix of OTP inputs by purpose
 * @returns Array of InputOTP configurations for purpose testing
 */
export function createFakeInputOTPPurposeMatrix(): FakeInputOTP[] {
  return INPUT_OTP_PURPOSES.map((purpose) =>
    createFakeInputOTP({
      name: purpose
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      purpose,
      description: INPUT_OTP_DESCRIPTIONS[purpose],
    })
  );
}

/**
 * Creates a comprehensive showcase of all OTP input types
 * @returns Record of categorized InputOTP configurations
 */
export function createFakeInputOTPShowcase(): Record<string, FakeInputOTP> {
  return {
    // Basic types
    basic: createFakeInputOTP({ name: i18n.t('factory.inputOtp.basicOtp', 'Basic OTP') }),
    twoFA: createFake2FAInputOTP(),
    emailVerification: createFakeEmailVerificationOTP(),
    phoneVerification: createFakePhoneVerificationOTP(),
    payment: createFakePaymentOTP(),
    passwordReset: createFakePasswordResetOTP(),
    pin: createFakePINInputOTP(),

    // States
    stateIdle: createFakeInputOTP({
      verificationState: 'idle',
      name: i18n.t('factory.inputOtp.idleState', 'Idle State'),
    }),
    stateLoading: createFakeInputOTP({
      verificationState: 'loading',
      name: i18n.t('factory.inputOtp.loadingState', 'Loading State'),
    }),
    stateSuccess: createFakeInputOTP({
      verificationState: 'success',
      name: i18n.t('factory.inputOtp.successState', 'Success State'),
    }),
    stateError: createFakeInputOTP({
      verificationState: 'error',
      name: i18n.t('factory.inputOtp.errorState', 'Error State'),
    }),
    stateInvalid: createFakeInputOTP({
      verificationState: 'invalid',
      name: i18n.t('factory.inputOtp.invalidState', 'Invalid State'),
    }),
    stateExpired: createFakeInputOTP({
      verificationState: 'expired',
      name: i18n.t('factory.inputOtp.expiredState', 'Expired State'),
    }),
    stateRateLimited: createFakeInputOTP({
      verificationState: STATE_RATE_LIMITED,
      name: i18n.t('factory.inputOtp.rateLimited', 'Rate Limited'),
    }),

    // Layouts
    layoutSingle: createFakeInputOTP({
      layout: 'single',
      name: i18n.t('factory.inputOtp.singleLayout', 'Single Layout'),
    }),
    layoutGrouped: createFakeInputOTP({
      layout: 'grouped',
      name: i18n.t('factory.inputOtp.groupedLayout', 'Grouped Layout'),
    }),
    layoutSplit: createFakeInputOTP({
      layout: 'split',
      name: i18n.t('factory.inputOtp.splitLayout', 'Split Layout'),
    }),

    // Modes
    modeNumeric: createFakeInputOTP({
      mode: 'numeric',
      name: i18n.t('factory.inputOtp.numericMode', 'Numeric Mode'),
    }),
    modeAlphanumeric: createFakeInputOTP({
      mode: 'alphanumeric',
      name: i18n.t('factory.inputOtp.alphanumericMode', 'Alphanumeric Mode'),
    }),
    modeMixed: createFakeInputOTP({
      mode: 'mixed',
      name: i18n.t('factory.inputOtp.mixedMode', 'Mixed Mode'),
    }),

    // Special
    disabled: createFakeInputOTP({
      disabled: true,
      name: i18n.t('factory.inputOtp.disabledOtp', 'Disabled OTP'),
    }),
    masked: createFakeInputOTP({
      masked: true,
      name: i18n.t('factory.inputOtp.maskedOtp', 'Masked OTP'),
    }),
    autoFocus: createFakeInputOTP({
      autoFocus: true,
      name: i18n.t('factory.inputOtp.autofocusOtp', 'Auto-focus OTP'),
    }),
    autoSubmit: createFakeInputOTP({
      autoSubmit: true,
      name: i18n.t('factory.inputOtp.autosubmitOtp', 'Auto-submit OTP'),
    }),
  };
}

// ============================================================================
// FORM SET FACTORIES
// ============================================================================

/**
 * Creates a set of OTP configurations for a complete verification flow
 * @returns Array of InputOTP configurations for verification flow
 */
export function createFakeVerificationFlowOTPs(): FakeInputOTP[] {
  return [
    createFakeInputOTP({
      name: i18n.t('factory.inputOtp.step1EmailOtp', 'Step 1: Email OTP'),
      purpose: 'email-verification',
      verificationState: 'success',
      value: '123456',
    }),
    createFake2FAInputOTP({
      name: i18n.t('factory.inputOtp.step22faCode', 'Step 2: 2FA Code'),
      verificationState: 'idle',
      value: '',
    }),
    createFakePINInputOTP({
      name: i18n.t('factory.inputOtp.step3SetPin', 'Step 3: Set PIN'),
      verificationState: 'idle',
      value: '',
    }),
  ];
}

/**
 * Creates a set of OTP configurations for authentication scenarios
 * @returns Array of InputOTP configurations for auth scenarios
 */
export function createFakeAuthOTPs(): FakeInputOTP[] {
  return [
    createFake2FAInputOTP({ name: i18n.t('factory.inputOtp.login2fa', 'Login 2FA') }),
    createFakeEmailVerificationOTP({
      name: i18n.t('factory.inputOtp.emailVerification', 'Email Verification'),
    }),
    createFakePhoneVerificationOTP({
      name: i18n.t('factory.inputOtp.phoneVerification', 'Phone Verification'),
    }),
    createFakePasswordResetOTP({
      name: i18n.t('factory.inputOtp.passwordReset', 'Password Reset'),
    }),
  ];
}

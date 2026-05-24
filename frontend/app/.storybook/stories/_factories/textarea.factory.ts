/**
 * Textarea Component Factory
 *
 * Generates fake data for Textarea component stories and tests.
 * Supports various content types, validation states, and form contexts.
 *
 * @module textarea.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Textarea size variants
 */
export type TextareaSize = 'default' | 'large' | 'small';

/**
 * Textarea validation state
 */
export type TextareaValidationState = 'error' | 'none' | 'success' | 'warning';

/**
 * Textarea content type
 */
export type TextareaContentType =
  | 'address'
  | 'bio'
  | 'code'
  | 'comment'
  | 'description'
  | 'feedback'
  | 'message'
  | 'notes'
  | 'review';

/**
 * Textarea resize behavior
 */
export type TextareaResize = 'both' | 'horizontal' | 'none' | 'vertical';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All textarea sizes
 */
export const TEXTAREA_SIZES: TextareaSize[] = ['default', 'large', 'small'];

/**
 * All validation states
 */
export const TEXTAREA_VALIDATION_STATES: TextareaValidationState[] = [
  'error',
  'none',
  'success',
  'warning',
];

/**
 * All content types
 */
export const TEXTAREA_CONTENT_TYPES: TextareaContentType[] = [
  'address',
  'bio',
  'code',
  'comment',
  'description',
  'feedback',
  'message',
  'notes',
  'review',
];

/**
 * All resize behaviors
 */
export const TEXTAREA_RESIZE_OPTIONS: TextareaResize[] = ['both', 'horizontal', 'none', 'vertical'];

/**
 * Size to rows mapping
 */
export const TEXTAREA_SIZE_ROWS: Record<TextareaSize, number> = {
  default: 3,
  large: 6,
  small: 2,
};

/**
 * Placeholder text by content type
 */
export const TEXTAREA_PLACEHOLDERS: Record<TextareaContentType, string> = {
  address: i18n.t('factory.textarea.enterYourFullAddress', 'Enter your full address...'),
  bio: i18n.t('factory.textarea.tellUsAboutYourself', 'Tell us about yourself...'),
  code: '// Enter your code here...',
  comment: i18n.t('factory.textarea.addAComment', 'Add a comment...'),
  description: i18n.t('factory.textarea.enterADescription', 'Enter a description...'),
  feedback: i18n.t('factory.textarea.shareYourFeedback', 'Share your feedback...'),
  message: i18n.t('factory.textarea.writeYourMessage', 'Write your message...'),
  notes: i18n.t('factory.textarea.addNotes', 'Add notes...'),
  review: i18n.t('factory.textarea.writeYourReview', 'Write your review...'),
};

/**
 * Labels by content type
 */
export const TEXTAREA_LABELS: Record<TextareaContentType, string> = {
  address: i18n.t('factory.textarea.address', 'Address'),
  bio: i18n.t('factory.textarea.bio', 'Bio'),
  code: i18n.t('factory.textarea.code', 'Code'),
  comment: i18n.t('factory.textarea.comment', 'Comment'),
  description: i18n.t('factory.textarea.description', 'Description'),
  feedback: i18n.t('factory.textarea.feedback', 'Feedback'),
  message: i18n.t('factory.textarea.message', 'Message'),
  notes: i18n.t('factory.textarea.notes', 'Notes'),
  review: i18n.t('factory.textarea.review', 'Review'),
};

/**
 * Sample content by type
 */
export const TEXTAREA_SAMPLE_CONTENT: Record<TextareaContentType, () => string> = {
  address: () =>
    `${faker.location.streetAddress()}\n${faker.location.city()}, ${faker.location.state()} ${faker.location.zipCode()}`,
  bio: () => faker.lorem.paragraph(3),
  code: () =>
    `function hello() {\n  console.log(i18n.t('factory.textarea.helloWorld', 'Hello, World!'));\n  return true;\n}`,
  comment: () => faker.lorem.sentences(2),
  description: () => faker.lorem.paragraph(2),
  feedback: () => faker.lorem.paragraph(2),
  message: () => faker.lorem.paragraph(3),
  notes: () => faker.lorem.sentences(3),
  review: () => faker.lorem.paragraph(4),
};

/**
 * Error messages by validation context
 */
export const TEXTAREA_ERROR_MESSAGES = [
  i18n.t('factory.textarea.thisFieldIsRequired', 'This field is required'),
  i18n.t('factory.textarea.pleaseEnterAtLeast10', 'Please enter at least 10 characters'),
  i18n.t('factory.textarea.maximum500CharactersAllowed', 'Maximum 500 characters allowed'),
  i18n.t('factory.textarea.pleaseEnterAValidMessage', 'Please enter a valid message'),
  i18n.t(
    'factory.textarea.contentContainsInvalidCharacters',
    'Content contains invalid characters'
  ),
];

/**
 * Help text by content type
 */
export const TEXTAREA_HELP_TEXT: Record<TextareaContentType, string> = {
  address: i18n.t(
    'factory.textarea.includeStreetCityStateAnd',
    'Include street, city, state, and zip code'
  ),
  bio: i18n.t(
    'factory.textarea.tellOthersAboutYourselfIn',
    'Tell others about yourself in 2-3 sentences'
  ),
  code: i18n.t(
    'factory.textarea.useProperIndentationAndFormatting',
    'Use proper indentation and formatting'
  ),
  comment: i18n.t('factory.textarea.beRespectfulAndConstructive', 'Be respectful and constructive'),
  description: i18n.t(
    'factory.textarea.provideAClearAndDetailed',
    'Provide a clear and detailed description'
  ),
  feedback: i18n.t('factory.textarea.yourFeedbackHelpsUsImprove', 'Your feedback helps us improve'),
  message: i18n.t(
    'factory.textarea.yourMessageWillBeSent',
    'Your message will be sent to the recipient'
  ),
  notes: i18n.t(
    'factory.textarea.notesArePrivateAndOnly',
    'Notes are private and only visible to you'
  ),
  review: i18n.t('factory.textarea.shareYourHonestExperience', 'Share your honest experience'),
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base textarea configuration
 */
export interface FakeTextarea {
  ariaDescribedby?: string;
  ariaInvalid?: boolean;
  ariaLabel?: string;
  autoComplete?: string;
  className?: string;
  cols?: number;
  defaultValue?: string;
  disabled: boolean;
  id: string;
  maxLength?: number;
  minLength?: number;
  name: string;
  placeholder: string;
  readOnly: boolean;
  required: boolean;
  resize: TextareaResize;
  rows: number;
  spellCheck?: boolean;
  testId: string;
  value?: string;
  wrap?: 'hard' | 'off' | 'soft';
}

/**
 * Textarea with label
 */
export interface FakeTextareaWithLabel extends FakeTextarea {
  description?: string;
  label: string;
}

/**
 * Textarea form field
 */
export interface FakeTextareaFormField extends FakeTextareaWithLabel {
  errorMessage?: string;
  helpText?: string;
  validationState: TextareaValidationState;
}

/**
 * Textarea with content type
 */
export interface FakeTextareaWithContentType extends FakeTextareaFormField {
  contentType: TextareaContentType;
  sampleContent: string;
}

/**
 * Textarea with character count
 */
export interface FakeTextareaWithCharCount extends FakeTextarea {
  currentLength: number;
  maxLength: number;
  showCount: boolean;
  warningThreshold: number;
}

/**
 * Auto-resizing textarea
 */
export interface FakeAutoResizeTextarea extends FakeTextarea {
  maxRows: number;
  minRows: number;
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

/**
 * Create a basic fake textarea
 */
export function createFakeTextarea(overrides?: Partial<FakeTextarea>): FakeTextarea {
  const size = faker.helpers.arrayElement(TEXTAREA_SIZES);
  const disabled = faker.datatype.boolean({ probability: 0.1 });
  const required = faker.datatype.boolean({ probability: 0.3 });

  return {
    ariaDescribedby: faker.helpers.maybe(() => `desc-${faker.string.alphanumeric(6)}`, {
      probability: 0.3,
    }),
    ariaInvalid: faker.helpers.maybe(() => faker.datatype.boolean(), { probability: 0.2 }),
    ariaLabel: faker.helpers.maybe(
      () => i18n.t('factory.textarea.textInputField', 'Text input field'),
      { probability: 0.3 }
    ),
    autoComplete: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['off', 'on', 'street-address']),
      { probability: 0.2 }
    ),
    className: faker.helpers.maybe(() => 'w-full', { probability: 0.5 }),
    cols: faker.helpers.maybe(() => faker.number.int({ min: 20, max: 80 }), { probability: 0.2 }),
    defaultValue: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    disabled,
    id: `textarea-${faker.string.alphanumeric(8)}`,
    maxLength: faker.helpers.maybe(() => faker.number.int({ min: 100, max: 1000 }), {
      probability: 0.4,
    }),
    minLength: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 50 }), {
      probability: 0.3,
    }),
    name: faker.helpers.arrayElement(['message', 'description', 'notes', 'comment', 'feedback']),
    placeholder: faker.helpers.arrayElement(Object.values(TEXTAREA_PLACEHOLDERS)),
    readOnly: faker.datatype.boolean({ probability: 0.05 }),
    required,
    resize: faker.helpers.arrayElement(TEXTAREA_RESIZE_OPTIONS),
    rows: TEXTAREA_SIZE_ROWS[size],
    spellCheck: faker.helpers.maybe(() => faker.datatype.boolean(), { probability: 0.3 }),
    testId: `textarea-${faker.string.alphanumeric(8)}`,
    value: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.2 }),
    wrap: faker.helpers.maybe(
      () => faker.helpers.arrayElement<'hard' | 'off' | 'soft'>(['hard', 'off', 'soft']),
      {
        probability: 0.2,
      }
    ),
    ...overrides,
  };
}

/**
 * Create multiple fake textareas
 */
export function createFakeTextareas(
  count: number,
  overrides?: Partial<FakeTextarea>
): FakeTextarea[] {
  return Array.from({ length: count }, () => createFakeTextarea(overrides));
}

// ============================================================================
// LABELED TEXTAREA FACTORIES
// ============================================================================

/**
 * Create a textarea with label
 */
export function createFakeTextareaWithLabel(
  overrides?: Partial<FakeTextareaWithLabel>
): FakeTextareaWithLabel {
  const contentType = faker.helpers.arrayElement(TEXTAREA_CONTENT_TYPES);

  return {
    ...createFakeTextarea(overrides),
    description: faker.helpers.maybe(() => TEXTAREA_HELP_TEXT[contentType], { probability: 0.5 }),
    label: overrides?.label ?? TEXTAREA_LABELS[contentType],
    ...overrides,
  };
}

// ============================================================================
// FORM FIELD FACTORIES
// ============================================================================

/**
 * Create a textarea form field
 */
export function createFakeTextareaFormField(
  overrides?: Partial<FakeTextareaFormField>
): FakeTextareaFormField {
  const validationState = faker.helpers.arrayElement<TextareaValidationState>([
    'error',
    'none',
    'success',
    'warning',
  ]);

  return {
    ...createFakeTextareaWithLabel(overrides),
    errorMessage:
      validationState === 'error' ? faker.helpers.arrayElement(TEXTAREA_ERROR_MESSAGES) : undefined,
    helpText: faker.helpers.maybe(
      () => faker.helpers.arrayElement(Object.values(TEXTAREA_HELP_TEXT)),
      { probability: 0.6 }
    ),
    validationState,
    ...overrides,
  };
}

// ============================================================================
// CONTENT TYPE FACTORIES
// ============================================================================

/**
 * Create a textarea by content type
 */
export function createFakeTextareaByContentType(
  contentType: TextareaContentType,
  overrides?: Partial<FakeTextareaWithContentType>
): FakeTextareaWithContentType {
  return {
    ...createFakeTextareaFormField({
      label: TEXTAREA_LABELS[contentType],
      placeholder: TEXTAREA_PLACEHOLDERS[contentType],
      helpText: TEXTAREA_HELP_TEXT[contentType],
      name: contentType,
      ...overrides,
    }),
    contentType,
    sampleContent: TEXTAREA_SAMPLE_CONTENT[contentType](),
    ...overrides,
  };
}

/**
 * Create a message textarea
 */
export function createFakeMessageTextarea(
  overrides?: Partial<FakeTextareaWithContentType>
): FakeTextareaWithContentType {
  return createFakeTextareaByContentType('message', overrides);
}

/**
 * Create a comment textarea
 */
export function createFakeCommentTextarea(
  overrides?: Partial<FakeTextareaWithContentType>
): FakeTextareaWithContentType {
  return createFakeTextareaByContentType('comment', overrides);
}

/**
 * Create a description textarea
 */
export function createFakeDescriptionTextarea(
  overrides?: Partial<FakeTextareaWithContentType>
): FakeTextareaWithContentType {
  return createFakeTextareaByContentType('description', overrides);
}

/**
 * Create a bio textarea
 */
export function createFakeBioTextarea(
  overrides?: Partial<FakeTextareaWithContentType>
): FakeTextareaWithContentType {
  return createFakeTextareaByContentType('bio', overrides);
}

/**
 * Create a code textarea
 */
export function createFakeCodeTextarea(
  overrides?: Partial<FakeTextareaWithContentType>
): FakeTextareaWithContentType {
  return createFakeTextareaByContentType('code', {
    spellCheck: false,
    className: 'font-mono',
    ...overrides,
  });
}

/**
 * Create a review textarea
 */
export function createFakeReviewTextarea(
  overrides?: Partial<FakeTextareaWithContentType>
): FakeTextareaWithContentType {
  return createFakeTextareaByContentType('review', {
    rows: 5,
    minLength: 50,
    ...overrides,
  });
}

// ============================================================================
// CHARACTER COUNT FACTORIES
// ============================================================================

/**
 * Create a textarea with character count
 */
export function createFakeTextareaWithCharCount(
  overrides?: Partial<FakeTextareaWithCharCount>
): FakeTextareaWithCharCount {
  const maxLength = overrides?.maxLength ?? faker.number.int({ min: 100, max: 500 });
  const currentLength = faker.number.int({ min: 0, max: maxLength });
  const warningThreshold = Math.floor(maxLength * 0.8);

  return {
    ...createFakeTextarea({
      maxLength,
      value: faker.lorem.words(Math.floor(currentLength / 5)).slice(0, Math.max(0, currentLength)),
      ...overrides,
    }),
    currentLength,
    maxLength,
    showCount: true,
    warningThreshold,
    ...overrides,
  };
}

// ============================================================================
// AUTO-RESIZE FACTORIES
// ============================================================================

/**
 * Create an auto-resizing textarea
 */
export function createFakeAutoResizeTextarea(
  overrides?: Partial<FakeAutoResizeTextarea>
): FakeAutoResizeTextarea {
  const minRows = overrides?.minRows ?? faker.number.int({ min: 2, max: 3 });
  const maxRows = overrides?.maxRows ?? faker.number.int({ min: minRows + 2, max: 10 });

  return {
    ...createFakeTextarea({ rows: minRows, ...overrides }),
    maxRows,
    minRows,
    ...overrides,
  };
}

// ============================================================================
// STATE-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a disabled textarea
 */
export function createFakeDisabledTextarea(overrides?: Partial<FakeTextarea>): FakeTextarea {
  return createFakeTextarea({
    disabled: true,
    value: faker.lorem.paragraph(),
    ...overrides,
  });
}

/**
 * Create a read-only textarea
 */
export function createFakeReadOnlyTextarea(overrides?: Partial<FakeTextarea>): FakeTextarea {
  return createFakeTextarea({
    readOnly: true,
    value: faker.lorem.paragraph(),
    ...overrides,
  });
}

/**
 * Create an error state textarea
 */
export function createFakeErrorTextarea(
  overrides?: Partial<FakeTextareaFormField>
): FakeTextareaFormField {
  return createFakeTextareaFormField({
    validationState: 'error',
    ariaInvalid: true,
    errorMessage: faker.helpers.arrayElement(TEXTAREA_ERROR_MESSAGES),
    ...overrides,
  });
}

/**
 * Create a required textarea
 */
export function createFakeRequiredTextarea(overrides?: Partial<FakeTextarea>): FakeTextarea {
  return createFakeTextarea({
    required: true,
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create a matrix of textareas by size
 */
export function createTextareaSizeMatrix(): {
  rows: number;
  size: TextareaSize;
  textarea: FakeTextarea;
}[] {
  return TEXTAREA_SIZES.map((size) => ({
    rows: TEXTAREA_SIZE_ROWS[size],
    size,
    textarea: createFakeTextarea({ rows: TEXTAREA_SIZE_ROWS[size] }),
  }));
}

/**
 * Create a matrix of textareas by validation state
 */
export function createTextareaValidationMatrix(): {
  state: TextareaValidationState;
  textarea: FakeTextareaFormField;
}[] {
  return TEXTAREA_VALIDATION_STATES.map((state) => ({
    state,
    textarea: createFakeTextareaFormField({ validationState: state }),
  }));
}

/**
 * Create a matrix of textareas by content type
 */
export function createTextareaContentTypeMatrix(): {
  contentType: TextareaContentType;
  textarea: FakeTextareaWithContentType;
}[] {
  return TEXTAREA_CONTENT_TYPES.map((contentType) => ({
    contentType,
    textarea: createFakeTextareaByContentType(contentType),
  }));
}

/**
 * Create a matrix of textareas by resize behavior
 */
export function createTextareaResizeMatrix(): {
  resize: TextareaResize;
  textarea: FakeTextarea;
}[] {
  return TEXTAREA_RESIZE_OPTIONS.map((resize) => ({
    resize,
    textarea: createFakeTextarea({ resize }),
  }));
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive textarea test data
 */
export function createTextareaTestData(): {
  autoResize: FakeAutoResizeTextarea;
  basic: FakeTextarea;
  bio: FakeTextareaWithContentType;
  code: FakeTextareaWithContentType;
  comment: FakeTextareaWithContentType;
  description: FakeTextareaWithContentType;
  disabled: FakeTextarea;
  error: FakeTextareaFormField;
  formField: FakeTextareaFormField;
  large: FakeTextarea;
  message: FakeTextareaWithContentType;
  readOnly: FakeTextarea;
  required: FakeTextarea;
  review: FakeTextareaWithContentType;
  small: FakeTextarea;
  withCharCount: FakeTextareaWithCharCount;
  withLabel: FakeTextareaWithLabel;
} {
  return {
    autoResize: createFakeAutoResizeTextarea(),
    basic: createFakeTextarea(),
    bio: createFakeBioTextarea(),
    code: createFakeCodeTextarea(),
    comment: createFakeCommentTextarea(),
    description: createFakeDescriptionTextarea(),
    disabled: createFakeDisabledTextarea(),
    error: createFakeErrorTextarea(),
    formField: createFakeTextareaFormField(),
    large: createFakeTextarea({ rows: 6 }),
    message: createFakeMessageTextarea(),
    readOnly: createFakeReadOnlyTextarea(),
    required: createFakeRequiredTextarea(),
    review: createFakeReviewTextarea(),
    small: createFakeTextarea({ rows: 2 }),
    withCharCount: createFakeTextareaWithCharCount(),
    withLabel: createFakeTextareaWithLabel(),
  };
}

/**
 * Create a showcase of all textarea variants
 */
export function createTextareaShowcase(): {
  contentTypeMatrix: ReturnType<typeof createTextareaContentTypeMatrix>;
  resizeMatrix: ReturnType<typeof createTextareaResizeMatrix>;
  sizeMatrix: ReturnType<typeof createTextareaSizeMatrix>;
  testData: ReturnType<typeof createTextareaTestData>;
  validationMatrix: ReturnType<typeof createTextareaValidationMatrix>;
} {
  return {
    contentTypeMatrix: createTextareaContentTypeMatrix(),
    resizeMatrix: createTextareaResizeMatrix(),
    sizeMatrix: createTextareaSizeMatrix(),
    testData: createTextareaTestData(),
    validationMatrix: createTextareaValidationMatrix(),
  };
}

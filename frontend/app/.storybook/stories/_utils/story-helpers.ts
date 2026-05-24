import i18n from 'i18next';
import { expect, fn, within } from 'storybook/test';

import type { StoryObj } from '@storybook/react';

/**
 * Shared error message for play tests that verify DOM rendering
 */
export const STORY_NO_DOM_ERROR = i18n.t(
  'test.storyRenderedNoDomNodes',
  'Story rendered no DOM nodes.'
);

/**
 * Shared error: expected form element to be present
 */
export const STORY_FORM_NOT_FOUND = i18n.t(
  'test.expectedFormElementToBePresent',
  'Expected form element to be present.'
);

/**
 * Shared error: expected email input to be present
 */
export const STORY_EMAIL_INPUT_NOT_FOUND = i18n.t(
  'test.expectedEmailInputToBePresent',
  'Expected email input to be present.'
);

/**
 * Shared error: input label element was not found
 */
export const STORY_INPUT_LABEL_NOT_FOUND = i18n.t(
  'test.inputLabelElementWasNotFound',
  'Input label element was not found.'
);

/**
 * Shared error: input element was not found
 */
export const STORY_INPUT_NOT_FOUND = i18n.t(
  'test.inputElementWasNotFound',
  'Input element was not found.'
);

/**
 * Shared error: sonner toaster root was not found
 */
export const STORY_SONNER_TOASTER_NOT_FOUND = i18n.t(
  'test.sonnerToasterRootWasNotFound',
  'Sonner toaster root was not found.'
);

/**
 * Creates standard event handler args with fn() for action logging
 */
export function createEventArgs() {
  return {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onChange: fn(),
    onInput: fn(),
    onSubmit: fn(),
    onReset: fn(),
    onSelect: fn(),
    onScroll: fn(),
  };
}

/**
 * Creates standard event argTypes with categories
 */
export function createEventArgTypes() {
  return {
    onClick: {
      action: 'onClick',
      description: i18n.t('storyHelpers.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('storyHelpers.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('storyHelpers.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('storyHelpers.argType.keydownEventHandler', 'Keydown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('storyHelpers.argType.keyupEventHandler', 'Keyup event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('storyHelpers.argType.mouseEnterHandler', 'Mouse enter handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('storyHelpers.argType.mouseLeaveHandler', 'Mouse leave handler'),
      table: { category: 'Events' },
    },
    onChange: {
      action: 'onChange',
      description: i18n.t('storyHelpers.argType.changeEventHandler', 'Change event handler'),
      table: { category: 'Events' },
    },
    onInput: {
      action: 'onInput',
      description: i18n.t('storyHelpers.argType.inputEventHandler', 'Input event handler'),
      table: { category: 'Events' },
    },
    onSubmit: {
      action: 'onSubmit',
      description: i18n.t('storyHelpers.argType.submitEventHandler', 'Submit event handler'),
      table: { category: 'Events' },
    },
    onReset: {
      action: 'onReset',
      description: i18n.t('storyHelpers.argType.resetEventHandler', 'Reset event handler'),
      table: { category: 'Events' },
    },
    onSelect: {
      action: 'onSelect',
      description: i18n.t('storyHelpers.argType.selectEventHandler', 'Select event handler'),
      table: { category: 'Events' },
    },
    onScroll: {
      action: 'onScroll',
      description: i18n.t('storyHelpers.argType.scrollEventHandler', 'Scroll event handler'),
      table: { category: 'Events' },
    },
  };
}

/**
 * Creates HTTP error story configurations from status handlers
 */
export function createHttpErrorStories<T>(
  statusHandlers: Record<string, unknown[]>,
  baseStory: StoryObj<T>
): Record<string, StoryObj<T>> {
  const errorStories: Record<string, StoryObj<T>> = {};

  const httpErrors = [
    { name: 'HTTP400BadRequest', key: 'badRequest' },
    { name: 'HTTP401Unauthorized', key: 'unauthorized' },
    { name: 'HTTP403Forbidden', key: 'forbidden' },
    { name: 'HTTP429TooManyRequests', key: 'tooManyRequests' },
    { name: 'HTTP500InternalServerError', key: 'internalServerError' },
    { name: 'HTTP502BadGateway', key: 'badGateway' },
    { name: 'HTTP503ServiceUnavailable', key: 'serviceUnavailable' },
    { name: 'HTTP504GatewayTimeout', key: 'gatewayTimeout' },
  ];

  for (const { name, key } of httpErrors) {
    if (statusHandlers[key]) {
      errorStories[name] = {
        ...baseStory,
        parameters: {
          ...baseStory.parameters,
          msw: { handlers: statusHandlers[key] },
        },
      };
    }
  }

  return errorStories;
}

/**
 * Creates special state story configurations
 */
export function createSpecialStateStories<T>(
  statusHandlers: Record<string, unknown[]>,
  baseStory: StoryObj<T>
): Record<string, StoryObj<T>> {
  return {
    Loading: {
      ...baseStory,
      parameters: { ...baseStory.parameters, msw: { handlers: statusHandlers.loading } },
    },
    SlowResponse: {
      ...baseStory,
      parameters: { ...baseStory.parameters, msw: { handlers: statusHandlers.slowResponse } },
    },
    NetworkError: {
      ...baseStory,
      parameters: { ...baseStory.parameters, msw: { handlers: statusHandlers.networkError } },
    },
    EmptyData: {
      ...baseStory,
      parameters: { ...baseStory.parameters, msw: { handlers: statusHandlers.emptyData } },
    },
  };
}

/**
 * Creates state-based argTypes (disabled, loading, readonly, etc.)
 */
export function createStateArgTypes() {
  return {
    disabled: {
      control: 'boolean',
      description: i18n.t('storyHelpers.argType.disablesTheComponent', 'Disables the component'),
      table: { category: 'State' },
    },
    loading: {
      control: 'boolean',
      description: i18n.t('storyHelpers.argType.showsLoadingState', 'Shows loading state'),
      table: { category: 'State' },
    },
    readonly: {
      control: 'boolean',
      description: i18n.t(
        'storyHelpers.argType.makesTheComponentReadonly',
        'Makes the component read-only'
      ),
      table: { category: 'State' },
    },
    required: {
      control: 'boolean',
      description: i18n.t(
        'storyHelpers.argType.marksTheFieldAsRequired',
        'Marks the field as required'
      ),
      table: { category: 'State' },
    },
    error: {
      control: 'boolean',
      description: i18n.t('storyHelpers.argType.showsErrorState', 'Shows error state'),
      table: { category: 'State' },
    },
  };
}

/**
 * Creates variant argTypes for a component
 */
export function createVariantArgTypes<T extends string>(
  variants: readonly T[],
  defaultValue: T = variants[0]
) {
  return {
    variant: {
      control: 'select',
      options: variants,
      description: i18n.t(
        'storyHelpers.argType.visualVariantOfTheComponent',
        'Visual variant of the component'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: defaultValue },
      },
    },
  };
}

/**
 * Creates size argTypes for a component
 */
export function createSizeArgTypes<T extends string>(
  sizes: readonly T[],
  defaultValue: T = sizes[0]
) {
  return {
    size: {
      control: 'select',
      options: sizes,
      description: i18n.t('storyHelpers.argType.sizeOfTheComponent', 'Size of the component'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: defaultValue },
      },
    },
  };
}

/**
 * Gets an element by data-testid within canvas
 */
export function getByTestId(canvasElement: HTMLElement, testId: string) {
  const canvas = within(canvasElement);
  return canvas.getByTestId(testId);
}

/**
 * Queries an element by data-testid (returns null if not found)
 */
export function queryByTestId(canvasElement: HTMLElement, testId: string) {
  const canvas = within(canvasElement);
  return canvas.queryByTestId(testId);
}

/**
 * Waits for an element with data-testid to appear
 */
export async function waitForTestId(canvasElement: HTMLElement, testId: string) {
  const canvas = within(canvasElement);
  return canvas.findByTestId(testId);
}

/**
 * Asserts element is disabled
 */
export async function expectDisabled(element: HTMLElement) {
  await expect(element).toBeDisabled();
}

/**
 * Asserts element is enabled (not disabled)
 */
export async function expectEnabled(element: HTMLElement) {
  await expect(element).toBeEnabled();
}

/**
 * Asserts element is visible in the document
 */
export async function expectVisible(element: HTMLElement) {
  await expect(element).toBeVisible();
}

/**
 * Asserts element has specific text content
 */
export async function expectTextContent(element: HTMLElement, text: string) {
  await expect(element).toHaveTextContent(text);
}

/**
 * Asserts element has specific attribute
 */
export async function expectAttribute(element: HTMLElement, attr: string, value?: string) {
  if (value !== undefined) {
    await expect(element).toHaveAttribute(attr, value);
  } else {
    await expect(element).toHaveAttribute(attr);
  }
}

/**
 * Creates MSW handler configuration object for stories
 */
export function createMswHandlers(handlers: unknown[]) {
  return {
    msw: { handlers },
  };
}

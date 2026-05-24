import type { Meta, StoryObj } from '@storybook/react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { notifications } from '@/components/layout/header/data';
import { useTranslation } from 'react-i18next';

import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import {
  createFakeNotifications,
  createFakeUnreadNotification,
} from '@/.storybook/stories/_factories/data.factory';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import i18n from 'i18next';

seedFaker();

// ============ DEMO COMPONENTS ============

function HeaderDataDemo() {
  const { t } = useTranslation();
  const heading = t('headerData.notificationsHeading', { total: notifications.length });
  const ariaLabel = t('headerData.notificationsJsonAriaLabel');

  return (
    <div className="w-full max-w-2xl space-y-3">
      <div
        className="text-sm font-medium"
        data-testid="header-data-heading"
        data-total={notifications.length}
      >
        {heading}
      </div>
      <pre
        aria-label={ariaLabel}
        className="bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs"
        data-testid="header-data-json"
      >
        {JSON.stringify(notifications, null, 2)}
      </pre>
    </div>
  );
}

const meta = {
  title: 'Components/Layout/Header/Data',
  component: HeaderDataDemo,
  tags: ['autodocs'],
  args: {
    // Event handlers with fn() for Actions panel logging
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('data.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('data.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('data.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('data.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('data.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('data.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('data.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // Header Data Reference:
    // Static Data Exports:
    // - notifications: Array of notification objects
    //
    // Notification Object Structure:
    // - id: number - Unique identifier
    // - title: string - Notification title
    // - description: string - Notification content
    // - avatar: string - User avatar URL
    // - name: string - User name
    // - time: string - Relative time string
    // - type: 'default' | 'confirm' - Notification type
    // - unread_message: number | undefined - Unread count indicator
    //
    // Notification Types:
    // - default: Standard notification with avatar and content
    // - confirm: Notification with accept/decline action buttons
    //
    // Usage Notes:
    // - Data is used by Notifications component
    // - 10 sample notifications provided
    // - Mix of default and confirm types for demo
    // - Includes unread indicators for some items
    //
    // Data Attributes:
    // - data-testid="header-data-heading": Heading element
    // - data-testid="header-data-json": JSON preview element
    // - data-total: Number of notifications
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof HeaderDataDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ DEFAULT STORIES ============

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const heading = canvas.getByTestId('header-data-heading');
    expect(heading.getAttribute('data-total')).toBe(String(notifications.length));

    const pre = canvas.getByTestId('header-data-json');

    expect(pre.textContent).toContain('"id": 1');
    expect(pre.textContent).toContain('"id": 10');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Variants: Story = {
  render: () => {
    const textNotifications = notifications.filter((n) => n.type === 'text');
    const confirmNotifications = notifications.filter((n) => n.type === 'confirm');
    const unreadNotifications = notifications.filter((n) => n.unread_message);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-muted-foreground mb-2 text-sm">
            Text Type Notifications ({textNotifications.length})
          </p>
          <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">
            {JSON.stringify(textNotifications, null, 2)}
          </pre>
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-sm">
            Confirm Type Notifications ({confirmNotifications.length})
          </p>
          <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">
            {JSON.stringify(confirmNotifications, null, 2)}
          </pre>
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-sm">
            Unread Notifications ({unreadNotifications.length})
          </p>
          <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">
            {JSON.stringify(unreadNotifications, null, 2)}
          </pre>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText(/Text Type Notifications/i)).toBeInTheDocument();
    expect(canvas.getByText(/Confirm Type Notifications/i)).toBeInTheDocument();
    expect(canvas.getByText(/Unread Notifications/i)).toBeInTheDocument();

    const preElements = canvasElement.querySelectorAll('pre');
    expect(preElements.length).toBe(3);
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('data.story.compactViewMaxwsm', 'Compact View (max-w-sm)')}
        </p>
        <div className="max-w-sm">
          <pre className="bg-muted max-h-32 overflow-auto rounded-md p-2 text-xs">
            {JSON.stringify(notifications.slice(0, 3), null, 2)}
          </pre>
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('data.story.mediumViewMaxwlg', 'Medium View (max-w-lg)')}
        </p>
        <div className="max-w-lg">
          <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">
            {JSON.stringify(notifications.slice(0, 5), null, 2)}
          </pre>
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Full View (max-w-2xl)</p>
        <div className="max-w-2xl">
          <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
            {JSON.stringify(notifications, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText(/Compact View/i)).toBeInTheDocument();
    expect(canvas.getByText(/Medium View/i)).toBeInTheDocument();
    expect(canvas.getByText(/Full View/i)).toBeInTheDocument();

    const preElements = canvasElement.querySelectorAll('pre');
    expect(preElements.length).toBe(3);
  },
};

// ============ THEME AND LOCALE STORIES ============

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('data.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(doc.documentElement.lang).toBe('ja');
    });

    expect(canvas.getByTestId('header-data-heading')).toBeInTheDocument();
    expect(canvas.getByTestId('header-data-json')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('data.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('data.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('data.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('data.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('data.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('data.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Test that heading has proper data attributes
    const heading = canvas.getByTestId('header-data-heading');
    expect(heading).toBeInTheDocument();
    expect(heading.getAttribute('data-total')).toBe(String(notifications.length));

    // Test that JSON pre element has aria-label for screen readers
    const jsonPre = canvas.getByTestId('header-data-json');
    expect(jsonPre).toBeInTheDocument();
    expect(jsonPre).toHaveAttribute('aria-label');
    expect(jsonPre.getAttribute('aria-label')?.trim()).not.toBe('');

    // Test keyboard navigation - Tab should work
    await userEvent.tab();

    // Verify content is accessible
    expect(jsonPre.textContent).toContain('"id"');
  },
};

// ============ FACTORY DATA STORIES ============

function FakerHeaderDataDemo() {
  const fakerNotifications = createFakeNotifications(5);
  const unread = createFakeUnreadNotification();
  const allItems = [unread, ...fakerNotifications];

  return (
    <div className="w-full max-w-2xl space-y-3">
      <div className="text-sm font-medium" data-testid="faker-heading">
        {i18n.t('headerData.notificationsHeading', { total: allItems.length })}
      </div>
      <pre
        className="bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs"
        data-testid="faker-json"
      >
        {JSON.stringify(allItems, null, 2)}
      </pre>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <FakerHeaderDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const heading = canvas.getByTestId('faker-heading');
    expect(heading).toBeInTheDocument();

    const json = canvas.getByTestId('faker-json');
    expect(json.textContent).toContain('"title"');
    expect(json.textContent).toContain('"status"');
  },
};

import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import type {
  EmptyActionType,
  EmptyMediaVariant,
  EmptyStateIcon,
  EmptyStateType,
  FakeComingSoonEmptyState,
  FakeEmptyAction,
  FakeEmptyState,
  FakeErrorEmptyState,
  FakeFeatureEmptyState,
  FakeNoDataEmptyState,
  FakeNoPermissionsEmptyState,
  FakeNoResultsEmptyState,
  FakeOfflineEmptyState,
  FakeOnboardingEmptyState,
} from '@/.storybook/stories/_factories/empty.factory';
import {
  createFakeCalendarEmptyState,
  createFakeCartEmptyState,
  createFakeComingSoonEmptyState,
  createFakeEmptyAction,
  createFakeEmptyState,
  createFakeEmptyStateMatrix,
  createFakeEmptyStates,
  createFakeEmptyStateShowcase,
  createFakeErrorEmptyState,
  createFakeFavoritesEmptyState,
  createFakeFeatureEmptyState,
  createFakeInboxEmptyState,
  createFakeNoDataEmptyState,
  createFakeNoPermissionsEmptyState,
  createFakeNoResultsEmptyState,
  createFakeNotificationsEmptyState,
  createFakeOfflineEmptyState,
  createFakeOnboardingEmptyState,
  EMPTY_MEDIA_VARIANTS,
  EMPTY_STATE_ICONS,
  EMPTY_STATE_TYPES,
  ENTITY_NAMES,
  ICONS_BY_STATE_TYPE,
  TITLES_BY_STATE_TYPE,
} from '@/.storybook/stories/_factories/empty.factory';
import { emptyHandlers, emptyStatusHandlers } from '@/.storybook/stories/_handlers/empty.handlers';

import {
  AlertTriangleIcon,
  BellIcon,
  CalendarIcon,
  FileX2Icon,
  HeartIcon,
  InboxIcon,
  LockIcon,
  RocketIcon,
  SearchXIcon,
  ShoppingCartIcon,
  WifiOffIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function EmptyDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-xl" data-testid="empty-demo">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>{t('empty.title')}</EmptyTitle>
          <EmptyDescription>{t('empty.description')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>{t('empty.action.create')}</Button>
          <Button variant="outline">{t('empty.action.learnMore')}</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Empty',
  component: EmptyDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // ═══════════════════════════════════════════════════════════════
    // CONTENT
    // ═══════════════════════════════════════════════════════════════
    children: {
      control: false,
      description: i18n.t(
        'empty.argType.emptyStateContentHeaderMediaTitleDescriptionActions',
        'Empty state content (header, media, title, description, actions)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    title: {
      control: 'text',
      description: i18n.t(
        'empty.argType.mainTitleTextForTheEmptyState',
        'Main title text for the empty state'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    description: {
      control: 'text',
      description: i18n.t(
        'empty.argType.descriptionTextExplainingTheEmptyState',
        'Description text explaining the empty state'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // APPEARANCE
    // ═══════════════════════════════════════════════════════════════
    variant: {
      control: 'select',
      options: ['default', 'icon'],
      description: i18n.t(
        'empty.argType.mediaVariantStyleIconOrDefault',
        'Media variant style (icon or default)'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: { summary: "'default' | 'icon'" },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('empty.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    type: {
      control: 'select',
      options: [
        'no-data',
        'no-results',
        'error',
        'onboarding',
        'feature',
        'offline',
        'no-permissions',
        'coming-soon',
      ],
      description: i18n.t('empty.argType.typeOfEmptyStateScenario', 'Type of empty state scenario'),
      table: {
        category: 'State',
        defaultValue: { summary: 'no-data' },
        type: {
          summary:
            "'no-data' | 'no-results' | 'error' | 'onboarding' | 'feature' | 'offline' | 'no-permissions' | 'coming-soon'",
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // LAYOUT
    // ═══════════════════════════════════════════════════════════════
    size: {
      control: 'select',
      options: ['compact', 'default', 'spacious'],
      description: i18n.t(
        'empty.argType.sizeVariantAffectingSpacingAndTextSize',
        'Size variant affecting spacing and text size'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'default' },
        type: { summary: "'compact' | 'default' | 'spacious'" },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════
    onClick: {
      action: 'onClick',
      description: i18n.t('empty.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('empty.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('empty.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('empty.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('empty.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('empty.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('empty.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onActionClick: {
      action: 'onActionClick',
      description: i18n.t(
        'empty.argType.calledWhenAnActionButtonIsClicked',
        'Called when an action button is clicked'
      ),
      table: { category: 'Events' },
    },
    // Empty Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Empty state content (ReactNode)
    //
    // EmptyHeader Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Header content including media, title, description (ReactNode)
    //
    // EmptyMedia Props Reference:
    // - variant: Media type ('icon' | 'image' | 'illustration')
    // - className: Additional CSS classes (string)
    // - children: Media content, typically an icon or image (ReactNode)
    //
    // EmptyTitle Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Title text content (ReactNode)
    //
    // EmptyDescription Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Description text content (ReactNode)
    //
    // EmptyContent Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Action content, typically buttons (ReactNode)
    //
    // Usage Notes:
    // - Use for zero-state UI when there's no data to display
    // - Include actionable buttons to help users populate the empty state
    // - EmptyMedia supports icons, images, or custom illustrations
  },
  parameters: {
    msw: { handlers: emptyHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof EmptyDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const title = canvasElement.querySelector('[data-slot="empty-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Expected empty title element to be present.');
    }
    expect(title.textContent?.trim()).not.toBe('');

    const description = canvasElement.querySelector('[data-slot="empty-description"]');
    if (!(description instanceof HTMLElement)) {
      throw new Error('Expected empty description element to be present.');
    }
    expect(description.textContent?.trim()).not.toBe('');

    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty-header"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty-title"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty-description"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty-icon"]')).toBeInTheDocument();

    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(2);

    const primaryAction = buttons[0];
    await userEvent.click(primaryAction);
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('empty-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getAllByRole('button').length).toBe(2);
  },
};

function EmptyVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('empty.variants.noData')}</p>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>{i18n.t('empty.story.noMessagesYet', 'No messages yet')}</EmptyTitle>
            <EmptyDescription>
              {i18n.t(
                'empty.story.whenYouReceiveMessagesTheyWillAppearHere',
                'When you receive messages, they will appear here.'
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>{i18n.t('empty.story.composeMessage', 'Compose Message')}</Button>
          </EmptyContent>
        </Empty>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('empty.variants.noResults')}</p>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{i18n.t('empty.story.noResultsFound', 'No results found')}</EmptyTitle>
            <EmptyDescription>
              Try adjusting your search or filter to find what you are looking for.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline">{i18n.t('empty.story.clearFilters', 'Clear Filters')}</Button>
          </EmptyContent>
        </Empty>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('empty.variants.error')}</p>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangleIcon className="text-destructive" />
            </EmptyMedia>
            <EmptyTitle>
              {i18n.t('empty.story.somethingWentWrong', 'Something went wrong')}
            </EmptyTitle>
            <EmptyDescription>
              We could not load your data. Please try again later.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>{i18n.t('empty.story.retry', 'Retry')}</Button>
            <Button variant="outline">
              {i18n.t('empty.story.contactSupport', 'Contact Support')}
            </Button>
          </EmptyContent>
        </Empty>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('empty.variants.onboarding')}</p>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RocketIcon />
            </EmptyMedia>
            <EmptyTitle>
              {i18n.t('empty.story.welcomeToYourDashboard', 'Welcome to your dashboard')}
            </EmptyTitle>
            <EmptyDescription>
              {i18n.t(
                'empty.story.getStartedByCreatingYourFirstProject',
                'Get started by creating your first project.'
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>{i18n.t('empty.story.createProject', 'Create Project')}</Button>
            <Button variant="outline">{i18n.t('empty.story.takeATour', 'Take a Tour')}</Button>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <EmptyVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all empty state sections exist
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty"]');
    expect(emptyStates.length).toBe(4);

    // Verify each variant has required slots
    for (const emptyState of emptyStates) {
      expect(emptyState.querySelector('[data-slot="empty-header"]')).toBeInTheDocument();
      expect(emptyState.querySelector('[data-slot="empty-title"]')).toBeInTheDocument();
      expect(emptyState.querySelector('[data-slot="empty-description"]')).toBeInTheDocument();
      expect(emptyState.querySelector('[data-slot="empty-icon"]')).toBeInTheDocument();
    }

    // Verify specific text content for each variant
    expect(canvas.getByText('No messages yet')).toBeInTheDocument();
    expect(canvas.getByText('No results found')).toBeInTheDocument();
    expect(canvas.getByText('Something went wrong')).toBeInTheDocument();
    expect(canvas.getByText('Welcome to your dashboard')).toBeInTheDocument();
  },
};

function EmptySizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('empty.sizes.compact')}</p>
        <Empty className="border py-4">
          <EmptyHeader className="gap-1">
            <EmptyMedia variant="icon" className="[&_svg]:size-6">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle className="text-sm">{t('empty.story.noItems', 'No items')}</EmptyTitle>
            <EmptyDescription className="text-xs">
              {t('empty.story.addItemsToGetStarted', 'Add items to get started.')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('empty.sizes.default')}</p>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>{t('empty.story.noMessages', 'No messages')}</EmptyTitle>
            <EmptyDescription>
              {t('empty.story.newMessagesWillAppearHere', 'New messages will appear here.')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>{t('empty.story.compose', 'Compose')}</Button>
          </EmptyContent>
        </Empty>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('empty.sizes.fullPage')}</p>
        <Empty className="min-h-[400px] border">
          <EmptyHeader className="gap-4">
            <EmptyMedia variant="icon" className="[&_svg]:size-16">
              <FileX2Icon />
            </EmptyMedia>
            <EmptyTitle className="text-2xl">
              {t('empty.story.noDocumentsFound', 'No documents found')}
            </EmptyTitle>
            <EmptyDescription className="max-w-md text-base">
              You have not created any documents yet. Start by creating your first document to
              organize your work.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="gap-3">
            <Button size="lg">{t('empty.story.createDocument', 'Create Document')}</Button>
            <Button variant="outline" size="lg">
              Import Files
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <EmptySizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all empty state sections exist (3 sizes)
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty"]');
    expect(emptyStates.length).toBe(3);

    // Verify data-slot attributes exist for each size
    for (const emptyState of emptyStates) {
      expect(emptyState.querySelector('[data-slot="empty-header"]')).toBeInTheDocument();
      expect(emptyState.querySelector('[data-slot="empty-title"]')).toBeInTheDocument();
      expect(emptyState.querySelector('[data-slot="empty-icon"]')).toBeInTheDocument();
    }

    // Verify specific text content for sizes
    expect(canvas.getByText('No items')).toBeInTheDocument();
    expect(canvas.getByText('No messages')).toBeInTheDocument();
    expect(canvas.getByText('No documents found')).toBeInTheDocument();

    // Verify buttons exist in appropriate sizes
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('empty-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty-title"]')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('empty-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getAllByRole('button').length).toBe(2);
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);
    expect(canvas.getByText('メッセージはありません')).toBeInTheDocument();
    expect(canvas.getByText('受信した新しいメッセージはここに表示されます。')).toBeInTheDocument();
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
  name: i18n.t('empty.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  render: () => (
    <Empty role="region" aria-label={i18n.t('empty.story.emptyState', 'Empty state')}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{i18n.t('empty.story.noMessages', 'No messages')}</EmptyTitle>
        <EmptyDescription>
          New messages will appear here. Check back later or compose a new message.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>{i18n.t('empty.story.composeMessage', 'Compose Message')}</Button>
        <Button variant="outline">{i18n.t('empty.story.refresh', 'Refresh')}</Button>
      </EmptyContent>
    </Empty>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Find the empty region
    const emptyRegion = canvas.getByRole('region');
    expect(emptyRegion).toBeInTheDocument();
    expect(emptyRegion.getAttribute('aria-label')).toBe('Empty state');

    // Find the title
    const title = canvas.getByText('No messages');
    expect(title).toBeInTheDocument();

    // Find the description
    const description = canvas.getByText(/New messages will appear here/);
    expect(description).toBeInTheDocument();

    // Find buttons and test keyboard navigation
    const composeButton = canvas.getByRole('button', { name: 'Compose Message' });
    const refreshButton = canvas.getByRole('button', { name: 'Refresh' });
    expect(composeButton).toBeInTheDocument();
    expect(refreshButton).toBeInTheDocument();

    // Test keyboard navigation
    await userEvent.tab();
    expect(doc.activeElement).toBe(composeButton);

    await userEvent.tab();
    expect(doc.activeElement).toBe(refreshButton);

    // Test keyboard activation
    await userEvent.keyboard('{Enter}');
  },
};

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const items = createFakeEmptyStates(3);
    return (
      <div className="space-y-8">
        {items.map((item) => (
          <Empty key={item.id}>
            <EmptyMedia>
              <InboxIcon className="size-10" />
            </EmptyMedia>
            <EmptyContent>
              <EmptyHeader>
                <EmptyTitle>{item.title}</EmptyTitle>
              </EmptyHeader>
              <EmptyDescription>{item.description}</EmptyDescription>
            </EmptyContent>
          </Empty>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('[data-slot="empty"]');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: emptyHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: emptyStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: emptyStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: emptyStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: emptyStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: emptyStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: emptyStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: emptyStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FACTORY: SINGLE ITEM FACTORIES ============

function FactoryActionDemo() {
  const { t } = useTranslation();
  const primaryAction: FakeEmptyAction = createFakeEmptyAction({ type: 'primary' });
  const secondaryAction: FakeEmptyAction = createFakeEmptyAction({ type: 'secondary' });
  const linkAction: FakeEmptyAction = createFakeEmptyAction({ type: 'link' });
  const actionTypes: EmptyActionType[] = ['primary', 'secondary', 'link'];

  return (
    <div className="space-y-4" data-testid="factory-action-demo">
      <h3 className="text-lg font-semibold">{t('empty.factory.actions')}</h3>
      {[primaryAction, secondaryAction, linkAction].map((action, idx) => (
        <div key={action.id} className="rounded border p-4">
          <p className="text-sm font-medium">
            {t('empty.factory.action')}: {actionTypes[idx]}
          </p>
          <Empty className="mt-2 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>{action.label}</EmptyTitle>
              <EmptyDescription>
                {action.disabled
                  ? i18n.t('empty.story.disabled', 'Disabled')
                  : i18n.t('empty.story.enabled', 'Enabled')}{' '}
                &middot; {action.type}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant={action.type === 'primary' ? 'default' : 'outline'}
                disabled={action.disabled ?? false}
              >
                {action.label}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ))}
    </div>
  );
}

export const FactoryAction: Story = {
  render: () => <FactoryActionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-action-demo')).toBeInTheDocument();
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty"]');
    expect(emptyStates.length).toBe(3);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(3);
  },
};

function FactoryEmptyStateDemo() {
  const state: FakeEmptyState = createFakeEmptyState({ type: 'no-data' });

  return (
    <div className="space-y-4" data-testid="factory-empty-state-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.noData')}</h3>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant={state.mediaVariant ?? 'icon'}>
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryEmptyState: Story = {
  render: () => <FactoryEmptyStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-empty-state-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty-title"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty-description"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: SPECIALIZED FACTORIES ============

function FactoryNoDataDemo() {
  const state: FakeNoDataEmptyState = createFakeNoDataEmptyState('projects');

  return (
    <div className="space-y-4" data-testid="factory-no-data-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.noData')}</h3>
      <p className="text-muted-foreground text-sm">
        Entity: {state.entityName} | Items: {state.itemCount}
      </p>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryNoData: Story = {
  render: () => <FactoryNoDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-no-data-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText(/No projects yet/)).toBeInTheDocument();
  },
};

function FactoryNoResultsDemo() {
  const state: FakeNoResultsEmptyState = createFakeNoResultsEmptyState('react components');

  return (
    <div className="space-y-4" data-testid="factory-no-results-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.noResults')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('empty.factory.searchQuery')}: {state.searchQuery}
      </p>
      {state.appliedFilters && state.appliedFilters.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {i18n.t('empty.factory.filters')}: {state.appliedFilters.join(', ')}
        </p>
      )}
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryNoResults: Story = {
  render: () => <FactoryNoResultsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-no-results-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText('No results found')).toBeInTheDocument();
  },
};

function FactoryErrorDemo() {
  const state: FakeErrorEmptyState = createFakeErrorEmptyState(404);

  return (
    <div className="space-y-4" data-testid="factory-error-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.error')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('empty.factory.errorCode')}: {state.errorCode} |{' '}
        {i18n.t('empty.factory.retryAvailable')}: {String(state.retryAvailable)}
      </p>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangleIcon className="text-destructive" />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.errorMessage}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryError: Story = {
  render: () => <FactoryErrorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-error-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText('Error 404')).toBeInTheDocument();
  },
};

function FactoryOnboardingDemo() {
  const state: FakeOnboardingEmptyState = createFakeOnboardingEmptyState(2, 5);

  return (
    <div className="space-y-4" data-testid="factory-onboarding-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.onboarding')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('empty.factory.step')} {state.currentStep} {i18n.t('empty.factory.of')}{' '}
        {state.totalSteps}
      </p>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RocketIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryOnboarding: Story = {
  render: () => <FactoryOnboardingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-onboarding-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText(/Welcome/)).toBeInTheDocument();
  },
};

function FactoryFeatureDemo() {
  const state: FakeFeatureEmptyState = createFakeFeatureEmptyState('Analytics Dashboard');

  return (
    <div className="space-y-4" data-testid="factory-feature-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.feature')}</h3>
      {state.benefits && state.benefits.length > 0 && (
        <div>
          <p className="text-sm font-medium">{i18n.t('empty.factory.benefits')}:</p>
          <ul className="text-muted-foreground list-disc pl-5 text-sm">
            {state.benefits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RocketIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryFeature: Story = {
  render: () => <FactoryFeatureDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-feature-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText(/Introducing Analytics Dashboard/)).toBeInTheDocument();
  },
};

function FactoryOfflineDemo() {
  const state: FakeOfflineEmptyState = createFakeOfflineEmptyState();

  return (
    <div className="space-y-4" data-testid="factory-offline-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.offline')}</h3>
      {state.lastSyncedAt && (
        <p className="text-muted-foreground text-sm">
          {i18n.t('empty.factory.lastSynced')}: {state.lastSyncedAt.toLocaleString()}
        </p>
      )}
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WifiOffIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryOffline: Story = {
  render: () => <FactoryOfflineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-offline-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText(/offline/i)).toBeInTheDocument();
  },
};

function FactoryNoPermissionsDemo() {
  const state: FakeNoPermissionsEmptyState = createFakeNoPermissionsEmptyState();

  return (
    <div className="space-y-4" data-testid="factory-no-permissions-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.noPermissions')}</h3>
      {state.requiredPermission && (
        <p className="text-muted-foreground text-sm">
          {i18n.t('empty.factory.permission')}: {state.requiredPermission}
        </p>
      )}
      {state.requestAccessFrom && (
        <p className="text-muted-foreground text-sm">
          {i18n.t('empty.factory.requestAccess')}: {state.requestAccessFrom}
        </p>
      )}
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryNoPermissions: Story = {
  render: () => <FactoryNoPermissionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-no-permissions-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText('Access restricted')).toBeInTheDocument();
  },
};

function FactoryComingSoonDemo() {
  const state: FakeComingSoonEmptyState = createFakeComingSoonEmptyState();

  return (
    <div className="space-y-4" data-testid="factory-coming-soon-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.comingSoon')}</h3>
      {state.expectedDate && (
        <p className="text-muted-foreground text-sm">
          {i18n.t('empty.factory.expectedDate')}: {state.expectedDate.toLocaleDateString()}
        </p>
      )}
      {state.upcomingFeatures && state.upcomingFeatures.length > 0 && (
        <div>
          <p className="text-sm font-medium">{i18n.t('empty.factory.upcomingFeatures')}:</p>
          <ul className="text-muted-foreground list-disc pl-5 text-sm">
            {state.upcomingFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RocketIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryComingSoon: Story = {
  render: () => <FactoryComingSoonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-coming-soon-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText('Coming Soon')).toBeInTheDocument();
  },
};

// ============ FACTORY: DOMAIN-SPECIFIC FACTORIES ============

function FactoryInboxDemo() {
  const state: FakeNoDataEmptyState = createFakeInboxEmptyState();

  return (
    <div className="space-y-4" data-testid="factory-inbox-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.inbox')}</h3>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryInbox: Story = {
  render: () => <FactoryInboxDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-inbox-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText('No messages yet')).toBeInTheDocument();
  },
};

function FactoryNotificationsDemo() {
  const state: FakeNoDataEmptyState = createFakeNotificationsEmptyState();

  return (
    <div className="space-y-4" data-testid="factory-notifications-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.notifications')}</h3>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

export const FactoryNotifications: Story = {
  render: () => <FactoryNotificationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-notifications-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText('No notifications')).toBeInTheDocument();
  },
};

function FactoryCartDemo() {
  const state: FakeNoDataEmptyState = createFakeCartEmptyState();

  return (
    <div className="space-y-4" data-testid="factory-cart-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.cart')}</h3>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingCartIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryCart: Story = {
  render: () => <FactoryCartDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-cart-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText('Your cart is empty')).toBeInTheDocument();
  },
};

function FactoryFavoritesDemo() {
  const state: FakeNoDataEmptyState = createFakeFavoritesEmptyState();

  return (
    <div className="space-y-4" data-testid="factory-favorites-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.favorites')}</h3>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HeartIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryFavorites: Story = {
  render: () => <FactoryFavoritesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-favorites-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText('No favorites yet')).toBeInTheDocument();
  },
};

function FactoryCalendarDemo() {
  const state: FakeNoDataEmptyState = createFakeCalendarEmptyState();

  return (
    <div className="space-y-4" data-testid="factory-calendar-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.calendar')}</h3>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarIcon />
          </EmptyMedia>
          <EmptyTitle>{state.title}</EmptyTitle>
          <EmptyDescription>{state.description}</EmptyDescription>
        </EmptyHeader>
        {state.actions && state.actions.length > 0 && (
          <EmptyContent>
            {state.actions.map((action) => (
              <Button key={action.id} variant={action.type === 'primary' ? 'default' : 'outline'}>
                {action.label}
              </Button>
            ))}
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}

export const FactoryCalendar: Story = {
  render: () => <FactoryCalendarDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-calendar-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(canvas.getByText('No events')).toBeInTheDocument();
  },
};

// ============ FACTORY: MATRIX & SHOWCASE ============

function FactoryMatrixDemo() {
  const matrix = createFakeEmptyStateMatrix();

  return (
    <div className="space-y-6" data-testid="factory-matrix-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.matrix')}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(matrix).map(([key, state]) => (
          <div key={key} className="rounded border p-2">
            <p className="mb-2 text-xs font-medium uppercase">{key}</p>
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant={state.mediaVariant ?? 'icon'}>
                  <InboxIcon />
                </EmptyMedia>
                <EmptyTitle>{state.title}</EmptyTitle>
                <EmptyDescription>{state.description}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryMatrix: Story = {
  render: () => <FactoryMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-matrix-demo')).toBeInTheDocument();
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty"]');
    expect(emptyStates.length).toBeGreaterThanOrEqual(10);
  },
};

function FactoryShowcaseDemo() {
  const showcase = createFakeEmptyStateShowcase();

  return (
    <div className="space-y-6" data-testid="factory-showcase-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.showcase')}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(showcase).map(([key, state]) => (
          <div key={key} className="rounded border p-2">
            <p className="mb-2 text-xs font-medium uppercase">{key}</p>
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant={state.mediaVariant ?? 'icon'}>
                  <InboxIcon />
                </EmptyMedia>
                <EmptyTitle>{state.title}</EmptyTitle>
                <EmptyDescription>{state.description}</EmptyDescription>
              </EmptyHeader>
              {state.actions && state.actions.length > 0 && (
                <EmptyContent>
                  {state.actions.map((action) => (
                    <Button
                      key={action.id}
                      variant={action.type === 'primary' ? 'default' : 'outline'}
                    >
                      {action.label}
                    </Button>
                  ))}
                </EmptyContent>
              )}
            </Empty>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryShowcase: Story = {
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-showcase-demo')).toBeInTheDocument();
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty"]');
    expect(emptyStates.length).toBeGreaterThanOrEqual(15);
  },
};

// ============ FACTORY: CONSTANTS ============

function FactoryMediaVariantsDemo() {
  const variants: EmptyMediaVariant[] = EMPTY_MEDIA_VARIANTS;

  return (
    <div className="space-y-4" data-testid="factory-media-variants-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.mediaVariants')}</h3>
      <p className="text-muted-foreground text-sm">
        {variants.length} variants: {variants.join(', ')}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {variants.map((variant) => (
          <Empty key={variant} className="border">
            <EmptyHeader>
              <EmptyMedia variant={variant}>
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>Variant: {variant}</EmptyTitle>
              <EmptyDescription>EmptyMedia with variant={variant}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ))}
      </div>
    </div>
  );
}

export const FactoryMediaVariants: Story = {
  render: () => <FactoryMediaVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-media-variants-demo')).toBeInTheDocument();
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty"]');
    expect(emptyStates.length).toBe(EMPTY_MEDIA_VARIANTS.length);
  },
};

function FactoryStateTypesDemo() {
  const types: EmptyStateType[] = EMPTY_STATE_TYPES;

  return (
    <div className="space-y-4" data-testid="factory-state-types-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.stateTypes')}</h3>
      <p className="text-muted-foreground text-sm">{types.length} types available</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {types.map((type) => {
          const state = createFakeEmptyState({ type });
          return (
            <Empty key={type} className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <InboxIcon />
                </EmptyMedia>
                <EmptyTitle>{state.title}</EmptyTitle>
                <EmptyDescription>Type: {type}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryStateTypes: Story = {
  render: () => <FactoryStateTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-state-types-demo')).toBeInTheDocument();
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty"]');
    expect(emptyStates.length).toBe(EMPTY_STATE_TYPES.length);
  },
};

function FactoryIconsDemo() {
  const icons: EmptyStateIcon[] = EMPTY_STATE_ICONS;

  return (
    <div className="space-y-4" data-testid="factory-icons-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.icons')}</h3>
      <p className="text-muted-foreground text-sm">{icons.length} icons available</p>
      <div className="flex flex-wrap gap-2">
        {icons.map((icon) => (
          <span key={icon} className="bg-muted rounded px-2 py-1 font-mono text-xs">
            {icon}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryIcons: Story = {
  render: () => <FactoryIconsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-icons-demo')).toBeInTheDocument();
    expect(canvas.getByText('Inbox')).toBeInTheDocument();
    expect(canvas.getByText('SearchX')).toBeInTheDocument();
    expect(canvas.getByText('AlertTriangle')).toBeInTheDocument();
  },
};

function FactoryEntityNamesDemo() {
  return (
    <div className="space-y-4" data-testid="factory-entity-names-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.entities')}</h3>
      <p className="text-muted-foreground text-sm">{ENTITY_NAMES.length} entity names</p>
      <div className="flex flex-wrap gap-2">
        {ENTITY_NAMES.map((name) => (
          <span key={name} className="bg-muted rounded px-2 py-1 font-mono text-xs">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryEntityNames: Story = {
  render: () => <FactoryEntityNamesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-entity-names-demo')).toBeInTheDocument();
    expect(canvas.getByText('projects')).toBeInTheDocument();
    expect(canvas.getByText('tasks')).toBeInTheDocument();
    expect(canvas.getByText('users')).toBeInTheDocument();
  },
};

function FactoryIconsByTypeDemo() {
  const mapping: Record<EmptyStateType, EmptyStateIcon[]> = ICONS_BY_STATE_TYPE;

  return (
    <div className="space-y-4" data-testid="factory-icons-by-type-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.iconsByType')}</h3>
      <div className="space-y-2">
        {(Object.entries(mapping) as [EmptyStateType, EmptyStateIcon[]][]).map(([type, icons]) => (
          <div key={type} className="flex items-center gap-2">
            <span className="min-w-[120px] text-sm font-medium">{type}:</span>
            <div className="flex gap-1">
              {icons.map((icon) => (
                <span key={icon} className="bg-muted rounded px-2 py-0.5 font-mono text-xs">
                  {icon}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryIconsByType: Story = {
  render: () => <FactoryIconsByTypeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-icons-by-type-demo')).toBeInTheDocument();
    expect(canvas.getByText('no-data:')).toBeInTheDocument();
    expect(canvas.getByText('error:')).toBeInTheDocument();
    expect(canvas.getByText('offline:')).toBeInTheDocument();
  },
};

function FactoryTitlesByTypeDemo() {
  const mapping: Record<EmptyStateType, string[]> = TITLES_BY_STATE_TYPE;

  return (
    <div className="space-y-4" data-testid="factory-titles-by-type-demo">
      <h3 className="text-lg font-semibold">{i18n.t('empty.factory.titlesByType')}</h3>
      <div className="space-y-3">
        {(Object.entries(mapping) as [EmptyStateType, string[]][]).map(([type, titles]) => (
          <div key={type}>
            <p className="text-sm font-medium">{type}:</p>
            <div className="flex flex-wrap gap-1">
              {titles.map((title) => (
                <span key={title} className="bg-muted rounded px-2 py-0.5 text-xs">
                  {title}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryTitlesByType: Story = {
  render: () => <FactoryTitlesByTypeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-titles-by-type-demo')).toBeInTheDocument();
    expect(canvas.getByText('no-data:')).toBeInTheDocument();
    expect(canvas.getByText('No items yet')).toBeInTheDocument();
    expect(canvas.getByText('Something went wrong')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('empty.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('empty.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('empty.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('empty.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   emptyWithAction
//   emptyNoAction
//   emptyFiltered
//   notFound
//   conflict
//   tooManyRequests
//   badGateway
//   serviceUnavailable
//   gatewayTimeout
//   slowResponse
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('empty.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: emptyStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyWithAction: Story = {
  ...Default,
  name: i18n.t('empty.storyName.handlerEmptyWithAction', 'Handler: Empty With Action'),
  parameters: { msw: { handlers: emptyStatusHandlers.emptyWithAction } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyNoAction: Story = {
  ...Default,
  name: i18n.t('empty.storyName.handlerEmptyNoAction', 'Handler: Empty No Action'),
  parameters: { msw: { handlers: emptyStatusHandlers.emptyNoAction } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyFiltered: Story = {
  ...Default,
  name: i18n.t('empty.storyName.handlerEmptyFiltered', 'Handler: Empty Filtered'),
  parameters: { msw: { handlers: emptyStatusHandlers.emptyFiltered } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

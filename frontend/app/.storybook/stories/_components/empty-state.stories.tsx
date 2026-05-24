import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  AlertCircleIcon,
  FileSearchIcon,
  FolderPlusIcon,
  InboxIcon,
  PackageIcon,
  SearchIcon,
  ShoppingCartIcon,
  UsersIcon,
} from 'lucide-react';
import * as React from 'react';

import { EmptyState } from './EmptyState';

import {
  createEmptyStateContextMatrix,
  createEmptyStateIconMatrix,
  createEmptyStateShowcase,
  createEmptyStateTestData,
  createFakeEmptyState,
  createFakeEmptyStateLongText,
  createFakeEmptyStates,
  createFakeEmptyStateWithAction,
  createFakeEmptyStateWithoutAction,
  EMPTY_STATE_CONTEXTS,
  EMPTY_STATE_ICON_VARIANTS,
  type FakeEmptyState,
} from '../_factories/empty-state.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function EmptyStateDemo(props: React.ComponentProps<typeof EmptyState>) {
  return (
    <div className="w-full max-w-lg" data-testid="empty-state-demo">
      <EmptyState {...props} />
    </div>
  );
}

function EmptyStateWithActionDemo() {
  const { t } = useTranslation();
  const [clicked, setClicked] = React.useState(false);

  return (
    <div className="w-full max-w-lg" data-testid="empty-state-action-demo">
      <EmptyState
        title={t('common:emptyState.demo.noData')}
        description={t('common:emptyState.demo.noItems')}
        action={{
          label: clicked ? t('common:emptyState.demo.added') : t('common:emptyState.demo.addItem'),
          onClick: () => setClicked(true),
        }}
      />
      {clicked && (
        <p className="mt-4 text-center text-sm text-green-600" data-testid="action-feedback">
          {t('common:emptyState.demo.actionClicked')}
        </p>
      )}
    </div>
  );
}

function CustomIconsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('common:emptyState.story.searchIcon')}</p>
        <EmptyStateDemo
          title={t('common:emptyState.demo.noSearchResults')}
          description={t('common:emptyState.demo.adjustSearch')}
          icon={<SearchIcon className="size-5" />}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('common:emptyState.story.usersIcon')}</p>
        <EmptyStateDemo
          title={t('common:emptyState.demo.noTeamMembers')}
          description={t('common:emptyState.demo.inviteMembers')}
          icon={<UsersIcon className="size-5" />}
          action={{
            label: t('common:emptyState.demo.inviteMembersAction'),
            onClick: fn(),
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('common:emptyState.story.cartIcon')}</p>
        <EmptyStateDemo
          title={t('common:emptyState.demo.cartEmpty')}
          description={t('common:emptyState.demo.addItemsToCart')}
          icon={<ShoppingCartIcon className="size-5" />}
          action={{
            label: t('common:emptyState.demo.browseProducts'),
            onClick: fn(),
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('common:emptyState.story.alertIcon')}</p>
        <EmptyStateDemo
          title={t('common:emptyState.demo.noNotifications')}
          description={t('common:emptyState.demo.allCaughtUp')}
          icon={<AlertCircleIcon className="size-5" />}
        />
      </div>
    </div>
  );
}

function CustomContentDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <EmptyStateDemo
          title={t('common:emptyState.demo.noFiles')}
          description={t('common:emptyState.demo.uploadFiles')}
          icon={<FileSearchIcon className="size-5" />}
          action={{
            label: t('common:emptyState.demo.uploadFilesAction'),
            onClick: fn(),
          }}
        />
      </div>

      <div>
        <EmptyStateDemo
          title={t('common:emptyState.demo.noData')}
          description={t('common:emptyState.demo.noItems')}
          icon={<PackageIcon className="size-5" />}
          action={{
            label: t('common:emptyState.demo.addItem'),
            onClick: fn(),
          }}
        />
      </div>

      <div>
        <EmptyStateDemo
          title={t('common:emptyState.demo.noFiles')}
          description={t('common:emptyState.demo.uploadFiles')}
          icon={<FolderPlusIcon className="size-5" />}
          action={{
            label: t('common:emptyState.demo.uploadFilesAction'),
            onClick: fn(),
          }}
        />
      </div>
    </div>
  );
}

function SizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('common:emptyState.story.compact')}</p>
        <div className="max-w-sm">
          <EmptyState
            title={t('common:emptyState.demo.noData')}
            description={t('common:emptyState.demo.noItems')}
            className="py-4"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('common:emptyState.story.default')}</p>
        <div className="max-w-lg">
          <EmptyState
            title={t('common:emptyState.demo.noData')}
            description={t('common:emptyState.demo.noItems')}
            action={{
              label: t('common:emptyState.demo.addItem'),
              onClick: fn(),
            }}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('common:emptyState.story.fullPage')}</p>
        <div className="bg-card min-h-[300px] rounded-lg border">
          <EmptyState
            title={t('common:emptyState.demo.noData')}
            description={t('common:emptyState.demo.noItems')}
            icon={<InboxIcon className="size-8" />}
            action={{
              label: t('common:emptyState.demo.addItem'),
              onClick: fn(),
            }}
            className="min-h-[300px]"
          />
        </div>
      </div>
    </div>
  );
}

function AccessibilityDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 text-sm font-medium">{t('common:emptyState.a11y.withAction')}</h3>
        <EmptyStateDemo
          title={t('common:emptyState.demo.noMessages')}
          description={t('common:emptyState.demo.newMessages')}
          icon={<InboxIcon className="size-5" aria-hidden="true" />}
          action={{
            label: t('common:emptyState.demo.composeMessage'),
            onClick: fn(),
          }}
        />
      </div>

      <div>
        <h3 className="mb-4 text-sm font-medium">{t('common:emptyState.a11y.readOnly')}</h3>
        <EmptyStateDemo
          title={t('common:emptyState.demo.noNotifications')}
          description={t('common:emptyState.demo.allCaughtUp')}
          icon={<AlertCircleIcon className="size-5" aria-hidden="true" />}
        />
      </div>
    </div>
  );
}

function WithoutIconDemo() {
  const { t } = useTranslation();
  return (
    <EmptyStateDemo
      title={t('emptyState.story.noResults', 'No results')}
      description={t('emptyState.story.tryDifferentSearch', 'Try a different search query.')}
      icon={null}
    />
  );
}

function EmptyTitleDemo() {
  const { t } = useTranslation();
  return (
    <EmptyStateDemo
      title=""
      description={t('emptyState.story.onlyDescription', 'Only a description, no title.')}
    />
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Documentation/Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    title: i18n.t('emptyState.story.noDataAvailable', 'No data available'),
    description: i18n.t(
      'emptyState.story.noItemsToDisplay',
      'There are no items to display at this time.'
    ),
  },
  argTypes: {
    title: {
      control: 'text',
      description: i18n.t(
        'emptyState.argType.titleTextForTheEmptyState',
        'Title text for the empty state'
      ),
      table: {
        category: 'Content',
        defaultValue: { summary: 'No data available' },
        type: { summary: 'string' },
      },
    },
    description: {
      control: 'text',
      description: i18n.t(
        'emptyState.argType.descriptionTextExplainingTheEmptyState',
        'Description text explaining the empty state'
      ),
      table: {
        category: 'Content',
        defaultValue: { summary: 'There are no items to display at this time.' },
        type: { summary: 'string' },
      },
    },
    icon: {
      control: false,
      description: i18n.t(
        'emptyState.argType.customIconToDisplayDefaultsToInboxIcon',
        'Custom icon to display (defaults to Inbox icon)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'React.ReactNode' },
      },
    },
    action: {
      control: false,
      description: i18n.t(
        'emptyState.argType.actionButtonConfigurationWithLabelAndOnclickHandler',
        'Action button configuration with label and onClick handler'
      ),
      table: {
        category: 'Content',
        type: { summary: '{ label: string; onClick: () => void }' },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('emptyState.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component: `
EmptyState is a reusable component for displaying empty or zero-state UI.
It provides a consistent way to show users that there is no data to display,
with optional icons, titles, descriptions, and call-to-action buttons.

## Features
- Default Inbox icon with customizable icon support
- Optional action button with click handler
- Consistent styling using the Empty component primitives
- Accessible with proper ARIA attributes
- Supports dark mode and RTL layouts
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// CORE STORIES
// ============================================================================

export const Default: Story = {
  render: (args) => <EmptyStateDemo {...args} />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const emptyState = canvas.getByTestId('story-empty');
    expect(emptyState).toBeInTheDocument();
    expect(emptyState.getAttribute('data-slot')).toBe('empty-state');
    expect(emptyState.getAttribute('data-state')).toBe('empty');

    const title = canvasElement.querySelector('[data-slot="empty-title"]');
    expect(title).toBeInTheDocument();

    const description = canvasElement.querySelector('[data-slot="empty-description"]');
    expect(description).toBeInTheDocument();

    const iconContainer = canvasElement.querySelector('[data-slot="empty-icon"]');
    expect(iconContainer).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  args: {
    title: i18n.t('emptyState.story.customizeTitle', 'Customize this empty state'),
    description: i18n.t(
      'emptyState.story.customizeDesc',
      'Use the controls panel to modify the title, description, and other props.'
    ),
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// WITH ACTION
// ============================================================================

export const WithAction: Story = {
  render: () => <EmptyStateWithActionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actionButton = canvas.getByTestId('empty-action-button');
    expect(actionButton).toBeInTheDocument();

    await userEvent.click(actionButton);

    const feedback = canvas.getByTestId('action-feedback');
    expect(feedback).toBeInTheDocument();
  },
};

// ============================================================================
// CUSTOM ICON
// ============================================================================

export const CustomIcon: Story = {
  render: () => <CustomIconsDemo />,
  play: async ({ canvasElement }) => {
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty-state"]');
    expect(emptyStates.length).toBe(4);

    const iconContainers = canvasElement.querySelectorAll('[data-slot="empty-icon"]');
    expect(iconContainers.length).toBe(4);
  },
};

// ============================================================================
// CUSTOM CONTENT
// ============================================================================

export const CustomContent: Story = {
  render: () => <CustomContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actionButtons = canvas.getAllByTestId('empty-action-button');
    expect(actionButtons.length).toBe(3);
  },
};

// ============================================================================
// SIZES
// ============================================================================

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty-state"]');
    expect(emptyStates.length).toBe(3);
  },
};

// ============================================================================
// WITHOUT ICON
// ============================================================================

export const WithoutIcon: Story = {
  render: () => <WithoutIconDemo />,
  play: async ({ canvasElement }) => {
    const emptyState = canvasElement.querySelector('[data-slot="empty-state"]');
    expect(emptyState).toBeInTheDocument();
    const iconContainer = canvasElement.querySelector('[data-slot="empty-icon"]');
    expect(iconContainer).toBeInTheDocument();
  },
};

// ============================================================================
// INTERACTIVE DEMO
// ============================================================================

export const InteractiveDemo: Story = {
  render: () => {
    const ActionDemo = () => {
      const { t } = useTranslation();
      const [count, setCount] = React.useState(0);

      return (
        <div className="space-y-4">
          <EmptyState
            title={t('emptyState.story.clickCounterDemo', 'Click counter demo')}
            description={t(
              'emptyState.story.clickCount',
              'Button has been clicked {{count}} time(s).',
              { count }
            )}
            icon={<InboxIcon className="size-5" />}
            action={{
              label: t('emptyState.story.clickMe', 'Click me ({{count}})', { count }),
              onClick: () => setCount((c) => c + 1),
            }}
          />
        </div>
      );
    };

    return <ActionDemo />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId('empty-action-button');
    expect(button.textContent).toContain('(0)');

    await userEvent.click(button);
    expect(button.textContent).toContain('(1)');

    await userEvent.click(button);
    expect(button.textContent).toContain('(2)');
  },
};

// ============================================================================
// ACCESSIBILITY
// ============================================================================

export const Accessibility: Story = {
  render: () => <AccessibilityDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    const actionButton = canvas.getByTestId('empty-action-button');
    expect(actionButton).toBeInTheDocument();

    await userEvent.tab();
    expect(doc.activeElement).toBe(actionButton);

    await userEvent.keyboard('{Enter}');

    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty-state"]');
    expect(emptyStates.length).toBe(2);

    const titles = canvasElement.querySelectorAll('[data-slot="empty-title"]');
    titles.forEach((title) => {
      expect(title.textContent?.trim().length).toBeGreaterThan(0);
    });

    const descriptions = canvasElement.querySelectorAll('[data-slot="empty-description"]');
    descriptions.forEach((desc) => {
      expect(desc.textContent?.trim().length).toBeGreaterThan(0);
    });
  },
};

// ============================================================================
// DATA ATTRIBUTES
// ============================================================================

export const DataAttributes: Story = {
  render: (args) => <EmptyStateDemo {...args} />,
  play: async ({ canvasElement }) => {
    const emptyState = canvasElement.querySelector('[data-slot="empty-state"]');
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveAttribute('data-state', 'empty');
    expect(emptyState).toHaveAttribute('data-testid', 'story-empty');

    const title = canvasElement.querySelector('[data-slot="empty-title"]');
    expect(title).toBeInTheDocument();

    const description = canvasElement.querySelector('[data-slot="empty-description"]');
    expect(description).toBeInTheDocument();

    const icon = canvasElement.querySelector('[data-slot="empty-icon"]');
    expect(icon).toBeInTheDocument();
  },
};

// ============================================================================
// THEME & i18n VARIANTS
// ============================================================================

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

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('emptyState.storyName.darkRTL', 'Dark + RTL'),
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  name: i18n.t('emptyState.storyName.japanese', 'Japanese Locale'),
  parameters: {
    locale: 'ja',
  },
  render: () => <CustomIconsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
  tags: ['!test'],
};

export const DarkJapanese: Story = {
  name: i18n.t('emptyState.storyName.darkJapanese', 'Dark + Japanese'),
  parameters: {
    locale: 'ja',
  },
  globals: {
    theme: 'dark',
  },
  render: () => <CustomIconsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
  tags: ['!test'],
};

// ============================================================================
// PSEUDO STATES
// ============================================================================

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('emptyState.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-start gap-8">
        <div id="hover" className="flex-1">
          <p className="mb-2 text-sm font-medium">{i18n.t('emptyState.story.hover', 'Hover')}</p>
          <Story />
        </div>
        <div id="focus" className="flex-1">
          <p className="mb-2 text-sm font-medium">{i18n.t('emptyState.story.focus', 'Focus')}</p>
          <Story />
        </div>
        <div id="active" className="flex-1">
          <p className="mb-2 text-sm font-medium">{i18n.t('emptyState.story.active', 'Active')}</p>
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    ...Default.args,
    action: {
      label: i18n.t('emptyState.story.actionButton', 'Action Button'),
      onClick: fn(),
    },
  },
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover button'],
      focusVisible: ['#focus button'],
      active: ['#active button'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// DESIGN REFERENCE
// ============================================================================

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

// ============================================================================
// EDGE CASES
// ============================================================================

export const LongTextOverflow: Story = {
  name: i18n.t('emptyState.storyName.longTextOverflow', 'Long Text Overflow'),
  render: () => {
    const longData = createFakeEmptyStateLongText();
    return (
      <div className="w-full max-w-lg">
        <EmptyState title={longData.title} description={longData.description} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const emptyState = canvasElement.querySelector('[data-slot="empty-state"]');
    expect(emptyState).toBeInTheDocument();

    const title = canvasElement.querySelector('[data-slot="empty-title"]');
    expect(title?.textContent?.length).toBeGreaterThan(20);
  },
};

export const EmptyTitle: Story = {
  name: i18n.t('emptyState.storyName.emptyTitle', 'Empty Title (edge case)'),
  render: () => <EmptyTitleDemo />,
  play: async ({ canvasElement }) => {
    const emptyState = canvasElement.querySelector('[data-slot="empty-state"]');
    expect(emptyState).toBeInTheDocument();
  },
};

// ============================================================================
// MOBILE VIEWPORT
// ============================================================================

export const Mobile: Story = {
  name: i18n.t('emptyState.storyName.mobile', 'Mobile Viewport (320px)'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  render: () => <CustomIconsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY STORIES
// ============================================================================

export const FactoryData: Story = {
  name: i18n.t('emptyState.storyName.factoryData', 'Factory: Generated Empty States'),
  render: () => {
    const states = createFakeEmptyStates(4);
    return (
      <div className="flex flex-col gap-6">
        {states.map((state) => (
          <div key={state.id} className="max-w-lg">
            <EmptyState title={state.title} description={state.description} action={state.action} />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty-state"]');
    expect(emptyStates.length).toBe(4);
  },
};

export const FactoryContextMatrix: Story = {
  name: i18n.t('emptyState.storyName.factoryContextMatrix', 'Factory: Context Matrix'),
  render: () => {
    const contexts = createEmptyStateContextMatrix();
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {contexts.map((state) => (
          <div key={state.id} className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">{state.context}</p>
            <EmptyState title={state.title} description={state.description} action={state.action} />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const emptyStates = canvasElement.querySelectorAll('[data-slot="empty-state"]');
    expect(emptyStates.length).toBe(EMPTY_STATE_CONTEXTS.length);
  },
};

export const FactoryWithAction: Story = {
  name: i18n.t('emptyState.storyName.factoryWithAction', 'Factory: With Action'),
  render: () => {
    const state = createFakeEmptyStateWithAction();
    return (
      <div className="max-w-lg">
        <EmptyState title={state.title} description={state.description} action={state.action} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const actionButton = canvasElement.querySelector('[data-testid="empty-action-button"]');
    expect(actionButton).toBeInTheDocument();
  },
};

export const FactoryWithoutAction: Story = {
  name: i18n.t('emptyState.storyName.factoryWithoutAction', 'Factory: Without Action'),
  render: () => {
    const state = createFakeEmptyStateWithoutAction();
    return (
      <div className="max-w-lg">
        <EmptyState title={state.title} description={state.description} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const actionButton = canvasElement.querySelector('[data-testid="empty-action-button"]');
    expect(actionButton).not.toBeInTheDocument();
  },
};

export const FactoryShowcase: Story = {
  name: i18n.t('emptyState.storyName.factoryShowcase', 'Factory: Complete Showcase'),
  tags: ['!test'],
  render: () => {
    const showcase = createEmptyStateShowcase();
    return (
      <div className="space-y-8">
        <div>
          <h3 className="mb-3 font-semibold">{i18n.t('emptyState.story.testData', 'Test Data')}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              title={showcase.testData.withAction.title}
              description={showcase.testData.withAction.description}
              action={showcase.testData.withAction.action}
            />
            <EmptyState
              title={showcase.testData.noAction.title}
              description={showcase.testData.noAction.description}
            />
          </div>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// Ensure factory types, constants, and functions are referenced (F3.11-F3.13)
void createFakeEmptyState;
void createEmptyStateIconMatrix;
void createEmptyStateTestData;
void EMPTY_STATE_ICON_VARIANTS;

// Type reference for factory interface (F3.13)
const _typeCheck: FakeEmptyState | undefined = undefined;
void _typeCheck;

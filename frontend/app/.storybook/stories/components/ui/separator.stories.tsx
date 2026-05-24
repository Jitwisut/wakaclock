import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import type {
  FakeBreadcrumbItem,
  FakeBreadcrumbWithSeparators,
  FakeCardWithSeparators,
  FakeNavigationWithSeparators,
  FakeNavItem,
  FakeSeparator,
  FakeSeparatorInContext,
  FakeSidebarGroup,
  FakeSidebarItem,
  FakeSidebarWithSeparators,
  FakeToolbarWithSeparators,
  FakeToolGroup,
  FakeToolItem,
  SeparatorColor,
  SeparatorContext,
  SeparatorOrientation,
  SeparatorStyle,
  SeparatorThickness,
} from '@/.storybook/stories/_factories/separator.factory';
import {
  COLOR_CLASSES,
  createFakeBreadcrumbSeparator,
  createFakeBreadcrumbWithSeparators,
  createFakeCardSeparator,
  createFakeCardWithSeparators,
  createFakeColoredSeparator,
  createFakeDecorativeSeparator,
  createFakeFormSeparator,
  createFakeHorizontalSeparator,
  createFakeNavigationSeparator,
  createFakeNavigationWithSeparators,
  createFakeSemanticSeparator,
  createFakeSeparator,
  createFakeSeparatorInContext,
  createFakeSeparators,
  createFakeSidebarSeparator,
  createFakeSidebarWithSeparators,
  createFakeThickSeparator,
  createFakeToolbarSeparator,
  createFakeToolbarWithSeparators,
  createFakeVerticalSeparator,
  createSeparatorColorMatrix,
  createSeparatorContextMatrix,
  createSeparatorOrientationMatrix,
  createSeparatorShowcase,
  createSeparatorTestData,
  createSeparatorThicknessMatrix,
  SEPARATOR_COLORS,
  SEPARATOR_CONTEXTS,
  SEPARATOR_ORIENTATIONS,
  SEPARATOR_STYLES,
  SEPARATOR_THICKNESSES,
  SPACING_CLASSES,
  THICKNESS_CLASSES,
  VERTICAL_HEIGHTS,
  VERTICAL_THICKNESS_CLASSES,
} from '@/.storybook/stories/_factories/separator.factory';
import {
  separatorHandlers,
  separatorStatusHandlers,
} from '@/.storybook/stories/_handlers/separator.handlers';

import { Separator } from '@/components/ui/separator';

import React from 'react';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type SeparatorHorizontalDemoProps = {
  sectionContent?: string;
  sectionTitle?: string;
};

function SeparatorHorizontalDemo({
  sectionTitle = 'Section',
  sectionContent = 'Content below the separator.',
}: SeparatorHorizontalDemoProps) {
  return (
    <div className="w-[420px] space-y-3" data-separator-demo>
      <div className="text-sm font-medium" data-separator-heading>
        {sectionTitle}
      </div>
      <Separator />
      <div className="text-muted-foreground text-sm" data-separator-content>
        {sectionContent}
      </div>
    </div>
  );
}

function I18nSeparatorHorizontalDemo() {
  const { t } = useTranslation();
  return (
    <SeparatorHorizontalDemo
      sectionTitle={t('separator.sectionTitle')}
      sectionContent={t('separator.sectionContent')}
    />
  );
}

function SeparatorVerticalDemo() {
  return (
    <div className="flex items-center gap-4" data-separator-vertical-demo>
      <span className="text-sm" data-separator-vertical-left>
        Left
      </span>
      <Separator className="h-6" data-separator-vertical orientation="vertical" />
      <span className="text-sm" data-separator-vertical-right>
        Right
      </span>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Separator',
  component: Separator,
  tags: ['autodocs'],
  args: {
    orientation: 'horizontal',
    decorative: true,
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Content
    'aria-label': {
      control: 'text',
      description: i18n.t(
        'separator.argType.accessibleLabelForNondecorativeSeparators',
        'Accessible label for non-decorative separators'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'separator.argType.additionalCssClassesForCustomStylingHeightColorSpacing',
        'Additional CSS classes for custom styling (height, color, spacing)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    decorative: {
      control: 'boolean',
      description: i18n.t(
        'separator.argType.whetherTheSeparatorIsPurelyDecorativeTrueOrHasSemanticMeaningFalseDecorativeSeparatorsUseRolenoneAndAreIgnoredByAssistiveTechnology',
        'Whether the separator is purely decorative (true) or has semantic meaning (false). Decorative separators use role="none" and are ignored by assistive technology.'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: i18n.t(
        'separator.argType.orientationOfTheSeparatorLine',
        'Orientation of the separator line'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'horizontal' },
        type: { summary: "'horizontal' | 'vertical'" },
      },
    },
    asChild: {
      control: 'boolean',
      description: i18n.t(
        'separator.argType.renderAsChildElementInsteadOfDefaultDiv',
        'Render as child element instead of default div'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('separator.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('separator.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('separator.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('separator.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('separator.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('separator.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('separator.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
  },
  parameters: {
    msw: { handlers: separatorHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-[420px] space-y-3">
      <div className="text-sm font-medium">
        {i18n.t('separator.story.sectionTitle', 'Section Title')}
      </div>
      <Separator {...args} />
      <div className="text-muted-foreground text-sm">
        {i18n.t('separator.story.contentBelowTheSeparator', 'Content below the separator.')}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

function VariantsDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('separator.variants.horizontal')}</p>
        <div className="w-[300px]">
          <Separator />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('separator.variants.vertical')}</p>
        <div className="flex h-8 items-center gap-4">
          <span className="text-sm">{t('separator.story.left', 'Left')}</span>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm">{t('separator.story.right', 'Right')}</span>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('separator.variants.withTextLabel')}</p>
        <div className="flex w-[300px] items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">{t('separator.story.or', 'OR')}</span>
          <Separator className="flex-1" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('separator.variants.dashed')}</p>
        <div className="border-border w-[300px] border-t border-dashed" />
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

function SizesDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('separator.sizes.thin')}</p>
        <div className="w-[300px]">
          <Separator className="h-px" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('separator.sizes.default')}</p>
        <div className="w-[300px]">
          <Separator />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('separator.sizes.thick')}</p>
        <div className="w-[300px]">
          <Separator className="h-1" />
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Horizontal: Story = {
  render: () => <SeparatorHorizontalDemo />,
  play: async ({ canvasElement }) => {
    const separator = canvasElement.querySelector('[data-slot="separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.getAttribute('data-orientation')).toBe('horizontal');
  },
};

export const Vertical: Story = {
  render: () => <SeparatorVerticalDemo />,
  play: async ({ canvasElement }) => {
    const separator = canvasElement.querySelector('[data-orientation="vertical"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.getAttribute('data-slot')).toBe('separator');
  },
};

export const InNavigation: Story = {
  render: () => (
    <nav className="flex items-center gap-4 text-sm">
      <a href="#home" className="text-primary hover:underline">
        Home
      </a>
      <Separator orientation="vertical" className="h-4" />
      <a href="#about" className="text-muted-foreground hover:underline">
        About
      </a>
      <Separator orientation="vertical" className="h-4" />
      <a href="#contact" className="text-muted-foreground hover:underline">
        Contact
      </a>
    </nav>
  ),
  play: async ({ canvasElement }) => {
    const separators = canvasElement.querySelectorAll('[data-orientation="vertical"]');
    expect(separators).toHaveLength(2);
  },
};

export const InCard: Story = {
  render: () => (
    <div className="w-[300px] rounded-lg border p-4">
      <h3 className="font-semibold">{i18n.t('separator.story.cardTitle', 'Card Title')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('separator.story.cardDescriptionGoesHere', 'Card description goes here.')}
      </p>
      <Separator className="my-4" />
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{i18n.t('separator.story.status', 'Status')}</span>
        <span className="font-medium">{i18n.t('separator.story.active', 'Active')}</span>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const InToolbar: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded-lg border p-2">
      <button type="button" className="hover:bg-muted rounded p-1">
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
      <button type="button" className="hover:bg-muted rounded p-1">
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
      <Separator orientation="vertical" className="h-6" />
      <button type="button" className="hover:bg-muted rounded p-1">
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      </button>
      <button type="button" className="hover:bg-muted rounded p-1">
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const separator = canvasElement.querySelector('[data-orientation="vertical"]');
    expect(separator).toBeInTheDocument();
  },
};

export const InSidebar: Story = {
  render: () => (
    <div className="w-[240px] space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <button
          type="button"
          className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm"
        >
          Dashboard
        </button>
        <button
          type="button"
          className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm"
        >
          Projects
        </button>
        <button
          type="button"
          className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm"
        >
          Tasks
        </button>
      </div>
      <Separator />
      <div className="space-y-1">
        <button
          type="button"
          className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm"
        >
          Settings
        </button>
        <button
          type="button"
          className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm"
        >
          Help
        </button>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const CustomColors: Story = {
  render: () => (
    <div className="w-[300px] space-y-6">
      <div className="space-y-2">
        <span className="text-sm">{i18n.t('separator.story.default', 'Default')}</span>
        <Separator />
      </div>
      <div className="space-y-2">
        <span className="text-sm">{i18n.t('separator.story.primary', 'Primary')}</span>
        <Separator className="bg-primary" />
      </div>
      <div className="space-y-2">
        <span className="text-sm">{i18n.t('separator.story.muted', 'Muted')}</span>
        <Separator className="bg-muted" />
      </div>
      <div className="space-y-2">
        <span className="text-sm">{i18n.t('separator.story.destructive', 'Destructive')}</span>
        <Separator className="bg-destructive" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators).toHaveLength(4);
  },
};

export const CustomThickness: Story = {
  render: () => (
    <div className="w-[300px] space-y-6">
      <div className="space-y-2">
        <span className="text-sm">Default (1px)</span>
        <Separator />
      </div>
      <div className="space-y-2">
        <span className="text-sm">Thick (2px)</span>
        <Separator className="h-0.5" />
      </div>
      <div className="space-y-2">
        <span className="text-sm">Thicker (4px)</span>
        <Separator className="h-1" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators).toHaveLength(3);
  },
};

export const WithSpacing: Story = {
  render: () => (
    <div className="w-[300px] space-y-4">
      <p className="text-sm">
        {i18n.t(
          'separator.story.contentAboveSeparatorWithMarginbasedSpac',
          'Content above separator with margin-based spacing.'
        )}
      </p>
      <Separator className="my-8" />
      <p className="text-sm">
        {i18n.t(
          'separator.story.contentBelowSeparatorWithLargeVerticalSp',
          'Content below separator with large vertical spacing applied.'
        )}
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const SemanticSeparator: Story = {
  name: i18n.t('separator.storyName.semanticSeparator', 'Semantic (decorative=false)'),
  render: () => (
    <div className="w-[300px] space-y-3">
      <p className="text-sm font-medium">Section 1</p>
      <Separator decorative={false} />
      <p className="text-sm font-medium">Section 2</p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const separator = canvasElement.querySelector('[data-slot="separator"]');
    expect(separator?.getAttribute('role')).toBe('separator');
    expect(separator?.getAttribute('aria-orientation')).toBe('horizontal');
  },
};

export const Default: Story = {
  ...Playground,
  render: () => <SeparatorHorizontalDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const demoRoot = canvasElement.querySelector('[data-separator-demo]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Separator demo root was not found.');
    }

    const heading = demoRoot.querySelector('[data-separator-heading]');

    if (!(heading instanceof HTMLElement)) {
      throw new Error('Separator heading was not found.');
    }

    const content = demoRoot.querySelector('[data-separator-content]');

    if (!(content instanceof HTMLElement)) {
      throw new Error('Separator content was not found.');
    }

    expect(heading.textContent?.trim().length).not.toBe(0);
    expect(content.textContent?.trim().length).not.toBe(0);

    const separator = demoRoot.querySelector('[data-slot="separator"]');

    if (!(separator instanceof HTMLElement)) {
      throw new Error('Separator was not found.');
    }

    expect(separator.getAttribute('data-slot')).toBe('separator');
    expect(separator.getAttribute('data-orientation')).toBe('horizontal');
    expect(separator.getAttribute('role')).toBe('none');
    expect(separator.getAttribute('aria-orientation')).not.toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('separator.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nSeparatorHorizontalDemo />,
  play: async (context) => {
    const root = context.canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(root.ownerDocument.documentElement.lang).toBe('ja');

    const heading = root.querySelector('[data-separator-heading]');

    if (!(heading instanceof HTMLElement)) {
      throw new Error('Separator heading was not found.');
    }

    expect(within(heading).getByText('セクション')).toBeInTheDocument();

    await Default.play?.(context);
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
  name: i18n.t('separator.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium">
          {i18n.t('separator.story.sectionOne', 'Section One')}
        </h4>
        <p className="text-muted-foreground text-sm">
          {i18n.t('separator.story.contentForSectionOne', 'Content for section one.')}
        </p>
      </div>
      <Separator
        decorative={false}
        aria-label={i18n.t('separator.story.sectionDivider', 'Section divider')}
      />
      <div>
        <h4 className="text-sm font-medium">
          {i18n.t('separator.story.sectionTwo', 'Section Two')}
        </h4>
        <p className="text-muted-foreground text-sm">
          {i18n.t('separator.story.contentForSectionTwo', 'Content for section two.')}
        </p>
      </div>
      <div className="flex h-5 items-center space-x-4 text-sm">
        <button className="focus:ring-ring rounded hover:underline focus:ring-2 focus:outline-none">
          Link One
        </button>
        <Separator
          orientation="vertical"
          decorative={false}
          aria-label={i18n.t('separator.story.linkDivider', 'Link divider')}
        />
        <button className="focus:ring-ring rounded hover:underline focus:ring-2 focus:outline-none">
          Link Two
        </button>
        <Separator
          orientation="vertical"
          decorative={false}
          aria-label={i18n.t('separator.story.linkDivider', 'Link divider')}
        />
        <button className="focus:ring-ring rounded hover:underline focus:ring-2 focus:outline-none">
          Link Three
        </button>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Find separators
    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBe(4);

    // Test that non-decorative separators have proper role
    const nonDecorativeSeparator = separators[0];
    expect(nonDecorativeSeparator?.getAttribute('role')).toBe('separator');

    // Test keyboard navigation skips separators
    const linkOne = canvas.getByRole('button', { name: 'Link One' });
    const linkTwo = canvas.getByRole('button', { name: 'Link Two' });

    await userEvent.tab();
    expect(doc.activeElement).toBe(linkOne);

    await userEvent.tab();
    expect(doc.activeElement).toBe(linkTwo);
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

// ============ ORIENTATION STORIES ============

export const OrientationHorizontalBasic: Story = {
  name: i18n.t(
    'separator.storyName.orientationHorizontalBasic',
    'Orientation - Horizontal (Basic)'
  ),
  render: () => (
    <div className="w-[400px] space-y-4">
      <p className="text-sm">
        {i18n.t(
          'separator.story.contentAboveTheHorizontalSeparator',
          'Content above the horizontal separator.'
        )}
      </p>
      <Separator orientation="horizontal" data-testid="horizontal-separator" />
      <p className="text-sm">
        {i18n.t(
          'separator.story.contentBelowTheHorizontalSeparator',
          'Content below the horizontal separator.'
        )}
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const separator = canvasElement.querySelector('[data-testid="horizontal-separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.getAttribute('data-orientation')).toBe('horizontal');
  },
};

export const OrientationVerticalBasic: Story = {
  name: i18n.t('separator.storyName.orientationVerticalBasic', 'Orientation - Vertical (Basic)'),
  render: () => (
    <div className="flex h-20 items-center gap-4">
      <span className="text-sm">{i18n.t('separator.story.leftContent', 'Left content')}</span>
      <Separator orientation="vertical" className="h-12" data-testid="vertical-separator" />
      <span className="text-sm">{i18n.t('separator.story.rightContent', 'Right content')}</span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const separator = canvasElement.querySelector('[data-testid="vertical-separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.getAttribute('data-orientation')).toBe('vertical');
  },
};

export const OrientationComparison: Story = {
  name: i18n.t(
    'separator.storyName.orientationComparison',
    'Orientation - Side by Side Comparison'
  ),
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('separator.story.horizontalOrientation', 'Horizontal Orientation')}
        </p>
        <div className="w-[400px] space-y-3">
          <p className="text-sm">Content section 1</p>
          <Separator orientation="horizontal" />
          <p className="text-sm">Content section 2</p>
          <Separator orientation="horizontal" />
          <p className="text-sm">Content section 3</p>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('separator.story.verticalOrientation', 'Vertical Orientation')}
        </p>
        <div className="flex items-center gap-4">
          <span className="text-sm">Item 1</span>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm">Item 2</span>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm">Item 3</span>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm">Item 4</span>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const horizontalSeparators = canvasElement.querySelectorAll('[data-orientation="horizontal"]');
    const verticalSeparators = canvasElement.querySelectorAll('[data-orientation="vertical"]');
    expect(horizontalSeparators).toHaveLength(2);
    expect(verticalSeparators).toHaveLength(3);
  },
};

export const OrientationInFlexRow: Story = {
  name: i18n.t('separator.storyName.orientationInFlexRow', 'Orientation - In Flex Row'),
  render: () => (
    <div className="flex items-center rounded-lg border p-4" data-testid="flex-row-container">
      <div className="flex-1 text-center">
        <p className="text-lg font-bold">123</p>
        <p className="text-muted-foreground text-xs">{i18n.t('separator.story.users', 'Users')}</p>
      </div>
      <Separator orientation="vertical" className="mx-4 h-12" />
      <div className="flex-1 text-center">
        <p className="text-lg font-bold">456</p>
        <p className="text-muted-foreground text-xs">
          {i18n.t('separator.story.projects', 'Projects')}
        </p>
      </div>
      <Separator orientation="vertical" className="mx-4 h-12" />
      <div className="flex-1 text-center">
        <p className="text-lg font-bold">789</p>
        <p className="text-muted-foreground text-xs">{i18n.t('separator.story.tasks', 'Tasks')}</p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="flex-row-container"]');
    expect(container).toBeInTheDocument();

    const verticalSeparators = container?.querySelectorAll('[data-orientation="vertical"]');
    expect(verticalSeparators).toHaveLength(2);
  },
};

export const OrientationInFlexColumn: Story = {
  name: i18n.t('separator.storyName.orientationInFlexColumn', 'Orientation - In Flex Column'),
  render: () => (
    <div className="flex w-[200px] flex-col rounded-lg border p-4" data-testid="flex-col-container">
      <div className="py-2 text-center">
        <p className="font-medium">Section 1</p>
        <p className="text-muted-foreground text-xs">Description for section 1</p>
      </div>
      <Separator orientation="horizontal" className="my-2" />
      <div className="py-2 text-center">
        <p className="font-medium">Section 2</p>
        <p className="text-muted-foreground text-xs">Description for section 2</p>
      </div>
      <Separator orientation="horizontal" className="my-2" />
      <div className="py-2 text-center">
        <p className="font-medium">Section 3</p>
        <p className="text-muted-foreground text-xs">Description for section 3</p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="flex-col-container"]');
    expect(container).toBeInTheDocument();

    const horizontalSeparators = container?.querySelectorAll('[data-orientation="horizontal"]');
    expect(horizontalSeparators).toHaveLength(2);
  },
};

export const OrientationDynamic: Story = {
  name: i18n.t('separator.storyName.orientationDynamic', 'Orientation - Dynamic Toggle'),
  render: function DynamicOrientation() {
    const [orientation, setOrientation] = React.useState<'horizontal' | 'vertical'>('horizontal');

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setOrientation('horizontal')}
            className={`rounded px-3 py-1 text-sm ${
              orientation === 'horizontal'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted border'
            }`}
            data-testid="btn-horizontal"
          >
            Horizontal
          </button>
          <button
            onClick={() => setOrientation('vertical')}
            className={`rounded px-3 py-1 text-sm ${
              orientation === 'vertical'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted border'
            }`}
            data-testid="btn-vertical"
          >
            Vertical
          </button>
        </div>

        <div
          className={`flex ${orientation === 'vertical' ? 'flex-row items-center gap-4' : 'w-[300px] flex-col gap-3'}`}
        >
          <span className="text-sm">{i18n.t('separator.story.contentA', 'Content A')}</span>
          <Separator
            orientation={orientation}
            className={orientation === 'vertical' ? 'h-6' : ''}
            data-testid="dynamic-separator"
          />
          <span className="text-sm">{i18n.t('separator.story.contentB', 'Content B')}</span>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const btnVertical = canvasElement.querySelector('[data-testid="btn-vertical"]');
    const separator = canvasElement.querySelector('[data-testid="dynamic-separator"]');

    expect(separator?.getAttribute('data-orientation')).toBe('horizontal');

    if (btnVertical instanceof HTMLButtonElement) {
      await userEvent.click(btnVertical);

      const updatedSeparator = canvasElement.querySelector('[data-testid="dynamic-separator"]');
      expect(updatedSeparator?.getAttribute('data-orientation')).toBe('vertical');
    }
  },
};

export const OrientationInBreadcrumbs: Story = {
  name: i18n.t('separator.storyName.orientationInBreadcrumbs', 'Orientation - In Breadcrumbs'),
  render: () => (
    <nav
      className="flex items-center text-sm"
      aria-label={i18n.t('separator.story.breadcrumb', 'Breadcrumb')}
    >
      <a href="/home" className="text-muted-foreground hover:text-foreground">
        Home
      </a>
      <Separator orientation="vertical" className="mx-2 h-4" decorative />
      <a href="/products" className="text-muted-foreground hover:text-foreground">
        Products
      </a>
      <Separator orientation="vertical" className="mx-2 h-4" decorative />
      <a href="/category" className="text-muted-foreground hover:text-foreground">
        Category
      </a>
      <Separator orientation="vertical" className="mx-2 h-4" decorative />
      <span className="text-foreground font-medium">
        {i18n.t('separator.story.currentItem', 'Current Item')}
      </span>
    </nav>
  ),
  play: async ({ canvasElement }) => {
    const separators = canvasElement.querySelectorAll('[data-orientation="vertical"]');
    expect(separators).toHaveLength(3);
  },
};

export const OrientationInPagination: Story = {
  name: i18n.t('separator.storyName.orientationInPagination', 'Orientation - In Pagination'),
  render: () => (
    <div className="flex items-center gap-1">
      <button className="hover:bg-muted rounded px-3 py-1 text-sm">
        {i18n.t('separator.story.previous', 'Previous')}
      </button>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <button className="hover:bg-muted rounded px-2 py-1 text-sm">1</button>
      <button className="hover:bg-muted rounded px-2 py-1 text-sm">2</button>
      <button className="bg-primary text-primary-foreground rounded px-2 py-1 text-sm">3</button>
      <button className="hover:bg-muted rounded px-2 py-1 text-sm">4</button>
      <button className="hover:bg-muted rounded px-2 py-1 text-sm">5</button>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <button className="hover:bg-muted rounded px-3 py-1 text-sm">
        {i18n.t('separator.story.next', 'Next')}
      </button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const separators = canvasElement.querySelectorAll('[data-orientation="vertical"]');
    expect(separators).toHaveLength(2);
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const WithFakerData: Story = {
  render: () => {
    const separators = createFakeSeparators(5);

    return (
      <div className="w-[420px] space-y-4" data-testid="faker-separator">
        {separators.map((sep) => (
          <div key={sep.id}>
            <div className="text-sm font-medium">{sep.orientation} separator</div>
            <Separator
              className={sep.className}
              decorative={sep.decorative}
              orientation={sep.orientation}
            />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="faker-separator"]');
    expect(container).toBeInTheDocument();

    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBe(5);
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: separatorHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING STORIES ============

// --- createFakeSeparator ---
function FakeSeparatorDemo() {
  const sep: FakeSeparator = createFakeSeparator();
  return (
    <div className="w-[420px] space-y-3" data-testid="fake-separator-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      <p className="text-muted-foreground text-xs">
        ID: {sep.id} | Orientation: {sep.orientation} | Decorative: {String(sep.decorative)}
      </p>
      <Separator
        className={sep.className}
        decorative={sep.decorative}
        orientation={sep.orientation}
      />
    </div>
  );
}

export const FactoryCreateFakeSeparator: Story = {
  name: i18n.t('separator.storyName.factoryCreateFakeSeparator', 'Factory - createFakeSeparator'),
  render: () => <FakeSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-separator-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
    expect(canvas.getByText(/ID:/)).toBeInTheDocument();
  },
};

// --- createFakeSeparatorInContext ---
function FakeSeparatorInContextDemo() {
  const sep: FakeSeparatorInContext = createFakeSeparatorInContext();
  return (
    <div className="w-[420px] space-y-3" data-testid="fake-separator-context-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      <p className="text-muted-foreground text-xs">
        Context: {sep.context} | Before: {sep.contentBefore} | After: {sep.contentAfter}
      </p>
      <div className="space-y-2">
        <span className="text-sm">{sep.contentBefore}</span>
        <Separator orientation={sep.orientation} decorative={sep.decorative} />
        <span className="text-sm">{sep.contentAfter}</span>
      </div>
    </div>
  );
}

export const FactoryCreateFakeSeparatorInContext: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeSeparatorInContext',
    'Factory - createFakeSeparatorInContext'
  ),
  render: () => <FakeSeparatorInContextDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-separator-context-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvas.getByText(/Context:/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

// --- createFakeHorizontalSeparator ---
function FakeHorizontalSeparatorDemo() {
  const sep = createFakeHorizontalSeparator();
  return (
    <div className="w-[420px] space-y-3" data-testid="fake-horizontal-demo">
      <p className="text-sm font-medium">{i18n.t('separator.a11y.horizontalLabel')}</p>
      <Separator
        className={sep.className}
        decorative={sep.decorative}
        orientation={sep.orientation}
      />
      <p className="text-muted-foreground text-xs">Thickness: {sep.thickness}</p>
    </div>
  );
}

export const FactoryCreateFakeHorizontalSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeHorizontalSeparator',
    'Factory - createFakeHorizontalSeparator'
  ),
  render: () => <FakeHorizontalSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-horizontal-demo"]');
    expect(container).toBeInTheDocument();
    const separator = canvasElement.querySelector('[data-slot="separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.getAttribute('data-orientation')).toBe('horizontal');
    expect(canvas.getByText(/Thickness:/)).toBeInTheDocument();
  },
};

// --- createFakeVerticalSeparator ---
function FakeVerticalSeparatorDemo() {
  const sep = createFakeVerticalSeparator();
  return (
    <div className="space-y-3" data-testid="fake-vertical-demo">
      <p className="text-sm font-medium">{i18n.t('separator.a11y.verticalLabel')}</p>
      <div className="flex items-center gap-4">
        <span className="text-sm">{i18n.t('separator.left')}</span>
        <Separator
          className={sep.className ?? 'h-6'}
          decorative={sep.decorative}
          orientation={sep.orientation}
        />
        <span className="text-sm">{i18n.t('separator.right')}</span>
      </div>
    </div>
  );
}

export const FactoryCreateFakeVerticalSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeVerticalSeparator',
    'Factory - createFakeVerticalSeparator'
  ),
  render: () => <FakeVerticalSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-vertical-demo"]');
    expect(container).toBeInTheDocument();
    const separator = canvasElement.querySelector('[data-slot="separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.getAttribute('data-orientation')).toBe('vertical');
    expect(canvas.getByText(/Left|左/)).toBeInTheDocument();
  },
};

// --- createFakeToolbarSeparator ---
function FakeToolbarSeparatorDemo() {
  const sep = createFakeToolbarSeparator();
  return (
    <div className="space-y-3" data-testid="fake-toolbar-sep-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      <div className="flex items-center gap-2 rounded-lg border p-2">
        <button type="button" className="hover:bg-muted rounded px-2 py-1 text-sm">
          Edit
        </button>
        <Separator
          className={sep.className ?? 'h-6'}
          decorative={sep.decorative}
          orientation={sep.orientation}
        />
        <button type="button" className="hover:bg-muted rounded px-2 py-1 text-sm">
          Save
        </button>
      </div>
      <p className="text-muted-foreground text-xs">Thickness: {sep.thickness}</p>
    </div>
  );
}

export const FactoryCreateFakeToolbarSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeToolbarSeparator',
    'Factory - createFakeToolbarSeparator'
  ),
  render: () => <FakeToolbarSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-toolbar-sep-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-orientation="vertical"]')).toBeInTheDocument();
    expect(canvas.getByText('Edit')).toBeInTheDocument();
    expect(canvas.getByText('Save')).toBeInTheDocument();
  },
};

// --- createFakeNavigationSeparator ---
function FakeNavigationSeparatorDemo() {
  const sep = createFakeNavigationSeparator();
  return (
    <div className="space-y-3" data-testid="fake-nav-sep-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.orientations')}</p>
      <nav className="flex items-center gap-3 text-sm">
        <a href="#home">{i18n.t('separator.story.home', 'Home')}</a>
        <Separator
          className={sep.className ?? 'h-4'}
          decorative={sep.decorative}
          orientation={sep.orientation}
        />
        <a href="#about">{i18n.t('separator.story.about', 'About')}</a>
      </nav>
    </div>
  );
}

export const FactoryCreateFakeNavigationSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeNavigationSeparator',
    'Factory - createFakeNavigationSeparator'
  ),
  render: () => <FakeNavigationSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-nav-sep-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-orientation="vertical"]')).toBeInTheDocument();
    expect(canvas.getByText('Home')).toBeInTheDocument();
    expect(canvas.getByText('About')).toBeInTheDocument();
  },
};

// --- createFakeSidebarSeparator ---
function FakeSidebarSeparatorDemo() {
  const sep = createFakeSidebarSeparator();
  return (
    <div className="w-[220px] space-y-3" data-testid="fake-sidebar-sep-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.decorative')}</p>
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm">{i18n.t('separator.story.dashboard', 'Dashboard')}</p>
        <Separator
          className={sep.className}
          decorative={sep.decorative}
          orientation={sep.orientation}
        />
        <p className="text-sm">{i18n.t('separator.story.settings', 'Settings')}</p>
      </div>
    </div>
  );
}

export const FactoryCreateFakeSidebarSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeSidebarSeparator',
    'Factory - createFakeSidebarSeparator'
  ),
  render: () => <FakeSidebarSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-sidebar-sep-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-orientation="horizontal"]')).toBeInTheDocument();
    expect(canvas.getByText('Dashboard')).toBeInTheDocument();
    expect(canvas.getByText('Settings')).toBeInTheDocument();
  },
};

// --- createFakeCardSeparator ---
function FakeCardSeparatorDemo() {
  const sep = createFakeCardSeparator();
  return (
    <div className="w-[300px] space-y-3" data-testid="fake-card-sep-demo">
      <p className="text-sm font-medium">{i18n.t('separator.story.description')}</p>
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">{i18n.t('separator.story.cardHeader', 'Card Header')}</p>
        <Separator
          className={sep.className}
          decorative={sep.decorative}
          orientation={sep.orientation}
        />
        <p className="text-muted-foreground text-sm">
          {i18n.t('separator.story.cardFooter', 'Card Footer')}
        </p>
      </div>
    </div>
  );
}

export const FactoryCreateFakeCardSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeCardSeparator',
    'Factory - createFakeCardSeparator'
  ),
  render: () => <FakeCardSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-card-sep-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
    expect(canvas.getByText('Card Header')).toBeInTheDocument();
    expect(canvas.getByText('Card Footer')).toBeInTheDocument();
  },
};

// --- createFakeFormSeparator ---
function FakeFormSeparatorDemo() {
  const sep = createFakeFormSeparator();
  return (
    <div className="w-[400px] space-y-3" data-testid="fake-form-sep-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium" htmlFor="form-sep-name">
            Name
          </label>
          <input
            id="form-sep-name"
            className="border-input mt-1 block w-full rounded border px-3 py-1.5 text-sm"
            defaultValue="John Doe"
            readOnly
          />
        </div>
        <Separator
          className={sep.className}
          decorative={sep.decorative}
          orientation={sep.orientation}
          aria-label={sep.ariaLabel}
        />
        <div>
          <label className="text-sm font-medium" htmlFor="form-sep-email">
            Email
          </label>
          <input
            id="form-sep-email"
            className="border-input mt-1 block w-full rounded border px-3 py-1.5 text-sm"
            defaultValue="john@example.com"
            readOnly
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Decorative: {String(sep.decorative)} | ARIA: {sep.ariaLabel ?? 'none'}
      </p>
    </div>
  );
}

export const FactoryCreateFakeFormSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeFormSeparator',
    'Factory - createFakeFormSeparator'
  ),
  render: () => <FakeFormSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-form-sep-demo"]');
    expect(container).toBeInTheDocument();
    const separator = canvasElement.querySelector('[data-slot="separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.getAttribute('role')).toBe('separator');
    expect(canvas.getByText(/ARIA:/)).toBeInTheDocument();
  },
};

// --- createFakeBreadcrumbSeparator ---
function FakeBreadcrumbSeparatorDemo() {
  const sep = createFakeBreadcrumbSeparator();
  return (
    <div className="space-y-3" data-testid="fake-breadcrumb-sep-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.orientations')}</p>
      <nav className="flex items-center text-sm">
        <span>{i18n.t('separator.story.home', 'Home')}</span>
        <Separator
          className={sep.className ?? 'mx-2 h-4'}
          decorative={sep.decorative}
          orientation={sep.orientation}
        />
        <span>{i18n.t('separator.story.products', 'Products')}</span>
        <Separator
          className={sep.className ?? 'mx-2 h-4'}
          decorative={sep.decorative}
          orientation={sep.orientation}
        />
        <span className="font-medium">{i18n.t('separator.story.current', 'Current')}</span>
      </nav>
    </div>
  );
}

export const FactoryCreateFakeBreadcrumbSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeBreadcrumbSeparator',
    'Factory - createFakeBreadcrumbSeparator'
  ),
  render: () => <FakeBreadcrumbSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-breadcrumb-sep-demo"]');
    expect(container).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-orientation="vertical"]');
    expect(separators.length).toBe(2);
    expect(canvas.getByText('Current')).toBeInTheDocument();
  },
};

// --- createFakeDecorativeSeparator ---
function FakeDecorativeSeparatorDemo() {
  const sep = createFakeDecorativeSeparator();
  return (
    <div className="w-[400px] space-y-3" data-testid="fake-decorative-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.decorative')}</p>
      <p className="text-sm">{i18n.t('separator.story.aboveSeparator', 'Above separator')}</p>
      <Separator decorative={sep.decorative} orientation={sep.orientation} />
      <p className="text-sm">{i18n.t('separator.story.belowSeparator', 'Below separator')}</p>
      <p className="text-muted-foreground text-xs">
        Decorative: {String(sep.decorative)} (role=none)
      </p>
    </div>
  );
}

export const FactoryCreateFakeDecorativeSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeDecorativeSeparator',
    'Factory - createFakeDecorativeSeparator'
  ),
  render: () => <FakeDecorativeSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-decorative-demo"]');
    expect(container).toBeInTheDocument();
    const separator = canvasElement.querySelector('[data-slot="separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.getAttribute('role')).toBe('none');
    expect(canvas.getByText(/Decorative: true/)).toBeInTheDocument();
  },
};

// --- createFakeSemanticSeparator ---
function FakeSemanticSeparatorDemo() {
  const sep = createFakeSemanticSeparator('Content section divider');
  return (
    <div className="w-[400px] space-y-3" data-testid="fake-semantic-demo">
      <p className="text-sm font-medium">{i18n.t('separator.a11y.label')}</p>
      <p className="text-sm">{i18n.t('separator.story.sectionA', 'Section A')}</p>
      <Separator
        decorative={sep.decorative}
        orientation={sep.orientation}
        aria-label={sep.ariaLabel}
      />
      <p className="text-sm">{i18n.t('separator.story.sectionB', 'Section B')}</p>
      <p className="text-muted-foreground text-xs">
        Decorative: {String(sep.decorative)} | ARIA label: {sep.ariaLabel}
      </p>
    </div>
  );
}

export const FactoryCreateFakeSemanticSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeSemanticSeparator',
    'Factory - createFakeSemanticSeparator'
  ),
  render: () => <FakeSemanticSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-semantic-demo"]');
    expect(container).toBeInTheDocument();
    const separator = canvasElement.querySelector('[data-slot="separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.getAttribute('role')).toBe('separator');
    expect(canvas.getByText(/ARIA label: Content section divider/)).toBeInTheDocument();
  },
};

// --- createFakeThickSeparator ---
function FakeThickSeparatorDemo() {
  const sep = createFakeThickSeparator();
  return (
    <div className="w-[400px] space-y-3" data-testid="fake-thick-demo">
      <p className="text-sm font-medium">{i18n.t('separator.sizes.thick')}</p>
      <Separator className={sep.className} decorative={sep.decorative} />
      <p className="text-muted-foreground text-xs">
        Thickness: {sep.thickness} | Class: {sep.className}
      </p>
    </div>
  );
}

export const FactoryCreateFakeThickSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeThickSeparator',
    'Factory - createFakeThickSeparator'
  ),
  render: () => <FakeThickSeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-thick-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
    expect(canvas.getByText(/Thickness: thick/)).toBeInTheDocument();
  },
};

// --- createFakeColoredSeparator + COLOR_CLASSES + SEPARATOR_COLORS + SeparatorColor ---
function FakeColoredSeparatorsDemo() {
  const colors: SeparatorColor[] = [...SEPARATOR_COLORS];
  return (
    <div className="w-[400px] space-y-4" data-testid="fake-colored-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      {colors.map((color) => {
        const sep = createFakeColoredSeparator(color);
        const colorClass = COLOR_CLASSES[color];
        return (
          <div key={color} className="space-y-1">
            <p className="text-xs">
              {color}: {colorClass}
            </p>
            <Separator className={colorClass} decorative={sep.decorative} />
          </div>
        );
      })}
    </div>
  );
}

export const FactoryCreateFakeColoredSeparator: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeColoredSeparator',
    'Factory - createFakeColoredSeparator'
  ),
  render: () => <FakeColoredSeparatorsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-colored-demo"]');
    expect(container).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBe(SEPARATOR_COLORS.length);
  },
};

// --- createFakeToolbarWithSeparators + FakeToolbarWithSeparators + FakeToolGroup + FakeToolItem ---
function FakeToolbarWithSeparatorsDemo() {
  const toolbar: FakeToolbarWithSeparators = createFakeToolbarWithSeparators(3);
  return (
    <div className="space-y-3" data-testid="fake-toolbar-compound-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      <div className="flex items-center gap-1 rounded-lg border p-2">
        {toolbar.groups.map((group: FakeToolGroup, gi: number) => (
          <React.Fragment key={`${group.label}-group-${group.items.map((i) => i.label).join('-')}`}>
            {gi > 0 && <Separator orientation="vertical" className="mx-1 h-6" />}
            <div className="flex items-center gap-1">
              {group.items.map((item: FakeToolItem) => (
                <button
                  key={item.label}
                  type="button"
                  className="hover:bg-muted rounded px-2 py-1 text-xs"
                  title={item.label}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeToolbarWithSeparators: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeToolbarWithSeparators',
    'Factory - createFakeToolbarWithSeparators'
  ),
  render: () => <FakeToolbarWithSeparatorsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-toolbar-compound-demo"]');
    expect(container).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-orientation="vertical"]');
    expect(separators.length).toBe(2);
  },
};

// --- createFakeNavigationWithSeparators + FakeNavigationWithSeparators + FakeNavItem ---
function FakeNavigationWithSeparatorsDemo() {
  const nav: FakeNavigationWithSeparators = createFakeNavigationWithSeparators(4);
  return (
    <div className="space-y-3" data-testid="fake-nav-compound-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.orientations')}</p>
      <nav className="flex items-center gap-2 text-sm">
        {nav.items.map((item: FakeNavItem, i: number) => (
          <React.Fragment key={item.label}>
            {i > 0 && <Separator orientation="vertical" className="h-4" />}
            <a
              href={item.href}
              className={item.active ? 'text-primary font-medium' : 'text-muted-foreground'}
            >
              {item.label}
            </a>
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
}

export const FactoryCreateFakeNavigationWithSeparators: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeNavigationWithSeparators',
    'Factory - createFakeNavigationWithSeparators'
  ),
  render: () => <FakeNavigationWithSeparatorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-nav-compound-demo"]');
    expect(container).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-orientation="vertical"]');
    expect(separators.length).toBe(3);
    expect(canvas.getByText('Home')).toBeInTheDocument();
  },
};

// --- createFakeSidebarWithSeparators + FakeSidebarWithSeparators + FakeSidebarGroup + FakeSidebarItem ---
function FakeSidebarWithSeparatorsDemo() {
  const sidebar: FakeSidebarWithSeparators = createFakeSidebarWithSeparators(2);
  return (
    <div className="w-[240px] space-y-3" data-testid="fake-sidebar-compound-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.decorative')}</p>
      <div className="rounded-lg border p-3">
        {sidebar.groups.map((group: FakeSidebarGroup, gi: number) => (
          <React.Fragment key={group.title ?? gi}>
            {gi > 0 && <Separator className="my-2" />}
            {group.title && (
              <p className="text-muted-foreground mb-1 text-xs font-medium">{group.title}</p>
            )}
            {group.items.map((item: FakeSidebarItem) => (
              <button
                key={item.label}
                type="button"
                className="hover:bg-muted block w-full rounded px-2 py-1 text-left text-sm"
              >
                {item.label}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeSidebarWithSeparators: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeSidebarWithSeparators',
    'Factory - createFakeSidebarWithSeparators'
  ),
  render: () => <FakeSidebarWithSeparatorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-sidebar-compound-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
    expect(canvas.getByText('Dashboard')).toBeInTheDocument();
    expect(canvas.getByText('Settings')).toBeInTheDocument();
  },
};

// --- createFakeCardWithSeparators + FakeCardWithSeparators ---
function FakeCardWithSeparatorsDemo() {
  const card: FakeCardWithSeparators = createFakeCardWithSeparators();
  return (
    <div className="w-[320px] space-y-3" data-testid="fake-card-compound-demo">
      <p className="text-sm font-medium">{i18n.t('separator.story.description')}</p>
      <div className="rounded-lg border p-4">
        <h3 className="font-semibold">{card.title}</h3>
        {card.description && <p className="text-muted-foreground text-sm">{card.description}</p>}
        <Separator className="my-3" />
        <div className="space-y-1">
          {card.footer.map((f) => (
            <div key={f.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="font-medium">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryCreateFakeCardWithSeparators: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeCardWithSeparators',
    'Factory - createFakeCardWithSeparators'
  ),
  render: () => <FakeCardWithSeparatorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-card-compound-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
    expect(canvas.getByText('Status')).toBeInTheDocument();
  },
};

// --- createFakeBreadcrumbWithSeparators + FakeBreadcrumbWithSeparators + FakeBreadcrumbItem ---
function FakeBreadcrumbWithSeparatorsDemo() {
  const breadcrumb: FakeBreadcrumbWithSeparators = createFakeBreadcrumbWithSeparators(4);
  return (
    <div className="space-y-3" data-testid="fake-breadcrumb-compound-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.orientations')}</p>
      <nav
        className="flex items-center text-sm"
        aria-label={i18n.t('separator.story.breadcrumb', 'Breadcrumb')}
      >
        {breadcrumb.items.map((item: FakeBreadcrumbItem, i: number) => (
          <React.Fragment key={item.label}>
            {i > 0 && <Separator orientation="vertical" className="mx-2 h-4" decorative />}
            {item.isCurrent ? (
              <span className="font-medium">{item.label}</span>
            ) : (
              <a href={item.href} className="text-muted-foreground hover:text-foreground">
                {item.label}
              </a>
            )}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
}

export const FactoryCreateFakeBreadcrumbWithSeparators: Story = {
  name: i18n.t(
    'separator.storyName.factoryCreateFakeBreadcrumbWithSeparators',
    'Factory - createFakeBreadcrumbWithSeparators'
  ),
  render: () => <FakeBreadcrumbWithSeparatorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="fake-breadcrumb-compound-demo"]');
    expect(container).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-orientation="vertical"]');
    expect(separators.length).toBe(3);
    expect(canvas.getByText('Home')).toBeInTheDocument();
    expect(canvas.getByText('Subcategory')).toBeInTheDocument();
  },
};

// --- createSeparatorOrientationMatrix + SEPARATOR_ORIENTATIONS + SeparatorOrientation ---
function OrientationMatrixDemo() {
  const matrix = createSeparatorOrientationMatrix();
  const orientations: SeparatorOrientation[] = [...SEPARATOR_ORIENTATIONS];
  return (
    <div className="space-y-4" data-testid="orientation-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.orientations')}</p>
      <p className="text-muted-foreground text-xs">
        Available orientations: {orientations.join(', ')}
      </p>
      {matrix.map((sep) => (
        <div key={sep.id} className="flex items-center gap-4">
          <span className="w-24 text-xs">{sep.orientation}</span>
          {sep.orientation === 'vertical' ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">{i18n.t('separator.story.labelA', 'A')}</span>
              <Separator orientation="vertical" className="h-6" />
              <span className="text-sm">{i18n.t('separator.story.labelB', 'B')}</span>
            </div>
          ) : (
            <div className="w-[200px]">
              <Separator orientation="horizontal" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export const FactoryOrientationMatrix: Story = {
  name: i18n.t(
    'separator.storyName.factoryOrientationMatrix',
    'Factory - createSeparatorOrientationMatrix'
  ),
  render: () => <OrientationMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="orientation-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBe(2);
    expect(canvas.getByText(/Available orientations:/)).toBeInTheDocument();
  },
};

// --- createSeparatorThicknessMatrix + SEPARATOR_THICKNESSES + THICKNESS_CLASSES + VERTICAL_THICKNESS_CLASSES + SeparatorThickness ---
function ThicknessMatrixDemo() {
  const matrix = createSeparatorThicknessMatrix();
  const thicknesses: SeparatorThickness[] = [...SEPARATOR_THICKNESSES];
  return (
    <div className="w-[400px] space-y-4" data-testid="thickness-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('separator.sizes.default')}</p>
      <p className="text-muted-foreground text-xs">Thicknesses: {thicknesses.join(', ')}</p>
      {matrix.map((sep) => {
        const hClass = THICKNESS_CLASSES[sep.thickness];
        const vClass = VERTICAL_THICKNESS_CLASSES[sep.thickness];
        return (
          <div key={sep.id} className="space-y-1">
            <p className="text-xs">
              {sep.thickness} (h: &quot;{hClass}&quot;, v: &quot;{vClass}&quot;)
            </p>
            <Separator className={hClass || undefined} />
          </div>
        );
      })}
    </div>
  );
}

export const FactoryThicknessMatrix: Story = {
  name: i18n.t(
    'separator.storyName.factoryThicknessMatrix',
    'Factory - createSeparatorThicknessMatrix'
  ),
  render: () => <ThicknessMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="thickness-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBe(3);
    expect(canvas.getByText(/Thicknesses:/)).toBeInTheDocument();
  },
};

// --- createSeparatorColorMatrix ---
function ColorMatrixDemo() {
  const matrix = createSeparatorColorMatrix();
  return (
    <div className="w-[400px] space-y-4" data-testid="color-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      {matrix.map((sep) => (
        <div key={sep.id} className="space-y-1">
          <p className="text-xs">{sep.color}</p>
          <Separator className={COLOR_CLASSES[sep.color]} />
        </div>
      ))}
    </div>
  );
}

export const FactoryColorMatrix: Story = {
  name: i18n.t('separator.storyName.factoryColorMatrix', 'Factory - createSeparatorColorMatrix'),
  render: () => <ColorMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="color-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBe(SEPARATOR_COLORS.length);
  },
};

// --- createSeparatorContextMatrix + SEPARATOR_CONTEXTS + SeparatorContext ---
function ContextMatrixDemo() {
  const matrix = createSeparatorContextMatrix();
  const contexts: SeparatorContext[] = [...SEPARATOR_CONTEXTS];
  return (
    <div className="w-[400px] space-y-4" data-testid="context-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      <p className="text-muted-foreground text-xs">Contexts: {contexts.join(', ')}</p>
      {matrix.map((sep) => (
        <div key={sep.id} className="space-y-1">
          <p className="text-xs">
            {sep.context}: {sep.contentBefore} → {sep.contentAfter}
          </p>
          {sep.orientation === 'vertical' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs">{sep.contentBefore}</span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-xs">{sep.contentAfter}</span>
            </div>
          ) : (
            <Separator orientation="horizontal" />
          )}
        </div>
      ))}
    </div>
  );
}

export const FactoryContextMatrix: Story = {
  name: i18n.t(
    'separator.storyName.factoryContextMatrix',
    'Factory - createSeparatorContextMatrix'
  ),
  render: () => <ContextMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="context-matrix-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvas.getByText(/Contexts:/)).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBe(SEPARATOR_CONTEXTS.length);
  },
};

// --- createSeparatorShowcase ---
function ShowcaseDemo() {
  const showcase = createSeparatorShowcase();
  return (
    <div className="w-[400px] space-y-4" data-testid="showcase-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      {showcase.map((item) => (
        <div key={item.name} className="space-y-1">
          <p className="text-xs font-medium">{item.name}</p>
          <p className="text-muted-foreground text-xs">{item.description}</p>
          {item.separator.orientation === 'vertical' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs">{i18n.t('separator.story.labelA', 'A')}</span>
              <Separator
                orientation="vertical"
                className={item.separator.className ?? 'h-6'}
                decorative={item.separator.decorative}
              />
              <span className="text-xs">{i18n.t('separator.story.labelB', 'B')}</span>
            </div>
          ) : (
            <Separator
              className={item.separator.className}
              decorative={item.separator.decorative}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('separator.storyName.factoryShowcase', 'Factory - createSeparatorShowcase'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="showcase-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvas.getByText('Horizontal')).toBeInTheDocument();
    expect(canvas.getByText('Vertical')).toBeInTheDocument();
    expect(canvas.getByText('Toolbar')).toBeInTheDocument();
    const separators = canvasElement.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBe(12);
  },
};

// --- createSeparatorTestData ---
function TestDataDemo() {
  const testData = createSeparatorTestData();
  return (
    <div className="w-[420px] space-y-4" data-testid="test-data-demo">
      <p className="text-sm font-medium">{i18n.t('separator.section.variants')}</p>
      <div className="space-y-2">
        <p className="text-xs font-medium">Separators ({testData.separators.length})</p>
        {testData.separators.map((sep) => (
          <Separator
            key={sep.id}
            className={sep.className}
            decorative={sep.decorative}
            orientation={sep.orientation}
          />
        ))}
      </div>
      <Separator className="my-2" />
      <div className="space-y-1">
        <p className="text-xs font-medium">
          Orientation Matrix ({testData.orientationMatrix.length})
        </p>
        <p className="text-xs font-medium">Thickness Matrix ({testData.thicknessMatrix.length})</p>
        <p className="text-xs font-medium">Color Matrix ({testData.colorMatrix.length})</p>
        <p className="text-xs font-medium">Context Matrix ({testData.contextMatrix.length})</p>
        <p className="text-xs font-medium">Showcase ({testData.showcase.length})</p>
      </div>
      <Separator className="my-2" />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span>Toolbar groups: {testData.toolbar.groups.length}</span>
        <span>Nav items: {testData.navigation.items.length}</span>
        <span>Sidebar groups: {testData.sidebar.groups.length}</span>
        <span>Card footer: {testData.card.footer.length}</span>
        <span>Breadcrumb items: {testData.breadcrumb.items.length}</span>
      </div>
    </div>
  );
}

export const FactoryTestData: Story = {
  name: i18n.t('separator.storyName.factoryTestData', 'Factory - createSeparatorTestData'),
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="test-data-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvas.getByText(/Separators \(5\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Orientation Matrix \(2\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Thickness Matrix \(3\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Color Matrix \(6\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Context Matrix \(7\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Showcase \(12\)/)).toBeInTheDocument();
  },
};

// --- SEPARATOR_STYLES + SeparatorStyle + VERTICAL_HEIGHTS + SPACING_CLASSES ---
function StylesAndSpacingDemo() {
  const { t } = useTranslation();
  const styles: SeparatorStyle[] = [...SEPARATOR_STYLES];
  const heights = [...VERTICAL_HEIGHTS];
  const spacings = [...SPACING_CLASSES];
  return (
    <div className="w-[420px] space-y-6" data-testid="styles-spacing-demo">
      <div>
        <p className="text-sm font-medium">{t('separator.section.variants')}</p>
        <p className="text-muted-foreground text-xs">Styles: {styles.join(', ')}</p>
        <div className="mt-2 space-y-3">
          {styles.map((style) => (
            <div key={style} className="space-y-1">
              <p className="text-xs">{style}</p>
              {style === 'solid' ? (
                <Separator />
              ) : (
                <div
                  className={`border-border w-full border-t ${style === 'dashed' ? 'border-dashed' : 'border-dotted'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <Separator className="my-2" />
      <div>
        <p className="text-sm font-medium">
          {t('separator.story.verticalHeights', 'Vertical Heights')}
        </p>
        <p className="text-muted-foreground text-xs">Options: {heights.join(', ')}</p>
        <div className="mt-2 flex items-end gap-3">
          {heights.slice(0, 5).map((h) => (
            <div key={h} className="flex flex-col items-center gap-1">
              <div className={`flex items-center ${h}`}>
                <Separator orientation="vertical" className={h} />
              </div>
              <span className="text-xs">{h}</span>
            </div>
          ))}
        </div>
      </div>
      <Separator className="my-2" />
      <div>
        <p className="text-sm font-medium">
          {t('separator.story.spacingClasses', 'Spacing Classes')}
        </p>
        <p className="text-muted-foreground text-xs">Options: {spacings.join(', ')}</p>
      </div>
    </div>
  );
}

export const FactoryStylesAndSpacing: Story = {
  name: i18n.t(
    'separator.storyName.factoryStylesAndSpacing',
    'Factory - Styles / Heights / Spacing'
  ),
  render: () => <StylesAndSpacingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="styles-spacing-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvas.getByText(/Styles:/)).toBeInTheDocument();
    expect(canvas.getByText(/Options: h-4/)).toBeInTheDocument();
    expect(canvas.getByText(/Options: my-1/)).toBeInTheDocument();
  },
};

// ============================================================================
// CROSS-CUTTING CONCERN STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('separator.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('separator.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('separator.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('separator.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('separator.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: separatorStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('separator.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: separatorStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('separator.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: separatorStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

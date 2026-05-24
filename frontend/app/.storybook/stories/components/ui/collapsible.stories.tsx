import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import type {
  CollapsibleAnimation,
  CollapsibleSize,
  CollapsibleState,
  CollapsibleTriggerVariant,
  FakeCodeSnippetCollapsible,
  FakeCollapsiblePanel,
  FakeCollapsibleSection,
  FakeCollapsibleWithMeta,
  FakeFaqItem,
  FakeNestedCollapsible,
  FakeSettingsSection,
} from '@/.storybook/stories/_factories/collapsible.factory';
import {
  CODE_LANGUAGES,
  COLLAPSIBLE_ANIMATIONS,
  COLLAPSIBLE_SIZES,
  COLLAPSIBLE_STATES,
  COLLAPSIBLE_TITLES,
  COLLAPSIBLE_TRIGGER_VARIANTS,
  createFakeAccordionGroup,
  createFakeCodeSnippetCollapsible,
  createFakeCollapsibleAllAnimations,
  createFakeCollapsibleCollapsed,
  createFakeCollapsibleDarkMode,
  createFakeCollapsibleDisabled,
  createFakeCollapsibleExpanded,
  createFakeCollapsibleKeyboardTestSections,
  createFakeCollapsibleMatrix,
  createFakeCollapsiblePanel,
  createFakeCollapsibleSection,
  createFakeCollapsibleSections,
  createFakeCollapsibleShowcase,
  createFakeCollapsibleTogglePair,
  createFakeCollapsibleWithAnimation,
  createFakeCollapsibleWithMeta,
  createFakeDocumentationPage,
  createFakeFaqByCategory,
  createFakeFaqItem,
  createFakeFaqItems,
  createFakeNestedCollapsible,
  createFakeProductDetails,
  createFakeSettingsSections,
  FAQ_CATEGORIES,
  SETTINGS_ICONS,
} from '@/.storybook/stories/_factories/collapsible.factory';
import {
  collapsibleHandlers,
  collapsibleStatusHandlers,
} from '@/.storybook/stories/_handlers/collapsible.handlers';
import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';

import { useTranslation } from 'react-i18next';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function CollapsibleDemo() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="w-[420px] space-y-3" data-testid="collapsible-demo">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t('collapsible.title')}</div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              {open ? t('collapsible.toggle.hide') : t('collapsible.toggle.show')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          {t('collapsible.content')}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Collapsible',
  component: CollapsibleDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onOpenChange: fn(),
  },
  argTypes: {
    // Content
    children: {
      control: false,
      description: i18n.t(
        'collapsible.argType.collapsibleContentCollapsibletriggerAndCollapsiblecontent',
        'Collapsible content (CollapsibleTrigger and CollapsibleContent)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    title: {
      control: 'text',
      description: i18n.t(
        'collapsible.argType.titleTextForTheCollapsibleSection',
        'Title text for the collapsible section'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    content: {
      control: 'text',
      description: i18n.t(
        'collapsible.argType.contentTextForTheCollapsibleSection',
        'Content text for the collapsible section'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('collapsible.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    animation: {
      control: 'select',
      options: ['none', 'slide', 'fade', 'scale'],
      description: i18n.t(
        'collapsible.argType.animationTypeWhenOpeningclosing',
        'Animation type when opening/closing'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'slide' },
        type: { summary: "'none' | 'slide' | 'fade' | 'scale'" },
      },
    },
    triggerVariant: {
      control: 'select',
      options: ['button', 'text', 'link', 'chevron', 'icon'],
      description: i18n.t(
        'collapsible.argType.visualVariantOfTheTrigger',
        'Visual variant of the trigger'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'button' },
        type: { summary: "'button' | 'text' | 'link' | 'chevron' | 'icon'" },
      },
    },
    // State
    open: {
      control: 'boolean',
      description: i18n.t('collapsible.argType.controlledOpenState', 'Controlled open state'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'collapsible.argType.defaultOpenStateForUncontrolledUsage',
        'Default open state for uncontrolled usage'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'collapsible.argType.whetherTheCollapsibleIsDisabled',
        'Whether the collapsible is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
      description: i18n.t(
        'collapsible.argType.sizeVariantOfTheCollapsible',
        'Size variant of the collapsible'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'default' },
        type: { summary: "'sm' | 'default' | 'lg'" },
      },
    },
    forceMount: {
      control: 'boolean',
      description: i18n.t(
        'collapsible.argType.forceContentToRenderEvenWhenClosed',
        'Force content to render even when closed'
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
      description: i18n.t('collapsible.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('collapsible.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('collapsible.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('collapsible.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('collapsible.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('collapsible.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('collapsible.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'collapsible.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
  },
  parameters: {
    msw: { handlers: [...collapsibleHandlers, ...formHandlers] },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof CollapsibleDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify collapsible structure
    expect(canvasElement.querySelector('[data-slot="collapsible"]')).toBeInTheDocument();

    const toggleButton = canvasElement.querySelector('[data-slot="collapsible-trigger"]');
    if (!(toggleButton instanceof HTMLButtonElement)) {
      throw new Error('Expected collapsible trigger to be a <button>.');
    }

    const title = canvasElement.querySelector('[data-slot="collapsible"] > div > div');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Expected collapsible title element to be present.');
    }

    expect(title.textContent?.trim()).toBeInTheDocument();
    expect(toggleButton.textContent?.trim()).toBeInTheDocument();

    // Verify initial collapsed state
    expect(
      canvasElement.querySelector('[data-slot="collapsible-content"]')
    ).not.toBeInTheDocument();

    const initialLabel = toggleButton.textContent ?? '';

    // ============ TEST EXPAND via Click ============
    await userEvent.click(toggleButton);

    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="collapsible-content"]')).toBeInTheDocument();
    });

    const nextLabel = toggleButton.textContent ?? '';
    expect(nextLabel.trim()).toBeInTheDocument();
    expect(nextLabel).not.toBe(initialLabel);

    // ============ TEST COLLAPSE via Click ============
    await userEvent.click(toggleButton);

    await waitFor(() => {
      expect(
        canvasElement.querySelector('[data-slot="collapsible-content"]')
      ).not.toBeInTheDocument();
    });

    // Label should return to initial state
    expect(toggleButton.textContent).toBe(initialLabel);
  },
};

export const Playground: Story = {
  ...Default,
  play: async (context) => {
    await Default.play?.(context);
  },
};

// ============ VARIANTS ============

export const Variants: Story = {
  name: i18n.t(
    'collapsible.storyName.variants',
    'Variants (default closed, default open, disabled)'
  ),
  render: () => {
    const DefaultClosed = () => {
      const { t } = useTranslation();
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <div className="text-muted-foreground mb-2 text-xs">
            {t('collapsible.story.defaultClosed', 'Default Closed')}
          </div>
          <Collapsible onOpenChange={setOpen} open={open}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {t('collapsible.story.collapsibleSection', 'Collapsible Section')}
              </div>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="outline">
                  {open ? t('collapsible.story.hide', 'Hide') : t('collapsible.story.show', 'Show')}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
              {t(
                'collapsible.story.hiddenContent',
                'This content starts hidden and can be revealed.'
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    };

    const DefaultOpen = () => {
      const [open, setOpen] = React.useState(true);
      return (
        <div>
          <div className="text-muted-foreground mb-2 text-xs">
            {i18n.t('collapsible.story.defaultOpen', 'Default Open')}
          </div>
          <Collapsible onOpenChange={setOpen} open={open}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {i18n.t('collapsible.story.expandedByDefault', 'Expanded by Default')}
              </div>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="outline">
                  {open
                    ? i18n.t('collapsible.story.hide', 'Hide')
                    : i18n.t('collapsible.story.show', 'Show')}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
              {i18n.t('collapsible.story.visibleByDefault', 'This content is visible by default.')}
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    };

    const Disabled = () => (
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('collapsible.story.disabled', 'Disabled')}
        </div>
        <Collapsible disabled>
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm font-medium">
              {i18n.t('collapsible.story.disabledSection', 'Disabled Section')}
            </div>
            <CollapsibleTrigger asChild>
              <Button disabled size="sm" variant="outline">
                {i18n.t('collapsible.story.show', 'Show')}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
            {i18n.t('collapsible.story.cannotBeToggled', 'This content cannot be toggled.')}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );

    return (
      <div className="flex flex-col gap-6">
        <DefaultClosed />
        <DefaultOpen />
        <Disabled />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="collapsible"]').length).toBe(3);

    // One should be open by default
    expect(canvasElement.querySelectorAll('[data-slot="collapsible-content"]').length).toBe(1);
  },
};

// ============ SIZES ============

export const Sizes: Story = {
  name: i18n.t('collapsible.storyName.sizes', 'Sizes (narrow content, default, wide content)'),
  render: () => {
    const NarrowContent = () => {
      const [open, setOpen] = React.useState(true);
      return (
        <div className="w-[250px]">
          <div className="text-muted-foreground mb-2 text-xs">
            {i18n.t('collapsible.story.narrowContent', 'Narrow Content (250px)')}
          </div>
          <Collapsible onOpenChange={setOpen} open={open}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {i18n.t('collapsible.story.narrow', 'Narrow')}
              </div>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="outline">
                  {open
                    ? i18n.t('collapsible.story.hide', 'Hide')
                    : i18n.t('collapsible.story.show', 'Show')}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
              {i18n.t(
                'collapsible.story.compactContent',
                'Compact content area for sidebar usage.'
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    };

    const DefaultContent = () => {
      const [open, setOpen] = React.useState(true);
      return (
        <div className="w-[420px]">
          <div className="text-muted-foreground mb-2 text-xs">
            {i18n.t('collapsible.story.defaultSize', 'Default (420px)')}
          </div>
          <Collapsible onOpenChange={setOpen} open={open}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {i18n.t('collapsible.story.defaultWidth', 'Default Width')}
              </div>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="outline">
                  {open
                    ? i18n.t('collapsible.story.hide', 'Hide')
                    : i18n.t('collapsible.story.show', 'Show')}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
              {i18n.t(
                'collapsible.story.standardContent',
                'Standard content area with comfortable reading width.'
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    };

    const WideContent = () => {
      const [open, setOpen] = React.useState(true);
      return (
        <div className="w-full">
          <div className="text-muted-foreground mb-2 text-xs">
            {i18n.t('collapsible.story.wideContentFullWidth', 'Wide Content (full width)')}
          </div>
          <Collapsible onOpenChange={setOpen} open={open}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {i18n.t('collapsible.story.fullWidth', 'Full Width')}
              </div>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="outline">
                  {open
                    ? i18n.t('collapsible.story.hide', 'Hide')
                    : i18n.t('collapsible.story.show', 'Show')}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
              {i18n.t(
                'collapsible.story.wideContent',
                'Wide content area that spans the full container width. Suitable for dashboard panels or full-width layouts.'
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-6">
        <NarrowContent />
        <DefaultContent />
        <WideContent />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="collapsible"]').length).toBe(3);
    // All should be open by default in this story
    expect(canvasElement.querySelectorAll('[data-slot="collapsible-content"]').length).toBe(3);
  },
};

// Dark mode demo component with i18n
function DarkModeCollapsible() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="w-[420px] space-y-3" data-testid="dark-mode-collapsible">
      <Collapsible onOpenChange={setOpen} open={open} data-testid="dark-collapsible">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t('collapsible.darkMode.title')}</div>
          <CollapsibleTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              aria-expanded={open}
              data-testid="dark-mode-trigger"
            >
              {open ? t('collapsible.toggle.hide') : t('collapsible.toggle.show')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent
          className="mt-2 rounded-md border p-3 text-sm"
          data-testid="dark-mode-content"
        >
          <p>{t('collapsible.darkMode.description')}</p>
          <p className="text-muted-foreground mt-2 text-xs">{t('collapsible.story.useKeyboard')}</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const Dark: Story = {
  render: () => <DarkModeCollapsible />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify dark mode collapsible renders
    expect(canvas.getByTestId('dark-mode-collapsible')).toBeInTheDocument();

    // Find and verify the trigger button
    const trigger = canvas.getByTestId('dark-mode-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // Click to expand
    await userEvent.click(trigger);

    // Verify content is now visible
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    const content = canvas.getByTestId('dark-mode-content');
    expect(content).toBeInTheDocument();

    // Click to collapse
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    await Default.play?.(context);

    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('詳細設定')).toBeInTheDocument();
    expect(
      canvas.getByText('このコンテンツは条件付きで表示され、アクセシブルなままです。')
    ).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: '非表示' })).toBeInTheDocument();
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
  name: i18n.t('collapsible.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

const AccessibleCollapsible = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="accessible-collapsible">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {i18n.t('collapsible.story.accessibleCollapsible', 'Accessible Collapsible')}
        </span>
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="outline" aria-expanded={open}>
            {open
              ? i18n.t('collapsible.story.hideContent', 'Hide Content')
              : i18n.t('collapsible.story.showContent', 'Show Content')}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
        <p>
          {i18n.t(
            'collapsible.story.thisCollapsibleContentIsAccessibleViaKey',
            'This collapsible content is accessible via keyboard.'
          )}
        </p>
        <Button size="sm" className="mt-2">
          Inner Button
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const Accessibility: Story = {
  render: () => <AccessibleCollapsible />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Find the trigger button
    const trigger = canvas.getByRole('button', { name: /Show Content/i });
    expect(trigger).toBeInTheDocument();

    // Test initial state - content should be hidden
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // Test keyboard navigation to trigger
    await userEvent.tab();
    expect(doc.activeElement).toBe(trigger);

    // Test keyboard activation with Enter
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    // Content should now be visible and inner button focusable
    const innerButton = canvas.getByRole('button', { name: 'Inner Button' });
    expect(innerButton).toBeInTheDocument();

    await userEvent.tab();
    expect(doc.activeElement).toBe(innerButton);

    // Test closing with Space
    trigger.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  },
};

// ============ KEYBOARD INTERACTION ============

function KeyboardInteractionCollapsible() {
  const [open, setOpen] = React.useState(false);
  const [interactionCount, setInteractionCount] = React.useState(0);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    setInteractionCount((c) => c + 1);
  };

  return (
    <div className="w-[420px] space-y-4" data-testid="keyboard-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('collapsible.story.tabToFocus')}</p>
      <Collapsible onOpenChange={handleOpenChange} open={open} data-testid="keyboard-collapsible">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{i18n.t('collapsible.section.basic')}</div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline" aria-expanded={open} data-testid="keyboard-trigger">
              {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')} (
              {interactionCount})
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          <p>{i18n.t('collapsible.story.useKeyboard')}</p>
          <Button size="sm" className="mt-2" data-testid="inner-focusable">
            Inner Focusable
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const KeyboardInteraction: Story = {
  name: i18n.t(
    'collapsible.storyName.keyboardInteraction',
    'Keyboard Interaction (Tab, Enter, Space)'
  ),
  render: () => <KeyboardInteractionCollapsible />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Get the trigger
    const trigger = canvas.getByTestId('keyboard-trigger');
    expect(trigger).toBeInTheDocument();

    // Initial state should be collapsed
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // ============ TEST TAB TO FOCUS ============
    await userEvent.tab();
    expect(doc.activeElement).toBe(trigger);

    // ============ TEST EXPAND via ENTER ============
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
    expect(trigger.textContent).toContain('(1)');

    // ============ TEST TAB TO INNER ELEMENT ============
    const innerButton = canvas.getByTestId('inner-focusable');
    await userEvent.tab();
    expect(doc.activeElement).toBe(innerButton);

    // ============ TEST COLLAPSE via SPACE ============
    trigger.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
    expect(trigger.textContent).toContain('(2)');

    // ============ TEST RAPID TOGGLE ============
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
    expect(trigger.textContent).toContain('(4)');
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleHandlers },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.loading },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.badRequest },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.unauthorized },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.forbidden },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.unprocessableEntity },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error500InternalServerError: Story = {
  ...Default,

  parameters: {
    msw: { handlers: collapsibleStatusHandlers.internalServerError },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.networkError },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

// ============ ANIMATION STORIES ============

function AnimatedCollapsible({
  duration = 300,
  easing = 'ease-out',
}: {
  duration?: number;
  easing?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="w-[420px]">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            {i18n.t('collapsible.story.animatedCollapsible', 'Animated Collapsible')}
          </div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline" data-testid="animation-trigger">
              {open
                ? i18n.t('collapsible.story.hide', 'Hide')
                : i18n.t('collapsible.story.show', 'Show')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent
          className="mt-2 overflow-hidden rounded-md border p-3 text-sm"
          style={{
            transition: `height ${duration}ms ${easing}, opacity ${duration}ms ${easing}`,
          }}
          data-testid="animated-content"
        >
          <p>
            This content animates smoothly with {duration}ms {easing} transition.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Animation duration and easing are customizable.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const AnimationDefault: Story = {
  name: i18n.t('collapsible.storyName.animationDefault', 'Animation - Default (300ms ease-out)'),
  render: () => <AnimatedCollapsible />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="animation-trigger"]');
    expect(trigger).toBeInTheDocument();

    if (trigger instanceof HTMLButtonElement) {
      // Open the collapsible
      await userEvent.click(trigger);

      await waitFor(() => {
        const content = canvasElement.querySelector('[data-testid="animated-content"]');
        expect(content).toBeInTheDocument();
      });
    }
  },
};

export const AnimationFast: Story = {
  name: i18n.t('collapsible.storyName.animationFast', 'Animation - Fast (150ms)'),
  render: () => <AnimatedCollapsible duration={150} easing="ease-in-out" />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="animation-trigger"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);

      await waitFor(() => {
        const content = canvasElement.querySelector('[data-testid="animated-content"]');
        expect(content).toBeInTheDocument();
      });
    }
  },
};

export const AnimationSlow: Story = {
  name: i18n.t('collapsible.storyName.animationSlow', 'Animation - Slow (500ms)'),
  render: () => <AnimatedCollapsible duration={500} easing="ease-in" />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="animation-trigger"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);

      await waitFor(
        () => {
          const content = canvasElement.querySelector('[data-testid="animated-content"]');
          expect(content).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    }
  },
};

export const AnimationSpring: Story = {
  name: i18n.t('collapsible.storyName.animationSpring', 'Animation - Spring Effect'),
  render: () => (
    <AnimatedCollapsible duration={400} easing="cubic-bezier(0.68, -0.55, 0.265, 1.55)" />
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="animation-trigger"]');
    expect(trigger).toBeInTheDocument();

    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);

      await waitFor(() => {
        const content = canvasElement.querySelector('[data-testid="animated-content"]');
        expect(content).toBeInTheDocument();
      });
    }
  },
};

function CollapsibleWithTransformAnimation() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="w-[420px]">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            {t('collapsible.story.transformAnimation', 'Transform Animation')}
          </div>
          <CollapsibleTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="transition-transform duration-200"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
              data-testid="rotate-trigger"
            >
              {open ? 'Close' : 'Open'}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent
          className="mt-2 overflow-hidden rounded-md border p-3 text-sm transition-all duration-300"
          style={{
            transform: open ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'top',
            opacity: open ? 1 : 0,
          }}
          data-testid="transform-content"
        >
          <p>
            {t(
              'collapsible.story.thisContentUsesScaleyTransformForASmooth',
              'This content uses scaleY transform for a smooth reveal effect.'
            )}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const AnimationTransform: Story = {
  name: i18n.t('collapsible.storyName.animationTransform', 'Animation - Transform (Scale)'),
  render: () => <CollapsibleWithTransformAnimation />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="rotate-trigger"]');
    expect(trigger).toBeInTheDocument();

    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(trigger.style.transform).toContain('rotate');
      });
    }
  },
};

function CollapsibleWithFadeAnimation() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="w-[420px]">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            {i18n.t('collapsible.story.fadeAnimation', 'Fade Animation')}
          </div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline" data-testid="fade-trigger">
              {open
                ? i18n.t('collapsible.story.fadeOut', 'Fade Out')
                : i18n.t('collapsible.story.fadeIn', 'Fade In')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent
          className="mt-2 rounded-md border p-3 text-sm"
          style={{
            animation: open ? 'fadeIn 300ms ease-out' : undefined,
          }}
          data-testid="fade-content"
        >
          <style>
            {`
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }

                to { opacity: 1; transform: translateY(0); }
              }
            `}
          </style>
          <p>
            {i18n.t(
              'collapsible.story.thisContentFadesInWithASubtleSlidedownEf',
              'This content fades in with a subtle slide-down effect.'
            )}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const AnimationFade: Story = {
  name: i18n.t('collapsible.storyName.animationFade', 'Animation - Fade with Slide'),
  render: () => <CollapsibleWithFadeAnimation />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="fade-trigger"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);

      await waitFor(() => {
        const content = canvasElement.querySelector('[data-testid="fade-content"]');
        expect(content).toBeInTheDocument();
      });
    }
  },
};

function CollapsibleAnimationShowcase() {
  const [all, setAll] = React.useState(false);

  return (
    <div className="w-[500px] space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {i18n.t('collapsible.story.animationShowcase', 'Animation Showcase')}
        </h3>
        <Button size="sm" onClick={() => setAll(!all)} data-testid="toggle-all">
          {all
            ? i18n.t('collapsible.story.collapseAll', 'Collapse All')
            : i18n.t('collapsible.story.expandAll', 'Expand All')}
        </Button>
      </div>

      <div className="space-y-2">
        <AnimatedCollapsible duration={200} easing="ease-out" />
      </div>
    </div>
  );
}

export const AnimationShowcase: Story = {
  name: i18n.t('collapsible.storyName.animationShowcase', 'Animation Showcase'),
  render: () => <CollapsibleAnimationShowcase />,
  play: async ({ canvasElement }) => {
    const toggleAllButton = canvasElement.querySelector('[data-testid="toggle-all"]');
    expect(toggleAllButton).toBeInTheDocument();

    // Verify the showcase structure renders
    expect(canvasElement.querySelector('[data-testid="animation-trigger"]')).toBeInTheDocument();
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.tooManyRequests },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.badGateway },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.serviceUnavailable },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.gatewayTimeout },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.slowResponse },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: collapsibleStatusHandlers.emptyContent },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

const WithFakerDataComponent = () => {
  const section = React.useMemo(() => createFakeCollapsibleSection({ defaultOpen: false }), []);
  const [open, setOpen] = React.useState(section.defaultOpen);

  return (
    <div className="w-[420px]">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{section.title}</div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              {open
                ? i18n.t('collapsible.story.hideDetails', 'Hide Details')
                : i18n.t('collapsible.story.showDetails', 'Show Details')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          <div className="space-y-2">
            <p>
              <strong>ID:</strong> {section.id}
            </p>
            <p>
              <strong>Content:</strong> {section.content}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export const WithFakerData: Story = {
  render: () => <WithFakerDataComponent />,
  play: async ({ canvasElement }) => {
    // Verify the component renders
    expect(canvasElement.querySelector('[data-slot="collapsible"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="collapsible-trigger"]');
    expect(trigger).toBeInTheDocument();

    // Verify content contains expected fields
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);

      await waitFor(() => {
        const content = canvasElement.querySelector('[data-slot="collapsible-content"]');
        expect(content).toBeInTheDocument();
        expect(content?.textContent).toContain('ID:');
        expect(content?.textContent).toContain('Content:');
      });
    }
  },
};

export const WithAsyncData: Story = {
  ...WithFakerData,
  parameters: {
    msw: { handlers: collapsibleHandlers },
  },
  play: async (context) => {
    await WithFakerData.play?.(context);
  },
};

// ============ DARK MODE JAPANESE ============

export const DarkModeJapanese: Story = {
  render: () => <DarkModeCollapsible />,
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Verify Japanese locale
    expect(doc.documentElement.lang).toBe('ja');

    // Verify dark mode collapsible renders with Japanese text
    const trigger = canvas.getByTestId('dark-mode-trigger');
    expect(trigger).toBeInTheDocument();

    // Expand and verify Japanese content
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    // Verify Japanese text is displayed
    expect(canvas.getByText('ダークモードの折りたたみ')).toBeInTheDocument();
  },
};

// ============ ARIA-EXPANDED VERIFICATION ============

function AriaExpandedDemo() {
  const [open1, setOpen1] = React.useState(false);
  const [open2, setOpen2] = React.useState(true);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Collapsible triggers use aria-expanded to indicate state to screen readers
      </p>

      <div className="w-[420px]">
        <Collapsible onOpenChange={setOpen1} open={open1} data-testid="aria-collapsed">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              {i18n.t('collapsible.story.initiallyCollapsed', 'Initially Collapsed')}
            </div>
            <CollapsibleTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                aria-expanded={open1}
                data-testid="aria-trigger-1"
              >
                {open1 ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
            <p>This section started collapsed (aria-expanded=false)</p>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="w-[420px]">
        <Collapsible onOpenChange={setOpen2} open={open2} data-testid="aria-expanded">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              {i18n.t('collapsible.story.initiallyExpanded', 'Initially Expanded')}
            </div>
            <CollapsibleTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                aria-expanded={open2}
                data-testid="aria-trigger-2"
              >
                {open2 ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
            <p>This section started expanded (aria-expanded=true)</p>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

export const AriaExpandedAttribute: Story = {
  name: i18n.t(
    'collapsible.storyName.ariaExpandedAttribute',
    'aria-expanded Attribute Verification'
  ),
  render: () => <AriaExpandedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // ============ TEST INITIAL ARIA-EXPANDED STATES ============
    const trigger1 = canvas.getByTestId('aria-trigger-1');
    const trigger2 = canvas.getByTestId('aria-trigger-2');

    // Verify initial states
    expect(trigger1.getAttribute('aria-expanded')).toBe('false');
    expect(trigger2.getAttribute('aria-expanded')).toBe('true');

    // ============ TEST TOGGLE UPDATES ARIA-EXPANDED ============

    // Toggle first (collapsed -> expanded)
    await userEvent.click(trigger1);
    await waitFor(() => {
      expect(trigger1.getAttribute('aria-expanded')).toBe('true');
    });

    // Toggle second (expanded -> collapsed)
    await userEvent.click(trigger2);
    await waitFor(() => {
      expect(trigger2.getAttribute('aria-expanded')).toBe('false');
    });

    // ============ TEST TOGGLE BACK ============

    // Toggle first back (expanded -> collapsed)
    await userEvent.click(trigger1);
    await waitFor(() => {
      expect(trigger1.getAttribute('aria-expanded')).toBe('false');
    });

    // Toggle second back (collapsed -> expanded)
    await userEvent.click(trigger2);
    await waitFor(() => {
      expect(trigger2.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

// ============ REUSABLE SUB-COMPONENTS FOR HOOKS IN MAP ============

function CollapsibleSectionItem({
  content,
  defaultOpen = false,
  disabled = false,
  title,
  variant = 'outline',
}: {
  content: React.ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  title: React.ReactNode;
  variant?: 'ghost' | 'link' | 'outline';
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible onOpenChange={setOpen} open={open} disabled={disabled}>
      <div className="flex items-center justify-between">
        {typeof title === 'string' ? <div className="text-sm font-medium">{title}</div> : title}
        <CollapsibleTrigger asChild>
          <Button size="sm" variant={variant} disabled={disabled}>
            {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
        {content}
      </CollapsibleContent>
    </Collapsible>
  );
}

function CollapsibleShowLessItem({
  content,
  defaultOpen = false,
  title,
}: {
  content: React.ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="ghost">
            {open ? i18n.t('collapsible.showLess') : i18n.t('collapsible.showMore')}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
        {content}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============ FACTORY: COLLAPSIBLE WITH META ============

function CollapsibleWithMetaItem({ item }: { item: FakeCollapsibleWithMeta }) {
  const [open, setOpen] = React.useState(item.defaultOpen);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">{item.title}</div>
          {item.subtitle && <div className="text-muted-foreground text-xs">{item.subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          {item.tag && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {item.tag}
            </span>
          )}
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
        {item.content}
      </CollapsibleContent>
    </Collapsible>
  );
}

function CollapsibleWithMetaDemo() {
  const { t } = useTranslation();
  const items = React.useMemo(
    () => Array.from({ length: 3 }, () => createFakeCollapsibleWithMeta()),
    []
  );

  return (
    <div className="w-[500px] space-y-4" data-testid="with-meta-demo">
      <h3 className="text-sm font-medium">{t('collapsible.moreOptions')}</h3>
      {items.map((item) => (
        <CollapsibleWithMetaItem key={item.id} item={item} />
      ))}
    </div>
  );
}

export const WithMetaData: Story = {
  name: i18n.t('collapsible.storyName.withMetaData', 'Factory: Collapsible With Meta'),
  render: () => <CollapsibleWithMetaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('with-meta-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(3);
  },
};

// ============ FACTORY: FAQ ITEM ============

function FaqItemDemo() {
  const faq = React.useMemo(() => createFakeFaqItem(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="w-[500px]" data-testid="faq-item-demo">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{(faq as FakeFaqItem).question}</div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              {open ? i18n.t('collapsible.showLess') : i18n.t('collapsible.showMore')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          <p>{faq.answer}</p>
          {faq.category && (
            <p className="text-muted-foreground mt-2 text-xs">Category: {faq.category}</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const FaqItem: Story = {
  name: i18n.t('collapsible.storyName.faqItem', 'Factory: FAQ Item'),
  render: () => <FaqItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('faq-item-demo')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-slot="collapsible-trigger"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(
          canvasElement.querySelector('[data-slot="collapsible-content"]')
        ).toBeInTheDocument();
      });
    }
  },
};

// ============ FACTORY: FAQ ITEMS (BULK) ============

function FaqItemsDemo() {
  const faqs = React.useMemo(() => createFakeFaqItems(5), []);

  return (
    <div className="w-[500px] space-y-3" data-testid="faq-items-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.details')}</h3>
      {faqs.map((faq) => (
        <CollapsibleSectionItem
          key={faq.id}
          title={faq.question}
          content={faq.answer}
          variant="ghost"
        />
      ))}
    </div>
  );
}

export const FaqItems: Story = {
  name: i18n.t('collapsible.storyName.faqItems', 'Factory: FAQ Items (Bulk)'),
  render: () => <FaqItemsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('faq-items-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(5);
  },
};

// ============ FACTORY: FAQ BY CATEGORY ============

function FaqByCategoryDemo() {
  const faqsByCategory = React.useMemo(() => createFakeFaqByCategory(), []);

  return (
    <div className="w-[600px] space-y-6" data-testid="faq-by-category-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.details')}</h3>
      {Object.entries(faqsByCategory).map(([category, faqs]) => (
        <div key={category} className="space-y-2">
          <h4 className="text-muted-foreground text-xs font-semibold uppercase">{category}</h4>
          {(faqs as FakeFaqItem[]).map((faq) => (
            <CollapsibleShowLessItem key={faq.id} title={faq.question} content={faq.answer} />
          ))}
        </div>
      ))}
    </div>
  );
}

export const FaqByCategory: Story = {
  name: i18n.t('collapsible.storyName.faqByCategory', 'Factory: FAQ By Category'),
  render: () => <FaqByCategoryDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('faq-by-category-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: COLLAPSIBLE PANEL ============

function CollapsiblePanelDemo() {
  const panel = React.useMemo(() => createFakeCollapsiblePanel(), []);
  const [open, setOpen] = React.useState(panel.open);

  return (
    <div className="w-[500px]" data-testid="panel-demo">
      <Collapsible
        onOpenChange={setOpen}
        open={open}
        disabled={(panel as FakeCollapsiblePanel).disabled}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{panel.header}</div>
            <div className="text-muted-foreground text-xs">
              Size: {panel.size} | Animation: {panel.animation}
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline" disabled={panel.disabled}>
              {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          <p>{panel.content}</p>
          {panel.footer && (
            <p className="text-muted-foreground mt-2 border-t pt-2 text-xs">{panel.footer}</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const PanelData: Story = {
  name: i18n.t('collapsible.storyName.panelData', 'Factory: Collapsible Panel'),
  render: () => <CollapsiblePanelDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('panel-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="collapsible"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: CODE SNIPPET COLLAPSIBLE ============

function CodeSnippetCollapsibleDemo() {
  const snippet = React.useMemo(() => createFakeCodeSnippetCollapsible(), []);
  const [open, setOpen] = React.useState(!snippet.collapsed);

  return (
    <div className="w-[600px]" data-testid="code-snippet-demo">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between rounded-t-md bg-gray-100 px-3 py-2 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">
              {(snippet as FakeCodeSnippetCollapsible).fileName}
            </span>
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs dark:bg-gray-700">
              {snippet.language}
            </span>
            <span className="text-muted-foreground text-xs">{snippet.lineCount} lines</span>
          </div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="ghost">
              {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="rounded-b-md border border-t-0 p-3">
          <pre className="overflow-x-auto text-xs">
            <code>{snippet.code}</code>
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const CodeSnippet: Story = {
  name: i18n.t('collapsible.storyName.codeSnippet', 'Factory: Code Snippet Collapsible'),
  render: () => <CodeSnippetCollapsibleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('code-snippet-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="collapsible"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: COLLAPSIBLE SECTIONS (BULK) ============

function CollapsibleSectionsDemo() {
  const sections = React.useMemo(() => createFakeCollapsibleSections(4), []);

  return (
    <div className="w-[500px] space-y-3" data-testid="sections-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.advancedSettings')}</h3>
      {sections.map((section) => (
        <CollapsibleSectionItem
          key={section.id}
          title={section.title}
          content={section.content}
          defaultOpen={section.defaultOpen}
          disabled={section.disabled}
        />
      ))}
    </div>
  );
}

export const SectionsBulk: Story = {
  name: i18n.t('collapsible.storyName.sectionsBulk', 'Factory: Collapsible Sections (Bulk)'),
  render: () => <CollapsibleSectionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('sections-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(4);
  },
};

// ============ FACTORY: NESTED COLLAPSIBLE ============

function NestedCollapsibleNode({ node }: { node: FakeNestedCollapsible }) {
  const [open, setOpen] = React.useState(node.defaultOpen);

  return (
    <div style={{ marginLeft: node.level * 16 }}>
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{node.title}</div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="ghost">
              {open ? '−' : '+'}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-1 rounded-md border p-2 text-sm">
          {node.content && <p>{node.content}</p>}
          {node.children?.map((child) => (
            <NestedCollapsibleNode key={child.id} node={child} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function NestedCollapsibleDemo() {
  const { t } = useTranslation();
  const nested = React.useMemo(() => createFakeNestedCollapsible(3, 2), []);

  return (
    <div className="w-[600px]" data-testid="nested-demo">
      <h3 className="mb-3 text-sm font-medium">{t('collapsible.section.nested')}</h3>
      <NestedCollapsibleNode node={nested} />
    </div>
  );
}

export const NestedCollapsible: Story = {
  name: i18n.t('collapsible.storyName.nestedCollapsible', 'Factory: Nested Collapsible'),
  render: () => <NestedCollapsibleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('nested-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: SETTINGS SECTIONS ============

function SettingsSectionItem({ section }: { section: FakeSettingsSection }) {
  const [open, setOpen] = React.useState(section.expanded);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>[{section.icon}]</span>
            {section.title}
          </div>
          <div className="text-muted-foreground text-xs">{section.description}</div>
        </div>
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="outline">
            {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
        <div className="space-y-3">
          {section.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div>
                <div className="text-sm">{item.label}</div>
                {item.description && (
                  <div className="text-muted-foreground text-xs">{item.description}</div>
                )}
              </div>
              <span className="text-muted-foreground text-xs">{String(item.value)}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SettingsSectionsDemo() {
  const { t } = useTranslation();
  const settings = React.useMemo(() => createFakeSettingsSections(4), []);

  return (
    <div className="w-[600px] space-y-4" data-testid="settings-demo">
      <h3 className="text-sm font-medium">{t('collapsible.advancedSettings')}</h3>
      {settings.map((section) => (
        <SettingsSectionItem key={section.id} section={section} />
      ))}
    </div>
  );
}

export const SettingsSections: Story = {
  name: i18n.t('collapsible.storyName.settingsSections', 'Factory: Settings Sections'),
  render: () => <SettingsSectionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('settings-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(4);
  },
};

// ============ FACTORY: ACCORDION GROUP ============

function AccordionGroupDemo() {
  const accordionData = React.useMemo(() => createFakeAccordionGroup(4), []);
  const [activeId, setActiveId] = React.useState<null | string>(accordionData.activeId);

  return (
    <div className="w-[500px] space-y-2" data-testid="accordion-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.details')}</h3>
      {accordionData.items.map((item: FakeCollapsibleSection) => {
        const isOpen = activeId === item.id;
        return (
          <Collapsible
            key={item.id}
            open={isOpen}
            onOpenChange={(open) => setActiveId(open ? item.id : null)}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{item.title}</div>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="ghost">
                  {isOpen ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-1 rounded-md border p-3 text-sm">
              {item.content}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

export const AccordionGroup: Story = {
  name: i18n.t('collapsible.storyName.accordionGroup', 'Factory: Accordion Group'),
  render: () => <AccordionGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('accordion-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(4);
    // At most one should be open (accordion behavior)
    const openContent = canvasElement.querySelectorAll('[data-slot="collapsible-content"]');
    expect(openContent.length).toBeLessThanOrEqual(1);
  },
};

// ============ FACTORY: DOCUMENTATION PAGE ============

function DocCodeSnippetItem({ snippet }: { snippet: FakeCodeSnippetCollapsible }) {
  const [open, setOpen] = React.useState(!snippet.collapsed);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <div className="flex items-center justify-between rounded-t-md bg-gray-100 px-3 py-2 dark:bg-gray-800">
        <span className="font-mono text-sm">{snippet.fileName}</span>
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="ghost">
            {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="rounded-b-md border border-t-0 p-3">
        <pre className="overflow-x-auto text-xs">
          <code>{snippet.code}</code>
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DocumentationPageDemo() {
  const { t } = useTranslation();
  const docPage = React.useMemo(() => createFakeDocumentationPage(), []);

  return (
    <div className="w-[700px] space-y-6" data-testid="doc-page-demo">
      <h2 className="text-lg font-semibold">{docPage.title}</h2>

      <div className="space-y-4">
        <h3 className="text-sm font-medium">{t('collapsible.details')}</h3>
        {docPage.sections.map((section) => (
          <CollapsibleSectionItem
            key={section.id}
            title={section.title}
            content={section.content}
            defaultOpen={section.defaultOpen}
          />
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium">
          {t('collapsible.story.codeExamples', 'Code Examples')}
        </h3>
        {docPage.codeExamples.map((snippet) => (
          <DocCodeSnippetItem key={snippet.id} snippet={snippet} />
        ))}
      </div>
    </div>
  );
}

export const DocumentationPage: Story = {
  name: i18n.t('collapsible.storyName.documentationPage', 'Factory: Documentation Page'),
  render: () => <DocumentationPageDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('doc-page-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: PRODUCT DETAILS ============

function ProductDetailItem({ section }: { section: FakeCollapsibleSection }) {
  const [open, setOpen] = React.useState(section.defaultOpen);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <div className="flex items-center justify-between border-b pb-1">
        <div className="text-sm font-medium">{section.title}</div>
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="ghost">
            {open ? i18n.t('collapsible.showLess') : i18n.t('collapsible.showMore')}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-2 text-sm whitespace-pre-line">
        {section.content}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProductDetailsDemo() {
  const { t } = useTranslation();
  const details = React.useMemo(() => createFakeProductDetails(), []);

  return (
    <div className="w-[500px] space-y-3" data-testid="product-details-demo">
      <h3 className="text-sm font-medium">{t('collapsible.details')}</h3>
      {details.map((section) => (
        <ProductDetailItem key={section.id} section={section} />
      ))}
    </div>
  );
}

export const ProductDetails: Story = {
  name: i18n.t('collapsible.storyName.productDetails', 'Factory: Product Details'),
  render: () => <ProductDetailsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('product-details-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(4);
    // First section (Product Description) should be open by default
    const openContent = canvasElement.querySelectorAll('[data-slot="collapsible-content"]');
    expect(openContent.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ FACTORY: COLLAPSIBLE MATRIX ============

function MatrixItem({
  item,
}: {
  item: {
    animation: CollapsibleAnimation;
    disabled: boolean;
    size: CollapsibleSize;
    state: CollapsibleState;
  };
}) {
  const [open, setOpen] = React.useState(item.state === 'open');

  return (
    <Collapsible onOpenChange={setOpen} open={open} disabled={item.disabled}>
      <div className="rounded-md border p-2">
        <div className="flex items-center justify-between">
          <div className="text-xs">
            {item.size} / {item.animation}
          </div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="ghost" disabled={item.disabled}>
              {open ? '\u2212' : '+'}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-1 text-xs">
          <p>State: {item.state}</p>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function CollapsibleMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createFakeCollapsibleMatrix(), []);

  return (
    <div className="w-[800px] space-y-4" data-testid="matrix-demo">
      <h3 className="text-sm font-medium">{t('collapsible.advancedSettings')}</h3>
      <div className="grid grid-cols-3 gap-3">
        {matrix.slice(0, 9).map((item) => (
          <MatrixItem key={`${item.state}-${item.animation}-${item.size}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export const MatrixView: Story = {
  name: i18n.t('collapsible.storyName.matrixView', 'Factory: Collapsible Matrix'),
  render: () => <CollapsibleMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('matrix-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(9);
  },
};

// ============ FACTORY: COLLAPSIBLE SHOWCASE ============

function CollapsibleShowcaseDemo() {
  const showcase = React.useMemo(() => createFakeCollapsibleShowcase(), []);

  return (
    <div className="w-[700px] space-y-6" data-testid="showcase-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.details')}</h3>

      <div>
        <h4 className="text-muted-foreground mb-2 text-xs">Simple ({showcase.simple.length})</h4>
        {showcase.simple.map((item: FakeCollapsibleSection) => (
          <div key={item.id} className="text-xs">
            {item.title}
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-muted-foreground mb-2 text-xs">FAQ ({showcase.faq.length})</h4>
        {showcase.faq.map((item: FakeFaqItem) => (
          <CollapsibleShowLessItem key={item.id} title={item.question} content={item.answer} />
        ))}
      </div>

      <div>
        <h4 className="text-muted-foreground mb-2 text-xs">Panels ({showcase.panels.length})</h4>
        {showcase.panels.map((panel: FakeCollapsiblePanel) => (
          <div key={panel.id} className="text-xs">
            {panel.header} ({panel.animation})
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-muted-foreground mb-2 text-xs">
          Settings ({showcase.settings.length})
        </h4>
        {showcase.settings.map((s: FakeSettingsSection) => (
          <div key={s.id} className="text-xs">
            {s.title} - {s.items.length} items
          </div>
        ))}
      </div>
    </div>
  );
}

export const ShowcaseAll: Story = {
  name: i18n.t('collapsible.storyName.showcaseAll', 'Factory: Collapsible Showcase'),
  render: () => <CollapsibleShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('showcase-demo')).toBeInTheDocument();
    // Verify showcase sections rendered
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: EXPANDED TEST HELPER ============

function CollapsibleExpandedDemo() {
  const section = React.useMemo(() => createFakeCollapsibleExpanded(), []);
  const [open, setOpen] = React.useState(section.defaultOpen);

  return (
    <div className="w-[500px]" data-testid="expanded-demo">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{section.title}</div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          {section.content}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const ExpandedTestHelper: Story = {
  name: i18n.t('collapsible.storyName.expandedTestHelper', 'Factory: Expanded (Test Helper)'),
  render: () => <CollapsibleExpandedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('expanded-demo')).toBeInTheDocument();
    // Should start open
    expect(canvasElement.querySelector('[data-slot="collapsible-content"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: COLLAPSED TEST HELPER ============

function CollapsibleCollapsedDemo() {
  const section = React.useMemo(() => createFakeCollapsibleCollapsed(), []);
  const [open, setOpen] = React.useState(section.defaultOpen);

  return (
    <div className="w-[500px]" data-testid="collapsed-demo">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{section.title}</div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          {section.content}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const CollapsedTestHelper: Story = {
  name: i18n.t('collapsible.storyName.collapsedTestHelper', 'Factory: Collapsed (Test Helper)'),
  render: () => <CollapsibleCollapsedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('collapsed-demo')).toBeInTheDocument();
    // Should start closed
    expect(
      canvasElement.querySelector('[data-slot="collapsible-content"]')
    ).not.toBeInTheDocument();
    // Click to open and verify
    const trigger = canvasElement.querySelector('[data-slot="collapsible-trigger"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(
          canvasElement.querySelector('[data-slot="collapsible-content"]')
        ).toBeInTheDocument();
      });
    }
  },
};

// ============ FACTORY: DISABLED TEST HELPER ============

function CollapsibleDisabledDemo() {
  const section = React.useMemo(() => createFakeCollapsibleDisabled(), []);
  const [open, setOpen] = React.useState(section.defaultOpen);

  return (
    <div className="w-[500px]" data-testid="disabled-demo">
      <p className="text-muted-foreground mb-2 text-xs">
        {i18n.t('collapsible.story.disabledNoToggle')}
      </p>
      <Collapsible onOpenChange={setOpen} open={open} disabled={section.disabled}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{section.title}</div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline" disabled={section.disabled}>
              {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          {section.content}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const DisabledTestHelper: Story = {
  name: i18n.t('collapsible.storyName.disabledTestHelper', 'Factory: Disabled (Test Helper)'),
  render: () => <CollapsibleDisabledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('disabled-demo')).toBeInTheDocument();
    // Should be disabled
    const trigger = canvasElement.querySelector('[data-slot="collapsible-trigger"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      expect(trigger.disabled).toBe(true);
    }
  },
};

// ============ FACTORY: TOGGLE PAIR ============

function TogglePairDemo() {
  const pair = React.useMemo(() => createFakeCollapsibleTogglePair(), []);

  return (
    <div className="w-[500px] space-y-4" data-testid="toggle-pair-demo">
      {pair.map((section) => (
        <CollapsibleSectionItem
          key={section.id}
          title={section.title}
          content={section.content}
          defaultOpen={section.defaultOpen}
        />
      ))}
    </div>
  );
}

export const TogglePair: Story = {
  name: i18n.t('collapsible.storyName.togglePair', 'Factory: Toggle Pair'),
  render: () => <TogglePairDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('toggle-pair-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(2);
    // First should be open, second should be closed
    const openContent = canvasElement.querySelectorAll('[data-slot="collapsible-content"]');
    expect(openContent.length).toBe(1);
  },
};

// ============ FACTORY: KEYBOARD TEST SECTIONS ============

function KeyboardTestSectionsDemo() {
  const sections = React.useMemo(() => createFakeCollapsibleKeyboardTestSections(3), []);

  return (
    <div className="w-[500px] space-y-3" data-testid="keyboard-test-demo">
      <p className="text-muted-foreground text-xs">{i18n.t('collapsible.story.tabToFocus')}</p>
      {sections.map((section) => (
        <CollapsibleSectionItem
          key={section.id}
          title={section.title}
          content={section.content}
          defaultOpen={section.defaultOpen}
        />
      ))}
    </div>
  );
}

export const KeyboardTestSections: Story = {
  name: i18n.t('collapsible.storyName.keyboardTestSections', 'Factory: Keyboard Test Sections'),
  render: () => <KeyboardTestSectionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('keyboard-test-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(3);
    // First section should be open
    const openContent = canvasElement.querySelectorAll('[data-slot="collapsible-content"]');
    expect(openContent.length).toBe(1);
  },
};

// ============ FACTORY: DARK MODE TEST HELPER ============

function DarkModeTestHelperDemo() {
  const section = React.useMemo(() => createFakeCollapsibleDarkMode(), []);
  const [open, setOpen] = React.useState(section.defaultOpen);

  return (
    <div className="w-[500px]" data-testid="dark-mode-test-demo">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {section.icon && <span className="text-sm">[{section.icon}]</span>}
            <div className="text-sm font-medium">{section.title}</div>
            {(section as FakeCollapsibleWithMeta).tag && (
              <span className="rounded bg-purple-100 px-1 py-0.5 text-xs dark:bg-purple-900">
                {section.tag}
              </span>
            )}
          </div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          <p>{section.content}</p>
          {section.subtitle && (
            <p className="text-muted-foreground mt-2 text-xs">{section.subtitle}</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const DarkModeTestHelper: Story = {
  name: i18n.t('collapsible.storyName.darkModeTestHelper', 'Factory: Dark Mode (Test Helper)'),
  render: () => <DarkModeTestHelperDemo />,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('dark-mode-test-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="collapsible"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: WITH ANIMATION ============

function WithAnimationDemo() {
  const panel = React.useMemo(() => createFakeCollapsibleWithAnimation('slide'), []);
  const [open, setOpen] = React.useState(panel.open);

  return (
    <div className="w-[500px]" data-testid="with-animation-demo">
      <p className="text-muted-foreground mb-2 text-xs">
        {i18n.t('collapsible.story.animationNote')}
      </p>
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{(panel as FakeCollapsiblePanel).header}</div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              {open ? i18n.t('collapsible.collapse') : i18n.t('collapsible.expand')}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
          {panel.content}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export const WithAnimation: Story = {
  name: i18n.t('collapsible.storyName.withAnimation', 'Factory: With Animation'),
  render: () => <WithAnimationDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('with-animation-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="collapsible"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: ALL ANIMATIONS ============

function AllAnimationsDemo() {
  const panels = React.useMemo(() => createFakeCollapsibleAllAnimations(), []);

  return (
    <div className="w-[500px] space-y-4" data-testid="all-animations-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.section.animated')}</h3>
      {panels.map((panel) => (
        <CollapsibleSectionItem
          key={panel.id}
          title={panel.header}
          content={panel.content}
          defaultOpen={panel.open}
        />
      ))}
    </div>
  );
}

export const AllAnimations: Story = {
  name: i18n.t('collapsible.storyName.allAnimations', 'Factory: All Animations'),
  render: () => <AllAnimationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('all-animations-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(4); // fade, none, scale, slide
  },
};

// ============ CONSTANTS: COLLAPSIBLE STATES ============

function CollapsibleStatesDemo() {
  return (
    <div className="w-[500px] space-y-4" data-testid="states-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.details')}</h3>
      {COLLAPSIBLE_STATES.map((state) => (
        <CollapsibleSectionItem
          key={state}
          title={`State: ${state}`}
          content={i18n.t('collapsible.defaultContent')}
          defaultOpen={state === 'open'}
        />
      ))}
    </div>
  );
}

export const StatesConstant: Story = {
  name: i18n.t('collapsible.storyName.statesConstant', 'Constant: Collapsible States'),
  render: () => <CollapsibleStatesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('states-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(COLLAPSIBLE_STATES.length);
  },
};

// ============ CONSTANTS: ANIMATIONS ============

function AnimationsConstantDemo() {
  return (
    <div className="w-[500px] space-y-3" data-testid="animations-constant-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.section.animated')}</h3>
      {COLLAPSIBLE_ANIMATIONS.map((animation) => (
        <CollapsibleSectionItem
          key={animation}
          title={`Animation: ${animation}`}
          content={i18n.t('collapsible.story.animationNote')}
        />
      ))}
    </div>
  );
}

export const AnimationsConstant: Story = {
  name: i18n.t('collapsible.storyName.animationsConstant', 'Constant: Animations'),
  render: () => <AnimationsConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('animations-constant-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(COLLAPSIBLE_ANIMATIONS.length);
  },
};

// ============ CONSTANTS: TRIGGER VARIANTS ============

function TriggerVariantsDemo() {
  return (
    <div className="w-[500px] space-y-3" data-testid="trigger-variants-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.section.customTrigger')}</h3>
      {COLLAPSIBLE_TRIGGER_VARIANTS.map((variant: CollapsibleTriggerVariant) => (
        <CollapsibleSectionItem
          key={variant}
          title={`Trigger: ${variant}`}
          content={i18n.t('collapsible.defaultContent')}
          variant={variant === 'link' ? 'link' : 'outline'}
        />
      ))}
    </div>
  );
}

export const TriggerVariantsConstant: Story = {
  name: i18n.t('collapsible.storyName.triggerVariantsConstant', 'Constant: Trigger Variants'),
  render: () => <TriggerVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('trigger-variants-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(COLLAPSIBLE_TRIGGER_VARIANTS.length);
  },
};

// ============ CONSTANTS: SIZES ============

function SizesConstantDemo() {
  return (
    <div className="w-[500px] space-y-3" data-testid="sizes-constant-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.details')}</h3>
      {COLLAPSIBLE_SIZES.map((size) => (
        <CollapsibleSectionItem
          key={size}
          title={`Size: ${size}`}
          content={i18n.t('collapsible.defaultContent')}
        />
      ))}
    </div>
  );
}

export const SizesConstant: Story = {
  name: i18n.t('collapsible.storyName.sizesConstant', 'Constant: Sizes'),
  render: () => <SizesConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('sizes-constant-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(COLLAPSIBLE_SIZES.length);
  },
};

// ============ CONSTANTS: COLLAPSIBLE TITLES ============

function CollapsibleTitlesDemo() {
  return (
    <div className="w-[500px] space-y-2" data-testid="titles-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.moreOptions')}</h3>
      {COLLAPSIBLE_TITLES.slice(0, 5).map((title) => (
        <CollapsibleShowLessItem
          key={title}
          title={title}
          content={i18n.t('collapsible.defaultContent')}
        />
      ))}
    </div>
  );
}

export const TitlesConstant: Story = {
  name: i18n.t('collapsible.storyName.titlesConstant', 'Constant: Collapsible Titles'),
  render: () => <CollapsibleTitlesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('titles-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(5);
  },
};

// ============ CONSTANTS: FAQ CATEGORIES ============

function FaqCategoriesDemo() {
  return (
    <div className="w-[500px] space-y-2" data-testid="faq-categories-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.details')}</h3>
      {FAQ_CATEGORIES.map((category) => (
        <CollapsibleSectionItem
          key={category}
          title={category}
          content={i18n.t('collapsible.defaultContent')}
          variant="ghost"
        />
      ))}
    </div>
  );
}

export const FaqCategoriesConstant: Story = {
  name: i18n.t('collapsible.storyName.faqCategoriesConstant', 'Constant: FAQ Categories'),
  render: () => <FaqCategoriesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('faq-categories-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(FAQ_CATEGORIES.length);
  },
};

// ============ CONSTANTS: SETTINGS ICONS ============

function SettingsIconsDemo() {
  return (
    <div className="w-[500px] space-y-2" data-testid="settings-icons-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.advancedSettings')}</h3>
      {SETTINGS_ICONS.map((icon) => (
        <CollapsibleSectionItem
          key={icon}
          title={
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>[{icon}]</span> {icon} Settings
            </div>
          }
          content={i18n.t('collapsible.defaultContent')}
          variant="ghost"
        />
      ))}
    </div>
  );
}

export const SettingsIconsConstant: Story = {
  name: i18n.t('collapsible.storyName.settingsIconsConstant', 'Constant: Settings Icons'),
  render: () => <SettingsIconsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('settings-icons-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(SETTINGS_ICONS.length);
  },
};

// ============ CONSTANTS: CODE LANGUAGES ============

function CodeLanguagesDemo() {
  return (
    <div className="w-[500px] space-y-2" data-testid="code-languages-demo">
      <h3 className="text-sm font-medium">{i18n.t('collapsible.details')}</h3>
      {CODE_LANGUAGES.map((lang) => (
        <CollapsibleSectionItem
          key={lang}
          title={<div className="font-mono text-sm font-medium">{lang}</div>}
          content={
            <pre className="text-xs">
              <code>{`// Example ${lang} code`}</code>
            </pre>
          }
          variant="ghost"
        />
      ))}
    </div>
  );
}

export const CodeLanguagesConstant: Story = {
  name: i18n.t('collapsible.storyName.codeLanguagesConstant', 'Constant: Code Languages'),
  render: () => <CodeLanguagesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('code-languages-demo')).toBeInTheDocument();
    const collapsibles = canvasElement.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles.length).toBe(CODE_LANGUAGES.length);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
//   analyticsSuccess
//   analyticsError
//   preferencesSuccess
//   preferencesDisabled
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: collapsibleStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: collapsibleStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: collapsibleStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerAnalyticsSuccess: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.handlerAnalyticsSuccess', 'Handler: Analytics Success'),
  parameters: { msw: { handlers: collapsibleStatusHandlers.analyticsSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerAnalyticsError: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.handlerAnalyticsError', 'Handler: Analytics Error'),
  parameters: { msw: { handlers: collapsibleStatusHandlers.analyticsError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerPreferencesSuccess: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.handlerPreferencesSuccess', 'Handler: Preferences Success'),
  parameters: { msw: { handlers: collapsibleStatusHandlers.preferencesSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerPreferencesDisabled: Story = {
  ...Default,
  name: i18n.t('collapsible.storyName.handlerPreferencesDisabled', 'Handler: Preferences Disabled'),
  parameters: { msw: { handlers: collapsibleStatusHandlers.preferencesDisabled } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

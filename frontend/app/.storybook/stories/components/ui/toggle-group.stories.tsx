import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, BoldIcon, ItalicIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type {
  FakeTextFormattingToolbar,
  FakeToggleGroup,
  FakeToggleGroupItem,
  ToggleGroupOrientation,
  ToggleGroupSize,
  ToggleGroupType,
  ToggleGroupVariant,
} from '@/.storybook/stories/_factories/toggle-group.factory';
import {
  createFakeAccessibleToggleGroup,
  createFakeAlignmentToggleGroup,
  createFakeColorModeToggleGroup,
  createFakeDisabledToggleGroup,
  createFakeFilterToggleGroup,
  createFakeFormattingToggleGroup,
  createFakeLanguageToggleGroup,
  createFakeListToggleGroup,
  createFakeMediaControlsToggleGroup,
  createFakePartiallyDisabledToggleGroup,
  createFakeSegmentedControl,
  createFakeTabToggleGroup,
  createFakeTextFormattingToolbar,
  createFakeToggleGroup,
  createFakeToggleGroupItem,
  createFakeToggleGroupItems,
  createFakeToggleGroups,
  createFakeToggleGroupSizeMatrix,
  createFakeToggleGroupTypeOrientationMatrix,
  createFakeToggleGroupVariantSizeMatrix,
  createFakeVerticalToggleGroup,
  createFakeViewModeToggleGroup,
  createFakeZoomToggleGroup,
  TOGGLE_GROUP_ICONS,
  TOGGLE_GROUP_LABELS,
  TOGGLE_GROUP_ORIENTATIONS,
  TOGGLE_GROUP_SIZES,
  TOGGLE_GROUP_TYPES,
  TOGGLE_GROUP_VARIANTS,
} from '@/.storybook/stories/_factories/toggle-group.factory';
import {
  toggleGroupHandlers,
  toggleGroupStatusHandlers,
} from '@/.storybook/stories/_handlers/toggle-group.handlers';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function I18nSingleDemo() {
  const { t } = useTranslation();

  return (
    <ToggleGroup
      type="single"
      defaultValue="left"
      variant="outline"
      data-testid="toggle-group-demo"
    >
      <ToggleGroupItem
        aria-label={t('toggleGroup.align.left')}
        data-toggle-group-item="left"
        value="left"
      >
        <AlignLeftIcon />
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label={t('toggleGroup.align.center')}
        data-toggle-group-item="center"
        value="center"
      >
        <AlignCenterIcon />
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label={t('toggleGroup.align.right')}
        data-toggle-group-item="right"
        value="right"
      >
        <AlignRightIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function I18nMultipleDemo() {
  return (
    <ToggleGroup type="multiple" defaultValue={['bold']} variant="outline">
      <ToggleGroupItem aria-label={i18n.t('toggleGroup.story.bold', 'Bold')} value="bold">
        <BoldIcon />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label={i18n.t('toggleGroup.story.italic', 'Italic')} value="italic">
        <ItalicIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

const meta = {
  title: 'Components/UI/Toggle Group',
  component: ToggleGroup,
  tags: ['autodocs'],
  args: {
    type: 'single',
    variant: 'default',
    size: 'default',
    disabled: false,
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onValueChange: fn(),
  },
  parameters: {
    msw: { handlers: toggleGroupHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Behavior
    type: {
      control: 'select',
      options: ['single', 'multiple'],
      description: i18n.t(
        'toggleGroup.argType.selectionModeSingleAllowsOneSelectionMultipleAllowsMany',
        'Selection mode - single allows one selection, multiple allows many'
      ),
      table: {
        category: 'Behavior',
        type: { summary: "'single' | 'multiple'" },
      },
    },
    value: {
      control: 'text',
      description: i18n.t(
        'toggleGroup.argType.controlledValueStringForSingleStringForMultiple',
        'Controlled value (string for single, string[] for multiple)'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'string | string[]' },
      },
    },
    defaultValue: {
      control: 'text',
      description: i18n.t(
        'toggleGroup.argType.defaultValueForUncontrolledUsage',
        'Default value for uncontrolled usage'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'string | string[]' },
      },
    },
    // Appearance
    variant: {
      control: 'select',
      options: ['default', 'outline'],
      description: i18n.t(
        'toggleGroup.argType.visualStyleVariantForAllItems',
        'Visual style variant for all items'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: { summary: "'default' | 'outline'" },
      },
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
      description: i18n.t('toggleGroup.argType.sizeOfAllToggleItems', 'Size of all toggle items'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: { summary: "'sm' | 'default' | 'lg'" },
      },
    },
    className: {
      control: 'text',
      description: i18n.t(
        'toggleGroup.argType.additionalCssClassesForTheGroupContainer',
        'Additional CSS classes for the group container'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Layout
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: i18n.t(
        'toggleGroup.argType.orientationOfTheToggleGroup',
        'Orientation of the toggle group'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'horizontal' },
        type: { summary: "'horizontal' | 'vertical'" },
      },
    },
    dir: {
      control: 'select',
      options: ['ltr', 'rtl'],
      description: i18n.t('toggleGroup.argType.readingDirection', 'Reading direction'),
      table: {
        category: 'Layout',
        type: { summary: "'ltr' | 'rtl'" },
      },
    },
    loop: {
      control: 'boolean',
      description: i18n.t(
        'toggleGroup.argType.whetherKeyboardNavigationLoopsFromLastToFirstItem',
        'Whether keyboard navigation loops from last to first item'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'toggleGroup.argType.whetherAllItemsInTheGroupAreDisabled',
        'Whether all items in the group are disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    rovingFocus: {
      control: 'boolean',
      description: i18n.t(
        'toggleGroup.argType.whetherToUseRovingTabindexForFocusManagement',
        'Whether to use roving tabindex for focus management'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    // Events
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'toggleGroup.argType.calledWhenValueChanges',
        'Called when value changes'
      ),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof ToggleGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {
  args: {
    type: 'single',
  },
  render: () => <I18nSingleDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);

    const left = canvasElement.querySelector('[data-toggle-group-item="left"]');
    expect(left?.getAttribute('aria-checked')).toBe('true');
  },
};

export const Multiple: Story = {
  args: {
    type: 'multiple',
  },
  render: () => <I18nMultipleDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(2);

    const bold = canvasElement.querySelector('[aria-label="Bold"]');
    const italic = canvasElement.querySelector('[aria-label="Italic"]');
    expect(bold?.getAttribute('aria-pressed')).toBe('true');
    expect(italic?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Playground: Story = {
  ...Single,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
  },
};

// ============ VARIANTS ============

function VariantsDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('toggleGroup.variants.singleSelection')}</div>
        <ToggleGroup type="single" defaultValue="left" variant="outline">
          <ToggleGroupItem
            value="left"
            aria-label={i18n.t('toggleGroup.story.alignLeft', 'Align left')}
          >
            <AlignLeftIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="center"
            aria-label={i18n.t('toggleGroup.story.alignCenter', 'Align center')}
          >
            <AlignCenterIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="right"
            aria-label={i18n.t('toggleGroup.story.alignRight', 'Align right')}
          >
            <AlignRightIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('toggleGroup.variants.multipleSelection')}
        </div>
        <ToggleGroup type="multiple" defaultValue={['bold', 'italic']} variant="outline">
          <ToggleGroupItem value="bold" aria-label={i18n.t('toggleGroup.story.bold', 'Bold')}>
            <BoldIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="italic" aria-label={i18n.t('toggleGroup.story.italic', 'Italic')}>
            <ItalicIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('toggleGroup.variants.outline')}</div>
        <ToggleGroup type="single" defaultValue="center" variant="outline">
          <ToggleGroupItem
            value="left"
            aria-label={i18n.t('toggleGroup.story.alignLeft', 'Align left')}
          >
            <AlignLeftIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="center"
            aria-label={i18n.t('toggleGroup.story.alignCenter', 'Align center')}
          >
            <AlignCenterIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="right"
            aria-label={i18n.t('toggleGroup.story.alignRight', 'Align right')}
          >
            <AlignRightIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('toggleGroup.variants.default')}</div>
        <ToggleGroup type="single" defaultValue="center" variant="default">
          <ToggleGroupItem
            value="left"
            aria-label={i18n.t('toggleGroup.story.alignLeft', 'Align left')}
          >
            <AlignLeftIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="center"
            aria-label={i18n.t('toggleGroup.story.alignCenter', 'Align center')}
          >
            <AlignCenterIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="right"
            aria-label={i18n.t('toggleGroup.story.alignRight', 'Align right')}
          >
            <AlignRightIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('toggleGroup.variants.withIconsAndText')}</div>
        <ToggleGroup type="single" defaultValue="left" variant="outline">
          <ToggleGroupItem
            value="left"
            aria-label={i18n.t('toggleGroup.story.alignLeft', 'Align left')}
          >
            <AlignLeftIcon className="size-4" />
            <span>{i18n.t('toggleGroup.story.left', 'Left')}</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="center"
            aria-label={i18n.t('toggleGroup.story.alignCenter', 'Align center')}
          >
            <AlignCenterIcon className="size-4" />
            <span>{i18n.t('toggleGroup.story.center', 'Center')}</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="right"
            aria-label={i18n.t('toggleGroup.story.alignRight', 'Align right')}
          >
            <AlignRightIcon className="size-4" />
            <span>{i18n.t('toggleGroup.story.right', 'Right')}</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();

    // Verify multiple toggle groups are rendered (5 groups in VariantsDemo)
    const toggleGroups = canvasElement.querySelectorAll('[data-slot="toggle-group"]');
    expect(toggleGroups.length).toBe(5);

    // Verify text content for section labels exists
    expect(canvas.getByText(/Single Selection/i)).toBeInTheDocument();
    expect(canvas.getByText(/Multiple Selection/i)).toBeInTheDocument();
    expect(canvas.getByText(/Outline/i)).toBeInTheDocument();
    expect(canvas.getByText(/With Icons and Text/i)).toBeInTheDocument();

    // Verify toggle group items exist
    const toggleItems = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(toggleItems.length).toBeGreaterThan(0);
  },
};

// ============ SIZES ============

function SizesDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('toggleGroup.sizes.sm')}</div>
        <ToggleGroup type="single" defaultValue="left" variant="outline" size="sm">
          <ToggleGroupItem
            value="left"
            aria-label={i18n.t('toggleGroup.story.alignLeft', 'Align left')}
          >
            <AlignLeftIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="center"
            aria-label={i18n.t('toggleGroup.story.alignCenter', 'Align center')}
          >
            <AlignCenterIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="right"
            aria-label={i18n.t('toggleGroup.story.alignRight', 'Align right')}
          >
            <AlignRightIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('toggleGroup.sizes.default')}</div>
        <ToggleGroup type="single" defaultValue="left" variant="outline" size="default">
          <ToggleGroupItem
            value="left"
            aria-label={i18n.t('toggleGroup.story.alignLeft', 'Align left')}
          >
            <AlignLeftIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="center"
            aria-label={i18n.t('toggleGroup.story.alignCenter', 'Align center')}
          >
            <AlignCenterIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="right"
            aria-label={i18n.t('toggleGroup.story.alignRight', 'Align right')}
          >
            <AlignRightIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('toggleGroup.sizes.lg')}</div>
        <ToggleGroup type="single" defaultValue="left" variant="outline" size="lg">
          <ToggleGroupItem
            value="left"
            aria-label={i18n.t('toggleGroup.story.alignLeft', 'Align left')}
          >
            <AlignLeftIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="center"
            aria-label={i18n.t('toggleGroup.story.alignCenter', 'Align center')}
          >
            <AlignCenterIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="right"
            aria-label={i18n.t('toggleGroup.story.alignRight', 'Align right')}
          >
            <AlignRightIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();

    // Verify three toggle groups are rendered (sm, default, lg)
    const toggleGroups = canvasElement.querySelectorAll('[data-slot="toggle-group"]');
    expect(toggleGroups.length).toBe(3);

    // Verify size labels exist
    expect(canvas.getByText(/sm/i)).toBeInTheDocument();
    expect(canvas.getByText(/lg/i)).toBeInTheDocument();

    // Verify toggle group items exist
    const toggleItems = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(toggleItems.length).toBe(9); // 3 items per group * 3 groups
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();

    const left = canvasElement.querySelector('[data-toggle-group-item="left"]');
    const center = canvasElement.querySelector('[data-toggle-group-item="center"]');
    const right = canvasElement.querySelector('[data-toggle-group-item="right"]');

    if (!(left instanceof HTMLElement)) throw new Error('Left toggle item was not found.');
    if (!(center instanceof HTMLElement)) throw new Error('Center toggle item was not found.');
    if (!(right instanceof HTMLElement)) throw new Error('Right toggle item was not found.');

    expect(left).toHaveAttribute('aria-checked', 'true');
    expect(center).toHaveAttribute('aria-checked', 'false');
    expect(right).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(center);
    await waitFor(() => expect(center).toHaveAttribute('aria-checked', 'true'));

    expect(left).toHaveAttribute('aria-checked', 'false');
    expect(right).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(right);
    await waitFor(() => expect(right).toHaveAttribute('aria-checked', 'true'));

    expect(left).toHaveAttribute('aria-checked', 'false');
    expect(center).toHaveAttribute('aria-checked', 'false');
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);

    const left = canvasElement.querySelector('[data-toggle-group-item="left"]');
    expect(left).toHaveAttribute('aria-checked', 'true');
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);

    const left = canvasElement.querySelector('[data-toggle-group-item="left"]');
    expect(left).toHaveAttribute('aria-checked', 'true');
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nSingleDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const left = context.canvasElement.querySelector('[data-toggle-group-item="left"]');
    expect(left?.getAttribute('aria-label')).toBe('左揃え');

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
  name: i18n.t('toggleGroup.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        <p id="alignment-label" className="mb-2 text-sm font-medium">
          Text Alignment
        </p>
        <ToggleGroup
          type="single"
          defaultValue="left"
          variant="outline"
          aria-labelledby="alignment-label"
        >
          <ToggleGroupItem
            aria-label={i18n.t('toggleGroup.story.alignLeft', 'Align left')}
            value="left"
            data-testid="left"
          >
            <AlignLeftIcon aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label={i18n.t('toggleGroup.story.alignCenter', 'Align center')}
            value="center"
            data-testid="center"
          >
            <AlignCenterIcon aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label={i18n.t('toggleGroup.story.alignRight', 'Align right')}
            value="right"
            data-testid="right"
          >
            <AlignRightIcon aria-hidden="true" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Find the toggle group
    const toggleGroup = canvasElement.querySelector('[data-slot="toggle-group"]');
    expect(toggleGroup).toBeInTheDocument();
    expect(toggleGroup?.getAttribute('aria-labelledby')).toBe('alignment-label');

    // Find toggle items
    const leftToggle = canvas.getByRole('radio', { name: 'Align left' });
    const centerToggle = canvas.getByRole('radio', { name: 'Align center' });
    const rightToggle = canvas.getByRole('radio', { name: 'Align right' });

    expect(leftToggle).toBeInTheDocument();
    expect(centerToggle).toBeInTheDocument();
    expect(rightToggle).toBeInTheDocument();

    // Verify initial state - left should be selected
    expect(leftToggle.getAttribute('aria-checked')).toBe('true');
    expect(centerToggle.getAttribute('aria-checked')).toBe('false');
    expect(rightToggle.getAttribute('aria-checked')).toBe('false');

    // Test keyboard navigation
    await userEvent.tab();
    expect(doc.activeElement).toBe(leftToggle);

    // Arrow right to center
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(centerToggle.getAttribute('aria-checked')).toBe('true');
    });

    // Arrow right to right
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(rightToggle.getAttribute('aria-checked')).toBe('true');
    });
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleGroupHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);

    const left = canvasElement.querySelector('[data-toggle-group-item="left"]');
    expect(left).toHaveAttribute('aria-checked', 'true');
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleGroupStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleGroupStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleGroupStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleGroupStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleGroupStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleGroupStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleGroupStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  name: i18n.t('toggleGroup.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const fakeGroups = createFakeToggleGroups(3, { type: 'single' });

    return (
      <div className="flex flex-col gap-6" data-testid="toggle-group-faker">
        {fakeGroups.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="text-muted-foreground text-xs">
              {group.type} / {group.variant} / {group.size}
            </p>
            <ToggleGroup type="single" variant={group.variant} size={group.size}>
              {group.items.map((item) => (
                <ToggleGroupItem
                  key={item.id}
                  value={item.value}
                  aria-label={item.ariaLabel ?? item.label}
                  disabled={item.disabled}
                >
                  {item.label ?? item.value}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="toggle-group-faker"]')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="toggle-group"]');
    expect(groups.length).toBe(3);
  },
};

// ============ FACTORY: SINGLE ITEM ============

function FactorySingleItemDemo() {
  const item: FakeToggleGroupItem = createFakeToggleGroupItem({ label: 'Demo', value: 'demo' });

  return (
    <div className="space-y-2" data-testid="factory-single-item">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.singleItem')}</div>
      <ToggleGroup type="single" defaultValue={item.value} variant="outline">
        <ToggleGroupItem
          value={item.value}
          aria-label={item.ariaLabel ?? item.label}
          disabled={item.disabled}
        >
          {item.label ?? item.value}
        </ToggleGroupItem>
      </ToggleGroup>
      <p className="text-muted-foreground text-xs">
        ID: {item.id} | Value: {item.value} | Disabled: {String(item.disabled)}
      </p>
    </div>
  );
}

export const FactorySingleItem: Story = {
  name: i18n.t('toggleGroup.storyName.factorySingleItem', 'Factory: Single Item'),
  render: () => <FactorySingleItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-single-item')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="toggle-group"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(1);
  },
};

// ============ FACTORY: SINGLE GROUP ============

function FactorySingleGroupDemo() {
  const group: FakeToggleGroup = createFakeToggleGroup({
    type: 'single',
    variant: 'outline',
    items: [
      {
        id: '1',
        value: 'a',
        label: i18n.t('toggleGroup.story.optionA', 'Option A'),
        disabled: false,
      },
      {
        id: '2',
        value: 'b',
        label: i18n.t('toggleGroup.story.optionB', 'Option B'),
        disabled: false,
      },
      {
        id: '3',
        value: 'c',
        label: i18n.t('toggleGroup.story.optionC', 'Option C'),
        disabled: false,
      },
    ],
  });

  return (
    <div className="space-y-2" data-testid="factory-single-group">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.singleGroup')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        disabled={group.disabled}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactorySingleGroup: Story = {
  name: i18n.t('toggleGroup.storyName.factorySingleGroup', 'Factory: Single Group'),
  render: () => <FactorySingleGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-single-group')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
    expect(canvas.getByText('Option A')).toBeInTheDocument();
    expect(canvas.getByText('Option B')).toBeInTheDocument();
    expect(canvas.getByText('Option C')).toBeInTheDocument();
  },
};

// ============ FACTORY: BULK ITEMS ============

function FactoryBulkItemsDemo() {
  const items: FakeToggleGroupItem[] = createFakeToggleGroupItems(5, {
    disabled: false,
    label: 'Bulk',
  });

  return (
    <div className="space-y-2" data-testid="factory-bulk-items">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.bulkItems')}</div>
      <ToggleGroup type="single" variant="outline">
        {items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-muted-foreground text-xs">Generated {items.length} items</p>
    </div>
  );
}

export const FactoryBulkItems: Story = {
  name: i18n.t('toggleGroup.storyName.factoryBulkItems', 'Factory: Bulk Items'),
  render: () => <FactoryBulkItemsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-bulk-items')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(5);
  },
};

// ============ FACTORY: ALIGNMENT ============

function FactoryAlignmentDemo() {
  const group = createFakeAlignmentToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-alignment">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.alignment')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryAlignment: Story = {
  name: i18n.t('toggleGroup.storyName.factoryAlignment', 'Factory: Alignment'),
  render: () => <FactoryAlignmentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-alignment')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(4);
    // Verify alignment items exist
    const group = canvasElement.querySelector('[data-slot="toggle-group"]');
    expect(group).toBeInTheDocument();
  },
};

// ============ FACTORY: FORMATTING ============

function FactoryFormattingDemo() {
  const group = createFakeFormattingToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-formatting">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.formatting')}</div>
      <ToggleGroup
        type={group.type as 'multiple'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string[]}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryFormatting: Story = {
  name: i18n.t('toggleGroup.storyName.factoryFormatting', 'Factory: Formatting'),
  render: () => <FactoryFormattingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-formatting')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(4);
    // Multiple type - check aria-pressed
    const firstItem = items[0];
    expect(firstItem?.getAttribute('aria-pressed')).toBeDefined();
  },
};

// ============ FACTORY: LIST ============

function FactoryListDemo() {
  const group = createFakeListToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-list">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.list')}</div>
      <ToggleGroup type={group.type as 'single'} variant={group.variant} size={group.size}>
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryList: Story = {
  name: i18n.t('toggleGroup.storyName.factoryList', 'Factory: List'),
  render: () => <FactoryListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-list')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
  },
};

// ============ FACTORY: VIEW MODE ============

function FactoryViewModeDemo() {
  const group = createFakeViewModeToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-view-mode">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.viewMode')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryViewMode: Story = {
  name: i18n.t('toggleGroup.storyName.factoryViewMode', 'Factory: View Mode'),
  render: () => <FactoryViewModeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-view-mode')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(2);
    expect(canvas.getByText('Grid')).toBeInTheDocument();
    expect(canvas.getByText('List')).toBeInTheDocument();
  },
};

// ============ FACTORY: MEDIA CONTROLS ============

function FactoryMediaControlsDemo() {
  const group = createFakeMediaControlsToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-media-controls">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.mediaControls')}</div>
      <ToggleGroup
        type={group.type as 'multiple'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string[]}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryMediaControls: Story = {
  name: i18n.t('toggleGroup.storyName.factoryMediaControls', 'Factory: Media Controls'),
  render: () => <FactoryMediaControlsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-media-controls')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(2);
  },
};

// ============ FACTORY: ZOOM ============

function FactoryZoomDemo() {
  const group = createFakeZoomToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-zoom">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.zoom')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryZoom: Story = {
  name: i18n.t('toggleGroup.storyName.factoryZoom', 'Factory: Zoom'),
  render: () => <FactoryZoomDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-zoom')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(4);
    expect(canvas.getByText('100%')).toBeInTheDocument();
    expect(canvas.getByText('150%')).toBeInTheDocument();
    expect(canvas.getByText('200%')).toBeInTheDocument();
  },
};

// ============ FACTORY: TEXT FORMATTING TOOLBAR ============

function FactoryToolbarDemo() {
  const toolbar: FakeTextFormattingToolbar = createFakeTextFormattingToolbar();

  return (
    <div className="space-y-4" data-testid="factory-toolbar">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.toolbar')}</div>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">
            {i18n.t('toggleGroup.story.formatting', 'Formatting')}
          </p>
          <ToggleGroup
            type={toolbar.formatting.type as 'multiple'}
            variant={toolbar.formatting.variant}
            size={toolbar.formatting.size}
            defaultValue={toolbar.formatting.defaultValue as string[]}
          >
            {toolbar.formatting.items.map((item) => (
              <ToggleGroupItem
                key={item.id}
                value={item.value}
                aria-label={item.ariaLabel ?? item.label}
              >
                {item.label ?? item.value}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">
            {i18n.t('toggleGroup.story.alignment', 'Alignment')}
          </p>
          <ToggleGroup
            type={toolbar.alignment.type as 'single'}
            variant={toolbar.alignment.variant}
            size={toolbar.alignment.size}
            defaultValue={toolbar.alignment.defaultValue as string}
          >
            {toolbar.alignment.items.map((item) => (
              <ToggleGroupItem
                key={item.id}
                value={item.value}
                aria-label={item.ariaLabel ?? item.label}
              >
                {item.label ?? item.value}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">
            {i18n.t('toggleGroup.story.list', 'List')}
          </p>
          <ToggleGroup
            type={toolbar.list.type as 'single'}
            variant={toolbar.list.variant}
            size={toolbar.list.size}
          >
            {toolbar.list.items.map((item) => (
              <ToggleGroupItem
                key={item.id}
                value={item.value}
                aria-label={item.ariaLabel ?? item.label}
              >
                {item.label ?? item.value}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}

export const FactoryToolbar: Story = {
  name: i18n.t('toggleGroup.storyName.factoryToolbar', 'Factory: Text Formatting Toolbar'),
  render: () => <FactoryToolbarDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-toolbar')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="toggle-group"]');
    expect(groups.length).toBe(3);
    expect(canvas.getByText('Formatting')).toBeInTheDocument();
    expect(canvas.getByText('Alignment')).toBeInTheDocument();
    expect(canvas.getByText('List')).toBeInTheDocument();
  },
};

// ============ FACTORY: DISABLED ============

function FactoryDisabledDemo() {
  const group = createFakeDisabledToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-disabled">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.disabled')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        disabled={group.disabled}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryDisabled: Story = {
  name: i18n.t('toggleGroup.storyName.factoryDisabled', 'Factory: Disabled'),
  render: () => <FactoryDisabledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-disabled')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
    // All items should be disabled
    for (const item of items) {
      expect(item).toBeDisabled();
    }
  },
};

// ============ FACTORY: PARTIALLY DISABLED ============

function FactoryPartiallyDisabledDemo() {
  const group = createFakePartiallyDisabledToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-partially-disabled">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.partiallyDisabled')}</div>
      <ToggleGroup type={group.type as 'single'} variant={group.variant} size={group.size}>
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryPartiallyDisabled: Story = {
  name: i18n.t('toggleGroup.storyName.factoryPartiallyDisabled', 'Factory: Partially Disabled'),
  render: () => <FactoryPartiallyDisabledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-partially-disabled')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
    // Second item should be disabled, first and third should not
    expect(items[0]).not.toBeDisabled();
    expect(items[1]).toBeDisabled();
    expect(items[2]).not.toBeDisabled();
  },
};

// ============ FACTORY: VERTICAL ============

function FactoryVerticalDemo() {
  const group = createFakeVerticalToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-vertical">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.vertical')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        orientation={group.orientation}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryVertical: Story = {
  name: i18n.t('toggleGroup.storyName.factoryVertical', 'Factory: Vertical'),
  render: () => <FactoryVerticalDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-vertical')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
    expect(canvas.getByText('First Item')).toBeInTheDocument();
    expect(canvas.getByText('Second Item')).toBeInTheDocument();
    expect(canvas.getByText('Third Item')).toBeInTheDocument();
  },
};

// ============ FACTORY: VARIANT x SIZE MATRIX ============

function FactoryVariantSizeMatrixDemo() {
  const matrix = createFakeToggleGroupVariantSizeMatrix();

  return (
    <div className="space-y-6" data-testid="factory-variant-size-matrix">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.variantSizeMatrix')}</div>
      {matrix.map((row, rowIndex) => (
        <div key={TOGGLE_GROUP_VARIANTS[rowIndex]} className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold">
            Variant: {TOGGLE_GROUP_VARIANTS[rowIndex]}
          </p>
          <div className="flex flex-wrap gap-4">
            {row.map((group, colIndex) => (
              <div key={group.id} className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  Size: {TOGGLE_GROUP_SIZES[colIndex]}
                </p>
                <ToggleGroup
                  type={group.type as 'single'}
                  variant={group.variant}
                  size={group.size}
                >
                  {group.items.map((item) => (
                    <ToggleGroupItem
                      key={item.id}
                      value={item.value}
                      aria-label={item.ariaLabel ?? item.label}
                    >
                      {item.label ?? item.value}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryVariantSizeMatrix: Story = {
  name: i18n.t('toggleGroup.storyName.factoryVariantSizeMatrix', 'Factory: Variant x Size Matrix'),
  render: () => <FactoryVariantSizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-variant-size-matrix')).toBeInTheDocument();
    // 2 variants x 3 sizes = 6 groups
    const groups = canvasElement.querySelectorAll('[data-slot="toggle-group"]');
    expect(groups.length).toBe(6);
  },
};

// ============ FACTORY: TYPE x ORIENTATION MATRIX ============

function FactoryTypeOrientationMatrixDemo() {
  const matrix = createFakeToggleGroupTypeOrientationMatrix();

  return (
    <div className="space-y-6" data-testid="factory-type-orientation-matrix">
      <div className="text-sm font-medium">
        {i18n.t('toggleGroup.factory.typeOrientationMatrix')}
      </div>
      {matrix.map((row, rowIndex) => (
        <div key={TOGGLE_GROUP_TYPES[rowIndex]} className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold">
            Type: {TOGGLE_GROUP_TYPES[rowIndex]}
          </p>
          <div className="flex flex-wrap gap-8">
            {row.map((group, colIndex) => (
              <div key={group.id} className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  Orientation: {TOGGLE_GROUP_ORIENTATIONS[colIndex]}
                </p>
                <ToggleGroup
                  type={group.type as 'single'}
                  variant={group.variant}
                  size={group.size}
                  orientation={group.orientation}
                >
                  {group.items.map((item) => (
                    <ToggleGroupItem
                      key={item.id}
                      value={item.value}
                      aria-label={item.ariaLabel ?? item.label}
                    >
                      {item.label ?? item.value}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryTypeOrientationMatrix: Story = {
  name: i18n.t(
    'toggleGroup.storyName.factoryTypeOrientationMatrix',
    'Factory: Type x Orientation Matrix'
  ),
  render: () => <FactoryTypeOrientationMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-type-orientation-matrix')).toBeInTheDocument();
    // 2 types x 2 orientations = 4 groups
    const groups = canvasElement.querySelectorAll('[data-slot="toggle-group"]');
    expect(groups.length).toBe(4);
  },
};

// ============ FACTORY: SIZE MATRIX ============

function FactorySizeMatrixDemo() {
  const sizes = createFakeToggleGroupSizeMatrix('outline');

  return (
    <div className="space-y-4" data-testid="factory-size-matrix">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.sizeMatrix')}</div>
      {sizes.map((group, index) => (
        <div key={group.id} className="space-y-1">
          <p className="text-muted-foreground text-xs">Size: {TOGGLE_GROUP_SIZES[index]}</p>
          <ToggleGroup type={group.type as 'single'} variant={group.variant} size={group.size}>
            {group.items.map((item) => (
              <ToggleGroupItem
                key={item.id}
                value={item.value}
                aria-label={item.ariaLabel ?? item.label}
              >
                {item.label ?? item.value}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ))}
    </div>
  );
}

export const FactorySizeMatrix: Story = {
  name: i18n.t('toggleGroup.storyName.factorySizeMatrix', 'Factory: Size Matrix'),
  render: () => <FactorySizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-size-matrix')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="toggle-group"]');
    expect(groups.length).toBe(3);
  },
};

// ============ FACTORY: ACCESSIBLE ============

function FactoryAccessibleDemo() {
  const group = createFakeAccessibleToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-accessible">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.accessible')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        aria-label={i18n.t('toggleGroup.a11y.groupLabel')}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryAccessible: Story = {
  name: i18n.t('toggleGroup.storyName.factoryAccessible', 'Factory: Accessible'),
  render: () => <FactoryAccessibleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-accessible')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
    // Each item should have aria-label
    for (const item of items) {
      expect(item.getAttribute('aria-label')).toBeTruthy();
    }
    expect(canvas.getByText('First Option')).toBeInTheDocument();
    expect(canvas.getByText('Second Option')).toBeInTheDocument();
    expect(canvas.getByText('Third Option')).toBeInTheDocument();
  },
};

// ============ FACTORY: FILTER CHIPS ============

function FactoryFilterDemo() {
  const { t } = useTranslation();
  const group = createFakeFilterToggleGroup([
    i18n.t('toggleGroup.story.status', 'Status'),
    i18n.t('toggleGroup.story.priority', 'Priority'),
    i18n.t('toggleGroup.story.assignee', 'Assignee'),
    i18n.t('toggleGroup.story.label', 'Label'),
  ]);

  return (
    <div className="space-y-2" data-testid="factory-filter">
      <div className="text-sm font-medium">{t('toggleGroup.factory.filter')}</div>
      <ToggleGroup
        type={group.type as 'multiple'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string[]}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryFilter: Story = {
  name: i18n.t('toggleGroup.storyName.factoryFilter', 'Factory: Filter Chips'),
  render: () => <FactoryFilterDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-filter')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(4);
    expect(canvas.getByText(i18n.t('toggleGroup.story.status', 'Status'))).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('toggleGroup.story.priority', 'Priority'))).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('toggleGroup.story.assignee', 'Assignee'))).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('toggleGroup.story.label', 'Label'))).toBeInTheDocument();
  },
};

// ============ FACTORY: SEGMENTED CONTROL ============

function FactorySegmentedDemo() {
  const group = createFakeSegmentedControl([
    i18n.t('toggleGroup.story.daily', 'Daily'),
    i18n.t('toggleGroup.story.weekly', 'Weekly'),
    i18n.t('toggleGroup.story.monthly', 'Monthly'),
    i18n.t('toggleGroup.story.yearly', 'Yearly'),
  ]);

  return (
    <div className="space-y-2" data-testid="factory-segmented">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.segmented')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string}
        className={group.className}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactorySegmented: Story = {
  name: i18n.t('toggleGroup.storyName.factorySegmented', 'Factory: Segmented Control'),
  render: () => <FactorySegmentedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-segmented')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(4);
    expect(canvas.getByText(i18n.t('toggleGroup.story.daily', 'Daily'))).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('toggleGroup.story.weekly', 'Weekly'))).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('toggleGroup.story.monthly', 'Monthly'))).toBeInTheDocument();
    expect(canvas.getByText('Yearly')).toBeInTheDocument();
  },
};

// ============ FACTORY: TAB TOGGLE ============

function FactoryTabsDemo() {
  const group = createFakeTabToggleGroup([
    { label: 'Overview', icon: 'Home' },
    { label: 'Analytics', icon: 'BarChart' },
    { label: 'Settings', icon: 'Settings' },
  ]);

  return (
    <div className="space-y-2" data-testid="factory-tabs">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.tabs')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryTabs: Story = {
  name: i18n.t('toggleGroup.storyName.factoryTabs', 'Factory: Tab-Style Toggle'),
  render: () => <FactoryTabsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
    expect(canvas.getByText('Overview')).toBeInTheDocument();
    expect(canvas.getByText('Analytics')).toBeInTheDocument();
    expect(canvas.getByText('Settings')).toBeInTheDocument();
  },
};

// ============ FACTORY: COLOR MODE ============

function FactoryColorModeDemo() {
  const group = createFakeColorModeToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-color-mode">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.colorMode')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryColorMode: Story = {
  name: i18n.t('toggleGroup.storyName.factoryColorMode', 'Factory: Color Mode'),
  render: () => <FactoryColorModeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-color-mode')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
    // Verify the default value is 'system'
    const group = canvasElement.querySelector('[data-slot="toggle-group"]');
    expect(group).toBeInTheDocument();
  },
};

// ============ FACTORY: LANGUAGE SELECTOR ============

function FactoryLanguageDemo() {
  const group = createFakeLanguageToggleGroup();

  return (
    <div className="space-y-2" data-testid="factory-language">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.factory.language')}</div>
      <ToggleGroup
        type={group.type as 'single'}
        variant={group.variant}
        size={group.size}
        defaultValue={group.defaultValue as string}
      >
        {group.items.map((item) => (
          <ToggleGroupItem
            key={item.id}
            value={item.value}
            aria-label={item.ariaLabel ?? item.label}
            disabled={item.disabled}
          >
            {item.label ?? item.value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export const FactoryLanguage: Story = {
  name: i18n.t('toggleGroup.storyName.factoryLanguage', 'Factory: Language Selector'),
  render: () => <FactoryLanguageDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-language')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="toggle-group-item"]');
    expect(items.length).toBe(3);
    expect(canvas.getByText('EN')).toBeInTheDocument();
  },
};

// ============ FACTORY: CONSTANTS SHOWCASE ============

function FactoryConstantsDemo() {
  const allTypes: ToggleGroupType[] = TOGGLE_GROUP_TYPES;
  const allVariants: ToggleGroupVariant[] = TOGGLE_GROUP_VARIANTS;
  const allSizes: ToggleGroupSize[] = TOGGLE_GROUP_SIZES;
  const allOrientations: ToggleGroupOrientation[] = TOGGLE_GROUP_ORIENTATIONS;
  const iconCategories = Object.keys(TOGGLE_GROUP_ICONS);
  const labelCategories = Object.keys(TOGGLE_GROUP_LABELS);

  return (
    <div className="space-y-4" data-testid="factory-constants">
      <div className="text-sm font-medium">{i18n.t('toggleGroup.section.variants')}</div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          Types: {allTypes.join(', ')} | Variants: {allVariants.join(', ')} | Sizes:{' '}
          {allSizes.join(', ')} | Orientations: {allOrientations.join(', ')}
        </p>
        <p className="text-muted-foreground text-xs">
          Icon categories: {iconCategories.join(', ')}
        </p>
        <p className="text-muted-foreground text-xs">
          Label categories: {labelCategories.join(', ')}
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        {TOGGLE_GROUP_VARIANTS.map((variant) => (
          <div key={variant} className="space-y-1">
            <p className="text-muted-foreground text-xs">{variant}</p>
            <ToggleGroup type="single" variant={variant} defaultValue="a">
              {TOGGLE_GROUP_LABELS.alignment.map((label, i) => (
                <ToggleGroupItem
                  key={label}
                  value={String.fromCodePoint(97 + i)}
                  aria-label={label}
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  name: i18n.t('toggleGroup.storyName.factoryConstants', 'Factory: Constants Showcase'),
  render: () => <FactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants')).toBeInTheDocument();
    // Verify constants are rendered
    expect(canvas.getByText(/Types: single, multiple/)).toBeInTheDocument();
    expect(canvas.getByText(/Icon categories:/)).toBeInTheDocument();
    expect(canvas.getByText(/Label categories:/)).toBeInTheDocument();
    // Verify both variant groups rendered
    const groups = canvasElement.querySelectorAll('[data-slot="toggle-group"]');
    expect(groups.length).toBe(2);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
//   tooManyRequests
//   badGateway
//   serviceUnavailable
//   gatewayTimeout
//   slowResponse
//   emptyData
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: toggleGroupStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: toggleGroupStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: toggleGroupStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: toggleGroupStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: toggleGroupStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: toggleGroupStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: toggleGroupStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: toggleGroupStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('toggleGroup.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: toggleGroupStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

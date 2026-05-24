import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  popoverHandlers,
  popoverStatusHandlers,
} from '@/.storybook/stories/_handlers/popover.handlers';
import {
  ALIGN_OFFSET_OPTIONS,
  createEnterprisePopoverShowcase,
  createFakeColorPickerPopover,
  createFakeControlledPopover,
  createFakeDatePickerPopover,
  createFakeEnterprisePopoverSet,
  createFakeFormPopover,
  createFakeInfoPopover,
  createFakeMenuPopover,
  createFakeNotificationPopover,
  createFakeOnboardingPopover,
  createFakePopover,
  createFakePopoverContent,
  createFakePopoverFormField,
  createFakePopoverFormFields,
  createFakePopoverListItem,
  createFakePopoverListItems,
  createFakePopovers,
  createFakePopoverTrigger,
  createFakeProfilePopover,
  createFakeSettingsPopover,
  createFakeSharePopover,
  createFakeTrackedPopover,
  createFakeUserPreviewPopover,
  createPopoverAlignMatrix,
  createPopoverContentTypeMatrix,
  createPopoverPositionMatrix,
  createPopoverShowcase,
  createPopoverSideMatrix,
  createPopoverTestData,
  createPopoverTriggerTypeMatrix,
  POPOVER_ALIGNS,
  POPOVER_CONTENT_TYPES,
  POPOVER_SIDES,
  POPOVER_STATES,
  POPOVER_TRIGGER_TYPES,
  POPOVER_WIDTH_OPTIONS,
  SIDE_OFFSET_OPTIONS,
} from '@/.storybook/stories/_factories/popover.factory';
import type {
  FakePopover,
  FakePopoverContent as FakePopoverContentType,
  FakePopoverFormField,
  FakePopoverListItem,
  FakePopoverTrigger,
  FakeTrackedPopover,
  PopoverAlign,
  PopoverContentType,
  PopoverSide,
  PopoverState,
  PopoverTrackingData,
  PopoverTriggerType,
} from '@/.storybook/stories/_factories/popover.factory';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function PopoverDemo({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button data-popover-trigger variant="outline">
          {t('popover.trigger')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-1">
            <div className="text-sm leading-none font-medium" data-popover-title>
              {t('popover.title')}
            </div>
            <div className="text-muted-foreground text-sm" data-popover-description>
              {t('popover.description')}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="width">{t('popover.widthLabel')}</Label>
            <Input defaultValue="100%" id="width" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const meta = {
  title: 'Components/UI/Popover',
  component: PopoverDemo,
  tags: ['autodocs'],
  args: {
    defaultOpen: false,
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onEscapeKeyDown: fn(),
  },
  argTypes: {
    // ─────────────────────────────────────────────────────────────────────────
    // CONTENT CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    children: {
      control: false,
      description: i18n.t(
        'popover.argType.popoverContentReactNode',
        'Popover content (React node)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // APPEARANCE CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: i18n.t(
        'popover.argType.preferredSideForPopoverPlacement',
        'Preferred side for popover placement'
      ),
      table: {
        category: 'Appearance',
        type: { summary: "'top' | 'right' | 'bottom' | 'left'" },
        defaultValue: { summary: "'bottom'" },
      },
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description: i18n.t(
        'popover.argType.alignmentRelativeToTrigger',
        'Alignment relative to trigger'
      ),
      table: {
        category: 'Appearance',
        type: { summary: "'start' | 'center' | 'end'" },
        defaultValue: { summary: "'center'" },
      },
    },
    sideOffset: {
      control: { type: 'number', min: 0, max: 32, step: 1 },
      description: i18n.t(
        'popover.argType.distanceFromTriggerInPixels',
        'Distance from trigger in pixels'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'number' },
        defaultValue: { summary: '4' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STATE CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'popover.argType.initialOpenStateOfThePopover',
        'Initial open state of the popover'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    open: {
      control: 'boolean',
      description: i18n.t('popover.argType.controlledOpenState', 'Controlled open state'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    modal: {
      control: 'boolean',
      description: i18n.t(
        'popover.argType.whetherToRenderInModalModeBlocksOutsideInteraction',
        'Whether to render in modal mode (blocks outside interaction)'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LAYOUT CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    className: {
      control: 'text',
      description: i18n.t(
        'popover.argType.additionalCssClassesForPopoverContent',
        'Additional CSS classes for popover content'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'string' },
      },
    },
    avoidCollisions: {
      control: 'boolean',
      description: i18n.t(
        'popover.argType.whetherPopoverRepositionsToAvoidViewportEdges',
        'Whether popover repositions to avoid viewport edges'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────────────────
    onClick: {
      action: 'onClick',
      description: i18n.t('popover.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('popover.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('popover.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('popover.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('popover.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('popover.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('popover.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'popover.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    onEscapeKeyDown: {
      action: 'onEscapeKeyDown',
      description: i18n.t(
        'popover.argType.calledWhenEscapeKeyIsPressed',
        'Called when Escape key is pressed'
      ),
      table: { category: 'Events' },
    },
    // Popover Props Reference (Radix Popover.Root):
    // - open: Controlled open state (boolean)
    // - defaultOpen: Default open state for uncontrolled usage (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - modal: Whether to block interaction outside (boolean, default: false)
    //
    // PopoverTrigger Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // PopoverContent Props Reference:
    // - side: Preferred side ('top' | 'right' | 'bottom' | 'left', default: 'bottom')
    // - sideOffset: Distance from trigger in pixels (number, default: 4)
    // - align: Alignment ('start' | 'center' | 'end', default: 'center')
    // - alignOffset: Alignment offset in pixels (number)
    // - avoidCollisions: Whether to avoid collisions (boolean, default: true)
    // - collisionBoundary: Boundary element(s) (Element | Element[] | null)
    // - collisionPadding: Padding for collision detection (number | Partial<Record<Side, number>>)
    // - sticky: Sticky behavior ('partial' | 'always', default: 'partial')
    // - hideWhenDetached: Hide when trigger is detached (boolean, default: false)
    // - forceMount: Force mount when closed (boolean)
    // - onOpenAutoFocus: Called on open with auto-focus ((event) => void)
    // - onCloseAutoFocus: Called on close with auto-focus ((event) => void)
    // - onEscapeKeyDown: Called on Escape key ((event) => void)
    // - onPointerDownOutside: Called on click outside ((event) => void)
    // - onFocusOutside: Called when focus moves outside ((event) => void)
    // - onInteractOutside: Called on interaction outside ((event) => void)
    // - className: Additional CSS classes (string)
    //
    // PopoverAnchor Props Reference:
    // - asChild: Render as child element (boolean)
    // - virtualRef: Virtual reference element (React.RefObject<Measurable>)
  },
  parameters: {
    msw: {
      handlers: popoverHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="popover"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-popover-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected popover trigger button to be present.');
    }
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    const trigger = canvasElement.querySelector('[data-popover-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected popover trigger button to be present.');
    }

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Popover content was not rendered.');
      }
      return node;
    });

    expect(content).toBeInTheDocument();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  },
};

export const Playground: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="popover"]')).toBeInTheDocument();
  },
};

function PopoverVariantsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('popover.variants.basic')}</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{t('popover.story.basicPopover', 'Basic Popover')}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <p className="text-sm">
              {t(
                'popover.story.simplePopoverDescription',
                'A simple popover with text content. Click outside or press Escape to close.'
              )}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('popover.variants.withForm')}</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              {t('popover.story.editDimensions', 'Edit Dimensions')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">
                  {t('popover.story.dimensions', 'Dimensions')}
                </h4>
                <p className="text-muted-foreground text-sm">
                  {t(
                    'popover.story.setTheDimensionsForTheLayer',
                    'Set the dimensions for the layer.'
                  )}
                </p>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="width-form">{t('popover.story.width', 'Width')}</Label>
                  <Input className="col-span-2" defaultValue="100%" id="width-form" />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="height-form">{t('popover.story.height', 'Height')}</Label>
                  <Input className="col-span-2" defaultValue="auto" id="height-form" />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="maxwidth-form">{t('popover.story.maxWidth', 'Max Width')}</Label>
                  <Input className="col-span-2" defaultValue="none" id="maxwidth-form" />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('popover.variants.withRichContent')}</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{t('popover.story.viewDetails', 'View Details')}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {t('popover.story.projectStatus', 'Project Status')}
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                  In Progress
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('popover.story.progress', 'Progress')}
                  </span>
                  <span>65%</span>
                </div>
                <div className="bg-secondary h-2 rounded-full">
                  <div className="bg-primary h-2 w-[65%] rounded-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    {t('popover.story.startDate', 'Start Date')}
                  </span>
                  <p>Jan 15, 2024</p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t('popover.story.dueDate', 'Due Date')}
                  </span>
                  <p>Mar 30, 2024</p>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('popover.variants.differentAlignments')}</p>
        <div className="flex gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Align Start
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48">
              <p className="text-sm">{t('popover.story.alignedToStart', 'Aligned to start')}</p>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Align Center
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-48">
              <p className="text-sm">{t('popover.story.alignedToCenter', 'Aligned to center')}</p>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Align End
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <p className="text-sm">{t('popover.story.alignedToEnd', 'Aligned to end')}</p>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  tags: ['!test'],
  render: () => <PopoverVariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function PopoverSizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('popover.sizes.compact')}</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{t('popover.story.compact', 'Compact')}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <p className="text-sm">
              {t(
                'popover.story.compactPopoverDescription',
                'A compact popover for brief messages or confirmations.'
              )}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('popover.sizes.default')}</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{t('popover.story.default', 'Default')}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">
                  {t('popover.story.settings', 'Settings')}
                </h4>
                <p className="text-muted-foreground text-sm">
                  Configure your preferences for this component.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name-default">{t('popover.story.name', 'Name')}</Label>
                <Input defaultValue="My Component" id="name-default" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('popover.sizes.wide')}</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{t('popover.story.wide', 'Wide')}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-96">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">
                  {t('popover.story.advancedConfiguration', 'Advanced Configuration')}
                </h4>
                <p className="text-muted-foreground text-sm">
                  {t(
                    'popover.story.advancedSettingsDescription',
                    'These settings control the advanced behavior of the component. Make changes carefully.'
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="min-wide">{t('popover.story.minimum', 'Minimum')}</Label>
                  <Input defaultValue="0" id="min-wide" type="number" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="max-wide">{t('popover.story.maximum', 'Maximum')}</Label>
                  <Input defaultValue="100" id="max-wide" type="number" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description-wide">
                  {t('popover.story.description', 'Description')}
                </Label>
                <Input defaultValue="Enter a detailed description here" id="description-wide" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  tags: ['!test'],
  render: () => <PopoverSizesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    expect(canvasElement.querySelector('[data-slot="popover"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-popover-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected popover trigger button to be present.');
    }
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');

    expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(doc.activeElement).toBe(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Popover content was not rendered.');
      }
      return node;
    });

    const title = content.querySelector('[data-popover-title]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Popover title was not rendered.');
    }
    expect(title.textContent?.trim()).not.toBe('');

    const description = content.querySelector('[data-popover-description]');
    if (!(description instanceof HTMLElement)) {
      throw new Error('Popover description was not rendered.');
    }
    expect(description.textContent?.trim()).not.toBe('');

    const widthLabel = content.querySelector('label[for="width"]');
    if (!(widthLabel instanceof HTMLElement)) {
      throw new Error('Width label was not rendered.');
    }
    expect(widthLabel.textContent?.trim()).not.toBe('');

    const widthInput = content.querySelector('input#width');
    if (!(widthInput instanceof HTMLInputElement)) {
      throw new Error('Width input was not found.');
    }

    expect(widthInput.value).toBe('100%');

    widthInput.setSelectionRange(widthInput.value.length, widthInput.value.length);
    await userEvent.type(widthInput, '50');
    expect(widthInput.value).toBe('100%50');

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async (context) => {
    await Default.play?.(context);
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
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const trigger = context.canvasElement.querySelector('[data-popover-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected popover trigger button to be present.');
    }
    expect(trigger.textContent?.trim()).toBe('ポップオーバーを開く');

    await Default.play?.(context);

    await userEvent.click(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Popover content was not rendered.');
      }
      return node;
    });

    const title = content.querySelector('[data-popover-title]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Popover title was not rendered.');
    }
    expect(title.textContent?.trim()).toBe('サイズ');

    const description = content.querySelector('[data-popover-description]');
    if (!(description instanceof HTMLElement)) {
      throw new Error('Popover description was not rendered.');
    }
    expect(description.textContent?.trim()).toBe('レイヤーのサイズを設定します。');

    const widthLabel = content.querySelector('label[for="width"]');
    if (!(widthLabel instanceof HTMLElement)) {
      throw new Error('Width label was not rendered.');
    }
    expect(widthLabel.textContent?.trim()).toBe('幅');

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });
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
  name: i18n.t('popover.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    msw: {
      handlers: popoverHandlers,
    },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: popoverStatusHandlers.loading,
    },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: popoverStatusHandlers.badRequest },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: popoverStatusHandlers.unauthorized },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: popoverStatusHandlers.forbidden },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: popoverStatusHandlers.unprocessableEntity },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: popoverStatusHandlers.internalServerError },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: popoverStatusHandlers.networkError },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Accessibility: Story = {
  name: i18n.t('popover.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Test keyboard navigation - Tab to trigger
    const trigger = canvasElement.querySelector('[data-popover-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Popover trigger was not found.');
    }

    // Focus trigger with keyboard
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Open popover with Enter key
    await userEvent.keyboard('{Enter}');

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Popover content was not rendered.');
      }
      return node;
    });

    // Verify ARIA attributes
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    // Test focus management - focus should be inside popover
    const input = content.querySelector('input');
    if (input instanceof HTMLInputElement) {
      input.focus();
      expect(doc.activeElement).toBe(input);
    }

    // Close popover with Escape key
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });

    // Focus should return to trigger after closing
    expect(doc.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  },
};

// ============ FAKER INTEGRATION STORIES ============

function PopoverWithFakerData() {
  const fakeContent = React.useMemo(() => createFakePopoverContent(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="faker-popover-demo">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline">
            {i18n.t('popover.story.openFakerPopover', 'Open Faker Popover')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-1">
              <div className="text-sm leading-none font-medium">{fakeContent.title}</div>
              <div className="text-muted-foreground text-sm">{fakeContent.description}</div>
            </div>
            <div className="text-muted-foreground text-xs">ID: {fakeContent.id}</div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <PopoverWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="faker-popover-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="popover-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected popover trigger button to be present.');
    }

    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Popover content was not found.');
      return el;
    });

    expect(content).toBeInTheDocument();
  },
};

// ============ ASYNC DATA STORIES ============

interface PopoverApiResponse {
  content: string;
  description: string;
  id: string;
  title: string;
}

interface PopoverApiError {
  code: string;
  message: string;
  status: number;
}

function PopoverWithAsyncData() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<PopoverApiResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<PopoverApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/dialog-content/test-popover')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as PopoverApiError;
          throw err;
        }
        return res.json() as Promise<PopoverApiResponse>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
        return undefined;
      })
      .catch((error_: PopoverApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    if (open && !data && !loading && !error) {
      fetchData();
    }
  }, [open, data, loading, error, fetchData]);

  const getDataState = (): string => {
    if (loading) return 'loading';
    if (error) return 'error';
    if (data) return 'success';
    return 'idle';
  };

  return (
    <div data-testid="async-popover-demo" data-state={getDataState()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline">
            {i18n.t('popover.story.openAsyncPopover', 'Open Async Popover')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          {loading && (
            <div data-testid="popover-loading" className="flex items-center justify-center py-4">
              <div className="text-muted-foreground text-sm">Loading...</div>
            </div>
          )}
          {error && (
            <div data-testid="popover-error" data-error-status={error.status}>
              <div className="text-destructive text-sm font-medium">
                {i18n.t('popover.story.error', 'Error')} {error.status}
              </div>
              <div className="text-muted-foreground text-sm">{error.message}</div>
              <Button size="sm" className="mt-2" onClick={fetchData}>
                Retry
              </Button>
            </div>
          )}
          {data && !loading && !error && (
            <div data-testid="popover-success">
              <div className="text-sm leading-none font-medium">{data.title}</div>
              <div className="text-muted-foreground mt-1 text-sm">{data.description}</div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: popoverHandlers },
  },
  render: () => <PopoverWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="popover-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected popover trigger button to be present.');
    }

    await userEvent.click(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="popover-loading"]')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="popover-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: popoverStatusHandlers.emptyData },
  },
  render: () => <PopoverWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-popover-demo"]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('popover.storyName.slowResponse', 'Slow Response (5s)'),
  parameters: {
    msw: { handlers: popoverStatusHandlers.slowResponse },
  },
  render: () => <PopoverWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-popover-demo"]')).toBeInTheDocument();
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error404NotFound: Story = {
  name: i18n.t('popover.storyName.error404NotFound', 'Error 404: Not Found'),
  parameters: {
    msw: { handlers: popoverStatusHandlers.notFound },
  },
  render: () => <PopoverWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-popover-demo"]')).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('popover.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: popoverStatusHandlers.conflict },
  },
  render: () => <PopoverWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-popover-demo"]')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('popover.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: popoverStatusHandlers.tooManyRequests },
  },
  render: () => <PopoverWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-popover-demo"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('popover.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: popoverStatusHandlers.badGateway },
  },
  render: () => <PopoverWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-popover-demo"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('popover.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: popoverStatusHandlers.serviceUnavailable },
  },
  render: () => <PopoverWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-popover-demo"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('popover.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: popoverStatusHandlers.gatewayTimeout },
  },
  render: () => <PopoverWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-popover-demo"]')).toBeInTheDocument();
  },
};

// ============ POSITIONING TESTS ============

export const PositioningTests: Story = {
  name: i18n.t('popover.storyName.positioningTests', 'Positioning Tests'),
  render: () => (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="trigger-top">
              Side: Top
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" data-testid="content-top">
            <p className="text-sm">
              {i18n.t('popover.story.thisPopoverAppearsOnTop', 'This popover appears on top')}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="trigger-right">
              Side: Right
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" data-testid="content-right">
            <p className="text-sm">
              {i18n.t(
                'popover.story.thisPopoverAppearsOnTheRight',
                'This popover appears on the right'
              )}
            </p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="trigger-left">
              Side: Left
            </Button>
          </PopoverTrigger>
          <PopoverContent side="left" data-testid="content-left">
            <p className="text-sm">
              {i18n.t(
                'popover.story.thisPopoverAppearsOnTheLeft',
                'This popover appears on the left'
              )}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="trigger-bottom">
              Side: Bottom (Default)
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" data-testid="content-bottom">
            <p className="text-sm">
              {i18n.t(
                'popover.story.thisPopoverAppearsOnTheBottom',
                'This popover appears on the bottom'
              )}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Align: Start
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48">
            <p className="text-sm">{i18n.t('popover.story.alignedToStart', 'Aligned to start')}</p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Align: Center
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-48">
            <p className="text-sm">
              {i18n.t('popover.story.alignedToCenter', 'Aligned to center')}
            </p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Align: End
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48">
            <p className="text-sm">{i18n.t('popover.story.alignedToEnd', 'Aligned to end')}</p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Offset: 0
            </Button>
          </PopoverTrigger>
          <PopoverContent sideOffset={0} className="w-48">
            <p className="text-sm">
              {i18n.t('popover.story.noOffsetFromTrigger', 'No offset from trigger')}
            </p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Offset: 8
            </Button>
          </PopoverTrigger>
          <PopoverContent sideOffset={8} className="w-48">
            <p className="text-sm">8px offset from trigger</p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Offset: 16
            </Button>
          </PopoverTrigger>
          <PopoverContent sideOffset={16} className="w-48">
            <p className="text-sm">16px offset from trigger</p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Test top positioning
    const triggerTop = canvasElement.querySelector('[data-testid="trigger-top"]');
    await userEvent.click(triggerTop!);

    const contentTop = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="content-top"]');
      if (!(el instanceof HTMLElement)) throw new Error('Top content not found');
      return el;
    });

    expect(contentTop.getAttribute('data-side')).toBe('top');
    await userEvent.keyboard('{Escape}');

    // Test bottom positioning
    const triggerBottom = canvasElement.querySelector('[data-testid="trigger-bottom"]');
    await userEvent.click(triggerBottom!);

    const contentBottom = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="content-bottom"]');
      if (!(el instanceof HTMLElement)) throw new Error('Bottom content not found');
      return el;
    });

    expect(contentBottom.getAttribute('data-side')).toBe('bottom');
    await userEvent.keyboard('{Escape}');
  },
};

// ============ COLLISION DETECTION STORY ============

export const CollisionDetection: Story = {
  name: i18n.t('popover.storyName.collisionDetection', 'Collision Detection'),
  render: () => (
    <div className="flex h-[300px] w-full flex-col">
      <div className="flex justify-start">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Top Left Corner
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <p className="text-sm">
              This popover should avoid the viewport edge and flip if needed.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              {i18n.t('popover.story.centerNoCollision', 'Center (No Collision)')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <p className="text-sm">
              {i18n.t(
                'popover.story.thisPopoverHasRoomOnAllSides',
                'This popover has room on all sides.'
              )}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Bottom Right Corner
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <p className="text-sm">
              {i18n.t(
                'popover.story.thisPopoverShouldFlipToAvoidGoingOffscre',
                'This popover should flip to avoid going off-screen.'
              )}
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();

    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(3);
  },
};

// ============ FOCUS TRAP STORY ============

export const FocusTrap: Story = {
  name: i18n.t('popover.storyName.focusTrap', 'Focus Trap'),
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Focus should be manageable within the popover. Tab cycles through elements.
      </p>
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="focus-trap-trigger">
            Open Focus Trap Popover
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" data-testid="focus-trap-popover">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="leading-none font-medium">
                {i18n.t('popover.story.focusTrapTest', 'Focus Trap Test')}
              </h4>

              <p className="text-muted-foreground text-sm">
                Tab through these inputs. Press Escape to close.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="focus-1">{i18n.t('popover.story.firstInput', 'First Input')}</Label>
              <Input
                id="focus-1"
                placeholder={i18n.t('popover.story.first', 'First')}
                data-testid="input-1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="focus-2">{i18n.t('popover.story.secondInput', 'Second Input')}</Label>
              <Input
                id="focus-2"
                placeholder={i18n.t('popover.story.second', 'Second')}
                data-testid="input-2"
              />
            </div>
            <Button data-testid="btn-submit">{i18n.t('popover.story.submit', 'Submit')}</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="focus-trap-popover"]');
      if (!(el instanceof HTMLElement)) throw new Error('Popover not found');
      return el;
    });

    // Tab through all focusable elements
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      // Focus should stay within the popover or document
      expect(doc.activeElement).toBeInTheDocument();
    }

    // Escape to close
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="focus-trap-popover"]')).not.toBeInTheDocument();
    });
  },
};

// ============ ESCAPE KEY HANDLING STORY ============

const EscapeKeyHandlingComponent = () => {
  const [open, setOpen] = React.useState(true);
  const [escapeCount, setEscapeCount] = React.useState(0);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Escape key presses: <span data-testid="escape-count">{escapeCount}</span>
      </p>
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEscapeCount((c) => c + 1);
          setOpen(isOpen);
        }}
      >
        <PopoverTrigger asChild>
          <Button>{i18n.t('popover.story.openPopover', 'Open Popover')}</Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <h4 className="leading-none font-medium">
              {i18n.t('popover.story.escapeKeyTest', 'Escape Key Test')}
            </h4>
            <p className="text-muted-foreground text-sm">
              Press Escape to close. The count will increment.
            </p>
            <Input
              placeholder={i18n.t(
                'popover.story.focusAndPressEscape',
                'Focus here and press Escape'
              )}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const EscapeKeyHandling: Story = {
  name: i18n.t('popover.storyName.escapeKeyHandling', 'Escape Key Handling'),
  render: () => <EscapeKeyHandlingComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Popover should be open
    const popover = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Popover not found');
      return el;
    });

    expect(popover).toBeInTheDocument();

    // Press Escape to close
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });

    // Verify escape count was incremented
    const countEl = canvasElement.querySelector('[data-testid="escape-count"]');
    expect(countEl).toHaveTextContent('1');
  },
};

// ============ COMPREHENSIVE PLAY TEST STORIES ============

export const TriggerBehavior: Story = {
  name: i18n.t('popover.storyName.triggerBehavior', 'Trigger Behavior'),
  render: () => (
    <div className="flex flex-col gap-4 p-8">
      <PopoverDemo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Test 1: Trigger should have correct ARIA attributes
    const trigger = canvasElement.querySelector('[data-popover-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Popover trigger was not found.');
    }

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // Test 2: Click to open
    await userEvent.click(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="popover-content"]');
      expect(content).toBeInTheDocument();
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    // Test 3: Click trigger again to close
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // Test 4: Keyboard open (Enter key)
    trigger.focus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="popover-content"]');
      expect(content).toBeInTheDocument();
    });

    // Test 5: Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });

    // Test 6: Keyboard open (Space key)
    await userEvent.keyboard(' ');

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="popover-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.keyboard('{Escape}');
  },
};

export const CloseBehavior: Story = {
  name: i18n.t('popover.storyName.closeBehavior', 'Close Behavior'),
  render: () => (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t(
            'popover.story.testVariousWaysToCloseThePopover',
            'Test various ways to close the popover'
          )}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="close-test-trigger">
              Open Popover
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" data-testid="close-test-content">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">
                  {i18n.t('popover.story.closeTest', 'Close Test')}
                </h4>
                <p className="text-muted-foreground text-sm">
                  Click outside, press Escape, or click trigger to close.
                </p>
              </div>
              <Input
                placeholder={i18n.t('popover.story.focusHere', 'Focus here')}
                data-testid="close-test-input"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="close-test-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Trigger not found');
    }

    // Test 1: Close on Escape key
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="close-test-content"]')).toBeInTheDocument();
    });

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="close-test-content"]')).not.toBeInTheDocument();
    });

    // Test 2: Close on trigger click (toggle)
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="close-test-content"]')).toBeInTheDocument();
    });

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="close-test-content"]')).not.toBeInTheDocument();
    });

    // Test 3: Close on outside click
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="close-test-content"]')).toBeInTheDocument();
    });

    // Click outside the popover
    await userEvent.click(canvasElement);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="close-test-content"]')).not.toBeInTheDocument();
    });
  },
};

export const FocusManagement: Story = {
  name: i18n.t('popover.storyName.focusManagement', 'Focus Management'),
  render: () => (
    <div className="flex flex-col gap-8 p-8">
      <p className="text-muted-foreground text-sm">
        Tab to trigger, open popover, test focus management within
      </p>
      <div className="flex items-center gap-4">
        <Button variant="outline" data-testid="before-trigger">
          Before Trigger
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="focus-mgmt-trigger">
              Open Popover
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" data-testid="focus-mgmt-content">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">
                  {i18n.t('popover.story.focusTest', 'Focus Test')}
                </h4>
                <p className="text-muted-foreground text-sm">
                  Tab cycles through focusable elements
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="focus-input-1">
                  {i18n.t('popover.story.firstInput', 'First Input')}
                </Label>
                <Input
                  id="focus-input-1"
                  data-testid="focus-input-1"
                  placeholder={i18n.t('popover.story.first', 'First')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="focus-input-2">
                  {i18n.t('popover.story.secondInput', 'Second Input')}
                </Label>
                <Input
                  id="focus-input-2"
                  data-testid="focus-input-2"
                  placeholder={i18n.t('popover.story.second', 'Second')}
                />
              </div>
              <Button data-testid="focus-submit-btn">
                {i18n.t('popover.story.submit', 'Submit')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" data-testid="after-trigger">
          After Trigger
        </Button>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Tab to reach the trigger
    await userEvent.tab(); // Focus "Before Trigger"
    await userEvent.tab(); // Focus popover trigger

    const trigger = canvasElement.querySelector('[data-testid="focus-mgmt-trigger"]');
    expect(doc.activeElement).toBe(trigger);

    // Open popover with Enter
    await userEvent.keyboard('{Enter}');

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="focus-mgmt-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });

    expect(content).toBeInTheDocument();

    // Tab to first input
    await userEvent.tab();
    const input1 = doc.body.querySelector('[data-testid="focus-input-1"]');
    expect(doc.activeElement).toBe(input1);

    // Tab to second input
    await userEvent.tab();
    const input2 = doc.body.querySelector('[data-testid="focus-input-2"]');
    expect(doc.activeElement).toBe(input2);

    // Tab to submit button
    await userEvent.tab();
    const submitBtn = doc.body.querySelector('[data-testid="focus-submit-btn"]');
    expect(doc.activeElement).toBe(submitBtn);

    // Escape to close
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="focus-mgmt-content"]')).not.toBeInTheDocument();
    });

    // Focus should return to trigger
    expect(doc.activeElement).toBe(trigger);
  },
};

// ============ DARK MODE STORIES ============

function DarkModeDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('popover.story.basicPopoverInDarkMode', 'Basic popover in dark mode')}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="dark-mode-trigger">
              {i18n.t('popover.trigger')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" data-testid="dark-mode-content">
            <div className="grid gap-4">
              <div className="space-y-1">
                <div className="text-sm leading-none font-medium" data-testid="dark-title">
                  {i18n.t('popover.title')}
                </div>
                <div className="text-muted-foreground text-sm" data-testid="dark-description">
                  {i18n.t('popover.description')}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dark-width">{i18n.t('popover.widthLabel')}</Label>
                <Input defaultValue="100%" id="dark-width" data-testid="dark-width-input" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('popover.story.formPopoverInDarkMode', 'Form popover in dark mode')}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" data-testid="dark-form-trigger">
              Edit Settings
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" data-testid="dark-form-content">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">
                  {i18n.t('popover.story.themeSettings', 'Theme Settings')}
                </h4>
                <p className="text-muted-foreground text-sm">
                  Customize your dark mode preferences.
                </p>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="contrast">{i18n.t('popover.story.contrast', 'Contrast')}</Label>
                  <Input className="col-span-2" defaultValue="Normal" id="contrast" />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="brightness">
                    {i18n.t('popover.story.brightness', 'Brightness')}
                  </Label>
                  <Input className="col-span-2" defaultValue="100%" id="brightness" />
                </div>
              </div>
              <Button>{i18n.t('popover.story.apply', 'Apply')}</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export const DarkMode: Story = {
  name: i18n.t('popover.storyName.darkMode', 'Dark Mode'),
  globals: {
    theme: 'dark',
  },
  render: () => <DarkModeDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Open the first popover
    const trigger = canvasElement.querySelector('[data-testid="dark-mode-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Dark mode trigger not found');
    }

    await userEvent.click(trigger);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="dark-mode-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });

    // Verify content is visible
    expect(content).toBeInTheDocument();

    // Verify elements render correctly
    const title = content.querySelector('[data-testid="dark-title"]');
    expect(title).toBeInTheDocument();
    expect(title?.textContent?.trim()).not.toBe('');

    const description = content.querySelector('[data-testid="dark-description"]');
    expect(description).toBeInTheDocument();

    const input = content.querySelector('[data-testid="dark-width-input"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Input not found');
    }
    expect(input.value).toBe('100%');

    // Close popover
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="dark-mode-content"]')).not.toBeInTheDocument();
    });
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('popover.storyName.darkModeJapanese', 'Dark Mode (Japanese)'),
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  render: () => <DarkModeDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify Japanese locale is applied
    expect(doc.documentElement.lang).toBe('ja');

    const trigger = canvasElement.querySelector('[data-testid="dark-mode-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Dark mode trigger not found');
    }

    // Verify Japanese trigger text
    expect(trigger.textContent?.trim()).toBe('ポップオーバーを開く');

    await userEvent.click(trigger);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="dark-mode-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });

    // Verify Japanese content
    const title = content.querySelector('[data-testid="dark-title"]');
    expect(title?.textContent?.trim()).toBe('サイズ');

    const description = content.querySelector('[data-testid="dark-description"]');
    expect(description?.textContent?.trim()).toBe('レイヤーのサイズを設定します。');

    await userEvent.keyboard('{Escape}');
  },
};

// ============ KEYBOARD NAVIGATION STORIES ============

export const KeyboardNavigation: Story = {
  name: i18n.t('popover.storyName.keyboardNavigation', 'Keyboard Navigation'),
  render: () => (
    <div className="space-y-8 p-8">
      <p className="text-muted-foreground text-sm">
        Test keyboard-only navigation: Tab, Enter, Space, Escape, Arrow keys
      </p>
      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="kb-nav-trigger-1">
              Popover 1
            </Button>
          </PopoverTrigger>
          <PopoverContent data-testid="kb-nav-content-1">
            <div className="space-y-2">
              <h4 className="font-medium">
                {i18n.t('popover.story.firstPopover', 'First Popover')}
              </h4>
              <Input
                placeholder={i18n.t('popover.story.typeHere', 'Type here')}
                data-testid="kb-nav-input-1"
              />
              <Button size="sm" data-testid="kb-nav-btn-1">
                Action
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="kb-nav-trigger-2">
              Popover 2
            </Button>
          </PopoverTrigger>
          <PopoverContent data-testid="kb-nav-content-2">
            <div className="space-y-2">
              <h4 className="font-medium">
                {i18n.t('popover.story.secondPopover', 'Second Popover')}
              </h4>
              <Input
                placeholder={i18n.t('popover.story.typeHere', 'Type here')}
                data-testid="kb-nav-input-2"
              />
              <Button size="sm" data-testid="kb-nav-btn-2">
                Action
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Tab to first trigger
    await userEvent.tab();
    const trigger1 = canvasElement.querySelector('[data-testid="kb-nav-trigger-1"]');
    expect(doc.activeElement).toBe(trigger1);

    // Open with Space
    await userEvent.keyboard(' ');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="kb-nav-content-1"]')).toBeInTheDocument();
    });

    // Tab to input
    await userEvent.tab();
    const input1 = doc.body.querySelector('[data-testid="kb-nav-input-1"]');
    expect(doc.activeElement).toBe(input1);

    // Tab to button
    await userEvent.tab();
    const btn1 = doc.body.querySelector('[data-testid="kb-nav-btn-1"]');
    expect(doc.activeElement).toBe(btn1);

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="kb-nav-content-1"]')).not.toBeInTheDocument();
    });

    // Focus should be back on trigger
    expect(doc.activeElement).toBe(trigger1);

    // Tab to second trigger
    await userEvent.tab();
    const trigger2 = canvasElement.querySelector('[data-testid="kb-nav-trigger-2"]');
    expect(doc.activeElement).toBe(trigger2);

    // Open with Enter
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="kb-nav-content-2"]')).toBeInTheDocument();
    });

    // Close
    await userEvent.keyboard('{Escape}');
  },
};

// ============ SCREEN READER ANNOUNCEMENT STORY ============

export const ScreenReaderAnnouncements: Story = {
  name: i18n.t('popover.storyName.screenReaderAnnouncements', 'Screen Reader Announcements'),
  render: () => (
    <div className="space-y-4 p-8">
      <p className="text-muted-foreground text-sm">
        ARIA attributes for screen reader compatibility
      </p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-describedby="popover-help" data-testid="sr-trigger">
            Help
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80"
          data-testid="sr-content"
          aria-label={i18n.t('popover.story.helpInformation', 'Help information')}
        >
          <div className="space-y-2" role="region" aria-labelledby="sr-heading">
            <h4 id="sr-heading" className="font-medium">
              Help Information
            </h4>
            <p className="text-muted-foreground text-sm">
              This popover provides additional help and context for the current feature. Press
              Escape to close.
            </p>
          </div>
        </PopoverContent>
      </Popover>
      <p id="popover-help" className="sr-only">
        Opens a help panel with additional information
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="sr-trigger"]');

    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Trigger not found');
    }

    // Verify ARIA attributes on trigger
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-describedby')).toBe('popover-help');

    await userEvent.click(trigger);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sr-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });

    // Verify content has accessible label
    expect(content.getAttribute('aria-label')).toBe('Help information');

    // Verify region landmark
    const region = content.querySelector('[role="region"]');
    expect(region).toBeInTheDocument();
    expect(region?.getAttribute('aria-labelledby')).toBe('sr-heading');

    await userEvent.keyboard('{Escape}');
  },
};

// ============ FACTORY WIRING STORIES ============

// ---------- Constants Stories ----------

function PopoverAlignsDemo() {
  return (
    <div className="space-y-4" data-testid="popover-aligns-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.positions')}</p>
      <div className="flex gap-4">
        {POPOVER_ALIGNS.map((align) => (
          <Popover key={align}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`align-trigger-${align}`}>
                {align}
              </Button>
            </PopoverTrigger>
            <PopoverContent align={align} className="w-48">
              <p className="text-sm">Aligned to {align}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryAligns: Story = {
  name: i18n.t('popover.storyName.factoryAligns', 'Factory: POPOVER_ALIGNS'),
  render: () => <PopoverAlignsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="popover-aligns-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_ALIGNS.length);
    for (const align of POPOVER_ALIGNS) {
      expect(
        canvasElement.querySelector(`[data-testid="align-trigger-${align}"]`)
      ).toBeInTheDocument();
    }
  },
};

function PopoverSidesDemo() {
  return (
    <div className="space-y-4 p-16" data-testid="popover-sides-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.positions')}</p>
      <div className="flex flex-wrap justify-center gap-8">
        {POPOVER_SIDES.map((side) => (
          <Popover key={side}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`side-trigger-${side}`}>
                {side}
              </Button>
            </PopoverTrigger>
            <PopoverContent side={side} className="w-40">
              <p className="text-sm">Side: {side}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactorySides: Story = {
  name: i18n.t('popover.storyName.factorySides', 'Factory: POPOVER_SIDES'),
  render: () => <PopoverSidesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="popover-sides-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_SIDES.length);
    for (const side of POPOVER_SIDES) {
      expect(
        canvasElement.querySelector(`[data-testid="side-trigger-${side}"]`)
      ).toBeInTheDocument();
    }
  },
};

function PopoverTriggerTypesDemo() {
  return (
    <div className="space-y-4" data-testid="popover-trigger-types-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <div className="flex gap-4">
        {POPOVER_TRIGGER_TYPES.map((type) => (
          <Popover key={type}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`trigger-type-${type}`}>
                {type}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <p className="text-sm">Trigger type: {type}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryTriggerTypes: Story = {
  name: i18n.t('popover.storyName.factoryTriggerTypes', 'Factory: POPOVER_TRIGGER_TYPES'),
  render: () => <PopoverTriggerTypesDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="popover-trigger-types-demo"]')
    ).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_TRIGGER_TYPES.length);
    for (const type of POPOVER_TRIGGER_TYPES) {
      expect(
        canvasElement.querySelector(`[data-testid="trigger-type-${type}"]`)
      ).toBeInTheDocument();
    }
  },
};

function PopoverContentTypesDemo() {
  return (
    <div className="space-y-4" data-testid="popover-content-types-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <div className="flex flex-wrap gap-4">
        {POPOVER_CONTENT_TYPES.map((type) => (
          <Popover key={type}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`content-type-${type}`}>
                {type}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <p className="text-sm">Content type: {type}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryContentTypes: Story = {
  name: i18n.t('popover.storyName.factoryContentTypes', 'Factory: POPOVER_CONTENT_TYPES'),
  render: () => <PopoverContentTypesDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="popover-content-types-demo"]')
    ).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_CONTENT_TYPES.length);
    for (const type of POPOVER_CONTENT_TYPES) {
      expect(
        canvasElement.querySelector(`[data-testid="content-type-${type}"]`)
      ).toBeInTheDocument();
    }
  },
};

function PopoverStatesDemo() {
  return (
    <div className="space-y-4" data-testid="popover-states-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.states')}</p>
      <div className="flex gap-4">
        {POPOVER_STATES.map((state) => (
          <div key={state} className="text-center" data-testid={`state-${state}`}>
            <span className="bg-muted rounded-full px-2 py-1 text-xs">{state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryStates: Story = {
  name: i18n.t('popover.storyName.factoryStates', 'Factory: POPOVER_STATES'),
  render: () => <PopoverStatesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="popover-states-demo"]')).toBeInTheDocument();
    for (const state of POPOVER_STATES) {
      expect(canvasElement.querySelector(`[data-testid="state-${state}"]`)).toBeInTheDocument();
    }
  },
};

function SideOffsetOptionsDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="side-offset-demo">
      <p className="text-sm font-medium">{t('popover.section.positions')}</p>
      <div className="flex gap-4">
        {SIDE_OFFSET_OPTIONS.map((offset) => (
          <Popover key={offset}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`offset-trigger-${offset}`}>
                Offset: {offset}
              </Button>
            </PopoverTrigger>
            <PopoverContent sideOffset={offset} className="w-48">
              <p className="text-sm">{i18n.t('popover.story.sideOffsetPx', { offset })}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactorySideOffsets: Story = {
  name: i18n.t('popover.storyName.factorySideOffsets', 'Factory: SIDE_OFFSET_OPTIONS'),
  render: () => <SideOffsetOptionsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="side-offset-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(SIDE_OFFSET_OPTIONS.length);
  },
};

function AlignOffsetOptionsDemo() {
  return (
    <div className="space-y-4" data-testid="align-offset-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.positions')}</p>
      <div className="flex gap-4">
        {ALIGN_OFFSET_OPTIONS.map((offset) => (
          <Popover key={offset}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`align-offset-trigger-${offset}`}>
                Align offset: {offset}
              </Button>
            </PopoverTrigger>
            <PopoverContent alignOffset={offset} className="w-48">
              <p className="text-sm">{i18n.t('popover.story.alignOffsetPx', { offset })}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryAlignOffsets: Story = {
  name: i18n.t('popover.storyName.factoryAlignOffsets', 'Factory: ALIGN_OFFSET_OPTIONS'),
  render: () => <AlignOffsetOptionsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="align-offset-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(ALIGN_OFFSET_OPTIONS.length);
  },
};

function PopoverWidthOptionsDemo() {
  return (
    <div className="space-y-4" data-testid="width-options-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.sizes')}</p>
      <div className="flex flex-wrap gap-4">
        {POPOVER_WIDTH_OPTIONS.map((width) => (
          <Popover key={String(width)}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`width-trigger-${String(width)}`}>
                Width: {String(width)}
              </Button>
            </PopoverTrigger>
            <PopoverContent style={{ width: typeof width === 'number' ? width : undefined }}>
              <p className="text-sm">
                Width: {String(width)}
                {typeof width === 'number' ? 'px' : ''}
              </p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryWidthOptions: Story = {
  name: i18n.t('popover.storyName.factoryWidthOptions', 'Factory: POPOVER_WIDTH_OPTIONS'),
  render: () => <PopoverWidthOptionsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="width-options-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_WIDTH_OPTIONS.length);
  },
};

// ---------- Single Item Factory Stories ----------

function FakeTriggerDemo() {
  const trigger = React.useMemo(() => createFakePopoverTrigger(), []);

  return (
    <div className="space-y-4" data-testid="fake-trigger-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={trigger.disabled}
            aria-label={trigger.ariaLabel}
            data-testid="fake-trigger-btn"
          >
            {trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">Type: {trigger.type}</p>
            <p className="text-muted-foreground text-xs">ID: {trigger.id}</p>
            {trigger.icon && <p className="text-muted-foreground text-xs">Icon: {trigger.icon}</p>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryTrigger: Story = {
  name: i18n.t('popover.storyName.factoryTrigger', 'Factory: createFakePopoverTrigger'),
  render: () => <FakeTriggerDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="fake-trigger-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="fake-trigger-btn"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent?.trim()).not.toBe('');
  },
};

function FakeFormFieldDemo() {
  const field = React.useMemo(() => createFakePopoverFormField(), []);

  return (
    <div className="space-y-4" data-testid="fake-form-field-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="form-field-trigger">
            Form Field
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-2">
            <Label htmlFor={field.id}>{field.label}</Label>
            <Input
              id={field.id}
              type={
                field.type === 'textarea' || field.type === 'checkbox' || field.type === 'select'
                  ? 'text'
                  : field.type
              }
              placeholder={field.placeholder}
              defaultValue={field.defaultValue}
              required={field.required}
              data-testid="form-field-input"
            />
            <p className="text-muted-foreground text-xs" data-testid="form-field-type">
              Type: {field.type}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryFormField: Story = {
  name: i18n.t('popover.storyName.factoryFormField', 'Factory: createFakePopoverFormField'),
  render: () => <FakeFormFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="fake-form-field-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="form-field-trigger"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);
    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });
    expect(content.querySelector('[data-testid="form-field-input"]')).toBeInTheDocument();
    expect(content.querySelector('[data-testid="form-field-type"]')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
  },
};

function FakeFormFieldsDemo() {
  const fields = React.useMemo(() => createFakePopoverFormFields(3), []);

  return (
    <div className="space-y-4" data-testid="fake-form-fields-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="form-fields-trigger">
            Form Fields ({fields.length})
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-3">
            {fields.map((field) => (
              <div key={field.id} className="grid gap-1" data-testid={`field-${field.id}`}>
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input
                  id={field.id}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                />
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryFormFields: Story = {
  name: i18n.t('popover.storyName.factoryFormFields', 'Factory: createFakePopoverFormFields'),
  render: () => <FakeFormFieldsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="fake-form-fields-demo"]')
    ).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="form-fields-trigger"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);
    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });
    const labels = content.querySelectorAll('label');
    expect(labels.length).toBe(3);
    await userEvent.keyboard('{Escape}');
  },
};

function FakeListItemDemo() {
  const item = React.useMemo(() => createFakePopoverListItem(), []);

  return (
    <div className="space-y-4" data-testid="fake-list-item-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="list-item-trigger">
            List Item
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-1" data-testid="list-item-content">
            <p className="text-sm font-medium" data-testid="list-item-label">
              {item.label}
            </p>
            {item.description && (
              <p className="text-muted-foreground text-xs">{item.description}</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryListItem: Story = {
  name: i18n.t('popover.storyName.factoryListItem', 'Factory: createFakePopoverListItem'),
  render: () => <FakeListItemDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="fake-list-item-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="list-item-trigger"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);
    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });
    expect(content.querySelector('[data-testid="list-item-label"]')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
  },
};

function FakeListItemsDemo() {
  const items = React.useMemo(() => createFakePopoverListItems(4), []);

  return (
    <div className="space-y-4" data-testid="fake-list-items-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="list-items-trigger">
            List Items ({items.length})
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b pb-1 last:border-0"
                data-testid={`list-item-${item.id}`}
              >
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryListItems: Story = {
  name: i18n.t('popover.storyName.factoryListItems', 'Factory: createFakePopoverListItems'),
  render: () => <FakeListItemsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="fake-list-items-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="list-items-trigger"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);
    const doc = canvasElement.ownerDocument;
    await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
    });
    await userEvent.keyboard('{Escape}');
  },
};

function FakePopoverFullDemo() {
  const popover = React.useMemo(() => createFakePopover(), []);

  return (
    <div className="space-y-4" data-testid="fake-popover-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="fake-popover-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side={popover.side}
          align={popover.align}
          sideOffset={popover.sideOffset}
          className="w-80"
        >
          <div className="space-y-2">
            {popover.content.title && (
              <p className="text-sm font-medium" data-testid="fake-popover-title">
                {popover.content.title}
              </p>
            )}
            {popover.content.description && (
              <p className="text-muted-foreground text-xs">{popover.content.description}</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryPopover: Story = {
  name: i18n.t('popover.storyName.factoryPopover', 'Factory: createFakePopover'),
  render: () => <FakePopoverFullDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="fake-popover-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="fake-popover-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent?.trim()).not.toBe('');
  },
};

function FakePopoversDemo() {
  const popovers = React.useMemo(() => createFakePopovers(3), []);

  return (
    <div className="space-y-4" data-testid="fake-popovers-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <div className="flex gap-4">
        {popovers.map((popover, i) => (
          <Popover key={popover.id}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`popovers-trigger-${i}`}>
                {popover.trigger.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent side={popover.side} align={popover.align} className="w-64">
              <div className="space-y-1">
                {popover.content.title && (
                  <p className="text-sm font-medium">{popover.content.title}</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryPopovers: Story = {
  name: i18n.t('popover.storyName.factoryPopovers', 'Factory: createFakePopovers'),
  render: () => <FakePopoversDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="fake-popovers-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(3);
  },
};

// ---------- Specialized Factory Stories ----------

function InfoPopoverDemo() {
  const popover = React.useMemo(() => createFakeInfoPopover(), []);

  return (
    <div className="space-y-4" data-testid="info-popover-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="info-popover-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align}>
          <div className="space-y-2">
            {popover.content.title && (
              <p className="text-sm font-medium" data-testid="info-title">
                {popover.content.title}
              </p>
            )}
            {popover.content.description && (
              <p className="text-muted-foreground text-xs" data-testid="info-desc">
                {popover.content.description}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryInfoPopover: Story = {
  name: i18n.t('popover.storyName.factoryInfoPopover', 'Factory: createFakeInfoPopover'),
  render: () => <InfoPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="info-popover-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="info-popover-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function FormPopoverDemo() {
  const popover = React.useMemo(() => createFakeFormPopover(3), []);

  return (
    <div className="space-y-4" data-testid="form-popover-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="form-popover-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} className="w-80">
          <div className="grid gap-3">
            {popover.content.title && (
              <p className="text-sm font-medium">{popover.content.title}</p>
            )}
            {popover.content.fields?.map((field) => (
              <div key={field.id} className="grid gap-1">
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input
                  id={field.id}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                />
              </div>
            ))}
            {popover.content.buttonLabel && (
              <Button size="sm">{popover.content.buttonLabel}</Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryFormPopover: Story = {
  name: i18n.t('popover.storyName.factoryFormPopover', 'Factory: createFakeFormPopover'),
  render: () => <FormPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="form-popover-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="form-popover-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function MenuPopoverDemo() {
  const popover = React.useMemo(() => createFakeMenuPopover(5), []);

  return (
    <div className="space-y-4" data-testid="menu-popover-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="menu-popover-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} className="w-48">
          <div className="space-y-1">
            {popover.content.items?.map((item) => (
              <div
                key={item.id}
                className="hover:bg-accent cursor-pointer rounded px-2 py-1.5 text-sm"
              >
                {item.label}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryMenuPopover: Story = {
  name: i18n.t('popover.storyName.factoryMenuPopover', 'Factory: createFakeMenuPopover'),
  render: () => <MenuPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="menu-popover-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="menu-popover-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function ProfilePopoverDemo() {
  const popover = React.useMemo(() => createFakeProfilePopover(), []);

  return (
    <div className="space-y-4" data-testid="profile-popover-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="profile-popover-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} className="w-72">
          <div className="space-y-2">
            {popover.content.title && (
              <p className="text-sm font-medium" data-testid="profile-name">
                {popover.content.title}
              </p>
            )}
            {popover.content.description && (
              <p className="text-muted-foreground text-xs" data-testid="profile-job">
                {popover.content.description}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryProfilePopover: Story = {
  name: i18n.t('popover.storyName.factoryProfilePopover', 'Factory: createFakeProfilePopover'),
  render: () => <ProfilePopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="profile-popover-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="profile-popover-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function SettingsPopoverDemo() {
  const popover = React.useMemo(() => createFakeSettingsPopover(), []);

  return (
    <div className="space-y-4" data-testid="settings-popover-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="settings-popover-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} className="w-80">
          <div className="grid gap-3">
            {popover.content.title && (
              <p className="text-sm font-medium">{popover.content.title}</p>
            )}
            {popover.content.fields?.map((field) => (
              <div key={field.id} className="grid gap-1">
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input id={field.id} placeholder={field.placeholder} />
              </div>
            ))}
            {popover.content.buttonLabel && (
              <Button size="sm">{popover.content.buttonLabel}</Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactorySettingsPopover: Story = {
  name: i18n.t('popover.storyName.factorySettingsPopover', 'Factory: createFakeSettingsPopover'),
  render: () => <SettingsPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="settings-popover-demo"]')
    ).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="settings-popover-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function ControlledPopoverDemo() {
  const [isOpen, setIsOpen] = React.useState(false);
  const popoverClosed = React.useMemo(() => createFakeControlledPopover(false), []);
  const popoverOpen = React.useMemo(() => createFakeControlledPopover(true), []);

  return (
    <div className="space-y-4" data-testid="controlled-popover-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.states')}</p>
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="controlled-toggle"
        >
          Toggle:{' '}
          {isOpen ? i18n.t('popover.story.open', 'Open') : i18n.t('popover.story.closed', 'Closed')}
        </Button>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline">{i18n.t('popover.story.controlled', 'Controlled')}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {i18n.t('popover.story.controlledState', 'Controlled State')}
              </p>
              <p className="text-muted-foreground text-xs" data-testid="controlled-state">
                Closed default: {String(popoverClosed.defaultOpen)}, Open default:{' '}
                {String(popoverOpen.defaultOpen)}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export const FactoryControlledPopover: Story = {
  name: i18n.t(
    'popover.storyName.factoryControlledPopover',
    'Factory: createFakeControlledPopover'
  ),
  render: () => <ControlledPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="controlled-popover-demo"]')
    ).toBeInTheDocument();
    const toggle = canvasElement.querySelector('[data-testid="controlled-toggle"]');
    expect(toggle).toBeInTheDocument();

    await userEvent.click(toggle!);
    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });
    expect(content.querySelector('[data-testid="controlled-state"]')).toBeInTheDocument();
    await userEvent.click(toggle!);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });
  },
};

// ---------- Matrix Factory Stories ----------

function SideMatrixDemo() {
  const { t } = useTranslation();
  const popovers = React.useMemo(() => createPopoverSideMatrix(), []);

  return (
    <div className="space-y-4 p-16" data-testid="side-matrix-demo">
      <p className="text-sm font-medium">{t('popover.section.positions')}</p>
      <div className="flex flex-wrap justify-center gap-8">
        {popovers.map((popover) => (
          <Popover key={popover.id}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                {popover.trigger.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent side={popover.side} className="w-40">
              <p className="text-sm">Side: {popover.side}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactorySideMatrix: Story = {
  name: i18n.t('popover.storyName.factorySideMatrix', 'Factory: createPopoverSideMatrix'),
  render: () => <SideMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="side-matrix-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_SIDES.length);
  },
};

function AlignMatrixDemo() {
  const popovers = React.useMemo(() => createPopoverAlignMatrix(), []);

  return (
    <div className="space-y-4" data-testid="align-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.positions')}</p>
      <div className="flex gap-4">
        {popovers.map((popover) => (
          <Popover key={popover.id}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                {popover.trigger.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent align={popover.align} className="w-48">
              <p className="text-sm">Align: {popover.align}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryAlignMatrix: Story = {
  name: i18n.t('popover.storyName.factoryAlignMatrix', 'Factory: createPopoverAlignMatrix'),
  render: () => <AlignMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="align-matrix-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_ALIGNS.length);
  },
};

function ContentTypeMatrixDemo() {
  const popovers = React.useMemo(() => createPopoverContentTypeMatrix(), []);

  return (
    <div className="space-y-4" data-testid="content-type-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <div className="flex flex-wrap gap-4">
        {popovers.map((popover) => (
          <Popover key={popover.id}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                {popover.trigger.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <p className="text-muted-foreground text-xs">Type: {popover.content.type}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryContentTypeMatrix: Story = {
  name: i18n.t(
    'popover.storyName.factoryContentTypeMatrix',
    'Factory: createPopoverContentTypeMatrix'
  ),
  render: () => <ContentTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="content-type-matrix-demo"]')
    ).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_CONTENT_TYPES.length);
  },
};

function TriggerTypeMatrixDemo() {
  const popovers = React.useMemo(() => createPopoverTriggerTypeMatrix(), []);

  return (
    <div className="space-y-4" data-testid="trigger-type-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <div className="flex gap-4">
        {popovers.map((popover) => (
          <Popover key={popover.id}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                {popover.trigger.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <p className="text-sm">Trigger: {popover.trigger.type}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryTriggerTypeMatrix: Story = {
  name: i18n.t(
    'popover.storyName.factoryTriggerTypeMatrix',
    'Factory: createPopoverTriggerTypeMatrix'
  ),
  render: () => <TriggerTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="trigger-type-matrix-demo"]')
    ).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_TRIGGER_TYPES.length);
  },
};

function PositionMatrixDemo() {
  const popovers = React.useMemo(() => createPopoverPositionMatrix(), []);

  return (
    <div className="space-y-4 p-16" data-testid="position-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.positions')}</p>
      <div className="grid grid-cols-4 gap-4">
        {popovers.map((popover) => (
          <Popover key={popover.id}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                {popover.trigger.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent side={popover.side} align={popover.align} className="w-40">
              <p className="text-xs">
                {popover.side}-{popover.align}
              </p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryPositionMatrix: Story = {
  name: i18n.t('popover.storyName.factoryPositionMatrix', 'Factory: createPopoverPositionMatrix'),
  render: () => <PositionMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="position-matrix-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers).toHaveLength(POPOVER_SIDES.length * POPOVER_ALIGNS.length);
  },
};

// ---------- Showcase & Test Data Stories ----------

function ShowcaseDemo() {
  const showcase = React.useMemo(() => createPopoverShowcase(), []);

  return (
    <div className="space-y-6" data-testid="showcase-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      {showcase.map((item) => (
        <div key={item.name} className="space-y-2">
          <p className="text-sm font-medium">{item.name}</p>
          <p className="text-muted-foreground text-xs">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('popover.storyName.factoryShowcase', 'Factory: createPopoverShowcase'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="showcase-demo"]')).toBeInTheDocument();
  },
};

function TestDataDemo() {
  const { t } = useTranslation();
  const testData = React.useMemo(() => createPopoverTestData(), []);

  return (
    <div className="space-y-6" data-testid="test-data-demo">
      <p className="text-sm font-medium">{t('popover.section.variants')}</p>
      <div className="grid gap-2 text-sm">
        <p data-testid="td-popovers">Popovers: {testData.popovers.length}</p>
        <p data-testid="td-triggers">Triggers: {testData.triggers.length}</p>
        <p data-testid="td-fields">Form Fields: {testData.formFields.length}</p>
        <p data-testid="td-items">List Items: {testData.listItems.length}</p>
        <p data-testid="td-sides">Side Matrix: {testData.sideMatrix.length}</p>
        <p data-testid="td-aligns">Align Matrix: {testData.alignMatrix.length}</p>
        <p data-testid="td-content">Content Types: {testData.contentTypeMatrix.length}</p>
        <p data-testid="td-trigger-types">Trigger Types: {testData.triggerTypeMatrix.length}</p>
        <p data-testid="td-positions">Positions: {testData.positionMatrix.length}</p>
        <p data-testid="td-showcase">Showcase: {testData.showcase.length}</p>
      </div>
    </div>
  );
}

export const FactoryTestData: Story = {
  name: i18n.t('popover.storyName.factoryTestData', 'Factory: createPopoverTestData'),
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="test-data-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-popovers"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-triggers"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-fields"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-items"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-sides"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-aligns"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-trigger-types"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-positions"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="td-showcase"]')).toBeInTheDocument();
  },
};

// ---------- Enterprise Factory Stories ----------

function TrackedPopoverDemo() {
  const { t } = useTranslation();
  const popover = React.useMemo(() => createFakeTrackedPopover(), []);

  return (
    <div className="space-y-4" data-testid="tracked-popover-demo">
      <p className="text-sm font-medium">{t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="tracked-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <p data-testid="tracking-id" className="text-muted-foreground text-xs">
              Tracking: {popover.trackingId}
            </p>
            <p data-testid="tracking-source" className="text-muted-foreground text-xs">
              Source: {popover.trackingData.source}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryTrackedPopover: Story = {
  name: i18n.t('popover.storyName.factoryTrackedPopover', 'Factory: createFakeTrackedPopover'),
  render: () => <TrackedPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="tracked-popover-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="tracked-trigger"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);
    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });
    expect(content.querySelector('[data-testid="tracking-id"]')).toBeInTheDocument();
    expect(content.querySelector('[data-testid="tracking-source"]')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
  },
};

function OnboardingPopoverDemo() {
  const popover = React.useMemo(() => createFakeOnboardingPopover(1, 5), []);

  return (
    <div className="space-y-4" data-testid="onboarding-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.states')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="onboarding-trigger">
            Onboarding
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} className="w-72">
          <div className="space-y-3">
            {popover.content.title && (
              <p className="text-sm font-medium" data-testid="onboarding-title">
                {popover.content.title}
              </p>
            )}
            {popover.content.description && (
              <p className="text-muted-foreground text-xs">{popover.content.description}</p>
            )}
            {popover.content.buttonLabel && (
              <Button size="sm" data-testid="onboarding-next">
                {popover.content.buttonLabel}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryOnboardingPopover: Story = {
  name: i18n.t(
    'popover.storyName.factoryOnboardingPopover',
    'Factory: createFakeOnboardingPopover'
  ),
  render: () => <OnboardingPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="onboarding-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="onboarding-trigger"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);
    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });
    expect(content.querySelector('[data-testid="onboarding-title"]')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
  },
};

function NotificationPopoverDemo() {
  const popover = React.useMemo(() => createFakeNotificationPopover(4), []);

  return (
    <div className="space-y-4" data-testid="notification-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="notification-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} className="w-80">
          <div className="space-y-2">
            {popover.content.title && (
              <p className="text-sm font-medium">{popover.content.title}</p>
            )}
            {popover.content.items?.map((item) => (
              <div key={item.id} className="border-b pb-1 text-xs last:border-0">
                {item.label}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryNotificationPopover: Story = {
  name: i18n.t(
    'popover.storyName.factoryNotificationPopover',
    'Factory: createFakeNotificationPopover'
  ),
  render: () => <NotificationPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="notification-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="notification-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function ColorPickerPopoverDemo() {
  const popover = React.useMemo(() => createFakeColorPickerPopover(), []);

  return (
    <div className="space-y-4" data-testid="color-picker-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="color-picker-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} sideOffset={popover.sideOffset}>
          {popover.content.title && (
            <p className="mb-2 text-sm font-medium" data-testid="color-picker-title">
              {popover.content.title}
            </p>
          )}
          <div className="grid grid-cols-5 gap-2">
            {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'].map((color) => (
              <div
                key={color}
                className="h-6 w-6 cursor-pointer rounded border"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryColorPickerPopover: Story = {
  name: i18n.t(
    'popover.storyName.factoryColorPickerPopover',
    'Factory: createFakeColorPickerPopover'
  ),
  render: () => <ColorPickerPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="color-picker-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="color-picker-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function DatePickerPopoverDemo() {
  const popover = React.useMemo(() => createFakeDatePickerPopover(), []);

  return (
    <div className="space-y-4" data-testid="date-picker-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="date-picker-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} sideOffset={popover.sideOffset}>
          {popover.content.title && (
            <p className="mb-2 text-sm font-medium" data-testid="date-picker-title">
              {popover.content.title}
            </p>
          )}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {[
              i18n.t('popover.story.daySu', 'Su'),
              i18n.t('popover.story.dayMo', 'Mo'),
              i18n.t('popover.story.dayTu', 'Tu'),
              i18n.t('popover.story.dayWe', 'We'),
              i18n.t('popover.story.dayTh', 'Th'),
              i18n.t('popover.story.dayFr', 'Fr'),
              i18n.t('popover.story.daySa', 'Sa'),
            ].map((day) => (
              <span key={day} className="text-muted-foreground font-medium">
                {day}
              </span>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryDatePickerPopover: Story = {
  name: i18n.t(
    'popover.storyName.factoryDatePickerPopover',
    'Factory: createFakeDatePickerPopover'
  ),
  render: () => <DatePickerPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="date-picker-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="date-picker-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function UserPreviewPopoverDemo() {
  const popover = React.useMemo(() => createFakeUserPreviewPopover(), []);

  return (
    <div className="space-y-4" data-testid="user-preview-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="link" data-testid="user-preview-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} sideOffset={popover.sideOffset}>
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
              <span className="text-sm font-medium">{popover.content.title?.charAt(0) ?? 'U'}</span>
            </div>
            <div>
              {popover.content.title && (
                <p className="text-sm font-medium" data-testid="user-name">
                  {popover.content.title}
                </p>
              )}
              {popover.content.description && (
                <p className="text-muted-foreground text-xs">{popover.content.description}</p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactoryUserPreviewPopover: Story = {
  name: i18n.t(
    'popover.storyName.factoryUserPreviewPopover',
    'Factory: createFakeUserPreviewPopover'
  ),
  render: () => <UserPreviewPopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="user-preview-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="user-preview-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function SharePopoverDemo() {
  const popover = React.useMemo(() => createFakeSharePopover(), []);

  return (
    <div className="space-y-4" data-testid="share-popover-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="share-trigger">
            {popover.trigger.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent side={popover.side} align={popover.align} className="w-48">
          {popover.content.title && (
            <p className="mb-2 text-sm font-medium">{popover.content.title}</p>
          )}
          <div className="space-y-1">
            {popover.content.items?.map((item) => (
              <div
                key={item.id}
                className="hover:bg-accent cursor-pointer rounded px-2 py-1.5 text-sm"
              >
                {item.label}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const FactorySharePopover: Story = {
  name: i18n.t('popover.storyName.factorySharePopover', 'Factory: createFakeSharePopover'),
  render: () => <SharePopoverDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="share-popover-demo"]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-testid="share-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function EnterprisePopoverSetDemo() {
  const popovers = React.useMemo(() => createFakeEnterprisePopoverSet(), []);

  return (
    <div className="space-y-4" data-testid="enterprise-set-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      <div className="flex flex-wrap gap-4">
        {popovers.map((popover, i) => (
          <Popover key={popover.id}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid={`ent-trigger-${i}`}>
                {popover.trigger.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <p className="text-muted-foreground text-xs">Type: {popover.content.type}</p>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}

export const FactoryEnterprisePopoverSet: Story = {
  name: i18n.t(
    'popover.storyName.factoryEnterprisePopoverSet',
    'Factory: createFakeEnterprisePopoverSet'
  ),
  render: () => <EnterprisePopoverSetDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="enterprise-set-demo"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers.length).toBeGreaterThanOrEqual(10);
  },
};

function EnterpriseShowcaseDemo() {
  const showcase = React.useMemo(() => createEnterprisePopoverShowcase(), []);

  return (
    <div className="space-y-6" data-testid="enterprise-showcase-demo">
      <p className="text-sm font-medium">{i18n.t('popover.section.variants')}</p>
      {showcase.map((item) => (
        <div key={item.name} className="space-y-1">
          <span className="bg-muted rounded px-1.5 py-0.5 text-xs">{item.category}</span>
          <p className="text-sm font-medium">{item.name}</p>
          <p className="text-muted-foreground text-xs">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

export const FactoryEnterpriseShowcase: Story = {
  name: i18n.t(
    'popover.storyName.factoryEnterpriseShowcase',
    'Factory: createEnterprisePopoverShowcase'
  ),
  render: () => <EnterpriseShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="enterprise-showcase-demo"]')
    ).toBeInTheDocument();
  },
};

// ---------- Type Assertion Story ----------

function TypeAssertionsDemo() {
  const { t } = useTranslation();

  const align: PopoverAlign = 'center';
  const side: PopoverSide = 'bottom';
  const triggerType: PopoverTriggerType = 'button';
  const contentType: PopoverContentType = 'info';
  const state: PopoverState = 'open';

  const trigger: FakePopoverTrigger = createFakePopoverTrigger({ type: triggerType });
  const formField: FakePopoverFormField = createFakePopoverFormField();
  const listItem: FakePopoverListItem = createFakePopoverListItem();
  const content: FakePopoverContentType = createFakePopoverContent(contentType);
  const popover: FakePopover = createFakePopover({ side, align, state: 'closed' });
  const tracked: FakeTrackedPopover = createFakeTrackedPopover();
  const { trackingData }: { trackingData: PopoverTrackingData } = tracked;

  return (
    <div className="space-y-4" data-testid="type-assertions-demo">
      <p className="text-sm font-medium">{t('popover.section.variants')}</p>
      <div className="text-muted-foreground grid gap-2 text-xs">
        <p data-testid="type-align">Align: {align}</p>
        <p data-testid="type-side">Side: {side}</p>
        <p data-testid="type-trigger-type">Trigger type: {triggerType}</p>
        <p data-testid="type-content-type">Content type: {contentType}</p>
        <p data-testid="type-state">State: {state}</p>
        <p>Trigger ID: {trigger.id}</p>
        <p>Form field: {formField.label}</p>
        <p>List item: {listItem.label}</p>
        <p>Content ID: {content.id}</p>
        <p>Popover ID: {popover.id}</p>
        <p>Tracked ID: {tracked.trackingId}</p>
        <p>Tracking source: {trackingData.source}</p>
      </div>
    </div>
  );
}

export const FactoryTypeAssertions: Story = {
  name: i18n.t('popover.storyName.factoryTypeAssertions', 'Factory: Type Assertions'),
  render: () => <TypeAssertionsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="type-assertions-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="type-align"]')).toHaveTextContent('center');
    expect(canvasElement.querySelector('[data-testid="type-side"]')).toHaveTextContent('bottom');
    expect(canvasElement.querySelector('[data-testid="type-trigger-type"]')).toHaveTextContent(
      'button'
    );
    expect(canvasElement.querySelector('[data-testid="type-content-type"]')).toHaveTextContent(
      'info'
    );
    expect(canvasElement.querySelector('[data-testid="type-state"]')).toHaveTextContent('open');
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('popover.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('popover.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('popover.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('popover.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('popover.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: popoverStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

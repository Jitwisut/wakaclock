import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import type {
  FakeScrollArea,
  FakeScrollAreaCards,
  FakeScrollAreaList,
  FakeScrollAreaMessages,
  FakeScrollCard,
  FakeScrollItem,
  FakeScrollMessage,
  ScrollAreaContentType,
  ScrollAreaSizePreset,
  ScrollbarOrientation,
  ScrollbarVisibility,
} from '@/.storybook/stories/_factories/scroll-area.factory';
import {
  createFakeAlwaysVisibleScrollbarArea,
  createFakeBothScrollbarsArea,
  createFakeCodeScrollArea,
  createFakeHorizontalScrollArea,
  createFakeLargeScrollArea,
  createFakeMessageScrollArea,
  createFakeScrollArea,
  createFakeScrollAreas,
  createFakeScrollCard,
  createFakeScrollCards,
  createFakeScrollItem,
  createFakeScrollItems,
  createFakeScrollMessage,
  createFakeScrollMessages,
  createFakeSmallScrollArea,
  createFakeVerticalListScrollArea,
  createScrollAreaContentTypeMatrix,
  createScrollAreaOrientationMatrix,
  createScrollAreaShowcase,
  createScrollAreaSizeMatrix,
  createScrollAreaTestData,
  createScrollAreaVisibilityMatrix,
  SCROLL_AREA_CONTENT_TYPES,
  SCROLL_AREA_SIZE_PRESETS,
  SCROLLBAR_ORIENTATIONS,
  SCROLLBAR_VISIBILITY_OPTIONS,
  SIZE_DIMENSIONS,
} from '@/.storybook/stories/_factories/scroll-area.factory';
import {
  scrollAreaHandlers,
  scrollAreaStatusHandlers,
} from '@/.storybook/stories/_handlers/scroll-area.handlers';

import { ScrollArea } from '@/components/ui/scroll-area';

// ============ VIRTUALIZATION STORIES ============

import React from 'react';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type ScrollAreaDemoProps = {
  itemCount?: number;
  itemPrefix?: string;
};

function ScrollAreaDemo({ itemCount = 30, itemPrefix = 'Item' }: ScrollAreaDemoProps) {
  return (
    <ScrollArea className="h-60 w-[360px] rounded-md border p-3">
      <div className="space-y-2">
        {Array.from({ length: itemCount }, (_, i) => (
          <div className="text-sm" data-scroll-area-item data-scroll-area-item-index={i} key={i}>
            {itemPrefix} {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function I18nScrollAreaDemo({ itemCount = 30 }: Pick<ScrollAreaDemoProps, 'itemCount'>) {
  return <ScrollAreaDemo itemCount={itemCount} itemPrefix="Item" />;
}

const meta = {
  title: 'Components/UI/Scroll Area',
  component: ScrollAreaDemo,
  tags: ['autodocs'],
  args: {
    itemCount: 30,
    itemPrefix: 'Item',
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
    children: {
      control: false,
      description: i18n.t('scrollArea.argType.scrollableContent', 'Scrollable content'),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Appearance
    type: {
      control: 'select',
      options: ['auto', 'always', 'scroll', 'hover'],
      description: i18n.t(
        'scrollArea.argType.scrollbarVisibilityMode',
        'Scrollbar visibility mode'
      ),
      table: {
        category: 'Appearance',
        type: { summary: "'auto' | 'always' | 'scroll' | 'hover'" },
        defaultValue: { summary: 'auto' },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('scrollArea.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    scrollHideDelay: {
      control: 'number',
      description: i18n.t(
        'scrollArea.argType.delayBeforeHidingScrollbarsInMs',
        'Delay before hiding scrollbars in ms'
      ),
      table: {
        category: 'State',
        type: { summary: 'number' },
        defaultValue: { summary: '600' },
      },
    },
    // Layout
    dir: {
      control: 'select',
      options: ['ltr', 'rtl'],
      description: i18n.t('scrollArea.argType.textDirection', 'Text direction'),
      table: {
        category: 'Layout',
        type: { summary: "'ltr' | 'rtl'" },
        defaultValue: { summary: 'ltr' },
      },
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: i18n.t('scrollArea.argType.scrollbarOrientation', 'Scrollbar orientation'),
      table: {
        category: 'Layout',
        type: { summary: "'horizontal' | 'vertical'" },
        defaultValue: { summary: 'vertical' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('scrollArea.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('scrollArea.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('scrollArea.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('scrollArea.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('scrollArea.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('scrollArea.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('scrollArea.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onScroll: {
      action: 'onScroll',
      description: i18n.t('scrollArea.argType.scrollEventHandler', 'Scroll event handler'),
      table: { category: 'Events' },
    },
    // Demo
    itemCount: {
      control: { type: 'number' },
      table: { category: 'Demo' },
    },
    itemPrefix: {
      control: { type: 'text' },
      table: { category: 'Demo' },
    },
    // ScrollArea Props Reference (Radix ScrollArea.Root):
    // - type: Scrollbar visibility ('auto' | 'always' | 'scroll' | 'hover')
    //   - 'auto': Scrollbars hide when not scrolling
    //   - 'always': Scrollbars always visible
    //   - 'scroll': Scrollbars visible when scrolling
    //   - 'hover': Scrollbars visible on hover
    // - scrollHideDelay: Delay before hiding scrollbars in ms (number, default: 600)
    // - dir: Text direction ('ltr' | 'rtl')
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // ScrollAreaViewport Props Reference (Radix ScrollArea.Viewport):
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    // Note: This is the scrollable container
    //
    // ScrollAreaScrollbar Props Reference (Radix ScrollArea.Scrollbar):
    // - orientation: Scrollbar orientation ('horizontal' | 'vertical')
    // - forceMount: Force mount when hidden (boolean)
    // - className: Additional CSS classes (string)
    //
    // ScrollAreaThumb Props Reference (Radix ScrollArea.Thumb):
    // - className: Additional CSS classes (string)
    //
    // ScrollAreaCorner Props Reference (Radix ScrollArea.Corner):
    // - className: Additional CSS classes (string)
    // Note: Corner where horizontal and vertical scrollbars meet
    //
    // Usage Notes:
    // - Set explicit height/width on ScrollArea container
    // - Content inside scrolls when it overflows container
    // - Custom scrollbar styling via CSS classes
  },
  parameters: {
    msw: { handlers: scrollAreaHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const scrollArea = canvasElement.querySelector('[data-slot="scroll-area"]');
    const viewport = canvasElement.querySelector('[data-slot="scroll-area-viewport"]');
    const scrollbar = canvasElement.querySelector('[data-slot="scroll-area-scrollbar"]');
    const thumb = canvasElement.querySelector('[data-slot="scroll-area-thumb"]');

    if (!(scrollArea instanceof HTMLElement)) {
      throw new Error('Scroll area root was not found.');
    }

    if (!(viewport instanceof HTMLElement)) {
      throw new Error('Scroll area viewport was not found.');
    }

    if (!(scrollbar instanceof HTMLElement)) {
      throw new Error('Scroll area scrollbar was not found.');
    }

    if (!(thumb instanceof HTMLElement)) {
      throw new Error('Scroll area thumb was not found.');
    }

    expect(scrollArea.getAttribute('data-slot')).toBe('scroll-area');
    expect(viewport.getAttribute('data-slot')).toBe('scroll-area-viewport');
    expect(scrollbar.getAttribute('data-slot')).toBe('scroll-area-scrollbar');
    expect(thumb.getAttribute('data-slot')).toBe('scroll-area-thumb');

    const itemCount = typeof args.itemCount === 'number' ? args.itemCount : 30;

    const firstItem = viewport.querySelector('[data-scroll-area-item-index="0"]');
    const lastItem = viewport.querySelector(`[data-scroll-area-item-index=\"${itemCount - 1}\"]`);

    if (!(firstItem instanceof HTMLElement)) {
      throw new Error('Scroll area item 1 was not found.');
    }

    if (!(lastItem instanceof HTMLElement)) {
      throw new Error('Scroll area last item was not found.');
    }

    const getViewportRect = () => viewport.getBoundingClientRect();
    const getLastItemRect = () => lastItem.getBoundingClientRect();

    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);

    const viewportRect = getViewportRect();
    const lastItemRect = getLastItemRect();

    expect(lastItemRect.top).toBeGreaterThan(viewportRect.bottom);

    viewport.scrollTop = viewport.scrollHeight;
    viewport.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      const nextViewportRect = getViewportRect();
      const nextLastItemRect = getLastItemRect();

      expect(viewport.scrollTop).not.toBe(0);
      expect(nextLastItemRect.bottom).toBeLessThanOrEqual(nextViewportRect.bottom + 2);
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async (context) => {
    await Default.play?.(context);
  },
};

function VariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('scrollArea.variants.vertical')}</p>
        <ScrollArea className="h-40 w-[300px] rounded-md border p-3">
          <div className="space-y-2">
            {Array.from({ length: 20 }, (_, i) => (
              <div className="text-sm" key={i}>
                Vertical item {i + 1}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('scrollArea.variants.horizontal')}</p>
        <ScrollArea className="h-20 w-[300px] rounded-md border p-3">
          <div className="flex gap-4 whitespace-nowrap">
            {Array.from({ length: 20 }, (_, i) => (
              <div className="bg-muted inline-block rounded px-4 py-2 text-sm" key={i}>
                Item {i + 1}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('scrollArea.variants.bothAxes')}</p>
        <ScrollArea className="h-40 w-[300px] rounded-md border p-3">
          <div className="w-[600px] space-y-2">
            {Array.from({ length: 20 }, (_, i) => (
              <div className="text-sm whitespace-nowrap" key={i}>
                This is a long line of text for item {i + 1} that extends beyond the container width
                to demonstrate horizontal scrolling.
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('scrollArea.variants.withRichContent')}</p>
        <ScrollArea className="h-48 w-[350px] rounded-md border p-4">
          <div className="space-y-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div className="rounded-lg border p-3" key={i}>
                <div className="font-medium">Card {i + 1}</div>
                <p className="text-muted-foreground mt-1 text-sm">
                  This is the description for card {i + 1}. It contains some sample text.
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    // Verify all variant sections are rendered
    const scrollAreas = canvasElement.querySelectorAll('[data-slot="scroll-area"]');
    expect(scrollAreas).toHaveLength(4);

    // Verify vertical variant
    const verticalItems = canvasElement.querySelectorAll('[data-slot="scroll-area-viewport"]')[0];
    expect(verticalItems).toBeInTheDocument();

    // Verify horizontal variant
    const horizontalItems = canvasElement.querySelectorAll('[data-slot="scroll-area-viewport"]')[1];
    expect(horizontalItems).toBeInTheDocument();

    // Verify both axes variant
    const bothAxesItems = canvasElement.querySelectorAll('[data-slot="scroll-area-viewport"]')[2];
    expect(bothAxesItems).toBeInTheDocument();

    // Verify rich content variant
    const richContentItems = canvasElement.querySelectorAll(
      '[data-slot="scroll-area-viewport"]'
    )[3];
    expect(richContentItems).toBeInTheDocument();
  },
};

function SizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('scrollArea.sizes.small')}</p>
        <ScrollArea className="h-[120px] w-[300px] rounded-md border p-3">
          <div className="space-y-2">
            {Array.from({ length: 15 }, (_, i) => (
              <div className="text-sm" key={i}>
                Item {i + 1}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('scrollArea.sizes.medium')}</p>
        <ScrollArea className="h-[200px] w-[300px] rounded-md border p-3">
          <div className="space-y-2">
            {Array.from({ length: 15 }, (_, i) => (
              <div className="text-sm" key={i}>
                Item {i + 1}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('scrollArea.sizes.large')}</p>
        <ScrollArea className="h-[320px] w-[300px] rounded-md border p-3">
          <div className="space-y-2">
            {Array.from({ length: 15 }, (_, i) => (
              <div className="text-sm" key={i}>
                Item {i + 1}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    // Verify all size variants are rendered
    const scrollAreas = canvasElement.querySelectorAll('[data-slot="scroll-area"]');
    expect(scrollAreas).toHaveLength(3);

    // Verify small size
    const smallArea = scrollAreas[0];
    expect(smallArea).toBeInTheDocument();
    expect(smallArea.classList.contains('h-[120px]')).toBe(true);

    // Verify medium size
    const mediumArea = scrollAreas[1];
    expect(mediumArea).toBeInTheDocument();
    expect(mediumArea.classList.contains('h-[200px]')).toBe(true);

    // Verify large size
    const largeArea = scrollAreas[2];
    expect(largeArea).toBeInTheDocument();
    expect(largeArea.classList.contains('h-[320px]')).toBe(true);
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
  name: i18n.t('scrollArea.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: (args) => <I18nScrollAreaDemo itemCount={args.itemCount} />,
  play: async (context) => {
    const root = context.canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(root.ownerDocument.documentElement.lang).toBe('ja');

    const viewport = root.querySelector('[data-slot="scroll-area-viewport"]');

    if (!(viewport instanceof HTMLElement)) {
      throw new Error('Scroll area viewport was not found.');
    }

    const firstItem = viewport.querySelector('[data-scroll-area-item-index="0"]');

    if (!(firstItem instanceof HTMLElement)) {
      throw new Error('Scroll area item 1 was not found.');
    }

    expect(firstItem.textContent).toBe('項目 1');

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
  name: i18n.t('scrollArea.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    <ScrollArea className="h-[200px] w-[300px] rounded-md border" tabIndex={0}>
      <div className="p-4">
        <h4 className="mb-4 text-sm font-medium">
          {i18n.t('scrollArea.story.accessibleScrollArea', 'Accessible Scroll Area')}
        </h4>
        <div className="space-y-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <button
              key={`focusable-item-${String(i)}`}
              className="hover:bg-muted focus:ring-ring block w-full rounded border p-2 text-left text-sm focus:ring-2 focus:outline-none"
            >
              Focusable Item {i + 1}
            </button>
          ))}
        </div>
      </div>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Find the scroll area
    const scrollArea = canvasElement.querySelector('[data-slot="scroll-area"]');
    expect(scrollArea).toBeInTheDocument();

    // Test that first button can be focused
    const firstButton = canvas.getByRole('button', { name: 'Focusable Item 1' });
    expect(firstButton).toBeInTheDocument();

    // Tab to first button
    await userEvent.tab();
    await userEvent.tab();
    expect(doc.activeElement).toBe(firstButton);

    // Test keyboard navigation through items
    await userEvent.tab();
    const secondButton = canvas.getByRole('button', { name: 'Focusable Item 2' });
    expect(doc.activeElement).toBe(secondButton);

    // Test scroll behavior with keyboard
    await userEvent.keyboard('{Tab}{Tab}{Tab}{Tab}{Tab}');
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaHandlers },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.loading },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.badRequest },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.unauthorized },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.forbidden },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.unprocessableEntity },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.internalServerError },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.networkError },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

function VirtualizedScrollArea({ totalItems = 10_000 }: { totalItems?: number }) {
  const [visibleItems, setVisibleItems] = React.useState<number[]>([]);
  const itemHeight = 32;
  const viewportHeight = 300;
  const buffer = 5;

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop } = event.currentTarget;
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
      const endIndex = Math.min(
        totalItems,
        Math.ceil((scrollTop + viewportHeight) / itemHeight) + buffer
      );

      const items: number[] = [];
      for (let i = startIndex; i < endIndex; i++) {
        items.push(i);
      }
      setVisibleItems(items);
    },
    [totalItems]
  );

  // Initialize visible items
  React.useEffect(() => {
    const initialEnd = Math.min(totalItems, Math.ceil(viewportHeight / itemHeight) + buffer);
    const items: number[] = [];
    for (let i = 0; i < initialEnd; i++) {
      items.push(i);
    }
    setVisibleItems(items);
  }, [totalItems]);

  return (
    <div className="w-[400px]">
      <p className="text-muted-foreground mb-2 text-sm">
        Virtual list with {totalItems.toLocaleString()} items (only visible items are rendered)
      </p>
      <ScrollArea className="h-[300px] rounded-md border" data-testid="virtualized-scroll-area">
        <div
          style={{ height: `${totalItems * itemHeight}px`, position: 'relative' }}
          onScroll={handleScroll}
        >
          {visibleItems.map((index) => (
            <div
              key={index}
              data-virtual-item-index={index}
              style={{
                position: 'absolute',
                top: `${index * itemHeight}px`,
                left: 0,
                right: 0,
                height: `${itemHeight}px`,
                padding: '6px 12px',
              }}
              className="border-b text-sm"
            >
              Virtual Item {index + 1}
            </div>
          ))}
        </div>
      </ScrollArea>
      <p className="text-muted-foreground mt-2 text-xs">
        Rendered: {visibleItems.length} / {totalItems.toLocaleString()} items
      </p>
    </div>
  );
}

export const Virtualization: Story = {
  name: i18n.t('scrollArea.storyName.virtualization', 'Virtualization (10K items)'),
  render: () => <VirtualizedScrollArea totalItems={10_000} />,
  play: async ({ canvasElement }) => {
    const scrollArea = canvasElement.querySelector('[data-testid="virtualized-scroll-area"]');
    expect(scrollArea).toBeInTheDocument();

    // Verify not all items are rendered initially
    const initialItems = canvasElement.querySelectorAll('[data-virtual-item-index]');
    expect(initialItems.length).toBeLessThan(100);
  },
};

export const VirtualizationSmall: Story = {
  name: i18n.t('scrollArea.storyName.virtualizationSmall', 'Virtualization (1K items)'),
  render: () => <VirtualizedScrollArea totalItems={1000} />,
  play: async ({ canvasElement }) => {
    const scrollArea = canvasElement.querySelector('[data-testid="virtualized-scroll-area"]');
    expect(scrollArea).toBeInTheDocument();

    // Verify not all items are rendered initially
    const initialItems = canvasElement.querySelectorAll('[data-virtual-item-index]');
    expect(initialItems.length).toBeLessThan(100);
  },
};

export const VirtualizationLarge: Story = {
  name: i18n.t('scrollArea.storyName.virtualizationLarge', 'Virtualization (100K items)'),
  render: () => <VirtualizedScrollArea totalItems={100_000} />,
  play: async ({ canvasElement }) => {
    const scrollArea = canvasElement.querySelector('[data-testid="virtualized-scroll-area"]');
    expect(scrollArea).toBeInTheDocument();

    // Verify not all items are rendered initially
    const initialItems = canvasElement.querySelectorAll('[data-virtual-item-index]');
    expect(initialItems.length).toBeLessThan(100);
  },
};

function InfiniteScrollDemo() {
  const [items, setItems] = React.useState<string[]>(() =>
    Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)
  );
  const [loading, setLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  const loadMore = React.useCallback(() => {
    if (loading || !hasMore) return;

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const currentLength = items.length;
      if (currentLength >= 100) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      const newItems = Array.from({ length: 20 }, (_, i) => `Item ${currentLength + i + 1}`);
      setItems((prev) => [...prev, ...newItems]);
      setLoading(false);
    }, 1000);
  }, [items.length, loading, hasMore]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="w-[400px]">
      <p className="text-muted-foreground mb-2 text-sm">
        Infinite scroll - loads more items as you scroll
      </p>
      <ScrollArea className="h-[300px] rounded-md border" data-testid="infinite-scroll-area">
        <div className="space-y-2 p-3">
          {items.map((item, i) => (
            <div
              key={`infinite-item-${String(i)}`}
              className="rounded border p-2 text-sm"
              data-infinite-item-index={i}
            >
              {item}
            </div>
          ))}
          {loading && (
            <div className="text-muted-foreground p-2 text-center text-sm">
              {i18n.t('scrollArea.story.loadingMore', 'Loading more...')}
            </div>
          )}
          {!hasMore && (
            <div className="text-muted-foreground p-2 text-center text-sm">
              No more items to load
            </div>
          )}
          <div ref={loadMoreRef} className="h-1" />
        </div>
      </ScrollArea>
      <p className="text-muted-foreground mt-2 text-xs">
        Loaded: {items.length} items {!hasMore && '(complete)'}
      </p>
    </div>
  );
}

export const InfiniteScroll: Story = {
  name: i18n.t('scrollArea.storyName.infiniteScroll', 'Infinite Scroll'),
  render: () => <InfiniteScrollDemo />,
  play: async ({ canvasElement }) => {
    const scrollArea = canvasElement.querySelector('[data-testid="infinite-scroll-area"]');
    expect(scrollArea).toBeInTheDocument();

    // Verify initial items are rendered
    const initialItems = canvasElement.querySelectorAll('[data-infinite-item-index]');
    expect(initialItems.length).toBe(20);
  },
};

function LazyLoadingScrollDemo() {
  const [items, setItems] = React.useState<
    Array<{ content?: string; id: number; loaded: boolean }>
  >(() => Array.from({ length: 50 }, (_, i) => ({ id: i, loaded: false })));

  const loadItem = React.useCallback((id: number) => {
    // Simulate lazy loading content
    setTimeout(() => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, loaded: true, content: `Lazy loaded content for item ${id + 1}` }
            : item
        )
      );
    }, 500);
  }, []);

  return (
    <div className="w-[400px]">
      <p className="text-muted-foreground mb-2 text-sm">
        Items load their content lazily when scrolled into view
      </p>
      <ScrollArea className="h-[300px] rounded-md border" data-testid="lazy-scroll-area">
        <div className="space-y-2 p-3">
          {items.map((item) => (
            <LazyLoadItem
              key={item.id}
              item={item}
              onVisible={() => !item.loaded && loadItem(item.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function LazyLoadItem({
  item,
  onVisible,
}: {
  item: { content?: string; id: number; loaded: boolean };
  onVisible: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onVisible();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [onVisible]);

  return (
    <div
      ref={ref}
      className="min-h-[40px] rounded border p-2 text-sm"
      data-lazy-item-index={item.id}
    >
      {item.loaded ? (
        item.content
      ) : (
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      )}
    </div>
  );
}

export const LazyLoading: Story = {
  name: i18n.t('scrollArea.storyName.lazyLoading', 'Lazy Loading Content'),
  render: () => <LazyLoadingScrollDemo />,
  play: async ({ canvasElement }) => {
    const scrollArea = canvasElement.querySelector('[data-testid="lazy-scroll-area"]');
    expect(scrollArea).toBeInTheDocument();

    // Wait for some items to load
    await waitFor(
      () => {
        const loadedItems = canvasElement.querySelectorAll('[data-lazy-item-index]');
        expect(loadedItems.length).not.toBe(0);
      },
      { timeout: 3000 }
    );
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.tooManyRequests },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.badGateway },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.serviceUnavailable },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.gatewayTimeout },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: scrollAreaStatusHandlers.slowResponse },
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const EmptyData: Story = {
  render: () => (
    <ScrollArea className="h-60 w-[360px] rounded-md border p-3" data-testid="empty-scroll-area">
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">
          {i18n.t('scrollArea.story.noItemsToDisplay', 'No items to display')}
        </p>
      </div>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    const scrollArea = canvasElement.querySelector('[data-testid="empty-scroll-area"]');
    expect(scrollArea).toBeInTheDocument();
  },
};

export const WithFakerData: Story = {
  render: () => {
    const items = createFakeScrollItems(30);

    return (
      <ScrollArea className="h-60 w-[400px] rounded-md border p-3" data-testid="faker-scroll-area">
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="rounded border p-2 text-sm"
              data-scroll-area-item-index={i}
            >
              <div className="font-medium">{item.content}</div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  },
  play: async ({ canvasElement }) => {
    const scrollArea = canvasElement.querySelector('[data-testid="faker-scroll-area"]');
    expect(scrollArea).toBeInTheDocument();

    const items = scrollArea!.querySelectorAll('[data-scroll-area-item-index]');
    expect(items).toHaveLength(30);
  },
};

export const WithAsyncData: Story = {
  ...WithFakerData,
  parameters: {
    msw: { handlers: scrollAreaHandlers },
  },
  play: async (context) => {
    await WithFakerData.play?.(context);
  },
};

// ============ FACTORY WIRING: SINGLE ITEM FACTORIES ============

function SingleScrollItemDemo() {
  const item: FakeScrollItem = createFakeScrollItem(0);
  return (
    <ScrollArea className="h-40 w-[360px] rounded-md border p-3" data-testid="single-item-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.story.description')}</p>
      <div className="rounded border p-2 text-sm" data-scroll-area-item-index={0}>
        <span className="font-medium">#{item.index + 1}</span> {item.content}
        {item.isSelected ? ' (selected)' : ''}
      </div>
    </ScrollArea>
  );
}

export const SingleScrollItem: Story = {
  name: i18n.t('scrollArea.storyName.singleScrollItem', 'Factory: Single Scroll Item'),
  render: () => <SingleScrollItemDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="single-item-area"]');
    expect(area).toBeInTheDocument();
    const item = canvasElement.querySelector('[data-scroll-area-item-index="0"]');
    expect(item).toBeInTheDocument();
    expect(item!.textContent).toBeTruthy();
  },
};

function ScrollMessageDemo() {
  const message: FakeScrollMessage = createFakeScrollMessage(false);
  const ownMessage: FakeScrollMessage = createFakeScrollMessage(true);
  return (
    <ScrollArea className="h-48 w-[400px] rounded-md border p-3" data-testid="message-item-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.story.description')}</p>
      <div className="space-y-3">
        <div className="rounded border p-2 text-sm" data-message-item="other">
          <div className="font-medium">{message.sender}</div>
          <div>{message.content}</div>
        </div>
        <div className="bg-primary/10 rounded border p-2 text-sm" data-message-item="own">
          <div className="font-medium">{ownMessage.sender}</div>
          <div>{ownMessage.content}</div>
        </div>
      </div>
    </ScrollArea>
  );
}

export const ScrollMessageItem: Story = {
  name: i18n.t('scrollArea.storyName.scrollMessageItem', 'Factory: Single Scroll Message'),
  render: () => <ScrollMessageDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="message-item-area"]');
    expect(area).toBeInTheDocument();
    const otherMsg = canvasElement.querySelector('[data-message-item="other"]');
    const ownMsg = canvasElement.querySelector('[data-message-item="own"]');
    expect(otherMsg).toBeInTheDocument();
    expect(ownMsg).toBeInTheDocument();
  },
};

function ScrollMessagesListDemo() {
  const messages: FakeScrollMessage[] = createFakeScrollMessages(15);
  return (
    <ScrollArea className="h-60 w-[400px] rounded-md border p-3" data-testid="messages-list-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.section.content')}</p>
      <div className="space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded border p-2 text-sm ${msg.isOwn ? 'bg-primary/10 ml-8' : 'mr-8'}`}
            data-messages-list-item
          >
            <div className="text-xs font-medium">{msg.sender}</div>
            <div>{msg.content}</div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export const ScrollMessagesList: Story = {
  name: i18n.t('scrollArea.storyName.scrollMessagesList', 'Factory: Scroll Messages List'),
  render: () => <ScrollMessagesListDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="messages-list-area"]');
    expect(area).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-messages-list-item]');
    expect(items.length).toBe(15);
  },
};

function SingleScrollCardDemo() {
  const card: FakeScrollCard = createFakeScrollCard();
  return (
    <ScrollArea className="h-40 w-[360px] rounded-md border p-3" data-testid="single-card-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.story.description')}</p>
      <div className="rounded-lg border p-3" data-card-item>
        <div className="font-medium">{card.title}</div>
        {card.description && (
          <p className="text-muted-foreground mt-1 text-sm">{card.description}</p>
        )}
      </div>
    </ScrollArea>
  );
}

export const SingleScrollCard: Story = {
  name: i18n.t('scrollArea.storyName.singleScrollCard', 'Factory: Single Scroll Card'),
  render: () => <SingleScrollCardDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="single-card-area"]');
    expect(area).toBeInTheDocument();
    const card = canvasElement.querySelector('[data-card-item]');
    expect(card).toBeInTheDocument();
    expect(card!.textContent).toBeTruthy();
  },
};

function ScrollCardsListDemo() {
  const cards: FakeScrollCard[] = createFakeScrollCards(12);
  return (
    <ScrollArea className="h-60 w-[400px] rounded-md border p-3" data-testid="cards-list-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.section.content')}</p>
      <div className="space-y-3">
        {cards.map((card) => (
          <div key={card.id} className="rounded-lg border p-3" data-cards-list-item>
            <div className="font-medium">{card.title}</div>
            {card.description && (
              <p className="text-muted-foreground mt-1 text-sm">{card.description}</p>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export const ScrollCardsList: Story = {
  name: i18n.t('scrollArea.storyName.scrollCardsList', 'Factory: Scroll Cards List'),
  render: () => <ScrollCardsListDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="cards-list-area"]');
    expect(area).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-cards-list-item]');
    expect(items.length).toBe(12);
  },
};

// ============ FACTORY WIRING: SCROLL AREA CONFIG FACTORIES ============

function ScrollAreaConfigDemo() {
  const config: FakeScrollArea = createFakeScrollArea({ sizePreset: 'md' });
  return (
    <div data-testid="scroll-area-config">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.story.description')}</p>
      <ScrollArea
        className="rounded-md border p-3"
        style={{ width: config.width, height: config.height }}
      >
        <div className="space-y-2">
          {config.content.map((item) => (
            <div key={item.id} className="text-sm" data-config-item>
              {item.content}
            </div>
          ))}
        </div>
      </ScrollArea>
      <p className="text-muted-foreground mt-2 text-xs">
        Orientation: {config.orientation} | Size: {config.sizePreset} | Visibility:{' '}
        {config.scrollbarVisibility}
      </p>
    </div>
  );
}

export const ScrollAreaConfig: Story = {
  name: i18n.t('scrollArea.storyName.scrollAreaConfig', 'Factory: Scroll Area Config'),
  render: () => <ScrollAreaConfigDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="scroll-area-config"]');
    expect(area).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-config-item]');
    expect(items.length).toBeGreaterThan(0);
  },
};

function ScrollAreasMultipleDemo() {
  const areas: FakeScrollArea[] = createFakeScrollAreas(3, { sizePreset: 'sm' });
  return (
    <div className="flex flex-col gap-4" data-testid="multiple-areas">
      <p className="text-muted-foreground text-sm">{i18n.t('scrollArea.section.variants')}</p>
      {areas.map((config) => (
        <ScrollArea
          key={config.id}
          className="rounded-md border p-3"
          style={{ width: config.width, height: config.height }}
          data-multi-area
        >
          <div className="space-y-1">
            {config.content.slice(0, 15).map((item) => (
              <div key={item.id} className="text-sm">
                {item.content}
              </div>
            ))}
          </div>
        </ScrollArea>
      ))}
    </div>
  );
}

export const MultipleScrollAreas: Story = {
  name: i18n.t('scrollArea.storyName.multipleScrollAreas', 'Factory: Multiple Scroll Areas'),
  render: () => <ScrollAreasMultipleDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="multiple-areas"]');
    expect(wrapper).toBeInTheDocument();
    const areas = canvasElement.querySelectorAll('[data-multi-area]');
    expect(areas.length).toBe(3);
  },
};

// ============ FACTORY WIRING: SPECIALIZED FACTORIES ============

function VerticalListScrollAreaDemo() {
  const config: FakeScrollAreaList = createFakeVerticalListScrollArea(40);
  return (
    <div data-testid="vertical-list-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.variants.vertical')}</p>
      <ScrollArea
        className="rounded-md border p-3"
        style={{ width: config.width, height: config.height }}
      >
        <div className="space-y-1">
          {config.items.map((item) => (
            <div key={item.id} className="text-sm" data-vertical-list-item>
              {item.content}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export const VerticalListScrollArea: Story = {
  name: i18n.t('scrollArea.storyName.verticalListScrollArea', 'Factory: Vertical List'),
  render: () => <VerticalListScrollAreaDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="vertical-list-area"]');
    expect(area).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-vertical-list-item]');
    expect(items.length).toBe(40);
  },
};

function HorizontalScrollAreaDemo() {
  const config: FakeScrollAreaCards = createFakeHorizontalScrollArea(8);
  return (
    <div data-testid="horizontal-area">
      <p className="text-muted-foreground mb-2 text-sm">
        {i18n.t('scrollArea.variants.horizontal')}
      </p>
      <ScrollArea className="rounded-md border" style={{ height: config.height, width: '400px' }}>
        <div className="flex gap-4 p-3">
          {config.cards.map((card) => (
            <div
              key={card.id}
              className="w-[160px] shrink-0 rounded-lg border p-3"
              data-horizontal-card
            >
              <div className="font-medium">{card.title}</div>
              {card.description && (
                <p className="text-muted-foreground mt-1 text-xs">{card.description}</p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export const HorizontalScrollArea: Story = {
  name: i18n.t('scrollArea.storyName.horizontalScrollArea', 'Factory: Horizontal Gallery'),
  render: () => <HorizontalScrollAreaDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="horizontal-area"]');
    expect(area).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-horizontal-card]');
    expect(cards.length).toBe(8);
  },
};

function MessageScrollAreaDemo() {
  const config: FakeScrollAreaMessages = createFakeMessageScrollArea(20);
  return (
    <div data-testid="message-scroll-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.section.content')}</p>
      <ScrollArea
        className="rounded-md border p-3"
        style={{ width: config.width, height: config.height }}
      >
        <div className="space-y-2">
          {config.messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded border p-2 text-sm ${msg.isOwn ? 'bg-primary/10 ml-8' : 'mr-8'}`}
              data-chat-message
            >
              <div className="text-xs font-medium">{msg.sender}</div>
              <div>{msg.content}</div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export const MessageScrollArea: Story = {
  name: i18n.t('scrollArea.storyName.messageScrollArea', 'Factory: Message Chat Area'),
  render: () => <MessageScrollAreaDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="message-scroll-area"]');
    expect(area).toBeInTheDocument();
    const messages = canvasElement.querySelectorAll('[data-chat-message]');
    expect(messages.length).toBe(20);
  },
};

function CodeScrollAreaDemo() {
  const config: FakeScrollArea = createFakeCodeScrollArea(60);
  return (
    <div data-testid="code-scroll-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.story.description')}</p>
      <ScrollArea
        className="rounded-md border bg-zinc-950 p-3 font-mono text-green-400"
        style={{ width: config.width, height: config.height }}
      >
        <div className="space-y-0">
          {config.content.map((line) => (
            <div key={line.id} className="text-xs whitespace-pre" data-code-line>
              {line.content}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export const CodeScrollArea: Story = {
  name: i18n.t('scrollArea.storyName.codeScrollArea', 'Factory: Code Block'),
  render: () => <CodeScrollAreaDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="code-scroll-area"]');
    expect(area).toBeInTheDocument();
    const lines = canvasElement.querySelectorAll('[data-code-line]');
    expect(lines.length).toBe(60);
  },
};

function SmallScrollAreaDemo() {
  const config: FakeScrollArea = createFakeSmallScrollArea(15);
  return (
    <div data-testid="small-scroll-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.sizes.small')}</p>
      <ScrollArea
        className="rounded-md border p-3"
        style={{ width: config.width, height: config.height }}
      >
        <div className="space-y-1">
          {config.content.map((item) => (
            <div key={item.id} className="text-sm" data-small-item>
              {item.content}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export const SmallScrollArea: Story = {
  name: i18n.t('scrollArea.storyName.smallScrollArea', 'Factory: Small Scroll Area'),
  render: () => <SmallScrollAreaDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="small-scroll-area"]');
    expect(area).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-small-item]');
    expect(items.length).toBe(15);
  },
};

function LargeScrollAreaDemo() {
  const config: FakeScrollArea = createFakeLargeScrollArea(100);
  return (
    <div data-testid="large-scroll-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.sizes.large')}</p>
      <ScrollArea
        className="rounded-md border p-3"
        style={{ width: config.width, height: config.height }}
      >
        <div className="space-y-1">
          {config.content.map((item) => (
            <div key={item.id} className="text-sm" data-large-item>
              {item.content}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export const LargeScrollArea: Story = {
  name: i18n.t('scrollArea.storyName.largeScrollArea', 'Factory: Large Scroll Area'),
  render: () => <LargeScrollAreaDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="large-scroll-area"]');
    expect(area).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-large-item]');
    expect(items.length).toBe(100);
  },
};

function AlwaysVisibleScrollbarDemo() {
  const config: FakeScrollArea = createFakeAlwaysVisibleScrollbarArea();
  return (
    <div data-testid="always-visible-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.story.description')}</p>
      <ScrollArea
        className="rounded-md border p-3"
        style={{ width: config.width, height: config.height }}
        type="always"
      >
        <div className="space-y-1">
          {config.content.map((item) => (
            <div key={item.id} className="text-sm" data-always-visible-item>
              {item.content}
            </div>
          ))}
        </div>
      </ScrollArea>
      <p className="text-muted-foreground mt-1 text-xs">Visibility: {config.scrollbarVisibility}</p>
    </div>
  );
}

export const AlwaysVisibleScrollbar: Story = {
  name: i18n.t('scrollArea.storyName.alwaysVisibleScrollbar', 'Factory: Always Visible Scrollbar'),
  render: () => <AlwaysVisibleScrollbarDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="always-visible-area"]');
    expect(area).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-always-visible-item]');
    expect(items.length).toBeGreaterThan(0);
  },
};

function BothScrollbarsDemo() {
  const config: FakeScrollArea = createFakeBothScrollbarsArea(800, 800);
  return (
    <div data-testid="both-scrollbars-area">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('scrollArea.variants.bothAxes')}</p>
      <ScrollArea
        className="rounded-md border p-3"
        style={{ width: config.width, height: config.height }}
      >
        <div style={{ width: '800px' }} className="space-y-1">
          {config.content.map((item) => (
            <div key={item.id} className="text-sm whitespace-nowrap" data-both-scrollbar-item>
              {item.content} -- extended content to force horizontal scroll
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export const BothScrollbars: Story = {
  name: i18n.t('scrollArea.storyName.bothScrollbars', 'Factory: Both Scrollbars'),
  render: () => <BothScrollbarsDemo />,
  play: async ({ canvasElement }) => {
    const area = canvasElement.querySelector('[data-testid="both-scrollbars-area"]');
    expect(area).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-both-scrollbar-item]');
    expect(items.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY WIRING: MATRIX FACTORIES ============

function OrientationMatrixDemo() {
  const matrix: FakeScrollArea[] = createScrollAreaOrientationMatrix();
  return (
    <div className="flex flex-col gap-4" data-testid="orientation-matrix">
      <p className="text-muted-foreground text-sm">{i18n.t('scrollArea.section.directions')}</p>
      {matrix.map((config) => (
        <div key={config.id}>
          <p className="mb-1 text-xs font-medium">Orientation: {config.orientation}</p>
          <ScrollArea
            className="rounded-md border p-3"
            style={{ width: '300px', height: '120px' }}
            data-orientation-matrix-item
          >
            <div className={config.orientation === 'horizontal' ? 'flex gap-2' : 'space-y-1'}>
              {config.content.slice(0, 10).map((item) => (
                <div key={item.id} className="shrink-0 text-sm">
                  {item.content}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

export const OrientationMatrix: Story = {
  name: i18n.t('scrollArea.storyName.orientationMatrix', 'Factory: Orientation Matrix'),
  render: () => <OrientationMatrixDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="orientation-matrix"]');
    expect(wrapper).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-orientation-matrix-item]');
    expect(items.length).toBe(SCROLLBAR_ORIENTATIONS.length);
  },
};

function SizeMatrixDemo() {
  const matrix: FakeScrollArea[] = createScrollAreaSizeMatrix();
  return (
    <div className="flex flex-col gap-4" data-testid="size-matrix">
      <p className="text-muted-foreground text-sm">{i18n.t('scrollArea.section.sizes')}</p>
      {matrix.map((config) => {
        const dims = SIZE_DIMENSIONS[config.sizePreset];
        return (
          <div key={config.id}>
            <p className="mb-1 text-xs font-medium">
              Size: {config.sizePreset} ({dims.width} x {dims.height})
            </p>
            <ScrollArea
              className="rounded-md border p-3"
              style={{ width: dims.width, height: dims.height, maxWidth: '400px' }}
              data-size-matrix-item
            >
              <div className="space-y-1">
                {config.content.slice(0, 15).map((item) => (
                  <div key={item.id} className="text-sm">
                    {item.content}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}

export const SizeMatrix: Story = {
  name: i18n.t('scrollArea.storyName.sizeMatrix', 'Factory: Size Matrix'),
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="size-matrix"]');
    expect(wrapper).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-size-matrix-item]');
    expect(items.length).toBe(SCROLL_AREA_SIZE_PRESETS.length);
  },
};

function ContentTypeMatrixDemo() {
  const matrix: FakeScrollArea[] = createScrollAreaContentTypeMatrix();
  return (
    <div className="flex flex-col gap-4" data-testid="content-type-matrix">
      <p className="text-muted-foreground text-sm">{i18n.t('scrollArea.section.content')}</p>
      {matrix.map((config) => (
        <div key={config.id}>
          <p className="mb-1 text-xs font-medium">Content: {config.contentType}</p>
          <ScrollArea
            className="rounded-md border p-3"
            style={{ width: '300px', height: '120px' }}
            data-content-type-item
          >
            <div className="space-y-1">
              {config.content.slice(0, 8).map((item) => (
                <div key={item.id} className="text-sm">
                  {item.content}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

export const ContentTypeMatrix: Story = {
  name: i18n.t('scrollArea.storyName.contentTypeMatrix', 'Factory: Content Type Matrix'),
  render: () => <ContentTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="content-type-matrix"]');
    expect(wrapper).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-content-type-item]');
    expect(items.length).toBe(SCROLL_AREA_CONTENT_TYPES.length);
  },
};

function VisibilityMatrixDemo() {
  const matrix: FakeScrollArea[] = createScrollAreaVisibilityMatrix();
  return (
    <div className="flex flex-col gap-4" data-testid="visibility-matrix">
      <p className="text-muted-foreground text-sm">{i18n.t('scrollArea.section.variants')}</p>
      {matrix.map((config) => (
        <div key={config.id}>
          <p className="mb-1 text-xs font-medium">Visibility: {config.scrollbarVisibility}</p>
          <ScrollArea
            className="rounded-md border p-3"
            style={{ width: '300px', height: '120px' }}
            data-visibility-matrix-item
          >
            <div className="space-y-1">
              {config.content.slice(0, 10).map((item) => (
                <div key={item.id} className="text-sm">
                  {item.content}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

export const VisibilityMatrix: Story = {
  name: i18n.t('scrollArea.storyName.visibilityMatrix', 'Factory: Visibility Matrix'),
  render: () => <VisibilityMatrixDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="visibility-matrix"]');
    expect(wrapper).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-visibility-matrix-item]');
    expect(items.length).toBe(SCROLLBAR_VISIBILITY_OPTIONS.length);
  },
};

// ============ FACTORY WIRING: SHOWCASE & TEST DATA ============

function ShowcaseDemo() {
  const showcase = createScrollAreaShowcase();
  return (
    <div className="flex flex-col gap-6" data-testid="showcase">
      <p className="text-muted-foreground text-sm">{i18n.t('scrollArea.section.variants')}</p>
      {showcase.map((entry) => (
        <div key={entry.name}>
          <p className="mb-1 text-sm font-medium">{entry.name}</p>
          <p className="text-muted-foreground mb-2 text-xs">{entry.description}</p>
          <ScrollArea
            className="rounded-md border p-3"
            style={{
              width: entry.scrollArea.width,
              height: entry.scrollArea.height,
              maxWidth: '400px',
            }}
            data-showcase-area
          >
            <div className="space-y-1">
              {entry.scrollArea.content.slice(0, 10).map((item) => (
                <div key={item.id} className="text-sm">
                  {item.content}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

export const Showcase: Story = {
  name: i18n.t('scrollArea.storyName.showcase', 'Factory: Showcase'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="showcase"]');
    expect(wrapper).toBeInTheDocument();
    const areas = canvasElement.querySelectorAll('[data-showcase-area]');
    expect(areas.length).toBe(8);
  },
};

function TestDataDemo() {
  const testData = createScrollAreaTestData();
  return (
    <div className="flex flex-col gap-4" data-testid="test-data">
      <p className="text-muted-foreground text-sm">{i18n.t('scrollArea.story.description')}</p>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="rounded border p-2" data-test-data-stat="items">
          Items: {testData.items.length}
        </div>
        <div className="rounded border p-2" data-test-data-stat="messages">
          Messages: {testData.messages.length}
        </div>
        <div className="rounded border p-2" data-test-data-stat="cards">
          Cards: {testData.cards.length}
        </div>
        <div className="rounded border p-2" data-test-data-stat="scrollAreas">
          Scroll Areas: {testData.scrollAreas.length}
        </div>
        <div className="rounded border p-2" data-test-data-stat="orientationMatrix">
          Orientation Matrix: {testData.orientationMatrix.length}
        </div>
        <div className="rounded border p-2" data-test-data-stat="sizeMatrix">
          Size Matrix: {testData.sizeMatrix.length}
        </div>
        <div className="rounded border p-2" data-test-data-stat="contentTypeMatrix">
          Content Type Matrix: {testData.contentTypeMatrix.length}
        </div>
        <div className="rounded border p-2" data-test-data-stat="visibilityMatrix">
          Visibility Matrix: {testData.visibilityMatrix.length}
        </div>
        <div className="rounded border p-2" data-test-data-stat="showcase">
          Showcase Entries: {testData.showcase.length}
        </div>
      </div>
      <ScrollArea className="h-40 w-[400px] rounded-md border p-3">
        <div className="space-y-1">
          {testData.verticalListScrollArea.items.slice(0, 20).map((item) => (
            <div key={item.id} className="text-sm" data-test-data-item>
              {item.content}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export const TestData: Story = {
  name: i18n.t('scrollArea.storyName.testData', 'Factory: Test Data'),
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="test-data"]');
    expect(wrapper).toBeInTheDocument();
    const stats = canvasElement.querySelectorAll('[data-test-data-stat]');
    expect(stats.length).toBe(9);
    const items = canvasElement.querySelectorAll('[data-test-data-item]');
    expect(items.length).toBe(20);
  },
};

// ============ FACTORY WIRING: CONSTANTS USAGE ============

function ConstantsDemo() {
  const orientations: ScrollbarOrientation[] = SCROLLBAR_ORIENTATIONS;
  const contentTypes: ScrollAreaContentType[] = SCROLL_AREA_CONTENT_TYPES;
  const sizePresets: ScrollAreaSizePreset[] = SCROLL_AREA_SIZE_PRESETS;
  const visibilityOptions: ScrollbarVisibility[] = SCROLLBAR_VISIBILITY_OPTIONS;
  return (
    <div data-testid="constants-demo">
      <p className="text-muted-foreground mb-3 text-sm">{i18n.t('scrollArea.story.description')}</p>
      <ScrollArea className="h-60 w-[400px] rounded-md border p-3">
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">Orientations ({orientations.length})</p>
            <div className="flex flex-wrap gap-1">
              {orientations.map((o) => (
                <span key={o} className="bg-muted rounded px-2 py-1 text-xs" data-orientation-tag>
                  {o}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Content Types ({contentTypes.length})</p>
            <div className="flex flex-wrap gap-1">
              {contentTypes.map((ct) => (
                <span key={ct} className="bg-muted rounded px-2 py-1 text-xs" data-content-type-tag>
                  {ct}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Size Presets ({sizePresets.length})</p>
            <div className="flex flex-wrap gap-1">
              {sizePresets.map((sp) => (
                <span key={sp} className="bg-muted rounded px-2 py-1 text-xs" data-size-tag>
                  {sp}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">
              Visibility Options ({visibilityOptions.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {visibilityOptions.map((v) => (
                <span key={v} className="bg-muted rounded px-2 py-1 text-xs" data-visibility-tag>
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export const ConstantsOverview: Story = {
  name: i18n.t('scrollArea.storyName.constantsOverview', 'Factory: Constants Overview'),
  render: () => <ConstantsDemo />,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('[data-testid="constants-demo"]');
    expect(wrapper).toBeInTheDocument();
    const orientationTags = canvasElement.querySelectorAll('[data-orientation-tag]');
    expect(orientationTags.length).toBe(SCROLLBAR_ORIENTATIONS.length);
    const contentTypeTags = canvasElement.querySelectorAll('[data-content-type-tag]');
    expect(contentTypeTags.length).toBe(SCROLL_AREA_CONTENT_TYPES.length);
    const sizeTags = canvasElement.querySelectorAll('[data-size-tag]');
    expect(sizeTags.length).toBe(SCROLL_AREA_SIZE_PRESETS.length);
    const visibilityTags = canvasElement.querySelectorAll('[data-visibility-tag]');
    expect(visibilityTags.length).toBe(SCROLLBAR_VISIBILITY_OPTIONS.length);
  },
};

// ============================================================================
// CROSS-CUTTING CONCERN STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('scrollArea.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('scrollArea.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('scrollArea.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('scrollArea.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// ADDITIONAL HANDLER STATUS STORIES
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('scrollArea.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: scrollAreaStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('scrollArea.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: scrollAreaStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('scrollArea.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: scrollAreaStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('scrollArea.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: scrollAreaStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

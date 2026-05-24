import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import type {
  FakeIDELayout,
  FakeResizableHandle,
  FakeResizablePanel,
  FakeResizablePanelGroup,
  FakeThreePanelLayout,
  FakeTwoPanelLayout,
  PanelContentType,
  PanelPosition,
  ResizableDirection,
  ResizableHandleStyle,
} from '@/.storybook/stories/_factories/resizable.factory';
import {
  createFakeDashboardLayout,
  createFakeHiddenHandleLayout,
  createFakeIDELayout,
  createFakeMailLayout,
  createFakeResizableHandle,
  createFakeResizablePanel,
  createFakeResizablePanelGroup,
  createFakeResizablePanelGroups,
  createFakeResizablePanels,
  createFakeThreePanelHorizontal,
  createFakeTwoPanelHorizontal,
  createFakeTwoPanelVertical,
  createFakeVisibleHandleLayout,
  createResizableDirectionMatrix,
  createResizableHandleStyleMatrix,
  createResizablePanelCountMatrix,
  createResizableShowcase,
  createResizableTestData,
  DEFAULT_PANEL_SIZES,
  MAX_PANEL_SIZES,
  MIN_PANEL_SIZES,
  PANEL_CONTENT_TYPES,
  PANEL_POSITIONS,
  RESIZABLE_DIRECTIONS,
  RESIZABLE_HANDLE_STYLES,
} from '@/.storybook/stories/_factories/resizable.factory';
import {
  resizableHandlers,
  resizableStatusHandlers,
} from '@/.storybook/stories/_handlers/resizable.handlers';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

// ============ PERSISTENCE STORIES ============

import React from 'react';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type ResizableDemoProps = {
  contentText?: string;
  direction?: 'horizontal' | 'vertical';
  handleAriaLabel?: string;
  sidebarText?: string;
  withHandle?: boolean;
};

function ResizableDemo({
  direction = 'horizontal',
  withHandle = true,
  sidebarText = 'Sidebar',
  contentText = 'Main content',
  handleAriaLabel = 'Resize panels',
}: ResizableDemoProps) {
  useTranslation();
  return (
    <div className="w-full max-w-4xl">
      <ResizablePanelGroup className="min-h-[260px] w-full rounded-md border" direction={direction}>
        <ResizablePanel data-resizable-panel="sidebar" defaultSize={25} minSize={20}>
          <div
            className="flex h-full items-center justify-center p-4 text-sm"
            data-resizable-content="sidebar"
          >
            {sidebarText}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={handleAriaLabel}
          data-resizable-handle
          withHandle={withHandle}
        />
        <ResizablePanel defaultSize={75}>
          <div
            className="flex h-full items-center justify-center p-4 text-sm"
            data-resizable-content="content"
          >
            {contentText}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function I18nResizableDemo(props: Pick<ResizableDemoProps, 'direction' | 'withHandle'>) {
  const { t } = useTranslation();

  return (
    <ResizableDemo
      {...props}
      contentText={t('resizable.content')}
      handleAriaLabel={t('resizable.handle.ariaLabel')}
      sidebarText={t('resizable.sidebar')}
    />
  );
}

const meta = {
  title: 'Components/UI/Resizable',
  component: ResizableDemo,
  tags: ['autodocs'],
  args: {
    direction: 'horizontal',
    withHandle: true,
    sidebarText: 'Sidebar',
    contentText: 'Main content',
    handleAriaLabel: 'Resize panels',
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onResize: fn(),
  },
  argTypes: {
    // Content
    autoSaveId: {
      control: 'text',
      description: i18n.t(
        'resizable.argType.autosaveLayoutToLocalstorageWithThisId',
        'Auto-save layout to localStorage with this ID'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    withHandle: {
      control: { type: 'boolean' },
      description: i18n.t(
        'resizable.argType.showVisualHandleGripIcon',
        'Show visual handle grip icon'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'resizable.argType.disableHandleInteraction',
        'Disable handle interaction'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    collapsible: {
      control: 'boolean',
      description: i18n.t('resizable.argType.enablePanelCollapsing', 'Enable panel collapsing'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Layout
    direction: {
      control: { type: 'select' },
      options: ['horizontal', 'vertical'],
      description: i18n.t(
        'resizable.argType.layoutDirectionOfPanels',
        'Layout direction of panels'
      ),
      table: {
        category: 'Layout',
        type: { summary: "'horizontal' | 'vertical'" },
        defaultValue: { summary: 'horizontal' },
      },
    },
    defaultSize: {
      control: 'number',
      description: i18n.t(
        'resizable.argType.initialSizeAsPercentage0100',
        'Initial size as percentage (0-100)'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'number' },
        defaultValue: { summary: '50' },
      },
    },
    minSize: {
      control: 'number',
      description: i18n.t(
        'resizable.argType.minimumSizeAsPercentage',
        'Minimum size as percentage'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'number' },
        defaultValue: { summary: '10' },
      },
    },
    maxSize: {
      control: 'number',
      description: i18n.t(
        'resizable.argType.maximumSizeAsPercentage',
        'Maximum size as percentage'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'number' },
        defaultValue: { summary: '100' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('resizable.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('resizable.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('resizable.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('resizable.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('resizable.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('resizable.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('resizable.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onResize: {
      action: 'onResize',
      description: i18n.t(
        'resizable.argType.calledDuringPanelResize',
        'Called during panel resize'
      ),
      table: { category: 'Events' },
    },
    onLayout: {
      action: 'onLayout',
      description: i18n.t(
        'resizable.argType.calledWhenLayoutChanges',
        'Called when layout changes'
      ),
      table: { category: 'Events' },
    },
    onCollapse: {
      action: 'onCollapse',
      description: i18n.t(
        'resizable.argType.calledWhenPanelIsCollapsed',
        'Called when panel is collapsed'
      ),
      table: { category: 'Events' },
    },
    onExpand: {
      action: 'onExpand',
      description: i18n.t(
        'resizable.argType.calledWhenPanelIsExpanded',
        'Called when panel is expanded'
      ),
      table: { category: 'Events' },
    },
    // Demo
    sidebarText: {
      control: { type: 'text' },
      table: { category: 'Demo' },
    },
    contentText: {
      control: { type: 'text' },
      table: { category: 'Demo' },
    },
    handleAriaLabel: {
      control: { type: 'text' },
      table: { category: 'Demo' },
    },
    // ResizablePanelGroup Props Reference (react-resizable-panels PanelGroup):
    // - direction: Layout direction ('horizontal' | 'vertical')
    // - autoSaveId: Auto-save layout to localStorage (string)
    // - onLayout: Called when layout changes ((sizes: number[]) => void)
    // - storage: Custom storage implementation ({ getItem, setItem })
    // - className: Additional CSS classes (string)
    //
    // ResizablePanel Props Reference (react-resizable-panels Panel):
    // - defaultSize: Initial size as percentage (number, 0-100)
    // - minSize: Minimum size as percentage (number, default: 10)
    // - maxSize: Maximum size as percentage (number, default: 100)
    // - collapsible: Enable panel collapsing (boolean)
    // - collapsedSize: Size when collapsed (number)
    // - onCollapse: Called when collapsed (() => void)
    // - onExpand: Called when expanded (() => void)
    // - onResize: Called during resize ((size: number) => void)
    // - order: Panel order for keyboard navigation (number)
    // - id: Unique panel ID for persistence (string)
    // - className: Additional CSS classes (string)
    //
    // ResizableHandle Props Reference (react-resizable-panels PanelResizeHandle):
    // - withHandle: Show visual grip icon (boolean)
    // - disabled: Disable handle interaction (boolean)
    // - hitAreaMargins: Click area margin in px ({ coarse: number, fine: number })
    // - onDragging: Called during drag ((isDragging: boolean) => void)
    // - aria-label: Accessible label (string, required)
    // - className: Additional CSS classes (string)
    //
    // Keyboard Navigation:
    // - Arrow keys: Resize panels incrementally
    // - Home/End: Jump to min/max size
    // - Enter/Space: Collapse/expand (if collapsible)
  },
  parameters: {
    msw: { handlers: resizableHandlers },
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

    const sidebarContent = canvasElement.querySelector('[data-resizable-content="sidebar"]');
    const contentContent = canvasElement.querySelector('[data-resizable-content="content"]');

    if (!(sidebarContent instanceof HTMLElement)) {
      throw new Error('Sidebar content was not found.');
    }

    if (!(contentContent instanceof HTMLElement)) {
      throw new Error('Main content was not found.');
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');

    if (!(panelGroup instanceof HTMLElement)) {
      throw new Error('Resizable panel group was not found.');
    }

    const direction = panelGroup.getAttribute('data-panel-group-direction');
    const expectedDirection = args.direction === 'vertical' ? 'vertical' : 'horizontal';
    expect(direction).toBe(expectedDirection);

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);

    const sidebarPanel = panels[0];
    const contentPanel = panels[1];

    if (!(sidebarPanel instanceof HTMLElement)) {
      throw new Error('Sidebar panel was not found.');
    }

    if (!(contentPanel instanceof HTMLElement)) {
      throw new Error('Content panel was not found.');
    }

    const getPanelSize = (panel: HTMLElement) => {
      const raw = panel.getAttribute('data-panel-size');
      if (raw == null) {
        throw new Error('Panel did not expose data-panel-size.');
      }

      const size = Number.parseFloat(raw);
      if (Number.isNaN(size)) {
        throw new Error(`Panel size was not a number: "${raw}"`);
      }

      return size;
    };

    expect(getPanelSize(sidebarPanel)).toBeCloseTo(25, 1);
    expect(getPanelSize(contentPanel)).toBeCloseTo(75, 1);

    const handle = canvasElement.querySelector('[data-slot="resizable-handle"]');

    if (!(handle instanceof HTMLElement)) {
      throw new Error('Resizable handle was not found.');
    }

    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-label') ?? '').not.toBe('');

    const expectsHandleIcon = args.withHandle !== false;

    if (expectsHandleIcon) {
      expect(handle.querySelector('svg')).toBeInTheDocument();
    } else {
      expect(handle.querySelector('svg')).not.toBeInTheDocument();
    }

    await userEvent.click(handle);
    expect(canvasElement.ownerDocument.activeElement).toBe(handle);

    const initialSidebarSize = getPanelSize(sidebarPanel);
    const initialContentSize = getPanelSize(contentPanel);

    const growKey = expectedDirection === 'vertical' ? '{ArrowDown}' : '{ArrowRight}';
    const shrinkKey = expectedDirection === 'vertical' ? '{ArrowUp}' : '{ArrowLeft}';

    await userEvent.keyboard(growKey);

    await waitFor(() => {
      expect(getPanelSize(sidebarPanel)).toBeGreaterThan(initialSidebarSize);
      expect(getPanelSize(contentPanel)).toBeLessThan(initialContentSize);
    });

    await userEvent.keyboard(shrinkKey);

    await waitFor(() => {
      expect(getPanelSize(sidebarPanel)).toBeCloseTo(initialSidebarSize, 1);
      expect(getPanelSize(contentPanel)).toBeCloseTo(initialContentSize, 1);
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBeGreaterThanOrEqual(2);

    const handle = canvasElement.querySelector('[data-slot="resizable-handle"]');
    expect(handle).toBeInTheDocument();
  },
};

function VariantsDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('resizable.variants.horizontal')}</p>
        <div className="w-full max-w-4xl">
          <ResizablePanelGroup
            className="min-h-[150px] w-full rounded-md border"
            direction="horizontal"
          >
            <ResizablePanel defaultSize={30} minSize={20}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {i18n.t('resizable.story.leftPanel', 'Left Panel')}
              </div>
            </ResizablePanel>
            <ResizableHandle
              aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
              withHandle
            />
            <ResizablePanel defaultSize={70}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {i18n.t('resizable.story.rightPanel', 'Right Panel')}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('resizable.variants.vertical')}</p>
        <div className="w-full max-w-4xl">
          <ResizablePanelGroup
            className="min-h-[250px] w-full rounded-md border"
            direction="vertical"
          >
            <ResizablePanel defaultSize={40} minSize={20}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {i18n.t('resizable.story.topPanel', 'Top Panel')}
              </div>
            </ResizablePanel>
            <ResizableHandle
              aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
              withHandle
            />
            <ResizablePanel defaultSize={60}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {i18n.t('resizable.story.bottomPanel', 'Bottom Panel')}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('resizable.variants.nested')}</p>
        <div className="w-full max-w-4xl">
          <ResizablePanelGroup
            className="min-h-[300px] w-full rounded-md border"
            direction="horizontal"
          >
            <ResizablePanel defaultSize={25} minSize={15}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {i18n.t('resizable.story.sidebar', 'Sidebar')}
              </div>
            </ResizablePanel>
            <ResizableHandle
              aria-label={i18n.t('resizable.story.resizeSidebar', 'Resize sidebar')}
              withHandle
            />
            <ResizablePanel defaultSize={75}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={60} minSize={30}>
                  <div className="flex h-full items-center justify-center p-4 text-sm">
                    {i18n.t('resizable.story.mainContent', 'Main Content')}
                  </div>
                </ResizablePanel>
                <ResizableHandle
                  aria-label={i18n.t('resizable.story.resizeContent', 'Resize content')}
                  withHandle
                />
                <ResizablePanel defaultSize={40}>
                  <div className="flex h-full items-center justify-center p-4 text-sm">
                    {i18n.t('resizable.story.bottomPanel', 'Bottom Panel')}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('resizable.variants.withoutHandle')}</p>
        <div className="w-full max-w-4xl">
          <ResizablePanelGroup
            className="min-h-[150px] w-full rounded-md border"
            direction="horizontal"
          >
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {i18n.t('resizable.story.panelA', 'Panel A')}
              </div>
            </ResizablePanel>
            <ResizableHandle
              aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
              withHandle={false}
            />
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {i18n.t('resizable.story.panelB', 'Panel B')}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroups = canvasElement.querySelectorAll('[data-slot="resizable-panel-group"]');
    expect(panelGroups.length).toBeGreaterThanOrEqual(4);

    const handles = canvasElement.querySelectorAll('[data-slot="resizable-handle"]');
    expect(handles.length).toBeGreaterThanOrEqual(4);
  },
};

function SizesDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('resizable.sizes.small')}</p>
        <div className="w-full max-w-2xl">
          <ResizablePanelGroup
            className="min-h-[100px] w-full rounded-md border"
            direction="horizontal"
          >
            <ResizablePanel defaultSize={30} minSize={15}>
              <div className="flex h-full items-center justify-center p-2 text-xs">
                {i18n.t('resizable.story.compact', 'Compact')}
              </div>
            </ResizablePanel>
            <ResizableHandle
              aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
              withHandle
            />
            <ResizablePanel defaultSize={70}>
              <div className="flex h-full items-center justify-center p-2 text-xs">
                {i18n.t('resizable.story.content', 'Content')}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('resizable.sizes.default')}</p>
        <div className="w-full max-w-4xl">
          <ResizablePanelGroup
            className="min-h-[200px] w-full rounded-md border"
            direction="horizontal"
          >
            <ResizablePanel defaultSize={25} minSize={20}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {i18n.t('resizable.story.sidebar', 'Sidebar')}
              </div>
            </ResizablePanel>
            <ResizableHandle
              aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
              withHandle
            />
            <ResizablePanel defaultSize={75}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {i18n.t('resizable.story.mainContent', 'Main Content')}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('resizable.sizes.large')}</p>
        <div className="w-full max-w-6xl">
          <ResizablePanelGroup
            className="min-h-[350px] w-full rounded-md border"
            direction="horizontal"
          >
            <ResizablePanel defaultSize={20} minSize={15}>
              <div className="flex h-full items-center justify-center p-6 text-base font-medium">
                {i18n.t('resizable.story.navigation', 'Navigation')}
              </div>
            </ResizablePanel>
            <ResizableHandle
              aria-label={i18n.t('resizable.story.resizeNavigation', 'Resize navigation')}
              withHandle
            />
            <ResizablePanel defaultSize={55}>
              <div className="flex h-full items-center justify-center p-6 text-base font-medium">
                {i18n.t('resizable.story.mainArea', 'Main Area')}
              </div>
            </ResizablePanel>
            <ResizableHandle
              aria-label={i18n.t('resizable.story.resizeInspector', 'Resize inspector')}
              withHandle
            />
            <ResizablePanel defaultSize={25}>
              <div className="flex h-full items-center justify-center p-6 text-base font-medium">
                {i18n.t('resizable.story.inspector', 'Inspector')}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroups = canvasElement.querySelectorAll('[data-slot="resizable-panel-group"]');
    expect(panelGroups.length).toBeGreaterThanOrEqual(3);

    const handles = canvasElement.querySelectorAll('[data-slot="resizable-handle"]');
    expect(handles.length).toBeGreaterThanOrEqual(3);
  },
};

export const Vertical: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    direction: 'vertical',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const direction = panelGroup?.getAttribute('data-panel-group-direction');
    expect(direction).toBe('vertical');

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);

    const handle = canvasElement.querySelector('[data-slot="resizable-handle"]');
    expect(handle).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);

    const handle = canvasElement.querySelector('[data-slot="resizable-handle"]');
    expect(handle).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('resizable.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: (args) => <I18nResizableDemo direction={args.direction} withHandle={args.withHandle} />,
  play: async (context) => {
    const root = context.canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(root.ownerDocument.documentElement.lang).toBe('ja');

    const sidebarContent = root.querySelector('[data-resizable-content="sidebar"]');
    const contentContent = root.querySelector('[data-resizable-content="content"]');
    const handle = root.querySelector('[data-slot="resizable-handle"]');

    if (!(sidebarContent instanceof HTMLElement)) {
      throw new Error('Sidebar content was not found.');
    }

    if (!(contentContent instanceof HTMLElement)) {
      throw new Error('Main content was not found.');
    }

    if (!(handle instanceof HTMLElement)) {
      throw new Error('Resizable handle was not found.');
    }

    expect(sidebarContent.textContent).toBe('サイドバー');
    expect(contentContent.textContent).toBe('メインコンテンツ');
    expect(handle.getAttribute('aria-label')).toBe('パネルサイズを変更');

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
  name: i18n.t('resizable.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    <div className="h-[300px] w-[600px] rounded-lg border">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-sm">{i18n.t('resizable.story.leftPanel', 'Left Panel')}</span>
          </div>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
        />
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-sm">{i18n.t('resizable.story.rightPanel', 'Right Panel')}</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Find the resize handle
    const handle = canvasElement.querySelector('[data-slot="resizable-handle"]');
    expect(handle).toBeInTheDocument();

    // Verify ARIA attributes
    const resizeButton = canvasElement.querySelector('[data-panel-resize-handle-id]');
    expect(resizeButton).toBeInTheDocument();

    // Test keyboard focus
    await userEvent.tab();
    await waitFor(() => {
      const { activeElement } = doc;
      expect(activeElement).toHaveAttribute('data-panel-resize-handle-id');
    });

    // Test keyboard resize with arrow keys
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{ArrowRight}');
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableHandlers },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

const STORAGE_KEY = 'resizable-panel-layout-demo';

function PersistentResizableDemo() {
  useTranslation();
  const [savedLayout, setSavedLayout] = React.useState<number[] | null>(null);

  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSavedLayout(JSON.parse(saved) as number[]);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleLayoutChange = React.useCallback((sizes: number[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
    setSavedLayout(sizes);
  }, []);

  const clearLayout = React.useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedLayout(null);
  }, []);

  return (
    <div className="w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {i18n.t(
            'resizable.story.localStorageDescription',
            'Layout is saved to localStorage. Resize panels and refresh the page.'
          )}
        </p>
        <button
          onClick={clearLayout}
          className="hover:bg-muted rounded border px-2 py-1 text-xs"
          data-testid="clear-layout"
        >
          {i18n.t('resizable.story.clearSavedLayout', 'Clear Saved Layout')}
        </button>
      </div>
      <ResizablePanelGroup
        className="min-h-[260px] w-full rounded-md border"
        direction="horizontal"
        autoSaveId={STORAGE_KEY}
        onLayout={handleLayoutChange}
        data-testid="persistent-resizable"
      >
        <ResizablePanel defaultSize={25} minSize={15}>
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {i18n.t('resizable.story.sidebar', 'Sidebar')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
          withHandle
        />
        <ResizablePanel defaultSize={75}>
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {i18n.t('resizable.story.mainContent', 'Main Content')}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {savedLayout && (
        <div className="text-muted-foreground text-xs">
          {i18n.t('resizable.story.savedLayout', 'Saved layout: [{{sizes}}]', {
            sizes: savedLayout.map((s) => s.toFixed(1)).join('%, ') + '%',
          })}
        </div>
      )}
    </div>
  );
}

export const Persistence: Story = {
  name: i18n.t('resizable.storyName.persistence', 'Persistence (localStorage)'),
  render: () => <PersistentResizableDemo />,
  play: async ({ canvasElement }) => {
    const resizable = canvasElement.querySelector('[data-testid="persistent-resizable"]');
    expect(resizable).toBeInTheDocument();

    const clearButton = canvasElement.querySelector('[data-testid="clear-layout"]');
    expect(clearButton).toBeInTheDocument();
  },
};

function SessionStoragePersistence() {
  useTranslation();
  const [savedLayout, setSavedLayout] = React.useState<number[] | null>(null);
  const storageKey = 'resizable-session-demo';

  React.useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        setSavedLayout(JSON.parse(saved) as number[]);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const customStorage = React.useMemo(
    () => ({
      getItem: (name: string) => sessionStorage.getItem(name),
      setItem: (name: string, value: string) => {
        sessionStorage.setItem(name, value);
        setSavedLayout(JSON.parse(value) as number[]);
      },
    }),
    []
  );

  return (
    <div className="w-full max-w-4xl space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'resizable.story.sessionStorageDescription',
          'Layout is saved to sessionStorage (clears when tab closes).'
        )}
      </p>
      <ResizablePanelGroup
        className="min-h-[260px] w-full rounded-md border"
        direction="horizontal"
        autoSaveId={storageKey}
        storage={customStorage}
        data-testid="session-resizable"
      >
        <ResizablePanel defaultSize={30} minSize={15}>
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {i18n.t('resizable.story.leftPanel', 'Left Panel')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
          withHandle
        />
        <ResizablePanel defaultSize={70}>
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {i18n.t('resizable.story.rightPanel', 'Right Panel')}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {savedLayout && (
        <div className="text-muted-foreground text-xs">
          {i18n.t('resizable.story.sessionLayout', 'Session layout: [{{sizes}}]', {
            sizes: savedLayout.map((s) => s.toFixed(1)).join('%, ') + '%',
          })}
        </div>
      )}
    </div>
  );
}

export const PersistenceSessionStorage: Story = {
  name: i18n.t('resizable.storyName.persistenceSessionStorage', 'Persistence (sessionStorage)'),
  render: () => <SessionStoragePersistence />,
  play: async ({ canvasElement }) => {
    const resizable = canvasElement.querySelector('[data-testid="session-resizable"]');
    expect(resizable).toBeInTheDocument();
  },
};

function CollapsiblePersistenceDemo() {
  useTranslation();
  const [collapsed, setCollapsed] = React.useState(false);
  const storageKey = 'resizable-collapsible-demo';

  React.useEffect(() => {
    const saved = localStorage.getItem(`${storageKey}-collapsed`);
    if (saved) {
      setCollapsed(saved === 'true');
    }
  }, []);

  const handleCollapse = React.useCallback(() => {
    setCollapsed(true);
    localStorage.setItem(`${storageKey}-collapsed`, 'true');
  }, []);

  const handleExpand = React.useCallback(() => {
    setCollapsed(false);
    localStorage.setItem(`${storageKey}-collapsed`, 'false');
  }, []);

  return (
    <div className="w-full max-w-4xl space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'resizable.story.collapsibleDescription',
          'Collapsible panel with persistent collapsed state. Double-click handle or press Enter/Space.'
        )}
      </p>
      <ResizablePanelGroup
        className="min-h-[260px] w-full rounded-md border"
        direction="horizontal"
        autoSaveId={storageKey}
        data-testid="collapsible-resizable"
      >
        <ResizablePanel
          defaultSize={collapsed ? 5 : 25}
          collapsible
          collapsedSize={5}
          minSize={15}
          onCollapse={handleCollapse}
          onExpand={handleExpand}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {collapsed
              ? i18n.t('resizable.story.collapsed', 'Collapsed')
              : i18n.t('resizable.story.sidebar', 'Sidebar')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t(
            'resizable.story.resizeOrCollapseSidebar',
            'Resize or collapse sidebar'
          )}
          withHandle
        />
        <ResizablePanel defaultSize={collapsed ? 95 : 75}>
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {i18n.t('resizable.story.mainContent', 'Main Content')}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <div className="text-muted-foreground text-xs">
        {i18n.t('resizable.story.sidebarState', 'Sidebar state: {{state}}', {
          state: collapsed
            ? i18n.t('resizable.story.collapsed', 'Collapsed')
            : i18n.t('resizable.story.expanded', 'Expanded'),
        })}
      </div>
    </div>
  );
}

export const PersistenceWithCollapse: Story = {
  name: i18n.t('resizable.storyName.persistenceWithCollapse', 'Persistence with Collapsible Panel'),
  render: () => <CollapsiblePersistenceDemo />,
  play: async ({ canvasElement }) => {
    const resizable = canvasElement.querySelector('[data-testid="collapsible-resizable"]');
    expect(resizable).toBeInTheDocument();
  },
};

function MultiLayoutPersistence() {
  useTranslation();
  const [activeLayout, setActiveLayout] = React.useState<'default' | 'wide' | 'compact'>('default');

  const layouts = {
    default: [25, 75],
    wide: [15, 85],
    compact: [40, 60],
  };

  return (
    <div className="w-full max-w-4xl space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveLayout('default')}
          className={`rounded border px-3 py-1 text-sm ${activeLayout === 'default' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          data-testid="layout-default"
        >
          {i18n.t('resizable.story.default', 'Default')}
        </button>
        <button
          onClick={() => setActiveLayout('wide')}
          className={`rounded border px-3 py-1 text-sm ${activeLayout === 'wide' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          data-testid="layout-wide"
        >
          {i18n.t('resizable.story.wideContent', 'Wide Content')}
        </button>
        <button
          onClick={() => setActiveLayout('compact')}
          className={`rounded border px-3 py-1 text-sm ${activeLayout === 'compact' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          data-testid="layout-compact"
        >
          {i18n.t('resizable.story.compact', 'Compact')}
        </button>
      </div>
      <ResizablePanelGroup
        className="min-h-[260px] w-full rounded-md border"
        direction="horizontal"
        autoSaveId={`resizable-${activeLayout}`}
        data-testid="multi-layout-resizable"
        key={activeLayout}
      >
        <ResizablePanel defaultSize={layouts[activeLayout][0]} minSize={10}>
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {i18n.t('resizable.story.sidebarPercent', 'Sidebar ({{percent}}%)', {
              percent: layouts[activeLayout][0],
            })}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
          withHandle
        />
        <ResizablePanel defaultSize={layouts[activeLayout][1]}>
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {i18n.t('resizable.story.contentPercent', 'Content ({{percent}}%)', {
              percent: layouts[activeLayout][1],
            })}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <p className="text-muted-foreground text-xs">
        {i18n.t(
          'resizable.story.layoutPresetsDescription',
          'Each layout preset is saved separately in localStorage.'
        )}
      </p>
    </div>
  );
}

export const PersistenceMultipleLayouts: Story = {
  name: i18n.t('resizable.storyName.persistenceMultipleLayouts', 'Multiple Layout Presets'),
  render: () => <MultiLayoutPersistence />,
  play: async ({ canvasElement }) => {
    const resizable = canvasElement.querySelector('[data-testid="multi-layout-resizable"]');
    expect(resizable).toBeInTheDocument();

    const defaultBtn = canvasElement.querySelector('[data-testid="layout-default"]');
    const wideBtn = canvasElement.querySelector('[data-testid="layout-wide"]');
    const compactBtn = canvasElement.querySelector('[data-testid="layout-compact"]');

    expect(defaultBtn).toBeInTheDocument();
    expect(wideBtn).toBeInTheDocument();
    expect(compactBtn).toBeInTheDocument();

    // Click wide layout
    if (wideBtn instanceof HTMLButtonElement) {
      await userEvent.click(wideBtn);
    }
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

export const WithFakerData: Story = {
  render: () => {
    const group = createFakeResizablePanelGroup(3);

    return (
      <ResizablePanelGroup
        className="min-h-[200px] max-w-lg rounded-lg border"
        data-testid="faker-resizable"
        direction={group.direction}
      >
        {group.panels.map((panel, i) => (
          <React.Fragment key={panel.id}>
            {i > 0 && <ResizableHandle withHandle={group.handles[i - 1]?.withHandle} />}
            <ResizablePanel defaultSize={panel.defaultSize}>
              <div className="flex h-full items-center justify-center p-4">
                <span className="text-sm font-medium">
                  {panel.label ?? `Panel ${String(i + 1)}`}
                </span>
              </div>
            </ResizablePanel>
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    );
  },
  play: async ({ canvasElement }) => {
    const panelGroup = canvasElement.querySelector('[data-testid="faker-resizable"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(3);
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resizableHandlers },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const panelGroup = canvasElement.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);
  },
};

// ============ FACTORY WIRING STORIES ============

// ---------- Single Panel Factory ----------

function FactorySinglePanelDemo() {
  const panel: FakeResizablePanel = createFakeResizablePanel({
    defaultSize: 50,
    label: i18n.t('resizable.story.factoryPanel', 'Factory Panel'),
    contentType: 'text',
  });
  const secondPanel: FakeResizablePanel = createFakeResizablePanel({
    defaultSize: 50,
    label: i18n.t('resizable.story.secondPanel', 'Second Panel'),
    contentType: 'code',
  });

  return (
    <div className="w-full max-w-4xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.panel')}</p>
      <ResizablePanelGroup
        className="min-h-[200px] w-full rounded-md border"
        data-testid="factory-single-panel"
        direction="horizontal"
      >
        <ResizablePanel defaultSize={panel.defaultSize} minSize={panel.minSize}>
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {panel.label ?? i18n.t('resizable.story.panel', 'Panel')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
          withHandle
        />
        <ResizablePanel defaultSize={secondPanel.defaultSize}>
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {secondPanel.label ?? i18n.t('resizable.story.panel', 'Panel')}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export const FactorySinglePanel: Story = {
  render: () => <FactorySinglePanelDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-single-panel"]');
    expect(container).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);

    await waitFor(() => {
      expect(canvas.getByText('Factory Panel')).toBeInTheDocument();
      expect(canvas.getByText('Second Panel')).toBeInTheDocument();
    });
  },
};

// ---------- Multiple Panels Factory ----------

function FactoryMultiplePanelsDemo() {
  const panels: FakeResizablePanel[] = createFakeResizablePanels(4);

  return (
    <div className="w-full max-w-4xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.panels')}</p>
      <ResizablePanelGroup
        className="min-h-[200px] w-full rounded-md border"
        data-testid="factory-multiple-panels"
        direction="horizontal"
      >
        {panels.map((panel, i) => (
          <React.Fragment key={panel.id}>
            {i > 0 && (
              <ResizableHandle
                aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                withHandle
              />
            )}
            <ResizablePanel defaultSize={panel.defaultSize}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {panel.label ?? `Panel ${String(i + 1)}`}
              </div>
            </ResizablePanel>
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
}

export const FactoryMultiplePanels: Story = {
  render: () => <FactoryMultiplePanelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-multiple-panels"]');
    expect(container).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(4);

    const handles = canvasElement.querySelectorAll('[data-slot="resizable-handle"]');
    expect(handles.length).toBe(3);

    await waitFor(() => {
      expect(canvas.getByText(/Panel/)).toBeInTheDocument();
    });
  },
};

// ---------- Handle Factory ----------

function FactoryHandleDemo() {
  const handleWithGrip: FakeResizableHandle = createFakeResizableHandle({ withHandle: true });
  const handleWithoutGrip: FakeResizableHandle = createFakeResizableHandle({ withHandle: false });

  return (
    <div className="w-full max-w-4xl space-y-4">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.handle')}</p>
      <div>
        <p className="text-muted-foreground mb-1 text-xs">With grip (id: {handleWithGrip.id})</p>
        <ResizablePanelGroup
          className="min-h-[120px] w-full rounded-md border"
          data-testid="factory-handle-with-grip"
          direction="horizontal"
        >
          <ResizablePanel defaultSize={50}>
            <div className="flex h-full items-center justify-center p-4 text-sm">
              {i18n.t('resizable.story.left', 'Left')}
            </div>
          </ResizablePanel>
          <ResizableHandle
            aria-label={
              handleWithGrip.ariaLabel ?? i18n.t('resizable.story.resizePanels', 'Resize panels')
            }
            withHandle={handleWithGrip.withHandle}
          />
          <ResizablePanel defaultSize={50}>
            <div className="flex h-full items-center justify-center p-4 text-sm">
              {i18n.t('resizable.story.right', 'Right')}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div>
        <p className="text-muted-foreground mb-1 text-xs">
          Without grip (id: {handleWithoutGrip.id})
        </p>
        <ResizablePanelGroup
          className="min-h-[120px] w-full rounded-md border"
          data-testid="factory-handle-without-grip"
          direction="horizontal"
        >
          <ResizablePanel defaultSize={50}>
            <div className="flex h-full items-center justify-center p-4 text-sm">
              {i18n.t('resizable.story.left', 'Left')}
            </div>
          </ResizablePanel>
          <ResizableHandle
            aria-label={
              handleWithoutGrip.ariaLabel ?? i18n.t('resizable.story.resizePanels', 'Resize panels')
            }
            withHandle={handleWithoutGrip.withHandle}
          />
          <ResizablePanel defaultSize={50}>
            <div className="flex h-full items-center justify-center p-4 text-sm">
              {i18n.t('resizable.story.right', 'Right')}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export const FactoryHandle: Story = {
  render: () => <FactoryHandleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const withGrip = canvasElement.querySelector('[data-testid="factory-handle-with-grip"]');
    const withoutGrip = canvasElement.querySelector('[data-testid="factory-handle-without-grip"]');
    expect(withGrip).toBeInTheDocument();
    expect(withoutGrip).toBeInTheDocument();

    // Handle with grip should have an SVG icon
    const gripHandle = withGrip?.querySelector('[data-slot="resizable-handle"]');
    expect(gripHandle).toBeInTheDocument();
    expect(gripHandle?.querySelector('svg')).toBeInTheDocument();

    // Handle without grip should not have an SVG icon
    const noGripHandle = withoutGrip?.querySelector('[data-slot="resizable-handle"]');
    expect(noGripHandle).toBeInTheDocument();
    expect(noGripHandle?.querySelector('svg')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(canvas.getAllByText('Left').length).toBe(2);
      expect(canvas.getAllByText('Right').length).toBe(2);
    });
  },
};

// ---------- Panel Groups Factory ----------

function FactoryPanelGroupsDemo() {
  const groups: FakeResizablePanelGroup[] = createFakeResizablePanelGroups(3, 2);

  return (
    <div className="w-full max-w-4xl space-y-4">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.panelGroups')}</p>
      {groups.map((group, gi) => (
        <div key={group.id}>
          <p className="text-muted-foreground mb-1 text-xs">
            Group {String(gi + 1)} ({group.direction})
          </p>
          <ResizablePanelGroup
            className="min-h-[120px] w-full rounded-md border"
            data-testid={`factory-group-${String(gi)}`}
            direction={group.direction}
          >
            {group.panels.map((panel, pi) => (
              <React.Fragment key={panel.id}>
                {pi > 0 && (
                  <ResizableHandle
                    aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                    withHandle={group.handles[pi - 1]?.withHandle}
                  />
                )}
                <ResizablePanel defaultSize={panel.defaultSize}>
                  <div className="flex h-full items-center justify-center p-4 text-sm">
                    {panel.label ?? `Panel ${String(pi + 1)}`}
                  </div>
                </ResizablePanel>
              </React.Fragment>
            ))}
          </ResizablePanelGroup>
        </div>
      ))}
    </div>
  );
}

export const FactoryPanelGroups: Story = {
  render: () => <FactoryPanelGroupsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (let i = 0; i < 3; i++) {
      const group = canvasElement.querySelector(`[data-testid="factory-group-${String(i)}"]`);
      expect(group).toBeInTheDocument();
    }

    const allPanels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(allPanels.length).toBe(6);

    await waitFor(() => {
      expect(canvas.getByText(/Group 1/)).toBeInTheDocument();
    });
  },
};

// ---------- Two-Panel Horizontal Factory ----------

function FactoryTwoPanelHorizontalDemo() {
  const layout: FakeTwoPanelLayout = createFakeTwoPanelHorizontal(30);

  return (
    <div className="w-full max-w-4xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.twoPanelHorizontal')}</p>
      <ResizablePanelGroup
        className="min-h-[220px] w-full rounded-md border"
        data-testid="factory-two-panel-horizontal"
        direction={layout.direction}
      >
        <ResizablePanel
          collapsible={layout.leftPanel.collapsible}
          defaultSize={layout.leftPanel.defaultSize}
          maxSize={layout.leftPanel.maxSize}
          minSize={layout.leftPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {layout.leftPanel.label ?? i18n.t('resizable.story.left', 'Left')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
          withHandle={layout.handles[0]?.withHandle}
        />
        <ResizablePanel
          defaultSize={layout.rightPanel.defaultSize}
          minSize={layout.rightPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {layout.rightPanel.label ?? i18n.t('resizable.story.right', 'Right')}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export const FactoryTwoPanelHorizontal: Story = {
  render: () => <FactoryTwoPanelHorizontalDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-two-panel-horizontal"]');
    expect(container).toBeInTheDocument();

    const direction = container?.getAttribute('data-panel-group-direction');
    expect(direction).toBe('horizontal');

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);

    await waitFor(() => {
      expect(canvas.getByText('Sidebar')).toBeInTheDocument();
      expect(canvas.getByText('Main Content')).toBeInTheDocument();
    });
  },
};

// ---------- Two-Panel Vertical Factory ----------

function FactoryTwoPanelVerticalDemo() {
  const layout: FakeTwoPanelLayout = createFakeTwoPanelVertical(65);

  return (
    <div className="w-full max-w-4xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.twoPanelVertical')}</p>
      <ResizablePanelGroup
        className="min-h-[300px] w-full rounded-md border"
        data-testid="factory-two-panel-vertical"
        direction={layout.direction}
      >
        <ResizablePanel
          defaultSize={layout.leftPanel.defaultSize}
          minSize={layout.leftPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {layout.leftPanel.label ?? i18n.t('resizable.story.top', 'Top')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
          withHandle={layout.handles[0]?.withHandle}
        />
        <ResizablePanel
          collapsible={layout.rightPanel.collapsible}
          defaultSize={layout.rightPanel.defaultSize}
          maxSize={layout.rightPanel.maxSize}
          minSize={layout.rightPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {layout.rightPanel.label ?? i18n.t('resizable.story.bottom', 'Bottom')}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export const FactoryTwoPanelVertical: Story = {
  render: () => <FactoryTwoPanelVerticalDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-two-panel-vertical"]');
    expect(container).toBeInTheDocument();

    const direction = container?.getAttribute('data-panel-group-direction');
    expect(direction).toBe('vertical');

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);

    await waitFor(() => {
      expect(canvas.getByText('Editor')).toBeInTheDocument();
      expect(canvas.getByText('Terminal')).toBeInTheDocument();
    });
  },
};

// ---------- Three-Panel Horizontal Factory ----------

function FactoryThreePanelHorizontalDemo() {
  const layout: FakeThreePanelLayout = createFakeThreePanelHorizontal();

  return (
    <div className="w-full max-w-4xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.threePanelHorizontal')}</p>
      <ResizablePanelGroup
        className="min-h-[250px] w-full rounded-md border"
        data-testid="factory-three-panel-horizontal"
        direction={layout.direction}
      >
        <ResizablePanel
          collapsible={layout.leftPanel.collapsible}
          defaultSize={layout.leftPanel.defaultSize}
          maxSize={layout.leftPanel.maxSize}
          minSize={layout.leftPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {layout.leftPanel.label ?? i18n.t('resizable.story.left', 'Left')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizeLeft', 'Resize left')}
          withHandle={layout.handles[0]?.withHandle}
        />
        <ResizablePanel
          defaultSize={layout.centerPanel.defaultSize}
          minSize={layout.centerPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {layout.centerPanel.label ?? i18n.t('resizable.story.center', 'Center')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizeRight', 'Resize right')}
          withHandle={layout.handles[1]?.withHandle}
        />
        <ResizablePanel
          collapsible={layout.rightPanel.collapsible}
          defaultSize={layout.rightPanel.defaultSize}
          maxSize={layout.rightPanel.maxSize}
          minSize={layout.rightPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {layout.rightPanel.label ?? i18n.t('resizable.story.right', 'Right')}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export const FactoryThreePanelHorizontal: Story = {
  render: () => <FactoryThreePanelHorizontalDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-three-panel-horizontal"]');
    expect(container).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(3);

    const handles = canvasElement.querySelectorAll('[data-slot="resizable-handle"]');
    expect(handles.length).toBe(2);

    await waitFor(() => {
      expect(canvas.getByText('Explorer')).toBeInTheDocument();
      expect(canvas.getByText('Editor')).toBeInTheDocument();
      expect(canvas.getByText('Properties')).toBeInTheDocument();
    });
  },
};

// ---------- IDE Layout Factory ----------

function FactoryIDELayoutDemo() {
  const ide: FakeIDELayout = createFakeIDELayout();

  return (
    <div className="w-full max-w-5xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.ideLayout')}</p>
      <ResizablePanelGroup
        className="min-h-[400px] w-full rounded-md border"
        data-testid="factory-ide-layout"
        direction="horizontal"
      >
        <ResizablePanel
          collapsible={ide.leftPanel.collapsible}
          defaultSize={ide.leftPanel.defaultSize}
          maxSize={ide.leftPanel.maxSize}
          minSize={ide.leftPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {ide.leftPanel.label ?? i18n.t('resizable.story.explorer', 'Explorer')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizeExplorer', 'Resize explorer')}
          withHandle
        />
        <ResizablePanel defaultSize={ide.mainPanel.defaultSize} minSize={ide.mainPanel.minSize}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={75}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {ide.mainPanel.label ?? i18n.t('resizable.story.editor', 'Editor')}
              </div>
            </ResizablePanel>
            {ide.bottomPanel && (
              <>
                <ResizableHandle
                  aria-label={i18n.t('resizable.story.resizeTerminal', 'Resize terminal')}
                  withHandle
                />
                <ResizablePanel
                  collapsible={ide.bottomPanel.collapsible}
                  defaultSize={25}
                  maxSize={ide.bottomPanel.maxSize}
                  minSize={ide.bottomPanel.minSize}
                >
                  <div className="flex h-full items-center justify-center p-4 text-sm">
                    {ide.bottomPanel.label ?? i18n.t('resizable.story.terminal', 'Terminal')}
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
        {ide.rightPanel && (
          <>
            <ResizableHandle
              aria-label={i18n.t('resizable.story.resizeInspector', 'Resize inspector')}
              withHandle
            />
            <ResizablePanel
              collapsible={ide.rightPanel.collapsible}
              defaultSize={ide.rightPanel.defaultSize}
              maxSize={ide.rightPanel.maxSize}
              minSize={ide.rightPanel.minSize}
            >
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {ide.rightPanel.label ?? i18n.t('resizable.story.inspector', 'Inspector')}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}

export const FactoryIDELayout: Story = {
  render: () => <FactoryIDELayoutDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-ide-layout"]');
    expect(container).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBeGreaterThanOrEqual(3);

    await waitFor(() => {
      expect(canvas.getByText('Explorer')).toBeInTheDocument();
      expect(canvas.getByText('Editor')).toBeInTheDocument();
    });
  },
};

// ---------- Mail Layout Factory ----------

function FactoryMailLayoutDemo() {
  const layout: FakeTwoPanelLayout = createFakeMailLayout();

  return (
    <div className="w-full max-w-4xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.mailLayout')}</p>
      <ResizablePanelGroup
        className="min-h-[250px] w-full rounded-md border"
        data-testid="factory-mail-layout"
        direction={layout.direction}
      >
        <ResizablePanel
          defaultSize={layout.leftPanel.defaultSize}
          maxSize={layout.leftPanel.maxSize}
          minSize={layout.leftPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {layout.leftPanel.label ?? i18n.t('resizable.story.mailList', 'Mail List')}
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
          withHandle={layout.handles[0]?.withHandle}
        />
        <ResizablePanel
          defaultSize={layout.rightPanel.defaultSize}
          minSize={layout.rightPanel.minSize}
        >
          <div className="flex h-full items-center justify-center p-4 text-sm">
            {layout.rightPanel.label ?? i18n.t('resizable.story.messagePreview', 'Message Preview')}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export const FactoryMailLayout: Story = {
  render: () => <FactoryMailLayoutDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-mail-layout"]');
    expect(container).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(2);

    await waitFor(() => {
      expect(canvas.getByText('Mail List')).toBeInTheDocument();
      expect(canvas.getByText('Message Preview')).toBeInTheDocument();
    });
  },
};

// ---------- Dashboard Layout Factory ----------

function FactoryDashboardLayoutDemo() {
  const layout: FakeResizablePanelGroup = createFakeDashboardLayout();

  return (
    <div className="w-full max-w-5xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.dashboardLayout')}</p>
      <ResizablePanelGroup
        className="min-h-[220px] w-full rounded-md border"
        data-testid="factory-dashboard-layout"
        direction={layout.direction}
      >
        {layout.panels.map((panel, i) => (
          <React.Fragment key={panel.id}>
            {i > 0 && (
              <ResizableHandle
                aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                withHandle={layout.handles[i - 1]?.withHandle}
              />
            )}
            <ResizablePanel defaultSize={panel.defaultSize}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {panel.label ?? `Panel ${String(i + 1)}`}
              </div>
            </ResizablePanel>
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
}

export const FactoryDashboardLayout: Story = {
  render: () => <FactoryDashboardLayoutDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-dashboard-layout"]');
    expect(container).toBeInTheDocument();

    const panels = canvasElement.querySelectorAll('[data-slot="resizable-panel"]');
    expect(panels.length).toBe(3);

    await waitFor(() => {
      expect(canvas.getByText('Metrics')).toBeInTheDocument();
      expect(canvas.getByText('Charts')).toBeInTheDocument();
      expect(canvas.getByText('Activity')).toBeInTheDocument();
    });
  },
};

// ---------- Hidden Handle Layout Factory ----------

function FactoryHiddenHandleLayoutDemo() {
  const layout: FakeResizablePanelGroup = createFakeHiddenHandleLayout();

  return (
    <div className="w-full max-w-4xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.hiddenHandles')}</p>
      <ResizablePanelGroup
        className="min-h-[180px] w-full rounded-md border"
        data-testid="factory-hidden-handle"
        direction={layout.direction}
      >
        {layout.panels.map((panel, i) => (
          <React.Fragment key={panel.id}>
            {i > 0 && (
              <ResizableHandle
                aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                withHandle={layout.handles[i - 1]?.withHandle}
              />
            )}
            <ResizablePanel defaultSize={panel.defaultSize}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {panel.label ?? `Panel ${String(i + 1)}`}
              </div>
            </ResizablePanel>
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
}

export const FactoryHiddenHandleLayout: Story = {
  render: () => <FactoryHiddenHandleLayoutDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-hidden-handle"]');
    expect(container).toBeInTheDocument();

    const handle = canvasElement.querySelector('[data-slot="resizable-handle"]');
    expect(handle).toBeInTheDocument();
    // Hidden handle should not have an SVG grip icon
    expect(handle?.querySelector('svg')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(canvas.getByText(/Panel/)).toBeInTheDocument();
    });
  },
};

// ---------- Visible Handle Layout Factory ----------

function FactoryVisibleHandleLayoutDemo() {
  const layout: FakeResizablePanelGroup = createFakeVisibleHandleLayout();

  return (
    <div className="w-full max-w-4xl space-y-2">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.visibleHandles')}</p>
      <ResizablePanelGroup
        className="min-h-[180px] w-full rounded-md border"
        data-testid="factory-visible-handle"
        direction={layout.direction}
      >
        {layout.panels.map((panel, i) => (
          <React.Fragment key={panel.id}>
            {i > 0 && (
              <ResizableHandle
                aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                withHandle={layout.handles[i - 1]?.withHandle}
              />
            )}
            <ResizablePanel defaultSize={panel.defaultSize}>
              <div className="flex h-full items-center justify-center p-4 text-sm">
                {panel.label ?? `Panel ${String(i + 1)}`}
              </div>
            </ResizablePanel>
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
}

export const FactoryVisibleHandleLayout: Story = {
  render: () => <FactoryVisibleHandleLayoutDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="factory-visible-handle"]');
    expect(container).toBeInTheDocument();

    const handles = canvasElement.querySelectorAll('[data-slot="resizable-handle"]');
    expect(handles.length).toBeGreaterThanOrEqual(2);

    // All handles should have SVG grip icons
    for (const handle of handles) {
      expect(handle.querySelector('svg')).toBeInTheDocument();
    }

    await waitFor(() => {
      expect(canvas.getByText(/Panel/)).toBeInTheDocument();
    });
  },
};

// ---------- Direction Matrix Factory ----------

function FactoryDirectionMatrixDemo() {
  const matrix: FakeResizablePanelGroup[] = createResizableDirectionMatrix();

  return (
    <div className="w-full max-w-4xl space-y-4">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.directionMatrix')}</p>
      {matrix.map((group) => (
        <div key={group.id}>
          <p className="text-muted-foreground mb-1 text-xs">{group.direction}</p>
          <ResizablePanelGroup
            className="min-h-[150px] w-full rounded-md border"
            data-testid={`factory-direction-${group.direction}`}
            direction={group.direction}
          >
            {group.panels.map((panel, pi) => (
              <React.Fragment key={panel.id}>
                {pi > 0 && (
                  <ResizableHandle
                    aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                    withHandle={group.handles[pi - 1]?.withHandle}
                  />
                )}
                <ResizablePanel defaultSize={panel.defaultSize}>
                  <div className="flex h-full items-center justify-center p-4 text-sm">
                    {panel.label ?? `Panel ${String(pi + 1)}`}
                  </div>
                </ResizablePanel>
              </React.Fragment>
            ))}
          </ResizablePanelGroup>
        </div>
      ))}
    </div>
  );
}

export const FactoryDirectionMatrix: Story = {
  render: () => <FactoryDirectionMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const horizontal = canvasElement.querySelector('[data-testid="factory-direction-horizontal"]');
    const vertical = canvasElement.querySelector('[data-testid="factory-direction-vertical"]');
    expect(horizontal).toBeInTheDocument();
    expect(vertical).toBeInTheDocument();

    expect(horizontal?.getAttribute('data-panel-group-direction')).toBe('horizontal');
    expect(vertical?.getAttribute('data-panel-group-direction')).toBe('vertical');

    await waitFor(() => {
      expect(canvas.getByText('horizontal')).toBeInTheDocument();
      expect(canvas.getByText('vertical')).toBeInTheDocument();
    });
  },
};

// ---------- Panel Count Matrix Factory ----------

function FactoryPanelCountMatrixDemo() {
  const { t } = useTranslation();
  const matrix: FakeResizablePanelGroup[] = createResizablePanelCountMatrix();

  return (
    <div className="w-full max-w-4xl space-y-4">
      <p className="text-sm font-medium">{t('resizable.factory.panelCountMatrix')}</p>
      {matrix.map((group) => (
        <div key={group.id}>
          <p className="text-muted-foreground mb-1 text-xs">{String(group.panels.length)} panels</p>
          <ResizablePanelGroup
            className="min-h-[120px] w-full rounded-md border"
            data-testid={`factory-panel-count-${String(group.panels.length)}`}
            direction={group.direction}
          >
            {group.panels.map((panel, pi) => (
              <React.Fragment key={panel.id}>
                {pi > 0 && (
                  <ResizableHandle
                    aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                    withHandle={group.handles[pi - 1]?.withHandle}
                  />
                )}
                <ResizablePanel defaultSize={panel.defaultSize}>
                  <div className="flex h-full items-center justify-center p-4 text-sm">
                    {panel.label ?? `Panel ${String(pi + 1)}`}
                  </div>
                </ResizablePanel>
              </React.Fragment>
            ))}
          </ResizablePanelGroup>
        </div>
      ))}
    </div>
  );
}

export const FactoryPanelCountMatrix: Story = {
  render: () => <FactoryPanelCountMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const twoPanel = canvasElement.querySelector('[data-testid="factory-panel-count-2"]');
    const threePanel = canvasElement.querySelector('[data-testid="factory-panel-count-3"]');
    const fourPanel = canvasElement.querySelector('[data-testid="factory-panel-count-4"]');
    expect(twoPanel).toBeInTheDocument();
    expect(threePanel).toBeInTheDocument();
    expect(fourPanel).toBeInTheDocument();

    // Verify panel counts
    expect(twoPanel?.querySelectorAll('[data-slot="resizable-panel"]').length).toBe(2);
    expect(threePanel?.querySelectorAll('[data-slot="resizable-panel"]').length).toBe(3);
    expect(fourPanel?.querySelectorAll('[data-slot="resizable-panel"]').length).toBe(4);

    await waitFor(() => {
      expect(canvas.getByText('2 panels')).toBeInTheDocument();
      expect(canvas.getByText('3 panels')).toBeInTheDocument();
      expect(canvas.getByText('4 panels')).toBeInTheDocument();
    });
  },
};

// ---------- Handle Style Matrix Factory ----------

function FactoryHandleStyleMatrixDemo() {
  const { t } = useTranslation();
  const matrix: FakeResizablePanelGroup[] = createResizableHandleStyleMatrix();

  return (
    <div className="w-full max-w-4xl space-y-4">
      <p className="text-sm font-medium">{t('resizable.factory.handleStyleMatrix')}</p>
      {matrix.map((group, gi) => (
        <div key={group.id}>
          <p className="text-muted-foreground mb-1 text-xs">
            Handle: {group.handles[0]?.withHandle ? 'with grip' : 'without grip'}
          </p>
          <ResizablePanelGroup
            className="min-h-[120px] w-full rounded-md border"
            data-testid={`factory-handle-style-${String(gi)}`}
            direction={group.direction}
          >
            {group.panels.map((panel, pi) => (
              <React.Fragment key={panel.id}>
                {pi > 0 && (
                  <ResizableHandle
                    aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                    withHandle={group.handles[pi - 1]?.withHandle}
                  />
                )}
                <ResizablePanel defaultSize={panel.defaultSize}>
                  <div className="flex h-full items-center justify-center p-4 text-sm">
                    {panel.label ?? `Panel ${String(pi + 1)}`}
                  </div>
                </ResizablePanel>
              </React.Fragment>
            ))}
          </ResizablePanelGroup>
        </div>
      ))}
    </div>
  );
}

export const FactoryHandleStyleMatrix: Story = {
  render: () => <FactoryHandleStyleMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const withGrip = canvasElement.querySelector('[data-testid="factory-handle-style-0"]');
    const withoutGrip = canvasElement.querySelector('[data-testid="factory-handle-style-1"]');
    expect(withGrip).toBeInTheDocument();
    expect(withoutGrip).toBeInTheDocument();

    // First group should have grip icon
    expect(withGrip?.querySelector('[data-slot="resizable-handle"] svg')).toBeInTheDocument();
    // Second group should not have grip icon
    expect(
      withoutGrip?.querySelector('[data-slot="resizable-handle"] svg')
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(canvas.getByText('Handle: with grip')).toBeInTheDocument();
      expect(canvas.getByText('Handle: without grip')).toBeInTheDocument();
    });
  },
};

// ---------- Showcase Factory ----------

function FactoryShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = createResizableShowcase();

  return (
    <div className="w-full max-w-5xl space-y-6">
      <p className="text-sm font-medium">{t('resizable.factory.showcase')}</p>
      {showcase.map((item) => {
        const { layout } = item;
        const panels = 'panels' in layout ? layout.panels : [];
        const handles = 'handles' in layout ? layout.handles : [];
        const direction = 'direction' in layout ? layout.direction : 'horizontal';

        return (
          <div key={item.name}>
            <p className="mb-1 text-sm font-medium">{item.name}</p>
            <p className="text-muted-foreground mb-2 text-xs">{item.description}</p>
            {panels.length > 0 && (
              <ResizablePanelGroup
                className="min-h-[150px] w-full rounded-md border"
                data-testid={`factory-showcase-${item.name.toLowerCase().replaceAll(/\s+/g, '-')}`}
                direction={direction}
              >
                {panels.map((panel, pi) => (
                  <React.Fragment key={panel.id}>
                    {pi > 0 && (
                      <ResizableHandle
                        aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                        withHandle={handles[pi - 1]?.withHandle}
                      />
                    )}
                    <ResizablePanel defaultSize={panel.defaultSize}>
                      <div className="flex h-full items-center justify-center p-4 text-sm">
                        {panel.label ?? `Panel ${String(pi + 1)}`}
                      </div>
                    </ResizablePanel>
                  </React.Fragment>
                ))}
              </ResizablePanelGroup>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const FactoryShowcase: Story = {
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Showcase should render multiple panel groups
    const panelGroups = canvasElement.querySelectorAll('[data-slot="resizable-panel-group"]');
    expect(panelGroups.length).toBeGreaterThanOrEqual(6);

    await waitFor(() => {
      expect(canvas.getByText('Two Panel Horizontal')).toBeInTheDocument();
      expect(canvas.getByText('Three Panel')).toBeInTheDocument();
      expect(canvas.getByText('Dashboard')).toBeInTheDocument();
    });
  },
};

// ---------- Test Data Factory ----------

function FactoryTestDataDemo() {
  const testData = createResizableTestData();

  return (
    <div className="w-full max-w-5xl space-y-6">
      <p className="text-sm font-medium">{i18n.t('resizable.factory.testData')}</p>

      <div>
        <p className="text-muted-foreground mb-1 text-xs">
          Panels: {String(testData.panels.length)} | Handles: {String(testData.handles.length)} |
          Groups: {String(testData.panelGroups.length)}
        </p>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium">{i18n.t('resizable.story.twoPanelHorizontal')}</p>
        <ResizablePanelGroup
          className="min-h-[120px] w-full rounded-md border"
          data-testid="factory-test-data-horizontal"
          direction={testData.twoPanelHorizontal.direction}
        >
          {testData.twoPanelHorizontal.panels.map((panel, i) => (
            <React.Fragment key={panel.id}>
              {i > 0 && (
                <ResizableHandle
                  aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                  withHandle={testData.twoPanelHorizontal.handles[i - 1]?.withHandle}
                />
              )}
              <ResizablePanel defaultSize={panel.defaultSize}>
                <div className="flex h-full items-center justify-center p-4 text-sm">
                  {panel.label ?? `Panel ${String(i + 1)}`}
                </div>
              </ResizablePanel>
            </React.Fragment>
          ))}
        </ResizablePanelGroup>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium">{i18n.t('resizable.story.twoPanelVertical')}</p>
        <ResizablePanelGroup
          className="min-h-[200px] w-full rounded-md border"
          data-testid="factory-test-data-vertical"
          direction={testData.twoPanelVertical.direction}
        >
          {testData.twoPanelVertical.panels.map((panel, i) => (
            <React.Fragment key={panel.id}>
              {i > 0 && (
                <ResizableHandle
                  aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
                  withHandle={testData.twoPanelVertical.handles[i - 1]?.withHandle}
                />
              )}
              <ResizablePanel defaultSize={panel.defaultSize}>
                <div className="flex h-full items-center justify-center p-4 text-sm">
                  {panel.label ?? `Panel ${String(i + 1)}`}
                </div>
              </ResizablePanel>
            </React.Fragment>
          ))}
        </ResizablePanelGroup>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium">
          Showcase items: {String(testData.showcase.length)}
        </p>
        <p className="mb-1 text-xs font-medium">
          Direction matrix: {String(testData.directionMatrix.length)}
        </p>
        <p className="mb-1 text-xs font-medium">
          Panel count matrix: {String(testData.panelCountMatrix.length)}
        </p>
        <p className="text-xs font-medium">
          Handle style matrix: {String(testData.handleStyleMatrix.length)}
        </p>
      </div>
    </div>
  );
}

export const FactoryTestData: Story = {
  render: () => <FactoryTestDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const horizontal = canvasElement.querySelector('[data-testid="factory-test-data-horizontal"]');
    const vertical = canvasElement.querySelector('[data-testid="factory-test-data-vertical"]');
    expect(horizontal).toBeInTheDocument();
    expect(vertical).toBeInTheDocument();

    await waitFor(() => {
      expect(canvas.getByText(/Panels: 5/)).toBeInTheDocument();
      expect(canvas.getByText(/Handles: 4/)).toBeInTheDocument();
      expect(canvas.getByText(/Groups: 3/)).toBeInTheDocument();
      expect(canvas.getByText(/Showcase items: 8/)).toBeInTheDocument();
    });
  },
};

// ---------- Constants Factory ----------

function FactoryConstantsDemo() {
  const { t } = useTranslation();
  const directions: ResizableDirection[] = RESIZABLE_DIRECTIONS;
  const handleStyles: ResizableHandleStyle[] = RESIZABLE_HANDLE_STYLES;
  const contentTypes: PanelContentType[] = PANEL_CONTENT_TYPES;
  const positions: PanelPosition[] = PANEL_POSITIONS;
  const defaultSizes: number[] = DEFAULT_PANEL_SIZES;
  const minSizes: number[] = MIN_PANEL_SIZES;
  const maxSizes: number[] = MAX_PANEL_SIZES;

  return (
    <div className="w-full max-w-4xl space-y-4">
      <p className="text-sm font-medium">{t('resizable.factory.constants')}</p>

      <div className="space-y-3 rounded-md border p-4">
        <div>
          <p className="text-xs font-medium" data-testid="const-directions">
            {t('resizable.factory.directions')}: {directions.join(', ')}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium" data-testid="const-handle-styles">
            {t('resizable.factory.handleStyles')}: {handleStyles.join(', ')}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium" data-testid="const-content-types">
            {t('resizable.factory.contentTypes')}: {contentTypes.join(', ')}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium" data-testid="const-positions">
            {t('resizable.factory.positions')}: {positions.join(', ')}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium" data-testid="const-default-sizes">
            {t('resizable.factory.defaultSizes')}: {defaultSizes.join(', ')}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium" data-testid="const-min-sizes">
            {t('resizable.factory.minSizes')}: {minSizes.join(', ')}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium" data-testid="const-max-sizes">
            {t('resizable.factory.maxSizes')}: {maxSizes.join(', ')}
          </p>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-1 text-xs">
          Sample: {directions[0]} direction, {contentTypes[0]} content
        </p>
        <ResizablePanelGroup
          className="min-h-[120px] w-full rounded-md border"
          data-testid="factory-constants-demo"
          direction={directions[0]}
        >
          <ResizablePanel defaultSize={defaultSizes[4]} minSize={minSizes[0]}>
            <div className="flex h-full items-center justify-center p-4 text-sm">
              {contentTypes[0]} ({String(defaultSizes[4])}%)
            </div>
          </ResizablePanel>
          <ResizableHandle
            aria-label={i18n.t('resizable.story.resizePanels', 'Resize panels')}
            withHandle
          />
          <ResizablePanel defaultSize={100 - defaultSizes[4]} maxSize={maxSizes[4]}>
            <div className="flex h-full items-center justify-center p-4 text-sm">
              {contentTypes[1]} ({String(100 - defaultSizes[4])}%)
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  render: () => <FactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify constants are rendered
    const directionsEl = canvasElement.querySelector('[data-testid="const-directions"]');
    expect(directionsEl).toBeInTheDocument();
    expect(directionsEl?.textContent).toContain('horizontal');
    expect(directionsEl?.textContent).toContain('vertical');

    const handleStylesEl = canvasElement.querySelector('[data-testid="const-handle-styles"]');
    expect(handleStylesEl).toBeInTheDocument();
    expect(handleStylesEl?.textContent).toContain('default');
    expect(handleStylesEl?.textContent).toContain('visible');

    const contentTypesEl = canvasElement.querySelector('[data-testid="const-content-types"]');
    expect(contentTypesEl).toBeInTheDocument();
    expect(contentTypesEl?.textContent).toContain('text');
    expect(contentTypesEl?.textContent).toContain('code');

    const positionsEl = canvasElement.querySelector('[data-testid="const-positions"]');
    expect(positionsEl).toBeInTheDocument();
    expect(positionsEl?.textContent).toContain('left');
    expect(positionsEl?.textContent).toContain('right');

    const defaultSizesEl = canvasElement.querySelector('[data-testid="const-default-sizes"]');
    expect(defaultSizesEl).toBeInTheDocument();
    expect(defaultSizesEl?.textContent).toContain('50');

    const minSizesEl = canvasElement.querySelector('[data-testid="const-min-sizes"]');
    expect(minSizesEl).toBeInTheDocument();
    expect(minSizesEl?.textContent).toContain('10');

    const maxSizesEl = canvasElement.querySelector('[data-testid="const-max-sizes"]');
    expect(maxSizesEl).toBeInTheDocument();
    expect(maxSizesEl?.textContent).toContain('90');

    // Verify the demo panel renders
    const demoPanel = canvasElement.querySelector('[data-testid="factory-constants-demo"]');
    expect(demoPanel).toBeInTheDocument();

    await waitFor(() => {
      expect(canvas.getByText(/text \(50%\)/)).toBeInTheDocument();
    });
  },
};

// ============================================================================
// ADDITIONAL HANDLER STATUS STORIES
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('resizable.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: resizableStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('resizable.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: resizableStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('resizable.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: resizableStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

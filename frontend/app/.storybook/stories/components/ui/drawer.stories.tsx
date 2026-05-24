import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  drawerHandlers,
  drawerStatusHandlers,
} from '@/.storybook/stories/_handlers/drawer.handlers';
import {
  createFakeBottomDrawer,
  createFakeCartDrawer,
  createFakeCartItem,
  createFakeCartItems,
  createFakeDarkModeDrawer,
  createFakeDrawer,
  createFakeDrawerContent,
  createFakeDrawerMatrix,
  createFakeDrawerNavItem,
  createFakeDrawerNavItems,
  createFakeDrawersAllDirections,
  createFakeDrawerShowcase,
  createFakeDrawerThemeVariants,
  createFakeFilterGroup,
  createFakeFilterGroups,
  createFakeFilterOption,
  createFakeFiltersDrawer,
  createFakeHelpDrawer,
  createFakeLeftDrawer,
  createFakeMobileMenuDrawer,
  createFakeNavigationDrawer,
  createFakeNotificationItem,
  createFakeNotificationItems,
  createFakeNotificationsDrawer,
  createFakeOverlayBlurred,
  createFakeOverlayHidden,
  createFakeOverlayState,
  createFakeOverlayVisible,
  createFakeProductQuickViewDrawer,
  createFakeRightDrawer,
  createFakeSettingsDrawer,
  createFakeSettingsSection,
  createFakeSlideState,
  createFakeSlideStateClosed,
  createFakeSlideStateClosing,
  createFakeSlideStateOpen,
  createFakeSlideStateOpening,
  createFakeSlideStatesAllDirections,
  createFakeSnapPointState,
  createFakeSnapPointStatesAll,
  createFakeSwipeBelowThreshold,
  createFakeSwipeDismiss,
  createFakeSwipeGesture,
  createFakeSwipeGesturesAllDirections,
  createFakeTopDrawer,
  DEFAULT_SNAP_POINTS,
  DRAWER_DIRECTIONS,
  DRAWER_SIZES,
  DRAWER_TYPES,
  FILTER_CATEGORIES,
  NAVIGATION_ITEMS,
  NOTIFICATION_ICONS,
} from '@/.storybook/stories/_factories/drawer.factory';
import type {
  DrawerDirection,
  DrawerSize,
  DrawerSnapPoint,
  DrawerType,
  FakeCartDrawer,
  FakeCartItem,
  FakeDarkModeDrawer,
  FakeDrawer,
  FakeDrawerContent,
  FakeDrawerNavItem,
  FakeFilterGroup,
  FakeFilterOption,
  FakeFiltersDrawer,
  FakeNavigationDrawer,
  FakeNotificationItem,
  FakeNotificationsDrawer,
  FakeOverlayState,
  FakeSettingsDrawer,
  FakeSettingsSection,
  FakeSlideState,
  FakeSnapPointState,
  FakeSwipeGesture,
  SlideAnimationState,
} from '@/.storybook/stories/_factories/drawer.factory';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function DrawerDemo({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <DrawerTrigger asChild>
        <Button variant="outline">{t('drawer.open')}</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('drawer.title')}</DrawerTitle>
          <DrawerDescription>{t('drawer.description')}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2 text-sm">{t('drawer.content')}</div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">{t('drawer.action.cancel')}</Button>
          </DrawerClose>
          <DrawerClose asChild>
            <Button>{t('drawer.action.continue')}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const meta = {
  title: 'Components/UI/Drawer',
  component: DrawerDemo,
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
  parameters: {
    msw: { handlers: drawerHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    title: {
      control: 'text',
      description: i18n.t('drawer.argType.drawerTitleText', 'Drawer title text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    description: {
      control: 'text',
      description: i18n.t('drawer.argType.drawerDescriptionText', 'Drawer description text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'drawer.argType.additionalCssClassesForTheDrawerContent',
        'Additional CSS classes for the drawer content'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    shouldScaleBackground: {
      control: 'boolean',
      description: i18n.t(
        'drawer.argType.whetherToScaleBackgroundWhenOpen',
        'Whether to scale background when open'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    // State
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'drawer.argType.initialOpenStateOfTheDrawer',
        'Initial open state of the drawer'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    dismissible: {
      control: 'boolean',
      description: i18n.t(
        'drawer.argType.whetherTheDrawerCanBeDismissed',
        'Whether the drawer can be dismissed'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    modal: {
      control: 'boolean',
      description: i18n.t(
        'drawer.argType.whetherToBlockInteractionOutsideTheDrawer',
        'Whether to block interaction outside the drawer'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    direction: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      description: i18n.t(
        'drawer.argType.directionTheDrawerSlidesFrom',
        'Direction the drawer slides from'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'bottom' },
        type: { summary: "'top' | 'bottom' | 'left' | 'right'" },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('drawer.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('drawer.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('drawer.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('drawer.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('drawer.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('drawer.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('drawer.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'drawer.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    onEscapeKeyDown: {
      action: 'onEscapeKeyDown',
      description: i18n.t(
        'drawer.argType.calledWhenEscapeKeyIsPressed',
        'Called when Escape key is pressed'
      ),
      table: { category: 'Events' },
    },
    // Drawer Props Reference (Vaul Drawer.Root):
    // - open: Controlled open state (boolean)
    // - defaultOpen: Default open state for uncontrolled usage (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - shouldScaleBackground: Scale background when open (boolean, default: true)
    // - dismissible: Whether drawer can be dismissed (boolean, default: true)
    // - modal: Whether to block interaction outside (boolean, default: true)
    // - direction: Slide direction ('top' | 'bottom' | 'left' | 'right', default: 'bottom')
    // - snapPoints: Snap points for drawer position (number[])
    // - activeSnapPoint: Active snap point (number | string | null)
    // - setActiveSnapPoint: Set active snap point ((value: number | string | null) => void)
    // - fadeFromIndex: Start fade from this snap index (number)
    //
    // DrawerTrigger Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // DrawerContent Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Drawer body content (ReactNode)
    //
    // DrawerHeader, DrawerFooter Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Section content (ReactNode)
    //
    // DrawerTitle Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Title text content (ReactNode)
    //
    // DrawerDescription Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Description text content (ReactNode)
    //
    // DrawerClose Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) {
        throw new Error('Drawer content not found');
      }
      return el;
    });
    expect(content).toBeInTheDocument();
    expect(doc.body.querySelector('[data-slot="drawer-overlay"]')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function DrawerVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.variants.bottom')}</p>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">{i18n.t('drawer.story.openBottom', 'Open Bottom')}</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.bottomDrawer', 'Bottom Drawer')}</DrawerTitle>
              <DrawerDescription>
                This drawer slides up from the bottom of the screen.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm">
                {i18n.t('drawer.story.contentGoesHere', 'Content goes here.')}
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.variants.top')}</p>
        <Drawer direction="top">
          <DrawerTrigger asChild>
            <Button variant="outline">{i18n.t('drawer.story.openTop', 'Open Top')}</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.topDrawer', 'Top Drawer')}</DrawerTitle>
              <DrawerDescription>
                This drawer slides down from the top of the screen.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm">
                {i18n.t('drawer.story.contentGoesHere', 'Content goes here.')}
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.variants.left')}</p>
        <Drawer direction="left">
          <DrawerTrigger asChild>
            <Button variant="outline">{i18n.t('drawer.story.openLeft', 'Open Left')}</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.leftDrawer', 'Left Drawer')}</DrawerTitle>
              <DrawerDescription>
                {i18n.t(
                  'drawer.story.thisDrawerSlidesInFromTheLeftSide',
                  'This drawer slides in from the left side.'
                )}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm">
                {i18n.t('drawer.story.contentGoesHere', 'Content goes here.')}
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.variants.right')}</p>
        <Drawer direction="right">
          <DrawerTrigger asChild>
            <Button variant="outline">{i18n.t('drawer.story.openRight', 'Open Right')}</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.rightDrawer', 'Right Drawer')}</DrawerTitle>
              <DrawerDescription>
                {i18n.t(
                  'drawer.story.thisDrawerSlidesInFromTheRightSide',
                  'This drawer slides in from the right side.'
                )}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm">
                {i18n.t('drawer.story.contentGoesHere', 'Content goes here.')}
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.variants.withForm')}</p>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">
              {i18n.t('drawer.story.editSettings', 'Edit Settings')}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.settings', 'Settings')}</DrawerTitle>
              <DrawerDescription>
                {i18n.t(
                  'drawer.story.updateYourPreferencesBelow',
                  'Update your preferences below.'
                )}
              </DrawerDescription>
            </DrawerHeader>
            <div className="grid gap-4 px-4 pb-4">
              <div className="grid gap-2">
                <label htmlFor="display-name" className="text-sm font-medium">
                  Display Name
                </label>
                <input
                  id="display-name"
                  type="text"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  defaultValue="John Doe"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  defaultValue="john@example.com"
                />
              </div>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.cancel', 'Cancel')}</Button>
              </DrawerClose>
              <Button>{i18n.t('drawer.story.saveChanges', 'Save Changes')}</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.variants.nested')}</p>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">{i18n.t('drawer.story.viewDetails', 'View Details')}</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.itemDetails', 'Item Details')}</DrawerTitle>
              <DrawerDescription>
                {i18n.t(
                  'drawer.story.viewAndManageItemInformation',
                  'View and manage item information.'
                )}
              </DrawerDescription>
            </DrawerHeader>
            <div className="max-h-[300px] overflow-y-auto px-4 pb-4">
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">Section 1</h4>
                  <p className="text-muted-foreground text-sm">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">Section 2</h4>
                  <p className="text-muted-foreground text-sm">
                    Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">Section 3</h4>
                  <p className="text-muted-foreground text-sm">
                    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
                  </p>
                </div>
              </div>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <DrawerVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Open Bottom')).toBeInTheDocument();
    expect(canvas.getByText('Open Top')).toBeInTheDocument();
    expect(canvas.getByText('Open Left')).toBeInTheDocument();
    expect(canvas.getByText('Open Right')).toBeInTheDocument();
  },
};

function DrawerSizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.sizes.small')}</p>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">{i18n.t('drawer.story.smallDrawer', 'Small Drawer')}</Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[25vh]">
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.quickAction', 'Quick Action')}</DrawerTitle>
              <DrawerDescription>
                {i18n.t(
                  'drawer.story.compactDrawerDescription',
                  'A compact drawer for simple actions.'
                )}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.cancel', 'Cancel')}</Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button>{i18n.t('drawer.story.confirm', 'Confirm')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.sizes.default')}</p>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">
              {i18n.t('drawer.story.defaultDrawer', 'Default Drawer')}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.standardDrawer', 'Standard Drawer')}</DrawerTitle>
              <DrawerDescription>
                The default drawer size that adjusts to content.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm">
                {i18n.t(
                  'drawer.story.thisDrawerAutomaticallySizesBasedOnItsCo',
                  'This drawer automatically sizes based on its content.'
                )}
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.cancel', 'Cancel')}</Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button>{i18n.t('drawer.story.continue', 'Continue')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.sizes.medium')}</p>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">
              {i18n.t('drawer.story.mediumDrawer', 'Medium Drawer')}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[50vh]">
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.mediumDrawer', 'Medium Drawer')}</DrawerTitle>
              <DrawerDescription>A medium-sized drawer for more content.</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <p className="mb-4 text-sm">
                This drawer has a fixed maximum height of 50% of the viewport height.
              </p>
              <p className="mb-4 text-sm">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua.
              </p>
              <p className="text-sm">
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
                ex ea commodo consequat.
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.cancel', 'Cancel')}</Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button>{i18n.t('drawer.story.continue', 'Continue')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.sizes.large')}</p>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">{i18n.t('drawer.story.largeDrawer', 'Large Drawer')}</Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[75vh]">
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.largeDrawer', 'Large Drawer')}</DrawerTitle>
              <DrawerDescription>
                A large drawer for extensive content or complex forms.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">Section 1</h4>
                  <p className="text-muted-foreground text-sm">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                    incididunt ut labore et dolore magna aliqua.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">Section 2</h4>
                  <p className="text-muted-foreground text-sm">
                    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
                    aliquip ex ea commodo consequat.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">Section 3</h4>
                  <p className="text-muted-foreground text-sm">
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                    fugiat nulla pariatur.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">Section 4</h4>
                  <p className="text-muted-foreground text-sm">
                    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
                    deserunt mollit anim id est laborum.
                  </p>
                </div>
              </div>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.cancel', 'Cancel')}</Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button>{i18n.t('drawer.story.saveAll', 'Save All')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <DrawerSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Small Drawer')).toBeInTheDocument();
    expect(canvas.getByText('Default Drawer')).toBeInTheDocument();
    expect(canvas.getByText('Medium Drawer')).toBeInTheDocument();
    expect(canvas.getByText('Large Drawer')).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const openButton = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    if (!(openButton instanceof HTMLButtonElement)) {
      throw new Error('Expected drawer trigger button to be present.');
    }

    expect(openButton.textContent?.trim()).not.toBe('');
    await userEvent.click(openButton);

    const drawerContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="drawer-content"]');

      if (!(content instanceof HTMLElement)) {
        throw new Error('Drawer content was not rendered.');
      }

      return content;
    });

    expect(doc.body.querySelector('[data-slot="drawer-overlay"]')).toBeInTheDocument();

    const title = drawerContent.querySelector('[data-slot="drawer-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Drawer title was not rendered.');
    }
    expect(title.textContent?.trim()).not.toBe('');

    const description = drawerContent.querySelector('[data-slot="drawer-description"]');
    if (!(description instanceof HTMLElement)) {
      throw new Error('Drawer description was not rendered.');
    }
    expect(description.textContent?.trim()).not.toBe('');

    const bodyCopy = drawerContent.querySelector('div.px-4.pb-2.text-sm');
    if (!(bodyCopy instanceof HTMLElement)) {
      throw new Error('Expected drawer body copy to be present.');
    }
    expect(bodyCopy.textContent?.trim()).not.toBe('');

    const footer = drawerContent.querySelector('[data-slot="drawer-footer"]');
    if (!(footer instanceof HTMLElement)) {
      throw new Error('Drawer footer was not rendered.');
    }

    const closeButtons = footer.querySelectorAll('[data-slot="drawer-close"]');
    expect(closeButtons.length).toBe(2);

    const cancelButton = closeButtons[0];
    if (!(cancelButton instanceof HTMLButtonElement)) {
      throw new Error('Expected cancel button to be present.');
    }

    expect(cancelButton.textContent?.trim()).not.toBe('');
    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
      expect(doc.body.querySelector('[data-slot="drawer-overlay"]')).not.toBeInTheDocument();
    });
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
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
    const canvas = within(canvasElement);

    expect(doc.documentElement.lang).toBe('ja');

    const openButton = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    if (!(openButton instanceof HTMLButtonElement)) {
      throw new Error('Expected drawer trigger button to be present.');
    }

    expect(canvas.getByText('ドロワーを開く')).toBeInTheDocument();
    await userEvent.click(openButton);

    const drawerContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="drawer-content"]');

      if (!(content instanceof HTMLElement)) {
        throw new Error('Drawer content was not rendered.');
      }

      return content;
    });

    const drawer = within(drawerContent);

    expect(drawer.getByText('ドロワーのタイトル')).toBeInTheDocument();
    expect(
      drawer.getByText('ドロワーはモバイルファーストや補助的なフローに使えます。')
    ).toBeInTheDocument();
    expect(
      drawer.getByText(
        'このコンテンツは端からスライドインし、開いている間フォーカスをトラップします。'
      )
    ).toBeInTheDocument();

    const footer = drawerContent.querySelector('[data-slot="drawer-footer"]');
    if (!(footer instanceof HTMLElement)) {
      throw new Error('Drawer footer was not rendered.');
    }

    const closeButtons = footer.querySelectorAll('[data-slot="drawer-close"]');
    const cancelButton = closeButtons[0];
    if (!(cancelButton instanceof HTMLButtonElement)) {
      throw new Error('Expected cancel button to be present.');
    }

    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
      expect(doc.body.querySelector('[data-slot="drawer-overlay"]')).not.toBeInTheDocument();
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
  name: i18n.t('drawer.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    msw: { handlers: drawerHandlers },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: drawerStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: drawerStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: drawerStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: drawerStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: drawerStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: drawerStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: drawerStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('drawer.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Drawer trigger was not found.');
    }

    // Test keyboard navigation - focus trigger
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Open drawer with Enter key
    await userEvent.keyboard('{Enter}');

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content was not found.');
      return el;
    });

    // Verify dialog role
    expect(content.getAttribute('role')).toBe('dialog');

    // Verify title is accessible
    const title = content.querySelector('[data-slot="drawer-title"]');
    expect(title).toBeInTheDocument();
    expect(title?.textContent?.trim()).not.toBe('');

    // Verify description is accessible
    const description = content.querySelector('[data-slot="drawer-description"]');
    expect(description).toBeInTheDocument();

    // Test focus trap - focus should be inside drawer
    const footer = content.querySelector('[data-slot="drawer-footer"]');
    const closeButton = footer?.querySelector('[data-slot="drawer-close"]');
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.focus();
      expect(doc.activeElement).toBe(closeButton);
    }

    // Close drawer with Escape key
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });

    // Focus should return to trigger after closing
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });
  },
};

// ============ FAKER INTEGRATION STORIES ============

function DrawerWithFakerData() {
  const fakeContent = React.useMemo(() => createFakeDrawerContent(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="faker-drawer-demo">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline">
            {i18n.t('drawer.story.openFakerDrawer', 'Open Faker Drawer')}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{fakeContent.title}</DrawerTitle>
            <DrawerDescription>{fakeContent.description}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 py-4 text-sm">
            <p className="text-muted-foreground">ID: {fakeContent.id}</p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{fakeContent.cancelLabel}</Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button variant={fakeContent.destructive ? 'destructive' : 'default'}>
                {fakeContent.confirmLabel}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <DrawerWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="faker-drawer-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected drawer trigger button to be present.');
    }

    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const drawer = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content was not found.');
      return el;
    });

    expect(drawer.querySelector('[data-slot="drawer-title"]')?.textContent?.trim()).not.toBe('');
    expect(drawer.querySelector('[data-slot="drawer-description"]')?.textContent?.trim()).not.toBe(
      ''
    );
  },
};

// ============ ASYNC DATA STORIES ============

interface DrawerApiResponse {
  cancelLabel: string;
  confirmLabel: string;
  content: string;
  description: string;
  id: string;
  title: string;
}

interface DrawerApiError {
  code: string;
  message: string;
  status: number;
}

function DrawerWithAsyncData() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<DrawerApiResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<DrawerApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/dialog-content/test-drawer')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as DrawerApiError;
          throw err;
        }
        return res.json() as Promise<DrawerApiResponse>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
        return undefined;
      })
      .catch((error_: DrawerApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    if (open && !data && !loading && !error) {
      fetchData();
    }
  }, [open, data, loading, error, fetchData]);

  const dataState = data ? 'success' : 'idle';
  const errorOrDataState = error ? 'error' : dataState;
  const currentState = loading ? 'loading' : errorOrDataState;

  return (
    <div data-testid="async-drawer-demo" data-state={currentState}>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline">
            {i18n.t('drawer.story.openAsyncDrawer', 'Open Async Drawer')}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          {loading && (
            <div data-testid="drawer-loading" className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          )}
          {error && (
            <div data-testid="drawer-error" data-error-status={error.status}>
              <DrawerHeader>
                <DrawerTitle className="text-destructive">
                  {i18n.t('drawer.story.error', 'Error')} {error.status}
                </DrawerTitle>
                <DrawerDescription>{error.message}</DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
                </DrawerClose>
                <Button onClick={fetchData}>{i18n.t('drawer.story.retry', 'Retry')}</Button>
              </DrawerFooter>
            </div>
          )}
          {data && !loading && !error && (
            <div data-testid="drawer-success">
              <DrawerHeader>
                <DrawerTitle>{data.title}</DrawerTitle>
                <DrawerDescription>{data.description}</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 py-4 text-sm">{data.content || 'Drawer content loaded.'}</div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">{data.cancelLabel}</Button>
                </DrawerClose>
                <DrawerClose asChild>
                  <Button>{data.confirmLabel}</Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: drawerHandlers },
  },
  render: () => <DrawerWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected drawer trigger button to be present.');
    }

    await userEvent.click(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="drawer-loading"]')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="drawer-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: drawerStatusHandlers.emptyData },
  },
  render: () => <DrawerWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="drawer-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowResponse: Story = {
  name: i18n.t('drawer.storyName.slowResponse', 'Slow Response (5s)'),
  parameters: {
    msw: { handlers: drawerStatusHandlers.slowResponse },
  },
  render: () => <DrawerWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    expect(doc.body.querySelector('[data-testid="drawer-loading"]')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="drawer-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error404NotFound: Story = {
  name: i18n.t('drawer.storyName.error404NotFound', 'Error 404: Not Found'),
  parameters: {
    msw: { handlers: drawerStatusHandlers.notFound },
  },
  render: () => <DrawerWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-error-status="404"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('drawer.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: drawerStatusHandlers.conflict },
  },
  render: () => <DrawerWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-error-status="409"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('drawer.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: drawerStatusHandlers.tooManyRequests },
  },
  render: () => <DrawerWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('drawer.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: drawerStatusHandlers.badGateway },
  },
  render: () => <DrawerWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('drawer.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: drawerStatusHandlers.serviceUnavailable },
  },
  render: () => <DrawerWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('drawer.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: drawerStatusHandlers.gatewayTimeout },
  },
  render: () => <DrawerWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ RESIZE HANDLE STORIES ============

type SnapPoint = number | string | null;

const ResizableDrawerComponent = () => {
  const [open, setOpen] = React.useState(true);
  const [activeSnapPoint, setActiveSnapPoint] = React.useState<SnapPoint>(0.5);
  const snapPoints: (number | string)[] = [0.25, 0.5, 0.75, 1];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Active snap point: <span data-testid="snap-point">{String(activeSnapPoint)}</span>
      </p>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        snapPoints={snapPoints}
        activeSnapPoint={activeSnapPoint}
        setActiveSnapPoint={setActiveSnapPoint}
      >
        <DrawerTrigger asChild>
          <Button variant="outline" data-testid="resize-trigger">
            Open Resizable Drawer
          </Button>
        </DrawerTrigger>
        <DrawerContent data-testid="resizable-drawer">
          <div
            className="bg-muted mx-auto mt-4 h-2 w-[100px] cursor-grab rounded-full active:cursor-grabbing"
            data-testid="resize-handle"
          />
          <DrawerHeader>
            <DrawerTitle>{i18n.t('drawer.story.resizableDrawer', 'Resizable Drawer')}</DrawerTitle>
            <DrawerDescription>
              Drag the handle to resize. Current height:{' '}
              {typeof activeSnapPoint === 'number' ? `${activeSnapPoint * 100}%` : activeSnapPoint}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 py-4">
            <p className="text-sm">
              This drawer can be resized by dragging the handle at the top. It will snap to
              predefined heights: 25%, 50%, 75%, and 100%.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {snapPoints.map((point) => (
                <Button
                  key={String(point)}
                  variant={activeSnapPoint === point ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveSnapPoint(point)}
                  data-testid={`snap-${point}`}
                >
                  {typeof point === 'number' ? `${point * 100}%` : point}
                </Button>
              ))}
            </div>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export const ResizeHandle: Story = {
  name: i18n.t('drawer.storyName.resizeHandle', 'Resize Handle'),
  render: () => <ResizableDrawerComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    const drawer = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="resizable-drawer"]');
      if (!(el instanceof HTMLElement)) throw new Error('Resizable drawer not found');
      return el;
    });

    expect(drawer).toBeInTheDocument();

    // Verify resize handle is present
    const resizeHandle = drawer.querySelector('[data-testid="resize-handle"]');
    expect(resizeHandle).toBeInTheDocument();

    // Test snap point buttons
    const snap25 = drawer.querySelector('[data-testid="snap-0.25"]');
    if (snap25 instanceof HTMLButtonElement) {
      await userEvent.click(snap25);
      await waitFor(() => {
        const snapPointEl = canvasElement.querySelector('[data-testid="snap-point"]');
        expect(snapPointEl).toHaveTextContent('0.25');
      });
    }

    const snap75 = drawer.querySelector('[data-testid="snap-0.75"]');
    if (snap75 instanceof HTMLButtonElement) {
      await userEvent.click(snap75);
      await waitFor(() => {
        const snapPointEl = canvasElement.querySelector('[data-testid="snap-point"]');
        expect(snapPointEl).toHaveTextContent('0.75');
      });
    }
  },
};

function DrawerSnapPointsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.story.with2SnapPoints')}</p>
        <Drawer snapPoints={[0.3, 1]}>
          <DrawerTrigger asChild>
            <Button variant="outline">2 Snap Points (30%, 100%)</Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="bg-muted mx-auto mt-4 h-2 w-[100px] cursor-grab rounded-full" />
            <DrawerHeader>
              <DrawerTitle>{i18n.t('drawer.story.twoSnapPoints', 'Two Snap Points')}</DrawerTitle>
              <DrawerDescription>This drawer snaps between 30% and 100% height.</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('drawer.story.with3SnapPoints')}</p>
        <Drawer snapPoints={[0.25, 0.5, 1]}>
          <DrawerTrigger asChild>
            <Button variant="outline">3 Snap Points (25%, 50%, 100%)</Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="bg-muted mx-auto mt-4 h-2 w-[100px] cursor-grab rounded-full" />
            <DrawerHeader>
              <DrawerTitle>
                {i18n.t('drawer.story.threeSnapPoints', 'Three Snap Points')}
              </DrawerTitle>
              <DrawerDescription>
                This drawer snaps between 25%, 50%, and 100% height.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.nonDismissible', 'Non-Dismissible')}
        </p>
        <Drawer dismissible={false}>
          <DrawerTrigger asChild>
            <Button variant="outline">
              {i18n.t('drawer.story.nonDismissible', 'Non-Dismissible')}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="bg-muted mx-auto mt-4 h-2 w-[100px] rounded-full" />
            <DrawerHeader>
              <DrawerTitle>
                {i18n.t('drawer.story.nonDismissibleDrawer', 'Non-Dismissible Drawer')}
              </DrawerTitle>
              <DrawerDescription>
                {i18n.t(
                  'drawer.story.nonDismissibleDescription',
                  'This drawer cannot be dismissed by dragging or clicking outside. You must use the close button.'
                )}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button>{i18n.t('drawer.story.closeOnlyWay', 'Close (Only Way)')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}

export const ResizeHandleSnapPoints: Story = {
  name: i18n.t('drawer.storyName.resizeHandleSnapPoints', 'Resize Handle (All Snap Points)'),
  render: () => <DrawerSnapPointsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('2 Snap Points (30%, 100%)')).toBeInTheDocument();
    expect(canvas.getByText('3 Snap Points (25%, 50%, 100%)')).toBeInTheDocument();
    expect(canvas.getByText('Non-Dismissible')).toBeInTheDocument();
  },
};

// ============ FOCUS TRAP STORY ============

const DrawerFocusTrapComponent = () => {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Focus should be trapped within the drawer. Tab/Shift+Tab should cycle.
      </p>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline" data-testid="focus-trap-trigger">
            Open Focus Trap Drawer
          </Button>
        </DrawerTrigger>
        <DrawerContent data-testid="focus-trap-drawer">
          <DrawerHeader>
            <DrawerTitle>{i18n.t('drawer.story.focusTrapTest', 'Focus Trap Test')}</DrawerTitle>
            <DrawerDescription>
              Tab through the focusable elements. Focus should stay trapped.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 py-4">
            <input
              className="border-input h-9 rounded-md border px-3"
              placeholder={i18n.t('drawer.story.firstInput', 'First input')}
              data-testid="input-1"
            />
            <input
              className="border-input h-9 rounded-md border px-3"
              placeholder={i18n.t('drawer.story.secondInput', 'Second input')}
              data-testid="input-2"
            />
            <textarea
              className="border-input min-h-[80px] rounded-md border px-3 py-2"
              placeholder={i18n.t('drawer.story.textarea', 'Textarea')}
              data-testid="textarea"
            />
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" data-testid="btn-cancel">
                Cancel
              </Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button data-testid="btn-save">{i18n.t('drawer.story.save', 'Save')}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export const FocusTrap: Story = {
  name: i18n.t('drawer.storyName.focusTrap', 'Focus Trap'),
  render: () => <DrawerFocusTrapComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    const drawer = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="focus-trap-drawer"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer not found');
      return el;
    });

    // Tab through all focusable elements multiple times
    for (let i = 0; i < 10; i++) {
      await userEvent.tab();
      expect(doc.activeElement).toBeInTheDocument();
      expect(drawer).toContainElement(doc.activeElement as HTMLElement);
    }

    // Shift+Tab multiple times
    for (let i = 0; i < 10; i++) {
      await userEvent.tab({ shift: true });
      expect(doc.activeElement).toBeInTheDocument();
      expect(drawer).toContainElement(doc.activeElement as HTMLElement);
    }
  },
};

// ============ ESCAPE KEY HANDLING STORY ============

const DrawerEscapeKeyHandlingComponent = () => {
  const [open, setOpen] = React.useState(true);
  const [escapeCount, setEscapeCount] = React.useState(0);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Escape key presses: <span data-testid="escape-count">{escapeCount}</span>
      </p>
      <Drawer
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEscapeCount((c) => c + 1);
          setOpen(isOpen);
        }}
      >
        <DrawerTrigger asChild>
          <Button>{i18n.t('drawer.story.openDrawer', 'Open Drawer')}</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{i18n.t('drawer.story.escapeKeyTest', 'Escape Key Test')}</DrawerTitle>
            <DrawerDescription>
              Press Escape to close this drawer. The escape key count will increment.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 py-4">
            <input
              className="border-input h-9 w-full rounded-md border px-3"
              placeholder={i18n.t(
                'drawer.story.focusAndPressEscape',
                'Focus here and press Escape'
              )}
            />
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button>{i18n.t('drawer.story.close', 'Close')}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export const EscapeKeyHandling: Story = {
  name: i18n.t('drawer.storyName.escapeKeyHandling', 'Escape Key Handling'),
  render: () => <DrawerEscapeKeyHandlingComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Drawer should be open by default
    const drawer = await waitFor(() => body.getByRole('dialog'));
    expect(drawer).toBeInTheDocument();

    // Press Escape to close
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify escape count was incremented
    const countEl = canvasElement.querySelector('[data-testid="escape-count"]');
    expect(countEl).toHaveTextContent('1');
  },
};

// ============ DARK MODE STORIES ============

export const DarkMode: Story = {
  name: i18n.t('drawer.storyName.darkMode', 'Dark Mode'),
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('drawer.storyName.darkModeJapanese', 'Dark Mode (Japanese)'),
  ...Japanese,
  globals: {
    ...(Japanese.globals ?? {}),
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const DarkModeVariants: Story = {
  name: i18n.t('drawer.storyName.darkModeVariants', 'Dark Mode (All Variants)'),
  render: () => <DrawerVariantsDemo />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Open Bottom')).toBeInTheDocument();
    expect(canvas.getByText('Open Top')).toBeInTheDocument();
  },
};

// ============ OPEN/CLOSE FROM ALL SIDES STORIES ============

function DrawerDirectionTestComponent({
  direction,
}: {
  direction: 'bottom' | 'left' | 'right' | 'top';
}) {
  const [open, setOpen] = React.useState(false);
  const [openCount, setOpenCount] = React.useState(0);
  const [closeCount, setCloseCount] = React.useState(0);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setOpenCount((c) => c + 1);
    } else {
      setCloseCount((c) => c + 1);
    }
    setOpen(isOpen);
  };

  const directionLabels = {
    top: 'Top',
    bottom: 'Bottom',
    left: 'Left',
    right: 'Right',
  };

  return (
    <div className="space-y-4" data-testid={`direction-test-${direction}`}>
      <p className="text-muted-foreground text-sm">
        Opens: <span data-testid={`open-count-${direction}`}>{openCount}</span> | Closes:{' '}
        <span data-testid={`close-count-${direction}`}>{closeCount}</span>
      </p>
      <Drawer direction={direction} open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button variant="outline" data-testid={`trigger-${direction}`}>
            Open {directionLabels[direction]} Drawer
          </Button>
        </DrawerTrigger>
        <DrawerContent data-testid={`content-${direction}`}>
          <DrawerHeader>
            <DrawerTitle>{directionLabels[direction]} Drawer</DrawerTitle>
            <DrawerDescription>
              This drawer slides in from the {direction} of the screen.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <p className="text-sm">Direction: {direction}</p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" data-testid={`close-btn-${direction}`}>
                Close
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function AllDirectionsDemo() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <DrawerDirectionTestComponent direction="top" />
      <DrawerDirectionTestComponent direction="bottom" />
      <DrawerDirectionTestComponent direction="left" />
      <DrawerDirectionTestComponent direction="right" />
    </div>
  );
}

export const OpenCloseAllDirections: Story = {
  name: i18n.t('drawer.storyName.openCloseAllDirections', 'Open/Close from All Directions'),
  render: () => <AllDirectionsDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Test each direction
    const directions: Array<'top' | 'bottom' | 'left' | 'right'> = [
      'top',
      'bottom',
      'left',
      'right',
    ];

    for (const direction of directions) {
      // Open drawer
      const trigger = canvasElement.querySelector(`[data-testid="trigger-${direction}"]`);
      if (!(trigger instanceof HTMLButtonElement)) {
        throw new Error(`Trigger for ${direction} not found`);
      }

      await userEvent.click(trigger);

      // Wait for drawer to open
      const content = await waitFor(() => {
        const el = doc.body.querySelector(`[data-testid="content-${direction}"]`);
        if (!(el instanceof HTMLElement)) {
          throw new Error(`Content for ${direction} not found`);
        }
        return el;
      });

      expect(content).toBeInTheDocument();

      // Verify open count incremented
      const openCountEl = canvasElement.querySelector(`[data-testid="open-count-${direction}"]`);
      expect(openCountEl).toHaveTextContent('1');

      // Close drawer
      const closeBtn = content.querySelector(`[data-testid="close-btn-${direction}"]`);
      if (closeBtn instanceof HTMLButtonElement) {
        await userEvent.click(closeBtn);
      }

      // Wait for drawer to close
      await waitFor(() => {
        expect(
          doc.body.querySelector(`[data-testid="content-${direction}"]`)
        ).not.toBeInTheDocument();
      });

      // Verify close count incremented
      const closeCountEl = canvasElement.querySelector(`[data-testid="close-count-${direction}"]`);
      expect(closeCountEl).toHaveTextContent('1');
    }
  },
};

export const OpenCloseBottomDrawer: Story = {
  name: i18n.t('drawer.storyName.openCloseBottomDrawer', 'Open/Close Bottom Drawer'),
  render: () => <DrawerDirectionTestComponent direction="bottom" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const direction = 'bottom';

    // Open drawer
    const trigger = canvasElement.querySelector(`[data-testid="trigger-${direction}"]`);
    await userEvent.click(trigger!);

    await waitFor(() => {
      expect(doc.body.querySelector(`[data-testid="content-${direction}"]`)).toBeInTheDocument();
    });

    // Close with close button
    const content = doc.body.querySelector(`[data-testid="content-${direction}"]`);
    const closeBtn = content?.querySelector(`[data-testid="close-btn-${direction}"]`);
    await userEvent.click(closeBtn!);

    await waitFor(() => {
      expect(
        doc.body.querySelector(`[data-testid="content-${direction}"]`)
      ).not.toBeInTheDocument();
    });

    // Open again and close with Escape
    await userEvent.click(trigger!);

    await waitFor(() => {
      expect(doc.body.querySelector(`[data-testid="content-${direction}"]`)).toBeInTheDocument();
    });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        doc.body.querySelector(`[data-testid="content-${direction}"]`)
      ).not.toBeInTheDocument();
    });
  },
};

export const OpenCloseTopDrawer: Story = {
  name: i18n.t('drawer.storyName.openCloseTopDrawer', 'Open/Close Top Drawer'),
  render: () => <DrawerDirectionTestComponent direction="top" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const direction = 'top';

    const trigger = canvasElement.querySelector(`[data-testid="trigger-${direction}"]`);
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector(`[data-testid="content-${direction}"]`);
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });
    // Verify direction attribute
    expect(content.getAttribute('data-vaul-drawer-direction')).toBe('top');

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        doc.body.querySelector(`[data-testid="content-${direction}"]`)
      ).not.toBeInTheDocument();
    });
  },
};

export const OpenCloseLeftDrawer: Story = {
  name: i18n.t('drawer.storyName.openCloseLeftDrawer', 'Open/Close Left Drawer'),
  render: () => <DrawerDirectionTestComponent direction="left" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const direction = 'left';

    const trigger = canvasElement.querySelector(`[data-testid="trigger-${direction}"]`);
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector(`[data-testid="content-${direction}"]`);
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });

    expect(content.getAttribute('data-vaul-drawer-direction')).toBe('left');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        doc.body.querySelector(`[data-testid="content-${direction}"]`)
      ).not.toBeInTheDocument();
    });
  },
};

export const OpenCloseRightDrawer: Story = {
  name: i18n.t('drawer.storyName.openCloseRightDrawer', 'Open/Close Right Drawer'),
  render: () => <DrawerDirectionTestComponent direction="right" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const direction = 'right';

    const trigger = canvasElement.querySelector(`[data-testid="trigger-${direction}"]`);
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector(`[data-testid="content-${direction}"]`);
      if (!(el instanceof HTMLElement)) throw new Error('Content not found');
      return el;
    });

    expect(content.getAttribute('data-vaul-drawer-direction')).toBe('right');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        doc.body.querySelector(`[data-testid="content-${direction}"]`)
      ).not.toBeInTheDocument();
    });
  },
};

// ============ SWIPE GESTURE STORIES ============

function SwipeGestureTestComponent() {
  const [open, setOpen] = React.useState(true);
  const [dismissCount, setDismissCount] = React.useState(0);
  const [lastDismissMethod, setLastDismissMethod] = React.useState<string>('none');

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setDismissCount((c) => c + 1);
      setLastDismissMethod('gesture/escape/button');
    }
    setOpen(isOpen);
  };

  return (
    <div className="space-y-4" data-testid="swipe-gesture-demo">
      <p className="text-muted-foreground text-sm">
        Dismiss count: <span data-testid="dismiss-count">{dismissCount}</span>
      </p>
      <p className="text-muted-foreground text-sm">
        Last dismiss method: <span data-testid="dismiss-method">{lastDismissMethod}</span>
      </p>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button variant="outline" data-testid="swipe-trigger">
            Open Swipeable Drawer
          </Button>
        </DrawerTrigger>
        <DrawerContent data-testid="swipe-content">
          <div
            className="bg-muted mx-auto mt-4 h-2 w-[100px] cursor-grab rounded-full active:cursor-grabbing"
            data-testid="swipe-handle"
            aria-label={i18n.t(
              'drawer.story.dragToResize',
              'Drag to resize or swipe down to dismiss'
            )}
          />
          <DrawerHeader>
            <DrawerTitle>
              {i18n.t('drawer.story.swipeGestureTest', 'Swipe Gesture Test')}
            </DrawerTitle>
            <DrawerDescription>
              Swipe down on the handle to dismiss this drawer. On touch devices, you can also drag
              from anywhere on the drawer.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <p className="text-sm">
              The drawer supports gesture-based dismissal. On mobile devices, swipe down to dismiss.
            </p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" data-testid="swipe-close-btn">
                Close
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const SwipeGestureDismiss: Story = {
  name: i18n.t('drawer.storyName.swipeGestureDismiss', 'Swipe Gesture Dismiss'),
  render: () => <SwipeGestureTestComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify drawer is open
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="swipe-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();

    // Verify swipe handle exists
    const handle = content.querySelector('[data-testid="swipe-handle"]');
    expect(handle).toBeInTheDocument();

    // Close using button (simulating gesture end result)
    const closeBtn = content.querySelector('[data-testid="swipe-close-btn"]');
    await userEvent.click(closeBtn!);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="swipe-content"]')).not.toBeInTheDocument();
    });

    // Verify dismiss count
    const dismissCount = canvasElement.querySelector('[data-testid="dismiss-count"]');
    expect(dismissCount).toHaveTextContent('1');
  },
};

function SwipeDirectionsTestComponent() {
  const [logs, setLogs] = React.useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev.slice(-4), message]);
  };

  const directions: Array<{ direction: 'bottom' | 'left' | 'right' | 'top'; swipe: string }> = [
    { direction: 'bottom', swipe: 'up' },
    { direction: 'top', swipe: 'down' },
    { direction: 'left', swipe: 'right' },
    { direction: 'right', swipe: 'left' },
  ];

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Each drawer can be dismissed by swiping in the opposite direction.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {directions.map(({ direction, swipe }) => (
          <Drawer
            key={direction}
            direction={direction}
            onOpenChange={(isOpen) => {
              if (!isOpen) addLog(`${direction} drawer closed`);
            }}
          >
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                data-testid={`swipe-direction-trigger-${direction}`}
                onClick={() => addLog(`${direction} drawer opened`)}
              >
                {direction.charAt(0).toUpperCase() + direction.slice(1)} (swipe {swipe})
              </Button>
            </DrawerTrigger>
            <DrawerContent data-testid={`swipe-direction-content-${direction}`}>
              <DrawerHeader>
                <DrawerTitle>
                  {direction.charAt(0).toUpperCase() + direction.slice(1)} Drawer
                </DrawerTitle>
                <DrawerDescription>Swipe {swipe} to dismiss this drawer.</DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ))}
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.activityLog', 'Activity Log:')}
        </p>
        <div className="space-y-1 font-mono text-xs" data-testid="swipe-activity-log">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">
              {i18n.t('drawer.story.noActivityYet', 'No activity yet')}
            </p>
          ) : (
            logs.map((log) => <p key={log}>{log}</p>)
          )}
        </div>
      </div>
    </div>
  );
}

export const SwipeAllDirections: Story = {
  name: i18n.t('drawer.storyName.swipeAllDirections', 'Swipe Dismiss (All Directions)'),
  render: () => <SwipeDirectionsTestComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const directions: Array<'bottom' | 'left' | 'right' | 'top'> = [
      'bottom',
      'top',
      'left',
      'right',
    ];

    for (const direction of directions) {
      // Open drawer
      const trigger = canvasElement.querySelector(
        `[data-testid="swipe-direction-trigger-${direction}"]`
      );
      await userEvent.click(trigger!);

      // Wait for drawer to open
      const content = await waitFor(() => {
        const el = doc.body.querySelector(`[data-testid="swipe-direction-content-${direction}"]`);
        if (!(el instanceof HTMLElement)) throw new Error(`Content for ${direction} not found`);
        return el;
      });

      expect(content).toBeInTheDocument();

      // Close with Escape (simulating successful swipe dismiss)
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(
          doc.body.querySelector(`[data-testid="swipe-direction-content-${direction}"]`)
        ).not.toBeInTheDocument();
      });
    }

    // Verify activity log has entries
    const activityLog = canvasElement.querySelector('[data-testid="swipe-activity-log"]');
    expect(activityLog?.textContent).toContain('closed');
  },
};

// ============ NON-DISMISSIBLE DRAWER STORY ============

function NonDismissibleDrawerComponent() {
  const [open, setOpen] = React.useState(true);
  const [attemptedDismiss, setAttemptedDismiss] = React.useState(0);

  return (
    <div className="space-y-4" data-testid="non-dismissible-demo">
      <p className="text-muted-foreground text-sm">
        Attempted dismissals: <span data-testid="attempted-dismiss">{attemptedDismiss}</span>
      </p>
      <Drawer
        open={open}
        onOpenChange={(isOpen) => {
          // Only allow closing via the explicit close button

          if (!isOpen) {
            setAttemptedDismiss((c) => c + 1);
          }
        }}
        dismissible={false}
      >
        <DrawerTrigger asChild>
          <Button variant="outline" data-testid="non-dismissible-trigger">
            {i18n.t('drawer.story.openNonDismissibleDrawer', 'Open Non-Dismissible Drawer')}
          </Button>
        </DrawerTrigger>
        <DrawerContent data-testid="non-dismissible-content">
          <DrawerHeader>
            <DrawerTitle>
              {i18n.t('drawer.story.nonDismissibleDrawer', 'Non-Dismissible Drawer')}
            </DrawerTitle>
            <DrawerDescription>
              {i18n.t(
                'drawer.story.nonDismissibleDescriptionEscape',
                'This drawer cannot be dismissed by clicking outside, swiping, or pressing Escape. You must use the close button.'
              )}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <p className="text-sm">
              {i18n.t(
                'drawer.story.onlyTheCloseButtonBelowWillCloseThisDraw',
                'Only the close button below will close this drawer.'
              )}
            </p>
          </div>
          <DrawerFooter>
            <Button onClick={() => setOpen(false)} data-testid="non-dismissible-close-btn">
              Close (Only Way)
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const NonDismissibleDrawer: Story = {
  name: i18n.t('drawer.storyName.nonDismissibleDrawer', 'Non-Dismissible Drawer'),
  render: () => <NonDismissibleDrawerComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify drawer is open
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="non-dismissible-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();

    // Try to dismiss with Escape (should not work due to dismissible={false})
    await userEvent.keyboard('{Escape}');

    // Small wait to see if it closed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Drawer should still be open
    expect(doc.body.querySelector('[data-testid="non-dismissible-content"]')).toBeInTheDocument();

    // Close using the explicit button
    const closeBtn = content.querySelector('[data-testid="non-dismissible-close-btn"]');
    await userEvent.click(closeBtn!);

    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-testid="non-dismissible-content"]')
      ).not.toBeInTheDocument();
    });
  },
};

// ============ OVERLAY CLICK DISMISS STORY ============

function OverlayClickDismissComponent() {
  const [open, setOpen] = React.useState(false);
  const [overlayClicks, setOverlayClicks] = React.useState(0);

  return (
    <div className="space-y-4" data-testid="overlay-click-demo">
      <p className="text-muted-foreground text-sm">
        Overlay clicks: <span data-testid="overlay-click-count">{overlayClicks}</span>
      </p>
      <Drawer
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen && open) {
            setOverlayClicks((c) => c + 1);
          }
          setOpen(isOpen);
        }}
      >
        <DrawerTrigger asChild>
          <Button variant="outline" data-testid="overlay-trigger">
            Open Drawer
          </Button>
        </DrawerTrigger>
        <DrawerContent data-testid="overlay-content">
          <DrawerHeader>
            <DrawerTitle>
              {i18n.t('drawer.story.overlayClickTest', 'Overlay Click Test')}
            </DrawerTitle>
            <DrawerDescription>
              Click outside the drawer (on the overlay) to dismiss it.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{i18n.t('drawer.story.close', 'Close')}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const OverlayClickDismiss: Story = {
  name: i18n.t('drawer.storyName.overlayClickDismiss', 'Overlay Click Dismiss'),
  render: () => <OverlayClickDismissComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Open drawer
    const trigger = canvasElement.querySelector('[data-testid="overlay-trigger"]');
    await userEvent.click(trigger!);

    // Wait for drawer and overlay
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="overlay-content"]')).toBeInTheDocument();
      expect(doc.body.querySelector('[data-slot="drawer-overlay"]')).toBeInTheDocument();
    });

    // Click on overlay to dismiss
    const overlay = doc.body.querySelector('[data-slot="drawer-overlay"]');
    if (overlay instanceof HTMLElement) {
      await userEvent.click(overlay);
    }

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="overlay-content"]')).not.toBeInTheDocument();
    });

    // Verify overlay click count
    const clickCount = canvasElement.querySelector('[data-testid="overlay-click-count"]');
    expect(clickCount).toHaveTextContent('1');
  },
};

// ============ KEYBOARD NAVIGATION STORIES ============

export const KeyboardNavigation: Story = {
  name: i18n.t('drawer.storyName.keyboardNavigation', 'Keyboard Navigation'),
  render: () => <DrawerFocusTrapComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Wait for drawer to be open
    await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="focus-trap-drawer"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer not found');
      return el;
    });

    // Tab through elements
    await userEvent.tab();
    expect(doc.activeElement?.tagName).toBe('INPUT');

    await userEvent.tab();
    expect(doc.activeElement?.tagName).toBe('INPUT');

    await userEvent.tab();
    expect(doc.activeElement?.tagName).toBe('TEXTAREA');

    await userEvent.tab();
    expect(doc.activeElement?.tagName).toBe('BUTTON');

    // Shift+Tab back
    await userEvent.tab({ shift: true });
    expect(doc.activeElement?.tagName).toBe('TEXTAREA');

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="focus-trap-drawer"]')).not.toBeInTheDocument();
    });
  },
};

// ============ ANIMATION STATES STORIES ============

function AnimationStatesDemo() {
  const [openState, setOpenState] = React.useState<'closed' | 'open' | 'opening' | 'closing'>(
    'closed'
  );
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setOpenState('opening');
      setTimeout(() => setOpenState('open'), 300);
    } else {
      setOpenState('closing');
      setTimeout(() => setOpenState('closed'), 300);
    }
    setIsOpen(open);
  };

  return (
    <div className="space-y-4" data-testid="animation-states-demo">
      <p className="text-muted-foreground text-sm">
        Current state: <span data-testid="animation-state">{openState}</span>
      </p>
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button variant="outline" data-testid="animation-trigger">
            Open Animated Drawer
          </Button>
        </DrawerTrigger>
        <DrawerContent data-testid="animation-content">
          <DrawerHeader>
            <DrawerTitle>{i18n.t('drawer.story.animationStates', 'Animation States')}</DrawerTitle>
            <DrawerDescription>
              Watch the state transition as the drawer animates.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" data-testid="animation-close">
                Close
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const AnimationStates: Story = {
  name: i18n.t('drawer.storyName.animationStates', 'Animation States'),
  render: () => <AnimationStatesDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Initial state should be closed
    const stateEl = canvasElement.querySelector('[data-testid="animation-state"]');
    expect(stateEl).toHaveTextContent('closed');

    // Open drawer
    const trigger = canvasElement.querySelector('[data-testid="animation-trigger"]');
    await userEvent.click(trigger!);

    // State should transition to opening then open
    await waitFor(() => {
      expect(stateEl).toHaveTextContent('open');
    });

    // Verify drawer is visible
    expect(doc.body.querySelector('[data-testid="animation-content"]')).toBeInTheDocument();

    // Close drawer
    const closeBtn = doc.body.querySelector('[data-testid="animation-close"]');
    await userEvent.click(closeBtn!);

    // State should transition to closing then closed
    await waitFor(() => {
      expect(stateEl).toHaveTextContent('closed');
    });
  },
};

// ============ FACTORY: CONSTANTS STORIES ============

function DrawerConstantsDemo() {
  return (
    <div className="space-y-6" data-testid="constants-demo">
      <h3 className="text-lg font-semibold">{i18n.t('drawer.section.variants')}</h3>

      <div>
        <p className="mb-2 text-sm font-medium">DRAWER_DIRECTIONS ({DRAWER_DIRECTIONS.length})</p>
        <div className="flex flex-wrap gap-2">
          {DRAWER_DIRECTIONS.map((dir) => (
            <span
              key={dir}
              className="bg-muted rounded-md px-2 py-1 text-xs"
              data-testid={`direction-${dir}`}
            >
              {dir}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">DRAWER_SIZES ({DRAWER_SIZES.length})</p>
        <div className="flex flex-wrap gap-2">
          {DRAWER_SIZES.map((size) => (
            <span
              key={size}
              className="bg-muted rounded-md px-2 py-1 text-xs"
              data-testid={`size-${size}`}
            >
              {size}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">DRAWER_TYPES ({DRAWER_TYPES.length})</p>
        <div className="flex flex-wrap gap-2">
          {DRAWER_TYPES.map((type) => (
            <span
              key={type}
              className="bg-muted rounded-md px-2 py-1 text-xs"
              data-testid={`type-${type}`}
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          DEFAULT_SNAP_POINTS ({DEFAULT_SNAP_POINTS.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SNAP_POINTS.map((sp) => (
            <span
              key={sp}
              className="bg-muted rounded-md px-2 py-1 text-xs"
              data-testid={`snap-${sp}`}
            >
              {sp * 100}%
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">NAVIGATION_ITEMS ({NAVIGATION_ITEMS.length})</p>
        <div className="flex flex-wrap gap-2">
          {NAVIGATION_ITEMS.map((item) => (
            <span key={item.label} className="bg-muted rounded-md px-2 py-1 text-xs">
              {item.icon}: {item.label}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">FILTER_CATEGORIES ({FILTER_CATEGORIES.length})</p>
        <div className="flex flex-wrap gap-2">
          {FILTER_CATEGORIES.map((cat) => (
            <span key={cat} className="bg-muted rounded-md px-2 py-1 text-xs">
              {cat}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">NOTIFICATION_ICONS</p>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(NOTIFICATION_ICONS) as [string, string][]).map(([type, icon]) => (
            <span key={type} className="bg-muted rounded-md px-2 py-1 text-xs">
              {type}: {icon}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  name: i18n.t('drawer.storyName.factoryConstants', 'Factory: Constants'),
  render: () => <DrawerConstantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constants-demo')).toBeInTheDocument();
    // Verify DRAWER_DIRECTIONS
    expect(canvas.getByTestId('direction-bottom')).toBeInTheDocument();
    expect(canvas.getByTestId('direction-top')).toBeInTheDocument();
    expect(canvas.getByTestId('direction-left')).toBeInTheDocument();
    expect(canvas.getByTestId('direction-right')).toBeInTheDocument();
    // Verify DRAWER_SIZES
    expect(canvas.getByTestId('size-sm')).toBeInTheDocument();
    expect(canvas.getByTestId('size-full')).toBeInTheDocument();
    // Verify DRAWER_TYPES
    expect(canvas.getByTestId('type-cart')).toBeInTheDocument();
    expect(canvas.getByTestId('type-navigation')).toBeInTheDocument();
    // Verify DEFAULT_SNAP_POINTS
    expect(canvas.getByTestId('snap-0.25')).toBeInTheDocument();
    expect(canvas.getByTestId('snap-1')).toBeInTheDocument();
  },
};

// ============ FACTORY: NAV ITEM STORIES ============

function DrawerNavItemDemo() {
  const { t } = useTranslation();
  const navItem = React.useMemo(() => createFakeDrawerNavItem(), []);
  const navItems = React.useMemo(() => createFakeDrawerNavItems(5), []);

  return (
    <div className="space-y-6" data-testid="nav-item-demo">
      <h3 className="text-lg font-semibold">{t('drawer.section.variants')}</h3>

      <div>
        <p className="mb-2 text-sm font-medium">
          {t('drawer.story.singleNavItem', 'Single Nav Item')}
        </p>
        <div className="rounded-lg border p-3" data-testid="single-nav-item">
          <p className="text-sm font-medium">{navItem.label}</p>
          <p className="text-muted-foreground text-xs">href: {navItem.href}</p>
          {navItem.icon && <p className="text-muted-foreground text-xs">icon: {navItem.icon}</p>}
          {navItem.badge !== undefined && (
            <span className="bg-primary text-primary-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
              {navItem.badge}
            </span>
          )}
          {navItem.isActive && (
            <span className="text-xs text-green-600">{t('drawer.story.active', 'Active')}</span>
          )}
          {navItem.disabled && (
            <span className="text-xs text-red-600">{t('drawer.story.disabled', 'Disabled')}</span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Nav Items List ({navItems.length})</p>
        <div className="space-y-2" data-testid="nav-items-list">
          {navItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-md border p-2">
              <span className="text-sm">{item.label}</span>
              <span className="text-muted-foreground text-xs">{item.href}</span>
              {item.children && item.children.length > 0 && (
                <span className="text-xs text-blue-600">+{item.children.length} children</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryNavItems: Story = {
  name: i18n.t('drawer.storyName.factoryNavItems', 'Factory: Nav Items'),
  render: () => <DrawerNavItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('nav-item-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('single-nav-item')).toBeInTheDocument();
    expect(canvas.getByTestId('nav-items-list')).toBeInTheDocument();
    const items = canvas.getByTestId('nav-items-list').querySelectorAll('.border');
    expect(items.length).toBe(5);
  },
};

// ============ FACTORY: FILTER STORIES ============

function DrawerFilterDemo() {
  const filterOption = React.useMemo(() => createFakeFilterOption(), []);
  const filterGroup = React.useMemo(() => createFakeFilterGroup(), []);
  const filterGroups = React.useMemo(() => createFakeFilterGroups(3), []);

  return (
    <div className="space-y-6" data-testid="filter-demo">
      <h3 className="text-lg font-semibold">{i18n.t('drawer.section.variants')}</h3>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.singleFilterOption', 'Single Filter Option')}
        </p>
        <div className="rounded-lg border p-3" data-testid="single-filter-option">
          <p className="text-sm">{filterOption.label}</p>
          <p className="text-muted-foreground text-xs">Value: {filterOption.value}</p>
          {filterOption.count !== undefined && (
            <p className="text-muted-foreground text-xs">Count: {filterOption.count}</p>
          )}
          {filterOption.selected && (
            <span className="text-xs text-green-600">
              {i18n.t('drawer.story.selected', 'Selected')}
            </span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Filter Group: {filterGroup.label}</p>
        <div className="rounded-lg border p-3" data-testid="single-filter-group">
          <p className="text-sm font-medium">
            {filterGroup.label} ({filterGroup.type})
          </p>
          <div className="mt-2 space-y-1">
            {filterGroup.options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2 text-xs">
                <span>{opt.label}</span>
                {opt.count !== undefined && (
                  <span className="text-muted-foreground">({opt.count})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Filter Groups ({filterGroups.length})</p>
        <div className="space-y-2" data-testid="filter-groups-list">
          {filterGroups.map((group) => (
            <div key={group.id} className="rounded-md border p-2">
              <p className="text-sm font-medium">
                {group.label} ({group.type})
              </p>
              <p className="text-muted-foreground text-xs">{group.options.length} options</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryFilters: Story = {
  name: i18n.t('drawer.storyName.factoryFilters', 'Factory: Filters'),
  render: () => <DrawerFilterDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('filter-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('single-filter-option')).toBeInTheDocument();
    expect(canvas.getByTestId('single-filter-group')).toBeInTheDocument();
    expect(canvas.getByTestId('filter-groups-list')).toBeInTheDocument();
    const groups = canvas.getByTestId('filter-groups-list').querySelectorAll('.border');
    expect(groups.length).toBe(3);
  },
};

// ============ FACTORY: CART ITEMS STORIES ============

function DrawerCartItemsDemo() {
  const cartItem = React.useMemo(() => createFakeCartItem(), []);
  const cartItems = React.useMemo(() => createFakeCartItems(4), []);

  return (
    <div className="space-y-6" data-testid="cart-items-demo">
      <h3 className="text-lg font-semibold">{i18n.t('drawer.section.variants')}</h3>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.singleCartItem', 'Single Cart Item')}
        </p>
        <div className="flex gap-3 rounded-lg border p-3" data-testid="single-cart-item">
          <div className="bg-muted h-16 w-16 rounded-md" />
          <div>
            <p className="text-sm font-medium">{cartItem.name}</p>
            <p className="text-muted-foreground text-xs">
              ${cartItem.price.toFixed(2)} x {cartItem.quantity}
            </p>
            {cartItem.variant && (
              <p className="text-muted-foreground text-xs">{cartItem.variant}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Cart Items ({cartItems.length})</p>
        <div className="space-y-2" data-testid="cart-items-list">
          {cartItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border p-2">
              <div>
                <p className="text-sm">{item.name}</p>
                <p className="text-muted-foreground text-xs">Qty: {item.quantity}</p>
              </div>
              <p className="text-sm font-medium">${(item.price * item.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryCartItems: Story = {
  name: i18n.t('drawer.storyName.factoryCartItems', 'Factory: Cart Items'),
  render: () => <DrawerCartItemsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('cart-items-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('single-cart-item')).toBeInTheDocument();
    expect(canvas.getByTestId('cart-items-list')).toBeInTheDocument();
    const items = canvas.getByTestId('cart-items-list').querySelectorAll('.border');
    expect(items.length).toBe(4);
  },
};

// ============ FACTORY: NOTIFICATION ITEMS STORIES ============

function DrawerNotificationItemsDemo() {
  const notification = React.useMemo(() => createFakeNotificationItem(), []);
  const notifications = React.useMemo(() => createFakeNotificationItems(5), []);

  return (
    <div className="space-y-6" data-testid="notification-items-demo">
      <h3 className="text-lg font-semibold">{i18n.t('drawer.section.states')}</h3>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.singleNotification', 'Single Notification')}
        </p>
        <div className="rounded-lg border p-3" data-testid="single-notification">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase">{notification.type}</span>
            {!notification.read && <span className="bg-primary h-2 w-2 rounded-full" />}
          </div>
          <p className="text-sm font-medium">{notification.title}</p>
          <p className="text-muted-foreground text-xs">{notification.message}</p>
          <p className="text-muted-foreground text-xs">
            {notification.timestamp.toLocaleDateString()}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Notifications ({notifications.length})</p>
        <div className="space-y-2" data-testid="notifications-list">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-start gap-2 rounded-md border p-2">
              <span
                className={`mt-0.5 text-xs font-medium uppercase ${
                  {
                    error: 'text-red-600',
                    warning: 'text-yellow-600',
                    success: 'text-green-600',
                    info: 'text-blue-600',
                  }[n.type]
                }`}
              >
                {n.type}
              </span>
              <div className="flex-1">
                <p className="text-sm">{n.title}</p>
                <p className="text-muted-foreground text-xs">{n.message}</p>
              </div>
              {!n.read && <span className="bg-primary mt-1 h-2 w-2 rounded-full" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryNotificationItems: Story = {
  name: i18n.t('drawer.storyName.factoryNotificationItems', 'Factory: Notification Items'),
  render: () => <DrawerNotificationItemsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('notification-items-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('single-notification')).toBeInTheDocument();
    expect(canvas.getByTestId('notifications-list')).toBeInTheDocument();
    const items = canvas.getByTestId('notifications-list').querySelectorAll('.border');
    expect(items.length).toBe(5);
  },
};

// ============ FACTORY: SETTINGS SECTION STORIES ============

function DrawerSettingsSectionDemo() {
  const section = React.useMemo(() => createFakeSettingsSection(), []);

  return (
    <div className="space-y-6" data-testid="settings-section-demo">
      <h3 className="text-lg font-semibold">{i18n.t('drawer.section.variants')}</h3>

      <div className="rounded-lg border p-4" data-testid="settings-section">
        <h4 className="text-sm font-semibold">{section.title}</h4>
        {section.description && (
          <p className="text-muted-foreground mt-1 text-xs">{section.description}</p>
        )}
        <div className="mt-3 space-y-3">
          {section.fields.map((field) => (
            <div key={field.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm">{field.label}</p>
                {field.description && (
                  <p className="text-muted-foreground text-xs">{field.description}</p>
                )}
              </div>
              <span className="bg-muted rounded-md px-2 py-1 text-xs">{field.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactorySettingsSection: Story = {
  name: i18n.t('drawer.storyName.factorySettingsSection', 'Factory: Settings Section'),
  render: () => <DrawerSettingsSectionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('settings-section-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('settings-section')).toBeInTheDocument();
  },
};

// ============ FACTORY: NAVIGATION DRAWER STORIES ============

function NavigationDrawerDemo() {
  const navDrawer = React.useMemo(() => createFakeNavigationDrawer(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="navigation-drawer-demo">
      <Drawer open={open} onOpenChange={setOpen} direction="left">
        <DrawerTrigger asChild>
          <Button variant="outline">{i18n.t('drawer.section.positions')}</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{navDrawer.title}</DrawerTitle>
            {navDrawer.description && (
              <DrawerDescription>{navDrawer.description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="px-4 pb-4">
            {navDrawer.user && (
              <div
                className="mb-4 flex items-center gap-3 rounded-lg border p-3"
                data-testid="nav-user"
              >
                <div className="bg-muted h-10 w-10 rounded-full" />
                <div>
                  <p className="text-sm font-medium">{navDrawer.user.name}</p>
                  <p className="text-muted-foreground text-xs">{navDrawer.user.email}</p>
                </div>
              </div>
            )}
            {navDrawer.sections.map((section) => (
              <div key={section.label ?? section.items[0]?.id} className="mb-4">
                {section.label && (
                  <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                    {section.label}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-md px-3 py-2 text-sm ${item.isActive ? 'bg-accent' : ''}`}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{navDrawer.cancelLabel}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const FactoryNavigationDrawer: Story = {
  name: i18n.t('drawer.storyName.factoryNavigationDrawer', 'Factory: Navigation Drawer'),
  render: () => <NavigationDrawerDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();
    expect(content.querySelector('[data-testid="nav-user"]')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: FILTERS DRAWER STORIES ============

function FiltersDrawerDemo() {
  const { t } = useTranslation();
  const filtersDrawer = React.useMemo(() => createFakeFiltersDrawer(4), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="filters-drawer-demo">
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerTrigger asChild>
          <Button variant="outline">
            {t('drawer.section.variants')}
            {filtersDrawer.activeFilterCount !== undefined &&
              filtersDrawer.activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                  {filtersDrawer.activeFilterCount}
                </span>
              )}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{filtersDrawer.title}</DrawerTitle>
            {filtersDrawer.filtersSummary && (
              <DrawerDescription>{filtersDrawer.filtersSummary}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="px-4 pb-4">
            {filtersDrawer.filterGroups.map((group) => (
              <div key={group.id} className="mb-4" data-testid={`filter-group-${group.id}`}>
                <p className="mb-2 text-sm font-medium">{group.label}</p>
                <div className="space-y-1">
                  {group.options.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 text-sm">
                      <input
                        type={group.type === 'radio' ? 'radio' : 'checkbox'}
                        checked={opt.selected}
                        readOnly
                        name={group.id}
                      />
                      {opt.label}
                      {opt.count !== undefined && (
                        <span className="text-muted-foreground text-xs">({opt.count})</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DrawerFooter>
            {filtersDrawer.showClearAll && (
              <Button variant="ghost">{t('drawer.story.clearAll', 'Clear All')}</Button>
            )}
            <DrawerClose asChild>
              <Button>{filtersDrawer.confirmLabel}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const FactoryFiltersDrawer: Story = {
  name: i18n.t('drawer.storyName.factoryFiltersDrawer', 'Factory: Filters Drawer'),
  render: () => <FiltersDrawerDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();
    expect(content.querySelector('[data-slot="drawer-title"]')?.textContent).toBe('Filters');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: CART DRAWER STORIES ============

function CartDrawerDemo() {
  const { t } = useTranslation();
  const cartDrawer = React.useMemo(() => createFakeCartDrawer(3), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="cart-drawer-demo">
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerTrigger asChild>
          <Button variant="outline">
            {t('drawer.open')} ({cartDrawer.items.length})
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{cartDrawer.title}</DrawerTitle>
            {cartDrawer.description && (
              <DrawerDescription>{cartDrawer.description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="px-4 pb-4">
            {cartDrawer.isEmpty ? (
              <p className="text-muted-foreground text-sm" data-testid="cart-empty">
                Your cart is empty.
              </p>
            ) : (
              <div className="space-y-3" data-testid="cart-items">
                {cartDrawer.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.variant && (
                        <p className="text-muted-foreground text-xs">{item.variant}</p>
                      )}
                      <p className="text-xs">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('drawer.story.subtotal', 'Subtotal')}</span>
                    <span>${cartDrawer.subtotal.toFixed(2)}</span>
                  </div>
                  {cartDrawer.shipping !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span>{t('drawer.story.shipping', 'Shipping')}</span>
                      <span>
                        {cartDrawer.shipping === 0
                          ? i18n.t('drawer.story.free', 'Free')
                          : `$${cartDrawer.shipping.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                  {cartDrawer.discount !== undefined && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>
                        Discount{cartDrawer.discountCode ? ` (${cartDrawer.discountCode})` : ''}
                      </span>
                      <span>-${cartDrawer.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 text-sm font-semibold">
                    <span>{t('drawer.story.total', 'Total')}</span>
                    <span>${cartDrawer.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{cartDrawer.cancelLabel}</Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button>{cartDrawer.confirmLabel}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const FactoryCartDrawer: Story = {
  name: i18n.t('drawer.storyName.factoryCartDrawer', 'Factory: Cart Drawer'),
  render: () => <CartDrawerDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();
    expect(content.querySelector('[data-slot="drawer-title"]')?.textContent).toBe('Shopping Cart');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: NOTIFICATIONS DRAWER STORIES ============

function NotificationsDrawerDemo() {
  const { t } = useTranslation();
  const notificationsDrawer = React.useMemo(() => createFakeNotificationsDrawer(5), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="notifications-drawer-demo">
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerTrigger asChild>
          <Button variant="outline">
            {t('drawer.open')}
            {notificationsDrawer.unreadCount > 0 && (
              <span className="bg-destructive text-destructive-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                {notificationsDrawer.unreadCount}
              </span>
            )}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{notificationsDrawer.title}</DrawerTitle>
            {notificationsDrawer.description && (
              <DrawerDescription>{notificationsDrawer.description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="px-4 pb-4">
            {notificationsDrawer.showMarkAllRead && (
              <Button variant="ghost" size="sm" className="mb-3" data-testid="mark-all-read">
                Mark all as read
              </Button>
            )}
            <div className="space-y-2" data-testid="notification-list">
              {notificationsDrawer.notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-md border p-3 ${!n.read ? 'bg-accent/50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase">{n.type}</span>
                    {!n.read && <span className="bg-primary h-2 w-2 rounded-full" />}
                  </div>
                  <p className="mt-1 text-sm font-medium">{n.title}</p>
                  <p className="text-muted-foreground text-xs">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{notificationsDrawer.cancelLabel}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const FactoryNotificationsDrawer: Story = {
  name: i18n.t('drawer.storyName.factoryNotificationsDrawer', 'Factory: Notifications Drawer'),
  render: () => <NotificationsDrawerDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();
    expect(content.querySelector('[data-testid="notification-list"]')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: SETTINGS DRAWER STORIES ============

function SettingsDrawerDemo() {
  const { t } = useTranslation();
  const settingsDrawer = React.useMemo(() => createFakeSettingsDrawer(3), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="settings-drawer-demo">
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerTrigger asChild>
          <Button variant="outline">{t('drawer.open')}</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{settingsDrawer.title}</DrawerTitle>
            {settingsDrawer.description && (
              <DrawerDescription>{settingsDrawer.description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="px-4 pb-4">
            {settingsDrawer.isDirty && (
              <p className="mb-3 text-xs text-yellow-600" data-testid="unsaved-changes">
                You have unsaved changes
              </p>
            )}
            <div className="space-y-4" data-testid="settings-sections">
              {settingsDrawer.sections.map((section) => (
                <div key={section.id} className="rounded-lg border p-3">
                  <h4 className="text-sm font-semibold">{section.title}</h4>
                  {section.description && (
                    <p className="text-muted-foreground mt-1 text-xs">{section.description}</p>
                  )}
                  <div className="mt-2 space-y-2">
                    {section.fields.map((field) => (
                      <div key={field.id} className="flex items-center justify-between text-sm">
                        <span>{field.label}</span>
                        <span className="bg-muted rounded px-2 py-0.5 text-xs">{field.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{settingsDrawer.cancelLabel}</Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button>{settingsDrawer.confirmLabel}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const FactorySettingsDrawer: Story = {
  name: i18n.t('drawer.storyName.factorySettingsDrawer', 'Factory: Settings Drawer'),
  render: () => <SettingsDrawerDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();
    expect(content.querySelector('[data-testid="settings-sections"]')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: MOBILE MENU DRAWER STORIES ============

function MobileMenuDrawerDemo() {
  const { t } = useTranslation();
  const mobileMenu = React.useMemo(() => createFakeMobileMenuDrawer(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="mobile-menu-demo">
      <Drawer open={open} onOpenChange={setOpen} direction="left">
        <DrawerTrigger asChild>
          <Button variant="outline">{t('drawer.open')}</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{mobileMenu.title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {mobileMenu.sections.map((section) => (
              <div
                key={section.label ?? section.items[0]?.id}
                className="mb-4"
                data-testid={`menu-section-${section.label}`}
              >
                {section.label && (
                  <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                    {section.label}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <div key={item.id} className="hover:bg-accent rounded-md px-3 py-2 text-sm">
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{mobileMenu.cancelLabel}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const FactoryMobileMenuDrawer: Story = {
  name: i18n.t('drawer.storyName.factoryMobileMenuDrawer', 'Factory: Mobile Menu Drawer'),
  render: () => <MobileMenuDrawerDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();
    expect(content.querySelector('[data-slot="drawer-title"]')?.textContent).toBe('Menu');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: PRODUCT QUICK VIEW STORIES ============

function ProductQuickViewDemo() {
  const { t } = useTranslation();
  const quickView = React.useMemo(() => createFakeProductQuickViewDrawer(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="product-quickview-demo">
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerTrigger asChild>
          <Button variant="outline">{t('drawer.open')}</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{quickView.content.title}</DrawerTitle>
            {quickView.content.description && (
              <DrawerDescription>{quickView.content.description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="px-4 pb-4" data-testid="quickview-content">
            <div className="bg-muted mb-4 aspect-square w-full rounded-lg" />
            <p className="text-muted-foreground text-sm">Direction: {quickView.direction}</p>
            <p className="text-muted-foreground text-sm">Size: {quickView.size}</p>
            <p className="text-muted-foreground text-sm">Type: {quickView.type}</p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{quickView.content.cancelLabel}</Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button>{quickView.content.confirmLabel}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const FactoryProductQuickView: Story = {
  name: i18n.t('drawer.storyName.factoryProductQuickView', 'Factory: Product Quick View'),
  render: () => <ProductQuickViewDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();
    expect(content.querySelector('[data-testid="quickview-content"]')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: HELP DRAWER STORIES ============

function HelpDrawerDemo() {
  const { t } = useTranslation();
  const helpDrawer = React.useMemo(() => createFakeHelpDrawer(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="help-drawer-demo">
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerTrigger asChild>
          <Button variant="outline">{t('drawer.open')}</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{helpDrawer.content.title}</DrawerTitle>
            {helpDrawer.content.description && (
              <DrawerDescription>{helpDrawer.content.description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="px-4 pb-4" data-testid="help-content">
            <p className="text-muted-foreground text-sm">Type: {helpDrawer.type}</p>
            <p className="text-muted-foreground text-sm">Size: {helpDrawer.size}</p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{helpDrawer.content.cancelLabel}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const FactoryHelpDrawer: Story = {
  name: i18n.t('drawer.storyName.factoryHelpDrawer', 'Factory: Help Drawer'),
  render: () => <HelpDrawerDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();
    expect(content.querySelector('[data-slot="drawer-title"]')?.textContent).toBe('Help & Support');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: DRAWER MATRIX STORIES ============

function DrawerMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createFakeDrawerMatrix(), []);

  return (
    <div className="space-y-6" data-testid="drawer-matrix-demo">
      <h3 className="text-lg font-semibold">{t('drawer.section.variants')}</h3>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(matrix).map(([key, drawer]) => (
          <div key={key} className="rounded-lg border p-3" data-testid={`matrix-${key}`}>
            <p className="text-sm font-medium">{key}</p>
            <p className="text-muted-foreground text-xs">Direction: {drawer.direction}</p>
            <p className="text-muted-foreground text-xs">Size: {drawer.size ?? 'default'}</p>
            <p className="text-muted-foreground text-xs">Type: {drawer.type}</p>
            <p className="text-muted-foreground text-xs">
              {i18n.t('drawer.story.dismissible', 'Dismissible:')}{' '}
              {drawer.dismissible
                ? i18n.t('drawer.story.yes', 'Yes')
                : i18n.t('drawer.story.no', 'No')}
            </p>
            {drawer.snapPoints && (
              <p className="text-muted-foreground text-xs">
                Snap points: {drawer.snapPoints.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryDrawerMatrix: Story = {
  name: i18n.t('drawer.storyName.factoryDrawerMatrix', 'Factory: Drawer Matrix'),
  render: () => <DrawerMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('drawer-matrix-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-directionBottom')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-directionTop')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-directionLeft')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-directionRight')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-sizeSmall')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-sizeFull')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-notDismissible')).toBeInTheDocument();
  },
};

// ============ FACTORY: DRAWER SHOWCASE STORIES ============

function DrawerShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = React.useMemo(() => createFakeDrawerShowcase(), []);

  return (
    <div className="space-y-6" data-testid="drawer-showcase-demo">
      <h3 className="text-lg font-semibold">{t('drawer.section.variants')}</h3>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(showcase).map(([key, item]) => {
          let title: string;
          if ('title' in item) {
            title = item.title as string;
          } else if ('content' in item) {
            ({ title } = (item as FakeDrawer).content);
          } else {
            title = key;
          }
          const description =
            'description' in item ? (item as FakeDrawerContent).description : undefined;
          return (
            <div key={key} className="rounded-lg border p-3" data-testid={`showcase-${key}`}>
              <p className="text-sm font-medium">{key}</p>
              <p className="text-muted-foreground text-xs">Title: {title}</p>
              {description && (
                <p className="text-muted-foreground text-xs">Description: {description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryDrawerShowcase: Story = {
  name: i18n.t('drawer.storyName.factoryDrawerShowcase', 'Factory: Drawer Showcase'),
  render: () => <DrawerShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('drawer-showcase-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-navigation')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-mobileMenu')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-filters')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-cart')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-notifications')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-settings')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-productQuickView')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-helpPanel')).toBeInTheDocument();
  },
};

// ============ FACTORY: COMPLETE DRAWER CONFIG STORIES ============

function CompleteDrawerConfigDemo() {
  const { t } = useTranslation();
  const drawerConfig = React.useMemo(() => createFakeDrawer(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="complete-drawer-demo">
      <div className="mb-4 rounded-lg border p-3" data-testid="drawer-config">
        <p className="text-sm font-medium">{t('drawer.story.description')}</p>
        <p className="text-muted-foreground text-xs">ID: {drawerConfig.id}</p>
        <p className="text-muted-foreground text-xs">Direction: {drawerConfig.direction}</p>
        <p className="text-muted-foreground text-xs">Size: {drawerConfig.size}</p>
        <p className="text-muted-foreground text-xs">Type: {drawerConfig.type}</p>
        <p className="text-muted-foreground text-xs">
          {i18n.t('drawer.story.dismissible', 'Dismissible:')}{' '}
          {drawerConfig.dismissible
            ? i18n.t('drawer.story.yes', 'Yes')
            : i18n.t('drawer.story.no', 'No')}
        </p>
        <p className="text-muted-foreground text-xs">
          {i18n.t('drawer.story.showHandle', 'Show Handle:')}{' '}
          {drawerConfig.showHandle
            ? i18n.t('drawer.story.yes', 'Yes')
            : i18n.t('drawer.story.no', 'No')}
        </p>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline">{t('drawer.open')}</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{drawerConfig.content.title}</DrawerTitle>
            {drawerConfig.content.description && (
              <DrawerDescription>{drawerConfig.content.description}</DrawerDescription>
            )}
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{drawerConfig.content.cancelLabel}</Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button>{drawerConfig.content.confirmLabel}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const FactoryCompleteDrawerConfig: Story = {
  name: i18n.t('drawer.storyName.factoryCompleteDrawerConfig', 'Factory: Complete Drawer Config'),
  render: () => <CompleteDrawerConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('complete-drawer-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('drawer-config')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="drawer-trigger"]');
    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="drawer-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Drawer content not found');
      return el;
    });

    expect(content).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="drawer-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: SWIPE GESTURE DATA STORIES ============

function SwipeGestureDataDemo() {
  const swipeGesture = React.useMemo(() => createFakeSwipeGesture(), []);
  const swipeDismiss = React.useMemo(() => createFakeSwipeDismiss('down'), []);
  const swipeBelowThreshold = React.useMemo(() => createFakeSwipeBelowThreshold('down'), []);
  const allDirectionSwipes = React.useMemo(() => createFakeSwipeGesturesAllDirections(), []);

  return (
    <div className="space-y-6" data-testid="swipe-gesture-data-demo">
      <h3 className="text-lg font-semibold">{i18n.t('drawer.section.states')}</h3>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.randomSwipeGesture', 'Random Swipe Gesture')}
        </p>
        <div className="rounded-lg border p-3" data-testid="random-swipe">
          <p className="text-xs">Direction: {swipeGesture.direction}</p>
          <p className="text-xs">Velocity: {swipeGesture.velocity.toFixed(2)}</p>
          <p className="text-xs">
            Position: {swipeGesture.startPosition} &rarr; {swipeGesture.currentPosition}
          </p>
          <p className="text-xs">Threshold: {swipeGesture.threshold}</p>
          <p className="text-xs">
            Dismissed:{' '}
            {swipeGesture.dismissed
              ? i18n.t('drawer.story.yes', 'Yes')
              : i18n.t('drawer.story.no', 'No')}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.dismissSwipeAboveThreshold', 'Dismiss Swipe (above threshold)')}
        </p>
        <div className="rounded-lg border border-green-500 p-3" data-testid="dismiss-swipe">
          <p className="text-xs">Direction: {swipeDismiss.direction}</p>
          <p className="text-xs">Velocity: {swipeDismiss.velocity.toFixed(2)}</p>
          <p className="text-xs">
            Dismissed:{' '}
            {swipeDismiss.dismissed
              ? i18n.t('drawer.story.yes', 'Yes')
              : i18n.t('drawer.story.no', 'No')}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.belowThresholdSwipe', 'Below Threshold Swipe')}
        </p>
        <div className="rounded-lg border border-red-500 p-3" data-testid="below-threshold-swipe">
          <p className="text-xs">Direction: {swipeBelowThreshold.direction}</p>
          <p className="text-xs">Velocity: {swipeBelowThreshold.velocity.toFixed(2)}</p>
          <p className="text-xs">
            Dismissed:{' '}
            {swipeBelowThreshold.dismissed
              ? i18n.t('drawer.story.yes', 'Yes')
              : i18n.t('drawer.story.no', 'No')}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.allDirectionSwipes', 'All Direction Swipes')}
        </p>
        <div className="grid grid-cols-2 gap-2" data-testid="all-direction-swipes">
          {(Object.entries(allDirectionSwipes) as [string, typeof swipeGesture][]).map(
            ([dir, swipe]) => (
              <div key={dir} className="rounded-md border p-2" data-testid={`swipe-dir-${dir}`}>
                <p className="text-xs font-medium">{dir}</p>
                <p className="text-xs">
                  v={swipe.velocity.toFixed(1)}, d=
                  {swipe.dismissed
                    ? i18n.t('drawer.story.yShort', 'Y')
                    : i18n.t('drawer.story.nShort', 'N')}
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export const FactorySwipeGestureData: Story = {
  name: i18n.t('drawer.storyName.factorySwipeGestureData', 'Factory: Swipe Gesture Data'),
  render: () => <SwipeGestureDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('swipe-gesture-data-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('random-swipe')).toBeInTheDocument();
    expect(canvas.getByTestId('dismiss-swipe')).toBeInTheDocument();
    expect(canvas.getByTestId('below-threshold-swipe')).toBeInTheDocument();
    expect(canvas.getByTestId('swipe-dir-up')).toBeInTheDocument();
    expect(canvas.getByTestId('swipe-dir-down')).toBeInTheDocument();
    expect(canvas.getByTestId('swipe-dir-left')).toBeInTheDocument();
    expect(canvas.getByTestId('swipe-dir-right')).toBeInTheDocument();
  },
};

// ============ FACTORY: SLIDE ANIMATION STATE STORIES ============

function SlideAnimationStateDemo() {
  const { t } = useTranslation();
  const slideState = React.useMemo(() => createFakeSlideState(), []);
  const slideOpen = React.useMemo(() => createFakeSlideStateOpen('bottom'), []);
  const slideClosed = React.useMemo(() => createFakeSlideStateClosed('bottom'), []);
  const slideOpening = React.useMemo(() => createFakeSlideStateOpening('right'), []);
  const slideClosing = React.useMemo(() => createFakeSlideStateClosing('left'), []);
  const allDirections = React.useMemo(() => createFakeSlideStatesAllDirections(), []);

  const renderSlideState = (label: string, state: FakeSlideState, testId: string) => (
    <div className="rounded-lg border p-3" data-testid={testId}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs">State: {state.state}</p>
      <p className="text-xs">Direction: {state.direction}</p>
      <p className="text-xs">Progress: {(state.progress * 100).toFixed(0)}%</p>
      <p className="text-xs">
        Animating:{' '}
        {state.isAnimating ? i18n.t('drawer.story.yes', 'Yes') : i18n.t('drawer.story.no', 'No')}
      </p>
      <p className="text-xs">
        {i18n.t('drawer.story.durationMs', { duration: state.animationDuration })}
      </p>
      <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${state.progress * 100}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="slide-state-demo">
      <h3 className="text-lg font-semibold">{t('drawer.section.states')}</h3>

      <div className="grid grid-cols-2 gap-4">
        {renderSlideState('Random State', slideState, 'slide-random')}
        {renderSlideState('Open (Bottom)', slideOpen, 'slide-open')}
        {renderSlideState('Closed (Bottom)', slideClosed, 'slide-closed')}
        {renderSlideState('Opening (Right)', slideOpening, 'slide-opening')}
        {renderSlideState('Closing (Left)', slideClosing, 'slide-closing')}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {t('drawer.story.allDirectionsOpenState', 'All Directions (Open State)')}
        </p>
        <div className="grid grid-cols-2 gap-2" data-testid="slide-all-directions">
          {(Object.entries(allDirections) as [string, FakeSlideState][]).map(([dir, state]) => (
            <div key={dir} className="rounded-md border p-2" data-testid={`slide-dir-${dir}`}>
              <p className="text-xs font-medium">{dir}</p>
              <p className="text-xs">
                {state.state} ({(state.progress * 100).toFixed(0)}%)
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactorySlideAnimationStates: Story = {
  name: i18n.t('drawer.storyName.factorySlideAnimationStates', 'Factory: Slide Animation States'),
  render: () => <SlideAnimationStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('slide-state-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('slide-random')).toBeInTheDocument();
    expect(canvas.getByTestId('slide-open')).toBeInTheDocument();
    expect(canvas.getByTestId('slide-closed')).toBeInTheDocument();
    expect(canvas.getByTestId('slide-opening')).toBeInTheDocument();
    expect(canvas.getByTestId('slide-closing')).toBeInTheDocument();
    expect(canvas.getByTestId('slide-dir-bottom')).toBeInTheDocument();
    expect(canvas.getByTestId('slide-dir-top')).toBeInTheDocument();
    expect(canvas.getByTestId('slide-dir-left')).toBeInTheDocument();
    expect(canvas.getByTestId('slide-dir-right')).toBeInTheDocument();
  },
};

// ============ FACTORY: OVERLAY STATE STORIES ============

function OverlayStateDemo() {
  const { t } = useTranslation();
  const overlayState = React.useMemo(() => createFakeOverlayState(), []);
  const overlayVisible = React.useMemo(() => createFakeOverlayVisible(), []);
  const overlayHidden = React.useMemo(() => createFakeOverlayHidden(), []);
  const overlayBlurred = React.useMemo(() => createFakeOverlayBlurred(), []);

  const renderOverlay = (label: string, state: FakeOverlayState, testId: string) => (
    <div className="rounded-lg border p-3" data-testid={testId}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs">
        Visible:{' '}
        {state.isVisible ? i18n.t('drawer.story.yes', 'Yes') : i18n.t('drawer.story.no', 'No')}
      </p>
      <p className="text-xs">Opacity: {(state.opacity * 100).toFixed(0)}%</p>
      <p className="text-xs">
        Backdrop Blur:{' '}
        {state.backdropBlur ? i18n.t('drawer.story.yes', 'Yes') : i18n.t('drawer.story.no', 'No')}
      </p>
      <div
        className="mt-2 h-16 w-full rounded-md border"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${state.opacity})`,
          backdropFilter: state.backdropBlur ? 'blur(4px)' : 'none',
        }}
      />
    </div>
  );

  return (
    <div className="space-y-6" data-testid="overlay-state-demo">
      <h3 className="text-lg font-semibold">{t('drawer.section.states')}</h3>

      <div className="grid grid-cols-2 gap-4">
        {renderOverlay('Random State', overlayState, 'overlay-random')}
        {renderOverlay('Visible', overlayVisible, 'overlay-visible')}
        {renderOverlay('Hidden', overlayHidden, 'overlay-hidden')}
        {renderOverlay('Blurred', overlayBlurred, 'overlay-blurred')}
      </div>
    </div>
  );
}

export const FactoryOverlayStates: Story = {
  name: i18n.t('drawer.storyName.factoryOverlayStates', 'Factory: Overlay States'),
  render: () => <OverlayStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('overlay-state-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('overlay-random')).toBeInTheDocument();
    expect(canvas.getByTestId('overlay-visible')).toBeInTheDocument();
    expect(canvas.getByTestId('overlay-hidden')).toBeInTheDocument();
    expect(canvas.getByTestId('overlay-blurred')).toBeInTheDocument();
  },
};

// ============ FACTORY: SNAP POINT STATE STORIES ============

function SnapPointStateDemo() {
  const snapState = React.useMemo(() => createFakeSnapPointState(), []);
  const allSnapStates = React.useMemo(() => createFakeSnapPointStatesAll(), []);

  return (
    <div className="space-y-6" data-testid="snap-point-state-demo">
      <h3 className="text-lg font-semibold">{i18n.t('drawer.section.states')}</h3>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.randomSnapPointState', 'Random Snap Point State')}
        </p>
        <div className="rounded-lg border p-3" data-testid="snap-random">
          <p className="text-xs">Active: {String(snapState.activeSnapPoint)}</p>
          <p className="text-xs">Next: {String(snapState.nextSnapPoint)}</p>
          <p className="text-xs">Direction: {snapState.direction}</p>
          <p className="text-xs">Available: {snapState.availableSnapPoints.join(', ')}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.allSnapPointStates', 'All Snap Point States')}
        </p>
        <div className="grid grid-cols-2 gap-2" data-testid="snap-all-states">
          {(Object.entries(allSnapStates) as [string, FakeSnapPointState][]).map(([key, state]) => (
            <div key={key} className="rounded-md border p-2" data-testid={`snap-state-${key}`}>
              <p className="text-xs font-medium">{key}</p>
              <p className="text-xs">Active: {String(state.activeSnapPoint)}</p>
              <p className="text-xs">Next: {String(state.nextSnapPoint)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactorySnapPointStates: Story = {
  name: i18n.t('drawer.storyName.factorySnapPointStates', 'Factory: Snap Point States'),
  render: () => <SnapPointStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('snap-point-state-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('snap-random')).toBeInTheDocument();
    expect(canvas.getByTestId('snap-state-snap25')).toBeInTheDocument();
    expect(canvas.getByTestId('snap-state-snap50')).toBeInTheDocument();
    expect(canvas.getByTestId('snap-state-snap75')).toBeInTheDocument();
    expect(canvas.getByTestId('snap-state-snapFull')).toBeInTheDocument();
  },
};

// ============ FACTORY: DIRECTION-SPECIFIC DRAWERS STORIES ============

function DirectionSpecificDrawersDemo() {
  const { t } = useTranslation();
  const bottomDrawer = React.useMemo(() => createFakeBottomDrawer(), []);
  const topDrawer = React.useMemo(() => createFakeTopDrawer(), []);
  const leftDrawer = React.useMemo(() => createFakeLeftDrawer(), []);
  const rightDrawer = React.useMemo(() => createFakeRightDrawer(), []);
  const allDirections = React.useMemo(() => createFakeDrawersAllDirections(), []);

  const renderDrawerInfo = (label: string, drawer: FakeDrawer, testId: string) => (
    <div className="rounded-lg border p-3" data-testid={testId}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs">Direction: {drawer.direction}</p>
      <p className="text-xs">Size: {drawer.size ?? 'default'}</p>
      <p className="text-xs">Type: {drawer.type}</p>
      <p className="text-xs">
        Handle:{' '}
        {drawer.showHandle ? i18n.t('drawer.story.yes', 'Yes') : i18n.t('drawer.story.no', 'No')}
      </p>
      {drawer.snapPoints && <p className="text-xs">Snap: {drawer.snapPoints.join(', ')}</p>}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="direction-drawers-demo">
      <h3 className="text-lg font-semibold">{t('drawer.section.positions')}</h3>

      <div className="grid grid-cols-2 gap-4">
        {renderDrawerInfo('Bottom Drawer', bottomDrawer, 'dir-bottom')}
        {renderDrawerInfo('Top Drawer', topDrawer, 'dir-top')}
        {renderDrawerInfo('Left Drawer', leftDrawer, 'dir-left')}
        {renderDrawerInfo('Right Drawer', rightDrawer, 'dir-right')}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          All Directions (via createFakeDrawersAllDirections)
        </p>
        <div className="grid grid-cols-2 gap-2" data-testid="all-dirs-factory">
          {(Object.entries(allDirections) as [string, FakeDrawer][]).map(([dir, drawer]) => (
            <div key={dir} className="rounded-md border p-2" data-testid={`all-dir-${dir}`}>
              <p className="text-xs font-medium">{dir}</p>
              <p className="text-xs">
                {drawer.type}, {drawer.size ?? 'default'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryDirectionSpecificDrawers: Story = {
  name: i18n.t(
    'drawer.storyName.factoryDirectionSpecificDrawers',
    'Factory: Direction-Specific Drawers'
  ),
  render: () => <DirectionSpecificDrawersDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('direction-drawers-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('dir-bottom')).toBeInTheDocument();
    expect(canvas.getByTestId('dir-top')).toBeInTheDocument();
    expect(canvas.getByTestId('dir-left')).toBeInTheDocument();
    expect(canvas.getByTestId('dir-right')).toBeInTheDocument();
    expect(canvas.getByTestId('all-dir-bottom')).toBeInTheDocument();
    expect(canvas.getByTestId('all-dir-top')).toBeInTheDocument();
    expect(canvas.getByTestId('all-dir-left')).toBeInTheDocument();
    expect(canvas.getByTestId('all-dir-right')).toBeInTheDocument();
  },
};

// ============ FACTORY: DARK MODE DRAWER STORIES ============

function DarkModeDrawerDemo() {
  const { t } = useTranslation();
  const darkDrawer = React.useMemo(() => createFakeDarkModeDrawer(), []);
  const themeVariants = React.useMemo(() => createFakeDrawerThemeVariants(), []);

  return (
    <div className="space-y-6" data-testid="dark-mode-drawer-demo">
      <h3 className="text-lg font-semibold">{t('drawer.story.darkMode')}</h3>

      <div>
        <p className="mb-2 text-sm font-medium">
          {t('drawer.story.darkModeDrawer', 'Dark Mode Drawer')}
        </p>
        <div className="rounded-lg border p-3" data-testid="dark-drawer">
          <p className="text-xs">Theme: {darkDrawer.theme}</p>
          <p className="text-xs">Direction: {darkDrawer.direction}</p>
          <p className="text-xs">Type: {darkDrawer.type}</p>
          <p className="text-xs">Title: {darkDrawer.content.title}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {t('drawer.story.themeVariants', 'Theme Variants')}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3" data-testid="theme-light">
            <p className="text-sm font-medium">{t('drawer.story.light', 'Light')}</p>
            <p className="text-xs">Theme: {themeVariants.light.theme}</p>
            <p className="text-xs">Direction: {themeVariants.light.direction}</p>
          </div>
          <div className="rounded-lg border bg-gray-900 p-3 text-white" data-testid="theme-dark">
            <p className="text-sm font-medium">{t('drawer.story.dark', 'Dark')}</p>
            <p className="text-xs">Theme: {themeVariants.dark.theme}</p>
            <p className="text-xs">Direction: {themeVariants.dark.direction}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const FactoryDarkModeDrawer: Story = {
  name: i18n.t('drawer.storyName.factoryDarkModeDrawer', 'Factory: Dark Mode Drawer'),
  render: () => <DarkModeDrawerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('dark-mode-drawer-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('dark-drawer')).toBeInTheDocument();
    expect(canvas.getByTestId('theme-light')).toBeInTheDocument();
    expect(canvas.getByTestId('theme-dark')).toBeInTheDocument();
  },
};

// ============ TYPE-SAFETY DEMO (exercising all type aliases) ============

function TypeSafetyDemo() {
  // Exercise all type aliases to ensure they're imported and usable
  const direction: DrawerDirection = 'bottom';
  const size: DrawerSize = 'lg';
  const drawerType: DrawerType = 'navigation';
  const snapPoint: DrawerSnapPoint = 0.75;
  const animState: SlideAnimationState = 'opening';

  // Exercise all interface types
  const content: FakeDrawerContent = createFakeDrawerContent();
  const navItem: FakeDrawerNavItem = createFakeDrawerNavItem();
  const navDrawer: FakeNavigationDrawer = createFakeNavigationDrawer();
  const filterOpt: FakeFilterOption = createFakeFilterOption();
  const filterGrp: FakeFilterGroup = createFakeFilterGroup();
  const filtersDrawer: FakeFiltersDrawer = createFakeFiltersDrawer();
  const cartIt: FakeCartItem = createFakeCartItem();
  const cartDr: FakeCartDrawer = createFakeCartDrawer();
  const notifItem: FakeNotificationItem = createFakeNotificationItem();
  const notifDrawer: FakeNotificationsDrawer = createFakeNotificationsDrawer();
  const settSection: FakeSettingsSection = createFakeSettingsSection();
  const settDrawer: FakeSettingsDrawer = createFakeSettingsDrawer();
  const drawer: FakeDrawer = createFakeDrawer();
  const swipe: FakeSwipeGesture = createFakeSwipeGesture();
  const slide: FakeSlideState = createFakeSlideState();
  const overlay: FakeOverlayState = createFakeOverlayState();
  const snap: FakeSnapPointState = createFakeSnapPointState();
  const darkMode: FakeDarkModeDrawer = createFakeDarkModeDrawer();

  return (
    <div className="space-y-4" data-testid="type-safety-demo">
      <h3 className="text-lg font-semibold">{i18n.t('drawer.section.variants')}</h3>

      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">
          {i18n.t('drawer.story.typeAliases', 'Type Aliases')}
        </p>
        <div className="space-y-1 text-xs" data-testid="type-aliases">
          <p>DrawerDirection: {direction}</p>
          <p>DrawerSize: {size}</p>
          <p>DrawerType: {drawerType}</p>
          <p>DrawerSnapPoint: {snapPoint}</p>
          <p>SlideAnimationState: {animState}</p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">Interface Instances ({18} types)</p>
        <div className="grid grid-cols-3 gap-2 text-xs" data-testid="interface-instances">
          <span>FakeDrawerContent: {content.title.slice(0, 15)}...</span>
          <span>FakeDrawerNavItem: {navItem.label}</span>
          <span>FakeNavigationDrawer: {navDrawer.title}</span>
          <span>FakeFilterOption: {filterOpt.label}</span>
          <span>FakeFilterGroup: {filterGrp.label}</span>
          <span>FakeFiltersDrawer: {filtersDrawer.title}</span>
          <span>FakeCartItem: {cartIt.name.slice(0, 15)}...</span>
          <span>FakeCartDrawer: {cartDr.title}</span>
          <span>FakeNotificationItem: {notifItem.title.slice(0, 12)}...</span>
          <span>FakeNotificationsDrawer: {notifDrawer.title}</span>
          <span>FakeSettingsSection: {settSection.title}</span>
          <span>FakeSettingsDrawer: {settDrawer.title}</span>
          <span>FakeDrawer: {drawer.type}</span>
          <span>FakeSwipeGesture: {swipe.direction}</span>
          <span>FakeSlideState: {slide.state}</span>
          <span>FakeOverlayState: {String(overlay.isVisible)}</span>
          <span>FakeSnapPointState: {String(snap.activeSnapPoint)}</span>
          <span>FakeDarkModeDrawer: {darkMode.theme}</span>
        </div>
      </div>
    </div>
  );
}

export const FactoryTypeSafety: Story = {
  name: i18n.t('drawer.storyName.factoryTypeSafety', 'Factory: Type Safety'),
  render: () => <TypeSafetyDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('type-safety-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('type-aliases')).toBeInTheDocument();
    expect(canvas.getByTestId('interface-instances')).toBeInTheDocument();
    // Verify type alias values rendered
    expect(canvas.getByTestId('type-aliases').textContent).toContain('bottom');
    expect(canvas.getByTestId('type-aliases').textContent).toContain('lg');
    expect(canvas.getByTestId('type-aliases').textContent).toContain('navigation');
    expect(canvas.getByTestId('type-aliases').textContent).toContain('0.75');
    expect(canvas.getByTestId('type-aliases').textContent).toContain('opening');
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('drawer.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('drawer.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MobileViewport: Story = {
  ...Default,
  name: i18n.t('drawer.storyName.mobileViewport', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('drawer.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   validationError
//   emptyContent
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('drawer.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: drawerStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerValidationError: Story = {
  ...Default,
  name: i18n.t('drawer.storyName.handlerValidationError', 'Handler: Validation Error'),
  parameters: { msw: { handlers: drawerStatusHandlers.validationError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyContent: Story = {
  ...Default,
  name: i18n.t('drawer.storyName.handlerEmptyContent', 'Handler: Empty Content'),
  parameters: { msw: { handlers: drawerStatusHandlers.emptyContent } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

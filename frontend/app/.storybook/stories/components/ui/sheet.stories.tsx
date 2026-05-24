import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import { sheetHandlers, sheetStatusHandlers } from '@/.storybook/stories/_handlers/sheet.handlers';
import {
  ACTION_LABELS,
  createComprehensiveSheetConfig,
  createComprehensiveSheetConfigMatrix,
  createFakeBottomSheet,
  createFakeFullSheet,
  createFakeLargeSheet,
  createFakeLeftSheet,
  createFakeRightSheet,
  createFakeSheet,
  createFakeSheetAnimationConfig,
  createFakeSheetAriaConfig,
  createFakeSheetCartItem,
  createFakeSheetCartItems,
  createFakeSheetDarkModeConfig,
  createFakeSheetFocusableElements,
  createFakeSheetFormField,
  createFakeSheetFormFields,
  createFakeSheetNavItem,
  createFakeSheetNavItems,
  createFakeSheetNotification,
  createFakeSheetNotifications,
  createFakeSheetOverlayConfig,
  createFakeSheets,
  createFakeSheetWithCart,
  createFakeSheetWithFilters,
  createFakeSheetWithForm,
  createFakeSheetWithNavigation,
  createFakeSheetWithNotifications,
  createFakeSmallSheet,
  createFakeTopSheet,
  createSheetContentTypeMatrix,
  createSheetShowcase,
  createSheetSideMatrix,
  createSheetSizeMatrix,
  createSheetTestData,
  SHEET_CONTENT_TYPES,
  SHEET_SIDES,
  SHEET_SIZES,
  SHEET_TITLES,
  SIZE_CLASSES_HORIZONTAL,
  SIZE_CLASSES_VERTICAL,
} from '@/.storybook/stories/_factories/sheet.factory';
import type {
  ComprehensiveSheetConfig,
  FakeSheet,
  FakeSheetCartItem,
  FakeSheetFilterOption,
  FakeSheetFilterSection,
  FakeSheetFormField,
  FakeSheetNavItem,
  FakeSheetNotification,
  SheetContentType,
  SheetFocusableElement,
  SheetSide,
  SheetSize,
} from '@/.storybook/stories/_factories/sheet.factory';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type SheetDemoProps = {
  body?: string;
  closeLabel?: string;
  defaultOpen?: boolean;
  description?: string;
  saveLabel?: string;
  title?: string;
  triggerLabel?: string;
};

function SheetDemo({
  defaultOpen = false,
  triggerLabel = 'Open sheet',
  title = 'Quick settings',
  description = 'Use sheets for secondary tasks without losing context.',
  body = 'Put any content here. Sheets are dialogs that slide from an edge.',
  closeLabel = 'Close',
  saveLabel = 'Save',
}: SheetDemoProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div data-sheet-demo data-sheet-open={open ? 'true' : 'false'}>
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger asChild>
          <Button data-sheet-trigger variant="outline">
            {triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle data-sheet-title>{title}</SheetTitle>
            <SheetDescription data-sheet-description>{description}</SheetDescription>
          </SheetHeader>
          <div className="px-4 text-sm" data-sheet-body>
            {body}
          </div>
          <SheetFooter>
            <Button data-sheet-action="close" onClick={() => setOpen(false)} variant="outline">
              {closeLabel}
            </Button>
            <Button data-sheet-action="save" onClick={() => setOpen(false)}>
              {saveLabel}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function I18nSheetDemo({ defaultOpen = false }: Pick<SheetDemoProps, 'defaultOpen'>) {
  useTranslation();

  return (
    <SheetDemo
      body={i18n.t(
        'sheet.body',
        'Put any content here. Sheets are dialogs that slide from an edge.'
      )}
      closeLabel={i18n.t('sheet.action.close', 'Close')}
      defaultOpen={defaultOpen}
      description={i18n.t(
        'sheet.description',
        'Use sheets for secondary tasks without losing context.'
      )}
      saveLabel={i18n.t('sheet.action.save', 'Save')}
      title={i18n.t('sheet.title', 'Quick settings')}
      triggerLabel={i18n.t('sheet.trigger', 'Open sheet')}
    />
  );
}

const meta = {
  title: 'Components/UI/Sheet',
  component: SheetDemo,
  tags: ['autodocs'],
  args: {
    defaultOpen: false,
    triggerLabel: i18n.t('sheet.story.openSheet', 'Open sheet'),
    title: i18n.t('sheet.story.quickSettings', 'Quick settings'),
    description: i18n.t(
      'sheet.story.useSheetsForSecondaryTasks',
      'Use sheets for secondary tasks without losing context.'
    ),
    body: i18n.t(
      'sheet.story.putAnyContentHere',
      'Put any content here. Sheets are dialogs that slide from an edge.'
    ),
    closeLabel: i18n.t('sheet.story.close', 'Close'),
    saveLabel: i18n.t('sheet.story.save', 'Save'),
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onEscapeKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: sheetHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('sheet.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('sheet.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('sheet.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('sheet.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('sheet.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('sheet.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('sheet.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'sheet.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    // Demo wrapper props
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'sheet.argType.initialOpenStateOfTheSheet',
        'Initial open state of the sheet'
      ),
      table: {
        category: 'Demo',
        type: { summary: 'boolean' },
      },
    },
    triggerLabel: {
      control: 'text',
      description: i18n.t(
        'sheet.argType.labelForTheSheetTriggerButton',
        'Label for the sheet trigger button'
      ),
      table: {
        category: 'Demo',
        type: { summary: 'string' },
      },
    },
    title: {
      control: 'text',
      description: i18n.t('sheet.argType.sheetTitleText', 'Sheet title text'),
      table: {
        category: 'Demo',
        type: { summary: 'string' },
      },
    },
    description: {
      control: 'text',
      description: i18n.t('sheet.argType.sheetDescriptionText', 'Sheet description text'),
      table: {
        category: 'Demo',
        type: { summary: 'string' },
      },
    },
    body: {
      control: 'text',
      description: i18n.t('sheet.argType.sheetBodyContent', 'Sheet body content'),
      table: {
        category: 'Demo',
        type: { summary: 'string' },
      },
    },
    closeLabel: {
      control: 'text',
      description: i18n.t('sheet.argType.closeButtonLabel', 'Close button label'),
      table: {
        category: 'Demo',
        type: { summary: 'string' },
      },
    },
    saveLabel: {
      control: 'text',
      description: i18n.t('sheet.argType.saveButtonLabel', 'Save button label'),
      table: {
        category: 'Demo',
        type: { summary: 'string' },
      },
    },
    // Sheet Props Reference (Radix Dialog.Root):
    // - open: Controlled open state (boolean)
    // - defaultOpen: Default open state for uncontrolled usage (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - modal: Whether to block interaction outside (boolean, default: true)
    //
    // SheetTrigger Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // SheetContent Props Reference:
    // - side: Slide direction ('top' | 'bottom' | 'left' | 'right', default: 'right')
    // - forceMount: Force mount when closed for animations (boolean)
    // - onOpenAutoFocus: Called on open with auto-focus ((event) => void)
    // - onCloseAutoFocus: Called on close with auto-focus ((event) => void)
    // - onEscapeKeyDown: Called on Escape key ((event) => void)
    // - onPointerDownOutside: Called on click outside ((event) => void)
    // - onInteractOutside: Called on interaction outside ((event) => void)
    // - className: Additional CSS classes (string)
    //
    // SheetHeader, SheetFooter Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Section content (ReactNode)
    //
    // SheetTitle Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Title text content (ReactNode)
    //
    // SheetDescription Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Description text content (ReactNode)
    //
    // SheetClose Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Open sheet');

    // Sheet content should NOT be visible when closed
    const doc = canvasElement.ownerDocument;
    expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    expect(demoRoot!.getAttribute('data-sheet-open')).toBe('false');
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();
    expect(demoRoot!.getAttribute('data-sheet-open')).toBe('true');

    // Sheet content should be visible when defaultOpen is true
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');

    // Verify title and description are present
    const title = content.querySelector('[data-sheet-title]');
    expect(title).toBeInTheDocument();
    expect(title!.textContent?.trim().length).not.toBe(0);

    const description = content.querySelector('[data-sheet-description]');
    expect(description).toBeInTheDocument();

    // Close with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Playground: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();

    // Open sheet via click
    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content).toBeInTheDocument();
    expect(content.getAttribute('role')).toBe('dialog');

    // Close with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

function VariantsDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('sheet.variants.rightSide')}</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">{t('sheet.story.openRightSheet', 'Open Right Sheet')}</Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t('sheet.story.rightSheet', 'Right Sheet')}</SheetTitle>
              <SheetDescription>
                {t(
                  'sheet.story.thisSheetSlidesInFromTheRightSide',
                  'This sheet slides in from the right side.'
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">
              {t('sheet.story.contentGoesHere', 'Content goes here.')}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('sheet.variants.leftSide')}</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">{t('sheet.story.openLeftSheet', 'Open Left Sheet')}</Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>{t('sheet.story.leftSheet', 'Left Sheet')}</SheetTitle>
              <SheetDescription>
                {t(
                  'sheet.story.thisSheetSlidesInFromTheLeftSide',
                  'This sheet slides in from the left side.'
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">
              {t('sheet.story.contentGoesHere', 'Content goes here.')}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('sheet.variants.topSide')}</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">{t('sheet.story.openTopSheet', 'Open Top Sheet')}</Button>
          </SheetTrigger>
          <SheetContent side="top">
            <SheetHeader>
              <SheetTitle>{t('sheet.story.topSheet', 'Top Sheet')}</SheetTitle>
              <SheetDescription>
                {t('sheet.story.thisSheetSlidesInFromTheTop', 'This sheet slides in from the top.')}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">
              {t('sheet.story.contentGoesHere', 'Content goes here.')}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('sheet.variants.bottomSide')}</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              {t('sheet.story.openBottomSheet', 'Open Bottom Sheet')}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>{t('sheet.story.bottomSheet', 'Bottom Sheet')}</SheetTitle>
              <SheetDescription>
                {t(
                  'sheet.story.thisSheetSlidesInFromTheBottom',
                  'This sheet slides in from the bottom.'
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">
              {t('sheet.story.contentGoesHere', 'Content goes here.')}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('sheet.variants.withForm')}</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">{t('sheet.story.editProfile', 'Edit Profile')}</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t('sheet.story.editProfile', 'Edit Profile')}</SheetTitle>
              <SheetDescription>
                {t(
                  'sheet.story.makeChangesToYourProfileHere',
                  'Make changes to your profile here.'
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="name">
                  Name
                </label>
                <input
                  className="border-input h-9 rounded-md border px-3"
                  id="name"
                  defaultValue="John Doe"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <input
                  className="border-input h-9 rounded-md border px-3"
                  id="email"
                  defaultValue="john@example.com"
                />
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline">{t('sheet.story.cancel', 'Cancel')}</Button>
              <Button>{t('sheet.story.saveChanges', 'Save Changes')}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('sheet.variants.withLongContent')}</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">{t('sheet.story.viewTerms', 'View Terms')}</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t('sheet.story.termsOfService', 'Terms of Service')}</SheetTitle>
              <SheetDescription>
                {t('sheet.story.pleaseReadOurTermsCarefully', 'Please read our terms carefully.')}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 text-sm">
              {Array.from({ length: 20 }, (_, i) => (
                <p key={i} className="mb-4">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                  exercitation ullamco laboris.
                </p>
              ))}
            </div>
            <SheetFooter>
              <Button variant="outline">{t('sheet.story.decline', 'Decline')}</Button>
              <Button>{t('sheet.story.accept', 'Accept')}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all variant trigger buttons are present
    expect(canvas.getByRole('button', { name: 'Open Right Sheet' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Open Left Sheet' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Open Top Sheet' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Open Bottom Sheet' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'View Terms' })).toBeInTheDocument();

    // Open the right sheet and verify
    const doc = canvasElement.ownerDocument;
    await userEvent.click(canvas.getByRole('button', { name: 'Open Right Sheet' }));

    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(sheet.getAttribute('role')).toBe('dialog');

    // Close with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

function SizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sheet.sizes.small')}</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              {i18n.t('sheet.story.openSmallSheet', 'Open Small Sheet')}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-64 sm:max-w-64">
            <SheetHeader>
              <SheetTitle>{i18n.t('sheet.story.smallSheet', 'Small Sheet')}</SheetTitle>
              <SheetDescription>
                {i18n.t('sheet.story.narrowSheetDescription', 'A narrow sheet for simple content.')}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">
              {i18n.t('sheet.story.compactContent', 'Compact content.')}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sheet.sizes.default')}</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              {i18n.t('sheet.story.openDefaultSheet', 'Open Default Sheet')}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{i18n.t('sheet.story.defaultSheet', 'Default Sheet')}</SheetTitle>
              <SheetDescription>
                {i18n.t(
                  'sheet.story.standardWidthForMostUseCases',
                  'Standard width for most use cases.'
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">
              {i18n.t('sheet.story.standardContentArea', 'Standard content area.')}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sheet.sizes.large')}</p>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              {i18n.t('sheet.story.openLargeSheet', 'Open Large Sheet')}
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{i18n.t('sheet.story.largeSheet', 'Large Sheet')}</SheetTitle>
              <SheetDescription>
                {i18n.t(
                  'sheet.story.widerSheetForComplexContentOrForms',
                  'Wider sheet for complex content or forms.'
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">
              {i18n.t(
                'sheet.story.moreRoomForDetailedContentAndLargerForms',
                'More room for detailed content and larger forms.'
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all size trigger buttons are present
    expect(canvas.getByRole('button', { name: 'Open Small Sheet' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Open Default Sheet' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Open Large Sheet' })).toBeInTheDocument();

    // Open the small sheet and verify
    const doc = canvasElement.ownerDocument;
    await userEvent.click(canvas.getByRole('button', { name: 'Open Small Sheet' }));

    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.className).toContain('w-64');

    // Close with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Sheet demo root was not found.');
    }

    const getContent = () => doc.body.querySelector('[data-slot="sheet-content"]');
    const getOverlay = () => doc.body.querySelector('[data-slot="sheet-overlay"]');

    expect(getContent()).not.toBeInTheDocument();
    expect(demoRoot.getAttribute('data-sheet-open')).toBe('false');

    const trigger = demoRoot.querySelector('[data-sheet-trigger]');

    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Sheet trigger was not found.');
    }

    await userEvent.click(trigger);

    await waitFor(() => expect(demoRoot.getAttribute('data-sheet-open')).toBe('true'));

    const contentEl = await waitFor(() => {
      const el = getContent();
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    const overlayEl = getOverlay();
    if (!(overlayEl instanceof HTMLElement)) {
      throw new Error('Sheet overlay was not found.');
    }

    const titleEl = contentEl.querySelector('[data-sheet-title]');
    const descriptionEl = contentEl.querySelector('[data-sheet-description]');
    const bodyEl = contentEl.querySelector('[data-sheet-body]');

    if (!(titleEl instanceof HTMLElement)) {
      throw new Error('Sheet title was not found.');
    }

    if (!(descriptionEl instanceof HTMLElement)) {
      throw new Error('Sheet description was not found.');
    }

    if (!(bodyEl instanceof HTMLElement)) {
      throw new Error('Sheet body was not found.');
    }

    expect(titleEl.textContent?.trim().length).not.toBe(0);
    expect(descriptionEl.textContent?.trim().length).not.toBe(0);
    expect(bodyEl.textContent?.trim().length).not.toBe(0);

    const saveButton = contentEl.querySelector('[data-sheet-action="save"]');

    if (!(saveButton instanceof HTMLButtonElement)) {
      throw new Error('Sheet save button was not found.');
    }

    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(getContent()).not.toBeInTheDocument();
    });
    await waitFor(() => expect(demoRoot.getAttribute('data-sheet-open')).toBe('false'));

    await userEvent.click(trigger);

    await waitFor(() => expect(demoRoot.getAttribute('data-sheet-open')).toBe('true'));

    const contentElAgain = await waitFor(() => {
      const el = getContent();
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    const overlayElAgain = getOverlay();
    if (!(overlayElAgain instanceof HTMLElement)) {
      throw new Error('Sheet overlay was not found.');
    }

    expect(contentElAgain.getAttribute('data-slot')).toBe('sheet-content');
    expect(overlayElAgain.getAttribute('data-slot')).toBe('sheet-overlay');

    await userEvent.click(overlayElAgain);

    await waitFor(() => {
      expect(getContent()).not.toBeInTheDocument();
    });
    await waitFor(() => expect(demoRoot.getAttribute('data-sheet-open')).toBe('false'));
  },
};

export const Dark: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.dark', 'Dark Mode'),
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Sheet demo root was not found.');
    }

    // Verify dark mode is applied
    expect(doc.documentElement.classList.contains('dark')).toBe(true);

    const trigger = demoRoot.querySelector('[data-sheet-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Sheet trigger was not found.');
    }

    // Open sheet
    await userEvent.click(trigger);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    // Verify sheet is open and has dark mode styling
    expect(content).toBeInTheDocument();
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');

    // Verify overlay has dark mode styling
    const overlay = doc.body.querySelector('[data-slot="sheet-overlay"]');
    expect(overlay).toBeInTheDocument();

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    // Verify RTL direction
    expect(doc.documentElement.dir).toBe('rtl');

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Sheet trigger was not found.');
    }

    // Open sheet
    await userEvent.click(trigger);

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');

    // Close with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: (args) => <I18nSheetDemo defaultOpen={args.defaultOpen} />,
  play: async (context) => {
    const root = context.canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(root.ownerDocument.documentElement.lang).toBe('ja');

    const trigger = root.querySelector('[data-sheet-trigger]');

    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Sheet trigger was not found.');
    }

    expect(within(trigger).getByText('シート')).toBeInTheDocument();

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
  name: i18n.t('sheet.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    msw: { handlers: sheetHandlers },
  },
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sheetStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sheetStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sheetStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sheetStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sheetStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sheetStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sheetStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');
    expect(demoRoot).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    const doc = canvasElement.ownerDocument;
    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(content.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Accessibility: Story = {
  name: i18n.t('sheet.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const demoRoot = canvasElement.querySelector('[data-sheet-demo]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Sheet demo root was not found.');
    }

    const trigger = demoRoot.querySelector('[data-sheet-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Sheet trigger was not found.');
    }

    // Test keyboard navigation - focus trigger
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Open sheet with Enter key
    await userEvent.keyboard('{Enter}');

    const content = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    // Verify dialog role and ARIA attributes
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');

    // Verify title is accessible
    const title = content.querySelector('[data-sheet-title]');
    expect(title).toBeInTheDocument();

    // Test focus trap - focus should be trapped inside sheet
    const closeButton = content.querySelector('[data-sheet-action="close"]');
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.focus();
      expect(doc.activeElement).toBe(closeButton);
    }

    // Close sheet with Escape key
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });

    // Focus should return to trigger after closing
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });
  },
};

// ============ FAKER INTEGRATION STORIES ============

function SheetWithFakerData() {
  const fakeContent = React.useMemo(() => createFakeSheet(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="faker-sheet-demo">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline">
            {i18n.t('sheet.story.openFakerSheet', 'Open Faker Sheet')}
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{fakeContent.title}</SheetTitle>
            <SheetDescription>{fakeContent.description}</SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4 text-sm">
            <p className="text-muted-foreground">ID: {fakeContent.id}</p>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {fakeContent.cancelLabel}
            </Button>
            <Button
              variant={fakeContent.destructive ? 'destructive' : 'default'}
              onClick={() => setOpen(false)}
            >
              {fakeContent.confirmLabel}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <SheetWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="faker-sheet-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="button"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected sheet trigger button to be present.');
    }

    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet content was not found.');
      return el;
    });

    expect(
      sheet.querySelector('[data-slot="sheet-title"]')?.textContent?.trim()
    ).toBeInTheDocument();
    expect(
      sheet.querySelector('[data-slot="sheet-description"]')?.textContent?.trim()
    ).toBeInTheDocument();
  },
};

// ============ ASYNC DATA STORIES ============

interface SheetApiResponse {
  cancelLabel: string;
  confirmLabel: string;
  content: string;
  description: string;
  id: string;
  title: string;
}

interface SheetApiError {
  code: string;
  message: string;
  status: number;
}

function SheetWithAsyncData() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<SheetApiResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<SheetApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/dialog-content/test-sheet')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as SheetApiError;
          throw err;
        }
        return res.json() as Promise<SheetApiResponse>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
        return undefined;
      })
      .catch((error_: SheetApiError) => {
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
    <div data-testid="async-sheet-demo" data-state={getDataState()}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline">
            {i18n.t('sheet.story.openAsyncSheet', 'Open Async Sheet')}
          </Button>
        </SheetTrigger>
        <SheetContent>
          {loading && (
            <div data-testid="sheet-loading" className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          )}
          {error && (
            <div data-testid="sheet-error" data-error-status={error.status}>
              <SheetHeader>
                <SheetTitle className="text-destructive">
                  {i18n.t('sheet.story.error', 'Error')} {error.status}
                </SheetTitle>
                <SheetDescription>{error.message}</SheetDescription>
              </SheetHeader>
              <SheetFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button onClick={fetchData}>{i18n.t('sheet.story.retry', 'Retry')}</Button>
              </SheetFooter>
            </div>
          )}
          {data && !loading && !error && (
            <div data-testid="sheet-success">
              <SheetHeader>
                <SheetTitle>{data.title}</SheetTitle>
                <SheetDescription>{data.description}</SheetDescription>
              </SheetHeader>
              <div className="px-4 py-4 text-sm">{data.content || 'Sheet content loaded.'}</div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {data.cancelLabel}
                </Button>
                <Button onClick={() => setOpen(false)}>{data.confirmLabel}</Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: sheetHandlers },
  },
  render: () => <SheetWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected sheet trigger button to be present.');
    }

    await userEvent.click(trigger);

    // Wait for loading state
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="sheet-loading"]')).toBeInTheDocument();
    });

    // Wait for success state
    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="sheet-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: sheetStatusHandlers.emptyData },
  },
  render: () => <SheetWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="sheet-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowResponse: Story = {
  name: i18n.t('sheet.storyName.slowResponse', 'Slow Response (5s)'),
  parameters: {
    msw: { handlers: sheetStatusHandlers.slowResponse },
  },
  render: () => <SheetWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    await userEvent.click(trigger!);

    expect(doc.body.querySelector('[data-testid="sheet-loading"]')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="sheet-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error404NotFound: Story = {
  name: i18n.t('sheet.storyName.error404NotFound', 'Error 404: Not Found'),
  parameters: {
    msw: { handlers: sheetStatusHandlers.notFound },
  },
  render: () => <SheetWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
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
  name: i18n.t('sheet.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: sheetStatusHandlers.conflict },
  },
  render: () => <SheetWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="sheet-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(doc.body.querySelector('[data-error-status="409"]')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('sheet.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: sheetStatusHandlers.tooManyRequests },
  },
  render: () => <SheetWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="sheet-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(doc.body.querySelector('[data-error-status="429"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('sheet.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: sheetStatusHandlers.badGateway },
  },
  render: () => <SheetWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="sheet-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(doc.body.querySelector('[data-error-status="502"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('sheet.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: sheetStatusHandlers.serviceUnavailable },
  },
  render: () => <SheetWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="sheet-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(doc.body.querySelector('[data-error-status="503"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('sheet.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: sheetStatusHandlers.gatewayTimeout },
  },
  render: () => <SheetWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="sheet-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(doc.body.querySelector('[data-error-status="504"]')).toBeInTheDocument();
  },
};

// ============ SWIPE GESTURE STORIES ============

function SwipeableSheet({ side }: { side: 'left' | 'right' | 'top' | 'bottom' }) {
  const [open, setOpen] = React.useState(true);
  const [swipeProgress, setSwipeProgress] = React.useState(0);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Sheet from {side} - Swipe or drag to close.
        <span className="ml-2" data-testid="swipe-progress">
          Progress: {swipeProgress}%
        </span>
      </p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="swipe-trigger">
            Open {side} Sheet
          </Button>
        </SheetTrigger>
        <SheetContent
          side={side}
          data-testid="swipeable-sheet"
          onPointerDown={(e) => {
            const startX = e.clientX;
            const startY = e.clientY;

            const handleMove = (moveEvent: PointerEvent) => {
              const deltaX = moveEvent.clientX - startX;
              const deltaY = moveEvent.clientY - startY;
              let progress = 0;

              switch (side) {
                case 'right': {
                  progress = Math.max(0, Math.min(100, (deltaX / 200) * 100));
                  break;
                }
                case 'left': {
                  progress = Math.max(0, Math.min(100, (-deltaX / 200) * 100));
                  break;
                }
                case 'bottom': {
                  progress = Math.max(0, Math.min(100, (deltaY / 200) * 100));
                  break;
                }
                case 'top': {
                  progress = Math.max(0, Math.min(100, (-deltaY / 200) * 100));
                  break;
                }
                // No default
              }

              setSwipeProgress(Math.round(progress));
            };

            const handleUp = () => {
              if (swipeProgress > 50) setOpen(false);
              setSwipeProgress(0);
              document.removeEventListener('pointermove', handleMove);
              document.removeEventListener('pointerup', handleUp);
            };

            document.addEventListener('pointermove', handleMove);
            document.addEventListener('pointerup', handleUp);
          }}
        >
          <SheetHeader>
            <SheetTitle>Swipeable Sheet ({side})</SheetTitle>
            <SheetDescription>
              Drag this sheet to close it. Swipe more than 50% to dismiss.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 py-8">
            <div className="text-muted-foreground text-sm">
              Try swiping or dragging this sheet to close it.
            </div>
            <div className="bg-muted h-2 w-full rounded-full">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${swipeProgress}%` }}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>
              {i18n.t('sheet.story.confirm', 'Confirm')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const SwipeGestureRight: Story = {
  name: i18n.t('sheet.storyName.swipeGestureRight', 'Swipe Gesture (Right)'),
  render: () => <SwipeableSheet side="right" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Sheet should be open by default
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="swipeable-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    expect(sheet).toBeInTheDocument();

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="swipeable-sheet"]')).not.toBeInTheDocument();
    });
  },
};

export const SwipeGestureLeft: Story = {
  name: i18n.t('sheet.storyName.swipeGestureLeft', 'Swipe Gesture (Left)'),
  render: () => <SwipeableSheet side="left" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Sheet should be open by default
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="swipeable-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    expect(sheet).toBeInTheDocument();

    // Verify ARIA attributes
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');

    // Verify left-side slide animation class
    expect(sheet.className).toContain('left-0');

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="swipeable-sheet"]')).not.toBeInTheDocument();
    });
  },
};

export const SwipeGestureTop: Story = {
  name: i18n.t('sheet.storyName.swipeGestureTop', 'Swipe Gesture (Top)'),
  render: () => <SwipeableSheet side="top" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Sheet should be open by default
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="swipeable-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    expect(sheet).toBeInTheDocument();

    // Verify ARIA attributes
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');

    // Verify top-side slide animation class
    expect(sheet.className).toContain('top-0');

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="swipeable-sheet"]')).not.toBeInTheDocument();
    });
  },
};

export const SwipeGestureBottom: Story = {
  name: i18n.t('sheet.storyName.swipeGestureBottom', 'Swipe Gesture (Bottom)'),
  render: () => <SwipeableSheet side="bottom" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Sheet should be open by default
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="swipeable-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    expect(sheet).toBeInTheDocument();

    // Verify ARIA attributes
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');

    // Verify bottom-side slide animation class
    expect(sheet.className).toContain('bottom-0');

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="swipeable-sheet"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FOCUS TRAP STORY ============

function FocusTrapComponent() {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Focus should be trapped within the sheet. Tab/Shift+Tab should cycle.
      </p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="focus-trap-trigger">
            Open Focus Trap Sheet
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="focus-trap-sheet">
          <SheetHeader>
            <SheetTitle>{i18n.t('sheet.story.focusTrapTest', 'Focus Trap Test')}</SheetTitle>
            <SheetDescription>
              Tab through the focusable elements. Focus should stay trapped.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 py-4">
            <input
              className="border-input h-9 rounded-md border px-3"
              placeholder={i18n.t('sheet.story.firstInput', 'First input')}
              data-testid="input-1"
            />
            <input
              className="border-input h-9 rounded-md border px-3"
              placeholder={i18n.t('sheet.story.secondInput', 'Second input')}
              data-testid="input-2"
            />
            <textarea
              className="border-input min-h-[80px] rounded-md border px-3 py-2"
              placeholder={i18n.t('sheet.story.textarea', 'Textarea')}
              data-testid="textarea"
            />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="btn-cancel">
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)} data-testid="btn-save">
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const FocusTrap: Story = {
  name: i18n.t('sheet.storyName.focusTrap', 'Focus Trap'),
  render: () => <FocusTrapComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="focus-trap-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    // Tab through all focusable elements multiple times
    for (let i = 0; i < 10; i++) {
      await userEvent.tab();
      expect(doc.activeElement).toBeInTheDocument();
      expect(sheet).toContainElement(doc.activeElement as HTMLElement);
    }

    // Shift+Tab multiple times
    for (let i = 0; i < 10; i++) {
      await userEvent.tab({ shift: true });
      expect(doc.activeElement).toBeInTheDocument();
      expect(sheet).toContainElement(doc.activeElement as HTMLElement);
    }
  },
};

// ============ ESCAPE KEY HANDLING STORY ============

function EscapeKeyHandlingComponent() {
  const [open, setOpen] = React.useState(true);
  const [escapeCount, setEscapeCount] = React.useState(0);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Escape key presses: <span data-testid="escape-count">{escapeCount}</span>
      </p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button>{i18n.t('sheet.story.openSheet', 'Open Sheet')}</Button>
        </SheetTrigger>
        <SheetContent onEscapeKeyDown={() => setEscapeCount((c) => c + 1)}>
          <SheetHeader>
            <SheetTitle>{i18n.t('sheet.story.escapeKeyTest', 'Escape Key Test')}</SheetTitle>
            <SheetDescription>
              Press Escape to close this sheet. The escape key count will increment.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4">
            <input
              className="border-input h-9 w-full rounded-md border px-3"
              placeholder={i18n.t('sheet.story.focusAndPressEscape', 'Focus here and press Escape')}
            />
          </div>
          <SheetFooter>
            <Button onClick={() => setOpen(false)}>{i18n.t('sheet.story.close', 'Close')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const EscapeKeyHandling: Story = {
  name: i18n.t('sheet.storyName.escapeKeyHandling', 'Escape Key Handling'),
  render: () => <EscapeKeyHandlingComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Sheet should be open by default
    const sheet = await waitFor(() => body.getByRole('dialog'));
    expect(sheet).toBeInTheDocument();

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

// ============ SIDE-SPECIFIC STORIES WITH PLAY TESTS ============

function SideSpecificSheet({ side }: { side: 'top' | 'right' | 'bottom' | 'left' }) {
  const [open, setOpen] = React.useState(false);

  const sideLabels: Record<string, string> = {
    top: 'Top',
    right: 'Right',
    bottom: 'Bottom',
    left: 'Left',
  };

  return (
    <div data-testid={`side-sheet-demo-${side}`} data-sheet-open={open ? 'true' : 'false'}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid={`trigger-${side}`}>
            Open {sideLabels[side]} Sheet
          </Button>
        </SheetTrigger>
        <SheetContent side={side} data-testid={`sheet-content-${side}`}>
          <SheetHeader>
            <SheetTitle data-testid={`sheet-title-${side}`}>
              {sideLabels[side]} Side Sheet
            </SheetTitle>
            <SheetDescription data-testid={`sheet-description-${side}`}>
              This sheet slides in from the {side} edge of the screen.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4 text-sm" data-testid={`sheet-body-${side}`}>
            <p>Content for the {side} sheet.</p>
            <p className="text-muted-foreground mt-2">
              Use the close button or press Escape to dismiss.
            </p>
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid={`btn-close-${side}`}
            />
            <Button onClick={() => setOpen(false)} data-testid={`btn-save-${side}`} />
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const SideRight: Story = {
  name: i18n.t('sheet.storyName.sideRight', 'Side: Right'),
  render: () => <SideSpecificSheet side="right" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const demoRoot = canvasElement.querySelector('[data-testid="side-sheet-demo-right"]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Sheet demo root was not found.');
    }

    const trigger = demoRoot.querySelector('[data-testid="trigger-right"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Trigger not found.');
    }

    // Open sheet
    await userEvent.click(trigger);

    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheet-content-right"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    // Verify ARIA dialog pattern
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');

    // Verify right-side positioning
    expect(sheet.className).toContain('right-0');
    expect(sheet.className).toContain('inset-y-0');

    // Verify title and description exist
    expect(doc.body.querySelector('[data-testid="sheet-title-right"]')).toBeInTheDocument();
    expect(doc.body.querySelector('[data-testid="sheet-description-right"]')).toBeInTheDocument();

    // Test keyboard navigation - Tab to buttons
    await userEvent.tab();
    expect(doc.activeElement).toBeInTheDocument();

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="sheet-content-right"]')).not.toBeInTheDocument();
    });

    // Focus should return to trigger
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });
  },
};

export const SideLeft: Story = {
  name: i18n.t('sheet.storyName.sideLeft', 'Side: Left'),
  render: () => <SideSpecificSheet side="left" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const demoRoot = canvasElement.querySelector('[data-testid="side-sheet-demo-left"]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Sheet demo root was not found.');
    }

    const trigger = demoRoot.querySelector('[data-testid="trigger-left"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Trigger not found.');
    }

    // Open sheet
    await userEvent.click(trigger);

    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheet-content-left"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    // Verify ARIA dialog pattern
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');

    // Verify left-side positioning
    expect(sheet.className).toContain('left-0');
    expect(sheet.className).toContain('inset-y-0');

    // Verify title and description exist
    expect(doc.body.querySelector('[data-testid="sheet-title-left"]')).toBeInTheDocument();
    expect(doc.body.querySelector('[data-testid="sheet-description-left"]')).toBeInTheDocument();

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="sheet-content-left"]')).not.toBeInTheDocument();
    });

    // Focus should return to trigger
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });
  },
};

export const SideTop: Story = {
  name: i18n.t('sheet.storyName.sideTop', 'Side: Top'),
  render: () => <SideSpecificSheet side="top" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const demoRoot = canvasElement.querySelector('[data-testid="side-sheet-demo-top"]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Sheet demo root was not found.');
    }

    const trigger = demoRoot.querySelector('[data-testid="trigger-top"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Trigger not found.');
    }

    // Open sheet
    await userEvent.click(trigger);

    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheet-content-top"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    // Verify ARIA dialog pattern
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');

    // Verify top-side positioning
    expect(sheet.className).toContain('top-0');
    expect(sheet.className).toContain('inset-x-0');

    // Verify title and description exist
    expect(doc.body.querySelector('[data-testid="sheet-title-top"]')).toBeInTheDocument();
    expect(doc.body.querySelector('[data-testid="sheet-description-top"]')).toBeInTheDocument();

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="sheet-content-top"]')).not.toBeInTheDocument();
    });

    // Focus should return to trigger
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });
  },
};

export const SideBottom: Story = {
  name: i18n.t('sheet.storyName.sideBottom', 'Side: Bottom'),
  render: () => <SideSpecificSheet side="bottom" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const demoRoot = canvasElement.querySelector('[data-testid="side-sheet-demo-bottom"]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Sheet demo root was not found.');
    }

    const trigger = demoRoot.querySelector('[data-testid="trigger-bottom"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Trigger not found.');
    }

    // Open sheet
    await userEvent.click(trigger);

    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheet-content-bottom"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    // Verify ARIA dialog pattern
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');

    // Verify bottom-side positioning
    expect(sheet.className).toContain('bottom-0');
    expect(sheet.className).toContain('inset-x-0');

    // Verify title and description exist
    expect(doc.body.querySelector('[data-testid="sheet-title-bottom"]')).toBeInTheDocument();
    expect(doc.body.querySelector('[data-testid="sheet-description-bottom"]')).toBeInTheDocument();

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-testid="sheet-content-bottom"]')
      ).not.toBeInTheDocument();
    });

    // Focus should return to trigger
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });
  },
};

// ============ ARIA DIALOG PATTERN STORY ============

function AriaDialogPatternComponent() {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        This story tests comprehensive ARIA dialog pattern compliance.
      </p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="aria-trigger">
            Open ARIA Sheet
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="aria-sheet">
          <SheetHeader>
            <SheetTitle id="aria-sheet-title">
              {i18n.t('sheet.story.ariaDialogPattern', 'ARIA Dialog Pattern')}
            </SheetTitle>
            <SheetDescription id="aria-sheet-description">
              {i18n.t(
                'sheet.story.ariaDialogDescription',
                'This sheet implements the ARIA dialog pattern with proper focus management.'
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 py-4">
            <label htmlFor="aria-input-1" className="text-sm font-medium">
              First Field
            </label>
            <input
              id="aria-input-1"
              className="border-input h-9 rounded-md border px-3"
              placeholder={i18n.t('sheet.story.focusableInput', 'Focusable input')}
              data-testid="aria-input-1"
            />
            <label htmlFor="aria-input-2" className="text-sm font-medium">
              Second Field
            </label>
            <input
              id="aria-input-2"
              className="border-input h-9 rounded-md border px-3"
              placeholder={i18n.t('sheet.story.anotherInput', 'Another input')}
              data-testid="aria-input-2"
            />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="aria-btn-cancel">
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)} data-testid="aria-btn-confirm">
              Confirm
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const AriaDialogPattern: Story = {
  name: i18n.t('sheet.storyName.ariaDialogPattern', 'ARIA Dialog Pattern'),
  render: () => <AriaDialogPatternComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Sheet should be open by default
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="aria-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    // 1. Verify role="dialog"
    expect(sheet.getAttribute('role')).toBe('dialog');

    // 2. Verify aria-modal="true"
    expect(sheet.getAttribute('aria-modal')).toBe('true');

    // 3. Verify overlay exists for modal behavior
    const overlay = doc.body.querySelector('[data-slot="sheet-overlay"]');
    expect(overlay).toBeInTheDocument();

    // 4. Verify title exists
    const title = doc.body.querySelector('#aria-sheet-title');
    expect(title).toBeInTheDocument();

    // 5. Verify description exists
    const description = doc.body.querySelector('#aria-sheet-description');
    expect(description).toBeInTheDocument();

    // 6. Test focus trap - focus should cycle within sheet
    const input1 = doc.body.querySelector('[data-testid="aria-input-1"]');
    const input2 = doc.body.querySelector('[data-testid="aria-input-2"]');
    const cancelBtn = doc.body.querySelector('[data-testid="aria-btn-cancel"]');
    const confirmBtn = doc.body.querySelector('[data-testid="aria-btn-confirm"]');

    expect(input1).toBeInTheDocument();
    expect(input2).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();
    expect(confirmBtn).toBeInTheDocument();

    // Tab through elements
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();

    // Focus should remain within sheet
    expect(sheet).toContainElement(doc.activeElement as HTMLElement);

    // 7. Test Escape key closes dialog
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="aria-sheet"]')).not.toBeInTheDocument();
    });

    // 8. Verify focus returns to trigger
    const trigger = canvasElement.querySelector('[data-testid="aria-trigger"]');
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });
  },
};

// ============ DARK MODE JAPANESE COMBO STORY ============

export const DarkModeJapanese: Story = {
  name: i18n.t('sheet.storyName.darkModeJapanese', 'Dark Mode + Japanese'),
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  render: () => <I18nSheetDemo defaultOpen={false} />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify dark mode
    expect(doc.documentElement.classList.contains('dark')).toBe(true);

    // Verify Japanese locale
    expect(doc.documentElement.lang).toBe('ja');

    const trigger = canvasElement.querySelector('[data-sheet-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Trigger not found.');
    }

    // Verify Japanese text
    expect(within(trigger).getByText('シートを開く')).toBeInTheDocument();

    // Open sheet
    await userEvent.click(trigger);

    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="sheet-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    expect(sheet).toBeInTheDocument();

    // Close
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ OVERLAY CLICK CLOSE STORY ============

function OverlayClickComponent() {
  const [open, setOpen] = React.useState(true);
  const [closeMethod, setCloseMethod] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Last close method: <span data-testid="close-method">{closeMethod ?? 'none'}</span>
      </p>
      <Sheet
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setCloseMethod('unknown');
          }
          setOpen(isOpen);
        }}
      >
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="overlay-trigger">
            Open Sheet
          </Button>
        </SheetTrigger>
        <SheetContent
          data-testid="overlay-sheet"
          onEscapeKeyDown={() => setCloseMethod('escape')}
          onPointerDownOutside={() => setCloseMethod('overlay-click')}
        >
          <SheetHeader>
            <SheetTitle>{i18n.t('sheet.story.overlayClickTest', 'Overlay Click Test')}</SheetTitle>
            <SheetDescription>
              Click on the overlay or press Escape to close this sheet.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4">
            <Button
              onClick={() => {
                setCloseMethod('button');
                setOpen(false);
              }}
              data-testid="close-btn"
            >
              Close via Button
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const OverlayClickClose: Story = {
  name: i18n.t('sheet.storyName.overlayClickClose', 'Overlay Click Close'),
  render: () => <OverlayClickComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Sheet should be open by default
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="overlay-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });

    expect(sheet).toBeInTheDocument();

    // Find and click overlay
    const overlay = doc.body.querySelector('[data-slot="sheet-overlay"]');
    if (!(overlay instanceof HTMLElement)) {
      throw new Error('Overlay not found.');
    }

    await userEvent.click(overlay);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="overlay-sheet"]')).not.toBeInTheDocument();
    });

    // Verify close method was overlay-click
    const closeMethodEl = canvasElement.querySelector('[data-testid="close-method"]');
    expect(closeMethodEl).toHaveTextContent('overlay-click');
  },
};

// ============ FACTORY WIRING: createFakeSheets (batch) ============

function FakeSheetsDemo() {
  const sheets = React.useMemo(() => createFakeSheets(4), []);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4" data-testid="fake-sheets-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.section.variants')}</p>
      {sheets.map((s: FakeSheet, i: number) => (
        <Sheet key={s.id} open={openIndex === i} onOpenChange={(v) => setOpenIndex(v ? i : null)}>
          <SheetTrigger asChild>
            <Button variant="outline" data-testid={`sheets-trigger-${i}`}>
              {s.triggerLabel}
            </Button>
          </SheetTrigger>
          <SheetContent side={s.side} data-testid={`sheets-content-${i}`}>
            <SheetHeader>
              <SheetTitle>{s.title}</SheetTitle>
              <SheetDescription>{s.description}</SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">{s.content}</div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpenIndex(null)}>
                {s.cancelLabel}
              </Button>
              <Button onClick={() => setOpenIndex(null)}>{s.confirmLabel}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}

export const WithFakeSheets: Story = {
  name: i18n.t('sheet.storyName.withFakeSheets', 'Factory: createFakeSheets'),
  render: () => <FakeSheetsDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="fake-sheets-demo"]');
    expect(demo).toBeInTheDocument();

    for (let i = 0; i < 4; i++) {
      expect(
        canvasElement.querySelector(`[data-testid="sheets-trigger-${i}"]`)
      ).toBeInTheDocument();
    }

    const trigger0 = canvasElement.querySelector('[data-testid="sheets-trigger-0"]') as HTMLElement;
    await userEvent.click(trigger0);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheets-content-0"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="sheets-content-0"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetFormField / createFakeSheetFormFields ============

function FormFieldsDemo() {
  const { t } = useTranslation();
  const singleField = React.useMemo(() => createFakeSheetFormField(), []);
  const fields = React.useMemo(() => createFakeSheetFormFields(3), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="form-fields-demo">
      <p className="text-muted-foreground text-sm">{t('sheet.variants.withForm')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="form-fields-trigger">
            Open Form Sheet
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="form-fields-sheet">
          <SheetHeader>
            <SheetTitle>{t('sheet.story.formFields', 'Form Fields')}</SheetTitle>
            <SheetDescription>
              Single field: {singleField.label} ({singleField.type})
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4">
            {fields.map((f: FakeSheetFormField) => (
              <div key={f.id} className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor={f.id}>
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    className="border-input min-h-[60px] rounded-md border px-3 py-2"
                    id={f.id}
                    placeholder={f.placeholder}
                    defaultValue={f.defaultValue}
                    data-testid={`field-${f.id}`}
                  />
                ) : (
                  <input
                    className="border-input h-9 rounded-md border px-3"
                    id={f.id}
                    type={f.type}
                    placeholder={f.placeholder}
                    defaultValue={f.defaultValue}
                    data-testid={`field-${f.id}`}
                  />
                )}
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('sheet.action.close')}
            </Button>
            <Button onClick={() => setOpen(false)}>{t('sheet.action.save')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithFormFields: Story = {
  name: i18n.t('sheet.storyName.withFormFields', 'Factory: FormFields'),
  render: () => <FormFieldsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="form-fields-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector(
      '[data-testid="form-fields-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="form-fields-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    const inputs = sheet.querySelectorAll('input, textarea');
    expect(inputs.length).toBeGreaterThanOrEqual(3);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="form-fields-sheet"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetNavItem / createFakeSheetNavItems ============

function NavItemsDemo() {
  const singleItem = React.useMemo(() => createFakeSheetNavItem(), []);
  const navItems = React.useMemo(() => createFakeSheetNavItems(6), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="nav-items-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.section.positions')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="nav-items-trigger">
            Open Navigation
          </Button>
        </SheetTrigger>
        <SheetContent side="left" data-testid="nav-items-sheet">
          <SheetHeader>
            <SheetTitle>{i18n.t('sheet.story.navigation', 'Navigation')}</SheetTitle>
            <SheetDescription>Single item: {singleItem.label}</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {navItems.map((item: FakeSheetNavItem) => (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm ${item.active ? 'bg-accent font-medium' : 'hover:bg-accent/50'}`}
                data-testid={`nav-item-${item.label.toLowerCase()}`}
                onClick={(e) => e.preventDefault()}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {i18n.t('sheet.action.close')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithNavItems: Story = {
  name: i18n.t('sheet.storyName.withNavItems', 'Factory: NavItems'),
  render: () => <NavItemsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="nav-items-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-testid="nav-items-trigger"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="nav-items-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    const navLinks = sheet.querySelectorAll('nav a');
    expect(navLinks.length).toBe(6);

    expect(sheet.querySelector('[data-testid="nav-item-dashboard"]')?.className).toContain(
      'font-medium'
    );

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="nav-items-sheet"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetNotification / createFakeSheetNotifications ============

function getNotificationTypeClass(type: string): string {
  if (type === 'error') return 'text-destructive';
  if (type === 'success') return 'text-green-600';
  if (type === 'warning') return 'text-yellow-600';
  return 'text-muted-foreground';
}

function NotificationsFactoryDemo() {
  const singleNotif = React.useMemo(() => createFakeSheetNotification(), []);
  const notifications = React.useMemo(() => createFakeSheetNotifications(5), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="notifications-factory-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.section.states')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="notifications-factory-trigger">
            Notifications ({notifications.length})
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="notifications-factory-sheet">
          <SheetHeader>
            <SheetTitle>{i18n.t('sheet.story.notifications', 'Notifications')}</SheetTitle>
            <SheetDescription>Latest: {singleNotif.title}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            {notifications.map((n: FakeSheetNotification) => (
              <div
                key={n.id}
                className={`rounded-md border p-3 ${n.read ? 'opacity-60' : ''}`}
                data-testid={`nf-notif-${n.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className={`text-xs ${getNotificationTypeClass(n.type)}`}>{n.type}</span>
                </div>
                <p className="text-muted-foreground text-xs">{n.message}</p>
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {i18n.t('sheet.action.close')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithNotificationsFactory: Story = {
  name: i18n.t('sheet.storyName.withNotificationsFactory', 'Factory: Notifications'),
  render: () => <NotificationsFactoryDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="notifications-factory-demo"]')
    ).toBeInTheDocument();

    const trigger = canvasElement.querySelector(
      '[data-testid="notifications-factory-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="notifications-factory-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    const notifItems = sheet.querySelectorAll('[data-testid^="nf-notif-"]');
    expect(notifItems.length).toBe(5);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-testid="notifications-factory-sheet"]')
      ).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetCartItem / createFakeSheetCartItems ============

function CartItemsDemo() {
  const singleItem = React.useMemo(() => createFakeSheetCartItem(), []);
  const cartItems = React.useMemo(() => createFakeSheetCartItems(4), []);
  const total = React.useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="cart-items-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.section.variants')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="cart-items-trigger">
            Cart ({cartItems.length} items)
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="cart-items-sheet">
          <SheetHeader>
            <SheetTitle>{i18n.t('sheet.story.shoppingCart', 'Shopping Cart')}</SheetTitle>
            <SheetDescription>Latest item: {singleItem.name}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4">
            {cartItems.map((item: FakeSheetCartItem) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border p-3"
                data-testid={`ci-item-${item.id}`}
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-muted-foreground text-xs">Qty: {item.quantity}</p>
                </div>
                <span className="text-sm font-medium">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t pt-3">
              <div className="flex justify-between">
                <span className="font-medium">{i18n.t('sheet.story.total', 'Total')}</span>
                <span className="font-medium" data-testid="ci-total">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {i18n.t('sheet.action.close')}
            </Button>
            <Button onClick={() => setOpen(false)}>{i18n.t('sheet.action.save')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithCartItems: Story = {
  name: i18n.t('sheet.storyName.withCartItems', 'Factory: CartItems'),
  render: () => <CartItemsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="cart-items-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector(
      '[data-testid="cart-items-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="cart-items-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    const items = sheet.querySelectorAll('[data-testid^="ci-item-"]');
    expect(items.length).toBe(4);

    expect(sheet.querySelector('[data-testid="ci-total"]')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="cart-items-sheet"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetWithForm ============

function SheetWithFormDemo() {
  const formSheet = React.useMemo(() => createFakeSheetWithForm(4), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="sheet-with-form-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.variants.withForm')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="sheet-with-form-trigger">
            {formSheet.triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent side={formSheet.side} data-testid="sheet-with-form-content">
          <SheetHeader>
            <SheetTitle>{formSheet.title}</SheetTitle>
            <SheetDescription>{formSheet.description}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4">
            {formSheet.fields.map((f: FakeSheetFormField) => (
              <div key={f.id} className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor={`form-${f.id}`}>
                  {f.label}
                </label>
                <input
                  className="border-input h-9 rounded-md border px-3"
                  id={`form-${f.id}`}
                  type={f.type === 'textarea' ? 'text' : f.type}
                  placeholder={f.placeholder}
                  defaultValue={f.defaultValue}
                  data-testid={`swf-field-${f.id}`}
                />
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {formSheet.cancelLabel}
            </Button>
            <Button onClick={() => setOpen(false)}>{formSheet.confirmLabel}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithFormSheet: Story = {
  name: i18n.t('sheet.storyName.withFormSheet', 'Factory: SheetWithForm'),
  render: () => <SheetWithFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="sheet-with-form-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector(
      '[data-testid="sheet-with-form-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheet-with-form-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    const formFields = sheet.querySelectorAll('[data-testid^="swf-field-"]');
    expect(formFields.length).toBe(4);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-testid="sheet-with-form-content"]')
      ).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetWithNavigation ============

function SheetWithNavigationDemo() {
  const navSheet = React.useMemo(() => createFakeSheetWithNavigation(5), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="sheet-with-nav-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.section.positions')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="sheet-with-nav-trigger">
            {navSheet.triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent side={navSheet.side} data-testid="sheet-with-nav-content">
          <SheetHeader>
            <SheetTitle>{navSheet.title}</SheetTitle>
            <SheetDescription>{navSheet.description}</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {navSheet.items.map((item: FakeSheetNavItem) => (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm ${item.active ? 'bg-accent font-medium' : ''}`}
                onClick={(e) => e.preventDefault()}
                data-testid={`swn-item-${item.label.toLowerCase()}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {navSheet.cancelLabel}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithNavigationSheet: Story = {
  name: i18n.t('sheet.storyName.withNavigationSheet', 'Factory: SheetWithNavigation'),
  render: () => <SheetWithNavigationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="sheet-with-nav-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector(
      '[data-testid="sheet-with-nav-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheet-with-nav-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    const links = sheet.querySelectorAll('nav a');
    expect(links.length).toBe(5);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-testid="sheet-with-nav-content"]')
      ).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetWithFilters ============

function SheetWithFiltersDemo() {
  const filtersSheet = React.useMemo(() => createFakeSheetWithFilters(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="sheet-with-filters-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.section.variants')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="sheet-with-filters-trigger">
            {filtersSheet.triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent side={filtersSheet.side} data-testid="sheet-with-filters-content">
          <SheetHeader>
            <SheetTitle>{filtersSheet.title}</SheetTitle>
            <SheetDescription>{filtersSheet.description}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            {filtersSheet.sections.map((section: FakeSheetFilterSection, si: number) => (
              <div key={section.title} data-testid={`fs-section-${si}`}>
                <h4 className="mb-2 text-sm font-medium">{section.title}</h4>
                <div className="flex flex-col gap-1">
                  {section.options.map((opt: FakeSheetFilterOption) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" defaultChecked={opt.checked} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {filtersSheet.cancelLabel}
            </Button>
            <Button onClick={() => setOpen(false)}>{filtersSheet.confirmLabel}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithFiltersSheet: Story = {
  name: i18n.t('sheet.storyName.withFiltersSheet', 'Factory: SheetWithFilters'),
  render: () => <SheetWithFiltersDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="sheet-with-filters-demo"]')
    ).toBeInTheDocument();

    const trigger = canvasElement.querySelector(
      '[data-testid="sheet-with-filters-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheet-with-filters-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    expect(sheet.querySelectorAll('[data-testid^="fs-section-"]').length).toBe(3);

    const checkboxes = sheet.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(3);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-testid="sheet-with-filters-content"]')
      ).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetWithNotifications ============

function SheetWithNotificationsDemo() {
  const notifSheet = React.useMemo(() => createFakeSheetWithNotifications(4), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="sheet-with-notif-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.section.states')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="sheet-with-notif-trigger">
            {notifSheet.triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent side={notifSheet.side} data-testid="sheet-with-notif-content">
          <SheetHeader>
            <SheetTitle>{notifSheet.title}</SheetTitle>
            <SheetDescription>{notifSheet.description}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            {notifSheet.notifications.map((n: FakeSheetNotification) => (
              <div
                key={n.id}
                className={`rounded-md border p-2 text-sm ${n.read ? 'opacity-50' : ''}`}
                data-testid={`swn-notif-${n.id}`}
              >
                <strong>{n.title}</strong>
                <p className="text-muted-foreground text-xs">{n.message}</p>
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {notifSheet.cancelLabel}
            </Button>
            <Button onClick={() => setOpen(false)}>{notifSheet.confirmLabel}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithNotificationsSheet: Story = {
  name: i18n.t('sheet.storyName.withNotificationsSheet', 'Factory: SheetWithNotifications'),
  render: () => <SheetWithNotificationsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="sheet-with-notif-demo"]')
    ).toBeInTheDocument();

    const trigger = canvasElement.querySelector(
      '[data-testid="sheet-with-notif-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheet-with-notif-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    const items = sheet.querySelectorAll('[data-testid^="swn-notif-"]');
    expect(items.length).toBe(4);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-testid="sheet-with-notif-content"]')
      ).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetWithCart ============

function SheetWithCartDemo() {
  const cartSheet = React.useMemo(() => createFakeSheetWithCart(3), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="sheet-with-cart-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.section.variants')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="sheet-with-cart-trigger">
            {cartSheet.triggerLabel}
          </Button>
        </SheetTrigger>
        <SheetContent side={cartSheet.side} data-testid="sheet-with-cart-content">
          <SheetHeader>
            <SheetTitle>{cartSheet.title}</SheetTitle>
            <SheetDescription>{cartSheet.description}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            {cartSheet.cartItems.map((item: FakeSheetCartItem) => (
              <div
                key={item.id}
                className="flex justify-between border-b pb-2"
                data-testid={`swc-item-${item.id}`}
              >
                <span className="text-sm">
                  {item.name} x{item.quantity}
                </span>
                <span className="text-sm font-medium">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-medium">
              <span>{i18n.t('sheet.story.total', 'Total')}</span>
              <span data-testid="swc-total">${cartSheet.total.toFixed(2)}</span>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {cartSheet.cancelLabel}
            </Button>
            <Button onClick={() => setOpen(false)}>{cartSheet.confirmLabel}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithCartSheet: Story = {
  name: i18n.t('sheet.storyName.withCartSheet', 'Factory: SheetWithCart'),
  render: () => <SheetWithCartDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="sheet-with-cart-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector(
      '[data-testid="sheet-with-cart-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sheet-with-cart-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    expect(sheet.querySelectorAll('[data-testid^="swc-item-"]').length).toBe(3);
    expect(sheet.querySelector('[data-testid="swc-total"]')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-testid="sheet-with-cart-content"]')
      ).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: Side factories ============

function SideFactoriesDemo() {
  const { t } = useTranslation();
  const rightSheet = React.useMemo(() => createFakeRightSheet(), []);
  const leftSheet = React.useMemo(() => createFakeLeftSheet(), []);
  const topSheet = React.useMemo(() => createFakeTopSheet(), []);
  const bottomSheet = React.useMemo(() => createFakeBottomSheet(), []);
  const [openSide, setOpenSide] = React.useState<string | null>(null);

  const allSheets = [
    { key: 'right', data: rightSheet },
    { key: 'left', data: leftSheet },
    { key: 'top', data: topSheet },
    { key: 'bottom', data: bottomSheet },
  ];

  return (
    <div className="flex flex-wrap gap-3" data-testid="side-factories-demo">
      <p className="text-muted-foreground w-full text-sm">{t('sheet.section.positions')}</p>
      {allSheets.map(({ key, data }) => (
        <Sheet key={key} open={openSide === key} onOpenChange={(v) => setOpenSide(v ? key : null)}>
          <SheetTrigger asChild>
            <Button variant="outline" data-testid={`sf-trigger-${key}`}>
              {data.side} ({data.title})
            </Button>
          </SheetTrigger>
          <SheetContent side={data.side as SheetSide} data-testid={`sf-content-${key}`}>
            <SheetHeader>
              <SheetTitle>{data.title}</SheetTitle>
              <SheetDescription>{data.description}</SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">{data.content}</div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpenSide(null)}>
                {data.cancelLabel}
              </Button>
              <Button onClick={() => setOpenSide(null)}>{data.confirmLabel}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}

export const WithSideFactories: Story = {
  name: i18n.t('sheet.storyName.withSideFactories', 'Factory: Side Factories'),
  render: () => <SideFactoriesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="side-factories-demo"]')).toBeInTheDocument();

    for (const side of ['right', 'left', 'top', 'bottom']) {
      expect(canvasElement.querySelector(`[data-testid="sf-trigger-${side}"]`)).toBeInTheDocument();
    }

    const trigger = canvasElement.querySelector('[data-testid="sf-trigger-right"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sf-content-right"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="sf-content-right"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: Size factories ============

function SizeFactoriesDemo() {
  const { t } = useTranslation();
  const smallSheet = React.useMemo(() => createFakeSmallSheet(), []);
  const largeSheet = React.useMemo(() => createFakeLargeSheet(), []);
  const fullSheet = React.useMemo(() => createFakeFullSheet(), []);
  const [openSize, setOpenSize] = React.useState<string | null>(null);

  const allSheets = [
    { key: 'small', data: smallSheet, sizeClass: SIZE_CLASSES_HORIZONTAL[smallSheet.size] },
    { key: 'large', data: largeSheet, sizeClass: SIZE_CLASSES_HORIZONTAL[largeSheet.size] },
    { key: 'full', data: fullSheet, sizeClass: SIZE_CLASSES_HORIZONTAL[fullSheet.size] },
  ];

  return (
    <div className="flex flex-wrap gap-3" data-testid="size-factories-demo">
      <p className="text-muted-foreground w-full text-sm">{t('sheet.section.sizes')}</p>
      {allSheets.map(({ key, data, sizeClass }) => (
        <Sheet key={key} open={openSize === key} onOpenChange={(v) => setOpenSize(v ? key : null)}>
          <SheetTrigger asChild>
            <Button variant="outline" data-testid={`szf-trigger-${key}`}>
              {data.size} sheet
            </Button>
          </SheetTrigger>
          <SheetContent className={sizeClass} data-testid={`szf-content-${key}`}>
            <SheetHeader>
              <SheetTitle>{data.title}</SheetTitle>
              <SheetDescription>Size: {data.size}</SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">{data.content}</div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpenSize(null)}>
                {data.cancelLabel}
              </Button>
              <Button onClick={() => setOpenSize(null)}>{data.confirmLabel}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}

export const WithSizeFactories: Story = {
  name: i18n.t('sheet.storyName.withSizeFactories', 'Factory: Size Factories'),
  render: () => <SizeFactoriesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="size-factories-demo"]')).toBeInTheDocument();

    for (const size of ['small', 'large', 'full']) {
      expect(
        canvasElement.querySelector(`[data-testid="szf-trigger-${size}"]`)
      ).toBeInTheDocument();
    }

    const trigger = canvasElement.querySelector('[data-testid="szf-trigger-small"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="szf-content-small"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="szf-content-small"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createSheetSideMatrix ============

function SideMatrixDemo() {
  const { t } = useTranslation();
  const sideMatrix = React.useMemo(() => createSheetSideMatrix(), []);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="flex flex-wrap gap-3" data-testid="side-matrix-demo">
      <p className="text-muted-foreground w-full text-sm">{t('sheet.section.positions')}</p>
      {sideMatrix.map((s: FakeSheet, i: number) => (
        <Sheet key={s.id} open={openIndex === i} onOpenChange={(v) => setOpenIndex(v ? i : null)}>
          <SheetTrigger asChild>
            <Button variant="outline" data-testid={`sm-trigger-${i}`}>
              {s.title}
            </Button>
          </SheetTrigger>
          <SheetContent side={s.side} data-testid={`sm-content-${i}`}>
            <SheetHeader>
              <SheetTitle>{s.title}</SheetTitle>
              <SheetDescription>Side: {s.side}</SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">{s.content}</div>
            <SheetFooter>
              <Button onClick={() => setOpenIndex(null)}>{s.confirmLabel}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}

export const WithSideMatrix: Story = {
  name: i18n.t('sheet.storyName.withSideMatrix', 'Factory: SideMatrix'),
  render: () => <SideMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="side-matrix-demo"]')).toBeInTheDocument();

    for (let i = 0; i < 4; i++) {
      expect(canvasElement.querySelector(`[data-testid="sm-trigger-${i}"]`)).toBeInTheDocument();
    }

    const trigger = canvasElement.querySelector('[data-testid="sm-trigger-0"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sm-content-0"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="sm-content-0"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createSheetSizeMatrix ============

function SizeMatrixDemo() {
  const sizeMatrix = React.useMemo(() => createSheetSizeMatrix(), []);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="flex flex-wrap gap-3" data-testid="size-matrix-demo">
      <p className="text-muted-foreground w-full text-sm">{i18n.t('sheet.section.sizes')}</p>
      {sizeMatrix.map((s: FakeSheet, i: number) => (
        <Sheet key={s.id} open={openIndex === i} onOpenChange={(v) => setOpenIndex(v ? i : null)}>
          <SheetTrigger asChild>
            <Button variant="outline" data-testid={`szm-trigger-${i}`}>
              {s.title}
            </Button>
          </SheetTrigger>
          <SheetContent
            className={SIZE_CLASSES_HORIZONTAL[s.size]}
            data-testid={`szm-content-${i}`}
          >
            <SheetHeader>
              <SheetTitle>{s.title}</SheetTitle>
              <SheetDescription>Size: {s.size}</SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">{s.content}</div>
            <SheetFooter>
              <Button onClick={() => setOpenIndex(null)}>{s.confirmLabel}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}

export const WithSizeMatrix: Story = {
  name: i18n.t('sheet.storyName.withSizeMatrix', 'Factory: SizeMatrix'),
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="size-matrix-demo"]')).toBeInTheDocument();

    for (let i = 0; i < 5; i++) {
      expect(canvasElement.querySelector(`[data-testid="szm-trigger-${i}"]`)).toBeInTheDocument();
    }

    const trigger = canvasElement.querySelector('[data-testid="szm-trigger-0"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="szm-content-0"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="szm-content-0"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createSheetContentTypeMatrix ============

function ContentTypeMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createSheetContentTypeMatrix(), []);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const contentTypeLabels = [
    i18n.t('sheet.story.form', 'Form'),
    i18n.t('sheet.story.navigation', 'Navigation'),
    i18n.t('sheet.story.filters', 'Filters'),
    i18n.t('sheet.story.notifications', 'Notifications'),
    i18n.t('sheet.story.cart', 'Cart'),
  ];

  return (
    <div className="flex flex-wrap gap-3" data-testid="ct-matrix-demo">
      <p className="text-muted-foreground w-full text-sm">{t('sheet.section.variants')}</p>
      {matrix.map((s, i: number) => (
        <Sheet key={s.id} open={openIndex === i} onOpenChange={(v) => setOpenIndex(v ? i : null)}>
          <SheetTrigger asChild>
            <Button variant="outline" data-testid={`ct-trigger-${i}`}>
              {contentTypeLabels[i]}
            </Button>
          </SheetTrigger>
          <SheetContent data-testid={`ct-content-${i}`}>
            <SheetHeader>
              <SheetTitle>{s.title}</SheetTitle>
              <SheetDescription>{s.description}</SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">{s.content}</div>
            <SheetFooter>
              <Button onClick={() => setOpenIndex(null)}>{s.confirmLabel}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}

export const WithContentTypeMatrix: Story = {
  name: i18n.t('sheet.storyName.withContentTypeMatrix', 'Factory: ContentTypeMatrix'),
  render: () => <ContentTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="ct-matrix-demo"]')).toBeInTheDocument();

    for (let i = 0; i < 5; i++) {
      expect(canvasElement.querySelector(`[data-testid="ct-trigger-${i}"]`)).toBeInTheDocument();
    }

    const trigger = canvasElement.querySelector('[data-testid="ct-trigger-0"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="ct-content-0"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="ct-content-0"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createSheetShowcase ============

function ShowcaseDemo() {
  const showcase = React.useMemo(() => createSheetShowcase(), []);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="flex flex-wrap gap-3" data-testid="showcase-demo">
      <p className="text-muted-foreground w-full text-sm">{i18n.t('sheet.story.description')}</p>
      {showcase.map((item, i: number) => (
        <Sheet
          key={item.name}
          open={openIndex === i}
          onOpenChange={(v) => setOpenIndex(v ? i : null)}
        >
          <SheetTrigger asChild>
            <Button variant="outline" data-testid={`sc-trigger-${i}`}>
              {item.name}
            </Button>
          </SheetTrigger>
          <SheetContent side={item.sheet.side} data-testid={`sc-content-${i}`}>
            <SheetHeader>
              <SheetTitle>{item.sheet.title}</SheetTitle>
              <SheetDescription>{item.description}</SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">{item.sheet.content}</div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpenIndex(null)}>
                {item.sheet.cancelLabel}
              </Button>
              <Button onClick={() => setOpenIndex(null)}>{item.sheet.confirmLabel}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}

export const WithShowcase: Story = {
  name: i18n.t('sheet.storyName.withShowcase', 'Factory: Showcase'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="showcase-demo"]')).toBeInTheDocument();

    for (let i = 0; i < 11; i++) {
      expect(canvasElement.querySelector(`[data-testid="sc-trigger-${i}"]`)).toBeInTheDocument();
    }

    const trigger = canvasElement.querySelector('[data-testid="sc-trigger-0"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="sc-content-0"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="sc-content-0"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createSheetTestData ============

function TestDataDemo() {
  const testData = React.useMemo(() => createSheetTestData(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="test-data-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.story.playground')}</p>
      <div className="grid grid-cols-2 gap-2 text-xs" data-testid="test-data-summary">
        <span>Sheets: {testData.sheets.length}</span>
        <span>Form fields: {testData.formFields.length}</span>
        <span>Nav items: {testData.navItems.length}</span>
        <span>Notifications: {testData.notifications.length}</span>
        <span>Cart items: {testData.cartItems.length}</span>
        <span>Side matrix: {testData.sideMatrix.length}</span>
        <span>Size matrix: {testData.sizeMatrix.length}</span>
        <span>Content types: {testData.contentTypeMatrix.length}</span>
        <span>Showcase: {testData.showcase.length}</span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="test-data-trigger">
            Open Test Data Sheet
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="test-data-sheet">
          <SheetHeader>
            <SheetTitle>{testData.basicSheet.title}</SheetTitle>
            <SheetDescription>{testData.basicSheet.description}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 text-xs">
            <p>Basic: {testData.basicSheet.title}</p>
            <p>Right: {testData.rightSheet.title}</p>
            <p>Left: {testData.leftSheet.title}</p>
            <p>Top: {testData.topSheet.title}</p>
            <p>Bottom: {testData.bottomSheet.title}</p>
            <p>Small: {testData.smallSheet.title}</p>
            <p>Large: {testData.largeSheet.title}</p>
            <p>Full: {testData.fullSheet.title}</p>
            <p>Form: {testData.formSheet.title}</p>
            <p>Nav: {testData.navigationSheet.title}</p>
            <p>Filters: {testData.filtersSheet.title}</p>
            <p>Notif: {testData.notificationsSheet.title}</p>
            <p>
              Cart: {testData.cartSheet.title} (${testData.cartSheet.total})
            </p>
          </div>
          <SheetFooter>
            <Button onClick={() => setOpen(false)}>{i18n.t('sheet.action.close')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithTestData: Story = {
  name: i18n.t('sheet.storyName.withTestData', 'Factory: TestData'),
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="test-data-demo"]')).toBeInTheDocument();

    const summary = canvasElement.querySelector('[data-testid="test-data-summary"]');
    expect(summary).toBeInTheDocument();
    expect(summary!.textContent).toContain('Sheets: 5');
    expect(summary!.textContent).toContain('Form fields: 5');
    expect(summary!.textContent).toContain('Nav items: 7');

    const trigger = canvasElement.querySelector('[data-testid="test-data-trigger"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="test-data-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="test-data-sheet"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetAriaConfig ============

function AriaConfigDemo() {
  const { t } = useTranslation();
  const ariaConfig = React.useMemo(() => createFakeSheetAriaConfig(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="aria-config-demo">
      <p className="text-muted-foreground text-sm">{t('sheet.a11y.label')}</p>
      <div className="text-xs" data-testid="aria-config-info">
        <p>Role: {ariaConfig.role}</p>
        <p>Modal: {String(ariaConfig.ariaModal)}</p>
        <p>Title ID: {ariaConfig.titleId}</p>
        <p>Description ID: {ariaConfig.descriptionId}</p>
        <p>Restore focus: {String(ariaConfig.restoreFocus)}</p>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="aria-config-trigger">
            {t('sheet.a11y.triggerLabel')}
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="aria-config-sheet">
          <SheetHeader>
            <SheetTitle id={ariaConfig.titleId}>
              {t('sheet.story.ariaConfigSheet', 'ARIA Config Sheet')}
            </SheetTitle>
            <SheetDescription id={ariaConfig.descriptionId}>
              Role: {ariaConfig.role}, Modal: {String(ariaConfig.ariaModal)}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 text-sm">{t('sheet.a11y.contentLabel')}</div>
          <SheetFooter>
            <Button onClick={() => setOpen(false)}>{t('sheet.a11y.closeLabel')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithAriaConfig: Story = {
  name: i18n.t('sheet.storyName.withAriaConfig', 'Factory: AriaConfig'),
  render: () => <AriaConfigDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="aria-config-demo"]')).toBeInTheDocument();

    const info = canvasElement.querySelector('[data-testid="aria-config-info"]');
    expect(info).toBeInTheDocument();
    expect(info!.textContent).toContain('Role: dialog');
    expect(info!.textContent).toContain('Modal: true');

    const trigger = canvasElement.querySelector(
      '[data-testid="aria-config-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="aria-config-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="aria-config-sheet"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetAnimationConfig ============

function AnimationConfigDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(
    () =>
      SHEET_SIDES.map((side) => ({
        side,
        config: createFakeSheetAnimationConfig(side),
      })),
    []
  );

  return (
    <div className="flex flex-col gap-4" data-testid="animation-config-demo">
      <p className="text-muted-foreground text-sm">{t('sheet.story.description')}</p>
      <div className="grid grid-cols-2 gap-2 text-xs" data-testid="animation-configs">
        {configs.map(({ side, config }) => (
          <div key={side} className="rounded-md border p-2" data-testid={`anim-${side}`}>
            <p className="font-medium">{side}</p>
            <p>Slide: {config.slideType}</p>
            <p>{i18n.t('sheet.story.openMs', { duration: config.openDuration })}</p>
            <p>{i18n.t('sheet.story.closeMs', { duration: config.closeDuration })}</p>
            <p>Easing: {config.easing}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const WithAnimationConfig: Story = {
  name: i18n.t('sheet.storyName.withAnimationConfig', 'Factory: AnimationConfig'),
  render: () => <AnimationConfigDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="animation-config-demo"]')
    ).toBeInTheDocument();

    for (const side of ['right', 'left', 'top', 'bottom']) {
      const card = canvasElement.querySelector(`[data-testid="anim-${side}"]`);
      expect(card).toBeInTheDocument();
      expect(card!.textContent).toContain(`slide-in-from-${side}`);
    }

    const rightCard = canvasElement.querySelector('[data-testid="anim-right"]');
    expect(rightCard!.textContent).toContain('500ms');
    expect(rightCard!.textContent).toContain('300ms');
    expect(rightCard!.textContent).toContain('ease-in-out');
  },
};

// ============ FACTORY WIRING: createFakeSheetOverlayConfig ============

function OverlayConfigDemo() {
  const overlayConfig = React.useMemo(() => createFakeSheetOverlayConfig(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="overlay-config-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.story.description')}</p>
      <div className="text-xs" data-testid="overlay-config-info">
        <p>Opacity: {overlayConfig.backgroundOpacity}%</p>
        <p>Close on click: {String(overlayConfig.closeOnClick)}</p>
        <p>Close on escape: {String(overlayConfig.closeOnEscape)}</p>
        <p>Has blur: {String(overlayConfig.hasBlur)}</p>
        <p>Z-index: {overlayConfig.zIndex}</p>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="overlay-config-trigger">
            Open Overlay Demo
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="overlay-config-sheet">
          <SheetHeader>
            <SheetTitle>{i18n.t('sheet.story.overlayConfig', 'Overlay Config')}</SheetTitle>
            <SheetDescription>
              Opacity: {overlayConfig.backgroundOpacity}%, Z-index: {overlayConfig.zIndex}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 text-sm">Close on click: {String(overlayConfig.closeOnClick)}</div>
          <SheetFooter>
            <Button onClick={() => setOpen(false)}>{i18n.t('sheet.action.close')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithOverlayConfig: Story = {
  name: i18n.t('sheet.storyName.withOverlayConfig', 'Factory: OverlayConfig'),
  render: () => <OverlayConfigDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="overlay-config-demo"]')).toBeInTheDocument();

    const info = canvasElement.querySelector('[data-testid="overlay-config-info"]');
    expect(info).toBeInTheDocument();
    expect(info!.textContent).toContain('Opacity: 50%');
    expect(info!.textContent).toContain('Close on click: true');
    expect(info!.textContent).toContain('Z-index: 50');

    const trigger = canvasElement.querySelector(
      '[data-testid="overlay-config-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="overlay-config-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-testid="overlay-config-sheet"]')
      ).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetFocusableElements ============

function FocusableElementsDemo() {
  const { t } = useTranslation();
  const elements = React.useMemo(() => createFakeSheetFocusableElements(5), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="focusable-elements-demo">
      <p className="text-muted-foreground text-sm">{t('sheet.story.keyboard')}</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="focusable-trigger">
            Open Focusable Elements Sheet
          </Button>
        </SheetTrigger>
        <SheetContent data-testid="focusable-sheet">
          <SheetHeader>
            <SheetTitle>{t('sheet.story.focusableElements', 'Focusable Elements')}</SheetTitle>
            <SheetDescription>{elements.length} focusable elements</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4">
            {elements.map((el: SheetFocusableElement) => {
              if (el.element === 'textarea') {
                return (
                  <textarea
                    key={el.testId}
                    className="border-input min-h-[60px] rounded-md border px-3 py-2"
                    placeholder={el.label}
                    data-testid={el.testId}
                    tabIndex={el.tabIndex}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional for focus management testing
                    autoFocus={el.autoFocus}
                  />
                );
              }
              if (el.element === 'button') {
                return (
                  <Button
                    key={el.testId}
                    variant="outline"
                    data-testid={el.testId}
                    tabIndex={el.tabIndex}
                  >
                    {el.label}
                  </Button>
                );
              }
              return (
                <input
                  key={el.testId}
                  className="border-input h-9 rounded-md border px-3"
                  placeholder={el.label}
                  data-testid={el.testId}
                  tabIndex={el.tabIndex}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional for focus management testing
                  autoFocus={el.autoFocus}
                />
              );
            })}
          </div>
          <SheetFooter>
            <Button onClick={() => setOpen(false)}>{t('sheet.action.close')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithFocusableElements: Story = {
  name: i18n.t('sheet.storyName.withFocusableElements', 'Factory: FocusableElements'),
  render: () => <FocusableElementsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="focusable-elements-demo"]')
    ).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-testid="focusable-trigger"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="focusable-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    for (let i = 1; i <= 5; i++) {
      expect(sheet.querySelector(`[data-testid="focus-element-${i}"]`)).toBeInTheDocument();
    }

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="focusable-sheet"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createFakeSheetDarkModeConfig ============

function DarkModeConfigDemo() {
  const { t } = useTranslation();
  const lightConfig = React.useMemo(() => createFakeSheetDarkModeConfig(false), []);
  const darkConfig = React.useMemo(() => createFakeSheetDarkModeConfig(true), []);

  return (
    <div className="flex flex-col gap-4" data-testid="dark-mode-config-demo">
      <p className="text-muted-foreground text-sm">{t('sheet.story.darkMode')}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border p-3" data-testid="light-config">
          <h4 className="mb-2 text-sm font-medium">{t('sheet.story.lightMode', 'Light Mode')}</h4>
          <p className="text-xs">Enabled: {String(lightConfig.enabled)}</p>
          <p className="text-xs">BG: {lightConfig.backgroundColor}</p>
          <p className="text-xs">Text: {lightConfig.textColor}</p>
          <p className="text-xs">Border: {lightConfig.borderColor}</p>
          <p className="text-xs">Overlay: {lightConfig.overlayColor}</p>
        </div>
        <div className="rounded-md border p-3" data-testid="dark-config">
          <h4 className="mb-2 text-sm font-medium">{t('sheet.story.darkMode', 'Dark Mode')}</h4>
          <p className="text-xs">Enabled: {String(darkConfig.enabled)}</p>
          <p className="text-xs">BG: {darkConfig.backgroundColor}</p>
          <p className="text-xs">Text: {darkConfig.textColor}</p>
          <p className="text-xs">Border: {darkConfig.borderColor}</p>
          <p className="text-xs">Overlay: {darkConfig.overlayColor}</p>
        </div>
      </div>
    </div>
  );
}

export const WithDarkModeConfig: Story = {
  name: i18n.t('sheet.storyName.withDarkModeConfig', 'Factory: DarkModeConfig'),
  render: () => <DarkModeConfigDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="dark-mode-config-demo"]')
    ).toBeInTheDocument();

    const lightConfig = canvasElement.querySelector('[data-testid="light-config"]');
    expect(lightConfig).toBeInTheDocument();
    expect(lightConfig!.textContent).toContain('Enabled: false');
    expect(lightConfig!.textContent).toContain('white');

    const darkConfig = canvasElement.querySelector('[data-testid="dark-config"]');
    expect(darkConfig).toBeInTheDocument();
    expect(darkConfig!.textContent).toContain('Enabled: true');
    expect(darkConfig!.textContent).toContain('hsl(var(--background))');
  },
};

// ============ FACTORY WIRING: createComprehensiveSheetConfig ============

function ComprehensiveConfigDemo() {
  const config = React.useMemo(() => createComprehensiveSheetConfig('right', false), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4" data-testid="comprehensive-config-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.story.playground')}</p>
      <div className="grid grid-cols-2 gap-2 text-xs" data-testid="comprehensive-info">
        <span>Base side: {config.base.side}</span>
        <span>ARIA role: {config.aria.role}</span>
        <span>Animation: {config.animation.slideType}</span>
        <span>Overlay opacity: {config.overlay.backgroundOpacity}%</span>
        <span>Focusable: {config.focusableElements.length}</span>
        <span>Dark mode: {String(config.darkMode.enabled)}</span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="comprehensive-trigger">
            Open Comprehensive Sheet
          </Button>
        </SheetTrigger>
        <SheetContent side={config.base.side} data-testid="comprehensive-sheet">
          <SheetHeader>
            <SheetTitle id={config.aria.titleId}>{config.base.title}</SheetTitle>
            <SheetDescription id={config.aria.descriptionId}>
              {config.base.description}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 text-xs">
            <p>Slide type: {config.animation.slideType}</p>
            <p>
              {i18n.t('sheet.story.openDurationMs', { duration: config.animation.openDuration })}
            </p>
            <p>Close on click: {String(config.overlay.closeOnClick)}</p>
            <p>Focusable elements: {config.focusableElements.length}</p>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {config.base.cancelLabel}
            </Button>
            <Button onClick={() => setOpen(false)}>{config.base.confirmLabel}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const WithComprehensiveConfig: Story = {
  name: i18n.t('sheet.storyName.withComprehensiveConfig', 'Factory: ComprehensiveConfig'),
  render: () => <ComprehensiveConfigDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="comprehensive-config-demo"]')
    ).toBeInTheDocument();

    const info = canvasElement.querySelector('[data-testid="comprehensive-info"]');
    expect(info).toBeInTheDocument();
    expect(info!.textContent).toContain('Base side: right');
    expect(info!.textContent).toContain('ARIA role: dialog');

    const trigger = canvasElement.querySelector(
      '[data-testid="comprehensive-trigger"]'
    ) as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="comprehensive-sheet"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="comprehensive-sheet"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: createComprehensiveSheetConfigMatrix ============

function ComprehensiveMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createComprehensiveSheetConfigMatrix(false), []);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="flex flex-wrap gap-3" data-testid="comprehensive-matrix-demo">
      <p className="text-muted-foreground w-full text-sm">{t('sheet.section.positions')}</p>
      {matrix.map((config: ComprehensiveSheetConfig, i: number) => (
        <Sheet
          key={config.base.id}
          open={openIndex === i}
          onOpenChange={(v) => setOpenIndex(v ? i : null)}
        >
          <SheetTrigger asChild>
            <Button variant="outline" data-testid={`cm-trigger-${i}`}>
              {config.base.side}: {config.animation.slideType}
            </Button>
          </SheetTrigger>
          <SheetContent side={config.base.side} data-testid={`cm-content-${i}`}>
            <SheetHeader>
              <SheetTitle>{config.base.title}</SheetTitle>
              <SheetDescription>
                Animation: {config.animation.slideType} | Overlay:{' '}
                {config.overlay.backgroundOpacity}%
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 text-sm">{config.base.content}</div>
            <SheetFooter>
              <Button onClick={() => setOpenIndex(null)}>{config.base.confirmLabel}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}

export const WithComprehensiveMatrix: Story = {
  name: i18n.t('sheet.storyName.withComprehensiveMatrix', 'Factory: ComprehensiveMatrix'),
  render: () => <ComprehensiveMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="comprehensive-matrix-demo"]')
    ).toBeInTheDocument();

    for (let i = 0; i < 4; i++) {
      expect(canvasElement.querySelector(`[data-testid="cm-trigger-${i}"]`)).toBeInTheDocument();
    }

    const trigger = canvasElement.querySelector('[data-testid="cm-trigger-0"]') as HTMLElement;
    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const sheet = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="cm-content-0"]');
      if (!(el instanceof HTMLElement)) throw new Error('Sheet not found');
      return el;
    });
    expect(sheet.getAttribute('role')).toBe('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="cm-content-0"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: Constants ============

function ConstantsDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="constants-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('sheet.story.description')}</p>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div data-testid="const-sides">
          <h4 className="mb-1 font-medium">SHEET_SIDES ({SHEET_SIDES.length})</h4>
          {SHEET_SIDES.map((side: SheetSide) => (
            <span key={side} className="bg-accent mr-2 rounded px-1">
              {side}
            </span>
          ))}
        </div>
        <div data-testid="const-sizes">
          <h4 className="mb-1 font-medium">SHEET_SIZES ({SHEET_SIZES.length})</h4>
          {SHEET_SIZES.map((size: SheetSize) => (
            <span key={size} className="bg-accent mr-2 rounded px-1">
              {size}
            </span>
          ))}
        </div>
        <div data-testid="const-content-types">
          <h4 className="mb-1 font-medium">SHEET_CONTENT_TYPES ({SHEET_CONTENT_TYPES.length})</h4>
          {SHEET_CONTENT_TYPES.map((ct: SheetContentType) => (
            <span key={ct} className="bg-accent mr-2 rounded px-1">
              {ct}
            </span>
          ))}
        </div>
        <div data-testid="const-titles">
          <h4 className="mb-1 font-medium">SHEET_TITLES ({SHEET_TITLES.length})</h4>
          {SHEET_TITLES.map((title: string) => (
            <span key={title} className="bg-accent mr-2 rounded px-1">
              {title}
            </span>
          ))}
        </div>
        <div data-testid="const-size-h">
          <h4 className="mb-1 font-medium">SIZE_CLASSES_HORIZONTAL</h4>
          {Object.entries(SIZE_CLASSES_HORIZONTAL).map(([k, v]) => (
            <p key={k}>
              {k}: {v}
            </p>
          ))}
        </div>
        <div data-testid="const-size-v">
          <h4 className="mb-1 font-medium">SIZE_CLASSES_VERTICAL</h4>
          {Object.entries(SIZE_CLASSES_VERTICAL).map(([k, v]) => (
            <p key={k}>
              {k}: {v}
            </p>
          ))}
        </div>
        <div data-testid="const-action-labels" className="col-span-2">
          <h4 className="mb-1 font-medium">ACTION_LABELS</h4>
          <p>Cancel: {ACTION_LABELS.cancel.join(', ')}</p>
          <p>Confirm: {ACTION_LABELS.confirm.join(', ')}</p>
          <p>Destructive: {ACTION_LABELS.destructive.join(', ')}</p>
        </div>
      </div>
    </div>
  );
}

export const WithConstants: Story = {
  name: i18n.t('sheet.storyName.withConstants', 'Factory: Constants'),
  render: () => <ConstantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="constants-demo"]')).toBeInTheDocument();

    const sidesEl = canvasElement.querySelector('[data-testid="const-sides"]');
    expect(sidesEl).toBeInTheDocument();
    expect(sidesEl!.textContent).toContain('right');
    expect(sidesEl!.textContent).toContain('left');
    expect(sidesEl!.textContent).toContain('top');
    expect(sidesEl!.textContent).toContain('bottom');

    const sizesEl = canvasElement.querySelector('[data-testid="const-sizes"]');
    expect(sizesEl).toBeInTheDocument();
    expect(sizesEl!.textContent).toContain('sm');
    expect(sizesEl!.textContent).toContain('default');
    expect(sizesEl!.textContent).toContain('full');

    const ctEl = canvasElement.querySelector('[data-testid="const-content-types"]');
    expect(ctEl).toBeInTheDocument();
    expect(ctEl!.textContent).toContain('form');
    expect(ctEl!.textContent).toContain('cart');

    const titlesEl = canvasElement.querySelector('[data-testid="const-titles"]');
    expect(titlesEl).toBeInTheDocument();
    expect(titlesEl!.textContent).toContain('Settings');

    expect(canvasElement.querySelector('[data-testid="const-size-h"]')!.textContent).toContain(
      'w-64'
    );
    expect(canvasElement.querySelector('[data-testid="const-size-v"]')!.textContent).toContain(
      'h-32'
    );

    const actionsEl = canvasElement.querySelector('[data-testid="const-action-labels"]');
    expect(actionsEl!.textContent).toContain('Cancel');
    expect(actionsEl!.textContent).toContain('Save');
    expect(actionsEl!.textContent).toContain('Delete');
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS STORIES (auto-wired)
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: sheetStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerValidationError: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerValidationError', 'Handler: Validation Error'),
  parameters: { msw: { handlers: sheetStatusHandlers.validationError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowSave: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerSlowSave', 'Handler: Slow Save'),
  parameters: { msw: { handlers: sheetStatusHandlers.slowSave } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlideOpenSuccess: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerSlideOpenSuccess', 'Handler: Slide Open Success'),
  parameters: { msw: { handlers: sheetStatusHandlers.slideOpenSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlideCloseSuccess: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerSlideCloseSuccess', 'Handler: Slide Close Success'),
  parameters: { msw: { handlers: sheetStatusHandlers.slideCloseSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlideError: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerSlideError', 'Handler: Slide Error'),
  parameters: { msw: { handlers: sheetStatusHandlers.slideError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerOverlayClickClose: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerOverlayClickClose', 'Handler: Overlay Click Close'),
  parameters: { msw: { handlers: sheetStatusHandlers.overlayClickClose } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerOverlayEscapeClose: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerOverlayEscapeClose', 'Handler: Overlay Escape Close'),
  parameters: { msw: { handlers: sheetStatusHandlers.overlayEscapeClose } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerOverlayFocusTrap: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerOverlayFocusTrap', 'Handler: Overlay Focus Trap'),
  parameters: { msw: { handlers: sheetStatusHandlers.overlayFocusTrap } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerOverlayPreventClose: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerOverlayPreventClose', 'Handler: Overlay Prevent Close'),
  parameters: { msw: { handlers: sheetStatusHandlers.overlayPreventClose } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerDialogContentSuccess: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerDialogContentSuccess', 'Handler: Dialog Content Success'),
  parameters: { msw: { handlers: sheetStatusHandlers.dialogContentSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerDialogContentNotFound: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerDialogContentNotFound', 'Handler: Dialog Content Not Found'),
  parameters: { msw: { handlers: sheetStatusHandlers.dialogContentNotFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerDialogContentLoading: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerDialogContentLoading', 'Handler: Dialog Content Loading'),
  parameters: { msw: { handlers: sheetStatusHandlers.dialogContentLoading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerDialogContentSlow: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerDialogContentSlow', 'Handler: Dialog Content Slow'),
  parameters: { msw: { handlers: sheetStatusHandlers.dialogContentSlow } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerRightSideContent: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerRightSideContent', 'Handler: Right Side Content'),
  parameters: { msw: { handlers: sheetStatusHandlers.rightSideContent } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLeftSideContent: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerLeftSideContent', 'Handler: Left Side Content'),
  parameters: { msw: { handlers: sheetStatusHandlers.leftSideContent } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTopSideContent: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerTopSideContent', 'Handler: Top Side Content'),
  parameters: { msw: { handlers: sheetStatusHandlers.topSideContent } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBottomSideContent: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerBottomSideContent', 'Handler: Bottom Side Content'),
  parameters: { msw: { handlers: sheetStatusHandlers.bottomSideContent } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerAriaDialogRole: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerAriaDialogRole', 'Handler: Aria Dialog Role'),
  parameters: { msw: { handlers: sheetStatusHandlers.ariaDialogRole } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerFocusTrapTest: Story = {
  ...Default,
  name: i18n.t('sheet.storyName.handlerFocusTrapTest', 'Handler: Focus Trap Test'),
  parameters: { msw: { handlers: sheetStatusHandlers.focusTrapTest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

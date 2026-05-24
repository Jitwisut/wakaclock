import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  dialogHandlers,
  dialogStatusHandlers,
} from '@/.storybook/stories/_handlers/dialog.handlers';
import { overlayStatusHandlers } from '@/.storybook/stories/_handlers/overlay.handlers';
import type {
  DialogButtonAction,
  DialogFormFieldType,
  DialogPosition,
  DialogSize,
  DialogType,
  FakeAlertDialog,
  FakeDialog,
  FakeDialogButton,
  FakeDialogContent,
  FakeDialogFormField,
  FakeFormDialog,
  FakeSettingsDialog,
  FakeSettingsSection,
  FakeWizardDialog,
  FakeWizardStep,
} from '@/.storybook/stories/_factories/dialog.factory';
import {
  CANCEL_LABELS,
  CONFIRM_LABELS,
  createFakeAlertDialog,
  createFakeConfirmationDialog,
  createFakeDeleteConfirmationDialog,
  createFakeDialog,
  createFakeDialogButton,
  createFakeDialogContent,
  createFakeDialogContents,
  createFakeDialogFormField,
  createFakeDialogFormFields,
  createFakeDialogMatrix,
  createFakeDialogShowcase,
  createFakeFormDialog,
  createFakeImagePreviewDialog,
  createFakeOnboardingWizard,
  createFakeProfileEditDialog,
  createFakeSettingsDialog,
  createFakeShareDialog,
  createFakeVideoDialog,
  createFakeWizardDialog,
  DIALOG_FORM_FIELD_TYPES,
  DIALOG_POSITIONS,
  DIALOG_SIZES,
  DIALOG_TITLES,
  DIALOG_TYPES,
} from '@/.storybook/stories/_factories/dialog.factory';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============ HELPER FUNCTIONS ============

/**
 * Gets the appropriate button variant based on action type
 */
function getButtonVariant(isDestructive: boolean): 'default' | 'destructive' {
  return isDestructive ? 'destructive' : 'default';
}

// ============ I18N WRAPPER COMPONENTS ============

function DialogDemo({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button variant="outline">{i18n.t('dialog.open')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{i18n.t('dialog.title')}</DialogTitle>
          <DialogDescription>{i18n.t('dialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="name">{i18n.t('dialog.field.name')}</Label>
            <Input defaultValue="Ada Lovelace" id="name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{i18n.t('dialog.field.email')}</Label>
            <Input defaultValue="ada@example.com" id="email" type="email" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">
            {i18n.t('dialog.action.cancel')}
          </Button>
          <Button onClick={() => setOpen(false)}>{i18n.t('dialog.action.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlaygroundDemo() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('dialog.story.playgroundHint')}</p>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger asChild>
          <Button data-testid="playground-trigger" variant="outline">
            {t('dialog.open')}
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="playground-dialog">
          <DialogHeader>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogDescription>{t('dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="playground-name">{t('dialog.field.name')}</Label>
              <Input
                data-testid="playground-name-input"
                defaultValue="Ada Lovelace"
                id="playground-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="playground-email">{t('dialog.field.email')}</Label>
              <Input
                data-testid="playground-email-input"
                defaultValue="ada@example.com"
                id="playground-email"
                type="email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="playground-cancel"
              onClick={() => setOpen(false)}
              variant="outline"
            >
              {t('dialog.action.cancel')}
            </Button>
            <Button data-testid="playground-save" onClick={() => setOpen(false)}>
              {t('dialog.action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ META CONFIGURATION ============

const meta = {
  title: 'Components/UI/Dialog',
  component: DialogDemo,
  tags: ['autodocs'],
  args: {
    defaultOpen: false,
    // Event handlers with fn() for Actions panel logging
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onEscapeKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dialogHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    title: {
      control: 'text',
      description: i18n.t('dialog.argType.dialogTitleText', 'Dialog title text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    description: {
      control: 'text',
      description: i18n.t('dialog.argType.dialogDescriptionText', 'Dialog description text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'dialog.argType.additionalCssClassesForTheDialogContent',
        'Additional CSS classes for the dialog content'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'dialog.argType.initialOpenStateOfTheDialog',
        'Initial open state of the dialog'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    modal: {
      control: 'boolean',
      description: i18n.t('dialog.argType.whetherTheDialogIsModal', 'Whether the dialog is modal'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Layout
    forceMount: {
      control: 'boolean',
      description: i18n.t(
        'dialog.argType.forceMountTheDialogContent',
        'Force mount the dialog content'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'boolean' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('dialog.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('dialog.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('dialog.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('dialog.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('dialog.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('dialog.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('dialog.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'dialog.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    onEscapeKeyDown: {
      action: 'onEscapeKeyDown',
      description: i18n.t(
        'dialog.argType.calledWhenEscapeKeyIsPressed',
        'Called when Escape key is pressed'
      ),
      table: { category: 'Events' },
    },
    // Component API Reference (in comments for documentation)
    // Dialog Props Reference (Radix Dialog.Root):
    // - open: Controlled open state (boolean)
    // - defaultOpen: Default open state for uncontrolled usage (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - modal: Whether to block interaction outside the dialog (boolean, default: true)
    //
    // DialogTrigger Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // DialogContent Props Reference:
    // - forceMount: Force mount when closed for animations (boolean)
    // - onOpenAutoFocus: Called when dialog opens with auto-focus ((event) => void)
    // - onCloseAutoFocus: Called when dialog closes with auto-focus ((event) => void)
    // - onEscapeKeyDown: Called on Escape key press ((event) => void)
    // - onPointerDownOutside: Called on click outside ((event) => void)
    // - onInteractOutside: Called on any interaction outside ((event) => void)
    // - showCloseIcon: Whether to show the X close button (boolean, default: true)
    // - className: Additional CSS classes (string)
    //
    // DialogHeader, DialogFooter Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Section content (ReactNode)
    //
    // DialogTitle Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Title text content (ReactNode)
    //
    // DialogDescription Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Description text content (ReactNode)
    //
    // DialogClose Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ CORE STORIES ============

export const Playground: Story = {
  name: i18n.t('dialog.storyName.playground', 'Playground'),
  render: () => <PlaygroundDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Open dialog
    const trigger = canvasElement.querySelector('[data-testid="playground-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected playground trigger button to be present.');
    }
    await userEvent.click(trigger);

    // Verify dialog opens
    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog).toBeInTheDocument();

    // Close dialog
    const cancelButton = doc.body.querySelector('[data-testid="playground-cancel"]');
    if (!(cancelButton instanceof HTMLButtonElement)) {
      throw new Error('Expected cancel button to be present.');
    }
    await userEvent.click(cancelButton);

    // Verify dialog closes
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent?.trim()).not.toBe('');
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Verify dialog opens by default
    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog).toBeInTheDocument();

    const title = dialog.querySelector('[data-slot="dialog-title"]');
    expect(title?.textContent?.trim()).not.toBe('');

    const description = dialog.querySelector('[data-slot="dialog-description"]');
    expect(description?.textContent?.trim()).not.toBe('');
  },
};

export const Default: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const openButton = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    if (!(openButton instanceof HTMLButtonElement)) {
      throw new Error('Expected dialog trigger button to be present.');
    }

    expect(openButton.textContent?.trim()).not.toBe('');
    await userEvent.click(openButton);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    const dialogQueries = within(dialog);

    expect(dialog.getAttribute('data-slot')).toBe('dialog-content');
    expect(doc.body.querySelector('[data-slot="dialog-overlay"]')).toBeInTheDocument();

    const title = dialog.querySelector('[data-slot="dialog-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Dialog title was not rendered.');
    }
    expect(title.textContent?.trim()).not.toBe('');

    const description = dialog.querySelector('[data-slot="dialog-description"]');
    if (!(description instanceof HTMLElement)) {
      throw new Error('Dialog description was not rendered.');
    }
    expect(description.textContent?.trim()).not.toBe('');

    const nameLabel = dialog.querySelector('label[for="name"]');
    if (!(nameLabel instanceof HTMLElement)) {
      throw new Error('Expected name label to be present.');
    }
    expect(nameLabel.textContent?.trim()).not.toBe('');

    const emailLabel = dialog.querySelector('label[for="email"]');
    if (!(emailLabel instanceof HTMLElement)) {
      throw new Error('Expected email label to be present.');
    }
    expect(emailLabel.textContent?.trim()).not.toBe('');

    expect(dialogQueries.getAllByRole('textbox').length).toBe(2);
    expect(dialog.querySelector('input#name')).toBeInTheDocument();
    expect(dialog.querySelector('input#email')).toBeInTheDocument();

    const footer = dialog.querySelector('[data-slot="dialog-footer"]');
    if (!(footer instanceof HTMLElement)) {
      throw new Error('Dialog footer was not rendered.');
    }

    const footerButtons = footer.querySelectorAll('[data-slot="button"]');
    expect(footerButtons.length).toBe(2);

    const cancelButton = footerButtons[0];
    if (!(cancelButton instanceof HTMLButtonElement)) {
      throw new Error('Expected cancel button to be present.');
    }

    expect(cancelButton.textContent?.trim()).not.toBe('');
    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dialog-overlay"]')).not.toBeInTheDocument();
    });
  },
};

// ============ VARIANTS STORIES ============

function DialogVariantsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('dialog.variants.basic')}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t('dialog.story.openBasic', 'Open Basic')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('dialog.story.basicDialog', 'Basic Dialog')}</DialogTitle>
              <DialogDescription>
                {t(
                  'dialog.story.simpleDialogDescription',
                  'A simple dialog with just a title and description.'
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>{t('dialog.story.ok', 'OK')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('dialog.variants.form')}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t('dialog.story.editProfile', 'Edit Profile')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('dialog.story.editProfile', 'Edit Profile')}</DialogTitle>
              <DialogDescription>
                {t(
                  'dialog.story.makeChangesClickSave',
                  'Make changes to your profile here. Click save when you are done.'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="username">{t('dialog.story.username', 'Username')}</Label>
                <Input id="username" defaultValue="@johndoe" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="display-name">
                  {t('dialog.story.displayName', 'Display Name')}
                </Label>
                <Input id="display-name" defaultValue="John Doe" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('dialog.story.cancel', 'Cancel')}</Button>
              <Button>{t('dialog.story.saveChanges', 'Save Changes')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('dialog.variants.confirmation')}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t('dialog.story.publishPost', 'Publish Post')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('dialog.story.publishPost1', 'Publish Post?')}</DialogTitle>
              <DialogDescription>
                {t(
                  'dialog.story.publishPostDescription',
                  'This will make your post visible to all users. You can unpublish it later if needed.'
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">{t('dialog.story.cancel', 'Cancel')}</Button>
              <Button>{t('dialog.story.publish', 'Publish')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('dialog.variants.scrollable')}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t('dialog.story.viewDetails', 'View Details')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('dialog.story.longContent', 'Long Content')}</DialogTitle>
              <DialogDescription>
                {t(
                  'dialog.story.thisDialogContainsScrollableContent',
                  'This dialog contains scrollable content.'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto py-4">
              <p className="mb-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget
                aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc quis nisl.
              </p>
              <p className="mb-4">
                Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis
                egestas. Proin pharetra luctus diam, ut convallis velit sagittis vel.
              </p>
              <p className="mb-4">
                Cras mattis consectetur purus sit amet fermentum. Cras justo odio, dapibus ac
                facilisis in, egestas eget quam. Nullam id dolor id nibh ultricies vehicula.
              </p>
              <p className="mb-4">
                Maecenas faucibus mollis interdum. Donec sed odio dui. Praesent commodo cursus
                magna, vel scelerisque nisl consectetur et.
              </p>
              <p>
                Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor. Duis mollis,
                est non commodo luctus, nisi erat porttitor ligula.
              </p>
            </div>
            <DialogFooter>
              <Button>{t('dialog.story.close', 'Close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <DialogVariantsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all variant triggers are present
    const triggers = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(triggers.length).toBeGreaterThanOrEqual(4);

    // Verify each trigger has text content
    triggers.forEach((trigger) => {
      expect(trigger.textContent?.trim()).not.toBe('');
    });
  },
};

// ============ SIZES STORIES ============

function DialogSizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('dialog.sizes.small')}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{i18n.t('dialog.story.smallDialog', 'Small Dialog')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{i18n.t('dialog.story.smallDialog', 'Small Dialog')}</DialogTitle>
              <DialogDescription>
                {i18n.t(
                  'dialog.story.compactDialogDescription',
                  'A compact dialog for simple confirmations.'
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>{i18n.t('dialog.story.ok', 'OK')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('dialog.sizes.default')}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              {i18n.t('dialog.story.defaultDialog', 'Default Dialog')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{i18n.t('dialog.story.defaultDialog', 'Default Dialog')}</DialogTitle>
              <DialogDescription>
                {i18n.t(
                  'dialog.story.standardDialogDescription',
                  'The standard dialog size, suitable for most use cases including forms and confirmations.'
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">{i18n.t('dialog.story.cancel', 'Cancel')}</Button>
              <Button>{i18n.t('dialog.story.continue', 'Continue')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('dialog.sizes.large')}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{i18n.t('dialog.story.largeDialog', 'Large Dialog')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{i18n.t('dialog.story.largeDialog', 'Large Dialog')}</DialogTitle>
              <DialogDescription>
                {i18n.t(
                  'dialog.story.largerDialogDescription',
                  'A larger dialog for content that needs more horizontal space, such as forms with side-by-side fields or preview content.'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="grid gap-2">
                <Label>{i18n.t('dialog.story.firstName', 'First Name')}</Label>
                <Input defaultValue="John" />
              </div>
              <div className="grid gap-2">
                <Label>{i18n.t('dialog.story.lastName', 'Last Name')}</Label>
                <Input defaultValue="Doe" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">{i18n.t('dialog.story.cancel', 'Cancel')}</Button>
              <Button>{i18n.t('dialog.story.save', 'Save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('dialog.sizes.extraLarge')}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              {i18n.t('dialog.story.extraLargeDialog', 'Extra Large Dialog')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {i18n.t('dialog.story.extraLargeDialog', 'Extra Large Dialog')}
              </DialogTitle>
              <DialogDescription>
                {i18n.t(
                  'dialog.story.extraLargeDialogDescription',
                  'An extra large dialog for complex content like data tables, multi-column forms, or rich editing experiences.'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="grid gap-2">
                <Label>Field 1</Label>
                <Input placeholder={i18n.t('dialog.story.enterValue', 'Enter value')} />
              </div>
              <div className="grid gap-2">
                <Label>Field 2</Label>
                <Input placeholder={i18n.t('dialog.story.enterValue', 'Enter value')} />
              </div>
              <div className="grid gap-2">
                <Label>Field 3</Label>
                <Input placeholder={i18n.t('dialog.story.enterValue', 'Enter value')} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">{i18n.t('dialog.story.cancel', 'Cancel')}</Button>
              <Button>{i18n.t('dialog.story.save', 'Save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <DialogSizesDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all size variant triggers are present
    const triggers = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(triggers.length).toBeGreaterThanOrEqual(4);

    // Verify each trigger has text content
    triggers.forEach((trigger) => {
      expect(trigger.textContent?.trim()).not.toBe('');
    });
  },
};

// ============ DARK MODE STORY ============

function DarkModeDemo() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.story.darkModeHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="dark-mode-trigger" variant="outline">
            {i18n.t('dialog.open')}
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="dark-mode-dialog">
          <DialogHeader>
            <DialogTitle>{i18n.t('dialog.title')}</DialogTitle>
            <DialogDescription>{i18n.t('dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="dark-name">{i18n.t('dialog.field.name')}</Label>
              <Input defaultValue="Ada Lovelace" id="dark-name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dark-email">{i18n.t('dialog.field.email')}</Label>
              <Input defaultValue="ada@example.com" id="dark-email" type="email" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} variant="outline">
              {i18n.t('dialog.action.cancel')}
            </Button>
            <Button onClick={() => setOpen(false)}>{i18n.t('dialog.action.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Dark: Story = {
  name: i18n.t('dialog.storyName.dark', 'Dark Mode'),
  render: () => <DarkModeDemo />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Verify dark mode is applied
    expect(doc.documentElement.classList.contains('dark')).toBe(true);

    // Open dialog
    const trigger = canvasElement.querySelector('[data-testid="dark-mode-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected dark mode trigger button to be present.');
    }
    await userEvent.click(trigger);

    // Verify dialog opens with dark theme
    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog).toBeInTheDocument();

    // Verify overlay has proper dark styling
    const overlay = doc.body.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).toBeInTheDocument();

    // Close dialog
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('dialog.storyName.darkModeJapanese', 'Dark Mode (Japanese)'),
  render: () => <DarkModeDemo />,
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Verify dark mode and Japanese locale
    expect(doc.documentElement.classList.contains('dark')).toBe(true);
    expect(doc.documentElement.lang).toBe('ja');

    // Open dialog
    const trigger = canvasElement.querySelector('[data-testid="dark-mode-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    const title = dialog.querySelector('[data-slot="dialog-title"]');
    expect(title?.textContent).toBe('プロフィールを編集');

    // Close dialog
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ RTL STORY ============

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

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent?.trim()).not.toBe('');
  },
};

// ============ JAPANESE LOCALE STORY ============

function JapaneseLocaleDemo() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.story.japaneseLocaleHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="ja-trigger" variant="outline">
            {i18n.t('dialog.open')}
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="ja-dialog">
          <DialogHeader>
            <DialogTitle data-testid="ja-title">{i18n.t('dialog.title')}</DialogTitle>
            <DialogDescription data-testid="ja-description">
              {i18n.t('dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ja-name">{i18n.t('dialog.field.name')}</Label>
              <Input defaultValue="山田太郎" id="ja-name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ja-email">{i18n.t('dialog.field.email')}</Label>
              <Input defaultValue="taro@example.com" id="ja-email" type="email" />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="ja-cancel" onClick={() => setOpen(false)} variant="outline">
              {i18n.t('dialog.action.cancel')}
            </Button>
            <Button data-testid="ja-save" onClick={() => setOpen(false)}>
              {i18n.t('dialog.action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Japanese: Story = {
  name: i18n.t('dialog.storyName.japanese', 'Japanese Locale'),
  render: () => <JapaneseLocaleDemo />,
  globals: {
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Verify Japanese locale is set
    expect(doc.documentElement.lang).toBe('ja');

    const openButton = canvasElement.querySelector('[data-testid="ja-trigger"]');
    if (!(openButton instanceof HTMLButtonElement)) {
      throw new Error('Expected dialog trigger button to be present.');
    }

    // Verify trigger button has Japanese text
    expect(openButton.textContent?.trim()).toBe('ダイアログを開く');

    await userEvent.click(openButton);

    const dialog = await waitFor(() => body.getByRole('dialog'));

    // Verify title is in Japanese
    const title = dialog.querySelector('[data-testid="ja-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Dialog title was not rendered.');
    }
    expect(title.textContent?.trim()).toBe('プロフィールを編集');

    // Verify description is in Japanese
    const description = dialog.querySelector('[data-testid="ja-description"]');
    if (!(description instanceof HTMLElement)) {
      throw new Error('Dialog description was not rendered.');
    }
    expect(description.textContent?.trim()).toContain('プロフィール');

    // Verify buttons are in Japanese
    const cancelButton = dialog.querySelector('[data-testid="ja-cancel"]');
    expect(cancelButton?.textContent?.trim()).toBe('キャンセル');

    const saveButton = dialog.querySelector('[data-testid="ja-save"]');
    expect(saveButton?.textContent?.trim()).toBe('保存');

    // Close dialog
    await userEvent.click(cancelButton!);
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ DESIGN REFERENCE STORY ============

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

// ============ PSEUDO STATES STORY ============

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('dialog.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    msw: { handlers: dialogHandlers },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dialogStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dialogStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dialogStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dialogStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dialogStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dialogStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dialogStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORIES ============

function AccessibilityAriaDemo() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.story.ariaAttributesHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="aria-trigger">{i18n.t('dialog.story.openAccessibleDialog')}</Button>
        </DialogTrigger>
        <DialogContent
          data-testid="aria-dialog"
          aria-labelledby="aria-test-title"
          aria-describedby="aria-test-description"
        >
          <DialogHeader>
            <DialogTitle id="aria-test-title">{i18n.t('dialog.a11y.title')}</DialogTitle>
            <DialogDescription id="aria-test-description">
              {i18n.t('dialog.a11y.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="aria-name">{i18n.t('dialog.field.name')}</Label>
              <Input id="aria-name" placeholder={i18n.t('dialog.a11y.namePlaceholder')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="aria-email">{i18n.t('dialog.field.email')}</Label>
              <Input
                id="aria-email"
                type="email"
                placeholder={i18n.t('dialog.a11y.emailPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {i18n.t('dialog.action.cancel')}
            </Button>
            <Button onClick={() => setOpen(false)}>{i18n.t('dialog.action.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const AccessibilityAriaAttributes: Story = {
  name: i18n.t('dialog.storyName.accessibilityAriaAttributes', 'ARIA Attributes'),
  render: () => <AccessibilityAriaDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Open dialog
    const trigger = canvasElement.querySelector('[data-testid="aria-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));

    // Test: Dialog has role="dialog"
    expect(dialog.getAttribute('role')).toBe('dialog');

    // Test: Dialog has aria-modal="true"
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // Test: Dialog has aria-labelledby pointing to title
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(doc.querySelector(`#${labelledBy}`)).toBeInTheDocument();

    // Test: Dialog has aria-describedby pointing to description
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(doc.querySelector(`#${describedBy}`)).toBeInTheDocument();

    // Test: Title element exists and has id
    const titleElement = doc.querySelector('#aria-test-title');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement?.textContent).not.toBe('');

    // Test: Description element exists and has id
    const descriptionElement = doc.querySelector('#aria-test-description');
    expect(descriptionElement).toBeInTheDocument();
    expect(descriptionElement?.textContent).not.toBe('');

    // Close dialog
    const cancelButton = within(dialog).getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
  parameters: {
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
};

function OpenCloseDemo() {
  const [open, setOpen] = React.useState(false);
  const [openCount, setOpenCount] = React.useState(0);
  const [closeCount, setCloseCount] = React.useState(0);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setOpenCount((c) => c + 1);
    } else {
      setCloseCount((c) => c + 1);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.story.openCloseHint')}</p>
      <div className="flex gap-4 text-sm">
        <span>
          Opens: <span data-testid="open-count">{openCount}</span>
        </span>
        <span>
          Closes: <span data-testid="close-count">{closeCount}</span>
        </span>
      </div>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button data-testid="open-close-trigger">{i18n.t('dialog.open')}</Button>
        </DialogTrigger>
        <DialogContent data-testid="open-close-dialog">
          <DialogHeader>
            <DialogTitle>{i18n.t('dialog.story.openCloseTitle')}</DialogTitle>
            <DialogDescription>{i18n.t('dialog.story.openCloseDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button data-testid="close-button" onClick={() => setOpen(false)}>
              {i18n.t('dialog.action.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const AccessibilityOpenClose: Story = {
  name: i18n.t('dialog.storyName.accessibilityOpenClose', 'Open/Close Behavior'),
  render: () => <OpenCloseDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Initial state
    expect(canvasElement.querySelector('[data-testid="open-count"]')?.textContent).toBe('0');
    expect(canvasElement.querySelector('[data-testid="close-count"]')?.textContent).toBe('0');

    // Open dialog
    const trigger = canvasElement.querySelector('[data-testid="open-close-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(() => {
      expect(body.getByRole('dialog')).toBeInTheDocument();
    });

    // Verify open count incremented
    expect(canvasElement.querySelector('[data-testid="open-count"]')?.textContent).toBe('1');

    // Close dialog via button
    const closeButton = doc.body.querySelector('[data-testid="close-button"]');
    await userEvent.click(closeButton!);

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify close count incremented
    expect(canvasElement.querySelector('[data-testid="close-count"]')?.textContent).toBe('1');

    // Open again to test Escape key
    await userEvent.click(trigger!);
    await waitFor(() => {
      expect(body.getByRole('dialog')).toBeInTheDocument();
    });

    // Verify open count incremented again
    expect(canvasElement.querySelector('[data-testid="open-count"]')?.textContent).toBe('2');

    // Close with Escape key
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify close count incremented again
    expect(canvasElement.querySelector('[data-testid="close-count"]')?.textContent).toBe('2');
  },
};

function FocusTrapDemo() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(true);

  return (
    <div className="space-y-4">
      <Button id="outside-button" data-testid="outside-button">
        {t('dialog.story.outsideButton')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="focus-trap-trigger">{t('dialog.open')}</Button>
        </DialogTrigger>
        <DialogContent data-testid="focus-trap-dialog">
          <DialogHeader>
            <DialogTitle>{t('dialog.story.focusTrapTitle')}</DialogTitle>
            <DialogDescription>{t('dialog.story.focusTrapDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              data-testid="trap-input1"
              id="trap-input1"
              placeholder={i18n.t('dialog.story.firstInput', 'First input')}
            />
            <Input
              data-testid="trap-input2"
              id="trap-input2"
              placeholder={i18n.t('dialog.story.secondInput', 'Second input')}
            />
          </div>
          <DialogFooter>
            <Button data-testid="trap-close" variant="outline" onClick={() => setOpen(false)}>
              {t('dialog.action.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const AccessibilityFocusTrap: Story = {
  name: i18n.t('dialog.storyName.accessibilityFocusTrap', 'Focus Trap'),
  render: () => <FocusTrapDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const dialog = await waitFor(() => body.getByRole('dialog'));

    // Tab multiple times to verify focus stays within dialog
    for (let i = 0; i < 10; i++) {
      await userEvent.tab();
      expect(doc.activeElement).toBeInTheDocument();
      expect(dialog).toContainElement(doc.activeElement as HTMLElement);
    }

    // Shift+Tab multiple times - focus should still stay trapped
    for (let i = 0; i < 10; i++) {
      await userEvent.tab({ shift: true });
      expect(doc.activeElement).toBeInTheDocument();
      expect(dialog).toContainElement(doc.activeElement as HTMLElement);
    }

    // Verify outside button cannot receive focus
    const outsideButton = canvasElement.querySelector('[data-testid="outside-button"]');
    expect(outsideButton).toBeInTheDocument();
    expect(doc.activeElement).not.toBe(outsideButton);
  },
};

function EscapeToCloseDemo() {
  const [open, setOpen] = React.useState(true);
  const [escapeCount, setEscapeCount] = React.useState(0);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.story.escapeHint')}</p>
      <p className="text-sm">
        {i18n.t('dialog.story.escapeCount')}: <span data-testid="escape-count">{escapeCount}</span>
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="escape-trigger">{i18n.t('dialog.open')}</Button>
        </DialogTrigger>
        <DialogContent
          data-testid="escape-dialog"
          onEscapeKeyDown={() => setEscapeCount((c) => c + 1)}
        >
          <DialogHeader>
            <DialogTitle>{i18n.t('dialog.story.escapeTitle')}</DialogTitle>
            <DialogDescription>{i18n.t('dialog.story.escapeDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              id="escape-test-input"
              placeholder={i18n.t(
                'dialog.story.focusAndPressEscape',
                'Focus here and press Escape'
              )}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{i18n.t('dialog.action.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const AccessibilityEscapeToClose: Story = {
  name: i18n.t('dialog.storyName.accessibilityEscapeToClose', 'Escape Key to Close'),
  render: () => <EscapeToCloseDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Dialog should be open by default
    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog).toBeInTheDocument();

    // Press Escape to close
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify escape count was incremented
    const countEl = canvasElement.querySelector('[data-testid="escape-count"]');
    expect(countEl).toHaveTextContent('1');

    // Reopen dialog
    const trigger = canvasElement.querySelector('[data-testid="escape-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(() => {
      expect(body.getByRole('dialog')).toBeInTheDocument();
    });

    // Press Escape again
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify escape count incremented again
    expect(countEl).toHaveTextContent('2');
  },
};

function KeyboardNavigationDemo() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('dialog.story.keyboardNavHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="keyboard-trigger">{t('dialog.open')}</Button>
        </DialogTrigger>
        <DialogContent data-testid="keyboard-dialog">
          <DialogHeader>
            <DialogTitle>{t('dialog.story.keyboardNavTitle')}</DialogTitle>
            <DialogDescription>{t('dialog.story.keyboardNavDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="kb-field1">{t('dialog.story.firstField')}</Label>
              <Input
                data-testid="kb-input1"
                id="kb-field1"
                placeholder={i18n.t('dialog.story.tabHereFirst', 'Tab here first')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kb-field2">{t('dialog.story.secondField')}</Label>
              <Input
                data-testid="kb-input2"
                id="kb-field2"
                placeholder={i18n.t('dialog.story.tabHereSecond', 'Tab here second')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="kb-cancel" variant="outline" onClick={() => setOpen(false)}>
              {t('dialog.action.cancel')}
            </Button>
            <Button data-testid="kb-confirm" onClick={() => setOpen(false)}>
              {t('dialog.action.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const AccessibilityKeyboardNavigation: Story = {
  name: i18n.t('dialog.storyName.accessibilityKeyboardNavigation', 'Keyboard Navigation'),
  render: () => <KeyboardNavigationDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Open dialog with keyboard (Enter on trigger)
    const trigger = canvasElement.querySelector('[data-testid="keyboard-trigger"]')!;
    (trigger as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');

    const dialog = await waitFor(() => body.getByRole('dialog'));

    // Test: Tab through dialog elements
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();

    // Test: All tabbed elements are within dialog
    expect(doc.activeElement).toBeInTheDocument();
    expect(dialog).toContainElement(doc.activeElement as HTMLElement);

    // Test: Escape key closes dialog
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Test: Focus returns to trigger after close
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });
  },
};

// ============ FAKER INTEGRATION STORIES ============

function DialogWithFakerData() {
  const fakeContent = React.useMemo(() => createFakeDialogContent(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="faker-dialog-demo">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            {i18n.t('dialog.story.openFakerDialog', 'Open Faker Dialog')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fakeContent.title}</DialogTitle>
            <DialogDescription>{fakeContent.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-muted-foreground text-sm">Dialog ID: {fakeContent.id}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {fakeContent.cancelLabel}
            </Button>
            <Button
              variant={getButtonVariant(fakeContent.destructive ?? false)}
              onClick={() => setOpen(false)}
            >
              {fakeContent.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <DialogWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="faker-dialog-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="button"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected dialog trigger button to be present.');
    }

    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const dialog = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="dialog-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Dialog content was not found.');
      return el;
    });

    expect(dialog.querySelector('[data-slot="dialog-title"]')?.textContent?.trim()).not.toBe('');
    expect(dialog.querySelector('[data-slot="dialog-description"]')?.textContent?.trim()).not.toBe(
      ''
    );
  },
};

// ============ ASYNC DATA STORIES ============

interface DialogApiResponse {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  id: string;
  title: string;
}

interface DialogApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function DialogWithAsyncData() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<DialogApiResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<DialogApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/dialog-content/test-dialog')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as DialogApiError;
          throw err;
        }
        return res.json() as Promise<DialogApiResponse>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
        return undefined;
      })
      .catch((error_: DialogApiError) => {
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
    <div data-testid="async-dialog-demo" data-state={currentState}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            {i18n.t('dialog.story.openAsyncDialog', 'Open Async Dialog')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          {loading && (
            <div data-testid="dialog-loading" className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          )}
          {error && (
            <div data-testid="dialog-error" data-error-status={error.status}>
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  {i18n.t('dialog.story.error', 'Error')} {error.status}
                </DialogTitle>
                <DialogDescription>{error.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button onClick={fetchData}>{i18n.t('dialog.story.retry', 'Retry')}</Button>
              </DialogFooter>
            </div>
          )}
          {data && !loading && !error && (
            <div data-testid="dialog-success">
              <DialogHeader>
                <DialogTitle>{data.title}</DialogTitle>
                <DialogDescription>{data.description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {data.cancelLabel}
                </Button>
                <Button onClick={() => setOpen(false)}>{data.confirmLabel}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: dialogHandlers },
  },
  render: () => <DialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected dialog trigger button to be present.');
    }

    await userEvent.click(trigger);

    // Wait for loading state
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="dialog-loading"]')).toBeInTheDocument();
    });

    // Wait for success state
    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="dialog-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: dialogStatusHandlers.emptyData },
  },
  render: () => <DialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected dialog trigger button to be present.');
    }

    await userEvent.click(trigger);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="dialog-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowResponse: Story = {
  name: i18n.t('dialog.storyName.slowResponse', 'Slow Response (5s)'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.slowResponse },
  },
  render: () => <DialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    await userEvent.click(trigger!);

    // Verify loading shows first
    expect(doc.body.querySelector('[data-testid="dialog-loading"]')).toBeInTheDocument();

    // Wait for success (slow response takes 5s)
    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="dialog-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error404NotFound: Story = {
  name: i18n.t('dialog.storyName.error404NotFound', 'Error 404: Not Found'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.notFound },
  },
  render: () => <DialogWithAsyncData />,
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
  name: i18n.t('dialog.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.conflict },
  },
  render: () => <DialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
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
  name: i18n.t('dialog.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.tooManyRequests },
  },
  render: () => <DialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
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
  name: i18n.t('dialog.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.badGateway },
  },
  render: () => <DialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
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
  name: i18n.t('dialog.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.serviceUnavailable },
  },
  render: () => <DialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
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
  name: i18n.t('dialog.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.gatewayTimeout },
  },
  render: () => <DialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="button"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ NESTED DIALOG FOCUS TRAP STORY ============

function NestedDialogFocusTrapDemo() {
  const [outerOpen, setOuterOpen] = React.useState(false);
  const [innerOpen, setInnerOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.story.nestedDialogHint')}</p>
      <Dialog open={outerOpen} onOpenChange={setOuterOpen}>
        <DialogTrigger asChild>
          <Button data-testid="outer-trigger">{i18n.t('dialog.story.openOuterDialog')}</Button>
        </DialogTrigger>
        <DialogContent data-testid="outer-dialog">
          <DialogHeader>
            <DialogTitle>{i18n.t('dialog.story.outerDialogTitle')}</DialogTitle>
            <DialogDescription>{i18n.t('dialog.story.outerDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              data-testid="outer-input"
              id="outer-input"
              placeholder={i18n.t('dialog.story.outerInput', 'Outer input')}
            />
            <Dialog open={innerOpen} onOpenChange={setInnerOpen}>
              <DialogTrigger asChild>
                <Button data-testid="inner-trigger" variant="secondary">
                  {i18n.t('dialog.story.openInnerDialog')}
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="inner-dialog">
                <DialogHeader>
                  <DialogTitle>{i18n.t('dialog.story.innerDialogTitle')}</DialogTitle>
                  <DialogDescription>
                    {i18n.t('dialog.story.innerDialogDescription')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Input
                    data-testid="inner-input"
                    id="inner-input"
                    placeholder={i18n.t('dialog.story.innerInput', 'Inner input')}
                  />
                </div>
                <DialogFooter>
                  <Button data-testid="inner-close" onClick={() => setInnerOpen(false)}>
                    {i18n.t('dialog.story.closeInner')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <DialogFooter>
            <Button data-testid="outer-close" onClick={() => setOuterOpen(false)}>
              {i18n.t('dialog.story.closeOuter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const NestedDialogFocusTrap: Story = {
  name: i18n.t('dialog.storyName.nestedDialogFocusTrap', 'Nested Dialog Focus Trap'),
  render: () => <NestedDialogFocusTrapDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Open outer dialog
    const outerTrigger = canvasElement.querySelector('[data-testid="outer-trigger"]');
    await userEvent.click(outerTrigger!);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="outer-dialog"]')).toBeInTheDocument();
    });

    // Open inner dialog
    const innerTrigger = doc.body.querySelector('[data-testid="inner-trigger"]');
    await userEvent.click(innerTrigger!);

    const innerDialog = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="inner-dialog"]');
      if (!(el instanceof HTMLElement)) throw new Error('Inner dialog not found');
      return el;
    });

    // Tab through inner dialog multiple times - focus should stay trapped
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(doc.activeElement).toBeInTheDocument();
      expect(innerDialog).toContainElement(doc.activeElement as HTMLElement);
    }

    // Close inner dialog with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="inner-dialog"]')).not.toBeInTheDocument();
    });

    // Focus should return to outer dialog
    const outerDialog = doc.body.querySelector('[data-testid="outer-dialog"]');
    expect(outerDialog).toBeInTheDocument();
    expect(doc.activeElement).toBeInTheDocument();
    expect(outerDialog).toContainElement(doc.activeElement as HTMLElement);
  },
};

// ============ FOCUS RETURN STORY ============

function FocusReturnDemo() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.story.focusReturnHint')}</p>
      <div className="flex gap-4">
        <Button data-testid="button-before">
          {i18n.t('dialog.story.buttonBefore', 'Button Before')}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="focus-return-trigger">{i18n.t('dialog.open')}</Button>
          </DialogTrigger>
          <DialogContent data-testid="focus-return-dialog">
            <DialogHeader>
              <DialogTitle>{i18n.t('dialog.story.focusReturnTitle')}</DialogTitle>
              <DialogDescription>{i18n.t('dialog.story.focusReturnDescription')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button data-testid="focus-return-close" onClick={() => setOpen(false)}>
                {i18n.t('dialog.action.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button data-testid="button-after">
          {i18n.t('dialog.story.buttonAfter', 'Button After')}
        </Button>
      </div>
    </div>
  );
}

export const AccessibilityFocusReturn: Story = {
  name: i18n.t('dialog.storyName.accessibilityFocusReturn', 'Focus Return to Trigger'),
  render: () => <FocusReturnDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-testid="focus-return-trigger"]');

    // Open dialog
    await userEvent.click(trigger!);
    await waitFor(() => {
      expect(body.getByRole('dialog')).toBeInTheDocument();
    });

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify focus returned to trigger
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });

    // Test again with button close
    await userEvent.click(trigger!);
    await waitFor(() => {
      expect(body.getByRole('dialog')).toBeInTheDocument();
    });

    const closeButton = doc.body.querySelector('[data-testid="focus-return-close"]');
    await userEvent.click(closeButton!);

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Focus should still return to trigger
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });
  },
};

// ============ SCREEN READER ANNOUNCEMENT STORY ============

function ScreenReaderDemo() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.story.screenReaderHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="sr-trigger" aria-haspopup="dialog">
            {i18n.t('dialog.story.openForScreenReader')}
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="sr-dialog" role="dialog" aria-live="assertive">
          <DialogHeader>
            <DialogTitle>{i18n.t('dialog.story.screenReaderTitle')}</DialogTitle>
            <DialogDescription>{i18n.t('dialog.story.screenReaderDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sr-name">{i18n.t('dialog.field.name')}</Label>
              <Input
                id="sr-name"
                aria-required="true"
                aria-describedby="sr-name-hint"
                placeholder={i18n.t('dialog.story.enterYourName', 'Enter your name')}
              />
              <p id="sr-name-hint" className="text-muted-foreground text-xs">
                {i18n.t('dialog.story.nameHint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="sr-close" onClick={() => setOpen(false)}>
              {i18n.t('dialog.action.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const AccessibilityScreenReader: Story = {
  name: i18n.t('dialog.storyName.accessibilityScreenReader', 'Screen Reader Support'),
  render: () => <ScreenReaderDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Verify trigger has aria-haspopup
    const trigger = canvasElement.querySelector('[data-testid="sr-trigger"]');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('dialog');

    // Open dialog
    await userEvent.click(trigger!);
    const dialog = await waitFor(() => body.getByRole('dialog'));

    // Verify dialog ARIA attributes
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // Verify input has proper ARIA attributes
    const nameInput = dialog.querySelector('#sr-name');
    expect(nameInput?.getAttribute('aria-required')).toBe('true');
    expect(nameInput?.getAttribute('aria-describedby')).toBe('sr-name-hint');

    // Verify hint text exists
    const hint = dialog.querySelector('#sr-name-hint');
    expect(hint).toBeInTheDocument();
    expect(hint?.textContent).not.toBe('');

    // Close dialog
    const closeButton = dialog.querySelector('[data-testid="sr-close"]');
    await userEvent.click(closeButton!);

    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: DIALOG BUTTON ============

function FactoryDialogButtonDemo() {
  const buttons = React.useMemo(
    () =>
      (['cancel', 'confirm', 'custom', 'destructive'] as DialogButtonAction[]).map((action) =>
        createFakeDialogButton({ action })
      ),
    []
  );
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="factory-dialog-button-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.dialogButtonHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.dialogButton')}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{i18n.t('dialog.factory.dialogButton')}</DialogTitle>
            <DialogDescription>{i18n.t('dialog.factory.dialogButtonHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 py-4">
            {buttons.map((btn: FakeDialogButton) => (
              <Button
                key={btn.id}
                variant={btn.variant}
                disabled={btn.disabled ?? false}
                data-action={btn.action}
                onClick={() => setOpen(false)}
              >
                {btn.label}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {i18n.t('dialog.action.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryDialogButton: Story = {
  name: i18n.t('dialog.storyName.factoryDialogButton', 'Factory: Dialog Button'),
  render: () => <FactoryDialogButtonDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    expect(
      canvasElement.querySelector('[data-testid="factory-dialog-button-demo"]')
    ).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog).toBeInTheDocument();

    const actionButtons = dialog.querySelectorAll('[data-action]');
    expect(actionButtons.length).toBe(4);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: FORM FIELD ============

function FactoryFormFieldDemo() {
  const fields = React.useMemo(
    () =>
      (['text', 'email', 'password', 'textarea', 'select'] as DialogFormFieldType[]).map((type) =>
        createFakeDialogFormField({ type })
      ),
    []
  );
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="factory-form-field-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.formFieldHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.formField')}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{i18n.t('dialog.factory.formField')}</DialogTitle>
            <DialogDescription>{i18n.t('dialog.factory.formFieldHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {fields.map((field: FakeDialogFormField) => (
              <div key={field.id} className="grid gap-1">
                <Label>
                  {field.label}
                  {field.required ? ' *' : ''}
                </Label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="border-input bg-background min-h-[60px] rounded-md border px-3 py-2 text-sm"
                    placeholder={field.placeholder ?? ''}
                    disabled={field.disabled}
                    data-field-type={field.type}
                  />
                ) : (
                  <Input
                    type={field.type === 'select' ? 'text' : field.type}
                    placeholder={field.placeholder ?? ''}
                    disabled={field.disabled}
                    data-field-type={field.type}
                  />
                )}
                {field.description ? (
                  <p className="text-muted-foreground text-xs">{field.description}</p>
                ) : null}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {i18n.t('dialog.action.cancel')}
            </Button>
            <Button onClick={() => setOpen(false)}>{i18n.t('dialog.action.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryFormField: Story = {
  name: i18n.t('dialog.storyName.factoryFormField', 'Factory: Form Field'),
  render: () => <FactoryFormFieldDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    expect(
      canvasElement.querySelector('[data-testid="factory-form-field-demo"]')
    ).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    const fieldElements = dialog.querySelectorAll('[data-field-type]');
    expect(fieldElements.length).toBe(5);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: BULK CONTENTS ============

function FactoryBulkContentsDemo() {
  const contents = React.useMemo(() => createFakeDialogContents(4), []);

  return (
    <div data-testid="factory-bulk-contents-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.bulkContentsHint')}</p>
      <div className="grid gap-4">
        {contents.map((content: FakeDialogContent) => (
          <div key={content.id} className="rounded-md border p-4" data-testid="bulk-content-card">
            <h4 className="font-semibold">{content.title}</h4>
            <p className="text-muted-foreground text-sm">{content.description}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm">
                {content.cancelLabel}
              </Button>
              <Button variant={getButtonVariant(content.destructive ?? false)} size="sm">
                {content.confirmLabel}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryBulkContents: Story = {
  name: i18n.t('dialog.storyName.factoryBulkContents', 'Factory: Bulk Contents'),
  render: () => <FactoryBulkContentsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-bulk-contents-demo"]')
    ).toBeInTheDocument();

    const cards = canvasElement.querySelectorAll('[data-testid="bulk-content-card"]');
    expect(cards.length).toBe(4);

    cards.forEach((card) => {
      expect(card.querySelector('h4')?.textContent?.trim()).not.toBe('');
    });
  },
};

// ============ FACTORY: BULK FORM FIELDS ============

function FactoryBulkFormFieldsDemo() {
  const fields = React.useMemo(() => createFakeDialogFormFields(5), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="factory-bulk-form-fields-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.bulkFormFieldsHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.bulkFormFields')}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{i18n.t('dialog.factory.bulkFormFields')}</DialogTitle>
            <DialogDescription>{i18n.t('dialog.factory.bulkFormFieldsHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {fields.map((field: FakeDialogFormField) => (
              <div key={field.id} className="grid gap-1" data-testid="bulk-field-item">
                <Label>
                  {field.label} ({field.type})
                </Label>
                <Input placeholder={field.placeholder ?? ''} disabled={field.disabled} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{i18n.t('dialog.action.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryBulkFormFields: Story = {
  name: i18n.t('dialog.storyName.factoryBulkFormFields', 'Factory: Bulk Form Fields'),
  render: () => <FactoryBulkFormFieldsDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    const fieldItems = dialog.querySelectorAll('[data-testid="bulk-field-item"]');
    expect(fieldItems.length).toBe(5);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: COMPLETE DIALOG ============

function FactoryCompleteDialogDemo() {
  const fakeDialog = React.useMemo(() => createFakeDialog(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="factory-complete-dialog-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.completeDialogHint')}</p>
      <div className="text-muted-foreground mb-2 text-xs">
        <span>
          {i18n.t('dialog.factory.type')}: {fakeDialog.type}
        </span>
        {' | '}
        <span>
          {i18n.t('dialog.factory.size')}: {fakeDialog.size}
        </span>
        {' | '}
        <span>
          {i18n.t('dialog.factory.position')}: {fakeDialog.position}
        </span>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.completeDialog')}</Button>
        </DialogTrigger>
        <DialogContent data-dialog-type={fakeDialog.type} data-dialog-size={fakeDialog.size}>
          <DialogHeader>
            <DialogTitle>{fakeDialog.content.title}</DialogTitle>
            <DialogDescription>{fakeDialog.content.description}</DialogDescription>
          </DialogHeader>
          {fakeDialog.footerText ? (
            <p className="text-muted-foreground text-xs">{fakeDialog.footerText}</p>
          ) : null}
          <DialogFooter>
            {fakeDialog.buttons.map((btn: FakeDialogButton) => (
              <Button
                key={btn.id}
                variant={btn.variant}
                disabled={btn.disabled ?? false}
                onClick={() => setOpen(false)}
              >
                {btn.label}
              </Button>
            ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryCompleteDialog: Story = {
  name: i18n.t('dialog.storyName.factoryCompleteDialog', 'Factory: Complete Dialog'),
  render: () => <FactoryCompleteDialogDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    expect(
      canvasElement.querySelector('[data-testid="factory-complete-dialog-demo"]')
    ).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog.getAttribute('data-dialog-type')).toBeTruthy();
    expect(dialog.getAttribute('data-dialog-size')).toBeTruthy();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: CONFIRMATION DIALOG ============

function FactoryConfirmationDialogDemo() {
  const confirmation = React.useMemo(() => createFakeConfirmationDialog(), []);
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  return (
    <div data-testid="factory-confirmation-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.confirmationHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.confirmation')}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmation.title}</DialogTitle>
            <DialogDescription>{confirmation.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {confirmation.warningMessage ? (
              <p className="text-destructive text-sm" data-testid="warning-message">
                {i18n.t('dialog.factory.warning')}: {confirmation.warningMessage}
              </p>
            ) : null}
            {confirmation.checkboxLabel ? (
              <label className="flex items-center gap-2 text-sm" data-testid="confirm-checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                {confirmation.checkboxLabel}
              </label>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {i18n.t('dialog.factory.requiresCheckbox')}:{' '}
              {confirmation.requiresCheckbox
                ? i18n.t('dialog.factory.yes')
                : i18n.t('dialog.factory.no')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {confirmation.cancelLabel}
            </Button>
            <Button
              variant={getButtonVariant(confirmation.destructive ?? false)}
              disabled={confirmation.requiresCheckbox && !checked}
              onClick={() => setOpen(false)}
            >
              {confirmation.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryConfirmationDialog: Story = {
  name: i18n.t('dialog.storyName.factoryConfirmationDialog', 'Factory: Confirmation Dialog'),
  render: () => <FactoryConfirmationDialogDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog.querySelector('[data-slot="dialog-title"]')?.textContent?.trim()).not.toBe('');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: FORM DIALOG ============

function FactoryFormDialogDemo() {
  const formDialog = React.useMemo(() => createFakeFormDialog(4), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="factory-form-dialog-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.formDialogHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.formDialog')}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{formDialog.title}</DialogTitle>
            <DialogDescription>{formDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {formDialog.fields.map((field: FakeDialogFormField) => (
              <div key={field.id} className="grid gap-1" data-testid="form-dialog-field">
                <Label>
                  {field.label}
                  {field.required ? ' *' : ''}
                </Label>
                <Input
                  type={field.type === 'select' ? 'text' : field.type}
                  placeholder={field.placeholder ?? ''}
                  defaultValue={
                    typeof field.defaultValue === 'string' ? field.defaultValue : undefined
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {formDialog.cancelLabel}
            </Button>
            <Button onClick={() => setOpen(false)}>{formDialog.confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryFormDialog: Story = {
  name: i18n.t('dialog.storyName.factoryFormDialog', 'Factory: Form Dialog'),
  render: () => <FactoryFormDialogDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    const fields = dialog.querySelectorAll('[data-testid="form-dialog-field"]');
    expect(fields.length).toBe(4);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: WIZARD DIALOG ============

function FactoryWizardDialogDemo() {
  const wizard = React.useMemo(() => createFakeWizardDialog(4), []);
  const [open, setOpen] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(wizard.currentStep);

  const currentStepData: FakeWizardStep | undefined = wizard.steps[currentStep];

  return (
    <div data-testid="factory-wizard-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.wizardHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.wizard')}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{wizard.title}</DialogTitle>
            <DialogDescription>
              {i18n.t('dialog.factory.step')} {currentStep + 1} / {wizard.steps.length}
              {wizard.showProgress ? (
                <span className="text-muted-foreground ml-2">
                  ({i18n.t('dialog.factory.progress')}: {i18n.t('dialog.factory.yes')})
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {currentStepData ? (
              <div data-testid="wizard-step-content">
                <h4 className="font-medium">{currentStepData.title}</h4>
                {currentStepData.description ? (
                  <p className="text-muted-foreground text-sm">{currentStepData.description}</p>
                ) : null}
                {currentStepData.optional ? (
                  <span className="text-muted-foreground text-xs">
                    ({i18n.t('dialog.factory.optional')})
                  </span>
                ) : null}
                {currentStepData.fields ? (
                  <p className="text-muted-foreground text-xs">
                    {i18n.t('dialog.factory.fields')}: {currentStepData.fields.length}
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {i18n.t('dialog.factory.allowSkip')}:{' '}
              {wizard.allowSkip ? i18n.t('dialog.factory.yes') : i18n.t('dialog.factory.no')}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((s) => s - 1)}
              data-testid="wizard-prev"
            >
              {i18n.t('dialog.action.cancel')}
            </Button>
            {currentStep < wizard.steps.length - 1 ? (
              <Button onClick={() => setCurrentStep((s) => s + 1)} data-testid="wizard-next">
                {i18n.t('dialog.action.confirm')}
              </Button>
            ) : (
              <Button onClick={() => setOpen(false)} data-testid="wizard-finish">
                {wizard.confirmLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryWizardDialog: Story = {
  name: i18n.t('dialog.storyName.factoryWizardDialog', 'Factory: Wizard Dialog'),
  render: () => <FactoryWizardDialogDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog.querySelector('[data-testid="wizard-step-content"]')).toBeInTheDocument();

    // Navigate to next step
    const nextBtn = dialog.querySelector('[data-testid="wizard-next"]');
    if (nextBtn) {
      await userEvent.click(nextBtn);
      await waitFor(() => {
        expect(dialog.querySelector('[data-testid="wizard-step-content"]')).toBeInTheDocument();
      });
    }

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: SETTINGS DIALOG ============

function FactorySettingsDialogDemo() {
  const { t } = useTranslation();
  const settings = React.useMemo(() => createFakeSettingsDialog(3), []);
  const [open, setOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState(settings.activeSectionId);

  const currentSection: FakeSettingsSection | undefined = settings.sections.find(
    (s) => s.id === activeSection
  );

  return (
    <div data-testid="factory-settings-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('dialog.factory.settingsHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{t('dialog.factory.settings')}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{settings.title}</DialogTitle>
            <DialogDescription>
              {settings.description}
              {settings.isDirty ? (
                <span className="text-destructive ml-2">({t('dialog.factory.isDirty')})</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 py-4">
            <div className="w-1/3 space-y-1">
              {settings.sections.map((section: FakeSettingsSection) => (
                <button
                  key={section.id}
                  className={`w-full rounded px-3 py-1.5 text-left text-sm ${
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setActiveSection(section.id)}
                  data-testid="settings-section-btn"
                >
                  {section.title}
                </button>
              ))}
            </div>
            <div className="w-2/3">
              {currentSection ? (
                <div data-testid="settings-section-content">
                  <h4 className="mb-2 font-medium">{currentSection.title}</h4>
                  {currentSection.description ? (
                    <p className="text-muted-foreground mb-3 text-sm">
                      {currentSection.description}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    {t('dialog.factory.fields')}: {currentSection.fields.length}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {settings.cancelLabel}
            </Button>
            <Button onClick={() => setOpen(false)}>{settings.confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactorySettingsDialog: Story = {
  name: i18n.t('dialog.storyName.factorySettingsDialog', 'Factory: Settings Dialog'),
  render: () => <FactorySettingsDialogDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog.querySelector('[data-testid="settings-section-content"]')).toBeInTheDocument();

    const sectionBtns = dialog.querySelectorAll('[data-testid="settings-section-btn"]');
    expect(sectionBtns.length).toBe(3);

    // Click second section
    if (sectionBtns[1]) {
      await userEvent.click(sectionBtns[1]);
      await waitFor(() => {
        expect(
          dialog.querySelector('[data-testid="settings-section-content"]')
        ).toBeInTheDocument();
      });
    }

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: ALERT DIALOG ============

function FactoryAlertDialogDemo() {
  const { t } = useTranslation();
  const alertTypes = React.useMemo(
    () =>
      (['info', 'success', 'warning', 'error'] as FakeAlertDialog['alertType'][]).map((alertType) =>
        createFakeAlertDialog(alertType)
      ),
    []
  );

  return (
    <div data-testid="factory-alert-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('dialog.factory.alertHint')}</p>
      <div className="grid gap-3">
        {alertTypes.map((alert: FakeAlertDialog) => (
          <div
            key={alert.id}
            className="rounded-md border p-3"
            data-testid="alert-card"
            data-alert-type={alert.alertType}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase">{alert.alertType}</span>
              {alert.icon ? (
                <span className="text-muted-foreground text-xs">
                  {t('dialog.factory.icon')}: {alert.icon}
                </span>
              ) : null}
            </div>
            <h4 className="font-semibold">{alert.title}</h4>
            <p className="text-muted-foreground text-sm">{alert.description}</p>
            <div className="mt-1 text-xs">
              <span>
                {t('dialog.factory.autoClose')}:{' '}
                {alert.autoClose
                  ? `${t('dialog.factory.yes')} (${alert.autoCloseMs}ms)`
                  : t('dialog.factory.no')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryAlertDialog: Story = {
  name: i18n.t('dialog.storyName.factoryAlertDialog', 'Factory: Alert Dialog'),
  render: () => <FactoryAlertDialogDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-alert-demo"]')).toBeInTheDocument();

    const cards = canvasElement.querySelectorAll('[data-testid="alert-card"]');
    expect(cards.length).toBe(4);

    const alertTypes = ['info', 'success', 'warning', 'error'];
    cards.forEach((card, index) => {
      expect(card.getAttribute('data-alert-type')).toBe(alertTypes[index]);
    });
  },
};

// ============ FACTORY: IMAGE PREVIEW DIALOG ============

function FactoryImagePreviewDialogDemo() {
  const imagePreview = React.useMemo(() => createFakeImagePreviewDialog(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="factory-image-preview-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.imagePreviewHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.imagePreview')}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{imagePreview.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4" data-testid="image-preview-content">
            <div className="bg-muted flex h-48 items-center justify-center rounded-md">
              <p className="text-muted-foreground text-sm">{imagePreview.alt}</p>
            </div>
            {imagePreview.caption ? (
              <p className="text-muted-foreground text-center text-sm" data-testid="image-caption">
                {i18n.t('dialog.factory.caption')}: {imagePreview.caption}
              </p>
            ) : null}
            {imagePreview.downloadUrl ? (
              <p className="text-muted-foreground text-xs" data-testid="image-download">
                {i18n.t('dialog.factory.download')}: {imagePreview.downloadUrl}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{i18n.t('dialog.action.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryImagePreviewDialog: Story = {
  name: i18n.t('dialog.storyName.factoryImagePreviewDialog', 'Factory: Image Preview Dialog'),
  render: () => <FactoryImagePreviewDialogDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog.querySelector('[data-testid="image-preview-content"]')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: VIDEO DIALOG ============

function FactoryVideoDialogDemo() {
  const video = React.useMemo(() => createFakeVideoDialog(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="factory-video-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.videoHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.video')}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{video.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4" data-testid="video-content">
            <div className="bg-muted flex h-48 items-center justify-center rounded-md">
              <p className="text-muted-foreground text-sm">
                {i18n.t('dialog.story.videoPlayerPlaceholder', 'Video Player Placeholder')}
              </p>
            </div>
            <div className="text-muted-foreground grid gap-1 text-xs">
              <p>
                {i18n.t('dialog.factory.duration')}: {Math.floor(video.duration / 60)}:
                {String(video.duration % 60).padStart(2, '0')}
              </p>
              <p>
                {i18n.t('dialog.factory.autoplay')}:{' '}
                {video.autoplay ? i18n.t('dialog.factory.yes') : i18n.t('dialog.factory.no')}
              </p>
              {video.posterUrl ? (
                <p>
                  {i18n.t('dialog.factory.poster')}: {video.posterUrl}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{i18n.t('dialog.action.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryVideoDialog: Story = {
  name: i18n.t('dialog.storyName.factoryVideoDialog', 'Factory: Video Dialog'),
  render: () => <FactoryVideoDialogDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog.querySelector('[data-testid="video-content"]')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: PROFILE EDIT DIALOG ============

function renderDialogFormField(field: FakeDialogFormField) {
  if (field.type === 'textarea') {
    return (
      <textarea
        className="border-input bg-background min-h-[60px] rounded-md border px-3 py-2 text-sm"
        placeholder={field.placeholder ?? ''}
        defaultValue={typeof field.defaultValue === 'string' ? field.defaultValue : undefined}
      />
    );
  }
  if (field.type === 'file') {
    return (
      <div className="border-input rounded-md border p-2 text-sm">
        {field.description ?? 'Choose file'}
      </div>
    );
  }
  return (
    <Input
      type={field.type}
      placeholder={field.placeholder ?? ''}
      defaultValue={typeof field.defaultValue === 'string' ? field.defaultValue : undefined}
    />
  );
}

function FactoryProfileEditDialogDemo() {
  const { t } = useTranslation();
  const profile = React.useMemo(() => createFakeProfileEditDialog(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="factory-profile-edit-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('dialog.factory.profileEditHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{t('dialog.factory.profileEdit')}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{profile.title}</DialogTitle>
            <DialogDescription>{profile.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {profile.fields.map((field: FakeDialogFormField) => (
              <div key={field.id} className="grid gap-1" data-testid="profile-field">
                <Label>
                  {field.label}
                  {field.required ? ' *' : ''}
                </Label>
                {renderDialogFormField(field)}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {profile.cancelLabel}
            </Button>
            <Button onClick={() => setOpen(false)}>{profile.confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryProfileEditDialog: Story = {
  name: i18n.t('dialog.storyName.factoryProfileEditDialog', 'Factory: Profile Edit Dialog'),
  render: () => <FactoryProfileEditDialogDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    const fields = dialog.querySelectorAll('[data-testid="profile-field"]');
    expect(fields.length).toBe(5);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: DELETE CONFIRMATION DIALOG ============

function FactoryDeleteConfirmationDemo() {
  const deleteDialog = React.useMemo(() => createFakeDeleteConfirmationDialog('Test Document'), []);
  const [open, setOpen] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);

  return (
    <div data-testid="factory-delete-confirmation-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t('dialog.factory.deleteConfirmationHint')}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive">{i18n.t('dialog.factory.deleteConfirmation')}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteDialog.title}</DialogTitle>
            <DialogDescription>{deleteDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {deleteDialog.warningMessage ? (
              <p className="text-destructive text-sm" data-testid="delete-warning">
                {deleteDialog.warningMessage}
              </p>
            ) : null}
            {deleteDialog.checkboxLabel ? (
              <label className="flex items-center gap-2 text-sm" data-testid="delete-checkbox">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {deleteDialog.checkboxLabel}
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {deleteDialog.cancelLabel}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteDialog.requiresCheckbox && !confirmed}
              onClick={() => setOpen(false)}
              data-testid="delete-confirm-btn"
            >
              {deleteDialog.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryDeleteConfirmation: Story = {
  name: i18n.t('dialog.storyName.factoryDeleteConfirmation', 'Factory: Delete Confirmation'),
  render: () => <FactoryDeleteConfirmationDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog.querySelector('[data-testid="delete-warning"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-testid="delete-checkbox"]')).toBeInTheDocument();

    // Confirm button should be disabled until checkbox is checked
    const confirmBtn = dialog.querySelector('[data-testid="delete-confirm-btn"]');
    expect(confirmBtn).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: SHARE DIALOG ============

function FactoryShareDialogDemo() {
  const shareDialog = React.useMemo(() => createFakeShareDialog(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="factory-share-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.shareHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.share')}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shareDialog.content.title}</DialogTitle>
            <DialogDescription>{shareDialog.content.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4" data-testid="share-content">
            <div className="text-muted-foreground text-xs">
              <p>
                {i18n.t('dialog.factory.type')}: {shareDialog.type}
              </p>
              <p>
                {i18n.t('dialog.factory.size')}: {shareDialog.size}
              </p>
            </div>
          </div>
          <DialogFooter>
            {shareDialog.buttons.map((btn: FakeDialogButton) => (
              <Button key={btn.id} variant={btn.variant} onClick={() => setOpen(false)}>
                {btn.label}
              </Button>
            ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryShareDialog: Story = {
  name: i18n.t('dialog.storyName.factoryShareDialog', 'Factory: Share Dialog'),
  render: () => <FactoryShareDialogDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog.querySelector('[data-testid="share-content"]')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: ONBOARDING WIZARD ============

function FactoryOnboardingWizardDemo() {
  const onboarding = React.useMemo(() => createFakeOnboardingWizard(), []);
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);

  const currentStepData: FakeWizardStep | undefined = onboarding.steps[step];

  return (
    <div data-testid="factory-onboarding-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.onboardingHint')}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{i18n.t('dialog.factory.onboarding')}</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{onboarding.title}</DialogTitle>
            <DialogDescription>
              {onboarding.description} - {i18n.t('dialog.factory.step')} {step + 1} /{' '}
              {onboarding.steps.length}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4" data-testid="onboarding-step-content">
            {currentStepData ? (
              <>
                <h4 className="font-medium">{currentStepData.title}</h4>
                {currentStepData.description ? (
                  <p className="text-muted-foreground text-sm">{currentStepData.description}</p>
                ) : null}
                {currentStepData.fields?.map((field: FakeDialogFormField) => (
                  <div key={field.id} className="grid gap-1">
                    <Label>{field.label}</Label>
                    <Input placeholder={field.placeholder ?? ''} />
                  </div>
                ))}
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
              data-testid="onboarding-prev"
            >
              {i18n.t('dialog.action.cancel')}
            </Button>
            {step < onboarding.steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} data-testid="onboarding-next">
                {i18n.t('dialog.action.confirm')}
              </Button>
            ) : (
              <Button onClick={() => setOpen(false)} data-testid="onboarding-finish">
                {onboarding.confirmLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const FactoryOnboardingWizard: Story = {
  name: i18n.t('dialog.storyName.factoryOnboardingWizard', 'Factory: Onboarding Wizard'),
  render: () => <FactoryOnboardingWizardDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const trigger = canvasElement.querySelector('[data-slot="dialog-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => body.getByRole('dialog'));
    expect(dialog.querySelector('[data-testid="onboarding-step-content"]')).toBeInTheDocument();

    // Navigate through steps
    const nextBtn = dialog.querySelector('[data-testid="onboarding-next"]');
    if (nextBtn) {
      await userEvent.click(nextBtn);
      await waitFor(() => {
        expect(dialog.querySelector('[data-testid="onboarding-step-content"]')).toBeInTheDocument();
      });
    }

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: DIALOG MATRIX ============

function FactoryDialogMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createFakeDialogMatrix(), []);
  const entries = Object.entries(matrix);

  return (
    <div data-testid="factory-matrix-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('dialog.factory.matrixHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(([key, dialogConfig]: [string, FakeDialog]) => (
          <div
            key={key}
            className="rounded-md border p-3"
            data-testid="matrix-card"
            data-matrix-key={key}
          >
            <h4 className="text-sm font-semibold">{dialogConfig.content.title}</h4>
            <p className="text-muted-foreground text-xs">{dialogConfig.content.description}</p>
            <div className="text-muted-foreground mt-1 text-xs">
              <span>
                {t('dialog.factory.type')}: {dialogConfig.type}
              </span>
              {' | '}
              <span>
                {t('dialog.factory.size')}: {dialogConfig.size}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryDialogMatrix: Story = {
  name: i18n.t('dialog.storyName.factoryDialogMatrix', 'Factory: Dialog Matrix'),
  render: () => <FactoryDialogMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-matrix-demo"]')).toBeInTheDocument();

    const cards = canvasElement.querySelectorAll('[data-testid="matrix-card"]');
    expect(cards.length).toBe(10);

    cards.forEach((card) => {
      expect(card.getAttribute('data-matrix-key')).toBeTruthy();
      expect(card.querySelector('h4')?.textContent?.trim()).not.toBe('');
    });
  },
};

// ============ FACTORY: DIALOG SHOWCASE ============

function FactoryDialogShowcaseDemo() {
  const showcase = React.useMemo(() => createFakeDialogShowcase(), []);
  const entries = Object.entries(showcase);

  return (
    <div data-testid="factory-showcase-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.showcaseHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(
          ([key, config]: [
            string,
            FakeAlertDialog | FakeDialog | FakeFormDialog | FakeSettingsDialog | FakeWizardDialog,
          ]) => (
            <div
              key={key}
              className="rounded-md border p-3"
              data-testid="showcase-card"
              data-showcase-key={key}
            >
              <h4 className="text-sm font-semibold">
                {'content' in config ? config.content.title : config.title}
              </h4>
              <p className="text-muted-foreground text-xs">
                {'content' in config ? config.content.description : config.description}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export const FactoryDialogShowcase: Story = {
  name: i18n.t('dialog.storyName.factoryDialogShowcase', 'Factory: Dialog Showcase'),
  render: () => <FactoryDialogShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-showcase-demo"]')
    ).toBeInTheDocument();

    const cards = canvasElement.querySelectorAll('[data-testid="showcase-card"]');
    expect(cards.length).toBe(12);

    cards.forEach((card) => {
      expect(card.getAttribute('data-showcase-key')).toBeTruthy();
    });
  },
};

// ============ FACTORY: CONSTANTS ============

function FactoryConstantsDemo() {
  // Use all constant exports
  const sizes: DialogSize[] = DIALOG_SIZES;
  const types: DialogType[] = DIALOG_TYPES;
  const positions: DialogPosition[] = DIALOG_POSITIONS;
  const fieldTypes: DialogFormFieldType[] = DIALOG_FORM_FIELD_TYPES;
  const titles = DIALOG_TITLES;
  const confirmLabels = CONFIRM_LABELS;
  const cancelLabels = CANCEL_LABELS;

  return (
    <div data-testid="factory-constants-demo" className="space-y-6">
      <p className="text-muted-foreground text-sm">{i18n.t('dialog.factory.constantsHint')}</p>

      <div>
        <h4 className="mb-2 font-semibold">
          {i18n.t('dialog.factory.size')}s ({sizes.length})
        </h4>
        <div className="flex flex-wrap gap-2" data-testid="constants-sizes">
          {sizes.map((size) => (
            <span key={size} className="bg-muted rounded px-2 py-1 text-xs">
              {size}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">
          {i18n.t('dialog.factory.type')}s ({types.length})
        </h4>
        <div className="flex flex-wrap gap-2" data-testid="constants-types">
          {types.map((type) => (
            <span key={type} className="bg-muted rounded px-2 py-1 text-xs">
              {type}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">
          {i18n.t('dialog.factory.position')}s ({positions.length})
        </h4>
        <div className="flex flex-wrap gap-2" data-testid="constants-positions">
          {positions.map((pos) => (
            <span key={pos} className="bg-muted rounded px-2 py-1 text-xs">
              {pos}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">
          {i18n.t('dialog.factory.fields')} Types ({fieldTypes.length})
        </h4>
        <div className="flex flex-wrap gap-2" data-testid="constants-field-types">
          {fieldTypes.map((ft) => (
            <span key={ft} className="bg-muted rounded px-2 py-1 text-xs">
              {ft}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">Titles ({Object.keys(titles).length} categories)</h4>
        <div className="grid gap-2" data-testid="constants-titles">
          {Object.entries(titles).map(([category, categoryTitles]) => (
            <div key={category} className="text-xs">
              <span className="font-medium">{category}:</span> {categoryTitles.join(', ')}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">
          Confirm Labels ({Object.keys(confirmLabels).length} categories)
        </h4>
        <div className="grid gap-2" data-testid="constants-confirm-labels">
          {Object.entries(confirmLabels).map(([category, labels]) => (
            <div key={category} className="text-xs">
              <span className="font-medium">{category}:</span> {labels.join(', ')}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">Cancel Labels ({cancelLabels.length})</h4>
        <div className="flex flex-wrap gap-2" data-testid="constants-cancel-labels">
          {cancelLabels.map((label) => (
            <span key={label} className="bg-muted rounded px-2 py-1 text-xs">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  name: i18n.t('dialog.storyName.factoryConstants', 'Factory: Constants'),
  render: () => <FactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-constants-demo"]')
    ).toBeInTheDocument();

    // Verify all constant sections are rendered
    expect(canvasElement.querySelector('[data-testid="constants-sizes"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="constants-types"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="constants-positions"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="constants-field-types"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="constants-titles"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="constants-confirm-labels"]')
    ).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="constants-cancel-labels"]')
    ).toBeInTheDocument();

    // Verify sizes count
    const sizeItems = canvasElement.querySelectorAll('[data-testid="constants-sizes"] span');
    expect(sizeItems.length).toBe(5);

    // Verify types count
    const typeItems = canvasElement.querySelectorAll('[data-testid="constants-types"] span');
    expect(typeItems.length).toBe(6);

    // Verify positions count
    const posItems = canvasElement.querySelectorAll('[data-testid="constants-positions"] span');
    expect(posItems.length).toBe(5);

    // Verify field types count
    const fieldTypeItems = canvasElement.querySelectorAll(
      '[data-testid="constants-field-types"] span'
    );
    expect(fieldTypeItems.length).toBe(9);

    // Verify cancel labels count
    const cancelItems = canvasElement.querySelectorAll(
      '[data-testid="constants-cancel-labels"] span'
    );
    expect(cancelItems.length).toBe(5);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('dialog.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('dialog.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('dialog.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('dialog.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// OVERLAY STATUS HANDLER STORIES
// ============================================================================

export const OverlayError400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayError401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayError403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayError404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayError422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayError429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayError500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayError502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayError503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayError504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayLoading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlaySlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OverlayNetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: overlayStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('dialog.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dialogStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerOverlaySuccess: Story = {
  ...Default,
  name: i18n.t('dialog.storyName.handlerOverlaySuccess', 'Handler: Overlay Success'),
  parameters: { msw: { handlers: overlayStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerOverlayEmptyContent: Story = {
  ...Default,
  name: i18n.t('dialog.storyName.handlerOverlayEmptyContent', 'Handler: Overlay Empty Content'),
  parameters: { msw: { handlers: overlayStatusHandlers.emptyContent } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerOverlayOpenDrawer: Story = {
  ...Default,
  name: i18n.t('dialog.storyName.handlerOverlayOpenDrawer', 'Handler: Overlay Open Drawer'),
  parameters: { msw: { handlers: overlayStatusHandlers.openDrawer } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerOverlayOpenSheet: Story = {
  ...Default,
  name: i18n.t('dialog.storyName.handlerOverlayOpenSheet', 'Handler: Overlay Open Sheet'),
  parameters: { msw: { handlers: overlayStatusHandlers.openSheet } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

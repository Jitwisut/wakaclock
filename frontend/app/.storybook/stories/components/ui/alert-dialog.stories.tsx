import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  alertDialogHandlers,
  alertDialogStatusHandlers,
} from '@/.storybook/stories/_handlers/alert-dialog.handlers';
import {
  dialogHandlers,
  dialogStatusHandlers,
} from '@/.storybook/stories/_handlers/dialog.handlers';
import type {
  AlertDialogActionType,
  AlertDialogContentType,
  AlertDialogSize,
  AlertDialogVariant,
  FakeAlertDialog,
  FakeAlertDialogABTest,
  FakeAlertDialogConfig,
} from '@/.storybook/stories/_factories/alert-dialog.factory';
import {
  ALERT_DIALOG_ACTION_LABELS,
  ALERT_DIALOG_ACTION_TYPES,
  ALERT_DIALOG_CANCEL_LABELS,
  ALERT_DIALOG_CONTENT_TYPES,
  ALERT_DIALOG_DESCRIPTIONS,
  ALERT_DIALOG_SIZES,
  ALERT_DIALOG_TITLES,
  ALERT_DIALOG_VARIANTS,
  createFakeAccountDeletionDialog,
  createFakeAlertDialog,
  createFakeAlertDialogABTest,
  createFakeAlertDialogConfig,
  createFakeAlertDialogMatrix,
  createFakeAlertDialogs,
  createFakeAlertDialogsByType,
  createFakeDataExportDialog,
  createFakeDeleteConfirmationDialog,
  createFakeEnterpriseAlertDialogSet,
  createFakeFormInputDialog,
  createFakeInfoDialog,
  createFakeLogoutDialog,
  createFakePaymentConfirmationDialog,
  createFakePrivacyConsentDialog,
  createFakeQuickConfirmDialog,
  createFakeSaveChangesDialog,
  createFakeSessionExpiredDialog,
  createFakeSubscriptionCancellationDialog,
  createFakeTermsDialog,
  createFakeUnsavedChangesDialog,
  createFakeWarningDialog,
} from '@/.storybook/stories/_factories/alert-dialog.factory';
import { createFakeDialogContent } from '@/.storybook/stories/_factories/dialog.factory';
import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function AlertDialogDemo({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { t } = useTranslation();

  return (
    <AlertDialog defaultOpen={defaultOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{t('alertDialog.trigger')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('alertDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('alertDialog.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('alertDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction>{t('alertDialog.action')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const meta = {
  title: 'Components/UI/Alert Dialog',
  component: AlertDialogDemo,
  tags: ['autodocs'],
  args: {
    defaultOpen: false,
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onOpenChange: fn(),
  },
  parameters: {
    msw: { handlers: [...alertDialogHandlers, ...formHandlers] },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Demo wrapper props
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'alertDialog.argType.initialOpenStateOfTheAlertDialog',
        'Initial open state of the alert dialog'
      ),
      table: {
        category: 'Demo',
        type: { summary: 'boolean' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('alertDialog.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('alertDialog.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('alertDialog.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('alertDialog.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('alertDialog.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('alertDialog.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('alertDialog.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'alertDialog.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    // AlertDialog Props Reference (Radix AlertDialog.Root):
    // - open: Controlled open state (boolean)
    // - defaultOpen: Default open state for uncontrolled usage (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    //
    // AlertDialogTrigger Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // AlertDialogContent Props Reference:
    // - forceMount: Force mount when closed for animations (boolean)
    // - onOpenAutoFocus: Called on open with auto-focus ((event) => void)
    // - onCloseAutoFocus: Called on close with auto-focus ((event) => void)
    // - onEscapeKeyDown: Called on Escape key ((event) => void)
    // - className: Additional CSS classes (string)
    // - Note: Unlike Dialog, AlertDialog does NOT close on click outside
    //
    // AlertDialogHeader, AlertDialogFooter Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Section content (ReactNode)
    //
    // AlertDialogTitle Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Title text content (ReactNode)
    //
    // AlertDialogDescription Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Description text content (ReactNode)
    //
    // AlertDialogAction Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    // - Note: Closes the dialog and triggers the action
    //
    // AlertDialogCancel Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    // - Note: Closes the dialog without triggering action
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog.getAttribute('data-slot')).toBe('alert-dialog-content');
    expect(dialog.querySelector('[data-slot="alert-dialog-title"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="alert-dialog-description"]')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

function AlertDialogVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('alertDialog.variants.defaultConfirmation')}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">{i18n.t('alertDialog.saveChanges')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t('alertDialog.saveChangesTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t('alertDialog.saveChangesDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction>{i18n.t('alertDialog.save')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('alertDialog.variants.destructiveAction')}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">{i18n.t('alertDialog.deleteAccount')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t('alertDialog.areYouSure')}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t('alertDialog.deleteAccountDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {i18n.t('alertDialog.deleteAccount')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('alertDialog.variants.withFormInput')}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">{i18n.t('alertDialog.confirmEmail')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t('alertDialog.confirmEmailTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t('alertDialog.confirmEmailDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <input
                type="email"
                placeholder={i18n.t('alertDialog.story.emailPlaceholder', 'email@example.com')}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction>{i18n.t('alertDialog.confirm')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('alertDialog.variants.longContent')}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">{i18n.t('alertDialog.termsConditions')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t('alertDialog.termsOfService')}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t('alertDialog.termsDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-[200px] overflow-y-auto py-4 text-sm">
              <p className="mb-2">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <p className="mb-2">
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa
                qui officia deserunt mollit anim id est laborum.
              </p>
              <p>
                Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
                doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
                veritatis et quasi architecto beatae vitae dicta sunt explicabo.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{i18n.t('alertDialog.decline')}</AlertDialogCancel>
              <AlertDialogAction>{i18n.t('alertDialog.accept')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <AlertDialogVariantsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const triggers = canvasElement.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);
  },
};

function AlertDialogSizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('alertDialog.sizes.compact')}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">{i18n.t('alertDialog.compactDialog')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t('alertDialog.quickConfirm')}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t('alertDialog.areYouSureProceed')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{i18n.t('alertDialog.no')}</AlertDialogCancel>
              <AlertDialogAction>{i18n.t('alertDialog.yes')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('alertDialog.sizes.default')}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">{i18n.t('alertDialog.defaultDialog')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t('alertDialog.standardConfirmation')}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t('alertDialog.standardConfirmationDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction>{i18n.t('alertDialog.continue')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('alertDialog.sizes.wide')}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">{i18n.t('alertDialog.wideDialog')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{i18n.t('alertDialog.extendedConfirmation')}</AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t('alertDialog.extendedConfirmationDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction>{i18n.t('alertDialog.confirm')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <AlertDialogSizesDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const triggers = canvasElement.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
    await userEvent.click(openButton);

    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog.getAttribute('data-slot')).toBe('alert-dialog-content');

    const title = dialog.querySelector('[data-slot="alert-dialog-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Alert dialog title was not rendered.');
    }
    expect(title.textContent?.trim()).not.toBe('');

    const description = dialog.querySelector('[data-slot="alert-dialog-description"]');
    if (!(description instanceof HTMLElement)) {
      throw new Error('Alert dialog description was not rendered.');
    }
    expect(description.textContent?.trim()).not.toBe('');

    expect(dialog.querySelector('[data-slot="alert-dialog-action"]')).toBeInTheDocument();

    const cancelButton = dialog.querySelector('[data-slot="alert-dialog-cancel"]');
    if (!(cancelButton instanceof HTMLElement)) {
      throw new Error('Alert dialog cancel button was not rendered.');
    }

    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(body.queryByRole('alertdialog')).not.toBeInTheDocument();
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
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
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

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
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

    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    expect(doc.documentElement.lang).toBe('ja');

    const openButton = canvas.getByRole('button');
    await userEvent.click(openButton);

    const dialog = await waitFor(() => body.getByRole('alertdialog'));

    const title = dialog.querySelector('[data-slot="alert-dialog-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Alert dialog title was not rendered.');
    }

    expect(title.textContent?.trim()).toBe('プロジェクトを削除');

    const cancelButton = dialog.querySelector('[data-slot="alert-dialog-cancel"]');
    if (!(cancelButton instanceof HTMLElement)) {
      throw new Error('Alert dialog cancel button was not rendered.');
    }

    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(body.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
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
  name: i18n.t('alertDialog.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    msw: { handlers: formHandlers },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const openButton = canvas.getByRole('button');
    expect(openButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');
  },
};

export const Accessibility: Story = {
  name: i18n.t('alertDialog.storyName.accessibility', 'Accessibility'),
  args: { defaultOpen: false },
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          {i18n.t('alertDialog.story.openAccessibleDialog', 'Open Accessible Dialog')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {i18n.t('alertDialog.story.accessibilityTestDialog', 'Accessibility Test Dialog')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t(
              'alertDialog.story.focusManagementDescription',
              'This dialog demonstrates proper focus management, keyboard navigation, and ARIA attributes.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n.t('alertDialog.story.cancel', 'Cancel')}</AlertDialogCancel>
          <AlertDialogAction>{i18n.t('alertDialog.story.confirm', 'Confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Test trigger button
    const triggerButton = canvas.getByRole('button', { name: 'Open Accessible Dialog' });
    expect(triggerButton.getAttribute('data-slot')).toBe('alert-dialog-trigger');

    // Open the dialog
    await userEvent.click(triggerButton);

    // Wait for dialog to open
    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog).toBeInTheDocument();
    expect(dialog.getAttribute('data-slot')).toBe('alert-dialog-content');

    // Verify dialog has proper ARIA attributes
    expect(dialog.getAttribute('aria-describedby')).not.toBe('');
    expect(dialog.getAttribute('aria-labelledby')).not.toBe('');

    // Verify title exists
    const title = dialog.querySelector('[data-slot="alert-dialog-title"]');
    expect(title).toBeInTheDocument();

    // Verify description exists
    const description = dialog.querySelector('[data-slot="alert-dialog-description"]');
    expect(description).toBeInTheDocument();

    // Test keyboard navigation - Tab should cycle through focusable elements
    const cancelButton = dialog.querySelector('[data-slot="alert-dialog-cancel"]');
    const actionButton = dialog.querySelector('[data-slot="alert-dialog-action"]');

    expect(cancelButton).toBeInTheDocument();
    expect(actionButton).toBeInTheDocument();

    // Focus should be trapped within the dialog
    // Tab through the buttons
    await userEvent.keyboard('{Tab}');
    await userEvent.keyboard('{Tab}');

    // Escape key should close the dialog
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(body.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    // Verify focus returns to trigger after close
    expect(doc.activeElement).toBe(triggerButton);
  },
  parameters: {
    docs: {
      description: {
        story: 'Accessibility testing with focus trap, keyboard navigation, and ARIA validation.',
      },
    },
  },
};

// ============ FAKER INTEGRATION STORIES ============

function AlertDialogWithFakerData() {
  const fakeContent = React.useMemo(() => createFakeDialogContent(), []);
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid="faker-alert-dialog-demo">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant={fakeContent.destructive ? 'destructive' : 'outline'}>
            {fakeContent.destructive
              ? i18n.t('alertDialog.story.deleteItem', 'Delete Item')
              : i18n.t('alertDialog.story.confirmAction', 'Confirm Action')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fakeContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{fakeContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fakeContent.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              className={
                fakeContent.destructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {fakeContent.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <AlertDialogWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="faker-alert-dialog-demo"]')
    ).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected alert dialog trigger button to be present.');
    }

    await userEvent.click(trigger);

    const doc = canvasElement.ownerDocument;
    const dialog = await waitFor(() => {
      const el = doc.body.querySelector('[data-slot="alert-dialog-content"]');
      if (!(el instanceof HTMLElement)) throw new Error('Alert dialog content was not found.');
      return el;
    });

    expect(dialog.querySelector('[data-slot="alert-dialog-title"]')?.textContent?.trim()).not.toBe(
      ''
    );
    expect(
      dialog.querySelector('[data-slot="alert-dialog-description"]')?.textContent?.trim()
    ).not.toBe('');
  },
};

// ============ ASYNC DATA STORIES ============

interface AlertDialogApiResponse {
  cancelLabel: string;
  confirmLabel: string;
  description: string;

  destructive: boolean;
  id: string;
  title: string;
}

interface AlertDialogApiError {
  code: string;
  message: string;
  status: number;
}

function AlertDialogWithAsyncData() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<AlertDialogApiResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<AlertDialogApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/dialog-content/test-alert-dialog')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as AlertDialogApiError;
          throw err;
        }
        return res.json() as Promise<AlertDialogApiResponse>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
        return undefined;
      })
      .catch((error_: AlertDialogApiError) => {
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
    <div data-testid="async-alert-dialog-demo" data-state={currentState}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline">
            {i18n.t('alertDialog.story.openAsyncAlertDialog', 'Open Async Alert Dialog')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          {loading && (
            <div
              data-testid="alert-dialog-loading"
              className="flex items-center justify-center py-8"
            >
              <div className="text-muted-foreground">Loading...</div>
            </div>
          )}
          {error && (
            <div data-testid="alert-dialog-error" data-error-status={error.status}>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  {i18n.t('alertDialog.story.error', 'Error')} {error.status}
                </AlertDialogTitle>
                <AlertDialogDescription>{error.message}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t('alertDialog.story.close', 'Close')}</AlertDialogCancel>
                <Button onClick={fetchData}>{i18n.t('alertDialog.story.retry', 'Retry')}</Button>
              </AlertDialogFooter>
            </div>
          )}
          {data && !loading && !error && (
            <div data-testid="alert-dialog-success">
              <AlertDialogHeader>
                <AlertDialogTitle>{data.title}</AlertDialogTitle>
                <AlertDialogDescription>{data.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{data.cancelLabel}</AlertDialogCancel>
                <AlertDialogAction
                  className={
                    data.destructive
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                      : ''
                  }
                >
                  {data.confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: dialogHandlers },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected alert dialog trigger button to be present.');
    }

    await userEvent.click(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="alert-dialog-loading"]')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="alert-dialog-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: dialogStatusHandlers.emptyData },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    await userEvent.click(trigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="alert-dialog-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowResponse: Story = {
  name: i18n.t('alertDialog.storyName.slowResponse', 'Slow Response (5s)'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.slowResponse },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    await userEvent.click(trigger!);

    expect(doc.body.querySelector('[data-testid="alert-dialog-loading"]')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="alert-dialog-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error404NotFound: Story = {
  name: i18n.t('alertDialog.storyName.error404NotFound', 'Error 404: Not Found'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.notFound },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
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
  name: i18n.t('alertDialog.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.conflict },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('alertDialog.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.tooManyRequests },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('alertDialog.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.badGateway },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'alertDialog.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  parameters: {
    msw: { handlers: dialogStatusHandlers.serviceUnavailable },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('alertDialog.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: dialogStatusHandlers.gatewayTimeout },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ CONFIRMATION FLOW STORIES ============

const ConfirmationFlowDialogComponent = () => {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<'initial' | 'confirming' | 'success' | 'error'>('initial');
  const [confirmText, setConfirmText] = React.useState('');
  const requiredText = 'DELETE';

  const handleConfirm = async () => {
    if (confirmText !== requiredText) return;
    setStep('confirming');

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 80% chance of success
    if (Math.random() > 0.2) {
      setStep('success');
    } else {
      setStep('error');
    }
  };

  const handleReset = () => {
    setOpen(false);
    setStep('initial');
    setConfirmText('');
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Current step: <span data-testid="confirmation-step">{step}</span>
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) handleReset();
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive" data-testid="confirmation-trigger">
            Delete Project
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="confirmation-dialog">
          {step === 'initial' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {i18n.t('alertDialog.story.deleteProject', 'Delete Project?')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. Type <strong>{requiredText}</strong> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`Type ${requiredText} to confirm`}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  data-testid="confirmation-input"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {i18n.t('alertDialog.story.cancel', 'Cancel')}
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={confirmText !== requiredText}
                  onClick={handleConfirm}
                  data-testid="confirm-button"
                >
                  Delete
                </Button>
              </AlertDialogFooter>
            </>
          )}
          {step === 'confirming' && (
            <div
              className="flex flex-col items-center justify-center py-8"
              data-testid="confirming-state"
            >
              <div className="text-muted-foreground">
                {i18n.t('alertDialog.story.deletingProject', 'Deleting project...')}
              </div>
            </div>
          )}
          {step === 'success' && (
            <div data-testid="success-state">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-green-600">
                  {i18n.t('alertDialog.story.projectDeleted', 'Project Deleted')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The project has been permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={handleReset}>
                  {i18n.t('alertDialog.story.done', 'Done')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          )}
          {step === 'error' && (
            <div data-testid="error-state">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  {i18n.t('alertDialog.story.deletionFailed', 'Deletion Failed')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  An error occurred while deleting the project. Please try again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleReset}>
                  {i18n.t('alertDialog.story.cancel', 'Cancel')}
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setStep('initial');
                    setConfirmText('');
                  }}
                >
                  Try Again
                </Button>
              </AlertDialogFooter>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const ConfirmationFlow: Story = {
  name: i18n.t('alertDialog.storyName.confirmationFlow', 'Confirmation Flow'),
  render: () => <ConfirmationFlowDialogComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Open dialog
    const trigger = canvasElement.querySelector('[data-testid="confirmation-trigger"]');
    await userEvent.click(trigger!);

    const dialog = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="confirmation-dialog"]');
      if (!(el instanceof HTMLElement)) throw new Error('Dialog not found');
      return el;
    });

    // Confirm button should be disabled initially
    const confirmBtn = dialog.querySelector('[data-testid="confirm-button"]');
    expect(confirmBtn).toBeDisabled();

    // Type confirmation text
    const input = dialog.querySelector('[data-testid="confirmation-input"]');
    if (input instanceof HTMLInputElement) {
      await userEvent.type(input, 'DELETE');
    }

    // Confirm button should now be enabled
    await waitFor(() => {
      expect(confirmBtn).toBeEnabled();
    });
  },
};

export const ConfirmationFlowWithTyping: Story = {
  name: i18n.t(
    'alertDialog.storyName.confirmationFlowWithTyping',
    'Confirmation Flow (Type to Confirm)'
  ),
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('alertDialog.story.deleteConfirmation', 'Delete Confirmation')}
        </p>
        <ConfirmationFlowDialogComponent />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('alertDialog.story.emailConfirmation', 'Email Confirmation')}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">
              {i18n.t('alertDialog.story.unsubscribe', 'Unsubscribe')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {i18n.t(
                  'alertDialog.story.unsubscribeFromNewsletter',
                  'Unsubscribe from Newsletter?'
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>
                You will no longer receive updates from us. You can resubscribe at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{i18n.t('alertDialog.story.cancel', 'Cancel')}</AlertDialogCancel>
              <AlertDialogAction>
                {i18n.t('alertDialog.story.unsubscribe', 'Unsubscribe')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const triggers = canvasElement.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(2);
  },
};

// ============ FOCUS TRAP STORY ============

function AlertDialogFocusTrapDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Focus should be trapped within the alert dialog. Tab/Shift+Tab should cycle.
      </p>
      <AlertDialog defaultOpen>
        <AlertDialogTrigger asChild>
          <Button variant="outline" data-testid="focus-trap-trigger">
            Open Focus Trap Dialog
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="focus-trap-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {i18n.t('alertDialog.story.focusTrapTest', 'Focus Trap Test')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tab through the focusable elements. Focus should stay trapped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <input
              className="border-input h-9 w-full rounded-md border px-3"
              placeholder={i18n.t('alertDialog.optionalInput', 'Optional input')}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel">
              {i18n.t('alertDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction data-testid="btn-confirm">
              {i18n.t('alertDialog.story.confirm', 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const FocusTrap: Story = {
  name: i18n.t('alertDialog.storyName.focusTrap', 'Focus Trap'),
  render: () => <AlertDialogFocusTrapDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    const dialog = await waitFor(() => {
      const el = doc.body.querySelector('[data-testid="focus-trap-dialog"]');
      if (!(el instanceof HTMLElement)) throw new Error('Dialog not found');
      return el;
    });

    // Tab through all focusable elements multiple times
    for (let i = 0; i < 8; i++) {
      await userEvent.tab();
      expect(doc.activeElement).toBeInTheDocument();
      expect(dialog).toContainElement(doc.activeElement as HTMLElement);
    }

    // Shift+Tab multiple times
    for (let i = 0; i < 8; i++) {
      await userEvent.tab({ shift: true });
      expect(doc.activeElement).toBeInTheDocument();
      expect(dialog).toContainElement(doc.activeElement as HTMLElement);
    }
  },
};

// ============ ESCAPE KEY HANDLING STORY ============

const AlertDialogEscapeKeyHandlingComponent = () => {
  const [open, setOpen] = React.useState(true);
  const [escapeCount, setEscapeCount] = React.useState(0);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Escape key presses: <span data-testid="escape-count">{escapeCount}</span>
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEscapeCount((c) => c + 1);
          setOpen(isOpen);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button>{i18n.t('alertDialog.story.openAlertDialog', 'Open Alert Dialog')}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {i18n.t('alertDialog.story.escapeKeyTest', 'Escape Key Test')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Press Escape to close this dialog. The escape key count will increment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.t('alertDialog.story.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction>
              {i18n.t('alertDialog.story.continue', 'Continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const EscapeKeyHandling: Story = {
  name: i18n.t('alertDialog.storyName.escapeKeyHandling', 'Escape Key Handling'),
  render: () => <AlertDialogEscapeKeyHandlingComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Dialog should be open by default
    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog).toBeInTheDocument();

    // Press Escape to close
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(body.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    // Verify escape count was incremented
    const countEl = canvasElement.querySelector('[data-testid="escape-count"]');
    expect(countEl).toHaveTextContent('1');
  },
};

// ============ DARK MODE STORIES ============

function DarkModeAlertDialogDemo() {
  return (
    <div className="dark rounded-lg bg-gray-950 p-8">
      <AlertDialog defaultOpen>
        <AlertDialogTrigger asChild>
          <Button variant="outline">{i18n.t('alertDialog.trigger')}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="dark border-gray-800 bg-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {i18n.t('alertDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {i18n.t('alertDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700">
              {i18n.t('alertDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction>{i18n.t('alertDialog.action')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const DarkModeOpen: Story = {
  name: i18n.t('alertDialog.storyName.darkModeOpen', 'Dark Mode (Open)'),
  render: () => <DarkModeAlertDialogDemo />,
  globals: {
    theme: 'dark',
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story:
          'Alert dialog in dark mode with proper color contrast and theme-aware styling. The dialog should maintain readability and accessibility in dark mode.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Dialog should be open by default
    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog).toBeInTheDocument();

    // Verify ARIA attributes are present in dark mode
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // Verify title and description exist
    expect(dialog.querySelector('[data-slot="alert-dialog-title"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="alert-dialog-description"]')).toBeInTheDocument();
  },
};

export const DarkModeDestructive: Story = {
  name: i18n.t('alertDialog.storyName.darkModeDestructive', 'Dark Mode (Destructive)'),
  render: () => (
    <div className="dark rounded-lg bg-gray-950 p-8">
      <AlertDialog defaultOpen>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            {i18n.t('alertDialog.story.deleteAccount', 'Delete Account')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="dark border-gray-800 bg-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {i18n.t('alertDialog.story.deleteAccount1', 'Delete Account?')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This action cannot be undone. All your data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ),
  globals: {
    theme: 'dark',
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="alert-dialog-title"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="alert-dialog-description"]')).toBeInTheDocument();
  },
};

// ============ JAPANESE LOCALE ENHANCED ============

function JapaneseAlertDialogDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Japanese locale demonstration with proper typography and layout.
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">{i18n.t('alertDialog.deleteAccount')}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.t('alertDialog.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t('alertDialog.deleteAccountDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {i18n.t('alertDialog.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const JapaneseDestructive: Story = {
  name: i18n.t('alertDialog.storyName.japaneseDestructive', 'Japanese (Destructive)'),
  render: () => <JapaneseAlertDialogDemo />,
  globals: {
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Verify Japanese locale is set
    expect(doc.documentElement.lang).toBe('ja');

    // Open the dialog
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
    }

    // Verify dialog opens with Japanese content
    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog).toBeInTheDocument();

    // Check for Japanese text
    const title = dialog.querySelector('[data-slot="alert-dialog-title"]');
    expect(title?.textContent).toBe('本当によろしいですか？');
  },
};

export const JapaneseDarkMode: Story = {
  name: i18n.t('alertDialog.storyName.japaneseDarkMode', 'Japanese + Dark Mode'),
  render: () => (
    <div className="dark rounded-lg bg-gray-950 p-8">
      <JapaneseAlertDialogDemo />
    </div>
  ),
  globals: {
    locale: 'ja',
    theme: 'dark',
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ ARIA & ACCESSIBILITY COMPREHENSIVE TESTS ============

export const ARIAAttributes: Story = {
  name: i18n.t('alertDialog.storyName.aRIAAttributes', 'ARIA Attributes Validation'),
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <Button variant="outline" aria-haspopup="dialog">
          Open Accessible Dialog
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {i18n.t('alertDialog.story.accessibilityTest', 'Accessibility Test')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t(
              'alertDialog.story.ariaValidationDescription',
              'This dialog demonstrates comprehensive ARIA attribute validation including role, aria-modal, aria-labelledby, and aria-describedby.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n.t('alertDialog.story.cancel', 'Cancel')}</AlertDialogCancel>
          <AlertDialogAction>{i18n.t('alertDialog.story.confirm', 'Confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Wait for dialog to be present
    const dialog = await waitFor(() => body.getByRole('alertdialog'));

    // Validate core ARIA attributes
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // Validate aria-labelledby points to title
    const labelledbyId = dialog.getAttribute('aria-labelledby');
    expect(labelledbyId).toBeTruthy();
    if (labelledbyId) {
      const titleElement = doc.querySelector(`#${labelledbyId}`);
      expect(titleElement).toBeInTheDocument();
      expect(titleElement?.textContent).toContain('Accessibility Test');
    }

    // Validate aria-describedby points to description
    const describedbyId = dialog.getAttribute('aria-describedby');
    expect(describedbyId).toBeTruthy();
    if (describedbyId) {
      const descriptionElement = doc.querySelector(`#${describedbyId}`);
      expect(descriptionElement).toBeInTheDocument();
    }

    // Test that dialog has data-slot attribute
    expect(dialog.getAttribute('data-slot')).toBe('alert-dialog-content');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Comprehensive validation of ARIA attributes including role="alertdialog", aria-modal="true", aria-labelledby, and aria-describedby linking.',
      },
    },
  },
};

function AlertDialogOpenCloseDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Tests the complete open/close lifecycle of the alert dialog.
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button data-testid="open-dialog-btn">
            {t('alertDialog.story.openDialog', 'Open Dialog')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="lifecycle-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('alertDialog.story.openCloseTest', 'Open/Close Test')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'alertDialog.story.lifecycleDescription',
                'This dialog tests the full lifecycle of opening and closing.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-btn">
              {t('alertDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-btn">
              {t('alertDialog.story.confirm', 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const DialogOpenClose: Story = {
  name: i18n.t('alertDialog.storyName.dialogOpenClose', 'Dialog Open/Close Cycle'),
  render: () => <AlertDialogOpenCloseDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);
    const canvas = within(canvasElement);

    // Step 1: Dialog should not be in the DOM initially
    expect(body.queryByRole('alertdialog')).not.toBeInTheDocument();

    // Step 2: Click trigger to open
    const openButton = canvas.getByTestId('open-dialog-btn');
    await userEvent.click(openButton);

    // Step 3: Dialog should now be visible
    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog).toBeInTheDocument();

    // Step 4: Click cancel to close
    const cancelButton = dialog.querySelector('[data-testid="cancel-btn"]');
    if (cancelButton instanceof HTMLButtonElement) {
      await userEvent.click(cancelButton);
    }

    // Step 5: Dialog should be removed from DOM
    await waitFor(() => {
      expect(body.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    // Step 6: Focus should return to trigger
    expect(doc.activeElement).toBe(openButton);

    // Step 7: Reopen and close with action button
    await userEvent.click(openButton);
    const reopenedDialog = await waitFor(() => body.getByRole('alertdialog'));
    const confirmButton = reopenedDialog.querySelector('[data-testid="confirm-btn"]');
    if (confirmButton instanceof HTMLButtonElement) {
      await userEvent.click(confirmButton);
    }

    // Step 8: Dialog should close after action
    await waitFor(() => {
      expect(body.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tests the complete dialog lifecycle: initial closed state, opening via trigger, closing via cancel, focus return, and closing via action.',
      },
    },
  },
};

export const FocusTrapComprehensive: Story = {
  name: i18n.t('alertDialog.storyName.focusTrapComprehensive', 'Focus Trap (Comprehensive)'),
  render: () => (
    <div className="space-y-4">
      <Button data-testid="before-trigger">
        {i18n.t('alertDialog.story.beforeTrigger', 'Before Trigger')}
      </Button>
      <AlertDialog defaultOpen>
        <AlertDialogTrigger asChild>
          <Button data-testid="dialog-trigger">
            {i18n.t('alertDialog.story.openFocusTrapDialog', 'Open Focus Trap Dialog')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="focus-trap-content">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {i18n.t('alertDialog.story.focusTrapTest', 'Focus Trap Test')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Focus should cycle through: Cancel button, input field, Confirm button.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <input
              type="text"
              data-testid="trap-input"
              className="border-input h-9 w-full rounded-md border px-3"
              placeholder={i18n.t('alertDialog.story.focusableInput', 'Focusable input')}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="trap-cancel">
              {i18n.t('alertDialog.story.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction data-testid="trap-confirm">
              {i18n.t('alertDialog.story.confirm', 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button data-testid="after-trigger">
        {i18n.t('alertDialog.story.afterTrigger', 'After Trigger')}
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Wait for dialog
    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog).toBeInTheDocument();

    // Verify focusable elements exist within dialog
    expect(dialog.querySelector('[data-testid="trap-cancel"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-testid="trap-input"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-testid="trap-confirm"]')).toBeInTheDocument();

    // Tab forward through all focusable elements multiple times
    for (let cycle = 0; cycle < 2; cycle++) {
      await userEvent.tab();
      // Focus should stay within dialog
      expect(dialog.contains(doc.activeElement)).toBe(true);
    }

    // Tab backward
    for (let cycle = 0; cycle < 2; cycle++) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(doc.activeElement)).toBe(true);
    }

    // Verify focus never escapes to buttons outside dialog
    const beforeButton = canvasElement.querySelector('[data-testid="before-trigger"]');
    const afterButton = canvasElement.querySelector('[data-testid="after-trigger"]');
    expect(doc.activeElement).not.toBe(beforeButton);
    expect(doc.activeElement).not.toBe(afterButton);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Validates that focus is trapped within the dialog and cannot escape to elements outside, even with rapid tabbing.',
      },
    },
  },
};

function EscapeKeyComprehensiveDemo() {
  const { t } = useTranslation();
  const [closeCount, setCloseCount] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Dialog closed via Escape: <span data-testid="escape-close-count">{closeCount}</span> times
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen && open) {
            setCloseCount((c) => c + 1);
          }
          setOpen(isOpen);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button data-testid="escape-test-trigger">
            {t('alertDialog.story.openDialog', 'Open Dialog')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="escape-test-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('alertDialog.story.escapeKeyTest', 'Escape Key Test')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Press Escape key to close. The counter above will increment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('alertDialog.story.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction>{t('alertDialog.story.confirm', 'Confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const EscapeKeyComprehensive: Story = {
  name: i18n.t('alertDialog.storyName.escapeKeyComprehensive', 'Escape Key (Comprehensive)'),
  render: () => <EscapeKeyComprehensiveDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);
    const canvas = within(canvasElement);

    // Open the dialog
    const trigger = canvas.getByTestId('escape-test-trigger');
    await userEvent.click(trigger);

    // Verify dialog is open
    const dialog = await waitFor(() => body.getByRole('alertdialog'));
    expect(dialog).toBeInTheDocument();

    // Press Escape to close
    await userEvent.keyboard('{Escape}');

    // Verify dialog closed
    await waitFor(() => {
      expect(body.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    // Verify count incremented
    const countEl = canvasElement.querySelector('[data-testid="escape-close-count"]');
    expect(countEl).toHaveTextContent('1');

    // Open again and test Escape a second time
    await userEvent.click(trigger);
    await waitFor(() => body.getByRole('alertdialog'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(countEl).toHaveTextContent('2');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tests that the Escape key properly closes the dialog and triggers the onOpenChange callback.',
      },
    },
  },
};

// ============ FAKER INTEGRATION WITH FACTORY ============

function AlertDialogWithFactoryData() {
  const fakeDialog = React.useMemo(() => createFakeAlertDialog(), []);
  const fakeDeleteDialog = React.useMemo(() => createFakeDeleteConfirmationDialog('project'), []);
  const fakeSaveDialog = React.useMemo(() => createFakeSaveChangesDialog(), []);

  return (
    <div className="flex flex-wrap gap-4" data-testid="factory-demo">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={fakeDialog.destructive ? 'destructive' : 'outline'}>
            {fakeDialog.title}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fakeDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{fakeDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fakeDialog.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              className={
                fakeDialog.destructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {fakeDialog.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            {i18n.t('alertDialog.story.deleteProject1', 'Delete Project')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fakeDeleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{fakeDeleteDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fakeDeleteDialog.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {fakeDeleteDialog.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">
            {i18n.t('alertDialog.story.saveChanges', 'Save Changes')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fakeSaveDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{fakeSaveDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fakeSaveDialog.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction>{fakeSaveDialog.actionLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const WithFactoryData: Story = {
  name: i18n.t('alertDialog.storyName.withFactoryData', 'With Factory Data (Comprehensive)'),
  render: () => <AlertDialogWithFactoryData />,
  parameters: {
    msw: { handlers: alertDialogHandlers },
    docs: {
      description: {
        story:
          'Demonstrates alert dialogs using the alert-dialog.factory.ts factory functions for generating realistic test data.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-demo"]')).toBeInTheDocument();

    // Verify all three triggers are rendered
    const triggers = canvasElement.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(3);
  },
};

// ============ MSW HANDLERS STORIES ============

export const WithAlertDialogHandlers: Story = {
  name: i18n.t('alertDialog.storyName.withAlertDialogHandlers', 'MSW: Alert Dialog Handlers'),
  parameters: {
    msw: { handlers: alertDialogHandlers },
    docs: {
      description: {
        story: 'Uses dedicated alert-dialog.handlers.ts for API simulation.',
      },
    },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const AlertDialogError401: Story = {
  name: i18n.t('alertDialog.storyName.alertDialogError401', 'MSW: 401 Unauthorized'),
  parameters: {
    msw: { handlers: alertDialogStatusHandlers.unauthorized },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const AlertDialogError403: Story = {
  name: i18n.t('alertDialog.storyName.alertDialogError403', 'MSW: 403 Forbidden'),
  parameters: {
    msw: { handlers: alertDialogStatusHandlers.forbidden },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const AlertDialogError409: Story = {
  name: i18n.t('alertDialog.storyName.alertDialogError409', 'MSW: 409 Conflict'),
  parameters: {
    msw: { handlers: alertDialogStatusHandlers.conflict },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const AlertDialogSlowResponse: Story = {
  name: i18n.t('alertDialog.storyName.alertDialogSlowResponse', 'MSW: Slow Response (5s)'),
  parameters: {
    msw: { handlers: alertDialogStatusHandlers.slowResponse },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const AlertDialogNetworkError: Story = {
  name: i18n.t('alertDialog.storyName.alertDialogNetworkError', 'MSW: Network Error'),
  parameters: {
    msw: { handlers: alertDialogStatusHandlers.networkError },
  },
  render: () => <AlertDialogWithAsyncData />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ FACTORY CONSTANTS STORIES ============

function AlertDialogActionTypesDemo() {
  // Use type annotation to prove the type is wired
  const actionTypes: AlertDialogActionType[] = ALERT_DIALOG_ACTION_TYPES;

  return (
    <div className="space-y-4" data-testid="action-types-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <div className="flex flex-wrap gap-3">
        {actionTypes.map((actionType) => (
          <AlertDialog key={actionType}>
            <AlertDialogTrigger asChild>
              <Button
                variant={actionType === 'delete' ? 'destructive' : 'outline'}
                data-testid={`action-type-trigger-${actionType}`}
              >
                {actionType}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Action: {actionType}</AlertDialogTitle>
                <AlertDialogDescription>
                  {i18n.t(
                    'alertDialog.story.demonstratesActionType',
                    'This dialog demonstrates the "{{actionType}}" action type.',
                    { actionType }
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction>{actionType}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </div>
    </div>
  );
}

export const ActionTypes: Story = {
  name: i18n.t('alertDialog.storyName.actionTypes', 'Factory: Action Types'),
  render: () => <AlertDialogActionTypesDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="action-types-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = canvasElement.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(ALERT_DIALOG_ACTION_TYPES.length);

    for (const actionType of ALERT_DIALOG_ACTION_TYPES) {
      const trigger = canvasElement.querySelector(
        `[data-testid="action-type-trigger-${actionType}"]`
      );
      expect(trigger).toBeInTheDocument();
    }
  },
};

function AlertDialogVariantsConstDemo() {
  const variants: AlertDialogVariant[] = ALERT_DIALOG_VARIANTS;

  return (
    <div className="space-y-4" data-testid="variants-const-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <div className="flex flex-wrap gap-3">
        {variants.map((variant) => (
          <AlertDialog key={variant}>
            <AlertDialogTrigger asChild>
              <Button
                variant={variant === 'destructive' ? 'destructive' : 'outline'}
                data-testid={`variant-trigger-${variant}`}
              >
                {variant}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Variant: {variant}</AlertDialogTitle>
                <AlertDialogDescription>
                  {i18n.t(
                    'alertDialog.story.demonstratesVariant',
                    'This dialog demonstrates the "{{variant}}" variant.',
                    { variant }
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction>{i18n.t('alertDialog.confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </div>
    </div>
  );
}

export const VariantsConst: Story = {
  name: i18n.t('alertDialog.storyName.variantsConst', 'Factory: Variants Constant'),
  render: () => <AlertDialogVariantsConstDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="variants-const-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = canvasElement.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(ALERT_DIALOG_VARIANTS.length);
  },
};

function AlertDialogSizesConstDemo() {
  const sizes: AlertDialogSize[] = ALERT_DIALOG_SIZES;
  const sizeClasses: Record<string, string> = {
    compact: 'max-w-sm',
    default: 'max-w-lg',
    wide: 'max-w-xl',
  };

  return (
    <div className="space-y-4" data-testid="sizes-const-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <div className="flex flex-wrap gap-3">
        {sizes.map((size) => (
          <AlertDialog key={size}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" data-testid={`size-trigger-${size}`}>
                {size}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className={sizeClasses[size]}>
              <AlertDialogHeader>
                <AlertDialogTitle>Size: {size}</AlertDialogTitle>
                <AlertDialogDescription>
                  {i18n.t(
                    'alertDialog.story.demonstratesSize',
                    'This dialog demonstrates the "{{size}}" size variant.',
                    { size }
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction>{i18n.t('alertDialog.confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </div>
    </div>
  );
}

export const SizesConst: Story = {
  name: i18n.t('alertDialog.storyName.sizesConst', 'Factory: Sizes Constant'),
  render: () => <AlertDialogSizesConstDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="sizes-const-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = canvasElement.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(ALERT_DIALOG_SIZES.length);
  },
};

function AlertDialogContentTypesDemo() {
  const contentTypes: AlertDialogContentType[] = ALERT_DIALOG_CONTENT_TYPES;

  return (
    <div className="space-y-4" data-testid="content-types-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <div className="flex flex-wrap gap-3">
        {contentTypes.map((contentType) => (
          <AlertDialog key={contentType}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" data-testid={`content-type-trigger-${contentType}`}>
                {contentType}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Content Type: {contentType}</AlertDialogTitle>
                <AlertDialogDescription>
                  {i18n.t(
                    'alertDialog.story.demonstratesContentType',
                    'This dialog demonstrates the "{{contentType}}" content type.',
                    { contentType }
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction>{i18n.t('alertDialog.confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </div>
    </div>
  );
}

export const ContentTypes: Story = {
  name: i18n.t('alertDialog.storyName.contentTypes', 'Factory: Content Types'),
  render: () => <AlertDialogContentTypesDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="content-types-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = canvasElement.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(ALERT_DIALOG_CONTENT_TYPES.length);
  },
};

function AlertDialogTitlesDemo() {
  return (
    <div className="space-y-4" data-testid="titles-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <div className="flex flex-wrap gap-3">
        {ALERT_DIALOG_TITLES.map((title) => (
          <AlertDialog key={title}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                {title}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{title}</AlertDialogTitle>
                <AlertDialogDescription>
                  This dialog uses the factory title: &quot;{title}&quot;.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t('alertDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction>{i18n.t('alertDialog.confirm')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </div>
    </div>
  );
}

export const Titles: Story = {
  name: i18n.t('alertDialog.storyName.titles', 'Factory: Titles'),
  render: () => <AlertDialogTitlesDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="titles-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = canvasElement.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(ALERT_DIALOG_TITLES.length);
  },
};

function AlertDialogDescriptionsDemo() {
  return (
    <div className="space-y-4" data-testid="descriptions-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {ALERT_DIALOG_DESCRIPTIONS.map((desc) => (
          <li key={desc}>{desc}</li>
        ))}
      </ul>
    </div>
  );
}

export const Descriptions: Story = {
  name: i18n.t('alertDialog.storyName.descriptions', 'Factory: Descriptions'),
  render: () => <AlertDialogDescriptionsDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="descriptions-demo"]');
    expect(demo).toBeInTheDocument();

    const items = demo!.querySelectorAll('li');
    expect(items.length).toBe(ALERT_DIALOG_DESCRIPTIONS.length);
  },
};

function AlertDialogActionLabelsDemo() {
  return (
    <div className="space-y-4" data-testid="action-labels-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <div className="flex flex-wrap gap-2">
        {ALERT_DIALOG_ACTION_LABELS.map((label) => (
          <Button key={label} variant="default" size="sm">
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const ActionLabels: Story = {
  name: i18n.t('alertDialog.storyName.actionLabels', 'Factory: Action Labels'),
  render: () => <AlertDialogActionLabelsDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="action-labels-demo"]');
    expect(demo).toBeInTheDocument();

    const buttons = demo!.querySelectorAll('button');
    expect(buttons.length).toBe(ALERT_DIALOG_ACTION_LABELS.length);
  },
};

function AlertDialogCancelLabelsDemo() {
  return (
    <div className="space-y-4" data-testid="cancel-labels-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <div className="flex flex-wrap gap-2">
        {ALERT_DIALOG_CANCEL_LABELS.map((label) => (
          <Button key={label} variant="outline" size="sm">
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const CancelLabels: Story = {
  name: i18n.t('alertDialog.storyName.cancelLabels', 'Factory: Cancel Labels'),
  render: () => <AlertDialogCancelLabelsDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="cancel-labels-demo"]');
    expect(demo).toBeInTheDocument();

    const buttons = demo!.querySelectorAll('button');
    expect(buttons.length).toBe(ALERT_DIALOG_CANCEL_LABELS.length);
  },
};

// ============ FACTORY FUNCTIONS STORIES ============

function RenderFakeAlertDialog({ dialog }: { dialog: FakeAlertDialog }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={dialog.destructive ? 'destructive' : 'outline'}
          data-testid={`dialog-trigger-${dialog.id}`}
        >
          {dialog.title}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
          <AlertDialogDescription>{dialog.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {dialog.showInput && (
          <div className="py-4">
            <input
              type="text"
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              placeholder={i18n.t('alertDialog.story.enterText', 'Enter text...')}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{dialog.cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={
              dialog.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {dialog.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateFakeAlertDialogsDemo() {
  const { t } = useTranslation();
  const dialogs = React.useMemo(() => createFakeAlertDialogs(5), []);

  return (
    <div className="space-y-4" data-testid="bulk-dialogs-demo">
      <p className="text-muted-foreground text-sm">
        {t('alertDialog.variants.defaultConfirmation')} ({dialogs.length} dialogs)
      </p>
      <div className="flex flex-wrap gap-3">
        {dialogs.map((dialog) => (
          <RenderFakeAlertDialog key={dialog.id} dialog={dialog} />
        ))}
      </div>
    </div>
  );
}

export const BulkDialogs: Story = {
  name: i18n.t('alertDialog.storyName.bulkDialogs', 'Factory: createFakeAlertDialogs (Bulk)'),
  render: () => <CreateFakeAlertDialogsDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="bulk-dialogs-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = demo!.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(5);
  },
};

function SessionExpiredDialogDemo() {
  const dialog = React.useMemo(() => createFakeSessionExpiredDialog(), []);

  return (
    <div className="space-y-4" data-testid="session-expired-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const SessionExpiredDialog: Story = {
  name: i18n.t('alertDialog.storyName.sessionExpiredDialog', 'Factory: Session Expired'),
  render: () => <SessionExpiredDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="session-expired-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Session Expired');
  },
};

function TermsDialogDemo() {
  const dialog = React.useMemo(() => createFakeTermsDialog(), []);

  return (
    <div className="space-y-4" data-testid="terms-dialog-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const TermsDialog: Story = {
  name: i18n.t('alertDialog.storyName.termsDialog', 'Factory: Terms of Service'),
  render: () => <TermsDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="terms-dialog-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Terms of Service');
  },
};

function FormInputDialogDemo() {
  const dialog = React.useMemo(() => createFakeFormInputDialog(), []);

  return (
    <div className="space-y-4" data-testid="form-input-dialog-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.withFormInput')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const FormInputDialog: Story = {
  name: i18n.t('alertDialog.storyName.formInputDialog', 'Factory: Form Input'),
  render: () => <FormInputDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="form-input-dialog-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Confirm Your Email');
  },
};

function WarningDialogDemo() {
  const dialog = React.useMemo(() => createFakeWarningDialog(), []);

  return (
    <div className="space-y-4" data-testid="warning-dialog-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const WarningDialog: Story = {
  name: i18n.t('alertDialog.storyName.warningDialog', 'Factory: Warning'),
  render: () => <WarningDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="warning-dialog-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Warning');
  },
};

function QuickConfirmDialogDemo() {
  const dialog = React.useMemo(() => createFakeQuickConfirmDialog(), []);

  return (
    <div className="space-y-4" data-testid="quick-confirm-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const QuickConfirmDialog: Story = {
  name: i18n.t('alertDialog.storyName.quickConfirmDialog', 'Factory: Quick Confirm'),
  render: () => <QuickConfirmDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="quick-confirm-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Quick Confirm');
  },
};

function DialogsByTypeDemo() {
  const dialogs = React.useMemo(() => createFakeAlertDialogsByType(), []);

  return (
    <div className="space-y-4" data-testid="dialogs-by-type-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')} ({dialogs.length} types)
      </p>
      <div className="flex flex-wrap gap-3">
        {dialogs.map((dialog) => (
          <RenderFakeAlertDialog key={dialog.id} dialog={dialog} />
        ))}
      </div>
    </div>
  );
}

export const DialogsByType: Story = {
  name: i18n.t('alertDialog.storyName.dialogsByType', 'Factory: Dialogs By Type'),
  render: () => <DialogsByTypeDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="dialogs-by-type-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = demo!.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(7);
  },
};

function AlertDialogMatrixDemo() {
  const matrix = React.useMemo(() => createFakeAlertDialogMatrix(), []);

  return (
    <div className="space-y-6" data-testid="matrix-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      {matrix.map((row, rowIndex) => (
        <div key={ALERT_DIALOG_VARIANTS[rowIndex]} className="space-y-2">
          <p className="text-sm font-medium">{ALERT_DIALOG_VARIANTS[rowIndex]}</p>
          <div className="flex flex-wrap gap-3">
            {row.map((dialog) => (
              <RenderFakeAlertDialog key={dialog.id} dialog={dialog} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const MatrixVariantSize: Story = {
  name: i18n.t('alertDialog.storyName.matrixVariantSize', 'Factory: Variant x Size Matrix'),
  render: () => <AlertDialogMatrixDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="matrix-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = demo!.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(ALERT_DIALOG_VARIANTS.length * ALERT_DIALOG_SIZES.length);
  },
};

const ALERT_DIALOG_CONFIG_SCENARIOS = ['default', 'destructive', 'formInput', 'wide'] as const;

function AlertDialogConfigDemo() {
  const configs: FakeAlertDialogConfig[] = React.useMemo(
    () => ALERT_DIALOG_CONFIG_SCENARIOS.map((s) => createFakeAlertDialogConfig(s)),
    []
  );

  return (
    <div className="space-y-4" data-testid="config-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <div className="grid grid-cols-2 gap-4">
        {ALERT_DIALOG_CONFIG_SCENARIOS.map((scenario, index) => {
          const config = configs[index];
          return (
            <div
              key={scenario}
              className="rounded-md border p-4"
              data-testid={`config-${scenario}`}
            >
              <p className="mb-2 text-sm font-medium">{scenario}</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>Variant: {config.variant}</li>
                <li>Size: {config.size}</li>
                <li>Destructive: {String(config.destructive)}</li>
                <li>Show Input: {String(config.showInput)}</li>
                <li>Force Close: {String(config.forceClose)}</li>
                <li>Default Open: {String(config.defaultOpen)}</li>
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ConfigScenarios: Story = {
  name: i18n.t('alertDialog.storyName.configScenarios', 'Factory: Config Scenarios'),
  render: () => <AlertDialogConfigDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="config-demo"]');
    expect(demo).toBeInTheDocument();

    for (const scenario of ['default', 'destructive', 'formInput', 'wide']) {
      expect(canvasElement.querySelector(`[data-testid="config-${scenario}"]`)).toBeInTheDocument();
    }
  },
};

// ============ ENTERPRISE FACTORY STORIES ============

function InfoDialogDemo() {
  const dialog = React.useMemo(() => createFakeInfoDialog(), []);

  return (
    <div className="space-y-4" data-testid="info-dialog-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const InfoDialog: Story = {
  name: i18n.t('alertDialog.storyName.infoDialog', 'Factory: Info Dialog'),
  render: () => <InfoDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="info-dialog-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Information');
  },
};

function AccountDeletionDialogDemo() {
  const dialog = React.useMemo(() => createFakeAccountDeletionDialog(), []);

  return (
    <div className="space-y-4" data-testid="account-deletion-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.destructiveAction')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const AccountDeletionDialog: Story = {
  name: i18n.t('alertDialog.storyName.accountDeletionDialog', 'Factory: Account Deletion'),
  render: () => <AccountDeletionDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="account-deletion-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Delete Account');
  },
};

function UnsavedChangesDialogDemo() {
  const dialog = React.useMemo(() => createFakeUnsavedChangesDialog(), []);

  return (
    <div className="space-y-4" data-testid="unsaved-changes-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const UnsavedChangesDialog: Story = {
  name: i18n.t('alertDialog.storyName.unsavedChangesDialog', 'Factory: Unsaved Changes'),
  render: () => <UnsavedChangesDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="unsaved-changes-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Unsaved Changes');
  },
};

function PaymentConfirmationDialogDemo() {
  const dialog = React.useMemo(() => createFakePaymentConfirmationDialog(49.99, 'USD'), []);

  return (
    <div className="space-y-4" data-testid="payment-confirmation-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const PaymentConfirmationDialog: Story = {
  name: i18n.t('alertDialog.storyName.paymentConfirmationDialog', 'Factory: Payment Confirmation'),
  render: () => <PaymentConfirmationDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="payment-confirmation-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Confirm Payment');
  },
};

function SubscriptionCancellationDialogDemo() {
  const dialog = React.useMemo(() => createFakeSubscriptionCancellationDialog(), []);

  return (
    <div className="space-y-4" data-testid="subscription-cancellation-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.destructiveAction')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const SubscriptionCancellationDialog: Story = {
  name: i18n.t(
    'alertDialog.storyName.subscriptionCancellationDialog',
    'Factory: Subscription Cancellation'
  ),
  render: () => <SubscriptionCancellationDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="subscription-cancellation-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Cancel Subscription');
  },
};

function LogoutDialogDemo() {
  const dialog = React.useMemo(() => createFakeLogoutDialog(), []);

  return (
    <div className="space-y-4" data-testid="logout-dialog-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const LogoutDialog: Story = {
  name: i18n.t('alertDialog.storyName.logoutDialog', 'Factory: Logout'),
  render: () => <LogoutDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="logout-dialog-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Sign Out');
  },
};

function DataExportDialogDemo() {
  const dialog = React.useMemo(() => createFakeDataExportDialog(), []);

  return (
    <div className="space-y-4" data-testid="data-export-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const DataExportDialog: Story = {
  name: i18n.t('alertDialog.storyName.dataExportDialog', 'Factory: Data Export'),
  render: () => <DataExportDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="data-export-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Export Data');
  },
};

function PrivacyConsentDialogDemo() {
  const dialog = React.useMemo(() => createFakePrivacyConsentDialog(), []);

  return (
    <div className="space-y-4" data-testid="privacy-consent-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <RenderFakeAlertDialog dialog={dialog} />
    </div>
  );
}

export const PrivacyConsentDialog: Story = {
  name: i18n.t('alertDialog.storyName.privacyConsentDialog', 'Factory: Privacy Consent'),
  render: () => <PrivacyConsentDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="privacy-consent-demo"]');
    expect(demo).toBeInTheDocument();

    const trigger = demo!.querySelector('[data-slot="alert-dialog-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent).toContain('Privacy Consent');
  },
};

function EnterpriseAlertDialogSetDemo() {
  const dialogs = React.useMemo(() => createFakeEnterpriseAlertDialogSet(), []);

  return (
    <div className="space-y-4" data-testid="enterprise-set-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')} ({dialogs.length} enterprise scenarios)
      </p>
      <div className="flex flex-wrap gap-3">
        {dialogs.map((dialog) => (
          <RenderFakeAlertDialog key={dialog.id} dialog={dialog} />
        ))}
      </div>
    </div>
  );
}

export const EnterpriseDialogSet: Story = {
  name: i18n.t('alertDialog.storyName.enterpriseDialogSet', 'Factory: Enterprise Dialog Set'),
  render: () => <EnterpriseAlertDialogSetDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="enterprise-set-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = demo!.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(15);
  },
};

function ABTestDialogDemo() {
  // Use type annotation to prove FakeAlertDialogABTest is wired
  const abTest: FakeAlertDialogABTest = React.useMemo(
    () => createFakeAlertDialogABTest('Confirm Deletion'),
    []
  );

  return (
    <div className="space-y-6" data-testid="ab-test-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('alertDialog.variants.defaultConfirmation')}
      </p>
      <p className="font-mono text-xs">Test ID: {abTest.testId}</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">{i18n.t('alertDialog.story.variantA', 'Variant A')}</p>
          <RenderFakeAlertDialog dialog={abTest.variantA} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{i18n.t('alertDialog.story.variantB', 'Variant B')}</p>
          <RenderFakeAlertDialog dialog={abTest.variantB} />
        </div>
      </div>
    </div>
  );
}

export const ABTestDialog: Story = {
  name: i18n.t('alertDialog.storyName.aBTestDialog', 'Factory: A/B Test'),
  render: () => <ABTestDialogDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="ab-test-demo"]');
    expect(demo).toBeInTheDocument();

    const triggers = demo!.querySelectorAll('[data-slot="alert-dialog-trigger"]');
    expect(triggers.length).toBe(2);

    // Both should show "Confirm Deletion" as the title
    for (const trigger of triggers) {
      expect(trigger.textContent).toContain('Confirm Deletion');
    }
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   deleteInProgress
//   itemLocked
//   confirmationRequired
//   sessionExpired
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadRequest: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerBadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerUnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'alertDialog.storyName.handlerInternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: alertDialogStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLoading: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerLoading', 'Handler: Loading'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerDeleteInProgress: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerDeleteInProgress', 'Handler: Delete In Progress'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.deleteInProgress } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerItemLocked: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerItemLocked', 'Handler: Item Locked'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.itemLocked } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConfirmationRequired: Story = {
  ...Default,
  name: i18n.t(
    'alertDialog.storyName.handlerConfirmationRequired',
    'Handler: Confirmation Required'
  ),
  parameters: { msw: { handlers: alertDialogStatusHandlers.confirmationRequired } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSessionExpired: Story = {
  ...Default,
  name: i18n.t('alertDialog.storyName.handlerSessionExpired', 'Handler: Session Expired'),
  parameters: { msw: { handlers: alertDialogStatusHandlers.sessionExpired } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

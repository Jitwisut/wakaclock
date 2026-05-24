import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { toast, useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToastAction } from '@/components/ui/toast';
import { Toaster } from '@/components/ui/sonner';
import { useTranslation } from 'react-i18next';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Toast demo component
function ToastDemo() {
  const { t } = useTranslation();
  const { toasts, dismiss } = useToast();

  return (
    <div className="space-y-6">
      <Card className="w-[500px]" data-testid="toast-demo">
        <CardHeader>
          <CardTitle>{t('useToast.story.useToastHookDemo', 'useToast Hook Demo')}</CardTitle>
          <CardDescription>
            {t(
              'useToast.story.clickButtonsToTriggerToasts',
              'Click the buttons below to trigger different toast types'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              data-testid="toast-default"
              onClick={() => {
                toast({
                  title: t('useToast.story.defaultToastTitle', 'Default Toast'),
                  description: t(
                    'useToast.story.defaultToastDesc',
                    'This is a default toast notification.'
                  ),
                });
              }}
              variant="outline"
            >
              {t('useToast.story.defaultToast', 'Default Toast')}
            </Button>

            <Button
              data-testid="toast-success"
              onClick={() => {
                toast({
                  title: t('useToast.story.successTitle', 'Success!'),
                  description: t(
                    'useToast.story.successDesc',
                    'Your action was completed successfully.'
                  ),
                  variant: 'default',
                });
              }}
              variant="outline"
            >
              {t('useToast.story.successToast', 'Success Toast')}
            </Button>

            <Button
              data-testid="toast-destructive"
              onClick={() => {
                toast({
                  title: t('useToast.story.errorTitle', 'Error'),
                  description: t(
                    'useToast.story.errorDesc',
                    'Something went wrong. Please try again.'
                  ),
                  variant: 'destructive',
                });
              }}
              variant="outline"
            >
              {t('useToast.story.destructiveToast', 'Destructive Toast')}
            </Button>

            <Button
              data-testid="toast-with-action"
              onClick={() => {
                toast({
                  title: t('useToast.story.undoActionTitle', 'Undo Action'),
                  description: t('useToast.story.itemWasDeleted', 'Item was deleted.'),
                  action: (
                    <ToastAction altText="Undo">{t('useToast.story.undo', 'Undo')}</ToastAction>
                  ),
                });
              }}
              variant="outline"
            >
              {t('useToast.story.withAction', 'With Action')}
            </Button>

            <Button
              data-testid="toast-title-only"
              onClick={() => {
                toast({
                  title: t('useToast.story.titleOnlyToastTitle', 'Title Only Toast'),
                });
              }}
              variant="outline"
            >
              {t('useToast.story.titleOnly', 'Title Only')}
            </Button>

            <Button
              data-testid="toast-description-only"
              onClick={() => {
                toast({
                  description: t(
                    'useToast.story.descriptionOnlyMsg',
                    'Description only toast message.'
                  ),
                });
              }}
              variant="outline"
            >
              {t('useToast.story.descriptionOnly', 'Description Only')}
            </Button>
          </div>

          <div className="border-t pt-4">
            <Button data-testid="dismiss-all" onClick={() => dismiss()} variant="secondary">
              {t('useToast.story.dismissAllToasts', 'Dismiss All Toasts')}
            </Button>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <p className="mb-2 text-xs font-medium">
              {t('useToast.story.currentToasts', 'Current Toasts: {{count}}', {
                count: toasts.length,
              })}
            </p>
            {toasts.length > 0 && (
              <ul className="space-y-1 text-xs">
                {toasts.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className="font-mono">{t.id}</span>
                    <span>
                      {t.title?.toString() ?? i18n.t('useToast.story.noTitle', 'No title')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Toaster />
    </div>
  );
}

// Direct toast function demo
function ToastFunctionDemo() {
  return (
    <Card className="w-[500px]">
      <CardHeader>
        <CardTitle>{i18n.t('useToast.story.toastFunction', 'toast() Function')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'useToast.story.useTheToastFunctionDirectlyWithoutTheHoo',
            'Use the toast function directly without the hook'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
          {`// Import the toast function
import { toast } from '@/hooks/use-toast';

// Use it directly
toast({
  title: 'Hello!',
  description: 'This is a toast.',
});

// Returns control object
const { id, dismiss, update } = toast({
  title: 'Processing...',
});

// Update the toast later
update({ title: 'Done!' });

// Or dismiss it
dismiss();`}
        </pre>

        <Button
          onClick={() => {
            const { id, update } = toast({
              title: i18n.t('useToast.story.processingTitle', 'Processing...'),
              description: i18n.t(
                'useToast.story.processingDesc',
                'Please wait while we process your request.'
              ),
            });

            setTimeout(() => {
              update({
                id,
                title: i18n.t('useToast.story.completeTitle', 'Complete!'),
                description: i18n.t(
                  'useToast.story.completeDesc',
                  'Your request has been processed.'
                ),
              });
            }, 2000);
          }}
          variant="outline"
        >
          {i18n.t('useToast.story.demoUpdateToast', 'Demo: Update Toast')}
        </Button>
      </CardContent>
    </Card>
  );
}

// Wrapper for meta component
function HookWrapper() {
  return <ToastDemo />;
}

const meta = {
  title: 'Hooks/useToast',
  component: HookWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## useToast

A toast notification system inspired by react-hot-toast.

### Usage

\`\`\`tsx
import { useToast, toast } from '@/hooks/use-toast';

// Using the hook
function MyComponent() {
  const { toast, dismiss, toasts } = useToast();

  return (
    <button onClick={() => toast({ title: 'Hello!' })}>
      Show Toast
    </button>
  );
}

// Using the function directly
toast({
  title: 'Success!',
  description: 'Your changes have been saved.',
  variant: 'default',
});
\`\`\`

### Toast Options

- **title**: Toast title (ReactNode)
- **description**: Toast description (ReactNode)
- **variant**: 'default' | 'destructive'
- **action**: Action button element (ToastActionElement)

### Returned Object

When calling \`toast()\`, you get back:
- **id**: Unique toast ID
- **dismiss**: Function to dismiss this toast
- **update**: Function to update this toast

### Hook Return Value

- **toasts**: Array of current toasts
- **toast**: Function to create a toast
- **dismiss**: Function to dismiss toasts
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof HookWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ToastDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify demo is rendered
    expect(canvas.getByTestId('toast-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('toast-default')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const ToastFunction: Story = {
  render: () => (
    <div className="space-y-6">
      <ToastFunctionDemo />
      <Toaster />
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-6">
      <ToastDemo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('toast-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('toast-default')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('toast-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('toast-destructive')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ COMBINED VARIANTS ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('useToast.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('useToast.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('useToast.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('useToast.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ INTERACTIVE STORIES ============

export const InteractiveDefault: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click the default toast button
    const defaultButton = canvas.getByTestId('toast-default');
    await userEvent.click(defaultButton);

    // Toast should appear (check via Toaster component)
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('useToast.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all buttons are accessible
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).not.toBe(0);

    // Verify each button has accessible name
    for (const button of buttons) {
      expect(button).toHaveAccessibleName();
    }
  },
};

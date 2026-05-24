import type { Meta, StoryObj } from '@storybook/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { Loader2Icon, MailIcon } from 'lucide-react';

import { authHandlers, authStatusHandlers } from '@/.storybook/stories/_handlers/auth.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { inputHandlers } from '@/.storybook/stories/_handlers/input.handlers';
import {
  createFakeFormData,
  createFakeFormField,
} from '@/.storybook/stories/_factories/form.factory';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ForgotPasswordDemo() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  return (
    <div className="flex h-[90vh] items-center justify-center py-4">
      <Card className="mx-auto w-96">
        <CardHeader>
          <CardTitle className="text-2xl">
            {t('forgotPassword.story.forgotPassword', 'Forgot Password')}
          </CardTitle>
          <CardDescription>
            {t(
              'pages.forgotPassword.description',
              "Enter your email address and we'll send you instructions to reset your password."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSubmitted ? (
            <div className="space-y-4 text-center">
              <div className="bg-primary/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                <MailIcon className="text-primary h-6 w-6" />
              </div>
              <div>
                <h3 className="font-medium">
                  {t('forgotPassword.story.checkYourEmail', 'Check your email')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t(
                    'pages.forgotPassword.emailSent',
                    "We've sent password reset instructions to your email."
                  )}
                </p>
              </div>
              <Button className="w-full" onClick={() => setIsSubmitted(false)} variant="outline">
                {t('forgotPassword.story.tryAgain', 'Try again')}
              </Button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label className="sr-only" htmlFor="email">
                  {t('forgotPassword.story.emailAddress', 'Email address')}
                </Label>
                <div className="relative">
                  <MailIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform opacity-30" />
                  <Input
                    autoComplete="email"
                    className="w-full pl-10"
                    id="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(
                      'pages.forgotPassword.emailPlaceholder',
                      'Enter your email address'
                    )}
                    type="email"
                    value={email}
                  />
                </div>
              </div>
              <Button className="w-full" disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="animate-spin" />
                    {t('forgotPassword.story.pleaseWait', 'Please wait')}
                  </>
                ) : (
                  t('forgotPassword.story.sendResetInstructions', 'Send Reset Instructions')
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm">
            {t('forgotPassword.story.alreadyHaveAccount', 'Already have an account?')}{' '}
            <a className="underline" href="/login">
              {t('forgotPassword.story.logIn', 'Log in')}
            </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function ForgotPasswordFormDemo() {
  const { t } = useTranslation();

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="max-w-sm p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('forgotPassword.story.forgotPassword', 'Forgot Password')}</CardTitle>
          <CardDescription>
            {t(
              'forgotPassword.story.enterEmailToReceive',
              'Enter your email to receive reset instructions.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <MailIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform opacity-30" />
              <Input
                className="pl-10"
                placeholder={t('forgotPassword.story.emailAddress', 'Email address')}
              />
            </div>
            <Button
              className="w-full"
              disabled={isSubmitting}
              onClick={() => {
                setIsSubmitting(true);
                setTimeout(() => setIsSubmitting(false), 2000);
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  {t('forgotPassword.story.pleaseWait', 'Please wait')}
                </>
              ) : (
                t('forgotPassword.story.sendResetInstructions', 'Send Reset Instructions')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SuccessStateDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-sm p-4">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4 text-center">
            <div className="bg-primary/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <MailIcon className="text-primary h-6 w-6" />
            </div>
            <div>
              <h3 className="font-medium">
                {t('forgotPassword.story.checkYourEmail', 'Check your email')}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t(
                  'pages.forgotPassword.emailSent',
                  "We've sent password reset instructions to your email."
                )}
              </p>
            </div>
            <Button className="w-full" variant="outline">
              {t('forgotPassword.story.tryAgain', 'Try again')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Auth/Forgot Password',
  component: ForgotPasswordDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...authHandlers, ...buttonHandlers, ...formHandlers, ...inputHandlers] },
    docs: {
      description: {
        component:
          'Forgot Password Page - Password reset flow with email input (with icon), loading state button, and success confirmation with "check your email" message.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof ForgotPasswordDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('forgotPassword.storyName.default', 'Full Page'),
  render: () => <ForgotPasswordDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify form elements
    const emailInput = canvas.getByPlaceholderText(/email/i);
    const submitButton = canvas.getByRole('button', { name: /send reset instructions/i });

    expect(emailInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();

    // Test typing email
    await userEvent.type(emailInput, 'user@example.com');
    expect(emailInput).toHaveValue('user@example.com');
  },
};

export const Form: Story = {
  name: i18n.t('forgotPassword.storyName.form', 'Form Only'),
  render: () => <ForgotPasswordFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify form card
    expect(canvas.getByText('Forgot Password')).toBeInTheDocument();
    expect(canvas.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /send reset instructions/i })).toBeInTheDocument();
  },
};

export const Success: Story = {
  name: i18n.t('forgotPassword.storyName.success', 'Success State'),
  render: () => <SuccessStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify success state
    expect(canvas.getByText('Check your email')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('forgotPassword.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ForgotPasswordDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const FormDark: Story = {
  name: i18n.t('forgotPassword.storyName.formDark', 'Form Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ForgotPasswordFormDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('forgotPassword.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <ForgotPasswordDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('forgotPassword.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <ForgotPasswordDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: authStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: authStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: authStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'forgotPassword.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: authStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'forgotPassword.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: authStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'forgotPassword.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: authStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: authStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: authStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('forgotPassword.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: authStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const field = createFakeFormField();
  const formData = createFakeFormData();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ field, formData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('forgotPassword.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

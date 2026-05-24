import type { Meta, StoryObj } from '@storybook/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { GithubIcon, Loader2Icon } from 'lucide-react';

import { authHandlers, authStatusHandlers } from '@/.storybook/stories/_handlers/auth.handlers';
import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { inputHandlers } from '@/.storybook/stories/_handlers/input.handlers';
import {
  createFakeFormField,
  createFakeLoginFormData,
} from '@/.storybook/stories/_factories/form.factory';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function LoginV2Demo() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
  };

  return (
    <div className="flex h-[90vh] items-center justify-center py-4">
      <Card className="mx-auto w-96">
        <CardHeader>
          <CardTitle className="text-2xl">{t('loginV2.story.login', 'Login')}</CardTitle>
          <CardDescription>
            {t('loginV2.story.enterEmailBelow', 'Enter your email below to login to your account')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">{t('loginV2.story.email', 'Email')}</Label>
              <Input
                autoComplete="email"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('loginV2.story.emailPlaceholder', 'contact@bundui.com')}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">{t('loginV2.story.password', 'Password')}</Label>
                <a className="ml-auto inline-block text-sm underline" href="#forgot">
                  {t('loginV2.story.forgotYourPassword', 'Forgot your password?')}
                </a>
              </div>
              <Input
                autoComplete="current-password"
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  {t('loginV2.story.pleaseWait', 'Please wait')}
                </>
              ) : (
                t('loginV2.story.login', 'Login')
              )}
            </Button>
          </form>

          <div className="my-4">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground shrink-0 text-sm">
                {t('loginV2.story.orContinueWith', 'or continue with')}
              </span>
              <Separator className="flex-1" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button className="w-full" variant="outline">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="currentColor"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="currentColor"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="currentColor"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="currentColor"
                />
              </svg>
              {t('loginV2.story.google', 'Google')}
            </Button>
            <Button className="w-full" variant="outline">
              <GithubIcon className="mr-2 h-4 w-4" />
              {t('loginV2.story.github', 'GitHub')}
            </Button>
          </div>

          <div className="mt-4 text-center text-sm">
            {t('pages.loginV2.noAccount', "Don't have an account?")}{' '}
            <a className="underline" href="#signup">
              {t('loginV2.story.signUp', 'Sign up')}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginFormDemo() {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="max-w-sm p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('loginV2.story.login', 'Login')}</CardTitle>
          <CardDescription>
            {t('loginV2.story.enterEmailBelow', 'Enter your email below to login to your account')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="form-email">{t('loginV2.story.email', 'Email')}</Label>
              <Input
                id="form-email"
                placeholder={t('loginV2.story.emailPlaceholder', 'contact@bundui.com')}
                type="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="form-password">{t('loginV2.story.password', 'Password')}</Label>
              <Input id="form-password" type="password" />
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
                  {t('loginV2.story.pleaseWait', 'Please wait')}
                </>
              ) : (
                t('loginV2.story.login', 'Login')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SocialLoginDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-sm p-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Button className="w-full" variant="outline">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="currentColor"
              />
            </svg>
            {t('loginV2.story.continueWithGoogle', 'Continue with Google')}
          </Button>
          <Button className="w-full" variant="outline">
            <GithubIcon className="mr-2 h-4 w-4" />
            {t('loginV2.story.continueWithGitHub', 'Continue with GitHub')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Auth/Login V2',
  component: LoginV2Demo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...authHandlers, ...formHandlers, ...inputHandlers] },
    docs: {
      description: {
        component:
          'Login V2 Page - Authentication form with email/password, social login (Google, GitHub), forgot password link, and sign up redirect.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof LoginV2Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('loginV2.storyName.default', 'Full Page'),
  render: () => <LoginV2Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify form elements
    const emailInput = canvas.getByLabelText(/email/i);
    const passwordInput = canvas.getByLabelText(/password/i);
    const loginButton = canvas.getByRole('button', { name: /^login$/i });

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(loginButton).toBeInTheDocument();

    // Verify social login buttons
    expect(canvas.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /github/i })).toBeInTheDocument();

    // Test typing credentials
    await userEvent.type(emailInput, 'user@example.com');
    expect(emailInput).toHaveValue('user@example.com');

    await userEvent.type(passwordInput, 'password123');
    expect(passwordInput).toHaveValue('password123');
  },
};

export const Form: Story = {
  name: i18n.t('loginV2.storyName.form', 'Form Only'),
  render: () => <LoginFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText('Login')).toBeInTheDocument();
    expect(canvas.getByLabelText(/email/i)).toBeInTheDocument();
    expect(canvas.getByLabelText(/password/i)).toBeInTheDocument();
  },
};

export const SocialLogin: Story = {
  name: i18n.t('loginV2.storyName.socialLogin', 'Social Login'),
  render: () => <SocialLoginDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /github/i })).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('loginV2.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <LoginV2Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const FormDark: Story = {
  name: i18n.t('loginV2.storyName.formDark', 'Form Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <LoginFormDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('loginV2.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <LoginV2Demo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('loginV2.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <LoginV2Demo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: authStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: authStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: authStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: authStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: authStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: authStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: authStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: authStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('loginV2.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: authStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const loginData = createFakeLoginFormData();
  const field = createFakeFormField();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ loginData, field }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('loginV2.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

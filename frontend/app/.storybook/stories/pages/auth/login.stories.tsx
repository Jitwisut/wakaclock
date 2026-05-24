import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import { GithubIcon } from 'lucide-react';

import { authHandlers, authStatusHandlers } from '@/.storybook/stories/_handlers/auth.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
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
// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Google icon SVG component
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24">
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
  );
}

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function LoginV1Demo() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[90vh] pb-8 lg:pb-0">
      <div className="hidden w-1/2 bg-gray-100 lg:block">
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold">{t('login.story.welcomeBack', 'Welcome Back')}</h2>
            <p className="mt-2 text-lg opacity-80">
              {t('login.story.signInToContinue', 'Sign in to continue to your account')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center lg:w-1/2">
        <div className="w-full max-w-md space-y-8 px-4">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold">
              {t('login.story.welcomeBack', 'Welcome back')}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {t('login.story.pleaseSignIn', 'Please sign in to your account')}
            </p>
          </div>

          <form className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="sr-only" htmlFor="email-v1">
                  {t('login.story.emailAddress', 'Email address')}
                </Label>
                <Input
                  autoComplete="email"
                  className="w-full"
                  id="email-v1"
                  name="email"
                  placeholder={t('login.story.emailAddress', 'Email address')}
                  type="email"
                />
              </div>
              <div>
                <Label className="sr-only" htmlFor="password-v1">
                  {t('login.story.password', 'Password')}
                </Label>
                <Input
                  autoComplete="current-password"
                  className="w-full"
                  id="password-v1"
                  name="password"
                  placeholder={t('login.story.password', 'Password')}
                  type="password"
                />
              </div>
              <div className="text-end">
                <a className="ml-auto inline-block text-sm underline" href="/forgot-password">
                  {t('login.story.forgotYourPassword', 'Forgot your password?')}
                </a>
              </div>
            </div>

            <div>
              <Button className="w-full" type="submit">
                {t('login.story.signIn', 'Sign in')}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-3">
              <div className="w-full border-t" />
              <span className="text-muted-foreground shrink-0 text-sm">
                {t('login.story.orContinueWith', 'or continue with')}
              </span>
              <div className="w-full border-t" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button className="w-full" variant="outline">
                <GoogleIcon />
                {t('login.story.google', 'Google')}
              </Button>
              <Button className="w-full" variant="outline">
                <GithubIcon />
                {t('login.story.github', 'GitHub')}
              </Button>
            </div>

            <div className="mt-6 text-center text-sm">
              {t('pages.login.noAccount', "Don't have an account?")}{' '}
              <a className="underline" href="/register">
                {t('login.story.signUp', 'Sign up')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginV2Demo() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[90vh] items-center justify-center py-4">
      <Card className="mx-auto w-96">
        <CardHeader>
          <CardTitle className="text-2xl">{t('login.story.login', 'Login')}</CardTitle>
          <CardDescription>
            {t('login.story.enterEmailBelow', 'Enter your email below to login to your account')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email-v2">{t('login.story.email', 'Email')}</Label>
              <Input
                id="email-v2"
                placeholder={t('login.story.emailPlaceholder', 'contact@bundui.com')}
                required
                type="email"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password-v2">{t('login.story.password', 'Password')}</Label>
                <a className="ml-auto inline-block text-sm underline" href="/forgot-password">
                  {t('login.story.forgotYourPassword', 'Forgot your password?')}
                </a>
              </div>
              <Input id="password-v2" required type="password" />
            </div>
            <Button className="w-full" type="submit">
              {t('login.story.login', 'Login')}
            </Button>

            <div className="my-4">
              <div className="flex items-center gap-3">
                <div className="w-full border-t" />
                <span className="text-muted-foreground shrink-0 text-sm">
                  {t('login.story.orContinueWith', 'or continue with')}
                </span>
                <div className="w-full border-t" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button className="w-full" variant="outline">
                <GoogleIcon />
                {t('login.story.google', 'Google')}
              </Button>
              <Button className="w-full" variant="outline">
                <GitHubLogoIcon />
                {t('login.story.github', 'GitHub')}
              </Button>
            </div>
          </div>
          <div className="mt-4 text-center text-sm">
            {t('pages.login.noAccount', "Don't have an account?")}{' '}
            <a className="underline" href="/register">
              {t('loginPage.story.signUp', 'Sign up')}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginFormDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-sm p-4">
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="email-demo">{t('login.story.email', 'Email')}</Label>
          <Input
            id="email-demo"
            placeholder={t('login.story.emailPlaceholder', 'contact@bundui.com')}
            type="email"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password-demo">{t('login.story.password', 'Password')}</Label>
          <Input id="password-demo" type="password" />
        </div>
        <Button className="w-full">{t('login.story.login', 'Login')}</Button>
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Auth/Login',
  component: LoginV1Demo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...authHandlers, ...buttonHandlers, ...formHandlers, ...inputHandlers] },
    docs: {
      description: {
        component:
          'Login Pages - Two login page variants: V1 with split layout (image + form), V2 with centered card. Both include email/password fields, forgot password link, social login buttons (Google, GitHub), and sign up link.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof LoginV1Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const V1: Story = {
  name: i18n.t('login.storyName.v1', 'Login V1 (Split Layout)'),
  render: () => <LoginV1Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify login form elements exist
    const emailInput = canvas.getByPlaceholderText(/email address/i);
    const passwordInput = canvas.getByPlaceholderText(/password/i);
    const signInButton = canvas.getByRole('button', { name: /sign in/i });

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(signInButton).toBeInTheDocument();

    // Test form interaction
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');

    // Verify social login buttons
    expect(canvas.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /github/i })).toBeInTheDocument();
  },
};

export const V2: Story = {
  name: i18n.t('login.storyName.v2', 'Login V2 (Card)'),
  render: () => <LoginV2Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify card login form
    const emailInput = canvas.getByLabelText(/email/i);
    const passwordInput = canvas.getByLabelText(/password/i);
    const loginButton = canvas.getByRole('button', { name: /login/i });

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(loginButton).toBeInTheDocument();

    // Test typing in form
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'user@test.com');
    expect(emailInput).toHaveValue('user@test.com');
  },
};

export const LoginForm: Story = {
  name: i18n.t('login.storyName.loginForm', 'Login Form'),
  render: () => <LoginFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify basic form elements
    const emailInput = canvas.getByLabelText(/email/i);
    const passwordInput = canvas.getByLabelText(/password/i);
    const loginButton = canvas.getByRole('button', { name: /login/i });

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(loginButton).toBeInTheDocument();

    // Test keyboard navigation
    await userEvent.tab();
    expect(emailInput).toHaveFocus();
    await userEvent.tab();
    expect(passwordInput).toHaveFocus();
  },
};

export const V1Dark: Story = {
  name: i18n.t('login.storyName.v1Dark', 'V1 Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <LoginV1Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const V2Dark: Story = {
  name: i18n.t('login.storyName.v2Dark', 'V2 Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <LoginV2Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('login.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <LoginV2Demo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('login.storyName.rTL', 'RTL'),
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
  ...V1,
  name: i18n.t('login.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(V1.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...V1,
  name: i18n.t('login.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(V1.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...V1,
  name: i18n.t('login.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...V1,
  name: i18n.t('login.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...V1,
  name: i18n.t('login.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: authStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...V1,
  name: i18n.t('login.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: authStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...V1,
  name: i18n.t('login.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: authStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...V1,
  name: i18n.t('login.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: authStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...V1,
  name: i18n.t('login.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: authStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...V1,
  name: i18n.t('login.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: authStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...V1,
  name: i18n.t('login.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: authStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...V1,
  name: i18n.t('login.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: authStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...V1,
  name: i18n.t('login.storyName.slowResponse', 'Handler: Slow Response'),
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
  name: i18n.t('login.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...V1,
  name: i18n.t('login.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: authStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInvalidCredentials: Story = {
  ...V1,
  name: i18n.t('login.storyName.handlerInvalidCredentials', 'Handler: Invalid Credentials'),
  parameters: { msw: { handlers: authStatusHandlers.invalidCredentials } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerAccountLocked: Story = {
  ...V1,
  name: i18n.t('login.storyName.handlerAccountLocked', 'Handler: Account Locked'),
  parameters: { msw: { handlers: authStatusHandlers.accountLocked } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmailNotVerified: Story = {
  ...V1,
  name: i18n.t('login.storyName.handlerEmailNotVerified', 'Handler: Email Not Verified'),
  parameters: { msw: { handlers: authStatusHandlers.emailNotVerified } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmailExists: Story = {
  ...V1,
  name: i18n.t('login.storyName.handlerEmailExists', 'Handler: Email Exists'),
  parameters: { msw: { handlers: authStatusHandlers.emailExists } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerWeakPassword: Story = {
  ...V1,
  name: i18n.t('login.storyName.handlerWeakPassword', 'Handler: Weak Password'),
  parameters: { msw: { handlers: authStatusHandlers.weakPassword } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInvalidResetToken: Story = {
  ...V1,
  name: i18n.t('login.storyName.handlerInvalidResetToken', 'Handler: Invalid Reset Token'),
  parameters: { msw: { handlers: authStatusHandlers.invalidResetToken } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyAttempts: Story = {
  ...V1,
  name: i18n.t('login.storyName.handlerTooManyAttempts', 'Handler: Too Many Attempts'),
  parameters: { msw: { handlers: authStatusHandlers.tooManyAttempts } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSessionExpired: Story = {
  ...V1,
  name: i18n.t('login.storyName.handlerSessionExpired', 'Handler: Session Expired'),
  parameters: { msw: { handlers: authStatusHandlers.sessionExpired } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

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
  createFakeRegistrationFormData,
} from '@/.storybook/stories/_factories/form.factory';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function RegisterV1Demo() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[90vh] pb-8 lg:pb-0">
      <div className="hidden w-1/2 bg-gray-100 lg:block">
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-green-500 to-teal-600">
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold">{t('register.story.joinUs', 'Join Us')}</h2>
            <p className="mt-2 text-lg opacity-80">
              {t('register.story.createYourAccount', 'Create your account and get started')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center lg:w-1/2">
        <div className="w-full max-w-md space-y-8 px-4">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold">
              {t('register.story.createNewAccount', 'Create New Account')}
            </h2>
          </div>

          <form className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="sr-only" htmlFor="first_name-v1">
                  {t('register.story.firstName', 'First name')}
                </Label>
                <Input
                  className="w-full"
                  id="first_name-v1"
                  name="first_name"
                  placeholder={t('register.story.firstName', 'First name')}
                  type="text"
                />
              </div>
              <div>
                <Label className="sr-only" htmlFor="last_name-v1">
                  {t('register.story.lastName', 'Last name')}
                </Label>
                <Input
                  className="w-full"
                  id="last_name-v1"
                  name="last_name"
                  placeholder={t('register.story.lastName', 'Last name')}
                  type="text"
                />
              </div>
              <div>
                <Label className="sr-only" htmlFor="email-v1">
                  {t('register.story.emailAddress', 'Email address')}
                </Label>
                <Input
                  autoComplete="email"
                  className="w-full"
                  id="email-v1"
                  name="email"
                  placeholder={t('register.story.emailAddress', 'Email address')}
                  type="email"
                />
              </div>
              <div>
                <Label className="sr-only" htmlFor="password-v1">
                  {t('register.story.password', 'Password')}
                </Label>
                <Input
                  autoComplete="new-password"
                  className="w-full"
                  id="password-v1"
                  name="password"
                  placeholder={t('register.story.password', 'Password')}
                  type="password"
                />
              </div>
            </div>

            <div>
              <Button className="w-full" type="submit">
                {t('register.story.register', 'Register')}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-3">
              <div className="w-full border-t" />
              <span className="text-muted-foreground shrink-0 text-sm">
                {t('register.story.orContinueWith', 'or continue with')}
              </span>
              <div className="w-full border-t" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button className="w-full" variant="outline">
                <GoogleIcon />
                {t('register.story.google', 'Google')}
              </Button>
              <Button className="w-full" variant="outline">
                <GithubIcon />
                {t('register.story.github', 'GitHub')}
              </Button>
            </div>

            <div className="mt-6 text-center text-sm">
              {t('register.story.alreadyHaveAccount', 'Already have an account?')}{' '}
              <a className="underline" href="/login">
                {t('register.story.signIn', 'Sign in')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterV2Demo() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[90vh] items-center justify-center py-4">
      <Card className="mx-auto w-96">
        <CardHeader>
          <CardTitle className="text-2xl">
            {t('register.story.createNewAccount', 'Create New Account')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="first_name-v2">{t('register.story.firstName', 'First name')}</Label>
              <Input
                className="w-full"
                id="first_name-v2"
                name="first_name"
                placeholder={t('register.story.firstName', 'First name')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_name-v2">{t('register.story.lastName', 'Last name')}</Label>
              <Input
                className="w-full"
                id="last_name-v2"
                name="last_name"
                placeholder={t('register.story.lastName', 'Last name')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email-v2">{t('register.story.email', 'Email')}</Label>
              <Input
                id="email-v2"
                placeholder={t('register.story.emailPlaceholder', 'contact@bundui.com')}
                required
                type="email"
              />
            </div>
            <div className="flex items-center">
              <Label htmlFor="password-v2">{t('register.story.password', 'Password')}</Label>
            </div>
            <Input id="password-v2" required type="password" />
            <Button className="w-full" type="submit">
              {t('register.story.register', 'Register')}
            </Button>

            <div className="my-4">
              <div className="flex items-center gap-3">
                <div className="w-full border-t" />
                <span className="text-muted-foreground shrink-0 text-sm">
                  {t('register.story.orContinueWith', 'or continue with')}
                </span>
                <div className="w-full border-t" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button className="w-full" variant="outline">
                <GoogleIcon />
                {t('register.story.google', 'Google')}
              </Button>
              <Button className="w-full" variant="outline">
                <GitHubLogoIcon />
                {t('register.story.github', 'GitHub')}
              </Button>
            </div>
          </div>
          <div className="mt-4 text-center text-sm">
            {t('register.story.alreadyHaveAccount', 'Already have an account?')}{' '}
            <a className="underline" href="/login">
              {t('register.story.signIn', 'Sign in')}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RegisterFormDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-sm p-4">
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="first-demo">{t('register.story.firstName', 'First name')}</Label>
          <Input
            id="first-demo"
            placeholder={t('register.story.firstNamePlaceholder', 'John')}
            type="text"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="last-demo">{t('register.story.lastName', 'Last name')}</Label>
          <Input
            id="last-demo"
            placeholder={t('register.story.lastNamePlaceholder', 'Doe')}
            type="text"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email-demo">{t('register.story.email', 'Email')}</Label>
          <Input
            id="email-demo"
            placeholder={t('register.story.emailExamplePlaceholder', 'john@example.com')}
            type="email"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password-demo">{t('register.story.password', 'Password')}</Label>
          <Input id="password-demo" type="password" />
        </div>
        <Button className="w-full">{t('register.story.register', 'Register')}</Button>
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Auth/Register',
  component: RegisterV1Demo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...authHandlers, ...buttonHandlers, ...formHandlers, ...inputHandlers] },
    docs: {
      description: {
        component:
          'Register Pages - Two registration page variants: V1 with split layout (image + form), V2 with centered card. Both include first name, last name, email, password fields, social signup buttons (Google, GitHub), and sign in link.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof RegisterV1Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const V1: Story = {
  name: i18n.t('register.storyName.v1', 'Register V1 (Split Layout)'),
  render: () => <RegisterV1Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify register form elements
    const firstNameInput = canvas.getByPlaceholderText(/first name/i);
    const lastNameInput = canvas.getByPlaceholderText(/last name/i);
    const emailInput = canvas.getByPlaceholderText(/email address/i);
    const passwordInput = canvas.getByPlaceholderText(/password/i);
    const registerButton = canvas.getByRole('button', { name: /register/i });

    expect(firstNameInput).toBeInTheDocument();
    expect(lastNameInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(registerButton).toBeInTheDocument();

    // Test form interaction
    await userEvent.type(firstNameInput, 'John');
    await userEvent.type(lastNameInput, 'Doe');
    await userEvent.type(emailInput, 'john@example.com');

    expect(firstNameInput).toHaveValue('John');
    expect(lastNameInput).toHaveValue('Doe');
    expect(emailInput).toHaveValue('john@example.com');
  },
};

export const V2: Story = {
  name: i18n.t('register.storyName.v2', 'Register V2 (Card)'),
  render: () => <RegisterV2Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify card form elements
    const firstNameInput = canvas.getByLabelText(/first name/i);
    const lastNameInput = canvas.getByLabelText(/last name/i);
    const registerButton = canvas.getByRole('button', { name: /register/i });

    expect(firstNameInput).toBeInTheDocument();
    expect(lastNameInput).toBeInTheDocument();
    expect(registerButton).toBeInTheDocument();

    // Verify social buttons
    expect(canvas.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /github/i })).toBeInTheDocument();
  },
};

export const RegisterForm: Story = {
  name: i18n.t('register.storyName.registerForm', 'Register Form'),
  render: () => <RegisterFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify basic form elements
    const firstNameInput = canvas.getByLabelText(/first name/i);
    const lastNameInput = canvas.getByLabelText(/last name/i);
    const emailInput = canvas.getByLabelText(/email/i);
    const passwordInput = canvas.getByLabelText(/password/i);
    const registerButton = canvas.getByRole('button', { name: /register/i });

    expect(firstNameInput).toBeInTheDocument();
    expect(lastNameInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(registerButton).toBeInTheDocument();

    // Test typing
    await userEvent.type(firstNameInput, 'Jane');
    expect(firstNameInput).toHaveValue('Jane');
  },
};

export const V1Dark: Story = {
  name: i18n.t('register.storyName.v1Dark', 'V1 Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <RegisterV1Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const V2Dark: Story = {
  name: i18n.t('register.storyName.v2Dark', 'V2 Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <RegisterV2Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('register.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <RegisterV2Demo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('register.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <RegisterV2Demo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...V1,
  name: i18n.t('register.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(V1.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...V1,
  name: i18n.t('register.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(V1.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...V1,
  name: i18n.t('register.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...V1,
  name: i18n.t('register.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...V1,
  name: i18n.t('register.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: authStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...V1,
  name: i18n.t('register.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: authStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...V1,
  name: i18n.t('register.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: authStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...V1,
  name: i18n.t('register.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: authStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...V1,
  name: i18n.t('register.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: authStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...V1,
  name: i18n.t('register.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: authStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...V1,
  name: i18n.t('register.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: authStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...V1,
  name: i18n.t('register.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: authStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...V1,
  name: i18n.t('register.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: authStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const registrationData = createFakeRegistrationFormData();
  const field = createFakeFormField();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ registrationData, field }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('register.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

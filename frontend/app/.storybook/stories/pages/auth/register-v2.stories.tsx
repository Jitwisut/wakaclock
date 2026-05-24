import type { Meta, StoryObj } from '@storybook/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { GithubIcon, Loader2Icon } from 'lucide-react';

import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
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

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function RegisterV2Demo() {
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
          <CardTitle className="text-2xl">
            {t('registerV2.story.createNewAccount', 'Create New Account')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="first_name">{t('registerV2.story.firstName', 'First name')}</Label>
              <Input
                className="w-full"
                id="first_name"
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('registerV2.story.firstName', 'First name')}
                value={firstName}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_name">{t('registerV2.story.lastName', 'Last name')}</Label>
              <Input
                className="w-full"
                id="last_name"
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t('registerV2.story.lastName', 'Last name')}
                value={lastName}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">{t('registerV2.story.email', 'Email')}</Label>
              <Input
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('registerV2.story.emailPlaceholder', 'contact@bundui.com')}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('registerV2.story.password', 'Password')}</Label>
              <Input
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
                  {t('registerV2.story.pleaseWait', 'Please wait')}
                </>
              ) : (
                t('registerV2.story.register', 'Register')
              )}
            </Button>

            <div className="my-4">
              <div className="flex items-center gap-3">
                <div className="w-full border-t" />
                <span className="text-muted-foreground shrink-0 text-sm">
                  {t('registerV2.story.orContinueWith', 'or continue with')}
                </span>
                <div className="w-full border-t" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button className="w-full" type="button" variant="outline">
                {t('registerV2.story.google', 'Google')}
              </Button>
              <Button className="w-full" type="button" variant="outline">
                <GithubIcon className="h-4 w-4" />
                {t('registerV2.story.github', 'GitHub')}
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm">
            {t('registerV2.story.alreadyHaveAccount', 'Already have an account?')}{' '}
            <a className="underline" href="/login">
              {t('registerV2.story.logIn', 'Log in')}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RegisterV2FormDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-sm p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('registerV2.story.createNewAccount', 'Create New Account')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fn">{t('registerV2.story.firstName', 'First name')}</Label>
              <Input id="fn" placeholder={t('registerV2.story.firstName', 'First name')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln">{t('registerV2.story.lastName', 'Last name')}</Label>
              <Input id="ln" placeholder={t('registerV2.story.lastName', 'Last name')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="em">{t('registerV2.story.email', 'Email')}</Label>
              <Input
                id="em"
                placeholder={t('registerV2.story.emailPlaceholder', 'contact@bundui.com')}
                type="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pw">{t('registerV2.story.password', 'Password')}</Label>
              <Input id="pw" type="password" />
            </div>
            <Button className="w-full" type="submit">
              {t('registerV2.story.register', 'Register')}
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
  title: 'Pages/Auth/Register V2',
  component: RegisterV2Demo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...formHandlers] },
    docs: {
      description: {
        component:
          'Register V2 Page - Registration form with first name, last name, email, password, social login (Google/GitHub), and a link to log in.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof RegisterV2Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('registerV2.storyName.default', 'Full Page'),
  render: () => <RegisterV2Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify form elements
    const firstNameInput = canvas.getByLabelText(/first name/i);
    const lastNameInput = canvas.getByLabelText(/last name/i);
    const emailInput = canvas.getByLabelText(/email/i);
    const submitButton = canvas.getByRole('button', { name: /register/i });

    expect(firstNameInput).toBeInTheDocument();
    expect(lastNameInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();

    // Test typing into fields
    await userEvent.type(firstNameInput, 'John');
    expect(firstNameInput).toHaveValue('John');
  },
};

export const Form: Story = {
  name: i18n.t('registerV2.storyName.form', 'Form Only'),
  render: () => <RegisterV2FormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText('Create New Account')).toBeInTheDocument();
    expect(canvas.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /register/i })).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('registerV2.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <RegisterV2Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('registerV2.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <RegisterV2Demo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('registerV2.storyName.rTL', 'RTL'),
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
  ...Default,
  name: i18n.t('registerV2.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'registerV2.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('registerV2.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
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
  name: i18n.t('registerV2.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

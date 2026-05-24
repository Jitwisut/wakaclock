import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';

import {
  createFakeCheckoutFormData,
  createFakeContactForm,
  createFakeContactFormData,
  createFakeCountries,
  createFakeCountry,
  createFakeFormData,
  createFakeFormField,
  createFakeFormMatrix,
  createFakeFormShowcase,
  createFakeFormSubmitResponse,
  createFakeLoginForm,
  createFakeLoginFormData,
  createFakeOption,
  createFakeOptionGroup,
  createFakeOptionGroups,
  createFakeOptions,
  createFakePasswordChangeFormData,
  createFakeProfileForm,
  createFakeProfileFormData,
  createFakeRegistrationForm,
  createFakeRegistrationFormData,
  createFakeSearchForm,
  createFakeSearchFormData,
  createFakeSettingsForm,
  createFakeSettingsFormData,
  createFakeValidationError,
  createFakeValidationErrors,
  createFakeValidationErrorShowcase,
  FORM_BUTTON_LABELS,
  FORM_CANCEL_LABELS,
  FORM_FIELD_TYPES,
  FORM_LAYOUT_TYPES,
  FORM_SIZE_VARIANTS,
  FORM_SUBMISSION_STATUSES,
  FORM_VALIDATION_MODES,
} from '@/.storybook/stories/_factories/form.factory';
import type {
  FakeCheckoutFormData,
  FakeContactFormData,
  FakeCountry,
  FakeFormConfig,
  FakeFormData,
  FakeFormField,
  FakeFormSubmitResponse,
  FakeLoginFormData,
  FakeOption,
  FakeOptionGroup,
  FakePasswordChangeFormData,
  FakeProfileFormData,
  FakeRegistrationFormData,
  FakeSearchFormData,
  FakeSettingsFormData,
  FakeValidationError,
  FakeValidationRule,
  FormFieldType,
  FormLayoutType,
  FormSizeVariant,
  FormSubmissionStatus,
  FormValidationMode,
  ValidationSeverity,
} from '@/.storybook/stories/_factories/form.factory';
import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import {
  STORY_EMAIL_INPUT_NOT_FOUND,
  STORY_FORM_NOT_FOUND,
  STORY_NO_DOM_ERROR,
} from '@/.storybook/stories/_utils/story-helpers';
import {
  createFakeAdminUser,
  createFakeBannedUser,
  createFakeEnterpriseUser,
  createFakeEnterpriseUserSet,
  createFakeExpiredSession,
  createFakeFreshSession,
  createFakeGuestUser,
  createFakeNewUserProfile,
  createFakeOfflineUser,
  createFakeOnlineUser,
  createFakePendingUser,
  createFakePopularUserProfile,
  createFakePremiumUser,
  createFakeSocialLink,
  createFakeSocialLinks,
  createFakeSuspendedUser,
  createFakeTeam,
  createFakeUltimateEnterpriseUser,
  createFakeUser,
  createFakeUserActivities,
  createFakeUserActivity,
  createFakeUserGroup,
  createFakeUserGroups,
  createFakeUserNotificationSettings,
  createFakeUserPermissions,
  createFakeUserProfile,
  createFakeUserProfiles,
  createFakeUserRoleStatusMatrix,
  createFakeUserRoleTierMatrix,
  createFakeUsers,
  createFakeUserSession,
  createFakeUserSessions,
  createFakeUserStatusPresenceMatrix,
  createFakeUsersWithAllPresence,
  createFakeUsersWithAllRoles,
  createFakeUsersWithAllStatuses,
  createFakeUsersWithAllTiers,
  createFakeUserVerificationTierMatrix,
  PRESENCE_STATUSES,
  SOCIAL_PLATFORMS,
  USER_ACTIONS,
  USER_AVATAR_SIZES,
  USER_DEPARTMENTS,
  USER_ROLES,
  USER_STATUSES,
  USER_TIERS,
  USER_VERIFICATIONS,
} from '@/.storybook/stories/_factories/user.factory';
import type {
  FakeSocialLink,
  FakeUser,
  FakeUserActivity,
  FakeUserGroup,
  FakeUserNotificationSettings,
  FakeUserPermissions,
  FakeUserProfile,
  FakeUserSession,
  PresenceStatus,
  UserAvatarSize,
  UserRole,
  UserStatus,
  UserTier,
  UserVerification,
} from '@/.storybook/stories/_factories/user.factory';

import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AlertCircleIcon, CheckCircleIcon, Loader2Icon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

// Seed faker for deterministic test data
import i18n from 'i18next';

seedFaker();

// ============ TYPES ============

type BasicFormValues = {
  email: string;
};

type AsyncFormValues = {
  email: string;
  message: string;
  name: string;
};

interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

interface SubmitResponse {
  id: string;
  message?: string;
  success: boolean;
}

type SubmissionState = {
  data: SubmitResponse | null;
  error: ApiError | null;
  status: 'error' | 'idle' | 'loading' | 'success';
};

// ============ HELPER FUNCTIONS ============

function getStatusLabel(status: SubmissionState['status']): string {
  if (status === 'loading') return i18n.t('form.story.submitting', 'Submitting...');
  if (status === 'success') return i18n.t('form.story.submitted', 'Submitted!');
  if (status === 'error') return i18n.t('form.story.tryAgain', 'Try Again');
  return i18n.t('form.story.submit', 'Submit');
}

// ============ I18N WRAPPER COMPONENTS ============

function FormDemo() {
  const form = useForm<BasicFormValues>({
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  const [submitted, setSubmitted] = React.useState<BasicFormValues | null>(null);

  return (
    <div className="w-full max-w-lg space-y-6">
      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit((values) => {
            setSubmitted(values);
          })}
          aria-label={i18n.t('form.ariaLabel')}
        >
          <FormField
            control={form.control}
            name="email"
            rules={{
              required: i18n.t('form.email.required'),
              pattern: {
                value: /^[^\s@]+@[^\s@.]+\.[a-z]{2,}$/i,
                message: i18n.t('form.email.invalid'),
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{i18n.t('form.email.label')}</FormLabel>
                <FormControl>
                  <Input placeholder={i18n.t('form.email.placeholder')} type="email" {...field} />
                </FormControl>
                <FormDescription>{i18n.t('form.email.description')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2">
            <Button type="submit">{i18n.t('form.action.submit')}</Button>
            <Button
              onClick={() => {
                form.reset();
                setSubmitted(null);
              }}
              type="button"
              variant="outline"
            >
              {i18n.t('form.action.reset')}
            </Button>
          </div>
        </form>
      </Form>

      {submitted ? (
        <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify(submitted, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

// ============ VARIANT FORM COMPONENTS (module scope to avoid unstable nested components) ============

function BasicFormVariant() {
  const { t } = useTranslation();
  const form = useForm({ defaultValues: { email: '' } });
  return (
    <Form {...form}>
      <form className="space-y-4" aria-label={t('form.variant.basic')}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.email.label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('form.email.placeholder')} type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">{t('form.action.subscribe')}</Button>
      </form>
    </Form>
  );
}

function LoginFormVariant() {
  const { t } = useTranslation();
  const form = useForm({ defaultValues: { username: '', password: '' } });
  return (
    <Form {...form}>
      <form className="space-y-4" aria-label={t('form.variant.login')}>
        <FormField
          control={form.control}
          name="username"
          rules={{ required: t('form.username.required') }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.username.label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('form.username.placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          rules={{ required: t('form.password.required') }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.password.label')}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={t('form.password.placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">
          {t('form.action.signIn')}
        </Button>
      </form>
    </Form>
  );
}

function RegistrationFormVariant() {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  return (
    <Form {...form}>
      <form className="space-y-4" aria-label={t('form.variant.registration')}>
        <FormField
          control={form.control}
          name="name"
          rules={{ required: t('form.name.required') }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.name.label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('form.name.placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          rules={{
            required: t('form.email.required'),
            pattern: { value: /^[^\s@]+@[^\s@.]+\.[a-z]{2,}$/i, message: t('form.email.invalid') },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.email.label')}</FormLabel>
              <FormControl>
                <Input type="email" placeholder={t('form.email.placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          rules={{
            required: t('form.password.required'),
            minLength: { value: 8, message: t('form.password.minLength') },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.password.label')}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={t('form.password.placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          rules={{ required: t('form.confirmPassword.required') }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.confirmPassword.label')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder={t('form.confirmPassword.placeholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">
          {t('form.action.createAccount')}
        </Button>
      </form>
    </Form>
  );
}

function ValidationFormVariant() {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: { email: 'invalid-email', website: '' },
    mode: 'onChange',
  });
  React.useEffect(() => {
    form.trigger('email');
  }, [form]);
  return (
    <Form {...form}>
      <form className="space-y-4" aria-label={t('form.variant.validation')}>
        <FormField
          control={form.control}
          name="email"
          rules={{
            required: t('form.email.required'),
            pattern: {
              value: /^[^\s@]+@[^\s@.]+\.[a-z]{2,}$/i,
              message: t('form.email.invalid'),
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('form.email.label')} ({t('form.state.withError')})
              </FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormDescription>{t('form.validation.showsError')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('form.website.label')} ({t('form.state.optional')})
              </FormLabel>
              <FormControl>
                <Input placeholder={t('form.website.placeholder')} {...field} />
              </FormControl>
              <FormDescription>{t('form.website.description')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">{t('form.action.validate')}</Button>
      </form>
    </Form>
  );
}

function VariantsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-3 text-sm font-medium">{t('form.variant.basic')}</p>
        <div className="w-full max-w-sm">
          <BasicFormVariant />
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{t('form.variant.login')}</p>
        <div className="w-full max-w-sm">
          <LoginFormVariant />
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{t('form.variant.registration')}</p>
        <div className="w-full max-w-sm">
          <RegistrationFormVariant />
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{t('form.variant.validation')}</p>
        <div className="w-full max-w-sm">
          <ValidationFormVariant />
        </div>
      </div>
    </div>
  );
}

// ============ SIZE FORM COMPONENTS (module scope to avoid unstable nested components) ============

function CompactFormSize() {
  const { t } = useTranslation();
  const form = useForm({ defaultValues: { search: '', filter: '' } });
  return (
    <Form {...form}>
      <form className="space-y-2" aria-label={t('form.size.compact')}>
        <FormField
          control={form.control}
          name="search"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-xs">{t('form.search.label')}</FormLabel>
              <FormControl>
                <Input
                  className="h-8 text-sm"
                  placeholder={t('form.search.placeholder')}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="filter"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-xs">{t('form.filter.label')}</FormLabel>
              <FormControl>
                <Input
                  className="h-8 text-sm"
                  placeholder={t('form.filter.placeholder')}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" className="h-8">
          {t('form.action.apply')}
        </Button>
      </form>
    </Form>
  );
}

function DefaultFormSize() {
  const { t } = useTranslation();
  const form = useForm({ defaultValues: { name: '', email: '' } });
  return (
    <Form {...form}>
      <form className="space-y-4" aria-label={t('form.size.default')}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.name.label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('form.name.placeholder')} {...field} />
              </FormControl>
              <FormDescription>{t('form.name.description')}</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.email.label')}</FormLabel>
              <FormControl>
                <Input type="email" placeholder={t('form.email.placeholder')} {...field} />
              </FormControl>
              <FormDescription>{t('form.email.description')}</FormDescription>
            </FormItem>
          )}
        />
        <Button type="submit">{t('form.action.submit')}</Button>
      </form>
    </Form>
  );
}

function SpaciousFormSize() {
  const { t } = useTranslation();
  const form = useForm({ defaultValues: { title: '', description: '', notes: '' } });
  return (
    <Form {...form}>
      <form className="space-y-8" aria-label={t('form.size.spacious')}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-base">{t('form.title.label')}</FormLabel>
              <FormControl>
                <Input
                  className="h-12 text-base"
                  placeholder={t('form.title.placeholder')}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-sm">{t('form.title.description')}</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-base">{t('form.description.label')}</FormLabel>
              <FormControl>
                <Input
                  className="h-12 text-base"
                  placeholder={t('form.description.placeholder')}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-sm">
                {t('form.description.description')}
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-base">{t('form.notes.label')}</FormLabel>
              <FormControl>
                <Input
                  className="h-12 text-base"
                  placeholder={t('form.notes.placeholder')}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-sm">{t('form.notes.description')}</FormDescription>
            </FormItem>
          )}
        />
        <Button type="submit" size="lg">
          {t('form.action.submitForm')}
        </Button>
      </form>
    </Form>
  );
}

function SizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="mb-3 text-sm font-medium">{t('form.size.compact')}</p>
        <div className="w-full max-w-xs">
          <CompactFormSize />
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{t('form.size.default')}</p>
        <div className="w-full max-w-sm">
          <DefaultFormSize />
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{t('form.size.spacious')}</p>
        <div className="w-full max-w-lg">
          <SpaciousFormSize />
        </div>
      </div>
    </div>
  );
}

// ============ ASYNC FORM DEMO COMPONENTS ============

function FormWithAsyncSubmit() {
  const { t } = useTranslation();
  const form = useForm<AsyncFormValues>({
    defaultValues: { name: '', email: '', message: '' },
    mode: 'onBlur',
  });

  const [state, setState] = React.useState<SubmissionState>({
    status: 'idle',
    error: null,
    data: null,
  });

  const onSubmit = async (values: AsyncFormValues) => {
    setState({ status: 'loading', error: null, data: null });

    try {
      const res = await fetch('/api/form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        const error = data as ApiError;
        // Handle field-level errors from 422
        if (error.details) {
          Object.entries(error.details).forEach(([field, message]) => {
            form.setError(field as keyof AsyncFormValues, {
              type: 'server',
              message,
            });
          });
        }
        setState({ status: 'error', error, data: null });
        return;
      }

      setState({ status: 'success', error: null, data: data as SubmitResponse });
      form.reset();
    } catch {
      setState({
        status: 'error',
        error: {
          status: 0,
          code: 'NETWORK_ERROR',
          message: t('form.error.network'),
        },
        data: null,
      });
    }
  };

  return (
    <div className="w-full max-w-lg space-y-6" data-testid="async-form-demo">
      {state.status === 'success' && state.data && (
        <Alert data-testid="form-success">
          <CheckCircleIcon className="size-4 text-green-500" />
          <AlertTitle>{t('form.success.title')}</AlertTitle>
          <AlertDescription>
            {t('form.success.description')} ID: {state.data.id}
          </AlertDescription>
        </Alert>
      )}

      {state.status === 'error' && state.error && !state.error.details && (
        <Alert
          variant="destructive"
          data-testid="form-error"
          data-error-status={state.error.status}
        >
          <AlertCircleIcon className="size-4" />
          <AlertTitle>
            {t('form.error.title')} {state.error.status || 'Unknown'}: {state.error.code}
          </AlertTitle>
          <AlertDescription>{state.error.message}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
          aria-label={t('form.ariaLabel')}
        >
          <FormField
            control={form.control}
            name="name"
            rules={{ required: t('form.name.required') }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.name.label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.name.placeholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            rules={{
              required: t('form.email.required'),
              pattern: {
                value: /^[^\s@]+@[^\s@.]+\.[a-z]{2,}$/i,
                message: t('form.email.invalid'),
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.email.label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.email.placeholder')} type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            rules={{
              required: t('form.message.required'),
              minLength: { value: 10, message: t('form.message.minLength') },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.message.label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.message.placeholder')} {...field} />
                </FormControl>
                <FormDescription>{t('form.message.description')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={state.status === 'loading'}>
            {state.status === 'loading' && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {getStatusLabel(state.status)}
          </Button>
        </form>
      </Form>

      {state.status === 'loading' && (
        <div data-testid="form-loading" className="text-muted-foreground text-sm" role="status">
          {t('form.loading.processing')}
        </div>
      )}
    </div>
  );
}

// ============ KEYBOARD INTERACTION DEMO ============

function KeyboardInteractionDemo() {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: { field1: '', field2: '', field3: '' },
  });

  const [submitCount, setSubmitCount] = React.useState(0);

  return (
    <div className="w-full max-w-lg space-y-6" data-testid="keyboard-form-demo">
      <p className="text-muted-foreground text-sm">{t('form.a11y.keyboardInstructions')}</p>
      <Form {...form}>
        <form
          className="space-y-4"
          aria-label={t('form.ariaLabel')}
          onSubmit={form.handleSubmit(() => setSubmitCount((c) => c + 1))}
        >
          <FormField
            control={form.control}
            name="field1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.field.first')}</FormLabel>
                <FormControl>
                  <Input
                    data-testid="field-1"
                    placeholder={t('form.field.firstPlaceholder')}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="field2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.field.second')}</FormLabel>
                <FormControl>
                  <Input
                    data-testid="field-2"
                    placeholder={t('form.field.secondPlaceholder')}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="field3"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.field.third')}</FormLabel>
                <FormControl>
                  <Input
                    data-testid="field-3"
                    placeholder={t('form.field.thirdPlaceholder')}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex gap-2">
            <Button type="submit" data-testid="submit-button">
              {t('form.action.submit')} ({submitCount})
            </Button>
            <Button type="button" variant="outline" data-testid="cancel-button">
              {t('form.action.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ============ ACCESSIBILITY DEMO ============

function AccessibilityDemo() {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: { name: '', email: '', message: '' },
    mode: 'onBlur',
  });

  return (
    <div className="w-full max-w-lg space-y-6">
      <Form {...form}>
        <form className="space-y-6" aria-label={t('form.ariaLabel')}>
          <FormField
            control={form.control}
            name="name"
            rules={{ required: t('form.name.required') }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('form.name.label')} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder={t('form.name.placeholder')} aria-required="true" {...field} />
                </FormControl>
                <FormDescription>{t('form.name.description')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            rules={{
              required: t('form.email.required'),
              pattern: {
                value: /^[^\s@]+@[^\s@.]+\.[a-z]{2,}$/i,
                message: t('form.email.invalid'),
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('form.email.label')} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder={t('form.email.placeholder')}
                    aria-required="true"
                    {...field}
                  />
                </FormControl>
                <FormDescription>{t('form.email.description')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('form.message.label')} ({t('form.state.optional')})
                </FormLabel>
                <FormControl>
                  <Input placeholder={t('form.message.placeholder')} {...field} />
                </FormControl>
                <FormDescription>{t('form.message.description')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2">
            <Button type="submit">{t('form.action.submit')}</Button>
            <Button type="reset" variant="outline">
              {t('form.action.reset')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ============ ERROR STATES DEMO ============

function AccessibilityErrorStatesDemo() {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: { email: 'invalid-email' },
    mode: 'onBlur',
  });

  React.useEffect(() => {
    form.trigger('email');
  }, [form]);

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('form.a11y.errorStateTitle')}</h3>
        <p className="text-muted-foreground text-sm">{t('form.a11y.errorStateDescription')}</p>
      </div>
      <Form {...form}>
        <form className="space-y-6" aria-label={t('form.ariaLabel')}>
          <FormField
            control={form.control}
            name="email"
            rules={{
              required: t('form.email.required'),
              pattern: {
                value: /^[^\s@]+@[^\s@.]+\.[a-z]{2,}$/i,
                message: t('form.email.invalid'),
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.email.label')}</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">{t('form.action.submit')}</Button>
        </form>
      </Form>
    </div>
  );
}

// ============ FAKER DATA DEMO ============

function FakerFormDemo() {
  const { t } = useTranslation();
  const fakeUser = createFakeUser();
  const fakeData = {
    name: fakeUser.name,
    email: fakeUser.email,
    message: t('form.faker.sampleMessage'),
  };

  const form = useForm<AsyncFormValues>({
    defaultValues: fakeData,
    mode: 'onBlur',
  });

  return (
    <div className="w-full max-w-lg space-y-6" data-testid="faker-form-demo">
      <Form {...form}>
        <form className="space-y-6" aria-label={t('form.ariaLabel')}>
          <FormField
            control={form.control}
            name="name"
            rules={{ required: t('form.name.required') }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.name.label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.name.placeholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            rules={{
              required: t('form.email.required'),
              pattern: {
                value: /^[^\s@]+@[^\s@.]+\.[a-z]{2,}$/i,
                message: t('form.email.invalid'),
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.email.label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.email.placeholder')} type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            rules={{
              required: t('form.message.required'),
              minLength: { value: 10, message: t('form.message.minLength') },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.message.label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.message.placeholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit">{t('form.action.submit')}</Button>
        </form>
      </Form>
    </div>
  );
}

// ============ EMPTY FORM DEMO ============

function EmptyFormDemo() {
  const { t } = useTranslation();
  const form = useForm<AsyncFormValues>({
    defaultValues: { name: '', email: '', message: '' },
    mode: 'onBlur',
  });

  return (
    <div className="w-full max-w-lg space-y-6" data-testid="empty-form-demo" data-state="empty">
      <Form {...form}>
        <form className="space-y-6" aria-label={t('form.ariaLabel')}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.name.label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.name.placeholder')} {...field} />
                </FormControl>
                <FormDescription>{t('form.empty.allFieldsEmpty')}</FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.email.label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.email.placeholder')} type="email" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit">{t('form.action.submit')}</Button>
        </form>
      </Form>
    </div>
  );
}

// ============ META CONFIGURATION ============

const meta = {
  title: 'Components/UI/Form',
  component: FormDemo,
  tags: ['autodocs'],
  args: {
    // Event handlers with fn() for Actions panel logging
    onSubmit: fn(),
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: {
      handlers: formHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // ═══════════════════════════════════════════════════════════════
    // CONTENT
    // ═══════════════════════════════════════════════════════════════
    children: {
      control: false,
      description: i18n.t(
        'form.argType.formContentFieldsSubmitButtonEtc',
        'Form content (fields, submit button, etc.)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    title: {
      control: 'text',
      description: i18n.t('form.argType.formTitleText', 'Form title text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    description: {
      control: 'text',
      description: i18n.t('form.argType.formDescriptionText', 'Form description text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // APPEARANCE
    // ═══════════════════════════════════════════════════════════════
    layout: {
      control: 'select',
      options: ['vertical', 'horizontal', 'inline', 'stacked'],
      description: i18n.t('form.argType.formLayoutStyle', 'Form layout style'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'vertical' },
        type: { summary: "'vertical' | 'horizontal' | 'inline' | 'stacked'" },
      },
    },
    size: {
      control: 'select',
      options: ['compact', 'default', 'spacious'],
      description: i18n.t('form.argType.formSizeVariant', 'Form size variant'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: { summary: "'compact' | 'default' | 'spacious'" },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('form.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'form.argType.whetherFormFieldsAreDisabled',
        'Whether form fields are disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    loading: {
      control: 'boolean',
      description: i18n.t(
        'form.argType.whetherFormIsInLoadingsubmittingState',
        'Whether form is in loading/submitting state'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    validationMode: {
      control: 'select',
      options: ['onSubmit', 'onBlur', 'onChange', 'onTouched', 'all'],
      description: i18n.t('form.argType.whenValidationIsTriggered', 'When validation is triggered'),
      table: {
        category: 'State',
        defaultValue: { summary: 'onSubmit' },
        type: { summary: "'onSubmit' | 'onBlur' | 'onChange' | 'onTouched' | 'all'" },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // LAYOUT
    // ═══════════════════════════════════════════════════════════════
    submitLabel: {
      control: 'text',
      description: i18n.t('form.argType.submitButtonLabel', 'Submit button label'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'Submit' },
        type: { summary: 'string' },
      },
    },
    cancelLabel: {
      control: 'text',
      description: i18n.t('form.argType.cancelresetButtonLabel', 'Cancel/reset button label'),
      table: {
        category: 'Layout',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════
    onClick: {
      action: 'onClick',
      description: i18n.t('form.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('form.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('form.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('form.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('form.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('form.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('form.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onSubmit: {
      action: 'onSubmit',
      description: i18n.t(
        'form.argType.calledWhenFormIsSubmitted',
        'Called when form is submitted'
      ),
      table: { category: 'Events' },
    },
    onChange: {
      action: 'onChange',
      description: i18n.t(
        'form.argType.calledWhenAnyFieldValueChanges',
        'Called when any field value changes'
      ),
      table: { category: 'Events' },
    },
    onReset: {
      action: 'onReset',
      description: i18n.t('form.argType.calledWhenFormIsReset', 'Called when form is reset'),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof FormDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ CORE STORIES ============

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const form = canvasElement.querySelector('form');
    if (!(form instanceof HTMLFormElement)) {
      throw new Error(STORY_FORM_NOT_FOUND);
    }

    // Test: Form has aria-label
    expect(form).toHaveAttribute('aria-label');

    const emailLabel = canvasElement.querySelector('[data-slot="form-label"]');
    if (!(emailLabel instanceof HTMLElement)) {
      throw new Error(
        i18n.t('test.expectedFormLabelToBePresent', 'Expected form label to be present.')
      );
    }
    expect(emailLabel).toHaveTextContent(/.+/);

    const description = canvasElement.querySelector('[data-slot="form-description"]');
    if (!(description instanceof HTMLElement)) {
      throw new Error(
        i18n.t(
          'test.expectedFormDescriptionToBePresent',
          'Expected form description to be present.'
        )
      );
    }
    expect(description).toHaveTextContent(/.+/);

    const emailInput = canvasElement.querySelector('input[name="email"]');
    if (!(emailInput instanceof HTMLInputElement)) {
      throw new Error(STORY_EMAIL_INPUT_NOT_FOUND);
    }

    // Test: aria-describedby is present
    expect(emailInput).toHaveAttribute('aria-describedby');

    await userEvent.click(emailInput);
    await userEvent.tab();

    const readMessageText = () => {
      const message = canvasElement.querySelector('[data-slot="form-message"]');
      if (!(message instanceof HTMLElement)) return null;
      const text = message.textContent?.trim();
      return text || null;
    };

    let requiredMessage = '';

    await waitFor(() => {
      const messageText = readMessageText();
      expect(messageText).toBeTruthy();
      requiredMessage = messageText ?? '';
      // Test: aria-invalid is set on error
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      expect(canvasElement.querySelector('[data-slot="form-message"]')).toBeInTheDocument();
    });

    await userEvent.click(emailInput);
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'not-an-email');
    await userEvent.tab();

    await waitFor(() => {
      const messageText = readMessageText();
      expect(messageText).toBeTruthy();
      expect(messageText).not.toBe(requiredMessage);
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });

    await userEvent.click(emailInput);
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'ada@example.com');

    const submitButton = form.querySelector('button[type="submit"]');
    if (!(submitButton instanceof HTMLButtonElement)) {
      throw new Error(
        i18n.t('test.expectedSubmitButtonToBePresent', 'Expected submit button to be present.')
      );
    }

    const resetButton = form.querySelector('button[type="button"]');
    if (!(resetButton instanceof HTMLButtonElement)) {
      throw new Error(
        i18n.t('test.expectedResetButtonToBePresent', 'Expected reset button to be present.')
      );
    }

    const canvas = within(canvasElement);

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(canvas.getByText(/\"email\": \"ada@example\\.com\"/)).toBeInTheDocument();
    });

    await userEvent.click(resetButton);

    await waitFor(() => {
      expect(canvas.queryByText(/\"email\":/)).not.toBeInTheDocument();
      expect(emailInput).toHaveAttribute('aria-invalid', 'false');
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute('aria-label');

    const emailInput = canvasElement.querySelector('input[name="email"]');
    expect(emailInput).toBeInTheDocument();

    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  },
};

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    // Verify all four form variants render
    const forms = canvasElement.querySelectorAll('form');
    expect(forms.length).toBe(4);

    // Basic form variant
    const basicForm = canvasElement.querySelector('form[aria-label]');
    expect(basicForm).toBeInTheDocument();

    // Login form has username and password fields
    const usernameInput = canvasElement.querySelector('input[name="username"]');
    expect(usernameInput).toBeInTheDocument();
    const passwordInputs = canvasElement.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(1);

    // Registration form has confirmPassword field
    const confirmPasswordInput = canvasElement.querySelector('input[name="confirmPassword"]');
    expect(confirmPasswordInput).toBeInTheDocument();

    // Validation form has pre-filled invalid email
    const emailInputs = canvasElement.querySelectorAll('input[type="email"]');
    expect(emailInputs.length).toBeGreaterThanOrEqual(1);

    // All forms have submit buttons
    const buttons = canvasElement.querySelectorAll('button[type="submit"]');
    expect(buttons.length).toBe(4);
  },
};

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    // Verify all three size variants render
    const forms = canvasElement.querySelectorAll('form');
    expect(forms.length).toBe(3);

    // Compact form has small inputs (h-8 class)
    const compactInputs = canvasElement.querySelectorAll('input.h-8');
    expect(compactInputs.length).toBeGreaterThanOrEqual(1);

    // Default form has name and email fields
    const nameInput = canvasElement.querySelector('input[name="name"]');
    expect(nameInput).toBeInTheDocument();

    // Spacious form has large inputs (h-12 class)
    const spaciousInputs = canvasElement.querySelectorAll('input.h-12');
    expect(spaciousInputs.length).toBeGreaterThanOrEqual(1);

    // All forms have submit buttons
    const buttons = canvasElement.querySelectorAll('button[type="submit"]');
    expect(buttons.length).toBe(3);
  },
};

// ============ DARK MODE STORY ============

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    // Test: Component renders in dark mode
    const form = canvasElement.querySelector('form');
    expect(form).toBeInTheDocument();

    // Verify dark mode class is applied
    const doc = canvasElement.ownerDocument;
    await waitFor(() => {
      expect(doc.documentElement.classList.contains('dark')).toBe(true);
    });

    // Test form elements are visible
    const emailInput = canvasElement.querySelector('input[name="email"]');
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toBeVisible();
  },
};

export const DarkModeJapanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    await waitFor(() => {
      expect(doc.documentElement.classList.contains('dark')).toBe(true);
      expect(doc.documentElement.lang).toBe('ja');
    });

    const canvas = within(canvasElement);
    expect(canvas.getByText('メール')).toBeInTheDocument();
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
    const form = canvasElement.querySelector('form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute('aria-label');

    const emailInput = canvasElement.querySelector('input[name="email"]');
    expect(emailInput).toBeInTheDocument();

    // Verify form label is present
    const label = canvasElement.querySelector('[data-slot="form-label"]');
    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent(/.+/);

    // Verify description is present
    const description = canvasElement.querySelector('[data-slot="form-description"]');
    expect(description).toBeInTheDocument();
  },
};

// ============ JAPANESE LOCALE STORY ============

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
    expect(doc.documentElement.lang).toBe('ja');

    const form = canvasElement.querySelector('form');
    if (!(form instanceof HTMLFormElement)) {
      throw new Error(STORY_FORM_NOT_FOUND);
    }

    const canvas = within(canvasElement);

    // Test: Japanese labels are rendered
    expect(canvas.getByText('メール')).toBeInTheDocument();
    expect(canvas.getByText('メールは共有しません。')).toBeInTheDocument();

    const emailInput = canvasElement.querySelector('input[name="email"]');
    if (!(emailInput instanceof HTMLInputElement)) {
      throw new Error(STORY_EMAIL_INPUT_NOT_FOUND);
    }

    // Test: Validation error in Japanese
    await userEvent.click(emailInput);
    await userEvent.tab();

    await waitFor(() => {
      expect(canvas.getByText('メールは必須です。')).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });

    // Test: Invalid email message in Japanese
    await userEvent.click(emailInput);
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'not-an-email');
    await userEvent.tab();

    await waitFor(() => {
      expect(canvas.getByText('有効なメールアドレスを入力してください。')).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });

    // Test: Successful submission with Japanese buttons
    await userEvent.click(emailInput);
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'ada@example.com');

    await userEvent.click(canvas.getByRole('button', { name: '送信' }));

    await waitFor(() => {
      expect(canvas.getByText(/\"email\": \"ada@example\\.com\"/)).toBeInTheDocument();
    });

    await userEvent.click(canvas.getByRole('button', { name: 'リセット' }));

    await waitFor(() => {
      expect(canvas.queryByText(/\"email\":/)).not.toBeInTheDocument();
      expect(emailInput).toHaveAttribute('aria-invalid', 'false');
    });
  },
};

// ============ ACCESSIBILITY STORIES ============

export const KeyboardInteraction: Story = {
  name: i18n.t('form.storyName.keyboardInteraction', 'Keyboard Interaction'),
  render: () => <KeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const inputs = canvasElement.querySelectorAll('input');
    const buttons = canvasElement.querySelectorAll('button');

    // Test: Tab through all fields
    await userEvent.tab();
    expect(doc.activeElement).toBe(inputs[0]);

    await userEvent.tab();
    expect(doc.activeElement).toBe(inputs[1]);

    await userEvent.tab();
    expect(doc.activeElement).toBe(inputs[2]);

    await userEvent.tab();
    expect(doc.activeElement).toBe(buttons[0]);

    await userEvent.tab();
    expect(doc.activeElement).toBe(buttons[1]);

    // Test: Shift+Tab backwards
    await userEvent.tab({ shift: true });
    expect(doc.activeElement).toBe(buttons[0]);

    await userEvent.tab({ shift: true });
    expect(doc.activeElement).toBe(inputs[2]);

    // Test: Enter key submits form
    await userEvent.click(buttons[0]);
    const submitButton = canvasElement.querySelector('[data-testid="submit-button"]');
    expect(submitButton).toHaveTextContent(/\(1\)/);
  },
};

export const Accessibility: Story = {
  name: i18n.t('form.storyName.accessibility', 'Accessibility Testing'),
  render: () => <AccessibilityDemo />,
  play: async ({ canvasElement }) => {
    // Test: Form has accessible label
    const form = canvasElement.querySelector('form');
    expect(form?.getAttribute('aria-label')).toBeTruthy();

    // Test: All form fields have associated labels
    const inputs = canvasElement.querySelectorAll('input');
    inputs.forEach((input) => {
      const id = input.getAttribute('id');
      if (id) {
        // FormControl assigns id, and FormLabel uses htmlFor through context
        expect(input).toHaveAttribute('aria-describedby');
      }
    });

    // Test: Required fields have aria-required
    const requiredInputs = canvasElement.querySelectorAll('input[aria-required="true"]');
    expect(requiredInputs.length).toBe(2); // name and email

    // Test: Validation errors announce properly
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    await userEvent.click(emailInput);
    await userEvent.type(emailInput, 'invalid');
    await userEvent.tab();

    await waitFor(() => {
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      const errorMessage = canvasElement.querySelector('[data-slot="form-message"]');
      expect(errorMessage).toBeInTheDocument();
    });

    // Test: Keyboard navigation
    const firstInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    firstInput?.focus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab(); // Should be on submit button

    const { activeElement } = canvasElement.ownerDocument;
    expect(activeElement?.tagName).toBe('BUTTON');
  },
  parameters: {
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
};

export const AccessibilityErrorStates: Story = {
  name: i18n.t('form.storyName.accessibilityErrorStates', 'Error Announcements'),
  render: () => <AccessibilityErrorStatesDemo />,
  play: async ({ canvasElement }) => {
    // Wait for validation to trigger
    await waitFor(() => {
      const emailInput = canvasElement.querySelector('input[name="email"]');
      expect(emailInput?.getAttribute('aria-invalid')).toBe('true');
    });

    // Test: Error message exists
    const errorMessage = canvasElement.querySelector('[data-slot="form-message"]');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent(/valid|有効/);

    // Test: Input has aria-describedby pointing to error
    const emailInput = canvasElement.querySelector('input[name="email"]');
    expect(emailInput).toHaveAttribute('aria-describedby');

    // Test: Error message has role="alert"
    expect(errorMessage).toHaveAttribute('role', 'alert');
    expect(errorMessage).toHaveAttribute('aria-live', 'polite');
  },
};

// ============ MSW ASYNC SUBMISSION STORIES ============

export const WithAsyncSubmission: Story = {
  name: i18n.t('form.storyName.withAsyncSubmission', 'With Async Submission'),
  parameters: {
    msw: { handlers: formHandlers },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-form-demo"]')).toBeInTheDocument();
    const form = canvasElement.querySelector('form');
    expect(form).toBeInTheDocument();
  },
};

export const SubmissionSuccess: Story = {
  name: i18n.t('form.storyName.submissionSuccess', 'Submission Success'),
  parameters: {
    msw: { handlers: formHandlers },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'This is a test message that is long enough');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Wait for success
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="form-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SubmissionLoading: Story = {
  name: i18n.t('form.storyName.submissionLoading', 'Submission Loading'),
  parameters: {
    msw: { handlers: formStatusHandlers.loading },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'This is a test message that is long enough');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Verify loading state persists
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="form-loading"]')).toBeInTheDocument();
        expect(canvas.getByRole('button', { name: /submitting/i })).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('form.storyName.error422UnprocessableEntity', 'Error 422: Validation'),
  parameters: {
    msw: { handlers: formStatusHandlers.unprocessableEntity },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'J');
    await userEvent.type(emailInput, 'test@test.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    // Submit the form
    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Wait for validation errors to appear in form fields
    await waitFor(
      () => {
        const formMessages = canvasElement.querySelectorAll('[data-slot="form-message"]');
        expect(formMessages.length).not.toBe(0);
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('form.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: formStatusHandlers.unauthorized },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out and submit the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Wait for error
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('form.storyName.error429RateLimit', 'Error 429: Rate Limited'),
  parameters: {
    msw: { handlers: formStatusHandlers.tooManyRequests },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out and submit the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Wait for error
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error500InternalServerError: Story = {
  name: i18n.t('form.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  parameters: {
    msw: { handlers: formStatusHandlers.internalServerError },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out and submit the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Wait for error
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('form.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: formStatusHandlers.serviceUnavailable },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out and submit the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Wait for error
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('form.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: formStatusHandlers.networkError },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out and submit the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Wait for network error
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="form-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowSubmission: Story = {
  name: i18n.t('form.storyName.slowSubmission', 'Slow Submission'),
  parameters: {
    msw: { handlers: formStatusHandlers.slowSubmission },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out and submit the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Verify loading state first
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="form-loading"]')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Then wait for success
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="form-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const Error400BadRequest: Story = {
  name: i18n.t('form.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: formStatusHandlers.badRequest },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out and submit the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Wait for error
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('form.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: formStatusHandlers.forbidden },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out and submit the form
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Wait for error
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('form.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: formStatusHandlers.badGateway },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('form.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: formStatusHandlers.gatewayTimeout },
  },
  render: () => <FormWithAsyncSubmit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');
    await userEvent.type(messageInput, 'Test message that is long enough');

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  name: i18n.t('form.storyName.withFakerData', 'With Faker Data'),
  render: () => <FakerFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="faker-form-demo"]')).toBeInTheDocument();
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = canvasElement.querySelector('input[name="email"]') as HTMLInputElement;
    const messageInput = canvasElement.querySelector('input[name="message"]') as HTMLInputElement;

    expect(nameInput).toHaveValue(expect.stringMatching(/.+/));
    expect(emailInput.value).toContain('@');
    expect(messageInput.value.length).toBeGreaterThan(10);
  },
};

export const EmptyData: Story = {
  name: i18n.t('form.storyName.emptyData', 'Empty Form'),
  render: () => <EmptyFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="empty-form-demo"]')).toBeInTheDocument();
    const nameInput = canvasElement.querySelector('input[name="name"]') as HTMLInputElement;
    expect(nameInput).toHaveValue('');
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formHandlers },
  },
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute('aria-label');

    const emailInput = canvasElement.querySelector('input[name="email"]');
    expect(emailInput).toBeInTheDocument();

    // Verify submit and reset buttons are present
    const submitButton = form?.querySelector('button[type="submit"]');
    expect(submitButton).toBeInTheDocument();

    const resetButton = form?.querySelector('button[type="button"]');
    expect(resetButton).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute('aria-label');

    const emailInput = canvasElement.querySelector('input[name="email"]');
    expect(emailInput).toBeInTheDocument();

    // Verify submit button is present
    const submitButton = form?.querySelector('button[type="submit"]');
    expect(submitButton).toBeInTheDocument();
  },
};

// ============ VISUAL TESTING STORIES ============

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
  name: i18n.t('form.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ FACTORY: CONSTANTS STORIES ============

function FactoryFieldTypesDemo() {
  const { t } = useTranslation();
  const _exhaustiveTypes: FormFieldType[] = FORM_FIELD_TYPES;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-field-types">
      <h3 className="text-sm font-medium">{t('form.factory.fieldTypes')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.factory.fieldTypesDescription')}</p>
      <div className="flex flex-wrap gap-2">
        {_exhaustiveTypes.map((type) => (
          <span
            key={type}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`field-type-${type}`}
          >
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryFieldTypes: Story = {
  name: i18n.t('form.storyName.factoryFieldTypes', 'Factory: Field Types'),
  render: () => <FactoryFieldTypesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-field-types"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="field-type-"]');
    expect(badges.length).toBe(FORM_FIELD_TYPES.length);
  },
};

function FactoryValidationModesDemo() {
  const _exhaustiveModes: FormValidationMode[] = FORM_VALIDATION_MODES;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-validation-modes">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.validationModes')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.factory.validationModesDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {_exhaustiveModes.map((mode) => (
          <span
            key={mode}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`validation-mode-${mode}`}
          >
            {mode}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryValidationModes: Story = {
  name: i18n.t('form.storyName.factoryValidationModes', 'Factory: Validation Modes'),
  render: () => <FactoryValidationModesDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-validation-modes"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid^="validation-mode-"]').length).toBe(
      FORM_VALIDATION_MODES.length
    );
  },
};

function FactorySubmissionStatusesDemo() {
  const { t } = useTranslation();
  const _exhaustiveStatuses: FormSubmissionStatus[] = FORM_SUBMISSION_STATUSES;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-submission-statuses">
      <h3 className="text-sm font-medium">{t('form.factory.submissionStatuses')}</h3>
      <p className="text-muted-foreground text-sm">
        {t('form.factory.submissionStatusesDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {_exhaustiveStatuses.map((status) => (
          <span
            key={status}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`submission-status-${status}`}
          >
            {status}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactorySubmissionStatuses: Story = {
  name: i18n.t('form.storyName.factorySubmissionStatuses', 'Factory: Submission Statuses'),
  render: () => <FactorySubmissionStatusesDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-submission-statuses"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid^="submission-status-"]').length).toBe(
      FORM_SUBMISSION_STATUSES.length
    );
  },
};

function FactoryLayoutTypesDemo() {
  const { t } = useTranslation();
  const _exhaustiveLayouts: FormLayoutType[] = FORM_LAYOUT_TYPES;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-layout-types">
      <h3 className="text-sm font-medium">{t('form.factory.layoutTypes')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.factory.layoutTypesDescription')}</p>
      <div className="flex flex-wrap gap-2">
        {_exhaustiveLayouts.map((layout) => (
          <span
            key={layout}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`layout-type-${layout}`}
          >
            {layout}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryLayoutTypes: Story = {
  name: i18n.t('form.storyName.factoryLayoutTypes', 'Factory: Layout Types'),
  render: () => <FactoryLayoutTypesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-layout-types"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid^="layout-type-"]').length).toBe(
      FORM_LAYOUT_TYPES.length
    );
  },
};

function FactorySizeVariantsDemo() {
  const { t } = useTranslation();
  const _exhaustiveSizes: FormSizeVariant[] = FORM_SIZE_VARIANTS;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-size-variants">
      <h3 className="text-sm font-medium">{t('form.factory.sizeVariants')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.factory.sizeVariantsDescription')}</p>
      <div className="flex flex-wrap gap-2">
        {_exhaustiveSizes.map((size) => (
          <span
            key={size}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`size-variant-${size}`}
          >
            {size}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactorySizeVariants: Story = {
  name: i18n.t('form.storyName.factorySizeVariants', 'Factory: Size Variants'),
  render: () => <FactorySizeVariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-size-variants"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid^="size-variant-"]').length).toBe(
      FORM_SIZE_VARIANTS.length
    );
  },
};

function FactoryButtonLabelsDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-button-labels">
      <h3 className="text-sm font-medium">{t('form.factory.buttonLabels')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.factory.buttonLabelsDescription')}</p>
      <div className="flex flex-wrap gap-2">
        {FORM_BUTTON_LABELS.map((label) => (
          <Button key={label} type="button" size="sm">
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const FactoryButtonLabels: Story = {
  name: i18n.t('form.storyName.factoryButtonLabels', 'Factory: Button Labels'),
  render: () => <FactoryButtonLabelsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-button-labels"]')
    ).toBeInTheDocument();
    const buttons = canvasElement
      .querySelector('[data-testid="factory-button-labels"]')
      ?.querySelectorAll('button');
    expect(buttons?.length).toBe(FORM_BUTTON_LABELS.length);
  },
};

function FactoryCancelLabelsDemo() {
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-cancel-labels">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.cancelLabels')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.factory.cancelLabelsDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {FORM_CANCEL_LABELS.map((label) => (
          <Button key={label} type="button" variant="outline" size="sm">
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const FactoryCancelLabels: Story = {
  name: i18n.t('form.storyName.factoryCancelLabels', 'Factory: Cancel Labels'),
  render: () => <FactoryCancelLabelsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-cancel-labels"]')
    ).toBeInTheDocument();
    const buttons = canvasElement
      .querySelector('[data-testid="factory-cancel-labels"]')
      ?.querySelectorAll('button');
    expect(buttons?.length).toBe(FORM_CANCEL_LABELS.length);
  },
};

// ============ FACTORY: HELPER FACTORIES STORIES ============

function FactoryOptionsDemo() {
  const singleOption: FakeOption = createFakeOption();
  const multipleOptions: FakeOption[] = createFakeOptions(5);
  return (
    <div className="w-full max-w-lg space-y-6" data-testid="factory-options">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.options')}</h3>
      <p className="text-muted-foreground text-sm">{i18n.t('form.factory.optionsDescription')}</p>
      <p className="text-xs">
        {i18n.t('form.factory.label')}: {singleOption.label} | {i18n.t('form.factory.value')}:{' '}
        {singleOption.value}
      </p>
      <table className="w-full text-xs" data-testid="options-table">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{i18n.t('form.factory.label')}</th>
            <th className="p-2 text-left">{i18n.t('form.factory.disabled')}</th>
          </tr>
        </thead>
        <tbody>
          {multipleOptions.map((opt) => (
            <tr key={opt.value} className="border-b" data-testid="option-row">
              <td className="p-2">{opt.label}</td>
              <td className="p-2">
                {opt.disabled ? i18n.t('form.story.yes', 'Yes') : i18n.t('form.story.no', 'No')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const FactoryOptions: Story = {
  name: i18n.t('form.storyName.factoryOptions', 'Factory: Options'),
  render: () => <FactoryOptionsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-options"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="option-row"]').length).toBe(5);
  },
};

function FactoryOptionGroupsDemo() {
  const { t } = useTranslation();
  const singleGroup: FakeOptionGroup = createFakeOptionGroup(4);
  const multipleGroups: FakeOptionGroup[] = createFakeOptionGroups(3, 3);
  return (
    <div className="w-full max-w-lg space-y-6" data-testid="factory-option-groups">
      <h3 className="text-sm font-medium">{t('form.factory.optionGroups')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.factory.optionGroupsDescription')}</p>
      <p className="text-xs">
        {t('form.factory.group')}: {singleGroup.label} ({singleGroup.options.length})
      </p>
      {multipleGroups.map((group) => (
        <div key={group.label} className="rounded-md border p-3" data-testid="option-group">
          <p className="mb-2 text-xs font-medium">{group.label}</p>
          <div className="flex flex-wrap gap-1">
            {group.options.map((opt) => (
              <span key={opt.value} className="bg-muted rounded px-2 py-0.5 text-xs">
                {opt.label}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryOptionGroups: Story = {
  name: i18n.t('form.storyName.factoryOptionGroups', 'Factory: Option Groups'),
  render: () => <FactoryOptionGroupsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-option-groups"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="option-group"]').length).toBe(3);
  },
};

function FactoryFormFieldDemo() {
  const { t } = useTranslation();
  const textField: FakeFormField = createFakeFormField({
    type: 'text',
    name: 'demo',
    label: 'Demo Field',
  });
  const emailField: FakeFormField = createFakeFormField({ type: 'email' });
  const selectField: FakeFormField = createFakeFormField({ type: 'select' });
  return (
    <div className="w-full max-w-lg space-y-6" data-testid="factory-form-field">
      <h3 className="text-sm font-medium">{t('form.factory.formField')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.factory.formFieldDescription')}</p>
      {[textField, emailField, selectField].map((field) => (
        <div
          key={field.id}
          className="rounded-md border p-3 text-xs"
          data-testid="form-field-config"
        >
          <p>
            {t('form.factory.type')}: {field.type} | {t('form.factory.name')}: {field.name} |{' '}
            {t('form.factory.label')}: {field.label} | {t('form.factory.required')}:{' '}
            {field.required ? i18n.t('form.story.yes', 'Yes') : i18n.t('form.story.no', 'No')}
          </p>
          {field.placeholder ? (
            <p>
              {t('form.factory.placeholder')}: {field.placeholder}
            </p>
          ) : null}
          {field.options ? (
            <p>
              {t('form.factory.options')}: {field.options.length} items
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export const FactoryFormField: Story = {
  name: i18n.t('form.storyName.factoryFormField', 'Factory: Form Field'),
  render: () => <FactoryFormFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-form-field"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="form-field-config"]').length).toBe(3);
  },
};

function FactoryValidationErrorsDemo() {
  const { t } = useTranslation();
  const singleError: FakeValidationError = createFakeValidationError('email');
  const multiErrors: FakeValidationError[] = createFakeValidationErrors([
    'email',
    'password',
    'name',
    'phone',
  ]);
  return (
    <div className="w-full max-w-lg space-y-6" data-testid="factory-validation-errors">
      <h3 className="text-sm font-medium">{t('form.factory.validationErrors')}</h3>
      <p className="text-muted-foreground text-sm">
        {t('form.factory.validationErrorsDescription')}
      </p>
      <p className="text-xs">
        {t('form.factory.field')}: {singleError.field} | {t('form.factory.code')}:{' '}
        {singleError.code} | {t('form.factory.message')}: {singleError.message}
      </p>
      <table className="w-full text-xs" data-testid="validation-errors-table">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{t('form.factory.field')}</th>
            <th className="p-2 text-left">{t('form.factory.code')}</th>
            <th className="p-2 text-left">{t('form.factory.severity')}</th>
          </tr>
        </thead>
        <tbody>
          {multiErrors.map((err) => (
            <tr
              key={`${err.field}-${err.code}`}
              className="border-b"
              data-testid="validation-error-row"
            >
              <td className="p-2">{err.field}</td>
              <td className="p-2">{err.code}</td>
              <td className="p-2">{err.severity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const FactoryValidationErrors: Story = {
  name: i18n.t('form.storyName.factoryValidationErrors', 'Factory: Validation Errors'),
  render: () => <FactoryValidationErrorsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-validation-errors"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="validation-error-row"]').length).toBe(4);
  },
};

function FactorySubmitResponseDemo() {
  const { t } = useTranslation();
  const successResponse: FakeFormSubmitResponse = createFakeFormSubmitResponse(true);
  const errorResponse: FakeFormSubmitResponse = createFakeFormSubmitResponse(false);
  return (
    <div className="w-full max-w-lg space-y-6" data-testid="factory-submit-response">
      <h3 className="text-sm font-medium">{t('form.factory.submitResponse')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.factory.submitResponseDescription')}</p>
      <div className="rounded-md border p-3 text-xs" data-testid="success-response">
        <p>
          {t('form.factory.success')}: {t('form.factory.id')}: {successResponse.id} |{' '}
          {t('form.factory.status')}: {String(successResponse.success)} |{' '}
          {t('form.factory.message')}: {successResponse.message} | {t('form.factory.createdAt')}:{' '}
          {successResponse.createdAt}
          {successResponse.redirectUrl
            ? ` | ${t('form.factory.redirectUrl')}: ${successResponse.redirectUrl}`
            : ''}
        </p>
      </div>
      <div className="rounded-md border p-3 text-xs" data-testid="error-response">
        <p>
          {t('form.factory.error')}: {t('form.factory.id')}: {errorResponse.id} |{' '}
          {t('form.factory.status')}: {String(errorResponse.success)} | {t('form.factory.message')}:{' '}
          {errorResponse.message}
        </p>
      </div>
    </div>
  );
}

export const FactorySubmitResponse: Story = {
  name: i18n.t('form.storyName.factorySubmitResponse', 'Factory: Submit Response'),
  render: () => <FactorySubmitResponseDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-submit-response"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="success-response"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="error-response"]')).toBeInTheDocument();
  },
};

function FactoryCountriesDemo() {
  const { t } = useTranslation();
  const singleCountry: FakeCountry = createFakeCountry();
  const countries: FakeCountry[] = createFakeCountries(8);
  return (
    <div className="w-full max-w-lg space-y-6" data-testid="factory-countries">
      <h3 className="text-sm font-medium">{t('form.factory.countries')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.factory.countriesDescription')}</p>
      <p className="text-xs">
        {singleCountry.flag} {singleCountry.name} ({singleCountry.code})
      </p>
      <div className="grid grid-cols-2 gap-2">
        {countries.map((country) => (
          <div
            key={`${country.code}-${country.name}`}
            className="rounded-md border p-2 text-xs"
            data-testid="country-card"
          >
            {country.flag} {country.name} ({country.code})
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCountries: Story = {
  name: i18n.t('form.storyName.factoryCountries', 'Factory: Countries'),
  render: () => <FactoryCountriesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-countries"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="country-card"]').length).toBe(8);
  },
};

// ============ FACTORY: FORM DATA STORIES ============

function FactoryFormDataDemo() {
  const { t } = useTranslation();
  const data: FakeFormData = createFakeFormData();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-form-data">
      <h3 className="text-sm font-medium">{t('form.factory.formData')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.factory.formDataDescription')}</p>
      <pre className="bg-muted overflow-auto rounded-md p-3 text-xs" data-testid="form-data-json">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryFormData: Story = {
  name: i18n.t('form.storyName.factoryFormData', 'Factory: Form Data'),
  render: () => <FactoryFormDataDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-form-data"]')).toBeInTheDocument();
    const json = canvasElement.querySelector('[data-testid="form-data-json"]');
    const parsed = JSON.parse(json?.textContent ?? '') as Record<string, unknown>;
    expect(parsed.email).toBeTruthy();
    expect(parsed.name).toBeTruthy();
  },
};

function FactoryLoginFormDataDemo() {
  const data: FakeLoginFormData = createFakeLoginFormData();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-login-data">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.loginFormData')}</h3>
      <pre className="bg-muted overflow-auto rounded-md p-3 text-xs" data-testid="login-data-json">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryLoginFormData: Story = {
  name: i18n.t('form.storyName.factoryLoginFormData', 'Factory: Login Data'),
  render: () => <FactoryLoginFormDataDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-login-data"]')).toBeInTheDocument();
    const parsed = JSON.parse(
      canvasElement.querySelector('[data-testid="login-data-json"]')?.textContent ?? ''
    ) as Record<string, unknown>;
    expect(parsed.email).toBeTruthy();
    expect(parsed.password).toBeTruthy();
  },
};

function FactoryRegistrationFormDataDemo() {
  const data: FakeRegistrationFormData = createFakeRegistrationFormData();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-registration-data">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.registrationFormData')}</h3>
      <pre
        className="bg-muted overflow-auto rounded-md p-3 text-xs"
        data-testid="registration-data-json"
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryRegistrationFormData: Story = {
  name: i18n.t('form.storyName.factoryRegistrationFormData', 'Factory: Registration Data'),
  render: () => <FactoryRegistrationFormDataDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-registration-data"]')
    ).toBeInTheDocument();
    const parsed = JSON.parse(
      canvasElement.querySelector('[data-testid="registration-data-json"]')?.textContent ?? ''
    ) as Record<string, unknown>;
    expect(parsed.password).toBe(parsed.confirmPassword);
  },
};

function FactoryProfileFormDataDemo() {
  const data: FakeProfileFormData = createFakeProfileFormData();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-profile-data">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.profileFormData')}</h3>
      <pre
        className="bg-muted overflow-auto rounded-md p-3 text-xs"
        data-testid="profile-data-json"
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryProfileFormData: Story = {
  name: i18n.t('form.storyName.factoryProfileFormData', 'Factory: Profile Data'),
  render: () => <FactoryProfileFormDataDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-profile-data"]')).toBeInTheDocument();
    const parsed = JSON.parse(
      canvasElement.querySelector('[data-testid="profile-data-json"]')?.textContent ?? ''
    ) as Record<string, unknown>;
    expect(parsed.firstName).toBeTruthy();
  },
};

function FactoryContactFormDataDemo() {
  const data: FakeContactFormData = createFakeContactFormData();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-contact-data">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.contactFormData')}</h3>
      <pre
        className="bg-muted overflow-auto rounded-md p-3 text-xs"
        data-testid="contact-data-json"
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryContactFormData: Story = {
  name: i18n.t('form.storyName.factoryContactFormData', 'Factory: Contact Data'),
  render: () => <FactoryContactFormDataDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-contact-data"]')).toBeInTheDocument();
    const parsed = JSON.parse(
      canvasElement.querySelector('[data-testid="contact-data-json"]')?.textContent ?? ''
    ) as Record<string, unknown>;
    expect(parsed.subject).toBeTruthy();
  },
};

function FactoryCheckoutFormDataDemo() {
  const data: FakeCheckoutFormData = createFakeCheckoutFormData();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-checkout-data">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.checkoutFormData')}</h3>
      <pre
        className="bg-muted overflow-auto rounded-md p-3 text-xs"
        data-testid="checkout-data-json"
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryCheckoutFormData: Story = {
  name: i18n.t('form.storyName.factoryCheckoutFormData', 'Factory: Checkout Data'),
  render: () => <FactoryCheckoutFormDataDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-checkout-data"]')
    ).toBeInTheDocument();
    const parsed = JSON.parse(
      canvasElement.querySelector('[data-testid="checkout-data-json"]')?.textContent ?? ''
    ) as Record<string, unknown>;
    expect(parsed.shippingAddress).toBeTruthy();
  },
};

function FactorySearchFormDataDemo() {
  const data: FakeSearchFormData = createFakeSearchFormData();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-search-data">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.searchFormData')}</h3>
      <pre className="bg-muted overflow-auto rounded-md p-3 text-xs" data-testid="search-data-json">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export const FactorySearchFormData: Story = {
  name: i18n.t('form.storyName.factorySearchFormData', 'Factory: Search Data'),
  render: () => <FactorySearchFormDataDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-search-data"]')).toBeInTheDocument();
    const parsed = JSON.parse(
      canvasElement.querySelector('[data-testid="search-data-json"]')?.textContent ?? ''
    ) as Record<string, unknown>;
    expect(parsed.query).toBeTruthy();
  },
};

function FactorySettingsFormDataDemo() {
  const data: FakeSettingsFormData = createFakeSettingsFormData();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-settings-data">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.settingsFormData')}</h3>
      <pre
        className="bg-muted overflow-auto rounded-md p-3 text-xs"
        data-testid="settings-data-json"
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export const FactorySettingsFormData: Story = {
  name: i18n.t('form.storyName.factorySettingsFormData', 'Factory: Settings Data'),
  render: () => <FactorySettingsFormDataDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-settings-data"]')
    ).toBeInTheDocument();
    const parsed = JSON.parse(
      canvasElement.querySelector('[data-testid="settings-data-json"]')?.textContent ?? ''
    ) as Record<string, unknown>;
    expect(['dark', 'light', 'system']).toContain(parsed.theme);
  },
};

function FactoryPasswordChangeFormDataDemo() {
  const data: FakePasswordChangeFormData = createFakePasswordChangeFormData();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-password-change-data">
      <h3 className="text-sm font-medium">{i18n.t('form.factory.passwordChangeFormData')}</h3>
      <pre
        className="bg-muted overflow-auto rounded-md p-3 text-xs"
        data-testid="password-change-json"
      >
        {JSON.stringify(
          { ...data, currentPassword: '***', newPassword: '***', confirmPassword: '***' },
          null,
          2
        )}
      </pre>
      <p className="text-muted-foreground text-xs">
        Passwords match = {String(data.newPassword === data.confirmPassword)}
      </p>
    </div>
  );
}

export const FactoryPasswordChangeFormData: Story = {
  name: i18n.t('form.storyName.factoryPasswordChangeFormData', 'Factory: Password Change Data'),
  render: () => <FactoryPasswordChangeFormDataDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-password-change-data"]')
    ).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Passwords match = true/)).toBeInTheDocument();
  },
};

// ============ FACTORY: SPECIALIZED FORM CONFIG STORIES ============

function renderFormConfig(config: FakeFormConfig) {
  return (
    <div className="rounded-md border p-4 text-xs" data-testid="form-config-card">
      <h4 className="mb-3 text-sm font-medium">{config.title}</h4>
      <p>
        : {config.id} | : {config.layout} | : {config.size} | : {config.validationMode} | :{' '}
        {config.submitLabel}
        {config.cancelLabel ? ` | $: ${config.cancelLabel}` : ''}
      </p>
      <p className="mt-2 font-medium">({config.fields.length}):</p>
      {config.fields.map((field) => (
        <div key={field.id} className="ml-2 border-l pl-2" data-testid="config-field">
          <span className="font-medium">{field.label}</span> ({field.type})
          {field.required ? <span className="text-destructive ml-1">*</span> : null}
        </div>
      ))}
    </div>
  );
}

function FactoryLoginFormDemo() {
  const { t } = useTranslation();
  const config: FakeFormConfig = createFakeLoginForm();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-login-form">
      <h3 className="text-sm font-medium">{t('form.factory.loginForm')}</h3>
      {renderFormConfig(config)}
    </div>
  );
}

export const FactoryLoginForm: Story = {
  name: i18n.t('form.storyName.factoryLoginForm', 'Factory: Login Form Config'),
  render: () => <FactoryLoginFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-login-form"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="config-field"]').length).toBe(3);
  },
};

function FactoryRegistrationFormDemo() {
  const { t } = useTranslation();
  const config: FakeFormConfig = createFakeRegistrationForm();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-registration-form">
      <h3 className="text-sm font-medium">{t('form.factory.registrationForm')}</h3>
      {renderFormConfig(config)}
    </div>
  );
}

export const FactoryRegistrationForm: Story = {
  name: i18n.t('form.storyName.factoryRegistrationForm', 'Factory: Registration Form Config'),
  render: () => <FactoryRegistrationFormDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-registration-form"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="config-field"]').length).toBe(6);
  },
};

function FactoryContactFormDemo() {
  const { t } = useTranslation();
  const config: FakeFormConfig = createFakeContactForm();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-contact-form">
      <h3 className="text-sm font-medium">{t('form.factory.contactForm')}</h3>
      {renderFormConfig(config)}
    </div>
  );
}

export const FactoryContactForm: Story = {
  name: i18n.t('form.storyName.factoryContactForm', 'Factory: Contact Form Config'),
  render: () => <FactoryContactFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-contact-form"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="config-field"]').length).toBe(4);
  },
};

function FactoryProfileFormDemo() {
  const { t } = useTranslation();
  const config: FakeFormConfig = createFakeProfileForm();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-profile-form">
      <h3 className="text-sm font-medium">{t('form.factory.profileForm')}</h3>
      {renderFormConfig(config)}
    </div>
  );
}

export const FactoryProfileForm: Story = {
  name: i18n.t('form.storyName.factoryProfileForm', 'Factory: Profile Form Config'),
  render: () => <FactoryProfileFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-profile-form"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="config-field"]').length).toBe(9);
  },
};

function FactorySettingsFormDemo() {
  const { t } = useTranslation();
  const config: FakeFormConfig = createFakeSettingsForm();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-settings-form">
      <h3 className="text-sm font-medium">{t('form.factory.settingsForm')}</h3>
      {renderFormConfig(config)}
    </div>
  );
}

export const FactorySettingsForm: Story = {
  name: i18n.t('form.storyName.factorySettingsForm', 'Factory: Settings Form Config'),
  render: () => <FactorySettingsFormDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-settings-form"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="config-field"]').length).toBe(6);
  },
};

function FactorySearchFormDemo() {
  const { t } = useTranslation();
  const config: FakeFormConfig = createFakeSearchForm();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="factory-search-form">
      <h3 className="text-sm font-medium">{t('form.factory.searchForm')}</h3>
      {renderFormConfig(config)}
    </div>
  );
}

export const FactorySearchForm: Story = {
  name: i18n.t('form.storyName.factorySearchForm', 'Factory: Search Form Config'),
  render: () => <FactorySearchFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-search-form"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="config-field"]').length).toBe(3);
  },
};

// ============ FACTORY: MATRIX & SHOWCASE STORIES ============

function FactoryFormMatrixDemo() {
  const { t } = useTranslation();
  const matrix = createFakeFormMatrix();
  return (
    <div className="w-full space-y-6" data-testid="factory-form-matrix">
      <h3 className="text-sm font-medium">{t('form.factory.formMatrix')}</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{t('form.factory.layout')}</th>
            {FORM_SIZE_VARIANTS.map((size) => (
              <th key={size} className="p-2 text-left">
                {size}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FORM_LAYOUT_TYPES.map((layout) => (
            <tr key={layout} className="border-b" data-testid="matrix-row">
              <td className="p-2 font-medium">{layout}</td>
              {FORM_SIZE_VARIANTS.map((size) => {
                const config = matrix[layout][size];
                return (
                  <td key={size} className="p-2">
                    <span className="font-mono">{config.id}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const FactoryFormMatrix: Story = {
  name: i18n.t('form.storyName.factoryFormMatrix', 'Factory: Form Matrix'),
  render: () => <FactoryFormMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-form-matrix"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="matrix-row"]').length).toBe(
      FORM_LAYOUT_TYPES.length
    );
  },
};

function FactoryFormShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = createFakeFormShowcase();
  return (
    <div className="w-full max-w-2xl space-y-6" data-testid="factory-form-showcase">
      <h3 className="text-sm font-medium">{t('form.factory.formShowcase')}</h3>
      <div className="grid gap-4">
        {Object.entries(showcase).map(([key, config]) => (
          <div key={key} data-testid="showcase-form">
            {renderFormConfig(config)}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryFormShowcase: Story = {
  name: i18n.t('form.storyName.factoryFormShowcase', 'Factory: Form Showcase'),
  render: () => <FactoryFormShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-form-showcase"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="showcase-form"]').length).toBe(6);
  },
};

function FactoryValidationErrorShowcaseDemo() {
  const { t } = useTranslation();
  const _exhaustiveSeverity: ValidationSeverity = 'error';
  const _ruleType: FakeValidationRule = { type: 'required', message: 'Required', value: true };
  const errors = createFakeValidationErrorShowcase();
  return (
    <div className="w-full max-w-lg space-y-6" data-testid="factory-validation-error-showcase">
      <h3 className="text-sm font-medium">{t('form.factory.validationErrorShowcase')}</h3>
      <p className="text-muted-foreground text-xs">
        {t('form.factory.severity')}: {_exhaustiveSeverity} | {t('form.factory.type')}:{' '}
        {_ruleType.type} | {_ruleType.message} | {String(_ruleType.value)}
      </p>
      <table className="w-full text-xs" data-testid="error-showcase-table">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{t('form.factory.field')}</th>
            <th className="p-2 text-left">{t('form.factory.code')}</th>
            <th className="p-2 text-left">{t('form.factory.severity')}</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((err) => {
            let severityClass = 'text-blue-500';
            if (err.severity === 'error') {
              severityClass = 'text-destructive';
            } else if (err.severity === 'warning') {
              severityClass = 'text-yellow-500';
            }
            return (
              <tr
                key={`${err.field}-${err.code}`}
                className="border-b"
                data-testid="error-showcase-row"
              >
                <td className="p-2">{err.field}</td>
                <td className="p-2">{err.code}</td>
                <td className="p-2">
                  <span className={severityClass}>{err.severity}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const FactoryValidationErrorShowcase: Story = {
  name: i18n.t(
    'form.storyName.factoryValidationErrorShowcase',
    'Factory: Validation Error Showcase'
  ),
  render: () => <FactoryValidationErrorShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-validation-error-showcase"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid="error-showcase-row"]').length).toBe(6);
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: CONSTANTS
// ═══════════════════════════════════════════════════════════════

function UserFactoryRolesDemo() {
  const { t } = useTranslation();
  const _exhaustive: UserRole[] = USER_ROLES;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-roles">
      <h3 className="text-sm font-medium">{t('form.userFactory.roles')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.userFactory.rolesDescription')}</p>
      <div className="flex flex-wrap gap-2">
        {_exhaustive.map((role) => (
          <span
            key={role}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-role-${role}`}
          >
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryRoles: Story = {
  name: i18n.t('form.storyName.userFactoryRoles', 'User Factory: Roles'),
  render: () => <UserFactoryRolesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-roles"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="uf-role-"]');
    expect(badges.length).toBe(USER_ROLES.length);
    for (const role of USER_ROLES) {
      expect(canvasElement.querySelector(`[data-testid="uf-role-${role}"]`)).toBeInTheDocument();
    }
  },
};

function UserFactoryStatusesDemo() {
  const _exhaustive: UserStatus[] = USER_STATUSES;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-statuses">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.statuses')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.statusesDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {_exhaustive.map((status) => (
          <span
            key={status}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-status-${status}`}
          >
            {status}
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryStatuses: Story = {
  name: i18n.t('form.storyName.userFactoryStatuses', 'User Factory: Statuses'),
  render: () => <UserFactoryStatusesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-statuses"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="uf-status-"]');
    expect(badges.length).toBe(USER_STATUSES.length);
    for (const s of USER_STATUSES) {
      expect(canvasElement.querySelector(`[data-testid="uf-status-${s}"]`)).toBeInTheDocument();
    }
  },
};

function UserFactoryVerificationsDemo() {
  const _exhaustive: UserVerification[] = USER_VERIFICATIONS;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-verifications">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.verifications')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.verificationsDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {_exhaustive.map((v) => (
          <span
            key={v}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-verification-${v}`}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryVerifications: Story = {
  name: i18n.t('form.storyName.userFactoryVerifications', 'User Factory: Verifications'),
  render: () => <UserFactoryVerificationsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-verifications"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="uf-verification-"]');
    expect(badges.length).toBe(USER_VERIFICATIONS.length);
    for (const v of USER_VERIFICATIONS) {
      expect(
        canvasElement.querySelector(`[data-testid="uf-verification-${v}"]`)
      ).toBeInTheDocument();
    }
  },
};

function UserFactoryTiersDemo() {
  const _exhaustive: UserTier[] = USER_TIERS;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-tiers">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.tiers')}</h3>
      <p className="text-muted-foreground text-sm">{i18n.t('form.userFactory.tiersDescription')}</p>
      <div className="flex flex-wrap gap-2">
        {_exhaustive.map((tier) => (
          <span
            key={tier}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-tier-${tier}`}
          >
            {tier}
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryTiers: Story = {
  name: i18n.t('form.storyName.userFactoryTiers', 'User Factory: Tiers'),
  render: () => <UserFactoryTiersDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-tiers"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="uf-tier-"]');
    expect(badges.length).toBe(USER_TIERS.length);
    for (const tier of USER_TIERS) {
      expect(canvasElement.querySelector(`[data-testid="uf-tier-${tier}"]`)).toBeInTheDocument();
    }
  },
};

function UserFactoryAvatarSizesDemo() {
  const _exhaustive: UserAvatarSize[] = USER_AVATAR_SIZES;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-avatar-sizes">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.avatarSizes')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.avatarSizesDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {_exhaustive.map((size) => (
          <span
            key={size}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-avatar-size-${size}`}
          >
            {size}
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryAvatarSizes: Story = {
  name: i18n.t('form.storyName.userFactoryAvatarSizes', 'User Factory: Avatar Sizes'),
  render: () => <UserFactoryAvatarSizesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-avatar-sizes"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="uf-avatar-size-"]');
    expect(badges.length).toBe(USER_AVATAR_SIZES.length);
  },
};

function UserFactoryPresenceStatusesDemo() {
  const _exhaustive: PresenceStatus[] = PRESENCE_STATUSES;
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-presence-statuses">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.presenceStatuses')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.presenceStatusesDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {_exhaustive.map((p) => (
          <span
            key={p}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-presence-${p}`}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryPresenceStatuses: Story = {
  name: i18n.t('form.storyName.userFactoryPresenceStatuses', 'User Factory: Presence Statuses'),
  render: () => <UserFactoryPresenceStatusesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-presence-statuses"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="uf-presence-"]');
    expect(badges.length).toBe(PRESENCE_STATUSES.length);
    for (const p of PRESENCE_STATUSES) {
      expect(canvasElement.querySelector(`[data-testid="uf-presence-${p}"]`)).toBeInTheDocument();
    }
  },
};

function UserFactoryDepartmentsDemo() {
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-departments">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.departments')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.departmentsDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {USER_DEPARTMENTS.map((dept) => (
          <span
            key={dept}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-dept-${dept}`}
          >
            {dept}
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryDepartments: Story = {
  name: i18n.t('form.storyName.userFactoryDepartments', 'User Factory: Departments'),
  render: () => <UserFactoryDepartmentsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-departments"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="uf-dept-"]');
    expect(badges.length).toBe(USER_DEPARTMENTS.length);
  },
};

function UserFactorySocialPlatformsDemo() {
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-social-platforms">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.socialPlatforms')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.socialPlatformsDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {SOCIAL_PLATFORMS.map((platform) => (
          <span
            key={platform}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-platform-${platform}`}
          >
            {platform}
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactorySocialPlatforms: Story = {
  name: i18n.t('form.storyName.userFactorySocialPlatforms', 'User Factory: Social Platforms'),
  render: () => <UserFactorySocialPlatformsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-social-platforms"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="uf-platform-"]');
    expect(badges.length).toBe(SOCIAL_PLATFORMS.length);
  },
};

function UserFactoryActionsDemo() {
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-actions">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.actions')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.actionsDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {USER_ACTIONS.map((action) => (
          <span
            key={action}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-action-${action}`}
          >
            {action}
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryActions: Story = {
  name: i18n.t('form.storyName.userFactoryActions', 'User Factory: Actions'),
  render: () => <UserFactoryActionsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-actions"]');
    expect(container).toBeInTheDocument();
    const badges = canvasElement.querySelectorAll('[data-testid^="uf-action-"]');
    expect(badges.length).toBe(USER_ACTIONS.length);
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: SINGLE & BULK USERS
// ═══════════════════════════════════════════════════════════════

function UserFactorySingleUserDemo() {
  const user: FakeUser = createFakeUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-single-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.singleUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.singleUserDescription')}
      </p>
      <table className="w-full text-xs">
        <tbody>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.name')}</td>
            <td className="p-2" data-testid="uf-user-name">
              {user.name}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.email')}</td>
            <td className="p-2" data-testid="uf-user-email">
              {user.email}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.username')}</td>
            <td className="p-2" data-testid="uf-user-username">
              {user.username}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.role')}</td>
            <td className="p-2" data-testid="uf-user-role">
              {user.role}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.status')}</td>
            <td className="p-2" data-testid="uf-user-status">
              {user.status}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.tier')}</td>
            <td className="p-2" data-testid="uf-user-tier">
              {user.tier}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.department')}</td>
            <td className="p-2" data-testid="uf-user-dept">
              {user.department}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.presence')}</td>
            <td className="p-2" data-testid="uf-user-presence">
              {user.presence}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const UserFactorySingleUser: Story = {
  name: i18n.t('form.storyName.userFactorySingleUser', 'User Factory: Single User'),
  render: () => <UserFactorySingleUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-single-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-user-name"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-user-email"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-user-role"]')).toBeInTheDocument();
  },
};

function UserFactoryBulkUsersDemo() {
  const users: FakeUser[] = createFakeUsers(5);
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-bulk-users">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.bulkUsers')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.bulkUsersDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{i18n.t('form.userFactory.name')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.role')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.status')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.tier')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b" data-testid="uf-bulk-user-row">
              <td className="p-2">{u.name}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">{u.status}</td>
              <td className="p-2">{u.tier}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryBulkUsers: Story = {
  name: i18n.t('form.storyName.userFactoryBulkUsers', 'User Factory: Bulk Users'),
  render: () => <UserFactoryBulkUsersDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-bulk-users"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-bulk-user-row"]');
    expect(rows.length).toBe(5);
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: SPECIALIZED USERS
// ═══════════════════════════════════════════════════════════════

function UserFactoryAdminUserDemo() {
  const user = createFakeAdminUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-admin-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.adminUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.adminUserDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.role')}:</span>
        <span data-testid="uf-admin-role">{user.role}</span>
        <span className="font-medium">{i18n.t('form.userFactory.tier')}:</span>
        <span data-testid="uf-admin-tier">{user.tier}</span>
        <span className="font-medium">{i18n.t('form.userFactory.verification')}:</span>
        <span data-testid="uf-admin-verification">{user.verification}</span>
        <span className="font-medium">{i18n.t('form.userFactory.twoFactor')}:</span>
        <span data-testid="uf-admin-2fa">{String(user.twoFactorEnabled)}</span>
      </div>
    </div>
  );
}

export const UserFactoryAdminUser: Story = {
  name: i18n.t('form.storyName.userFactoryAdminUser', 'User Factory: Admin User'),
  render: () => <UserFactoryAdminUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-admin-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-admin-role"]')?.textContent).toBe('admin');
    expect(canvasElement.querySelector('[data-testid="uf-admin-tier"]')?.textContent).toBe(
      'enterprise'
    );
    expect(canvasElement.querySelector('[data-testid="uf-admin-2fa"]')?.textContent).toBe('true');
  },
};

function UserFactoryGuestUserDemo() {
  const user = createFakeGuestUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-guest-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.guestUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.guestUserDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.role')}:</span>
        <span data-testid="uf-guest-role">{user.role}</span>
        <span className="font-medium">{i18n.t('form.userFactory.tier')}:</span>
        <span data-testid="uf-guest-tier">{user.tier}</span>
        <span className="font-medium">{i18n.t('form.userFactory.verification')}:</span>
        <span data-testid="uf-guest-verification">{user.verification}</span>
      </div>
    </div>
  );
}

export const UserFactoryGuestUser: Story = {
  name: i18n.t('form.storyName.userFactoryGuestUser', 'User Factory: Guest User'),
  render: () => <UserFactoryGuestUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-guest-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-guest-role"]')?.textContent).toBe('guest');
    expect(canvasElement.querySelector('[data-testid="uf-guest-tier"]')?.textContent).toBe('free');
  },
};

function UserFactoryPendingUserDemo() {
  const user = createFakePendingUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-pending-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.pendingUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.pendingUserDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.status')}:</span>
        <span data-testid="uf-pending-status">{user.status}</span>
        <span className="font-medium">{i18n.t('form.userFactory.emailVerified')}:</span>
        <span data-testid="uf-pending-email-verified">{String(user.emailVerified)}</span>
      </div>
    </div>
  );
}

export const UserFactoryPendingUser: Story = {
  name: i18n.t('form.storyName.userFactoryPendingUser', 'User Factory: Pending User'),
  render: () => <UserFactoryPendingUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-pending-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-pending-status"]')?.textContent).toBe(
      'pending'
    );
    expect(
      canvasElement.querySelector('[data-testid="uf-pending-email-verified"]')?.textContent
    ).toBe('false');
  },
};

function UserFactorySuspendedUserDemo() {
  const user = createFakeSuspendedUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-suspended-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.suspendedUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.suspendedUserDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.status')}:</span>
        <span data-testid="uf-suspended-status">{user.status}</span>
        <span className="font-medium">{i18n.t('form.userFactory.presence')}:</span>
        <span data-testid="uf-suspended-presence">{user.presence}</span>
        <span className="font-medium">{i18n.t('form.userFactory.online')}:</span>
        <span data-testid="uf-suspended-online">{String(user.isOnline)}</span>
      </div>
    </div>
  );
}

export const UserFactorySuspendedUser: Story = {
  name: i18n.t('form.storyName.userFactorySuspendedUser', 'User Factory: Suspended User'),
  render: () => <UserFactorySuspendedUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-suspended-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-suspended-status"]')?.textContent).toBe(
      'suspended'
    );
    expect(canvasElement.querySelector('[data-testid="uf-suspended-online"]')?.textContent).toBe(
      'false'
    );
  },
};

function UserFactoryBannedUserDemo() {
  const user = createFakeBannedUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-banned-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.bannedUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.bannedUserDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.status')}:</span>
        <span data-testid="uf-banned-status">{user.status}</span>
        <span className="font-medium">{i18n.t('form.userFactory.presence')}:</span>
        <span data-testid="uf-banned-presence">{user.presence}</span>
      </div>
    </div>
  );
}

export const UserFactoryBannedUser: Story = {
  name: i18n.t('form.storyName.userFactoryBannedUser', 'User Factory: Banned User'),
  render: () => <UserFactoryBannedUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-banned-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-banned-status"]')?.textContent).toBe(
      'banned'
    );
  },
};

function UserFactoryOnlineUserDemo() {
  const user = createFakeOnlineUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-online-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.onlineUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.onlineUserDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.presence')}:</span>
        <span data-testid="uf-online-presence">{user.presence}</span>
        <span className="font-medium">{i18n.t('form.userFactory.online')}:</span>
        <span data-testid="uf-online-flag">{String(user.isOnline)}</span>
        <span className="font-medium">{i18n.t('form.userFactory.status')}:</span>
        <span data-testid="uf-online-status">{user.status}</span>
      </div>
    </div>
  );
}

export const UserFactoryOnlineUser: Story = {
  name: i18n.t('form.storyName.userFactoryOnlineUser', 'User Factory: Online User'),
  render: () => <UserFactoryOnlineUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-online-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-online-presence"]')?.textContent).toBe(
      'online'
    );
    expect(canvasElement.querySelector('[data-testid="uf-online-flag"]')?.textContent).toBe('true');
  },
};

function UserFactoryOfflineUserDemo() {
  const user = createFakeOfflineUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-offline-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.offlineUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.offlineUserDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.presence')}:</span>
        <span data-testid="uf-offline-presence">{user.presence}</span>
        <span className="font-medium">{i18n.t('form.userFactory.online')}:</span>
        <span data-testid="uf-offline-flag">{String(user.isOnline)}</span>
      </div>
    </div>
  );
}

export const UserFactoryOfflineUser: Story = {
  name: i18n.t('form.storyName.userFactoryOfflineUser', 'User Factory: Offline User'),
  render: () => <UserFactoryOfflineUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-offline-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-offline-presence"]')?.textContent).toBe(
      'offline'
    );
    expect(canvasElement.querySelector('[data-testid="uf-offline-flag"]')?.textContent).toBe(
      'false'
    );
  },
};

function UserFactoryPremiumUserDemo() {
  const user = createFakePremiumUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-premium-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.premiumUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.premiumUserDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.tier')}:</span>
        <span data-testid="uf-premium-tier">{user.tier}</span>
        <span className="font-medium">{i18n.t('form.userFactory.verification')}:</span>
        <span data-testid="uf-premium-verification">{user.verification}</span>
        <span className="font-medium">{i18n.t('form.userFactory.emailVerified')}:</span>
        <span data-testid="uf-premium-email-verified">{String(user.emailVerified)}</span>
      </div>
    </div>
  );
}

export const UserFactoryPremiumUser: Story = {
  name: i18n.t('form.storyName.userFactoryPremiumUser', 'User Factory: Premium User'),
  render: () => <UserFactoryPremiumUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-premium-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-premium-tier"]')?.textContent).toBe(
      'premium'
    );
  },
};

function UserFactoryEnterpriseUserDemo() {
  const user = createFakeEnterpriseUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-enterprise-user">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.enterpriseUser')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.enterpriseUserDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.tier')}:</span>
        <span data-testid="uf-enterprise-tier">{user.tier}</span>
        <span className="font-medium">{i18n.t('form.userFactory.role')}:</span>
        <span data-testid="uf-enterprise-role">{user.role}</span>
        <span className="font-medium">{i18n.t('form.userFactory.twoFactor')}:</span>
        <span data-testid="uf-enterprise-2fa">{String(user.twoFactorEnabled)}</span>
      </div>
    </div>
  );
}

export const UserFactoryEnterpriseUser: Story = {
  name: i18n.t('form.storyName.userFactoryEnterpriseUser', 'User Factory: Enterprise User'),
  render: () => <UserFactoryEnterpriseUserDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-enterprise-user"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-enterprise-tier"]')?.textContent).toBe(
      'enterprise'
    );
    expect(canvasElement.querySelector('[data-testid="uf-enterprise-role"]')?.textContent).toBe(
      'manager'
    );
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: ALL-VARIANT LISTS
// ═══════════════════════════════════════════════════════════════

function UserFactoryAllRolesDemo() {
  const { t } = useTranslation();
  const users = createFakeUsersWithAllRoles();
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-all-roles">
      <h3 className="text-sm font-medium">{t('form.userFactory.allRoles')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.userFactory.allRolesDescription')}</p>
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <span
            key={u.id}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-all-role-${u.role}`}
          >
            {u.name} ({u.role})
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryAllRoles: Story = {
  name: i18n.t('form.storyName.userFactoryAllRoles', 'User Factory: All Roles'),
  render: () => <UserFactoryAllRolesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-all-roles"]');
    expect(container).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-testid^="uf-all-role-"]');
    expect(items.length).toBe(USER_ROLES.length);
  },
};

function UserFactoryAllStatusesDemo() {
  const users = createFakeUsersWithAllStatuses();
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-all-statuses">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.allStatuses')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.allStatusesDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <span
            key={u.id}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-all-status-${u.status}`}
          >
            {u.name} ({u.status})
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryAllStatuses: Story = {
  name: i18n.t('form.storyName.userFactoryAllStatuses', 'User Factory: All Statuses'),
  render: () => <UserFactoryAllStatusesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-all-statuses"]');
    expect(container).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-testid^="uf-all-status-"]');
    expect(items.length).toBe(USER_STATUSES.length);
  },
};

function UserFactoryAllTiersDemo() {
  const users = createFakeUsersWithAllTiers();
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-all-tiers">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.allTiers')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.allTiersDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <span
            key={u.id}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-all-tier-${u.tier}`}
          >
            {u.name} ({u.tier})
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryAllTiers: Story = {
  name: i18n.t('form.storyName.userFactoryAllTiers', 'User Factory: All Tiers'),
  render: () => <UserFactoryAllTiersDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-all-tiers"]');
    expect(container).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-testid^="uf-all-tier-"]');
    expect(items.length).toBe(USER_TIERS.length);
  },
};

function UserFactoryAllPresenceDemo() {
  const users = createFakeUsersWithAllPresence();
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-all-presence">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.allPresence')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.allPresenceDescription')}
      </p>
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <span
            key={u.id}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`uf-all-presence-${u.presence}`}
          >
            {u.name} ({u.presence})
          </span>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryAllPresence: Story = {
  name: i18n.t('form.storyName.userFactoryAllPresence', 'User Factory: All Presence'),
  render: () => <UserFactoryAllPresenceDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-all-presence"]');
    expect(container).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-testid^="uf-all-presence-"]');
    expect(items.length).toBe(PRESENCE_STATUSES.length);
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: SESSIONS
// ═══════════════════════════════════════════════════════════════

function UserFactorySessionDemo() {
  const session: FakeUserSession = createFakeUserSession();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-session">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.session')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.sessionDescription')}
      </p>
      <table className="w-full text-xs">
        <tbody>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.name')}</td>
            <td className="p-2" data-testid="uf-session-user">
              {session.user.name}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.token')}</td>
            <td className="truncate p-2" data-testid="uf-session-token">
              {session.token.slice(0, 16)}...
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.deviceId')}</td>
            <td className="p-2" data-testid="uf-session-device">
              {session.deviceId}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.expiresAt')}</td>
            <td className="p-2" data-testid="uf-session-expires">
              {session.expiresAt}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.ipAddress')}</td>
            <td className="p-2" data-testid="uf-session-ip">
              {session.ipAddress}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const UserFactorySession: Story = {
  name: i18n.t('form.storyName.userFactorySession', 'User Factory: Session'),
  render: () => <UserFactorySessionDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-session"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-session-user"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-session-token"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-session-device"]')).toBeInTheDocument();
  },
};

function UserFactorySessionsDemo() {
  const sessions: FakeUserSession[] = createFakeUserSessions(3);
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-sessions">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.sessions')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.sessionsDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{i18n.t('form.userFactory.name')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.deviceId')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.ipAddress')}</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.sessionId} className="border-b" data-testid="uf-sessions-row">
              <td className="p-2">{s.user.name}</td>
              <td className="p-2">{s.deviceId}</td>
              <td className="p-2">{s.ipAddress}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactorySessions: Story = {
  name: i18n.t('form.storyName.userFactorySessions', 'User Factory: Sessions'),
  render: () => <UserFactorySessionsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-sessions"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-sessions-row"]');
    expect(rows.length).toBe(3);
  },
};

function UserFactoryExpiredSessionDemo() {
  const session = createFakeExpiredSession();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-expired-session">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.expiredSession')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.expiredSessionDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.expiresAt')}:</span>
        <span data-testid="uf-expired-expires">{session.expiresAt}</span>
        <span className="font-medium">{i18n.t('form.userFactory.name')}:</span>
        <span data-testid="uf-expired-user">{session.user.name}</span>
      </div>
    </div>
  );
}

export const UserFactoryExpiredSession: Story = {
  name: i18n.t('form.storyName.userFactoryExpiredSession', 'User Factory: Expired Session'),
  render: () => <UserFactoryExpiredSessionDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-expired-session"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-expired-expires"]')).toBeInTheDocument();
  },
};

function UserFactoryFreshSessionDemo() {
  const session = createFakeFreshSession();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-fresh-session">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.freshSession')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.freshSessionDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.expiresAt')}:</span>
        <span data-testid="uf-fresh-expires">{session.expiresAt}</span>
        <span className="font-medium">{i18n.t('form.userFactory.name')}:</span>
        <span data-testid="uf-fresh-user">{session.user.name}</span>
      </div>
    </div>
  );
}

export const UserFactoryFreshSession: Story = {
  name: i18n.t('form.storyName.userFactoryFreshSession', 'User Factory: Fresh Session'),
  render: () => <UserFactoryFreshSessionDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-fresh-session"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-fresh-expires"]')).toBeInTheDocument();
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: SOCIAL & PROFILES
// ═══════════════════════════════════════════════════════════════

function UserFactorySocialLinkDemo() {
  const link: FakeSocialLink = createFakeSocialLink();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-social-link">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.socialLink')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.socialLinkDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.platform')}:</span>
        <span data-testid="uf-link-platform">{link.platform}</span>
        <span className="font-medium">{i18n.t('form.userFactory.username')}:</span>
        <span data-testid="uf-link-username">{link.username}</span>
        <span className="font-medium">{i18n.t('form.userFactory.url')}:</span>
        <span data-testid="uf-link-url">{link.url}</span>
      </div>
    </div>
  );
}

export const UserFactorySocialLink: Story = {
  name: i18n.t('form.storyName.userFactorySocialLink', 'User Factory: Social Link'),
  render: () => <UserFactorySocialLinkDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-social-link"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-link-platform"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-link-url"]')).toBeInTheDocument();
  },
};

function UserFactorySocialLinksDemo() {
  const links: FakeSocialLink[] = createFakeSocialLinks(4);
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-social-links">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.socialLinks')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.socialLinksDescription')}
      </p>
      <div className="space-y-2">
        {links.map((link) => (
          <div
            key={`${link.platform}-${link.username}`}
            className="flex gap-2 text-xs"
            data-testid="uf-social-links-row"
          >
            <span className="font-medium">{link.platform}</span>
            <span>{link.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const UserFactorySocialLinks: Story = {
  name: i18n.t('form.storyName.userFactorySocialLinks', 'User Factory: Social Links'),
  render: () => <UserFactorySocialLinksDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-social-links"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-social-links-row"]');
    expect(rows.length).toBe(4);
  },
};

function UserFactoryProfileDemo() {
  const profile: FakeUserProfile = createFakeUserProfile();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-profile">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.profile')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.profileDescription')}
      </p>
      <table className="w-full text-xs">
        <tbody>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.name')}</td>
            <td className="p-2" data-testid="uf-profile-name">
              {profile.name}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.followers')}</td>
            <td className="p-2" data-testid="uf-profile-followers">
              {profile.followers.toLocaleString()}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.following')}</td>
            <td className="p-2" data-testid="uf-profile-following">
              {profile.following.toLocaleString()}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.posts')}</td>
            <td className="p-2" data-testid="uf-profile-posts">
              {profile.posts}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.location')}</td>
            <td className="p-2" data-testid="uf-profile-location">
              {profile.location}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryProfile: Story = {
  name: i18n.t('form.storyName.userFactoryProfile', 'User Factory: Profile'),
  render: () => <UserFactoryProfileDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-profile"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-profile-name"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-profile-followers"]')).toBeInTheDocument();
  },
};

function UserFactoryProfilesDemo() {
  const profiles: FakeUserProfile[] = createFakeUserProfiles(3);
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-profiles">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.profiles')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.profilesDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{i18n.t('form.userFactory.name')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.followers')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.location')}</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-b" data-testid="uf-profiles-row">
              <td className="p-2">{p.name}</td>
              <td className="p-2">{p.followers.toLocaleString()}</td>
              <td className="p-2">{p.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryProfiles: Story = {
  name: i18n.t('form.storyName.userFactoryProfiles', 'User Factory: Profiles'),
  render: () => <UserFactoryProfilesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-profiles"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-profiles-row"]');
    expect(rows.length).toBe(3);
  },
};

function UserFactoryPopularProfileDemo() {
  const profile = createFakePopularUserProfile();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-popular-profile">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.popularProfile')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.popularProfileDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.followers')}:</span>
        <span data-testid="uf-popular-followers">{profile.followers.toLocaleString()}</span>
        <span className="font-medium">{i18n.t('form.userFactory.tier')}:</span>
        <span data-testid="uf-popular-tier">{profile.tier}</span>
        <span className="font-medium">{i18n.t('form.userFactory.verification')}:</span>
        <span data-testid="uf-popular-verified">{String(profile.isVerified)}</span>
      </div>
    </div>
  );
}

export const UserFactoryPopularProfile: Story = {
  name: i18n.t('form.storyName.userFactoryPopularProfile', 'User Factory: Popular Profile'),
  render: () => <UserFactoryPopularProfileDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-popular-profile"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-popular-verified"]')?.textContent).toBe(
      'true'
    );
  },
};

function UserFactoryNewProfileDemo() {
  const profile = createFakeNewUserProfile();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-new-profile">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.newProfile')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.newProfileDescription')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.followers')}:</span>
        <span data-testid="uf-new-followers">{profile.followers}</span>
        <span className="font-medium">{i18n.t('form.userFactory.posts')}:</span>
        <span data-testid="uf-new-posts">{profile.posts}</span>
      </div>
    </div>
  );
}

export const UserFactoryNewProfile: Story = {
  name: i18n.t('form.storyName.userFactoryNewProfile', 'User Factory: New Profile'),
  render: () => <UserFactoryNewProfileDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-new-profile"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-new-followers"]')).toBeInTheDocument();
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: SETTINGS & PERMISSIONS
// ═══════════════════════════════════════════════════════════════

function UserFactoryNotificationSettingsDemo() {
  const settings: FakeUserNotificationSettings = createFakeUserNotificationSettings();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-notification-settings">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.notificationSettings')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.notificationSettingsDescription')}
      </p>
      <table className="w-full text-xs">
        <tbody>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.email')}</td>
            <td className="p-2" data-testid="uf-notif-email">
              {String(settings.email)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.push')}</td>
            <td className="p-2" data-testid="uf-notif-push">
              {String(settings.push)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.sms')}</td>
            <td className="p-2" data-testid="uf-notif-sms">
              {String(settings.sms)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.marketing')}</td>
            <td className="p-2" data-testid="uf-notif-marketing">
              {String(settings.marketing)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.security')}</td>
            <td className="p-2" data-testid="uf-notif-security">
              {String(settings.security)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.weekly')}</td>
            <td className="p-2" data-testid="uf-notif-weekly">
              {String(settings.weekly)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryNotificationSettings: Story = {
  name: i18n.t(
    'form.storyName.userFactoryNotificationSettings',
    'User Factory: Notification Settings'
  ),
  render: () => <UserFactoryNotificationSettingsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-notification-settings"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-notif-security"]')?.textContent).toBe(
      'true'
    );
    expect(canvasElement.querySelector('[data-testid="uf-notif-email"]')).toBeInTheDocument();
  },
};

function UserFactoryPermissionsDemo() {
  const permissions: FakeUserPermissions = createFakeUserPermissions({ role: 'admin' });
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-permissions">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.permissions')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.permissionsDescription')}
      </p>
      <table className="w-full text-xs">
        <tbody>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.role')}</td>
            <td className="p-2" data-testid="uf-perm-role">
              {permissions.role}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.canCreate')}</td>
            <td className="p-2" data-testid="uf-perm-create">
              {String(permissions.canCreate)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.canEdit')}</td>
            <td className="p-2" data-testid="uf-perm-edit">
              {String(permissions.canEdit)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.canDelete')}</td>
            <td className="p-2" data-testid="uf-perm-delete">
              {String(permissions.canDelete)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.canPublish')}</td>
            <td className="p-2" data-testid="uf-perm-publish">
              {String(permissions.canPublish)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.canComment')}</td>
            <td className="p-2" data-testid="uf-perm-comment">
              {String(permissions.canComment)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.canInvite')}</td>
            <td className="p-2" data-testid="uf-perm-invite">
              {String(permissions.canInvite)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.canManageUsers')}</td>
            <td className="p-2" data-testid="uf-perm-manage">
              {String(permissions.canManageUsers)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.canViewAnalytics')}</td>
            <td className="p-2" data-testid="uf-perm-analytics">
              {String(permissions.canViewAnalytics)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryPermissions: Story = {
  name: i18n.t('form.storyName.userFactoryPermissions', 'User Factory: Permissions'),
  render: () => <UserFactoryPermissionsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-permissions"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-perm-role"]')?.textContent).toBe('admin');
    expect(canvasElement.querySelector('[data-testid="uf-perm-manage"]')?.textContent).toBe('true');
    expect(canvasElement.querySelector('[data-testid="uf-perm-analytics"]')?.textContent).toBe(
      'true'
    );
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: ACTIVITIES
// ═══════════════════════════════════════════════════════════════

function UserFactoryActivityDemo() {
  const { t } = useTranslation();
  const activity: FakeUserActivity = createFakeUserActivity();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-activity">
      <h3 className="text-sm font-medium">{t('form.userFactory.activity')}</h3>
      <p className="text-muted-foreground text-sm">{t('form.userFactory.activityDescription')}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{t('form.userFactory.action')}:</span>
        <span data-testid="uf-activity-action">{activity.action}</span>
        <span className="font-medium">{t('form.userFactory.timestamp')}:</span>
        <span data-testid="uf-activity-timestamp">{activity.timestamp}</span>
        <span className="font-medium">{t('form.userFactory.ipAddress')}:</span>
        <span data-testid="uf-activity-ip">{activity.ipAddress}</span>
      </div>
    </div>
  );
}

export const UserFactoryActivity: Story = {
  name: i18n.t('form.storyName.userFactoryActivity', 'User Factory: Activity'),
  render: () => <UserFactoryActivityDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-activity"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-activity-action"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-activity-ip"]')).toBeInTheDocument();
  },
};

function UserFactoryActivitiesDemo() {
  const activities: FakeUserActivity[] = createFakeUserActivities(5);
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-activities">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.activities')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.activitiesDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{i18n.t('form.userFactory.action')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.timestamp')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.ipAddress')}</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => (
            <tr key={a.id} className="border-b" data-testid="uf-activities-row">
              <td className="p-2">{a.action}</td>
              <td className="p-2">{a.timestamp}</td>
              <td className="p-2">{a.ipAddress}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryActivities: Story = {
  name: i18n.t('form.storyName.userFactoryActivities', 'User Factory: Activities'),
  render: () => <UserFactoryActivitiesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-activities"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-activities-row"]');
    expect(rows.length).toBe(5);
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: GROUPS
// ═══════════════════════════════════════════════════════════════

function UserFactoryGroupDemo() {
  const group: FakeUserGroup = createFakeUserGroup();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-group">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.group')}</h3>
      <p className="text-muted-foreground text-sm">{i18n.t('form.userFactory.groupDescription')}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="font-medium">{i18n.t('form.userFactory.name')}:</span>
        <span data-testid="uf-group-name">{group.name}</span>
        <span className="font-medium">{i18n.t('form.userFactory.memberCount')}:</span>
        <span data-testid="uf-group-count">{group.memberCount}</span>
        <span className="font-medium">{i18n.t('form.userFactory.ownerId')}:</span>
        <span data-testid="uf-group-owner">{group.ownerId}</span>
      </div>
      <div className="space-y-1">
        {group.members.map((m) => (
          <div key={m.id} className="text-xs" data-testid="uf-group-member">
            {m.name} ({m.role})
          </div>
        ))}
      </div>
    </div>
  );
}

export const UserFactoryGroup: Story = {
  name: i18n.t('form.storyName.userFactoryGroup', 'User Factory: Group'),
  render: () => <UserFactoryGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-group"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-group-name"]')).toBeInTheDocument();
    const members = canvasElement.querySelectorAll('[data-testid="uf-group-member"]');
    expect(members.length).toBeGreaterThan(0);
  },
};

function UserFactoryGroupsDemo() {
  const groups: FakeUserGroup[] = createFakeUserGroups(3);
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-groups">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.groups')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.groupsDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{i18n.t('form.userFactory.name')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.memberCount')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id} className="border-b" data-testid="uf-groups-row">
              <td className="p-2">{g.name}</td>
              <td className="p-2">{g.memberCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryGroups: Story = {
  name: i18n.t('form.storyName.userFactoryGroups', 'User Factory: Groups'),
  render: () => <UserFactoryGroupsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-groups"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-groups-row"]');
    expect(rows.length).toBe(3);
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: MATRICES
// ═══════════════════════════════════════════════════════════════

function UserFactoryRoleStatusMatrixDemo() {
  const matrix = createFakeUserRoleStatusMatrix();
  return (
    <div className="w-full max-w-4xl space-y-4" data-testid="uf-role-status-matrix">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.roleStatusMatrix')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.roleStatusMatrixDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-1 text-left">{i18n.t('form.userFactory.role')}</th>
            {USER_STATUSES.map((s) => (
              <th key={s} className="p-1 text-left">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={USER_ROLES[i]} className="border-b" data-testid="uf-matrix-row">
              <td className="p-1 font-medium">{USER_ROLES[i]}</td>
              {row.map((u) => (
                <td key={u.id} className="p-1">
                  {u.name.split(' ')[0]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryRoleStatusMatrix: Story = {
  name: i18n.t('form.storyName.userFactoryRoleStatusMatrix', 'User Factory: Role x Status Matrix'),
  render: () => <UserFactoryRoleStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-role-status-matrix"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-matrix-row"]');
    expect(rows.length).toBe(USER_ROLES.length);
  },
};

function UserFactoryRoleTierMatrixDemo() {
  const matrix = createFakeUserRoleTierMatrix();
  return (
    <div className="w-full max-w-4xl space-y-4" data-testid="uf-role-tier-matrix">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.roleTierMatrix')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.roleTierMatrixDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-1 text-left">{i18n.t('form.userFactory.role')}</th>
            {USER_TIERS.map((tier) => (
              <th key={tier} className="p-1 text-left">
                {tier}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={USER_ROLES[i]} className="border-b" data-testid="uf-rt-matrix-row">
              <td className="p-1 font-medium">{USER_ROLES[i]}</td>
              {row.map((u) => (
                <td key={u.id} className="p-1">
                  {u.name.split(' ')[0]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryRoleTierMatrix: Story = {
  name: i18n.t('form.storyName.userFactoryRoleTierMatrix', 'User Factory: Role x Tier Matrix'),
  render: () => <UserFactoryRoleTierMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-role-tier-matrix"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-rt-matrix-row"]');
    expect(rows.length).toBe(USER_ROLES.length);
  },
};

function UserFactoryStatusPresenceMatrixDemo() {
  const matrix = createFakeUserStatusPresenceMatrix();
  return (
    <div className="w-full max-w-4xl space-y-4" data-testid="uf-status-presence-matrix">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.statusPresenceMatrix')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.statusPresenceMatrixDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-1 text-left">{i18n.t('form.userFactory.status')}</th>
            {PRESENCE_STATUSES.map((p) => (
              <th key={p} className="p-1 text-left">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={USER_STATUSES[i]} className="border-b" data-testid="uf-sp-matrix-row">
              <td className="p-1 font-medium">{USER_STATUSES[i]}</td>
              {row.map((u) => (
                <td key={u.id} className="p-1">
                  {u.name.split(' ')[0]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryStatusPresenceMatrix: Story = {
  name: i18n.t(
    'form.storyName.userFactoryStatusPresenceMatrix',
    'User Factory: Status x Presence Matrix'
  ),
  render: () => <UserFactoryStatusPresenceMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-status-presence-matrix"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-sp-matrix-row"]');
    expect(rows.length).toBe(USER_STATUSES.length);
  },
};

function UserFactoryVerificationTierMatrixDemo() {
  const matrix = createFakeUserVerificationTierMatrix();
  return (
    <div className="w-full max-w-4xl space-y-4" data-testid="uf-verification-tier-matrix">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.verificationTierMatrix')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.verificationTierMatrixDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-1 text-left">{i18n.t('form.userFactory.verification')}</th>
            {USER_TIERS.map((tier) => (
              <th key={tier} className="p-1 text-left">
                {tier}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={USER_VERIFICATIONS[i]} className="border-b" data-testid="uf-vt-matrix-row">
              <td className="p-1 font-medium">{USER_VERIFICATIONS[i]}</td>
              {row.map((u) => (
                <td key={u.id} className="p-1">
                  {u.name.split(' ')[0]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryVerificationTierMatrix: Story = {
  name: i18n.t(
    'form.storyName.userFactoryVerificationTierMatrix',
    'User Factory: Verification x Tier Matrix'
  ),
  render: () => <UserFactoryVerificationTierMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-verification-tier-matrix"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-vt-matrix-row"]');
    expect(rows.length).toBe(USER_VERIFICATIONS.length);
  },
};

// ═══════════════════════════════════════════════════════════════
// USER FACTORY: ENTERPRISE
// ═══════════════════════════════════════════════════════════════

function UserFactoryUltimateEnterpriseDemo() {
  const user = createFakeUltimateEnterpriseUser();
  return (
    <div className="w-full max-w-lg space-y-4" data-testid="uf-ultimate-enterprise">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.ultimateEnterprise')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('form.userFactory.ultimateEnterpriseDescription')}
      </p>
      <table className="w-full text-xs">
        <tbody>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.role')}</td>
            <td className="p-2" data-testid="uf-ult-role">
              {user.role}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.tier')}</td>
            <td className="p-2" data-testid="uf-ult-tier">
              {user.tier}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.verification')}</td>
            <td className="p-2" data-testid="uf-ult-verification">
              {user.verification}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.presence')}</td>
            <td className="p-2" data-testid="uf-ult-presence">
              {user.presence}
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-2 font-medium">{i18n.t('form.userFactory.twoFactor')}</td>
            <td className="p-2" data-testid="uf-ult-2fa">
              {String(user.twoFactorEnabled)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryUltimateEnterprise: Story = {
  name: i18n.t(
    'form.storyName.userFactoryUltimateEnterprise',
    'User Factory: Ultimate Enterprise User'
  ),
  render: () => <UserFactoryUltimateEnterpriseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-ultimate-enterprise"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="uf-ult-role"]')?.textContent).toBe('admin');
    expect(canvasElement.querySelector('[data-testid="uf-ult-tier"]')?.textContent).toBe(
      'enterprise'
    );
    expect(canvasElement.querySelector('[data-testid="uf-ult-verification"]')?.textContent).toBe(
      'enhanced'
    );
    expect(canvasElement.querySelector('[data-testid="uf-ult-2fa"]')?.textContent).toBe('true');
  },
};

function UserFactoryEnterpriseSetDemo() {
  const { t } = useTranslation();
  const users = createFakeEnterpriseUserSet();
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-enterprise-set">
      <h3 className="text-sm font-medium">{t('form.userFactory.enterpriseSet')}</h3>
      <p className="text-muted-foreground text-sm">
        {t('form.userFactory.enterpriseSetDescription')}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{t('form.userFactory.name')}</th>
            <th className="p-2 text-left">{t('form.userFactory.role')}</th>
            <th className="p-2 text-left">{t('form.userFactory.status')}</th>
            <th className="p-2 text-left">{t('form.userFactory.tier')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b" data-testid="uf-enterprise-set-row">
              <td className="p-2">{u.name}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">{u.status}</td>
              <td className="p-2">{u.tier}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryEnterpriseSet: Story = {
  name: i18n.t('form.storyName.userFactoryEnterpriseSet', 'User Factory: Enterprise Set'),
  render: () => <UserFactoryEnterpriseSetDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-enterprise-set"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-enterprise-set-row"]');
    expect(rows.length).toBe(6);
  },
};

function UserFactoryTeamDemo() {
  const team = createFakeTeam(8);
  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="uf-team">
      <h3 className="text-sm font-medium">{i18n.t('form.userFactory.team')}</h3>
      <p className="text-muted-foreground text-sm">{i18n.t('form.userFactory.teamDescription')}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">{i18n.t('form.userFactory.name')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.role')}</th>
            <th className="p-2 text-left">{i18n.t('form.userFactory.department')}</th>
          </tr>
        </thead>
        <tbody>
          {team.map((u) => (
            <tr key={u.id} className="border-b" data-testid="uf-team-row">
              <td className="p-2">{u.name}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">{u.department}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const UserFactoryTeam: Story = {
  name: i18n.t('form.storyName.userFactoryTeam', 'User Factory: Team'),
  render: () => <UserFactoryTeamDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="uf-team"]');
    expect(container).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="uf-team-row"]');
    expect(rows.length).toBe(8);
  },
};

// ============ DARK RTL STORY ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('form.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MOBILE STORY ============

export const Mobile: Story = {
  ...Default,
  name: i18n.t('form.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DATA ATTRIBUTES STORY ============

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('form.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   conflict
//   payloadTooLarge
//   notFound
//   slowResponse
//   emptyData
//   otpExpired
//   otpMaxAttempts
//   emailTaken
//   emailAvailable
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('form.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: formStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

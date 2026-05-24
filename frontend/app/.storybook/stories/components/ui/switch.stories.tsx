import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import type {
  FakeFeatureToggle,
  FakeSwitch,
  FakeSwitchFormField,
  FakeSwitchPreference,
  FakeSwitchSettingsGroup,
  FakeSwitchWithLabel,
  LabelPosition,
  SwitchCategory,
  SwitchSize,
  SwitchState,
} from '@/.storybook/stories/_factories/switch.factory';
import {
  CATEGORY_SETTINGS,
  COMMON_SWITCH_LABELS,
  createFakeAllSettingsGroups,
  createFakeAppearanceSwitch,
  createFakeCategorySwitch,
  createFakeCheckedSwitch,
  createFakeDisabledCheckedSwitch,
  createFakeDisabledUncheckedSwitch,
  createFakeFeatureToggle,
  createFakeFeatureToggles,
  createFakeNotificationSwitch,
  createFakePrivacySwitch,
  createFakeSecuritySwitch,
  createFakeSwitch,
  createFakeSwitches,
  createFakeSwitchesWithLabels,
  createFakeSwitchFormField,
  createFakeSwitchPreference,
  createFakeSwitchSettingsGroup,
  createFakeSwitchWithLabel,
  createFakeUncheckedSwitch,
  createSwitchCategoryMatrix,
  createSwitchLabelPositionMatrix,
  createSwitchShowcase,
  createSwitchSizeMatrix,
  createSwitchStateMatrix,
  createSwitchTestData,
  LABEL_POSITIONS,
  SWITCH_CATEGORIES,
  SWITCH_SIZE_CLASSES,
  SWITCH_SIZES,
  SWITCH_STATES,
} from '@/.storybook/stories/_factories/switch.factory';
import {
  switchHandlers,
  switchStatusHandlers,
} from '@/.storybook/stories/_handlers/switch.handlers';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function ControlledSwitchDemo({ label = 'Notifications' }: { label?: string }) {
  const [checked, setChecked] = React.useState(true);

  return (
    <div className="flex items-center gap-2" data-testid="controlled-switch-demo">
      <Switch checked={checked} id="notifications" onCheckedChange={setChecked} />
      <Label htmlFor="notifications">{label}</Label>
    </div>
  );
}

function I18nControlledSwitchDemo() {
  const { t } = useTranslation();

  return (
    <div data-testid="i18n-controlled-switch-demo">
      <ControlledSwitchDemo label={t('switch.notificationsLabel')} />
    </div>
  );
}

function SwitchStatesDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="switch-states-demo">
      <div className="flex items-center gap-2">
        <Switch id="unchecked" />
        <Label htmlFor="unchecked">{t('switch.story.unchecked', 'Unchecked')}</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="checked" defaultChecked />
        <Label htmlFor="checked">{t('switch.story.checked', 'Checked')}</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="disabled-unchecked" disabled />
        <Label htmlFor="disabled-unchecked" className="text-muted-foreground">
          Disabled (unchecked)
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="disabled-checked" disabled defaultChecked />
        <Label htmlFor="disabled-checked" className="text-muted-foreground">
          Disabled (checked)
        </Label>
      </div>
    </div>
  );
}

function SwitchFormDemo() {
  const [settings, setSettings] = React.useState({
    notifications: true,
    marketing: false,
    analytics: true,
  });

  return (
    <form className="space-y-4" data-testid="switch-form-demo">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="form-notifications" className="font-medium">
            Push Notifications
          </Label>
          <p className="text-muted-foreground text-sm">
            {i18n.t(
              'switch.story.receivePushNotificationsOnYourDevice',
              'Receive push notifications on your device'
            )}
          </p>
        </div>
        <Switch
          id="form-notifications"
          checked={settings.notifications}
          onCheckedChange={(checked) =>
            setSettings((prev) => ({ ...prev, notifications: checked }))
          }
        />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="form-marketing" className="font-medium">
            Marketing Emails
          </Label>
          <p className="text-muted-foreground text-sm">
            Receive emails about new products and features
          </p>
        </div>
        <Switch
          id="form-marketing"
          checked={settings.marketing}
          onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, marketing: checked }))}
        />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="form-analytics" className="font-medium">
            Analytics
          </Label>
          <p className="text-muted-foreground text-sm">
            Help us improve by sharing anonymous usage data
          </p>
        </div>
        <Switch
          id="form-analytics"
          checked={settings.analytics}
          onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, analytics: checked }))}
        />
      </div>
    </form>
  );
}

const meta = {
  title: 'Components/UI/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: {
    disabled: false,
    onCheckedChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: switchHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // State
    checked: {
      control: 'boolean',
      description: i18n.t('switch.argType.controlledCheckedState', 'Controlled checked state'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    defaultChecked: {
      control: 'boolean',
      description: i18n.t(
        'switch.argType.defaultCheckedStateForUncontrolledUsage',
        'Default checked state for uncontrolled usage'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'switch.argType.whetherTheSwitchIsDisabled',
        'Whether the switch is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    required: {
      control: 'boolean',
      description: i18n.t(
        'switch.argType.whetherTheSwitchIsRequiredInAForm',
        'Whether the switch is required in a form'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // HTML
    name: {
      control: 'text',
      description: i18n.t(
        'switch.argType.nameAttributeForFormSubmission',
        'Name attribute for form submission'
      ),
      table: {
        category: 'HTML',
        type: { summary: 'string' },
      },
    },
    value: {
      control: 'text',
      description: i18n.t(
        'switch.argType.valueAttributeForFormSubmission',
        'Value attribute for form submission'
      ),
      table: {
        category: 'HTML',
        defaultValue: { summary: 'on' },
        type: { summary: 'string' },
      },
    },
    id: {
      control: 'text',
      description: i18n.t(
        'switch.argType.idAttributeForLabelAssociation',
        'ID attribute for label association'
      ),
      table: {
        category: 'HTML',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('switch.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Events
    onCheckedChange: {
      action: 'onCheckedChange',
      description: i18n.t(
        'switch.argType.calledWhenCheckedStateChanges',
        'Called when checked state changes'
      ),
      table: {
        category: 'Events',
        type: { summary: '(checked: boolean) => void' },
      },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('switch.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('switch.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('switch.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => <ControlledSwitchDemo />,
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

function VariantsDemo() {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('switch.variants.states')}</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch id="var-off" />
            <Label htmlFor="var-off">{i18n.t('switch.story.off', 'Off')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="var-on" defaultChecked />
            <Label htmlFor="var-on">On</Label>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('switch.variants.disabledStates')}</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch id="var-disabled-off" disabled />
            <Label htmlFor="var-disabled-off" className="text-muted-foreground">
              Disabled Off
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="var-disabled-on" disabled defaultChecked />
            <Label htmlFor="var-disabled-on" className="text-muted-foreground">
              Disabled On
            </Label>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('switch.variants.withDescription')}</p>
        <div className="flex w-[360px] items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="var-desc" className="font-medium">
              Dark Mode
            </Label>
            <p className="text-muted-foreground text-sm">
              {i18n.t('switch.story.enableDarkTheme', 'Enable dark theme')}
            </p>
          </div>
          <Switch id="var-desc" />
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(5);
    expect(canvas.getByText('Off')).toBeInTheDocument();
    expect(canvas.getByText('On')).toBeInTheDocument();
    expect(canvas.getByText('Disabled Off')).toBeInTheDocument();
    expect(canvas.getByText('Disabled On')).toBeInTheDocument();
    expect(canvas.getByText('Dark Mode')).toBeInTheDocument();
  },
};

function SizesDemo() {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('switch.sizes.compact')}</p>
        <div className="flex items-center gap-2 text-sm">
          <Switch id="size-sm" className="h-4 w-7" />
          <Label htmlFor="size-sm" className="text-sm">
            Small switch
          </Label>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('switch.sizes.default')}</p>
        <div className="flex items-center gap-2">
          <Switch id="size-default" />
          <Label htmlFor="size-default">
            {i18n.t('switch.story.defaultSwitch', 'Default switch')}
          </Label>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('switch.sizes.large')}</p>
        <div className="flex items-center gap-3 text-lg">
          <Switch id="size-lg" className="h-7 w-12" />
          <Label htmlFor="size-lg" className="text-lg">
            Large switch
          </Label>
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(3);
    expect(canvas.getByText('Small switch')).toBeInTheDocument();
    expect(canvas.getByText('Default switch')).toBeInTheDocument();
    expect(canvas.getByText('Large switch')).toBeInTheDocument();
  },
};

export const Controlled: Story = {
  render: () => <ControlledSwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switchControl = canvasElement.querySelector('#notifications') as HTMLElement;
    expect(switchControl.getAttribute('data-state')).toBe('checked');
    await userEvent.click(switchControl);
    await waitFor(() => {
      expect(switchControl.getAttribute('data-state')).toBe('unchecked');
    });
    expect(canvas.getByText('Notifications')).toBeInTheDocument();
  },
};

export const Uncontrolled: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="uncontrolled" defaultChecked />
      <Label htmlFor="uncontrolled">
        {i18n.t('switch.story.defaultChecked', 'Default checked')}
      </Label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switchControl = canvasElement.querySelector('#uncontrolled') as HTMLElement;
    expect(switchControl.getAttribute('data-state')).toBe('checked');
    expect(canvas.getByText('Default checked')).toBeInTheDocument();
  },
};

export const AllStates: Story = {
  render: () => <SwitchStatesDemo />,
  play: async ({ canvasElement }) => {
    // Verify all switches are present
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(4);

    // Verify disabled states
    const disabledSwitches = canvasElement.querySelectorAll('button[role="switch"][disabled]');
    expect(disabledSwitches.length).toBe(2);
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch defaultChecked disabled id="disabled-switch" />
      <Label htmlFor="disabled-switch" className="text-muted-foreground">
        Disabled
      </Label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('#disabled-switch');
    expect(switchControl).toBeDisabled();
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch id="label-right" />
        <Label htmlFor="label-right">
          {i18n.t('switch.story.labelOnTheRight', 'Label on the right')}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="label-left">
          {i18n.t('switch.story.labelOnTheLeft', 'Label on the left')}
        </Label>
        <Switch id="label-left" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Label on the right')).toBeInTheDocument();
    expect(canvas.getByText('Label on the left')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(2);
  },
};

export const WithDescription: Story = {
  render: () => (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label htmlFor="with-desc" className="font-medium">
          Airplane Mode
        </Label>
        <p className="text-muted-foreground text-sm">
          {i18n.t('switch.story.disableAllWirelessConnections', 'Disable all wireless connections')}
        </p>
      </div>
      <Switch id="with-desc" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Airplane Mode')).toBeInTheDocument();
    expect(canvas.getByText('Disable all wireless connections')).toBeInTheDocument();
    const switchControl = canvasElement.querySelector('#with-desc');
    expect(switchControl).toBeInTheDocument();
  },
};

export const FormExample: Story = {
  render: () => <SwitchFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(3);
    expect(canvas.getByText('Push Notifications')).toBeInTheDocument();
    expect(canvas.getByText('Marketing Emails')).toBeInTheDocument();
    expect(canvas.getByText('Analytics')).toBeInTheDocument();

    // Verify initial states (notifications: on, marketing: off, analytics: on)
    const notificationsSwitch = canvasElement.querySelector('#form-notifications') as HTMLElement;
    expect(notificationsSwitch.getAttribute('data-state')).toBe('checked');
    const marketingSwitch = canvasElement.querySelector('#form-marketing') as HTMLElement;
    expect(marketingSwitch.getAttribute('data-state')).toBe('unchecked');

    // Toggle marketing on
    await userEvent.click(marketingSwitch);
    await waitFor(() => {
      expect(marketingSwitch.getAttribute('data-state')).toBe('checked');
    });
  },
};

function KeyboardInteractionDemo() {
  const [checked, setChecked] = React.useState(false);
  return (
    <div className="space-y-4" data-testid="keyboard-interaction-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'switch.story.tabToFocusSpaceOrEnterToToggle',
          'Tab to focus, Space or Enter to toggle'
        )}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch id="keyboard" checked={checked} onCheckedChange={setChecked} />
          <Label htmlFor="keyboard">Switch is {checked ? 'on' : 'off'}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="second" />
          <Label htmlFor="second">{i18n.t('switch.story.secondSwitch', 'Second Switch')}</Label>
        </div>
      </div>
    </div>
  );
}

export const KeyboardInteraction: Story = {
  render: () => <KeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    const firstSwitch = canvasElement.querySelector('#keyboard') as HTMLElement;
    const secondSwitch = canvasElement.querySelector('#second') as HTMLElement;

    // Tab to focus
    await userEvent.tab();
    expect(firstSwitch).toHaveFocus();
    expect(firstSwitch.getAttribute('data-state')).toBe('unchecked');

    // Space toggles
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(firstSwitch.getAttribute('data-state')).toBe('checked');
    });

    // Space toggles back
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(firstSwitch.getAttribute('data-state')).toBe('unchecked');
    });

    // Tab to second switch
    await userEvent.tab();
    expect(secondSwitch).toHaveFocus();

    // Shift+Tab back
    await userEvent.tab({ shift: true });
    expect(firstSwitch).toHaveFocus();
  },
};

export const DisabledKeyboardBehavior: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'switch.story.disabledSwitchesShouldNotReceiveFocus',
          'Disabled switches should not receive focus'
        )}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch id="disabled-kb" disabled />
          <Label htmlFor="disabled-kb" className="text-muted-foreground">
            Disabled
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="enabled-kb" />
          <Label htmlFor="enabled-kb">{i18n.t('switch.story.enabled', 'Enabled')}</Label>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const enabledSwitch = canvasElement.querySelector('#enabled-kb') as HTMLElement;

    // Tab should skip disabled and focus enabled
    await userEvent.tab();
    expect(enabledSwitch).toHaveFocus();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const switchControl = canvasElement.querySelector('#notifications');

    if (!(switchControl instanceof HTMLElement)) {
      throw new Error('Switch control was not found.');
    }

    expect(switchControl.getAttribute('data-slot')).toBe('switch');
    expect(switchControl.getAttribute('data-state')).toBe('checked');

    const thumb = switchControl.querySelector('[data-slot="switch-thumb"]');

    if (!(thumb instanceof HTMLElement)) {
      throw new Error('Switch thumb was not found.');
    }

    expect(thumb.getAttribute('data-state')).toBe('checked');

    await userEvent.click(switchControl);

    await waitFor(() => {
      expect(switchControl.getAttribute('data-state')).toBe('unchecked');
    });

    expect(thumb.getAttribute('data-state')).toBe('unchecked');

    await userEvent.click(switchControl);

    await waitFor(() => {
      expect(switchControl.getAttribute('data-state')).toBe('checked');
    });

    expect(thumb.getAttribute('data-state')).toBe('checked');
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: () => <I18nControlledSwitchDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('通知')).toBeInTheDocument();

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
  name: i18n.t('switch.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

export const Accessibility: Story = {
  name: i18n.t('switch.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch id="a11y-switch" aria-describedby="a11y-switch-desc" />
        <Label htmlFor="a11y-switch">
          {i18n.t('switch.story.enableNotifications', 'Enable notifications')}
        </Label>
      </div>
      <p id="a11y-switch-desc" className="text-muted-foreground text-sm">
        Toggle to enable or disable push notifications.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switchElement = canvasElement.querySelector('#a11y-switch') as HTMLElement;

    // Verify switch has proper role
    expect(switchElement.getAttribute('role')).toBe('switch');

    // Verify label association
    const label = canvas.getByText('Enable notifications');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('a11y-switch');

    // Verify aria-describedby
    expect(switchElement.getAttribute('aria-describedby')).toBe('a11y-switch-desc');

    // Verify initial unchecked state
    expect(switchElement.getAttribute('aria-checked')).toBe('false');
    expect(switchElement.getAttribute('data-state')).toBe('unchecked');

    // Test keyboard navigation - Tab to focus
    await userEvent.tab();
    expect(switchElement).toHaveFocus();

    // Test keyboard interaction - Space to toggle
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(switchElement.getAttribute('aria-checked')).toBe('true');
      expect(switchElement.getAttribute('data-state')).toBe('checked');
    });

    // Toggle back
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(switchElement.getAttribute('aria-checked')).toBe('false');
      expect(switchElement.getAttribute('data-state')).toBe('unchecked');
    });
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchHandlers },
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const switchControl = canvasElement.querySelector('button[role="switch"]');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl?.getAttribute('data-state')).toBe('checked');
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  name: i18n.t('switch.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const fakeSwitches = createFakeSwitches(5);

    return (
      <div className="flex flex-col gap-4" data-testid="switch-faker">
        {fakeSwitches.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <Switch id={s.id} defaultChecked={s.checked} disabled={s.disabled} />
            <Label htmlFor={s.id}>{s.name}</Label>
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="switch-faker"]')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(5);
  },
};

// ============ FACTORY WIRING: BASE FACTORIES ============

function FakeSwitchDemo() {
  const data: FakeSwitch = createFakeSwitch();
  return (
    <div className="space-y-2" data-testid="fake-switch-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.checkedSwitch')}</p>
      <div className="flex items-center gap-2">
        <Switch
          id={data.id}
          defaultChecked={data.checked}
          disabled={data.disabled}
          className={data.className}
          name={data.name}
          required={data.required}
          aria-label={data.ariaLabel ?? undefined}
        />
        <Label htmlFor={data.id}>{data.name}</Label>
      </div>
      <p className="text-muted-foreground text-xs">
        Size: {data.size} | Position: {data.labelPosition} | Value: {data.value}
      </p>
    </div>
  );
}

export const FakeSwitchStory: Story = {
  name: i18n.t('switch.storyName.fakeSwitchStory', 'Factory: createFakeSwitch'),
  render: () => <FakeSwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-switch-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

function FakeSwitchWithLabelDemo() {
  const data: FakeSwitchWithLabel = createFakeSwitchWithLabel();
  return (
    <div className="space-y-2" data-testid="fake-switch-with-label-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.switchWithLabel')}</p>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor={data.id} className="font-medium">
            {data.label}
          </Label>
          {data.description && <p className="text-muted-foreground text-sm">{data.description}</p>}
        </div>
        <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
      </div>
    </div>
  );
}

export const FakeSwitchWithLabelStory: Story = {
  name: i18n.t('switch.storyName.fakeSwitchWithLabelStory', 'Factory: createFakeSwitchWithLabel'),
  render: () => <FakeSwitchWithLabelDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-switch-with-label-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
    const labels = canvasElement.querySelectorAll('label');
    expect(labels.length).toBeGreaterThan(0);
  },
};

function FakeSwitchesWithLabelsDemo() {
  const items: FakeSwitchWithLabel[] = createFakeSwitchesWithLabels(4);
  return (
    <div className="space-y-3" data-testid="fake-switches-with-labels-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.switchesWithLabels')}</p>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-4 rounded-lg border p-3"
        >
          <div className="space-y-0.5">
            <Label htmlFor={item.id} className="font-medium">
              {item.label}
            </Label>
            {item.description && (
              <p className="text-muted-foreground text-sm">{item.description}</p>
            )}
          </div>
          <Switch id={item.id} defaultChecked={item.checked} disabled={item.disabled} />
        </div>
      ))}
    </div>
  );
}

export const FakeSwitchesWithLabelsStory: Story = {
  name: i18n.t(
    'switch.storyName.fakeSwitchesWithLabelsStory',
    'Factory: createFakeSwitchesWithLabels'
  ),
  render: () => <FakeSwitchesWithLabelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-switches-with-labels-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(4);
  },
};

// ============ FACTORY WIRING: STATE-SPECIFIC ============

function FakeCheckedSwitchDemo() {
  const data: FakeSwitch = createFakeCheckedSwitch();
  return (
    <div className="space-y-2" data-testid="fake-checked-switch-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.checkedSwitch')}</p>
      <div className="flex items-center gap-2">
        <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
        <Label htmlFor={data.id}>{data.name}</Label>
      </div>
    </div>
  );
}

export const FakeCheckedSwitchStory: Story = {
  name: i18n.t('switch.storyName.fakeCheckedSwitchStory', 'Factory: createFakeCheckedSwitch'),
  render: () => <FakeCheckedSwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-checked-switch-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
    expect(sw?.getAttribute('data-state')).toBe('checked');
  },
};

function FakeUncheckedSwitchDemo() {
  const data: FakeSwitch = createFakeUncheckedSwitch();
  return (
    <div className="space-y-2" data-testid="fake-unchecked-switch-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.uncheckedSwitch')}</p>
      <div className="flex items-center gap-2">
        <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
        <Label htmlFor={data.id}>{data.name}</Label>
      </div>
    </div>
  );
}

export const FakeUncheckedSwitchStory: Story = {
  name: i18n.t('switch.storyName.fakeUncheckedSwitchStory', 'Factory: createFakeUncheckedSwitch'),
  render: () => <FakeUncheckedSwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-unchecked-switch-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
    expect(sw?.getAttribute('data-state')).toBe('unchecked');
  },
};

function FakeDisabledCheckedSwitchDemo() {
  const data: FakeSwitch = createFakeDisabledCheckedSwitch();
  return (
    <div className="space-y-2" data-testid="fake-disabled-checked-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.disabledCheckedSwitch')}</p>
      <div className="flex items-center gap-2">
        <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
        <Label htmlFor={data.id} className="text-muted-foreground">
          {data.name}
        </Label>
      </div>
    </div>
  );
}

export const FakeDisabledCheckedSwitchStory: Story = {
  name: i18n.t(
    'switch.storyName.fakeDisabledCheckedSwitchStory',
    'Factory: createFakeDisabledCheckedSwitch'
  ),
  render: () => <FakeDisabledCheckedSwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-disabled-checked-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
    expect(sw).toBeDisabled();
    expect(sw?.getAttribute('data-state')).toBe('checked');
  },
};

function FakeDisabledUncheckedSwitchDemo() {
  const data: FakeSwitch = createFakeDisabledUncheckedSwitch();
  return (
    <div className="space-y-2" data-testid="fake-disabled-unchecked-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.disabledUncheckedSwitch')}</p>
      <div className="flex items-center gap-2">
        <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
        <Label htmlFor={data.id} className="text-muted-foreground">
          {data.name}
        </Label>
      </div>
    </div>
  );
}

export const FakeDisabledUncheckedSwitchStory: Story = {
  name: i18n.t(
    'switch.storyName.fakeDisabledUncheckedSwitchStory',
    'Factory: createFakeDisabledUncheckedSwitch'
  ),
  render: () => <FakeDisabledUncheckedSwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-disabled-unchecked-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
    expect(sw).toBeDisabled();
    expect(sw?.getAttribute('data-state')).toBe('unchecked');
  },
};

// ============ FACTORY WIRING: CATEGORY-SPECIFIC ============

function FakeCategorySwitchDemo() {
  const categories: SwitchCategory[] = SWITCH_CATEGORIES;
  const items = categories.map((cat) => ({
    category: cat,
    data: createFakeCategorySwitch(cat),
  }));
  return (
    <div className="space-y-3" data-testid="fake-category-switch-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.categorySwitch')}</p>
      {items.map(({ category, data }) => (
        <div
          key={data.id}
          className="flex items-center justify-between gap-4 rounded-lg border p-3"
        >
          <div className="space-y-0.5">
            <Label htmlFor={data.id} className="font-medium">
              {data.label}
            </Label>
            <p className="text-muted-foreground text-xs capitalize">{category}</p>
            {data.description && (
              <p className="text-muted-foreground text-sm">{data.description}</p>
            )}
          </div>
          <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
        </div>
      ))}
    </div>
  );
}

export const FakeCategorySwitchStory: Story = {
  name: i18n.t('switch.storyName.fakeCategorySwitchStory', 'Factory: createFakeCategorySwitch'),
  render: () => <FakeCategorySwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-category-switch-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(SWITCH_CATEGORIES.length);
  },
};

function FakeNotificationSwitchDemo() {
  const data: FakeSwitchWithLabel = createFakeNotificationSwitch();
  return (
    <div className="space-y-2" data-testid="fake-notification-switch-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.notificationSwitch')}</p>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor={data.id} className="font-medium">
            {data.label}
          </Label>
          {data.description && <p className="text-muted-foreground text-sm">{data.description}</p>}
        </div>
        <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
      </div>
    </div>
  );
}

export const FakeNotificationSwitchStory: Story = {
  name: i18n.t(
    'switch.storyName.fakeNotificationSwitchStory',
    'Factory: createFakeNotificationSwitch'
  ),
  render: () => <FakeNotificationSwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-notification-switch-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

function FakePrivacySwitchDemo() {
  const data: FakeSwitchWithLabel = createFakePrivacySwitch();
  return (
    <div className="space-y-2" data-testid="fake-privacy-switch-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.privacySwitch')}</p>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor={data.id} className="font-medium">
            {data.label}
          </Label>
          {data.description && <p className="text-muted-foreground text-sm">{data.description}</p>}
        </div>
        <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
      </div>
    </div>
  );
}

export const FakePrivacySwitchStory: Story = {
  name: i18n.t('switch.storyName.fakePrivacySwitchStory', 'Factory: createFakePrivacySwitch'),
  render: () => <FakePrivacySwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-privacy-switch-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

function FakeSecuritySwitchDemo() {
  const data: FakeSwitchWithLabel = createFakeSecuritySwitch();
  return (
    <div className="space-y-2" data-testid="fake-security-switch-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.securitySwitch')}</p>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor={data.id} className="font-medium">
            {data.label}
          </Label>
          {data.description && <p className="text-muted-foreground text-sm">{data.description}</p>}
        </div>
        <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
      </div>
    </div>
  );
}

export const FakeSecuritySwitchStory: Story = {
  name: i18n.t('switch.storyName.fakeSecuritySwitchStory', 'Factory: createFakeSecuritySwitch'),
  render: () => <FakeSecuritySwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-security-switch-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

function FakeAppearanceSwitchDemo() {
  const data: FakeSwitchWithLabel = createFakeAppearanceSwitch();
  return (
    <div className="space-y-2" data-testid="fake-appearance-switch-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.appearanceSwitch')}</p>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor={data.id} className="font-medium">
            {data.label}
          </Label>
          {data.description && <p className="text-muted-foreground text-sm">{data.description}</p>}
        </div>
        <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
      </div>
    </div>
  );
}

export const FakeAppearanceSwitchStory: Story = {
  name: i18n.t('switch.storyName.fakeAppearanceSwitchStory', 'Factory: createFakeAppearanceSwitch'),
  render: () => <FakeAppearanceSwitchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-appearance-switch-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING: FORM FIELD ============

function FakeSwitchFormFieldDemo() {
  const data: FakeSwitchFormField = createFakeSwitchFormField();
  return (
    <div className="space-y-2" data-testid="fake-form-field-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.formField')}</p>
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor={data.id} className="font-medium">
              {data.label}
            </Label>
            {data.description && (
              <p className="text-muted-foreground text-sm">{data.description}</p>
            )}
          </div>
          <Switch id={data.id} defaultChecked={data.checked} disabled={data.disabled} />
        </div>
        {data.helpText && <p className="text-muted-foreground mt-2 text-xs">{data.helpText}</p>}
        {data.errorMessage && <p className="mt-1 text-xs text-red-500">{data.errorMessage}</p>}
        <p className="text-muted-foreground mt-1 text-xs">
          {i18n.t('switch.factory.validation')}: {data.validationState}
        </p>
      </div>
    </div>
  );
}

export const FakeSwitchFormFieldStory: Story = {
  name: i18n.t('switch.storyName.fakeSwitchFormFieldStory', 'Factory: createFakeSwitchFormField'),
  render: () => <FakeSwitchFormFieldDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-form-field-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
    const labels = canvasElement.querySelectorAll('label');
    expect(labels.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY WIRING: SETTINGS GROUP ============

function FakeSwitchSettingsGroupDemo() {
  const group: FakeSwitchSettingsGroup = createFakeSwitchSettingsGroup('notifications', 5);
  return (
    <div className="space-y-3" data-testid="fake-settings-group-demo">
      <p className="text-sm font-medium">
        {i18n.t('switch.factory.settingsGroup')}: {group.title}
      </p>
      <div className="rounded-lg border p-4">
        {group.settings.map((setting) => (
          <div
            key={setting.id}
            className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0"
          >
            <div className="space-y-0.5">
              <Label htmlFor={setting.id} className="font-medium">
                {setting.label}
              </Label>
              {setting.description && (
                <p className="text-muted-foreground text-sm">{setting.description}</p>
              )}
            </div>
            <Switch id={setting.id} defaultChecked={setting.checked} disabled={setting.disabled} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const FakeSwitchSettingsGroupStory: Story = {
  name: i18n.t(
    'switch.storyName.fakeSwitchSettingsGroupStory',
    'Factory: createFakeSwitchSettingsGroup'
  ),
  render: () => <FakeSwitchSettingsGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-settings-group-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(5);
  },
};

function FakeAllSettingsGroupsDemo() {
  const groups: FakeSwitchSettingsGroup[] = createFakeAllSettingsGroups(2);
  return (
    <div className="space-y-6" data-testid="fake-all-settings-groups-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.allSettingsGroups')}</p>
      {groups.map((group) => (
        <div key={group.id} className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-semibold capitalize">{group.title}</h3>
          {group.settings.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0"
            >
              <div className="space-y-0.5">
                <Label htmlFor={setting.id} className="text-sm font-medium">
                  {setting.label}
                </Label>
                {setting.description && (
                  <p className="text-muted-foreground text-xs">{setting.description}</p>
                )}
              </div>
              <Switch
                id={setting.id}
                defaultChecked={setting.checked}
                disabled={setting.disabled}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const FakeAllSettingsGroupsStory: Story = {
  name: i18n.t(
    'switch.storyName.fakeAllSettingsGroupsStory',
    'Factory: createFakeAllSettingsGroups'
  ),
  render: () => <FakeAllSettingsGroupsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-all-settings-groups-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    // 7 categories x 2 per category = 14
    expect(switches.length).toBe(14);
  },
};

// ============ FACTORY WIRING: PREFERENCE ============

function FakeSwitchPreferenceDemo() {
  const pref: FakeSwitchPreference = createFakeSwitchPreference();
  return (
    <div className="space-y-2" data-testid="fake-preference-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.preference')}</p>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {pref.icon && <span>{pref.icon}</span>}
            <Label htmlFor={pref.id} className="font-medium">
              {pref.label}
            </Label>
          </div>
          {pref.description && <p className="text-muted-foreground text-sm">{pref.description}</p>}
          <p className="text-muted-foreground text-xs capitalize">
            {i18n.t('switch.factory.priority')}: {pref.priority} | {pref.category}
          </p>
        </div>
        <Switch id={pref.id} defaultChecked={pref.checked} disabled={pref.disabled} />
      </div>
    </div>
  );
}

export const FakeSwitchPreferenceStory: Story = {
  name: i18n.t('switch.storyName.fakeSwitchPreferenceStory', 'Factory: createFakeSwitchPreference'),
  render: () => <FakeSwitchPreferenceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-preference-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING: FEATURE TOGGLE ============

function FakeFeatureToggleDemo() {
  const toggle: FakeFeatureToggle = createFakeFeatureToggle();
  return (
    <div className="space-y-2" data-testid="fake-feature-toggle-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.featureToggle')}</p>
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor={toggle.id} className="font-medium">
              {toggle.featureName}
            </Label>
            <p className="text-muted-foreground text-sm">{toggle.description}</p>
            <div className="flex gap-3 text-xs">
              <span className="text-muted-foreground">Key: {toggle.featureKey}</span>
              {toggle.isExperimental && (
                <span className="text-amber-500">{i18n.t('switch.factory.experimental')}</span>
              )}
              <span className="text-muted-foreground">
                {i18n.t('switch.factory.rollout')}: {toggle.rolloutPercentage}%
              </span>
            </div>
          </div>
          <Switch id={toggle.id} defaultChecked={toggle.checked} disabled={toggle.disabled} />
        </div>
      </div>
    </div>
  );
}

export const FakeFeatureToggleStory: Story = {
  name: i18n.t('switch.storyName.fakeFeatureToggleStory', 'Factory: createFakeFeatureToggle'),
  render: () => <FakeFeatureToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-feature-toggle-demo')).toBeInTheDocument();
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

function FakeFeatureTogglesDemo() {
  const toggles: FakeFeatureToggle[] = createFakeFeatureToggles(4);
  return (
    <div className="space-y-3" data-testid="fake-feature-toggles-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.featureToggles')}</p>
      {toggles.map((toggle) => (
        <div
          key={toggle.id}
          className="flex items-center justify-between gap-4 rounded-lg border p-3"
        >
          <div className="space-y-0.5">
            <Label htmlFor={toggle.id} className="font-medium">
              {toggle.featureName}
            </Label>
            <p className="text-muted-foreground text-sm">{toggle.description}</p>
            <div className="flex gap-2 text-xs">
              {toggle.isExperimental && (
                <span className="text-amber-500">{i18n.t('switch.factory.experimental')}</span>
              )}
              <span className="text-muted-foreground">
                {i18n.t('switch.factory.rollout')}: {toggle.rolloutPercentage}%
              </span>
            </div>
          </div>
          <Switch id={toggle.id} defaultChecked={toggle.checked} disabled={toggle.disabled} />
        </div>
      ))}
    </div>
  );
}

export const FakeFeatureTogglesStory: Story = {
  name: i18n.t('switch.storyName.fakeFeatureTogglesStory', 'Factory: createFakeFeatureToggles'),
  render: () => <FakeFeatureTogglesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-feature-toggles-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(4);
  },
};

// ============ FACTORY WIRING: MATRIX FACTORIES ============

function SwitchSizeMatrixDemo() {
  const matrix = createSwitchSizeMatrix();
  return (
    <div className="space-y-4" data-testid="switch-size-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.sizeMatrix')}</p>
      {matrix.map((entry) => (
        <div key={entry.size} className="flex items-center gap-4">
          <span className="w-20 text-sm capitalize">{entry.size}</span>
          <Switch
            id={entry.switch.id}
            defaultChecked={entry.switch.checked}
            className={entry.className}
          />
          <span className="text-muted-foreground text-xs">{entry.className || '(default)'}</span>
        </div>
      ))}
    </div>
  );
}

export const SwitchSizeMatrixStory: Story = {
  name: i18n.t('switch.storyName.switchSizeMatrixStory', 'Factory: createSwitchSizeMatrix'),
  render: () => <SwitchSizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('switch-size-matrix-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(SWITCH_SIZES.length);
  },
};

function SwitchStateMatrixDemo() {
  const matrix = createSwitchStateMatrix();
  return (
    <div className="space-y-4" data-testid="switch-state-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.stateMatrix')}</p>
      {matrix.map((entry) => (
        <div key={entry.state} className="flex items-center gap-4">
          <span className="w-36 text-sm">{entry.state}</span>
          <Switch
            id={entry.switch.id}
            defaultChecked={entry.switch.checked}
            disabled={entry.switch.disabled}
          />
        </div>
      ))}
    </div>
  );
}

export const SwitchStateMatrixStory: Story = {
  name: i18n.t('switch.storyName.switchStateMatrixStory', 'Factory: createSwitchStateMatrix'),
  render: () => <SwitchStateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('switch-state-matrix-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(SWITCH_STATES.length);
    // Verify disabled states
    const disabledSwitches = canvasElement.querySelectorAll('button[role="switch"][disabled]');
    expect(disabledSwitches.length).toBe(2);
  },
};

function SwitchCategoryMatrixDemo() {
  const matrix = createSwitchCategoryMatrix();
  return (
    <div className="space-y-3" data-testid="switch-category-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.categoryMatrix')}</p>
      {matrix.map((entry) => (
        <div
          key={entry.category}
          className="flex items-center justify-between gap-4 rounded-lg border p-3"
        >
          <div className="space-y-0.5">
            <Label htmlFor={entry.switch.id} className="font-medium">
              {entry.switch.label}
            </Label>
            <p className="text-muted-foreground text-xs capitalize">{entry.category}</p>
            {entry.switch.description && (
              <p className="text-muted-foreground text-sm">{entry.switch.description}</p>
            )}
          </div>
          <Switch
            id={entry.switch.id}
            defaultChecked={entry.switch.checked}
            disabled={entry.switch.disabled}
          />
        </div>
      ))}
    </div>
  );
}

export const SwitchCategoryMatrixStory: Story = {
  name: i18n.t('switch.storyName.switchCategoryMatrixStory', 'Factory: createSwitchCategoryMatrix'),
  render: () => <SwitchCategoryMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('switch-category-matrix-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(SWITCH_CATEGORIES.length);
  },
};

function SwitchLabelPositionMatrixDemo() {
  const matrix = createSwitchLabelPositionMatrix();
  return (
    <div className="space-y-4" data-testid="switch-label-position-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.labelPositionMatrix')}</p>
      {matrix.map((entry) => (
        <div key={entry.position} className="rounded-lg border p-3">
          <p className="text-muted-foreground mb-2 text-xs capitalize">
            Position: {entry.position}
          </p>
          <div className="flex items-center gap-2">
            {entry.position === 'left' && (
              <Label htmlFor={entry.switch.id}>{entry.switch.label}</Label>
            )}
            <Switch
              id={entry.switch.id}
              defaultChecked={entry.switch.checked}
              disabled={entry.switch.disabled}
            />
            {entry.position === 'right' && (
              <Label htmlFor={entry.switch.id}>{entry.switch.label}</Label>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export const SwitchLabelPositionMatrixStory: Story = {
  name: i18n.t(
    'switch.storyName.switchLabelPositionMatrixStory',
    'Factory: createSwitchLabelPositionMatrix'
  ),
  render: () => <SwitchLabelPositionMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('switch-label-position-matrix-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(LABEL_POSITIONS.length);
  },
};

// ============ FACTORY WIRING: SHOWCASE FACTORIES ============

function SwitchTestDataDemo() {
  const testData = createSwitchTestData();
  const entries = Object.entries(testData);
  return (
    <div className="space-y-3" data-testid="switch-test-data-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.testData')}</p>
      {entries.map(([key, data]) => {
        const switchData = data as FakeSwitch;
        const labelData = data as FakeSwitchWithLabel;
        return (
          <div key={key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">{key}</span>
              {'label' in data && labelData.label && (
                <p className="text-muted-foreground text-xs">{labelData.label}</p>
              )}
              {'featureName' in data && (
                <p className="text-muted-foreground text-xs">
                  {(data as FakeFeatureToggle).featureName}
                </p>
              )}
            </div>
            <Switch
              id={switchData.id}
              defaultChecked={switchData.checked}
              disabled={switchData.disabled}
            />
          </div>
        );
      })}
    </div>
  );
}

export const SwitchTestDataStory: Story = {
  name: i18n.t('switch.storyName.switchTestDataStory', 'Factory: createSwitchTestData'),
  render: () => <SwitchTestDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('switch-test-data-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    // 17 entries in createSwitchTestData
    expect(switches.length).toBe(17);
  },
};

function SwitchShowcaseDemo() {
  const showcase = createSwitchShowcase();
  return (
    <div className="space-y-6" data-testid="switch-showcase-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.showcase')}</p>

      <div>
        <h3 className="mb-2 text-sm font-semibold">{i18n.t('switch.factory.sizeMatrix')}</h3>
        <div className="flex items-center gap-6">
          {showcase.sizeMatrix.map((entry) => (
            <div key={entry.size} className="flex items-center gap-2">
              <Switch
                id={entry.switch.id}
                defaultChecked={entry.switch.checked}
                className={entry.className}
              />
              <span className="text-muted-foreground text-xs capitalize">{entry.size}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">{i18n.t('switch.factory.stateMatrix')}</h3>
        <div className="flex items-center gap-6">
          {showcase.stateMatrix.map((entry) => (
            <div key={entry.state} className="flex items-center gap-2">
              <Switch
                id={entry.switch.id}
                defaultChecked={entry.switch.checked}
                disabled={entry.switch.disabled}
              />
              <span className="text-muted-foreground text-xs">{entry.state}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">{i18n.t('switch.factory.featureToggles')}</h3>
        {showcase.featureToggles.slice(0, 3).map((toggle) => (
          <div
            key={toggle.id}
            className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0"
          >
            <div>
              <Label htmlFor={toggle.id} className="text-sm font-medium">
                {toggle.featureName}
              </Label>
              <p className="text-muted-foreground text-xs">{toggle.description}</p>
            </div>
            <Switch id={toggle.id} defaultChecked={toggle.checked} disabled={toggle.disabled} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const SwitchShowcaseStory: Story = {
  name: i18n.t('switch.storyName.switchShowcaseStory', 'Factory: createSwitchShowcase'),
  render: () => <SwitchShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('switch-showcase-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    // 3 size matrix + 4 state matrix + 3 feature toggles = 10
    expect(switches.length).toBe(10);
  },
};

// ============ FACTORY WIRING: CONSTANTS ============

function SwitchSizeClassesDemo() {
  const sizes: SwitchSize[] = SWITCH_SIZES;
  return (
    <div className="space-y-4" data-testid="switch-size-classes-demo">
      <p className="text-sm font-medium">
        {i18n.t('switch.factory.sizeMatrix')} (SWITCH_SIZE_CLASSES)
      </p>
      {sizes.map((size) => (
        <div key={size} className="flex items-center gap-4">
          <span className="w-20 text-sm capitalize">{size}</span>
          <Switch id={`size-class-${size}`} defaultChecked className={SWITCH_SIZE_CLASSES[size]} />
          <code className="text-muted-foreground text-xs">
            {SWITCH_SIZE_CLASSES[size] || '(default classes)'}
          </code>
        </div>
      ))}
    </div>
  );
}

export const SwitchSizeClassesStory: Story = {
  name: i18n.t('switch.storyName.switchSizeClassesStory', 'Constants: SWITCH_SIZE_CLASSES'),
  render: () => <SwitchSizeClassesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('switch-size-classes-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(SWITCH_SIZES.length);
  },
};

function CategorySettingsDemo() {
  const categories: SwitchCategory[] = SWITCH_CATEGORIES;
  return (
    <div className="space-y-4" data-testid="category-settings-demo">
      <p className="text-sm font-medium">
        {i18n.t('switch.factory.categorySwitch')} (CATEGORY_SETTINGS)
      </p>
      {categories.map((category) => (
        <div key={category} className="rounded-lg border p-3">
          <h3 className="mb-2 text-sm font-semibold capitalize">{category}</h3>
          {CATEGORY_SETTINGS[category].slice(0, 2).map((setting) => (
            <div
              key={setting.label}
              className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0"
            >
              <div>
                <p className="text-sm font-medium">{setting.label}</p>
                <p className="text-muted-foreground text-xs">{setting.description}</p>
              </div>
              <Switch id={`cat-${category}-${setting.label}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const CategorySettingsStory: Story = {
  name: i18n.t('switch.storyName.categorySettingsStory', 'Constants: CATEGORY_SETTINGS'),
  render: () => <CategorySettingsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('category-settings-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    // 7 categories x 2 settings each = 14
    expect(switches.length).toBe(14);
  },
};

function CommonSwitchLabelsDemo() {
  return (
    <div className="space-y-3" data-testid="common-switch-labels-demo">
      <p className="text-sm font-medium">
        {i18n.t('switch.factory.switchWithLabel')} (COMMON_SWITCH_LABELS)
      </p>
      {COMMON_SWITCH_LABELS.map((label) => (
        <div key={label} className="flex items-center gap-2">
          <Switch id={`common-${label}`} />
          <Label htmlFor={`common-${label}`}>{label}</Label>
        </div>
      ))}
    </div>
  );
}

export const CommonSwitchLabelsStory: Story = {
  name: i18n.t('switch.storyName.commonSwitchLabelsStory', 'Constants: COMMON_SWITCH_LABELS'),
  render: () => <CommonSwitchLabelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('common-switch-labels-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(COMMON_SWITCH_LABELS.length);
    // Verify some labels are visible
    expect(canvas.getByText('Enable')).toBeInTheDocument();
    expect(canvas.getByText('Active')).toBeInTheDocument();
  },
};

function SwitchStatesConstDemo() {
  const states: SwitchState[] = SWITCH_STATES;
  return (
    <div className="space-y-3" data-testid="switch-states-const-demo">
      <p className="text-sm font-medium">{i18n.t('switch.factory.stateMatrix')} (SWITCH_STATES)</p>
      {states.map((state) => {
        const isChecked = state.includes('checked') && !state.includes('unchecked');
        const isDisabled = state.includes('disabled');
        return (
          <div key={state} className="flex items-center gap-4">
            <span className="w-40 text-sm">{state}</span>
            <Switch id={`state-const-${state}`} defaultChecked={isChecked} disabled={isDisabled} />
          </div>
        );
      })}
    </div>
  );
}

export const SwitchStatesConstStory: Story = {
  name: i18n.t('switch.storyName.switchStatesConstStory', 'Constants: SWITCH_STATES'),
  render: () => <SwitchStatesConstDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('switch-states-const-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(SWITCH_STATES.length);
  },
};

function LabelPositionsDemo() {
  const positions: LabelPosition[] = LABEL_POSITIONS;
  return (
    <div className="space-y-4" data-testid="label-positions-demo">
      <p className="text-sm font-medium">
        {i18n.t('switch.factory.labelPositionMatrix')} (LABEL_POSITIONS)
      </p>
      {positions.map((pos) => (
        <div key={pos} className="flex items-center gap-2">
          {pos === 'left' && <Label htmlFor={`pos-${pos}`}>Label ({pos})</Label>}
          <Switch id={`pos-${pos}`} />
          {pos === 'right' && <Label htmlFor={`pos-${pos}`}>Label ({pos})</Label>}
        </div>
      ))}
    </div>
  );
}

export const LabelPositionsStory: Story = {
  name: i18n.t('switch.storyName.labelPositionsStory', 'Constants: LABEL_POSITIONS'),
  render: () => <LabelPositionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('label-positions-demo')).toBeInTheDocument();
    const switches = canvasElement.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(LABEL_POSITIONS.length);
    expect(canvas.getByText('Label (left)')).toBeInTheDocument();
    expect(canvas.getByText('Label (right)')).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING: MSW STATUS HANDLERS (UNUSED) ============

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

export const Error429TooManyRequests: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

export const SuccessHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: switchStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('button[role="switch"]');
    expect(sw).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('switch.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('switch.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('switch.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('switch.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

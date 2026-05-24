/**
 * Switch Component Factory
 *
 * Generates fake data for Switch component stories and tests.
 * Supports various configurations, form contexts, and setting presets.
 *
 * @module switch.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Switch size options
 */
export type SwitchSize = 'default' | 'large' | 'small';

/**
 * Switch state
 */
export type SwitchState = 'checked' | 'disabled-checked' | 'disabled-unchecked' | 'unchecked';

/**
 * Switch category for settings
 */
export type SwitchCategory =
  | 'accessibility'
  | 'appearance'
  | 'communication'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'sync';

/**
 * Label position relative to switch
 */
export type LabelPosition = 'left' | 'right';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All switch sizes
 */
export const SWITCH_SIZES: SwitchSize[] = ['default', 'large', 'small'];

/**
 * All switch states
 */
export const SWITCH_STATES: SwitchState[] = [
  'checked',
  'disabled-checked',
  'disabled-unchecked',
  'unchecked',
];

/**
 * All switch categories
 */
export const SWITCH_CATEGORIES: SwitchCategory[] = [
  'accessibility',
  'appearance',
  'communication',
  'notifications',
  'privacy',
  'security',
  'sync',
];

/**
 * All label positions
 */
export const LABEL_POSITIONS: LabelPosition[] = ['left', 'right'];

/**
 * Size to class mapping
 */
export const SWITCH_SIZE_CLASSES: Record<SwitchSize, string> = {
  default: '',
  large: 'h-7 w-12',
  small: 'h-4 w-7',
};

/**
 * Category-specific switch settings
 */
export const CATEGORY_SETTINGS: Record<SwitchCategory, { description: string; label: string }[]> = {
  accessibility: [
    {
      label: i18n.t('factory.switch.reduceMotion', 'Reduce Motion'),
      description: i18n.t(
        'factory.switch.minimizeAnimationsAndTransitions',
        'Minimize animations and transitions'
      ),
    },
    {
      label: i18n.t('factory.switch.highContrast', 'High Contrast'),
      description: i18n.t(
        'factory.switch.increaseContrastForBetterVisibility',
        'Increase contrast for better visibility'
      ),
    },
    {
      label: i18n.t('factory.switch.screenReader', 'Screen Reader'),
      description: i18n.t(
        'factory.switch.enableScreenReaderOptimizations',
        'Enable screen reader optimizations'
      ),
    },
    {
      label: i18n.t('factory.switch.largeText', 'Large Text'),
      description: i18n.t(
        'factory.switch.useLargerFontSizesThroughout',
        'Use larger font sizes throughout'
      ),
    },
    {
      label: i18n.t('factory.switch.keyboardNavigation', 'Keyboard Navigation'),
      description: i18n.t(
        'factory.switch.enableFullKeyboardNavigation',
        'Enable full keyboard navigation'
      ),
    },
  ],
  appearance: [
    {
      label: i18n.t('factory.switch.darkMode', 'Dark Mode'),
      description: i18n.t('factory.switch.enableDarkTheme', 'Enable dark theme'),
    },
    {
      label: i18n.t('factory.switch.compactMode', 'Compact Mode'),
      description: i18n.t('factory.switch.useCompactSpacing', 'Use compact spacing'),
    },
    {
      label: i18n.t('factory.switch.showAnimations', 'Show Animations'),
      description: i18n.t('factory.switch.enableUiAnimations', 'Enable UI animations'),
    },
    {
      label: i18n.t('factory.switch.showSidebar', 'Show Sidebar'),
      description: i18n.t('factory.switch.displayNavigationSidebar', 'Display navigation sidebar'),
    },
    {
      label: i18n.t('factory.switch.autoTheme', 'Auto Theme'),
      description: i18n.t('factory.switch.matchSystemAppearance', 'Match system appearance'),
    },
  ],
  communication: [
    {
      label: i18n.t('factory.switch.emailNotifications', 'Email Notifications'),
      description: i18n.t('factory.switch.receiveUpdatesViaEmail', 'Receive updates via email'),
    },
    {
      label: i18n.t('factory.switch.smsAlerts', 'SMS Alerts'),
      description: i18n.t('factory.switch.getTextMessageAlerts', 'Get text message alerts'),
    },
    {
      label: i18n.t('factory.switch.inAppMessages', 'In-App Messages'),
      description: i18n.t(
        'factory.switch.showInAppNotificationMessages',
        'Show in-app notification messages'
      ),
    },
    {
      label: i18n.t('factory.switch.marketingEmails', 'Marketing Emails'),
      description: i18n.t(
        'factory.switch.receivePromotionalContent',
        'Receive promotional content'
      ),
    },
    {
      label: i18n.t('factory.switch.newsletter', 'Newsletter'),
      description: i18n.t(
        'factory.switch.subscribeToWeeklyNewsletter',
        'Subscribe to weekly newsletter'
      ),
    },
  ],
  notifications: [
    {
      label: i18n.t('factory.switch.pushNotifications', 'Push Notifications'),
      description: i18n.t('factory.switch.receivePushNotifications', 'Receive push notifications'),
    },
    {
      label: i18n.t('factory.switch.soundAlerts', 'Sound Alerts'),
      description: i18n.t(
        'factory.switch.playSoundForNotifications',
        'Play sound for notifications'
      ),
    },
    {
      label: i18n.t('factory.switch.desktopNotifications', 'Desktop Notifications'),
      description: i18n.t('factory.switch.showDesktopAlerts', 'Show desktop alerts'),
    },
    {
      label: i18n.t('factory.switch.badgeCount', 'Badge Count'),
      description: i18n.t('factory.switch.showUnreadCountOnIcon', 'Show unread count on icon'),
    },
    {
      label: i18n.t('factory.switch.doNotDisturb', 'Do Not Disturb'),
      description: i18n.t('factory.switch.silenceAllNotifications', 'Silence all notifications'),
    },
  ],
  privacy: [
    {
      label: i18n.t('factory.switch.shareUsageData', 'Share Usage Data'),
      description: i18n.t(
        'factory.switch.helpImproveWithAnonymousData',
        'Help improve with anonymous data'
      ),
    },
    {
      label: i18n.t('factory.switch.personalizedAds', 'Personalized Ads'),
      description: i18n.t(
        'factory.switch.showPersonalizedAdvertisements',
        'Show personalized advertisements'
      ),
    },
    {
      label: i18n.t('factory.switch.locationServices', 'Location Services'),
      description: i18n.t(
        'factory.switch.allowAccessToYourLocation',
        'Allow access to your location'
      ),
    },
    {
      label: i18n.t('factory.switch.searchHistory', 'Search History'),
      description: i18n.t('factory.switch.saveYourSearchHistory', 'Save your search history'),
    },
    {
      label: i18n.t('factory.switch.cookieTracking', 'Cookie Tracking'),
      description: i18n.t('factory.switch.allowThirdPartyCookies', 'Allow third-party cookies'),
    },
  ],
  security: [
    {
      label: i18n.t('factory.switch.twoFactorAuth', 'Two-Factor Auth'),
      description: i18n.t('factory.switch.require2faForLogin', 'Require 2FA for login'),
    },
    {
      label: i18n.t('factory.switch.biometricLogin', 'Biometric Login'),
      description: i18n.t('factory.switch.useFingerprintOrFaceId', 'Use fingerprint or face ID'),
    },
    {
      label: i18n.t('factory.switch.rememberDevice', 'Remember Device'),
      description: i18n.t(
        'factory.switch.trustThisDeviceFor30Days',
        'Trust this device for 30 days'
      ),
    },
    {
      label: i18n.t('factory.switch.loginAlerts', 'Login Alerts'),
      description: i18n.t('factory.switch.notifyOnNewLogin', 'Notify on new login'),
    },
    {
      label: i18n.t('factory.switch.sessionTimeout', 'Session Timeout'),
      description: i18n.t(
        'factory.switch.autoLogoutAfterInactivity',
        'Auto logout after inactivity'
      ),
    },
  ],
  sync: [
    {
      label: i18n.t('factory.switch.autoSync', 'Auto Sync'),
      description: i18n.t('factory.switch.syncDataAutomatically', 'Sync data automatically'),
    },
    {
      label: i18n.t('factory.switch.backgroundSync', 'Background Sync'),
      description: i18n.t('factory.switch.syncWhenAppIsClosed', 'Sync when app is closed'),
    },
    {
      label: i18n.t('factory.switch.wiFiOnly', 'Wi-Fi Only'),
      description: i18n.t('factory.switch.onlySyncOnWiFi', 'Only sync on Wi-Fi'),
    },
    {
      label: i18n.t('factory.switch.syncBookmarks', 'Sync Bookmarks'),
      description: i18n.t(
        'factory.switch.syncBookmarksAcrossDevices',
        'Sync bookmarks across devices'
      ),
    },
    {
      label: i18n.t('factory.switch.syncHistory', 'Sync History'),
      description: i18n.t('factory.switch.syncBrowsingHistory', 'Sync browsing history'),
    },
  ],
};

/**
 * Common switch labels
 */
export const COMMON_SWITCH_LABELS = [
  i18n.t('factory.switch.enable', 'Enable'),
  i18n.t('factory.switch.active', 'Active'),
  i18n.t('factory.switch.on', 'On'),
  i18n.t('factory.switch.enabled', 'Enabled'),
  i18n.t('factory.switch.activated', 'Activated'),
  i18n.t('factory.switch.allow', 'Allow'),
  i18n.t('factory.switch.show', 'Show'),
  i18n.t('factory.switch.display', 'Display'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base switch configuration
 */
export interface FakeSwitch {
  ariaDescribedby?: string;
  ariaLabel?: string;
  checked: boolean;
  className: string;
  defaultChecked?: boolean;
  disabled: boolean;
  id: string;
  labelPosition: LabelPosition;
  name: string;
  required: boolean;
  size: SwitchSize;
  testId: string;
  value: string;
}

/**
 * Switch with label
 */
export interface FakeSwitchWithLabel extends FakeSwitch {
  description?: string;
  label: string;
}

/**
 * Switch in form context
 */
export interface FakeSwitchFormField extends FakeSwitchWithLabel {
  errorMessage?: string;
  helpText?: string;
  validationState: 'error' | 'none' | 'success' | 'warning';
}

/**
 * Settings switch group
 */
export interface FakeSwitchSettingsGroup {
  category: SwitchCategory;
  id: string;
  settings: FakeSwitchWithLabel[];
  title: string;
}

/**
 * Switch preference item
 */
export interface FakeSwitchPreference extends FakeSwitchWithLabel {
  category: SwitchCategory;
  icon?: string;
  priority: 'high' | 'low' | 'medium';
}

/**
 * Feature toggle switch
 */
export interface FakeFeatureToggle extends FakeSwitch {
  description: string;
  featureKey: string;
  featureName: string;
  isExperimental: boolean;
  rolloutPercentage: number;
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

/**
 * Create a basic fake switch
 */
export function createFakeSwitch(overrides?: Partial<FakeSwitch>): FakeSwitch {
  const size = overrides?.size ?? faker.helpers.arrayElement(SWITCH_SIZES);
  const disabled = overrides?.disabled ?? faker.datatype.boolean({ probability: 0.1 });
  const checked = overrides?.checked ?? faker.datatype.boolean();

  return {
    ariaDescribedby: faker.helpers.maybe(() => `desc-${faker.string.alphanumeric(6)}`, {
      probability: 0.3,
    }),
    ariaLabel: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.switch.toggleSetting', 'Toggle setting'),
          i18n.t('factory.switch.enableFeature', 'Enable feature'),
          i18n.t('factory.switch.activateOption', 'Activate option'),
        ]),
      { probability: 0.4 }
    ),
    checked,
    className: SWITCH_SIZE_CLASSES[size],
    defaultChecked: faker.helpers.maybe(() => checked, { probability: 0.3 }),
    disabled,
    id: `switch-${faker.string.alphanumeric(8)}`,
    labelPosition: faker.helpers.arrayElement(LABEL_POSITIONS),
    name: faker.helpers.arrayElement([
      'notifications',
      'darkMode',
      'autoSave',
      'marketing',
      'analytics',
    ]),
    required: faker.datatype.boolean({ probability: 0.1 }),
    size,
    testId: `switch-${faker.string.alphanumeric(8)}`,
    value: 'on',
    ...overrides,
  };
}

/**
 * Create multiple fake switches
 */
export function createFakeSwitches(count: number, overrides?: Partial<FakeSwitch>): FakeSwitch[] {
  return Array.from({ length: count }, () => createFakeSwitch(overrides));
}

// ============================================================================
// LABELED SWITCH FACTORIES
// ============================================================================

/**
 * Create a switch with label
 */
export function createFakeSwitchWithLabel(
  overrides?: Partial<FakeSwitchWithLabel>
): FakeSwitchWithLabel {
  return {
    ...createFakeSwitch(overrides),
    description: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t(
            'factory.switch.enableThisSettingToActivate',
            'Enable this setting to activate the feature'
          ),
          i18n.t('factory.switch.toggleToChangeThisPreference', 'Toggle to change this preference'),
          i18n.t('factory.switch.turnOnToEnableNotifications', 'Turn on to enable notifications'),
          i18n.t('factory.switch.activateToSyncYourData', 'Activate to sync your data'),
        ]),
      { probability: 0.6 }
    ),
    label: overrides?.label ?? faker.helpers.arrayElement(COMMON_SWITCH_LABELS),
    ...overrides,
  };
}

/**
 * Create multiple switches with labels
 */
export function createFakeSwitchesWithLabels(
  count: number,
  overrides?: Partial<FakeSwitchWithLabel>
): FakeSwitchWithLabel[] {
  return Array.from({ length: count }, () => createFakeSwitchWithLabel(overrides));
}

// ============================================================================
// STATE-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a checked switch
 */
export function createFakeCheckedSwitch(overrides?: Partial<FakeSwitch>): FakeSwitch {
  return createFakeSwitch({ checked: true, ...overrides });
}

/**
 * Create an unchecked switch
 */
export function createFakeUncheckedSwitch(overrides?: Partial<FakeSwitch>): FakeSwitch {
  return createFakeSwitch({ checked: false, ...overrides });
}

/**
 * Create a disabled checked switch
 */
export function createFakeDisabledCheckedSwitch(overrides?: Partial<FakeSwitch>): FakeSwitch {
  return createFakeSwitch({ checked: true, disabled: true, ...overrides });
}

/**
 * Create a disabled unchecked switch
 */
export function createFakeDisabledUncheckedSwitch(overrides?: Partial<FakeSwitch>): FakeSwitch {
  return createFakeSwitch({ checked: false, disabled: true, ...overrides });
}

// ============================================================================
// CATEGORY-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a switch for a specific category
 */
export function createFakeCategorySwitch(
  category: SwitchCategory,
  overrides?: Partial<FakeSwitchWithLabel>
): FakeSwitchWithLabel {
  const setting = faker.helpers.arrayElement(CATEGORY_SETTINGS[category]);

  return createFakeSwitchWithLabel({
    description: setting.description,
    label: setting.label,
    name: faker.helpers.slugify(setting.label).toLowerCase(),
    ...overrides,
  });
}

/**
 * Create a notification switch
 */
export function createFakeNotificationSwitch(
  overrides?: Partial<FakeSwitchWithLabel>
): FakeSwitchWithLabel {
  return createFakeCategorySwitch('notifications', overrides);
}

/**
 * Create a privacy switch
 */
export function createFakePrivacySwitch(
  overrides?: Partial<FakeSwitchWithLabel>
): FakeSwitchWithLabel {
  return createFakeCategorySwitch('privacy', overrides);
}

/**
 * Create a security switch
 */
export function createFakeSecuritySwitch(
  overrides?: Partial<FakeSwitchWithLabel>
): FakeSwitchWithLabel {
  return createFakeCategorySwitch('security', overrides);
}

/**
 * Create an appearance switch
 */
export function createFakeAppearanceSwitch(
  overrides?: Partial<FakeSwitchWithLabel>
): FakeSwitchWithLabel {
  return createFakeCategorySwitch('appearance', overrides);
}

// ============================================================================
// FORM FIELD FACTORIES
// ============================================================================

/**
 * Create a switch form field
 */
export function createFakeSwitchFormField(
  overrides?: Partial<FakeSwitchFormField>
): FakeSwitchFormField {
  const validationState = faker.helpers.arrayElement<'error' | 'none' | 'success' | 'warning'>([
    'error',
    'none',
    'success',
    'warning',
  ]);

  return {
    ...createFakeSwitchWithLabel(overrides),
    errorMessage:
      validationState === 'error'
        ? faker.helpers.arrayElement([
            i18n.t('factory.switch.thisSettingIsRequired', 'This setting is required'),
            i18n.t('factory.switch.pleaseEnableThisOption', 'Please enable this option'),
            i18n.t(
              'factory.switch.thisFeatureIsCurrentlyUnavailable',
              'This feature is currently unavailable'
            ),
          ])
        : undefined,
    helpText: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t(
            'factory.switch.toggleToEnableOrDisable',
            'Toggle to enable or disable this feature'
          ),
          i18n.t(
            'factory.switch.changesWillBeAppliedImmediately',
            'Changes will be applied immediately'
          ),
          i18n.t(
            'factory.switch.youCanChangeThisSetting',
            'You can change this setting at any time'
          ),
        ]),
      { probability: 0.5 }
    ),
    validationState,
    ...overrides,
  };
}

// ============================================================================
// SETTINGS GROUP FACTORIES
// ============================================================================

/**
 * Create a settings group
 */
export function createFakeSwitchSettingsGroup(
  category: SwitchCategory,
  count = 5,
  overrides?: Partial<FakeSwitchSettingsGroup>
): FakeSwitchSettingsGroup {
  const categorySettings = CATEGORY_SETTINGS[category].slice(0, count);

  return {
    category,
    id: faker.string.uuid(),
    settings: categorySettings.map((setting) =>
      createFakeSwitchWithLabel({
        description: setting.description,
        label: setting.label,
        name: faker.helpers.slugify(setting.label).toLowerCase(),
      })
    ),
    title: category.charAt(0).toUpperCase() + category.slice(1),
    ...overrides,
  };
}

/**
 * Create all settings groups
 */
export function createFakeAllSettingsGroups(countPerCategory = 3): FakeSwitchSettingsGroup[] {
  return SWITCH_CATEGORIES.map((category) =>
    createFakeSwitchSettingsGroup(category, countPerCategory)
  );
}

// ============================================================================
// PREFERENCE FACTORIES
// ============================================================================

/**
 * Create a switch preference
 */
export function createFakeSwitchPreference(
  overrides?: Partial<FakeSwitchPreference>
): FakeSwitchPreference {
  const category = overrides?.category ?? faker.helpers.arrayElement(SWITCH_CATEGORIES);

  return {
    ...createFakeCategorySwitch(category, overrides),
    category,
    icon: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['🔔', '🔒', '🌙', '⚡', '📊', '🔄']),
      { probability: 0.5 }
    ),
    priority: faker.helpers.arrayElement<'high' | 'low' | 'medium'>(['high', 'low', 'medium']),
    ...overrides,
  };
}

// ============================================================================
// FEATURE TOGGLE FACTORIES
// ============================================================================

/**
 * Create a feature toggle
 */
export function createFakeFeatureToggle(overrides?: Partial<FakeFeatureToggle>): FakeFeatureToggle {
  const featureName = faker.helpers.arrayElement([
    i18n.t('factory.switch.newDashboard', 'New Dashboard'),
    i18n.t('factory.switch.betaEditor', 'Beta Editor'),
    i18n.t('factory.switch.advancedAnalytics', 'Advanced Analytics'),
    i18n.t('factory.switch.aiSuggestions', 'AI Suggestions'),
    i18n.t('factory.switch.darkModeV2', 'Dark Mode V2'),
    i18n.t('factory.switch.realtimeSync', 'Real-time Sync'),
    i18n.t('factory.switch.exportApi', 'Export API'),
    i18n.t('factory.switch.bulkActions', 'Bulk Actions'),
  ]);

  return {
    ...createFakeSwitch(overrides),
    description: i18n.t('factory.switch.enableTheFeature', 'Enable the {{feature}} feature', {
      feature: featureName.toLowerCase(),
    }),
    featureKey: faker.helpers.slugify(featureName).toLowerCase().replaceAll('-', '_'),
    featureName,
    isExperimental: faker.datatype.boolean({ probability: 0.3 }),
    rolloutPercentage: faker.number.int({ min: 0, max: 100 }),
    ...overrides,
  };
}

/**
 * Create multiple feature toggles
 */
export function createFakeFeatureToggles(
  count: number,
  overrides?: Partial<FakeFeatureToggle>
): FakeFeatureToggle[] {
  return Array.from({ length: count }, () => createFakeFeatureToggle(overrides));
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create a matrix of switches by size
 */
export function createSwitchSizeMatrix(): {
  className: string;
  size: SwitchSize;
  switch: FakeSwitch;
}[] {
  return SWITCH_SIZES.map((size) => ({
    className: SWITCH_SIZE_CLASSES[size],
    size,
    switch: createFakeSwitch({ size }),
  }));
}

/**
 * Create a matrix of switches by state
 */
export function createSwitchStateMatrix(): { state: SwitchState; switch: FakeSwitch }[] {
  return SWITCH_STATES.map((state) => {
    let switchConfig: Partial<FakeSwitch>;
    switch (state) {
      case 'checked': {
        switchConfig = { checked: true, disabled: false };
        break;
      }
      case 'unchecked': {
        switchConfig = { checked: false, disabled: false };
        break;
      }
      case 'disabled-checked': {
        switchConfig = { checked: true, disabled: true };
        break;
      }
      case 'disabled-unchecked': {
        switchConfig = { checked: false, disabled: true };
        break;
      }
      default: {
        switchConfig = { checked: false, disabled: false };
        break;
      }
    }

    return {
      state,
      switch: createFakeSwitch(switchConfig),
    };
  });
}

/**
 * Create a matrix of switches by category
 */
export function createSwitchCategoryMatrix(): {
  category: SwitchCategory;
  switch: FakeSwitchWithLabel;
}[] {
  return SWITCH_CATEGORIES.map((category) => ({
    category,
    switch: createFakeCategorySwitch(category),
  }));
}

/**
 * Create a matrix of switches by label position
 */
export function createSwitchLabelPositionMatrix(): {
  position: LabelPosition;
  switch: FakeSwitchWithLabel;
}[] {
  return LABEL_POSITIONS.map((position) => ({
    position,
    switch: createFakeSwitchWithLabel({ labelPosition: position }),
  }));
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive switch test data
 */
export function createSwitchTestData(): {
  accessibility: FakeSwitchWithLabel;
  appearance: FakeSwitchWithLabel;
  basic: FakeSwitch;
  checked: FakeSwitch;
  disabledChecked: FakeSwitch;
  disabledUnchecked: FakeSwitch;
  featureToggle: FakeFeatureToggle;
  formField: FakeSwitchFormField;
  large: FakeSwitch;
  notification: FakeSwitchWithLabel;
  preference: FakeSwitchPreference;
  privacy: FakeSwitchWithLabel;
  security: FakeSwitchWithLabel;
  settingsGroup: FakeSwitchSettingsGroup;
  small: FakeSwitch;
  unchecked: FakeSwitch;
  withLabel: FakeSwitchWithLabel;
} {
  return {
    accessibility: createFakeCategorySwitch('accessibility'),
    appearance: createFakeAppearanceSwitch(),
    basic: createFakeSwitch(),
    checked: createFakeCheckedSwitch(),
    disabledChecked: createFakeDisabledCheckedSwitch(),
    disabledUnchecked: createFakeDisabledUncheckedSwitch(),
    featureToggle: createFakeFeatureToggle(),
    formField: createFakeSwitchFormField(),
    large: createFakeSwitch({ size: 'large' }),
    notification: createFakeNotificationSwitch(),
    preference: createFakeSwitchPreference(),
    privacy: createFakePrivacySwitch(),
    security: createFakeSecuritySwitch(),
    settingsGroup: createFakeSwitchSettingsGroup('notifications'),
    small: createFakeSwitch({ size: 'small' }),
    unchecked: createFakeUncheckedSwitch(),
    withLabel: createFakeSwitchWithLabel(),
  };
}

/**
 * Create a showcase of all switch variants
 */
export function createSwitchShowcase(): {
  allSettingsGroups: FakeSwitchSettingsGroup[];
  categoryMatrix: ReturnType<typeof createSwitchCategoryMatrix>;
  featureToggles: FakeFeatureToggle[];
  labelPositionMatrix: ReturnType<typeof createSwitchLabelPositionMatrix>;
  sizeMatrix: ReturnType<typeof createSwitchSizeMatrix>;
  stateMatrix: ReturnType<typeof createSwitchStateMatrix>;
  testData: ReturnType<typeof createSwitchTestData>;
} {
  return {
    allSettingsGroups: createFakeAllSettingsGroups(),
    categoryMatrix: createSwitchCategoryMatrix(),
    featureToggles: createFakeFeatureToggles(5),
    labelPositionMatrix: createSwitchLabelPositionMatrix(),
    sizeMatrix: createSwitchSizeMatrix(),
    stateMatrix: createSwitchStateMatrix(),
    testData: createSwitchTestData(),
  };
}

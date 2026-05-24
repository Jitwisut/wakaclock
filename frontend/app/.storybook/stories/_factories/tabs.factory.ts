import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════
// SHARED STRING CONSTANTS
// ═══════════════════════════════════════════════════════════════

const LABEL_SETTINGS = i18n.t('factory.tabs.settings', 'Settings');
const LABEL_FILE = i18n.t('factory.tabs.file', 'File');

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** Tabs visual variant */
export type TabsVariant = 'default' | 'outline' | 'pills' | 'underline';

/** Tabs size variant */
export type TabsSize = 'default' | 'lg' | 'sm';

/** Tabs orientation */
export type TabsOrientation = 'horizontal' | 'vertical';

/** Tab activation mode */
export type TabsActivationMode = 'automatic' | 'manual';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

/** Individual tab item */
export interface FakeTab {
  ariaLabel?: string;
  badge?: number | string;
  closable?: boolean;
  content: string;
  disabled: boolean;
  icon?: string;
  id: string;
  label: string;
  loading?: boolean;
  metadata?: Record<string, unknown>;
}

/** Tabs component configuration */
export interface FakeTabsConfig {
  activationMode: TabsActivationMode;
  className?: string;
  defaultValue?: string;
  id: string;
  loop: boolean;
  orientation: TabsOrientation;
  size: TabsSize;
  tabs: FakeTab[];
  variant: TabsVariant;
}

/** Tabs with async content */
export interface FakeAsyncTab extends FakeTab {
  asyncContent?: () => Promise<string>;
  loadingState?: 'error' | 'idle' | 'loading' | 'success';
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

export const TABS_VARIANTS: TabsVariant[] = ['default', 'outline', 'pills', 'underline'];

export const TABS_SIZES: TabsSize[] = ['sm', 'default', 'lg'];

export const TABS_ORIENTATIONS: TabsOrientation[] = ['horizontal', 'vertical'];

export const TABS_ACTIVATION_MODES: TabsActivationMode[] = ['automatic', 'manual'];

export const TAB_ICONS = [
  i18n.t('factory.tabs.home', 'Home'),
  i18n.t('factory.tabs.user', 'User'),
  LABEL_SETTINGS,
  i18n.t('factory.tabs.bell', 'Bell'),
  i18n.t('factory.tabs.mail', 'Mail'),
  LABEL_FILE,
  i18n.t('factory.tabs.folder', 'Folder'),
  i18n.t('factory.tabs.star', 'Star'),
  i18n.t('factory.tabs.heart', 'Heart'),
  'CreditCard',
  i18n.t('factory.tabs.calendar', 'Calendar'),
  'MessageSquare',
  i18n.t('factory.tabs.shield', 'Shield'),
  i18n.t('factory.tabs.lock', 'Lock'),
  'Key',
];

export const TAB_LABELS = [
  i18n.t('factory.tabs.overview', 'Overview'),
  i18n.t('factory.tabs.analytics', 'Analytics'),
  i18n.t('factory.tabs.reports', 'Reports'),
  LABEL_SETTINGS,
  i18n.t('factory.tabs.profile', 'Profile'),
  i18n.t('factory.tabs.account', 'Account'),
  i18n.t('factory.tabs.security', 'Security'),
  i18n.t('factory.tabs.notifications', 'Notifications'),
  i18n.t('factory.tabs.billing', 'Billing'),
  i18n.t('factory.tabs.team', 'Team'),
  i18n.t('factory.tabs.integrations', 'Integrations'),
  i18n.t('factory.tabs.api', 'API'),
  i18n.t('factory.tabs.logs', 'Logs'),
  i18n.t('factory.tabs.activity', 'Activity'),
  i18n.t('factory.tabs.dashboard', 'Dashboard'),
];

export const TAB_CONTENT_SAMPLES = [
  i18n.t(
    'factory.tabs.viewYourAccountOverviewAnd',
    'View your account overview and recent activity.'
  ),
  i18n.t(
    'factory.tabs.analyzeYourDataWithInteractive',
    'Analyze your data with interactive charts and graphs.'
  ),
  i18n.t('factory.tabs.generateAndExportDetailedReports', 'Generate and export detailed reports.'),
  i18n.t(
    'factory.tabs.manageYourPreferencesAndConfiguration',
    'Manage your preferences and configuration.'
  ),
  i18n.t(
    'factory.tabs.updateYourPersonalInformationAnd',
    'Update your personal information and avatar.'
  ),
  i18n.t(
    'factory.tabs.manageSubscriptionAndPaymentMethods',
    'Manage subscription and payment methods.'
  ),
  i18n.t(
    'factory.tabs.configureSecuritySettingsAndTwofactor',
    'Configure security settings and two-factor authentication.'
  ),
  i18n.t('factory.tabs.controlHowAndWhenYou', 'Control how and when you receive notifications.'),
  i18n.t('factory.tabs.viewAndManageTeamMembers', 'View and manage team members and permissions.'),
  i18n.t(
    'factory.tabs.connectWithThirdpartyServicesAnd',
    'Connect with third-party services and tools.'
  ),
];

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

/** Create a single fake tab */
export function createFakeTab(overrides?: Partial<FakeTab>): FakeTab {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(TAB_LABELS),
    content: faker.helpers.arrayElement(TAB_CONTENT_SAMPLES),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(TAB_ICONS), {
      probability: 0.4,
    }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    badge: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 99 }), { probability: 0.2 }),
    closable: faker.helpers.maybe(() => true, { probability: 0.15 }),
    loading: faker.helpers.maybe(() => true, { probability: 0.05 }),
    ariaLabel: faker.helpers.maybe(() => faker.lorem.words(3), { probability: 0.2 }),
    metadata: faker.helpers.maybe(() => ({ createdAt: faker.date.recent().toISOString() }), {
      probability: 0.1,
    }),
    ...overrides,
  };
}

/** Create a fake tabs configuration */
export function createFakeTabsConfig(overrides?: Partial<FakeTabsConfig>): FakeTabsConfig {
  const tabs = overrides?.tabs ?? createFakeTabs(faker.number.int({ min: 3, max: 6 }));

  return {
    id: faker.string.uuid(),
    variant: faker.helpers.arrayElement(TABS_VARIANTS),
    size: faker.helpers.arrayElement(TABS_SIZES),
    orientation: faker.helpers.arrayElement(TABS_ORIENTATIONS),
    activationMode: faker.helpers.arrayElement(TABS_ACTIVATION_MODES),
    loop: faker.datatype.boolean({ probability: 0.7 }),
    tabs,
    defaultValue: faker.helpers.maybe(() => tabs[0]?.id, { probability: 0.8 }),
    className: faker.helpers.maybe(() => 'w-full', { probability: 0.3 }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

/** Create multiple fake tabs */
export function createFakeTabs(count: number, overrides?: Partial<FakeTab>): FakeTab[] {
  return Array.from({ length: count }, () => createFakeTab(overrides));
}

/** Create multiple tabs configurations */
export function createFakeTabsConfigs(count: number): FakeTabsConfig[] {
  return Array.from({ length: count }, () => createFakeTabsConfig());
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/** Create a disabled tab */
export function createFakeTabDisabled(): FakeTab {
  return createFakeTab({ disabled: true });
}

/** Create a tab with icon */
export function createFakeTabWithIcon(icon?: string): FakeTab {
  return createFakeTab({
    icon: icon ?? faker.helpers.arrayElement(TAB_ICONS),
  });
}

/** Create a tab with badge */
export function createFakeTabWithBadge(badge?: number | string): FakeTab {
  return createFakeTab({
    badge: badge ?? faker.number.int({ min: 1, max: 99 }),
  });
}

/** Create a closable tab */
export function createFakeTabClosable(): FakeTab {
  return createFakeTab({ closable: true });
}

/** Create a loading tab */
export function createFakeTabLoading(): FakeTab {
  return createFakeTab({ loading: true });
}

/** Create account settings tabs */
export function createFakeAccountSettingsTabs(): FakeTab[] {
  return [
    createFakeTab({
      id: 'account',
      label: i18n.t('factory.tabs.account', 'Account'),
      icon: i18n.t('factory.tabs.user', 'User'),
      content: i18n.t(
        'factory.tabs.manageYourAccountSettingsAnd',
        'Manage your account settings and preferences.'
      ),
    }),
    createFakeTab({
      id: 'security',
      label: i18n.t('factory.tabs.security', 'Security'),
      icon: i18n.t('factory.tabs.shield', 'Shield'),
      content: i18n.t(
        'factory.tabs.configurePasswordAndTwofactorAuthentication',
        'Configure password and two-factor authentication.'
      ),
    }),
    createFakeTab({
      id: 'notifications',
      label: i18n.t('factory.tabs.notifications', 'Notifications'),
      icon: i18n.t('factory.tabs.bell', 'Bell'),
      content: i18n.t(
        'factory.tabs.controlNotificationPreferences',
        'Control notification preferences.'
      ),
      badge: 3,
    }),
    createFakeTab({
      id: 'billing',
      label: i18n.t('factory.tabs.billing', 'Billing'),
      icon: 'CreditCard',
      content: i18n.t(
        'factory.tabs.managePaymentMethodsAndView',
        'Manage payment methods and view invoices.'
      ),
    }),
    createFakeTab({
      id: 'integrations',
      label: i18n.t('factory.tabs.integrations', 'Integrations'),
      icon: LABEL_SETTINGS,
      content: i18n.t('factory.tabs.connectThirdpartyServices', 'Connect third-party services.'),
    }),
  ];
}

/** Create dashboard navigation tabs */
export function createFakeDashboardTabs(): FakeTab[] {
  return [
    createFakeTab({
      id: 'overview',
      label: i18n.t('factory.tabs.overview', 'Overview'),
      icon: i18n.t('factory.tabs.home', 'Home'),
      content: i18n.t(
        'factory.tabs.dashboardOverviewWithKeyMetrics',
        'Dashboard overview with key metrics.'
      ),
    }),
    createFakeTab({
      id: 'analytics',
      label: i18n.t('factory.tabs.analytics', 'Analytics'),
      icon: LABEL_SETTINGS,
      content: i18n.t('factory.tabs.detailedAnalyticsAndCharts', 'Detailed analytics and charts.'),
      badge: i18n.t('factory.tabs.new', 'New'),
    }),
    createFakeTab({
      id: 'reports',
      label: i18n.t('factory.tabs.reports', 'Reports'),
      icon: LABEL_FILE,
      content: i18n.t('factory.tabs.generateAndDownloadReports', 'Generate and download reports.'),
    }),
    createFakeTab({
      id: 'activity',
      label: i18n.t('factory.tabs.activity', 'Activity'),
      icon: 'MessageSquare',
      content: i18n.t('factory.tabs.recentActivityAndEvents', 'Recent activity and events.'),
      badge: 12,
    }),
  ];
}

/** Create file browser tabs (closable) */
export function createFakeFileBrowserTabs(): FakeTab[] {
  return [
    createFakeTab({
      id: 'file1',
      label: 'index.tsx',
      icon: LABEL_FILE,
      closable: true,
      content: i18n.t('factory.tabs.reactComponentFile', 'React component file.'),
    }),
    createFakeTab({
      id: 'file2',
      label: 'styles.css',
      icon: LABEL_FILE,
      closable: true,
      content: i18n.t('factory.tabs.cssStylesheet', 'CSS stylesheet.'),
    }),
    createFakeTab({
      id: 'file3',
      label: 'README.md',
      icon: LABEL_FILE,
      closable: true,
      content: i18n.t('factory.tabs.documentationFile', 'Documentation file.'),
    }),
  ];
}

/** Create tabs with disabled items */
export function createFakeTabsWithDisabled(): FakeTab[] {
  return [
    createFakeTab({
      id: 'tab1',
      label: i18n.t('factory.tabs.enabled', 'Enabled'),
      disabled: false,
    }),
    createFakeTab({
      id: 'tab2',
      label: i18n.t('factory.tabs.disabled', 'Disabled'),
      disabled: true,
    }),
    createFakeTab({
      id: 'tab3',
      label: i18n.t('factory.tabs.enabled', 'Enabled'),
      disabled: false,
    }),
    createFakeTab({
      id: 'tab4',
      label: i18n.t('factory.tabs.disabled', 'Disabled'),
      disabled: true,
    }),
  ];
}

/** Create tabs all with icons */
export function createFakeTabsAllWithIcons(): FakeTab[] {
  return TAB_ICONS.slice(0, 5).map((icon, index) =>
    createFakeTab({
      id: `tab-${index}`,
      label:
        TAB_LABELS[index] ??
        i18n.t('factory.tabs.tabLabel', 'Tab {{number}}', { number: index + 1 }),
      icon,
    })
  );
}

/** Create tabs all with badges */
export function createFakeTabsAllWithBadges(): FakeTab[] {
  return Array.from({ length: 4 }, (_, index) =>
    createFakeTab({
      id: `tab-${index}`,
      label:
        TAB_LABELS[index] ??
        i18n.t('factory.tabs.tabLabel', 'Tab {{number}}', { number: index + 1 }),
      badge: faker.number.int({ min: 1, max: 99 }),
    })
  );
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/** Create variant × size matrix for visual testing */
export function createFakeTabsVariantSizeMatrix(): FakeTabsConfig[][] {
  return TABS_VARIANTS.map((variant) =>
    TABS_SIZES.map((size) =>
      createFakeTabsConfig({
        variant,
        size,
        tabs: [
          createFakeTab({ id: 'tab1', label: i18n.t('factory.tabs.first', 'First') }),
          createFakeTab({ id: 'tab2', label: i18n.t('factory.tabs.second', 'Second') }),
          createFakeTab({ id: 'tab3', label: i18n.t('factory.tabs.third', 'Third') }),
        ],
      })
    )
  );
}

/** Create variant × orientation matrix for visual testing */
export function createFakeTabsVariantOrientationMatrix(): FakeTabsConfig[][] {
  return TABS_VARIANTS.map((variant) =>
    TABS_ORIENTATIONS.map((orientation) =>
      createFakeTabsConfig({
        variant,
        orientation,
        tabs: [
          createFakeTab({ id: 'tab1', label: i18n.t('factory.tabs.overview', 'Overview') }),
          createFakeTab({ id: 'tab2', label: i18n.t('factory.tabs.settings', 'Settings') }),
          createFakeTab({ id: 'tab3', label: i18n.t('factory.tabs.profile', 'Profile') }),
        ],
      })
    )
  );
}

/** Create all variants for visual testing */
export function createFakeTabsAllVariants(): FakeTabsConfig[] {
  return TABS_VARIANTS.map((variant) =>
    createFakeTabsConfig({
      variant,
      tabs: createFakeTabs(4),
    })
  );
}

/** Create all sizes for visual testing */
export function createFakeTabsAllSizes(): FakeTabsConfig[] {
  return TABS_SIZES.map((size) =>
    createFakeTabsConfig({
      size,
      tabs: createFakeTabs(4),
    })
  );
}

/** Create all orientations for visual testing */
export function createFakeTabsAllOrientations(): FakeTabsConfig[] {
  return TABS_ORIENTATIONS.map((orientation) =>
    createFakeTabsConfig({
      orientation,
      tabs: createFakeTabs(4),
    })
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create accessible tabs with ARIA labels */
export function createFakeAccessibleTabs(): FakeTabsConfig {
  return createFakeTabsConfig({
    activationMode: 'manual',
    loop: true,
    tabs: [
      createFakeTab({
        id: 'tab1',
        label: i18n.t('factory.tabs.account', 'Account'),
        ariaLabel: i18n.t('factory.tabs.accountSettingsTab', 'Account settings tab'),
        content: i18n.t('factory.tabs.manageYourAccountSettings', 'Manage your account settings.'),
      }),
      createFakeTab({
        id: 'tab2',
        label: i18n.t('factory.tabs.security', 'Security'),
        ariaLabel: i18n.t('factory.tabs.securitySettingsTab', 'Security settings tab'),
        content: i18n.t('factory.tabs.configureSecurityOptions', 'Configure security options.'),
      }),
      createFakeTab({
        id: 'tab3',
        label: i18n.t('factory.tabs.privacy', 'Privacy'),
        ariaLabel: i18n.t('factory.tabs.privacySettingsTab', 'Privacy settings tab'),
        content: i18n.t(
          'factory.tabs.controlYourPrivacySettings',
          'Control your privacy settings.'
        ),
      }),
    ],
  });
}

/** Create tabs with async content loading */
export function createFakeAsyncTabs(): FakeAsyncTab[] {
  return [
    {
      ...createFakeTab({ id: 'async1', label: i18n.t('factory.tabs.dashboard', 'Dashboard') }),
      loadingState: 'success',
      asyncContent: async () =>
        i18n.t(
          'factory.tabs.dashboardContentLoadedSuccessfully',
          'Dashboard content loaded successfully.'
        ),
    },
    {
      ...createFakeTab({ id: 'async2', label: i18n.t('factory.tabs.analytics', 'Analytics') }),
      loadingState: 'loading',
      asyncContent: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return i18n.t('factory.tabs.analyticsContentLoaded', 'Analytics content loaded.');
      },
    },
    {
      ...createFakeTab({ id: 'async3', label: i18n.t('factory.tabs.reports', 'Reports') }),
      loadingState: 'error',
      asyncContent: async () => {
        throw new Error(i18n.t('factory.tabs.failedToLoadReports', 'Failed to load reports'));
      },
    },
  ];
}

/** Create tabs for keyboard navigation testing */
export function createFakeKeyboardNavigationTabs(): FakeTabsConfig {
  return createFakeTabsConfig({
    activationMode: 'manual',
    loop: true,
    tabs: Array.from({ length: 5 }, (_, index) =>
      createFakeTab({
        id: `nav-tab-${index}`,
        label: i18n.t('factory.tabs.tabLabel', 'Tab {{number}}', { number: index + 1 }),
        content: i18n.t(
          'factory.tabs.tabContent',
          'Content for Tab {{number}}. Use arrow keys to navigate.',
          { number: index + 1 }
        ),
      })
    ),
  });
}

/** Create tabs with persistent state (for form wizards) */
export function createFakeWizardTabs(): FakeTab[] {
  return [
    createFakeTab({
      id: 'step1',
      label: i18n.t('factory.tabs.personalInfo', 'Personal Info'),
      icon: i18n.t('factory.tabs.user', 'User'),
      content: i18n.t(
        'factory.tabs.enterYourPersonalInformation',
        'Enter your personal information.'
      ),
      badge: '1',
    }),
    createFakeTab({
      id: 'step2',
      label: i18n.t('factory.tabs.contact', 'Contact'),
      icon: i18n.t('factory.tabs.mail', 'Mail'),
      content: i18n.t('factory.tabs.provideYourContactDetails', 'Provide your contact details.'),
      badge: '2',
    }),
    createFakeTab({
      id: 'step3',
      label: i18n.t('factory.tabs.preferences', 'Preferences'),
      icon: LABEL_SETTINGS,
      content: i18n.t('factory.tabs.setYourPreferences', 'Set your preferences.'),
      badge: '3',
    }),
    createFakeTab({
      id: 'step4',
      label: i18n.t('factory.tabs.review', 'Review'),
      icon: i18n.t('factory.tabs.shield', 'Shield'),
      content: i18n.t('factory.tabs.reviewAndSubmit', 'Review and submit.'),
      badge: '4',
    }),
  ];
}

/** Create vertical tabs for sidebar navigation */
export function createFakeVerticalNavTabs(): FakeTabsConfig {
  return createFakeTabsConfig({
    orientation: 'vertical',
    variant: 'pills',
    tabs: [
      createFakeTab({ id: 'home', label: i18n.t('factory.tabs.home', 'Home'), icon: 'Home' }),
      createFakeTab({
        id: 'profile',
        label: i18n.t('factory.tabs.profile', 'Profile'),
        icon: 'User',
      }),
      createFakeTab({
        id: 'settings',
        label: i18n.t('factory.tabs.settings', 'Settings'),
        icon: 'Settings',
      }),
      createFakeTab({
        id: 'notifications',
        label: i18n.t('factory.tabs.notifications', 'Notifications'),
        icon: 'Bell',
        badge: 5,
      }),
      createFakeTab({ id: 'logout', label: i18n.t('factory.tabs.logout', 'Logout'), icon: 'Lock' }),
    ],
  });
}

/** Create tabs for RTL testing */
export function createFakeRTLTabs(): FakeTabsConfig {
  return createFakeTabsConfig({
    tabs: [
      createFakeTab({ id: 'rtl1', label: 'الرئيسية', content: 'محتوى الصفحة الرئيسية' }),
      createFakeTab({ id: 'rtl2', label: 'الإعدادات', content: 'محتوى صفحة الإعدادات' }),
      createFakeTab({ id: 'rtl3', label: 'الملف الشخصي', content: 'محتوى الملف الشخصي' }),
    ],
  });
}

/** Create comprehensive enterprise tabs set */
export function createFakeEnterpriseTabsSet(): FakeTabsConfig[] {
  return [
    createFakeAccessibleTabs(),
    createFakeKeyboardNavigationTabs(),
    createFakeVerticalNavTabs(),
    createFakeTabsConfig({ tabs: createFakeAccountSettingsTabs() }),
    createFakeTabsConfig({ tabs: createFakeDashboardTabs() }),
  ];
}

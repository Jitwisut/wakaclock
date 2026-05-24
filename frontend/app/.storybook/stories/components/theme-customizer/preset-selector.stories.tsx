import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import {
  presetSelectorHandlers,
  presetSelectorStatusHandlers,
} from '@/.storybook/stories/_handlers/preset-selector.handlers';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  ACCENT_COLORS,
  type AccentColor,
  COLOR_MODES,
  type ColorMode,
  CONTENT_LAYOUTS,
  type ContentLayout,
  createAccessibleThemeConfig,
  createCompactThemeConfig,
  createDarkThemeConfig,
  createDefaultThemeConfig,
  createFakeEnterpriseThemeConfig,
  createFakeEnterpriseThemeSet,
  createFakeThemeAccentColorModeMatrix,
  createFakeThemeColorModeScaleMatrix,
  createFakeThemeConfig,
  createFakeThemeConfigs,
  createFakeThemeConfigsWithAllAccents,
  createFakeThemeConfigsWithAllColorModes,
  createFakeThemeConfigsWithAllPresets,
  createFakeThemeConfigsWithAllRadii,
  createFakeThemeConfigsWithAllScales,
  createFakeThemeCustomization,
  createFakeThemeCustomizations,
  createFakeThemeExport,
  createFakeThemeExports,
  createFakeThemeHistories,
  createFakeThemeHistory,
  createFakeThemePreference,
  createFakeThemePreferences,
  createFakeThemePresetColorModeMatrix,
  createFakeThemePresetInfo,
  createFakeThemePresetRadiusMatrix,
  createFakeThemePresets,
  createFakeThemeShowcase,
  createLightThemeConfig,
  createSpaciousThemeConfig,
  FONT_FAMILIES,
  type FontFamily,
  SIDEBAR_MODES,
  type SidebarMode,
  THEME_PRESET_IDS,
  THEME_PRESETS,
  THEME_RADII,
  THEME_SCALES,
  type ThemeConfig,
  type ThemeCustomization,
  type ThemeExport,
  type ThemeHistory,
  type ThemePreference,
  type ThemePreset,
  type ThemePresetInfo,
  type ThemeRadius,
  type ThemeScale,
} from '@/.storybook/stories/_factories/theme.factory';

import { PresetSelector } from '@/components/theme-customizer/preset-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

// ============ TYPE GUARD HELPERS ============

function isThemePreset(value: string): value is ThemePreset {
  return THEME_PRESET_IDS.includes(value as ThemePreset);
}

function isColorMode(value: string): value is ColorMode {
  return COLOR_MODES.includes(value as ColorMode);
}

function isContentLayout(value: string): value is ContentLayout {
  return CONTENT_LAYOUTS.includes(value as ContentLayout);
}

function isThemeRadius(value: string): value is ThemeRadius {
  return THEME_RADII.includes(value as ThemeRadius);
}

function isThemeScale(value: string): value is ThemeScale {
  return THEME_SCALES.includes(value as ThemeScale);
}

function isSidebarMode(value: string): value is SidebarMode {
  return SIDEBAR_MODES.includes(value as SidebarMode);
}

function isFontFamily(value: string): value is FontFamily {
  return FONT_FAMILIES.includes(value as FontFamily);
}

function isAccentColor(value: string): value is AccentColor {
  return ACCENT_COLORS.includes(value as AccentColor);
}

// ============ FRAME COMPONENTS ============

type PresetSelectorFrameProps = {
  onValueChange?: (value: string) => void;
  withLabels?: boolean;
};

function PresetSelectorFrame({ withLabels = true, onValueChange }: PresetSelectorFrameProps) {
  return (
    <PresetSelector
      {...(onValueChange && { onValueChange })}
      labels={
        withLabels
          ? {
              label: i18n.t('presetSelector.label'),
              placeholder: i18n.t('presetSelector.placeholder'),
            }
          : undefined
      }
    />
  );
}

// ============ ASYNC PRESET LOADING COMPONENT ============

interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function PresetSelectorErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert
      variant="destructive"
      data-error-status={error.status}
      data-testid="preset-selector-error"
    >
      <AlertCircleIcon className="size-4" />
      <AlertTitle>
        Error {error.status}: {error.code}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {error.message}
        {error.details && (
          <ul className="mt-2 list-disc pl-4 text-sm">
            {Object.entries(error.details).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCwIcon className="mr-2 size-4" />
          Retry
        </Button>
      )}
    </Alert>
  );
}

function PresetSelectorLoadingSkeleton() {
  return (
    <div className="space-y-2" data-state="loading" data-testid="preset-selector-loading">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function AsyncPresetSelectorFrame() {
  const { t } = useTranslation();
  const [presets, setPresets] = React.useState<ThemePresetInfo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchPresets = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/theme/presets')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ presets: ThemePresetInfo[] }>;
      })
      .then((data) => {
        setPresets(data.presets);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  if (loading) {
    return <PresetSelectorLoadingSkeleton />;
  }

  if (error) {
    return <PresetSelectorErrorDisplay error={error} onRetry={fetchPresets} />;
  }

  if (presets.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center" data-testid="preset-selector-empty">
        No presets available
      </div>
    );
  }

  return (
    <div
      data-state="success"
      data-testid="preset-selector-success"
      data-preset-count={presets.length}
    >
      <PresetSelector
        labels={{
          label: t('presetSelector.label'),
          placeholder: t('presetSelector.placeholder'),
        }}
      />
    </div>
  );
}

// ============ FAKER DATA COMPONENT ============

function PresetSelectorWithFakerData() {
  const { t } = useTranslation();
  const presets = React.useMemo(() => createFakeThemePresets(6), []);

  return (
    <div
      className="space-y-4"
      data-testid="preset-selector-faker"
      data-preset-count={presets.length}
    >
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">
          {t('presetSelector.story.availablePresets', 'Available Presets:')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-2 text-xs">
              <div
                className="size-4 rounded-full border"
                style={{ backgroundColor: preset.colors.primary }}
              />
              <span>{preset.name}</span>
            </div>
          ))}
        </div>
      </div>
      <PresetSelector
        labels={{
          label: t('presetSelector.label'),
          placeholder: t('presetSelector.placeholder'),
        }}
      />
    </div>
  );
}

// ============ I18N COMPONENT ============

function I18nPresetSelectorDemo() {
  const { t } = useTranslation();

  return (
    <PresetSelector
      labels={{
        label: t('presetSelector.label'),
        placeholder: t('presetSelector.placeholder'),
      }}
    />
  );
}

// ============ THEME CONFIG DEMO COMPONENTS ============

function ThemeConfigInfoRow({ config, label }: { config: ThemeConfig; label: string }) {
  return (
    <div
      className="rounded-lg border p-3"
      data-testid="theme-config-row"
      data-config-id={config.id}
    >
      <p className="mb-1 text-sm font-medium">{label}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <span>: {config.preset}</span>
        <span>: {config.colorMode}</span>
        <span>: {config.radius}</span>
        <span>: {config.scale}</span>
        <span>: {config.fontFamily}</span>
        <span>: {config.fontSize}px</span>
        <span>: {config.sidebarMode}</span>
        <span>: {config.contentLayout}</span>
        <span>: {config.accentColor}</span>
      </div>
    </div>
  );
}

function DefaultThemeConfigDemo() {
  const { t } = useTranslation();
  const config = React.useMemo(() => createDefaultThemeConfig(), []);
  return (
    <div className="space-y-4" data-testid="default-config-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.default')}</h3>
      <ThemeConfigInfoRow config={config} label={t('presetSelector.default')} />
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function DarkThemeConfigDemo() {
  const config = React.useMemo(() => createDarkThemeConfig(), []);
  return (
    <div className="space-y-4" data-testid="dark-config-demo">
      <h3 className="text-sm font-medium">{i18n.t('presetSelector.dark')}</h3>
      <ThemeConfigInfoRow config={config} label={i18n.t('presetSelector.dark')} />
      <PresetSelector
        labels={{
          label: i18n.t('presetSelector.label'),
          placeholder: i18n.t('presetSelector.placeholder'),
        }}
      />
    </div>
  );
}

function LightThemeConfigDemo() {
  const config = React.useMemo(() => createLightThemeConfig(), []);
  return (
    <div className="space-y-4" data-testid="light-config-demo">
      <h3 className="text-sm font-medium">{i18n.t('presetSelector.light')}</h3>
      <ThemeConfigInfoRow config={config} label={i18n.t('presetSelector.light')} />
      <PresetSelector
        labels={{
          label: i18n.t('presetSelector.label'),
          placeholder: i18n.t('presetSelector.placeholder'),
        }}
      />
    </div>
  );
}

function AccessibleThemeConfigDemo() {
  const config = React.useMemo(() => createAccessibleThemeConfig(), []);
  return (
    <div className="space-y-4" data-testid="accessible-config-demo">
      <h3 className="text-sm font-medium">
        {i18n.t('presetSelector.highContrast')} / {i18n.t('presetSelector.reducedMotion')}
      </h3>
      <ThemeConfigInfoRow
        config={config}
        label={i18n.t('presetSelector.story.accessible', 'Accessible')}
      />
      <div className="flex gap-4 text-xs">
        <span>
          {i18n.t('presetSelector.highContrast')}:{' '}
          {config.highContrast
            ? i18n.t('presetSelector.story.yes', 'Yes')
            : i18n.t('presetSelector.story.no', 'No')}
        </span>
        <span>
          {i18n.t('presetSelector.reducedMotion')}:{' '}
          {config.reducedMotion
            ? i18n.t('presetSelector.story.yes', 'Yes')
            : i18n.t('presetSelector.story.no', 'No')}
        </span>
      </div>
      <PresetSelector
        labels={{
          label: i18n.t('presetSelector.label'),
          placeholder: i18n.t('presetSelector.placeholder'),
        }}
      />
    </div>
  );
}

function CompactThemeConfigDemo() {
  const { t } = useTranslation();
  const config = React.useMemo(() => createCompactThemeConfig(), []);
  return (
    <div className="space-y-4" data-testid="compact-config-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.compact')}</h3>
      <ThemeConfigInfoRow config={config} label={t('presetSelector.compact')} />
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function SpaciousThemeConfigDemo() {
  const config = React.useMemo(() => createSpaciousThemeConfig(), []);
  return (
    <div className="space-y-4" data-testid="spacious-config-demo">
      <h3 className="text-sm font-medium">{i18n.t('presetSelector.spacious')}</h3>
      <ThemeConfigInfoRow config={config} label={i18n.t('presetSelector.spacious')} />
      <PresetSelector
        labels={{
          label: i18n.t('presetSelector.label'),
          placeholder: i18n.t('presetSelector.placeholder'),
        }}
      />
    </div>
  );
}

function SingleThemeConfigDemo() {
  const config = React.useMemo(() => createFakeThemeConfig(), []);
  return (
    <div className="space-y-4" data-testid="single-config-demo">
      <h3 className="text-sm font-medium">{i18n.t('presetSelector.config')}</h3>
      <ThemeConfigInfoRow
        config={config}
        label={i18n.t('presetSelector.story.randomConfig', 'Random Config')}
      />
      <PresetSelector
        labels={{
          label: i18n.t('presetSelector.label'),
          placeholder: i18n.t('presetSelector.placeholder'),
        }}
      />
    </div>
  );
}

function BulkThemeConfigsDemo() {
  const configs = React.useMemo(() => createFakeThemeConfigs(5), []);
  return (
    <div className="space-y-4" data-testid="bulk-configs-demo" data-config-count={configs.length}>
      <h3 className="text-sm font-medium">
        {i18n.t('presetSelector.config')} ({configs.length})
      </h3>
      <div className="space-y-2">
        {configs.map((config, index) => (
          <ThemeConfigInfoRow key={config.id} config={config} label={`Config ${index + 1}`} />
        ))}
      </div>
      <PresetSelector
        labels={{
          label: i18n.t('presetSelector.label'),
          placeholder: i18n.t('presetSelector.placeholder'),
        }}
      />
    </div>
  );
}

function AllPresetsConfigDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeThemeConfigsWithAllPresets(), []);
  return (
    <div className="space-y-4" data-testid="all-presets-demo" data-config-count={configs.length}>
      <h3 className="text-sm font-medium">{t('presetSelector.allPresets')}</h3>
      <div className="space-y-2">
        {configs.map((config) => (
          <ThemeConfigInfoRow key={config.id} config={config} label={config.preset} />
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function AllColorModesConfigDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeThemeConfigsWithAllColorModes(), []);
  return (
    <div
      className="space-y-4"
      data-testid="all-color-modes-demo"
      data-config-count={configs.length}
    >
      <h3 className="text-sm font-medium">{t('presetSelector.colorMode')}</h3>
      <div className="space-y-2">
        {configs.map((config) => (
          <ThemeConfigInfoRow key={config.id} config={config} label={config.colorMode} />
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function AllRadiiConfigDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeThemeConfigsWithAllRadii(), []);
  return (
    <div className="space-y-4" data-testid="all-radii-demo" data-config-count={configs.length}>
      <h3 className="text-sm font-medium">{t('presetSelector.radius')}</h3>
      <div className="space-y-2">
        {configs.map((config) => (
          <ThemeConfigInfoRow key={config.id} config={config} label={config.radius} />
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function AllScalesConfigDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeThemeConfigsWithAllScales(), []);
  return (
    <div className="space-y-4" data-testid="all-scales-demo" data-config-count={configs.length}>
      <h3 className="text-sm font-medium">{t('presetSelector.scale')}</h3>
      <div className="space-y-2">
        {configs.map((config) => (
          <ThemeConfigInfoRow key={config.id} config={config} label={config.scale} />
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function AllAccentsConfigDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeThemeConfigsWithAllAccents(), []);
  return (
    <div className="space-y-4" data-testid="all-accents-demo" data-config-count={configs.length}>
      <h3 className="text-sm font-medium">{t('presetSelector.accentColors')}</h3>
      <div className="grid grid-cols-2 gap-2">
        {configs.map((config) => (
          <div key={config.id} className="flex items-center gap-2 rounded border p-2 text-xs">
            <div
              className="size-4 rounded-full border"
              style={{ backgroundColor: config.accentColor }}
            />
            <span>{config.accentColor}</span>
          </div>
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ PRESET INFO DEMO COMPONENTS ============

function PresetInfoDemo() {
  const { t } = useTranslation();
  const presetInfo = React.useMemo(() => createFakeThemePresetInfo(), []);
  return (
    <div className="space-y-4" data-testid="preset-info-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.presetName')}</h3>
      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center gap-3">
          <div
            className="size-8 rounded-lg border"
            style={{ backgroundColor: presetInfo.colors.primary }}
          />
          <div>
            <p className="font-medium">{presetInfo.name}</p>
            <p className="text-muted-foreground text-xs">{presetInfo.description}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {Object.entries(presetInfo.colors).map(([key, color]) => (
            <div
              key={key}
              className="size-6 rounded border"
              style={{ backgroundColor: color }}
              title={`${key}: ${color}`}
            />
          ))}
        </div>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ CUSTOMIZATION DEMO COMPONENTS ============

function ThemeCustomizationDemo() {
  const { t } = useTranslation();
  const customization = React.useMemo(() => createFakeThemeCustomization(), []);
  return (
    <div className="space-y-4" data-testid="customization-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.customization')}</h3>
      <div className="rounded-lg border p-4" data-customization-id={customization.id}>
        <p className="mb-2 font-medium">{customization.name}</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span>Border Radius: {customization.borderRadius}px</span>
          <span>Spacing: {customization.spacing}</span>
          <span>Font Scale: {customization.fontScale}</span>
          <span>Line Height: {customization.lineHeight}</span>
        </div>
        {customization.customCSS && (
          <pre className="bg-muted mt-2 overflow-x-auto rounded p-2 text-xs">
            {customization.customCSS}
          </pre>
        )}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function ThemeCustomizationsListDemo() {
  const { t } = useTranslation();
  const customizations = React.useMemo(() => createFakeThemeCustomizations(4), []);
  return (
    <div
      className="space-y-4"
      data-testid="customizations-list-demo"
      data-count={customizations.length}
    >
      <h3 className="text-sm font-medium">
        {t('presetSelector.customization')} ({customizations.length})
      </h3>
      <div className="space-y-2">
        {customizations.map((c: ThemeCustomization) => (
          <div key={c.id} className="rounded border p-3 text-xs">
            <span className="font-medium">{c.name}</span> - radius: {c.borderRadius}px, scale:{' '}
            {c.fontScale}
          </div>
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ EXPORT DEMO COMPONENTS ============

function ThemeExportDemo() {
  const { t } = useTranslation();
  const themeExport = React.useMemo(() => createFakeThemeExport(), []);
  return (
    <div className="space-y-4" data-testid="export-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.exportFormat')}</h3>
      <div className="rounded-lg border p-4" data-export-id={themeExport.id}>
        <p className="mb-1 font-medium">{themeExport.name}</p>
        <div className="flex gap-4 text-xs">
          <span>
            {t('presetSelector.exportFormat')}: {themeExport.exportFormat}
          </span>
          <span>
            {t('presetSelector.version')}: {themeExport.version}
          </span>
        </div>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function ThemeExportsListDemo() {
  const { t } = useTranslation();
  const exports = React.useMemo(() => createFakeThemeExports(3), []);
  return (
    <div className="space-y-4" data-testid="exports-list-demo" data-count={exports.length}>
      <h3 className="text-sm font-medium">
        {t('presetSelector.exportFormat')} ({exports.length})
      </h3>
      <div className="space-y-2">
        {exports.map((e: ThemeExport) => (
          <div key={e.id} className="flex items-center justify-between rounded border p-3 text-xs">
            <span className="font-medium">{e.name}</span>
            <span className="bg-muted rounded px-2 py-0.5">{e.exportFormat}</span>
          </div>
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ HISTORY DEMO COMPONENTS ============

function ThemeHistoryDemo() {
  const { t } = useTranslation();
  const history = React.useMemo(() => createFakeThemeHistory(), []);
  return (
    <div className="space-y-4" data-testid="history-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.history')}</h3>
      <div className="rounded-lg border p-4" data-history-id={history.id}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium capitalize">{history.action}</span>
          <span className="text-muted-foreground text-xs">
            {new Date(history.timestamp).toLocaleString()}
          </span>
        </div>
        <p className="mt-1 text-xs">
          {t('presetSelector.presetName')}: {history.configSnapshot.preset}
        </p>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function ThemeHistoriesListDemo() {
  const { t } = useTranslation();
  const histories = React.useMemo(() => createFakeThemeHistories(5), []);
  return (
    <div className="space-y-4" data-testid="histories-list-demo" data-count={histories.length}>
      <h3 className="text-sm font-medium">
        {t('presetSelector.history')} ({histories.length})
      </h3>
      <div className="space-y-2">
        {histories.map((h: ThemeHistory) => (
          <div key={h.id} className="flex items-center justify-between rounded border p-2 text-xs">
            <span className="font-medium capitalize">{h.action}</span>
            <span className="text-muted-foreground">
              {new Date(h.timestamp).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ PREFERENCE DEMO COMPONENTS ============

function ThemePreferenceDemo() {
  const { t } = useTranslation();
  const preference = React.useMemo(() => createFakeThemePreference(), []);
  return (
    <div className="space-y-4" data-testid="preference-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.preference')}</h3>
      <div className="rounded-lg border p-4" data-preference-id={preference.id}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span>
            {t('presetSelector.system')}:{' '}
            {preference.followSystemTheme
              ? t('presetSelector.story.yes', 'Yes')
              : t('presetSelector.story.no', 'No')}
          </span>
          <span>
            {i18n.t('presetSelector.story.autoSwitch', 'Auto Switch:')}{' '}
            {preference.autoSwitch
              ? i18n.t('presetSelector.story.yes', 'Yes')
              : i18n.t('presetSelector.story.no', 'No')}
          </span>
          <span>
            {t('presetSelector.light')}: {preference.preferredLightPreset}
          </span>
          <span>
            {t('presetSelector.dark')}: {preference.preferredDarkPreset}
          </span>
          <span>Dark Start: {preference.darkScheduleStart}</span>
          <span>Dark End: {preference.darkScheduleEnd}</span>
        </div>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function ThemePreferencesListDemo() {
  const { t } = useTranslation();
  const preferences = React.useMemo(() => createFakeThemePreferences(3), []);
  return (
    <div className="space-y-4" data-testid="preferences-list-demo" data-count={preferences.length}>
      <h3 className="text-sm font-medium">
        {t('presetSelector.preference')} ({preferences.length})
      </h3>
      <div className="space-y-2">
        {preferences.map((p: ThemePreference) => (
          <div key={p.id} className="rounded border p-3 text-xs">
            <span>
              {t('presetSelector.light')}: {p.preferredLightPreset} | {t('presetSelector.dark')}:{' '}
              {p.preferredDarkPreset}
            </span>
          </div>
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ MATRIX DEMO COMPONENTS ============

function PresetColorModeMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createFakeThemePresetColorModeMatrix(), []);
  return (
    <div className="space-y-4" data-testid="preset-colormode-matrix-demo">
      <h3 className="text-sm font-medium">
        {t('presetSelector.presetName')} x {t('presetSelector.colorMode')}{' '}
        {t('presetSelector.matrix')}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border p-2 text-left">{t('presetSelector.presetName')}</th>
              {COLOR_MODES.map((mode) => (
                <th key={mode} className="border p-2">
                  {mode}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={THEME_PRESET_IDS[rowIndex]}>
                <td className="border p-2 font-medium">{THEME_PRESET_IDS[rowIndex]}</td>
                {row.map((config) => (
                  <td key={config.id} className="border p-2 text-center">
                    {config.colorMode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function PresetRadiusMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createFakeThemePresetRadiusMatrix(), []);
  return (
    <div className="space-y-4" data-testid="preset-radius-matrix-demo">
      <h3 className="text-sm font-medium">
        {t('presetSelector.presetName')} x {t('presetSelector.radius')} {t('presetSelector.matrix')}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border p-2 text-left">{t('presetSelector.presetName')}</th>
              {THEME_RADII.map((r) => (
                <th key={r} className="border p-2">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={THEME_PRESET_IDS[rowIndex]}>
                <td className="border p-2 font-medium">{THEME_PRESET_IDS[rowIndex]}</td>
                {row.map((config) => (
                  <td key={config.id} className="border p-2 text-center">
                    {config.radius}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function ColorModeScaleMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createFakeThemeColorModeScaleMatrix(), []);
  return (
    <div className="space-y-4" data-testid="colormode-scale-matrix-demo">
      <h3 className="text-sm font-medium">
        {t('presetSelector.colorMode')} x {t('presetSelector.scale')} {t('presetSelector.matrix')}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border p-2 text-left">{t('presetSelector.colorMode')}</th>
              {THEME_SCALES.map((s) => (
                <th key={s} className="border p-2">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={COLOR_MODES[rowIndex]}>
                <td className="border p-2 font-medium">{COLOR_MODES[rowIndex]}</td>
                {row.map((config) => (
                  <td key={config.id} className="border p-2 text-center">
                    {config.scale}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function AccentColorModeMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createFakeThemeAccentColorModeMatrix(), []);
  return (
    <div className="space-y-4" data-testid="accent-colormode-matrix-demo">
      <h3 className="text-sm font-medium">
        {t('presetSelector.accentColors')} x {t('presetSelector.colorMode')}{' '}
        {t('presetSelector.matrix')}
      </h3>
      <div className="max-h-96 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border p-2 text-left">{t('presetSelector.accentColors')}</th>
              {COLOR_MODES.map((mode) => (
                <th key={mode} className="border p-2">
                  {mode}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={ACCENT_COLORS[rowIndex]}>
                <td className="border p-2 font-medium">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: ACCENT_COLORS[rowIndex] }}
                    />
                    {ACCENT_COLORS[rowIndex]}
                  </div>
                </td>
                {row.map((config) => (
                  <td key={config.id} className="border p-2 text-center">
                    {config.colorMode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ ENTERPRISE DEMO COMPONENTS ============

function EnterpriseThemeConfigDemo() {
  const { t } = useTranslation();
  const config = React.useMemo(() => createFakeEnterpriseThemeConfig(), []);
  return (
    <div className="space-y-4" data-testid="enterprise-config-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.enterprise')}</h3>
      <ThemeConfigInfoRow config={config} label={t('presetSelector.enterprise')} />
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function EnterpriseThemeSetDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeEnterpriseThemeSet(), []);
  return (
    <div className="space-y-4" data-testid="enterprise-set-demo" data-config-count={configs.length}>
      <h3 className="text-sm font-medium">
        {t('presetSelector.enterprise')} ({configs.length})
      </h3>
      <div className="space-y-2">
        {configs.map((config, index) => (
          <ThemeConfigInfoRow
            key={config.id}
            config={config}
            label={`Enterprise ${index + 1}: ${config.preset}`}
          />
        ))}
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

function ThemeShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = React.useMemo(() => createFakeThemeShowcase(), []);
  return (
    <div className="space-y-6" data-testid="showcase-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.showcase')}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <ThemeConfigInfoRow config={showcase.default} label={t('presetSelector.default')} />
        <ThemeConfigInfoRow config={showcase.dark} label={t('presetSelector.dark')} />
        <ThemeConfigInfoRow config={showcase.light} label={t('presetSelector.light')} />
        <ThemeConfigInfoRow
          config={showcase.accessible}
          label={i18n.t('presetSelector.story.accessible', 'Accessible')}
        />
        <ThemeConfigInfoRow config={showcase.compact} label={t('presetSelector.compact')} />
        <ThemeConfigInfoRow config={showcase.spacious} label={t('presetSelector.spacious')} />
      </div>
      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-sm font-medium">{t('presetSelector.allPresets')}</h4>
        <div className="grid grid-cols-3 gap-2">
          {showcase.presets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-2 text-xs">
              <div
                className="size-4 rounded border"
                style={{ backgroundColor: preset.colors.primary }}
              />
              <span>{preset.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-sm font-medium">{t('presetSelector.colorMode')}</h4>
        <div className="space-y-2">
          {showcase.colorModes.map((config) => (
            <div key={config.id} className="flex items-center gap-2 text-xs">
              <span className="font-medium">{config.colorMode}</span> - {config.preset}
            </div>
          ))}
        </div>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ CONSTANTS DEMO COMPONENTS ============

function ConstantsOverviewDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6" data-testid="constants-overview-demo">
      <h3 className="text-sm font-medium">
        {t('presetSelector.story.themeConstants', 'Theme Constants')}
      </h3>

      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-xs font-medium">
          {t('presetSelector.allPresets')} ({THEME_PRESET_IDS.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {THEME_PRESET_IDS.map((id) => (
            <span key={id} className="bg-muted rounded px-2 py-0.5 text-xs">
              {id}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-xs font-medium">
          {t('presetSelector.colorMode')} ({COLOR_MODES.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {COLOR_MODES.map((mode) => (
            <span key={mode} className="bg-muted rounded px-2 py-0.5 text-xs">
              {mode}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-xs font-medium">
          {t('presetSelector.contentLayout')} ({CONTENT_LAYOUTS.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {CONTENT_LAYOUTS.map((layout) => (
            <span key={layout} className="bg-muted rounded px-2 py-0.5 text-xs">
              {layout}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-xs font-medium">
          {t('presetSelector.radius')} ({THEME_RADII.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {THEME_RADII.map((r) => (
            <span key={r} className="bg-muted rounded px-2 py-0.5 text-xs">
              {r}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-xs font-medium">
          {t('presetSelector.scale')} ({THEME_SCALES.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {THEME_SCALES.map((s) => (
            <span key={s} className="bg-muted rounded px-2 py-0.5 text-xs">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-xs font-medium">
          {t('presetSelector.sidebar')} ({SIDEBAR_MODES.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {SIDEBAR_MODES.map((m) => (
            <span key={m} className="bg-muted rounded px-2 py-0.5 text-xs">
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-xs font-medium">
          {t('presetSelector.fontFamily')} ({FONT_FAMILIES.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {FONT_FAMILIES.map((f) => (
            <span key={f} className="bg-muted rounded px-2 py-0.5 text-xs">
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-xs font-medium">
          {t('presetSelector.accentColors')} ({ACCENT_COLORS.length})
        </h4>
        <div className="flex flex-wrap gap-1">
          {ACCENT_COLORS.map((color) => (
            <span key={color} className="bg-muted rounded px-2 py-0.5 text-xs">
              {color}
            </span>
          ))}
        </div>
      </div>

      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ TYPE GUARDS DEMO COMPONENT ============

function TypeGuardsDemo() {
  const { t } = useTranslation();

  const testValues = React.useMemo(
    () => ({
      preset: { valid: 'midnight', invalid: 'nope' },
      colorMode: { valid: 'dark', invalid: 'nope' },
      contentLayout: { valid: 'wide', invalid: 'nope' },
      radius: { valid: 'lg', invalid: 'nope' },
      scale: { valid: 'compact', invalid: 'nope' },
      sidebar: { valid: 'floating', invalid: 'nope' },
      fontFamily: { valid: 'mono', invalid: 'nope' },
      accentColor: { valid: 'rose', invalid: 'nope' },
    }),
    []
  );

  return (
    <div className="space-y-4" data-testid="type-guards-demo">
      <h3 className="text-sm font-medium">{t('presetSelector.story.typeGuards', 'Type Guards')}</h3>
      <div className="space-y-2 text-xs">
        <div className="rounded border p-2">
          <span className="font-medium">{t('presetSelector.presetName')}:</span>{' '}
          isThemePreset(&quot;{testValues.preset.valid}&quot;) ={' '}
          <span data-testid="guard-preset-valid">
            {String(isThemePreset(testValues.preset.valid))}
          </span>
          {' | '}
          isThemePreset(&quot;{testValues.preset.invalid}&quot;) ={' '}
          <span data-testid="guard-preset-invalid">
            {String(isThemePreset(testValues.preset.invalid))}
          </span>
        </div>
        <div className="rounded border p-2">
          <span className="font-medium">{t('presetSelector.colorMode')}:</span> isColorMode(&quot;
          {testValues.colorMode.valid}&quot;) = {String(isColorMode(testValues.colorMode.valid))}
          {' | '}
          isColorMode(&quot;{testValues.colorMode.invalid}&quot;) ={' '}
          {String(isColorMode(testValues.colorMode.invalid))}
        </div>
        <div className="rounded border p-2">
          <span className="font-medium">{t('presetSelector.contentLayout')}:</span>{' '}
          isContentLayout(&quot;{testValues.contentLayout.valid}&quot;) ={' '}
          {String(isContentLayout(testValues.contentLayout.valid))}
          {' | '}
          isContentLayout(&quot;{testValues.contentLayout.invalid}&quot;) ={' '}
          {String(isContentLayout(testValues.contentLayout.invalid))}
        </div>
        <div className="rounded border p-2">
          <span className="font-medium">{t('presetSelector.radius')}:</span> isThemeRadius(&quot;
          {testValues.radius.valid}&quot;) = {String(isThemeRadius(testValues.radius.valid))}
          {' | '}
          isThemeRadius(&quot;{testValues.radius.invalid}&quot;) ={' '}
          {String(isThemeRadius(testValues.radius.invalid))}
        </div>
        <div className="rounded border p-2">
          <span className="font-medium">{t('presetSelector.scale')}:</span> isThemeScale(&quot;
          {testValues.scale.valid}&quot;) = {String(isThemeScale(testValues.scale.valid))}
          {' | '}
          isThemeScale(&quot;{testValues.scale.invalid}&quot;) ={' '}
          {String(isThemeScale(testValues.scale.invalid))}
        </div>
        <div className="rounded border p-2">
          <span className="font-medium">{t('presetSelector.sidebar')}:</span> isSidebarMode(&quot;
          {testValues.sidebar.valid}&quot;) = {String(isSidebarMode(testValues.sidebar.valid))}
          {' | '}
          isSidebarMode(&quot;{testValues.sidebar.invalid}&quot;) ={' '}
          {String(isSidebarMode(testValues.sidebar.invalid))}
        </div>
        <div className="rounded border p-2">
          <span className="font-medium">{t('presetSelector.fontFamily')}:</span> isFontFamily(&quot;
          {testValues.fontFamily.valid}&quot;) = {String(isFontFamily(testValues.fontFamily.valid))}
          {' | '}
          isFontFamily(&quot;{testValues.fontFamily.invalid}&quot;) ={' '}
          {String(isFontFamily(testValues.fontFamily.invalid))}
        </div>
        <div className="rounded border p-2">
          <span className="font-medium">{t('presetSelector.accentColors')}:</span>{' '}
          isAccentColor(&quot;{testValues.accentColor.valid}&quot;) ={' '}
          {String(isAccentColor(testValues.accentColor.valid))}
          {' | '}
          isAccentColor(&quot;{testValues.accentColor.invalid}&quot;) ={' '}
          {String(isAccentColor(testValues.accentColor.invalid))}
        </div>
      </div>
      <PresetSelector
        labels={{ label: t('presetSelector.label'), placeholder: t('presetSelector.placeholder') }}
      />
    </div>
  );
}

// ============ META ============

const meta = {
  title: 'Components/Theme Customizer/Preset Selector',
  component: PresetSelectorFrame,
  tags: ['autodocs'],
  args: {
    withLabels: true,
    onValueChange: fn(),
  },
  argTypes: {
    // Content
    withLabels: {
      control: { type: 'boolean' },
      description: i18n.t(
        'presetSelector.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
        'Whether to use localized labels or fallback defaults'
      ),
      table: {
        category: 'Content',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Events
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'presetSelector.argType.calledWhenPresetSelectionChanges',
        'Called when preset selection changes'
      ),
      table: { category: 'Events' },
    },
    // PresetSelector Props Reference:
    // Optional Props:
    // - labels: PresetSelectorLabels object
    //   - label: Section heading text (e.g., "Preset")
    //   - placeholder: Select placeholder text
    //
    // Available Presets:
    // - Underground, Midnight, Blossom, etc.
    // - Each preset defines a complete color palette
    // - Presets are CSS custom property collections
    //
    // State Persistence:
    // - Saves to body data attribute
    // - data-theme-preset="preset-name"
    //
    // Accessibility:
    // - Standard select component behavior
    // - Keyboard navigable options
    // - Screen reader friendly
    //
    // Data Attributes:
    // - data-testid="preset-selector-label": Section label
    // - data-testid="preset-selector-trigger": Select trigger
    // - data-testid="preset-selector-content": Options dropdown
  },
  parameters: {
    msw: { handlers: presetSelectorHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof PresetSelectorFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ BASIC STORIES ============

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="preset-selector"]')).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const label = canvas.getByTestId('preset-selector-label');
    expect(label.textContent).not.toBe('');

    const trigger = canvas.getByTestId('preset-selector-trigger');

    await userEvent.click(trigger);

    const content = await waitFor(() => {
      const element = doc.querySelector<HTMLElement>('[data-testid="preset-selector-content"]');
      if (!element) {
        throw new Error('Select content not found.');
      }
      return element;
    });

    const menu = within(content);

    const option = menu.getByText('Underground');
    await userEvent.click(option);

    await waitFor(() => {
      expect(trigger).toHaveTextContent('Underground');
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ VARIANT STORIES ============

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('presetSelector.story.withLabels', 'With Labels')}
        </p>
        <PresetSelectorFrame withLabels />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('presetSelector.story.withoutLabelsFallback', 'Without Labels (Fallback)')}
        </p>
        <PresetSelectorFrame withLabels={false} />
      </div>
      {THEME_PRESETS.slice(0, 4).map((preset) => (
        <div key={preset.id}>
          <p className="text-muted-foreground mb-2 text-sm font-medium">
            {preset.name} Preset Active
          </p>
          <div data-theme-preset={preset.id}>
            <PresetSelectorFrame withLabels />
          </div>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Narrow Container (200px)</p>
        <div className="border-muted w-[200px] border border-dashed p-2">
          <PresetSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Medium Container (300px)</p>
        <div className="border-muted w-[300px] border border-dashed p-2">
          <PresetSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Wide Container (400px)</p>
        <div className="border-muted w-[400px] border border-dashed p-2">
          <PresetSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('presetSelector.story.fullWidth', 'Full Width')}
        </p>
        <div className="border-muted w-full border border-dashed p-2">
          <PresetSelectorFrame withLabels />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ THEME STORIES ============

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('presetSelector.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nPresetSelectorDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');
    await Default.play?.(context);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('presetSelector.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('presetSelector.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('presetSelector.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FallbackLabels: Story = {
  ...Default,
  name: i18n.t('presetSelector.storyName.fallbackLabels', 'Fallback labels (defaults)'),
  args: {
    ...(Default.args ?? {}),
    withLabels: false,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <PresetSelectorWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="preset-selector-faker"]')
    ).toBeInTheDocument();
    const count = canvasElement
      .querySelector('[data-preset-count]')
      ?.getAttribute('data-preset-count');
    expect(Number(count)).toBe(6);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: presetSelectorHandlers },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(
      canvasElement.querySelector('[data-testid="preset-selector-loading"]')
    ).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="preset-selector-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.loading },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(
      canvasElement.querySelector('[data-testid="preset-selector-loading"]')
    ).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('presetSelector.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.slowResponse },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(
      canvasElement.querySelector('[data-testid="preset-selector-loading"]')
    ).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="preset-selector-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const EmptyPresets: Story = {
  name: i18n.t('presetSelector.storyName.emptyPresets', 'Empty Presets'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.emptyData },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="preset-selector-empty"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('presetSelector.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.badRequest },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('presetSelector.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.unauthorized },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('presetSelector.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.forbidden },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('presetSelector.storyName.error422UnprocessableEntity', 'Error 422: Validation'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.unprocessableEntity },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('presetSelector.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'presetSelector.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.internalServerError },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('presetSelector.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.badGateway },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'presetSelector.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('presetSelector.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const NetworkError: Story = {
  name: i18n.t('presetSelector.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: presetSelectorStatusHandlers.networkError },
  },
  render: () => <AsyncPresetSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="preset-selector-error"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: presetSelectorHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DESIGN REFERENCE ============

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
  name: i18n.t('presetSelector.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('presetSelector.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('preset-selector-trigger');

    // Test that trigger is keyboard focusable
    trigger.focus();
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });

    // Verify trigger has accessible role
    expect(trigger.getAttribute('role')).toBe('combobox');

    // Test opening select with Enter key
    await userEvent.keyboard('{Enter}');

    const content = await waitFor(() => {
      const element = doc.querySelector<HTMLElement>('[data-testid="preset-selector-content"]');
      if (!element) {
        throw new Error('Select content not found.');
      }
      return element;
    });

    // Verify listbox has proper role
    expect(content.getAttribute('role')).toBe('listbox');

    // Test keyboard navigation within options
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    // Test selection with Enter key
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      const contentAfterSelect = doc.querySelector<HTMLElement>(
        '[data-testid="preset-selector-content"]'
      );
      expect(contentAfterSelect).not.toBeInTheDocument();
    });

    // Reopen to test Escape key
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      const element = doc.querySelector<HTMLElement>('[data-testid="preset-selector-content"]');
      expect(element).toBeInTheDocument();
    });

    // Test Escape key closes select
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      const contentAfterEsc = doc.querySelector<HTMLElement>(
        '[data-testid="preset-selector-content"]'
      );
      expect(contentAfterEsc).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: THEME CONFIG STORIES ============

export const FactoryDefaultConfig: Story = {
  name: i18n.t('presetSelector.storyName.factoryDefaultConfig', 'Factory: Default Theme Config'),
  render: () => <DefaultThemeConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('default-config-demo')).toBeInTheDocument();
    const row = canvas.getByTestId('theme-config-row');
    expect(row).toBeInTheDocument();
    expect(row.getAttribute('data-config-id')).toBeTruthy();
  },
};

export const FactoryDarkConfig: Story = {
  name: i18n.t('presetSelector.storyName.factoryDarkConfig', 'Factory: Dark Theme Config'),
  render: () => <DarkThemeConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('dark-config-demo')).toBeInTheDocument();
    const row = canvas.getByTestId('theme-config-row');
    expect(row).toBeInTheDocument();
  },
};

export const FactoryLightConfig: Story = {
  name: i18n.t('presetSelector.storyName.factoryLightConfig', 'Factory: Light Theme Config'),
  render: () => <LightThemeConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('light-config-demo')).toBeInTheDocument();
    const row = canvas.getByTestId('theme-config-row');
    expect(row).toBeInTheDocument();
  },
};

export const FactoryAccessibleConfig: Story = {
  name: i18n.t(
    'presetSelector.storyName.factoryAccessibleConfig',
    'Factory: Accessible Theme Config'
  ),
  render: () => <AccessibleThemeConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('accessible-config-demo')).toBeInTheDocument();
    const row = canvas.getByTestId('theme-config-row');
    expect(row).toBeInTheDocument();
  },
};

export const FactoryCompactConfig: Story = {
  name: i18n.t('presetSelector.storyName.factoryCompactConfig', 'Factory: Compact Theme Config'),
  render: () => <CompactThemeConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('compact-config-demo')).toBeInTheDocument();
    const row = canvas.getByTestId('theme-config-row');
    expect(row).toBeInTheDocument();
  },
};

export const FactorySpaciousConfig: Story = {
  name: i18n.t('presetSelector.storyName.factorySpaciousConfig', 'Factory: Spacious Theme Config'),
  render: () => <SpaciousThemeConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('spacious-config-demo')).toBeInTheDocument();
    const row = canvas.getByTestId('theme-config-row');
    expect(row).toBeInTheDocument();
  },
};

export const FactorySingleConfig: Story = {
  name: i18n.t('presetSelector.storyName.factorySingleConfig', 'Factory: Single Random Config'),
  render: () => <SingleThemeConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-config-demo')).toBeInTheDocument();
    const row = canvas.getByTestId('theme-config-row');
    expect(row).toBeInTheDocument();
  },
};

export const FactoryBulkConfigs: Story = {
  name: i18n.t('presetSelector.storyName.factoryBulkConfigs', 'Factory: Bulk Configs (5)'),
  render: () => <BulkThemeConfigsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('bulk-configs-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-config-count')).toBe('5');
    const rows = canvasElement.querySelectorAll('[data-testid="theme-config-row"]');
    expect(rows.length).toBe(5);
  },
};

export const FactoryAllPresets: Story = {
  name: i18n.t('presetSelector.storyName.factoryAllPresets', 'Factory: All Presets'),
  render: () => <AllPresetsConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('all-presets-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-config-count')).toBe(String(THEME_PRESET_IDS.length));
  },
};

export const FactoryAllColorModes: Story = {
  name: i18n.t('presetSelector.storyName.factoryAllColorModes', 'Factory: All Color Modes'),
  render: () => <AllColorModesConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('all-color-modes-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-config-count')).toBe(String(COLOR_MODES.length));
  },
};

export const FactoryAllRadii: Story = {
  name: i18n.t('presetSelector.storyName.factoryAllRadii', 'Factory: All Radii'),
  render: () => <AllRadiiConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('all-radii-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-config-count')).toBe(String(THEME_RADII.length));
  },
};

export const FactoryAllScales: Story = {
  name: i18n.t('presetSelector.storyName.factoryAllScales', 'Factory: All Scales'),
  render: () => <AllScalesConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('all-scales-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-config-count')).toBe(String(THEME_SCALES.length));
  },
};

export const FactoryAllAccents: Story = {
  name: i18n.t('presetSelector.storyName.factoryAllAccents', 'Factory: All Accent Colors'),
  render: () => <AllAccentsConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('all-accents-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-config-count')).toBe(String(ACCENT_COLORS.length));
  },
};

// ============ FACTORY: PRESET INFO STORIES ============

export const FactoryPresetInfo: Story = {
  name: i18n.t('presetSelector.storyName.factoryPresetInfo', 'Factory: Preset Info'),
  render: () => <PresetInfoDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('preset-info-demo')).toBeInTheDocument();
  },
};

// ============ FACTORY: CUSTOMIZATION STORIES ============

export const FactoryCustomization: Story = {
  name: i18n.t('presetSelector.storyName.factoryCustomization', 'Factory: Customization'),
  render: () => <ThemeCustomizationDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('customization-demo');
    expect(container).toBeInTheDocument();
    expect(container.querySelector('[data-customization-id]')).toBeInTheDocument();
  },
};

export const FactoryCustomizationsList: Story = {
  name: i18n.t(
    'presetSelector.storyName.factoryCustomizationsList',
    'Factory: Customizations List'
  ),
  render: () => <ThemeCustomizationsListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('customizations-list-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-count')).toBe('4');
  },
};

// ============ FACTORY: EXPORT STORIES ============

export const FactoryExport: Story = {
  name: i18n.t('presetSelector.storyName.factoryExport', 'Factory: Theme Export'),
  render: () => <ThemeExportDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('export-demo');
    expect(container).toBeInTheDocument();
    expect(container.querySelector('[data-export-id]')).toBeInTheDocument();
  },
};

export const FactoryExportsList: Story = {
  name: i18n.t('presetSelector.storyName.factoryExportsList', 'Factory: Exports List'),
  render: () => <ThemeExportsListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('exports-list-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-count')).toBe('3');
  },
};

// ============ FACTORY: HISTORY STORIES ============

export const FactoryHistory: Story = {
  name: i18n.t('presetSelector.storyName.factoryHistory', 'Factory: Theme History'),
  render: () => <ThemeHistoryDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('history-demo');
    expect(container).toBeInTheDocument();
    expect(container.querySelector('[data-history-id]')).toBeInTheDocument();
  },
};

export const FactoryHistoriesList: Story = {
  name: i18n.t('presetSelector.storyName.factoryHistoriesList', 'Factory: Histories List'),
  render: () => <ThemeHistoriesListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('histories-list-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-count')).toBe('5');
  },
};

// ============ FACTORY: PREFERENCE STORIES ============

export const FactoryPreference: Story = {
  name: i18n.t('presetSelector.storyName.factoryPreference', 'Factory: Theme Preference'),
  render: () => <ThemePreferenceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('preference-demo');
    expect(container).toBeInTheDocument();
    expect(container.querySelector('[data-preference-id]')).toBeInTheDocument();
  },
};

export const FactoryPreferencesList: Story = {
  name: i18n.t('presetSelector.storyName.factoryPreferencesList', 'Factory: Preferences List'),
  render: () => <ThemePreferencesListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('preferences-list-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-count')).toBe('3');
  },
};

// ============ FACTORY: MATRIX STORIES ============

export const FactoryPresetColorModeMatrix: Story = {
  name: i18n.t(
    'presetSelector.storyName.factoryPresetColorModeMatrix',
    'Factory: Preset x Color Mode Matrix'
  ),
  render: () => <PresetColorModeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('preset-colormode-matrix-demo')).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(THEME_PRESET_IDS.length);
  },
};

export const FactoryPresetRadiusMatrix: Story = {
  name: i18n.t(
    'presetSelector.storyName.factoryPresetRadiusMatrix',
    'Factory: Preset x Radius Matrix'
  ),
  render: () => <PresetRadiusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('preset-radius-matrix-demo')).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(THEME_PRESET_IDS.length);
  },
};

export const FactoryColorModeScaleMatrix: Story = {
  name: i18n.t(
    'presetSelector.storyName.factoryColorModeScaleMatrix',
    'Factory: Color Mode x Scale Matrix'
  ),
  render: () => <ColorModeScaleMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('colormode-scale-matrix-demo')).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(COLOR_MODES.length);
  },
};

export const FactoryAccentColorModeMatrix: Story = {
  name: i18n.t(
    'presetSelector.storyName.factoryAccentColorModeMatrix',
    'Factory: Accent x Color Mode Matrix'
  ),
  render: () => <AccentColorModeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('accent-colormode-matrix-demo')).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(ACCENT_COLORS.length);
  },
};

// ============ FACTORY: ENTERPRISE STORIES ============

export const FactoryEnterpriseConfig: Story = {
  name: i18n.t('presetSelector.storyName.factoryEnterpriseConfig', 'Factory: Enterprise Config'),
  render: () => <EnterpriseThemeConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('enterprise-config-demo')).toBeInTheDocument();
    const row = canvas.getByTestId('theme-config-row');
    expect(row).toBeInTheDocument();
  },
};

export const FactoryEnterpriseSet: Story = {
  name: i18n.t('presetSelector.storyName.factoryEnterpriseSet', 'Factory: Enterprise Set'),
  render: () => <EnterpriseThemeSetDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('enterprise-set-demo');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('data-config-count')).toBe('6');
  },
};

export const FactoryShowcase: Story = {
  name: i18n.t('presetSelector.storyName.factoryShowcase', 'Factory: Theme Showcase'),
  render: () => <ThemeShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('showcase-demo')).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('[data-testid="theme-config-row"]');
    expect(rows.length).toBe(6);
  },
};

// ============ FACTORY: CONSTANTS STORIES ============

export const FactoryConstants: Story = {
  name: i18n.t('presetSelector.storyName.factoryConstants', 'Factory: All Constants'),
  render: () => <ConstantsOverviewDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constants-overview-demo')).toBeInTheDocument();
    // Verify each constant section rendered
    const presetBadges = canvasElement.querySelectorAll(
      '[data-testid="constants-overview-demo"] .bg-muted'
    );
    expect(presetBadges.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: TYPE GUARDS STORIES ============

export const FactoryTypeGuards: Story = {
  name: i18n.t('presetSelector.storyName.factoryTypeGuards', 'Factory: Type Guards'),
  render: () => <TypeGuardsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('type-guards-demo')).toBeInTheDocument();
    // Verify type guard results
    expect(canvas.getByTestId('guard-preset-valid')).toHaveTextContent('true');
    expect(canvas.getByTestId('guard-preset-invalid')).toHaveTextContent('false');
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('presetSelector.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: presetSelectorStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('presetSelector.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: presetSelectorStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('presetSelector.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: presetSelectorStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

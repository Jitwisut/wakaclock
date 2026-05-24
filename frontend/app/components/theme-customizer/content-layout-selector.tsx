'use client';

import * as React from 'react';

import { useThemeConfig } from '@/components/active-theme';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ThemeContentLayout } from '@/lib/themes';

/** Labels configuration for ContentLayoutSelector component */
export type ContentLayoutSelectorLabels = {
  /** Label for centered layout option */
  centered?: string;
  /** Label for full-width layout option */
  full?: string;
  /** Main label for the selector */
  label?: string;
};

/**
 * ContentLayoutSelector component props
 *
 * @description Props for the content layout toggle.
 */
export type ContentLayoutSelectorProps = {
  /** Custom labels for the component */
  labels?: ContentLayoutSelectorLabels;
  /**
   * Custom test ID for testing
   * @default 'content-layout-selector'
   */
  testId?: string;
} & React.ComponentPropsWithoutRef<'div'>;

/**
 * ContentLayoutSelector component - Content width toggle
 *
 * @description
 * A toggle group for switching between full-width and centered
 * content layouts. Only visible on large screens.
 *
 * ## Features
 * - **Two Layouts**: Full-width vs centered/boxed
 * - **Desktop Only**: Hidden on mobile (lg:flex)
 * - **i18n Ready**: Customizable labels
 *
 * ## Use Cases
 * - Reading comfort: Narrower content on wide screens
 * - Dashboard layout: Full-width for data-dense views
 * - User preference: Personal reading width
 *
 * @example
 * ```tsx
 * <ContentLayoutSelector labels={{ full: 'Wide', centered: 'Narrow' }} />
 * ```
 */
const ContentLayoutSelector = React.forwardRef<HTMLDivElement, ContentLayoutSelectorProps>(
  ({ labels, testId = 'content-layout-selector', ...props }, ref) => {
    const { theme, setTheme } = useThemeConfig();
    const labelId = React.useId();

    const label = labels?.label ?? 'Content layout';
    const full = labels?.full ?? 'Full';
    const centered = labels?.centered ?? 'Centered';

    return (
      <div
        className="hidden flex-col gap-4 lg:flex"
        data-slot="content-layout-selector"
        data-testid={testId}
        ref={ref}
        {...props}
      >
        <Label data-testid={`${testId}-label`} id={labelId}>
          {label}
        </Label>
        <ToggleGroup
          aria-labelledby={labelId}
          className="*:border-input w-full gap-4 *:rounded-md *:border"
          data-testid={`${testId}-group`}
          onValueChange={(value) => {
            if (!value) return;
            setTheme({ ...theme, contentLayout: value as ThemeContentLayout });
          }}
          type="single"
          value={theme.contentLayout}
        >
          <ToggleGroupItem data-testid={`${testId}-full`} value="full" variant="outline">
            {full}
          </ToggleGroupItem>
          <ToggleGroupItem
            className="data-[variant=outline]:border-l-1"
            data-testid={`${testId}-centered`}
            value="centered"
            variant="outline"
          >
            {centered}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  }
);

ContentLayoutSelector.displayName = 'ContentLayoutSelector';

export { ContentLayoutSelector };

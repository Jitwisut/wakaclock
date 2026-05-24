'use client';

import * as React from 'react';

import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

import { ColorModeSelector, type ColorModeSelectorLabels } from './color-mode-selector';
import { ContentLayoutSelector, type ContentLayoutSelectorLabels } from './content-layout-selector';
import { PresetSelector } from './preset-selector';
import { ThemeRadiusSelector } from './radius-selector';
import { ResetThemeButton } from './reset-theme';
import { ThemeScaleSelector } from './scale-selector';
import { SidebarModeSelector } from './sidebar-mode-selector';

/** Labels configuration for ThemeCustomizerPanel component */
export type ThemeCustomizerPanelLabels = {
  /** Labels for color mode selector */
  colorModeSelector?: ColorModeSelectorLabels;
  /** Labels for content layout selector */
  contentLayoutSelector?: ContentLayoutSelectorLabels;
  /** Aria label for trigger button */
  triggerAriaLabel?: string;
};

/**
 * ThemeCustomizerPanel component props
 *
 * @description Props for the theme customizer dropdown panel.
 */
export type ThemeCustomizerPanelProps = {
  /** Whether the panel is open by default */
  defaultOpen?: boolean;
  /** Custom labels for the component */
  labels?: ThemeCustomizerPanelLabels;
  /** Callback when panel open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Controlled open state */
  open?: boolean;
  /**
   * Custom test ID for testing
   * @default 'theme-customizer-panel'
   */
  testId?: string;
};

/**
 * ThemeCustomizerPanel component - Theme customization dropdown
 *
 * @description
 * A dropdown panel containing all theme customization controls
 * including presets, scale, radius, color mode, layout, and sidebar mode.
 *
 * ## Features
 * - **Theme Presets**: Color scheme selection
 * - **Scale Selector**: UI density control
 * - **Radius Selector**: Border radius options
 * - **Color Mode**: Light/dark toggle
 * - **Content Layout**: Layout variations
 * - **Sidebar Mode**: Sidebar display options
 * - **Reset Button**: Restore defaults
 *
 * ## Use Cases
 * - User preference settings
 * - Dashboard customization
 * - Theme preview interfaces
 *
 * @example
 * ```tsx
 * <ThemeCustomizerPanel
 *   labels={{ triggerAriaLabel: 'Open settings' }}
 * />
 * ```
 */
const ThemeCustomizerPanel = React.forwardRef<HTMLDivElement, ThemeCustomizerPanelProps>(
  ({ labels, defaultOpen, open, onOpenChange, testId = 'theme-customizer-panel' }, ref) => {
    const isMobile = useIsMobile();
    const triggerAriaLabel = labels?.triggerAriaLabel ?? 'Theme customizer';

    return (
      <div data-slot="theme-customizer-panel" data-testid={testId} ref={ref}>
        <DropdownMenu defaultOpen={defaultOpen} onOpenChange={onOpenChange} open={open}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={triggerAriaLabel}
              data-testid="theme-customizer-panel-trigger"
              size="icon"
              variant="ghost"
            >
              <Settings className="animate-tada" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isMobile ? 'center' : 'end'}
            className="me-4 w-72 p-4 shadow-xl lg:me-0"
            data-testid="theme-customizer-panel-menu"
          >
            <div className="grid space-y-4" data-testid="theme-customizer-panel-controls">
              <PresetSelector />
              <ThemeScaleSelector />
              <ThemeRadiusSelector />
              <ColorModeSelector labels={labels?.colorModeSelector} />
              <ContentLayoutSelector labels={labels?.contentLayoutSelector} />
              <SidebarModeSelector />
            </div>
            <ResetThemeButton />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

ThemeCustomizerPanel.displayName = 'ThemeCustomizerPanel';

export { ThemeCustomizerPanel };

'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';
import { useSidebar } from '@/components/ui/sidebar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/** Labels configuration for SidebarModeSelector component */
export type SidebarModeSelectorLabels = {
  /** Label for default sidebar mode */
  default?: string;
  /** Label for icon-only sidebar mode */
  icon?: string;
  /** Main label for the selector */
  label?: string;
};

/**
 * SidebarModeSelector component props
 *
 * @description Props for the sidebar mode toggle.
 */
export type SidebarModeSelectorProps = {
  /** Custom labels for the component */
  labels?: SidebarModeSelectorLabels;
  /**
   * Custom test ID for testing
   * @default 'sidebar-mode-selector'
   */
  testId?: string;
} & React.ComponentPropsWithoutRef<'div'>;

/**
 * SidebarModeSelector component - Sidebar display mode toggle
 *
 * @description
 * A toggle group for switching between expanded sidebar
 * and icon-only (collapsed) sidebar modes.
 *
 * ## Features
 * - **Two Modes**: Default (expanded) vs Icon (collapsed)
 * - **Desktop Only**: Hidden on mobile (lg:flex)
 * - **Persistent**: Works with sidebar state management
 *
 * ## Use Cases
 * - Maximize content area: Icon mode for more space
 * - Navigation clarity: Default mode with labels
 * - User preference: Personal workflow style
 *
 * @example
 * ```tsx
 * <SidebarModeSelector labels={{ default: 'Expanded', icon: 'Mini' }} />
 * ```
 */
const SidebarModeSelector = React.forwardRef<HTMLDivElement, SidebarModeSelectorProps>(
  ({ labels, testId = 'sidebar-mode-selector', ...props }, ref) => {
    const { open, setOpen } = useSidebar();
    const labelId = React.useId();

    const label = labels?.label ?? 'Sidebar mode:';
    const defaultLabel = labels?.default ?? 'Default';
    const iconLabel = labels?.icon ?? 'Icon';

    return (
      <div
        className="hidden flex-col gap-4 lg:flex"
        data-slot="sidebar-mode-selector"
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
            setOpen(value === 'default');
          }}
          type="single"
          value={open ? 'default' : 'icon'}
        >
          <ToggleGroupItem data-testid={`${testId}-default`} value="default" variant="outline">
            {defaultLabel}
          </ToggleGroupItem>
          <ToggleGroupItem
            className="data-[variant=outline]:border-l-1"
            data-testid={`${testId}-icon`}
            value="icon"
            variant="outline"
          >
            {iconLabel}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  }
);

SidebarModeSelector.displayName = 'SidebarModeSelector';

export { SidebarModeSelector };

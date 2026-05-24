import * as React from 'react';

import { icons, type LucideIcon, type LucideProps } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Icon component props
 *
 * @description Props for the dynamic Lucide icon renderer.
 */
export interface IconProps extends Omit<LucideProps, 'ref'> {
  /** Name of the Lucide icon to render */
  name: string;
  /**
   * Custom test ID for testing
   * @default 'icon'
   */
  testId?: string;
  /** Accessible title for the icon */
  title?: string;
}

const iconMap: Record<string, LucideIcon> = icons;

/**
 * Icon component - Dynamic Lucide icon renderer
 *
 * @description
 * A wrapper component for rendering Lucide icons dynamically by name.
 * Includes proper accessibility handling for decorative vs informative icons.
 *
 * ## Features
 * - **Dynamic Rendering**: Render any Lucide icon by name
 * - **Accessibility**: Auto-manages aria-hidden for decorative icons
 * - **Full Props**: Supports all Lucide icon props
 *
 * ## Use Cases
 * - Dynamic icon selection from data
 * - Icon pickers and configurators
 * - Data-driven UI components
 *
 * ## Accessibility
 * - aria-hidden="true" for decorative icons
 * - Supports aria-label for informative icons
 * - Supports title prop for tooltips
 *
 * @example
 * ```tsx
 * // Decorative icon (no label)
 * <Icon name="Settings" className="size-4" />
 *
 * // Informative icon (with label)
 * <Icon name="AlertCircle" aria-label="Warning" />
 *
 * // With title for tooltip
 * <Icon name="Info" title="More information" />
 *
 * // Dynamic from data
 * const iconName = config.icon; // "Home"
 * <Icon name={iconName} />
 * ```
 */
const Icon = React.forwardRef<React.ComponentRef<LucideIcon>, IconProps>(
  ({ className, name, testId = 'icon', ...props }, ref) => {
    const LucideIcon = iconMap[name];

    if (!LucideIcon) {
      return null;
    }

    const ariaHiddenProp = props['aria-hidden'];
    const ariaHidden =
      ariaHiddenProp != null
        ? ariaHiddenProp === true || ariaHiddenProp === 'true'
        : props['aria-label'] == null && props['aria-labelledby'] == null && props.title == null;

    return (
      <LucideIcon
        className={cn(className)}
        data-slot="icon"
        data-testid={testId}
        ref={ref}
        {...props}
        aria-hidden={ariaHidden ? true : undefined}
        focusable={ariaHidden ? false : undefined}
      />
    );
  }
);
Icon.displayName = 'Icon';

export { Icon };

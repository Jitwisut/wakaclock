'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '@/lib/utils';

/**
 * Switch component props
 *
 * @description Props for the Switch toggle component.
 * @see https://www.radix-ui.com/primitives/docs/components/switch
 */
export type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  /** Controlled checked state */
  checked?: boolean;
  /**
   * Custom test ID for testing
   * @default 'switch'
   */
  testId?: string;
};

/**
 * Switch component - Toggleable on/off control
 *
 * @description
 * A toggle switch for binary on/off choices. Visually distinct
 * from checkboxes, better for settings and immediate-effect toggles.
 *
 * ## Features
 * - **Immediate Feedback**: Visual state change on toggle
 * - **Keyboard Accessible**: Space to toggle when focused
 * - **Form Integration**: Works with form libraries
 * - **Controlled/Uncontrolled**: Both modes supported
 *
 * ## Use Cases
 * - Settings toggles (notifications, dark mode)
 * - Feature toggles
 * - Immediate-effect options
 * - Mobile-style preferences
 *
 * ## vs Checkbox
 * - **Switch**: For settings with immediate effect, mobile UX
 * - **Checkbox**: For form fields, multi-select, accept terms
 *
 * ## Accessibility
 * - `role="switch"` with `aria-checked`
 * - Space key to toggle
 * - Focus indicators
 *
 * @example
 * ```tsx
 * // Basic switch
 * <Switch />
 *
 * // Controlled switch
 * const [enabled, setEnabled] = React.useState(false);
 * <Switch checked={enabled} onCheckedChange={setEnabled} />
 *
 * // With label
 * <div className="flex items-center space-x-2">
 *   <Switch id="notifications" />
 *   <Label htmlFor="notifications">Enable notifications</Label>
 * </div>
 *
 * // Disabled
 * <Switch disabled />
 *
 * // In settings form
 * <div className="flex items-center justify-between">
 *   <div>
 *     <Label>Dark Mode</Label>
 *     <p className="text-sm text-muted-foreground">
 *       Enable dark theme
 *     </p>
 *   </div>
 *   <Switch checked={darkMode} onCheckedChange={setDarkMode} />
 * </div>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/switch
 */
const Switch = React.forwardRef<React.ComponentRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  ({ className, checked, testId = 'switch', ...props }, ref) => {
    return (
      <SwitchPrimitive.Root
        ref={ref}
        data-slot="switch"
        data-testid={testId}
        data-state={checked !== undefined ? (checked ? 'checked' : 'unchecked') : undefined}
        checked={checked}
        className={cn(
          'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          data-testid={`${testId}-thumb`}
          className={cn(
            'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0'
          )}
        />
      </SwitchPrimitive.Root>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };

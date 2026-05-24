import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * NativeSelect component props
 *
 * @description Props for the NativeSelect dropdown component.
 */
export type NativeSelectProps = React.ComponentProps<'select'> & {
  /**
   * Custom test ID for testing
   * @default 'native-select'
   */
  testId?: string;
};

/**
 * NativeSelect component - Styled native HTML select
 *
 * @description
 * A styled native HTML select element providing accessible
 * dropdown functionality with keyboard navigation.
 *
 * ## Features
 * - **Native Behavior**: Full mobile/OS integration
 * - **Keyboard Accessible**: Native keyboard support
 * - **Validation States**: Error styling via aria-invalid
 * - **Custom Chevron**: Styled dropdown indicator
 *
 * ## When to Use
 * - Mobile-first applications (better UX than custom selects)
 * - Long option lists (native scroll behavior)
 * - Form fields requiring native validation
 *
 * ## When to Use Select Component Instead
 * - Need custom styling for options
 * - Require multi-select
 * - Need searchable options
 *
 * @example
 * ```tsx
 * // Basic select
 * <NativeSelect>
 *   <NativeSelectOption value="">Select a fruit</NativeSelectOption>
 *   <NativeSelectOption value="apple">Apple</NativeSelectOption>
 *   <NativeSelectOption value="banana">Banana</NativeSelectOption>
 * </NativeSelect>
 *
 * // With option groups
 * <NativeSelect required>
 *   <NativeSelectOptGroup label="Fruits">
 *     <NativeSelectOption value="apple">Apple</NativeSelectOption>
 *   </NativeSelectOptGroup>
 *   <NativeSelectOptGroup label="Vegetables">
 *     <NativeSelectOption value="carrot">Carrot</NativeSelectOption>
 *   </NativeSelectOptGroup>
 * </NativeSelect>
 *
 * // With error state
 * <NativeSelect aria-invalid="true">
 *   ...
 * </NativeSelect>
 * ```
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    { className, required, testId = 'native-select', 'aria-invalid': ariaInvalid, ...props },
    ref
  ) => {
    return (
      <div
        className="group/native-select relative w-fit has-[select:disabled]:opacity-50"
        data-slot="native-select-wrapper"
        data-testid="native-select-wrapper"
      >
        <select
          ref={ref}
          data-slot="native-select"
          data-testid={testId}
          required={required}
          aria-required={required ? true : undefined}
          aria-invalid={ariaInvalid}
          className={cn(
            'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 dark:hover:bg-input/50 h-9 w-full min-w-0 appearance-none rounded-md border bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
            className
          )}
          {...props}
        />
        <ChevronDownIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 opacity-50 select-none"
          aria-hidden="true"
          data-slot="native-select-icon"
          data-testid="native-select-icon"
        />
      </div>
    );
  }
);
NativeSelect.displayName = 'NativeSelect';

/** NativeSelectOption component props */
export type NativeSelectOptionProps = React.ComponentProps<'option'>;

/** NativeSelectOption component - option element for native select */
const NativeSelectOption = React.forwardRef<HTMLOptionElement, NativeSelectOptionProps>(
  ({ ...props }, ref) => {
    return (
      <option
        ref={ref}
        data-slot="native-select-option"
        data-testid="native-select-option"
        {...props}
      />
    );
  }
);
NativeSelectOption.displayName = 'NativeSelectOption';

/** NativeSelectOptGroup component props */
export type NativeSelectOptGroupProps = React.ComponentProps<'optgroup'>;

/** NativeSelectOptGroup component - group of related options */
const NativeSelectOptGroup = React.forwardRef<HTMLOptGroupElement, NativeSelectOptGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <optgroup
        ref={ref}
        data-slot="native-select-optgroup"
        data-testid="native-select-optgroup"
        className={cn(className)}
        {...props}
      />
    );
  }
);
NativeSelectOptGroup.displayName = 'NativeSelectOptGroup';

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };

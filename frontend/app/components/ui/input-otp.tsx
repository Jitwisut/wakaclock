'use client';

import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { MinusIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * InputOTP component props
 *
 * @description Props for the InputOTP one-time password component.
 * @see https://www.npmjs.com/package/input-otp
 */
export type InputOTPProps = React.ComponentProps<typeof OTPInput> & {
  /** Additional container class name */
  containerClassName?: string;
  /**
   * Custom test ID for testing
   * @default 'input-otp'
   */
  testId?: string;
};

/**
 * InputOTP component - One-time password input field
 *
 * @description
 * A specialized input for entering one-time passwords or verification
 * codes. Features automatic focus management and visual feedback.
 *
 * ## Features
 * - **Auto-focus**: Moves focus to next slot automatically
 * - **Caret Animation**: Blinking caret for active slot
 * - **Paste Support**: Handles paste of full OTP codes
 * - **Separators**: Visual grouping with InputOTPSeparator
 * - **Validation**: Built-in error states via aria-invalid
 *
 * ## Use Cases
 * - Two-factor authentication
 * - Phone number verification
 * - Email confirmation codes
 * - PIN entry
 *
 * ## Accessibility
 * - Default aria-label for screen readers
 * - Visual caret indicator
 * - Keyboard navigation (Tab, Backspace)
 *
 * @example
 * ```tsx
 * // Basic 6-digit OTP
 * <InputOTP maxLength={6}>
 *   <InputOTPGroup>
 *     <InputOTPSlot index={0} />
 *     <InputOTPSlot index={1} />
 *     <InputOTPSlot index={2} />
 *   </InputOTPGroup>
 *   <InputOTPSeparator />
 *   <InputOTPGroup>
 *     <InputOTPSlot index={3} />
 *     <InputOTPSlot index={4} />
 *     <InputOTPSlot index={5} />
 *   </InputOTPGroup>
 * </InputOTP>
 *
 * // Controlled with onChange
 * const [value, setValue] = useState('');
 * <InputOTP value={value} onChange={setValue} maxLength={4}>
 *   <InputOTPGroup>
 *     {[0, 1, 2, 3].map(i => (
 *       <InputOTPSlot key={i} index={i} />
 *     ))}
 *   </InputOTPGroup>
 * </InputOTP>
 *
 * // With error state
 * <InputOTPSlot index={0} aria-invalid />
 * ```
 *
 * @see https://www.npmjs.com/package/input-otp
 */
const InputOTP = React.forwardRef<React.ComponentRef<typeof OTPInput>, InputOTPProps>(
  ({ className, containerClassName, testId = 'input-otp', ...props }, ref) => {
    return (
      <OTPInput
        ref={ref}
        data-slot="input-otp"
        data-testid={testId}
        containerClassName={cn(
          'flex items-center gap-2 has-disabled:opacity-50',
          containerClassName
        )}
        className={cn('disabled:cursor-not-allowed', className)}
        aria-label={props['aria-label'] ?? 'One-time password input'}
        {...props}
      />
    );
  }
);
InputOTP.displayName = 'InputOTP';

/** InputOTPGroup component props */
export type InputOTPGroupProps = React.ComponentProps<'div'>;

/** InputOTPGroup component - groups OTP slots together */
const InputOTPGroup = React.forwardRef<HTMLDivElement, InputOTPGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="input-otp-group"
        data-testid="input-otp-group"
        className={cn('flex items-center', className)}
        {...props}
      />
    );
  }
);
InputOTPGroup.displayName = 'InputOTPGroup';

/** InputOTPSlot component props */
export type InputOTPSlotProps = React.ComponentProps<'div'> & {
  /** Slot index in the OTP input */
  index: number;
};

/** InputOTPSlot component - individual OTP input slot */
const InputOTPSlot = React.forwardRef<HTMLDivElement, InputOTPSlotProps>(
  ({ index, className, ...props }, ref) => {
    const inputOTPContext = React.useContext(OTPInputContext);
    const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

    return (
      <div
        ref={ref}
        data-slot="input-otp-slot"
        data-testid="input-otp-slot"
        data-active={isActive}
        className={cn(
          'data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive dark:bg-input/30 border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]',
          className
        )}
        {...props}
      >
        {char}
        {hasFakeCaret && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
          </div>
        )}
      </div>
    );
  }
);
InputOTPSlot.displayName = 'InputOTPSlot';

/** InputOTPSeparator component props */
export type InputOTPSeparatorProps = React.ComponentProps<'div'>;

/** InputOTPSeparator component - separator between OTP slot groups */
const InputOTPSeparator = React.forwardRef<HTMLDivElement, InputOTPSeparatorProps>(
  ({ ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="input-otp-separator"
        data-testid="input-otp-separator"
        role="separator"
        {...props}
      >
        <MinusIcon aria-hidden="true" />
      </div>
    );
  }
);
InputOTPSeparator.displayName = 'InputOTPSeparator';

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };

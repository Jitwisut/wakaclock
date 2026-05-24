'use client';

import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import React, { createContext, forwardRef, useContext, useEffect, useRef, useState } from 'react';

/** Context type for PromptInput state management */
interface PromptInputContextType {
  /** Whether the input is in a loading state */
  isLoading: boolean;
  /** Current input value */
  value: string;
  /** Function to update the input value */
  setValue: (value: string) => void;
  /** Maximum height for the textarea */
  maxHeight: number | string;
  /** Callback fired on submit */
  onSubmit?: () => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: '',
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});

/**
 * Hook to access PromptInput context
 * @throws Error if used outside of Input component
 */
function usePromptInput(): PromptInputContextType {
  const context = useContext(PromptInputContext);
  if (!context) {
    throw new Error('usePromptInput must be used within a Input');
  }
  return context;
}
usePromptInput.displayName = 'usePromptInput';

/**
 * PromptInput component props
 *
 * @description Props for the prompt input container component.
 */
export interface PromptInputProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the input is in a loading state */
  isLoading?: boolean;
  /** Controlled input value */
  value?: string;
  /** Callback fired when value changes */
  onValueChange?: (value: string) => void;
  /** Maximum height for the textarea */
  maxHeight?: number | string;
  /** Callback fired on submit */
  onSubmit?: () => void;
  /** Child elements to render */
  children: React.ReactNode;
  /**
   * Custom test ID for testing
   * @default 'prompt-input'
   */
  testId?: string;
}

/**
 * Input component - Prompt input container with context
 *
 * @description
 * The main container for prompt/chat input functionality. Provides context
 * to child components and manages input state.
 *
 * ## Features
 * - **Context Provider**: Shares state with child components
 * - **Controlled/Uncontrolled**: Supports both input patterns
 * - **Auto-height Textarea**: Child textarea auto-expands
 * - **Loading State**: Disable input during submission
 *
 * ## Use Cases
 * - Chat input areas
 * - AI prompt interfaces
 * - Comment submission forms
 * - Search with suggestions
 *
 * ## Composition Pattern
 * Use with PromptInputTextarea, PromptInputActions, and PromptInputAction
 * for full functionality.
 *
 * @example
 * ```tsx
 * <Input value={message} onValueChange={setMessage} onSubmit={handleSend}>
 *   <PromptInputTextarea placeholder="Type a message..." />
 *   <PromptInputActions>
 *     <PromptInputAction tooltip="Send">
 *       <Button size="icon"><SendIcon /></Button>
 *     </PromptInputAction>
 *   </PromptInputActions>
 * </Input>
 * ```
 */
const Input = forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      testId = 'prompt-input',
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(value || '');

    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };

    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
          }}
        >
          <div
            ref={ref}
            data-slot="prompt-input"
            data-testid={testId}
            className={cn('border-input bg-background rounded-2xl border p-2 shadow-xs', className)}
            {...props}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
Input.displayName = 'Input';

/**
 * PromptInputTextarea component props
 *
 * @description Props for the auto-sizing prompt textarea.
 */
export interface PromptInputTextareaProps extends React.ComponentProps<typeof Textarea> {
  /** Whether to disable automatic height adjustment */
  disableAutosize?: boolean;
  /**
   * Custom test ID for testing
   * @default 'prompt-input-textarea'
   */
  testId?: string;
}

/**
 * PromptInputTextarea component - Auto-sizing textarea
 *
 * @description
 * A textarea that automatically adjusts its height based on content.
 * Supports Enter to submit and Shift+Enter for new lines.
 *
 * ## Features
 * - **Auto-height**: Grows with content up to maxHeight
 * - **Enter to Submit**: Triggers onSubmit from context
 * - **Shift+Enter**: Creates new line without submitting
 *
 * @example
 * ```tsx
 * <PromptInputTextarea
 *   placeholder="Ask anything..."
 *   disableAutosize={false}
 * />
 * ```
 */
const PromptInputTextarea = forwardRef<HTMLTextAreaElement, PromptInputTextareaProps>(
  (
    { className, onKeyDown, disableAutosize = false, testId = 'prompt-input-textarea', ...props },
    ref
  ) => {
    const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = ref || internalRef;

    useEffect(() => {
      if (disableAutosize) return;

      const textarea = typeof textareaRef === 'function' ? null : textareaRef?.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height =
        typeof maxHeight === 'number'
          ? `${Math.min(textarea.scrollHeight, maxHeight)}px`
          : `min(${textarea.scrollHeight}px, ${maxHeight})`;
    }, [value, maxHeight, disableAutosize, textareaRef]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit?.();
      }
      onKeyDown?.(e);
    };

    return (
      <Textarea
        ref={textareaRef}
        data-slot="prompt-input-textarea"
        data-testid={testId}
        aria-label="Message input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          'dark:bg-background min-h-[44px] w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
          className
        )}
        rows={1}
        disabled={disabled}
        {...props}
      />
    );
  }
);
PromptInputTextarea.displayName = 'PromptInputTextarea';

/**
 * PromptInputActions component props
 *
 * @description Props for the actions container.
 */
export interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Custom test ID for testing
   * @default 'prompt-input-actions'
   */
  testId?: string;
}

/**
 * PromptInputActions component - Action buttons container
 *
 * @description
 * A flex container for grouping action buttons like send,
 * attach files, emoji picker, etc.
 *
 * @example
 * ```tsx
 * <PromptInputActions>
 *   <PromptInputAction tooltip="Attach"><AttachIcon /></PromptInputAction>
 *   <PromptInputAction tooltip="Send"><SendIcon /></PromptInputAction>
 * </PromptInputActions>
 * ```
 */
const PromptInputActions = forwardRef<HTMLDivElement, PromptInputActionsProps>(
  ({ children, className, testId = 'prompt-input-actions', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="prompt-input-actions"
        data-testid={testId}
        className={cn('flex items-center gap-2', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PromptInputActions.displayName = 'PromptInputActions';

/**
 * PromptInputAction component props
 *
 * @description Props for individual action buttons with tooltips.
 */
export interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  /** Additional CSS classes */
  className?: string;
  /** Tooltip content */
  tooltip: React.ReactNode;
  /** Child elements (the action button) */
  children: React.ReactNode;
  /** Tooltip position */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Custom test ID for testing
   * @default 'prompt-input-action'
   */
  testId?: string;
}

/**
 * PromptInputAction component - Action button with tooltip
 *
 * @description
 * Wraps an action button with a tooltip. Automatically disables
 * when the parent Input is in loading state.
 *
 * @example
 * ```tsx
 * <PromptInputAction tooltip="Send message" side="top">
 *   <Button size="icon" onClick={handleSend}>
 *     <SendIcon />
 *   </Button>
 * </PromptInputAction>
 * ```
 */
const PromptInputAction = forwardRef<HTMLDivElement, PromptInputActionProps>(
  (
    { tooltip, children, className, side = 'top', testId = 'prompt-input-action', ...props },
    ref
  ) => {
    const { disabled } = usePromptInput();

    return (
      <div ref={ref} data-slot="prompt-input-action" data-testid={testId}>
        <Tooltip {...props}>
          <TooltipTrigger asChild disabled={disabled}>
            {children}
          </TooltipTrigger>
          <TooltipContent side={side} className={className}>
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }
);
PromptInputAction.displayName = 'PromptInputAction';

export { Input, PromptInputTextarea, PromptInputActions, PromptInputAction };

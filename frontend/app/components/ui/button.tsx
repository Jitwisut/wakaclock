'use client';

import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Button variant styles using class-variance-authority
 * @see https://cva.style/docs
 * @see https://www.radix-ui.com/primitives/docs/utilities/slot
 */
const buttonVariants = cva(
  [
    // Base styles
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none',
    // Focus styles (WCAG 2.2 Focus Appearance)
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'focus-within:ring-ring/30 focus-within:ring-2 focus:outline-none',
    // Invalid state
    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    // Disabled state
    'disabled:pointer-events-none disabled:opacity-50',
    // SVG handling
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
    // Print styles
    'print:border print:shadow-none',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98]',
        destructive:
          'bg-destructive hover:bg-destructive/90 active:bg-destructive/80 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 text-white active:scale-[0.98]',
        outline:
          'bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:bg-input/30 dark:border-input dark:hover:bg-input/50 border shadow-xs active:scale-[0.98]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70 active:scale-[0.98]',
        ghost:
          'hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:hover:bg-accent/50 active:scale-[0.98]',
        link: 'text-primary active:text-primary/80 underline-offset-4 hover:underline',
        warning:
          'bg-amber-500 text-white hover:bg-amber-500/90 focus-visible:ring-amber-500/20 active:scale-[0.98] active:bg-amber-500/80 dark:bg-amber-600 dark:focus-visible:ring-amber-500/40',
        success:
          'bg-green-600 text-white hover:bg-green-600/90 focus-visible:ring-green-600/20 active:scale-[0.98] active:bg-green-600/80 dark:bg-green-700 dark:focus-visible:ring-green-600/40',
        info: 'bg-blue-500 text-white hover:bg-blue-500/90 focus-visible:ring-blue-500/20 active:scale-[0.98] active:bg-blue-500/80 dark:bg-blue-600 dark:focus-visible:ring-blue-500/40',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: 'h-7 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5',
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        xl: 'h-12 rounded-md px-8 text-base has-[>svg]:px-6',
        // Icon buttons - WCAG 2.2 requires minimum 24x24 CSS pixels target size
        icon: 'size-9', // 36px - exceeds minimum
        'icon-xs': 'size-7', // 28px - exceeds minimum
        'icon-sm': 'size-8', // 32px - exceeds minimum
        'icon-lg': 'size-10', // 40px
        'icon-xl': 'size-12', // 48px
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      fullWidth: false,
    },
  }
);

/**
 * Button component props
 * @see https://ui.shadcn.com/docs/components/button
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/button/
 */
export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Render as child element using Radix Slot
     * Useful for composing with Next.js Link or other components
     * @default false
     * @see https://www.radix-ui.com/primitives/docs/utilities/slot
     */
    asChild?: boolean;

    /**
     * Loading state - disables button and sets aria-busy
     * Use with a Spinner component for visual feedback
     * @default false
     */
    loading?: boolean;

    /**
     * Pending state from React 19 useTransition/useFormStatus
     * Similar to loading but semantically for form actions
     * @default false
     * @see https://react.dev/reference/react/useTransition
     */
    pending?: boolean;

    /**
     * Element to display on the left side of the button text
     * Automatically spaced with gap
     */
    leftSection?: React.ReactNode;

    /**
     * Element to display on the right side of the button text
     * Automatically spaced with gap
     */
    rightSection?: React.ReactNode;

    /**
     * Makes button take full width of container
     * @default false
     */
    fullWidth?: boolean;

    /**
     * Justify content alignment
     * @default 'center'
     */
    justify?: 'start' | 'center' | 'end' | 'between';

    /**
     * Prevents double-click/rapid submissions
     * Useful for payment buttons, form submissions
     * @default false
     */
    preventDoubleClick?: boolean;

    /**
     * Debounce delay in ms for preventDoubleClick
     * @default 300
     */
    debounceMs?: number;

    /**
     * Enable haptic feedback on mobile devices (Vibration API)
     * @default false
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
     */
    hapticFeedback?: boolean;

    /**
     * Vibration pattern in ms for haptic feedback
     * Single number or array pattern [vibrate, pause, vibrate, ...]
     * @default 10
     */
    hapticPattern?: number | number[];

    /**
     * Analytics tracking ID for click telemetry
     * Emits custom event 'button:click' with this ID
     */
    trackingId?: string;

    /**
     * Additional analytics data to include with tracking events
     */
    trackingData?: Record<string, unknown>;

    /**
     * Callback fired when button enters loading/pending state
     */
    onLoadingChange?: (isLoading: boolean) => void;

    /**
     * Success state - shows success feedback after action completes
     * @default false
     */
    success?: boolean;

    /**
     * Error state - shows error feedback after action fails
     * @default false
     */
    error?: boolean;

    /**
     * Auto-reset success/error state after this many ms
     * Set to 0 to disable auto-reset
     * @default 2000
     */
    autoResetMs?: number;

    // ═══════════════════════════════════════════════════════════════════════════
    // ENTERPRISE FEATURES - Phase 2
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Long press callback - fires after holding button for specified duration
     * Useful for mobile delete confirmations, power user actions
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
     */
    onLongPress?: (event: React.PointerEvent<HTMLButtonElement>) => void;

    /**
     * Duration in ms before long press fires
     * @default 500
     */
    longPressMs?: number;

    /**
     * Keyboard shortcut to trigger the button
     * Format: 'mod+s' (mod = Cmd on Mac, Ctrl on Windows)
     * Examples: 'mod+s', 'mod+shift+enter', 'escape', 'mod+k'
     * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
     */
    shortcut?: string;

    /**
     * Show keyboard shortcut hint in the button
     * Renders as a badge/hint showing the shortcut
     * @default false
     */
    showShortcut?: boolean;

    /**
     * Callback when button is pressed (pointer down)
     * Part of React Aria press interaction pattern
     */
    onPressStart?: (event: React.PointerEvent<HTMLButtonElement>) => void;

    /**
     * Callback when button press ends (pointer up/leave)
     * Part of React Aria press interaction pattern
     */
    onPressEnd?: (event: React.PointerEvent<HTMLButtonElement>) => void;

    /**
     * Callback when pointer enters the button
     */
    onHoverStart?: (event: React.PointerEvent<HTMLButtonElement>) => void;

    /**
     * Callback when pointer leaves the button
     */
    onHoverEnd?: (event: React.PointerEvent<HTMLButtonElement>) => void;

    /**
     * Callback when button gains focus
     */
    onFocusChange?: (isFocused: boolean) => void;

    /**
     * Enable touch ripple effect on click (Material Design style)
     * @default false
     */
    ripple?: boolean;

    /**
     * Custom ripple color (CSS color value)
     * @default 'currentColor'
     */
    rippleColor?: string;

    /**
     * Disable animations for users who prefer reduced motion
     * When true, respects prefers-reduced-motion media query
     * @default true
     */
    respectReducedMotion?: boolean;

    /**
     * Announce state changes to screen readers via live region
     * @default false
     */
    announceStateChanges?: boolean;

    /**
     * Custom announcement message for loading state
     */
    loadingAnnouncement?: string;

    /**
     * Custom announcement message for success state
     */
    successAnnouncement?: string;

    /**
     * Custom announcement message for error state
     */
    errorAnnouncement?: string;

    /**
     * Custom tooltip content (integrates with Tooltip component)
     * String or ReactNode
     */
    tooltip?: React.ReactNode;

    /**
     * Tooltip placement
     * @default 'top'
     */
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left';

    /**
     * Delay before showing tooltip in ms
     * @default 700
     */
    tooltipDelayMs?: number;

    /**
     * Show confirmation dialog before executing click action
     * Pass true for default or an object for customization
     */
    confirmAction?:
      | boolean
      | {
          title?: string;
          description?: string;
          confirmLabel?: string;
          cancelLabel?: string;
        };

    /**
     * Custom test ID for testing (overrides default 'button')
     * @default 'button'
     */
    testId?: string;

    /**
     * Enable button sound effect on click (using Web Audio API)
     * @default false
     */
    soundEnabled?: boolean;

    /**
     * Sound frequency in Hz for click sound
     * @default 800
     */
    soundFrequency?: number;

    /**
     * Sound duration in ms
     * @default 50
     */
    soundDuration?: number;

    /**
     * Context menu items for right-click actions
     * Array of menu item objects
     */
    contextMenuItems?: Array<{
      label: string;
      onClick: () => void;
      icon?: React.ReactNode;
      disabled?: boolean;
      destructive?: boolean;
    }>;

    /**
     * Whether the button action is reversible (shows undo option)
     * Used with toast notifications
     * @default false
     */
    undoable?: boolean;

    /**
     * Undo callback for reversible actions
     */
    onUndo?: () => void;

    /**
     * Duration in ms before undo expires
     * @default 5000
     */
    undoTimeoutMs?: number;

    /**
     * Badge content to show on the button (notifications, counts)
     */
    badge?: React.ReactNode;

    /**
     * Badge position relative to button
     * @default 'top-right'
     */
    badgePosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

    /**
     * Whether this is a toggle button with pressed state
     * @default false
     */
    toggle?: boolean;

    /**
     * Pressed state for toggle buttons
     * @default false
     */
    pressed?: boolean;

    /**
     * Callback when toggle state changes
     */
    onPressedChange?: (pressed: boolean) => void;

    /**
     * Group ID for button groups (mutually exclusive selection)
     */
    groupId?: string;

    /**
     * Value for button when used in a group
     */
    groupValue?: string;

    /**
     * Skeleton loading placeholder before content loads
     * @default false
     */
    skeleton?: boolean;

    /**
     * Pulse animation for attention-grabbing CTAs
     * @default false
     */
    pulse?: boolean;

    /**
     * Glow effect for premium/highlighted buttons
     * @default false
     */
    glow?: boolean;

    /**
     * Gradient background variant
     * @default false
     */
    gradient?:
      | boolean
      | {
          from: string;
          to: string;
          direction?: 'to-r' | 'to-l' | 'to-t' | 'to-b' | 'to-tr' | 'to-tl' | 'to-br' | 'to-bl';
        };
  };

// Justify class mapping
const justifyClasses = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const;

/**
 * Button component - Enterprise-grade interactive element for triggering actions
 *
 * ## Features - Phase 1 (Core)
 * - **9 Variants**: default, destructive, outline, secondary, ghost, link, warning, success, info
 * - **10 Sizes**: xs, sm, default, lg, xl, icon, icon-xs, icon-sm, icon-lg, icon-xl
 * - **Loading/Pending States**: For async operations and React 19 transitions
 * - **Success/Error States**: Visual feedback with auto-reset
 * - **Polymorphic**: Use asChild to render as Link, anchor, or custom component
 * - **Sections**: leftSection/rightSection for icons with proper spacing
 * - **Full Width**: Optional full-width mode for forms
 * - **Double-Click Prevention**: Debounced clicks for payment/form buttons
 * - **Haptic Feedback**: Mobile vibration support via Vibration API
 * - **Analytics Tracking**: Built-in click telemetry with custom events
 * - **WCAG 2.2 Compliant**: Focus indicators, target sizes, ARIA attributes
 *
 * ## Features - Phase 2 (Enterprise)
 * - **Long Press Support**: Mobile-friendly long press for delete confirmations
 * - **Keyboard Shortcuts**: Global keyboard shortcuts (mod+s, mod+k, etc.)
 * - **Press Interactions**: React Aria-style onPressStart/onPressEnd callbacks
 * - **Hover Interactions**: onHoverStart/onHoverEnd callbacks
 * - **Focus Management**: onFocusChange callback for complex UIs
 * - **Touch Ripple Effect**: Material Design style ripple on click
 * - **Reduced Motion Support**: Respects prefers-reduced-motion
 * - **Screen Reader Announcements**: Live region updates for state changes
 * - **Tooltip Integration**: Built-in tooltip support with customizable placement
 * - **Confirmation Dialogs**: Built-in confirmation before destructive actions
 * - **Sound Effects**: Web Audio API click sounds for feedback
 * - **Context Menu**: Right-click menu support
 * - **Undoable Actions**: Integration with toast notifications for undo
 * - **Badge Support**: Notification badges on buttons
 * - **Toggle Mode**: aria-pressed toggle button support
 * - **Button Groups**: Group support for radio-like selection
 * - **Skeleton Loading**: Loading placeholder before content
 * - **Visual Effects**: Pulse, glow, and gradient variants
 *
 * ## Accessibility
 * - Icon-only buttons MUST have aria-label
 * - Loading state sets aria-busy="true"
 * - Disabled state sets aria-disabled="true"
 * - Error state sets aria-invalid="true"
 * - Toggle buttons set aria-pressed
 * - Minimum touch target: 28px (icon-xs), recommended: 44px+
 * - Reduced motion respected for all animations
 * - Screen reader announcements for state changes
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Button>Click me</Button>
 *
 * // With variant and size
 * <Button variant="destructive" size="lg">Delete</Button>
 *
 * // With loading state
 * <Button loading>
 *   <Spinner />
 *   Saving...
 * </Button>
 *
 * // With React 19 useTransition
 * const [isPending, startTransition] = useTransition();
 * <Button pending={isPending} onClick={() => startTransition(action)}>
 *   Submit
 * </Button>
 *
 * // With sections (icons)
 * <Button leftSection={<MailIcon />}>Send Email</Button>
 * <Button rightSection={<ArrowRightIcon />}>Continue</Button>
 *
 * // Full width in form
 * <Button fullWidth type="submit">Submit Form</Button>
 *
 * // As a link (polymorphic)
 * <Button asChild>
 *   <Link href="/dashboard">Go to Dashboard</Link>
 * </Button>
 *
 * // Icon-only button (requires aria-label)
 * <Button variant="ghost" size="icon" aria-label="Settings">
 *   <SettingsIcon />
 * </Button>
 *
 * // With justify alignment
 * <Button fullWidth justify="between">
 *   <span>Price</span>
 *   <span>$99</span>
 * </Button>
 *
 * // Payment button with double-click prevention
 * <Button preventDoubleClick debounceMs={500}>
 *   Pay $99.00
 * </Button>
 *
 * // Mobile button with haptic feedback
 * <Button hapticFeedback hapticPattern={[10, 50, 10]}>
 *   Tap Me
 * </Button>
 *
 * // With analytics tracking
 * <Button
 *   trackingId="cta-signup"
 *   trackingData={{ source: 'hero', variant: 'a' }}
 * >
 *   Sign Up Free
 * </Button>
 *
 * // Success/Error state with auto-reset
 * <Button success autoResetMs={3000}>
 *   Saved!
 * </Button>
 *
 * // With keyboard shortcut
 * <Button shortcut="mod+s" showShortcut onShortcut={handleSave}>
 *   Save
 * </Button>
 *
 * // Long press for delete
 * <Button
 *   variant="destructive"
 *   onLongPress={handleDelete}
 *   longPressMs={800}
 * >
 *   Hold to Delete
 * </Button>
 *
 * // With ripple effect
 * <Button ripple rippleColor="rgba(255,255,255,0.4)">
 *   Material Style
 * </Button>
 *
 * // With confirmation dialog
 * <Button
 *   variant="destructive"
 *   confirmAction={{
 *     title: 'Delete Account',
 *     description: 'This action cannot be undone.',
 *     confirmLabel: 'Yes, Delete',
 *     cancelLabel: 'Cancel',
 *   }}
 * >
 *   Delete Account
 * </Button>
 *
 * // Toggle button
 * <Button
 *   toggle
 *   pressed={isBold}
 *   onPressedChange={setIsBold}
 *   size="icon"
 *   aria-label="Bold"
 * >
 *   <BoldIcon />
 * </Button>
 *
 * // With notification badge
 * <Button badge={5} badgePosition="top-right">
 *   Notifications
 * </Button>
 *
 * // Gradient button
 * <Button gradient={{ from: '#667eea', to: '#764ba2', direction: 'to-r' }}>
 *   Premium Feature
 * </Button>
 *
 * // Skeleton loading
 * <Button skeleton size="lg" />
 *
 * // With sound effect
 * <Button soundEnabled soundFrequency={440} soundDuration={100}>
 *   Play Sound
 * </Button>
 * ```
 *
 * @see https://ui.shadcn.com/docs/components/button
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/button/
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
 * @see https://react-spectrum.adobe.com/react-aria/useButton.html
 */
/**
 * Trigger haptic feedback using the Vibration API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
 */
function triggerHapticFeedback(pattern: number | number[] = 10): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently fail - haptic feedback is non-critical
    }
  }
}

/**
 * Emit analytics tracking event
 */
function emitTrackingEvent(
  trackingId: string,
  trackingData?: Record<string, unknown>,
  variant?: string,
  size?: string
): void {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('button:click', {
      detail: {
        trackingId,
        variant,
        size,
        timestamp: Date.now(),
        ...trackingData,
      },
      bubbles: true,
      cancelable: false,
    });
    window.dispatchEvent(event);
  }
}

/**
 * Play a click sound using Web Audio API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
 */
function playClickSound(frequency = 800, duration = 50): void {
  if (typeof window === 'undefined' || !window.AudioContext) return;

  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch {
    // Silently fail - sound is non-critical
  }
}

/**
 * Parse keyboard shortcut string into key parts
 */
function parseShortcut(shortcut: string): {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
} {
  const parts = shortcut.toLowerCase().split('+');
  return {
    key: parts[parts.length - 1],
    mod: parts.includes('mod') || parts.includes('ctrl') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
  };
}

/**
 * Format shortcut for display (Mac vs Windows)
 */
function formatShortcutDisplay(shortcut: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const parts = shortcut.toLowerCase().split('+');

  const formatted = parts.map((part) => {
    switch (part) {
      case 'mod':
        return isMac ? '⌘' : 'Ctrl';
      case 'ctrl':
        return isMac ? '⌃' : 'Ctrl';
      case 'cmd':
        return '⌘';
      case 'shift':
        return isMac ? '⇧' : 'Shift';
      case 'alt':
      case 'option':
        return isMac ? '⌥' : 'Alt';
      case 'enter':
        return isMac ? '↵' : 'Enter';
      case 'escape':
      case 'esc':
        return 'Esc';
      case 'backspace':
        return isMac ? '⌫' : 'Backspace';
      case 'delete':
        return isMac ? '⌦' : 'Del';
      case 'tab':
        return isMac ? '⇥' : 'Tab';
      case 'space':
        return 'Space';
      case 'arrowup':
        return '↑';
      case 'arrowdown':
        return '↓';
      case 'arrowleft':
        return '←';
      case 'arrowright':
        return '→';
      default:
        return part.toUpperCase();
    }
  });

  return isMac ? formatted.join('') : formatted.join('+');
}

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Announce message to screen readers via live region
 */
function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  if (typeof document === 'undefined') return;

  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement is read
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      disabled,
      loading,
      pending,
      leftSection,
      rightSection,
      justify = 'center',
      type,
      children,
      onClick,
      preventDoubleClick = false,
      debounceMs = 300,
      hapticFeedback = false,
      hapticPattern = 10,
      trackingId,
      trackingData,
      onLoadingChange,
      success,
      error,
      autoResetMs = 2000,
      // Phase 2 Enterprise Features
      onLongPress,
      longPressMs = 500,
      shortcut,
      showShortcut = false,
      onPressStart,
      onPressEnd,
      onHoverStart,
      onHoverEnd,
      onFocusChange,
      ripple = false,
      rippleColor = 'currentColor',
      respectReducedMotion = true,
      announceStateChanges = false,
      loadingAnnouncement = 'Loading...',
      successAnnouncement = 'Success!',
      errorAnnouncement = 'Error occurred',
      tooltip,
      tooltipSide = 'top',
      tooltipDelayMs = 700,
      confirmAction,
      testId = 'button',
      soundEnabled = false,
      soundFrequency = 800,
      soundDuration = 50,
      contextMenuItems,
      undoable = false,
      onUndo,
      undoTimeoutMs = 5000,
      badge,
      badgePosition = 'top-right',
      toggle = false,
      pressed = false,
      onPressedChange,
      groupId,
      groupValue,
      skeleton = false,
      pulse = false,
      glow = false,
      gradient = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isLoading = loading || pending;
    const isDisabled = disabled || isLoading || skeleton;

    // Track debounce state for double-click prevention
    const lastClickRef = React.useRef<number>(0);
    const [isDebouncing, setIsDebouncing] = React.useState(false);

    // Internal success/error state for auto-reset
    const [internalSuccess, setInternalSuccess] = React.useState(false);
    const [internalError, setInternalError] = React.useState(false);

    // Long press state
    const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isLongPressing, setIsLongPressing] = React.useState(false);

    // Ripple effect state
    const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([]);
    const rippleIdRef = React.useRef(0);

    // Internal ref for button element
    const internalRef = React.useRef<HTMLButtonElement>(null);
    const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || internalRef;

    // Toggle state
    const [internalPressed, setInternalPressed] = React.useState(pressed);

    // Confirmation dialog state
    const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
    const pendingClickRef = React.useRef<React.MouseEvent<HTMLButtonElement> | null>(null);

    // Reduced motion check
    const shouldReduceMotion = respectReducedMotion && prefersReducedMotion();

    // Sync external success/error props with internal state
    React.useEffect(() => {
      if (!success) return;
      setInternalSuccess(true);
      if (autoResetMs > 0) {
        const timer = setTimeout(() => setInternalSuccess(false), autoResetMs);
        return () => clearTimeout(timer);
      }
      return;
    }, [success, autoResetMs]);

    React.useEffect(() => {
      if (!error) return;
      setInternalError(true);
      if (autoResetMs > 0) {
        const timer = setTimeout(() => setInternalError(false), autoResetMs);
        return () => clearTimeout(timer);
      }
      return;
    }, [error, autoResetMs]);

    // Notify parent of loading state changes
    React.useEffect(() => {
      onLoadingChange?.(isLoading ?? false);
    }, [isLoading, onLoadingChange]);

    // Sync external pressed prop with internal state
    React.useEffect(() => {
      setInternalPressed(pressed);
    }, [pressed]);

    // Keyboard shortcut handler
    React.useEffect(() => {
      if (!shortcut || isDisabled) return;

      const { key, mod, shift, alt } = parseShortcut(shortcut);

      const handleKeyDown = (event: KeyboardEvent) => {
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        const modKey = isMac ? event.metaKey : event.ctrlKey;

        const keyMatches = event.key.toLowerCase() === key;
        const modMatches = mod ? modKey : !modKey;
        const shiftMatches = shift ? event.shiftKey : !event.shiftKey;
        const altMatches = alt ? event.altKey : !event.altKey;

        if (keyMatches && modMatches && shiftMatches && altMatches) {
          event.preventDefault();
          buttonRef.current?.click();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [shortcut, isDisabled, buttonRef]);

    // Screen reader announcements for state changes
    React.useEffect(() => {
      if (!announceStateChanges) return;
      if (isLoading) {
        announceToScreenReader(loadingAnnouncement, 'polite');
      }
    }, [isLoading, announceStateChanges, loadingAnnouncement]);

    React.useEffect(() => {
      if (!announceStateChanges) return;
      if (internalSuccess) {
        announceToScreenReader(successAnnouncement, 'polite');
      }
    }, [internalSuccess, announceStateChanges, successAnnouncement]);

    React.useEffect(() => {
      if (!announceStateChanges) return;
      if (internalError) {
        announceToScreenReader(errorAnnouncement, 'assertive');
      }
    }, [internalError, announceStateChanges, errorAnnouncement]);

    // Cleanup long press timer on unmount
    React.useEffect(() => {
      return () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
        }
      };
    }, []);

    // Ripple effect handler
    const addRipple = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!ripple || shouldReduceMotion) return;

        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const id = rippleIdRef.current++;

        setRipples((prev) => [...prev, { id, x, y }]);

        // Remove ripple after animation
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);
      },
      [ripple, shouldReduceMotion]
    );

    // Long press handlers
    const handlePointerDown = React.useCallback(
      (event: React.PointerEvent<HTMLButtonElement>) => {
        onPressStart?.(event);

        if (onLongPress && !isDisabled) {
          setIsLongPressing(false);
          longPressTimerRef.current = setTimeout(() => {
            setIsLongPressing(true);
            if (hapticFeedback) {
              triggerHapticFeedback([50, 50, 50]); // Stronger haptic for long press
            }
            onLongPress(event);
          }, longPressMs);
        }
      },
      [onPressStart, onLongPress, isDisabled, longPressMs, hapticFeedback]
    );

    const handlePointerUp = React.useCallback(
      (event: React.PointerEvent<HTMLButtonElement>) => {
        onPressEnd?.(event);

        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        setIsLongPressing(false);
      },
      [onPressEnd]
    );

    const handlePointerLeave = React.useCallback(
      (event: React.PointerEvent<HTMLButtonElement>) => {
        onHoverEnd?.(event);

        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        setIsLongPressing(false);
      },
      [onHoverEnd]
    );

    // Focus change handler
    const handleFocus = React.useCallback(
      (event: React.FocusEvent<HTMLButtonElement>) => {
        onFocusChange?.(true);
        props.onFocus?.(event);
      },
      [onFocusChange, props]
    );

    const handleBlur = React.useCallback(
      (event: React.FocusEvent<HTMLButtonElement>) => {
        onFocusChange?.(false);
        props.onBlur?.(event);
      },
      [onFocusChange, props]
    );

    // Context menu handler
    const handleContextMenu = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (contextMenuItems && contextMenuItems.length > 0) {
          event.preventDefault();
          // Emit custom event for context menu handling
          const contextEvent = new CustomEvent('button:contextmenu', {
            detail: { items: contextMenuItems, x: event.clientX, y: event.clientY },
            bubbles: true,
          });
          event.currentTarget.dispatchEvent(contextEvent);
        }
        props.onContextMenu?.(event);
      },
      [contextMenuItems, props]
    );

    // Execute click action (used by confirmation dialog)
    const executeClickAction = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        // Sound effect
        if (soundEnabled) {
          playClickSound(soundFrequency, soundDuration);
        }

        // Toggle handling
        if (toggle) {
          const newPressed = !internalPressed;
          setInternalPressed(newPressed);
          onPressedChange?.(newPressed);
        }

        // Undoable action
        if (undoable && onUndo) {
          const undoEvent = new CustomEvent('button:undoable', {
            detail: {
              undo: onUndo,
              timeoutMs: undoTimeoutMs,
              trackingId,
            },
            bubbles: true,
          });
          window.dispatchEvent(undoEvent);
        }

        onClick?.(event);
      },
      [
        soundEnabled,
        soundFrequency,
        soundDuration,
        toggle,
        internalPressed,
        onPressedChange,
        undoable,
        onUndo,
        undoTimeoutMs,
        trackingId,
        onClick,
      ]
    );

    // Enhanced click handler with all features
    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        // Skip if long press just occurred
        if (isLongPressing) {
          return;
        }

        // Double-click prevention
        if (preventDoubleClick) {
          const now = Date.now();
          if (now - lastClickRef.current < debounceMs) {
            event.preventDefault();
            return;
          }
          lastClickRef.current = now;
          setIsDebouncing(true);
          setTimeout(() => setIsDebouncing(false), debounceMs);
        }

        // Ripple effect
        addRipple(event);

        // Haptic feedback
        if (hapticFeedback) {
          triggerHapticFeedback(hapticPattern);
        }

        // Analytics tracking
        if (trackingId) {
          emitTrackingEvent(trackingId, trackingData, variant ?? 'default', size ?? 'default');
        }

        // Confirmation dialog
        if (confirmAction) {
          event.preventDefault();
          pendingClickRef.current = event;
          setShowConfirmDialog(true);
          return;
        }

        // Execute the actual click action
        executeClickAction(event);
      },
      [
        isLongPressing,
        preventDoubleClick,
        debounceMs,
        addRipple,
        hapticFeedback,
        hapticPattern,
        trackingId,
        trackingData,
        variant,
        size,
        confirmAction,
        executeClickAction,
      ]
    );

    // Confirmation dialog handlers
    const handleConfirm = React.useCallback(() => {
      setShowConfirmDialog(false);
      if (pendingClickRef.current) {
        executeClickAction(pendingClickRef.current);
        pendingClickRef.current = null;
      }
    }, [executeClickAction]);

    const handleCancelConfirm = React.useCallback(() => {
      setShowConfirmDialog(false);
      pendingClickRef.current = null;
    }, []);

    // Development warning for icon buttons without aria-label
    if (process.env.NODE_ENV === 'development') {
      const isIconButton = size?.toString().startsWith('icon');
      const hasAriaLabel = props['aria-label'] || props['aria-labelledby'];
      if (isIconButton && !hasAriaLabel && !children) {
        console.warn(
          '[Button] Icon-only buttons must have an aria-label or aria-labelledby for accessibility. ' +
            'See: https://www.w3.org/WAI/ARIA/apg/patterns/button/'
        );
      }
    }

    // Compute effective variant based on success/error state
    const effectiveVariant = internalSuccess ? 'success' : internalError ? 'destructive' : variant;

    // Compute gradient styles
    const gradientStyles = React.useMemo(() => {
      if (!gradient) return {};
      if (gradient === true) {
        return {
          backgroundImage: 'linear-gradient(to right, var(--primary), var(--primary-foreground))',
        };
      }
      const direction = gradient.direction || 'to-r';
      const directionMap: Record<string, string> = {
        'to-r': 'to right',
        'to-l': 'to left',
        'to-t': 'to top',
        'to-b': 'to bottom',
        'to-tr': 'to top right',
        'to-tl': 'to top left',
        'to-br': 'to bottom right',
        'to-bl': 'to bottom left',
      };
      return {
        backgroundImage: `linear-gradient(${directionMap[direction]}, ${gradient.from}, ${gradient.to})`,
      };
    }, [gradient]);

    // Badge position classes
    const badgePositionClasses: Record<string, string> = {
      'top-right': '-top-1 -right-1',
      'top-left': '-top-1 -left-1',
      'bottom-right': '-bottom-1 -right-1',
      'bottom-left': '-bottom-1 -left-1',
    };

    // Confirmation dialog config
    const confirmConfig = React.useMemo(() => {
      if (!confirmAction) return null;
      if (confirmAction === true) {
        return {
          title: 'Confirm Action',
          description: 'Are you sure you want to continue?',
          confirmLabel: 'Confirm',
          cancelLabel: 'Cancel',
        };
      }
      return {
        title: confirmAction.title || 'Confirm Action',
        description: confirmAction.description || 'Are you sure you want to continue?',
        confirmLabel: confirmAction.confirmLabel || 'Confirm',
        cancelLabel: confirmAction.cancelLabel || 'Cancel',
      };
    }, [confirmAction]);

    // Render skeleton placeholder
    if (skeleton) {
      return (
        <div
          data-slot="button-skeleton"
          data-testid={`${testId}-skeleton`}
          className={cn(
            buttonVariants({ variant: 'outline', size, fullWidth }),
            'bg-muted animate-pulse cursor-default',
            className
          )}
          aria-hidden="true"
        />
      );
    }

    const buttonElement = (
      <Comp
        ref={buttonRef}
        type={type ?? 'button'}
        data-slot="button"
        data-testid={testId}
        data-variant={effectiveVariant ?? 'default'}
        data-size={size ?? 'default'}
        data-loading={isLoading || undefined}
        data-pending={pending || undefined}
        data-disabled={isDisabled || undefined}
        data-full-width={fullWidth || undefined}
        data-debouncing={isDebouncing || undefined}
        data-success={internalSuccess || undefined}
        data-error={internalError || undefined}
        data-tracking-id={trackingId}
        data-long-pressing={isLongPressing || undefined}
        data-pressed={toggle ? internalPressed : undefined}
        data-group-id={groupId}
        data-group-value={groupValue}
        aria-busy={isLoading || undefined}
        aria-disabled={isDisabled || undefined}
        aria-invalid={internalError || undefined}
        aria-pressed={toggle ? internalPressed : undefined}
        disabled={isDisabled || isDebouncing}
        className={cn(
          buttonVariants({ variant: effectiveVariant, size, fullWidth, className }),
          justify !== 'center' && justifyClasses[justify],
          // Animation classes
          pulse && !shouldReduceMotion && 'animate-pulse',
          glow && 'shadow-primary/50 hover:shadow-primary/60 shadow-lg hover:shadow-xl',
          gradient && 'border-0 text-white',
          // Reduced motion override
          shouldReduceMotion && 'transition-none',
          // Position relative for badge/ripple
          (badge || ripple) && 'relative overflow-hidden'
        )}
        style={gradient ? gradientStyles : undefined}
        onClick={asChild ? onClick : handleClick}
        onPointerDown={asChild ? undefined : handlePointerDown}
        onPointerUp={asChild ? undefined : handlePointerUp}
        onPointerLeave={asChild ? undefined : handlePointerLeave}
        onPointerEnter={asChild ? undefined : onHoverStart}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onContextMenu={handleContextMenu}
        {...props}
      >
        {asChild ? (
          <Slottable>{children}</Slottable>
        ) : (
          <>
            {/* Ripple effects */}
            {ripple &&
              ripples.map((r) => (
                <span
                  key={r.id}
                  className="pointer-events-none absolute animate-[ripple_0.6s_ease-out] rounded-full"
                  style={{
                    left: r.x,
                    top: r.y,
                    width: 0,
                    height: 0,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: rippleColor,
                    opacity: 0.3,
                  }}
                />
              ))}

            {leftSection}
            {children && <Slottable>{children}</Slottable>}
            {rightSection}

            {/* Keyboard shortcut hint */}
            {showShortcut && shortcut && (
              <kbd className="bg-muted text-muted-foreground ml-2 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium opacity-70">
                {formatShortcutDisplay(shortcut)}
              </kbd>
            )}

            {/* Badge */}
            {badge && (
              <span
                className={cn(
                  'bg-destructive text-destructive-foreground absolute flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-medium',
                  badgePositionClasses[badgePosition]
                )}
              >
                {badge}
              </span>
            )}
          </>
        )}
      </Comp>
    );

    // Wrap with tooltip if provided
    if (tooltip) {
      // Emit event for external tooltip handling since we don't want to import Tooltip here
      // This keeps the Button component independent
      return (
        <span
          data-tooltip={typeof tooltip === 'string' ? tooltip : undefined}
          data-tooltip-side={tooltipSide}
          data-tooltip-delay={tooltipDelayMs}
          className="inline-flex"
        >
          {buttonElement}
          {/* Confirmation Dialog Portal */}
          {showConfirmDialog && confirmConfig && (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby="confirm-description"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={handleCancelConfirm}
            >
              <div
                className="bg-background mx-4 max-w-md rounded-lg p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="confirm-title" className="text-lg font-semibold">
                  {confirmConfig.title}
                </h2>
                <p id="confirm-description" className="text-muted-foreground mt-2 text-sm">
                  {confirmConfig.description}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                    onClick={handleCancelConfirm}
                  >
                    {confirmConfig.cancelLabel}
                  </button>
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
                    onClick={handleConfirm}
                  >
                    {confirmConfig.confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          )}
        </span>
      );
    }

    return (
      <>
        {buttonElement}
        {/* Confirmation Dialog Portal */}
        {showConfirmDialog && confirmConfig && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-description"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={handleCancelConfirm}
          >
            <div
              className="bg-background mx-4 max-w-md rounded-lg p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="confirm-title" className="text-lg font-semibold">
                {confirmConfig.title}
              </h2>
              <p id="confirm-description" className="text-muted-foreground mt-2 text-sm">
                {confirmConfig.description}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                  onClick={handleCancelConfirm}
                >
                  {confirmConfig.cancelLabel}
                </button>
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
                  onClick={handleConfirm}
                >
                  {confirmConfig.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

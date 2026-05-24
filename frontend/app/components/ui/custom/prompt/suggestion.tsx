'use client';

import React, { forwardRef } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VariantProps } from 'class-variance-authority';

/**
 * PromptSuggestion component props
 *
 * @description Props for the suggestion button component.
 */
export interface PromptSuggestionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Suggestion content */
  children: React.ReactNode;
  /** Button variant style */
  variant?: VariantProps<typeof buttonVariants>['variant'];
  /** Button size */
  size?: VariantProps<typeof buttonVariants>['size'];
  /** Text to highlight in the suggestion */
  highlight?: string;
  /**
   * Custom test ID for testing
   * @default 'prompt-suggestion'
   */
  testId?: string;
}

/**
 * Suggestion component - Clickable suggestion button
 *
 * @description
 * A button for displaying clickable suggestions with optional
 * text highlighting for search/autocomplete scenarios.
 *
 * ## Features
 * - **Text Highlighting**: Highlight matching text
 * - **Flexible Styling**: Multiple variant/size options
 * - **Two Modes**: Simple pill or full-width autocomplete style
 *
 * ## Use Cases
 * - Chat prompt suggestions
 * - Autocomplete dropdowns
 * - Quick action buttons
 * - Command palette options
 *
 * @example
 * ```tsx
 * // Simple pill suggestion
 * <Suggestion onClick={() => setPrompt('Tell me a joke')}>
 *   Tell me a joke
 * </Suggestion>
 *
 * // With highlight (for search)
 * <Suggestion highlight="react">
 *   How to use React hooks?
 * </Suggestion>
 * ```
 */
const Suggestion = forwardRef<HTMLButtonElement, PromptSuggestionProps>(
  (
    { children, variant, size, className, highlight, testId = 'prompt-suggestion', ...props },
    ref
  ) => {
    const isHighlightMode = highlight !== undefined && highlight.trim() !== '';
    const content = typeof children === 'string' ? children : '';

    if (!isHighlightMode) {
      return (
        <Button
          ref={ref}
          data-slot="prompt-suggestion"
          data-testid={testId}
          variant={variant || 'outline'}
          size={size || 'lg'}
          className={cn('rounded-full', className)}
          {...props}
        >
          {children}
        </Button>
      );
    }

    if (!content) {
      return (
        <Button
          ref={ref}
          data-slot="prompt-suggestion"
          data-testid={testId}
          variant={variant || 'ghost'}
          size={size || 'sm'}
          className={cn(
            'w-full cursor-pointer justify-start rounded-xl py-2',
            'hover:bg-muted',
            className
          )}
          {...props}
        >
          {children}
        </Button>
      );
    }

    const trimmedHighlight = highlight.trim();
    const contentLower = content.toLowerCase();
    const highlightLower = trimmedHighlight.toLowerCase();
    const shouldHighlight = contentLower.includes(highlightLower);

    return (
      <Button
        ref={ref}
        data-slot="prompt-suggestion"
        data-testid={testId}
        variant={variant || 'ghost'}
        size={size || 'sm'}
        className={cn(
          'w-full cursor-pointer justify-start gap-0 rounded-xl py-2',
          'hover:bg-muted',
          className
        )}
        {...props}
      >
        {shouldHighlight ? (
          (() => {
            const index = contentLower.indexOf(highlightLower);
            if (index === -1)
              return <span className="text-muted-foreground whitespace-pre-wrap">{content}</span>;

            const actualHighlightedText = content.substring(index, index + highlightLower.length);

            const before = content.substring(0, index);
            const after = content.substring(index + actualHighlightedText.length);

            return (
              <>
                {before && (
                  <span className="text-muted-foreground whitespace-pre-wrap">{before}</span>
                )}
                <span className="text-primary font-medium whitespace-pre-wrap">
                  {actualHighlightedText}
                </span>
                {after && (
                  <span className="text-muted-foreground whitespace-pre-wrap">{after}</span>
                )}
              </>
            );
          })()
        ) : (
          <span className="text-muted-foreground whitespace-pre-wrap">{content}</span>
        )}
      </Button>
    );
  }
);
Suggestion.displayName = 'Suggestion';

export { Suggestion };

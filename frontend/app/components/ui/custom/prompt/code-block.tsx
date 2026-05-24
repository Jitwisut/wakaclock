'use client';

import { cn } from '@/lib/utils';
import React, { forwardRef, useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

/**
 * CodeBlock component props
 *
 * @description Props for the code block container component.
 */
export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Child elements to render inside the code block */
  children?: React.ReactNode;
  /**
   * Custom test ID for testing
   * @default 'code-block'
   */
  testId?: string;
}

/**
 * CodeBlock component - Container for syntax-highlighted code
 *
 * @description
 * A styled container for displaying code snippets with syntax highlighting.
 * Works with CodeBlockCode for the actual highlighted content.
 *
 * ## Features
 * - **Styled Container**: Rounded borders, card background
 * - **Overflow Handling**: Clips overflowing content
 * - **Composable**: Use with CodeBlockCode and CodeBlockGroup
 *
 * ## Use Cases
 * - Documentation code examples
 * - Chat AI code responses
 * - Tutorial code snippets
 * - API response displays
 *
 * ## Accessibility
 * - Uses role="region" for semantic grouping
 * - aria-label for screen reader context
 *
 * @example
 * ```tsx
 * <CodeBlock>
 *   <CodeBlockGroup>
 *     <span>TypeScript</span>
 *     <CopyButton code={code} />
 *   </CodeBlockGroup>
 *   <CodeBlockCode code={code} language="typescript" />
 * </CodeBlock>
 * ```
 */
const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(
  ({ children, className, testId = 'code-block', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="code-block"
        data-testid={testId}
        className={cn(
          'not-prose flex w-full flex-col overflow-clip border',
          'border-border bg-card text-card-foreground rounded-xl',
          className
        )}
        role="region"
        aria-label="Code block"
        {...props}
      >
        {children}
      </div>
    );
  }
);
CodeBlock.displayName = 'CodeBlock';

/**
 * CodeBlockCode component props
 *
 * @description Props for the syntax-highlighted code content component.
 */
export interface CodeBlockCodeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The code content to display */
  code: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** Shiki theme for syntax highlighting */
  theme?: string;
  /** Accessible label for the code block */
  'aria-label'?: string;
  /**
   * Custom test ID for testing
   * @default 'code-block-code'
   */
  testId?: string;
}

/**
 * CodeBlockCode component - Syntax-highlighted code content
 *
 * @description
 * Renders code with syntax highlighting using Shiki. Supports async
 * highlighting with SSR fallback for plain code display.
 *
 * ## Features
 * - **Shiki Highlighting**: Beautiful syntax highlighting
 * - **Multiple Languages**: Supports 100+ programming languages
 * - **Theme Support**: Configurable color themes
 * - **SSR Compatible**: Plain code fallback during hydration
 *
 * ## Supported Languages
 * typescript, javascript, python, rust, go, java, c, cpp,
 * html, css, json, yaml, markdown, sql, shell, and more.
 *
 * @example
 * ```tsx
 * <CodeBlockCode code="const x = 1;" language="typescript" />
 * <CodeBlockCode code={pythonCode} language="python" theme="github-light" />
 * ```
 *
 * @see https://shiki.style - Shiki documentation
 */
const CodeBlockCode = forwardRef<HTMLDivElement, CodeBlockCodeProps>(
  (
    {
      code,
      language = 'tsx',
      theme = 'github-dark',
      className,
      'aria-label': ariaLabel,
      testId = 'code-block-code',
      ...props
    },
    ref
  ) => {
    const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

    useEffect(() => {
      let isActive = true;

      async function highlight() {
        setHighlightedHtml(null);

        if (!code) {
          if (isActive) setHighlightedHtml('<pre><code></code></pre>');
          return;
        }

        try {
          const html = await codeToHtml(code, { lang: language, theme });
          if (isActive) setHighlightedHtml(html);
        } catch {
          // Fall back to plain code when highlighting fails.
        }
      }
      void highlight();

      return () => {
        isActive = false;
      };
    }, [code, language, theme]);

    const classNames = cn(
      'w-full overflow-x-auto text-[13px] [&>pre]:min-w-full [&>pre]:px-4 [&>pre]:py-4',
      className
    );

    const codeAriaLabel = ariaLabel ?? `Code block: ${language}`;

    // SSR fallback: render plain code if not hydrated yet
    return highlightedHtml ? (
      <div
        ref={ref}
        data-slot="code-block-code"
        data-testid={testId}
        className={classNames}
        aria-label={codeAriaLabel}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        {...props}
      />
    ) : (
      <div
        ref={ref}
        data-slot="code-block-code"
        data-testid={testId}
        className={classNames}
        aria-label={codeAriaLabel}
        {...props}
      >
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    );
  }
);
CodeBlockCode.displayName = 'CodeBlockCode';

/**
 * CodeBlockGroup component props
 *
 * @description Props for the code block group container.
 */
export interface CodeBlockGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Custom test ID for testing
   * @default 'code-block-group'
   */
  testId?: string;
}

/**
 * CodeBlockGroup component - Header/footer container for code blocks
 *
 * @description
 * A flex container for grouping code block header or footer elements
 * like language labels and copy buttons.
 *
 * ## Use Cases
 * - Language indicator with copy button
 * - Filename display with actions
 * - Line count or other metadata
 *
 * @example
 * ```tsx
 * <CodeBlockGroup>
 *   <span className="text-muted-foreground">TypeScript</span>
 *   <CopyButton code={code} />
 * </CodeBlockGroup>
 * ```
 */
const CodeBlockGroup = forwardRef<HTMLDivElement, CodeBlockGroupProps>(
  ({ children, className, testId = 'code-block-group', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="code-block-group"
        data-testid={testId}
        className={cn('flex items-center justify-between', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CodeBlockGroup.displayName = 'CodeBlockGroup';

export { CodeBlock, CodeBlockCode, CodeBlockGroup };

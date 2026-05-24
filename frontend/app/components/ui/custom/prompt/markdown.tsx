import { cn } from '@/lib/utils';
import { marked } from 'marked';
import React, { forwardRef, memo, useId, useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock, CodeBlockCode } from './code-block';

/**
 * Markdown component props
 *
 * @description Props for the markdown renderer component.
 */
export interface MarkdownProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Markdown content to render */
  children: string;
  /** Unique identifier for block keys */
  id?: string;
  /** Custom component overrides for ReactMarkdown */
  components?: Partial<Components>;
  /**
   * Custom test ID for testing
   * @default 'markdown'
   */
  testId?: string;
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

function extractLanguage(className?: string): string {
  if (!className) return 'plaintext';
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : 'plaintext';
}

const INITIAL_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line;

    if (isInline) {
      return (
        <span
          className={cn('bg-background rounded-sm px-1 font-mono text-sm', className)}
          {...props}
        >
          {children}
        </span>
      );
    }

    const language = extractLanguage(className);

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    );
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>;
  },
};

/**
 * MemoizedMarkdownBlock component props
 *
 * @description Props for individually memoized markdown blocks.
 */
export interface MemoizedMarkdownBlockProps {
  /** Markdown content for this block */
  content: string;
  /** Custom component overrides for ReactMarkdown */
  components?: Partial<Components>;
  /**
   * Custom test ID for testing
   * @default 'markdown-block'
   */
  testId?: string;
}

/**
 * MemoizedMarkdownBlock component - Individual memoized block
 *
 * @description
 * A memoized markdown block that only re-renders when content changes.
 * Used internally by Markdown component for performance optimization.
 */
const MemoizedMarkdownBlock = memo(
  forwardRef<HTMLDivElement, MemoizedMarkdownBlockProps>(
    ({ content, components = INITIAL_COMPONENTS, testId = 'markdown-block' }, ref) => {
      return (
        <div ref={ref} data-slot="markdown-block" data-testid={testId}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
          </ReactMarkdown>
        </div>
      );
    }
  ),
  (prevProps, nextProps) => prevProps.content === nextProps.content
);
MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

/**
 * Markdown component - Markdown content renderer
 *
 * @description
 * Renders markdown content with syntax highlighting, GFM support,
 * and block-level memoization for optimal performance.
 *
 * ## Features
 * - **GFM Support**: Tables, strikethrough, task lists
 * - **Syntax Highlighting**: Code blocks with Shiki
 * - **Block Memoization**: Only re-renders changed blocks
 * - **Custom Components**: Override default rendering
 *
 * ## Use Cases
 * - Chat message rendering
 * - Documentation display
 * - Blog post content
 * - README viewers
 *
 * @example
 * ```tsx
 * <Markdown>
 *   # Hello World
 *
 *   This is **bold** and *italic*.
 *
 *   ```typescript
 *   const x = 1;
 *   ```
 * </Markdown>
 * ```
 *
 * @see https://github.github.com/gfm/ - GitHub Flavored Markdown
 */
const Markdown = memo(
  forwardRef<HTMLDivElement, MarkdownProps>(
    (
      { children, id, className, components = INITIAL_COMPONENTS, testId = 'markdown', ...props },
      ref
    ) => {
      const generatedId = useId();
      const blockId = id ?? generatedId;
      const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);

      return (
        <div ref={ref} data-slot="markdown" data-testid={testId} className={className} {...props}>
          {blocks.map((block, index) => (
            <MemoizedMarkdownBlock
              key={`${blockId}-block-${index}`}
              content={block}
              components={components}
            />
          ))}
        </div>
      );
    }
  )
);
Markdown.displayName = 'Markdown';

export { Markdown, MemoizedMarkdownBlock };

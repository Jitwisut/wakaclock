import * as React from 'react';
import './styles/index.css';

import type { Content, Editor } from '@tiptap/react';
import type { UseMinimalTiptapEditorProps } from './hooks/use-minimal-tiptap';
import { EditorContent } from '@tiptap/react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { SectionTwo, type SectionTwoLabels } from './components/section/two';
import { SectionFour, type SectionFourLabels } from './components/section/four';
import {
  LinkBubbleMenu,
  type LinkBubbleMenuLabels,
} from './components/bubble-menu/link-bubble-menu';
import { useMinimalTiptapEditor } from './hooks/use-minimal-tiptap';
import { MeasuredContainer } from './components/measured-container';

/**
 * Labels for MinimalTiptap editor sections
 * @description Configuration for text style, lists, and link bubble menu labels
 */
export interface MinimalTiptapLabels {
  /** Labels for text style section (bold, italic, etc.) */
  textStyle?: Partial<SectionTwoLabels>;
  /** Labels for list formatting section */
  lists?: Partial<SectionFourLabels>;
  /** Labels for link bubble menu */
  linkBubbleMenu?: LinkBubbleMenuLabels;
}

/**
 * MinimalTiptapEditor component props
 *
 * @description
 * Props for the MinimalTiptap rich text editor, extending TipTap configuration
 * with additional UI customization options.
 */
export interface MinimalTiptapProps extends Omit<UseMinimalTiptapEditorProps, 'onUpdate'> {
  /** Initial or controlled editor content */
  value?: Content;
  /** Callback fired when editor content changes */
  onChange?: (value: Content) => void;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the editor content area */
  editorContentClassName?: string;
  /** Customizable labels for editor sections */
  labels?: MinimalTiptapLabels;
  /** Accessible label for the editor */
  'aria-label'?: string;
  /**
   * Custom test ID for testing
   * @default 'minimal-tiptap-editor'
   */
  testId?: string;
}

/**
 * Toolbar props for the MinimalTiptap editor
 * @description Internal props for the toolbar component
 */
interface ToolbarProps {
  /** The TipTap editor instance */
  editor: Editor;
  /** Customizable labels for toolbar sections */
  labels?: MinimalTiptapLabels;
  /** Test ID prefix for toolbar elements */
  testId?: string;
}

/**
 * Toolbar component for the MinimalTiptap editor
 * @description Renders formatting controls for text styling and lists
 */
const Toolbar = ({ editor, labels, testId = 'minimal-tiptap' }: ToolbarProps) => (
  <div
    data-slot="minimal-tiptap-toolbar"
    data-testid={`${testId}-toolbar`}
    className="border-border shrink-0 overflow-x-auto border-b p-2"
  >
    <div className="flex w-max items-center gap-px">
      <SectionTwo
        editor={editor}
        activeActions={['bold', 'italic', 'underline', 'strikethrough', 'code', 'clearFormatting']}
        mainActionCount={3}
        labels={labels?.textStyle}
      />

      <Separator orientation="vertical" className="mx-2 h-7" />

      <SectionFour
        editor={editor}
        activeActions={['orderedList', 'bulletList']}
        mainActionCount={0}
        labels={labels?.lists}
      />
    </div>
  </div>
);
Toolbar.displayName = 'Toolbar';

/**
 * MinimalTiptapEditor component - Rich text editor
 *
 * @description
 * A minimal, accessible rich text editor built on TipTap with
 * formatting toolbar, link bubble menu, and i18n support.
 *
 * ## Features
 * - **Text Formatting**: Bold, italic, underline, strikethrough, code
 * - **Lists**: Ordered and unordered lists
 * - **Links**: Inline link editing with bubble menu
 * - **Responsive**: Auto-measuring container
 * - **i18n Ready**: All labels customizable
 *
 * ## Accessibility
 * - `role="textbox"` with `aria-multiline="true"`
 * - Customizable `aria-label`
 * - Keyboard shortcuts for formatting
 *
 * ## Use Cases
 * - Blog post editing
 * - Comment systems
 * - Form rich text fields
 * - Documentation editing
 *
 * @example
 * ```tsx
 * <MinimalTiptapEditor
 *   value={content}
 *   onChange={setContent}
 *   aria-label="Post content editor"
 * />
 * ```
 */
export const MinimalTiptapEditor = React.forwardRef<HTMLDivElement, MinimalTiptapProps>(
  (
    {
      value,
      onChange,
      className,
      editorContentClassName,
      labels,
      testId = 'minimal-tiptap-editor',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const editor = useMinimalTiptapEditor({
      value,
      onUpdate: onChange,
      ...props,
    });

    if (!editor) {
      return null;
    }

    return (
      <MeasuredContainer
        as="div"
        name="editor"
        ref={ref}
        data-slot="minimal-tiptap-editor"
        data-testid={testId}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? 'Rich text editor'}
        className={cn(
          'border-input focus-within:border-primary flex h-auto min-h-72 w-full flex-col rounded-md border shadow-xs',
          className
        )}
      >
        <Toolbar editor={editor} labels={labels} testId={testId} />
        <EditorContent
          editor={editor}
          className={cn('minimal-tiptap-editor', editorContentClassName)}
        />
        <LinkBubbleMenu editor={editor} labels={labels?.linkBubbleMenu} />
      </MeasuredContainer>
    );
  }
);
MinimalTiptapEditor.displayName = 'MinimalTiptapEditor';

export default MinimalTiptapEditor;

import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { VariantProps } from 'class-variance-authority';
import type { toggleVariants } from '@/components/ui/toggle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link2Icon } from '@radix-ui/react-icons';
import { ToolbarButton } from '../toolbar-button';
import type { LinkEditBlockLabels } from './link-edit-block';
import { LinkEditBlock } from './link-edit-block';

/** Labels configuration for the link edit popover component */
export type LinkEditPopoverLabels = {
  /** Tooltip text for the trigger button */
  tooltip: string;
  /** Aria label for the trigger button */
  ariaLabel: string;
  /** Labels for the nested edit block */
  editBlock: Partial<LinkEditBlockLabels>;
};

const DEFAULT_LABELS: LinkEditPopoverLabels = {
  tooltip: 'Link',
  ariaLabel: 'Insert link',
  editBlock: {},
};

/** Props for the LinkEditPopover component */
export interface LinkEditPopoverProps extends VariantProps<typeof toggleVariants> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Custom labels for the popover */
  labels?: Partial<LinkEditPopoverLabels>;
}

/**
 * A popover component for inserting links in the TipTap editor.
 * Provides a toolbar button trigger and displays a LinkEditBlock in a popover.
 */
const LinkEditPopover = React.forwardRef<HTMLDivElement, LinkEditPopoverProps>(
  ({ editor, size, variant, labels }, ref) => {
    const [open, setOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const mergedLabels = React.useMemo(
      () => ({
        ...DEFAULT_LABELS,
        ...labels,
        editBlock: { ...DEFAULT_LABELS.editBlock, ...labels?.editBlock },
      }),
      [labels]
    );

    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');

    const onSetLink = React.useCallback(
      (url: string, text?: string, openInNewTab?: boolean) => {
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .insertContent({
            type: 'text',
            text: text || url,
            marks: [
              {
                type: 'link',
                attrs: {
                  href: url,
                  target: openInNewTab ? '_blank' : '',
                },
              },
            ],
          })
          .setLink({ href: url })
          .run();

        editor.commands.enter();
      },
      [editor]
    );

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    return (
      <div ref={containerRef} data-slot="link-edit-popover" data-testid="link-edit-popover">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <ToolbarButton
              isActive={editor.isActive('link')}
              tooltip={mergedLabels.tooltip}
              aria-label={mergedLabels.ariaLabel}
              disabled={editor.isActive('codeBlock')}
              size={size}
              variant={variant}
            >
              <Link2Icon className="size-5" />
            </ToolbarButton>
          </PopoverTrigger>
          <PopoverContent className="w-full min-w-80" align="end" side="bottom">
            <LinkEditBlock onSave={onSetLink} defaultText={text} labels={mergedLabels.editBlock} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

LinkEditPopover.displayName = 'LinkEditPopover';

export { LinkEditPopover };
export type { LinkEditPopoverProps as LinkEditPopoverComponentProps };

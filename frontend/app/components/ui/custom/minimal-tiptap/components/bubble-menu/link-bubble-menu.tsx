import * as React from 'react';
import type { ShouldShowProps } from '../../types';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { LinkEditBlock, type LinkEditBlockLabels } from '../link/link-edit-block';
import { LinkPopoverBlock, type LinkPopoverBlockLabels } from '../link/link-popover-block';

/** Labels configuration for the link bubble menu component */
export interface LinkBubbleMenuLabels {
  /** Labels for the link edit block */
  editBlock?: Partial<LinkEditBlockLabels>;
  /** Labels for the link popover block */
  popoverBlock?: Partial<LinkPopoverBlockLabels>;
}

/** Props for the LinkBubbleMenu component */
export interface LinkBubbleMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Custom labels for the bubble menu */
  labels?: LinkBubbleMenuLabels;
}

/** Internal interface for link attributes */
interface LinkAttributes {
  href: string;
  target: string;
}

/**
 * A bubble menu component for editing links in the TipTap editor.
 * Displays a popover when a link is selected, allowing users to edit or remove the link.
 */
const LinkBubbleMenu = React.forwardRef<HTMLDivElement, LinkBubbleMenuProps>(
  ({ editor, labels, ...props }, ref) => {
    const [showEdit, setShowEdit] = React.useState(false);
    const [linkAttrs, setLinkAttrs] = React.useState<LinkAttributes>({ href: '', target: '' });
    const [selectedText, setSelectedText] = React.useState('');

    const updateLinkState = React.useCallback(() => {
      const { from, to } = editor.state.selection;
      const { href, target } = editor.getAttributes('link');
      const text = editor.state.doc.textBetween(from, to, ' ');

      setLinkAttrs({ href, target });
      setSelectedText(text);
    }, [editor]);

    const shouldShow = React.useCallback(
      ({ editor, from, to }: ShouldShowProps) => {
        if (from === to) {
          return false;
        }
        const { href } = editor.getAttributes('link');

        if (!editor.isActive('link') || !editor.isEditable) {
          return false;
        }

        if (href) {
          updateLinkState();
          return true;
        }
        return false;
      },
      [updateLinkState]
    );

    const handleEdit = React.useCallback(() => {
      setShowEdit(true);
    }, []);

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
          .setLink({ href: url, target: openInNewTab ? '_blank' : '' })
          .run();
        setShowEdit(false);
        updateLinkState();
      },
      [editor, updateLinkState]
    );

    const onUnsetLink = React.useCallback(() => {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setShowEdit(false);
      updateLinkState();
    }, [editor, updateLinkState]);

    return (
      <BubbleMenu
        ref={ref}
        editor={editor}
        shouldShow={shouldShow}
        options={{
          placement: 'bottom-start',
          onHide: () => setShowEdit(false),
        }}
        data-slot="link-bubble-menu"
        data-testid="link-bubble-menu"
        {...props}
      >
        {showEdit ? (
          <LinkEditBlock
            defaultUrl={linkAttrs.href}
            defaultText={selectedText}
            defaultIsNewTab={linkAttrs.target === '_blank'}
            onSave={onSetLink}
            labels={labels?.editBlock}
            className="bg-popover text-popover-foreground w-full min-w-80 rounded-md border p-4 shadow-md outline-hidden"
          />
        ) : (
          <LinkPopoverBlock
            labels={labels?.popoverBlock}
            onClear={onUnsetLink}
            url={linkAttrs.href}
            onEdit={handleEdit}
          />
        )}
      </BubbleMenu>
    );
  }
);

LinkBubbleMenu.displayName = 'LinkBubbleMenu';

export { LinkBubbleMenu };
export type { LinkBubbleMenuProps as LinkBubbleMenuComponentProps };

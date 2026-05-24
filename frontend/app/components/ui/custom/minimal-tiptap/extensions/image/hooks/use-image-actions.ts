import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { Node } from '@tiptap/pm/model';
import { isUrl } from '../../../utils';

/**
 * Props for the useImageActions hook
 */
export interface UseImageActionsProps {
  /** TipTap editor instance */
  editor: Editor;
  /** The image node in the document */
  node: Node;
  /** Current source URL of the image */
  src: string;
  /** Callback when view/zoom is clicked */
  onViewClick: (value: boolean) => void;
}

/**
 * Handler functions for image actions
 */
export interface ImageActionHandlers {
  /** Handler for viewing/zooming the image */
  onView?: () => void;
  /** Handler for downloading the image */
  onDownload?: () => void;
  /** Handler for copying the image to clipboard */
  onCopy?: () => void;
  /** Handler for copying the image link */
  onCopyLink?: () => void;
  /** Handler for removing the image */
  onRemoveImg?: () => void;
}

/**
 * Return type for the useImageActions hook
 */
export interface UseImageActionsReturn extends ImageActionHandlers {
  /** Whether the image source is a URL */
  isLink: boolean;
  /** View/zoom the image */
  onView: () => void;
  /** Download the image */
  onDownload: () => void;
  /** Copy the image to clipboard */
  onCopy: () => void;
  /** Copy the image link */
  onCopyLink: () => void;
  /** Remove the image from the editor */
  onRemoveImg: () => void;
}

/**
 * Hook providing image action handlers for the editor
 * Manages view, download, copy, and remove operations
 * @param props - Configuration props including editor, node, and callbacks
 * @returns Object with action handlers and state
 */
export const useImageActions = ({
  editor,
  node,
  src,
  onViewClick,
}: UseImageActionsProps): UseImageActionsReturn => {
  const isLink = React.useMemo(() => isUrl(src), [src]);

  const onView = React.useCallback(() => {
    onViewClick(true);
  }, [onViewClick]);

  const onDownload = React.useCallback(() => {
    editor.commands.downloadImage({ src: node.attrs.src, alt: node.attrs.alt });
  }, [editor.commands, node.attrs.alt, node.attrs.src]);

  const onCopy = React.useCallback(() => {
    editor.commands.copyImage({ src: node.attrs.src });
  }, [editor.commands, node.attrs.src]);

  const onCopyLink = React.useCallback(() => {
    editor.commands.copyLink({ src: node.attrs.src });
  }, [editor.commands, node.attrs.src]);

  const onRemoveImg = React.useCallback(() => {
    editor.commands.command(({ tr, dispatch }) => {
      const { selection } = tr;
      const nodeAtSelection = tr.doc.nodeAt(selection.from);

      if (nodeAtSelection && nodeAtSelection.type.name === 'image') {
        if (dispatch) {
          tr.deleteSelection();
          return true;
        }
      }
      return false;
    });
  }, [editor.commands]);

  return { isLink, onView, onDownload, onCopy, onCopyLink, onRemoveImg };
};

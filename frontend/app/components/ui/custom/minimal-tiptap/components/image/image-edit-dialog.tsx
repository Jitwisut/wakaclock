import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { VariantProps } from 'class-variance-authority';
import type { toggleVariants } from '@/components/ui/toggle';
import { ImageIcon } from '@radix-ui/react-icons';
import { ToolbarButton } from '../toolbar-button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ImageEditBlock, type ImageEditBlockLabels } from './image-edit-block';

/** Props for the ImageEditDialog component */
export interface ImageEditDialogProps extends VariantProps<typeof toggleVariants> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Custom labels for the dialog */
  labels?: Partial<ImageEditDialogLabels>;
}

/** Labels configuration for the image edit dialog component */
export type ImageEditDialogLabels = {
  /** Label for the trigger button tooltip */
  trigger: string;
  /** Title of the dialog */
  dialogTitle: string;
  /** Description of the dialog */
  dialogDescription: string;
  /** Labels for the nested edit block */
  editBlock?: Partial<ImageEditBlockLabels>;
};

const defaultLabels: ImageEditDialogLabels = {
  trigger: 'Image',
  dialogTitle: 'Select image',
  dialogDescription: 'Upload an image from your computer',
};

/**
 * A dialog component for inserting and editing images in the TipTap editor.
 * Provides a toolbar button trigger and displays an ImageEditBlock in a modal.
 */
const ImageEditDialog = React.forwardRef<HTMLDivElement, ImageEditDialogProps>(
  ({ editor, size, variant, labels: labelsProp }, ref) => {
    const [open, setOpen] = React.useState(false);
    const labels = { ...defaultLabels, ...(labelsProp ?? {}) };
    const titleId = 'image-edit-title';

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <ToolbarButton
            isActive={editor.isActive('image')}
            tooltip={labels.trigger}
            aria-label={labels.trigger}
            disabled={!editor.isEditable || editor.isActive('codeBlock')}
            size={size}
            variant={variant}
          >
            <ImageIcon className="size-5" />
          </ToolbarButton>
        </DialogTrigger>
        <DialogContent
          ref={ref}
          data-slot="image-edit-dialog"
          data-testid="image-edit-dialog"
          className="sm:max-w-lg"
          aria-labelledby={titleId}
        >
          <DialogHeader>
            <DialogTitle id={titleId}>{labels.dialogTitle}</DialogTitle>
            <DialogDescription className="sr-only">{labels.dialogDescription}</DialogDescription>
          </DialogHeader>
          <ImageEditBlock editor={editor} close={() => setOpen(false)} labels={labels.editBlock} />
        </DialogContent>
      </Dialog>
    );
  }
);

ImageEditDialog.displayName = 'ImageEditDialog';

export { ImageEditDialog };

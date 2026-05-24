import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/** Labels configuration for the image edit block component */
export type ImageEditBlockLabels = {
  /** Label for the attach link input */
  attachLink: string;
  /** Placeholder text for the URL input */
  placeholder: string;
  /** Label for the submit button */
  submit: string;
  /** Label for the upload button */
  upload: string;
  /** Aria label for the file input */
  fileInputAriaLabel: string;
};

const defaultLabels: ImageEditBlockLabels = {
  attachLink: 'Attach an image link',
  placeholder: 'https://example.com',
  submit: 'Submit',
  upload: 'Upload from your computer',
  fileInputAriaLabel: 'Upload image files',
};

/** Props for the ImageEditBlock component */
export interface ImageEditBlockProps extends React.HTMLAttributes<HTMLFormElement> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Callback to close the edit block */
  close: () => void;
  /** Custom labels for the edit block */
  labels?: Partial<ImageEditBlockLabels>;
}

/**
 * A form component for editing images in the TipTap editor.
 * Allows users to insert images via URL or file upload.
 */
export const ImageEditBlock = React.forwardRef<HTMLFormElement, ImageEditBlockProps>(
  ({ editor, close, labels: labelsProp, className, ...props }, ref) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [link, setLink] = React.useState('');

    const labels = React.useMemo(() => ({ ...defaultLabels, ...(labelsProp ?? {}) }), [labelsProp]);

    const handleClick = React.useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const handleFile = React.useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length) return;

        const insertImages = async () => {
          const contentBucket = [];
          const filesArray = Array.from(files);

          for (const file of filesArray) {
            contentBucket.push({ src: file });
          }

          editor.commands.setImages(contentBucket);
        };

        await insertImages();
        e.target.value = '';
        close();
      },
      [editor, close]
    );

    const handleSubmit = React.useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (link) {
          editor.commands.setImages([{ src: link }]);
          close();
        }
      },
      [editor, link, close]
    );

    return (
      <form
        ref={ref}
        data-slot="image-edit-block"
        data-testid="image-edit-block"
        onSubmit={handleSubmit}
        className={className ?? 'space-y-6'}
        {...props}
      >
        <div className="space-y-1">
          <Label htmlFor="image-link">{labels.attachLink}</Label>
          <div className="flex">
            <Input
              id="image-link"
              type="url"
              required
              placeholder={labels.placeholder}
              value={link}
              className="grow"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLink(e.target.value)}
            />
            <Button type="submit" className="ml-2">
              {labels.submit}
            </Button>
          </div>
        </div>
        <Button type="button" className="w-full" onClick={handleClick}>
          {labels.upload}
        </Button>
        <input
          aria-label={labels.fileInputAriaLabel}
          type="file"
          accept="image/*"
          ref={fileInputRef}
          multiple
          className="hidden"
          onChange={handleFile}
        />
      </form>
    );
  }
);

ImageEditBlock.displayName = 'ImageEditBlock';

export default ImageEditBlock;

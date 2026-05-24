import type { ImageOptions } from '@tiptap/extension-image';
import { Image as TiptapImage } from '@tiptap/extension-image';
import type { Editor } from '@tiptap/react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageViewBlock } from './components/image-view-block';
import type { UploadReturnType } from './types';
import { filterFiles, randomId, type FileError, type FileValidationOptions } from '../../utils';
import { ReplaceStep } from '@tiptap/pm/transform';
import type { Attrs } from '@tiptap/pm/model';

export type { UploadReturnType };

/**
 * Available image actions that can be performed on an image
 */
export type ImageAction = 'download' | 'copyImage' | 'copyLink';

/**
 * Props for the download image command
 */
export interface DownloadImageCommandProps {
  /** Source URL of the image */
  src: string;
  /** Alternative text for the image */
  alt?: string;
}

/**
 * Props for image action operations, extending download props with action type
 */
export interface ImageActionProps extends DownloadImageCommandProps {
  /** The type of action being performed */
  action: ImageAction;
}

/**
 * Configuration options for the custom image extension
 * Extends TipTap's ImageOptions with additional functionality
 */
export interface CustomImageOptions
  extends ImageOptions, Omit<FileValidationOptions, 'allowBase64'> {
  /** Function to upload an image file to a server */
  uploadFn?: (file: File, editor: Editor) => Promise<UploadReturnType>;
  /** Callback when an image is removed from the editor */
  onImageRemoved?: (props: Attrs) => void;
  /** Callback when an image action succeeds */
  onActionSuccess?: (props: ImageActionProps) => void;
  /** Callback when an image action fails */
  onActionError?: (error: Error, props: ImageActionProps) => void;
  /** Custom download image handler */
  downloadImage?: (props: ImageActionProps, options: CustomImageOptions) => Promise<void>;
  /** Custom copy image handler */
  copyImage?: (props: ImageActionProps, options: CustomImageOptions) => Promise<void>;
  /** Custom copy link handler */
  copyLink?: (props: ImageActionProps, options: CustomImageOptions) => Promise<void>;
  /** Callback when file validation fails */
  onValidationError?: (errors: FileError[]) => void;
  /** Callback when image toggle is triggered */
  onToggle?: (editor: Editor, files: File[], pos: number) => void;
}

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    setImages: {
      setImages: (attrs: { src: string | File; alt?: string; title?: string }[]) => ReturnType;
    };
    downloadImage: {
      downloadImage: (attrs: DownloadImageCommandProps) => ReturnType;
    };
    copyImage: {
      copyImage: (attrs: DownloadImageCommandProps) => ReturnType;
    };
    copyLink: {
      copyLink: (attrs: DownloadImageCommandProps) => ReturnType;
    };
    toggleImage: {
      toggleImage: () => ReturnType;
    };
  }
}

/**
 * Handles errors from image actions and invokes the error handler if provided
 * @param error - The error that occurred
 * @param props - The image action props
 * @param errorHandler - Optional error handler callback
 */
const handleError = (
  error: unknown,
  props: ImageActionProps,
  errorHandler?: (error: Error, props: ImageActionProps) => void
): void => {
  const typedError = error instanceof Error ? error : new Error('Unknown error');
  errorHandler?.(typedError, props);
};

/**
 * Converts a data URL to a blob with its file extension
 * @param src - The data URL string
 * @returns Object containing the blob and file extension
 */
const handleDataUrl = (src: string): { blob: Blob; extension: string } => {
  const [header, base64Data] = src.split(',');
  const mimeType = header.split(':')[1].split(';')[0];
  const extension = mimeType.split('/')[1];
  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });
  return { blob, extension };
};

/**
 * Fetches an image from a URL and returns it as a blob with extension
 * @param src - The image URL
 * @returns Promise resolving to object with blob and extension
 */
const handleImageUrl = async (src: string): Promise<{ blob: Blob; extension: string }> => {
  const response = await fetch(src);
  if (!response.ok) throw new Error('Failed to fetch image');
  const blob = await response.blob();
  const extension = blob.type.split(/\/|\+/)[1];
  return { blob, extension };
};

/**
 * Fetches an image blob from either a data URL or remote URL
 * @param src - The image source (data URL or remote URL)
 * @returns Promise resolving to object with blob and extension
 */
const fetchImageBlob = async (src: string): Promise<{ blob: Blob; extension: string }> => {
  return src.startsWith('data:') ? handleDataUrl(src) : handleImageUrl(src);
};

/**
 * Saves an image blob to the user's device
 * @param blob - The image blob to save
 * @param name - The filename (without extension)
 * @param extension - The file extension
 */
const saveImage = async (blob: Blob, name: string, extension: string): Promise<void> => {
  const imageURL = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = imageURL;
  link.download = `${name}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(imageURL);
};

/**
 * Downloads an image to the user's device
 * @param props - The image action props containing src and alt
 * @param options - The custom image options with callbacks
 */
const downloadImage = async (
  props: ImageActionProps,
  options: CustomImageOptions
): Promise<void> => {
  const { src, alt } = props;
  const potentialName = alt || 'image';

  try {
    const { blob, extension } = await fetchImageBlob(src);
    await saveImage(blob, potentialName, extension);
    options.onActionSuccess?.({ ...props, action: 'download' });
  } catch (error) {
    handleError(error, { ...props, action: 'download' }, options.onActionError);
  }
};

/**
 * Copies an image to the clipboard
 * @param props - The image action props containing src
 * @param options - The custom image options with callbacks
 */
const copyImage = async (props: ImageActionProps, options: CustomImageOptions): Promise<void> => {
  const { src } = props;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    options.onActionSuccess?.({ ...props, action: 'copyImage' });
  } catch (error) {
    handleError(error, { ...props, action: 'copyImage' }, options.onActionError);
  }
};

/**
 * Copies the image link to the clipboard
 * @param props - The image action props containing src
 * @param options - The custom image options with callbacks
 */
const copyLink = async (props: ImageActionProps, options: CustomImageOptions): Promise<void> => {
  const { src } = props;
  try {
    await navigator.clipboard.writeText(src);
    options.onActionSuccess?.({ ...props, action: 'copyLink' });
  } catch (error) {
    handleError(error, { ...props, action: 'copyLink' }, options.onActionError);
  }
};

/**
 * Custom TipTap image extension with enhanced functionality
 * Supports image upload, download, copy, and resize operations
 */
export const Image = TiptapImage.extend<CustomImageOptions>({
  atom: true,

  addOptions(): CustomImageOptions {
    return {
      ...this.parent?.(),
      inline: false,
      allowBase64: false,
      allowedMimeTypes: [],
      maxFileSize: 0,
      uploadFn: undefined,
      onToggle: undefined,
      downloadImage: undefined,
      copyImage: undefined,
      copyLink: undefined,
      HTMLAttributes: {},
      resize: { enabled: false },
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      id: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
      fileName: {
        default: null,
      },
    };
  },

  addCommands() {
    return {
      setImages:
        (attrs) =>
        ({ commands }) => {
          const [validImages, errors] = filterFiles(attrs, {
            allowedMimeTypes: this.options.allowedMimeTypes,
            maxFileSize: this.options.maxFileSize,
            allowBase64: this.options.allowBase64,
          });

          if (errors.length > 0 && this.options.onValidationError) {
            this.options.onValidationError(errors);
          }

          if (validImages.length > 0) {
            return commands.insertContent(
              validImages.map((image) => {
                if (image.src instanceof File) {
                  const blobUrl = URL.createObjectURL(image.src);
                  const id = randomId();

                  return {
                    type: this.type.name,
                    attrs: {
                      id,
                      src: blobUrl,
                      alt: image.alt,
                      title: image.title,
                      fileName: image.src.name,
                    },
                  };
                } else {
                  return {
                    type: this.type.name,
                    attrs: {
                      id: randomId(),
                      src: image.src,
                      alt: image.alt,
                      title: image.title,
                      fileName: null,
                    },
                  };
                }
              })
            );
          }

          return false;
        },

      downloadImage: (attrs) => () => {
        const downloadFunc = this.options.downloadImage || downloadImage;
        void downloadFunc({ ...attrs, action: 'download' }, this.options);
        return true;
      },

      copyImage: (attrs) => () => {
        const copyImageFunc = this.options.copyImage || copyImage;
        void copyImageFunc({ ...attrs, action: 'copyImage' }, this.options);
        return true;
      },

      copyLink: (attrs) => () => {
        const copyLinkFunc = this.options.copyLink || copyLink;
        void copyLinkFunc({ ...attrs, action: 'copyLink' }, this.options);
        return true;
      },

      toggleImage:
        () =>
        ({ editor }) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = this.options.allowedMimeTypes.join(',');
          input.onchange = () => {
            const files = input.files;
            if (!files) return;

            const [validImages, errors] = filterFiles(Array.from(files), {
              allowedMimeTypes: this.options.allowedMimeTypes,
              maxFileSize: this.options.maxFileSize,
              allowBase64: this.options.allowBase64,
            });

            if (errors.length > 0 && this.options.onValidationError) {
              this.options.onValidationError(errors);
              return false;
            }

            if (validImages.length === 0) return false;

            if (this.options.onToggle) {
              this.options.onToggle(editor, validImages, editor.state.selection.from);
            }

            return false;
          };

          input.click();
          return true;
        },
    };
  },

  onTransaction({ transaction }) {
    transaction.steps.forEach((step) => {
      if (step instanceof ReplaceStep && step.slice.size === 0) {
        const deletedPages = transaction.before.content.cut(step.from, step.to);

        deletedPages.forEach((node) => {
          if (node.type.name === 'image') {
            const attrs = node.attrs;

            if (attrs.src.startsWith('blob:')) {
              URL.revokeObjectURL(attrs.src);
            }

            this.options.onImageRemoved?.(attrs);
          }
        });
      }
    });
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageViewBlock, {
      className: 'block-node',
    });
  },
});

export default Image;

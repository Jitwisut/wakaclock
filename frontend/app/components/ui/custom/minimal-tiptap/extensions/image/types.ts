/**
 * Return type for image upload functions
 * Can be a simple string URL or an object with id and src
 */
export type UploadReturnType =
  | string
  | {
      /** Unique identifier for the uploaded image */
      id: string | number;
      /** URL of the uploaded image */
      src: string;
    };

/**
 * Image upload result with full metadata
 * Contains all information returned after a successful upload
 */
export interface ImageUploadResult {
  /** Unique identifier for the uploaded image */
  id: string | number;
  /** URL of the uploaded image */
  src: string;
  /** Alternative text for accessibility */
  alt?: string;
  /** Title attribute for the image */
  title?: string;
  /** Width of the image in pixels */
  width?: number;
  /** Height of the image in pixels */
  height?: number;
}

/**
 * Image node attributes used in the TipTap editor
 * Represents the data stored for each image node
 */
export interface ImageNodeAttributes {
  /** Source URL of the image */
  src: string | null;
  /** Alternative text for accessibility */
  alt: string | null;
  /** Title attribute for the image */
  title: string | null;
  /** Unique identifier for the image */
  id: string | null;
  /** Width of the image in pixels */
  width: number | null;
  /** Height of the image in pixels */
  height: number | null;
  /** Original filename of the uploaded image */
  fileName: string | null;
}

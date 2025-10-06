/**
 * Types for PDF page to image conversion
 */

/**
 * Image format for page conversion
 */
export type PageImageFormat = "png" | "jpg" | "jpeg" | "webp";

/**
 * Options for converting PDF pages to images
 */
export interface PageToImageOptions {
  /**
   * Output directory for image files
   * @default './page-images'
   */
  outputDir?: string;

  /**
   * Image format
   * @default 'png'
   */
  format?: PageImageFormat;

  /**
   * JPEG quality (1-100, only for JPG format)
   * @default 90
   */
  quality?: number;

  /**
   * DPI (dots per inch) for rendering
   * Higher DPI = better quality but larger files
   * @default 72
   */
  dpi?: number;

  /**
   * Scale factor (multiplier for dimensions)
   * @default 1
   */
  scale?: number;

  /**
   * Specific pages to convert (1-based)
   * If not provided, converts all pages
   * @example [1, 3, 5]
   */
  pages?: number[];

  /**
   * Page range to convert (e.g., "1-5", "1,3,5-10")
   * If not provided, converts all pages
   * @example "1-5"
   */
  pageRange?: string;

  /**
   * Filename pattern for output files
   * Available placeholders: {page}, {total}, {name}
   * @default 'page-{page}.{ext}'
   */
  filenamePattern?: string;

  /**
   * Background color for transparent PDFs
   * @default '#FFFFFF'
   */
  backgroundColor?: string;

  /**
   * Enable transparent background (PNG only)
   * @default false
   */
  transparent?: boolean;

  /**
   * Crop to content (remove white margins)
   * @default false
   */
  cropToContent?: boolean;

  /**
   * Progress callback
   */
  onProgress?: (current: number, total: number, percentage: number) => void;

  /**
   * Callback when a page is converted
   */
  onPageComplete?: (pageNumber: number, filepath: string) => void;

  /**
   * Verbose logging
   * @default false
   */
  verbose?: boolean;
}

/**
 * Result of page to image conversion
 */
export interface PageImageResult {
  /**
   * Page number (1-based)
   */
  page: number;

  /**
   * Output file path
   */
  filepath: string;

  /**
   * Image width in pixels
   */
  width: number;

  /**
   * Image height in pixels
   */
  height: number;

  /**
   * File size in bytes
   */
  fileSize: number;

  /**
   * Image format
   */
  format: PageImageFormat;
}

/**
 * Result of converting all pages
 */
export interface PageToImageResult {
  /**
   * Array of converted page images
   */
  images: PageImageResult[];

  /**
   * Total number of pages converted
   */
  totalPages: number;

  /**
   * Output directory
   */
  outputDir: string;

  /**
   * Total size of all images in bytes
   */
  totalSize: number;
}

/**
 * Options for converting a single page
 */
export interface SinglePageOptions {
  /**
   * Image format
   * @default 'png'
   */
  format?: PageImageFormat;

  /**
   * JPEG quality (1-100)
   * @default 90
   */
  quality?: number;

  /**
   * DPI for rendering
   * @default 72
   */
  dpi?: number;

  /**
   * Scale factor
   * @default 1
   */
  scale?: number;

  /**
   * Background color
   * @default '#FFFFFF'
   */
  backgroundColor?: string;

  /**
   * Transparent background (PNG only)
   * @default false
   */
  transparent?: boolean;
}

/**
 * Thumbnail generation options
 */
export interface ThumbnailOptions extends SinglePageOptions {
  /**
   * Maximum width in pixels
   * @default 200
   */
  maxWidth?: number;

  /**
   * Maximum height in pixels
   * @default 200
   */
  maxHeight?: number;

  /**
   * Maintain aspect ratio
   * @default true
   */
  maintainAspectRatio?: boolean;
}


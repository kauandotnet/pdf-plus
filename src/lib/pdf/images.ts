/**
 * PDF Image Extraction Utilities
 *
 * Provides access to embedded images in PDF documents.
 * This is a thin wrapper around the existing ImageExtractor for consistency.
 */

import type { PDFSource } from "./types.js";
import type { ImageItem, ExtractionOptions } from "../../types/index.js";
import { ImageExtractor } from "../../extractors/image/image-extractor.js";

/**
 * Options for image extraction
 */
export interface ImageExtractionOptions {
  /** Extract image files to disk (default: false) */
  extractFiles?: boolean;
  /** Output directory for extracted images */
  outputDir?: string;
  /** Convert JPEG2000 to JPG (default: true) */
  convertJp2ToJpg?: boolean;
  /** Optimize extracted images (default: false) */
  optimize?: boolean;
  /** Optimization quality (0-100, default: 80) */
  quality?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Result of image extraction
 */
export interface ImageExtractionResult {
  /** Array of extracted images */
  images: ImageItem[];
  /** Total number of images found */
  count: number;
  /** Output directory (if files were extracted) */
  outputDir?: string;
}

/**
 * Extract images from a PDF document
 *
 * @param source - File path or buffer
 * @param options - Extraction options
 * @returns Extraction result with images
 *
 * @example
 * ```typescript
 * // Get image metadata only
 * const result = await extractImages('document.pdf');
 * console.log(`Found ${result.count} images`);
 *
 * // Extract to files
 * const result = await extractImages('document.pdf', {
 *   extractFiles: true,
 *   outputDir: './images'
 * });
 * ```
 */
export async function extractImages(
  source: PDFSource,
  options: ImageExtractionOptions = {}
): Promise<ImageExtractionResult> {
  // Convert source to file path if it's a buffer
  // ImageExtractor currently requires a file path
  if (typeof source !== "string") {
    throw new Error(
      "Image extraction currently requires a file path. Buffer support coming soon."
    );
  }

  const extractor = new ImageExtractor();

  const extractorOptions: ExtractionOptions = {
    extractImageFiles: options.extractFiles ?? false,
    imageOutputDir: options.outputDir,
    convertJp2ToJpg: options.convertJp2ToJpg ?? true,
    optimizeImages: options.optimize ?? false,
    imageQuality: options.quality ?? 80,
    verbose: options.verbose ?? false,
  };

  const result = await extractor.extract(source, extractorOptions);

  return {
    images: result.images || [],
    count: result.images?.length || 0,
    outputDir: options.outputDir,
  };
}

/**
 * Get image count from a PDF without full extraction
 *
 * @param source - File path
 * @returns Number of images
 */
export async function getImageCount(source: string): Promise<number> {
  const result = await extractImages(source, {
    extractFiles: false,
    verbose: false,
  });
  return result.count;
}

/**
 * pdfnode - A comprehensive PDF content extraction library
 *
 * Main entry point for the PDF content extraction library.
 * Provides both high-level convenience functions and low-level access to extractors.
 */

// Core exports
export { PDFExtractor, pdfExtractor } from "./core/extractor.js";

// Extractor classes
export { TextExtractor } from "./extractors/text-extractor.js";
export { ImageExtractor } from "./extractors/image-extractor.js";

// Image extraction engines (coming soon)
// export {
//   BaseImageEngine,
//   PdfLibEngine,
//   PopplerEngine,
//   ImageEngineFactory,
// } from "./extractors/engines/index.js";

// Utilities
export { FormatProcessor } from "./utils/format-processor.js";
export {
  validateConfig,
  validateImageRefFormat,
  validateFilePath,
} from "./utils/validation.js";

// Types
export type {
  Position,
  FontInfo,
  TextItem,
  ImageItem,
  PageInfo,
  DocumentMetadata,
  ExtractionResult,
  DocumentSummary,
  ExtractionOptions,
  ProgressInfo,
  ExtractorConfig,
  ValidationError,
  ExtractionError,
  FormatPlaceholder,
  FormatContext,
  ProcessingPhase,
  ImageExtractionEngine,
  MemoryUsage,
  StreamingOptions,
  OCROptions,
  AnalyticsData,
  TemplateOptions,
} from "./types/index.js";

// Convenience functions
import { pdfExtractor } from "./core/extractor.js";

/**
 * Extract content from a PDF file (convenience function)
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options
 * @returns Promise resolving to extraction result
 *
 * @example
 * ```typescript
 * import { extractPdfContent } from 'pdfnode';
 *
 * const result = await extractPdfContent('document.pdf', {
 *   extractText: true,
 *   extractImages: true,
 *   verbose: true
 * });
 *
 * console.log(`Extracted ${result.images.length} images from ${result.document.pages} pages`);
 * ```
 */
export async function extractPdfContent(
  pdfPath: string,
  options: import("./types/index.js").ExtractionOptions = {}
) {
  return pdfExtractor.extract(pdfPath, options);
}

/**
 * Extract only text content from a PDF (convenience function)
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options
 * @returns Promise resolving to text content
 *
 * @example
 * ```typescript
 * import { extractText } from 'pdfnode';
 *
 * const text = await extractText('document.pdf');
 * console.log(`Extracted ${text.length} characters`);
 * ```
 */
export async function extractText(
  pdfPath: string,
  options: Partial<import("./types/index.js").ExtractionOptions> = {}
) {
  return pdfExtractor.extractText(pdfPath, options);
}

/**
 * Extract only image references from a PDF (convenience function)
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options
 * @returns Promise resolving to array of image items
 *
 * @example
 * ```typescript
 * import { extractImages } from 'pdfnode';
 *
 * const images = await extractImages('document.pdf', {
 *   extractImageFiles: true,
 *   imageOutputDir: './my-images'
 * });
 *
 * console.log(`Extracted ${images.length} images`);
 * ```
 */
export async function extractImages(
  pdfPath: string,
  options: Partial<import("./types/index.js").ExtractionOptions> = {}
) {
  return pdfExtractor.extractImages(pdfPath, options);
}

/**
 * Extract and save image files from a PDF (convenience function)
 *
 * @param pdfPath - Path to the PDF file
 * @param outputDir - Directory to save images
 * @param options - Extraction options
 * @returns Promise resolving to array of saved file paths
 *
 * @example
 * ```typescript
 * import { extractImageFiles } from 'pdfnode';
 *
 * const filePaths = await extractImageFiles('document.pdf', './images', {
 *   verbose: true
 * });
 *
 * console.log(`Saved ${filePaths.length} image files`);
 * ```
 */
export async function extractImageFiles(
  pdfPath: string,
  outputDir: string = "./extracted-images",
  options: Partial<import("./types/index.js").ExtractionOptions> = {}
) {
  return pdfExtractor.extractImageFiles(pdfPath, outputDir, options);
}

// Version information
export const version = "1.0.0";

// Import for default export
import { PDFExtractor } from "./core/extractor.js";
import { TextExtractor } from "./extractors/text-extractor.js";
import { ImageExtractor } from "./extractors/image-extractor.js";
import { FormatProcessor } from "./utils/format-processor.js";
import {
  validateConfig,
  validateImageRefFormat,
  validateFilePath,
} from "./utils/validation.js";

// Default export for CommonJS compatibility
export default {
  PDFExtractor,
  pdfExtractor,
  TextExtractor,
  ImageExtractor,
  FormatProcessor,
  extractPdfContent,
  extractText,
  extractImages,
  extractImageFiles,
  validateConfig,
  validateImageRefFormat,
  validateFilePath,
  version,
};

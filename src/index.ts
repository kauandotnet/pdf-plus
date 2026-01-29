/**
 * pdf-plus - A comprehensive PDF content extraction library
 *
 * Main entry point for the PDF content extraction library.
 * Provides both high-level convenience functions and low-level access to extractors.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Exports
// ============================================================================

export { PDFExtractor, pdfExtractor } from "./core/extractor.js";
export { StreamingPDFExtractor } from "./core/streaming-extractor.js";

// ============================================================================
// Extractor Classes
// ============================================================================

export {
  TextExtractor,
  StructuredTextExtractor,
} from "./extractors/text/index.js";
export { ImageExtractor } from "./extractors/image/index.js";
export { PageToImageConverter } from "./extractors/page-to-image/index.js";
export { TableExtractor } from "./extractors/table/index.js";

// ============================================================================
// Processors & Optimizers
// ============================================================================

export {
  ImageOptimizer,
  type OptimizationResult,
  type OptimizationOptions,
} from "./optimizers/index.js";

export { FormatProcessor } from "./utils/format-processor.js";

// ============================================================================
// Internal PDF Utils Library
// ============================================================================

export * as pdfUtils from "./lib/pdf/index.js";

// ============================================================================
// Utilities
// ============================================================================

export {
  validateConfig,
  validateImageRefFormat,
  validateFilePath,
} from "./utils/validation.js";

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core types
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

  // Processing types
  FormatPlaceholder,
  FormatContext,
  ProcessingPhase,

  // Advanced types
  MemoryUsage,
  StreamingOptions,
  OCROptions,
  AnalyticsData,
  TemplateOptions,

  // Table types
  Table,
  TableRow,
  TableColumn,
  TableCell,
  TableExtractionOptions,
  TableExtractionResult,
} from "./types/index.js";

// ============================================================================
// Page to Image Types
// ============================================================================

export type {
  PageToImageOptions,
  PageToImageResult,
  PageImageResult,
  SinglePageOptions,
  ThumbnailOptions,
  PageImageFormat,
} from "./types/page-to-image-types.js";

// ============================================================================
// Streaming Types
// ============================================================================

export type {
  StreamingExtractionResult,
  StreamEvent,
  StreamEventType,
  StartEvent,
  PageEvent,
  ImageEvent,
  ProgressEvent,
  CompleteEvent,
  ErrorEvent,
  StreamingStats,
  StreamingState,
  StreamEventCallbacks,
} from "./types/streaming-types.js";

// ============================================================================
// Internal Imports (for convenience functions)
// ============================================================================

import type {
  ExtractionOptions,
  ExtractionResult,
  ImageItem,
  TableExtractionOptions,
  TableExtractionResult,
} from "./types/index.js";
import type { StreamingExtractionResult } from "./types/streaming-types.js";
import { PDFExtractor, pdfExtractor } from "./core/extractor.js";
import { StreamingPDFExtractor } from "./core/streaming-extractor.js";
import { TextExtractor } from "./extractors/text/text-extractor.js";
import { ImageExtractor } from "./extractors/image/image-extractor.js";
import {
  TableExtractor,
  extractTables as extractTablesInternal,
} from "./extractors/table/index.js";
import { ImageOptimizer } from "./optimizers/index.js";
import { FormatProcessor } from "./utils/format-processor.js";
import {
  validateConfig,
  validateImageRefFormat,
  validateFilePath,
} from "./utils/validation.js";

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Extract content from a PDF file (convenience function)
 *
 * Automatically switches to streaming mode for large PDFs if `autoStreamThreshold` is set.
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options
 * @returns Promise resolving to extraction result or streaming result
 *
 * @example
 * ```typescript
 * import { extractPdfContent } from 'pdf-plus';
 *
 * const result = await extractPdfContent('document.pdf', {
 *   extractText: true,
 *   extractImages: true,
 *   verbose: true
 * });
 *
 * console.log(`Extracted ${result.images.length} images from ${result.document.pages} pages`);
 * ```
 *
 * @example
 * ```typescript
 * // Auto-streaming for large PDFs
 * const result = await extractPdfContent('large-document.pdf', {
 *   extractImageFiles: true,
 *   autoStreamThreshold: 100, // Auto-stream if > 100 pages
 * });
 * ```
 */
export async function extractPdfContent(
  pdfPath: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult | StreamingExtractionResult> {
  // Check if auto-streaming should be enabled
  // Only auto-enable if streamMode is not explicitly set to false
  if (
    options.autoStreamThreshold &&
    options.streamMode !== false && // Allow auto-streaming unless explicitly disabled
    options.autoStreamThreshold > 0
  ) {
    // Get page count to determine if we should stream
    const quickResult = await pdfExtractor.extract(pdfPath, {
      extractText: true, // Need at least one enabled for validation
      extractImages: false,
      extractImageFiles: false,
      verbose: false,
    });

    const pageCount = quickResult.document.pages;

    if (pageCount > options.autoStreamThreshold) {
      if (options.verbose) {
        console.log(
          `📊 Auto-enabling streaming mode (${pageCount} pages > ${options.autoStreamThreshold} threshold)`
        );
      }
      // Return streaming result
      return extractPdfStream(pdfPath, { ...options, streamMode: true });
    }
  }

  // Standard extraction
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
 * import { extractText } from 'pdf-plus';
 *
 * const text = await extractText('document.pdf');
 * console.log(`Extracted ${text.length} characters`);
 * ```
 */
export async function extractText(
  pdfPath: string,
  options: Partial<ExtractionOptions> = {}
): Promise<string> {
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
 * import { extractImages } from 'pdf-plus';
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
  options: Partial<ExtractionOptions> = {}
): Promise<ImageItem[]> {
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
 * import { extractImageFiles } from 'pdf-plus';
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
  options: Partial<ExtractionOptions> = {}
): Promise<string[]> {
  return pdfExtractor.extractImageFiles(pdfPath, outputDir, options);
}

/**
 * Generate page images from a PDF (render pages to image files)
 *
 * This is a convenience function to render PDF pages to images without
 * extracting embedded images or text. Perfect for creating page previews
 * or thumbnails.
 *
 * @param pdfPath - Path to the PDF file
 * @param outputDir - Directory to save page images
 * @param options - Page rendering options
 * @returns Promise resolving to array of generated image file paths
 *
 * @example
 * ```typescript
 * import { generatePageImages } from 'pdf-plus';
 *
 * const imagePaths = await generatePageImages('document.pdf', './page-images', {
 *   pageImageFormat: 'jpg',
 *   pageImageDpi: 150,
 *   pageRenderEngine: 'poppler'
 * });
 *
 * console.log(`Generated ${imagePaths.length} page images`);
 * ```
 */
export async function generatePageImages(
  pdfPath: string,
  outputDir: string = "./page-images",
  options: Partial<ExtractionOptions> = {}
): Promise<string[]> {
  return pdfExtractor.generatePageImages(pdfPath, outputDir, options);
}

/**
 * Extract PDF content in streaming mode (Phase 4 - NEW!)
 *
 * For large PDFs, this provides a streaming API that processes pages one at a time,
 * reducing memory usage and providing real-time progress updates.
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction and streaming options
 * @returns StreamingExtractionResult with async iterator and event callbacks
 *
 * @example
 * ```typescript
 * // Using async iterator
 * const stream = extractPdfStream('large-document.pdf', {
 *   extractImageFiles: true,
 *   imageOutputDir: './images',
 *   streamMode: true
 * });
 *
 * for await (const event of stream) {
 *   if (event.type === 'page') {
 *     console.log(`Processed page ${event.pageNumber}/${event.totalPages}`);
 *   } else if (event.type === 'progress') {
 *     console.log(`Progress: ${event.percentComplete.toFixed(1)}%`);
 *   }
 * }
 *
 * // Using event callbacks
 * const stream = extractPdfStream('large-document.pdf', { streamMode: true })
 *   .on('page', (event) => console.log(`Page ${event.pageNumber} done`))
 *   .on('progress', (event) => console.log(`${event.percentComplete}% complete`))
 *   .on('complete', (event) => console.log(`Done! ${event.totalImages} images`));
 *
 * for await (const event of stream) {
 *   // Events are also available via iterator
 * }
 * ```
 */
export function extractPdfStream(
  pdfPath: string,
  options: Partial<ExtractionOptions> = {}
): StreamingExtractionResult {
  // Use static import instead of require
  return new StreamingPDFExtractor(pdfPath, options);
}

/**
 * Extract tables from a PDF file (convenience function)
 *
 * Detects and extracts tables from a PDF document using text positioning data.
 * Tables are detected through spatial clustering of text items.
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Table extraction options
 * @returns Promise resolving to table extraction result
 *
 * @example
 * ```typescript
 * import { extractTables, TableExtractor } from 'pdf-plus';
 *
 * // Using convenience function
 * const result = await extractTables('document.pdf', {
 *   pages: [1, 2, 3],
 *   detectHeaders: true,
 *   minRows: 2,
 *   minColumns: 2
 * });
 *
 * console.log(`Found ${result.tableCount} tables`);
 *
 * // Access table data
 * for (const table of result.tables) {
 *   console.log(`Table on page ${table.page}: ${table.rowCount}x${table.columnCount}`);
 *
 *   // Convert to different formats
 *   const extractor = new TableExtractor();
 *   console.log(extractor.tableToMarkdown(table));
 *   console.log(extractor.tableToCSV(table));
 * }
 * ```
 */
export async function extractTables(
  pdfPath: string,
  options?: TableExtractionOptions
): Promise<TableExtractionResult> {
  return extractTablesInternal(pdfPath, options);
}

// ============================================================================
// Version & Metadata
// ============================================================================

/**
 * Library version
 */
export const version = "1.0.3";

// ============================================================================
// Default Export (CommonJS compatibility)
// ============================================================================

/**
 * Default export containing all public APIs
 * Useful for CommonJS: const pdfPlus = require('pdf-plus');
 */
export default {
  // Classes
  PDFExtractor,
  pdfExtractor,
  StreamingPDFExtractor,
  TextExtractor,
  ImageExtractor,
  TableExtractor,
  ImageOptimizer,
  FormatProcessor,

  // Functions
  extractPdfContent,
  extractText,
  extractImages,
  extractImageFiles,
  generatePageImages,
  extractPdfStream,
  extractTables,

  // Utilities
  validateConfig,
  validateImageRefFormat,
  validateFilePath,

  // Metadata
  version,
};

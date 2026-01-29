/**
 * Internal PDF Utilities Library
 *
 * A clean, internal library for PDF operations inspired by unpdf patterns.
 * Provides unified PDF loading, text extraction with positioning, metadata access,
 * page rendering, and image extraction.
 *
 * Key features:
 * - Single source of truth for pdf.js configuration
 * - Lazy loading of pdf.js for better startup performance
 * - Full text positioning support (our value-add over unpdf)
 * - Clean, simple API with full TypeScript support
 *
 * @example
 * ```typescript
 * import { pdfUtils } from 'pdf-plus';
 *
 * // Load and work with a PDF
 * const doc = await pdfUtils.loadPDF('document.pdf');
 *
 * // Extract text (simple)
 * const result = await pdfUtils.extractText(doc);
 * console.log(result.totalPages, result.text);
 *
 * // Extract text with positions (our value-add)
 * const items = await pdfUtils.extractTextItems(doc);
 * for (const item of items.items[0]) {
 *   console.log(`"${item.str}" at (${item.x}, ${item.y})`);
 * }
 *
 * // Render page to image with target width
 * const render = await pdfUtils.renderPage(doc, 1, { width: 800 });
 * fs.writeFileSync('page1.png', render.buffer);
 *
 * // Get metadata with date parsing
 * const meta = await pdfUtils.getMetadata(doc, { parseDates: true });
 * console.log(`${meta.numPages} pages`);
 *
 * // Clean up
 * await doc.destroy();
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Document loading & utilities
// ============================================================================

export {
  // Loading
  loadPDF,
  getPDFJS,
  getVerbosityLevel,
  getPageCount,
  isPDF,
  getDocumentProxy,
  // Validation
  validatePageNumber,
  // Type guards
  isPDFDocumentProxy,
  // Environment detection
  isNode,
  isBrowser,
} from "./document.js";

// ============================================================================
// Text extraction
// ============================================================================

export {
  extractText,
  extractTextItems,
  extractPageText,
  extractPageTextItems,
  extractFullText,
} from "./text.js";

// ============================================================================
// Metadata
// ============================================================================

export { getMetadata, getPageInfo, getAllPagesInfo } from "./meta.js";

// ============================================================================
// Links
// ============================================================================

export { extractLinks } from "./links.js";

// ============================================================================
// Rendering
// ============================================================================

export {
  renderPage,
  renderPageAsDataURL,
  renderPages,
  renderPageToBase64,
  renderPageToDataURL,
} from "./render.js";

// ============================================================================
// Image extraction
// ============================================================================

export { extractImages, getImageCount } from "./images.js";

// ============================================================================
// Types
// ============================================================================

export type {
  // Core types
  PDFDocumentProxy,
  PDFPageProxy,
  PDFSource,
  PDFInput,
  PDFLoadOptions,
  // Text types
  PDFTextItem,
  TextExtractionOptions,
  TextExtractionResult,
  TextItemsExtractionResult,
  TextExtractionProgress,
  TextExtractionMeta,
  // Metadata types
  MetadataOptions,
  PDFMetadata,
  PageInfo,
  // Link types
  LinkExtractionResult,
  // Render types
  ImageFormat,
  RenderOptions,
  RenderResult,
  RenderDataURLResult,
} from "./types.js";

export type { ImageExtractionOptions, ImageExtractionResult } from "./images.js";

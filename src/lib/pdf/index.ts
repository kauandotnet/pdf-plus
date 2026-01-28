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
 * - Clean, simple API
 *
 * @example
 * ```typescript
 * import { loadPDF, extractText, extractTextItems, renderPage, getMetadata } from './lib/pdf';
 *
 * // Load and work with a PDF
 * const doc = await loadPDF('document.pdf');
 *
 * // Extract text (simple)
 * const pages = await extractText(doc);
 *
 * // Extract text with positions (our value-add)
 * const items = await extractTextItems(doc);
 * for (const item of items[0]) {
 *   console.log(`"${item.str}" at (${item.x}, ${item.y})`);
 * }
 *
 * // Render page to image
 * const result = await renderPage(doc, 1, { scale: 2 });
 * fs.writeFileSync('page1.png', result.buffer);
 *
 * // Get metadata
 * const meta = await getMetadata(doc);
 * console.log(`${meta.numPages} pages`);
 *
 * // Clean up
 * await doc.destroy();
 * ```
 *
 * @packageDocumentation
 */

// Document loading
export { loadPDF, getPDFJS, getVerbosityLevel, getPageCount, isPDF } from "./document.js";

// Text extraction
export {
  extractText,
  extractTextItems,
  extractPageText,
  extractPageTextItems,
  extractFullText,
} from "./text.js";

// Metadata
export { getMetadata, getPageInfo, getAllPagesInfo } from "./meta.js";

// Links
export { extractLinks } from "./links.js";

// Rendering
export {
  renderPage,
  renderPages,
  renderPageToBase64,
  renderPageToDataURL,
} from "./render.js";

// Image extraction
export { extractImages, getImageCount } from "./images.js";

// Types
export type {
  PDFDocumentProxy,
  PDFPageProxy,
  PDFSource,
  PDFLoadOptions,
  PDFTextItem,
  TextExtractionOptions,
  TextExtractionResult,
  TextItemsExtractionResult,
  MetadataOptions,
  LinkExtractionResult,
  RenderOptions,
  RenderResult,
  PDFMetadata,
  PageInfo,
} from "./types.js";

export type { ImageExtractionOptions, ImageExtractionResult } from "./images.js";

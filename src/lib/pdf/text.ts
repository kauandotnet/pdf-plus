/**
 * PDF Text Extraction Utilities
 *
 * Provides text extraction with full positioning support.
 * This is our value-add over unpdf - we include positions!
 */

import type {
  PDFDocumentProxy,
  PDFSource,
  PDFTextItem,
  TextExtractionOptions,
  TextExtractionResult,
  TextItemsExtractionResult,
} from "./types.js";
import { loadPDF } from "./document.js";

/**
 * Check if source is already a loaded PDF document
 * Uses internal pdfjs property for reliable detection
 */
function isPDFDocumentProxy(data: unknown): data is PDFDocumentProxy {
  return typeof data === "object" && data !== null && "_pdfInfo" in data;
}

async function resolveDocument(
  source: PDFSource | PDFDocumentProxy
): Promise<PDFDocumentProxy> {
  if (isPDFDocumentProxy(source)) {
    return source;
  }
  return loadPDF(source);
}

/**
 * Extract text from a single page
 */
async function getPageText(
  doc: PDFDocumentProxy,
  pageNum: number,
  options: { includeMarkedContent?: boolean; disableNormalization?: boolean }
): Promise<string> {
  const page = await doc.getPage(pageNum);
  const textContent = await page.getTextContent({
    includeMarkedContent: options.includeMarkedContent ?? false,
    disableNormalization: options.disableNormalization ?? false,
  });

  const textParts: string[] = [];
  for (const item of textContent.items) {
    if (!("str" in item)) continue;
    textParts.push(item.str);
    if (item.hasEOL) {
      textParts.push("\n");
    }
  }

  page.cleanup();
  return textParts.join("");
}

/**
 * Extract text items from a single page
 */
async function getPageTextItems(
  doc: PDFDocumentProxy,
  pageNum: number,
  options: { includeMarkedContent?: boolean; disableNormalization?: boolean }
): Promise<PDFTextItem[]> {
  const page = await doc.getPage(pageNum);
  const textContent = await page.getTextContent({
    includeMarkedContent: options.includeMarkedContent ?? false,
    disableNormalization: options.disableNormalization ?? false,
  });

  const items: PDFTextItem[] = [];

  for (const item of textContent.items) {
    if (!("str" in item)) continue;

    // Extract positioning from transform matrix
    // transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
    const transform = item.transform || [1, 0, 0, 1, 0, 0];

    items.push({
      str: item.str,
      x: transform[4],
      y: transform[5],
      width: item.width || 0,
      height: item.height || 0,
      fontName: item.fontName || "",
      fontSize: Math.abs(transform[0]) || Math.abs(transform[3]) || 12,
      transform,
      hasEOL: item.hasEOL || false,
      dir: item.dir || "ltr",
    });
  }

  page.cleanup();
  return items;
}

/**
 * Extract text from all pages
 *
 * @param source - PDF document, file path, or buffer
 * @param options - Extraction options
 * @returns Object with totalPages and text array
 *
 * @example
 * ```typescript
 * // Get text as array of pages
 * const result = await extractText('document.pdf');
 * console.log(`Page 1: ${result.text[0]}`);
 *
 * // Get text as single merged string
 * const merged = await extractText('document.pdf', { mergePages: true });
 * console.log(merged.text); // string
 * ```
 */
export function extractText(
  source: PDFSource | PDFDocumentProxy,
  options?: TextExtractionOptions & { mergePages?: false }
): Promise<TextExtractionResult<string[]>>;

export function extractText(
  source: PDFSource | PDFDocumentProxy,
  options: TextExtractionOptions & { mergePages: true }
): Promise<TextExtractionResult<string>>;

export async function extractText(
  source: PDFSource | PDFDocumentProxy,
  options: TextExtractionOptions = {}
): Promise<TextExtractionResult<string | string[]>> {
  const doc = await resolveDocument(source);
  const shouldDestroy = !isPDFDocumentProxy(source);

  try {
    const {
      firstPage = 1,
      lastPage = doc.numPages,
      includeMarkedContent = false,
      disableNormalization = false,
      mergePages = false,
    } = options;

    const totalPages = doc.numPages;

    // Build page numbers array
    const pageNumbers = Array.from(
      { length: lastPage - firstPage + 1 },
      (_, i) => firstPage + i
    );

    // Process pages in parallel
    const texts = await Promise.all(
      pageNumbers.map((pageNum) =>
        getPageText(doc, pageNum, { includeMarkedContent, disableNormalization })
      )
    );

    if (mergePages) {
      return {
        totalPages,
        text: texts.filter((t) => t.trim()).join("\n\n"),
      };
    }

    return {
      totalPages,
      text: texts,
    };
  } finally {
    if (shouldDestroy) {
      await doc.destroy();
    }
  }
}

/**
 * Extract text with full positioning information
 *
 * This is the main value-add function - provides detailed text items
 * with x, y, width, height, font info, etc.
 *
 * @param source - PDF document, file path, or buffer
 * @param options - Extraction options
 * @returns Object with totalPages and items array per page
 *
 * @example
 * ```typescript
 * const result = await extractTextItems('document.pdf');
 * for (const item of result.items[0]) {
 *   console.log(`"${item.str}" at (${item.x}, ${item.y})`);
 * }
 * ```
 */
export async function extractTextItems(
  source: PDFSource | PDFDocumentProxy,
  options: Omit<TextExtractionOptions, "mergePages"> = {}
): Promise<TextItemsExtractionResult> {
  const doc = await resolveDocument(source);
  const shouldDestroy = !isPDFDocumentProxy(source);

  try {
    const {
      firstPage = 1,
      lastPage = doc.numPages,
      includeMarkedContent = false,
      disableNormalization = false,
    } = options;

    const totalPages = doc.numPages;

    // Build page numbers array
    const pageNumbers = Array.from(
      { length: lastPage - firstPage + 1 },
      (_, i) => firstPage + i
    );

    // Process pages in parallel
    const items = await Promise.all(
      pageNumbers.map((pageNum) =>
        getPageTextItems(doc, pageNum, { includeMarkedContent, disableNormalization })
      )
    );

    return {
      totalPages,
      items,
    };
  } finally {
    if (shouldDestroy) {
      await doc.destroy();
    }
  }
}

/**
 * Extract text from a single page
 *
 * @param source - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Extraction options
 * @returns Text string for the page
 */
export async function extractPageText(
  source: PDFSource | PDFDocumentProxy,
  pageNum: number,
  options: Omit<TextExtractionOptions, "firstPage" | "lastPage" | "mergePages"> = {}
): Promise<string> {
  const result = await extractText(source, {
    ...options,
    firstPage: pageNum,
    lastPage: pageNum,
  });
  return result.text[0] || "";
}

/**
 * Extract text items from a single page
 *
 * @param source - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Extraction options
 * @returns Array of text items
 */
export async function extractPageTextItems(
  source: PDFSource | PDFDocumentProxy,
  pageNum: number,
  options: Omit<TextExtractionOptions, "firstPage" | "lastPage" | "mergePages"> = {}
): Promise<PDFTextItem[]> {
  const result = await extractTextItems(source, {
    ...options,
    firstPage: pageNum,
    lastPage: pageNum,
  });
  return result.items[0] || [];
}

/**
 * Extract all text as a single string
 *
 * @param source - PDF document, file path, or buffer
 * @param options - Extraction options
 * @param pageSeparator - String to join pages (default: "\n\n")
 * @returns Combined text from all pages
 *
 * @deprecated Use extractText with { mergePages: true } instead
 */
export async function extractFullText(
  source: PDFSource | PDFDocumentProxy,
  options: Omit<TextExtractionOptions, "mergePages"> = {},
  pageSeparator: string = "\n\n"
): Promise<string> {
  const result = await extractText(source, options);
  return result.text.filter((p) => p.trim()).join(pageSeparator);
}

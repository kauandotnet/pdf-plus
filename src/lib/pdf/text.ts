/**
 * PDF Text Extraction Utilities
 *
 * Provides text extraction with full positioning support.
 * This is our value-add over unpdf - we include positions!
 */

import type {
  PDFDocumentProxy,
  PDFInput,
  PDFTextItem,
  TextExtractionOptions,
  TextExtractionResult,
  TextItemsExtractionResult,
  TextExtractionMeta,
} from "./types.js";
import { getDocumentProxy, isPDFDocumentProxy } from "./document.js";
import { ParallelProcessor } from "../../utils/parallel-processor.js";

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
      dir: (item.dir as PDFTextItem["dir"]) || "ltr",
    });
  }

  page.cleanup();
  return items;
}

/**
 * Extract text from all pages
 *
 * @param input - PDF document, file path, or buffer
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
  input: PDFInput,
  options?: TextExtractionOptions & { mergePages?: false }
): Promise<TextExtractionResult<string[]>>;

export function extractText(
  input: PDFInput,
  options: TextExtractionOptions & { mergePages: true }
): Promise<TextExtractionResult<string>>;

export async function extractText(
  input: PDFInput,
  options: TextExtractionOptions = {}
): Promise<TextExtractionResult<string | string[]>> {
  const startTime = Date.now();
  const doc = await getDocumentProxy(input);
  const shouldDestroy = !isPDFDocumentProxy(input);

  try {
    const {
      firstPage = 1,
      lastPage = doc.numPages,
      includeMarkedContent = false,
      disableNormalization = false,
      mergePages = false,
      maxConcurrency = 10,
      onProgress,
      chunkSize,
      onChunkComplete,
    } = options;

    const totalPages = doc.numPages;
    const pageNumbers = Array.from(
      { length: lastPage - firstPage + 1 },
      (_, i) => firstPage + i
    );

    const extractPage = (pageNum: number) =>
      getPageText(doc, pageNum, { includeMarkedContent, disableNormalization });

    const reportProgress = (processedPages: number, currentPage: number) => {
      onProgress?.({
        processedPages,
        totalPages: pageNumbers.length,
        percentage: (processedPages / pageNumbers.length) * 100,
        currentPage,
      });
    };

    // Use chunked processing for very large PDFs if chunkSize is set
    const useChunked = chunkSize && pageNumbers.length > chunkSize;

    const { texts, method } = useChunked
      ? await processChunked(
          pageNumbers,
          chunkSize,
          extractPage,
          reportProgress,
          onChunkComplete,
          maxConcurrency
        )
      : await processParallel(
          pageNumbers,
          extractPage,
          reportProgress,
          maxConcurrency
        );

    const _meta: TextExtractionMeta = {
      duration: Date.now() - startTime,
      pagesProcessed: texts.length,
      method,
    };

    return {
      totalPages,
      text: mergePages ? texts.filter((t) => t.trim()).join("\n\n") : texts,
      _meta,
    };
  } finally {
    if (shouldDestroy) {
      await doc.destroy();
    }
  }
}

async function processParallel<T>(
  pageNumbers: number[],
  extractor: (pageNum: number) => Promise<T>,
  reportProgress: (processed: number, current: number) => void,
  maxConcurrency: number
): Promise<{ texts: T[]; method: "parallel" }> {
  const texts = await ParallelProcessor.map(
    pageNumbers,
    async (pageNum, index) => {
      const result = await extractor(pageNum);
      reportProgress(index + 1, pageNum);
      return result;
    },
    { maxConcurrency }
  );
  return { texts, method: "parallel" };
}

async function processChunked<T>(
  pageNumbers: number[],
  chunkSize: number,
  extractor: (pageNum: number) => Promise<T>,
  reportProgress: (processed: number, current: number) => void,
  onChunkComplete: TextExtractionOptions["onChunkComplete"],
  maxConcurrency: number
): Promise<{ texts: T[]; method: "chunked" }> {
  const totalChunks = Math.ceil(pageNumbers.length / chunkSize);
  const counter = { value: 0 };

  const chunkResults = await ParallelProcessor.processInChunks(
    pageNumbers,
    chunkSize,
    async (chunk, chunkIndex) => {
      const chunkTexts = await ParallelProcessor.map(
        chunk,
        async (pageNum) => {
          const result = await extractor(pageNum);
          counter.value++;
          reportProgress(counter.value, pageNum);
          return result;
        },
        { maxConcurrency }
      );

      onChunkComplete?.({
        chunkIndex,
        totalChunks,
        pagesProcessed: Math.min((chunkIndex + 1) * chunkSize, pageNumbers.length),
      });

      return chunkTexts;
    },
    { maxConcurrency: 1 }
  );

  return { texts: chunkResults.flat(), method: "chunked" };
}

/**
 * Extract text with full positioning information
 *
 * This is the main value-add function - provides detailed text items
 * with x, y, width, height, font info, etc.
 *
 * @param input - PDF document, file path, or buffer
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
  input: PDFInput,
  options: Omit<TextExtractionOptions, "mergePages"> = {}
): Promise<TextItemsExtractionResult> {
  const startTime = Date.now();
  const doc = await getDocumentProxy(input);
  const shouldDestroy = !isPDFDocumentProxy(input);

  try {
    const {
      firstPage = 1,
      lastPage = doc.numPages,
      includeMarkedContent = false,
      disableNormalization = false,
      maxConcurrency = 10,
      onProgress,
      chunkSize,
      onChunkComplete,
    } = options;

    const totalPages = doc.numPages;
    const pageNumbers = Array.from(
      { length: lastPage - firstPage + 1 },
      (_, i) => firstPage + i
    );

    const extractPage = (pageNum: number) =>
      getPageTextItems(doc, pageNum, { includeMarkedContent, disableNormalization });

    const reportProgress = (processedPages: number, currentPage: number) => {
      onProgress?.({
        processedPages,
        totalPages: pageNumbers.length,
        percentage: (processedPages / pageNumbers.length) * 100,
        currentPage,
      });
    };

    const useChunked = chunkSize && pageNumbers.length > chunkSize;

    const { texts: items, method } = useChunked
      ? await processChunked(
          pageNumbers,
          chunkSize,
          extractPage,
          reportProgress,
          onChunkComplete,
          maxConcurrency
        )
      : await processParallel(
          pageNumbers,
          extractPage,
          reportProgress,
          maxConcurrency
        );

    return {
      totalPages,
      items,
      _meta: {
        duration: Date.now() - startTime,
        pagesProcessed: items.length,
        method,
      },
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
 * @param input - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Extraction options
 * @returns Text string for the page
 */
export async function extractPageText(
  input: PDFInput,
  pageNum: number,
  options: Omit<TextExtractionOptions, "firstPage" | "lastPage" | "mergePages"> = {}
): Promise<string> {
  const result = await extractText(input, {
    ...options,
    firstPage: pageNum,
    lastPage: pageNum,
  });
  return result.text[0] || "";
}

/**
 * Extract text items from a single page
 *
 * @param input - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Extraction options
 * @returns Array of text items
 */
export async function extractPageTextItems(
  input: PDFInput,
  pageNum: number,
  options: Omit<TextExtractionOptions, "firstPage" | "lastPage" | "mergePages"> = {}
): Promise<PDFTextItem[]> {
  const result = await extractTextItems(input, {
    ...options,
    firstPage: pageNum,
    lastPage: pageNum,
  });
  return result.items[0] || [];
}

/**
 * Extract all text as a single string
 *
 * @param input - PDF document, file path, or buffer
 * @param options - Extraction options
 * @param pageSeparator - String to join pages (default: "\n\n")
 * @returns Combined text from all pages
 *
 * @deprecated Use extractText with { mergePages: true } instead
 */
export async function extractFullText(
  input: PDFInput,
  options: Omit<TextExtractionOptions, "mergePages"> = {},
  pageSeparator: string = "\n\n"
): Promise<string> {
  const result = await extractText(input, options);
  return result.text.filter((p) => p.trim()).join(pageSeparator);
}

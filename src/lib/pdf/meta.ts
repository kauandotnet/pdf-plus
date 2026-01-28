/**
 * PDF Metadata Extraction Utilities
 *
 * Provides access to PDF document metadata.
 */

import type {
  PDFInput,
  PDFMetadata,
  PageInfo,
  MetadataOptions,
} from "./types.js";
import { getDocumentProxy, isPDFDocumentProxy, getPDFJS } from "./document.js";

/**
 * Extract metadata from a PDF document
 *
 * @param input - PDF document, file path, or buffer
 * @param options - Metadata extraction options
 * @returns PDF metadata
 *
 * @example
 * ```typescript
 * const meta = await getMetadata('document.pdf');
 * console.log(`${meta.numPages} pages, version ${meta.version}`);
 *
 * // With date parsing
 * const metaDates = await getMetadata('document.pdf', { parseDates: true });
 * if (metaDates.info.CreationDate instanceof Date) {
 *   console.log('Created:', metaDates.info.CreationDate.toISOString());
 * }
 * ```
 */
export async function getMetadata(
  input: PDFInput,
  options: MetadataOptions = {}
): Promise<PDFMetadata> {
  const doc = await getDocumentProxy(input);
  const shouldDestroy = !isPDFDocumentProxy(input);

  try {
    const metadata = await doc.getMetadata();
    const rawInfo = metadata.info as Record<string, unknown>;

    // Process dates if requested
    let info = { ...rawInfo };
    if (options.parseDates) {
      // Use pdfjs built-in PDFDateString for robust date parsing
      const pdfjs = await getPDFJS();
      const { PDFDateString } = pdfjs;

      // Primary date properties from /Info dictionary
      if (info.CreationDate) {
        const parsed = PDFDateString.toDateObject(info.CreationDate as string);
        if (parsed) info.CreationDate = parsed;
      }
      if (info.ModDate) {
        const parsed = PDFDateString.toDateObject(info.ModDate as string);
        if (parsed) info.ModDate = parsed;
      }
    }

    return {
      numPages: doc.numPages,
      info,
      metadata: (metadata.metadata as any)?.getAll?.() || null,
      version: (rawInfo?.PDFFormatVersion as string) || "1.0",
      isEncrypted: !!rawInfo?.IsAcroFormPresent || false,
      isLinearized: !!rawInfo?.IsLinearized || false,
    };
  } finally {
    if (shouldDestroy) {
      await doc.destroy();
    }
  }
}

/**
 * Get information about a specific page
 *
 * @param input - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @returns Page information
 */
export async function getPageInfo(
  input: PDFInput,
  pageNum: number
): Promise<PageInfo> {
  const doc = await getDocumentProxy(input);
  const shouldDestroy = !isPDFDocumentProxy(input);

  try {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });

    const info: PageInfo = {
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      rotation: page.rotate,
      viewport: {
        width: viewport.width,
        height: viewport.height,
        scale: 1,
      },
    };

    page.cleanup();
    return info;
  } finally {
    if (shouldDestroy) {
      await doc.destroy();
    }
  }
}

/**
 * Get information about all pages
 *
 * @param input - PDF document, file path, or buffer
 * @returns Array of page information
 */
export async function getAllPagesInfo(
  input: PDFInput
): Promise<PageInfo[]> {
  const doc = await getDocumentProxy(input);
  const shouldDestroy = !isPDFDocumentProxy(input);

  try {
    // Build page numbers array
    const pageNumbers = Array.from({ length: doc.numPages }, (_, i) => i + 1);

    // Process pages in parallel
    const pages = await Promise.all(
      pageNumbers.map(async (i) => {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });

        const info: PageInfo = {
          pageNumber: i,
          width: viewport.width,
          height: viewport.height,
          rotation: page.rotate,
          viewport: {
            width: viewport.width,
            height: viewport.height,
            scale: 1,
          },
        };

        page.cleanup();
        return info;
      })
    );

    return pages;
  } finally {
    if (shouldDestroy) {
      await doc.destroy();
    }
  }
}

/**
 * PDF Link Extraction Utilities
 *
 * Extracts URLs from PDF annotations (hyperlinks).
 */

import type {
  PDFDocumentProxy,
  PDFSource,
  LinkExtractionResult,
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
 * Extract links from a single page
 */
async function getPageLinks(
  doc: PDFDocumentProxy,
  pageNum: number
): Promise<string[]> {
  const page = await doc.getPage(pageNum);

  try {
    const annotations = await page.getAnnotations();
    const links: string[] = [];

    for (const annotation of annotations) {
      // Check for link annotations with URI action
      if (annotation.subtype === "Link" && annotation.url) {
        // Validate URL
        try {
          new URL(annotation.url);
          links.push(annotation.url);
        } catch {
          // Invalid URL, skip
        }
      }
    }

    return links;
  } finally {
    page.cleanup();
  }
}

/**
 * Extract all links (URLs) from a PDF document
 *
 * Extracts hyperlinks from PDF annotations across all pages.
 *
 * @param source - PDF document, file path, or buffer
 * @returns Object with totalPages and unique links array
 *
 * @example
 * ```typescript
 * const result = await extractLinks('document.pdf');
 * console.log(`Found ${result.links.length} links in ${result.totalPages} pages`);
 * for (const url of result.links) {
 *   console.log(url);
 * }
 * ```
 */
export async function extractLinks(
  source: PDFSource | PDFDocumentProxy
): Promise<LinkExtractionResult> {
  const doc = await resolveDocument(source);
  const shouldDestroy = !isPDFDocumentProxy(source);

  try {
    const totalPages = doc.numPages;

    // Build page numbers array
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    // Process pages in parallel
    const pageLinks = await Promise.all(
      pageNumbers.map((pageNum) => getPageLinks(doc, pageNum))
    );

    // Flatten and deduplicate links
    const allLinks = pageLinks.flat();
    const uniqueLinks = [...new Set(allLinks)];

    return {
      totalPages,
      links: uniqueLinks,
    };
  } finally {
    if (shouldDestroy) {
      await doc.destroy();
    }
  }
}

/**
 * PDF Metadata Extraction Utilities
 *
 * Provides access to PDF document metadata.
 */

import type {
  PDFDocumentProxy,
  PDFSource,
  PDFMetadata,
  PageInfo,
  MetadataOptions,
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
 * Parse PDF date string to Date object
 *
 * PDF dates follow the format: D:YYYYMMDDHHmmSSOHH'mm'
 * Example: D:20231215143052+00'00'
 */
function parsePDFDate(dateString: unknown): Date | string | null {
  if (typeof dateString !== "string") return null;

  // Remove the 'D:' prefix if present
  const cleaned = dateString.startsWith("D:") ? dateString.slice(2) : dateString;

  // PDF date format: YYYYMMDDHHmmSSOHH'mm'
  // At minimum we need YYYY
  const match = cleaned.match(
    /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([+-Z])?(\d{2})?'?(\d{2})?'?$/
  );

  if (!match) {
    return dateString; // Return original if can't parse
  }

  const [
    ,
    year,
    month = "01",
    day = "01",
    hour = "00",
    minute = "00",
    second = "00",
    tzSign,
    tzHour = "00",
    tzMinute = "00",
  ] = match;

  // Build ISO date string
  let isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  // Add timezone
  if (tzSign === "Z") {
    isoString += "Z";
  } else if (tzSign === "+" || tzSign === "-") {
    isoString += `${tzSign}${tzHour}:${tzMinute}`;
  } else {
    // No timezone specified, assume UTC
    isoString += "Z";
  }

  try {
    const date = new Date(isoString);
    // Validate the date is valid
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date;
  } catch {
    return dateString;
  }
}

/**
 * Extract metadata from a PDF document
 *
 * @param source - PDF document, file path, or buffer
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
  source: PDFSource | PDFDocumentProxy,
  options: MetadataOptions = {}
): Promise<PDFMetadata> {
  const doc = await resolveDocument(source);
  const shouldDestroy = !isPDFDocumentProxy(source);

  try {
    const metadata = await doc.getMetadata();
    const rawInfo = metadata.info as Record<string, unknown>;

    // Process dates if requested
    let info = { ...rawInfo };
    if (options.parseDates) {
      const dateFields = ["CreationDate", "ModDate"];
      for (const field of dateFields) {
        if (field in info) {
          info[field] = parsePDFDate(info[field]);
        }
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
 * @param source - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @returns Page information
 */
export async function getPageInfo(
  source: PDFSource | PDFDocumentProxy,
  pageNum: number
): Promise<PageInfo> {
  const doc = await resolveDocument(source);
  const shouldDestroy = !isPDFDocumentProxy(source);

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
 * @param source - PDF document, file path, or buffer
 * @returns Array of page information
 */
export async function getAllPagesInfo(
  source: PDFSource | PDFDocumentProxy
): Promise<PageInfo[]> {
  const doc = await resolveDocument(source);
  const shouldDestroy = !isPDFDocumentProxy(source);

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

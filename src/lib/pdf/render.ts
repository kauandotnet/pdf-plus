/**
 * PDF Page Rendering Utilities
 *
 * Renders PDF pages to images using @napi-rs/canvas.
 */

import type { Canvas } from "@napi-rs/canvas";
import type {
  PDFDocumentProxy,
  PDFSource,
  RenderOptions,
  RenderResult,
} from "./types.js";
import { loadPDF } from "./document.js";
import { napiCanvasFactory } from "../../utils/napi-canvas-factory.js";

/**
 * Render a PDF page to an image buffer
 *
 * @param source - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Render options
 * @returns Render result with buffer and dimensions
 *
 * @example
 * ```typescript
 * const result = await renderPage('document.pdf', 1, {
 *   scale: 2,
 *   format: 'png'
 * });
 * fs.writeFileSync('page1.png', result.buffer);
 * ```
 */
export async function renderPage(
  source: PDFSource | PDFDocumentProxy,
  pageNum: number,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const doc = await resolveDocument(source);
  const shouldDestroy = !isPDFDocumentProxy(source);

  try {
    const {
      scale = 1,
      dpi = 72,
      format = "png",
      quality = 90,
      backgroundColor = "#FFFFFF",
      transparent = false,
    } = options;

    const page = await doc.getPage(pageNum);

    // Calculate effective scale (DPI affects scale)
    const effectiveScale = scale * (dpi / 72);
    const viewport = page.getViewport({ scale: effectiveScale });

    // Create canvas using our factory
    const { canvas, context } = napiCanvasFactory.create(
      viewport.width,
      viewport.height
    );

    // Fill background if not transparent
    if (!transparent) {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Render PDF page to canvas
    // Note: pdf.js RenderParameters type requires canvas, but at runtime it works
    // with just canvasContext. We use 'as any' for the type assertion.
    await page.render({
      canvasContext: context,
      viewport,
      background: transparent ? "transparent" : backgroundColor,
    } as any).promise;

    page.cleanup();

    // Convert canvas to buffer
    const buffer = await canvasToBuffer(canvas, format, quality);

    return {
      buffer,
      width: Math.floor(viewport.width),
      height: Math.floor(viewport.height),
      format,
    };
  } finally {
    if (shouldDestroy) {
      await doc.destroy();
    }
  }
}

/**
 * Render multiple pages to image buffers
 *
 * @param source - PDF document, file path, or buffer
 * @param pageNums - Array of page numbers (1-based), or undefined for all pages
 * @param options - Render options
 * @returns Array of render results
 */
export async function renderPages(
  source: PDFSource | PDFDocumentProxy,
  pageNums?: number[],
  options: RenderOptions = {}
): Promise<RenderResult[]> {
  const doc = await resolveDocument(source);
  const shouldDestroy = !isPDFDocumentProxy(source);

  try {
    const pages = pageNums || Array.from({ length: doc.numPages }, (_, i) => i + 1);
    const results: RenderResult[] = [];

    for (const pageNum of pages) {
      const result = await renderPage(doc, pageNum, options);
      results.push(result);
    }

    return results;
  } finally {
    if (shouldDestroy) {
      await doc.destroy();
    }
  }
}

/**
 * Render a page and return as base64 string
 *
 * @param source - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Render options
 * @returns Base64-encoded image string
 */
export async function renderPageToBase64(
  source: PDFSource | PDFDocumentProxy,
  pageNum: number,
  options: RenderOptions = {}
): Promise<string> {
  const result = await renderPage(source, pageNum, options);
  return result.buffer.toString("base64");
}

/**
 * Render a page as a data URL
 *
 * @param source - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Render options
 * @returns Data URL string
 */
export async function renderPageToDataURL(
  source: PDFSource | PDFDocumentProxy,
  pageNum: number,
  options: RenderOptions = {}
): Promise<string> {
  const result = await renderPage(source, pageNum, options);
  const mimeType = getMimeType(result.format);
  return `data:${mimeType};base64,${result.buffer.toString("base64")}`;
}

// Helper functions

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

async function canvasToBuffer(
  canvas: Canvas,
  format: "png" | "jpeg" | "webp",
  quality: number
): Promise<Buffer> {
  if (format === "png") {
    return canvas.toBuffer("image/png");
  } else if (format === "jpeg") {
    return Buffer.from(await canvas.encode("jpeg", quality));
  } else if (format === "webp") {
    return Buffer.from(await canvas.encode("webp", quality));
  }
  throw new Error(`Unsupported format: ${format}`);
}

function getMimeType(format: "png" | "jpeg" | "webp"): string {
  const mimeTypes = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return mimeTypes[format];
}

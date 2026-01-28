/**
 * PDF Page Rendering Utilities
 *
 * Renders PDF pages to images using @napi-rs/canvas.
 */

import type { Canvas } from "@napi-rs/canvas";
import type {
  PDFInput,
  RenderOptions,
  RenderResult,
  RenderDataURLResult,
  ImageFormat,
} from "./types.js";
import { getDocumentProxy, isPDFDocumentProxy, validatePageNumber } from "./document.js";
import { napiCanvasFactory } from "../../utils/napi-canvas-factory.js";

/**
 * Render a PDF page to an image buffer
 *
 * @param input - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Render options
 * @returns Render result with buffer and dimensions
 *
 * @example
 * ```typescript
 * // Using scale
 * const result = await renderPage('document.pdf', 1, { scale: 2 });
 *
 * // Using target width (auto-calculates scale)
 * const result = await renderPage('document.pdf', 1, { width: 800 });
 *
 * // Using target height (auto-calculates scale)
 * const result = await renderPage('document.pdf', 1, { height: 600 });
 *
 * fs.writeFileSync('page1.png', result.buffer);
 * ```
 */
export async function renderPage(
  input: PDFInput,
  pageNum: number,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const doc = await getDocumentProxy(input);
  const shouldDestroy = !isPDFDocumentProxy(input);

  try {
    // Validate page number
    validatePageNumber(pageNum, doc.numPages);

    const {
      scale: userScale = 1,
      dpi = 72,
      width: targetWidth,
      height: targetHeight,
      format = "png",
      quality = 90,
      backgroundColor = "#FFFFFF",
      transparent = false,
    } = options;

    const page = await doc.getPage(pageNum);

    // Get default viewport to calculate dimensions
    const defaultViewport = page.getViewport({ scale: 1.0 });

    // Calculate scale based on options
    let scale = userScale;

    if (targetWidth) {
      // Calculate scale to fit target width
      scale = targetWidth / defaultViewport.width;
    } else if (targetHeight) {
      // Calculate scale to fit target height
      scale = targetHeight / defaultViewport.height;
    }

    // Apply DPI adjustment
    const effectiveScale = scale * (dpi / 72);
    const viewport = page.getViewport({ scale: Math.max(0, effectiveScale) });

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
 * Render a PDF page directly to a data URL
 *
 * @param input - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Render options
 * @returns Render result with data URL and dimensions
 *
 * @example
 * ```typescript
 * const result = await renderPageAsDataURL('document.pdf', 1, { width: 800 });
 * // result.dataURL = "data:image/png;base64,..."
 * ```
 */
export async function renderPageAsDataURL(
  input: PDFInput,
  pageNum: number,
  options: RenderOptions = {}
): Promise<RenderDataURLResult> {
  const result = await renderPage(input, pageNum, options);
  const mimeType = getMimeType(result.format);

  return {
    dataURL: `data:${mimeType};base64,${result.buffer.toString("base64")}`,
    width: result.width,
    height: result.height,
    format: result.format,
  };
}

/**
 * Render multiple pages to image buffers
 *
 * @param input - PDF document, file path, or buffer
 * @param pageNums - Array of page numbers (1-based), or undefined for all pages
 * @param options - Render options
 * @returns Array of render results
 */
export async function renderPages(
  input: PDFInput,
  pageNums?: number[],
  options: RenderOptions = {}
): Promise<RenderResult[]> {
  const doc = await getDocumentProxy(input);
  const shouldDestroy = !isPDFDocumentProxy(input);

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
 * @param input - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Render options
 * @returns Base64-encoded image string
 */
export async function renderPageToBase64(
  input: PDFInput,
  pageNum: number,
  options: RenderOptions = {}
): Promise<string> {
  const result = await renderPage(input, pageNum, options);
  return result.buffer.toString("base64");
}

/**
 * Render a page as a data URL (legacy function, use renderPageAsDataURL instead)
 *
 * @param input - PDF document, file path, or buffer
 * @param pageNum - Page number (1-based)
 * @param options - Render options
 * @returns Data URL string
 *
 * @deprecated Use renderPageAsDataURL which returns more info
 */
export async function renderPageToDataURL(
  input: PDFInput,
  pageNum: number,
  options: RenderOptions = {}
): Promise<string> {
  const result = await renderPageAsDataURL(input, pageNum, options);
  return result.dataURL;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function canvasToBuffer(
  canvas: Canvas,
  format: ImageFormat,
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

function getMimeType(format: ImageFormat): string {
  const mimeTypes: Record<ImageFormat, string> = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return mimeTypes[format];
}

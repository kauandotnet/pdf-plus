/**
 * PDF Document Loading Utility
 *
 * Provides unified PDF loading with lazy pdf.js initialization.
 * Single source of truth for pdf.js configuration.
 *
 * Inspired by unpdf's patterns.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { PDFDocumentProxy, PDFSource, PDFLoadOptions } from "./types.js";
import { napiCanvasFactory } from "../../utils/napi-canvas-factory.js";

// Lazy-loaded pdf.js module
let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;
let workerConfigured = false;

/**
 * Get the pdf.js module, initializing it lazily
 *
 * This ensures pdf.js is only loaded when needed and worker
 * configuration happens exactly once.
 */
export async function getPDFJS() {
  if (!pdfjs) {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Configure worker path once
    if (!workerConfigured) {
      const require = createRequire(import.meta.url);
      const pdfjsPath = path.dirname(
        require.resolve("pdfjs-dist/package.json")
      );
      pdfjs.GlobalWorkerOptions.workerSrc = path.join(
        pdfjsPath,
        "legacy",
        "build",
        "pdf.worker.mjs"
      );
      workerConfigured = true;
    }
  }
  return pdfjs;
}

/**
 * Get the pdf.js verbosity level enum
 */
export async function getVerbosityLevel() {
  const pdfjs = await getPDFJS();
  return pdfjs.VerbosityLevel;
}

/**
 * Load a PDF document from a file path or buffer
 *
 * @param source - File path string or Uint8Array/Buffer of PDF data
 * @param options - Loading options
 * @returns PDFDocumentProxy
 *
 * @example
 * ```typescript
 * // Load from file path
 * const doc = await loadPDF('document.pdf');
 *
 * // Load from buffer
 * const buffer = fs.readFileSync('document.pdf');
 * const doc = await loadPDF(buffer);
 *
 * // With password
 * const doc = await loadPDF('encrypted.pdf', { password: 'secret' });
 * ```
 */
export async function loadPDF(
  source: PDFSource,
  options: PDFLoadOptions = {}
): Promise<PDFDocumentProxy> {
  const pdfjs = await getPDFJS();

  // Convert source to Uint8Array
  let data: Uint8Array;
  if (typeof source === "string") {
    // File path - read file
    const buffer = fs.readFileSync(source);
    data = new Uint8Array(buffer);
  } else if (Buffer.isBuffer(source)) {
    data = new Uint8Array(source);
  } else {
    data = source;
  }

  // Create document loading task
  // Note: canvasFactory is a valid option but not in the TypeScript types
  const loadingTask = pdfjs.getDocument({
    data,
    password: options.password,
    verbosity: options.verbosity ?? pdfjs.VerbosityLevel.ERRORS,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    canvasFactory: napiCanvasFactory as any,
  } as any);

  return loadingTask.promise;
}

/**
 * Load a PDF and get the number of pages quickly
 *
 * Useful for determining if streaming should be enabled.
 *
 * @param source - File path or buffer
 * @returns Number of pages
 */
export async function getPageCount(source: PDFSource): Promise<number> {
  const doc = await loadPDF(source);
  const count = doc.numPages;
  await doc.destroy();
  return count;
}

/**
 * Check if a file is a valid PDF
 *
 * @param source - File path or buffer
 * @returns True if the source appears to be a valid PDF
 */
export async function isPDF(source: PDFSource): Promise<boolean> {
  try {
    const doc = await loadPDF(source);
    await doc.destroy();
    return true;
  } catch {
    return false;
  }
}

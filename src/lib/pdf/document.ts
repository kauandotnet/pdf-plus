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
import type { PDFDocumentProxy, PDFSource, PDFLoadOptions, PDFInput } from "./types.js";
import { napiCanvasFactory } from "../../utils/napi-canvas-factory.js";

// Lazy-loaded pdf.js module
let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;
let workerConfigured = false;

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Check if running in Node.js environment
 */
export const isNode: boolean = globalThis.process?.release?.name === "node";

/**
 * Check if running in browser environment
 */
export const isBrowser: boolean = typeof window !== "undefined";

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a PDFDocumentProxy instance
 *
 * Uses internal pdfjs property for reliable detection.
 *
 * @param data - Value to check
 * @returns True if the value is a PDFDocumentProxy
 *
 * @example
 * ```typescript
 * if (isPDFDocumentProxy(input)) {
 *   // input is typed as PDFDocumentProxy
 *   console.log(input.numPages);
 * }
 * ```
 */
export function isPDFDocumentProxy(data: unknown): data is PDFDocumentProxy {
  return typeof data === "object" && data !== null && "_pdfInfo" in data;
}

// ============================================================================
// PDF.js Module Management
// ============================================================================

/**
 * Get the pdf.js module, initializing it lazily
 *
 * This ensures pdf.js is only loaded when needed and worker
 * configuration happens exactly once.
 */
export async function getPDFJS(): Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> {
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
export async function getVerbosityLevel(): Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs").VerbosityLevel> {
  const pdfjs = await getPDFJS();
  return pdfjs.VerbosityLevel;
}

// ============================================================================
// Document Loading
// ============================================================================

/**
 * Load a PDF document from a file path or buffer
 *
 * Applies sensible defaults:
 * - `isEvalSupported: false` (security)
 * - `useSystemFonts: true` (better font rendering)
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

  // Create document loading task with sensible defaults
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
 * Get a PDFDocumentProxy from input (loads if necessary)
 *
 * This is a convenience function that handles both raw data and
 * already-loaded documents uniformly.
 *
 * @param input - PDF source or already loaded document
 * @param options - Loading options (only used if input is not already a document)
 * @returns PDFDocumentProxy
 *
 * @example
 * ```typescript
 * // Works with file path
 * const doc1 = await getDocumentProxy('document.pdf');
 *
 * // Works with already loaded document (returns as-is)
 * const doc2 = await getDocumentProxy(existingDoc);
 * ```
 */
export async function getDocumentProxy(
  input: PDFInput,
  options: PDFLoadOptions = {}
): Promise<PDFDocumentProxy> {
  if (isPDFDocumentProxy(input)) {
    return input;
  }
  return loadPDF(input, options);
}

// ============================================================================
// Utility Functions
// ============================================================================

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

/**
 * Validate page number against document bounds
 *
 * @param pageNum - Page number to validate (1-based)
 * @param totalPages - Total pages in document
 * @throws Error if page number is invalid
 */
export function validatePageNumber(pageNum: number, totalPages: number): void {
  if (pageNum < 1 || pageNum > totalPages) {
    throw new Error(
      `Invalid page number: ${pageNum}. Must be between 1 and ${totalPages}.`
    );
  }
}

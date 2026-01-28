/**
 * Type definitions for the internal PDF utilities library
 *
 * Provides clean interfaces for PDF operations inspired by unpdf patterns.
 */

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

// Re-export pdfjs types for convenience
export type { PDFDocumentProxy, PDFPageProxy };

/**
 * Source for loading a PDF - either a file path or raw bytes
 */
export type PDFSource = string | Uint8Array | Buffer;

/**
 * Options for loading a PDF document
 */
export interface PDFLoadOptions {
  /** Password for encrypted PDFs */
  password?: string;
  /** Verbosity level for pdfjs logging */
  verbosity?: number;
}

/**
 * Text item with full positioning information
 */
export interface PDFTextItem {
  /** The text string */
  str: string;
  /** X position (from transform matrix) */
  x: number;
  /** Y position (from transform matrix) */
  y: number;
  /** Width of the text item */
  width: number;
  /** Height of the text item */
  height: number;
  /** Font name */
  fontName: string;
  /** Font size (derived from transform) */
  fontSize: number;
  /** Full transform matrix [a, b, c, d, e, f] */
  transform: number[];
  /** Whether this item ends with EOL */
  hasEOL: boolean;
  /** Text direction (ltr or rtl) */
  dir: string;
}

/**
 * Options for text extraction
 */
export interface TextExtractionOptions {
  /** First page to extract (1-based, default: 1) */
  firstPage?: number;
  /** Last page to extract (1-based, default: all pages) */
  lastPage?: number;
  /** Include marked content in extraction */
  includeMarkedContent?: boolean;
  /** Disable text normalization */
  disableNormalization?: boolean;
  /** Merge all pages into a single string (default: false) */
  mergePages?: boolean;
}

/**
 * Result of text extraction
 */
export interface TextExtractionResult<T extends string | string[]> {
  /** Total number of pages in the document */
  totalPages: number;
  /** Extracted text - string[] when mergePages is false, string when true */
  text: T;
}

/**
 * Result of text items extraction
 */
export interface TextItemsExtractionResult {
  /** Total number of pages in the document */
  totalPages: number;
  /** Text items per page */
  items: PDFTextItem[][];
}

/**
 * Options for metadata extraction
 */
export interface MetadataOptions {
  /** Parse date strings (CreationDate, ModDate) into Date objects (default: false) */
  parseDates?: boolean;
}

/**
 * Result of link extraction
 */
export interface LinkExtractionResult {
  /** Total number of pages in the document */
  totalPages: number;
  /** Extracted URLs from the document */
  links: string[];
}

/**
 * Options for page rendering
 */
export interface RenderOptions {
  /** Scale factor (default: 1). Ignored if width or height is set. */
  scale?: number;
  /** DPI for rendering (default: 72, affects scale) */
  dpi?: number;
  /** Target width in pixels. Auto-calculates scale to fit. */
  width?: number;
  /** Target height in pixels. Auto-calculates scale to fit. */
  height?: number;
  /** Output format: 'png' | 'jpeg' | 'webp' (default: 'png') */
  format?: "png" | "jpeg" | "webp";
  /** Quality for JPEG/WebP (0-100, default: 90) */
  quality?: number;
  /** Background color (default: '#FFFFFF') */
  backgroundColor?: string;
  /** Transparent background (default: false) */
  transparent?: boolean;
}

/**
 * Result of rendering a page as data URL
 */
export interface RenderDataURLResult {
  /** Data URL string (e.g., "data:image/png;base64,...") */
  dataURL: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Output format */
  format: "png" | "jpeg" | "webp";
}

/**
 * Result of rendering a page
 */
export interface RenderResult {
  /** Image buffer */
  buffer: Buffer;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Output format */
  format: "png" | "jpeg" | "webp";
}

/**
 * PDF document metadata
 */
export interface PDFMetadata {
  /** Number of pages */
  numPages: number;
  /** PDF info dictionary */
  info: Record<string, unknown>;
  /** PDF metadata (XMP) */
  metadata: Record<string, unknown> | null;
  /** PDF format version */
  version: string;
  /** Whether the PDF is encrypted */
  isEncrypted: boolean;
  /** Whether the PDF is linearized (fast web view) */
  isLinearized: boolean;
}

/**
 * Page dimensions and properties
 */
export interface PageInfo {
  /** Page number (1-based) */
  pageNumber: number;
  /** Page width in points */
  width: number;
  /** Page height in points */
  height: number;
  /** Page rotation in degrees */
  rotation: number;
  /** Viewport at scale 1 */
  viewport: {
    width: number;
    height: number;
    scale: number;
  };
}

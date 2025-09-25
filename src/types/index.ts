/**
 * Core types for PDF content extraction
 */

export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FontInfo {
  name: string;
  size: number;
  weight?: string;
  style?: string;
  color?: string;
}

export interface TextItem {
  id: string;
  content: string;
  position: Position;
  font: FontInfo;
  page: number;
  transform?: number[];
  type: "text" | "heading" | "paragraph" | "caption";
  fontSize?: number;
  color?: string;
}

export interface ImageItem {
  id: string;
  name?: string;
  filename?: string;
  filepath?: string;
  position: Position;
  page: number;
  transform?: number[];
  width: number;
  height: number;
  format?: string;
  mimeType?: string;
  size?: number;
  filePath?: string; // Legacy compatibility
  data?: Uint8Array;
}

export interface PageInfo {
  number: number;
  width: number;
  height: number;
  textItems: TextItem[];
  images: ImageItem[];
  textCount: number;
  imageCount: number;
}

export interface DocumentMetadata {
  filename: string;
  pages: number;
  textLength: number;
  extractedAt: string;
  metadata: Record<string, unknown>;
  options: ExtractionOptions;
}

export interface ExtractionResult {
  document: DocumentMetadata;
  pages: PageInfo[];
  images: ImageItem[];
  textItems: TextItem[];
  text: string; // Main text content (alias for cleanText for backward compatibility)
  textWithRefs: string;
  cleanText: string;
  summary?: DocumentSummary;
  structuredData?: StructuredPageData;
}

export interface DocumentSummary {
  totalPages: number;
  totalTextItems: number;
  totalImages: number;
  totalTextLength: number;
  averageImagesPerPage: string;
  pagesWithImages: number;
}

export interface StructuredPageData {
  metadata: {
    filename: string;
    extractedAt: string;
    totalPages: number;
    totalTextLength: number;
    totalImages: number;
    extractionOptions: ExtractionOptions;
  };
  pages: PageData[];
}

export interface PageData {
  pageNumber: number;
  text: {
    content: string;
    rawText: string;
    wordCount: number;
    characterCount: number;
  };
  images: PageImageData[];
  imageCount: number;
}

export interface PageImageData {
  id: string;
  name: string;
  filename?: string;
  path?: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  format: string;
  size?: number;
}

export type ImageExtractionEngine = "pdf-lib" | "poppler" | "auto";

export interface ExtractionOptions {
  extractText?: boolean;
  extractImages?: boolean;
  extractImageFiles?: boolean;
  useImagePaths?: boolean;
  imageOutputDir?: string;
  imageRefFormat?: string;
  includeImageRefs?: boolean;
  includePageMarkers?: boolean;
  pageMarkerFormat?: string;
  /** Page number offset to align with visual PDF pages (e.g., +1 if PDF has cover page) */
  pageOffset?: number;
  /** Use combined extractor for accurate page boundaries (recommended) */
  useCombinedExtractor?: boolean;
  generateStructuredData?: boolean;
  extractTextItems?: boolean;
  specificPages?: number[];
  useCache?: boolean;
  /** Image extraction engine to use */
  imageEngine?: ImageExtractionEngine;
  cacheDir?: string;
  baseName?: string;
  verbose?: boolean;
  memoryLimit?: string;
  batchSize?: number;
  progressCallback?: (progress: ProgressInfo) => void;
}

export interface ProgressInfo {
  currentPage: number;
  totalPages: number;
  phase: "text" | "images" | "processing" | "complete";
  message?: string;
}

export interface ExtractorConfig {
  pdfPath: string;
  outputDir?: string;
  options: ExtractionOptions;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface PageExtractionResult {
  pageNumber: number;
  text: string;
  rawText: string;
  textItems: TextItem[];
  images: ImageItem[];
  metadata: {
    wordCount: number;
    characterCount: number;
    imageCount: number;
  };
}

export interface CacheInfo {
  pdfPath: string;
  lastModified: number;
  totalPages: number;
  cacheDir: string;
  created: string;
}

export interface ExtractionError extends Error {
  code: string;
  context?: Record<string, unknown>;
  validationErrors?: ValidationError[];
}

// Format placeholder types
export type FormatPlaceholder = "id" | "name" | "page" | "index" | "path";

export interface FormatContext {
  id: string;
  name: string;
  page: number;
  index: number;
  path: string;
}

// Processing phases for roadmap implementation
export interface ProcessingPhase {
  name: string;
  description: string;
  status: "not_started" | "in_progress" | "complete" | "error";
  progress?: number;
  error?: string;
}

// Memory management types
export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  timestamp: number;
}

export interface StreamingOptions {
  batchSize: number;
  memoryLimit: number;
  enableCaching: boolean;
  cacheSize?: number;
}

// Future enhancement types
export interface OCROptions {
  enabled: boolean;
  language?: string;
  confidence?: number;
  engine?: "tesseract" | "cloud";
}

export interface AnalyticsData {
  processingTime: number;
  memoryPeak: number;
  pagesPerSecond: number;
  errorCount: number;
  qualityScore?: number;
}

export interface TemplateOptions {
  format: "markdown" | "html" | "xml" | "json" | "custom";
  template?: string;
  variables?: Record<string, unknown>;
}

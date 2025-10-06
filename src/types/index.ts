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
  pageImage?: {
    path: string;
    format: string;
    width: number;
    height: number;
    size: number;
    dpi?: number;
    quality?: number;
  };
  thumbnail?: {
    path: string;
    format: string;
    width: number;
    height: number;
    size: number;
    quality?: number;
  };
  pageImageVariants?: Array<{
    path: string;
    format: string;
    width: number;
    height: number;
    size: number;
    quality: number;
    dpi?: number;
  }>;
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
  width?: number;
  height?: number;
  mimeType?: string;
}

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
  /** Enable image optimization after extraction (uses Jimp - pure JavaScript, default: false) */
  optimizeImages?: boolean;
  /** Image quality for optimization (0-100, default: 80) */
  imageQuality?: number;

  /**
   * Convert JPEG 2000 images to JPG format for better compatibility.
   * (default: true - convert JP2 to JPG)
   */
  convertJp2ToJpg?: boolean;

  /**
   * Preserve JPEG 2000 images in their original format.
   * By default (false), JPEG 2000 images (jp2, jpx, j2c, jpm) are converted to JPG for better compatibility.
   * Set to true to keep JPEG 2000 files in their original format.
   *
   * Note: JP2 images from PDFs are automatically decoded by PDF.js during extraction.
   * This option only affects standalone JP2 files.
   * (default: false - convert to JPG)
   */
  preserveJp2?: boolean;

  /**
   * Use Sharp library for ALL image processing operations (better quality & performance).
   *
   * When enabled, Sharp is used as the global image processing engine for:
   * - JP2 to JPG conversion
   * - Image optimization
   * - Image resizing
   * - Format conversions
   *
   * Sharp is an OPTIONAL dependency. Install it for better performance:
   * ```bash
   * npm install sharp
   * ```
   *
   * If Sharp is not installed, the library will automatically fall back to pure JavaScript (Jimp).
   *
   * (default: false - use pure JS Jimp)
   */
  useSharp?: boolean;

  // Performance options
  /** Enable parallel processing for better performance (default: true) */
  parallelProcessing?: boolean;
  /** Maximum number of pages to process in parallel (default: 10) */
  maxConcurrentPages?: number;
  /** Maximum number of images per page to extract in parallel (default: 20) */
  maxConcurrentImages?: number;
  /** Maximum number of JP2 to JPG conversions in parallel (default: 5) */
  maxConcurrentConversions?: number;
  /** Maximum number of image optimizations in parallel (default: 5) */
  maxConcurrentOptimizations?: number;

  // Worker thread options (Phase 3)
  /** Enable worker threads for CPU-intensive operations (default: false) */
  useWorkerThreads?: boolean;
  /** Auto-scale workers based on system resources (default: true) */
  autoScaleWorkers?: boolean;
  /** Maximum number of worker threads (default: CPU cores - 1) */
  maxWorkerThreads?: number;
  /** Minimum number of worker threads to keep alive (default: 1) */
  minWorkerThreads?: number;
  /** Memory threshold for scaling down workers 0-1 (default: 0.8) */
  memoryThreshold?: number;
  /** CPU threshold for scaling up workers 0-1 (default: 0.9) */
  cpuThreshold?: number;
  /** Worker task timeout in milliseconds (default: 30000) */
  workerTaskTimeout?: number;
  /** Worker idle timeout in milliseconds (default: 60000) */
  workerIdleTimeout?: number;
  /** Memory limit per worker in MB (default: 512) */
  workerMemoryLimit?: number;
  /** Use workers for JP2 conversion (default: true) */
  enableWorkerForConversion?: boolean;
  /** Use workers for image optimization (default: true) */
  enableWorkerForOptimization?: boolean;
  /** Use workers for image decoding (default: true) */
  enableWorkerForDecoding?: boolean;

  // Streaming options (Phase 4)
  /** Enable streaming mode for large PDFs (default: false) */
  streamMode?: boolean;
  /** Automatically enable streaming for PDFs with more than this many pages (default: 100) */
  autoStreamThreshold?: number;
  /** Enable backpressure handling (pause extraction if consumer is slow) (default: true) */
  enableBackpressure?: boolean;
  /** Maximum number of pages to buffer before pausing (default: 10) */
  maxBufferedPages?: number;
  /** Emit progress events every N pages (default: 5) */
  progressInterval?: number;
  /** Enable event callbacks in addition to async iterator (default: false) */
  enableEventCallbacks?: boolean;

  cacheDir?: string;
  baseName?: string;
  verbose?: boolean;
  memoryLimit?: string;
  batchSize?: number;
  progressCallback?: (progress: ProgressInfo) => void;

  // Page-to-image options
  /** Generate page images (default: false) */
  generatePageImages?: boolean;
  /** Generate thumbnails for pages (default: false) */
  generateThumbnails?: boolean;
  /** Include page images in structured output (default: false) */
  includePageImagesInStructuredData?: boolean;
  /** Page numbers to generate images for (default: all pages) */
  pageNumbers?: number[];
  /** Generate multiple quality variants of page images */
  pageImageQualities?: number[]; // e.g., [75, 80, 90, 100]
  /** DPI for page images (default: 150) */
  pageImageDpi?: number;
  /** Format for page images: 'png' | 'jpg' (default: 'png') */
  pageImageFormat?: "png" | "jpg";
  /** Quality for JPG page images (default: 90) */
  pageImageQuality?: number;
  /** Thumbnail width (default: 200) */
  thumbnailWidth?: number;
  /** Thumbnail quality for JPG (default: 80) */
  thumbnailQuality?: number;
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

// Streaming types
export type {
  StreamEventType,
  StreamEvent,
  StartEvent,
  PageEvent,
  ImageEvent,
  ProgressEvent,
  CompleteEvent,
  ErrorEvent,
  StreamEventUnion,
  StreamEventCallback,
  StreamEventCallbacks,
  StreamingExtractionResult,
  StreamingStats,
  StreamingState,
} from "./streaming-types.js";

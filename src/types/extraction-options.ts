/**
 * Extraction options for PDF processing
 */
import type { ProgressInfo } from "./progress-info.js";

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
   * Preserve JPEG 2000 images in their original format.
   *
   * JPEG 2000 (JP2) images extracted from PDFs are saved in their native JP2 format by default.
   * JP2 files have limited compatibility with standard image viewers and browsers.
   *
   * To convert JP2 to JPG, set this to false and use the ImageOptimizer.convertJp2ToJpg() method:
   *
   * ```typescript
   * import { ImageOptimizer } from 'pdf-plus';
   *
   * // Convert JP2 file to JPG using WASM decoder (pure JavaScript, no native dependencies)
   * const result = await ImageOptimizer.convertJp2ToJpg('image.jp2', {
   *   quality: 90,
   *   verbose: true
   * });
   * ```
   *
   * The conversion uses PDF.js's built-in OpenJPEG WASM decoder - no native dependencies required!
   *
   * (default: true - keep as JP2)
   */
  preserveJp2?: boolean;

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
  /**
   * Page rendering engine (default: 'pdfjs')
   *
   * Note: Poppler support has been removed. Only 'pdfjs' is now supported.
   * This option is kept for backwards compatibility but is ignored.
   *
   * @deprecated Poppler support removed - pdfjs is now the only engine
   */
  pageRenderEngine?: "pdfjs";
  /** Thumbnail width (default: 200) */
  thumbnailWidth?: number;
  /** Thumbnail quality for JPG (default: 80) */
  thumbnailQuality?: number;
}
